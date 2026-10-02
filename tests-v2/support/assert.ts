let passed = 0
export const check = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
  passed++
}
export const equal = (actual: unknown, expected: unknown, message: string): void =>
  check(Object.is(actual, expected), `${message}: ${String(actual)} !== ${String(expected)}`)
export const assertionCount = (): number => passed
