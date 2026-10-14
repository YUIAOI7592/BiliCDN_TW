export interface StoragePort {
  get<T>(key: string, fallback: T): T
  set<T>(key: string, value: T): void
  delete(key: string): void
  listen<T>(key: string, listener: (value: T, remote: boolean) => void): () => void
  withLock<T>(name: string, task: () => Promise<T> | T): Promise<T>
}
