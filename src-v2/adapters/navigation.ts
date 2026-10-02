import type { NavigationPort } from '../application/ports.ts'

export class BrowserNavigation implements NavigationPort {
  key(): string { return `${location.pathname}${location.search}`.slice(0, 512) }
  subscribe(listener: () => void): () => void {
    const push = history.pushState, replace = history.replaceState
    let active = true
    const after = (): void => queueMicrotask(() => { if (active) listener() })
    const wrappedPush: History['pushState'] = function(this: History, ...args): void { Reflect.apply(push, this, args); after() }
    const wrappedReplace: History['replaceState'] = function(this: History, ...args): void { Reflect.apply(replace, this, args); after() }
    history.pushState = wrappedPush; history.replaceState = wrappedReplace
    addEventListener('popstate', listener)
    return () => {
      active = false
      if (history.pushState === wrappedPush) history.pushState = push
      if (history.replaceState === wrappedReplace) history.replaceState = replace
      removeEventListener('popstate', listener)
    }
  }
}
