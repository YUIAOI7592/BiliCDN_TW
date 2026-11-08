import { mkdtempSync, readFileSync, writeFileSync, rmSync, lstatSync, realpathSync } from 'node:fs'
import { resolve, join, basename, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { findSourceMap } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { supervise } from '../testing/test-process.mts'
import { isRecord } from './lib.mts'

/** A conservative output syntax target, not an accepted-runtime version policy. */
export const NODE_BUILD_TARGET = 'node24'
export const RUNTIME_PROBE_NAME = 'BiliCDN runtime capability probe'
export const NODE_TEST_FLAGS = Object.freeze([
  '--enable-source-maps',
  '--test',
  '--test-isolation=none',
  '--test-concurrency=1',
  '--test-timeout=5000',
])

export interface RuntimeInfo {
  readonly node: string
  readonly executable: string
}
interface RuntimeFacts {
  readonly typeStripping: unknown
  readonly sourceMaps: boolean
  readonly moduleResolution: boolean
}

export function runtimeCapabilityIssues(facts: RuntimeFacts): readonly string[] {
  const issues: string[] = []
  if (facts.typeStripping !== 'strip' && facts.typeStripping !== 'transform')
    issues.push('native type stripping')
  if (!facts.sourceMaps) issues.push('source map API')
  if (!facts.moduleResolution) issues.push('ESM resolution API')
  return Object.freeze(issues)
}

export function validateRuntimeProbe(value: unknown, source: string): void {
  function reject(): never {
    throw Error('Runtime capability probe returned an invalid or incomplete report')
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.nodeVersion !== process.versions.node ||
    value.success !== true ||
    typeof value.durationMs !== 'number' ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs < 0
  )
    reject()
  const counts = value.counts
  if (
    !isRecord(counts) ||
    counts.tests !== 1 ||
    counts.passed !== 1 ||
    ['failed', 'cancelled', 'skipped', 'todo'].some((key) => counts[key] !== 0)
  )
    reject()
  if (
    !Array.isArray(value.cases) ||
    value.cases.length !== 1 ||
    !Array.isArray(value.failures) ||
    value.failures.length !== 0
  )
    reject()
  const row: unknown = value.cases[0]
  if (
    !isRecord(row) ||
    row.name !== RUNTIME_PROBE_NAME ||
    row.kind !== 'test' ||
    row.status !== 'passed' ||
    row.line !== 5 ||
    typeof row.column !== 'number' ||
    !Number.isSafeInteger(row.column) ||
    row.column <= 0 ||
    typeof row.durationMs !== 'number' ||
    !Number.isFinite(row.durationMs) ||
    row.durationMs < 0 ||
    typeof row.file !== 'string'
  )
    reject()
  try {
    const file = row.file.startsWith('file:') ? fileURLToPath(row.file) : row.file
    if (resolve(file) !== resolve(source)) reject()
  } catch {
    reject()
  }
}

export async function probeRuntime(executable = process.execPath): Promise<RuntimeInfo> {
  const issues = runtimeCapabilityIssues({
    typeStripping: process.features.typescript,
    sourceMaps: typeof findSourceMap === 'function',
    moduleResolution: typeof import.meta.resolve === 'function',
  })
  if (issues.length) throw Error(`Runtime capability probe missing: ${issues.join(', ')}`)
  const parent = resolve(tmpdir()),
    prefix = `bilicdn-runtime-${process.pid}-`
  const directory = mkdtempSync(join(parent, prefix)),
    target = resolve(directory)
  try {
    const source = join(directory, 'probe.mts'),
      summary = join(directory, 'summary.json')
    writeFileSync(
      source,
      `import {test} from 'node:test'\nimport assert from 'node:assert/strict'\nimport {findSourceMap} from 'node:module'\nconst value: number = 42\ntest('${RUNTIME_PROBE_NAME}', () => { assert.equal(value,42); assert.equal(typeof findSourceMap,'function'); assert.equal(typeof import.meta.resolve,'function') })\n`,
    )
    const result = await supervise(
      executable,
      [
        ...NODE_TEST_FLAGS,
        `--test-reporter=${pathToFileURL(resolve('scripts/testing/test-reporter.mts')).href}`,
        `--test-reporter-destination=${summary}`,
        source,
      ],
      { timeoutMs: 5000, maxBytes: 1024 * 1024 },
    )
    if (result.code !== 0 || result.signal || result.reason || result.error)
      throw Error(
        `Runtime capability probe failed: ${result.reason ?? result.error ?? (result.stderr.trim().slice(0, 1024) || `exit ${result.code}`)}`,
      )
    let report: unknown
    try {
      report = JSON.parse(readFileSync(summary, 'utf8'))
    } catch {
      throw Error('Runtime capability probe did not produce a valid JSON report')
    }
    validateRuntimeProbe(report, source)
    return Object.freeze({ node: process.versions.node, executable: process.execPath })
  } finally {
    if (
      !target.startsWith(parent + sep) ||
      !basename(target).startsWith(prefix) ||
      lstatSync(target).isSymbolicLink() ||
      realpathSync(target) !== join(realpathSync(parent), basename(target))
    )
      throw Error('Runtime capability probe refused unsafe cleanup')
    rmSync(target, { recursive: true })
  }
}

let capabilityCheck: Promise<RuntimeInfo> | undefined
let reported = false
export function reportRuntimeInfo(): void {
  if (reported) return
  reported = true
  process.stderr.write(`Runtime Node ${process.versions.node}: ${process.execPath}\n`)
}
export function assertRuntimeCapabilities(): Promise<RuntimeInfo> {
  return (capabilityCheck ??= probeRuntime().then((info) => {
    reportRuntimeInfo()
    return info
  }))
}
