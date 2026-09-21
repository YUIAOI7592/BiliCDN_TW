declare const GM_info: { readonly script?: { readonly version?: string } } | undefined
declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue<T>(key: string, value: T): void
declare function GM_deleteValue(key: string): void
declare function GM_addValueChangeListener<T>(key: string, callback: (key: string, oldValue: T, newValue: T, remote: boolean) => void): number
declare function GM_removeValueChangeListener(id: number): void
declare function GM_registerMenuCommand(label: string, callback: () => void): unknown
declare function GM_setClipboard(value: string): void
declare const unsafeWindow: Window & typeof globalThis & { player?: unknown; __playinfo__?: unknown }
