'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const F = require('../harness/v153-fixture')
const previous = path.join(F.root, 'tests/fixtures/BiliCDN_TW_1.5.3.user.js')
const target = require('../harness/current-script')
const load = options => F.load(options, target)
const verboseMenu = h => {
    h.menus[0].callback()
    if (F.ui(h).querySelector('[data-ui-action="advanced"]')) {
        F.click(h, 'advanced')
        F.click(h, 'verbose-toggle')
    } else {
        F.click(h, 'diagnostics')
        if (F.ui(h).querySelector('[data-ui-action="verbose-toggle"]')) F.click(h, 'verbose-toggle')
        else F.click(h, 'text-action')
    }
}
const starve = async (h, state = 1) => {
    const v = F.video(h); v.paused = false
    await F.prime(h)
    for (let s = 0; s < 8; s++) {
        await F.consume(h, F.mediaUrl('av1')); v.currentTime += 2
        await h.timers.advanceAsync(1000)
    }
    v.setAhead(0); v.readyState = state
    return v
}
test('v154 fixed v153: immutable SHA, verbose export and misleading persistence success', () => {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(previous)).digest('hex'),
        'd175a545a7785a4830c5753eeb20d87429c90d755332071ee1f43bbc457a92f7')
    const h = F.load({ gmSeed: { disabled: true } }, previous)
    h.context.GM_setValue = () => { throw Error('fixture storage failure') }
    verboseMenu(h)
    assert.equal(h.evaluate('Config.verbose'), true)
    assert.ok(h.logs.some(e => e.args.some(x => String(x).includes('已持久化'))))
    assert.equal(h.evaluate('buildDiagReport().includes("Verbose")'), false)
    assert.equal(h.evaluate('buildDiagReport().includes("readyState")'), false)
})
test('v154 fixed v153: actual transport and timed tick show readyState 1 blind spot', async () => {
    for (const state of [1, 2]) {
        const h = F.load({}, previous); await starve(h, state)
        await h.timers.advanceAsync(3000)
        assert.equal(h.evaluate('Watchdog.stats().switchCount') > 0, state === 2)
    }
})
test('v154 menu: session-only verbose is honest; report carries state and critical history', () => {
    const h = load({ gmSeed: { disabled: true } })
    h.context.GM_setValue = () => { throw Error('https://secret.invalid/?cookie=PRIVATE') }
    verboseMenu(h)
    assert.equal(h.evaluate('Config.verbose'), true)
    const report = h.evaluate('buildDiagReport()')
    assert.match(report, /Verbose/); assert.match(report, /未確認儲存/)
    assert.match(report, /播放器現況/); assert.match(report, /settings-write/)
    assert.doesNotMatch(report, /PRIVATE|secret.invalid/)
})
test('v154 starvation: readyState 1/2/3/4 repair without blaming audio', async () => {
    for (const state of [1, 2, 3, 4]) {
        const h = load(); await starve(h, state)
        await F.consume(h, F.mediaUrl('audio', F.other))
        await h.timers.advanceAsync(3000)
        assert.ok(h.evaluate('Watchdog.stats().switchCount') > 0, `readyState=${state}`)
        assert.ok(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`) > 0)
        assert.equal(h.evaluate(`cdnHealth['${F.other}']?.failures || 0`), 0)
        if (state === 1) assert.match(h.evaluate('buildDiagReport()'), /low-data/)
    }
})
test('v196 recorder: bounded failure/context rings, dropped-field evidence, privacy and reload reset', async () => {
    const h = load({ gmSeed: { disabled: true, verbose: true } })
    h.evaluate(`for(let i=0;i<400;i++) { DiagnosticLog.record('measurement',{host:'https://evil.invalid/private?token=SECRET',reason:'accepted',privateField:'PRIVATE'}); DiagnosticLog.record('exception',{stage:'snapshot',privateField:'PRIVATE'},true) }`)
    let s = F.json(h, 'DiagnosticLog.snapshot()')
    assert.ok(s.detail.length > 0 && s.detail.length <= 256)
    assert.ok(s.critical.length > 0 && s.critical.length <= 256)
    assert.ok(s.droppedFields > 0); assert.doesNotMatch(JSON.stringify(s), /SECRET|PRIVATE|evil.invalid|token=/)
    assert.ok([...s.detail, ...s.critical].every(e => Buffer.byteLength(JSON.stringify(e)) <= 2048))
    h.evaluate(`DiagnosticLog.record('watchdog',{reason:'paused'}); DiagnosticLog.record('watchdog',{reason:'paused'})`)
    assert.equal(F.json(h, 'DiagnosticLog.snapshot()').detail.at(-1).count, 2)
    h.evaluate(`Config.verbose=false; DiagnosticLog.record('measurement',{reason:'accepted'}); DiagnosticLog.fault('snapshot')`)
    assert.equal(F.json(h, 'DiagnosticLog.snapshot()').critical.at(-1).code, 'exception')
    h.clock.advance(15 * 60 * 1000 + 1)
    s = F.json(h, 'DiagnosticLog.snapshot()'); assert.equal(s.critical.length, 0); assert.equal(s.detail.length, 0)
    assert.ok(s.expired > 0)
    const fresh = load({ gmSeed: { disabled: true } })
    assert.equal(F.json(fresh, 'DiagnosticLog.snapshot()').evicted, 0)
})
test('v154 recorder: actual Fetch headers/body/pending/EOF and epoch detach', async () => {
    let headers, body
    const h = load({gmSeed:{verbose:true}, fetchImpl: url => String(url).includes('/x/player/')
        ? Promise.resolve(new Response(JSON.stringify(F.payload())))
        : new Promise(resolve => { headers = () => resolve(new Response(new ReadableStream({start(c){body=c}}))) }) })
    await F.prime(h)
    const p = h.pageWindow.fetch(F.mediaUrl('av1'))
    assert.equal(F.json(h, 'DiagnosticLog.snapshot()').pending[0].phase, 'headers')
    headers(); const r = await p
    assert.equal(F.json(h, 'DiagnosticLog.snapshot()').pending[0].phase, 'body')
    body.enqueue(new Uint8Array(99)); body.close(); await r.arrayBuffer()
    assert.equal(F.json(h, 'DiagnosticLog.snapshot()').pending.length, 0)
    let finished = F.json(h, 'DiagnosticLog.snapshot()')
    assert.equal(finished.aggregates.at(-1).successCount, 1)
    assert.equal(finished.successSummary.at(-1).successCount, 1)
    assert.equal([...finished.critical, ...finished.detail].some(e => ['request','headers','eof'].includes(e.code)), false)
    const stale = h.pageWindow.fetch(F.mediaUrl('av1')); const complete = headers
    await F.spa(h); const count = F.json(h, 'DiagnosticLog.snapshot()').detail.length
    complete(); const old = await stale; body.close(); await old.arrayBuffer()
    assert.equal(F.json(h, 'DiagnosticLog.snapshot()').detail.length, count)
})
test('v154 settings: initial read failure and failed verification remain usable and truthful', () => {
    const h = load({ sourceTransform: s => s.replace("Config.verbose = !!GM_getValue('verbose');", "Config.verbose = (()=>{throw Error('SECRET')})();") })
    assert.equal(h.evaluate('Config.verbose'), false)
    assert.match(h.evaluate('buildDiagReport()'), /settings-read/)
    h.context.GM_setValue = () => {}
    verboseMenu(h)
    assert.equal(h.evaluate('Config.verbose'), true)
    assert.match(h.evaluate('buildDiagReport()'), /settings-verify/)
    const verified = load({gmSeed:{disabled:true}}); verboseMenu(verified)
    assert.equal(F.json(verified,'DiagnosticLog.snapshot()').persisted, true)
})
test('v154 diagnostics: console failure, poisoned event data and oversized output cannot escape or leak', async () => {
    const h = load({gmSeed:{verbose:true}}); F.video(h)
    h.context.console.log = () => { throw Error('console SECRET') }
    h.context.console.error = h.context.console.log
    h.evaluate(`DiagnosticLog.record('measurement', {get host(){throw Error('getter SECRET')}})`)
    await F.prime(h); await F.consume(h,F.mediaUrl('av1'))
    h.menus[0].callback(); F.click(h,'diagnostics')
    h.evaluate(`for(let i=0;i<400;i++){DiagnosticLog.record('measurement',{bytes:999999999,host:'${F.ali}',reason:'complete',privateField:'SECRET'});DiagnosticLog.record('exception',{stage:'fetch-body'},true)}`)
    const report=h.evaluate('buildDiagReport()')
    assert.ok(Buffer.byteLength(report)<=98304); assert.doesNotMatch(report,/SECRET|sig=fixture|upgcxcode/)
    assert.ok(F.json(h,'DiagnosticLog.snapshot()').failures > 0)
    assert.match(report,/匯出截斷：/)
    const publicState=F.json(h,'buildPublicDiagnosticSnapshot()')
    assert.equal(typeof publicState.diagnostics.critical,'number')
    assert.equal(publicState.diagnostics.pending instanceof Array,false)
    assert.equal(publicState.diagnostics.detail instanceof Array,false)
})
test('v154 transport: HTTP, network and body errors are distinct; abort forwards its original reason', async () => {
    for(const outcome of ['http','network-error','body-error','abort']) {
        let originalReason
        const h=load({fetchImpl:async url=>String(url).includes('/x/player/')?new Response(JSON.stringify(F.payload())):
            String(url).includes('/crossdomain.xml')?new Response('ok'):
            outcome==='http'?new Response('denied',{status:503}):outcome==='network-error'?Promise.reject(Error('https://SECRET')):
            new Response(new ReadableStream({pull(c){if(outcome==='body-error')c.error(Error('https://SECRET'))},cancel(r){originalReason=r}}))})
        await F.prime(h)
        if(outcome==='network-error') await assert.rejects(h.pageWindow.fetch(F.mediaUrl('av1')))
        else {
            const response=await h.pageWindow.fetch(F.mediaUrl('av1'))
            if(outcome==='body-error')await assert.rejects(response.arrayBuffer())
            if(outcome==='abort'){const reason={secret:'PRIVATE'};await response.body.cancel(reason);assert.equal(originalReason,reason)}
        }
        const snapshot=F.json(h,'DiagnosticLog.snapshot()')
        assert.equal(snapshot.pending.length,0)
        if(outcome!=='abort')assert.ok(snapshot.critical.some(e=>e.code==='request-failure'&&e.data.failureKind===outcome))
        else assert.equal(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`),0)
        assert.doesNotMatch(h.evaluate('buildDiagReport()'),/SECRET|PRIVATE/)
    }
})
test('v154 pending cap and forged events cannot overwrite settings or punitive evidence', async () => {
    const h=load({gmSeed:{verbose:true},fetchImpl:async url=>String(url).includes('/x/player/')?new Response(JSON.stringify(F.payload())):new Promise(()=>{})})
    await F.prime(h)
    for(let i=0;i<80;i++)h.pageWindow.fetch(F.mediaUrl('av1'))
    const before=F.json(h,'DiagnosticLog.snapshot()')
    assert.equal(before.pending.length,64);assert.ok(before.pendingEvicted>=16)
    h.context.console.error('fragment error https://evil.invalid/SECRET')
    h.pageWindow.dispatchEvent(new F.FakeEvent('message',{isTrusted:false}))
    h.menus[0].callback();F.click(h,'diagnostics')
    const writes=h.gmWrites.length
    F.ui(h).querySelector('[data-ui-action="incident-mark"]').dispatchEvent(new F.FakeEvent('click',{isTrusted:false}))
    assert.equal(h.gmWrites.length,writes)
    assert.equal(F.json(h,'DiagnosticLog.snapshot()').pending.length,64)
    assert.doesNotMatch(h.evaluate('buildDiagReport()'),/SECRET|evil.invalid/)
})
test('v154 Watchdog: inactive/invalid/metadata-free states never accumulate penalties', async t => {
    for(const [name,change] of [
        ['readyState0',v=>v.readyState=0],['paused',v=>v.paused=true],['seeking',v=>v.seeking=true],
        ['ended',v=>v.ended=true],['error',v=>v.error={code:3}],['invalid',v=>v.currentTime=NaN],
        ['getter',v=>Object.defineProperty(v,'readyState',{get(){throw Error('PRIVATE')}})],
    ]) await t.test(name,async()=>{
        const h=load();const v=await starve(h);change(v)
        await h.timers.advanceAsync(3000)
        assert.equal(h.evaluate('Watchdog.stats().switchCount'),0)
        assert.equal(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`),0)
    })
})
test('v154 Watchdog: readyState 1 buffer growth/progress and grace periods avoid false repair', async t=>{
    for(const mode of ['growth','progress','seek-grace','switch-grace','background-gap'])await t.test(mode,async()=>{
        const h=load();const v=await starve(h)
        if(mode==='seek-grace')h.evaluate('Watchdog.noteSeek()')
        if(mode==='switch-grace')h.evaluate('Watchdog.noteCdnSwitched()')
        if(mode==='background-gap'){h.clock.advance(4000);h.timers.runTimers(1000)}
        else for(let i=1;i<=2;i++){
            if(mode==='growth')v.setAhead(i)
            if(mode==='progress')v.currentTime+=2
            await h.timers.advanceAsync(1000)
        }
        assert.equal(h.evaluate('Watchdog.stats().switchCount'),0)
    })
})
test('v154 Watchdog: recovery observation is separate from repair attempts and lifecycle interruption', async()=>{
    const h=load();const v=await starve(h)
    await h.timers.advanceAsync(2000)
    v.readyState=4;v.setAhead(70)
    for(let i=0;i<6;i++){v.currentTime+=2;await h.timers.advanceAsync(1000)}
    assert.ok(F.json(h,'DiagnosticLog.snapshot()').critical.some(e=>e.code==='recovery'&&e.data.outcome==='progress'))
    const other=load();await starve(other);await other.timers.advanceAsync(2000);await F.spa(other)
    assert.ok(F.json(other,'DiagnosticLog.snapshot()').critical.some(e=>e.data.outcome==='interrupted'))
})
test('v154 healthy 2x trace: verbose off/on does not change requests or Range budgets through 250 seconds',async t=>{
    const traces=[]
    for(const [file,verbose]of [[previous,false],[target,false],[target,true]]){
        const h=F.load({gmSeed:{verbose}},file);const v=F.video(h);v.paused=false;await F.prime(h)
        const trace=[]
        for(let sec=1;sec<=250;sec++){
            v.currentTime+=2
            if(sec%5===0){await F.consume(h,F.mediaUrl('av1'));await F.consume(h,F.mediaUrl('audio',F.other))}
            await h.timers.advanceAsync(1000)
            if([5,90,240,250].includes(sec)) {
                const ranges=h.fetchCalls.map(c=>new Headers(c.init?.headers).get('Range')).filter(Boolean)
                trace.push({sec,requests:h.fetchCalls.length,probes:ranges.length,
                    bytes:ranges.reduce((n,r)=>n+(Number(r.match(/bytes=0-(\d+)/)?.[1]||-1)+1),0)})
            }
        }
        traces.push(trace)
    }
    for(let i=0;i<traces[0].length;i++){
        assert.ok(traces[1][i].requests<=traces[0][i].requests)
        assert.ok(traces[1][i].probes<=traces[0][i].probes)
        assert.ok(traces[1][i].bytes<=traces[0][i].bytes)
    }
    assert.deepEqual(traces[2],traces[1]);t.diagnostic(JSON.stringify(traces))
})
test('v154 XHR: trusted headers/progress/403/error/reopen and synthetic events have correct history',async()=>{
    const h=load({gmSeed:{verbose:true}});await F.prime(h)
    const x=new h.pageWindow.XMLHttpRequest();x.open('GET',F.mediaUrl('av1'));x.send()
    const before=F.json(h,'DiagnosticLog.snapshot()')
    x.dispatchEvent(new F.FakeEvent('error',{isTrusted:false}))
    assert.deepEqual(F.json(h,'DiagnosticLog.snapshot()').pending,before.pending)
    x._readyState=2;x._status=200;x.emitNativeEvent(new F.FakeEvent('readystatechange',{isTrusted:true}))
    x.progress(8000)
    assert.equal(F.json(h,'DiagnosticLog.snapshot()').pending[0].phase,'body')
    x.open('GET',F.mediaUrl('audio',F.other));x.send();x.fail()
    const s=F.json(h,'DiagnosticLog.snapshot()')
    assert.equal(s.pending.length,0);assert.ok(s.aggregates.some(e=>e.abortCount>=1))
    assert.ok(s.critical.some(e=>e.code==='request-failure'&&e.data.failureKind==='network-error'&&e.data.kind==='audio'))
    const locked=load({gmSeed:{verbose:true,CustomCDN:F.other},fetchImpl:async url=>String(url).includes('/x/player/')?
        new Response(JSON.stringify(F.payload())):new Response('no',{status:403})})
    await F.prime(locked);locked.evaluate(`addForcedRedirect('${F.ali}')`)
    await locked.pageWindow.fetch(F.mediaUrl('locked'))
    assert.ok(F.json(locked,'DiagnosticLog.snapshot()').critical.some(e=>e.code==='host-lock'))
    assert.equal(locked.evaluate(`cdnHealth['${F.other}']?.failures || 0`),0)
})
test('v154 no attribution and unchanged cooldown/breaker bound repeated low-data repair',async()=>{
    const h=load();await starve(h)
    h.evaluate('resetMediaDelivery()')
    await h.timers.advanceAsync(90000)
    assert.equal(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`),0)
    const s=F.json(h,'DiagnosticLog.snapshot()')
    assert.ok(s.critical.some(e=>e.data.reason==='no-attribution'))
    assert.ok(s.critical.some(e=>e.code==='breaker'))
    assert.ok(s.critical.some(e=>e.data.outcome==='no-progress'))
    const attempts=s.critical.filter(e=>e.data.outcome==='attempt')
    for(let i=1;i<attempts.length;i++)assert.ok(attempts[i].firstAt-attempts[i-1].firstAt>=5000)
})

test('v154 actual XHR abort method closes pending once without punishment or affecting reuse',async()=>{
    const h=load({gmSeed:{verbose:true}});await F.prime(h)
    const x=new h.pageWindow.XMLHttpRequest();x.open('GET',F.mediaUrl('av1'));x.send()
    x.progress(4000)
    assert.equal(F.json(h,'DiagnosticLog.snapshot()').pending.length,1)
    x.abort();x.abort()
    let s=F.json(h,'DiagnosticLog.snapshot()')
    assert.equal(s.pending.length,0)
    assert.equal(s.aggregates.reduce((n,e)=>n+e.abortCount,0),1)
    assert.equal(h.evaluate(`cdnHealth['${F.ali}']?.failures || 0`),0)
    x.open('GET',F.mediaUrl('audio',F.other));x.send()
    assert.equal(F.json(h,'DiagnosticLog.snapshot()').pending.length,1)
    x.abort()
    s=F.json(h,'DiagnosticLog.snapshot()')
    assert.equal(s.pending.length,0)
    assert.equal(s.aggregates.reduce((n,e)=>n+e.abortCount,0),2)
})
