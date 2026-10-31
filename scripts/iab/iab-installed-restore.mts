// Browser-only instrumentation after explicit installation. Importing creates no work.
// Values typed as objects here are existing page/controller objects, never serialized.
type Obj = Record<string, any>
type Method = (...args: any[]) => any
export interface RestoreToolEnvironment {
  document?: Obj
  now(): number
  timeout(fn: () => void, ms: number): any
  interval(fn: () => void, ms: number): any
  clear(id: any): void
}
export interface RestoreToolOptions {
  id: string
  kind: string
  rate: number
  target: number
  catalog: readonly string[]
  remainingMs: number
  leaseMs: number
  maxSamples?: number
}

export function progressPoint(rect: Obj, fraction: number): { x: number; y: number } {
  if (
    ![rect.left, rect.top, rect.width, rect.height, fraction].every(Number.isFinite) ||
    rect.width <= 2 ||
    rect.height <= 0 ||
    fraction <= 0 ||
    fraction >= 1
  )
    throw Error('invalid-progress-geometry')
  return { x: rect.left + rect.width * fraction, y: rect.top + rect.height / 2 }
}

export function ownMethod(
  target: Obj,
  name: string,
  factory: (original: Method) => Method,
): () => boolean {
  const before = Object.getOwnPropertyDescriptor(target, name),
    original = target[name]
  if (
    typeof original !== 'function' ||
    (before && !('value' in before) && typeof before.set !== 'function')
  )
    throw Error('unsupported-method-descriptor')
  const wrapped = factory(original)
  if (before && !('value' in before)) target[name] = wrapped
  else
    Object.defineProperty(target, name, {
      value: wrapped,
      configurable: true,
      writable: true,
      enumerable: before?.enumerable ?? false,
    })
  const installed = Object.getOwnPropertyDescriptor(target, name)!
  let stopped = false
  return () => {
    if (stopped) return true
    stopped = true
    const current = Object.getOwnPropertyDescriptor(target, name)
    if (
      !current ||
      current.value !== installed.value ||
      current.get !== installed.get ||
      current.set !== installed.set ||
      current.configurable !== installed.configurable ||
      current.writable !== installed.writable ||
      current.enumerable !== installed.enumerable ||
      target[name] !== wrapped
    )
      return false
    if (before && !('value' in before)) target[name] = original
    else if (before) Object.defineProperty(target, name, before)
    else Reflect.deleteProperty(target, name)
    return true
  }
}

export function isolateWrites(
  ids: Obj,
  evidence: Obj,
  belongs: () => boolean,
  invalid: (reason: string) => void = () => {},
) {
  const controlled = new Set<string>(),
    stops: Array<() => boolean> = []
  const identities: Array<() => boolean> = []
  let active = true,
    suppressed = 0,
    pendingWrites = 0
  try {
    stops.push(
      ownMethod(
        ids,
        'next',
        (original) =>
          function (this: unknown, kind: string) {
            const id = Reflect.apply(original, this, arguments)
            if (active && belongs() && ['request', 'startup', 'challenge'].includes(kind)) {
              if (controlled.size >= 1024) invalid('work-id-limit')
              else controlled.add(id)
            }
            return id
          },
      ),
    )
    const nextIdentity = ids.next
    identities.push(() => ids.next === nextIdentity)
    stops.push(
      ownMethod(
        evidence,
        'record',
        (original) =>
          function (this: unknown, host: string, kind: string, sample: Obj) {
            const selected = controlled.has(sample?.requestId)
            if (selected) suppressed++
            const result = Reflect.apply(
              original,
              this,
              selected ? [host, kind, sample, () => false] : arguments,
            )
            if (selected && result && typeof result.then === 'function') {
              pendingWrites++
              void Promise.resolve(result).then(
                () => {
                  pendingWrites--
                },
                () => {
                  pendingWrites--
                },
              )
            }
            return result
          },
      ),
    )
    const recordIdentity = evidence.record
    identities.push(() => evidence.record === recordIdentity)
  } catch (error) {
    for (const stop of stops.reverse()) stop()
    throw error
  }
  return {
    owns(id: string) {
      return controlled.has(id)
    },
    seal() {
      active = false
    },
    snapshot() {
      return {
        active,
        controlled: controlled.size,
        suppressed,
        pendingWrites,
        intact: identities.length === 2 && identities.every((check) => check()),
      }
    },
    audit(records: readonly Obj[]) {
      let found = 0
      for (const row of records)
        for (const sample of Array.isArray(row.samples) ? row.samples : [])
          if (controlled.has(sample.requestId)) found++
      return found
    },
    stop() {
      if (pendingWrites) throw Error('controlled-writes-pending')
      active = false
      return stops
        .splice(0)
        .reverse()
        .map((stop) => stop())
    },
  }
}

export function installInstalledCase(
  registry: Obj,
  key: string,
  runtime: Obj,
  options: RestoreToolOptions,
  env: RestoreToolEnvironment,
): any {
  if (Object.hasOwn(registry, key)) throw Error('case-registry-already-owned')
  const slot: Obj = { id: options.id, state: 'installing', probe: null, error: null }
  Object.defineProperty(registry, key, { value: slot, configurable: true })
  try {
    slot.probe = createInstalledCase(runtime, options, env)
    slot.state = 'ready'
    return slot.probe
  } catch (error) {
    slot.state = 'failed'
    slot.error = error instanceof Error ? error.message : 'installation-failed'
    throw error
  }
}

function createInstalledCase(
  runtime: Obj,
  options: RestoreToolOptions,
  env: RestoreToolEnvironment,
) {
  const player = runtime.player,
    sdk = player.player(),
    video = player.video(),
    session = runtime.session.get()
  if (
    !sdk ||
    !video ||
    !Number.isFinite(options.remainingMs) ||
    options.remainingMs <= 0 ||
    options.remainingMs > 240000
  )
    throw Error('case-install-prerequisite')
  const began = env.now(),
    hardDeadline = began + options.remainingMs
  const before = {
    rate: video.playbackRate,
    position: video.currentTime,
    paused: video.paused,
    reloads: runtime.recovery.snapshot().reloadCount,
    controls: player.controls(),
  }
  const rows: Obj[] = [],
    events: Obj[] = [],
    errors: string[] = [],
    stops: Array<() => boolean | void> = [],
    timers = new Set<any>(),
    requests = new Set<string>(),
    attempts = new WeakMap<object, Obj>()
  const skipped = { position: 0, rate: 0 },
    corrections = { position: 0, rate: 0 }
  let collecting = true,
    armed = false,
    ended: number | null = null,
    armAt: number | null = null,
    reloadAt: number | null = null,
    pendingAt: number | null = null,
    pendingResolve: (() => void) | null = null,
    current: Obj | null = null,
    scriptPlay = false,
    legalReload: Obj | null = null,
    reloadIntents = 0,
    heartbeat = began,
    bytes = 0,
    jobs = 0,
    pendingProbes = 0,
    cleaned: Obj | null = null
  let isolation: ReturnType<typeof isolateWrites> | null = null
  const same = () => {
    const s = runtime.session.get()
    return s.generation === session.generation && s.epoch === session.epoch
  }
  const note = (kind: string, data: Obj = {}) => {
    if (events.length >= 4096) {
      if (!errors.includes('event-limit')) errors.push('event-limit')
      stopObservation()
      return
    }
    const row = { sequence: events.length + 1, at: env.now(), kind, ...data }
    bytes += new TextEncoder().encode(JSON.stringify(row)).byteLength
    events.push(row)
    if (bytes > 4 * 1024 * 1024) {
      if (!errors.includes('data-limit')) errors.push('data-limit')
      stopObservation()
    }
  }
  function stopObservation() {
    if (ended !== null) return
    ended = env.now()
    collecting = false
    armed = false
  }
  const invalid = (reason: string) => {
    if (!errors.includes(reason)) {
      errors.push(reason)
      note('invalid', { reason })
    }
    stopObservation()
  }
  const native = () => {
    const v = player.video(),
      c = player.controls()
    let frames = null
    try {
      frames = v.getVideoPlaybackQuality().totalVideoFrames
    } catch {
      /* optional native fact */
    }
    return {
      at: env.now(),
      position: v.currentTime,
      rate: v.playbackRate,
      paused: v.paused,
      seeking: v.seeking,
      ended: v.ended,
      ready: v.readyState,
      error: !!v.error,
      frames,
      controls: {
        userRevision: c.userRevision,
        seekRevision: c.seekRevision,
        reloadRevision: c.reloadRevision,
        mediaId: c.mediaId,
        coreId: c.coreId,
        dragging: c.dragging,
        pendingSeekGoal: !!c.pendingSeekGoal,
      },
      recovery: runtime.recovery.snapshot(),
      visible: runtime.visibility.isActuallyVisible(),
    }
  }
  const sample = () => {
    if (!collecting) return
    if (isolation && !isolation.snapshot().intact) {
      invalid('write-isolation-lost')
      return
    }
    if (!same()) {
      invalid('content-changed')
      return
    }
    if (rows.length >= (options.maxSamples ?? 1024)) {
      invalid('sample-limit')
      return
    }
    const row = native()
    bytes += new TextEncoder().encode(JSON.stringify(row)).byteLength
    rows.push(row)
    if (bytes > 4 * 1024 * 1024) invalid('data-limit')
  }
  const track = (object: Obj, method: string, counter: 'job' | 'probe') => {
    if (typeof object?.[method] !== 'function') return
    stops.push(
      ownMethod(
        object,
        method,
        (original) =>
          function (this: unknown) {
            const result = Reflect.apply(original, this, arguments)
            if (result && typeof result.then === 'function') {
              if (counter === 'job') jobs++
              else pendingProbes++
              const settle = () => {
                if (counter === 'job') jobs--
                else pendingProbes--
              }
              void Promise.resolve(result).then(settle, settle)
            }
            return result
          },
      ),
    )
  }
  const audit = () => ({
    controlledInMemory: isolation!.audit(runtime.routes.evidence.list()),
    controlledPersisted: isolation!.audit(
      Object.values(
        runtime.routes.evidence.storage.get('bilicdn.v2.routeEvidence', null)?.records ?? {},
      ),
    ),
  })
  const tail = () => {
    const state = runtime.measurement.snapshot(),
      idState = isolation!.snapshot(),
      recoveryActive = runtime.recovery.isRecovering?.() === true,
      controlledPending = pendingResolve !== null
    return {
      ...idState,
      controlledRequests: requests.size,
      routeJobs: jobs,
      pendingProbes,
      controlledPending,
      recoveryActive,
      measurementState: state.state,
      startupState: state.startup?.state ?? null,
      ready:
        !controlledPending &&
        !recoveryActive &&
        requests.size === 0 &&
        jobs === 0 &&
        pendingProbes === 0 &&
        idState.pendingWrites === 0 &&
        state.state !== 'running' &&
        state.startup?.state !== 'running',
    }
  }
  const cleanup = (force: boolean) => {
    if (cleaned) return { ...cleaned }
    stopObservation()
    const unfinished = !tail().ready
    if (!force && unfinished) throw Error('controlled-tail-pending')
    const guardHeldUntilUnload = force && unfinished
    if (pendingResolve) {
      pendingResolve()
      pendingResolve = null
    }
    if (!guardHeldUntilUnload) isolation?.seal()
    for (const id of timers) env.clear(id)
    timers.clear()
    const results = stops
      .splice(0)
      .reverse()
      .map((stop) => {
        try {
          return stop() !== false
        } catch {
          return false
        }
      })
    let guardRestored = false
    try {
      if (!guardHeldUntilUnload) guardRestored = isolation!.stop().every(Boolean)
    } catch {
      /* preserve pending guard until unload */
    }
    cleaned = {
      restored: results.every(Boolean) && guardRestored,
      ownedWrappersRestored: results.every(Boolean),
      guardHeldUntilUnload,
      guardIntact: isolation!.snapshot().intact,
      timers: timers.size,
      forced: force,
      ended,
      audit: audit(),
    }
    return { ...cleaned }
  }
  try {
    isolation = isolateWrites(runtime.routes.ids, runtime.routes.evidence, same, invalid)
    for (const method of ['observe', 'recordStartupSuccess', 'recordChallenge'])
      track(runtime.routes, method, 'job')
    track(runtime.measurement.probe, 'read', 'probe')
    stops.push(
      ownMethod(
        player,
        'performRestore',
        (original) =>
          function (this: unknown, command: Obj, guard: Obj) {
            const previous = current
            current = { ...command, guard }
            note('restore-command', {
              phase: command.kind,
              value: command.value,
              commandAt: command.at,
              owned: guard.valid(),
            })
            try {
              const result = Reflect.apply(original, this, arguments)
              attempts.set(result, { ...command, guard })
              return result
            } finally {
              current = previous
            }
          },
      ),
    )
    stops.push(
      ownMethod(
        player,
        'correctRestore',
        (original) =>
          function (this: unknown, attempt: object) {
            const command = attempts.get(attempt)
            if (command) {
              corrections[command.kind as 'position' | 'rate']++
              note('correction-before', {
                phase: command.kind,
                value: command.value,
                commandAt: command.at,
                productAt: typeof command.guard?.now === 'function' ? command.guard.now() : null,
                readback: player.readRestore(attempt),
                native: native(),
              })
            }
            const result = Reflect.apply(original, this, arguments)
            if (command) note('correction-after', { phase: command.kind, native: native() })
            return result
          },
      ),
    )
    for (const [method, phase] of [
      ['seek', 'position'],
      ['setPlaybackRate', 'rate'],
    ] as const) {
      stops.push(
        ownMethod(
          sdk,
          method,
          (original) =>
            function (this: unknown, value: number) {
              if (armed && !isolation!.snapshot().intact) {
                invalid('write-isolation-lost')
                return Reflect.apply(original, this, arguments)
              }
              if (reloadAt !== null)
                note('sdk-call', {
                  phase,
                  value: Number.isFinite(value) ? value : null,
                  inRestore: current !== null,
                  owned: current?.guard.valid() ?? false,
                })
              if (!(
                armed &&
                reloadAt !== null &&
                current?.kind === phase &&
                current.value === value &&
                current.guard.valid() &&
                same()
              ))
                return Reflect.apply(original, this, arguments)
              const n = native()
              note('sdk-restore', { phase, value, native: n })
              const selected =
                options.kind === 'B' ||
                (options.kind === 'S' && phase === 'position') ||
                (options.kind === 'R' && phase === 'rate') ||
                (options.kind === 'U' && phase === 'position')
              if (!selected) return Reflect.apply(original, this, arguments)
              const mismatch =
                phase === 'position'
                  ? Number.isFinite(n.position) && Math.abs(n.position - value) > 1
                  : Number.isFinite(n.rate) && n.rate !== value
              if (options.kind !== 'U' && !mismatch) {
                invalid(phase + '-mismatch-absent')
                return Reflect.apply(original, this, arguments)
              }
              if (skipped[phase] !== 0) {
                invalid('repeated-sdk-command')
                return Reflect.apply(original, this, arguments)
              }
              skipped[phase]++
              note('sdk-ignored', { phase, mismatch })
              if (options.kind === 'U') {
                pendingAt = env.now()
                return new Promise<void>((resolve) => {
                  pendingResolve = resolve
                })
              }
              return undefined
            },
        ),
      )
    }
    stops.push(
      ownMethod(
        sdk,
        'reload',
        (original) =>
          function (this: unknown) {
            if (
              armed &&
              legalReload !== null &&
              player.controls().reloadRevision > before.controls.reloadRevision
            ) {
              reloadAt = env.now()
              note('owned-sdk-reload', {
                native: native(),
                intentOrdinal: reloadIntents,
                savedPositionSec: legalReload.savedPositionSec,
                savedRate: legalReload.savedRate,
              })
              legalReload = null
            }
            return Reflect.apply(original, this, arguments)
          },
      ),
    )
    if (typeof player.play === 'function')
      stops.push(
        ownMethod(
          player,
          'play',
          (original) =>
            function (this: unknown) {
              const prior = scriptPlay
              scriptPlay = reloadAt !== null
              try {
                return Reflect.apply(original, this, arguments)
              } finally {
                scriptPlay = prior
              }
            },
        ),
      )
    stops.push(
      ownMethod(
        sdk,
        'play',
        (original) =>
          function (this: unknown) {
            if (reloadAt !== null) note('sdk-play', { native: native(), scriptOwned: scriptPlay })
            return Reflect.apply(original, this, arguments)
          },
      ),
    )
    stops.push(
      runtime.recovery.subscribe((event: Obj) => {
        if (
          event.type === 'recovery' &&
          event.action?.action === 'player-reload' &&
          armed &&
          same()
        ) {
          if (legalReload !== null || reloadAt !== null) {
            invalid('multiple-legal-reload-intents')
            return
          }
          legalReload = {
            savedPositionSec: event.action.savedPositionSec,
            savedRate: event.action.savedRate,
          }
          note('legal-reload-intent', { ordinal: ++reloadIntents, ...legalReload })
        }
        if (event.type === 'recovery' || event.type === 'core')
          note('recovery-event', {
            type: event.type,
            state: event.state ?? null,
            reason: event.reason ?? null,
            source: event.source ?? null,
            action: event.action?.action ?? null,
            savedPositionSec: event.savedPositionSec ?? event.action?.savedPositionSec ?? null,
            savedRate: event.savedRate ?? event.action?.savedRate ?? null,
          })
      }),
    )
    stops.push(
      runtime.routes.subscribe((event: Obj) => {
        if (event.type === 'request-started' && isolation!.owns(event.request.requestId)) {
          requests.add(event.request.requestId)
          note('request-started', { media: event.request.kind })
        }
        if (event.type === 'transport-completed') {
          requests.delete(event.observation.request?.requestId)
          note('transport-completed', {
            media: event.observation.kind,
            outcome: event.observation.outcome,
          })
        }
      }),
    )
    if (env.document) {
      for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup']) {
        const listener = (event: Obj) => {
          if (!event.target?.closest?.('.bpx-player-container, #stage')) return
          note('trusted-input', {
            type,
            trusted: event.isTrusted === true,
            key: ['ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key) ? event.key : null,
            native: native(),
          })
        }
        env.document.addEventListener(type, listener, true)
        stops.push(() => env.document!.removeEventListener(type, listener, true))
      }
    }
    const tick = env.interval(() => {
      const now = env.now()
      if (collecting && now >= hardDeadline) invalid('attempt-deadline')
      else if (collecting && now - heartbeat >= options.leaseMs) invalid('lease-expired')
      else if (collecting && armAt !== null && now - armAt >= 90000) invalid('armed-deadline')
      if (pendingResolve && pendingAt !== null && now - pendingAt >= 8000) {
        invalid('pending-input-timeout')
        pendingResolve()
        pendingResolve = null
      }
      if (collecting) {
        try {
          sample()
        } catch {
          invalid('native-read-failed')
        }
      }
    }, 500)
    timers.add(tick)
    sample()
    const videoUrls = new Set<string>(),
      audioUrls = new Set<string>()
    const mpd = sdk.__core()?.getMpd?.(),
      collect = (row: Obj, set: Set<string>) => {
        for (const key of [
          'baseUrl',
          'baseURL',
          'base_url',
          'backupUrl',
          'backupURL',
          'backup_url',
        ])
          for (const value of Array.isArray(row[key]) ? row[key] : [row[key]])
            if (typeof value === 'string' && value.startsWith('https://')) set.add(value)
      }
    for (const row of mpd?.video ?? []) collect(row, videoUrls)
    for (const row of mpd?.audio ?? []) collect(row, audioUrls)
    for (const set of [videoUrls, audioUrls])
      for (const source of [...set])
        for (const host of options.catalog) {
          const u = new URL(source)
          u.hostname = host
          set.add(u.href)
        }
    for (const url of audioUrls) videoUrls.delete(url)
    if (!videoUrls.size || videoUrls.size > 1024) invalid('video-url-set-unavailable')
    return {
      heartbeat() {
        heartbeat = env.now()
        return collecting
      },
      targets() {
        return { video: [...videoUrls], audio: [...audioUrls] }
      },
      arm() {
        if (!collecting || errors.length || !same() || !isolation!.snapshot().intact)
          throw Error('arm-prerequisites')
        const v = player.video()
        for (let i = 0; i < v.buffered.length; i++)
          if (options.target >= v.buffered.start(i) && options.target <= v.buffered.end(i))
            throw Error('target-already-buffered')
        armed = true
        armAt = env.now()
        note('armed')
        return armAt
      },
      captureTrustedGoal() {
        const c = player.captureResumePosition()
        const n = native()
        const result = { value: c.positionSec, proof: c.proof !== null, native: n }
        note('trusted-goal', result)
        return result
      },
      input(kind: string, trusted: boolean) {
        note('input', { input: kind, trusted, native: native() })
      },
      releasePending() {
        if (!pendingResolve) return false
        note('pending-released')
        pendingResolve()
        pendingResolve = null
        return true
      },
      status() {
        return {
          id: options.id,
          collecting,
          began,
          ended,
          hardDeadline,
          armAt,
          reloadAt,
          pendingAt,
          pending: !!pendingResolve,
          errors: errors.slice(),
          before,
          native: native(),
          skipped: { ...skipped },
          corrections: { ...corrections },
          isolation: isolation!.snapshot(),
          rows: rows.length,
          events: events.length,
          bytes,
        }
      },
      export() {
        return {
          id: options.id,
          began,
          ended,
          armAt,
          reloadAt,
          pendingAt,
          before,
          rows: rows.slice(),
          events: events.slice(),
          errors: errors.slice(),
          skipped: { ...skipped },
          corrections: { ...corrections },
          bytes,
          isolation: isolation!.snapshot(),
        }
      },
      stopObservation,
      audit,
      tail,
      finish() {
        const result = audit()
        if (result.controlledInMemory || result.controlledPersisted)
          throw Error('controlled-sample-leak')
        return cleanup(false)
      },
      forceCleanup() {
        return cleanup(true)
      },
    }
  } catch (error) {
    for (const timer of timers) env.clear(timer)
    for (const stop of stops.reverse()) {
      try {
        stop()
      } catch {
        /* installation rollback */
      }
    }
    try {
      isolation?.stop()
    } catch {
      /* pending guard remains */
    }
    throw error
  }
}
