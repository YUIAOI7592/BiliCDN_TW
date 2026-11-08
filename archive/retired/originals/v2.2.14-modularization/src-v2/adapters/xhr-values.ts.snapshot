export interface XhrOpenValues {
  readonly methodString: string
  readonly originalUrl: string
  readonly asynchronous: boolean
  readonly user: string | null
  readonly pass: string | null
  readonly normalizedMethod: string
}

// Called after the native receiver check and before selecting a metadata owner.
export function convertXhrOpen(
  method: string,
  url: string | URL,
  argumentCount: number,
  async?: boolean,
  username?: string | null,
  password?: string | null,
): XhrOpenValues {
  const methodString = `${method}`
  if (/[^\x00-\xff]/.test(methodString)) throw new TypeError('XHR method must be a ByteString')
  const originalUrl = `${url}`.toWellFormed()
  const asynchronous = argumentCount < 3 ? true : Boolean(async)
  const user = username == null ? null : `${username}`.toWellFormed()
  const pass = password == null ? null : `${password}`.toWellFormed()
  const normalizedMethod = /^(DELETE|GET|HEAD|OPTIONS|POST|PUT)$/i.test(methodString)
    ? methodString.toUpperCase()
    : methodString
  return { methodString, originalUrl, asynchronous, user, pass, normalizedMethod }
}

export function convertXhrHeader(name: string, value: string): [string, string] {
  const key = `${name}`
  if (/[^\x00-\xff]/.test(key)) throw new TypeError('XHR header name must be a ByteString')
  const text = `${value}`
  if (/[^\x00-\xff]/.test(text)) throw new TypeError('XHR header value must be a ByteString')
  return [key, text]
}

export interface XhrBodyConverter {
  (
    body: Document | XMLHttpRequestBodyInit | null | undefined,
  ): Document | XMLHttpRequestBodyInit | null
}

// Capture platform brand methods once for this hook installation, before any dispatch.
export function createXhrBodyConverter(): XhrBodyConverter {
  // Platform brand checks also recognize objects from another Window. Do not use
  // instanceof or toStringTag: plain objects must still take the USVString branch.
  const bufferSize = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')?.get
  const blobSize =
    typeof Blob === 'undefined'
      ? undefined
      : Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get
  const nodeType =
    typeof Node === 'undefined'
      ? undefined
      : Object.getOwnPropertyDescriptor(Node.prototype, 'nodeType')?.get
  const formHas = typeof FormData === 'undefined' ? undefined : FormData.prototype.has
  const searchHas =
    typeof URLSearchParams === 'undefined' ? undefined : URLSearchParams.prototype.has
  const branded = (method: Function | undefined, value: object, args: unknown[] = []): boolean => {
    if (!method) return false
    try {
      Reflect.apply(method, value, args)
      return true
    } catch {
      return false
    }
  }
  const bodyValue = (
    body: Document | XMLHttpRequestBodyInit | null | undefined,
  ): Document | XMLHttpRequestBodyInit | null => {
    if (body == null) return null
    if (typeof body === 'object' || typeof body === 'function') {
      if (
        ArrayBuffer.isView(body) ||
        branded(bufferSize, body) ||
        branded(blobSize, body) ||
        branded(formHas, body, ['']) ||
        branded(searchHas, body, [''])
      )
        return body
      try {
        if (nodeType?.call(body) === 9) return body
      } catch {
        /* not a Document */
      }
    }
    return `${body}`.toWellFormed()
  }
  return bodyValue
}
