"use client";

import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  Database,
  Film,
  Loader2,
  MessageSquareText,

  Trash2,
  Upload,
} from "lucide-react";
import { useMangaStore } from "@/store/manga-store";

function formatDuration(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  return `${sec.toFixed(1)}s`;
}

function formatSizeMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}



export const ClipUploader: React.FC = () => {
  const {
    rawVideos,
    selectedRawVideoPath,
    setSelectedRawVideoPath,
    userPrompt,
    setUserPrompt,
    reuseIngestCache,
    setReuseIngestCache,
    selectedCachedHandoffPath,
    setSelectedCachedHandoffPath,
    uploadRawVideo,
    removeRawVideo,

    isUploading,

  } = useMangaStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const selectedVideo =
    rawVideos.find((v) => v.filePath === selectedRawVideoPath) || null;

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await uploadRawVideo(fileList[0]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* Step 1: Raw Basketball Video Upload / Selection */}
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
              Stage 1 • Raw Game Video Input
            </span>
            <h2 className="font-display text-2xl uppercase tracking-wide text-ink-950">
              Basketball Game Video
            </h2>
          </div>

        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          onChange={(e) => void handleFilesSelected(e.target.files)}
          className="hidden"
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 w-full border-2 border-dashed border-ink-950 bg-screentone-subtle hover:bg-paper-200/70 py-6 px-4 flex flex-col items-center justify-center gap-2 transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin text-crimson-500" />
              <span className="font-mono text-xs font-bold uppercase">
                Saving &amp; Probing Raw Basketball Video...
              </span>
            </>
          ) : (
            <>
              <Upload className="w-7 h-7 text-ink-900" />
              <span className="font-display text-lg uppercase tracking-wide">
                Drop Raw Basketball Video Here or Click to Browse
              </span>
              <span className="text-xs text-ink-700">
                Full broadcast game, quarter, or personal recording (MP4 • MOV • WebM • MKV) — auto-scouted &amp; ranked during generation
              </span>
            </>
          )}
        </button>

        {/* Available Raw Videos in `data/` */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-700">
              Available Raw Videos ({rawVideos.length})
            </span>
            <span className="font-mono text-[11px] text-ink-600">
              Files in <code>data/</code> appear automatically
            </span>
          </div>

          {rawVideos.length === 0 ? (
            <div className="border-2 border-ink-950/30 bg-paper-100/70 p-6 text-center">
              <Film className="w-7 h-7 mx-auto mb-1.5 text-ink-600" />
              <p className="font-semibold text-xs text-ink-800">
                No raw video selected yet. Upload a video above or place an MP4 in <code>data/</code>.
              </p>
            </div>
          ) : (
            rawVideos.map((vid) => {
              const isSelected = vid.filePath === selectedRawVideoPath;
              const isBrowserUploaded = vid.filePath
                .replace(/\\/g, "/")
                .includes("/raw_videos/");

              return (
                <div
                  key={vid.videoId}
                  onClick={() => setSelectedRawVideoPath(vid.filePath)}
                  className={`cursor-pointer border-[2.5px] p-3.5 transition-all flex flex-col sm:flex-row gap-3.5 items-start sm:items-center ${
                    isSelected
                      ? "border-crimson-600 bg-paper-100 shadow-manga-sm"
                      : "border-ink-950 bg-paper-50 hover:bg-paper-100/70"
                  }`}
                >
                  <div className="relative w-full sm:w-44 aspect-video bg-ink-950 border-2 border-ink-950 shrink-0 overflow-hidden">
                    <video
                      src={vid.mediaUrl}
                      muted
                      playsInline
                      controls
                      preload="metadata"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1 left-1 bg-ink-950/90 text-paper-50 font-mono text-[10px] font-bold px-1.5 py-0.5">
                      {formatDuration(vid.durationSec)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-crimson-600 shrink-0" />
                      )}
                      <h3 className="font-display text-base uppercase tracking-wide text-ink-950 truncate">
                        {vid.title}
                      </h3>
                    </div>

                    <div className="font-mono text-[11px] text-ink-700 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        {vid.width}×{vid.height} @ {Math.round(vid.fps)}fps
                      </span>
                      <span>{formatSizeMb(vid.sizeBytes)}</span>
                    </div>

                    {vid.cachedHandoffs.length > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 border border-ink-950">
                        <Database className="w-3 h-3" />
                        Cached Ingest Ready ({vid.cachedHandoffs[0].selectedPoolCount} beats +{" "}
                        {vid.cachedHandoffs[0].attachedReplayCount} zoomed angles)
                      </div>
                    )}
                  </div>

                  {isBrowserUploaded && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeRawVideo(vid.filePath);
                      }}
                      className="p-1.5 border border-ink-950 text-crimson-600 hover:bg-crimson-500 hover:text-ink-950 self-end sm:self-center"
                      title="Delete uploaded raw video"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Step 2: Single Accompanying Prompt for the Video */}
      <div className="border-[3px] border-ink-950 bg-paper-50 p-6 shadow-manga space-y-4">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-crimson-600 flex items-center gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5" />
            Stage 2 • Story Focus Prompt
          </span>
          <h2 className="font-display text-2xl uppercase tracking-wide text-ink-950 mt-0.5">
            Prompt to Accompany Video (Optional)
          </h2>
        </div>

        <textarea
          rows={3}
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="e.g., Emphasize the last steal into game-winning 3-pointer, or follow #23's fourth-quarter comeback..."
          className="w-full border-2 border-ink-950 bg-paper-100 px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-crimson-600"
        />

        {selectedVideo && selectedVideo.cachedHandoffs.length > 0 && (
          <div className="pt-2 border-t border-ink-950/15 space-y-2">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reuseIngestCache}
                onChange={(e) => setReuseIngestCache(e.target.checked)}
                className="w-4 h-4 accent-crimson-500"
              />
              <span className="text-xs font-semibold text-ink-900">
                Reuse cached Python video scout &amp; ranking when available (uncheck to re-scout raw video from scratch)
              </span>
            </label>

            {reuseIngestCache && selectedVideo.cachedHandoffs.length > 1 && (
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase mb-1 text-ink-700">
                  Cached Handoff Run
                </label>
                <select
                  value={
                    selectedCachedHandoffPath ||
                    selectedVideo.cachedHandoffs[0].handoffPath
                  }
                  onChange={(e) => {
                    const chosen = selectedVideo.cachedHandoffs.find(
                      (h) => h.handoffPath === e.target.value
                    );
                    setSelectedCachedHandoffPath(e.target.value);
                    if (chosen?.userFocus) {
                      setUserPrompt(chosen.userFocus);
                    }
                  }}
                  className="w-full border-2 border-ink-950 bg-paper-100 px-2.5 py-1.5 text-xs font-mono"
                >
                  {selectedVideo.cachedHandoffs.map((h) => (
                    <option key={h.handoffPath} value={h.handoffPath}>
                      {h.jobId} — {h.selectedPoolCount} beats ({h.attachedReplayCount} zoomed) — &ldquo;
                      {h.userFocus.slice(0, 50)}&rdquo;
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
