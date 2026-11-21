import fs from "fs/promises";
import path from "path";

export interface LoadedMangaSkill {
  name: string;
  description: string;
  coreSkillMarkdown: string;
  references: {
    mangaConventions: string;
    characterConsistency: string;
    illustrationGuidelines: string;
    panelLayouts: string;
    narrativePacing: string;
    referenceAnalysis: string;
    animeVisualLanguage: string;
    sportsActionComposition: string;
  };
  storyboardJsonSchema: Record<string, unknown>;
  loadedFromPath: string;
  loadedAt: string;
}

/**
 * MangaSkillLoader reads `.agents/skills/basketball-manga/SKILL.md` and its
 * reference documents at runtime so Gemini 4 Carbon and Hydrogen share
 * the exact same authoritative rules as Antigravity.
 */
export class MangaSkillLoader {
  private static cachedSkill: LoadedMangaSkill | null = null;
  private static lastLoadedMs = 0;
  private static readonly CACHE_TTL_MS = 15_000;

  static getSkillDirectory(rootDir: string = process.cwd()): string {
    return path.join(rootDir, ".agents", "skills", "basketball-manga");
  }

  private static parseFrontmatter(markdown: string): {
    name: string;
    description: string;
    body: string;
  } {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return {
        name: "basketball-manga",
        description: "Basketball manga storytelling skill",
        body: markdown,
      };
    }

    const frontmatter = match[1];
    const body = match[2];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

    return {
      name: nameMatch ? nameMatch[1].trim() : "basketball-manga",
      description: descMatch ? descMatch[1].trim() : "",
      body: body.trim(),
    };
  }

  static async loadSkill(
    forceReload = false,
    rootDir: string = process.cwd()
  ): Promise<LoadedMangaSkill> {
    const now = Date.now();
    if (
      !forceReload &&
      this.cachedSkill &&
      now - this.lastLoadedMs < this.CACHE_TTL_MS
    ) {
      return this.cachedSkill;
    }

    const skillDir = this.getSkillDirectory(rootDir);
    const refsDir = path.join(skillDir, "references");
    const schemaPath = path.join(skillDir, "schemas", "storyboard.schema.json");

    const [
      rawSkillMd,
      mangaConventions,
      characterConsistency,
      illustrationGuidelines,
      panelLayouts,
      narrativePacing,
      referenceAnalysis,
      animeVisualLanguage,
      sportsActionComposition,
      rawSchema,
    ] = await Promise.all([
      fs.readFile(path.join(skillDir, "SKILL.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "manga-conventions.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "character-consistency.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "illustration-guidelines.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "panel-layouts.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "narrative-pacing.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "reference-analysis.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "anime-visual-language.md"), "utf-8"),
      fs.readFile(path.join(refsDir, "sports-action-composition.md"), "utf-8"),
      fs.readFile(schemaPath, "utf-8"),
    ]);

    const parsed = this.parseFrontmatter(rawSkillMd);
    const storyboardJsonSchema = JSON.parse(rawSchema) as Record<
      string,
      unknown
    >;

    this.cachedSkill = {
      name: parsed.name,
      description: parsed.description,
      coreSkillMarkdown: parsed.body,
      references: {
        mangaConventions,
        characterConsistency,
        illustrationGuidelines,
        panelLayouts,
        narrativePacing,
        referenceAnalysis,
        animeVisualLanguage,
        sportsActionComposition,
      },
      storyboardJsonSchema,
      loadedFromPath: skillDir,
      loadedAt: new Date().toISOString(),
    };
    this.lastLoadedMs = now;
    return this.cachedSkill;
  }

  /**
   * Builds the runtime system instruction injected into Gemini 4 Carbon
   * during Stage 0 (Manga Visual Reference Analysis).
   */
  static async getReferenceAnalysisSystemInstruction(): Promise<string> {
    const skill = await this.loadSkill();
    return [
      `# ACTIVE SKILL: ${skill.name} — STAGE 0 VISUAL REFERENCE ANALYZER`,
      skill.references.referenceAnalysis,
      "",
      "## ANIME & MANGA VISUAL LANGUAGE TAXONOMY",
      skill.references.animeVisualLanguage,
      "",
      "## SPORTS ACTION COMPOSITION TAXONOMY",
      skill.references.sportsActionComposition,
    ].join("\n");
  }

  /**
   * Builds the runtime system instruction injected into Gemini 4 Carbon
   * during Stage 2 (Global Narrative Planning).
   */
  static async getNarrativeSystemInstruction(): Promise<string> {
    const skill = await this.loadSkill();
    return [
      `# ACTIVE SKILL: ${skill.name}`,
      skill.description,
      "",
      skill.coreSkillMarkdown,
      "",
      "## NARRATIVE PACING & BEAT DECOMPOSITION RULES",
      skill.references.narrativePacing,
      "",
      "## ANIME & MANGA STORYTELLING CONTROLS",
      skill.references.animeVisualLanguage,
      "",
      "## CHARACTER & UNIFORM CONSISTENCY RULES",
      skill.references.characterConsistency,
    ].join("\n");
  }

  /**
   * Builds the runtime system instruction injected into Gemini 4 Carbon
   * during Stage 3 (Reference-Guided Storyboarding).
   */
  static async getStoryboardSystemInstruction(): Promise<string> {
    const skill = await this.loadSkill();
    return [
      `# ACTIVE SKILL: ${skill.name}`,
      skill.coreSkillMarkdown,
      "",
      "## ANIME VISUAL LANGUAGE & INDEPENDENT ART CONTROLS",
      skill.references.animeVisualLanguage,
      "",
      "## SPORTS ACTION COMPOSITION MATRIX",
      skill.references.sportsActionComposition,
      "",
      "## PAGE LAYOUT TEMPLATES",
      skill.references.panelLayouts,
      "",
      "## MANGA LETTERING, SFX & CONVENTIONS",
      skill.references.mangaConventions,
      "",
      "## NARRATIVE PACING",
      skill.references.narrativePacing,
    ].join("\n");
  }

  /**
   * Builds the runtime system instruction injected into Gemini 4 Carbon
   * during Stage 4 (Reference-Guided Illustration Specification & SVG Generation).
   */
  static async getIllustrationSystemInstruction(): Promise<string> {
    const skill = await this.loadSkill();
    return [
      `# ACTIVE SKILL: ${skill.name} — CARBON REFERENCE-GUIDED ILLUSTRATION DIRECTOR`,
      skill.references.illustrationGuidelines,
      "",
      "## ANIME VISUAL LANGUAGE & MASTER PRESETS",
      skill.references.animeVisualLanguage,
      "",
      "## SPORTS ACTION COMPOSITION MATRIX",
      skill.references.sportsActionComposition,
      "",
      "## CHARACTER & UNIFORM CONSISTENCY",
      skill.references.characterConsistency,
    ].join("\n");
  }

  /**
   * Builds the runtime system instruction injected into Gemini 4 Hydrogen
   * during Stage 6 (Manga Quality Validation).
   */
  static async getQualityReviewSystemInstruction(): Promise<string> {
    const skill = await this.loadSkill();
    return [
      `# ACTIVE SKILL: ${skill.name} — REFERENCE-GUIDED QUALITY AUDITOR`,
      "Audit alignment with the Manga Visual Style Profile, anime-inspired expressiveness, artwork originality (never copying reference characters), factual fidelity to basketball footage, character consistency, reading order, and readability:",
      "",
      skill.coreSkillMarkdown,
      "",
      skill.references.animeVisualLanguage,
      "",
      skill.references.mangaConventions,
    ].join("\n");
  }
}
