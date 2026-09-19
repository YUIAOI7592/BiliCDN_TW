# v1.9.3 功能驗證報告

## 基準與範圍

不可變 v1.9.2 SHA-256：`2ad6b39b9d7b0a13e75a73c3984611afcc69c78cbe90a2e62ddb1f92ec5f0084`。工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

本版只處理 restriction GM 熱路徑、共用影片元素解析及無效 BroadcastChannel 移除；不調整路由、測速、preconnect、Codec 或 Watchdog 門檻。

## 自動功能驗證

- 同一秒內重複選路、診斷與面板查詢不重複讀取 restriction key；正常刷新每個 key 只讀一次且不寫回未變資料。
- 跨分頁更新在下一個一秒狀態週期接納；已知 restriction 精確到期時可直接越過 freshness gate。
- 零尺寸但仍連接的影片維持 Watchdog 可見；新的正尺寸播放器優先，SPA／停用／重啟會重置 resolver。
- 正式執行路徑不再建立 BroadcastChannel；Web Locks 路徑與既有無鎖 fallback 語意保留。
- 完整功能回歸：354 項通過，0 失敗，0 skip。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用與 SHA-256 由 `npm run verify` 驗證。
- 依使用者要求，不執行 Code Security 掃描或獨立安全子集。

## 真實 Chrome／Tampermonkey

本報告產生時瀏覽器仍安裝 v1.9.2，因此不能把既有頁面或 Node／VM 結果描述為 v1.9.3 實機驗證。發布後更新至 v1.9.3，再驗證自動畫質＋2x、背景切換、最小化、seek、SPA、長暫停恢復及多分頁播放；成功標準是影片觀察不中斷，且沒有新增 probe、媒體請求或反覆換路。
