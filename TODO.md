# 待辦

## v1.9.2

- [x] 保留 v1.9.1 的隔夜首次播放保護；自動 probe／bakeoff 只在播放進度與可播放緩衝成立後啟動。
- [x] 辨識長暫停恢復後 audio 活著、video core 未初始化的 `video-init-dead` 狀態。
- [x] 每個 resume token 最多一次 `player.reload()`，恢復位置、倍速與播放意圖；逾時、缺 API 與失敗受 breaker 限制。
- [x] 自動模式只做兩分鐘分頁內路線暫避；固定 CDN、black／dead／soft／設定排除不被繞過。
- [x] hidden 事件繼續隔離，真實 visible 事件可送達 Bilibili；Manifest 診斷分開顯示資料接納與 core 活性。
- [x] 349 項功能回歸、語法、可重現建置、patch 套用及 SHA-256 通過；未執行 Code Security。
- [ ] 安裝後以真實 Chrome／Tampermonkey 驗證長時間暫停、切換視窗、恢復播放，確認只重載一次且不循環。

## v1.9.0

- [x] 真實 Chrome 確認部分 SPA 沒有新 playurl，`__playinfo__` 仍是舊物件，但目前 `player.__core().getMpd()` 已含新片 signed representation。
- [x] 加入 manifest／MPD 有界只讀同步；不修改播放器、不新增 Bilibili API 或媒體請求。
- [x] 首筆 Fetch／XHR context miss 同步重讀一次，仍失敗時以 exact URL 建立最多 16 組 transport bootstrap。
- [x] 固定 playurl API > player MPD > page-hint > transport bootstrap 優先序；可信 API 可接管較低層資料。
- [x] 覆蓋暫時不可讀、快速連續 SPA、暫態舊 MPD、停用、去敏及兩種網路入口。
- [ ] 安裝 v1.9.0 後，以多次站內推薦 SPA 實機確認播放器 MPD Route Pool、representation、背景續播與控制中心診斷。

## v1.8.9

- [x] 真實 Chrome 確認 v1.8.8 的下一片 playurl XHR 已在 SPA 前完成，但頁面尚未讀取 response getter，因此既有 staging 未執行。
- [x] 在原生 XHR DONE 事件主動完成一次 playurl 轉換／快取；文字與 JSON 回應均不等待頁面 getter。
- [x] 保持精確目的頁、generation、容量及停用清理邊界；不改播放器請求與路由算法。
- [x] 329 項功能回歸通過；不執行 Code Security 或獨立安全子集。
- [x] 安裝 v1.8.9 後實機確認仍有不發新 playurl 的 SPA，改由 v1.9.0 的播放器 MPD 同步補齊。

## v1.8.8

- [x] 以真實 Chrome/CDP 確認部分站內推薦的 playurl 在點擊前已完成，換頁後沒有新 playurl 請求。
- [x] 以有界、本分頁記憶體暫存精確辨識的跨片 Fetch／XHR playurl，於相符 SPA 目的頁接續。
- [x] 不同目的頁與停用／重新啟用不能採用舊暫存；同片 playurl 維持立即處理。
- [x] 327 項功能回歸通過；不執行安全掃描。
- [x] 安裝 v1.8.8 後實機複驗，發現 XHR 完成但尚未讀取 getter 的實際順序仍使 Pool 為零，由 v1.8.9 修正。

## v1.8.7

- [x] 以真實 Chrome/CDP 確認 SPA playurl 請求存在，但其回應因 generation reset 被丟棄。
- [x] 只接納緊鄰 SPA 且 `bvid`／`aid`／`epid` 與目前頁面精確相符的 Fetch／XHR 回應。
- [x] 保持錯片、停用／重啟及無法確認的多 P 回應隔離。
- [x] 322 項功能回歸通過；不執行安全掃描。
- [x] 安裝 v1.8.7 後實機複驗，確認「請求跨 generation 完成」已修正，但發現「點擊前已完成預抓」仍使 Pool 為零，由 v1.8.8 修正。

## v1.8.6

- [x] 修正新 `__playinfo__` 在 history 前指派後被 SPA reset 清除，並保持未變更舊值不回填。
- [x] 修正 contiguous buffer 已到 duration 時 Watchdog 因低於五秒危險線誤發 recovery。
- [x] 播放器設定面板新增可信控制中心按鈕，可在停用狀態使用並可由注入看門狗重建。
- [x] 317 項功能回歸通過；不執行安全掃描。
- [x] 實機確認自動畫質＋2x、seek、20 秒非焦點續播、完整緩衝片尾與面板按鈕；另發現 SPA playurl generation 競態，由 v1.8.7 修正。

## v1.8.5

- [x] 初始 `__playinfo__` 已存在時仍安裝後續 SPA 指派觀察。
- [x] 新 playinfo 在 `pushState` 與延遲 reset 之間同步指派時，延後到新 generation 重建。
- [x] 未變更的舊值不會在 SPA reset 後回填；頁面替換 configurable data property 時會由既有狀態週期重新掛回。
- [x] 303 項功能回歸通過；不執行安全掃描。
- [x] 安裝 v1.8.5 後以站內推薦連續換兩支影片；自動畫質、2x 與 BiliCDN 面板均重建，連續緩衝分別恢復至 72.64／68.71 秒。Pool 內部值由 303 項功能測試覆蓋，瀏覽器擴充功能隔離世界無法直接讀取 Tampermonkey 主世界快照。

## v1.8.4

- [x] 修正被排除頁面 URL 改寫到 Catalog 後，成功 Fetch／XHR 無法建立 representation 的循環依賴。
- [x] 將腳本產生且完成的 Catalog URL 與原始 Native 解鎖分開保存；不授予 Native 評級或 probe 權限。
- [x] Watchdog recovery affinity 持續覆蓋 exact Native fallback，讓後續重複 Range 真正改走 Catalog。
- [x] 累計資料診斷正名為含快取重送的觀察媒體位元組，不冒充 wire bytes。
- [x] 298 項功能回歸通過，新增 6 項模組／正式 bundle Fetch／XHR 案例；不執行安全掃描。
- [x] 安裝 v1.8.4 後實測四支影片、自動畫質、2x、seek、非焦點視窗及 Akamai 停滯恢復；另發現 SPA playinfo 失聯，由 v1.8.5 修正。

## v1.8.3

- [x] 共用禁止判定涵蓋 black/dead/soft、設定排除及預設不可用節點。
- [x] 原始／Native／Catalog／固定／備援的每筆新請求重新判定；無替代本地拒絕。
- [x] 移除候選耗盡自動清除處分及成功樣本解除 soft 的旁路。
- [x] 節點清單與報告標示禁止原因、替代／阻止計數；不執行安全掃描。
- [x] 292 項功能回歸、語法、重現建置、双 patch 套用及 SHA 通過。
- [x] 實機驗證禁止 host 替代、三支影片、自動畫質＋2x、seek 與背景分頁；同時發現 Native recovery 與改寫歸因問題，由 v1.8.4 修正。

## v1.8.2

- [x] 統一 Catalog／Native 決策，Catalog 不受本片名單限制。
- [x] 頁面候選 exact 成功解鎖、來源接管與一次起播排程。
- [x] 診斷區分候選、計畫、產生來源與實際觀察。
- [x] 338 項 VM／靜態回歸、17 項獨立安全子集、可重現建置及雙 patch 通過；安全掃描狀態見本版 TEST_REPORT。
- [x] 解決 Fetch 非 GET、XHR native reopen、可變 native invoker 與 Request method TOCTOU；最後修補差異掃描無新增 finding。
- [ ] 自動畫質至少四分鐘 Chrome／Tampermonkey、2x／4K／seek／SPA／背景切回交叉驗收。
- [ ] SECURITY.md 精確政策差異確認後，將舊 page-compat 禁令更新為受限候選規則；新資料流仍在本版安全掃描範圍。

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
- 不建構 CI/CD，不新增圖表。
- Native Ledger 的跨分頁寫入仍為時間戳合併而非原子交易；不新增跨分頁協定。
