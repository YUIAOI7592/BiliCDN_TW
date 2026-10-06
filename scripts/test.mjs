import * as esbuild from 'esbuild'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { selection, parseArgs, UsageError } from './test-registry.mjs'
import { supervise } from './test-process.mjs'
import { validateTestDefinitions } from './test-contracts.mjs'
const require = createRequire(import.meta.url)

export function validateReport(report, processResult, { filtered = false, name } = {}) {
  if (report?.version !== 1 || report.nodeVersion !== process.versions.node || typeof report.success !== 'boolean'
    || !Number.isFinite(report.durationMs) || report.durationMs < 0 || !Array.isArray(report.cases) || !Array.isArray(report.failures))
    throw Error('Invalid structured test summary')
  const counts = report.counts
  for (const key of ['tests', 'passed', 'failed', 'cancelled', 'skipped', 'todo', 'suites', 'topLevel']) {
    if (!Number.isSafeInteger(counts?.[key]) || counts[key] < 0) throw Error('Invalid case counts')
  }
  const location = row => (typeof row.file === 'string' || row.file === null)
    && (row.line === null || (Number.isSafeInteger(row.line) && row.line > 0))
    && (row.column === null || (Number.isSafeInteger(row.column) && row.column > 0))
  if (!report.cases.every(row => typeof row.name === 'string' && ['test','suite'].includes(row.kind)
    && ['passed','failed','cancelled','skipped','todo'].includes(row.status) && location(row)
    && Number.isFinite(row.durationMs) && row.durationMs >= 0))
    throw Error('Invalid case records')
  if (!report.failures.every(row => typeof row.name === 'string' && location(row)
    && typeof row.message === 'string' && typeof row.stack === 'string')) throw Error('Invalid failure records')
  if (counts.tests !== counts.passed + counts.failed + counts.cancelled + counts.skipped + counts.todo)
    throw Error('Inconsistent case counts')
  const cases = report.cases.filter(row => row.kind !== 'suite')
  for (const key of ['passed','failed','cancelled','skipped','todo']) {
    if (cases.filter(row => row.status === key).length !== counts[key]) throw Error('Case records and summary disagree')
  }
  if (report.failures.length !== report.cases.filter(row => ['failed','cancelled'].includes(row.status)).length)
    throw Error('Failure records and cases disagree')
  if (report.success !== (processResult.code === 0) || report.success !== (counts.failed === 0 && counts.cancelled === 0))
    throw Error('Exit code and summary disagree')
  if (!report.success || counts.failed || counts.cancelled || counts.todo || (!filtered && counts.skipped))
    throw Error('Suite contains failed or incomplete cases')
  if (filtered && name !== undefined && cases.some(row => row.status === 'skipped' && new RegExp(name).test(row.name)))
    throw Error('A selected case was explicitly skipped')
  if (!filtered && counts.tests === 0) throw Error('Suite registered no cases')
  if (cases.some(row => row.file === null || row.name === row.file)) throw Error('Suite registered no named cases')
  return counts.passed + counts.failed
}

// Exported for small synthetic-fixture tests; never recursively runs the registry.
export async function executeSuites(selected, { name, timeoutMs = 60_000, maxBytes = 32 * 1024 * 1024,
  executable = process.execPath, emit = true } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'bilicdn-v2-tests-'))
  const results = [], started = performance.now()
  let cleanupError
  try {
    for (const [index, suite] of selected.entries()) {
      const outfile = join(scratch, `${index}.mjs`), summaryFile = join(scratch, `${index}.json`)
      const result = { suite: suite.name, phase: 'build', success: false }
      try {
        validateTestDefinitions(suite.source, scratch)
        await esbuild.build({ entryPoints: [suite.source], outfile, bundle: true, platform: 'node', format: 'esm',
          target: 'node26', sourcemap: 'inline', sourcesContent: true, logLevel: 'silent',
          // Architecture and tooling import tool modules whose native packages must retain their own paths.
          packages: 'external', plugins: [{ name: 'tool-packages', setup(build) {
            build.onResolve({ filter: /^(esbuild|typescript)(\/|$)/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
          } }] })
        result.phase = 'execute'
        const args = ['--enable-source-maps', '--test', '--test-isolation=none', '--test-concurrency=1', '--test-timeout=5000',
          '--test-reporter=spec', '--test-reporter-destination=stdout',
          `--test-reporter=${pathToFileURL(resolve('scripts/test-reporter.mjs')).href}`, `--test-reporter-destination=${summaryFile}`]
        if (name !== undefined) args.push(`--test-name-pattern=${name}`)
        args.push(outfile)
        result.process = await supervise(executable, args, { timeoutMs, maxBytes })
        if (emit) { process.stdout.write(result.process.stdout); process.stderr.write(result.process.stderr) }
        if (result.process.error || result.process.reason || result.process.signal)
          throw Error(result.process.error ?? `Suite stopped: ${result.process.reason ?? result.process.signal}`)
        result.phase = 'report'
        result.report = JSON.parse(readFileSync(summaryFile, 'utf8'))
        result.executed = validateReport(result.report, result.process, { filtered: name !== undefined, name })
        result.success = true
      } catch (error) {
        result.error = error.message
        if (emit) process.stderr.write(`[${suite.name}] ${result.phase}: ${result.error}\n`)
      }
      results.push(result)
    }
  } finally {
    try {
      const absolute = resolve(scratch), parent = resolve(tmpdir())
      if (!absolute.startsWith(`${parent}${sep}`) || !absolute.split(sep).at(-1)?.startsWith('bilicdn-v2-tests-'))
        throw Error('Refusing unsafe cleanup')
      rmSync(absolute, { recursive: true })
    } catch (error) { cleanupError = error.message }
  }
  return { results, cleanupError, durationMs: performance.now() - started }
}

export function finishOutcome(outcome) {
  const failures = outcome.results.filter(result => !result.success)
  if (failures.length || outcome.cleanupError) {
    const causes = failures.map(result => Error(`${result.suite} (${result.phase}): ${result.error}`))
    if (outcome.cleanupError) causes.push(Error(`Scratch cleanup: ${outcome.cleanupError}`))
    const error = new AggregateError(causes, 'Test suites failed')
    error.outcome = outcome
    throw error
  }
  const executed = outcome.results.reduce((count, result) => count + result.executed, 0)
  if (!executed) throw new UsageError('No cases matched --name')
  return executed
}

export async function runTests(filter = '', options = {}) {
  const selected = selection(filter) // Validate before allocating a scratch directory.
  if (options.name !== undefined) { try { new RegExp(options.name) } catch { throw new UsageError('Invalid case expression') } }
  const outcome = await executeSuites(selected, options)
  const executed = finishOutcome(outcome)
  process.stdout.write(`Contract cases: ${executed}; total ${outcome.durationMs.toFixed(1)} ms\n`)
  return outcome
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/test.mjs')) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.list) for (const row of selection()) console.log(`${row.name}\t${row.source}`)
    else await runTests(options.filter, options)
  } catch (error) {
    console.error(error.message)
    if (error instanceof AggregateError) for (const cause of error.errors) console.error(cause.message)
    if (error instanceof UsageError) console.error('Usage: npm test -- [suite] [--name regex] | --list')
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}
