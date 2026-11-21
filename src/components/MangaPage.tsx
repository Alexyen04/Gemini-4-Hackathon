"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import {
  MangaPage as MangaPageType,
  MangaPanel as MangaPanelType,
  ReadingDirection,
} from "@/types/manga";
import { MangaPanel } from "./MangaPanel";

interface MangaPageProps {
  storyId: string;
  storyTitle: string;
  page: MangaPageType;
  readingDirection: ReadingDirection;
  showOrderBadges?: boolean;
  selectedPanelId?: string | null;
  interactiveMode?: "reader" | "editor";
  onClickPanel: (panel: MangaPanelType) => void;
  onZoomPanel?: (panel: MangaPanelType) => void;
}

export const MangaPage: React.FC<MangaPageProps> = ({
  storyId,
  storyTitle,
  page,
  readingDirection,
  showOrderBadges = true,
  selectedPanelId = null,
  interactiveMode = "reader",
  onClickPanel,
  onZoomPanel,
}) => {
  return (
    <div className="w-full max-w-[780px] mx-auto bg-paper-50 border-[3px] border-ink-950 shadow-manga-lg p-3 sm:p-5 md:p-7 transition-all">
      {/* Manga Folio Running Header */}
      <div className="flex items-center justify-between border-b-2 border-ink-950 pb-2 mb-3 sm:mb-4 text-ink-900">
        <div className="flex items-center gap-2">
          <span className="font-display uppercase tracking-wider text-xs sm:text-sm">
            {storyTitle}
          </span>
          <span className="hidden sm:inline font-mono text-[11px] text-ink-600">
            • {page.layoutTemplate.replace(/_/g, " ")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase bg-ink-950 text-paper-50 px-2 py-0.5">
            {readingDirection === "rtl" ? (
              <>
                <ArrowLeft className="w-3 h-3 text-crimson-500" />
                RTL Read
              </>
            ) : (
              <>
                LTR Read
                <ArrowRight className="w-3 h-3 text-crimson-500" />
              </>
            )}
          </span>

          <span className="font-mono text-xs font-bold">
            P.{String(page.pageNumber).padStart(2, "0")}
          </span>

          <a
            href={`/api/manga/${storyId}/export?page=${page.pageNumber}`}
            download
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold border border-ink-950 px-2 py-0.5 hover:bg-ink-950 hover:text-paper-50 transition-colors"
            title="Download high-res print PNG of this page"
          >
            <Download className="w-3 h-3" />
            PNG
          </a>
        </div>
      </div>

      {/* Deterministic Normalized [0, 1] Manga Page Canvas */}
      <div className="relative w-full aspect-[10/14] bg-paper-100">
        {page.panels.map((panel) => (
          <MangaPanel
            key={panel.panelId}
            panel={panel}
            readingDirection={readingDirection}
            showOrderBadges={showOrderBadges}
            isSelected={selectedPanelId === panel.panelId}
            interactiveMode={interactiveMode}
            onClickPanel={onClickPanel}
            onZoomPanel={onZoomPanel}
          />
        ))}
      </div>

      {/* Page Footer */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-ink-600">
        <span>
          Click any panel to play verified basketball footage at exact beat timestamp
        </span>
        <span className="font-bold text-ink-950">— {page.pageNumber} —</span>
      </div>
    </div>
  );
};
