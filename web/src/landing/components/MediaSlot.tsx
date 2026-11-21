import { useState, type ReactNode } from 'react'

const BASE = '/landing-media/'

interface MediaSlotProps {
  /** filename inside public/landing-media/ */
  file: string
  alt: string
  /** placeholder label, e.g. "FRAME 00:43.8" */
  label?: string
  video?: boolean
  poster?: string
  dense?: boolean
  className?: string
  onReady?: (ok: boolean) => void
  children?: ReactNode
}

/** Real media if present, otherwise screentone + frame label. The page must work with zero media. */
export function MediaSlot({ file, alt, label = 'FRAME 00:00.0', video, poster, dense, className = '', onReady, children }: MediaSlotProps) {
  const [failed, setFailed] = useState(false)
  const fail = () => {
    setFailed(true)
    onReady?.(false)
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {failed ? (
        <div role="img" aria-label={`${alt} (placeholder)`} className={`absolute inset-0 grid place-items-center ${dense ? 'screentone-dense' : 'screentone'}`}>
          <span className="mono border-2 border-ink bg-paper px-2 py-1 uppercase">{label}</span>
        </div>
      ) : video ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={BASE + file}
          poster={poster ? BASE + poster : undefined}
          muted
          loop
          playsInline
          autoPlay
          aria-label={alt}
          onLoadedData={() => onReady?.(true)}
          onError={fail}
        />
      ) : (
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={BASE + file}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => onReady?.(true)}
          onError={fail}
        />
      )}
      {children}
    </div>
  )
}
