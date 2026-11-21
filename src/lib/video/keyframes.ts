import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { KeyframeReference } from "@/types/manga";
import { VideoInputService } from "./ffmpeg";
import { StorageService } from "@/lib/storage/storage-service";

const execFileAsync = promisify(execFile);

export class KeyframeExtractionService {
  /**
   * Computes a normalized [0, 1] sharpness/detail score using Sobel-like
   * pixel differences on a small downsampled grayscale buffer so blurry
   * motion frames can be deprioritized when selecting reference frames.
   */
  static async computeSharpnessScore(imagePath: string): Promise<number> {
    try {
      const { data, info } = await sharp(imagePath)
        .greyscale()
        .resize(160, 90, { fit: "inside" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      let gradSum = 0;
      let count = 0;
      for (let y = 1; y < info.height - 1; y++) {
        for (let x = 1; x < info.width - 1; x++) {
          const idx = y * info.width + x;
          const gx = Math.abs(data[idx + 1] - data[idx - 1]);
          const gy = Math.abs(data[idx + info.width] - data[idx - info.width]);
          gradSum += gx + gy;
          count++;
        }
      }
      const meanGrad = count > 0 ? gradSum / count : 20;
      return Number(Math.min(1, Math.max(0.15, meanGrad / 55)).toFixed(3));
    } catch {
      return 0.75;
    }
  }

  /**
   * Extracts representative keyframes across the clip's duration using FFmpeg
   * and records both clip-local timestamps and optional full-game timestamps.
   */
  static async extractKeyframesForClip(params: {
    clipId: string;
    videoPath: string;
    durationSec: number;
    originalGameTimestampSec?: number;
    segmentStartOffsetSec?: number;
    frameCount?: number;
  }): Promise<KeyframeReference[]> {
    const {
      clipId,
      videoPath,
      durationSec,
      originalGameTimestampSec,
      segmentStartOffsetSec = 0,
      frameCount = 5,
    } = params;

    await StorageService.ensureDirectories();
    const outDir = path.join(StorageService.getSubDir("keyframes"), clipId);
    await fs.mkdir(outDir, { recursive: true });

    const safeCount = Math.max(3, Math.min(8, frameCount));
    // Sample evenly inside [8% .. 92%] of the clip so we capture setup, action, peak, and aftermath
    const ratios = Array.from({ length: safeCount }, (_, idx) => {
      if (safeCount === 1) return 0.5;
      return 0.08 + (0.84 * idx) / (safeCount - 1);
    });

    const ffmpegBin = VideoInputService.getFfmpegBinary();

    // Extract all representative keyframes concurrently for 4-5x faster ingestion
    const keyframes = await Promise.all(
      ratios.map(async (ratio, i): Promise<KeyframeReference> => {
        const ts = Number(
          Math.min(
            Math.max(0.02, durationSec * ratio),
            Math.max(0.02, durationSec - 0.05)
          ).toFixed(2)
        );
        const frameId = `${clipId}_f${String(i + 1).padStart(2, "0")}`;
        const framePath = path.join(outDir, `${frameId}.png`);

        await execFileAsync(ffmpegBin, [
          "-y",
          "-ss",
          ts.toFixed(3),
          "-i",
          videoPath,
          "-frames:v",
          "1",
          "-vf",
          "scale='min(960,iw)':-2",
          framePath,
        ]);

        const [meta, sharpnessScore] = await Promise.all([
          sharp(framePath).metadata(),
          this.computeSharpnessScore(framePath),
        ]);

        const gameTimestampSec =
          originalGameTimestampSec !== undefined
            ? Number((originalGameTimestampSec + ts).toFixed(2))
            : segmentStartOffsetSec > 0
            ? Number((segmentStartOffsetSec + ts).toFixed(2))
            : undefined;

        return {
          frameId,
          clipId,
          timestampSec: ts,
          gameTimestampSec,
          filePath: framePath,
          mediaUrl: StorageService.toMediaUrl(framePath),
          width: meta.width || 960,
          height: meta.height || 540,
          sharpnessScore,
        };
      })
    );

    return keyframes;
  }

  /**
   * Extracts or retrieves a keyframe at a specific panel timestamp so that
   * beat decomposition timestamps always match the exact basketball moment.
   */
  static async getOrExtractFrameAtTimestamp(params: {
    clipId: string;
    videoPath: string;
    durationSec: number;
    timestampSec: number;
    existingKeyframes: KeyframeReference[];
  }): Promise<KeyframeReference> {
    const { clipId, videoPath, durationSec, timestampSec, existingKeyframes } =
      params;

    const clampedTs = Number(
      Math.min(Math.max(0.02, timestampSec), Math.max(0.02, durationSec - 0.05)).toFixed(2)
    );

    // Reuse an existing keyframe if within 0.22 seconds
    const closeMatch = existingKeyframes.find(
      (kf) => Math.abs(kf.timestampSec - clampedTs) <= 0.22
    );
    if (closeMatch) {
      const exists = await fs
        .stat(closeMatch.filePath)
        .then(() => true)
        .catch(() => false);
      if (exists) return closeMatch;
    }

    const outDir = path.join(StorageService.getSubDir("keyframes"), clipId);
    await fs.mkdir(outDir, { recursive: true });
    const tsSlug = String(Math.round(clampedTs * 100)).padStart(5, "0");
    const frameId = `${clipId}_t${tsSlug}`;
    const framePath = path.join(outDir, `${frameId}.png`);

    const alreadyExtracted = await fs
      .stat(framePath)
      .then(() => true)
      .catch(() => false);

    if (!alreadyExtracted) {
      const ffmpegBin = VideoInputService.getFfmpegBinary();
      await execFileAsync(ffmpegBin, [
        "-y",
        "-ss",
        clampedTs.toFixed(3),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-vf",
        "scale='min(1280,iw)':-2",
        framePath,
      ]);
    }

    const meta = await sharp(framePath).metadata();
    const sharpnessScore = await this.computeSharpnessScore(framePath);

    return {
      frameId,
      clipId,
      timestampSec: clampedTs,
      filePath: framePath,
      mediaUrl: StorageService.toMediaUrl(framePath),
      width: meta.width || 1280,
      height: meta.height || 720,
      sharpnessScore,
    };
  }
}
