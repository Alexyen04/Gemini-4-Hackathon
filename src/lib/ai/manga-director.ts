import { z } from "zod";
import {
  CharacterReference,
  CameraShotSchema,
  ClipEventAnalysis,
  LayoutTemplateIdSchema,
  MangaEmotionSchema,
  MangaPanelSchema,
  MangaPageSchema,
  MangaPreferences,
  MangaStoryboard,
  MangaStoryboardSchema,
  NarrativeStageSchema,
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

const JAPANESE_CHAR_RE = /[\u3040-\u30ff\u4e00-\u9faf]/;

function sanitizeSfxForInputLanguage(
  sfx: string | null | undefined,
  allowJapanese: boolean
): string | null {
  if (!sfx) return null;
  if (allowJapanese) return sfx.trim() || null;
  // Strip any "/ カタカナ" suffix or Japanese characters when input is English-only
  const cleaned = sfx
    .replace(/\s*\/\s*[\u3040-\u30ff\u4e00-\u9fafー・！!？?\s]+/g, "")
    .replace(/[\u3040-\u30ff\u4e00-\u9fafー]+/g, "")
    .replace(/\s*\/\s*$/g, "")
    .trim();
  return cleaned || null;
}

// Stage 3 asks Carbon for creative choices only. IDs, rectangles, playback
// metadata, and illustration records are deterministic and should not consume
// model output tokens or inflate its constrained-decoding schema.
const StoryboardPlanSchema = z.object({
  pages: z.array(z.object({
    layoutTemplate: LayoutTemplateIdSchema,
    panels: z.array(z.object({
      sourceClipId: z.string(),
      sourceTimestamp: z.number(),
      narrativeStage: NarrativeStageSchema,
      narrativeBeat: z.string(),
      cameraShot: CameraShotSchema,
      emotion: MangaEmotionSchema,
      description: z.string(),
      characterIds: z.array(z.string()).default([]),
      visualEffects: z.array(z.string()).default([]),
      caption: z.string().nullable().default(null),
      sfx: z.string().nullable().default(null),
    })).min(1).max(7),
  })).min(1),
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
    upstreamHandoffContext?: string;
  }): Promise<StoryNarrative> {
    const {
      clips,
      analyses,
      characters,
      preferences,
      styleProfile,
      upstreamHandoffContext,
    } = params;
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

${upstreamHandoffContext ? `${upstreamHandoffContext}\n` : ""}CHARACTER REFERENCES:
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
3. Maintain strict chronological order, consistent player names/identities from CHARACTER REFERENCES, and factual play outcomes. Never invent plays or fabricate real athlete press quotes.
4. Match the language of the input media and prompt (if English, write strictly in English with no Japanese characters).
5. Return valid JSON matching StoryNarrativeSchema.`;

    const { data } = await GeminiClientService.generateStructuredJson({
      role: "neon",
      systemInstruction,
      contents: [prompt],
      zodSchema: StoryNarrativeSchema,
      thinkingLevel: "LOW",
      temperature: 0.3,
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
    upstreamHandoffContext?: string;
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
      upstreamHandoffContext,
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

    const prompt = `Translate this basketball narrative into a compact ${
      preferences.targetPages
    }-page anime/manga panel plan for story "${storyId}".

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

${upstreamHandoffContext ? `${upstreamHandoffContext}\n` : ""}GLOBAL NARRATIVE:
${JSON.stringify({
  title: narrative.title,
  summary: narrative.summary,
  climaxClipId: narrative.climaxClipId,
  beats: narrative.beats,
})}

CHARACTER REFERENCES:
${JSON.stringify(characters.map((c) => ({
  characterId: c.characterId,
  displayName: c.displayName,
  jerseyNumber: c.jerseyNumber,
  teamName: c.teamName,
  uniformDescription: c.uniformDescription,
})))}

VERIFIED CLIPS & BEST MOMENTS:
${JSON.stringify(
       clips.map((c) => ({
         clipId: c.clipId,
         durationSec: c.durationSec,
         metadata: c.metadata,
         analysis: (() => {
           const a = analyses.find((item) => item.clipId === c.clipId);
           return a && {
             actionSummary: a.actionSummary,
             actionSequence: a.actionSequence,
             outcomeVerified: a.outcomeVerified,
             mainPlayers: a.mainPlayers,
             bestMoments: a.bestMoments,
             uncertainties: a.uncertainties,
           };
         })(),
       })),
     )}

STORYBOARD GENERATION RULES:
1. Return exactly ${preferences.targetPages} pages, each with 1-5 panels in Left-to-Right reading order. Use a supported layoutTemplate matching its panel count (e.g. balanced_four=4, dramatic_three=3, full_splash=1).
2. Keep clip order chronological across all panels. Every sourceClipId must match a supplied clip; sourceTimestamp must lie within its duration. Never invent a play, outcome or quote.
3. Decompose pivotal clips into distinct verified setup, anticipation, action and aftermath moments. Tag every panel's "characterIds" with the exact characterId(s) from CHARACTER REFERENCES who appear in that shot so each player's visual identity stays 100% consistent across panels.
4. Keep ALL captions and SFX strictly in the same language as the input video/prompt (for English input, use English SFX ONLY like "SWISH!" or "BOOOOM!!"—NEVER add Japanese/katakana characters).
5. Return only { "pages": [{ "layoutTemplate": "...", "panels": [{ "sourceClipId": "...", "sourceTimestamp": 0, "narrativeStage": "...", "narrativeBeat": "...", "cameraShot": "...", "emotion": "...", "description": "...", "characterIds": [], "visualEffects": [], "caption": null, "sfx": null }] }] }. Do not generate IDs, layout coordinates, illustration specs, chapters, or interactions.`;

    const clipOrder = new Map(clips.map((clip, index) => [clip.clipId, index]));
    const planSchema = StoryboardPlanSchema.superRefine((plan, ctx) => {
      if (plan.pages.length !== preferences.targetPages) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected exactly ${preferences.targetPages} pages` });
      }
      for (const [pageIndex, page] of plan.pages.entries()) {
        if (PageCompositionService.listTemplates().find((t) => t.id === page.layoutTemplate)?.panelCount !== page.panels.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pages", pageIndex, "panels"], message: "Panel count must match layout template" });
        }
        for (const [panelIndex, panel] of page.panels.entries()) {
          const index = clipOrder.get(panel.sourceClipId);
          const clip = index === undefined ? undefined : clips[index];
          if (!clip || panel.sourceTimestamp < 0 || panel.sourceTimestamp > clip.durationSec) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pages", pageIndex, "panels", panelIndex], message: "Unknown clip or timestamp outside clip duration" });
          }
        }
      }
    });
    const { data: rawPlan } =
      await GeminiClientService.generateStructuredJson({
        role: "carbon",
        systemInstruction,
        contents: [prompt],
        zodSchema: planSchema,
        thinkingLevel: "LOW",
        temperature: 0.2,
      });

    // Enforce chronological clip order ourselves instead of failing the run:
    // stable-sort all panels by clip order, then refill pages with their original panel counts.
    const orderedPanels = rawPlan.pages
      .flatMap((page) => page.panels)
      .map((panel, i) => ({ panel, i }))
      .sort((x, y) => clipOrder.get(x.panel.sourceClipId)! - clipOrder.get(y.panel.sourceClipId)! || x.i - y.i)
      .map(({ panel }) => panel);
    let cursor = 0;
    const plan = {
      ...rawPlan,
      pages: rawPlan.pages.map((page) => {
        const panels = orderedPanels.slice(cursor, cursor + page.panels.length);
        cursor += page.panels.length;
        return { ...page, panels };
      }),
    };

    const allowJapanese = JAPANESE_CHAR_RE.test(
      `${preferences.userPrompt || ""} ${preferences.directorNotes || ""} ${clips
        .map((c) => `${c.title} ${c.metadata.eventDescription || ""}`)
        .join(" ")}`
    );
    const validCharIds = new Set(characters.map((c) => c.characterId));
    const analysisByClip = new Map(analyses.map((a) => [a.clipId, a]));

    const rawStoryboard = MangaStoryboardSchema.parse({
      storyId,
      title: narrative.title,
      subtitle: narrative.subtitle,
      summary: narrative.summary,
      style: preferences.style,
      readingDirection: "ltr",
      chapters: narrative.chapters,
      sourceClips: clips.map((c) => c.clipId),
      pages: plan.pages.map((page, pageIdx) => MangaPageSchema.parse({
        pageId: `page_${pageIdx + 1}`,
        chapterId: narrative.chapters[0].chapterId,
        pageNumber: pageIdx + 1,
        pageType: page.layoutTemplate === "full_splash" ? "splash" : "normal",
        layoutTemplate: page.layoutTemplate,
        panels: page.panels.map((panel, panelIdx) => {
          const clip = clips[clipOrder.get(panel.sourceClipId)!];
          const clipAnalysis = analysisByClip.get(clip.clipId);
          const closest = [...clip.keyframes].sort(
            (a, b) => Math.abs(a.timestampSec - panel.sourceTimestamp) - Math.abs(b.timestampSec - panel.sourceTimestamp)
          )[0];

          // Resolve consistent characterIds across clips (model tags -> description/clip match -> fallback)
          const modelCharIds = (panel.characterIds || []).filter((id) =>
            validCharIds.has(id)
          );
          let resolvedCharIds = modelCharIds;
          if (resolvedCharIds.length === 0) {
            const descLower = panel.description.toLowerCase();
            const clipPlayerNames = new Set(
              (clipAnalysis?.mainPlayers || []).map((p) =>
                p.nameOrLabel.replace(/^#\d+\s*/, "").trim().toLowerCase()
              )
            );
            const clipPlayerJerseys = new Set(
              (clipAnalysis?.mainPlayers || [])
                .map((p) => p.jerseyNumber)
                .filter(Boolean)
            );
            resolvedCharIds = characters
              .filter((c) => {
                const nameClean = c.displayName
                  .replace(/^#\d+\s*/, "")
                  .trim()
                  .toLowerCase();
                return (
                  c.referenceClipId === clip.clipId ||
                  (nameClean.length >= 3 &&
                    (descLower.includes(nameClean) ||
                      clipPlayerNames.has(nameClean))) ||
                  (c.jerseyNumber &&
                    (descLower.includes(`#${c.jerseyNumber}`) ||
                      clipPlayerJerseys.has(c.jerseyNumber)))
                );
              })
              .map((c) => c.characterId);
          }

          return MangaPanelSchema.parse({
            panelId: `panel_p${pageIdx + 1}_${String(panelIdx + 1).padStart(2, "0")}`,
            readingOrder: panelIdx + 1,
            ...panel,
            sfx: sanitizeSfxForInputLanguage(panel.sfx, allowJapanese),
            sfxSubtext: null,
            characterIds: resolvedCharIds,
            size: "medium",
            layout: { x: 0, y: 0, width: 1, height: 1 },
            illustration: {
              renderer: "hybrid",
              referenceFrameIds: closest ? [closest.frameId] : [],
              style: preferences.style,
              colorTreatment: preferences.colorTreatment,
              prompt: panel.description,
            },
            interaction: {
              type: "play_source_clip",
              clipId: panel.sourceClipId,
              timestamp: panel.sourceTimestamp,
              originalGameClock: clip.metadata.gameClock ?? null,
            },
          });
        }),
      })),
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
