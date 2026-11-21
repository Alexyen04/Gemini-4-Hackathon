# COURT & INK — Basketball Video to Storyline Manga (`Gemini-4-Hackathon`)

See [AGENTS.md](AGENTS.md) for the overall project architecture, Gemini 4 + Decisions API standards, and canonical JSON contracts.

---

## Part 1: Upstream Video Ingest & Ranking Pipeline (Python, Stages 1 → 3.5)

`run_ingest.py` processes raw full-game or highlight basketball video + `user_focus` up to `outputs/<job_id>/handoff.json`:

1. **Stage 1 (`pipeline/planner.py` + `media/chunker.py`):** Uses `gemini-4-carbon` to parse `user_focus` into a `GamePlan` + adaptive scoring weights, then cuts overlapping video chunks with exact H.264 `actual_start_sec`.
2. **Stage 2 (`pipeline/scout.py`):** Runs `gemini-4-hydrogen` / `gemini-4-argon` concurrently across chunks to extract unbroken live `action` sequences, tight zoomed-in `replay_angles`, and `story_emotion` beats.
3. **Stage 3 (`pipeline/ranker.py` + `media/frames.py`):** Extracts sharpest keyframes and scores all candidates via `gemini-decision-1` (`v1beta`) across 4 calibrated axes (`action_spectacle`, `narrative_leverage`, `user_focus_match`, `visual_clarity`).
4. **Stage 3.5 (`pipeline/handoff.py`):** Cuts dual-tier `.mp4` clips + burst strips and writes `outputs/<job_id>/handoff.json`.

### Python Setup & Commands
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # Add GEMINI_API_KEY=...
python run_ingest.py --dry-run-synthetic
```

---

## Part 2: COURT & INK — Storyline, Illustration & Manga Reader (Next.js / TypeScript)

An end-to-end reference-guided basketball highlight-to-manga storytelling studio, illustration engine, and interactive reader built on **Google's Gemini 4 model family** (`gemini-4-carbon`, `gemini-4-argon`, `gemini-4-hydrogen`, `gemini-4-neon`) with Next.js 15, TypeScript, Tailwind CSS, FFmpeg, Sharp, and Zod.

### Setup, Running & Testing
```bash
npm install
cp .env.example .env.local   # Add your GEMINI_API_KEY
npm run dev                  # Launch at http://localhost:3000

npm test
npx tsc --noEmit
npm run build
```
