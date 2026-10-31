import type { ControlCenterSnapshot } from './control-contracts.ts'
import type { ControlViewActions } from './control-contracts.ts'
import { createRow } from './elements.ts'

/** Refresh the same input, including remote updates, without replacing focus or handlers. */
export function settingToggle(
  label: string,
  value: (model: ControlCenterSnapshot) => boolean,
  update: (enabled: boolean) => Promise<unknown> | void,
  actions: ControlViewActions,
  model: ControlCenterSnapshot,
  detail = '',
) {
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('aria-label', label)
  let expected = value(model),
    pending = false
  input.checked = expected
  input.addEventListener('change', (event) => {
    if (!event.isTrusted || !actions.ownsView() || pending) {
      input.checked = expected
      return
    }
    const requested = input.checked
    pending = true
    expected = requested
    // Start synchronously: SettingsStore applies restrictive changes before waiting for its lock.
    const result = update(requested)
    void actions.refreshAfter(Promise.resolve(result), () => {
      pending = false
    })
  })
  return {
    row: createRow(label, input, detail),
    refresh(model: ControlCenterSnapshot): void {
      if (!pending) {
        expected = value(model)
        input.checked = expected
      }
    },
  }
}
