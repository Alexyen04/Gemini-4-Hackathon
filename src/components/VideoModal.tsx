"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Film, RotateCcw, X } from "lucide-react";
import { MangaPanel, NormalizedClip } from "@/types/manga";

interface VideoModalProps {
  target: {
    panel: MangaPanel;
    clip: NormalizedClip;
  } | null;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ target, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const seekAndPlayMoment = () => {
    const vid = videoRef.current;
    if (!vid || !target) return;
    const seekTime = Math.max(
      0,
      Math.min(target.panel.interaction.timestamp, Math.max(0, (vid.duration || target.clip.durationSec) - 0.1))
    );
    vid.currentTime = seekTime;
    void vid.play().catch(() => {
      // Autoplay fallback if browser requires click
    });
  };

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-ink-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-paper-50 border-[3px] border-ink-950 shadow-manga-crimson overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-ink-950 text-paper-50 px-5 py-3.5 border-b-2 border-ink-950">
              <div className="flex items-center gap-2.5">
                <span className="bg-crimson-500 text-white font-mono text-xs font-bold px-2 py-0.5 uppercase">
                  Source Footage Verified
                </span>
                <h3 className="font-display text-lg tracking-wide uppercase">
                  {target.clip.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-paper-200 hover:text-white hover:bg-ink-800 transition-colors"
                aria-label="Close video modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Side-by-Side Video & Manga Panel Grounding View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
              <div className="lg:col-span-8 flex flex-col gap-3">
                <div className="relative bg-ink-950 border-[3px] border-ink-950 aspect-video overflow-hidden">
                  <video
                    ref={videoRef}
                    src={target.clip.mediaUrl}
                    controls
                    playsInline
                    onLoadedMetadata={seekAndPlayMoment}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 bg-paper-200/70 border-2 border-ink-950 px-3.5 py-2.5">
                  <div className="flex items-center gap-4 font-mono text-xs font-bold text-ink-900">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-crimson-500" />
                      Clip Beat: {target.panel.interaction.timestamp.toFixed(2)}s /{" "}
                      {target.clip.durationSec.toFixed(2)}s
                    </span>
                    {target.clip.metadata.gameClock && (
                      <span className="inline-flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-ink-700" />
                        Game Clock: {target.clip.metadata.quarter || ""}{" "}
                        {target.clip.metadata.gameClock}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={seekAndPlayMoment}
                    className="inline-flex items-center gap-1.5 bg-ink-950 text-paper-50 font-mono text-xs font-bold uppercase px-3 py-1.5 hover:bg-crimson-500 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Replay Beat ({target.panel.interaction.timestamp.toFixed(1)}s)
                  </button>
                </div>
              </div>

              {/* Manga Panel Comparison Card */}
              <div className="lg:col-span-4 flex flex-col justify-between bg-paper-100 border-2 border-ink-950 p-3.5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-ink-700">
                    <span>Panel {target.panel.panelId}</span>
                    <span className="bg-ink-950 text-paper-50 px-2 py-0.5">
                      {target.panel.narrativeStage.replace(/_/g, " ")}
                    </span>
                  </div>

                  {target.panel.illustration.assetUrl && (
                    <div className="border-2 border-ink-950 bg-paper-50 overflow-hidden max-h-52">
                      <img
                        src={target.panel.illustration.assetUrl}
                        alt={target.panel.description}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="text-xs font-semibold text-ink-900 leading-relaxed">
                    {target.panel.description}
                  </p>

                  {target.clip.metadata.score && (
                    <div className="font-mono text-xs bg-ink-950 text-paper-50 px-2.5 py-1.5">
                      SCORE: {target.clip.metadata.score}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 w-full bg-crimson-500 text-white font-display uppercase tracking-wider py-2.5 border-2 border-ink-950 shadow-manga-sm hover:bg-crimson-600 transition-colors"
                >
                  Return to Manga Reader
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
