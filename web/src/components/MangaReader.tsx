import { useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { BookOpen, Crosshair, Layers2, ScanLine } from 'lucide-react'
import { storyboardPanels } from '../lib/format'
import type { JobMetrics, MangaPanelData, MangaStoryboard, ReadingDirection } from '../types/manga'
import { MangaPage } from './MangaPage'

interface ReaderProps {
  story: MangaStoryboard
  metrics?: JobMetrics
  direction: ReadingDirection
  judge: boolean
  reveal: boolean
  position: number
  demo: boolean
  notice: string
  modalOpen: boolean
  onPosition: (move: number) => void
  onOpen: (panel: MangaPanelData) => void
}

export function MangaReader({ story, metrics, direction, judge, reveal, position, demo, notice, modalOpen, onPosition, onOpen }: ReaderProps) {
  const reduced = useReducedMotion()
  const spread = useRef<HTMLDivElement>(null)
  const sortedPages = useMemo(() => [...story.pages].sort((a, b) => a.page_number - b.page_number), [story])
  const panels = useMemo(() => storyboardPanels(story), [story])
  const revealed = useMemo(() => new Set(panels.slice(0, position).map((panel) => panel.panel_id)), [panels, position])
  const scouted = metrics?.beats_scouted

  useEffect(() => {
    if (!reveal || modalOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
      if (event.key === ' ' && target instanceof HTMLElement && target.closest('button, a')) return
      const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      const backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
      if ([forward, 'ArrowDown', ' '].includes(event.key)) {
        event.preventDefault()
        onPosition(1)
      } else if ([backward, 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        onPosition(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, direction, modalOpen, onPosition])

  useEffect(() => {
    if (!reveal || position < 1) return
    const id = panels[position - 1]?.panel_id
    if (id) spread.current?.querySelector('[data-panel-id="' + CSS.escape(id) + '"]')
      ?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'nearest', inline: 'nearest' })
  }, [position, panels, reduced, reveal])

  return (
    <div className="reader content-shell">
      {notice && <p className="reader-notice" role="status">{notice}</p>}
      <section className="reader-header" aria-labelledby="chapter-title">
        <div>
          <div className="chapter-kicker"><BookOpen size={16} aria-hidden="true" /> {story.subtitle || 'Manga chapter'}</div>
          <h1 id="chapter-title">{story.title}</h1>
          {story.arc_summary && <p className="arc-summary">{story.arc_summary}</p>}
        </div>
        <div className="reader-meta">
          {demo && <span className="demo-label">DEMO STORYBOARD</span>}
          {story.user_focus && <p className="focus-tag"><Crosshair size={17} aria-hidden="true" />{story.user_focus}</p>}
          <p><Layers2 size={16} aria-hidden="true" /> {sortedPages.length} {sortedPages.length === 1 ? 'page' : 'pages'} · {panels.length} panels · {direction.toUpperCase()}</p>
        </div>
      </section>
      {judge && <div className="judge-summary">
        <ScanLine size={18} aria-hidden="true" /><strong>Judge mode</strong>
        <span>
          {typeof metrics?.duration_sec === 'number' && <>{Math.round(metrics.duration_sec)}s raw footage <b aria-hidden="true">→</b> </>}
          {typeof scouted === 'number' && <>{scouted} beats scouted <b aria-hidden="true">→</b> </>}
          {panels.length} cast{typeof scouted === 'number' && scouted >= panels.length ? ', ' + (scouted - panels.length) + ' cut' : ''}
        </span>
      </div>}
      <div className="reader-guide"><ScanLine size={17} aria-hidden="true" /> <span>Select a panel to peel back the ink and inspect its source.</span></div>
      {reveal && <section className="reveal-controls" aria-label="Panel reveal controls">
        <div>
          <strong>Panel reveal</strong>
          <small>Use Space or the arrow keys.</small>
        </div>
        <span className="reveal-count" aria-live="polite">{position} / {panels.length} revealed</span>
        <button type="button" className="button button-small" disabled={position === 0} onClick={() => onPosition(-1)}>Previous</button>
        <button type="button" className="button button-primary button-small" disabled={position >= panels.length} onClick={() => onPosition(1)}>{position === panels.length ? 'Complete' : 'Next panel'}</button>
      </section>}
      <div ref={spread} className="manga-spread" dir={direction}>
        {sortedPages.map((page) => <MangaPage key={page.page_number} page={page} direction={direction} judge={judge}
          revealing={reveal} revealed={revealed} onOpen={onOpen} />)}
      </div>
    </div>
  )
}
