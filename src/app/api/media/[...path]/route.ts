import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { StorageService } from "@/lib/storage/storage-service";

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".mkv":
      return "video/x-matroska";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  try {
    const { path: segments } = await context.params;
    const absPath = StorageService.resolveMediaSegments(segments);
    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return NextResponse.json({ error: "Media asset not found" }, { status: 404 });
    }

    const contentType = getContentType(absPath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.get("range");

    // Full HTTP 206 Range support for instantaneous HTML5 <video> timestamp seeking
    if (rangeHeader && contentType.startsWith("video/")) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2]
          ? Math.min(fileSize - 1, parseInt(match[2], 10))
          : fileSize - 1;

        if (start >= fileSize || start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${fileSize}` },
          });
        }

        const chunkSize = end - start + 1;
        const nodeStream = createReadStream(absPath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new NextResponse(webStream, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    const bytes = await fs.readFile(absPath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to serve media" },
      { status: 400 }
    );
  }
}
