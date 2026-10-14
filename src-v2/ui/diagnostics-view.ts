import type { DiagnosticViewPort } from '../diagnostics/ports.ts'
import type { ControlViewFrame, DiagnosticViewActions } from './view-ports.ts'
import { createButton } from './elements.ts'

export function renderDiagnostics(
  diagnostics: DiagnosticViewPort,
  frame: ControlViewFrame,
  actions: DiagnosticViewActions,
): void {
  const { body, foot } = frame
  const help = document.createElement('p')
  help.className = 'detail'
  help.textContent =
    '遇到卡頓時，按「記下剛剛的卡頓」，再複製報告提供排查。下方是給排查用的詳細資料；只看播放狀態可返回首頁。清除事故只刪除本分頁的事故記錄，不會變更 CDN 設定。'
  body.append(help)
  const report = document.createElement('textarea')
  report.className = 'report'
  report.readOnly = true
  report.value = actions.report()
  body.append(report)
  const status = document.createElement('p')
  status.className = 'detail'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  body.append(status)
  const copyReport = actions.captureCopy()
  const copy = createButton('複製報告', () => copyReport(report, copy, status))
  foot.append(
    createButton('記下剛剛的卡頓', () => {
      diagnostics.mark()
      actions.refresh()
    }),
    createButton('清除本分頁事故記錄', () => {
      diagnostics.clear()
      actions.refresh()
    }),
    copy,
    createButton('返回', () => actions.overview()),
  )
}
