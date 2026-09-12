# v1.8.9 功能驗證報告

## 基準與真實瀏覽器發現

不可變 v1.8.8 SHA-256：`da0f9e7a886f7052c684a4f99cea83d5bfa3fe9a1a6dd7334e65e5d0a8acb35d`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

真實 Chrome／Tampermonkey v1.8.8 連續播放站內推薦時，CDP 顯示目標 playurl XHR 在 `Page.navigatedWithinDocument` 前已回覆 HTTP 200，播放器隨後以自動畫質、2x、`readyState=4` 正常播放；但唯讀診斷仍是 `API 0／頁面 0／no-playinfo`。請求確實經 userscript XHR facade 發出，表示缺口是頁面尚未讀取 response getter，並非請求繞過攔截器。

## 修補驗證

- 新增未讀取 `responseText` 的已完成 XHR 預抓重現；SPA 後精確目的頁建立可信 Route Pool。
- 新增未讀取 `responseType=json` 的重現；瀏覽器持有的原始物件保持未修改，SPA 後仍建立可信 Route Pool。
- 既有已讀取 XHR、Fetch、不同目的頁隔離及停用清理案例全部保留。
- 原生 DONE observer 於重新 `open()`／abort 時清除；頁面 getter 重用單次轉換快取。

## 本機結果

- `npm test`：329 項功能回歸通過、0 失敗、0 skip。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用及 SHA-256由 `npm run verify` 驗證。
- 依使用者要求，本版不執行 Code Security 掃描或獨立安全子集。

## 待實機複驗

安裝 v1.8.9 後，以自動畫質＋2x 連續點擊多支站內推薦，確認唯讀快照的 `nativeRouting.admission.trustedGroups` 不再在有 playurl 的新頁維持 0，並觀察 representation、路由與緩衝均能重建。Node／VM 與 v1.8.8 的瀏覽器重現不能替代這項複驗。
