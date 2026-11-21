import {
  ActionIntensity,
  CarbonIllustrationSpec,
  ColorTreatment,
  MangaStylePreset,
} from "@/types/manga";
import { SvgSanitizer } from "./validators";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class SVGIllustrationRenderer {
  /**
   * Builds a crisp transparent anime/manga vector effects overlay (radial focus
   * lines, tapered speed lines, kinetic shonen aura streaks, perimeter impact
   * bursts, and sanitized Carbon custom SVG scene elements).
   */
  static buildEffectsOverlaySvg(params: {
    width: number;
    height: number;
    spec: CarbonIllustrationSpec;
    style: MangaStylePreset;
    colorTreatment?: ColorTreatment;
    actionIntensity?: ActionIntensity;
    visualEffects?: string[];
    seedSalt?: number;
  }): string {
    const {
      width: w,
      height: h,
      spec,
      style,
      colorTreatment = spec.colorTreatment || "traditional_monochrome",
      actionIntensity = "dramatic",
      visualEffects = [],
      seedSalt = 0,
    } = params;

    const rand = mulberry32(hashString(spec.panelId) + seedSalt * 7919);
    const parts: string[] = [];

    const cx = w * spec.focalX;
    const cy = h * spec.focalY;

    const intensityScale =
      actionIntensity === "explosive"
        ? 1.25
        : actionIntensity === "grounded"
        ? 0.6
        : 1.0;
    const intensity = Math.max(
      0,
      Math.min(1, spec.speedLineIntensity * intensityScale)
    );

    const accentStrokeColor =
      colorTreatment === "full_anime_color"
        ? "#38bdf8"
        : colorTreatment === "selective_color"
        ? "#e11d48"
        : "rgba(255,255,255,0.82)";

    // 1. Speed / Focus Lines Layer
    if (spec.speedLineMode === "radial" && intensity > 0.08) {
      const baseRays =
        style === "hyperkinetic_shonen_anime"
          ? 84
          : style === "cinematic_anime_drama"
          ? 34
          : 54;
      const rayCount = Math.round(baseRays * (0.55 + intensity * 0.7));
      const clearRadius = Math.min(w, h) * (0.3 + (1 - intensity) * 0.14);
      const outerRadius = Math.hypot(w, h) * 0.95;

      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2 + (rand() - 0.5) * 0.06;
        const innerR = clearRadius * (0.85 + rand() * 0.42);
        const halfSpread = (0.004 + rand() * 0.011) * (0.7 + intensity);

        const tipX = cx + Math.cos(angle) * innerR;
        const tipY = cy + Math.sin(angle) * innerR;
        const baseX1 = cx + Math.cos(angle - halfSpread) * outerRadius;
        const baseY1 = cy + Math.sin(angle - halfSpread) * outerRadius;
        const baseX2 = cx + Math.cos(angle + halfSpread) * outerRadius;
        const baseY2 = cy + Math.sin(angle + halfSpread) * outerRadius;

        const isAccent = i % 7 === 0;
        parts.push(
          `<polygon points="${tipX.toFixed(1)},${tipY.toFixed(
            1
          )} ${baseX1.toFixed(1)},${baseY1.toFixed(1)} ${baseX2.toFixed(
            1
          )},${baseY2.toFixed(1)}" fill="${
            isAccent ? accentStrokeColor : "#09090b"
          }" opacity="${(0.5 + rand() * 0.42).toFixed(2)}" />`
        );
      }
    } else if (
      (spec.speedLineMode === "diagonal" ||
        spec.speedLineMode === "horizontal" ||
        spec.speedLineMode === "vertical") &&
      intensity > 0.08
    ) {
      const baseLines =
        style === "hyperkinetic_shonen_anime"
          ? 48
          : style === "cinematic_anime_drama"
          ? 20
          : 36;
      const lineCount = Math.round(baseLines * (0.5 + intensity * 0.85));
      const angleDeg =
        spec.speedLineMode === "horizontal"
          ? 0
          : spec.speedLineMode === "vertical"
          ? 90
          : -22;

      parts.push(
        `<g transform="rotate(${angleDeg} ${(w / 2).toFixed(1)} ${(
          h / 2
        ).toFixed(1)})">`
      );
      for (let i = 0; i < lineCount; i++) {
        const yPos = -h * 0.25 + rand() * (h * 1.5);
        if (Math.abs(yPos - cy) < h * 0.16 && rand() > 0.25) continue;

        const fromLeft = rand() > 0.5;
        const len = w * (0.22 + rand() * 0.42);
        const startX = fromLeft ? -w * 0.18 : w * 1.18;
        const endX = fromLeft ? startX + len : startX - len;
        const strokeW =
          (1.2 + rand() * 3.4) *
          (style === "hyperkinetic_shonen_anime" ? 1.35 : 1);
        const isAccent = i % 6 === 0;

        parts.push(
          `<line x1="${startX.toFixed(1)}" y1="${yPos.toFixed(
            1
          )}" x2="${endX.toFixed(1)}" y2="${yPos.toFixed(1)}" stroke="${
            isAccent ? accentStrokeColor : "#09090b"
          }" stroke-width="${strokeW.toFixed(
            1
          )}" stroke-linecap="round" opacity="${(
            0.42 +
            intensity * 0.48
          ).toFixed(2)}" />`
        );
      }
      parts.push(`</g>`);
    }

    // 2. Impact Flash Needles (clean perimeter action spikes)
    if (
      spec.impactBurst ||
      visualEffects.includes("impact_burst") ||
      (style === "hyperkinetic_shonen_anime" && actionIntensity === "explosive")
    ) {
      const spikes = actionIntensity === "explosive" ? 34 : 26;
      const innerR = Math.min(w, h) * 0.36;
      const outerR = Math.hypot(w, h) * 0.62;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + (rand() - 0.5) * 0.08;
        const r0 = innerR * (0.92 + rand() * 0.3);
        const halfSpread = 0.014 + rand() * 0.016;
        const tipX = cx + Math.cos(a) * r0;
        const tipY = cy + Math.sin(a) * r0;
        const b1X = cx + Math.cos(a - halfSpread) * outerR;
        const b1Y = cy + Math.sin(a - halfSpread) * outerR;
        const b2X = cx + Math.cos(a + halfSpread) * outerR;
        const b2Y = cy + Math.sin(a + halfSpread) * outerR;
        parts.push(
          `<polygon points="${tipX.toFixed(1)},${tipY.toFixed(
            1
          )} ${b1X.toFixed(1)},${b1Y.toFixed(1)} ${b2X.toFixed(
            1
          )},${b2Y.toFixed(1)}" fill="${
            colorTreatment === "full_anime_color"
              ? "rgba(254,249,195,0.85)"
              : "rgba(255,255,255,0.82)"
          }" stroke="#09090b" stroke-width="2.2" opacity="0.88" />`
        );
      }
    }

    // 3. Anime Kinetic Focus Streak ("Zone"-inspired eye/hand velocity ribbon for hyperkinetic preset)
    if (
      style === "hyperkinetic_shonen_anime" ||
      visualEffects.includes("kinetic_aura")
    ) {
      const ribbonColor =
        colorTreatment === "full_anime_color"
          ? "#38bdf8"
          : colorTreatment === "selective_color"
          ? "#e11d48"
          : "#ffffff";
      parts.push(`
        <path d="M ${(cx - w * 0.28).toFixed(1)} ${(cy + h * 0.16).toFixed(
        1
      )} Q ${cx.toFixed(1)} ${(cy - h * 0.14).toFixed(1)} ${(
        cx +
        w * 0.3
      ).toFixed(1)} ${(cy - h * 0.05).toFixed(
        1
      )}" fill="none" stroke="#09090b" stroke-width="5" stroke-linecap="round" opacity="0.55" />
        <path d="M ${(cx - w * 0.28).toFixed(1)} ${(cy + h * 0.16).toFixed(
        1
      )} Q ${cx.toFixed(1)} ${(cy - h * 0.14).toFixed(1)} ${(
        cx +
        w * 0.3
      ).toFixed(1)} ${(cy - h * 0.05).toFixed(
        1
      )}" fill="none" stroke="${ribbonColor}" stroke-width="2.4" stroke-linecap="round" opacity="0.85" />
      `);
    }

    // 4. Dramatic Shadow / Cinematic Vignette
    if (
      style === "cinematic_anime_drama" ||
      visualEffects.includes("heavy_shadows") ||
      spec.shadowDensity >= 0.72 ||
      spec.lightingDirection === "low_upward"
    ) {
      parts.push(`
        <defs>
          <radialGradient id="mangaVignette" cx="${spec.focalX.toFixed(
            2
          )}" cy="${spec.focalY.toFixed(2)}" r="0.82">
            <stop offset="54%" stop-color="#09090b" stop-opacity="0" />
            <stop offset="100%" stop-color="#09090b" stop-opacity="0.44" />
          </radialGradient>
        </defs>
        <rect width="${w}" height="${h}" fill="url(#mangaVignette)" />
      `);
    }

    // 5. Inject Carbon's Custom Sanitized SVG Scene Overlay
    const sanitizedCustom = SvgSanitizer.sanitize(spec.customSvgOverlay);
    if (sanitizedCustom) {
      const innerMatch = sanitizedCustom.match(
        /<svg[^>]*>([\s\S]*?)<\/svg>/i
      );
      if (innerMatch && innerMatch[1].trim().length > 0) {
        const scaleX = w / 800;
        const scaleY = h / 600;
        parts.push(
          `<g transform="scale(${scaleX.toFixed(4)} ${scaleY.toFixed(
            4
          )})" opacity="0.92">${innerMatch[1]}</g>`
        );
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${parts.join("\n")}
    </svg>`;
  }

  static buildFullVectorPanelSvg(params: {
    width: number;
    height: number;
    spec: CarbonIllustrationSpec;
    style: MangaStylePreset;
    colorTreatment?: ColorTreatment;
    actionIntensity?: ActionIntensity;
  }): string {
    const {
      width: w,
      height: h,
      spec,
      style,
      colorTreatment = "traditional_monochrome",
      actionIntensity = "dramatic",
    } = params;

    const sanitized = SvgSanitizer.sanitize(spec.customSvgOverlay);
    const innerCustom = sanitized
      ? sanitized.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1] || ""
      : "";

    const effectsSvg = this.buildEffectsOverlaySvg({
      width: w,
      height: h,
      spec: { ...spec, customSvgOverlay: null },
      style,
      colorTreatment,
      actionIntensity,
    });
    const effectsInner =
      effectsSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1] || "";

    const scaleX = w / 800;
    const scaleY = h / 600;
    const ballFill =
      colorTreatment === "traditional_monochrome" ? "#faf8f1" : "#ea580c";

    const fallbackSymbolicCourt =
      innerCustom.trim().length > 20
        ? ""
        : `
        <g stroke="#09090b" fill="none">
          <line x1="0" y1="430" x2="800" y2="430" stroke-width="5" />
          <path d="M 120 430 Q 400 320 680 430" stroke-width="4" />
          <circle cx="${(spec.focalX * 800).toFixed(0)}" cy="${(
            spec.focalY * 600
          ).toFixed(0)}" r="68" fill="${ballFill}" stroke-width="6" />
          <path d="M ${(spec.focalX * 800 - 66).toFixed(0)} ${(
            spec.focalY * 600
          ).toFixed(0)} Q ${(spec.focalX * 800).toFixed(0)} ${(
            spec.focalY * 600 - 28
          ).toFixed(0)} ${(spec.focalX * 800 + 66).toFixed(0)} ${(
            spec.focalY * 600
          ).toFixed(0)}" stroke-width="4.5" />
          <path d="M ${(spec.focalX * 800).toFixed(0)} ${(
            spec.focalY * 600 - 66
          ).toFixed(0)} Q ${(spec.focalX * 800 + 26).toFixed(0)} ${(
            spec.focalY * 600
          ).toFixed(0)} ${(spec.focalX * 800).toFixed(0)} ${(
            spec.focalY * 600 + 66
          ).toFixed(0)}" stroke-width="4.5" />
        </g>
      `;

    const bgFill =
      colorTreatment === "full_anime_color" ? "#e2e8f0" : "#faf8f1";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <pattern id="mangaDots" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.8" fill="#18181b" />
        </pattern>
      </defs>
      <rect width="${w}" height="${h}" fill="${bgFill}" />
      <rect y="${(h * 0.72).toFixed(0)}" width="${w}" height="${(
      h * 0.28
    ).toFixed(0)}" fill="url(#mangaDots)" opacity="0.45" />
      <g transform="scale(${scaleX.toFixed(4)} ${scaleY.toFixed(4)})">
        ${fallbackSymbolicCourt}
        ${innerCustom}
      </g>
      ${effectsInner}
    </svg>`;
  }
}
