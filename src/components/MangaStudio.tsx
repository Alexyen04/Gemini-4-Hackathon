"use client";

import React from "react";
import {
  AlertTriangle,
  BookOpen,
  Cpu,
  Flame,
  Info,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  ActionIntensity,
  ColorTreatment,
  MangaStylePreset,
  ReferenceInfluence,
  StorytellingFocus,
} from "@/types/manga";
import { useMangaStore } from "@/store/manga-store";
import { ClipUploader } from "./ClipUploader";

const STYLE_CARDS: Array<{
  id: MangaStylePreset;
  label: string;
  badge?: string;
  tagline: string;
}> = [
  {
    id: "hyperkinetic_shonen_anime",
    label: "Hyperkinetic Shonen Anime",
    badge: "Default",
    tagline:
      "Expressive anime faces, dynamic foreshortening, heavy brush shadows, dramatic speed lines & explosive radial bursts",
  },
  {
    id: "authentic_sports_manga",
    label: "Authentic Sports Manga",
    tagline:
      "Traditional B&W basketball manga with crisp G-pen contours, 45° halftone screentones & grounded athletic anatomy",
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
    clips,
    mode,
    setMode,
    systemStatus,
    preferences,
    updatePreferences,
    startGeneration,
    savedStories,
    loadStory,
  } = useMangaStore();

  const apiKeyReady = Boolean(systemStatus?.apiKeyConfigured);
  const refStatus = systemStatus?.references;

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
                        {st.mode === "real" ? "Gemini 4" : "Demo"}
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
              Director &amp; Visual Style Configuration
            </span>
            <h2 className="font-display text-2xl uppercase tracking-wide text-ink-950">
              Gemini 4 Anime &amp; Manga Director
            </h2>
          </div>

          {/* Pipeline Mode Selector */}
          <div className="space-y-2">
            <label className="block font-mono text-xs font-bold uppercase">
              Execution Mode
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode("real")}
                className={`p-3 text-left border-2 border-ink-950 transition-all ${
                  mode === "real"
                    ? "bg-ink-950 text-paper-50 shadow-manga-sm"
                    : "bg-paper-100 text-ink-900 hover:bg-paper-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase">
                    Real AI Mode
                  </span>
                  <Cpu className="w-4 h-4 text-crimson-500" />
                </div>
                <p className="text-[11px] opacity-85 mt-1">
                  Live Gemini 4 Carbon + Argon + Hydrogen
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("demo")}
                className={`p-3 text-left border-2 border-ink-950 transition-all ${
                  mode === "demo"
                    ? "bg-amber-300 text-ink-950 shadow-manga-sm"
                    : "bg-paper-100 text-ink-900 hover:bg-paper-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase">
                    Demo Mode
                  </span>
                  <Sparkles className="w-4 h-4" />
                </div>
                <p className="text-[11px] opacity-90 mt-1">
                  Sample narrative + Real local Hybrid/SVG renderer
                </p>
              </button>
            </div>

            {mode === "real" && !apiKeyReady && (
              <div className="flex items-start gap-2 bg-crimson-500/10 border-2 border-crimson-600 p-3 text-xs text-ink-950">
                <AlertTriangle className="w-4 h-4 text-crimson-600 shrink-0 mt-0.5" />
                <div>
                  <strong>GEMINI_API_KEY not detected in `.env.local`.</strong>{" "}
                  Add your key to `.env.local` and restart to run Real AI Mode,
                  or switch to <strong>Demo Mode</strong>.
                </div>
              </div>
            )}
          </div>

          {/* Active Gemini 4 Model Roster & Stage 0 Local Reference Status */}
          {systemStatus && (
            <div className="bg-ink-950 text-paper-50 p-3.5 border-2 border-ink-950 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-paper-300">Stage 0 Ref &amp; Director:</span>
                <span className="font-bold text-crimson-500">
                  {systemStatus.models.mangaDirectorAndIllustrator}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper-300">Clip Understanding:</span>
                <span className="font-bold text-emerald-400">
                  {systemStatus.models.clipUnderstanding}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-paper-300">Quality Validation:</span>
                <span className="font-bold text-sky-400">
                  {systemStatus.models.qualityReviewer}
                </span>
              </div>
              {refStatus && (
                <div className="flex justify-between pt-1 border-t border-paper-200/15">
                  <span className="text-paper-300">data/manga_refs/:</span>
                  <span
                    className={`font-bold ${
                      refStatus.isEmpty ? "text-amber-300" : "text-emerald-400"
                    }`}
                  >
                    {refStatus.isEmpty
                      ? "Empty (Built-in Skill Active)"
                      : `${refStatus.chapterCount} ch / ${refStatus.pageCount} pages${
                          refStatus.profileCached ? " (Cached)" : ""
                        }`}
                  </span>
                </div>
              )}
            </div>
          )}

          {refStatus?.warning && (
            <div className="flex items-start gap-2 bg-paper-200/80 border border-ink-950/40 px-3 py-2 text-[11px] text-ink-800">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-700" />
              <span>{refStatus.warning}</span>
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
                      <span className="font-mono text-[9px] uppercase font-bold bg-crimson-500 text-white px-1.5 py-0.5">
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

          {/* 4 Independent Art Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                Color Treatment
              </label>
              <select
                value={preferences.colorTreatment}
                onChange={(e) =>
                  updatePreferences({
                    colorTreatment: e.target.value as ColorTreatment,
                  })
                }
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-2 text-xs font-bold"
              >
                <option value="traditional_monochrome">
                  Traditional Monochrome
                </option>
                <option value="full_anime_color">Full Anime Color</option>
                <option value="selective_color">
                  Monochrome + Selective Color
                </option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                Action Intensity
              </label>
              <select
                value={preferences.actionIntensity}
                onChange={(e) =>
                  updatePreferences({
                    actionIntensity: e.target.value as ActionIntensity,
                  })
                }
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-2 text-xs font-bold"
              >
                <option value="grounded">Grounded</option>
                <option value="dramatic">Dramatic</option>
                <option value="explosive">Explosive</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                Reference Influence
              </label>
              <select
                value={preferences.referenceInfluence}
                onChange={(e) =>
                  updatePreferences({
                    referenceInfluence: e.target.value as ReferenceInfluence,
                  })
                }
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-2 text-xs font-bold"
              >
                <option value="light">Light (Broad Conventions)</option>
                <option value="balanced">Balanced (Recommended)</option>
                <option value="strong">Strong (Closely Guided)</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                Storytelling Focus
              </label>
              <select
                value={preferences.storytellingFocus}
                onChange={(e) =>
                  updatePreferences({
                    storytellingFocus: e.target.value as StorytellingFocus,
                  })
                }
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-2 text-xs font-bold"
              >
                <option value="action_focused">Action Focused</option>
                <option value="balanced">Balanced</option>
                <option value="emotion_focused">Emotion Focused</option>
              </select>
            </div>
          </div>

          {/* Reading Direction & Target Page Count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                Reading Direction
              </label>
              <select
                value={preferences.readingDirection}
                onChange={(e) =>
                  updatePreferences({
                    readingDirection: e.target.value as "rtl" | "ltr",
                  })
                }
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-2 text-xs font-bold"
              >
                <option value="rtl">Right-to-Left (Traditional JP)</option>
                <option value="ltr">Left-to-Right (Western)</option>
              </select>
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
                onChange={(e) =>
                  updatePreferences({ targetPages: Number(e.target.value) })
                }
                className="w-full accent-crimson-500 mt-2"
              />
            </div>
          </div>

          {/* Optional Gemini 4 Neon Pass */}
          {mode === "real" && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none border-2 border-ink-950/20 p-2.5 bg-paper-100">
              <input
                type="checkbox"
                checked={preferences.useLayoutOptimizerNeon}
                onChange={(e) =>
                  updatePreferences({
                    useLayoutOptimizerNeon: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-crimson-500"
              />
              <span className="text-xs font-semibold">
                Enable optional <code>gemini-4-neon</code> layout rhythm &amp; caption polish pass
              </span>
            </label>
          )}

          {/* Optional Director Instructions */}
          <div>
            <label className="block font-mono text-[11px] font-bold uppercase mb-1">
              Director Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={preferences.directorNotes || ""}
              onChange={(e) =>
                updatePreferences({ directorNotes: e.target.value })
              }
              placeholder="e.g., Emphasize intense anime eye closeups before the buzzer-beater..."
              className="w-full border-2 border-ink-950 bg-paper-100 px-3 py-2 text-xs"
            />
          </div>

          {/* Prominent Generate Manga CTA */}
          <button
            type="button"
            disabled={clips.length === 0 || (mode === "real" && !apiKeyReady)}
            onClick={() => void startGeneration()}
            className="w-full bg-crimson-500 hover:bg-crimson-600 disabled:bg-ink-600 text-white font-display text-2xl uppercase tracking-wider py-4 px-6 border-[3px] border-ink-950 shadow-manga flex items-center justify-center gap-3 transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            {mode === "real" ? (
              <Flame className="w-6 h-6 fill-amber-300 text-amber-300" />
            ) : (
              <Wand2 className="w-6 h-6" />
            )}
            Generate Basketball Manga ({clips.length} Clips)
          </button>
        </div>
      </div>
    </div>
  );
};
