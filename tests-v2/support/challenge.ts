import assert from 'node:assert/strict'
import type {
  AppliedRouteDecision,
  ChallengeProposal,
  RouteCoordinatorPort,
} from '../../src-v2/application/routing/route-contracts.ts'

type ChallengeRoutes = Pick<RouteCoordinatorPort, 'proposeChallenge' | 'commitChallenge'>

export function challengeOnce(
  routes: ChallengeRoutes,
  ...args: Parameters<ChallengeRoutes['proposeChallenge']>
): AppliedRouteDecision | null {
  const proposal = routes.proposeChallenge(...args)
  return proposal ? routes.commitChallenge(proposal) : null
}

export function stubChallengeRoutes(
  select: (...args: Parameters<ChallengeRoutes['proposeChallenge']>) => AppliedRouteDecision | null,
): ChallengeRoutes {
  const pending = new WeakMap<ChallengeProposal, AppliedRouteDecision>()
  return {
    proposeChallenge: (...args) => {
      const applied = select(...args)
      if (!applied) return null
      assert.equal(applied.decision.action, 'rewrite')
      if (applied.decision.action !== 'rewrite') return null
      const candidate = applied.decision.candidate
      assert.ok(applied.context && applied.url)
      const proposal: ChallengeProposal = {
        context: applied.context,
        candidate,
        url: applied.url,
        streamKey: applied.streamKey,
        priorityStamp: null,
      }
      pending.set(proposal, applied)
      return proposal
    },
    commitChallenge: (proposal) => {
      const applied = pending.get(proposal) ?? null
      pending.delete(proposal)
      return applied
    },
  }
}
