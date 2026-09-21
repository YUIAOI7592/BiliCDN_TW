import { catalogIndex, TRUSTED_CATALOG_SET } from '../domain/catalog.ts'
import { isKnownNativeFamily, parseMediaUrl } from '../domain/url-policy.ts'
import {
  representationId, signedRouteHandle, type EpochId, type GenerationId, type MediaKind, type NativeCandidate,
  type RepresentationId, type RootCandidate, type RouteIdentity, type SignedRouteHandle, type AttributionStatus, type AttributionSource,
} from '../domain/model.ts'

const MAX_VIDEO_GROUPS = 128
const MAX_AUDIO_GROUPS = 64
const MAX_URLS_PER_GROUP = 4
const MAX_URL_CHARS = 1024 * 1024

export interface RegisterRepresentationInput {
  readonly generation: GenerationId
  readonly epoch: EpochId
  readonly kind: MediaKind
  readonly key: string
  readonly height: number
  readonly codec: string
  readonly bandwidth: number
  readonly urls: readonly string[]
  readonly source: 'trusted-api' | 'player-mpd' | 'page-hint' | 'transport'
}

interface StoredRoute { readonly handle: SignedRouteHandle; readonly host: string; readonly url: string; readonly order: number; readonly activelyExplorable: boolean }
interface Group { readonly identity: RouteIdentity; readonly height: number; readonly codec: string; readonly bandwidth: number; readonly source: RegisterRepresentationInput['source']; readonly routes: readonly StoredRoute[] }

export class SignedRouteVault {
  #generation: GenerationId | null = null
  #epoch: EpochId | null = null
  #groups = new Map<RepresentationId, Group>()
  #byKey = new Map<string, RepresentationId>()
  #byUrl = new Map<string, Set<RepresentationId>>()
  #aliases = new Map<string, Set<RepresentationId>>()
  #byPath = new Map<string, Set<RepresentationId>>()
  #handles = new Map<SignedRouteHandle, { readonly representation: RepresentationId; readonly url: string }>()
  #invalid = new Map<RepresentationId, Set<string>>()
  #outputs = new Map<string, { representation: RepresentationId; role: 'primary' | 'backup'; hostChanged: boolean } | null>()
  #urlChars = 0
  #serial = 0

  reset(generation: GenerationId, epoch: EpochId): void {
    this.#generation = generation
    this.#outputs.clear()
    this.#epoch = epoch
    this.#groups.clear(); this.#byKey.clear(); this.#byUrl.clear(); this.#aliases.clear(); this.#byPath.clear(); this.#handles.clear(); this.#invalid.clear(); this.#urlChars = 0; this.#serial = 0
  }

  register(input: RegisterRepresentationInput): RepresentationId | null {
    if (input.generation !== this.#generation || input.epoch !== this.#epoch) return null
    const key = `${input.kind}:${input.key}:${input.codec}:${input.height}`
    const priorId = this.#byKey.get(key), prior = priorId ? this.#groups.get(priorId) : undefined
    const cap = input.kind === 'video' ? MAX_VIDEO_GROUPS : MAX_AUDIO_GROUPS
    if (!prior && [...this.#groups.values()].filter(group => group.identity.kind === input.kind).length >= cap) return null
    const rep = priorId ?? representationId(`${input.kind}:group-${++this.#serial}`)
    const routes: StoredRoute[] = [...(prior?.routes ?? [])]
    for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
      const parsed = parseMediaUrl(raw)
      if (!parsed || parsed.kind !== 'normal' || this.#urlChars + raw.length > MAX_URL_CHARS) continue
      if (routes.some(route => route.url === parsed.url.href)) continue
      if (routes.length >= MAX_URLS_PER_GROUP) { this.registerAlias(rep, parsed.url.href); continue }
      const handle = signedRouteHandle(`route:${rep}:${routes.length + 1}`)
      routes.push(Object.freeze({ handle, host: parsed.host, url: parsed.url.href, order: routes.length,
        activelyExplorable: isKnownNativeFamily(parsed.host) }))
      this.#handles.set(handle, { representation: rep, url: parsed.url.href })
      this.#index(this.#byUrl, parsed.url.href, rep)
      this.#index(this.#byPath, parsed.url.pathname, rep)
      this.#urlChars += parsed.url.href.length
    }
    if (!routes.length) return null
    this.#byKey.set(key, rep)
    const identity: RouteIdentity = Object.freeze({ generation: input.generation, epoch: input.epoch, representation: rep, kind: input.kind })
    this.#groups.set(rep, Object.freeze({ identity, height: input.height, codec: input.codec.slice(0, 48), bandwidth: input.bandwidth,
      source: prior?.source === 'trusted-api' ? prior.source : input.source, routes: Object.freeze(routes) }))
    return rep
  }

  contextForUrl(url: string): RouteIdentity | null {
    const match = this.match(url)
    return match.status === 'matched' ? match.context : null
  }

  match(url: string): { context: RouteIdentity | null; status: AttributionStatus; source: AttributionSource } {
    const parsed = parseMediaUrl(url)
    if (!parsed || parsed.kind !== 'normal') return { context: null, status: 'waiting-data', source: 'none' }
    for (const [index, source] of [[this.#byUrl, 'exact'], [this.#aliases, 'catalog-alias'], [this.#byPath, 'path-hint']] as const) {
      const reps = index.get(source === 'path-hint' ? parsed.url.pathname : parsed.url.href)
      if (!reps?.size) continue
      if (reps.size !== 1) return { context: null, status: 'ambiguous', source }
      const rep = [...reps][0], context = rep ? this.#groups.get(rep)?.identity ?? null : null
      return { context, status: source === 'path-hint' ? 'weak' : 'matched', source }
    }
    return { context: null, status: 'waiting-data', source: 'none' }
  }

  registerAlias(rep: RepresentationId, url: string): void {
    const parsed = parseMediaUrl(url)
    if (!parsed || parsed.kind !== 'normal' || this.#aliases.size >= 1024 || this.#urlChars + url.length > MAX_URL_CHARS) return
    if (!this.#aliases.has(parsed.url.href)) this.#urlChars += parsed.url.href.length
    this.#index(this.#aliases, parsed.url.href, rep)
    this.#index(this.#byPath, parsed.url.pathname, rep)
  }

  registerOutput(rep: RepresentationId, original: string, primary: string, backups: readonly string[]): void {
    const originalHost = parseMediaUrl(original)?.host
    for (const [index, url] of [primary, ...backups].entries()) {
      const parsed = parseMediaUrl(url)
      if (!parsed || this.#outputs.size >= 1152 || this.#urlChars + url.length > MAX_URL_CHARS) continue
      const prior = this.#outputs.get(parsed.url.href)
      if (prior === null || (prior && prior.representation !== rep)) { this.#outputs.set(parsed.url.href, null); continue }
      if (!this.#outputs.has(parsed.url.href)) this.#urlChars += url.length
      this.#outputs.set(parsed.url.href, { representation: rep, role: index === 0 ? 'primary' : 'backup', hostChanged: !!originalHost && originalHost !== parsed.host })
    }
  }

  outputRole(rep: RepresentationId, url: string): { role: 'primary' | 'backup'; hostChanged: boolean } | null {
    const parsed = parseMediaUrl(url), row = parsed ? this.#outputs.get(parsed.url.href) : null
    return row?.representation === rep ? { role: row.role, hostChanged: row.hostChanged } : null
  }

  #index(index: Map<string, Set<RepresentationId>>, key: string, rep: RepresentationId): void {
    const rows = index.get(key) ?? new Set<RepresentationId>()
    rows.add(rep); index.set(key, rows)
  }

  candidates(representation: RepresentationId, unlockedHosts: ReadonlySet<string>): { readonly native: readonly NativeCandidate[]; readonly root: RootCandidate | null } {
    const group = this.#groups.get(representation)
    if (!group) return { native: Object.freeze([]), root: null }
    const invalid = this.#invalid.get(representation) ?? new Set<string>()
    const native = group.routes.filter(route => !invalid.has(route.host) && !TRUSTED_CATALOG_SET.has(route.host)
      && (route.activelyExplorable || unlockedHosts.has(route.host))).map(route => Object.freeze({
      type: 'native-signed' as const, host: route.host, kind: group.identity.kind, catalogIndex: catalogIndex(route.host),
      route: group.identity, handle: route.handle, activelyExplorable: route.activelyExplorable,
    }))
    const first = group.routes.find(route => !invalid.has(route.host))
    const root = first ? Object.freeze({ type: 'root-original' as const, host: first.host, kind: group.identity.kind,
      catalogIndex: Number.MAX_SAFE_INTEGER, route: group.identity, handle: first.handle }) : null
    return { native: Object.freeze(native), root }
  }

  identity(representation: RepresentationId): RouteIdentity | null {
    return this.#groups.get(representation)?.identity ?? null
  }

  hosts(representation: RepresentationId): readonly string[] {
    return Object.freeze((this.#groups.get(representation)?.routes ?? []).map(route => route.host))
  }

  invalidate(representation: RepresentationId, host: string): void {
    const invalid = this.#invalid.get(representation) ?? new Set<string>()
    invalid.add(host.toLowerCase())
    this.#invalid.set(representation, invalid)
  }

  isInvalid(representation: RepresentationId, host: string): boolean { return this.#invalid.get(representation)?.has(host) ?? false }

  rootUrl(representation: RepresentationId): string | null {
    return this.#groups.get(representation)?.routes[0]?.url ?? null
  }

  resolve(handle: SignedRouteHandle, identity: RouteIdentity): string | null {
    if (identity.generation !== this.#generation || identity.epoch !== this.#epoch) return null
    const stored = this.#handles.get(handle)
    return stored?.representation === identity.representation ? stored.url : null
  }

  groupSummary(representation: RepresentationId): { readonly kind: MediaKind; readonly height: number; readonly codec: string; readonly bandwidth: number; readonly routeCount: number } | null {
    const group = this.#groups.get(representation)
    return group ? Object.freeze({ kind: group.identity.kind, height: group.height, codec: group.codec, bandwidth: group.bandwidth, routeCount: group.routes.length }) : null
  }
}
