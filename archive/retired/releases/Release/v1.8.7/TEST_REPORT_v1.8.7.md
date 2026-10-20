# v1.8.7 功能驗證報告

## 基準與真實瀏覽器發現

不可變 v1.8.6 SHA-256：`a1ffdbd81337a0ca19bda738c39bfc7e550d32a75a359759701b86a9d57630ce`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

真實 Chrome／Tampermonkey v1.8.6 連續站內換片後，控制中心顯示 API／頁面 Route Pool 均為零。CDP 網路事件確認新影片 playurl 請求確實已發出，且時序為「請求開始 → history 切換與 generation reset → 回應完成」。因此問題是有效新片回應被舊 generation 檢查誤丟棄，而非 Bilibili 沒有提供 playurl。

同一輪實機亦確認：自動畫質、2x、seek 後續播、切離 Chrome 20 秒期間持續播放與補緩衝、完整緩衝片尾，以及播放器面板控制中心按鈕均正常。這些是 v1.8.6 的單輪實機證據，不替代 v1.8.7 安裝後複驗。

## 修補驗證

- 固定 v1.8.6 重現：符合新頁的 playurl 在 SPA generation 改變後回傳，原回應未轉換且 trusted Route Pool 保持零。
- v1.8.7 Fetch 與 XHR 均能在相同時序接納精確符合目前頁面的 playurl，建立可信 Route Pool。
- 不同 `bvid` 的晚到回應保持隔離，不改寫、不建立 Pool。
- 同一 `bvid` 的多 P 切換若請求未帶精確 `p`，不跨 generation 猜測接納。
- 既有 `__playinfo__` 三種 SPA 指派時序、快速換片、舊值不回填、停用／重新啟用及延遲舊回應回歸均通過。

## 本機結果

- `npm test`：322 項功能回歸通過、0 失敗、0 skip。
- 新增 SPA playurl generation 專項 5 項；已包含在 322 項總數內。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用及 SHA-256 由 `npm run verify` 驗證。
- 依使用者要求，本版不執行 Code Security 掃描或獨立安全子集。

## 待實機複驗

安裝 v1.8.7 後，以自動畫質＋2x 連續站內換片，確認控制中心的 API Route Pool 不再保持零，並再驗證 seek、背景切回與播放流暢度。Node／VM 與 v1.8.6 的實機結果不能替代這項複驗。
