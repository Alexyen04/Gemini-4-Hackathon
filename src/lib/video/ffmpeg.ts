import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

const execFileAsync = promisify(execFile);

export interface VideoProbeMetadata {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  codecName: string;
  mimeType: string;
}

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".m4v",
]);

export class VideoInputService {
  static getFfmpegBinary(): string {
    if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
    if (typeof ffmpegStatic === "string" && ffmpegStatic.length > 0) {
      return ffmpegStatic;
    }
    return "ffmpeg";
  }

  static getFfprobeBinary(): string {
    if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
    if (ffprobeStatic && typeof ffprobeStatic.path === "string") {
      return ffprobeStatic.path;
    }
    return "ffprobe";
  }

  static validateExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase() || ".mp4";
    if (!SUPPORTED_VIDEO_EXTENSIONS.has(ext)) {
      throw new Error(
        `Unsupported video format "${ext}". Supported formats: MP4, MOV, WebM, MKV.`
      );
    }
    return ext;
  }

  static inferMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case ".mov":
        return "video/quicktime";
      case ".webm":
        return "video/webm";
      case ".mkv":
        return "video/x-matroska";
      default:
        return "video/mp4";
    }
  }

  /**
   * Probes a video file with ffprobe to verify integrity, codec support,
   * dimensions, frame rate, and exact duration.
   */
  static async probeVideo(filePath: string): Promise<VideoProbeMetadata> {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.size < 64) {
      throw new Error("Uploaded video file is empty or unreadable.");
    }

    const ffprobeBin = this.getFfprobeBinary();
    let stdout = "";
    try {
      const res = await execFileAsync(ffprobeBin, [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ]);
      stdout = res.stdout;
    } catch (err) {
      throw new Error(
        `Corrupted or unsupported video file (ffprobe failed): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    let parsed: {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
        avg_frame_rate?: string;
        duration?: string;
      }>;
      format?: { duration?: string };
    };

    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new Error("Failed to parse ffprobe metadata JSON.");
    }

    const videoStream = parsed.streams?.find((s) => s.codec_type === "video");
    if (!videoStream) {
      throw new Error("File does not contain a valid video stream.");
    }

    const durationRaw =
      Number(videoStream.duration) || Number(parsed.format?.duration) || 0;
    if (!Number.isFinite(durationRaw) || durationRaw <= 0.05) {
      throw new Error("Video has invalid or zero duration.");
    }

    const fpsStr =
      videoStream.avg_frame_rate && videoStream.avg_frame_rate !== "0/0"
        ? videoStream.avg_frame_rate
        : videoStream.r_frame_rate || "30/1";
    const [numStr, denStr] = fpsStr.split("/");
    const fpsNum = Number(numStr) || 30;
    const fpsDen = Number(denStr) || 1;
    const fps = Math.max(1, Math.min(120, fpsNum / fpsDen));

    return {
      durationSec: Number(durationRaw.toFixed(3)),
      width: videoStream.width || 1280,
      height: videoStream.height || 720,
      fps: Number(fps.toFixed(2)),
      codecName: videoStream.codec_name || "h264",
      mimeType: this.inferMimeType(filePath),
    };
  }

  /**
   * Detects highlight segment boundaries inside a single consolidated video
   * using keyframe-only downscaled FFmpeg scene detection (`-skip_frame nokey`
   * + `scale=320:-1`) so even 20+ minute videos scan in seconds instead of
   * decoding every full-HD frame.
   */
  static async detectConsolidatedSegments(
    filePath: string,
    totalDurationSec: number,
    targetSegmentCount = 5
  ): Promise<Array<{ startSec: number; endSec: number }>> {
    if (totalDurationSec <= 4.5) {
      return [{ startSec: 0, endSec: totalDurationSec }];
    }

    const ffmpegBin = this.getFfmpegBinary();
    const cutTimestamps: number[] = [];

    try {
      const { stderr } = await execFileAsync(ffmpegBin, [
        "-skip_frame",
        "nokey",
        "-i",
        filePath,
        "-vf",
        "scale=320:-1,select='gt(scene,0.30)',showinfo",
        "-vsync",
        "0",
        "-f",
        "null",
        "-",
      ]);

      const regex = /pts_time:([0-9.]+)/g;
      let match: RegExpExecArray | null;
      const minGap = totalDurationSec > 120 ? 15 : 1.8;
      while ((match = regex.exec(stderr)) !== null) {
        const ts = Number(match[1]);
        if (
          Number.isFinite(ts) &&
          ts > 1.2 &&
          ts < totalDurationSec - 1.2 &&
          (cutTimestamps.length === 0 ||
            ts - cutTimestamps[cutTimestamps.length - 1] >= minGap)
        ) {
          cutTimestamps.push(Number(ts.toFixed(2)));
        }
      }
    } catch {
      // Scene detection is best-effort; fallback splits evenly below
    }

    if (cutTimestamps.length >= 2 && cutTimestamps.length <= 8) {
      const points = [0, ...cutTimestamps, totalDurationSec];
      return points.slice(0, -1).map((start, idx) => ({
        startSec: Number(start.toFixed(2)),
        endSec: Number(points[idx + 1].toFixed(2)),
      }));
    }

    // For very long consolidated videos (e.g. 20 min), sample concise 12s highlight windows
    const segCount = Math.min(
      6,
      Math.max(2, Math.min(targetSegmentCount, Math.floor(totalDurationSec / 2)))
    );
    const step = totalDurationSec / segCount;
    const maxSegDur = totalDurationSec > 60 ? 12 : step;
    return Array.from({ length: segCount }, (_, i) => {
      const startSec = Number((i * step).toFixed(2));
      const endSec = Number(
        Math.min(totalDurationSec, startSec + maxSegDur).toFixed(2)
      );
      return { startSec, endSec };
    });
  }

  /**
   * Slices a segment out of a consolidated video using near-instantaneous
   * stream copy (`-c copy`), falling back to fast H.264 re-encode only if needed.
   */
  static async extractSubClip(
    inputPath: string,
    outputPath: string,
    startSec: number,
    endSec: number
  ): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const duration = Math.max(0.5, endSec - startSec);
    const ffmpegBin = this.getFfmpegBinary();

    try {
      await execFileAsync(ffmpegBin, [
        "-y",
        "-ss",
        startSec.toFixed(3),
        "-i",
        inputPath,
        "-t",
        duration.toFixed(3),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "-an",
        outputPath,
      ]);
      const stat = await fs.stat(outputPath).catch(() => null);
      if (stat && stat.size > 256) return;
    } catch {
      // Fallback to ultrafast re-encode below
    }

    await execFileAsync(ffmpegBin, [
      "-y",
      "-ss",
      startSec.toFixed(3),
      "-i",
      inputPath,
      "-t",
      duration.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      outputPath,
    ]);
  }
}
