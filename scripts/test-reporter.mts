import { findSourceMap } from 'node:module'
import type { EventData } from 'node:test'
import type { TestEvent } from 'node:test/reporters'
import type { CaseRecord, FailureRecord, ReportLocation } from './test.mts'
import { isRecord } from './lib.mts'
export const REPORT_VERSION = 1
function position(data:EventData.TestPass|EventData.TestFail):ReportLocation {
  const mapped = data.file && data.line ? findSourceMap(data.file)?.findEntry(data.line - 1, (data.column ?? 1) - 1):undefined
  if (isRecord(mapped)&&typeof mapped.originalSource==='string'&&mapped.originalSource&&typeof mapped.originalLine==='number'&&typeof mapped.originalColumn==='number') return { file: mapped.originalSource, line: mapped.originalLine + 1, column: mapped.originalColumn + 1 }
  return { file: data.file ?? null, line: data.line ?? null, column: data.column ?? null }
}

// Node's event stream is the machine contract; spec output is only for people.
export default async function* report(events:AsyncIterable<TestEvent>):AsyncGenerator<string> {
  const failures:FailureRecord[] = [], cases:CaseRecord[] = []
  let summary:EventData.TestSummary|null = null
  for await (const { type, data } of events) {
    if (type === 'test:pass' || type === 'test:fail') {
      const error = type==='test:fail'?data.details?.error:undefined
      const cause = error?.cause ?? error
      const failureType=error&&'failureType' in error?error.failureType:undefined
      const row:CaseRecord = { name: data.name, ...position(data), kind: data.details?.type ?? 'test',
        status: data.skip ? 'skipped' : data.todo ? 'todo' : type === 'test:pass' ? 'passed' :
          typeof failureType==='string'&&['cancelledByParent','testTimeoutFailure','testAborted'].includes(failureType) ? 'cancelled' : 'failed',
        durationMs: data.details?.duration_ms ?? 0 }
      cases.push(row)
      if (type === 'test:fail') failures.push({ ...row, message: isRecord(cause)&&typeof cause.message==='string'?cause.message:error?.message ?? 'Test failed', stack: isRecord(cause)&&typeof cause.stack==='string'?cause.stack:error?.stack ?? '' })
    }
    if (type === 'test:summary' && !data.file) summary = data
  }
  if (!summary) throw Error('Missing final test:summary event')
  yield JSON.stringify({ version: REPORT_VERSION, nodeVersion: process.versions.node, counts: summary.counts,
    durationMs: summary.duration_ms, success: summary.success, cases, failures }) + '\n'
}
