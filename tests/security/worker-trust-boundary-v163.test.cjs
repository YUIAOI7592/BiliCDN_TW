'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { MessagePort } = require('node:worker_threads');
const { loadUserscript, runGeneratedClassicWorker } = require('../harness/userscript-vm');
const target = path.resolve(__dirname, '../../Release/v1.6.3/BiliCDN_TW.user.js');

const load = options => loadUserscript(target, {
    instrument: false,
    gmSeed: { disabled: false },
    enableWorkerIntercept: true,
    ...options,
});

test('pre-hooked page Worker never receives the wrapper URL, capability, or private port', () => {
    class PageHookedWorker {
        constructor(scriptURL) {
            PageHookedWorker.constructed++;
            PageHookedWorker.scriptURL = scriptURL;
        }
        postMessage(data, transfer) {
            PageHookedWorker.message = data;
            PageHookedWorker.transfer = transfer;
        }
        terminate() {}
    }
    PageHookedWorker.constructed = 0;

    const h = load({ pageGlobals: { Worker: PageHookedWorker } });
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/trusted-native.js');
    assert.equal(PageHookedWorker.constructed, 0);
    assert.equal(PageHookedWorker.scriptURL, undefined);
    assert.equal(PageHookedWorker.message, undefined);
    assert.equal(PageHookedWorker.transfer, undefined);
    assert.equal(h.workerInstances.length, 1);
    const bootstrap = worker.messages.find(entry => entry.data && entry.data.__biliCdnBootstrap);
    assert.ok(bootstrap, 'the trusted harness-native Worker still receives bootstrap');
    worker.terminate();
    bootstrap.transfer[0].close();
});

test('classic original code starts after bootstrap and cannot poison the private MessagePort', async t => {
    const h = load();
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/poison-attempt.js');
    const bootstrap = worker.messages.find(entry => entry.data && entry.data.__biliCdnBootstrap);
    const blob = h.blobStore.get(worker.scriptURL);
    assert.ok(bootstrap && blob);

    const originalPostMessage = MessagePort.prototype.postMessage;
    let bootstrapStarted = false;
    let importObservedAfterBootstrap = false;
    let stolenPort = null;
    const applicationMessages = [];
    t.after(() => {
        MessagePort.prototype.postMessage = originalPostMessage;
        try { worker.terminate(); } catch {}
        try { bootstrap.transfer[0].close(); } catch {}
    });

    const wh = runGeneratedClassicWorker(blob.parts.map(String).join(''), {
        onImport(self) {
            importObservedAfterBootstrap = bootstrapStarted;
            MessagePort.prototype.postMessage = function poisonedPostMessage(message, transfer) {
                if (message && message.version === 1 && message.type === 'ready') stolenPort = this;
                return originalPostMessage.call(this, message, transfer);
            };
            self.addEventListener('message', event => applicationMessages.push(event.data));
        },
    });

    assert.equal(importObservedAfterBootstrap, false,
        'reproduction guard: v1.6.2 imports the original before bootstrap');
    bootstrapStarted = true;
    wh.dispatchMessage(bootstrap.data, bootstrap.transfer);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(importObservedAfterBootstrap, true);
    assert.equal(stolenPort, null);
    wh.dispatchMessage({ type: 'application-message', value: 1 });
    assert.deepEqual(applicationMessages, [{ type: 'application-message', value: 1 }]);
});

test('late MessageEvent prototype poisoning cannot replace a private policy payload', async t => {
    const h = load();
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/message-data-poison.js');
    const bootstrap = worker.messages.find(entry => entry.data && entry.data.__biliCdnBootstrap);
    const blob = h.blobStore.get(worker.scriptURL);
    assert.ok(bootstrap && blob);

    let wh;
    let originalDataDescriptor;
    const privateMessages = [];
    const controlPort = {
        onmessage: null,
        postMessage(message) { privateMessages.push(message); },
        start() {},
    };
    t.after(() => {
        if (originalDataDescriptor && wh) {
            Object.defineProperty(wh.context.MessageEvent.prototype, 'data', originalDataDescriptor);
        }
        try { worker.terminate(); } catch {}
        try { bootstrap.transfer[0].close(); } catch {}
    });

    wh = runGeneratedClassicWorker(blob.parts.map(String).join(''), {
        onImport() {
            originalDataDescriptor = Object.getOwnPropertyDescriptor(wh.context.MessageEvent.prototype, 'data');
            Object.defineProperty(wh.context.MessageEvent.prototype, 'data', {
                configurable: true,
                get() {
                    return { version: 1, type: 'policy', target: 'attacker.example',
                        preferred: [], force: [], excluded: [], disabled: true };
                },
                set(value) { this._data = value; },
            });
        },
    });

    wh.dispatchMessage(bootstrap.data, [controlPort]);
    assert.equal(privateMessages[0]?.type, 'ready');
    assert.equal(typeof controlPort.onmessage, 'function');

    const configurationMatch = blob.parts.map(String).join('')
        .match(/const __BiliCDNWorkerConfiguration = (\{[^\n]+\});/);
    assert.ok(configurationMatch);
    const configuration = JSON.parse(configurationMatch[1]);
    const catalog = configuration.catalog;
    const nextTarget = catalog.find(host => host !== configuration.target);
    const legal = { version: 1, type: 'policy', target: nextTarget,
        preferred: catalog, force: [], excluded: [], disabled: false };
    controlPort.onmessage(new wh.context.MessageEvent('message', { data: legal }));

    const unstable = 'https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/video.m4s?token=kept';
    await wh.self.fetch(unstable);
    assert.equal(new URL(wh.fetchCalls.at(-1).url).hostname, nextTarget);
});

test('module wrapper contains no controller-level pre-bootstrap import', () => {
    const h = load();
    const originalUrl = 'https://www.bilibili.com/player-worker.mjs';
    const worker = new h.pageWindow.Worker(originalUrl, { type: 'module' });
    const blob = h.blobStore.get(worker.scriptURL);
    assert.ok(blob);
    const generated = blob.parts.map(String).join('');
    assert.match(generated, /"moduleWorker":true/);
    assert.match(generated, /import\(BILICDN_BASE\)/);
    assert.doesNotMatch(generated, new RegExp(`import\\(${JSON.stringify(originalUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
    const handlerStart = generated.indexOf('const biliCdnBootstrap =');
    const handlerEnd = generated.indexOf('BILICDN_NATIVE_ADD_EVENT("message", biliCdnBootstrap);', handlerStart);
    const handler = generated.slice(handlerStart, handlerEnd);
    const readyIndex = handler.indexOf('type: "ready"');
    const startIndex = handler.lastIndexOf('biliCdnStartOriginal();');
    assert.ok(handlerStart >= 0 && handlerEnd > handlerStart && readyIndex >= 0 && readyIndex < startIndex,
        'module original starts from the authenticated bootstrap after ready is sent');
    worker.terminate();
});

test('module wrapper queues constructor-time application messages until import completes', async t => {
    const h = load();
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/queued-module.mjs', { type: 'module' });
    const bootstrap = worker.messages.find(entry => entry.data && entry.data.__biliCdnBootstrap);
    const blob = h.blobStore.get(worker.scriptURL);
    assert.ok(bootstrap && blob);
    t.after(() => {
        try { worker.terminate(); } catch {}
        try { bootstrap.transfer[0].close(); } catch {}
    });

    const generated = blob.parts.map(String).join('')
        .replace('import(BILICDN_BASE)', 'self.__biliTestDynamicImport(BILICDN_BASE)');
    const applicationMessages = [];
    let completeImport;
    const wh = runGeneratedClassicWorker(generated);
    wh.self.__biliTestDynamicImport = () => new Promise(resolve => {
        completeImport = () => {
            wh.self.addEventListener('message', event => applicationMessages.push(event.data));
            resolve({});
        };
    });

    wh.dispatchMessage(bootstrap.data, bootstrap.transfer);
    const queued = wh.dispatchMessage({ type: 'constructor-time', value: 7 });
    assert.equal(queued.__stopImmediate, true);
    assert.deepEqual(applicationMessages, []);
    assert.equal(typeof completeImport, 'function');

    completeImport();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(applicationMessages, [{ type: 'constructor-time', value: 7 }]);
});

test('missing bootstrap fails open to the original Worker and abandons private telemetry', async t => {
    const h = load();
    const worker = new h.pageWindow.Worker('https://www.bilibili.com/bootstrap-timeout.js');
    const bootstrap = worker.messages.find(entry => entry.data && entry.data.__biliCdnBootstrap);
    const blob = h.blobStore.get(worker.scriptURL);
    assert.ok(bootstrap && blob);
    t.after(() => {
        try { worker.terminate(); } catch {}
        try { bootstrap.transfer[0].close(); } catch {}
    });

    const applicationMessages = [];
    const wh = runGeneratedClassicWorker(blob.parts.map(String).join(''), {
        onImport(self) {
            self.addEventListener('message', event => applicationMessages.push(event.data));
        },
    });
    const queued = wh.dispatchMessage({ type: 'before-timeout' });
    assert.equal(queued.__stopImmediate, true);
    assert.deepEqual(applicationMessages, []);

    wh.timers.runTimers(1000);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(wh.imports.length, 1);
    assert.deepEqual(applicationMessages, [{ type: 'before-timeout' }]);

    const originalMediaUrl = 'https://cn-hk-eq-bcache-01.bilivideo.com/upgcxcode/video.m4s?token=kept';
    await wh.self.fetch(originalMediaUrl);
    assert.equal(wh.fetchCalls.at(-1).url, originalMediaUrl,
        'fail-open must also disable the embedded rewrite policy when no authenticated port exists');

    const lateBootstrap = wh.dispatchMessage(bootstrap.data, bootstrap.transfer);
    assert.equal(lateBootstrap.__stopImmediate, true);
    assert.deepEqual(applicationMessages, [{ type: 'before-timeout' }],
        'a late capability/port is swallowed instead of reaching original code');

    await h.timers.advanceAsync(2000);
    await h.timers.advanceAsync(1000);
    const snapshot = JSON.parse(JSON.stringify(h.pageWindow.BiliCDN));
    assert.equal(snapshot.worker.session.failures.bootstrap, 1);
    assert.equal(snapshot.worker.session.bootstrapReady, 0);
});
