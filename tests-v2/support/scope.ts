export const testScope = () => {
  const names = ['unsafeWindow', 'location', 'window', 'document', 'history', 'navigator', 'addEventListener', 'removeEventListener', 'queueMicrotask', 'GM_info', 'GM_setClipboard']
  const globals = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const timeout = globalThis.setTimeout, interval = globalThis.setInterval
  globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => { const id = timeout(...args); timers.add(id); return id }) as typeof setTimeout
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => { const id = interval(...args); timers.add(id); return id }) as typeof setInterval
  const cleanups: (() => void)[] = []
  return {
    defer(cleanup: () => void): void { cleanups.push(cleanup) },
    own<T extends { dispose(): void }>(resource: T): T { cleanups.push(() => resource.dispose()); return resource },
    dispose(): void {
      const errors: unknown[] = []
      try { for (const cleanup of cleanups.splice(0).reverse()) { try { cleanup() } catch (error) { errors.push(error) } } } finally {
        for (const timer of timers) { clearTimeout(timer); clearInterval(timer) }
        globalThis.setTimeout = timeout; globalThis.setInterval = interval
        for (const [name, descriptor] of globals) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor)
          else Reflect.deleteProperty(globalThis, name)
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Test cleanup failed')
    },
  }
}
