import type { MangaPanelData, MangaStoryboard, NarrativeRole, ReadingDirection } from '../types/manga'
import { mangaBackendUrl } from './format'
import { BackendUnavailable, wait, type JobResult } from './jobs'

type Clip = {
  clipId: string
  durationSec: number
  mediaUrl: string
  keyframes: { frameId: string; timestampSec: number; mediaUrl: string }[]
}

type ServerPanel = {
  panelId: string
  readingOrder: number
  sourceClipId: string
  sourceTimestamp: number
  narrativeStage: 'introduction' | 'rising_action' | 'conflict' | 'climax' | 'resolution'
  cameraShot: string
  size: 'small' | 'medium' | 'large' | 'splash'
  layout: NonNullable<MangaPanelData['layout']>
  caption: string | null
  sfx: string | null
  sfxSubtext: string | null
  illustration: { assetUrl: string | null; renderer: 'hybrid' | 'frame_guided' | 'svg_vector'; referenceFrameIds: string[] }
}

type Project = {
  clips: Clip[]
  storyboard: {
    title: string
    subtitle: string
    summary: string
    readingDirection: ReadingDirection
    pages: { pageNumber: number; panels: ServerPanel[] }[]
  }
}

type ServerJob = {
  jobId: string
  storyId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  currentStage: string
  stages: { id: string; detail: string }[]
  error: string | null
}

const roles: Record<ServerPanel['narrativeStage'], NarrativeRole> = {
  introduction: 'setup', rising_action: 'escalation', conflict: 'struggle', climax: 'climax', resolution: 'aftermath',
}

const stageIndices: Record<string, number> = {
  reference_analysis: 0, clip_analysis: 1, character_references: 1, narrative_planning: 2,
  storyboard_generation: 2, carbon_illustration: 3, page_composition: 3, quality_validation: 3, completion: 3,
}

async function request<T>(path: string, signal: AbortSignal, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(mangaBackendUrl(path), { ...init, signal })
  } catch (error) {
    signal.throwIfAborted()
    throw new BackendUnavailable('The manga backend could not be reached.', { cause: error })
  }
  const isJson = response.headers.get('content-type')?.includes('json')
  const body = isJson ? await response.json().catch(() => null) : null
  if (!body && (!isJson || response.status === 404)) {
    throw new BackendUnavailable('The manga backend did not return an API response.')
  }
  if (!response.ok || !body) {
    throw new Error(typeof body?.error === 'string' ? body.error : 'The manga backend returned HTTP ' + response.status + '.')
  }
  return body as T
}

export async function findMangaBackend(signal: AbortSignal) {
  try {
    const state = await request<{ apiKeyConfigured?: boolean }>('/api/status', AbortSignal.any([signal, AbortSignal.timeout(8000)]))
    return typeof state.apiKeyConfigured === 'boolean' ? { apiKeyConfigured: state.apiKeyConfigured } : null
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof BackendUnavailable || (error instanceof DOMException && error.name === 'TimeoutError')) return null
    throw error
  }
}

function adaptPanel(panel: ServerPanel, clips: Map<string, Clip>): MangaPanelData {
  const clip = clips.get(panel.sourceClipId)
  const { assetUrl, renderer, referenceFrameIds } = panel.illustration
  if (!assetUrl) throw new Error('The generated chapter contains a panel without artwork.')

  const frameId = referenceFrameIds[0]
  const frame = clip?.keyframes.find((item) => item.frameId === frameId)
  const extractedTimestamp = frameId && clip && new RegExp('^' + encodeURIComponent(clip.clipId) + '_t(\\d+)$').exec(frameId)?.[1]
  const timestamp = frame?.timestampSec ?? (extractedTimestamp ? Number(extractedTimestamp) / 100 : panel.sourceTimestamp)
  const sourceFrame = frame?.mediaUrl ?? (clip && extractedTimestamp
    ? '/api/media/keyframes/' + encodeURIComponent(clip.clipId) + '/' + encodeURIComponent(frameId) + '.png'
    : undefined)
  const clipStart = Math.max(0, timestamp - 0.6)
  const clipEnd = clip && Math.min(clip.durationSec, clipStart + 3)

  return {
    panel_id: panel.panelId,
    reading_order: panel.readingOrder,
    slot: panel.size === 'splash' ? 'splash_hero' : 'top_wide',
    layout: panel.layout,
    candidate_id: panel.sourceClipId,
    narrative_role: roles[panel.narrativeStage],
    visual_intensity: panel.narrativeStage === 'climax' ? 'explosive' : panel.size === 'small' ? 'quiet' : 'medium',
    crop_focus: panel.cameraShot.includes('closeup') ? 'tight_face' : 'full_action',
    action_bbox_norm: null,
    narration_box: panel.caption ?? '',
    caption_quote: null,
    sfx: { text: panel.sfx ?? '', katakana: panel.sfxSubtext ?? undefined, style: panel.sfx ? 'heavy' : 'none' },
    effects: { speed_lines: 'none', impact_burst: false },
    assets: {
      panel_image_url: assetUrl,
      source_frame_url: sourceFrame,
      source_clip_url: clip && clipEnd !== undefined ? clip.mediaUrl + '#t=' + clipStart.toFixed(2) + ',' + clipEnd.toFixed(2) : undefined,
    },
    provenance: { timestamp_sec: timestamp, ink_method: renderer, edge_iou: null, decision_fidelity_score: null, scores: null },
  }
}

function adaptChapter(project: Project, jobId: string, focus: string): JobResult {
  const { storyboard } = project
  if (!Array.isArray(storyboard?.pages) || storyboard.pages.length === 0) throw new Error('The manga backend returned an empty chapter.')
  const clips = new Map(project.clips.map((clip) => [clip.clipId, clip]))
  const story: MangaStoryboard = {
    job_id: jobId,
    title: storyboard.title,
    subtitle: storyboard.subtitle,
    user_focus: focus,
    reading_direction: storyboard.readingDirection,
    arc_summary: storyboard.summary,
    pages: storyboard.pages.map((page) => ({
      page_number: page.pageNumber,
      layout_template: 'source_layout',
      source_direction: storyboard.readingDirection,
      panels: page.panels.map((panel) => adaptPanel(panel, clips)),
    })),
  }
  return { story, metrics: { duration_sec: project.clips.reduce((total, clip) => total + clip.durationSec, 0) } }
}

export async function generateWithMangaBackend({ video, focus, direction, onStage, signal }: {
  video?: File
  focus: string
  direction: ReadingDirection
  onStage: (stage: number, detail: string) => void
  signal: AbortSignal
}): Promise<JobResult> {
  let clips: Clip[]
  if (video) {
    const form = new FormData()
    form.set('file', video)
    const result = await request<{ uploaded: Clip[] }>('/api/clips/upload', signal, { method: 'POST', body: form })
    clips = result.uploaded
  } else {
    const result = await request<{ clips: Clip[] }>('/api/clips/samples', signal, { method: 'POST' })
    clips = result.clips.filter((clip) => /^clip_sample_0[1-5]$/.test(clip.clipId))
  }
  if (!clips?.length) throw new Error('The manga backend returned no clips for this chapter.')

  let { job } = await request<{ job: ServerJob }>('/api/manga/generate', signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clipIds: clips.map((clip) => clip.clipId),
      mode: video ? 'real' : 'demo',
      preferences: { targetPages: 2, readingDirection: direction, directorNotes: focus },
    }),
  })
  if (!job?.jobId) throw new Error('The manga backend did not return a job ID.')
  const jobUrl = '/api/manga/jobs/' + encodeURIComponent(job.jobId)
  const deadline = Date.now() + 12 * 60_000
  while (job.status !== 'completed') {
    if (job.status === 'failed') throw new Error(job.error || 'The manga backend could not finish the chapter.')
    if (Date.now() > deadline) throw new Error('The manga job took too long to finish.')
    const detail = job.stages.find((stage) => stage.id === job.currentStage)?.detail ?? ''
    onStage(stageIndices[job.currentStage] ?? 0, detail)
    await wait(1000, signal)
    ;({ job } = await request<{ job: ServerJob }>(jobUrl, signal))
  }
  const { project } = await request<{ project: Project }>('/api/manga/' + encodeURIComponent(job.storyId), signal)
  return adaptChapter(project, job.jobId, focus)
}
