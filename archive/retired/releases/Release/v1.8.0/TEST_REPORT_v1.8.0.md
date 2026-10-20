# BiliCDN_TW v1.8.0 測試報告

日期：2026-09-12

## 範圍

- 不可變前版：`Release/v1.7.0/BiliCDN_TW.user.js`
- 前版 SHA-256：`61dce8a100d3cb6112c960f5a77d92bdc17e4d4c1ef76d325c1aea5f689777f1`
- 本版目的：讓當前 playinfo 中的陌生原生 signed route 經有界探索與真實傳輸證據取得評級，並正確跟隨自動畫質的 active representation。
- 未調整 CDN catalog、2x 假定、AV1 預設、Watchdog 門檻、UCB／EWMA參數、HTTPDNS、測速額度／timeout／冷卻、Worker 移除狀態或控制中心頂層入口。

## 自動化結果

- 完整 Node 測試：289／289 通過，0 失敗，0 略過。
- 獨立安全子集：17／17 通過，0 失敗，0 略過；不重複計入 289 項產品案例。
- 新增覆蓋：Native admission、unknown → provisional → confirmed、第三方被動解鎖、403 epoch 失效、TTL／LRU、GM 污染、同組 exact URL、Request 物件、正式 Fetch／XHR、四候選 bakeoff、自動畫質確認及診斷去敏。
- 語法：正式 userscript與全部 `src/*.mjs` 通過 `node --check`。
- 可重現建置、incremental／cumulative patch 套用及 SHA-256 由 `npm run verify` 驗證。

## 資源比較

v1.8.0 的 Native 探索只替換一個既有 Catalog 量測名額。相同 250 秒 VM trace 的總請求、主動量測與 Range bytes 不高於 v1.7.0：

| Trace | 時點 | 播放器請求／主動量測／bytes |
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

- 掃描：v1.7.0 基準提交至 v1.8.0 working-tree candidate。
- 掃描 ID：`92c337f2-7ee2-4c85-ade7-1207ce17d3bc`
- 工具：Codex Security plugin 0.1.24；Daybreak Blue，xhigh。
- 覆蓋：14／14 個來源變更面，狀態 complete。
- 結果：0 個可報告 finding。
- 重點資料流：playurl → 主動 Fetch、playurl → GM Ledger、Native signed URL → 播放器請求。
- 已核對：頁面 `__playinfo__` 不授予 Native admission／probe；第三方 host 需真實播放器完成證據；signed URL 不寫入 GM、報告或公開快照；Native 評級不擴張 catalog 權限。
- 限制：未使用委派 discovery workers，由主掃描執行緒完成 14 項審查；掃描不等於 Chrome／Tampermonkey 實機播放驗證。

## 安全與功能邊界

- 完整 signed URL 只存在目前 playinfo epoch 的記憶體 pool；GM Ledger 僅保存有限的 exact hostname 與健康數值。
- PCDN／MCDN、IP literal、特殊埠、`/v1/resource`、`/live-bvc/` 不主動評級或探索。
- Native route 只能使用同 representation group 內已保存的 exact URL，不能合成 hostname，也不能成為 preconnect／forced redirect 目標。
- probe 只影響尚未開始的請求，不取消播放器自己的 Fetch／XHR；root-original 始終保留。

## 實機待驗收

v1.8.0 尚待使用者在真實 Chrome／Tampermonkey 驗收：自動畫質、1080p／4K 2x、畫質自動升降、AV1／HEVC切換、連續 seek、SPA、背景切回、陌生節點探索與診斷後態。VM、靜態檢查及安全掃描均未被描述為上述實機驗證。

## 環境

- Windows／PowerShell
- Node.js 26.8.1
- npm 11.19.0
- esbuild 0.28.2（精確鎖定的開發建置工具）
