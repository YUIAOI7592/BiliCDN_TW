import type { PlayerControlSnapshot, PlayerPort } from '../../src-v2/application/ports.ts'
import type { RecoveryPlayerPort } from '../../src-v2/application/recovery-ports.ts'

// A current-position-only port for fixtures that deliberately have no trusted input observer.
export function currentResumePlayer<T extends PlayerPort>(player: T): T & RecoveryPlayerPort {
  return Object.assign(player, {
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
