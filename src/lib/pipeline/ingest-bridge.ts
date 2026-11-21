import { execFile } from "child_process";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { promisify } from "util";
import type { MangaPreferences, NormalizedClip } from "@/types/manga";

const run = promisify(execFile);

/**
 * Bridge to the Python upstream pipeline (`run_ingest.py`, Stages 1 → 3.5):
 * Gemini plan + parallel scouting + gemini-decision-1 two-axis ranking → handoff.json.
 * Its ranked beats ground the studio's narrative + storyboard stages.
 * Never fatal: if Python or the run fails, the studio continues on its own clip analysis.
 */

const FOCUS_TEXT: Record<MangaPreferences["storytellingFocus"], string> = {
  action_focused: "Focus on the most explosive action plays",
  balanced: "Balance the big plays with the emotional story",
  emotion_focused: "Focus on the emotional turning points, pressure and reactions",
};

interface HandoffBeat {
  candidate_id: string;
  category: string;
  start_sec: number;
  end_sec: number;
  peak_sec: number;
  description: string;
  score_context?: string;
  emotional_tone?: string;
  verbatim_quotes?: { text: string; timestamp_sec: number }[];
  casting_quadrant: string;
  scores: Record<string, unknown>;
}
interface Handoff {
  game_plan: { story_angle?: string; protagonist_focus?: string };
  segment_summaries: { game_state_summary: string }[];
  selected_pool: HandoffBeat[];
}

export interface IngestResult {
  clipId: string;
  beatCount: number;
  context: string;
}

function pythonBin(): string {
  if (process.env.INGEST_PYTHON) return process.env.INGEST_PYTHON;
  const venv = path.join(process.cwd(), ".venv", "bin", "python");
  return existsSync(venv) ? venv : "python3";
}

async function ingestClip(clip: NormalizedClip, preferences: MangaPreferences, jobId: string): Promise<IngestResult | null> {
  const ingestJobId = `${jobId}_${clip.clipId}`;
  try {
    await run(
      pythonBin(),
      [
        "run_ingest.py", "--video", clip.filePath, "--focus", FOCUS_TEXT[preferences.storytellingFocus], "--job-id", ingestJobId,
        // studio only reads ranked beats: skip the planner LLM (preset focus), clip cutting, burst strips and preview
        "--fast-plan", "--no-clips", "--no-burst", "--no-preview",
      ],
      { cwd: process.cwd(), timeout: 5 * 60_000, maxBuffer: 16 * 1024 * 1024 }
    );
    const raw = await fs.readFile(path.join(process.cwd(), "outputs", ingestJobId, "handoff.json"), "utf8");
    const h = JSON.parse(raw) as Handoff;
    // Compact, clip-local view of the ranked pool for the director prompts (no file paths, no media).
    const beats = h.selected_pool.map((b) => ({
      id: b.candidate_id,
      category: b.category,
      startSec: b.start_sec,
      endSec: b.end_sec,
      peakSec: b.peak_sec,
      description: b.description,
      scoreContext: b.score_context,
      tone: b.emotional_tone,
      verbatimQuotes: b.verbatim_quotes ?? [],
      castingQuadrant: b.casting_quadrant,
      scores: b.scores,
    }));
    const context = JSON.stringify(
      {
        clipId: clip.clipId,
        storyAngle: h.game_plan.story_angle,
        gameState: h.segment_summaries.map((s) => s.game_state_summary),
        rankedBeats: beats,
      },
      null,
      2
    );
    return { clipId: clip.clipId, beatCount: beats.length, context };
  } catch (err) {
    console.warn(`[ingest-bridge] run_ingest.py failed for ${clip.clipId}; continuing without ranked beats:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function runIngestForClips(clips: NormalizedClip[], preferences: MangaPreferences, jobId: string): Promise<IngestResult[]> {
  if (process.env.INGEST_PIPELINE === "off") return [];
  const results = await Promise.all(clips.map((c) => ingestClip(c, preferences, jobId)));
  return results.filter((r): r is IngestResult => r !== null);
}

/** Prompt block shared by narrative + storyboard stages. */
export function ingestPromptBlock(results: IngestResult[]): string {
  if (!results.length) return "";
  return `
UPSTREAM RANKED BEATS (gemini-decision-1 calibrated scores; times are clip-local seconds):
Prefer these beats and their peakSec as panel "sourceTimestamp" values. "climax_candidate" beats earn the largest panels;
"emotional_beat" beats become quiet close-up / reaction panels. Quote verbatimQuotes exactly or not at all.
${results.map((r) => r.context).join("\n")}
`;
}
