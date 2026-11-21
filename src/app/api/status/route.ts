import { NextResponse } from "next/server";
import {
  hasConfiguredApiKey,
  resolveRoleModel,
} from "@/lib/ai/gemini-client";
import { MangaSkillLoader } from "@/lib/manga/skill-loader";
import { ReferenceLoader } from "@/lib/manga/references/reference-loader";
import { ReferenceIndexStore } from "@/lib/manga/references/reference-index";

export async function GET(): Promise<NextResponse> {
  try {
    const apiKeyReady = hasConfiguredApiKey();
    const [skill, corpus, cachedProfile] = await Promise.all([
      MangaSkillLoader.loadSkill(),
      ReferenceLoader.discoverReferences(),
      ReferenceIndexStore.loadProfile(),
    ]);

    const cacheValid = Boolean(
      cachedProfile &&
        cachedProfile.fingerprint_hash === corpus.fingerprintHash &&
        !corpus.isEmpty
    );

    return NextResponse.json({
      apiKeyConfigured: apiKeyReady,
      recommendedDefaultMode: apiKeyReady
        ? process.env.MANGA_DEFAULT_MODE === "demo"
          ? "demo"
          : "real"
        : "demo",
      models: {
        clipUnderstanding: resolveRoleModel("argon"),
        mangaDirectorAndIllustrator: resolveRoleModel("carbon"),
        qualityReviewer: resolveRoleModel("hydrogen"),
        layoutOptimizer: resolveRoleModel("neon"),
      },
      skill: {
        name: skill.name,
        description: skill.description,
        loadedAt: skill.loadedAt,
      },
      references: {
        directory: "data/manga_refs/",
        chapterCount: corpus.chapterIds.length,
        pageCount: corpus.pages.length,
        isEmpty: corpus.isEmpty,
        profileCached: cacheValid,
        warning: corpus.isEmpty
          ? "data/manga_refs/ is currently empty — built-in basketball-manga guidelines will be used until reference chapters are added."
          : null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
