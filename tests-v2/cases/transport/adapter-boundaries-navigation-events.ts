import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BrowserNavigation } from '../../../src-v2/adapters/navigation.ts'
import { testScope } from '../../support/scope.ts'

test('navigation observes history and popstate [4]', { timeout: 5000 }, (t) => {
  const scope = testScope(t),
    tasks: (() => void)[] = [],
    eventTarget = new EventTarget()
  let calledThis: unknown,
    pushes = 0,
    replaces = 0,
    notifications = 0
  const historyFixture = {
    pushState(this: unknown) {
      calledThis = this
      pushes++
    },
    replaceState() {
      replaces++
    },
  } satisfies Pick<History, 'pushState' | 'replaceState'>
  const originalPush = historyFixture.pushState,
    originalReplace = historyFixture.replaceState
  for (const [name, descriptor] of Object.entries({
    history: { configurable: true, value: historyFixture },
    location: { configurable: true, value: { pathname: '/video/test', search: '?p=2' } },
    addEventListener: { configurable: true, value: eventTarget.addEventListener.bind(eventTarget) },
    removeEventListener: {
      configurable: true,
      value: eventTarget.removeEventListener.bind(eventTarget),
    },
    queueMicrotask: { configurable: true, value: (task: () => void) => tasks.push(task) },
  }))
    scope.defineGlobal(name, descriptor)
  const navigation = new BrowserNavigation(),
    stop = navigation.subscribe(() => notifications++)
  scope.defer(stop)
  assert.equal(navigation.key(), '/video/test?p=2')
  historyFixture.pushState()
  historyFixture.replaceState()
  assert.equal(pushes, 1)
  assert.equal(replaces, 1)
  assert.equal(calledThis, historyFixture, 'history wrapper preserves its receiver')
  assert.equal(notifications, 0, 'history notification is deferred')
  tasks.splice(0).forEach((task) => task())
  eventTarget.dispatchEvent(new Event('popstate'))
  assert.equal(notifications, 3)

  historyFixture.pushState()
  stop()
  tasks.splice(0).forEach((task) => task())
  eventTarget.dispatchEvent(new Event('popstate'))
  assert.equal(notifications, 3, 'dispose removes popstate and invalidates queued callbacks')
  assert.equal(historyFixture.pushState, originalPush)
  assert.equal(historyFixture.replaceState, originalReplace)

  const stopSecond = navigation.subscribe(() => notifications++),
    newerHook = () => undefined
  scope.defer(stopSecond)
  historyFixture.pushState()
  historyFixture.pushState = newerHook
  stopSecond()
  tasks.splice(0).forEach((task) => task())
  eventTarget.dispatchEvent(new Event('popstate'))
  assert.equal(notifications, 3, 'replaced-owner disposal also invalidates queued callbacks')
  assert.equal(historyFixture.pushState, newerHook, 'cleanup preserves a newer owner')
  assert.equal(historyFixture.replaceState, originalReplace)
})
