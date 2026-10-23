import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { PlayerMonitor } from '../../src-v2/application/player-monitor.ts'
import type {
  MonitorPlayerPort,
  MonitorSessionPort,
} from '../../src-v2/application/monitor-ports.ts'
import type { VideoSnapshot } from '../../src-v2/application/ports.ts'
import {
  decisionId,
  generationId,
  epochId,
  representationId,
  requestId,
  type RequestContext,
} from '../../src-v2/domain/model.ts'
import { FakeClock } from './clock.ts'
import { idleControls } from './player.ts'
import { testScope } from './scope.ts'
import { monitorRoutes, monitorMeasurement, monitorRecovery } from './controllers.ts'

export function bufferMonitor(t: TestContext, rate: number) {
  const scope = testScope(t),
    clock = new FakeClock(),
    controls = { ...idleControls() }
  const state = {
    generation: generationId(1),
    epoch: epochId(1),
    representation: representationId('buffer-video'),
    affinity: null,
    disabled: false,
    recovering: false,
    lastDecisionId: null,
  }
  const video: { -readonly [K in keyof VideoSnapshot]: VideoSnapshot[K] } = {
    available: true,
    paused: false,
    seeking: false,
    ended: false,
    readyState: 4,
    currentTime: 100,
    duration: 5000,
    width: 1920,
    height: 1080,
    playbackRate: rate,
    effectiveRate: rate,
    bufferAheadSec: 12 * rate,
    playableBufferSec: 12,
    bufferedToEnd: false,
    frames: 0,
    mediaError: false,
    coreInitialized: true,
    manifestHasVideo: true,
  }
  const flags = {
    visible: true,
    comparison: false,
    disabled: false,
    recovering: false,
    eligible: true,
  }
  const reads = { media: 0, controls: 0, measurement: 0 },
    effects: string[] = []
  let request: RequestContext = {
    generation: state.generation,
    epoch: state.epoch,
    representation: state.representation,
    routePolicyRevision: 0,
    authorityRevision: 1,
    requestId: requestId('buffer-request'),
    decisionId: decisionId('buffer-decision'),
    kind: 'video',
    attributionStatus: 'matched',
    attributionSource: 'exact',
    decisionStage: 'request',
    routeType: 'catalog-generated',
    originalHost: 'upos-sz-mirrorali.bilivideo.com',
    targetHost: 'upos-sz-mirrorcos.bilivideo.com',
    sourceHost: null,
    playurlHostChanged: false,
    playurlOutput: null,
    urlChanged: true,
    hostChanged: true,
    startedAt: clock.now(),
  }
  let qualification: (() => void) | undefined
  const routes = monitorRoutes({
    latestRequested: () => request,
    recoveryEligible: () => {
      qualification?.()
      return flags.eligible
    },
    isOriginalComparison: () => flags.comparison,
    recover: () => {
      effects.push('fallback')
    },
  })
  const player = {
    snapshot: () => {
      reads.media++
      return { ...video }
    },
    controls: () => {
      reads.controls++
      return { ...controls }
    },
    syncManifest: () => true,
  } satisfies MonitorPlayerPort
  const session = { get: () => ({ ...state }) } satisfies MonitorSessionPort
  const measurement = monitorMeasurement({
    tick: () => {
      reads.measurement++
    },
  })
  const recovery = monitorRecovery({
    isRecovering: () => flags.recovering,
    armStall: () => {
      effects.push('arm')
    },
    armStartupFailure: () => {
      effects.push('startup')
    },
  })
  const settings = { get: () => ({ disabled: flags.disabled }) }
  const monitor = new PlayerMonitor(
    player,
    session,
    settings,
    { groupSummary: () => null },
    routes,
    measurement,
    recovery,
    () => flags.visible,
    clock.now,
    clock,
  )
  scope.defer(() => {
    monitor.dispose()
    assert.equal(clock.pendingCount, 0)
    clock.dispose()
  })
  const step = (buffer: number, ms = 1000, progress = true) => {
    clock.advance(ms)
    video.bufferAheadSec = buffer * video.playbackRate
    video.playableBufferSec = buffer
    if (progress) {
      video.currentTime += (video.playbackRate * ms) / 1000
      video.frames = (video.frames ?? 0) + 30
    }
    monitor.tick()
  }
  return {
    scope,
    clock,
    monitor,
    video,
    controls,
    state,
    flags,
    effects,
    reads,
    player,
    session,
    measurement,
    recovery,
    routes,
    settings,
    step,
    request: () => request,
    changeRequest: (patch: Partial<RequestContext>) => {
      request = { ...request, ...patch }
    },
    onQualification: (fn?: () => void) => {
      qualification = fn
    },
  }
}
