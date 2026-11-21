import { useEffect, useRef, useState } from 'react'
import { gsap, INK, useGSAP, MOTION_OK, prefersReducedMotion } from '../lib/motion'
import { MediaSlot } from '../components/MediaSlot'
import { ChapterTag } from '../components/ChapterTag'
import { useInView } from '../components/useMediaExists'
// peel-raw.jpg is hero.mp4 at 3.0s; peel-ink.jpg is that exact frame, deterministically inked.
// Only facts we can stand behind: no scores until the pipeline produces real ones.
const SOURCE_SEC = 3.0
const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${(sec % 60).toFixed(1).padStart(4, '0')}`
const ink = 'deterministic'
const PROVENANCE = `t=${fmt(SOURCE_SEC)} · src=hero.mp4 · source frame`

const LENS = 120

export function InkPeel() {
  const root = useRef<HTMLElement>(null)
  const [viewRef, inView] = useInView<HTMLDivElement>('0px')
  const [active, setActive] = useState(false)
  const [peeled, setPeeled] = useState(false)
  const press = useRef<number | undefined>(undefined)

  const setVar = (props: Record<string, string | number>) => {
    const el = viewRef.current
    if (!el) return
    if (prefersReducedMotion()) gsap.set(el, props)
    else gsap.to(el, { ...props, duration: 0.45, ease: INK, overwrite: 'auto' })
  }

  const peel = (on: boolean) => {
    setPeeled(on)
    setVar({ '--r': on ? '150%' : active ? `${LENS}px` : '0px' })
  }

  // Hold Space to peel fully (only while the section is on screen)
  useEffect(() => {
    if (!inView) return
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      peel(true)
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && peel(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap
          .timeline({ defaults: { ease: INK }, scrollTrigger: { trigger: root.current, start: 'top 65%', toggleActions: 'play none none reverse' } })
          .from('.peel-h', { clipPath: 'inset(0 100% 0 0)', duration: 0.5 })
          .from('.peel-panel', { clipPath: 'inset(0 0 100% 0)', duration: 0.6 }, '<0.1')
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    gsap.set(e.currentTarget, { '--x': `${e.clientX - r.left}px`, '--y': `${e.clientY - r.top}px` })
  }

  const showStrip = active || peeled

  return (
    <section ref={root} aria-labelledby="peel-h" className="relative bg-paper px-4 py-14 md:px-8 md:py-28">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <ChapterTag n="03" />
          <h2 id="peel-h" className="peel-h display text-[clamp(52px,8vw,140px)]">
            Every panel traces back.
          </h2>
        </div>
        <span className="mono hidden md:inline">hover · hold space to peel</span>
        <span className="mono md:hidden">drag · long-press to peel</span>
      </div>

      <div className="peel-panel md:ml-[6vw]" style={{ filter: 'drop-shadow(8px 8px 0 var(--ink))' }}>
        <div
          ref={viewRef}
          tabIndex={0}
          role="img"
          aria-label={`Inked manga panel. Lens reveals the raw source frame at ${fmt(SOURCE_SEC)}.`}
          className="relative aspect-[4/5] w-full cursor-none touch-none border-4 border-ink bg-ink outline-none select-none focus-visible:ring-4 focus-visible:ring-accent md:aspect-[16/8]"
          style={{ '--x': '50%', '--y': '50%', '--r': '0px', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 3% 100%)' } as React.CSSProperties}
          onPointerEnter={(e) => {
            move(e)
            setActive(true)
            if (!peeled) setVar({ '--r': `${LENS}px` })
          }}
          onPointerMove={move}
          onPointerLeave={() => {
            setActive(false)
            window.clearTimeout(press.current)
            setPeeled(false)
            setVar({ '--r': '0px' })
          }}
          onPointerDown={() => {
            press.current = window.setTimeout(() => peel(true), 350)
          }}
          onPointerUp={() => {
            window.clearTimeout(press.current)
            if (peeled) peel(false)
          }}
          onFocus={() => setVar({ '--r': `${LENS}px` })}
          onBlur={() => setVar({ '--r': '0px' })}
        >
          {/* inked panel (what the reader sees) */}
          <div className="absolute inset-0">
            <MediaSlot file="peel-ink.jpg" alt="Inked manga panel" label={`ink · ${ink}`} dense />
          </div>
          {/* raw source frame, revealed by the lens */}
          <div className="absolute inset-0" style={{ clipPath: 'circle(var(--r) at var(--x) var(--y))' }}>
            <MediaSlot file="peel-raw.jpg" alt="Raw source frame" label={`raw frame ${fmt(SOURCE_SEC)}`} />
          </div>
          {/* lens ring */}
          <div
            className="pointer-events-none absolute rounded-full border-4 border-ink transition-opacity duration-150"
            style={{
              left: 'var(--x)',
              top: 'var(--y)',
              width: LENS * 2,
              height: LENS * 2,
              transform: 'translate(-50%, -50%)',
              opacity: active && !peeled ? 1 : 0,
              borderRadius: '9999px',
            }}
            aria-hidden
          />
          <span className="reading-num">02</span>
        </div>
      </div>

      <p
        className="mono mt-5 inline-block border-[3px] border-ink bg-accent px-3 py-2 text-on-accent transition-[clip-path] duration-300 md:ml-[6vw]"
        style={{ clipPath: showStrip ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)' }}
        aria-live="polite"
      >
        {PROVENANCE}
      </p>
    </section>
  )
}
