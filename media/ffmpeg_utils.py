"""FFmpeg resolution, OpenCV video probing, and segment/clip cutting."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2

from schemas.models import VideoMetadata


def get_ffmpeg_binary() -> str:
    """Resolve system ffmpeg on PATH or fall back to bundled imageio-ffmpeg."""
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise RuntimeError(
            "FFmpeg not found on PATH and 'imageio-ffmpeg' is not installed. "
            "Run 'pip install -r requirements.txt' or install ffmpeg."
        ) from exc


def probe_video_metadata(video_path: str | Path) -> VideoMetadata:
    """Read duration, FPS, and dimensions via OpenCV (no ffprobe dependency)."""
    path_str = str(Path(video_path).resolve())
    if not Path(path_str).is_file():
        raise FileNotFoundError(f"Video file not found: {path_str}")

    cap = cv2.VideoCapture(path_str)
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV could not open video: {path_str}")

    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        if fps <= 0.0 or fps > 240.0:
            fps = 30.0
        frame_count = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        duration_sec = frame_count / fps if frame_count > 0 else 0.0

        if duration_sec <= 0.0:
            # Fallback seek-to-end probe for containers missing frame_count headers
            cap.set(cv2.CAP_PROP_POS_AVI_RATIO, 1.0)
            pos_msec = float(cap.get(cv2.CAP_PROP_POS_MSEC) or 0.0)
            duration_sec = max(pos_msec / 1000.0, 0.1)
    finally:
        cap.release()

    return VideoMetadata(
        video_path=path_str,
        duration_sec=round(duration_sec, 3),
        fps=round(fps, 3),
        width=max(width, 1),
        height=max(height, 1),
    )


def cut_video_segment(
    input_path: str | Path,
    output_path: str | Path,
    start_sec: float,
    end_sec: float,
    *,
    accurate: bool = False,
    overwrite: bool = True,
) -> Path:
    """Trim [start_sec, end_sec] from input_path into output_path using FFmpeg.

    Args:
        accurate: If False, attempts ultra-fast stream copy first (great for
            large Stage 1 chunks) and falls back to ultrafast H.264 re-encode.
            If True, re-encodes with libx264 ultrafast so short 4-8s candidate
            clips start at the exact requested timestamp without keyframe drift.
    """
    in_path = Path(input_path).resolve()
    out_path = Path(output_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if out_path.is_file() and out_path.stat().st_size > 0 and not overwrite:
        return out_path

    duration = max(end_sec - start_sec, 0.25)
    ffmpeg_bin = get_ffmpeg_binary()

    if not accurate:
        copy_cmd = [
            ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{start_sec:.3f}",
            "-i",
            str(in_path),
            "-t",
            f"{duration:.3f}",
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            str(out_path),
        ]
        proc = subprocess.run(copy_cmd, capture_output=True, text=True)
        if proc.returncode == 0 and out_path.is_file() and out_path.stat().st_size > 1024:
            return out_path

    encode_cmd = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{start_sec:.3f}",
        "-i",
        str(in_path),
        "-t",
        f"{duration:.3f}",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        str(out_path),
    ]
    proc = subprocess.run(encode_cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"FFmpeg failed cutting {in_path} [{start_sec:.2f}s..{end_sec:.2f}s]:\n{proc.stderr}"
        )
    return out_path
