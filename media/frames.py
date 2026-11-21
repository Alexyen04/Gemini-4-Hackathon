"""Sharpest keyframe and multi-frame burst extraction via OpenCV."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from schemas.models import FrameSample


def compute_laplacian_sharpness(frame_bgr: np.ndarray) -> float:
    """Compute Laplacian variance sharpness score (higher = crisper, less motion blur)."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _resize_max_dim(frame_bgr: np.ndarray, max_dim: int = 1280) -> np.ndarray:
    h, w = frame_bgr.shape[:2]
    longest = max(h, w)
    if longest <= max_dim:
        return frame_bgr
    scale = max_dim / float(longest)
    return cv2.resize(
        frame_bgr,
        (max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
        interpolation=cv2.INTER_AREA,
    )


def extract_sharpest_keyframe(
    video_path: str | Path,
    peak_sec: float,
    output_path: str | Path,
    *,
    window_radius_sec: float = 0.6,
    sample_fps: float = 8.0,
    max_dim: int = 1280,
    jpeg_quality: int = 92,
) -> FrameSample:
    """Sample frames around peak_sec and save the sharpest frame weighted by proximity.

    Slightly prefers frames close to peak_sec unless an adjacent frame has
    markedly less motion blur.
    """
    vpath = str(Path(video_path).resolve())
    out_path = Path(output_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(vpath)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video for keyframe extraction: {vpath}")

    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_sec = (total_frames / fps) if (fps > 0 and total_frames > 0) else max(peak_sec + 1.0, 1.0)

        t_start = max(0.0, peak_sec - window_radius_sec)
        t_end = min(max(0.0, duration_sec - 0.05), peak_sec + window_radius_sec)
        if t_end < t_start:
            t_start = t_end = max(0.0, min(peak_sec, duration_sec - 0.05))

        step_sec = 1.0 / max(sample_fps, 1.0)
        sample_times: list[float] = []
        t = t_start
        while t <= t_end + 1e-6:
            sample_times.append(round(t, 3))
            t += step_sec
        if not sample_times:
            sample_times = [round(max(0.0, peak_sec), 3)]

        best_frame: Optional[np.ndarray] = None
        best_sec = sample_times[0]
        best_raw_sharpness = -1.0
        best_weighted_score = -1.0

        for ts in sample_times:
            cap.set(cv2.CAP_PROP_POS_MSEC, ts * 1000.0)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            sharpness = compute_laplacian_sharpness(frame)
            # Proximity bonus (1.0 at peak_sec -> 0.80 at edge of window)
            dist_ratio = abs(ts - peak_sec) / max(window_radius_sec, 0.01)
            proximity_weight = max(0.80, 1.0 - 0.20 * dist_ratio)
            weighted = sharpness * proximity_weight
            if weighted > best_weighted_score:
                best_weighted_score = weighted
                best_raw_sharpness = sharpness
                best_sec = ts
                best_frame = frame

        if best_frame is None:
            cap.set(cv2.CAP_PROP_POS_MSEC, 0.0)
            ok, frame = cap.read()
            if not ok or frame is None:
                raise RuntimeError(f"Failed to decode any frame around {peak_sec:.2f}s in {vpath}")
            best_frame = frame
            best_sec = 0.0
            best_raw_sharpness = compute_laplacian_sharpness(frame)

        resized = _resize_max_dim(best_frame, max_dim=max_dim)
        cv2.imwrite(
            str(out_path),
            resized,
            [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_quality)],
        )
        return FrameSample(
            path=str(out_path),
            timestamp_sec=round(best_sec, 3),
            sharpness=round(best_raw_sharpness, 2),
        )
    finally:
        cap.release()


def extract_burst_frames(
    video_path: str | Path,
    start_sec: float,
    end_sec: float,
    peak_sec: float,
    output_dir: str | Path,
    candidate_id: str,
    *,
    num_frames: int = 4,
    max_dim: int = 1024,
) -> list[FrameSample]:
    """Extract a chronological mini-burst of sharp frames across [start_sec, end_sec].

    Always anchors one sample around peak_sec so the storyline model gets setup,
    peak action, and follow-through options when testing frame-strip handoff mode.
    """
    out_dir = Path(output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    span = max(end_sec - start_sec, 0.4)
    if num_frames <= 1:
        anchors = [peak_sec]
    else:
        anchors = [
            start_sec + span * (i / float(num_frames - 1)) for i in range(num_frames)
        ]
        # Snap the closest anchor to peak_sec so peak action is guaranteed in the strip
        closest_idx = min(range(len(anchors)), key=lambda i: abs(anchors[i] - peak_sec))
        anchors[closest_idx] = peak_sec
        anchors = sorted(set(round(a, 3) for a in anchors))

    samples: list[FrameSample] = []
    local_radius = min(0.25, span / max(2.0 * len(anchors), 2.0))
    for idx, anchor_ts in enumerate(anchors):
        target = out_dir / f"{candidate_id}_f{idx + 1:02d}.jpg"
        sample = extract_sharpest_keyframe(
            video_path,
            anchor_ts,
            target,
            window_radius_sec=local_radius,
            sample_fps=8.0,
            max_dim=max_dim,
        )
        samples.append(sample)
    return samples
