import {
  CameraShot,
  ClipEventAnalysis,
  MangaEmotion,
  MangaPanel,
  ReferenceInfluence,
} from "@/types/manga";
import {
  ActionCompositionGuide,
  MangaReferenceIndex,
  MangaVisualStyleProfile,
  ReferenceIndexedItem,
  ReferenceTag,
} from "./style-profile";

export interface RetrievedReferenceGuidance {
  matchedTags: ReferenceTag[];
  actionGuide: ActionCompositionGuide;
  matchedItems: Array<{
    itemId: string;
    chapterId: string;
    pageId: string;
    tags: ReferenceTag[];
    compositionTakeaway: string;
    cameraAndLightingNote: string;
  }>;
  recommendedInkContrast: number;
  recommendedShadowDensity: number;
  recommendedScreentoneDensity: number;
  formattedPromptGuidance: string;
}

export class ReferenceRetrievalService {
  /**
   * Maps a basketball event type, camera shot, and emotion to semantic
   * `ReferenceTag` keys for internal reference retrieval.
   */
  static deriveQueryTags(params: {
    eventType?: ClipEventAnalysis["eventType"];
    cameraShot?: CameraShot;
    emotion?: MangaEmotion;
    isClimax?: boolean;
  }): ReferenceTag[] {
    const tags = new Set<ReferenceTag>();
    const { eventType, cameraShot, emotion, isClimax } = params;

    switch (eventType) {
      case "dunk":
      case "rebound_putback":
        tags.add("dunk");
        tags.add("low_angle");
        tags.add("impact_lines");
        tags.add("speed_lines");
        break;
      case "three_pointer":
      case "midrange_jumper":
      case "clutch_game_winner":
        tags.add("jump_shot");
        tags.add("suspense");
        tags.add("determination");
        break;
      case "block":
      case "defensive_stop":
        tags.add("defensive_block");
        tags.add("perimeter_defense");
        tags.add("impact_lines");
        break;
      case "steal_fastbreak":
        tags.add("sprint_fastbreak");
        tags.add("speed_lines");
        break;
      case "layup_drive":
        tags.add("dribbling");
        tags.add("speed_lines");
        break;
      case "assist_playmaking":
        tags.add("passing");
        tags.add("speed_lines");
        break;
      default:
        tags.add("determination");
    }

    if (cameraShot === "extreme_closeup") {
      tags.add("extreme_closeup");
      tags.add("closeup");
    } else if (cameraShot === "closeup") {
      tags.add("closeup");
    } else if (cameraShot === "low_angle") {
      tags.add("low_angle");
    } else if (cameraShot === "high_angle") {
      tags.add("high_angle");
    } else if (cameraShot === "dutch_angle") {
      tags.add("dutch_angle");
    }

    if (emotion === "determination" || emotion === "focus") {
      tags.add("determination");
    } else if (emotion === "shock") {
      tags.add("shock");
      tags.add("character_reaction");
    } else if (emotion === "triumph") {
      tags.add("triumph");
      tags.add("character_reaction");
    } else if (emotion === "exhaustion" || emotion === "defeat") {
      tags.add("exhaustion");
      tags.add("character_reaction");
    }

    if (isClimax) {
      tags.add("dramatic_splash");
      tags.add("impact_lines");
    }

    return Array.from(tags);
  }

  static selectActionGuide(
    profile: MangaVisualStyleProfile,
    eventType?: ClipEventAnalysis["eventType"]
  ): ActionCompositionGuide {
    const actions = profile.basketball_action;
    switch (eventType) {
      case "dunk":
      case "rebound_putback":
        return actions.dunking;
      case "three_pointer":
      case "midrange_jumper":
      case "clutch_game_winner":
        return actions.shooting;
      case "block":
        return actions.blocking;
      case "defensive_stop":
        return actions.defending;
      case "steal_fastbreak":
        return actions.sprinting;
      case "assist_playmaking":
        return actions.passing;
      case "layup_drive":
        return actions.dribbling;
      default:
        return actions.player_confrontations;
    }
  }

  /**
   * Retrieves targeted reference observations for an individual panel or clip
   * without ever exposing or copying reference images into the output manga.
   */
  static retrieveForPanel(params: {
    profile: MangaVisualStyleProfile;
    index: MangaReferenceIndex;
    panel?: Pick<
      MangaPanel,
      "cameraShot" | "emotion" | "narrativeStage" | "size"
    >;
    clipAnalysis?: ClipEventAnalysis;
    referenceInfluence: ReferenceInfluence;
  }): RetrievedReferenceGuidance {
    const { profile, index, panel, clipAnalysis, referenceInfluence } = params;

    const queryTags = this.deriveQueryTags({
      eventType: clipAnalysis?.eventType,
      cameraShot: panel?.cameraShot,
      emotion: panel?.emotion,
      isClimax:
        panel?.narrativeStage === "climax" ||
        panel?.size === "splash" ||
        clipAnalysis?.narrativeSignificance === "climax",
    });

    const querySet = new Set(queryTags);

    // Score indexed reference items by tag overlap
    const scored: Array<{ item: ReferenceIndexedItem; score: number }> =
      index.items.map((item) => {
        let overlap = 0;
        for (const t of item.tags) {
          if (querySet.has(t)) overlap += 2;
        }
        if (item.item_type === "panel") overlap += 0.5;
        return { item, score: overlap };
      });

    scored.sort((a, b) => b.score - a.score);

    const limit =
      referenceInfluence === "strong"
        ? 4
        : referenceInfluence === "balanced"
        ? 2
        : 1;
    const topMatches = scored
      .filter((s) => s.score > 0)
      .slice(0, limit)
      .map(({ item }) => ({
        itemId: item.item_id,
        chapterId: item.chapter_id,
        pageId: item.page_id,
        tags: item.tags,
        compositionTakeaway: item.composition_takeaway,
        cameraAndLightingNote: item.camera_and_lighting_note,
      }));

    const actionGuide = this.selectActionGuide(
      profile,
      clipAnalysis?.eventType
    );

    const influenceDirective =
      referenceInfluence === "strong"
        ? "STRONG REFERENCE INFLUENCE: Closely apply the reference style profile's G-pen/brush contour hierarchy, foreshortening, shadow massing, screentone density, and anime facial expressiveness while keeping character identities, uniforms, and basketball actions 100% original to the video clip."
        : referenceInfluence === "balanced"
        ? "BALANCED REFERENCE INFLUENCE: Blend the reference style profile's composition, shading, and motion principles naturally with the selected preset."
        : "LIGHT REFERENCE INFLUENCE: Use broad manga composition takeaways lightly while prioritizing grounded keyframe fidelity.";

    const matchLines =
      topMatches.length > 0
        ? topMatches
            .map(
              (m) =>
                `- [${m.chapterId}/${m.pageId} tags: ${m.tags.join(", ")}] ${
                  m.compositionTakeaway
                } | Camera/Light: ${m.cameraAndLightingNote}`
            )
            .join("\n")
        : "- Apply general style profile action composition rules (no specific indexed chapter crop matched).";

    const formattedPromptGuidance = [
      `### RETRIEVED MANGA VISUAL REFERENCE GUIDANCE (${referenceInfluence.toUpperCase()})`,
      influenceDirective,
      `- Style Summary: ${profile.general_style_description}`,
      `- Character & Anime Expression Conventions: Eyes: ${profile.character_art.expressive_eyes} | Shading: ${profile.character_art.facial_shading} | Proportions: ${profile.character_art.proportions}`,
      `- Linework & Tone: ${profile.linework_and_shading.g_pen_linework} | Screentones: ${profile.linework_and_shading.screentones}`,
      `- Action Staging (${clipAnalysis?.eventType || "basketball_play"}): Camera: ${actionGuide.camera_angles} | Body: ${actionGuide.body_language} | Effects: ${actionGuide.movement_effects} | Panel: ${actionGuide.panel_composition}`,
      `- Anime Visual Language: Foreshortening: ${profile.anime_visual_language.dramatic_foreshortening} | Silhouettes: ${profile.anime_visual_language.strong_silhouettes}`,
      `- Matched Reference Takeaways:\n${matchLines}`,
      `- STRICT ORIGINALITY RULE: Never copy or trace reference manga character designs, hair colors, or logos. Ground player appearance strictly in the video keyframe and CharacterReference records.`,
    ].join("\n");

    return {
      matchedTags: queryTags,
      actionGuide,
      matchedItems: topMatches,
      recommendedInkContrast:
        profile.linework_and_shading.recommended_ink_contrast,
      recommendedShadowDensity:
        profile.linework_and_shading.recommended_shadow_density,
      recommendedScreentoneDensity:
        profile.linework_and_shading.recommended_screentone_density,
      formattedPromptGuidance,
    };
  }

  /**
   * Builds a global storyboard-level summary of the `MangaVisualStyleProfile`
   * and per-clip retrieved action guidance for Stage 3 Storyboard Generation.
   */
  static buildStoryboardReferenceContext(params: {
    profile: MangaVisualStyleProfile;
    index: MangaReferenceIndex;
    analyses: ClipEventAnalysis[];
    referenceInfluence: ReferenceInfluence;
  }): string {
    const { profile, index, analyses, referenceInfluence } = params;

    const perClipNotes = analyses.map((a) => {
      const retrieved = this.retrieveForPanel({
        profile,
        index,
        clipAnalysis: a,
        referenceInfluence,
      });
      return `- Clip ${a.clipId} (${a.eventType}): Camera -> ${
        retrieved.actionGuide.camera_angles
      }; Effects -> ${retrieved.actionGuide.movement_effects}; Panel -> ${
        retrieved.actionGuide.panel_composition
      }${
        retrieved.matchedItems[0]
          ? ` (Ref ${retrieved.matchedItems[0].chapterId}: ${retrieved.matchedItems[0].compositionTakeaway})`
          : ""
      }`;
    });

    return [
      `## MANGA VISUAL STYLE PROFILE (${profile.profile_id}, influence=${referenceInfluence})`,
      `Overview: ${profile.general_style_description}`,
      `Layout Principles: Typical panels/page=${profile.manga_layouts.typical_panel_count}; Hierarchy=${profile.manga_layouts.visual_hierarchy}; Splash=${profile.manga_layouts.splash_pages}; Borderless=${profile.manga_layouts.borderless_panels}`,
      `Narrative Pacing Pattern: ${profile.narrative_pacing.beat_sequence_pattern.join(" -> ")} | Escalation: ${profile.narrative_pacing.panel_size_escalation}`,
      `Anime Framing & SFX: ${profile.anime_visual_language.cinematic_framing} | SFX: ${profile.anime_visual_language.sound_effect_treatment}`,
      `Per-Clip Retrieved Action Staging:`,
      ...perClipNotes,
    ].join("\n");
  }
}
