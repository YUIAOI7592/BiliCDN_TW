# BiliCDN_TW v2.1.12 安裝版 BR-04／BR-05 驗收 — 2026-10-10

**BR-04／BR-05 實際 Tampermonkey 驗收及本輪同片基本回歸通過。** 本紀錄不代表 BR-01 或全產品驗收完成；來源隔離、自動測試、安全審查與發布證據分列於 [修復報告](BR04_BR05_FIX_REPORT.md) 及 [驗證報告](TEST_REPORT.md)。本輪只使用指定[風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，沒有切換影片、變更 Chrome 設定或停用其他腳本。

## 產物身分與測試邊界

v2.1.12 於 04:24:04（Asia/Taipei）發布，來源提交 `cdbb10b3e9ce8f56485dd427dd38d10e848ba005`；04:24:40 公開 latest API 與唯一使用者腳本下載核對通過。附件 298,785 bytes，SHA-256 `c3874efbf718a3eebcc64cf2591d1a328d7ddde1aac40b7d91faf593f7c6e28d`。Chrome 155 中，Tampermonkey 已自動更新；實際 Debugger script 的完整程式 body 與發布附件相同，body SHA-256 為 `e2397e9781f238b62e6b5f3d1f210f990c381b98fc60edda6b396871130951ca`。這不是只讀頁面版本字樣的判定。

以實際安裝版 XHR hook 的閉包取得現有 TransportContext、metadata 與 MeasurementController；沒有建立另一個 controller、替換共用 gate、重設起播預算或用受控 gate 代替 singleton。先安裝精確 Request-stage XHR／Fetch／Other 攔截，再對合成 playurl 回應建立合法影片表示。所有 CDN 測試 URL 都帶合成標記；Range 直接回傳 206、media 回傳 JSON 200，OPTIONS 明確允許測試 header 與 credentials。沒有 continue 合成請求、沒有外送，事件從執行前 cursor 分頁捕捉且沒有 truncated。

iframe 提供未攔截的原生 XHR／Fetch 對照，Blob 為自有合成資源。為避免合成工作影響使用者學習資料，本輪只在實例上抑制合成表示所屬的 request／startup 樣本及起播 cursor 寫入；不改 probe、政策判定、實際 gate 或請求完成邏輯。有效輪前後完整 routeEvidence 序列化結果相同。這個邊界代表真實取消、重入與共用 gate 路徑已驗證，**不宣稱合成持久學習端到端也已驗收**；該部分由正式契約覆蓋。

## 有效安裝版矩陣：35／35

04:35:09 保存斷言結果；完整事件紀錄在本機 `.work/functional-fixes/br04-br05/2026-10-10-f27b3a2/chrome-installed-br0405.json`。

| 群組 | 案例數 | 正確契約與實際結果 |
| --- | ---: | --- |
| 原生 XHR | 2 | SyntaxError 不破壞 OPENED，Blob 完成一次 200；同步限制 InvalidAccessError 可令原生 UNSENT，直接 send 為 InvalidStateError、不產生假的終止事件。 |
| 安裝版 XHR | 5 | SyntaxError 對照與第二次同步限制失效均完成一次 200；持續同步失效只有兩次準備、virtual DONE／空失敗、一次 readystatechange→error→loadend；回呼 abort 只發一次取消終止；成功 reopen 的 Blob 新請求完成，舊請求不污染。五者起始 metadata 均為 waiting。 |
| 原生 Fetch reason | 9 | object、Error、TimeoutError、string、0、false、空字串、null、預設原因；每項 rejection === signal.reason。 |
| 安裝版 Fetch reason | 18 | 上述九類各測預取消與等待中取消；全部保留身分或原值，不被 AbortError 取代。 |
| 未取消共用 Fetch | 1 | 另一個 Fetch 正常完成 200，共用 XHR 同時完成；單一 waiter 取消沒有取消 gate／其他請求。 |

同一個 singleton 的 startupDuring 為 running／3 candidates，startupAfter 為 complete／measured；三個合成 Range 探測均 valid 206，選出一個 Catalog 主機。guard 共處理 1 API、3 probes、2 OPTIONS、3 media；media 恰為兩個正常 XHR 加未取消 Fetch。沒有未處理拒絕、重複 loadend 或虛假 CDN 失敗。持續失效請求的原生 state 為 UNSENT、虛擬 state 為 DONE，符合本地失敗契約。

## 同片基本回歸

合成工作清理後重新載入同一支影片，04:36:29 保存網站證據。透過實際播放／暫停按鈕操作，不調整原有 2.0x 倍速或 4K 選項：

- 播放位置從 372.014813 秒前進至 386.955021 秒，未暫停、無 mediaError。
- 暫停後位置保持 388.679061 秒；再次按播放後恢復 playing。
- 單獨以可聚焦播放控制的 ArrowRight 快捷鍵 seek，seeking→seeked 約 317 ms；此後繼續前進至 466.409113 秒，readyState=4，無 mediaError。

曾嘗試對不可聚焦的播放器容器 press，工具期限到達；改用已觀察且可聚焦的播放控制成功，未把失敗工具動作當成 seek 證據。播放中另有一次短 waiting→playing，約 1.108 秒，正常恢復，不宣稱完全沒有緩衝。此次是短程有緩衝 seek，不能排除 BR-01 的長 seek／網路 timeout／降畫質問題。

## 作廢輪、資料影響與清理

初次安裝版輪的攔截器沒有 OPTIONS Allow-Headers／Allow-Methods，兩個正常 XHR 被 CORS 拒絕。取消 reason 與有界終止雖成立，整輪仍標 **作廢**，保存在 `installed-discarded-preflight.json`，不計入 35／35；修正 CORS 回應後使用重新載入的 singleton 重跑。

同輪樣本抑制錯用 Session 表示身分，漏掉三筆合成 transport 樣本（兩失敗、一成功）與一個測試退避。已以精確 owned request IDs 清理三筆；再於 storage lock 內確認該 row 的精確 updatedAt、circuitUntil、level 仍屬該輪，才移除退避。`installed-discarded-cleanup-verified.json`／`installed-discarded-penalty-cleanup.json` 確認 ownedSamplesRemaining=0、backoffRemoved=true。沒有清空其他樣本或設定。第一次未 await 的清理回傳空物件不能作證，後續重新查驗並等待鎖內結果才確認完成。

EvidenceStore 每主機樣本保留有上限；三筆合成樣本寫入時，最多三筆原有樣本可能已被淘汰，沒有測試前完整備份，**無法重建，不宣稱完整復原先前學習資料**。這是本次測試工具的實際限制，不是 BR-04／05 執行期修復的新缺陷。有效輪改以 Vault 真正 representation 及 XHR requestId 識別自有樣本，並取得前後 payload 完全一致的證據。

有效輪完成後，abort 自有 controllers／XHR、移除事件與路線訂閱、還原自有 evidence／startup／meta 實例掛鉤、撤銷 Blob、移除 iframe，清空 Fetch interception patterns。網站事件監聽器及 Debugger 亦清理，測試影片最後暫停。來源隔離 tab 已關閉，自有本機測試服務收尾停止；沒有修改使用者其他分頁。

## 續行與範圍

兩項修復可結案。BR-01 超長 seeking 救援政策及原始網路起因、真正 background、SDK 自然故障、其餘完整 R04 與生命週期驗收保持獨立，見 [TODO](TODO.md) 及 [v2.1.11 剩餘覆蓋](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md)。BR-02／03 交叉回歸本輪來源隔離各 31／31；沒有把此結果冒稱新版全部 BR-02／03 安裝矩陣重新完成。

重跑先核對公開產物與實際 script body，再安裝上述精確攔截；重新載入同片取得未消耗的 gate，查 `willGateStartup(mediaUrl)`，執行本機 `installed-harness.js`，持續處理 OPTIONS／Range／media，直到完整終止。逐案斷言正確契約及 guard 次數，最後比對自有寫入／payload並清理所有資源。詳細入口與來源隔離流程見本機證據目錄的 `RERUN.md`；不要用截斷窗口、錯誤 CORS 輪或舊版本結果替代。
