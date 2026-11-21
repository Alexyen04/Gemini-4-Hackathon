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

/* 02 Watch (Stage 1, gemini-4-argon): clips + keyframes analyzed in parallel lanes */
const V02: Visual = {
  View: ({ lanes }) => (
    <div className="flex h-full flex-col justify-center gap-2 px-4 pt-6 pb-3">
      <div className="relative mb-1 h-2 border-x-2 border-ink">
        <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 bg-ink" />
      </div>
      {Array.from({ length: lanes }, (_, i) => {
        const left = (i * 66) / Math.max(1, lanes - 1)
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="mono w-14 shrink-0">argon·{String(i + 1).padStart(2, '0')}</span>
            <div className="relative h-5 flex-1">
              <div className="v-chunk absolute top-0 h-full border-2 border-ink bg-ink" style={{ left: `${left}%`, width: '34%' }}>
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

/* 03 Plot (Stage 2, gemini-4-carbon): 5-act sports manga arc draws, beats snap on */
const BEATS = [
  { x: 10, y: 80, t: 'intro' },
  { x: 54, y: 62, t: 'rising' },
  { x: 100, y: 40, t: 'conflict' },
  { x: 146, y: 10, t: 'climax' },
  { x: 192, y: 60, t: 'resolution' },
]
const V03: Visual = {
  View: () => (
    <div className="flex h-full items-center px-6 pt-9 pb-5">
      <svg viewBox="0 0 204 100" className="h-full w-full overflow-visible" aria-hidden>
        <path className="v-arc" d="M10 80 C 30 76, 40 66, 54 62 S 84 46, 100 40 S 130 8, 146 10 S 180 44, 192 60" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="square" />
        {BEATS.map((b) => (
          <g key={b.t} className="v-beat">
            <rect x={b.x - 5} y={b.y - 5} width="10" height="10" fill={b.t === 'climax' ? 'var(--accent)' : 'var(--ink)'} stroke="var(--ink)" strokeWidth="2" />
            <text x={b.x} y={b.y + 19} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--ink)">
              {b.t}
            </text>
          </g>
        ))}
      </svg>
    </div>
  ),
  anim: (el) =>
    gsap
      .timeline({ defaults: { ease: INK } })
      .from(q(el, '.v-arc'), { drawSVG: '0%', duration: 0.6 })
      .from(q(el, '.v-beat'), { scale: 0, transformOrigin: '50% 50%', autoAlpha: 0, stagger: 0.1, duration: 0.2 }, '<0.1'),
}

/* 04 Storyboard (Stage 3, gemini-4-carbon): beats become panels with camera shots */
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

/* 05 Illustrate + Check (Stages 4 & 6): carbon draws, hydrogen checks facts and quality */
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
