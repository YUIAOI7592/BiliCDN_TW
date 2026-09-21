export interface StoragePort {
  get<T>(key: string, fallback: T): T
  set<T>(key: string, value: T): void
  delete(key: string): void
  listen<T>(key: string, listener: (value: T, remote: boolean) => void): () => void
  withLock<T>(name: string, task: () => Promise<T> | T): Promise<T>
}

export class TampermonkeyStorage implements StoragePort {
  get<T>(key: string, fallback: T): T {
    try { return GM_getValue<T>(key, fallback) } catch { return fallback }
  }

  set<T>(key: string, value: T): void {
    GM_setValue(key, value)
  }

  delete(key: string): void {
    try { GM_deleteValue(key) } catch { /* fail-open */ }
  }

  listen<T>(key: string, listener: (value: T, remote: boolean) => void): () => void {
    if (typeof GM_addValueChangeListener !== 'function') return () => undefined
    let id: number
    try {
      id = GM_addValueChangeListener<T>(key, (_name, _oldValue, value, remote) => listener(value, remote))
    } catch {
      return () => undefined
    }
    return () => {
      try { GM_removeValueChangeListener(id) } catch { /* fail-open */ }
    }
  }

  async withLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
    const manager = navigator.locks
    if (!manager?.request) return await task()
    return await manager.request(`bilicdn.v2.${name}`, async () => await task())
  }
}
