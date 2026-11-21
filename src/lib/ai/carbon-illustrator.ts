import { Part } from "@google/genai";
import { z } from "zod";
import {
  CarbonIllustrationSpec,
  CarbonIllustrationSpecSchema,
  CharacterReference,
  ClipEventAnalysis,
  MangaPage,
  MangaPanel,
  MangaPreferences,
  NormalizedClip,
} from "@/types/manga";
import { MangaSkillLoader } from "@/lib/manga/skill-loader";
import { KeyframeExtractionService } from "@/lib/video/keyframes";
import { SvgSanitizer } from "@/lib/manga/validators";
import {
  MangaReferenceIndex,
  MangaVisualStyleProfile,
} from "@/lib/manga/references/style-profile";
import { ReferenceRetrievalService } from "@/lib/manga/references/reference-retrieval";
import { DemoPipelineSynthesizer } from "./demo-fixtures";
import { GeminiClientService } from "./gemini-client";

const PageSpecsBatchResponseSchema = z.object({
  specs: z.array(CarbonIllustrationSpecSchema).min(1),
});

export class CarbonIllustrationAgent {
  /**
   * Batched Per-Page Panel Spec Generation powered by Gemini 4 Carbon
   * (`gemini-4-carbon`, `thinkingLevel: "LOW"`).
   *
   * Generates all panel illustration specs + SVG overlays for an entire page
   * in ONE Carbon API call so all pages run simultaneously in a single wave!
   */
  static async generatePageIllustrationSpecsBatch(params: {
    page: MangaPage;
    clipMap: Map<string, NormalizedClip>;
    fallbackClip: NormalizedClip;
    analysisMap: Map<string, ClipEventAnalysis>;
    characters: CharacterReference[];
    preferences: MangaPreferences;
    styleProfile?: MangaVisualStyleProfile;
    referenceIndex?: MangaReferenceIndex;
  }): Promise<Map<string, CarbonIllustrationSpec>> {
    const {
      page,
      clipMap,
      fallbackClip,
      analysisMap,
      characters,
      preferences,
      styleProfile,
      referenceIndex,
    } = params;

    const systemInstruction =
      await MangaSkillLoader.getIllustrationSystemInstruction();

    // Extract/load all panel keyframes for this page in parallel
    const panelContexts = await Promise.all(
      page.panels.map(async (panel) => {
        const clip = clipMap.get(panel.sourceClipId) || fallbackClip;
        const clipAnalysis = analysisMap.get(clip.clipId);
        const keyframe =
          await KeyframeExtractionService.getOrExtractFrameAtTimestamp({
            clipId: clip.clipId,
            videoPath: clip.filePath,
            durationSec: clip.durationSec,
            timestampSec: panel.sourceTimestamp,
            existingKeyframes: clip.keyframes,
          });
        const imgPart = await GeminiClientService.imagePathToInlinePart(
          keyframe.filePath,
          "image/png"
        );
        const retrieved =
          styleProfile && referenceIndex
            ? ReferenceRetrievalService.retrieveForPanel({
                profile: styleProfile,
                index: referenceIndex,
                panel,
                clipAnalysis,
                referenceInfluence: preferences.referenceInfluence,
              })
            : null;
        return { panel, clip, clipAnalysis, keyframe, imgPart, retrieved };
      })
    );

    const parts: Array<Part | string> = [];
    for (const ctx of panelContexts) {
      parts.push(
        `PANEL "${ctx.panel.panelId}" (order #${ctx.panel.readingOrder}, ${ctx.panel.cameraShot}, ${ctx.panel.emotion}, beat="${ctx.panel.narrativeBeat}") — Keyframe ${ctx.keyframe.frameId} @ ${ctx.keyframe.timestampSec}s:`
      );
      parts.push(ctx.imgPart);
    }

    const panelBriefs = panelContexts.map((ctx) => ({
      panelId: ctx.panel.panelId,
      readingOrder: ctx.panel.readingOrder,
      renderer: ctx.panel.illustration.renderer,
      cameraShot: ctx.panel.cameraShot,
      size: ctx.panel.size,
      emotion: ctx.panel.emotion,
      description: ctx.panel.description,
      visualEffects: ctx.panel.visualEffects,
      referenceTags: ctx.retrieved?.matchedTags || [],
      actionGuide: ctx.retrieved?.actionGuide || null,
    }));

    const prompt = `Generate anime/manga illustration specifications and custom safe SVG overlays for ALL ${
      page.panels.length
    } panels on Page ${page.pageNumber} in ONE JSON response.

MASTER CONTROLS:
- Art Style Preset: ${preferences.style}
- Color Treatment: ${preferences.colorTreatment}
- Action Intensity: ${preferences.actionIntensity}
- Reference Influence: ${preferences.referenceInfluence}
- Storytelling Focus: ${preferences.storytellingFocus}

STYLE PROFILE SUMMARY:
${
  styleProfile
    ? `${styleProfile.general_style_description} | Eyes: ${styleProfile.character_art.expressive_eyes} | Foreshortening: ${styleProfile.anime_visual_language.dramatic_foreshortening}`
    : "Built-in shonen anime/manga sports conventions"
}

CHARACTER REFERENCES:
${JSON.stringify(characters, null, 2)}

PANELS TO ILLUSTRATE ON PAGE ${page.pageNumber}:
${JSON.stringify(panelBriefs, null, 2)}

RULES:
1. Return an object { "specs": [ ... ] } containing EXACTLY ${
      page.panels.length
    } specs matching every panelId above.
2. Set accurate focalX/focalY [0.05..0.95] on each panel's attached keyframe so athletes/rim stay centered.
3. Keep customSvgOverlay concise and safe (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">...</svg> using only safe vector primitives).
4. Ground all characters and actions strictly in the basketball keyframes; never copy reference manga characters.`;

    parts.push(prompt);

    const { data } = await GeminiClientService.generateStructuredJson({
      role: "carbon",
      systemInstruction,
      contents: parts,
      zodSchema: PageSpecsBatchResponseSchema,
      thinkingLevel: "LOW",
      temperature: 0.35,
    });

    const blendWeight =
      preferences.referenceInfluence === "strong"
        ? 0.65
        : preferences.referenceInfluence === "balanced"
        ? 0.35
        : 0.12;

    const specMap = new Map<string, CarbonIllustrationSpec>();
    for (const ctx of panelContexts) {
      const matched = data.specs.find((s) => s.panelId === ctx.panel.panelId);
      const base =
        matched ||
        DemoPipelineSynthesizer.buildDemoIllustrationSpec({
          panel: ctx.panel,
          preferences,
          styleProfile,
          referenceIndex,
          clipAnalysis: ctx.clipAnalysis,
        });

      const blendedContrast = ctx.retrieved
        ? Number(
            (
              base.inkContrast * (1 - blendWeight) +
              ctx.retrieved.recommendedInkContrast * blendWeight
            ).toFixed(2)
          )
        : base.inkContrast;

      const blendedScreentone = ctx.retrieved
        ? Number(
            (
              base.screentoneDensity * (1 - blendWeight) +
              ctx.retrieved.recommendedScreentoneDensity * blendWeight
            ).toFixed(2)
          )
        : base.screentoneDensity;

      specMap.set(ctx.panel.panelId, {
        ...base,
        panelId: ctx.panel.panelId,
        colorTreatment: preferences.colorTreatment,
        inkContrast: Math.min(1, Math.max(0.45, blendedContrast)),
        screentoneDensity: Math.min(0.85, Math.max(0, blendedScreentone)),
        appliedReferenceTags: ctx.retrieved ? ctx.retrieved.matchedTags : [],
        customSvgOverlay: SvgSanitizer.sanitize(base.customSvgOverlay),
      });
    }

    return specMap;
  }

  /**
   * Single-Panel Illustration Spec Generation powered by Gemini 4 Carbon
   * (`gemini-4-carbon`, `thinkingLevel: "LOW"`), used for isolated panel
   * regeneration in the Storyboard Editor.
   */
  static async generatePanelIllustrationSpec(params: {
    panel: MangaPanel;
    clip: NormalizedClip;
    clipAnalysis?: ClipEventAnalysis;
    characters: CharacterReference[];
    preferences: MangaPreferences;
    styleProfile?: MangaVisualStyleProfile;
    referenceIndex?: MangaReferenceIndex;
    previousPanelSummary?: string;
    regenerationHint?: string;
  }): Promise<CarbonIllustrationSpec> {
    const {
      panel,
      clip,
      clipAnalysis,
      characters,
      preferences,
      styleProfile,
      referenceIndex,
      previousPanelSummary,
      regenerationHint,
    } = params;

    const systemInstruction =
      await MangaSkillLoader.getIllustrationSystemInstruction();

    const keyframe =
      await KeyframeExtractionService.getOrExtractFrameAtTimestamp({
        clipId: clip.clipId,
        videoPath: clip.filePath,
        durationSec: clip.durationSec,
        timestampSec: panel.sourceTimestamp,
        existingKeyframes: clip.keyframes,
      });

    const retrieved =
      styleProfile && referenceIndex
        ? ReferenceRetrievalService.retrieveForPanel({
            profile: styleProfile,
            index: referenceIndex,
            panel,
            clipAnalysis,
            referenceInfluence: preferences.referenceInfluence,
          })
        : null;

    const parts: Array<Part | string> = [];
    const imgPart = await GeminiClientService.imagePathToInlinePart(
      keyframe.filePath,
      "image/png"
    );
    parts.push(
      `SOURCE BASKETBALL KEYFRAME (${keyframe.frameId} at ${keyframe.timestampSec}s of clip "${clip.title}"):`
    );
    parts.push(imgPart);

    const activeChars = characters.filter(
      (c) =>
        panel.characterIds.includes(c.characterId) ||
        c.referenceClipId === clip.clipId
    );

    const prompt = `Design the reference-guided anime/manga illustration specification and custom SVG vector overlay for panel "${
      panel.panelId
    }".

PANEL & ART CONTROLS:
- Narrative Stage: ${panel.narrativeStage} (${panel.narrativeBeat})
- Camera Shot: ${panel.cameraShot}
- Panel Size: ${panel.size} (aspect ${(
      panel.layout.width / panel.layout.height
    ).toFixed(2)})
- Emotion: ${panel.emotion}
- Action Description: ${panel.description}
- Master Art Style Preset: ${preferences.style}
- Color Treatment: ${preferences.colorTreatment}
- Action Intensity: ${preferences.actionIntensity}
- Reference Influence: ${preferences.referenceInfluence}
- Storytelling Focus: ${preferences.storytellingFocus}
- Requested Visual Effects: ${panel.visualEffects.join(", ") || "none"}
${
  previousPanelSummary
    ? `- Previous Panel Continuity: ${previousPanelSummary}`
    : ""
}
${
  regenerationHint
    ? `- USER / QA REGENERATION REQUEST: ${regenerationHint}`
    : ""
}

${
  retrieved
    ? retrieved.formattedPromptGuidance
    : "Follow built-in anime/manga sports visual conventions."
}

ACTIVE CHARACTER & UNIFORM REFERENCES:
${JSON.stringify(activeChars, null, 2)}

Return valid JSON matching CarbonIllustrationSpecSchema.`;

    parts.push(prompt);

    const { data } = await GeminiClientService.generateStructuredJson({
      role: "carbon",
      systemInstruction,
      contents: parts,
      zodSchema: CarbonIllustrationSpecSchema,
      thinkingLevel: "LOW",
      temperature: regenerationHint ? 0.5 : 0.35,
    });

    const blendWeight =
      preferences.referenceInfluence === "strong"
        ? 0.65
        : preferences.referenceInfluence === "balanced"
        ? 0.35
        : 0.12;

    const blendedContrast = retrieved
      ? Number(
          (
            data.inkContrast * (1 - blendWeight) +
            retrieved.recommendedInkContrast * blendWeight
          ).toFixed(2)
        )
      : data.inkContrast;

    const blendedScreentone = retrieved
      ? Number(
          (
            data.screentoneDensity * (1 - blendWeight) +
            retrieved.recommendedScreentoneDensity * blendWeight
          ).toFixed(2)
        )
      : data.screentoneDensity;

    return {
      ...data,
      panelId: panel.panelId,
      colorTreatment: preferences.colorTreatment,
      inkContrast: Math.min(1, Math.max(0.45, blendedContrast)),
      screentoneDensity: Math.min(0.85, Math.max(0, blendedScreentone)),
      appliedReferenceTags: retrieved ? retrieved.matchedTags : [],
      customSvgOverlay: SvgSanitizer.sanitize(data.customSvgOverlay),
    };
  }
}
