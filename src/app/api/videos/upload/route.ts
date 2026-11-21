import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { PythonIngestBridge } from "@/lib/ingest/python-ingest-bridge";
import { StorageService } from "@/lib/storage/storage-service";
import { VideoInputService } from "@/lib/video/ffmpeg";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await StorageService.ensureDirectories();
    const formData = await req.formData();

    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const file = files[0] || singleFile;

    if (!file) {
      return NextResponse.json(
        { error: "No raw video file provided in upload request." },
        { status: 400 }
      );
    }

    const ext = VideoInputService.validateExtension(file.name);
    const safeStem = path
      .parse(file.name)
      .name.replace(/[^a-zA-Z0-9 _-]+/g, "")
      .trim() || `raw_game_${Date.now()}`;
    const destPath = path.join(
      StorageService.getSubDir("raw_videos"),
      `${safeStem}_${Date.now()}${ext}`
    );

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(destPath, bytes);

    try {
      await VideoInputService.probeVideo(destPath);
    } catch (probeErr) {
      await fs.rm(destPath, { force: true });
      throw probeErr;
    }

    const videos = await PythonIngestBridge.listAvailableRawVideos();
    const uploaded =
      videos.find((v) => path.resolve(v.filePath) === path.resolve(destPath)) ||
      videos[0] ||
      null;

    return NextResponse.json({
      uploaded,
      videos,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Raw video upload failed.",
      },
      { status: 400 }
    );
  }
}
