import { NextRequest, NextResponse } from "next/server";
import { StorageService } from "@/lib/storage/storage-service";

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
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load story" },
      { status: 500 }
    );
  }
}
