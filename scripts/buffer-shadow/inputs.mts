import { readFileSync } from 'node:fs'
import { checkSource } from '../upstream-compare/model.mts'
export const costInputs = [
  {
    version: '2.1.27',
    path: 'archive/retired/releases/Release/v2.1.27/BiliCDN_TW.user.js',
    bytes: 382934,
    sha256: '1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795',
  },
  {
    version: '2.1.28',
    path: 'archive/retired/releases/Release/v2.1.28/BiliCDN_TW.user.js',
    bytes: 403700,
    sha256: '8b3ec29aa2b26cb0b9708a91aed65e2d6411e09875e2ac87c70436f0eeec418d',
  },
] as const
export interface CostInput {
  readonly version: string
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}
export const v3CostInputs: readonly CostInput[] = [
  costInputs[1],
  {
    version: '2.1.29',
    path: 'archive/retired/releases/Release/v2.1.29/BiliCDN_TW.user.js',
    bytes: 407926,
    sha256: 'e0c178987111d99ae69762287fe3769cc1af722a1ee6e586d125ce0ba8b2e9b4',
  },
]
export function loadCostInput(version: string): string {
  const input = [...costInputs, ...v3CostInputs].find((i) => i.version === version)
  if (!input) throw Error('Unknown cost input')
  const data = readFileSync(input.path)
  checkSource(data, input.bytes, input.sha256)
  return data.toString('utf8')
}
