import {
  type RepresentationId,
  type MediaKind,
  type GenerationId,
  type EpochId,
} from '../../domain/model.ts'
import { type RouteIdentity } from '../../domain/route-model.ts'
import { controlPlaybackDemand } from '../../domain/playback-demand.ts'
import { parseMediaUrl } from '../../domain/url-policy.ts'
import { admitSources } from '../../domain/source-admission.ts'
import { observePlayurlContent, type PlayurlContentIdentity } from '../../domain/playurl-content.ts'
import { type PlayurlRequestContext } from '../../domain/playurl-model.ts'
import {
  type PlayurlControllerPort,
  type PlayurlSessionPort,
  type PlayurlVaultPort,
  type PlayurlRoutesPort,
  type PlayurlItem,
  type PlayurlInput,
  type PlayurlOutput,
} from './playurl-contracts.ts'
type WriteOutput = (item: PlayurlItem, primary: string, backups: readonly string[]) => void

type IngestionOwner = {
  readonly generation: GenerationId
  epoch: EpochId
  readonly sequence: number | undefined
}

export class PlayurlController implements PlayurlControllerPort {
  #epochListeners = new Set<
    (state: { readonly generation: GenerationId; readonly epoch: EpochId }) => void
  >()
  #seenTrusted = new WeakSet<object>()
  #trustedItems = new WeakMap<object, RouteIdentity>()
  #seenPage = new WeakMap<object, number>()
  #responses = new Set<string>()
  #generation = -1
  #apiWatermark = 0
  #ingestion: IngestionOwner | null = null
  #apiCandidate: {
    readonly context: PlayurlRequestContext
    readonly generation: GenerationId
    readonly epoch: EpochId
  } | null = null
  #contentIdentity: PlayurlContentIdentity | null = null
  constructor(
    private readonly session: PlayurlSessionPort,
    private readonly vault: PlayurlVaultPort,
    private readonly routes: PlayurlRoutesPort,
  ) {}

  catalogOnly(): boolean {
    return this.routes.isCatalogOnly()
  }
  subscribeEpoch(
    listener: (state: { readonly generation: GenerationId; readonly epoch: EpochId }) => void,
  ): () => void {
    this.#epochListeners.add(listener)
    return () => this.#epochListeners.delete(listener)
  }
  active(): boolean {
    return !this.session.get().disabled
  }
  lifecycleKey(): string {
    const s = this.session.get()
    return `${s.generation}:${s.epoch}`
  }

  ingest(
    payload: PlayurlInput | null,
    source: 'trusted-api' | 'player-mpd' | 'page-hint' = 'trusted-api',
    responseKey?: string,
    context?: PlayurlRequestContext,
  ): readonly PlayurlOutput[] | null {
    const state = this.session.get(),
      active = this.#ingestion
    const sequence =
      source === 'trusted-api' &&
      Number.isSafeInteger(context?.requestSequence) &&
      context!.requestSequence! > 0
        ? context!.requestSequence
        : undefined
    if (
      state.disabled ||
      (context?.generation !== undefined && context.generation !== Number(state.generation))
    )
      return null
    // Only a newer ordered API response may supersede synchronous ingestion.
    // This reservation is not the accepted-response watermark.
    if (
      active &&
      active.generation === state.generation &&
      (sequence === undefined || active.sequence === undefined || sequence <= active.sequence)
    )
      return null
    const owner: IngestionOwner = { generation: state.generation, epoch: state.epoch, sequence }
    this.#ingestion = owner
    const valid = (): boolean => {
      const current = this.session.get()
      return (
        this.#ingestion === owner &&
        !current.disabled &&
        current.generation === owner.generation &&
        current.epoch === owner.epoch
      )
    }
    try {
      const outputs = this.#ingest(payload, source, responseKey, context, owner, valid)
      return valid() ? outputs : null
    } finally {
      if (this.#ingestion === owner) this.#ingestion = null
    }
  }

  #ingest(
    payload: PlayurlInput | null,
    source: 'trusted-api' | 'player-mpd' | 'page-hint',
    responseKey: string | undefined,
    context: PlayurlRequestContext | undefined,
    owner: IngestionOwner,
    valid: () => boolean,
  ): readonly PlayurlOutput[] | null {
    const outputs: PlayurlOutput[] = []
    const rewriteItem: WriteOutput = (item, primary, backups) => {
      outputs.push({ token: item.token, primary, backups })
    }
    if (this.session.get().disabled) return null
    if (this.#generation !== Number(this.session.get().generation)) {
      this.#generation = Number(this.session.get().generation)
      this.#responses.clear()
      this.#apiWatermark = 0
      this.#apiCandidate = null
      this.#contentIdentity = null
      this.#seenTrusted = new WeakSet()
      this.#trustedItems = new WeakMap()
    }
    const sequence = context?.requestSequence
    const ordered = source === 'trusted-api' && Number.isSafeInteger(sequence) && sequence! > 0
    if (
      source === 'trusted-api' &&
      context?.generation !== undefined &&
      context.generation !== this.#generation
    )
      return null
    const older = ordered && sequence! < this.#apiWatermark
    // An older response can only supplement a proven same-content inventory.
    if (older && (!context?.contentId || context.contentId !== this.#contentIdentity?.contentId))
      return null
    const catalogOnly = this.routes.isCatalogOnly()
    if (responseKey && this.#responses.has(responseKey) && !catalogOnly) return outputs
    const dash = payload
    if (!dash || (!dash.video.length && !dash.audio.length)) return null
    if (payload && typeof payload === 'object') {
      if (source === 'trusted-api') {
        if (this.#seenTrusted.has(payload.token)) {
          if (catalogOnly) {
            for (const [kind, items] of [
              ['video', dash.video],
              ['audio', dash.audio],
            ] as const) {
              for (const item of items) {
                const identity = this.#trustedItems.get(item.token)
                if (identity && this.vault.isCurrentIdentity(identity))
                  this.#sanitizeKnownItem(
                    item,
                    identity.representation,
                    kind,
                    'trusted-api',
                    true,
                    rewriteItem,
                  )
                else rewriteItem(item, '', [])
              }
            }
          }
          return outputs
        }
        this.#seenTrusted.add(payload.token)
      } else if (source === 'page-hint') {
        const generation = Number(this.session.get().generation)
        if (this.#seenPage.get(payload.token) === generation && !catalogOnly) return outputs
        this.#seenPage.set(payload.token, generation)
      }
    }
    if (source === 'trusted-api' && !older) {
      const next = observePlayurlContent(
        this.#contentIdentity,
        dash.video.map((item) => item.primary),
        dash.audio.map((item) => item.primary),
        context,
      )
      this.#contentIdentity = next.identity
      if (next.changed) {
        this.session.beginEpoch()
        const state = this.session.get()
        if (this.#ingestion !== owner || state.disabled || state.generation !== owner.generation)
          return null
        owner.epoch = state.epoch
        this.vault.reset(state.generation, state.epoch)
        this.routes.resetEpoch()
        if (!valid()) return null
        this.#trustedItems = new WeakMap()
        const identity = Object.freeze({ generation: state.generation, epoch: state.epoch })
        for (const listener of this.#epochListeners) {
          listener(identity)
          if (!valid()) return null
        }
      }
    }
    if (!valid()) return null
    if (responseKey) {
      this.#responses.add(responseKey)
      while (this.#responses.size > 128)
        this.#responses.delete(this.#responses.values().next().value as string)
    }
    const state = this.session.get()
    for (const [kind, items] of [
      ['video', dash.video],
      ['audio', dash.audio],
    ] as const) {
      items.forEach((item) => {
        if (!valid()) return
        if (ordered && sequence! < this.#apiWatermark) {
          if (context?.contentId !== this.#contentIdentity?.contentId) {
            rewriteItem(item, '', [])
            return
          }
          const existing = this.vault.registeredRepresentation(
            kind,
            item.key,
            item.codec,
            item.height,
          )
          if (existing) {
            this.#sanitizeKnownItem(item, existing, kind, 'trusted-api', false, rewriteItem)
            return
          }
        }
        const primary = item.primary,
          urls = item.urls
        if (!item.progressive && parseMediaUrl(primary)?.kind === 'unknown') {
          const rep = this.#registerItem(item, kind, state, urls, source, () => item.bandwidth)
          if (rep && source !== 'trusted-api' && this.vault.source(rep) === 'trusted-api') {
            if (source === 'page-hint' && catalogOnly)
              this.#sanitizeKnownItem(item, rep, kind, 'page-hint', false, rewriteItem)
            return
          }
          if (source !== 'player-mpd') {
            const output = rep
              ? this.routes.opaqueOutput(rep, primary, this.vault.sourceURLs(rep), source)
              : { primary: '', backups: [] }
            rewriteItem(item, output.primary, output.backups)
          }
          return
        }
        const bandwidth = item.bandwidth
        const rep = this.#registerItem(item, kind, state, urls, source, () => bandwidth)
        if (rep && source !== 'trusted-api' && this.vault.source(rep) === 'trusted-api') {
          if (source === 'page-hint' && catalogOnly)
            this.#sanitizeKnownItem(item, rep, kind, 'page-hint', false, rewriteItem)
          return
        }
        if (!rep) {
          if (source !== 'player-mpd') {
            if (item.progressive) {
              rewriteItem(item, '', [])
              return
            }
            const primaryOutput = this.routes.apply(primary, kind, undefined, true)
            const admitted = admitSources(urls, source === 'trusted-api').map((route) => route.url)
            const backups = this.routes.isCatalogOnly()
              ? []
              : primaryOutput.url
                ? [
                    ...new Set(
                      admitted
                        .map((url) => this.routes.apply(url).url)
                        .filter((url): url is string => !!url && url !== primaryOutput.url),
                    ),
                  ].slice(0, 5)
                : []
            const safePrimary =
              primaryOutput.url && (catalogOnly || this.routes.isBilibiliMedia(primaryOutput.url))
                ? primaryOutput.url
                : ''
            rewriteItem(
              item,
              safePrimary,
              safePrimary
                ? backups.filter((url) => catalogOnly || this.routes.isBilibiliMedia(url))
                : [],
            )
          }
          return
        }
        if (source === 'player-mpd') return
        const demand = controlPlaybackDemand(kind, bandwidth, this.routes.playbackRate())
        const decision = this.routes.plan(
          rep,
          demand,
          this.session.get().affinity ? 'representation' : 'startup',
        )
        if (!valid()) return
        const output = this.routes.playerOutput(
          rep,
          primary,
          decision,
          this.vault.sourceURLs(rep),
          source,
        )
        rewriteItem(item, output.primary, output.backups)
      })
    }
    if (!valid()) return null
    if (ordered && context)
      this.#apiCandidate = { context, generation: state.generation, epoch: state.epoch }
    return outputs
  }

  // Called at each original branch boundary. Normal input already captured its
  // demand bandwidth; opaque input reads it in the registration field order.
  #registerItem(
    item: PlayurlItem,
    kind: MediaKind,
    state: { readonly generation: GenerationId; readonly epoch: EpochId },
    urls: readonly string[],
    source: 'trusted-api' | 'player-mpd' | 'page-hint',
    readBandwidth: () => number,
  ): RepresentationId | null {
    const rep = this.vault.register({
      generation: state.generation,
      epoch: state.epoch,
      kind,
      key: item.key,
      height: item.height,
      codec: item.codec,
      bandwidth: readBandwidth(),
      ...(item.frameRate !== undefined ? { frameRate: item.frameRate } : {}),
      urls,
      source,
      refreshTrustedSources: source === 'trusted-api',
    })
    if (rep && source === 'trusted-api') {
      const identity = this.vault.identity(rep)
      if (identity) this.#trustedItems.set(item.token, identity)
    }
    return rep
  }

  acceptResponse(context?: PlayurlRequestContext): void {
    const candidate = this.#apiCandidate,
      state = this.session.get()
    if (
      !context ||
      candidate?.context !== context ||
      state.disabled ||
      state.generation !== candidate.generation ||
      state.epoch !== candidate.epoch
    )
      return
    this.#apiCandidate = null
    if (Number.isSafeInteger(context.requestSequence) && context.requestSequence! > 0)
      this.#apiWatermark = Math.max(this.#apiWatermark, context.requestSequence!)
  }

  #sanitizeKnownItem(
    item: PlayurlItem,
    representation: RepresentationId,
    kind: MediaKind,
    source: 'trusted-api' | 'page-hint',
    recordOutput: boolean,
    rewriteItem: WriteOutput,
  ): void {
    const original = this.vault.rootUrl(representation)
    if (!original) {
      rewriteItem(item, '', [])
      return
    }
    const bandwidth = this.vault.groupSummary(representation)?.bandwidth ?? 0
    const demand = controlPlaybackDemand(kind, bandwidth, this.routes.playbackRate())
    const decision = this.routes.plan(
      representation,
      demand,
      this.session.get().affinity ? 'representation' : 'startup',
    )
    const output = this.routes.playerOutput(
      representation,
      original,
      decision,
      this.vault.sourceURLs(representation),
      source,
      recordOutput,
    )
    rewriteItem(item, output.primary, output.backups)
  }
}
