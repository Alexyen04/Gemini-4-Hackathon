import { ArrowLeft, ListVideo, ScanLine } from 'lucide-react'
import type { ReadingDirection } from '../types/manga'

interface ReaderControlsProps {
  direction: ReadingDirection
  judge: boolean
  reveal: boolean
  onDirection: (direction: ReadingDirection) => void
  onJudge: () => void
  onReveal: () => void
}

export function ReaderControls({ direction, judge, reveal, onDirection, onJudge, onReveal }: ReaderControlsProps) {
  return (
    <div className="reader-toolbar">
      <a href="/" className="reader-return"><ArrowLeft size={17} aria-hidden="true" /> Back to Home</a>
      <div className="reader-tools" role="group" aria-label="Reading controls">
        <div className="direction-switch" role="group" aria-label="Reading direction">
          {(['rtl', 'ltr'] as const).map((option) => (
            <button type="button" key={option} aria-label={option === 'rtl' ? 'Right to left' : 'Left to right'}
              aria-pressed={direction === option} onClick={() => onDirection(option)}>{option.toUpperCase()}</button>
          ))}
        </div>
        <button type="button" className="tool-button reveal-button" aria-pressed={reveal} onClick={onReveal}>
          <ListVideo size={17} aria-hidden="true" /> Panel Reveal
        </button>
        <button type="button" className="tool-button judge-button" role="switch" aria-checked={judge} onClick={onJudge}>
          <ScanLine size={17} aria-hidden="true" /> Judge Mode <span className="switch-track" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
