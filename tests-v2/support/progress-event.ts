import type { testScope } from './scope.ts'

export function installProgressEvent(scope: ReturnType<typeof testScope>): void {
  class SyntheticProgressEvent extends Event {
    readonly lengthComputable = false
    readonly loaded = 0
    readonly total = 0
  }
  scope.defineGlobal('ProgressEvent', { configurable: true, value: SyntheticProgressEvent })
}
