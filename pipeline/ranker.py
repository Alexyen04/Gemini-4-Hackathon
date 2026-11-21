"""Stage 3: Calibrated Two-Axis Scoring (`gemini-decision-1`) & Balanced Pool Selection.

Balances storyline-driven live sequences with zoomed-in manga-ready camera angles:
- Live plays with attached `replay_angles` get sharp close-up keyframes extracted
  automatically and a subtle panel-readiness clarity boost.
- Unmatched standalone zoomed-in replay snippets (`is_replay=True`) are kept eligible
  (capped gently so they enrich panel choices without crowding out live story beats).
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from media.frames import extract_sharpest_keyframe
from pipeline.gemini_client import (
    call_with_retries,
    encode_file_base64,
    get_v1beta_client,
)
from pipeline.prompts import build_decision_questions
from pipeline.scout import infer_is_replay
from schemas.models import (
    CandidateBeat,
    CandidateScores,
    CastingQuadrant,
    GamePlan,
    ReplayAngle,
    ScoredCandidate,
    SegmentOutput,
)


def classify_casting_quadrant(
    action_spectacle: float,
    narrative_leverage: float,
    *,
    action_thresh: float = 0.55,
    story_thresh: float = 0.55,
) -> CastingQuadrant:
    """Apply the 2x2 Manga Casting Matrix defined in AGENTS.md."""
    high_action = action_spectacle >= action_thresh
    high_story = narrative_leverage >= story_thresh
    if high_action and high_story:
        return "climax_candidate"
    if not high_action and high_story:
        return "emotional_beat"
    if high_action and not high_story:
        return "swagger_montage"
    return "drop"


def compute_effective_rank(
    cand_is_replay: bool,
    raw_composite: float,
    *,
    has_attached_replays: bool = False,
    standalone_replay_multiplier: float = 0.90,
) -> float:
    """Balance live plays vs. standalone zoomed-in replay snippets.

    - Live plays with attached zoomed-in `replay_angles` get a small +0.03 bonus
      (they offer BOTH live story context AND close-up panel frames!).
    - Standalone `is_replay=True` snippets take only a mild 0.90x adjustment so
      high-value zoomed-in shots still make the pool when needed.
    """
    if cand_is_replay:
        return round(raw_composite * standalone_replay_multiplier, 4)
    if has_attached_replays:
        return round(min(1.0, raw_composite + 0.03), 4)
    return round(raw_composite, 4)


def _score_single_candidate_sync(
    candidate: CandidateBeat,
    segment_summary: str,
    game_plan: GamePlan,
    *,
    video_path: str | Path,
    keyframes_dir: str | Path,
    total_video_duration_sec: float,
) -> ScoredCandidate:
    """Extract sharpest keyframe (+ attached replay keyframes) and score via Decisions API."""
    kf_dir = Path(keyframes_dir).resolve()
    kf_target = kf_dir / f"{candidate.candidate_id}.jpg"
    kf_sample = extract_sharpest_keyframe(video_path, candidate.peak_sec, kf_target)

    # Also extract sharp close-up keyframes for any paired `replay_angles`!
    enriched_replays: list[ReplayAngle] = []
    for r_idx, angle in enumerate(candidate.replay_angles, start=1):
        rkf_target = kf_dir / f"{candidate.candidate_id}_rep{r_idx}.jpg"
        rkf_sample = extract_sharpest_keyframe(video_path, angle.peak_sec, rkf_target)
        enriched_replays.append(
            angle.model_copy(
                update={
                    "keyframe_path": rkf_sample.path,
                    "keyframe_sec": rkf_sample.timestamp_sec,
                    "keyframe_sharpness": rkf_sample.sharpness,
                }
            )
        )

    is_rep = infer_is_replay(candidate.is_replay, candidate.description)
    decision_client = get_v1beta_client()
    quotes_str = (
        "; ".join(f'"{q.text}" ({q.timestamp_sec:.1f}s)' for q in candidate.verbatim_quotes)
        if candidate.verbatim_quotes
        else "None"
    )
    game_progress_pct = (candidate.peak_sec / max(total_video_duration_sec, 1.0)) * 100.0

    context_text = (
        f"Basketball Game Context:\n"
        f"- User Focus / Protagonist: {game_plan.protagonist_focus} "
        f"(specific_focus={game_plan.has_specific_focus})\n"
        f"- Intended Story Angle: {game_plan.story_angle}\n"
        f"- Segment Summary: {segment_summary}\n"
        f"- Timeline Position: {candidate.peak_sec:.1f}s / {total_video_duration_sec:.1f}s "
        f"({game_progress_pct:.0f}% through clip)\n"
        f"- Camera Framing: {candidate.camera_framing} | Is Replay Snippet: {is_rep} | "
        f"Attached Zoomed Replays: {len(enriched_replays)}\n"
        f"- Candidate Category: {candidate.category}\n"
        f"- Score / Clock Context: {candidate.score_context or 'Unknown'}\n"
        f"- Players Involved: {', '.join(candidate.players_involved) or 'Unspecified'}\n"
        f"- Play / Beat Description: {candidate.description}\n"
        f"- Narrative Context: {candidate.narrative_context}\n"
        f"- Verbatim Commentary: {quotes_str}\n"
        f"- Emotional Tone: {candidate.emotional_tone}\n"
    )

    questions = build_decision_questions(game_plan.protagonist_focus)

    # If a zoomed-in replay keyframe is attached, pass the zoomed-in frame too so
    # `visual_clarity` reflects the best manga-convertible angle available for this beat!
    input_blocks = [
        {"type": "text", "text": context_text},
        {"type": "image", "data": encode_file_base64(kf_sample.path), "mime_type": "image/jpeg"},
    ]
    if enriched_replays and enriched_replays[0].keyframe_path:
        input_blocks.append(
            {
                "type": "text",
                "text": f"Attached zoomed-in replay angle ({enriched_replays[0].camera_framing}):",
            }
        )
        input_blocks.append(
            {
                "type": "image",
                "data": encode_file_base64(enriched_replays[0].keyframe_path),
                "mime_type": "image/jpeg",
            }
        )

    result = call_with_retries(
        lambda: decision_client.decisions.create(
            model="gemini-decision-1",
            input=input_blocks,
            questions=questions,
        )
    )

    def _read_prob(key: str, default: float = 0.5) -> tuple[float, float]:
        ans = result.answers.get(key) if hasattr(result, "answers") and result.answers else None
        if ans is None:
            return default, 0.0
        p = float(getattr(ans, "noul", default))
        c = float(getattr(ans, "confidence", 0.0) or 0.0)
        return round(max(0.0, min(1.0, p)), 4), round(max(0.0, min(1.0, c)), 4)

    p_action, c_action = _read_prob("action_spectacle")
    p_story, c_story = _read_prob("narrative_leverage")
    p_focus, c_focus = _read_prob(
        "user_focus_match", default=0.75 if not game_plan.has_specific_focus else 0.5
    )
    p_visual, c_visual = _read_prob("visual_clarity")

    w = game_plan.scoring_weights.normalized()
    raw_composite = (
        w.action_spectacle * p_action
        + w.narrative_leverage * p_story
        + w.user_focus_match * p_focus
        + w.visual_clarity * p_visual
    )
    composite = compute_effective_rank(
        is_rep,
        raw_composite,
        has_attached_replays=bool(enriched_replays),
    )

    quadrant = classify_casting_quadrant(p_action, p_story)
    scores = CandidateScores(
        action_spectacle=p_action,
        narrative_leverage=p_story,
        user_focus_match=p_focus,
        visual_clarity=p_visual,
        composite_story_rank=composite,
        confidences={
            "action_spectacle": c_action,
            "narrative_leverage": c_story,
            "user_focus_match": c_focus,
            "visual_clarity": c_visual,
        },
    )

    return ScoredCandidate(
        **candidate.model_copy(
            update={"is_replay": is_rep, "replay_angles": enriched_replays}
        ).model_dump(),
        keyframe_path=kf_sample.path,
        keyframe_sec=kf_sample.timestamp_sec,
        keyframe_sharpness=kf_sample.sharpness,
        scores=scores,
        casting_quadrant=quadrant,
    )


def _overlaps_existing(
    cand: ScoredCandidate,
    existing: list[ScoredCandidate],
    *,
    overlap_threshold: float = 0.45,
) -> bool:
    """Prevent selecting two candidates whose time spans produce nearly identical clips."""
    for other in existing:
        inter_s = max(cand.start_sec, other.start_sec)
        inter_e = min(cand.end_sec, other.end_sec)
        inter = max(0.0, inter_e - inter_s)
        if inter > 0.0:
            shortest = max(0.5, min(cand.end_sec - cand.start_sec, other.end_sec - other.start_sec))
            if (inter / shortest) >= overlap_threshold:
                return True
        if cand.category == other.category and abs(cand.peak_sec - other.peak_sec) <= 2.5:
            return True
    return False


def select_balanced_story_pool(
    scored: list[ScoredCandidate],
    *,
    target_pool_size: int = 22,
    max_standalone_replays: int = 4,
    min_swagger_rank: float = 0.48,
) -> list[ScoredCandidate]:
    """Select a storyline-balanced pool keeping BOTH live sequences AND zoomed-in snippets.

    - Live beats already carry their paired zoomed-in `replay_angles` for free (0 extra slots!).
    - Up to `max_standalone_replays` (default 4) unmatched zoomed-in `is_replay=True` snippets
      are ALSO welcomed into the pool (clipped as tiny 3-4s snippets) so the storyline model
      has a wide range of close-up manga-ready frames to pick from.
    """
    normalized_scored = [
        c.model_copy(update={"is_replay": infer_is_replay(c.is_replay, c.description)})
        for c in scored
    ]

    if len(normalized_scored) <= target_pool_size:
        return [
            c.model_copy(update={"pool_selection_reason": c.casting_quadrant})
            for c in sorted(normalized_scored, key=lambda x: x.peak_sec)
        ]

    by_rank = sorted(
        normalized_scored,
        key=lambda c: c.scores.composite_story_rank,
        reverse=True,
    )

    selected: dict[str, ScoredCandidate] = {}
    standalone_replay_count = 0

    def _can_add(cand: ScoredCandidate) -> bool:
        if cand.candidate_id in selected:
            return False
        if cand.is_replay and standalone_replay_count >= max_standalone_replays:
            return False
        if _overlaps_existing(cand, list(selected.values())):
            return False
        return True

    def _add(cand: ScoredCandidate, reason: str) -> None:
        nonlocal standalone_replay_count
        selected[cand.candidate_id] = cand.model_copy(
            update={"pool_selection_reason": reason}
        )
        if cand.is_replay:
            standalone_replay_count += 1

    climax_quota = max(4, round(target_pool_size * 0.50))
    emotion_quota = max(3, round(target_pool_size * 0.35))
    swagger_quota = max(0, target_pool_size - climax_quota - emotion_quota)

    # 1. Climax / Turning-Point candidates (prioritizing live sequences first, then top zoomed snippets)
    taken_climax = 0
    for item in [x for x in by_rank if not x.is_replay] + [x for x in by_rank if x.is_replay]:
        if taken_climax >= climax_quota:
            break
        if item.casting_quadrant == "climax_candidate" and _can_add(item):
            _add(
                item,
                "zoomed_replay_panel_option" if item.is_replay else "climax_or_turning_point_quota",
            )
            taken_climax += 1

    # 2. Emotional / Tension / Story beats
    taken_emotion = 0
    for item in by_rank:
        if len(selected) >= target_pool_size or taken_emotion >= emotion_quota:
            break
        if item.casting_quadrant == "emotional_beat" and _can_add(item):
            _add(item, "story_tension_or_emotion_quota")
            taken_emotion += 1

    # 3. Swagger / Dominance setup beats ONLY if above quality floor
    taken_swagger = 0
    for item in by_rank:
        if len(selected) >= target_pool_size or taken_swagger >= swagger_quota:
            break
        if (
            item.casting_quadrant == "swagger_montage"
            and item.scores.composite_story_rank >= min_swagger_rank
            and _can_add(item)
        ):
            _add(item, "dominance_or_setup_action_quota")
            taken_swagger += 1

    # 4. Ensure at least 2 setup/struggle beats from first 60% of timeline for narrative arc
    min_t = min(c.peak_sec for c in normalized_scored)
    max_t = max(c.peak_sec for c in normalized_scored)
    setup_horizon = min_t + 0.60 * max(max_t - min_t, 1.0)
    early_in_pool = [c for c in selected.values() if c.peak_sec <= setup_horizon]
    if len(early_in_pool) < 2:
        early_ranked = [
            c for c in by_rank if c.peak_sec <= setup_horizon and _can_add(c)
        ]
        for eb in early_ranked[: (2 - len(early_in_pool))]:
            if len(selected) >= target_pool_size:
                removable = sorted(
                    (x for x in selected.values() if x.peak_sec > setup_horizon),
                    key=lambda x: x.scores.composite_story_rank,
                )
                if removable:
                    removed = removable[0]
                    if removed.is_replay:
                        standalone_replay_count = max(0, standalone_replay_count - 1)
                    del selected[removed.candidate_id]
            if len(selected) < target_pool_size:
                _add(eb, "early_or_midgame_setup_anchor")

    # 5. Backfill remaining slots (including high-clarity zoomed replay snippets up to cap)
    for item in by_rank:
        if len(selected) >= target_pool_size:
            break
        if _can_add(item):
            _add(
                item,
                "zoomed_replay_panel_option" if item.is_replay else "composite_rank_backfill",
            )

    return sorted(selected.values(), key=lambda c: c.peak_sec)


async def rank_and_select_pool(
    candidates: list[CandidateBeat],
    segments: list[SegmentOutput],
    game_plan: GamePlan,
    *,
    video_path: str | Path,
    keyframes_dir: str | Path,
    total_video_duration_sec: float,
    target_pool_size: int = 22,
    max_concurrency: int = 6,
) -> tuple[list[ScoredCandidate], list[ScoredCandidate]]:
    """Score all deduplicated candidates concurrently via Gemini Decision 1 and select pool."""
    seg_summary_map = {s.segment_id: s.game_state_summary for s in segments}
    sem = asyncio.Semaphore(max(1, max_concurrency))

    async def _worker(cand: CandidateBeat) -> ScoredCandidate:
        async with sem:
            return await asyncio.to_thread(
                _score_single_candidate_sync,
                cand,
                seg_summary_map.get(cand.segment_id, ""),
                game_plan,
                video_path=video_path,
                keyframes_dir=keyframes_dir,
                total_video_duration_sec=total_video_duration_sec,
            )

    all_scored = list(await asyncio.gather(*(_worker(c) for c in candidates)))
    all_scored.sort(key=lambda c: c.scores.composite_story_rank, reverse=True)

    selected_pool = select_balanced_story_pool(
        all_scored, target_pool_size=target_pool_size
    )
    return selected_pool, all_scored
