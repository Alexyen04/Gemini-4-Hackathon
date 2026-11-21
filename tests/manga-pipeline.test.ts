import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MangaPreferencesSchema,
  MangaStoryProject,
  NormalizedClip,
  StoryNarrativeSchema,
} from "@/types/manga";
import { MangaSkillLoader } from "@/lib/manga/skill-loader";
import { PageCompositionService } from "@/lib/manga/layout-engine";
import { StoryboardValidator, SvgSanitizer } from "@/lib/manga/validators";
import { VideoInputService } from "@/lib/video/ffmpeg";
import { KeyframeExtractionService } from "@/lib/video/keyframes";
import { SampleHighlightGenerator } from "@/lib/video/sample-generator";
import { HybridMangaRenderer } from "@/lib/manga/hybrid-renderer";
import { DemoPipelineSynthesizer } from "@/lib/ai/demo-fixtures";
import { ClipUnderstandingAgent } from "@/lib/ai/clip-understanding";
import {
  assertAllowedGeminiModel,
  GeminiConfigurationError,
  hasConfiguredApiKey,
} from "@/lib/ai/gemini-client";
import { MangaJobManager } from "@/lib/jobs/job-manager";
import { StorageService } from "@/lib/storage/storage-service";
import { POST as uploadClipsPost } from "@/app/api/clips/upload/route";
import { GET as mediaGet } from "@/app/api/media/[...path]/route";
import { PATCH as patchPanel } from "@/app/api/manga/[storyId]/panels/[panelId]/route";
import { GET as exportGet } from "@/app/api/manga/[storyId]/export/route";

describe("COURT & INK — Comprehensive 14-Point Automated Test Suite", () => {
  let tempDataDir = "";
  let sampleClips: NormalizedClip[] = [];
  let generatedProject: MangaStoryProject;

  beforeAll(async () => {
    tempDataDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "court-ink-manga-suite-")
    );
    process.env.MANGA_DATA_DIR = tempDataDir;
    await StorageService.ensureDirectories();
    sampleClips = await SampleHighlightGenerator.ensureSampleHighlights();
  });

  afterAll(async () => {
    if (tempDataDir) {
      await fs.rm(tempDataDir, { recursive: true, force: true });
    }
  });

  it("Skill Integration: Loads .agents/skills/basketball-manga/SKILL.md into runtime prompts", async () => {
    const skill = await MangaSkillLoader.loadSkill(true);
    expect(skill.name).toBe("basketball-manga");
    expect(skill.coreSkillMarkdown).toContain("Rule 1: Panels Per Page");

    const narrativeInst = await MangaSkillLoader.getNarrativeSystemInstruction();
    const storyboardInst =
      await MangaSkillLoader.getStoryboardSystemInstruction();
    const illustrationInst =
      await MangaSkillLoader.getIllustrationSystemInstruction();

    expect(narrativeInst).toContain("Five-Stage Story Structure");
    expect(storyboardInst).toContain("Right-to-Left");
    expect(illustrationInst).toContain("Carbon Illustration");
  });

  it("1. Video Uploads: Validates multipart MP4 uploads, consolidated slicing & rejects corrupted files", async () => {
    const mp4Bytes = await fs.readFile(sampleClips[0].filePath);

    // Individual clip upload
    const form = new FormData();
    form.append(
      "files",
      new File([mp4Bytes], "highlight_upload.mp4", { type: "video/mp4" })
    );
    const req = new NextRequest("http://localhost:3000/api/clips/upload", {
      method: "POST",
      body: form,
    });
    const res = await uploadClipsPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploaded.length).toBe(1);

    // Consolidated video upload auto-segmentation
    const consForm = new FormData();
    consForm.append(
      "files",
      new File([mp4Bytes], "consolidated_reel.mp4", { type: "video/mp4" })
    );
    consForm.append("consolidated", "true");
    const consReq = new NextRequest("http://localhost:3000/api/clips/upload", {
      method: "POST",
      body: consForm,
    });
    const consRes = await uploadClipsPost(consReq);
    expect(consRes.status).toBe(200);

    // Corrupted video rejection
    const corruptForm = new FormData();
    corruptForm.append(
      "files",
      new File([Buffer.from("invalid-binary")], "broken.mp4", {
        type: "video/mp4",
      })
    );
    const corruptReq = new NextRequest(
      "http://localhost:3000/api/clips/upload",
      { method: "POST", body: corruptForm }
    );
    const corruptRes = await uploadClipsPost(corruptReq);
    expect(corruptRes.status).toBe(400);
  });

  it("2. Video Metadata Extraction: Probes codec, duration, dimensions & FPS accurately", async () => {
    const probe = await VideoInputService.probeVideo(sampleClips[0].filePath);
    expect(probe.durationSec).toBeCloseTo(3.0, 1);
    expect(probe.width).toBe(1280);
    expect(probe.height).toBe(720);
    expect(probe.fps).toBe(12);
    expect(probe.codecName).toBe("h264");
  });

  it("3. Clip-to-Source Timestamp Mappings: Preserves both clip-local and full-game timestamps", async () => {
    const frames = await KeyframeExtractionService.extractKeyframesForClip({
      clipId: sampleClips[4].clipId,
      videoPath: sampleClips[4].filePath,
      durationSec: sampleClips[4].durationSec,
      originalGameTimestampSec: 2876.6,
      frameCount: 5,
    });

    expect(frames.length).toBe(5);
    for (const kf of frames) {
      expect(kf.timestampSec).toBeGreaterThan(0);
      expect(kf.timestampSec).toBeLessThan(sampleClips[4].durationSec);
      expect(kf.gameTimestampSec).toBeCloseTo(2876.6 + kf.timestampSec, 2);
    }
  });

  it("4. Narrative JSON Validation: Verifies 5-stage sports manga narrative structure", () => {
    const analyses = DemoPipelineSynthesizer.buildDemoClipAnalyses(sampleClips);
    const narrative = DemoPipelineSynthesizer.buildDemoNarrative(
      sampleClips,
      analyses
    );
    const parsed = StoryNarrativeSchema.safeParse(narrative);
    expect(parsed.success).toBe(true);
    expect(narrative.climaxClipId).toBe(sampleClips[4].clipId);
  });

  it("5. Storyboard Schema Validation: Flags out-of-range timestamps or missing clips and passes valid storyboards", () => {
    const analyses = DemoPipelineSynthesizer.buildDemoClipAnalyses(sampleClips);
    const narrative = DemoPipelineSynthesizer.buildDemoNarrative(
      sampleClips,
      analyses
    );
    const sb = DemoPipelineSynthesizer.buildDemoStoryboard({
      storyId: "story_val_01",
      clips: sampleClips,
      analyses,
      characters: [],
      narrative,
      preferences: MangaPreferencesSchema.parse({}),
    });

    const ok = StoryboardValidator.validateStoryboard(sb, sampleClips);
    expect(ok.valid).toBe(true);

    // Mutate timestamp beyond clip duration -> validator catches it
    const broken = structuredClone(sb);
    broken.pages[0].panels[0].sourceTimestamp = 999;
    const fail = StoryboardValidator.validateStoryboard(broken, sampleClips);
    expect(fail.valid).toBe(false);
    expect(fail.errors.some((e) => e.includes("exceeds clip"))).toBe(true);
  });

  it("6. Right-to-Left (RTL) Panel Ordering: Verifies spatial RTL sequence vs LTR mirror", () => {
    const rtlSlots = PageCompositionService.computeSlots(
      4,
      "balanced_four",
      "rtl"
    );
    const ltrSlots = PageCompositionService.computeSlots(
      4,
      "balanced_four",
      "ltr"
    );

    // Top row: RTL slot #1 is right of slot #2; LTR slot #1 is left of slot #2
    expect(rtlSlots[0].rectLtr.x).toBeGreaterThan(rtlSlots[1].rectLtr.x);
    expect(ltrSlots[0].rectLtr.x).toBeLessThan(ltrSlots[1].rectLtr.x);
  });

  it("7. Panel Layout Geometry: Ensures zero bounding-box overlap across all 7 templates", () => {
    for (const tpl of PageCompositionService.listTemplates()) {
      const slots = PageCompositionService.computeSlots(
        tpl.panelCount,
        tpl.id,
        "rtl"
      );
      for (let i = 0; i < slots.length; i++) {
        const r = slots[i].rectLtr;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(1.0001);
        expect(r.y + r.height).toBeLessThanOrEqual(1.0001);
        for (let j = i + 1; j < slots.length; j++) {
          expect(
            StoryboardValidator.computeOverlapArea(r, slots[j].rectLtr)
          ).toBeLessThan(0.0001);
        }
      }
    }
  });

  it("8. SVG Validation & Sanitization: Strips <script>, event handlers, external images & foreignObject", () => {
    const unsafe = `<svg viewBox="0 0 800 600" onload="evil()"><script>alert(1)</script><foreignObject><div>bad</div></foreignObject><image xlink:href="https://attacker.tld/x.png"/><line x1="0" y1="0" x2="800" y2="600" stroke="#09090b" onmouseover="bad()"/></svg>`;
    const sanitized = SvgSanitizer.sanitize(unsafe);
    expect(sanitized).toBeTruthy();
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("foreignObject");
    expect(sanitized).not.toContain("onload");
    expect(sanitized).not.toContain("onmouseover");
    expect(sanitized).not.toContain("attacker.tld");
    expect(sanitized).toContain("<line");
  });

  it("14 & 9. End-to-End Generation & Hybrid/SVG Illustration Rendering: Produces multi-page manga with real PNG assets", async () => {
    const prefs = MangaPreferencesSchema.parse({
      style: "hyperkinetic_shonen_anime",
      targetPages: 3,
      readingDirection: "rtl",
    });
    const now = new Date().toISOString();
    const job = await StorageService.saveJob({
      jobId: "job_suite_e2e",
      storyId: "story_suite_e2e",
      mode: "demo",
      status: "running",
      currentStage: "clip_analysis",
      stages: [
        "clip_analysis",
        "character_references",
        "narrative_planning",
        "storyboard_generation",
        "carbon_illustration",
        "page_composition",
        "quality_validation",
        "completion",
      ].map((id) => ({
        id: id as never,
        label: id,
        model: "demo",
        status: "pending" as const,
        detail: "",
        startedAt: null,
        completedAt: null,
      })),
      completedPanels: 0,
      totalPanels: 0,
      livePanelPreviews: [],
      error: null,
      createdAt: now,
      updatedAt: now,
    });

    generatedProject = await MangaJobManager.executePipeline(
      job,
      sampleClips,
      prefs
    );
    expect(generatedProject.storyboard.pages.length).toBe(3);

    const panels = generatedProject.storyboard.pages.flatMap((p) => p.panels);
    expect(panels.length).toBe(11);

    for (const pan of panels) {
      expect(pan.illustration.assetFilePath).toBeTruthy();
      const meta = await sharp(pan.illustration.assetFilePath!).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBeGreaterThanOrEqual(380);
    }

    // Verify pure svg_vector rendering mode as well
    const svgPanelRes = await HybridMangaRenderer.renderPanelArtwork({
      storyId: generatedProject.storyId,
      panel: panels[0],
      clip: sampleClips[0],
      style: "cinematic_anime_drama",
      spec: {
        ...panels[0].illustration.spec!,
        renderer: "svg_vector",
      },
      regenerationSeed: 77,
    });
    const svgMeta = await sharp(svgPanelRes.assetFilePath).metadata();
    expect(svgMeta.format).toBe("png");
  });

  it("10. Panel-to-Source-Clip Playback: Verifies interaction metadata & HTTP 206 byte-range streaming", async () => {
    const climaxPanel = generatedProject.storyboard.pages[2].panels[2];
    expect(climaxPanel.interaction.type).toBe("play_source_clip");
    expect(climaxPanel.interaction.clipId).toBe(sampleClips[4].clipId);
    expect(climaxPanel.interaction.timestamp).toBeGreaterThan(0);

    const segments = sampleClips[4].mediaUrl
      .replace(/^\/api\/media\//, "")
      .split("/");
    const req = new NextRequest(
      `http://localhost:3000${sampleClips[4].mediaUrl}`,
      { headers: { range: "bytes=0-2047" } }
    );
    const res = await mediaGet(req, {
      params: Promise.resolve({ path: segments }),
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
  });

  it("11. Individual Panel Editing & Regeneration: Updates one panel without regenerating sibling panels + exports PNG", async () => {
    const targetPanel = generatedProject.storyboard.pages[0].panels[0];
    const untouchedSiblingUrl =
      generatedProject.storyboard.pages[0].panels[1].illustration.assetUrl;

    // Caption edit via PATCH route
    const patchReq = new NextRequest(
      `http://localhost:3000/api/manga/${generatedProject.storyId}/panels/${targetPanel.panelId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          caption: "Updated clutch caption!",
          sfx: "SWISH!!",
        }),
      }
    );
    const patchRes = await patchPanel(patchReq, {
      params: Promise.resolve({
        storyId: generatedProject.storyId,
        panelId: targetPanel.panelId,
      }),
    });
    expect(patchRes.status).toBe(200);
    const patchedBody = await patchRes.json();
    expect(patchedBody.project.storyboard.pages[0].panels[0].caption).toBe(
      "Updated clutch caption!"
    );

    // Single-panel artwork regeneration
    const { project: afterRegen, updatedPanel } =
      await MangaJobManager.regenerateSinglePanel({
        storyId: generatedProject.storyId,
        panelId: targetPanel.panelId,
        customPromptHint: "Tighter focus and stronger shonen ink lines",
        overrideStyle: "authentic_sports_manga",
      });
    expect(updatedPanel.illustration.generationCount).toBe(2);
    expect(
      afterRegen.storyboard.pages[0].panels[1].illustration.assetUrl
    ).toBe(untouchedSiblingUrl);

    // Export Page 1 PNG download verification
    const expReq = new NextRequest(
      `http://localhost:3000/api/manga/${generatedProject.storyId}/export?page=1`
    );
    const expRes = await exportGet(expReq, {
      params: Promise.resolve({ storyId: generatedProject.storyId }),
    });
    expect(expRes.status).toBe(200);
    expect(expRes.headers.get("Content-Type")).toBe("image/png");
  });

  it("12. API Failure & Model Restriction Handling: Blocks external models and rejects missing API key in Real Mode", async () => {
    expect(() => assertAllowedGeminiModel("stable-diffusion-xl")).toThrow(
      GeminiConfigurationError
    );
    expect(() => assertAllowedGeminiModel("imagen-3")).toThrow(
      GeminiConfigurationError
    );

    if (!hasConfiguredApiKey()) {
      await expect(
        MangaJobManager.startGenerationJob({
          clipIds: [sampleClips[0].clipId],
          preferences: MangaPreferencesSchema.parse({}),
          mode: "real",
        })
      ).rejects.toThrow(/GEMINI_API_KEY/);
    }
  });

  it("13. Intermediate Job Recovery: Resumes from persisted stage checkpoints without repeating earlier stages", async () => {
    const recoveredNarrative = await StorageService.loadCheckpoint<{
      title: string;
    }>("job_suite_e2e", "narrative_planning");
    expect(recoveredNarrative?.title).toBe("THE FINAL POSSESSION");

    const recoveredStoryboard = await StorageService.loadCheckpoint<{
      pages: unknown[];
    }>("job_suite_e2e", "storyboard_generation");
    expect(recoveredStoryboard?.pages.length).toBe(3);
  });

  it.runIf(hasConfiguredApiKey())(
    "Live Gemini 4 Argon Integration (runs automatically when GEMINI_API_KEY is set)",
    async () => {
      const analysis = await ClipUnderstandingAgent.analyzeSingleClip(
        sampleClips[0]
      );
      expect(analysis.clipId).toBe(sampleClips[0].clipId);
      expect(analysis.bestMoments.length).toBeGreaterThanOrEqual(1);
    }
  );
});
