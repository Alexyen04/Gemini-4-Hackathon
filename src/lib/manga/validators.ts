import {
  MangaPanel,
  MangaStoryboard,
  MangaStoryboardSchema,
  NormalizedClip,
  NormalizedRect,
  ReadingDirection,
} from "@/types/manga";
import { PageCompositionService } from "./layout-engine";

export interface StoryboardValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const ALLOWED_SVG_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "pattern",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
]);

export class SvgSanitizer {
  /**
   * Strictly sanitizes model-generated SVG strings to prevent script execution,
   * external resource loading, event handlers, or malformed XML breaking Sharp.
   */
  static sanitize(rawSvg: string | null | undefined): string | null {
    if (!rawSvg || typeof rawSvg !== "string") return null;

    const trimmed = rawSvg.trim();
    const svgMatch = trimmed.match(/<svg[\s\S]*<\/svg>/i);
    if (!svgMatch) return null;

    let svg = svgMatch[0];

    // Remove dangerous blocks completely
    svg = svg.replace(
      /<\s*(script|foreignObject|iframe|object|embed|style|link|meta|audio|video)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    );
    svg = svg.replace(
      /<\s*(script|foreignObject|iframe|object|embed|link|meta|image|use)[^>]*\/?\s*>/gi,
      ""
    );

    // Strip event handlers (onload=, onclick=, etc.) and dangerous URI schemes
    svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    svg = svg.replace(
      /\s(href|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (full, attr, val) => {
        const cleanVal = String(val).replace(/^['"]|['"]$/g, "").trim();
        if (cleanVal.startsWith("#")) {
          return ` ${attr}="${cleanVal}"`;
        }
        return "";
      }
    );
    svg = svg.replace(/javascript\s*:/gi, "");
    svg = svg.replace(/data\s*:\s*text\/html/gi, "");

    // Verify all remaining element tags belong to our safe whitelist
    const tagRegex = /<\/?\s*([a-zA-Z0-9:-]+)/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(svg)) !== null) {
      const tagName = match[1].toLowerCase();
      if (!ALLOWED_SVG_TAGS.has(tagName)) {
        return null;
      }
    }

    // Ensure xmlns is present on root <svg>
    if (!/<svg[^>]+xmlns=/i.test(svg)) {
      svg = svg.replace(
        /<svg/i,
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );
    }

    // Escape stray unescaped ampersands inside text nodes
    svg = svg.replace(/&(?!(amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;))/g, "&amp;");

    return svg;
  }
}

export class StoryboardValidator {
  static computeOverlapArea(a: NormalizedRect, b: NormalizedRect): number {
    const xOverlap = Math.max(
      0,
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
    );
    const yOverlap = Math.max(
      0,
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
    );
    return xOverlap * yOverlap;
  }

  /**
   * Validates panel reading order against spatial layout coordinates for
   * Right-to-Left (`rtl`) or Left-to-Right (`ltr`) manga conventions.
   */
  static verifySpatialReadingOrder(
    panels: MangaPanel[],
    direction: ReadingDirection
  ): string[] {
    const issues: string[] = [];
    const sorted = [...panels].sort((a, b) => a.readingOrder - b.readingOrder);

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].readingOrder !== i + 1) {
        issues.push(
          `Panel "${sorted[i].panelId}" has non-sequential readingOrder ${
            sorted[i].readingOrder
          } (expected ${i + 1}).`
        );
      }
    }

    // Compare adjacent panels that share the exact same top row band (|y1 - y2| < 0.05)
    // and similar height (not spanning multi-row vertical hero columns)
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const sameRowTop = Math.abs(curr.layout.y - next.layout.y) < 0.04;
      const similarHeight =
        Math.abs(curr.layout.height - next.layout.height) < 0.15;

      if (sameRowTop && similarHeight) {
        const currCenterX = curr.layout.x + curr.layout.width / 2;
        const nextCenterX = next.layout.x + next.layout.width / 2;
        if (direction === "rtl" && currCenterX < nextCenterX - 0.01) {
          issues.push(
            `RTL reading order violation: panel ${curr.panelId} (order ${curr.readingOrder}) is left of ${next.panelId} (order ${next.readingOrder}).`
          );
        }
        if (direction === "ltr" && currCenterX > nextCenterX + 0.01) {
          issues.push(
            `LTR reading order violation: panel ${curr.panelId} (order ${curr.readingOrder}) is right of ${next.panelId} (order ${next.readingOrder}).`
          );
        }
      }
    }

    return issues;
  }

  static validateStoryboard(
    storyboard: unknown,
    clips: NormalizedClip[]
  ): StoryboardValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const parsed = MangaStoryboardSchema.safeParse(storyboard);
    if (!parsed.success) {
      return {
        valid: false,
        errors: parsed.error.issues.map(
          (iss) => `${iss.path.join(".")}: ${iss.message}`
        ),
        warnings,
      };
    }

    const sb = parsed.data;
    const clipMap = new Map(clips.map((c) => [c.clipId, c]));
    const seenPanelIds = new Set<string>();

    for (const page of sb.pages) {
      const orderIssues = this.verifySpatialReadingOrder(
        page.panels,
        sb.readingDirection
      );
      errors.push(...orderIssues);

      // Check panel overlaps & bounds
      for (let i = 0; i < page.panels.length; i++) {
        const p = page.panels[i];
        if (seenPanelIds.has(p.panelId)) {
          errors.push(`Duplicate panelId "${p.panelId}".`);
        }
        seenPanelIds.add(p.panelId);

        if (
          p.layout.x + p.layout.width > 1.001 ||
          p.layout.y + p.layout.height > 1.001
        ) {
          errors.push(
            `Panel "${p.panelId}" exceeds normalized [0, 1] page bounds.`
          );
        }

        for (let j = i + 1; j < page.panels.length; j++) {
          const other = page.panels[j];
          const overlap = this.computeOverlapArea(p.layout, other.layout);
          if (overlap > 0.0005) {
            errors.push(
              `Panels "${p.panelId}" and "${other.panelId}" overlap on page ${page.pageNumber} (area ${overlap.toFixed(
                4
              )}).`
            );
          }
        }

        // Check source clip existence and timestamp validity
        const clip = clipMap.get(p.sourceClipId);
        if (!clip) {
          errors.push(
            `Panel "${p.panelId}" references unknown clip "${p.sourceClipId}".`
          );
        } else {
          if (p.sourceTimestamp < 0 || p.sourceTimestamp > clip.durationSec + 0.05) {
            errors.push(
              `Panel "${p.panelId}" timestamp ${p.sourceTimestamp}s exceeds clip "${clip.clipId}" duration ${clip.durationSec}s.`
            );
          }
          if (p.interaction.clipId !== p.sourceClipId) {
            warnings.push(
              `Panel "${p.panelId}" interaction clipId differs from sourceClipId.`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Deterministically repairs layout coordinates, reading order, clip IDs,
   * and clamped source timestamps so AI-generated storyboards never break
   * rendering or interactive playback.
   */
  static normalizeAndRepairStoryboard(
    storyboard: MangaStoryboard,
    clips: NormalizedClip[]
  ): MangaStoryboard {
    const clipMap = new Map(clips.map((c) => [c.clipId, c]));
    const fallbackClip = clips[0];

    const repairedPages = storyboard.pages.map((page, pageIdx) => {
      const sanitizedPanels = page.panels.map((panel, panelIdx) => {
        const validClip = clipMap.get(panel.sourceClipId) || fallbackClip;
        const clampedTs = Number(
          Math.min(
            Math.max(0.05, panel.sourceTimestamp),
            Math.max(0.05, validClip.durationSec - 0.05)
          ).toFixed(2)
        );

        return {
          ...panel,
          panelId:
            panel.panelId ||
            `panel_p${pageIdx + 1}_${String(panelIdx + 1).padStart(2, "0")}`,
          readingOrder: panelIdx + 1,
          sourceClipId: validClip.clipId,
          sourceTimestamp: clampedTs,
          dialogue: panel.dialogue.slice(0, 2),
          interaction: {
            type: "play_source_clip" as const,
            clipId: validClip.clipId,
            timestamp: clampedTs,
            endTimestamp: Number(
              Math.min(validClip.durationSec, clampedTs + 1.8).toFixed(2)
            ),
            originalGameClock:
              panel.interaction?.originalGameClock ??
              validClip.metadata.gameClock ??
              null,
          },
        };
      });

      return PageCompositionService.composePage(
        {
          ...page,
          pageNumber: pageIdx + 1,
          panels: sanitizedPanels,
        },
        storyboard.readingDirection
      );
    });

    return {
      ...storyboard,
      sourceClips: clips.map((c) => c.clipId),
      pages: repairedPages,
    };
  }
}
