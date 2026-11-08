import type { TestContext } from 'node:test'
import { PlayerAdapter } from '../../src-v2/adapters/player/player.ts'
import { RecoveryController } from '../../src-v2/application/playback/recovery-controller.ts'
import { playurlResult } from './playurl.ts'
import { rescueDomFixture as domFixture } from './rescue-dom.ts'
export function rescuePlayerFixture(t: TestContext, rate: number) {
  const f = domFixture(t)
  f.video().playbackRate = rate
  class Adapter extends PlayerAdapter {
    override video() {
      return f.sources.video()
    }
    protected override player() {
      return f.site
    }
  }
  const player = new Adapter(
    { transform: () => playurlResult(false), lifecycleKey: f.sources.lifecycleKey },
    f.environment,
  )
  const recovery = new RecoveryController(player, f.clock.now, f.environment.isActuallyVisible)
  f.scope.defer(() => {
    recovery.dispose()
    player.reset()
    f.check()
  })
  const tick = () => recovery.tick(player.snapshot()),
    advance = (ms: number) => {
      f.clock.advance(ms)
      tick()
    }
  const healthy = () => {
    tick()
    f.video().currentTime++
    f.video().frames += 30
    advance(1000)
  }
  const pause = () => {
    f.video().paused = true
    advance(1000)
    advance(30_000)
  }
  const dead = (reset: boolean) => {
    f.video().seeking = false
    if (reset) f.video().currentTime = 0
    f.video().readyState = 0
    f.video().videoWidth = 0
    f.video().videoHeight = 0
    f.originalCore.state.initialized = false
    tick()
  }
  const saved = () => {
    const position = recovery.snapshot().savedPositionSec
    return position === undefined ? [] : [position]
  }
  const trace = (id: string) =>
    console.log(
      JSON.stringify({
        id,
        rate,
        saved: saved(),
        state: recovery.snapshot(),
        controls: player.controls(),
        effects: f.effects.map((e) => ({
          method: e.method,
          value: typeof e.args[0] === 'number' ? e.args[0] : null,
        })),
      }),
    )
  return { ...f, player, recovery, tick, advance, healthy, pause, dead, saved, trace }
}
