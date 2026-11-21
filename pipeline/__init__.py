"""Stages 1 -> 3.5 ingest, parallel scouting, calibrated ranking, and handoff."""

from . import prompts
from .handoff import (
    build_director_handoff,
    build_storyline_model_input,
    compute_play_clip_window,
    estimate_handoff_mode_tradeoffs,
)
from .planner import build_game_plan
from .ranker import rank_and_select_pool, select_balanced_story_pool
from .scout import (
    deduplicate_candidates,
    realign_cached_segments_for_gop_drift,
    scout_all_chunks,
)

__all__ = [
    "build_director_handoff",
    "build_game_plan",
    "build_storyline_model_input",
    "compute_play_clip_window",
    "deduplicate_candidates",
    "estimate_handoff_mode_tradeoffs",
    "prompts",
    "rank_and_select_pool",
    "realign_cached_segments_for_gop_drift",
    "scout_all_chunks",
    "select_balanced_story_pool",
]
