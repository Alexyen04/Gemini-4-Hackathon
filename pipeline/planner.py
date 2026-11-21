"""Stage 1: User Focus Reasoning + Adaptive Chunk Plan (`gemini-4-carbon`)."""

from __future__ import annotations

from typing import Optional

from media.chunker import build_adaptive_chunk_plan
from pipeline.gemini_client import create_structured_interaction, get_v1_client
from pipeline.prompts import PLANNER_SYSTEM_INSTRUCTION, build_planner_user_prompt
from schemas.models import (
    GamePlan,
    JobInput,
    PlannerLLMOutput,
    ScoringWeights,
    VideoMetadata,
)


def fallback_game_plan_from_prompt(
    job_input: JobInput,
    video_meta: VideoMetadata,
    *,
    override_chunk_sec: Optional[float] = None,
    override_overlap_sec: Optional[float] = None,
    split_into_quarters: bool = False,
) -> GamePlan:
    """Deterministic fallback planner (used in offline tests or if planner LLM is skipped)."""
    prompt_clean = job_input.user_focus.strip()
    generic_phrases = {
        "",
        "tell the main dramatic storyline of this basketball game.",
        "tell the main dramatic story of this game.",
    }
    has_focus = prompt_clean.lower() not in generic_phrases

    weights = (
        ScoringWeights(
            action_spectacle=0.18,
            narrative_leverage=0.35,
            user_focus_match=0.37,
            visual_clarity=0.10,
        )
        if has_focus
        else ScoringWeights(
            action_spectacle=0.25,
            narrative_leverage=0.45,
            user_focus_match=0.15,
            visual_clarity=0.15,
        )
    ).normalized()

    chunks = build_adaptive_chunk_plan(
        video_meta.duration_sec,
        override_chunk_sec=override_chunk_sec,
        override_overlap_sec=override_overlap_sec,
        split_into_quarters=split_into_quarters,
    )
    return GamePlan(
        protagonist_focus=prompt_clean if has_focus else "Main on-court momentum & clutch performers",
        has_specific_focus=has_focus,
        focus_start_sec=None,
        focus_end_sec=None,
        story_angle="Setup & deficit -> momentum swings -> clutch climax",
        scout_instructions=(
            f"Prioritize both the climax focus ({prompt_clean}) AND the earlier deficits/struggles "
            "that set it up. Start every scoring beat 4-7s BEFORE the bucket so clips capture the "
            "steal/pass/shot release, and separate post-play celebrations into `story_emotion` beats."
        ),
        scoring_weights=weights,
        chunks=chunks,
    )


def build_game_plan(
    job_input: JobInput,
    video_meta: VideoMetadata,
    *,
    planner_model: str = "gemini-4-carbon",
    override_chunk_sec: Optional[float] = None,
    override_overlap_sec: Optional[float] = None,
    split_into_quarters: bool = False,
) -> GamePlan:
    """Run Gemini 4 Carbon to interpret user_focus and generate adaptive chunk windows."""
    client = get_v1_client()

    prompt = build_planner_user_prompt(
        duration_sec=video_meta.duration_sec,
        width=video_meta.width,
        height=video_meta.height,
        target_pages=job_input.target_pages,
        user_focus=job_input.user_focus,
    )

    llm_plan = create_structured_interaction(
        client,
        model=planner_model,
        input_payload=prompt,
        schema_model=PlannerLLMOutput,
        system_instruction=PLANNER_SYSTEM_INSTRUCTION,
    )

    f_start = llm_plan.focus_start_sec
    f_end = llm_plan.focus_end_sec
    if f_start is not None:
        f_start = max(0.0, min(f_start, video_meta.duration_sec))
    if f_end is not None:
        f_end = max(0.0, min(f_end, video_meta.duration_sec))
    if f_start is not None and f_end is not None and f_end <= f_start + 3.0:
        f_start, f_end = None, None

    chunks = build_adaptive_chunk_plan(
        video_meta.duration_sec,
        focus_start_sec=f_start,
        focus_end_sec=f_end,
        override_chunk_sec=override_chunk_sec,
        override_overlap_sec=override_overlap_sec,
        split_into_quarters=split_into_quarters,
    )

    return GamePlan(
        protagonist_focus=llm_plan.protagonist_focus,
        has_specific_focus=llm_plan.has_specific_focus,
        focus_start_sec=f_start,
        focus_end_sec=f_end,
        story_angle=llm_plan.story_angle,
        scout_instructions=llm_plan.scout_instructions,
        scoring_weights=llm_plan.scoring_weights.normalized(),
        chunks=chunks,
    )
