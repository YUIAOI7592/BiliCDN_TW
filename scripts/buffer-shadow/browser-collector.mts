/** One fully awaited bounded read; ownership and fresh producer time precede attribution. */
export const installedCollector = String.raw`async function(durationMs, expectedRate) {
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 50000 || durationMs % 1000 || ![1,2].includes(expectedRate)) throw Error('invalid-collection-arguments');
  const runtime = this, started = performance.now(), wallStarted = Date.now(), rows = [], initialVideo = document.querySelector('video');
  let timer = null, priorKey = null, owner = 0, priorTrendAt = null;
  const identity = () => {
    const c = runtime.player.controls(), s = runtime.session.get(), r = runtime.routes.latestRequested('video');
    return JSON.stringify([s.generation,s.epoch,c.mediaId,c.coreId,c.userRevision,c.seekRevision,c.reloadRevision,c.coreReloadRevision,r?.representation,r?.targetHost,r?.routePolicyRevision,r?.authorityRevision]);
  };
  const project = t => {
    if (!t || t.schemaVersion!==5 || t.algorithm!=='buffer-window-v5' || !Number.isFinite(t.at) ||
      !['insufficient','ineligible','stable','filling','draining'].includes(t.state) ||
      (t.candidate!==null && typeof t.candidate!=='boolean') ||
      !/^[a-z0-9-]{1,64}$/.test(t.reason) || !t.transport) return null;
    const out={};
    for (const k of ['at','from','spanMs','sampleCount','rate','startBufferSec','endBufferSec','deltaSec','slopeSecPerSec']) {
      const v=t[k]; if (v!==null && (typeof v!=='number' || !Number.isFinite(v))) return null; out[k]=v;
    }
    if (typeof t.interpolated!=='boolean' || !['none','frames','time-only'].includes(t.progressQuality)) return null;
    let cycle=null;
    if(t.cycle!==null){const c=t.cycle;if(!c||!Number.isFinite(c.netLossSec)||c.netLossSec<0||c.netLossSec>2||!['creditMs','lastLossAgeMs','rangeTroughSec'].every(k=>c[k]===null||(Number.isFinite(c[k])&&c[k]>=0))||(c.creditMs!==null&&c.creditMs>2000)||(c.lastLossAgeMs!==null&&c.lastLossAgeMs>8000))return null;cycle={creditMs:c.creditMs,netLossSec:c.netLossSec,lastLossAgeMs:c.lastLossAgeMs,rangeTroughSec:c.rangeTroughSec};}
    let lowBuffer=null;
    if(t.lowBuffer!==null){const l=t.lowBuffer;if(!l||!['steady-decline','partial-cycle'].includes(l.basis)||!Number.isFinite(l.creditMs)||l.creditMs<0||l.creditMs>2000||!Number.isFinite(l.declineCoverageMs)||l.declineCoverageMs<0||l.declineCoverageMs>8000||t.endBufferSec===null||t.endBufferSec>4||['insufficient','ineligible'].includes(t.state)||(l.basis==='steady-decline'?l.declineCoverageMs!==8000:!cycle||cycle.netLossSec<=0||cycle.lastLossAgeMs===null))return null;lowBuffer={basis:l.basis,creditMs:l.creditMs,declineCoverageMs:l.declineCoverageMs};}
    const lowReason=t.reason==='low-buffer-steady'||t.reason==='low-buffer-cycle';
    if(lowReason&&(!lowBuffer||lowBuffer.creditMs!==2000||t.candidate!==true||lowBuffer.basis!==(t.reason==='low-buffer-steady'?'steady-decline':'partial-cycle')))return null;
    if(t.reason==='low-buffer-confirming'&&(!lowBuffer||t.candidate!==false))return null;
    if(t.candidate===true&&!((t.state==='draining'&&t.reason==='draining-low'&&t.deltaSec<=-2&&t.endBufferSec<=10)||(t.reason==='cycle-draining-low'&&cycle?.netLossSec===2&&cycle?.creditMs===2000&&typeof cycle.lastLossAgeMs==='number'&&t.endBufferSec<=10)||lowReason))return null;
    Object.assign(out,{lowBuffer,schemaVersion:5,algorithm:'buffer-window-v5',cycle,interpolated:t.interpolated,progressQuality:t.progressQuality,state:t.state,reason:t.reason,candidate:t.candidate});
    const transport={};
    for (const k of ['successes','failures','aborts','completedBytes','crossWindow','dropped']) {
      const v=t.transport[k];if (!Number.isSafeInteger(v)||v<0) return null;transport[k]=v;
    }
    if (!['none-observed','observed-completions','partial'].includes(t.transport.coverage)) return null;
    transport.coverage=t.transport.coverage;out.transport=transport;return out;
  };
  try {
    for (let i = 0; i <= durationMs / 1000; i++) {
      if (i) await new Promise(resolve => { timer = setTimeout(() => { timer = null; resolve(); }, Math.max(0, started + i * 1000 - performance.now())); });
      const beforeKey=identity(), m=runtime.monitor.snapshot(), v=document.querySelector('video'), trend=project(m.bufferTrend), wallAt=Date.now(), afterKey=identity();
      const key=JSON.stringify([afterKey,v?.playbackRate]);
      const changed=priorKey!==null && key!==priorKey;
      if (key!==priorKey) { owner++; priorKey=key; priorTrendAt=null; }
      const sampleQuality=beforeKey!==afterKey || changed ? 'owner-changed' : !trend ? 'missing-or-invalid-trend' :
        trend.at>wallAt ? 'future-trend' : wallAt-trend.at>1500 || trend.at===priorTrendAt ? 'stale-trend' :
        v?.playbackRate!==expectedRate ? 'rate-mismatch' : 'valid';
      if (trend) priorTrendAt=trend.at;
      const accepted=sampleQuality==='valid';
      rows.push({seq:rows.length+1,at:performance.now()-started,wallAt,owner:'owner-'+owner,sampleQuality,
        candidate:accepted?trend.candidate:null,state:accepted?trend.state:'insufficient',reason:accepted?trend.reason:sampleQuality,
        currentTime:v && Number.isFinite(v.currentTime)?v.currentTime:null,
        frames:v?.getVideoPlaybackQuality?.().totalVideoFrames ?? null,
        qualified:!!v && !v.paused && !v.seeking && !v.ended && !v.error && !runtime.recovery.isRecovering(),
        rate:v?.playbackRate ?? 0,expectedRate,width:v?.videoWidth ?? 0,height:v?.videoHeight ?? 0,
        paused:v?.paused ?? true,seeking:v?.seeking ?? false,ended:v?.ended ?? false,error:!!v?.error,
        sameMedia:!!v && v===initialVideo,trend:accepted?trend:null,
        quality:document.querySelector('.bpx-player-ctrl-quality-result')?.textContent?.replace(/\s+/g,' ').trim() ?? '',
        recovery:runtime.recovery.snapshot()});
    }
    return {schemaVersion:2,started:wallStarted,ended:Date.now(),executionMs:performance.now()-started,requestedMs:durationMs,rows,
      validity:rows.every(r=>r.sampleQuality==='valid' && r.sameMedia)?'valid':'invalid',
      report:runtime.diagnostics.buildReport({}),cleanup:{timers:timer===null?0:1,listeners:0,subscriptions:0,breakpoints:0}};
  } finally { if(timer!==null) { clearTimeout(timer); timer=null; } }
}`
