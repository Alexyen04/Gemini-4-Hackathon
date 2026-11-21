import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { StorageService } from "@/lib/storage/storage-service";
import { ClipGameMetadataSchema } from "@/types/manga";

const PatchClipsSchema = z.object({
  orderedClipIds: z.array(z.string()).optional(),
  updateClip: z
    .object({
      clipId: z.string(),
      title: z.string().optional(),
      metadata: ClipGameMetadataSchema.partial().optional(),
    })
    .optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const clips = await StorageService.listClips();
    return NextResponse.json({ clips });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list clips" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const body = PatchClipsSchema.parse(await req.json());

    if (body.orderedClipIds) {
      for (let i = 0; i < body.orderedClipIds.length; i++) {
        const clip = await StorageService.getClip(body.orderedClipIds[i]);
        if (clip) {
          await StorageService.saveClip({ ...clip, orderIndex: i });
        }
      }
    }

    if (body.updateClip) {
      const existing = await StorageService.getClip(body.updateClip.clipId);
      if (!existing) {
        return NextResponse.json({ error: "Clip not found" }, { status: 404 });
      }
      await StorageService.saveClip({
        ...existing,
        title: body.updateClip.title ?? existing.title,
        metadata: {
          ...existing.metadata,
          ...(body.updateClip.metadata || {}),
        },
      });
    }

    const clips = await StorageService.listClips();
    return NextResponse.json({ clips });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update clips" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const clipId = req.nextUrl.searchParams.get("clipId");
    if (!clipId) {
      return NextResponse.json({ error: "Missing clipId" }, { status: 400 });
    }
    await StorageService.deleteClip(clipId);
    const clips = await StorageService.listClips();
    return NextResponse.json({ clips });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete clip" },
      { status: 500 }
    );
  }
}
