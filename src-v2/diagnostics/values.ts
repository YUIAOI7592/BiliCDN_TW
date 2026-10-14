export const diagnosticBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength
export const diagnosticText = (value: unknown, max = 96): string =>
  String(value ?? '').slice(0, max)
export const diagnosticField = (value: unknown, key: string): unknown =>
  value && typeof value === 'object' ? Reflect.get(value, key) : undefined
export const finiteDiagnosticNumber = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null
