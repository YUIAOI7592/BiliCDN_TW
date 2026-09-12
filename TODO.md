# 待辦

## v1.8.1

- [x] 建立 session Route Affinity；representation group 只保存 exact signed URL，不再各自擁有健康中途換線權。
- [x] 移除 probe／bakeoff 的健康中途 forced redirect；評級勝出只供下一個合法選路邊界使用。
- [x] 分離 representation revision、planned route 與 observed host；只有後續影片 Transport 才形成實際 host 後態。
- [x] 自動畫質／codec 切換要求連續兩筆同組影片傳輸；同高度預取不再單筆切換 active group。
- [x] 將 `__playinfo__` 限制為 page-compatible 轉換，不能清除、建立或提交 Native 狀態。
- [x] 完成 296 項自動測試、17 項 CS 子集、雙 patch、重現建置及 13／13 v1.8.0→v1.8.1 Codex Security 差異掃描。

## v1.8.0

- [x] 建立目前 playinfo epoch 專屬的 Signed Route Pool；完整 URL 不持久化、不進診斷或頁面快照。
- [x] 建立 video 48／audio 16 筆 host-only Native Route Rating Ledger，含六小時 TTL、LRU 與跨分頁時間戳合併。
- [x] 讓 confirmed Native 與 Catalog 共用純評分尺度，但不授予 catalog、換 host、preconnect 或 forced redirect 權限。
- [x] 將陌生 Native 探索限制在既有 bakeoff 四個名額中的一個；保留既有 bytes、timeout、冷卻與週期。
- [x] 以 video height 或八秒內兩筆影片傳輸確認 active representation，隔離預取、音訊與舊 epoch。
- [x] 重新設計診斷，分開目前請求路線、Catalog 建議、active/tentative representation、Ledger 與 bakeoff 後態。
- [x] 完成 289 項自動測試、17 項 CS 子集、雙 patch、重現建置及 14／14 Codex Security 差異掃描。
- [x] 標記為存在健康播放反覆換路問題的歷史版本；由 v1.8.1 取代。

## v1.7.0

- [x] 依 v1.6.3 實機樣本完整移除 Worker controller、runtime、statistics、設定與獨立 bundle。
- [x] 保留 v1.6.3 Worker 測試作歷史重現；現行 CS-003 改驗證攻擊面不存在及網站 Worker 身分／參數不變。
- [x] 從診斷、唯讀快照與控制中心移除 Worker 欄位，刪除進階頁並把 Verbose 併入診斷。
- [x] 升級時最佳努力刪除舊 `workerStats_v1`，不影響其他 GM 設定與健康資料。
- [x] build manifest 移除 Worker source 與 `workerSha256`，正式產物不含 bootstrap、policy 或 MessageChannel。

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
- [x] esbuild 0.28.2、私有模組實例與當時的獨立 Worker；v1.7.0 已移除 Worker 建置路徑。
- [x] 舊回歸、新增未插樁／實例測試及 250 秒資源比較。
- [x] 雙 patch 實際套用、乾淨 checkout、公開內容與兩套 verify。
- [ ] 解決正式 Codex Security 封存 coverage 與已完成審查的狀態不一致；既有 sealed 報告不得改寫。
- [x] 依 2026-09-11 使用者指示，手動公開並正式發布 v1.6.0，保留安全報告限制。
- [x] 修正控制中心子頁取消／操作完成後誤關閉整個 session，新增完整往返與焦點測試。
- [x] 建立並推送 v1.6.0 標籤及 GitHub Release。
- [x] 真實 Chrome／Tampermonkey 自動畫質＋2x 播放與修正後控制中心主要流程驗收；背景切回及硬體解碼仍屬完整實機驗收界線。

## 刻意延後

- 頻寬算法替換：目前需求不足，不與重構混做。
- 跨分頁 GM 原子協調與跨播放器辨識。
- Worker 去留已在 v1.7.0 決定為移除；除非未來有新的真實需求證據與完整安全設計，不重新引入。
- 不建構 CI/CD，不新增按鈕或圖表。
- Native Ledger 的跨分頁寫入仍為時間戳合併而非原子交易；不新增跨分頁協定。
