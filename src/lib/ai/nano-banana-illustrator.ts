import fs from "fs/promises";
import sharp from "sharp";
import {
  ActionIntensity,
  CarbonIllustrationSpec,
  CharacterReference,
  ColorTreatment,
  MangaPanel,
  MangaStylePreset,
} from "@/types/manga";
import { getConfiguredApiKey } from "./gemini-client";

const NANO_BANANA_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
const INTERACTIONS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

function resolveStyleDirection(style: MangaStylePreset): string {
  switch (style) {
    case "authentic_sports_manga":
      return (
        "Authentic Japanese sports manga ink style (Slam Dunk / REAL): crisp variable-weight " +
        "G-pen linework, clean anatomical silhouettes, restrained fine halftone shading, " +
        "pure white negative space, and bold sumi-ink blacks reserved strictly for foreground hair, shadows, and key jersey accents."
      );
    case "cinematic_anime_drama":
      return (
        "Refined cinematic sports anime / manga drama style (The First Slam Dunk / prestige sports OVA): " +
        "clean fine ink contours, atmospheric lighting, controlled multi-band cel shading, " +
        "expansive quiet negative space, and emotionally expressive anime facial planes."
      );
    case "hyperkinetic_shonen_anime":
    default:
      return (
        "High-energy modern shonen sports anime/manga style (Kuroko's Basketball / Shonen Jump): " +
        "sharp expressive anime eyes and facial linework, dynamic brush ink contours, " +
        "clean cel/tone separation, dramatic figure-ground contrast, and purposeful kinetic energy around the action."
      );
  }
}

function resolveColorDirection(colorTreatment: ColorTreatment): string {
  switch (colorTreatment) {
    case "full_anime_color":
      return "Full vibrant cel-shaded anime color palette with crisp black ink linework and clean lighting planes.";
    case "selective_color":
      return "High-contrast black-and-white Japanese manga ink & subtle screentone with selective vivid color accents only on the basketball, rim, or key jersey trim.";
    case "traditional_monochrome":
    default:
      return "Pure black-and-white Japanese manga ink on clean white paper—crisp black linework, clean white skin and highlight planes, and subtle fine screentones only where needed for depth (never coarse halftone dots over faces).";
  }
}

function resolveBackgroundDirection(
  backgroundMode: CarbonIllustrationSpec["backgroundMode"],
  actionIntensity: ActionIntensity
): string {
  const energyNote =
    actionIntensity === "explosive"
      ? "Use bold radiating manga speed lines strictly around the outer edges, keeping the athletes' faces and bodies completely clean and unobstructed."
      : actionIntensity === "grounded"
      ? "Keep motion lines minimal and restrained; let clean composition and negative space carry the tension."
      : "Use purposeful, clean directional energy lines only in the background periphery, never cutting across faces.";

  switch (backgroundMode) {
    case "stark_white_tension":
      return `Drop the arena crowd and distracting background clutter into clean stark white negative space with minimal court/rim linework so the foreground athletes command 100% of the contrast. ${energyNote}`;
    case "speed_void":
      return `Replace busy spectators and stadium signage with a clean manga speed-line backdrop radiating outward from behind the foreground action, keeping faces and silhouettes crisp. ${energyNote}`;
    case "dark_pressure":
      return `Abstract the stadium background into a clean, atmospheric dark-ink pressure wash with subtle rim backlighting so the foreground athletes pop sharply off the page. ${energyNote}`;
    case "arena_simplified":
    default:
      return `Dramatically simplify any arena crowd, seats, and signage into very light, low-contrast abstract line suggestions or soft white fade-outs—never render noisy pixel-level crowd clutter—so foreground players have unmistakable figure-ground contrast. ${energyNote}`;
  }
}

function pickClosestAspectRatio(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  const candidates: Array<{ label: string; value: number }> = [
    { label: "16:9", value: 16 / 9 },
    { label: "4:3", value: 4 / 3 },
    { label: "1:1", value: 1.0 },
    { label: "3:4", value: 3 / 4 },
    { label: "9:16", value: 9 / 16 },
  ];
  return candidates.sort(
    (a, b) => Math.abs(a.value - ratio) - Math.abs(b.value - ratio)
  )[0].label;
}

function extractImageBase64FromInteraction(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  const direct = obj.output_image as Record<string, unknown> | undefined;
  if (direct && typeof direct.data === "string" && direct.data.length > 0) {
    return direct.data;
  }

  const steps = obj.steps as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(steps)) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const content = steps[i]?.content as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(content)) continue;
      for (let j = content.length - 1; j >= 0; j--) {
        const part = content[j];
        if (
          part?.type === "image" &&
          typeof part.data === "string" &&
          part.data.length > 0
        ) {
          return part.data;
        }
      }
    }
  }

  return null;
}

export class NanoBananaMangaIllustrator {
  /**
   * Pre-crops the verified real basketball keyframe to the panel's framing
   * and redraws it into authentic anime/manga artwork using `gemini-nano-banana-2.1`
   * via the Gemini Interactions API.
   */
  static async renderMangaPanelImage(params: {
    sourceImagePath: string;
    targetWidth: number;
    targetHeight: number;
    panel: MangaPanel;
    style: MangaStylePreset;
    spec: CarbonIllustrationSpec;
    colorTreatment: ColorTreatment;
    actionIntensity: ActionIntensity;
    characters?: CharacterReference[];
  }): Promise<Buffer | null> {
    const apiKey = getConfiguredApiKey();
    if (!apiKey) return null;

    const {
      sourceImagePath,
      targetWidth,
      targetHeight,
      panel,
      style,
      spec,
      colorTreatment,
      actionIntensity,
      characters = [],
    } = params;

    // 1. Crop the real source frame cleanly around Carbon's focal point so Nano Banana
    // receives the exact framing & subject scale without broadcast border clutter.
    const meta = await sharp(sourceImagePath).metadata();
    const srcW = meta.width || 1280;
    const srcH = meta.height || 720;
    const zoom = Math.min(2.0, Math.max(1.0, spec.zoomFactor || 1.1));
    const targetAspect = targetWidth / Math.max(1, targetHeight);

    let cropW = Math.round(srcW / zoom);
    let cropH = Math.round(cropW / targetAspect);
    if (cropH > srcH / zoom) {
      cropH = Math.round(srcH / zoom);
      cropW = Math.round(cropH * targetAspect);
    }
    cropW = Math.max(120, Math.min(srcW, cropW));
    cropH = Math.max(120, Math.min(srcH, cropH));

    const centerX = Math.round((spec.focalX ?? 0.5) * srcW);
    const centerY = Math.round((spec.focalY ?? 0.45) * srcH);
    const left = Math.max(0, Math.min(srcW - cropW, Math.round(centerX - cropW / 2)));
    const top = Math.max(0, Math.min(srcH - cropH, Math.round(centerY - cropH / 2)));

    const croppedJpeg = await sharp(sourceImagePath)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(Math.min(768, Math.max(448, targetWidth)), null, {
        withoutEnlargement: false,
      })
      .jpeg({ quality: 84 })
      .toBuffer();

    const base64Frame = croppedJpeg.toString("base64");
    const aspectRatio = pickClosestAspectRatio(targetWidth, targetHeight);

    const activeCharacters =
      panel.characterIds.length > 0
        ? characters.filter((c) => panel.characterIds.includes(c.characterId))
        : characters.slice(0, 3);

    const characterSheetBlock =
      activeCharacters.length > 0
        ? [
            ``,
            `LOCKED PLAYER IDENTITY SHEET (keep each player's anime face, hairstyle, build & uniform 100% consistent across all panels):`,
            ...activeCharacters.map(
              (c) =>
                `- ${c.displayName}${c.jerseyNumber ? ` (#${c.jerseyNumber})` : ""} [${c.teamName}]: ${c.hairAndFaceTraits}; ${c.uniformDescription}${
                  c.accessories.length > 0 ? `; accessories: ${c.accessories.join(", ")}` : ""
                }.`
            ),
          ].join("\n")
        : null;

    const prompt = [
      `Transform this real basketball video frame into an authentic Japanese sports manga/anime panel illustration.`,
      ``,
      `ART STYLE: ${resolveStyleDirection(style)}`,
      `COLOR TREATMENT: ${resolveColorDirection(colorTreatment)}`,
      `BACKGROUND & CONTRAST: ${resolveBackgroundDirection(spec.backgroundMode, actionIntensity)}`,
      ``,
      `SCENE & CHARACTER DIRECTION:`,
      `- Camera & Mood: ${panel.cameraShot.replace(/_/g, " ")} | Emotion: ${panel.emotion} | Beat: ${panel.narrativeBeat}`,
      `- Scene Beat Description: ${panel.description}`,
      `- Creative Direction: ${spec.artisticPrompt}`,
      spec.animeExpressionAndAnatomyNotes
        ? `- Expression & Anatomy: ${spec.animeExpressionAndAnatomyNotes}`
        : null,
      characterSheetBlock,
      ``,
      `ESSENTIAL CRAFT & FIDELITY RULES:`,
      `1. Translate the real athletes into cohesive, hand-drawn anime/manga characters (clean stylized facial planes, expressive eyes, crisp hair & jersey linework—NOT a raw photographic halftone filter) while preserving their exact identity from the sheet above, recognizable likeness, pose, jersey numbers, team uniform contrast, and basketball position.`,
      `2. Eliminate visual noise: strip out TV broadcast scorebugs, network watermarks, and cluttered spectator static so foreground athletes read cleanly at a glance.`,
      `3. Output PURE ILLUSTRATION ONLY: do NOT draw speech bubbles, caption boxes, panel borders, or sound-effect text (lettering is composited separately).`,
    ]
      .filter(Boolean)
      .join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000);

    try {
      const res = await fetch(INTERACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20",
        },
        body: JSON.stringify({
          model: NANO_BANANA_MODEL,
          input: [
            { type: "text", text: prompt },
            {
              type: "image",
              mime_type: "image/jpeg",
              data: base64Frame,
            },
          ],
          response_format: {
            type: "image",
            aspect_ratio: aspectRatio,
          },
          store: false,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.warn(
          `[NanoBananaMangaIllustrator] HTTP ${res.status} for panel ${panel.panelId}: ${errBody.slice(
            0,
            240
          )}`
        );
        return null;
      }

      const json = (await res.json()) as unknown;
      const b64Out = extractImageBase64FromInteraction(json);
      if (!b64Out) {
        console.warn(
          `[NanoBananaMangaIllustrator] No image returned for panel ${panel.panelId}; falling back to local rasterizer.`
        );
        return null;
      }

      const rawImgBuf = Buffer.from(b64Out, "base64");
      // Fit cleanly to exact panel pixel dimensions
      return await sharp(rawImgBuf)
        .resize(targetWidth, targetHeight, { fit: "cover", position: "attention" })
        .png({ compressionLevel: 6 })
        .toBuffer();
    } catch (err) {
      console.warn(
        `[NanoBananaMangaIllustrator] Failed for panel ${panel.panelId} (${
          err instanceof Error ? err.message : String(err)
        }); falling back to local rasterizer.`
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
