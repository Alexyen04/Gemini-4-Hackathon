import type { JobMetrics, MangaStoryboard, ReadingDirection } from '../types/manga'
import { backendUrl } from './format'

type JobResponse = Partial<MangaStoryboard> & {
  id?: string
  status?: string
  stage?: number | string
  progress?: number
  error?: string
  detail?: string | unknown[]
  storyboard?: MangaStoryboard
  result?: MangaStoryboard
  metrics?: JobMetrics
}

export interface JobResult {
  story: MangaStoryboard
  metrics?: JobMetrics
}

export class BackendUnavailable extends Error {}

export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    function abort() {
      window.clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

async function request(path: string, options: RequestInit): Promise<JobResponse> {
  let response: Response
  try {
    response = await fetch(backendUrl(path), options)
  } catch (error) {
    options.signal?.throwIfAborted()
    throw new BackendUnavailable('The job service could not be reached.', { cause: error })
  }

  if ([404, 405, 501, 502, 503, 504].includes(response.status)) {
    throw new BackendUnavailable('The job service is unavailable.')
  }

  const json = response.headers.get('content-type')?.includes('json')
  // The Vite proxy sends an empty 500 response when the local upstream is unreachable.
  if (import.meta.env.DEV && response.status === 500 && !json && !(await response.text()).trim()) {
    throw new BackendUnavailable('The local FastAPI server could not be reached.')
  }
  const payload = json ? await response.json().catch(() => null) as JobResponse | null : null

  if (!response.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : payload?.error
    throw new Error(detail || 'The job service rejected this request (' + response.status + ').')
  }

  if (!payload || typeof payload !== 'object') {
    throw new BackendUnavailable('The URL did not return a job response.')
  }
  return payload
}

function readResult(job: JobResponse): JobResult | undefined {
  const story = job.storyboard ?? job.result ?? job
  if (typeof story.job_id === 'string' && typeof story.title === 'string'
    && Array.isArray(story.pages) && story.pages.length > 0
    && story.pages.every((page) => Array.isArray(page.panels) && page.panels.length > 0)) {
    return { story: story as MangaStoryboard, metrics: job.metrics }
  }
}

function stageIndex(job: JobResponse) {
  const stage = job.stage
  if (typeof stage === 'number' && Number.isFinite(stage)) return Math.max(0, Math.min(3, Math.trunc(stage)))
  if (typeof stage === 'string') {
    if (/cast|ink|render|story|extract|direct/i.test(stage)) return 3
    if (/scor|rank|leverage/i.test(stage)) return 2
    if (/scout|analy/i.test(stage)) return 1
    if (/chunk|plan/i.test(stage)) return 0
  }
  if (typeof job.progress === 'number' && Number.isFinite(job.progress)) {
    const fraction = job.progress > 1 ? job.progress / 100 : job.progress
    return Math.max(0, Math.min(3, Math.floor(fraction * 4)))
  }
  return 0
}

export async function generateManga(
  video: File,
  userFocus: string,
  direction: ReadingDirection,
  onStage: (stage: number) => void,
  signal: AbortSignal,
): Promise<JobResult> {
  const form = new FormData()
  form.set('video', video)
  form.set('user_focus', userFocus)
  form.set('target_pages', '2')
  form.set('reading_direction', direction)
  form.set('enable_nano_banana', 'false')

  let job = await request('/api/jobs', { method: 'POST', body: form, signal })

  const id = job.job_id ?? job.id
  const deadline = Date.now() + 12 * 60_000
  while (true) {
    signal.throwIfAborted()
    const result = readResult(job)
    if (result) return result
    const status = job.status?.toLowerCase() ?? ''
    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) {
      throw new Error(job.error || (typeof job.detail === 'string' ? job.detail : 'The manga job could not be completed.'))
    }
    if (['completed', 'succeeded', 'success', 'done'].includes(status)) {
      throw new Error('The job finished without an available storyboard.')
    }
    if (!id) throw new Error('The job service returned no job identifier.')
    if (Date.now() > deadline) throw new Error('The job took too long to finish. Try a shorter clip.')
    onStage(stageIndex(job))
    await wait(1250, signal)
    job = await request('/api/jobs/' + encodeURIComponent(id), { signal })
  }
}
