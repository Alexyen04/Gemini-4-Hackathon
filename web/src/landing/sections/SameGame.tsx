import { useRef } from 'react'
import { gsap, INK, STAMP, useGSAP, MOTION_OK } from '../lib/motion'
import { MediaSlot } from '../components/MediaSlot'
import { ChapterTag } from '../components/ChapterTag'
import data from '../data/stories.json'

// One clip, two focus prompts, two different manga pages: the AI makes story choices, not filters.
const [A, B] = data.stories

function StoryPage({ story, tilt, n }: { story: (typeof data.stories)[number]; tilt: string; n: string }) {
  return (
    <figure className={`sg-page m-0 mx-auto flex w-[88%] flex-col gap-3 md:w-[min(28vw,44vh)] ${tilt}`}>
      <span className="sg-chip mono self-start border-[3px] border-ink bg-paper px-2 py-1 shadow-hard">focus: {story.focus}</span>
      <div className="relative aspect-[12/17] w-full border-4 border-ink bg-paper shadow-hard-lg">
        <MediaSlot file={story.media} alt={`Manga page with focus: ${story.focus}`} label={`page · ${story.focus}`} />
        <span className="reading-num">{n}</span>
      </div>
    </figure>
  )
}

export function SameGame() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap
          .timeline({ defaults: { ease: INK }, scrollTrigger: { trigger: root.current, start: 'top 60%', toggleActions: 'play none none none' } })
          .from('.sg-h', { clipPath: 'inset(0 100% 0 0)', duration: 0.5 })
          .from('.sg-src', { clipPath: 'inset(0 0 100% 0)', duration: 0.45 }, '<0.1')
          .from('.sg-arrow', { drawSVG: '0%', duration: 0.4 })
          .from('.sg-page', { clipPath: 'inset(0 0 100% 0)', y: 30, stagger: 0.15, duration: 0.5 }, '-=0.1')
          .from('.sg-chip', { scale: 1.6, autoAlpha: 0, stagger: 0.15, duration: 0.25, ease: STAMP }, '-=0.3')
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} aria-labelledby="sg-h" className="relative bg-paper px-4 py-14 md:px-8 md:py-24">
      <div className="mb-10 flex flex-wrap items-end gap-4">
        <ChapterTag n="02" />
        <h2 id="sg-h" className="sg-h display text-[clamp(52px,8vw,140px)]">
          Same game. Different story.
        </h2>
      </div>

      <div className="grid items-center gap-10 md:grid-cols-[1fr_minmax(180px,0.7fr)_1fr] md:gap-6">
        <div className="md:order-1">
          <StoryPage story={A} tilt="md:-rotate-2" n="01" />
        </div>

        {/* the one source clip both pages came from */}
        <div className="order-first flex flex-col items-center gap-3 md:order-2">
          <div className="sg-src relative aspect-video w-full max-w-[320px] border-4 border-ink shadow-hard">
            <MediaSlot file={data.source.media} alt="The source clip" label="clip" />
          </div>
          <span className="mono">{data.source.label}</span>
          <svg viewBox="0 0 200 60" className="hidden w-full max-w-[280px] overflow-visible md:block" aria-hidden>
            <path className="sg-arrow" d="M90 4 C 60 20, 30 30, 6 54" fill="none" stroke="var(--ink)" strokeWidth="4" />
            <path className="sg-arrow" d="M18 52 L6 54 L8 42" fill="none" stroke="var(--ink)" strokeWidth="4" />
            <path className="sg-arrow" d="M110 4 C 140 20, 170 30, 194 54" fill="none" stroke="var(--ink)" strokeWidth="4" />
            <path className="sg-arrow" d="M182 52 L194 54 L192 42" fill="none" stroke="var(--ink)" strokeWidth="4" />
          </svg>
        </div>

        <div className="md:order-3 md:mt-12">
          <StoryPage story={B} tilt="md:rotate-2" n="02" />
        </div>
      </div>
    </section>
  )
}
