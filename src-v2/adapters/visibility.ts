export class VisibilityAdapter {
  #restores: (() => void)[] = []
  #nativeHidden: (() => boolean) | null = null

  install(): void {
    if (this.#restores.length) return
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
    const state = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
    this.#nativeHidden = () => {
      try { return hidden?.get ? Boolean(hidden.get.call(document)) : document.visibilityState !== 'visible' }
      catch { return false }
    }
    this.#spoof('hidden', false)
    this.#spoof('visibilityState', 'visible')
    const guard = (event: Event): void => { if (this.#nativeHidden?.()) event.stopImmediatePropagation() }
    document.addEventListener('visibilitychange', guard, true)
    document.addEventListener('webkitvisibilitychange', guard, true)
    const blurGuard = (event: Event): void => event.stopImmediatePropagation()
    window.addEventListener('blur', blurGuard, true)
    this.#restores.push(() => document.removeEventListener('visibilitychange', guard, true))
    this.#restores.push(() => document.removeEventListener('webkitvisibilitychange', guard, true))
    this.#restores.push(() => window.removeEventListener('blur', blurGuard, true))
  }

  setEnabled(enabled: boolean): void { if (enabled) this.install(); else this.dispose() }

  isActuallyVisible(): boolean { return !(this.#nativeHidden?.() ?? false) }

  dispose(): void {
    for (const restore of this.#restores.splice(0).reverse()) { try { restore() } catch { /* fail-open */ } }
    this.#nativeHidden = null
  }

  #spoof(key: 'hidden' | 'visibilityState', value: boolean | string): void {
    let existing: PropertyDescriptor | undefined
    try { existing = Object.getOwnPropertyDescriptor(document, key) } catch { return }
    try {
      Object.defineProperty(document, key, { configurable: true, enumerable: true, get: () => value })
      this.#restores.push(() => {
        try { if (existing) Object.defineProperty(document, key, existing); else delete (document as unknown as Record<string, unknown>)[key] }
        catch { /* browser-owned */ }
      })
    } catch { /* browser-owned */ }
  }
}
