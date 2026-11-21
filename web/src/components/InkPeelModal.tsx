import { useEffect, useRef, useState } from 'react'
import { AudioLines, Clock3, Crop, ScanLine, ShieldCheck, X } from 'lucide-react'
import { formatTime, humanize, inkLabel, mediaUrl, pct } from '../lib/format'
import type { MangaPanelData } from '../types/manga'
import { InkPeelSlider } from './InkPeelSlider'

function ScoreBar({ title, value, kind }: { title: string; value: number; kind: string }) {
  return (
    <div className={'score score-' + kind}>
      <div><span>{title}</span><strong>{pct(value)}</strong></div>
      <meter min={0} max={1} value={value} aria-label={title}>{pct(value)}</meter>
    </div>
  )
}

export function InkPeelModal({ panel, demo, onClose }: { panel: MangaPanelData; demo: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [crop, setCrop] = useState(false)
  const { assets, provenance } = panel
  const { scores } = provenance
  const verified = provenance.ink_method === 'nano_banana_verified'

  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  return (
    <dialog ref={dialog} className="peel-dialog" aria-labelledby="peel-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="dialog-surface">
        <header className="peel-header">
          <div>
            <span className="peel-kicker"><ScanLine size={15} aria-hidden="true" /> Panel {String(panel.reading_order).padStart(2, '0')}</span>
            <h2 id="peel-title">Ink Peel</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close Ink Peel" autoFocus><X size={22} /></button>
        </header>
        <div className="peel-body">
          <section className="peel-media" aria-label="Frame comparison">
            {assets.source_frame_url ? <InkPeelSlider assets={{ ...assets, source_frame_url: assets.source_frame_url }}
              sourceLabel={demo ? 'Sample frame' : 'Source frame'} crop={crop ? panel : undefined} />
              : <img className="peel-panel-image" src={mediaUrl(assets.panel_image_url)} alt="Rendered manga panel" />}
            <div className="peel-toolbar">
              <span><Clock3 size={16} aria-hidden="true" /> <time>{formatTime(provenance.timestamp_sec)}</time></span>
              {assets.source_frame_url && panel.action_bbox_norm && <button type="button" className="button button-small crop-toggle" aria-pressed={crop}
                onClick={() => setCrop(!crop)}><Crop size={16} aria-hidden="true" /> Smart crop</button>}
            </div>
            {assets.source_clip_url && (
              <div className="clip-block">
                <h3>Source clip</h3>
                <video controls preload="metadata" playsInline src={mediaUrl(assets.source_clip_url)} />
              </div>
            )}
            {panel.caption_quote && <blockquote className="peel-quote">
              <AudioLines size={19} aria-hidden="true" />
              <div><p>“{panel.caption_quote.text}”</p><cite>{demo ? 'Sample quote' : 'Commentator audio'} · {formatTime(panel.caption_quote.timestamp_sec)}</cite></div>
            </blockquote>}
            {demo && <p className="sample-note">{scores ? 'The offline demo uses fictional frames and illustrative timestamps and scores.' : 'The pipeline demo uses synthetic basketball clips.'}</p>}
          </section>
          <aside className="peel-evidence" aria-label="Panel provenance">
            {scores && <section className="evidence-card">
              <span className="role-tag">{humanize(panel.narrative_role)}</span>
              <h3>Why this beat?</h3>
              <ScoreBar kind="action" title="Action spectacle" value={scores.action_spectacle} />
              <ScoreBar kind="story" title="Narrative leverage" value={scores.narrative_leverage} />
              <ScoreBar kind="focus" title="User focus match" value={scores.user_focus_match} />
            </section>}
            <section className="evidence-card fidelity-card">
              <h3><ShieldCheck size={20} aria-hidden="true" /> {scores ? 'Fidelity Gate' : 'Rendering method'}</h3>
              <span className={'method-tag' + (verified ? ' is-verified' : '')}>{inkLabel(provenance.ink_method)}</span>
              {scores && !verified && <p>OpenCV is the deterministic baseline and fallback renderer.</p>}
              {(!scores) && <p>Edge-IoU and Decisions scores are unavailable for this chapter.</p>}
              {(provenance.edge_iou !== null || provenance.decision_fidelity_score !== null) && <dl>
                {provenance.edge_iou !== null && <div><dt>Edge-IoU</dt><dd>{pct(provenance.edge_iou)}</dd></div>}
                {provenance.decision_fidelity_score !== null && <div><dt>Decision fidelity</dt><dd>{pct(provenance.decision_fidelity_score)}</dd></div>}
              </dl>}
            </section>
          </aside>
        </div>
      </div>
    </dialog>
  )
}
