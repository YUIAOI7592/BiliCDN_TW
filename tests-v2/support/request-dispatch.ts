import type { RequestContext } from '../../src-v2/domain/model.ts'

// Adapter contracts without a real coordinator still model a unique native dispatch.
export function requestDispatch() {
  let sequence = 0
  return (request: RequestContext): RequestContext =>
    Object.freeze({
      ...request,
      dispatchSequence: ++sequence,
      routeRevision: 0,
      selectionRevision: 0,
    })
}
