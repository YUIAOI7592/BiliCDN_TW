import test from 'node:test'
import assert from 'node:assert/strict'
import { observePlayurlContent, playurlRequestContext } from '../../../src-v2/domain/playurl-content.ts'

const url = (directory: string, kind = 'video') =>
  `https://upos-sz-mirrorali.bilivideo.com/upgcxcode/${directory}/100-1-${kind === 'video' ? 30080 : 30280}.m4s?synthetic=1`

test('BR-03 request cid parsing preserves precision and existing API admission boundaries', () => {
  const base = 'https://api.bilibili.com/', path = '/x/player/wbi/playurl?cid='
  for (const [raw, expected] of [['1', '1'], ['00012', '12'], ['12345678901234567890', '12345678901234567890'],
    ['00000000000000000001', '1'], ['%31', '1'], ['１', null], ['1e2', null], ['%0A1', null], ['+1', null],
    ['1&%63id=2', null], ['000000000000000000001', null]] as const) {
    const context = playurlRequestContext(path + raw, base)
    assert.equal(context.contentId, expected, raw); assert.equal(Object.isFrozen(context), true)
  }
  assert.equal(playurlRequestContext('https://example.invalid' + path + '1').contentId, null)
  assert.equal(playurlRequestContext('https://api.bilibili.com/x/not-playurl?cid=1').contentId, null)
  assert.equal(playurlRequestContext('http://[').contentId, null)
  assert.equal(playurlRequestContext('//api.bilibili.com' + path + '12', base).contentId, '12')
})

test('BR-03 all permutations use exact normalized parents independent of host and signature', () => {
  const rows = ['a/avc', 'a/av1', 'a/hevc'].map(x => url(x))
  const first = observePlayurlContent(null, rows, []).identity
  assert.ok(first)
  for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const result = observePlayurlContent(first, order.map(i => rows[i]!.replace('https:', '')
      .replace('mirrorali', 'mirrorcos').replace('synthetic=1', 'signature=renewed')), [])
    assert.equal(result.changed, false); assert.deepEqual(result.identity, first)
  }
  assert.equal(observePlayurlContent(first, [url('a/other')], []).changed, true, 'common ancestor is not a directory match')
})

for (const [kind, limit] of [['video', 128], ['audio', 64]] as const) {
  test(`BR-03 ${kind} history is bounded at ${limit}, prioritizes current directories and deterministically evicts old entries`, () => {
    const initial = Array.from({ length: limit }, (_, i) => url(`old-${String(i).padStart(3, '0')}`, kind))
    const put = (rows: string[], previous: ReturnType<typeof observePlayurlContent>['identity']) =>
      observePlayurlContent(previous, kind === 'video' ? rows : [], kind === 'audio' ? rows : [])
    const before = put(initial, null).identity
    assert.ok(before)
    const current = [initial[limit - 1]!, url('new-B', kind), url('new-A', kind)]
    const forward = put(current, before), backward = put([...current].reverse(), before)
    assert.equal(forward.changed, false); assert.deepEqual(forward, backward)
    assert.equal(forward.identity![kind].length, limit)
    assert.ok(forward.identity![kind].includes('/upgcxcode/new-A'))
    assert.ok(forward.identity![kind].includes('/upgcxcode/new-B'))
    assert.equal(put([initial[limit - 1]!], forward.identity).changed, false, 'current entries remain in history')
    assert.equal(put([initial[0]!], forward.identity).changed, false, 'sorted oldest entry fills remaining space')
    assert.equal(put([initial[limit - 2]!], forward.identity).changed, true, 'evicted unidentifiable content conservatively resets')
  })
}

test('BR-03 absent directories do not mutate a cidless baseline; first cid must align if a baseline exists', () => {
  const first = observePlayurlContent(null, [url('A')], []).identity
  assert.deepEqual(observePlayurlContent(first, ['invalid'], []), { identity: first, changed: false })
  assert.equal(observePlayurlContent(first, ['invalid'], [], { contentId: '1' }).changed, true)
  assert.equal(observePlayurlContent(null, ['invalid'], [], { contentId: '1' }).changed, false)
})
