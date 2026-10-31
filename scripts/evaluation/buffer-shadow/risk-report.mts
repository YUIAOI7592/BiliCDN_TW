import { measureRiskCoverage } from './risk-coverage.mts'
import { auditRouteObservability } from './actionability.mts'
import type { LiveWindow } from './live-report.mts'

export function riskCoverageReport(windows: readonly LiveWindow[]) {
  const totals = {
    above10: 0,
    fourTo10: 0,
    oneTo4: 0,
    zeroTo1: 0,
    zero: 0,
    missingMs: 0,
    insufficientMs: 0,
    ineligibleMs: 0,
    progressMs: 0,
    candidateMs: 0,
  }
  const results = windows.map((w) => {
    if (w.validity !== 'valid') return { id: w.id, validity: w.validity, coverage: null }
    const coverage = measureRiskCoverage(w.rows, { from: w.scoreFrom, until: w.scoreFrom + 300000 })
    for (const key of Object.keys(coverage.bands) as (keyof typeof coverage.bands)[])
      totals[key] += coverage.bands[key]
    for (const key of [
      'missingMs',
      'insufficientMs',
      'ineligibleMs',
      'progressMs',
      'candidateMs',
    ] as const)
      totals[key] += coverage[key]
    return { id: w.id, validity: w.validity, coverage }
  })
  return {
    schemaVersion: 1 as const,
    method: 'left-sample-interval',
    totals,
    windows: results,
    utilityCoverage:
      totals.oneTo4 > 0
        ? 'exposure-present-effectiveness-unproven'
        : 'not-exposed-to-actionable-buffer',
    alternativeObservability: auditRouteObservability(null),
    limitations: [
      'Exposure is not candidate sensitivity or a causal route benefit.',
      'Sample intervals are not continuous media measurements.',
      'Legacy alternative flags and cached ranking cannot supply missing fresh qualification.',
    ],
  }
}
