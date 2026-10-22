import { readFileSync } from 'node:fs'
import { ComparisonPage, PageEvent } from './page.mts'
import {
  scenarioHash,
  sha256,
  sustainedPlayback,
  restorationFacts,
  newOperationProtected,
  comparisonMetrics,
} from './model.mts'
import type { Assertion, CaseResult, Rate, Scenario, Version } from './model.mts'

export async function runCase(
  source: string,
  version: Version,
  scenario: Scenario,
  rate: Rate,
  hosts: readonly string[],
  calibrationOnly = false,
  scope?: { defer(task: () => Promise<void>): void },
): Promise<CaseResult> {
  const page = new ComparisonPage(rate, hosts),
    pending = new Set<Promise<unknown>>()
  scope?.defer(async () => {
    await page.close()
  })
  const calibration: string[] = [],
    reasons: string[] = [],
    assertions: Assertion[] = []
  let caseStart = 0,
    lastInput = 0,
    expectedGoal: number | null = null
  const startRequest = (media: 'video' | 'audio'): void => {
    const fetch = page.window.fetch as typeof globalThis.fetch
    const promise = fetch(page.mediaUrl(media), { headers: { 'x-comparison-role': 'website' } })
      .then((response) => response.arrayBuffer())
      .catch(() => {
        page.record('website-request-rejected', media, media, undefined, 'platform')
      })
    pending.add(promise)
    void promise.finally(() => pending.delete(promise))
  }
  const sample = (tail = false): void =>
    page.input(() => {
      page.record(tail ? 'tail-time' : 'sample-time', page.video.currentTime, 'video')
      page.record(tail ? 'tail-frames' : 'sample-frames', page.video.frames, 'video')
      page.record(tail ? 'tail-rate' : 'sample-rate', page.video.playbackRate, 'video')
      if (tail)
        page.record(
          'tail-qualified',
          !page.video.paused && !page.video.seeking && !page.video.ended && !page.video.error,
          'video',
        )
      page.record('sample-paused', page.video.paused, 'video')
      page.record('sample-seeking', page.video.seeking, 'video')
    })
  const tick = async (playing: boolean, requests = true, tail = false): Promise<void> => {
    page.input(() => {
      if (
        playing &&
        !page.video.paused &&
        !page.video.seeking &&
        !page.video.ended &&
        !page.video.error
      ) {
        page.video.currentTime += page.video.playbackRate
        page.video.frames += 30
        page.video.dispatchEvent(new PageEvent('timeupdate'))
      }
    })
    if (requests) {
      startRequest('video')
      startRequest('audio')
    }
    await page.clock.advance(1000)
    sample(tail)
  }
  const seek = (goal: number): void => {
    lastInput = page.clock.relative()
    page.keyboard(goal === 0 ? 'Home' : 'ArrowRight', () => page.player.seek(goal))
    expectedGoal = goal
  }
  const add = (
    id: string,
    expected: string,
    pass: boolean,
    events = page.observations.filter((e) => e.at >= caseStart),
    applicable = true,
    actual?: string,
  ): void => {
    assertions.push({
      id,
      expected,
      actual: applicable
        ? (actual ??
          JSON.stringify(
            events.map((e) => ({ at: e.at - caseStart, kind: e.kind, value: e.value })),
          ))
        : 'capability absent in original',
      applicability: applicable ? 'applicable' : 'not-applicable',
      evidence: events.map((e) => e.seq),
      verdict: applicable ? (pass ? 'pass' : 'fail') : 'undetermined',
    })
  }
  try {
    page.load(source, version)
    await page.clock.advance(50)
    const fetch = page.window.fetch as typeof globalThis.fetch
    let apiComplete = false
    const api = fetch('https://api.bilibili.com/x/player/wbi/playurl?cid=100001')
      .then((response) => response.json())
      .then(() => {
        apiComplete = true
      })
    await page.clock.advance(50)
    await api
    if (!apiComplete) throw Error('Playurl calibration did not complete')
    calibration.push('complete-script', 'playurl-response-consumed')
    const xhr = new (
      page.window.XMLHttpRequest as new () => {
        open(method: string, url: string): void
        send(): void
        readyState: number
        response: unknown
      }
    )()
    xhr.open('GET', page.mediaUrl('audio'))
    xhr.send()
    await page.clock.advance(100)
    if (xhr.readyState !== 4 || !xhr.response) throw Error('XHR calibration did not complete')
    calibration.push('xhr-native-completion')
    for (let i = 0; i < 60; i++) await tick(true)
    if (page.video.currentTime !== 120 + 60 * rate || page.video.frames !== 1900)
      throw Error('Healthy prelude modified')
    if (
      !page.observations.some(
        (e) => e.kind === 'complete' && e.media === 'video' && e.value === 'website',
      )
    )
      throw Error('Media transport not observed')
    if (version === '2.1.27' && !page.video.bindings.get('seeking')?.length)
      throw Error('Media control binding absent')
    if (!page.hooksInstalled()) throw Error('Transport hook absent')
    calibration.push(
      'healthy-60s',
      'video-and-audio-transport',
      'foreground',
      'fake-clock-and-promise-checkpoints',
    )
    caseStart = page.clock.relative()
    page.record('case-start', scenario, undefined, undefined, 'input')
    if (!calibrationOnly) {
      if (scenario === 'goal-nonzero' || scenario === 'goal-zero') {
        page.siteCall('pause', () => page.player.pause())
        for (let i = 0; i < 31; i++) await tick(false)
        seek(scenario === 'goal-zero' ? 0 : 600.25)
        page.input(() => {
          page.video.seeking = false
          page.video.dispatchEvent(new PageEvent('seeked'))
        })
        await page.clock.advance(1)
        page.input(() => {
          page.video.readyState = 0
          page.video.currentTime = 0
          page.invalidateCore()
          page.record('native-invalidation-zero', 0)
        })
        await page.clock.advance(1000)
        page.reloadMode = true
        page.input(() => page.button.dispatchEvent(new PageEvent('click', { trusted: true })))
        // Website's explicit play can return without making a dead core advance.
        page.siteCall('play', () => {
          void page.player.play()
        })
      }
      if (scenario === 'long-seek') seek(600.25)
      const faultStart = page.clock.relative()
      if (scenario === 'video-held') page.heldUntil = faultStart + 45000
      for (let second = 0; second < 180; second++) {
        const elapsed = page.clock.relative() - faultStart
        if (scenario === 'network-jitter') page.latencyMs = elapsed < 2000 ? 2000 - elapsed : 20
        if (scenario === 'buffer-drain') page.video.buffer = Math.max(0, 40 * rate - second * rate)
        if (second === 10) {
          if (scenario === 'new-seek') seek(900.5)
          if (scenario === 'new-pause') {
            lastInput = page.clock.relative()
            page.keyboard('k', () => page.player.pause())
          }
          if (scenario === 'new-rate') {
            lastInput = page.clock.relative()
            page.keyboard('ArrowUp', () => page.player.setPlaybackRate(rate === 1 ? 2 : 1))
          }
        }
        if (scenario === 'long-seek' && second === 35)
          page.input(() => {
            page.video.seeking = false
            page.video.dispatchEvent(new PageEvent('seeked'))
          })
        if (scenario === 'new-seek' && second === 11)
          page.input(() => {
            page.video.seeking = false
            page.video.dispatchEvent(new PageEvent('seeked'))
          })
        const naturalProgress =
          scenario === 'healthy' ||
          scenario === 'network-jitter' ||
          scenario === 'buffer-drain' ||
          (scenario === 'short-stall' && second >= 5) ||
          (scenario === 'long-seek' && second >= 35)
        const goalCase = scenario === 'goal-zero' || scenario === 'goal-nonzero'
        const tail = goalCase && second >= 10 && second <= 25
        if (tail && second === 10) {
          // Explicit fixture input: never a side effect of SDK reload/play.
          page.input(() => {
            page.video.readyState = 4
            page.video.seeking = false
            page.record('scheduled-progress-input')
            page.video.dispatchEvent(new PageEvent('seeked'))
          })
          sample(true)
        }
        await tick(naturalProgress || (goalCase && second >= 10), true, tail && second < 25)
      }
      // Drain every held fixture request, without extending a product recovery deadline.
      page.heldUntil = 0
      await page.clock.advance(100)
      if (pending.size) reasons.push('website-work-not-settled')
      const effects = page.observations.filter(
        (e) =>
          e.at >= caseStart &&
          e.origin === 'product' &&
          ['reload', 'seek', 'setRate', 'play'].includes(e.kind),
      )
      const reloads = effects.filter((e) => e.kind === 'reload')
      const audio = page.observations.filter(
        (e) => e.at > faultStart + 1000 && e.kind === 'complete' && e.media === 'audio',
      )
      add(
        'audio-isolation',
        'audio fixture completes during the scenario independently of video',
        audio.length > 0,
        audio,
        true,
        `${audio.length} audio completions`,
      )
      if (scenario === 'healthy' || scenario === 'network-jitter' || scenario === 'short-stall')
        add(
          'normal-no-core-reload',
          'normal/short interruption causes no core reload',
          reloads.length === 0,
          effects,
        )
      if (scenario === 'new-pause')
        add(
          'new-pause-protected',
          'no old play after newer pause',
          newOperationProtected(effects, lastInput, 'pause', 0),
          effects,
        )
      if (scenario === 'new-rate')
        add(
          'new-rate-protected',
          'old rate cannot overwrite new rate',
          newOperationProtected(effects, lastInput, 'rate', rate === 1 ? 2 : 1),
          effects,
        )
      if (scenario === 'new-seek')
        add(
          'new-seek-protected',
          'old position cannot overwrite newer seek',
          newOperationProtected(effects, lastInput, 'seek', 900.5),
          effects,
        )
      if (scenario === 'goal-nonzero' || scenario === 'goal-zero') {
        const facts = restorationFacts(effects, expectedGoal!, rate)
        add(
          'restore-position',
          'one restored seek within 0.000001 seconds of trusted goal',
          facts.position,
          effects,
          version === '2.1.27',
          JSON.stringify(facts.actual),
        )
        add(
          'restore-rate',
          'one setRate with exact selected rate',
          facts.rate,
          effects,
          version === '2.1.27',
          JSON.stringify(facts.actual),
        )
        add(
          'restore-order',
          'reload then seek then setRate then play, once',
          facts.order,
          effects,
          version === '2.1.27',
          JSON.stringify(facts.actual),
        )
        add(
          'continuous-tail',
          '15 one-second intervals with time, frames and exact rate',
          sustainedPlayback(page.observations, rate),
          page.observations.filter((e) => e.kind.startsWith('tail-')),
          version === '2.1.27',
        )
        const firstTail = page.observations.find((e) => e.kind === 'tail-time')
        add(
          'first-restored-position',
          'first scheduled progress baseline is at restored target',
          Math.abs(Number(firstTail?.value) - expectedGoal!) <= 1,
          firstTail ? [firstTail] : [],
          version === '2.1.27',
        )
      }
      add(
        'bounded-reload',
        'no more than two lifecycle reloads; none in last 120 ticks',
        reloads.length <= 2 && !reloads.some((e) => e.at >= faultStart + 60000),
        reloads,
        version === '2.1.27',
      )
    }
  } catch (error) {
    // These are model/calibration exceptions, not product verdicts. Stack only in child stderr.
    console.error(error)
    reasons.push('model-or-calibration-exception')
  }
  reasons.push(...page.invalid)
  const cleanup = await page.close()
  if (
    cleanup.unclassified ||
    Object.values(cleanup.after).some(Boolean) ||
    cleanup.callbacksAfterClose
  )
    reasons.push('cleanup-incomplete')
  const validity = reasons.length ? 'invalid' : 'valid'
  return {
    id: `${scenario}@${rate}x/${version}`,
    version,
    scenario,
    rate,
    scenarioHash: sha256(
      scenarioHash(scenario, rate) + readFileSync('scripts/upstream-compare/cases.mts', 'utf8'),
    ),
    validity,
    verdict:
      validity !== 'valid'
        ? 'undetermined'
        : assertions.some((e) => e.verdict === 'fail')
          ? 'fail'
          : 'pass',
    reasons,
    assertions,
    observations: page.observations,
    cleanup,
    calibration,
    metrics: comparisonMetrics(page.observations, caseStart),
  }
}
