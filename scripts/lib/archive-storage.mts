import {
  createReadStream,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

export interface StoredProof {
  bytes: number
  sha256: string
}
export interface PackedFile extends StoredProof {
  path: string
}
export interface ArchiveBundle extends StoredProof {
  path: string
  tarBytes: number
  inventory: PackedFile
  files: PackedFile[]
}
const key = (path: string) => path.normalize('NFC').toLowerCase()
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
export function archivePath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    isAbsolute(value) ||
    value.includes('\\') ||
    value
      .split('/')
      .some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          /[<>:"|?*\u0000-\u001f]/.test(part) ||
          /[ .]$/.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  )
    throw Error('Unsafe archive path')
  return value
}
const privatePath = (path: string) =>
  /^(?:\.git|\.work|\.codex)(?:\/|$)|^archive\/(?:retired\/local(?:\/|$)|pre-upstream-)/i.test(path)
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Expected archive object')
  return value as Record<string, unknown>
}
function proof(value: unknown): StoredProof {
  const row = object(value)
  if (
    !Number.isSafeInteger(row.bytes) ||
    (row.bytes as number) < 0 ||
    typeof row.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.sha256)
  )
    throw Error('Invalid archive proof')
  return { bytes: row.bytes as number, sha256: row.sha256 }
}
export function parseArchiveBundles(value: unknown, allowPrivate = false): ArchiveBundle[] {
  if (!Array.isArray(value)) throw Error('Expected archive bundle array')
  const paths = new Set<string>(),
    files = new Set<string>(),
    inventories = new Set<string>()
  return value.map((item) => {
    const row = object(item),
      path = archivePath(row.path)
    if (
      (!allowPrivate && privatePath(path)) ||
      (!path.startsWith('archive/retired/bundles/') &&
        !(allowPrivate && path.startsWith('archive/retired/local/bundles/')))
    )
      throw Error('Private or invalid archive bundle location')
    if (!path.endsWith('.tar.gz') || paths.has(key(path)))
      throw Error('Duplicate or invalid archive bundle path')
    paths.add(key(path))
    if (!Number.isSafeInteger(row.tarBytes) || (row.tarBytes as number) < 1024)
      throw Error('Invalid TAR size')
    const inventoryRaw = object(row.inventory),
      inventoryPath = archivePath(inventoryRaw.path)
    if (
      !/^_archive-manifests\/[^/]+\.json$/.test(inventoryPath) ||
      inventories.has(key(inventoryPath))
    )
      throw Error('Duplicate or invalid inventory path')
    inventories.add(key(inventoryPath))
    const inventory = { path: inventoryPath, ...proof(inventoryRaw) }
    if (inventory.bytes > 16 * 1024 * 1024) throw Error('Oversized archive inventory')
    if (!Array.isArray(row.files) || row.files.length > 65536)
      throw Error('Invalid archive members')
    const members = row.files.map((value) => {
      const member = object(value),
        path = archivePath(member.path)
      if (!key(path).startsWith('archive/') || (!allowPrivate && privatePath(path)))
        throw Error('Private or invalid public archive member')
      if (files.has(key(path))) throw Error('Duplicate logical archive path')
      files.add(key(path))
      return { path, ...proof(member) }
    })
    return { path, ...proof(row), tarBytes: row.tarBytes as number, inventory, files: members }
  })
}
export function safeArchiveFile(root: string, file: string): string {
  archivePath(file)
  const base = resolve(root),
    absolute = resolve(base, file)
  let cursor = absolute
  while (true) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw Error('Linked archive path')
    if (cursor === base) break
    const parent = dirname(cursor)
    if (parent === cursor) throw Error('Archive path leaves root')
    cursor = parent
  }
  if (existsSync(absolute)) {
    const rel = relative(realpathSync(base), realpathSync(absolute))
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
      throw Error('Archive path leaves root')
  }
  return absolute
}
async function streamProof(path: string): Promise<StoredProof> {
  const digest = createHash('sha256')
  let bytes = 0
  for await (const part of createReadStream(path)) {
    bytes += part.length
    digest.update(part)
  }
  return { bytes, sha256: digest.digest('hex') }
}
function verify(actual: StoredProof, expected: StoredProof): void {
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256)
    throw Error('Archive bytes or SHA-256 differ from the recorded baseline')
}
function text(header: Buffer, at: number, size: number) {
  return header
    .subarray(at, at + size)
    .toString('utf8')
    .replace(/\0.*$/s, '')
}
function octal(header: Buffer, at: number, size: number) {
  const value = text(header, at, size).trim()
  if (!/^[0-7]*$/.test(value)) throw Error('Invalid TAR number')
  const number = value ? parseInt(value, 8) : 0
  if (!Number.isSafeInteger(number)) throw Error('Oversized TAR number')
  return number
}
export function readArchivePax(bytes: Buffer): Record<string, string> {
  const fields: Record<string, string> = Object.create(null)
  for (let cursor = 0; cursor < bytes.length;) {
    const space = bytes.indexOf(32, cursor),
      digits = bytes.subarray(cursor, space).toString('ascii')
    if (space < 0 || !/^[1-9][0-9]*$/.test(digits)) throw Error('Invalid PAX record')
    const size = Number(digits),
      end = cursor + size
    if (!Number.isSafeInteger(size) || size <= space - cursor + 2 || end > bytes.length)
      throw Error('Truncated PAX record')
    const field = bytes.subarray(space + 1, end).toString('utf8'),
      equal = field.indexOf('=')
    if (!field.endsWith('\n') || equal < 1) throw Error('Invalid PAX field')
    const name = field.slice(0, equal)
    if (
      ![
        'path',
        'size',
        'mtime',
        'atime',
        'ctime',
        'uid',
        'gid',
        'uname',
        'gname',
        'comment',
      ].includes(name)
    )
      throw Error('Unsupported PAX interpretation field')
    if (Object.hasOwn(fields, name)) throw Error('Duplicate PAX field')
    fields[name] = field.slice(equal + 1, -1)
    cursor = end
  }
  return fields
}

/** One invocation owns its buffers; private payloads are hashed, with bounded metadata opt-in. */
export class ArchiveStorage {
  readonly #root: string
  readonly #buffers = new Map<string, Buffer>()
  readonly #proofs = new Map<string, StoredProof>()
  readonly #logical = new Map<string, string>()
  readonly #inventories = new Map<string, StoredProof>()
  #capturedBytes = 0
  constructor(root: string) {
    this.#root = resolve(root)
  }
  get capturedBytes() {
    return this.#capturedBytes
  }
  static async open(
    root: string,
    bundles: readonly ArchiveBundle[],
    options: { private?: boolean; metadataPaths?: ReadonlySet<string> } = {},
  ) {
    const storage = new ArchiveStorage(root)
    for (const bundle of parseArchiveBundles(bundles, options.private === true))
      await storage.#load(
        bundle,
        options.private === true,
        new Set([...(options.metadataPaths ?? [])].map(key)),
      )
    return storage
  }
  paths(): readonly string[] {
    return [...this.#logical.values()]
  }
  has(path: string): boolean {
    return this.#proofs.has(key(path)) || existsSync(safeArchiveFile(this.#root, path))
  }
  isPacked(path: string): boolean {
    return this.#proofs.has(key(path))
  }
  read(path: string): Buffer {
    const packed = this.#buffers.get(key(path))
    if (packed) return packed
    if (this.#proofs.has(key(path))) throw Error('Private payload is not captured')
    return readFileSync(safeArchiveFile(this.#root, path))
  }
  proof(path: string): StoredProof {
    const packed = this.#proofs.get(key(path))
    if (packed) return packed
    const bytes = this.read(path)
    return { bytes: bytes.length, sha256: hash(bytes) }
  }
  async physicalProof(path: string): Promise<StoredProof> {
    const packed = this.#proofs.get(key(path))
    return packed ?? streamProof(safeArchiveFile(this.#root, path))
  }
  async #load(
    bundle: ArchiveBundle,
    privatePayload: boolean,
    metadataPaths: ReadonlySet<string>,
  ): Promise<void> {
    const expected = new Map(bundle.files.map((file) => [`payload/${file.path}`, file]))
    expected.set(bundle.inventory.path, bundle.inventory)
    const seen = new Set<string>(),
      compressedHash = createHash('sha256')
    let compressedBytes = 0,
      total = 0,
      pending: Buffer = Buffer.alloc(0),
      remaining = 0,
      padding = 0,
      zeros = 0
    let current: PackedFile | undefined,
      currentName = '',
      currentType = '',
      currentHash = createHash('sha256'),
      chunks: Buffer[] = [],
      capture = false
    let stage: 'header' | 'body' | 'padding' | 'end' = 'header',
      nextPax: Record<string, string> = {},
      pendingPax = false
    let inventoryBytes: Buffer | undefined
    const finish = () => {
      if (currentType === 'x' || currentType === 'g') {
        const fields = readArchivePax(Buffer.concat(chunks))
        if (currentType === 'g' && (fields.path !== undefined || fields.size !== undefined))
          throw Error('Global PAX changes paths or sizes')
        if (currentType === 'x') {
          nextPax = fields
          pendingPax = true
        }
      } else {
        if (!current) throw Error('Missing TAR member')
        verify({ bytes: current.bytes, sha256: currentHash.digest('hex') }, current)
        const bytes = capture ? Buffer.concat(chunks) : undefined
        if (currentName === bundle.inventory.path) inventoryBytes = bytes
        else {
          const path = current.path,
            identity = key(path)
          if (this.#proofs.has(identity)) throw Error('Duplicate logical archive path')
          this.#proofs.set(identity, { bytes: current.bytes, sha256: current.sha256 })
          this.#logical.set(identity, path)
          if (bytes) {
            this.#buffers.set(identity, bytes)
            this.#capturedBytes += bytes.length
          }
        }
      }
      chunks = []
      current = undefined
    }
    const feed = (chunk: Buffer) => {
      total += chunk.length
      if (total > bundle.tarBytes) throw Error('TAR output exceeds declared size')
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk
      while (
        pending.length ||
        (stage === 'body' && remaining === 0) ||
        (stage === 'padding' && padding === 0)
      ) {
        if (stage === 'end') {
          if (pending.some((byte) => byte !== 0)) throw Error('Nonzero TAR trailer')
          zeros += pending.length
          pending = Buffer.alloc(0)
          break
        }
        if (stage === 'body') {
          const size = Math.min(remaining, pending.length),
            part = pending.subarray(0, size)
          if (capture && size) chunks.push(Buffer.from(part))
          if (currentType !== 'x' && currentType !== 'g') currentHash.update(part)
          remaining -= size
          pending = pending.subarray(size)
          if (remaining) break
          finish()
          stage = 'padding'
          continue
        }
        if (stage === 'padding') {
          const size = Math.min(padding, pending.length)
          if (pending.subarray(0, size).some((byte) => byte !== 0))
            throw Error('Invalid TAR padding')
          padding -= size
          pending = pending.subarray(size)
          if (padding) break
          stage = 'header'
          continue
        }
        if (pending.length < 512) break
        const header = pending.subarray(0, 512)
        pending = pending.subarray(512)
        if (header.every((byte) => byte === 0)) {
          stage = 'end'
          zeros = 512
          continue
        }
        let checksum = 0
        for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i]!
        if (octal(header, 148, 8) !== checksum) throw Error('TAR checksum mismatch')
        if (!['ustar\0', 'ustar '].includes(header.subarray(257, 263).toString('ascii')))
          throw Error('Unsupported TAR format')
        currentType = String.fromCharCode(header[156]!)
        if (!['0', '\0', 'x', 'g'].includes(currentType))
          throw Error('Unsupported TAR entry type or link')
        const size = octal(header, 124, 12),
          prefix = text(header, 345, 155)
        currentName = (prefix ? prefix + '/' : '') + text(header, 0, 100)
        if (currentType === 'x' || currentType === 'g') {
          if (pendingPax) throw Error('Consecutive PAX extension headers')
          if (currentName !== '././@PaxHeader') archivePath(currentName)
          if (size > 128 * 1024) throw Error('Oversized PAX metadata')
          capture = true
        } else {
          currentName = nextPax.path ?? currentName
          if (
            nextPax.size !== undefined &&
            (!/^[0-9]+$/.test(nextPax.size) || Number(nextPax.size) !== size)
          )
            throw Error('PAX size mismatch')
          nextPax = {}
          pendingPax = false
          archivePath(currentName)
          const identity = key(currentName)
          if (seen.has(identity)) throw Error('Duplicate TAR member')
          seen.add(identity)
          current = expected.get(currentName)
          if (!current) throw Error('Unregistered TAR member')
          if (current.bytes !== size) throw Error('TAR member exceeds declared bytes')
          capture =
            currentName === bundle.inventory.path ||
            !privatePayload ||
            metadataPaths.has(key(current.path)) ||
            /(?:^|\/)SHA256SUMS_v[0-9.]+\.txt$/.test(current.path)
          if (privatePayload && capture && size > 16 * 1024 * 1024)
            throw Error('Private verification metadata exceeds 16 MiB')
          if (capture && size > 256 * 1024 * 1024)
            throw Error('Captured public member exceeds 256 MiB')
          currentHash = createHash('sha256')
        }
        remaining = size
        padding = (512 - (size % 512)) % 512
        chunks = []
        stage = 'body'
      }
    }
    await pipeline(
      createReadStream(safeArchiveFile(this.#root, bundle.path)),
      async function* (source) {
        for await (const chunk of source) {
          const bytes = Buffer.from(chunk)
          compressedBytes += bytes.length
          if (compressedBytes > bundle.bytes)
            throw Error('Compressed archive exceeds declared size')
          compressedHash.update(bytes)
          yield bytes
        }
      },
      createGunzip(),
      async (source) => {
        for await (const chunk of source) feed(Buffer.from(chunk))
      },
    )
    verify({ bytes: compressedBytes, sha256: compressedHash.digest('hex') }, bundle)
    if (total !== bundle.tarBytes || (stage as string) !== 'end' || zeros < 1024 || pendingPax)
      throw Error('Truncated TAR archive')
    if (seen.size !== expected.size || !inventoryBytes)
      throw Error('Missing TAR members or inventory')
    const inventory = object(JSON.parse(inventoryBytes.toString('utf8')) as unknown)
    if (
      inventory.schemaVersion !== 1 ||
      !Array.isArray(inventory.files) ||
      inventory.files.length !== bundle.files.length
    )
      throw Error('Invalid archive inventory')
    const inventorySeen = new Set<string>()
    for (const value of inventory.files) {
      const row = object(value),
        path = archivePath(row.path),
        identity = key(path)
      if (inventorySeen.has(identity)) throw Error('Duplicate inventory member')
      inventorySeen.add(identity)
      const member = expected.get(`payload/${path}`)
      if (!member) throw Error('Inventory contains unregistered member')
      verify(proof(row), member)
    }
    this.#inventories.set(bundle.inventory.path, bundle.inventory)
  }
  async verifyRestore(root: string, additional: readonly ArchiveStorage[] = []): Promise<void> {
    const restored = resolve(root)
    if (!existsSync(restored)) throw Error('Restore root missing')
    for (let cursor = restored; ; cursor = dirname(cursor)) {
      if (lstatSync(cursor).isSymbolicLink()) throw Error('Linked restore root')
      if (dirname(cursor) === cursor) break
    }
    const expected = new Map<string, StoredProof>()
    for (const storage of [this, ...additional]) {
      for (const [identity, path] of storage.#logical)
        expected.set(`payload/${path}`, storage.#proofs.get(identity)!)
      for (const [path, proof] of storage.#inventories) expected.set(path, proof)
    }
    const found = new Set<string>()
    const directories = new Set<string>()
    for (const path of expected.keys()) {
      const parts = path.split('/')
      for (let count = 1; count < parts.length; count++)
        directories.add(parts.slice(0, count).join('/'))
    }
    const visit = async (directory: string) => {
      for (const entry of readdirSync(safeArchiveFile(restored, directory), {
        withFileTypes: true,
      })) {
        const path = `${directory}/${entry.name}`
        if (entry.isSymbolicLink()) throw Error('Linked restored member')
        if (entry.isDirectory()) {
          if (!directories.has(path)) throw Error('Extra unregistered restored directory')
          await visit(path)
        } else {
          if (lstatSync(safeArchiveFile(restored, path)).nlink > 1)
            throw Error('Hard-linked restored member')
          const record = expected.get(path)
          if (!record) throw Error('Extra unregistered restored file')
          verify(await streamProof(safeArchiveFile(restored, path)), record)
          found.add(path)
        }
      }
    }
    const payload = resolve(restored, 'payload')
    if (!existsSync(payload)) throw Error('Restored payload missing')
    await visit('payload')
    if (existsSync(resolve(restored, '_archive-manifests'))) await visit('_archive-manifests')
    for (const path of expected.keys())
      if (!found.has(path)) throw Error(`Restored member missing: ${path}`)
    for (const entry of readdirSync(restored))
      if (entry !== 'payload' && entry !== '_archive-manifests')
        throw Error('Extra restored root entry')
  }
}
