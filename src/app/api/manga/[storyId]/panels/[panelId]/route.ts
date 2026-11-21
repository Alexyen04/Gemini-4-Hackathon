import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CameraShotSchema,
  DialogueBubbleSchema,
  MangaEmotionSchema,
} from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { HybridMangaRenderer } from "@/lib/manga/hybrid-renderer";

const PatchPanelSchema = z.object({
  caption: z.string().nullable().optional(),
  sfx: z.string().nullable().optional(),
  sfxSubtext: z.string().nullable().optional(),
  description: z.string().optional(),
  emotion: MangaEmotionSchema.optional(),
  cameraShot: CameraShotSchema.optional(),
  visualEffects: z.array(z.string()).optional(),
  dialogue: z.array(DialogueBubbleSchema).max(3).optional(),
  sourceTimestamp: z.number().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ storyId: string; panelId: string }> }
): Promise<NextResponse> {
  try {
    const { storyId, panelId } = await context.params;
    const project = await StorageService.getStory(storyId);
    if (!project) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const patch = PatchPanelSchema.parse(await req.json());
    let updatedPageIdx = -1;

    project.storyboard.pages = project.storyboard.pages.map((page, pIdx) => {
      const hasPanel = page.panels.some((pan) => pan.panelId === panelId);
      if (!hasPanel) return page;
      updatedPageIdx = pIdx;

      return {
        ...page,
        panels: page.panels.map((pan) => {
          if (pan.panelId !== panelId) return pan;

          const clip = project.clips.find((c) => c.clipId === pan.sourceClipId);
          const nextTs =
            patch.sourceTimestamp !== undefined && clip
              ? Number(
                  Math.min(
                    Math.max(0.05, patch.sourceTimestamp),
                    clip.durationSec - 0.05
                  ).toFixed(2)
                )
              : pan.sourceTimestamp;

          return {
            ...pan,
            caption: patch.caption !== undefined ? patch.caption : pan.caption,
            sfx: patch.sfx !== undefined ? patch.sfx : pan.sfx,
            sfxSubtext:
              patch.sfxSubtext !== undefined
                ? patch.sfxSubtext
                : pan.sfxSubtext,
            description: patch.description ?? pan.description,
            emotion: patch.emotion ?? pan.emotion,
            cameraShot: patch.cameraShot ?? pan.cameraShot,
            visualEffects: patch.visualEffects ?? pan.visualEffects,
            dialogue: patch.dialogue ?? pan.dialogue,
            sourceTimestamp: nextTs,
            interaction: {
              ...pan.interaction,
              timestamp: nextTs,
            },
          };
        }),
      };
    });

    if (updatedPageIdx === -1) {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }

    const updatedPage = project.storyboard.pages[updatedPageIdx];
    const exported = await HybridMangaRenderer.renderCompositePageExport({
      storyId: project.storyId,
      storyTitle: project.storyboard.title,
      page: updatedPage,
      readingDirection: project.storyboard.readingDirection,
    });
    project.storyboard.pages[updatedPageIdx].compositeAssetUrl = `${
      exported.mediaUrl
    }?v=${Date.now()}`;

    const saved = await StorageService.saveStory(project);
    return NextResponse.json({ project: saved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update panel" },
      { status: 400 }
    );
  }
}
