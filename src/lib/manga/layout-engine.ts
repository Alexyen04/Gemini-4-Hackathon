import {
  LayoutTemplateId,
  MangaPage,
  MangaPanel,
  NormalizedRect,
  PanelSize,
  ReadingDirection,
} from "@/types/manga";

interface TemplateSlot {
  rectLtr: NormalizedRect;
  suggestedSize: PanelSize;
}

const GUTTER = 0.02;

/**
 * Canonical LTR slot definitions in [0, 1] space with explicit 2% gutters.
 * When `readingDirection === "rtl"`, horizontal coordinates mirror via
 * `x_rtl = Number((1 - (rect.x + rect.width)).toFixed(4))` so Slot 1 sits at
 * the top-right and reading flows naturally Right-to-Left, Top-to-Bottom.
 */
const LAYOUT_TEMPLATES: Record<LayoutTemplateId, TemplateSlot[]> = {
  full_splash: [
    {
      rectLtr: { x: 0, y: 0, width: 1, height: 1 },
      suggestedSize: "splash",
    },
  ],
  dramatic_three: [
    {
      rectLtr: { x: 0, y: 0, width: 0.45, height: 0.35 },
      suggestedSize: "small",
    },
    {
      rectLtr: { x: 0.45 + GUTTER, y: 0, width: 0.53, height: 0.35 },
      suggestedSize: "medium",
    },
    {
      rectLtr: { x: 0, y: 0.35 + GUTTER, width: 1, height: 0.63 },
      suggestedSize: "large",
    },
  ],
  climax_showcase_three: [
    {
      rectLtr: { x: 0, y: 0, width: 1, height: 0.64 },
      suggestedSize: "large",
    },
    {
      rectLtr: { x: 0, y: 0.64 + GUTTER, width: 0.49, height: 0.34 },
      suggestedSize: "medium",
    },
    {
      rectLtr: {
        x: 0.49 + GUTTER,
        y: 0.64 + GUTTER,
        width: 0.49,
        height: 0.34,
      },
      suggestedSize: "small",
    },
  ],
  balanced_four: [
    {
      rectLtr: { x: 0, y: 0, width: 0.57, height: 0.48 },
      suggestedSize: "medium",
    },
    {
      rectLtr: { x: 0.57 + GUTTER, y: 0, width: 0.41, height: 0.48 },
      suggestedSize: "small",
    },
    {
      rectLtr: { x: 0, y: 0.48 + GUTTER, width: 0.42, height: 0.5 },
      suggestedSize: "medium",
    },
    {
      rectLtr: {
        x: 0.42 + GUTTER,
        y: 0.48 + GUTTER,
        width: 0.56,
        height: 0.5,
      },
      suggestedSize: "large",
    },
  ],
  hero_action_four: [
    {
      rectLtr: { x: 0, y: 0, width: 0.38, height: 0.32 },
      suggestedSize: "small",
    },
    {
      rectLtr: { x: 0, y: 0.32 + GUTTER, width: 0.38, height: 0.32 },
      suggestedSize: "small",
    },
    {
      rectLtr: { x: 0, y: 0.64 + GUTTER * 2, width: 0.38, height: 0.32 },
      suggestedSize: "medium",
    },
    {
      rectLtr: { x: 0.38 + GUTTER, y: 0, width: 0.6, height: 1 },
      suggestedSize: "large",
    },
  ],
  vertical_strip_four: [
    {
      rectLtr: { x: 0, y: 0, width: 1, height: 0.235 },
      suggestedSize: "medium",
    },
    {
      rectLtr: { x: 0, y: 0.255, width: 1, height: 0.235 },
      suggestedSize: "medium",
    },
    {
      rectLtr: { x: 0, y: 0.51, width: 1, height: 0.235 },
      suggestedSize: "medium",
    },
    {
      rectLtr: { x: 0, y: 0.765, width: 1, height: 0.235 },
      suggestedSize: "large",
    },
  ],
  balanced_five: [
    {
      rectLtr: { x: 0, y: 0, width: 0.58, height: 0.3 },
      suggestedSize: "medium",
    },
    {
      rectLtr: { x: 0.58 + GUTTER, y: 0, width: 0.4, height: 0.3 },
      suggestedSize: "small",
    },
    {
      rectLtr: { x: 0, y: 0.3 + GUTTER, width: 1, height: 0.34 },
      suggestedSize: "large",
    },
    {
      rectLtr: {
        x: 0,
        y: 0.64 + GUTTER * 2,
        width: 0.56,
        height: 0.32,
      },
      suggestedSize: "medium",
    },
    {
      rectLtr: {
        x: 0.56 + GUTTER,
        y: 0.64 + GUTTER * 2,
        width: 0.42,
        height: 0.32,
      },
      suggestedSize: "small",
    },
  ],
};

export class PageCompositionService {
  static listTemplates(): Array<{
    id: LayoutTemplateId;
    label: string;
    panelCount: number;
    description: string;
  }> {
    return [
      {
        id: "balanced_four",
        label: "Balanced 4-Panel",
        panelCount: 4,
        description: "Classic 2x2 asymmetric manga storytelling grid",
      },
      {
        id: "balanced_five",
        label: "Action 5-Panel",
        panelCount: 5,
        description: "Setup pair, wide central action banner, and reaction pair",
      },
      {
        id: "dramatic_three",
        label: "Dramatic 3-Panel",
        panelCount: 3,
        description: "Two buildup panels leading into a huge bottom climax",
      },
      {
        id: "hero_action_four",
        label: "Hero Vertical + 3 Beats",
        panelCount: 4,
        description: "Three rapid tension beats beside a full-height showcase",
      },
      {
        id: "climax_showcase_three",
        label: "Climax Top Showcase",
        panelCount: 3,
        description: "Dominant top highlight followed by two aftermath beats",
      },
      {
        id: "vertical_strip_four",
        label: "Widescreen 4-Strip",
        panelCount: 4,
        description: "Four cinematic horizontal strips for countdown pacing",
      },
      {
        id: "full_splash",
        label: "Full-Page Splash",
        panelCount: 1,
        description: "Single monumental full-bleed climax illustration",
      },
    ];
  }

  static selectBestTemplateForPanelCount(
    count: number,
    preferred?: LayoutTemplateId
  ): LayoutTemplateId {
    if (
      preferred &&
      LAYOUT_TEMPLATES[preferred] &&
      LAYOUT_TEMPLATES[preferred].length === count
    ) {
      return preferred;
    }

    if (count <= 1) return "full_splash";
    if (count === 3) return preferred === "climax_showcase_three" ? "climax_showcase_three" : "dramatic_three";
    if (count === 4) {
      if (
        preferred === "hero_action_four" ||
        preferred === "vertical_strip_four"
      ) {
        return preferred;
      }
      return "balanced_four";
    }
    if (count === 5) return "balanced_five";
    return preferred || "balanced_four";
  }

  /**
   * Computes non-overlapping normalized rectangles for any panel count (1..7),
   * using exact curated templates for 1, 3, 4, 5 panels and deterministic row
   * subdivision for 2, 6, or 7 panels.
   */
  static computeSlots(
    panelCount: number,
    template: LayoutTemplateId,
    direction: ReadingDirection
  ): TemplateSlot[] {
    const baseSlots = LAYOUT_TEMPLATES[template];
    let ltrSlots: TemplateSlot[];

    if (baseSlots && baseSlots.length === panelCount) {
      ltrSlots = baseSlots;
    } else if (panelCount === 2) {
      ltrSlots = [
        {
          rectLtr: { x: 0, y: 0, width: 1, height: 0.44 },
          suggestedSize: "medium",
        },
        {
          rectLtr: { x: 0, y: 0.44 + GUTTER, width: 1, height: 0.54 },
          suggestedSize: "large",
        },
      ];
    } else if (panelCount === 6) {
      ltrSlots = [
        { rectLtr: { x: 0, y: 0, width: 0.54, height: 0.32 }, suggestedSize: "medium" },
        { rectLtr: { x: 0.56, y: 0, width: 0.44, height: 0.32 }, suggestedSize: "small" },
        { rectLtr: { x: 0, y: 0.34, width: 0.44, height: 0.32 }, suggestedSize: "small" },
        { rectLtr: { x: 0.46, y: 0.34, width: 0.54, height: 0.32 }, suggestedSize: "medium" },
        { rectLtr: { x: 0, y: 0.68, width: 0.58, height: 0.32 }, suggestedSize: "large" },
        { rectLtr: { x: 0.6, y: 0.68, width: 0.4, height: 0.32 }, suggestedSize: "small" },
      ];
    } else {
      // General fallback grid (e.g., 7 panels)
      const rows = Math.ceil(panelCount / 2);
      const rowH = Number(((1 - GUTTER * (rows - 1)) / rows).toFixed(4));
      ltrSlots = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        const remaining = panelCount - idx;
        const colsInRow = remaining === 1 ? 1 : 2;
        const y = Number((r * (rowH + GUTTER)).toFixed(4));
        if (colsInRow === 1) {
          ltrSlots.push({
            rectLtr: { x: 0, y, width: 1, height: rowH },
            suggestedSize: "large",
          });
          idx++;
        } else {
          ltrSlots.push({
            rectLtr: { x: 0, y, width: 0.49, height: rowH },
            suggestedSize: "medium",
          });
          ltrSlots.push({
            rectLtr: { x: 0.51, y, width: 0.49, height: rowH },
            suggestedSize: "small",
          });
          idx += 2;
        }
      }
    }

    if (direction === "ltr") {
      return ltrSlots;
    }

    // Mirror horizontally for Right-to-Left Japanese manga reading order
    return ltrSlots.map((slot) => ({
      suggestedSize: slot.suggestedSize,
      rectLtr: {
        x: Number(
          Math.max(0, 1 - (slot.rectLtr.x + slot.rectLtr.width)).toFixed(4)
        ),
        y: slot.rectLtr.y,
        width: slot.rectLtr.width,
        height: slot.rectLtr.height,
      },
    }));
  }

  /**
   * Applies deterministic layout geometry and strict reading order (1..N) to a page.
   */
  static composePage(
    page: MangaPage,
    direction: ReadingDirection,
    overrideTemplate?: LayoutTemplateId
  ): MangaPage {
    const sortedPanels = [...page.panels].sort(
      (a, b) => a.readingOrder - b.readingOrder
    );
    const activeTemplate =
      overrideTemplate ||
      this.selectBestTemplateForPanelCount(
        sortedPanels.length,
        page.layoutTemplate
      );

    // If the user explicitly switches to a template with fewer/more slots in the editor,
    // computeSlots gracefully handles arbitrary panel counts when template count differs,
    // OR uses the chosen template directly when counts match.
    const slots = this.computeSlots(
      sortedPanels.length,
      activeTemplate,
      direction
    );

    const updatedPanels: MangaPanel[] = sortedPanels.map((panel, i) => {
      const slot = slots[i];
      const area = slot.rectLtr.width * slot.rectLtr.height;
      const derivedSize: PanelSize =
        area >= 0.8
          ? "splash"
          : area >= 0.33
          ? "large"
          : area >= 0.16
          ? "medium"
          : "small";

      return {
        ...panel,
        readingOrder: i + 1,
        size: derivedSize,
        layout: slot.rectLtr,
      };
    });

    return {
      ...page,
      layoutTemplate: activeTemplate,
      panels: updatedPanels,
    };
  }
}
