export class VisibilityAdapter {
  #restores: (() => void)[] = []
  #nativeHidden: (() => boolean) | null = null
  #deactivate: (() => void) | null = null
  #controlLoss = new Set<() => void>()

  subscribeControlLoss(listener: () => void): () => void {
    this.#controlLoss.add(listener)
    return () => {
      this.#controlLoss.delete(listener)
    }
  }

  install(): void {
    if (this.#deactivate) return
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
    Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
    this.#nativeHidden = () => {
      try {
        return hidden?.get
          ? Boolean(hidden.get.call(document))
          : document.visibilityState !== 'visible'
      } catch {
        return false
      }
    }
    let active = true
    this.#deactivate = () => {
      active = false
    }
    const guard = (event: Event): void => {
      if (!active || !this.#nativeHidden?.()) return
      if (event.isTrusted) this.#notifyControlLoss()
      event.stopImmediatePropagation()
    }
    const blurGuard = (event: Event): void => {
      if (!active) return
      if (event.isTrusted && event.target === window) this.#notifyControlLoss()
      event.stopImmediatePropagation()
    }
    try {
      const page = document,
        view = window
      this.#spoof('hidden', false)
      this.#spoof('visibilityState', 'visible')
      for (const type of ['visibilitychange', 'webkitvisibilitychange']) {
        this.#restores.push(() => page.removeEventListener(type, guard, true))
        page.addEventListener(type, guard, true)
      }
      this.#restores.push(() => view.removeEventListener('blur', blurGuard, true))
      view.addEventListener('blur', blurGuard, true)
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  setEnabled(enabled: boolean): void {
    if (enabled) this.install()
    else this.dispose()
  }

  isActuallyVisible(): boolean {
    return !(this.#nativeHidden?.() ?? false)
  }

  dispose(): void {
    this.#deactivate?.()
    this.#deactivate = null
    this.#nativeHidden = null
    for (const restore of this.#restores.splice(0).reverse()) {
      try {
        restore()
      } catch {
        /* fail-open */
      }
    }
  }

  #notifyControlLoss(): void {
    for (const listener of [...this.#controlLoss]) {
      if (!this.#controlLoss.has(listener)) continue
      try {
        listener()
      } catch {
        /* a failed observer cannot bypass the existing guard */
      }
    }
  }

  #spoof(key: 'hidden' | 'visibilityState', value: boolean | string): void {
    const target = document
    let existing: PropertyDescriptor | undefined
    try {
      existing = Object.getOwnPropertyDescriptor(target, key)
    } catch {
      return
    }
    try {
      const installed: PropertyDescriptor = {
        configurable: true,
        enumerable: true,
        get: () => value,
        ...(existing?.set ? { set: existing.set } : {}),
      }
      Object.defineProperty(target, key, installed)
      this.#restores.push(() => {
        try {
          const current = Object.getOwnPropertyDescriptor(target, key)
          if (
            !current ||
            'value' in current ||
            current.get !== installed.get ||
            current.set !== installed.set ||
            current.enumerable !== installed.enumerable ||
            current.configurable !== installed.configurable
          )
            return
          if (existing) Object.defineProperty(target, key, existing)
          else delete (target as unknown as Record<string, unknown>)[key]
        } catch {
          /* browser-owned */
        }
      })
    } catch {
      /* browser-owned */
    }
  }
}
