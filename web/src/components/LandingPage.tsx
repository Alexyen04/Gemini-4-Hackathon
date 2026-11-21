import type { ComponentProps } from 'react'
import { AboutSection } from './AboutSection'
import { EvaluationSections } from './EvaluationSections'
import { HeroSection } from './HeroSection'
import { TipOffStudio } from './TipOffStudio'

export function LandingPage(props: ComponentProps<typeof TipOffStudio>) {
  return (
    <>
      <HeroSection />
      <TipOffStudio {...props} />
      <AboutSection />
      <EvaluationSections />
    </>
  )
}
