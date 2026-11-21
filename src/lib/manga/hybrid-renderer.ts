import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  ActionIntensity,
  CarbonIllustrationSpec,
  CharacterReference,
  ColorTreatment,
  MangaPage,
  MangaPanel,
  MangaStylePreset,
  NormalizedClip,
} from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { KeyframeExtractionService } from "@/lib/video/keyframes";
import { NanoBananaMangaIllustrator } from "@/lib/ai/nano-banana-illustrator";
import { MangaImageProcessor } from "./image-processing";
import { SVGIllustrationRenderer } from "./svg-renderer";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class HybridMangaRenderer {
  /**
   * Renders a single manga/anime panel into a viewable high-resolution PNG asset
   * using Carbon's reference-guided specification, art style preset, color
   * treatment, and action intensity.
   */
  static async renderPanelArtwork(params: {
    storyId: string;
    panel: MangaPanel;
    clip: NormalizedClip;
    style: MangaStylePreset;
    spec: CarbonIllustrationSpec;
    colorTreatment?: ColorTreatment;
    actionIntensity?: ActionIntensity;
    regenerationSeed?: number;
    useNanoBanana?: boolean;
    characters?: CharacterReference[];
  }): Promise<{
    assetFilePath: string;
    assetUrl: string;
    svgOverlayUrl: string | null;
    referenceFrameId: string;
  }> {
    const {
      storyId,
      panel,
      clip,
      style,
      spec,
      colorTreatment = spec.colorTreatment ||
        panel.illustration.colorTreatment ||
        "traditional_monochrome",
      actionIntensity = "dramatic",
      regenerationSeed = 0,
      useNanoBanana = false,
      characters = [],
    } = params;

    await StorageService.ensureDirectories();
    const storyPanelDir = path.join(StorageService.getSubDir("panels"), storyId);
    await fs.mkdir(storyPanelDir, { recursive: true });

    const pageBaseW = 820;
    const pageBaseH = 1148;
    const targetW = Math.max(
      380,
      Math.min(960, Math.round(panel.layout.width * pageBaseW))
    );
    const targetH = Math.max(
      260,
      Math.min(1148, Math.round(panel.layout.height * pageBaseH))
    );

    const keyframe =
      await KeyframeExtractionService.getOrExtractFrameAtTimestamp({
        clipId: clip.clipId,
        videoPath: clip.filePath,
        durationSec: clip.durationSec,
        timestampSec: panel.sourceTimestamp,
        existingKeyframes: clip.keyframes,
      });

    const versionSuffix =
      regenerationSeed > 0 ? `_v${regenerationSeed}` : "";
    const outPngPath = path.join(
      storyPanelDir,
      `${panel.panelId}${versionSuffix}.png`
    );
    let svgOverlayUrl: string | null = null;

    if (spec.renderer === "svg_vector") {
      const fullSvg = SVGIllustrationRenderer.buildFullVectorPanelSvg({
        width: targetW,
        height: targetH,
        spec,
        style,
        colorTreatment,
        actionIntensity,
      });
      const svgPath = path.join(
        storyPanelDir,
        `${panel.panelId}${versionSuffix}_vector.svg`
      );
      await fs.writeFile(svgPath, fullSvg, "utf-8");
      svgOverlayUrl = StorageService.toMediaUrl(svgPath);

      await sharp(Buffer.from(fullSvg))
        .png({ compressionLevel: 6 })
        .toFile(outPngPath);
    } else {
      let nanoBananaBuffer: Buffer | null = null;
      if (useNanoBanana) {
        nanoBananaBuffer =
          await NanoBananaMangaIllustrator.renderMangaPanelImage({
            sourceImagePath: keyframe.filePath,
            targetWidth: targetW,
            targetHeight: targetH,
            panel,
            style,
            spec,
            colorTreatment,
            actionIntensity,
            characters,
          });
      }

      if (nanoBananaBuffer) {
        // Nano Banana 2.1 renders native ink linework, figure-ground separation,
        // and kinetic lines directly—skip noisy SVG overlays so faces stay clean.
        await fs.writeFile(outPngPath, nanoBananaBuffer);
      } else {
        const chosenRaster = await MangaImageProcessor.stylizeKeyframeToManga({
          sourceImagePath: keyframe.filePath,
          targetWidth: targetW,
          targetHeight: targetH,
          style,
          spec,
          colorTreatment,
          actionIntensity,
        });

        if (spec.renderer === "frame_guided") {
          await fs.writeFile(outPngPath, chosenRaster.pngBuffer);
        } else {
          const overlaySvg = SVGIllustrationRenderer.buildEffectsOverlaySvg({
            width: targetW,
            height: targetH,
            spec,
            style,
            colorTreatment,
            actionIntensity,
            visualEffects: panel.visualEffects,
            seedSalt: regenerationSeed,
          });

          const svgPath = path.join(
            storyPanelDir,
            `${panel.panelId}${versionSuffix}_overlay.svg`
          );
          await fs.writeFile(svgPath, overlaySvg, "utf-8");
          svgOverlayUrl = StorageService.toMediaUrl(svgPath);

          const overlayBuffer = await sharp(Buffer.from(overlaySvg))
            .png()
            .toBuffer();

          await sharp(chosenRaster.pngBuffer)
            .composite([{ input: overlayBuffer, top: 0, left: 0 }])
            .png({ compressionLevel: 6 })
            .toFile(outPngPath);
        }
      }
    }

    return {
      assetFilePath: outPngPath,
      assetUrl: StorageService.toMediaUrl(outPngPath),
      svgOverlayUrl,
      referenceFrameId: keyframe.frameId,
    };
  }

  static async renderCompositePageExport(params: {
    storyId: string;
    storyTitle: string;
    page: MangaPage;
    readingDirection: "rtl" | "ltr";
  }): Promise<{ filePath: string; mediaUrl: string }> {
    const { storyId, storyTitle, page, readingDirection } = params;
    await StorageService.ensureDirectories();

    const pageW = 1200;
    const pageH = 1680;
    const marginX = 54;
    const marginTop = 74;
    const marginBottom = 56;
    const innerW = pageW - marginX * 2;
    const innerH = pageH - marginTop - marginBottom;

    const composites: sharp.OverlayOptions[] = [];
    const letteringSvgParts: string[] = [];

    letteringSvgParts.push(`
      <text x="${marginX}" y="46" font-family="Impact, Arial Black, sans-serif" font-size="20" letter-spacing="2" fill="#27272a">${escapeXml(
        storyTitle.toUpperCase()
      )}</text>
      <text x="${pageW - marginX}" y="46" text-anchor="end" font-family="monospace" font-size="16" fill="#52525b">PAGE ${
        page.pageNumber
      } • ${readingDirection === "rtl" ? "READ ◀ RTL" : "READ LTR ▶"}</text>
    `);

    for (const panel of page.panels) {
      const px = Math.round(marginX + panel.layout.x * innerW);
      const py = Math.round(marginTop + panel.layout.y * innerH);
      const pw = Math.max(40, Math.round(panel.layout.width * innerW));
      const ph = Math.max(40, Math.round(panel.layout.height * innerH));

      if (panel.illustration.assetFilePath) {
        const exists = await fs
          .stat(panel.illustration.assetFilePath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          const resizedPanel = await sharp(panel.illustration.assetFilePath)
            .resize(pw, ph, { fit: "cover" })
            .png()
            .toBuffer();
          composites.push({ input: resizedPanel, left: px, top: py });
        }
      }

      const strokeW =
        panel.borderStyle === "borderless_bleed"
          ? 0
          : panel.borderStyle === "heavy_impact"
          ? 6
          : 3.5;
      if (strokeW > 0) {
        letteringSvgParts.push(
          `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="none" stroke="#09090b" stroke-width="${strokeW}" />`
        );
      }

      if (panel.caption) {
        const boxW = Math.min(
          pw - 24,
          Math.max(180, panel.caption.length * 8.4 + 28)
        );
        const boxX = readingDirection === "rtl" ? px + pw - boxW - 12 : px + 12;
        const boxY = py + 12;
        const truncated =
          panel.caption.length > 64
            ? panel.caption.slice(0, 61) + "..."
            : panel.caption;
        letteringSvgParts.push(`
          <rect x="${boxX}" y="${boxY}" width="${boxW}" height="38" fill="#faf8f1" stroke="#09090b" stroke-width="2.5" />
          <text x="${boxX + 12}" y="${
          boxY + 24
        }" font-family="Arial, sans-serif" font-weight="700" font-size="14" fill="#09090b">${escapeXml(
          truncated
        )}</text>
        `);
      }

      if (panel.sfx) {
        const sfxX = px + Math.round(pw * 0.5);
        const sfxY = py + ph - 24;
        letteringSvgParts.push(`
          <text x="${sfxX}" y="${sfxY}" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="42" font-style="italic" fill="#ffffff" stroke="#09090b" stroke-width="7" paint-order="stroke">${escapeXml(
            panel.sfx
          )}</text>
        `);
      }
    }

    const letteringOverlay = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}" viewBox="0 0 ${pageW} ${pageH}">
        ${letteringSvgParts.join("\n")}
      </svg>`
    );
    composites.push({ input: letteringOverlay, left: 0, top: 0 });

    const outDir = path.join(StorageService.getSubDir("pages"), storyId);
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(
      outDir,
      `page_${String(page.pageNumber).padStart(2, "0")}.png`
    );

    await sharp({
      create: {
        width: pageW,
        height: pageH,
        channels: 4,
        background: { r: 247, g: 244, b: 235, alpha: 1 },
      },
    })
      .composite(composites)
      .png({ compressionLevel: 6 })
      .toFile(outPath);

    return {
      filePath: outPath,
      mediaUrl: StorageService.toMediaUrl(outPath),
    };
  }
}
