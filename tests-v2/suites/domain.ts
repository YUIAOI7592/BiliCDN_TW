import { addEvidenceSample, emptyEvidence, evidenceMetrics } from '../../src-v2/domain/evidence.ts'
import { chooseRoute, rankRoutes } from '../../src-v2/domain/routing.ts'
import { decisionId, requestId } from '../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { parseMediaUrl, replaceUrlHost } from '../../src-v2/domain/url-policy.ts'

import { check, equal, assertionCount } from '../support/assert.ts'
import { testScope } from '../support/scope.ts'
const scope = testScope()
try {
const now = 2_000_000_000_000
const clock = { now: () => now }
const evidence = addEvidenceSample(emptyEvidence('a.example', 'video'), {
  requestId: '1', at: now, source: 'transport', outcome: 'success', throughputMbps: 10, ttfbMs: 80, failureKind: null,
}, now)
equal(evidenceMetrics(evidence, now).safeThroughputMbps, 7, 'one sample uses 70 percent')
const second = addEvidenceSample(evidence, {
  requestId: '2', at: now + 1, source: 'transport', outcome: 'success', throughputMbps: 6, ttfbMs: 40, failureKind: null,
}, now + 1)
equal(evidenceMetrics(second, now + 1).safeThroughputMbps, 6, 'two samples use minimum')
equal(evidenceMetrics(second, now + 1).state, 'proven', 'two quiet successes are proven')
const failed = addEvidenceSample(second, {
  requestId: '3', at: now + 2, source: 'transport', outcome: 'failure', throughputMbps: null, ttfbMs: null, failureKind: 'timeout',
}, now + 2)
equal(evidenceMetrics(failed, now + 2).state, 'circuit-open', 'verified failure opens circuit')
equal(failed.circuitUntil - (now + 2), 10 * 60_000, 'first circuit backoff is ten minutes')
let stepped = failed
for (let level = 2; level <= 4; level++) {
  stepped = addEvidenceSample(stepped, { requestId: `failure-${level}`, at: now + level, source: 'transport', outcome: 'failure',
    throughputMbps: null, ttfbMs: null, failureKind: 'network' }, now + level)
}
equal(stepped.circuitUntil - (now + 4), 6 * 60 * 60_000, 'circuit backoff caps at six hours')
let bounded = emptyEvidence('bounded.example', 'video')
for (let index = 0; index < 20; index++) bounded = addEvidenceSample(bounded, { requestId: String(index), at: now + index,
  source: 'transport', outcome: 'success', throughputMbps: index + 1, ttfbMs: index, failureKind: null }, now + index)
equal(bounded.samples.length, 12, 'evidence window retains at most twelve samples')

const candidate = { type: 'catalog-generated' as const, host: TRUSTED_CATALOG[0], kind: 'video' as const, catalogIndex: 0 }
const restrictionInput = {
  candidates: [candidate], evidenceFor: () => null,
  restrictions: { disabledCatalogHosts: new Set<string>(), defaultUnavailableHosts: new Set<string>(), blackHosts: new Set([candidate.host]), deadHosts: new Set<string>(), hostLocked: new Set<string>() },
  demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false }, fixedHost: candidate.host,
  current: null, boundary: 'startup' as const, failedHost: null,
}
const restricted = rankRoutes(restrictionInput, now)[0]
equal(restricted?.eligible, false, 'black precedes fixed host')
check(restricted?.reasons.includes('black'), 'black reason retained')
equal(chooseRoute(restrictionInput, clock, decisionId('d1')).action, 'block', 'forbidden-only route blocks')

const coldInput = { ...restrictionInput, restrictions: { ...restrictionInput.restrictions, blackHosts: new Set<string>() }, fixedHost: null }
const cold = chooseRoute(coldInput, clock, decisionId('d2'))
equal(cold.action, 'rewrite', 'cold start rewrites to catalog default')
equal(cold.host, candidate.host, 'cold start chooses first eligible catalog')
const coldRoot = { type: 'root-original' as const, host: 'upos-hz-mirrorakam.akamaized.net', kind: 'video' as const,
  catalogIndex: Number.MAX_SAFE_INTEGER, route: null, handle: null }
const coldWithRoot = chooseRoute({ ...coldInput, candidates: [candidate, coldRoot] }, clock, decisionId('d2-root'))
equal(coldWithRoot.action, 'pass', 'cold start with a legal signed original does not blindly use first Catalog')
const secondCatalog = { type: 'catalog-generated' as const, host: TRUSTED_CATALOG[1], kind: 'video' as const, catalogIndex: 1 }
const measured = new Map<string, ReturnType<typeof addEvidenceSample>>([
  [candidate.host, addEvidenceSample(emptyEvidence(candidate.host, 'video'), { requestId: 'catalog-first', at: now,
    source: 'challenge', outcome: 'success', throughputMbps: 20, ttfbMs: 20, failureKind: null }, now)],
  [secondCatalog.host, addEvidenceSample(emptyEvidence(secondCatalog.host, 'video'), { requestId: 'catalog-second', at: now,
    source: 'challenge', outcome: 'success', throughputMbps: 40, ttfbMs: 40, failureKind: null }, now)],
])
const fairDecision = chooseRoute({ ...coldInput, candidates: [candidate, secondCatalog, coldRoot],
  evidenceFor: host => measured.get(host) ?? null, boundary: 'new-epoch' }, clock, decisionId('fair-selection'))
equal(fairDecision.host, secondCatalog.host, 'new epoch ranks measured safety margin before Catalog static order')
const insufficientDecision = chooseRoute({ ...coldInput, candidates: [candidate, coldRoot],
  evidenceFor: host => host === candidate.host ? addEvidenceSample(emptyEvidence(host, 'video'), { requestId: 'slow', at: now,
    source: 'challenge', outcome: 'success', throughputMbps: 5, ttfbMs: 10, failureKind: null }, now) : null,
  boundary: 'new-epoch' }, clock, decisionId('insufficient-selection'))
equal(insufficientDecision.action, 'pass', 'insufficient measured throughput preserves the legal original')

const parsed = parseMediaUrl('https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/1.m4s?token=x')
equal(parsed?.kind, 'normal', 'media URL recognized')
check(replaceUrlHost(parsed?.url.href ?? '', TRUSTED_CATALOG[3])?.includes(TRUSTED_CATALOG[3]), 'catalog replacement preserves a valid media URL')
equal(parseMediaUrl('https://1.2.3.4:8080/a.m4s')?.kind, 'pcdn', 'special-port IP rejected as PCDN')
equal(parseMediaUrl('https://x.example/live-bvc/a.m4s')?.kind, 'live', 'live route identified')


} finally { scope.dispose() }
console.log('domain: ' + assertionCount() + ' assertions')
