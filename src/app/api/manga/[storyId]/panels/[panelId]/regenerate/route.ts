import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ActionIntensitySchema,
  CameraShotSchema,
  ColorTreatmentSchema,
  MangaStylePresetSchema,
  RendererModeSchema,
} from "@/types/manga";
import { MangaJobManager } from "@/lib/jobs/job-manager";

const RegenerateRequestSchema = z.object({
  customPromptHint: z.string().max(600).optional(),
  overrideRenderer: RendererModeSchema.optional(),
  overrideStyle: MangaStylePresetSchema.optional(),
  overrideColorTreatment: ColorTreatmentSchema.optional(),
  overrideActionIntensity: ActionIntensitySchema.optional(),
  overrideCameraShot: CameraShotSchema.optional(),
  overrideVisualEffects: z.array(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ storyId: string; panelId: string }> }
): Promise<NextResponse> {
  try {
    const { storyId, panelId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = RegenerateRequestSchema.parse(body);

    const { project, updatedPanel } =
      await MangaJobManager.regenerateSinglePanel({
        storyId,
        panelId,
        ...parsed,
      });

    return NextResponse.json({ project, updatedPanel });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to regenerate panel",
      },
      { status: 400 }
    );
  }
}
