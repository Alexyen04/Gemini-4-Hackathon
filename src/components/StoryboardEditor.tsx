"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  BubbleType,
  CameraShot,
  ColorTreatment,
  LayoutTemplateId,
  MangaPanel as MangaPanelType,
  MangaStylePreset,
  RendererMode,
} from "@/types/manga";
import { PageCompositionService } from "@/lib/manga/layout-engine";
import { useMangaStore } from "@/store/manga-store";
import { MangaPage } from "./MangaPage";

const TEMPLATES = PageCompositionService.listTemplates();

const VISUAL_EFFECT_OPTIONS = [
  "speed_lines_diagonal",
  "radial_focus_lines",
  "impact_burst",
  "heavy_shadows",
  "screentone_heavy",
  "negative_space",
  "sweat_droplets",
];

export const StoryboardEditor: React.FC = () => {
  const {
    currentProject,
    setCurrentProject,
    selectedPanelId,
    setSelectedPanelId,
    openVideoForPanel,
    setActiveScreen,
    setErrorBanner,
  } = useMangaStore();

  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isSavingPanel, setIsSavingPanel] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUpdatingLayout, setIsUpdatingLayout] = useState(false);

  // Selected Panel Local Form State
  const [caption, setCaption] = useState("");
  const [sfx, setSfx] = useState("");
  const [sfxSubtext, setSfxSubtext] = useState("");
  const [bubbleText, setBubbleText] = useState("");
  const [bubbleType, setBubbleType] = useState<BubbleType>("speech");
  const [cameraShot, setCameraShot] = useState<CameraShot>("medium_shot");
  const [timestamp, setTimestamp] = useState(1.0);
  const [effects, setEffects] = useState<string[]>([]);
  const [rendererMode, setRendererMode] = useState<RendererMode>("hybrid");
  const [overrideStyle, setOverrideStyle] = useState<MangaStylePreset>(
    "authentic_sports_manga"
  );
  const [overrideColor, setOverrideColor] = useState<ColorTreatment>(
    "traditional_monochrome"
  );
  const [regenPromptHint, setRegenPromptHint] = useState("");

  const activePage =
    currentProject?.storyboard.pages[
      Math.min(
        activePageIndex,
        Math.max(0, (currentProject?.storyboard.pages.length || 1) - 1)
      )
    ] || null;

  const selectedPanel: MangaPanelType | null =
    currentProject?.storyboard.pages
      .flatMap((p) => p.panels)
      .find((pan) => pan.panelId === selectedPanelId) ||
    activePage?.panels[0] ||
    null;

  useEffect(() => {
    if (!selectedPanel) return;
    setCaption(selectedPanel.caption || "");
    setSfx(selectedPanel.sfx || "");
    setSfxSubtext(selectedPanel.sfxSubtext || "");
    setBubbleText(selectedPanel.dialogue[0]?.text || "");
    setBubbleType(selectedPanel.dialogue[0]?.bubbleType || "speech");
    setCameraShot(selectedPanel.cameraShot);
    setTimestamp(selectedPanel.sourceTimestamp);
    setEffects(selectedPanel.visualEffects);
    setRendererMode(selectedPanel.illustration.renderer);
    setOverrideStyle(selectedPanel.illustration.style);
    setOverrideColor(
      selectedPanel.illustration.colorTreatment || "traditional_monochrome"
    );
    setRegenPromptHint("");
  }, [selectedPanel?.panelId]);

  if (!currentProject) {
    return (
      <div className="max-w-2xl mx-auto border-[3px] border-ink-950 bg-paper-50 p-8 text-center shadow-manga">
        <p className="font-display text-xl uppercase">
          Generate or Select a Manga Story First
        </p>
        <button
          type="button"
          onClick={() => setActiveScreen("studio")}
          className="mt-4 bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase px-5 py-2.5"
        >
          Go to Manga Studio
        </button>
      </div>
    );
  }

  const handleTemplateChange = async (
    pageId: string,
    layoutTemplate: LayoutTemplateId
  ) => {
    setIsUpdatingLayout(true);
    try {
      const res = await fetch(
        `/api/manga/${currentProject.storyId}/storyboard`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageLayoutUpdate: { pageId, layoutTemplate },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Layout update failed");
      setCurrentProject(data.project);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to switch layout"
      );
    } finally {
      setIsUpdatingLayout(false);
    }
  };

  const handleDirectionSwitch = async (readingDirection: "rtl" | "ltr") => {
    setIsUpdatingLayout(true);
    try {
      const res = await fetch(
        `/api/manga/${currentProject.storyId}/storyboard`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readingDirection }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Direction update failed");
      setCurrentProject(data.project);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to switch direction"
      );
    } finally {
      setIsUpdatingLayout(false);
    }
  };

  const handleSavePanelText = async () => {
    if (!selectedPanel) return;
    setIsSavingPanel(true);
    try {
      const nextDialogue = bubbleText.trim()
        ? [
            {
              id: selectedPanel.dialogue[0]?.id || `dlg_${selectedPanel.panelId}`,
              speaker: "Court",
              text: bubbleText.trim(),
              bubbleType,
              placement:
                currentProject.storyboard.readingDirection === "rtl"
                  ? ("bottom_left" as const)
                  : ("bottom_right" as const),
            },
          ]
        : [];

      const res = await fetch(
        `/api/manga/${currentProject.storyId}/panels/${selectedPanel.panelId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption: caption.trim() || null,
            sfx: sfx.trim() || null,
            sfxSubtext: sfxSubtext.trim() || null,
            cameraShot,
            sourceTimestamp: timestamp,
            visualEffects: effects,
            dialogue: nextDialogue,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save panel");
      setCurrentProject(data.project);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSavingPanel(false);
    }
  };

  const handleRegenerateSinglePanel = async () => {
    if (!selectedPanel) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(
        `/api/manga/${currentProject.storyId}/panels/${selectedPanel.panelId}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customPromptHint: regenPromptHint.trim() || undefined,
            overrideRenderer: rendererMode,
            overrideStyle,
            overrideColorTreatment: overrideColor,
            overrideCameraShot: cameraShot,
            overrideVisualEffects: effects,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Panel regeneration failed");
      setCurrentProject(data.project);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Regeneration failed"
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const sourceClip = selectedPanel
    ? currentProject.clips.find((c) => c.clipId === selectedPanel.sourceClipId)
    : null;

  return (
    <div className="space-y-6">
      {/* Top Narrative & Quality Overview Bar */}
      <div className="border-[3px] border-ink-950 bg-paper-50 p-5 shadow-manga">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-mono text-[11px] font-bold uppercase px-2 py-0.5 ${
                  currentProject.mode === "real"
                    ? "bg-ink-950 text-paper-50"
                    : "bg-amber-300 text-ink-950 border border-ink-950"
                }`}
              >
                {currentProject.mode === "real"
                  ? "Real Gemini 4 Mode"
                  : "Demo Mode Storyboard"}
              </span>
              <span className="font-mono text-xs text-ink-700">
                {currentProject.narrative.subtitle}
              </span>
            </div>
            <h2 className="font-display text-3xl uppercase tracking-wide mt-1">
              {currentProject.storyboard.title}
            </h2>
            <p className="text-xs sm:text-sm text-ink-800 mt-1">
              {currentProject.narrative.summary}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentProject.qualityReport && (
              <div className="border-2 border-ink-950 bg-paper-100 px-3.5 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  QA Score: {currentProject.qualityReport.overallScore}/100
                </div>
                <div className="text-[10px] text-ink-600">
                  {currentProject.qualityReport.structuralPass
                    ? "RTL/Layout Verified"
                    : "Check Warnings"}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveScreen("reader")}
              className="inline-flex items-center gap-2 bg-crimson-500 text-white font-display uppercase tracking-wider px-4 py-2.5 border-2 border-ink-950 shadow-manga-sm hover:bg-crimson-600"
            >
              <BookOpen className="w-4 h-4" />
              Open Full Reader
            </button>
          </div>
        </div>

        {/* Locked Character Reference Strip */}
        <div className="mt-4 pt-3 border-t-2 border-ink-950/15 flex items-center gap-3 overflow-x-auto">
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase text-ink-700 shrink-0">
            <UserCheck className="w-3.5 h-3.5" />
            Locked Characters:
          </span>
          {currentProject.characters.map((ch) => (
            <div
              key={ch.characterId}
              className="flex items-center gap-2 border border-ink-950 bg-paper-100 px-2.5 py-1 shrink-0"
            >
              {ch.referenceImageUrl && (
                <img
                  src={ch.referenceImageUrl}
                  alt={ch.displayName}
                  className="w-7 h-7 object-cover border border-ink-950"
                />
              )}
              <div className="text-[11px] leading-tight">
                <span className="font-bold">{ch.displayName}</span>
                {ch.jerseyNumber && (
                  <span className="ml-1 font-mono bg-ink-950 text-paper-50 px-1 text-[10px]">
                    #{ch.jerseyNumber}
                  </span>
                )}
                <div className="text-[10px] text-ink-600">
                  {ch.teamName} • {ch.monochromeUniform.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Two-Column Storyboard Editor */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
        {/* Left 7 Columns: Page Selector, Layout Switcher & Interactive Page Canvas */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink-950 bg-paper-50 p-3">
            {/* Page Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentProject.storyboard.pages.map((p, idx) => (
                <button
                  key={p.pageId}
                  type="button"
                  onClick={() => {
                    setActivePageIndex(idx);
                    if (p.panels[0]) setSelectedPanelId(p.panels[0].panelId);
                  }}
                  className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-ink-950 transition-colors ${
                    activePage?.pageId === p.pageId
                      ? "bg-ink-950 text-paper-50"
                      : "bg-paper-100 hover:bg-paper-200"
                  }`}
                >
                  Page {p.pageNumber} ({p.panels.length}p)
                </button>
              ))}
            </div>

            {/* Layout Template & Direction Controls */}
            {activePage && (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  disabled={isUpdatingLayout}
                  value={activePage.layoutTemplate}
                  onChange={(e) =>
                    void handleTemplateChange(
                      activePage.pageId,
                      e.target.value as LayoutTemplateId
                    )
                  }
                  className="border-2 border-ink-950 bg-paper-100 px-2.5 py-1.5 font-mono text-xs font-bold"
                >
                  {TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      Layout: {tpl.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activePage && (
            <MangaPage
              storyId={currentProject.storyId}
              storyTitle={currentProject.storyboard.title}
              page={activePage}
              readingDirection={currentProject.storyboard.readingDirection}
              selectedPanelId={selectedPanel?.panelId}
              interactiveMode="editor"
              onClickPanel={(pan) => setSelectedPanelId(pan.panelId)}
            />
          )}
        </div>

        {/* Right 5 Columns: Individual Panel Editor & Single-Panel Regeneration */}
        <div className="xl:col-span-5 border-[3px] border-ink-950 bg-paper-50 p-5 shadow-manga space-y-4">
          {selectedPanel ? (
            <>
              <div className="flex items-center justify-between border-b-2 border-ink-950 pb-3">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-crimson-600">
                    Panel Inspector • Reading Order #{selectedPanel.readingOrder}
                  </span>
                  <h3 className="font-display text-xl uppercase tracking-wide">
                    {selectedPanel.panelId} —{" "}
                    {selectedPanel.narrativeBeat.replace(/_/g, " ")}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => openVideoForPanel(selectedPanel)}
                  className="inline-flex items-center gap-1.5 bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase px-3 py-1.5 hover:bg-crimson-500 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play Clip ({selectedPanel.sourceTimestamp.toFixed(1)}s)
                </button>
              </div>

              {/* Lettering & Overlay Editing */}
              <div className="space-y-3">
                <div>
                  <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                    Narration Caption Box
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Leave blank for pure visual panel"
                    className="w-full border-2 border-ink-950 bg-paper-100 px-3 py-1.5 text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                      Sound Effect (SFX)
                    </label>
                    <input
                      type="text"
                      value={sfx}
                      onChange={(e) => setSfx(e.target.value)}
                      placeholder="BOOOOM!! / SWISH!"
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                      Secondary SFX (Optional)
                    </label>
                    <input
                      type="text"
                      value={sfxSubtext}
                      onChange={(e) => setSfxSubtext(e.target.value)}
                      placeholder="Optional sub-SFX"
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                      Dialogue / Callout Bubble
                    </label>
                    <input
                      type="text"
                      value={bubbleText}
                      onChange={(e) => setBubbleText(e.target.value)}
                      placeholder="Short court call or thought..."
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                      Bubble Style
                    </label>
                    <select
                      value={bubbleType}
                      onChange={(e) =>
                        setBubbleType(e.target.value as BubbleType)
                      }
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="speech">Speech</option>
                      <option value="shout">Shout Burst</option>
                      <option value="thought">Thought</option>
                      <option value="scoreboard">Scoreboard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                      Camera Perspective
                    </label>
                    <select
                      value={cameraShot}
                      onChange={(e) =>
                        setCameraShot(e.target.value as CameraShot)
                      }
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="extreme_closeup">Extreme Closeup</option>
                      <option value="closeup">Closeup</option>
                      <option value="medium_shot">Medium Shot</option>
                      <option value="wide_shot">Wide Arena Shot</option>
                      <option value="low_angle">Heroic Low Angle</option>
                      <option value="high_angle">High Court Angle</option>
                      <option value="dutch_angle">Dutch Tilt</option>
                      <option value="behind_player">Behind Shooter</option>
                      <option value="dynamic_action">Dynamic Action</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] font-bold uppercase mb-1">
                      Source Beat Timestamp: {timestamp.toFixed(2)}s
                    </label>
                    <input
                      type="range"
                      min={0.05}
                      max={Math.max(0.2, (sourceClip?.durationSec || 3) - 0.05)}
                      step={0.05}
                      value={timestamp}
                      onChange={(e) => setTimestamp(Number(e.target.value))}
                      className="w-full accent-crimson-500 mt-1.5"
                    />
                  </div>
                </div>

                {/* Visual Effect Pills */}
                <div>
                  <label className="block font-mono text-[11px] font-bold uppercase mb-1.5">
                    Manga Visual Effects
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VISUAL_EFFECT_OPTIONS.map((eff) => {
                      const active = effects.includes(eff);
                      return (
                        <button
                          key={eff}
                          type="button"
                          onClick={() =>
                            setEffects(
                              active
                                ? effects.filter((x) => x !== eff)
                                : [...effects, eff]
                            )
                          }
                          className={`font-mono text-[10px] font-bold px-2 py-1 border border-ink-950 ${
                            active
                              ? "bg-ink-950 text-paper-50"
                              : "bg-paper-100 text-ink-800"
                          }`}
                        >
                          {eff.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingPanel}
                  onClick={() => void handleSavePanelText()}
                  className="w-full bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase py-2.5 border-2 border-ink-950 hover:bg-ink-800 flex items-center justify-center gap-2"
                >
                  {isSavingPanel ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Text &amp; Overlay Edits
                </button>
              </div>

              {/* Isolated Single-Panel Carbon Regeneration Section */}
              <div className="border-t-2 border-ink-950 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm uppercase tracking-wide">
                    Regenerate Individual Panel Artwork
                  </span>
                  <span className="font-mono text-[10px] text-ink-600">
                    v{selectedPanel.illustration.generationCount || 1}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                      Renderer
                    </label>
                    <select
                      value={rendererMode}
                      onChange={(e) =>
                        setRendererMode(e.target.value as RendererMode)
                      }
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="hybrid">Hybrid + SVG</option>
                      <option value="svg_vector">Full SVG</option>
                      <option value="frame_guided">Frame Ink</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                      Style Preset
                    </label>
                    <select
                      value={overrideStyle}
                      onChange={(e) =>
                        setOverrideStyle(e.target.value as MangaStylePreset)
                      }
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="hyperkinetic_shonen_anime">
                        Hyperkinetic Shonen
                      </option>
                      <option value="authentic_sports_manga">
                        Authentic Manga
                      </option>
                      <option value="cinematic_anime_drama">
                        Cinematic Anime
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                      Color Mode
                    </label>
                    <select
                      value={overrideColor}
                      onChange={(e) =>
                        setOverrideColor(e.target.value as ColorTreatment)
                      }
                      className="w-full border-2 border-ink-950 bg-paper-100 px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="traditional_monochrome">Monochrome</option>
                      <option value="full_anime_color">Anime Color</option>
                      <option value="selective_color">Selective Color</option>
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  value={regenPromptHint}
                  onChange={(e) => setRegenPromptHint(e.target.value)}
                  placeholder="Optional artistic tweak (e.g. heavier radial focus lines & closer zoom)..."
                  className="w-full border-2 border-ink-950 bg-paper-100 px-2.5 py-1.5 text-xs"
                />

                <button
                  type="button"
                  disabled={isRegenerating}
                  onClick={() => void handleRegenerateSinglePanel()}
                  className="w-full bg-crimson-500 text-white font-display uppercase tracking-wider py-2.5 border-2 border-ink-950 shadow-manga-sm hover:bg-crimson-600 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Regenerate Only {selectedPanel.panelId}
                </button>

                <p className="text-[11px] text-ink-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  Updates only this panel and its page export without restarting the chapter.
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-700">
              Click any panel on the page canvas to edit dialogue, SFX, layout, or regenerate artwork.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
