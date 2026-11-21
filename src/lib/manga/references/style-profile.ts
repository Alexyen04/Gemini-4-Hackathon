import { z } from "zod";

export const REFERENCE_TAGS = [
  "dunk",
  "jump_shot",
  "dribbling",
  "passing",
  "defensive_block",
  "perimeter_defense",
  "sprint_fastbreak",
  "confrontation",
  "closeup",
  "extreme_closeup",
  "low_angle",
  "high_angle",
  "dutch_angle",
  "determination",
  "shock",
  "triumph",
  "exhaustion",
  "impact_lines",
  "speed_lines",
  "dramatic_splash",
  "suspense",
  "character_reaction",
] as const;

export const ReferenceTagSchema = z.enum(REFERENCE_TAGS);
export type ReferenceTag = z.infer<typeof ReferenceTagSchema>;

export const ActionCompositionGuideSchema = z.object({
  camera_angles: z.string(),
  body_language: z.string(),
  movement_effects: z.string(),
  panel_composition: z.string(),
});
export type ActionCompositionGuide = z.infer<
  typeof ActionCompositionGuideSchema
>;

export const ReferenceSourceCitationSchema = z.object({
  chapter_id: z.string(),
  page_id: z.string(),
  relative_path: z.string(),
});
export type ReferenceSourceCitation = z.infer<
  typeof ReferenceSourceCitationSchema
>;

export const MangaVisualStyleProfileSchema = z.object({
  profile_id: z.string().default("basketball_manga_reference"),
  profile_version: z.number().int().min(1).default(1),
  source_directory: z.string().default("data/manga_refs/"),
  fingerprint_hash: z.string(),
  generated_at: z.string(),
  analyzed_by_model: z.string(),
  is_builtin_fallback: z.boolean().default(false),
  warning: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.9),
  general_style_description: z.string(),

  visual_style: z.object({
    linework: z.string(),
    shading: z.string(),
    anatomy: z.string(),
    facial_expressions: z.string(),
    motion_effects: z.string(),
    camera_style: z.string(),
  }),

  storytelling: z.object({
    reading_direction: z.enum(["rtl", "ltr"]).default("rtl"),
    action_pacing: z.string(),
    climax_emphasis: z.string(),
  }),

  // Analysis A: Character Art
  character_art: z.object({
    proportions: z.string(),
    anime_facial_structures: z.string(),
    expressive_eyes: z.string(),
    hair_rendering: z.string(),
    muscle_definition: z.string(),
    jersey_folds: z.string(),
    movement_poses: z.string(),
    emotional_expressions: z.string(),
    facial_shading: z.string(),
  }),

  // Analysis B: Linework and Shading
  linework_and_shading: z.object({
    g_pen_linework: z.string(),
    brush_stroke_variation: z.string(),
    contour_thickness: z.string(),
    crosshatching: z.string(),
    screentones: z.string(),
    halftone_shading: z.string(),
    shadow_intensity: z.string(),
    black_white_contrast: z.string(),
    background_simplification: z.string(),
    texture_density: z.string(),
    recommended_ink_contrast: z.number().min(0.45).max(1.0).default(0.86),
    recommended_shadow_density: z.number().min(0.2).max(0.9).default(0.58),
    recommended_screentone_density: z.number().min(0.05).max(0.8).default(0.4),
  }),

  // Analysis C: Basketball Action
  basketball_action: z.object({
    shooting: ActionCompositionGuideSchema,
    dunking: ActionCompositionGuideSchema,
    dribbling: ActionCompositionGuideSchema,
    passing: ActionCompositionGuideSchema,
    blocking: ActionCompositionGuideSchema,
    defending: ActionCompositionGuideSchema,
    sprinting: ActionCompositionGuideSchema,
    player_confrontations: ActionCompositionGuideSchema,
    crowd_reactions: ActionCompositionGuideSchema,
  }),

  // Analysis D: Manga Layouts
  manga_layouts: z.object({
    typical_panel_count: z.number().min(1).max(7).default(4),
    panel_dimensions: z.string(),
    panel_arrangement: z.string(),
    reading_direction: z.enum(["rtl", "ltr"]).default("rtl"),
    gutter_spacing: z.string(),
    borderless_panels: z.string(),
    splash_pages: z.string(),
    diagonal_panels: z.string(),
    visual_hierarchy: z.string(),
  }),

  // Analysis E: Narrative Pacing
  narrative_pacing: z.object({
    beat_sequence_pattern: z.array(z.string()).min(3),
    panel_size_escalation: z.string(),
    camera_angle_transitions: z.string(),
    suspense_building: z.string(),
  }),

  // Analysis F: Anime-Inspired Visual Language
  anime_visual_language: z.object({
    exaggerated_expressions: z.string(),
    dramatic_foreshortening: z.string(),
    dynamic_perspective: z.string(),
    speed_lines: z.string(),
    impact_bursts: z.string(),
    strong_silhouettes: z.string(),
    dramatic_shadows: z.string(),
    emotional_closeups: z.string(),
    cinematic_framing: z.string(),
    sound_effect_treatment: z.string(),
  }),

  reference_sources: z.array(ReferenceSourceCitationSchema).default([]),
});

export type MangaVisualStyleProfile = z.infer<
  typeof MangaVisualStyleProfileSchema
>;

export const ReferenceIndexedItemSchema = z.object({
  item_id: z.string(),
  chapter_id: z.string(),
  page_id: z.string(),
  panel_index: z.number().int().min(0).nullable(),
  item_type: z.enum(["page", "panel"]),
  internal_image_path: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspect_ratio: z.number().positive(),
  ink_ratio: z.number().min(0).max(1),
  edge_density: z.number().min(0).max(1),
  tags: z.array(ReferenceTagSchema),
  action_summary: z.string(),
  composition_takeaway: z.string(),
  camera_and_lighting_note: z.string(),
});
export type ReferenceIndexedItem = z.infer<typeof ReferenceIndexedItemSchema>;

export const MangaReferenceIndexSchema = z.object({
  index_version: z.number().int().default(1),
  fingerprint_hash: z.string(),
  generated_at: z.string(),
  chapter_ids: z.array(z.string()),
  total_pages_discovered: z.number().int().min(0),
  total_panels_extracted: z.number().int().min(0),
  items: z.array(ReferenceIndexedItemSchema),
});
export type MangaReferenceIndex = z.infer<typeof MangaReferenceIndexSchema>;

/**
 * Returns the transparent built-in baseline style profile used ONLY when
 * `data/manga_refs/` contains no reference chapters yet. Explicitly sets
 * `is_builtin_fallback: true` and never fabricates fake chapter citations.
 */
export function buildBuiltinFallbackStyleProfile(
  fingerprintHash: string,
  warningMessage: string | null
): MangaVisualStyleProfile {
  return {
    profile_id: "basketball_manga_builtin_guidelines",
    profile_version: 1,
    source_directory: "data/manga_refs/",
    fingerprint_hash: fingerprintHash,
    generated_at: new Date().toISOString(),
    analyzed_by_model: "builtin-basketball-manga-skill (no local reference files)",
    is_builtin_fallback: true,
    warning: warningMessage,
    confidence: 0.75,
    general_style_description:
      "Built-in high-energy shonen sports manga and anime baseline emphasizing sharp ink contours, dynamic foreshortening, expressive eye focus, 45-degree screentones, and multi-beat basketball action pacing.",
    visual_style: {
      linework: "expressive_ink",
      shading: "screentones_and_deep_shadows",
      anatomy: "grounded_anime",
      facial_expressions: "highly_expressive",
      motion_effects: "dynamic",
      camera_style: "cinematic",
    },
    storytelling: {
      reading_direction: "rtl",
      action_pacing: "multi_panel",
      climax_emphasis: "large_panels",
    },
    character_art: {
      proportions:
        "Lean, springy athletic shonen proportions with elongated limbs during airborne extensions",
      anime_facial_structures:
        "Defined jawlines, sharp brow ridges, and crisp nose bridge shadow wedges",
      expressive_eyes:
        "High-contrast irises with bright pinpoint focus highlights during clutch plays",
      hair_rendering:
        "Distinct silhouette locks with motion-swept tips trailing opposite player velocity",
      muscle_definition:
        "Selective calf, deltoid, and forearm tension lines without over-hatching",
      jersey_folds:
        "Sharp diagonal tension creases radiating from shoulder and waist pivot points",
      movement_poses:
        "Deep knee bend on drives, exaggerated spine arch on dunks and fadeaways",
      emotional_expressions:
        "Narrowed determined eyes, clenched grit on contact, cathartic roar on finishes",
      facial_shading:
        "Bold upper-brow kage shadow bands during high-pressure moments",
    },
    linework_and_shading: {
      g_pen_linework:
        "Crisp variable-taper G-pen strokes with heavier outer silhouette separation",
      brush_stroke_variation:
        "Dry-brush energetic accents on explosive jumps and blocks",
      contour_thickness:
        "Bold foreground athlete contours paired with thin simplified court lines",
      crosshatching:
        "Focused directional hatching beneath chin, ribcage, and rim shadow",
      screentones:
        "45-degree dot screentones differentiating dark road uniforms and arena depth",
      halftone_shading:
        "Graduated midtone dot matrices for dramatic spotlight falloff",
      shadow_intensity: "Deep sumi-black shadow anchors for grounded physical weight",
      black_white_contrast:
        "High-contrast figure-ground separation with white rim-light halos",
      background_simplification:
        "Bleach upper-arena clutter to stark white or speed-line voids during peak action",
      texture_density: "Clean skin/court highlights balanced against textured uniforms",
      recommended_ink_contrast: 0.86,
      recommended_shadow_density: 0.58,
      recommended_screentone_density: 0.4,
    },
    basketball_action: {
      shooting: {
        camera_angles: "Extreme closeup on eyes -> low-angle release -> behind-shooter arc",
        body_language: "Squared shoulders, high elbow, crisp wrist snap follow-through",
        movement_effects: "Stark white negative space around airborne ball, crisp SWISH!",
        panel_composition: "Leave upper vertical headroom for ball trajectory tension",
      },
      dunking: {
        camera_angles: "Dramatic low-angle worms-eye view beneath the rim",
        body_language: "Full vertical extension, ball cocked back or slamming through iron",
        movement_effects: "Converging radial focus lines + perimeter impact flash needles",
        panel_composition: "Large or splash showcase breaking visual containment",
      },
      dribbling: {
        camera_angles: "Low floor-level Dutch-tilted medium shot",
        body_language: "Low center of gravity, sharp ankle/shin angle, probing off-hand",
        movement_effects: "Diagonal speed streaks and curved crossover blur arcs",
        panel_composition: "Horizontal or diagonal panel leading in reading direction",
      },
      passing: {
        camera_angles: "Dynamic foreshortened perspective along the pass vector",
        body_language: "Whipped torso rotation, outstretched fingers pointing down-court",
        movement_effects: "Sharp horizontal speed lines cutting across panel width",
        panel_composition: "Wide strip connecting passer and target cutter",
      },
      blocking: {
        camera_angles: "Side-profile or low-angle apex collision framing",
        body_language: "Towering verticality, fingertips meeting leather at peak height",
        movement_effects: "Explosive radial spikes + SMACK!! impact shockwave",
        panel_composition: "Tall vertical hero panel emphasizing height differential",
      },
      defending: {
        camera_angles: "Tight over-the-shoulder confrontation shot",
        body_language: "Wide base, active hands, intense eye lock on ballhandler's hips",
        movement_effects: "Heavy pressure shadow vignette and sweat droplets",
        panel_composition: "Compressed medium panel conveying claustrophobic pressure",
      },
      sprinting: {
        camera_angles: "Tracking side or 3/4 front low angle",
        body_language: "Forward torso lean, pumping elbows, explosive toe-off",
        movement_effects: "Dense parallel speed-void lines erasing arena background",
        panel_composition: "Horizontal banner strip accelerating page rhythm",
      },
      player_confrontations: {
        camera_angles: "Opposing extreme closeups of eyes",
        body_language: "Unblinking competitive stare, jaw tension",
        movement_effects: "Split diagonal framing with contrasting light/dark tones",
        panel_composition: "Paired narrow panels preceding a major duel",
      },
      crowd_reactions: {
        camera_angles: "Wide courtside bench sweep or compact reaction inset",
        body_language: "Leaping teammates, raised fists, stunned silence",
        movement_effects: "Upward roar lettering (ROAAAAR!!) and radial highlights",
        panel_composition: "Compact supporting panel anchoring emotional aftermath",
      },
    },
    manga_layouts: {
      typical_panel_count: 4,
      panel_dimensions:
        "Contrast small 10-15% tension closeups with 45-65% dominant climax panels",
      panel_arrangement:
        "Asymmetric tiers alternating multi-column buildup with full-width action",
      reading_direction: "rtl",
      gutter_spacing: "Crisp 2% white gutters with bold black ink frames",
      borderless_panels: "Use on peak climax moments for emotional release",
      splash_pages: "Reserve full-page splashes for decisive game-winners",
      diagonal_panels: "Apply subtle Dutch tilts and diagonal motion vectors on drives",
      visual_hierarchy: "Every page features one unmistakable focal anchor panel",
    },
    narrative_pacing: {
      beat_sequence_pattern: [
        "establishing_stakes",
        "eye_anticipation_closeup",
        "explosive_movement",
        "airborne_suspense",
        "rim_climax_impact",
        "emotional_reaction",
      ],
      panel_size_escalation:
        "Compress buildup into tight small/medium panels before expanding into a large climax frame",
      camera_angle_transitions:
        "Alternate wide spatial context -> extreme eye closeup -> low-angle apex",
      suspense_building:
        "Insert a silent negative-space beat right before the decisive shot drops",
    },
    anime_visual_language: {
      exaggerated_expressions:
        "Heightened brow shadows, luminous focus eyes, expressive grit",
      dramatic_foreshortening:
        "Enlarge foreground basketball or reaching hand to pull viewer into court action",
      dynamic_perspective:
        "Steep 3-point low-angle court convergence toward the basket",
      speed_lines:
        "Tapered sumi-ink streaks with white knockout highlights preserving central subject clarity",
      impact_bursts:
        "Sharp perimeter flash needles radiating from dunk/block contact",
      strong_silhouettes:
        "Clean white rim-lighting separating dark hair/jerseys from arena shadows",
      dramatic_shadows: "Crisp cel-like shadow boundaries rather than muddy gray blur",
      emotional_closeups: "Tight crops on eyes and sweat droplets at crunch time",
      cinematic_framing: "Rule-of-thirds athlete placement with open ball-flight space",
      sound_effect_treatment:
        "Bold italicized English + katakana sub-glyphs integrated along motion arcs",
    },
    reference_sources: [],
  };
}
