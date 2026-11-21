import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AudioLines, BadgeCheck, BookOpen, Check, Film, Image, Layers2, ScanLine, SquareActivity, Zap, X } from 'lucide-react'

const steps = [
  { name: 'FFmpeg', description: 'Adaptive overlapping chunking', icon: Film },
  { name: 'Gemini 4 Argon / Hydrogen', description: 'Parallel scouting for plays, quotes, and frames', icon: Layers2 },
  { name: 'Gemini Decision 1', description: 'Action spectacle and narrative leverage', icon: SquareActivity },
  { name: 'Gemini 4 Carbon', description: 'Kishōtenketsu casting, OpenCV / Nano Banana 2.1, and the Edge-IoU Fidelity Gate', icon: BookOpen },
]

const scoutLanes = [
  { label: 'Plays', icon: Zap },
  { label: 'Quotes', icon: AudioLines },
  { label: 'Frame bounds', icon: ScanLine },
]

function PipelineGraphic({ stage }: { stage: number }) {
  if (stage === 0) {
    return <div className="loading-film" aria-hidden="true">
      <div className="film-track">{[0, 1, 2, 3, 4, 5].map((index) => <span key={index}><Image size={32} /></span>)}</div>
    </div>
  }
  if (stage === 1) {
    return <div className="scout-lanes" aria-hidden="true">{scoutLanes.map(({ label, icon: Icon }) => (
      <div key={label}><Icon size={20} /><strong>{label}</strong><span /></div>
    ))}</div>
  }
  if (stage === 2) {
    return <div className="loading-matrix" aria-hidden="true">
      <span className="matrix-y">Narrative leverage</span>
      <div className="matrix-plot"><i /><i /><i /><i /></div>
      <span className="matrix-x">Action spectacle</span>
    </div>
  }
  if (stage === 3) {
    return <div className="loading-page" aria-hidden="true">
      <div /><div /><div /><BadgeCheck size={40} />
    </div>
  }
  return <div className="loading-ready" aria-hidden="true"><BadgeCheck size={54} /> Chapter Ready — Tip Off!</div>
}

export function PipelineLoader({ stage, demo, filename, onCancel }: {
  stage: number
  demo: boolean
  filename: string
  onCancel: () => void
}) {
  const reduced = useReducedMotion()
  const ready = stage === steps.length
  const status = ready ? 'Chapter ready — tip off!' : 'Step ' + (stage + 1) + ' of ' + steps.length + ': ' + steps[stage].name
  return (
    <div className="content-shell loading-view">
      <section className="loading-card work-card" aria-labelledby="loading-title">
        <div className="loading-top">
          <div className="eyebrow"><span /> {demo ? 'Offline demo playback' : 'Video-to-manga pipeline'}</div>
          <button className="button button-small" type="button" onClick={onCancel}><X size={16} aria-hidden="true" /> Cancel</button>
        </div>
        <h1 id="loading-title">{demo ? 'Loading the demo' : 'Making your manga'}</h1>
        <p className="loading-file">{filename}</p>
        <div className="loading-meter" aria-hidden="true">
          <motion.div animate={{ width: Math.min(stage + 1, steps.length) * 25 + '%' }}
            transition={{ duration: reduced ? 0 : 0.32 }} />
        </div>
        <p className="sr-only" role="status">{status}</p>
        <div className="loading-workspace">
          <ol className="loading-steps">
            {steps.map(({ name, description, icon: Icon }, index) => (
              <li key={name} className={index === stage ? 'is-current' : index < stage ? 'is-complete' : undefined}
                aria-current={index === stage ? 'step' : undefined}>
                <span className="step-icon"><Icon size={20} aria-hidden="true" /></span>
                <span><strong>{name}</strong><small>{description}</small></span>
                {index < stage && <Check size={18} aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <div className={'loading-visual' + (ready ? ' is-ready' : '')}>
            <AnimatePresence mode="wait">
              <motion.div key={stage} className="loading-graphic" initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: reduced ? 0 : 0.17 }}>
                <PipelineGraphic stage={stage} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  )
}
