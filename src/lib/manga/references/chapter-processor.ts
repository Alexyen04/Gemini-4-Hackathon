import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { StorageService } from "@/lib/storage/storage-service";
import { DiscoveredReferencePage } from "./reference-loader";

export interface NormalizedReferencePage extends DiscoveredReferencePage {
  normalizedImagePath: string;
  width: number;
  height: number;
  inkRatio: number;
  edgeDensity: number;
}

export class ChapterProcessor {
  static getNormalizedCacheDir(): string {
    return path.join(
      StorageService.getBaseDir(),
      "reference_cache",
      "normalized"
    );
  }

  /**
   * Normalizes a discovered manga reference page image into a clean max-1400px
   * PNG and computes visual ink/contour density statistics.
   */
  static async processPage(
    page: DiscoveredReferencePage,
    fingerprintPrefix: string
  ): Promise<NormalizedReferencePage | null> {
    try {
      const outDir = path.join(
        this.getNormalizedCacheDir(),
        fingerprintPrefix.slice(0, 12),
        page.chapterId
      );
      await fs.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `${page.pageId}.png`);

      const alreadyExists = await fs
        .stat(outPath)
        .then(() => true)
        .catch(() => false);

      if (!alreadyExists) {
        await sharp(page.resolvedImagePath)
          .rotate()
          .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
          .png({ compressionLevel: 6 })
          .toFile(outPath);
      }

      const meta = await sharp(outPath).metadata();
      const { data, info } = await sharp(outPath)
        .greyscale()
        .resize(200, 280, { fit: "inside" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      let darkCount = 0;
      let edgeSum = 0;
      const total = info.width * info.height;

      for (let y = 1; y < info.height - 1; y++) {
        for (let x = 1; x < info.width - 1; x++) {
          const idx = y * info.width + x;
          if (data[idx] < 115) darkCount++;
          const gx = Math.abs(data[idx + 1] - data[idx - 1]);
          const gy = Math.abs(data[idx + info.width] - data[idx - info.width]);
          if (gx + gy > 65) edgeSum++;
        }
      }

      return {
        ...page,
        normalizedImagePath: outPath,
        width: meta.width || 1000,
        height: meta.height || 1400,
        inkRatio: Number((darkCount / Math.max(1, total)).toFixed(4)),
        edgeDensity: Number((edgeSum / Math.max(1, total)).toFixed(4)),
      };
    } catch {
      return null;
    }
  }
}
