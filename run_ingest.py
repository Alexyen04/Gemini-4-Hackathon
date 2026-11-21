"""CLI runner for Stages 1 -> 3.5 (Raw Basketball Video -> Pre-Storyline `handoff.json`).

Stops strictly BEFORE the final storyline/manga generation model so you can
inspect `outputs/<job_id>/handoff.json`, extracted keyframes, burst strips, and
short `.mp4` clips, and iterate rapidly on how the final storyline model consumes them.

Usage examples:
  # Full live run with Gemini 4 + Decisions API:
  python run_ingest.py --video "data/uconn vs duke finals 26.mp4" --focus "Emphasize the last steal into game-winning 3-pointer" --job-id uconn_v2

  # Instantly re-pool & re-cut clips/keyframes from an existing cached run (zero Gemini calls!):
  python run_ingest.py --video "data/uconn vs duke finals 26.mp4" --job-id first_test --realign-legacy-cache --overwrite-clips

  # Offline smoke test:
  python run_ingest.py --dry-run-synthetic
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
import time
from typing import Optional

import cv2
import numpy as np

from media.chunker import materialize_chunks
from media.ffmpeg_utils import get_ffmpeg_binary, probe_video_metadata
from media.frames import extract_sharpest_keyframe
from pipeline.handoff import (
    build_director_handoff,
    build_storyline_model_input,
    estimate_handoff_mode_tradeoffs,
)
from pipeline.planner import build_game_plan, fallback_game_plan_from_prompt
from pipeline.ranker import (
    classify_casting_quadrant,
    compute_effective_rank,
    rank_and_select_pool,
    select_balanced_story_pool,
)
from pipeline.scout import (
    deduplicate_candidates,
    infer_is_replay,
    realign_cached_segments_for_gop_drift,
    scout_all_chunks,
)
from schemas.models import (
    CandidateBeat,
    CandidateScores,
    GamePlan,
    HandoffMediaMode,
    JobInput,
    ScoredCandidate,
    SegmentOutput,
    VerbatimQuote,
)


def _generate_synthetic_test_video(target_path: Path, duration_sec: float = 18.0, fps: int = 24) -> Path:
    """Create a tiny synthetic basketball-court test MP4 for offline plumbing verification."""
    target_path.parent.mkdir(parents=True, exist_ok=True)
    w, h = 640, 360
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(target_path), fourcc, float(fps), (w, h))
    total_frames = int(duration_sec * fps)

    for idx in range(total_frames):
        t = idx / float(fps)
        frame = np.full((h, w, 3), (35, 75, 120), dtype=np.uint8)
        cv2.rectangle(frame, (30, 30), (w - 30, h - 30), (235, 235, 235), 2)
        cv2.circle(frame, (w - 75, h // 2), 18, (0, 90, 255), 3)
        px = int(80 + (w - 190) * ((t % 6.0) / 6.0))
        py = int(h // 2 + 55 * np.sin(t * 2.4))
        cv2.circle(frame, (px, py), 20, (40, 40, 220), -1)
        cv2.putText(frame, "23", (px - 14, py + 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        bx = min(w - 75, px + 26)
        by = max(45, py - int(35 * abs(np.sin(t * 3.5))))
        cv2.circle(frame, (bx, by), 9, (0, 140, 255), -1)
        cv2.putText(
            frame,
            f"T={t:05.2f}s  HOME 96 - AWAY 98",
            (42, 58),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2,
        )
        writer.write(frame)
    writer.release()
    return target_path


async def run_ingest_pipeline(
    job_input: JobInput,
    *,
    output_root: Path,
    use_cache: bool = True,
    realign_legacy_cache: bool = False,
    overwrite_clips: bool = False,
    override_chunk_sec: Optional[float] = None,
    override_overlap_sec: Optional[float] = None,
    split_into_quarters: bool = False,
    scout_model: Optional[str] = None,
    force_agentic: Optional[bool] = None,
    max_concurrency: int = 4,
    include_clips: bool = True,
    include_burst: bool = True,
    clip_pre_pad_sec: float = 3.0,
    clip_post_pad_sec: float = 1.5,
    preview_mode: HandoffMediaMode = "hybrid",
    dry_run_synthetic: bool = False,
    fast_plan: bool = False,
    preview: bool = True,
) -> Path:
    job_dir = (output_root / job_input.job_id).resolve()
    cache_dir = job_dir / "cache"
    chunks_dir = job_dir / "chunks"
    keyframes_dir = job_dir / "keyframes"
    cache_dir.mkdir(parents=True, exist_ok=True)

    timings: dict[str, float] = {}
    t0 = time.perf_counter()

    video_meta = probe_video_metadata(job_input.video_path)
    print(
        f"[Stage 0] Video: {video_meta.video_path} | "
        f"{video_meta.duration_sec:.1f}s @ {video_meta.fps:.1f}fps ({video_meta.width}x{video_meta.height}) | "
        f"FFmpeg: {get_ffmpeg_binary()}"
    )

    # ------------------------------------------------------------------
    # Stage 1: GamePlan + Adaptive Overlapping Chunks
    # ------------------------------------------------------------------
    t_stage = time.perf_counter()
    plan_cache = cache_dir / "stage1_plan.json"
    loaded_legacy_chunks_without_actual_start = False

    if use_cache and plan_cache.is_file() and not dry_run_synthetic:
        game_plan = GamePlan.model_validate_json(plan_cache.read_text(encoding="utf-8"))
        loaded_legacy_chunks_without_actual_start = any(
            c.actual_start_sec is None for c in game_plan.chunks
        )
        print(f"[Stage 1] Loaded cached GamePlan ({len(game_plan.chunks)} chunk(s)).")
    elif dry_run_synthetic:
        game_plan = fallback_game_plan_from_prompt(
            job_input,
            video_meta,
            override_chunk_sec=override_chunk_sec or 10.0,
            override_overlap_sec=override_overlap_sec if override_overlap_sec is not None else 3.0,
            split_into_quarters=split_into_quarters,
        )
    elif fast_plan:
        # Deterministic plan (no Gemini call): for preset focus strings from the studio UI.
        game_plan = fallback_game_plan_from_prompt(
            job_input,
            video_meta,
            override_chunk_sec=override_chunk_sec,
            override_overlap_sec=override_overlap_sec,
            split_into_quarters=split_into_quarters,
        )
    else:
        game_plan = build_game_plan(
            job_input,
            video_meta,
            override_chunk_sec=override_chunk_sec,
            override_overlap_sec=override_overlap_sec,
            split_into_quarters=split_into_quarters,
        )

    materialized_chunks = materialize_chunks(
        video_meta.video_path,
        game_plan.chunks,
        chunks_dir,
        total_duration_sec=video_meta.duration_sec,
        max_workers=max_concurrency,
    )
    game_plan = game_plan.model_copy(update={"chunks": materialized_chunks})
    plan_cache.write_text(game_plan.model_dump_json(indent=2), encoding="utf-8")
    timings["stage1_plan_and_chunk"] = round(time.perf_counter() - t_stage, 2)
    print(
        f"[Stage 1] Focus={game_plan.protagonist_focus!r} | "
        f"Weights={game_plan.scoring_weights.model_dump()} | "
        f"Chunks={len(materialized_chunks)} ({timings['stage1_plan_and_chunk']}s)"
    )

    # ------------------------------------------------------------------
    # Stage 2: Concurrent Segment Scouting + Boundary Deduplication
    # ------------------------------------------------------------------
    t_stage = time.perf_counter()
    seg_cache = cache_dir / "stage2_segments.json"
    need_gop_realign = realign_legacy_cache and loaded_legacy_chunks_without_actual_start

    if use_cache and seg_cache.is_file() and not dry_run_synthetic:
        raw_list = json.loads(seg_cache.read_text(encoding="utf-8"))
        segments = [SegmentOutput.model_validate(item) for item in raw_list]
        if need_gop_realign:
            print("[Stage 2] Applying H.264 stream-copy GOP start-offset correction to cached segments...")
            segments = realign_cached_segments_for_gop_drift(
                segments,
                materialized_chunks,
                total_video_duration_sec=video_meta.duration_sec,
            )
            seg_cache.write_text(
                json.dumps([s.model_dump() for s in segments], indent=2), encoding="utf-8"
            )
        print(f"[Stage 2] Loaded cached SegmentOutputs ({len(segments)} segment(s)).")
    elif dry_run_synthetic:
        segments = [
            SegmentOutput(
                segment_id=materialized_chunks[0].segment_id,
                start_sec=materialized_chunks[0].start_sec,
                end_sec=materialized_chunks[0].end_sec,
                game_state_summary="Early stretch sees a flashy fast-break dunk, followed by tight half-court defense trapping #23 on the sideline.",
                candidates=[
                    CandidateBeat(
                        candidate_id="seg_01_b01",
                        segment_id=materialized_chunks[0].segment_id,
                        category="action",
                        start_sec=1.5,
                        end_sec=4.8,
                        peak_sec=3.2,
                        description="Breakaway windmill dunk in open transition with no defenders nearby.",
                        narrative_context="Routine early bucket with low dramatic tension.",
                        players_involved=["#11"],
                        score_context="HOME 92 - AWAY 96",
                        verbatim_quotes=[VerbatimQuote(text="Easy transition slam.", timestamp_sec=3.4)],
                        emotional_tone="intense",
                    ),
                    CandidateBeat(
                        candidate_id="seg_01_b02",
                        segment_id=materialized_chunks[0].segment_id,
                        category="story_emotion",
                        start_sec=7.2,
                        end_sec=9.8,
                        peak_sec=8.6,
                        description="#23 gets trapped by two defenders in the corner as the shot clock winds down.",
                        narrative_context="High-pressure defensive trap testing #23's poise down 2.",
                        players_involved=["#23"],
                        score_context="HOME 96 - AWAY 98, 0:38 left",
                        verbatim_quotes=[VerbatimQuote(text="Nowhere to go—double team closes in!", timestamp_sec=8.5)],
                        emotional_tone="tense",
                    ),
                ],
            ),
            SegmentOutput(
                segment_id=materialized_chunks[-1].segment_id,
                start_sec=materialized_chunks[-1].start_sec,
                end_sec=materialized_chunks[-1].end_sec,
                game_state_summary="#23 forces a midcourt steal and buries the go-ahead three-pointer in the closing seconds.",
                candidates=[
                    CandidateBeat(
                        candidate_id="seg_02_b01",
                        segment_id=materialized_chunks[-1].segment_id,
                        category="story_emotion",
                        start_sec=7.4,
                        end_sec=9.9,
                        peak_sec=8.7,
                        description="#23 trapped along the sideline by two defenders.",
                        narrative_context="Crucial late-clock trap.",
                        players_involved=["#23", "#7"],
                        score_context="HOME 96 - AWAY 98, 0:38 left",
                        verbatim_quotes=[VerbatimQuote(text="Shot clock at four!", timestamp_sec=8.9)],
                        emotional_tone="tense",
                    ),
                    CandidateBeat(
                        candidate_id="seg_02_b02",
                        segment_id=materialized_chunks[-1].segment_id,
                        category="action",
                        start_sec=11.0,
                        end_sec=16.0,
                        peak_sec=14.4,
                        description="#23 jumps the passing lane for the steal and drains the contested pull-up three-pointer for the lead.",
                        narrative_context="Game-winning climax shot completing the comeback.",
                        players_involved=["#23"],
                        score_context="HOME 99 - AWAY 98, 0:04 left",
                        verbatim_quotes=[VerbatimQuote(text="STEALS IT—BANG! FOR THE LEAD!", timestamp_sec=14.5)],
                        emotional_tone="triumphant",
                    ),
                ],
            ),
        ]
        seg_cache.write_text(
            json.dumps([s.model_dump() for s in segments], indent=2), encoding="utf-8"
        )
    else:
        segments = await scout_all_chunks(
            materialized_chunks,
            game_plan,
            total_video_duration_sec=video_meta.duration_sec,
            max_concurrency=max_concurrency,
            scout_model=scout_model,
            force_agentic=force_agentic,
        )
        seg_cache.write_text(
            json.dumps([s.model_dump() for s in segments], indent=2), encoding="utf-8"
        )

    raw_count = sum(len(s.candidates) for s in segments)
    deduped_candidates = deduplicate_candidates(segments)
    timings["stage2_parallel_scout"] = round(time.perf_counter() - t_stage, 2)
    print(
        f"[Stage 2] Raw beats={raw_count} -> Deduplicated={len(deduped_candidates)} "
        f"({timings['stage2_parallel_scout']}s)"
    )

    # ------------------------------------------------------------------
    # Stage 3: Two-Axis Calibrated Ranking (`gemini-decision-1`) + Pool
    # ------------------------------------------------------------------
    t_stage = time.perf_counter()
    scored_cache = cache_dir / "stage3_scored.json"
    if use_cache and scored_cache.is_file() and not dry_run_synthetic:
        raw_scored = json.loads(scored_cache.read_text(encoding="utf-8"))
        cached_scored = [ScoredCandidate.model_validate(item) for item in raw_scored]

        if need_gop_realign or realign_legacy_cache:
            print("[Stage 3] Refreshing cached candidate timestamps, replay flags & keyframes...")
            dedup_map = {b.candidate_id: b for b in deduped_candidates}
            w = game_plan.scoring_weights.normalized()
            refreshed: list[ScoredCandidate] = []
            for sc in cached_scored:
                base_beat = dedup_map.get(sc.candidate_id)
                is_rep = infer_is_replay(sc.is_replay, sc.description)
                s_sec = base_beat.start_sec if base_beat else sc.start_sec
                e_sec = base_beat.end_sec if base_beat else sc.end_sec
                p_sec = base_beat.peak_sec if base_beat else sc.peak_sec
                quotes = base_beat.verbatim_quotes if base_beat else sc.verbatim_quotes

                kf = extract_sharpest_keyframe(
                    video_meta.video_path,
                    p_sec,
                    keyframes_dir / f"{sc.candidate_id}.jpg",
                )
                raw_comp = (
                    w.action_spectacle * sc.scores.action_spectacle
                    + w.narrative_leverage * sc.scores.narrative_leverage
                    + w.user_focus_match * sc.scores.user_focus_match
                    + w.visual_clarity * sc.scores.visual_clarity
                )
                eff_rank = compute_effective_rank(is_rep, raw_comp)
                new_scores = sc.scores.model_copy(update={"composite_story_rank": eff_rank})
                refreshed.append(
                    sc.model_copy(
                        update={
                            "start_sec": s_sec,
                            "end_sec": e_sec,
                            "peak_sec": p_sec,
                            "verbatim_quotes": quotes,
                            "is_replay": is_rep,
                            "keyframe_path": kf.path,
                            "keyframe_sec": kf.timestamp_sec,
                            "keyframe_sharpness": kf.sharpness,
                            "scores": new_scores,
                        }
                    )
                )
            all_scored = sorted(
                refreshed, key=lambda c: c.scores.composite_story_rank, reverse=True
            )
            scored_cache.write_text(
                json.dumps([c.model_dump() for c in all_scored], indent=2), encoding="utf-8"
            )
        else:
            all_scored = cached_scored

        selected_pool = select_balanced_story_pool(
            all_scored, target_pool_size=job_input.target_pool_size
        )
        print(f"[Stage 3] Loaded cached ScoredCandidates ({len(all_scored)} total).")
    elif dry_run_synthetic:
        mock_probs = {
            "seg_01_b01": (0.91, 0.28, 0.20, 0.90),
            "seg_01_b02": (0.38, 0.90, 0.96, 0.88),
            "seg_02_b01": (0.38, 0.90, 0.96, 0.88),
            "seg_02_b02": (0.96, 0.98, 0.99, 0.93),
        }
        w = game_plan.scoring_weights.normalized()
        all_scored = []
        for cand in deduped_candidates:
            kf = extract_sharpest_keyframe(
                video_meta.video_path,
                cand.peak_sec,
                keyframes_dir / f"{cand.candidate_id}.jpg",
            )
            pa, ps, pf, pv = mock_probs.get(cand.candidate_id, (0.5, 0.5, 0.5, 0.8))
            comp = round(
                w.action_spectacle * pa
                + w.narrative_leverage * ps
                + w.user_focus_match * pf
                + w.visual_clarity * pv,
                4,
            )
            all_scored.append(
                ScoredCandidate(
                    **cand.model_dump(),
                    keyframe_path=kf.path,
                    keyframe_sec=kf.timestamp_sec,
                    keyframe_sharpness=kf.sharpness,
                    scores=CandidateScores(
                        action_spectacle=pa,
                        narrative_leverage=ps,
                        user_focus_match=pf,
                        visual_clarity=pv,
                        composite_story_rank=comp,
                    ),
                    casting_quadrant=classify_casting_quadrant(pa, ps),
                )
            )
        all_scored.sort(key=lambda c: c.scores.composite_story_rank, reverse=True)
        selected_pool = select_balanced_story_pool(
            all_scored, target_pool_size=job_input.target_pool_size
        )
        scored_cache.write_text(
            json.dumps([c.model_dump() for c in all_scored], indent=2), encoding="utf-8"
        )
    else:
        selected_pool, all_scored = await rank_and_select_pool(
            deduped_candidates,
            segments,
            game_plan,
            video_path=video_meta.video_path,
            keyframes_dir=keyframes_dir,
            total_video_duration_sec=video_meta.duration_sec,
            target_pool_size=job_input.target_pool_size,
            max_concurrency=max_concurrency,
        )
        scored_cache.write_text(
            json.dumps([c.model_dump() for c in all_scored], indent=2), encoding="utf-8"
        )

    timings["stage3_decisions_ranking"] = round(time.perf_counter() - t_stage, 2)
    print(
        f"[Stage 3] Ranked {len(all_scored)} beats -> Selected balanced pool={len(selected_pool)} "
        f"({timings['stage3_decisions_ranking']}s)"
    )

    # ------------------------------------------------------------------
    # Stage 3.5: Materialize Clips + Burst Frames & Write `handoff.json`
    # ------------------------------------------------------------------
    t_stage = time.perf_counter()
    timings["total_before_handoff"] = round(time.perf_counter() - t0, 2)
    handoff, handoff_path = build_director_handoff(
        job_input=job_input,
        video_meta=video_meta,
        game_plan=game_plan,
        segments=segments,
        selected_pool=selected_pool,
        all_scored=all_scored,
        raw_candidates_count=raw_count,
        output_dir=job_dir,
        stage_timings_sec=timings,
        include_clips=include_clips,
        include_burst=include_burst,
        clip_pre_pad_sec=clip_pre_pad_sec,
        clip_post_pad_sec=clip_post_pad_sec,
        max_workers=max_concurrency,
        overwrite_media=overwrite_clips or realign_legacy_cache,
    )
    handoff_time = round(time.perf_counter() - t_stage, 2)
    print(f"[Stage 3.5] Wrote handoff package -> {handoff_path} ({handoff_time}s)")

    if not preview:
        return handoff_path

    tradeoffs = estimate_handoff_mode_tradeoffs(handoff)
    print("\n=== Storyline Model Input Mode Tradeoffs (Speed vs. Frame Choice) ===")
    for mode_name, info in tradeoffs.items():
        marker = " <-- previewed" if mode_name == preview_mode else ""
        print(
            f"  {mode_name:<15} | media_parts={info['media_parts']:<3} | "
            f"payload={info['payload_mb']:>6.2f} MB | ~{info['est_input_tokens']:>6} est tokens{marker}"
        )

    sample_parts = build_storyline_model_input(handoff, mode=preview_mode, client=None)
    print(
        f"\n[Ready for Final Storyline Model] `build_storyline_model_input(handoff, mode={preview_mode!r})` "
        f"assembled {len(sample_parts)} interleaved content blocks."
    )
    return handoff_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run Stages 1->3.5 (Raw Basketball Video -> Pre-Director handoff.json)."
    )
    parser.add_argument("--video", type=str, default=None, help="Path to basketball video (.mp4/.mov).")
    parser.add_argument(
        "--focus",
        type=str,
        default="Tell the main dramatic storyline of this basketball game.",
        help="User focus prompt (e.g., 'Emphasize the last steal into game-winning 3-pointer').",
    )
    parser.add_argument("--job-id", type=str, default=None, help="Output job folder name under outputs/.")
    parser.add_argument("--pages", type=int, default=2, help="Target manga pages hint.")
    parser.add_argument("--pool-size", type=int, default=22, help="Balanced candidate pool size.")
    parser.add_argument("--output-dir", type=str, default="outputs", help="Root outputs directory.")
    parser.add_argument("--chunk-sec", type=float, default=None, help="Override adaptive chunk length (sec).")
    parser.add_argument("--overlap-sec", type=float, default=None, help="Override chunk overlap (sec).")
    parser.add_argument("--quarters", action="store_true", help="Split long game into 4 overlapping quarter segments.")
    parser.add_argument(
        "--scout-model",
        type=str,
        default=None,
        help="Override Stage 2 model (e.g. 'gemini-4-hydrogen' or 'gemini-4-argon').",
    )
    parser.add_argument("--agentic", action="store_true", help="Force Agentic Video Understanding (with gemini-4-argon).")
    parser.add_argument("--concurrency", type=int, default=4, help="Max concurrent Gemini workers.")
    parser.add_argument("--no-clips", action="store_true", help="Skip cutting per-candidate .mp4 clips.")
    parser.add_argument("--no-burst", action="store_true", help="Skip extracting multi-frame burst strips.")
    parser.add_argument(
        "--clip-pre-pad",
        type=float,
        default=3.0,
        help="Safety buffer seconds BEFORE beat start_sec included in candidate .mp4 clips.",
    )
    parser.add_argument(
        "--clip-post-pad",
        type=float,
        default=1.5,
        help="Seconds AFTER beat end_sec included in candidate .mp4 clips.",
    )
    parser.add_argument(
        "--preview-handoff-mode",
        type=str,
        choices=["keyframes_only", "burst_frames", "video_clips", "hybrid"],
        default="hybrid",
        help="Which storyline input mode to preview after building handoff.json.",
    )
    parser.add_argument("--no-cache", action="store_true", help="Ignore cached Stage 1-3 JSON artifacts.")
    parser.add_argument("--fast-plan", action="store_true", help="Skip the Stage 1 planner LLM call; use the deterministic plan.")
    parser.add_argument("--no-preview", action="store_true", help="Skip the storyline input-mode preview after handoff.json.")
    parser.add_argument(
        "--realign-legacy-cache",
        action="store_true",
        help="Re-align existing cached run for H.264 GOP drift, apply replay filtering, and re-cut clips offline.",
    )
    parser.add_argument("--overwrite-clips", action="store_true", help="Force re-cutting clip .mp4s in outputs.")
    parser.add_argument(
        "--dry-run-synthetic",
        action="store_true",
        help="Generate a synthetic basketball clip and test all local plumbing offline.",
    )

    args = parser.parse_args()

    out_root = Path(args.output_dir)
    if args.dry_run_synthetic:
        job_id = args.job_id or "synthetic_smoke_test"
        synth_video = out_root / job_id / "synthetic_court.mp4"
        _generate_synthetic_test_video(synth_video)
        video_path = str(synth_video)
        focus = args.focus if args.focus != parser.get_default("focus") else "Follow #23 in the final seconds comeback"
    else:
        if not args.video:
            parser.error("--video is required unless --dry-run-synthetic is set.")
        video_path = args.video
        stem = Path(video_path).stem
        job_id = args.job_id or f"{stem}_{int(time.time())}"
        focus = args.focus

    job_input = JobInput(
        job_id=job_id,
        video_path=video_path,
        user_focus=focus,
        target_pages=args.pages,
        target_pool_size=args.pool_size,
    )

    asyncio.run(
        run_ingest_pipeline(
            job_input,
            output_root=out_root,
            use_cache=not args.no_cache,
            realign_legacy_cache=args.realign_legacy_cache,
            overwrite_clips=args.overwrite_clips,
            override_chunk_sec=args.chunk_sec,
            override_overlap_sec=args.overlap_sec,
            split_into_quarters=args.quarters,
            scout_model=args.scout_model,
            force_agentic=True if args.agentic else None,
            max_concurrency=args.concurrency,
            include_clips=not args.no_clips,
            include_burst=not args.no_burst,
            clip_pre_pad_sec=args.clip_pre_pad,
            clip_post_pad_sec=args.clip_post_pad,
            preview_mode=args.preview_handoff_mode,  # type: ignore[arg-type]
            dry_run_synthetic=args.dry_run_synthetic,
            fast_plan=args.fast_plan,
            preview=not args.no_preview,
        )
    )


if __name__ == "__main__":
    main()
