import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { evaluateOptimization } from '../../../scripts/evaluation/optimization-evaluation.mts'

test('V2212 optimization CLI selects the supplemental model without replacing old modes', () => {
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/evaluation/routing-evaluation.mts', '--optimization'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    ),
  )
  assert.equal(result.model, 'todo-optimization-v2212')
  assert.equal(result.fieldEfficacy, 'not-validated')
  assert.equal(result.retry.rows.length, 7680)
})

test('V2212 optimization model is deterministic with explicit source and input identities', async () => {
  const a = await evaluateOptimization(),
    b = await evaluateOptimization()
  assert.deepEqual(a, b)
  assert.equal(a.baselineRevision, '060b79ffba2c257a73e8d3a5257291d028a7097a')
  assert.match(a.inputSha256, /^[a-f0-9]{64}$/)
  assert.ok(Object.hasOwn(a.sourceSha256, 'scripts/lib/toolchain.mts'))
  for (const [path, hash] of Object.entries(a.sourceSha256)) {
    if (path === 'scripts/lib/toolchain.mts')
      assert.equal(hash, createHash('sha256').update(readFileSync(path)).digest('hex'))
    else assert.match(path, /^(src-v2\/domain\/|scripts\/evaluation\/)/)
    assert.match(hash, /^[a-f0-9]{64}$/)
  }
})

test('V2212 optimization grid agrees with an independent budget inequality', async () => {
  const model = await evaluateOptimization()
  let accepted = 0
  for (const { facts: f, decision } of model.retry.rows) {
    const remaining =
      f.recentBytesPerSec === 0 ? Infinity : (f.totalBytes - f.loadedBytes) / f.recentBytesPerSec!
    const replacement =
      2 + f.alternative.ttfbMs / 1000 + (f.totalBytes * 8) / (f.alternative.safePayloadMbps! * 1e6)
    const expected =
      f.recentBytesPerSec! * 8 < f.requiredMbps * 1e6 &&
      f.alternative.safeMbps >= 1.35 * f.requiredMbps &&
      replacement <= 0.8 * f.playableBufferSec &&
      remaining > 0.8 * f.playableBufferSec &&
      remaining - replacement >= 1
    assert.equal(decision.eligible, expected, JSON.stringify(f))
    if (expected) {
      accepted++
      assert.ok(f.playableBufferSec > 2.5)
      assert.ok(Math.abs(decision.alternativeSec! - replacement) < 1e-10)
    }
  }
  assert.equal(accepted, 1076)
  assert.equal(
    Object.values(model.retry.reasons).reduce((a, b) => a + b, 0),
    7680,
  )
})

test('V2212 counterfactuals retain harm, wasted bytes and unknown outcomes without future leakage', async () => {
  const rows = (await evaluateOptimization()).retry.counterfactuals
  for (const row of rows) assert.deepEqual(row.decision, rows[0]!.decision)
  assert.deepEqual(
    rows.slice(0, 3).map((r) => r.savedStallSec),
    [14, 0, -7],
  )
  assert.equal(rows[1]!.extraDownloadedBytes, 100000)
  assert.ok(rows[1]!.savedCompletionSec! < 0)
  assert.equal(rows[0]!.replacementTotalSec, 2.3, 'handoff is added exactly once')
  for (const row of rows.slice(3)) {
    assert.equal(row.savedStallSec, null)
    assert.equal(row.candidateCompletionSec, null)
    assert.equal(row.extraDownloadedBytes, null)
    assert.equal(row.deadlineMisjudged, null)
  }
  for (const row of rows) {
    assert.equal(row.probeCount, null)
    assert.equal(row.reloadCount, null)
  }
  assert.equal(rows[2]!.deadlineMisjudged, true)
})

test('V2212 VBR traces conserve bytes and media time without multiplying bitrate by FPS', async () => {
  const traces = (await evaluateOptimization()).segments
  assert.equal(traces.length, 4)
  const expected = [0, 4.1, 4.4, 6.1]
  for (const [i, trace] of traces.entries()) {
    assert.ok(Math.abs(trace.stallSec - expected[i]!) < 1e-8)
    assert.equal(trace.downloadedBytes, 12000000)
    for (const row of trace.rows) {
      const consumed = trace.input.rate * (row.deliverySec - row.stallSec)
      assert.ok(
        Math.abs(
          row.bufferBeforeMediaSec + row.durationMediaSec - row.bufferAfterMediaSec - consumed,
        ) < 1e-8,
      )
      assert.equal(row.representation.bandwidth, 6000000)
      assert.equal(row.representation.fps, 60)
      assert.ok(Math.abs(row.deliverySec - (0.1 + row.bytes / 1000000)) < 1e-8)
      assert.ok(row.bufferAfterMediaSec >= 0)
    }
    assert.equal(trace.probeCount, null)
    assert.equal(trace.reloadCount, null)
  }
})

test('V2212 optimization mode rejects ambiguous selection without changing historical commands', () => {
  const run = spawnSync(
    process.execPath,
    ['scripts/evaluation/routing-evaluation.mts', '--optimization', '--deadlines'],
    { encoding: 'utf8' },
  )
  assert.equal(run.status, 2)
  assert.equal(run.stdout, '')
  assert.match(run.stderr, /Usage:/)
})
