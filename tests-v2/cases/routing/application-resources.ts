import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { type TestContext } from 'node:test'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

export function createStallEvidenceResources(now: number, scope: ReturnType<typeof testScope>) {
  let stallNow = now
  const stallEvidence = scope.own(new EvidenceStore(new FakeStorage(), () => stallNow))
  const stallRestrictions = scope.own(new RestrictionStore(new FakeStorage(), () => stallNow))
  const stallSettings = scope.own(new CatalogSettingsStore(new FakeStorage(), () => stallNow))
  return {
    get stallNow() {
      return stallNow
    },
    set stallNow(value: typeof stallNow) {
      stallNow = value
    },
    stallEvidence,
    stallRestrictions,
    stallSettings,
  }
}

export function createStartupVaultResources() {
  const startupSession = new SessionStore()
  const startupGeneration = startupSession.beginGeneration(false)
  const startupVault = new SignedRouteVault()
  return { startupSession, startupGeneration, startupVault }
}

export async function createRouteStateResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const storage = new FakeStorage()
  const restrictions = scope.own(new RestrictionStore(storage, () => now))
  const settings = scope.own(new CatalogSettingsStore(storage, () => now))
  const evidenceStore = scope.own(new EvidenceStore(storage, () => now))
  const session = new SessionStore()
  const liveVault = new SignedRouteVault()
  const state = session.beginGeneration(false)
  liveVault.reset(state.generation, state.epoch)
  return {
    scope,
    now,
    clock,
    storage,
    restrictions,
    settings,
    evidenceStore,
    session,
    liveVault,
    state,
  }
}
