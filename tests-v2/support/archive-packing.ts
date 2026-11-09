import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

export const archiveProof = (bytes: string | Uint8Array) => ({
  bytes: Buffer.byteLength(bytes),
  sha256: createHash('sha256').update(bytes).digest('hex'),
})
export function archiveTarFile(name: string, body: string | Uint8Array, type = '0'): Buffer {
  const data = Buffer.from(body),
    header = Buffer.alloc(512)
  header.write(name, 0, 100)
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124)
  header.write('00000000000\0', 136)
  header.fill(32, 148, 156)
  header.write(type, 156)
  header.write('ustar\0', 257)
  const checksum = [...header].reduce((sum, byte) => sum + byte, 0)
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148)
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)])
}
export function writePackedArchive(
  root: string,
  files: readonly [string, string | Uint8Array][],
  options: { private?: boolean; tarEntries?: Buffer[]; inventory?: string; name?: string } = {},
) {
  const rows = files.map(([path, body]) => ({ path, ...archiveProof(body) }))
  const inventory = options.inventory ?? JSON.stringify({ schemaVersion: 1, files: rows })
  const inventoryPath = `_archive-manifests/${options.private ? 'private-' : ''}${options.name ?? 'test'}.json`
  const tar = Buffer.concat([
    archiveTarFile(inventoryPath, inventory),
    ...(options.tarEntries ?? files.map(([path, body]) => archiveTarFile(`payload/${path}`, body))),
    Buffer.alloc(1024),
  ])
  const compressed = gzipSync(tar)
  const path = `${options.private ? 'archive/retired/local/bundles' : 'archive/retired/bundles'}/${options.name ?? 'test'}.tar.gz`
  mkdirSync(dirname(resolve(root, path)), { recursive: true })
  writeFileSync(resolve(root, path), compressed)
  return {
    path,
    ...archiveProof(compressed),
    tarBytes: tar.length,
    inventory: { path: inventoryPath, ...archiveProof(inventory) },
    files: rows,
  }
}
