export interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T | PromiseLike<T>): void
  reject(reason?: unknown): void
}
export function deferred<T>(): Deferred<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>()
  return { promise, resolve, reject }
}
// A fixture completes a bounded round when its last expected callback arrives.
export function countdown(expected: number) {
  if (!Number.isSafeInteger(expected) || expected < 1) throw new RangeError('Expected callback count must be positive')
  const done = deferred<void>()
  let remaining = expected
  return { promise: done.promise, complete(): void { if (--remaining === 0) done.resolve() } }
}
