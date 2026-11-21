import { Part } from "@google/genai";
import {
  ClipEventAnalysis,
  ClipEventAnalysisSchema,
  NormalizedClip,
} from "@/types/manga";
import {
  GeminiClientService,
  mapWithConcurrency,
} from "./gemini-client";

const CLIP_UNDERSTANDING_SYSTEM_PROMPT = `You are Agent 1: the Basketball Clip Understanding Agent powered by Gemini 4 Argon.
Your sole responsibility is accurate, grounded multimodal analysis of NBA/basketball video highlights and keyframes.

CRITICAL FACTUALITY RULES:
1. Do NOT invent facts, player names, or jersey numbers that are neither visible in the video/keyframes nor provided in user metadata.
2. If a player's exact identity is uncertain, label them descriptively (e.g., "#23 Wing Scorer" or "Perimeter Defender") and record the ambiguity in "uncertainties".
3. Do NOT assume a shot went in merely because a player shoots. Inspect the rim/net frames and provided metadata to set "outcomeVerified" accurately.
4. Map every "bestMoments" entry to one of the exact provided keyframe IDs ("nearestFrameId") and valid clip-local timestamps within [0, durationSec].
5. Do NOT generate manga artwork or fictional quotes. Provide rich visual grounding for the downstream Manga Director.`;

export class ClipUnderstandingAgent {
  static async analyzeClips(
    clips: NormalizedClip[]
  ): Promise<ClipEventAnalysis[]> {
    const concurrency = Number(process.env.MANGA_CLIP_CONCURRENCY || 8);
    return mapWithConcurrency(clips, concurrency, (clip) =>
      this.analyzeSingleClip(clip)
    );
  }

  static async analyzeSingleClip(
    clip: NormalizedClip
  ): Promise<ClipEventAnalysis> {
    const parts: Array<Part | string> = [];

    // Attach extracted representative keyframes directly (skips slow Files API video upload/polling)
    const keyframeParts = await Promise.all(
      clip.keyframes.slice(0, 5).map(async (kf) => ({
        kf,
        imgPart: await GeminiClientService.imagePathToInlinePart(
          kf.filePath,
          "image/png"
        ),
      }))
    );

    for (const { kf, imgPart } of keyframeParts) {
      parts.push(
        `Keyframe ID: ${kf.frameId} | Clip-Local Timestamp: ${kf.timestampSec}s`
      );
      parts.push(imgPart);
    }

    const promptText = `Analyze basketball highlight clip "${clip.clipId}" ("${
      clip.title
    }").
Clip Duration: ${clip.durationSec}s
Available Keyframe IDs: ${clip.keyframes
      .map((k) => `${k.frameId} (${k.timestampSec}s)`)
      .join(", ")}
Provided Game Context Metadata (optional): ${JSON.stringify(
      clip.metadata,
      null,
      2
    )}

Return a JSON object strictly matching this structure:
{
  "clipId": "${clip.clipId}",
  "eventType": "dunk" | "three_pointer" | "midrange_jumper" | "layup_drive" | "block" | "steal_fastbreak" | "clutch_game_winner" | "assist_playmaking" | "rebound_putback" | "defensive_stop" | "other_highlight",
  "actionSummary": "Concise factual summary of the play",
  "actionSequence": ["step 1...", "step 2..."],
  "offensiveTeam": "string or null",
  "defensiveTeam": "string or null",
  "outcomeVerified": "scored_basket" | "missed_shot" | "defensive_block_stop" | "turnover_steal" | "uncertain_outcome",
  "pointsScored": 0 | 1 | 2 | 3 | null,
  "mainPlayers": [
    {
      "nameOrLabel": "string",
      "jerseyNumber": "string or null",
      "team": "string or null",
      "role": "offense_primary" | "offense_support" | "defender" | "unknown",
      "visualTraits": "Uniform color/contrast, hair silhouette, accessories, shooting hand",
      "confidence": 0.0 to 1.0
    }
  ],
  "significantReactions": ["crowd/player reaction details"],
  "gameContextSummary": "Quarter, clock, score pressure, and momentum relevance",
  "emotionalIntensity": 1 to 10,
  "narrativeSignificance": "low" | "medium" | "high" | "climax",
  "narrativeRelevanceExplanation": "Why this play matters to the game story",
  "bestMoments": [
    {
      "timestampSec": number,
      "nearestFrameId": "must match one of the Available Keyframe IDs",
      "momentRole": "setup" | "anticipation" | "peak_action" | "aftermath",
      "visualReason": "Why this angle/pose makes a strong manga panel"
    }
  ],
  "supportingEvidence": ["Visual and metadata observations verifying the play"],
  "uncertainties": ["Any ambiguous details"],
  "confidence": 0.0 to 1.0
}`;

    parts.push(promptText);

    const { data } = await GeminiClientService.generateStructuredJson({
      role: "hydrogen",
      systemInstruction: CLIP_UNDERSTANDING_SYSTEM_PROMPT,
      contents: parts,
      zodSchema: ClipEventAnalysisSchema,
      thinkingLevel: "LOW",
      temperature: 0.2,
    });

    // Guarantee clipId & valid clamped timestamps
    const validFrameIds = new Set(clip.keyframes.map((f) => f.frameId));
    const fallbackFrameId = clip.keyframes[0]?.frameId || `${clip.clipId}_f01`;

    return {
      ...data,
      clipId: clip.clipId,
      bestMoments: data.bestMoments.map((m) => ({
        ...m,
        timestampSec: Number(
          Math.min(Math.max(0.05, m.timestampSec), clip.durationSec - 0.05).toFixed(2)
        ),
        nearestFrameId: validFrameIds.has(m.nearestFrameId)
          ? m.nearestFrameId
          : fallbackFrameId,
      })),
    };
  }
}
