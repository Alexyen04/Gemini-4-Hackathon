"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Columns,
  Download,
  Edit3,
  Eye,
  Hash,
  Play,
  Rows,
  X,
} from "lucide-react";
import { useMangaStore } from "@/store/manga-store";
import { MangaPage } from "./MangaPage";

export const MangaReader: React.FC = () => {
  const {
    currentProject,
    openVideoForPanel,
    zoomedPanel,
    setZoomedPanel,
    setActiveScreen,
    setSelectedPanelId,
  } = useMangaStore();

  const [viewMode, setViewMode] = useState<"scroll" | "single_page">("scroll");
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [showOrderBadges, setShowOrderBadges] = useState(true);

  const pages = currentProject?.storyboard.pages || [];
  const isRtl = currentProject?.storyboard.readingDirection === "rtl";

  // Keyboard navigation in single-page mode (respects RTL vs LTR direction!)
  useEffect(() => {
    if (viewMode !== "single_page" || pages.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setCurrentPageIdx((idx) =>
          isRtl
            ? Math.min(pages.length - 1, idx + 1)
            : Math.max(0, idx - 1)
        );
      } else if (e.key === "ArrowRight") {
        setCurrentPageIdx((idx) =>
          isRtl
            ? Math.max(0, idx - 1)
            : Math.min(pages.length - 1, idx + 1)
        );
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewMode, pages.length, isRtl]);

  if (!currentProject || pages.length === 0) {
    return (
      <div className="max-w-2xl mx-auto border-[3px] border-ink-950 bg-paper-50 p-8 text-center shadow-manga">
        <BookOpen className="w-10 h-10 mx-auto mb-2 text-ink-800" />
        <h2 className="font-display text-2xl uppercase">
          No Completed Manga Loaded
        </h2>
        <p className="text-xs text-ink-700 mt-1">
          Upload clips or load sample highlights in the Studio to generate your interactive basketball manga.
        </p>
        <button
          type="button"
          onClick={() => setActiveScreen("studio")}
          className="mt-4 bg-crimson-500 text-white font-display uppercase tracking-wider px-5 py-2.5 border-2 border-ink-950"
        >
          Open Manga Studio
        </button>
      </div>
    );
  }

  const progressPct =
    viewMode === "single_page"
      ? Math.round(((currentPageIdx + 1) / pages.length) * 100)
      : 100;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-6 bg-screentone-dark min-h-[calc(100vh-72px)] py-6 px-3 sm:px-6 text-paper-50">
      {/* Sticky Reader Toolbar */}
      <div className="max-w-[960px] mx-auto mb-6 bg-ink-900 border-2 border-paper-200/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-3 z-30 shadow-xl">
        <div className="flex items-center gap-3">
          {currentProject.mode === "demo" && (
            <span className="bg-amber-300 text-ink-950 font-mono text-[10px] font-bold uppercase px-2 py-0.5">
              Demo Mode
            </span>
          )}
          <div>
            <h1 className="font-display text-lg sm:text-xl uppercase tracking-wider text-paper-50 leading-none">
              {currentProject.storyboard.title}
            </h1>
            <p className="font-mono text-[11px] text-paper-300 mt-0.5">
              {currentProject.narrative.subtitle} • Click any panel to watch original play
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Scroll vs Page-by-Page Mode */}
          <div className="inline-flex border border-paper-200/40">
            <button
              type="button"
              onClick={() => setViewMode("scroll")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase ${
                viewMode === "scroll"
                  ? "bg-paper-50 text-ink-950"
                  : "text-paper-200 hover:bg-ink-800"
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              Scroll
            </button>
            <button
              type="button"
              onClick={() => setViewMode("single_page")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase ${
                viewMode === "single_page"
                  ? "bg-paper-50 text-ink-950"
                  : "text-paper-200 hover:bg-ink-800"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Paged
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowOrderBadges(!showOrderBadges)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 border border-paper-200/40 font-mono text-[11px] font-bold uppercase ${
              showOrderBadges
                ? "bg-ink-700 text-paper-50"
                : "text-paper-300 hover:bg-ink-800"
            }`}
            title="Toggle reading order numbers"
          >
            <Hash className="w-3.5 h-3.5" />
            Order
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen("storyboard")}
            className="inline-flex items-center gap-1.5 bg-paper-50 text-ink-950 font-mono text-[11px] font-bold uppercase px-3 py-1.5 hover:bg-crimson-500 hover:text-white transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Panels
          </button>
        </div>
      </div>

      {/* Reading Direction Banner */}
      <div className="max-w-[780px] mx-auto mb-5 flex items-center justify-between bg-ink-950/90 border border-paper-200/20 px-4 py-2 font-mono text-xs text-paper-200">
        <span className="inline-flex items-center gap-2">
          <Eye className="w-4 h-4 text-crimson-500" />
          Reading Flow:{" "}
          <strong className="text-white">
            {isRtl
              ? "Right-to-Left (Start Top-Right Panel #1 ◀)"
              : "Left-to-Right (Start Top-Left Panel #1 ▶)"}
          </strong>
        </span>
        <a
          href={`/api/manga/${currentProject.storyId}/export?page=1`}
          download
          className="inline-flex items-center gap-1 text-amber-300 hover:underline font-bold"
        >
          <Download className="w-3.5 h-3.5" />
          Download Page 1 PNG
        </a>
      </div>

      {/* Manga Pages Display */}
      {viewMode === "scroll" ? (
        <div className="space-y-12 pb-16">
          {pages.map((page) => (
            <MangaPage
              key={page.pageId}
              storyId={currentProject.storyId}
              storyTitle={currentProject.storyboard.title}
              page={page}
              readingDirection={currentProject.storyboard.readingDirection}
              showOrderBadges={showOrderBadges}
              interactiveMode="reader"
              onClickPanel={(panel) => openVideoForPanel(panel)}
              onZoomPanel={(panel) => setZoomedPanel(panel)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-5 pb-12">
          <MangaPage
            key={pages[currentPageIdx].pageId}
            storyId={currentProject.storyId}
            storyTitle={currentProject.storyboard.title}
            page={pages[currentPageIdx]}
            readingDirection={currentProject.storyboard.readingDirection}
            showOrderBadges={showOrderBadges}
            interactiveMode="reader"
            onClickPanel={(panel) => openVideoForPanel(panel)}
            onZoomPanel={(panel) => setZoomedPanel(panel)}
          />

          {/* RTL-Aware Paged Navigation Controls */}
          <div className="max-w-[780px] mx-auto flex items-center justify-between bg-ink-900 border border-paper-200/30 p-3">
            <button
              type="button"
              disabled={
                isRtl ? currentPageIdx >= pages.length - 1 : currentPageIdx <= 0
              }
              onClick={() =>
                setCurrentPageIdx((i) => (isRtl ? i + 1 : i - 1))
              }
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase px-4 py-2 bg-paper-50 text-ink-950 disabled:opacity-30"
            >
              <ArrowLeft className="w-4 h-4" />
              {isRtl ? "Next Page (RTL)" : "Prev Page"}
            </button>

            <div className="text-center font-mono text-xs">
              <div>
                Page {currentPageIdx + 1} of {pages.length} ({progressPct}%)
              </div>
            </div>

            <button
              type="button"
              disabled={
                isRtl ? currentPageIdx <= 0 : currentPageIdx >= pages.length - 1
              }
              onClick={() =>
                setCurrentPageIdx((i) => (isRtl ? i - 1 : i + 1))
              }
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase px-4 py-2 bg-paper-50 text-ink-950 disabled:opacity-30"
            >
              {isRtl ? "Prev Page (RTL)" : "Next Page"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full-Resolution Panel Zoom Lightbox */}
      <AnimatePresence>
        {zoomedPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedPanel(null)}
            className="fixed inset-0 z-50 bg-ink-950/90 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl w-full bg-paper-50 text-ink-950 border-[3px] border-ink-950 p-4 space-y-3 shadow-manga-crimson"
            >
              <div className="flex items-center justify-between border-b-2 border-ink-950 pb-2">
                <span className="font-display uppercase text-lg">
                  {zoomedPanel.panelId} • {zoomedPanel.cameraShot.replace(/_/g, " ")}
                </span>
                <button
                  type="button"
                  onClick={() => setZoomedPanel(null)}
                  className="p-1 hover:bg-paper-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {zoomedPanel.illustration.assetUrl && (
                <img
                  src={zoomedPanel.illustration.assetUrl}
                  alt={zoomedPanel.description}
                  className="w-full max-h-[68vh] object-contain border-2 border-ink-950 bg-paper-100"
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-xs font-medium text-ink-800 max-w-lg">
                  {zoomedPanel.description}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const p = zoomedPanel;
                      setZoomedPanel(null);
                      openVideoForPanel(p);
                    }}
                    className="inline-flex items-center gap-1.5 bg-crimson-500 text-white font-mono text-xs font-bold uppercase px-3 py-1.5 border border-ink-950"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Watch Clip
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPanelId(zoomedPanel.panelId);
                      setZoomedPanel(null);
                      setActiveScreen("storyboard");
                    }}
                    className="inline-flex items-center gap-1.5 bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase px-3 py-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit / Regenerate
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
