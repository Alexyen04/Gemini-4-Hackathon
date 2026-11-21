import { sortPanels } from '../lib/format'
import type { MangaPageData, MangaPanelData, ReadingDirection } from '../types/manga'
import { MangaPanel } from './MangaPanel'

export function MangaPage({ page, direction, judge, revealing, revealed, onOpen }: {
  page: MangaPageData
  direction: ReadingDirection
  judge: boolean
  revealing: boolean
  revealed: Set<string>
  onOpen: (panel: MangaPanelData) => void
}) {
  const panels = sortPanels(page.panels)
  return (
    <article className="manga-page" aria-label={'Page ' + page.page_number}>
      <div className="page-running-head"><span>COURT<span>//</span>INK</span><span>Page {String(page.page_number).padStart(2, '0')}</span></div>
      <div className={'page-grid layout-' + page.layout_template} dir={direction} data-count={panels.length}>
        {panels.map((panel, index) => (
          <MangaPanel key={panel.panel_id} panel={panel} index={index} visible={!revealing || revealed.has(panel.panel_id)}
            revealing={revealing} judge={judge} mirrorLayout={!!page.source_direction && direction !== page.source_direction} onOpen={onOpen} />
        ))}
      </div>
    </article>
  )
}
