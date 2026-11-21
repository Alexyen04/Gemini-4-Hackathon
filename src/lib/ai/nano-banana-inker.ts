import fs from "fs/promises";
import sharp from "sharp";
import { z } from "zod";
import type { ColorTreatment } from "@/types/manga";
import { GeminiClientService } from "./gemini-client";

/**
 * Final drawing step: gemini-nano-banana-2.1 redraws the REAL keyframe as manga art,
 * then gemini-4-hydrogen checks the redraw still shows the same play (AGENTS.md fidelity gate).
 * Returns null on any failure or a failed check → caller falls back to the local ink filter.
 */

export const NANO_BANANA_MODEL = process.env.GEMINI_MODEL_NANO_BANANA || "gemini-nano-banana-2.1";

export function nanoBananaEnabled(): boolean {
  return process.env.NANO_BANANA !== "off";
}

const FidelityCheckSchema = z.object({
  same_play: z.boolean(),
  same_player_count: z.boolean(),
  same_jersey_numbers: z.boolean(),
  notes: z.string(),
});

const COLOR_DIRECTION: Record<ColorTreatment, string> = {
  traditional_monochrome: "black-and-white Japanese sports manga: G-pen ink linework, screentone halftone shading, high contrast",
  full_anime_color: "full-color anime key frame: clean cel shading with crisp ink contours",
  selective_color:
    "black-and-white sports manga with screentones, keeping ONLY the basketball orange and jersey accent colors",
};

async function redraw(keyframePath: string, panelPrompt: string, color: ColorTreatment): Promise<Buffer | null> {
  const ai = GeminiClientService.getClient();
  const data = (await fs.readFile(keyframePath)).toString("base64");
  const res = await ai.models.generateContent({
    model: NANO_BANANA_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data } },
          {
            text: `Redraw this exact basketball video frame as a ${COLOR_DIRECTION[color]} panel.
Keep every player, their positions and poses, the ball, and jersey numbers exactly where they are. Do not add or remove people or objects.
Dramatize only the rendering (linework, shading, energy). No text, no speech bubbles, no sound effects, no logos.
Panel direction: ${panelPrompt.slice(0, 600)}`,
          },
        ],
      },
    ],
    config: { responseModalities: ["IMAGE"] },
  });
  const img = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  return img?.inlineData?.data ? Buffer.from(img.inlineData.data, "base64") : null;
}

async function passesFidelityCheck(keyframePath: string, drawn: Buffer): Promise<{ ok: boolean; notes: string }> {
  const { data } = await GeminiClientService.generateStructuredJson({
    role: "hydrogen",
    systemInstruction:
      "You verify that a manga redraw depicts the same real basketball moment as its source video frame. Artistic style changes are expected and fine; changed facts are not.",
    contents: [
      "SOURCE FRAME:",
      await GeminiClientService.imagePathToInlinePart(keyframePath, "image/png"),
      "MANGA REDRAW:",
      { inlineData: { mimeType: "image/png", data: drawn.toString("base64") } },
      "Compare them. same_play: same action/moment and ball location. same_player_count: same number of visible players. same_jersey_numbers: no readable jersey number was changed (unreadable in either = true).",
    ],
    zodSchema: FidelityCheckSchema,
    thinkingLevel: "LOW",
    temperature: 0,
    maxRetries: 1,
  });
  return { ok: data.same_play && data.same_player_count && data.same_jersey_numbers, notes: data.notes };
}

export async function inkPanelWithNanoBanana(params: {
  keyframePath: string;
  panelPrompt: string;
  colorTreatment: ColorTreatment;
  width: number;
  height: number;
  panelId: string;
}): Promise<Buffer | null> {
  const { keyframePath, panelPrompt, colorTreatment, width, height, panelId } = params;
  try {
    const drawnRaw = await redraw(keyframePath, panelPrompt, colorTreatment);
    if (!drawnRaw) {
      console.warn(`[nano-banana] ${panelId}: no image returned; using local ink filter`);
      return null;
    }
    const drawn = await sharp(drawnRaw).png().toBuffer();
    const check = await passesFidelityCheck(keyframePath, drawn);
    if (!check.ok) {
      console.warn(`[nano-banana] ${panelId}: failed fidelity check (${check.notes}); using local ink filter`);
      return null;
    }
    return await sharp(drawn).resize(width, height, { fit: "cover", position: "attention" }).png().toBuffer();
  } catch (err) {
    console.warn(`[nano-banana] ${panelId}: ${err instanceof Error ? err.message : err}; using local ink filter`);
    return null;
  }
}
