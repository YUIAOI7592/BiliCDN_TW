<a name="development"></a>

# 開發流程

本文件是 **v2.1.14 BR-06 修復**的現行開發流程；發布與實際安裝版狀態見 [驗證報告](TEST_REPORT.md)，不得以來源隔離代替安裝驗收。各版原始證據保留。其他規則見 [文件索引](INDEX.md)、[架構](ARCHITECTURE.md)、[儲存庫指南](../AGENTS.md) 及 [安全政策](../SECURITY.md)。下文以 Catalog 表示內建節點清單，以 Native 表示原生簽名路線。

<a name="repository-layout-and-archive-maintenance"></a>

## 儲存庫配置與封存維護

| 位置 | 用途 |
| --- | --- |
| `src-v2/`、`tests-v2/`、`scripts/` | 現行來源、契約及 npm 建置／測試工具 |
| 儲存庫根目錄 | README、AGENTS、SECURITY、LICENSE 及必要 npm／建置設定 |
| `docs/` | 其他現行指南、工作狀態、變更紀錄、最新版驗證報告及文件索引 |
| `dist/`、`node_modules/` | 產生的建置輸出及已安裝開發依賴 |
| `Release/`、`baseline/` | 保留的發行產物及上游來源歸屬證據；校驗清單位於 `baseline/SHA256SUMS.txt` |
| `archive/retired/docs/` | 歷史報告、整理紀錄、計畫、驗收／研究及對應 `evidence/` |
| `archive/retired/local/` | 本機私有歷史，依 `development`、`review`、`security`、`src`、`scripts`、`work` 分組 |

[封存指南](../archive/retired/README.md) 記錄配置，[文件索引](INDEX.md) 連接現行指南與歷史紀錄。既有 `archive/pre-upstream-*` 歷史獨立保存。根目錄設定、來源／測試輸入及工具位置不變。封裝讀取 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md`，沿用既有版本化輸出名稱。`baseline/` 校驗清單保留儲存庫根目錄相對路徑，須從根目錄校驗。封存 v1 輔助函式及本機工作產物不在現行 npm 命令範圍；其內嵌路徑及命令描述原始環境。

現行指南放在 `docs/`；根目錄文件供專案首頁、自動發現的開發指示、安全政策及授權使用。已完成的歷史文件與證據一起放在 `archive/retired/docs/`，保留日期、版本及觀察限制。私有掃描／審閱／工作產物放在 `archive/retired/local/`；封存不授權公開。搬移前檢查現行匯入、腳本、連結及可執行檔位置。記錄舊／新路徑，更新維護中的連結與索引，保留已封存且不可變更的證據、校驗值及已發布 Release 內容。

`docs/TEST_REPORT.md` 保留最新版完整報告及歷史導覽。換版時將上一版完整正文加入 [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md)，保留版本／日期、觀察、限制及順序，再更新固定入口與原錨點導引。已發布 `Release/v*/` 報告維持當時快照。文件整理的實際檢查另按日期加入 [DOC_MAINTENANCE_HISTORY](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。被封裝的 TEST_REPORT 與 CHANGELOG 指向其他儲存庫文件時使用完整 GitHub URL，使複製到 Release 後仍可查閱。

Markdown 粗體依 [GitHub Flavored Markdown 規格](https://github.github.com/gfm/#emphasis-and-strong-emphasis) 判斷標記兩側的文字、空白與標點。粗體內容以括號、冒號等標點結尾，且後接一般文字時，在閉合 `**` 後加空白，例如 `**時間：** 2026-09-25`、`腳本的 **內建節點清單（Catalog）** 選路`。檢查生成的 HTML 是否包含預期 `<strong>`，並排除程式碼、跳脫字元與萬用字元模式（glob）路徑中的字面標記。排版修正保留標題錨點、連結、數值及歷史觀察；Release 與已封存且不可變更的證據維持原貌。

<a name="prerequisites"></a>

## 環境需求

- Node.js 26.8.1
- npm 11.19.0
- TypeScript 7.0.2、esbuild 0.28.2 及 `@types/node@26.6.4`（鎖定的開發依賴）
- 真實瀏覽器驗證使用 Google Chrome 及 Tampermonkey

準備 Node／npm 後，在儲存庫根目錄執行 `npm ci`，安裝 [package-lock.json](../package-lock.json) 鎖定的開發依賴。[release.json](../release.json) 記錄發行工具版本。`verify` 檢查實際執行的精確 Node 版本，`build` 檢查精確 esbuild 版本。建置資訊清單的 npm／TypeScript 版本取自設定，不獨立驗證執行中的 npm／編譯器版本。[package.json](../package.json) 沒有執行期依賴。

<a name="commands"></a>

## 命令

```powershell
npm run typecheck     # 嚴格 TypeScript 檢查，不輸出檔案
npm run architecture  # 原始碼 AST 依賴圖及列出的所有權語法規則
npm test              # 全部獨立契約套件，以及架構／匯入純度測試
npm test -- adapters  # 單一隔離套件
npm test -- suites/adapters  # 相容的套件別名
npm test -- --list    # 列出登記清單及來源，不打包／執行
npm test -- application --name "startup"  # 正規表示式篩選案例
npm test -- tooling   # 測試工具本身的契約
npm run build         # 確定性的單一 IIFE 使用者腳本
npm run package       # 重建 dist，寫入設定的 Release/v<version>/
npm run verify        # 自動檢查及暫存封裝驗證
```

從儲存庫根目錄執行命令。`typecheck` 與 verify 共用 [typecheck.mjs](../scripts/typecheck.mjs)，依序檢查正式來源與測試。[tsconfig.json](../tsconfig.json) 保留嚴格 DOM 環境並設 `types: []`；[tsconfig.tests.json](../tsconfig.tests.json) 加入 Node 型別、DOM 及使用者腳本全域宣告，載入本機 `.mjs` 工具的型別／宣告。`architecture` 檢查正式模組；獨立的 `npm test -- architecture` 測試架構檢查器自身測試情境。判斷這些檢查能證明哪些不變量前，先閱讀 [架構檢查範圍](ARCHITECTURE.md#dependency-direction)。

[verify.mjs](../scripts/verify.mjs) 檢查設定的 Node 版本、typecheck、來源架構、全部測試、兩次建置的輸出／資訊清單一致性、JavaScript 語法、指定舊版／Worker 標記清單、必要儲存標記及封裝 SHA-256。封裝步驟會再建置一次。命令寫入 `dist/`，於新的 `dist/verify-package-*` 目錄封裝，確認解析後位置及前綴再刪除該目錄；不寫入 `Release/v<version>/`。

verify 不執行 Codex Security 或 Chrome／Tampermonkey 驗收。安全敏感變更或使用者明確要求時，另行執行安全差異掃描；不要求每版掃描。上一版通過報告不能作為新本機變更的證據。

<a name="adding-behavior"></a>

## 新增行為

1. 純粹的資格／排名邏輯放在 `domain/`，明確傳入時鐘。
2. 持久或工作階段資料放在型別化狀態儲存元件。
3. 可改變選路、量測或恢復的動作透過控制器方法提供。
4. 瀏覽器差異留在適配器，GM 儲存透過 `platform/storage.ts`；UI 管理自己的 DOM 及呈現生命週期。
5. 發出型別化事件，不讓診斷讀取控制器內部。
6. 在 `tests-v2/suites/` 對應獨立套件，或不依賴瀏覽器的 `tests-v2/domain-boundaries.ts` 新增具名 `node:test` 契約。新套件登記於 `scripts/test-registry.mjs`。

修改執行期邏輯前，先以失敗的領域層、控制器或適配器契約重現行為。親和主機變更只由 `RouteCoordinator` 執行，主動探測只由 `MeasurementController` 啟動，核心重載只由 `RecoveryController` 執行。等待後及儲存鎖回呼函式內保留生命週期檢查；只使用計時器介面不能避免舊工作提交。診斷消費型別化事件及快照。

<a name="test-suites-and-isolation"></a>

## 測試套件與隔離

[test-registry.mjs](../scripts/test-registry.mjs) 明確登記下列契約套件。支援工具、暫存測試情境及封存資料不透過萬用字元模式（glob）執行：

| 套件選擇器 | 涵蓋範圍 |
| --- | --- |
| `domain-boundaries` | 純政策／輸出邊界 |
| `domain` | 領域行為 |
| `state` | 設定、限制、證據及簽名路線狀態 |
| `application` | 選路、量測及恢復契約 |
| `diagnostics` | 型別化觀察、快照及報告隱私 |
| `adapters` | 瀏覽器適配器行為 |
| `native-routing` | Catalog／Native 選路及來源授權 |
| `native-transport` | Catalog／Native 傳輸及請求處理 |
| `orchestration` | 組合、生命週期及命令協調 |
| `adapter-boundaries` | 導覽所有權及 Range 讀取器契約 |
| `measurement-state` | 量測中繼資料及舊鎖回呼函式 |
| `progressive-playurl` | MP4／FLV 容器、分段身分、原子輸出及 DASH 行為維持 |
| `progressive-routing` | Catalog 來源不透明識別碼、完整候選池、備援上限及設定競態 |
| `progressive-transport` | MP4 Fetch／XHR 輸出、共用起播窗口及對照／停用模式 |
| `playurl-summary` | 型別化接納結果、安全最近摘要、狀態語意、生命週期及匯出隱私 |
| `control-center` | Catalog 單節點更新、遠端設定合併、關閉／切頁後的命令與焦點所有權 |

使用 `npm test -- <selector>` 執行單一套件；執行器也接納 `suites/<selector>` 別名。`npm test -- architecture` 執行 AST 規則測試情境，`npm test -- imports` 執行匯入純度測試，`npm test -- tooling` 使用暫存測試情境驗證測試工具。完整 `npm test` 執行這三項與全部契約套件。

[scripts/test.mjs](../scripts/test.mjs) 逐套件打包為帶內嵌原始碼對照的 `.mjs`，使用 `--enable-source-maps` 與 `--test-isolation=none` 在獨立 Node 子程序執行，每次只傳入一份套件檔案，案例依序執行。每案例及清理掛鉤預設期限為 5 秒；外層每套件硬期限為 60 秒。逾時或 stdout／stderr 合計超過 32 MiB 時，終止所屬程序並等待退出，再處理其他套件。正常完成不強制退出，未清理的週期計時器因而會在硬期限被判失敗。

終端採原生 `spec` 報告產生器；[JSON 報告產生器](../scripts/test-reporter.mjs) 從 Node 事件產生有版本的案例數、耗時、狀態及失敗名稱／位置／訊息／堆疊資訊。程式判定不解析人類可讀文字；退出碼、摘要與案例狀態必須一致。打包、測試、清理、逾時、超量輸出及摘要缺失／損壞均為失敗；收集其他套件後由 `runTests()` 拋出彙總錯誤。退出碼：通過為 `0`，上述失敗為 `1`，非法參數或名稱零命中為 `2`。CLI 在建立暫存目錄前驗證套件／參數／正規表示式。完整執行禁止空套件、僅執行標記（`only`）、略過（`skipped`）、待實作（`todo`）、取消（`cancelled`）；`--name` 允許未命中案例不執行，但總選取至少須實際執行一個案例。結果隨已驗證父目錄及前綴的暫存目錄清理。

匯入純度涵蓋所有非入口、非宣告模組；停用未使用程式碼移除（tree shaking）並忽略打包最佳化註記，保留原全域陷阱及 `Date.now`／`Math.random`。陷阱在不載入 `node:test` 的獨立 Node 子程序執行，內層期限為 3 秒，由外層具名案例監督。它只檢查頂層匯入，不檢查後續方法呼叫。

各案例獨立建立測試情境；前置狀態轉換由建立函式重建，同情境的多個斷言留在同一案例。使用原生 `assert.ok`、`assert.strictEqual`，保留 JSON／字串／身分比較。案例數描述情境，不能換算為舊版功能斷言數；[遷移對照](../tests-v2/MIGRATION.md) 保存原行為、分支及矩陣，實測見 [工具驗證紀錄](TEST_TOOLING_REPORT.md)。

共用 [測試資源範圍](../tests-v2/support/scope.ts) 使用 `testScope(t)`，立即以 `t.after()` 登記清理。`own()`、`defer()` 支援同步／非同步釋放，依反向登記順序執行；一項失敗仍完成其餘清理與全域還原，彙總錯誤。`dispose()` 可重複呼叫。全域替換必須經 `defineGlobal()`，保存第一次修改前的完整屬性描述子。測試資源範圍不包裝全域計時器；計時器、攔截、訂閱及取消函式由所屬資源或測試明確登記清理。模擬介面使用 `satisfies`，不得以 `as never` 繞過型別。

[FakeClock](../tests-v2/support/clock.ts) 保留固定起始時間，拒絕無效延遲、零或負數的週期計時器間隔及重入推進，提供待執行數量。相同時間計時器依登記順序執行，獨立微任務佇列於下一個計時器前處理；每次推進最多 10,000 次回呼函式。釋放／取消後不再執行。以 [deferred](../tests-v2/support/deferred.ts) 或測試情境的完成訊號等待非同步工作，保留拒絕及取消路徑。BrowserScheduler 契約可使用少量真實事件迴圈，依完成訊號判定。

不得在正式打包產物加入公開測試橋接介面；測試從 TypeScript 來源獨立打包。

2026-10-09 的 [v2.1.9 的 17 項修復](FUNCTIONAL_FIX_REPORT.md) 以 `tests-v2/regressions/functional-races/` 保存具名回歸，分別由 application、progressive-routing、native-transport、adapter-boundaries 及 orchestration 套件匯入；UI 案例位於 control-center。原調查證據不作正式測試輸入。XHR 原生狀態替身區分原生 send 前／後的 abort，模擬同步 setter 例外；ProgressEvent 全域經 testScope 管理。FakeClock／deferred 明確控制晚到、拒絕及鎖取得順序，不能以此宣稱 Chrome 原生事件已驗收。

同日納入 v2.1.10 的 [BR-02 修復](BR02_FIX_REPORT.md) 新增 40 個正式案例，仍由 `npm test -- native-transport` 執行；該版全套為 339 個。XHR 替身補入 open 參數／方法／URL／同步選項驗證、OPENED→OPENED 不發事件，以及實測 Chrome 同步選項錯誤清成 UNSENT 的邊界。先保存失敗契約，再改來源；原調查證據不覆寫。真正 Chrome 的本機來源隔離頁、Tampermonkey 安裝版驗收及 Node 契約必須分列，不能互相替代。

2026-10-10 [BR-04／BR-05 修復](BR04_BR05_FIX_REPORT.md) 新增 66 個案例，全套為 **19 套件、448 案例**。19 個 BR-04 與 16 個 Fetch 整合取消案例由 native-transport 執行；31 個起播等待／取消／清理案例由 measurement-state 匯入。原生 readyState 替身使用 prototype getter，讓安裝時保存的原生 getter 能獨立讀取狀態。內部重新準備最多兩次，每次 open／選項／header 回來都重查 owner、phase、原生 OPENED 與送出政策。取消原因以 signal.reason 原值回傳，不能用 truthiness 替換；單一取消不消耗其他等待者的共用工作。

本版 [安裝版紀錄](CHROME_v2.1.12_ACCEPTANCE.md) 分列真正 singleton 的 35 項矩陣與同片基本回歸。合成攔截除 GET／Range 外必須處理 OPTIONS CORS／credentials；事件從執行前 cursor 分頁，截斷或工具前提不成立的輪次作廢。測試前保存學習資料基準，以 Vault 表示／精確 requestId 限定自有寫入抑制，測後核對、還原實例掛鉤並清理。清理鎖內 Promise 必須明確 await；沒有測試前完整備份時，不得宣稱能復原樣本上限淘汰的歷史。

2026-10-10 [BR-03 本機修復](BR03_FIX_REPORT.md) 新增 43 個案例，全套為 **19 套件、382 案例**。`content.ts` 由 orchestration 匯入、`content-domain.ts` 由 domain 匯入；Fetch／XHR cid 所有權沿用 native-transport，MP4／FLV／混合格式沿用 progressive-playurl，正式登記不變。runtime fixture 可注入真正 MeasurementController 的 probe，利用 FakeClock／deferred 驗證排列保留工作、真正換片撤銷晚到結果。原四個失敗契約已正式移植，紅燈 log 與綠燈驗證分開保存。

內容識別修改須同時驗證請求 cid 正規化／所有權、可信來源、精確父目錄備援與容量。cid 僅從已辨識請求提取，不能從 payload 或頁面推測；低信任提示不更新基準。新增內部 context 不得進入診斷／持久資料或取代 Vault 授權。具體契約見 [架構](ARCHITECTURE.md#application-controllers)。

文件使用「儲存元件（store）」「測試情境（fixture）」「建立函式（factory）」「中繼資料（metadata）」「原始碼對照（source map）」「報告產生器（reporter）」及「堆疊資訊（stack）」；瀏覽器攔截與 `t.after()` 等測試清理掛鉤分開描述。程式識別字、命令及 Node 原始狀態值保持原樣；中文化範圍與封存規則見 [文件政策](INDEX.md#現行指南)。

<a name="build-output"></a>

## 建置輸出

[build.mjs](../scripts/build.mjs) 將 `src-v2/entry.ts` 打包成單一瀏覽器 IIFE，以 Chrome 120 為目標，不分割程式碼；前置 [使用者腳本中繼資料](../src-v2/metadata.txt) 並填入設定版本。輸出為 `dist/BiliCDN_TW.user.js`、外部原始碼對照及 `dist/build-manifest.json`。資訊清單記錄建置選項、輸入雜湊及使用者腳本雜湊。建置不會上傳產物。v2 來源不得加入執行期依賴、遠端程式載入、Worker 攔截或歷史 v1 匯入。

<a name="real-chrome-validation"></a>

## 真實 Chrome 驗證

BR-01 正式控制器契約在 application 的 functional-races/br01.ts，適配器方法／清理契約在 adapters 的 br01-player.ts；BR-06 的 functional-races/br06.ts 由 application 明確匯入，使用真正 Adapter／Monitor／Recovery。Node 可信事件及派送是型別化契約模型；Chrome 可信按鍵與監聽器間 microtask 另作證據，不能互換。精確 14,999／15,000、29,999／30,000、重載後 15,000 ms 使用 FakeClock；實際網站另以 Auto 的 1／2 倍速與完整合併 Fetch／Network 游標驗證。故障注入須先精確送出前攔截、音訊通行並抑制 owned 受控樣本持久化。每個有效窗口須逐一核對游標／hasMore／truncated；工具狀態用同一可變物件保存，窗口結束立即清空 Fetch patterns，不能在模型等待期間保留未處理的 Request 攔截。背景以原生 Document.prototype.hidden getter與 Runtime 實際可見性比對，不使用被腳本維持為 visible 的 instance getter。網站提前暫停／外部換核心時，應驗證撤銷並將尚未形成的逾時前提列待驗收。重跑及限制見 [BR-06 修復報告](BR06_FIX_REPORT.md) 與 [v2.1.14 安裝紀錄](CHROME_v2.1.14_ACCEPTANCE.md)。

主要使用與驗收場景以 **Auto 畫質**為主，固定畫質作必要邊界對照；Auto 正常調整解析度不能單獨判為功能異常。畫質操作與 seek 分開，記錄實際影格／緩衝進度、使用者最新操作及網站重試，不以選單文字或 timeout 設定值代替事件。2026-10-10 的 [BR-01 Auto 調查](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) 分列有效／作廢輪、控制器候選失敗契約與正式測試；其重跑前提見 `.work/functional-review/br01/2026-10-10-c924b02/RERUN.md`。

v2.1.8 的標準 Tampermonkey 更新及 2026-10-04 MP4 試片／公開 DASH 觀察見 [歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#chrome--tampermonkey-observations-after-standard-update)。完整公開 MP4、FLV 現場樣本及較早 DASH 緩衝的限制一併保留，不另列為已批准待辦。

已發布使用者腳本在 Tampermonkey 更新後，使用獨立測試分頁，記錄：

- 腳本版本及 Chrome／Tampermonkey 版本；
- 頁面類型、畫質、編解碼器及倍速；
- 實際觀察到的影片／音訊主機；
- 是否啟動探測及是否換主機；
- 跳轉播放位置、SPA、背景、暫停／恢復及多分頁結果。

後續相關變更，確認可合法存取的 MP4 分段至少播放 10 秒並執行 DASH 回歸，記錄格式／分段處理、實際影片主機、播放進度及實際測到的起播／固定主機設定競態。明確區分試片與完整公開內容。FLV 目前只有自動契約證據；有合法可存取樣本時再驗證現場播放，記錄實際範圍。後續檢查須與已批准結案的 v2.1.6 驗收及已完成的 v2.1.8 觀察分開。

不得把 VM 或模擬結果稱為真實播放。未經使用者明確授權，不改變其既有暫停／測試分頁。

2026-10-09～10 的 [v2.1.10 安裝版紀錄](CHROME_v2.1.10_ACCEPTANCE.md) 分列 68 個 XHR 案例執行、實際播放與未完成 gate／影音隔離。[BR-03 原調查](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) 的四個獨立來源契約仍保存在 `.work/chrome-v2.1.10/2026-10-09/`；未修復來源當時 2 通過／2 失敗、退出碼 1，不納入通過數。原入口會匯入目前來源，不能重跑後覆寫當時失敗紀錄。移植後的正式回歸由 `npm test -- orchestration` 執行。

BR-03 修復輪的 `.work/functional-fixes/br03/2026-10-10-c836a17/RERUN.md` 記錄本機來源隔離與先裝 Request 攔截的重跑步驟。真實 Chrome 的 BR-03 31／31、BR-02 31／31 是來源隔離結果；既有 v2.1.10 同片播放正常也不代表修復產物已安裝。發布並更新後須另跑安裝版矩陣。網站僅使用指定風景影片，畫質切換與 seek 分開操作；不變更 Chrome 設定、不停用其他腳本。工具中斷、過期 interception id 或事件截斷的輪次作廢，先保持攔截並卸載頁面後才清理。

<a name="packaging-and-release"></a>

## 封裝與發行

明確執行 `npm run package` 會建置，依 `release.json` 版本在 `Release/v<version>/` 寫入五項設定產物：

- `BiliCDN_TW.user.js`
- `CHANGELOG_v<version>.md`
- `TEST_REPORT_v<version>.md`
- `BUILD_MANIFEST_v<version>.json`
- `SHA256SUMS_v<version>.txt`

[package.mjs](../scripts/package.mjs) 覆寫這些具名檔案，不清空既有 Release 目錄。校驗值清單納入該目錄已存在的全部檔案，校驗值本身除外。封裝前檢查目標目錄；不得為了驗證已發布版本而執行此命令。暫存封裝驗證使用 `npm run verify`。

依 [AGENTS 發行規則](../AGENTS.md#release-rules)，本專案功能修復完成並通過必要自動及安全驗證後，預設自主提交、遞增修補版本、封裝、推送 main／標籤及發布 GitHub Release，不再等待使用者重複要求；當次明確限定只調查或保留本機修改時遵守該範圍。完成後核對公開 latest 更新的版本、大小與 SHA-256。不得加入修補、CI/CD 或 GitHub Actions。本機封裝不等於發布。GitHub Release 附件只有使用者腳本，更新 URL 保持指向本儲存庫最新 Release。發布前執行 `npm run typecheck`、`npm run architecture`、`npm test`、`npm run verify` 及必要安全驗證。真實 Chrome／Tampermonkey 驗收另行記錄，未執行的瀏覽器檢查不得寫成通過。
