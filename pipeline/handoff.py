"""Stage 3.5: Pre-Storyline Handoff Package Builder & Multimodal Input Formatters.

STOP BOUNDARY: Final step before the downstream storyline/manga generation model.
Smart Dual-Tier Clip Sizing:
  - LIVE sequences (`is_replay=False`): Full unbroken sequence clips (~8-18s) so
    the storyline model understands setup -> pass/steal -> finish + live commentary.
  - ZOOMED REPLAYS (`replay_angles` & standalone `is_replay=True`): Compact 2.5-4.5s
    visual snippets + sharp close-up burst frames so the storyline/panel stage gets
    zoomed-in, scorebug-free frames ready for direct manga conversion without AI extrapolation!
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Optional

from media.ffmpeg_utils import cut_video_segment
from media.frames import extract_burst_frames, extract_sharpest_keyframe
from pipeline.gemini_client import build_video_input_part, encode_file_base64
from pipeline.prompts import build_handoff_header_text
from schemas.models import (
    DirectorHandoffPackage,
    GamePlan,
    HandoffMediaMode,
    JobInput,
    PipelineStats,
    ReplayAngle,
    ScoredCandidate,
    SegmentOutput,
    SegmentSummaryEntry,
    VideoMetadata,
)


def compute_replay_snippet_window(
    start_sec: float,
    end_sec: float,
    peak_sec: float,
    *,
    total_duration_sec: float,
    max_snippet_sec: float = 4.5,
) -> tuple[float, float]:
    """Compute a tight 2.5-4.5s snippet window centered around a zoomed-in replay's apex."""
    c_start = max(0.0, max(start_sec - 0.6, peak_sec - 2.5))
    c_end = min(total_duration_sec, min(end_sec + 0.6, peak_sec + 2.0))
    if c_end - c_start < 2.2:
        c_start = max(0.0, peak_sec - 1.5)
        c_end = min(total_duration_sec, peak_sec + 1.5)
    if (c_end - c_start) > max_snippet_sec:
        c_start = max(0.0, peak_sec - max_snippet_sec * 0.55)
        c_end = min(total_duration_sec, c_start + max_snippet_sec)
    return round(c_start, 3), round(max(c_start + 0.8, c_end), 3)


def compute_play_clip_window(
    candidate: ScoredCandidate,
    *,
    total_duration_sec: float,
    pre_pad_sec: float = 3.0,
    post_pad_sec: float = 1.5,
    max_clip_duration_sec: float = 18.0,
) -> tuple[float, float]:
    """Compute `[c_start, c_end]`: full unbroken window for live plays, tight snippet for replays."""
    if candidate.is_replay:
        return compute_replay_snippet_window(
            candidate.start_sec,
            candidate.end_sec,
            candidate.peak_sec,
            total_duration_sec=total_duration_sec,
        )

    if candidate.category == "action":
        c_start = max(0.0, candidate.start_sec - pre_pad_sec)
        c_end = min(total_duration_sec, max(candidate.peak_sec + 1.8, candidate.end_sec + post_pad_sec))

        if (c_end - c_start) > max_clip_duration_sec:
            c_end = min(total_duration_sec, max(candidate.peak_sec + 1.8, min(c_end, candidate.end_sec + 1.2)))
            c_start = max(0.0, c_end - max_clip_duration_sec)
    else:
        c_start = max(0.0, candidate.start_sec - 1.5)
        c_end = min(total_duration_sec, candidate.end_sec + 1.5)
        if (c_end - c_start) > max_clip_duration_sec:
            c_start = max(0.0, candidate.peak_sec - max_clip_duration_sec * 0.55)
            c_end = min(total_duration_sec, c_start + max_clip_duration_sec)

    return round(c_start, 3), round(max(c_start + 1.0, c_end), 3)


def _materialize_replay_angle(
    parent_id: str,
    idx: int,
    angle: ReplayAngle,
    *,
    video_path: Path,
    total_duration_sec: float,
    keyframes_dir: Path,
    clips_dir: Path,
    burst_dir: Path,
    include_clips: bool,
    include_burst: bool,
    overwrite_media: bool,
) -> ReplayAngle:
    """Cut a compact <=4.5s snippet + 3-frame close-up burst for an attached ReplayAngle."""
    tag = f"{parent_id}_rep{idx}"
    r_start, r_end = compute_replay_snippet_window(
        angle.start_sec,
        angle.end_sec,
        angle.peak_sec,
        total_duration_sec=total_duration_sec,
    )
    updates: dict[str, Any] = {}

    if not angle.keyframe_path or not Path(angle.keyframe_path).is_file() or overwrite_media:
        kf = extract_sharpest_keyframe(video_path, angle.peak_sec, keyframes_dir / f"{tag}.jpg")
        updates["keyframe_path"] = kf.path
        updates["keyframe_sec"] = kf.timestamp_sec
        updates["keyframe_sharpness"] = kf.sharpness

    if include_clips:
        clip_target = clips_dir / f"{tag}.mp4"
        cut_video_segment(
            video_path,
            clip_target,
            r_start,
            r_end,
            accurate=True,
            overwrite=overwrite_media,
        )
        updates["clip_path"] = str(clip_target)
        updates["clip_start_sec"] = r_start
        updates["clip_end_sec"] = r_end

    if include_burst:
        updates["burst_frames"] = extract_burst_frames(
            video_path,
            r_start,
            r_end,
            angle.peak_sec,
            burst_dir,
            tag,
            num_frames=3,
        )

    return angle.model_copy(update=updates)


def _materialize_candidate_media(
    candidate: ScoredCandidate,
    *,
    video_path: Path,
    total_duration_sec: float,
    keyframes_dir: Path,
    clips_dir: Path,
    burst_dir: Path,
    include_clips: bool,
    include_burst: bool,
    clip_pre_pad_sec: float,
    clip_post_pad_sec: float,
    max_clip_duration_sec: float,
    burst_count: int,
    overwrite_media: bool = False,
) -> ScoredCandidate:
    """Materialize primary clip/burst AND any attached zoomed-in `replay_angles`."""
    updates: dict[str, Any] = {}

    c_start, c_end = compute_play_clip_window(
        candidate,
        total_duration_sec=total_duration_sec,
        pre_pad_sec=clip_pre_pad_sec,
        post_pad_sec=clip_post_pad_sec,
        max_clip_duration_sec=max_clip_duration_sec,
    )

    if include_clips:
        clip_target = clips_dir / f"{candidate.candidate_id}.mp4"
        cut_video_segment(
            video_path,
            clip_target,
            c_start,
            c_end,
            accurate=True,
            overwrite=overwrite_media,
        )
        updates["clip_path"] = str(clip_target)
        updates["clip_start_sec"] = c_start
        updates["clip_end_sec"] = c_end

    if include_burst:
        burst_samples = extract_burst_frames(
            video_path,
            c_start,
            c_end,
            candidate.peak_sec,
            burst_dir,
            candidate.candidate_id,
            num_frames=3 if candidate.is_replay else burst_count,
        )
        updates["burst_frames"] = burst_samples

    if candidate.replay_angles:
        updates["replay_angles"] = [
            _materialize_replay_angle(
                candidate.candidate_id,
                idx,
                ang,
                video_path=video_path,
                total_duration_sec=total_duration_sec,
                keyframes_dir=keyframes_dir,
                clips_dir=clips_dir,
                burst_dir=burst_dir,
                include_clips=include_clips,
                include_burst=include_burst,
                overwrite_media=overwrite_media,
            )
            for idx, ang in enumerate(candidate.replay_angles, start=1)
        ]

    return candidate.model_copy(update=updates)


def build_director_handoff(
    *,
    job_input: JobInput,
    video_meta: VideoMetadata,
    game_plan: GamePlan,
    segments: list[SegmentOutput],
    selected_pool: list[ScoredCandidate],
    all_scored: list[ScoredCandidate],
    raw_candidates_count: int,
    output_dir: str | Path,
    stage_timings_sec: Optional[dict[str, float]] = None,
    include_clips: bool = True,
    include_burst: bool = True,
    clip_pre_pad_sec: float = 3.0,
    clip_post_pad_sec: float = 1.5,
    max_clip_duration_sec: float = 18.0,
    burst_count: int = 5,
    max_workers: int = 4,
    overwrite_media: bool = False,
) -> tuple[DirectorHandoffPackage, Path]:
    """Materialize selected candidate clips/bursts (+ zoomed replay snippets) and write `handoff.json`."""
    out_root = Path(output_dir).resolve()
    keyframes_dir = out_root / "keyframes"
    clips_dir = out_root / "clips"
    burst_dir = out_root / "burst"
    vpath = Path(video_meta.video_path).resolve()

    chronological_pool = sorted(selected_pool, key=lambda c: c.peak_sec)

    def _prep(cand: ScoredCandidate) -> ScoredCandidate:
        return _materialize_candidate_media(
            cand,
            video_path=vpath,
            total_duration_sec=video_meta.duration_sec,
            keyframes_dir=keyframes_dir,
            clips_dir=clips_dir,
            burst_dir=burst_dir,
            include_clips=include_clips,
            include_burst=include_burst,
            clip_pre_pad_sec=clip_pre_pad_sec,
            clip_post_pad_sec=clip_post_pad_sec,
            max_clip_duration_sec=max_clip_duration_sec,
            burst_count=burst_count,
            overwrite_media=overwrite_media,
        )

    with ThreadPoolExecutor(max_workers=max(1, max_workers)) as pool:
        enriched_pool = list(pool.map(_prep, chronological_pool))

    enriched_pool.sort(key=lambda c: c.peak_sec)

    quadrant_counts: dict[str, int] = {}
    for c in all_scored:
        quadrant_counts[c.casting_quadrant] = quadrant_counts.get(c.casting_quadrant, 0) + 1

    summaries = [
        SegmentSummaryEntry(
            segment_id=s.segment_id,
            start_sec=s.start_sec,
            end_sec=s.end_sec,
            game_state_summary=s.game_state_summary,
        )
        for s in sorted(segments, key=lambda x: x.start_sec)
    ]

    handoff = DirectorHandoffPackage(
        job_input=job_input,
        video_metadata=video_meta,
        game_plan=game_plan,
        segment_summaries=summaries,
        selected_pool=enriched_pool,
        all_scored_candidates=all_scored,
        stats=PipelineStats(
            total_chunks=len(segments),
            raw_candidates_count=raw_candidates_count,
            deduped_candidates_count=len(all_scored),
            selected_pool_count=len(enriched_pool),
            quadrant_counts=quadrant_counts,
            stage_timings_sec=stage_timings_sec or {},
        ),
    )

    handoff_path = out_root / "handoff.json"
    handoff_path.parent.mkdir(parents=True, exist_ok=True)
    handoff_path.write_text(handoff.model_dump_json(indent=2), encoding="utf-8")
    return handoff, handoff_path


def estimate_handoff_mode_tradeoffs(
    handoff: DirectorHandoffPackage,
) -> dict[HandoffMediaMode, dict[str, Any]]:
    """Estimate Gemini token cost & media payload size across the 4 handoff modes."""
    pool = handoff.selected_pool
    summary: dict[HandoffMediaMode, dict[str, Any]] = {}

    for mode in ("keyframes_only", "burst_frames", "video_clips", "hybrid"):
        est_tokens = 1200
        total_bytes = 0
        media_items = 0

        for cand in pool:
            use_clip = mode == "video_clips" or (
                mode == "hybrid" and cand.casting_quadrant == "climax_candidate"
            )
            if use_clip and cand.clip_path and Path(cand.clip_path).is_file():
                dur = max(1.0, (cand.clip_end_sec or cand.end_sec) - (cand.clip_start_sec or cand.start_sec))
                est_tokens += int(round(dur * 132))
                total_bytes += Path(cand.clip_path).stat().st_size
                media_items += 1
            elif mode == "burst_frames" and cand.burst_frames:
                for bf in cand.burst_frames:
                    if Path(bf.path).is_file():
                        est_tokens += 350
                        total_bytes += Path(bf.path).stat().st_size
                        media_items += 1
            elif cand.keyframe_path and Path(cand.keyframe_path).is_file():
                est_tokens += 350
                total_bytes += Path(cand.keyframe_path).stat().st_size
                media_items += 1

            # Include attached zoomed-in replay angles (compact snippets in video_clips mode, sharp close-up keyframes in hybrid/frame modes!)
            for ang in cand.replay_angles:
                if mode == "video_clips" and ang.clip_path and Path(ang.clip_path).is_file():
                    r_dur = max(1.0, (ang.clip_end_sec or ang.end_sec) - (ang.clip_start_sec or ang.start_sec))
                    est_tokens += int(round(r_dur * 132))
                    total_bytes += Path(ang.clip_path).stat().st_size
                    media_items += 1
                elif ang.keyframe_path and Path(ang.keyframe_path).is_file():
                    est_tokens += 350
                    total_bytes += Path(ang.keyframe_path).stat().st_size
                    media_items += 1

        summary[mode] = {
            "candidates": len(pool),
            "media_parts": media_items,
            "payload_mb": round(total_bytes / (1024.0 * 1024.0), 2),
            "est_input_tokens": est_tokens,
        }

    return summary


def build_storyline_model_input(
    handoff: DirectorHandoffPackage,
    *,
    mode: HandoffMediaMode = "hybrid",
    client: Optional[Any] = None,
) -> list[dict[str, Any]]:
    """Construct the multimodal `input` list ready for `client.interactions.create`."""
    parts: list[dict[str, Any]] = []

    seg_lines = "\n".join(
        f"  - [{s.segment_id} | {s.start_sec:.1f}s..{s.end_sec:.1f}s]: {s.game_state_summary}"
        for s in handoff.segment_summaries
    )
    header = build_handoff_header_text(
        user_focus=handoff.job_input.user_focus,
        protagonist_focus=handoff.game_plan.protagonist_focus,
        story_angle=handoff.game_plan.story_angle,
        target_pages=handoff.job_input.target_pages,
        reading_direction=handoff.job_input.reading_direction,
        duration_sec=handoff.video_metadata.duration_sec,
        seg_lines=seg_lines,
        pool_count=len(handoff.selected_pool),
        mode=mode,
    )
    parts.append({"type": "text", "text": header})

    for idx, cand in enumerate(handoff.selected_pool, start=1):
        quotes = (
            " | ".join(f'"{q.text}" @{q.timestamp_sec:.1f}s' for q in cand.verbatim_quotes)
            if cand.verbatim_quotes
            else "None"
        )
        meta_block = (
            f"\n### Beat #{idx}: `{cand.candidate_id}` "
            f"[{cand.start_sec:.1f}s..{cand.end_sec:.1f}s, peak={cand.peak_sec:.1f}s, "
            f"framing={cand.camera_framing}, is_replay_snippet={cand.is_replay}, "
            f"attached_zoom_replays={len(cand.replay_angles)}]\n"
            f"- Category: {cand.category} | Casting Quadrant: {cand.casting_quadrant} ({cand.pool_selection_reason})\n"
            f"- Scores: story={cand.scores.narrative_leverage:.2f}, "
            f"action={cand.scores.action_spectacle:.2f}, "
            f"focus={cand.scores.user_focus_match:.2f}, "
            f"clarity={cand.scores.visual_clarity:.2f}, "
            f"rank={cand.scores.composite_story_rank:.2f}\n"
            f"- Score/Clock: {cand.score_context or 'N/A'} | Players: {', '.join(cand.players_involved) or 'N/A'} | Tone: {cand.emotional_tone}\n"
            f"- What Happens: {cand.description}\n"
            f"- Story Significance: {cand.narrative_context}\n"
            f"- Verbatim Commentary: {quotes}"
        )
        parts.append({"type": "text", "text": meta_block})

        use_clip = mode == "video_clips" or (
            mode == "hybrid" and cand.casting_quadrant == "climax_candidate"
        )
        if use_clip and cand.clip_path and Path(cand.clip_path).is_file():
            clip_note = (
                f"Attached {'zoomed replay snippet' if cand.is_replay else 'full live sequence clip'} "
                f"for `{cand.candidate_id}` covers full-video {cand.clip_start_sec:.2f}s..{cand.clip_end_sec:.2f}s "
                f"(add {cand.clip_start_sec:.2f}s to clip-relative time for exact source frame)."
            )
            parts.append({"type": "text", "text": clip_note})
            if client is not None:
                parts.append(build_video_input_part(client, cand.clip_path, agentic=False))
            else:
                parts.append(
                    {
                        "type": "video",
                        "data": encode_file_base64(cand.clip_path),
                        "mime_type": "video/mp4",
                    }
                )
        elif mode == "burst_frames" and cand.burst_frames:
            for bf in cand.burst_frames:
                if Path(bf.path).is_file():
                    parts.append(
                        {
                            "type": "text",
                            "text": f"Candidate `{cand.candidate_id}` frame option @ {bf.timestamp_sec:.2f}s:",
                        }
                    )
                    parts.append(
                        {
                            "type": "image",
                            "data": encode_file_base64(bf.path),
                            "mime_type": "image/jpeg",
                        }
                    )
        elif cand.keyframe_path and Path(cand.keyframe_path).is_file():
            parts.append(
                {
                    "type": "text",
                    "text": f"Candidate `{cand.candidate_id}` peak keyframe @ {(cand.keyframe_sec or cand.peak_sec):.2f}s:",
                }
            )
            parts.append(
                {
                    "type": "image",
                    "data": encode_file_base64(cand.keyframe_path),
                    "mime_type": "image/jpeg",
                }
            )

        # Attach any paired zoomed-in replay angles right alongside the parent live beat!
        for r_idx, ang in enumerate(cand.replay_angles, start=1):
            ang_note = (
                f"  -> Paired Zoomed-In Replay Angle #{r_idx} (`{ang.replay_id}`, framing={ang.camera_framing}, "
                f"source={ang.start_sec:.2f}s..{ang.end_sec:.2f}s, peak={ang.peak_sec:.2f}s): {ang.description} "
                f"[Prefer this close-up angle for manga panel conversion!]"
            )
            parts.append({"type": "text", "text": ang_note})
            if mode == "video_clips" and ang.clip_path and Path(ang.clip_path).is_file():
                if client is not None:
                    parts.append(build_video_input_part(client, ang.clip_path, agentic=False))
                else:
                    parts.append(
                        {
                            "type": "video",
                            "data": encode_file_base64(ang.clip_path),
                            "mime_type": "video/mp4",
                        }
                    )
            elif ang.keyframe_path and Path(ang.keyframe_path).is_file():
                parts.append(
                    {
                        "type": "image",
                        "data": encode_file_base64(ang.keyframe_path),
                        "mime_type": "image/jpeg",
                    }
                )

    return parts
