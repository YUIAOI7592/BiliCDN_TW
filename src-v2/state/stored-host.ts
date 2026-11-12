// Preserve the schema 2 host coercion contract shared by evidence and restrictions.
export const storedHost = (value: unknown): string | null => {
  const host = String(value ?? '')
    .trim()
    .toLowerCase()
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes('.') ? host : null
}
