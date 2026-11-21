"""Stage 2: Concurrent Segment Scouting (`gemini-4-hydrogen` / `gemini-4-argon`).

Watches overlapping chunks in parallel, extracts:
  1) Full unbroken LIVE sequences (`is_replay=False`)
  2) Tight zoomed-in broadcast replay snippets (`is_replay=True`, 2-4.5s)
  3) Storyline / emotional beats (`story_emotion`)
Converts chunk-relative timestamps using exact H.264 `actual_start_sec`, merges
split back-to-back live action beats, and pairs zoomed-in replays onto their
parent live play as `replay_angles` (while keeping unmatched zoomed replays as
compact standalone options so panel-ready close-ups are never lost!).
"""

from __future__ import annotations

import asyncio
import re
from typing import Optional

from pipeline.gemini_client import (
    build_video_input_part,
    create_structured_interaction,
    get_v1_client,
)
from pipeline.prompts import SCOUT_SYSTEM_INSTRUCTION, build_scout_user_prompt
from schemas.models import (
    CandidateBeat,
    ChunkPlan,
    GamePlan,
    RawChunkScoutResponse,
    ReplayAngle,
    SegmentOutput,
    VerbatimQuote,
)

_REPLAY_PATTERN = re.compile(
    r"\b(replay|slow[- ]motion)\b",
    re.IGNORECASE,
)
_PLAY_KEYWORDS = {
    "three",
    "3-pointer",
    "dunk",
    "slam",
    "block",
    "steal",
    "deflect",
    "intercept",
    "layup",
    "jumper",
    "rebound",
    "putback",
    "foul",
    "turnover",
    "alley-oop",
}


def infer_is_replay(flag: bool, description: str) -> bool:
    if flag:
        return True
    return bool(_REPLAY_PATTERN.search(description or ""))


def _scout_single_chunk_sync(
    chunk: ChunkPlan,
    game_plan: GamePlan,
    *,
    total_video_duration_sec: float,
    scout_model: Optional[str] = None,
    force_agentic: Optional[bool] = None,
) -> SegmentOutput:
    """Synchronous worker executed inside `asyncio.to_thread`."""
    if not chunk.chunk_path:
        raise ValueError(f"Chunk {chunk.segment_id} has no chunk_path materialized.")

    chunk_base_sec = (
        chunk.actual_start_sec if chunk.actual_start_sec is not None else chunk.start_sec
    )
    chunk_dur = chunk.actual_duration_sec or chunk.duration_sec

    use_agentic = force_agentic if force_agentic is not None else (chunk_dur > 315.0)
    if scout_model:
        model_id = scout_model
    else:
        model_id = "gemini-4-argon" if use_agentic else "gemini-4-hydrogen"

    if use_agentic and model_id != "gemini-4-argon":
        use_agentic = False

    client = get_v1_client()
    video_part = build_video_input_part(client, chunk.chunk_path, agentic=use_agentic)

    # Allow enough candidate slots per 3m chunk to capture live plays + zoomed replay snippets
    target_beats = max(5, min(16, int(round(chunk_dur / 16.0)) + 4))
    prompt = build_scout_user_prompt(
        segment_id=chunk.segment_id,
        start_sec=chunk_base_sec,
        end_sec=min(total_video_duration_sec, chunk_base_sec + chunk_dur),
        duration_sec=chunk_dur,
        total_video_duration_sec=total_video_duration_sec,
        protagonist_focus=game_plan.protagonist_focus,
        story_angle=game_plan.story_angle,
        scout_instructions=game_plan.scout_instructions,
        target_beats=target_beats,
    )

    raw: RawChunkScoutResponse = create_structured_interaction(
        client,
        model=model_id,
        input_payload=[video_part, {"type": "text", "text": prompt}],
        schema_model=RawChunkScoutResponse,
        system_instruction=SCOUT_SYSTEM_INSTRUCTION,
        background=bool(use_agentic and chunk_dur > 420.0),
    )

    normalized_candidates: list[CandidateBeat] = []
    for i, rc in enumerate(raw.candidates, start=1):
        rel_s = max(0.0, min(rc.rel_start_sec, chunk_dur))
        rel_e = max(rel_s + 0.5, min(max(rc.rel_end_sec, rel_s + 0.5), chunk_dur))
        rel_p = max(rel_s, min(rc.rel_peak_sec, rel_e))

        abs_s = round(min(chunk_base_sec + rel_s, total_video_duration_sec), 3)
        abs_e = round(min(chunk_base_sec + rel_e, total_video_duration_sec), 3)
        abs_p = round(min(chunk_base_sec + rel_p, total_video_duration_sec), 3)

        quotes = [
            VerbatimQuote(
                text=q.text.strip(),
                timestamp_sec=round(
                    min(
                        total_video_duration_sec,
                        chunk_base_sec + max(0.0, min(q.timestamp_sec, chunk.duration_sec)),
                    ),
                    3,
                ),
            )
            for q in rc.verbatim_quotes
            if q.text and q.text.strip()
        ]

        desc = rc.description.strip()
        is_rep = infer_is_replay(rc.is_replay, desc)
        framing = rc.camera_framing
        if is_rep and framing == "wide_court":
            framing = "rim_or_baseline"

        normalized_candidates.append(
            CandidateBeat(
                candidate_id=f"{chunk.segment_id}_b{i:02d}",
                segment_id=chunk.segment_id,
                category=rc.category,
                start_sec=abs_s,
                end_sec=max(abs_e, round(min(abs_s + 0.5, total_video_duration_sec), 3)),
                peak_sec=abs_p,
                description=desc,
                narrative_context=rc.narrative_context.strip(),
                players_involved=rc.players_involved,
                score_context=rc.score_context,
                verbatim_quotes=quotes,
                emotional_tone=rc.emotional_tone,
                is_replay=is_rep,
                camera_framing=framing,
            )
        )

    normalized_candidates.sort(key=lambda c: c.peak_sec)
    return SegmentOutput(
        segment_id=chunk.segment_id,
        start_sec=chunk.start_sec,
        end_sec=chunk.end_sec,
        game_state_summary=raw.game_state_summary.strip(),
        candidates=normalized_candidates,
    )


async def scout_all_chunks(
    chunks: list[ChunkPlan],
    game_plan: GamePlan,
    *,
    total_video_duration_sec: float,
    max_concurrency: int = 4,
    scout_model: Optional[str] = None,
    force_agentic: Optional[bool] = None,
) -> list[SegmentOutput]:
    """Run Stage 2 scouting concurrently across all chunks with bounded semaphore."""
    sem = asyncio.Semaphore(max(1, max_concurrency))

    async def _worker(chunk: ChunkPlan) -> SegmentOutput:
        async with sem:
            return await asyncio.to_thread(
                _scout_single_chunk_sync,
                chunk,
                game_plan,
                total_video_duration_sec=total_video_duration_sec,
                scout_model=scout_model,
                force_agentic=force_agentic,
            )

    results = await asyncio.gather(*(_worker(c) for c in chunks))
    return sorted(results, key=lambda s: s.start_sec)


def realign_cached_segments_for_gop_drift(
    segments: list[SegmentOutput],
    chunks: list[ChunkPlan],
    *,
    total_video_duration_sec: float,
) -> list[SegmentOutput]:
    """Correct legacy cached Stage 2 timestamps if chunks had uncompensated H.264 GOP drift."""
    chunk_map = {c.segment_id: c for c in chunks}
    corrected: list[SegmentOutput] = []

    for seg in segments:
        ch = chunk_map.get(seg.segment_id)
        if ch is None or ch.actual_start_sec is None:
            corrected.append(seg)
            continue

        drift = round(ch.start_sec - ch.actual_start_sec, 3)
        if abs(drift) < 0.15:
            corrected.append(seg)
            continue

        updated_beats: list[CandidateBeat] = []
        for b in seg.candidates:
            new_s = round(max(0.0, min(total_video_duration_sec, b.start_sec - drift)), 3)
            new_e = round(max(new_s + 0.5, min(total_video_duration_sec, b.end_sec - drift)), 3)
            new_p = round(max(new_s, min(new_e, b.peak_sec - drift)), 3)
            new_quotes = [
                VerbatimQuote(
                    text=q.text,
                    timestamp_sec=round(max(0.0, min(total_video_duration_sec, q.timestamp_sec - drift)), 3),
                )
                for q in b.verbatim_quotes
            ]
            updated_beats.append(
                b.model_copy(
                    update={
                        "start_sec": new_s,
                        "end_sec": new_e,
                        "peak_sec": new_p,
                        "verbatim_quotes": new_quotes,
                        "is_replay": infer_is_replay(b.is_replay, b.description),
                    }
                )
            )
        corrected.append(seg.model_copy(update={"candidates": updated_beats}))

    return corrected


def _interval_overlap_ratio(a: CandidateBeat, b: CandidateBeat) -> float:
    inter_start = max(a.start_sec, b.start_sec)
    inter_end = min(a.end_sec, b.end_sec)
    inter = max(0.0, inter_end - inter_start)
    if inter <= 0.0:
        return 0.0
    shortest = max(0.5, min(a.end_sec - a.start_sec, b.end_sec - b.start_sec))
    return inter / shortest


def merge_connected_action_beats(
    beats: list[CandidateBeat],
    *,
    max_gap_sec: float = 2.5,
    max_merged_span_sec: float = 18.0,
) -> list[CandidateBeat]:
    """Merge back-to-back LIVE `action` beats belonging to one continuous sequence."""
    if not beats:
        return []

    ordered = sorted(beats, key=lambda b: (b.start_sec, b.peak_sec))
    result: list[CandidateBeat] = [ordered[0]]

    for curr in ordered[1:]:
        prev = result[-1]
        gap = curr.start_sec - prev.end_sec
        merged_span = max(prev.end_sec, curr.end_sec) - min(prev.start_sec, curr.start_sec)

        can_merge = (
            prev.category == "action"
            and curr.category == "action"
            and not prev.is_replay
            and not curr.is_replay
            and -3.0 <= gap <= max_gap_sec
            and merged_span <= max_merged_span_sec
        )
        if not can_merge:
            result.append(curr)
            continue

        seen_quotes = {q.text.lower(): q for q in prev.verbatim_quotes}
        for q in curr.verbatim_quotes:
            if q.text.lower() not in seen_quotes:
                seen_quotes[q.text.lower()] = q

        combined_players = list(dict.fromkeys(prev.players_involved + curr.players_involved))
        combined_desc = (
            curr.description
            if prev.description.lower() in curr.description.lower()
            else f"{prev.description.rstrip('.')} -> {curr.description}"
        )
        combined_ctx = (
            curr.narrative_context
            if not prev.narrative_context or prev.narrative_context == curr.narrative_context
            else f"{prev.narrative_context.rstrip('.')} {curr.narrative_context}"
        )

        result[-1] = curr.model_copy(
            update={
                "start_sec": round(min(prev.start_sec, curr.start_sec), 3),
                "end_sec": round(max(prev.end_sec, curr.end_sec), 3),
                "peak_sec": curr.peak_sec,
                "description": combined_desc,
                "narrative_context": combined_ctx,
                "players_involved": combined_players,
                "score_context": curr.score_context or prev.score_context,
                "verbatim_quotes": sorted(seen_quotes.values(), key=lambda q: q.timestamp_sec),
            }
        )

    return result


def _extract_identity_tokens(beat: CandidateBeat) -> set[str]:
    """Extract normalized player name/number tokens + play-type keywords for replay pairing."""
    raw = " ".join(beat.players_involved) + " " + beat.description.lower()
    tokens: set[str] = set()
    for num in re.findall(r"#\d+", raw):
        tokens.add(num)
    for word in re.findall(r"[a-z0-9'-]+", raw.lower()):
        if len(word) >= 4 and word not in {
            "with",
            "from",
            "into",
            "over",
            "near",
            "after",
            "before",
            "replay",
            "angle",
            "shot",
            "ball",
            "pass",
            "play",
            "player",
            "players",
            "court",
            "paint",
            "wing",
            "left",
            "right",
            "seconds",
        }:
            tokens.add(word)
    return tokens


def attach_replays_to_live_beats(
    beats: list[CandidateBeat],
    *,
    max_lookback_sec: float = 210.0,
    max_attached_per_beat: int = 2,
) -> list[CandidateBeat]:
    """Pair zoomed-in `is_replay=True` snippets onto their parent LIVE beat as `replay_angles`.

    Philosophy ("prefer to keep"):
    - When a replay matches a live play within the prior ~3.5 minutes, it attaches
      directly to `live_beat.replay_angles` as a tight 2-4.5s snippet—giving the
      storyline model BOTH the full live sequence AND zoomed-in close-up panel frames
      without burning an extra pool slot!
    - If a replay has NO matching live beat (e.g., an iconic play whose wide angle
      wasn't logged, or a post-game recap angle), we KEEP it as a standalone
      `is_replay=True` candidate (clipped tightly) so valuable zoomed frames are
      never discarded.
    """
    live_beats = [b.model_copy() for b in beats if not b.is_replay]
    replay_beats = [b for b in beats if b.is_replay]
    if not replay_beats or not live_beats:
        return beats

    live_tokens = {b.candidate_id: _extract_identity_tokens(b) for b in live_beats}
    live_by_id = {b.candidate_id: b for b in live_beats}
    unmatched_replays: list[CandidateBeat] = []

    for rep in replay_beats:
        rep_toks = _extract_identity_tokens(rep)
        rep_play_kinds = rep_toks & _PLAY_KEYWORDS

        best_id: Optional[str] = None
        best_score = 0.0

        for lb in live_beats:
            dt = rep.start_sec - lb.end_sec
            if dt < -2.0 or dt > max_lookback_sec:
                continue
            lb_toks = live_tokens[lb.candidate_id]
            shared = rep_toks & lb_toks
            if not shared:
                continue

            # Player/entity overlap + play-type match + immediate stoppage proximity bonus
            play_bonus = 1.5 if (rep_play_kinds and (rep_play_kinds & lb_toks)) else 0.0
            recency_bonus = 1.2 if dt <= 65.0 else (0.5 if dt <= 130.0 else 0.0)
            action_bonus = 0.8 if lb.category == "action" else 0.0
            score = float(len(shared)) + play_bonus + recency_bonus + action_bonus

            if score > best_score:
                best_score = score
                best_id = lb.candidate_id

        # Require meaningful player/action match (>= 2.5) to attach; otherwise keep standalone!
        if best_id is not None and best_score >= 2.5:
            parent = live_by_id[best_id]
            if len(parent.replay_angles) < max_attached_per_beat:
                # Clamp snippet span tightly around replay peak_sec (2.0..4.5s)
                tight_s = round(max(rep.start_sec, rep.peak_sec - 2.2), 3)
                tight_e = round(min(rep.end_sec, max(tight_s + 2.0, rep.peak_sec + 1.8)), 3)
                angle = ReplayAngle(
                    replay_id=rep.candidate_id,
                    start_sec=tight_s,
                    end_sec=tight_e,
                    peak_sec=rep.peak_sec,
                    camera_framing=(
                        rep.camera_framing
                        if rep.camera_framing != "wide_court"
                        else "rim_or_baseline"
                    ),
                    description=rep.description,
                )
                parent.replay_angles.append(angle)
            continue

        # Unmatched replay -> tighten its window (<= 4.5s) and KEEP as standalone option!
        tight_s = round(max(rep.start_sec, rep.peak_sec - 2.2), 3)
        tight_e = round(min(rep.end_sec, max(tight_s + 2.0, rep.peak_sec + 1.8)), 3)
        unmatched_replays.append(
            rep.model_copy(update={"start_sec": tight_s, "end_sec": tight_e})
        )

    combined = list(live_by_id.values()) + unmatched_replays
    return sorted(combined, key=lambda c: c.peak_sec)


def deduplicate_candidates(
    segments: list[SegmentOutput],
    *,
    peak_tolerance_sec: float = 3.5,
    overlap_ratio_threshold: float = 0.55,
) -> list[CandidateBeat]:
    """Deduplicate chunk-overlap duplicates, merge split live sequences, and attach zoomed replays."""
    seg_bounds = {s.segment_id: (s.start_sec, s.end_sec) for s in segments}
    all_beats = sorted(
        (beat for seg in segments for beat in seg.candidates),
        key=lambda b: b.peak_sec,
    )
    if not all_beats:
        return []

    def _edge_margin(beat: CandidateBeat) -> float:
        s_start, s_end = seg_bounds.get(beat.segment_id, (beat.start_sec, beat.end_sec))
        return min(abs(beat.peak_sec - s_start), abs(s_end - beat.peak_sec))

    merged: list[CandidateBeat] = []
    for beat in all_beats:
        is_rep = infer_is_replay(beat.is_replay, beat.description)
        framing = (
            "rim_or_baseline"
            if (is_rep and beat.camera_framing == "wide_court")
            else beat.camera_framing
        )
        beat = beat.model_copy(update={"is_replay": is_rep, "camera_framing": framing})
        if not merged:
            merged.append(beat)
            continue

        prev = merged[-1]
        same_moment = (
            prev.segment_id != beat.segment_id
            and prev.is_replay == beat.is_replay
            and (
                abs(prev.peak_sec - beat.peak_sec) <= peak_tolerance_sec
                or _interval_overlap_ratio(prev, beat) >= overlap_ratio_threshold
            )
        )
        if not same_moment:
            merged.append(beat)
            continue

        primary, secondary = (
            (beat, prev) if _edge_margin(beat) > _edge_margin(prev) else (prev, beat)
        )
        seen_quotes = {q.text.lower(): q for q in primary.verbatim_quotes}
        for q in secondary.verbatim_quotes:
            if q.text.lower() not in seen_quotes:
                seen_quotes[q.text.lower()] = q

        combined_players = list(dict.fromkeys(primary.players_involved + secondary.players_involved))
        merged[-1] = primary.model_copy(
            update={
                "start_sec": min(primary.start_sec, secondary.start_sec),
                "end_sec": max(primary.end_sec, secondary.end_sec),
                "players_involved": combined_players,
                "score_context": primary.score_context or secondary.score_context,
                "verbatim_quotes": sorted(seen_quotes.values(), key=lambda q: q.timestamp_sec),
            }
        )

    connected = merge_connected_action_beats(merged)
    return attach_replays_to_live_beats(connected)
