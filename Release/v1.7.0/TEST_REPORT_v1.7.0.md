# BiliCDN_TW v1.7.0 測試報告

日期：2026-09-12

## 範圍

- 不可變前版：`Release/v1.6.3/BiliCDN_TW.user.js`
- 前版 SHA-256：`4184185d2b0191670aa82c28073d193abd0a99b5815bfa72166366383eabd45a`
- 本版目的：完整移除 Worker 攔截、包裝、私有通道、統計、設定、UI 與獨立 Worker bundle。
- 未調整主執行緒 Fetch／XHR、CDN catalog、2x 假定、AV1 預設、Watchdog、UCB／EWMA、probe／bakeoff 額度、timeout 或冷卻。

## 自動化結果

- 完整 Node 測試：268／268 通過，0 失敗，0 略過。
- 獨立安全子集：17／17 通過，0 失敗。
- v1.7.0 CS-003：確認正式 bundle 無 Worker 攔截標記、網站 Worker constructor 身分與參數保持原樣，遷移只刪除舊 `workerStats_v1`。
- 語法：正式 userscript 通過 `node --check`。
- 250 秒健康、seek 與故障 VM trace：播放器請求數、主動量測次數及量測 bytes 與 v1.6.3 相同。
- 可重現建置、incremental／cumulative patch 套用與 SHA-256 由 `npm run verify` 最終驗證。

## 資源比較

| Trace | 時點 | v1.6.3 與 v1.7.0 的播放器請求／主動量測／bytes |
|---|---:|---:|
| healthy／seek | 5 秒 | 14／4／1,572,864 |
| healthy／seek | 90 秒 | 48／4／1,572,864 |
| healthy／seek | 240 秒 | 112／8／3,145,728 |
| healthy／seek | 250 秒 | 116／8／3,145,728 |
| failure | 5 秒 | 14／4／1,572,864 |
| failure | 90 秒 | 52／8／3,145,728 |
| failure | 240 秒 | 116／12／4,718,592 |
| failure | 250 秒 | 120／12／4,718,592 |

## Codex Security 差異掃描

- 掃描：v1.6.3 基準提交至 v1.7.0 working-tree candidate。
- 掃描 ID：`3077452b-81f9-41b3-9757-c3ad9293e2ea`
- 工具：Codex Security plugin 0.1.24。
- 覆蓋：20／20 個 runtime／build 變更項目，狀態 complete。
- 結果：0 個可報告 finding。
- 掃描確認 Worker 信任邊界已由目前來源與建置圖移除；網站 Worker 回歸瀏覽器／網站所有。
- 限制：掃描不等於 Chrome／Tampermonkey 實機播放驗證，也未在掃描期間核對遠端 GitHub latest artifact。

## 實機證據與待驗收

使用者先前在 v1.6.3 實機樣本共觀察到 3 次 Worker constructor，全部為 Blob Worker 並安全放行；成功包裝、媒體請求與改寫皆為 0。此證據支持個人版移除，不代表所有 Bilibili 頁面都不使用 Worker。

v1.7.0 尚待使用者在真實 Chrome／Tampermonkey 驗收：畫質自動、1080p／4K 2x、連續 seek、SPA 換片、背景切回、控制中心診斷，以及網站自身 Worker 正常建立且報告不再出現 Worker 區塊。VM、靜態檢查與安全掃描均未被描述為上述實機驗證。

## 環境

- Windows／PowerShell
- Node.js 26.8.1
- npm 11.19.0
- esbuild 0.28.2（精確鎖定的開發建置工具）
