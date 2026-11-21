import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { gsap, INK, useGSAP, DESKTOP, MOTION_OK } from '../lib/motion'
import { VISUALS } from '../components/SystemVisuals'
import { ChapterTag } from '../components/ChapterTag'
import system from '../data/system.json'

interface SysPanel {
  id: string
  title: string
  label: string
  in: string
  out: string
  model: string
}
const PANELS = system.panels as SysPanel[]
const LANES = system.lanes

// Snake reading order on desktop: 01 02 03 / 06 05 04
const AREA = [
  'md:col-start-1 md:row-start-1',
  'md:col-start-2 md:row-start-1 md:mt-3',
  'md:col-start-3 md:row-start-1',
  'md:col-start-3 md:row-start-2',
  'md:col-start-2 md:row-start-2 md:-mt-2',
  'md:col-start-1 md:row-start-2',
]
const SLANT: Record<number, string> = {
  1: 'polygon(0 0, 100% 0, 100% 88%, 0 100%)',
  4: 'polygon(0 0, 100% 0, 100% 100%, 0 90%)',
}

interface Geo {
  w: number
  h: number
  arrows: { d: string; head: string }[]
}

function measure(spread: HTMLElement, panels: HTMLElement[]): Geo {
  const s = spread.getBoundingClientRect()
  const r = panels.map((p) => {
    const b = p.getBoundingClientRect()
    return { l: b.left - s.left, t: b.top - s.top, r: b.right - s.left, b: b.bottom - s.top, cx: b.left - s.left + b.width / 2, cy: b.top - s.top + b.height / 2 }
  })
  const arrows = r.slice(0, -1).map((a, i) => {
    const b = r[i + 1]
    const dx = b.cx - a.cx
    const dy = b.cy - a.cy
    const IN = 26 // arrows overlap panel borders, like hand-inked flow marks
    let x1, y1, x2, y2
    if (Math.abs(dx) > Math.abs(dy)) {
      const dir = Math.sign(dx)
      x1 = dir > 0 ? a.r - IN : a.l + IN
      x2 = dir > 0 ? b.l + 10 : b.r - 10
      y1 = a.cy
      y2 = b.cy
    } else {
      const f = s.width >= 860 ? 0.8 : 0.5 // desktop: clear the 2×2 axis label
      x1 = a.l + (a.r - a.l) * f
      x2 = b.l + (b.r - b.l) * f
      y1 = a.b - IN
      y2 = b.t + 6
    }
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    const px = (-(y2 - y1) / len) * 16
    const py = ((x2 - x1) / len) * 16
    const cx = mx + px
    const cy = my + py
    const ul = Math.hypot(x2 - cx, y2 - cy) || 1
    const ux = (x2 - cx) / ul
    const uy = (y2 - cy) / ul
    const head = `M${x2 - ux * 11 - uy * 8} ${y2 - uy * 11 + ux * 8} L${x2} ${y2} L${x2 - ux * 11 + uy * 8} ${y2 - uy * 11 - ux * 8}`
    return { d: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`, head }
  })
  return { w: s.width, h: s.height, arrows }
}

function Shell({ index, children }: { index: number; children: ReactNode }) {
  const clip = SLANT[index]
  if (!clip) return <div className="panel panel-shadow h-full">{children}</div>
  const style: CSSProperties = { clipPath: clip }
  return (
    <div className="relative h-full" style={{ filter: 'drop-shadow(4px 4px 0 var(--ink))' }}>
      <div className="absolute inset-0 bg-ink" style={style} />
      <div className="absolute inset-[4px] overflow-hidden bg-paper" style={style}>
        {children}
      </div>
    </div>
  )
}

export function System() {
  const root = useRef<HTMLElement>(null)
  const spread = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<HTMLDivElement[]>([])
  const [geo, setGeo] = useState<Geo | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = spread.current
    if (!el) return
    let last = ''
    const update = () => {
      const g = measure(el, panelRefs.current)
      const key = JSON.stringify(g)
      if (key !== last) {
        last = key
        setGeo(g)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useGSAP(
    () => {
      if (!geo) return
      const mm = gsap.matchMedia()
      mm.add({ desktop: DESKTOP, motion: MOTION_OK }, (ctx) => {
        const { desktop, motion: ok } = ctx.conditions as { desktop: boolean; motion: boolean }
        if (!ok) return
        const token = root.current!.querySelector<HTMLElement>('.sys-token')!
        const arrows = gsap.utils.toArray<SVGPathElement>('.sys-arrow', root.current)
        const arrowBgs = gsap.utils.toArray<SVGPathElement>('.sys-arrow-bg', root.current)
        const heads = gsap.utils.toArray<SVGPathElement>('.sys-head', root.current)
        const tl = gsap.timeline({
          defaults: { ease: INK },
          // desktop: plays by itself once in view (no pin). phones: panels are stacked, so follow the scroll.
          scrollTrigger: desktop
            ? { trigger: spread.current, start: 'top 65%', toggleActions: 'play none none none' }
            : { trigger: spread.current, start: 'top 80%', end: 'bottom 55%', scrub: 0.3 },
        })
        gsap.set([...arrows, ...arrowBgs], { drawSVG: '0%' })
        gsap.set(heads, { autoAlpha: 0 })
        gsap.set(token, { autoAlpha: 0 })
        panelRefs.current.forEach((panel, i) => {
          tl.to(panel, { y: -6, duration: 0.15 }, '>')
          tl.add(VISUALS[i].anim(panel, LANES))
          tl.to(panel, { y: 0, duration: 0.15 })
          if (i < arrows.length) {
            tl.set(token, { autoAlpha: 1 })
            tl.to([arrowBgs[i], arrows[i]], { drawSVG: '100%', duration: 0.5 }, '<')
            tl.to(token, { motionPath: { path: arrows[i], align: arrows[i], alignOrigin: [0.5, 0.5], autoRotate: false }, duration: 0.5 }, '<')
            tl.set(heads[i], { autoAlpha: 1 })
            tl.set(token, { autoAlpha: 0 })
          }
        })
        if (desktop) tl.timeScale(2) // whole flow ≈ 5s
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [geo], revertOnUpdate: true },
  )

  return (
    <section ref={root} aria-labelledby="sys-h" className="relative bg-paper px-4 py-16 md:flex md:h-screen md:flex-col md:justify-center md:px-8 md:py-6">
      <header className="mb-6 flex flex-wrap items-end gap-4 md:mb-5">
        <ChapterTag n="01" />
        <h2 id="sys-h" className="display text-[clamp(44px,6vw,96px)]">
          Footage in. Manga out.
        </h2>
      </header>

      <div
        ref={spread}
        className="relative grid grid-cols-1 gap-y-12 md:h-[64vh] md:grid-cols-[1.1fr_1.35fr_1fr] md:grid-rows-2 md:gap-x-6 md:gap-y-9"
      >
        {PANELS.map((p, i) => {
          const V = VISUALS[i].View
          return (
            <div
              key={p.id}
              ref={(el) => {
                if (el) panelRefs.current[i] = el
              }}
              tabIndex={0}
              role="group"
              aria-label={`${p.id} ${p.title}: ${p.label}`}
              className={`relative h-[260px] cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-accent md:h-auto ${AREA[i]}`}
              onMouseEnter={() => setOpen(i)}
              onMouseLeave={() => setOpen(null)}
              onFocus={() => setOpen(i)}
              onBlur={() => setOpen(null)}
              onClick={() => setOpen((o) => (o === i ? null : i))}
            >
              <Shell index={i}>
                <span className="reading-num">{p.id}</span>
                <div className="absolute top-1 right-2 left-10 z-[4] flex items-baseline justify-between gap-2">
                  <span className="display text-2xl md:text-[clamp(20px,1.8vw,30px)]">{p.title}</span>
                  <span className="mono truncate">{p.label}</span>
                </div>
                <V lanes={LANES} />
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 16, opacity: 0 }}
                      transition={{ duration: 0.16, ease: [0.7, 0, 0.2, 1] }}
                      className={`mono absolute right-2 left-2 z-20 ${SLANT[i] ? "bottom-8" : "bottom-2"} grid gap-0.5 border-[3px] border-ink bg-paper p-2 shadow-hard`}
                    >
                      <span>
                        {p.in} → {p.out}
                      </span>
                      <span>model: {p.model}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Shell>
            </div>
          )
        })}

        {geo && (
          <svg className="pointer-events-none absolute inset-0 z-10 overflow-visible" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden>
            {geo.arrows.map((a, i) => (
              <g key={i}>
                <path className="sys-arrow-bg" d={a.d} fill="none" stroke="var(--paper)" strokeWidth="9" strokeLinecap="square" />
                <path className="sys-arrow" d={a.d} fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="square" />
                <path className="sys-head" d={a.head} fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="square" />
              </g>
            ))}
          </svg>
        )}
        {/* the frame token: travels the arrows 01 → 06 */}
        <div className="sys-token pointer-events-none invisible absolute top-0 left-0 z-20 h-4 w-5 border-y-[3px] border-dotted border-paper bg-ink outline-[3px] outline-ink" aria-hidden />
      </div>

    </section>
  )
}
