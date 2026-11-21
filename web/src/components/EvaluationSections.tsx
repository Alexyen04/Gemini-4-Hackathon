import { ArrowUp } from 'lucide-react'
import { sample } from '../lib/demo'
import { humanize, pct, storyboardPanels } from '../lib/format'
import type { MangaPanelData } from '../types/manga'
import { EditorialPanel } from './EditorialPanel'

const fixture = storyboardPanels(sample)
const arcRoles = new Set(['tension_pause', 'turning_point', 'climax'])
const storyBeats = fixture.filter((panel) => arcRoles.has(panel.narrative_role))
const actionBeats = [...fixture]
  .sort((a, b) => (b.provenance.scores?.action_spectacle ?? 0) - (a.provenance.scores?.action_spectacle ?? 0))
  .slice(0, storyBeats.length)
  .sort((a, b) => a.reading_order - b.reading_order)

function BeatSequence({ title, panels }: { title: string; panels: MangaPanelData[] }) {
  const pauses = panels.filter((panel) => panel.narrative_role === 'tension_pause').length
  return (
    <article className="beat-sequence">
      <h3>{title}</h3>
      <p>{pauses} tension {pauses === 1 ? 'beat' : 'beats'}</p>
      <ol>
        {panels.map((panel) => {
          const action = panel.provenance.scores?.action_spectacle ?? 0
          const story = panel.provenance.scores?.narrative_leverage ?? 0
          return (
            <li key={panel.panel_id}>
              <img src={panel.assets.panel_image_url} alt="" loading="lazy" width="540" height="360" />
              <div className="beat-caption">
                <span>{humanize(panel.narrative_role)}</span>
                <div className="beat-scores">
                  <small className="score-pill score-pill-action">Action {pct(action)}</small>
                  <small className="score-pill score-pill-story">Story {pct(story)}</small>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </article>
  )
}

const testCases = [
  { image: 'steal-ink.webp', label: 'Video', title: 'Messy Footage', text: 'Handheld shake, motion blur, replays & pickup angles.' },
  { image: 'court-ink.webp', label: 'Audio', title: 'Noisy Commentary', text: 'Crowd roar, overlapping voices & silent clips.' },
  { image: 'coach-ink.webp', label: 'Prompt', title: 'Shifted Focus', text: 'Same game, different protagonist or bench arc.' },
]

const failures = [
  {
    image: 'defender-ink.webp',
    label: 'Fidelity Gate',
    title: 'AI Inking Drift',
    broke: 'Generative ink altered poses or jersey numbers.',
    fixed: 'Edge-IoU + Decision 1 gate falls back to OpenCV.',
  },
  {
    image: 'free-throw-ink.webp',
    label: '2-Axis Scoring',
    title: 'Highlight Bias',
    broke: 'Single-pass calls picked Q1 dunks over clutch free throws.',
    fixed: 'Split scoring into Action Spectacle × Narrative Leverage.',
  },
  {
    image: 'composure-ink.webp',
    label: 'Audio Grounding',
    title: 'Crowd Noise Quotes',
    broke: 'Overlapping audio caused paraphrased speech bubbles.',
    fixed: 'Enforced verbatim ±2s quotes or silent panels.',
  },
]

export function EvaluationSections() {
  return (
    <>
      <section id="baseline" className="evaluation-section evaluation-baseline" aria-labelledby="baseline-title" tabIndex={-1}>
        <div className="content-shell">
          <header className="landing-heading evaluation-heading">
            <div className="eyebrow"><span /> Baseline vs. COURT//INK</div>
            <h2 id="baseline-title">Storyline beats highlights.</h2>
          </header>
          <div className="beat-comparison" aria-label="Three-panel comparison">
            <BeatSequence title="Highlight-only baseline" panels={actionBeats} />
            <BeatSequence title="COURT//INK story arc" panels={storyBeats} />
          </div>
        </div>
      </section>

      <section id="test-set" className="evaluation-section evaluation-test-set" aria-labelledby="test-set-title">
        <div className="content-shell">
          <header className="landing-heading evaluation-heading">
            <div className="eyebrow"><span /> Real-World Stress Tests</div>
            <h2 id="test-set-title">Built for messy clips.</h2>
          </header>
          <div className="evaluation-case-grid">
            {testCases.map((panel) => <EditorialPanel key={panel.title} {...panel} />)}
          </div>
          <a href="#upload-game" className="button button-primary evaluation-cta">
            <ArrowUp size={17} aria-hidden="true" /> Test Your Own Clip
          </a>
        </div>
      </section>

      <section id="failure-modes" className="evaluation-section evaluation-failures" aria-labelledby="failure-modes-title">
        <div className="content-shell">
          <header className="landing-heading evaluation-heading">
            <div className="eyebrow"><span /> Engineering Fixes</div>
            <h2 id="failure-modes-title">Where it broke &amp; what changed.</h2>
          </header>
          <div className="failure-comic">
            {failures.map((item) => (
              <article key={item.title} className="editorial-panel">
                <div className="editorial-panel-art">
                  <img src={'/demo/' + item.image} alt="" loading="lazy" width="540" height="360" />
                  <span className="editorial-panel-label">{item.label}</span>
                </div>
                <div className="editorial-panel-caption failure-caption">
                  <h3>{item.title}</h3>
                  <div className="failure-badges">
                    <p className="failure-row failure-broke"><strong>Broke:</strong> {item.broke}</p>
                    <p className="failure-row failure-fixed"><strong>Fixed:</strong> {item.fixed}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
