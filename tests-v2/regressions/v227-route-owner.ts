import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, media, dash } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'

for (const native of [false,true]) {
  test(`V227 owner: fresh insufficiency re-evaluates an owned plan with Native ${native}`,async t=>{
    const scope=testScope(t), f=fixture(scope), url=media('v227-capacity','video.m4s')
    await f.settings.update({considerNativeSources:native})
    assert.equal(f.adapter.transform(dash(url)).accepted,true)
    const initial=f.routes.apply(url,'video'), original=initial.decision.host!
    const other=f.routes.startupOptions(url)!.candidates.find(c=>c.host!==original)!.host
    for(const [host,mbps] of [[original,5],[other,20]] as const) for(let i=0;i<2;i++) await f.evidence.record(host,'video',{requestId:host+i,at:f.clock.now(),source:'transport',outcome:'success',throughputMbps:mbps,ttfbMs:20,failureKind:null})
    const before=f.session.get(), events:string[]=[]
    scope.defer(f.routes.subscribe(e=>events.push(e.type)))
    assert.equal(f.routes.snapshot().activePlan,null) // No two real video completions have confirmed this representation yet.
    assert.equal(f.session.get(),before)
    assert.deepEqual(events,[])
    const next=f.routes.apply(url,'video')
    assert.equal(next.decision.host,other)
    assert.notEqual(next.decision.id,initial.decision.id)
    assert.equal(f.routes.apply(url,'video').decision,next.decision)
    assert.equal(events.filter(e=>e==='route-planned').length,1)
  })
}
