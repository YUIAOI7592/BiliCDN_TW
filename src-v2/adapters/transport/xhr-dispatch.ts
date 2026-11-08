interface PreparationMetadata {
  readonly method: string
  readonly async: boolean
  readonly username?: string | null
  readonly password?: string | null
  readonly headers: readonly (readonly [string, string])[]
  targetUrl: string
  needsNativeOpen: boolean
}
interface NativePreparation {
  readonly open: typeof XMLHttpRequest.prototype.open
  readonly setHeader: typeof XMLHttpRequest.prototype.setRequestHeader
  readonly readyState: PropertyDescriptor | undefined
}
/** One native preparation scope. The hook retains the only metadata lookup and send owner. */
export function createXhrPreparation<T extends PreparationMetadata>(
  xhr: XMLHttpRequest,
  meta: T,
  waiting: (xhr: XMLHttpRequest, meta: T) => boolean,
  native: NativePreparation,
) {
  const responseType = xhr.responseType,
    credentials = xhr.withCredentials
  let preparations = 0
  const nativeReady = (): boolean => waiting(xhr, meta) && native.readyState?.get?.call(xhr) === 1
  const reopen = (url: string): void => {
    if (++preparations > 2)
      throw new DOMException('XHR preparation did not stabilize', 'InvalidStateError')
    Reflect.apply(native.open, xhr, [
      meta.method,
      url,
      meta.async,
      meta.username ?? null,
      meta.password ?? null,
    ])
    if (!waiting(xhr, meta)) return
    if (!nativeReady()) {
      meta.needsNativeOpen = true
      return
    }
    if (meta.async) {
      xhr.responseType = responseType
      if (!nativeReady()) {
        if (waiting(xhr, meta)) meta.needsNativeOpen = true
        return
      }
      // open() and responseType restoration may let the website change its
      // timeout synchronously. Preserve the latest value, never a pre-open copy.
      const requestTimeout = xhr.timeout
      if (!nativeReady()) {
        if (waiting(xhr, meta)) meta.needsNativeOpen = true
        return
      }
      xhr.timeout = requestTimeout
      if (!nativeReady()) {
        if (waiting(xhr, meta)) meta.needsNativeOpen = true
        return
      }
    }
    xhr.withCredentials = credentials
    if (!nativeReady()) {
      if (waiting(xhr, meta)) meta.needsNativeOpen = true
      return
    }
    for (const [key, value] of meta.headers) {
      Reflect.apply(native.setHeader, xhr, [key, value])
      if (!nativeReady()) {
        if (waiting(xhr, meta)) meta.needsNativeOpen = true
        return
      }
    }
    meta.targetUrl = url
    meta.needsNativeOpen = false
  }

  return { nativeReady, reopen }
}
