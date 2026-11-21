// /demo forwards to the real product (the manga studio). Fallback link shows if the redirect is blocked.
import { useEffect } from 'react'
import { Link } from 'react-router'
import { DEMO_URL } from '../landing/components/CtaButton'

export default function DemoPlaceholder() {
  useEffect(() => {
    window.location.replace(DEMO_URL)
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-paper p-4">
      <div className="panel panel-shadow screentone grid w-full max-w-xl place-items-center gap-6 p-10">
        <span className="mono bg-ink px-2 py-1 text-paper uppercase">opening the studio…</span>
        <a href={DEMO_URL} className="btn-ink btn-accent">
          Open the studio <span aria-hidden>→</span>
        </a>
        <Link to="/" className="mono underline">
          back
        </Link>
      </div>
    </main>
  )
}
