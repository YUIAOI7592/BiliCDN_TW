'use strict'

const path = require('node:path')
const { loadUserscript, FakeEvent } = require('./userscript-vm')
const root = path.resolve(__dirname, '../..')
const previous = path.join(root, 'tests/fixtures/BiliCDN_TW_1.5.2.user.js')
const target = require('./current-script')
const now = 1800000000000
const ali = 'upos-sz-mirroraliov.bilivideo.com'
const other = 'upos-sz-mirrorali02.bilivideo.com'
const playurl = 'https://api.bilibili.com/x/player/playurl?cid=fixture'
const mediaUrl = (name, host = ali) => `https://${host}/upgcxcode/${name}.m4s?sig=fixture`
const rep = (kind = 'av1', host = ali, name = kind) => ({
    id: 120, width: 3840, height: 2160, bandwidth: 9000000, frame_rate: '60000/1001',
    codecs: { av1: 'av01.0.12M.08', hevc: 'hev1.1.6.L120.90', avc: 'avc1.640033' }[kind],
    mime_type: 'video/mp4', base_url: mediaUrl(name, host),
})
const payload = () => ({ code: 0, data: { dash: {
    video: [rep()], audio: [{ id: 30280, bandwidth: 128000, codecs: 'mp4a.40.2', base_url: mediaUrl('audio', other) }],
} } })
const load = (options = {}, file = target) => loadUserscript(file, {
    now, mediaSourceSupport: true,
    fetchImpl: async url => String(url).includes('/x/player/playurl')
        ? new Response(JSON.stringify(options.payload || payload())) : new Response(new Uint8Array(1024)),
    ...options,
    gmSeed: { disabled: false, blicdnVersion: '1.5.2', throughputSchema: 3,
        probeCache_v1: JSON.stringify({ t: now, list: [ali, other] }), ...(options.gmSeed || {}) },
})
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)) }
const prime = async h => { await (await h.pageWindow.fetch(playurl)).text() }
const consume = async (h, url) => { await (await h.pageWindow.fetch(url)).arrayBuffer() }
const json = (h, expression) => JSON.parse(h.evaluate(`JSON.stringify(${expression})`))
const video = (h, height = 2160) => {
    const v = h.document.createElement('video')
    Object.assign(v, { playbackRate: 2, currentTime: 0, videoHeight: height, readyState: 4,
        paused: true, seeking: false, ended: false, isConnected: true, clientWidth: 1920, clientHeight: 1080 })
    let ahead = 70
    v.buffered = { length: 1, start: () => 0, end: () => v.currentTime + ahead }
    v.setAhead = value => { ahead = value }
    h.document.body.appendChild(v)
    Object.defineProperty(v, 'isConnected', { configurable: true, get: () => h.document.contains(v) })
    const old = h.document.querySelectorAll.bind(h.document)
    h.document.querySelectorAll = selector => selector === 'video' ? [v] : old(selector)
    return v
}
const spa = async h => { h.pageWindow.history.pushState({}, '', '/video/BVnext?p=2'); await h.timers.advanceAsync(0) }
const ui = h => h.getClosedShadowRoot(h.document.getElementById('bilicdn-trusted-menu-ui'))
const click = (h, action) => {
    const node = ui(h).querySelector(`[data-ui-action="${action}"]`)
    if (!node) throw new Error('Missing action: ' + action)
    node.dispatchEvent(new FakeEvent('click', { isTrusted: true }))
    return node
}
module.exports = { root, previous, target, now, ali, other, playurl, mediaUrl, rep, payload,
    load, settle, prime, consume, json, video, spa, ui, click, FakeEvent }
