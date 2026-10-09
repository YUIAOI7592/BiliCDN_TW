export interface RuntimeIdPort { next(kind: 'request' | 'startup' | 'challenge'): string }

/** Called by composition, never on import. No content or user identifier enters an ID. */
export const createRuntimeIds = (random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = bytes => crypto.getRandomValues(bytes)): RuntimeIdPort => {
  const namespace = (): string => [...random(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  let prefix = namespace(), serial = 0
  return { next(kind): string {
    if (serial >= Number.MAX_SAFE_INTEGER) { prefix = namespace(); serial = 0 }
    return `${kind[0]}:${prefix}:${(++serial).toString(36)}`
  } }
}
