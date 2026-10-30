import type { ControlCommandPort } from '../application/control-ports.ts'
import type { SettingsReader } from '../state/settings-ports.ts'
import type { ControlRestrictionReader } from './control-center-ports.ts'

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
export interface SettingsViewRouteReader {
  isOriginalComparison(): boolean
}

export interface SettingsViewCommands extends Pick<
  ControlCommandPort,
  'updateSettings' | 'setCatalogEnabled' | 'setOriginalComparison'
> {}

export interface SettingsViewDependencies {
  readonly settings: SettingsReader
  readonly restrictions: ControlRestrictionReader
  readonly routes: SettingsViewRouteReader
  readonly commands: SettingsViewCommands
}
