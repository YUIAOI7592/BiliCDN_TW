export type UnknownRecord = Record<string, unknown>
export const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object'
export const safeCall = (target: unknown, name: string, ...args: unknown[]): unknown => {
  if (!isRecord(target)) return undefined
  try {
    const fn = target[name]
    return typeof fn === 'function' ? Reflect.apply(fn, target, args) : undefined
  } catch {
    return undefined
  }
}
export const safeNumber = (value: unknown): number | null =>
  Number.isFinite(Number(value)) ? Number(value) : null
