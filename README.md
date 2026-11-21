# Basketball Video to Storyline Manga (`Gemini-4-Hackathon`)

See [AGENTS.md](AGENTS.md) for the full project architecture, Gemini 4 + Decisions API standards, and canonical JSON contracts.

## Quick Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Add GEMINI_API_KEY=... to .env
```

> `ffmpeg` on `PATH` is used automatically if installed; otherwise `imageio-ffmpeg` provides a bundled `ffmpeg` binary out of the box.

---

## Upstream Pipeline (Stages 1 → 3.5: Raw Video → `handoff.json`)

`run_ingest.py` runs everything from raw basketball video + `user_focus` up to **right before the final storyline model**:

1. **Stage 1 (`pipeline/planner.py` + `media/chunker.py`):** Uses `gemini-4-carbon` to parse `user_focus` into a `GamePlan` + adaptive scoring weights, then cuts overlapping video chunks.
2. **Stage 2 (`pipeline/scout.py`):** Runs `gemini-4-hydrogen` (or `gemini-4-argon` with Agentic Video Understanding on >5 min chunks) concurrently across chunks to extract segment summaries + **both `action` and `story_emotion` beats** + verbatim quotes, and deduplicates overlap boundaries.
3. **Stage 3 (`pipeline/ranker.py` + `media/frames.py`):** Extracts the sharpest keyframe around each `peak_sec`, scores all candidates concurrently with `gemini-decision-1` (`v1beta`) across 4 calibrated axes (`action_spectacle`, `narrative_leverage`, `user_focus_match`, `visual_clarity`), applies the **2×2 Manga Casting Matrix**, and selects a chronologically ordered balanced storyline pool.
4. **Stage 3.5 (`pipeline/handoff.py`):** Cuts short frame-accurate `.mp4` clips + multi-frame burst strips for the selected pool and writes `outputs/<job_id>/handoff.json` (`DirectorHandoffPackage`).

### Run Commands

```powershell
# 1. Offline smoke test (no API key needed — verifies FFmpeg, OpenCV sharpness, dedup, 2x2 ranking & handoff)
python run_ingest.py --dry-run-synthetic

# 2. Live run on a basketball clip
python run_ingest.py --video data/game_q4.mp4 --focus "Follow #23 in the 4th quarter comeback" --job-id q4_demo

# 3. Full-game 4-quarter mode with Gemini 4 Argon Agentic Video Understanding
python run_ingest.py --video data/full_game.mp4 --quarters --scout-model gemini-4-argon --agentic --focus "Focus on the second-half comeback"

# 4. Iterate on pool size / handoff mode instantly from cached Stage 2 & 3 outputs (zero video re-upload)
python run_ingest.py --video data/game_q4.mp4 --job-id q4_demo --pool-size 14 --preview-handoff-mode video_clips
```

### Iterating on How Candidates Are Presented to the Final Storyline Model

Load `outputs/<job_id>/handoff.json` and call `build_storyline_model_input(handoff, mode=...)` from `pipeline/handoff.py` to test 4 presentation modes without re-running Stages 1–3:

- `keyframes_only` — 1 sharp JPEG per beat (fastest)
- `burst_frames` — 4-frame chronological strip per beat (frame choice without video upload overhead)
- `video_clips` — trimmed `.mp4` clip per beat (full motion + commentary audio)
- `hybrid` *(default)* — `.mp4` clips for `climax_candidate` beats + sharp keyframes for tension/setup beats
