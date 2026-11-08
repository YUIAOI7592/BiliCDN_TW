import type { UnknownRecord } from './player-sdk.ts'

const sameDescriptor = (
  left: PropertyDescriptor | undefined,
  right: PropertyDescriptor | undefined,
): boolean =>
  left === undefined || right === undefined
    ? left === right
    : left.value === right.value &&
      left.get === right.get &&
      left.set === right.set &&
      left.writable === right.writable &&
      left.enumerable === right.enumerable &&
      left.configurable === right.configurable

// Use the SDK's setter when present. Cleanup owns both the method and its
// descriptor, and removes a shadow created over an inherited data method.
export const observeMethod = (
  target: UnknownRecord,
  name: string,
  original: unknown,
  wrapped: unknown,
): (() => void) => {
  const before = Object.getOwnPropertyDescriptor(target, name)
  target[name] = wrapped
  const installed = Object.getOwnPropertyDescriptor(target, name)
  return () => {
    try {
      if (
        !sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed) ||
        target[name] !== wrapped ||
        !sameDescriptor(Object.getOwnPropertyDescriptor(target, name), installed)
      )
        return
      if (!before && installed) Reflect.deleteProperty(target, name)
      else if (before && 'value' in before) Object.defineProperty(target, name, before)
      else target[name] = original
    } catch {
      /* a newer SDK or script owns the method */
    }
  }
}
