<a name="測試工具驗證紀錄--2026-10-07"></a>

# 測試工具驗證紀錄

各節依日期保存當時的測試工具與契約模型證據，不把舊版本數量當成現行執行結果。最新救援修復與來源／安裝證據重播見下方 2026-10-17 紀錄；2026-10-16 獨立調查的原始失敗及限制保留。先前剪貼簿通道見 [P05 原生優先](#2026-10-12-p05-原生優先)，事件模型見 [BR-10 控制中心](#2026-10-11-br-10-控制中心事件契約)。現行命令見 [DEVELOPMENT](DEVELOPMENT.md#test-suites-and-isolation)，最新版完整驗證及 IAB 安裝結果見 [TEST_REPORT](TEST_REPORT.md)。

## 2026-10-17 BR-01 修復契約與來源重播

正式基準 930／930，三階段 verify 1038／1060／1134 全部退出 0；新增產品單元 110、整合 58、純驗收工具 36，具名 1／2 倍分開登記。FakeClock／deferred／testScope 保留每案資源清理，不以最後強制清空掩蓋洩漏。工具版本與正式 registry 入口不變，新案例由既有 application／adapters 套件明確匯入。

位置四個失敗、初始化四個失敗、期限 12 fail／2 pass、死核心 4 秒、還原跳躍／play 拒絕、子元素 blur 及暫停未知位置紅色紀錄都先於對應修復保存。最終正式逐案 JSON 含來源 SHA-256、狀態、退出碼，位於 .work/br01-fix/2026-10-17-v2.1.27-ccf947a/。舊 r1／r2 判定器及瀏覽器資料不改寫、不要求其歷史 FAIL 轉綠。

IAB 自有來源最終八案與 node:test 重播 8／8，嚴格型別後執行；來源初驗的 blur 真實 FAIL 保留，Node DOM 情境補子元素事件傳播契約。每次呼叫完整 await，CDP 檢查實際 value／exceptionDetails／Error；無正式 GM、攔截或學習。最終零分頁、服務停止；細節見 [修復紀錄](BR01_RESCUE_FIX_v2.1.27.md)。本項不是安裝版故障救援證據。

發布後安裝來源與正常播放證據另建installed-replay，私有嚴格型別後來源8／8、安裝6／6、退出0，不併入正式1134。後者含「入口／返回限制不可算通過」的證據契約，不說成6個功能皆通過。首次UI讀取錯用不存在的deps.player、CDP例外該筆作廢；改由Runtime.player讀取且嚴格檢查後，單一有界原生鍵盤序列核對設定／修訂未變。公開下載、完整本體、逐秒樣本、有限UI與清理JSON分開保存；批准審查等待不描述為執行超時。

## 2026-10-16 BR-01 獨立單元契約與證據判定

### 第二輪：批准更正與完整自然窗口

第二輪 ccf947a／v2.1.26 的私有單一入口完成嚴格型別與 13 套件 **369 案（362 pass／7 fail，退出 1）**：產品單元 195、整合 26 pass／4 fail、工具／判定器 127、真實重播 14 pass／3 fail。新增計時／CDP 11、學習隔離 7、自動截止 3、第二輪判定器 36；沒有修改正式登記或產品。

來源六案 4 pass／2 fail；自然 1／2 倍各完整 20 分鐘，沒有重現自然起因。受控 1 倍重跑僅傳輸／清理通過，2 倍首窗超過本案例 60 秒、重跑截斷且實際 video 持有為 0，均不算完整通過。首次 1 倍隔離未確認，保留證據缺口，不清使用者資料。詳見 [第二輪報告](BR01_RCA_R2_2026-10-16.md)。

工具修正涵蓋：建立游標即讀取、單一狀態物件避免舊閉包、每次呼叫完整 await、嚴格拒絕 CDP Error／exceptionDetails、以建立時工作 ID 抑制受控寫入、自有觀察截止與真實終點。倒退時間／尾段缺失四個判定器案例先紅後綠；屬私有工具，不列產品缺陷。

本輪 IAB 校準至零分頁的含等待上界為 87 分 18.154 秒；純執行／純批准等待未完整分離，不填 0。第一輪 18 小時執行超時判斷已撤回。自有分頁、攔截、工具資源已清理，服務 31998 已停止；已識別受控 ID 匹配為 0 與首窗隔離未證明分列。

### 第一輪原始結果與更正

基準 ccf947a／v2.1.26；未變更工具版本、依賴、產品或正式登記。正式 `npm run verify` 930／930、退出 0。私有 `.work/br01-rca/2026-10-16-v2.1.26-ccf947a/run.mts` 先嚴格型別檢查，再呼叫 `executeSuites()` 執行八個私有套件，沿用每案／清理 5 秒、套件 60 秒、輸出 32 MiB 上限。

- 產品單元 195 pass；整合 26 pass／4 fail；判定器 70 pass；真實資料重播 2 pass／1 fail。合計 298 案、293 pass／5 fail，無 skip／todo／cancelled，入口真實退出 1。
- I-P01／I-P04 × 1／2 倍期待可信目標 2811.002824、實際保存 0；來源重播保留相同失敗。所有失敗屬同一位置保存缺陷，不是工具成功或五個根因。其他兩個重播通過表示無效證據未被判為產品成功。
- 逐案結果、原始斷言／堆疊、來源 SHA-256、套件退出碼與固定名稱 ID 保存在私有 results；清理先釋放所屬資源再檢查 FakeClock／監聽器／訂閱，不靠強制清空掩蓋洩漏。
- IAB 兩個 Auto 2 倍網路窗口分別因事件截斷、跨呼叫 `node_repl exec context not found` 無效；沒有開始網站 video-only 持有。自有來源一個保存位置 FAIL，GM API 不存在。
- 更正：單次來源呼叫回報的 65127.7786 秒為送出至返回總間隔；使用者確認其中包含睡眠期間等待批准。撤回工具執行異常及超過 120 分鐘的判定，實際執行／批准等待分段未量測。原未執行項目與清理證據保留；依新授權另建 r2 重查，不覆寫原始證據。

完整範圍、正常對照、工具限制及下一輪修復門檻見 [BR-01 調查報告](BR01_RCA_2026-10-16.md)。本輪未實作產品修復、未安全掃描或發布；歷史證據不回寫。

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

## 2026-10-16：v2.1.26 發布後正常安裝結案

正式發布提交 bf536c5，唯一附件與公開 latest 皆為 v2.1.26、372,448 bytes、SHA-256 107d345c557e18769e0d2e8876e3d046107c051e795228c69f72c97bcfbdaea0；發布時遠端 main／peeled tag 一致。公開更新入口本次實際停在管理器中繼頁、舊完整本體仍為 v2.1.25，工具不能完成確認，沒有先宣稱新版通過。使用者確認更新後，原工具分頁已失效，另在同一 IAB 新文件核對 Tampermonkey 5.5.1／v2.1.26，完整 IIFE 370,490 bytes／43597d8e9302a044e5b32a70e8db84811f7e8cf48a7a991e2e055cbfadae01df，與封裝相同；Runtime／ControlCenter 各 1、Fetch／XHR hooks installed。

Auto 1／2 倍各一個有效窗口通過（28.8784 秒：時間 +28.882920、影格 +1,731；35.7705 秒：時間 +71.543344、影格 +4,288），包含可信暫停／恢復及短 seek，結束 readyState 4／seeking false、重載 0。概覽／Enter 設定與返回／空白鍵診斷通過，userRevision 14／seekRevision 6 在鍵盤前後不變；32,665 字元報告 readonly／版本正確／無原始 URL，沒有設定指令或剪貼簿寫入。

控制中心、Debugger／斷點／object group 及自有分頁清理，自有請求／攔截／包裝／timer／訂閱為 0，原本 2 倍與 Auto 保留。只驗本輪有限正常範圍，BR-01／歷史矩陣不恢復。本次後續只更新 main 文件，不改來源／測試／設定／已發布 Release／標籤／安全封存，不為文件變更重跑產品測試。

發布後文件驗證：16 份文件、33 個 GFM 表格、369 個本機／儲存庫連結，格式／表格／連結錯誤 0；固定 a716369 的 v2.1.25 完整正文仍在歷史，Release／來源／測試未變，git diff --check 通過。

## 2026-10-17 文件檢查正式化

基準 9c796a8／v2.1.27。新增 21 個文件工具契約，tooling 55／55；涵蓋中文與重複標題、編碼路徑、圖片／參照、斷鏈、表格、分類、權威、版本、正文保護、只追加、相容錨點、命令、兩次點擊、唯讀／外部不連網及 CLI／JSON／退出碼。缺少參照定義的正常失敗對照先揭露解析器將未定義參照視為文字，補上文字節點檢查後轉綠。

完整 verify 19 套件／1155 案通過，另含 docs:check、型別、架構、格式、確定建置及暫存封裝；日誌見 .work/documentation/2026-10-17-reorganization/STAGE2-VERIFY.log。1155 是本次維護工作樹的契約數，不回寫 v2.1.27 發布時 1134 案；未新增產品案例或瀏覽器／安全驗收。文件檢查涵蓋 196 份公開 Markdown（包含 108 份 Release 文件），14 處原有不可變斷鏈暫依精確例外保留，後續內容收斂將修復其中七處。

依賴固定為開發用途，不參與產品打包；測試暫存模組透過現有明確套件解析清單使用這些 ESM 套件。工具不依賴 .work 的解析器、服務或瀏覽器，不在檢查時連網；外部連結只計數，不宣稱可達。

## 2026-10-17 文件重整：乾淨副本與最終核對

前三階段分別建立保護基準、正式檢查器與內容收斂。乾淨來源副本在沒有既有 node_modules 與私有 .work 的前提下，以 npm ci --ignore-scripts --no-audit --no-fund 重建鎖定依賴；docs:check 及 tooling 均通過。首次乾淨檢查揭露舊 CODE_REVIEW 報告的 18 筆私有證據引用：本機存在不能代表公開可讀。新增精確來源／行號／URL／原檔雜湊的 privateEvidenceReferences，無論本機有無檔都不讀內容、分列未核對；未登記或雜湊不符仍失敗，不以目錄豁免。原報告未改。

新增三個正常／失敗契約，驗證私有資料有無不影響公開結果、現行文件私有連結即使有檔也失敗，以及來源雜湊不符不能豁免。文件工具累計新增 24 案，tooling 58／58，完整 verify 19 套件／1158 案通過；另含格式、型別、99 模組架構、離線文件、確定建置及暫存封裝。1158 只描述維護工作樹，不改寫發布時 1134 的報告。

最終公開範圍 198 份 Markdown，386 個原文保護項通過；七處可相容修復的舊入口已修復，七處不可變 Release 斷鏈保留，18 筆歷史私有引用及外部連結未連線分列。從 INDEX 最多兩次點擊可達所有現行權威與歷史紀錄；自動檢查不能代替人工語意／授權範圍核對。

415 個基準來源／產物檔案雜湊均未變；腳本 382934 bytes，SHA-256 1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795，與已發布本體逐位元組相同。版本保持 v2.1.27，沒有產品案例、安全掃描、瀏覽器驗收或發布。私有 CLEAN-INSTALL、CLEAN-DOCS、CLEAN-TOOLING、FINAL-VERIFY、FINAL-FACTS 及交付核對存於 .work/documentation/2026-10-17-reorganization/。

## 2026-10-20 工作區歸檔與獨立重跑

固定基準 0f4cb8d／v2.1.27。正式新增唯讀離線 archive:check，支援 --local、--json 與 0／1／2 退出碼，並納入 verify。公開檢查不載入私有資料；本機模式只核對清單、檔案雜湊、Git 忽略狀態及原位置殘留，不輸出私有 payload。文件結果 schemaVersion 2 分列有效連結、精確歷史搬移網址限制、既有快照斷鏈、私有證據未核對及外部未連線，沒有目錄級豁免。

新增 90 個具名工具契約：封存 56 案、文件檢查 34 案。封存涵蓋原件／快照缺失與篡改、URL-only 重建及文字／日期／結果／程式碼拒絕對照、完整日誌尾段、路徑越界／碰撞／重複、公開私有分類、校驗列、Windows 路徑及唯讀性。文件涵蓋歷史限制精確匹配、追加日誌原前綴及新尾段邊界、移除相容頁的正式替代位置、搬移原件相對 URL 的原始解析位置及失敗對照。tooling 共 148／148，完整 verify 19 套件／1248 案通過；沒有 only、skip、todo 或 cancelled。1248 是維護工作樹數量，發布時 1134 案及原判定不改。

主工作區通過格式、嚴格型別、99 模組架構、公開文件／封存、完整測試、確定性建置、JavaScript 語法及暫存封裝。初次乾淨來源重跑揭露 Git TAR 測試借用宿主 HEAD；改為每案自建 Git 情境後，在提交 5570636 的 614 檔公開來源副本重新執行 npm ci --ignore-scripts --no-audit --no-fund（102 套件）及完整 verify，1248／1248 通過。副本開始時沒有 .git、.work、node_modules 或私有封存，不借用舊工具。初次失敗與修正後日誌均保留，不覆寫為通過。

公開核對：364 搬移項目（307 過往 Release、56 報告、1 圖片）、110 個未變動來源／現行產物、3 份完整日誌基準，及 54 份 Release 校驗清單／258 列皆通過。56 份閱讀版以原始 TAR、URL 範圍及重建結果驗證；其他內容不變。兩份舊 Release 報告原本含 CRLF，依原始校驗保存 raw bytes，僅對這兩個精確路徑允許 CR 行尾的 diff 檢查，不改正文或略過其他空白規則。

最終文件檢查 197 份 Markdown、1386 個有效本機／儲存庫連結、387 個保護項目通過；429 個搬移原網址、7 個既有快照斷鏈、18 筆私有引用及 275 個外部未連線網址分列。現行 HTML 錨點由 98 個收斂至 6 個必要歷史入口。

本機原先 8 項讀取阻塞已由使用者的 PowerShell 成功補讀 90 檔；原清單與阻塞證據先備份再更新。最終私有清單 10,351 檔、770,239,780 bytes、0 unverified。Codex 工具程序仍對這 90 檔拒絕讀取，這兩次工具結果保留失敗；使用者在可讀取的同一 PowerShell 執行正式 archive:check --local，結果 success=true、localFiles=10351、findings=[]、退出碼 0。公開與本機合計 60 份 Release 校驗清單／287 列通過；不以工具受限的結果冒稱獨立通過。

本輪操作、搬移清單、原件備份、首次失敗、FINAL-VERIFY、CLEAN-INSTALL-FINAL、CLEAN-VERIFY-FINAL、FORMAL-LOCAL-20261020T145130301Z.json 及 PowerShell 腳本，全部保存在 Git 忽略的 archive/retired/local/2026-10-20-cleanup/operations/；沒有公開私有 payload。最後腳本 382934 bytes、SHA-256 1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795，與已發布 v2.1.27 逐位元組一致。本輪不改產品、依賴、版本、標籤或發布附件，不執行安全掃描、BR-01 或瀏覽器驗收。

補充證據界線：原先受限的 8 個物件在同磁碟目錄搬移前後保持相同物件身分與中繼資料；其中後續可讀的 90 個檔案才首次取得內容雜湊。這 90 檔沒有搬移前 SHA，不能補稱已做搬移前後逐位元組比較；首次可讀 SHA、原物件證明、使用者成功紀錄及正式本機檢查分別保存。其餘 10,261 檔有搬移前後大小／SHA 對照。

## 2026-10-22 全專案最佳化與設定一致性

基準 67d33d2／v2.1.27。新 project-config 檢查器由 verify 使用，新增 18 個具名 tooling 契約；未實作 guard 時為 17 fail／1 pass，實作後 18 pass。成功與失敗情境皆核對檔案樹及內容完全不變。完整 tooling 初跑因沙箱禁止暫存 Git 情境的 .git/config 寫入而失敗，沒有改寫成產品 FAIL；取得必要工具權限後 166 案通過。完整 verify 19 套件／1266 案通過，包含格式、型別、99 模組架構、文件／公開封存、確定性建置、語法及暫存封裝。

工具核對產品、直接開發依賴宣告、lock 與已安裝套件版本，以及 TypeScript／esbuild 設定；不驗 npm 執行版本，不證明依賴檔案內容完整性，不取代 npm ci 或產品契約。未新增依賴、命令入口、CI/CD、執行期介面或載入。詳見 [當日完整紀錄](../archive/retired/docs/PROJECT_FILE_OPTIMIZATION_2026-10-22.md)。

PROJECT-CONFIG-RED、PROJECT-CONFIG-GREEN、TOOLING、TOOLING-UNRESTRICTED、STAGE3-VERIFY 及基準／盤點資料均在 Git 忽略的 archive/retired/local/2026-10-22-project-optimization/operations/。階段腳本 382934 bytes、SHA-256 1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795，與現行 Release 逐位元組一致；v2.1.27 發布時的 1134 案報告不回寫。乾淨來源與最終交付結果待完成後追加；本輪不執行漏洞掃描或瀏覽器驗收，不升版、不發布。

最終追加：工具提交 7413ea8 的公開 Git TAR 副本從無 node_modules、.work、.git 與私有 payload 的狀態執行 npm ci --ignore-scripts --no-audit --no-fund（102 套件），完整 verify 1266／1266 通過，建置本體與主工作區／正式 Release 三者一致。最終實體核對：618 個追蹤檔，根目錄 14 檔，src-v2 101、tests-v2 75、scripts 22、docs 13；Release 五檔、dist 三檔，現行區域沒有其他非追蹤檔、舊 .work 或 .codex/local。原私有封存的既知權限及首次雜湊界線維持，不冒稱新做本機全量校驗。

純文件結案的 docs:check、archive:check 及 git diff --check 通過。維護內容只按階段提交／推送 main；產品及不可變證據不動，公開、私有受限、外部未連線、漏洞掃描未執行與瀏覽器未執行仍分開記錄。完整範圍對照見當日報告，不再建立另一份維護清單。

## 2026-10-22 原版與 v2 離線比較工具：第一階段

基準 f4ede73／v2.1.27。新增獨立 compare:upstream 入口、完整腳本的子程序／模擬頁面隔離及 28 個中立 tooling 契約；正式登記仍為 19 套件，不載入原版。兩版 1／2 倍的四次健康啟動校準通過；結果只證明離線模型啟動、傳輸及事件邊界，不是瀏覽器可信輸入或實際播放驗收。

首次完整 verify 因沙箱拒絕既有封存測試的暫存 .git/config 寫入，6 案失敗；原紀錄保留，不列產品缺陷。一般使用者環境重跑通過；加強持續播放資格檢查後再次完整 verify：19 套件／1294 案通過，tooling 194 案，包含新增 28 案。格式、型別、99 模組架構、文件／公開封存、確定性建置、語法及暫存封裝通過。GitHub 認證在沙箱外唯讀核對有效，沙箱內的失效訊息不作最終認證結論。

STAGE1-VERIFY、STAGE1-VERIFY-UNRESTRICTED、STAGE1-VERIFY-FINAL 與校準結果保存在 Git 忽略的 archive/retired/local/2026-10-22-upstream-comparison/operations/。完整比較、公開報告及乾淨來源驗證另在第二階段記錄；既有 v2.1.27 發布時的 1134 案與歷史證據不回寫。本輪不改產品、原件、依賴、版本或 Release，不啟動瀏覽器、自然調查或安全掃描。

## 2026-10-23 原版與 v2 離線比較：第二階段與結案

完整比較及乾淨來源重跑各 44 次有效／適用斷言通過，110 項適用斷言、42 項不適用，退出 0。加上 DOM observer 帳冊、實際吞吐 bytes 與逐秒 audio 通行負對照後，中立工具契約共 31 案，tooling 197 案；主工作區與最終乾淨來源完整 verify 均為 19 套件／1297 案通過。案例、比較數值、清理及限制集中 [公開比較報告](../archive/retired/docs/UPSTREAM_RESCUE_COMPARISON_2026-10-23.md)，本日誌只保存工具驗證。

最終副本由 627 個公開輸入建立，沒有既有 node_modules、.git、.work 或私有封存；npm ci --ignore-scripts --no-audit --no-fund 安裝 102 個鎖定套件。執行後 627 個輸入保持原始雜湊，完整比較 JSON 與公開證據逐位元組一致；乾淨建置與已發布本體同為 382934 bytes／1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795。非法 CLI 選項實際退出 2；未加入新的正式套件或把原版載入正式 v2 測試。

FINAL-VERIFY、FINAL-CLEAN-*、首次沙箱失敗及各次前提修正輸出均在原日期私有操作目錄，兩份系統暫存副本已按絕對路徑及專用前綴驗證後刪除。現行 dist 只保留三個正式產物；沒有新增 .work 或 .codex/local。最終指南、HISTORY、TODO 及文件清單另以文件／公開封存與差異檢查核對；既有日誌只追加，不改寫 v2.1.27 發布結果，不升版、不發布、不恢復任何已停止瀏覽器工作。


## 2026-10-23 唯讀緩衝趨勢與影子判定

基準 8e410b7／v2.1.27。沿用 node:test、FakeClock、testScope 及既有四個套件，不增加套件、命令、依賴或瀏覽器工具。新增 143 個單元與 16 個整合案例，正式 19 套件／1456 案通過；tooling 197 案保持。階段 verify 分別為 1337、1403 及 1456 案。具名結果、先紅後綠、去敏逐秒軌跡、救援非干預與限制集中 [本輪報告](../archive/retired/docs/BUFFER_TREND_2026-10-23.md)，已發布 1134 案報告不回寫。

首次完整 verify 的六個既有 tooling 失敗是沙箱拒絕暫存 .git/config 寫入；正常權限重跑通過。未更改契約、期限、輸出上限或清理規則。公開歸檔檢查通過，既有日誌完整前綴與原件保持；本輪沒有本機私有搬移，因此未重跑 --local。

乾淨副本由 637 個公開輸入建立，無既有 node_modules、.git、.work 或私有封存；npm ci --ignore-scripts --no-audit --no-fund 安裝 102 個鎖定套件，完整 verify 1456 案、退出 0。輸入雜湊未變，工作來源建置逐位元組一致，副本已按絕對路徑與專用前綴核對後清除。最後紀錄追加另在主工作區檢查；沒有留下專案內一次性工具或新工作目錄，不推送、不升版、不發布。

## 2026-10-23 v2.1.28 發布驗證

使用者另行指示發布，結束此前本機限定範圍。升版後 typecheck、architecture、完整 verify 1456 案通過；101 執行期模組，tooling 197 案，固定比較工具仍讀取封存的原始 v2.1.27。原 Release 五檔 bytes／SHA 保持，完整舊報告只追加；發布前搬移清單另存 raw 快照。安全差異範圍、結果及安裝限制集中於 [TEST_REPORT](TEST_REPORT.md)，不以 Node 合成結果補算瀏覽器。

本次發布的乾淨來源副本含 644 個公開輸入，無既有 node_modules、.git、.work 或私有封存。npm ci --ignore-scripts --no-audit --no-fund 與完整 verify 均退出 0，正式 1456 案，輸入雜湊零變更；建置與封裝同為 403700 bytes／8b3ec29aa2b26cb0b9708a91aed65e2d6411e09875e2ac87c70436f0eeec418d。絕對路徑及專用前綴核對後移除副本，工作區沒有新增一次性工具。封裝報告為公開發布前快照；發布及實際安裝補記只更新現行 TEST_REPORT，不回寫快照。

發布後 public latest、遠端 main／peeled tag、唯一附件及 API digest 全部與封裝一致。使用者完成管理器更新後，IAB 取得完整新版 IIFE／單一實例／hooks，Auto 1／2 倍各 16 個樣本的十五秒播放、原生暫停／恢復與可信短 seek 通過；診斷 JSON 有界且無 URL。私有實際證據重播 node:test 五項通過、退出 0，獨立於正式 1456 案。初始工具綁定、浮動小窗與 seeking 起點的無效前提另記，不以 undefined 或片段相接判通過；單次 await 的收集器已結束，斷點／遠端參照／自有分頁已清理。控制中心入口、故障注入、背景／gate／剪貼簿及歷史矩陣維持未執行或依使用者跳過。

固定比較原件搬移後實際重跑 44 次版本案例，44／44 有效且通過、退出 0，仍為原版 v1.3.4 與已發布 v2.1.27，沒有把新版本拿來替換比較基準。此路徑回歸與新功能正式測試、安裝觀察分開記錄。

## 2026-10-23 緩衝影子效用評估第一階段

基準 39c21b5／v2.1.28，修改前完整 verify 1456 案通過。先加入缺少判定器模組的真實紅色契約（退出 1），再完成候選段、截尾、十五秒後續、非法證據及 CLI 判定；新增 68 個具名案例，包含 12 個工具單元與 56 個真實元件整合／軌跡對照，完整 verify 1524 案、tooling 265 案通過。型別、格式、架構、文件、公開封存、建置及差異檢查均通過；產品來源、版本與已發布原件沒有變更。

獨立功能入口先做 60 秒健康前置，54 次情境執行有效且通過，暖機後兩秒抖動保留候選，沒有修改產品期待。成本初次工具試跑把全部倍速放在同一 60 秒批次，41 次有效、7 次因批次期限未完成；此為工具配置試跑，不算正式成本通過。正式工具預先按倍速分為兩個各 60 秒套件，每套兩組暖機及十組版本配對；每案例／清理仍各 5 秒，尚待獨立重跑。瀏覽器展示樣片規則已按本次明確授權更新，固定觀察仍未執行，不以本階段合成資料補算。

## 2026-10-23 影子評估工具承接基準

候選修正開工前，獨立保存上一輪六個未提交工具／測試檔案、完整差異及 src-v2／Release 原始雜湊於本機封存；重新完整 verify 1532 案、tooling 273 案通過。新收集器有完整 await 五十秒及讀取例外的 FakeClock 清理契約；不等同 IAB 長呼叫能力通過。兩小時情境持續送入完成旁證並定期換內容，資料與報告仍有界；情境零時點直接沿用六十秒前置快照，不額外製造重複取樣。

上一輪功能 54 次有效／通過，成本獨立重跑 48 次有效／通過（40 次計分、8 次暖機），原始 JSON 與失敗工具試跑均保留。本機成本包含頁面模型及宿主工作，不能解讀為瀏覽器純功能開銷。IAB 已校準舊基準、BV1aN4y1J763、BV1Xr4y1S7aw P2，但 CDP 的 callFunctionOn／evaluate 在指定較長等待後仍約二十秒逾時；六組五十秒評分未執行，一個三十秒前置無效，不將校準或短資料補算通過。參照、斷點及自有分頁已清理。

本段只記錄承接驗證，不改寫 v2.1.28 發布報告。後續候選規則修改另建紅色契約與版本化證據；使用者本次要求本機交付，不推送、不發布，也不重開受阻窗口。

## 2026-10-23 兩秒候選確認原型停止評估

先在未修改產品上跑十二個新固定情境，0／12 通過、退出 1；原型實作後十二案通過。新增 132 個具名領域／所有權／整合／診斷契約，完整原型 1664 案中 1662 通過、2 失敗，獨立評估 66 次全部有效、64 通過／2 失敗，均退出 1。失敗是每三秒微量回補、最終仍於第九秒耗盡的 1／2 倍案例，正確期待保留為停滯前有候選；不改成零候選期待，不 skip 或預期失敗包裝。完整時序、來源雜湊與各正常對照只看 [本輪報告](../archive/retired/docs/BUFFER_CANDIDATE_CONFIRMATION_2026-10-23.md)。

乾淨原型副本 npm ci 退出 0，完整測試同為 1662 通過／2 失敗，輸入零變更。依批准的效用停止條件，完整差異與案例封存，正式來源／測試／工具恢復 d9818e9，108 個產品／Release 檔案原始雜湊一致；原型未提交為產品修正。恢復後主工作區與乾淨來源完整 verify 均為 1532 案通過。乾淨基準含 655 個公開輸入，安裝及驗證退出 0、輸入零變更，建置 403700 bytes／8b3ec29aa2b26cb0b9708a91aed65e2d6411e09875e2ac87c70436f0eeec418d，等同已發布本體。兩個專用副本均已清理，原型差異通過套用預檢。

最後補記及證據雜湊只更新公開紀錄與權威入口，再執行文件、封存及差異檢查；沒有改寫歷史發布數字、安全封存或瀏覽器結果。本輪不開瀏覽器、不推送、不升版、不發布，不自行調寬候選條件或續作產品設計。

額外本機 archive:check --local 退出 1，已校驗 10261 檔；原 2026-10-20 私有 vendor 的 90 檔仍為 EPERM，不算本輪通過，不回寫使用者歷史成功證據。本輪新增兩份原型測試原件與公開差異內容另行精確核對一致，沒有更改權限或重新啟動舊清理任務；公開封存及乾淨來源不依賴那些私有檔案。

## 2026-10-23 緩衝候選 v3：輸入凍結

基準 cfc1592／v2.1.28 的來源及 Release 雜湊、固定期待與 23 組額外輸入先保存至 [本輪證據](../archive/retired/docs/BUFFER_CANDIDATE_V3_2026-10-23.md#基準與凍結輸入)。沙箱完整驗證的 tooling 六案因暫存 Git config 寫入遭拒而失敗；必要權限環境重跑及加入純情境資料後的完整 verify 均退出 0、1532 案通過，無略過或取消。文件／公開封存及差異檢查通過。這一階段未改產品，不代表 v3 實作已通過；後續只作本機提交，不推送、升版、發布或開瀏覽器。

## 2026-10-23 緩衝候選 v3：整合與乾淨來源

本機實作 a268bab 的完整 verify 1773 案通過（相對基準新增 241 案）；產品修改前 58 個新整合契約為 26 通過／32 失敗、退出 1。獨立效用一百次全部有效且通過，原微量回補漏報對照在兩倍速均保留五秒提前量。完整輸入、逐項期待／實際、來源雜湊與限制只維護於 [本輪報告](../archive/retired/docs/BUFFER_CANDIDATE_V3_2026-10-23.md#逐案證據與乾淨來源)。

乾淨副本有 662 個公開輸入，無既有 node_modules、.git、.work；npm ci --ignore-scripts --no-audit --no-fund 與完整 verify 均退出 0，1773 案通過，輸入雜湊零變更。效用命令亦退出 0，輸出與主工作區逐位元組一致。最後結案中繼資料另在主工作區核對，不宣稱乾淨副本含有它自身產生的結果。只作本機提交，已發布 v2.1.28 原件、版本與歷史 FAIL 不變，不推送、升版、發布或開瀏覽器。

## 2026-10-23 v2.1.29 發布前驗證

使用者另行明確批准發布，取代 v3 實作時的本機交付範圍。升版後 typecheck、101 模組 architecture、完整 1773 案及 verify 均退出 0，格式、文件與公開封存檢查通過。舊 v2.1.28 五項原件及四筆 checksum 逐項一致，成本工具只更新封存路徑，仍固定讀取原比較版本。確定性建置 407926 bytes，雜湊與公開交付集中於 [現行驗證報告](TEST_REPORT.md)，不回寫舊版發布結果或 v3 原始效用證據。

正式封裝後 verify 再次退出 0。另以 669 個公開輸入建立無既有依賴、.git 或 .work 的副本，npm ci、verify 1773 案及獨立效用 100 案均退出 0；輸入雜湊零變更。兩份效用 JSON 逐位元組一致，17735471 bytes／bc27f1fb0f60ed0e9bd1dc5db7cade07bda8758b96f6da545a0c2f4faa5be16e；舊 JSON 保持原件，不混算或回寫其結果。主工作區最後補記的這段中繼資料不宣稱已包含於該乾淨副本。

發行提交 f962bd0 已原子推送 main／v2.1.29 標籤，正式 Release 僅一項腳本附件；公開 latest HTTP 200 全文、bytes 及 SHA-256 相符。公開入口中繼頁受阻，使用者更新後另以完整本體、GM_info、實例計數與 hooks 核對安裝身分，Auto 1／2 倍正常播放、暫停／恢復、短 seek 與清理通過。具體取樣與判定集中於 [現行報告](TEST_REPORT.md#發布與安裝限制) 及其交付 JSON；沒有開故障、樣片效用或舊矩陣，發布快照不回寫。

本輪原始命令日誌、兩份效用輸出、乾淨來源輸入帳冊及正常播放畫面保存於被忽略的本機 `archive/retired/local/2026-10-23-release-v2.1.29/`，逐檔清單附 bytes／SHA-256。臨時來源副本與依賴清理，不新增 .work 或額外 dist 產物；公開來源及封存檢查不依賴這些私有日誌，也不重跑歷史 vendor 權限驗收。

## 2026-10-23 v3 評估可信度與診斷成本優化

以 67b45c4／v2.1.29 為基準，未修改來源完整 verify 1773 案通過。先新增工具紅色契約，十三案六通過／七失敗、退出 1；修正 worker 證據一致性與收集器新鮮度／所有者／白名單後，階段驗證 1789 案通過。另補 Recorder 正常副本與容量契約，再優化私有容量檢查，階段驗證 1792 案通過。fixture 誤用 API 與初次成本包裝太晚的校準錯誤均保留，不作產品缺陷或有效成本數據。

最終完整 verify 1795 案（tooling 397 案）通過；二十二個新增正式案例不包括獨立效用及成本執行。原一百次功能結果全部有效通過，逐案原有欄位與不可變證據一致。十二組新保留輸入先凍結，再分倍速二十四次執行，二十二通過／二失敗，命令退出 1；兩個失敗與正常回補的多餘候選如實保留。兩種成本比較各四十八次有效執行；完整逐案結果、來源、容量及效用限制只維護於 [本輪報告](../archive/retired/docs/BUFFER_OBSERVATION_OPTIMIZATION_2026-10-23.md)。

乾淨來源 674 個公開輸入，無既有依賴、.git 或 .work；npm ci 與 verify 1795 案退出 0，原一百次功能退出 0，新保留命令退出 1，逐案結果與主工作區一致，輸入雜湊零差異。最後公開證據及結案文字另在主工作區核對。發布原件與版本設定保持，不改寫發布時的 1773 案結果，不推送、不升版、不發布。

IAB 自有頁五十秒能力校準於約二十秒返回 CDP 逾時，沒有完整時序；呼叫總間隔與未量測的實際執行／批准等待分開，不能宣稱產品超時。校準頁關閉、來源服務停止，六組網站窗口未執行；舊錯誤分頁收到使用者關閉回覆後仍列於工具清單，清理未能獨立確認。未拼接短窗口、未開網站故障、自然調查或歷史矩陣。

## 2026-10-24：周期候選 v4、自主優化及發布準備

基準 60de147／v2.1.29，執行期 ff22213，證據 a8713c6。正式 1834 案、tooling 398 案、原功能 100 次、新周期／保留 72 次及完整腳本成本 48 次均通過；各層不合併計數。紅色契約、首次原型尾段失敗、固定輸入及清理見 [功能報告](../archive/retired/docs/BUFFER_CANDIDATE_V4_2026-10-24.md)。診斷 v4 投影與版本工具補強，救援政策不變。

乾淨來源 687 項先 npm ci，verify 1834 案、100／72 效用命令皆退出 0，輸入雜湊零變更，逐案結果相同。前置缺少 Release 導覽目錄及新 checksum 登記的失敗均保存；修正只涉及本輪未發布封裝登記。Codex Security d3b2242c-b346-4c59-9940-a04843cf492e 對固定執行期差異零可報告發現；來源／安裝瀏覽器未執行，既有五十秒工具阻塞不重跑。沒有新依賴或放寬工具期限。

## 2026-10-24：v2.1.30 公開與安裝核對

最終含五檔封裝的全新來源再次 npm ci／verify 1834 案通過，687 輸入雜湊未變。main／標籤、唯一附件與公開 latest 全文核對一致。使用者完成必要更新後，完整本體、管理器、唯一實例及 Fetch／XHR、Auto 1／2 倍十五秒正常播放與操作通過；逐段資料見 [交付 JSON](../archive/retired/docs/evidence/BUFFER_CANDIDATE_V4_DELIVERY_2026-10-24.json)。原生分頁按鍵完成短 seek；locator.press 逾時及 raw CDP Input 不支援均不作通過證據。除錯暫停只用於身分核對，不計播放期限；自有資源清理完成。這不替代來源隔離、故障救援或原六組未執行長窗口。

## 2026-10-24：VisibilityAdapter 所有權與 v2.1.31 發布準備

基準 f582069，執行期修復 c65c506。新三十五案先在原產品得到十八通過／十七失敗（退出 1），同一批正確斷言在修復後全綠；完整來源及升版 verify 均 1869 案，tooling 398 案，無略過。來源及含封裝的乾淨副本分別有 690／697 項輸入，npm ci／verify 退出 0，輸入雜湊不變。沒有新增工具、依賴或放寬期限。

初次整合對照誤算既有 reset、型別、受限暫存 Git 權限與乾淨副本格式失敗均保留後重跑。搬移後未暫存 Git 清單及新版 checksum 尚未登記時的文件／封存失敗，已完成本輪路徑登記後通過。真實 IAB 來源二十個描述子案例通過；第一次模組取得錯誤為無效，不計入產品結果，工具總間隔不當作純執行時間。安全差異及分層結果見 [完整報告](TEST_REPORT.md) 與 [逐案 JSON](../archive/retired/docs/evidence/VISIBILITY_OWNERSHIP_2026-10-24.json)。安裝版結果另記，不恢復舊矩陣。
