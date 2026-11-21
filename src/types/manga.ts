import { z } from "zod";

// ============================================================================
// 1. Strict Gemini 4 Model Allowlist
// ============================================================================

export const ALLOWED_GEMINI_MODELS = [
  "gemini-4-argon",
  "gemini-4-carbon",
  "gemini-4-neon",
  "gemini-4-hydrogen",
] as const;

export type AllowedGeminiModel = (typeof ALLOWED_GEMINI_MODELS)[number];

export const PipelineModeSchema = z.enum(["real", "demo"]);
export type PipelineMode = z.infer<typeof PipelineModeSchema>;

// ============================================================================
// 2. Manga & Anime Storytelling Presets & Independent Art Controls
// ============================================================================

export const CANONICAL_MANGA_STYLES = [
  "authentic_sports_manga",
  "hyperkinetic_shonen_anime",
  "cinematic_anime_drama",
] as const;

export type MangaStylePreset = (typeof CANONICAL_MANGA_STYLES)[number];

/**
 * Supports the three anime/manga presets (with authentic_sports_manga
 * as the default) while seamlessly upgrading any previously persisted stories.
 */
export const MangaStylePresetSchema = z.preprocess((val) => {
  if (val === "realistic_sports_manga") return "authentic_sports_manga";
  if (val === "exaggerated_shonen") return "hyperkinetic_shonen_anime";
  if (val === "minimalist_cinematic") return "cinematic_anime_drama";
  return val;
}, z.enum(CANONICAL_MANGA_STYLES));

export const ColorTreatmentSchema = z.enum([
  "traditional_monochrome",
  "full_anime_color",
  "selective_color",
]);
export type ColorTreatment = z.infer<typeof ColorTreatmentSchema>;

export const ActionIntensitySchema = z.enum([
  "grounded",
  "dramatic",
  "explosive",
]);
export type ActionIntensity = z.infer<typeof ActionIntensitySchema>;

export const ReferenceInfluenceSchema = z.enum([
  "light",
  "balanced",
  "strong",
]);
export type ReferenceInfluence = z.infer<typeof ReferenceInfluenceSchema>;

export const StorytellingFocusSchema = z.enum([
  "action_focused",
  "balanced",
  "emotion_focused",
]);
export type StorytellingFocus = z.infer<typeof StorytellingFocusSchema>;

export const ReadingDirectionSchema = z.enum(["rtl", "ltr"]);
export type ReadingDirection = z.infer<typeof ReadingDirectionSchema>;

export const PageTypeSchema = z.enum([
  "normal",
  "action",
  "dialogue",
  "dramatic",
  "splash",
]);
export type PageType = z.infer<typeof PageTypeSchema>;

export const LayoutTemplateIdSchema = z.enum([
  "balanced_four",
  "balanced_five",
  "dramatic_three",
  "hero_action_four",
  "climax_showcase_three",
  "vertical_strip_four",
  "full_splash",
]);
export type LayoutTemplateId = z.infer<typeof LayoutTemplateIdSchema>;

export const CameraShotSchema = z.enum([
  "extreme_closeup",
  "closeup",
  "medium_shot",
  "wide_shot",
  "low_angle",
  "high_angle",
  "dutch_angle",
  "behind_player",
  "dynamic_action",
]);
export type CameraShot = z.infer<typeof CameraShotSchema>;

export const MangaEmotionSchema = z.enum([
  "determination",
  "shock",
  "triumph",
  "exhaustion",
  "defeat",
  "focus",
]);
export type MangaEmotion = z.infer<typeof MangaEmotionSchema>;

export const PanelSizeSchema = z.enum(["small", "medium", "large", "splash"]);
export type PanelSize = z.infer<typeof PanelSizeSchema>;

export const NarrativeStageSchema = z.enum([
  "introduction",
  "rising_action",
  "conflict",
  "climax",
  "resolution",
]);
export type NarrativeStage = z.infer<typeof NarrativeStageSchema>;

export const RendererModeSchema = z.enum([
  "hybrid",
  "svg_vector",
  "frame_guided",
]);
export type RendererMode = z.infer<typeof RendererModeSchema>;

export const BubbleTypeSchema = z.enum([
  "speech",
  "shout",
  "thought",
  "narration",
  "scoreboard",
  "time_indicator",
]);
export type BubbleType = z.infer<typeof BubbleTypeSchema>;

export const BubblePlacementSchema = z.enum([
  "top_right",
  "top_left",
  "bottom_right",
  "bottom_left",
  "top_center",
  "bottom_center",
]);
export type BubblePlacement = z.infer<typeof BubblePlacementSchema>;

export const MangaPreferencesSchema = z.object({
  style: MangaStylePresetSchema.default("authentic_sports_manga"),
  colorTreatment: ColorTreatmentSchema.default("traditional_monochrome"),
  actionIntensity: ActionIntensitySchema.default("dramatic"),
  referenceInfluence: ReferenceInfluenceSchema.default("balanced"),
  storytellingFocus: StorytellingFocusSchema.default("balanced"),
  targetPages: z.number().int().min(1).max(8).default(3),
  readingDirection: ReadingDirectionSchema.default("ltr"),
  storyFocus: z
    .enum([
      "team_comeback",
      "star_duel",
      "defensive_grit",
      "clutch_finish",
      "auto",
    ])
    .default("auto"),
  dramaticIntensity: z.number().min(1).max(10).default(8),
  visualEffectsIntensity: z.number().min(1).max(10).default(8),
  useLayoutOptimizerNeon: z.boolean().default(false),
  directorNotes: z.string().max(1000).optional().default(""),
  userPrompt: z.string().max(1500).optional(),
});
export type MangaPreferences = z.infer<typeof MangaPreferencesSchema>;

export const CachedHandoffSummarySchema = z.object({
  jobId: z.string(),
  handoffPath: z.string(),
  userFocus: z.string(),
  selectedPoolCount: z.number().int().nonnegative(),
  attachedReplayCount: z.number().int().nonnegative().default(0),
  updatedAt: z.string(),
});
export type CachedHandoffSummary = z.infer<typeof CachedHandoffSummarySchema>;

export const RawVideoRecordSchema = z.object({
  videoId: z.string(),
  fileName: z.string(),
  title: z.string(),
  filePath: z.string(),
  mediaUrl: z.string(),
  durationSec: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  sizeBytes: z.number().nonnegative(),
  cachedHandoffs: z.array(CachedHandoffSummarySchema).default([]),
  createdAt: z.string(),
});
export type RawVideoRecord = z.infer<typeof RawVideoRecordSchema>;

// ============================================================================
// 3. Stage 1: Video Clips & Keyframe Schemas
// ============================================================================

export const KeyframeReferenceSchema = z.object({
  frameId: z.string(),
  clipId: z.string(),
  timestampSec: z.number().min(0),
  gameTimestampSec: z.number().optional(),
  filePath: z.string(),
  mediaUrl: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sharpnessScore: z.number().min(0).max(1).default(0.8),
});
export type KeyframeReference = z.infer<typeof KeyframeReferenceSchema>;

export const ClipGameMetadataSchema = z.object({
  gameId: z.string().optional(),
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  players: z.array(z.string()).default([]),
  quarter: z.string().optional(),
  gameClock: z.string().optional(),
  score: z.string().optional(),
  eventDescription: z.string().optional(),
  originalGameTimestampSec: z.number().optional(),
  highlightRank: z.number().int().min(1).max(20).optional(),
  userInstructions: z.string().optional(),
});
export type ClipGameMetadata = z.infer<typeof ClipGameMetadataSchema>;

export const NormalizedClipSchema = z.object({
  clipId: z.string(),
  title: z.string(),
  orderIndex: z.number().int().min(0),
  originalFileName: z.string(),
  filePath: z.string(),
  mediaUrl: z.string(),
  mimeType: z.string(),
  durationSec: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  isConsolidatedSegment: z.boolean().default(false),
  parentConsolidatedId: z.string().optional(),
  segmentStartOffsetSec: z.number().min(0).default(0),
  metadata: ClipGameMetadataSchema,
  keyframes: z.array(KeyframeReferenceSchema),
  confidence: z.number().min(0).max(1).default(0.95),
  createdAt: z.string(),
});
export type NormalizedClip = z.infer<typeof NormalizedClipSchema>;

// ============================================================================
// 4. Stage 1: Gemini 4 Argon Clip Understanding Output
// ============================================================================

export const DetectedPlayerSchema = z.object({
  nameOrLabel: z.string(),
  jerseyNumber: z.string().nullable(),
  team: z.string().nullable(),
  role: z.enum(["offense_primary", "offense_support", "defender", "unknown"]),
  visualTraits: z.string(),
  confidence: z.number().min(0).max(1),
});
export type DetectedPlayer = z.infer<typeof DetectedPlayerSchema>;

export const BestVisualMomentSchema = z.object({
  timestampSec: z.number().min(0),
  nearestFrameId: z.string(),
  momentRole: z.enum(["setup", "anticipation", "peak_action", "aftermath"]),
  visualReason: z.string(),
});
export type BestVisualMoment = z.infer<typeof BestVisualMomentSchema>;

export const ClipEventAnalysisSchema = z.object({
  clipId: z.string(),
  eventType: z.enum([
    "dunk",
    "three_pointer",
    "midrange_jumper",
    "layup_drive",
    "block",
    "steal_fastbreak",
    "clutch_game_winner",
    "assist_playmaking",
    "rebound_putback",
    "defensive_stop",
    "other_highlight",
  ]),
  actionSummary: z.string(),
  actionSequence: z.array(z.string()).min(1),
  offensiveTeam: z.string().nullable(),
  defensiveTeam: z.string().nullable(),
  outcomeVerified: z.enum([
    "scored_basket",
    "missed_shot",
    "defensive_block_stop",
    "turnover_steal",
    "uncertain_outcome",
  ]),
  pointsScored: z.number().int().min(0).max(4).nullable(),
  mainPlayers: z.array(DetectedPlayerSchema),
  significantReactions: z.array(z.string()),
  gameContextSummary: z.string(),
  emotionalIntensity: z.number().min(1).max(10),
  narrativeSignificance: z.enum(["low", "medium", "high", "climax"]),
  narrativeRelevanceExplanation: z.string(),
  bestMoments: z.array(BestVisualMomentSchema).min(1),
  supportingEvidence: z.array(z.string()),
  uncertainties: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type ClipEventAnalysis = z.infer<typeof ClipEventAnalysisSchema>;

// ============================================================================
// 5. Character Reference System
// ============================================================================

export const MonochromeUniformEncodingSchema = z.enum([
  "light_ink_trim",
  "dark_halftone",
  "solid_ink",
]);
export type MonochromeUniformEncoding = z.infer<
  typeof MonochromeUniformEncodingSchema
>;

export const CharacterReferenceSchema = z.object({
  characterId: z.string(),
  displayName: z.string(),
  jerseyNumber: z.string().nullable(),
  teamName: z.string(),
  monochromeUniform: MonochromeUniformEncodingSchema,
  uniformDescription: z.string(),
  hairAndFaceTraits: z.string(),
  buildAndPosture: z.string(),
  accessories: z.array(z.string()),
  shootingHand: z.enum(["right", "left", "unknown"]).default("right"),
  referenceClipId: z.string(),
  referenceFrameId: z.string(),
  referenceImageUrl: z.string(),
  confidence: z.number().min(0).max(1),
});
export type CharacterReference = z.infer<typeof CharacterReferenceSchema>;

// ============================================================================
// 6. Stage 2: Gemini 4 Carbon Global Narrative Output
// ============================================================================

export const NarrativeBeatPlanSchema = z.object({
  beatId: z.string(),
  stage: NarrativeStageSchema,
  clipId: z.string(),
  startTimestampSec: z.number().min(0),
  endTimestampSec: z.number().min(0),
  headline: z.string(),
  storyFunction: z.string(),
  emotionalTone: MangaEmotionSchema,
  intensity: z.number().min(1).max(10),
  recommendedPanelCount: z.number().int().min(1).max(5),
});
export type NarrativeBeatPlan = z.infer<typeof NarrativeBeatPlanSchema>;

export const StoryChapterSchema = z.object({
  chapterId: z.string(),
  number: z.number().int().min(1),
  title: z.string(),
  arcSummary: z.string(),
});
export type StoryChapter = z.infer<typeof StoryChapterSchema>;

export const StoryNarrativeSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  summary: z.string(),
  protagonistFocus: z.string(),
  centralConflict: z.string(),
  stakesAndSetting: z.string(),
  emotionalProgression: z.array(z.string()).min(3),
  climaxClipId: z.string(),
  climaxExplanation: z.string(),
  resolutionSummary: z.string(),
  chapters: z.array(StoryChapterSchema).min(1),
  beats: z.array(NarrativeBeatPlanSchema).min(1),
  factualGroundingNotes: z.array(z.string()),
});
export type StoryNarrative = z.infer<typeof StoryNarrativeSchema>;

// ============================================================================
// 7. Carbon Reference-Guided Illustration Specification & Storyboard Schema
// ============================================================================

export const CarbonIllustrationSpecSchema = z.object({
  panelId: z.string(),
  renderer: RendererModeSchema.default("hybrid"),
  colorTreatment: ColorTreatmentSchema.default("traditional_monochrome"),
  focalX: z.number().min(0.05).max(0.95).default(0.5),
  focalY: z.number().min(0.05).max(0.95).default(0.45),
  zoomFactor: z.number().min(1.0).max(2.4).default(1.15),
  dutchTiltDeg: z.number().min(-14).max(14).default(0),
  inkContrast: z.number().min(0.4).max(1.0).default(0.84),
  edgeWeight: z.enum(["fine", "balanced", "bold_brush"]).default("bold_brush"),
  shadowDensity: z.number().min(0.1).max(0.95).default(0.58),
  screentoneDensity: z.number().min(0.0).max(0.85).default(0.38),
  screentoneAngleDeg: z.number().min(0).max(90).default(45),
  celShadingBands: z.number().int().min(2).max(6).default(4),
  backgroundMode: z
    .enum([
      "arena_simplified",
      "stark_white_tension",
      "speed_void",
      "dark_pressure",
    ])
    .default("arena_simplified"),
  speedLineMode: z
    .enum(["none", "diagonal", "radial", "horizontal", "vertical"])
    .default("diagonal"),
  speedLineIntensity: z.number().min(0).max(1).default(0.65),
  impactBurst: z.boolean().default(false),
  characterPlacement: z.string(),
  poseAndActionDetails: z.string(),
  animeExpressionAndAnatomyNotes: z.string().default(""),
  basketballPosition: z.string(),
  lightingDirection: z
    .enum(["top_arena", "rim_backlit", "side_dramatic", "low_upward"])
    .default("top_arena"),
  appliedReferenceTags: z.array(z.string()).default([]),
  artisticPrompt: z.string(),
  customSvgOverlay: z.string().nullable().default(null),
});
export type CarbonIllustrationSpec = z.infer<
  typeof CarbonIllustrationSpecSchema
>;

export const DialogueBubbleSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  text: z.string(),
  bubbleType: BubbleTypeSchema,
  placement: BubblePlacementSchema,
});
export type DialogueBubble = z.infer<typeof DialogueBubbleSchema>;

export const NormalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.05).max(1),
  height: z.number().min(0.05).max(1),
});
export type NormalizedRect = z.infer<typeof NormalizedRectSchema>;

export const PanelIllustrationRecordSchema = z.object({
  renderer: RendererModeSchema,
  referenceFrameIds: z.array(z.string()),
  style: MangaStylePresetSchema,
  colorTreatment: ColorTreatmentSchema.default("traditional_monochrome"),
  prompt: z.string(),
  spec: CarbonIllustrationSpecSchema.optional(),
  assetUrl: z.string().nullable().default(null),
  assetFilePath: z.string().nullable().default(null),
  svgOverlayUrl: z.string().nullable().default(null),
  generationCount: z.number().int().min(0).default(0),
});
export type PanelIllustrationRecord = z.infer<
  typeof PanelIllustrationRecordSchema
>;

export const PanelInteractionSchema = z.object({
  type: z.literal("play_source_clip").default("play_source_clip"),
  clipId: z.string(),
  timestamp: z.number().min(0),
  endTimestamp: z.number().min(0).optional(),
  originalGameClock: z.string().nullable().optional(),
});
export type PanelInteraction = z.infer<typeof PanelInteractionSchema>;

export const MangaPanelSchema = z.object({
  panelId: z.string(),
  readingOrder: z.number().int().min(1),
  sourceClipId: z.string(),
  sourceTimestamp: z.number().min(0),
  narrativeStage: NarrativeStageSchema,
  narrativeBeat: z.string(),
  characterIds: z.array(z.string()).default([]),
  cameraShot: CameraShotSchema,
  size: PanelSizeSchema,
  layout: NormalizedRectSchema,
  borderStyle: z
    .enum(["standard", "heavy_impact", "borderless_bleed", "diagonal_accent"])
    .default("standard"),
  description: z.string(),
  emotion: MangaEmotionSchema,
  visualEffects: z.array(z.string()).default([]),
  caption: z.string().nullable().default(null),
  sfx: z.string().nullable().default(null),
  sfxSubtext: z.string().nullable().default(null),
  dialogue: z.array(DialogueBubbleSchema).default([]),
  illustration: PanelIllustrationRecordSchema,
  interaction: PanelInteractionSchema,
});
export type MangaPanel = z.infer<typeof MangaPanelSchema>;

export const MangaPageSchema = z.object({
  pageId: z.string(),
  chapterId: z.string(),
  pageNumber: z.number().int().min(1),
  pageType: PageTypeSchema,
  layoutTemplate: LayoutTemplateIdSchema,
  panels: z.array(MangaPanelSchema).min(1).max(7),
  compositeAssetUrl: z.string().nullable().default(null),
});
export type MangaPage = z.infer<typeof MangaPageSchema>;

export const MangaStoryboardSchema = z.object({
  storyId: z.string(),
  title: z.string(),
  subtitle: z.string().default(""),
  summary: z.string(),
  style: MangaStylePresetSchema,
  readingDirection: ReadingDirectionSchema,
  chapters: z.array(StoryChapterSchema).min(1),
  pages: z.array(MangaPageSchema).min(1),
  sourceClips: z.array(z.string()).min(1),
});
export type MangaStoryboard = z.infer<typeof MangaStoryboardSchema>;

// ============================================================================
// 8. Stage 6: Gemini 4 Hydrogen Quality Review Output
// ============================================================================

export const PanelQualityFeedbackSchema = z.object({
  panelId: z.string(),
  score: z.number().min(0).max(100),
  factualAlignment: z.boolean(),
  characterConsistent: z.boolean(),
  styleProfileAlignment: z.boolean().default(true),
  originalityPass: z.boolean().default(true),
  readabilityPass: z.boolean(),
  issues: z.array(z.string()),
  suggestedAdjustment: z.string().nullable(),
  requiresRegeneration: z.boolean().default(false),
});
export type PanelQualityFeedback = z.infer<typeof PanelQualityFeedbackSchema>;

export const QualityReviewReportSchema = z.object({
  evaluatedByModel: z.string(),
  evaluatedAt: z.string(),
  overallScore: z.number().min(0).max(100),
  structuralPass: z.boolean(),
  narrativePass: z.boolean(),
  visualPass: z.boolean(),
  styleProfileAlignmentPass: z.boolean().default(true),
  originalityPass: z.boolean().default(true),
  summary: z.string(),
  strengths: z.array(z.string()),
  warnings: z.array(z.string()),
  panelFeedback: z.array(PanelQualityFeedbackSchema),
  regeneratedPanelIds: z.array(z.string()).default([]),
});
export type QualityReviewReport = z.infer<typeof QualityReviewReportSchema>;

// ============================================================================
// 9. Persisted Story Project & Job Progress Tracking
// ============================================================================

export const PipelineStageIdSchema = z.enum([
  "video_ingest",
  "reference_analysis",
  "clip_analysis",
  "character_references",
  "narrative_planning",
  "storyboard_generation",
  "carbon_illustration",
  "page_composition",
  "quality_validation",
  "completion",
]);
export type PipelineStageId = z.infer<typeof PipelineStageIdSchema>;

export const PipelineStageStatusSchema = z.object({
  id: PipelineStageIdSchema,
  label: z.string(),
  model: z.string().nullable(),
  status: z.enum(["pending", "running", "completed", "failed", "skipped"]),
  detail: z.string().default(""),
  startedAt: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
});
export type PipelineStageStatus = z.infer<typeof PipelineStageStatusSchema>;

export const GenerationJobSchema = z.object({
  jobId: z.string(),
  storyId: z.string(),
  mode: PipelineModeSchema,
  status: z.enum(["queued", "running", "completed", "failed"]),
  currentStage: PipelineStageIdSchema,
  stages: z.array(PipelineStageStatusSchema),
  completedPanels: z.number().int().min(0).default(0),
  totalPanels: z.number().int().min(0).default(0),
  livePanelPreviews: z
    .array(
      z.object({
        panelId: z.string(),
        pageNumber: z.number(),
        assetUrl: z.string(),
        caption: z.string().nullable(),
      })
    )
    .default([]),
  error: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

export const ReferenceProfileSummarySchema = z.object({
  profileId: z.string(),
  isBuiltinFallback: z.boolean(),
  referenceChapterCount: z.number().int().min(0),
  referencePageCount: z.number().int().min(0),
  fingerprintHash: z.string(),
  warning: z.string().nullable().default(null),
});
export type ReferenceProfileSummary = z.infer<
  typeof ReferenceProfileSummarySchema
>;

export const MangaStoryProjectSchema = z.object({
  storyId: z.string(),
  mode: PipelineModeSchema,
  preferences: MangaPreferencesSchema,
  referenceProfileSummary: ReferenceProfileSummarySchema.optional(),
  clips: z.array(NormalizedClipSchema),
  clipAnalyses: z.array(ClipEventAnalysisSchema),
  characters: z.array(CharacterReferenceSchema),
  narrative: StoryNarrativeSchema,
  storyboard: MangaStoryboardSchema,
  qualityReport: QualityReviewReportSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MangaStoryProject = z.infer<typeof MangaStoryProjectSchema>;
