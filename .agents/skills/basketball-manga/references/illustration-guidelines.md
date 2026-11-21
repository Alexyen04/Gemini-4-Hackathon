# Carbon Illustration & SVG Rendering Guidelines

Gemini 4 Carbon (`gemini-4-carbon`) directs all artwork generation through structured `CarbonIllustrationSpec` objects and sanitized `<svg>` vector layers rendered by `HybridMangaRenderer` and `SVGIllustrationRenderer`.

## 1. Three Supported Rendering Modes
1. **`hybrid` *(Primary & Recommended)***:
   - Loads the verified high-resolution keyframe extracted from the basketball clip.
   - Applies Carbon-directed focal cropping (`focal_x`, `focal_y`, `zoom_factor`, `dutch_tilt_deg`), multi-scale Sobel/DoG G-pen ink contour extraction, 4-band monochrome luminance quantization, and selective 45° Ben-Day/manga screentone synthesis.
   - Simplifies distracting crowd clutter outside the action focal zone (`background_mode`: `arena_simplified`, `stark_white_tension`, `speed_void`, or `dark_pressure`).
   - Composites Carbon's custom sanitized `<svg>` scene overlay (motion arcs, radial focus lines, speed streaks, basketball seam highlights, rim/net accents, dramatic ink shadows) into a cohesive PNG/WebP manga panel.
2. **`svg_vector` *(Full Vector Illustration)***:
   - Carbon authors a complete stylized monochrome basketball manga `<svg viewBox="0 0 800 600">` composition (court geometry, stylized player silhouettes, rim/backboard, basketball trajectory, screentone `<pattern>` fills, and dynamic ink bursts), rasterized cleanly via Sharp.
   - Best suited for symbolic tension beats: closeups of a ticking shot clock, spinning leather basketball in negative space, or stark silhouette confrontations.
3. **`frame_guided` *(Pure Grounded Ink & Tone)***:
   - Emphasizes crisp anatomical fidelity from the video keyframe with subtle manga linework and screentone shading when heavy vector overlays would distract.

## 2. Specific vs. Generic Art Direction
Carbon MUST produce event-specific visual specifications:
- **Bad**: `"Draw a player dunking."`
- **Good**: `"Low-angle upward framing centered on #23's right-handed tomahawk finish at (0.58, 0.32). Boost black ink threshold under the extended arm and ribcage jersey folds, bleach upper arena rafters to stark white negative space, project 38 converging radial focus lines from the rim collar, and trace a curved white-cored ink trail following the upward leap."`

## 3. SVG Authoring & Security Constraints
When Carbon outputs `custom_svg_overlay` or full `svg_vector` markup:
- Root element MUST be `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">`.
- Permitted elements ONLY: `<svg>`, `<g>`, `<defs>`, `<pattern>`, `<linearGradient>`, `<radialGradient>`, `<stop>`, `<clipPath>`, `<mask>`, `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`, `<text>`, `<tspan>`.
- **STRICTLY FORBIDDEN**: `<script>`, `<foreignObject>`, `<iframe>`, `<image>` with external URLs, `on*` event attributes, `javascript:` or `data:text/html` URIs.
- Palette: Strictly monochrome manga inks (`#09090b`, `#18181f`, `#3f3f46`, `#a1a1aa`, `#f6f3ea`, `#ffffff`) plus at most one optional subtle crimson accent (`#e11d48`) only if requested for climax stamps.
