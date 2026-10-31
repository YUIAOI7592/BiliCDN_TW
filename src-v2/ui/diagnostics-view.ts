import type { ControlCenterSnapshot } from './control-contracts.ts'
import type { ControlCenterDependencies } from './control-contracts.ts'
import type {
  ControlViewFrame,
  DiagnosticViewActions,
  ControlViewBinding,
} from './control-contracts.ts'
import { createButton } from './elements.ts'
import { settingToggle } from './setting-controls.ts'
import { measurementLabel, recoveryLabel } from './labels.ts'

export function renderDiagnostics(
  deps: Pick<ControlCenterDependencies, 'commands' | 'diagnostics'>,
  frame: ControlViewFrame,
  actions: DiagnosticViewActions,
  initialModel: ControlCenterSnapshot,
): ControlViewBinding {
  const summary = document.createElement('p')
  summary.className = 'diagnostic-summary'
  const help = document.createElement('p')
  help.className = 'detail'
  help.textContent = '遇到卡頓時記下問題，再複製或匯出報告。報告不包含簽名網址與帳戶權杖。'
  const report = document.createElement('textarea')
  report.className = 'report'
  report.readOnly = true
  report.setAttribute('aria-label', '完整診斷報告')
  const container = document.createElement('div')
  let built = false,
    visible = false,
    exportUrl: string | null = null
  const release = (): void => {
    if (exportUrl !== null) {
      URL.revokeObjectURL(exportUrl)
      exportUrl = null
    }
  }
  const ensureReport = (): boolean => {
    if (!actions.ownsView()) return false
    if (!built) {
      report.value = actions.report()
      built = true
    }
    return true
  }
  const show = createButton('查看完整報告', () => {
    if (!ensureReport()) return
    visible = !visible
    container.replaceChildren(...(visible ? [report] : []))
    show.textContent = visible ? '收起完整報告' : '查看完整報告'
  })
  const reveal = (): boolean => {
    if (!ensureReport()) return false
    visible = true
    container.replaceChildren(report)
    show.textContent = '收起完整報告'
    return true
  }
  const status = document.createElement('p')
  status.className = 'detail'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const copy = createButton('複製報告', () => {
    if (reveal()) return actions.copy(report, copy, status)
  })
  const download = createButton('匯出報告', () => {
    if (!ensureReport()) return
    release()
    try {
      const url = URL.createObjectURL(
        new Blob([report.value], { type: 'application/json;charset=utf-8' }),
      )
      if (!actions.ownsView()) {
        URL.revokeObjectURL(url)
        return
      }
      exportUrl = url
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'BiliCDN-diagnostics.json'
      frame.body.append(anchor)
      try {
        if (actions.ownsView()) anchor.click()
      } finally {
        anchor.remove()
      }
      if (actions.ownsView()) status.textContent = '已要求下載報告，請確認下載結果'
    } catch {
      release()
      if (actions.ownsView()) status.textContent = '匯出失敗，請複製報告'
    }
  })
  const comparison = settingToggle(
    '只用 B 站原本提供的 CDN',
    (m) => m.routes.originalComparison,
    (enabled) => deps.commands.setOriginalComparison(enabled),
    actions,
    initialModel,
    '僅目前分頁的原線對照；重新整理後關閉。新請求使用原生授權來源，禁止規則仍有效。',
  )
  const resetReport = (): void => {
    built = false
    if (visible) ensureReport()
    actions.refresh()
  }
  frame.body.append(summary, help, comparison.row, show, container, status)
  frame.foot.append(
    createButton('記下剛剛的卡頓', () => {
      if (actions.ownsView()) {
        deps.diagnostics.mark()
        resetReport()
      }
    }),
    createButton('清除本分頁事故記錄', () => {
      if (actions.ownsView()) {
        deps.diagnostics.clear()
        resetReport()
      }
    }),
    createButton('更新報告', () => {
      if (actions.ownsView()) {
        built = false
        reveal()
      }
    }),
    copy,
    download,
  )
  const refresh: ControlViewBinding['refresh'] = (model) => {
    comparison.refresh(model)
    summary.textContent =
      '請求攔截：' +
      (model.interception.hookState === 'installed' ? '運作中' : '未完整啟用') +
      ' · 播放器：' +
      recoveryLabel(model.recovery.state) +
      ' · 健康探測：' +
      measurementLabel(model.measurement.state, model.measurement.reason)
  }
  refresh(initialModel)
  return { refresh, dispose: release }
}
