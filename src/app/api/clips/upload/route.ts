import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { ClipGameMetadataSchema, NormalizedClip } from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { VideoInputService } from "@/lib/video/ffmpeg";
import { KeyframeExtractionService } from "@/lib/video/keyframes";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await StorageService.ensureDirectories();
    const formData = await req.formData();

    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const uploadList = files.length > 0 ? files : singleFile ? [singleFile] : [];

    if (uploadList.length === 0) {
      return NextResponse.json(
        { error: "No video files provided in upload request." },
        { status: 400 }
      );
    }

    const isConsolidated =
      formData.get("consolidated") === "true" && uploadList.length === 1;
    const rawMeta = formData.get("metadata") as string | null;
    const sharedMeta = rawMeta
      ? ClipGameMetadataSchema.partial().parse(JSON.parse(rawMeta))
      : {};

    const existingClips = await StorageService.listClips();
    let nextOrder = existingClips.length;
    const createdClips: NormalizedClip[] = [];

    if (isConsolidated) {
      // Option B: One consolidated highlight video -> detect play boundaries & slice
      const file = uploadList[0];
      const ext = VideoInputService.validateExtension(file.name);
      const parentId = `cons_${Date.now()}_${crypto
        .randomBytes(3)
        .toString("hex")}`;
      const parentPath = path.join(
        StorageService.getSubDir("clips"),
        `${parentId}${ext}`
      );

      const bytes = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(parentPath, bytes);
      const probe = await VideoInputService.probeVideo(parentPath);
      const segments = await VideoInputService.detectConsolidatedSegments(
        parentPath,
        probe.durationSec,
        4
      );

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segId = `clip_${Date.now()}_s${i + 1}_${crypto
          .randomBytes(2)
          .toString("hex")}`;
        const segPath = path.join(
          StorageService.getSubDir("clips"),
          `${segId}.mp4`
        );
        await VideoInputService.extractSubClip(
          parentPath,
          segPath,
          seg.startSec,
          seg.endSec
        );
        const segProbe = await VideoInputService.probeVideo(segPath);
        const keyframes =
          await KeyframeExtractionService.extractKeyframesForClip({
            clipId: segId,
            videoPath: segPath,
            durationSec: segProbe.durationSec,
            segmentStartOffsetSec: seg.startSec,
            originalGameTimestampSec: sharedMeta.originalGameTimestampSec,
            frameCount: 4,
          });

        const clipRecord = await StorageService.saveClip({
          clipId: segId,
          title: `${path.parse(file.name).name} — Highlight #${i + 1} (${seg.startSec.toFixed(
            1
          )}s–${seg.endSec.toFixed(1)}s)`,
          orderIndex: nextOrder++,
          originalFileName: file.name,
          filePath: segPath,
          mediaUrl: StorageService.toMediaUrl(segPath),
          mimeType: "video/mp4",
          durationSec: segProbe.durationSec,
          width: segProbe.width,
          height: segProbe.height,
          fps: segProbe.fps,
          isConsolidatedSegment: true,
          parentConsolidatedId: parentId,
          segmentStartOffsetSec: seg.startSec,
          metadata: {
            players: [],
            ...sharedMeta,
          },
          keyframes,
          confidence: 0.94,
          createdAt: new Date().toISOString(),
        });
        createdClips.push(clipRecord);
      }
    } else {
      // Option A: Multiple individual basketball highlight clips
      for (const file of uploadList) {
        const ext = VideoInputService.validateExtension(file.name);
        const clipId = `clip_${Date.now()}_${crypto
          .randomBytes(3)
          .toString("hex")}`;
        const destPath = path.join(
          StorageService.getSubDir("clips"),
          `${clipId}${ext}`
        );

        const bytes = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(destPath, bytes);

        let probe;
        try {
          probe = await VideoInputService.probeVideo(destPath);
        } catch (probeErr) {
          await fs.rm(destPath, { force: true });
          throw probeErr;
        }

        const keyframes =
          await KeyframeExtractionService.extractKeyframesForClip({
            clipId,
            videoPath: destPath,
            durationSec: probe.durationSec,
            originalGameTimestampSec: sharedMeta.originalGameTimestampSec,
            frameCount: 5,
          });

        const cleanTitle = path
          .parse(file.name)
          .name.replace(/[_-]+/g, " ")
          .trim();

        const clipRecord = await StorageService.saveClip({
          clipId,
          title: cleanTitle || `Highlight Clip ${nextOrder + 1}`,
          orderIndex: nextOrder++,
          originalFileName: file.name,
          filePath: destPath,
          mediaUrl: StorageService.toMediaUrl(destPath),
          mimeType: probe.mimeType,
          durationSec: probe.durationSec,
          width: probe.width,
          height: probe.height,
          fps: probe.fps,
          isConsolidatedSegment: false,
          segmentStartOffsetSec: 0,
          metadata: {
            players: [],
            ...sharedMeta,
          },
          keyframes,
          confidence: 0.96,
          createdAt: new Date().toISOString(),
        });
        createdClips.push(clipRecord);
      }
    }

    const allClips = await StorageService.listClips();
    return NextResponse.json({
      uploaded: createdClips,
      clips: allClips,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Video upload and processing failed.",
      },
      { status: 400 }
    );
  }
}
