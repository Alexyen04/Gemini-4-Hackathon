# Dunkoma ダンコマ

**Every game has a story.** Dunkoma turns a basketball clip into a storyline-driven manga.
Real plays, reimagined panels.

Built for the Gemini 4 NYC Hackathon. [AGENTS.md](AGENTS.md) holds the full architecture, Gemini API standards and data contracts. Read it before changing the pipeline.

---

## What's in this repo

| Part | Where | Stack | Run |
| --- | --- | --- | --- |
| **Manga Studio** (the product) | repo root: `src/` | Next.js 15, TypeScript, Tailwind, Zod, sharp, FFmpeg | `npm run dev` → http://localhost:3000/studio |
| **Upstream ingest pipeline** (scout + rank) | `pipeline/`, `media/`, `schemas/`, `run_ingest.py` | Python, `google-genai`, OpenCV, FFmpeg | Called automatically by the studio; also runs standalone |
| **Landing page** | `web/` | Vite, React, TypeScript, Tailwind v4, GSAP | `cd web && npm run dev` → http://localhost:5173 |

---

## How a manga gets made

You upload a video in the studio, and it runs one job end to end.

```
Video + optional prompt
  │
  ▼  Python ingest (run_ingest.py, called by src/lib/ingest/python-ingest-bridge.ts)
  1  Plan & chunk ............ gemini-4-carbon + FFmpeg
  2  Scout beats ............. gemini-4-hydrogen (gemini-4-argon on long chunks)
  3  Rank beats .............. gemini-decision-1 (action × story casting grid)
  3.5 Handoff ................ outputs/<job_id>/handoff.json (clips, keyframes, burst frames)
  │
  ▼  Studio pipeline (src/lib/jobs/job-manager.ts)
  0  Reference style profile . gemini-4-carbon (only if data/manga_refs/ has chapters)
  1  Clip understanding ...... gemini-4-argon
  2  Narrative plan .......... gemini-4-neon
  3  Storyboard .............. gemini-4-carbon
  4  Illustration ............ gemini-nano-banana-2.1 redraws each real frame (local ink filter as fallback)
  5  Page composition ........ local (sharp)
  6  Validation .............. local checks (gemini-4-hydrogen QA if MANGA_ENABLE_AI_QA=true)
  │
  ▼
Interactive reader: click any panel to play the source clip at that moment
```

Every panel starts from a real frame of your video. The art can take creative liberties, but the plays, scores and order come from the footage.

---

## Setup

You need Node 20+, Python 3.10+, `ffmpeg` on your `PATH`, and a Gemini API key.

```bash
# 1. Studio (repo root)
npm install

# 2. Python ingest pipeline
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 3. API key (gitignored; the studio passes it on to Python)
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 4. Landing page
cd web && npm install
```

> Use plain `npm install`. Don't run `npm audit fix --force`: it upgrades to zod 4 / Next 16, which breaks the Gemini response schemas.

## Running

```bash
npm run dev              # studio → http://localhost:3000/studio
cd web && npm run dev    # landing page (second terminal)
```

In the studio: upload a short clip (a few seconds up to about a minute works best), add an optional prompt, pick an art style and page count, then **Generate**. The screens are **1. Manga Studio → 2. Pipeline Status → 3. Interactive Reader**. If a stage fails, earlier stages are cached, so **Resume** picks up where it stopped.

The landing page's **Try the demo** button opens the studio. Point it somewhere else with `VITE_DEMO_URL` in `web/.env.local`.

## Testing

```bash
npm test                                   # studio test suite (vitest)
npx tsc --noEmit                           # studio type-check
npm run build                              # studio production build
.venv/bin/python run_ingest.py --dry-run-synthetic   # Python pipeline offline smoke test (no API key)
cd web && npm run build                    # landing page type-check + build
```

---

## Configuration

Set these in `.env.local`. Only `GEMINI_API_KEY` is required.

| Variable | Default | What it does |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Required for generation (`GOOGLE_API_KEY` also works) |
| `GEMINI_MODEL_ARGON` / `_CARBON` / `_HYDROGEN` / `_NEON` | `gemini-4-*` | Override a role's model (only Gemini 4 models are allowed) |
| `GEMINI_IMAGE_MODEL` | `gemini-nano-banana-2.1` | Model that redraws frames as manga |
| `MANGA_DISABLE_NANO_BANANA` | off | `true` uses only the local ink filter (faster, no image API calls) |
| `MANGA_ENABLE_AI_QA` | off | `true` adds a `gemini-4-hydrogen` quality pass |
| `MANGA_ENABLE_CARBON_SPEC_PASS` | off | `true` forces the extra Carbon illustration-spec pass |
| `MANGA_IMAGE_CONCURRENCY` / `MANGA_CLIP_CONCURRENCY` | built-in | Parallel image / clip calls |
| `MANGA_DATA_DIR` | `data/` | Where clips, jobs, panels and pages are stored |
| `MANGA_REFERENCES_DIR` | `data/manga_refs/` | Optional reference chapters for Stage 0 |
| `FFMPEG_PATH` / `FFPROBE_PATH` | bundled / `PATH` | Custom FFmpeg binaries |
| `VITE_DEMO_URL` (in `web/.env.local`) | `http://localhost:3000/studio` | Where the landing page CTA points |

---

## Python pipeline on its own

The studio runs `run_ingest.py` for you, but you can run it directly to inspect `handoff.json`:

```bash
.venv/bin/python run_ingest.py --video data/clip.mp4 --focus "Follow #23 in the 4th" --job-id demo
.venv/bin/python run_ingest.py --video data/clip.mp4 --job-id demo --pool-size 14   # re-rank from cache
```

Output lands in `outputs/<job_id>/`. `pipeline/handoff.py` exposes `build_storyline_model_input(handoff, mode=...)` with the modes `keyframes_only`, `burst_frames`, `video_clips` and `hybrid`.

---

## Repo layout

```text
src/app/            Next.js pages (/studio, /reader, /storyboard → /reader) + API routes
src/components/     Studio UI: uploader, pipeline progress, reader, panels
src/lib/ai/         Gemini agents: clip understanding, director, illustrator, Nano Banana, QA
src/lib/ingest/     Bridge that runs run_ingest.py and loads handoff.json
src/lib/jobs/       End-to-end job manager (stages, checkpoints, resume)
src/lib/manga/      Layout engine, renderers, validators, reference analysis
pipeline/ media/ schemas/ run_ingest.py   Python ingest (plan → scout → rank → handoff)
tests/              Vitest suites (pipeline, Python handoff bridge, references, storyboard plan)
web/                Landing page (hero, workflow, "every panel traces back", closing)
.agents/skills/basketball-manga/          Manga storytelling skill the director loads
data/ outputs/      Gitignored: uploads, frames, generated manga
```

---

## Media and rights

- Never commit video, broadcast frames or generated NBA/NCAA panels. `data/`, `outputs/`, `*.mp4` and `web/public/landing-media/` are gitignored.
- Reference chapters in `data/manga_refs/` stay local, and the media API refuses to serve them. Don't use published manga in anything shown publicly.
- The landing page's media files are listed in [web/public/landing-media/README.md](web/public/landing-media/README.md). Every slot shows a placeholder until you add the file.
