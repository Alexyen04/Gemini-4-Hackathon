# Carbon Illustration & Nano Banana 2.1 Rendering Guidelines

Gemini 4 Carbon (`gemini-4-carbon`) directs all artwork generation through structured `CarbonIllustrationSpec` objects. In real mode, `HybridMangaRenderer` passes the focal-cropped keyframe and Carbon's `artisticPrompt` to **Gemini Nano Banana 2.1 (`gemini-nano-banana-2.1`)** for native image-to-image sports-manga redrawing, with a deterministic local raster + SVG renderer as offline/demo fallback.

## 1. Three Supported Rendering Modes
1. **`hybrid` *(Primary & Recommended)***:
   - Loads the verified high-resolution keyframe extracted from the basketball clip and applies Carbon-directed focal framing (`focal_x`, `focal_y`, `zoom_factor`).
   - Redraws the frame into authentic hand-drawn sports manga artwork via `gemini-nano-banana-2.1`, guided by Carbon's `artisticPrompt`, `background_mode`, `color_treatment`, and `action_intensity`.
   - Falls back cleanly to multi-scale ink contour + screentone + SVG effects rendering when running in Demo Mode or offline.
2. **`svg_vector` *(Full Vector Illustration)***:
   - Carbon authors a complete stylized monochrome basketball manga `<svg viewBox="0 0 800 600">` composition (court geometry, stylized player silhouettes, rim/backboard, basketball trajectory, screentone `<pattern>` fills, and dynamic ink bursts), rasterized cleanly via Sharp.
   - Best suited for symbolic tension beats: closeups of a ticking shot clock, spinning leather basketball in negative space, or stark silhouette confrontations.
3. **`frame_guided` *(Clean Grounded Illustration)***:
   - Prioritizes crisp anatomical and likeness fidelity from the video keyframe with restrained linework and minimal kinetic overlays, ideal for emotional beats, closeups, and calm setups.

## 2. Figure-Ground Clarity & Background Economy
Professional sports manga achieves readability by separating the foreground athlete(s) from visual noise:
- **Avoid busy background static**: Arena spectators, LED ribbon boards, and stadium signage should never compete with the player's silhouette or facial expression. Reason per shot about how much environment to retain:
  - `stark_white_tension` / `speed_void`: Drop the background to clean negative space or directional speed lines when emotion, speed, or a single decisive gesture carries the beat.
  - `arena_simplified`: Keep only architectural anchors (court lines, backboard, rim, faint tonal silhouettes) so the setting reads instantly without noisy detail.
  - `dark_pressure`: Use heavy ink shadow massing behind a brightly rim-lit foreground subject for high-stakes tension.
- **Unobstructed focal subjects**: Keep faces, eyes, and primary ball-handling silhouettes clean—avoid stray vector lines, arcs, or heavy halftone noise crossing over faces.
- **No baked-in text**: Leave speech bubbles, captions, and SFX to the page compositor rather than drawing text inside the illustration.

## 3. Specific vs. Generic Art Direction
Carbon MUST produce event-specific visual specifications:
- **Bad**: `"Draw a player dunking."`
- **Good**: `"Low-angle upward framing centered on the driving forward's right-handed finish at (0.58, 0.32). Redraw as a clean shonen-manga illustration with crisp G-pen ink contours, dynamic jersey folds, expressive determined eyes, and simplified architectural court cues—abstract the background crowd into soft negative space so the airborne silhouette dominates the contrast."`

## 4. SVG Authoring & Security Constraints
Prefer `custom_svg_overlay: null` for `hybrid` and `frame_guided` panels rendered by Nano Banana 2.1 unless a minimal non-obstructive edge accent is genuinely needed. When Carbon outputs `custom_svg_overlay` or full `svg_vector` markup:
- Root element MUST be `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">`.
- Permitted elements ONLY: `<svg>`, `<g>`, `<defs>`, `<pattern>`, `<linearGradient>`, `<radialGradient>`, `<stop>`, `<clipPath>`, `<mask>`, `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`, `<text>`, `<tspan>`.
- **STRICTLY FORBIDDEN**: `<script>`, `<foreignObject>`, `<iframe>`, `<image>` with external URLs, `on*` event attributes, `javascript:` or `data:text/html` URIs.
- Palette: Strictly monochrome manga inks (`#09090b`, `#18181f`, `#3f3f46`, `#a1a1aa`, `#f6f3ea`, `#ffffff`) plus at most one optional subtle crimson accent (`#e11d48`) only if requested for climax stamps.
