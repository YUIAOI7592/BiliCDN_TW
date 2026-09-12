import test from 'node:test'
import assert from 'node:assert/strict'
import {createXhrFacade} from '../../src/transport/xhr-facade.mjs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url),F=require('../harness/v153-fixture')
const U='https://backup.akamaized.net/upgcxcode/sample.m4s?sig=one'
const page={code:0,data:{dash:{video:[{id:80,height:1080,width:1920,bandwidth:4000000,codecs:'av01.0.08M.08',mimeType:'video/mp4',frameRate:30,base_url:U,backup_url:[]}],audio:[]}}}
const setup=()=>{const h=F.load({instrument:false,pageGlobals:{__playinfo__:page},fetchImpl:async()=>new Response(new ArrayBuffer(131072),{status:206})});F.video(h,1080);return h}
const unlocked=h=>h.pageWindow.BiliCDN.nativeRouting.admission.unlockedUrls

test('method admission: POST/HEAD Fetch complete unchanged without unlock or ledger; GET remains eligible',async()=>{
 for(const method of ['GET','POST','HEAD']){
  const h=setup();const r=await h.pageWindow.fetch(U,{method,...(method==='POST'?{body:'payload'}:{})});await r.arrayBuffer();await h.timers.advanceAsync(1100)
  assert.equal(unlocked(h),method==='GET'?1:0)
  assert.equal(h.gmWrites.some(x=>x.key==='nativeRouteRatings_v1'),method==='GET')
  const calls=h.fetchCalls.filter(c=>c.url===U);assert.equal(calls.length,1)
  if(method==='POST'){assert.equal(calls[0].input.method,'POST');assert.equal(await calls[0].input.text(),'payload')}
 }
})
test('method admission: Request/init precedence and changing method getter are normalized once',async()=>{
 for(const baseMethod of ['GET','POST']){
  const h=setup();let reads=0
  const request=new Request(U,{method:baseMethod})
  const r=await h.pageWindow.fetch(request,{get method(){return ++reads===1?'POST':'GET'},body:'original'})
  await r.arrayBuffer();await h.timers.advanceAsync(1100)
  const call=h.fetchCalls.find(c=>c.url===U)
  assert.equal(reads,1);assert.equal(call.input.method,'POST');assert.equal(await call.input.text(),'original');assert.equal(unlocked(h),0)
 }
})

test('method admission: Request own URL/method shadows cannot attest another native request',async()=>{
 const h=setup(),real=U+'&other=1',request=new Request(real,{method:'POST',body:'body'})
 Object.defineProperties(request,{url:{value:U},method:{value:'GET'}})
 const response=await h.pageWindow.fetch(request);await response.arrayBuffer();await h.timers.advanceAsync(1100)
 assert.equal(unlocked(h),0);const call=h.fetchCalls.find(c=>c.url===real);assert.equal(call.input.method,'POST');assert.equal(await call.input.text(),'body')
})
test('method admission: private XHR rejects native reopen and preserves normal GET, POST stays unqualified',async()=>{
 for(const method of ['GET','POST']){
  const h=setup(),x=new h.pageWindow.XMLHttpRequest();x.open(method,U)
  assert.throws(()=>Object.getPrototypeOf(h.pageWindow.XMLHttpRequest.prototype).open.call(x,'POST',U),TypeError)
  x.send('body');x.respond({status:206,response:new ArrayBuffer(131072),responseURL:U});await h.timers.advanceAsync(1100)
  assert.equal(unlocked(h),method==='GET'?1:0);assert.equal(x.method,method)
 }
})
test('XHR facade events expose only public receiver, support once/removal/handler order and isolate page properties',()=>{
 const h=setup(),x=new h.pageWindow.XMLHttpRequest(),seen=[];let retained
 const old=()=>seen.push('removed');x.addEventListener('load',old);x.removeEventListener('load',old)
 x.onload=function(e){seen.push('handler');assert.equal(this,x);retained=e;assert.equal(e.target,x);assert.equal(e.currentTarget,x);assert.equal(e.composedPath()[0],x);assert.equal(e.valueOf(),e)}
 x.addEventListener('load',()=>seen.push('after'),{once:true});x.onload=function(e){seen.push('changed');retained=e;assert.equal(this,x);assert.equal(e.target,x)}
 Object.defineProperty(x,'trap',{get(){return this}});assert.equal(x.trap,x);assert.equal(x.valueOf(),x)
 x.open('GET',U);x.send();x.respond({status:206,response:new ArrayBuffer(131072)})
 assert.deepEqual(seen,['changed','after']);assert.equal(retained.currentTarget,null)
 x.open('GET',U);x.send();x.respond({status:206,response:new ArrayBuffer(131072)});assert.deepEqual(seen,['changed','after','changed'])
})
test('XHR facade later native prototype edits cannot steal backend through managed super calls',()=>{
 const h=setup(),Ctor=h.pageWindow.XMLHttpRequest,native=Object.getPrototypeOf(Ctor.prototype)
 const original=native.send;let leaked=null
 try {native.send=function(){leaked=this};const x=new Ctor();x.open('GET',U);x.send();assert.equal(leaked,null)}
 finally{native.send=original}
})

test('XHR facade invokes captured native methods without page-mutable apply properties',async()=>{
 const h=setup(),Ctor=h.pageWindow.XMLHttpRequest,native=Object.getPrototypeOf(Ctor.prototype)
 const header=native.setRequestHeader,prior=Object.getOwnPropertyDescriptor(header,'apply');let leaked
 Object.defineProperty(header,'apply',{configurable:true,writable:true,value(receiver,args){leaked=receiver;return Reflect.apply(header,receiver,args)}})
 try{
  const x=new Ctor();x.open('GET',U);x.setRequestHeader('X-Test','one');x.send()
  assert.equal(leaked,undefined)
  x.respond({status:206,response:new ArrayBuffer(131072),responseURL:U});await h.timers.advanceAsync(1100)
  assert.equal(unlocked(h),1)
 }finally{if(prior)Object.defineProperty(header,'apply',prior);else delete header.apply}
})

test('XHR facade isolates late inherited managed-field getters',()=>{
 const h=setup(),Ctor=h.pageWindow.XMLHttpRequest,native=Object.getPrototypeOf(Ctor.prototype);let leaked
 Object.defineProperty(native,'_blockedTimer',{configurable:true,get(){leaked=this}})
 try{const x=new Ctor();x.open('GET',U);x.send();assert.equal(leaked,undefined)}finally{delete native._blockedTimer}
})

test('XHR facade captures event intrinsics and preserves public CustomEvent identity/detail',()=>{
 class Native extends EventTarget {open(){this.dispatchEvent(new Event('readystatechange'))}}
 class Managed extends Native {}
 const Ctor=createXhrFacade(Managed,Native),x=new Ctor(),original=Object.getOwnPropertyDescriptor(Event.prototype,'preventDefault');let leaked
 Object.defineProperty(Event.prototype,'preventDefault',{configurable:true,get(){leaked=this;return original.value}})
 try{x.addEventListener('readystatechange',e=>e.preventDefault());x.open();assert.equal(leaked,undefined)}finally{Object.defineProperty(Event.prototype,'preventDefault',original)}
 const custom=new CustomEvent('custom',{detail:{value:42},cancelable:true});let seen
 x.addEventListener('custom',e=>{seen=e;assert.equal(e.detail.value,42);assert.equal(e.target,x);e.preventDefault()})
 assert.equal(x.dispatchEvent(custom),false);assert.equal(seen,custom);assert.equal(custom.currentTarget,null)
})

test('XHR facade native event accessors cannot leak raw backend events through mutable call properties',()=>{
 class Native extends EventTarget {open(){this.dispatchEvent(new Event('readystatechange',{cancelable:true}))}}
 class Managed extends Native {}
 const typeGetter=Object.getOwnPropertyDescriptor(Event.prototype,'type').get
 const prevent=Event.prototype.preventDefault,invoke=Reflect.apply;let leakedType,leakedPrevent
 typeGetter.call=function(receiver){leakedType=receiver;return invoke(typeGetter,receiver,[])}
 prevent.call=function(receiver){leakedPrevent=receiver;return invoke(prevent,receiver,[])}
 try{
  const Ctor=createXhrFacade(Managed,Native),x=new Ctor()
  x.addEventListener('readystatechange',event=>event.preventDefault());x.open()
  assert.equal(leakedType,undefined);assert.equal(leakedPrevent,undefined)
 }finally{delete typeGetter.call;delete prevent.call}
})
