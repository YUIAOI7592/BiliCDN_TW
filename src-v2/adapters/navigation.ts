import { type NavigationPort } from '../application/lifecycle-contracts.ts'
function navigationKey(pathname: string, search: string): string {
  pathname = pathname.replace(/^\/(?:zh-Hant|zh-Hans|en|ja)(?=\/(?:video|list|watchlater)\/)/, '')
  const list = /^\/(?:list|watchlater)(?:\/|$)/.test(pathname)
  if (!list && !/^\/(?:video\/[^/]+|bangumi\/play\/[^/]+)\/?$/.test(pathname))
    return pathname + search
  const path = pathname.replace(/\/$/, '')
  const query = new URLSearchParams(search)
  query.delete('vd_source')
  query.delete('spm_id_from')
  const parts = query.getAll('p')
  if ((list || path.startsWith('/video/')) && parts.length === 1 && parts[0] === '1')
    query.delete('p')
  query.sort() // Stable by name: repeated values retain their order and meaning.
  const suffix = query.toString()
  return path + (suffix ? '?' + suffix : '')
}

export class BrowserNavigation implements NavigationPort {
  key(): string {
    return navigationKey(location.pathname, location.search)
  }
  subscribe(listener: () => void): () => void {
    const target = history,
      push = target.pushState,
      replace = target.replaceState
    const restores: (() => void)[] = []
    let active = true
    const notify = (): void => {
      if (active) listener()
    }
    const wrappedPush: History['pushState'] = function (this: History, ...args): void {
      Reflect.apply(push, this, args)
      queueMicrotask(notify)
    }
    const wrappedReplace: History['replaceState'] = function (this: History, ...args): void {
      Reflect.apply(replace, this, args)
      queueMicrotask(notify)
    }
    const install = (
      key: 'pushState' | 'replaceState',
      original: History['pushState'],
      wrapper: History['pushState'],
    ): void => {
      const descriptor = Object.getOwnPropertyDescriptor(target, key)
      restores.push(() => {
        if (target[key] !== wrapper) return
        const current = Object.getOwnPropertyDescriptor(target, key)
        if (current && 'value' in current) {
          if (descriptor) Object.defineProperty(target, key, descriptor)
          else Reflect.deleteProperty(target, key)
        } else {
          // Accessor-backed methods may store the wrapper without defining an own property.
          target[key] = original
        }
      })
      target[key] = wrapper
      if (target[key] !== wrapper) throw new TypeError('History wrapper was not installed')
    }
    const stop = (): void => {
      active = false
      for (const restore of restores.splice(0).reverse()) {
        try {
          restore()
        } catch {
          /* host owns the property or listener */
        }
      }
    }
    try {
      install('pushState', push, wrappedPush)
      install('replaceState', replace, wrappedReplace)
      restores.push(() => removeEventListener('popstate', notify))
      addEventListener('popstate', notify)
    } catch (error) {
      stop()
      throw error
    }
    return stop
  }
}
