import type { SettingsStore } from '../state/settings-store.ts'

const API_NAMES = ['RTCPeerConnection', 'mozRTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel'] as const

export class WebRtcAdapter {
  #original = new Map<string, { readonly descriptor: PropertyDescriptor | undefined; readonly getter: () => undefined; readonly setter: () => void }>()
  #unsubscribe: (() => void) | null = null
  constructor(private readonly settings: SettingsStore) {}

  install(): void {
    if (this.#unsubscribe) return
    this.#apply(!this.settings.get().disabled && this.settings.get().blockWebRtc)
    this.#unsubscribe = this.settings.subscribe(state => this.#apply(!state.disabled && state.blockWebRtc))
  }

  dispose(): void { this.#unsubscribe?.(); this.#unsubscribe = null; this.#restore() }

  #apply(blocked: boolean): void {
    if (!blocked) { this.#restore(); return }
    for (const name of API_NAMES) {
      if (this.#original.has(name)) continue
      let descriptor: PropertyDescriptor | undefined
      try { descriptor = Object.getOwnPropertyDescriptor(unsafeWindow, name) } catch { continue }
      const getter = (): undefined => undefined, setter = (): void => undefined
      try {
        Object.defineProperty(unsafeWindow, name, { configurable: true, enumerable: descriptor?.enumerable ?? true,
          get: getter, set: setter })
        this.#original.set(name, { descriptor, getter, setter })
      } catch { /* page owns API */ }
    }
  }

  #restore(): void {
    for (const [name, entry] of this.#original) {
      try {
        const current = Object.getOwnPropertyDescriptor(unsafeWindow, name)
        if (current?.get !== entry.getter || current.set !== entry.setter) continue
        if (entry.descriptor) Object.defineProperty(unsafeWindow, name, entry.descriptor); else delete (unsafeWindow as unknown as Record<string, unknown>)[name]
      }
      catch { /* page owns API */ }
    }
    this.#original.clear()
  }
}
