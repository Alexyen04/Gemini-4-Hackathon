import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen, Play } from 'lucide-react'
import type { MouseEvent } from 'react'

export type View = 'home' | 'studio' | 'loading' | 'reader'
export type HomeSection = 'how-it-works' | 'upload-game' | 'baseline'

interface NavbarProps {
  view: View
  hasChapter: boolean
  onHome: (section?: HomeSection) => void
  onReader: () => void
}

export function Navbar({ view, hasChapter, onHome, onReader }: NavbarProps) {
  const reduced = useReducedMotion()

  function navLink(event: MouseEvent<HTMLAnchorElement>, section?: HomeSection) {
    if (view === 'home' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onHome(section)
  }

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="header-inner content-shell">
        <a href="#" className="brand" onClick={(event) => navLink(event)} aria-label="COURT//INK home">
          <motion.span className="brand-mark" whileHover={reduced ? undefined : { rotate: -32 }} transition={{ type: 'spring', stiffness: 300 }}>
            <svg viewBox="0 0 32 32" aria-hidden="true" fill="none">
              <circle cx="16" cy="16" r="13" fill="currentColor" stroke="#0a0a0a" strokeWidth="2.2" />
              <path d="M4 17c7.3-3.1 14.6-3.1 24 1M15 3c4 6.8 4 14.9 0 26M7 7c4.3 3.9 5.6 12.4 2.7 19M24.6 6.4c-3.1 6.4-2.4 15 1.1 18" stroke="#0a0a0a" strokeWidth="1.6" />
            </svg>
          </motion.span>
          <span>COURT<span className="brand-slash">//</span>INK</span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#upload-game" onClick={(event) => navLink(event, 'upload-game')}>Upload</a>
          <a href="#how-it-works" onClick={(event) => navLink(event, 'how-it-works')}>Pipeline</a>
          <a href="#baseline" onClick={(event) => navLink(event, 'baseline')}>Evaluation</a>
          {hasChapter && <button type="button" aria-current={view === 'reader' ? 'page' : undefined} onClick={onReader}>
            <BookOpen size={16} aria-hidden="true" /> Manga Reader
          </button>}
        </nav>
        <a
          className="button button-primary header-cta"
          href="#upload-game"
          onClick={(event) => navLink(event, 'upload-game')}
        >
          <Play size={15} aria-hidden="true" /> Run Demo
        </a>
      </div>
    </header>
  )
}
