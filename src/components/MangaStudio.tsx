"use client";

import React from "react";
import { AlertTriangle, BookOpen, Flame } from "lucide-react";
import { MangaStylePreset } from "@/types/manga";
import { useMangaStore } from "@/store/manga-store";
import { ClipUploader } from "./ClipUploader";

const STYLE_CARDS: Array<{
  id: MangaStylePreset;
  label: string;
  badge?: string;
  tagline: string;
}> = [
  {
    id: "authentic_sports_manga",
    label: "Authentic Sports Manga",
    badge: "Default",
    tagline:
      "Traditional B&W basketball manga with crisp G-pen contours, fine screentones & grounded athletic anatomy",
  },
  {
    id: "hyperkinetic_shonen_anime",
    label: "Hyperkinetic Shonen Anime",
    tagline:
      "Expressive anime faces, dynamic foreshortening, heavy brush shadows, dramatic speed lines & explosive radial bursts",
  },
  {
    id: "cinematic_anime_drama",
    label: "Cinematic Anime Drama",
    tagline:
      "Refined cel shading, clean expressive contours, atmospheric lighting, negative space & suspenseful framing",
  },
];

export const MangaStudio: React.FC = () => {
  const {
    rawVideos,
    selectedRawVideoPath,
    clips,
    systemStatus,
    preferences,
    updatePreferences,
    startGeneration,
    savedStories,
    loadStory,
  } = useMangaStore();

  const apiKeyReady = Boolean(systemStatus?.apiKeyConfigured);
  const selectedRawVideo =
    rawVideos.find((v) => v.filePath === selectedRawVideoPath) || null;
  const hasInputReady = Boolean(selectedRawVideoPath) || clips.length > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
      {/* Left 7 Columns: Basketball Highlight Clip Uploader & Generated Chapters */}
      <div className="xl:col-span-7 space-y-6">
        <ClipUploader />

        {savedStories.length > 0 && (
          <div className="border-[3px] border-ink-950 bg-paper-50 p-5 shadow-manga">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                Generated Manga Chapters ({savedStories.length})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedStories.slice(0, 4).map((st) => (
                <button
                  key={st.storyId}
                  type="button"
                  onClick={() => void loadStory(st.storyId, "reader")}
                  className="text-left flex items-center gap-3 border-2 border-ink-950 p-2.5 bg-paper-100 hover:bg-paper-200 transition-colors"
                >
                  {st.coverUrl ? (
                    <img
                      src={st.coverUrl}
                      alt={st.title}
                      className="w-14 h-16 object-cover border border-ink-950 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-16 bg-ink-950 flex items-center justify-center text-paper-50 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 ${
                          st.mode === "real"
                            ? "bg-ink-950 text-paper-50"
                            : "bg-amber-300 text-ink-950 border border-ink-950"
                        }`}
                      >
                        {st.mode === "real" ? "Gemini 4" : "Sample"}
                      </span>
                      <span className="font-mono text-[10px] text-ink-600">
                        {st.pageCount}p • {st.panelCount} panels
                      </span>
                    </div>
                    <p className="font-display text-sm uppercase tracking-wide truncate mt-0.5">
                      {st.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right 5 Columns: Gemini 4 Agent Mode, Master Presets & Independent Art Controls */}
      <div className="xl:col-span-5 space-y-5">
        <div className="border-[3px] border-ink-950 bg-paper-50 p-6 shadow-manga space-y-5">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-crimson-600">
              Dunkoma studio
            </span>
            <h2 className="font-display text-2xl uppercase tracking-wide text-ink-950">
              Make your manga
            </h2>
          </div>

          {!apiKeyReady && (
            <div className="flex items-start gap-2 border-2 border-ink-950 bg-crimson-500 p-3 text-xs text-ink-950">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>GEMINI_API_KEY not detected in `.env.local`.</strong> Add your key and restart the server.
              </div>
            </div>
          )}

          {/* 3 Improved Master Art Style Presets */}
          <div className="space-y-2">
            <label className="block font-mono text-xs font-bold uppercase">
              Manga &amp; Anime Art Style Preset
            </label>
            <div className="space-y-2">
              {STYLE_CARDS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => updatePreferences({ style: st.id })}
                  className={`w-full p-3 text-left border-2 border-ink-950 transition-all ${
                    preferences.style === st.id
                      ? "bg-ink-950 text-paper-50 shadow-manga-sm"
                      : "bg-paper-100 text-ink-950 hover:bg-paper-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display uppercase tracking-wide text-sm">
                      {st.label}
                    </span>
                    {st.badge && (
                      <span className="font-mono text-[9px] uppercase font-bold bg-crimson-500 text-ink-950 px-1.5 py-0.5">
                        {st.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-85 mt-0.5">
                    {st.tagline}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] font-bold uppercase mb-1">
              Target Pages: {preferences.targetPages}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={preferences.targetPages}
              onChange={(e) => updatePreferences({ targetPages: Number(e.target.value) })}
              className="w-full accent-crimson-500 mt-2"
            />
          </div>


          {/* Prominent Generate Manga CTA */}
          <button
            type="button"
            disabled={!hasInputReady || !apiKeyReady}
            onClick={() => void startGeneration()}
            className="w-full bg-crimson-500 hover:bg-crimson-600 disabled:bg-ink-600 text-ink-950 font-display text-2xl uppercase tracking-wider py-4 px-6 border-[3px] border-ink-950 shadow-manga flex items-center justify-center gap-3 transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <Flame className="w-6 h-6" />
            {selectedRawVideo
              ? "Generate Basketball Manga"
              : `Generate Basketball Manga (${clips.length} Clips)`}
          </button>
        </div>
      </div>
    </div>
  );
};
