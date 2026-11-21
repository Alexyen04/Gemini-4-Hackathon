import { NextRequest, NextResponse } from "next/server";
import { StorageService } from "@/lib/storage/storage-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  try {
    const { jobId } = await context.params;
    const job = await StorageService.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load job" },
      { status: 500 }
    );
  }
}
