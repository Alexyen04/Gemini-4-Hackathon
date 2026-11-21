# Character & Monochrome Uniform Consistency

## 1. Monochrome Team Contrast System
Color NBA broadcasts distinguish teams by hue (e.g., red vs. blue), which collapses to indistinguishable mid-gray under naive grayscale conversion. Every story MUST lock two distinct monochrome uniform encodings in `CharacterReferenceService`:

- **Team Encoding A (`light_ink_trim`)**:
  - Jersey Fill: Crisp manga paper white (`#f9f7f0`)
  - Trim & Numerals: Solid sumi ink (`#0b0b0f`)
  - Shading: Minimal fold hatching under arms and torso
- **Team Encoding B (`dark_halftone` or `solid_ink`)**:
  - Jersey Fill: Deep sumi ink (`#14141b`) or dense 55% 45°-dot screentone
  - Trim & Numerals: Crisp knock-out white (`#ffffff`) with thin black inner contour

## 2. Character Reference Record Structure
For every recurring athlete detected by `gemini-4-argon` or supplied via clip metadata:
- `character_id`: Deterministic slug (e.g., `char_vipers_23`)
- `display_name`: Verified player name or descriptive role (`"#23 Wing Scorer"` when uncertain — never guess an unverified identity)
- `team_name` & `monochrome_uniform`: Locked team contrast assignment
- `jersey_number`: Verified numeral string (or `null` if occluded)
- `visual_traits`: Hair silhouette (e.g., cropped fade, braids, headband), build, shooting hand, sleeve/accessory markers
- `reference_keyframe_path`: Path to the clearest keyframe showing the player

## 3. Cross-Panel Continuity Rules for Gemini 4 Carbon
- Always cite `character_ids` active in each panel.
- Maintain shooting-hand accuracy (never describe a left-handed release if the keyframe shows a right-handed jumper).
- Keep relative defender/offender positioning faithful to the keyframe (`defender_left`, `defender_trailing`, `rim_right`, etc.).
