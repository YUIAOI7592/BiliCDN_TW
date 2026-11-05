import { FakeStorage } from './storage.ts'
import type { StorageLock } from '../../src-v2/platform/storage-port.ts'

/** One shared FIFO per name; unlike FakeStorage, this actually serializes callers. */
export class SharedEvidenceStorage extends FakeStorage {
  #queues = new Map<string, Promise<unknown>>()
  sharedLockAvailable(): boolean {
    return true
  }
  readResult<T>(key: string, fallback: T): { ok: true; value: T } | { ok: false } {
    return { ok: true, value: this.get(key, fallback) }
  }
  override async withLock<T>(
    name: string,
    task: (lock?: StorageLock) => Promise<T> | T,
  ): Promise<T> {
    const previous = this.#queues.get(name) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(() => task({ exclusive: true }))
    this.#queues.set(name, next)
    try {
      return await next
    } finally {
      if (this.#queues.get(name) === next) this.#queues.delete(name)
    }
  }
}
