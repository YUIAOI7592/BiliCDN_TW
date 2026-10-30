# 開發、測試與發行流程

本指南適用目前 `src-v2/`（版本以 [release.json](../release.json) 為準），瀏覽器測試**只使用 Codex 內建瀏覽器＋Tampermonkey**。具體操作、固定矩陣、背景校準與停止條件統一見 [IAB_TESTING](IAB_TESTING.md)，不維護另一份外部 Chrome 流程。

所有開發與驗證先遵守 [AGENTS 永久執行禁令](../AGENTS.md#使用者永久執行禁令)。既有命令若會啟動本機網站服務，不得執行；預覽直接開本機 HTML，不要求切換前景，測試保持無聲。來源中的歷史工具仍存在不代表可啟動，前提不足依 IAB_TESTING 記錄限制。

依 [INDEX 閱讀路徑](INDEX.md#閱讀路徑) 確認本次工作所需指南；修改時查本頁的 [文件更新對照表](#文件更新對照表)。

## 儲存庫配置與封存維護

本節唯一維護目錄結構與檔案分類；INDEX 和封存索引只提供導覽連結。版本取自 [release.json](../release.json)，實際搬移項目與驗證結果由 [搬移清單](../archive/relocation-manifest.json)、[工具日誌](TEST_TOOLING_REPORT.md) 及 [維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) 追溯，不在此複製檔案數或工作狀態。

### 目錄結構

以下列出主要目錄及關鍵檔案，以儲存庫根目錄為起點；`v<version>` 表示 `release.json` 的版本。主機專用目錄不隨公開 checkout 提供。

```text
./
├─ src-v2/                         正式產品來源，入口 entry.ts
├─ tests-v2/                       正式套件、回歸案例與測試輔助
├─ scripts/                        現行型別、架構、測試、建置與維護工具
├─ docs/                           現行指南、導覽、工作狀態與報告
│  ├─ INDEX.md                     閱讀入口
│  ├─ DEVELOPMENT.md               開發、目錄與維護流程
│  ├─ HISTORY.md                   歷史追溯入口
│  ├─ TODO.md                      工作狀態
│  ├─ TEST_REPORT.md               最新版完整驗收結果
│  └─ doc-manifest.json            文件分類、權威與保護登記
├─ Release/v<version>/             僅現行版本的五項原始封裝檔
├─ dist/                          本機正式建置輸出，Git 忽略
│  ├─ BiliCDN_TW.user.js
│  ├─ BiliCDN_TW.user.js.map
│  └─ build-manifest.json
├─ baseline/                       不可變上游原件及校驗清單
├─ node_modules/                   現行本機開發依賴，Git 忽略
├─ .git/                           Git 管理資料
├─ .codex/                         本機工具目錄，可為空；Git 忽略
├─ README.md / AGENTS.md / SECURITY.md / LICENSE
├─ package.json / package-lock.json / release.json
├─ tsconfig*.json / 格式與 Git 設定
└─ archive/
   ├─ README.md                    封存導覽
   ├─ relocation-manifest.json     公開搬移、雜湊與 URL 修改清單
   ├─ retired/
   │  ├─ README.md                 退出流程資料導覽
   │  ├─ docs/                     公開歷史閱讀版、彙編與指南快照
   │  │  └─ evidence/              指定公開圖片與固定盤點證據
   │  ├─ releases/Release/         過往版本原始封裝及校驗清單
   │  ├─ originals/                搬移前原始文件與完整日誌 TAR
   │  └─ local/                    本機私有封存，Git 忽略
   │     ├─ 2026-10-20-cleanup/     當日清理封存，保留原相對路徑
   │     │  ├─ .work/              調查、證據、快取與一次性工作
   │     │  ├─ dist/               舊建置與檢查資料
   │     │  ├─ Release/            原散落的舊版產物
   │     │  ├─ .codex/local/       舊發行筆記
   │     │  ├─ operations/         搬移腳本、驗證紀錄與乾淨副本
   │     │  └─ private-manifest.json
   │     ├─ development/ / review/ / scripts/ / security/ / src/ / work/
   │     │                         更早輪次的私有封存
   │     ├─ relocation-manifest.json
   │     └─ root-document-relocation.json
   └─ pre-upstream-v1.3.4-20260904/ 既有上游更新前私有封存，Git 忽略
```

### 檔案分類

根目錄只保留需直接識別或由工具依固定路徑讀取的檔案，不另存工作筆記：

| 根目錄檔案 | 用途與維護位置 |
| --- | --- |
| README.md、AGENTS.md、SECURITY.md、LICENSE | 使用者入口、代理強制流程、安全政策與授權；各自維護唯一責任，詳細指南由 INDEX 導覽 |
| package.json、package-lock.json、release.json | npm 入口及精確開發依賴、可重現安裝、產品與發行工具版本；不能只改其中一份版本宣告 |
| tsconfig.json、tsconfig.tests.json、tsconfig.tools.json | 共用嚴格設定及產品 DOM／測試 Node＋DOM／維護工具 NodeNext 環境；環境差異需要各自入口 |
| .prettierrc.json、.prettierignore | 格式選項及編輯器／一般 Prettier 的排除；正式 npm format 範圍由 scripts/format.mts 的固定白名單決定，不遍歷封存或產物 |
| .gitignore、.gitattributes | 隔離私有資料與生成產物、保持換行及原件位元組；忽略規則也是防止舊工具或私有證據再次進入 Git 的保護 |

以上設定留在工具慣用位置；新增設定前先查是否已有相同權責，任務專用腳本與紀錄依下節結案歸檔。歷史逐檔盤點由 [HISTORY](HISTORY.md) 追溯，不作第二份持續更新的配置清單。

| 分類 | 維護規則 |
| --- | --- |
| 現行公開檔案 | 正式來源、測試、可重用工具、指南與設定隨變更維護；現行 Release 發布後不回寫。`baseline/` 仍作來源歸屬基準，保持不變，不作 v2 建置／測試輸入 |
| 公開封存 | 歷史閱讀版、原始封裝、指定圖片與 TAR 可隨公開 checkout 取得；閱讀版只允許可由原件重建的已登記 URL 編輯，原始封裝、校驗清單、安全產物與證據保持原始位元組 |
| 本機現行資料 | 開發依賴、正式建置輸出及工作中的工具資料由 Git 忽略；有現行用途的依賴與生成產物不當成舊檔搬走 |
| 本機私有封存 | 已結案工作、舊工具、原始證據、私有清單與獨立 Git 快照保持忽略；不公開 payload，不作現行 v2 建置／測試輸入 |

正式工具不能僅因用途曾與舊議題有關就判為一次性工具。例如 IAB 收集器有現行指南與正式契約；PowerShell／Shell 驗證入口仍呼叫正式 `verify`。可重用工具留在 `scripts/`，已結案的任務專用腳本及舊依賴副本移入私有封存。歷史封存僅供比較與選擇性移植，不取代上游基準，也不得整包覆蓋現行來源。

### 工作資料與結案

只有已批准任務實際開始時才建立 `.work/` 等暫存位置；例如新 IAB 輪次使用 `.work/iab-testing/`，不能因目錄範例而恢復已停止工作。結案時將一次性工具、原始證據、操作紀錄及乾淨驗證副本收入按日期分類的私有封存；2026-10-20 清理的操作資料集中於上述日期目錄的 `operations/`。後續輪次使用自己的日期目錄與清單，不改寫舊輪次證據。

確認是否仍有舊檔，須同時核對實體檔案遍歷、Git 追蹤清單與忽略清單，不能只看 `git status`。現行 `dist/` 只保留上列三項正式輸出，過往 Release 應已移出現行 `Release/`；核對命令與保護規則見本指南的 [命令](#命令) 及 [文件登記與保護](#文件登記與保護)。原始位置、存取失敗、首次可讀雜湊與逐位元組比較須按實際證據分開記錄，不能補算未執行的核對。

修改原始碼使用 apply_patch，保留無關變更。現行指南使用繁體中文；歷史正文與已封存安全產物保持原狀。修改標題時保留被引用錨點；文件變更的檢查與結案規則見 [文件維護與結案](#文件維護與結案)。

內部收斂先以未修改實作通過具名行為契約，再機械式整理；新純比較助手只回傳事實，資格／基準／計數留在原呼叫端。保持原生 getter、參數、短路讀值、事件／註冊／清理與等待後驗證順序，不能因抽函式而提前快照狀態。單一用途小模型可與同用途契約共置；不以檔案數或行數當拆分目標，狀態與副作用的唯一所有者不變。

## Markdown 格式（GFM）

以 [GFM 規格](https://github.github.com/gfm/) 為語法依據，表格及提示另對照 GitHub 官方的 [表格說明](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-tables) 與 [Alerts 語法](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)。下列是專案的排版約定，不把所有格式檢查器偏好稱為 GFM 強制規定。

- 一份現行文件保留一個 `#` 主標題，依序使用 `##`、`###`，一般章節使用標題自動錨點。只有仍被受保護歷史正文引用的入口才保留相容 HTML 錨點；修改標題時核對引用及 requiredAnchors。歷史完整報告彙編可保留原始多篇標題，不為排版改寫證據。
- 標題、段落、清單、表格、引用及程式碼區塊之間保留一個空行。清單使用 `-` 或有序編號，巢狀項目依父項內容縮排；任務清單維持 `- [ ]`／`- [x]` 的實際狀態。
- 表格使用完整表頭與 `---` 分隔列；保留原有對齊方向，每列欄數一致。儲存格中的字面管線符號須跳脫為 `\|`，包含行內程式碼中的管線。中文長表格不靠大量補空白對齊。
- 指令、檔名、路徑與程式識別字使用行內程式碼；多行程式碼使用有語言標籤的圍欄。格式整理不修改程式碼內容、SHA-256、URL、版本、數量或原始測試輸出。
- 粗體使用 `**文字**`。結尾有標點、後面緊接中文字時，檢查解析結果；必要時在結束標記後加空格，例如 `**結果：** 通過`。不能只數星號判定已正確渲染。
- 使用有描述文字的 Markdown 連結，保留目標語意；CHANGELOG／TEST_REPORT 的儲存庫文件連結使用完整 GitHub URL。不要為統一格式改寫原生 URL、刪除必要歷史入口或把有效 Alerts 標記跳脫為字面文字。閱讀版搬移只允許經登記及驗證的 URL 編輯，原始正文另存快照。
- 整理範圍包含根目錄指南、`docs/`、測試文件及封存索引；現行與封存的發行原件、來源基準及不可變安全產物不改寫。既有封存正文保留，完整報告與維護／工具日誌只追加。
- 版本與歷史導覽由文件清單維護；歷史門檻標明版本。使用者工作範圍只在 TODO 維護，驗收結果只在 TEST_REPORT／原始證據維護；其他入口使用連結，不複製摘要。
- 格式驗證須涵蓋 GFM 解析、表格欄位、程式碼與連結保存、相對路徑／錨點及 `git diff --check`。Node 契約與瀏覽器功能測試不因單純排版而重跑，也不把文件檢查寫成產品驗收。

## 環境需求

- Node.js 26.8.1
- npm 11.19.0
- TypeScript 7.0.2、esbuild 0.28.2 及 `@types/node@26.6.4`（鎖定的開發依賴）
- 瀏覽器驗證只使用 Codex 內建瀏覽器及其中的 Tampermonkey，實際版本於每輪記錄

準備 Node／npm 後，在儲存庫根目錄執行 `npm ci`，安裝 [package-lock.json](../package-lock.json) 鎖定的開發依賴。[release.json](../release.json) 記錄發行工具版本。`verify` 先檢查實際執行的精確 Node 版本，以及產品版本、直接開發依賴宣告、lock 根目錄／解析版本與已安裝套件版本的一致性；TypeScript／esbuild 另須與 release 設定一致。檢查器 [project-config.mts](../scripts/project-config.mts) 唯讀、不執行套件、不連網；它核對套件版本，不能證明整個 node_modules 內容未被修改。`build` 仍檢查載入的精確 esbuild 版本。建置清單的 npm 版本取自設定，不獨立驗證執行中的 npm；直接以 Node 執行 verify 也不假裝測得 npm 版本。[package.json](../package.json) 沒有執行期依賴。

## 命令

```powershell
npm run typecheck     # 嚴格 TypeScript 檢查，不輸出檔案
npm run architecture  # 原始碼 AST 依賴圖及列出的所有權語法規則
npm run format:check  # 唯讀檢查正式來源、測試、工具與維護設定格式
npm run docs:check    # 離線唯讀檢查文件、權威清單、連結及保護基準
npm run archive:check # 唯讀核對公開搬移、原件、閱讀版及完整日誌基準
npm run archive:check -- --local # 加驗本機私有搬移；需要原始私有清單及 Git
npm run archive:check -- --json  # schemaVersion 1 機器結果；可與 --local 合用
npm run format        # 格式化上述維護範圍；代理修改仍按 AGENTS 使用 apply_patch
npm test              # 全部獨立契約套件，以及架構／匯入純度測試
npm test -- adapters  # 單一隔離套件
npm test -- suites/adapters  # 相容的套件別名
npm test -- --list    # 列出登記清單及來源，不打包／執行
npm test -- application --name "startup"  # 正規表示式篩選案例
npm test -- tooling   # 測試工具本身的契約
npm run compare:upstream -- --calibrate # 獨立離線比較環境校準，不加入正式 v2 登記
npm run compare:upstream -- --json # 完整兩版比較，schemaVersion 1；不連網、不改產品
npm run evaluate:diagnostics -- --json # 固定 v2.1.36 與工作來源的獨立診斷成本量測
npm run evaluate:diagnostics -- --profile --json # 獨立 CPU profile 與工作量計數，不作計時採用判定
npm run build         # 確定性的單一 IIFE 使用者腳本
npm run package       # 重建 dist，寫入設定的 Release/v<version>/
npm run verify        # 自動檢查及暫存封裝驗證
```

從儲存庫根目錄執行命令。`typecheck` 與 verify 共用 [typecheck.mts](../scripts/typecheck.mts)，依序檢查正式來源、測試及維護工具。[tsconfig.json](../tsconfig.json) 保留嚴格 DOM 環境並設 `types: []`；[tsconfig.tests.json](../tsconfig.tests.json) 加入 Node 型別、DOM 及使用者腳本全域宣告。[tsconfig.tools.json](../tsconfig.tools.json) 使用 NodeNext、Node 型別、可移除型別語法與明確型別匯入，涵蓋全部 `.mts` 工具。工具由既有 Node 直接執行，不新增轉譯載入器；Node 只移除型別、不讀取 tsconfig，另由 typecheck 檢查型別，依 [官方 TypeScript 文件](https://nodejs.org/api/typescript.html) 使用 `.mts` ESM、可移除語法及型別匯入；測試打包及匯入純度的暫存 `.mjs` 仍是生成產物。`architecture` 檢查正式模組；獨立的 `npm test -- architecture` 測試架構檢查器自身測試情境。判斷這些檢查能證明哪些不變量前，先閱讀 [架構檢查範圍](ARCHITECTURE.md#依賴方向)。

[verify.mts](../scripts/verify.mts) 檢查設定的 Node 版本、唯讀格式、公開封存、文件、typecheck、來源架構、全部測試、兩次建置的輸出／資訊清單一致性、JavaScript 語法、指定舊版／Worker 標記清單、必要儲存標記及封裝 SHA-256。封裝步驟會再建置一次。命令寫入 `dist/`，於新的 `dist/verify-package-*` 目錄封裝，確認解析後位置及前綴再刪除該目錄；不寫入 `Release/v<version>/`。

verify 不執行 Codex Security 或內建瀏覽器／Tampermonkey 驗收。安全敏感變更或使用者明確要求時，另行執行安全差異掃描；不要求每版掃描。上一版通過報告不能作為新本機變更的證據。

UP141 契約依能力分開：`npm test -- playurl-summary --name UP141-API`、`npm test -- measurement-state --name UP141`、`npm test -- application --name UP141`、`npm test -- control-center --name UP141`、`npm test -- orchestration --name UP141-DIAG`。測試版完整包含 A、三台預設關閉香港候選與預設關閉提前重試，驗證入口、取消、範圍、排序、設定及診斷生命週期；實機前不判定正式採用。操作表見 [UP141 測試版準備](../archive/retired/docs/UP141_TEST_RELEASE_2026-10-30.md)，本次不啟動 IAB／Tampermonkey 窗口。

`npm run evaluate:early-retry -- --json` 獨立執行六個固定模型情境，保存 policy／input SHA-256、逐案預測、held-out 未來供片、停頓及不必要重下載。退出碼 0 為門檻全通過、1 為效用 FAIL、2 為非法參數；不能把效用 FAIL 改為預期失敗或混入 verify 的全綠。測試工具無執行期依賴、不連網，不為取得介入放寬產品資格。它不能證明原生瀏覽器或實機效益。

`docs:check` 已納入 `verify`，以鎖定的 GFM 解析／格式及標題錨點套件執行，不讀取私有證據。預設輸出檔案、行號、規則及原因；`npm run docs:check -- --json` 輸出 schemaVersion 2 結果，包含 findings、legacyLinks、archivedReferences、私有證據未核對及外部連結未連線資料。archivedReferences 表示受保護原文中的原網址因搬移失效，另有登記封存目標；它不算有效現行連結。既有快照斷鏈另列 legacyLinks，不能宣稱歷史網址全部有效。

`archive:check` 的公開模式同樣納入 `verify`，依 [搬移清單](../archive/relocation-manifest.json) 核對 TAR 原件、發行與圖片原始位元組、閱讀版 URL 編輯及三份既有日誌完整正文。另驗舊路徑退出、Release 僅現行版及校驗清單；無 Git 的乾淨來源副本也可執行。`--local` 額外核對被忽略的本機搬移清單與私有檔案原始雜湊，公開 checkout 不含這些資料，預設不執行。兩個檢查命令的退出碼均為 0／1／2，分別代表通過、檢查失敗及非法參數；檢查不會搬移或改寫檔案。

### 原版與 v2 的獨立離線比較

[upstream-compare.mts](../scripts/upstream-compare.mts) 固定讀取並校驗既有 v1.3.4 原件與已發布 v2.1.27 完整腳本，每版／情境使用新 Node 子程序及模擬頁面。先執行 `npm run compare:upstream -- --calibrate`，再執行不帶選項的完整摘要或 `--json` 機器結果；未知或重複選項退出 2，失敗／無效退出 1，全部有效且適用斷言通過退出 0。

比較使用現有 FakeClock、記憶體 GM、固定單一 AVC、共同合法來源及前景模型；1／2 倍分開，60 秒健康前置後執行固定情境。進度是模型輸入，可信事件也是 Node 模型，不代表瀏覽器可信輸入或真實播放效果。原版缺少核心重載／還原能力的專屬斷言標為不適用，共同斷言仍執行。原件不能成為正式 v2 建置／測試輸入；`verify` 只執行不載入原件的中立工具契約，不執行兩版比較。

每個比較案例與清理各 5 秒、子程序外層 60 秒、輸出上限 32 MiB。頁面生命週期計時器／監聽器與未完成請求分開盤點，再由模擬頁面釋放；不以強殺程序或強清時鐘算通過，不取代產品元件 dispose 契約。比較工具不寫檔；若保存結果，使用按日期登記的公開調查報告及精確允許的合成 JSON，執行紀錄直接保存於被忽略的本機封存，不留 `.work` 或額外 `dist` 產物。結果入口由 [HISTORY](HISTORY.md) 維護。

### 安裝版還原觀察工具

[iab-installed-restore.mts](../scripts/iab-installed-restore.mts) 只在明確安裝後包裝目前文件的既有實例，不啟動產品控制器；[iab-installed-verdict.mts](../scripts/iab-installed-verdict.mts) 提供純可信尋位前提判定。匯入兩者都不建立網路、計時器或全域操作。瀏覽器仍須先依 [IAB_TESTING](IAB_TESTING.md) 校準與核對完整安裝身分，工具單元測試不授權網站窗口。

呼叫端以正確 executionContext 的 window registry 及唯一 key 保存 case slot，先登記再安裝；不把遠端 objectId 當唯一收集器參照。Native seeking、有限捕獲目標及可信操作修訂可成立時，opaque proof=null 本身不應排除；不得修改原生 getter、位置或倍速補造前提。SDK wrapper 只對同一合法意圖／階段／參數施加受控效果，其他呼叫保留 receiver、返回、例外及 accessor setter；只還原仍由工具擁有的描述子。

透明保留共用 RuntimeIdPort.next 的 ID 行為，建立時登記本內容週期的 request／startup／challenge；受控 EvidenceStore.record 使用拒絕寫入條件，其他工作原樣轉交。原始 ID、精確媒體 URL 與頁面物件只留記憶體，公開資料使用有界白名單投影及會話序號。記錄原始工具、輸入與完整執行腳本的 bytes／SHA-256；格式化後產物不能宣稱與實際載入 bundle 逐位元組相同。

觀察器最多四分鐘，呼叫端另保留六十秒清理；arm 九十秒、pending 八秒及固定硬截止不因 heartbeat 延長。媒體最多 1024 筆、工具事件 4096 筆、4 MiB；第一次終點保留，缺樣／截斷／超量都無效。使用 [IabEventCollector](../scripts/iab-event-collector.mts) 時明確注入 ownsPaused，僅管理可證明自有的攔截；releaseHolding 先清空 patterns，再排空同一游標及釋放自有請求，游標可延續到還原尾端。每次完整 await；持有請求時持續服務事件，不留跨工具呼叫的未完成 Promise。

清理盤點受控請求、route／probe／record Promise、SDK pending、Recovery token、Measurement 工作及記憶／持久證據。尾端全部收束後才移除寫入抑制；超過清理期限時保留 ID／寫入 guard 到自有文件卸載，恢復其他自有方法、解除計時器，結果記為 INVALID。資源退出與樣本隔離證明分開，不能清空學習或以舊快照回寫掩蓋缺口。具名工具契約列入 tooling；按日期結果由 [HISTORY](HISTORY.md) 追溯，是否續跑只看 TODO。

### 實際緩衝效用與採用判定工具

使用 `npm run evaluate:buffer-live -- --input "evidence.json" --json` 唯讀重播本輪 schemaVersion 1 證據。工具固定核對 d0c2c8c／v2.1.35、422022 bytes 與原件 SHA-256；不讀正式 GM、不連網、不重新計算產品 candidate。摘要與 JSON 分別提供窗口結果、十五／六十秒後續、配對、提前量及採用門檻。十二個窗口完整有效時退出 0，缺少窗口、無效或輸入錯誤退出 1，非法參數退出 2。退出 0 仍可能因事件不足得到 insufficient；不表示授權產品操作。

`evaluate:buffer-live` 的 `--serve` 是仍保存在來源中的歷史 loopback 校準模式；自 2026-10-31 起依永久禁令不得執行，不能把參數存在當成啟動授權。離線 `--input` 重播仍可依其契約使用。自有 HTML 直接開檔，檔案來源不能驗證的 HTTP 行為列為未驗證；實際安裝資料依 [IAB 唯讀窗口](IAB_TESTING.md#展示樣片選擇與唯讀窗口) 取得，不能以模型結果代替。

收集會話使用既有 Monitor／Routes 訂閱，只有工具自有的期限／租約計時器。binding 與 session 共用同一高精度起點；含六十秒前置時固定截止為 430000 ms，對齊餘裕不能縮短三百秒計分或六十五秒後續。`live-pump.mts` 的 host 狀態只保存資料，每次明確傳入當前分頁及 CDP capability，先排空、完整 await 八秒、再排空同一游標；不同分頁先拒絕，失效後不能靜默重啟。`drainRemoteSession` 拒絕 CDP 例外、跳號及截斷，重建白名單副本，並驗證固定截止、經過時間、租約餘額及清理狀態。排空期間不穿插其他工作，不能把已換頁參照封在舊閉包；呼叫端先核對完整執行身分。

公開輸出只留數值、布林、固定原因及會話內序號。cachedAlternatives 只是既有排名的觀察數量，alternative=null 表示沒有觀察到可驗證的新鮮替代資格；不能用排名代替提交時授權。工具與判定器的 Node 契約列入 tooling；目前瀏覽器能力是否通過、工作是否啟動，分別見原報告及 TODO。

#### 風險覆蓋與可介入性離線評估

在原命令加 `--risk`，例如 `npm run evaluate:buffer-live -- --input "archive/retired/docs/evidence/BUFFER_LIVE_EVALUATION_R2_2026-10-25.json" --risk --json`，即可重用既有證據，輸出原採用決策及另列的風險覆蓋。工具不重算歷史 candidate、不重跑網站；以左端有效樣本代表相鄰區間並裁切計分範圍，不外插。大於 1,500 ms 空隙、換身分、資料不足、不適用與緩衝分帶分列；零低緩衝暴露不能解釋成預警能力通過。

`npm run evaluate:buffer-live -- --supply --json` 執行固定十種供給情境的 1／2 倍共二十次整合案例。每次使用新子程序、FakeClock、記憶體儲存及真實 Monitor／Runtime／Recorder／Routes／Recovery；六十秒健康前置後觀察一百二十秒。只有合法完成且可依序追加的媒體區段才能補充緩衝，SDK reload／play 不會自動產生播放進度。輸出包含固定輸入、來源與情境雜湊、逐秒觀察、供給帳冊、斷言、退出碼及清理；工具 bundle 使用系統暫存目錄並釋放，不寫 `.work` 或額外 `dist`。

案例及清理各五秒、整組六十秒、子程序輸出 32 MiB；超時或缺少必要資料判無效。`--risk`、`--supply`、`--serve` 互斥，supply 不接受 input。非法參數退出 2；有效且全部適用契約通過退出 0；真實效用失敗或無效退出 1。正式 tooling 驗證工具正確性，獨立 supply 命令另外檢驗效用；因此完整 verify 通過仍可能伴隨 supply 的真實紅色結果，不能改寫期待使其轉綠。

可介入性只評估明確提供的唯讀條件；缺少派送前時機、新鮮成功、當前禁止或授權資格均標 unknown，不能從 cached ranking 補算。即使合成輸入得到 known-pass，`productActionAuthorized` 仍為 false，不構成選路授權。實際資料、合成資料與正常成本分開報告，合成結果不能補足實際採用門檻；效用失敗時停止於評估，不調整候選或救援。結果入口見 [HISTORY](HISTORY.md)。

`npm run evaluate:buffer-live -- --decision --json` 固定核對原十二窗的 bytes／SHA-256，重用原採用判定，另執行初始四秒緩衝的不足供給／完整回補配對，各自登記 1／2 倍。兩個子程序各持有兩個全新情境；案例及清理各五秒、整組六十秒、輸出 32 MiB。`--decision` 與 input、risk、supply、serve 互斥；不帶 json 顯示摘要，非法參數退出 2，效用失敗或無效退出 1。

配對分析器只檢查固定取樣點：共同觀察前綴內的預警也會出現在零候選正常對照；首次可區分樣本若為回補，仍須撤銷。它輸出可用取樣點的提前量上限，不複製 candidate 演算法，也不推斷所有未來訊號都無法區分。資料缺失、身分不合、非正常對照或取樣空隙只能 invalid，不能用來證明條件衝突。

決策器分開保留實際採用結論、效用斷言及可行性。只有實際門檻、效用與已知資格全部成立才建議進入受控原型；缺少資料時建議當下不採用，底層仍記 insufficient。觀察的排他衝突與目前候選紅色契約不能被單元測試通過掩蓋，評估輸出始終不授權產品操作或發布。輸入、逐案結果與來源雜湊由按日期報告保存；原十二窗不重跑，獨立命令的紅色不改為正式套件預期失敗。

### 緩衝影子效用與成本評估

`npm run evaluate:buffer-shadow` 執行真實 Monitor／Runtime／Recorder 的離線整合情境；加 `-- --json` 輸出 schemaVersion 1 的完整輸入、輸出、來源／情境雜湊、逐項斷言及清理。每案先暖機六十秒。判定器只分析觀察，不重寫產品緩衝演算法；正常對照出現候選是評估結果，不被改成零或直接視為產品錯誤。具名判定器及整合契約加入 tooling 套件。

`npm run evaluate:buffer-shadow -- --cost --json` 另以未修改的 v2.1.27／v2.1.28 完整腳本建立全新子程序／模擬頁面。每倍速有獨立六十秒套件，各含兩組不計分暖機及十組配對量測、交替版本順序；每次先六十虛擬秒健康播放，再量測十分鐘。每案與清理仍各五秒，輸出上限 32 MiB；超時／無效保留非零結果，不調寬期限。

兩命令退出碼為 0／1／2（契約成立且有效／斷言失敗或無效／非法參數）。只讀已發布原件及產品來源，不連外、不碰正式 GM、不新增依賴；中間打包使用系統暫存目錄並清理。功能與成本分檔保存；成本應獨立執行，避免與完整測試同時量測。啟動、tick、程序 CPU／heap 是本機模型數值，不設機器相關門檻，也不代表瀏覽器純功能開銷。來源與安裝版證據分列，樣片步驟見 [IAB 指南](IAB_TESTING.md#展示樣片選擇與唯讀窗口)，結果由 [HISTORY](HISTORY.md) 追溯。

新增 --cost-v3 --json 比較已發布 v2.1.28／v2.1.29；--cost-source --json 比較已發布 v2.1.29／當前確定性建置，臨時腳本有 bytes／SHA-256，不能冒充發布版。三種成本選項互斥，原 --cost 語意保持。功能輸出另列候選中斷區間與最後候選提前量，不合併原候選段或改寫十五秒後續。worker 候選／趨勢／斷言必須一致；收集器對過期、未來與所有者變動資料不作有效歸因。

`npm run evaluate:buffer-shadow -- --holdout --json` 獨立執行固定於 observation-inputs.mts 的外部輸入及效用門檻，各倍速使用新子程序；不混入原有功能清單。此選項與所有成本模式互斥。輸出包含凍結輸入與雜湊、完整逐案結果、候選連續性及清理。有效性與效用斷言分開；有效案例未達事前門檻仍須退出 1，不能因正式 verify 通過而轉算成功。既有缺口、真實退出碼與數據只看 [評估報告](../archive/retired/docs/BUFFER_OBSERVATION_OPTIMIZATION_2026-10-23.md#獨立保留情境)。

候選 v2 的兩秒確認原型未通過保留耗盡情境，未接入現行來源。可重播差異、具名契約、正確非零退出碼與來源基準集中於 [原型評估](../archive/retired/docs/BUFFER_CANDIDATE_CONFIRMATION_2026-10-23.md#驗證與重播)；僅在獨立副本套用。現行 evaluate:buffer-shadow 驗證目前來源，不能改寫未採用 v2 的結果；成本命令固定載入已發布腳本，版本及證據不可混算。

### 原始碼格式與靜態規則

Prettier 3.9.10 只作開發工具。固定格式為兩空格、單引號、無分號、100 字元行寬、LF 與尾端逗號；關閉嵌入語言格式化，保留測試字串及模板內容。格式工具使用明確維護清單，只遍歷正式來源、測試與工具，另含根目錄維護 JSON 設定；Release、封存、基準、私有證據、生成 JS 與依賴鎖定檔不寫入。輸出最多四次格式計算取得穩定內容，無法穩定時失敗；check 模式不寫入。

三個型別專案沿用 strict，並檢查未使用宣告／參數及明確型別匯入。移除多餘綁定仍保留初始化的副作用；既有位置參數使用明確未用名稱而不變更呼叫介面。本輪不加入 ESLint／typescript-eslint，TypeScript 7 保持既有精確版本，架構規則仍使用本機 AST。

## 診斷成本基準

`evaluate:diagnostics` 的 schemaVersion 2 固定核對 v2.1.36 完整腳本 bytes／SHA-256，並從固定 Git 提交獨立打包基準 Recorder；工作來源使用確定性建置。發布原件可位於現行或封存 Release，均不覆寫。工具保存產品、輸入與工具雜湊，結束再次核對工具未變更；需要該固定 Git 提交及本機原件，不連網取得替代輸入。

預設成本模式與 `--profile` 模式互斥；`--json` 只改輸出格式。正常完整腳本各倍速兩組暖機、十組交替計分，每次六十秒虛擬健康前置及六百個一秒 tick，逐 tick 完成 video／audio 請求。事故、容量及超大匯出使用獨立 Recorder 情境，不併入正常成本。成本與 profile 不並行，也不與其他測試同時量測；CPU、tick、heap 包含離線模型及宿主工作，不表示瀏覽器純功能成本。

profile 在隔離子程序使用 Node CPU profiler，並以可還原的 JSON／TextEncoder／structuredClone 包裝計數；預設成本模式不裝包裝。結果分開保存，不能用 profile 計時決定採用。`times`、startupMs、caseDurationMs 以毫秒、CPU 以微秒、heap 與工作量大小以 UTF-8 bytes 表示；預熱後的計數和六百筆計分樣本分列。每個案例包含清理實際不得超過五秒，每倍速／工作負載套件六十秒，監督程序保留 32 MiB 輸出限制；無效案例退出 1，非法參數失敗。退出 0 僅表示量測有效且行為摘要一致，不等於產品優化獲准。

`summary.timingAccepted` 要求兩倍速各十組至少八組 CPU 總量下降，且 tick 中位數／p95 的跨組中位數不增加；另須確認熱點工作量下降、逐步快照／報告及產品效果一致，才具備採用資格。方向不一致最多一輪相同規格確認，仍不足即撤回候選。回退後的工具校準不能算成第三輪候選採用。具名工具契約在 tooling，固定壓力情境在 diagnostics；結果由 [HISTORY](HISTORY.md) 追溯，不回寫已發布報告。

分位數沿用既有成本工具的排序後索引 floor((n−1)×p)；十組彙總使用下中位數。CPU 改善組數使用每個配對的 user＋system 原值，嚴格小於才算改善，不以 heap、單次最快值或跨輪合併代替。

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

### 原生校準與回歸

XHR 變更須以原生對照核對送出前後 abort、ByteString／USVString 一次轉換、轉換失敗後更正送出、跨 realm body 與同步重入。量測拒絕案例用獨立 Node 子程序觀察未處理拒絕，僅編譯本機 helper，明確管理 `FakeClock`、記憶體儲存及清理。既有案例與來源對照見 [CR 修復報告](../archive/retired/docs/CR01_CR05_FIX_REPORT.md)。

可信播放意圖的契約須涵蓋同播放器／媒體／內容、paused／ended／error、真正可見性、可信事件與清理後回呼；既有路線授權、拖曳、額度、死核心 4 秒、其他意圖 30 秒與重載後 15 秒仍適用。一般停滯另驗 6／12 秒、長 seek／未完成可信目標 15／30 秒及同段升級不重開起點／額度。目標捕獲與初始化例外須驗真正零、未知來源撤銷、每個副作用前重入及晚到完成；recovered 後再檢查 15 個一秒區段，該驗收不延後產品兩樣本成功判定。來源隔離、正常實際播放與有限失敗退出分列，不能以來源模型代替安裝版。現行工作與停止狀態見 [TODO](TODO.md)。

## 救援還原驗證

救援還原的來源契約可執行 `npm test -- adapters --name SR1`、`npm test -- adapters --name SR2` 與 `npm test -- application --name SR2`。SR1 保護 SDK 例外後的原生寫入所有權；SR2 的 Observer／Recovery 單元與真實元件整合分開登記，核對落地、一次補正、期限、新操作及十五秒播放。這些契約不代替 IAB 真實媒體或安裝版驗收。診斷目前讀模型的 `recovery.restoration` 僅包含 position／rate／progress 階段、sdk／native／none 通道，以及 pending／unknown／verified／mismatch 結果；不輸出不透明證明或播放器物件。

成功契約除 state 外還須核對原 action 的 source／保存目標及 reason，避免將失敗後的普通 playback-progress-observed 誤算成原還原成功。真實 Monitor／Runtime／Routes 閉環使用 `SR2-I-F01`；補正等待時段不算播放時間，SDK 快取前進而原生時間不前進、未知倍速、play getter 新操作及十五秒尾段復發各有拒絕對照。

## 唯讀緩衝趨勢診斷

影子規則及資格集中於 [PROJECT_CONTEXT](PROJECT_CONTEXT.md#唯讀緩衝趨勢)，所有權集中於 [ARCHITECTURE](ARCHITECTURE.md#依賴方向)。本功能只讀取 Monitor 已取得的媒體／控制快照及 Runtime 轉交的既有完成事件，不新增網路讀取器或計時器。

目前來源的報告唯一輸出為 recorder.bufferTrend，含 schemaVersion 6、algorithm buffer-window-v6、latest 與 history；歷史發布原件保持各自版本。讀取模型中的同名副本不重複輸出。每筆包含窗口時間、內插、進度品質、倍速、起訖緩衝、變化量、斜率、狀態、候選及固定原因碼；cycle 只輸出 netLossSec、creditMs、lastLossAgeMs、rangeTroughSec 四個有界數值或 null，不輸出內部峰值、物件或識別碼。cycle-draining-low 表示周期證據，即使八秒 state 為 stable／filling 仍可成立；cycle-loss-confirming、cycle-range-pending 與 refill-cycle-balanced 分開說明確認及範圍抑制。transport 只列已觀察完成的數量、bytes、跨窗口與覆蓋品質，不提供即時頻寬。

離線讀取器接受匹配的 v1～v6 標記，同一案例不得混合版本或重新解釋舊 candidate。即時 Recorder 只接納 v6 白名單投影；true 必須具備短期 draining-low、完整 cycle-draining-low、有效低緩衝或尾段證據，舊即時版本及失效證據拒絕。原周期契約使用 npm test -- domain --name buffer-v4、npm test -- diagnostics --name buffer-v4 及 npm run evaluate:buffer-shadow -- --cycle-holdout --json；原一百次情境仍用不帶模式選項的功能命令。各模式與所有成本／holdout 模式互斥，依倍速分案；首次提前量與最後候選空窗分開驗收。v4 原始效用保存在 [當時報告](../archive/retired/docs/BUFFER_CANDIDATE_V4_2026-10-24.md)，現行效用與限制只看 [TEST_REPORT](TEST_REPORT.md)，歷史期待及發布原件不回寫。

lowBuffer 輸出 basis（steady-decline／partial-cycle）、creditMs（0～2000）、declineCoverageMs（0～8000）及 v6 的 tailUsed 布林，沒有內部確認基準或識別碼。low-buffer-confirming 為 false，low-buffer-steady／low-buffer-cycle 必須為 true 且確認滿兩秒；慢下降要求完整八秒覆蓋，周期要求有效正欠量，兩者均要求目前校正緩衝不超過四秒。low-buffer-tail 為 true、low-buffer-tail-used 為 false；兩者均要求部分周期、已使用標記、兩秒確認／下降覆蓋及大於零且不超過一秒的緩衝。Recorder、離線驗證器及瀏覽器投影均核對版本與證據一致性，不能用新規則重算歷史 candidate。

使用 npm run evaluate:buffer-shadow -- --continuity --json 執行固定尾段與正常配對，與其他情境及成本模式互斥；同樣使用逐案子程序、五秒案例／清理、六十秒套件與 32 MiB 輸出界限。continuity-inputs.mts 固定輸入，tests-v2/fixtures/buffer-continuity-v5.json 保存原 v5 候選事實，不能當作第二份產品演算法。基準、情境及來源雜湊隨結果輸出；正式契約使用 domain／application／diagnostics／orchestration／tooling 的 --name buffer-v6 篩選。

持續性指標分列候選時間、首次與最後提前量、首次前／截尾後空白、觀察到的 false 間隔、末端空窗及最後十五秒覆蓋品質。缺樣、null 或換所有者不跨段連接；末端覆蓋不完整保持未判定。撤銷從第一個可觀察的持平／回補樣本算起；一秒固定樣本與不規則取樣分開，不把候選總時間解讀為撤銷延遲。新矩陣已參與設計評估，不稱為未見過的獨立保留組。

使用 npm run evaluate:buffer-shadow -- --low-buffer --json 重跑凍結於 low-inputs.mts 的主要配對與獨立保留組；它與其他情境／成本模式互斥，沿用逐案子程序、五秒案例與清理、六十秒套件及 32 MiB 輸出上限。初始緩衝明確輸入並用於全部六十秒健康前置。正式契約用 npm test -- domain --name buffer-v5、application／diagnostics／orchestration／tooling 同名篩選；完整比較另跑既有功能與 --cycle-holdout，分列首次／最後提前量、候選空窗、段數、時間、十五秒後續及清理。

Recorder 的內部容量檢查可直接序列化已去敏的自有資料，不先深複製整個快照；公開 snapshot 與 buildReport 始終使用 detached capture。這只減少診斷熱路徑工作，不改候選、淘汰順序、截斷計數、32 筆／8 KiB、128 KiB 或 96 KiB 上限。來源效能與發布版分開比較，不以 heap 或單次計時設跨機器通過門檻。

資料不足與不適用的 candidate 為 null；有效非候選為 false，候選為 true。樣本最多 32 筆，傳輸去重最多 128 筆。報告歷史含最新結果，受 32 筆及 8 KiB 雙重上限限制，實際可少於 32 筆。Recorder 128 KiB／匯出 96 KiB 上限維持，先移除趨勢歷史並記錄 bufferTrendEvicted／bufferTrendDropped；非法資料記 bufferTrendRejected。清除診斷只清報告，不重設觀察器、期限或額度。

重跑使用既有命令：npm test -- domain、npm test -- application、npm test -- diagnostics、npm test -- orchestration，再執行 npm run verify。具名案例與逐秒合成軌跡見 [本輪離線驗收](../archive/retired/docs/BUFFER_TREND_2026-10-23.md)。compare:upstream 固定載入原版及封存的已發布 v2.1.27 本體，不驗證本功能新來源。合成進度與候選不能換算為網站救援成功率或誤介入率；發布狀態只看 [TODO](TODO.md)。

## 建置輸出

[build.mts](../scripts/build.mts) 將 `src-v2/entry.ts` 打包成單一瀏覽器 IIFE，以 Chrome 120 為目標，不分割程式碼；前置 [使用者腳本中繼資料](../src-v2/metadata.txt) 並填入設定版本。輸出為 `dist/BiliCDN_TW.user.js`、外部原始碼對照及 `dist/build-manifest.json`。資訊清單記錄建置選項、輸入雜湊及使用者腳本雜湊。建置不會上傳產物。v2 來源不得加入執行期依賴、遠端程式載入、Worker 攔截或歷史 v1 匯入。

metadata.txt 中既有的 `@version` 是建置模板值；實際輸出由 release.json 覆寫，不能把模板數字或版本標頭單獨當成已發布／已安裝身分。核對發布版本時使用完整附件及實際載入本體的雜湊。

## 內建瀏覽器驗證

唯一執行方法與證據層級見 [IAB_TESTING](IAB_TESTING.md)；目前工作只看 [TODO](TODO.md)。本節不維護第二份校準、故障、清理或停止流程，也不構成開啟新窗口的授權。舊 real-chrome-validation 錨點只保留相容，不授權外部 Chrome。

[iab-event-collector.mts](../scripts/iab-event-collector.mts) 是注入 IAB capability 的主機端收集器，不自行連線、建立服務或計時器；契約歸 tooling。使用者負責單一游標、有界完整 await、樣本隔離及 finally 清理，詳細規則以 IAB_TESTING 為準。

### 剪貼簿驗證

原生與 GM 寫入邊界見 [SECURITY](../SECURITY.md#剪貼簿寫入邊界)，完整快照、可信寫入、讀回／真正貼上與復原流程見 [IAB_TESTING](IAB_TESTING.md#剪貼簿校準與保護)。通道不成立不能判產品失敗，歷史結果由 [HISTORY](HISTORY.md) 追溯。

## 封裝與發行

UP141 本次授權例外：v2.1.37 與 v2.1.38 均為「測試版／實機待驗證」，完整測試能力進附件，正式採用方案留待實機。為維持既有 latest 更新鏈，發布一般 GitHub Release 並明示測試用途，不設 prerelease；GitHub 狀態不是驗收結論。此次止於公開附件核對，安裝更新及專項等使用者準備好再開始，不重開原實機預算。

明確執行 `npm run package` 會建置，依 `release.json` 版本在 `Release/v<version>/` 寫入五項設定產物：

- `BiliCDN_TW.user.js`
- `CHANGELOG_v<version>.md`
- `TEST_REPORT_v<version>.md`
- `BUILD_MANIFEST_v<version>.json`
- `SHA256SUMS_v<version>.txt`

[package.mts](../scripts/package.mts) 覆寫這些具名檔案，不清空既有 Release 目錄。校驗值清單納入該目錄已存在的全部檔案，校驗值本身除外。封裝前檢查目標目錄；不得為了驗證已發布版本而執行此命令。暫存封裝驗證使用 `npm run verify`。

依 [AGENTS 發行規則](../AGENTS.md#發行規則)，本專案功能修復完成並通過必要自動及安全驗證後，預設自主提交、遞增修補版本、封裝、推送 main／標籤及發布 GitHub Release，不再等待使用者重複要求；當次明確限定只調查、文件整理或保留本機修改時遵守該範圍。完成後核對公開 latest 更新的版本、大小與 SHA-256。不得加入修補、CI/CD 或 GitHub Actions。本機封裝不等於發布。GitHub Release 附件只有使用者腳本，更新 URL 保持指向本儲存庫最新 Release。發布前執行 `npm run typecheck`、`npm run architecture`、`npm test`、`npm run verify` 及必要安全驗證。內建瀏覽器／Tampermonkey 驗收另行記錄，未執行的瀏覽器檢查不得寫成通過。

發布後先以內建瀏覽器的公開 latest 使用者腳本入口觸發既有安裝更新，再核對新文件實際執行身分；v2.1.21 已證明此路徑可用。不能只依歷史擴充功能介面限制就要求手動更新。只有當次入口確實受阻才交由使用者完成必要步驟；操作與證據要求見 [IAB 更新流程](IAB_TESTING.md#8-修復發布與後續執行)。

## 文件維護與結案

閱讀順序與各文件的唯一責任由 [INDEX](INDEX.md) 維護；本節依變更種類說明更新動作。只更新受影響的權威內容，其他入口以連結承接，不逐份複製狀態或驗收摘要。

<a name="documentation-update-map"></a>

### 文件更新對照表

| 修改內容 | 必要更新與條件 |
| --- | --- |
| 產品行為、模式、救援時機或資格 | 更新 [PROJECT_CONTEXT](PROJECT_CONTEXT.md) 與對應契約測試；涉及使用者操作、預設值或可見功能時，再更新 [README](../README.md) |
| 分層、內部介面、資料流、狀態或副作用所有權 | 更新 [ARCHITECTURE](ARCHITECTURE.md)；強制流程、不變量或授權界線改變時，再更新 [AGENTS](../AGENTS.md) |
| 信任邊界、敏感資料、儲存或網路安全要求 | 更新 [SECURITY](../SECURITY.md)；同時改變模組責任時，再更新 ARCHITECTURE |
| 新增或修改測試 | 更新測試來源；新增套件時登記 [test-registry.mts](../scripts/test-registry.mts)。命令、隔離、期限或清理規則改變時更新本指南；原測試行為或遷移對照改變時才更新 [MIGRATION](../tests-v2/MIGRATION.md) |
| 測試工具、建置工具或開發依賴 | 更新本指南，將實際驗證按日期追加至 [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md)；作者、依賴授權或工具用途改變時更新 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)，上游或來源基準改變時更新 [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) |
| 瀏覽器驗收方法 | 更新 [IAB_TESTING](IAB_TESTING.md)；實際結果與限制依證據層級記入 TEST_REPORT 或對應原始紀錄 |
| 工作範圍、停止、跳過或結案決定 | 工作狀態集中更新 [TODO](TODO.md)，其他入口維持連結；既有報告保留原觀察及限制 |
| 新增文件、改標題或導覽 | 更新 [doc-manifest.json](doc-manifest.json) 的登記或相容錨點，補上 INDEX、HISTORY 或對應指南的入口；依 [文件登記與保護](#文件登記與保護) 保留正文與舊連結 |
| 發布新版 | 依 [發布文件更新順序](#發布文件更新順序) 更新版本、變更、完整結果與工作狀態，並核對上列受影響指南 |

實測結果只維護 [TEST_REPORT](TEST_REPORT.md) 或對應原始紀錄；新增測試及本輪驗證不得改寫舊版發布時的案例數。普通修復不再分開建立 FIX／ACCEPTANCE／CONTINUATION 多份報告。必要獨立調查或設計紀錄保存於 `archive/retired/docs/`，檔名標示版本或日期並登記 HISTORY；同議題按日期追加，原判定及限制保留。`docs/` 維持現行文件用途。

<a name="release-documentation"></a>

### 發布文件更新順序

1. 換版前將上一版完整 [TEST_REPORT](TEST_REPORT.md) 正文原樣追加至 [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md)，保留日期、版本、原錨點導引及原始限制，再更新最新版固定入口。
2. 同步 [release.json](../release.json)、[package.json](../package.json) 及對應 [package-lock.json](../package-lock.json) 的版本設定；一般指南引用版本來源，避免逐份硬寫目前版本。
3. 更新 [CHANGELOG](CHANGELOG.md) 的本版行為差異及證據入口，保留舊條目；TEST_REPORT 保存新版完整證據，分列自動、安全、來源隔離及實際安裝結果。未執行、失敗、無效及依指示跳過的項目照實保留。
4. 更新 TODO 的交付／停止／結案狀態，依文件更新對照表核對受影響指南，不將完整發布摘要或測試數字複製到其他入口。
5. 封裝新版前，將前版 Release 按原始位元組歸檔至 `archive/retired/releases/Release/`，核對原件及校驗清單，再更新搬移清單與適用保護資料；`Release/` 只保留現行版本五項產物。搬移不重寫已發布快照或版本標籤。
6. 保留 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md` 兩個封裝輸入路徑；它們連至其他儲存庫文件時使用完整 URL，確保複製到 Release 後仍可閱讀。封裝及發布命令見 [封裝與發行](#封裝與發行)；檢查已發布版本時只使用暫存封裝，不回寫快照。

### 文件登記與保護

1. 新增公開 Markdown 時更新清單的分類、topics、versions、date 與導覽。versions 可含調查基準和交付版本；缺少可確認日期填 null，不推測執行時間。主題權威由 owners 唯一定義，清單不保存 PASS 數或工作狀態。
2. 清單 schemaVersion 為 1；documents.kind 分別標記指南、導覽、狀態、驗證、變更、日誌、版本紀錄、不可變快照與相容頁。protections 的 exact 禁止正文改寫；prefix 只允許追加。文字雜湊按 LF 正規化，二進位按原始位元組；不得改基準雜湊來消除失敗。
3. 修改標題先核對引用與 requiredAnchors；[HISTORY](HISTORY.md) 提供版本、議題、日期及封存入口。`TEST_REPORT_HISTORY`、`DOC_MAINTENANCE_HISTORY` 與 `TEST_TOOLING_REPORT` 三份日誌的全部既有正文只追加；搬移清單的完整基準補足原 prefix 保護之後的既有尾段。發行原件、baseline 與安全封存不回寫。
4. 失效連結例外只適用原檔雜湊相符的不可變文件，逐筆指定 source、line、url、sha256、reason；修復後刪除例外。歷史報告中的本機私有證據另以 privateEvidenceReferences 記錄相同精確欄位，只適用受保護原報告，無論本機是否有檔都列為未核對，不讀取私有內容。不得對現行文件、未知新錯誤或整個目錄設定豁免。
5. `archiveManifest` 連至公開搬移清單；歷史引用限制須精確符合 source、line、url、原檔 LF 雜湊及登記的 originalTarget／archivedTarget。現行指南及搬移閱讀版本身的連結必須有效，不能借歷史限制隱藏新錯誤。閱讀版只准修改原件中已解析的連結 URL，文字、程式碼、標題與結果均與 TAR 原文核對。
6. 搬移清單的 unchangedFiles 是本輪未改產品的證明。後續已授權產品變更先保存舊清單快照，再明確更新適用範圍；不得回寫歷史原件 entries、原始雜湊或既有 URL 編輯證據來消除失敗。

持續維護而未限定版本的指南、導覽與跨版彙編，清單的 versions 使用空陣列、date 使用 null，現行產品版本仍由 release.json 決定；不要保留已失去範圍意義的舊版標籤。固定來源／工具版本、明確日期的遷移對照與版本驗收文件保留其實際關聯。文件狀態改變時，同輪核對清單的分類與範圍，日期不是執行時間或驗收成功的替代證據。

整理現行 TODO 時，以目前工作、已結案項目、未啟動建議及停止邊界為主；歷史工作摘要移出現行狀態區前，保留可由固定提交還原的全文入口。受保護歷史報告的「尚未發布」「阻塞」仍描述原檢查點，後續完成只在允許追加的位置補導引；現行入口連向後續結果。日期、版本與議題三條 HISTORY 路徑要一起核對，不能只更新版本表。

### 文件檢查與結案

每次執行 `npm run docs:check`、`npm run archive:check`、人工事實核對與 `git diff --check`；有本機私有搬移時另執行 `npm run archive:check -- --local`。檢查器不能判定全部文字含義；仍須依程式核對預設值、模式、UI 名稱、安全與狀態所有權，確認使用者縮減／結案決策未被恢復。

新增工具時另執行型別、tooling 與 verify；單純文件修改不新增產品或瀏覽器通過宣稱。工具結果追加 TEST_TOOLING_REPORT，文件核對追加 [維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

docs:check 以 Git 已追蹤及未忽略的新 Markdown 為公開範圍；無 Git 的來源副本按明確公共目錄及清單的現行／封存 Release 目錄掃描，不遍歷私有 .work 或本機舊工具。它檢查 GFM、連結、唯一權威、兩次點擊、相容錨點、現行版本／npm 命令與正文保護。外部 URL 不連網；既有快照斷鏈、搬移後不可用原網址及歷史私有證據未核對數分開列出。未登記的私有證據連結即使本機有檔也會失敗。

只執行使用者批准範圍；文件整理不新增排程／CI/CD，不開安全掃描或瀏覽器窗口。

## 慢請求提前重試原型重現（分支限定）

此相容入口保留 2026-10-30 隔離原型的重現導覽。使用固定提交的 [原始重現程序](https://github.com/YUIAOI7592/BiliCDN_TW/blob/2a5851761d5a066cd3b54cb447b9da546a23187e/docs/DEVELOPMENT.md#慢請求提前重試原型重現分支限定)，並遵守目前永久禁令；本入口不恢復實機窗口。原型完整結果見 [歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。
