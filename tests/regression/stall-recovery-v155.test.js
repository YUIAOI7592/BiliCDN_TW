'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const F = require('../harness/v153-fixture')
const previous = path.join(F.root, 'tests/fixtures/BiliCDN_TW_1.5.4.user.js')
const target = require('../harness/current-script')
const load = (options = {}, file = target) => F.load({gmSeed:{verbose:true}, ...options}, file)
const ev = (x, type, trusted = true) => x.dispatchEvent(new F.FakeEvent(type, {isTrusted:trusted}))
const request = (h, url = F.mediaUrl('av1')) => {
    const x = new h.pageWindow.XMLHttpRequest(); x.open('GET', url); x.send(); return x
}
const body = (x, bytes = 468443) => { x._status=206; x._readyState=2; ev(x,'readystatechange'); x.progress(bytes) }
const end = (x, type = 'timeout', trusted = true) => {
    x._status=0; x._readyState=4; ev(x,'readystatechange',trusted); ev(x,type,trusted); ev(x,'loadend',trusted)
}
const health = (h, host = F.ali) => F.json(h, `({failures:cdnHealth[${JSON.stringify(host)}]?.failures||0,
    forced:forcedRedirectHosts.has(${JSON.stringify(host)}),dead:knownDeadHosts.has(${JSON.stringify(host)}),
    soft:cdnSoftBlockUntil[${JSON.stringify(host)}]||0})`)
const history = h => F.json(h, 'DiagnosticLog.snapshot()')
const stallSetup = async (file = target) => {
    const h=load({},file), v=F.video(h); v.paused=false; await F.prime(h)
    await F.consume(h,F.mediaUrl('av1'))
    const x=request(h); body(x)
    v.setAhead(0); v.readyState=1
    return {h,v,x}
}
const untilAttempts = async (h, n) => {
    for(let i=0;i<45 && h.evaluate('Watchdog.stats().switchCount')<n;i++) await h.timers.advanceAsync(1000)
    assert.equal(h.evaluate('Watchdog.stats().switchCount'),n)
}

test('v155 fixed v154 SHA and reproduction: XHR timeout is logged but never repaired',async()=>{
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(previous)).digest('hex'),
        'b63533831fe9a5ce29ad7d1ec13ba848a20f3e51e00a8713205f06b1ec783015')
    const h=load({},previous);await F.prime(h);const x=request(h);body(x);end(x)
    assert.equal(health(h).failures,0);assert.equal(health(h).forced,false)
    assert.ok(history(h).critical.some(e=>e.data.reason==='timeout'))
})

test('v155 actual XHR timeout: repair once, preserve partial bytes, never infer DNS',async()=>{
    const h=load();await F.prime(h);const x=request(h);body(x);h.clock.advance(5000);end(x)
    assert.equal(health(h).failures,1);assert.equal(health(h).forced,true);assert.equal(health(h).dead,false)
    const s=history(h), error=s.critical.find(e=>e.code==='network-error')
    assert.equal(error.data.reason,'timeout');assert.equal(error.data.status,206);assert.equal(error.data.bytes,468443)
    assert.equal(s.pending.length,0)
    const bytes=h.evaluate('Watchdog.stats().totalMB'), calls=h.fetchCalls.length
    ev(x,'timeout');ev(x,'error');x.progress(900000);x.respond({status:200})
    assert.equal(health(h).failures,1);assert.equal(h.evaluate('Watchdog.stats().totalMB'),bytes)
    assert.equal(h.fetchCalls.length,calls)
    assert.equal(history(h).critical.filter(e=>e.code==='network-error').length,1)
})

test('v155 timeout keeps captured HTTP 200 metadata while applying the same evidence gate',async()=>{
    const h=load();await F.prime(h);const x=request(h)
    x._status=200;x._readyState=2;ev(x,'readystatechange');x.progress(128*1024)
    h.clock.advance(3000);end(x)
    assert.equal(health(h).failures,1)
    const error=history(h).critical.find(e=>e.code==='network-error')
    assert.equal(error.data.status,200);assert.equal(error.data.reason,'timeout')
})

test('v155 timeout isolation: forged, aborted, seek, old epoch, disabled and SPA cannot punish',async t=>{
    for(const mode of ['forged','abort','seek','epoch','disabled','spa','reenabled']) await t.test(mode,async()=>{
        const h=load();await F.prime(h);const x=request(h);body(x)
        if(mode==='abort')x.abort()
        if(mode==='seek')h.evaluate('Watchdog.noteSeek()')
        if(mode==='epoch')await F.prime(h)
        if(mode==='disabled'||mode==='reenabled')h.evaluate('disabled=true; stopRuntimeGeneration()')
        if(mode==='reenabled')h.evaluate('disabled=false; beginRuntimeGeneration()')
        if(mode==='spa')await F.spa(h)
        const before=health(h),writes=h.gmWrites.length,calls=h.fetchCalls.length
        end(x,'timeout',mode!=='forged')
        assert.deepEqual(health(h),before);assert.equal(h.gmWrites.length,writes);assert.equal(h.fetchCalls.length,calls)
    })
})

test('v155 timeout: independent transfer/time evidence is required before catalog health changes',async t=>{
    for(const name of ['av1','audio','unknown']) await t.test(name,async()=>{
        const h=load();await F.prime(h);const x=request(h,F.mediaUrl(name));body(x,128*1024)
        h.clock.advance(3000)
        const confirms=h.fetchCalls.filter(c=>String(c.url||c.input).includes('crossdomain')).length;end(x)
        assert.equal(health(h).failures,1);assert.equal(health(h).dead,false)
        assert.equal(h.fetchCalls.filter(c=>String(c.url||c.input).includes('crossdomain')).length,confirms)
    })
    await t.test('zero bytes',async()=>{
        const h=load();await F.prime(h);const x=request(h);h.clock.advance(10000)
        const before=health(h),writes=h.gmWrites.length,calls=h.fetchCalls.length;end(x)
        assert.deepEqual(health(h),before);assert.equal(h.gmWrites.length,writes);assert.equal(h.fetchCalls.length,calls)
    })
    await t.test('short caller deadline',async()=>{
        const h=load();await F.prime(h);const x=request(h);body(x,128*1024);h.clock.advance(1)
        const before=health(h),writes=h.gmWrites.length,calls=h.fetchCalls.length;end(x)
        assert.deepEqual(health(h),before);assert.equal(h.gmWrites.length,writes);assert.equal(h.fetchCalls.length,calls)
    })
    await t.test('below transfer floor',async()=>{
        const h=load();await F.prime(h);const x=request(h);body(x,128*1024-1);h.clock.advance(3000)
        const before=health(h);end(x);assert.deepEqual(health(h),before)
    })
    await t.test('late progress still preserves total-deadline recovery',async()=>{
        const h=load();await F.prime(h);const x=request(h);h.clock.advance(9500);body(x,17*1024*1024)
        h.clock.advance(500);end(x);assert.equal(health(h).failures,1);assert.equal(health(h).forced,true)
    })
    const h=load();await F.prime(h);const host='media.example.akamaized.net';const x=request(h,F.mediaUrl('av1',host));body(x);h.clock.advance(3000);end(x)
    assert.equal(h.evaluate(`!!cdnHealth['${host}']`),false)
    assert.equal(h.evaluate(`forcedRedirectHosts.has('${host}')`),false)
})

test('v155 timeout: same-host terminal events are coalesced before every punitive sink',async()=>{
    const h=load();await F.prime(h);const a=request(h),b=request(h);body(a);body(b);h.clock.advance(3000)
    end(a);const first=health(h),calls=h.fetchCalls.length;end(b)
    assert.equal(first.failures,1);assert.equal(health(h).failures,1);assert.equal(health(h).forced,true)
    assert.equal(h.fetchCalls.length,calls)
    assert.ok(history(h).critical.some(e=>e.code==='recovery'&&e.data.kind==='timeout'&&e.data.reason==='cooldown'&&e.data.punished===false))
    // A page-controlled playinfo/epoch refresh must not reset the security throttle.
    await F.prime(h);const c=request(h);body(c);h.clock.advance(3000);end(c)
    assert.equal(health(h).failures,1)
    h.clock.advance(30000);const d=request(h);body(d);h.clock.advance(3000);end(d)
    assert.equal(health(h).failures,2)
})

test('v155 XHR reuse releases previous listeners and only latest request can complete',async()=>{
    const h=load();await F.prime(h);const x=request(h)
    const oldTimeout=x._listeners.get('timeout')[0].listener
    x.open('GET',F.mediaUrl('audio'));x.send()
    assert.equal(x._listeners.get('timeout').length,1)
    oldTimeout(new F.FakeEvent('timeout',{isTrusted:true}))
    assert.equal(health(h).failures,0)
    body(x);h.clock.advance(3000);end(x)
    assert.equal(health(h).failures,1)
    assert.equal(x._listeners.get('timeout').length,0)
    assert.equal(x._listeners.get('progress').length,0)
})

test('v155 repeated send exception preserves the first request cleanup owner',async()=>{
    const h=load();await F.prime(h);const x=request(h)
    assert.throws(()=>x.send(),/InvalidStateError/)
    x.open('GET',F.mediaUrl('audio'));x.send()
    assert.equal(x._listeners.get('timeout').length,1)
    body(x);h.clock.advance(3000);end(x)
    assert.equal(health(h).failures,1)
    for(const event of ['timeout','error','abort','progress','readystatechange'])assert.equal(x._listeners.get(event).length,0)
})

test('v155 fixed v154 reproduction: breaker erases newer verified failure soft block',async()=>{
    const {h,x}=await stallSetup(previous);await untilAttempts(h,1)
    h.evaluate('resetMediaDelivery()');await untilAttempts(h,3);end(x,'error')
    assert.ok(health(h).soft>0)
    await h.timers.advanceAsync(8000)
    assert.ok(h.evaluate('Watchdog.stats().breakerSec')>0)
    assert.equal(health(h).soft,0)
})

test('v155 breaker preserves verified failure and its protected soft block',async()=>{
    const {h,x}=await stallSetup();await untilAttempts(h,1)
    h.evaluate('resetMediaDelivery()');await untilAttempts(h,3);end(x)
    const before=health(h);assert.ok(before.soft>0)
    await h.timers.advanceAsync(8000)
    assert.ok(h.evaluate('Watchdog.stats().breakerSec')>0)
    assert.equal(health(h).soft,before.soft);assert.equal(health(h).failures,before.failures)
    assert.equal(health(h).forced,true)
})

test('v155 recovery records resulting state and counts attempts separately from observed route changes',async()=>{
    const {h,v}=await stallSetup();await untilAttempts(h,1)
    assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),0)
    for(let i=0;i<6;i++){v.readyState=4;v.currentTime+=2;v.setAhead(70);await h.timers.advanceAsync(1000)}
    const records=history(h).critical.filter(e=>e.code==='recovery')
    const attempt=records.find(e=>e.data.outcome==='attempt'),result=records.find(e=>e.data.outcome==='progress')
    assert.ok(result);assert.ok(result.data.currentTime>attempt.data.currentTime)
    assert.equal(result.data.bufferAheadSec,70)
    assert.equal(h.evaluate('Watchdog.stats().recoveryAttemptCount'),h.evaluate('Watchdog.stats().switchCount'))
})

test('v155 observed route changes require fresh same-epoch video transport, not audio or rank',async()=>{
    const h=load();F.video(h);await F.prime(h)
    const a=request(h);body(a);assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),0)
    const audio=request(h,F.mediaUrl('audio',F.other));body(audio)
    assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),0)
    const b=request(h,F.mediaUrl('av1',F.other));body(b)
    assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),1)
    b.progress(500000);body(audio);assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),1)
    h.clock.advance(31000);body(a);assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),1)
    await F.prime(h);body(b);assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),1)
    await F.spa(h);assert.equal(h.evaluate('Watchdog.stats().observedSwitchCount'),0)
})

test('v155 timeout runs existing emergency bakeoff once per 30s and even during Watchdog breaker',async()=>{
    const {h}=await stallSetup();h.evaluate('resetMediaDelivery()');await untilAttempts(h,3)
    await h.timers.advanceAsync(8000);assert.ok(h.evaluate('Watchdog.stats().breakerSec')>0)
    // Real open/send entry remains authoritative even when Watchdog has exhausted its inference budget.
    const x=request(h,F.mediaUrl('timeout-under-breaker',F.other)), y=request(h,F.mediaUrl('another',F.other))
    body(x);body(y);h.clock.advance(3000)
    const start=h.fetchCalls.length;end(x);await F.settle()
    const failures=health(h,F.other).failures
    assert.ok(failures>0);assert.equal(health(h,F.other).forced,true)
    const ranges=()=>h.fetchCalls.slice(start).filter(c=>new Headers(c.init?.headers).has('Range'))
    const first=ranges().length;assert.ok(first>0&&first<=4)
    const budgets=ranges().map(c=>Number(new Headers(c.init.headers).get('Range').match(/bytes=0-(\d+)/)[1])+1)
    assert.ok(budgets.every(b=>b<=768*1024))
    end(y);await F.settle();assert.equal(ranges().length,first);assert.equal(health(h,F.other).failures,failures)
    assert.ok(history(h).critical.some(e=>e.code==='recovery'&&e.data.kind==='timeout'&&e.data.reason==='cooldown'))
    assert.equal(x.aborted,undefined);assert.equal(y.aborted,undefined)
})

test('v155 rollback restores only Watchdog-owned deltas, keeping preceding failure state',async()=>{
    const {h}=await stallSetup()
    // A preceding transport failure must survive the later speculative Watchdog penalty.
    const x=request(h);body(x);h.clock.advance(3000);end(x)
    const before=health(h);assert.ok(before.failures>0&&before.soft>0)
    await untilAttempts(h,1);h.evaluate('resetMediaDelivery()');await untilAttempts(h,3)
    await h.timers.advanceAsync(8000)
    assert.equal(health(h).failures,before.failures);assert.equal(health(h).soft,before.soft)
    assert.equal(health(h).forced,true)
})

test('v155 successful DONE, native abort and stale error detach all script listeners once',async()=>{
    for(const outcome of ['success','abort','epoch']){
        const h=load();await F.prime(h);const x=request(h);body(x)
        if(outcome==='success')x.respond({status:206})
        if(outcome==='abort')end(x,'abort')
        if(outcome==='epoch'){await F.prime(h);end(x,'error')}
        for(const event of ['timeout','error','abort','progress','readystatechange'])assert.equal(x._listeners.get(event).length,0)
        const before=health(h);ev(x,'timeout');ev(x,'error');assert.deepEqual(health(h),before)
    }
})

test('v155 healthy dual-CDN 2x trace equals v154 through startup, 90s and four minutes',async t=>{
    const traces=[]
    for(const [file,verbose]of [[previous,false],[target,false],[target,true]]){
        const h=load({gmSeed:{verbose}},file),v=F.video(h);v.paused=false;await F.prime(h)
        const trace=[]
        for(let sec=1;sec<=250;sec++){
            v.currentTime+=2
            if(sec%5===0){await F.consume(h,F.mediaUrl('av1'));await F.consume(h,F.mediaUrl('audio',F.other))}
            await h.timers.advanceAsync(1000)
            if([5,90,240,250].includes(sec)){
                const ranges=h.fetchCalls.map(c=>new Headers(c.init?.headers).get('Range')).filter(Boolean)
                trace.push({sec,requests:h.fetchCalls.length,probes:ranges.length,
                    bytes:ranges.reduce((n,r)=>n+Number(r.match(/bytes=0-(\d+)/)[1])+1,0)})
            }
        }
        traces.push(trace)
    }
    assert.deepEqual(traces[1],traces[0]);assert.deepEqual(traces[2],traces[0]);t.diagnostic(JSON.stringify(traces))
})
