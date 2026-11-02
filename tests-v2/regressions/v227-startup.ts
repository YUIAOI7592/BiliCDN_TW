import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, dash, media } from './functional-races/routing-fixture.ts'
import { testScope } from '../support/scope.ts'
import { MeasurementController } from '../../src-v2/application/measurement-controller.ts'
import { MeasurementMetaStore } from '../../src-v2/state/measurement-meta-store.ts'
import { TRUSTED_CATALOG } from '../../src-v2/domain/catalog.ts'
import { deferred } from '../support/deferred.ts'
import type { RangeProbeResult } from '../../src-v2/application/ports.ts'

async function setup(t:TestContext) {
  const scope=testScope(t), f=fixture(scope), url=media('v227-startup','video.m4s')
  await f.settings.update({startupEarlyReleaseEnabled:false,catalogOverrides:Object.fromEntries(TRUSTED_CATALOG.map(host=>[host,true]))})
  assert.equal(f.adapter.transform(dash(url)).accepted,true)
  return {scope,f,url}
}
async function learn(f:ReturnType<typeof fixture>,host:string,rate:number) {
  for(let i=0;i<2;i++) await f.evidence.record(host,'video',{requestId:host+i,at:f.clock.now(),source:'transport',outcome:'success',throughputMbps:rate,ttfbMs:10,failureKind:null})
}
test('V227 startup: two known adequate hosts leave one slot for legal exploration',async t=>{
  const {f,url}=await setup(t), known=TRUSTED_CATALOG.slice(0,3)
  for(let i=0;i<known.length;i++) await learn(f,known[i]!,30-i)
  const options=f.routes.startupOptions(url)!
  assert.equal(options.candidates.length,3)
  assert.deepEqual(options.candidates.slice(0,2).map(c=>c.host),known.slice(0,2))
  assert.ok(!known.includes(options.candidates[2]!.host as (typeof known)[number]))
})
test('V227 startup: expired circuits get the reserved revalidation slot before untested hosts',async t=>{
  const {f,url}=await setup(t), expired=TRUSTED_CATALOG[5]!
  await f.evidence.record(expired,'video',{requestId:'failure',at:f.clock.now(),source:'transport',outcome:'failure',throughputMbps:null,ttfbMs:null,failureKind:'timeout'})
  f.clock.advance(10*60_000)
  for(const host of TRUSTED_CATALOG.slice(0,3)) await learn(f,host,30)
  const options=f.routes.startupOptions(url)!
  assert.equal(options.candidates[2]!.host,expired)
  assert.equal(options.candidates[2]!.cachedSafeMbps,null)
})
test('V227 startup: a reachability update cannot refresh an old cached speed',async t=>{
  const {f,url}=await setup(t), host=TRUSTED_CATALOG[0]!
  await learn(f,host,30)
  f.clock.advance(300_001)
  await f.evidence.record(host,'video',{requestId:'short',at:f.clock.now(),source:'transport',outcome:'success',throughputMbps:null,ttfbMs:10,failureKind:null})
  const c=f.routes.startupOptions(url)!.candidates.find(c=>c.host===host)!
  assert.ok(c)
  assert.equal(c.cachedSafeMbps,null)
})
for(const reverse of [false,true]) {
  test(`V227 startup: equal completed speeds use candidate order reverse=${reverse}`,async t=>{
    const {f,url,scope}=await setup(t), options=f.routes.startupOptions(url)!
    const waiting=new Map<string,ReturnType<typeof deferred<RangeProbeResult>>>()
    const controller=scope.own(new MeasurementController(f.routes,new MeasurementMetaStore(f.storage,f.clock.now),{read:async input=>{
      assert.ok(input.host)
      const d=deferred<RangeProbeResult>();waiting.set(input.host,d);return await d.promise
    }},f.clock.now,f.clock,undefined,()=>0,f.settings))
    const pending=controller.prepareStartup(url)
    const order=reverse?[...options.candidates].reverse():options.candidates
    for(const candidate of order) {
      waiting.get(candidate.host)!.resolve({bytes:262144,elapsedMs:100,ttfbMs:10,status:206,directRange:true,reason:'measured'})
      await Promise.resolve()
    }
    await pending
    assert.equal(controller.snapshot().startup?.selectedHost,options.candidates[0]!.host)
    assert.equal(waiting.size,3)
  })
}
test('V227 startup: demand includes the single margin and a 1.2 ratio is adequate',async t=>{
  const {f,url,scope}=await setup(t), options=f.routes.startupOptions(url)!, safe=options.demand.requiredMbps*1.2
  let count=0
  const controller=scope.own(new MeasurementController(f.routes,new MeasurementMetaStore(f.storage,f.clock.now),{read:async()=>{
    count++;return {bytes:65536,elapsedMs:65536*8*0.7/(safe*1000),ttfbMs:1,status:206,directRange:true,reason:'measured'}
  }},f.clock.now,f.clock,undefined,()=>0,f.settings))
  await controller.prepareStartup(url)
  assert.equal(controller.snapshot().startup?.result,'adequate')
  assert.equal(count,3)
})
test('V227 startup: capacity preview has no control effects and discards synchronous policy invalidation',async t=>{
  const {f,url,scope}=await setup(t), candidate=f.routes.startupOptions(url)!.candidates[0]!
  await learn(f,candidate.host,30)
  const before=f.session.get(), values=structuredClone([...f.storage.values]), events:string[]=[]
  scope.defer(f.routes.subscribe(event=>events.push(event.type)))
  assert.equal(f.routes.startupCapacity(candidate,null)?.capacityConfidence,'sufficient')
  assert.equal(f.session.get(),before)
  assert.deepEqual([...f.storage.values],values)
  assert.deepEqual(events,[])
  const read=f.evidence.get.bind(f.evidence)
  f.evidence.get=(host,kind)=>{const result=read(host,kind);f.routes.invalidateForUserSetting();return result}
  assert.equal(f.routes.startupCapacity(candidate,null),null)
})
