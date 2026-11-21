import {
  CarbonIllustrationSpec,
  CharacterReference,
  ClipEventAnalysis,
  LayoutTemplateId,
  MangaPage,
  MangaPanel,
  MangaPreferences,
  MangaStoryboard,
  NarrativeStage,
  NormalizedClip,
  QualityReviewReport,
  StoryNarrative,
} from "@/types/manga";
import { StoryboardValidator } from "@/lib/manga/validators";
import {
  MangaReferenceIndex,
  MangaVisualStyleProfile,
} from "@/lib/manga/references/style-profile";
import { ReferenceRetrievalService } from "@/lib/manga/references/reference-retrieval";

/**
 * Development Demo Mode Synthesizer.
 * Used ONLY when `mode === "demo"`. Explicitly labeled and integrates with the
 * real Stage 0 `MangaVisualStyleProfile` + `ReferenceRetrievalService` + local
 * FFmpeg/Sharp/SVG rendering pipeline.
 */
export class DemoPipelineSynthesizer {
  static buildDemoClipAnalyses(clips: NormalizedClip[]): ClipEventAnalysis[] {
    return clips.map((clip, idx) => {
      const desc = (
        clip.metadata.eventDescription ||
        clip.title ||
        "Basketball highlight sequence"
      ).toLowerCase();

      const isDunk = desc.includes("dunk") || desc.includes("tomahawk");
      const isThree = desc.includes("three") || desc.includes("3");
      const isBlock = desc.includes("block") || desc.includes("pin");
      const isSteal = desc.includes("steal") || desc.includes("tie");
      const isBuzzer =
        desc.includes("buzzer") ||
        desc.includes("winner") ||
        desc.includes("fadeaway") ||
        idx === clips.length - 1;

      const eventType: ClipEventAnalysis["eventType"] = isBuzzer
        ? "clutch_game_winner"
        : isDunk
        ? "dunk"
        : isBlock
        ? "block"
        : isThree
        ? "three_pointer"
        : isSteal
        ? "steal_fastbreak"
        : "layup_drive";

      const kfs = clip.keyframes;
      const setupKf = kfs[0];
      const midKf = kfs[Math.floor(kfs.length / 2)] || kfs[0];
      const peakKf =
        kfs[Math.min(kfs.length - 1, Math.floor(kfs.length * 0.72))] || midKf;

      const home = clip.metadata.homeTeam || "Crimson Vipers";
      const away = clip.metadata.awayTeam || "Harbor Titans";
      const awayAttacking = isThree && !isBuzzer;

      return {
        clipId: clip.clipId,
        eventType,
        actionSummary:
          clip.metadata.eventDescription ||
          `${clip.title} (${clip.durationSec.toFixed(1)}s highlight clip)`,
        actionSequence: [
          `Ballhandler initiates action at ${setupKf?.timestampSec ?? 0.2}s`,
          `Primary athletic elevation / contest around ${midKf?.timestampSec ?? 1.2}s`,
          `Play culmination near rim at ${peakKf?.timestampSec ?? 2.1}s`,
        ],
        offensiveTeam: awayAttacking ? away : home,
        defensiveTeam: awayAttacking ? home : away,
        outcomeVerified: isBlock ? "defensive_block_stop" : "scored_basket",
        pointsScored: isBlock ? 0 : isThree ? 3 : 2,
        mainPlayers:
          clip.metadata.players.length > 0
            ? clip.metadata.players.map((pStr, pIdx) => {
                const numMatch = pStr.match(/#(\d+)/);
                const nameClean = pStr.split("(")[0].trim();
                return {
                  nameOrLabel: nameClean || `Player ${pIdx + 1}`,
                  jerseyNumber: numMatch ? numMatch[1] : null,
                  team: pStr
                    .toLowerCase()
                    .includes(away.toLowerCase().split(" ")[1] || "titans")
                    ? away
                    : home,
                  role: pIdx === 0 ? "offense_primary" : "defender",
                  visualTraits:
                    numMatch?.[1] === "23"
                      ? "Cropped fade, headband, explosive right-handed elevation"
                      : "Sharp athletic build, competitive defensive stance",
                  confidence: 0.94,
                };
              })
            : [
                {
                  nameOrLabel: "#23 Lead Scorer",
                  jerseyNumber: "23",
                  team: home,
                  role: "offense_primary",
                  visualTraits: "Athletic wing build, crisp jersey contrast",
                  confidence: 0.82,
                },
              ],
        significantReactions: [
          isBuzzer
            ? "Arena erupts as backboard LED glows at final horn"
            : "Intense court energy and bench reaction",
        ],
        gameContextSummary:
          `${clip.metadata.quarter || "Q4"} ${clip.metadata.gameClock || ""} ${
            clip.metadata.score || ""
          }`.trim() || "High-stakes fourth quarter stretch",
        emotionalIntensity: isBuzzer ? 10 : isBlock || isDunk ? 9 : 8,
        narrativeSignificance:
          idx === clips.length - 1
            ? "climax"
            : idx >= clips.length - 2
            ? "high"
            : "medium",
        narrativeRelevanceExplanation:
          idx === 0
            ? "Sets physical tone and establishes star matchup"
            : idx === clips.length - 1
            ? "Decisive final possession determining the game outcome"
            : "Critical momentum swing heightening fourth-quarter pressure",
        bestMoments: [
          {
            timestampSec: setupKf?.timestampSec ?? 0.25,
            nearestFrameId: setupKf?.frameId ?? `${clip.clipId}_f01`,
            momentRole: "setup",
            visualReason: "Clear spacing and gather posture",
          },
          {
            timestampSec: midKf?.timestampSec ?? 1.4,
            nearestFrameId: midKf?.frameId ?? `${clip.clipId}_f02`,
            momentRole: "anticipation",
            visualReason: "Peak separation and defender contest",
          },
          {
            timestampSec: peakKf?.timestampSec ?? 2.3,
            nearestFrameId: peakKf?.frameId ?? `${clip.clipId}_f04`,
            momentRole: "peak_action",
            visualReason: "Maximum rim/ball drama for large manga panel",
          },
        ],
        supportingEvidence: [
          "[DEMO MODE] Derived from clip metadata & extracted FFmpeg keyframes",
        ],
        uncertainties: [],
        confidence: 0.92,
      };
    });
  }

  static buildDemoNarrative(
    clips: NormalizedClip[],
    analyses: ClipEventAnalysis[],
    preferences?: MangaPreferences
  ): StoryNarrative {
    const climaxClip = clips[clips.length - 1];
    const home = clips[0]?.metadata.homeTeam || "Crimson Vipers";
    const away = clips[0]?.metadata.awayTeam || "Harbor Titans";

    const stages: NarrativeStage[] = [
      "introduction",
      "rising_action",
      "conflict",
      "climax",
      "resolution",
    ];

    const focusTag =
      preferences?.storytellingFocus === "emotion_focused"
        ? "inner resolve and unshakable eye-contact tension"
        : preferences?.storytellingFocus === "action_focused"
        ? "explosive rim-rocking athleticism and relentless pace"
        : "relentless rim protection and clutch shot-making";

    return {
      title: "THE FINAL POSSESSION",
      subtitle: `Chapter 1 — ${home} vs. ${away} (Demo Storyline)`,
      summary: `Trading heavy blows down the stretch, ${home} rally from a fourth-quarter deficit through ${focusTag}, setting up one breathless final shot before the horn.`,
      protagonistFocus: `${home} perimeter ace #23 and defensive anchor #7`,
      centralConflict: `${away}'s perimeter sharpshooting pushes ${home} to the brink in the final minutes.`,
      stakesAndSetting:
        "Packed arena under fourth-quarter pressure with every possession swinging momentum.",
      emotionalProgression: [
        "Explosive confidence in transition",
        "Mounting pressure after opponent counter-punch",
        "Gritty defensive defiance at the rim",
        "Razor-sharp silence as the final jumper hangs in midair",
        "Cathartic triumph at the buzzer",
      ],
      climaxClipId: climaxClip.clipId,
      climaxExplanation:
        "The final highlight encapsulates the decisive possession where separation, elevation, and release decide the game.",
      resolutionSummary: `Verified finish from ${climaxClip.title}: ${
        climaxClip.metadata.score || "Clutch victory sealed at the horn."
      }`,
      chapters: [
        {
          chapterId: "ch_demo_01",
          number: 1,
          title: "Iron, Sweat & Zero Seconds",
          arcSummary:
            "From trading haymakers to a defensive stand and the game-deciding jumper.",
        },
      ],
      beats: analyses.map((a, idx) => {
        const clip = clips.find((c) => c.clipId === a.clipId) || clips[0];
        const stage =
          idx === 0
            ? "introduction"
            : idx === analyses.length - 1
            ? "climax"
            : stages[Math.min(3, idx)];
        return {
          beatId: `beat_${String(idx + 1).padStart(2, "0")}`,
          stage,
          clipId: clip.clipId,
          startTimestampSec: 0.15,
          endTimestampSec: Number(
            Math.max(0.5, clip.durationSec - 0.1).toFixed(2)
          ),
          headline: clip.title,
          storyFunction: a.narrativeRelevanceExplanation,
          emotionalTone:
            stage === "climax"
              ? "triumph"
              : stage === "conflict"
              ? "shock"
              : "determination",
          intensity: a.emotionalIntensity,
          recommendedPanelCount: idx === analyses.length - 1 ? 4 : 2,
        };
      }),
      factualGroundingNotes: [
        "[DEMO MODE] Storyline synthesized deterministically from uploaded clip sequence and metadata; switch to Real AI Mode with GEMINI_API_KEY for live Gemini 4 Carbon narrative reasoning.",
      ],
    };
  }

  static buildDemoStoryboard(params: {
    storyId: string;
    clips: NormalizedClip[];
    analyses: ClipEventAnalysis[];
    characters: CharacterReference[];
    narrative: StoryNarrative;
    preferences: MangaPreferences;
    styleProfile?: MangaVisualStyleProfile;
    referenceIndex?: MangaReferenceIndex;
  }): MangaStoryboard {
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

    const targetPages = Math.max(2, Math.min(5, preferences.targetPages));
    const isEmotionFocus = preferences.storytellingFocus === "emotion_focused";
    const isExplosive = preferences.actionIntensity === "explosive";

    interface BeatSeed {
      clip: NormalizedClip;
      analysis: ClipEventAnalysis;
      tsRatio: number;
      stage: NarrativeStage;
      beatName: string;
      shot: MangaPanel["cameraShot"];
      emotion: MangaPanel["emotion"];
      caption: string | null;
      sfx: string | null;
      sfxSub: string | null;
      bubbleText: string | null;
      bubbleType: "speech" | "shout" | "thought" | "narration" | "scoreboard";
      effects: string[];
      border: MangaPanel["borderStyle"];
    }

    const seeds: BeatSeed[] = [];
    const getClip = (idx: number) => clips[Math.min(clips.length - 1, idx)];
    const getAnalysis = (c: NormalizedClip) =>
      analyses.find((a) => a.clipId === c.clipId) || analyses[0];

    const c0 = getClip(0);
    const c1 = getClip(Math.min(1, clips.length - 1));
    seeds.push(
      {
        clip: c0,
        analysis: getAnalysis(c0),
        tsRatio: 0.18,
        stage: "introduction",
        beatName: "establishing_drive",
        shot: isEmotionFocus ? "closeup" : "wide_shot",
        emotion: "focus",
        caption: c0.metadata.score
          ? `${c0.metadata.quarter || "Q3"} ${c0.metadata.gameClock || ""} — ${
              c0.metadata.score
            }`
          : "Every possession down the stretch carries playoff weight.",
        sfx: "THUMP THUMP",
        sfxSub: null,
        bubbleText: "Push the pace—lane's wide open!",
        bubbleType: "speech",
        effects: ["speed_lines_diagonal"],
        border: "standard",
      },
      {
        clip: c0,
        analysis: getAnalysis(c0),
        tsRatio: 0.72,
        stage: "rising_action",
        beatName: "thunderous_finish",
        shot: "low_angle",
        emotion: "determination",
        caption: "Attacking the paint with zero hesitation.",
        sfx: "BOOOOM!!",
        sfxSub: null,
        bubbleText: null,
        bubbleType: "narration",
        effects: isExplosive
          ? ["radial_focus_lines", "impact_burst", "kinetic_aura"]
          : ["radial_focus_lines", "impact_burst"],
        border: "heavy_impact",
      },
      {
        clip: c1,
        analysis: getAnalysis(c1),
        tsRatio: 0.34,
        stage: "conflict",
        beatName: "counter_separation",
        shot: isEmotionFocus ? "extreme_closeup" : "closeup",
        emotion: "focus",
        caption: "But the opposition refuses to yield an inch.",
        sfx: "SKREEECH!",
        sfxSub: null,
        bubbleText: "Contest! Hand up!",
        bubbleType: "shout",
        effects: ["speed_lines_diagonal", "heavy_shadows"],
        border: "standard",
      },
      {
        clip: c1,
        analysis: getAnalysis(c1),
        tsRatio: 0.82,
        stage: "conflict",
        beatName: "dagger_response",
        shot: "behind_player",
        emotion: "shock",
        caption: c1.metadata.score || "The deficit widens—pressure peaks.",
        sfx: "SWISH!",
        sfxSub: null,
        bubbleText: "Ice-cold answer from deep...",
        bubbleType: "thought",
        effects: ["screentone_heavy"],
        border: "standard",
      }
    );

    const c2 = getClip(Math.min(2, clips.length - 1));
    const c3 = getClip(Math.min(3, clips.length - 1));
    seeds.push(
      {
        clip: c2,
        analysis: getAnalysis(c2),
        tsRatio: 0.32,
        stage: "conflict",
        beatName: "recovery_sprint",
        shot: "dutch_angle",
        emotion: "determination",
        caption: "One defensive stop separates survival from defeat.",
        sfx: "WHOOSH!",
        sfxSub: null,
        bubbleText: "Not on our floor!",
        bubbleType: "thought",
        effects: ["speed_lines_diagonal", "sweat_droplets"],
        border: "standard",
      },
      {
        clip: c2,
        analysis: getAnalysis(c2),
        tsRatio: 0.68,
        stage: "conflict",
        beatName: "rim_denial",
        shot: "low_angle",
        emotion: "determination",
        caption: null,
        sfx: "SMACK!!",
        sfxSub: null,
        bubbleText: "CLEAN BLOCK AT THE GLASS!",
        bubbleType: "shout",
        effects: ["radial_focus_lines", "impact_burst", "heavy_shadows"],
        border: "heavy_impact",
      },
      {
        clip: c3,
        analysis: getAnalysis(c3),
        tsRatio: 0.28,
        stage: "rising_action",
        beatName: "midcourt_anticipation",
        shot: "extreme_closeup",
        emotion: "focus",
        caption: "Momentum flips in a heartbeat.",
        sfx: "SKREEECH!",
        sfxSub: null,
        bubbleText: null,
        bubbleType: "narration",
        effects: ["speed_lines_diagonal"],
        border: "standard",
      },
      {
        clip: c3,
        analysis: getAnalysis(c3),
        tsRatio: 0.8,
        stage: "rising_action",
        beatName: "tying_conversion",
        shot: "dynamic_action",
        emotion: "triumph",
        caption: c3.metadata.score || "All square entering the final seconds!",
        sfx: "ROAAAAR!!",
        sfxSub: null,
        bubbleText: "TIED GAME!",
        bubbleType: "scoreboard",
        effects: ["radial_focus_lines"],
        border: "standard",
      }
    );

    const cLast = clips[clips.length - 1];
    const aLast = getAnalysis(cLast);
    seeds.push(
      {
        clip: cLast,
        analysis: aLast,
        tsRatio: 0.24,
        stage: "climax",
        beatName: "final_clock_gather",
        shot: "extreme_closeup",
        emotion: "determination",
        caption: `${
          cLast.metadata.gameClock || "00:03.4"
        } on the clock. One shot for everything.`,
        sfx: "THUMP",
        sfxSub: null,
        bubbleText: "Trust the release.",
        bubbleType: "thought",
        effects: ["heavy_shadows", "sweat_droplets"],
        border: "standard",
      },
      {
        clip: cLast,
        analysis: aLast,
        tsRatio: 0.56,
        stage: "climax",
        beatName: "airborne_separation",
        shot: "low_angle",
        emotion: "focus",
        caption: "Time slows as the ball leaves his fingertips...",
        sfx: "WHOOSH!",
        sfxSub: null,
        bubbleText: null,
        bubbleType: "narration",
        effects: ["negative_space", "speed_lines_diagonal"],
        border: "standard",
      },
      {
        clip: cLast,
        analysis: aLast,
        tsRatio: 0.88,
        stage: "resolution",
        beatName: "buzzer_beater_climax",
        shot: "dynamic_action",
        emotion: "triumph",
        caption:
          cLast.metadata.score ||
          "PURE NYLON AT THE HORN — THE COMEBACK IS COMPLETE!",
        sfx: "SWISH!!",
        sfxSub: null,
        bubbleText: "GAME OVER!!",
        bubbleType: "shout",
        effects: isExplosive
          ? ["radial_focus_lines", "impact_burst", "kinetic_aura"]
          : ["radial_focus_lines", "impact_burst"],
        border: isExplosive ? "borderless_bleed" : "heavy_impact",
      }
    );

    const pageGroups: Array<{
      template: LayoutTemplateId;
      pageType: MangaPage["pageType"];
      items: BeatSeed[];
    }> =
      targetPages === 2
        ? [
            {
              template: "balanced_five",
              pageType: "action",
              items: [seeds[0], seeds[1], seeds[3], seeds[5], seeds[7]],
            },
            {
              template: "dramatic_three",
              pageType: "dramatic",
              items: [seeds[8], seeds[9], seeds[10]],
            },
          ]
        : [
            {
              template: "balanced_four",
              pageType: "normal",
              items: seeds.slice(0, 4),
            },
            {
              template:
                preferences.storytellingFocus === "action_focused"
                  ? "hero_action_four"
                  : "balanced_four",
              pageType: "action",
              items: seeds.slice(4, 8),
            },
            {
              template: "dramatic_three",
              pageType: "dramatic",
              items: seeds.slice(8, 11),
            },
          ];

    let globalPanelCounter = 1;
    const pages: MangaPage[] = pageGroups.map((grp, pIdx) => {
      const panels: MangaPanel[] = grp.items.map((seed, slotIdx) => {
        const panelId = `panel_${String(globalPanelCounter++).padStart(
          3,
          "0"
        )}`;
        const ts = Number(
          Math.min(
            Math.max(0.08, seed.clip.durationSec * seed.tsRatio),
            seed.clip.durationSec - 0.08
          ).toFixed(2)
        );
        const nearestKf =
          seed.clip.keyframes.reduce((best, curr) =>
            Math.abs(curr.timestampSec - ts) < Math.abs(best.timestampSec - ts)
              ? curr
              : best
          ) || seed.clip.keyframes[0];

        const relChars = characters
          .filter((ch) => ch.referenceClipId === seed.clip.clipId)
          .map((ch) => ch.characterId);

        const retrieved =
          styleProfile && referenceIndex
            ? ReferenceRetrievalService.retrieveForPanel({
                profile: styleProfile,
                index: referenceIndex,
                clipAnalysis: seed.analysis,
                referenceInfluence: preferences.referenceInfluence,
              })
            : null;

        const refPromptSuffix = retrieved
          ? ` | Reference Guidance (${preferences.referenceInfluence}): ${retrieved.actionGuide.camera_angles}; ${retrieved.actionGuide.movement_effects}`
          : "";

        return {
          panelId,
          readingOrder: slotIdx + 1,
          sourceClipId: seed.clip.clipId,
          sourceTimestamp: ts,
          narrativeStage: seed.stage,
          narrativeBeat: seed.beatName,
          characterIds:
            relChars.length > 0
              ? relChars
              : characters.slice(0, 1).map((c) => c.characterId),
          cameraShot: seed.shot,
          size: slotIdx === grp.items.length - 1 ? "large" : "medium",
          layout: { x: 0, y: 0, width: 0.5, height: 0.5 },
          borderStyle: seed.border,
          description: `${seed.clip.title} (${ts}s): ${
            seed.clip.metadata.eventDescription || seed.analysis.actionSummary
          }`,
          emotion: seed.emotion,
          visualEffects: seed.effects,
          caption: seed.caption,
          sfx: seed.sfx,
          sfxSubtext: seed.sfxSub,
          dialogue: seed.bubbleText
            ? [
                {
                  id: `dlg_${panelId}`,
                  speaker:
                    seed.bubbleType === "scoreboard" ? "Arena Clock" : "Court",
                  text: seed.bubbleText,
                  bubbleType: seed.bubbleType,
                  placement:
                    preferences.readingDirection === "rtl"
                      ? "bottom_left"
                      : "bottom_right",
                },
              ]
            : [],
          illustration: {
            renderer: "hybrid",
            referenceFrameIds: nearestKf ? [nearestKf.frameId] : [],
            style: preferences.style,
            colorTreatment: preferences.colorTreatment,
            prompt: `${preferences.style.replace(/_/g, " ")} (${
              preferences.colorTreatment
            }, ${preferences.actionIntensity}) panel (${
              seed.shot
            }) at ${ts}s of ${seed.clip.title}: ${seed.effects.join(
              " + "
            )}${refPromptSuffix}`,
            assetUrl: null,
            assetFilePath: null,
            svgOverlayUrl: null,
            generationCount: 0,
          },
          interaction: {
            type: "play_source_clip",
            clipId: seed.clip.clipId,
            timestamp: ts,
            endTimestamp: Number(
              Math.min(seed.clip.durationSec, ts + 1.6).toFixed(2)
            ),
            originalGameClock: seed.clip.metadata.gameClock || null,
          },
        };
      });

      return {
        pageId: `page_${String(pIdx + 1).padStart(2, "0")}`,
        chapterId: narrative.chapters[0].chapterId,
        pageNumber: pIdx + 1,
        pageType: grp.pageType,
        layoutTemplate: grp.template,
        panels,
        compositeAssetUrl: null,
      };
    });

    const rawSb: MangaStoryboard = {
      storyId,
      title: narrative.title,
      subtitle: narrative.subtitle,
      summary: narrative.summary,
      style: preferences.style,
      readingDirection: preferences.readingDirection,
      chapters: narrative.chapters,
      pages,
      sourceClips: clips.map((c) => c.clipId),
    };

    return StoryboardValidator.normalizeAndRepairStoryboard(rawSb, clips);
  }

  static buildDemoIllustrationSpec(params: {
    panel: MangaPanel;
    preferences: MangaPreferences;
    styleProfile?: MangaVisualStyleProfile;
    referenceIndex?: MangaReferenceIndex;
    clipAnalysis?: ClipEventAnalysis;
    seedOffset?: number;
  }): CarbonIllustrationSpec {
    const {
      panel,
      preferences,
      styleProfile,
      referenceIndex,
      clipAnalysis,
      seedOffset = 0,
    } = params;

    const isCloseup =
      panel.cameraShot === "extreme_closeup" || panel.cameraShot === "closeup";
    const isRadial =
      panel.visualEffects.includes("radial_focus_lines") ||
      panel.size === "large" ||
      panel.size === "splash";
    const hasImpact = panel.visualEffects.includes("impact_burst");
    const isTension = panel.visualEffects.includes("negative_space");

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

    const focalX =
      panel.sourceTimestamp > 1.8
        ? 0.68
        : panel.sourceTimestamp < 0.7
        ? 0.45
        : 0.55;
    const focalY = isCloseup ? 0.38 : 0.46;

    const baseContrast =
      preferences.style === "hyperkinetic_shonen_anime"
        ? 0.91
        : preferences.style === "cinematic_anime_drama"
        ? 0.74
        : 0.84;

    const blendW =
      preferences.referenceInfluence === "strong"
        ? 0.6
        : preferences.referenceInfluence === "balanced"
        ? 0.35
        : 0.1;

    const inkContrast = retrieved
      ? Number(
          (
            baseContrast * (1 - blendW) +
            retrieved.recommendedInkContrast * blendW
          ).toFixed(2)
        )
      : baseContrast;

    const screentoneDensity = retrieved
      ? Number(
          (
            (preferences.style === "cinematic_anime_drama" ? 0.24 : 0.42) *
              (1 - blendW) +
            retrieved.recommendedScreentoneDensity * blendW
          ).toFixed(2)
        )
      : preferences.style === "cinematic_anime_drama"
      ? 0.24
      : 0.42;

    const speedIntensityBase =
      preferences.actionIntensity === "explosive"
        ? 0.88
        : preferences.actionIntensity === "grounded"
        ? 0.38
        : 0.64;

    const arcSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <path d="M 110 ${490 - seedOffset * 12} Q 420 ${
      140 + seedOffset * 15
    } 710 245" fill="none" stroke="#09090b" stroke-width="3.5" stroke-dasharray="18,10" opacity="0.52" />
      <path d="M 125 ${502 - seedOffset * 12} Q 425 ${
      154 + seedOffset * 15
    } 718 258" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="14,12" opacity="0.65" />
    </svg>`;

    return {
      panelId: panel.panelId,
      renderer: panel.illustration.renderer,
      colorTreatment: preferences.colorTreatment,
      focalX,
      focalY,
      zoomFactor: isCloseup
        ? 1.48 + (seedOffset % 3) * 0.08
        : 1.1 + (seedOffset % 2) * 0.08,
      dutchTiltDeg: panel.cameraShot === "dutch_angle" ? -6 : 0,
      inkContrast,
      edgeWeight:
        preferences.style === "hyperkinetic_shonen_anime"
          ? "bold_brush"
          : preferences.style === "cinematic_anime_drama"
          ? "fine"
          : "balanced",
      shadowDensity: panel.visualEffects.includes("heavy_shadows") ? 0.72 : 0.52,
      screentoneDensity,
      screentoneAngleDeg: 45,
      celShadingBands: preferences.style === "cinematic_anime_drama" ? 5 : 4,
      backgroundMode: isTension
        ? "stark_white_tension"
        : panel.visualEffects.includes("heavy_shadows")
        ? "dark_pressure"
        : "arena_simplified",
      speedLineMode: isRadial ? "radial" : "diagonal",
      speedLineIntensity: speedIntensityBase,
      impactBurst: hasImpact,
      characterPlacement:
        "Grounded directly on extracted video keyframe focal coordinates",
      poseAndActionDetails: panel.description,
      animeExpressionAndAnatomyNotes:
        styleProfile?.character_art.expressive_eyes ||
        "Expressive shonen sports focus",
      basketballPosition: "Preserved from source highlight trajectory",
      lightingDirection:
        panel.cameraShot === "low_angle" ? "low_upward" : "top_arena",
      appliedReferenceTags: retrieved ? retrieved.matchedTags : [],
      artisticPrompt: panel.illustration.prompt,
      customSvgOverlay: arcSvg,
    };
  }

  static buildDemoQualityReport(
    storyboard: MangaStoryboard,
    clips: NormalizedClip[],
    styleProfile?: MangaVisualStyleProfile
  ): QualityReviewReport {
    const validation = StoryboardValidator.validateStoryboard(storyboard, clips);
    const allPanels = storyboard.pages.flatMap((p) => p.panels);

    return {
      evaluatedByModel: "demo-structural-validator (Demo Mode — No Live AI Call)",
      evaluatedAt: new Date().toISOString(),
      overallScore: validation.valid ? 95 : 76,
      structuralPass: validation.valid,
      narrativePass: true,
      visualPass: true,
      styleProfileAlignmentPass: true,
      originalityPass: true,
      summary: `[DEMO MODE] Verified alignment with ${
        styleProfile?.profile_id || "builtin"
      } style profile, ${storyboard.readingDirection.toUpperCase()} panel geometry, artwork originality, and grounded basketball keyframe fidelity.`,
      strengths: [
        `Applied ${storyboard.style.replace(/_/g, " ")} preset and reference-guided composition rules without copying reference scans`,
        `Strict ${storyboard.readingDirection.toUpperCase()} panel sequence with zero bounding-box overlap`,
        "All panels grounded in verified basketball video keyframes and valid clip timestamps",
      ],
      warnings: [
        ...(styleProfile?.warning ? [styleProfile.warning] : []),
        ...validation.errors,
        ...validation.warnings,
      ],
      panelFeedback: allPanels.map((p) => ({
        panelId: p.panelId,
        score: 94,
        factualAlignment: true,
        characterConsistent: true,
        styleProfileAlignment: true,
        originalityPass: true,
        readabilityPass: true,
        issues: [],
        suggestedAdjustment: null,
        requiresRegeneration: false,
      })),
      regeneratedPanelIds: [],
    };
  }
}
