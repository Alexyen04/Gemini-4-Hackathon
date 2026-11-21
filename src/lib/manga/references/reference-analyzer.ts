import { Part } from "@google/genai";
import { z } from "zod";
import { PipelineMode } from "@/types/manga";
import {
  GeminiClientService,
  hasConfiguredApiKey,
  mapWithConcurrency,
} from "@/lib/ai/gemini-client";
import { MangaSkillLoader } from "@/lib/manga/skill-loader";
import {
  buildBuiltinFallbackStyleProfile,
  MangaReferenceIndex,
  MangaVisualStyleProfile,
  MangaVisualStyleProfileSchema,
  ReferenceIndexedItem,
  ReferenceTagSchema,
} from "./style-profile";
import { ReferenceLoader } from "./reference-loader";
import {
  ChapterProcessor,
  NormalizedReferencePage,
} from "./chapter-processor";
import { ExtractedReferencePanel, PanelExtractor } from "./panel-extractor";
import { ReferenceIndexStore } from "./reference-index";

const CarbonReferenceResponseSchema = z.object({
  general_style_description: z.string(),
  confidence: z.number().min(0).max(1),
  visual_style: MangaVisualStyleProfileSchema.shape.visual_style,
  storytelling: MangaVisualStyleProfileSchema.shape.storytelling,
  character_art: MangaVisualStyleProfileSchema.shape.character_art,
  linework_and_shading: MangaVisualStyleProfileSchema.shape.linework_and_shading,
  basketball_action: MangaVisualStyleProfileSchema.shape.basketball_action,
  manga_layouts: MangaVisualStyleProfileSchema.shape.manga_layouts,
  narrative_pacing: MangaVisualStyleProfileSchema.shape.narrative_pacing,
  anime_visual_language:
    MangaVisualStyleProfileSchema.shape.anime_visual_language,
  analyzed_items: z.array(
    z.object({
      item_id: z.string(),
      tags: z.array(ReferenceTagSchema),
      action_summary: z.string(),
      composition_takeaway: z.string(),
      camera_and_lighting_note: z.string(),
    })
  ),
});

export interface ReferenceAnalysisOutcome {
  profile: MangaVisualStyleProfile;
  index: MangaReferenceIndex;
  cacheHit: boolean;
  chapterCount: number;
  pageCount: number;
  panelCount: number;
  warning: string | null;
}

export class MangaReferenceAnalyzer {
  /**
   * Selects up to `maxSamples` normalized pages and extracted panels distributed
   * evenly across every discovered reference chapter so Gemini 4 Carbon visually
   * inspects full-page layouts AND close-up/action panels from all chapters.
   */
  private static selectStratifiedVisualSamples(
    pages: NormalizedReferencePage[],
    panels: ExtractedReferencePanel[],
    maxSamples = 12
  ): Array<{
    itemId: string;
    chapterId: string;
    pageId: string;
    panelIndex: number | null;
    itemType: "page" | "panel";
    imagePath: string;
    width: number;
    height: number;
    inkRatio: number;
    edgeDensity: number;
    defaultTags: z.infer<typeof ReferenceTagSchema>[];
  }> {
    const byChapter = new Map<string, NormalizedReferencePage[]>();
    for (const p of pages) {
      if (!byChapter.has(p.chapterId)) byChapter.set(p.chapterId, []);
      byChapter.get(p.chapterId)!.push(p);
    }

    const selected: ReturnType<
      typeof MangaReferenceAnalyzer.selectStratifiedVisualSamples
    > = [];
    const chapterIds = Array.from(byChapter.keys());
    const perChapterBudget = Math.max(
      2,
      Math.floor(maxSamples / Math.max(1, chapterIds.length))
    );

    for (const chId of chapterIds) {
      const chPages = byChapter.get(chId) || [];
      if (chPages.length === 0) continue;

      // Pick highest-energy action page and a balanced mid-chapter storytelling page
      const sortedByEnergy = [...chPages].sort(
        (a, b) => b.edgeDensity + b.inkRatio - (a.edgeDensity + a.inkRatio)
      );
      const chosenPages = [
        sortedByEnergy[0],
        chPages[Math.floor(chPages.length / 2)],
      ].filter(
        (v, idx, arr) => v && arr.findIndex((x) => x.pageId === v.pageId) === idx
      );

      for (const pg of chosenPages.slice(0, perChapterBudget)) {
        selected.push({
          itemId: pg.pageId,
          chapterId: pg.chapterId,
          pageId: pg.pageId,
          panelIndex: null,
          itemType: "page",
          imagePath: pg.normalizedImagePath,
          width: pg.width,
          height: pg.height,
          inkRatio: pg.inkRatio,
          edgeDensity: pg.edgeDensity,
          defaultTags:
            pg.edgeDensity > 0.18
              ? ["speed_lines", "determination"]
              : ["character_reaction"],
        });
      }

      // Also include 1 prominent extracted panel from this chapter if budget permits
      const chPanels = panels.filter((pan) => pan.chapterId === chId);
      if (chPanels.length > 0 && selected.length < maxSamples) {
        const heroPan =
          chPanels.find((p) => p.areaFraction >= 0.3) || chPanels[0];
        selected.push({
          itemId: heroPan.panelItemId,
          chapterId: heroPan.chapterId,
          pageId: heroPan.pageId,
          panelIndex: heroPan.panelIndex,
          itemType: "panel",
          imagePath: heroPan.internalCropPath,
          width: heroPan.width,
          height: heroPan.height,
          inkRatio: heroPan.inkRatio,
          edgeDensity: heroPan.edgeDensity,
          defaultTags: heroPan.heuristicTags,
        });
      }
    }

    return selected.slice(0, maxSamples);
  }

  /**
   * Stage 0: Discovers reference files in `data/manga_refs/`, checks SHA-256
   * cache validity, visually analyzes pages/panels with Gemini 4 Carbon when
   * needed, and persists `data/manga_style_profile.json` + `data/manga_reference_index.json`.
   */
  static async ensureReferenceAnalysis(params: {
    mode: PipelineMode;
    customReferencesDir?: string;
    forceRefresh?: boolean;
  }): Promise<ReferenceAnalysisOutcome> {
    const { mode, customReferencesDir, forceRefresh = false } = params;
    const corpus = await ReferenceLoader.discoverReferences(customReferencesDir);

    // Handle missing or empty `data/manga_refs/` gracefully without fabricating analysis
    if (corpus.isEmpty) {
      const warning = !corpus.exists
        ? "Directory data/manga_refs/ was not found; using built-in basketball-manga skill guidelines."
        : "Directory data/manga_refs/ contains no reference chapters yet; using built-in basketball-manga skill guidelines.";

      if (!forceRefresh) {
        const cachedEmpty = await ReferenceIndexStore.loadValidCachedAnalysis(
          corpus.fingerprintHash
        );
        if (cachedEmpty) {
          return {
            profile: cachedEmpty.profile,
            index: cachedEmpty.index,
            cacheHit: true,
            chapterCount: 0,
            pageCount: 0,
            panelCount: 0,
            warning,
          };
        }
      }

      const fallbackProfile = buildBuiltinFallbackStyleProfile(
        corpus.fingerprintHash,
        warning
      );
      const emptyIndex: MangaReferenceIndex = {
        index_version: 1,
        fingerprint_hash: corpus.fingerprintHash,
        generated_at: new Date().toISOString(),
        chapter_ids: [],
        total_pages_discovered: 0,
        total_panels_extracted: 0,
        items: [],
      };
      await ReferenceIndexStore.saveProfileAndIndex(fallbackProfile, emptyIndex);

      return {
        profile: fallbackProfile,
        index: emptyIndex,
        cacheHit: false,
        chapterCount: 0,
        pageCount: 0,
        panelCount: 0,
        warning,
      };
    }

    // Fast path: Reuse cached style profile & index if SHA-256 fingerprint matches!
    if (!forceRefresh) {
      const cached = await ReferenceIndexStore.loadValidCachedAnalysis(
        corpus.fingerprintHash
      );
      if (cached) {
        return {
          profile: cached.profile,
          index: cached.index,
          cacheHit: true,
          chapterCount: cached.index.chapter_ids.length,
          pageCount: cached.index.total_pages_discovered,
          panelCount: cached.index.total_panels_extracted,
          warning: cached.profile.warning,
        };
      }
    }

    // Normalize up to 30 pages across chapters & extract panels from 6 key pages for fast Stage 0 analysis
    const pagesToNormalize = corpus.pages.slice(0, 30);
    const normalizedResults = await mapWithConcurrency(
      pagesToNormalize,
      6,
      (pg) => ChapterProcessor.processPage(pg, corpus.fingerprintHash)
    );
    const validPages = normalizedResults.filter(
      (p): p is NormalizedReferencePage => p !== null
    );

    if (validPages.length === 0) {
      const warn =
        "No readable image pages could be decoded from data/manga_refs/; falling back to built-in guidelines.";
      const fallback = buildBuiltinFallbackStyleProfile(
        corpus.fingerprintHash,
        warn
      );
      const emptyIdx: MangaReferenceIndex = {
        index_version: 1,
        fingerprint_hash: corpus.fingerprintHash,
        generated_at: new Date().toISOString(),
        chapter_ids: [],
        total_pages_discovered: 0,
        total_panels_extracted: 0,
        items: [],
      };
      await ReferenceIndexStore.saveProfileAndIndex(fallback, emptyIdx);
      return {
        profile: fallback,
        index: emptyIdx,
        cacheHit: false,
        chapterCount: 0,
        pageCount: 0,
        panelCount: 0,
        warning: warn,
      };
    }

    // Extract panels from up to 6 representative pages across chapters
    const panelSamplePages = validPages.filter(
      (_, i) => i % Math.max(1, Math.floor(validPages.length / 6)) === 0
    );
    const panelGroups = await mapWithConcurrency(panelSamplePages, 6, (pg) =>
      PanelExtractor.extractPanelsFromPage(pg, corpus.fingerprintHash)
    );
    const extractedPanels = panelGroups.flat();

    const visualSamples = this.selectStratifiedVisualSamples(
      validPages,
      extractedPanels,
      5
    );

    const citations = validPages.slice(0, 40).map((pg) => ({
      chapter_id: pg.chapterId,
      page_id: pg.pageId,
      relative_path: pg.relativeSourcePath,
    }));

    // Real AI Mode: Visual Multimodal Inspection with Gemini 4 Carbon (`gemini-4-carbon`)
    if (mode === "real" && hasConfiguredApiKey()) {
      const systemInstruction =
        await MangaSkillLoader.getReferenceAnalysisSystemInstruction();
      const parts: Array<Part | string> = [];

      for (const sample of visualSamples) {
        const imgPart = await GeminiClientService.imagePathToInlinePart(
          sample.imagePath,
          "image/png"
        );
        parts.push(
          `REFERENCE IMAGE [${sample.itemType.toUpperCase()}] item_id="${
            sample.itemId
          }" chapter="${sample.chapterId}" page="${sample.pageId}" (${
            sample.width
          }x${sample.height}, measured_ink_ratio=${sample.inkRatio}):`
        );
        parts.push(imgPart);
      }

      const prompt = `Visually inspect these ${
        visualSamples.length
      } actual basketball manga reference pages and panels discovered across chapters [${corpus.chapterIds.join(
        ", "
      )}] (${validPages.length} total pages, ${
        extractedPanels.length
      } extracted panels).

Extract reusable, generalizable anime and manga artistic principles across all 6 required domains:
- Analysis A: Character Art (proportions, anime facial structure, eyes, hair, muscle definition, jersey folds, movement poses, emotions, facial shading) without copying specific copyrighted character identities.
- Analysis B: Linework & Shading (G-pen linework, brush stroke variation, contour thickness, crosshatching, screentones, halftone shading, shadow intensity, B&W contrast, background simplification, texture density + numeric recommendations).
- Analysis C: Basketball Action (shooting, dunking, dribbling, passing, blocking, defending, sprinting, player_confrontations, crowd_reactions).
- Analysis D: Manga Layouts (typical_panel_count, panel_dimensions, panel_arrangement, reading_direction, gutter_spacing, borderless_panels, splash_pages, diagonal_panels, visual_hierarchy).
- Analysis E: Narrative Pacing (beat_sequence_pattern, panel_size_escalation, camera_angle_transitions, suspense_building).
- Analysis F: Anime Visual Language (exaggerated_expressions, dramatic_foreshortening, dynamic_perspective, speed_lines, impact_bursts, strong_silhouettes, dramatic_shadows, emotional_closeups, cinematic_framing, sound_effect_treatment).

Also tag each of the ${
        visualSamples.length
      } provided reference items ("analyzed_items") using ONLY valid tags from:
["dunk","jump_shot","dribbling","passing","defensive_block","perimeter_defense","sprint_fastbreak","confrontation","closeup","extreme_closeup","low_angle","high_angle","dutch_angle","determination","shock","triumph","exhaustion","impact_lines","speed_lines","dramatic_splash","suspense","character_reaction"].

Return valid JSON matching CarbonReferenceResponseSchema.`;

      parts.push(prompt);

      const { data, modelUsed } =
        await GeminiClientService.generateStructuredJson({
          role: "hydrogen",
          systemInstruction,
          contents: parts,
          zodSchema: CarbonReferenceResponseSchema,
          thinkingLevel: "LOW",
          temperature: 0.25,
        });

      const analyzedMap = new Map(
        data.analyzed_items.map((it) => [it.item_id, it])
      );

      const indexedItems: ReferenceIndexedItem[] = visualSamples.map((s) => {
        const aiItem = analyzedMap.get(s.itemId);
        return {
          item_id: s.itemId,
          chapter_id: s.chapterId,
          page_id: s.pageId,
          panel_index: s.panelIndex,
          item_type: s.itemType,
          internal_image_path: s.imagePath,
          width: s.width,
          height: s.height,
          aspect_ratio: Number((s.width / s.height).toFixed(3)),
          ink_ratio: s.inkRatio,
          edge_density: s.edgeDensity,
          tags:
            aiItem && aiItem.tags.length > 0 ? aiItem.tags : s.defaultTags,
          action_summary:
            aiItem?.action_summary ||
            `Analyzed ${s.itemType} from ${s.chapterId}`,
          composition_takeaway:
            aiItem?.composition_takeaway ||
            data.general_style_description.slice(0, 180),
          camera_and_lighting_note:
            aiItem?.camera_and_lighting_note ||
            data.anime_visual_language.cinematic_framing,
        };
      });

      const profile: MangaVisualStyleProfile = {
        profile_id: "basketball_manga_reference",
        profile_version: 1,
        source_directory: "data/manga_refs/",
        fingerprint_hash: corpus.fingerprintHash,
        generated_at: new Date().toISOString(),
        analyzed_by_model: modelUsed,
        is_builtin_fallback: false,
        warning: null,
        confidence: data.confidence,
        general_style_description: data.general_style_description,
        visual_style: data.visual_style,
        storytelling: data.storytelling,
        character_art: data.character_art,
        linework_and_shading: data.linework_and_shading,
        basketball_action: data.basketball_action,
        manga_layouts: data.manga_layouts,
        narrative_pacing: data.narrative_pacing,
        anime_visual_language: data.anime_visual_language,
        reference_sources: citations,
      };

      const index: MangaReferenceIndex = {
        index_version: 1,
        fingerprint_hash: corpus.fingerprintHash,
        generated_at: new Date().toISOString(),
        chapter_ids: corpus.chapterIds,
        total_pages_discovered: validPages.length,
        total_panels_extracted: extractedPanels.length,
        items: indexedItems,
      };

      await ReferenceIndexStore.saveProfileAndIndex(profile, index);
      return {
        profile,
        index,
        cacheHit: false,
        chapterCount: corpus.chapterIds.length,
        pageCount: validPages.length,
        panelCount: extractedPanels.length,
        warning: null,
      };
    }

    // Explicit Demo Mode (no live API call claimed): derive empirical CV statistics from real local reference files!
    const meanInk =
      validPages.reduce((s, p) => s + p.inkRatio, 0) / validPages.length;
    const meanEdge =
      validPages.reduce((s, p) => s + p.edgeDensity, 0) / validPages.length;
    const avgPanelsPerPage =
      panelSamplePages.length > 0
        ? Math.max(
            1,
            Math.min(
              7,
              Math.round(extractedPanels.length / panelSamplePages.length)
            )
          )
        : 4;

    const baseProfile = buildBuiltinFallbackStyleProfile(
      corpus.fingerprintHash,
      null
    );
    const cvProfile: MangaVisualStyleProfile = {
      ...baseProfile,
      profile_id: "basketball_manga_reference",
      analyzed_by_model:
        "local-cv-inspector (Demo Mode — configure GEMINI_API_KEY in Real Mode for Gemini 4 Carbon visual analysis)",
      is_builtin_fallback: false,
      warning: null,
      confidence: 0.85,
      general_style_description: `[Demo CV Reference Profile] Empirically measured across ${
        validPages.length
      } reference page(s) in ${
        corpus.chapterIds.length
      } chapter(s): mean ink coverage ${(meanInk * 100).toFixed(
        1
      )}%, contour density ${(meanEdge * 100).toFixed(
        1
      )}%, ~${avgPanelsPerPage} panels/page.`,
      linework_and_shading: {
        ...baseProfile.linework_and_shading,
        recommended_ink_contrast: Number(
          Math.min(0.96, Math.max(0.7, 0.74 + meanEdge * 0.65)).toFixed(2)
        ),
        recommended_shadow_density: Number(
          Math.min(0.82, Math.max(0.35, 0.38 + meanInk * 0.75)).toFixed(2)
        ),
        recommended_screentone_density: Number(
          Math.min(0.68, Math.max(0.22, 0.28 + meanInk * 0.5)).toFixed(2)
        ),
      },
      manga_layouts: {
        ...baseProfile.manga_layouts,
        typical_panel_count: avgPanelsPerPage,
      },
      reference_sources: citations,
    };

    const cvIndex: MangaReferenceIndex = {
      index_version: 1,
      fingerprint_hash: corpus.fingerprintHash,
      generated_at: new Date().toISOString(),
      chapter_ids: corpus.chapterIds,
      total_pages_discovered: validPages.length,
      total_panels_extracted: extractedPanels.length,
      items: visualSamples.map((s) => ({
        item_id: s.itemId,
        chapter_id: s.chapterId,
        page_id: s.pageId,
        panel_index: s.panelIndex,
        item_type: s.itemType,
        internal_image_path: s.imagePath,
        width: s.width,
        height: s.height,
        aspect_ratio: Number((s.width / s.height).toFixed(3)),
        ink_ratio: s.inkRatio,
        edge_density: s.edgeDensity,
        tags: s.defaultTags,
        action_summary: `Measured ${s.itemType} (${s.width}x${s.height}, ink ${(
          s.inkRatio * 100
        ).toFixed(0)}%)`,
        composition_takeaway:
          s.edgeDensity >= 0.18
            ? "High-density kinetic linework suitable for explosive drives, blocks, and dunks"
            : "Clean negative-space balance ideal for shot-release suspense and emotional closeups",
        camera_and_lighting_note:
          s.width / s.height < 0.72
            ? "Vertical framing emphasizes jump elevation and rim height"
            : "Wide horizontal framing emphasizes court speed and player separation",
      })),
    };

    await ReferenceIndexStore.saveProfileAndIndex(cvProfile, cvIndex);
    return {
      profile: cvProfile,
      index: cvIndex,
      cacheHit: false,
      chapterCount: corpus.chapterIds.length,
      pageCount: validPages.length,
      panelCount: extractedPanels.length,
      warning: null,
    };
  }
}
