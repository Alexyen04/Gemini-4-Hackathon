// Panel illustrations for CH.01. Default DOM = final state; each `anim` builds a from-state timeline,
// so reduced-motion (no timeline) shows everything finished.
import type { FC } from 'react'
import { gsap, INK, STAMP } from '../lib/motion'
import { MediaSlot } from './MediaSlot'

type Anim = (el: HTMLElement, lanes: number) => gsap.core.Timeline
interface Visual {
  View: FC<{ lanes: number }>
  anim: Anim
}

const q = (el: HTMLElement, sel: string) => el.querySelectorAll<HTMLElement | SVGElement>(sel)

/* 01 Input: film strip + waveform + focus chip */
const BARS = Array.from({ length: 28 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)))
const V01: Visual = {
  View: () => (
    <div className="flex h-full flex-col justify-center gap-3 px-4 pt-6 pb-3">
      <div className="flex gap-1 border-y-[6px] border-dotted border-ink bg-ink p-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="v-frame relative aspect-[4/3] flex-1 border border-paper">
            <MediaSlot file={`strip-${i + 1}.jpg`} alt="" label="" />
          </div>
        ))}
      </div>
      <svg viewBox="0 0 112 24" className="h-8 w-full" aria-hidden>
        {BARS.map((h, i) => (
          <rect key={i} className="v-bar" x={i * 4} y={12 - h * 11} width="2.4" height={h * 22} fill="var(--ink)" />
        ))}
      </svg>
      <span className="v-chip mono self-start border-2 border-ink bg-paper px-2 py-1 shadow-hard">style: shonen · focus: emotion</span>
    </div>
  ),
  anim: (el) =>
    gsap
      .timeline({ defaults: { ease: INK } })
      .from(q(el, '.v-frame'), { xPercent: -60, autoAlpha: 0, stagger: 0.06, duration: 0.3 })
      .from(q(el, '.v-bar'), { scaleY: 0, transformOrigin: '50% 50%', stagger: 0.01, duration: 0.3 }, '<0.1')
      .from(q(el, '.v-chip'), { scale: 1.3, autoAlpha: 0, duration: 0.25 }, '-=0.1'),
}

/* 02 Watch (gemini-4-hydrogen ×2): upstream scout and clip analysis run in parallel */
const LANE_NAMES = ['scout', 'clip read']
const V02: Visual = {
  View: ({ lanes }) => (
    <div className="flex h-full flex-col justify-center gap-2 px-4 pt-6 pb-3">
      <div className="relative mb-1 h-2 border-x-2 border-ink">
        <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 bg-ink" />
      </div>
      {Array.from({ length: lanes }, (_, i) => {
        const left = 0 // both analyses read the whole clip at the same time
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="mono w-16 shrink-0">{LANE_NAMES[i] ?? `lane·${i + 1}`}</span>
            <div className="relative h-5 flex-1">
              <div className="v-chunk absolute top-0 h-full border-2 border-ink bg-ink" style={{ left: `${left}%`, width: '100%' }}>
                <div className="v-lane-token invisible absolute top-1/2 left-0 h-3 w-3 -translate-y-1/2 border-2 border-paper bg-ink" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  ),
  anim: (el) =>
    gsap
      .timeline({ defaults: { ease: INK } })
      .from(q(el, '.v-chunk'), { scaleX: 0, transformOrigin: '0% 50%', backgroundColor: 'var(--paper)', stagger: 0.05, duration: 0.3 })
      // the parallelism moment: every lane runs simultaneously
      .fromTo(q(el, '.v-lane-token'), { left: '0%', autoAlpha: 0 }, { left: 'calc(100% - 12px)', autoAlpha: 1, duration: 0.6 })
      .to(q(el, '.v-lane-token'), { autoAlpha: 0, scale: 0.4, duration: 0.15 }),
}

/* 03 Rank (gemini-decision-1): candidate beats drop onto the action × story casting grid */
const DOTS = [
  { a: 0.84, s: 0.2, tag: 'dunk, up 20', hot: false },
  { a: 0.26, s: 0.76, tag: 'missed ft', hot: true },
  { a: 0.72, s: 0.74, tag: '', hot: false },
  { a: 0.18, s: 0.22, tag: '', hot: false },
  { a: 0.44, s: 0.58, tag: '', hot: false },
]
const V03: Visual = {
  View: () => (
    <div className="flex h-full items-center gap-2 px-4 pt-10 pb-7">
      <span className="mono -rotate-90 whitespace-nowrap">story →</span>
      <div className="relative aspect-square h-full max-h-full border-[3px] border-ink">
        <div className="absolute top-0 left-1/2 h-full w-[2px] bg-ink" />
        <div className="absolute top-1/2 left-0 h-[2px] w-full bg-ink" />
        <span className="mono absolute top-1 left-1">emotion</span>
        <span className="mono absolute top-1 right-1">climax</span>
        <span className="mono absolute right-1 bottom-1">montage</span>
        <span className="mono absolute bottom-1 left-1">drop</span>
        {DOTS.map((d, i) => (
          <div key={i} className="v-dot absolute" style={{ left: `${d.a * 100}%`, bottom: `${d.s * 100}%` }}>
            <div className={`-translate-x-1/2 translate-y-1/2 border-2 border-ink ${d.hot ? 'h-4 w-4 bg-accent' : 'h-3 w-3 bg-ink'}`} />
            {d.tag && <span className={`mono absolute top-1 whitespace-nowrap bg-paper px-1 ${d.a > 0.6 ? 'right-2' : 'left-2'}`}>{d.tag}</span>}
          </div>
        ))}
        <span className="mono absolute -bottom-5 left-0 w-full text-center">action →</span>
      </div>
    </div>
  ),
  anim: (el) =>
    gsap.timeline({ defaults: { ease: INK } }).from(q(el, '.v-dot'), { y: -80, autoAlpha: 0, stagger: 0.08, duration: 0.35 }),
}

/* 04 Storyboard (gemini-4-hydrogen): 5-act arc → pages, panels and camera shots */
const SHOTS = [
  { area: 'col-span-2', shot: 'wide · intro' },
  { area: '', shot: 'low angle' },
  { area: 'row-span-2', shot: 'splash · climax', hot: true },
  { area: '', shot: 'close-up' },
]
const V04: Visual = {
  View: () => (
    <div className="h-full px-4 pt-10 pb-4">
      <div className="grid h-full grid-cols-[1fr_1.2fr] grid-rows-[0.8fr_1fr_1fr] gap-1.5">
        {SHOTS.map((p) => (
          <div key={p.shot} className={`v-cell relative border-[3px] border-dashed border-ink ${p.area}`}>
            <span className={`mono absolute bottom-0 left-0 px-1 ${p.hot ? 'bg-accent text-on-accent' : 'bg-ink text-paper'}`}>{p.shot}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  anim: (el) =>
    gsap.timeline({ defaults: { ease: INK } }).from(q(el, '.v-cell'), { clipPath: 'inset(0 100% 0 0)', stagger: 0.12, duration: 0.3 }),
}

/* 05 Illustrate + Check: carbon panel specs → nano-banana redraws the real frame → hydrogen fact check */
const CHECKS = ['same play', 'same score', 'same players']
const V05: Visual = {
  View: () => (
    <div className="flex h-full items-center justify-center gap-5 px-4 pt-9 pb-6">
      <div className="v-inked relative aspect-[3/4] h-[80%] border-[3px] border-ink">
        <MediaSlot file="page-p2.jpg" alt="Creative manga panel" label="new art" dense />
        <span className="mono absolute bottom-0 left-0 bg-ink px-1 text-paper">new art</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {CHECKS.map((c) => (
          <span key={c} className="v-check mono flex items-center gap-2 border-2 border-ink bg-paper px-2 py-1">
            <span className="grid h-4 w-4 place-items-center bg-ink text-paper" aria-hidden>
              ✓
            </span>
            {c}
          </span>
        ))}
        <span className="v-stamp display mt-1 self-start -rotate-6 border-[3px] border-ink bg-ink px-2 pt-1 text-[clamp(18px,2vw,28px)] text-paper">
          Story holds
        </span>
      </div>
    </div>
  ),
  anim: (el) =>
    gsap
      .timeline({ defaults: { ease: INK } })
      .from(q(el, '.v-inked'), { clipPath: 'inset(0 100% 0 0)', duration: 0.3 })
      .from(q(el, '.v-check'), { x: -16, autoAlpha: 0, stagger: 0.12, duration: 0.18 })
      .from(q(el, '.v-stamp'), { scale: 2.4, autoAlpha: 0, duration: 0.2, ease: STAMP }),
}

/* 06 Read (Stages 5 & 7): pages compose; a panel flips to its source clip frame and back */
const V06: Visual = {
  View: () => (
    <div className="h-full px-4 pt-10 pb-3">
      <div className="grid h-full grid-cols-[1.3fr_1fr] grid-rows-[1fr_1.4fr_0.8fr] gap-1.5 border-[3px] border-ink bg-ink p-1.5">
        <div className="v-mini relative col-span-2">
          <MediaSlot file="page-p1.jpg" alt="" label="" />
        </div>
        <div className="v-mini relative row-span-2 [perspective:600px]">
          <div className="v-flip relative h-full w-full [transform-style:preserve-3d]" style={{ transform: 'rotateY(0deg)' }}>
            <div className="absolute inset-0 [backface-visibility:hidden]">
              <MediaSlot file="system-ink.jpg" alt="Inked manga panel" label="ink" dense />
            </div>
            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <MediaSlot file="system-raw.jpg" alt="Raw source frame" label="raw frame" />
              <span className="mono absolute right-0 bottom-0 bg-accent px-1 text-on-accent">00:00.8</span>
            </div>
          </div>
        </div>
        <div className="v-mini relative">
          <MediaSlot file="page-p3.jpg" alt="" label="" />
        </div>
        <div className="v-mini relative">
          <MediaSlot file="page-p4.jpg" alt="" label="" dense />
        </div>
      </div>
    </div>
  ),
  anim: (el) =>
    gsap
      .timeline({ defaults: { ease: INK } })
      .from(q(el, '.v-mini'), { clipPath: 'inset(0 100% 0 0)', stagger: 0.08, duration: 0.25 })
      .to(q(el, '.v-flip'), { rotateY: 180, duration: 0.4 }, '+=0.1')
      .to(q(el, '.v-flip'), { rotateY: 0, duration: 0.4 }, '+=0.6'),
}

export const VISUALS: Visual[] = [V01, V02, V03, V04, V05, V06]
