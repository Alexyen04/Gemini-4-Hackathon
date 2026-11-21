import sharp from "sharp";
import {
  ActionIntensity,
  CarbonIllustrationSpec,
  ColorTreatment,
  MangaStylePreset,
} from "@/types/manga";

export interface StylizedRasterResult {
  pngBuffer: Buffer;
  width: number;
  height: number;
  inkRatio: number;
  edgeStrength: number;
}

/**
 * MangaImageProcessor transforms a real basketball keyframe into authentic
 * Japanese sports manga or cel-shaded shonen/cinematic anime artwork, applying
 * the selected preset (`authentic_sports_manga`, `hyperkinetic_shonen_anime`,
 * `cinematic_anime_drama`), `colorTreatment` (`traditional_monochrome`,
 * `full_anime_color`, `selective_color`), and Carbon's reference-guided spec.
 */
export class MangaImageProcessor {
  private static async detectRefinedFocalCenter(
    sourceImagePath: string,
    hintX: number,
    hintY: number
  ): Promise<{ fx: number; fy: number }> {
    try {
      const { data, info } = await sharp(sourceImagePath)
        .greyscale()
        .resize(160, 90, { fit: "fill" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      let sumW = 0;
      let sumX = 0;
      let sumY = 0;

      const yStart = Math.floor(info.height * 0.18);
      const yEnd = Math.floor(info.height * 0.85);

      for (let y = yStart; y < yEnd; y++) {
        for (let x = 8; x < info.width - 8; x++) {
          const idx = y * info.width + x;
          const gx = Math.abs(data[idx + 1] - data[idx - 1]);
          const gy = Math.abs(data[idx + info.width] - data[idx - info.width]);
          const mag = gx + gy;
          if (mag > 45) {
            const nx = x / info.width;
            const ny = y / info.height;
            const distToHint = Math.hypot(nx - hintX, ny - hintY);
            const w = mag * (1.35 - Math.min(0.9, distToHint));
            sumW += w;
            sumX += nx * w;
            sumY += ny * w;
          }
        }
      }

      if (sumW > 500) {
        const detectedX = sumX / sumW;
        const detectedY = sumY / sumW;
        return {
          fx: Math.max(0.12, Math.min(0.88, hintX * 0.45 + detectedX * 0.55)),
          fy: Math.max(0.18, Math.min(0.82, hintY * 0.45 + detectedY * 0.55)),
        };
      }
    } catch {
      // Fallback to hint
    }
    return { fx: hintX, fy: hintY };
  }

  static async stylizeKeyframeToManga(params: {
    sourceImagePath: string;
    targetWidth: number;
    targetHeight: number;
    style: MangaStylePreset;
    spec: CarbonIllustrationSpec;
    colorTreatment?: ColorTreatment;
    actionIntensity?: ActionIntensity;
  }): Promise<StylizedRasterResult> {
    const {
      sourceImagePath,
      targetWidth,
      targetHeight,
      style,
      spec,
      colorTreatment = spec.colorTreatment || "traditional_monochrome",
      actionIntensity = "dramatic",
    } = params;

    const meta = await sharp(sourceImagePath).metadata();
    const srcW = meta.width || 1280;
    const srcH = meta.height || 720;

    const { fx: refinedFocalX, fy: refinedFocalY } =
      await this.detectRefinedFocalCenter(
        sourceImagePath,
        spec.focalX,
        spec.focalY
      );

    // ActionIntensity scales foreshortening zoom
    const intensityZoomMul =
      actionIntensity === "explosive"
        ? 1.12
        : actionIntensity === "grounded"
        ? 0.94
        : 1.0;
    const zoom = Math.min(2.2, Math.max(1.0, spec.zoomFactor * intensityZoomMul));

    const targetAspect = targetWidth / targetHeight;
    let cropW = Math.round(srcW / zoom);
    let cropH = Math.round(cropW / targetAspect);
    if (cropH > srcH / zoom) {
      cropH = Math.round(srcH / zoom);
      cropW = Math.round(cropH * targetAspect);
    }
    cropW = Math.max(80, Math.min(srcW, cropW));
    cropH = Math.max(80, Math.min(srcH, cropH));

    const centerX = Math.round(refinedFocalX * srcW);
    const centerY = Math.round(refinedFocalY * srcH);
    const left = Math.max(
      0,
      Math.min(srcW - cropW, Math.round(centerX - cropW / 2))
    );
    const top = Math.max(
      0,
      Math.min(srcH - cropH, Math.round(centerY - cropH / 2))
    );

    let pipeline = sharp(sourceImagePath).extract({
      left,
      top,
      width: cropW,
      height: cropH,
    });

    if (Math.abs(spec.dutchTiltDeg) >= 1.5) {
      pipeline = pipeline.rotate(spec.dutchTiltDeg, {
        background: { r: 250, g: 248, b: 241, alpha: 1 },
      });
    }

    // Extract 3-channel RGB so we can render Monochrome, Full Anime Cel Color, or Selective Color!
    const { data: rgbIn, info } = await pipeline
      .resize(targetWidth, targetHeight, { fit: "cover" })
      .removeAlpha()
      .toColorspace("srgb")
      .median(style === "cinematic_anime_drama" ? 2 : 1)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const pixelCount = w * h;

    // Precompute normalized luminance plane [0..255]
    const gray = new Uint8Array(pixelCount);
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < pixelCount; i++) {
      const r = rgbIn[i * 3];
      const g = rgbIn[i * 3 + 1];
      const b = rgbIn[i * 3 + 2];
      const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      gray[i] = l;
      if (l < minLum) minLum = l;
      if (l > maxLum) maxLum = l;
    }

    const lumSpan = Math.max(40, maxLum - minLum);
    for (let i = 0; i < pixelCount; i++) {
      gray[i] = Math.max(
        0,
        Math.min(255, Math.round(((gray[i] - minLum) * 255) / lumSpan))
      );
    }

    const outRgb = Buffer.alloc(pixelCount * 3);

    // Preset-distinct paper & ink palette
    const paperR =
      style === "hyperkinetic_shonen_anime"
        ? 255
        : style === "cinematic_anime_drama"
        ? 246
        : 250;
    const paperG =
      style === "hyperkinetic_shonen_anime"
        ? 255
        : style === "cinematic_anime_drama"
        ? 247
        : 248;
    const paperB =
      style === "hyperkinetic_shonen_anime"
        ? 255
        : style === "cinematic_anime_drama"
        ? 250
        : 239;

    const inkR = 11;
    const inkG = 11;
    const inkB = 16;

    // Preset-specific contour weights
    const baseEdgeThreshold =
      style === "hyperkinetic_shonen_anime" || spec.edgeWeight === "bold_brush"
        ? 40
        : style === "cinematic_anime_drama" || spec.edgeWeight === "fine"
        ? 66
        : 50;

    const shadowBoost = (spec.shadowDensity - 0.5) * 32;
    const blackCut =
      style === "cinematic_anime_drama"
        ? Math.max(16, Math.min(58, 28 + shadowBoost))
        : Math.max(20, Math.min(72, 36 + shadowBoost));
    const darkToneCut = Math.max(
      blackCut + 28,
      Math.min(158, 104 + shadowBoost * 0.6)
    );
    const lightToneCut = Math.max(
      darkToneCut + 26,
      Math.min(222, 168 + spec.screentoneDensity * 30)
    );

    const rad = (spec.screentoneAngleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const dotFreq =
      style === "cinematic_anime_drama"
        ? 1.12
        : style === "hyperkinetic_shonen_anime"
        ? 0.88
        : 0.94;

    const celBands = Math.max(3, Math.min(6, spec.celShadingBands || 4));
    let inkPixels = 0;
    let edgeSum = 0;

    const fx = w * 0.5;
    const fy = h * 0.52;
    const maxRadius = Math.hypot(w * 0.55, h * 0.55);

    for (let y = 0; y < h; y++) {
      const yPrev = Math.max(0, y - 1);
      const yNext = Math.min(h - 1, y + 1);

      for (let x = 0; x < w; x++) {
        const xPrev = Math.max(0, x - 1);
        const xNext = Math.min(w - 1, x + 1);

        const idx = y * w + x;
        const outIdx = idx * 3;
        const lumRaw = gray[idx];

        const tl = gray[yPrev * w + xPrev];
        const tc = gray[yPrev * w + x];
        const tr = gray[yPrev * w + xNext];
        const ml = gray[y * w + xPrev];
        const mr = gray[y * w + xNext];
        const bl = gray[yNext * w + xPrev];
        const bc = gray[yNext * w + x];
        const br = gray[yNext * w + xNext];

        const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
        const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
        const gradMag = Math.abs(gx) + Math.abs(gy);
        edgeSum += gradMag;

        const distNorm = Math.hypot(x - fx, y - fy) / maxRadius;

        const gammaLifted = Math.pow(lumRaw / 255, 0.78) * 255;
        const norm =
          (gammaLifted - 128) * (0.72 + spec.inkContrast * 0.82) + 136;
        let lum = Math.max(0, Math.min(255, norm));

        let localEdgeThresh = baseEdgeThreshold;
        if (spec.backgroundMode === "stark_white_tension") {
          if (distNorm > 0.46 || y < h * 0.34) {
            const fade = Math.min(
              1,
              Math.max((distNorm - 0.46) / 0.45, (h * 0.34 - y) / (h * 0.34))
            );
            lum = lum + (255 - lum) * fade * 0.88;
            localEdgeThresh += fade * 90;
          }
        } else if (spec.backgroundMode === "arena_simplified") {
          if (y < h * 0.46 && lum < 135 && gradMag < 110) {
            const skyLift = 1 - y / (h * 0.46);
            lum = lum + (222 - lum) * (0.58 + skyLift * 0.34);
          }
        } else if (spec.backgroundMode === "speed_void" && distNorm > 0.5) {
          const bleach = Math.min(1, (distNorm - 0.5) / 0.42);
          lum = lum + (252 - lum) * bleach * 0.84;
          localEdgeThresh += bleach * 85;
        } else if (spec.backgroundMode === "dark_pressure" && distNorm > 0.65) {
          const darken = Math.min(1, (distNorm - 0.65) / 0.45);
          lum = lum * (1 - darken * 0.45);
        }

        const isInkEdge = gradMag >= localEdgeThresh * 2.3;

        // ---- Mode A: Full Anime Color (Cel-Shaded RGB + Crisp Ink Lines) ----
        if (colorTreatment === "full_anime_color") {
          if (isInkEdge) {
            outRgb[outIdx] = inkR;
            outRgb[outIdx + 1] = inkG;
            outRgb[outIdx + 2] = inkB;
            inkPixels++;
            continue;
          }

          const srcR = rgbIn[outIdx];
          const srcG = rgbIn[outIdx + 1];
          const srcB = rgbIn[outIdx + 2];

          // Boost anime color saturation slightly while quantizing into crisp cel bands
          const avg = (srcR + srcG + srcB) / 3;
          const satMul =
            style === "hyperkinetic_shonen_anime"
              ? 1.42
              : style === "cinematic_anime_drama"
              ? 1.18
              : 1.25;
          let celR = avg + (srcR - avg) * satMul;
          let celG = avg + (srcG - avg) * satMul;
          let celB = avg + (srcB - avg) * satMul;

          // Quantize brightness multiplier into discrete anime cel-shading steps
          const step = Math.round((lum / 255) * celBands) / celBands;
          const celBrightness = 0.36 + step * 0.82;

          // Cool indigo tint in deep cel shadows, warm rim bloom in highlights
          if (step <= 0.34) {
            celR *= celBrightness * 0.9;
            celG *= celBrightness * 0.94;
            celB = Math.min(255, celB * celBrightness * 1.12 + 12);
            inkPixels += 0.6;
          } else if (step >= 0.85) {
            celR = Math.min(255, celR * celBrightness + 18);
            celG = Math.min(255, celG * celBrightness + 15);
            celB = Math.min(255, celB * celBrightness + 10);
          } else {
            celR *= celBrightness;
            celG *= celBrightness;
            celB *= celBrightness;
          }

          outRgb[outIdx] = Math.max(0, Math.min(255, Math.round(celR)));
          outRgb[outIdx + 1] = Math.max(0, Math.min(255, Math.round(celG)));
          outRgb[outIdx + 2] = Math.max(0, Math.min(255, Math.round(celB)));
          continue;
        }

        // ---- Check Selective Color Accent (Basketball Orange / Jersey Crimson / LED) ----
        if (colorTreatment === "selective_color" && !isInkEdge) {
          const srcR = rgbIn[outIdx];
          const srcG = rgbIn[outIdx + 1];
          const srcB = rgbIn[outIdx + 2];
          const maxC = Math.max(srcR, srcG, srcB);
          const minC = Math.min(srcR, srcG, srcB);
          const sat = maxC > 25 ? (maxC - minC) / maxC : 0;

          // Preserve vivid warm accents (orange leather basketball, rim, crimson jersey trim)
          const isWarmAccent =
            sat >= 0.42 && srcR >= 135 && srcR > srcB * 1.45 && srcR > srcG * 1.12;
          if (isWarmAccent) {
            const celStep = lum > 140 ? 1.08 : 0.84;
            outRgb[outIdx] = Math.min(255, Math.round(srcR * celStep));
            outRgb[outIdx + 1] = Math.min(255, Math.round(srcG * celStep * 0.92));
            outRgb[outIdx + 2] = Math.min(255, Math.round(srcB * 0.85));
            continue;
          }
        }

        // ---- Monochrome Ink + Screentone / Cel-Gray Rendering ----
        let pixelDark = false;
        let midInkBlend = 0;

        if (isInkEdge || lum < blackCut) {
          pixelDark = true;
        } else if (style === "cinematic_anime_drama" && lum < darkToneCut) {
          // Cinematic Anime Drama uses refined smooth cel-gray shadow washes + subtle fine dots
          midInkBlend = 0.52;
        } else if (lum < darkToneCut && spec.screentoneDensity > 0.05) {
          const u = (x * cosA - y * sinA) * dotFreq;
          const v = (x * sinA + y * cosA) * dotFreq;
          const wave = (Math.cos(u) + Math.cos(v)) * 0.5;
          const darkness = 1 - (lum - blackCut) / (darkToneCut - blackCut);
          const threshold =
            0.66 - darkness * (0.52 + spec.screentoneDensity * 0.48);
          if (wave > threshold) {
            pixelDark = true;
          }
        } else if (lum < lightToneCut && spec.screentoneDensity > 0.14) {
          const u = (x * cosA - y * sinA) * (dotFreq * 1.15);
          const v = (x * sinA + y * cosA) * (dotFreq * 1.15);
          const wave = (Math.cos(u) + Math.cos(v)) * 0.5;
          const threshold = 0.8 - spec.screentoneDensity * 0.34;
          if (wave > threshold) {
            midInkBlend = 0.72;
          }
        }

        if (pixelDark) {
          outRgb[outIdx] = inkR;
          outRgb[outIdx + 1] = inkG;
          outRgb[outIdx + 2] = inkB;
          inkPixels++;
        } else if (midInkBlend > 0) {
          outRgb[outIdx] = Math.round(
            paperR * (1 - midInkBlend) + inkR * midInkBlend
          );
          outRgb[outIdx + 1] = Math.round(
            paperG * (1 - midInkBlend) + inkG * midInkBlend
          );
          outRgb[outIdx + 2] = Math.round(
            paperB * (1 - midInkBlend) + inkB * midInkBlend
          );
          inkPixels += 0.5;
        } else {
          outRgb[outIdx] = paperR;
          outRgb[outIdx + 1] = paperG;
          outRgb[outIdx + 2] = paperB;
        }
      }
    }

    const pngBuffer = await sharp(outRgb, {
      raw: { width: w, height: h, channels: 3 },
    })
      .png({ compressionLevel: 6 })
      .toBuffer();

    return {
      pngBuffer,
      width: w,
      height: h,
      inkRatio: Number((inkPixels / pixelCount).toFixed(4)),
      edgeStrength: Number((edgeSum / (pixelCount * 255)).toFixed(4)),
    };
  }
}
