import * as esbuild from 'esbuild'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { selection, parseArgs, UsageError } from './test-registry.mts'
import { supervise } from './test-process.mts'
import { validateTestDefinitions } from './test-contracts.mts'
import { isRecord, errorMessage } from './lib.mts'
import type { ProcessResult } from './test-process.mts'
import type { TestSuite } from './test-registry.mts'
export type { ProcessResult } from './test-process.mts'
export type CaseStatus = 'passed'|'failed'|'cancelled'|'skipped'|'todo'
export interface ReportLocation { file:string|null; line:number|null; column:number|null }
export interface CaseRecord extends ReportLocation { name:string; status:CaseStatus; kind:'test'|'suite'; durationMs:number }
export interface FailureRecord extends ReportLocation { name:string; message:string; stack:string }
export interface TestCounts { tests:number; passed:number; failed:number; cancelled:number; skipped:number; todo:number; suites:number; topLevel:number }
export interface TestReport { version:number; nodeVersion:string; durationMs:number; success:boolean; counts:TestCounts; cases:CaseRecord[]; failures:FailureRecord[] }
export interface SuiteResult { suite:string; phase:'build'|'execute'|'report'; success:boolean; process?:ProcessResult; report?:TestReport; executed?:number; error?:string }
export interface Outcome { results:SuiteResult[]; cleanupError:string|undefined; durationMs:number }
export interface RunnerOptions { name?:string|undefined; timeoutMs?:number; maxBytes?:number; executable?:string; emit?:boolean }
export interface ValidationOptions { filtered?:boolean; name?:string|undefined }
const require = createRequire(import.meta.url)

const countKeys = ['tests', 'passed', 'failed', 'cancelled', 'skipped', 'todo', 'suites', 'topLevel'] as const
const statusKeys = ['passed','failed','cancelled','skipped','todo'] as const
function validCounts(value:unknown):value is TestCounts {
  return isRecord(value)&&countKeys.every(key=>typeof value[key]==='number'&&Number.isSafeInteger(value[key])&&value[key]>=0)
}
function validLocation(row:Record<string,unknown>):boolean {
  return (typeof row.file === 'string' || row.file === null)
    && (row.line === null || (typeof row.line==='number'&&Number.isSafeInteger(row.line) && row.line > 0))
    && (row.column === null || (typeof row.column==='number'&&Number.isSafeInteger(row.column) && row.column > 0))
}
function validCase(value:unknown):value is CaseRecord {
  return isRecord(value)&&typeof value.name==='string'&&(value.kind==='test'||value.kind==='suite')
    &&statusKeys.some(status=>value.status===status)&&validLocation(value)
    &&typeof value.durationMs==='number'&&Number.isFinite(value.durationMs)&&value.durationMs>=0
}
function validFailure(value:unknown):value is FailureRecord {
  return isRecord(value)&&typeof value.name==='string'&&validLocation(value)&&typeof value.message==='string'&&typeof value.stack==='string'
}
function assertReportShape(report:unknown):asserts report is TestReport {
  if (!isRecord(report)||report.version !== 1 || report.nodeVersion !== process.versions.node || typeof report.success !== 'boolean'
    || typeof report.durationMs!=='number'||!Number.isFinite(report.durationMs) || report.durationMs < 0 || !Array.isArray(report.cases) || !Array.isArray(report.failures))
    throw Error('Invalid structured test summary')
  if(!validCounts(report.counts))throw Error('Invalid case counts')
  if(!report.cases.every(validCase))throw Error('Invalid case records')
  if(!report.failures.every(validFailure))throw Error('Invalid failure records')
}
export function validateReport(report:unknown, processResult:Pick<ProcessResult,'code'>, { filtered = false, name }:ValidationOptions = {}):number {
  assertReportShape(report)
  const counts = report.counts
  if (counts.tests !== counts.passed + counts.failed + counts.cancelled + counts.skipped + counts.todo)
    throw Error('Inconsistent case counts')
  const cases = report.cases.filter(row => row.kind !== 'suite')
  for (const key of statusKeys) {
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
export async function executeSuites(selected:readonly TestSuite[], { name, timeoutMs = 60_000, maxBytes = 32 * 1024 * 1024,
  executable = process.execPath, emit = true }:RunnerOptions = {}):Promise<Outcome> {
  const scratch = mkdtempSync(join(tmpdir(), 'bilicdn-v2-tests-'))
  const results:SuiteResult[] = [], started = performance.now()
  let cleanupError:string|undefined
  try {
    for (const [index, suite] of selected.entries()) {
      const outfile = join(scratch, `${index}.mjs`), summaryFile = join(scratch, `${index}.json`)
      const result:SuiteResult = { suite: suite.name, phase: 'build', success: false }
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
          `--test-reporter=${pathToFileURL(resolve('scripts/test-reporter.mts')).href}`, `--test-reporter-destination=${summaryFile}`]
        if (name !== undefined) args.push(`--test-name-pattern=${name}`)
        args.push(outfile)
        result.process = await supervise(executable, args, { timeoutMs, maxBytes })
        if (emit) { process.stdout.write(result.process.stdout); process.stderr.write(result.process.stderr) }
        if (result.process.error || result.process.reason || result.process.signal)
          throw Error(result.process.error ?? `Suite stopped: ${result.process.reason ?? result.process.signal}`)
        result.phase = 'report'
        const report:unknown = JSON.parse(readFileSync(summaryFile, 'utf8'))
        assertReportShape(report)
        result.report = report
        result.executed = validateReport(result.report, result.process, { filtered: name !== undefined, name })
        result.success = true
      } catch (error) {
        result.error = errorMessage(error)
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
    } catch (error) { cleanupError = errorMessage(error) }
  }
  return { results, cleanupError, durationMs: performance.now() - started }
}

export function finishOutcome(outcome:Outcome):number {
  const failures = outcome.results.filter(result => !result.success)
  if (failures.length || outcome.cleanupError) {
    const causes = failures.map(result => Error(`${result.suite} (${result.phase}): ${result.error}`))
    if (outcome.cleanupError) causes.push(Error(`Scratch cleanup: ${outcome.cleanupError}`))
    const error = Object.assign(new AggregateError(causes, 'Test suites failed'), {outcome})
    throw error
  }
  const executed = outcome.results.reduce((count, result) => count + (result.executed??0), 0)
  if (!executed) throw new UsageError('No cases matched --name')
  return executed
}

export async function runTests(filter = '', options:RunnerOptions = {}):Promise<Outcome> {
  const selected = selection(filter) // Validate before allocating a scratch directory.
  if (options.name !== undefined) { try { new RegExp(options.name) } catch { throw new UsageError('Invalid case expression') } }
  const outcome = await executeSuites(selected, options)
  const executed = finishOutcome(outcome)
  process.stdout.write(`Contract cases: ${executed}; total ${outcome.durationMs.toFixed(1)} ms\n`)
  return outcome
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/test.mts')) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.list) for (const row of selection()) console.log(`${row.name}\t${row.source}`)
    else await runTests(options.filter, options)
  } catch (error) {
    console.error(errorMessage(error))
    if (error instanceof AggregateError) for (const cause of error.errors) console.error(errorMessage(cause))
    if (error instanceof UsageError) console.error('Usage: npm test -- [suite] [--name regex] | --list')
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}
