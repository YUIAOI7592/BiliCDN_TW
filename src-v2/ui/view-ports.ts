export interface ControlViewFrame {
  readonly body: HTMLDivElement
  readonly foot: HTMLElement
}

/** Navigation and async command ownership remain with ControlCenter. */
export interface ControlViewActions {
  overview(): void
  settings(): void
  diagnostics(): void
  close(): void
  refreshAfter(command: Promise<unknown>, render: () => void): Promise<void>
}

export type ReportCopyAction = (
  report: HTMLTextAreaElement,
  button: HTMLButtonElement,
  status: HTMLElement,
) => Promise<void>
export interface DiagnosticViewActions {
  overview(): void
  refresh(): void
  report(): string
  captureCopy(): ReportCopyAction
}
