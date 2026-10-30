import { DEFAULT_UNAVAILABLE_HOSTS, TRUSTED_CATALOG, isHkTestCandidate } from '../domain/catalog.ts'
import type {
  ControlViewFrame,
  ControlViewActions,
  SettingsViewDependencies,
} from './view-ports.ts'
import { createButton, createRow, createToggle } from './elements.ts'
import { restrictionLabel } from './labels.ts'

export function renderSettings(
  deps: SettingsViewDependencies,
  frame: ControlViewFrame,
  actions: ControlViewActions,
): void {
  const { body, foot } = frame
  const settings = deps.settings.get(),
    rows = document.createElement('div')
  rows.className = 'grid'
  const testTitle = document.createElement('h3')
  testTitle.textContent = 'UP141 測試功能'
  rows.append(testTitle)
  for (const [key, label] of [
    ['startupEarlyReleaseEnabled', '起播合格即放行'],
    ['healthMiddleRangeEnabled', '健康中段探測'],
    ['backupFamilyDiversityEnabled', '備援家族分散'],
  ] as const)
    rows.append(
      createToggle(
        label,
        settings[key],
        (value) => {
          const pending = deps.commands.updateSettings({ [key]: value })
          if (!value) actions.settings()
          return actions.refreshAfter(pending, () => actions.settings())
        },
        '測試版預設開啟。切換後請在新的有效播放情境開始對照；不重設測速或恢復預算。',
      ),
    )
  const mode = document.createElement('select')
  mode.append(
    new Option('由腳本自動挑選 CDN', ''),
    ...TRUSTED_CATALOG.map((host) => new Option(`固定使用：${host}`, host)),
  )
  mode.value = settings.fixedHost ?? ''
  mode.addEventListener('change', (event) => {
    if (!event.isTrusted) return
    void actions.refreshAfter(deps.commands.updateSettings({ fixedHost: mode.value || null }), () =>
      actions.settings(),
    )
  })
  rows.append(
    createRow(
      '要如何選 CDN',
      mode,
      '自動模式會參考可用性與測速結果；固定模式優先使用你指定的節點，但仍會避開已禁止使用的節點。',
    ),
  )
  rows.append(
    createToggle(
      '允許參考 B 站原生來源',
      settings.considerNativeSources,
      (value) => {
        const pending = deps.commands.updateSettings({ considerNativeSources: value })
        if (!value) actions.settings()
        return actions.refreshAfter(pending, () => actions.settings())
      },
      '預設關閉。關閉時，腳本辨識到的影音只依內建 CDN 清單選路、測速及提供播放器備援；無法安全改寫或沒有合法內建 CDN 時會擋下請求。開啟後，B 站當次提供的原始與備用網址可參與選路。下方的原生對照測試模式獨立運作；已送出的請求不會取消。',
    ),
  )
  rows.append(
    createToggle(
      '慢請求提前重試',
      settings.earlyRetryEnabled,
      (value) => {
        const pending = deps.commands.updateSettings({ earlyRetryEnabled: value })
        if (!value) actions.settings()
        return actions.refreshAfter(pending, () => actions.settings())
      },
      '實驗功能，預設關閉。播放緩衝不足且已有近期足夠快的合法替代 CDN 時，提早結束慢請求，讓網站自行重試；只適用於自動選路的影片請求。',
    ),
  )
  rows.append(
    createToggle(
      '測試：只用 B 站原本提供的 CDN',
      deps.routes.isOriginalComparison(),
      (enabled) => {
        deps.commands.setOriginalComparison(enabled)
        actions.settings()
      },
      '只影響這個分頁。新影片只用 B 站提供的原始或備用網址；被禁止的 CDN 仍不會使用。測試期間不測速，也不自動換 CDN。請先開新測試分頁、啟用後再點進影片；已經交給播放器的網址不會倒回重選。重新整理頁面即可退出。',
    ),
  )
  rows.append(
    createToggle(
      '阻止網頁使用 WebRTC',
      settings.blockWebRtc,
      (value) => deps.commands.updateSettings({ blockWebRtc: value }),
      '避免網頁建立點對點連線；不熟悉這項功能時，可維持預設值。',
    ),
  )
  rows.append(
    createToggle(
      '阻止網頁使用 HTTPDNS',
      settings.blockHttpDns,
      (value) => deps.commands.updateSettings({ blockHttpDns: value }),
      '避免網頁透過 HTTPDNS 另行尋找 CDN；不熟悉這項功能時，可維持預設值。',
    ),
  )
  rows.append(
    createToggle(
      '記錄更多診斷細節',
      settings.verbose,
      (value) => deps.commands.updateSettings({ verbose: value }),
      '開啟後會多記錄選路與測速資訊；關閉時仍會保留重要故障。記錄只存在目前分頁，重新整理後清空。',
    ),
  )
  for (const host of TRUSTED_CATALOG) {
    const defaultEnabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host)
    const enabled = settings.catalogOverrides[host] ?? defaultEnabled
    const penalties = deps.restrictions
      .list()
      .filter((row) => row.host === host)
      .map(
        (row) =>
          `${restrictionLabel(row.type)}（${row.kind === 'all' ? '影片＋音訊' : row.kind === 'video' ? '影片' : '音訊'}）`,
      )
    const detail = `${isHkTestCandidate(host) ? '香港節點；勾選只代表允許選路' : defaultEnabled ? '預設可用的內建 CDN' : '預設標為不可用；勾選後才允許'}${penalties.length ? `｜目前仍被禁止：${penalties.join('、')}；勾選不會解除禁止` : ''}`
    rows.append(
      createToggle(
        host,
        enabled,
        (value) => {
          const pending = deps.commands.setCatalogEnabled(host, value)
          return isHkTestCandidate(host)
            ? actions.refreshAfter(pending, () => actions.settings())
            : pending
        },
        detail,
      ),
    )
  }
  body.append(rows)
  foot.append(createButton('返回', () => actions.overview()))
}
