export interface StorageLock { readonly exclusive: boolean }
export type StorageRead<T> = { readonly ok: true; readonly value: T } | { readonly ok: false }
export interface StoragePort {
  readResult?<T>(key: string, fallback: T): StorageRead<T>
  sharedLockAvailable?(): boolean
  get<T>(key: string, fallback: T): T
  set<T>(key: string, value: T): void
  delete(key: string): void
  listen<T>(key: string, listener: (value: T, remote: boolean) => void): () => void
  withLock<T>(name: string, task: (lock?: StorageLock) => Promise<T> | T): Promise<T>
}
