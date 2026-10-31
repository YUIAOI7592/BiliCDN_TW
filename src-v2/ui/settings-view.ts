import type { ControlCenterDependencies } from './control-contracts.ts'
import type {
  ControlViewFrame,
  ControlViewActions,
  ControlViewBinding,
} from './control-contracts.ts'
import { createButton } from './elements.ts'
import { settingToggle } from './setting-controls.ts'

export function renderSettings(
  deps: ControlCenterDependencies,
  frame: ControlViewFrame,
  actions: ControlViewActions,
): ControlViewBinding {
  const rows = document.createElement('div')
  rows.className = 'grid'
  const toggles = (
    [
      ['startupEarlyReleaseEnabled', '起播提前放行', '找到足夠快的候選後提早開始播放。'],
      ['healthMiddleRangeEnabled', '健康中段探測', '檔案大小可靠時，從中段量測速度。'],
      ['backupFamilyDiversityEnabled', '備援家族分散', '速度足夠的備援優先分散至不同主機家族。'],
      [
        'earlyRetryEnabled',
        '慢請求提前重試',
        '緩衝不足且替代路線證據充足時，讓網站提早重試。效用評估仍未達原定門檻。',
      ],
      ['blockWebRtc', '阻止網頁使用 WebRTC', '阻止網頁建立點對點連線。'],
      ['blockHttpDns', '阻止網頁使用 HTTPDNS', '阻止網頁透過 HTTPDNS 另行尋找 CDN。'],
    ] as const
  ).map(([key, label, detail]) =>
    settingToggle(
      label,
      (m) => m.settings[key],
      (value) => deps.commands.updateSettings({ [key]: value }),
      actions,
      detail,
    ),
  )
  rows.append(...toggles.map((t) => t.row))
  const note = document.createElement('p')
  note.className = 'detail'
  note.textContent = '影片格式交由 B 站設定。變更功能後，請以新的播放情境比較效果。'
  const tools = document.createElement('details')
  tools.className = 'panel tools'
  const title = document.createElement('summary')
  title.textContent = '維護工具'
  const confirm = document.createElement('div')
  confirm.className = 'confirmation'
  const ask = (message: string, command: () => Promise<void>): void => {
    if (!actions.ownsView()) return
    const text = document.createElement('p')
    text.textContent = message
    confirm.replaceChildren(
      text,
      createButton(
        '確認執行',
        () => {
          if (!actions.ownsView()) return
          confirm.replaceChildren()
          return actions.refreshAfter(command())
        },
        'danger',
      ),
      createButton('取消', () => confirm.replaceChildren()),
    )
  }
  tools.append(
    title,
    createButton(
      '清除測速紀錄、黑名單與故障標記',
      () => ask('清除已學習的速度與限制資料？', () => deps.commands.clearLearning()),
      'danger',
    ),
    createButton(
      '還原預設設定（不清除測速紀錄）',
      () =>
        ask('還原所有設定？六個自動功能與香港節點將使用新版預設。', () =>
          deps.commands.resetSettings(),
        ),
      'danger',
    ),
    confirm,
  )
  frame.body.append(rows, note, tools)
  return {
    refresh: (model) => {
      for (const toggle of toggles) toggle.refresh(model)
    },
  }
}
