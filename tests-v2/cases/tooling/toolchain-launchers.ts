import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { supervise } from '../../../scripts/testing/test-process.mts'
import { testScope } from '../../support/scope.ts'

function launcherResources(t: Parameters<typeof testScope>[0]) {
  const scope = testScope(t),
    root = mkdtempSync(join(tmpdir(), 'bilicdn-launcher-'))
  scope.defer(() => rmSync(root, { recursive: true }))
  mkdirSync(join(root, 'scripts'))
  for (const name of ['verify.ps1', 'verify.sh'])
    writeFileSync(join(root, 'scripts', name), readFileSync('scripts/' + name))
  return { root }
}

function powershellNode(root: string, name: string, code = 0) {
  const file = join(root, name + '.ps1')
  writeFileSync(
    file,
    `param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)\n@{id='${name}';cwd=(Get-Location).Path;args=@($Rest)}|ConvertTo-Json -Compress\nexit ${code}\n`,
  )
  return file
}

async function powershellRun(
  root: string,
  explicit: string,
  environment: string,
  fallback: string,
) {
  const driver = join(root, 'driver.ps1')
  writeFileSync(
    driver,
    `param([string]$Root,[string]$Explicit,[string]$Environment,[string]$Fallback)\n$env:BILICDN_NODE=$Environment\n$env:PATH=$Fallback+[IO.Path]::PathSeparator+$env:PATH\n$entry=Join-Path $Root 'scripts/verify.ps1'\nif($Explicit -eq '__none__'){& $entry}else{& $entry -NodePath $Explicit}\nexit $LASTEXITCODE\n`,
  )
  return supervise('pwsh', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    driver,
    '-Root',
    root,
    '-Explicit',
    explicit,
    '-Environment',
    environment,
    '-Fallback',
    fallback,
  ])
}

if (process.platform === 'win32') {
  test('TOOLCHAIN PowerShell explicit path wins over environment and preserves spaces', async (t) => {
    const { root } = launcherResources(t)
    const selected = powershellNode(root, 'explicit path with spaces'),
      other = powershellNode(root, 'environment')
    const result = await powershellRun(root, selected, other, root)
    assert.equal(result.code, 0, result.stderr)
    const value = JSON.parse(result.stdout)
    assert.equal(value.id, 'explicit path with spaces')
    const actualDirectory = statSync(value.cwd, { bigint: true }),
      expectedDirectory = statSync(root, { bigint: true })
    assert.equal(actualDirectory.isDirectory(), true)
    assert.notEqual(expectedDirectory.ino, 0n, 'directory identity must be available')
    assert.deepEqual(
      [actualDirectory.dev, actualDirectory.ino],
      [expectedDirectory.dev, expectedDirectory.ino],
    )
    assert.deepEqual(value.args, ['scripts/verify.mts'])
  })
  test('TOOLCHAIN PowerShell environment path is selected without an explicit argument', async (t) => {
    const { root } = launcherResources(t)
    const result = await powershellRun(
      root,
      '__none__',
      powershellNode(root, 'environment with spaces'),
      root,
    )
    assert.equal(result.code, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).id, 'environment with spaces')
  })
  test('TOOLCHAIN PowerShell PATH fallback preserves the original CLI', async (t) => {
    const { root } = launcherResources(t)
    powershellNode(root, 'node')
    const result = await powershellRun(root, '__none__', '', root)
    assert.equal(result.code, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).id, 'node')
  })
  test('TOOLCHAIN PowerShell returns the selected process failure and rejects missing paths', async (t) => {
    const { root } = launcherResources(t)
    assert.equal(
      (await powershellRun(root, powershellNode(root, 'failure', 17), '', root)).code,
      17,
    )
    assert.notEqual((await powershellRun(root, join(root, 'missing node.ps1'), '', root)).code, 0)
  })
}

function shellNode(root: string, name: string, code = 0) {
  const file = join(root, name)
  writeFileSync(file, `#!/bin/sh\nprintf '{"id":"${name}","args":"%s"}\\n' "$*"\nexit ${code}\n`, {
    mode: 0o755,
  })
  return file.replaceAll('\\', '/')
}

async function shellRun(root: string, environment: string) {
  const shell =
    process.platform === 'win32'
      ? resolve(
          execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
          '../../..',
          'bin/sh.exe',
        )
      : 'sh'
  const driver = join(root, 'driver.sh')
  writeFileSync(
    driver,
    '#!/bin/sh\nBILICDN_NODE="$2"\nexport BILICDN_NODE\nPATH="$1:$PATH"\nexport PATH\nexec /bin/sh "$1/scripts/verify.sh"\n',
  )
  const shellRoot =
    process.platform === 'win32'
      ? root
          .replaceAll('\\', '/')
          .replace(/^([a-z]):\//i, (_, drive: string) => '/' + drive.toLowerCase() + '/')
      : root
  return supervise(shell, [driver.replaceAll('\\', '/'), shellRoot, environment])
}

test('TOOLCHAIN Shell environment path preserves spaces and passes the script argument', async (t) => {
  const { root } = launcherResources(t)
  const result = await shellRun(root, shellNode(root, 'node with spaces'))
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {
    id: 'node with spaces',
    args: 'scripts/verify.mts',
  })
})

test('TOOLCHAIN Shell PATH fallback preserves the original CLI', async (t) => {
  const { root } = launcherResources(t)
  shellNode(root, 'node')
  const result = await shellRun(root, '')
  assert.equal(result.code, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).id, 'node')
})

test('TOOLCHAIN Shell preserves failure exit codes and rejects nonexistent executables', async (t) => {
  const { root } = launcherResources(t)
  assert.equal((await shellRun(root, shellNode(root, 'failure', 17))).code, 17)
  assert.notEqual((await shellRun(root, join(root, 'missing node'))).code, 0)
})
