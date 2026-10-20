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

## 真實 Chrome／Tampermonkey 驗證

將本機正式產物覆蓋至 Tampermonkey 後，在同一 Chrome 分頁從 `BV1D9cuzcEok` 的站內推薦連續切換至 `BV1v9bR6dEse`、`BV1wE6EBsEKT`：

- 三頁的播放器設定均出現 BiliCDN 面板，使用自動畫質與 2.0x。
- 第一次換片初期曾顯示 0 秒連續緩衝，約 10 秒後補至 72.64 秒，播放位置由 00:32 前進至 01:05。
- 第二次換片在 00:32 時已有 68.71 秒連續前方緩衝。
- 兩次換片後面板均重新呈現 Catalog 建議與已確認 2x，未重現 v1.8.4 長期 `no-playinfo` 後的面板／媒體狀態失聯。

瀏覽器自動化執行於與頁面分離的擴充功能世界，不能直接讀取 Tampermonkey 主世界中的 `window.BiliCDN`；因此本次實機證據以同一頁籤的站內換片、播放器進度及 BiliCDN 面板後態為準，不宣稱直接讀取了 Native Pool 內部值。303 項功能測試另直接覆蓋 reset 前後 playinfo 時序、Pool 重建與舊值不回填。

VM／本機結果不等於實機播放；本次也未涵蓋真正隱藏分頁及 4K。
