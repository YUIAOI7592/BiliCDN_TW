export type PlayinfoAssignmentListener = (payload: unknown, serial: number) => boolean | void

export class PagePlayinfoAdapter {
  #restore: (() => void) | null = null
  #serial = 0
  #current: unknown = undefined

  constructor(private readonly onAssignment: PlayinfoAssignmentListener,
    private readonly rewriteBeforePageSetter: () => boolean = () => false) {}

  install(): void {
    if (this.#restore) return
    const target = unsafeWindow as Window & typeof globalThis & { __playinfo__?: unknown }
    let descriptor: PropertyDescriptor | undefined
    try { descriptor = Object.getOwnPropertyDescriptor(target, '__playinfo__') } catch { return }
    if (descriptor && descriptor.configurable === false) {
      try { this.#adopt(target.__playinfo__) } catch { /* page owns value */ }
      return
    }
    let value: unknown
    try { value = descriptor?.get ? descriptor.get.call(target) : descriptor?.value } catch { value = undefined }
    this.#current = value
    const adapter = this
    const getter = (): unknown => {
      let current: unknown
      if (descriptor?.get) {
        try { current = descriptor.get.call(target) } catch { current = adapter.#current }
      } else current = adapter.#current
      if (!adapter.rewriteBeforePageSetter()) return current
      try { return adapter.#adopt(current) ? current : undefined } catch { return undefined }
    }
    const setter = (next: unknown): void => {
      if (adapter.rewriteBeforePageSetter()) {
        const previous = adapter.#current
        try {
          if (!adapter.#adopt(next)) { adapter.#current = previous; return }
        } catch { adapter.#current = previous; return }
        if (descriptor?.set) descriptor.set.call(target, next)
        return
      }
      if (descriptor?.set) descriptor.set.call(target, next)
      else adapter.#current = next
      adapter.#adopt(next)
    }
    try {
      Object.defineProperty(target, '__playinfo__', {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get: getter,
        set: setter,
      })
    } catch { return }
    this.#restore = () => {
      try {
        const current = Object.getOwnPropertyDescriptor(target, '__playinfo__')
        if (current?.get !== getter || current.set !== setter) return
        if (descriptor) Object.defineProperty(target, '__playinfo__', descriptor)
        else { delete target.__playinfo__; if (adapter.#current !== undefined) target.__playinfo__ = adapter.#current }
      } catch { /* page owns property */ }
    }
    if (value !== undefined) this.#adopt(value)
  }

  current(): unknown {
    try { return (unsafeWindow as Window & typeof globalThis & { __playinfo__?: unknown }).__playinfo__ }
    catch { return this.#current }
  }

  dispose(): void { this.#restore?.(); this.#restore = null }

  #adopt(payload: unknown): boolean {
    this.#current = payload
    return this.onAssignment(payload, ++this.#serial) !== false
  }
}
