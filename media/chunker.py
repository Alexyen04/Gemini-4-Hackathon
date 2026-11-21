"""Stage 1 duration-adaptive overlapping video chunking."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
from typing import Optional

from media.ffmpeg_utils import cut_video_segment, probe_video_metadata
from schemas.models import ChunkPlan


def choose_window_and_overlap(duration_sec: float) -> tuple[float, float]:
    """Pick (chunk_window_sec, overlap_sec) adaptively from total video duration.

    Shorter windows (<= 180s) keep 1-FPS static video token density sharp so the
    scout model tracks live possessions accurately without drifting onto stoppage replays.
    - <= 120s (live demo / short clip): single chunk, 0s overlap
    - 120s .. 360s (2-6 min highlight/pickup): 90s chunks, 10s overlap
    - 360s .. 1200s (6-20 min quarter): 150s (2.5m) chunks, 12s overlap
    - > 1200s (full broadcast game): 180s (3m) chunks, 14s overlap
    """
    if duration_sec <= 120.0:
        return duration_sec, 0.0
    if duration_sec <= 360.0:
        return 90.0, 10.0
    if duration_sec <= 1200.0:
        return 150.0, 12.0
    return 180.0, 14.0


def build_adaptive_chunk_plan(
    total_duration_sec: float,
    *,
    focus_start_sec: Optional[float] = None,
    focus_end_sec: Optional[float] = None,
    override_chunk_sec: Optional[float] = None,
    override_overlap_sec: Optional[float] = None,
    split_into_quarters: bool = False,
) -> list[ChunkPlan]:
    """Generate overlapping ChunkPlan windows covering the target timeline."""
    start_bound = max(0.0, focus_start_sec or 0.0)
    end_bound = min(total_duration_sec, focus_end_sec or total_duration_sec)
    if end_bound <= start_bound + 1.0:
        start_bound, end_bound = 0.0, total_duration_sec

    span = end_bound - start_bound

    if split_into_quarters and span >= 240.0:
        quarter_len = span / 4.0
        overlap = 10.0
        chunks: list[ChunkPlan] = []
        for idx in range(4):
            c_start = max(start_bound, start_bound + idx * quarter_len - (overlap if idx > 0 else 0.0))
            c_end = min(end_bound, start_bound + (idx + 1) * quarter_len + (overlap if idx < 3 else 0.0))
            chunks.append(
                ChunkPlan(
                    segment_id=f"seg_q{idx + 1}",
                    index=idx,
                    start_sec=round(c_start, 3),
                    end_sec=round(c_end, 3),
                    duration_sec=round(c_end - c_start, 3),
                )
            )
        return chunks

    auto_win, auto_ov = choose_window_and_overlap(span)
    window_sec = override_chunk_sec if (override_chunk_sec and override_chunk_sec > 5.0) else auto_win
    overlap_sec = (
        override_overlap_sec
        if (override_overlap_sec is not None and override_overlap_sec >= 0.0)
        else auto_ov
    )
    overlap_sec = min(overlap_sec, window_sec * 0.4)

    if span <= window_sec + 5.0:
        return [
            ChunkPlan(
                segment_id="seg_01",
                index=0,
                start_sec=round(start_bound, 3),
                end_sec=round(end_bound, 3),
                duration_sec=round(span, 3),
            )
        ]

    step = max(window_sec - overlap_sec, 5.0)
    chunks = []
    cursor = start_bound
    idx = 0

    while cursor < end_bound - 1.0:
        c_end = min(cursor + window_sec, end_bound)
        # Absorb short trailing tail directly into this chunk to avoid a redundant upload
        remaining_tail = end_bound - c_end
        if 0.0 < remaining_tail <= min(25.0, window_sec * 0.25):
            c_end = end_bound

        chunks.append(
            ChunkPlan(
                segment_id=f"seg_{idx + 1:02d}",
                index=idx,
                start_sec=round(cursor, 3),
                end_sec=round(c_end, 3),
                duration_sec=round(c_end - cursor, 3),
            )
        )
        if c_end >= end_bound:
            break
        cursor += step
        idx += 1

    return chunks


def materialize_chunks(
    video_path: str | Path,
    chunks: list[ChunkPlan],
    chunks_dir: str | Path,
    *,
    total_duration_sec: float,
    max_workers: int = 4,
) -> list[ChunkPlan]:
    """Cut chunk MP4 files on disk (or link/copy directly when single full-video chunk)."""
    src = Path(video_path).resolve()
    out_dir = Path(chunks_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Fast path: 1 chunk spanning the entire clip needs zero FFmpeg cutting
    if (
        len(chunks) == 1
        and chunks[0].start_sec <= 0.05
        and abs(chunks[0].end_sec - total_duration_sec) <= 0.5
    ):
        single = chunks[0].model_copy(
            update={
                "chunk_path": str(src),
                "actual_start_sec": 0.0,
                "actual_duration_sec": round(total_duration_sec, 3),
            }
        )
        return [single]

    def _cut_one(chunk: ChunkPlan) -> ChunkPlan:
        target = out_dir / f"{chunk.segment_id}.mp4"
        cut_video_segment(
            src,
            target,
            chunk.start_sec,
            chunk.end_sec,
            accurate=False,
            overwrite=False,
        )
        # Stream-copy (`-ss` before `-i` + `-c copy`) snaps chunk frame 0 back to
        # the preceding H.264 I-frame while ending at `chunk.end_sec`. Measuring
        # actual duration gives frame-accurate `actual_start_sec` with zero re-encode cost!
        actual_meta = probe_video_metadata(target)
        actual_dur = actual_meta.duration_sec
        if actual_dur >= chunk.duration_sec - 0.15:
            true_start = max(0.0, round(chunk.end_sec - actual_dur, 3))
        else:
            true_start = chunk.start_sec
        return chunk.model_copy(
            update={
                "chunk_path": str(target),
                "actual_start_sec": true_start,
                "actual_duration_sec": round(actual_dur, 3),
            }
        )

    with ThreadPoolExecutor(max_workers=max(1, max_workers)) as pool:
        return list(pool.map(_cut_one, chunks))
