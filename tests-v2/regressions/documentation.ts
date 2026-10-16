import { test } from 'node:test'
import type { TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { checkDocumentation, documentationCli, markdownAnchors } from '../../scripts/docs-check.mts'
import type { DocumentationManifest } from '../../scripts/docs-check.mts'
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
  assert.equal((JSON.parse(json.output) as { schemaVersion: number }).schemaVersion, 1)
  f.write('docs/guide.md', '# 指南\n\n[broken](missing.md)\n')
  assert.equal((await documentationCli([], f.root)).exitCode, 1)
})
