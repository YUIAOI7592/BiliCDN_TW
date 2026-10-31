/** Share only the selected prerequisite context, preserving mutable closure bindings. */
export function extendFixture<Base extends object, Local extends object>(
  base: Base,
  local: Local,
): Base & { -readonly [K in keyof Local]: Local[K] } {
  return Object.create(base, Object.getOwnPropertyDescriptors(local)) as Base & {
    -readonly [K in keyof Local]: Local[K]
  }
}
