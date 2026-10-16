import type { TestContext } from 'node:test'
import { PlayerAdapter } from '../../src-v2/adapters/player.ts'
import { RecoveryController } from '../../src-v2/application/recovery-controller.ts'
import type { DomainEvent } from '../../src-v2/domain/model.ts'
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
  const recovery = new RecoveryController(player, f.clock.now, f.environment.isActuallyVisible),
    events: DomainEvent[] = []
  const stop = recovery.subscribe((e) => events.push(e))
  f.scope.defer(() => {
    stop()
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
  const saved = () =>
    events.flatMap((e) =>
      e.type === 'recovery' && e.action.action === 'player-reload'
        ? [e.action.savedPositionSec]
        : [],
    )
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
  return { ...f, player, recovery, events, tick, advance, healthy, pause, dead, saved, trace }
}
