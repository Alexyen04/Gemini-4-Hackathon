"use client";

import React, { useEffect } from "react";
import {
  AlertCircle,
  BookOpen,
  Clapperboard,
  Cpu,
  X,
} from "lucide-react";
import { AppScreen, useMangaStore } from "@/store/manga-store";
import { MangaStudio } from "./MangaStudio";
import { GenerationProgress } from "./GenerationProgress";
import { MangaReader } from "./MangaReader";
import { VideoModal } from "./VideoModal";

interface WorkspaceShellProps {
  initialScreen?: AppScreen;
  initialStoryId?: string;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  initialScreen = "studio",
  initialStoryId,
}) => {
  const {
    activeScreen,
    setActiveScreen,
    fetchInitialData,
    activeJob,
    currentProject,
    videoModalTarget,
    closeVideoModal,
    errorBanner,
    setErrorBanner,
  } = useMangaStore();

  useEffect(() => {
    setActiveScreen(initialScreen);
    void fetchInitialData(initialStoryId);
  }, [initialScreen, initialStoryId]);

  const navItems: Array<{
    id: AppScreen;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: "studio",
      label: "1. Manga Studio",
      icon: <Clapperboard className="w-4 h-4" />,
    },
    {
      id: "progress",
      label: "2. Pipeline Status",
      icon: <Cpu className="w-4 h-4" />,
      badge:
        activeJob?.status === "running"
          ? "LIVE"
          : activeJob?.status === "failed"
          ? "ERR"
          : undefined,
    },
    {
      id: "reader",
      label: "3. Interactive Reader",
      icon: <BookOpen className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Editorial Sumi-Ink Top Masthead */}
      <header className="bg-paper-50 text-ink-950 border-b-[3px] border-ink-950 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveScreen("studio")}
            className="flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 bg-crimson-500 border-2 border-ink-950 flex items-center justify-center font-display text-xl tracking-tighter text-ink-950 shadow-manga-sm">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl sm:text-2xl tracking-wider uppercase leading-none">
                  DUNKOMA
                </span>
                <span className="hidden md:inline-block font-mono text-[10px] font-bold bg-ink-950 text-paper-50 px-1.5 py-0.5 uppercase">
                  Studio
                </span>
              </div>
              <p className="text-[11px] font-mono text-ink-700 hidden sm:block">
                Real plays. Reimagined panels.
              </p>
            </div>
          </button>

          {/* 4-Screen Studio Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            {navItems.map((item) => {
              const active = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 font-mono text-[11px] sm:text-xs font-bold uppercase border-2 transition-all whitespace-nowrap ${
                    active
                      ? "bg-ink-950 text-paper-50 border-ink-950 shadow-manga-crimson"
                      : "bg-paper-50 text-ink-950 border-ink-950 hover:bg-paper-200"
                  }`}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.label.split(" ")[1]}</span>
                  {item.badge && (
                    <span className="bg-crimson-500 text-ink-950 text-[9px] px-1.5 py-0.2">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Error Notification Banner */}
      {errorBanner && (
        <div className="bg-crimson-600 text-ink-950 border-b-2 border-ink-950 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="p-1 hover:bg-crimson-500"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Active Screen */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeScreen === "studio" && <MangaStudio />}
        {activeScreen === "progress" && <GenerationProgress />}
        {activeScreen === "reader" && <MangaReader />}
      </main>

      {/* Global Interactive Panel-to-Video Playback Modal */}
      <VideoModal target={videoModalTarget} onClose={closeVideoModal} />
    </div>
  );
};
