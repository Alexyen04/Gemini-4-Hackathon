// Frontend mirror of AGENTS.md §5 data contracts (schemas/models.py is canonical).

export type CandidateCategory = 'action' | 'story_emotion'
export type EmotionalTone = 'intense' | 'tense' | 'triumphant' | 'frustrated' | 'stunned' | 'calm'

export interface VerbatimQuote {
  text: string
  timestamp_sec: number
}

export interface CandidateBeat {
  candidate_id: string
  category: CandidateCategory
  start_sec: number
  end_sec: number
  peak_sec: number
  description: string
  players_involved: string[]
  score_context: string
  verbatim_quotes: VerbatimQuote[]
  emotional_tone: EmotionalTone
}

export interface SegmentOutput {
  segment_id: string
  start_sec: number
  end_sec: number
  game_state_summary: string
  candidates: CandidateBeat[]
}

export interface CandidateScores {
  action_spectacle: number
  narrative_leverage: number
  user_focus_match: number
  visual_clarity: number
  composite_story_rank: number
}

export type CastingQuadrant = 'climax_candidate' | 'swagger_montage' | 'emotional_beat' | 'drop'

export interface ScoredCandidate extends CandidateBeat {
  keyframe_path: string
  scores: CandidateScores
  casting_quadrant: CastingQuadrant
}

export type LayoutTemplate = 'opening_4panel' | 'tension_5panel' | 'climax_splash_4panel' | 'aftermath_3panel'
export type PanelSlot = 'top_wide' | 'mid_left' | 'mid_right' | 'slant_left' | 'splash_hero' | 'bottom_strip'
export type NarrativeRole =
  | 'setup'
  | 'dominance'
  | 'struggle'
  | 'tension_pause'
  | 'turning_point'
  | 'escalation'
  | 'climax'
  | 'aftermath'
export type VisualIntensity = 'quiet' | 'medium' | 'explosive'
export type CropFocus = 'full_action' | 'tight_face' | 'hoop_and_ball' | 'scoreboard' | 'bench_reaction'
export type InkMethod = 'opencv_deterministic' | 'nano_banana_verified'

export interface MangaPanel {
  panel_id: string
  reading_order: number
  slot: PanelSlot
  candidate_id: string
  narrative_role: NarrativeRole
  visual_intensity: VisualIntensity
  crop_focus: CropFocus
  action_bbox_norm: [number, number, number, number]
  narration_box: string | null
  caption_quote: VerbatimQuote | null
  thought_bubble: { subject: string; text: string; grounding_cue: string } | null
  sfx: { text: string; katakana: string; style: 'sharp' | 'heavy' | 'quiet' | 'none' } | null
  effects: { speed_lines: 'none' | 'radial' | 'directional'; impact_burst: boolean }
  assets: { panel_image_url: string; source_frame_url: string; source_clip_url: string }
  provenance: {
    timestamp_sec: number
    ink_method: InkMethod
    edge_iou: number
    decision_fidelity_score: number
    scores: Pick<CandidateScores, 'action_spectacle' | 'narrative_leverage' | 'user_focus_match'>
  }
}

export interface MangaPage {
  page_number: number
  layout_template: LayoutTemplate
  panels: MangaPanel[]
}

export interface MangaStoryboard {
  job_id: string
  title: string
  subtitle: string
  user_focus: string
  reading_direction: 'rtl' | 'ltr'
  arc_summary: string
  pages: MangaPage[]
}
