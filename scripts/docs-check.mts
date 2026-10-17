import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import GithubSlugger from 'github-slugger'
import { lint } from 'markdownlint/promise'

interface MarkdownNode {
  type: string
  value?: string | undefined
  alt?: string | null | undefined
  url?: string | undefined
  depth?: number | undefined
  identifier?: string | undefined
  children?: MarkdownNode[] | undefined
  position?:
    | {
        start: { line: number; offset?: number | undefined }
        end?: { offset?: number | undefined } | undefined
      }
    | undefined
}
export interface DocumentEntry {
  path: string
  kind: string
  topics: string[]
  versions: string[]
  date: string | null
  requiredAnchors: string[]
}
interface Protection {
  path: string
  mode: 'exact' | 'prefix'
  encoding: 'lf' | 'raw'
  bytes: number
  sha256: string
}
interface LinkException {
  source: string
  line: number
  url: string
  sha256: string
  reason: string
}
export interface DocumentationManifest {
  schemaVersion: 1
  baseline: string
  documents: DocumentEntry[]
  owners: { topic: string; path: string }[]
  navigation: { entry: string; maxDepth: number }
  versionFields: { path: string; pattern: string }[]
  protections: Protection[]
  immutableLinkExceptions: LinkException[]
  privateEvidenceReferences: LinkException[]
}
export interface DocumentationFinding {
  file: string
  line: number
  rule: string
  message: string
}
export interface DocumentationResult {
  schemaVersion: 1
  success: boolean
  files: number
  links: number
  externalLinksNotFetched: number
  protectedFiles: number
  findings: DocumentationFinding[]
  legacyLinks: LinkException[]
  privateEvidenceNotChecked: LinkException[]
}
const kinds = [
  'guide',
  'navigation',
  'status',
  'verification',
  'changelog',
  'journal',
  'record',
  'immutable',
  'compatibility',
]
const maintained = new Set(['guide', 'navigation', 'status', 'verification', 'changelog'])
const normalize = (value: string) => value.replaceAll('\r\n', '\n')
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected object')
  return value as Record<string, unknown>
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value) throw Error('Expected nonempty string')
  return value
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw Error('Expected string array')
  return value as string[]
}
function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw Error('Expected array')
  return value.map(object)
}
function localPath(value: unknown): string {
  const file = string(value)
  if (
    isAbsolute(file) ||
    /^[A-Za-z]:/.test(file) ||
    file.includes('\\') ||
    file.split('/').includes('..')
  )
    throw Error(`Expected repository-relative path: ${file}`)
  return file
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw Error('Expected nonnegative integer')
  return value
}
function sha(value: unknown): string {
  const result = string(value)
  if (!/^[a-f0-9]{64}$/.test(result)) throw Error('Expected SHA-256')
  return result
}
export function parseDocumentationManifest(value: unknown): DocumentationManifest {
  const raw = object(value)
  if (raw.schemaVersion !== 1) throw Error('Unsupported documentation schema')
  const navigation = object(raw.navigation)
  return {
    schemaVersion: 1,
    baseline: string(raw.baseline),
    owners: rows(raw.owners).map((row) => ({
      topic: string(row.topic),
      path: localPath(row.path),
    })),
    navigation: { entry: localPath(navigation.entry), maxDepth: integer(navigation.maxDepth) },
    documents: rows(raw.documents).map((row) => {
      const kind = string(row.kind)
      if (!kinds.includes(kind)) throw Error(`Unknown document kind: ${kind}`)
      return {
        path: localPath(row.path),
        kind,
        topics: strings(row.topics),
        versions: strings(row.versions),
        date: row.date === null ? null : string(row.date),
        requiredAnchors: strings(row.requiredAnchors),
      }
    }),
    versionFields: rows(raw.versionFields).map((row) => ({
      path: localPath(row.path),
      pattern: string(row.pattern),
    })),
    protections: rows(raw.protections).map((row) => {
      if (row.mode !== 'exact' && row.mode !== 'prefix') throw Error('Invalid protection mode')
      if (row.encoding !== 'lf' && row.encoding !== 'raw')
        throw Error('Invalid protection encoding')
      return {
        path: localPath(row.path),
        mode: row.mode,
        encoding: row.encoding,
        bytes: integer(row.bytes),
        sha256: sha(row.sha256),
      }
    }),
    immutableLinkExceptions: rows(raw.immutableLinkExceptions).map((row) => ({
      source: localPath(row.source),
      line: integer(row.line),
      url: string(row.url),
      sha256: sha(row.sha256),
      reason: string(row.reason),
    })),
    privateEvidenceReferences: rows(raw.privateEvidenceReferences ?? []).map((row) => ({
      source: localPath(row.source),
      line: integer(row.line),
      url: string(row.url),
      sha256: sha(row.sha256),
      reason: string(row.reason),
    })),
  }
}
function descendants(node: MarkdownNode): MarkdownNode[] {
  return [node, ...(node.children ?? []).flatMap(descendants)]
}
function plainText(node: MarkdownNode): string {
  if (node.type === 'html') return ''
  return node.value ?? node.alt ?? (node.children ?? []).map(plainText).join('')
}
export function markdownAnchors(source: string): ReadonlySet<string> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source)
  const slugger = new GithubSlugger(),
    result = new Set<string>()
  for (const node of descendants(tree)) {
    if (node.type === 'heading') result.add(slugger.slug(plainText(node)))
    if (node.type === 'html')
      for (const match of (node.value ?? '').matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/g))
        result.add(match[1]!)
  }
  return result
}
function markdownFiles(root: string, manifest: DocumentationManifest): string[] {
  if (existsSync(resolve(root, '.git')))
    return [
      ...new Set(
        execFileSync(
          'git',
          ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
          { cwd: root, encoding: 'utf8' },
        )
          .trim()
          .split('\n')
          .filter(Boolean),
      ),
    ].sort()
  const result: string[] = []
  function visit(file: string, recursive: boolean) {
    const absolute = resolve(root, file)
    if (!existsSync(absolute)) return
    if (statSync(absolute).isFile()) {
      if (file.endsWith('.md')) result.push(file)
      return
    }
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const child = file ? `${file}/${entry.name}` : entry.name
      if (entry.isFile() || recursive) visit(child, recursive)
    }
  }
  visit('', false)
  for (const directory of ['docs', 'tests-v2', 'archive/retired/docs']) visit(directory, true)
  // Root-level v1 local files are ignored, not public release snapshots.
  for (const directory of new Set(
    manifest.documents
      .filter((item) => item.kind === 'immutable')
      .map((item) => dirname(item.path)),
  ))
    visit(directory, true)
  visit('archive/README.md', false)
  visit('archive/retired/README.md', false)
  return [...new Set(result)].sort()
}
export async function checkDocumentation(root = process.cwd()): Promise<DocumentationResult> {
  const result: DocumentationResult = {
    schemaVersion: 1,
    success: false,
    files: 0,
    links: 0,
    externalLinksNotFetched: 0,
    protectedFiles: 0,
    findings: [],
    legacyLinks: [],
    privateEvidenceNotChecked: [],
  }
  const add = (file: string, rule: string, message: string, line = 1) =>
    result.findings.push({ file, line, rule, message })
  const read = (file: string) => normalize(readFileSync(resolve(root, file), 'utf8'))
  let manifest: DocumentationManifest
  try {
    manifest = parseDocumentationManifest(JSON.parse(read('docs/doc-manifest.json')) as unknown)
  } catch (error) {
    add(
      'docs/doc-manifest.json',
      'manifest',
      error instanceof Error ? error.message : 'Invalid manifest',
    )
    return result
  }
  const files = markdownFiles(root, manifest),
    entries = new Map<string, DocumentEntry>(),
    anchors = new Map<string, ReadonlySet<string>>(),
    trees = new Map<string, MarkdownNode>(),
    edges = new Map<string, Set<string>>()
  result.files = files.length
  for (const entry of manifest.documents) {
    if (
      ['guide', 'status', 'verification', 'changelog'].includes(entry.kind) &&
      !manifest.owners.some((owner) => owner.path === entry.path)
    )
      add(entry.path, 'ownership', 'Maintained authority has no owner declaration')
    if (entries.has(entry.path))
      add(entry.path, 'classification', 'Duplicate document classification')
    entries.set(entry.path, entry)
    if (!files.includes(entry.path))
      add(entry.path, 'classification', 'Registered document missing')
  }
  for (const file of files) {
    if (!entries.has(file)) add(file, 'classification', 'Public Markdown is not classified')
    const source = read(file)
    const tree = unified().use(remarkParse).use(remarkGfm).parse(source)
    trees.set(file, tree)
    // CommonMark leaves undefined full/collapsed references as text, not link nodes.
    // Inspect only those text spans; escaped syntax, code and HTML stay excluded.
    const label = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
    const definitions = new Set(
      descendants(tree)
        .filter((node) => node.type === 'definition')
        .map((node) => label(node.identifier ?? '')),
    )
    for (const node of descendants(tree).filter((item) => item.type === 'text')) {
      const raw =
        node.position?.start.offset !== undefined && node.position.end?.offset !== undefined
          ? source.slice(node.position.start.offset, node.position.end.offset)
          : (node.value ?? '')
      for (const match of raw.matchAll(/(?<!\\)!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g))
        if (!definitions.has(label(match[2] || match[1]!)))
          add(
            file,
            'reference',
            `Undefined reference: ${match[2] || match[1]}`,
            (node.position?.start.line ?? 1) + raw.slice(0, match.index).split('\n').length - 1,
          )
    }
    anchors.set(file, markdownAnchors(source))
    edges.set(file, new Set())
  }
  const topics = new Set<string>()
  for (const owner of manifest.owners) {
    if (topics.has(owner.topic)) add(owner.path, 'ownership', `Duplicate authority: ${owner.topic}`)
    topics.add(owner.topic)
    if (!entries.get(owner.path)?.topics.includes(owner.topic))
      add(owner.path, 'ownership', `Authority must declare its topic: ${owner.topic}`)
  }
  for (const entry of manifest.documents) {
    for (const anchor of entry.requiredAnchors)
      if (!anchors.get(entry.path)?.has(anchor))
        add(entry.path, 'compatibility-anchor', `Required anchor missing: ${anchor}`)
  }
  const protectedPaths = new Set<string>()
  for (const item of manifest.protections) {
    protectedPaths.add(item.path)
    if (!existsSync(resolve(root, item.path))) {
      add(item.path, 'preservation', 'Protected file missing')
      continue
    }
    const raw = readFileSync(resolve(root, item.path)),
      data = item.encoding === 'lf' ? Buffer.from(normalize(raw.toString('utf8'))) : raw,
      original = item.mode === 'prefix' ? data.subarray(0, item.bytes) : data
    if (
      data.length < item.bytes ||
      (item.mode === 'exact' && data.length !== item.bytes) ||
      digest(original) !== item.sha256
    )
      add(item.path, 'preservation', `Protected ${item.mode} content changed`)
    result.protectedFiles++
  }
  for (const entry of manifest.documents)
    if (['immutable', 'record', 'journal'].includes(entry.kind) && !protectedPaths.has(entry.path))
      add(entry.path, 'preservation', 'Historical document has no preservation baseline')
  const exceptionMatches = new Set<number>()
  const evidenceMatches = new Set<number>()
  for (const [file, tree] of trees) {
    const references = descendants(tree).filter((node) =>
      ['link', 'image', 'definition'].includes(node.type),
    )
    for (const node of descendants(tree).filter((item) => item.type === 'html'))
      for (const match of (node.value ?? '').matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g))
        references.push({
          type: 'link',
          url: match[1]!,
          ...(node.position ? { position: node.position } : {}),
        })
    for (const node of references) {
      const original = node.url!,
        line = node.position?.start.line ?? 1
      let url = original,
        base = dirname(resolve(root, file)),
        error = ''
      const github = url.match(
        /^https:\/\/github\.com\/YUIAOI7592\/BiliCDN_TW\/(?:blob|tree)\/main\/(.*)$/,
      )
      if (github) {
        url = github[1]!
        base = root
      } else if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) {
        result.externalLinksNotFetched++
        continue
      }
      result.links++
      try {
        const hashIndex = url.indexOf('#'),
          fragment = hashIndex < 0 ? '' : decodeURIComponent(url.slice(hashIndex + 1)),
          pathname = decodeURIComponent(
            (hashIndex < 0 ? url : url.slice(0, hashIndex)).split('?')[0]!,
          ),
          target = pathname ? resolve(base, pathname) : resolve(root, file),
          rel = relative(resolve(root), target)
        if (rel.replaceAll('\\', '/').startsWith('.work/')) {
          const index = manifest.privateEvidenceReferences.findIndex(
            (item) =>
              item.source === file &&
              item.line === line &&
              item.url === original &&
              item.sha256 === digest(read(file)) &&
              entries.get(file)?.kind === 'record' &&
              protectedPaths.has(file),
          )
          if (index >= 0) {
            evidenceMatches.add(index)
            result.privateEvidenceNotChecked.push(manifest.privateEvidenceReferences[index]!)
            result.links--
            continue
          }
          error = 'Private evidence link must be declared on a frozen record'
        } else if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
          error = 'Link leaves repository'
        else if (!existsSync(target)) error = 'Link target missing'
        else {
          const key = rel.replaceAll('\\', '/')
          if (key.endsWith('.md')) {
            edges.get(file)!.add(key)
            if (fragment && !anchors.get(key)?.has(fragment)) error = `Anchor missing: ${fragment}`
          }
        }
      } catch {
        error = 'Invalid encoded link'
      }
      if (!error) continue
      const index = manifest.immutableLinkExceptions.findIndex(
        (item) =>
          item.source === file &&
          item.line === line &&
          item.url === original &&
          item.sha256 === digest(read(file)) &&
          entries.get(file)?.kind === 'immutable' &&
          protectedPaths.has(file),
      )
      if (index >= 0) {
        exceptionMatches.add(index)
        result.legacyLinks.push(manifest.immutableLinkExceptions[index]!)
      } else add(file, 'link', `${error}: ${original}`, line)
    }
  }
  manifest.immutableLinkExceptions.forEach((item, index) => {
    if (!exceptionMatches.has(index))
      add(item.source, 'legacy-exception', `Unused or invalid exception: ${item.url}`, item.line)
  })
  manifest.privateEvidenceReferences.forEach((item, index) => {
    if (!evidenceMatches.has(index))
      add(
        item.source,
        'private-evidence',
        `Unused or invalid private evidence reference: ${item.url}`,
        item.line,
      )
  })
  const contents = Object.fromEntries(files.map((file) => [file, read(file)]))
  const formatting = await lint({
    strings: contents,
    config: {
      default: false,
      MD052: true,
    },
  })
  const current = Object.fromEntries(
    files
      .filter((file) => maintained.has(entries.get(file)?.kind ?? ''))
      .map((file) => [file, read(file)]),
  )
  const rules = await lint({
    strings: current,
    config: {
      default: true,
      MD013: false,
      MD024: { siblings_only: true },
      MD033: { allowed_elements: ['a', 'br', 'details', 'summary'] },
      MD041: false,
      MD060: false,
    },
  })
  for (const [file, errors] of Object.entries(formatting))
    for (const error of errors) add(file, 'reference', error.ruleDescription, error.lineNumber)
  for (const [file, errors] of Object.entries(rules))
    for (const error of errors)
      add(file, error.ruleNames[0]!, error.ruleDescription, error.lineNumber)
  for (const file of Object.keys(current)) {
    if (
      descendants(trees.get(file)!).filter((node) => node.type === 'heading' && node.depth === 1)
        .length !== 1
    )
      add(file, 'heading', 'Maintained document must have one main heading')
    for (const node of descendants(trees.get(file)!).filter(
      (item) => item.type === 'code' || item.type === 'inlineCode',
    ))
      for (const match of (node.value ?? '').matchAll(/\bnpm run ([\w:-]+)/g)) {
        try {
          const scripts = object(object(JSON.parse(read('package.json')) as unknown).scripts)
          if (typeof scripts[match[1]!] !== 'string')
            add(file, 'command', `Unknown npm command: ${match[1]}`, node.position?.start.line)
        } catch {
          add('package.json', 'command', 'Cannot read npm commands')
        }
      }
  }
  try {
    const release = object(JSON.parse(read('release.json')) as unknown),
      pkg = object(JSON.parse(read('package.json')) as unknown),
      lock = object(JSON.parse(read('package-lock.json')) as unknown),
      version = string(release.version)
    if (pkg.version !== version || lock.version !== version)
      add('release.json', 'version', 'Release/package/lock versions differ')
    for (const field of manifest.versionFields)
      if (new RegExp(field.pattern, 'm').exec(read(field.path))?.[1] !== version)
        add(field.path, 'version', 'Current version field differs from release.json')
  } catch (error) {
    add(
      'release.json',
      'version',
      error instanceof Error ? error.message : 'Invalid version inputs',
    )
  }
  const reached = new Set([manifest.navigation.entry])
  let frontier = [manifest.navigation.entry]
  for (let depth = 0; depth < manifest.navigation.maxDepth; depth++) {
    frontier = frontier.flatMap((file) =>
      [...(edges.get(file) ?? [])].filter((target) => !reached.has(target)),
    )
    for (const file of frontier) reached.add(file)
  }
  if (!entries.has(manifest.navigation.entry))
    add(manifest.navigation.entry, 'navigation', 'Navigation entry is not registered')
  for (const entry of manifest.documents)
    if (entry.kind !== 'immutable' && !reached.has(entry.path))
      add(entry.path, 'navigation', `Not reachable within ${manifest.navigation.maxDepth} clicks`)
  result.findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule),
  )
  result.success = result.findings.length === 0
  return result
}
export async function documentationCli(args: readonly string[], root = process.cwd()) {
  if (args.length > 1 || args.some((arg) => arg !== '--json'))
    return { exitCode: 2, output: 'Usage: npm run docs:check [-- --json]\n' }
  const report = await checkDocumentation(root)
  const output =
    args[0] === '--json'
      ? JSON.stringify(report, null, 2) + '\n'
      : report.findings
          .map((item) => `${item.file}:${item.line} [${item.rule}] ${item.message}\n`)
          .join('') +
        `Documentation ${report.success ? 'passed' : 'failed'}: ${report.files} Markdown files, ${report.links} local/repository links, ${report.legacyLinks.length} immutable legacy broken links; ${report.privateEvidenceNotChecked.length} private evidence references not checked, ${report.externalLinksNotFetched} external links not fetched.\n`
  return { exitCode: report.success ? 0 : 1, output }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/docs-check.mts')) {
  try {
    const cli = await documentationCli(process.argv.slice(2))
    process.stdout.write(cli.output)
    process.exitCode = cli.exitCode
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Documentation check failed')
    process.exitCode = 1
  }
}
