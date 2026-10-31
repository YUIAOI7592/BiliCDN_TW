import type { ControlCenterSnapshot } from './control-contracts.ts'
import { DEFAULT_UNAVAILABLE_HOSTS, TRUSTED_CATALOG } from '../domain/catalog.ts'
import type { ControlCommandPort } from '../application/control-ports.ts'
import type {
  ControlViewFrame,
  ControlViewActions,
  ControlViewBinding,
} from './control-contracts.ts'
import { createRow } from './elements.ts'
import { settingToggle } from './setting-controls.ts'
import { restrictionLabel } from './labels.ts'

export function renderCdn(
  commands: ControlCommandPort,
  frame: ControlViewFrame,
  actions: ControlViewActions,
  initialModel: ControlCenterSnapshot,
): ControlViewBinding {
  const mode = document.createElement('select')
  mode.setAttribute('aria-label', 'CDN 選擇方式')
  mode.append(
    new Option('自動挑選 CDN', ''),
    ...TRUSTED_CATALOG.map((host) => new Option('固定：' + host, host)),
  )
  let currentModel = initialModel
  mode.value = currentModel.settings.fixedHost ?? ''
  let pending = false
  mode.addEventListener('change', (event) => {
    if (!event.isTrusted || !actions.ownsView() || pending) {
      mode.value = currentModel.settings.fixedHost ?? ''
      return
    }
    pending = true
    void actions.refreshAfter(commands.updateSettings({ fixedHost: mode.value || null }), () => {
      pending = false
    })
  })
  const native = settingToggle(
    '允許參考 B 站原生來源',
    (m) => m.settings.considerNativeSources,
    (value) => commands.updateSettings({ considerNativeSources: value }),
    actions,
    initialModel,
    '預設啟用。開啟時，B 站當次授權的來源可以參與選路；禁止規則仍有效。',
  )
  const list = document.createElement('div')
  list.className = 'grid'
  const nodes = TRUSTED_CATALOG.map((host) => {
    const enabled = !DEFAULT_UNAVAILABLE_HOSTS.has(host)
    const toggle = settingToggle(
      host,
      (m) => m.settings.catalogOverrides[host] ?? enabled,
      (value) => commands.setCatalogEnabled(host, value),
      actions,
      initialModel,
      enabled ? '預設可用；勾選表示允許選路' : '預設不使用；勾選後才允許選路',
    )
    const restrictions = document.createElement('p')
    restrictions.className = 'detail restriction'
    toggle.row.append(restrictions)
    return { host, toggle, restrictions }
  })
  list.append(...nodes.map((n) => n.toggle.row))
  frame.body.append(
    createRow('CDN 選擇方式', mode, '固定與自動模式都會遵守授權及禁止規則。'),
    native.row,
    list,
  )
  const refresh: ControlViewBinding['refresh'] = (model) => {
    currentModel = model
    if (!pending) mode.value = model.settings.fixedHost ?? ''
    native.refresh(model)
    for (const node of nodes) {
      node.toggle.refresh(model)
      const rows = model.restrictions.filter((row) => row.host === node.host)
      node.restrictions.textContent = rows.length
        ? '目前限制：' +
          rows
            .map(
              (row) =>
                restrictionLabel(row.type) +
                '（' +
                (row.kind === 'all' ? '影片＋音訊' : row.kind === 'video' ? '影片' : '音訊') +
                '）',
            )
            .join('、') +
          '；勾選不會解除禁止'
        : ''
    }
  }
  refresh(initialModel)
  return { refresh }
}
