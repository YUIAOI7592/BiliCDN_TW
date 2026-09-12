import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const F = require('../harness/v153-fixture')
const current = require('../harness/current-script')
const vulnerable = 'tests/fixtures/BiliCDN_TW_1.8.2.pre-security.user.js'
const A = 'https://root.bilivideo.com/upgcxcode/uncompleted.m4s?sig=root'
const B = 'https://backup.akamaized.net/upgcxcode/completed.m4s?sig=backup'
const H = 'https://healthy.bilivideo.com/upgcxcode/normal.m4s?sig=normal'
const item = (primary = A, backup = [B], extra = {}) => ({id:80,height:1080,width:1920,bandwidth:4000000,
 codecs:'av01.0.08M.08',mimeType:'video/mp4',frameRate:30,base_url:primary,backup_url:backup,...extra})
const page = (...items) => ({code:0,data:{dash:{video:items,audio:[]}}})
const probes = h => h.fetchCalls.filter(c => new Headers(c.init?.headers).has('Range'))

test('v182 security fixed-candidate negative control: backup cannot authorize primary path/query for Catalog recovery',async()=>{
 for(const file of [vulnerable,current]){
  let fail=false
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item())},fetchImpl:async()=>new Response(new Uint8Array(131072),{status:fail?500:206})},file)
  F.video(h,1080);await F.consume(h,B);fail=true;await F.consume(h,B);fail=false;await F.consume(h,B)
  const last=new URL(h.fetchCalls.at(-1).url)
  assert.ok(last.hostname.endsWith('.bilivideo.com'),'legitimate Catalog recovery remains possible')
  assert.equal(last.pathname+last.search,new URL(file===vulnerable?A:B).pathname+new URL(file===vulnerable?A:B).search)
 }
})

test('v182 security active page group supplies its completed backup, never uncompleted primary, to startup probe',async()=>{
 for(const file of [vulnerable,current]){
  const a2=A.replace('uncompleted','second-uncompleted'),b2=B.replace('completed','second-completed')
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item(),item(a2,[b2],{height:720}))},fetchImpl:async()=>new Response(new Uint8Array(131072),{status:206})},file)
  const v=F.video(h,1080);await F.consume(h,B);v.videoHeight=720;await F.consume(h,b2);await F.consume(h,b2)
  await h.timers.advanceAsync(5000)
  assert.ok(probes(h).length>0);assert.ok(probes(h).length<=4)
  assert.equal(probes(h).some(c=>new URL(c.url).pathname===new URL(a2).pathname),file===vulnerable)
  if(file===current)assert.ok(probes(h).every(c=>new URL(c.url).pathname===new URL(b2).pathname))
 }
})

test('v182 security ambiguity preserves healthy Fetch and XHR URLs and revokes queued probe authority',async()=>{
 for(const file of [vulnerable,current]){
  const h=F.load({instrument:false,fetchImpl:async()=>new Response(new Uint8Array(131072),{status:206})},file)
  F.video(h,1080);h.pageWindow.__playinfo__=page(item(H,[]));await F.consume(h,H)
  h.pageWindow.__playinfo__=page(item(H,[],{bandwidth:8000000}))
  await F.consume(h,H)
  assert.equal(h.fetchCalls.at(-1).url===H,file===current)
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET',H)
  assert.equal(x.url===H,file===current)
  await h.timers.advanceAsync(5000)
  if(file===current){assert.equal(probes(h).length,0);assert.equal(h.pageWindow.BiliCDN.nativeRouting.selectedRouteType,'root-original')}
 }
})

test('v182 security native XHR completion cannot be relabeled by instance or later prototype overrides',async()=>{
 for(const file of [vulnerable,current])for(const mode of ['instance','prototype']){
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item(B,[]))}},file);F.video(h,1080)
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET',B)
  const nativeProto=Object.getPrototypeOf(h.pageWindow.XMLHttpRequest.prototype)
  nativeProto.open.call(x,'GET','https://www.bilibili.com/unrelated')
  const destination=mode==='instance'?x:h.pageWindow.XMLHttpRequest.prototype
  Object.defineProperty(destination,'responseURL',{configurable:true,get:()=>B})
  destination.getResponseHeader=()=>String(131072)
  x.send();x.respond({status:200,response:new Uint8Array(131072).buffer})
  await h.timers.advanceAsync(1100)
  assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,file===vulnerable?1:0,mode)
  assert.equal(h.gmWrites.some(w=>w.key==='nativeRouteRatings_v1'),file===vulnerable,mode)
 }
})

test('v182 security native status/size/empty final URL cannot be replaced with public fake success',async()=>{
 for(const mode of ['status','size','empty-url']){
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item(B,[]))}});F.video(h,1080)
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET',B);x.send()
  Object.defineProperty(x,'status',{get:()=>206})
  Object.defineProperty(x,'responseURL',{get:()=>B})
  Object.defineProperty(x,'response',{get:()=>new Uint8Array(131072).buffer})
  x.getResponseHeader=()=>String(131072)
  if(mode==='empty-url'){
   x._status=206;x._readyState=4;x._responseURL='';x._response=new Uint8Array(131072).buffer
   x.dispatchEvent(new F.FakeEvent('readystatechange',{isTrusted:true}))
  }else x.respond({status:mode==='status'?403:206,response:mode==='size'?new ArrayBuffer(0):new ArrayBuffer(131072)})
  await h.timers.advanceAsync(1100)
  assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,0,mode)
  assert.equal(h.gmWrites.some(w=>w.key==='nativeRouteRatings_v1'),false,mode)
 }
})

test('v182 security direct native reopen invalidates page context even when final URL later matches',async()=>{
 const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item(B,[]))}});F.video(h,1080)
 const x=new h.pageWindow.XMLHttpRequest();x.open('GET',B);x.send()
 Object.getPrototypeOf(h.pageWindow.XMLHttpRequest.prototype).open.call(x,'GET',B)
 // Model the native OPENED event missing from the old minimal mock open().
 x.dispatchEvent(new F.FakeEvent('readystatechange',{isTrusted:true}))
 x.respond({status:206,response:new ArrayBuffer(131072)})
 await h.timers.advanceAsync(1100)
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,0)
})

test('v182 security legitimate exact XHR bytes and completion still admit the page backup',async()=>{
 const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item())}});F.video(h,1080)
 const x=new h.pageWindow.XMLHttpRequest();x.open('GET',B);x.send();x.progress(65536)
 await h.timers.advanceAsync(20);x.respond({status:206,response:new ArrayBuffer(131072),responseURL:B})
 await h.timers.advanceAsync(1100)
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,1)
 assert.ok(h.gmWrites.some(w=>w.key==='nativeRouteRatings_v1'))
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.selectedRouteType,'root-original')
})

test('v182 security a conflict during Web Lock acquisition cannot authorize probes or a bakeoff timestamp',async()=>{
 let lockCallback
 const h=F.load({instrument:false,locks:{request:(_name,_options,callback)=>{lockCallback=callback;return Promise.resolve()}},
  fetchImpl:async()=>new Response(new Uint8Array(131072),{status:206})})
 F.video(h,1080);h.pageWindow.__playinfo__=page(item(H,[]));await F.consume(h,H)
 await h.timers.advanceAsync(1600);assert.equal(typeof lockCallback,'function')
 h.pageWindow.__playinfo__=page(item(H,[],{bandwidth:8000000}))
 const before=h.gmWrites.length;await lockCallback({})
 assert.equal(probes(h).length,0)
 assert.equal(h.gmWrites.slice(before).some(w=>w.key==='lastBakeoffAt_v1'),false)
})

test('v182 security conflicting hints during an in-flight probe stop remaining candidates',async()=>{
 let h
 h=F.load({instrument:false,fetchImpl:async(_url,init)=>{
  if(new Headers(init?.headers).has('Range'))h.pageWindow.__playinfo__=page(item(H,[],{bandwidth:8000000}))
  return new Response(new Uint8Array(131072),{status:206})
 }})
 F.video(h,1080);h.pageWindow.__playinfo__=page(item(H,[]));await F.consume(h,H)
 await h.timers.advanceAsync(5000)
 assert.equal(probes(h).length,1)
 assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.ambiguousGroups,1)
 await F.consume(h,H);assert.equal(h.fetchCalls.at(-1).url,H)
})

test('v182 native XHR URL normalization preserves exact protocol-relative and default-port admission',async()=>{
 for(const address of [B.replace('https:',''),B.replace('backup.akamaized.net','BACKUP.akamaized.net:443')]){
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item(B,[]))}});F.video(h,1080)
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET',address);x.send()
  x.respond({status:206,response:new ArrayBuffer(131072),responseURL:B})
  await h.timers.advanceAsync(1100)
  assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,1,address)
 }
})

test('v182 native HEAD and empty GET Content-Length do not count as transferred page media',async()=>{
 for(const method of ['HEAD','GET']){
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item(B,[]))}});F.video(h,1080)
  const x=new h.pageWindow.XMLHttpRequest();x.open(method,B);x.send()
  x._headers.set('content-length','131072');x.respond({status:200,response:new ArrayBuffer(0),responseURL:B})
  await h.timers.advanceAsync(5000)
  assert.equal(h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls,0)
  assert.equal(probes(h).length,0)
  assert.equal(h.gmWrites.some(w=>w.key==='nativeRouteRatings_v1'),false)
 }
})

test('v182 silent native reopen and URL-less network errors cannot penalize the old page host',async()=>{
 for(const mode of ['unrelated','empty','genuine-url']){
  const h=F.load({instrument:false,pageGlobals:{__playinfo__:page(item(B,[]))},fetchImpl:async()=>new Response(new ArrayBuffer(131072),{status:206})})
  F.video(h,1080);await F.consume(h,B);await h.timers.advanceAsync(1100)
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET',B)
  if(mode==='unrelated')Object.getPrototypeOf(h.pageWindow.XMLHttpRequest.prototype).open.call(x,'GET','https://www.bilibili.com/unrelated')
  x.send();if(mode==='empty')x._responseURL=''
  x.fail();await h.timers.advanceAsync(1100)
  const ledger=JSON.parse(h.gmWrites.filter(w=>w.key==='nativeRouteRatings_v1').at(-1).value)
  assert.equal(ledger.video[new URL(B).hostname].failures,mode==='genuine-url'?1:0,mode)
 }
})
