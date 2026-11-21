import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import readline from "readline";
import sharp from "sharp";
import {
  BestVisualMoment,
  CachedHandoffSummary,
  ClipEventAnalysis,
  ClipEventAnalysisSchema,
  DetectedPlayer,
  KeyframeReference,
  NormalizedClip,
  PipelineMode,
  RawVideoRecord,
} from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { VideoInputService } from "@/lib/video/ffmpeg";
import { KeyframeExtractionService } from "@/lib/video/keyframes";

interface PythonFrameSample {
  path: string;
  timestamp_sec: number;
  sharpness: number;
}

interface PythonVerbatimQuote {
  text: string;
  timestamp_sec: number;
}

interface PythonReplayAngle {
  replay_id: string;
  start_sec: number;
  end_sec: number;
  peak_sec: number;
  camera_framing: string;
  description: string;
  keyframe_path?: string | null;
  keyframe_sec?: number | null;
  burst_frames?: PythonFrameSample[];
  clip_path?: string | null;
  clip_start_sec?: number | null;
  clip_end_sec?: number | null;
}

interface PythonScoredCandidate {
  candidate_id: string;
  segment_id: string;
  category: "action" | "story_emotion";
  start_sec: number;
  end_sec: number;
  peak_sec: number;
  description: string;
  narrative_context: string;
  players_involved: string[];
  score_context?: string | null;
  verbatim_quotes: PythonVerbatimQuote[];
  emotional_tone: string;
  is_replay: boolean;
  camera_framing: string;
  replay_angles: PythonReplayAngle[];
  keyframe_path?: string | null;
  keyframe_sec?: number | null;
  burst_frames?: PythonFrameSample[];
  clip_path?: string | null;
  clip_start_sec?: number | null;
  clip_end_sec?: number | null;
  scores: {
    action_spectacle: number;
    narrative_leverage: number;
    user_focus_match: number;
    visual_clarity: number;
    composite_story_rank: number;
  };
  casting_quadrant:
    | "climax_candidate"
    | "swagger_montage"
    | "emotional_beat"
    | "drop";
  pool_selection_reason?: string | null;
}

export interface PythonDirectorHandoff {
  schema_version: string;
  job_input: {
    job_id: string;
    video_path: string;
    user_focus: string;
    target_pages: number;
    target_pool_size: number;
  };
  video_metadata: {
    video_path: string;
    duration_sec: number;
    fps: number;
    width: number;
    height: number;
  };
  game_plan: {
    protagonist_focus: string;
    has_specific_focus: boolean;
    story_angle: string;
    scout_instructions: string;
    scoring_weights: Record<string, number>;
  };
  segment_summaries: Array<{
    segment_id: string;
    start_sec: number;
    end_sec: number;
    game_state_summary: string;
  }>;
  selected_pool: PythonScoredCandidate[];
  all_scored_candidates: PythonScoredCandidate[];
  stats: {
    total_chunks: number;
    raw_candidates_count: number;
    deduped_candidates_count: number;
    selected_pool_count: number;
  };
}

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

function formatClockLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function normalizePathKey(p: string): string {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

function normalizePromptKey(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function inferEventType(
  desc: string,
  category: string,
  quadrant: string
): ClipEventAnalysis["eventType"] {
  const d = desc.toLowerCase();
  if (
    quadrant === "climax_candidate" &&
    (d.includes("game-winn") || d.includes("for the lead") || d.includes("0.3") || d.includes("buzzer"))
  ) {
    return "clutch_game_winner";
  }
  if (d.includes("steal") || d.includes("deflect") || d.includes("intercept")) {
    return "steal_fastbreak";
  }
  if (d.includes("three-point") || d.includes("3-point") || d.includes("deep three") || d.includes("beyond the arc")) {
    return "three_pointer";
  }
  if (d.includes("dunk") || d.includes("slam") || d.includes("alley-oop")) {
    return "dunk";
  }
  if (d.includes("block") || d.includes("rejected") || d.includes("denied")) {
    return "block";
  }
  if (d.includes("putback") || d.includes("offensive rebound")) {
    return "rebound_putback";
  }
  if (d.includes("layup") || d.includes("drives")) {
    return "layup_drive";
  }
  if (d.includes("jumper") || d.includes("pull-up") || d.includes("step-back")) {
    return "midrange_jumper";
  }
  if (category === "story_emotion" && (d.includes("trap") || d.includes("defense") || d.includes("stop"))) {
    return "defensive_stop";
  }
  return "other_highlight";
}

function inferOutcome(
  desc: string,
  category: string
): ClipEventAnalysis["outcomeVerified"] {
  const d = desc.toLowerCase();
  if (
    d.includes("drains") ||
    d.includes("buries") ||
    d.includes("makes") ||
    d.includes("swishes") ||
    d.includes("sinks") ||
    d.includes("scores") ||
    d.includes("converts") ||
    d.includes("dunk") ||
    d.includes("layup to") ||
    d.includes("for the lead")
  ) {
    return "scored_basket";
  }
  if (d.includes("misses") || d.includes("missed") || d.includes("cold streak")) {
    return "missed_shot";
  }
  if (d.includes("block") || d.includes("rejected") || d.includes("walled off")) {
    return "defensive_block_stop";
  }
  if (d.includes("steal") || d.includes("turnover") || d.includes("loses the handle")) {
    return "turnover_steal";
  }
  return category === "action" ? "scored_basket" : "uncertain_outcome";
}

function parseDetectedPlayers(rawPlayers: string[]): DetectedPlayer[] {
  if (!rawPlayers || rawPlayers.length === 0) {
    return [
      {
        nameOrLabel: "Featured Player",
        jerseyNumber: null,
        team: null,
        role: "offense_primary",
        visualTraits: "Athletic basketball uniform on court",
        confidence: 0.8,
      },
    ];
  }

  return rawPlayers.slice(0, 4).map((raw, idx) => {
    const numMatch = raw.match(/#(\d+)/);
    const teamMatch = raw.match(/\(([^)]+)\)/);
    let team: string | null = null;
    if (teamMatch) {
      const parts = teamMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => !s.startsWith("#"));
      if (parts.length > 0) team = parts[parts.length - 1];
    }
    const cleanName = raw
      .replace(/\([^)]*\)/g, "")
      .replace(/#\d+/g, "")
      .trim();

    return {
      nameOrLabel: cleanName || raw.trim(),
      jerseyNumber: numMatch ? numMatch[1] : null,
      team,
      role: idx === 0 ? "offense_primary" : idx === 1 ? "defender" : "offense_support",
      visualTraits: raw.trim(),
      confidence: 0.92,
    };
  });
}

export class PythonIngestBridge {
  static async resolvePythonBinary(): Promise<string> {
    const candidates =
      process.platform === "win32"
        ? [
            path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
            path.join(process.cwd(), "venv", "Scripts", "python.exe"),
          ]
        : [
            path.join(process.cwd(), ".venv", "bin", "python"),
            path.join(process.cwd(), "venv", "bin", "python"),
          ];

    for (const cand of candidates) {
      const exists = await fs
        .stat(cand)
        .then((s) => s.isFile())
        .catch(() => false);
      if (exists) return cand;
    }
    return process.platform === "win32" ? "python" : "python3";
  }

  /**
   * Scans `outputs/` and `data/ingest/` for completed `handoff.json` packages.
   */
  static async discoverCachedHandoffs(): Promise<
    Array<CachedHandoffSummary & { videoPathNorm: string }>
  > {
    const roots = [
      path.join(process.cwd(), "outputs"),
      StorageService.getSubDir("ingest"),
    ];
    const found: Array<CachedHandoffSummary & { videoPathNorm: string }> = [];

    for (const root of roots) {
      const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === "synthetic_smoke_test") continue;
        const handoffPath = path.join(root, entry.name, "handoff.json");
        const stat = await fs.stat(handoffPath).catch(() => null);
        if (!stat || !stat.isFile()) continue;

        try {
          const raw = JSON.parse(
            await fs.readFile(handoffPath, "utf-8")
          ) as PythonDirectorHandoff;
          const vPath = raw.video_metadata?.video_path || raw.job_input?.video_path;
          if (!vPath) continue;
          const attachedReplayCount = (raw.selected_pool || []).reduce(
            (acc, c) => acc + (c.replay_angles?.length || 0),
            0
          );
          found.push({
            jobId: raw.job_input?.job_id || entry.name,
            handoffPath,
            userFocus: raw.job_input?.user_focus || "",
            selectedPoolCount: raw.selected_pool?.length || 0,
            attachedReplayCount,
            updatedAt: stat.mtime.toISOString(),
            videoPathNorm: normalizePathKey(vPath),
          });
        } catch {
          // Ignore unreadable handoff files
        }
      }
    }

    return found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * Lists raw full-game or highlight videos inside `data/` and `data/raw_videos/`.
   */
  static async listAvailableRawVideos(): Promise<RawVideoRecord[]> {
    await StorageService.ensureDirectories();
    const baseDir = StorageService.getBaseDir();
    const rawDir = StorageService.getSubDir("raw_videos");
    const cachedHandoffs = await this.discoverCachedHandoffs();

    const candidateDirs = [baseDir, rawDir];
    const seenPaths = new Set<string>();
    const videos: RawVideoRecord[] = [];

    for (const dir of candidateDirs) {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!VIDEO_EXTS.has(ext)) continue;

        const fullPath = path.resolve(dir, entry.name);
        const normKey = normalizePathKey(fullPath);
        if (seenPaths.has(normKey)) continue;
        seenPaths.add(normKey);

        try {
          const [stat, probe] = await Promise.all([
            fs.stat(fullPath),
            VideoInputService.probeVideo(fullPath),
          ]);
          const videoId =
            "vid_" +
            crypto.createHash("sha1").update(normKey).digest("hex").slice(0, 10);
          const matchingHandoffs = cachedHandoffs
            .filter((h) => h.videoPathNorm === normKey)
            .map(({ videoPathNorm: _ignore, ...rest }) => rest);

          videos.push({
            videoId,
            fileName: entry.name,
            title: path
              .parse(entry.name)
              .name.replace(/[_-]+/g, " ")
              .trim(),
            filePath: fullPath,
            mediaUrl: StorageService.toMediaUrl(fullPath),
            durationSec: probe.durationSec,
            width: probe.width,
            height: probe.height,
            fps: probe.fps,
            sizeBytes: stat.size,
            cachedHandoffs: matchingHandoffs,
            createdAt: stat.mtime.toISOString(),
          });
        } catch {
          // Skip invalid/unprobeable video files
        }
      }
    }

    return videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Resolves a `rawVideoPath` safely ensuring it resides inside `data/`.
   */
  static async validateRawVideoPath(rawVideoPath: string): Promise<string> {
    const resolved = path.resolve(rawVideoPath);
    const base = path.resolve(StorageService.getBaseDir());
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error("Raw video must reside inside the managed data/ directory.");
    }
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new Error(`Raw video file not found: ${rawVideoPath}`);
    }
    return resolved;
  }

  /**
   * Executes `run_ingest.py` (or loads a matching cached `handoff.json`) and
   * returns the parsed `PythonDirectorHandoff`.
   */
  static async runOrLoadPythonHandoff(params: {
    rawVideoPath: string;
    userPrompt: string;
    targetPages: number;
    mode: PipelineMode;
    reuseCache?: boolean;
    cachedHandoffPath?: string;
    onProgress?: (detail: string) => Promise<void>;
  }): Promise<{ handoff: PythonDirectorHandoff; handoffPath: string; cacheHit: boolean }> {
    const {
      rawVideoPath,
      userPrompt,
      targetPages,
      mode,
      reuseCache = true,
      cachedHandoffPath,
      onProgress,
    } = params;

    const absVideoPath = await this.validateRawVideoPath(rawVideoPath);
    const effectivePrompt =
      userPrompt.trim() ||
      "Tell the main dramatic storyline of this basketball game.";

    // 1. Explicit cached handoff path requested
    if (reuseCache && cachedHandoffPath) {
      const resolvedHandoff = path.resolve(cachedHandoffPath);
      const stat = await fs.stat(resolvedHandoff).catch(() => null);
      if (stat?.isFile()) {
        const handoff = JSON.parse(
          await fs.readFile(resolvedHandoff, "utf-8")
        ) as PythonDirectorHandoff;
        return { handoff, handoffPath: resolvedHandoff, cacheHit: true };
      }
    }

    // 2. Automatic cache match for (videoPath + prompt) or latest cached run on same video
    if (reuseCache) {
      const allCached = await this.discoverCachedHandoffs();
      const sameVideo = allCached.filter(
        (c) => c.videoPathNorm === normalizePathKey(absVideoPath)
      );
      const exactMatch = sameVideo.find(
        (c) => normalizePromptKey(c.userFocus) === normalizePromptKey(effectivePrompt)
      );
      const chosen =
        exactMatch || (!userPrompt.trim() && sameVideo.length > 0 ? sameVideo[0] : null);

      if (chosen) {
        if (onProgress) {
          await onProgress(
            `Reusing cached Python handoff "${chosen.jobId}" (${chosen.selectedPoolCount} beats, ${chosen.attachedReplayCount} zoomed replay angles)`
          );
        }
        const handoff = JSON.parse(
          await fs.readFile(chosen.handoffPath, "utf-8")
        ) as PythonDirectorHandoff;
        return { handoff, handoffPath: chosen.handoffPath, cacheHit: true };
      }
    }

    // 3. Spawn `run_ingest.py` live and stream stage progress
    const pythonBin = await this.resolvePythonBinary();
    const scriptPath = path.join(process.cwd(), "run_ingest.py");
    const ingestRoot = StorageService.getSubDir("ingest");
    const hash = crypto
      .createHash("sha1")
      .update(`${normalizePathKey(absVideoPath)}::${normalizePromptKey(effectivePrompt)}`)
      .digest("hex")
      .slice(0, 8);
    const safeStem = path
      .parse(absVideoPath)
      .name.replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 24);
    const ingestJobId = `ing_${safeStem}_${hash}`;
    const poolSize = Math.min(24, Math.max(12, targetPages * 6));

    const args = [
      scriptPath,
      "--video",
      absVideoPath,
      "--focus",
      effectivePrompt,
      "--pages",
      String(targetPages),
      "--pool-size",
      String(poolSize),
      "--output-dir",
      ingestRoot,
      "--job-id",
      ingestJobId,
    ];
    if (!reuseCache) {
      args.push("--no-cache", "--overwrite-clips");
    }

    if (onProgress) {
      await onProgress(
        `Launching Python ingest (${path.basename(pythonBin)} run_ingest.py) on "${path.basename(absVideoPath)}"...`
      );
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(pythonBin, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
        },
      });

      let stderrTail = "";
      const rl = readline.createInterface({ input: child.stdout });
      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (trimmed && trimmed.startsWith("[Stage") && onProgress) {
          void onProgress(trimmed);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString("utf-8")).slice(-2000);
      });

      child.on("error", (err) => reject(err));
      child.on("close", (code) => {
        rl.close();
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Python ingest pipeline exited with code ${code}${
                stderrTail ? `: ${stderrTail.trim()}` : ""
              }`
            )
          );
        }
      });
    });

    const handoffPath = path.join(ingestRoot, ingestJobId, "handoff.json");
    const rawJson = await fs.readFile(handoffPath, "utf-8");
    const handoff = JSON.parse(rawJson) as PythonDirectorHandoff;
    return { handoff, handoffPath, cacheHit: false };
  }

  /**
   * Selects a chronologically ordered story subset from `handoff.selected_pool`,
   * stages both live clips AND top paired zoomed-in replay snippets into `data/`,
   * and produces `NormalizedClip[]` + `ClipEventAnalysis[]` + `upstreamHandoffContext`
   * ready for `MangaDirectorAgent` & `CarbonIllustrationAgent`.
   */
  static async convertHandoffToMangaInputs(params: {
    handoff: PythonDirectorHandoff;
    targetPages: number;
  }): Promise<{
    clips: NormalizedClip[];
    analyses: ClipEventAnalysis[];
    upstreamHandoffContext: string;
  }> {
    const { handoff, targetPages } = params;
    await StorageService.ensureDirectories();

    // Pick a crisp story-sized subset (~3-4 primary beats per manga page) while preserving
    // early setup, mid-game escalation, and the highest-ranked climax/emotional beats!
    const pool = [...handoff.selected_pool].sort((a, b) => a.peak_sec - b.peak_sec);
    const maxPrimaryBeats = Math.min(pool.length, Math.max(6, targetPages * 3 + 2));

    let chosenBeats: PythonScoredCandidate[];
    if (pool.length <= maxPrimaryBeats) {
      chosenBeats = pool;
    } else {
      const byRank = [...pool].sort(
        (a, b) => b.scores.composite_story_rank - a.scores.composite_story_rank
      );
      const pickedIds = new Set<string>();
      // Guarantee earliest setup beat + final climax/aftermath beat + top-ranked beats
      pickedIds.add(pool[0].candidate_id);
      const topClimax = byRank.filter((c) => c.casting_quadrant === "climax_candidate");
      if (topClimax[0]) pickedIds.add(topClimax[0].candidate_id);
      for (const item of byRank) {
        if (pickedIds.size >= maxPrimaryBeats) break;
        pickedIds.add(item.candidate_id);
      }
      chosenBeats = pool.filter((c) => pickedIds.has(c.candidate_id));
    }

    // Decide which top beats ALSO register their paired zoomed-in replay snippet as an
    // immediately following `[Zoomed Close-Up Angle]` clip (up to 4 so total clips stay nimble!)
    const beatsWithReplaysByRank = [...chosenBeats]
      .filter((b) => b.replay_angles && b.replay_angles.length > 0)
      .sort((a, b) => b.scores.composite_story_rank - a.scores.composite_story_rank)
      .slice(0, 4);
    const expandReplayIds = new Set(beatsWithReplaysByRank.map((b) => b.candidate_id));

    const clips: NormalizedClip[] = [];
    const analyses: ClipEventAnalysis[] = [];
    let orderIndex = 0;

    for (const beat of chosenBeats) {
      const liveBundle = await this.stageSingleBeatAsClip({
        beat,
        orderIndex: orderIndex++,
        handoff,
      });
      if (liveBundle) {
        clips.push(liveBundle.clip);
        analyses.push(liveBundle.analysis);
      }

      if (expandReplayIds.has(beat.candidate_id) && beat.replay_angles.length > 0) {
        const bestAngle = beat.replay_angles[0];
        const repBundle = await this.stageReplayAngleAsClip({
          parentBeat: beat,
          angle: bestAngle,
          orderIndex: orderIndex++,
          handoff,
        });
        if (repBundle) {
          clips.push(repBundle.clip);
          analyses.push(repBundle.analysis);
        }
      }
    }

    const segLines = handoff.segment_summaries
      .map(
        (s) =>
          `- [${formatClockLabel(s.start_sec)}–${formatClockLabel(s.end_sec)}]: ${s.game_state_summary}`
      )
      .join("\n");

    const upstreamHandoffContext = [
      `UPSTREAM FULL-GAME CONTEXT (from Python Gemini 4 + Decisions API Pipeline):`,
      `- User Accompanying Prompt: "${handoff.job_input.user_focus}"`,
      `- Protagonist / Focus Target: ${handoff.game_plan.protagonist_focus}`,
      `- Intended Story Arc Angle: ${handoff.game_plan.story_angle}`,
      `- Full Video Duration: ${handoff.video_metadata.duration_sec.toFixed(1)}s`,
      ``,
      `CHRONOLOGICAL GAME PROGRESSION SUMMARIES:`,
      segLines,
      ``,
      `CAMERA ANGLE GUIDANCE FOR STORYBOARDING:`,
      `- Standard clips provide full unbroken LIVE play sequences, game clock context, and verbatim announcer quotes.`,
      `- Clips marked "[Zoomed Close-Up Replay Angle]" immediately follow their parent live play and provide tight baseline/rim/close-up frames without scorebug obstruction—PREFER these zoomed-in clips for dramatic close-up or splash panels so artwork converts cleanly from real close-up pixels!`,
    ].join("\n");

    return { clips, analyses, upstreamHandoffContext };
  }

  private static async stageClipFileIntoDataDir(
    sourceClipPath: string,
    clipId: string
  ): Promise<string> {
    const srcResolved = path.resolve(sourceClipPath);
    const dataBase = path.resolve(StorageService.getBaseDir());
    if (srcResolved.startsWith(dataBase + path.sep)) {
      return srcResolved;
    }
    const targetPath = path.join(StorageService.getSubDir("clips"), `${clipId}.mp4`);
    const targetStat = await fs.stat(targetPath).catch(() => null);
    if (!targetStat || targetStat.size === 0) {
      await fs.copyFile(srcResolved, targetPath);
    }
    return targetPath;
  }

  private static async stageFrameFilesIntoKeyframes(params: {
    clipId: string;
    clipPath: string;
    clipStartSec: number;
    clipDurationSec: number;
    frameSamples: PythonFrameSample[];
    primaryKeyframePath?: string | null;
    primaryKeyframeSec?: number | null;
  }): Promise<KeyframeReference[]> {
    const {
      clipId,
      clipPath,
      clipStartSec,
      clipDurationSec,
      frameSamples,
      primaryKeyframePath,
      primaryKeyframeSec,
    } = params;

    const rawList: PythonFrameSample[] = [];
    if (frameSamples && frameSamples.length > 0) {
      rawList.push(...frameSamples);
    }
    if (
      primaryKeyframePath &&
      !rawList.some((f) => f.path === primaryKeyframePath)
    ) {
      rawList.push({
        path: primaryKeyframePath,
        timestamp_sec: primaryKeyframeSec ?? clipStartSec + clipDurationSec * 0.6,
        sharpness: 1500,
      });
    }

    const outDir = path.join(StorageService.getSubDir("keyframes"), clipId);
    await fs.mkdir(outDir, { recursive: true });
    const refs: KeyframeReference[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const sample = rawList[i];
      const exists = await fs
        .stat(sample.path)
        .then((s) => s.isFile())
        .catch(() => false);
      if (!exists) continue;

      const localTs = Number(
        Math.min(
          Math.max(0.05, sample.timestamp_sec - clipStartSec),
          Math.max(0.05, clipDurationSec - 0.05)
        ).toFixed(2)
      );
      const frameId = `${clipId}_f${String(i + 1).padStart(2, "0")}`;
      const ext = path.extname(sample.path).toLowerCase() || ".jpg";
      const stagedPath = path.join(outDir, `${frameId}${ext}`);

      const stagedExists = await fs.stat(stagedPath).catch(() => null);
      if (!stagedExists) {
        await fs.copyFile(sample.path, stagedPath);
      }

      const [meta, sharpnessScore] = await Promise.all([
        sharp(stagedPath).metadata(),
        KeyframeExtractionService.computeSharpnessScore(stagedPath),
      ]);

      refs.push({
        frameId,
        clipId,
        timestampSec: localTs,
        gameTimestampSec: Number(sample.timestamp_sec.toFixed(2)),
        filePath: stagedPath,
        mediaUrl: StorageService.toMediaUrl(stagedPath),
        width: meta.width || 960,
        height: meta.height || 540,
        sharpnessScore,
      });
    }

    if (refs.length >= 2) {
      return refs.sort((a, b) => a.timestampSec - b.timestampSec);
    }

    // Fallback: extract fresh keyframes directly via FFmpeg
    return KeyframeExtractionService.extractKeyframesForClip({
      clipId,
      videoPath: clipPath,
      durationSec: clipDurationSec,
      originalGameTimestampSec: clipStartSec,
      frameCount: 4,
    });
  }

  private static async stageSingleBeatAsClip(params: {
    beat: PythonScoredCandidate;
    orderIndex: number;
    handoff: PythonDirectorHandoff;
  }): Promise<{ clip: NormalizedClip; analysis: ClipEventAnalysis } | null> {
    const { beat, orderIndex, handoff } = params;
    if (!beat.clip_path) return null;
    const clipExists = await fs
      .stat(beat.clip_path)
      .then((s) => s.isFile())
      .catch(() => false);
    if (!clipExists) return null;

    const jobTag = handoff.job_input.job_id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 14);
    const clipId = `ing_${jobTag}_${beat.candidate_id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const stagedClipPath = await this.stageClipFileIntoDataDir(beat.clip_path, clipId);
    const probe = await VideoInputService.probeVideo(stagedClipPath);

    const clipStartSec = beat.clip_start_sec ?? beat.start_sec;
    const keyframes = await this.stageFrameFilesIntoKeyframes({
      clipId,
      clipPath: stagedClipPath,
      clipStartSec,
      clipDurationSec: probe.durationSec,
      frameSamples: beat.burst_frames || [],
      primaryKeyframePath: beat.keyframe_path,
      primaryKeyframeSec: beat.keyframe_sec ?? beat.peak_sec,
    });

    const quotesText =
      beat.verbatim_quotes.length > 0
        ? beat.verbatim_quotes.map((q) => `"${q.text}"`).join(" | ")
        : "";

    const clip = await StorageService.saveClip({
      clipId,
      title: `${formatClockLabel(beat.peak_sec)} — ${beat.description.slice(0, 62)}${
        beat.description.length > 62 ? "..." : ""
      }`,
      orderIndex,
      originalFileName: path.basename(handoff.video_metadata.video_path),
      filePath: stagedClipPath,
      mediaUrl: StorageService.toMediaUrl(stagedClipPath),
      mimeType: "video/mp4",
      durationSec: probe.durationSec,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      isConsolidatedSegment: true,
      segmentStartOffsetSec: clipStartSec,
      metadata: {
        players: beat.players_involved,
        score: beat.score_context || undefined,
        gameClock: formatClockLabel(beat.peak_sec),
        originalGameTimestampSec: clipStartSec,
        eventDescription: `${beat.description} ${beat.narrative_context}${
          quotesText ? ` [Commentary: ${quotesText}]` : ""
        }`.trim(),
        userInstructions: handoff.job_input.user_focus,
      },
      keyframes,
      confidence: Math.min(0.99, Math.max(0.7, beat.scores.composite_story_rank)),
      createdAt: new Date().toISOString(),
    });

    const localPeakTs = Number(
      Math.min(
        Math.max(0.05, beat.peak_sec - clipStartSec),
        Math.max(0.05, probe.durationSec - 0.05)
      ).toFixed(2)
    );
    const nearestPeakKf =
      [...keyframes].sort(
        (a, b) => Math.abs(a.timestampSec - localPeakTs) - Math.abs(b.timestampSec - localPeakTs)
      )[0] || keyframes[0];

    const bestMoments: BestVisualMoment[] = [];
    if (keyframes.length >= 3) {
      bestMoments.push({
        timestampSec: keyframes[0].timestampSec,
        nearestFrameId: keyframes[0].frameId,
        momentRole: "setup",
        visualReason: "Play setup / possession catalyst",
      });
    }
    bestMoments.push({
      timestampSec: nearestPeakKf.timestampSec,
      nearestFrameId: nearestPeakKf.frameId,
      momentRole: "peak_action",
      visualReason: beat.description,
    });
    if (keyframes.length >= 2 && keyframes[keyframes.length - 1].frameId !== nearestPeakKf.frameId) {
      const tailKf = keyframes[keyframes.length - 1];
      bestMoments.push({
        timestampSec: tailKf.timestampSec,
        nearestFrameId: tailKf.frameId,
        momentRole: "aftermath",
        visualReason: "Follow-through / immediate reaction",
      });
    }

    const sigMap: Record<string, ClipEventAnalysis["narrativeSignificance"]> = {
      climax_candidate: "climax",
      emotional_beat: beat.scores.narrative_leverage >= 0.82 ? "high" : "medium",
      swagger_montage: "medium",
      drop: "low",
    };

    const segSummary =
      handoff.segment_summaries.find((s) => s.segment_id === beat.segment_id)
        ?.game_state_summary || beat.narrative_context;

    const analysis = ClipEventAnalysisSchema.parse({
      clipId,
      eventType: inferEventType(beat.description, beat.category, beat.casting_quadrant),
      actionSummary: beat.description,
      actionSequence: beat.description
        .split(/\s*->\s*|\.\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
      offensiveTeam: null,
      defensiveTeam: null,
      outcomeVerified: inferOutcome(beat.description, beat.category),
      pointsScored: inferOutcome(beat.description, beat.category) === "scored_basket"
        ? beat.description.toLowerCase().includes("three")
          ? 3
          : 2
        : null,
      mainPlayers: parseDetectedPlayers(beat.players_involved),
      significantReactions: beat.verbatim_quotes.map(
        (q) => `Verbatim Commentary (@${q.timestamp_sec.toFixed(1)}s): "${q.text}"`
      ),
      gameContextSummary: `${beat.score_context ? `[${beat.score_context}] ` : ""}${segSummary}`,
      emotionalIntensity: Math.min(
        10,
        Math.max(
          3,
          Math.round(
            (0.55 * beat.scores.narrative_leverage + 0.45 * beat.scores.action_spectacle) * 10
          )
        )
      ),
      narrativeSignificance: sigMap[beat.casting_quadrant] || "medium",
      narrativeRelevanceExplanation: `${beat.narrative_context} (Decisions API: story=${beat.scores.narrative_leverage.toFixed(
        2
      )}, action=${beat.scores.action_spectacle.toFixed(
        2
      )}, focus=${beat.scores.user_focus_match.toFixed(2)})`,
      bestMoments,
      supportingEvidence: [
        `Full-game timestamp: ${beat.start_sec.toFixed(1)}s–${beat.end_sec.toFixed(1)}s (peak ${beat.peak_sec.toFixed(1)}s)`,
        ...beat.verbatim_quotes.map((q) => `Commentator quote: "${q.text}"`),
      ],
      uncertainties: [],
      confidence: Math.min(0.99, Math.max(0.75, beat.scores.composite_story_rank)),
    });

    return { clip, analysis };
  }

  private static async stageReplayAngleAsClip(params: {
    parentBeat: PythonScoredCandidate;
    angle: PythonReplayAngle;
    orderIndex: number;
    handoff: PythonDirectorHandoff;
  }): Promise<{ clip: NormalizedClip; analysis: ClipEventAnalysis } | null> {
    const { parentBeat, angle, orderIndex, handoff } = params;
    if (!angle.clip_path) return null;
    const clipExists = await fs
      .stat(angle.clip_path)
      .then((s) => s.isFile())
      .catch(() => false);
    if (!clipExists) return null;

    const jobTag = handoff.job_input.job_id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 14);
    const clipId = `ing_${jobTag}_${parentBeat.candidate_id}_zoom`.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
    const stagedClipPath = await this.stageClipFileIntoDataDir(angle.clip_path, clipId);
    const probe = await VideoInputService.probeVideo(stagedClipPath);

    const clipStartSec = angle.clip_start_sec ?? angle.start_sec;
    const keyframes = await this.stageFrameFilesIntoKeyframes({
      clipId,
      clipPath: stagedClipPath,
      clipStartSec,
      clipDurationSec: probe.durationSec,
      frameSamples: angle.burst_frames || [],
      primaryKeyframePath: angle.keyframe_path,
      primaryKeyframeSec: angle.keyframe_sec ?? angle.peak_sec,
    });

    const clip = await StorageService.saveClip({
      clipId,
      title: `[Zoomed Close-Up Replay Angle] ${angle.description.slice(0, 52)}`,
      orderIndex,
      originalFileName: path.basename(handoff.video_metadata.video_path),
      filePath: stagedClipPath,
      mediaUrl: StorageService.toMediaUrl(stagedClipPath),
      mimeType: "video/mp4",
      durationSec: probe.durationSec,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      isConsolidatedSegment: true,
      segmentStartOffsetSec: clipStartSec,
      metadata: {
        players: parentBeat.players_involved,
        score: parentBeat.score_context || undefined,
        gameClock: formatClockLabel(parentBeat.peak_sec),
        originalGameTimestampSec: clipStartSec,
        eventDescription: `[ZOOMED-IN ${angle.camera_framing.toUpperCase()} ANGLE OF PRECEDING PLAY — IDEAL FOR CLOSE-UP / SPLASH MANGA PANEL] ${angle.description}`,
        userInstructions: handoff.job_input.user_focus,
      },
      keyframes,
      confidence: 0.96,
      createdAt: new Date().toISOString(),
    });

    const localPeakTs = Number(
      Math.min(
        Math.max(0.05, angle.peak_sec - clipStartSec),
        Math.max(0.05, probe.durationSec - 0.05)
      ).toFixed(2)
    );
    const nearestPeakKf =
      [...keyframes].sort(
        (a, b) => Math.abs(a.timestampSec - localPeakTs) - Math.abs(b.timestampSec - localPeakTs)
      )[0] || keyframes[0];

    const analysis = ClipEventAnalysisSchema.parse({
      clipId,
      eventType: inferEventType(parentBeat.description, parentBeat.category, parentBeat.casting_quadrant),
      actionSummary: `[Zoomed ${angle.camera_framing} close-up angle] ${angle.description}`,
      actionSequence: [angle.description],
      offensiveTeam: null,
      defensiveTeam: null,
      outcomeVerified: inferOutcome(parentBeat.description, parentBeat.category),
      pointsScored: null,
      mainPlayers: parseDetectedPlayers(parentBeat.players_involved),
      significantReactions: parentBeat.verbatim_quotes.map(
        (q) => `Verbatim Commentary: "${q.text}"`
      ),
      gameContextSummary: `Zoomed-in ${angle.camera_framing} camera angle paired to live play (${
        parentBeat.score_context || "same play"
      }) — ideal for direct close-up manga panel conversion without extrapolation.`,
      emotionalIntensity: Math.min(
        10,
        Math.max(5, Math.round(parentBeat.scores.action_spectacle * 10))
      ),
      narrativeSignificance:
        parentBeat.casting_quadrant === "climax_candidate" ? "climax" : "high",
      narrativeRelevanceExplanation:
        "Tight zoomed-in camera angle providing large, clear player silhouettes for close-up or splash manga panels.",
      bestMoments: [
        {
          timestampSec: nearestPeakKf.timestampSec,
          nearestFrameId: nearestPeakKf.frameId,
          momentRole: "peak_action",
          visualReason: `Zoomed ${angle.camera_framing} apex pose`,
        },
      ],
      supportingEvidence: [`Paired zoomed replay snippet (${probe.durationSec.toFixed(1)}s)`],
      uncertainties: [],
      confidence: 0.95,
    });

    return { clip, analysis };
  }
}
