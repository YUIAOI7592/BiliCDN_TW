import { riskScenario } from './risk-inputs.mts'
import type { RiskScenario } from './risk-inputs.mts'

/** New paired control. The original twenty scenarios and twelve windows remain immutable. */
export function adoptionPair(rate: 1 | 2): {
  readonly exhaustion: RiskScenario
  readonly normal: RiskScenario
} {
  return Object.freeze({
    exhaustion: riskScenario('low-partial-cycle', rate),
    normal: Object.freeze({ ...riskScenario('full-cycle', rate), initialWallSec: 4 }),
  })
}
