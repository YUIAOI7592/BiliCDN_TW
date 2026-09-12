// Rendering and a trusted checkbox only; no GM or live health containers.
export function createPlayerPanel(deps) {
    // 只認 class，不鎖死中間包裝層數：bangumi/play（OGV 播放器）在 setting box 內部的
    // wrapper 層數與 video（UGC 播放器）不同，鎖死完整路徑會導致 waitForElm 逾時、
    // 「攔截修改影片 CDN」選項在番劇頁完全不出現（且預設不 verbose，使用者看不到任何錯誤）。
    // 只認 class 換來的代價：若頁面同時存在一個以上 .bpx-player-ctrl-setting-others
    // （例如浮動小視窗播放器、續播預覽卡用了同一套播放器元件），document.querySelector
    // 只會拿到 DOM 順序第一個，不一定是實際在播放的主播放器。有多個候選時，挑「最近的
    // <video> 面積最大」那個，跟 findVideo()/getVideo() 判斷主播放器的方式一致。
    const pickMainSettingsAnchor = (first) => {
        const all = document.querySelectorAll('.bpx-player-ctrl-setting-others')
        if (all.length <= 1) return first
        let best = first, bestArea = -1
        all.forEach(node => {
            const root = node.closest('[id*="bilibili-player"], [class*="bpx-player"]') || node
            const video = root.querySelector && root.querySelector('video')
            const area = video ? (video.clientWidth || 0) * (video.clientHeight || 0) : 0
            if (area > bestArea) { bestArea = area; best = node }
        })
        return best
    }
    // Bilibili 換片是 SPA 導航，不會整頁重載，播放器常把設定面板整個重建，
    // 注入的 UI 會被連根拔起。buildUI 抽成可重入函式、由 statusTimer 常駐偵測，
    // 面板消失時直接重建，取代原本「只注入一次、掉了就再也回不來」的作法。
    let renderVisibleStatus = () => {}
    const ensureControlCenterButton = (settingsBar) => {
        if (!settingsBar || settingsBar.querySelector('#bilicdn-control-center-button')) return
        const button = document.createElement('button')
        button.id = 'bilicdn-control-center-button'
        button.type = 'button'
        button.textContent = '⚙️ 開啟 BiliCDN 控制中心'
        button.setAttribute('aria-label', '開啟 BiliCDN 控制中心')
        button.style.cssText = 'display:block;width:100%;margin:3px 0 6px;padding:6px 8px;border:1px solid #4fc3f7;border-radius:5px;background:#16384a;color:#e1f5fe;font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;cursor:pointer;'
        button.addEventListener('click', event => {
            if (!event || !event.isTrusted) return
            event.preventDefault()
            event.stopPropagation()
            deps.openControlCenter()
        })
        settingsBar.appendChild(button)
    }
    const buildUI = (settingsBar) => {
        if (!settingsBar) return
        if (settingsBar.querySelector('#bilicdn-status-panel')) {
            ensureControlCenterButton(settingsBar)
            return
        }
        deps.uiInjectStatus = 'ok'

        settingsBar.appendChild(deps.fromHTML(
            '<div class="bpx-player-ctrl-setting-others-title">' + deps.SettingsBarTitle + '</div>'
        ))

        const checkBoxWrapper = deps.fromHTML(
            '<div class="bpx-player-ctrl-setting-checkbox bpx-player-ctrl-setting-blackgap bui bui-checkbox bui-dark">' +
            '<div class="bui-area">' +
            '<input class="bui-checkbox-input" type="checkbox" checked aria-label="自訂影片 CDN">' +
            '<label class="bui-checkbox-label">' +
            '<span class="bui-checkbox-icon bui-checkbox-icon-default">' +
            '<svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path d="M8 6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8zm0-2h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg>' +
            '</span>' +
            '<span class="bui-checkbox-icon bui-checkbox-icon-selected">' +
            '<svg xmlns="http://www.w3.org/2000/svg" data-pointer="none" viewBox="0 0 32 32"><path d="m13 18.25-1.8-1.8c-.6-.6-1.65-.6-2.25 0s-.6 1.5 0 2.25l2.85 2.85c.318.318.762.468 1.2.448.438.02.882-.13 1.2-.448l8.85-8.85c.6-.6.6-1.65 0-2.25s-1.65-.6-2.25 0l-7.8 7.8zM8 4h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z"></path></svg>' +
            '</span>' +
            '<span class="bui-checkbox-name">' + deps.SettingsBarTitle + '</span>' +
            '</label></div></div>'
        )

        const checkBox = checkBoxWrapper.querySelector('input')
        checkBox.checked = !deps.disabled
        checkBox.addEventListener('change', (event) => {
            if (!event || !event.isTrusted) {
                checkBox.checked = !deps.disabled
                return
            }
            deps.setRuntimeDisabled(!checkBox.checked)
            updateStatusPanel()
            deps.TrustedMenuUI.toast(deps.disabled ? 'CDN 改寫與主動量測已停用' : 'CDN 改寫已啟用', deps.disabled ? 'warning' : 'success')
        })

        // 狀態面板（白名單 + 緩衝進度 + 黑名單/死節點）
        const statusPanel = document.createElement('div')
        statusPanel.id = 'bilicdn-status-panel'
        statusPanel.style.cssText = 'font-size:10px;padding:2px 0 6px;line-height:1.6;'
        let lastStatusHtml = ''

        const renderStatusHtml = (html) => {
            if (html === lastStatusHtml) return
            lastStatusHtml = html
            statusPanel.innerHTML = html
        }

        const updateStatusPanel = () => {
            if (deps.disabled) {
                renderStatusHtml('<span style="color:#aaa;">CDN 切換已停用</span>')
                return
            }
            const s = deps.Watchdog.stats()
            const bufferText = deps.describePlaybackBuffer(s)
            const mode = deps.resolvedCdn ? '固定' : '自動'
            const rate = (deps.playbackRateState.confirmed ? deps.playbackRateState.observedRate : deps.ASSUMED_PLAYBACK_RATE) + 'x' + (deps.playbackRateState.confirmed ? '' : '（未確認，按 2x 估算）')
            const softCount = Object.keys(deps.cdnSoftBlockUntil).filter(deps.isCdnSoftBlocked).length
            const abnormalCount = deps.blacklistSet.size + deps.knownDeadHosts.size + softCount
            let html = '<div style="color:#4fc3f7;">'
                + mode + '｜Catalog 建議：' + deps.getCdnShortName() + '｜' + rate
                + '</div>'
                + '<div style="margin-top:3px;color:#90caf9;font-size:10px;">'
                + bufferText + '</div>'
            if (abnormalCount > 0) {
                html += '<div style="color:#ffb74d;margin-top:2px;">異常節點：' + abnormalCount
                    + '（請由控制中心查看）</div>'
            }

            renderStatusHtml(html)
        }

        updateStatusPanel()
        renderVisibleStatus = () => {
            if (!document.contains(statusPanel) || statusPanel.offsetParent === null) return
            updateStatusPanel()
        }

        settingsBar.appendChild(checkBoxWrapper)
        settingsBar.appendChild(statusPanel)
        ensureControlCenterButton(settingsBar)
    }

    // 常駐看門狗：waitForElm 只重試 30 秒，若第一次就逾時（網路慢、番劇頁載入久），
    // buildUI 從未執行過，statusTimer 也就從未誕生，面板會永遠不出現。這顆看門狗
    // 不受那次逾時影響，持續每 1.5 秒檢查一次；面板存在時直接休眠 no-op，
    // 面板消失（含「從未建立」與「被拔掉」兩種情況）時才動手找錨點重建。
    const ensureUiPresent = () => {
        const bar = pickMainSettingsAnchor(document.querySelector('.bpx-player-ctrl-setting-others'))
        if (!bar) return
        if (bar.querySelector('#bilicdn-status-panel') && bar.querySelector('#bilicdn-control-center-button')) return
        buildUI(bar)   // buildUI 開頭已有防重入判斷，找到錨點但面板已存在時會自行 no-op
    }

    deps.waitForElm('.bpx-player-ctrl-setting-others', 30000)
        .then(found => buildUI(pickMainSettingsAnchor(found)))
        .catch(() => { deps.uiInjectStatus = 'timeout'; deps.DiagnosticLog.fault('ui') })


return { renderVisibleStatus: () => renderVisibleStatus(), ensureUiPresent };
}
