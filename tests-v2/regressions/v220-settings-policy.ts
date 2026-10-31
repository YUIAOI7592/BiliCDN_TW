import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings } from '../../src-v2/state/settings-store.ts'
import { sameRouteSettings, sameMeasurementSettings } from '../../src-v2/state/settings-policy.ts'
import type { SettingsChange } from '../../src-v2/state/settings-contracts.ts'

const cases: readonly [string, SettingsChange, boolean, boolean][] = [
  ['Native permission', { considerNativeSources: false }, false, false],
  ['fixed host', { fixedHost: 'upos-sz-mirrorali.bilivideo.com' }, false, false],
  [
    'Catalog policy',
    { catalogOverrides: { 'upos-sz-mirrorali.bilivideo.com': false } },
    false,
    false,
  ],
  ['disable', { disabled: true }, true, false],
  ['early release', { startupEarlyReleaseEnabled: false }, true, false],
  ['middle probe', { healthMiddleRangeEnabled: false }, true, false],
  ['backup diversity', { backupFamilyDiversityEnabled: false }, true, true],
  ['early retry', { earlyRetryEnabled: false }, true, true],
  ['WebRTC', { blockWebRtc: false }, true, true],
  ['HTTPDNS', { blockHttpDns: false }, true, true],
]

for (const [name, change, routeSame, measurementSame] of cases) {
  test(`V220 field comparisons preserve ${name} invalidation scope`, () => {
    const before = defaultSettings(1000),
      after = { ...before, ...change }
    assert.equal(sameRouteSettings(before, after), routeSame)
    assert.equal(sameMeasurementSettings(before, after), measurementSame)
  })
}

test('V220 field comparisons ignore timestamps and preserve override order semantics', () => {
  const before = { ...defaultSettings(1000), catalogOverrides: { a: true, b: false } }
  const copied = { ...before, updatedAt: 2000, catalogOverrides: { ...before.catalogOverrides } }
  assert.equal(sameRouteSettings(before, copied), true)
  assert.equal(sameMeasurementSettings(before, copied), true)
  const reordered = { ...before, catalogOverrides: { b: false, a: true } }
  assert.equal(sameRouteSettings(before, reordered), false)
  assert.equal(sameMeasurementSettings(before, reordered), false)
})
