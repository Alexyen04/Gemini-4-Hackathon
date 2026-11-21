import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MangaPreferencesSchema, PipelineModeSchema } from "@/types/manga";
import { MangaJobManager } from "@/lib/jobs/job-manager";
import { StorageService } from "@/lib/storage/storage-service";

const StartGenerateRequestSchema = z
  .object({
    rawVideoPath: z.string().min(1).optional(),
    userPrompt: z.string().max(1500).optional(),
    reuseIngestCache: z.boolean().default(true),
    cachedHandoffPath: z.string().optional(),
    clipIds: z.array(z.string()).optional(),
    preferences: MangaPreferencesSchema.optional(),
    mode: PipelineModeSchema.default("real"),
    resumeJobId: z.string().optional(),
  })
  .refine(
    (val) =>
      Boolean(val.rawVideoPath) || Boolean(val.clipIds && val.clipIds.length > 0),
    {
      message:
        "Provide a raw basketball video (rawVideoPath) or at least one clipId.",
    }
  );

export async function GET(): Promise<NextResponse> {
  try {
    const stories = await StorageService.listStories();
    return NextResponse.json({
      stories: stories.map((s) => ({
        storyId: s.storyId,
        title: s.storyboard.title,
        subtitle: s.storyboard.subtitle,
        mode: s.mode,
        style: s.storyboard.style,
        pageCount: s.storyboard.pages.length,
        panelCount: s.storyboard.pages.reduce(
          (acc, p) => acc + p.panels.length,
          0
        ),
        coverUrl:
          s.storyboard.pages[0]?.panels[0]?.illustration.assetUrl || null,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list stories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const parsed = StartGenerateRequestSchema.parse(await req.json());
    const effectivePrompt = (
      parsed.userPrompt ??
      parsed.preferences?.userPrompt ??
      parsed.preferences?.directorNotes ??
      ""
    ).trim();

    const preferences = MangaPreferencesSchema.parse({
      ...(parsed.preferences || {}),
      userPrompt: effectivePrompt,
      directorNotes: effectivePrompt || parsed.preferences?.directorNotes || "",
    });

    const job = await MangaJobManager.startGenerationJob({
      rawVideoPath: parsed.rawVideoPath,
      userPrompt: effectivePrompt,
      reuseIngestCache: parsed.reuseIngestCache,
      cachedHandoffPath: parsed.cachedHandoffPath,
      clipIds: parsed.clipIds,
      preferences,
      mode: parsed.mode,
      resumeJobId: parsed.resumeJobId,
    });

    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to start manga generation job.",
      },
      { status: 400 }
    );
  }
}
