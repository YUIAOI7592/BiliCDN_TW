import { CatalogSettingsStore } from '../../support/catalog-settings.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { type TestContext } from 'node:test'
import { PlayurlController } from '../../../src-v2/application/playurl/playurl-controller.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl/playurl.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'

// Named scenarios create only their prerequisite state; resources belong to this test.

export async function createRoutingResources(t: TestContext) {
  const scope = testScope(t)
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const catalogStorage = new FakeStorage()
  const catalogSettings = scope.own(new CatalogSettingsStore(catalogStorage, () => now))
  const catalogSession = new SessionStore()
  const catalogState = catalogSession.beginGeneration(false)
  const catalogVault = new SignedRouteVault()
  catalogVault.reset(catalogState.generation, catalogState.epoch)
  const catalogRestrictions = scope.own(new RestrictionStore(catalogStorage, () => now))
  const catalogEvidence = scope.own(new EvidenceStore(catalogStorage, () => now))
  const catalogRoutes = new RouteCoordinator(
    clock,
    catalogSession,
    catalogSettings,
    catalogRestrictions,
    catalogEvidence,
    catalogVault,
    createRuntimeIds(),
  )
  const catalogAdapter = new PlayurlAdapter(
    new PlayurlController(catalogSession, catalogVault, catalogRoutes),
  )
  const catalogVideoRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/video.m4s?signature=video-root'
  const catalogVideoBackup =
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/catalog-only/backup/video-alt.m4s?signature=video-backup&part=2'
  const catalogAudioRoot =
    'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/catalog-only/audio.m4s?signature=audio-root'
  return {
    catalogSettings,
    catalogSession,
    catalogVault,
    catalogEvidence,
    catalogRoutes,
    catalogAdapter,
    catalogVideoRoot,
    catalogVideoBackup,
    catalogAudioRoot,
  }
}
