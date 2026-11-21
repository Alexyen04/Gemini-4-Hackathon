import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { StorageService } from "@/lib/storage/storage-service";
import { NormalizedReferencePage } from "./chapter-processor";
import { ReferenceTag } from "./style-profile";

export interface ExtractedReferencePanel {
  panelItemId: string;
  chapterId: string;
  pageId: string;
  panelIndex: number;
  internalCropPath: string;
  width: number;
  height: number;
  aspectRatio: number;
  areaFraction: number;
  inkRatio: number;
  edgeDensity: number;
  heuristicTags: ReferenceTag[];
}

interface Interval {
  start: number;
  end: number;
}

function findNonGutterIntervals(
  gutterMask: boolean[],
  minSpanPx: number
): Interval[] {
  const intervals: Interval[] = [];
  let inPanel = false;
  let segStart = 0;

  for (let i = 0; i < gutterMask.length; i++) {
    if (!gutterMask[i] && !inPanel) {
      inPanel = true;
      segStart = i;
    } else if (gutterMask[i] && inPanel) {
      inPanel = false;
      if (i - segStart >= minSpanPx) {
        intervals.push({ start: segStart, end: i - 1 });
      }
    }
  }
  if (inPanel && gutterMask.length - segStart >= minSpanPx) {
    intervals.push({ start: segStart, end: gutterMask.length - 1 });
  }
  return intervals;
}

/**
 * PanelExtractor uses Japanese manga *koma* gutter channel detection:
 * A true horizontal or vertical gutter is an unbroken paper/bleed channel
 * containing zero black panel-frame crossings (`v < 110`), whereas white
 * negative space inside a panel is bounded by the panel's own ink frame!
 */
export class PanelExtractor {
  static getPanelsCacheDir(): string {
    return path.join(
      StorageService.getBaseDir(),
      "reference_cache",
      "panels"
    );
  }

  static async extractPanelsFromPage(
    page: NormalizedReferencePage,
    fingerprintPrefix: string
  ): Promise<ExtractedReferencePanel[]> {
    try {
      const analysisW = 400;
      const scale = analysisW / page.width;
      const analysisH = Math.max(140, Math.round(page.height * scale));

      const { data, info } = await sharp(page.normalizedImagePath)
        .greyscale()
        .resize(analysisW, analysisH, { fit: "fill" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const w = info.width;
      const h = info.height;

      // 1. Detect horizontal gutters: unbroken paper channel with zero frame-ink crossings
      const xMargin = Math.floor(w * 0.02);
      const rowIsGutter = new Array<boolean>(h).fill(false);
      for (let y = 0; y < h; y++) {
        let inkPixels = 0;
        let brightPaperPixels = 0;
        const span = Math.max(1, w - xMargin * 2);
        for (let x = xMargin; x < w - xMargin; x++) {
          const v = data[y * w + x];
          if (v < 120) inkPixels++;
          if (v >= 225) brightPaperPixels++;
        }
        rowIsGutter[y] =
          (inkPixels === 0 && brightPaperPixels / span >= 0.94) ||
          inkPixels / span >= 0.98;
      }

      const rowBands = findNonGutterIntervals(
        rowIsGutter,
        Math.floor(h * 0.1)
      );

      const candidateBoxes: Array<{
        x0: number;
        y0: number;
        x1: number;
        y1: number;
      }> = [];

      // 2. Within each horizontal tier (inclusive of top & bottom panel borders!),
      // detect vertical gutters that have zero black border crossings across the tier
      for (const rb of rowBands) {
        const bandHeight = rb.end - rb.start + 1;
        const colIsGutter = new Array<boolean>(w).fill(false);
        for (let x = 0; x < w; x++) {
          let inkPixels = 0;
          let brightPaperPixels = 0;
          for (let y = rb.start; y <= rb.end; y++) {
            const v = data[y * w + x];
            if (v < 120) inkPixels++;
            if (v >= 225) brightPaperPixels++;
          }
          colIsGutter[x] =
            inkPixels === 0 && brightPaperPixels / bandHeight >= 0.94;
        }

        const colBands = findNonGutterIntervals(
          colIsGutter,
          Math.floor(w * 0.14)
        );
        for (const cb of colBands) {
          candidateBoxes.push({
            x0: cb.start / w,
            y0: rb.start / h,
            x1: (cb.end + 1) / w,
            y1: (rb.end + 1) / h,
          });
        }
      }

      const validBoxes = candidateBoxes
        .filter((b) => (b.x1 - b.x0) * (b.y1 - b.y0) >= 0.06)
        .sort((a, b) => {
          if (Math.abs(a.y0 - b.y0) > 0.06) return a.y0 - b.y0;
          return b.x0 - a.x0;
        })
        .slice(0, 6);

      if (validBoxes.length === 0) {
        validBoxes.push({ x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.98 });
      }

      const outDir = path.join(
        this.getPanelsCacheDir(),
        fingerprintPrefix.slice(0, 12),
        page.chapterId
      );
      await fs.mkdir(outDir, { recursive: true });

      const extracted: ExtractedReferencePanel[] = [];

      for (let idx = 0; idx < validBoxes.length; idx++) {
        const box = validBoxes[idx];
        const left = Math.max(0, Math.round(box.x0 * page.width));
        const top = Math.max(0, Math.round(box.y0 * page.height));
        const cropW = Math.max(
          48,
          Math.min(
            page.width - left,
            Math.round((box.x1 - box.x0) * page.width)
          )
        );
        const cropH = Math.max(
          48,
          Math.min(
            page.height - top,
            Math.round((box.y1 - box.y0) * page.height)
          )
        );

        const panelItemId = `${page.pageId}_pan${String(idx + 1).padStart(
          2,
          "0"
        )}`;
        const cropPath = path.join(outDir, `${panelItemId}.png`);

        await sharp(page.normalizedImagePath)
          .extract({ left, top, width: cropW, height: cropH })
          .png({ compressionLevel: 6 })
          .toFile(cropPath);

        const areaFraction = Number(
          ((cropW * cropH) / (page.width * page.height)).toFixed(3)
        );
        const aspectRatio = Number((cropW / cropH).toFixed(3));

        const tags: ReferenceTag[] = [];
        if (areaFraction >= 0.72) tags.push("dramatic_splash");
        if (areaFraction <= 0.22) tags.push("closeup");
        if (page.edgeDensity >= 0.2) tags.push("speed_lines");
        if (page.inkRatio >= 0.34) tags.push("impact_lines");
        if (aspectRatio >= 1.75) tags.push("sprint_fastbreak");
        if (aspectRatio <= 0.65 && areaFraction >= 0.28) tags.push("low_angle");

        extracted.push({
          panelItemId,
          chapterId: page.chapterId,
          pageId: page.pageId,
          panelIndex: idx + 1,
          internalCropPath: cropPath,
          width: cropW,
          height: cropH,
          aspectRatio,
          areaFraction,
          inkRatio: page.inkRatio,
          edgeDensity: page.edgeDensity,
          heuristicTags: tags.length > 0 ? tags : ["determination"],
        });
      }

      return extracted;
    } catch {
      return [];
    }
  }
}
