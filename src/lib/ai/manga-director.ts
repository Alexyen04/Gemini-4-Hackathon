import { z } from "zod";
import {
  CharacterReference,
  ClipEventAnalysis,
  LayoutTemplateIdSchema,
  MangaPreferences,
  MangaStoryboard,
  MangaStoryboardSchema,
  NormalizedClip,
  StoryNarrative,
  StoryNarrativeSchema,
} from "@/types/manga";
import { MangaSkillLoader } from "@/lib/manga/skill-loader";
import { StoryboardValidator } from "@/lib/manga/validators";
import { PageCompositionService } from "@/lib/manga/layout-engine";
import {
  MangaReferenceIndex,
  MangaVisualStyleProfile,
} from "@/lib/manga/references/style-profile";
import { ReferenceRetrievalService } from "@/lib/manga/references/reference-retrieval";
import { GeminiClientService } from "./gemini-client";

const NeonRefinementSchema = z.object({
  pages: z.array(
    z.object({
      pageId: z.string(),
      recommendedTemplate: LayoutTemplateIdSchema,
      panelCaptionRefinements: z.array(
        z.object({
          panelId: z.string(),
          conciseCaption: z.string().nullable(),
        })
      ),
    })
  ),
});

export class MangaDirectorAgent {
  /**
   * Stage 2: Global Narrative Planning powered by Gemini 4 Carbon, informed by
   * the Stage 0 Manga Visual Style Profile and user storytelling controls.
   */
  static async planGlobalNarrative(params: {
    clips: NormalizedClip[];
    analyses: ClipEventAnalysis[];
    characters: CharacterReference[];
    preferences: MangaPreferences;
    styleProfile?: MangaVisualStyleProfile;
  }): Promise<StoryNarrative> {
    const { clips, analyses, characters, preferences, styleProfile } = params;
    const systemInstruction =
      await MangaSkillLoader.getNarrativeSystemInstruction();

    const focusDirective =
      preferences.storytellingFocus === "action_focused"
        ? "ACTION-FOCUSED STORYTELLING: Prioritize high-velocity basketball exchanges, physical matchups, separation moves, and rim collisions."
        : preferences.storytellingFocus === "emotion_focused"
        ? "EMOTION-FOCUSED STORYTELLING: Emphasize psychological pressure, clutch nerves, eye-contact duels, exhaustion, and cathartic reactions."
        : "BALANCED STORYTELLING: Interleave kinetic basketball plays with sharp emotional character beats.";

    const pacingNotes = styleProfile
      ? `REFERENCE NARRATIVE PACING PROFILE (${styleProfile.profile_id}):
- Beat Sequence Pattern: ${styleProfile.narrative_pacing.beat_sequence_pattern.join(" -> ")}
- Size Escalation: ${styleProfile.narrative_pacing.panel_size_escalation}
- Suspense Technique: ${styleProfile.narrative_pacing.suspense_building}`
      : "";

    const prompt = `Construct a cohesive, factually grounded basketball manga narrative from these ${
      clips.length
    } chronologically ordered highlight clips.

USER PREFERENCES & ART CONTROLS:
${JSON.stringify(preferences, null, 2)}
${focusDirective}
Action Intensity: ${preferences.actionIntensity.toUpperCase()}

${pacingNotes}

CHARACTER REFERENCES:
${JSON.stringify(characters, null, 2)}

VERIFIED CLIP EVENT ANALYSES (from Gemini 4 Argon):
${JSON.stringify(
      analyses.map((a) => {
        const clip = clips.find((c) => c.clipId === a.clipId);
        return {
          ...a,
          clipTitle: clip?.title,
          durationSec: clip?.durationSec,
          metadata: clip?.metadata,
        };
      }),
      null,
      2
    )}

REQUIREMENTS:
1. Build a true sports manga arc covering "introduction", "rising_action", "conflict", "climax", and "resolution".
2. Decompose pivotal clips into multi-panel beats (target ~${
      preferences.targetPages * 4
    } total panels across ${preferences.targetPages} pages).
3. Maintain strict chronological order and factual play outcomes. Never invent plays or fabricate real athlete press quotes.
4. Return valid JSON matching StoryNarrativeSchema.`;

    const { data } = await GeminiClientService.generateStructuredJson({
      role: "hydrogen",
      systemInstruction,
      contents: [prompt],
      zodSchema: StoryNarrativeSchema,
      thinkingLevel: "LOW",
      temperature: 0.35,
    });

    return data;
  }

  /**
   * Stage 3: Reference-Guided Manga Storyboarding powered by Gemini 4 Carbon.
   * Combines basketball event metadata, narrative structure, Manga Storytelling
   * Skill, Manga Visual Style Profile, and retrieved reference guidance.
   */
  static async generateStoryboard(params: {
    storyId: string;
    clips: NormalizedClip[];
    analyses: ClipEventAnalysis[];
    characters: CharacterReference[];
    narrative: StoryNarrative;
    preferences: MangaPreferences;
    styleProfile?: MangaVisualStyleProfile;
    referenceIndex?: MangaReferenceIndex;
  }): Promise<MangaStoryboard> {
    const {
      storyId,
      clips,
      analyses,
      characters,
      narrative,
      preferences,
      styleProfile,
      referenceIndex,
    } = params;
    const systemInstruction =
      await MangaSkillLoader.getStoryboardSystemInstruction();

    const referenceBlock =
      styleProfile && referenceIndex
        ? ReferenceRetrievalService.buildStoryboardReferenceContext({
            profile: styleProfile,
            index: referenceIndex,
            analyses,
            referenceInfluence: preferences.referenceInfluence,
          })
        : "Using built-in basketball-manga layout and action composition conventions.";

    const prompt = `Translate this basketball narrative into a structured ${
      preferences.targetPages
    }-page anime/manga storyboard for story "${storyId}".

ART PRESET & INDEPENDENT CONTROLS:
- Master Art Preset: ${preferences.style}
- Color Treatment: ${preferences.colorTreatment}
- Action Intensity: ${preferences.actionIntensity}
- Reference Influence: ${preferences.referenceInfluence}
- Storytelling Focus: ${preferences.storytellingFocus}
- Reading Direction: ${preferences.readingDirection}
- Target Pages: ${preferences.targetPages}
- Director Notes: ${preferences.directorNotes || "None"}

${referenceBlock}

GLOBAL NARRATIVE:
${JSON.stringify(narrative, null, 2)}

CHARACTER REFERENCES:
${JSON.stringify(characters, null, 2)}

CLIPS & AVAILABLE KEYFRAMES:
${JSON.stringify(
      clips.map((c) => ({
        clipId: c.clipId,
        durationSec: c.durationSec,
        metadata: c.metadata,
        keyframes: c.keyframes.map((k) => ({
          frameId: k.frameId,
          timestampSec: k.timestampSec,
        })),
        analysis: analyses.find((a) => a.clipId === c.clipId),
      })),
      null,
      2
    )}

STORYBOARD GENERATION RULES:
1. Create ${preferences.targetPages} pages using supported layout templates ("balanced_four", "balanced_five", "dramatic_three", "hero_action_four", "climax_showcase_three", "vertical_strip_four", "full_splash").
2. Match panel count on each page to the chosen template. If storytellingFocus="emotion_focused", include expressive eye/reaction closeups; if storytellingFocus="action_focused" or actionIntensity="explosive", emphasize low-angle dunks, blocks, foreshortened drives, and hero/dramatic layouts.
3. Decompose climax clips into multiple suspenseful beats with distinct clip-local "sourceTimestamp" values inside [0, durationSec].
4. Set "illustration.style"="${preferences.style}" and "illustration.colorTreatment"="${preferences.colorTreatment}". Write highly specific, anime/manga reference-guided "illustration.prompt" instructions grounded in the real play!
5. Never copy reference manga character designs or fabricate real-world athlete press quotes.

Return valid JSON matching MangaStoryboardSchema.`;

    const { data: rawStoryboard } =
      await GeminiClientService.generateStructuredJson({
        role: "hydrogen",
        systemInstruction,
        contents: [prompt],
        zodSchema: MangaStoryboardSchema,
        thinkingLevel: "LOW",
        temperature: 0.35,
      });

    let normalized = StoryboardValidator.normalizeAndRepairStoryboard(
      rawStoryboard,
      clips
    );

    if (preferences.useLayoutOptimizerNeon) {
      normalized = await this.optimizeLayoutsWithNeon(normalized);
    }

    return normalized;
  }

  static async optimizeLayoutsWithNeon(
    storyboard: MangaStoryboard
  ): Promise<MangaStoryboard> {
    try {
      const prompt = `Review this manga storyboard's page rhythm and caption conciseness.
Ensure consecutive pages vary layout templates where panel counts match, and trim any overly wordy captions to punchy sports-manga phrasing (<= 14 words) without altering any basketball facts.

Current Storyboard Summary:
${JSON.stringify(
        storyboard.pages.map((p) => ({
          pageId: p.pageId,
          panelCount: p.panels.length,
          layoutTemplate: p.layoutTemplate,
          panels: p.panels.map((pan) => ({
            panelId: pan.panelId,
            caption: pan.caption,
          })),
        })),
        null,
        2
      )}`;

      const { data } = await GeminiClientService.generateStructuredJson({
        role: "neon",
        systemInstruction:
          "You are Agent 4: the Gemini 4 Neon Manga Layout & Pacing Optimizer. Maintain strict factual fidelity.",
        contents: [prompt],
        zodSchema: NeonRefinementSchema,
        thinkingLevel: "LOW",
        temperature: 0.25,
      });

      const updatedPages = storyboard.pages.map((page) => {
        const rec = data.pages.find((r) => r.pageId === page.pageId);
        if (!rec) return page;
        const captionMap = new Map(
          rec.panelCaptionRefinements.map((c) => [c.panelId, c.conciseCaption])
        );
        const panels = page.panels.map((pan) => ({
          ...pan,
          caption: captionMap.has(pan.panelId)
            ? captionMap.get(pan.panelId) ?? pan.caption
            : pan.caption,
        }));
        return PageCompositionService.composePage(
          { ...page, panels },
          storyboard.readingDirection,
          rec.recommendedTemplate
        );
      });

      return { ...storyboard, pages: updatedPages };
    } catch {
      return storyboard;
    }
  }
}
