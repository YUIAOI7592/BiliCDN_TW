import type { SettingsState } from './settings-contracts.ts'

// Match the former signatures, including override insertion order.
function sameOverrides(a: SettingsState, b: SettingsState): boolean {
  const left = Object.entries(a.catalogOverrides),
    right = Object.entries(b.catalogOverrides)
  return (
    left.length === right.length &&
    left.every(([key, value], i) => right[i]?.[0] === key && right[i]?.[1] === value)
  )
}
export function sameRouteSettings(a: SettingsState, b: SettingsState): boolean {
  return (
    a.fixedHost === b.fixedHost &&
    a.considerNativeSources === b.considerNativeSources &&
    sameOverrides(a, b)
  )
}
export function sameMeasurementSettings(a: SettingsState, b: SettingsState): boolean {
  return (
    sameRouteSettings(a, b) &&
    a.disabled === b.disabled &&
    a.startupEarlyReleaseEnabled === b.startupEarlyReleaseEnabled &&
    a.healthMiddleRangeEnabled === b.healthMiddleRangeEnabled
  )
}
