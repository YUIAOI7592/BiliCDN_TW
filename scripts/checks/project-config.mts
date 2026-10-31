import { join } from 'node:path'
import { isRecord, readJson } from '../lib/lib.mts'

export interface ProjectConfigurationResult {
  readonly success: boolean
  readonly checkedDependencies: number
  readonly findings: readonly string[]
}

/** Checks declared, locked and installed direct tools without running or changing them. */
export function checkProjectConfiguration(root = process.cwd()): ProjectConfigurationResult {
  const findings: string[] = []
  let checkedDependencies = 0
  const record = (value: unknown): value is Record<string, unknown> =>
    isRecord(value) && !Array.isArray(value)
  const read = (path: string): Record<string, unknown> | undefined => {
    try {
      const value = readJson(join(root, path))
      if (record(value)) return value
    } catch {
      // Report the input path, without embedding arbitrary parser or filesystem output.
    }
    findings.push(`${path}: missing or invalid JSON object`)
    return undefined
  }
  const result = (): ProjectConfigurationResult =>
    Object.freeze({
      success: findings.length === 0,
      checkedDependencies,
      findings: Object.freeze(findings),
    })
  const release = read('release.json'),
    pkg = read('package.json'),
    lock = read('package-lock.json')
  if (!release || !pkg || !lock) return result()
  const exactVersion = (value: unknown): value is string =>
    typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value)
  if (!exactVersion(release.version)) findings.push('release.json: invalid product version')
  if (pkg.version !== release.version) findings.push('package.json: product version mismatch')
  if (lock.version !== release.version) findings.push('package-lock.json: product version mismatch')
  if (lock.lockfileVersion !== 3) findings.push('package-lock.json: expected lockfileVersion 3')
  if (
    pkg.dependencies !== undefined &&
    (!record(pkg.dependencies) || Object.keys(pkg.dependencies).length)
  )
    findings.push('package.json: runtime dependencies are not permitted')
  const packages = record(lock.packages) ? lock.packages : undefined
  const lockedRoot = packages && record(packages['']) ? packages[''] : undefined
  const declared = record(pkg.devDependencies) ? pkg.devDependencies : undefined
  const locked =
    lockedRoot && record(lockedRoot.devDependencies) ? lockedRoot.devDependencies : undefined
  if (!declared || !locked || !packages) {
    findings.push(
      'package.json / package-lock.json: missing direct development dependency declarations',
    )
    return result()
  }
  if (lockedRoot?.version !== release.version)
    findings.push('package-lock.json: root product version mismatch')
  for (const name of [...new Set([...Object.keys(declared), ...Object.keys(locked)])].sort()) {
    // Validate before constructing a filesystem path from configuration data.
    if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name)) {
      findings.push(`package.json / package-lock.json: invalid dependency name ${name}`)
      continue
    }
    const expected = declared[name]
    if (!exactVersion(expected)) {
      findings.push(`package.json: ${name} requires an exact version`)
      continue
    }
    if (locked[name] !== expected) findings.push(`package-lock.json: ${name} declaration mismatch`)
    const path = `node_modules/${name}`
    const entry = packages[path]
    if (!record(entry) || entry.version !== expected)
      findings.push(`package-lock.json: ${name} resolved version mismatch`)
    const installed = read(`${path}/package.json`)
    checkedDependencies++
    if (installed && installed.version !== expected)
      findings.push(`${path}/package.json: installed version mismatch`)
  }
  for (const [name, field] of [
    ['typescript', 'typescriptVersion'],
    ['esbuild', 'esbuildVersion'],
  ] as const) {
    if (!exactVersion(release[field]) || release[field] !== declared[name])
      findings.push(`release.json: ${name} tool version mismatch`)
  }
  return result()
}
