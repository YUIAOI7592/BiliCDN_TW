# v1.8.6 功能驗證報告

## 基準與問題重現

不可變 v1.8.5 SHA-256：`d600ffb24e012638ccdef4f18894bbd6d0a818af5be8c08df10685bc0cfed89d`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

固定舊版重現確認：

- v1.8.5 在 `__playinfo__` 先指派、隨後同一事件循環呼叫 `pushState` 的時序下，新頁 Route Pool 會保持空白並顯示 `no-playinfo`。
- v1.8.5 在短片已由目前 contiguous buffered range 緩衝至 duration 結尾時，仍可能進入 Watchdog recovery。
- v1.8.5 播放器設定面板沒有直接開啟控制中心的入口。

## 修補驗證

新增或擴充的案例涵蓋：

- history 前指派、history 後 reset 前指派、reset 後指派、快速連續 SPA，以及沒有新資料時不回填舊值。
- 片尾實機數值 `currentTime=82.762031`、`duration=86.8` 的完整 contiguous buffer；另涵蓋 duration 延長、非 contiguous 最終 range 與直播／無效 duration。
- 面板按鈕在啟用及停用狀態均存在、合成 click 無效、真實 click 開啟控制中心，以及面板重建後不重複插入。
- 控制中心仍沿用 closed Shadow DOM、一次性 capability 與焦點回復；開啟介面不新增網路行為。

## 本機結果

- `npm test`：317 項功能回歸通過、0 失敗、0 skip。
- SPA 專項 9 項、片尾 Watchdog 專項 5 項、播放器入口專項 5 項均通過；已包含在 317 項總數內。
- Fetch／XHR、Native route、Catalog、black／dead／soft、2x、AV1、Watchdog、可信控制中心與有界診斷回歸通過。
- 健康 250 秒流程的播放器請求、主動測速次數與 bytes 未因本次修改增加。
- `npm run verify`：語法、不可變 fixture、重複建置一致、317 項功能測試、incremental／cumulative patch 套用、SHA-256 與提交排除檢查均通過。

依使用者要求，本版不執行 Code Security 掃描或獨立安全子集。

## 真實 Chrome／Tampermonkey 驗證界線

正式 v1.8.6 產物仍需安裝後，以自動畫質、2x、多次 SPA、短片片尾、背景播放、seek 及播放器按鈕開啟控制中心進行實機驗證。本報告不以 VM／Node 測試取代真實播放結果。
