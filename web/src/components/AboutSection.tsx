import { motion, useReducedMotion } from 'framer-motion'
import { EditorialPanel } from './EditorialPanel'

const pipeline = [
  { image: 'court-ink.webp', label: '01 · FFmpeg', title: 'Adaptive Chunking', text: 'Overlapping clips preserve play context.' },
  { image: 'steal-ink.webp', label: '02 · Gemini 4 Argon', title: 'Parallel Scout', text: 'Extracts plays, quotes & bounding boxes.' },
  { image: 'free-throw-ink.webp', label: '03 · Gemini Decision 1', title: '2-Axis Ranker', text: 'Scores Action vs. Narrative Leverage.' },
  { image: 'layup-ink.webp', label: '04 · Gemini 4 Carbon', title: 'Director & Ink', text: 'Casts the arc & inks real frames.' },
]

export function AboutSection() {
  const reduced = useReducedMotion()
  return (
    <section id="how-it-works" className="about-section" aria-labelledby="about-title" tabIndex={-1}>
      <div className="content-shell">
        <header className="landing-heading evaluation-heading">
          <div className="eyebrow"><span /> Gemini 4 Pipeline</div>
          <h2 id="about-title">From footage to story.</h2>
        </header>
        <ol className="pipeline-comic">
          {pipeline.map((panel) => (
            <motion.li key={panel.title} initial={reduced ? false : { y: 14, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, amount: 0.15 }}>
              <EditorialPanel {...panel} />
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
