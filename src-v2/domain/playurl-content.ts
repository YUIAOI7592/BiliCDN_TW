import { isPlayurlApi } from './catalog.ts'
import { parseMediaUrl } from './url-policy.ts'
import type { PlayurlRequestContext } from './playurl-model.ts'

export function playurlRequestContext(value: string, base?: string): PlayurlRequestContext {
  let contentId: string | null = null
  if (isPlayurlApi(value, base)) {
    const values = new URL(value, base).searchParams.getAll('cid')
    if (values.length === 1 && /^[0-9]{1,20}$/.test(values[0]!)) {
      contentId = values[0]!.replace(/^0+/, '') || null
    }
  }
  return Object.freeze({ contentId })
}

/** Private controller memory. These directories must not be exported or persisted. */
export interface PlayurlContentIdentity {
  readonly contentId: string | null
  readonly video: readonly string[]
  readonly audio: readonly string[]
}

const directories = (urls: readonly string[]): readonly string[] => {
  const result = new Set<string>()
  for (const value of urls) {
    const parsed = parseMediaUrl(value)
    if (!parsed) continue
    const path = parsed.url.pathname, parent = path.slice(0, path.lastIndexOf('/'))
    if (parent) result.add(parent)
  }
  return [...result].sort()
}

const merge = (current: readonly string[], previous: readonly string[], limit: number): readonly string[] => {
  const result = new Set(current.slice(0, limit))
  for (const value of [...previous].sort()) {
    if (result.size >= limit) break
    result.add(value)
  }
  return Object.freeze([...result].sort())
}

export function observePlayurlContent(previous: PlayurlContentIdentity | null,
  videoUrls: readonly string[], audioUrls: readonly string[], context?: PlayurlRequestContext): {
    readonly identity: PlayurlContentIdentity | null; readonly changed: boolean
  } {
  const video = directories(videoUrls), audio = directories(audioUrls), contentId = context?.contentId ?? null
  if (!contentId && !video.length && !audio.length) return { identity: previous, changed: false }
  let changed = false
  if (previous?.contentId && contentId) changed = previous.contentId !== contentId
  else if (previous && (previous.video.length || previous.audio.length)) {
    // Shared audio must never conceal a different video inventory.
    const before = previous.video.length ? previous.video : previous.audio
    const next = video.length ? video : audio
    changed = Boolean(previous.video.length) !== Boolean(video.length) || !next.some(value => before.includes(value))
  }
  const retained = changed ? null : previous
  return { changed, identity: Object.freeze({ contentId: contentId ?? retained?.contentId ?? null,
    video: merge(video, retained?.video ?? [], 128), audio: merge(audio, retained?.audio ?? [], 64) }) }
}
