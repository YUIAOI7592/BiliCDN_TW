type Cleanup = () => void | Promise<void>
export function testScope(t: { after(hook: Cleanup, options: { timeout: number }): void }) {
  const cleanups: Cleanup[] = []
  const globals = new Map<PropertyKey, PropertyDescriptor | undefined>()
  let disposal: Promise<void> | undefined
  const open = (): void => { if (disposal) throw Error('Test scope already disposed') }
  const scope = {
    defer(cleanup: Cleanup): void { open(); cleanups.push(cleanup) },
    own<T extends { dispose(): void | Promise<void> }>(resource: T): T { scope.defer(() => resource.dispose()); return resource },
    defineGlobal(name: PropertyKey, descriptor: PropertyDescriptor): void {
      open()
      if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, descriptor)
    },
    dispose(): Promise<void> {
      if (disposal) return disposal
      // Defer execution one microtask so repeated/reentrant disposal sees the same promise.
      disposal = Promise.resolve().then(async () => {
        const errors: unknown[] = []
        for (const cleanup of cleanups.splice(0).reverse()) {
          try { await cleanup() } catch (error) { errors.push(error) }
        }
        for (const [name, descriptor] of [...globals].reverse()) {
          try {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor)
            else if (!Reflect.deleteProperty(globalThis, name)) throw Error('Cannot restore global: ' + String(name))
          } catch (error) { errors.push(error) }
        }
        globals.clear()
        if (errors.length) throw new AggregateError(errors, 'Test cleanup failed')
      })
      return disposal
    },
  }
  t.after(() => scope.dispose(), { timeout: 5000 })
  return scope
}
