import type { ControlCenter } from './control-center.ts'
import type { PlayerMonitor } from '../application/player-monitor.ts'
import type { SessionStore } from '../state/session-store.ts'
import type { SettingsStore } from '../state/settings-store.ts'

export class PlayerPanel {
  #timer: number | null = null
  constructor(private readonly center: ControlCenter, private readonly settings: SettingsStore,
    private readonly session: SessionStore, private readonly monitor: PlayerMonitor) {}

  start(): void { if (this.#timer === null) { this.#timer = window.setInterval(() => this.#ensure(), 1500); this.#ensure() } }
  stop(): void { if (this.#timer !== null) clearInterval(this.#timer); this.#timer = null; document.querySelectorAll('[data-bilicdn-v2-panel]').forEach(node => node.remove()) }

  #ensure(): void {
    const anchors = [...document.querySelectorAll<HTMLElement>('.bpx-player-ctrl-setting-others')]
    if (!anchors.length) return
    const anchor = anchors.sort((a, b) => this.#area(b) - this.#area(a))[0]
    if (!anchor) return
    const existing = anchor.querySelector<HTMLElement>('[data-bilicdn-v2-panel]')
    if (existing) { const status = existing.querySelector<HTMLElement>('[data-bilicdn-v2-status]'); if (status) this.#renderStatus(status); return }
    const panel = document.createElement('div'); panel.dataset.bilicdnV2Panel = 'true'; panel.style.cssText = 'padding:4px 0 7px;font:11px/1.5 system-ui;color:#dbeafe'
    const status = document.createElement('div'); status.dataset.bilicdnV2Status = 'true'; status.style.cssText = 'padding:2px 0 5px;color:#7dd3fc'
    this.#renderStatus(status)
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '⚙️ 開啟 BiliCDN 控制中心'
    button.style.cssText = 'display:block;width:100%;padding:6px 8px;border:1px solid #38bdf8;border-radius:6px;background:#12344a;color:#e0f2fe;cursor:pointer'
    button.addEventListener('click', event => { if (!event.isTrusted) return; event.preventDefault(); event.stopPropagation(); this.center.show(button) })
    panel.append(status, button); anchor.append(panel)
  }

  #renderStatus(status: HTMLElement): void {
    const state = this.session.get(), video = this.monitor.snapshot().video
    status.textContent = `${this.settings.get().disabled ? '已停用' : 'BiliCDN v2'}｜${state.affinity?.host ?? '等待媒體'}｜${video.effectiveRate}x｜緩衝 ${video.playableBufferSec.toFixed(1)} 秒`
  }

  #area(anchor: HTMLElement): number {
    const root = anchor.closest<HTMLElement>('[id*="bilibili-player"],[class*="bpx-player"]')
    const video = root?.querySelector('video')
    return video ? video.clientWidth * video.clientHeight : 0
  }
}
