# Codex 開發指南 — BiliCDN_TW v2

本檔適用整個儲存庫，維護代理工作流程、授權界線與不可省略的契約。詳細操作由 [.agents/skills](.agents/skills) 中的專案 Skills 維護，按任務載入，不要求每次全部閱讀；當次使用者明確指示優先，歷史計畫與 Skill 選用不構成新授權。

## 現行目標

- 正式來源為 `src-v2/`，入口 `src-v2/entry.ts`，測試 `tests-v2/`。v2 建置與正式測試不得匯入歷史 v1。
- 版本以 `release.json` 為準；腳本產物為 `Release/v<version>/BiliCDN_TW.user.js`。來源／工具事實核對 `src-v2/`、`scripts/`、`package.json` 及 `package-lock.json`。
- [INDEX](docs/INDEX.md) 是閱讀入口，[TODO](docs/TODO.md) 唯一維護目前工作與停止狀態，[TEST_REPORT](docs/TEST_REPORT.md) 保存最新版完整驗收結果，[HISTORY](docs/HISTORY.md) 導覽歷史。版本紀錄與 Release 快照只描述當時證據。
- 目錄、公開／私有封存及清理規則集中於[工作區封存 Skill](.agents/skills/bilicdn-archive-workspace/SKILL.md)，不以文件整理恢復已停止的測試或研究。

## 使用者永久執行禁令

下列限制自 2026-10-31 起適用所有開發、預覽、安裝、校準與測試；只有使用者明確撤銷才可變更，一般工作授權、技能建議及歷史計畫不能解除。

1. **禁止本機網站服務。** 不啟動或使用本機 HTTP／HTTPS、localhost／loopback、開發或預覽網站服務，不以換埠、工具或代理繞過。HTML 直接開本機檔案；執行既有命令前確認不會啟動此類服務，相依項目停止並記錄限制。
2. **禁止要求切換前景。** 不要求使用者把 Codex、對話、瀏覽器或分頁切到／維持前景，或展開面板配合校準；不以工具搶焦點替代。操作與觀察不得打斷使用者，前提不足停止相關案例。
3. **測試保持靜音。** 沿用使用者已確認的方法，導覽／起播後立即對真正播放器／媒體靜音並讀回，後續維持；換文件或播放器後立即重新核對。沒有起播前已靜音的要求，不追加跨導覽預注入、腳本執行前暫停或起播前讀回門檻。實際無法靜音或維持時，停止播放及相依案例；不要求使用者調音量、關喇叭或代為靜音，測試與清理不得在播放中解除靜音。

靜音不取消音訊下載或其資料驗證，不得修改媒體 getter 偽造靜音或進度。初始載入至靜音確認的區間不宣稱全程無聲，也不計入播放驗收；操作方法見 [IAB Skill](.agents/skills/bilicdn-iab-validation/SKILL.md)。

## 必要流程

1. 先核對工作樹與 [TODO](docs/TODO.md)，保留使用者無關變更；依 [INDEX 閱讀路徑](docs/INDEX.md#閱讀路徑) 選擇所需指南與 Skill。修改程式前必讀 [ARCHITECTURE](docs/ARCHITECTURE.md)、[SECURITY](SECURITY.md) 與[變更驗證 Skill](.agents/skills/bilicdn-verify-change/SKILL.md)；純文件依受影響議題核對事實。
2. 執行期修改先以領域層、控制器或適配器契約固定行為：修復先重現失敗，保持行為的重構先確認原實作通過。原始碼修改使用 `apply_patch`。
3. Codex 執行 Node／必要時 Python 前，使用 `load_workspace_dependencies` 取得當次路徑並明確執行；不硬寫安裝位置、bundle 或版本，不默默退回系統／歷史 up141 工具鏈。需要 npm 時只調整當次程序 PATH，維持父子 Node 一致，記錄實際路徑與版本。專案不固定 Node／Python 版本；能力探測與完整 verify 才能支持當次 Node 相容結論。開發依賴與 lock 保持精確版本，啟動器及一般 Shell 相容性見 [環境需求](.agents/skills/bilicdn-verify-change/references/runtime-and-commands.md#環境需求)。
4. 按 [驗證範圍](.agents/skills/bilicdn-verify-change/SKILL.md#依變更選擇驗證範圍) 執行檢查。來源、測試或工具變更完成對應套件及完整 `npm run verify`；正式發布亦須通過 verify。它已包含 typecheck、architecture、全部測試、格式、文件、公開封存、建置及暫存封裝檢查；同一最終差異不必再逐項重跑。單項命令仍供開發定位使用，失敗後須修正並重驗受影響範圍。
5. 契約使用具名 `node:test`，每案重建可變狀態；`testScope(t)` 登記清理，全域替換經 `defineGlobal()`。計時器、攔截、訂閱與取消函式由所屬資源管理，完整執行不得有 only／skipped／todo／cancelled。新測試套件登記 `scripts/testing/test-registry.mts`；細節見 [測試隔離](.agents/skills/bilicdn-verify-change/references/test-contracts.md)。
6. 自動驗證、安全審查、來源隔離與實際安裝結果分開記錄；verify 不包含安全掃描或瀏覽器驗收。Codex Security 僅於安全敏感變更或使用者明確要求時執行。

## 瀏覽器工作界線

- **唯一環境為 Codex 內建瀏覽器＋Tampermonkey。** 不改用外部 Chrome／Edge、獨立 Playwright／Puppeteer 或 headless 瀏覽器；同時僅一個自有 IAB 測試分頁，第二分頁相依案例列未執行。工具受阻記錄具體原因，不繞過限制。
- 使用者於 **2026-11-13 撤銷「禁止探索 Tampermonkey」**；可依任務需要透過允許的工具開啟管理器、查詢或讀取相關資料。這不自動啟動新驗收或研究；管理器識別、保存副本、頁面載入本體與實際接線仍分別判定。
- 依 [IAB 門檻適用表](.agents/skills/bilicdn-iab-validation/references/assertions-and-evidence.md#門檻的適用範圍) 取得當次斷言需要的證據。完整本體須比對正式產物，singleton／hooks 須有相應執行證據；管理器版本不能替代它們，也不是一般播放的通用前置。工具重連先查文件／實例連續性，只更新失效證據。
- 已通過且仍適用的瀏覽器項目不重測；無效窗口須有當次重跑授權與新前提才可補跑，不自行追加輪次。已停止目標不因工具恢復、校準、文件整理或發布重啟。
- 樣片沿用當次凍結清單；已授權的 4K／8K 搜尋校準、歷史基準、Auto 畫質及 1／2 倍分測依 [樣片規則](.agents/skills/bilicdn-iab-validation/references/playback-and-visibility.md#展示樣片選擇與唯讀窗口)。不因結果換片，不強制畫質、改帳戶／瀏覽器設定或停用其他腳本。
- [可見性校準](.agents/skills/bilicdn-iab-validation/references/playback-and-visibility.md#前景偽裝與真正背景)與[故障注入、受控學習隔離及清理](.agents/skills/bilicdn-iab-validation/references/fault-injection-and-cleanup.md)各依當次斷言執行；不以頁面前景偽裝、面板隱藏或工具選取狀態證明真正背景，不以修改媒體 getter、重建控制器或重設預算製造安裝證據。
- 結果依 [判定規則](.agents/skills/bilicdn-iab-validation/SKILL.md#判定與交付) 記 PASS／FAIL／INVALID／證據不足／未執行。前提或必要證據失效只影響相依結論；Network 缺口不能否定獨立成立的一般播放與設定操作。繼續可獨立完成的合法工作，不降低斷言、不冒充通過、不反覆尋求解除禁令。

## 架構規則

完整依賴表與檢查邊界見 [ARCHITECTURE](docs/ARCHITECTURE.md#依賴方向)，實作檢查見 `scripts/checks/architecture-rules.mts`。

- 匯入依實際層級表判定：`state` 可依賴 `domain/platform`，`application` 可依賴 `state/domain/platform`；`adapters` 與 `ui` 可依賴應用及下層，但不能互相匯入。`domain` 與 `platform` 各自只匯入同層；契約不得依賴具體實作，功能私有助手不得跨界匯入。
- `domain` 不讀取 GM、DOM、Fetch、XHR、環境時鐘或計時器；時間（或注入的 `Clock`）及相對 URL 基底明確傳入。
- 非入口模組匯入時不得讀取 GM、修改頁面、建立計時器或啟動網路。`entry.ts` 負責建立、接線及啟動，產品政策留在所屬模組。
- 不使用動態依賴集合、跨模組設定函式或公開可變的 Map／Set／計時器。
- 選路的親和變更由 `RouteCoordinator` 唯一提交；`SessionStore` 仍可於生命週期重設時清空。主動探測只由 `MeasurementController` 啟動，核心重載只由 `RecoveryController` 發起。
- 生命週期敏感的非同步工作，在等待、外部回呼及儲存鎖後提交前，重查適用的世代、內容週期、身分或控制器標記。
- `SignedRouteVault` 唯一持有 Native 授權索引；適配器可在記憶體處理 URL、資料內容與資訊清單指紋，這些原始值不持久化或輸出，不另建可獨立授權的 Native URL 索引。
- UI 消費功能狀態快照，產品修改經 `ControlCommandPort`；不直接變更儲存或控制器狀態，不建立診斷錄製／報告管線。

## 必要不變量

- Catalog 目標只來自可信內建項目；Native 必須是當前內容週期的合法精確 URL。正常選路預設允許 Native，關閉原生來源僅用 Catalog，與整體停用分開。
- 禁止規則涵蓋原始、Native、Catalog、固定及備援；健康探索不變更目前親和，影音健康／恢復互相隔離。
- Fetch 保持單一讀取器及取消原因；XHR 保持 text／json、重用、逾時、中止與原生相容契約。
- 整體停用停止腳本改寫與主動網路工作，不取消網站請求；編解碼器能力檢查不得阻擋 playurl。
- 不讀取、取代或包裝網站 Worker 建構函式，不加入執行期依賴或遠端程式載入。
- 不持久化或輸出簽名 URL／路徑／查詢字串／權杖、Cookie、IP 或播放器／核心物件；政策輔助使用不透明識別碼與有界中繼資料，URL 接納函式可檢查但不保存字串。完整信任邊界見 [SECURITY](SECURITY.md)。

<a name="release-rules"></a>

## 發行規則

- 已授權工作完成且通過對應檢查後，依使用者 2026-11-09 的要求主動提交並推送 main，包含純文件與驗收紀錄。當次明確只調查、起草、保留本機、暫緩提交／推送／發布時，遵守該範圍；保留無關變更。
- 功能修復依預設授權遞增修補版本、通過最終驗證、封裝、提交並推送 main／版本標籤、發布正式 GitHub Release；僅推送原始碼不算腳本更新交付。**純文件不升版、不封裝、不新增或移動標籤、不發布 Release。**
- 發行步驟與文件順序見[發行 Skill](.agents/skills/bilicdn-release/SKILL.md)。不得發布未完成修復或失敗驗證；實際工具／權限受阻時完成可做的準備並回報。
- Release 附件只有 `BiliCDN_TW.user.js`，更新 URL 維持本儲存庫 latest Release；v2 不產生歷史修補產物，不加入 CI/CD 或 GitHub Actions。
- 發布後核對遠端 main、版本標籤、唯一附件及公開 latest 下載的版本、大小與 SHA-256。安裝驗收另記，未實測不宣稱通過。
- 需要更新時先用 IAB 既有公開 latest 入口；已回報更新完成或只要求查證時直接核對，不先重裝。必要步驟實際受阻才說明人工處理需求，詳見 [IAB 更新流程](.agents/skills/bilicdn-iab-validation/references/assertions-and-evidence.md#安裝更新與已更新查證)。
- 提交訊息記錄已知的實際模型與推理設定；未知不猜測，也不複製過時署名。

## 文件維護

- 依 [更新對照表](.agents/skills/bilicdn-maintain-docs/references/update-map.md#依變更選擇權威) 修正權威原章節與相關現行提及，其他入口使用連結；不累積重複狀態或相反規則。README 面向使用者，版本研究集中 HISTORY。
- 遵守 [GFM 約定](.agents/skills/bilicdn-maintain-docs/references/document-registry.md#markdown-格式gfm)，核對實際解析、連結及既有錨點；新增文件登記 `docs/doc-manifest.json` 並加入現行入口或 HISTORY。
- 純文件執行 `npm run docs:check`、人工事實／範圍核對及 `git diff --check`；涉及封存配置、位置、保護或追加日誌時另執行 `npm run archive:check`。本機處置另加 `-- --local`，完整解壓後以 `--restore-root` 唯讀核對；讀取失敗不能算通過。
- 發行快照、安全產物與原始證據保持原始位元組；歷史閱讀版只允許登記且可重建的 URL 調整。保留原 FAIL／INVALID、限制與停止決定，不把歷史未完成文字轉成新待辦。移除原位置或可重建副本前，須完成授權、來源、壓縮及獨立還原核對，不能刪保護登記或改雜湊掩蓋失敗。
- `TEST_REPORT_HISTORY`、`DOC_MAINTENANCE_HISTORY`、`TEST_TOOLING_REPORT` 全部既有正文只追加。換版保存上一版完整 TEST_REPORT；文件整理記入維護歷史，工具驗證按日期記入工具日誌，不回寫已發布報告。
- 保留 `docs/CHANGELOG.md` 與 `docs/TEST_REPORT.md` 封裝輸入路徑；兩者的儲存庫文件連結使用完整 URL。文件檢查不代表新增執行期、安全或瀏覽器驗收通過。
