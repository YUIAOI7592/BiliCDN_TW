import type { MediaKind, PlaybackDemand } from './model.ts'

const positive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/** Display demand requires actual facts. It never invents a bitrate or playback rate. */
export function observedPlaybackDemand(
  kind: MediaKind,
  bandwidth: number | null | undefined,
  rate: number | null | undefined,
): PlaybackDemand | null {
  if (!positive(bandwidth) || !positive(rate)) return null
  const mbps = bandwidth / 1_000_000
  const scaled = mbps * rate
  const demand = scaled * 1.25
  if (![mbps, scaled, demand].every((value) => positive(value) && value >= 2 ** -1022)) return null
  const requiredMbps = Math.max(kind === 'audio' ? 0.5 : 2, demand)
  return Object.freeze({ kind, requiredMbps, highDemand: requiredMbps >= 12 })
}

/** All control paths share the existing unknown-rate and unknown-bitrate defaults. */
export function controlPlaybackDemand(
  kind: MediaKind,
  bandwidth: number | null | undefined,
  rate: number | null | undefined,
): PlaybackDemand {
  return (
    observedPlaybackDemand(
      kind,
      positive(bandwidth) ? bandwidth : kind === 'audio' ? 192_000 : 4_000_000,
      positive(rate) ? rate : 2,
    ) ?? observedPlaybackDemand(kind, kind === 'audio' ? 192_000 : 4_000_000, 2)!
  )
}
