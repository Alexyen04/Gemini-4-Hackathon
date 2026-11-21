"""Canonical data contracts for the Basketball Video-to-Manga pipeline.

Covers Stages 0 -> 3.5 (Raw Input -> Pre-Director Handoff Package) as well as
the canonical MangaStoryboard contract documented in AGENTS.md so downstream
modules share one schema source of truth.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


ReadingDirection = Literal["rtl", "ltr"]
CandidateCategory = Literal["action", "story_emotion"]
CameraFraming = Literal[
    "wide_court", "medium_action", "tight_closeup", "rim_or_baseline"
]
EmotionalTone = Literal[
    "intense", "tense", "triumphant", "frustrated", "stunned", "calm"
]
CastingQuadrant = Literal[
    "climax_candidate", "swagger_montage", "emotional_beat", "drop"
]
HandoffMediaMode = Literal["keyframes_only", "burst_frames", "video_clips", "hybrid"]

# Downstream storyboard literals (kept in shared schemas per AGENTS.md)
LayoutTemplate = Literal[
    "opening_4panel",
    "tension_5panel",
    "climax_splash_4panel",
    "aftermath_3panel",
]
PanelSlot = Literal[
    "top_wide",
    "mid_left",
    "mid_right",
    "slant_left",
    "splash_hero",
    "bottom_strip",
]
NarrativeRole = Literal[
    "setup",
    "dominance",
    "struggle",
    "tension_pause",
    "turning_point",
    "escalation",
    "climax",
    "aftermath",
]
VisualIntensity = Literal["quiet", "medium", "explosive"]
CropFocus = Literal[
    "full_action", "tight_face", "hoop_and_ball", "scoreboard", "bench_reaction"
]
SfxStyle = Literal["sharp", "heavy", "quiet", "none"]
SpeedLinesStyle = Literal["none", "radial", "directional"]
InkMethod = Literal["opencv_deterministic", "nano_banana_verified"]


# ---------------------------------------------------------------------------
# Stage 0 / 1: Job Input, Video Metadata & Adaptive Game Plan
# ---------------------------------------------------------------------------


class VideoMetadata(BaseModel):
    video_path: str
    duration_sec: float = Field(gt=0.0)
    fps: float = Field(gt=0.0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class JobInput(BaseModel):
    job_id: str = Field(description="Unique identifier for this pipeline run.")
    video_path: str = Field(description="Local path to the input basketball video.")
    user_focus: str = Field(
        default="Tell the main dramatic storyline of this basketball game.",
        description="Optional player, quarter/time window, rivalry, or storyline focus.",
    )
    target_pages: int = Field(default=2, ge=1, le=8)
    target_pool_size: int = Field(
        default=20,
        ge=6,
        le=50,
        description="Number of balanced candidates to pass to the final storyline model.",
    )
    reading_direction: ReadingDirection = Field(default="rtl")
    enable_nano_banana: bool = Field(default=False)


class ScoringWeights(BaseModel):
    """Weights summing to 1.0 used in Stage 3 composite ranking."""

    action_spectacle: float = Field(default=0.25, ge=0.0, le=1.0)
    narrative_leverage: float = Field(default=0.35, ge=0.0, le=1.0)
    user_focus_match: float = Field(default=0.25, ge=0.0, le=1.0)
    visual_clarity: float = Field(default=0.15, ge=0.0, le=1.0)

    def normalized(self) -> "ScoringWeights":
        total = (
            self.action_spectacle
            + self.narrative_leverage
            + self.user_focus_match
            + self.visual_clarity
        )
        if total <= 0:
            return ScoringWeights()
        return ScoringWeights(
            action_spectacle=round(self.action_spectacle / total, 4),
            narrative_leverage=round(self.narrative_leverage / total, 4),
            user_focus_match=round(self.user_focus_match / total, 4),
            visual_clarity=round(self.visual_clarity / total, 4),
        )


class ChunkPlan(BaseModel):
    segment_id: str
    index: int = Field(ge=0)
    start_sec: float = Field(ge=0.0)
    end_sec: float = Field(gt=0.0)
    duration_sec: float = Field(gt=0.0)
    actual_start_sec: Optional[float] = Field(
        default=None,
        description="Exact source timestamp of frame 0 in chunk_path after H.264 keyframe seek.",
    )
    actual_duration_sec: Optional[float] = Field(
        default=None,
        description="Measured duration of chunk_path on disk.",
    )
    chunk_path: Optional[str] = None


class PlannerLLMOutput(BaseModel):
    """Structured output returned by Gemini 4 Carbon during Stage 1 planning."""

    protagonist_focus: str = Field(
        description="Who or what is the narrative center (player number/name, team, or duel)."
    )
    has_specific_focus: bool = Field(
        description="True if user_focus names a specific player, team, play type, or time segment."
    )
    focus_start_sec: Optional[float] = Field(
        default=None,
        description="Optional start timestamp in seconds if the user explicitly asked for a time window.",
    )
    focus_end_sec: Optional[float] = Field(
        default=None,
        description="Optional end timestamp in seconds if the user explicitly asked for a time window.",
    )
    story_angle: str = Field(
        description="Dramatic manga angle to look for (e.g., clutch comeback, cold-streak redemption, defensive battle)."
    )
    scout_instructions: str = Field(
        description="2-3 concrete instructions telling segment scouts what action and emotional/story beats to prioritize."
    )
    scoring_weights: ScoringWeights = Field(
        description="Recommended weights balancing action_spectacle, narrative_leverage, user_focus_match, and visual_clarity."
    )


class GamePlan(BaseModel):
    protagonist_focus: str
    has_specific_focus: bool = False
    focus_start_sec: Optional[float] = None
    focus_end_sec: Optional[float] = None
    story_angle: str
    scout_instructions: str
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    chunks: list[ChunkPlan] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Stage 2: Parallel Segment Scouting (Gemini 4 Argon / Hydrogen)
# ---------------------------------------------------------------------------


class VerbatimQuote(BaseModel):
    text: str = Field(description="Exact verbatim words spoken by the commentator.")
    timestamp_sec: float = Field(
        ge=0.0, description="Timestamp of quote (relative to chunk during LLM call; converted to full video seconds)."
    )


class RawChunkCandidate(BaseModel):
    """Schema requested directly from Gemini 4 during per-chunk scouting.

    Timestamps here are relative to the start of the chunk (0.0 .. chunk_duration)
    so the model never has to do offset arithmetic.
    """

    category: CandidateCategory = Field(
        description="'action' for explosive basketball highlights; 'story_emotion' for traps, misses, timeouts, fouls, close-up reactions, or momentum swings."
    )
    rel_start_sec: float = Field(
        ge=0.0, description="Start second relative to this video chunk (0.0 = start of chunk)."
    )
    rel_end_sec: float = Field(
        ge=0.0, description="End second relative to this video chunk."
    )
    rel_peak_sec: float = Field(
        ge=0.0, description="Exact peak action or peak emotional frame second relative to this chunk."
    )
    description: str = Field(
        description="Concrete factual description of the on-court play or emotional beat."
    )
    narrative_context: str = Field(
        description="Why this beat matters in the flow of the game (stakes, run, pressure, dominance, or redemption)."
    )
    players_involved: list[str] = Field(
        default_factory=list,
        description="Jersey numbers, spoken player names, or jersey colors involved.",
    )
    score_context: Optional[str] = Field(
        default=None,
        description="Visible scoreboard or spoken score + clock (e.g., 'LAL 98 - BOS 96, 1:12 4Q').",
    )
    verbatim_quotes: list[VerbatimQuote] = Field(default_factory=list)
    emotional_tone: EmotionalTone = Field(default="intense")
    is_replay: bool = Field(
        default=False,
        description="True if this is a broadcast replay (zoomed-in baseline/rim/slow-mo angle shown during a stoppage); False for live game-clock action.",
    )
    camera_framing: CameraFraming = Field(
        default="wide_court",
        description="Camera shot tightness: 'wide_court' (standard broadcast master), 'medium_action', 'tight_closeup' (face/upper-body zoom), or 'rim_or_baseline' (zoomed angle ideal for manga panels).",
    )


class RawChunkScoutResponse(BaseModel):
    game_state_summary: str = Field(
        description="3-4 sentences summarizing score progression, scoring runs, momentum, and how the focus player/team fared in this segment."
    )
    candidates: list[RawChunkCandidate] = Field(default_factory=list)


class FrameSample(BaseModel):
    path: str
    timestamp_sec: float = Field(ge=0.0)
    sharpness: float = Field(ge=0.0)


class ReplayAngle(BaseModel):
    """Zoomed-in / alternate-angle broadcast replay paired to a parent live beat.

    Kept as a tight 2-4.5s visual snippet + sharp close-up keyframe/burst so the
    final storyline & panel stage gets zoomed-in manga-ready compositions without
    needing AI image extrapolation or duplicating story beats in the pool.
    """

    replay_id: str
    start_sec: float = Field(ge=0.0)
    end_sec: float = Field(ge=0.0)
    peak_sec: float = Field(ge=0.0)
    camera_framing: CameraFraming = "rim_or_baseline"
    description: str
    keyframe_path: Optional[str] = None
    keyframe_sec: Optional[float] = None
    keyframe_sharpness: Optional[float] = None
    burst_frames: list[FrameSample] = Field(default_factory=list)
    clip_path: Optional[str] = None
    clip_start_sec: Optional[float] = None
    clip_end_sec: Optional[float] = None


class CandidateBeat(BaseModel):
    """Normalized candidate beat with timestamps in FULL source video seconds."""

    candidate_id: str = Field(description="Unique ID like 'seg_01_b01'.")
    segment_id: str = Field(description="Originating segment ID.")
    category: CandidateCategory
    start_sec: float = Field(ge=0.0, description="Start second in full source video.")
    end_sec: float = Field(ge=0.0, description="End second in full source video.")
    peak_sec: float = Field(ge=0.0, description="Peak moment second in full source video.")
    description: str
    narrative_context: str = Field(default="")
    players_involved: list[str] = Field(default_factory=list)
    score_context: Optional[str] = None
    verbatim_quotes: list[VerbatimQuote] = Field(default_factory=list)
    emotional_tone: EmotionalTone = Field(default="intense")
    is_replay: bool = Field(default=False)
    camera_framing: CameraFraming = Field(default="wide_court")
    replay_angles: list[ReplayAngle] = Field(
        default_factory=list,
        description="Optional zoomed-in broadcast replay snippets paired to this live play for close-up panel selection.",
    )


class SegmentOutput(BaseModel):
    segment_id: str
    start_sec: float = Field(ge=0.0)
    end_sec: float = Field(ge=0.0)
    game_state_summary: str
    candidates: list[CandidateBeat] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Stage 3: Two-Axis Calibrated Ranking (Gemini Decision 1)
# ---------------------------------------------------------------------------


class CandidateScores(BaseModel):
    action_spectacle: float = Field(ge=0.0, le=1.0)
    narrative_leverage: float = Field(ge=0.0, le=1.0)
    user_focus_match: float = Field(ge=0.0, le=1.0)
    visual_clarity: float = Field(ge=0.0, le=1.0)
    composite_story_rank: float = Field(ge=0.0, le=1.0)
    confidences: dict[str, float] = Field(default_factory=dict)


class ScoredCandidate(CandidateBeat):
    keyframe_path: Optional[str] = Field(
        default=None, description="Sharpest representative JPEG around peak_sec."
    )
    keyframe_sec: Optional[float] = Field(
        default=None, description="Exact source timestamp of keyframe_path."
    )
    keyframe_sharpness: Optional[float] = Field(default=None)
    burst_frames: list[FrameSample] = Field(
        default_factory=list,
        description="Optional multi-frame strip across [start_sec, end_sec] giving the storyline model frame choices.",
    )
    clip_path: Optional[str] = Field(
        default=None,
        description="Short trimmed .mp4 clip of this beat so the storyline model can inspect motion/frames directly.",
    )
    clip_start_sec: Optional[float] = Field(
        default=None,
        description="Full-video timestamp corresponding to 0.0s of clip_path.",
    )
    clip_end_sec: Optional[float] = Field(default=None)
    scores: CandidateScores
    casting_quadrant: CastingQuadrant
    pool_selection_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Stage 3.5: Pre-Director Handoff Package (Boundary Output of This Pipeline)
# ---------------------------------------------------------------------------


class SegmentSummaryEntry(BaseModel):
    segment_id: str
    start_sec: float
    end_sec: float
    game_state_summary: str


class PipelineStats(BaseModel):
    total_chunks: int
    raw_candidates_count: int
    deduped_candidates_count: int
    selected_pool_count: int
    quadrant_counts: dict[str, int] = Field(default_factory=dict)
    stage_timings_sec: dict[str, float] = Field(default_factory=dict)


class DirectorHandoffPackage(BaseModel):
    """Self-contained handoff artifact consumed by the final storyline model.

    Contains chronological game context + a balanced pool of scored action &
    storyline beats with BOTH extracted keyframes, burst frame strips, and
    trimmed video clips so downstream teammates can iterate freely on how the
    final storyline model ingests them.
    """

    schema_version: str = "1.0"
    job_input: JobInput
    video_metadata: VideoMetadata
    game_plan: GamePlan
    segment_summaries: list[SegmentSummaryEntry] = Field(default_factory=list)
    selected_pool: list[ScoredCandidate] = Field(
        default_factory=list,
        description="Balanced candidate pool sorted chronologically for storyline construction.",
    )
    all_scored_candidates: list[ScoredCandidate] = Field(
        default_factory=list,
        description="Complete ranked candidate list kept for threshold/prompt iteration without re-running Gemini.",
    )
    stats: PipelineStats


# ---------------------------------------------------------------------------
# Stage 4 & 5: Downstream Storyboard Contracts (Shared Reference per AGENTS.md)
# ---------------------------------------------------------------------------


class CaptionQuote(BaseModel):
    text: str
    timestamp_sec: float = Field(ge=0.0)


class ThoughtBubble(BaseModel):
    subject: str
    text: str
    grounding_cue: str


class SfxSpec(BaseModel):
    text: str = ""
    katakana: str = ""
    style: SfxStyle = "none"


class PanelEffects(BaseModel):
    speed_lines: SpeedLinesStyle = "none"
    impact_burst: bool = False


class PanelAssets(BaseModel):
    panel_image_url: Optional[str] = None
    source_frame_url: Optional[str] = None
    source_clip_url: Optional[str] = None


class PanelProvenanceScores(BaseModel):
    action_spectacle: float = Field(ge=0.0, le=1.0)
    narrative_leverage: float = Field(ge=0.0, le=1.0)
    user_focus_match: float = Field(ge=0.0, le=1.0)


class PanelProvenance(BaseModel):
    timestamp_sec: float = Field(ge=0.0)
    ink_method: InkMethod = "opencv_deterministic"
    edge_iou: float = Field(default=1.0, ge=0.0, le=1.0)
    decision_fidelity_score: float = Field(default=1.0, ge=0.0, le=1.0)
    scores: Optional[PanelProvenanceScores] = None


class MangaPanel(BaseModel):
    panel_id: str
    reading_order: int = Field(ge=1)
    slot: PanelSlot
    candidate_id: str
    narrative_role: NarrativeRole
    visual_intensity: VisualIntensity
    crop_focus: CropFocus = "full_action"
    action_bbox_norm: list[float] = Field(
        default_factory=lambda: [0.0, 0.0, 1.0, 1.0],
        min_length=4,
        max_length=4,
    )
    narration_box: Optional[str] = None
    caption_quote: Optional[CaptionQuote] = None
    thought_bubble: Optional[ThoughtBubble] = None
    sfx: SfxSpec = Field(default_factory=SfxSpec)
    effects: PanelEffects = Field(default_factory=PanelEffects)
    assets: PanelAssets = Field(default_factory=PanelAssets)
    provenance: Optional[PanelProvenance] = None


class MangaPage(BaseModel):
    page_number: int = Field(ge=1)
    layout_template: LayoutTemplate
    panels: list[MangaPanel] = Field(default_factory=list)


class MangaStoryboard(BaseModel):
    job_id: str
    title: str
    subtitle: str
    user_focus: str
    reading_direction: ReadingDirection = "rtl"
    arc_summary: str
    pages: list[MangaPage] = Field(default_factory=list)
