# Deterministic Manga Page Layout Templates

All panel coordinates `(x, y, width, height)` are normalized within `[0, 1]` relative to the inner printable page canvas. `PageCompositionService` maps each `layout_template` deterministically and mirrors horizontal slots automatically between `rtl` (Right-to-Left) and `ltr` (Left-to-Right).

## Supported Templates

### 1. `balanced_four` (4 Panels — Classic Storytelling)
- **Slot 1 (`medium`, top-lead)**: `w: 0.56, h: 0.46` — Primary setup play
- **Slot 2 (`small`, top-trail)**: `w: 0.41, h: 0.46` — Player closeup / eyes / defensive read
- **Slot 3 (`medium`, bottom-lead)**: `w: 0.44, h: 0.51` — Drive or counter-move
- **Slot 4 (`large`, bottom-trail)**: `w: 0.53, h: 0.51` — Resulting shot or reaction

### 2. `balanced_five` (5 Panels — Fast Sequence & Reactions)
- **Row 1 (2 panels, `h: 0.30`)**: Establishing court view (`0.58`) + clock/eyes closeup (`0.39`)
- **Row 2 (1 wide action banner, `h: 0.34`)**: Full-width horizontal drive/pass/block (`1.00`)
- **Row 3 (2 panels, `h: 0.31`)**: Impact finish (`0.60`) + crowd/bench reaction (`0.37`)

### 3. `dramatic_three` (3 Panels — High-Impact Highlight)
- **Row 1 (2 buildup panels, `h: 0.34`)**: Anticipation closeup (`0.45`) + defender contest (`0.52`)
- **Row 2 (1 dominant hero panel, `h: 0.63`)**: Full-width dramatic climax (`1.00`)

### 4. `hero_action_four` (4 Panels — Dominant Vertical Action + 3 Supporting Beats)
- **Lead Column (3 stacked `small`/`medium` panels, `w: 0.38`)**: Dribble gather → eyes narrowing → release hand
- **Trail Column (1 tall `large` vertical showcase, `w: 0.59, h: 1.00`)**: Towering dunk, chase-down block, or high-arcing jumper

### 5. `climax_showcase_three` (3 Panels — Suspense Strip to Giant Climax)
- **Top Dominant Panel (`large`, `w: 1.00, h: 0.66`)**: Decisive shot release or rim collision
- **Bottom Split (2 `small`/`medium` panels, `h: 0.31`)**: Scoreboard/net swish (`0.48`) + player roar (`0.49`)

### 6. `vertical_strip_four` (4 Panels — Cinematic Pacing / Beat-by-Beat)
- Four stacked horizontal widescreen tiers (`h: 0.23` each, `w: 1.00`) ideal for fastbreaks and buzzer-beater countdowns.

### 7. `full_splash` (1 Panel — Iconic Full-Page Splash)
- **Single Panel (`splash`, `x: 0.0, y: 0.0, w: 1.0, h: 1.0`)**: Reserved for the single most monumental game-winner, block, or championship moment.
