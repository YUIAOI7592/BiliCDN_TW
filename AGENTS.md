<a name="codex-development-guide--bilicdn_tw-v2"></a>

# Codex 開發指南 — BiliCDN_TW v2

<a name="current-target"></a>

## 現行目標

- 唯一正式來源：`src-v2/`。
- 入口：`src-v2/entry.ts`。
- 測試：`tests-v2/`。
- 發行產物：`Release/v<version>/BiliCDN_TW.user.js`，`version` 取自 `release.json`。通過自動驗證及必要安全驗證後發布；Codex 內建瀏覽器／Tampermonkey 驗收另行記錄。
- 歷史 v1 Release 與標籤僅供參考；v2 建置及測試不得匯入。
- 現行文件與歷史紀錄的狀態見 `docs/INDEX.md`。有版本的計畫、驗收紀錄及發行快照只描述當時版本；目前工作見 `docs/TODO.md`。
- 已退出流程的文件位於 `archive/retired/docs/`；舊本機工具與私有證據位於 `archive/retired/local/`。封存不作 v2 建置／測試輸入，配置見 `archive/retired/README.md`。

<a name="required-workflow"></a>

## 必要流程

1. 閱讀 `docs/PROJECT_CONTEXT.md`、`SECURITY.md`、`docs/ARCHITECTURE.md` 及 `docs/DEVELOPMENT.md`。
2. 修改執行期邏輯前，先以領域層、控制器或適配器契約測試重現行為。
3. 維持分層方向：領域層 → 狀態層 → 應用層 → 適配器層／UI 組合。下層不得匯入上層。
4. 原始碼修改使用 `apply_patch`，保留使用者的無關變更。
5. 發布前執行 `npm run typecheck`、`npm run architecture`、`npm test` 及 `npm run verify`。
6. 分開記錄自動驗證、內建瀏覽器來源隔離與 Tampermonkey 實際安裝版結果。

**唯一瀏覽器測試環境為 Codex 內建瀏覽器＋Tampermonkey。** 依 [IAB_TESTING](docs/IAB_TESTING.md) 執行環境校準、來源隔離、安裝版驗收與發布後回歸；不得改用外部 Chrome／Edge、獨立 Playwright／Puppeteer 或 headless 瀏覽器。Node 契約、型別、架構與建置驗證仍按原流程執行。工具阻塞須保存具體原因，不能自行改換瀏覽器。

- 每次新載入、重新連線或版本／執行個體改變時，核對實際管理器、完整腳本本體、版本、唯一 singleton 與 hooks；工具能力通過不等於產品功能通過。
- 網站只使用使用者指定風景影片 `BV1tFZZBQE57`，以 Auto 畫質、1／2 倍速分開驗證；不切影片、不強制畫質、不改瀏覽器設定或停用其他腳本。
- 背景先以新增分頁並實際切換校準。網站所見 `document.hidden=false` 是腳本既有前景偽裝；須分別核對經校準的原生 getter 與 Runtime 實際可見性。隱藏面板、工具 selectedTab 或 queued 回應均不能單獨證明背景；共用同一 getter 的兩個讀值也不是獨立證據。
- 有效案例明確判定通過／不通過。前提不成立或事件遺失的窗口記為無效，列明原因，不能判成產品缺陷或算通過；同一無效方法沒有新前提不得重跑。執行次數、期限及結案範圍遵守 IAB_TESTING。
- 故障注入前建立精確攔截、完整事件游標及受控樣本抑制；結束後核對自有攔截、請求、包裝、訂閱、計時器與學習樣本清理。不得用修改媒體 getter、重建控制器或重設預算製造安裝版證據。
- 已停止的自主目標不得因改文件、校準環境或發布而自行恢復。目前工作與啟動狀態以 [TODO](docs/TODO.md) 為準。

契約使用具名 `node:test` 案例，各案例以測試情境建立函式重建可變狀態。使用 `testScope(t)` 登記清理，全域替換經 `defineGlobal()`；計時器、攔截、訂閱及取消函式由所屬資源明確管理。禁止僅執行標記（`only`）、略過（`skipped`）、待實作（`todo`）或取消（`cancelled`）留在完整執行。新套件加入 `scripts/test-registry.mts`，命令、期限及原契約對照見 `docs/DEVELOPMENT.md` 與 `tests-v2/MIGRATION.md`。工具驗證另按日期記錄於 `docs/TEST_TOOLING_REPORT.md`，不回寫已發布報告。

<a name="architectural-rules"></a>

## 架構規則

- `domain` 必須保持純粹，不得讀取 GM、DOM、Fetch、XHR、環境時鐘或計時器。時間及相對 URL 的基底必須明確傳入；可以使用注入的 `Clock`。
- 匯入非入口模組時，不得讀取 GM、修改頁面、建立計時器或啟動網路工作。`entry.ts` 負責啟動組合後的執行環境。
- `entry.ts` 只組合介面、儲存元件與控制器。
- 不得使用動態依賴集合、跨模組設定函式或公開可變的 Map／Set／計時器。
- 僅 `RouteCoordinator` 可以變更路線親和主機（目前路線綁定）。
- 僅 `MeasurementController` 可以啟動主動探測。
- 僅 `RecoveryController` 可以重載播放器核心。
- 對生命週期敏感的非同步工作，提交狀態前必須檢查適用的世代、內容週期、身分或控制器標記。
- `SignedRouteVault` 擁有簽名路線索引、不透明識別碼及原生簽名路線（Native）選路授權。政策輔助函式使用不透明識別碼與有界中繼資料；適配器與執行路徑也會處理記憶體中的 URL、資料內容及資訊清單指紋。不得建立另一份可獨立授權的 Native URL 索引，也不得持久化或輸出這些原始值。
- 診斷只能唯讀消費型別化事件。

<a name="required-invariants"></a>

## 必要不變量

- 內建節點清單（Catalog）目標僅來自可信內建項目；Native 目標必須是當前內容週期的精確 URL。
- 正常選路預設只使用 Catalog；持久原生來源開關、分頁原線對照及整體停用必須維持各自語意。
- 禁止規則適用於原始、Native、Catalog、固定及備援路線。
- 影片與音訊的健康／恢復互相隔離。
- 健康探索不得變更目前主機。
- Fetch 維持單一讀取器，並傳遞取消原因。
- XHR 的 `text`（文字）／`json`（JSON）／重用／逾時／中止行為維持相容。
- 停用期間停止所有腳本改寫及主動網路行為，不取消網站請求。
- 不得讀取、取代或包裝網站的 Worker 建構函式。
- 不得持久化或輸出簽名 URL／路徑／查詢字串／權杖、Cookie、IP 或播放器／核心物件。
- 編解碼器能力檢查不得阻擋 playurl；掉幀僅作診斷。

<a name="release-rules"></a>

## 發行規則

- 使用者已授權本專案的預設修復交付流程：功能修復完成且通過必要自動驗證及按風險要求的安全驗證後，直接提交、遞增修補版本、封裝、推送 GitHub main／版本標籤並發布正式 GitHub Release，讓 Tampermonkey 的既有更新網址取得新版；不需使用者每次重複要求推送或再次確認。僅推送原始碼不算完成腳本更新交付。
- 若當次使用者明確要求只調查、起草計畫、保留本機修改或暫緩發布，遵守該次範圍；不得把未完成修復或失敗驗證當成可發布結果。若工具或權限實際阻塞，完成可做的準備並具體回報阻塞原因。
- 發布後核對遠端 main、版本標籤、唯一腳本附件，以及公開 latest 更新下載的版本、大小與 SHA-256；Codex 內建瀏覽器的 Tampermonkey 安裝版驗收另行記錄，未實測不得宣稱通過。
- 安裝版更新先嘗試內建瀏覽器的既有公開 latest 使用者腳本入口，再核對新文件的完整執行身分。v2.1.21 已證明此路徑可用；不得只因擴充功能介面受限就要求使用者手動更新。當次入口實際受阻時才請使用者完成必要步驟，遵守工具限制；流程見 [IAB 更新](docs/IAB_TESTING.md#release)。
- 不得加入 CI/CD、GitHub Actions、執行期依賴或遠端程式載入。
- v2 不產生歷史修補產物。
- GitHub Release 只包含 `BiliCDN_TW.user.js`。
- 更新 URL 維持指向本儲存庫的最新 Release。
- Codex Security 按風險使用：安全敏感變更或使用者明確要求時執行，不自動要求每版掃描。`npm run verify` 不包含安全掃描。
- 已知實際執行模型與推理設定時，提交訊息須記錄該資訊；不得複製過時署名。

<a name="documentation-maintenance"></a>

## 文件維護

- Markdown 依 GitHub Flavored Markdown（GFM）及 [專案格式約定](docs/DEVELOPMENT.md#markdown-format) 維護；檢查實際解析的標題、清單、表格、粗體、程式碼與連結。格式整理保留原文含義、錨點及歷史證據，不改寫 Release／不可變封存。
- 隨對應原始碼變更更新現行指南。依程式／設定核對預設值、介面／權責、儲存行為、UI 名稱、測試命令及發布狀態。
- 事實來源為 `release.json`、`package.json`、`package-lock.json`、`src-v2/` 及 `scripts/`；有日期的測試／瀏覽器紀錄只作對應版本的證據。
- 歷史紀錄標示版本／日期並連至現行指南。保留原始觀察、限制及計畫撤銷狀態；不得將舊待完成文字或已批准驗收的限制轉為現行待辦。
- 維持 `docs/INDEX.md`、`docs/TODO.md` 與 `docs/TEST_REPORT.md` 最新版內容一致。修正現行文件時，不得回寫 `Release/v*/` 快照或已封存且不可變更的安全產物。
- `docs/TEST_REPORT.md` 保存最新版完整報告與歷史導覽；換版時將上一版完整正文加入 `archive/retired/docs/TEST_REPORT_HISTORY.md`，保留日期、版本、原錨點導引及原始限制。文件整理結果另按日期記入 `archive/retired/docs/DOC_MAINTENANCE_HISTORY.md`。
- 保留 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md` 兩個封裝輸入路徑；它們指向其他儲存庫文件的連結使用完整儲存庫 URL，確保複製到 Release 後仍可閱讀。
- 僅修改文件時，檢查連結、引用路徑／名稱、事實一致性及 `git diff --check`。未實際執行時，不得宣稱新的執行期測試或瀏覽器驗收。
