import { RangeProbeAdapter } from './adapters/range-probe.ts'
import { PlayurlController } from './application/playurl-controller.ts'
import { RuntimeController } from './application/runtime-controller.ts'
import { ControlCommands } from './application/control-commands.ts'
import { MeasurementMetaStore } from './state/measurement-meta-store.ts'
import { TampermonkeyStorage } from './platform/storage.ts'
import { createRuntimeIds } from './platform/runtime-ids.ts'
import { SettingsStore } from './state/settings-store.ts'
import { RestrictionStore } from './state/restriction-store.ts'
import { EvidenceStore } from './state/evidence-store.ts'
import { SessionStore } from './state/session-store.ts'
import { SignedRouteVault } from './state/signed-route-vault.ts'
import { RouteCoordinator } from './application/route-coordinator.ts'
import { MeasurementController } from './application/measurement-controller.ts'
import { RecoveryController } from './application/recovery-controller.ts'
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
import { BrowserScheduler } from './adapters/scheduler.ts'
import { BrowserNavigation } from './adapters/navigation.ts'

export const start = (): void => {
  const now = (): number => Date.now()
  const clock = { now }
  const scheduler = new BrowserScheduler()
  const storage = new TampermonkeyStorage()
  const settings = new SettingsStore(storage, now)
  const restrictions = new RestrictionStore(storage, now)
  const evidence = new EvidenceStore(storage, now)
  const session = new SessionStore()
  const vault = new SignedRouteVault()
  const ids = createRuntimeIds()
  const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, ids)
  const meta = new MeasurementMetaStore(storage, now)
  const content = new PlayurlController(session, vault, routes, settings)
  const playurl = new PlayurlAdapter(content)
  const visibility = new VisibilityAdapter()
  const player = new PlayerAdapter(playurl, { scheduler, isActuallyVisible: () => visibility.isActuallyVisible(),
    subscribeControlLoss: listener => visibility.subscribeControlLoss(listener) })
  const recovery = new RecoveryController(player, now,
    () => !settings.get().disabled && !routes.isOriginalComparison() && visibility.isActuallyVisible(), () => {
      const request = routes.latestRequested('video')
      return () => !!request && routes.recoveryEligible(request) && routes.latestRequested('video')?.representation === request.representation
    })
  const nativeFetch = unsafeWindow.fetch.bind(unsafeWindow)
  const measurement = new MeasurementController(routes, meta, new RangeProbeAdapter(nativeFetch, now), now, scheduler)
  const transport = new TransportAdapter(session, settings, routes, playurl, measurement, now, ids)
  transport.install()
  const monitor = new PlayerMonitor(player, session, settings, vault, routes, measurement, recovery,
    () => visibility.isActuallyVisible(), now, scheduler)
  const diagnostics = new DiagnosticRecorder(now, () => settings.get().verbose)
  const runtime = new RuntimeController(session, settings, routes, player, monitor, measurement, recovery, visibility, diagnostics, now, content)
  let lifecycle: LifecycleController | null = null
  const pagePlayinfo = new PagePlayinfoAdapter((payload, serial) => lifecycle?.acceptPageAssignment(payload, serial),
    () => !settings.get().disabled && routes.isCatalogOnly())
  lifecycle = new LifecycleController(session, settings, vault, routes, playurl, pagePlayinfo, runtime, now, new BrowserNavigation(), scheduler)
  const webRtc = new WebRtcAdapter(settings)
  const commands = new ControlCommands(settings, restrictions, evidence, meta, routes, measurement, recovery, now)
  const center = new ControlCenter({ settings, restrictions, evidence, session, routes, measurement, monitor, recovery, transport,
    diagnostics, commands, now })
  const panel = new PlayerPanel(center, settings, session, monitor)

  lifecycle.subscribe(event => runtime.record(event))
  runtime.install()
  webRtc.install()
  lifecycle.start()
  panel.start()
  try { GM_registerMenuCommand('⚙️ 開啟 BiliCDN v2 控制中心', () => center.show()) } catch { /* optional */ }
}

start()
