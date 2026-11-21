import { useRef } from 'react'
import { HalftoneDots } from '@paper-design/shaders-react'
import { gsap, INK, STAMP, SplitText, useGSAP, MOTION_OK } from '../lib/motion'
import { MediaSlot } from '../components/MediaSlot'
import { CtaButton } from '../components/CtaButton'
import { ChapterTag } from '../components/ChapterTag'
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
      mm.add(MOTION_OK, () => {
        // headline stamps in on load
        const split = SplitText.create('.hero-h', { type: 'lines,words', mask: 'lines' })
        gsap.from(split.words, { yPercent: 110, duration: 0.55, stagger: 0.06, ease: INK, delay: 0.1 })

        const flash = () => {
          gsap.fromTo('.hero-flash', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01, delay: 0.08 })
        }
        // plays on its own (no scroll needed): let the clip run in color, then ink it into manga
        gsap
          .timeline({ defaults: { ease: INK }, delay: 1.8 })
          .fromTo('.hero-media', { filter: 'grayscale(0) contrast(1)' }, { filter: 'grayscale(1) contrast(1.25)', duration: 0.9 })
          .fromTo('.hero-halftone', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 })
          .from('.hero-border', { scale: 1.08, autoAlpha: 0, duration: 0.2 })
          .fromTo('.hero-panel', { rotate: 0 }, { rotate: -2, duration: 0.2 }, '<')
          .from('.hero-speed path', { drawSVG: '0%', stagger: 0.012, duration: 0.35 })
          // the finished manga page (pipeline output) lands on top of its source clip
          .from('.hero-page', { clipPath: 'inset(0 0 100% 0)', y: 60, rotate: 0, duration: 0.6 }, '+=0.2')
          .from('.hero-sfx', { scale: 3, autoAlpha: 0, duration: 0.35, ease: STAMP }, '-=0.1')
          .call(flash)
        return () => split.revert()
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} aria-labelledby="hero-h" className="relative flex flex-col overflow-hidden md:min-h-screen bg-paper px-4 pt-6 pb-10 md:h-screen md:px-8 md:pb-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2" aria-label="Dunkoma">
          <span className="display text-3xl md:text-4xl" aria-hidden>
            Dunkoma
          </span>
          <span className="font-jp text-sm md:text-base" lang="ja" aria-hidden>
            ダンコマ
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono hidden sm:inline">gemini 4 nyc hackathon</span>
          <ChapterTag n="00" />
        </div>
      </div>

      <h1 id="hero-h" className="hero-h display relative z-10 mt-6 max-w-[11ch] text-[clamp(64px,19vw,200px)] md:mt-4 md:max-w-[9ch] md:text-[clamp(64px,10.5vw,190px)]">
        Every game has a story.
      </h1>

      <div
        ref={panelRef}
        className="hero-panel relative mt-8 aspect-[4/3] w-full md:absolute md:top-[14vh] md:right-8 md:mt-0 md:w-[46vw] md:max-w-[760px]"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="hero-media absolute inset-0">
            <MediaSlot file="hero.mp4" poster="hero-frame.jpg" video alt="Basketball game clip" label="frame 00:00.0" />
          </div>
          {/* wrapper always exists so the scroll tween has a target before the shader mounts */}
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
        <div className="hero-sfx pointer-events-none absolute -top-[6%] -right-[2%] z-10 flex -rotate-[8deg] flex-col items-end md:-top-[12%]">
          <span className="display sfx-outline text-[clamp(56px,9vw,150px)]">SLAM!!</span>
          <span className="-mt-1 font-jp text-[clamp(28px,3.6vw,60px)] leading-none" lang="ja">
            ドン
          </span>
        </div>
      </div>

      {/* 02: the manga page the pipeline made from this clip */}
      <div className="hero-page relative z-20 -mt-10 ml-auto aspect-[12/17] w-[68%] rotate-3 border-4 border-ink bg-paper shadow-hard-lg md:absolute md:top-[36vh] md:left-[33vw] md:mt-0 md:ml-0 md:h-[60vh] md:w-auto">
        <MediaSlot file="hero.jpg" alt="Manga page made from this clip" label="manga page" />
        <span className="reading-num">02</span>
      </div>

      <div className="relative z-10 mt-8 flex flex-col items-start gap-5 md:mt-auto">
        <p className="text-lg font-medium md:text-xl">Real plays. Reimagined panels.</p>
        <CtaButton />
      </div>

      {/* 80ms inverted impact flash */}
      <div className="hero-flash pointer-events-none invisible fixed inset-0 z-50 bg-paper mix-blend-difference" aria-hidden />
    </section>
  )
}
