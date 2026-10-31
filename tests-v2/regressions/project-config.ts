import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { checkProjectConfiguration } from '../../scripts/checks/project-config.mts'
import { testScope } from '../support/scope.ts'

function fixture(t: Parameters<typeof testScope>[0]) {
  const scope = testScope(t)
  const root = mkdtempSync(join(tmpdir(), 'bilicdn-project-config-'))
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep))
  scope.defer(() => rmSync(root, { recursive: true }))
  const dependencies = { typescript: '7.0.2', esbuild: '0.28.2', '@types/node': '26.6.4' }
  const release = { version: '2.1.27', typescriptVersion: '7.0.2', esbuildVersion: '0.28.2' }
  const pkg = { version: '2.1.27', devDependencies: { ...dependencies } }
  const lock = {
    version: '2.1.27',
    lockfileVersion: 3,
    packages: {
      '': { version: '2.1.27', devDependencies: { ...dependencies } },
      ...Object.fromEntries(
        Object.entries(dependencies).map(([name, version]) => [
          'node_modules/' + name,
          { version },
        ]),
      ),
    } as Record<string, { version: string; devDependencies?: Record<string, string> }>,
  }
  const write = (path: string, value: unknown) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), JSON.stringify(value) + '\n')
  }
  const save = () => {
    write('release.json', release)
    write('package.json', pkg)
    write('package-lock.json', lock)
  }
  save()
  for (const [name, version] of Object.entries(dependencies))
    write('node_modules/' + name + '/package.json', { version })
  return { root, release, pkg, lock, save, write }
}

test('project configuration accepts matching pinned scoped and unscoped tools', (t) => {
  const f = fixture(t)
  assert.deepEqual(checkProjectConfiguration(f.root), {
    success: true,
    checkedDependencies: 3,
    findings: [],
  })
})

for (const [name, mutate, expected] of [
  [
    'release TypeScript metadata drift',
    (f: ReturnType<typeof fixture>) => {
      f.release.typescriptVersion = '7.0.3'
    },
    'release.json',
  ],
  [
    'release esbuild metadata drift',
    (f: ReturnType<typeof fixture>) => {
      f.release.esbuildVersion = '0.28.3'
    },
    'release.json',
  ],
  [
    'package product version drift',
    (f: ReturnType<typeof fixture>) => {
      f.pkg.version = '2.1.28'
    },
    'package.json',
  ],
  [
    'lock product version drift',
    (f: ReturnType<typeof fixture>) => {
      f.lock.version = '2.1.28'
    },
    'package-lock.json',
  ],
  [
    'lock root product version drift',
    (f: ReturnType<typeof fixture>) => {
      f.lock.packages['']!.version = '2.1.28'
    },
    'package-lock.json',
  ],
  [
    'non-exact dependency pin',
    (f: ReturnType<typeof fixture>) => {
      f.pkg.devDependencies.typescript = '^7.0.2'
    },
    'typescript',
  ],
  [
    'missing lock root declaration',
    (f: ReturnType<typeof fixture>) => {
      delete f.lock.packages['']!.devDependencies!.typescript
    },
    'typescript',
  ],
  [
    'extra lock root declaration',
    (f: ReturnType<typeof fixture>) => {
      f.lock.packages['']!.devDependencies!.extra = '1.0.0'
    },
    'extra',
  ],
  [
    'resolved lock version drift',
    (f: ReturnType<typeof fixture>) => {
      f.lock.packages['node_modules/typescript']!.version = '7.0.3'
    },
    'typescript',
  ],
  [
    'missing resolved lock entry',
    (f: ReturnType<typeof fixture>) => {
      delete f.lock.packages['node_modules/esbuild']
    },
    'esbuild',
  ],
  [
    'unsafe dependency path',
    (f: ReturnType<typeof fixture>) => {
      Object.assign(f.pkg.devDependencies, { '../outside': '1.0.0' })
    },
    '../outside',
  ],
] as const) {
  test('project configuration rejects ' + name, (t) => {
    const f = fixture(t)
    mutate(f)
    f.save()
    const result = checkProjectConfiguration(f.root)
    assert.equal(result.success, false)
    assert.ok(
      result.findings.some((item) => item.includes(expected)),
      result.findings.join('\n'),
    )
  })
}

test('project configuration rejects installed version drift', (t) => {
  const f = fixture(t)
  f.write('node_modules/typescript/package.json', { version: '7.0.3' })
  const result = checkProjectConfiguration(f.root)
  assert.equal(result.success, false)
  assert.ok(result.findings.some((item) => item.includes('node_modules/typescript/package.json')))
})

test('project configuration rejects missing installed package', (t) => {
  const f = fixture(t)
  rmSync(join(f.root, 'node_modules/esbuild/package.json'))
  assert.equal(checkProjectConfiguration(f.root).success, false)
})

test('project configuration rejects malformed configuration without throwing', (t) => {
  const f = fixture(t)
  writeFileSync(join(f.root, 'release.json'), '{')
  const result = checkProjectConfiguration(f.root)
  assert.equal(result.success, false)
  assert.ok(result.findings.some((item) => item.includes('release.json')))
})

test('project configuration rejects runtime dependencies', (t) => {
  const f = fixture(t)
  f.write('package.json', { ...f.pkg, dependencies: { unexpected: '1.0.0' } })
  assert.equal(checkProjectConfiguration(f.root).success, false)
})

for (const failing of [false, true]) {
  test(
    'project configuration leaves all files unchanged on ' + (failing ? 'failure' : 'success'),
    (t) => {
      const f = fixture(t)
      if (failing) f.write('node_modules/esbuild/package.json', { version: '9.0.0' })
      const snapshot = (path: string): string[] =>
        readdirSync(path, { withFileTypes: true })
          .flatMap((entry) => {
            const next = join(path, entry.name)
            return entry.isDirectory()
              ? snapshot(next)
              : [next + ':' + createHash('sha256').update(readFileSync(next)).digest('hex')]
          })
          .sort()
      const before = snapshot(f.root)
      assert.equal(checkProjectConfiguration(f.root).success, !failing)
      assert.deepEqual(snapshot(f.root), before)
    },
  )
}
