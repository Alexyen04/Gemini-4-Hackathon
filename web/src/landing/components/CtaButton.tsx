import { Link } from 'react-router'

export function CtaButton({ className = '' }: { className?: string }) {
  return (
    <Link to="/demo" className={`btn-ink btn-accent ${className}`}>
      Try the demo <span aria-hidden>→</span>
    </Link>
  )
}
