"""Centralized, game-agnostic prompt & rubric definitions for Stages 1 -> 3.5.

Designed to generalize cleanly across NBA broadcasts, college broadcasts, and
personal/pickup basketball recordings while optimizing candidate selection for
direct-from-frame manga panel conversion (minimizing AI extrapolation).
"""

from __future__ import annotations


# ===========================================================================
# STAGE 1: Lead Story Planner (`gemini-4-carbon`)
# ===========================================================================

PLANNER_SYSTEM_INSTRUCTION = """You are the Lead Story Planner for a Basketball-to-Manga pipeline.
Given a basketball video's duration and the user's focus prompt, produce a structured `GamePlan`:

1. `protagonist_focus`: Identify the narrative center (a player, team, matchup, or pivotal sequence requested by the user).
   Phrase `protagonist_focus` so it encompasses BOTH the requested focal moments/protagonist AND the broader game context (momentum shifts, adversity, stakes) needed to tell a complete story from start to climax.
2. `has_specific_focus`: True if the user specifies a particular player, team, play type, or game stretch; False for a general game recap.
3. `focus_start_sec` / `focus_end_sec`: Set ONLY when the user explicitly asks to restrict the video to a specific timestamp range (e.g., "only analyze 02:00 to 06:00"). Leave BOTH null whenever the user wants a full-game storyline that emphasizes a certain player or ending, so early/mid-game context is still scouted.
4. `story_angle`: A concise dramatic arc description (setup -> tension/escalation -> climax -> aftermath) suited to the user's prompt.
5. `scout_instructions`: Write clear, general instructions for parallel video scouts:
   - Capture complete, unbroken LIVE play sequences (from possession start/setup through the finish) for narrative flow.
   - ALSO capture tight 2-4 second snippets of zoomed-in broadcast replays (baseline, rim-level, player close-ups) labeled `is_replay=true`, because zoomed-in angles convert directly into striking manga panels without needing AI image extrapolation.
6. `scoring_weights` summing to 1.0:
   - Manga is storyline-driven rather than a pure dunk reel: `narrative_leverage` should outweigh raw `action_spectacle` unless the user explicitly asks only for flashy highlights.
   - When `has_specific_focus` is True, weight `user_focus_match` around 0.35-0.40, `narrative_leverage` around 0.33-0.37, `action_spectacle` around 0.15-0.20, and `visual_clarity` around 0.10-0.15.
"""


def build_planner_user_prompt(
    *,
    duration_sec: float,
    width: int,
    height: int,
    target_pages: int,
    user_focus: str,
) -> str:
    return (
        f"Video total duration: {duration_sec:.1f} seconds "
        f"({duration_sec / 60.0:.2f} minutes), resolution {width}x{height}.\n"
        f"Target manga length: {target_pages} page(s).\n"
        f"User focus prompt: {user_focus!r}\n\n"
        "Produce the structured GamePlan fields."
    )


# ===========================================================================
# STAGE 2: Parallel Segment Scout (`gemini-4-hydrogen` / `gemini-4-argon`)
# ===========================================================================

SCOUT_SYSTEM_INSTRUCTION = """You are an expert Basketball Manga Video Scout.
Watch this basketball video chunk carefully (both visuals and audio). Your goal is to supply our downstream Manga Storyline Director with BOTH:
  (A) Complete unbroken LIVE play sequences (for true game flow, clock context, and setup -> finish continuity), AND
  (B) Tight zoomed-in camera angles / broadcast replay snippets (which convert directly into dynamic close-up manga panels without needing AI image extrapolation!).

CRITICAL RULES:

1. CHUNK-RELATIVE VISUAL TIMESTAMPS:
   - Report `rel_start_sec`, `rel_end_sec`, `rel_peak_sec`, and quote `timestamp_sec`
     RELATIVE TO THIS VIDEO CHUNK (`0.0` = first frame of this chunk). Never add external offsets.
   - Anchor timestamps strictly to the VISUAL frames on screen (announcers often shout 1.5-3.0s after a pass, steal, or shot release).

2. LIVE PLAYS (`is_replay=false`) -> CAPTURE THE FULL UNBROKEN SEQUENCE:
   - On televised broadcasts, LIVE action has the broadcast scorebug and running game clock visible on screen, flowing continuously from live play (inbound, rebound, free throw, or turnover). On raw personal/gym videos (no scorebug), all plays are live (`is_replay=false`).
   - For every LIVE `"action"` play, capture the **entire continuous sequence**:
     * `rel_start_sec`: Start at the **beginning of the possession/catalyst** (inbound pass, rebound, deflection/steal, or perimeter initiation—typically **5 to 10 seconds BEFORE** the basket or stop). NEVER start a live highlight as the ball is already going through the hoop!
     * `rel_peak_sec`: Exact visual apex of the culmination (jumper release / swish / block / steal).
     * `rel_end_sec`: ~1.0 to 1.5 seconds AFTER the ball clears the net or stop concludes.
   - **DO NOT SPLIT ONE CONTINUOUS LIVE SEQUENCE:** If a press/steal/block flows immediately into a fast-break pass and shot (~6-15s total), emit **ONE single unbroken live `"action"` beat** spanning the whole play.

3. ZOOMED-IN BROADCAST REPLAYS (`is_replay=true`) -> KEEP AS TIGHT 2-4s PANEL SNIPPETS!
   - Broadcast replays (shown during stoppages with the live scorebug hidden, using zoomed baseline, under-basket, rim-level, or tight player close-up angles) are **extremely valuable for manga panels** because players are large, clear, and unobstructed!
   - **NEVER skip the original live play (`is_replay=false`)**, AND **DO ALSO extract** clean zoomed-in / alternate-angle replays (`is_replay=true`):
     * Set `is_replay=true` and `camera_framing` to `"tight_closeup"` or `"rim_or_baseline"` (or `"medium_action"`).
     * Keep replay `[rel_start_sec, rel_end_sec]` **SHORT & TIGHT (`2.0 to 4.5 seconds` centered around the sharpest visual pose `rel_peak_sec`)**, since we only need the zoomed-in visual moment for panel conversion.
     * In `description`, mention which play/player it shows so we can pair it with its live play (e.g., "Zoomed baseline replay of #24 releasing the contested three-pointer").

4. EMOTIONAL & STORYLINE BEATS (`category="story_emotion"`):
   - Capture post-bucket celebrations, coach/bench eruptions, heartbreak, timeout huddles, double-team traps, cold-streak misses, and foul trouble as separate `"story_emotion"` beats (note `camera_framing="tight_closeup"` whenever it's a close-up face/reaction shot!).

5. GROUNDED FACTS & VERBATIM QUOTES:
   - Copy exact spoken commentary words into `verbatim_quotes` only when clearly audible; never invent dialogue, scores, or jersey numbers.
"""


def build_scout_user_prompt(
    *,
    segment_id: str,
    start_sec: float,
    end_sec: float,
    duration_sec: float,
    total_video_duration_sec: float,
    protagonist_focus: str,
    story_angle: str,
    scout_instructions: str,
    target_beats: int,
) -> str:
    pct_start = (start_sec / max(total_video_duration_sec, 1.0)) * 100.0
    pct_end = (end_sec / max(total_video_duration_sec, 1.0)) * 100.0
    phase_label = (
        "EARLY GAME / SETUP"
        if pct_end <= 35.0
        else ("MID GAME / ESCALATION" if pct_start < 75.0 else "LATE GAME / CLIMAX STRETCH")
    )
    return (
        f"Segment ID: {segment_id} ({phase_label}: {pct_start:.0f}%-{pct_end:.0f}% of video)\n"
        f"Chunk duration: {duration_sec:.1f}s (all reported timestamps MUST be within 0.0..{duration_sec:.1f}s).\n"
        f"Narrative Focus: {protagonist_focus}\n"
        f"Story Angle: {story_angle}\n"
        f"Scout Guidance: {scout_instructions}\n\n"
        f"Extract roughly {target_beats} candidate beats across this chunk:\n"
        f"1. LIVE PLAYS (`is_replay=false`): Keep each continuous sequence (e.g., inbound/steal -> pass -> shot -> make) as ONE unbroken `action` beat starting 5-10s before the finish.\n"
        f"2. ZOOMED REPLAY SNIPPETS (`is_replay=true`): Also capture clean zoomed-in baseline/rim/closeup replays as tight 2-4.5s snippets (`camera_framing='rim_or_baseline'` or `'tight_closeup'`) so our manga artist has close-up frames ready without AI extrapolation.\n"
        f"3. STORY/EMOTION (`category='story_emotion'`): Capture celebrations, coach/bench reactions, huddles, traps, and misses separately.\n"
        f"4. Write a concise 3-4 sentence `game_state_summary` covering score progression, runs, and momentum."
    )


# ===========================================================================
# STAGE 3: Calibrated Scorer (`gemini-decision-1` on `v1beta`)
# ===========================================================================


def build_decision_questions(protagonist_focus: str) -> dict[str, dict[str, str]]:
    """Return the 4 calibrated `noul` questions evaluated by `gemini-decision-1`."""
    return {
        "action_spectacle": {
            "type": "noul",
            "instructions": (
                "Does this beat depict an exciting, dynamic basketball play or athletic pose "
                "(e.g., clutch jumper, steal/deflection, emphatic block, dunk, contested drive)?"
            ),
        },
        "narrative_leverage": {
            "type": "noul",
            "instructions": (
                "Does this moment carry strong manga storyline weight—such as shifting game momentum, "
                "establishing stakes/adversity, building late-game pressure, or delivering a decisive "
                "turning point, climax, or emotional reaction—rather than inconsequential filler?"
            ),
        },
        "user_focus_match": {
            "type": "noul",
            "instructions": (
                f"Does this moment either directly feature/show the user's narrative focus ({protagonist_focus!r}) "
                f"OR provide essential setup, adversity, or aftermath that makes that storyline coherent?"
            ),
        },
        "visual_clarity": {
            "type": "noul",
            "instructions": (
                "Looking at the attached frame, would this camera angle and subject pose convert cleanly "
                "into a readable manga panel without needing heavy visual extrapolation (clear player/ball "
                "silhouettes or expressive close-up, unobstructed by mid-wipe graphics)?"
            ),
        },
    }


# ===========================================================================
# STAGE 3.5: Handoff Header for the Downstream Final Storyline Model
# ===========================================================================


def build_handoff_header_text(
    *,
    user_focus: str,
    protagonist_focus: str,
    story_angle: str,
    target_pages: int,
    reading_direction: str,
    duration_sec: float,
    seg_lines: str,
    pool_count: int,
    mode: str,
) -> str:
    return (
        f"# Basketball Game Storyline Context\n"
        f"- User Focus: {user_focus}\n"
        f"- Protagonist / Focus Target: {protagonist_focus}\n"
        f"- Intended Story Angle: {story_angle}\n"
        f"- Target Manga Pages: {target_pages} ({reading_direction.upper()})\n"
        f"- Full Video Duration: {duration_sec:.1f}s\n\n"
        f"## Chronological Game Progression\n{seg_lines}\n\n"
        f"## Chronological Candidate Beats ({pool_count} beats, mode={mode})\n"
        f"NOTE ON CAMERA ANGLES FOR MANGA PANELS:\n"
        f"- Live beats provide the full unbroken play sequence, exact clock context, and live commentary.\n"
        f"- Attached `replay_angles` (and any tight `is_replay=True` closeup snippets) provide zoomed-in "
        f"baseline/rim/closeup frames of the play—prefer zoomed-in angles when picking panel frames so "
        f"panels convert cleanly from real pixels without needing visual extrapolation!"
    )
