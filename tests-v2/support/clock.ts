import type { SchedulerPort } from '../../src-v2/application/ports.ts'

export class FakeClock implements SchedulerPort {
  #now = 2_000_000_000_000
  #serial = 0
  #disposed = false
  #advancing = false
  #microtasks: (() => void)[] = []
  #tasks = new Map<number, { at: number; every: number; run: () => void }>()
  now = (): number => this.#now
  get pendingCount(): number { return this.#tasks.size + this.#microtasks.length }
  timeout(run: () => void, delayMs: number): () => void { return this.#add(run, delayMs, 0) }
  interval(run: () => void, delayMs: number): () => void {
    if (delayMs <= 0) throw new RangeError('Interval must be positive')
    return this.#add(run, delayMs, delayMs)
  }
  microtask(run: () => void): void { this.#open(); this.#microtasks.push(run) }
  advance(ms: number): void {
    this.#open(); this.#delay(ms)
    if (this.#advancing) throw Error('FakeClock advance is not reentrant')
    const end = this.#now + ms
    if (!Number.isFinite(end)) throw new RangeError('Clock overflow')
    let callbacks = 0
    const invoke = (run: () => void): void => {
      if (++callbacks > 10_000) throw Error('FakeClock callback limit (10000) exceeded')
      run()
    }
    this.#advancing = true
    try {
      for (;;) {
        while (!this.#disposed && this.#microtasks.length) invoke(this.#microtasks.shift()!)
        if (this.#disposed) break
        const next = [...this.#tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
        if (!next) break
        const [id, task] = next; this.#now = task.at
        if (task.every) task.at += task.every; else this.#tasks.delete(id)
        invoke(task.run)
      }
      this.#now = end
    } finally { this.#advancing = false }
  }
  dispose(): void { this.#disposed = true; this.#tasks.clear(); this.#microtasks.length = 0 }
  #open(): void { if (this.#disposed) throw Error('FakeClock disposed') }
  #delay(delay: number): void { if (!Number.isFinite(delay) || delay < 0) throw new RangeError('Delay must be finite and nonnegative') }
  #add(run: () => void, delay: number, every: number): () => void {
    this.#open(); this.#delay(delay)
    const at = this.#now + delay
    if (!Number.isFinite(at)) throw new RangeError('Clock overflow')
    const id = ++this.#serial; this.#tasks.set(id, { at, every, run })
    return () => { this.#tasks.delete(id) }
  }
}
