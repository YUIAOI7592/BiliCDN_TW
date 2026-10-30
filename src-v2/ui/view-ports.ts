import type { ControlCenterSnapshot } from './control-center-ports.ts'
export type ControlPage = 'overview' | 'cdn' | 'settings' | 'diagnostics'
export interface ControlViewFrame {
  readonly body: HTMLDivElement
  readonly foot: HTMLElement
}
export interface ControlViewBinding {
  refresh(model: ControlCenterSnapshot): void
  dispose?(): void
}
/** The modal owns subscriptions and asynchronous command lifetimes. */
export interface ControlViewActions {
  model(): ControlCenterSnapshot
  ownsView(): boolean
  refresh(): void
  refreshAfter(command: Promise<unknown>): Promise<void>
}
export type ReportCopyAction = (
  report: HTMLTextAreaElement,
  button: HTMLButtonElement,
  status: HTMLElement,
) => Promise<void>
export interface DiagnosticViewActions extends ControlViewActions {
  report(): string
  copy: ReportCopyAction
}
