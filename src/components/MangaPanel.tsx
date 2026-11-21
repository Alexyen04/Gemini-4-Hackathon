"use client";

import React from "react";
import { motion } from "framer-motion";
import { Maximize2, Play, Sparkles } from "lucide-react";
import { DialogueBubble, MangaPanel as MangaPanelType, ReadingDirection } from "@/types/manga";

interface MangaPanelProps {
  panel: MangaPanelType;
  readingDirection: ReadingDirection;
  showOrderBadges?: boolean;
  isSelected?: boolean;
  interactiveMode?: "reader" | "editor";
  onClickPanel: (panel: MangaPanelType) => void;
  onZoomPanel?: (panel: MangaPanelType) => void;
}

function getPlacementClasses(placement: DialogueBubble["placement"]): string {
  switch (placement) {
    case "top_right":
      return "top-2.5 right-2.5";
    case "top_left":
      return "top-2.5 left-2.5";
    case "bottom_right":
      return "bottom-3 right-2.5";
    case "bottom_left":
      return "bottom-3 left-2.5";
    case "top_center":
      return "top-2.5 left-1/2 -translate-x-1/2";
    case "bottom_center":
      return "bottom-3 left-1/2 -translate-x-1/2";
  }
}

export const MangaPanel: React.FC<MangaPanelProps> = ({
  panel,
  readingDirection,
  showOrderBadges = true,
  isSelected = false,
  interactiveMode = "reader",
  onClickPanel,
  onZoomPanel,
}) => {
  const { layout } = panel;

  const borderClasses =
    panel.borderStyle === "borderless_bleed"
      ? "border-0 shadow-none"
      : panel.borderStyle === "heavy_impact"
      ? "border-[4px] border-ink-950 shadow-[4px_4px_0px_#16130F]"
      : "border-[3px] border-ink-950";

  // Position caption on the initiating side of the reading direction
  const captionSideClass =
    readingDirection === "rtl" ? "top-2 right-2" : "top-2 left-2";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, delay: panel.readingOrder * 0.04 }}
      style={{
        left: `${(layout.x * 100).toFixed(2)}%`,
        top: `${(layout.y * 100).toFixed(2)}%`,
        width: `${(layout.width * 100).toFixed(2)}%`,
        height: `${(layout.height * 100).toFixed(2)}%`,
      }}
      onClick={() => onClickPanel(panel)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickPanel(panel);
        }
      }}
      className={`group absolute overflow-hidden bg-paper-50 cursor-pointer select-none transition-transform duration-150 ${borderClasses} ${
        isSelected
          ? "ring-4 ring-crimson-500 z-20 scale-[1.008]"
          : "hover:z-10 hover:scale-[1.005]"
      }`}
    >
      {/* Rendered Hybrid / SVG Manga Artwork */}
      {panel.illustration.assetUrl ? (
        <img
          src={panel.illustration.assetUrl}
          alt={panel.description}
          className="w-full h-full object-cover contrast-105 transition-transform duration-300 group-hover:scale-[1.025]"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-screentone-subtle p-4 text-center">
          <Sparkles className="w-6 h-6 mb-1.5 text-ink-700 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-ink-700">
            Rendering {panel.panelId}...
          </span>
        </div>
      )}

      {/* Reading Order Badge */}
      {showOrderBadges && (
        <div
          className={`absolute ${
            readingDirection === "rtl" ? "bottom-1.5 right-1.5" : "bottom-1.5 left-1.5"
          } z-20 w-5 h-5 flex items-center justify-center bg-ink-950 text-paper-50 font-mono text-[10px] font-bold border border-paper-50/70 opacity-80 group-hover:opacity-100`}
          title={`Reading Order #${panel.readingOrder}`}
        >
          {panel.readingOrder}
        </div>
      )}

      {/* Editable Separate Narration Box */}
      {panel.caption && (
        <div
          className={`absolute ${captionSideClass} z-10 max-w-[78%] bg-paper-50/95 border-2 border-ink-950 px-2.5 py-1 shadow-[2px_2px_0px_#16130F] pointer-events-none`}
        >
          <p className="text-[11px] sm:text-xs font-bold leading-snug text-ink-950 tracking-tight">
            {panel.caption}
          </p>
        </div>
      )}

      {/* Dialogue / Shout / Thought / Scoreboard Bubbles */}
      {panel.dialogue.map((dlg) => {
        const posClass = getPlacementClasses(dlg.placement);

        if (dlg.bubbleType === "scoreboard" || dlg.bubbleType === "time_indicator") {
          return (
            <div
              key={dlg.id}
              className={`absolute ${posClass} z-10 bg-ink-950 text-paper-50 border-2 border-paper-50 px-2 py-0.5 font-mono text-[10px] sm:text-[11px] font-bold tracking-wider uppercase shadow-manga-sm pointer-events-none`}
            >
              {dlg.text}
            </div>
          );
        }

        if (dlg.bubbleType === "shout") {
          return (
            <div
              key={dlg.id}
              className={`absolute ${posClass} z-10 max-w-[66%] bg-paper-50 border-2 border-ink-950 px-3.5 py-2 clip-shout-bubble pointer-events-none`}
            >
              <p className="font-display uppercase text-[11px] sm:text-xs tracking-wide text-center text-ink-950 leading-tight">
                {dlg.text}
              </p>
            </div>
          );
        }

        if (dlg.bubbleType === "thought") {
          return (
            <div
              key={dlg.id}
              className={`absolute ${posClass} z-10 max-w-[65%] rounded-2xl border-2 border-dashed border-ink-950 bg-paper-50/95 px-2.5 py-1.5 pointer-events-none`}
            >
              <p className="italic text-[11px] font-semibold text-ink-900 leading-tight text-center">
                {dlg.text}
              </p>
            </div>
          );
        }

        return (
          <div
            key={dlg.id}
            className={`absolute ${posClass} z-10 max-w-[65%] rounded-[50%] bg-paper-50 border-2 border-ink-950 px-3 py-2 shadow-[2px_2px_0px_#16130F] pointer-events-none`}
          >
            <p className="text-[11px] font-bold text-ink-950 leading-tight text-center">
              {dlg.text}
            </p>
          </div>
        );
      })}

      {/* Stylized Manga SFX Lettering */}
      {panel.sfx && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center">
          <span className="font-sfx text-2xl sm:text-3xl md:text-4xl tracking-wider text-white sfx-stroke -rotate-6 whitespace-nowrap leading-none">
            {panel.sfx}
          </span>
          {panel.sfxSubtext && (
            <span className="font-sans font-black text-[10px] sm:text-xs text-crimson-500 bg-ink-950/90 px-1.5 py-0.2 -mt-0.5 tracking-widest">
              {panel.sfxSubtext}
            </span>
          )}
        </div>
      )}

      {/* Interactive Source Clip Hover Cue */}
      <div className="absolute inset-x-0 top-0 h-full bg-ink-950/0 group-hover:bg-ink-950/15 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-ink-950/95 text-paper-50 border-2 border-paper-50 px-3 py-1.5 shadow-manga-sm">
          <Play className="w-3.5 h-3.5 fill-crimson-500 text-crimson-500" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
            {interactiveMode === "reader"
              ? `Watch Clip @ ${panel.sourceTimestamp.toFixed(1)}s`
              : `Inspect ${panel.panelId}`}
          </span>
        </div>
      </div>

      {/* Optional Panel Zoom Button */}
      {onZoomPanel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoomPanel(panel);
          }}
          className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-ink-950/90 text-paper-50 p-1.5 border border-paper-50/70 hover:bg-crimson-500"
          title="Zoom panel artwork"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
};
