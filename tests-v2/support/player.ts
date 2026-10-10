import type { PlayerControlSnapshot } from '../../src-v2/application/ports.ts'

export const idleControls = (): PlayerControlSnapshot => ({ mediaId: 1, coreId: 1, seekRevision: 0,
  userRevision: 0, dragging: false, targetSec: null, reloadRevision: 0, coreReloadRevision: 0 })
