export type PlayinfoAssignmentListener = (payload: unknown, serial: number) => boolean | void

export class PagePlayinfoAdapter {
  #restore: (() => void) | null = null
  #serial = 0
  #current: unknown = undefined

  constructor(
    private readonly onAssignment: PlayinfoAssignmentListener,
    private readonly rewriteBeforePageSetter: () => boolean = () => false,
  ) {}

  install(): void {
    if (this.#restore) return
    const target = unsafeWindow as Window & typeof globalThis & { __playinfo__?: unknown }
    let descriptor: PropertyDescriptor | undefined
    try {
      descriptor = Object.getOwnPropertyDescriptor(target, '__playinfo__')
    } catch {
      return
    }
    if (descriptor && descriptor.configurable === false) {
      try {
        this.#adopt(target.__playinfo__)
      } catch {
        /* page owns value */
      }
      return
    }
    let value: unknown
    try {
      value = descriptor?.get ? descriptor.get.call(target) : descriptor?.value
    } catch {
      value = undefined
    }
    this.#current = value
    const adapter = this
    let active = true
    let lastAssigned = value
    let assigned = false
    let assignment = 0
    let savedAssignment = 0
    const remember = (serial: number, next: unknown): void => {
      if (serial <= savedAssignment) return
      savedAssignment = serial
      assigned = true
      lastAssigned = next
    }
    const getter = (): unknown => {
      let current: unknown
      if (descriptor?.get) {
        try {
          current = descriptor.get.call(target)
        } catch {
          current = adapter.#current
        }
      } else current = adapter.#current
      if (!active || !adapter.rewriteBeforePageSetter()) return current
      try {
        return adapter.#adopt(current) ? current : undefined
      } catch {
        return undefined
      }
    }
    const setter = (next: unknown): void => {
      if (!active) return
      const serial = ++assignment
      if (adapter.rewriteBeforePageSetter()) {
        const previous = adapter.#current
        try {
          if (!adapter.#adopt(next)) {
            adapter.#current = previous
            return
          }
        } catch {
          adapter.#current = previous
          return
        }
        if (descriptor?.set) descriptor.set.call(target, next)
        else remember(serial, next)
        return
      }
      if (descriptor?.set) descriptor.set.call(target, next)
      else {
        adapter.#current = next
        remember(serial, next)
      }
      adapter.#adopt(next)
    }
    try {
      Object.defineProperty(target, '__playinfo__', {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get: getter,
        set: setter,
      })
    } catch {
      return
    }
    this.#restore = () => {
      active = false
      try {
        const current = Object.getOwnPropertyDescriptor(target, '__playinfo__')
        if (
          current?.get !== getter ||
          current.set !== setter ||
          !current.configurable ||
          current.enumerable !== (descriptor?.enumerable ?? true)
        )
          return
        if (descriptor)
          Object.defineProperty(
            target,
            '__playinfo__',
            descriptor.writable && assigned ? { ...descriptor, value: lastAssigned } : descriptor,
          )
        else {
          delete target.__playinfo__
          if (assigned) target.__playinfo__ = lastAssigned
        }
      } catch {
        /* page owns property */
      }
    }
    if (value !== undefined) this.#adopt(value)
  }

  dispose(): void {
    const restore = this.#restore
    this.#restore = null
    restore?.()
  }

  #adopt(payload: unknown): boolean {
    this.#current = payload
    return this.onAssignment(payload, ++this.#serial) !== false
  }
}
