"use client";

import React, { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Film,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { NormalizedClip } from "@/types/manga";
import { useMangaStore } from "@/store/manga-store";

export const ClipUploader: React.FC = () => {
  const {
    clips,
    isUploading,
    isLoadingClips,
    uploadVideoFiles,
    loadSampleHighlights,
    reorderClip,
    removeClip,
    updateClipDetails,
  } = useMangaStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [consolidatedMode, setConsolidatedMode] = useState(false);
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await uploadVideoFiles(Array.from(fileList), consolidatedMode);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* Upload Dropzone & Instant Sample Highlights Action */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void handleFilesSelected(e.dataTransfer.files);
        }}
        className={`border-[3px] border-ink-950 bg-paper-50 p-6 shadow-manga transition-colors ${
          dragActive ? "bg-paper-200 border-crimson-500" : ""
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-ink-950/15">
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-crimson-600">
              Stage 1 • Highlight Ingestion
            </span>
            <h2 className="font-display text-2xl uppercase tracking-wide text-ink-950">
              Basketball Highlight Clips
            </h2>
          </div>

          <button
            type="button"
            disabled={isLoadingClips || isUploading}
            onClick={() => void loadSampleHighlights()}
            className="inline-flex items-center justify-center gap-2 bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase px-4 py-2.5 border-2 border-ink-950 shadow-manga-sm hover:bg-crimson-500 transition-colors disabled:opacity-50"
          >
            {isLoadingClips ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-court-400" />
            )}
            Load 5 Sample Highlights
          </button>
        </div>

        {/* Consolidated vs Multi-Clip Toggle */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consolidatedMode}
              onChange={(e) => setConsolidatedMode(e.target.checked)}
              className="w-4 h-4 accent-crimson-500"
            />
            <span className="text-xs font-semibold text-ink-800">
              Single Consolidated Highlight Video (auto-detect &amp; slice play segments via FFmpeg)
            </span>
          </label>
          <span className="font-mono text-[11px] text-ink-600">
            MP4 • MOV • WebM • MKV
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          multiple={!consolidatedMode}
          onChange={(e) => void handleFilesSelected(e.target.files)}
          className="hidden"
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 w-full border-2 border-dashed border-ink-950 bg-screentone-subtle hover:bg-paper-200/70 py-7 px-4 flex flex-col items-center justify-center gap-2 transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin text-crimson-500" />
              <span className="font-mono text-xs font-bold uppercase">
                Extracting FFmpeg Keyframes &amp; Probing Video Streams...
              </span>
            </>
          ) : (
            <>
              <Upload className="w-7 h-7 text-ink-900" />
              <span className="font-display text-lg uppercase tracking-wide">
                Drop Basketball Video Clips Here or Click to Browse
              </span>
              <span className="text-xs text-ink-700">
                Upload 3–5 chronological plays (dunks, threes, blocks, game-winners) or 1 consolidated reel
              </span>
            </>
          )}
        </button>
      </div>

      {/* Loaded Clip Sequence */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-700">
            Active Story Sequence ({clips.length} {clips.length === 1 ? "Clip" : "Clips"})
          </span>
          {clips.length > 0 && (
            <span className="font-mono text-[11px] text-ink-600">
              Chronological order preserved in narrative planning
            </span>
          )}
        </div>

        {clips.length === 0 ? (
          <div className="border-2 border-ink-950/30 bg-paper-50/60 p-8 text-center">
            <Film className="w-8 h-8 mx-auto mb-2 text-ink-600" />
            <p className="font-semibold text-sm text-ink-800">
              No highlight clips loaded yet.
            </p>
            <p className="text-xs text-ink-600 mt-1">
              Upload your own basketball MP4 clips above or click{" "}
              <strong>Load 5 Sample Highlights</strong> to generate a playable 5-clip comeback sequence.
            </p>
          </div>
        ) : (
          clips.map((clip, idx) => (
            <ClipItemCard
              key={clip.clipId}
              clip={clip}
              index={idx}
              total={clips.length}
              isExpanded={expandedClipId === clip.clipId}
              onToggleExpand={() =>
                setExpandedClipId(
                  expandedClipId === clip.clipId ? null : clip.clipId
                )
              }
              onMoveUp={() => void reorderClip(clip.clipId, "up")}
              onMoveDown={() => void reorderClip(clip.clipId, "down")}
              onRemove={() => void removeClip(clip.clipId)}
              onSaveDetails={(title, meta) =>
                void updateClipDetails(clip.clipId, title, meta)
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

interface ClipItemCardProps {
  clip: NormalizedClip;
  index: number;
  total: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSaveDetails: (
    title: string,
    metadata: Partial<NormalizedClip["metadata"]>
  ) => void;
}

const ClipItemCard: React.FC<ClipItemCardProps> = ({
  clip,
  index,
  total,
  isExpanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSaveDetails,
}) => {
  const [title, setTitle] = useState(clip.title);
  const [homeTeam, setHomeTeam] = useState(clip.metadata.homeTeam || "");
  const [awayTeam, setAwayTeam] = useState(clip.metadata.awayTeam || "");
  const [quarter, setQuarter] = useState(clip.metadata.quarter || "");
  const [gameClock, setGameClock] = useState(clip.metadata.gameClock || "");
  const [score, setScore] = useState(clip.metadata.score || "");
  const [playersText, setPlayersText] = useState(
    clip.metadata.players.join(", ")
  );
  const [eventDescription, setEventDescription] = useState(
    clip.metadata.eventDescription || ""
  );

  return (
    <div className="bg-paper-50 border-[2.5px] border-ink-950 shadow-manga-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-3.5 p-3.5 items-start sm:items-center">
        {/* Video Scrub Preview */}
        <div className="relative w-full sm:w-44 aspect-video bg-ink-950 border-2 border-ink-950 shrink-0 overflow-hidden">
          <video
            src={clip.mediaUrl}
            muted
            playsInline
            controls
            preload="metadata"
            className="w-full h-full object-cover"
          />
          <span className="absolute top-1 left-1 bg-ink-950/90 text-paper-50 font-mono text-[10px] font-bold px-1.5 py-0.5">
            #{index + 1} • {clip.durationSec.toFixed(1)}s
          </span>
        </div>

        {/* Clip Summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base uppercase tracking-wide text-ink-950 truncate">
              {clip.title}
            </h3>
            {clip.metadata.quarter && (
              <span className="font-mono text-[10px] font-bold bg-ink-950 text-paper-50 px-1.5 py-0.5">
                {clip.metadata.quarter} {clip.metadata.gameClock || ""}
              </span>
            )}
            {clip.metadata.score && (
              <span className="font-mono text-[10px] font-bold bg-paper-200 border border-ink-950 px-1.5 py-0.5">
                {clip.metadata.score}
              </span>
            )}
          </div>

          <p className="text-xs text-ink-700 line-clamp-2 mt-1">
            {clip.metadata.eventDescription ||
              `${clip.keyframes.length} keyframes extracted (${clip.width}×${clip.height} @ ${clip.fps}fps)`}
          </p>

          {/* Extracted Keyframe Filmstrip */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
            {clip.keyframes.slice(0, 5).map((kf) => (
              <img
                key={kf.frameId}
                src={kf.mediaUrl}
                alt={`${kf.timestampSec}s`}
                title={`Keyframe ${kf.frameId} @ ${kf.timestampSec}s`}
                className="w-12 h-7 object-cover border border-ink-950/60 shrink-0"
              />
            ))}
          </div>
        </div>

        {/* Order & Metadata Controls */}
        <div className="flex sm:flex-col items-center gap-1 self-end sm:self-center">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={onMoveUp}
              className="p-1.5 border border-ink-950 hover:bg-ink-950 hover:text-paper-50 disabled:opacity-30"
              title="Move earlier in game order"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={onMoveDown}
              className="p-1.5 border border-ink-950 hover:bg-ink-950 hover:text-paper-50 disabled:opacity-30"
              title="Move later in game order"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 mt-0 sm:mt-1">
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1 px-2 py-1 border border-ink-950 font-mono text-[10px] font-bold uppercase hover:bg-paper-200"
            >
              Context
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 border border-ink-950 text-crimson-600 hover:bg-crimson-500 hover:text-white"
              title="Remove clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Game Context Metadata Editor */}
      {isExpanded && (
        <div className="border-t-2 border-ink-950 bg-paper-100 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                Clip Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                Home Team
              </label>
              <input
                type="text"
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                placeholder="e.g. Crimson Vipers"
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                Away Team
              </label>
              <input
                type="text"
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                placeholder="e.g. Harbor Titans"
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                Quarter
              </label>
              <input
                type="text"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="Q4"
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                Game Clock
              </label>
              <input
                type="text"
                value={gameClock}
                onChange={(e) => setGameClock(e.target.value)}
                placeholder="00:03.4"
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase mb-1">
                Verified Score
              </label>
              <input
                type="text"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="VIPERS 103 - TITANS 101"
                className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] font-bold uppercase mb-1">
              Key Players &amp; Jersey Numbers (comma-separated)
            </label>
            <input
              type="text"
              value={playersText}
              onChange={(e) => setPlayersText(e.target.value)}
              placeholder="Jalen Vance (#23, Vipers), Darius Kade (#11, Titans)"
              className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] font-bold uppercase mb-1">
              Play Description / Upstream Pipeline Context
            </label>
            <textarea
              rows={2}
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="w-full border-2 border-ink-950 bg-paper-50 px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                onSaveDetails(title, {
                  homeTeam: homeTeam || undefined,
                  awayTeam: awayTeam || undefined,
                  quarter: quarter || undefined,
                  gameClock: gameClock || undefined,
                  score: score || undefined,
                  players: playersText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  eventDescription: eventDescription || undefined,
                });
                onToggleExpand();
              }}
              className="bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase px-4 py-1.5 hover:bg-crimson-500 transition-colors"
            >
              Save Clip Metadata
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
