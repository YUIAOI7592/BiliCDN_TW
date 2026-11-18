import { isRecord } from '../lib/lib.mts'
import { type SuiteResult } from '../test.mts'

export function validateBusinessContracts(index: unknown, results: readonly SuiteResult[]): number {
  if (!isRecord(index) || !Object.keys(index).length) throw Error('Empty business contract index')
  const passedBySuite = new Map(
    results.map(({ suite, report }) => {
      const names = new Map<string, number>()
      for (const row of report?.cases ?? []) {
        if (row.kind === 'test' && row.status === 'passed')
          names.set(row.name, (names.get(row.name) ?? 0) + 1)
      }
      return [suite, names] as const
    }),
  )
  const ids = new Set<string>()
  for (const [area, contracts] of Object.entries(index)) {
    if (!area.trim() || !Array.isArray(contracts) || !contracts.length)
      throw Error(`Empty business contract area: ${area}`)
    for (const contract of contracts) {
      if (
        !isRecord(contract) ||
        typeof contract.id !== 'string' ||
        !/^[a-z][a-z0-9-]+$/.test(contract.id) ||
        typeof contract.rule !== 'string' ||
        !contract.rule.trim() ||
        !Array.isArray(contract.tests) ||
        !contract.tests.length
      )
        throw Error(`Invalid business contract in area: ${area}`)
      if (ids.has(contract.id)) throw Error(`Duplicate business contract: ${contract.id}`)
      ids.add(contract.id)
      for (const reference of contract.tests) {
        if (
          !Array.isArray(reference) ||
          reference.length !== 2 ||
          typeof reference[0] !== 'string' ||
          typeof reference[1] !== 'string'
        )
          throw Error(`Invalid test reference for business contract: ${contract.id}`)
        const [suite, name] = reference
        const matches = passedBySuite.get(suite)?.get(name) ?? 0
        if (matches !== 1)
          throw Error(
            `${contract.id}: expected one passing case for ${suite} / ${name}; found ${matches}`,
          )
      }
    }
  }
  return ids.size
}
