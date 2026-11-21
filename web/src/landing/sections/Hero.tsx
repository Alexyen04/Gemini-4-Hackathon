import { useRef } from 'react'
import { HalftoneDots } from '@paper-design/shaders-react'
import { gsap, INK, STAMP, SplitText, useGSAP, MOTION_OK, DESKTOP } from '../lib/motion'
import { MediaSlot } from '../components/MediaSlot'
import { CtaButton } from '../components/CtaButton'
import { ChapterTag } from '../components/ChapterTag'
import { ShotMark } from '../components/ShotMark'
import { useImageExists, useInView } from '../components/useMediaExists'

// Speed lines converge on the action but stop short of it (manga convention)
const SPEED = Array.from({ length: 30 }, (_, i) => {
  const a = (i / 30) * Math.PI * 2 + (i % 2) * 0.05
  const r0 = 78 + (i % 3) * 6
  const r1 = 34 + (i % 4) * 5
  return `M${50 + Math.cos(a) * r0} ${50 + Math.sin(a) * r0} L${50 + Math.cos(a) * r1} ${50 + Math.sin(a) * r1}`
})

export function Hero() {
  const root = useRef<HTMLElement>(null)
  const hasFrame = useImageExists('/landing-media/hero-frame.jpg')
  const [panelRef, inView] = useInView<HTMLDivElement>()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add({ motion: MOTION_OK, desktop: DESKTOP }, (ctx) => {
        const { motion, desktop } = ctx.conditions as { motion: boolean; desktop: boolean }
        if (!motion) return
        const split = SplitText.create('.hero-h', { type: 'lines,words', mask: 'lines' })
        const mark = root.current!.querySelector<HTMLElement>('.hero-mark')!

        // Beat 1: on desktop the wordmark starts big and centered (FLIP from its final top-left slot)
        if (desktop) {
          const r = mark.getBoundingClientRect()
          const sec = root.current!.getBoundingClientRect()
          const scale = Math.min(2.2, (window.innerWidth * 0.6) / r.width)
          gsap.set(mark, {
            transformOrigin: '50% 50%',
            scale,
            x: window.innerWidth / 2 - (r.left + r.width / 2),
            y: sec.top + window.innerHeight / 2 - (r.top + r.height / 2),
          })
        }

        const flash = () => {
          gsap.fromTo('.hero-flash', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01, delay: 0.08 })
        }
        // One strictly sequential timeline: each beat starts after the previous one ends.
        gsap
          .timeline({ defaults: { ease: INK }, delay: 1.75 }) // ShotMark's shot runs ~1.6s on its own first
          .to(mark, { x: 0, y: 0, scale: 1, duration: desktop ? 1 : 0.01 }) // Beat 2: DUNKOMA → top-left
          .from(split.words, { yPercent: 110, duration: 0.5, stagger: 0.06 }) // Beat 3: slogan
          .from('.hero-sub', { clipPath: 'inset(0 100% 0 0)', duration: 0.4 })
          .from('.hero-cta', { y: 16, autoAlpha: 0, duration: 0.3 })
          .from('.hero-demo', { autoAlpha: 0, clipPath: 'inset(0 0 0 100%)', duration: 0.6 }) // Beat 4: our tool
          .to({}, { duration: 1.2 }) // the clip runs in color first
          .fromTo('.hero-media', { filter: 'grayscale(0) contrast(1)' }, { filter: 'grayscale(1) contrast(1.25)', duration: 0.9 })
          .fromTo('.hero-halftone', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 })
          .from('.hero-border', { scale: 1.08, autoAlpha: 0, duration: 0.2 })
          .fromTo('.hero-panel', { rotate: 0 }, { rotate: -2, duration: 0.2 })
          .from('.hero-speed path', { drawSVG: '0%', stagger: 0.012, duration: 0.35 })
          .from('.hero-page', { clipPath: 'inset(0 0 100% 0)', y: 60, rotate: 0, duration: 0.6 })
          .from('.hero-sfx', { scale: 3, autoAlpha: 0, duration: 0.35, ease: STAMP })
          .call(flash)
          .timeScale(1.3) // whole sequence ≈ 7.5s
        return () => split.revert()
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} aria-labelledby="hero-h" className="relative overflow-hidden bg-paper px-4 pt-6 pb-16 md:px-8">
      <div className="flex items-center justify-end gap-4">
        <ChapterTag n="00" />
      </div>

      {/* side by side: shot animation (left) | clip → manga SLAM (right) */}
      <div className="mx-auto grid max-w-[1400px] items-center gap-12 pt-8 md:min-h-[calc(100vh-6rem)] md:grid-cols-[0.6fr_1.4fr] md:gap-12 md:pt-0">
        <div className="flex flex-col items-start">
          <div className="hero-mark relative z-40 w-full max-w-[380px]">
            <ShotMark />
          </div>
          <h1 id="hero-h" className="hero-h display mt-5 text-[clamp(48px,4.6vw,78px)]">
            Every game has a story.
          </h1>
          <p className="hero-sub mt-3 text-lg font-medium md:text-xl">Real plays. Reimagined panels.</p>
          <div className="hero-cta mt-6">
            <CtaButton />
          </div>
        </div>

      <div className="hero-demo relative w-full md:aspect-[4/3]">
        <div ref={panelRef} className="hero-panel relative aspect-[4/3] w-[88%] md:absolute md:top-[10%] md:left-0 md:w-[74%]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="hero-media absolute inset-0">
              <MediaSlot file="hero.mp4" poster="hero-frame.jpg" video alt="Basketball game clip" label="frame 00:00.0" />
            </div>
            {/* wrapper always exists so the tween has a target before the shader mounts */}
            <div className="hero-halftone absolute inset-0">
              {hasFrame && inView && (
                <HalftoneDots
                  className="absolute inset-0 h-full w-full"
                  image="/landing-media/hero-frame.jpg"
                  fit="cover"
                  colorBack="#F4EEE2"
                  colorFront="#16130F"
                  size={0.45}
                  radius={1.2}
                  contrast={0.7}
                  grid="hex"
                  type="classic"
                  grainOverlay={0.15}
                />
              )}
            </div>
            <svg className="hero-speed pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {SPEED.map((d, i) => (
                <path key={i} d={d} stroke="var(--ink)" strokeWidth={i % 3 ? 1.5 : 3} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          </div>
          <div className="hero-border pointer-events-none absolute inset-0 border-4 border-ink shadow-hard-lg" />
          <span className="reading-num">01</span>
          <div className="hero-sfx pointer-events-none absolute -top-[12%] -right-[4%] z-30 flex -rotate-[8deg] flex-col items-end">
            <span className="display sfx-outline text-[clamp(48px,6vw,104px)]">SLAM!!</span>
            <span className="-mt-1 font-jp text-[clamp(24px,2.4vw,42px)] leading-none" lang="ja">
              ドン
            </span>
          </div>
        </div>

        {/* 02: the manga page the pipeline made from this clip */}
        <div className="hero-page relative z-20 -mt-16 ml-auto aspect-[12/17] w-[52%] rotate-3 border-4 border-ink bg-paper shadow-hard-lg md:absolute md:right-0 md:bottom-0 md:mt-0 md:h-[78%] md:w-auto">
          <MediaSlot file="hero.jpg" alt="Manga page made from this clip" label="manga page" />
          <span className="reading-num">02</span>
        </div>
      </div>
      </div>

      {/* 80ms inverted impact flash */}
      <div className="hero-flash pointer-events-none invisible fixed inset-0 z-50 bg-paper mix-blend-difference" aria-hidden />
    </section>
  )
}
