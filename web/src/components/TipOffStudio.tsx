import { useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Film, Layers2, ScanLine, Sparkles, UploadCloud, Volume2, X } from 'lucide-react'

export type ArtStyle = 'authentic_manga' | 'selective_color' | 'hyperkinetic_anime'

interface TipOffStudioProps {
  file: File | null
  focus: string
  error: string
  onFile: (file: File | null) => void
  onFocus: (focus: string) => void
  onSubmit: () => void
}

const focusChips = [
  'Follow #23 in the 4th quarter comeback',
  'Focus on defense & coach reactions',
  'Capture the final-minute tension',
]

const styleOptions: { id: ArtStyle; name: string; tag: string }[] = [
  { id: 'authentic_manga', name: 'Authentic Ink', tag: 'B&W + Screentone' },
  { id: 'selective_color', name: 'Court Pop', tag: 'Ink + Orange Ball' },
  { id: 'hyperkinetic_anime', name: 'Shonen Cel', tag: 'Full Anime Color' },
]

export function TipOffStudio({ file, focus, error, onFile, onFocus, onSubmit }: TipOffStudioProps) {
  const uploader = useRef<HTMLInputElement>(null)
  const fileId = useId()
  const focusId = useId()
  const dragCount = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [validation, setValidation] = useState('')
  const [artStyle, setArtStyle] = useState<ArtStyle>('authentic_manga')
  const reduced = useReducedMotion()

  function pickVideo(video: File | undefined) {
    if (!video) return
    if (video.size === 0 || (!video.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(video.name))) {
      setValidation('Choose a playable video file (MP4, MOV, or WebM).')
      return
    }
    setValidation('')
    onFile(video)
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    pickVideo(event.currentTarget.files?.[0])
    event.currentTarget.value = ''
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setValidation('Upload a basketball video to generate a chapter.')
      uploader.current?.focus()
      return
    }
    onSubmit()
  }

  return (
    <section id="upload-game" className="studio-section" aria-labelledby="studio-title" tabIndex={-1}>
      <div className="content-shell">
        <motion.header className="landing-heading" initial={reduced ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
          <div className="eyebrow"><span /> Live Video Ingest</div>
          <h2 id="studio-title">Tip-Off Studio</h2>
        </motion.header>

        <div className="studio-grid">
          <section className="studio-card upload-card" aria-labelledby="upload-title">
            <div className="section-heading"><Film size={23} aria-hidden="true" /><h3 id="upload-title">Upload your game</h3></div>
            <form onSubmit={submit} className="upload-form">
              <div className="upload-field">
                <div className="form-label"><label htmlFor={fileId}>Game footage</label><span>MP4, MOV, WebM</span></div>
                <div className={'drop-zone' + (dragging ? ' is-dragging' : '') + (file ? ' has-file' : '')}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    if (!event.dataTransfer.types.includes('Files')) return
                    dragCount.current += 1
                    setDragging(true)
                  }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    dragCount.current = Math.max(0, dragCount.current - 1)
                    if (dragCount.current === 0) setDragging(false)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    dragCount.current = 0
                    setDragging(false)
                    pickVideo(event.dataTransfer.files[0])
                  }}>
                  <input ref={uploader} type="file" className="sr-only" id={fileId} accept="video/*,.mp4,.mov,.mkv,.m4v" onChange={handleFile} />
                  <label htmlFor={fileId} className="drop-target">
                    <span className="upload-icon">{file ? <Film size={23} /> : <UploadCloud size={24} />}</span>
                    <span className="drop-copy">
                      <strong>{file?.name ?? 'Drop basketball video here'}</strong>
                      <small>{file ? (file.size / 1_048_576).toFixed(1) + ' MB · Click to replace' : 'or browse files'}</small>
                    </span>
                  </label>
                  {file && <button type="button" className="remove-file" aria-label="Remove video" onClick={() => { onFile(null); setValidation('') }}><X size={18} /></button>}
                </div>
              </div>

              <div>
                <div className="form-label"><label htmlFor={focusId}>Story focus</label><span>Optional</span></div>
                <input id={focusId} className="focus-input" type="text" value={focus}
                  placeholder="e.g. Follow #23 in the 4th quarter comeback"
                  maxLength={400} onChange={(event) => onFocus(event.currentTarget.value)} />
                <div className="focus-chips" role="group" aria-label="Example story prompts">
                  {focusChips.map((chip) => (
                    <button key={chip} type="button" className={'focus-chip' + (focus === chip ? ' is-active' : '')}
                      onClick={() => onFocus(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="form-label"><span>Manga style</span><span>Powered by Hybrid Renderer</span></div>
                <div className="style-pills" role="radiogroup" aria-label="Manga art style">
                  {styleOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={artStyle === option.id}
                      className={'style-pill' + (artStyle === option.id ? ' is-selected' : '')}
                      onClick={() => setArtStyle(option.id)}
                    >
                      <strong>{option.name}</strong>
                      <small>{option.tag}</small>
                    </button>
                  ))}
                </div>
              </div>

              {(validation || error) && <p className="form-error" role="alert">{validation || error}</p>}
              <button type="submit" className="button button-primary generate-button"><Sparkles size={19} aria-hidden="true" /> Generate Manga Chapter</button>
            </form>
          </section>

          <aside className="studio-card demo-card studio-output-preview" aria-label="What gets generated">
            <div className="section-heading"><Sparkles size={22} aria-hidden="true" /><h3>From your clip</h3></div>
            <ul className="output-highlights">
              <li>
                <span className="output-icon"><Layers2 size={18} aria-hidden="true" /></span>
                <div><strong>Storyline Arc</strong><small>Action vs. Narrative Leverage separates clutch beats from empty dunks.</small></div>
              </li>
              <li>
                <span className="output-icon"><ScanLine size={18} aria-hidden="true" /></span>
                <div><strong>Ink Peel X-Ray</strong><small>Every panel links back to its exact FFmpeg source frame.</small></div>
              </li>
              <li>
                <span className="output-icon"><Volume2 size={18} aria-hidden="true" /></span>
                <div><strong>Verbatim Audio</strong><small>Quotes are grounded within ±2s of the panel—never invented.</small></div>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  )
}
