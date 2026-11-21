import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MangaPreferencesSchema, PipelineModeSchema } from "@/types/manga";
import { MangaJobManager } from "@/lib/jobs/job-manager";
import { StorageService } from "@/lib/storage/storage-service";

const StartGenerateRequestSchema = z.object({
  clipIds: z.array(z.string()).min(1, "Select or upload at least one clip"),
  preferences: MangaPreferencesSchema.optional(),
  mode: PipelineModeSchema.default("real"),
  resumeJobId: z.string().optional(),
});

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
    const preferences = MangaPreferencesSchema.parse(parsed.preferences || {});

    const job = await MangaJobManager.startGenerationJob({
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
