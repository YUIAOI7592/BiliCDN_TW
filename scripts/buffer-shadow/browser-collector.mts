/** Invoked on the already verified Runtime via IAB CDP. No product mutation or background task. */
export const installedCollector = String.raw`async function(durationMs, expectedRate) {
  const runtime = this, started = performance.now(), wallStarted = Date.now(), rows = [], initialVideo = document.querySelector('video');
  let timer = null, priorKey = null, owner = 0;
  try {
    for (let i = 0; i <= durationMs / 1000; i++) {
      if (i) await new Promise(resolve => { timer = setTimeout(() => { timer = null; resolve(); }, Math.max(0, started + i * 1000 - performance.now())); });
      const m = runtime.monitor.snapshot(), c = runtime.player.controls(), v = document.querySelector('video');
      const state = runtime.session.get(), r = runtime.routes.latestRequested('video');
      const key = JSON.stringify([state.generation,state.epoch,c.mediaId,c.coreId,c.userRevision,c.seekRevision,c.reloadRevision,m.video.playbackRate,r?.representation,r?.targetHost,r?.routePolicyRevision,r?.authorityRevision]);
      if (key !== priorKey) { owner++; priorKey = key; }
      const trend = m.bufferTrend;
      rows.push({seq:rows.length+1,at:performance.now()-started,wallAt:Date.now(),owner:'owner-'+owner,
        candidate:trend?.candidate ?? null,state:trend?.state ?? 'insufficient',reason:trend?.reason ?? 'missing-trend',
        currentTime:v && Number.isFinite(v.currentTime)?v.currentTime:null,
        frames:v?.getVideoPlaybackQuality?.().totalVideoFrames ?? null,
        qualified:!!v && !v.paused && !v.seeking && !v.ended && !v.error && !runtime.recovery.isRecovering(),
        rate:v?.playbackRate ?? 0,expectedRate,width:v?.videoWidth ?? 0,height:v?.videoHeight ?? 0,
        paused:v?.paused ?? true,seeking:v?.seeking ?? false,ended:v?.ended ?? false,error:!!v?.error,
        sameMedia:!!v && v === initialVideo,
        trend:trend?JSON.parse(JSON.stringify(trend)):null,
        quality:document.querySelector('.bpx-player-ctrl-quality-result')?.textContent?.replace(/\s+/g,' ').trim() ?? '',
        recovery:runtime.recovery.snapshot()});
    }
    return {schemaVersion:1,started:wallStarted,ended:Date.now(),executionMs:performance.now()-started,requestedMs:durationMs,rows,
      report:runtime.diagnostics.buildReport({}),cleanup:{timers:timer===null?0:1,listeners:0,subscriptions:0,breakpoints:0}};
  } finally { if(timer!==null) { clearTimeout(timer); timer=null; } }
}`
