# BR-04／BR-05 修復交付 — 2026-10-10

基準為 v2.1.11／`f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e`，目標版本 v2.1.12。保留原先未提交的驗收文件與 [BR-04](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)、[BR-05](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md) 原始失敗紀錄。**本機來源修復及 Chrome 來源隔離完成；發布／安裝版結果以下方最新追加為準。** BR-01 seek 救援政策與其餘完整產品驗收不因此結案。

## 修復對照

| 缺陷 | 原因與行為 | 來源與正式契約 |
| --- | --- | --- |
| BR-04 | gate 等待中的 failed sync open 使原生回到 UNSENT；內部準備的同步回呼可再次破壞狀態，原流程仍標成 sent、native send 拋錯且無終止通知。現在使用保存的原生 readyState getter，準備最多兩次；每次 open／選項／header 後重查 owner、phase、OPENED，重新決定最新合法目標。持續失效以一次 DONE／readystatechange→error→loadend 終止，已送出／取代／中止請求不補發、不重送。 | [xhr-hook](../src-v2/adapters/xhr-hook.ts)；[XHR 回歸](../tests-v2/regressions/functional-races/xhr.ts)，新增 19 個 BR-04。 |
| BR-05 | prepareStartup 三處取消邊界建立新的 AbortError，遺失 caller reason 身分或 falsy 原值。現在使用 signal.reason；只在平台沒有 reason 能力時相容回退。取消只拒絕自己的 waiter，不取消共用 probe，各完成路徑移除 listener。 | [measurement-controller](../src-v2/application/measurement-controller.ts)；[取消回歸](../tests-v2/regressions/functional-races/startup-abort.ts) 31 個，XHR 檔另含 16 個 Fetch 整合案例。 |

額外複核在原生 send 拋錯契約確認 pending media 歸因殘留 1。修復使用既有 abort observation 釋放 pending，保留直接 send 的原例外，deferred caller 仍收到本地 error；不記錄 CDN 失敗樣本、不改親和或 Native 授權。正式斷言要求 pendingMediaCount 為 0、evidence 為空。準備失败在建立歸因前終止。

schema 2、持久鍵、公開 API／設定、更新 URL、Vault 唯一 Native 授權、Fetch 單一讀取器及 Worker 不介入保持原契約。BR-02 failed open／重入與 BR-03 請求 cid 所有權繼續成立。

## 契約先行與自動結果

執行證據位於本機 `.work/functional-fixes/br04-br05/2026-10-10-f27b3a2/`；調查目錄不是正式測試輸入。Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。

| 證據 | 結果 |
| --- | --- |
| 未修改執行期的 `red-final-native-transport.log` | 138 個：115 通過、23 正確契約失敗；不算整體通過。 |
| 未修改執行期的 `red-final-measurement-state.log` | 32 個：4 通過、28 正確契約失敗；不算整體通過。 |
| 補充 `red-send-attribution.log` | 正確契約確認 pendingMediaCount=1，應為 0；原生 send 尚未接受，不應保留待處理歸因。 |
| 修復後 native-transport | 138／138。涵蓋有界重入、四類還原操作×失效／abort／replace、政策變更、native send 例外、正常對照及 BR-02／03。 |
| 修復後 measurement-state | 32／32。九類 reason×三個取消時機、共用工作、完成／取消／reset 清理及沒有 reason 能力對照。 |
| v2.1.12 typecheck／architecture／npm test | 通過；44 個執行期模組無循環、19 套件、448 個具名案例，0 failed／cancelled／skipped／todo。 |

19 個 BR-04 加 47 個 BR-05，共新增 66 個案例；四個既有 XHR 替身改為 prototype 原生 getter，避免 mutable own readyState 遮蔽原生狀態判定。新 support fixture 型別完整，不以 as never 代替介面。

重跑入口：

```powershell
npm test -- native-transport
npm test -- measurement-state
npm test -- application
npm test -- orchestration
npm run typecheck
npm run architecture
npm test
npm run verify
git diff --check
```

完整 verify、封裝、最終安全及遠端發布核對結果追加於 [最新版驗證報告](TEST_REPORT.md)。

## Chrome 來源隔離

真正 Chrome 155，原生 Fetch／XHR／RangeProbe，入口使用目前修復來源、記憶體儲存。**36／36 通過**：2 個原生 XHR、7 個共用 gate 重入／ownership／政策、9 個原生 Fetch reason、18 個修復 Fetch 的預取消／等待取消。75 次 synthetic Range 探測回傳直接 206，39 次 media 請求回傳合成 200；每個共用 gate 的結果均為 measured。取消的 Fetch 保留 caller reason，另一個 Fetch 和 XHR 均完成；持續重入最多兩次，無未處理拒絕。

BR-02 與 BR-03 來源隔離相容性矩陣各 **31／31** 通過，BR-03 合成 API 65 次。精確 Request-stage XHR／Fetch／Other 攔截在執行前安裝，沒有 continue 合成請求，成功輪事件窗口沒有截斷。36 案例結果保存在 `chrome-br0405-source.json`，BR-02／03 分開保存。hooks、listener、timer、XHR、AbortController 及 Blob 已清理；BrowserScheduler 的計時器取消權屬 MeasurementController。

初次 harness 誤呼叫不存在的 scheduler.dispose，以及未像 entry.ts 對 native Fetch 綁定 Window 的輪次，分別保存 `chrome-harness-invalid-cleanup.json`、`chrome-harness-inconclusive-probe.json`，**不計入有效验收**。曾從序號 0 讀取過期事件窗口得到 truncated，該讀取只作工具調查；有效 guard 從執行前 cursor 完整分頁讀取，沒有使用過期窗口計數。

此來源隔離使用真正 MeasurementController 與共用 gate，但不是 Tampermonkey 安裝版 singleton。安裝版須實際取得 v2.1.12 來源／產物身分，另跑矩陣與指定風景影片播放、暫停、seek；畫質與 seek 分開操作，不改 Chrome 設定或停用其他腳本。

## 安全審查與限制

第一輪 Codex Security `8cd95d81-a922-42cc-95e0-8f91b5a6f37b` 已封存，10 個變更來源／測試檔完整覆蓋、0 可報告發現、0 待驗證候選。補充的 native-send 清理經獨立代理複核，最終來源雜湊和差異存於該 scan 的 `artifacts/review-receipt.md`。該掃描原快照早於補充修正，工具明列工作目錄漂移，**不把原 digest 冒稱最後來源**；發布前另對凍結的最終差異完成審查，結果見最新版驗證報告。安全掃描與 verify 分開，不代表全儲存庫無漏洞。

XHR 原生重導仍屬既有瀏覽器限制；取消 reason 不輸出／持久化。BR-01 長 seek 的網路起因與恢復政策、真正 background、SDK 自然拒絕及其餘完整 R04 驗收保持獨立待完成，見 [TODO](TODO.md)。本輪只修 BR-04／05。


## 最終修復驗證追加

最終凍結差異的 Codex Security **9ceb91f0-9690-4372-9e86-8e07ea29c11b** 已封存：12 個變更來源／測試／版本設定檔完整覆蓋、0 可報告發現、0 待驗證候選、沒有快照漂移警告。Snapshot digest 為 codex-security-snapshot/v1:sha256:4ae67faaca413f0591719ff73b61c0d6f30c000a19f0d23fc22cd66ed6a0d213。封存前核對 10 個獨立複核來源／測試的最終 SHA-256，全部一致；另外審查兩份版本設定，只有版本變更。完整報告與 receipt 由 Codex Security 管理保存，與一般 verify 分開。首輪漂移報告保留，未當作最終快照。

v2.1.12 的完整 verify 已通過，正式 448 個案例沒有 failed／cancelled／skipped／todo。正式產物 298,785 bytes，SHA-256 c3874efbf718a3eebcc64cf2591d1a328d7ddde1aac40b7d91faf593f7c6e28d。發布與安裝版結果另按時間追加，不回寫 Release 快照。
