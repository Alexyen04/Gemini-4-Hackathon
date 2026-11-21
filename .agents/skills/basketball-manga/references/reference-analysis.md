# Stage 0: Manga Visual Reference Analysis Protocol

This document governs how **Gemini 4 Carbon** (`gemini-4-carbon`) inspects developer-provided basketball manga chapters in `data/manga_refs/` to extract a reusable `MangaVisualStyleProfile` (`data/manga_style_profile.json`) and `MangaReferenceIndex` (`data/manga_reference_index.json`).

## 1. Ethical & Creative Originality Boundary
- **Study Principles, Never Copy Characters**: Extract generalizable artistic conventions—G-pen taper, brush shadow massing, screentone dot gradients, foreshortening angles, speed-line trajectories, gutter pacing, and anime facial shading—without copying copyrighted character designs, distinctive hair colors, team logos, or verbatim dialogue from the reference chapters.
- **Keep Reference Images Internal**: Reference pages and extracted panel crops are internal analytical inputs only. Never insert or export a reference scan as a generated basketball manga panel.

## 2. Six-Domain Visual Inspection Rubric
When visually inspecting normalized pages and extracted panels from `data/manga_refs/`:
1. **Character Art**: Proportions (lean shonen verticality vs. muscular paint presence), jaw/brow angularity, intense eye iris highlights ("Zone"-like focus streaks when appropriate), jersey fold tension lines across shoulders/waist, and facial shadow bands (`kage`).
2. **Linework & Shading**: Outer silhouette stroke thickness vs. fine interior anatomical hatching, crosshatching density on forearms/calves, halftone/screentone usage, and upper-arena background bleaching.
3. **Basketball Action Grammar**: Specific framing patterns for `shooting`, `dunking`, `dribbling`, `passing`, `blocking`, `defending`, `sprinting`, `confrontations`, and `crowd_reactions`.
4. **Manga Layouts**: Typical panel counts per page, asymmetric height splits, diagonal action dividers, borderless bleed frequency, and splash page triggers.
5. **Narrative Pacing**: How a single decisive possession is dilated across 3–6 sequential beats (establishing → anticipation → crossover/gather → elevation → suspense → rim impact → reaction).
6. **Anime Visual Language**: Foreshortened hands/basketballs thrust toward the lens, dramatic low-angle perspective, radial focus bursts, sharp silhouette separation, and cinematic lighting.

## 3. Retrieval Tagging Vocabulary
Tag analyzed reference pages and extracted panels with accurate semantic tags from this controlled set so `ReferenceRetrievalService` can match basketball clips to relevant visual principles:
`dunk`, `jump_shot`, `dribbling`, `passing`, `defensive_block`, `perimeter_defense`, `sprint_fastbreak`, `closeup`, `extreme_closeup`, `low_angle`, `high_angle`, `dutch_angle`, `determination`, `shock`, `triumph`, `exhaustion`, `impact_lines`, `speed_lines`, `dramatic_splash`, `suspense`, `character_reaction`.
