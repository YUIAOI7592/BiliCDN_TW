import { type NavigationPort } from '../application/lifecycle-contracts.ts'
function navigationKey(pathname: string, search: string): string {
  if (!/^\/(?:video\/[^/]+|bangumi\/play\/[^/]+)\/?$/.test(pathname)) return pathname + search
  const path = pathname.replace(/\/$/, '')
  const query = new URLSearchParams(search)
  query.delete('vd_source')
  query.delete('spm_id_from')
  const parts = query.getAll('p')
  if (path.startsWith('/video/') && parts.length === 1 && parts[0] === '1') query.delete('p')
  query.sort() // Stable by name: repeated values retain their order and meaning.
  const suffix = query.toString()
  return path + (suffix ? '?' + suffix : '')
}

export class BrowserNavigation implements NavigationPort {
  key(): string {
    return navigationKey(location.pathname, location.search)
  }
  subscribe(listener: () => void): () => void {
    const push = history.pushState,
      replace = history.replaceState
    let active = true
    const after = (): void =>
      queueMicrotask(() => {
        if (active) listener()
      })
    const wrappedPush: History['pushState'] = function (this: History, ...args): void {
      Reflect.apply(push, this, args)
      after()
    }
    const wrappedReplace: History['replaceState'] = function (this: History, ...args): void {
      Reflect.apply(replace, this, args)
      after()
    }
    history.pushState = wrappedPush
    history.replaceState = wrappedReplace
    addEventListener('popstate', listener)
    return () => {
      active = false
      if (history.pushState === wrappedPush) history.pushState = push
      if (history.replaceState === wrappedReplace) history.replaceState = replace
      removeEventListener('popstate', listener)
    }
  }
}
