---
name: basketball-manga
description: Guides reference-guided basketball manga storytelling, anime-inspired visual direction, narrative pacing, panel composition, character consistency, Carbon hybrid/SVG illustration, and quality validation.
---

# Basketball Manga & Anime Storytelling Skill

This skill is the authoritative single source of truth for transforming real basketball highlight clips into authentic, factually grounded, anime-inspired Japanese sports manga (*Kuroko's Basketball*, *Slam Dunk*, *REAL*). It governs both Antigravity development workflows and the runtime **Gemini 4 Carbon** Reference Analyzer, Manga Director, and Illustration Engine.

---

## Core Architectural Mandate

1. **Model Exclusivity**: Only Gemini 4 models (`gemini-4-argon`, `gemini-4-carbon`, `gemini-4-neon`, `gemini-4-hydrogen`) are permitted. `gemini-4-carbon` is the primary Reference Style Analyzer, Narrative Director, Storyboard Architect, and Illustration Specification / SVG Artist.
2. **Stage 0 Reference-Guided Originality**: Study professional manga chapters in `data/manga_refs/` to learn generalizable principles (linework, shading, foreshortening, speed lines, panel rhythm, anime expressiveness), then apply those principles to generate **100% original artwork** grounded in the uploaded basketball footage—never copying reference characters or scans.
3. **Grounded Dramatization**: Dramatize camera angles, ink/cel contrast, motion lines, facial expressions, and narration while **strictly preserving real basketball facts** (who scored, who defended, shot outcomes, jersey numbers, winners, and chronological order).

---

## The 13 Mandatory Manga Storytelling Rules

### Rule 1: Panels Per Page
Default to **4 to 5 panels per page**, adapting dynamically to narrative tension and `storytellingFocus`:
- `normal` (Storytelling): 4 – 6 panels
- `action` (Fast Basketball): 3 – 5 panels
- `dialogue` (Reactions & Bench): 4 – 7 panels
- `dramatic` (Highlight Turning Point): 1 – 3 panels
- `splash` (Full Page Climax): 1 panel

### Rule 2: Dynamic Panel Dimensions
- `small` (5–15%): Eyes, fingertips on leather seams, shot clock, sneaker plant, scoreboard.
- `medium` (15–30%): Dribble setup, defensive stance, pass release, bench/crowd reaction.
- `large` (35–60%): Poster dunks, chase-down blocks, step-back jumpers, paint collisions.
- `splash` (85–100%): Decisive game-winner or chapter climax.

### Rule 3: Reading Direction
- Strictly **Left-to-Right, Top-to-Bottom (`ltr`)** reading order (`reading_order: 1` at top-left, flowing left → right, top → bottom).

### Rule 4: Expressive Anime-Inspired Sports Emotions
Convey athletic intensity through crisp facial shading (`kage`) and eye highlights: `determination`, `shock`, `triumph`, `exhaustion`, `defeat`, `focus`.

### Rule 5: Stylized Manga Sound Effects (SFX) & Language Matching
Match the language of the input media and user prompt across all captions, dialogue, and SFX. For English media/prompts, use **English SFX only** (`BOOOOM!!`, `SWISH!`, `THUMP THUMP`, `SKREEECH!`, `SMACK!!`, `CLANG!`, `WHOOSH!`, `BZZZZZZT!!`, `ROAAAAR!!`)—do NOT add Japanese/katakana characters unless the input media or prompt is in Japanese.

### Rule 6: Dialogue, Narration & Factual Integrity
Support `speech`, `shout`, `thought`, `narration`, `time_indicator`, and `scoreboard` (1–2 concise elements per panel, never covering faces/hands/ball, never fabricating verbatim press quotes from real athletes).

### Rule 7: Motion, Aura & Manga Visual Effects
Scale effects with `actionIntensity` (`grounded`, `dramatic`, `explosive`): `speed_lines_diagonal`, `radial_focus_lines`, `impact_burst`, `screentone_heavy`, `heavy_shadows`, `motion_blur_streaks`, `negative_space`, `sweat_droplets`, `kinetic_aura`, `borderless_bleed`.

### Rule 8: Dynamic Camera Angles & Foreshortening
Vary shots (`extreme_closeup`, `closeup`, `medium_shot`, `wide_shot`, `low_angle`, `high_angle`, `dutch_angle`, `behind_player`, `dynamic_action`) while maintaining spatial court continuity.

### Rule 9: Narrative Pacing & Multi-Beat Decomposition
Decompose pivotal highlights into 2–5 sequential narrative beats (`establishing` → `anticipation` → `movement` → `suspense` → `climax` → `aftermath`). Never flatten an entire highlight reel into 1 clip = 1 static panel.

### Rule 10: Character & Uniform Consistency
Lock recurring player silhouettes, hairstyles, accessories, and jersey numbers in `CharacterReference`. Maintain unmistakable team contrast in monochrome (`light_ink_trim` vs. `solid_ink` / `dark_halftone`) and faithful team palettes in `full_anime_color` / `selective_color`.

### Rule 11: Deterministic Page Composition
Use curated non-overlapping templates (`balanced_four`, `balanced_five`, `dramatic_three`, `hero_action_four`, `climax_showcase_three`, `vertical_strip_four`, `full_splash`) with clean gutters and margins.

### Rule 12: Master Art Presets & Independent Controls
Default preset: **`authentic_sports_manga`**, alongside **`hyperkinetic_shonen_anime`** and **`cinematic_anime_drama`**. Honor all four independent controls: `colorTreatment` (`traditional_monochrome`, `full_anime_color`, `selective_color`), `actionIntensity` (`grounded`, `dramatic`, `explosive`), `referenceInfluence` (`light`, `balanced`, `strong`), and `storytellingFocus` (`action_focused`, `balanced`, `emotion_focused`).

### Rule 13: Strict Factual Grounding
Every panel links to a verified `source_clip_id` and valid `source_timestamp`. Never invent missing plays or alter outcomes.

---

## Supporting Reference Modules
- [Stage 0 Reference Analysis Protocol](./references/reference-analysis.md)
- [Anime-Inspired Visual Language & Controls](./references/anime-visual-language.md)
- [Sports Action Composition Matrix](./references/sports-action-composition.md)
- [Manga Conventions & Lettering](./references/manga-conventions.md)
- [Character & Uniform Consistency](./references/character-consistency.md)
- [Carbon Illustration & SVG Guidelines](./references/illustration-guidelines.md)
- [Deterministic Panel Layouts](./references/panel-layouts.md)
- [Narrative Pacing & Beat Decomposition](./references/narrative-pacing.md)
- [Storyboard JSON Schema](./schemas/storyboard.schema.json)
