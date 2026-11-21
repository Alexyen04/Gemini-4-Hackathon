# Manga Conventions & Lettering Reference

## 1. Reading Flow Mechanics
- **Left-to-Right (`ltr`, Required)**:
  - Top-left panel is `reading_order: 1`.
  - Horizontal progression moves left → right within a row tier before stepping down top → bottom.
  - Inside a single panel, place the initiating caption or speech bubble in the **top-left** safe zone and the response or reaction SFX toward the **bottom-right**.

## 2. Safe Zones & Occlusion Prevention
- Compute focal coordinates `(focal_x, focal_y)` in `[0, 1]` representing the primary player face, shooting hand, or basketball/rim intersection.
- Anchor speech bubbles and narration boxes in the corner **furthest** from `(focal_x, focal_y)`.
- Keep total text overlay coverage below **18% of panel area**.

## 3. Speech Bubble & Caption Taxonomy
1. `narration`: Sharp rectangular double-bordered box (`paper` background `#faf7ef` or inverted ink `#0b0b0f`). Used for game context, tactical observation, and dramatic internal framing.
2. `speech`: Vertical-oval clean ink bubble for audible on-court communication (`"SCREEN LEFT!"`, `"ICE! ICE!"`).
3. `shout`: Jagged starburst polygon bubble for explosive calls, buzzer reactions, and celebration roars.
4. `thought`: Soft scalloped or dashed-radiating internal monologue bubble, grounded in emotional state without claiming verbatim real-world press quotes.
5. `scoreboard` / `time_indicator`: Monospace broadcast-meets-manga stamp (`Q4 00:04.2 | VIPERS 101 - TITANS 102`).

## 4. Basketball Sound Effect (SFX) Matrix (Language-Matched)
Always match the language of the input video/prompt. For English inputs, output English SFX ONLY (never append Japanese katakana):

| Basketball Action | English SFX | Typography Treatment |
| :--- | :--- | :--- |
| One/two-hand dunk | `BOOOOM!!` | Heavy skewed block, white stroke, impact burst |
| Clean 3PT / jumper make | `SWISH!` | Sleek italic arc following net snap |
| Live dribble / setup | `THUMP THUMP` | Low rhythmic staggered baseline |
| Hard plant / step-back | `SKREEECH!` | Sharp angular slash near court floor |
| Rim block / swat | `SMACK!!` | Explosive radial shard lettering |
| Iron bounce / rim-out | `CLANG!` | Rigid metallic block vibration |
| Explosive drive / leap | `WHOOSH!` | Tapered diagonal speed sweep |
| Final buzzer | `BZZZZZZT!!` | Full-width stark banner |
| Crowd eruption | `ROAAAAR!!` | Rising background wave lettering |
