# v1.8.5 功能驗證報告

## 基準與實機問題

不可變 v1.8.4 SHA-256：`17e38f523c0cd0aed1c6c607d8a1c9bf141e9a3bd9036a409964e934c2ae44c5`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

v1.8.4 真實 Chrome／Tampermonkey 第一輪測試涵蓋四支影片、自動畫質、2x、跨緩衝 seek 與非焦點視窗播放。先前 Akamai 停滯案例在 Watchdog 後改走 Catalog，buffer 恢復約 71 秒且未切回。另一方面，從站內推薦以 SPA 換片後，播放雖可繼續，診斷持續顯示 `activeRepresentation=null`、`pageGroups=0`、`waitingReason=no-playinfo`；完整重整同一 URL 後資料立即恢復。

程式重現確認兩個原因：初始 `__playinfo__` 已存在時沒有安裝 setter；新值若在 `pushState` 與延遲 SPA reset 之間出現，也會先建立後被 reset 清除。

## 修補驗證

新增 5 項案例：

- 固定 v1.8.4「初始 property 存在，SPA 後新值無法建立 Pool」重現。
- 新值在 SPA reset 完成後指派，可建立一組 page-hint route group。
- 新值在 `pushState` 後、reset timer 前同步指派，會在新 generation 重建。
- 沒有新值時，不會把上一片的 playinfo 回填進空 Pool。
- 頁面替換 configurable `__playinfo__` data property 後，既有一秒週期會重新掛回並處理新值。

## 本機結果

- `npm test`：303 項功能回歸通過、0 失敗、0 skip；包含上述 5 項，不重複加總。
- SPA／生命週期／Native route／Catalog provenance／host restrictions 專項 81 項通過。
- Fetch 單 reader與取消原因、XHR JSON／重用、host-lock、PCDN、停用／重啟、2x、AV1、Watchdog、可信控制中心與有界診斷回歸通過。
- `npm run verify`：語法、不可變 fixture、重複建置一致、303 項功能測試、incremental／cumulative patch 套用、SHA-256 與提交排除檢查均通過。
- 新觀察使用既有一秒狀態週期，不新增 timer、Fetch、XHR、probe、preconnect 或測速額度。

依使用者要求，本版不執行 Code Security 掃描或獨立安全子集。

## 實機驗收界線

目前實機證據來自 v1.8.4；v1.8.5 安裝前不能宣稱 SPA 修補已在 Tampermonkey 通過。更新後應從站內推薦連續切換至少兩支影片，確認每次新頁都出現非零 page/trusted groups、representation 能由影片傳輸確認、2x buffer 持續補充且健康播放不反覆換 host。

VM／本機結果不等於真實 Chrome 驗收。真正隱藏分頁及 4K 仍須另行實測。
