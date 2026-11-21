# Anime-Inspired Sports Visual Language

Guides **Gemini 4 Carbon** and the rendering engine in translating basketball highlights into dynamic shonen/cinematic anime-styled manga panels.

## 1. Three Master Art Style Presets

### Preset 1: `authentic_sports_manga` (Authentic Sports Manga)
- **Visual DNA**: Crisp variable-weight G-pen ink contours, detailed crosshatching, classic 45° rotated halftone screentones, grounded athletic proportions, high-contrast sumi ink on warm manga paper.

### Preset 2: `hyperkinetic_shonen_anime` (Hyperkinetic Shonen Anime — **Default**)
- **Visual DNA**: High-energy modern sports anime/manga (*Kuroko's Basketball* / shonen jump kineticism). Sharp expressive anime eye highlights, bold brush contours, dramatic foreshortening, intense speed lines, explosive radial impact bursts, kinetic aura/motion trails around the ball and shooting hand, and stark shadow massing.

### Preset 3: `cinematic_anime_drama` (Cinematic Anime Drama)
- **Visual DNA**: Refined filmic anime composition (*The First Slam Dunk* / prestige sports OVA framing). Clean fine contours, controlled cel-like multi-band shading, expansive negative space, emotional closeups, atmospheric rim backlighting, and suspenseful beat pacing.

## 2. Four Independent Art Controls

Every panel specification and rendering pass MUST actively apply these four orthogonal settings:

1. **Color Treatment (`colorTreatment`)**:
   - `traditional_monochrome`: Pure black sumi ink, white knockout highlights, and angled halftone screentones.
   - `full_anime_color`: Cel-shaded anime color palette quantized from source footage with crisp ink linework, warm highlight bloom, cool cel shadow shifts, and vibrant energy trails.
   - `selective_color`: Monochrome sumi ink & screentone world with selective high-saturation accents preserved on the basketball, rim iron, crimson jersey trim, and clutch LEDs/aura streaks.

2. **Action Intensity (`actionIntensity`)**:
   - `grounded`: Natural camera zoom (`1.0–1.35x`), restrained speed lines (`0.25–0.45`), clean rectangular borders.
   - `dramatic`: Punchy low/Dutch angles, medium-high speed/focus lines (`0.55–0.75`), heavy impact borders on key finishes.
   - `explosive`: Extreme foreshortening zooms (`1.25–2.1x`), dense radial bursts (`0.80–1.0`), impact flash needles, kinetic ball trails, and borderless climax bleeds.

3. **Reference Influence (`referenceInfluence`)**:
   - `light`: Follow general manga storytelling rules with minimal profile weighting.
   - `balanced`: Blend `MangaVisualStyleProfile` linework, shading, and camera guidance with the selected preset.
   - `strong`: Closely apply the analyzed reference techniques for contour weight, screentone density, foreshortening, and multi-panel beat pacing while keeping poses and identities 100% original to the basketball clip.

4. **Storytelling Focus (`storytellingFocus`)**:
   - `action_focused`: Prioritize kinetic full-body drives, airborne contests, ball trajectories, and wide/low-angle action panels.
   - `balanced`: Alternate kinetic basketball plays with sharp facial reactions and tactical tension.
   - `emotion_focused`: Emphasize eyes, sweat, breathing, internal monologues, bench/crowd tension, and dramatic aftermath closeups.

## 3. Anime Character Translation & Visual Restraint
- **Hand-Drawn Character Craft (Not Photo Filters)**: Translate real broadcast athletes into cohesive illustrated manga/anime characters—distinctive hair silhouette, sharp expressive eyes, clean jawline/anatomy, and stylized jersey folds—while preserving their real likeness, pose, uniform, and jersey number. Avoid raw photographic grain or coarse halftone dots across faces.
- **Deliberate Contrast Hierarchy**: Reserve crisp dark ink and tight detail for the focal player(s) and basketball; let secondary figures and stadium backgrounds fall back into lighter tones, clean negative space, or minimal linework so every panel reads effortlessly at a glance.
