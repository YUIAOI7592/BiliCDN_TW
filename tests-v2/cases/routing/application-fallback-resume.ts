import { createMutablePlaybackResources } from '../../support/player.ts'
import { currentResumePlayer } from '../../support/player.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import { RouteCoordinator } from '../../../src-v2/application/routing/route-coordinator.ts'
import { RecoveryController } from '../../../src-v2/application/playback/recovery-controller.ts'
import { createRouteStateResources } from './application-resources.ts'
import { testScope } from '../../support/scope.ts'

async function createHostLockNeverRestoresADeadRootAndMayChooseAContext14(t: TestContext) {
  const resources = await createRouteStateResources(t)
  const { liveVault, state, clock, session, settings, restrictions, evidenceStore, now } = resources

  const liveRep = liveVault.register({
    generation: state.generation,
    epoch: state.epoch,
    kind: 'video',
    key: '80:av1',
    height: 1080,
    codec: 'av1',
    bandwidth: 3_000_000,
    urls: ['https://upos-sz-mirrorali.bilivideo.com/upgcxcode/c/d/2.m4s?k=1'],
    source: 'page-hint',
  })
  const coordinator = new RouteCoordinator(
    clock,
    session,
    settings,
    restrictions,
    evidenceStore,
    liveVault,
    createRuntimeIds(),
  )
  return {
    coordinator,
    liveRep,
    liveVault,
    now,
    restrictions,
  }
}

async function checkHostLockNeverRestoresADeadRootAndMayChooseA(t: TestContext): Promise<void> {
  const base = await createHostLockNeverRestoresADeadRootAndMayChooseAContext14(t)

  assert.ok(base.liveRep, 'behavior requires its fixture prerequisites')
  {
    const root = base.liveVault.rootUrl(base.liveRep)!,
      lockedHost = new URL(root).host
    await base.restrictions.add({
      host: lockedHost,
      type: 'dead',
      kind: 'all',
      reason: 'host-lock-test',
      expireAt: base.now + 60_000,
    })
    const deadRootFallback = base.coordinator.apply(root)
    assert.ok(
      deadRootFallback.url !== root && deadRootFallback.decision.host !== lockedHost,
      'host-lock never restores a dead root and may choose a legal alternative',
    )
    const lockedPlan = base.coordinator.plan(
      base.liveRep,
      { kind: 'video', requiredMbps: 3, highDemand: false },
      'startup',
    )
    assert.ok(
      base.coordinator.playerOutput(base.liveRep, root, lockedPlan, [root]).primary !== root,
      'host-locked dead root cannot leak through playurl output',
    )
  }
}

async function checkNormalShortResumeReturnsHealthyState16(t: TestContext): Promise<void> {
  const base = createMutablePlaybackResources(),
    scope = testScope(t)
  let shortResumeNow = 2_000_000_000_000
  const shortResume = scope.own(
    new RecoveryController(currentResumePlayer(base.recoveryPlayer), () => shortResumeNow),
  )
  shortResume.tick({ ...base.playerSnapshot, paused: false })
  shortResumeNow += 1000
  shortResume.tick({ ...base.playerSnapshot, paused: true })
  shortResumeNow += 1000
  shortResume.tick({ ...base.playerSnapshot, paused: false, frames: 100 })

  assert.strictEqual(
    shortResume.snapshot().state,
    'healthy',
    'normal short resume returns to healthy recovery state',
  )
}

test(
  'host-lock never restores a dead root and may choose a legal alternative [15]',
  { timeout: 5000 },
  async (t) => {
    await checkHostLockNeverRestoresADeadRootAndMayChooseA(t)
  },
)

test('normal short resume returns to healthy recovery state [16]', { timeout: 5000 }, async (t) => {
  await checkNormalShortResumeReturnsHealthyState16(t)
})
