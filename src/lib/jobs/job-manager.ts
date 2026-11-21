import crypto from "crypto";
import {
  ActionIntensity,
  CharacterReference,
  ClipEventAnalysis,
  ColorTreatment,
  GenerationJob,
  MangaPanel,
  MangaPreferences,
  MangaStoryProject,
  MangaStoryboard,
  NormalizedClip,
  PipelineMode,
  PipelineStageId,
  PipelineStageStatus,
  QualityReviewReport,
  StoryNarrative,
} from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import {
  hasConfiguredApiKey,
  resolveRoleModel,
} from "@/lib/ai/gemini-client";
import { ClipUnderstandingAgent } from "@/lib/ai/clip-understanding";
import { MangaDirectorAgent } from "@/lib/ai/manga-director";
import { CarbonIllustrationAgent } from "@/lib/ai/carbon-illustrator";
import { MangaQualityReviewer } from "@/lib/ai/quality-reviewer";
import { DemoPipelineSynthesizer } from "@/lib/ai/demo-fixtures";
import { CharacterReferenceService } from "@/lib/manga/character-references";
import { HybridMangaRenderer } from "@/lib/manga/hybrid-renderer";
import { PageCompositionService } from "@/lib/manga/layout-engine";
import { MangaReferenceAnalyzer } from "@/lib/manga/references/reference-analyzer";
import { ReferenceIndexStore } from "@/lib/manga/references/reference-index";
import { PythonIngestBridge } from "@/lib/ingest/python-ingest-bridge";

export interface RawVideoIngestRequest {
  rawVideoPath: string;
  userPrompt: string;
  reuseIngestCache?: boolean;
  cachedHandoffPath?: string;
}

export class MangaJobManager {
  static createInitialStages(
    mode: PipelineMode,
    includeVideoIngest = false
  ): PipelineStageStatus[] {
    const tag = (role: "argon" | "carbon" | "hydrogen" | "neon") =>
      mode === "real" ? resolveRoleModel(role) : "demo-deterministic";

    const ingestStages: PipelineStageStatus[] = includeVideoIngest
      ? [
          {
            id: "video_ingest",
            label: "Stage 0A. Full-Game Video Scouting, Decisions Ranking & Replay Pairing",
            model:
              mode === "real"
                ? "gemini-4-hydrogen + gemini-decision-1"
                : "python-handoff",
            status: "pending",
            detail: "Waiting to scout raw basketball video & pair zoomed replay angles",
            startedAt: null,
            completedAt: null,
          },
        ]
      : [];

    return [
      ...ingestStages,
      {
        id: "reference_analysis",
        label: "Stage 0. Manga Visual Reference Analysis",
        model: tag("carbon"),
        status: "pending",
        detail: "Scanning data/manga_refs/ & checking style profile cache",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "clip_analysis",
        label: "Stage 1. Basketball Clip Understanding",
        model: tag("argon"),
        status: "pending",
        detail: "Waiting to analyze basketball keyframes",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "character_references",
        label: "Stage 1B. Character & Uniform Locking",
        model: "CharacterReferenceService",
        status: "pending",
        detail: "Waiting to lock jersey numbers & uniform contrast",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "narrative_planning",
        label: "Stage 2. Narrative Planning",
        model: tag("carbon"),
        status: "pending",
        detail: "Waiting to construct 5-act sports manga storyline",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "storyboard_generation",
        label: "Stage 3. Reference-Guided Storyboarding",
        model: tag("carbon"),
        status: "pending",
        detail: "Waiting to compose pages, beats & camera perspectives",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "carbon_illustration",
        label: "Stage 4. Carbon + Nano Banana Panel Illustration",
        model:
          mode === "real" && process.env.MANGA_DISABLE_NANO_BANANA !== "true"
            ? `${tag("carbon")} + gemini-nano-banana-2.1`
            : tag("carbon"),
        status: "pending",
        detail:
          mode === "real" && process.env.MANGA_DISABLE_NANO_BANANA !== "true"
            ? "Waiting to direct specs via Carbon & illustrate panels via Nano Banana 2.1"
            : "Waiting to generate all pages concurrently via Gemini 4 Carbon",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "page_composition",
        label: "Stage 5. Manga Page Composition",
        model: "PageCompositionService",
        status: "pending",
        detail: "Waiting to assemble print-ready RTL/LTR pages",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "quality_validation",
        label: "Stage 6. Quality & Structural Validation",
        model:
          process.env.MANGA_ENABLE_AI_QA === "true"
            ? tag("hydrogen")
            : "StoryboardValidator",
        status: "pending",
        detail: "Waiting to verify layout geometry, reading order & facts",
        startedAt: null,
        completedAt: null,
      },
      {
        id: "completion",
        label: "Stage 7. Interactive Manga Reader Ready",
        model: null,
        status: "pending",
        detail: "Finalizing story package",
        startedAt: null,
        completedAt: null,
      },
    ];
  }

  private static async updateStage(
    job: GenerationJob,
    stageId: PipelineStageId,
    patch: Partial<PipelineStageStatus>
  ): Promise<GenerationJob> {
    const now = new Date().toISOString();
    job.currentStage = stageId;
    job.stages = job.stages.map((s) => {
      if (s.id !== stageId) return s;
      return {
        ...s,
        ...patch,
        startedAt:
          patch.status === "running" && !s.startedAt ? now : s.startedAt,
        completedAt:
          patch.status === "completed" || patch.status === "failed"
            ? now
            : s.completedAt,
      };
    });
    return StorageService.saveJob(job);
  }

  static async startGenerationJob(params: {
    rawVideoPath?: string;
    userPrompt?: string;
    reuseIngestCache?: boolean;
    cachedHandoffPath?: string;
    clipIds?: string[];
    preferences: MangaPreferences;
    mode: PipelineMode;
    resumeJobId?: string;
  }): Promise<GenerationJob> {
    const {
      rawVideoPath,
      userPrompt = "",
      reuseIngestCache = true,
      cachedHandoffPath,
      clipIds = [],
      preferences,
      mode,
      resumeJobId,
    } = params;

    if (mode === "real" && !hasConfiguredApiKey()) {
      throw new Error(
        "Real AI Mode requires GEMINI_API_KEY in .env.local. Configure your API key or explicitly select Development Demo Mode."
      );
    }

    let rawIngestReq: RawVideoIngestRequest | undefined;
    const clips: NormalizedClip[] = [];

    if (rawVideoPath) {
      const validatedPath = await PythonIngestBridge.validateRawVideoPath(
        rawVideoPath
      );
      rawIngestReq = {
        rawVideoPath: validatedPath,
        userPrompt,
        reuseIngestCache,
        cachedHandoffPath,
      };
    } else {
      for (const id of clipIds) {
        const c = await StorageService.getClip(id);
        if (c) clips.push(c);
      }
      if (clips.length === 0) {
        throw new Error(
          "Provide a raw basketball video or at least one valid highlight clip."
        );
      }
    }

    let job: GenerationJob;
    if (resumeJobId) {
      const existing = await StorageService.getJob(resumeJobId);
      if (!existing) throw new Error(`Job "${resumeJobId}" not found.`);
      job = {
        ...existing,
        status: "running",
        error: null,
      };
      job = await StorageService.saveJob(job);
    } else {
      const jobId = `job_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const storyId = `story_${Date.now()}_${crypto
        .randomBytes(3)
        .toString("hex")}`;
      const now = new Date().toISOString();
      const useVideoIngest = Boolean(rawIngestReq);

      job = await StorageService.saveJob({
        jobId,
        storyId,
        mode,
        status: "running",
        currentStage: useVideoIngest ? "video_ingest" : "reference_analysis",
        stages: this.createInitialStages(mode, useVideoIngest),
        completedPanels: 0,
        totalPanels: 0,
        livePanelPreviews: [],
        error: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    void this.executePipeline(job, clips, preferences, rawIngestReq).catch(
      async (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        job.status = "failed";
        job.error = errMsg;
        await this.updateStage(job, job.currentStage, {
          status: "failed",
          detail: errMsg,
        });
      }
    );

    return job;
  }

  static async executePipeline(
    job: GenerationJob,
    initialClips: NormalizedClip[],
    preferences: MangaPreferences,
    rawIngestReq?: RawVideoIngestRequest
  ): Promise<MangaStoryProject> {
    const isReal = job.mode === "real";
    let clips = initialClips;
    let upstreamHandoffContext: string | undefined;

    // ---- Stage 0A (Optional): Python Raw Video Ingest -> Handoff Bridge ----
    if (rawIngestReq) {
      job = await this.updateStage(job, "video_ingest", {
        status: "running",
        detail: "Starting Python Gemini 4 + Decisions API video ingest & ranking...",
      });

      const { handoff, cacheHit } = await PythonIngestBridge.runOrLoadPythonHandoff({
        rawVideoPath: rawIngestReq.rawVideoPath,
        userPrompt: rawIngestReq.userPrompt,
        targetPages: preferences.targetPages,
        mode: job.mode,
        reuseCache: rawIngestReq.reuseIngestCache,
        cachedHandoffPath: rawIngestReq.cachedHandoffPath,
        onProgress: async (detailLine) => {
          job = await this.updateStage(job, "video_ingest", {
            status: "running",
            detail: detailLine,
          });
        },
      });

      const converted = await PythonIngestBridge.convertHandoffToMangaInputs({
        handoff,
        targetPages: preferences.targetPages,
      });

      clips = converted.clips;
      upstreamHandoffContext = converted.upstreamHandoffContext;

      if (clips.length === 0) {
        throw new Error(
          "Upstream Python ingest completed, but no playable candidate clips were staged."
        );
      }

      // Pre-populate Stage 1 checkpoint with verified Decisions-API beat analyses
      await StorageService.saveCheckpoint(
        job.jobId,
        "clip_analysis",
        converted.analyses
      );

      job = await this.updateStage(job, "video_ingest", {
        status: "completed",
        detail: `${cacheHit ? "Loaded cached handoff" : "Scouted & ranked video"} → staged ${
          clips.length
        } live & zoomed-replay clips`,
      });
    }

    // Ensure job stages include `reference_analysis` if caller constructed minimal stages
    if (!job.stages.some((s) => s.id === "reference_analysis")) {
      job.stages = [
        {
          id: "reference_analysis",
          label: "Stage 0. Manga Visual Reference Analysis",
          model: isReal ? resolveRoleModel("carbon") : "demo",
          status: "pending",
          detail: "",
          startedAt: null,
          completedAt: null,
        },
        ...job.stages,
      ];
    }

    // ---- Stage 0: Manga Visual Reference Analysis (Gemini 4 Carbon + SHA-256 Cache) ----
    job = await this.updateStage(job, "reference_analysis", {
      status: "running",
      detail: "Scanning data/manga_refs/ for reference chapters & cached style profile...",
    });

    const refOutcome = await MangaReferenceAnalyzer.ensureReferenceAnalysis({
      mode: job.mode,
    });

    if (refOutcome.warning) {
      console.warn(`[Stage 0 Reference Analysis] ${refOutcome.warning}`);
    }

    const stage0Detail = refOutcome.profile.is_builtin_fallback
      ? refOutcome.warning ||
        "data/manga_refs/ empty — using built-in manga guidelines"
      : refOutcome.cacheHit
      ? `Reused cached style profile (${refOutcome.chapterCount} ch, ${refOutcome.pageCount} pages, hash ${refOutcome.profile.fingerprint_hash.slice(
          0,
          8
        )})`
      : `Analyzed ${refOutcome.pageCount} pages & ${refOutcome.panelCount} panels across ${refOutcome.chapterCount} chapter(s)`;

    job = await this.updateStage(job, "reference_analysis", {
      status: "completed",
      detail: stage0Detail,
    });

    const { profile: styleProfile, index: referenceIndex } = refOutcome;

    // ---- Stage 1: Basketball Clip Understanding (Gemini 4 Argon) ----
    job = await this.updateStage(job, "clip_analysis", {
      status: "running",
      detail: `Analyzing ${clips.length} basketball clip(s) and keyframes...`,
    });

    let analyses = await StorageService.loadCheckpoint<ClipEventAnalysis[]>(
      job.jobId,
      "clip_analysis"
    );
    if (!analyses) {
      analyses = isReal
        ? await ClipUnderstandingAgent.analyzeClips(clips)
        : DemoPipelineSynthesizer.buildDemoClipAnalyses(clips);
      await StorageService.saveCheckpoint(job.jobId, "clip_analysis", analyses);
    }

    job = await this.updateStage(job, "clip_analysis", {
      status: "completed",
      detail: `Extracted ${analyses.length} verified basketball event records`,
    });

    // ---- Stage 1B: Character & Uniform Consistency Locking ----
    job = await this.updateStage(job, "character_references", {
      status: "running",
      detail: "Building recurring player & jersey contrast references...",
    });

    let characters = await StorageService.loadCheckpoint<CharacterReference[]>(
      job.jobId,
      "character_references"
    );
    if (!characters) {
      characters = CharacterReferenceService.buildCharacterReferences(
        clips,
        analyses
      );
      await StorageService.saveCheckpoint(
        job.jobId,
        "character_references",
        characters
      );
    }

    job = await this.updateStage(job, "character_references", {
      status: "completed",
      detail: `Locked ${characters.length} character reference(s) across teams`,
    });

    // ---- Stage 2: Global Narrative Planning (Gemini 4 Carbon) ----
    job = await this.updateStage(job, "narrative_planning", {
      status: "running",
      detail: "Constructing reference-paced 5-stage sports manga storyline...",
    });

    let narrative = await StorageService.loadCheckpoint<StoryNarrative>(
      job.jobId,
      "narrative_planning"
    );
    if (!narrative) {
      narrative = isReal
        ? await MangaDirectorAgent.planGlobalNarrative({
            clips,
            analyses,
            characters,
            preferences,
            styleProfile,
            upstreamHandoffContext,
          })
        : DemoPipelineSynthesizer.buildDemoNarrative(
            clips,
            analyses,
            preferences
          );
      await StorageService.saveCheckpoint(
        job.jobId,
        "narrative_planning",
        narrative
      );
    }

    job = await this.updateStage(job, "narrative_planning", {
      status: "completed",
      detail: `Storyline ready: "${narrative.title}"`,
    });

    // ---- Stage 3: Reference-Guided Storyboarding (Gemini 4 Carbon) ----
    job = await this.updateStage(job, "storyboard_generation", {
      status: "running",
      detail: `Generating reference-guided ${preferences.style.replace(
        /_/g,
        " "
      )} storyboard...`,
    });

    let storyboard = await StorageService.loadCheckpoint<MangaStoryboard>(
      job.jobId,
      "storyboard_generation"
    );
    if (!storyboard) {
      storyboard = isReal
        ? await MangaDirectorAgent.generateStoryboard({
            storyId: job.storyId,
            clips,
            analyses,
            characters,
            narrative,
            preferences,
            styleProfile,
            referenceIndex,
            upstreamHandoffContext,
          })
        : DemoPipelineSynthesizer.buildDemoStoryboard({
            storyId: job.storyId,
            clips,
            analyses,
            characters,
            narrative,
            preferences,
            styleProfile,
            referenceIndex,
          });
      await StorageService.saveCheckpoint(
        job.jobId,
        "storyboard_generation",
        storyboard
      );
    }

    const flatPanels = storyboard.pages.flatMap((p) =>
      p.panels.map((pan) => ({ pageNumber: p.pageNumber, panel: pan }))
    );
    job.totalPanels = flatPanels.length;
    job = await this.updateStage(job, "storyboard_generation", {
      status: "completed",
      detail: `Composed ${storyboard.pages.length} pages (${flatPanels.length} panels)`,
    });

    // ---- Stage 4: Single-Wave Concurrent Per-Page Carbon + Nano Banana 2.1 Illustration Engine ----
    const useNanoBanana =
      isReal && process.env.MANGA_DISABLE_NANO_BANANA !== "true";
    job = await this.updateStage(job, "carbon_illustration", {
      status: "running",
      detail: useNanoBanana
        ? `Illustrating ${storyboard.pages.length} pages (${flatPanels.length} panels) via Carbon + Nano Banana 2.1...`
        : `Generating all ${storyboard.pages.length} pages (${flatPanels.length} panels) concurrently in 1 wave...`,
    });

    const clipMap = new Map(clips.map((c) => [c.clipId, c]));
    const analysisMap = new Map(analyses.map((a) => [a.clipId, a]));
    const renderedPanelsMap = new Map<string, MangaPanel>();

    // Fire ALL pages concurrently via Promise.all:
    // Each page runs 1 batched Carbon API call for all its panels, then renders all its PNGs in parallel!
    await Promise.all(
      storyboard.pages.map(async (page, pageIdx) => {
        const pageSpecMap = isReal
          ? await CarbonIllustrationAgent.generatePageIllustrationSpecsBatch({
              page,
              clipMap,
              fallbackClip: clips[0],
              analysisMap,
              characters: characters!,
              preferences,
              styleProfile,
              referenceIndex,
            })
          : new Map(
              page.panels.map((panel, pIdx) => [
                panel.panelId,
                DemoPipelineSynthesizer.buildDemoIllustrationSpec({
                  panel,
                  preferences,
                  styleProfile,
                  referenceIndex,
                  clipAnalysis: analysisMap.get(panel.sourceClipId),
                  seedOffset: pageIdx * 5 + pIdx,
                }),
              ])
            );

        // Render every panel on this page concurrently on local CPU
        await Promise.all(
          page.panels.map(async (panel) => {
            const clip = clipMap.get(panel.sourceClipId) || clips[0];
            const spec = pageSpecMap.get(panel.panelId)!;

            const rendered = await HybridMangaRenderer.renderPanelArtwork({
              storyId: job.storyId,
              panel,
              clip,
              style: storyboard!.style,
              spec,
              colorTreatment: preferences.colorTreatment,
              actionIntensity: preferences.actionIntensity,
              useNanoBanana,
            });

            const updatedPanel: MangaPanel = {
              ...panel,
              illustration: {
                ...panel.illustration,
                renderer: spec.renderer,
                style: storyboard!.style,
                colorTreatment: preferences.colorTreatment,
                referenceFrameIds: [rendered.referenceFrameId],
                prompt: spec.artisticPrompt,
                spec,
                assetUrl: rendered.assetUrl,
                assetFilePath: rendered.assetFilePath,
                svgOverlayUrl: rendered.svgOverlayUrl,
                generationCount: 1,
              },
            };

            renderedPanelsMap.set(panel.panelId, updatedPanel);
            job.completedPanels = renderedPanelsMap.size;
            job.livePanelPreviews = [
              ...job.livePanelPreviews,
              {
                panelId: panel.panelId,
                pageNumber: page.pageNumber,
                assetUrl: rendered.assetUrl,
                caption: panel.caption,
              },
            ];
          })
        );

        job = await this.updateStage(job, "carbon_illustration", {
          status: "running",
          detail: `Rendered ${renderedPanelsMap.size}/${flatPanels.length} panels (Page ${page.pageNumber} done)`,
        });
      })
    );

    storyboard = {
      ...storyboard,
      pages: storyboard.pages.map((page) => ({
        ...page,
        panels: page.panels.map(
          (pan) => renderedPanelsMap.get(pan.panelId) || pan
        ),
      })),
    };

    job = await this.updateStage(job, "carbon_illustration", {
      status: "completed",
      detail: `All ${flatPanels.length} panels illustrated concurrently`,
    });

    // ---- Stage 5: Deterministic Page Composition & Print Export (Parallel) ----
    job = await this.updateStage(job, "page_composition", {
      status: "running",
      detail: "Assembling all manga pages & print exports concurrently...",
    });

    const composedPages = await Promise.all(
      storyboard.pages.map(async (page) => {
        const composed = PageCompositionService.composePage(
          page,
          storyboard!.readingDirection
        );
        const exported = await HybridMangaRenderer.renderCompositePageExport({
          storyId: job.storyId,
          storyTitle: storyboard!.title,
          page: composed,
          readingDirection: storyboard!.readingDirection,
        });
        return {
          ...composed,
          compositeAssetUrl: exported.mediaUrl,
        };
      })
    );
    storyboard = { ...storyboard, pages: composedPages };

    job = await this.updateStage(job, "page_composition", {
      status: "completed",
      detail: `Assembled ${composedPages.length} complete manga pages`,
    });

    // ---- Stage 6: Fast Structural Validation (Optional Multimodal AI QA via MANGA_ENABLE_AI_QA=true) ----
    const enableAiQa = isReal && process.env.MANGA_ENABLE_AI_QA === "true";
    job = await this.updateStage(job, "quality_validation", {
      status: "running",
      detail: enableAiQa
        ? "Running Gemini 4 Hydrogen multimodal audit..."
        : "Running fast structural, RTL geometry & factual grounding checks...",
    });

    const qualityReport: QualityReviewReport = enableAiQa
      ? await MangaQualityReviewer.evaluateManga({
          storyboard,
          clips,
          analyses,
          characters,
          preferences,
          styleProfile,
        })
      : DemoPipelineSynthesizer.buildDemoQualityReport(
          storyboard,
          clips,
          styleProfile
        );

    const maxRetries = Number(process.env.MANGA_MAX_QUALITY_RETRIES ?? 1);
    if (enableAiQa && maxRetries > 0) {
      const toRegenerate = qualityReport.panelFeedback
        .filter((f) => f.requiresRegeneration)
        .slice(0, 2);

      const regeneratedIds: string[] = [];
      for (const item of toRegenerate) {
        for (const p of storyboard.pages) {
          const targetIdx = p.panels.findIndex(
            (pan) => pan.panelId === item.panelId
          );
          if (targetIdx === -1) continue;

          const targetPanel = p.panels[targetIdx];
          const clip = clipMap.get(targetPanel.sourceClipId) || clips[0];
          const repairedSpec =
            await CarbonIllustrationAgent.generatePanelIllustrationSpec({
              panel: targetPanel,
              clip,
              clipAnalysis: analysisMap.get(clip.clipId),
              characters,
              preferences,
              styleProfile,
              referenceIndex,
              regenerationHint:
                item.suggestedAdjustment ||
                "Improve anime silhouette separation, style profile alignment, and focal clarity.",
            });
          const reRendered = await HybridMangaRenderer.renderPanelArtwork({
            storyId: job.storyId,
            panel: targetPanel,
            clip,
            style: storyboard.style,
            spec: repairedSpec,
            colorTreatment: preferences.colorTreatment,
            actionIntensity: preferences.actionIntensity,
            regenerationSeed: 2,
            useNanoBanana,
          });
          p.panels[targetIdx] = {
            ...targetPanel,
            illustration: {
              ...targetPanel.illustration,
              spec: repairedSpec,
              assetUrl: reRendered.assetUrl,
              assetFilePath: reRendered.assetFilePath,
              svgOverlayUrl: reRendered.svgOverlayUrl,
              generationCount: 2,
            },
          };
          regeneratedIds.push(item.panelId);
        }
      }
      qualityReport.regeneratedPanelIds = regeneratedIds;
    }

    job = await this.updateStage(job, "quality_validation", {
      status: "completed",
      detail: `Quality score: ${qualityReport.overallScore}/100`,
    });

    // ---- Stage 7: Persist Story Project & Complete ----
    const now = new Date().toISOString();
    const project: MangaStoryProject = await StorageService.saveStory({
      storyId: job.storyId,
      mode: job.mode,
      preferences,
      referenceProfileSummary: {
        profileId: styleProfile.profile_id,
        isBuiltinFallback: styleProfile.is_builtin_fallback,
        referenceChapterCount: refOutcome.chapterCount,
        referencePageCount: refOutcome.pageCount,
        fingerprintHash: styleProfile.fingerprint_hash,
        warning: refOutcome.warning,
      },
      clips,
      clipAnalyses: analyses,
      characters,
      narrative,
      storyboard,
      qualityReport,
      createdAt: job.createdAt,
      updatedAt: now,
    });

    job.status = "completed";
    await this.updateStage(job, "completion", {
      status: "completed",
      detail: "Manga chapter ready in Interactive Reader!",
    });

    return project;
  }

  /**
   * Regenerates an individual panel using cached Stage 0 reference guidance
   * without restarting the entire manga pipeline.
   */
  static async regenerateSinglePanel(params: {
    storyId: string;
    panelId: string;
    customPromptHint?: string;
    overrideRenderer?: "hybrid" | "svg_vector" | "frame_guided";
    overrideStyle?: MangaPreferences["style"];
    overrideColorTreatment?: ColorTreatment;
    overrideActionIntensity?: ActionIntensity;
    overrideCameraShot?: MangaPanel["cameraShot"];
    overrideVisualEffects?: string[];
  }): Promise<{ project: MangaStoryProject; updatedPanel: MangaPanel }> {
    const {
      storyId,
      panelId,
      customPromptHint,
      overrideRenderer,
      overrideStyle,
      overrideColorTreatment,
      overrideActionIntensity,
      overrideCameraShot,
      overrideVisualEffects,
    } = params;

    const project = await StorageService.getStory(storyId);
    if (!project) {
      throw new Error(`Story "${storyId}" not found.`);
    }

    let foundPageIdx = -1;
    let foundPanelIdx = -1;

    project.storyboard.pages.forEach((p, pIdx) => {
      p.panels.forEach((pan, panIdx) => {
        if (pan.panelId === panelId) {
          foundPageIdx = pIdx;
          foundPanelIdx = panIdx;
        }
      });
    });

    if (foundPageIdx === -1 || foundPanelIdx === -1) {
      throw new Error(`Panel "${panelId}" not found in story "${storyId}".`);
    }

    const page = project.storyboard.pages[foundPageIdx];
    const currentPanel = page.panels[foundPanelIdx];
    const activeStyle = overrideStyle || project.storyboard.style;
    const activeColor =
      overrideColorTreatment ||
      currentPanel.illustration.colorTreatment ||
      project.preferences.colorTreatment;
    const activeIntensity =
      overrideActionIntensity || project.preferences.actionIntensity;

    const [styleProfile, referenceIndex] = await Promise.all([
      ReferenceIndexStore.loadProfile(),
      ReferenceIndexStore.loadIndex(),
    ]);

    const modifiedPanel: MangaPanel = {
      ...currentPanel,
      cameraShot: overrideCameraShot || currentPanel.cameraShot,
      visualEffects: overrideVisualEffects || currentPanel.visualEffects,
      illustration: {
        ...currentPanel.illustration,
        renderer: overrideRenderer || currentPanel.illustration.renderer,
        style: activeStyle,
        colorTreatment: activeColor,
        prompt: customPromptHint
          ? `${currentPanel.illustration.prompt} | Edit: ${customPromptHint}`
          : currentPanel.illustration.prompt,
      },
    };

    const clip =
      project.clips.find((c) => c.clipId === modifiedPanel.sourceClipId) ||
      project.clips[0];
    const clipAnalysis = project.clipAnalyses.find(
      (a) => a.clipId === clip.clipId
    );

    const nextGenCount = (currentPanel.illustration.generationCount || 1) + 1;
    const useReal = project.mode === "real" && hasConfiguredApiKey();
    const effectivePrefs: MangaPreferences = {
      ...project.preferences,
      style: activeStyle,
      colorTreatment: activeColor,
      actionIntensity: activeIntensity,
    };

    const newSpec = useReal
      ? await CarbonIllustrationAgent.generatePanelIllustrationSpec({
          panel: modifiedPanel,
          clip,
          clipAnalysis,
          characters: project.characters,
          preferences: effectivePrefs,
          styleProfile: styleProfile || undefined,
          referenceIndex: referenceIndex || undefined,
          regenerationHint:
            customPromptHint ||
            `Create fresh reference-guided composition variation #${nextGenCount}`,
        })
      : DemoPipelineSynthesizer.buildDemoIllustrationSpec({
          panel: modifiedPanel,
          preferences: effectivePrefs,
          styleProfile: styleProfile || undefined,
          referenceIndex: referenceIndex || undefined,
          clipAnalysis,
          seedOffset: nextGenCount,
        });

    if (overrideRenderer) {
      newSpec.renderer = overrideRenderer;
    }

    const rendered = await HybridMangaRenderer.renderPanelArtwork({
      storyId: project.storyId,
      panel: modifiedPanel,
      clip,
      style: activeStyle,
      spec: newSpec,
      colorTreatment: activeColor,
      actionIntensity: activeIntensity,
      regenerationSeed: nextGenCount,
      useNanoBanana:
        useReal && process.env.MANGA_DISABLE_NANO_BANANA !== "true",
    });

    const cacheBustedUrl = `${rendered.assetUrl}?v=${Date.now()}`;

    const updatedPanel: MangaPanel = {
      ...modifiedPanel,
      illustration: {
        ...modifiedPanel.illustration,
        renderer: newSpec.renderer,
        style: activeStyle,
        colorTreatment: activeColor,
        prompt: newSpec.artisticPrompt,
        referenceFrameIds: [rendered.referenceFrameId],
        spec: newSpec,
        assetUrl: cacheBustedUrl,
        assetFilePath: rendered.assetFilePath,
        svgOverlayUrl: rendered.svgOverlayUrl,
        generationCount: nextGenCount,
      },
    };

    page.panels[foundPanelIdx] = updatedPanel;

    const exported = await HybridMangaRenderer.renderCompositePageExport({
      storyId: project.storyId,
      storyTitle: project.storyboard.title,
      page,
      readingDirection: project.storyboard.readingDirection,
    });
    page.compositeAssetUrl = `${exported.mediaUrl}?v=${Date.now()}`;

    const savedProject = await StorageService.saveStory(project);
    return { project: savedProject, updatedPanel };
  }
}
