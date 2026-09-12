'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const F = require('../harness/v153-fixture');
const { loadUserscript, runGeneratedClassicWorker } = require('../harness/userscript-vm');
const target = path.resolve(__dirname, '../../Release/v1.6.3/BiliCDN_TW.user.js');

const load = options => loadUserscript(target, { instrument: false, gmSeed: { disabled: false }, ...options });
const snapshot = h => JSON.parse(JSON.stringify(h.pageWindow.BiliCDN));

test('historical v163 explicit opt-out does not touch Worker, Blob or MessageChannel', () => {
    const h = load({ enableWorkerIntercept: false });
    assert.equal(snapshot(h).worker.installState, 'disabled');
    assert.equal(snapshot(h).worker.session.constructorCalls, 0);
    assert.equal(h.getMessageChannelCount(), 0);
    assert.equal(h.blobStore.size, 0);
    assert.equal(h.workerInstances.length, 0);
});

test('historical v163 default-on path installs the interceptor without creating a Worker or active network work', () => {
    const h = load();
    const off = load({ enableWorkerIntercept: false });
    assert.equal(snapshot(h).worker.enabled, true);
    assert.equal(snapshot(h).worker.installState, 'installed');
    assert.equal(snapshot(h).worker.session.constructorCalls, 0);
    assert.equal(h.getMessageChannelCount(), 0);
    assert.equal(h.blobStore.size, 0);
    assert.equal(h.workerInstances.length, 0);
    assert.equal(h.fetchCalls.length, off.fetchCalls.length, 'installing the interceptor adds no active network request');
});

test('v162 enabled interceptor distinguishes no constructor call from a wrapped Worker', async t => {
    const h = load({ enableWorkerIntercept: true });
    assert.equal(snapshot(h).worker.installState, 'installed');
    assert.equal(snapshot(h).worker.session.constructorCalls, 0);

    const worker = new h.pageWindow.Worker('https://www.bilibili.com/v162-worker.js');
    const bootstrap = worker.messages.find(entry => entry.data && entry.data.__biliCdnBootstrap);
    assert.ok(bootstrap);
    const blob = h.blobStore.get(worker.scriptURL);
    const wh = runGeneratedClassicWorker(blob.parts.map(String).join(''), {
        fetchImpl: async () => new Response(new Uint8Array(64 * 1024), { status: 206 }),
    });
    t.after(() => { worker.terminate(); bootstrap.transfer[0].close(); });

    wh.dispatchMessage(bootstrap.data, bootstrap.transfer);
    await F.settle();
    await F.settle();
    await h.timers.advanceAsync(1000);
    const workerState = snapshot(h).worker;
    assert.equal(workerState.session.constructorCalls, 1);
    assert.equal(workerState.session.wrapped, 1);
    assert.equal(workerState.session.bootstrapReady, 1);
    assert.equal(workerState.created >= 1, true);
    assert.equal(workerState.bootstrapReady >= 1, true);

    const response = await wh.self.fetch('https://node.mountaintoys.cn/upgcxcode/v162.m4s');
    await response.arrayBuffer();
    wh.timers.runTimers(200);
    await F.settle();
    await h.timers.advanceAsync(1000);
    const activeState = snapshot(h).worker.session;
    assert.equal(activeState.netCalls, 1);
    assert.equal(activeState.mediaSeen, 1);
    assert.equal(activeState.rewrites, 1);
    assert.ok(activeState.bytesMB > 0);

    worker.dispatchEvent(new h.context.Event('message', { isTrusted: true }));
    await F.settle();
    await h.timers.advanceAsync(1000);
    assert.equal(snapshot(h).worker.session.bootstrapReady, 1, 'ordinary Worker messages cannot forge private readiness');
});

test('v162 records bounded source and capability bypass reasons without wrapping', async () => {
    const h = load({ enableWorkerIntercept: true });
    new h.pageWindow.Worker('blob:https://www.bilibili.com/existing');
    new h.pageWindow.Worker('data:text/javascript,void%200');
    new h.pageWindow.Worker('https://cdn.example/worker.mjs', { type: 'module' });
    await h.timers.advanceAsync(1000);
    const state = snapshot(h).worker;
    assert.equal(state.session.constructorCalls, 3);
    assert.deepEqual(state.session.bypass, {
        disabled: 0, blob: 1, data: 1, crossOriginModule: 1,
        noRandom: 0, noBlobApi: 0, noMessageChannel: 0,
    });
    assert.equal(state.session.wrapped, 0);
    assert.equal(h.blobStore.size, 0);

    const noRandom = load({ enableWorkerIntercept: true, cryptoImpl: {} });
    new noRandom.pageWindow.Worker('https://www.bilibili.com/no-random.js');
    await noRandom.timers.advanceAsync(1000);
    assert.equal(snapshot(noRandom).worker.session.bypass.noRandom, 1);
    assert.equal(snapshot(noRandom).worker.session.wrapped, 0);

    const noBlob = load({ enableWorkerIntercept: true, blobImpl: null });
    new noBlob.pageWindow.Worker('https://www.bilibili.com/no-blob.js');
    await noBlob.timers.advanceAsync(1000);
    assert.equal(snapshot(noBlob).worker.session.bypass.noBlobApi, 1);

    const noChannel = load({ enableWorkerIntercept: true, messageChannelImpl: null });
    new noChannel.pageWindow.Worker('https://www.bilibili.com/no-channel.js');
    await noChannel.timers.advanceAsync(1000);
    assert.equal(snapshot(noChannel).worker.session.bypass.noMessageChannel, 1);
});

test('v162 detects page replacement of the installed Worker constructor without reinstalling', async () => {
    const h = load({ enableWorkerIntercept: true });
    const replacement = class ReplacementWorker {};
    h.pageWindow.Worker = replacement;
    await h.timers.advanceAsync(1000);
    const first = snapshot(h).worker;
    assert.equal(first.installState, 'replaced');
    assert.equal(first.session.replacements, 1);
    assert.equal(h.pageWindow.Worker, replacement);
    await h.timers.advanceAsync(5000);
    assert.equal(snapshot(h).worker.session.replacements, 1);
});

test('v162 public Worker diagnostics stay finite, frozen and free of script URLs', async () => {
    const secret = 'v162-secret-path-token';
    const h = load({ enableWorkerIntercept: true });
    const worker = new h.pageWindow.Worker(`https://www.bilibili.com/${secret}.js?token=private`);
    await h.timers.advanceAsync(1000);
    const publicWorker = h.pageWindow.BiliCDN.worker;
    assert.equal(Object.isFrozen(publicWorker), true);
    assert.equal(Object.isFrozen(publicWorker.session), true);
    const serialized = JSON.stringify(publicWorker);
    assert.doesNotMatch(serialized, new RegExp(secret));
    assert.doesNotMatch(serialized, /token=private|https:\/\//);
    const values = [];
    const walk = value => {
        if (value && typeof value === 'object') Object.values(value).forEach(walk);
        else values.push(value);
    };
    walk(publicWorker);
    assert.ok(values.filter(value => typeof value === 'number').every(Number.isFinite));
    worker.terminate();
});
