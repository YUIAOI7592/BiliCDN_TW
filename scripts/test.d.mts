export interface ProcessResult {
  code: number | null; signal: string | null; reason: string | null; error: string | null
  stdout: string; stderr: string; durationMs: number
}
export interface TestReport {
  version: number; nodeVersion: string; durationMs: number; success: boolean
  counts: { tests: number; passed: number; failed: number; cancelled: number; skipped: number; todo: number; suites: number; topLevel: number }
  cases: { name: string; status: string; kind: string; file: string | null; line: number | null; column: number | null; durationMs: number }[]
  failures: { name: string; file: string | null; line: number | null; column: number | null; message: string; stack: string }[]
}
export interface SuiteResult {
  suite: string; phase: string; success: boolean; process?: ProcessResult; report?: TestReport; executed?: number; error?: string
}
export interface Outcome { results: SuiteResult[]; cleanupError?: string; durationMs: number }
export interface RunnerOptions { name?: string; timeoutMs?: number; maxBytes?: number; executable?: string; emit?: boolean }
export function validateReport(report: unknown, processResult: { code: number | null }, options?: { filtered?: boolean; name?: string }): number
export function executeSuites(selected: readonly {name: string; source: string}[], options?: RunnerOptions): Promise<Outcome>
export function runTests(filter?: string, options?: RunnerOptions): Promise<Outcome>
export function finishOutcome(outcome: Outcome): number
