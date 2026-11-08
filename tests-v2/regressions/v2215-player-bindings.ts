import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PlayerInputBindings } from '../../src-v2/adapters/player/input-bindings.ts'
import { testScope } from '../support/scope.ts'
import { CaptureEventTarget } from '../support/event-target.ts'

test('V2215 player bindings reject synthetic trusted input and remove only their own listeners', (t) => {
  const scope = testScope(t),
    bindings = new PlayerInputBindings(),
    target = new CaptureEventTarget()
  scope.defer(() => bindings.clear())
  let regular = 0,
    trusted = 0,
    outside = 0
  const external = () => outside++
  target.addEventListener('pause', external)
  scope.defer(() => target.removeEventListener('pause', external))
  bindings.listen(target, 'pause', () => regular++)
  bindings.trusted(target, 'pause', () => trusted++)
  const order: string[] = []
  bindings.own(() => order.push('first'))
  bindings.own(() => order.push('second'))
  target.dispatchEvent(new Event('pause'))
  assert.deepEqual([regular, trusted, outside], [1, 0, 1])
  bindings.clear()
  bindings.clear()
  target.dispatchEvent(new Event('pause'))
  assert.deepEqual([regular, trusted, outside], [1, 0, 2])
  assert.deepEqual(order, ['second', 'first'])
})
test('V2215 player binding cleanup retains a new registration created by a cleanup callback', (t) => {
  const scope = testScope(t),
    bindings = new PlayerInputBindings(),
    target = new CaptureEventTarget()
  scope.defer(() => bindings.clear())
  let calls = 0
  bindings.own(() => bindings.listen(target, 'late', () => calls++))
  bindings.clear()
  target.dispatchEvent(new Event('late'))
  assert.equal(calls, 1)
  bindings.clear()
  target.dispatchEvent(new Event('late'))
  assert.equal(calls, 1)
})
