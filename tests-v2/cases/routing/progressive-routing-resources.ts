import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { type TestContext } from 'node:test'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

export function createProgressiveSourceUrls() {
  const opaque =
    'https://upos-hz-mirrorakam.akamaized.net/opaque/progressive/segment-1?token=opaque'
  const segment1 =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-1.mp4?token=backup&part=1'
  const segment2 =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/progressive/segment-2.flv?token=backup&part=2'
  return { opaque, segment1, segment2 }
}

export async function createRoutingResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const storage = new FakeStorage()
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const evidence = scope.own(new EvidenceStore(storage, () => now))
  const session = new SessionStore()
  const state = session.beginGeneration(false)
  const vault = new SignedRouteVault()
  vault.reset(state.generation, state.epoch)
  const routes = new RouteCoordinator(
    { now: () => now, monotonicNow: () => now },
    session,
    settings,
    restrictions,
    evidence,
    vault,
    createRuntimeIds(),
  )
  return { scope, now, settings, state, vault, routes }
}
