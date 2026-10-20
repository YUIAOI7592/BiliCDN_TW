# v1.8.8 功能驗證報告

## 基準與真實瀏覽器發現

不可變 v1.8.7 SHA-256：`781293f07fcffc094964b52ba0dfb493dc25215b154199b3f6f5a6076568874b`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

真實 Chrome／Tampermonkey v1.8.7 在連續站內換片後仍顯示 `API 0／頁面 0／no-playinfo`。CDP 觀察到點擊推薦後沒有新的 playurl 請求，而新影片媒體請求立即開始，表示下一片 playurl 已在點擊前完成。v1.8.7 只接納「請求先開始、SPA 後完成」的回應，無法保留「SPA 前已完成」的預抓資料。

## 修補驗證

- 固定 v1.8.7 重現：跨片 playurl 已完成並被舊頁處理，SPA reset 後可信 Route Pool 為零。
- v1.8.8 Fetch／XHR 將精確辨識的跨片 playurl 暫存，回應仍以原內容交還預抓者；目的 SPA 成為目前頁面後，於新 generation 建立可信 Route Pool。
- 暫存資料不能被不同目的頁採用；停用／重新啟用會清除全部暫存。
- 原有 Native route、403、被動 admission 與穩定性回歸改以同片頁面執行，確認新跨片辨識不改變同片語意。

## 本機結果

- `npm test`：327 項功能回歸通過、0 失敗、0 skip。
- 新增 v1.8.7 固定重現及 v1.8.8 Fetch／XHR／錯頁／停用生命週期共 5 項；已包含在總數內。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用及 SHA-256由 `npm run verify` 驗證。
- 依使用者要求，本版不執行 Code Security 掃描或獨立安全子集。

## 待實機複驗

安裝 v1.8.8 後，以自動畫質＋2x 連續點擊多支站內推薦，確認控制中心不再維持 `API 0／頁面 0／no-playinfo`，並觀察 representation、路由與緩衝能在每支影片重建。Node／VM 與 v1.8.7 的瀏覽器重現不能替代這項複驗。
