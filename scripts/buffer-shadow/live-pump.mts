import { drainRemoteSession } from './live-session.mts'
import type { LiveEntry, ObservationCdp } from './live-session.mts'

/** Host-only state contains data, never a retained browser capability or closure over a tab. */
export function createObservationPump(tabId: string, objectId: string) {
  if (!tabId || !objectId) throw Error('Missing observation identity')
  return {
    tabId,
    objectId,
    cursor: 0,
    entries: [] as LiveEntry[],
    status: null as Awaited<ReturnType<typeof drainRemoteSession>>['status'] | null,
    calls: 0,
    stopped: false,
    failure: null as string | null,
  }
}

export async function pumpObservationStep(
  state: ReturnType<typeof createObservationPump>,
  current: { readonly tabId: string; readonly cdp: ObservationCdp },
  pause: (ms: number) => Promise<void>,
) {
  if (state.tabId !== current.tabId) throw Error('Observation tab mismatch')
  if (state.failure) throw Error('Observation pump already failed')
  if (state.stopped) return state.status
  const drain = async () => {
    for (let page = 0; page < 5; page++) {
      const batch = await drainRemoteSession(current.cdp, state.objectId, state.cursor)
      if (
        batch.status.deadlineMs !== (state.status?.deadlineMs ?? batch.status.deadlineMs) ||
        batch.status.elapsedMs < (state.status?.elapsedMs ?? 0) ||
        state.entries.length + batch.entries.length > 4608 ||
        (batch.hasMore && batch.cursor === state.cursor)
      )
        throw Error('Observation continuity rejected')
      state.entries.push(...batch.entries)
      state.cursor = batch.cursor
      state.status = batch.status
      state.calls++
      if (!batch.hasMore) {
        state.stopped = !batch.status.active
        return
      }
    }
    throw Error('Observation paging limit')
  }
  try {
    await drain()
    if (!state.stopped) {
      // Every tool invocation awaits both renewals; no host background Promise survives it.
      await pause(8000)
      await drain()
    }
    return state.status
  } catch {
    state.failure = 'observation-step-failed'
    throw Error(state.failure)
  }
}
