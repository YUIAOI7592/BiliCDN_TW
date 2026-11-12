import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type TestContext } from 'node:test'
import {
  addEvidenceSample,
  emptyEvidence,
  evidenceMetrics,
} from '../../../src-v2/domain/evidence.ts'
import { assessDemandRatio, chooseRoute, rankRoutes } from '../../../src-v2/domain/routing.ts'
import { decisionId } from '../../../src-v2/domain/model.ts'
import { TRUSTED_CATALOG } from '../../../src-v2/domain/catalog.ts'
import {
  parseMediaUrl,
  replaceUrlHost,
  isOversizedBilibiliMedia,
  MEDIA_URL_MAX_LENGTH,
} from '../../../src-v2/domain/url-policy.ts'

test('V2219 media path recognition preserves the rewrite limit and oversized host boundary', () => {
  for (const [path, kind] of [
    ['/video.M4S', 'normal'],
    ['/video.mp4', 'normal'],
    ['/video.flv', 'normal'],
    ['/video.m3u8', 'normal'],
    ['/upgcxcode/segment', 'normal'],
    ['/v1/resource/segment', 'resource'],
    ['/live-bvc/segment', 'live'],
    ['/unrecognized', 'unknown'],
  ] as const) {
    const prefix = `https://upos-test.bilivideo.com${path}?padding=`
    const bounded = prefix + 'x'.repeat(MEDIA_URL_MAX_LENGTH - prefix.length)
    assert.equal(parseMediaUrl(bounded)?.kind, kind, path)
    assert.equal(isOversizedBilibiliMedia(bounded), false, path)
    assert.equal(parseMediaUrl(bounded + 'x'), null, path)
    assert.equal(isOversizedBilibiliMedia(bounded + 'x'), kind !== 'unknown', path)
  }
  for (const [prefix, expected] of [
    ['//upos-test.bilivideo.com/video.mp4', true],
    ['http://upos-test.bilivideo.com/video.mp4', true],
    ['https://upos-test.akamaized.net/video.mp4', true],
    ['https://test.szbdyd.com/video.mp4', true],
    ['https://third-party.example/video.mp4', false],
    ['https://other.akamaized.net/video.mp4', false],
    ['ftp://upos-test.bilivideo.com/video.mp4', false],
  ] as const)
    assert.equal(
      isOversizedBilibiliMedia(prefix + '?' + 'x'.repeat(MEDIA_URL_MAX_LENGTH)),
      expected,
    )
})

test('V221 overview demand headroom retains threshold semantics', () => {
  assert.strictEqual(assessDemandRatio(0.999), 'below-required')
  assert.strictEqual(assessDemandRatio(1), 'meets-headroom') // Demand already includes the 25% margin.
  assert.strictEqual(assessDemandRatio(null), 'unknown')
  assert.strictEqual(assessDemandRatio(NaN), 'unknown')
})

// Named scenarios create only their prerequisite state; resources belong to this test.
async function createDomainScenario(_t: TestContext) {
  const now = 2_000_000_000_000
  const clock = { now: () => now }
  const evidence = addEvidenceSample(
    emptyEvidence('a.example', 'video'),
    {
      requestId: '1',
      at: now,
      source: 'transport',
      outcome: 'success',
      throughputMbps: 10,
      ttfbMs: 80,
      failureKind: null,
    },
    now,
  )
  return {
    clock,
    evidence,
    now,
  }
}

async function checkOneSampleUses70Percent1(t: TestContext): Promise<void> {
  const base = await createDomainScenario(t)

  assert.strictEqual(
    evidenceMetrics(base.evidence, base.now).safeThroughputMbps,
    7,
    'one sample uses 70 percent',
  )
  const second = addEvidenceSample(
    base.evidence,
    {
      requestId: '2',
      at: base.now + 1,
      source: 'transport',
      outcome: 'success',
      throughputMbps: 6,
      ttfbMs: 40,
      failureKind: null,
    },
    base.now + 1,
  )
  assert.strictEqual(
    evidenceMetrics(second, base.now + 1).safeThroughputMbps,
    6,
    'latest low bounds smoothed throughput',
  )
  assert.strictEqual(
    evidenceMetrics(second, base.now + 1).state,
    'proven',
    'two quiet successes are proven',
  )
  const failed = addEvidenceSample(
    second,
    {
      requestId: '3',
      at: base.now + 2,
      source: 'transport',
      outcome: 'failure',
      throughputMbps: null,
      ttfbMs: null,
      failureKind: 'timeout',
    },
    base.now + 2,
  )
  assert.strictEqual(
    evidenceMetrics(failed, base.now + 2).state,
    'circuit-open',
    'verified failure opens circuit',
  )
  assert.strictEqual(
    failed.circuitUntil - (base.now + 2),
    10 * 60_000,
    'first circuit backoff is ten minutes',
  )
  let stepped = failed
  for (let level = 2; level <= 4; level++) {
    stepped = addEvidenceSample(
      stepped,
      {
        requestId: `failure-${level}`,
        at: base.now + level,
        source: 'transport',
        outcome: 'failure',
        throughputMbps: null,
        ttfbMs: null,
        failureKind: 'network',
      },
      base.now + level,
    )
  }
  assert.strictEqual(
    stepped.circuitUntil - (base.now + 4),
    6 * 60 * 60_000,
    'circuit backoff caps at six hours',
  )
  let bounded = emptyEvidence('bounded.example', 'video')
  for (let index = 0; index < 20; index++)
    bounded = addEvidenceSample(
      bounded,
      {
        requestId: String(index),
        at: base.now + index,
        source: 'transport',
        outcome: 'success',
        throughputMbps: index + 1,
        ttfbMs: index,
        failureKind: null,
      },
      base.now + index,
    )
  assert.strictEqual(bounded.samples.length, 12, 'evidence window retains at most twelve samples')
  const candidate = {
    type: 'catalog-generated' as const,
    host: TRUSTED_CATALOG[0],
    kind: 'video' as const,
  }
  const restrictionInput = {
    candidates: [candidate],
    evidenceFor: () => null,
    restrictions: {
      disabledCatalogHosts: new Set<string>(),
      defaultUnavailableHosts: new Set<string>(),
      blackHosts: new Set([candidate.host]),
      deadHosts: new Set<string>(),
      hostLocked: new Set<string>(),
    },
    demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
    fixedHost: candidate.host,
    current: null,
    boundary: 'startup' as const,
    failedHost: null,
  }
  const restricted = rankRoutes(restrictionInput, base.now)[0]
  assert.strictEqual(restricted?.eligible, false, 'black precedes fixed host')
  assert.ok(restricted?.reasons.includes('black'), 'black reason retained')
  assert.strictEqual(
    chooseRoute(restrictionInput, base.clock, decisionId('d1')).action,
    'block',
    'forbidden-only route blocks',
  )
}

async function checkColdStartRewritesToCatalogDefault2(t: TestContext): Promise<void> {
  const base = await createDomainScenario(t)
  const candidate = {
    type: 'catalog-generated' as const,
    host: TRUSTED_CATALOG[0],
    kind: 'video' as const,
  }
  const restrictionInput = {
    candidates: [candidate],
    evidenceFor: () => null,
    restrictions: {
      disabledCatalogHosts: new Set<string>(),
      defaultUnavailableHosts: new Set<string>(),
      blackHosts: new Set([candidate.host]),
      deadHosts: new Set<string>(),
      hostLocked: new Set<string>(),
    },
    demand: { kind: 'video' as const, requiredMbps: 8, highDemand: false },
    fixedHost: candidate.host,
    current: null,
    boundary: 'startup' as const,
    failedHost: null,
  }
  const coldInput = {
    ...restrictionInput,
    restrictions: { ...restrictionInput.restrictions, blackHosts: new Set<string>() },
    fixedHost: null,
  }
  const cold = chooseRoute(coldInput, base.clock, decisionId('d2'))

  assert.strictEqual(cold.action, 'rewrite', 'cold start rewrites to catalog default')
  assert.strictEqual(cold.host, candidate.host, 'cold start chooses first eligible catalog')
  const coldRoot = {
    type: 'root-original' as const,
    host: 'upos-hz-mirrorakam.akamaized.net',
    kind: 'video' as const,

    route: null,
    handle: null,
  }
  const coldWithRoot = chooseRoute(
    { ...coldInput, candidates: [candidate, coldRoot] },
    base.clock,
    decisionId('d2-root'),
  )
  assert.strictEqual(
    coldWithRoot.action,
    'rewrite',
    'V227 unverified candidates follow the supplied stable candidate order',
  )
  const secondCatalog = {
    type: 'catalog-generated' as const,
    host: TRUSTED_CATALOG[1],
    kind: 'video' as const,
  }
  const measured = new Map<string, ReturnType<typeof addEvidenceSample>>([
    [
      candidate.host,
      addEvidenceSample(
        emptyEvidence(candidate.host, 'video'),
        {
          requestId: 'catalog-first',
          at: base.now,
          source: 'challenge',
          outcome: 'success',
          throughputMbps: 20,
          ttfbMs: 20,
          failureKind: null,
        },
        base.now,
      ),
    ],
    [
      secondCatalog.host,
      addEvidenceSample(
        emptyEvidence(secondCatalog.host, 'video'),
        {
          requestId: 'catalog-second',
          at: base.now,
          source: 'challenge',
          outcome: 'success',
          throughputMbps: 40,
          ttfbMs: 40,
          failureKind: null,
        },
        base.now,
      ),
    ],
  ])
  const fairDecision = chooseRoute(
    {
      ...coldInput,
      candidates: [candidate, secondCatalog, coldRoot],
      evidenceFor: (host) => measured.get(host) ?? null,
      boundary: 'new-epoch',
    },
    base.clock,
    decisionId('fair-selection'),
  )
  assert.strictEqual(
    fairDecision.host,
    secondCatalog.host,
    'new epoch ranks measured safety margin before Catalog static order',
  )
  const insufficientDecision = chooseRoute(
    {
      ...coldInput,
      candidates: [candidate, coldRoot],
      evidenceFor: (host) =>
        host === candidate.host
          ? addEvidenceSample(
              emptyEvidence(host, 'video'),
              {
                requestId: 'slow',
                at: base.now,
                source: 'challenge',
                outcome: 'success',
                throughputMbps: 5,
                ttfbMs: 10,
                failureKind: null,
              },
              base.now,
            )
          : null,
      boundary: 'new-epoch',
    },
    base.clock,
    decisionId('insufficient-selection'),
  )
  assert.strictEqual(
    insufficientDecision.host,
    candidate.host,
    'a valid measured route precedes an unverified original even below headroom',
  )
  const parsed = parseMediaUrl(
    'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/a/b/1.m4s?token=x',
  )
  assert.strictEqual(parsed?.kind, 'normal', 'media URL recognized')
  assert.strictEqual(
    replaceUrlHost(parsed?.url.href ?? '', TRUSTED_CATALOG[3]),
    `https://${TRUSTED_CATALOG[3]}/upgcxcode/a/b/1.m4s?token=x`,
    'catalog replacement preserves the exact path and query in a valid media URL',
  )
  assert.strictEqual(
    parseMediaUrl('https://1.2.3.4:8080/a.m4s')?.kind,
    'pcdn',
    'special-port IP rejected as PCDN',
  )
  assert.strictEqual(
    parseMediaUrl('https://x.example/live-bvc/a.m4s')?.kind,
    'live',
    'live route identified',
  )
}

test('one sample uses 70 percent [1]', { timeout: 5000 }, async (t) => {
  await checkOneSampleUses70Percent1(t)
})

test('cold start rewrites to catalog default [2]', { timeout: 5000 }, async (t) => {
  await checkColdStartRewritesToCatalogDefault2(t)
})
