import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createNativeRoutes } from '../../src/routing/native-routes.mjs'
const require = createRequire(import.meta.url)
const { loadUserscript } = require('../harness/userscript-vm')
const target = require('../harness/current-script')
const F = require('../harness/v153-fixture')
const C = 'upos-sz-mirrorali.bilivideo.com'
const A = 'upos-hz-mirrorakam.akamaized.net'
const url = host => `https://${host}/upgcxcode/01/23/video.m4s?token=private`
const payload = () => ({code:0,data:{dash:{video:[{id:80,height:1080,width:1920,bandwidth:4000000,codecs:'av01.0.08M.08',mimeType:'video/mp4',frameRate:'30',base_url:url(C),backup_url:[url(A)]}],audio:[]}}})

test('v181 reproduction: page compatibility promotes Akamai with no Native pool', () => {
 const p=payload(); const h=loadUserscript('Release/v1.8.1/BiliCDN_TW.user.js',{instrument:false,pageGlobals:{__playinfo__:p}})
 assert.equal(new URL(p.data.dash.video[0].base_url).hostname,A)
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.activeRepresentation,null)
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.selectedRouteType,'catalog-generated')
})

function routesHarness() {
 let epoch=1, fixed=null, saved=null, schedules=0
 const deps={gmGet:()=>null,gmSet:(_k,v)=>{saved=v},gmDelete(){},TRUSTED_CDN_CATALOG_SET:new Set([C]),
 parseMediaHttpUrl:v=>new URL(v,'https://www.bilibili.com/'),classifyMediaDelivery:()=>({kind:'native'}),
 mediaUrlPolicy:{decide:()=>({action:'rewrite'}),isMediaPath:p=>p.startsWith('/upgcxcode/')},
 normalizeCodecName:i=>i.codecs?.startsWith('av01')?'av1':'hevc',get playinfoEpoch(){return epoch},
 get resolvedCdn(){return fixed},disabled:false,peekCurrentCdn:()=>C,getRequiredStreamMbps:()=>4,
 getCdnHealthScore:()=>0.3,scoreRouteHealth:r=>Math.min(1,(r?.ewmaMbps||0)/8),
 replaceUrlHost:(v,h)=>{const u=new URL(v);u.hostname=h;return u.href},
 playbackRateState:{effectiveRate:2},getVideo:()=>({videoHeight:1080}),
 scheduleObservedSample:()=>schedules++,DiagnosticLog:{fault(){}},onActiveRepresentation(){},cdnHealth:{}}
 const routes=createNativeRoutes(deps)
 return {routes,deps,setEpoch:n=>epoch=n,setFixed:v=>fixed=v,get schedules(){return schedules},get saved(){return saved}}
}
function pageGroup(h, address=url(A), changes={}) {
 const item={...payload().data.dash.video[0],base_url:address,backup_url:[],...changes}
 const id=h.routes.registerSignedRouteGroup(item,true,'video','page-hint')
 return {id,item,context:{route:h.routes.captureRouteContext(address),method:'xhr',httpMethod:'GET'}}
}
test('v182 only the completed exact page URL unlocks, never sibling signatures or GM-seeded ratings',()=>{
 const h=routesHarness(); const {id,context}=pageGroup(h,url(A),{backup_url:[url('alt.akamaized.net')]})
 h.routes.recordNativeThroughput(context,url(A)+'&changed=1',131072,100,2)
 assert.equal(h.routes.diagnostics().admission.unlockedUrls,0)
 h.routes.recordNativeThroughput(context,url(A),131072,100,2)
 assert.equal(h.routes.groups.get(id).unlocked.size,1)
 assert.equal(h.routes.groups.get(id).unlocked.has(url('alt.akamaized.net')),false)
 assert.equal(h.routes.getNativeProbeCandidate(url(A)),null) // completed URL is fresh; sibling remains locked
 h.routes.flushLedger(); assert.doesNotMatch(h.saved,/private|upgcxcode|token=/)
})
test('v182 Catalog not listed in Akamai-only playinfo still wins a legal recovery boundary',()=>{
 const h=routesHarness();const {context}=pageGroup(h)
 h.routes.recordNativeThroughput(context,url(A),131072,10000,2)
 assert.equal(h.routes.resolveRequestRoute(url(A),context).url,url(A))
 h.routes.beginRouteRecovery('verified-native-failure',A)
 const next=h.routes.resolveRequestRoute(url(A),context)
 assert.equal(next.host,C);assert.equal(next.url,url(C))
})
test('v182 a healthy high-rated Catalog cannot change an observed page Native route',()=>{
 const h=routesHarness();const {context}=pageGroup(h)
 h.routes.recordNativeThroughput(context,url(A),131072,100,2)
 h.deps.getCdnHealthScore=()=>10
 assert.equal(h.routes.resolveRequestRoute(url(A),context).url,url(A))
 assert.equal(h.routes.diagnostics().currentRouteType,'root-original')
})
test('v182 page-only unknown third-party success cannot unlock or persist',()=>{
 const h=routesHarness();const address=url('video.example.test');const {context}=pageGroup(h,address)
 assert.equal(h.routes.recordNativeThroughput(context,address,131072,100,2).status,'unverified')
 assert.equal(h.routes.diagnostics().admission.unlockedUrls,0)
 assert.equal(h.routes.ledgers.video.size,0);assert.equal(h.schedules,0)
})
test('v182 repeated or contradictory page setters cannot replace a captured candidate',()=>{
 const h=routesHarness();const {item,context}=pageGroup(h)
 h.routes.registerSignedRouteGroup(item,true,'video','page-hint')
 assert.equal(h.routes.groups.size,1)
 h.routes.registerSignedRouteGroup({...item,bandwidth:8000000},true,'video','page-hint')
 assert.equal(h.routes.recordNativeThroughput(context,url(A),131072,100,2).status,'stale')
 assert.equal(h.routes.diagnostics().admission.ambiguousGroups,1)
})
test('v182 a stale group cannot unlock after reset even if epoch value is reused',()=>{
 const h=routesHarness();const {context}=pageGroup(h)
 h.routes.resetPool();pageGroup(h)
 assert.equal(h.routes.recordNativeThroughput(context,url(A),131072,100,2).status,'stale')
 assert.equal(h.routes.diagnostics().admission.unlockedUrls,0)
})
test('v182 source upgrade preserves affinity and the single startup schedule',()=>{
 const h=routesHarness();const {context}=pageGroup(h)
 h.routes.recordNativeThroughput(context,url(A),131072,100,2)
 assert.equal(h.schedules,1)
 h.routes.retainAffinityForTrustedPlayinfo();h.setEpoch(2);h.routes.resetPool()
 const item={...payload().data.dash.video[0],base_url:url(A),backup_url:[]}
 const id=h.routes.registerSignedRouteGroup(item,true,'video')
 h.routes.applySignedRoutePlan(item,true,id);h.routes.scheduleStartupSample(url(A))
 assert.equal(item.base_url,url(A));assert.equal(h.schedules,1)
})
test('v182 repeated completion never counts twice and never reschedules startup',()=>{
 const h=routesHarness();const {context}=pageGroup(h)
 h.routes.recordNativeThroughput(context,url(A),131072,100,2)
 assert.equal(h.routes.recordNativeThroughput(context,url(A),131072,100,2).status,'duplicate')
 assert.equal(h.routes.ledgers.video.get(A).transportSamples,1);assert.equal(h.schedules,1)
})
test('v182 no page input or historical score alone is a route observation',()=>{
 const h=routesHarness();assert.equal(h.routes.diagnostics().currentRouteType,'unknown')
 pageGroup(h);assert.equal(h.routes.diagnostics().currentRouteType,'unknown')
 assert.equal(h.routes.diagnostics().lastObservedRoute,null)
})

test('v182 Catalog response after page-route recovery is observed without unlocking another URL',()=>{
 const h=routesHarness();const {context}=pageGroup(h)
 h.routes.recordNativeThroughput(context,url(A),131072,100,2)
 h.routes.beginRouteRecovery('verified-native-failure',A)
 const next={route:h.routes.captureRouteContext(url(A)),method:'fetch',httpMethod:'GET',routeDecision:{changed:true,type:'catalog-generated',host:C}}
 assert.equal(h.routes.recordNativeThroughput(next,url(C),131072,100,2).status,'catalog-observed')
 const d=h.routes.diagnostics();assert.equal(d.routeAffinity.host,C)
 assert.equal(d.routeAffinity.type,'catalog-generated');assert.equal(d.observedHostChanges,1)
 assert.equal(d.admission.unlockedUrls,1);assert.equal(h.routes.ledgers.video.has(C),false)
})

test('v182 Catalog URL provenance is based on an emitted replacement, not catalog membership',()=>{
 for(const original of [A,C]){
  const h=routesHarness();const item={...payload().data.dash.video[0],base_url:url(original),backup_url:[]}
  const id=h.routes.registerSignedRouteGroup(item,true,'video');h.routes.applySignedRoutePlan(item,true,id)
  const ctx={route:h.routes.captureRouteContext(item.base_url),method:'fetch'}
  h.routes.observeTransport(ctx,item.base_url,131072,'fetch')
  assert.equal(h.routes.diagnostics().routeAffinity.type,original===C?'root-original':'catalog-generated')
  assert.equal(h.routes.diagnostics().observedHostChanges,0)
 }
})
test('v182 admission respects shared group and URL bounds',()=>{
 const h=routesHarness()
 for(let i=0;i<150;i++)pageGroup(h,url(A).replace('video.m4s',i+'.m4s'))
 assert.equal(h.routes.groups.size,128)
 assert.equal(h.routes.registerSignedRouteGroup({base_url:url(A)+'x'.repeat(16384)},true,'video','page-hint'),null)
})
test('v182 Fetch cancel and non-success statuses never unlock page candidates',async()=>{
 for(const mode of ['cancel','403','body-error']){
  const p=payload();p.data.dash.video[0].base_url=url(A)
  const h=loadUserscript(target,{pageGlobals:{__playinfo__:p},fetchImpl:async()=>mode==='403'?new Response('blocked',{status:403}):new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(131072));if(mode==='body-error')c.error(new Error('private error'))}}))})
  const r=await h.pageWindow.fetch(url(A));if(mode==='cancel')await r.body.cancel('private reason');else await r.arrayBuffer().catch(()=>{})
  h.evaluate('refreshPublicDiagnosticSnapshot()')
  assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,0,mode)
  assert.equal(h.gmWrites.some(w=>w.key==='nativeRouteRatings_v1'),false,mode)
 }
})
test('v182 uninstrumented Akamai-only page starts catalog measurements within the existing four slots',async()=>{
 const p=payload();p.data.dash.video[0].base_url=url(A);p.data.dash.video[0].backup_url=[]
 const h=F.load({instrument:false,pageGlobals:{__playinfo__:p},fetchImpl:async()=>new Response(new Uint8Array(384*1024),{status:206})})
 const v=F.video(h,1080);v.paused=false
 await F.consume(h,url(A));await h.timers.advanceAsync(5000)
 const probes=h.fetchCalls.filter(c=>new Headers(c.init?.headers).has('Range'))
 assert.ok(probes.length>0);assert.ok(probes.length<=4)
 assert.ok(probes.some(c=>new URL(c.url).hostname.endsWith('.bilivideo.com')))
 assert.ok(probes.filter(c=>new URL(c.url).hostname===A).length<=1)
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,1)
 assert.equal(h.pageWindow.BiliCDN.mediaDelivery.video.metadataSource,'page-hint')
 assert.equal(h.pageWindow.BiliCDN.streamEstimate.metadataSource,'page-hint')
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.selectedRouteType,'root-original')
})
test('v182 uninstrumented XHR requires native completion and cannot promote a redirected or forged response',async()=>{
 for(const mode of ['success','redirect','forged','reopen']){
  const p=payload();p.data.dash.video[0].base_url=url(A)
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:p}});F.video(h,1080)
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET',url(A));x.send()
  if(mode==='forged') {Object.defineProperty(x,'status',{value:206});Object.defineProperty(x,'readyState',{value:4});x.dispatchEvent(new F.FakeEvent('readystatechange'))}
  else {if(mode==='reopen')x.open('GET',url(A)+'&next=1');x.respond({status:206,response:new Uint8Array(131072).buffer,responseURL:mode==='redirect'?url('alt.akamaized.net'):mode==='reopen'?url(A)+'&next=1':url(A)})}
  await h.timers.advanceAsync(1000)
  assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,mode==='success'?1:0,mode)
 }
})
test('v182 uninstrumented 250-second auto-quality/seek trace preserves actual Native hosts and measurement budget',async t=>{
 for(const scenario of ['healthy','seek','failure']){
  const traces=[]
  for(const file of ['Release/v1.8.1/BiliCDN_TW.user.js',target]){
   const p=payload();p.data.dash.video[0].base_url=url(A);p.data.dash.video[0].backup_url=[];p.data.dash.video.push({...p.data.dash.video[0],height:720,base_url:url(A).replace('video.m4s','720.m4s')})
   const h=F.load({instrument:false,pageGlobals:{__playinfo__:p},fetchImpl:async()=>new Response(new Uint8Array(131072),{status:206})},file)
   const v=F.video(h,1080);v.paused=false;const hosts=[]
   for(let sec=1;sec<=250;sec++){
    v.currentTime+=2
    if(sec===120)v.videoHeight=720
    if(scenario==='seek'&&sec===45){v.seeking=true;v.dispatchEvent(new F.FakeEvent('seeking',{isTrusted:true}));v.currentTime+=40}
    if(scenario==='seek'&&sec===46){v.seeking=false;v.dispatchEvent(new F.FakeEvent('seeked',{isTrusted:true}))}
    if(scenario==='failure'&&sec===70){const x=new h.pageWindow.XMLHttpRequest();x.open('GET',url(A));x.send();x.respond({status:503,responseURL:url(A)})}
    if(sec%5===0){const address=sec<120?url(A):url(A).replace('video.m4s','720.m4s');await F.consume(h,address);hosts.push(new URL(h.fetchCalls.at(-1).url).hostname)}
    await h.timers.advanceAsync(1000)
   }
   const probes=h.fetchCalls.filter(c=>new Headers(c.init?.headers).has('Range'))
   traces.push({hosts,probes:probes.length,players:h.fetchCalls.length-probes.length})
   assert.ok(probes.length<=12)
   assert.ok(probes.every(c=>Number(new Headers(c.init.headers).get('Range').split('-')[1])+1<=768*1024))
  }
  assert.equal(traces[1].players,traces[0].players)
  assert.ok(traces[1].probes>0)
  if(scenario!=='failure')assert.deepEqual(traces[1].hosts,traces[0].hosts)
  t.diagnostic(JSON.stringify({scenario,baselineProbes:traces[0].probes,currentProbes:traces[1].probes,players:traces[1].players}))
 }
})
test('v182 page candidate keeps the original primary and unknown route', () => {
 const p=payload(); const h=loadUserscript(target,{pageGlobals:{__playinfo__:p}})
 assert.equal(p.data.dash.video[0].base_url,url(C))
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.selectedRouteType,'unknown')
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.pageGroups,1)
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,0)
})
test('v182 page candidate progress alone cannot unlock a signed URL', async () => {
 let finish
 const p=payload(); p.data.dash.video[0].base_url=url(A)
 const h=loadUserscript(target,{pageGlobals:{__playinfo__:p},fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(131072));finish=()=>c.close()}}))})
 const res=await h.pageWindow.fetch(url(A)); const reader=res.body.getReader(); await reader.read()
 h.evaluate('refreshPublicDiagnosticSnapshot()')
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,0)
 finish(); await reader.read()
 h.evaluate('refreshPublicDiagnosticSnapshot()')
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,1)
})
