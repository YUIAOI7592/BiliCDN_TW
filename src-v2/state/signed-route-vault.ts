import { catalogIndex, TRUSTED_CATALOG_SET } from '../domain/catalog.ts'
import { isKnownNativeFamily, mediaIdentity, parseMediaUrl } from '../domain/url-policy.ts'
import {
  representationId, signedRouteHandle, type EpochId, type GenerationId, type MediaKind, type NativeCandidate,
  type RepresentationId, type RootCandidate, type RouteIdentity, type SignedRouteHandle,
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
  #byIdentity = new Map<string, RepresentationId>()
  #handles = new Map<SignedRouteHandle, { readonly representation: RepresentationId; readonly url: string }>()
  #invalid = new Map<RepresentationId, Set<string>>()
  #urlChars = 0
  #serial = 0

  reset(generation: GenerationId, epoch: EpochId): void {
    this.#generation = generation
    this.#epoch = epoch
    this.#groups.clear(); this.#byIdentity.clear(); this.#handles.clear(); this.#invalid.clear(); this.#urlChars = 0; this.#serial = 0
  }

  register(input: RegisterRepresentationInput): RepresentationId | null {
    if (input.generation !== this.#generation || input.epoch !== this.#epoch) return null
    const cap = input.kind === 'video' ? MAX_VIDEO_GROUPS : MAX_AUDIO_GROUPS
    if ([...this.#groups.values()].filter(group => group.identity.kind === input.kind).length >= cap) return null
    const rep = representationId(`${input.kind}:${input.key.slice(0, 128)}:${++this.#serial}`)
    const routes: StoredRoute[] = []
    for (const raw of [...new Set(input.urls)].slice(0, MAX_URLS_PER_GROUP)) {
      const parsed = parseMediaUrl(raw)
      if (!parsed || parsed.kind !== 'normal' || this.#urlChars + raw.length > MAX_URL_CHARS) continue
      const handle = signedRouteHandle(`route:${this.#serial}:${routes.length + 1}`)
      routes.push(Object.freeze({ handle, host: parsed.host, url: parsed.url.href, order: routes.length,
        activelyExplorable: isKnownNativeFamily(parsed.host) }))
      this.#handles.set(handle, { representation: rep, url: parsed.url.href })
      const identity = mediaIdentity(parsed.url.href)
      if (identity) this.#byIdentity.set(identity, rep)
      this.#urlChars += parsed.url.href.length
    }
    if (!routes.length) return null
    const identity: RouteIdentity = Object.freeze({ generation: input.generation, epoch: input.epoch, representation: rep, kind: input.kind })
    this.#groups.set(rep, Object.freeze({ identity, height: input.height, codec: input.codec.slice(0, 48), bandwidth: input.bandwidth,
      source: input.source, routes: Object.freeze(routes) }))
    return rep
  }

  contextForUrl(url: string): RouteIdentity | null {
    const identity = mediaIdentity(url), rep = identity ? this.#byIdentity.get(identity) : null
    return rep ? this.#groups.get(rep)?.identity ?? null : null
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
