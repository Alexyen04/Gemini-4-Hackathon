import type { CSSProperties } from 'react'
import type { MangaPanelData } from '../types/manga'

const spokes = Array.from({ length: 22 }, (_, index) => {
  const angle = index * Math.PI / 11
  const inner = index % 3 === 0 ? 17 : 26
  return {
    x1: Math.cos(angle) * inner, y1: Math.sin(angle) * inner,
    x2: Math.cos(angle) * 123, y2: Math.sin(angle) * 123,
  }
})

const streaks = Array.from({ length: 11 }, (_, index) => ({
  x1: index * 4 - 32, y1: index * 10 - 45,
  x2: index * 4 + 54, y2: index * 10 - 65,
}))

interface EffectsProps {
  panel: Pick<MangaPanelData, 'effects' | 'action_bbox_norm'>
}

export function PanelEffects({ panel }: EffectsProps) {
  const { speed_lines: lines, impact_burst: impact } = panel.effects
  if ((lines === 'none' && !impact) || !panel.action_bbox_norm) return null
  const [top, left, bottom, right] = panel.action_bbox_norm
  const x = (left + right) * 50
  const y = (top + bottom) * 50

  return (
    <svg className="panel-effects" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <g transform={'translate(' + x + ' ' + y + ')'} className="effect-lines">
        {lines !== 'none' && (lines === 'radial' ? spokes : streaks).map((line, index) => (
          <line key={index} {...line} vectorEffect="non-scaling-stroke" strokeWidth={index % 4 === 0 ? 2 : 1} />
        ))}
        {impact && <path className="impact-burst" d="M0-18 4-8 13-13 11-3 21 0 10 5 14 14 4 11 0 20-5 10-15 14-10 5-21 1-11-4-16-13-5-9Z" vectorEffect="non-scaling-stroke" />}
      </g>
    </svg>
  )
}

export function PanelSfx({ panel, position }: {
  panel: Pick<MangaPanelData, 'sfx' | 'action_bbox_norm'>
  position?: [x: number, y: number]
}) {
  const { sfx } = panel
  if (!sfx.text || sfx.style === 'none') return null
  const [top, left, bottom, right] = panel.action_bbox_norm ?? [0, 0, 1, 1]
  const [x, y] = position ?? [Math.min(75, Math.max(23, (left + right) * 50 + 12)), Math.min(72, Math.max(33, (top + bottom) * 50 - 10))]
  const style = { '--sfx-x': x + '%', '--sfx-y': y + '%' } as CSSProperties
  return (
    <span className={'panel-sfx sfx-' + sfx.style} style={style} aria-hidden="true">
      {sfx.text}{sfx.katakana && <small lang="ja">{sfx.katakana}</small>}
    </span>
  )
}
