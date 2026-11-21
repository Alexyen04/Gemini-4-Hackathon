# Gemini-4-Hackathon — Dunkoma

This repo holds three parts. See [AGENTS.md](AGENTS.md) for architecture, model standards and data contracts.

| Part | Where | Run |
| --- | --- | --- |
| Manga studio app (end-to-end clip → manga, TypeScript) | repo root (`src/`) | `npm install && npm run dev` → http://localhost:3000/studio |
| Upstream ingest pipeline (Stages 1 → 3.5, Python) | `pipeline/`, `media/`, `schemas/`, `run_ingest.py` | `python run_ingest.py --dry-run-synthetic` |
| Landing page | `web/` | `cd web && npm install && npm run dev` |

---

## Manga Studio App


An end-to-end reference-guided basketball highlight-to-manga storytelling studio, illustration engine, and interactive reader built exclusively on **Google's Gemini 4 model family** (`gemini-4-carbon`, `gemini-4-argon`, `gemini-4-hydrogen`, and `gemini-4-neon`) with Next.js 15, TypeScript, Tailwind CSS, FFmpeg, Sharp, and Zod.

---

## 1. System Overview & Updated Pipeline Order

**COURT & INK** studies developer-supplied basketball manga chapters in `data/manga_refs/` before analyzing basketball highlight clips, applying learned anime/manga visual storytelling principles to create original, interactive basketball manga stories:

- **Stage 0 — Manga Visual Reference Analysis (`gemini-4-carbon`)**: Scans `data/manga_refs/`, extracts & normalizes pages/panels, visually analyzes character proportions, G-pen/brush linework, screentones, basketball action framing, layouts, narrative pacing, and anime visual language, and caches the resulting profile to `data/manga_style_profile.json` and `data/manga_reference_index.json` keyed by a SHA-256 content fingerprint.
- **Stage 1 — Basketball Clip Understanding (`gemini-4-argon`)**: Multimodal inspection of uploaded basketball clips & FFmpeg keyframes to extract verified actions, players, jersey numbers, shot outcomes, and timestamps.
- **Stage 2 — Narrative Planning (`gemini-4-carbon`)**: Builds a chronologically accurate 5-stage sports manga arc (`introduction` → `rising_action` → `conflict` → `climax` → `resolution`).
- **Stage 3 — Reference-Guided Storyboarding (`gemini-4-carbon`)**: Combines clip analyses, narrative arc, the `basketball-manga` skill, `MangaVisualStyleProfile`, and retrieved event-specific reference guidance into a validated multi-page storyboard.
- **Stage 4 — Reference-Guided Illustration (`gemini-4-carbon` + Local Hybrid/SVG Engine)**: Generates per-panel `CarbonIllustrationSpec` directives + sanitized `<svg>` action overlays and renders high-resolution PNG panels honoring the selected preset and independent art controls.
- **Stage 5 — Deterministic Page Composition**: Arranges panels into non-overlapping Right-to-Left (`rtl`) or Left-to-Right (`ltr`) pages with print PNG export.
- **Stage 6 — Quality & Originality Validation (`gemini-4-hydrogen`)**: Evaluates style profile alignment, anime expressiveness, artwork originality (never copying reference characters), and factual basketball accuracy, regenerating individual failing panels when needed.
- **Stage 7 — Interactive Manga Reader**: Click any manga panel to watch the original basketball highlight seeked to its exact timestamp.

---

## 2. Organizing Reference Manga Chapters (`data/manga_refs/`)

Reference chapters are developer-maintained local assets (there is intentionally no frontend reference uploader). Place your *Kuroko's Basketball* or other basketball manga chapters directly inside `data/manga_refs/`:

```text
data/manga_refs/
├── Kuroko_No_Basket_136/
│   ├── kuroko_no_basket_136_1.jpg
│   ├── kuroko_no_basket_136_2.jpg
│   └── ...
├── Kuroko_No_Basket_152/
│   └── ...
├── Kuroko_No_Basket_274/
│   └── ...
└── chapter_04/
    └── chapter_04.zip   # or .pdf / .cbz / image files
```

### Supported Reference Formats & Caching Rules
- **Supported files**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`, `.zip`, `.cbz`.
- **Ordering**: Chapters and pages are sorted using natural numeric order (`_1.jpg` → `_2.jpg` → `_10.jpg`).
- **Automatic SHA-256 Caching**: If no files in `data/manga_refs/` have changed, subsequent manga generation jobs reuse `data/manga_style_profile.json` and `data/manga_reference_index.json` immediately without re-analyzing the chapters. Adding, modifying, or removing any file automatically invalidates the cache and triggers a fresh Stage 0 analysis.
- **Empty Directory Fallback**: If `data/manga_refs/` has no chapters yet, Stage 0 logs a non-blocking warning and uses the built-in `.agents/skills/basketball-manga` guidelines without fabricating reference observations.
- **Copyright Safety**: `.gitignore` excludes `data/` (including `data/manga_refs/` and internal reference crops) from git commits, and `/api/media` blocks public serving of `manga_refs` and `reference_cache`.

---

## 3. Master Art Style Presets & Independent Controls

### Three Master Presets
1. **Hyperkinetic Shonen Anime (`hyperkinetic_shonen_anime` — Default)**: High-energy anime-inspired basketball art with expressive focus highlights, dynamic foreshortening, bold brush shadows, kinetic motion ribbons, and explosive radial bursts.
2. **Authentic Sports Manga (`authentic_sports_manga`)**: Traditional black-and-white basketball manga with crisp G-pen contours, 45° halftone screentones, and grounded athletic anatomy.
3. **Cinematic Anime Drama (`cinematic_anime_drama`)**: Refined cel shading, clean fine contours, negative space, atmospheric lighting, and suspenseful framing.

### Four Independent Art Controls
- **Color Treatment**: `Traditional Monochrome`, `Full Anime Color` (quantized multi-band RGB cel shading + ink contours), or `Monochrome with Selective Color` (preserves vivid basketball orange, rim iron, and crimson jersey accents).
- **Action Intensity**: `Grounded`, `Dramatic`, or `Explosive`.
- **Reference Influence**: `Light`, `Balanced`, or `Strong`.
- **Storytelling Focus**: `Action Focused`, `Balanced`, or `Emotion Focused`.

---

## 4. Setup, Running & Testing

```bash
npm install
cp .env.example .env.local   # Add your GEMINI_API_KEY
npm run dev                  # Launch at http://localhost:3000
```

Run the automated test suites, TypeScript compiler, and production build:

```bash
npm test
npx tsc --noEmit
npm run build
```


---

## Upstream Ingest Pipeline (Python)


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
