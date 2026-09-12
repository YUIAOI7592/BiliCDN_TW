'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { loadUserscript } = require('../harness/userscript-vm')

const root = path.resolve(__dirname, '../..')
const baseline = path.join(root, 'tests', 'fixtures', 'BiliCDN_TW_1.5.0.user.js')
const target = require('../harness/current-script')
const aliov = 'upos-sz-mirroraliov.bilivideo.com'

const settle = () => new Promise(resolve => setImmediate(resolve))
const uiRoot = h => {
    const host = h.document.getElementById('bilicdn-trusted-menu-ui')
    assert.ok(host, 'trusted UI host missing')
    assert.equal(host.shadowRoot, null)
    return h.getClosedShadowRoot(host)
}
const action = (h, name) => uiRoot(h).querySelector(`[data-ui-action="${name}"]`)
const trusted = (h, node) => {
    assert.ok(node, 'trusted action missing')
    node.dispatchEvent(new h.context.Event('click', { isTrusted: true }))
}

test('v1.5.0 reproduction: new PCDN families are not classified and live media reaches the rewrite sink', () => {
    const h = loadUserscript(baseline, { gmSeed: { disabled: false } })
    const result = h.evaluate(`(() => ({
        mountaintoys: isUnstableCdnHost('node.edge.mountaintoys.cn'),
        redirect302: isUnstableCdnHost('upos-sz-302ppio.bilivideo.com'),
        live: replaceUrlHost('https://upos-sz-mirrorali.bilivideo.com/live-bvc/1/live.m3u8?sig=x', '${aliov}')
    }))()`)
    assert.equal(result.mountaintoys, false)
    assert.equal(result.redirect302, false)
    assert.match(result.live, /mirroraliov/)
})

test('v1.5.3 classifies explicit PCDN, observes port-only endpoints, and keeps safe counterexamples', () => {
    const h = loadUserscript(target, { gmSeed: { disabled: true } })
    const samples = JSON.parse(h.evaluate(`JSON.stringify([
        classifyMediaDelivery('https://node.edge.mountaintoys.cn/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://node.nexusedgeio.com/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://node.ahdohpiechei.com/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://upos-sz-mirror14b.bilivideo.com/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://upos-sz-302ppio.bilivideo.com/upgcxcode/a.m4s'),
        classifyMediaDelivery('//xy1x2x3x4xy.mcdn.bilivideo.net:8082/upgcxcode/a.m4s?os=mcdn'),
        classifyMediaDelivery('https://upos-sz-mirroraliov.bilivideo.com/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://upos-sz-mirrorcosov.bilivideo.com:443/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://upos-sz-mirrorhwov.bilivideo.com:443/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://d1--cn-gotcha302.bilivideo.com/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://upos-sz-mirroraliov.bilivideo.com:8443/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://evilmountaintoys.cn/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://node.mountaintoys.cn/not-media.txt'),
        classifyMediaDelivery('//1.2.3.4:8080/upgcxcode/a.m4s'),
        classifyMediaDelivery('https://safe.example/upgcxcode/a.m4s?os=MCDN'),
        classifyMediaDelivery('https://unlisted.example:8443/upgcxcode/a.m4s')
    ])`))
    for (const index of [0, 1, 2, 3, 4, 5]) assert.equal(samples[index].kind, 'pcdn')
    assert.equal(samples[6].kind, 'normal')
    assert.equal(samples[7].kind, 'normal')
    assert.equal(samples[8].kind, 'normal')
    assert.equal(samples[9].kind, 'normal')
    assert.equal(samples[10].kind, 'suspected-pcdn')
    assert.equal(samples[11].kind, 'normal')
    assert.equal(samples[12].kind, 'unknown')
    assert.equal(samples[13].kind, 'pcdn')
    assert.equal(samples[14].kind, 'pcdn')
    assert.equal(samples[15].kind, 'suspected-pcdn')
})

test('v1.5.3 rewrites explicit PCDN only through trusted targets and guards special/live paths', () => {
    const h = loadUserscript(target, { gmSeed: { disabled: false } })
    const result = h.evaluate(`(() => {
        const media = 'https://node.edge.mountaintoys.cn/upgcxcode/a.m4s?sig=x'
        const portOnly = 'https://upos-sz-mirroraliov.bilivideo.com:8443/upgcxcode/a.m4s?sig=x'
        const special = 'https://xy1x2x3x4xy.mcdn.bilivideo.cn:8082/v1/resource/a.m4s?sig=x'
        const live = 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/1/live.m3u8?sig=x'
        return {
            explicit: normalizeMediaUrl(media),
            portOnly: normalizeMediaUrl(portOnly),
            special: replaceUrlHost(special, TRUSTED_CDN_CATALOG[0]),
            live: replaceUrlHost(live, TRUSTED_CDN_CATALOG[0]),
            catalogHasPcdn: TRUSTED_CDN_CATALOG.some(h => /mountaintoys|nexusedgeio|ahdohpiechei|mirror14b|mcdn/.test(h)),
        }
    })()`)
    assert.equal(result.explicit.changed, true)
    assert.equal(h.evaluate(`TRUSTED_CDN_CATALOG_SET.has(${JSON.stringify(new URL(result.explicit.url).hostname)})`), true)
    assert.equal(result.portOnly.changed, false)
    assert.equal(result.special, null)
    assert.equal(result.live, null)
    assert.equal(result.catalogHasPcdn, false)
    assert.equal(h.evaluate(`recordCdnHealthSuccess('node.edge.mountaintoys.cn', Date.now())`), false)
    assert.equal(h.evaluate(`Object.prototype.hasOwnProperty.call(cdnHealth, 'node.edge.mountaintoys.cn')`), false)
})

test('v1.7.0 main sink retains the PCDN, catalog, resource, and live guards', async () => {
    const h = loadUserscript(target, { gmSeed: { disabled: false } })
    const explicit = 'https://node.edge.mountaintoys.cn/upgcxcode/a.m4s?sig=x'
    const suspected = 'https://upos-sz-mirroraliov.bilivideo.com:8443/upgcxcode/a.m4s?sig=x'
    const resource = 'https://node.mcdn.bilivideo.net:8082/v1/resource/a.m4s?sig=x'
    const live = 'https://upos-sz-mirrorali.bilivideo.com/live-bvc/1/live.m3u8?sig=x'
    await h.pageWindow.fetch(explicit)
    const explicitHost = new URL(h.fetchCalls.at(-1).url).hostname
    assert.equal(h.evaluate(`TRUSTED_CDN_CATALOG_SET.has(${JSON.stringify(explicitHost)})`), true)
    await h.pageWindow.fetch(suspected)
    assert.equal(new URL(h.fetchCalls.at(-1).url).host, 'upos-sz-mirroraliov.bilivideo.com:8443')
    await h.pageWindow.fetch(resource)
    assert.equal(new URL(h.fetchCalls.at(-1).url).hostname, 'node.mcdn.bilivideo.net')
    await h.pageWindow.fetch(live)
    assert.equal(new URL(h.fetchCalls.at(-1).url).pathname, '/live-bvc/1/live.m3u8')
    assert.equal(h.evaluate(`addForcedRedirect('node.edge.mountaintoys.cn')`), false)
})

test('v1.5.3 keeps a sufficient timeout prefix as a partial throughput sample', async () => {
    let streamController
    const h = loadUserscript(target, {
        gmSeed: { disabled: false },
        fetchImpl: async (input, init = {}) => new Response(new ReadableStream({
            start(controller) {
                streamController = controller
                controller.enqueue(new Uint8Array(128 * 1024))
                if (init.signal) init.signal.addEventListener('abort', () => {
                    try { controller.error(new DOMException('timeout', 'AbortError')) } catch {}
                }, { once: true })
            },
        }), { status: 206 }),
    })
    const pending = h.evaluate(`probeCdnThroughput('${aliov}', 'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/a.m4s?sig=x', 768 * 1024)`)
    await settle()
    assert.ok(streamController)
    h.clock.advance(3000)
    h.timers.runTimers(3000)
    const result = await pending
    assert.equal(result.cdn, aliov)
    assert.equal(result.partial, true)
    assert.ok(h.evaluate(`cdnHealth['${aliov}'].samples`) > 0)
    assert.equal(h.evaluate(`knownDeadHosts.has('${aliov}')`), false)
})

test('v1.5.3 rejects partial samples for low bytes, 403, external cancel, and lifecycle abort', async t => {
    await t.test('low bytes at timeout', async () => {
        const h = loadUserscript(target, {
            gmSeed: { disabled: false },
            fetchImpl: async (input, init = {}) => new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(1024))
                    init.signal.addEventListener('abort', () => {
                        try { controller.error(new DOMException('timeout', 'AbortError')) } catch {}
                    }, { once: true })
                },
            }), { status: 206 }),
        })
        const pending = h.evaluate(`probeCdnThroughput('${aliov}', 'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/low.m4s', 768 * 1024)`)
        await settle(); h.clock.advance(3000); h.timers.runTimers(3000)
        assert.equal((await pending).status, 'insufficient')
        assert.equal(h.evaluate(`(cdnHealth['${aliov}'] || {}).samples || 0`), 0)
    })
    await t.test('403 response', async () => {
        const h = loadUserscript(target, { gmSeed: { disabled: false }, fetchImpl: async () => new Response('', { status: 403 }) })
        const result = await h.evaluate(`probeCdnThroughput('${aliov}', 'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/forbidden.m4s', 768 * 1024)`)
        assert.equal(result.forbidden, true)
        assert.equal(h.evaluate(`(cdnHealth['${aliov}'] || {}).samples || 0`), 0)
    })
    await t.test('external cancel after enough bytes', async () => {
        const h = loadUserscript(target, {
            gmSeed: { disabled: false },
            fetchImpl: async (input, init = {}) => new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(128 * 1024))
                    init.signal.addEventListener('abort', () => {
                        try { controller.error(new DOMException('cancel', 'AbortError')) } catch {}
                    }, { once: true })
                },
            }), { status: 206 }),
        })
        h.evaluate('globalThis.v151ExternalAbort = new AbortController()')
        const pending = h.evaluate(`probeCdnThroughput('${aliov}', 'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/cancel.m4s', 768 * 1024, globalThis.v151ExternalAbort.signal)`)
        await settle(); h.evaluate('globalThis.v151ExternalAbort.abort()')
        assert.equal((await pending).status, 'cancelled')
        assert.equal(h.evaluate(`(cdnHealth['${aliov}'] || {}).samples || 0`), 0)
    })
    await t.test('runtime disable abort', async () => {
        const h = loadUserscript(target, {
            gmSeed: { disabled: false },
            fetchImpl: async (input, init = {}) => new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(128 * 1024))
                    init.signal.addEventListener('abort', () => {
                        try { controller.error(new DOMException('disabled', 'AbortError')) } catch {}
                    }, { once: true })
                },
            }), { status: 206 }),
        })
        const pending = h.evaluate(`probeCdnThroughput('${aliov}', 'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/disabled.m4s', 768 * 1024, captureRuntimeGeneration().signal)`)
        await settle(); h.evaluate('disabled = true; stopRuntimeGeneration()')
        assert.equal((await pending).status, 'cancelled')
        assert.equal(h.evaluate(`(cdnHealth['${aliov}'] || {}).samples || 0`), 0)
    })
})

test('v1.5.3 bakeoff fairness reaches candidates behind the first round', async () => {
    let h
    h = loadUserscript(target, {
        gmSeed: { disabled: false },
        fetchImpl: async () => {
            let chunks = 0
            return new Response(new ReadableStream({
            pull(controller) {
                if (h) h.clock.advance(10)
                controller.enqueue(new Uint8Array(64 * 1024))
                chunks++
                if (chunks >= 2) controller.close()
            },
            }), { status: 206 })
        },
    })
    await settle()
    const initialFetches = h.fetchCalls.length
    h.evaluate(`(() => {
        knownDeadHosts.clear()
        Object.keys(catalogOverrides).forEach(k => delete catalogOverrides[k])
        TRUSTED_CDN_CATALOG.forEach(host => { catalogOverrides[host] = true })
        rebuildPreferredCdnList()
        activeCdnList.splice(0, activeCdnList.length, ...PREFERRED_CDN_LIST)
        lastChosenCdn = activeCdnList[0]
    })()`)
    const sample = 'https://upos-sz-mirroraliov.bilivideo.com/upgcxcode/fair.m4s?sig=x'
    await h.evaluate(`doBakeoff(${JSON.stringify(sample)}, captureRuntimeGeneration())`)
    const first = h.fetchCalls.slice(initialFetches).map(call => new URL(call.url).hostname)
    assert.equal(first.length, 4)
    h.clock.advance(90001)
    await h.evaluate(`doBakeoff(${JSON.stringify(sample)}, captureRuntimeGeneration())`)
    const second = h.fetchCalls.slice(initialFetches + first.length).map(call => new URL(call.url).hostname)
    assert.ok(second.some(host => !first.includes(host)), 'a never-sampled rear candidate must enter the next round')
    assert.notDeepEqual(second.slice(0, 2), first.slice(0, 2))
})

test('v1.5.3 exposes one menu and routes all maintenance through the trusted control center', () => {
    const h = loadUserscript(target, { gmSeed: { disabled: true } })
    assert.deepEqual(h.menus.map(item => item.label), ['⚙️ 開啟 BiliCDN 控制中心'])
    h.menus[0].callback()
    for (const name of ['reassess', 'routing', 'diagnostics', 'maintenance']) {
        assert.ok(action(h, name), `missing control-center action ${name}`)
    }
    const writes = h.gmWrites.length
    action(h, 'diagnostics').click()
    assert.equal(h.gmWrites.length, writes)
    trusted(h, action(h, 'diagnostics'))
    assert.ok(action(h, 'text-action'))
})

test('v1.5.3 control-center browsing reaches all former functions without active network', () => {
    const h = loadUserscript(target, { gmSeed: { disabled: true } })
    const before = { fetch: h.fetchCalls.length, preconnect: h.preconnects.length, workers: h.workerInstances.length }
    const open = () => h.menus[0].callback()

    open(); trusted(h, action(h, 'routing'))
    assert.ok(action(h, 'confirm'))
    assert.ok(action(h, 'routing-defaults'))

    open(); trusted(h, action(h, 'diagnostics'))
    assert.ok(action(h, 'copy'))

    open(); trusted(h, action(h, 'maintenance'))
    for (const name of ['clear-soft', 'revive-dead', 'reset-all', 'back']) assert.ok(action(h, name))

    open(); trusted(h, action(h, 'diagnostics'))
    for (const name of ['text-action', 'copy', 'back']) assert.ok(action(h, name))

    open(); trusted(h, action(h, 'reassess'))
    assert.deepEqual({ fetch: h.fetchCalls.length, preconnect: h.preconnects.length, workers: h.workerInstances.length }, before)
})

test('v1.5.3 source removes duplicate player-panel mutators and keeps core budgets unchanged', () => {
    const after = fs.readFileSync(target, 'utf8')
    assert.doesNotMatch(after, /bilicdn-reset-btn|bilicdn-report-btn/)
    const constants = ['PROBE_TIMEOUT_MS', 'THRPT_PROBE_TIMEOUT', 'THRPT_PROBE_BYTES', 'THRPT_BAKEOFF_COOLDOWN', 'UCB_EXPLORE_C']
    const beforeVm = loadUserscript(baseline, {gmSeed: {disabled:true}})
    const afterVm = loadUserscript(target, {gmSeed: {disabled:true}})
    for (const name of constants) assert.equal(afterVm.evaluate(name), beforeVm.evaluate(name), `${name} changed`)
})
