import { motion, useReducedMotion } from 'framer-motion'
import { Maximize2, Mic } from 'lucide-react'
import { formatTime, humanize, inkLabel, mediaUrl, pct } from '../lib/format'
import type { MangaPanelData } from '../types/manga'
import { PanelEffects, PanelSfx } from './PanelEffects'

export function MangaPanel({ panel, index, visible, revealing, judge, mirrorLayout, onOpen }: {
  panel: MangaPanelData
  index: number
  visible: boolean
  revealing: boolean
  judge: boolean
  mirrorLayout: boolean
  onOpen: (panel: MangaPanelData) => void
}) {
  const reduced = useReducedMotion()
  const { provenance } = panel
  const motionEnabled = revealing && !reduced
  const explosive = panel.visual_intensity === 'explosive'
  const quiet = panel.visual_intensity === 'quiet'
  const order = String(panel.reading_order).padStart(2, '0')
  const { layout } = panel
  const placement = layout && {
    left: (mirrorLayout ? 1 - layout.x - layout.width : layout.x) * 100 + '%',
    top: layout.y * 100 + '%',
    width: layout.width * 100 + '%',
    height: layout.height * 100 + '%',
  }

  return (
    <div className="panel-shell" style={placement} data-index={index} data-slot={panel.slot} data-panel-id={panel.panel_id}>
      {visible ? (
        <motion.button type="button" className="manga-panel" dir="ltr" onClick={() => onOpen(panel)}
          aria-label={'Inspect panel ' + panel.reading_order + ': ' + panel.narration_box}
          initial={motionEnabled ? { opacity: 0, scale: explosive ? 1.16 : quiet ? 1.04 : 1, x: explosive ? -7 : 0 } : false}
          animate={explosive && motionEnabled ? { opacity: 1, scale: 1, x: [-7, 5, -2, 0] } : { opacity: 1, scale: 1, x: 0 }}
          transition={explosive && motionEnabled
            ? { opacity: { duration: 0.13 }, scale: { type: 'spring', stiffness: 520, damping: 24 }, x: { duration: 0.26 } }
            : { duration: motionEnabled ? (quiet ? 0.68 : 0.32) : 0 }}>
          <img className="panel-image" src={mediaUrl(panel.assets.panel_image_url)} alt="" draggable={false} />
          <PanelEffects panel={panel} />
          <span className="panel-order" aria-hidden="true">{order}</span>
          <span className="panel-inspect" aria-hidden="true"><Maximize2 size={15} /></span>
          {panel.narration_box && <span className="narration-box">{panel.narration_box}</span>}
          {panel.caption_quote && (
            <span className="caption-quote">
              <span>{panel.caption_quote.text}</span>
              <small><Mic size={10} aria-hidden="true" /> {formatTime(panel.caption_quote.timestamp_sec)}</small>
            </span>
          )}
          {panel.thought_bubble && <span className="thought-bubble" title={panel.thought_bubble.grounding_cue}>
            <span className="sr-only">{panel.thought_bubble.subject} (inner thought): </span>{panel.thought_bubble.text}
          </span>}
          <PanelSfx panel={panel} />
          {judge && <span className="panel-judge">
            <strong>{humanize(panel.narrative_role)}</strong>
            {provenance.scores && <span>Action {pct(provenance.scores.action_spectacle)} / Story {pct(provenance.scores.narrative_leverage)}</span>}
            <span>{provenance.edge_iou !== null && <>Edge-IoU {pct(provenance.edge_iou)} · </>}{inkLabel(provenance.ink_method)}</span>
          </span>}
        </motion.button>
      ) : (
        <div className="panel-hidden" aria-label={'Panel ' + panel.reading_order + ' is hidden'} dir="ltr"><span>{order}</span></div>
      )}
    </div>
  )
}
