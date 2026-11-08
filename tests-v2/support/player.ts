import {
  type PlayerControlSnapshot,
  type PlayerPort,
  type VideoSnapshot,
} from '../../src-v2/application/playback/player-contracts.ts'
import {
  type RecoveryPlayerPort,
  type RestoreAttempt,
  type RestoreCommand,
  type RestoreGuard,
  type RestoreReadback,
} from '../../src-v2/application/playback/recovery-contracts.ts'

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
    prepareReload: () => {
      const reload = player.reload,
        before = player.controls()
      const valid = () => {
        const current = player.controls()
        return (
          current.mediaId === before.mediaId &&
          current.userRevision === before.userRevision &&
          current.reloadRevision === before.reloadRevision
        )
      }
      return {
        valid,
        dispatch: (commit: () => boolean) => {
          if (!valid() || !commit() || !valid()) throw Error('Fixture reload owner ended')
          return Reflect.apply(reload, player, [])
        },
      }
    },
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

export function createMutablePlaybackResources() {
  let reloads = 0
  let seeks: number[] = []
  let rates: number[] = []
  let plays = 0
  let playerSnapshot: VideoSnapshot = {
    available: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: 349.434,
    duration: 900,
    width: 1920,
    height: 1080,
    playbackRate: 2,
    effectiveRate: 2,
    bufferAheadSec: 30,
    playableBufferSec: 15,
    bufferedToEnd: false,
    frames: 1000,
    mediaError: false,
    coreInitialized: true,
    manifestHasVideo: true,
  }
  const recoveryPlayer: PlayerPort = {
    controls: idleControls,
    observePlayIntent: () => () => undefined,
    snapshot: () => playerSnapshot,
    syncManifest: () => true,
    reload: () => {
      reloads++
    },
    currentTime: () => 349.434,
    playbackRate: () => 2,
    seek: (value) => {
      seeks.push(value)
    },
    setRate: (value) => {
      rates.push(value)
    },
    play: () => {
      plays++
      return Promise.resolve()
    },
    reset: () => undefined,
  }
  return {
    get playerSnapshot() {
      return playerSnapshot
    },
    set playerSnapshot(value: typeof playerSnapshot) {
      playerSnapshot = value
    },
    recoveryPlayer,
  }
}
