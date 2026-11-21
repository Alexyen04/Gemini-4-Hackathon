import fs from "fs/promises";
import path from "path";
import { StorageService } from "@/lib/storage/storage-service";
import {
  MangaReferenceIndex,
  MangaReferenceIndexSchema,
  MangaVisualStyleProfile,
  MangaVisualStyleProfileSchema,
} from "./style-profile";

export class ReferenceIndexStore {
  static getProfileFilePath(): string {
    return path.join(StorageService.getBaseDir(), "manga_style_profile.json");
  }

  static getIndexFilePath(): string {
    return path.join(StorageService.getBaseDir(), "manga_reference_index.json");
  }

  private static async writeAtomic(
    filePath: string,
    payload: unknown
  ): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await fs.rename(tmp, filePath);
  }

  static async saveProfileAndIndex(
    profile: MangaVisualStyleProfile,
    index: MangaReferenceIndex
  ): Promise<void> {
    const validProfile = MangaVisualStyleProfileSchema.parse(profile);
    const validIndex = MangaReferenceIndexSchema.parse(index);
    await Promise.all([
      this.writeAtomic(this.getProfileFilePath(), validProfile),
      this.writeAtomic(this.getIndexFilePath(), validIndex),
    ]);
  }

  static async loadProfile(): Promise<MangaVisualStyleProfile | null> {
    try {
      const raw = await fs.readFile(this.getProfileFilePath(), "utf-8");
      return MangaVisualStyleProfileSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  static async loadIndex(): Promise<MangaReferenceIndex | null> {
    try {
      const raw = await fs.readFile(this.getIndexFilePath(), "utf-8");
      return MangaReferenceIndexSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /**
   * Returns the persisted style profile and reference index ONLY if both exist
   * on disk and match the live SHA-256 content fingerprint of `data/manga_refs/`.
   */
  static async loadValidCachedAnalysis(fingerprintHash: string): Promise<{
    profile: MangaVisualStyleProfile;
    index: MangaReferenceIndex;
  } | null> {
    const [profile, index] = await Promise.all([
      this.loadProfile(),
      this.loadIndex(),
    ]);

    if (
      profile &&
      index &&
      profile.fingerprint_hash === fingerprintHash &&
      index.fingerprint_hash === fingerprintHash
    ) {
      return { profile, index };
    }
    return null;
  }
}
