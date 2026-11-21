# AGENTS.md — Basketball Video to Storyline Manga

> **Single source of truth for all coding agents and teammates.**
> Read this file before creating files, designing schemas, or calling Gemini APIs.

---

## 1. Project Overview & North Star

**One-liner:** *"Every game has a story. Every play becomes a manga page—and every panel is real."*

We are building a **basketball-focused Video-to-Manga system** (NBA / NCAA / personal game recordings; stretch: other sports) that turns game footage plus an optional **user focus prompt** (e.g., *"Follow #23 in the 4th quarter"*, *"Focus on the comeback run"*) into a **storyline-driven manga** (*Slam Dunk* / *Kuroko's Basketball* style) with **verifiable frame-level provenance**.

### Core Differentiators
1. **Storyline-First, Not Highlight-Only:** We separate **Action/Spectacle** from **Narrative Leverage**. A meaningless Q1 breakaway windmill dunk up 20 is *not* a climax—it is cut or cast as a small dominance-establishing panel. Quiet emotional beats (missed free throw, tired close-up, scoreboard tension, coach timeout) earn the full-bleed climax splash.
2. **Real-Frame Anchored Visuals:** Every panel traces back to an exact FFmpeg-extracted source frame and timestamp. Clicking/hovering a panel ("Ink Peel / X-Ray") reveals the original frame, timestamp, transcript line, and fidelity score.
3. **User-Steerable Protagonist:** The same basketball clip produces a different narrative arc depending on the user's focus prompt.

---

## 2. Non-Negotiable Rules & Guardrails

### A. Grounded Fidelity & Manga Dramatization Rules
We enforce **strict visual and plot grounding** while allowing **context-grounded manga dramatization** so the result reads like real manga (*Slam Dunk*), not a sterile box score:

- **Visuals — Real frames only (Strict):** Never generate a panel from text alone. Every panel starts from an exact video frame extracted via `ffmpeg`.
- **Deterministic baseline first:** Our OpenCV manga filter (grayscale + XDoG/edge ink lines + halftone screentone dots + high contrast) is 100% faithful by construction and serves as the default MVP renderer and fallback.
- **Supervised AI inking (stretch):** Any panel stylized with `gemini-nano-banana-2.1` **must pass the Fidelity Gate**:
  1. Edge-map IoU / overlap with the source frame exceeds threshold, **and**
  2. `gemini-decision-1` comparing source frame vs. inked panel confirms high probability for: same number of people, same positions, ball in same place, no added/removed objects, same jersey numbers.
  - On failure, **automatically fall back** to the deterministic OpenCV panel.
- **Plot & Events — No Fake Storylines (Strict):** Never invent plays, scores, injuries, fouls, or fabricated off-court rivalries that did not happen in the footage.
- **Text — Three Clearly Separated Layers (Dramatization Allowed & Visually Distinguished):**
  1. **`caption_quote` (Verbatim Audio):** Exact commentator words with source transcript timestamp (within ±2s of panel). Never alter quoted commentary.
  2. **`narration_box` (Dramatized Manga Narration):** Punchy, dramatic manga narration grounded in the real on-court event and game state (e.g., *"Two defenders slam the trap shut—four seconds on the shot clock."*). Dramatic tone is encouraged; factual claims (score, time, play) must stay true to the footage.
  3. **`thought_bubble` (Extrapolated Inner Monologue):** Since players aren't mic'd up, short inner thoughts extrapolated directly from the immediate on-court tactical/emotional situation are allowed (e.g., trapped in a double-team: *"Nowhere to pass… I have to split them."*). Rules:
     - Must be strictly grounded in what is visibly happening in that beat (e.g., trapped, contesting a shot, down late, celebrating).
     - Styled explicitly as an **inner thought bubble** (cloud/dotted tail or italicized inner monologue), never presented as a literal spoken quote.
     - Keep respectful and game-focused—no trash-talk or controversial statements attributed to real people.

### B. Media Rights & Repository Hygiene
- **Never commit video clips, broadcast frames, or generated NBA/NCAA panels to Git.** Keep all media inside gitignored `data/` / `outputs/` directories.
- **Keep the pipeline basketball-generic:** Do not hardcode broadcaster-specific overlays (ESPN/TNT/League Pass) so the app runs identically on NBA footage (local testing/demo if permitted by organizers) **and** on personal/pickup/Creative Commons basketball clips.
- **Hackathon compliance:**
  - Media in (video + audio) and media out (illustrated manga pages).
  - At least 2 distinct Gemini 4 models with clear, non-overlapping responsibilities.
  - No stats/coaching/tactical analyzer features (this is visual storytelling, not a sports coach).
  - Support live / unscripted clip uploads.

---

## 3. Gemini API & SDK Standards (MANDATORY)

> **All agents MUST follow these API conventions. Do NOT use deprecated SDKs or models.**

- **Python SDK:** `google-genai >= 3.2.0` (`from google import genai`)
- **JS/TS SDK:** `@google/genai >= 3.2.0` (`import { GoogleGenAI } from "@google/genai"`)
- **FORBIDDEN:** `google-generativeai`, `@google/generative-ai`, `generateContent` / `generate_content` (use `client.interactions.create` and `client.decisions.create`), and any `gemini-2.5-*`, `gemini-2.0-*`, or `gemini-1.5-*` models.

### Model Roster & Responsibilities

| Role | Model ID | API Surface | Why |
| :--- | :--- | :--- | :--- |
| **Parallel Segment Scout & Frame Grounding** | `gemini-4-argon` *(supports opt-in Agentic Video Understanding)* or `gemini-4-hydrogen` | `client.interactions.create` (`v1`) | Watches overlapping video chunks concurrently; extracts transcripts, game-state summaries, action + story beats, and action bounding boxes. |
| **Calibrated Scorer & Fidelity Gate** | `gemini-decision-1` | `client.decisions.create` (**`v1beta`**) | Evaluates independent `noul` (yes/no) and `score` questions in one pass with calibrated probabilities and 0 output tokens. |
| **Planner & Manga Story Director** | `gemini-4-carbon` | `client.interactions.create` (`v1`) | Interprets user focus prompt; synthesizes full game arc (*Kishōtenketsu*), casts beats into manga roles, writes dramatized narration, context-grounded thought bubbles, and layout JSON. |
| **Supervised Manga Inking (Stretch)** | `gemini-nano-banana-2.1` | `client.interactions.create` (`v1`) | Converts real cropped frames to manga ink style strictly behind the Fidelity Gate. |

### Verified SDK Snippets

#### Structured Output (`Interactions API`, `v1`)
```python
from google import genai
from pydantic import BaseModel

client = genai.Client()

interaction = client.interactions.create(
    model="gemini-4-carbon",
    input="...",
    response_format={
        "type": "text",
        "mime_type": "application/json",
        "schema": MySchema.model_json_schema(),
    },
)
parsed = MySchema.model_validate_json(interaction.output_text)
```

#### Video Upload + Understanding (`Files API` + `Interactions API`)
```python
import time
from google import genai

client = genai.Client()
video_file = client.files.upload(file="data/chunk_01.mp4")
while not video_file.state or video_file.state.name != "ACTIVE":
    time.sleep(2)
    video_file = client.files.get(name=video_file.name)

interaction = client.interactions.create(
    model="gemini-4-hydrogen",  # or "gemini-4-argon" for long-form agentic video
    input=[
        {"type": "text", "text": "Extract action and story beats..."},
        {"type": "video", "uri": video_file.uri, "mime_type": video_file.mime_type},
    ],
    response_format={
        "type": "text",
        "mime_type": "application/json",
        "schema": SegmentOutput.model_json_schema(),
    },
)
```

#### Calibrated Scoring & Fidelity Gate (`Decisions API`, `v1beta`)
```python
from google import genai

decision_client = genai.Client(http_options={"api_version": "v1beta"})

result = decision_client.decisions.create(
    model="gemini-decision-1",
    input=[
        {"type": "text", "text": "Evaluate this basketball moment against user focus: ..."},
        {"type": "image", "data": b64_frame, "mime_type": "image/jpeg"},
    ],
    questions={
        "high_spectacle": {
            "type": "noul",
            "instructions": "Is this a visually explosive basketball highlight (dunk, block, deep 3, crossover, buzzer beater)?",
        },
        "high_narrative_leverage": {
            "type": "noul",
            "instructions": "Does this moment materially shift game stakes, momentum, clutch tension, or emotional arc?",
        },
        "matches_user_focus": {
            "type": "noul",
            "instructions": "Does this moment directly feature or advance the user's requested focus?",
        },
        "visual_clarity": {
            "type": "noul",
            "instructions": "Is the key subject and basketball clearly visible with minimal motion blur and no replay graphics?",
        },
    },
)
p_spectacle = result.answers["high_spectacle"].noul
```

---

## 4. End-to-End Pipeline Architecture

> **Critical optimization:** Full raw broadcast chunks are watched **once** in Stage 2. Stages 1 → 3.5 output a self-contained `DirectorHandoffPackage` (`outputs/<job_id>/handoff.json`) with **dual-tier media**: full unbroken live sequence clips (`8–18s`) for story/clock continuity **plus** paired tight zoomed-in broadcast replay snippets (`2.5–4.5s`, `replay_angles`) and burst frames so Stage 4/5 can convert close-up frames directly into manga panels without AI visual extrapolation.

```
[Video + User Focus Prompt]
        │
        ▼
Stage 1: Plan & Adaptive Chunk (`pipeline/planner.py` + `media/chunker.py`)
  • Gemini 4 Carbon parses `user_focus` -> `GamePlan` + adaptive `ScoringWeights`
  • Duration-adaptive overlapping chunks (<=2m: 1 chunk; 2–6m: 90s/10s; 6–20m: 150s/12s; >20m: 180s/14s)
  • Measures exact H.264 stream-copy `actual_start_sec` per chunk (zero keyframe timestamp drift)
        │
        ▼  (concurrent via asyncio.gather, bounded semaphore)
Stage 2: Parallel Segment Scouting (`pipeline/scout.py` — `gemini-4-hydrogen` / `gemini-4-argon`)
  • Outputs per chunk:
    1) Segment Game-State Summary (score swing, runs, protagonist status)
    2) Full Unbroken LIVE `action` Sequences (`is_replay=false`, 5–10s setup -> ~1.5s post-finish)
    3) Tight Zoomed-In Broadcast Replay Snippets (`is_replay=true`, 2–4.5s, `rim_or_baseline` / `tight_closeup`)
    4) `story_emotion` Beats (celebrations, huddles, traps, misses, foul trouble)
  • Merges back-to-back split live action beats (`merge_connected_action_beats`)
  • Pairs zoomed-in replays onto their parent live play as `replay_angles` (`attach_replays_to_live_beats`),
    keeping unmatched zoomed replays as compact standalone options
        │
        ▼
Stage 3: Two-Axis Calibrated Ranking (`pipeline/ranker.py` — `gemini-decision-1` on `v1beta`)
  • Extracts sharpest Laplacian keyframe for each candidate + attached `replay_angles`
  • Scores every candidate on 4 calibrated `noul` axes:
    - `action_spectacle`, `narrative_leverage`, `user_focus_match`, `visual_clarity`
  • Selects a non-overlapping, chronologically ordered BALANCED pool (~22 beats)
        │
        ▼
Stage 3.5: Pre-Director Handoff (`pipeline/handoff.py` -> `outputs/<job_id>/handoff.json`)
  • Cuts frame-accurate `.mp4` clips + multi-frame `burst_frames`:
    - Live sequences: full unbroken play (`start - 3.0s .. end + 1.5s`, up to 18s)
    - Paired `replay_angles` & standalone replays: compact `2.5–4.5s` zoomed-in snippets + 3-frame close-up bursts
  • Exposes `build_storyline_model_input(handoff, mode="keyframes_only" | "burst_frames" | "video_clips" | "hybrid")`
        │
        ▼
Stage 4: Manga Director & Storyboard (`pipeline/director.py` — `gemini-4-carbon`)
  • Consumes `handoff.json` via `build_storyline_model_input(...)`
  • Builds Kishōtenketsu arc: Setup (Ki) → Escalation (Shō) → Turning Point (Ten) → Climax Splash + Aftermath (Ketsu)
  • Casts 6–12 beats into `narrative_role` + `visual_intensity` + page layout templates (preferring zoomed `replay_angles` for close-up panels!)
        │
        ▼
Stage 5: Frame Extraction, Anchored Inking & Interactive Reader
  • Crops chosen live or zoomed-replay frame via `action_bbox_norm`
  • Inks via OpenCV deterministic manga filter (XDoG edges + screentone dots)
    [Stretch: Nano Banana 2.1 + Edge-IoU & Decisions API Fidelity Gate → fallback to OpenCV]
  • Overlays non-mutating speed lines, impact bursts, SFX, verbatim captions, narration & thought bubbles
  • Renders in Interactive Manga Reader UI with Click/Hover "Ink Peel" provenance
```

### The 2×2 Manga Casting Matrix (How Stage 4 Uses Stage 3 Scores)

| | **High Narrative Leverage ($S_{\text{story}}$)** | **Low Narrative Leverage ($S_{\text{story}}$)** |
| :--- | :--- | :--- |
| **High Action ($S_{\text{action}}$)** | **Climax / Turning-Point Splash** (60–75% dominant panel, heavy speed lines, huge SFX) | **Cut — or Small Dominance Panel** (e.g., Q1 windmill dunk up 15: skip, or 1 small Setup panel) |
| **Low Action ($S_{\text{action}}$)** | **Emotional / Tension Beat** (tight face/eyes or scoreboard crop, quiet narration/thought bubble, no speed lines) | **Drop** |

---

## 5. Canonical Shared Data Contracts (JSON Schemas)

All modules exchange data using the Pydantic contracts in `schemas/models.py` (mirror in frontend TypeScript types).

### 5.1 `JobInput`
```json
{
  "job_id": "string",
  "video_path": "string",
  "user_focus": "string (e.g., 'Follow #23 in the 4th quarter comeback')",
  "target_pages": 2,
  "reading_direction": "rtl | ltr",
  "enable_nano_banana": false
}
```

### 5.2 `SegmentOutput` (Stage 2 output per chunk)
```json
{
  "segment_id": "seg_01",
  "start_sec": 0.0,
  "end_sec": 90.0,
  "game_state_summary": "Red leads 14-10 early; #23 misses two jumpers and looks frustrated before forcing a steal.",
  "candidates": [
    {
      "candidate_id": "seg_01_b01",
      "category": "action | story_emotion",
      "start_sec": 41.0,
      "end_sec": 46.5,
      "peak_sec": 44.2,
      "description": "#23 strips the ball handler at half court and drives for a contested layup.",
      "players_involved": ["#23", "Blue #7"],
      "score_context": "14-12, 1:15 left",
      "verbatim_quotes": [
        { "text": "STRIPPED AWAY! HE'S GOING COAST TO COAST!", "timestamp_sec": 43.8 }
      ],
      "emotional_tone": "intense | tense | triumphant | frustrated | stunned | calm"
    }
  ]
}
```

### 5.3 `ScoredCandidate` & `DirectorHandoffPackage` (Stages 3 & 3.5 -> `outputs/<job_id>/handoff.json`)
`DirectorHandoffPackage` is the exact boundary artifact produced by `run_ingest.py` for Stage 4 (`director.py`). Each `ScoredCandidate` in `selected_pool` carries its full live clip, sharp keyframe, 5-frame burst strip, **and** paired zoomed-in `replay_angles` (`2.5–4.5s` snippets + 3-frame bursts):
```json
{
  "candidate_id": "seg_19_b05",
  "segment_id": "seg_19",
  "category": "action",
  "start_sec": 5245.2,
  "end_sec": 5258.5,
  "peak_sec": 5257.1,
  "is_replay": false,
  "camera_framing": "wide_court | medium_action | tight_closeup | rim_or_baseline",
  "keyframe_path": "outputs/<job_id>/keyframes/seg_19_b05.jpg",
  "burst_frames": [{ "path": "...", "timestamp_sec": 5255.1, "sharpness": 1820.4 }],
  "clip_path": "outputs/<job_id>/clips/seg_19_b05.mp4",
  "clip_start_sec": 5242.2,
  "clip_end_sec": 5260.0,
  "replay_angles": [
    {
      "replay_id": "seg_19_b09",
      "start_sec": 5285.8,
      "end_sec": 5289.8,
      "peak_sec": 5288.0,
      "camera_framing": "rim_or_baseline",
      "description": "Zoomed baseline replay of #24 releasing the three-pointer.",
      "keyframe_path": "outputs/<job_id>/keyframes/seg_19_b05_rep1.jpg",
      "clip_path": "outputs/<job_id>/clips/seg_19_b05_rep1.mp4",
      "burst_frames": [{ "path": "...", "timestamp_sec": 5288.0, "sharpness": 2410.1 }]
    }
  ],
  "scores": {
    "action_spectacle": 0.90,
    "narrative_leverage": 0.94,
    "user_focus_match": 0.92,
    "visual_clarity": 0.85,
    "composite_story_rank": 0.91
  },
  "casting_quadrant": "climax_candidate | swagger_montage | emotional_beat | drop"
}
```
Stage 4 can load `DirectorHandoffPackage` and call `build_storyline_model_input(handoff, mode=...)` from `pipeline/handoff.py` (`"keyframes_only"`, `"burst_frames"`, `"video_clips"`, or `"hybrid"`).

### 5.4 `MangaStoryboard` (Stage 4 & Stage 5 final output consumed by Frontend UI)
```json
{
  "job_id": "string",
  "title": "THE FOURTH QUARTER STORM",
  "subtitle": "Chapter 1: Down Eight",
  "user_focus": "Follow #23 in the 4th quarter comeback",
  "reading_direction": "rtl",
  "arc_summary": "string",
  "pages": [
    {
      "page_number": 1,
      "layout_template": "opening_4panel | tension_5panel | climax_splash_4panel | aftermath_3panel",
      "panels": [
        {
          "panel_id": "p1_1",
          "reading_order": 1,
          "slot": "top_wide | mid_left | mid_right | slant_left | splash_hero | bottom_strip",
          "candidate_id": "seg_01_b01",
          "narrative_role": "setup | dominance | struggle | tension_pause | turning_point | escalation | climax | aftermath",
          "visual_intensity": "quiet | medium | explosive",
          "crop_focus": "full_action | tight_face | hoop_and_ball | scoreboard | bench_reaction",
          "action_bbox_norm": [0.22, 0.15, 0.78, 0.88],
          "narration_box": "Down 2. One minute left—the trap closes in.",
          "caption_quote": {
            "text": "STRIPPED AWAY! HE'S GOING COAST TO COAST!",
            "timestamp_sec": 43.8
          },
          "thought_bubble": {
            "subject": "#23",
            "text": "One opening—just give me one step.",
            "grounding_cue": "Trapped near the sideline before splitting the double-team"
          },
          "sfx": {
            "text": "SWIPE!",
            "katakana": "シュッ",
            "style": "sharp | heavy | quiet | none"
          },
          "effects": {
            "speed_lines": "none | radial | directional",
            "impact_burst": false
          },
          "assets": {
            "panel_image_url": "/assets/<job_id>/panels/p1_1_ink.png",
            "source_frame_url": "/assets/<job_id>/frames/p1_1_raw.jpg",
            "source_clip_url": "/assets/<job_id>/clips/p1_1.mp4"
          },
          "provenance": {
            "timestamp_sec": 44.2,
            "ink_method": "opencv_deterministic | nano_banana_verified",
            "edge_iou": 0.94,
            "decision_fidelity_score": 0.97,
            "scores": {
              "action_spectacle": 0.86,
              "narrative_leverage": 0.91,
              "user_focus_match": 0.95
            }
          }
        }
      ]
    }
  ]
}
```

---

## 6. Repository Directory Structure & Workstream Ownership

```text
Gemini-4-Hackathon/
├── AGENTS.md                   # This file (source of truth)
├── .gitignore                  # MUST ignore data/, outputs/, *.mp4, *.mov, .env
├── .env.example                # Template for GEMINI_API_KEY
├── requirements.txt            # Python dependencies (google-genai>=3.2.0, imageio-ffmpeg, etc.)
├── run_ingest.py               # CLI runner for Stages 1 -> 3.5 (-> outputs/<job_id>/handoff.json)
├── schemas/
│   └── models.py               # Pydantic contracts (JobInput, DirectorHandoffPackage, MangaStoryboard)
├── media/                      # [Owner A: Video & Image Plumbing]
│   ├── ffmpeg_utils.py         # System / imageio-ffmpeg resolver, OpenCV prober, clip trimmer
│   ├── chunker.py              # Adaptive overlapping chunker w/ exact H.264 actual_start_sec
│   ├── frames.py               # 8 fps sharpness keyframe picker & chronological burst extractor
│   └── manga_filter.py         # Deterministic OpenCV XDoG + halftone screentone + speedlines
├── pipeline/                   # [Owner B: Gemini 4 & Decisions Agent Pipeline]
│   ├── prompts.py              # Centralized prompts & Decisions API rubrics (Stages 1 -> 3.5)
│   ├── gemini_client.py        # v1 Interactions/Files + v1beta Decisions SDK wrappers & retries
│   ├── planner.py              # Stage 1: User focus parsing & adaptive GamePlan
│   ├── scout.py                # Stage 2: Concurrent scouting, sequence merge & replay pairing
│   ├── ranker.py               # Stage 3: Gemini Decision 1 scoring & balanced pool selection
│   ├── handoff.py              # Stage 3.5: Dual-tier clip/burst builder & storyline input modes
│   ├── director.py             # Stage 4: Gemini 4 Carbon Kishōtenketsu storyboard generator
│   ├── fidelity_gate.py        # Stage 5: Edge-IoU + Gemini Decision 1 gate for Nano Banana 2.1
│   └── orchestrator.py         # End-to-end runner + FastAPI server
├── web/                        # [Owner C: Interactive Manga Reader UI]
│   ├── index.html / src/       # Asymmetric CSS Grid + clip-path templates, RTL/LTR toggle,
│   │                           # Ink Peel / Click-to-Source provenance modal, SFX overlays,
│   │                           # panel-by-panel reveal mode, PNG/PDF export
│   └── mock/sample_manga.json  # Fixture matching MangaStoryboard schema for parallel UI dev
├── evals/                      # [Owner D: Baselines, Metrics & Stress Tests]
│   ├── baseline_highlights.py  # Highlight-only (S_action only) baseline
│   ├── baseline_uniform.py     # Even-sampling baseline
│   └── metrics.py              # Invention rate, fidelity score, text grounding, coverage
├── data/                       # [GITIGNORED] Local test videos (never commit!)
└── outputs/                    # [GITIGNORED] Generated frames, panels, storyboards
```

---

## 7. Manga Visual & UI Guidelines (For Owner A & Owner C)

To make the output look like an **authentic basketball manga** rather than a photo filter in a grid:
- **Asymmetric page templates** (CSS Grid + diagonal `clip-path` panel borders, thick black 3–4px panel frames, varied gutter spacing, full-bleed climax splash panel taking 60–75% of page height).
- **Clear visual distinction of the three text layers (real vs. dramatized):**
  - `narration_box`: Crisp white/cream rectangle with solid black border — dramatized manga narration grounded in the real play/score.
  - `caption_quote`: Dynamic slanted/jagged broadcaster box with small timestamp badge (`00:43.8`) proving verbatim audio provenance.
  - `thought_bubble`: Cloud-bordered bubble with dotted tail (or soft italicized inner-monologue box) — clearly signals context-extrapolated player thoughts, never literal spoken quotes.
  - `sfx`: Large rotated bold impact typography (optional subtle katakana subtitle) positioned near the action.
- **Signature UI Interaction — "Ink Peel / X-Ray":**
  - Clicking or holding any panel reveals the **original unedited source frame** (with a before/after slider or instant flip), exact video timestamp, `gemini-decision-1` Action vs. Story scores, fidelity score, and an optional 3-second source clip playback.
- **Reading modes:** Default **Right-to-Left (RTL)** manga spread with subtle numbered reading-order badges (toggleable to LTR or vertical scroll), plus **Panel-by-Panel Reveal** (arrow keys / spacebar).

---

## 8. Hackathon Scope, Freeze & Evaluation Targets

### MVP (Must work end-to-end before any stretch work)
1. Upload/select a 1–5 min basketball clip + enter a `user_focus` prompt.
2. Adaptive chunking → concurrent segment scouting → `gemini-decision-1` two-axis ranking → `gemini-4-carbon` *Kishōtenketsu* storyboard.
3. Peak-frame extraction + smart crop + deterministic OpenCV manga ink/screentone filter.
4. Interactive Manga Reader showing 1–2 pages (6–10 panels) with **Ink Peel / Click-to-Source** provenance.

### Stretch Goals (Strictly in order, only after MVP is rock solid)
1. `gemini-nano-banana-2.1` supervised manga inking behind the `gemini-decision-1` + Edge-IoU fidelity gate (with automatic fallback to OpenCV).
2. SVG/Canvas radial speed lines + stylized SFX overlays anchored to `action_bbox_norm`.
3. Full-game (4-quarter) multi-chapter support.
4. Panel-by-panel dramatic reveal + PNG/PDF export.

### Evaluation Metrics (For Judges)
- **Invention Rate:** External reviewers inspect panel vs. source frame (*"Is anything depicted that isn't in the real frame?"*) — compare against one-shot text-to-manga baseline.
- **Automated Fidelity Score:** Edge-IoU + `gemini-decision-1` same-scene probability.
- **Storyline Preference (Blind A/B Vote):** 10+ attendees compare **Storyline-Driven Manga** vs. **Highlight-Only Baseline** and **Even-Sampling Baseline**.
- **Text Grounding & Quote Accuracy:** % of `caption_quote` boxes matching transcript verbatim within ±2s, plus human/Decisions-API check that `narration_box` and `thought_bubble` stay grounded in the visible on-court moment (zero fabricated plays or scores).
- **Latency:** Seconds per generated manga page.

---

## 9. Local Setup & Multi-Agent Collaboration Rules

- **Environment:** Python 3.10+, `pip install -r requirements.txt`, and `GEMINI_API_KEY` set in `.env` (never committed).
- **FFmpeg requirement:** Install `ffmpeg` on `PATH` (or support `imageio-ffmpeg` / `opencv-python` fallback for frame extraction if `ffmpeg` is missing on a teammate's machine).
- **Avoid merge conflicts across parallel agents:**
  - Owner A edits only `media/`
  - Owner B edits only `pipeline/`
  - Owner C edits only `web/`
  - Owner D edits only `evals/`
  - Changes to `schemas/models.py` or `AGENTS.md` must be coordinated before modifying downstream modules.
