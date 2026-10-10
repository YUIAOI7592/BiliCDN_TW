import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerAdapter } from '../../../src-v2/adapters/player.ts'
import { PlayerMonitor } from '../../../src-v2/application/player-monitor.ts'
import { RecoveryController } from '../../../src-v2/application/recovery-controller.ts'
import { RuntimeController } from '../../../src-v2/application/runtime-controller.ts'
import { RouteCoordinator } from '../../../src-v2/application/route-coordinator.ts'
import { PlayurlController } from '../../../src-v2/application/playurl-controller.ts'
import { PlayurlAdapter } from '../../../src-v2/adapters/playurl.ts'
import { TransportContext } from '../../../src-v2/adapters/transport-context.ts'
import { SessionStore } from '../../../src-v2/state/session-store.ts'
import { SignedRouteVault } from '../../../src-v2/state/signed-route-vault.ts'
import { SettingsStore } from '../../../src-v2/state/settings-store.ts'
import { RestrictionStore } from '../../../src-v2/state/restriction-store.ts'
import { EvidenceStore } from '../../../src-v2/state/evidence-store.ts'
import { createRuntimeIds } from '../../../src-v2/platform/runtime-ids.ts'
import { FakeClock } from '../../support/clock.ts'
import { FakeStorage } from '../../support/storage.ts'
import { testScope } from '../../support/scope.ts'
import { monitorMeasurement } from '../../support/controllers.ts'
import { deferred } from '../../support/deferred.ts'

// An SDK boundary model, informed by real Chrome's own reload -> paused/null
// core -> replacement. Production Adapter/sampler/Monitor/Recovery/Runtime/
// Coordinator are used; DOM and SDK states remain a private deterministic model.
function fixture(t: TestContext) {
  const scope = testScope(t), clock = scope.own(new FakeClock()), storage = new FakeStorage();
  class Element extends EventTarget {
    parentElement: Element | null = null;
    constructor(readonly classes: readonly string[] = []) { super(); }
    contains(target: unknown): boolean {
      for (let item = target instanceof Element ? target : null; item; item = item.parentElement) if (item === this) return true;
      return false;
    }
    closest(selectors: string): Element | null {
      for (let item: Element | null = this; item; item = item.parentElement)
        if (selectors.split(',').some(value => value.trim().startsWith('.') && item!.classes.includes(value.trim().slice(1)))) return item;
      return null;
    }
  }
  class Media extends Element {
    currentTime = 120; paused = false; seeking = false; ended = false; readyState = 4;
    duration = 3910; videoWidth = 1280; videoHeight = 720; playbackRate = 2; frames = 100;
    isConnected = true; clientWidth = 1280; clientHeight = 720; error: MediaError | null = null;
    buffered: TimeRanges = { length: 0, start() { throw new RangeError('No range'); }, end() { throw new RangeError('No range'); } };
    getVideoPlaybackQuality(): VideoPlaybackQuality { return { creationTime: 0, droppedVideoFrames: 0, corruptedVideoFrames: 0, totalVideoFrames: this.frames }; }
  }
  const region = new Element(['bpx-player-container']), video = new Media(); video.parentElement = region;
  const document = new EventTarget(), window = new EventTarget(), body = new Element();
  class PointerBoundary extends Event {
    readonly pointerId = 1;
    override get isTrusted(): boolean { return true; }
    override get target(): EventTarget { return region; }
  }
  let dispatchingKeyboard = false;
  class KeyboardBoundary extends Event {
    readonly isComposing = false; readonly keyCode = 32; readonly ctrlKey = false; readonly metaKey = false; readonly altKey = false;
    constructor(readonly key: string) { super('keydown'); }
    override get isTrusted(): boolean { return true; }
    override get target(): EventTarget { return body; }
    override get eventPhase(): number { return dispatchingKeyboard ? Event.AT_TARGET : Event.NONE; }
    override composedPath(): EventTarget[] { return [body, document, window]; }
  }
  for (const [name, value] of Object.entries({ document, window, Node: Element, Element, HTMLElement: Element, PointerEvent: PointerBoundary,
    KeyboardEvent: KeyboardBoundary,
    location: new URL('https://www.bilibili.com/video/synthetic') })) scope.defineGlobal(name, { configurable: true, value });
  const source = 'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/01/02/13579/13579-1-30080.m4s?fixture=13579';
  const manifest = { video: [{ id: 80, codecid: 7, height: 720, bandwidth: 4_000_000, base_url: source, backup_url: [] }], audio: [] };
  let onMpdRead = () => {};
  const makeCore = (initialized: boolean) => ({ state: { initialized }, getMpd: () => { onMpdRead(); return manifest; } });
  let core: ReturnType<typeof makeCore> | null = makeCore(true);
  const effects = { reloads: 0, seeks: [] as number[], rates: [] as number[], plays: 0, fallbacks: 0, recoverCalls: 0 };
  let playResult: unknown, onSeek = () => {}, onRate = () => {};
  const site = {
    __core: () => core, getCurrentTime: () => video.currentTime, getPlaybackRate: () => video.playbackRate,
    seek(value: number) { effects.seeks.push(value); video.currentTime = value; video.seeking = true; video.dispatchEvent(new Event('seeking')); onSeek(); },
    setPlaybackRate(value: number) { effects.rates.push(value); video.playbackRate = value; onRate(); },
    play() { effects.plays++; video.paused = false; return playResult; },
    reload() {
      effects.reloads++; core = null; video.paused = true; video.currentTime = 0; video.seeking = false;
      video.readyState = 0; video.videoWidth = 0; video.videoHeight = 0; video.frames = 0;
    },
  };
  scope.defineGlobal('unsafeWindow', { configurable: true, value: { player: site, navigator: { userActivation: { isActive: false } } } });
  const settings = scope.own(new SettingsStore(storage, clock.now)), restrictions = scope.own(new RestrictionStore(storage, clock.now)), evidence = scope.own(new EvidenceStore(storage, clock.now));
  const session = new SessionStore(), vault = new SignedRouteVault(), state = session.beginGeneration(); vault.reset(state.generation, state.epoch);
  const ids = createRuntimeIds(), routes = new RouteCoordinator(clock, session, settings, restrictions, evidence, vault, ids);
  const originalRecover = routes.recover.bind(routes);
  routes.recover = (...args: Parameters<RouteCoordinator['recover']>) => { effects.recoverCalls++; return originalRecover(...args); };
  const content = new PlayurlController(session, vault, routes, settings), playurl = new PlayurlAdapter(content);
  class Player extends PlayerAdapter {
    protected override player() { return site; }
    override video(): HTMLVideoElement { return video as unknown as HTMLVideoElement; }
  }
  let visible = true;
  const player = new Player(playurl, { scheduler: clock, isActuallyVisible: () => visible, subscribeControlLoss: () => () => undefined }); scope.defer(() => player.reset());
  const eligible = () => { const request = routes.latestRequested('video'); return () => !!request && routes.recoveryEligible(request) && routes.latestRequested('video')?.representation === request.representation; };
  const recovery = scope.own(new RecoveryController(player, clock.now, () => visible && !settings.get().disabled && !routes.isOriginalComparison(), eligible));
  const measurement = { ...monitorMeasurement(), reset() {} };
  const monitor = scope.own(new PlayerMonitor(player, session, settings, vault, routes, measurement, recovery, () => visible, clock.now, clock));
  const runtime = scope.own(new RuntimeController(session, settings, routes, player, monitor, measurement, recovery,
    { setEnabled() {} }, { record() {}, recordPlayer() {} }, clock.now, content)); runtime.install();
  scope.defer(routes.subscribe(event => { if (event.type === 'recovery' && event.action.action === 'route-fallback') effects.fallbacks++; }));
  const payload = { code: 0, data: { dash: structuredClone(manifest) } };
  assert.equal(playurl.transform(payload, 'trusted-api', 'owned-pause-api', { contentId: '13579' }).accepted, true);
  const output = payload.data.dash.video[0]!.base_url, applied = routes.apply(output, 'video');
  assert.ok(applied.url && applied.context, 'all private tests require a real authorized current video route');
  const transport = new TransportContext(session, settings, routes, playurl,
    { willGateStartup: () => false, prepareStartup: async () => undefined, noteUnpreflighted() {} }, clock.now, ids);
  routes.requestStarted(transport.request(applied, output, applied.url, clock.now(), 'GET'));
  assert.equal(routes.recoveryEligible(routes.latestRequested('video')!), true);
  monitor.tick(); clock.advance(1000); video.currentTime++; video.frames += 30; monitor.tick();
  // Website seek is deliberately not trusted input; it updates target ownership.
  site.seek(978); effects.seeks.length = 0; video.readyState = 1; monitor.tick();
  const ticks = (count: number) => { for (let index = 0; index < count; index++) { clock.advance(1000); monitor.tick(); } };
  const ready = () => { core = makeCore(true); video.readyState = 3; video.videoWidth = 1280; video.videoHeight = 720; };
  const userPause = () => { document.dispatchEvent(new PointerBoundary('pointerdown')); video.paused = true; };
  const keyboard = (key: string, command: () => void) => {
    // The website command and confirming read occur within the trusted dispatch.
    const listener = () => { command(); player.controls(); };
    document.addEventListener('keydown', listener);
    dispatchingKeyboard = true;
    try { document.dispatchEvent(new KeyboardBoundary(key)); }
    finally { dispatchingKeyboard = false; document.removeEventListener('keydown', listener); }
  };
  const sdkSeek = (position: number) => { site.seek(position); effects.seeks.length = 0; };
  const requestNewRepresentation = () => {
    const nextManifest = structuredClone(manifest); nextManifest.video[0]!.id = 64;
    nextManifest.video[0]!.base_url = source.replace('30080', '30064');
    const nextPayload = { code: 0, data: { dash: nextManifest } };
    assert.equal(playurl.transform(nextPayload, 'trusted-api', 'owned-pause-auto-api', { contentId: '13579' }).accepted, true);
    const nextOutput = nextPayload.data.dash.video[0]!.base_url, nextApplied = routes.apply(nextOutput, 'video');
    assert.ok(nextApplied.url && nextApplied.context);
    routes.requestStarted(transport.request(nextApplied, nextOutput, nextApplied.url, clock.now(), 'GET'));
    assert.equal(routes.recoveryEligible(routes.latestRequested('video')!), true);
  };
  return { clock, player, monitor, recovery, routes, effects, video, ticks, ready, userPause,
    keyboardPause: () => keyboard(' ', () => { video.paused = !video.paused; }),
    keyboardRate: () => keyboard('ArrowUp', () => { video.playbackRate = 1; }),
    keyboardSeek: (position: number) => keyboard('ArrowRight', () => site.seek(position)),
    onMpdRead: (listener: () => void) => { onMpdRead = listener; },
    onSeek: (listener: () => void) => { onSeek = listener; }, onRate: (listener: () => void) => { onRate = listener; },
    playResult: (value: unknown) => { playResult = value; },
    sdkSeek, requestNewRepresentation, policyChanged: () => routes.invalidateForUserSetting(),
    visible: (value: boolean) => { visible = value; },
    lateSdkResume: () => { core = makeCore(true); video.paused = false; video.seeking = false;
      video.readyState = 1; video.videoWidth = 1280; video.videoHeight = 720; video.currentTime = 978; video.frames = 100; },
    externalCore: () => { core = makeCore(true); },
    sample: () => ({ controls: player.controls(), video: player.snapshot(), monitor: monitor.snapshot(), recovery: recovery.snapshot() }) };
}

test('BR-01 followthrough: owned SDK reload transient pause and null core must retain bounded ownership', t => {
  const f = fixture(t); f.ticks(30); assert.equal(f.effects.reloads, 1);
  assert.equal(f.video.paused, true); assert.equal(f.player.controls().reloadRevision, 1);
  f.ticks(1);
  assert.equal(f.recovery.isRecovering(), true, 'pause caused by our accepted reload cannot cancel its own still-bounded restoration');
});

test('BR-01 followthrough: the marked own core must restore current target, speed and play after SDK pause', t => {
  const f = fixture(t); f.ticks(30); f.ticks(1); f.ready(); f.ticks(1);
  const controls = f.player.controls(); assert.equal(controls.coreReloadRevision, controls.reloadRevision);
  assert.deepEqual(f.effects.seeks, [978]); assert.deepEqual(f.effects.rates, [2]); assert.equal(f.effects.plays, 1);
});

test('BR-01 followthrough: own reload without progress expires after its complete 15 second window', t => {
  const f = fixture(t); f.ticks(30); f.ticks(14);
  assert.equal(f.recovery.isRecovering(), true); f.ticks(1);
  assert.equal(f.recovery.isRecovering(), false); assert.equal(f.recovery.snapshot().reason, 'reload-timeout');
  f.ticks(3); assert.equal(f.effects.reloads, 1);
});

test('BR-01 followthrough control: website pause before our reload ends the stalled action safely', t => {
  const f = fixture(t); f.ticks(19); f.video.paused = true; f.video.seeking = false; f.ticks(1); f.ticks(20);
  assert.equal(f.effects.reloads, 0); assert.equal(f.recovery.isRecovering(), false);
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0);
});

test('BR-01 followthrough control: a new trusted user pause after reload must revoke the old restore', t => {
  const f = fixture(t); f.ticks(30); f.userPause(); f.ticks(1); f.ready(); f.ticks(1);
  assert.equal(f.recovery.isRecovering(), false); assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0);
});

test('BR-01 followthrough control: an unmarked external core before reload cannot inherit the action', t => {
  const f = fixture(t); f.ticks(15); f.externalCore(); f.video.seeking = false; f.ticks(1);
  assert.equal(f.recovery.isRecovering(), false); assert.equal(f.effects.reloads, 0);
  assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0);
});

test('BR-01 followthrough: an SDK initialization seek discards stale position restore but retains bounded playback intent', t => {
  const f = fixture(t); f.ticks(30); f.ticks(1); f.ready(); f.sdkSeek(977);
  const revision = f.player.controls().userRevision; f.ticks(1);
  assert.equal(f.player.controls().userRevision, revision);
  assert.deepEqual(f.effects.seeks, [], 'the old 978 target must not overwrite the SDK current target');
  assert.deepEqual(f.effects.rates, [2]); assert.equal(f.effects.plays, 1);
  assert.equal(f.recovery.isRecovering(), true);
});

test('BR-01 followthrough: a current legal Auto representation after owned reload retains the same bounded action', t => {
  const f = fixture(t); f.ticks(30); f.ticks(1); f.requestNewRepresentation(); f.ready(); f.ticks(1);
  assert.deepEqual(f.effects.seeks, [978]); assert.deepEqual(f.effects.rates, [2]); assert.equal(f.effects.plays, 1);
  assert.equal(f.effects.reloads, 1);
});

test('BR-01 followthrough control: a second external core after the own replacement cannot inherit saved values', t => {
  const f = fixture(t); f.ticks(30); f.ready();
  assert.equal(f.player.controls().coreReloadRevision, 1);
  f.externalCore(); f.ticks(1);
  assert.equal(f.recovery.isRecovering(), false); assert.deepEqual(f.effects.seeks, []);
  assert.deepEqual(f.effects.rates, []); assert.equal(f.effects.plays, 0);
});

test('BR-01 followthrough control: policy invalidation during the own reload revokes the paused transition', t => {
  const f = fixture(t); f.ticks(30); f.policyChanged(); f.ready(); f.ticks(1);
  assert.equal(f.recovery.isRecovering(), false); assert.deepEqual(f.effects.seeks, []);
  assert.deepEqual(f.effects.rates, []); assert.equal(f.effects.plays, 0);
});

test('BR-01 progress ownership: a completed seek between ticks is a baseline, not recovered progress', t => {
  const f = fixture(t); f.recovery.reset(); f.video.seeking = false; f.video.currentTime = 120; f.video.frames = 100;
  f.recovery.tick(f.player.snapshot());
  f.recovery.armStall(f.player.snapshot(), { id: 500, startedAt: 0, targetSec: 120, valid: () => true });
  f.sdkSeek(978); f.video.seeking = false; f.video.frames = 160;
  f.recovery.tick(f.player.snapshot()); assert.equal(f.recovery.isRecovering(), false);
  f.video.currentTime = 979; f.video.frames = 190; f.recovery.tick(f.player.snapshot());
  assert.notEqual(f.recovery.snapshot().state, 'recovered', 'seek jump plus one advancing sample cannot satisfy two-sample playback evidence');
  f.video.currentTime = 980; f.video.frames = 220; f.recovery.tick(f.player.snapshot());
  assert.equal(f.recovery.snapshot().state, 'recovered');
});

test('BR-01 progress ownership control: two unchanged-owner advancing samples clear a failed diagnostic', t => {
  const f = fixture(t); f.recovery.reset(); f.video.seeking = false; f.video.currentTime = 120; f.video.frames = 100;
  f.recovery.tick(f.player.snapshot()); f.recovery.rejectStall();
  f.video.currentTime = 121; f.video.frames = 130; f.recovery.tick(f.player.snapshot());
  assert.notEqual(f.recovery.snapshot().state, 'recovered');
  f.video.currentTime = 122; f.video.frames = 160; f.recovery.tick(f.player.snapshot());
  assert.equal(f.recovery.snapshot().state, 'recovered');
});

test('BR-01 followthrough: the owned null-core interval ends at exactly 15 seconds without extra attempts', t => {
  const f = fixture(t); f.ticks(30); f.clock.advance(14_999); f.monitor.tick();
  assert.equal(f.recovery.isRecovering(), true); f.clock.advance(1); f.monitor.tick();
  assert.equal(f.recovery.snapshot().reason, 'reload-timeout'); assert.equal(f.recovery.isRecovering(), false);
  f.ticks(3); assert.equal(f.effects.reloads, 1); assert.equal(f.effects.plays, 0);
});

test('BR-01 followthrough control: BODY Space after owned reload revokes the restore on the same dispatch', t => {
  const f = fixture(t); f.ticks(30); f.ready(); f.video.paused = false;
  const revision = f.player.controls().userRevision; f.keyboardPause();
  assert.equal(f.player.controls().userRevision, revision + 1); f.ticks(1);
  assert.equal(f.recovery.isRecovering(), false); assert.deepEqual(f.effects.seeks, []); assert.equal(f.effects.plays, 0);
});

test('BR-01 followthrough control: BODY playback-rate input during the owned interval cancels saved rate and play', t => {
  const f = fixture(t); f.ticks(30); f.ready();
  const revision = f.player.controls().userRevision; f.keyboardRate();
  assert.equal(f.player.controls().userRevision, revision + 1); f.ticks(1);
  assert.equal(f.recovery.isRecovering(), false); assert.deepEqual(f.effects.rates, []); assert.equal(f.effects.plays, 0);
});

test('BR-01 followthrough control: a new user operation inside restore seek prevents subsequent rate and play', t => {
  const f = fixture(t); f.ticks(30); f.ready(); f.onSeek(() => f.userPause()); f.ticks(1);
  assert.deepEqual(f.effects.seeks, [978]); assert.deepEqual(f.effects.rates, []); assert.equal(f.effects.plays, 0);
  assert.equal(f.recovery.isRecovering(), false);
});

test('BR-01 followthrough control: a new user operation inside rate restore prevents play', t => {
  const f = fixture(t); f.ticks(30); f.ready(); f.onRate(() => f.userPause()); f.ticks(1);
  assert.deepEqual(f.effects.seeks, [978]); assert.deepEqual(f.effects.rates, [2]); assert.equal(f.effects.plays, 0);
  assert.equal(f.recovery.isRecovering(), false);
});

test('BR-01 followthrough control: late play rejection after a user pause cannot revive owned restoration', async t => {
  const f = fixture(t), pending = deferred<void>(); f.playResult(pending.promise); f.ticks(30); f.ready(); f.ticks(1);
  assert.equal(f.effects.plays, 1); f.userPause(); f.ticks(1); const state = f.recovery.snapshot();
  pending.reject(new Error('old controlled SDK play rejection')); await Promise.resolve();
  assert.deepEqual(f.recovery.snapshot(), state); assert.equal(f.recovery.isRecovering(), false);
});

test('BR-01 late SDK ownership: resume after terminal reload failure does not create a new no-progress rescue', t => {
  const f = fixture(t); f.ticks(30); f.ticks(15); assert.equal(f.recovery.isRecovering(), false);
  assert.equal(f.effects.fallbacks, 1); f.lateSdkResume(); f.monitor.tick(); f.ticks(20);
  assert.equal(f.effects.fallbacks, 1, 'late SDK resume with no real playback cannot spend a second fallback');
  assert.equal(f.effects.reloads, 1); assert.equal(f.recovery.isRecovering(), false);
});

test('BR-01 late SDK ownership control: a fresh user operation may start a new bounded stall after failure', t => {
  const f = fixture(t); f.ticks(30); f.ticks(15); f.userPause(); f.lateSdkResume(); f.monitor.tick();
  f.ticks(14); assert.equal(f.effects.fallbacks, 1); f.ticks(1); assert.equal(f.effects.fallbacks, 2);
});

test('BR-01 review lease: accepted SDK seek and two actual progress samples straddling lease expiry recover', t => {
  const f = fixture(t); f.ticks(30); f.ticks(1); f.ready(); f.sdkSeek(977); f.ticks(1);
  f.video.seeking = false; f.monitor.tick();
  f.clock.advance(12_000); f.video.currentTime = 978; f.video.frames = 30; f.monitor.tick();
  assert.equal(f.recovery.isRecovering(), true); assert.notEqual(f.recovery.snapshot().state, 'recovered');
  f.clock.advance(1_000); f.video.currentTime = 979; f.video.frames = 60; f.monitor.tick();
  assert.equal(f.recovery.snapshot().state, 'recovered');
});

test('BR-01 review lease control: two actual progress samples before lease expiry still recover', t => {
  const f = fixture(t); f.ticks(30); f.ticks(1); f.ready(); f.sdkSeek(977); f.ticks(1);
  f.video.seeking = false; f.monitor.tick();
  f.clock.advance(1_000); f.video.currentTime = 978; f.video.frames = 30; f.monitor.tick();
  f.clock.advance(1_000); f.video.currentTime = 979; f.video.frames = 60; f.monitor.tick();
  assert.equal(f.recovery.snapshot().state, 'recovered');
});

test('BR-01 review watchdog: first actual progress while awaiting confirmation cannot repeat route recovery', t => {
  const f = fixture(t); f.ticks(30); f.ready(); f.ticks(1); f.video.seeking = false; f.monitor.tick();
  const calls = f.effects.recoverCalls; f.video.currentTime = 979; f.video.frames = 30; f.ticks(1);
  assert.equal(f.recovery.isRecovering(), true);
  assert.equal(f.effects.recoverCalls, calls, 'an ongoing bounded action cannot be duplicated by the legacy watchdog');
});

test('BR-01 review getter: trusted seek inside the restore snapshot must block every stale side effect', t => {
  const f = fixture(t); f.recovery.reset(); f.video.seeking = false;
  f.recovery.tick(f.player.snapshot());
  f.recovery.armRouteFailure('route-failure', f.player.snapshot(), () => {
    const requested = f.routes.latestRequested('video'); return !!requested && f.routes.recoveryEligible(requested);
  });
  f.clock.advance(30_000); f.recovery.tick(f.player.snapshot()); assert.equal(f.effects.reloads, 1);
  f.ready(); f.video.paused = false; let reads = 0; const revision = f.player.controls().userRevision;
  f.onMpdRead(() => {
    // Argument snapshot, initial tick ownership, then restore ownership snapshot.
    if (++reads === 3) f.keyboardSeek(5);
  });
  f.recovery.tick(f.player.snapshot());
  assert.equal(f.player.controls().userRevision, revision + 1);
  assert.deepEqual(f.effects.seeks, [5], 'the new actual user target must not be overwritten by saved 978');
  assert.deepEqual(f.effects.rates, []); assert.equal(f.effects.plays, 0); assert.equal(f.recovery.isRecovering(), false);
});

for (const invalidation of ['user', 'policy', 'core', 'hidden'] as const) {
  test(`BR-01 review lease control: ${invalidation} invalidation after first progress cannot inherit expired ownership`, t => {
    const f = fixture(t); f.ticks(30); f.ticks(1); f.ready(); f.sdkSeek(977); f.ticks(1);
    f.video.seeking = false; f.monitor.tick();
    f.clock.advance(12_000); f.video.currentTime = 978; f.video.frames = 30; f.monitor.tick();
    assert.equal(f.recovery.isRecovering(), true);
    if (invalidation === 'user') f.keyboardSeek(0);
    else if (invalidation === 'policy') f.policyChanged();
    else if (invalidation === 'core') f.externalCore();
    else f.visible(false);
    f.clock.advance(1_000); f.video.currentTime += 1; f.video.frames = 60; f.monitor.tick();
    assert.equal(f.recovery.isRecovering(), false); assert.notEqual(f.recovery.snapshot().state, 'recovered');
    assert.equal(f.effects.plays, 1); assert.equal(f.effects.reloads, 1);
  });
}
