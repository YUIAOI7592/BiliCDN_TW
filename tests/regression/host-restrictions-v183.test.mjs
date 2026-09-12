import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { loadUserscript, FakeXMLHttpRequest } = require('../harness/userscript-vm')
const target = require('../harness/current-script')
import { createHostAccess } from '../../src/policy/host-access.mjs'
const now = 1800000000000
const ali = 'upos-sz-mirrorali.bilivideo.com'
const address = h => `https://${h}/upgcxcode/01/23/video.m4s?token=fixture`
const load = (gmSeed={},extra={}) => loadUserscript(target,{now,gmSeed:{blicdnVersion:'1.8.2',...gmSeed},...extra})
const host = 'upos-sz-mirrorcosov.bilivideo.com'
const url = `https://${host}/upgcxcode/01/23/video.m4s?token=fixture`
const payload = () => ({code:0,data:{dash:{video:[{id:80,height:1080,width:1920,bandwidth:4000000,codecs:'av01.0.08M.08',base_url:url,backup_url:[]}],audio:[]}}})

test('fixed v182 reproduces excluded original page URL being sent unchanged', async () => {
 const h=loadUserscript('Release/v1.8.2/BiliCDN_TW.user.js',{instrument:false,pageGlobals:{__playinfo__:payload()}})
 await h.pageWindow.fetch(url)
 assert.ok(h.fetchCalls.some(c=>String(c.url||c.input).includes(host)))
})

for (const kind of ['black','dead']) {
 test(`v183 ${kind}: original/fixed/unknown request is replaced without clearing the restriction`,async()=>{
  const key=kind==='black'?'cdnBlacklist':'knownDeadHosts_v1'
  const row=kind==='black'?{cdn:ali,expireAt:now+60000}:{host:ali,expireAt:now+60000,reason:'timeout'}
  const h=load({[key]:JSON.stringify([row]),CustomCDN:ali})
  await h.pageWindow.fetch(address(ali)).catch(()=>{})
  assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===ali),false)
  assert.equal(JSON.parse(h.gm.get(key)).some(r=>(r.cdn||r.host)===ali),true)
  assert.equal(h.gm.get('CustomCDN'),ali)
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET',address(ali));x.send()
  assert.notEqual(new URL(x.url).hostname,ali)
  assert.equal(h.evaluate(`getHealthyCdnList().includes('${ali}')`),false)
 })
 test(`v183 ${kind}: a disposition after open is checked again before send`,()=>{
  const h=load();const x=new h.pageWindow.XMLHttpRequest();x.open('GET',address(ali));x.setRequestHeader('Range','bytes=100-199')
  h.evaluate(kind==='black'?`addToBlacklist('${ali}')`:`markHostDead('${ali}','timeout')`)
  x.send();assert.notEqual(new URL(x.url).hostname,ali)
  assert.equal(x.getResponseHeader('Range'),'bytes=100-199')
 })
 test(`v183 ${kind}: existing page affinity and later successful observation never clear disposition`,async()=>{
  const p=payload();p.data.dash.video[0].base_url=address(ali)
  const h=load({}, {pageGlobals:{__playinfo__:p}})
  await (await h.pageWindow.fetch(address(ali))).arrayBuffer()
  h.evaluate(kind==='black'?`addToBlacklist('${ali}')`:`markHostDead('${ali}','timeout')`)
  h.evaluate(`recordCdnSuccess('${ali}',Date.now()+1)`)
  h.fetchCalls.length=0
  await h.pageWindow.fetch(address(ali)).catch(()=>{})
  assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===ali),false)
 })
}

test('v183 all hosts forbidden: Fetch rejects and XHR signals local error once, without native send',async t=>{
 const originalSend=FakeXMLHttpRequest.prototype.send;let sent=0
 FakeXMLHttpRequest.prototype.send=function(...args){sent++;return originalSend.apply(this,args)}
 t.after(()=>{FakeXMLHttpRequest.prototype.send=originalSend})
 const h=load()
 h.evaluate(`TRUSTED_CDN_CATALOG.forEach(h=>addToBlacklist(h))`)
 const before=h.fetchCalls.length
 await assert.rejects(h.pageWindow.fetch(address(ali)),/host restricted/)
 const x=new h.pageWindow.XMLHttpRequest(),events=[]
 x.open('GET',address(ali));for(const type of ['error','load','loadend'])x.addEventListener(type,()=>events.push(type))
 x.send();assert.throws(()=>x.send());h.timers.runTimers(0)
 assert.deepEqual(events,['error','loadend']);assert.equal(x.status,0);assert.equal(x.responseURL,'');assert.equal(sent,0)
 assert.equal(h.fetchCalls.length,before)
 assert.equal(h.evaluate('getBestCdn()'),null)
 assert.ok(JSON.parse(h.gm.get('cdnBlacklist')).length>0)
 x.open('GET','https://api.bilibili.com/test');x.send();x.respond({status:200});assert.equal(x.status,200)
})

for(const kind of ['black','dead']) test(`v183 ${kind}: trusted primary/backup/audio and repeated playinfo stay forbidden`,async()=>{
 const h=load(),p=payload();p.data.dash.video[0].base_url=address(ali)
 p.data.dash.video[0].backup_url=[url]
 p.data.dash.audio=[{id:30280,codecs:'mp4a.40.2',bandwidth:128000,base_url:address(ali).replace('video.m4s','audio.m4s')}]
 h.evaluate(kind==='black'?`addToBlacklist('${ali}')`:`markHostDead('${ali}','timeout')`)
 for(let i=0;i<2;i++){
  const result=h.evaluate(`(()=>{const value=${JSON.stringify(p)};playInfoTransformer(value,{trustedTransport:true});return value})()`)
  assert.equal(JSON.stringify(result).includes(ali),false)
  assert.equal(JSON.stringify(result).includes(host),false)
 }
 h.fetchCalls.length=0
 await h.pageWindow.fetch(p.data.dash.audio[0].base_url).catch(()=>{})
 assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===ali),false)
 h.pageWindow.history.pushState({},'','/video/BVnext?p=2');await h.timers.advanceAsync(0)
 assert.equal(h.evaluate(kind==='black'?`blacklistSet.has('${ali}')`:`knownDeadHosts.has('${ali}')`),true)
})

test('v183 forbidden hosts never receive probe, confirm, bakeoff or preconnect',async()=>{
 const h=load();h.evaluate(`addToBlacklist('${ali}')`);h.fetchCalls.length=0
 const links=h.document.querySelectorAll('link').length
 h.evaluate(`preconnectCdn('${ali}')`)
 assert.equal(h.document.querySelectorAll('link').length,links)
 await h.evaluate(`probeCdnLatency('${ali}')`)
 await h.evaluate(`confirmHostReachable('${ali}')`)
 await h.evaluate(`probeCdnThroughput('${ali}','${address(ali)}',384*1024)`)
 assert.equal(h.fetchCalls.length,0)
})

test('v183 explicit preset enable survives reload but existing all-disabled selection never resets itself',async()=>{
 const preset='upos-sz-mirrorhw.bilivideo.com'
 const h=load({catalogOverrides_v1:{[preset]:true}})
 assert.equal(h.evaluate(`getHealthyCdnList().includes('${preset}')`),true)
 const hosts=h.evaluate('TRUSTED_CDN_CATALOG')
 const off=Object.fromEntries(hosts.map(host=>[host,false]))
 const blocked=load({catalogOverrides_v1:off})
 await assert.rejects(blocked.pageWindow.fetch(address(ali)),/host restricted/)
 assert.deepEqual(blocked.gm.get('catalogOverrides_v1'),off)
})

test('v183 excluded live/resource requests fail locally without rewriting protected paths',async()=>{
 const h=load()
 for(const path of ['/v1/resource/segment.m4s','/live-bvc/segment.m4s']){
  const original=`https://${host}${path}`
  await assert.rejects(h.pageWindow.fetch(original),/host restricted/)
 }
 assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===host),false)
 assert.match(h.evaluate('buildDiagReport()'),/route-blocked/)
})

test('v183 Native isolation also excludes original signed URLs and survives Pool creation',async()=>{
 const native='media.fixture.akamaized.net'
 const seed=JSON.stringify({version:1,video:{[native]:{lastSeen:now,lastFailureAt:now,transportSamples:1,softBlockedUntil:now+60000}},audio:{}})
 const h=load({nativeRouteRatings_v1:seed})
 const p=payload();p.data.dash.video[0].base_url=address(native)
 h.evaluate(`(()=>{const p=${JSON.stringify(p)};playInfoTransformer(p,{trustedTransport:true})})()`)
 h.fetchCalls.length=0
 await h.pageWindow.fetch(address(native)).catch(()=>{})
 assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===native),false)
 assert.equal(JSON.parse(h.gm.get('nativeRouteRatings_v1')).video[native].softBlockedUntil,now+60000)
})

test('v183 native XHR response body remains active when its host becomes forbidden',()=>{
 const h=load(),x=new h.pageWindow.XMLHttpRequest()
 x.open('GET',address(ali));x.send();h.evaluate(`addToBlacklist('${ali}')`)
 x.respond({status:200,responseText:'original player body'})
 assert.equal(x.status,200);assert.equal(x.responseText,'original player body')
 assert.equal(h.evaluate(`blacklistSet.has('${ali}')`),true)
})

test('v183 host-lock cannot restore a blacklisted root when no alternative is legal',async()=>{
 const h=load();h.evaluate(`noteHostLockedStream('${address(ali)}');addToBlacklist('${ali}')`)
 h.fetchCalls.length=0
 await assert.rejects(h.pageWindow.fetch(address(ali)),/host restricted/)
 assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===ali),false)
})

test('v183 preset dead stays forbidden despite success, explicit override cannot bypass black/dead/soft',()=>{
 const black=new Set(),dead=new Set(),initial='upos-sz-mirrorhw.bilivideo.com',overrides={}
 let soft=false,native=false
 const p=createHostAccess({matchesExclude:()=>false,initialDead:[initial],overrides,black,dead,soft:()=>soft,nativeBlocked:()=>native,catalog:new Set([initial])})
 assert.equal(p.allowed(initial),false);overrides[initial]=true;assert.equal(p.allowed(initial),true)
 black.add(initial);dead.add(initial);assert.deepEqual(p.restriction(initial).reasons,['black','dead'])
 black.clear();assert.equal(p.allowed(initial),false);dead.clear();soft=true;assert.equal(p.allowed(initial),false)
 soft=false;native=true;assert.equal(p.allowed(initial),false)
})

test('v183 expired black does not lift overlapping dead; disabled bypasses local blocking',async()=>{
 const h=load({cdnBlacklist:JSON.stringify([{cdn:ali,expireAt:now+500}]),knownDeadHosts_v1:JSON.stringify([{host:ali,expireAt:now+10000,reason:'timeout'}])})
 await h.timers.advanceAsync(1001)
 await h.pageWindow.fetch(address(ali)).catch(()=>{})
 assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===ali),false)
 h.evaluate('disabled=true');await h.pageWindow.fetch(address(ali))
 assert.equal(h.fetchCalls.some(c=>new URL(c.url).hostname===ali),true)
})

test('v183 excluded page URL never reaches the native fetch', async () => {
 const h=loadUserscript(target,{instrument:false,pageGlobals:{__playinfo__:payload()}})
 await h.pageWindow.fetch(url).catch(()=>{})
 assert.equal(h.fetchCalls.some(c=>String(c.url||c.input).includes(host)),false)
})
