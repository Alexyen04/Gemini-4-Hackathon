import fs from "fs/promises";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MangaPreferencesSchema } from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { SampleHighlightGenerator } from "@/lib/video/sample-generator";
import {
  PythonDirectorHandoff,
  PythonIngestBridge,
} from "@/lib/ingest/python-ingest-bridge";
import { MangaJobManager } from "@/lib/jobs/job-manager";
import { POST as uploadRawVideoPost } from "@/app/api/videos/upload/route";
import { GET as listRawVideosGet } from "@/app/api/videos/route";

describe("Raw Video -> Python Handoff -> Storyline & Manga Integration", () => {
  let tempDataDir = "";
  let sampleVideoPath = "";

  beforeAll(async () => {
    tempDataDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "court-ink-handoff-bridge-")
    );
    process.env.MANGA_DATA_DIR = tempDataDir;
    await StorageService.ensureDirectories();
    const clips = await SampleHighlightGenerator.ensureSampleHighlights();
    sampleVideoPath = path.join(tempDataDir, "raw_game_test.mp4");
    await fs.copyFile(clips[0].filePath, sampleVideoPath);
  });

  afterAll(async () => {
    if (tempDataDir) {
      await fs.rm(tempDataDir, { recursive: true, force: true });
    }
  });

  it("1. Discovers raw videos in data/ and uploads raw video via /api/videos/upload", async () => {
    const listRes = await listRawVideosGet();
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.videos.length).toBeGreaterThanOrEqual(1);

    const mp4Bytes = await fs.readFile(sampleVideoPath);
    const form = new FormData();
    form.append(
      "file",
      new File([mp4Bytes], "pickup_game.mp4", { type: "video/mp4" })
    );
    const req = new NextRequest("http://localhost:3000/api/videos/upload", {
      method: "POST",
      body: form,
    });
    const upRes = await uploadRawVideoPost(req);
    expect(upRes.status).toBe(200);
    const upJson = await upRes.json();
    expect(upJson.uploaded).toBeTruthy();
    expect(upJson.uploaded.mediaUrl).toContain("/api/media/raw_videos/");
  });

  it("2. Bridges Python handoff.json (live beats + zoomed replay angles) end-to-end into MangaStoryProject", async () => {
    const handoffFixturePath = path.join(
      StorageService.getSubDir("ingest"),
      "mock_handoff_job",
      "handoff.json"
    );
    await fs.mkdir(path.dirname(handoffFixturePath), { recursive: true });

    const mockHandoff: PythonDirectorHandoff = {
      schema_version: "1.0",
      job_input: {
        job_id: "mock_handoff_job",
        video_path: sampleVideoPath,
        user_focus: "Emphasize the final steal into game-winning 3-pointer",
        target_pages: 2,
        target_pool_size: 6,
      },
      video_metadata: {
        video_path: sampleVideoPath,
        duration_sec: 3.0,
        fps: 24,
        width: 640,
        height: 360,
      },
      game_plan: {
        protagonist_focus: "#24 clutch steal and three-pointer",
        has_specific_focus: true,
        story_angle: "Comeback heist in the closing seconds",
        scout_instructions: "Capture unbroken live sequences + zoomed replays",
        scoring_weights: {
          action_spectacle: 0.2,
          narrative_leverage: 0.35,
          user_focus_match: 0.35,
          visual_clarity: 0.1,
        },
      },
      segment_summaries: [
        {
          segment_id: "seg_01",
          start_sec: 0,
          end_sec: 3.0,
          game_state_summary:
            "Down two in the closing seconds, #24 jumps the passing lane and buries the game-winning three.",
        },
      ],
      selected_pool: [
        {
          candidate_id: "seg_01_b01",
          segment_id: "seg_01",
          category: "story_emotion",
          start_sec: 0.1,
          end_sec: 1.4,
          peak_sec: 0.8,
          description: "Coach rallies the huddle down two points with 10 seconds left.",
          narrative_context: "High-pressure timeout setting the stage.",
          players_involved: ["Coach", "#24"],
          score_context: "70-72, 0:10 2nd",
          verbatim_quotes: [{ text: "One stop and we win this game!", timestamp_sec: 0.7 }],
          emotional_tone: "tense",
          is_replay: false,
          camera_framing: "tight_closeup",
          replay_angles: [],
          clip_path: sampleVideoPath,
          clip_start_sec: 0.0,
          clip_end_sec: 3.0,
          scores: {
            action_spectacle: 0.25,
            narrative_leverage: 0.9,
            user_focus_match: 0.85,
            visual_clarity: 0.88,
            composite_story_rank: 0.76,
          },
          casting_quadrant: "emotional_beat",
          pool_selection_reason: "story_tension_or_emotion_quota",
        },
        {
          candidate_id: "seg_01_b02",
          segment_id: "seg_01",
          category: "action",
          start_sec: 1.4,
          end_sec: 2.9,
          peak_sec: 2.3,
          description:
            "#24 steals the midcourt pass and drains a deep three-pointer for the lead.",
          narrative_context: "Game-winning shot completing the comeback.",
          players_involved: ["#24", "#11"],
          score_context: "73-72, 0:00.3 2nd",
          verbatim_quotes: [{ text: "STOLEN—FOR THE LEAD, BANG!", timestamp_sec: 2.4 }],
          emotional_tone: "triumphant",
          is_replay: false,
          camera_framing: "wide_court",
          replay_angles: [
            {
              replay_id: "seg_01_b03",
              start_sec: 1.8,
              end_sec: 2.8,
              peak_sec: 2.3,
              camera_framing: "rim_or_baseline",
              description: "Zoomed baseline replay of #24 releasing the three-pointer.",
              clip_path: sampleVideoPath,
              clip_start_sec: 0.0,
              clip_end_sec: 3.0,
            },
          ],
          clip_path: sampleVideoPath,
          clip_start_sec: 0.0,
          clip_end_sec: 3.0,
          scores: {
            action_spectacle: 0.95,
            narrative_leverage: 0.97,
            user_focus_match: 0.98,
            visual_clarity: 0.9,
            composite_story_rank: 0.96,
          },
          casting_quadrant: "climax_candidate",
          pool_selection_reason: "climax_or_turning_point_quota",
        },
      ],
      all_scored_candidates: [],
      stats: {
        total_chunks: 1,
        raw_candidates_count: 3,
        deduped_candidates_count: 2,
        selected_pool_count: 2,
      },
    };

    await fs.writeFile(
      handoffFixturePath,
      JSON.stringify(mockHandoff, null, 2),
      "utf-8"
    );

    const converted = await PythonIngestBridge.convertHandoffToMangaInputs({
      handoff: mockHandoff,
      targetPages: 2,
    });
    // 2 primary live beats + 1 paired zoomed-in replay clip = 3 chronologically ordered clips!
    expect(converted.clips.length).toBe(3);
    expect(converted.clips[2].title).toContain("[Zoomed Close-Up Replay Angle]");
    expect(converted.upstreamHandoffContext).toContain(
      "Emphasize the final steal into game-winning 3-pointer"
    );

    // Run full MangaJobManager end-to-end starting from rawVideoPath + userPrompt!
    const prefs = MangaPreferencesSchema.parse({
      targetPages: 2,
      userPrompt: "Emphasize the final steal into game-winning 3-pointer",
    });
    const job = await MangaJobManager.startGenerationJob({
      rawVideoPath: sampleVideoPath,
      userPrompt: "Emphasize the final steal into game-winning 3-pointer",
      reuseIngestCache: true,
      cachedHandoffPath: handoffFixturePath,
      preferences: prefs,
      mode: "demo",
    });

    // Poll until background pipeline finishes
    let finishedJob = await StorageService.getJob(job.jobId);
    for (let i = 0; i < 60; i++) {
      if (
        finishedJob?.status === "completed" ||
        finishedJob?.status === "failed"
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
      finishedJob = await StorageService.getJob(job.jobId);
    }

    expect(finishedJob?.status).toBe("completed");
    expect(
      finishedJob?.stages.find((s) => s.id === "video_ingest")?.status
    ).toBe("completed");

    const savedStory = await StorageService.getStory(job.storyId);
    expect(savedStory).toBeTruthy();
    expect(savedStory!.storyboard.pages.length).toBe(2);
    expect(
      savedStory!.storyboard.pages[0].panels[0].illustration.assetUrl
    ).toBeTruthy();
  });
});
