import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  symlinkSync,
  linkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { ArchiveStorage, parseArchiveBundles } from '../../../scripts/lib/archive-storage.mts'
import { archiveCli, checkArchive, readTarArchive } from '../../../scripts/checks/archive-check.mts'
import { archiveProof, archiveTarFile, writePackedArchive } from '../../support/archive-packing.ts'
import { testScope } from '../../support/scope.ts'

function resources(t: TestContext) {
  const scope = testScope(t),
    root = mkdtempSync(resolve(tmpdir(), 'bilicdn-compressed-'))
  scope.defer(() => rmSync(root, { recursive: true }))
  const write = (path: string, body: string | Uint8Array) => {
    mkdirSync(dirname(resolve(root, path)), { recursive: true })
    writeFileSync(resolve(root, path), body)
  }
  return { root, write }
}
const logical = 'archive/retired/releases/Release/v1.0.0/BiliCDN_TW.user.js'
const body = 'immutable\r\nbytes\0remain\r\n'

test('archive compression preserves original bytes and repeated reads without filesystem mutation', async (t) => {
  const f = resources(t),
    bundle = writePackedArchive(f.root, [[logical, body]])
  const before = readFileSync(resolve(f.root, bundle.path))
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([bundle]))
  assert.deepEqual(storage.read(logical), Buffer.from(body))
  assert.deepEqual(storage.read(logical), Buffer.from(body))
  assert.deepEqual(storage.proof(logical), archiveProof(body))
  assert.equal(storage.has(logical), true)
  assert.deepEqual(readFileSync(resolve(f.root, bundle.path)), before)
  assert.deepEqual(readdirSync(f.root), ['archive'])
})

for (const reason of [
  'compressed hash',
  'compressed size',
  'tar size',
  'file hash',
  'file size',
  'inventory hash',
])
  test(`archive compression rejects ${reason}`, async (t) => {
    const f = resources(t),
      bundle = writePackedArchive(f.root, [[logical, body]])
    if (reason === 'compressed hash') bundle.sha256 = '0'.repeat(64)
    if (reason === 'compressed size') bundle.bytes++
    if (reason === 'tar size') bundle.tarBytes--
    if (reason === 'file hash') bundle.files[0]!.sha256 = '0'.repeat(64)
    if (reason === 'file size') bundle.files[0]!.bytes++
    if (reason === 'inventory hash') bundle.inventory.sha256 = '0'.repeat(64)
    await assert.rejects(() => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])))
  })

for (const name of [
  '../escape',
  '/absolute',
  'C:/escape',
  'payload/../escape',
  'payload/x:stream',
  'payload/a.',
  'payload/CON',
])
  test(`archive compression rejects unsafe member ${name}`, async (t) => {
    const f = resources(t)
    const bundle = writePackedArchive(f.root, [[logical, body]], {
      tarEntries: [archiveTarFile(name, body)],
    })
    await assert.rejects(() => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])), /Unsafe/)
  })

for (const type of ['1', '2'])
  test(`archive compression rejects link type ${type}`, async (t) => {
    const f = resources(t)
    const bundle = writePackedArchive(f.root, [[logical, body]], {
      tarEntries: [archiveTarFile(`payload/${logical}`, body, type)],
    })
    await assert.rejects(
      () => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])),
      /type|link/i,
    )
  })

for (const mode of ['missing', 'extra', 'duplicate'])
  test(`archive compression rejects ${mode} members`, async (t) => {
    const f = resources(t),
      file = archiveTarFile(`payload/${logical}`, body)
    const tarEntries =
      mode === 'missing'
        ? []
        : mode === 'extra'
          ? [file, archiveTarFile('payload/archive/extra', 'extra')]
          : [file, file]
    const bundle = writePackedArchive(f.root, [[logical, body]], { tarEntries })
    await assert.rejects(() => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])))
  })

test('archive compression rejects mismatched internal inventory', async (t) => {
  const f = resources(t)
  const bundle = writePackedArchive(f.root, [[logical, body]], {
    inventory: '{"schemaVersion":1,"files":[]}',
  })
  await assert.rejects(
    () => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])),
    /inventory/i,
  )
})

for (const mode of ['truncated', 'corrupt', 'trailing gzip'])
  test(`archive compression rejects ${mode}`, async (t) => {
    const f = resources(t),
      bundle = writePackedArchive(f.root, [[logical, body]])
    const bytes = readFileSync(resolve(f.root, bundle.path))
    const altered =
      mode === 'truncated'
        ? bytes.subarray(0, bytes.length - 6)
        : mode === 'trailing gzip'
          ? Buffer.concat([bytes, gzipSync('unexpected')])
          : Buffer.from(bytes)
    if (mode === 'corrupt') altered[altered.length - 5]! ^= 1
    f.write(bundle.path, altered)
    Object.assign(bundle, archiveProof(altered))
    await assert.rejects(() => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])))
  })

test('archive compression rejects duplicate bundle identities and case-folded logical paths', () => {
  const bundle = {
    path: 'archive/retired/bundles/test.tar.gz',
    ...archiveProof('gzip'),
    tarBytes: 1024,
    inventory: { path: '_archive-manifests/test.json', ...archiveProof('{}') },
    files: [{ path: logical, ...archiveProof(body) }],
  }
  assert.throws(() => parseArchiveBundles([bundle, bundle]), /duplicate/i)
  assert.throws(
    () =>
      parseArchiveBundles([
        {
          ...bundle,
          files: [...bundle.files, { path: logical.toUpperCase(), ...archiveProof(body) }],
        },
      ]),
    /duplicate/i,
  )
})

test('archive compression keeps private large payloads out of captured buffers', async (t) => {
  const f = resources(t),
    path = 'archive/retired/local/old/private.dat',
    data = Buffer.alloc(2 * 1024 * 1024, 37)
  const bundle = writePackedArchive(f.root, [[path, data]], { private: true })
  assert.throws(() => parseArchiveBundles([bundle]), /private/i)
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([bundle], true), {
    private: true,
  })
  assert.deepEqual(storage.proof(path), archiveProof(data))
  assert.throws(() => storage.read(path), /captur|private/i)
  assert.ok(storage.capturedBytes < 1024)
})

test('archive compression validates restored files missing changed and extra without writing', async (t) => {
  const f = resources(t),
    bundle = writePackedArchive(f.root, [[logical, body]])
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([bundle]))
  const restore = resolve(f.root, 'restored')
  mkdirSync(restore)
  await assert.rejects(() => storage.verifyRestore(restore), /missing/i)
  f.write(`restored/payload/${logical}`, 'changed')
  await assert.rejects(() => storage.verifyRestore(restore), /SHA|bytes/i)
  f.write(`restored/payload/${logical}`, body)
  await assert.rejects(() => storage.verifyRestore(restore), /missing/i)
  f.write(
    `restored/${bundle.inventory.path}`,
    JSON.stringify({ schemaVersion: 1, files: bundle.files }),
  )
  await storage.verifyRestore(restore)
  f.write('restored/payload/extra', 'extra')
  await assert.rejects(() => storage.verifyRestore(restore), /extra|unregistered/i)
  assert.equal(readFileSync(resolve(restore, 'payload', logical), 'utf8'), body)
})

test('archive compression rejects a linked restore root', async (t) => {
  const f = resources(t),
    bundle = writePackedArchive(f.root, [[logical, body]])
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([bundle]))
  mkdirSync(resolve(f.root, 'actual'))
  symlinkSync(resolve(f.root, 'actual'), resolve(f.root, 'linked'), 'junction')
  await assert.rejects(() => storage.verifyRestore(resolve(f.root, 'linked')), /link/i)
})

test('archive schema 2 checks compressed original and restore-root through the existing CLI', async (t) => {
  const f = resources(t),
    bundle = writePackedArchive(f.root, [[logical, body]])
  const snapshot = Buffer.alloc(1024)
  f.write('archive/before.tar', snapshot)
  f.write('release.json', '{"version":"2.2.16","artifactName":"BiliCDN_TW.user.js"}')
  f.write('docs/doc-manifest.json', '{"documents":[]}')
  f.write(
    'archive/relocation-manifest.json',
    JSON.stringify({
      schemaVersion: 2,
      baseline: 'a'.repeat(40),
      snapshot: { path: 'archive/before.tar', ...archiveProof(snapshot) },
      entries: [
        {
          originalPath: 'Release/v1.0.0/BiliCDN_TW.user.js',
          archivedPath: logical,
          kind: 'release',
          encoding: 'raw',
          ...archiveProof(body),
          archivedBytes: Buffer.byteLength(body),
          archivedSha256: archiveProof(body).sha256,
        },
      ],
      removedPaths: [],
      appendOnly: [],
      unchangedFiles: [],
      historicalReferences: [],
      localManifest: 'archive/retired/local/2026-11-09-compaction/private-manifest.json',
      bundles: [bundle],
    }),
  )
  assert.equal((await checkArchive(f.root)).success, true)
  f.write(`restored/payload/${logical}`, body)
  f.write(
    `restored/${bundle.inventory.path}`,
    JSON.stringify({ schemaVersion: 1, files: bundle.files }),
  )
  const cli = await archiveCli(['--json', '--restore-root', resolve(f.root, 'restored')], f.root)
  assert.equal(cli.exitCode, 0)
  assert.equal(JSON.parse(cli.output).restoreChecked, true)
  for (const args of [
    ['--restore-root'],
    ['--restore-root', '--json'],
    ['--restore-root', 'one', '--restore-root', 'two'],
  ])
    assert.equal((await archiveCli(args, f.root)).exitCode, 2)
})

test('archive compression rejects restored hard links and extra empty directories', async (t) => {
  const f = resources(t),
    bundle = writePackedArchive(f.root, [[logical, body]])
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([bundle]))
  f.write('source', body)
  mkdirSync(dirname(resolve(f.root, 'restored/payload', logical)), { recursive: true })
  linkSync(resolve(f.root, 'source'), resolve(f.root, 'restored/payload', logical))
  f.write(
    `restored/${bundle.inventory.path}`,
    JSON.stringify({ schemaVersion: 1, files: bundle.files }),
  )
  await assert.rejects(() => storage.verifyRestore(resolve(f.root, 'restored')), /link/i)
  rmSync(resolve(f.root, 'restored/payload', logical))
  f.write(`restored/payload/${logical}`, body)
  mkdirSync(resolve(f.root, 'restored/payload/extra-empty'))
  await assert.rejects(() => storage.verifyRestore(resolve(f.root, 'restored')), /extra/i)
})

function privateRecords(t: TestContext) {
  const f = resources(t),
    path = 'archive/retired/local/old/evidence.json'
  const bundle = writePackedArchive(f.root, [[path, '{"evidence":true}']], { private: true })
  const indexPath = 'archive/retired/local/2026-11-09-compaction/private-manifest.json'
  const index = {
    schemaVersion: 2,
    baseline: 'a'.repeat(40),
    root: 'archive',
    bundles: [bundle],
    records: [{ path, ...archiveProof('{"evidence":true}'), disposition: 'packed' }],
    removed: [] as { path: string; bytes: number; sha256: string; proof: string }[],
  }
  const snapshot = Buffer.alloc(1024)
  f.write('archive/before.tar', snapshot)
  f.write('release.json', '{"version":"2.2.16","artifactName":"BiliCDN_TW.user.js"}')
  f.write('docs/doc-manifest.json', '{"documents":[]}')
  f.write('.gitignore', 'archive/retired/local/\n')
  execFileSync('git', ['init', '-q'], { cwd: f.root })
  const save = () => {
    const bytes = JSON.stringify(index)
    f.write(indexPath, bytes)
    f.write(
      'archive/relocation-manifest.json',
      JSON.stringify({
        schemaVersion: 2,
        baseline: 'a'.repeat(40),
        snapshot: { path: 'archive/before.tar', ...archiveProof(snapshot) },
        entries: [],
        removedPaths: [],
        appendOnly: [],
        unchangedFiles: [],
        historicalReferences: [],
        bundles: [],
        localManifest: indexPath,
        localManifestProof: archiveProof(bytes),
      }),
    )
  }
  save()
  return { ...f, path, bundle, index, indexPath, save }
}

test('archive schema 2 private mode confirms sealed records without public payload access', async (t) => {
  const f = privateRecords(t)
  const checked = await checkArchive(f.root, { local: true })
  assert.equal(checked.success, true, JSON.stringify(checked.findings))
  assert.equal(checked.localFiles, 1)
  f.write(f.indexPath, 'private index is unavailable')
  const publicOnly = await checkArchive(f.root)
  assert.equal(publicOnly.success, true)
  assert.equal(publicOnly.localChecked, false)
  assert.equal(JSON.stringify(publicOnly).includes('evidence.json'), false)
  assert.equal((await checkArchive(f.root, { local: true })).success, false)
})

for (const mode of [
  'index changed',
  'original retained',
  'record missing',
  'wrong disposition',
  'proof missing',
])
  test(`archive schema 2 private mode rejects ${mode}`, async (t) => {
    const f = privateRecords(t)
    if (mode === 'index changed')
      f.write(f.indexPath, JSON.stringify({ ...f.index, baseline: 'b'.repeat(40) }))
    if (mode === 'original retained') f.write(f.path, '{"evidence":true}')
    if (mode === 'record missing') {
      f.index.records = []
      f.save()
    }
    if (mode === 'wrong disposition') {
      f.index.records[0]!.disposition = 'kept'
      f.save()
    }
    if (mode === 'proof missing') {
      f.index.removed.push({
        path: 'archive/retired/local/old/copy',
        ...archiveProof('copy'),
        proof: 'archive/retired/local/old/missing-proof',
      })
      f.save()
    }
    assert.equal((await checkArchive(f.root, { local: true })).success, false)
  })

test('archive compression rejects unsafe PAX override and accepts valid long UTF-8 paths', async (t) => {
  const f = resources(t)
  const pax = (path: string) => {
    const suffix = ` path=${path}\n`
    let size = Buffer.byteLength(suffix) + 1
    while (String(size).length + Buffer.byteLength(suffix) !== size)
      size = String(size).length + Buffer.byteLength(suffix)
    return `${size}${suffix}`
  }
  const path = 'archive/retired/docs/' + 'long/'.repeat(20) + '中文.txt'
  const good = writePackedArchive(f.root, [[path, body]], {
    tarEntries: [
      archiveTarFile('././@PaxHeader', pax('payload/' + path), 'x'),
      archiveTarFile('short', body),
    ],
  })
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([good]))
  assert.equal(storage.read(path).toString(), body)
  const bad = writePackedArchive(f.root, [[logical, body]], {
    name: 'bad',
    tarEntries: [
      archiveTarFile('././@PaxHeader', pax('../escape'), 'x'),
      archiveTarFile('short', body),
    ],
  })
  await assert.rejects(() => ArchiveStorage.open(f.root, parseArchiveBundles([bad])), /Unsafe/)
})

test('archive compression can be retried after an interrupted build without reviving partial state', async (t) => {
  const f = resources(t),
    bundle = writePackedArchive(f.root, [[logical, body]])
  const bytes = readFileSync(resolve(f.root, bundle.path))
  f.write(bundle.path, bytes.subarray(0, bytes.length - 1))
  await assert.rejects(() => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])))
  f.write(bundle.path, bytes)
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([bundle]))
  assert.deepEqual(storage.read(logical), Buffer.from(body))
})

test('archive schema 2 removed copies require matching sealed reconstruction entries', async (t) => {
  const f = privateRecords(t),
    path = 'archive/retired/local/old/copy.json',
    proof = 'archive/retired/local/old/reconstruction.json'
  const ledger = {
    schemaVersion: 1,
    baseline: 'a'.repeat(40),
    removed: [
      { path, ...archiveProof('{"evidence":true}'), method: { kind: 'duplicate', source: f.path } },
    ],
  }
  const body = JSON.stringify(ledger)
  f.index.bundles.push(
    writePackedArchive(f.root, [[proof, body]], { private: true, name: 'proof' }),
  )
  f.index.records.push({ path: proof, ...archiveProof(body), disposition: 'packed' })
  f.index.removed.push({ path, ...archiveProof('{"evidence":true}'), proof })
  f.save()
  const report = await checkArchive(f.root, { local: true })
  assert.equal(report.success, true, JSON.stringify(report.findings))
  assert.equal(report.reconstructedFiles, 1)
  f.index.removed[0]!.sha256 = '0'.repeat(64)
  f.save()
  const invalid = await checkArchive(f.root, { local: true })
  assert.ok(invalid.findings.some((row) => row.message.includes('removed bytes')))
})

for (const repin of [false, true])
  test(`archive schema 2 rejects private schema downgrade with proof repinned ${repin}`, async (t) => {
    const f = privateRecords(t)
    const downgraded = JSON.stringify({
      schemaVersion: 1,
      baseline: f.index.baseline,
      root: dirname(f.indexPath).replaceAll('\\', '/'),
      entries: [],
    })
    f.write(f.indexPath, downgraded)
    if (repin) {
      const manifest = JSON.parse(
        readFileSync(resolve(f.root, 'archive/relocation-manifest.json'), 'utf8'),
      )
      manifest.localManifestProof = archiveProof(downgraded)
      f.write('archive/relocation-manifest.json', JSON.stringify(manifest))
    }
    const result = await checkArchive(f.root, { local: true })
    assert.equal(result.success, false)
    assert.ok(result.findings.some((row) => /proof|SHA|schema/i.test(row.message)))
  })

function paxField(name: string, value: string): string {
  const suffix = ` ${name}=${value}\n`
  let size = Buffer.byteLength(suffix) + 1
  while (String(size).length + Buffer.byteLength(suffix) !== size)
    size = String(size).length + Buffer.byteLength(suffix)
  return `${size}${suffix}`
}

for (const field of ['SCHILY.filetype', 'GNU.sparse.realsize', 'unknown.format'])
  test(`archive PAX rejects unsupported interpretation field ${field}`, async (t) => {
    const f = resources(t)
    const entries = [
      archiveTarFile('PaxHeader', paxField(field, '1'), 'x'),
      archiveTarFile(`payload/${logical}`, body),
    ]
    const bundle = writePackedArchive(f.root, [[logical, body]], { tarEntries: entries })
    await assert.rejects(
      () => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])),
      /PAX|sparse/i,
    )
    assert.throws(
      () => readTarArchive(Buffer.concat([...entries, Buffer.alloc(1024)])),
      /PAX|sparse/i,
    )
  })

test('archive PAX rejects overwritten local extension headers', async (t) => {
  const f = resources(t)
  const entries = [
    archiveTarFile('FirstPaxHeader', paxField('path', '../invalid'), 'x'),
    archiveTarFile('SecondPaxHeader', paxField('path', `payload/${logical}`), 'x'),
    archiveTarFile('short', body),
  ]
  const bundle = writePackedArchive(f.root, [[logical, body]], { tarEntries: entries })
  await assert.rejects(() => ArchiveStorage.open(f.root, parseArchiveBundles([bundle])), /PAX/i)
  assert.throws(() => readTarArchive(Buffer.concat([...entries, Buffer.alloc(1024)])), /PAX/i)
})

test('archive PAX retains passive timestamps and Git comments without altering payload bytes', async (t) => {
  const f = resources(t)
  const entries = [
    archiveTarFile('GlobalPaxHeader', paxField('comment', 'a'.repeat(40)), 'g'),
    archiveTarFile(
      'LocalPaxHeader',
      paxField('mtime', '0') + paxField('path', `payload/${logical}`),
      'x',
    ),
    archiveTarFile('short', body),
  ]
  const bundle = writePackedArchive(f.root, [[logical, body]], { tarEntries: entries })
  const storage = await ArchiveStorage.open(f.root, parseArchiveBundles([bundle]))
  assert.deepEqual(storage.read(logical), Buffer.from(body))
  assert.deepEqual(
    readTarArchive(Buffer.concat([...entries, Buffer.alloc(1024)])).get(`payload/${logical}`),
    Buffer.from(body),
  )
})
