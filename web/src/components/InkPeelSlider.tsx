import { animate, useInView, useReducedMotion } from 'framer-motion'
import { ChevronsLeftRight, MoveHorizontal, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { humanize, mediaUrl } from '../lib/format'
import type { MangaPanelData } from '../types/manga'

interface InkPeelSliderProps {
  assets: { panel_image_url: string; source_frame_url: string }
  sourceLabel?: string
  crop?: Pick<MangaPanelData, 'action_bbox_norm' | 'crop_focus'>
  hero?: boolean
  inkOverlay?: ReactNode
  note?: ReactNode
}

export function InkPeelSlider({ assets, sourceLabel = 'Source frame', crop, hero = false, inkOverlay, note }: InkPeelSliderProps) {
  const frame = useRef<HTMLDivElement>(null)
  const visible = useInView(frame, { amount: 0.4 })
  const reduced = useReducedMotion()
  const [peel, setPeel] = useState(50)
  const [ratio, setRatio] = useState(hero ? 16 / 9 : 1.5)
  const [playing, setPlaying] = useState(hero)
  const box = crop?.action_bbox_norm
  const cropLeft = box?.[1]

  useEffect(() => {
    if (!playing || !visible || reduced) return
    const animation = animate(0, 1, {
      duration: 5.8,
      ease: 'linear',
      repeat: Infinity,
      onUpdate: (fraction) => setPeel(Math.round(50 + 16 * Math.sin(fraction * Math.PI * 2))),
    })
    return () => animation.stop()
  }, [playing, visible, reduced])

  useEffect(() => {
    if (cropLeft !== undefined) setPeel((value) => Math.min(value, Math.max(0, Math.floor(cropLeft * 100) - 3)))
  }, [cropLeft])

  const comparisonStyle = { '--peel': peel + '%', '--preview-ratio': ratio } as CSSProperties
  const boxStyle = box && {
    top: box[0] * 100 + '%',
    left: box[1] * 100 + '%',
    width: (box[3] - box[1]) * 100 + '%',
    height: (box[2] - box[0]) * 100 + '%',
  }
  const priority = hero ? 'high' : undefined

  return (
    <div className={hero ? 'ink-peel ink-peel-hero' : 'ink-peel'}>
      <div className="comparison" ref={frame} style={comparisonStyle}>
        <div className="comparison-ink">
          <img src={mediaUrl(assets.panel_image_url)} alt="Inked basketball panel" fetchPriority={priority} draggable={false} />
          {inkOverlay}
        </div>
        <div className="comparison-raw">
          <img src={mediaUrl(assets.source_frame_url)} alt={sourceLabel} fetchPriority={priority} draggable={false}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget
              if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight)
            }} />
          {crop && boxStyle && <span className="crop-box" style={boxStyle} aria-hidden="true"><span>{humanize(crop.crop_focus)}</span></span>}
        </div>
        <span className="comparison-label label-ink" aria-hidden="true">Manga ink</span>
        <span className="comparison-label label-raw" aria-hidden="true">{sourceLabel}</span>
        <span className="peel-divider" aria-hidden="true"><span><ChevronsLeftRight size={20} /></span></span>
        <input type="range" className="peel-range" aria-label="Compare manga ink and source frame"
          aria-valuetext={peel + '% manga ink, ' + (100 - peel) + '% source frame'}
          value={peel} min={0} max={100}
          onFocus={() => setPlaying(false)}
          onPointerDown={() => setPlaying(false)}
          onChange={(event) => {
            setPlaying(false)
            setPeel(Number(event.currentTarget.value))
          }} />
      </div>
      {hero && (
        <div className="comparison-footer">
          <span className="comparison-instruction"><MoveHorizontal size={17} aria-hidden="true" /> Drag to compare</span>
          {note}
          {!reduced && <button type="button" className="motion-toggle" aria-label={playing ? 'Pause Ink Peel animation' : 'Play Ink Peel animation'}
            title={playing ? 'Pause Ink Peel animation' : 'Play Ink Peel animation'} onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>}
        </div>
      )}
    </div>
  )
}
