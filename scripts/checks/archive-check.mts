import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

export interface ArchiveUrlEdit {
  start: number
  end: number
  from: string
  to: string
}
export interface ArchiveEntry {
  originalPath: string
  archivedPath: string
  kind: 'release' | 'record' | 'evidence'
  encoding: 'lf' | 'raw'
  bytes: number
  sha256: string
  archivedBytes: number
  archivedSha256: string
  urlEdits?: ArchiveUrlEdit[]
}
export interface HistoricalArchiveReference {
  source: string
  line: number
  url: string
  sha256: string
  originalTarget: string
  archivedTarget: string
  reason: string
}
interface ArchiveFileProof {
  path: string
  bytes: number
  sha256: string
}
export interface ArchiveManifest {
  schemaVersion: 1
  baseline: string
  snapshot: ArchiveFileProof
  entries: ArchiveEntry[]
  removedPaths: (ArchiveFileProof & { snapshotEntry: string; replacementPath: string })[]
  appendOnly: (ArchiveFileProof & { snapshotEntry: string })[]
  unchangedFiles: (ArchiveFileProof & { encoding: 'raw' })[]
  localManifest: string
  historicalReferences: HistoricalArchiveReference[]
}
export interface ArchiveFinding {
  file: string
  line: number
  rule: string
  message: string
}
export interface ArchiveResult {
  schemaVersion: 1
  success: boolean
  entries: number
  records: number
  unchangedFiles: number
  appendOnly: number
  localFiles: number
  localChecked: boolean
  checksumFiles: number
  checksums: number
  findings: ArchiveFinding[]
}
const manifestPath = 'archive/relocation-manifest.json'
const localRoot = 'archive/retired/local/2026-10-20-cleanup'
const rebuildableOutputs = new Set([
  'dist/BiliCDN_TW.user.js',
  'dist/BiliCDN_TW.user.js.map',
  'dist/build-manifest.json',
])
const normalize = (value: string) => value.replaceAll('\r\n', '\n')
const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected object')
  return value as Record<string, unknown>
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value) throw Error('Expected nonempty string')
  return value
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw Error('Expected nonnegative integer')
  return value
}
function sha(value: unknown): string {
  const text = string(value)
  if (!/^[a-f0-9]{64}$/.test(text)) throw Error('Expected SHA-256')
  return text
}
function localPath(value: unknown): string {
  const file = string(value)
  if (
    isAbsolute(file) ||
    /^[A-Za-z]:/.test(file) ||
    file.includes('\\') ||
    file.includes('\0') ||
    file.split('/').some((part) => !part || part === '.' || part === '..' || part.includes(':'))
  )
    throw Error(`Unsafe repository path: ${file}`)
  return file
}
function publicPath(value: unknown): string {
  const file = localPath(value)
  const key = file.normalize('NFC').toLowerCase()
  if (
    key.startsWith('.git/') ||
    key === '.git' ||
    key === '.work' ||
    key.startsWith('.work/') ||
    key === '.codex' ||
    key.startsWith('.codex/') ||
    key === 'archive/retired/local' ||
    key.startsWith('archive/retired/local/')
  )
    throw Error(`Private path in public archive manifest: ${file}`)
  return file
}
function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw Error('Expected array')
  return value.map(object)
}
function proof(row: Record<string, unknown>): ArchiveFileProof {
  return { path: publicPath(row.path), bytes: integer(row.bytes), sha256: sha(row.sha256) }
}
const pathKey = (file: string) => file.normalize('NFC').toLowerCase()
function uniquePaths(paths: readonly string[], label: string): void {
  if (new Set(paths.map(pathKey)).size !== paths.length) throw Error(`Duplicate ${label} path`)
}
function safeFile(root: string, file: string): string {
  localPath(file)
  const absolute = resolve(root, file)
  let cursor = absolute
  while (cursor !== resolve(root)) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink())
      throw Error(`Symbolic links are not archive files: ${file}`)
    const next = dirname(cursor)
    if (next === cursor) throw Error(`Path leaves repository: ${file}`)
    cursor = next
  }
  if (existsSync(absolute)) {
    const rel = relative(realpathSync(root), realpathSync(absolute))
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
      throw Error(`Path leaves repository: ${file}`)
  }
  return absolute
}
function read(root: string, file: string): Buffer {
  return readFileSync(safeFile(root, file))
}
function content(root: string, file: string, encoding: 'lf' | 'raw'): Buffer {
  const bytes = read(root, file)
  return encoding === 'lf' ? Buffer.from(normalize(bytes.toString('utf8'))) : bytes
}
function parseManifest(value: unknown): ArchiveManifest {
  const raw = object(value)
  if (raw.schemaVersion !== 1) throw Error('Unsupported archive schema')
  const baseline = string(raw.baseline)
  if (!/^[a-f0-9]{40}$/.test(baseline)) throw Error('Expected full baseline commit SHA')
  const entries = rows(raw.entries).map((row): ArchiveEntry => {
    if (!['release', 'record', 'evidence'].includes(string(row.kind)))
      throw Error('Invalid archive entry kind')
    if (row.encoding !== 'raw' && row.encoding !== 'lf') throw Error('Invalid archive encoding')
    const archivedPath = publicPath(row.archivedPath)
    if (!archivedPath.startsWith('archive/')) throw Error('Archive destination must be in archive/')
    const entry: ArchiveEntry = {
      originalPath: publicPath(row.originalPath),
      archivedPath,
      kind: row.kind as ArchiveEntry['kind'],
      encoding: row.encoding,
      bytes: integer(row.bytes),
      sha256: sha(row.sha256),
      archivedBytes: integer(row.archivedBytes),
      archivedSha256: sha(row.archivedSha256),
    }
    if (row.urlEdits !== undefined)
      entry.urlEdits = rows(row.urlEdits).map((edit) => ({
        start: integer(edit.start),
        end: integer(edit.end),
        from: string(edit.from),
        to: string(edit.to),
      }))
    return entry
  })
  const removedPaths = rows(raw.removedPaths).map((row) => ({
    ...proof(row),
    snapshotEntry: publicPath(row.snapshotEntry),
    replacementPath: publicPath(row.replacementPath),
  }))
  const appendOnly = rows(raw.appendOnly).map((row) => ({
    ...proof(row),
    snapshotEntry: publicPath(row.snapshotEntry),
  }))
  const unchangedFiles = rows(raw.unchangedFiles).map((row) => {
    if (row.encoding !== 'raw') throw Error('Unchanged files require raw hashes')
    return { ...proof(row), encoding: 'raw' as const }
  })
  const localManifest = localPath(raw.localManifest)
  if (pathKey(localManifest) !== `${localRoot}/private-manifest.json`)
    throw Error('Unexpected private archive manifest path')
  const historicalReferences = rows(raw.historicalReferences).map((row) => {
    const line = integer(row.line)
    if (line === 0) throw Error('Historical reference lines start at one')
    return {
      source: publicPath(row.source),
      line,
      url: string(row.url),
      sha256: sha(row.sha256),
      originalTarget: publicPath(row.originalTarget),
      archivedTarget: publicPath(row.archivedTarget),
      reason: string(row.reason),
    }
  })
  uniquePaths(
    entries.map((entry) => entry.originalPath),
    'original',
  )
  uniquePaths(
    [...entries.map((entry) => entry.originalPath), ...removedPaths.map((entry) => entry.path)],
    'original/removal',
  )
  uniquePaths(
    [...entries.map((entry) => entry.archivedPath), ...removedPaths.map((entry) => entry.path)],
    'destination/removal',
  )
  uniquePaths(
    appendOnly.map((entry) => entry.path),
    'append-only',
  )
  uniquePaths(
    unchangedFiles.map((entry) => entry.path),
    'unchanged',
  )
  const originals = new Set(entries.map((entry) => pathKey(entry.originalPath)))
  if (entries.some((entry) => originals.has(pathKey(entry.archivedPath))))
    throw Error('Archive destination collides with an original path')
  return {
    schemaVersion: 1,
    baseline,
    snapshot: proof(object(raw.snapshot)),
    entries,
    removedPaths,
    appendOnly,
    unchangedFiles,
    localManifest,
    historicalReferences,
  }
}
export function readArchiveManifest(root: string, relativePath = manifestPath): ArchiveManifest {
  return parseManifest(JSON.parse(read(root, publicPath(relativePath)).toString('utf8')) as unknown)
}

function tarString(header: Buffer, start: number, size: number): string {
  return header
    .subarray(start, start + size)
    .toString('utf8')
    .replace(/\0.*$/s, '')
}
function tarNumber(header: Buffer, start: number, size: number): number {
  const value = tarString(header, start, size).trim()
  if (!/^[0-7]*$/.test(value)) throw Error('Unsupported TAR number')
  const result = value ? parseInt(value, 8) : 0
  if (!Number.isSafeInteger(result)) throw Error('Oversized TAR number')
  return result
}
function paxFields(bytes: Buffer): Record<string, string> {
  const result: Record<string, string> = {}
  let cursor = 0
  while (cursor < bytes.length) {
    const space = bytes.indexOf(32, cursor)
    if (space < 0) throw Error('Invalid PAX record length')
    const digits = bytes.subarray(cursor, space).toString('ascii')
    if (!/^[1-9][0-9]*$/.test(digits)) throw Error('Invalid PAX record length')
    const length = Number(digits)
    if (
      !Number.isSafeInteger(length) ||
      length <= space - cursor + 2 ||
      cursor + length > bytes.length
    )
      throw Error('Truncated PAX record')
    const record = bytes.subarray(space + 1, cursor + length).toString('utf8')
    if (!record.endsWith('\n') || !record.includes('=')) throw Error('Invalid PAX record')
    const equal = record.indexOf('=')
    result[record.slice(0, equal)] = record.slice(equal + 1, -1)
    cursor += length
  }
  return result
}
/** Read git archive TAR bytes without extracting or following filesystem paths. */
export function readTarArchive(bytes: Uint8Array): ReadonlyMap<string, Buffer> {
  const input = Buffer.from(bytes),
    result = new Map<string, Buffer>(),
    names = new Set<string>()
  let cursor = 0,
    ended = false,
    nextPax: Record<string, string> = {}
  while (cursor + 512 <= input.length) {
    const header = input.subarray(cursor, cursor + 512)
    if (header.every((value) => value === 0)) {
      if (cursor + 1024 > input.length || input.subarray(cursor).some((value) => value !== 0))
        throw Error('Truncated or invalid TAR terminator')
      ended = true
      break
    }
    const expected = tarNumber(header, 148, 8)
    let actual = 0
    for (let index = 0; index < 512; index++)
      actual += index >= 148 && index < 156 ? 32 : header[index]!
    if (actual !== expected) throw Error('TAR header checksum mismatch')
    const type = String.fromCharCode(header[156]!),
      size = tarNumber(header, 124, 12),
      start = cursor + 512,
      end = start + size,
      padded = start + Math.ceil(size / 512) * 512
    if (end > input.length || padded > input.length) throw Error('Truncated TAR entry')
    const data = input.subarray(start, end)
    let name = tarString(header, 0, 100)
    const prefix = tarString(header, 345, 155)
    if (prefix) name = `${prefix}/${name}`
    localPath(type === '5' ? name.replace(/\/$/, '') : name)
    if (type === 'x' || type === 'g') {
      const fields = paxFields(data)
      if (fields.linkpath !== undefined) throw Error('TAR links are not permitted')
      if (type === 'g' && (fields.path !== undefined || fields.size !== undefined))
        throw Error('Global PAX cannot replace paths or sizes')
      if (type === 'x') nextPax = fields
    } else {
      if (nextPax.path !== undefined) name = nextPax.path
      if (nextPax.size !== undefined && Number(nextPax.size) !== size)
        throw Error('PAX size differs from TAR header')
      nextPax = {}
      if (type !== '0' && type !== '\0' && type !== '5')
        throw Error(`Unsupported TAR entry type: ${type}`)
      const key = localPath(type === '5' ? name.replace(/\/$/, '') : name)
      if (names.has(pathKey(key))) throw Error(`Duplicate TAR path: ${key}`)
      names.add(pathKey(key))
      if (type !== '5') result.set(key, Buffer.from(data))
      else if (size !== 0) throw Error('TAR directory has payload')
    }
    cursor = padded
  }
  if (!ended || Object.keys(nextPax).length) throw Error('Truncated TAR archive')
  return result
}

interface MarkdownNode {
  type: string
  url?: string
  children?: MarkdownNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}
const parser = () => unified().use(remarkParse).use(remarkGfm)
function withoutPositions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutPositions)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'position')
      .map(([key, item]) => [key, withoutPositions(item)]),
  )
}
function descendants(node: MarkdownNode): MarkdownNode[] {
  return [node, ...(node.children ?? []).flatMap(descendants)]
}
function reconstructedRecord(source: string, edits: readonly ArchiveUrlEdit[]): Buffer {
  let end = 0
  const tree = parser().parse(source) as MarkdownNode
  for (const edit of edits) {
    if (edit.start < end || edit.end <= edit.start || edit.end > source.length)
      throw Error('Overlapping or out-of-range URL edits')
    if (source.slice(edit.start, edit.end) !== edit.from)
      throw Error('URL edit original text differs')
    const nodes = descendants(tree),
      ownerIndex =
        nodes
          .map((node, index) => ({ node, index }))
          .filter(
            ({ node }) =>
              ['link', 'image', 'definition'].includes(node.type) &&
              (node.position?.start.offset ?? Infinity) <= edit.start &&
              (node.position?.end.offset ?? -1) >= edit.end,
          )
          .sort(
            (a, b) =>
              a.node.position!.end.offset! -
              a.node.position!.start.offset! -
              (b.node.position!.end.offset! - b.node.position!.start.offset!),
          )[0]?.index ?? -1
    const owner = nodes[ownerIndex]
    if (!owner) throw Error('Edit is not in a Markdown link URL')
    // Replacing just this range must change exactly the owning URL property.
    // A label, code span, title, HTML attribute, or syntax edit changes other AST data.
    const probe = 'https://archive-check.invalid/probe',
      altered = parser().parse(
        source.slice(0, edit.start) + probe + source.slice(edit.end),
      ) as MarkdownNode,
      before = withoutPositions(tree) as MarkdownNode,
      after = withoutPositions(altered) as MarkdownNode,
      originalOwner = descendants(before)[ownerIndex]
    if (!originalOwner) throw Error('Missing Markdown URL owner')
    const oldUrl = originalOwner.url!
    originalOwner.url = probe
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      originalOwner.url = oldUrl
      throw Error('URL edit also changes non-URL Markdown content')
    }
    const replacement = parser().parse(
        source.slice(0, edit.start) + edit.to + source.slice(edit.end),
      ) as MarkdownNode,
      replaced = withoutPositions(replacement) as MarkdownNode,
      changedOwner = descendants(replaced)[ownerIndex]
    if (!changedOwner?.url) throw Error('URL edit does not create a valid replacement URL')
    originalOwner.url = changedOwner.url
    if (JSON.stringify(before) !== JSON.stringify(replaced))
      throw Error('Replacement changes non-URL Markdown content')
    end = edit.end
  }
  let output = source
  for (const edit of [...edits].reverse())
    output = output.slice(0, edit.start) + edit.to + output.slice(edit.end)
  return Buffer.from(output)
}
function fileList(root: string, directory: string): string[] {
  const absolute = safeFile(root, directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`
    if (entry.isSymbolicLink()) throw Error(`Symbolic link in archive layout: ${file}`)
    return entry.isDirectory() ? fileList(root, file) : [file]
  })
}
function verifyProof(bytes: Buffer, expected: { bytes: number; sha256: string }): void {
  if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256)
    throw Error('Archive bytes or SHA-256 differ from the recorded baseline')
}
function checkChecksums(
  root: string,
  files: readonly string[],
  verificationRoot: string,
  registered: ReadonlySet<string>,
  result: ArchiveResult,
): void {
  for (const file of files) {
    result.checksumFiles++
    try {
      if (!registered.has(pathKey(file)))
        throw Error('Checksum list is not registered in the archive manifest')
      const lines = normalize(read(root, file).toString('utf8')).split('\n')
      if (lines.at(-1) === '') lines.pop()
      if (!lines.length) throw Error('Empty checksum list')
      const targets = new Set<string>()
      for (const [index, line] of lines.entries()) {
        try {
          const match = /^([a-f0-9]{64})  (.+)$/.exec(line)
          if (!match) throw Error('Invalid SHA256SUMS row')
          const target = localPath(match[2])
          if (!target.startsWith('Release/'))
            throw Error('Checksum target is not an original Release path')
          const archived = verificationRoot ? `${verificationRoot}/${target}` : target
          if (!registered.has(pathKey(archived)))
            throw Error('Checksum target is not registered in the archive manifest')
          if (targets.has(pathKey(target))) throw Error('Duplicate checksum target')
          targets.add(pathKey(target))
          if (digest(read(root, archived)) !== match[1]) throw Error('Release checksum mismatch')
          result.checksums++
        } catch (error) {
          result.findings.push({ file, line: index + 1, rule: 'checksum', message: message(error) })
        }
      }
    } catch (error) {
      result.findings.push({ file, line: 1, rule: 'checksum', message: message(error) })
    }
  }
}
const isChecksum = (file: string) => /(?:^|\/)SHA256SUMS_v[0-9.]+\.txt$/.test(file)
function checkLocal(root: string, manifest: ArchiveManifest, result: ArchiveResult): void {
  const raw = object(JSON.parse(read(root, manifest.localManifest).toString('utf8')) as unknown)
  if (
    raw.schemaVersion !== 1 ||
    raw.baseline !== manifest.baseline ||
    pathKey(localPath(raw.root)) !== localRoot
  )
    throw Error('Invalid private archive manifest identity')
  for (const row of rows(raw.unverified ?? [])) {
    const archivedPath = localPath(row.archivedPath)
    if (!pathKey(archivedPath).startsWith(`${localRoot}/`))
      throw Error('Unverified private destination is outside the cleanup archive')
    localPath(row.originalPath)
    result.findings.push({
      file: archivedPath,
      line: 1,
      rule: 'private-unverified',
      message: `Private archive bytes were not verified: ${string(row.reason)}`,
    })
  }
  const entries = rows(raw.entries).map((row) => {
    const archivedPath = localPath(row.archivedPath)
    const key = pathKey(archivedPath)
    if (
      !key.startsWith(`${localRoot}/`) ||
      key === `${localRoot}/operations` ||
      key.startsWith(`${localRoot}/operations/`)
    )
      throw Error('Private destination is outside the cleanup archive')
    return {
      originalPath: localPath(row.originalPath),
      archivedPath,
      bytes: integer(row.bytes),
      sha256: sha(row.sha256),
    }
  })
  uniquePaths(
    entries.map((entry) => entry.originalPath),
    'private original',
  )
  uniquePaths(
    entries.map((entry) => entry.archivedPath),
    'private destination',
  )
  if (!existsSync(resolve(root, '.git')))
    throw Error('Local archive checks require Git tracking state')
  const tracked = new Set(
    execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
      .map(pathKey),
  )
  const ignored = new Set(
    execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], {
      cwd: root,
      encoding: 'utf8',
      input:
        [manifest.localManifest, ...entries.map((entry) => entry.archivedPath)].join('\0') + '\0',
      maxBuffer: 32 * 1024 * 1024,
    })
      .split('\0')
      .filter(Boolean)
      .map(pathKey),
  )
  if (tracked.has(pathKey(manifest.localManifest)) || !ignored.has(pathKey(manifest.localManifest)))
    throw Error('Private archive manifest must be ignored and untracked')
  for (const entry of entries) {
    try {
      if (
        existsSync(safeFile(root, entry.originalPath)) &&
        !rebuildableOutputs.has(entry.originalPath)
      )
        throw Error('Private original path still exists')
      verifyProof(read(root, entry.archivedPath), entry)
      if (tracked.has(pathKey(entry.archivedPath)))
        throw Error('Private archive payload is tracked by Git')
      if (!ignored.has(pathKey(entry.archivedPath)))
        throw Error('Private archive payload is not ignored')
      result.localFiles++
    } catch (error) {
      result.findings.push({
        file: entry.archivedPath,
        line: 1,
        rule: 'private',
        message: message(error),
      })
    }
  }
  checkChecksums(
    root,
    fileList(root, `${localRoot}/Release`).filter(isChecksum),
    localRoot,
    new Set(entries.map((entry) => pathKey(entry.archivedPath))),
    result,
  )
}
export function checkArchive(
  root = process.cwd(),
  options: { local?: boolean } = {},
): ArchiveResult {
  const result: ArchiveResult = {
    schemaVersion: 1,
    success: false,
    entries: 0,
    records: 0,
    unchangedFiles: 0,
    appendOnly: 0,
    localFiles: 0,
    localChecked: options.local === true,
    checksumFiles: 0,
    checksums: 0,
    findings: [],
  }
  const attempt = (file: string, rule: string, action: () => void) => {
    try {
      action()
    } catch (error) {
      result.findings.push({ file, line: 1, rule, message: message(error) })
    }
  }
  let manifest: ArchiveManifest, snapshot: ReadonlyMap<string, Buffer>
  try {
    manifest = readArchiveManifest(root)
    const bytes = read(root, manifest.snapshot.path)
    verifyProof(bytes, manifest.snapshot)
    snapshot = readTarArchive(bytes)
  } catch (error) {
    result.findings.push({ file: manifestPath, line: 1, rule: 'manifest', message: message(error) })
    return result
  }
  for (const entry of manifest.entries)
    attempt(entry.archivedPath, 'relocation', () => {
      if (existsSync(safeFile(root, entry.originalPath)))
        throw Error('Original relocated path still exists')
      const archived = content(root, entry.archivedPath, entry.encoding)
      verifyProof(archived, { bytes: entry.archivedBytes, sha256: entry.archivedSha256 })
      if (entry.kind === 'record') {
        const bytes = snapshot.get(entry.originalPath)
        if (!bytes) throw Error('Record is missing from the original snapshot')
        const original =
          entry.encoding === 'lf' ? Buffer.from(normalize(bytes.toString('utf8'))) : bytes
        verifyProof(original, entry)
        const expected = reconstructedRecord(original.toString('utf8'), entry.urlEdits ?? [])
        if (!archived.equals(expected))
          throw Error('Archived record differs outside declared URL edits')
        result.records++
      } else {
        if (entry.urlEdits?.length) throw Error('Only historical records permit URL edits')
        verifyProof(archived, entry)
      }
      result.entries++
    })
  for (const entry of manifest.removedPaths)
    attempt(entry.path, 'removed', () => {
      const original = snapshot.get(entry.snapshotEntry)
      if (!original) throw Error('Removed compatibility document is missing from the snapshot')
      verifyProof(original, entry)
      if (existsSync(safeFile(root, entry.path)))
        throw Error('Removed compatibility path still exists')
      if (!existsSync(safeFile(root, entry.replacementPath)))
        throw Error('Compatibility replacement is missing')
    })
  for (const entry of manifest.appendOnly)
    attempt(entry.path, 'append-only', () => {
      const original = snapshot.get(entry.snapshotEntry)
      if (!original) throw Error('Append-only baseline is missing from the snapshot')
      verifyProof(original, entry)
      const current = content(root, entry.path, 'lf')
      if (!current.subarray(0, entry.bytes).equals(original))
        throw Error('Existing journal body was modified or truncated')
      result.appendOnly++
    })
  for (const entry of manifest.unchangedFiles)
    attempt(entry.path, 'unchanged', () => {
      verifyProof(read(root, entry.path), entry)
      result.unchangedFiles++
    })
  const publicReleases = manifest.entries.filter((entry) => entry.kind === 'release'),
    registeredReleases = new Set([
      ...publicReleases.map((entry) => pathKey(entry.archivedPath)),
      ...manifest.unchangedFiles
        .filter((entry) => entry.path.startsWith('Release/'))
        .map((entry) => pathKey(entry.path)),
    ])
  attempt('archive/retired/releases', 'checksum', () =>
    checkChecksums(
      root,
      fileList(root, 'archive/retired/releases/Release').filter(isChecksum),
      'archive/retired/releases',
      registeredReleases,
      result,
    ),
  )
  attempt('Release', 'checksum', () =>
    checkChecksums(
      root,
      fileList(root, 'Release').filter(isChecksum),
      '',
      registeredReleases,
      result,
    ),
  )
  attempt('Release', 'layout', () => {
    const config = object(JSON.parse(read(root, 'release.json').toString('utf8')) as unknown),
      version = string(config.version),
      artifact = localPath(config.artifactName)
    if (!/^\d+\.\d+\.\d+$/.test(version) || artifact.includes('/'))
      throw Error('Invalid release layout configuration')
    const expected = new Set([
        `Release/v${version}/${artifact}`,
        `Release/v${version}/BUILD_MANIFEST_v${version}.json`,
        `Release/v${version}/CHANGELOG_v${version}.md`,
        `Release/v${version}/TEST_REPORT_v${version}.md`,
        `Release/v${version}/SHA256SUMS_v${version}.txt`,
      ]),
      files = fileList(root, 'Release'),
      releaseDirectory = safeFile(root, 'Release'),
      children = existsSync(releaseDirectory)
        ? readdirSync(releaseDirectory, { withFileTypes: true })
        : []
    if (
      children.length &&
      (children.some((entry) => !entry.isDirectory() || entry.name !== `v${version}`) ||
        files.length !== 5 ||
        files.some((file) => !expected.has(file)))
    )
      throw Error('Release may contain only the current version and its five packaged files')
    const docs = object(
      JSON.parse(read(root, 'docs/doc-manifest.json').toString('utf8')) as unknown,
    )
    for (const document of rows(docs.documents))
      if (
        ['record', 'compatibility'].includes(string(document.kind)) &&
        string(document.path).startsWith('docs/')
      )
        throw Error(`Historical document remains under docs/: ${string(document.path)}`)
  })
  attempt('dist', 'layout', () => {
    const directory = safeFile(root, 'dist')
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true }))
      if (!entry.isFile() || !rebuildableOutputs.has(`dist/${entry.name}`))
        throw Error(`Only the three normal rebuildable outputs may remain in dist/: ${entry.name}`)
  })
  if (options.local)
    attempt(manifest.localManifest, 'private', () => checkLocal(root, manifest, result))
  result.findings.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule))
  result.success = result.findings.length === 0
  return result
}
export function archiveCli(args: readonly string[], root = process.cwd()) {
  if (
    new Set(args).size !== args.length ||
    args.some((arg) => arg !== '--json' && arg !== '--local')
  )
    return { exitCode: 2, output: 'Usage: npm run archive:check [-- --local] [--json]\n' }
  const report = checkArchive(root, { local: args.includes('--local') })
  return {
    exitCode: report.success ? 0 : 1,
    output: args.includes('--json')
      ? JSON.stringify(report, null, 2) + '\n'
      : report.findings
          .map((item) => `${item.file}:${item.line} [${item.rule}] ${item.message}\n`)
          .join('') +
        `Archive ${report.success ? 'passed' : 'failed'}: ${report.entries} relocated files, ${report.appendOnly} append-only journals, ${report.unchangedFiles} unchanged files; ${report.checksumFiles} checksum files / ${report.checksums} verified rows; local ${report.localChecked ? `${report.localFiles} files checked` : 'not requested'}.\n`,
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/checks/archive-check.mts')) {
  try {
    const cli = archiveCli(process.argv.slice(2))
    process.stdout.write(cli.output)
    process.exitCode = cli.exitCode
  } catch (error) {
    console.error(message(error))
    process.exitCode = 1
  }
}
