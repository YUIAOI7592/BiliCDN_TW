import { catalogIndex } from '../domain/catalog.ts'
import { isKnownNativeFamily, parseMediaUrl } from '../domain/url-policy.ts'
import {
  representationId, signedRouteHandle, type EpochId, type GenerationId, type MediaKind, type NativeCandidate,
  type RepresentationId, type RootCandidate, type RouteIdentity, type SignedRouteHandle, type AttributionStatus, type AttributionSource,
  type DecisionId,
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

interface StoredRoute { readonly handle: SignedRouteHandle; readonly host: string; readonly url: string; readonly order: number; readonly activelyExplorable: boolean; readonly selectable: boolean }
interface Group { readonly identity: RouteIdentity; readonly height: number; readonly codec: string; readonly bandwidth: number; readonly source: RegisterRepresentationInput['source']; readonly routes: readonly StoredRoute[] }
interface OutputRole { readonly representation: RepresentationId; readonly role: 'primary' | 'backup'; readonly hostChanged: boolean;
  readonly originalHost: string; readonly outputHost: string; readonly source: 'trusted-api' | 'page-hint'; readonly decisionId: DecisionId }

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
  #outputs = new Map<string, OutputRole | null>()
  #urlChars = 0
  #serial = 0
  #handleSerial = 0
  #authoritySerial = 0

  reset(generation: GenerationId, epoch: EpochId): void {
    this.#generation = generation
    this.#outputs.clear()
    this.#epoch = epoch
    this.#groups.clear(); this.#byKey.clear(); this.#byUrl.clear(); this.#aliases.clear(); this.#byPath.clear(); this.#handles.clear(); this.#invalid.clear(); this.#urlChars = 0; this.#serial = 0; this.#handleSerial = 0; this.#authoritySerial = 0
  }

  register(input: RegisterRepresentationInput): RepresentationId | null {
    if (input.generation !== this.#generation || input.epoch !== this.#epoch) return null
    const key = `${input.kind}:${input.key}:${input.codec}:${input.height}`
    const priorId = this.#byKey.get(key), prior = priorId ? this.#groups.get(priorId) : undefined
    if (prior?.source === 'trusted-api' && input.source !== 'trusted-api') return priorId ?? null
    const sharedExact = new Set<RepresentationId>()
    for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
      const parsed = parseMediaUrl(raw)
      if (!parsed || (parsed.kind !== 'normal' && parsed.kind !== 'unknown')) continue
      for (const rep of this.#byUrl.get(parsed.url.href) ?? []) {
        if (this.#groups.get(rep)?.identity.kind === input.kind) sharedExact.add(rep)
      }
    }
    if (input.source !== 'trusted-api') {
      const authoritative = [...sharedExact].filter(rep => this.#groups.get(rep)?.source === 'trusted-api')
      if (authoritative.length) return authoritative.length === 1 ? authoritative[0] ?? null : null
    } else {
      // A trusted API URL takes exact-URL attribution away from provisional groups,
      // even when a page hint supplied a different representation key.
      for (const rep of sharedExact) {
        if (rep === priorId || this.#groups.get(rep)?.source === 'trusted-api') continue
        this.#dropGroup(rep)
      }
    }
    const promoted = !!prior && input.source === 'trusted-api' && prior.source !== 'trusted-api'
    const cap = input.kind === 'video' ? MAX_VIDEO_GROUPS : MAX_AUDIO_GROUPS
    if (!prior && [...this.#groups.values()].filter(group => group.identity.kind === input.kind).length >= cap) return null
    const rep = priorId ?? representationId(`${input.kind}:group-${++this.#serial}`)
    if (promoted && priorId) {
      this.#revokeGroupRoutes(priorId, prior)
      // A provisional URL's failure cannot invalidate a newly authoritative exact URL.
      this.#invalid.delete(priorId)
    }
    const routes: StoredRoute[] = promoted ? [] : [...(prior?.routes ?? [])]
    for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
      const parsed = parseMediaUrl(raw)
      const opaque = parsed?.kind === 'unknown' && parsed.url.protocol === 'https:' && !parsed.url.port
      if (!parsed || (parsed.kind !== 'normal' && !opaque) || this.#urlChars + raw.length > MAX_URL_CHARS) continue
      if (routes.some(route => route.url === parsed.url.href)) continue
      if (routes.length >= MAX_URLS_PER_GROUP) { this.registerAlias(rep, parsed.url.href); continue }
      const handle = signedRouteHandle(`route:${rep}:${++this.#handleSerial}`)
      routes.push(Object.freeze({ handle, host: parsed.host, url: parsed.url.href, order: routes.length,
        activelyExplorable: !opaque && isKnownNativeFamily(parsed.host), selectable: !opaque }))
      this.#handles.set(handle, { representation: rep, url: parsed.url.href })
      this.#index(this.#byUrl, parsed.url.href, rep)
      if (!opaque) this.#index(this.#byPath, parsed.url.pathname, rep)
      this.#urlChars += parsed.url.href.length
    }
    if (!routes.length) {
      if (promoted) { this.#groups.delete(rep); this.#byKey.delete(key); this.#invalid.delete(rep) }
      return null
    }
    this.#byKey.set(key, rep)
    const identity: RouteIdentity = !promoted && prior ? prior.identity : Object.freeze({ generation: input.generation,
      epoch: input.epoch, representation: rep, kind: input.kind, authorityRevision: ++this.#authoritySerial })
    this.#groups.set(rep, Object.freeze({ identity, height: input.height, codec: input.codec.slice(0, 48), bandwidth: input.bandwidth,
      source: prior?.source === 'trusted-api' ? prior.source : input.source, routes: Object.freeze(routes) }))
    return rep
  }

  source(representation: RepresentationId): RegisterRepresentationInput['source'] | null {
    return this.#groups.get(representation)?.source ?? null
  }

  isCurrentIdentity(identity: RouteIdentity): boolean {
    return identity.generation === this.#generation && identity.epoch === this.#epoch
      && this.#groups.get(identity.representation)?.identity === identity
  }

  #revokeGroupRoutes(representation: RepresentationId, group: Group): void {
    for (const route of group.routes) {
      this.#handles.delete(route.handle)
      this.#urlChars -= route.url.length
    }
    const remove = (index: Map<string, Set<RepresentationId>>, counted: boolean): void => {
      for (const [key, rows] of index) {
        if (!rows.delete(representation)) continue
        if (!rows.size) { index.delete(key); if (counted) this.#urlChars -= key.length }
      }
    }
    remove(this.#byUrl, false)
    remove(this.#byPath, false)
    remove(this.#aliases, true)
    for (const [url, row] of this.#outputs) {
      if (row?.representation !== representation) continue
      this.#outputs.delete(url)
      this.#urlChars -= url.length
    }
  }

  #dropGroup(representation: RepresentationId): void {
    const group = this.#groups.get(representation)
    if (!group) return
    this.#revokeGroupRoutes(representation, group)
    this.#groups.delete(representation)
    this.#invalid.delete(representation)
    for (const [key, rep] of this.#byKey) if (rep === representation) this.#byKey.delete(key)
  }

  contextForUrl(url: string): RouteIdentity | null {
    const match = this.match(url)
    return match.status === 'matched' ? match.context : null
  }

  match(url: string): { context: RouteIdentity | null; status: AttributionStatus; source: AttributionSource } {
    const parsed = parseMediaUrl(url)
    if (!parsed || (parsed.kind !== 'normal' && parsed.kind !== 'unknown')) return { context: null, status: 'waiting-data', source: 'none' }
    for (const [index, source] of [[this.#byUrl, 'exact'], [this.#aliases, 'catalog-alias'], [this.#byPath, 'path-hint']] as const) {
      if (parsed.kind === 'unknown' && source !== 'exact') continue
      const reps = index.get(source === 'path-hint' ? parsed.url.pathname : parsed.url.href)
      if (!reps?.size) continue
      if (reps.size !== 1) return { context: null, status: 'ambiguous', source }
      const rep = [...reps][0], context = rep ? this.#groups.get(rep)?.identity ?? null : null
      return { context, status: source === 'path-hint' || parsed.kind === 'unknown' ? 'weak' : 'matched', source }
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

  registerOutput(rep: RepresentationId, original: string, primary: string, backups: readonly string[],
    decisionId: DecisionId, source: 'trusted-api' | 'page-hint'): void {
    const originalHost = parseMediaUrl(original)?.host ?? ''
    for (const [index, url] of [primary, ...backups].entries()) {
      const parsed = parseMediaUrl(url)
      if (!parsed || this.#outputs.size >= 1152 || this.#urlChars + url.length > MAX_URL_CHARS) continue
      const prior = this.#outputs.get(parsed.url.href)
      if (prior === null || (prior && prior.representation !== rep)) { this.#outputs.set(parsed.url.href, null); continue }
      if (!this.#outputs.has(parsed.url.href)) this.#urlChars += url.length
      this.#outputs.set(parsed.url.href, { representation: rep, role: index === 0 ? 'primary' : 'backup',
        hostChanged: !!originalHost && originalHost !== parsed.host, originalHost, outputHost: parsed.host, source, decisionId })
    }
  }

  outputRole(rep: RepresentationId, url: string): Omit<OutputRole, 'representation'> | null {
    const parsed = parseMediaUrl(url), row = parsed ? this.#outputs.get(parsed.url.href) : null
    return row?.representation === rep ? { role: row.role, hostChanged: row.hostChanged,
      originalHost: row.originalHost, outputHost: row.outputHost, source: row.source, decisionId: row.decisionId } : null
  }

  #index(index: Map<string, Set<RepresentationId>>, key: string, rep: RepresentationId): void {
    const rows = index.get(key) ?? new Set<RepresentationId>()
    rows.add(rep); index.set(key, rows)
  }

  candidates(representation: RepresentationId, unlockedHosts: ReadonlySet<string>): { readonly native: readonly NativeCandidate[]; readonly root: RootCandidate | null } {
    const group = this.#groups.get(representation)
    if (!group) return { native: Object.freeze([]), root: null }
    const invalid = this.#invalid.get(representation) ?? new Set<string>()
    const native = group.routes.filter(route => route.selectable && !invalid.has(route.host)
      && (route.activelyExplorable || unlockedHosts.has(route.host))).map(route => Object.freeze({
      type: 'native-signed' as const, host: route.host, kind: group.identity.kind, catalogIndex: catalogIndex(route.host),
      route: group.identity, handle: route.handle, activelyExplorable: route.activelyExplorable,
    }))
    const first = group.routes.find(route => route.selectable && !invalid.has(route.host))
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
    if (!this.isCurrentIdentity(identity)) return null
    const stored = this.#handles.get(handle)
    return stored?.representation === identity.representation ? stored.url : null
  }

  groupSummary(representation: RepresentationId): { readonly kind: MediaKind; readonly height: number; readonly codec: string; readonly bandwidth: number; readonly routeCount: number } | null {
    const group = this.#groups.get(representation)
    return group ? Object.freeze({ kind: group.identity.kind, height: group.height, codec: group.codec, bandwidth: group.bandwidth, routeCount: group.routes.length }) : null
  }
}
