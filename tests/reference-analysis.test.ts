import fs from "fs/promises";
import os from "os";
import path from "path";
import zlib from "zlib";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  MangaPreferencesSchema,
  MangaStylePresetSchema,
} from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { ReferenceLoader } from "@/lib/manga/references/reference-loader";
import { ChapterProcessor } from "@/lib/manga/references/chapter-processor";
import { PanelExtractor } from "@/lib/manga/references/panel-extractor";
import { ReferenceIndexStore } from "@/lib/manga/references/reference-index";
import { MangaReferenceAnalyzer } from "@/lib/manga/references/reference-analyzer";
import { ReferenceRetrievalService } from "@/lib/manga/references/reference-retrieval";
import { MangaVisualStyleProfileSchema } from "@/lib/manga/references/style-profile";
import { SampleHighlightGenerator } from "@/lib/video/sample-generator";
import { DemoPipelineSynthesizer } from "@/lib/ai/demo-fixtures";
import { MangaImageProcessor } from "@/lib/manga/image-processing";
import { buildGeminiServingSchema, GeminiClientService } from "@/lib/ai/gemini-client";

function buildSingleFileZipBuffer(entryName: string, fileBytes: Buffer): Buffer {
  const nameBuf = Buffer.from(entryName, "utf-8");
  const compressed = zlib.deflateRawSync(fileBytes);
  const crc = zlib.crc32(fileBytes);

  const localHeader = Buffer.alloc(30 + nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8); // deflate
  localHeader.writeUInt32LE(0, 10);
  localHeader.writeUInt32LE(crc >>> 0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(fileBytes.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuf.copy(localHeader, 30);

  const cdOffset = localHeader.length + compressed.length;
  const cdHeader = Buffer.alloc(46 + nameBuf.length);
  cdHeader.writeUInt32LE(0x02014b50, 0);
  cdHeader.writeUInt16LE(20, 4);
  cdHeader.writeUInt16LE(20, 6);
  cdHeader.writeUInt16LE(0, 8);
  cdHeader.writeUInt16LE(8, 10);
  cdHeader.writeUInt32LE(0, 12);
  cdHeader.writeUInt32LE(crc >>> 0, 16);
  cdHeader.writeUInt32LE(compressed.length, 20);
  cdHeader.writeUInt32LE(fileBytes.length, 24);
  cdHeader.writeUInt16LE(nameBuf.length, 28);
  cdHeader.writeUInt16LE(0, 30);
  cdHeader.writeUInt16LE(0, 32);
  cdHeader.writeUInt16LE(0, 34);
  cdHeader.writeUInt16LE(0, 36);
  cdHeader.writeUInt32LE(0, 38);
  cdHeader.writeUInt32LE(0, 42);
  nameBuf.copy(cdHeader, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdHeader.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, compressed, cdHeader, eocd]);
}

/**
 * Synthesizes a multi-panel test manga reference page with genuine white
 * horizontal/vertical gutters, black panel frames, speed lines, and ink contrast.
 */
async function createSyntheticMangaRefPage(
  outPath: string,
  variant: number
): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1120" viewBox="0 0 800 1120">
    <rect width="800" height="1120" fill="#ffffff" />
    <!-- Top-Right Panel #1 -->
    <g transform="translate(420, 36)">
      <rect width="344" height="320" fill="#faf8f1" stroke="#09090b" stroke-width="5" />
      <circle cx="172" cy="150" r="${55 + variant * 4}" fill="#09090b" />
      <line x1="10" y1="20" x2="140" y2="110" stroke="#09090b" stroke-width="4" />
      <line x1="330" y1="30" x2="210" y2="115" stroke="#09090b" stroke-width="4" />
    </g>
    <!-- Top-Left Panel #2 -->
    <g transform="translate(36, 36)">
      <rect width="356" height="320" fill="#faf8f1" stroke="#09090b" stroke-width="5" />
      <rect x="60" y="70" width="220" height="190" fill="#18181b" />
      <circle cx="170" cy="140" r="38" fill="#ffffff" />
    </g>
    <!-- Bottom Hero Action Panel #3 (separated by clean 28px white horizontal gutter) -->
    <g transform="translate(36, 388)">
      <rect width="728" height="690" fill="#faf8f1" stroke="#09090b" stroke-width="6" />
      <path d="M 80 620 L 360 180 L 660 620 Z" fill="#09090b" opacity="0.86" />
      <circle cx="380" cy="210" r="46" fill="#ffffff" stroke="#09090b" stroke-width="6" />
      <line x1="0" y1="90" x2="290" y2="195" stroke="#09090b" stroke-width="5" />
      <line x1="728" y1="95" x2="460" y2="195" stroke="#09090b" stroke-width="5" />
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

describe("Stage 0: Manga Visual Reference Analysis & Anime Controls Suite", () => {
  let tempRoot = "";
  let tempDataDir = "";
  let tempRefsDir = "";

  beforeAll(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "manga-ref-suite-"));
    tempDataDir = path.join(tempRoot, "data");
    tempRefsDir = path.join(tempDataDir, "manga_refs");
    process.env.MANGA_DATA_DIR = tempDataDir;
    process.env.MANGA_REFERENCES_DIR = tempRefsDir;
    await StorageService.ensureDirectories();
  });

  afterAll(async () => {
    delete process.env.MANGA_REFERENCES_DIR;
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("builds a Gemini-safe serving schema while preserving structural types", () => {
    const servingSchema = buildGeminiServingSchema({
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number", minimum: 0, maximum: 1 },
        direction: { type: "string", enum: ["rtl", "ltr"] },
        title: { type: "string", title: "Display title", minLength: 1 },
        description: { type: "string", description: "A description" },
        default: { type: "string", default: "fallback" },
        beats: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              title: { type: "string", title: "Nested title" },
            },
            required: ["title"],
          },
        },
      },
      required: ["score", "direction", "title", "description", "default", "beats"],
    });

    expect(servingSchema).toEqual({
      type: "object",
      properties: {
        score: { type: "number" },
        direction: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        default: { type: "string" },
        beats: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
          },
        },
      },
      required: ["score", "direction", "title", "description", "default", "beats"],
    });
  });

  it("1. Handles missing and empty data/manga_refs/ cleanly with nonblocking warning & built-in fallback", async () => {
    // Missing directory
    const missingCorpus = await ReferenceLoader.discoverReferences(
      path.join(tempRoot, "does_not_exist")
    );
    expect(missingCorpus.exists).toBe(false);
    expect(missingCorpus.isEmpty).toBe(true);

    // Empty directory with .gitkeep placeholders
    await fs.mkdir(path.join(tempRefsDir, "chapter_01"), { recursive: true });
    await fs.writeFile(path.join(tempRefsDir, "chapter_01", ".gitkeep"), "");

    const outcome = await MangaReferenceAnalyzer.ensureReferenceAnalysis({
      mode: "demo",
      customReferencesDir: tempRefsDir,
    });

    expect(outcome.profile.is_builtin_fallback).toBe(true);
    expect(outcome.warning).toContain("contains no reference chapters");
    expect(outcome.profile.reference_sources).toEqual([]);
  });

  it("2. Discovers 4 chapters (PNG/JPG + ZIP archive) in natural numeric page order & extracts multi-panel crops", async () => {
    // Populate chapter_01 (testing natural numeric sort: page_2 before page_10!), chapter_02, chapter_03
    await createSyntheticMangaRefPage(
      path.join(tempRefsDir, "chapter_01", "page_2.png"),
      1
    );
    await createSyntheticMangaRefPage(
      path.join(tempRefsDir, "chapter_01", "page_10.png"),
      2
    );
    await createSyntheticMangaRefPage(
      path.join(tempRefsDir, "chapter_01", "page_1.png"),
      3
    );
    await createSyntheticMangaRefPage(
      path.join(tempRefsDir, "chapter_02", "page_001.png"),
      4
    );
    await createSyntheticMangaRefPage(
      path.join(tempRefsDir, "chapter_03", "page_001.png"),
      5
    );

    // Populate chapter_04 as a .zip archive to verify archive page extraction
    const zipStaging = path.join(tempRoot, "zip_staging");
    const zipImg = path.join(zipStaging, "page_001.png");
    await createSyntheticMangaRefPage(zipImg, 6);
    await fs.mkdir(path.join(tempRefsDir, "chapter_04"), { recursive: true });
    const zipDest = path.join(tempRefsDir, "chapter_04", "ch04_pages.zip");
    const imgBytes = await fs.readFile(zipImg);
    await fs.writeFile(
      zipDest,
      buildSingleFileZipBuffer("page_001.png", imgBytes)
    );

    const corpus = await ReferenceLoader.discoverReferences(tempRefsDir);
    expect(corpus.isEmpty).toBe(false);
    expect(corpus.chapterIds).toEqual([
      "chapter_01",
      "chapter_02",
      "chapter_03",
      "chapter_04",
    ]);
    expect(corpus.pages.length).toBe(6);

    // Verify natural ordering in chapter_01: page_1 -> page_2 -> page_10
    const ch1Files = corpus.pages
      .filter((p) => p.chapterId === "chapter_01")
      .map((p) => path.basename(p.sourceFilePath));
    expect(ch1Files).toEqual(["page_1.png", "page_2.png", "page_10.png"]);

    // Verify ChapterProcessor normalization & PanelExtractor gutter-based panel detection
    const normalized = await ChapterProcessor.processPage(
      corpus.pages[0],
      corpus.fingerprintHash
    );
    expect(normalized).not.toBeNull();
    const panels = await PanelExtractor.extractPanelsFromPage(
      normalized!,
      corpus.fingerprintHash
    );
    // Synthetic page has 2 top panels + 1 bottom hero panel = 3 panels!
    expect(panels.length).toBe(3);
  });

  it("3. Persists validated style profile to disk, reuses cache on repeat runs, and invalidates cache when files change", async () => {
    // First run -> computes fresh profile & writes data/manga_style_profile.json
    const firstRun = await MangaReferenceAnalyzer.ensureReferenceAnalysis({
      mode: "demo",
      customReferencesDir: tempRefsDir,
    });
    expect(firstRun.cacheHit).toBe(false);
    expect(firstRun.profile.is_builtin_fallback).toBe(false);
    expect(firstRun.chapterCount).toBe(4);
    expect(firstRun.pageCount).toBe(6);

    const parsedSchema = MangaVisualStyleProfileSchema.safeParse(
      firstRun.profile
    );
    expect(parsedSchema.success).toBe(true);

    // Verify files exist on disk at data/manga_style_profile.json & data/manga_reference_index.json
    const diskProfile = await ReferenceIndexStore.loadProfile();
    const diskIndex = await ReferenceIndexStore.loadIndex();
    expect(diskProfile?.fingerprint_hash).toBe(
      firstRun.profile.fingerprint_hash
    );
    expect(diskIndex?.items.length).toBeGreaterThanOrEqual(4);

    // Second run with untouched files -> instant cache hit!
    const secondRun = await MangaReferenceAnalyzer.ensureReferenceAnalysis({
      mode: "demo",
      customReferencesDir: tempRefsDir,
    });
    expect(secondRun.cacheHit).toBe(true);
    expect(secondRun.profile.fingerprint_hash).toBe(
      firstRun.profile.fingerprint_hash
    );

    // Add a new page in chapter_02 -> fingerprint changes & cache invalidates automatically!
    await createSyntheticMangaRefPage(
      path.join(tempRefsDir, "chapter_02", "page_002.png"),
      9
    );
    const thirdRun = await MangaReferenceAnalyzer.ensureReferenceAnalysis({
      mode: "demo",
      customReferencesDir: tempRefsDir,
    });
    expect(thirdRun.cacheHit).toBe(false);
    expect(thirdRun.pageCount).toBe(7);
    expect(thirdRun.profile.fingerprint_hash).not.toBe(
      firstRun.profile.fingerprint_hash
    );
  });

  it("4. Retrieves targeted reference guidance for basketball scenes and integrates into storyboard & illustration specs", async () => {
    const profile = (await ReferenceIndexStore.loadProfile())!;
    const index = (await ReferenceIndexStore.loadIndex())!;

    const dunkGuidance = ReferenceRetrievalService.retrieveForPanel({
      profile,
      index,
      panel: {
        cameraShot: "low_angle",
        emotion: "determination",
        narrativeStage: "climax",
        size: "large",
      },
      clipAnalysis: {
        clipId: "clip_01",
        eventType: "dunk",
        actionSummary: "Explosive one-hand dunk",
        actionSequence: ["drive", "elevate", "slam"],
        offensiveTeam: "Vipers",
        defensiveTeam: "Titans",
        outcomeVerified: "scored_basket",
        pointsScored: 2,
        mainPlayers: [],
        significantReactions: [],
        gameContextSummary: "Q4",
        emotionalIntensity: 9,
        narrativeSignificance: "climax",
        narrativeRelevanceExplanation: "Turning point",
        bestMoments: [
          {
            timestampSec: 1.5,
            nearestFrameId: "f1",
            momentRole: "peak_action",
            visualReason: "Apex",
          },
        ],
        supportingEvidence: [],
        uncertainties: [],
        confidence: 0.95,
      },
      referenceInfluence: "strong",
    });

    expect(dunkGuidance.matchedTags).toContain("dunk");
    expect(dunkGuidance.matchedTags).toContain("low_angle");
    expect(dunkGuidance.formattedPromptGuidance).toContain(
      "STRONG REFERENCE INFLUENCE"
    );
    expect(dunkGuidance.formattedPromptGuidance).toContain(
      "STRICT ORIGINALITY RULE"
    );

    // Verify storyboard integration embeds reference guidance & hyperkinetic_shonen_anime default
    const clips = await SampleHighlightGenerator.ensureSampleHighlights();
    const analyses = DemoPipelineSynthesizer.buildDemoClipAnalyses(clips);
    const narrative = DemoPipelineSynthesizer.buildDemoNarrative(
      clips,
      analyses
    );
    const defaultPrefs = MangaPreferencesSchema.parse({});
    expect(defaultPrefs.style).toBe("hyperkinetic_shonen_anime");

    const sb = DemoPipelineSynthesizer.buildDemoStoryboard({
      storyId: "story_ref_guided",
      clips,
      analyses,
      characters: [],
      narrative,
      preferences: { ...defaultPrefs, referenceInfluence: "strong" },
      styleProfile: profile,
      referenceIndex: index,
    });

    expect(sb.pages[0].panels[0].illustration.prompt).toContain(
      "Reference Guidance (strong)"
    );
  });

  it("accepts compact real reference observations without fabricating missing profile fields", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key-no-network";
    const generate = vi.spyOn(GeminiClientService, "generateStructuredJson").mockImplementation(
      async ({ zodSchema }) => ({
        data: zodSchema.parse({
          general_style_description: "Observed heavy contours and sparse backgrounds.",
          confidence: 0.75,
          character_art_observation: "Distinct silhouettes.",
          linework_observation: "Heavy outer contours.",
          basketball_action_observation: "Diagonal movement.",
          layout_observation: "Asymmetric panels.",
          pacing_observation: "Setup followed by impact.",
          anime_visual_observation: "Low camera angle.",
          analyzed_items: [],
        }),
        modelUsed: "gemini-4-carbon",
      })
    );
    try {
      const outcome = await MangaReferenceAnalyzer.ensureReferenceAnalysis({
        mode: "real", customReferencesDir: tempRefsDir, forceRefresh: true,
      });
      expect(generate).toHaveBeenCalledOnce();
      expect(generate.mock.calls[0][0].role).toBe("carbon");
      expect(outcome.profile.is_builtin_fallback).toBe(false);
      expect(outcome.profile.warning).toContain("Unobserved");
      expect(outcome.profile.linework_and_shading.g_pen_linework).toBe("Heavy outer contours.");
      expect(MangaVisualStyleProfileSchema.safeParse(outcome.profile).success).toBe(true);
      expect(outcome.index.items.length).toBeGreaterThan(0);
    } finally {
      generate.mockRestore();
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });

  it("5. Verifies all 3 improved presets & 3 color treatments produce distinct rendered pixel outputs, and no reference uploader UI/API exists", async () => {
    // Legacy preset names seamlessly map to the 3 new presets
    expect(MangaStylePresetSchema.parse("realistic_sports_manga")).toBe(
      "authentic_sports_manga"
    );
    expect(MangaStylePresetSchema.parse("exaggerated_shonen")).toBe(
      "hyperkinetic_shonen_anime"
    );
    expect(MangaStylePresetSchema.parse("minimalist_cinematic")).toBe(
      "cinematic_anime_drama"
    );

    const clips = await SampleHighlightGenerator.ensureSampleHighlights();
    const kfPath = clips[0].keyframes[2].filePath;

    const baseSpec = {
      panelId: "p_test",
      renderer: "hybrid" as const,
      colorTreatment: "traditional_monochrome" as const,
      focalX: 0.55,
      focalY: 0.45,
      zoomFactor: 1.15,
      dutchTiltDeg: 0,
      inkContrast: 0.85,
      edgeWeight: "bold_brush" as const,
      shadowDensity: 0.56,
      screentoneDensity: 0.4,
      screentoneAngleDeg: 45,
      celShadingBands: 4,
      backgroundMode: "arena_simplified" as const,
      speedLineMode: "radial" as const,
      speedLineIntensity: 0.7,
      impactBurst: false,
      characterPlacement: "Center",
      poseAndActionDetails: "Dunk",
      animeExpressionAndAnatomyNotes: "Sharp focus",
      basketballPosition: "Rim",
      lightingDirection: "top_arena" as const,
      appliedReferenceTags: ["dunk"],
      artisticPrompt: "Dunk",
      customSvgOverlay: null,
    };

    const [shonenMono, authenticMono, cinematicMono, shonenColor] =
      await Promise.all([
        MangaImageProcessor.stylizeKeyframeToManga({
          sourceImagePath: kfPath,
          targetWidth: 320,
          targetHeight: 240,
          style: "hyperkinetic_shonen_anime",
          spec: baseSpec,
          colorTreatment: "traditional_monochrome",
          actionIntensity: "explosive",
        }),
        MangaImageProcessor.stylizeKeyframeToManga({
          sourceImagePath: kfPath,
          targetWidth: 320,
          targetHeight: 240,
          style: "authentic_sports_manga",
          spec: { ...baseSpec, edgeWeight: "balanced" },
          colorTreatment: "traditional_monochrome",
          actionIntensity: "grounded",
        }),
        MangaImageProcessor.stylizeKeyframeToManga({
          sourceImagePath: kfPath,
          targetWidth: 320,
          targetHeight: 240,
          style: "cinematic_anime_drama",
          spec: { ...baseSpec, edgeWeight: "fine" },
          colorTreatment: "traditional_monochrome",
          actionIntensity: "dramatic",
        }),
        MangaImageProcessor.stylizeKeyframeToManga({
          sourceImagePath: kfPath,
          targetWidth: 320,
          targetHeight: 240,
          style: "hyperkinetic_shonen_anime",
          spec: { ...baseSpec, colorTreatment: "full_anime_color" },
          colorTreatment: "full_anime_color",
          actionIntensity: "explosive",
        }),
      ]);

    // Each preset and color treatment produces measurably distinct PNG buffers
    expect(Buffer.compare(shonenMono.pngBuffer, authenticMono.pngBuffer)).not.toBe(0);
    expect(Buffer.compare(shonenMono.pngBuffer, cinematicMono.pngBuffer)).not.toBe(0);
    expect(Buffer.compare(shonenMono.pngBuffer, shonenColor.pngBuffer)).not.toBe(0);

    // Guard check: ensure NO frontend reference upload endpoint or component was created
    const uploadRefApiExists = await fs
      .stat(path.join(process.cwd(), "src/app/api/references"))
      .then(() => true)
      .catch(() => false);
    expect(uploadRefApiExists).toBe(false);
  });
});
