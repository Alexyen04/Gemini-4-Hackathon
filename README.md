# COURT & INK — AI-Powered Basketball Manga & Anime Generator

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
