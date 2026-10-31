import type { PlayerControlSnapshot, PlayerPort } from '../../src-v2/application/ports.ts'
import type {
  RecoveryPlayerPort,
  RestoreAttempt,
  RestoreCommand,
  RestoreGuard,
  RestoreReadback,
} from '../../src-v2/application/recovery-contracts.ts'

// Existing controller unit fixtures model a synchronous SDK. Readback uses their
// actual supplied snapshot; these methods cannot manufacture media progress.
export function synchronousRestoreMethods(
  player: Pick<PlayerPort, 'seek' | 'setRate' | 'snapshot'>,
): Pick<RecoveryPlayerPort, 'performRestore' | 'readRestore' | 'correctRestore'> {
  const records = new WeakMap<
    object,
    { command: RestoreCommand; guard: RestoreGuard; landing: RestoreReadback['landing'] }
  >()
  return {
    performRestore(command, guard) {
      const attempt: RestoreAttempt = { kind: command.kind, proof: {} }
      records.set(attempt.proof, { command, guard, landing: null })
      if (guard.valid()) {
        if (command.kind === 'position') player.seek(command.value, guard.valid)
        else player.setRate(command.value, guard.valid)
      }
      return attempt
    },
    readRestore(attempt) {
      const record = records.get(attempt.proof),
        video = player.snapshot()
      const position =
        Number.isFinite(video.currentTime) && video.currentTime >= 0 ? video.currentTime : null
      if (
        record &&
        !record.landing &&
        record.command.kind === 'position' &&
        position !== null &&
        !video.seeking &&
        Math.abs(position - record.command.value) <= 1
      )
        record.landing = { positionSec: position, at: record.guard.now() }
      return {
        owned: !!record && record.guard.valid(),
        channel: 'sdk',
        status: 'settled',
        positionSec: position,
        rate:
          Number.isFinite(video.playbackRate) && video.playbackRate > 0 ? video.playbackRate : null,
        paused: video.paused,
        seeking: video.seeking,
        readyState: video.readyState,
        landing: record?.landing ?? null,
      }
    },
    correctRestore() {
      throw Error('Fixture has no native correction implementation')
    },
  }
}

// A current-position-only port for fixtures that deliberately have no trusted input observer.
export function currentResumePlayer<T extends PlayerPort>(player: T): T & RecoveryPlayerPort {
  return Object.assign(player, {
    ...synchronousRestoreMethods(player),
    captureResumePosition: () => ({ positionSec: player.currentTime(), proof: null }),
    validateResumePosition: (capture: { readonly proof: object | null }) => capture.proof === null,
  })
}

export const idleControls = (): PlayerControlSnapshot => ({
  mediaId: 1,
  coreId: 1,
  seekRevision: 0,
  userRevision: 0,
  dragging: false,
  targetSec: null,
  reloadRevision: 0,
  coreReloadRevision: 0,
})
