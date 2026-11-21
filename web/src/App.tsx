import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { InkPeelModal } from './components/InkPeelModal'
import { LandingPage } from './components/LandingPage'
import { MangaReader } from './components/MangaReader'
import { Navbar, type HomeSection, type View } from './components/Navbar'
import { PipelineLoader } from './components/PipelineLoader'
import { ReaderControls } from './components/ReaderControls'
import { TipOffStudio } from './components/TipOffStudio'
import { storyboardPanels } from './lib/format'
import { generateManga, wait, type JobResult } from './lib/jobs'
import type { MangaPanelData, ReadingDirection } from './types/manga'

interface PendingJob {
  stage: number
  demo: boolean
  name: string
}

type Chapter = JobResult & { demo: boolean; notice?: string }

function clearAnchor() {
  const { history, location } = window
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search)
}

export function App() {
  const content = useRef<HTMLElement>(null)
  const active = useRef<AbortController | null>(null)
  const [view, setView] = useState<View>(() => /^\/studio\/?$/.test(window.location.pathname) ? 'studio' : 'home')
  const [file, setFile] = useState<File | null>(null)
  const [focus, setFocus] = useState('')
  const [direction, setDirection] = useState<ReadingDirection>('rtl')
  const [judge, setJudge] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [position, setPosition] = useState(0)
  const [panel, setPanel] = useState<MangaPanelData | null>(null)
  const [pending, setPending] = useState<PendingJob | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [error, setError] = useState('')
  const total = chapter ? storyboardPanels(chapter.story).length : 0

  useLayoutEffect(() => {
    const [navigation] = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navigation?.type === 'reload') {
      window.history.scrollRestoration = 'manual'
      clearAnchor()
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }

    const anchor = window.location.hash.slice(1)
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: 'instant' })
  }, [])

  useEffect(() => () => active.current?.abort(), [])

  const movePosition = useCallback((move: number) => {
    setPosition((value) => Math.max(0, Math.min(total, value + move)))
  }, [total])

  function focusMain(scroll = true) {
    window.requestAnimationFrame(() => {
      if (scroll) window.scrollTo({ top: 0, behavior: 'instant' })
      content.current?.focus({ preventScroll: true })
    })
  }

  function stopJob() {
    active.current?.abort()
    active.current = null
    setPending(null)
  }

  function goHome(section?: HomeSection) {
    stopJob()
    setPanel(null)
    setView('home')
    if (section) {
      window.history.replaceState(window.history.state, '', '#' + section)
      window.requestAnimationFrame(() => {
        const target = document.getElementById(section)
        target?.focus({ preventScroll: true })
        target?.scrollIntoView()
      })
    } else {
      clearAnchor()
      focusMain()
    }
  }

  function goReader() {
    if (!chapter || view === 'reader') return
    stopJob()
    clearAnchor()
    setView('reader')
    focusMain()
  }

  function toggleReveal() {
    if (!reveal) {
      setPosition(0)
      focusMain(false)
    }
    setReveal(!reveal)
  }

  async function start() {
    if (active.current || !file) return
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    setError('')
    setPending({ stage: 0, demo: false, name: file.name })
    setView('loading')
    clearAnchor()
    focusMain()

    function updateStage(stage: number) {
      if (signal.aborted) return
      setPending((current) => current ? { ...current, stage: Math.max(current.stage, stage) } : current)
    }

    try {
      const next: Chapter = {
        ...await generateManga(file, focus.trim(), direction, updateStage, signal),
        demo: false,
      }
      updateStage(4)
      await wait(550, signal)
      setChapter(next)
      setPosition(0)
      setPanel(null)
      setView('reader')
      focusMain()
    } catch (failure) {
      if (!signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Something interrupted the job. Try again.')
        goHome('upload-game')
      }
    } finally {
      if (active.current === controller) {
        active.current = null
        setPending(null)
      }
    }
  }

  return (
    <>
      <Navbar view={view} hasChapter={chapter !== null} onHome={goHome} onReader={goReader} />
      <main ref={content} id="main-content" tabIndex={-1}>
        {view === 'home' && <LandingPage file={file} focus={focus} error={error}
          onFile={(value) => { setFile(value); setError('') }} onFocus={setFocus}
          onSubmit={() => void start()} />}
        {view === 'studio' && <TipOffStudio file={file} focus={focus} error={error}
          onFile={(value) => { setFile(value); setError('') }} onFocus={setFocus}
          onSubmit={() => void start()} />}
        {view === 'loading' && pending && <PipelineLoader stage={pending.stage} demo={pending.demo} filename={pending.name}
          onCancel={() => goHome('upload-game')} />}
        {view === 'reader' && chapter && <>
          <div className="content-shell">
            <ReaderControls direction={direction} judge={judge} reveal={reveal}
              onDirection={setDirection} onJudge={() => setJudge(!judge)} onReveal={toggleReveal} />
          </div>
          <MangaReader story={chapter.story} metrics={chapter.metrics} direction={direction} judge={judge}
            reveal={reveal} position={position} demo={chapter.demo} notice={chapter.notice ?? ''} modalOpen={panel !== null}
            onPosition={movePosition} onOpen={setPanel} />
        </>}
      </main>
      {panel && chapter && <InkPeelModal key={panel.panel_id} panel={panel} demo={chapter.demo} onClose={() => setPanel(null)} />}
    </>
  )
}
