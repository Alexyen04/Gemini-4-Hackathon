import fs from "fs/promises";
import path from "path";
import {
  NormalizedClip,
  NormalizedClipSchema,
  MangaStoryProject,
  MangaStoryProjectSchema,
  GenerationJob,
  GenerationJobSchema,
} from "@/types/manga";

export class StorageService {
  static getBaseDir(): string {
    const custom = process.env.MANGA_DATA_DIR;
    return custom
      ? path.resolve(process.cwd(), custom)
      : path.join(process.cwd(), "data");
  }

  static getSubDir(
    sub:
      | "clips"
      | "keyframes"
      | "stories"
      | "jobs"
      | "panels"
      | "pages"
      | "tmp"
      | "raw_videos"
      | "ingest"
  ): string {
    return path.join(this.getBaseDir(), sub);
  }

  static async ensureDirectories(): Promise<void> {
    const subs = [
      "clips",
      "keyframes",
      "stories",
      "jobs",
      "panels",
      "pages",
      "tmp",
      "raw_videos",
      "ingest",
    ] as const;
    await Promise.all(
      subs.map((s) => fs.mkdir(this.getSubDir(s), { recursive: true }))
    );
  }

  /**
   * Converts an absolute path inside `data/` into a browser-accessible
   * `/api/media/...` URL (encoding spaces/special chars safely).
   */
  static toMediaUrl(absFilePath: string): string {
    const base = this.getBaseDir();
    const rel = path.relative(base, absFilePath).split(path.sep);
    if (rel[0] === ".." || path.isAbsolute(rel[0] || "")) {
      throw new Error("File path is outside managed data directory");
    }
    return `/api/media/${rel.map((seg) => encodeURIComponent(seg)).join("/")}`;
  }

  /**
   * Safely resolves relative segments from `/api/media/[...path]` to an
   * absolute file path inside `data/`, preventing path traversal and blocking
   * public exposure of internal `manga_refs` / `reference_cache` assets.
   */
  static resolveMediaSegments(segments: string[]): string {
    const decoded = segments.map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    });
    if (
      decoded[0] === "manga_refs" ||
      decoded[0] === "reference_cache"
    ) {
      throw new Error("Internal manga reference assets cannot be publicly served");
    }
    const base = path.resolve(this.getBaseDir());
    const joined = path.resolve(base, ...decoded);
    if (joined !== base && !joined.startsWith(base + path.sep)) {
      throw new Error("Invalid media path traversal blocked");
    }
    return joined;
  }

  /**
   * Atomic JSON write using temporary file + rename so concurrent readers
   * never observe partially written JSON.
   */
  private static async writeJsonAtomic(
    targetPath: string,
    data: unknown
  ): Promise<void> {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2, 8)}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempPath, targetPath);
  }

  // ---- Clips ----

  static async saveClip(clip: NormalizedClip): Promise<NormalizedClip> {
    await this.ensureDirectories();
    const validated = NormalizedClipSchema.parse(clip);
    const jsonPath = path.join(
      this.getSubDir("clips"),
      `${validated.clipId}.json`
    );
    await this.writeJsonAtomic(jsonPath, validated);
    return validated;
  }

  static async getClip(clipId: string): Promise<NormalizedClip | null> {
    try {
      const safeId = clipId.replace(/[^a-zA-Z0-9_-]/g, "");
      const jsonPath = path.join(this.getSubDir("clips"), `${safeId}.json`);
      const raw = await fs.readFile(jsonPath, "utf-8");
      return NormalizedClipSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  static async listClips(): Promise<NormalizedClip[]> {
    await this.ensureDirectories();
    const dir = this.getSubDir("clips");
    const entries = await fs.readdir(dir);
    const clips: NormalizedClip[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry), "utf-8");
        clips.push(NormalizedClipSchema.parse(JSON.parse(raw)));
      } catch {
        // Ignore corrupted partial files
      }
    }

    return clips.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  static async deleteClip(clipId: string): Promise<boolean> {
    const clip = await this.getClip(clipId);
    if (!clip) return false;

    const safeId = clipId.replace(/[^a-zA-Z0-9_-]/g, "");
    const jsonPath = path.join(this.getSubDir("clips"), `${safeId}.json`);
    await fs.rm(jsonPath, { force: true });
    await fs.rm(clip.filePath, { force: true });
    await fs.rm(path.join(this.getSubDir("keyframes"), safeId), {
      recursive: true,
      force: true,
    });
    return true;
  }

  // ---- Stories ----

  static async saveStory(
    project: MangaStoryProject
  ): Promise<MangaStoryProject> {
    await this.ensureDirectories();
    const validated = MangaStoryProjectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
    });
    const jsonPath = path.join(
      this.getSubDir("stories"),
      `${validated.storyId}.json`
    );
    await this.writeJsonAtomic(jsonPath, validated);
    return validated;
  }

  static async getStory(storyId: string): Promise<MangaStoryProject | null> {
    try {
      const safeId = storyId.replace(/[^a-zA-Z0-9_-]/g, "");
      const jsonPath = path.join(this.getSubDir("stories"), `${safeId}.json`);
      const raw = await fs.readFile(jsonPath, "utf-8");
      return MangaStoryProjectSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  static async listStories(): Promise<MangaStoryProject[]> {
    await this.ensureDirectories();
    const dir = this.getSubDir("stories");
    const entries = await fs.readdir(dir);
    const stories: MangaStoryProject[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry), "utf-8");
        stories.push(MangaStoryProjectSchema.parse(JSON.parse(raw)));
      } catch {
        // Skip invalid records
      }
    }

    return stories.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  // ---- Generation Jobs & Checkpoints ----

  static async saveJob(job: GenerationJob): Promise<GenerationJob> {
    await this.ensureDirectories();
    const validated = GenerationJobSchema.parse({
      ...job,
      updatedAt: new Date().toISOString(),
    });
    const jsonPath = path.join(this.getSubDir("jobs"), `${validated.jobId}.json`);
    await this.writeJsonAtomic(jsonPath, validated);
    return validated;
  }

  static async getJob(jobId: string): Promise<GenerationJob | null> {
    try {
      const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
      const jsonPath = path.join(this.getSubDir("jobs"), `${safeId}.json`);
      const raw = await fs.readFile(jsonPath, "utf-8");
      return GenerationJobSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  static async saveCheckpoint<T>(
    jobId: string,
    stageName: string,
    payload: T
  ): Promise<void> {
    await this.ensureDirectories();
    const safeJob = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeStage = stageName.replace(/[^a-zA-Z0-9_-]/g, "");
    const checkpointPath = path.join(
      this.getSubDir("jobs"),
      `${safeJob}.checkpoint.${safeStage}.json`
    );
    await this.writeJsonAtomic(checkpointPath, payload);
  }

  static async loadCheckpoint<T>(
    jobId: string,
    stageName: string
  ): Promise<T | null> {
    try {
      const safeJob = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
      const safeStage = stageName.replace(/[^a-zA-Z0-9_-]/g, "");
      const checkpointPath = path.join(
        this.getSubDir("jobs"),
        `${safeJob}.checkpoint.${safeStage}.json`
      );
      const raw = await fs.readFile(checkpointPath, "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
