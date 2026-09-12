'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), path=require('node:path');
const F=require('../harness/v153-fixture');
const { loadUserscript }=require('../harness/userscript-vm');
const target=require('../harness/current-script');
const baseline=path.resolve(__dirname,'../fixtures/BiliCDN_TW_1.5.5.user.js');
const load=(options={},file=target)=>F.load({instrument:false,...options},file);
const snapshot=h=>JSON.parse(JSON.stringify(h.pageWindow.BiliCDN));
const open=h=>h.menus[0].callback();
const state=h=>({requests:h.fetchCalls.length,writes:h.gmWrites.length,workers:h.workerInstances.length});

test('v160 uninstrumented release exposes only cached frozen diagnostics, never module controls',async()=>{
 const h=load(),before=state(h);
 for(const name of ['Watchdog','Config','DiagnosticLog','BiliCDNControls','runtimeGeneration','start','settings','__BiliCDNSettings'])assert.equal(h.context[name],undefined,name);
 const first=h.pageWindow.BiliCDN;
 for(let i=0;i<500;i++)assert.equal(h.pageWindow.BiliCDN,first);
 const check=x=>{if(x&&typeof x==='object'){assert.ok(Object.isFrozen(x));for(const v of Object.values(x))check(v)}else assert.notEqual(typeof x,'function')};check(first);
 assert.deepEqual(state(h),before);
 h.context.console.error('load failed https://attacker.example/upgcxcode/a.m4s');
 h.pageWindow.dispatchEvent(new F.FakeEvent('message',{data:{__biliCdnSetTarget:'attacker.example'}}));
 assert.deepEqual(state(h),before);
 assert.equal(h.getMessageChannelCount(),0);assert.equal(h.blobStore.size,0);
});
test('v160 uninstrumented player Fetch uses one reader and returns the identical cancellation reason',async()=>{
 const reason={test:'cancel-reason'},cancelled=[];
 const h=load({fetchImpl:async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(128*1024))},cancel(r){cancelled.push(r)}}),{status:206})});
 const response=await h.pageWindow.fetch(F.mediaUrl('v160-cancel'));
 const reader=response.body.getReader();await reader.read();await reader.cancel(reason);
 assert.deepEqual(cancelled,[reason]);
});
test('v160 uninstrumented Fetch host-lock restores original signed PCDN URL; live/resource stay original',async()=>{
 const h=load({fetchImpl:async()=>new Response('',{status:403})});
 const original='https://n.mountaintoys.cn/upgcxcode/v160.m4s?sig=fixture';
 await h.pageWindow.fetch(original);await h.pageWindow.fetch(original);
 const requests=h.fetchCalls.filter(c=>c.url.includes('v160.m4s'));
 assert.notEqual(new URL(requests[0].url).hostname,'n.mountaintoys.cn');assert.equal(requests[1].url,original);
 for(const p of ['/v1/resource/v160.m4s','/live-bvc/v160.m4s']){
  const url='https://n.mountaintoys.cn'+p;await h.pageWindow.fetch(url);assert.equal(h.fetchCalls.at(-1).url,url);
 }
});
test('v160 uninstrumented XHR text/json and repeated open retain independent original objects',()=>{
 const h=load();
 for(const kind of ['text','json']){
  const x=new h.pageWindow.XMLHttpRequest();x.responseType=kind==='json'?'json':'';
  const raw=F.payload(),copy=JSON.stringify(raw);x.open('GET',F.playurl);x.respond({status:200,response:raw,responseText:copy});
  const a=kind==='json'?x.response:JSON.parse(x.responseText);assert.ok(a.data.dash.video[0]);
  assert.equal(JSON.stringify(raw),copy);
  x.open('GET',F.playurl);x.respond({status:200,response:null,responseText:'null'});
  assert.equal(kind==='json'?x.response:JSON.parse(x.responseText),null);
 }
});
test('v160 uninstrumented menus retain closed shadow, reject forged clicks and expire SPA views',async()=>{
 const h=load();assert.equal(h.menus.length,1);open(h);
 const host=h.document.getElementById('bilicdn-trusted-menu-ui');assert.equal(host.shadowRoot,null);
 const before=state(h),button=F.ui(h).querySelector('[data-ui-action="reassess"]');
 button.click();button.dispatchEvent(new F.FakeEvent('click',{isTrusted:false}));assert.deepEqual(state(h),before);
 await F.spa(h);const after=state(h);button.dispatchEvent(new F.FakeEvent('click',{isTrusted:true}));assert.deepEqual(state(h),after);
 open(h);F.click(h,'diagnostics');F.click(h,'text-action');assert.equal(h.gm.get('verbose'),true);
});
test('v160 control center keeps one session while navigating every non-destructive child view',()=>{
 const h=load({gmSeed:{disabled:true}}),prior=h.document.createElement('button');
 h.document.body.appendChild(prior);prior.focus();open(h);
 const title=()=>F.ui(h).querySelector('h2')?.textContent;
 const expectMain=()=>{assert.equal(title(),'BiliCDN 控制中心');assert.ok(F.ui(h).querySelector('[data-ui-action="routing"]'))};
 expectMain();F.click(h,'routing');assert.equal(title(),'CDN 選路');F.click(h,'back');expectMain();
 F.click(h,'diagnostics');assert.equal(title(),'BiliCDN 診斷資訊');F.click(h,'back');expectMain();
 F.click(h,'maintenance');assert.equal(title(),'節點維護');F.click(h,'back');expectMain();
 F.ui(h).dispatchEvent(new F.FakeEvent('keydown',{key:'Escape',isTrusted:true}));
 assert.equal(F.ui(h).querySelector('h2'),null);assert.equal(h.document.activeElement,prior);
});
test('v160 control-center actions return to their parent view instead of silently closing',async()=>{
 const h=load({gmSeed:{disabled:true}}),title=()=>F.ui(h).querySelector('h2')?.textContent;
 open(h);F.click(h,'maintenance');F.click(h,'clear-soft');assert.equal(title(),'節點維護');
 F.click(h,'revive-dead');assert.equal(title(),'節點維護');
 F.click(h,'reset-all');assert.equal(title(),'重置所有學習狀態？');F.click(h,'back');assert.equal(title(),'節點維護');
 F.click(h,'back');assert.equal(title(),'BiliCDN 控制中心');
 F.click(h,'diagnostics');F.click(h,'text-action');assert.equal(h.gm.get('verbose'),true);assert.equal(title(),'BiliCDN 診斷資訊');
 F.click(h,'copy');await F.settle();assert.equal(title(),'BiliCDN 診斷資訊');
 F.click(h,'back');assert.equal(title(),'BiliCDN 控制中心');
});
test('v160 post-build HTTPDNS and codec header settings are live runtime settings',async()=>{
 for(const preferredVideoCodec of ['auto','avc','hevc','av1']){
  const h=load({preferredVideoCodec,sourceTransform:s=>s.replace("var BlockHttpDNS = 'auto'",'var BlockHttpDNS = true')});
  assert.equal(snapshot(h).codec.preference,preferredVideoCodec);
  const x=new h.pageWindow.XMLHttpRequest();x.open('GET','https://httpdns.bilivideo.com/resolve');x.send();
  await h.timers.advanceAsync(0);assert.equal(x.status,503);
 }
});
test('v170 leaves site Worker construction completely untouched',()=>{
 class SiteWorker { constructor(url,options){this.url=url;this.options=options;SiteWorker.calls.push([url,options])} }
 SiteWorker.calls=[];
 const h=load({pageGlobals:{Worker:SiteWorker}}),before={blob:h.blobStore.size,channel:h.getMessageChannelCount(),writes:h.gmWrites.length};
 assert.equal(h.pageWindow.Worker,SiteWorker);
 for(const [url,options]of [['https://www.bilibili.com/site.js',undefined],['blob:https://www.bilibili.com/site',undefined],['data:text/javascript,0',undefined],['https://www.bilibili.com/site.mjs',{type:'module'}]])new h.pageWindow.Worker(url,options);
 assert.deepEqual(SiteWorker.calls.map(x=>x[0]),['https://www.bilibili.com/site.js','blob:https://www.bilibili.com/site','data:text/javascript,0','https://www.bilibili.com/site.mjs']);
 assert.deepEqual({blob:h.blobStore.size,channel:h.getMessageChannelCount(),writes:h.gmWrites.length},before);
 assert.equal('worker' in snapshot(h),false);
});
test('v160 uninstrumented 250s traces match v155: healthy, seek and real failure with verbose off/on',async t=>{
 for(const scenario of ['healthy','seek','failure'])await t.test(scenario,async()=>{
  const traces=[];
  for(const [file,verbose]of [[baseline,false],[target,false],[target,true]]){
   const h=load({gmSeed:{verbose}},file),v=F.video(h);v.paused=false;await F.prime(h);const trace=[];
   for(let sec=1;sec<=250;sec++){
    v.currentTime+=2;
    if(scenario==='seek'&&sec===45){v.seeking=true;v.dispatchEvent(new F.FakeEvent('seeking',{isTrusted:true}));v.currentTime+=40;}
    if(scenario==='seek'&&sec===46){v.seeking=false;v.dispatchEvent(new F.FakeEvent('seeked',{isTrusted:true}));}
    if(scenario==='failure'&&sec===45){const x=new h.pageWindow.XMLHttpRequest();x.open('GET',F.mediaUrl('av1'));x.send();x.respond({status:503});}
    if(sec%5===0){await F.consume(h,F.mediaUrl('av1'));await F.consume(h,F.mediaUrl('audio',F.other));}
    await h.timers.advanceAsync(1000);
    if([5,90,240,250].includes(sec)){
     const ranges=h.fetchCalls.map(c=>new Headers(c.init?.headers).get('Range')).filter(Boolean);
     trace.push({sec,requests:h.fetchCalls.length,probes:ranges.length,bytes:ranges.reduce((n,r)=>n+Number(r.match(/bytes=0-(\d+)/)[1])+1,0)});
    }
   }traces.push(trace);
  }
  assert.deepEqual(traces[1],traces[0]);assert.deepEqual(traces[2],traces[0]);t.diagnostic(JSON.stringify({scenario,trace:traces[0]}));
 });
});
