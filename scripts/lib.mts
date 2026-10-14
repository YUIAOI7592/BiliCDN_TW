import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import type { SpawnSyncOptionsWithStringEncoding } from 'node:child_process'
export const sha256 = (value: Parameters<ReturnType<typeof createHash>['update']>[0]) =>
  createHash('sha256').update(value).digest('hex')
export const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
export interface ReleaseConfig {
  version: string
  artifactName: string
  nodeVersion: string
  npmVersion: string
  typescriptVersion: string
  esbuildVersion: string
}
export function readRelease(): ReleaseConfig {
  const value = readJson('release.json')
  if (
    !isRecord(value) ||
    typeof value.version !== 'string' ||
    typeof value.artifactName !== 'string' ||
    typeof value.nodeVersion !== 'string' ||
    typeof value.npmVersion !== 'string' ||
    typeof value.typescriptVersion !== 'string' ||
    typeof value.esbuildVersion !== 'string'
  )
    throw Error('Invalid release configuration')
  return {
    version: value.version,
    artifactName: value.artifactName,
    nodeVersion: value.nodeVersion,
    npmVersion: value.npmVersion,
    typescriptVersion: value.typescriptVersion,
    esbuildVersion: value.esbuildVersion,
  }
}
export function errorMessage(error: unknown): string {
  return isRecord(error) && typeof error.message === 'string' ? error.message : String(error)
}
export function command(
  command: string,
  args: readonly string[],
  options: Omit<SpawnSyncOptionsWithStringEncoding, 'encoding'> = {},
) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`)
  return result.stdout
}
export function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))
    .sort()
}
