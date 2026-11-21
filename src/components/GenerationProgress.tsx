"use client";

import React from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useMangaStore } from "@/store/manga-store";

export const GenerationProgress: React.FC = () => {
  const { activeJob, startGeneration, setActiveScreen } = useMangaStore();

  if (!activeJob) {
    return (
      <div className="max-w-2xl mx-auto border-[3px] border-ink-950 bg-paper-50 p-8 text-center shadow-manga">
        <p className="font-display text-xl uppercase">
          No Active Generation Job
        </p>
        <button
          type="button"
          onClick={() => setActiveScreen("studio")}
          className="mt-4 bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase px-5 py-2.5"
        >
          Return to Manga Studio
        </button>
      </div>
    );
  }

  const completedStages = activeJob.stages.filter(
    (s) => s.status === "completed"
  ).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-[3px] border-ink-950 bg-paper-50 p-6 shadow-manga">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink-950 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-[11px] font-bold uppercase px-2 py-0.5 ${
                  activeJob.mode === "real"
                    ? "bg-ink-950 text-paper-50"
                    : "bg-amber-300 text-ink-950 border border-ink-950"
                }`}
              >
                {activeJob.mode === "real"
                  ? "Real Gemini 4 Pipeline"
                  : "Development Demo Pipeline"}
              </span>
              <span className="font-mono text-xs text-ink-600">
                Job {activeJob.jobId}
              </span>
            </div>
            <h2 className="font-display text-3xl uppercase tracking-wide mt-1">
              {activeJob.status === "completed"
                ? "Manga Generation Complete"
                : activeJob.status === "failed"
                ? "Pipeline Interrupted"
                : "Inking Basketball Storyboard..."}
            </h2>
          </div>

          <div className="text-right font-mono">
            <div className="text-2xl font-bold">
              {completedStages} / {activeJob.stages.length} Stages
            </div>
            {activeJob.totalPanels > 0 && (
              <div className="text-xs text-crimson-600 font-bold">
                Panels Illustrated: {activeJob.completedPanels} /{" "}
                {activeJob.totalPanels}
              </div>
            )}
          </div>
        </div>

        {/* 8-Stage Real Processing Tracker */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeJob.stages.map((st) => {
            const isRunning = st.status === "running";
            const isDone = st.status === "completed";
            const isFailed = st.status === "failed";

            return (
              <div
                key={st.id}
                className={`border-2 p-3.5 flex items-start gap-3 transition-colors ${
                  isRunning
                    ? "border-crimson-500 bg-crimson-500/5 shadow-manga-sm"
                    : isDone
                    ? "border-ink-950 bg-paper-100"
                    : isFailed
                    ? "border-crimson-600 bg-crimson-500/10"
                    : "border-ink-950/25 bg-paper-50 opacity-65"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isRunning ? (
                    <Loader2 className="w-5 h-5 text-crimson-500 animate-spin" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-ink-950" />
                  ) : isFailed ? (
                    <AlertOctagon className="w-5 h-5 text-crimson-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-ink-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm uppercase tracking-wide">
                      {st.label}
                    </span>
                    {st.model && (
                      <span className="font-mono text-[10px] bg-ink-950 text-paper-50 px-1.5 py-0.5 shrink-0">
                        {st.model}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-700 mt-1 break-words">
                    {st.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recovery Action if Failed */}
        {activeJob.status === "failed" && (
          <div className="mt-5 bg-crimson-500/10 border-2 border-crimson-600 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-ink-950 max-w-xl">
              <strong>Error:</strong> {activeJob.error}
              <p className="text-ink-700 mt-1">
                Earlier completed stages are cached on disk. You can resume from
                the failed stage without repeating completed work.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void startGeneration(activeJob.jobId)}
              className="inline-flex items-center gap-2 bg-crimson-500 text-white font-mono text-xs font-bold uppercase px-4 py-2.5 border-2 border-ink-950"
            >
              <RotateCcw className="w-4 h-4" />
              Resume From Checkpoint
            </button>
          </div>
        )}
      </div>

      {/* Live Emerging Panel Artwork Previews */}
      {activeJob.livePanelPreviews.length > 0 && (
        <div className="border-[3px] border-ink-950 bg-paper-50 p-5 shadow-manga">
          <h3 className="font-display text-lg uppercase tracking-wide mb-3">
            Live Carbon Rendered Panels ({activeJob.livePanelPreviews.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {activeJob.livePanelPreviews.map((item) => (
              <div
                key={item.panelId}
                className="border-2 border-ink-950 bg-paper-100 p-2 space-y-1.5"
              >
                <img
                  src={item.assetUrl}
                  alt={item.panelId}
                  className="w-full h-32 object-cover border border-ink-950"
                />
                <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                  <span>{item.panelId}</span>
                  <span>Page {item.pageNumber}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
