# BiliCDN_TW v1.8.1 測試報告

日期：2026-09-12

## 範圍

- 不可變前版：`Release/v1.8.0/BiliCDN_TW.user.js`
- 前版 SHA-256：`556e2f367f8c887ce7ea7323033c71a7d9039d46110f6997b12432f0af5bb266`
- 本版目的：修復健康播放反覆換 CDN、representation 預取誤觸換線，以及頁面 `__playinfo__` 清除可信 Native Pool。
- 未調整 CDN catalog、2x 假定、AV1 預設、Watchdog 門檻、UCB／EWMA參數、HTTPDNS、每輪候選、測速額度／timeout／冷卻或 Worker 移除狀態。

## 自動化結果

- 完整 Node 測試：296／296 通過，0 失敗，0 略過。
- 獨立安全子集：17／17 通過；不重複計入 296 項產品案例。
- 新增覆蓋：v1.8.0 representation→Watchdog 錯誤接線重現、同高度 codec 預取、健康 Native probe 僅評級、合法 recovery boundary、Native 失敗回 Catalog、跨畫質 exact Native affinity、缺少 exact route 的 epoch Catalog 降級，以及 `__playinfo__` Pool 隔離。
- 既有回歸包含 Fetch 單 reader／取消原因、XHR text/json、host-lock、PCDN、contiguous buffer、停用／SPA、2x、AV1、Watchdog 歸因、可信控制中心、有界診斷及 Worker 攔截不存在。
- `node --check`、可重現建置、v1.8.0 incremental／v1.3.4 cumulative patch 套用及 SHA-256 全部通過。

## 資源與穩定性比較

相同 250 秒 VM trace 中，健康播放、seek 與故障的播放器請求、主動量測及 Range 額度未高於既有基準：

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

健康 Native probe 測試確認只更新 `probe-qualified` 評級，不改下一筆路線；verified Catalog／Native failure 及 Watchdog recovery 保留合法換路能力。播放器明確選用 playurl 內的 exact signed backup 可原樣通過，但任意未列出的 host 不能繞過 affinity。

## Codex Security 差異掃描

- 狀態：已完成 v1.8.0→v1.8.1 正式差異掃描；scan ID `41ab0dc6-97af-4de3-8538-7443c32d6be7`。
- 掃描模型：Daybreak Blue，xhigh；13／13 個安全相關變更面已覆蓋，0 項可報告 finding，無 deferred 項目。
- 執行環境未允許委派 reviewer，因此由主 reviewer 完整審閱 13 個變更面；這項限制已寫入封存 coverage。
- VM 安全子集與正式安全掃描分開記錄，兩者均不替代 Chrome／Tampermonkey 實機播放驗證。

## 實機待驗收

本報告只證明本機 Node／VM、靜態與封裝驗證。仍需在真實 Chrome／Tampermonkey 以「自動畫質」為主，測試至少四分鐘健康播放、1080p／4K 2x、AV1／HEVC 預取、畫質升降、連續 seek、SPA及背景切回。成功標準是流暢期間不由腳本主動換 host，真實故障仍能恢復。

## 環境

- Windows／PowerShell
- Node.js 26.8.1
- npm 11.19.0
- esbuild 0.28.2（精確鎖定的開發建置工具）
