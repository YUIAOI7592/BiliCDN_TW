import { TampermonkeyStorage } from './platform/storage.ts'
import { SettingsStore } from './state/settings-store.ts'
import { RestrictionStore } from './state/restriction-store.ts'
import { EvidenceStore } from './state/evidence-store.ts'
import { SessionStore } from './state/session-store.ts'
import { SignedRouteVault } from './state/signed-route-vault.ts'
import { RouteCoordinator } from './application/route-coordinator.ts'
import { MeasurementController } from './application/measurement-controller.ts'
import { RecoveryController } from './application/recovery-controller.ts'
import type { VideoSnapshot } from './application/ports.ts'
import { PlayerMonitor } from './application/player-monitor.ts'
import { LifecycleController } from './application/lifecycle-controller.ts'
import { PlayurlAdapter } from './adapters/playurl.ts'
import { PlayerAdapter } from './adapters/player.ts'
import { PagePlayinfoAdapter } from './adapters/page-playinfo.ts'
import { TransportAdapter } from './adapters/transport.ts'
import { VisibilityAdapter } from './adapters/visibility.ts'
import { WebRtcAdapter } from './adapters/webrtc.ts'
import { DiagnosticRecorder } from './diagnostics/recorder.ts'
import { ControlCenter } from './ui/control-center.ts'
import { PlayerPanel } from './ui/player-panel.ts'

export const start = (): void => {
  const now = (): number => Date.now()
  const clock = { now }
  const storage = new TampermonkeyStorage()
  const settings = new SettingsStore(storage, now)
  const restrictions = new RestrictionStore(storage, now)
  const evidence = new EvidenceStore(storage, now)
  const session = new SessionStore()
  const vault = new SignedRouteVault()
  const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault)
  const playurl = new PlayurlAdapter(session, vault, routes, settings)
  const player = new PlayerAdapter(playurl)
  const recovery = new RecoveryController(player, now)
  const nativeFetch = unsafeWindow.fetch.bind(unsafeWindow)
  const measurement = new MeasurementController(routes, storage, nativeFetch, now)
  const transport = new TransportAdapter(session, settings, routes, playurl, measurement, now)
  transport.install()
  const visibility = new VisibilityAdapter()
  const monitor = new PlayerMonitor(player, session, settings, vault, routes, measurement, recovery,
    () => visibility.isActuallyVisible(), now)
  let lifecycle: LifecycleController | null = null
  const pagePlayinfo = new PagePlayinfoAdapter((payload, serial) => lifecycle?.acceptPageAssignment(payload, serial))
  lifecycle = new LifecycleController(session, settings, vault, routes, playurl, pagePlayinfo, monitor, now)
  const webRtc = new WebRtcAdapter(settings)
  const diagnostics = new DiagnosticRecorder(now, () => settings.get().verbose)
  const center = new ControlCenter({ settings, restrictions, evidence, session, routes, measurement, monitor, recovery, transport,
    diagnostics, storageDelete: key => storage.delete(key), now })
  const panel = new PlayerPanel(center, settings, session, monitor)

  const diagnosticSample = (video: VideoSnapshot, watchdog: string, at: number) => ({
    at, generation: session.get().generation, epoch: session.get().epoch,
    enabled: !settings.get().disabled, originalComparison: routes.isOriginalComparison(),
    currentTimeSec: video.currentTime, frames: video.frames, playableBufferSec: video.playableBufferSec,
    paused: video.paused, seeking: video.seeking, ended: video.ended, readyState: video.readyState,
    coreInitialized: video.coreInitialized, watchdog,
  })

  const eventSink = (event: Parameters<DiagnosticRecorder['record']>[0]): void => {
    diagnostics.record(event, !settings.get().disabled && !routes.isOriginalComparison())
    if (event.type === 'recovery' && event.action.action === 'route-fallback' && !routes.isOriginalComparison()) {
      const snapshot = player.snapshot()
      diagnostics.recordPlayer(diagnosticSample(snapshot, monitor.snapshot().watchdog, event.at))
      recovery.armRouteFailure('route-failure', snapshot)
    }
  }
  routes.subscribe(eventSink)
  recovery.subscribe(eventSink)
  lifecycle.subscribe(eventSink)
  monitor.subscribe(snapshot => diagnostics.recordPlayer(diagnosticSample(snapshot.video, snapshot.watchdog, now())))

  visibility.setEnabled(!settings.get().disabled)
  webRtc.install()
  lifecycle.start()
  panel.start()
  let routeSettings = JSON.stringify([settings.get().fixedHost, settings.get().catalogOverrides])
  settings.subscribe(state => {
    visibility.setEnabled(!state.disabled)
    const next = JSON.stringify([state.fixedHost, state.catalogOverrides])
    if (next !== routeSettings) { routeSettings = next; routes.invalidateForUserSetting() }
  })
  try { GM_registerMenuCommand('⚙️ 開啟 BiliCDN v2 控制中心', () => center.show()) } catch { /* optional */ }
}

start()
