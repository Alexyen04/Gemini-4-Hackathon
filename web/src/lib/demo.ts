import fixture from '../mock/sample_manga.json'
import type { MangaPanelData, MangaStoryboard } from '../types/manga'
import type { JobResult } from './jobs'

export type PresetId = 'comeback' | 'hard' | 'defense'

export const presets: { id: PresetId; title: string; description: string; focus: string }[] = [
  { id: 'comeback', title: 'Standard: Fourth-quarter comeback', description: 'Follow No. 23 through the closing run.', focus: 'Follow #23 in the fourth-quarter comeback' },
  { id: 'hard', title: 'Hard input: Shaky full-quarter clip', description: 'Sample a noisy quarter with few clear beats.', focus: 'Follow the clearest moments in a shaky fourth-quarter recording' },
  { id: 'defense', title: 'Alternate focus: Defense & reactions', description: 'Follow the defender and bench in the same clip.', focus: 'Follow defense and coach reactions' },
]

export const sample = fixture as MangaStoryboard

export function demoResult(id: PresetId): JobResult {
  if (id === 'comeback') return { story: sample, metrics: { duration_sec: 142, beats_scouted: 18 } }

  const [opening, finish] = sample.pages
  const [court, composure, freeThrow, steal] = opening.panels
  const [layup, coach, celebrate] = finish.panels
  const defender: MangaPanelData = {
    ...composure,
    candidate_id: 'seg_01_defender',
    crop_focus: 'tight_face',
    narration_box: 'The defender looks upcourt.',
    action_bbox_norm: [0.03, 0.16, 0.93, 0.82],
    assets: { panel_image_url: '/demo/defender-ink.webp', source_frame_url: '/demo/defender.webp' },
    provenance: {
      timestamp_sec: 61.8,
      ink_method: 'opencv_deterministic',
      edge_iou: 0.96,
      decision_fidelity_score: 0.99,
      scores: { action_spectacle: 0.18, narrative_leverage: 0.78, user_focus_match: 0.9 },
    },
  }

  const alternate = id === 'defense'
  const preset = presets.find((option) => option.id === id)!
  const panels = alternate
    ? [court, composure, freeThrow, defender, steal, coach, celebrate]
    : [court, composure, defender, steal, layup, coach, celebrate]
  const slots: MangaPanelData['slot'][] = ['top_wide', 'mid_right', 'slant_left', 'bottom_strip', 'splash_hero', 'mid_right', 'mid_left']

  const cast = panels.map((panel, index): MangaPanelData => {
    const scores = panel.provenance.scores && { ...panel.provenance.scores }
    if (alternate && scores) {
      if (panel === coach) scores.user_focus_match = 0.99
      if (panel === defender || panel === steal) scores.user_focus_match = 0.98
    }
    return {
      ...panel,
      panel_id: 'p' + (index < 4 ? '1_' + (index + 1) : '2_' + (index - 3)),
      reading_order: index + 1,
      slot: slots[index],
      narrative_role: index === 4 ? 'climax' : index === 3 && alternate ? 'escalation' : panel.narrative_role,
      // The hard preset omits quotes because of the simulated audio quality.
      caption_quote: alternate ? panel.caption_quote : null,
      provenance: { ...panel.provenance, scores },
    }
  })

  return {
    story: {
      ...sample,
      job_id: 'demo-' + id,
      title: alternate ? 'The Stop Before the Storm' : 'Through the Noise',
      subtitle: alternate ? 'Chapter 01 · From the sideline' : 'Chapter 01 · A crowded fourth quarter',
      user_focus: preset.focus,
      arc_summary: alternate
        ? 'The same closing sequence follows the defender, the turnover, and the coach on the bench.'
        : 'In a noisy quarter, the camera catches a few clear moments from the line to the rim.',
      pages: [
        { ...opening, panels: cast.slice(0, 4) },
        { ...finish, panels: cast.slice(4) },
      ],
    },
    metrics: { duration_sec: alternate ? 142 : 602, beats_scouted: alternate ? 18 : 26 },
  }
}
