import { isPlayurlApi } from './catalog.ts'
import { parseMediaUrl } from './url-policy.ts'
import { type PlaybackNavigationIdentity, type PlayurlRequestContext } from './playurl-model.ts'

const numericId = (value: string): string | null =>
  /^[0-9]{1,20}$/.test(value) ? value.replace(/^0+/, '') || null : null
const bvid = (value: string): string | null => (/^BV[0-9A-Za-z]{10}$/.test(value) ? value : null)
const aidKeys = ['aid', 'avid', 'oid']
const episodeKeys = ['ep_id', 'epid']

function checkedIdentity(query: URLSearchParams, pathId: Partial<PlaybackNavigationIdentity> = {}) {
  const read = (
    keys: readonly string[],
    parse: (value: string) => string | null,
    path?: string | null,
  ) => {
    const values = keys.flatMap((key) => query.getAll(key))
    if (!values.length) return path ?? null
    const value = values.length === 1 ? parse(values[0]!) : null
    return value && (!path || value === path) ? value : undefined
  }
  const video = read(['bvid'], bvid, pathId.bvid)
  const aid = read(aidKeys, numericId, pathId.aid)
  const episode = read(episodeKeys, numericId, pathId.episode)
  const part = read(['p'], numericId)
  if (video === undefined || aid === undefined || episode === undefined || part === undefined)
    return null
  return { bvid: video, aid, episode, part }
}

const navigationIds = ['bvid', 'aid', 'episode'] as const
function hasSameId(left: PlaybackNavigationIdentity, right: PlaybackNavigationIdentity): boolean {
  const shared = navigationIds.filter((id) => left[id] && right[id])
  return shared.length > 0 && shared.every((id) => left[id] === right[id])
}

function navigationPage(key: string) {
  const [path = '', search] = key.split(/\?(.*)/s, 2)
  const query = new URLSearchParams(search)
  const video = /^\/video\/([^/]+)\/?$/.exec(path)?.[1]
  const episode = /^\/bangumi\/play\/ep([0-9]+)\/?$/.exec(path)?.[1]
  const list = /^\/(?:list|watchlater)(?:\/|$)/.test(path)
  if (!video && !episode && !list) return null
  const pathId: (typeof navigationIds)[number] | null = episode
    ? 'episode'
    : video?.startsWith('av')
      ? 'aid'
      : video
        ? 'bvid'
        : null
  const canonical = episode
    ? numericId(episode)
    : video?.startsWith('av')
      ? numericId(video.slice(2))
      : video
        ? bvid(video)
        : null
  if (pathId && !canonical) return null
  const identity = checkedIdentity(query, pathId ? { [pathId]: canonical } : {})
  const cids = query.getAll('cid')
  const cid = cids.length === 1 ? numericId(cids[0]!) : null
  if (!identity || (cids.length && !cid)) return null
  for (const key of ['bvid', ...aidKeys, ...episodeKeys, 'cid', 'p']) query.delete(key)
  return { path, pathId, identity, cid, list, remainingQuery: query.toString() }
}

export function matchesPlayurlNavigation(
  previousKey: string,
  key: string,
  context: PlayurlRequestContext,
  changedContent: boolean,
): boolean {
  const previous = navigationPage(previousKey),
    next = navigationPage(key),
    target = context.navigation
  if (!next || !target || !context.contentId || !hasSameId(next.identity, target)) return false
  if (next.pathId && target[next.pathId] !== next.identity[next.pathId]) return false
  if (previous && previous.remainingQuery !== next.remainingQuery) return false
  if (next.cid && next.cid !== context.contentId) return false
  const nextPart = next.identity.part ?? '1'
  if (target.part && target.part !== nextPart) return false
  if (previous && hasSameId(previous.identity, next.identity)) {
    if ((previous.identity.part ?? '1') === nextPart) return false
    if (!target.part && !next.cid) return false
  } else if (nextPart !== '1' && !target.part && !next.cid) return false
  if (changedContent) return true
  return (
    !!previous?.list &&
    previous.path === next.path &&
    !navigationIds.some((id) => previous.identity[id]) &&
    (previous.identity.part ?? '1') === nextPart
  )
}

export function playurlRequestContext(value: string, base?: string): PlayurlRequestContext {
  if (!isPlayurlApi(value, base)) return Object.freeze({ contentId: null })
  const url = new URL(value, base),
    query = url.searchParams
  const values = query.getAll('cid')
  const contentId = values.length === 1 ? numericId(values[0]!) : null
  const main = query.getAll('is_main_page'),
    sources = query.getAll('gaia_source')
  if (main.includes('false') || sources.some((kind) => kind === 'pre-load' || kind === 'view-card'))
    return Object.freeze({ contentId, auxiliary: true })
  const navigation =
    url.protocol === 'https:' &&
    !url.port &&
    !url.username &&
    !url.password &&
    /^\/(?:x\/player\/(?:wbi\/)?playurl|ogv\/player\/playview)$/.test(url.pathname) &&
    main.length === 1 &&
    main[0] === 'true' &&
    sources.every((kind) => !kind)
      ? checkedIdentity(query)
      : null
  return Object.freeze({
    contentId,
    ...(navigation && navigationIds.some((id) => navigation[id])
      ? { navigation: Object.freeze(navigation) }
      : {}),
  })
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
    const path = parsed.url.pathname,
      parent = path.slice(0, path.lastIndexOf('/'))
    if (parent) result.add(parent)
  }
  return [...result].sort()
}

const merge = (
  current: readonly string[],
  previous: readonly string[],
  limit: number,
): readonly string[] => {
  const result = new Set(current.slice(0, limit))
  for (const value of [...previous].sort()) {
    if (result.size >= limit) break
    result.add(value)
  }
  return Object.freeze([...result].sort())
}

export function observePlayurlContent(
  previous: PlayurlContentIdentity | null,
  videoUrls: readonly string[],
  audioUrls: readonly string[],
  context?: PlayurlRequestContext,
): {
  readonly identity: PlayurlContentIdentity | null
  readonly changed: boolean
} {
  const video = directories(videoUrls),
    audio = directories(audioUrls),
    contentId = context?.contentId ?? null
  if (!contentId && !video.length && !audio.length) return { identity: previous, changed: false }
  let changed = false
  if (previous?.contentId && contentId) changed = previous.contentId !== contentId
  else if (previous && (previous.video.length || previous.audio.length)) {
    // Shared audio must never conceal a different video inventory.
    const before = previous.video.length ? previous.video : previous.audio
    const next = video.length ? video : audio
    changed =
      Boolean(previous.video.length) !== Boolean(video.length) ||
      !next.some((value) => before.includes(value))
  }
  const retained = changed ? null : previous
  return {
    changed,
    identity: Object.freeze({
      contentId: contentId ?? retained?.contentId ?? null,
      video: merge(video, retained?.video ?? [], 128),
      audio: merge(audio, retained?.audio ?? [], 64),
    }),
  }
}
