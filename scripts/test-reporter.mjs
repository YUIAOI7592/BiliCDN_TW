import { findSourceMap } from 'node:module'
export const REPORT_VERSION = 1
function position(data) {
  const mapped = data.file && data.line && findSourceMap(data.file)?.findEntry(data.line - 1, (data.column ?? 1) - 1)
  if (mapped?.originalSource) return { file: mapped.originalSource, line: mapped.originalLine + 1, column: mapped.originalColumn + 1 }
  return { file: data.file ?? null, line: data.line ?? null, column: data.column ?? null }
}

// Node's event stream is the machine contract; spec output is only for people.
export default async function* report(events) {
  const failures = [], cases = []
  let summary = null
  for await (const { type, data } of events) {
    if (type === 'test:pass' || type === 'test:fail') {
      const error = data.details?.error
      const cause = error?.cause ?? error
      const row = { name: data.name, ...position(data), kind: data.details?.type ?? 'test',
        status: data.skip ? 'skipped' : data.todo ? 'todo' : type === 'test:pass' ? 'passed' :
          ['cancelledByParent','testTimeoutFailure','testAborted'].includes(error?.failureType) ? 'cancelled' : 'failed',
        durationMs: data.details?.duration_ms ?? 0 }
      cases.push(row)
      if (type === 'test:fail') failures.push({ ...row, message: cause?.message ?? error?.message ?? 'Test failed', stack: cause?.stack ?? error?.stack ?? '' })
    }
    if (type === 'test:summary' && !data.file) summary = data
  }
  if (!summary) throw Error('Missing final test:summary event')
  yield JSON.stringify({ version: REPORT_VERSION, nodeVersion: process.versions.node, counts: summary.counts,
    durationMs: summary.duration_ms, success: summary.success, cases, failures }) + '\n'
}
