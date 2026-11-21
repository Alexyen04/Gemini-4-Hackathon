import fs from "fs/promises";
import { Part } from "@google/genai";
import { z } from "zod";
import {
  CharacterReference,
  ClipEventAnalysis,
  MangaPreferences,
  MangaStoryboard,
  NormalizedClip,
  PanelQualityFeedbackSchema,
  QualityReviewReport,
} from "@/types/manga";
import { MangaSkillLoader } from "@/lib/manga/skill-loader";
import { StoryboardValidator } from "@/lib/manga/validators";
import { MangaVisualStyleProfile } from "@/lib/manga/references/style-profile";
import { GeminiClientService, resolveRoleModel } from "./gemini-client";

const HydrogenReviewResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  narrativePass: z.boolean(),
  visualPass: z.boolean(),
  styleProfileAlignmentPass: z.boolean(),
  originalityPass: z.boolean(),
  summary: z.string(),
  strengths: z.array(z.string()),
  warnings: z.array(z.string()),
  panelFeedback: z.array(PanelQualityFeedbackSchema),
});

export class MangaQualityReviewer {
  /**
   * Stage 6: Multimodal Quality Validation powered by Gemini 4 Hydrogen
   * (`gemini-4-hydrogen`). Evaluates alignment with the saved Style Profile,
   * anime-inspired expressiveness, originality (no reference copying),
   * character consistency, reading order, and factual basketball accuracy.
   */
  static async evaluateManga(params: {
    storyboard: MangaStoryboard;
    clips: NormalizedClip[];
    analyses: ClipEventAnalysis[];
    characters: CharacterReference[];
    preferences?: MangaPreferences;
    styleProfile?: MangaVisualStyleProfile;
  }): Promise<QualityReviewReport> {
    const {
      storyboard,
      clips,
      analyses,
      characters,
      preferences,
      styleProfile,
    } = params;

    const structural = StoryboardValidator.validateStoryboard(
      storyboard,
      clips
    );

    const systemInstruction =
      await MangaSkillLoader.getQualityReviewSystemInstruction();
    const parts: Array<Part | string> = [];

    const allPanels = storyboard.pages.flatMap((p) => p.panels);
    for (const panel of allPanels.slice(0, 6)) {
      if (panel.illustration.assetFilePath) {
        const exists = await fs
          .stat(panel.illustration.assetFilePath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          const imgPart = await GeminiClientService.imagePathToInlinePart(
            panel.illustration.assetFilePath,
            "image/png"
          );
          parts.push(
            `Rendered Panel ${panel.panelId} (style=${panel.illustration.style}, color=${panel.illustration.colorTreatment}, clip=${panel.sourceClipId} @ ${panel.sourceTimestamp}s):`
          );
          parts.push(imgPart);
        }
      }
    }

    const prompt = `Audit this completed basketball manga storyboard and rendered panels.

EVALUATION CRITERIA (Do NOT use pixel similarity to reference manga; verify learned general principles + originality):
1. Alignment with saved Manga Visual Style Profile (${
      styleProfile?.profile_id || "builtin"
    }) and selected preset (${storyboard.style}, color=${
      preferences?.colorTreatment || "traditional_monochrome"
    }).
2. Anime-inspired visual expressiveness, dynamic poses, consistent shading, and effective motion effects.
3. Artwork originality (must depict the real basketball players/clips without copying reference manga characters).
4. Correct ${storyboard.readingDirection.toUpperCase()} reading direction, character uniform consistency, story continuity, and factual basketball accuracy.

STRUCTURAL CHECK SUMMARY:
Valid: ${structural.valid}
Structural Issues: ${JSON.stringify(structural.errors)}

STYLE PROFILE SUMMARY:
${
  styleProfile
    ? JSON.stringify(
        {
          profile_id: styleProfile.profile_id,
          visual_style: styleProfile.visual_style,
          general_style_description: styleProfile.general_style_description,
        },
        null,
        2
      )
    : "Built-in baseline"
}

SOURCE CLIP ANALYSES:
${JSON.stringify(analyses, null, 2)}

CHARACTER REFERENCES:
${JSON.stringify(characters, null, 2)}

STORYBOARD PANELS:
${JSON.stringify(
      storyboard.pages.map((p) => ({
        pageId: p.pageId,
        pageNumber: p.pageNumber,
        layoutTemplate: p.layoutTemplate,
        panels: p.panels.map((pan) => ({
          panelId: pan.panelId,
          readingOrder: pan.readingOrder,
          sourceClipId: pan.sourceClipId,
          sourceTimestamp: pan.sourceTimestamp,
          description: pan.description,
          caption: pan.caption,
          sfx: pan.sfx,
        })),
      })),
      null,
      2
    )}

Mark "requiresRegeneration": true ONLY on individual panels that fail factual alignment, contrast legibility, or composition.

Return JSON matching HydrogenReviewResponseSchema.`;

    parts.push(prompt);

    const { data, modelUsed } =
      await GeminiClientService.generateStructuredJson({
        role: "hydrogen",
        systemInstruction,
        contents: parts,
        zodSchema: HydrogenReviewResponseSchema,
        thinkingLevel: "LOW",
        temperature: 0.2,
      });

    return {
      evaluatedByModel: modelUsed || resolveRoleModel("hydrogen"),
      evaluatedAt: new Date().toISOString(),
      overallScore: structural.valid
        ? data.overallScore
        : Math.min(72, data.overallScore),
      structuralPass: structural.valid,
      narrativePass: data.narrativePass,
      visualPass: data.visualPass,
      styleProfileAlignmentPass: data.styleProfileAlignmentPass,
      originalityPass: data.originalityPass,
      summary: data.summary,
      strengths: data.strengths,
      warnings: [
        ...structural.errors,
        ...structural.warnings,
        ...data.warnings,
      ],
      panelFeedback: data.panelFeedback,
      regeneratedPanelIds: [],
    };
  }
}
