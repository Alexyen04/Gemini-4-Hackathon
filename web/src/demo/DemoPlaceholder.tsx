// PLACEHOLDER — /demo is owned by a teammate. Replace this file's route target in src/main.tsx with the real app.
import { Link } from 'react-router'

export default function DemoPlaceholder() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-4">
      <div className="panel panel-shadow screentone grid w-full max-w-xl place-items-center gap-6 p-10">
        <span className="mono bg-ink px-2 py-1 text-paper uppercase">/demo · placeholder</span>
        <h1 className="display text-6xl">Demo goes here</h1>
        <Link to="/" className="btn-ink">
          <span aria-hidden>←</span> Back
        </Link>
      </div>
    </main>
  )
}
