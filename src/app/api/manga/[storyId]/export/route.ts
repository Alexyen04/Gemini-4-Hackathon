import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { StorageService } from "@/lib/storage/storage-service";
import { HybridMangaRenderer } from "@/lib/manga/hybrid-renderer";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ storyId: string }> }
): Promise<NextResponse> {
  try {
    const { storyId } = await context.params;
    const project = await StorageService.getStory(storyId);
    if (!project) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const pageParam = req.nextUrl.searchParams.get("page");
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      const page = project.storyboard.pages.find(
        (p) => p.pageNumber === pageNum
      );
      if (!page) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      const exported = await HybridMangaRenderer.renderCompositePageExport({
        storyId: project.storyId,
        storyTitle: project.storyboard.title,
        page,
        readingDirection: project.storyboard.readingDirection,
      });

      const bytes = await fs.readFile(exported.filePath);
      const safeTitle = project.storyboard.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${safeTitle}-page-${page.pageNumber}.png"`,
        },
      });
    }

    // Otherwise return JSON index of all exportable composite pages
    const exports = [];
    for (const page of project.storyboard.pages) {
      const exported = await HybridMangaRenderer.renderCompositePageExport({
        storyId: project.storyId,
        storyTitle: project.storyboard.title,
        page,
        readingDirection: project.storyboard.readingDirection,
      });
      exports.push({
        pageNumber: page.pageNumber,
        pageId: page.pageId,
        downloadUrl: `/api/manga/${project.storyId}/export?page=${page.pageNumber}`,
        previewUrl: exported.mediaUrl,
      });
    }

    return NextResponse.json({
      storyId: project.storyId,
      title: project.storyboard.title,
      pages: exports,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
