import { useRef } from 'react'
import { gsap, INK, SplitText, useGSAP, MOTION_OK } from '../lib/motion'
import { CtaButton } from '../components/CtaButton'
import { ChapterTag } from '../components/ChapterTag'

const REPO = 'https://github.com/Alexyen04/Gemini-4-Hackathon'

export function Closing() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        const split = SplitText.create('.close-h', { type: 'lines,words', mask: 'lines' })
        gsap
          .timeline({ defaults: { ease: INK }, scrollTrigger: { trigger: root.current, start: 'top 55%', toggleActions: 'play none none reverse' } })
          .from('.close-tone', { clipPath: 'inset(0 0 0 100%)', duration: 0.6 })
          .from(split.words, { yPercent: 110, stagger: 0.07, duration: 0.5 }, '<0.1')
          .from('.close-cta', { y: 24, autoAlpha: 0, duration: 0.3 })
        return () => split.revert()
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} aria-labelledby="close-h" className="inverted relative flex min-h-screen flex-col overflow-hidden bg-ink px-4 pt-10 pb-6 text-paper md:px-8">
      {/* screentone wedge, ink-on-ink print feel */}
      <div
        className="close-tone pointer-events-none absolute top-0 right-0 h-full w-[55%]"
        style={{
          backgroundImage: 'radial-gradient(var(--tone) 1.2px, transparent 1.4px)',
          backgroundSize: '7px 7px',
          opacity: 0.35,
          clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0 100%)',
        }}
        aria-hidden
      />
      <ChapterTag n="04" inverted />
      <div className="relative my-auto py-16">
        <h2 id="close-h" className="close-h display max-w-[12ch] text-[clamp(60px,17vw,230px)] md:text-[clamp(64px,13vw,230px)]">
          Every play becomes a page.
        </h2>
        <div className="close-cta mt-10">
          <CtaButton className="text-2xl md:text-3xl" />
        </div>
      </div>
      <footer className="mono relative flex flex-wrap gap-x-6 gap-y-1 border-t-2 border-paper pt-3">
        <span>dunkoma · team: todo</span>
        <span>gemini 4 nyc hackathon</span>
        <a href={REPO} className="underline underline-offset-2 hover:bg-paper hover:text-ink">
          github repo
        </a>
      </footer>
    </section>
  )
}
