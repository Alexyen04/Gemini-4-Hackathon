import { afterEach, describe, expect, it, vi } from "vitest";
import { MangaDirectorAgent } from "@/lib/ai/manga-director";
import { GeminiClientService } from "@/lib/ai/gemini-client";
import { MangaSkillLoader } from "@/lib/manga/skill-loader";
import {
  MangaStoryboardSchema,
  NormalizedClipSchema,
  StoryNarrativeSchema,
} from "@/types/manga";
import { StoryboardValidator } from "@/lib/manga/validators";

const clip = NormalizedClipSchema.parse({
  clipId: "c1",
  title: "Verified shot",
  orderIndex: 0,
  originalFileName: "shot.mp4",
  filePath: "/unused/shot.mp4",
  mediaUrl: "/shot.mp4",
  mimeType: "video/mp4",
  durationSec: 3,
  width: 640,
  height: 360,
  fps: 30,
  metadata: { eventDescription: "Verified shot" },
  keyframes: [],
  createdAt: new Date().toISOString(),
});
const narrative = StoryNarrativeSchema.parse({
  title: "The Shot",
  subtitle: "Chapter 1",
  summary: "One verified shot.",
  protagonistFocus: "Shooter",
  centralConflict: "Defense",
  stakesAndSetting: "On court",
  emotionalProgression: ["focus", "suspense", "resolution"],
  climaxClipId: "c1",
  climaxExplanation: "Shot",
  resolutionSummary: "Verified outcome",
  chapters: [{ chapterId: "ch1", number: 1, title: "The Shot", arcSummary: "One possession" }],
  beats: [{
    beatId: "b1", stage: "climax", clipId: "c1", startTimestampSec: 0,
    endTimestampSec: 3, headline: "Shot", storyFunction: "Climax",
    emotionalTone: "focus", intensity: 8, recommendedPanelCount: 1,
  }],
  factualGroundingNotes: [],
});
const preferences = {
  style: "hyperkinetic_shonen_anime" as const,
  colorTreatment: "traditional_monochrome" as const,
  actionIntensity: "dramatic" as const,
  referenceInfluence: "balanced" as const,
  storytellingFocus: "balanced" as const,
  targetPages: 1,
  readingDirection: "rtl" as const,
  storyFocus: "auto" as const,
  dramaticIntensity: 8,
  visualEffectsIntensity: 8,
  useLayoutOptimizerNeon: false,
  directorNotes: "",
};

afterEach(() => vi.restoreAllMocks());

describe("compact Stage 3 storyboard", () => {
  it("constructs a complete valid storyboard from a small creative plan", async () => {
    vi.spyOn(MangaSkillLoader, "getStoryboardSystemInstruction").mockResolvedValue("manga rules");
    const generate = vi.spyOn(GeminiClientService, "generateStructuredJson").mockImplementation(
      async ({ zodSchema }) => ({
        data: zodSchema.parse({
          pages: [{
            layoutTemplate: "full_splash",
            panels: [{
              sourceClipId: "c1", sourceTimestamp: 1.2, narrativeStage: "climax",
              narrativeBeat: "release", cameraShot: "low_angle", emotion: "focus",
              description: "Shooter releases the verified shot.",
            }],
          }],
        }),
        modelUsed: "gemini-4-carbon",
      })
    );
    const result = await MangaDirectorAgent.generateStoryboard({
      storyId: "s1", clips: [clip], analyses: [], characters: [],
      narrative, preferences,
    });
    expect(MangaStoryboardSchema.safeParse(result).success).toBe(true);
    expect(StoryboardValidator.validateStoryboard(result, [clip]).valid).toBe(true);
    expect(result.pages[0].panels[0].interaction.clipId).toBe("c1");
    expect(result.pages[0].panels[0].layout.width).toBe(1);
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0][0].role).toBe("carbon");
  });

  it("rejects invented clip IDs before constructing a storyboard", async () => {
    vi.spyOn(MangaSkillLoader, "getStoryboardSystemInstruction").mockResolvedValue("manga rules");
    vi.spyOn(GeminiClientService, "generateStructuredJson").mockImplementation(
      async ({ zodSchema }) => ({
        data: zodSchema.parse({
          pages: [{
            layoutTemplate: "full_splash",
            panels: [{
              sourceClipId: "invented", sourceTimestamp: 1, narrativeStage: "climax",
              narrativeBeat: "release", cameraShot: "low_angle", emotion: "focus",
              description: "Unknown play",
            }],
          }],
        }),
        modelUsed: "gemini-4-carbon",
      })
    );
    await expect(MangaDirectorAgent.generateStoryboard({
      storyId: "s1", clips: [clip], analyses: [], characters: [],
      narrative, preferences,
    })).rejects.toThrow("Unknown clip");
  });
});
