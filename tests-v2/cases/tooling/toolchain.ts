import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  runtimeCapabilityIssues,
  validateRuntimeProbe,
  probeRuntime,
  assertRuntimeCapabilities,
  RUNTIME_PROBE_NAME,
} from '../../../scripts/lib/toolchain.mts'

function probeReport() {
  return {
    version: 1,
    nodeVersion: process.versions.node,
    success: true,
    durationMs: 1,
    counts: { tests: 1, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0 },
    cases: [
      {
        name: RUNTIME_PROBE_NAME,
        kind: 'test',
        status: 'passed',
        file: resolve('probe.mts'),
        line: 5,
        column: 1,
        durationMs: 1,
      },
    ],
    failures: [],
  }
}

test('TOOLCHAIN accepts capabilities without an exact Node version policy', () => {
  assert.deepEqual(
    runtimeCapabilityIssues({ typeStripping: 'strip', sourceMaps: true, moduleResolution: true }),
    [],
  )
  assert.deepEqual(
    runtimeCapabilityIssues({
      typeStripping: 'transform',
      sourceMaps: true,
      moduleResolution: true,
    }),
    [],
  )
})

for (const [name, facts, issue] of [
  [
    'type stripping',
    { typeStripping: false, sourceMaps: true, moduleResolution: true },
    'type stripping',
  ],
  [
    'source maps',
    { typeStripping: 'strip', sourceMaps: false, moduleResolution: true },
    'source map',
  ],
  ['ESM resolution', { typeStripping: 'strip', sourceMaps: true, moduleResolution: false }, 'ESM'],
] as const) {
  test('TOOLCHAIN rejects missing ' + name + ' capability', () => {
    assert.ok(runtimeCapabilityIssues(facts).some((item) => item.includes(issue)))
  })
}

test('TOOLCHAIN accepts one complete named probe report from the same runtime', () => {
  assert.doesNotThrow(() => validateRuntimeProbe(probeReport(), resolve('probe.mts')))
})

for (const [name, mutate] of [
  [
    'runtime mismatch',
    (report: ReturnType<typeof probeReport>) => {
      report.nodeVersion = 'different'
    },
  ],
  [
    'failed summary',
    (report: ReturnType<typeof probeReport>) => {
      report.success = false
    },
  ],
  [
    'count mismatch',
    (report: ReturnType<typeof probeReport>) => {
      report.counts.passed = 0
    },
  ],
  [
    'wrong source',
    (report: ReturnType<typeof probeReport>) => {
      report.cases[0]!.file = resolve('other.mts')
    },
  ],
  [
    'missing source position',
    (report: ReturnType<typeof probeReport>) => {
      report.cases[0]!.line = 0
    },
  ],
  [
    'wrong case identity',
    (report: ReturnType<typeof probeReport>) => {
      report.cases[0]!.name = 'other'
    },
  ],
  [
    'skipped case',
    (report: ReturnType<typeof probeReport>) => {
      report.cases[0]!.status = 'skipped'
    },
  ],
  [
    'incomplete cases',
    (report: ReturnType<typeof probeReport>) => {
      report.cases = []
    },
  ],
] as const) {
  test('TOOLCHAIN rejects probe ' + name, () => {
    const report = probeReport()
    mutate(report)
    assert.throws(
      () => validateRuntimeProbe(report, resolve('probe.mts')),
      /Runtime capability probe/,
    )
  })
}

test('TOOLCHAIN rejects malformed probe values without accepting empty success', () => {
  for (const report of [null, {}, [], { success: true }]) {
    assert.throws(
      () => validateRuntimeProbe(report, resolve('probe.mts')),
      /Runtime capability probe/,
    )
  }
})

function ownedProbeDirectories() {
  return readdirSync(tmpdir())
    .filter((name) => name.startsWith(`bilicdn-runtime-${process.pid}-`))
    .sort()
}

test('TOOLCHAIN real CLI probe verifies mts reporter and cleans its own resources', async () => {
  const before = ownedProbeDirectories()
  const result = await probeRuntime()
  assert.equal(result.node, process.versions.node)
  assert.equal(result.executable, process.execPath)
  assert.deepEqual(ownedProbeDirectories(), before)
})

test('TOOLCHAIN missing executable fails and still cleans its own resources', async () => {
  const before = ownedProbeDirectories()
  await assert.rejects(
    probeRuntime(resolve('missing toolchain executable.exe')),
    /Runtime capability probe/,
  )
  assert.deepEqual(ownedProbeDirectories(), before)
})

if (process.platform === 'win32') {
  test('TOOLCHAIN an executable rejecting Node CLI options cannot satisfy the probe', async () => {
    const before = ownedProbeDirectories()
    await assert.rejects(probeRuntime('pwsh'), /Runtime capability probe failed/)
    assert.deepEqual(ownedProbeDirectories(), before)
  })
}

test('TOOLCHAIN shares the same capability promise within one process', async () => {
  const first = assertRuntimeCapabilities(),
    second = assertRuntimeCapabilities()
  assert.equal(first, second)
  assert.equal((await first).node, process.versions.node)
  assert.equal(assertRuntimeCapabilities(), first)
})
