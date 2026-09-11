# BiliCDN_TW v1.6.2 測試報告

## 範圍

本版只改善 Worker 攔截的可觀測性。不可變前版為 v1.6.1，SHA-256 為 `e30a0fd4117067296ec022225705b52aa4f063d22ac761a2bce8d370ae5eae30`。

## 新增驗收

- 預設關閉時不讀取或替換頁面 Worker，也不建立 Blob 或 MessageChannel。
- 啟用後能分辨「攔截器已安裝但頁面未呼叫 Worker」與「成功包裝 Worker」。
- blob／data Worker、跨來源 module Worker及缺少安全亂數時，分別記錄固定的安全放行原因，不降低安全條件。
- 私有 bootstrap `ready`、Worker 網路／媒體／改寫／bytes 能寫入本分頁計數；普通 Worker message 不能偽造 ready。
- 頁面替換已安裝 constructor 時只記錄一次，不自動重裝或新增網路行為。
- 公開快照保持深度凍結、有限數值、無函式，且不含 Worker URL、path 或 query。

## 完整驗證

- 完整 Node／VM 回歸 **263／263** 通過；獨立 CS-001～003 子集 **19／19** 通過。
- 語法、可重現建置、v1.6.1 incremental 與 v1.3.4 cumulative patch 實際套用及 SHA-256 均通過。
- 與 v1.6.1 相同的健康 2x、seek 與真實 transport failure 250 秒流程，播放器請求、主動測速次數及 Range bytes 未增加。
- Codex Security v1.6.1→v1.6.2 差異掃描已完成：完整覆蓋 11 個權威變更項目，**0 findings**；scan ID `28362d18-9b0f-4546-8468-a06828ab6547`。VM 安全測試不替代正式掃描。

正式 userscript SHA-256：`1c1620013f636a0feae46d1cc3f75d8f6c3a0d1ecec62e7c1b875523bb289cc7`

## 實機界線

本版尚未以真實 Chrome／Tampermonkey 證明 Bilibili 當前播放器會建立可攔截 Worker。使用者需將 `EnableWorkerIntercept` 設為 `true`、重整並播放後，再提供診斷報告；本分頁 `constructorCalls`、`wrapped`、`bootstrapReady`、`netCalls` 與 `mediaSeen` 才能判斷實際用途。VM／mock 不冒充該實機證據。
