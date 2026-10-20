# v1.9.6 功能驗證報告

## 基準與範圍

不可變 v1.9.5 userscript SHA-256：`8221fee2ec6b313bfba6459fc0203d56f71f410b3094e7c4422fc732c0aedde0`。工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

本版只改造本分頁診斷記錄、事故時間線、報告與 route 來源標記；不改 CDN 清單、選路分數、黑名單、Watchdog 門檻、2x、AV1、測速預算、Native Route 或播放器恢復行為，不新增 Bilibili API／媒體請求。

## 自動功能驗證

- Verbose 關閉時，Native 音訊 Transport failure、Catalog fallback 計畫、下一筆 fallback request、後續實際 host 與 core 結果仍保留於重要事件／事故。
- Verbose 開啟只增加成功流量彙總、候選評分與週期快照；相同故障的關鍵因果事件完全一致。
- 連續 1000 筆成功媒體請求不產生逐筆 `request／headers／eof` 事件，而是形成有界五秒彙總；事故凍結後不被健康流量覆蓋。
- verified Native audio failure、fallback-planned、fallback-requested、fallback-observed 與 core recovery 使用同一 `actionId`；video affinity 保持不變。
- HTTP、network、body 與 timeout 失敗保留單筆 method、kind、route type、group ordinal、status、bytes、TTFB、耗時及進度摘要。
- 明確 schema 保留 v1.9.5 route-failure 欄位；未知欄位增加 `droppedFields`，未知外部 host 改為 `external#N`，報告不含 URL、path、query、token、影片 ID 或 cookie。
- 控制中心的手動事故標記與清除只改本分頁記憶體，不增加 Fetch、XHR、probe、preconnect 或 GM 寫入；偽造 click 仍無效。
- Catalog generated URL 即使後續請求不再改 host，實際後態仍標為 `catalog-generated`，不再誤標 `root-original`。
- 完整功能回歸：378 項通過，0 失敗，0 skip。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用與 SHA-256 由 `npm run verify` 驗證。
- 依使用者要求，不執行 Code Security 掃描或獨立安全子集。

## 真實 Chrome／Tampermonkey

本輪未等待網站端再次發生真實卡頓或黑屏，因此不宣稱已用真實事故匯出完整因果鏈。安裝 v1.9.6 後，應在故障發生後立刻於控制中心診斷按「標記剛剛卡頓」，等待約 30 秒再複製報告；正常 Chrome 功能驗證、真實事故證據與自動 harness 結果必須分開解讀。
