import { NextResponse } from "next/server";
import { SampleHighlightGenerator } from "@/lib/video/sample-generator";
import { StorageService } from "@/lib/storage/storage-service";

export async function POST(): Promise<NextResponse> {
  try {
    await SampleHighlightGenerator.ensureSampleHighlights();
    const clips = await StorageService.listClips();
    return NextResponse.json({ clips });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate sample basketball highlights.",
      },
      { status: 500 }
    );
  }
}
