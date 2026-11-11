import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import {
  archiveCli,
  checkArchive,
  readArchiveManifest,
  readTarArchive,
} from '../../../scripts/checks/archive-check.mts'
import { type ArchiveManifest, type ArchiveEntry } from '../../../scripts/checks/archive-check.mts'
import { testScope } from '../../support/scope.ts'
import { archiveProof as proof, archiveTarFile as tarFile } from '../../support/archive-packing.ts'

const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const privateRoot = 'archive/retired/local/2026-10-20-cleanup'
function tar(files: readonly [string, string | Buffer][]): Buffer {
  return Buffer.concat([...files.map(([file, body]) => tarFile(file, body)), Buffer.alloc(1024)])
}
function pax(key: string, value: string): string {
  const suffix = ` ${key}=${value}\n`
  let size = Buffer.byteLength(suffix) + 1
  while (String(size).length + Buffer.byteLength(suffix) !== size)
    size = String(size).length + Buffer.byteLength(suffix)
  return `${size}${suffix}`
}
function fixture(t: TestContext) {
  const scope = testScope(t),
    root = mkdtempSync(join(tmpdir(), 'bilicdn-archive-'))
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep))
  assert.ok(root.split(sep).at(-1)?.startsWith('bilicdn-archive-'))
  scope.defer(() => rmSync(root, { recursive: true }))
  const write = (file: string, body: string | Buffer) => {
    mkdirSync(resolve(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), body)
  }
  const originals = new Map<string, string | Buffer>()
  const manifest: ArchiveManifest = {
    schemaVersion: 1,
    baseline: 'a'.repeat(40),
    snapshot: { path: 'archive/before.tar', ...proof(tar([])) },
    entries: [],
    removedPaths: [],
    appendOnly: [],
    unchangedFiles: [],
    localManifest: `${privateRoot}/private-manifest.json`,
    historicalReferences: [],
  }
  write('release.json', '{"version":"2.1.27","artifactName":"BiliCDN_TW.user.js"}\n')
  write('docs/doc-manifest.json', '{"documents":[]}\n')
  const save = () => {
    const snapshot = tar([...originals])
    manifest.snapshot = { path: manifest.snapshot.path, ...proof(snapshot) }
    write(manifest.snapshot.path, snapshot)
    write('archive/relocation-manifest.json', JSON.stringify(manifest))
  }
  const relocated = (originalPath: string, archivedPath: string, body: string): ArchiveEntry => {
    const entry: ArchiveEntry = {
      originalPath,
      archivedPath,
      kind: 'record',
      encoding: 'lf',
      ...proof(body),
      archivedBytes: Buffer.byteLength(body),
      archivedSha256: sha(body),
    }
    originals.set(originalPath, body)
    manifest.entries.push(entry)
    write(archivedPath, body)
    return entry
  }
  const check = (local = false) => {
    save()
    return checkArchive(root, { local })
  }
  save()
  return { root, write, manifest, originals, save, relocated, check }
}
function hasRule(report: Awaited<ReturnType<typeof checkArchive>>, rule: string): boolean {
  return report.findings.some((finding) => finding.rule === rule)
}

test('archive accepts a clean source copy without Git or private payload', async (t) => {
  const f = fixture(t)
  f.write(f.manifest.localManifest, 'invalid private content must not be read')
  const result = await f.check()
  assert.equal(result.success, true)
  assert.equal(result.localChecked, false)
})

test('V2214 archive additional private manifests remain unread by public checks', async (t) => {
  const f = fixture(t)
  const path = 'archive/retired/local/2026-11-08-cleanup/private-manifest.json'
  Object.assign(f.manifest, { additionalLocalManifests: [path] })
  f.write(path, 'private content is deliberately not JSON')
  assert.equal((await f.check()).success, true)
  assert.deepEqual(readArchiveManifest(f.root).additionalLocalManifests, [path])
})

for (const paths of [
  ['.work/private-manifest.json'],
  ['archive/retired/local/../private-manifest.json'],
  ['archive/retired/local/new/nested/private-manifest.json'],
  [`${privateRoot}/private-manifest.json`],
  [
    'archive/retired/local/new/private-manifest.json',
    'archive/retired/local/new/private-manifest.json',
  ],
])
  test(`V2214 archive rejects unsafe or duplicate additional manifest ${paths.join(',')}`, async (t) => {
    const f = fixture(t)
    Object.assign(f.manifest, { additionalLocalManifests: paths })
    assert.equal(hasRule(await f.check(), 'manifest'), true)
  })

test('V2214 archive checks every additional private payload and its ownership', async (t) => {
  const f = fixture(t)
  execFileSync('git', ['init', '-q'], { cwd: f.root })
  f.write('.gitignore', '/archive/retired/local/\n')
  f.write(
    f.manifest.localManifest,
    JSON.stringify({
      schemaVersion: 1,
      baseline: f.manifest.baseline,
      root: privateRoot,
      entries: [],
    }),
  )
  const root = 'archive/retired/local/2026-11-08-cleanup'
  const path = `${root}/private-manifest.json`
  const archivedPath = `${root}/old-tool.mts`
  const payload = 'preserved tool\r\n'
  Object.assign(f.manifest, { additionalLocalManifests: [path] })
  f.write(archivedPath, payload)
  const entry = { originalPath: '.work/old-tool.mts', archivedPath, ...proof(payload) }
  const save = (entries = [entry], identity = root) =>
    f.write(
      path,
      JSON.stringify({ schemaVersion: 1, baseline: 'b'.repeat(40), root: identity, entries }),
    )
  save()
  const result = await f.check(true)
  assert.equal(result.success, true)
  assert.equal(result.localFiles, 1)
  f.write(archivedPath, 'corrupted')
  assert.equal(hasRule(await f.check(true), 'private'), true)
  f.write(archivedPath, payload)
  f.write(entry.originalPath, payload)
  assert.equal(hasRule(await f.check(true), 'private'), true)
  rmSync(join(f.root, entry.originalPath))
  save([entry], privateRoot)
  assert.equal(hasRule(await f.check(true), 'private'), true)
  save([{ ...entry, archivedPath: `${privateRoot}/old-tool.mts` }])
  assert.equal(hasRule(await f.check(true), 'private'), true)
  save()
  execFileSync('git', ['add', '-f', '--', archivedPath], { cwd: f.root })
  assert.equal(hasRule(await f.check(true), 'private'), true)
})
test('archive validates raw release and evidence relocation without altering bytes', async (t) => {
  const f = fixture(t)
  for (const kind of ['release', 'evidence'] as const) {
    const body = Buffer.from([0, 255, 13, 10, 17])
    f.manifest.entries.push({
      originalPath: `Release/${kind}.bin`,
      archivedPath: `archive/releases/${kind}.bin`,
      kind,
      encoding: 'raw',
      ...proof(body),
      archivedBytes: body.length,
      archivedSha256: sha(body),
    })
    f.write(`archive/releases/${kind}.bin`, body)
  }
  assert.equal((await f.check()).success, true)
})
test('archive rejects release content drift even when destination hash is rewritten', async (t) => {
  const f = fixture(t),
    entry = f.relocated('docs/old.md', 'archive/old.md', 'original\n')
  entry.kind = 'release'
  f.write(entry.archivedPath, 'changed\n')
  entry.archivedBytes = 8
  entry.archivedSha256 = sha('changed\n')
  assert.equal(hasRule(await f.check(), 'relocation'), true)
})
test('archive rejects a retained original or missing destination', async (t) => {
  const f = fixture(t),
    entry = f.relocated('docs/old.md', 'archive/old.md', 'history\n')
  f.write(entry.originalPath, 'history\n')
  assert.equal(hasRule(await f.check(), 'relocation'), true)
  rmSync(join(f.root, entry.originalPath))
  rmSync(join(f.root, entry.archivedPath))
  assert.equal(hasRule(await f.check(), 'relocation'), true)
})
for (const [name, body, from, to] of [
  [
    'inline encoded Chinese link',
    '[指南](../docs/%E6%8C%87%E5%8D%97.md#中文)\n',
    '../docs/%E6%8C%87%E5%8D%97.md#中文',
    '../guides/指南.md#中文',
  ],
  ['image link', '![圖片](image.png "圖說")\n', 'image.png', '../evidence/image.png'],
  [
    'reference definition',
    '[來源][guide]\n\n[guide]: <guide.md> "標題"\n',
    'guide.md',
    '../guides/guide.md',
  ],
  [
    'duplicate URL second occurrence',
    '[甲](old.md) 與 [乙](old.md)\n',
    'old.md',
    '../records/old.md',
  ],
  [
    'image nested in a link',
    '[![圖片](image.png)](https://example.invalid/)\n',
    'image.png',
    '../evidence/image.png',
  ],
] as const)
  test(`archive permits URL-only ${name}`, async (t) => {
    const f = fixture(t),
      entry = f.relocated('docs/old.md', 'archive/old.md', body)
    const start = name.includes('second') ? body.lastIndexOf(from) : body.indexOf(from)
    const archived = body.slice(0, start) + to + body.slice(start + from.length)
    entry.urlEdits = [{ start, end: start + from.length, from, to }]
    entry.archivedBytes = Buffer.byteLength(archived)
    entry.archivedSha256 = sha(archived)
    f.write(entry.archivedPath, archived)
    assert.equal((await f.check()).success, true)
  })
for (const [name, body, from, to] of [
  ['plain prose', '# Report\n\nold.md text\n', 'old.md', 'changed.md'],
  ['code block', '```md\n[link](old.md)\n```\n', 'old.md', 'changed.md'],
  ['code span', '`[link](old.md)`\n', 'old.md', 'changed.md'],
  ['link label', '[old.md](target.md)\n', 'old.md', 'changed.md'],
  ['link title', '[link](target.md "old.md")\n', 'old.md', 'changed.md'],
  ['replacement syntax injection', '[link](old.md)\n', 'old.md', 'new.md) extra [link](else.md'],
] as const)
  test(`archive rejects URL edit of ${name}`, async (t) => {
    const f = fixture(t),
      entry = f.relocated('docs/old.md', 'archive/old.md', body),
      start = body.indexOf(from)
    const archived = body.slice(0, start) + to + body.slice(start + from.length)
    entry.urlEdits = [{ start, end: start + from.length, from, to }]
    entry.archivedBytes = Buffer.byteLength(archived)
    entry.archivedSha256 = sha(archived)
    f.write(entry.archivedPath, archived)
    assert.equal(hasRule(await f.check(), 'relocation'), true)
  })
test('archive rejects historical prose drift despite a destination hash update', async (t) => {
  const f = fixture(t),
    entry = f.relocated('docs/old.md', 'archive/old.md', '# History\n\nFAIL\n')
  const changed = '# History\n\nPASS\n'
  entry.archivedBytes = Buffer.byteLength(changed)
  entry.archivedSha256 = sha(changed)
  f.write(entry.archivedPath, changed)
  assert.equal(hasRule(await f.check(), 'relocation'), true)
})
test('archive protects the complete baseline journal including formerly unhashed tail', async (t) => {
  const f = fixture(t),
    body = '# Journal\n\nold baseline\n\nnewer existing tail\n'
  f.originals.set('docs/journal.md', body)
  f.manifest.appendOnly.push({
    path: 'docs/journal.md',
    snapshotEntry: 'docs/journal.md',
    ...proof(body),
  })
  f.write('docs/journal.md', body + '\nnew entry\n')
  assert.equal((await f.check()).success, true)
  f.write('docs/journal.md', body.replace('newer existing tail', 'rewritten tail'))
  assert.equal(hasRule(await f.check(), 'append-only'), true)
})
test('archive requires removed compatibility content in TAR and a replacement', async (t) => {
  const f = fixture(t),
    body = '# Compatibility\n'
  f.originals.set('docs/old.md', body)
  f.manifest.removedPaths.push({
    path: 'docs/old.md',
    snapshotEntry: 'docs/old.md',
    replacementPath: 'docs/guide.md',
    ...proof(body),
  })
  assert.equal(hasRule(await f.check(), 'removed'), true)
  f.write('docs/guide.md', '# Guide\n')
  assert.equal((await f.check()).success, true)
})
test('archive verifies unchanged product and current release files by raw hash', async (t) => {
  const f = fixture(t),
    body = 'source\r\n'
  f.manifest.unchangedFiles.push({ path: 'src-v2/fixture.ts', encoding: 'raw', ...proof(body) })
  f.write('src-v2/fixture.ts', body)
  assert.equal((await f.check()).success, true)
  f.write('src-v2/fixture.ts', 'source\n')
  assert.equal(hasRule(await f.check(), 'unchanged'), true)
})
for (const path of [
  '../escape.md',
  '/absolute.md',
  'C:/escape.md',
  'archive/../escape.md',
  'archive\\escape.md',
])
  test(`archive rejects unsafe manifest path ${path}`, async (t) => {
    const f = fixture(t)
    f.manifest.snapshot.path = path
    f.write('archive/relocation-manifest.json', JSON.stringify(f.manifest))
    assert.throws(() => readArchiveManifest(f.root), /path/i)
  })
test('archive rejects case-folded destination collisions', async (t) => {
  const f = fixture(t)
  f.relocated('docs/a.md', 'archive/A.md', '# A\n')
  f.relocated('docs/b.md', 'archive/a.md', '# B\n')
  assert.equal(hasRule(await f.check(), 'manifest'), true)
})
for (const path of [
  '.WORK/private.tar',
  '.GIT/config',
  '.CoDeX/private.tar',
  'archive/retired/LOCAL/private.tar',
])
  test(`archive rejects case-variant private public-manifest path ${path}`, async (t) => {
    const f = fixture(t)
    f.manifest.snapshot.path = path
    f.write('archive/relocation-manifest.json', JSON.stringify(f.manifest))
    assert.throws(() => readArchiveManifest(f.root), /Private path/)
  })
test('archive rejects old Release files and historical records remaining in docs', async (t) => {
  const f = fixture(t)
  f.write('Release/v1.5.0/script.js', 'old')
  assert.equal(hasRule(await f.check(), 'layout'), true)
  rmSync(join(f.root, 'Release'), { recursive: true })
  f.write('docs/doc-manifest.json', '{"documents":[{"path":"docs/old.md","kind":"record"}]}')
  assert.equal(hasRule(await f.check(), 'layout'), true)
})
test('archive rejects an empty old Release directory rather than hiding it from file counts', async (t) => {
  const f = fixture(t)
  mkdirSync(join(f.root, 'Release/v1.5.0'), { recursive: true })
  assert.equal(hasRule(await f.check(), 'layout'), true)
})
test('archive checks require exactly five files if current Release is present', async (t) => {
  const f = fixture(t)
  const names = [
    'BiliCDN_TW.user.js',
    'BUILD_MANIFEST_v2.1.27.json',
    'CHANGELOG_v2.1.27.md',
    'TEST_REPORT_v2.1.27.md',
    'SHA256SUMS_v2.1.27.txt',
  ]
  for (const name of names.slice(0, 4)) f.write(`Release/v2.1.27/${name}`, 'fixture')
  assert.equal(hasRule(await f.check(), 'layout'), true)
  f.write(`Release/v2.1.27/${names[4]}`, 'fixture')
  const artifact = `Release/v2.1.27/${names[0]}`,
    sumFile = `Release/v2.1.27/${names[4]}`,
    rows = `${sha('fixture')}  ${artifact}\n`
  f.write(sumFile, rows)
  f.manifest.unchangedFiles.push(
    { path: artifact, encoding: 'raw', ...proof('fixture') },
    { path: sumFile, encoding: 'raw', ...proof(rows) },
  )
  assert.equal((await f.check()).success, true)
})
function checksumFixture(t: TestContext, rows?: string) {
  const f = fixture(t),
    artifact = 'Release/v1.6.0/BiliCDN_TW.user.js',
    source = 'Release/v1.6.0/SHA256SUMS_v1.6.0.txt',
    body = 'artifact\r\n',
    row = rows ?? `${sha(body)}  ${artifact}\n`
  for (const [originalPath, payload] of [
    [artifact, body],
    [source, row],
  ]) {
    const entry = f.relocated(originalPath!, `archive/retired/releases/${originalPath}`, payload!)
    entry.kind = 'release'
    entry.encoding = 'raw'
  }
  return f
}
test('archive verifies original root-relative Release checksum paths under the public archive root', async (t) => {
  const f = checksumFixture(t),
    result = await f.check()
  assert.equal(result.success, true)
  assert.equal(result.checksumFiles, 1)
  assert.equal(result.checksums, 1)
})
for (const [name, rows] of [
  ['path traversal', `${sha('artifact\r\n')}  Release/../outside.txt\n`],
  ['unregistered target', `${sha('artifact\r\n')}  Release/v1.6.0/unregistered.js\n`],
  ['wrong hash', `${'0'.repeat(64)}  Release/v1.6.0/BiliCDN_TW.user.js\n`],
  ['malformed row', 'malformed\n'],
  [
    'duplicate target',
    `${sha('artifact\r\n')}  Release/v1.6.0/BiliCDN_TW.user.js\n${sha('artifact\r\n')}  Release/v1.6.0/BiliCDN_TW.user.js\n`,
  ],
] as const)
  test(`archive checksum rejects ${name}`, async (t) => {
    assert.equal(hasRule(await checksumFixture(t, rows).check(), 'checksum'), true)
  })
test('archive checksum discovers an unregistered checksum list instead of omitting it', async (t) => {
  const f = checksumFixture(t)
  f.write('archive/retired/releases/Release/v1.6.1/SHA256SUMS_v1.6.1.txt', 'unregistered')
  assert.equal(hasRule(await f.check(), 'checksum'), true)
})
test('archive CLI parses local and JSON flags in either order and preserves exit codes', async (t) => {
  const f = fixture(t)
  assert.equal((await archiveCli([], f.root)).exitCode, 0)
  for (const args of [
    ['--json', '--local'],
    ['--local', '--json'],
  ]) {
    const cli = await archiveCli(args, f.root)
    assert.equal(cli.exitCode, 1)
    assert.equal((JSON.parse(cli.output) as { localChecked: boolean }).localChecked, true)
  }
  for (const args of [['--unknown'], ['--json', '--json'], ['extra']])
    assert.equal((await archiveCli(args, f.root)).exitCode, 2)
})
test('archive private mode validates ignored raw files and rejects tracked payload', async (t) => {
  const f = fixture(t),
    archivedPath = `${privateRoot}/Release/old.js`,
    body = 'private raw\r\n',
    checksumPath = `${privateRoot}/Release/SHA256SUMS_v1.5.0.txt`,
    checksumBody = `${sha(body)}  Release/old.js\n`
  execFileSync('git', ['init', '-q'], { cwd: f.root })
  f.write('.gitignore', '/archive/retired/local/\n')
  f.write(archivedPath, body)
  f.write(checksumPath, checksumBody)
  f.write(
    f.manifest.localManifest,
    JSON.stringify({
      schemaVersion: 1,
      baseline: f.manifest.baseline,
      root: privateRoot,
      entries: [
        { originalPath: 'Release/old.js', archivedPath, ...proof(body) },
        {
          originalPath: 'Release/SHA256SUMS_v1.5.0.txt',
          archivedPath: checksumPath,
          ...proof(checksumBody),
        },
      ],
    }),
  )
  const checked = await f.check(true)
  assert.equal(checked.success, true)
  assert.equal(checked.checksumFiles, 1)
  assert.equal(checked.checksums, 1)
  execFileSync('git', ['add', '-f', '--', archivedPath], { cwd: f.root })
  assert.equal(hasRule(await f.check(true), 'private'), true)
})

for (const originalPath of [
  'dist/BiliCDN_TW.user.js',
  'dist/BiliCDN_TW.user.js.map',
  'dist/build-manifest.json',
])
  test(`archive permits newly rebuilt output ${originalPath} beside its preserved old artifact`, async (t) => {
    const f = fixture(t),
      archivedPath = `${privateRoot}/${originalPath}`,
      body = 'old artifact\r\n'
    execFileSync('git', ['init', '-q'], { cwd: f.root })
    f.write('.gitignore', '/archive/retired/local/\n/dist/\n')
    f.write(archivedPath, body)
    f.write(originalPath, 'newly built output\n')
    f.write(
      f.manifest.localManifest,
      JSON.stringify({
        schemaVersion: 1,
        baseline: f.manifest.baseline,
        root: privateRoot,
        entries: [{ originalPath, archivedPath, ...proof(body) }],
      }),
    )
    const result = await f.check(true)
    assert.equal(result.success, true)
    assert.equal(result.localFiles, 1)
  })
test('archive still rejects a retained old dist task path after allowing normal rebuilds', async (t) => {
  const f = fixture(t),
    originalPath = 'dist/old-task/report.json',
    archivedPath = `${privateRoot}/${originalPath}`,
    body = 'old task\n'
  execFileSync('git', ['init', '-q'], { cwd: f.root })
  f.write('.gitignore', '/archive/retired/local/\n/dist/\n')
  f.write(archivedPath, body)
  f.write(originalPath, body)
  f.write(
    f.manifest.localManifest,
    JSON.stringify({
      schemaVersion: 1,
      baseline: f.manifest.baseline,
      root: privateRoot,
      entries: [{ originalPath, archivedPath, ...proof(body) }],
    }),
  )
  const result = await f.check(true)
  assert.ok(
    result.findings.some(
      (item) => item.rule === 'private' && item.message.includes('original path'),
    ),
  )
  assert.ok(result.findings.some((item) => item.rule === 'layout' && item.file === 'dist'))
})
for (const file of ['dist/BiliCDN_TW.user.js.backup', 'dist/unknown.json'])
  test(`archive default layout rejects an extra dist artifact ${file}`, async (t) => {
    const f = fixture(t)
    f.write(file, 'extra')
    assert.ok(
      (await f.check()).findings.some((item) => item.rule === 'layout' && item.file === 'dist'),
    )
  })
test('archive private mode rejects destinations outside the designated local root', async (t) => {
  const f = fixture(t)
  f.write(
    f.manifest.localManifest,
    JSON.stringify({
      schemaVersion: 1,
      baseline: f.manifest.baseline,
      root: privateRoot,
      entries: [
        {
          originalPath: 'Release/old.js',
          archivedPath: 'archive/other.js',
          bytes: 0,
          sha256: sha(''),
        },
      ],
    }),
  )
  const result = await f.check(true)
  assert.ok(
    result.findings.some((item) => item.rule === 'private' && item.message.includes('outside')),
  )
})
for (const archivedPath of [
  `${privateRoot}/OPERATIONS/helper.mts`,
  `${privateRoot.toUpperCase()}-OTHER/payload.bin`,
])
  test(`archive private mode rejects case-variant operations or sibling root ${archivedPath}`, async (t) => {
    const f = fixture(t)
    f.write(
      f.manifest.localManifest,
      JSON.stringify({
        schemaVersion: 1,
        baseline: f.manifest.baseline,
        root: privateRoot,
        entries: [{ originalPath: 'dist/old.bin', archivedPath, bytes: 0, sha256: sha('') }],
      }),
    )
    const result = await f.check(true)
    assert.ok(
      result.findings.some((item) => item.rule === 'private' && item.message.includes('outside')),
    )
  })
test('archive private mode reports unreadable preserved objects as unverified failure', async (t) => {
  const f = fixture(t)
  f.write(
    f.manifest.localManifest,
    JSON.stringify({
      schemaVersion: 1,
      baseline: f.manifest.baseline,
      root: privateRoot,
      entries: [],
      unverified: [
        {
          originalPath: 'dist/locked.js',
          archivedPath: `${privateRoot}/dist/locked.js`,
          reason: 'Windows denied reading preserved object',
          kind: 'file',
          device: 1,
          inode: 2,
        },
      ],
    }),
  )
  assert.equal(hasRule(await f.check(true), 'private-unverified'), true)
  assert.equal((await f.check()).success, true)
})
test('archive TAR reader accepts Git global PAX and per-file Unicode path metadata', () => {
  const bytes = Buffer.concat([
    tarFile('pax_global_header', pax('comment', 'a'.repeat(40)), 'g'),
    tarFile('extended', pax('path', 'docs/中文 long.md'), 'x'),
    tarFile('short.md', '# 中文\n'),
    Buffer.alloc(1024),
  ])
  assert.equal(readTarArchive(bytes).get('docs/中文 long.md')?.toString(), '# 中文\n')
})
test('archive TAR reader consumes a self-contained real git archive without extraction', async (t) => {
  const f = fixture(t)
  f.write('docs/INDEX.md', '# 閱讀路徑\n\n獨立 Git fixture。\n')
  execFileSync('git', ['init', '-q'], { cwd: f.root })
  execFileSync('git', ['add', '-f', '--', 'docs/INDEX.md'], { cwd: f.root })
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Archive Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      `core.hooksPath=${join(f.root, 'unused-hooks')}`,
      'commit',
      '-qm',
      'Fixture archive source',
    ],
    { cwd: f.root },
  )
  const bytes = execFileSync('git', ['archive', '--format=tar', 'HEAD', 'docs/INDEX.md'], {
    cwd: f.root,
  })
  assert.ok(readTarArchive(bytes).get('docs/INDEX.md')?.includes(Buffer.from('閱讀路徑')))
})
test('archive TAR reader rejects unsafe paths, duplicate files and truncated data', () => {
  assert.throws(() => readTarArchive(tar([['../escape', 'payload']])), /Unsafe/)
  assert.throws(
    () =>
      readTarArchive(
        tar([
          ['docs/a', 'a'],
          ['docs/a', 'b'],
        ]),
      ),
    /Duplicate/,
  )
  assert.throws(() => readTarArchive(tar([['docs/a', 'body']]).subarray(0, 513)), /Truncated/)
  assert.throws(
    () => readTarArchive(Buffer.concat([tarFile('link', 'target', '2'), Buffer.alloc(1024)])),
    /Unsupported/,
  )
})
test('archive TAR reader rejects bad header checksums and unsafe PAX path overrides', () => {
  const bytes = tar([['docs/a', 'body']])
  bytes[0] = 0
  assert.throws(() => readTarArchive(bytes), /checksum/)
  assert.throws(
    () =>
      readTarArchive(
        Buffer.concat([
          tarFile('extended', pax('path', '../unsafe'), 'x'),
          tarFile('safe', 'body'),
          Buffer.alloc(1024),
        ]),
      ),
    /Unsafe/,
  )
})
test('archive checker and JSON CLI leave every fixture byte unchanged', async (t) => {
  const f = fixture(t)
  f.relocated('docs/old.md', 'archive/old.md', '# History\n')
  f.save()
  const state = () =>
    readdirSync(f.root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const file = join(entry.parentPath, entry.name)
        return [file, sha(readFileSync(file))]
      })
      .sort((a, b) => a[0]!.localeCompare(b[0]!))
  const before = state()
  assert.equal((await checkArchive(f.root)).success, true)
  assert.equal((await archiveCli(['--json'], f.root)).exitCode, 0)
  assert.deepEqual(state(), before)
})
