import type { SchedulerPort } from '../../src-v2/application/ports.ts'

export class FakeClock implements SchedulerPort {
  #now = 2_000_000_000_000
  #serial = 0
  #tasks = new Map<number, { at: number; every: number; run: () => void }>()
  now = (): number => this.#now
  timeout(run: () => void, delayMs: number): () => void { return this.#add(run, delayMs, 0) }
  interval(run: () => void, delayMs: number): () => void { return this.#add(run, delayMs, delayMs) }
  microtask(run: () => void): void { this.#add(run, 0, 0) }
  advance(ms: number): void {
    const end = this.#now + ms
    for (;;) {
      const next = [...this.#tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
      if (!next) break
      const [id, task] = next; this.#now = task.at
      if (task.every) task.at += task.every; else this.#tasks.delete(id)
      task.run()
    }
    this.#now = end
  }
  dispose(): void { this.#tasks.clear() }
  #add(run: () => void, delay: number, every: number): () => void {
    const id = ++this.#serial; this.#tasks.set(id, { at: this.#now + delay, every, run })
    return () => { this.#tasks.delete(id) }
  }
}
