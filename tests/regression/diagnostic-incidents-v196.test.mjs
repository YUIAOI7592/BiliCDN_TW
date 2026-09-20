import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createEvents } from '../../src/diagnostics/events.mjs'

const require = createRequire(import.meta.url)
const F = require('../harness/v153-fixture')

const CATALOG = 'upos-sz-mirrorali.bilivideo.com'
const NATIVE = 'upos-hz-mirrorakam.akamaized.net'
const makeLog = (verbose, overrides = {}) => {
    const prior = globalThis.GM_getValue
    globalThis.GM_getValue = () => verbose
    const events = createEvents({ VERSION: '1.9.6', TRUSTED_CDN_CATALOG_SET: new Set([CATALOG]),
        mediaContextActive: () => true, ...overrides })
    globalThis.GM_getValue = prior
    events.DiagnosticLog.boundary(1, 1, 'active')
    return events
}
const media = (kind = 'video', routeType = 'catalog-generated') => ({
    runtime: { generation: 1 }, epoch: 1, rep: { kind },
    route: { groupId: `1:${kind}:1`, revision: 7 },
    routeDecision: { type: routeType, host: routeType === 'native-signed' ? NATIVE : CATALOG,
        revision: 7, decisionId: 'decision-7' },
})

test('v196 one thousand successful requests become bounded five-second aggregates, not lifecycle events', () => {
    const { DiagnosticLog: log, Config } = makeLog(false)
    for (let i = 0; i < 1000; i++) {
        const id = log.request('fetch', media(), CATALOG, CATALOG)
        log.updateRequest(id, 'headers', { status: 206, finalHost: CATALOG })
        log.updateRequest(id, 'body', { bytes: 4096 })
        log.updateRequest(id, 'eof', { bytes: 4096 })
    }
    Config.verbose = true
    const snapshot = log.snapshot()
    assert.equal(snapshot.pending.length, 0)
    assert.equal(snapshot.successSummary.reduce((n, item) => n + item.successCount, 0), 1000)
    assert.equal([...snapshot.critical, ...snapshot.detail].some(event => ['request','headers','eof'].includes(event.code)), false)
    assert.ok(snapshot.aggregates.length <= 12)
    assert.ok(Buffer.byteLength(JSON.stringify(snapshot.aggregates)) < 32 * 1024)
    log.clearIncident()
})

test('v196 aggregate storage remains within 32 KiB under many distinct route groups', () => {
    const { DiagnosticLog: log, Config } = makeLog(false, { now: () => 5000 })
    for (let i = 0; i < 300; i++) {
        const context = media()
        context.route.groupId = `1:video:${i}`
        const id = log.request('xhr', context, CATALOG, CATALOG)
        log.updateRequest(id, 'headers', { status: 206, finalHost: CATALOG })
        log.updateRequest(id, 'eof', { bytes: 4096 })
    }
    Config.verbose = true
    const snapshot = log.snapshot()
    assert.ok(Buffer.byteLength(JSON.stringify(snapshot.aggregates)) <= 32 * 1024)
    assert.ok(snapshot.aggregateEvicted > 0)
})

test('v196 important failure and incident causality exist with Verbose off', () => {
    const { DiagnosticLog: log, Config } = makeLog(false)
    assert.equal(Config.verbose, false)
    const context = media('audio', 'native-signed')
    context.routeDecision.actionId = 'route-9'
    const id = log.request('xhr', context, NATIVE, NATIVE)
    log.updateRequest(id, 'headers', { status: 503, finalHost: NATIVE })
    log.updateRequest(id, 'http', { status: 503, bytes: 1234 })
    log.record('route', { stage: 'fallback-planned', reason: 'verified-native-failure', actionId: 'route-9',
        kind: 'audio', failedHost: NATIVE, fallbackType: 'catalog-generated', fallbackHost: CATALOG,
        routeType: 'catalog-generated', routeRevision: 8, groupOrdinal: 1, waitingForRetry: true }, true)
    log.record('route', { stage: 'fallback-observed', reason: 'verified-native-failure', actionId: 'route-9',
        kind: 'audio', finalHost: CATALOG, routeType: 'catalog-generated', routeRevision: 8,
        groupOrdinal: 1, waitingForRetry: false }, true)
    const snapshot = log.snapshot()
    assert.equal(snapshot.detail.length, 0)
    assert.ok(snapshot.critical.some(event => event.code === 'request-failure'
        && event.data.failureKind === 'http' && event.data.kind === 'audio'))
    const chain = snapshot.critical.filter(event => event.code === 'route' && event.data.actionId === 'route-9')
    assert.deepEqual(chain.map(event => event.data.stage), ['fallback-requested','fallback-planned','fallback-observed'])
    assert.ok(snapshot.incident)
    assert.match(JSON.stringify(snapshot), /route-9/)
    assert.doesNotMatch(JSON.stringify(snapshot), /upgcxcode|token=|cookie=/i)
    log.clearIncident()
})

test('v196 schema reports dropped fields and aliases unknown providers without leaking URLs', () => {
    const { DiagnosticLog: log } = makeLog(false)
    log.record('route', { stage: 'failure-detected', actionId: 'route-1', failedHost: 'https://outside.example/private/path?token=SECRET',
        privateUrl: 'https://secret.invalid/?cookie=PRIVATE', routeType: 'native-signed', groupOrdinal: 1 }, true)
    const snapshot = log.snapshot()
    assert.ok(snapshot.droppedFields >= 1)
    assert.ok(snapshot.droppedFieldNames.includes('privateUrl'))
    assert.equal(snapshot.critical.at(-1).data.failedHost, 'external#1')
    assert.doesNotMatch(JSON.stringify(snapshot), /SECRET|PRIVATE|outside\.example|secret\.invalid|private\/path/)
    const marked = log.markIncident('manual-stall')
    assert.equal(marked.ok, true)
    assert.equal(log.clearIncident(), true)
    assert.equal(log.snapshot().incident, null)
})

test('v196 Verbose changes successful detail only, not failure causality', () => {
    const exercise = verbose => {
        const { DiagnosticLog: log } = makeLog(verbose, { now: () => 2000 })
        const context = media('audio', 'native-signed')
        context.routeDecision.actionId = 'route-11'
        const id = log.request('fetch', context, NATIVE, NATIVE)
        log.updateRequest(id, 'headers', { status: 503, finalHost: NATIVE })
        log.updateRequest(id, 'http', { status: 503 })
        log.record('route', { stage: 'fallback-planned', reason: 'verified-native-failure', actionId: 'route-11',
            kind: 'audio', failedHost: NATIVE, fallbackType: 'catalog-generated', fallbackHost: CATALOG,
            routeType: 'catalog-generated', routeRevision: 8, groupOrdinal: 1, waitingForRetry: true }, true)
        const result = log.snapshot()
        log.clearIncident()
        return result.critical.filter(entry => entry.code === 'request-failure'
            || (entry.code === 'route' && entry.data.actionId === 'route-11'))
            .map(entry => ({ code: entry.code, data: entry.data }))
    }
    assert.deepEqual(exercise(true), exercise(false))
})

test('v196 incident freezes after post-context and later healthy traffic cannot overwrite it', () => {
    let now = 1000
    let scheduled = null
    const { DiagnosticLog: log } = makeLog(false, {
        now: () => now,
        setTimeout: callback => { scheduled = callback; return 1 },
        clearTimeout: () => { scheduled = null },
    })
    log.record('request-failure', {
        id: 9, method: 'fetch', kind: 'video', originalHost: CATALOG, targetHost: CATALOG,
        finalHost: CATALOG, status: 503, bytes: 0, startAt: now - 200,
        responseAt: now - 100, endAt: now, phase: 'body', failureKind: 'http',
        ttfbMs: 100, elapsedMs: 200, progressCount: 0, maxNoProgressMs: 200,
        routeType: 'catalog-generated', groupOrdinal: 1, routeRevision: 2,
        decisionId: 'decision-2', actionId: 'route-12',
    }, true)
    now += 30000
    scheduled()
    const frozen = log.snapshot().incident
    assert.equal(frozen.state, 'frozen')
    const frozenJson = JSON.stringify(frozen)
    const id = log.request('fetch', media(), CATALOG, CATALOG)
    log.updateRequest(id, 'headers', { status: 206, finalHost: CATALOG })
    log.updateRequest(id, 'eof', { bytes: 8192 })
    assert.equal(JSON.stringify(log.snapshot().incident), frozenJson)
})

test('v196 trusted incident buttons only change page-memory diagnostics', () => {
    const h = F.load({ gmSeed: { verbose: false } })
    h.menus[0].callback()
    F.click(h, 'diagnostics')
    const requests = h.fetchCalls.length
    const writes = h.gmWrites.length
    F.click(h, 'incident-mark')
    assert.ok(F.json(h, 'DiagnosticLog.snapshot().incident'))
    assert.equal(h.fetchCalls.length, requests)
    assert.equal(h.gmWrites.length, writes)
    F.click(h, 'incident-clear')
    assert.equal(F.json(h, 'DiagnosticLog.snapshot().incident'), null)
    assert.equal(h.fetchCalls.length, requests)
    assert.equal(h.gmWrites.length, writes)
})
