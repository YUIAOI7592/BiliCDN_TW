import { createRuntimeIds } from "../../../src-v2/platform/runtime-ids.ts"
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl.ts'
import { PlayurlController } from '../../../src-v2/application/playurl-controller.ts'
import { RouteCoordinator } from '../../../src-v2/application/route-coordinator.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { testScope } from '../../support/scope.ts'
import { FakeStorage } from '../../support/storage.ts'
import { FakeClock } from '../../support/clock.ts'

export const fixture = (scope: ReturnType<typeof testScope>, storage = new FakeStorage()) => {
  const clock = scope.own(new FakeClock())
  const session = new SessionStore(), vault = new SignedRouteVault()
  const state = session.beginGeneration(false)
  vault.reset(state.generation, state.epoch)
  const settings = scope.own(new SettingsStore(storage, clock.now))
  const restrictions = scope.own(new RestrictionStore(storage, clock.now))
  const evidence = scope.own(new EvidenceStore(storage, clock.now))
  const routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, createRuntimeIds())
  const controller = new PlayurlController(session, vault, routes, settings)
  const adapter = new PlayurlAdapter(controller)
  return { clock, storage, session, vault, settings, restrictions, evidence, routes, controller, adapter }
}

export const media = (content: string, file: string, signature = 'fresh'): string =>
  `https://upos-hz-mirrorakam.akamaized.net/upgcxcode/${content}/${file}?syntheticSignature=${signature}`
export const progressive = (url: string, format: 'mp4' | 'flv' = 'mp4') => ({ code: 0, data: {
  quality: 80, format, durl: [{ order: 1, length: 1000, size: 65536, url, backup_url: [] as string[] }],
} })
export const dash = (url: string) => ({ code: 0, data: { dash: { video: [{ id: 80,
  height: 1080, codecs: 'avc1.640028', bandwidth: 4_000_000, base_url: url, backup_url: [] as string[],
}], audio: [] } } })
