import { createRuntimeIds } from "../../src-v2/platform/runtime-ids.ts"
import { type TestContext } from 'node:test'
import { FakeClock } from './clock.ts'
import { FakeStorage } from './storage.ts'
import { testScope } from './scope.ts'
import { SessionStore } from '../../src-v2/state/session-store.ts'
import { SettingsStore } from '../../src-v2/state/settings-store.ts'
import { RestrictionStore } from '../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../src-v2/state/evidence-store.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { SignedRouteVault } from '../../src-v2/state/signed-route-vault.ts'
import { RouteCoordinator } from '../../src-v2/application/route-coordinator.ts'
import { PlayurlController } from '../../src-v2/application/playurl-controller.ts'
import { PlayurlAdapter } from '../../src-v2/adapters/playurl.ts'
import { RecoveryController } from '../../src-v2/application/recovery-controller.ts'
import { PlayerMonitor } from '../../src-v2/application/player-monitor.ts'
import { RuntimeController } from '../../src-v2/application/runtime-controller.ts'
import { LifecycleController } from '../../src-v2/application/lifecycle-controller.ts'
import { ControlCommands } from '../../src-v2/application/control-commands.ts'
import { DiagnosticRecorder } from '../../src-v2/diagnostics/recorder.ts'
import type { PlayerPort, VideoSnapshot } from '../../src-v2/application/ports.ts'
import type { TransportSnapshot } from '../../src-v2/domain/transport-model.ts'

export const blankVideo = (): VideoSnapshot => ({ available: true, paused: false, seeking: false, ended: false,
  readyState: 0, currentTime: 120, duration: 600, width: 0, height: 0, playbackRate: 2, effectiveRate: 2,
  bufferAheadSec: 0, playableBufferSec: 0, bufferedToEnd: false, frames: 0, mediaError: false,
  coreInitialized: false, manifestHasVideo: true })
export const media = (content: number) => ({ code: 0, data: { dash: { video: [{ id: 80, codecid: 7, height: 1080,
  bandwidth: 4_000_000, base_url: `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/01/02/${content}/${content}-1-30080.m4s?fixture=${content}`,
  backup_url: [] }], audio: [] } } })

export function fixture(t: TestContext, storage: FakeStorage = new FakeStorage()) {
  const scope = testScope(t), clock = scope.own(new FakeClock())
  const settings = scope.own(new SettingsStore(storage, clock.now))
  const restrictions = scope.own(new RestrictionStore(storage, clock.now))
  const evidence = scope.own(new EvidenceStore(storage, clock.now))
  const meta = new MeasurementMetaStore(storage, clock.now)
  const session = new SessionStore(), vault = new SignedRouteVault()
  const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, createRuntimeIds())
  const content = new PlayurlController(session, vault, routes, settings)
  const playurl = new PlayurlAdapter(content)
  let video = blankVideo(), navigationKey = '/video/initial'
  let onNavigate: () => void = () => undefined
  const calls = { seeks: [] as number[], rates: [] as number[], plays: 0, reloads: 0, resets: 0 }
  const player: PlayerPort = {
    snapshot: () => video, currentTime: () => video.currentTime, playbackRate: () => video.playbackRate,
    syncManifest: () => false, observePlayIntent: () => () => undefined,
    reload: () => { calls.reloads++ }, seek: value => { calls.seeks.push(value) },
    setRate: value => { calls.rates.push(value) }, play: () => { calls.plays++ }, reset: () => { calls.resets++ },
  }
  const recovery = scope.own(new RecoveryController(player, clock.now))
  const measurement = { reset: () => undefined, cancel: () => undefined, tick: () => undefined,
    startupFallbackHosts: () => [], requestManual: () => undefined,
    snapshot: () => ({ state: 'idle' as const, reason: 'fixture', lastAttemptAt: 0, host: null }) }
  const monitor = scope.own(new PlayerMonitor(player, session, settings, vault, routes, measurement, recovery, () => true, clock.now, clock))
  const diagnostics = new DiagnosticRecorder(clock.now, () => false)
  const runtime = scope.own(new RuntimeController(session, settings, routes, player, monitor, measurement, recovery,
    { setEnabled: () => undefined }, diagnostics, clock.now, content))
  const lifecycle = scope.own(new LifecycleController(session, settings, vault, routes, playurl,
    { install: () => undefined, dispose: () => undefined }, runtime, clock.now,
    { key: () => navigationKey, subscribe: listener => { onNavigate = listener; return () => { onNavigate = () => undefined } } }, clock))
  scope.defer(lifecycle.subscribe(event => runtime.record(event)))
  runtime.install(); lifecycle.start()
  const commands = new ControlCommands(settings, restrictions, evidence, meta, routes, measurement, recovery, clock.now)
  const transport = { snapshot: (): TransportSnapshot => ({ enteredFetch: 0, enteredXhr: 0, mediaRecognized: 0,
    nativeCalled: 0, responseObserved: 0, blocked: 0, lastMediaRequest: null, lastBlocked: null,
    lastPlayurl: null, hookState: 'installed', hookReason: 'fixture', fetchInstalled: true, xhrInstalled: true, note: '' }) }
  const deps = { settings, restrictions, evidence, session, routes, measurement, monitor, recovery, diagnostics, commands, transport, now: clock.now }
  return { scope, clock, content, runtime, settings, session, vault, routes, playurl, recovery, lifecycle, calls, commands, diagnostics, deps,
    setVideo: (next: VideoSnapshot) => { video = next },
    navigate: () => { navigationKey = '/video/next'; onNavigate() }, video: () => video }
}
