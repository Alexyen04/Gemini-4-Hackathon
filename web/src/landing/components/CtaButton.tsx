// The product is the manga studio app at the repo root (separate server). Override per environment with VITE_DEMO_URL.
export const DEMO_URL: string = import.meta.env.VITE_DEMO_URL ?? 'http://localhost:3000/studio'

export function CtaButton({ className = '' }: { className?: string }) {
  return (
    <a href={DEMO_URL} className={`btn-ink btn-accent ${className}`}>
      Try the demo <span aria-hidden>→</span>
    </a>
  )
}
