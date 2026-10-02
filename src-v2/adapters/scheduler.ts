import type { SchedulerPort } from '../application/ports.ts'

export class BrowserScheduler implements SchedulerPort {
  timeout(task: () => void, delayMs: number): () => void {
    const id = setTimeout(task, delayMs)
    return () => clearTimeout(id)
  }
  interval(task: () => void, delayMs: number): () => void {
    const id = setInterval(task, delayMs)
    return () => clearInterval(id)
  }
  microtask(task: () => void): void { queueMicrotask(task) }
}
