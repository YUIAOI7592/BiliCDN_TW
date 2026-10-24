/** Temporary IAB tool binding. It only subscribes to existing product observations. */
import { createLiveSession } from './live-session.mts'
import { liveReasons } from './live-model.mts'
/** Tool-only structural ports avoid importing product code into the NodeNext tool project. */
export interface ObservationSnapshot {
  readonly video: {
    readonly available: boolean
    readonly paused: boolean
    readonly seeking: boolean
    readonly ended: boolean
    readonly mediaError: boolean
    readonly bufferedToEnd: boolean
    readonly currentTime: number
    readonly frames: number | null
    readonly playbackRate: number
  }
  readonly bufferTrend?: {
    readonly schemaVersion: number
    readonly algorithm: string
    readonly at: number | null
    readonly reason: string
    readonly candidate: boolean | null
    readonly endBufferSec: number | null
  }
}
interface ObservationRequest {
  readonly requestId: string
  readonly kind: string | null
  readonly representation?: string | null
  readonly targetHost?: string
  readonly routePolicyRevision?: number
  readonly authorityRevision?: number | null
  readonly routeType?: string
}
type ObservationEvent = {
  readonly type: string
  readonly request?: ObservationRequest
  readonly observation?: { readonly request?: ObservationRequest; readonly kind: string | null }
}
export interface BrowserObservationRuntime {
  readonly monitor: { subscribe(listener: (v: ObservationSnapshot) => void): () => void }
  readonly routes: {
    subscribe(listener: (v: ObservationEvent) => void): () => void
    latestRequested(kind: 'video'): ObservationRequest | null
    isOriginalComparison(): boolean
    snapshot?(): {
      readonly activePlan: {
        readonly host: string | null
        readonly ranking: readonly {
          readonly host: string
          readonly type: string
          readonly eligible: boolean
          readonly ratio: number | null
        }[]
      } | null
    }
  }
  readonly session: { get(): { readonly generation: number; readonly epoch: number } }
  readonly player: {
    controls(): {
      readonly mediaId: number
      readonly coreId: number
      readonly userRevision: number
      readonly seekRevision: number
      readonly reloadRevision: number
      readonly coreReloadRevision: number
    }
  }
  readonly settings: { get(): { readonly disabled: boolean; readonly fixedHost: string | null } }
  readonly recovery: { isRecovering(): boolean }
  readonly visibility: { isActuallyVisible(): boolean }
}
export interface BrowserObservationEnvironment {
  now(): number
  wall(): number
  timeout(run: () => void, ms: number): () => void
  onExit(run: () => void): () => void
}
export function startBrowserObservation(
  runtime: BrowserObservationRuntime,
  env: BrowserObservationEnvironment,
  rate: 1 | 2,
  warmupMs: 0 | 60000 = 0,
) {
  if (rate !== 1 && rate !== 2) throw Error('Invalid expected rate')
  if (warmupMs !== 0 && warmupMs !== 60000) throw Error('Invalid warmup')
  const started = env.now()
  let subscriptions = 0,
    listeners = 0,
    owner = 0,
    content = 0,
    previousKey = '',
    contentKey = '',
    previousTrend: number | null = null
  // Request identifiers are used only in this bounded mapping and never leave the tool.
  const requests = new Map<string, number>()
  const identity = () => {
    const c = runtime.player.controls(),
      s = runtime.session.get(),
      r = runtime.routes.latestRequested('video')
    const key = JSON.stringify([
      s.generation,
      s.epoch,
      c.mediaId,
      c.coreId,
      c.userRevision,
      c.seekRevision,
      c.reloadRevision,
      c.coreReloadRevision,
      r?.representation,
      r?.targetHost,
      r?.routePolicyRevision,
      r?.authorityRevision,
    ])
    const ck = JSON.stringify([s.generation, s.epoch])
    if (ck !== contentKey) {
      content++
      contentKey = ck
    }
    if (key !== previousKey) {
      owner++
      previousKey = key
      previousTrend = null
    }
    return { key, owner, content }
  }
  let earlyFailure = false
  let reject = () => {
    earlyFailure = true
  }
  const session = createLiveSession(
    {
      now: env.now,
      timeout: env.timeout,
      resources: () => ({ subscriptions, listeners }),
      bind(onSample, onEvent, exit) {
        const stops: (() => void)[] = []
        const cleanup = () => {
          const errors: unknown[] = []
          for (const stop of stops.splice(0).reverse())
            try {
              stop()
            } catch (e) {
              errors.push(e)
            }
          requests.clear()
          if (errors.length) throw Error('Observation cleanup failed')
        }
        try {
          const monitorStop = runtime.monitor.subscribe((snapshot) => {
            try {
              const before = identity(),
                v = snapshot.video,
                t = snapshot.bufferTrend,
                settings = runtime.settings.get(),
                rescue = runtime.recovery.isRecovering(),
                visible = runtime.visibility.isActuallyVisible(),
                after = identity()
              const valid =
                before.key === after.key &&
                !!t &&
                t.schemaVersion === 6 &&
                t.algorithm === 'buffer-window-v6' &&
                t.at !== null &&
                Number.isFinite(t.at) &&
                t.at <= env.wall() &&
                env.wall() - t.at <= 1500 &&
                t.at !== previousTrend &&
                liveReasons.includes(t.reason) &&
                v.playbackRate === rate
              if (t) previousTrend = t.at
              const qualified =
                v.available &&
                !v.paused &&
                !v.seeking &&
                !v.ended &&
                !v.mediaError &&
                !v.bufferedToEnd &&
                visible &&
                !rescue &&
                !settings.disabled &&
                !runtime.routes.isOriginalComparison()
              const requested = runtime.routes.latestRequested('video')
              const plan = runtime.routes.snapshot?.().activePlan
              const cachedAlternatives = plan
                ? plan.ranking.filter(
                    (r) =>
                      r.type === 'catalog-generated' &&
                      r.host !== plan.host &&
                      r.eligible &&
                      r.ratio !== null &&
                      r.ratio >= 1.35,
                  ).length
                : null
              onSample({
                at: env.now() - started,
                owner: after.owner,
                content: after.content,
                rate,
                candidate: valid && qualified ? t!.candidate : null,
                reason: valid ? t!.reason : 'invalid-sample',
                bufferSec: valid ? t!.endBufferSec : null,
                currentTime: Number.isFinite(v.currentTime) ? v.currentTime : null,
                frames:
                  v.frames !== null && Number.isFinite(v.frames) && v.frames >= 0 ? v.frames : null,
                qualified,
                rescue,
                automatic:
                  !settings.disabled &&
                  settings.fixedHost === null &&
                  !runtime.routes.isOriginalComparison() &&
                  requested?.routeType === 'catalog-generated',
                alternative: null,
                cachedAlternatives,
                quality: valid ? 'valid' : 'invalid',
              })
            } catch {
              reject()
            }
          })
          subscriptions++
          stops.push(() => {
            monitorStop()
            subscriptions--
          })
          const routeStop = runtime.routes.subscribe((event) => {
            try {
              if (
                !['request-started', 'transport-completed', 'recovery', 'lifecycle'].includes(
                  event.type,
                )
              )
                return
              const id =
                event.type === 'request-started'
                  ? event.request?.requestId
                  : event.type === 'transport-completed'
                    ? event.observation?.request?.requestId
                    : null
              if (id && !requests.has(id)) {
                if (requests.size >= 4096) {
                  reject()
                  return
                }
                requests.set(id, requests.size + 1)
              }
              const kind =
                event.type === 'request-started'
                  ? event.request?.kind
                  : event.type === 'transport-completed'
                    ? event.observation?.kind
                    : null
              onEvent({
                at: env.now() - started,
                type: event.type,
                owner: identity().owner,
                request: id ? requests.get(id) : null,
                kind: kind === 'video' || kind === 'audio' ? kind : 'other',
              })
            } catch {
              reject()
            }
          })
          subscriptions++
          stops.push(() => {
            routeStop()
            subscriptions--
          })
          const exitStop = env.onExit(exit)
          listeners++
          stops.push(() => {
            exitStop()
            listeners--
          })
        } catch {
          cleanup()
          throw Error('Observation binding failed')
        }
        return cleanup
      },
    },
    { durationMs: 367000 + warmupMs },
  )
  reject = session.fail
  if (earlyFailure) session.fail()
  return session
}
