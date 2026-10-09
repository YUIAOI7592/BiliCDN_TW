# 測試工具驗證紀錄 — 2026-10-07

本紀錄適用於 v2.1.8 工作樹的開發工具與測試遷移。產品來源、版本號及已發布 Release 保持原狀；2026-10-04 的發行、安全及瀏覽器證據見 [TEST_REPORT](TEST_REPORT.md)，不以本次工具檢查取代。命令與資源責任見 [開發流程](DEVELOPMENT.md#test-suites-and-isolation)，原行為對照見 [MIGRATION](../tests-v2/MIGRATION.md)。

## 基準與遷移

- 修改前保存工作樹狀態、原套件／支援工具及檔案校驗值，保留既有文件整理成果。
- 以保存的原測試及原支援工具，在目前未變的正式來源上重新打包執行：15 套件共 **891 項功能斷言通過**。原架構規則的 **18 項期待**全部保留為具名案例。
- 逐項核對原斷言呼叫、字串／JSON／物件身分比較及參數輸入；只將應用層三秒牆鐘期待換成 FakeClock 的 **2,999 ms 未完成、3,000 ms 完成**，其他原斷言訊息及比較保留。
- 共用完成訊號取代 `setTimeout(0)` 猜測等待；少量 BrowserScheduler 契約使用真實事件迴圈，以回呼函式的完成訊號判定。
- 正式來源採 DOM、`types: []`；測試加入 Node 型別與使用者腳本宣告。`@types/node` **26.6.4**、`undici-types` **8.9.0** 僅供開發型別檢查。

## 工具契約

23 個工具案例涵蓋登記與別名、列舉／名稱篩選、命中案例不得明確略過（`skipped`）、非法參數／零命中、來源堆疊資訊、失敗後繼續收集、打包與啟動失敗、未完成 Promise、阻塞程序、週期計時器洩漏、stdout／stderr、輸出超限、缺失／損壞／矛盾摘要、空套件／僅執行標記（`only`）、清理掛鉤拋錯／逾時、清理逆序／重複釋放／錯誤彙總、完整屬性描述子還原、FakeClock 排序／取消／期限／10,000 回呼函式上限、deferred 拒絕、BrowserScheduler 及未載入框架的匯入陷阱。

故障測試情境使用暫存來源及較短的專用期限／輸出上限；不遞迴執行完整 `npm test`。一般套件使用 5 秒案例／清理期限、60 秒硬期限及 32 MiB stdout／stderr 合計上限。正常執行不強制退出。結構化摘要依 Node 事件驗證，資料隨暫存目錄清理；完整執行沒有略過（`skipped`）、待實作（`todo`）、僅執行標記（`only`）或取消（`cancelled`）。

## 實際驗證

執行環境為 Windows／Node **26.8.1**，版本維持 **v2.1.8**。

| 檢查 | 2026-10-07 結果 |
| --- | --- |
| `npm run typecheck` | 正式來源與測試兩份設定通過 |
| `npm run architecture` | 42 個執行期模組的 AST 邊界／循環檢查通過 |
| `npm test` | **215 個案例通過**：173 個契約、18 個架構、1 個匯入純度、23 個工具案例；略過（`skipped`）／待實作（`todo`）／取消（`cancelled`）均為 0，僅執行標記（`only`）登記由 AST 關卡拒絕 |
| `npm test -- suites/adapters` | 19 個案例通過；`adapters` 與別名的選取一致性另由工具契約確認 |
| `npm test -- application --name "startup"` | 3 個命中案例通過 |
| `npm test -- --list` | 列出 18 個套件及來源，不打包／執行 |
| 未知套件／參數、非法正規表示式、名稱零命中 | 用法錯誤；原生執行器／npm 退出碼為 2（PowerShell 呼叫須保留 `$LASTEXITCODE`） |
| `npm run verify` | 型別、架構、全套案例、兩次確定性建置、語法、既有打包產物標記、暫存封裝及校驗值全部通過，退出碼 0 |
| 文件與差異 | 29 份公開 Markdown 的檔案／目錄／錨點／別名有效；`git diff --check` 通過；舊報告及較早變更紀錄保留 |
| 受保護資料 | 983 份非本次修改範圍檔案校驗通過，涵蓋正式來源、Release、授權基準及既有私有證據；既有文件整理成果保留 |

使用者腳本為 **285,037 bytes**，SHA-256 為 `c2bda1e0be4b086e7622e34d3fba0a6cdfdd5eb612afea700289758112c9eb4f`，與現行 `Release/v2.1.8/BiliCDN_TW.user.js` 一致。新開發依賴／型別設定會改變建置資訊清單的輸入雜湊，正式 Release 快照保持原貌。

同機單次量測：保存的原 15 契約套件重跑為 **4.48 秒**；新版相同 15 套件為 **2.79 秒**。新版完整範圍另包含架構、匯入純度與故障測試情境，最終 `npm test` 執行器量測為 **6.85 秒**（整個命令約 **7.64 秒**）；verify 中測試階段為 **6.89 秒**，整個 verify 命令約 **8.36 秒**。範圍不同的整套耗時不作同等速度比較；這些是單次本機觀察，不作加速保證。

首次沙盒執行遇到已知 esbuild 上層目錄 `Access is denied` 限制；經自動權限審核允許，以同一測試命令重跑後通過。最後測試／verify 同樣在獲准環境執行。清理完成，沒有寫入正式 Release。

## 證據限制

此次僅執行自動、工具與暫存封裝驗證。沒有安排新發布、真實 Chrome／Tampermonkey 驗收或正式安全掃描。v2.1.8 的安全 `partial coverage`、合法 MP4 試片、完整公開 MP4 及現場 FLV 限制沿用原報告狀態。既有文件整理、歷史觀察及封存的已撤銷 CDN 計畫保留。

## 2026-10-09 功能與競態回歸工具驗證

本段適用於基準 `71f7ddd` 上尚未發布的 17 項修復；不改寫上方 2026-10-07 的工具遷移結果。完整對照見 [修復報告](FUNCTIONAL_FIX_REPORT.md)。

- 正式登記新增 `control-center`，共 19 個套件：16 個功能套件、架構、匯入純度及工具契約。工具的登記數量期待同步更新，命令與退出碼語意維持。
- XHR 替身補足 native send 狀態、等待與原生已送出 abort 的差別、同步 responseType／timeout setter 限制；新增具 request ownership 的回歸替身，覆蓋事件處理器內 reopen、readyState 與 response getter。Node 的 ProgressEvent 替身經 `testScope.defineGlobal()` 還原。
- 共用 runtime fixture 每個案例重建儲存、時鐘及控制器；ID 來源由建立函式注入。新增案例使用 FakeClock、deferred 或明確鎖佇列；不使用真實 CDN 或隨機等待。
- Windows／Node 26.8.1／npm 11.19.0：`npm run typecheck`、`npm run architecture`、`npm test` 及 `npm run verify` 全部通過。共 **299 個具名案例**；43 個執行期模組架構、42 個非入口模組匯入純度通過。完整執行沒有 only、skipped、todo 或 cancelled。
- verify 的確定性建置、語法、v2-only 及暫存封裝 checksum 通過；沒有執行預設 Release 封裝。正式來源功能已改變，不能沿用 2026-10-07 的產物雜湊。

逐批失敗、修復後測試及最終驗證 log 存於本機 `.work/functional-review/functional-fixes-*.log` 與 `.work/functional-fixes/2026-10-09/`。初次遷移的工具登記失敗與真正行為失敗分開解讀，均未當成通過。安全差異審查另有已封存的新掃描；原 v2.1.8 安全報告不回寫。本次 Chrome／Tampermonkey 新差異尚未驗收，替身不能證明原生瀏覽器行為。

## 2026-10-09 BR-02 例外與原生替身校準

適用於 `b177f76` 上的 [BR-02 本機修復](BR02_FIX_REPORT.md)，未發布；上方各日期紀錄保留。

- 沿用已登記的 native-transport，新增 40 個 BR-02 具名契約，未改測試登記。該套件共 89 個案例，全套仍為 19 個套件。
- NativeXhr 驗證順序及成功 open 的事件條件以 Chrome 對照校準。method／URL 失敗不先變更狀態；Chrome 的非法 Window 同步選項會清成 UNSENT、沒有終止事件，替身明確模擬此例外。XHR 實例、gate 及全域替換由 testScope 清理。
- 先保存 77 個案例中 17 個失敗的契約紀錄，再修改來源。Chrome 新發現的 gate／UNSENT 交錯也先保存 30／31 結果及兩個正式失敗案例，再補修復。
- `npm run typecheck`、`npm run architecture`、`npm test`、`npm run verify` 通過；最後 verify 包含 **339 個案例**，沒有 only、skipped、todo 或 cancelled。工具與依賴版本未改變。
- 新安全差異審查獨立封存，兩個變更來源／測試檔完整覆蓋，沒有可報告的新安全發現。真實 Chrome **來源隔離**矩陣 31／31 通過；Tampermonkey **安裝版**未更新，仍待驗收。

新證據存於 `.work/functional-fixes/br02/2026-10-09-b177f76/`，包含紅燈／綠燈 log、Chrome JSON／截圖與重跑入口。沒有覆寫原調查失敗紀錄或 Release 快照。

## 2026-10-10 BR-03 內容識別契約與交錯

適用於 `c836a17` 上的 [BR-03 本機修復](BR03_FIX_REPORT.md)，未發布；既有日期紀錄保留。

- 新增 43 個具名案例：orchestration 21、domain 5、native-transport 14、progressive-playurl 3；全部沿用已登記套件，全套仍為 19 套件。新回歸檔由既有 suite 明確匯入，`.work/` 不是測試輸入。
- 原四契約先得到 2 通過／2 失敗，再保存擴充 orchestration 13 個、native-transport 14 個失敗；最後正式套件全綠。紅燈不計入通過數。
- runtime fixture 可選擇真正 MeasurementController 與注入 probe，讓 FakeClock／deferred 證明同片排列保留有效工作、不同 cid 撤銷晚到量測／恢復。XHR 替身沿用 BR-02 原生邊界，新增 request context spy，沒有放寬 failed open 契約。
- `npm run typecheck`、`npm run architecture`、`npm test`、`npm run verify` 全部通過；382 個具名案例，44 個執行期模組、43 個非入口匯入純度，沒有 only、skipped、todo 或 cancelled。
- 獨立 Codex Security 差異審查完成，14 個來源／測試檔完整覆蓋且無可報告發現。Chrome 來源隔離 BR-03 31／31 與 BR-02 31／31 通過；安裝版修復產物未載入，仍待驗收。

新證據目錄為 `.work/functional-fixes/br03/2026-10-10-c836a17/`；工具失敗輪、事件捕捉範圍及重跑 guard 整理後尚未再跑全矩陣的限制見修復報告與 `RERUN.md`。原失敗證據及 Release 未覆寫。


## 2026-10-10 — BR-04／BR-05 契約

新增 66 個具名正式案例：native-transport 的 19 個 BR-04＋16 個 Fetch 整合，measurement-state 匯入 31 個 startup-abort。四個既有 XHR 替身用 prototype readyState getter／private state 對齊原生 getter 捕捉。型別完整的共用 startup-abort support 使用 FakeClock／deferred／testScope；沒有 as never 介面逃逸、only／skip／todo／cancelled。v2.1.12 全套 448 個通過，工具版本不變；修復／前後失敗與 Chrome 證據分開保存。
