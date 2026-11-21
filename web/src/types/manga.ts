export type ReadingDirection = 'rtl' | 'ltr'
export type LayoutTemplate = 'opening_4panel' | 'tension_5panel' | 'climax_splash_4panel' | 'aftermath_3panel' | 'source_layout'
export type PanelSlot = 'top_wide' | 'mid_left' | 'mid_right' | 'slant_left' | 'splash_hero' | 'bottom_strip'
export type NarrativeRole = 'setup' | 'dominance' | 'struggle' | 'tension_pause' | 'turning_point' | 'escalation' | 'climax' | 'aftermath'
export type InkMethod = 'opencv_deterministic' | 'nano_banana_verified' | 'hybrid' | 'svg_vector' | 'frame_guided'
export type BoundingBox = [ymin: number, xmin: number, ymax: number, xmax: number]

export interface MangaStoryboard {
  job_id: string
  title: string
  subtitle: string
  user_focus: string
  reading_direction: ReadingDirection
  arc_summary: string
  pages: MangaPageData[]
}

export interface MangaPageData {
  page_number: number
  layout_template: LayoutTemplate
  panels: MangaPanelData[]
  source_direction?: ReadingDirection
}

export interface MangaPanelData {
  panel_id: string
  reading_order: number
  slot: PanelSlot
  layout?: { x: number; y: number; width: number; height: number }
  candidate_id: string
  narrative_role: NarrativeRole
  visual_intensity: 'quiet' | 'medium' | 'explosive'
  crop_focus: 'full_action' | 'tight_face' | 'hoop_and_ball' | 'scoreboard' | 'bench_reaction'
  action_bbox_norm: BoundingBox | null
  narration_box: string
  caption_quote: { text: string; timestamp_sec: number } | null
  thought_bubble?: { subject: string; text: string; grounding_cue: string } | null
  sfx: { text: string; katakana?: string; style: 'sharp' | 'heavy' | 'quiet' | 'none' }
  effects: { speed_lines: 'none' | 'radial' | 'directional'; impact_burst: boolean }
  assets: { panel_image_url: string; source_frame_url?: string; source_clip_url?: string }
  provenance: {
    timestamp_sec: number
    ink_method: InkMethod
    edge_iou: number | null
    decision_fidelity_score: number | null
    scores: { action_spectacle: number; narrative_leverage: number; user_focus_match: number } | null
  }
}

export interface JobMetrics {
  duration_sec?: number
  beats_scouted?: number
}
