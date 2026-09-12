# 待辦

## v1.6.3

- [x] 依使用者明確要求，將 `EnableWorkerIntercept` 預設改為 `true`，讓 v1.6.2 的可觀測性實際收集資料。
- [x] 保留檔頭明確 opt-out；設為 `false` 時仍不得讀取／替換 Worker 或建立 Blob、MessageChannel。
- [x] 驗證預設安裝攔截器本身不建立 Worker、Blob、MessageChannel 或增加主動網路請求。
- [x] 修補頁面預先替換 `unsafeWindow.Worker` 取得 bootstrap capability／port 的信任邊界。
- [x] 將 classic／module 原始 Worker 延後至 authenticated bootstrap，固定 MessagePort／MessageEvent 原生方法並要求 `ready` 後才接受回報。

## v1.6.2

- [x] 將 Worker 的「0」拆成安裝狀態、constructor 呼叫、安全放行、包裝、bootstrap、網路與媒體觀察。
- [x] 以私有 MessagePort 的固定 `ready` schema 確認 Worker bootstrap，不接受普通 Worker message。
- [x] 偵測已安裝的 Worker constructor 是否被頁面替換；只記錄，不自動重裝。
- [x] 診斷報告、唯讀快照與控制中心同步顯示本分頁及累計結果，不公開 Worker URL。
- [x] 保持 Worker 預設關閉，不改播放、CDN 選路或主動量測參數。

## v1.6.1

- [x] 將 update／download URL 固定指向本儲存庫 latest Release 的單一 `BiliCDN_TW.user.js`。
- [x] GitHub Release 只保留 userscript；內部報告與 patch 不再作為 Release Assets。
- [x] 完整 package／verify；GitHub Release 僅上傳單一 userscript。

## v1.6.0

- [x] 固定正式 v1.5.5、必要樣本與 SHA。
- [x] esbuild 0.28.2、私有模組實例、獨立 Worker 與共用 URL 政策。
- [x] 舊回歸、新增未插樁／實例測試及 250 秒資源比較。
- [x] 雙 patch 實際套用、乾淨 checkout、公開內容與兩套 verify。
- [ ] 解決正式 Codex Security 封存 coverage 與已完成審查的狀態不一致；既有 sealed 報告不得改寫。
- [x] 依 2026-09-11 使用者指示，手動公開並正式發布 v1.6.0，保留安全報告限制。
- [x] 修正控制中心子頁取消／操作完成後誤關閉整個 session，新增完整往返與焦點測試。
- [x] 建立並推送 v1.6.0 標籤及 GitHub Release。
- [x] 真實 Chrome／Tampermonkey 自動畫質＋2x 播放與修正後控制中心主要流程驗收；背景切回及硬體解碼仍屬完整實機驗收界線。

## 刻意延後

- 頻寬算法替換：目前需求不足，不與重構混做。
- 跨分頁 GM 原子協調、跨播放器辨識、Worker 跨 generation／host-lock 協定。
- Worker 去留：v1.6.3 起預設啟用以蒐集實際證據；取得足夠樣本後再決定保留或移除。
- 不建構 CI/CD，不新增按鈕或圖表。
