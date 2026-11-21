import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  LayoutTemplateIdSchema,
  ReadingDirectionSchema,
} from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { PageCompositionService } from "@/lib/manga/layout-engine";
import { HybridMangaRenderer } from "@/lib/manga/hybrid-renderer";

const UpdateStoryboardPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  readingDirection: ReadingDirectionSchema.optional(),
  pageLayoutUpdate: z
    .object({
      pageId: z.string(),
      layoutTemplate: LayoutTemplateIdSchema,
    })
    .optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ storyId: string }> }
): Promise<NextResponse> {
  try {
    const { storyId } = await context.params;
    const project = await StorageService.getStory(storyId);
    if (!project) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    return NextResponse.json({
      storyboard: project.storyboard,
      narrative: project.narrative,
      characters: project.characters,
      qualityReport: project.qualityReport,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load storyboard",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ storyId: string }> }
): Promise<NextResponse> {
  try {
    const { storyId } = await context.params;
    const project = await StorageService.getStory(storyId);
    if (!project) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const patch = UpdateStoryboardPatchSchema.parse(await req.json());
    const direction =
      patch.readingDirection || project.storyboard.readingDirection;
    const title = patch.title || project.storyboard.title;

    const updatedPages = [];
    for (const page of project.storyboard.pages) {
      const overrideTpl =
        patch.pageLayoutUpdate && patch.pageLayoutUpdate.pageId === page.pageId
          ? patch.pageLayoutUpdate.layoutTemplate
          : undefined;

      const needsRecompose =
        Boolean(overrideTpl) ||
        direction !== project.storyboard.readingDirection ||
        title !== project.storyboard.title;

      if (needsRecompose) {
        const composed = PageCompositionService.composePage(
          page,
          direction,
          overrideTpl
        );
        const exported = await HybridMangaRenderer.renderCompositePageExport({
          storyId: project.storyId,
          storyTitle: title,
          page: composed,
          readingDirection: direction,
        });
        updatedPages.push({
          ...composed,
          compositeAssetUrl: `${exported.mediaUrl}?v=${Date.now()}`,
        });
      } else {
        updatedPages.push(page);
      }
    }

    project.storyboard = {
      ...project.storyboard,
      title,
      readingDirection: direction,
      pages: updatedPages,
    };
    project.preferences.readingDirection = direction;

    const saved = await StorageService.saveStory(project);
    return NextResponse.json({ project: saved });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update storyboard",
      },
      { status: 400 }
    );
  }
}
