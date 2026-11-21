import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { formatTime } from '../lib/format'
import type { MangaPanelData } from '../types/manga'
import { CourtInkLogo } from './CourtInkLogo'
import { InkPeelSlider } from './InkPeelSlider'
import { PanelEffects, PanelSfx } from './PanelEffects'

const preview = {
  assets: { panel_image_url: '/demo/hero-ink.webp', source_frame_url: '/demo/hero-source.webp' },
  action_bbox_norm: [0.11, 0.10, 0.99, 0.64],
  effects: { speed_lines: 'radial', impact_burst: false },
  sfx: { text: 'WHOOSH!', katakana: 'シュッ', style: 'heavy' },
} satisfies Pick<MangaPanelData, 'assets' | 'action_bbox_norm' | 'effects' | 'sfx'>

const sourceClip = { timestamp: 1.034367, url: 'https://www.pexels.com/video/low-angle-view-of-a-man-playing-basketball-5192077/' }

const tickerItems = [
  'COURT//INK',
  'REAL-FRAME PROVENANCE',
  'STORYLINE > HIGHLIGHTS',
  'GEMINI 4 MULTI-MODEL PIPELINE',
  'ZERO HALLUCINATION',
]

function HeroTicker() {
  const [paused, setPaused] = useState(false)
  const reduced = useReducedMotion()
  return (
    <div className={'hero-ticker' + (paused || reduced ? ' is-paused' : '')}>
      <p className="sr-only">{tickerItems.join(' • ')}</p>
      <div className="ticker-viewport" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1, 2, 3].map((copy) => (
            <div className="ticker-group" key={copy}>
              {tickerItems.map((item) => <span key={item}>{item}<b>✦</b></span>)}
            </div>
          ))}
        </div>
      </div>
      {!reduced && <button type="button" className="ticker-toggle" onClick={() => setPaused(!paused)}
        aria-label={paused ? 'Play ticker' : 'Pause ticker'} title={paused ? 'Play ticker' : 'Pause ticker'}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>}
    </div>
  )
}

export function HeroSection() {
  const reduced = useReducedMotion()
  return (
    <>
      <section className="landing-hero landing-cover" aria-label="COURT//INK opening cover">
        <div className="hero-court" aria-hidden="true" />
        <div className="content-shell cover-main">
          <div className="cover-top-row">
            <div className="eyebrow"><span /> Basketball to Storyline Manga</div>
            <span className="cover-issue">ISSUE 01 // REAL-FRAME PROVENANCE</span>
          </div>

          <CourtInkLogo />

          <motion.div
            className="cover-footer"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: reduced ? 0 : 0.6 }}
          >
            <div className="hero-actions">
              <a className="button button-primary" href="#upload-game">
                <Play size={19} aria-hidden="true" /> Run Demo
              </a>
              <a className="button" href="#story-preview">
                Peel the Ink <ArrowDown size={19} aria-hidden="true" />
              </a>
            </div>
            <a className="cover-scroll-cue" href="#how-it-works">
              Scroll to explore <ArrowDown size={16} aria-hidden="true" />
            </a>
          </motion.div>
        </div>
        <HeroTicker />
      </section>

      <section id="story-preview" className="landing-showcase" aria-labelledby="landing-title" tabIndex={-1}>
        <div className="content-shell hero-main">
          <motion.div className="hero-copy" initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.48 }}>
            <div className="eyebrow"><span /> Interactive Ink Peel</div>
            <h1 id="landing-title">Every game<br />has a <em>story.</em></h1>
            <p>Upload any basketball clip. Every manga panel is inked from a real frame you can inspect.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#upload-game"><Play size={19} aria-hidden="true" /> Upload a Game</a>
            </div>
          </motion.div>
          <motion.div className="hero-preview" initial={reduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.56, delay: reduced ? 0 : 0.08 }}>
            <InkPeelSlider hero assets={preview.assets}
              note={<a className="frame-credit" href={sourceClip.url} target="_blank" rel="noreferrer">Source · {formatTime(sourceClip.timestamp)}</a>}
              inkOverlay={<><PanelEffects panel={preview} /><PanelSfx panel={preview} position={[22, 76]} /></>} />
          </motion.div>
        </div>
      </section>
    </>
  )
}
