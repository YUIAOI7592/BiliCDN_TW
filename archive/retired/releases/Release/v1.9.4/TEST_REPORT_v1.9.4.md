# v1.9.4 功能驗證報告

## 基準與範圍

不可變 v1.9.3 SHA-256：`e104f9b0d83bd8e9043f987792c606d0c3c8b64ec2934e652a60562799b1fc46`。工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

本版只修正長暫停後死影片仍維持 paused、舊狀態機無法建立播放意圖的核心生命週期問題；不調整 CDN 清單、路由評分、黑名單、2x、AV1、測速預算或 Native Route。

## 自動功能驗證

- 固定重現外層 player 位於 349.434 秒、2x，但 `<video>` 已退化到時間零、`readyState=0`、尺寸 0×0、paused=true 且 core 未初始化。
- 可信主影片元素 `play()` 在 transient user activation 下建立一次 resume token；四秒強證據後只呼叫一次 `player.reload()`。
- 新核心恢復後位置回到 349.434 秒、倍速回到 2x，且只呼叫一次播放；拒絕時標記 recovered-paused，不循環重試。
- 包裝器保持原 receiver、參數、同步例外及回傳值；程式呼叫、短暫暫停、不可寫方法、網站替換方法、player 實例替換及 SPA/reset 均 fail-open 或正確解除。
- 核心恢復流程不呼叫路由恢復，不建立 CDN 暫避、處分、probe、preconnect 或主動測速。
- 完整功能回歸：363 項通過，0 失敗，0 skip。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用與 SHA-256 由 `npm run verify` 驗證。
- 依使用者要求，不執行 Code Security 掃描或獨立安全子集。

## 真實 Chrome／Tampermonkey

使用額外 Bilibili 測試分頁做語意入口量測，未操作使用者保留的暫停頁面。正常播放按鈕恢復時，公開 `window.player.play()` 與 core `play()` 呼叫數均為 0，目前主影片元素 `play()` 呼叫一次，且該同步呼叫的 `navigator.userActivation.isActive` 為 true。臨時量測包裝已解除；正常暫停／恢復後播放器維持健康。

上述證據確認 v1.9.4 使用的觸發入口會在目前網站流程實際發生，但量測當時瀏覽器尚未安裝 v1.9.4，也未再次重現死核心。因此不得把自動案例描述為已完成真實死核心修復驗證。發布後更新至 v1.9.4，再以長暫停情境確認只 reload 一次並恢復位置與 2x。
