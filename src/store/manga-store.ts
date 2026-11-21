"use client";

import { create } from "zustand";
import {
  GenerationJob,
  MangaPanel,
  MangaPreferences,
  MangaStoryProject,
  NormalizedClip,
  PipelineMode,
  RawVideoRecord,
} from "@/types/manga";

export type AppScreen = "studio" | "progress" | "storyboard" | "reader";

export interface SystemStatusInfo {
  apiKeyConfigured: boolean;
  recommendedDefaultMode: PipelineMode;
  models: {
    clipUnderstanding: string;
    mangaDirectorAndIllustrator: string;
    qualityReviewer: string;
    layoutOptimizer: string;
  };
  skill: {
    name: string;
    description: string;
    loadedAt: string;
  };
  references?: {
    directory: string;
    chapterCount: number;
    pageCount: number;
    isEmpty: boolean;
    profileCached: boolean;
    warning: string | null;
  };
}

export interface SavedStorySummary {
  storyId: string;
  title: string;
  subtitle: string;
  mode: PipelineMode;
  style: string;
  pageCount: number;
  panelCount: number;
  coverUrl: string | null;
  updatedAt: string;
}

interface MangaWorkspaceState {
  activeScreen: AppScreen;
  systemStatus: SystemStatusInfo | null;
  mode: PipelineMode;
  rawVideos: RawVideoRecord[];
  selectedRawVideoPath: string | null;
  userPrompt: string;
  reuseIngestCache: boolean;
  selectedCachedHandoffPath: string | null;
  clips: NormalizedClip[];
  savedStories: SavedStorySummary[];
  preferences: MangaPreferences;
  activeJob: GenerationJob | null;
  currentProject: MangaStoryProject | null;
  selectedPanelId: string | null;
  videoModalTarget: {
    panel: MangaPanel;
    clip: NormalizedClip;
  } | null;
  zoomedPanel: MangaPanel | null;
  isLoadingClips: boolean;
  isUploading: boolean;
  errorBanner: string | null;

  setActiveScreen: (screen: AppScreen) => void;
  setMode: (mode: PipelineMode) => void;
  setSelectedRawVideoPath: (filePath: string | null) => void;
  setUserPrompt: (prompt: string) => void;
  setReuseIngestCache: (reuse: boolean) => void;
  setSelectedCachedHandoffPath: (handoffPath: string | null) => void;
  updatePreferences: (patch: Partial<MangaPreferences>) => void;
  setSelectedPanelId: (panelId: string | null) => void;
  openVideoForPanel: (panel: MangaPanel) => void;
  closeVideoModal: () => void;
  setZoomedPanel: (panel: MangaPanel | null) => void;
  setErrorBanner: (msg: string | null) => void;

  fetchInitialData: (initialStoryId?: string) => Promise<void>;
  uploadRawVideo: (file: File) => Promise<void>;
  removeRawVideo: (filePath: string) => Promise<void>;
  loadSampleHighlights: () => Promise<void>;
  uploadVideoFiles: (files: File[], consolidated: boolean) => Promise<void>;
  reorderClip: (clipId: string, direction: "up" | "down") => Promise<void>;
  removeClip: (clipId: string) => Promise<void>;
  updateClipDetails: (
    clipId: string,
    title: string,
    metadata: Partial<NormalizedClip["metadata"]>
  ) => Promise<void>;

  startGeneration: (resumeJobId?: string) => Promise<void>;
  pollJobUntilDone: (jobId: string) => Promise<void>;
  loadStory: (storyId: string, targetScreen?: AppScreen) => Promise<void>;
  setCurrentProject: (project: MangaStoryProject) => void;
}

export const useMangaStore = create<MangaWorkspaceState>((set, get) => ({
  activeScreen: "studio",
  systemStatus: null,
  mode: "demo",
  rawVideos: [],
  selectedRawVideoPath: null,
  userPrompt: "",
  reuseIngestCache: true,
  selectedCachedHandoffPath: null,
  clips: [],
  savedStories: [],
  preferences: {
    style: "hyperkinetic_shonen_anime",
    colorTreatment: "traditional_monochrome",
    actionIntensity: "dramatic",
    referenceInfluence: "balanced",
    storytellingFocus: "balanced",
    targetPages: 3,
    readingDirection: "rtl",
    storyFocus: "auto",
    dramaticIntensity: 8,
    visualEffectsIntensity: 8,
    useLayoutOptimizerNeon: false,
    directorNotes: "",
    userPrompt: "",
  },
  activeJob: null,
  currentProject: null,
  selectedPanelId: null,
  videoModalTarget: null,
  zoomedPanel: null,
  isLoadingClips: false,
  isUploading: false,
  errorBanner: null,

  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setMode: (mode) => set({ mode, errorBanner: null }),
  setSelectedRawVideoPath: (filePath) => {
    const { rawVideos, userPrompt } = get();
    const vid = rawVideos.find((v) => v.filePath === filePath);
    const topCache = vid?.cachedHandoffs?.[0] || null;
    set({
      selectedRawVideoPath: filePath,
      selectedCachedHandoffPath: topCache ? topCache.handoffPath : null,
      userPrompt:
        !userPrompt.trim() && topCache?.userFocus
          ? topCache.userFocus
          : userPrompt,
    });
  },
  setUserPrompt: (prompt) =>
    set((state) => ({
      userPrompt: prompt,
      preferences: {
        ...state.preferences,
        userPrompt: prompt,
        directorNotes: prompt,
      },
    })),
  setReuseIngestCache: (reuse) => set({ reuseIngestCache: reuse }),
  setSelectedCachedHandoffPath: (handoffPath) =>
    set({ selectedCachedHandoffPath: handoffPath }),
  updatePreferences: (patch) =>
    set((state) => ({
      preferences: { ...state.preferences, ...patch },
    })),
  setSelectedPanelId: (panelId) => set({ selectedPanelId: panelId }),
  setZoomedPanel: (panel) => set({ zoomedPanel: panel }),
  setErrorBanner: (msg) => set({ errorBanner: msg }),

  openVideoForPanel: (panel) => {
    const { currentProject, clips } = get();
    const pool = currentProject?.clips.length ? currentProject.clips : clips;
    const clip =
      pool.find((c) => c.clipId === panel.interaction.clipId) ||
      pool.find((c) => c.clipId === panel.sourceClipId) ||
      pool[0];
    if (clip) {
      set({ videoModalTarget: { panel, clip } });
    }
  },

  closeVideoModal: () => set({ videoModalTarget: null }),

  fetchInitialData: async (initialStoryId?: string) => {
    set({ isLoadingClips: true });
    try {
      const [statusRes, videosRes, clipsRes, storiesRes] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/videos"),
        fetch("/api/clips"),
        fetch("/api/manga/generate"),
      ]);

      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as SystemStatusInfo;
        set({
          systemStatus: statusData,
          mode: statusData.recommendedDefaultMode,
        });
      }

      if (videosRes.ok) {
        const videosData = (await videosRes.json()) as {
          videos: RawVideoRecord[];
        };
        const list = videosData.videos || [];
        const currentSelected = get().selectedRawVideoPath;
        const autoSelected =
          currentSelected && list.some((v) => v.filePath === currentSelected)
            ? currentSelected
            : list[0]?.filePath || null;
        const chosenVid = list.find((v) => v.filePath === autoSelected);
        const latestCache = chosenVid?.cachedHandoffs?.[0] || null;

        set((state) => ({
          rawVideos: list,
          selectedRawVideoPath: autoSelected,
          selectedCachedHandoffPath: latestCache ? latestCache.handoffPath : null,
          userPrompt:
            !state.userPrompt.trim() && latestCache?.userFocus
              ? latestCache.userFocus
              : state.userPrompt,
        }));
      }

      if (clipsRes.ok) {
        const clipsData = await clipsRes.json();
        set({ clips: clipsData.clips || [] });
      }

      if (storiesRes.ok) {
        const storiesData = await storiesRes.json();
        set({ savedStories: storiesData.stories || [] });

        if (initialStoryId) {
          await get().loadStory(initialStoryId);
        } else if (
          storiesData.stories?.length > 0 &&
          !get().currentProject
        ) {
          const latestId = storiesData.stories[0].storyId;
          const projRes = await fetch(`/api/manga/${latestId}`);
          if (projRes.ok) {
            const projJson = await projRes.json();
            set({ currentProject: projJson.project });
          }
        }
      }
    } catch (err) {
      set({
        errorBanner:
          err instanceof Error ? err.message : "Failed to initialize studio",
      });
    } finally {
      set({ isLoadingClips: false });
    }
  },

  uploadRawVideo: async (file) => {
    set({ isUploading: true, errorBanner: null });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Raw video upload failed");

      const uploadedPath = data.uploaded?.filePath || data.videos?.[0]?.filePath || null;
      set({
        rawVideos: data.videos || [],
        selectedRawVideoPath: uploadedPath,
        selectedCachedHandoffPath: null,
      });
    } catch (err) {
      set({
        errorBanner: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      set({ isUploading: false });
    }
  },

  removeRawVideo: async (filePath) => {
    const res = await fetch(
      `/api/videos?filePath=${encodeURIComponent(filePath)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      set({ errorBanner: data.error || "Could not delete raw video" });
      return;
    }
    const list: RawVideoRecord[] = data.videos || [];
    set((state) => ({
      rawVideos: list,
      selectedRawVideoPath:
        state.selectedRawVideoPath === filePath
          ? list[0]?.filePath || null
          : state.selectedRawVideoPath,
    }));
  },

  loadSampleHighlights: async () => {
    set({ isLoadingClips: true, errorBanner: null });
    try {
      const res = await fetch("/api/clips/samples", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sample clips");
      set({ clips: data.clips, selectedRawVideoPath: null });
    } catch (err) {
      set({
        errorBanner:
          err instanceof Error ? err.message : "Sample generation failed",
      });
    } finally {
      set({ isLoadingClips: false });
    }
  },

  uploadVideoFiles: async (files, _consolidated) => {
    if (files.length === 0) return;
    await get().uploadRawVideo(files[0]);
  },

  reorderClip: async (clipId, direction) => {
    const { clips } = get();
    const idx = clips.findIndex((c) => c.clipId === clipId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= clips.length) return;

    const reordered = [...clips];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, moved);
    const orderedClipIds = reordered.map((c) => c.clipId);

    set({ clips: reordered.map((c, i) => ({ ...c, orderIndex: i })) });
    await fetch("/api/clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedClipIds }),
    });
  },

  removeClip: async (clipId) => {
    const res = await fetch(`/api/clips?clipId=${encodeURIComponent(clipId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const data = await res.json();
      set({ clips: data.clips });
    }
  },

  updateClipDetails: async (clipId, title, metadata) => {
    const res = await fetch("/api/clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updateClip: { clipId, title, metadata },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      set({ clips: data.clips });
    }
  },

  startGeneration: async (resumeJobId) => {
    const {
      selectedRawVideoPath,
      userPrompt,
      reuseIngestCache,
      selectedCachedHandoffPath,
      clips,
      preferences,
      mode,
    } = get();

    if (!selectedRawVideoPath && clips.length === 0) {
      set({
        errorBanner:
          "Upload or select a raw basketball video first.",
      });
      return;
    }

    set({ errorBanner: null });
    try {
      const payload = selectedRawVideoPath
        ? {
            rawVideoPath: selectedRawVideoPath,
            userPrompt: userPrompt.trim(),
            reuseIngestCache,
            cachedHandoffPath: reuseIngestCache
              ? selectedCachedHandoffPath || undefined
              : undefined,
            preferences: {
              ...preferences,
              userPrompt: userPrompt.trim(),
              directorNotes: userPrompt.trim() || preferences.directorNotes,
            },
            mode,
            resumeJobId,
          }
        : {
            clipIds: clips.map((c) => c.clipId),
            preferences,
            mode,
            resumeJobId,
          };

      const res = await fetch("/api/manga/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start generation");

      set({ activeJob: data.job, activeScreen: "progress" });
      void get().pollJobUntilDone(data.job.jobId);
    } catch (err) {
      set({
        errorBanner:
          err instanceof Error ? err.message : "Failed to start generation",
      });
    }
  },

  pollJobUntilDone: async (jobId) => {
    let active = true;
    while (active) {
      await new Promise((r) => setTimeout(r, 750));
      try {
        const res = await fetch(`/api/manga/jobs/${jobId}`);
        if (!res.ok) break;
        const { job } = (await res.json()) as { job: GenerationJob };
        set({ activeJob: job });

        if (job.status === "completed") {
          active = false;
          await get().loadStory(job.storyId, "reader");
          const [storiesRes, videosRes] = await Promise.all([
            fetch("/api/manga/generate"),
            fetch("/api/videos"),
          ]);
          if (storiesRes.ok) {
            const storiesData = await storiesRes.json();
            set({ savedStories: storiesData.stories || [] });
          }
          if (videosRes.ok) {
            const videosData = await videosRes.json();
            set({ rawVideos: videosData.videos || [] });
          }
        } else if (job.status === "failed") {
          active = false;
          set({ errorBanner: job.error || "Manga generation job failed" });
        }
      } catch {
        active = false;
      }
    }
  },

  loadStory: async (storyId, targetScreen) => {
    try {
      const res = await fetch(`/api/manga/${storyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Story not found");
      const firstPanel =
        data.project?.storyboard?.pages?.[0]?.panels?.[0]?.panelId || null;
      set({
        currentProject: data.project,
        selectedPanelId: firstPanel,
        ...(targetScreen ? { activeScreen: targetScreen } : {}),
      });
    } catch (err) {
      set({
        errorBanner:
          err instanceof Error ? err.message : "Failed to load manga story",
      });
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),
}));
