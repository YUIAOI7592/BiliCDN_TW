import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { checkDocumentation, documentationCli, markdownAnchors } from '../../scripts/docs-check.mts'
import type { DocumentationManifest } from '../../scripts/docs-check.mts'
import type { ArchiveManifest } from '../../scripts/archive-check.mts'
import { testScope } from '../support/scope.ts'

function fixture(t: TestContext) {
  const scope = testScope(t),
    root = mkdtempSync(join(tmpdir(), 'bilicdn-docs-'))
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep))
  assert.ok(root.split(sep).at(-1)?.startsWith('bilicdn-docs-'))
  scope.defer(() => rmSync(root, { recursive: true }))
  const write = (file: string, body: string) => {
    mkdirSync(resolve(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), body)
  }
  const manifest: DocumentationManifest = {
    schemaVersion: 1,
    baseline: 'fixture',
    owners: [{ topic: 'product', path: 'docs/guide.md' }],
    navigation: { entry: 'docs/INDEX.md', maxDepth: 2 },
    documents: [
      {
        path: 'docs/INDEX.md',
        kind: 'navigation',
        topics: ['navigation'],
        versions: [],
        date: null,
        requiredAnchors: [],
      },
      {
        path: 'docs/guide.md',
        kind: 'guide',
        topics: ['product'],
        versions: [],
        date: null,
        requiredAnchors: [],
      },
    ],
    versionFields: [],
    protections: [],
    immutableLinkExceptions: [],
    privateEvidenceReferences: [],
  }
  write('docs/INDEX.md', '# 文件入口\n\n[指南](guide.md)\n')
  write('docs/guide.md', '# 指南\n\n產品契約。\n')
  write('release.json', '{"version":"2.1.27"}\n')
  write('package.json', '{"version":"2.1.27","scripts":{"test":"node test.mts"}}\n')
  write('package-lock.json', '{"version":"2.1.27"}\n')
  const save = () => write('docs/doc-manifest.json', JSON.stringify(manifest))
  save()
  const check = () => {
    save()
    return checkDocumentation(root)
  }
  const protect = (file: string, mode: 'exact' | 'prefix' = 'exact') => {
    const source = readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n')
    manifest.protections.push({
      path: file,
      mode,
      encoding: 'lf',
      bytes: Buffer.byteLength(source),
      sha256: createHash('sha256').update(source).digest('hex'),
    })
  }
  return { root, write, manifest, save, check, protect }
}
function archiveFixture(t: TestContext, url = '%E8%88%8A%20%E5%A0%B1%E5%91%8A.md#中文章節') {
  const f = fixture(t),
    source = 'docs/history.md',
    originalTarget = 'docs/舊 報告.md',
    archivedTarget = 'archive/retired/docs/舊 報告.md',
    body = '# 歷史來源\n\n[原報告](' + url + ')\n',
    archivedBody = '# 原報告\n\n## 中文章節\n'
  f.write(source, body)
  f.write(archivedTarget, archivedBody)
  f.write(
    'docs/INDEX.md',
    '# 文件入口\n\n[指南](guide.md)\n\n[歷史來源](history.md)\n\n[封存](../archive/retired/docs/%E8%88%8A%20%E5%A0%B1%E5%91%8A.md)\n',
  )
  for (const file of [source, archivedTarget]) {
    f.manifest.documents.push({
      path: file,
      kind: 'record',
      topics: ['history'],
      versions: [],
      date: null,
      requiredAnchors: [],
    })
    f.protect(file)
  }
  f.manifest.archiveManifest = 'archive/relocation-manifest.json'
  const archivedBytes = Buffer.byteLength(archivedBody),
    archivedHash = createHash('sha256').update(archivedBody).digest('hex'),
    archive: ArchiveManifest = {
      schemaVersion: 1,
      baseline: '0'.repeat(40),
      snapshot: { path: 'archive/original.json', bytes: 0, sha256: '0'.repeat(64) },
      entries: [
        {
          originalPath: originalTarget,
          archivedPath: archivedTarget,
          kind: 'record',
          encoding: 'lf',
          bytes: archivedBytes,
          sha256: archivedHash,
          archivedBytes,
          archivedSha256: archivedHash,
        },
      ],
      removedPaths: [],
      appendOnly: [],
      unchangedFiles: [],
      localManifest: 'archive/retired/local/2026-10-20-cleanup/private-manifest.json',
      historicalReferences: [
        {
          source,
          line: 3,
          url,
          sha256: createHash('sha256').update(body).digest('hex'),
          originalTarget,
          archivedTarget,
          reason: 'Immutable original URL no longer exists after archival',
        },
      ],
    }
  const saveArchive = () => f.write('archive/relocation-manifest.json', JSON.stringify(archive))
  const check = () => {
    saveArchive()
    return f.check()
  }
  saveArchive()
  return { ...f, check, archive, source, originalTarget, archivedTarget }
}
test('documentation accepts Chinese headings, emphasis and duplicate heading suffixes', () => {
  const anchors = markdownAnchors('# 中文標題\n\n## **操作** `seek`\n\n## **操作** `seek`\n')
  assert.deepEqual([...anchors], ['中文標題', '操作-seek', '操作-seek-1'])
})
test('documentation validates encoded paths, images, references and custom anchors', async (t) => {
  const f = fixture(t)
  f.manifest.documents[1]!.path = 'docs/中文 guide.md'
  f.manifest.owners[0]!.path = 'docs/中文 guide.md'
  // Keep the old guide as classified navigation, rather than hiding an orphan.
  f.manifest.documents.push({ ...f.manifest.documents[0]!, path: 'docs/guide.md' })
  f.write(
    'docs/INDEX.md',
    '# 文件入口\n\n[指南](%E4%B8%AD%E6%96%87%20guide.md#custom)\n\n[相容](guide.md)\n',
  )
  f.write(
    'docs/中文 guide.md',
    '# 指南\n\n<a id="custom"></a>\n\n[圖片][image]\n\n![圖](image.png)\n\n[image]: image.png\n',
  )
  f.write('docs/image.png', 'fixture')
  assert.equal((await f.check()).success, true)
})
test('documentation reports a missing local anchor', async (t) => {
  const f = fixture(t)
  f.write('docs/INDEX.md', '# 文件入口\n\n[指南](guide.md#absent)\n')
  assert.ok(
    (await f.check()).findings.some((x) => x.rule === 'link' && x.message.includes('absent')),
  )
})
test('documentation rejects missing reference definitions', async (t) => {
  const f = fixture(t)
  f.write('docs/guide.md', '# 指南\n\n[來源][missing]\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'reference'))
})
test('documentation rejects malformed table column counts', async (t) => {
  const f = fixture(t)
  f.write('docs/guide.md', '# 指南\n\n| A | B |\n| --- | --- |\n| one | two | three |\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'MD056'))
})
test('documentation discovers unclassified public Markdown', async (t) => {
  const f = fixture(t)
  f.write('docs/unclassified.md', '# New\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'classification'))
})
test('documentation rejects duplicate topic authority', async (t) => {
  const f = fixture(t)
  f.manifest.owners.push({ topic: 'product', path: 'docs/guide.md' })
  assert.ok((await f.check()).findings.some((x) => x.rule === 'ownership'))
})
test('documentation rejects an authority without an owner declaration', async (t) => {
  const f = fixture(t)
  f.manifest.owners = []
  assert.ok((await f.check()).findings.some((x) => x.rule === 'ownership'))
})
test('documentation rejects stale declared version fields', async (t) => {
  const f = fixture(t)
  f.manifest.versionFields.push({ path: 'docs/guide.md', pattern: '^# Version ([0-9.]+)' })
  f.write('docs/guide.md', '# Version 2.1.26\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'version'))
})
test('documentation rejects package and release version disagreement', async (t) => {
  const f = fixture(t)
  f.write('package-lock.json', '{"version":"2.1.26"}\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'version'))
})
test('documentation rejects changes to frozen historical content', async (t) => {
  const f = fixture(t)
  f.protect('docs/guide.md')
  f.write('docs/guide.md', '# Changed\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'preservation'))
})
test('documentation accepts append-only journals but rejects changes to their original prefix', async (t) => {
  const f = fixture(t)
  f.protect('docs/guide.md', 'prefix')
  f.write('docs/guide.md', '# 指南\n\n產品契約。\n\n追加紀錄。\n')
  assert.equal((await f.check()).success, true)
  f.write('docs/guide.md', '# 指南\n\n改寫契約。\n\n追加紀錄。\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'preservation'))
})
test('documentation preserves required compatibility anchors', async (t) => {
  const f = fixture(t)
  f.manifest.documents[1]!.requiredAnchors.push('legacy')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'compatibility-anchor'))
  f.write('docs/guide.md', '# 指南\n\n<a name="legacy"></a>\n')
  assert.equal((await f.check()).success, true)
})
test('documentation rejects unknown npm commands in maintained instructions', async (t) => {
  const f = fixture(t)
  f.write('docs/guide.md', '# 指南\n\n```sh\nnpm run absent\n```\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'command'))
})
test('documentation enforces navigation within two clicks', async (t) => {
  const f = fixture(t)
  f.write('docs/INDEX.md', '# 文件入口\n')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'navigation'))
})
test('documentation does not fetch external links or mutate inspected files', async (t) => {
  const f = fixture(t)
  f.write('docs/guide.md', '# 指南\n\n[外部](https://127.0.0.1:1/never-fetch)\n')
  f.save()
  const paths = [
    'docs/INDEX.md',
    'docs/guide.md',
    'docs/doc-manifest.json',
    'package.json',
    'release.json',
    'package-lock.json',
  ]
  const before = paths.map((p) => readFileSync(join(f.root, p)))
  const report = await checkDocumentation(f.root)
  assert.equal(report.success, true)
  assert.equal(report.externalLinksNotFetched, 1)
  assert.deepEqual(
    paths.map((p) => readFileSync(join(f.root, p))),
    before,
  )
})
test('documentation reports immutable broken links separately with exact source and hash', async (t) => {
  const f = fixture(t)
  const file = 'Release/v9/REPORT.md',
    source = '# Original\n\n[old](missing.md)\n'
  f.write(file, source)
  f.manifest.documents.push({
    path: file,
    kind: 'immutable',
    topics: ['history'],
    versions: [],
    date: null,
    requiredAnchors: [],
  })
  f.protect(file)
  f.manifest.immutableLinkExceptions.push({
    source: file,
    line: 3,
    url: 'missing.md',
    sha256: f.manifest.protections[0]!.sha256,
    reason: 'Original immutable relative link',
  })
  const report = await f.check()
  assert.equal(report.success, true)
  assert.equal(report.legacyLinks.length, 1)
  f.write(file, source + '\nChanged.\n')
  const changed = await f.check()
  assert.ok(changed.findings.some((x) => x.rule === 'preservation'))
  assert.ok(changed.findings.some((x) => x.rule === 'link'))
})
test('documentation rejects unused historical exceptions after a link is repaired', async (t) => {
  const f = fixture(t)
  f.manifest.immutableLinkExceptions.push({
    source: 'docs/guide.md',
    line: 3,
    url: 'missing.md',
    sha256: '0'.repeat(64),
    reason: 'Cannot suppress a current guide',
  })
  assert.ok((await f.check()).findings.some((x) => x.rule === 'legacy-exception'))
})
test('documentation rejects paths escaping the repository and invalid encoded links', async (t) => {
  const f = fixture(t)
  f.write('docs/guide.md', '# 指南\n\n[escape](../../outside.md)\n\n[bad](%ZZ.md)\n')
  assert.equal((await f.check()).findings.filter((x) => x.rule === 'link').length, 2)
})
test('documentation rejects malformed manifest data without trusting external shapes', async (t) => {
  const f = fixture(t)
  f.write('docs/doc-manifest.json', '{"schemaVersion":9}')
  const report = await checkDocumentation(f.root)
  assert.equal(report.success, false)
  assert.equal(report.findings[0]?.rule, 'manifest')
})
test('documentation CLI preserves pass, failure, usage and JSON contracts', async (t) => {
  const f = fixture(t)
  assert.equal((await documentationCli([], f.root)).exitCode, 0)
  assert.equal((await documentationCli(['--invalid'], f.root)).exitCode, 2)
  const json = await documentationCli(['--json'], f.root)
  assert.equal(json.exitCode, 0)
  assert.equal((JSON.parse(json.output) as { schemaVersion: number }).schemaVersion, 2)
  f.write('docs/guide.md', '# 指南\n\n[broken](missing.md)\n')
  assert.equal((await documentationCli([], f.root)).exitCode, 1)
})

test('documentation keeps exact historical private evidence independent of local availability', async (t) => {
  const f = fixture(t),
    file = 'docs/history.md'
  f.write(file, '# History\n\n[private](../.work/proof.json)\n')
  f.write('docs/INDEX.md', '# 文件入口\n\n[指南](guide.md)\n\n[原紀錄](history.md)\n')
  f.manifest.documents.push({
    path: file,
    kind: 'record',
    topics: ['history'],
    versions: [],
    date: null,
    requiredAnchors: [],
  })
  f.protect(file)
  f.manifest.privateEvidenceReferences.push({
    source: file,
    line: 3,
    url: '../.work/proof.json',
    sha256: f.manifest.protections[0]!.sha256,
    reason: 'Private evidence is not part of checkout',
  })
  const clean = await f.check()
  assert.equal(clean.success, true)
  assert.equal(clean.privateEvidenceNotChecked.length, 1)
  f.write('.work/proof.json', '{"private":"must not read"}')
  assert.deepEqual(await f.check(), clean)
})

test('documentation rejects undeclared private links even when the local file exists', async (t) => {
  const f = fixture(t)
  f.write('docs/guide.md', '# 指南\n\n[private](../.work/proof.json)\n')
  f.write('.work/proof.json', '{}')
  assert.ok((await f.check()).findings.some((x) => x.rule === 'link'))
})

test('documentation cannot exempt private evidence with a different source hash', async (t) => {
  const f = fixture(t),
    file = 'docs/history.md'
  f.write(file, '# History\n\n[private](../.work/proof.json)\n')
  f.write('docs/INDEX.md', '# 文件入口\n\n[指南](guide.md)\n\n[原紀錄](history.md)\n')
  f.manifest.documents.push({
    path: file,
    kind: 'record',
    topics: ['history'],
    versions: [],
    date: null,
    requiredAnchors: [],
  })
  f.protect(file)
  f.manifest.privateEvidenceReferences.push({
    source: file,
    line: 3,
    url: '../.work/proof.json',
    sha256: '0'.repeat(64),
    reason: 'Wrong source must fail',
  })
  const report = await f.check()
  assert.ok(report.findings.some((x) => x.rule === 'private-evidence'))
  assert.ok(report.findings.some((x) => x.rule === 'link'))
})

test('documentation separates exact encoded Chinese archive references from valid links', async (t) => {
  const f = archiveFixture(t)
  const report = await f.check()
  assert.equal(report.success, true)
  assert.equal(report.schemaVersion, 2)
  assert.equal(report.links, 3)
  assert.deepEqual(report.archivedReferences, f.archive.historicalReferences)
  assert.equal(report.legacyLinks.length, 0)
})

test('documentation classifies exact main repository archive references', async (t) => {
  const f = archiveFixture(
    t,
    'https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/%E8%88%8A%20%E5%A0%B1%E5%91%8A.md#中文章節',
  )
  const report = await f.check()
  assert.equal(report.success, true)
  assert.equal(report.archivedReferences.length, 1)
  assert.equal(report.externalLinksNotFetched, 0)
})

for (const kind of ['immutable', 'journal'] as const)
  test(`documentation permits exact archive references from protected ${kind} sources`, async (t) => {
    const f = archiveFixture(t)
    f.manifest.documents.find((item) => item.path === f.source)!.kind = kind
    assert.equal((await f.check()).success, true)
  })

function journalArchiveFixture(t: TestContext) {
  const f = archiveFixture(t),
    body = readFileSync(join(f.root, f.source), 'utf8'),
    baseline = {
      path: f.source,
      snapshotEntry: f.source,
      bytes: Buffer.byteLength(body),
      sha256: createHash('sha256').update(body).digest('hex'),
    }
  f.manifest.documents.find((item) => item.path === f.source)!.kind = 'journal'
  f.manifest.protections.find((item) => item.path === f.source)!.mode = 'prefix'
  f.archive.appendOnly.push(baseline)
  return { ...f, body, baseline }
}
test('documentation preserves baseline journal archive references after append-only records are added', async (t) => {
  const f = journalArchiveFixture(t)
  f.write(f.source, f.body + '\n## 新增維護紀錄\n\n原結果保留。\n')
  const result = await f.check()
  assert.equal(result.success, true)
  assert.equal(result.archivedReferences.length, 1)
})
test('documentation cannot extend a journal archive exception to a newly appended broken link', async (t) => {
  const f = journalArchiveFixture(t),
    old = f.archive.historicalReferences[0]!
  f.write(f.source, f.body + '\n[新增錯誤](' + old.url + ')\n')
  f.archive.historicalReferences.push({ ...old, line: f.body.split('\n').length + 1 })
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 1)
  assert.equal(result.findings.filter((item) => item.rule === 'link').length, 1)
  assert.equal(result.findings.filter((item) => item.rule === 'archive-reference').length, 1)
})
test('documentation rejects journal archive references when the complete original tail was edited', async (t) => {
  const f = journalArchiveFixture(t)
  f.write(f.source, f.body.replace('歷史來源', '已改來源') + '\n新增\n')
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 0)
  assert.ok(result.findings.some((item) => item.rule === 'archive-reference'))
})
test('documentation rejects a journal archive reference whose baseline hash differs', async (t) => {
  const f = journalArchiveFixture(t)
  f.baseline.sha256 = 'f'.repeat(64)
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 0)
  assert.ok(result.findings.some((item) => item.rule === 'link'))
})
test('documentation uses UTF-8 byte boundaries for a multibyte journal prefix', async (t) => {
  const f = journalArchiveFixture(t),
    old = f.archive.historicalReferences[0]!
  f.baseline.bytes = Buffer.byteLength(f.body.slice(0, f.body.indexOf(old.url)))
  f.baseline.sha256 = createHash('sha256')
    .update(Buffer.from(f.body).subarray(0, f.baseline.bytes))
    .digest('hex')
  old.sha256 = f.baseline.sha256
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 0)
  assert.ok(result.findings.some((item) => item.rule === 'link'))
})
test('documentation does not treat an old short journal protection as a full append-only baseline', async (t) => {
  const f = journalArchiveFixture(t)
  f.archive.appendOnly = []
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 0)
  assert.ok(result.findings.some((item) => item.rule === 'archive-reference'))
})
test('documentation maps a removed compatibility URL to its registered canonical replacement', async (t) => {
  const f = archiveFixture(t)
  f.archive.entries = []
  f.archive.removedPaths.push({
    path: f.originalTarget,
    snapshotEntry: f.originalTarget,
    bytes: 0,
    sha256: '0'.repeat(64),
    replacementPath: f.archivedTarget,
  })
  const result = await f.check()
  assert.equal(result.success, true)
  assert.equal(result.archivedReferences.length, 1)
})
test('documentation rejects a removed compatibility URL with a different canonical replacement', async (t) => {
  const f = archiveFixture(t)
  f.archive.entries = []
  f.archive.removedPaths.push({
    path: f.originalTarget,
    snapshotEntry: f.originalTarget,
    bytes: 0,
    sha256: '0'.repeat(64),
    replacementPath: 'docs/guide.md',
  })
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 0)
  assert.ok(result.findings.some((item) => item.rule === 'archive-reference'))
})

function relocatedReleaseReferenceFixture(t: TestContext) {
  const f = archiveFixture(t, '../../docs/%E8%88%8A%20%E5%A0%B1%E5%91%8A.md#中文章節'),
    originalSource = 'Release/v1.6.0/TEST_REPORT_v1.6.0.md',
    source = `archive/retired/releases/${originalSource}`,
    body = readFileSync(join(f.root, f.source), 'utf8'),
    hash = createHash('sha256').update(body).digest('hex')
  f.write(source, body)
  rmSync(join(f.root, f.source))
  f.manifest.documents.find((item) => item.path === f.source)!.path = source
  f.manifest.documents.find((item) => item.path === source)!.kind = 'immutable'
  f.manifest.protections.find((item) => item.path === f.source)!.path = source
  f.archive.entries = [
    {
      originalPath: originalSource,
      archivedPath: source,
      kind: 'release',
      encoding: 'raw',
      bytes: Buffer.byteLength(body),
      sha256: hash,
      archivedBytes: Buffer.byteLength(body),
      archivedSha256: hash,
    },
  ]
  f.archive.removedPaths.push({
    path: f.originalTarget,
    snapshotEntry: f.originalTarget,
    bytes: 0,
    sha256: '0'.repeat(64),
    replacementPath: f.archivedTarget,
  })
  f.archive.historicalReferences[0]!.source = source
  f.write(
    'docs/INDEX.md',
    '# 文件入口\n\n[指南](guide.md)\n\n[來源](../' +
      source +
      ')\n\n[封存](../archive/retired/docs/%E8%88%8A%20%E5%A0%B1%E5%91%8A.md)\n',
  )
  return { ...f, source, originalSource }
}
test('documentation resolves an immutable moved Release relative URL from its original source path', async (t) => {
  const f = relocatedReleaseReferenceFixture(t),
    result = await f.check()
  assert.equal(result.success, true)
  assert.equal(result.archivedReferences.length, 1)
})
test('documentation does not guess a moved Release original source without its relocation entry', async (t) => {
  const f = relocatedReleaseReferenceFixture(t)
  f.archive.entries = []
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 0)
  assert.ok(result.findings.some((item) => item.rule === 'link'))
})
test('documentation rejects a moved Release exception that names its new relative resolution as the original target', async (t) => {
  const f = relocatedReleaseReferenceFixture(t)
  f.archive.historicalReferences[0]!.originalTarget = 'archive/retired/releases/docs/舊 報告.md'
  const result = await f.check()
  assert.equal(result.archivedReferences.length, 0)
  assert.ok(result.findings.some((item) => item.rule === 'archive-reference'))
})

for (const field of [
  'source',
  'line',
  'url',
  'sha256',
  'originalTarget',
  'archivedTarget',
] as const)
  test(`documentation rejects an archived reference with mismatched ${field}`, async (t) => {
    const f = archiveFixture(t),
      reference = f.archive.historicalReferences[0]!
    if (field === 'line') reference.line++
    else if (field === 'sha256') reference.sha256 = 'f'.repeat(64)
    else if (field === 'url') reference.url += '-changed'
    else reference[field] = 'docs/guide.md'
    const report = await f.check()
    assert.equal(report.success, false)
    assert.equal(report.archivedReferences.length, 0)
    assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
    assert.ok(report.findings.some((item) => item.rule === 'link'))
  })

test('documentation rejects archive references without their registered relocation', async (t) => {
  const f = archiveFixture(t)
  f.archive.entries = []
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
})

test('documentation rejects archive references when the archived target is missing', async (t) => {
  const f = archiveFixture(t)
  rmSync(join(f.root, f.archivedTarget))
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
})

test('documentation rejects archived references with no corresponding archived section', async (t) => {
  const f = archiveFixture(t, '%E8%88%8A%20%E5%A0%B1%E5%91%8A.md#不存在')
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
  assert.ok(report.findings.some((item) => item.rule === 'link'))
})

test('documentation rejects archive references from unprotected historical sources', async (t) => {
  const f = archiveFixture(t)
  f.manifest.protections = f.manifest.protections.filter((item) => item.path !== f.source)
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
})

test('documentation cannot suppress current guide links with archive references', async (t) => {
  const f = archiveFixture(t)
  f.manifest.documents.find((item) => item.path === f.source)!.kind = 'guide'
  f.manifest.owners.push({ topic: 'history', path: f.source })
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
  assert.ok(report.findings.some((item) => item.rule === 'link'))
})

test('documentation requires relocated reading copies to use working links', async (t) => {
  const f = archiveFixture(
    t,
    'https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/%E8%88%8A%20%E5%A0%B1%E5%91%8A.md#中文章節',
  )
  const copy = 'archive/retired/docs/source.md',
    body = readFileSync(join(f.root, f.source))
  f.write(copy, body.toString('utf8'))
  rmSync(join(f.root, f.source))
  f.manifest.documents.find((item) => item.path === f.source)!.path = copy
  f.manifest.protections.find((item) => item.path === f.source)!.path = copy
  f.archive.historicalReferences[0]!.source = copy
  f.archive.entries.push({
    ...f.archive.entries[0]!,
    originalPath: 'docs/source-original.md',
    archivedPath: copy,
    bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
    archivedBytes: body.length,
    archivedSha256: createHash('sha256').update(body).digest('hex'),
  })
  f.write(
    'docs/INDEX.md',
    '# 文件入口\n\n[指南](guide.md)\n\n[來源](../archive/retired/docs/source.md)\n\n[封存](../archive/retired/docs/%E8%88%8A%20%E5%A0%B1%E5%91%8A.md)\n',
  )
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
  assert.ok(report.findings.some((item) => item.rule === 'link'))
})

test('documentation rejects an unused archive reference after its original URL is restored', async (t) => {
  const f = archiveFixture(t)
  f.write(f.originalTarget, '# 原報告\n\n## 中文章節\n')
  f.manifest.documents.push({
    path: f.originalTarget,
    kind: 'compatibility',
    topics: [],
    versions: [],
    date: null,
    requiredAnchors: [],
  })
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
})

test('documentation does not classify a new broken anchor as an archived URL', async (t) => {
  const f = archiveFixture(t)
  f.write(f.originalTarget, '# 原報告\n')
  f.manifest.documents.push({
    path: f.originalTarget,
    kind: 'compatibility',
    topics: [],
    versions: [],
    date: null,
    requiredAnchors: [],
  })
  const report = await f.check()
  assert.equal(report.archivedReferences.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'link'))
  assert.ok(report.findings.some((item) => item.rule === 'archive-reference'))
})

test('documentation keeps new broken links visible beside historical archive references', async (t) => {
  const f = archiveFixture(t)
  f.write('docs/guide.md', '# 指南\n\n[新錯誤](new-missing.md)\n')
  const report = await f.check()
  assert.equal(report.success, false)
  assert.equal(report.archivedReferences.length, 1)
  assert.equal(report.findings.filter((item) => item.rule === 'link').length, 1)
})

test('documentation archive reporting is readonly and distinguishes unavailable original URLs', async (t) => {
  const f = archiveFixture(t)
  f.save()
  const paths = [
    f.source,
    f.archivedTarget,
    'docs/INDEX.md',
    'docs/doc-manifest.json',
    'archive/relocation-manifest.json',
  ]
  const before = paths.map((file) => readFileSync(join(f.root, file)))
  const plain = await documentationCli([], f.root),
    json = await documentationCli(['--json'], f.root)
  assert.equal(plain.exitCode, 0)
  assert.match(plain.output, /1 historical archive references unavailable at original URLs/)
  const report = JSON.parse(json.output) as {
    schemaVersion: number
    archivedReferences: unknown[]
  }
  assert.equal(report.schemaVersion, 2)
  assert.equal(report.archivedReferences.length, 1)
  assert.deepEqual(
    paths.map((file) => readFileSync(join(f.root, file))),
    before,
  )
})

test('documentation reports invalid archive manifest shapes without ignoring the failure', async (t) => {
  const f = fixture(t)
  f.manifest.archiveManifest = 'archive/relocation-manifest.json'
  f.write('archive/relocation-manifest.json', '{"schemaVersion":9}')
  const report = await f.check()
  assert.equal(report.success, false)
  assert.ok(report.findings.some((item) => item.rule === 'archive-manifest'))
})

test('documentation keeps declared archived private evidence inaccessible and unread', async (t) => {
  const f = fixture(t),
    file = 'archive/retired/docs/private-history.md',
    url = '../local/2026-10-20-cleanup/proof.md',
    privatePath = 'archive/retired/local/2026-10-20-cleanup/proof.md'
  f.write(file, '# 原紀錄\n\n[私有證據](' + url + ')\n')
  f.write(
    'docs/INDEX.md',
    '# 文件入口\n\n[指南](guide.md)\n\n[原紀錄](../archive/retired/docs/private-history.md)\n',
  )
  f.manifest.documents.push({
    path: file,
    kind: 'record',
    topics: ['history'],
    versions: [],
    date: null,
    requiredAnchors: [],
  })
  f.protect(file)
  f.manifest.privateEvidenceReferences.push({
    source: file,
    line: 3,
    url,
    sha256: f.manifest.protections[0]!.sha256,
    reason: 'Private archived evidence must not be inspected',
  })
  const missing = await f.check()
  assert.equal(missing.success, true)
  assert.equal(missing.privateEvidenceNotChecked.length, 1)
  f.write(privatePath, '# PRIVATE PAYLOAD MUST NOT BE READ\n\n[broken](unknown.md)\n')
  const present = await f.check()
  assert.deepEqual(present, missing)
  assert.equal(JSON.stringify(present).includes('PRIVATE PAYLOAD'), false)
})

test('documentation rejects undeclared archived private evidence even when it exists', async (t) => {
  const f = fixture(t)
  f.write(
    'docs/guide.md',
    '# 指南\n\n[私有](../archive/retired/local/2026-10-20-cleanup/proof.md)\n',
  )
  f.write('archive/retired/local/2026-10-20-cleanup/proof.md', 'private payload')
  const report = await f.check()
  assert.equal(report.privateEvidenceNotChecked.length, 0)
  assert.ok(report.findings.some((item) => item.rule === 'link'))
})
