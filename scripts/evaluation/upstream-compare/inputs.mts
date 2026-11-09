import { readFileSync } from 'node:fs'
import { ArchiveStorage, parseArchiveBundles } from '../../lib/archive-storage.mts'
import { checkSource } from './model.mts'
import { type Version } from './model.mts'

export const inputs = [
  {
    version: '1.3.4',
    path: 'baseline/BiliCDN_TW_1.3.4.original.user.js',
    bytes: 305346,
    sha256: 'acaa3d61c169a0a39ef403d7442e1decc1b20540ea9ada3e8cf5e459bb88f579',
  },
  {
    version: '2.1.27',
    path: 'archive/retired/releases/Release/v2.1.27/BiliCDN_TW.user.js',
    bytes: 382934,
    sha256: '1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795',
  },
] as const
export async function loadInput(version: Version): Promise<string> {
  const input = inputs.find((e) => e.version === version)!
  let bytes: Buffer
  if (input.path.startsWith('archive/')) {
    const manifest = JSON.parse(readFileSync('archive/relocation-manifest.json', 'utf8'))
    const bundles = parseArchiveBundles(manifest.bundles).filter((bundle) =>
      bundle.files.some((file) => file.path === input.path),
    )
    if (bundles.length !== 1)
      throw Error('Immutable comparison input location is ambiguous or missing')
    const storage = await ArchiveStorage.open(process.cwd(), bundles, {
      metadataPaths: new Set([input.path]),
    })
    bytes = storage.read(input.path)
  } else bytes = readFileSync(input.path)
  checkSource(bytes, input.bytes, input.sha256)
  return bytes.toString('utf8')
}
export async function commonHosts(): Promise<readonly string[]> {
  const original = await loadInput('1.3.4'),
    current = await loadInput('2.1.27')
  const list = (source: string, name: string): string[] => {
    const block = new RegExp(`${name} = (?:Object\\.freeze\\()?\\[([\\s\\S]*?)\\]`).exec(
      source,
    )?.[1]
    if (!block) throw Error('Comparison catalogue calibration failed')
    return [...block.matchAll(/['"]([a-z0-9-]+\.bilivideo\.com)['"]/g)].map((e) => e[1]!)
  }
  const raw = list(original, 'PREFERRED_CDN_LIST_RAW'),
    trusted = list(current, 'TRUSTED_CATALOG')
  const unavailable = new Set([
    'upos-sz-mirrorcosov.bilivideo.com',
    'upos-sz-mirrorhwov.bilivideo.com',
    'upos-sz-mirrorhw.bilivideo.com',
    'upos-hz-mirroraliov.bilivideo.com',
  ])
  const common = [...new Set(raw)]
    .filter((host) => trusted.includes(host) && !unavailable.has(host))
    .sort()
    .slice(0, 2)
  if (common.length !== 2) throw Error('Insufficient common legal hosts')
  return Object.freeze(common)
}
