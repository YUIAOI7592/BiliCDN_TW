# 開發、測試與發行流程

本指南適用目前 `src-v2/`（版本以 [release.json](../release.json) 為準），瀏覽器測試**只使用 Codex 內建瀏覽器＋Tampermonkey**。具體操作、當輪案例範圍、背景校準與停止條件統一見 [IAB_TESTING](IAB_TESTING.md)，不維護另一份外部 Chrome 流程。

所有開發與驗證先遵守 [AGENTS 永久執行禁令](../AGENTS.md#使用者永久執行禁令)。既有命令若會啟動本機網站服務，不得執行；預覽直接開本機 HTML，不要求切換前景，測試保持無聲。歷史快照或封存中的工具不構成現行入口，前提不足依 IAB_TESTING 記錄限制。

依 [INDEX 閱讀路徑](INDEX.md#閱讀路徑) 確認本次工作所需指南；修改時查本頁的 [文件更新對照表](#文件更新對照表)。

## 儲存庫配置與封存維護

本節唯一維護目錄結構與檔案分類；INDEX 和封存索引只提供導覽連結。版本取自 [release.json](../release.json)，實際搬移項目與驗證結果由 [搬移清單](../archive/relocation-manifest.json)、[工具日誌](TEST_TOOLING_REPORT.md) 及 [維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) 追溯，不在此複製檔案數或工作狀態。

### 目錄結構

v2.2.15 的 application 依 routing／measurement／playback／playurl 歸屬控制器與契約；adapters 依 transport／player／playurl 分組，瀏覽器導覽、排程、可見性及 WebRTC 保留獨立邊界。模組責任與允許依賴見 [ARCHITECTURE](ARCHITECTURE.md#模組與所有權)。搬移同步更新正式匯入及工具來源；歷史原始碼連結依文件清單與封存清單保留固定基線或搬移對照。

以下列出主要目錄及關鍵檔案，以儲存庫根目錄為起點；`v<version>` 表示 `release.json` 的版本。主機專用目錄不隨公開 checkout 提供。

```text
./
├─ src-v2/                         正式產品來源，入口 entry.ts
├─ tests-v2/                       正式套件、回歸案例與測試輔助
├─ scripts/                        六個相容入口：build／package／test／verify 及兩個 verify 啟動器
│  ├─ checks/                      型別、架構、格式、文件、封存及配置檢查
│  ├─ testing/                     套件登記、監督、報告與匯入純度
│  ├─ evaluation/                  離線評估與唯一詳細操作 README
│  └─ lib/                         共用檔案與 TypeScript AST 支援
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
├─ tools/                          有明確現行用途的本機工具，按需建立、Git 忽略
├─ .work/                          活動任務及具體待釐清資料，Git 忽略
├─ .git/                           Git 管理資料
├─ .codex/                         本機工具目錄，可為空；Git 忽略
├─ README.md / AGENTS.md / SECURITY.md / LICENSE
├─ package.json / package-lock.json / release.json
├─ tsconfig*.json / 格式與 Git 設定
└─ archive/
   ├─ README.md                    封存導覽
   ├─ relocation-manifest.json     schema 2：原件、邏輯路徑、壓縮位置及歷史引用
   └─ retired/
      ├─ README.md                 退出流程資料導覽
      ├─ docs/                     可讀歷史報告、研究及追加日誌
      ├─ bundles/                  公開 TAR＋gzip 原件包，Git 追蹤
      └─ local/                    本機私有資料，Git 忽略
         ├─ bundles/               私有 TAR＋gzip 原件與還原證明
         ├─ <整理輪次>/private-manifest.json
         │                         私有位置、原件及本輪重建證明索引
         └─ 其他保留原件            已壓縮原件或待釐清資料，依清單判讀
```

### 檔案分類

根目錄只保留需直接識別或由工具依固定路徑讀取的檔案，不另存工作筆記：

| 根目錄檔案 | 用途與維護位置 |
| --- | --- |
| README.md、AGENTS.md、SECURITY.md、LICENSE | 使用者入口、代理強制流程、安全政策與授權；各自維護唯一責任，詳細指南由 INDEX 導覽 |
| package.json、package-lock.json、release.json | npm 入口及精確開發依賴、可重現安裝、產品與發行工具版本；不能只改其中一份版本宣告 |
| tsconfig.json、tsconfig.tests.json、tsconfig.tools.json | 共用嚴格設定及產品 DOM／測試 Node＋DOM／維護工具 NodeNext 環境；環境差異需要各自入口 |
| .prettierrc.json、.prettierignore | 格式選項及編輯器／一般 Prettier 的排除；正式 npm format 範圍由 scripts/checks/format.mts 的固定白名單決定，不遍歷封存或產物 |
| .gitignore、.gitattributes | 隔離私有資料與生成產物、保持換行及原件位元組；忽略規則也是防止舊工具或私有證據再次進入 Git 的保護 |

以上設定留在工具慣用位置；新增設定前先查是否已有相同權責，任務專用腳本與紀錄依下節結案歸檔。歷史逐檔盤點由 [HISTORY](HISTORY.md) 追溯，不作第二份持續更新的配置清單。

| 分類 | 維護規則 |
| --- | --- |
| 現行公開檔案 | 正式來源、測試、可重用工具、指南與設定隨變更維護；現行 Release 發布後不回寫。`baseline/` 仍作來源歸屬基準，保持不變，不作 v2 建置／測試輸入 |
| 公開封存 | 歷史報告與日誌維持可讀；大型證據、過往發行及政策原件以標準 TAR＋gzip 保存。原始位元組及校驗值保持，閱讀版只允許已登記 URL 編輯；保護不要求散落原位置永久存在 |
| 本機現行資料 | 開發依賴、正式建置輸出及工作中的工具資料由 Git 忽略；有現行用途的依賴與生成產物不當成舊檔搬走 |
| 本機私有封存 | 唯一證據、必要工具與 metadata 壓縮保存；可核對還原的依賴、Git 物件容器及驗證副本可清除。私有清單、檔名與內容不公開，不作產品建置／測試輸入；未知資料保留並列明缺口 |

正式工具依現行消費者與契約判定用途：PowerShell／Shell 驗證入口仍呼叫正式 `verify`，上游比較與提前重試評估保留。診斷與 IAB 專用工具已撤除，原碼由固定提交追溯，不保留正式可執行副本。其他已結案的任務專用腳本及舊依賴副本按私有封存規則處理。歷史封存不取代上游基準，也不得整包覆蓋現行來源。

### 工作資料與結案

正式建置、測試、檢查與評估入口維持在 `scripts/`。可獨立使用且具有明確現行消費者的本機工具放在根目錄 `tools/`，登記用途、輸入、依賴及離線使用方式；本機二進位與私有配置保持 Git 忽略，不建立第二套正式入口。沒有符合條件的工具便不建立佔位內容。Codex Runtime 由依賴工具取得，不複製進專案；已退役的 up141 Runtime 不再作為本機保留需求。

只有已批准任務實際開始時才建立 `.work/` 等暫存位置；不能因範例恢復已停止工作。結案先釋放自有資源，必要原件及操作紀錄保存於報告指定位置或已登記壓縮包；完成雜湊、來源及獨立還原核對後，才移除原位置與已證實可重建的副本。歷史報告中的舊位置描述當時狀態，現行查找使用封存清單；不能只改文件聲稱已搬移或清除，也不能把暫存目錄仍有原件當成案例未清理。

結案資料按任務與日期封存；相同內容只保存一份，私有索引維護原位置至原件的對照。一次性執行器隨證據保存，不因檔案可以執行便升格為現行工具。還原與 staging 副本完成核對後同批清理，避免整理本身持續產生大型暫存。未知用途或無法排除活動使用的項目原位保留並寫明缺口；不依日期自動刪除。清理報告分開計算 `.work` 減少量、封存增加量與整體淨減少量。

確認是否仍有舊檔，須同時核對實體檔案遍歷、Git 追蹤清單與忽略清單，不能只看 `git status`。現行 `dist/` 只保留上列三項正式輸出，過往 Release 應已移出現行 `Release/`；核對命令與保護規則見本指南的 [命令](#命令) 及 [文件登記與保護](#文件登記與保護)。原始位置、存取失敗、首次可讀雜湊與逐位元組比較須按實際證據分開記錄，不能補算未執行的核對。

全工作區整理另核對正式入口、CLI、測試登記、子程序及動態歷史輸入。沒有外部匯入不代表沒有用途；本檔契約、序列化、getter 與副作用須分別判讀。只能收回已確認無消費者的內部匯出，或刪除已證實無作用的支架，不為減少檔案數搬動慣例設定。根 node_modules 不手動裁剪，根 .git 只讀核對，不以 prune／清 reflog 整理歷史。產品無變更時維持版本，工具變更仍完成對應完整驗證。

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

- Node：原生 mts／ESM／型別移除、必要測試 API／選項與來源映射能力成立；不固定版本號或使用版本白名單。
- npm：保留既有命令與 package-lock，實際使用時記錄 CLI 路徑、版本與所選 Node；不假設 Codex bundle 一定附帶 npm，也不自動改用 pnpm。
- TypeScript 7.0.2、esbuild 0.28.2 及 `@types/node@26.6.4`（鎖定的開發依賴）
- 瀏覽器驗證只使用 Codex 內建瀏覽器及其中的既有腳本；管理器識別按任務需要查證，未取得的資訊明列未驗證，不作產品載入與接線查證的通用前置

Codex 作業每次先使用內建依賴工具 `load_workspace_dependencies` 取得當前 Node 路徑，再以該檔案啟動命令；取得失敗就記錄受影響工作，不默默改用系統 Node 或 `.work/up141`。需要 npm 時將所選 Node 目錄放在當次程序 PATH 首項，再以明確選定的 CLI 執行；不修改全域 PATH。Python 目前沒有正式程式、依賴配置或版本鎖定，需要時同樣取得 Codex 內建路徑。

一般使用者仍可從自己的 PATH 執行原 npm 命令，工具在 stderr 顯示實際 Node 版本與執行路徑，不冒稱為 Codex Runtime。`scripts/verify.ps1` 選擇順序為 `-NodePath`、`BILICDN_NODE`、PATH；`scripts/verify.sh` 為 `BILICDN_NODE`、PATH。路徑以獨立引數處理，支援空白；子程序退出碼傳回，工作目錄由啟動器管理。Windows 啟動器契約以目錄 dev／ino 身分核對 cwd，避免等價路徑大小寫造成誤判；空白路徑、參數及退出碼斷言保持。純 `test --list` 及其用法錯誤保留既有文字／退出碼契約，不啟動能力探測或增加身分列；JSON stdout 不混入環境文字。

[toolchain.mts](../scripts/lib/toolchain.mts) 共用能力判定、測試選項與 `node24` 語法目標；後者不是執行器版本閘門，也不隨目前 Node 自動提高。verify 與完整測試入口以所選 Node 啟動一個最多五秒的隔離 mts 探測，核對具名成功、位置、完整報告、退出及父子版本一致；探測不計入正式案例。同一程序共用已完成 Promise，匯入不啟動探測，成功與失敗均檢查並清理專屬暫存目錄。能力不足明確失敗，不下載或切換 runtime，也沒有略過開關。通過探測只代表可進入驗證，完整 verify 才是本次環境的完成門檻；未來版本與其他平台不因一次通過便自動取得相容結論。

準備所選 Node／npm 後，日常乾淨安裝仍使用 `npm ci` 與 [package-lock.json](../package-lock.json)。乾淨安裝的實際驗證範圍見 [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md)，不能由設定一致性檢查推定。[release.json](../release.json) 只保存產品版本、附件名稱及鎖定 TypeScript／esbuild 版本。verify 核對產品版本、九項直接依賴宣告、lock 根目錄／解析版本及已安裝版本的一致性；[project-config.mts](../scripts/checks/project-config.mts) 唯讀、不執行套件、不連網，不能證明整個 node_modules 內容未被修改。build 檢查載入的 esbuild 及已安裝 TypeScript 精確版本；建置清單保存實際 Node、載入 esbuild 與核對後 TypeScript 資訊，不宣稱 build 已執行型別檢查，也不填入未使用的 npm。npm 的實際使用另記當輪工具日誌，歷史清單不回寫。[package.json](../package.json) 沒有執行期依賴。

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
npm run build         # 確定性的單一 IIFE 使用者腳本
npm run package       # 重建 dist，寫入設定的 Release/v<version>/
npm run verify        # 自動檢查及暫存封裝驗證
```

從儲存庫根目錄執行命令。`typecheck` 與 verify 共用 [typecheck.mts](../scripts/checks/typecheck.mts)，依序檢查正式來源、測試及維護工具。[tsconfig.json](../tsconfig.json) 保留嚴格 DOM 環境並設 `types: []`；[tsconfig.tests.json](../tsconfig.tests.json) 加入 Node 型別、DOM 及使用者腳本全域宣告。[tsconfig.tools.json](../tsconfig.tools.json) 使用 NodeNext、Node 型別、可移除型別語法與明確型別匯入，涵蓋全部 `.mts` 工具。工具由既有 Node 直接執行，不新增轉譯載入器；Node 只移除型別、不讀取 tsconfig，另由 typecheck 檢查型別，依 [官方 TypeScript 文件](https://nodejs.org/api/typescript.html) 使用 `.mts` ESM、可移除語法及型別匯入；測試打包及匯入純度的暫存 `.mjs` 仍是生成產物。`architecture` 檢查正式模組；獨立的 `npm test -- architecture` 測試架構檢查器自身測試情境。判斷這些檢查能證明哪些不變量前，先閱讀 [架構檢查範圍](ARCHITECTURE.md#依賴方向)。

[verify.mts](../scripts/verify.mts) 檢查 Node 必要能力、唯讀格式、公開封存、文件、typecheck、來源架構、全部測試、兩次建置的輸出／資訊清單一致性、JavaScript 語法、指定舊版／Worker 標記清單、必要儲存標記及封裝 SHA-256。封裝步驟會再建置一次。命令寫入 `dist/`，於新的 `dist/verify-package-*` 目錄封裝，確認解析後位置及前綴再刪除該目錄；不寫入 `Release/v<version>/`。

verify CLI 以失敗套件、階段及原因摘要呈現彙總錯誤，退出碼仍為 1；不再次傾印附帶的完整測試 outcome。verify 不執行 Codex Security 或內建瀏覽器／Tampermonkey 驗收。安全敏感變更或使用者明確要求時，另行執行安全差異掃描；不要求每版掃描。上一版通過報告不能作為新本機變更的證據。

UP141／CC39 契約依能力分開：npm test -- application --name CC39、npm test -- control-center --name CC39，另保留 UP141-API／START／PROBE／ROUTE／RETRY 回歸。總覽吞吐、起播等待、探測及播放入口摘要由 `control-center` 套件的現行案例驗證，只讀功能狀態，不要求診斷歷程或報告。三個保留功能開關與 HK 預設開啟、明確 false 保留；起播提前放行、中段探測及家族分散固定啟用，舊三欄位忽略且正常保存時淘汰。codec／verbose／手動及定向能力完整移除。修復先重現失敗，重構先固定原行為；離線效用與必要安全掃描獨立於 verify。舊操作表僅適用 v2.1.38，不是新版入口或續跑授權。

選路固定合成場景以 `npm run evaluate:routing` 執行，範圍、最壞上限記帳及結果限制見[選路模型對照](../scripts/evaluation/README.md#選路模型對照)。

v2.2.12 的 `--optimization` 補充模式、提前重試資格對照及私有取證方法契約見[優化補充模型](../scripts/evaluation/README.md#v2212-優化補充模型)；模型完成與原六情境效用 FAIL 分開記錄。

提前重試離線效用的固定輸入、退出碼及證據限制見 [評估指南](../scripts/evaluation/README.md#慢請求提前重試)。

`docs:check` 已納入 `verify`，以鎖定的 GFM 解析／格式及標題錨點套件執行，不讀取私有證據。預設輸出檔案、行號、規則及原因；`npm run docs:check -- --json` 輸出 schemaVersion 2 結果，包含 findings、legacyLinks、archivedReferences、私有證據未核對及外部連結未連線資料。archivedReferences 表示受保護原文中的原網址因搬移失效，另有登記封存目標；它不算有效現行連結。既有快照斷鏈另列 legacyLinks，不能宣稱歷史網址全部有效。

`archive:check` 的公開模式納入 verify，核對公開壓縮包、原件、歷史閱讀版 URL 編輯、三份日誌及當前 Release；公開封存檢查不要求 Git 或私有資料。`--local` 額外核對私有包、原位保留檔與本輪已保存的重建證明，需要 Git 追蹤／忽略狀態。`--restore-root` 逐檔唯讀核對已解壓的 payload 與包內清單；結果仍使用 schemaVersion 1，另列 packedFiles、reconstructedFiles、reconstructedChecksumTargets 及 restoreChecked，重建證明與新讀到的原件不混稱。退出碼仍為 0／1／2；檢查器不解壓、刪除或改寫資料。

封存清單 schema 2 以 bundles 登記壓縮檔大小／SHA-256、TAR 輸出大小、包內索引及各成員原件證明；邏輯路徑保持，位置改為實體檔或包成員。原 schema 1 與舊清單原件仍可核對；原本 `archive/retired/releases/Release/`、`originals/` 及日期私有目錄可只存在於清單與還原內容中。公開 schema 2 清單以 `localManifestProof` 固定主私有清單 `localManifest` 的大小與 SHA-256；`--local` 先核對該證明再解析，且不允許主私有清單降回 schema 1。額外輪次清單由 `additionalLocalManifests` 登記路徑，依各自 schema 核對內容；目前不逐份提供上述公開雜湊證明或同一降級限制。預設公開模式不讀私有索引或檔名。跨輪整理先保存舊清單，歷史刪除表不當成永久新增的資料保留義務。

### 壓縮、清理與還原

新原件包使用標準 TAR＋gzip，公開／私有分開，依任務分包，目標每包未壓縮內容不超過 256 MiB，單一大型原件獨立保存。固定容器排序、時間及權限欄位，原件本身不改寫；包內保留相對路徑、大小、SHA-256、來源及必要時間資訊。已有 gzip／ZIP 等原件先核對完整性與重複性，保留一份，不為整齊再套壓縮。

清理前建立完整清單並區分原件、可重建副本及未知資料。舊依賴在隔離目錄以精確鎖定來源重建，不執行舊安裝腳本、不動根 node_modules；差異保留原件。Git 副本檢查 refs、index、工作差異及不可達物件，主倉庫穩定提交以外的必要物件另存救援包並做獨立還原；不只執行 bundle --all。原件逐位元組還原與 Git 物件等價重建分開記錄，不承諾重建相同的快取 pack 排列。

順序固定為壓縮、獨立解壓、逐檔比對、新清單驗證，最後才刪除原件。路徑須限定核對後的專案／暫存根，拒絕連結、路徑逃逸、重複成員、超量輸出及目標衝突；失敗保留原件及操作紀錄。TAR 只接受已支援的標準 PAX 路徑、大小與被動中繼資料，拒絕未知解讀欄位及覆蓋未使用的局部延伸標頭。私有大檔以串流核對，僅明確指定且有上限的驗證 metadata 可載入；不執行封存的程式或恢復舊測試窗口。

以下還原公開包；目的地必須是新空目錄。依當次 Runtime 選擇規則執行 npm；先檢查包，再用標準 tar 解壓，最後核對解壓內容。私有還原另先通過 `--local`，並把私有包解至同一新目錄，最後使用 `--local --restore-root`。不要解回現行來源或 Release。

```powershell
npm run archive:check
if ($LASTEXITCODE -ne 0) { throw 'Archive validation failed' }
$archiveRestore = Join-Path (Get-Location).Path '.work/archive-restore'
if (Test-Path -LiteralPath $archiveRestore) { throw 'Choose a new empty directory' }
New-Item -ItemType Directory -Path $archiveRestore | Out-Null
Get-ChildItem -LiteralPath archive/retired/bundles -Filter '*.tar.gz' | ForEach-Object {
  & tar -xzf $_.FullName -C $archiveRestore
  if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed' }
}
npm run archive:check -- --restore-root $archiveRestore
```

本機壓縮不是異機備份，刪除／壓縮容量不包含 Git 歷史減重。保留既有 Git 歷史與標籤，不執行強制推送、歷史重寫或廣域清空；未知項目列出缺口，不為達成容量目標勉強刪除。

### 原版與 v2 的獨立離線比較

詳細操作、輸入、期限與判定見 [離線評估指南](../scripts/evaluation/README.md#原版與-v2-的獨立離線比較)。

### 原始碼格式與靜態規則

Prettier 3.9.10 只作開發工具。固定格式為兩空格、單引號、無分號、100 字元行寬、LF 與尾端逗號；關閉嵌入語言格式化，保留測試字串及模板內容。格式工具使用明確維護清單，只遍歷正式來源、測試與工具，另含根目錄維護 JSON 設定；Release、封存、基準、私有證據、生成 JS 與依賴鎖定檔不寫入。輸出最多四次格式計算取得穩定內容，無法穩定時失敗；check 模式不寫入。

三個型別專案沿用 strict，並檢查未使用宣告／參數及明確型別匯入。移除多餘綁定仍保留初始化的副作用；既有位置參數使用明確未用名稱而不變更呼叫介面。不加入 ESLint／typescript-eslint，TypeScript 7 保持既有精確版本，架構規則仍使用本機 AST。

## 新增行為

1. 純粹的資格／排名邏輯放在 `domain/`，明確傳入時鐘。
2. 持久或工作階段資料放在型別化狀態儲存元件。
3. 可改變選路、量測或恢復的動作透過控制器方法提供。
4. 瀏覽器差異留在適配器，GM 儲存透過 `platform/storage.ts`；UI 管理自己的 DOM 及呈現生命週期。
5. 功能協作使用型別化事件；UI 只讀當前狀態快照。
6. 在 `tests-v2/suites/` 對應獨立套件，或不依賴瀏覽器的 `tests-v2/domain-boundaries.ts` 新增具名 `node:test` 契約。新套件登記於 `scripts/testing/test-registry.mts`。

修改執行期邏輯前，先以領域層、控制器或適配器契約固定預期行為：修復缺陷先重現失敗，保持行為的重構先確認原實作通過，不為重構虛構失敗。親和主機變更只由 `RouteCoordinator` 執行，主動探測只由 `MeasurementController` 啟動，核心重載只由 `RecoveryController` 執行。等待後及儲存鎖回呼函式內保留生命週期檢查；只使用計時器介面不能避免舊工作提交。

### 依變更選擇驗證範圍

| 工作 | 必要門檻 | 不由此自動追加的工作 |
| --- | --- | --- |
| 純文件／驗收紀錄 | docs:check、人工事實與 GFM／差異核對；封存或追加日誌維護另依本指南執行 archive:check | 不升版，不重跑產品測試、安全掃描或瀏覽器；文件通過不表示產品通過 |
| 來源、測試或工具變更 | 修改前相應契約、修改後對應套件及完整 npm run verify；正式發布亦須通過最終差異的 verify | verify 已包含 typecheck、architecture、全部測試及其餘檢查，同一最終差異不必另行重跑；不刪案例或降低斷言 |
| 安全敏感差異／明確安全審查要求 | 依固定差異與風險執行 Codex Security；自動 verify 不包含此證據 | 不把每次文件修正或一般版本更新都變成全庫掃描 |
| 正式發行 | 已授權範圍完成，必要自動／安全驗證通過；封裝及公開 main／標籤／唯一附件／latest 大小與雜湊核對 | 發行成功不代表安裝驗收；獨立未啟動的效益研究不作發布前置 |
| 已安裝版本的身分／接線查證 | 依 [IAB 門檻適用表](IAB_TESTING.md#門檻的適用範圍) 逐項取得當前載入及執行證據 | 不要求讀管理器資料、重新安裝、完整故障矩陣或將所有 N 契約再做一遍 I 驗證 |
| 行為、故障或效益驗收 | 按當次指定層級、案例、斷言、期限與安全前提執行；缺口及清理逐項判定 | 不以本體一致或離線測試代算安裝動態成功，也不因一個缺口否定其他獨立證據 |

每項門檻須指明它保護的契約及適用變更；N／S／I 是不同證據，不是所有工作都必須依序通過的三級關卡。已明確要求的測試維持，新增案例按具體差異或缺陷決定，不以「仍可多驗證」作為無限擴張理由。單項命令仍供開發定位使用；完整 verify 沿用原執行器、測試選擇及退出碼，通過前置單項不能代替它，通過後沒有新差異或未解問題便不重複執行。

<a name="test-suites-and-isolation"></a>

## 測試套件與隔離

各套件使用本地具名建立函式與窄資源工具，每案只建立需要的資源與狀態轉移；不以數字 scenario 分派，不由一個完整案例的建立函式呼叫另一個完整案例，也不透過原型繼承可變情境。閉包中的可變欄位以明確存取器轉交，不以物件展開凍結 getter 讀值。testScope(t) 管理當案清理，全域替換沿用 defineGlobal()；歷史對照及各版變更見 [MIGRATION](../tests-v2/MIGRATION.md)。

[test-registry.mts](../scripts/testing/test-registry.mts) 明確登記下列 18 個套件。支援工具、暫存測試情境及封存資料不透過萬用字元模式（glob）執行：

| 套件選擇器 | 涵蓋範圍 |
| --- | --- |
| `architecture` | 架構檢查器規則 |
| `imports` | 非入口模組匯入純度 |
| `tooling` | 測試執行器、報告、資源及工具行為 |
| `domain-boundaries` | 純政策／輸出邊界 |
| `domain` | 領域行為 |
| `state` | 設定、限制、證據及簽名路線狀態 |
| `application` | 選路、量測及恢復契約 |
| `adapters` | 瀏覽器適配器行為 |
| `native-routing` | Catalog／Native 選路及來源授權 |
| `native-transport` | Catalog／Native 傳輸及請求處理 |
| `orchestration` | 組合、生命週期及命令協調 |
| `adapter-boundaries` | 導覽所有權及 Range 讀取器契約 |
| `measurement-state` | 量測中繼資料及舊鎖回呼函式 |
| `progressive-playurl` | MP4／FLV 容器、分段身分、原子輸出及 DASH 行為維持 |
| `progressive-routing` | Catalog 來源不透明識別碼、完整候選池、備援上限及設定競態 |
| `progressive-transport` | MP4 Fetch／XHR 輸出、共用起播窗口及停用模式 |
| `playurl-summary` | 型別化接納結果、安全最近摘要、狀態語意、生命週期及摘要隱私 |
| `control-center` | Catalog 單節點更新、遠端設定合併、非同步視圖與焦點所有權、BR-10 鍵盤隔離／預設操作／清理及過期視圖 |

使用 `npm test -- <selector>` 執行單一套件；執行器也接納 `suites/<selector>` 別名。`npm test -- architecture` 執行 AST 規則測試情境，`npm test -- imports` 執行匯入純度測試，`npm test -- tooling` 使用暫存測試情境驗證測試工具。完整 `npm test` 執行這三項與全部契約套件。

[scripts/test.mts](../scripts/test.mts) 逐套件打包為帶內嵌原始碼對照的 `.mjs`，使用 `--enable-source-maps` 與 `--test-isolation=none` 在獨立 Node 子程序執行，每次只傳入一份套件檔案，案例依序執行。每案例及清理掛鉤預設期限為 5 秒；外層每套件硬期限為 60 秒。逾時或 stdout／stderr 合計超過 32 MiB 時，終止所屬程序並等待退出，再處理其他套件。正常完成不強制退出，未清理的週期計時器因而會在硬期限被判失敗。

終端採原生 `spec` 報告產生器；[JSON 報告產生器](../scripts/testing/test-reporter.mts) 從 Node 事件產生有版本的案例數、耗時、狀態及失敗名稱／位置／訊息／堆疊資訊。程式判定不解析人類可讀文字；退出碼、摘要與案例狀態必須一致。打包、測試、清理、逾時、超量輸出及摘要缺失／損壞均為失敗；收集其他套件後由 `runTests()` 拋出彙總錯誤。退出碼：通過為 `0`，上述失敗為 `1`，非法參數或名稱零命中為 `2`。CLI 在建立暫存目錄前驗證套件／參數／正規表示式；--list 不與套件選取或 --name 合用。完整執行禁止空套件、僅執行標記（`only`）、略過（`skipped`）、待實作（`todo`）、取消（`cancelled`）；`--name` 允許未命中案例不執行，但總選取至少須實際執行一個案例。結果隨已驗證父目錄及前綴的暫存目錄清理。

匯入純度涵蓋所有非入口、非宣告模組；停用未使用程式碼移除（tree shaking）並忽略打包最佳化註記，保留原全域陷阱及 `Date.now`／`Math.random`。陷阱在不載入 `node:test` 的獨立 Node 子程序執行，內層期限為 3 秒，由外層具名案例監督。它只檢查頂層匯入，不檢查後續方法呼叫。

各案例獨立建立測試情境；前置狀態轉換由建立函式重建，同情境的多個斷言留在同一案例。使用原生 `assert.ok`、`assert.strictEqual`，保留 JSON／字串／身分比較。案例數描述情境，不能換算為舊版功能斷言數；[遷移對照](../tests-v2/MIGRATION.md) 保存原行為、分支及矩陣，實測見 [工具驗證紀錄](TEST_TOOLING_REPORT.md)。

共用 [測試資源範圍](../tests-v2/support/scope.ts) 使用 `testScope(t)`，立即以 `t.after()` 登記清理。`own()`、`defer()` 支援同步／非同步釋放，依反向登記順序執行；一項失敗仍完成其餘清理與全域還原，彙總錯誤。`dispose()` 可重複呼叫。全域替換必須經 `defineGlobal()`，保存第一次修改前的完整屬性描述子。測試資源範圍不包裝全域計時器；計時器、攔截、訂閱及取消函式由所屬資源或測試明確登記清理。模擬介面使用 `satisfies`，不得以 `as never` 繞過型別。

[FakeClock](../tests-v2/support/clock.ts) 保留固定起始時間，拒絕無效延遲、零或負數的週期計時器間隔及重入推進，提供待執行數量。相同時間計時器依登記順序執行，獨立微任務佇列於下一個計時器前處理；每次推進最多 10,000 次回呼函式。釋放／取消後不再執行。以 [deferred](../tests-v2/support/deferred.ts) 或測試情境的完成訊號等待非同步工作，保留拒絕及取消路徑。`BrowserScheduler` 契約可使用少量真實事件迴圈，依完成訊號判定。

不得在正式打包產物加入公開測試橋接介面；測試從 TypeScript 來源獨立打包。

各領域案例位於 tests-v2/cases 的 routing、playurl、transport、playback、state、ui、tooling 功能群組，由既有套件明確依序匯入；套件選擇器與註冊順序保持。測試定義檢查追查靜態執行期匯入圖，逐檔檢查具名 node:test 與 only；純型別匯入不提供案例，空入口仍拒絕。調查目錄只保存原證據，不能成為正式測試輸入。原生 XHR 替身須區分送出前後 abort、同步 setter／open 例外及重入所有權；鍵盤替身分開事件種類與網站提交階段，指標 closest 只查祖先。可信事件模型不能替代實際瀏覽器輸入。控制中心替身須模型化事件路徑、capture／bubble、取消旗標與 listener 移除；模型的預設啟動不等於瀏覽器原生啟動。修改 Enter／Space 行為或當次要求其瀏覽器驗收時，另於自有隔離頁及指定影片的實際快捷鍵環境，以可信按鍵驗證；來源 UI 使用記憶體依賴且不替換安裝 singleton。這些 S／I 結論各自需要實測，不因無關文件或身分查證而自動重跑。

修改內容識別須涵蓋 cid 請求所有權、低信任來源、父目錄集合與容量；修改恢復須涵蓋精確期限、最新目標、拖曳、生命週期、政策與晚到 Promise。案例以正確契約斷言，不只斷言錯誤行為存在。修復前失敗與修復後通過紀錄分開保存。

### 原生校準與回歸

XHR 變更須以原生對照核對送出前後 abort、ByteString／USVString 一次轉換、轉換失敗後更正送出、跨 realm body 與同步重入。量測拒絕案例用獨立 Node 子程序觀察未處理拒絕，僅編譯本機 helper，明確管理 `FakeClock`、記憶體儲存及清理。既有案例與來源對照見 [CR 修復報告](../archive/retired/docs/CR01_CR05_FIX_REPORT.md)。

可信播放意圖的契約須涵蓋同播放器／媒體／內容、paused／ended／error、真正可見性、可信事件與清理後回呼；既有路線授權、拖曳、額度、死核心 4 秒、其他意圖 30 秒與重載後 15 秒仍適用。一般停滯另驗 6／12 秒、長 seek／未完成可信目標 15／30 秒及同段升級不重開起點／額度。目標捕獲與初始化例外須驗真正零、未知來源撤銷、每個副作用前重入及晚到完成；recovered 後再檢查 15 個一秒區段，該驗收不延後產品兩樣本成功判定。來源隔離、正常實際播放與有限失敗退出分列，不能以來源模型代替安裝版。現行工作與停止狀態見 [TODO](TODO.md)。

## 救援還原驗證

救援還原的來源契約可執行 `npm test -- adapters --name SR1`、`npm test -- adapters --name SR2` 與 `npm test -- application --name SR2`。SR1 保護 SDK 例外後的原生寫入所有權；SR2 的 Observer／Recovery 單元與真實元件整合分開登記，核對落地、一次補正、期限、新操作及十五秒播放。這些契約不代替 IAB 真實媒體或安裝版驗收。總覽讀模型的 `recovery.restoration` 僅包含 position／rate／progress 階段、sdk／native／none 通道，以及 pending／unknown／verified／mismatch 結果；不輸出不透明證明或播放器物件。

成功契約除 state 外還須核對原 action 的 source／保存目標及 reason，避免將失敗後的普通 playback-progress-observed 誤算成原還原成功。真實 Monitor／Runtime／Routes 閉環使用 `SR2-I-F01`；補正等待時段不算播放時間，SDK 快取前進而原生時間不前進、未知倍速、play getter 新操作及十五秒尾段復發各有拒絕對照。

## 建置輸出

[build.mts](../scripts/build.mts) 將 `src-v2/entry.ts` 打包成單一瀏覽器 IIFE，以 Chrome 120 為目標，不分割程式碼；前置 [使用者腳本中繼資料](../src-v2/metadata.txt) 並填入設定版本。輸出為 `dist/BiliCDN_TW.user.js`、外部原始碼對照及 `dist/build-manifest.json`。資訊清單記錄建置選項、輸入雜湊（包含實際前置的 metadata.txt）及使用者腳本雜湊。建置不會上傳產物。v2 來源不得加入執行期依賴、遠端程式載入、Worker 攔截或歷史 v1 匯入。

metadata.txt 的 `@version` 使用唯一的 `__VERSION__` 占位符，由 release.json 注入；缺少、重複或混用數字版本宣告時拒絕建置。版本標頭不能單獨證明已發布／已安裝身分；核對時使用完整附件及實際載入本體的雜湊。

## 內建瀏覽器驗證

唯一執行方法與證據層級見 [IAB_TESTING](IAB_TESTING.md)；目前工作只看 [TODO](TODO.md)。本節不維護第二份校準、故障、清理或停止流程，也不構成開啟新窗口的授權。舊 real-chrome-validation 錨點只保留相容，不授權外部 Chrome。

## 封裝與發行

現行產品版本以 release.json 為準；預設及產品政策由 README／ARCHITECTURE 維護，歷史整合決策由 HISTORY 追溯。正式交付不把離線效用 FAIL 或不足實機改判通過；版本發布不恢復已結束的實測，單分頁及永久禁令優先。

明確執行 `npm run package` 會建置，依 `release.json` 版本在 `Release/v<version>/` 寫入五項設定產物：

- `BiliCDN_TW.user.js`
- `CHANGELOG_v<version>.md`
- `TEST_REPORT_v<version>.md`
- `BUILD_MANIFEST_v<version>.json`
- `SHA256SUMS_v<version>.txt`

[package.mts](../scripts/package.mts) 在建置前拒絕非空目標目錄，五項產物以獨占建立寫入；不提供覆寫選項。只接受新目錄或既有空目錄，失敗保留當時內容供核對，不自動清除既存資料。不得為了驗證已發布版本而執行此命令；暫存封裝驗證使用 `npm run verify`。

授權、提交推送、附件與更新 URL 規則以 [AGENTS 發行規則](../AGENTS.md#發行規則) 為準。發布前通過最終差異的 `npm run verify` 及按風險要求的安全驗證；verify 已包含 typecheck、architecture 與全部測試，不要求同一差異再逐項重跑。本機封裝不等於發布；完成後依 AGENTS 核對遠端 main、標籤、唯一附件與公開 latest 的版本、大小及 SHA-256。內建瀏覽器／Tampermonkey 驗收另行記錄，未執行不得寫成通過。

發布後的安裝更新與已安裝版本查證分開；只有當次需要更新才使用既有公開 latest 入口，已回報更新完成時直接核對當前執行身分。管理器介面按目前授權與工具能力操作，不沿用已撤銷的禁令阻擋，也不以歷史可用性保證當次成功；受阻處理與證據要求見 [IAB 更新流程](IAB_TESTING.md#8-修復發布與後續執行)。

## 文件維護與結案

閱讀順序與各文件的唯一責任由 [INDEX](INDEX.md) 維護；本節依變更種類說明更新動作。只更新受影響的權威內容，其他入口以連結承接，不逐份複製狀態或驗收摘要。

<a name="documentation-update-map"></a>

### 文件更新對照表

| 修改內容 | 必要更新與條件 |
| --- | --- |
| 產品行為、模式、救援時機或資格 | 更新 [ARCHITECTURE](ARCHITECTURE.md) 與對應契約測試；涉及使用者操作、預設值或可見功能時，再更新 [README](../README.md) |
| 分層、內部介面、資料流、狀態或副作用所有權 | 更新 [ARCHITECTURE](ARCHITECTURE.md)；強制流程、不變量或授權界線改變時，再更新 [AGENTS](../AGENTS.md) |
| 信任邊界、敏感資料、儲存或網路安全要求 | 更新 [SECURITY](../SECURITY.md)；同時改變模組責任時，再更新 ARCHITECTURE |
| 新增或修改測試 | 更新測試來源；新增套件時登記 [test-registry.mts](../scripts/testing/test-registry.mts)。命令、隔離、期限或清理規則改變時更新本指南；原測試行為或遷移對照改變時才更新 [MIGRATION](../tests-v2/MIGRATION.md) |
| 測試工具、建置工具或開發依賴 | 更新本指南，將實際驗證按日期追加至 [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md)；作者、依賴授權或工具用途改變時更新 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)，上游或來源基準改變時更新 [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) |
| 瀏覽器驗收方法 | 更新 [IAB_TESTING](IAB_TESTING.md)；實際結果與限制依證據層級記入 TEST_REPORT 或對應原始紀錄 |
| 工作範圍、停止、跳過或結案決定 | 工作狀態集中更新 [TODO](TODO.md)，其他入口維持連結；既有報告保留原觀察及限制 |
| 新增文件、改標題或導覽 | 更新 [doc-manifest.json](doc-manifest.json) 的登記或相容錨點，補上 INDEX、HISTORY 或對應指南的入口；依 [文件登記與保護](#文件登記與保護) 保留正文與舊連結 |
| 發布新版 | 依 [發布文件更新順序](#發布文件更新順序) 更新版本、變更、完整結果與工作狀態，並核對上列受影響指南 |

實測結果只維護 [TEST_REPORT](TEST_REPORT.md) 或對應原始紀錄；新增測試及本輪驗證不得改寫舊版發布時的案例數。普通修復不再分開建立 FIX／ACCEPTANCE／CONTINUATION 多份報告。必要獨立調查或設計紀錄保存於 `archive/retired/docs/`，檔名標示版本或日期並登記 HISTORY；同議題按日期追加，原判定及限制保留。`docs/` 維持現行文件用途。

### 更新現有段落，避免累積副本

1. 先定位同一議題的權威章節及所有現行提及位置，再修改原段落或表格。政策改變時替換舊規則，不在文末追加一段相反說明；歷史差異留在 CHANGELOG 或版本紀錄。
2. README 依安裝、操作、預設、排查及隱私組織。格式解析、數值公式、授權與內部時序連到 ARCHITECTURE；開發限制與工具操作連到 DEVELOPMENT／IAB_TESTING。使用者仍需知道的功能限制保留簡短提示與證據入口。
3. INDEX 只列穩定的閱讀目的與權威位置；版本、日期與研究報告清單集中 HISTORY。新增報告不必在兩個索引各插入一套詳細閱讀路徑。
4. TODO 開頭只維護目前範圍、下一步及未啟動項目。已結案原文保留於明確標記的歷史區或固定快照，不把「當時尚未完成」帶入新待辦；驗收數字與原判定連回報告。
5. 相同撤除說明合併成一個歷史導引區，集中保留 requiredAnchors 與各原文連結。不得為去重刪除永久禁令、停止決策、證據或授權聲明。
6. 交付前同時查差異及完整章節的 GFM 解析結果，確認安裝步驟沒有混入測試操作、表格與正文沒有不同政策。`docs:check` 可攔同文件的重複長段落，無法證明不同措辭的語意一致；預設與條件仍須對照正式來源。

<a name="release-documentation"></a>

### 發布文件更新順序

1. 換版前將上一版完整 [TEST_REPORT](TEST_REPORT.md) 正文原樣追加至 [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md)，保留日期、版本、原錨點導引及原始限制，再更新最新版固定入口。
2. 同步 [release.json](../release.json)、[package.json](../package.json) 及對應 [package-lock.json](../package-lock.json) 的版本設定；一般指南引用版本來源，避免逐份硬寫目前版本。
3. 更新 [CHANGELOG](CHANGELOG.md) 的本版行為差異及證據入口，保留舊條目；TEST_REPORT 保存新版完整證據，分列自動、安全、來源隔離及實際安裝結果。未執行、失敗、無效及依指示跳過的項目照實保留。
4. 更新 TODO 的交付／停止／結案狀態，依文件更新對照表核對受影響指南，不將完整發布摘要或測試數字複製到其他入口。
5. 封裝新版前，先核對前版五份 Release 原始位元組及校驗清單，再壓縮至公開原件包並登記原邏輯路徑；獨立解壓核對通過後才移除舊散件。`Release/` 只保留現行版本五項產物；不重寫已發布快照、標籤或原始雜湊。
6. 保留 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md` 兩個封裝輸入路徑；它們連至其他儲存庫文件時使用完整 URL，確保複製到 Release 後仍可閱讀。封裝及發布命令見 [封裝與發行](#封裝與發行)；檢查已發布版本時只使用暫存封裝，不回寫快照。

### 文件登記與保護

1. 新增公開 Markdown 時更新清單的分類、topics、versions、date 與導覽。versions 可含調查基準和交付版本；缺少可確認日期填 null，不推測執行時間。主題權威由 owners 唯一定義，清單不保存 PASS 數或工作狀態。
2. 文件清單 schemaVersion 維持 1，封存位置清單使用 schema 2。documents.kind 區分現行權威與歷史用途；protections 的 exact 保護全文、prefix 只允許追加。文字按 LF、二進位按原始位元組核對，包內內容也經同一讀取介面驗證；不能刪基準或改雜湊來掩蓋原件變動。
3. 修改標題先核對引用與 requiredAnchors；[HISTORY](HISTORY.md) 提供版本、議題、日期及封存入口。`TEST_REPORT_HISTORY`、`DOC_MAINTENANCE_HISTORY` 與 `TEST_TOOLING_REPORT` 三份日誌的全部既有正文只追加；搬移清單的完整基準補足原 prefix 保護之後的既有尾段。發行原件、baseline 與安全封存不回寫。
4. 失效連結例外只適用原檔雜湊相符的不可變文件，逐筆指定 source、line、url、sha256、reason；修復後刪除例外。歷史報告中的本機私有證據另以 privateEvidenceReferences 記錄相同精確欄位，只適用受保護原報告，無論本機是否有檔都列為未核對，不讀取私有內容。不得對現行文件、未知新錯誤或整個目錄設定豁免。
5. `archiveManifest` 連至公開封存清單；歷史引用限制必須精確符合來源、行號、URL、原文雜湊及保存目標。已驗證包內目標可支持原文歷史連結限制，但不算 GitHub 上仍有效的原網址；現行指南改連可讀入口、封存包或固定 Git 提交。退役來源目錄可用 targetRevision 綁定當時 Git commit 的 tree，空目錄殘留不算來源證據；新規則不豁免現行文件、未知錯誤或整個目錄。來源檔搬移與退役仍核對精確新檔或 Git blob，不把歷史限制混為現行連結通過。
6. 搬移清單的 unchangedFiles 是本輪未改產品的證明。後續已授權產品變更先保存舊清單快照，再明確更新適用範圍；不得回寫歷史原件 entries、原始雜湊或既有 URL 編輯證據來消除失敗。

持續維護而未限定版本的指南、導覽與跨版彙編，清單的 versions 使用空陣列、date 使用 null，現行產品版本仍由 release.json 決定；不要保留已失去範圍意義的舊版標籤。固定來源／工具版本、明確日期的遷移對照與版本驗收文件保留其實際關聯。文件狀態改變時，同輪核對清單的分類與範圍，日期不是執行時間或驗收成功的替代證據。

整理現行 TODO 時，以目前工作、已結案項目、未啟動建議及停止邊界為主；歷史工作摘要移出現行狀態區前，保留可由固定提交還原的全文入口。受保護歷史報告的「尚未發布」「阻塞」仍描述原檢查點，後續完成只在允許追加的位置補導引；現行入口連向後續結果。日期、版本與議題三條 HISTORY 路徑要一起核對，不能只更新版本表。

### 狀態與矛盾核對

全面整理依文件清單逐份核對現行指南、導覽、狀態與驗證文件；日誌和版本紀錄按各自日期閱讀，發行原件與安全產物保持原始位元組。全文搜尋「目前」「本輪」「下一步」「尚未實作」、舊版名稱、預設與撤除功能，再依下表判讀，不能只靠關鍵字或連結檢查宣稱語意一致。

要求全文複核時，逐檔從首行讀到末行；長文按連續行範圍分段，確認沒有截斷或漏頁，再逐段判讀現行規則、歷史引文及撤除導引。關鍵字搜尋、程式成功讀檔與雜湊核對只作輔助，不能代替全文閱讀。

當範圍為所有 Markdown，實體遍歷須包含隱藏與 Git 忽略目錄，再對照追蹤清單及文件分類；逐檔記錄可讀性與搜尋結果，分清現行文件、版本歷史、追加日誌、發行快照、本機證據及第三方依賴。不能只查現行 guide 清單就宣稱全部檢查，也不能以關鍵字清零改寫歷史原件或第三方文件。封存或驗證副本中的舊 AGENTS 及指南只描述當時版本，不成為目前工作規則。

診斷、分頁原線對照及掉幀用途的命中須核對語意：已撤除功能不得保留現行操作、收集、顯示或驗收要求；撤除說明、否定契約與具版本的原始紀錄保留。外部驗收的掉幀採樣不代表腳本提供該功能；原生 totalVideoFrames 的播放進度、合法 Native 選路與原生 API 對照仍依其實際契約判讀。

| 核對內容 | 事實來源與處理 |
| --- | --- |
| 版本、預設、儲存及可見入口 | 對照 release／package／lock 與正式來源；新預設、既有保存值及當輪測試設定分開，已撤除入口不可留在現行操作表 |
| 自動驗證、發布、安裝及效用 | 依 TEST_REPORT 各階段證據；已完成的整合不再列待實作，後續安裝結果不回寫封裝快照，也不覆蓋原效用 FAIL |
| 工具限制及案例有效性 | 只限制依賴該證據的案例；完整 Network 缺口不能概括否定獨立成立的一般播放與設定操作 |
| 舊版、日期與議題導覽 | 三條 HISTORY 路徑一起更新；舊結果直接連相應歷史正文，只有最新版完整結果使用 TEST_REPORT 固定入口 |
| 舊錨點、測試表及名稱 | 保留可點擊原文導引與版本標示；原遷移表不代表現行套件，保留功能的現行名稱須符合實際斷言 |
| 現行工作與停止決策 | 只由 TODO 維護；舊時限、雙分頁、補跑或未完成文字不形成新授權，結案與未啟動問題分清 |

核對時分清修復交付、安裝本體核對、核心驗收與條件式／效用證據，不用其中一項成功覆蓋其他缺口。文件整理不改舊 FAIL／INVALID、原始證據或發布快照；以差異及雜湊確認非文件範圍保持，三份日誌全部既有正文只允許追加。

### 文件檢查與結案

文件變更執行 `npm run docs:check`、人工事實核對與 `git diff --check`；涉及封存配置、位置、保護或追加日誌時另執行 `npm run archive:check`，有本機私有處置再加 `-- --local`。檢查器不能判定全部文字含義；仍須依程式核對預設值、模式、UI 名稱、安全與狀態所有權，確認使用者縮減／結案決策未被恢復。

新增工具時另執行型別、tooling 與 verify；單純文件修改不新增產品或瀏覽器通過宣稱。工具結果追加 TEST_TOOLING_REPORT，文件核對追加 [維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

完成已授權的文件或驗收紀錄更新並通過檢查後，依 [AGENTS 預設交付規則](../AGENTS.md#發行規則) 主動提交推送 main；純文件不升版、封裝或發布，當次明確保留本機的限制仍優先。

docs:check 以 Git 已追蹤及未忽略的新 Markdown 為公開範圍；無 Git 的來源副本按明確公共目錄及清單的現行／封存 Release 目錄掃描，不遍歷私有 .work 或本機舊工具。它檢查 GFM、連結、唯一權威、兩次點擊、相容錨點、現行版本／npm 命令與正文保護。指南、導覽及工作狀態另檢查同檔可見文字至少 32 字元的完全重複段落，忽略空白與連結目的地差異，保留首段及重複位置；程式碼、表格、引文、版本紀錄與追加日誌不以此規則改寫。外部 URL 不連網；既有快照斷鏈、搬移後不可用原網址及歷史私有證據未核對數分開列出。未登記的私有證據連結即使本機有檔也會失敗。

只執行使用者批准範圍；文件整理不新增排程／CI/CD，不開安全掃描或瀏覽器窗口。

## 慢請求提前重試原型重現（分支限定）

此相容入口保留 2026-10-30 隔離原型的重現導覽。使用固定提交的 [原始重現程序](https://github.com/YUIAOI7592/BiliCDN_TW/blob/2a5851761d5a066cd3b54cb447b9da546a23187e/docs/DEVELOPMENT.md#慢請求提前重試原型重現分支限定)，並遵守目前永久禁令；本入口不恢復實機窗口。原型完整結果見 [歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。

## 已撤除工具的舊入口

<a name="安裝版還原觀察工具"></a>
<a name="實際緩衝效用與採用判定工具"></a>
<a name="緩衝影子效用與成本評估"></a>
<a name="診斷成本基準"></a>
<a name="唯讀緩衝趨勢診斷"></a>
<a name="剪貼簿驗證"></a>
<a name="風險覆蓋與可介入性離線評估"></a>

上述診斷、緩衝專用評估、安裝版插樁及剪貼簿工具已於 v2.2.1 撤除；[撤除前完整開發指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/DEVELOPMENT.md)保留各原章節，不是現行操作或驗收要求。播放器恢復能力仍保留，現行方法見[救援還原驗證](#救援還原驗證)；其餘評估見[離線評估指南](../scripts/evaluation/README.md)。
