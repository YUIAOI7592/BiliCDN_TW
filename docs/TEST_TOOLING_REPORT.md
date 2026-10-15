<a name="測試工具驗證紀錄--2026-10-07"></a>

# 測試工具驗證紀錄

各節依日期保存當時的測試工具與契約模型證據，不把舊版本數量當成現行執行結果。最新播放意圖與位置調查見本頁 2026-10-14 紀錄；先前剪貼簿通道見 [P05 原生優先](#2026-10-12-p05-原生優先)，事件模型見 [BR-10 控制中心](#2026-10-11-br-10-控制中心事件契約)。現行命令見 [DEVELOPMENT](DEVELOPMENT.md#test-suites-and-isolation)，最新版完整驗證及 IAB 安裝結果見 [TEST_REPORT](TEST_REPORT.md)。

## 2026-10-12 P05 IAB 讀回

基準 v2.1.21／`99b3308`，PowerShell 7.6.5、Node 26.8.1、npm 11.19.0。使用者改用 IAB 真正貼上與 API 讀回，未新增正式工具套件或產品修改。

- 覆寫前完整保存一個項目、一種純文字格式及全部 payload；原內容只留記憶體。64 字元合成來源經真正 Ctrl+C／Ctrl+V 與 API 完全相符，完整快照復原及真正貼上確認通過。
- 直接點入封閉 Shadow DOM 的工具操作受限，改以原生 Tab／Enter。實際「複製報告」事件可信，全文比較 18,150 對 61 字元不符；P05 本次不通過，不能用合成對照替代。
- 自有頁可信操作啟動原生 Clipboard API 只讀，結果與工具通道相符。使用者批准一次受控 GM 純文字格式校準，完成回呼觸發但讀回仍未變；不計安裝版通過，也不推測寫入端根因。
- 原剪貼簿全部項目與文字保留，兩個自有分頁關閉、31995 listener 為零；觀察器、探針狀態、Debugger 及物件群組清理。沒有新 runtime 自動測試、安全掃描或新腳本發布。

全文比較、工具事件缺口及完整續查條件見 [本輪報告](P05_COPY_IAB_RESULT_2026-10-12.md)。私有證據存於 `.work/functional-fixes/p05-copy/2026-10-12-99b3308/`；下方 PowerShell 調查保留當時門檻與結果。

## 2026-10-12 P05 PowerShell 讀回

基準 v2.1.21／`99dd071`，PowerShell 7.6.5、Node 26.8.1、npm 11.19.0。未新增正式工具套件或修改產品，以下是環境證據，不併入 788 個既有正式案例。

- 隔離層內 `Get-Clipboard -Raw` 讀空，但原生 `OpenClipboard` 回報存取被拒；不能把正常命令退出視為有效讀回。
- 隔離層外可讀 Windows 剪貼簿；同一長存程序將文字及七種 HGLOBAL 格式留在記憶體，沒有輸出原內容或寫入檔案。
- 自有 loopback 頁真正 Ctrl+C／Ctrl+V 的 61 字元合成文字逐字相符，IAB API 讀回也相符；PowerShell 每 100 ms、最多 5 秒仍讀原文字，序號不變，證明本輪共同通道未建立。
- 第一個隔離服務的 IAB 連線逾時；確認主機側服務可讀 200 後只重試一次，頁面成功載入，不把最初網路錯誤算成剪貼簿產品缺陷。
- Windows 原文字及格式未變，無需寫回；保存程序退出 0、服務 listener 為零。IAB 原內容未保存，合成文字保留；錯誤頁顯式清理受 URL 政策阻擋，不宣稱全部清理通過。
- 按校準停止條件未重跑真實 P05。沒有新的 typecheck／architecture／npm test／verify／安全掃描，只有本次文件格式、連結、事實及差異檢查。

詳見 [通道調查與重跑條件](P05_COPY_CHANNEL_REPORT_2026-10-12.md)。私有工具、metadata 與截圖存於 `.work/functional-fixes/p05-copy/2026-10-12-99dd071/`，不進正式測試、封裝或發布。

## 2026-10-11 IAB 收集器

基準 `f5f26e3`、產品版本 v2.1.20。第 4 輪的閉包失效證據保留；新增主機端 [IabEventCollector](https://github.com/YUIAOI7592/BiliCDN_TW/blob/34885c7/scripts/iab-event-collector.mjs) 與 [7 個正式契約](../tests-v2/regressions/iab-event-collector.ts)，由既有 tooling 套件匯入。工具以實例保存跨呼叫狀態、先登記整批暫停請求、分頁去重、失效後停止持有，並區分有原生終止證據與未解決的放行錯誤。

- `npm test -- tooling`：**30／30**；fail／skipped／todo／cancelled 均為 0。
- `npm run typecheck`：通過；Windows／Node 26.8.1／npm 11.19.0。
- IAB 自有 loopback：正常 Fetch／XHR、跨呼叫開關、分類例外及原生 abort 通過；無產品或正式 GM 儲存，服務／分頁已清理。
- 執行方法與保存來源逐一比對一致；沒有外部瀏覽器控制或遠端程式載入。
- 網站後續結果另見 [第 5 輪報告](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md)。產品來源、版本及 Release 不變；未重跑產品完整測試／verify 或安全掃描。

證據位於 `.work/iab-testing/2026-10-11-v2.1.20-f5f26e3-r5/`。以下各日期保留當時範圍與結果。

## 2026-10-07 工具遷移

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

## 2026-10-10 — BR-06 正式契約與原生派送校準

原五契約移入 application，未修來源 2 fail／3 pass，再擴充 40 個具名案例、全套 514。真 Adapter／Monitor／Recovery、FakeClock／deferred／testScope 明確清理；既有 suite 匯入，無新 registry／調查输入。Node EventTarget 在監聽器之間清 eventPhase，替身明確建模 Chrome 派送；真正 trusted Chrome keydown 的監聽器間 microtask 看到 phase 1，沒有提前撤銷。首輪校準／錯誤欄位結果保留，正式與來源矩陣分列，不冒充安裝版。typecheck、architecture、全套 test／verify 通過；獨立安全 7 檔與來源隔離 15／15 完成。詳見 BR06_FIX_REPORT。

## 2026-10-10 — BR-07 keydown／keyup 提交階段校準

原五正確契約移入既有 application 鍵盤回歸模組，修改執行期前 **2 fail／3 pass，退出碼 1**，最小修復後 **5／5**。正式測試情境分開設定事件種類與網站提交階段，避免 BR-06 模型將左右鍵都假定在 keydown 尋位；Node eventPhase 與可信事件仍是契約模型，Chrome 原生輸入另行驗證。

擴充為 60 個 BR-07，BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構及升版前 verify **v2.1.14** 與最終 verify **v2.1.15** 通過。派送／重入／清理／來源抑制及 Adapter→Monitor→Recovery 沿用具名 node:test、FakeClock／deferred／testScope，不匯入調查目錄或新增登記。證據存於 `.work/functional-fixes/br07/2026-10-10-9d98d09/`，紅燈不計入通過數、歷史原件不覆寫。

Chrome 修復來源隔離 **40／40 個有效案例通過**：真正可信 keydown／keyup、BODY／播放器焦點及 Auto 1／2 倍模型、八種 keyup、直接／停止傳播尋位、keydown／keyup 各自新 seek、位置 0、排除／方法相容、腳本還原、Event.NONE 延後及合成輸入、15／30／15 精確邊界與失敗後不重試。使用自有 iframe 的合成媒體／FakeClock，沒有修改網站 getter／控制器，不代替實際 Tampermonkey singleton。

`source/chrome-results.json` 共 42 份記錄，40 份有效 pass=true；初始校準觀察及 timer 尚未完成的無效觀察不列通過，後者已由 timer 收束的有效列替代，沒有確認新缺陷。800 ms 持鍵只產生 keydown／keyup 兩事件，**未證明原生 auto-repeat**；IME、nested 派送及媒體／播放器替換仍為正式模型證據，未宣稱完整 Chrome 覆蓋。清理後 browser／synthetic timer pending 均 0、seek／reload wrapper 已還原、自有 root 移除、iframe 殘留 0。

本輪 Codex Security 差異掃描 3e3d133e-7f39-4bf8-a0ba-d22d188a639a 已封存、complete／0 可報告發現／無未處理候選；v2.1.15 最終 verify、封裝及公開更新核對完成。使用者更新後，實際完整 body／singleton 1 已核對，正常鍵盤、新寬限與約 12 秒延遲後進度有證據，與來源隔離分列。續測新增 [BR-08](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 外層拖曳命中缺口，私有七正確契約 **3 fail／4 pass、exit 1** 與發布前 574 正式通過分列，私有完整型別檢查通過；沒有修改來源或正式登記。本輪文件整理未新增執行期測試通過宣稱。最終 107 受控 IDs 學習匹配皆 0、自有資源清理完成；完整 BR-01、真正 hidden／晚到 SDK 等仍未結案，見 [安裝矩陣](CHROME_v2.1.15_ACCEPTANCE.md)。

發布後文件同步實際檢查：13 份現行文件／新 BR-08 報告，278 連結、33 顯式錨點，無失效路徑或錨點；git diff --check 通過。v2.1.14 完整 TEST_REPORT 正文仍逐字保存在歷史，原 BR-07／安裝文件未變；本輪未修改 runtime／tests／config／Release 或安全封存。只記錄文件檢查，不算新的正式測試或安全掃描。

## 2026-10-11 BR-10 控制中心事件契約

補齊事件路徑、capture／bubble、取消旗標、封閉 ShadowRoot 的外層 retarget 與 listener 移除模型。未改執行期時 11 案為 9 pass／2 fail（Enter／Space 干擾契約）；修復後新增邊界共 17／17，原 7 案保留。模型預設啟動僅作契約；真正原生啟動另由 IAB 四組來源對照與指定影片兩組可信按鍵證明，見 [BR-10 修復](BR10_FIX_REPORT.md)。

## 2026-10-12 P05 原生優先

基準 v2.1.21／f534838，新增正式 20 案；未改執行期保存 20 fail／17 pass，修復後 37／37、全套 808／808。可信 Node 事件只是模型，原生通道由 IAB 實證：可信 writeText、API 讀回與真正 Ctrl+V 完整相符，全部原項目／格式／文字復原相符。

來源 UI 只使用記憶體依賴，控制器未啟動；原生複製 3,392 字元全文相符，GM／播放器呼叫與正式持久寫入均為 0。源 UI、監聽器及控制器已清理。證據位於 `.work/functional-fixes/p05-copy-native/2026-10-12-f534838/`；[修復報告](P05_COPY_FIX_REPORT.md) 分列新版安裝。測試沒有匯入私有證據，原內容及貼上內容不寫檔。

v2.1.22 實際安裝的完整本體及唯一實例重新核對；可見指標入口與真正 Tab／Enter 的可信複製，31,204 字元當次報告讀回及真正 Ctrl+V 一致。兩個原生 click 只記 label／trust，不保存事件或 DOM 物件。原項目／格式／文字與貼上復原相符，自己的監聽器、Debugger、object group、兩個自有分頁及服務已清理。前面的更新／隱藏入口無效觀察不計產品成敗；直接 show 呼叫被拒且未執行，沒有程式繞過。

## 2026-10-13 CR 修復正式回歸與原生校準

新增 33 個具名案例，既有套件明確匯入且不讀私有調查目錄。最終全套 841／841；原 CR 12 案的未修 6 fail／6 pass，以及 XHR 原生確認後的未修正式失敗另存。CR-04 獨立子程序只編譯本機 helper，觀察 storage 拒絕與未處理拒絕，清理完成。

真正 IAB XHR 顯示未送出的 abort 保留 OPENED，正式 NativeXhr 替身已校正；不能把先前的一律 UNSENT 當原生契約。修復後七種跨 realm body、轉換內 open／abort、header replay 共 11 組對照相符。S-02 因有界定位達限未确认，不以 Node 模型冒充原生。詳細對照見 [修復報告](CR01_CR05_FIX_REPORT.md)。

## 2026-10-14：播放意圖來源對照

正式 adapters 新增 14 案。Node EventTarget 的 capture listener 清理需使用匹配 options；新 observer 使用捕獲的 document 與 { capture: true } 成對登記／移除，100 個 paused tick 仍只有一個 listener，reset 後為零。IAB 自有 iframe 的真正 click 對照與 FakeClock 進度模型分列，三次清理 timerCount=0。詳見 [BR01_POLICY_REASSESSMENT_2026-10-14.md](BR01_POLICY_REASSESSMENT_2026-10-14.md)。

## 2026-10-14：安裝後收集限制與位置重現

解除故障後繼續以 Fetch 攔截逐筆放行，會將工具讀取間隔變成額外請求延遲；第一個 2 倍窗口的恢復耗時／成敗因此作廢。單次修正改為解除時立即 Fetch.enable 空 patterns，後續 Fetch.requestPaused=0。但該窗最終 Network truncated=true，不能宣稱完整網路時序通過；獨立頁面採樣 dropped=false，只保存播放與位置的局部證據。

安裝觀察引出的尋位位置缺陷，在私有隔離案例使用真正 PlayerAdapter／RecoveryController 重現：1 fail／2 pass，獨立 tsc 通過。Node 26 的 strip-only 不支援 parameter property，直接執行錯誤另存；有效入口先用專案 esbuild 編譯再 node:test，不把啟動失敗當功能重現。沒有改正式工具、测试登記或執行期。兩個正常對照分別保護未重設位置與真正 seek 到 0；詳見 [完整報告](BR01_v2.1.24_POSITION_LOSS_2026-10-14.md)。

## 2026-10-14：維護工具 TypeScript 遷移

16 個維護工具改為原生 ESM .mts，由 Node 26.8.1 直接執行；工具專用型別專案使用 NodeNext、erasableSyntaxOnly 與 verbatimModuleSyntax。刪除測試執行器的舊手寫宣告，正式來源、測試與工具分別型別檢查；生成的測試／匯入純度 .mjs 仍保留。

遷移前先補兩個 CLI／結構化報告契約，工具套件 32／32、完整 19 套件 857／857、型別、44 個執行期模組架構及 verify 通過，沒有 fail／skip／todo／cancelled。期限、子程序隔離、退出碼、報告版本與清理維持。使用者腳本保持 345,540 bytes，SHA-256 9a58836ab79b56ca8b4a4741a3236011df19aade872baea19d8e56066cef7e3d，與 v2.1.24 相同。本階段沒有新版發布或瀏覽器驗收。私有驗證輸出 .work/modularization/tools-verify.log。

## 2026-10-14：格式與靜態規則基準

格式整理獨立提交，保留嵌入測試內容。Prettier 3.9.10、唯讀格式檢查、未使用宣告／參數與明確型別匯入納入維護；移除多餘綁定仍保留初始化副作用及順序。原生 Node 工具新增穩定格式與受保護樹不寫入兩個契約；工具 34／34、完整 19 套件 859／859、型別、44 個執行期模組架構及 verify 通過。格式 check 不寫入，生成 JS／Release／封存／證據不改寫。私有輸出 .work/modularization/standards-verify.log；本階段沒有新發布或瀏覽器結果。

## 2026-10-14：v2.1.25 契約與模組化整合

新增精確模組路徑權責及契約不得依賴實作的 19 個 AST 情境，先觀察原規則失敗再修正；架構套件 37／37。播放器、選路、診斷／UI 共新增 11 個行為契約，先由未拆分來源通過再實作拆分；完整正式 19 套件 889／889，98 模組、三份型別專案、format:check、verify 與 diff 檢查通過。

IAB 自有記憶體來源的原生傳輸、UI 與播放器分列於 [模組化報告](MODULARIZATION_v2.1.25_REPORT.md)；超過自有期限與缺失合成管理器前提的窗口作廢，修正情境後唯一重跑才記通過。沒有把合成來源或 Node 新舊差分比較當成 Tampermonkey 安裝證據。BR-01 歷史矩陣未恢復。

## 2026-10-15：v2.1.25 發布後正常安裝回歸

公開 latest 入口曾停在 Tampermonkey 中繼頁，工具無法完成管理器確認、影片仍為舊本體，未作新版功能判定。使用者確認更新後，在同一 IAB 新文件取得 Tampermonkey 5.5.1／v2.1.25；完整可執行 IIFE 與封裝同段 SHA-256 相符，RuntimeController／ControlCenter 各 1、Fetch／XHR hooks installed。管理器包裝與 metadata 不納入執行 IIFE 雜湊；公開附件全文另外核對。

Auto 1／2 倍各一個有效正常窗口，可信 pause／resume／Right 短 seek 後持續進度且核心重載 0；控制中心概覽／設定／診斷、可信 Enter／Space 鍵盤邊界通過。32,213 字元唯讀診斷報告無原始 URL，未寫入剪貼簿或持久設定。Debugger 只用於身分取得，立即解除；前次暫停與跨日工具空窗不計播放證據。自有斷點／object group／分頁／服務與資源已清理，原本 2 倍速保留。詳見模組化報告與最新版 TEST_REPORT。

本次發布後只更新文件與私有證據，不修改來源／測試／設定／Release／安全封存，不重跑已通過的自動與來源套件。GFM、連結、歷史全文保存及 git diff --check 另作文件檢查；BR-01 與 P01／P02 不重開。

## 2026-10-16：v2.1.26 第一階段契約收斂

基準 a716369／v2.1.25，基準 verify 889／889、98 模組通過。第一階段僅收斂型別與視圖依賴，合併三個小檔案；typecheck、控制中心 38／38、量測狀態 40／40、漸進 playurl 30／30、整合 verify 889／889 與 95 模組架構通過。完整腳本仍為 368,486 bytes、SHA-256 2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6，與階段前逐位元組相同；沒有將鏡像測試當作新增案例。

維持工具版本、CLI、格式與儲存 schema，未改寫 Release 或歷史證據。執行器不接受多個 suite 參數，該次使用錯誤立即退出，改為三次明確單套件命令後通過；失敗入口不計產品測試。來源／安全／新版本安裝尚未開始，分列於 [收斂報告](CONVERGENCE_v2.1.26_REPORT.md)。

## 2026-10-16：v2.1.26 第二階段 XHR 轉換

新增 20 個具名 getter／快取／模式／例外／重入情境，先由舊 hook 通過 native-transport 167／167。共用助手抽取後同套件仍 167／167，progressive-transport 4／4、playurl-summary 8／8、型別、96 模組架構、格式及完整 verify 909／909 通過；沒有 fail／skip／todo／cancelled。未改 send／open 的派送或 metadata 所有權，不用新 in-flight sentinel 改變既有同步重入語意。詳見收斂報告；本階段尚無新版發布或安裝通過宣稱。

## 2026-10-16：v2.1.26 第三階段選路整理

新增 9 個決策 ID／模式／禁止／同步重入／證據及提交順序契約，先由舊實作通過 progressive-routing 42／42。重構後同套件 42／42、native-routing 13／13、application 286／286、native-transport 167／167，格式、三專案型別、98 模組架構及完整 verify 918／918 通過。傳輸分類助手不取得協調器或授權索引；等待後的政策／控制驗證保持在協調器。內建瀏覽器自有 Fetch／XHR 精確送出前攔截校準各一次通過，尚不算來源或安裝版產品驗收。

## 2026-10-16：v2.1.26 第四階段播放器整理

新增 9 個播放器／Monitor／Recovery 行為契約，先由未修改實作通過；補足影格 getter 同步 reset 的讀序後，再以 esbuild onLoad 在記憶體載入固定 fdb59ae 三個舊模組通過 9／9，沒有反覆覆寫 tracked runtime。另新增 3 個純領域比較契約。重構後 application 295／295、domain 10／10、adapters 116／116、adapter-boundaries 19／19；格式、三專案型別、99 模組架構、完整 verify 930／930 與 diff 檢查通過。所有原期限、操作修訂、單一控制觀察者及各自進度政策保留。

第一版新增測試曾因 assert.deepEqual 對空陣列的 TypeScript 窄化而型別失敗，改比較陣列副本後通過；不計產品失敗或新增功能。IAB 傳輸／選路來源已取得 23／23 通過、清理與正式 GM 零寫入，最終來源重建雜湊及播放器／UI 另行記錄。BR-01 正式回歸照常執行，私有位置調查及歷史矩陣不恢復。

## 2026-10-16：v2.1.26 安全與來源整合

固定 a716369..8242e8f 的新 Codex Security scan 701c41d6-b599-407e-91bd-5df887f01f2d 已完成，28／28 正式項目及 5 份文件交叉審查、0 候選／0 發現。前置 3／3、獨立架構、38 個引用檔範圍檢查及 canonical 封存完成。首份語意草稿因附帶 workbench 自管的 coverage mode／路徑／inventory 欄位而在寫入前拒絕，僅移除這些欄位後接受；沒有替換掃描、略過案例或殘留 deferred。可選架構 JSON 副本曾在呼叫 MCP 前因模板插值失敗，沒有寫入；主代理已將收到的完整架構事實核對並保存至正式 canonical model，不用失敗副本冒充證據。

同一 IAB 合成來源傳輸／選路 23／23、播放器可信 SDK／Right 與包裝還原、控制中心 Enter／空白鍵及 3,383 字元唯讀報告通過。合成儲存只在記憶體，正式 GM／剪貼簿寫入 0；自有請求、攔截、timer、訂閱皆 0，自有分頁及 loopback 服務已清理。最終傳輸來源重建雜湊一致；其他來源 SHA-256 與各層界線見 [完整 TEST_REPORT](TEST_REPORT.md)。本段不構成新版 Tampermonkey 安裝通過。

統一升版 v2.1.26 後，另行執行 format:check、typecheck、architecture、npm test 930／930 及 verify，全數通過；沒有依賴或工具版本更動。文件及上一版完整正文保存另由 GFM／路徑／錨點與 diff 檢查驗證，正式封裝及公開校驗接續記錄。
