import { useLenis } from './lib/motion'
import { Hero } from './sections/Hero'
import { System } from './sections/System'
import { SameGame } from './sections/SameGame'
import { InkPeel } from './sections/InkPeel'
import { Closing } from './sections/Closing'

export default function LandingPage() {
  useLenis()
  return (
    <main className="bg-paper text-ink">
      <Hero />
      <System />
      <SameGame />
      <InkPeel />
      <Closing />
    </main>
  )
}
