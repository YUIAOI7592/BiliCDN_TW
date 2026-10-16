<a name="development"></a>

# 開發、測試與發行流程

本指南適用目前 `src-v2/`（版本以 [release.json](../release.json) 為準），瀏覽器測試**只使用 Codex 內建瀏覽器＋Tampermonkey**。具體操作、固定矩陣、背景校準與停止條件統一見 [IAB_TESTING](IAB_TESTING.md)，不維護另一份外部 Chrome 流程。

先讀 [產品契約](PROJECT_CONTEXT.md)、[安全邊界](../SECURITY.md)、[架構](ARCHITECTURE.md) 及 [AGENTS](../AGENTS.md)。目前工作狀態見 [TODO](TODO.md)，歷次測試數字與修復進度見 [TEST_REPORT](TEST_REPORT.md) 和 [INDEX](INDEX.md)，不以歷史紅燈或舊工作清單作現行待辦。

<a name="repository-layout-and-archive-maintenance"></a>

## 儲存庫配置與封存維護

| 位置 | 用途 |
| --- | --- |
| `src-v2/`、`src-v2/entry.ts` | 唯一正式來源與組合入口 |
| `tests-v2/`、`scripts/test-registry.mts` | 正式具名契約與明確登記 |
| `scripts/` | 型別、架構、測試、建置及封裝工具 |
| `docs/` | 現行指南、版本別報告及索引 |
| `Release/v<version>/` | 已封裝快照，發布後不回寫 |
| `baseline/`、`archive/retired/` | 來源原件、歷史文件與退出流程的工具；不作 v2 建置／測試輸入 |
| `.work/iab-testing/` | 新內建瀏覽器輪次的私有證據，實際開跑才建立 |

修改原始碼使用 apply_patch，保留無關變更。現行指南使用繁體中文；歷史正文與已封存安全產物保持原狀。修改標題時保留被引用錨點。文件單獨變更只跑連結、引用、事實一致性與 git diff --check，不把它寫成新的產品測試或安全掃描。

內部收斂先以未修改實作通過具名行為契約，再機械式整理；新純比較助手只回傳事實，資格／基準／計數留在原呼叫端。保持原生 getter、參數、短路讀值、事件／註冊／清理與等待後驗證順序，不能因抽函式而提前快照狀態。單一用途小模型可與同用途契約共置；不以檔案數或行數當拆分目標，狀態與副作用的唯一所有者不變。

<a name="markdown-format"></a>

## Markdown 格式（GFM）

以 [GFM 規格](https://github.github.com/gfm/) 為語法依據，表格及提示另對照 GitHub 官方的 [表格說明](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-tables) 與 [Alerts 語法](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)。下列是專案的排版約定，不把所有格式檢查器偏好稱為 GFM 強制規定。

- 一份現行文件保留一個 `#` 主標題，依序使用 `##`、`###`；保留既有自訂錨點。歷史完整報告彙編可保留原始多篇標題，不為排版改寫證據。
- 標題、段落、清單、表格、引用及程式碼區塊之間保留一個空行。清單使用 `-` 或有序編號，巢狀項目依父項內容縮排；任務清單維持 `- [ ]`／`- [x]` 的實際狀態。
- 表格使用完整表頭與 `---` 分隔列；保留原有對齊方向，每列欄數一致。儲存格中的字面管線符號須跳脫為 `\|`，包含行內程式碼中的管線。中文長表格不靠大量補空白對齊。
- 指令、檔名、路徑與程式識別字使用行內程式碼；多行程式碼使用有語言標籤的圍欄。格式整理不修改程式碼內容、SHA-256、URL、版本、數量或原始測試輸出。
- 粗體使用 `**文字**`。結尾有標點、後面緊接中文字時，檢查解析結果；必要時在結束標記後加空格，例如 `**結果：** 通過`。不能只數星號判定已正確渲染。
- 使用有描述文字的 Markdown 連結，保留目標及錨點；CHANGELOG／TEST_REPORT 的儲存庫文件連結使用完整 GitHub URL。不要為統一格式改寫原生 URL、移除相容錨點或把有效 Alerts 標記跳脫為字面文字。
- 整理範圍包含根目錄指南、`docs/`、測試文件及封存索引；已發布 `Release/`、來源基準、不可變安全產物與封存正文維持原樣，文件維護歷史只追加本次紀錄。
- 格式驗證須涵蓋 GFM 解析、表格欄位、程式碼與連結保存、相對路徑／錨點及 `git diff --check`。Node 契約與瀏覽器功能測試不因單純排版而重跑，也不把文件檢查寫成產品驗收。

<a name="prerequisites"></a>

## 環境需求

- Node.js 26.8.1
- npm 11.19.0
- TypeScript 7.0.2、esbuild 0.28.2 及 `@types/node@26.6.4`（鎖定的開發依賴）
- 瀏覽器驗證只使用 Codex 內建瀏覽器及其中的 Tampermonkey，實際版本於每輪記錄

準備 Node／npm 後，在儲存庫根目錄執行 `npm ci`，安裝 [package-lock.json](../package-lock.json) 鎖定的開發依賴。[release.json](../release.json) 記錄發行工具版本。`verify` 檢查實際執行的精確 Node 版本，`build` 檢查精確 esbuild 版本。建置資訊清單的 npm／TypeScript 版本取自設定，不獨立驗證執行中的 npm／編譯器版本。[package.json](../package.json) 沒有執行期依賴。

<a name="commands"></a>

## 命令

```powershell
npm run typecheck     # 嚴格 TypeScript 檢查，不輸出檔案
npm run architecture  # 原始碼 AST 依賴圖及列出的所有權語法規則
npm run format:check  # 唯讀檢查正式來源、測試、工具與維護設定格式
npm run format        # 格式化上述維護範圍；代理修改仍按 AGENTS 使用 apply_patch
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

從儲存庫根目錄執行命令。`typecheck` 與 verify 共用 [typecheck.mts](../scripts/typecheck.mts)，依序檢查正式來源、測試及維護工具。[tsconfig.json](../tsconfig.json) 保留嚴格 DOM 環境並設 `types: []`；[tsconfig.tests.json](../tsconfig.tests.json) 加入 Node 型別、DOM 及使用者腳本全域宣告。[tsconfig.tools.json](../tsconfig.tools.json) 使用 NodeNext、Node 型別、可移除型別語法與明確型別匯入，涵蓋全部 `.mts` 工具。工具由既有 Node 直接執行，不新增轉譯載入器；Node 只移除型別、不讀取 tsconfig，另由 typecheck 檢查型別，依 [官方 TypeScript 文件](https://nodejs.org/api/typescript.html) 使用 `.mts` ESM、可移除語法及型別匯入；測試打包及匯入純度的暫存 `.mjs` 仍是生成產物。`architecture` 檢查正式模組；獨立的 `npm test -- architecture` 測試架構檢查器自身測試情境。判斷這些檢查能證明哪些不變量前，先閱讀 [架構檢查範圍](ARCHITECTURE.md#dependency-direction)。

[verify.mts](../scripts/verify.mts) 檢查設定的 Node 版本、唯讀格式、typecheck、來源架構、全部測試、兩次建置的輸出／資訊清單一致性、JavaScript 語法、指定舊版／Worker 標記清單、必要儲存標記及封裝 SHA-256。封裝步驟會再建置一次。命令寫入 `dist/`，於新的 `dist/verify-package-*` 目錄封裝，確認解析後位置及前綴再刪除該目錄；不寫入 `Release/v<version>/`。

verify 不執行 Codex Security 或內建瀏覽器／Tampermonkey 驗收。安全敏感變更或使用者明確要求時，另行執行安全差異掃描；不要求每版掃描。上一版通過報告不能作為新本機變更的證據。

### 原始碼格式與靜態規則

Prettier 3.9.10 只作開發工具。固定格式為兩空格、單引號、無分號、100 字元行寬、LF 與尾端逗號；關閉嵌入語言格式化，保留測試字串及模板內容。格式工具使用明確維護清單，只遍歷正式來源、測試與工具，另含根目錄維護 JSON 設定；Release、封存、基準、私有證據、生成 JS 與依賴鎖定檔不寫入。輸出最多四次格式計算取得穩定內容，無法穩定時失敗；check 模式不寫入。

三個型別專案沿用 strict，並檢查未使用宣告／參數及明確型別匯入。移除多餘綁定仍保留初始化的副作用；既有位置參數使用明確未用名稱而不變更呼叫介面。本輪不加入 ESLint／typescript-eslint，TypeScript 7 保持既有精確版本，架構規則仍使用本機 AST。

<a name="adding-behavior"></a>

## 新增行為

1. 純粹的資格／排名邏輯放在 `domain/`，明確傳入時鐘。
2. 持久或工作階段資料放在型別化狀態儲存元件。
3. 可改變選路、量測或恢復的動作透過控制器方法提供。
4. 瀏覽器差異留在適配器，GM 儲存透過 `platform/storage.ts`；UI 管理自己的 DOM 及呈現生命週期。
5. 發出型別化事件，不讓診斷讀取控制器內部。
6. 在 `tests-v2/suites/` 對應獨立套件，或不依賴瀏覽器的 `tests-v2/domain-boundaries.ts` 新增具名 `node:test` 契約。新套件登記於 `scripts/test-registry.mts`。

修改執行期邏輯前，先以失敗的領域層、控制器或適配器契約重現行為。親和主機變更只由 `RouteCoordinator` 執行，主動探測只由 `MeasurementController` 啟動，核心重載只由 `RecoveryController` 執行。等待後及儲存鎖回呼函式內保留生命週期檢查；只使用計時器介面不能避免舊工作提交。診斷消費型別化事件及快照。

<a name="test-suites-and-isolation"></a>

## 測試套件與隔離

[test-registry.mts](../scripts/test-registry.mts) 明確登記下列 19 個套件。支援工具、暫存測試情境及封存資料不透過萬用字元模式（glob）執行：

| 套件選擇器 | 涵蓋範圍 |
| --- | --- |
| `architecture` | 架構檢查器規則 |
| `imports` | 非入口模組匯入純度 |
| `tooling` | 測試執行器、報告、資源及工具行為 |
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
| `control-center` | Catalog 單節點更新、遠端設定合併、非同步視圖與焦點所有權、BR-10 鍵盤隔離／預設操作／清理、P05 原生優先／完整文字／pending 寫入及過期視圖 |

使用 `npm test -- <selector>` 執行單一套件；執行器也接納 `suites/<selector>` 別名。`npm test -- architecture` 執行 AST 規則測試情境，`npm test -- imports` 執行匯入純度測試，`npm test -- tooling` 使用暫存測試情境驗證測試工具。完整 `npm test` 執行這三項與全部契約套件。

[scripts/test.mts](../scripts/test.mts) 逐套件打包為帶內嵌原始碼對照的 `.mjs`，使用 `--enable-source-maps` 與 `--test-isolation=none` 在獨立 Node 子程序執行，每次只傳入一份套件檔案，案例依序執行。每案例及清理掛鉤預設期限為 5 秒；外層每套件硬期限為 60 秒。逾時或 stdout／stderr 合計超過 32 MiB 時，終止所屬程序並等待退出，再處理其他套件。正常完成不強制退出，未清理的週期計時器因而會在硬期限被判失敗。

終端採原生 `spec` 報告產生器；[JSON 報告產生器](../scripts/test-reporter.mts) 從 Node 事件產生有版本的案例數、耗時、狀態及失敗名稱／位置／訊息／堆疊資訊。程式判定不解析人類可讀文字；退出碼、摘要與案例狀態必須一致。打包、測試、清理、逾時、超量輸出及摘要缺失／損壞均為失敗；收集其他套件後由 `runTests()` 拋出彙總錯誤。退出碼：通過為 `0`，上述失敗為 `1`，非法參數或名稱零命中為 `2`。CLI 在建立暫存目錄前驗證套件／參數／正規表示式；--list 不與套件選取或 --name 合用。完整執行禁止空套件、僅執行標記（`only`）、略過（`skipped`）、待實作（`todo`）、取消（`cancelled`）；`--name` 允許未命中案例不執行，但總選取至少須實際執行一個案例。結果隨已驗證父目錄及前綴的暫存目錄清理。

匯入純度涵蓋所有非入口、非宣告模組；停用未使用程式碼移除（tree shaking）並忽略打包最佳化註記，保留原全域陷阱及 `Date.now`／`Math.random`。陷阱在不載入 `node:test` 的獨立 Node 子程序執行，內層期限為 3 秒，由外層具名案例監督。它只檢查頂層匯入，不檢查後續方法呼叫。

各案例獨立建立測試情境；前置狀態轉換由建立函式重建，同情境的多個斷言留在同一案例。使用原生 `assert.ok`、`assert.strictEqual`，保留 JSON／字串／身分比較。案例數描述情境，不能換算為舊版功能斷言數；[遷移對照](../tests-v2/MIGRATION.md) 保存原行為、分支及矩陣，實測見 [工具驗證紀錄](TEST_TOOLING_REPORT.md)。

共用 [測試資源範圍](../tests-v2/support/scope.ts) 使用 `testScope(t)`，立即以 `t.after()` 登記清理。`own()`、`defer()` 支援同步／非同步釋放，依反向登記順序執行；一項失敗仍完成其餘清理與全域還原，彙總錯誤。`dispose()` 可重複呼叫。全域替換必須經 `defineGlobal()`，保存第一次修改前的完整屬性描述子。測試資源範圍不包裝全域計時器；計時器、攔截、訂閱及取消函式由所屬資源或測試明確登記清理。模擬介面使用 `satisfies`，不得以 `as never` 繞過型別。

[FakeClock](../tests-v2/support/clock.ts) 保留固定起始時間，拒絕無效延遲、零或負數的週期計時器間隔及重入推進，提供待執行數量。相同時間計時器依登記順序執行，獨立微任務佇列於下一個計時器前處理；每次推進最多 10,000 次回呼函式。釋放／取消後不再執行。以 [deferred](../tests-v2/support/deferred.ts) 或測試情境的完成訊號等待非同步工作，保留拒絕及取消路徑。`BrowserScheduler` 契約可使用少量真實事件迴圈，依完成訊號判定。

不得在正式打包產物加入公開測試橋接介面；測試從 TypeScript 來源獨立打包。

各領域回歸由既有套件明確匯入；調查目錄只保存原證據，不能成為正式測試輸入。原生 XHR 替身須區分送出前後 abort、同步 setter／open 例外及重入所有權；鍵盤替身分開事件種類與網站提交階段，指標 closest 只查祖先。可信事件模型不能替代實際瀏覽器輸入。控制中心替身須模型化事件路徑、capture／bubble、取消旗標與 listener 移除；模型的預設啟動不等於瀏覽器原生啟動。Enter／Space 必須另於自有隔離頁及指定影片的實際快捷鍵環境，以可信按鍵驗證；來源 UI 使用記憶體依賴且不替換安裝 singleton。

修改內容識別須涵蓋 cid 請求所有權、低信任來源、父目錄集合與容量；修改恢復須涵蓋精確期限、最新目標、拖曳、生命週期、政策與晚到 Promise。案例以正確契約斷言，不只斷言錯誤行為存在。修復前失敗與修復後通過紀錄分開保存。

<a name="cr-修復回歸與原生校準"></a>
<a name="v2124-可信播放按鈕意圖"></a>

### 原生校準與回歸

XHR 變更須以原生對照核對送出前後 abort、ByteString／USVString 一次轉換、轉換失敗後更正送出、跨 realm body 與同步重入。量測拒絕案例用獨立 Node 子程序觀察未處理拒絕，僅編譯本機 helper，明確管理 `FakeClock`、記憶體儲存及清理。既有案例與來源對照見 [CR 修復報告](CR01_CR05_FIX_REPORT.md)。

可信播放意圖的契約須涵蓋同播放器／媒體／內容、paused／ended／error、真正可見性、可信事件與清理後回呼；既有路線授權、拖曳、額度、死核心 4 秒、其他意圖 30 秒與重載後 15 秒仍適用。一般停滯另驗 6／12 秒、長 seek／未完成可信目標 15／30 秒及同段升級不重開起點／額度。目標捕獲與初始化例外須驗真正零、未知來源撤銷、每個副作用前重入及晚到完成；recovered 後再檢查 15 個一秒區段，該驗收不延後產品兩樣本成功判定。來源隔離、正常實際播放與有限失敗退出分列，不能以來源模型代替安裝版。現行工作與停止狀態見 [TODO](TODO.md)。

<a name="build-output"></a>

## 建置輸出

[build.mts](../scripts/build.mts) 將 `src-v2/entry.ts` 打包成單一瀏覽器 IIFE，以 Chrome 120 為目標，不分割程式碼；前置 [使用者腳本中繼資料](../src-v2/metadata.txt) 並填入設定版本。輸出為 `dist/BiliCDN_TW.user.js`、外部原始碼對照及 `dist/build-manifest.json`。資訊清單記錄建置選項、輸入雜湊及使用者腳本雜湊。建置不會上傳產物。v2 來源不得加入執行期依賴、遠端程式載入、Worker 攔截或歷史 v1 匯入。

<a name="real-chrome-validation"></a>
<a name="真實-chrome-驗證"></a>
<a name="iab-validation"></a>

## 內建瀏覽器驗證

唯一執行方案為 [IAB_TESTING](IAB_TESTING.md)。N 為 Node、S 為內建瀏覽器來源隔離、I 為實際 Tampermonkey 安裝、E 為環境校準；任何一層都不能冒充另一層通過。舊 real-chrome-validation 錨點只保留連結相容，不授權使用外部 Chrome。

執行前凍結版本、來源／本體雜湊與案例 ID，取得完整 singleton／hooks 身分，再校準可信輸入、精確攔截及原生背景。每窗明確記錄有效性與 PASS／FAIL；前提不成立就作廢並列原因，沒有新條件不重跑。

網站只用指定風景影片、Auto 1／2 倍分開，保持其他腳本與瀏覽器設定。真正背景用新增分頁及實際切換校準；網站 document 被偽裝為前景是預期值，不可拿它判斷 Runtime 背景資格。隱藏面板不是背景驗證方式。

故障前先建立精確 video／audio 攔截、單一連續 Fetch／Network 游標與工作 ID 學習抑制，清理保留至晚到結果收束。SDK 受控 Promise、來源模型、真正安裝及自然觀察分列。不能修改網站媒體 getter、重建控制器或重設預算湊通過。

本方案沒有現成一鍵瀏覽器執行器；每輪需保存工具操作與重跑入口。工具不支援的必要步驟列具體阻塞，不能改用外部瀏覽器或繞過限制。詳見 [判定與時間上限](IAB_TESTING.md#verdict)、[證據目錄](IAB_TESTING.md#evidence)。

[iab-event-collector.mts](../scripts/iab-event-collector.mts) 是注入 IAB CDP capability 的主機端事件收集工具，不建立瀏覽器連線或計時器，也不包含產品控制器。每個窗口使用新實例；跨呼叫狀態留在實例，完整登記暫停 ID 後才分類。呼叫端負責 finally 清理、停止條件及樣本隔離。正式契約歸入 `npm test -- tooling`；自有 loopback 隔離與安裝版結果分列，見 [第 5 輪](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md)。

<a name="p05-原生複製契約"></a>

### 剪貼簿驗證

先保存 IAB 剪貼簿的全部項目與格式，只留記憶體；以自有頁合成文字校準可信原生寫入、預定 API 讀回及真正 Ctrl+V。共同通道與完整復原能力成立後，才驗證實際產品當次完整報告；不 trim、不重序列化、不以完成回呼或提示代替全文比較。來源記憶體 UI、實際安裝身分與正常／失敗案例分列。

寫入收束後，復原前核對完整項目仍由本輪持有；使用者的新內容優先保留。IAB 與 Windows PowerShell 不得假設共用同一剪貼簿。v2.1.21 的通道限制及失敗保留在 [通道調查](P05_COPY_CHANNEL_REPORT_2026-10-12.md) 與 [原結果](P05_COPY_IAB_RESULT_2026-10-12.md)；v2.1.22 的原生優先修復及實際全文通過見 [P05 報告](P05_COPY_FIX_REPORT.md)。已通過子項不重測，沒有新前提不重複 GM 校準窗口。

<a name="packaging-and-release"></a>

## 封裝與發行

明確執行 `npm run package` 會建置，依 `release.json` 版本在 `Release/v<version>/` 寫入五項設定產物：

- `BiliCDN_TW.user.js`
- `CHANGELOG_v<version>.md`
- `TEST_REPORT_v<version>.md`
- `BUILD_MANIFEST_v<version>.json`
- `SHA256SUMS_v<version>.txt`

[package.mts](../scripts/package.mts) 覆寫這些具名檔案，不清空既有 Release 目錄。校驗值清單納入該目錄已存在的全部檔案，校驗值本身除外。封裝前檢查目標目錄；不得為了驗證已發布版本而執行此命令。暫存封裝驗證使用 `npm run verify`。

依 [AGENTS 發行規則](../AGENTS.md#release-rules)，本專案功能修復完成並通過必要自動及安全驗證後，預設自主提交、遞增修補版本、封裝、推送 main／標籤及發布 GitHub Release，不再等待使用者重複要求；當次明確限定只調查、文件整理或保留本機修改時遵守該範圍。完成後核對公開 latest 更新的版本、大小與 SHA-256。不得加入修補、CI/CD 或 GitHub Actions。本機封裝不等於發布。GitHub Release 附件只有使用者腳本，更新 URL 保持指向本儲存庫最新 Release。發布前執行 `npm run typecheck`、`npm run architecture`、`npm test`、`npm run verify` 及必要安全驗證。內建瀏覽器／Tampermonkey 驗收另行記錄，未執行的瀏覽器檢查不得寫成通過。

發布後先以內建瀏覽器的公開 latest 使用者腳本入口觸發既有安裝更新，再核對新文件實際執行身分；v2.1.21 已證明此路徑可用。不能只依歷史擴充功能介面限制就要求手動更新。只有當次入口確實受阻才交由使用者完成必要步驟；操作與證據要求見 [IAB 更新流程](IAB_TESTING.md#release)。
