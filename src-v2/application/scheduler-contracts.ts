export interface SchedulerPort {
  timeout(task: () => void, delayMs: number): () => void
  interval(task: () => void, delayMs: number): () => void
  microtask(task: () => void): void
}

export interface TimeoutSchedulerPort {
  timeout(task: () => void, delayMs: number): () => void
}
