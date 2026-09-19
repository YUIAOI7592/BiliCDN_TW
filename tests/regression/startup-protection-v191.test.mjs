import test from 'node:test'
import assert from 'node:assert/strict'
import { createStartup } from '../../src/playback/startup.mjs'

const make = () => {
    let seekGrace = false
    const events = []
    const startup = createStartup({
        inSeekGrace: () => seekGrace,
        DiagnosticLog: { record: (code, data) => events.push({ code, data }) },
    })
    const video = {}
    const state = { available: true, valid: true, paused: false, seeking: false, ended: false,
        errorCode: 0, duration: 600, bufferAheadSec: 30, effectiveRate: 2, currentTime: 0 }
    return { startup, video, state, events, setSeekGrace: value => { seekGrace = value } }
}

test('startup protection needs two advancing ticks and 12 playable seconds', () => {
    const f = make()
    f.startup.update(f.video, f.state)
    f.state.currentTime = 1
    f.startup.update(f.video, f.state)
    assert.equal(f.startup.allowed(), false)
    f.state.currentTime = 2
    f.startup.update(f.video, f.state)
    assert.equal(f.startup.allowed(), true)
    assert.equal(f.startup.summary().playableSec, 15)
})

test('paused, seeking, low data and seek grace keep automatic measurements out', () => {
    for (const mutation of [
        state => { state.paused = true },
        state => { state.seeking = true },
        state => { state.bufferAheadSec = 20 },
    ]) {
        const f = make(); mutation(f.state)
        for (let i = 0; i < 3; i++) { f.state.currentTime += 1; f.startup.update(f.video, f.state) }
        assert.equal(f.startup.allowed(), false)
    }
    const f = make(); f.setSeekGrace(true)
    for (let i = 0; i < 3; i++) { f.state.currentTime += 1; f.startup.update(f.video, f.state) }
    assert.equal(f.startup.allowed(), false)
})

test('a fully buffered short tail still requires real playback progress', () => {
    const f = make()
    Object.assign(f.state, { currentTime: 18, duration: 20, bufferAheadSec: 2 })
    f.startup.update(f.video, f.state)
    assert.equal(f.startup.allowed(), false)
    f.state.currentTime = 19
    f.startup.update(f.video, f.state)
    f.state.currentTime = 19.5
    f.startup.update(f.video, f.state)
    assert.equal(f.startup.allowed(), true)
})
