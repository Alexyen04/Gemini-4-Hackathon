import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { PythonIngestBridge } from "@/lib/ingest/python-ingest-bridge";
import { StorageService } from "@/lib/storage/storage-service";

export async function GET(): Promise<NextResponse> {
  try {
    const videos = await PythonIngestBridge.listAvailableRawVideos();
    return NextResponse.json({ videos });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to list raw basketball videos.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("filePath");
    if (!filePath) {
      return NextResponse.json(
        { error: "filePath query parameter is required." },
        { status: 400 }
      );
    }

    const resolved = path.resolve(filePath);
    const rawDir = path.resolve(StorageService.getSubDir("raw_videos"));
    if (!resolved.startsWith(rawDir + path.sep)) {
      return NextResponse.json(
        {
          error:
            "Only browser-uploaded files inside data/raw_videos/ can be deleted from the UI.",
        },
        { status: 400 }
      );
    }

    await fs.rm(resolved, { force: true });
    const videos = await PythonIngestBridge.listAvailableRawVideos();
    return NextResponse.json({ videos });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to remove raw video.",
      },
      { status: 400 }
    );
  }
}
