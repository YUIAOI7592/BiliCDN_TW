# BiliCDN_TW v2.2.1：診斷撤除後程式碼完整清查

日期：2026-11-01。性質：唯讀清查、分析與後續建議；本次只交付文件，不修改產品、介面、測試、設定、版本或 Release。

## 結論與階段門檻

**第一階段完成，確認三組殘留；第二階段未啟動。** 三組分別為兩個失去用途的事件型別、仍計算但沒有產品消費者的診斷快照計數，以及測試情境中的舊原線對照狀態與診斷訂閱參數。可歸因且已判定的待釐清項目為零；本報告不宣稱「診斷殘留為零」。

沒有發現可由正式入口啟動的診斷錄製器、事故窗口、緩衝趨勢分析、請求／恢復／提前重試歷程、診斷頁、報告序列化／複製／下載、剪貼簿授權、原線對照執行分支或掉幀計數收集。上述否定結論來自完整閱讀、產生者／消費者追查及正式建置對照；A02 仍在 bundle 中計算，不能用「沒有完整管線」掩蓋局部殘留。這些清查發現不改判既有播放或設定驗收結果。

依使用者指定門檻，確認殘留非零即停止進入第二階段。因此只交付 A01–A03 的最小清除方案與驗證要求；O01–O04 是第一階段遇到的可整合負擔觀察，沒有展開第二階段方案、效益評估或「優先整理／可延後／維持現狀」排序，不能據此自動啟動重構。

## 凍結基準、範圍與方法

基準為執行開始的乾淨 `main`：`8d41a0ba51ec6fe72bd7b1532187061b1d96acc8`，產品版本取自 `release.json`，為 **2.2.1**。可由 [固定提交](https://github.com/YUIAOI7592/BiliCDN_TW/tree/8d41a0ba51ec6fe72bd7b1532187061b1d96acc8) 還原本報告行號。後續純文件提交不改變這個清查基準。

| 正式範圍 | 檔案數 | 完整閱讀行數 | 邊界 |
| --- | --- | --- | --- |
| `src-v2/` 的 TS、宣告與 metadata | 93 | 15,157 | 包含未進 bundle 的型別契約及 metadata |
| `tests-v2/` 的 TS | 90 | 38,321 | 含回歸、支援情境及通用工具測試 |
| `scripts/` 的 MTS／PS1／SH | 28 | 5,073 | 含建置、檢查、測試及保留評估工具 |
| 合計 | 211 | 58,551 | 附錄逐檔列出完整行範圍、段數、SHA-256 及結論 |

逐檔由首行讀至末行，長檔按約 14,000 UTF-8 bytes 的連續行範圍分段。曾因工具輸出上限截斷的段落另行完整讀回，才計入覆蓋；最終所有段落連續且首尾一致，211 檔的原始雜湊未變。關鍵字、引用及歷史差異只作輔助，沒有以「程式成功讀檔」取代內容閱讀。

另讀取 `release.json`、`package.json`、建置資訊清單、實際 bundle 相關區段及必要的移除前來源。歷史來源只用於判讀用途：撤除前固定提交 `6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb`；沒有改寫歷史來源或載入執行。正式來源以外的依賴、歷史 userscript 本體不納入 211 檔全文覆蓋宣稱。

判定標準：診斷專用、失去現行用途且可追溯到被撤銷功能者列「確認殘留」；實際服務播放、選路、控制中心保留狀態或通用測試者列「必要保留」；一般冗餘、僅測試依賴或舊命名列「可整合負擔」；用途無法確認才列「待釐清」。單純名稱、集合、計時器或 `snapshot()` 不構成殘留證據。

## 確認殘留與最小清除方案

### A01：兩個沒有產生者的舊診斷事件成員

| 項目 | 證據 |
| --- | --- |
| 定義 | `src-v2/domain/model.ts:226` 的 `transport`、`:228` 的 `route-observed`，均在 `DomainEvent` 聯集內 |
| 寫入／讀取 | 211 檔完整閱讀及引用核對後，正式來源沒有這兩種事件的送出點或依其型別處理的現行消費者；測試也沒有建立這兩種事件 |
| 歷史用途 | 撤除前 `src-v2/diagnostics/event-sanitizer.ts:113`、`:125` 分別處理 `transport`／`route-observed`，輸入診斷事件序列 |
| bundle 可達性 | 型別在建置時消失；實際 bundle 沒有這兩個事件型別字串。這是契約殘留，不是持續執行的收集器 |
| 判定 | 確認殘留；兩個成員合為同一清除單位，不能把整個 `DomainEvent` 或 `TransportObservation` 一併刪除 |

最小方案：從 `DomainEvent` 移除這兩個聯集成員，不新增空實作或相容事件。相容影響為內部匯出型別收窄；後續實作須明列這項變更，本次沒有修改型別。必要驗證為型別、架構、匯入純度及完整契約測試；保護 `request-started`、`route-planned`、`route-confirmed` 的現有通知順序，以及 `recovery` 的影片備援轉交。

### A02：`RouteSnapshot.planCount` 診斷投影仍在正式快照計算

| 項目 | 證據 |
| --- | --- |
| 定義／寫入 | `src-v2/application/route-contracts.ts:99`；`route-coordinator.ts:1534` 每次 `snapshot()` 回傳 `this.#plans.size` |
| 正式路徑 | `entry.ts` 組合控制中心 → `createControlReadModel().snapshot()` → `routes.snapshot()` → `planCount`。bundle `:3633` 保留這項計算 |
| 產品讀取 | 控制中心將完整 routes 物件帶入模型；三頁及詳細狀態沒有讀取 `planCount`，選路／量測／恢復政策也不讀取它 |
| 測試讀取 | `tests-v2/suites/application.ts:1700` 以 `> 30` 確認群組數；`tests-v2/regressions/functional-races/routing-convergence.ts:291` 以 `0` 觀察重入提交前狀態 |
| 歷史用途 | 撤除前 `diagnostics/event-sanitizer.ts:230` 明確把 `planCount` 放進診斷報告的縮減 routes；完整報告亦透過 `reportCurrent()` 序列化模型 |
| 判定 | 確認殘留的診斷快照投影；仍有測試消費者，所以不能只刪欄位而不處理測試契約 |

最小方案：移除投影欄位及其型別，將群組容量與重入測試改以各代表群組的實際決策、路線身分及外層提交結果驗證。**保留 `#plans` 本身**：它是每個 representation 的現行路線計畫，直接服務選路。不得改為固定 `0`、空值或刪掉行為斷言來讓測試通過。

相容影響為 `RouteSnapshot` 內部介面收窄及兩處測試觀測方式改變；schema 2、四個儲存鍵和使用者設定不受這個方案影響。驗證須覆蓋多群組決策仍可取得、重入期間未提前提交／污染外層計畫、路線確認順序不變、總覽全部數值及詳細狀態保持、CDN 建構／刷新各一次快照。未量測效能收益，不聲稱移除一個計數即可改善播放效能。

### A03：測試情境仍保留原線對照狀態及診斷訂閱參數

| 項目 | 證據 |
| --- | --- |
| 定義 | `tests-v2/suites/orchestration.ts:35` 的 `_observeRetry`，以及 `:63` 的 `comparison`；`:136`、`:139` 仍暴露 getter／setter |
| 寫入／讀取 | `:181` 寫入 `base.comparison = true`，目前只有情境存取器讀寫它，沒有接到 Runtime／RouteCoordinator；`observeRetry` 經多層函式轉傳，三個註冊案例一律傳 `false`，底層完全不使用 |
| 歷史用途 | 同檔撤除前 `:109` 把 `comparison` 接到 `isOriginalComparison()`；`:546` 後的斷言檢查對照模式抑制恢復。撤除前 `:42` 起的 `observeRetry` 建立含 `history` 的快照與診斷專用訂閱 stub |
| 實際影響 | 現在只是測試程式執行的未接線狀態及無效參數；沒有進入正式 bundle，也沒有恢復原線對照產品功能 |
| 判定 | 確認殘留；它們讓情境看起來仍可驗證已撤銷模式／診斷訂閱，實際上沒有該覆蓋 |

最小方案：刪除該檔的 `comparison` 區域狀態、存取器與單次賦值，刪除 `_observeRetry` 及所有轉傳／固定 `false` 引數。保留 Native 設定失效順序、影片備援送交恢復、Runtime dispose 後無回呼，以及 `clearLearning()` 次序的現有斷言。不要把已撤銷比較案例補成空事件或空讀值斷言。

相容影響限測試私有建立函式簽章；不更改套件選擇器、保留案例名稱或產品 API。後續先保護保留斷言，再整理情境，執行 orchestration、Runtime／影音隔離相關回歸及完整測試。此方案只是建議，未在本次實作。

### 清除後重新進門檻的必要條件

1. A01 兩個型別成員消失，A02 投影與其測試依賴消失，A03 舊狀態／參數消失；沒有以常值或空實作替代。
2. 保留 N01–N07 的實際消費者及所有權，完成下節契約矩陣；新增或調整測試須先於執行期變更。
3. 重新核對正式來源及建置可達路徑，確認殘留與待釐清均為零，才另行啟動第二階段整合盤點。清查、修復及發布屬不同工作；本報告不授權自動修復或發布。

## 必要保留與資料流追查

| 編號／分類 | 定義與產生者 | 讀取／用途及判定 |
| --- | --- | --- |
| N01 必要保留：選路學習與當前計畫 | `domain/evidence.ts`、`state/evidence-store.ts`、`RouteCoordinator.#plans/#lastSuccess`、Vault 內容索引 | evidence 每主機／媒體有界樣本直接用於吞吐、排名、熔斷；`#plans` 決定實際路線；`latestVideoHost()` 讀最後成功影片主機供功能協作。不得把它們當請求歷程或因快照欄位未用而刪掉內部集合 |
| N02 必要保留：播放進度與恢復狀態 | `adapters/player-media.ts:85` 只讀 `getVideoPlaybackQuality().totalVideoFrames`；`domain/playback-progress.ts` 比較當前／前次；Monitor 一秒 tick、Recovery 當前 token／階段／落點 | 真實影格及時間進度驅動穩定播放、停滯及還原確認。沒有掉幀欄位讀取、歷史採樣陣列或緩衝趨勢演算法。位置／倍速還原資料是執行進度，不是事故錄製 |
| N03 必要保留：三頁與總覽當前資料 | `TransportContext` 計數、最後媒體／播放 API 摘要；Monitor／Recovery／Measurement／routes 當前快照 | `overview-view.ts` 顯示緩衝、安全吞吐、需求餘裕、影音回應及功能狀態；`status-summary.ts` 只在可信詳細狀態操作時建立文字。沒有歷程、序列化下載、剪貼簿或事故標記。頁面為總覽／CDN／播放設定；CDN 建構與刷新共用各自一次模型 |
| N04 必要保留：量測及提前重試 | `MeasurementController` 的 gate／冷卻／當次結果；`EarlyRetryController` 的當前 state/reason/attempts；XHR handoff 的 timeout/claimed 兩筆狀態 | 控制起播、探測、重試許可及使用者所保留的總覽狀態。handoff 觀察只屬當前重試，不是跨請求診斷歷程。取消、換片、停用及 dispose 保有現行所有者 |
| N05 必要保留：功能事件 | RouteCoordinator 同步發布；Runtime 安裝訂閱；ControlReadModel 訂閱作開啟畫面刷新 | Runtime 只將影片 `recovery/route-fallback` 交給恢復控制器，音訊不觸發影片恢復。其餘現行已發出的路線事件對 UI 尚有通知用途；事件 payload 是否過大屬 O01，不能連功能事件一起刪除 |
| N06 必要保留：合法原網址、Native 與設定 | Vault 唯一當前精確 URL 授權；`inspectOriginal`／`root-original`、Native 開關及 SettingsStore | 正常原網址傳輸及 Native 權限並不是原線對照模式。Native 預設 true，明確布林值保留；Catalog-only 測試使用 `CatalogSettingsStore` 明確 false；schema 2 和四鍵不變，讀取缺值不強制寫入 |
| N07 必要保留：通用測試／離線評估 | Node 測試報告、`t.diagnostic`、測試副作用 trace、固定歷史版本 VM、提前重試效用模型、verify 負向標記 | 它們沒有被正式入口匯入。VM 僅載入雜湊固定的 v1.3.4／v2.1.27；`PerformanceObserver`、媒體品質形狀及固定 `droppedVideoFrames: 0` 供舊版相容／DOM 型別形狀，並非 v2.2.1 掉幀收集。保留模型觀察及 Node 摘要，不把這些字樣一律刪除 |

四個持久鍵只有 `bilicdn.v2.settings`、`bilicdn.v2.restrictions`、`bilicdn.v2.routeEvidence`、`bilicdn.v2.meta`。此次未新增資料遷移、收集器、平台授權或持久狀態。`src-v2/diagnostics/` 及 `scripts/iab/` 均不存在；保留兩個離線評估命令為上游比較與提前重試功能評估，沒有診斷成本／緩衝 shadow/live/risk/adoption 專用工具入口。

## 可整合負擔觀察：只登記，不進入第二階段

| 編號 | 已核實現況與消費者 | 分類理由與本次處置 |
| --- | --- | --- |
| O01 | `RouteSnapshot.recentPlans` 只供現行測試讀取；`lastSuccess` 投影無 UI 欄位讀取。Coordinator `:1522` 建立非 active 計畫陣列，`:1554` 整理最近四筆，`:1561` 複製最後成功摘要。UI 對已發出路線事件只取刷新通知，Runtime 保留影片恢復事件 | 可整合負擔；內部集合仍有功能用途，與投影分開。沒有以最近計畫名稱直接判為事故歷程，也沒有在門檻未通過前提出事件／快照重構方案 |
| O02 | `ui/control-contracts.ts:12` 的 `releaseStage` 由 read-model 固定寫 stable，無現行 UI／測試欄位消費；模型 `version` 與視窗 header 注入版本並存；`ControlModelSources.now` 在 read-model 未用 | 可整合負擔；無錄製或輸出流程。相容性、依賴收窄及畫面版本單一來源留待第二階段，不在本次修改公開型別 |
| O03 | `EarlyRetryEvidenceControlPort` 無任何匯入；`suppressEarlyRetryEvidence()` 實作只被 `up141-retry-transport.ts` 的受控成功樣本測試使用。32 筆有界 refcount 抑制私有提前重試候選 ledger，不是另一個診斷錄製器 | 可整合負擔；有實際測試讀取候選資格的消費者，不以「Evidence」名稱判診斷殘留。工具／測試專用介面應否保留在產品端屬後續邊界設計，現有用途已釐清 |
| O04 | 多個具名 fixture 仍串接大量其他情境；例如 adapters `createClockContext5()` 先完成 Fetch／XHR 多組操作才建立恢復資料，orchestration 以外亦有 `void 200`、`void 'catalog-generated'` 等常值，以及 state 的舊 `DefaultOff` 建立函式名稱。control-center 的 `UP141-DIAG` 名稱目前測的是保留總覽 | 可整合負擔；常值本身不形成斷言，不能算覆蓋。相對地 `void xhr.response`／`void malformedXhr.responseText` 觸發 lazy getter、`apply()`／探測／保存可能改狀態或重入，不能一律刪除。保留案例內仍有直接功能斷言；未發現以診斷空讀值冒充已撤銷功能通過的新流程 |

A03 是具有明確已撤銷來源且完全失去接線的測試狀態；O04 是一般情境展開後的冗餘，兩者不混計。上述觀察不主張減檔／減行即可提升品質，也沒有靜態推估的效能改善數字。

## 正式建置可達性與輸出邊界

既有 verify 的兩次建置結果完全一致，`dist/build-manifest.json` 與 `Release/v2.2.1/BUILD_MANIFEST_v2.2.1.json` 相同。資訊清單有 80 個輸入：74 個 `src-v2` TS 輸入加六個建置／配置檔；80 個 SHA-256 全數符合目前實體檔案。剩餘 19 個來源檔已另全文閱讀：17 個純型別契約／宣告、`globals.d.ts` 與前置 metadata；metadata 實際加在 bundle 頭部，不能把未列入 esbuild 圖視為未發布。此處的 17 個純型別檔不含 globals。

正式 bundle 為 **419,507 bytes**，SHA-256：`e89b94bb92eecb818ce038f09c1de2b9fb5db8b2ffa35adb2357141384db149d`，等於現行 Release 原件。入口逐層連到傳輸、選路、學習、監控、恢復、提前重試及三頁 UI，沒有診斷建構或注入。A01 型別被擦除；A02 計數仍可達；A03 在測試範圍內。O01–O03 部分欄位／方法也仍保留於 bundle，但其用途已按上表區分。

metadata 無 `GM_setClipboard`，全域宣告無剪貼簿介面，UI 無報告按鈕、下載 Blob／Object URL 或剪貼簿派送。正常 `JSON.stringify` 仍用於儲存／設定比較以外的必要序列化處理與工具摘要，不能單憑字串判為診斷報告。負向標記檢查涵蓋 `DiagnosticRecorder`、`GM_setClipboard`、`setOriginalComparison`、`buffer-window-v6`；這些標記存在於 verify 的禁止清單是防回歸，不是功能入口。

## 離線基線與契約覆蓋

完整閱讀 verify、建置、測試監督及其呼叫命令後確認：沒有啟動 HTTP／HTTPS／localhost／loopback／開發或預覽服務。使用固定 Node **26.8.1**、npm **11.19.0**、TypeScript **7.0.2**、esbuild **0.28.2**；專案九個直接開發工具版本檢查通過。

本次只執行一次既有 `scripts/verify.mts`（即 `npm run verify` 的目標），退出碼 **0**：型別、91 個 runtime 模組架構／循環、完整 **1,598 案**、匯入純度、確定性建置、語法、禁止標記及暫存封裝 checksum 通過。failed／cancelled／skipped／todo 均為 **0**，完整測試段工具計時 **14,143.5 ms**，此數字不是產品效能改善證據。封裝只使用 `dist/verify-package-*` 暫存目錄並清理，沒有執行覆寫 Release 的正式 package 命令。

原始執行輸出留在本機忽略路徑 `.work/code-audit-v221/verify.log`，SHA-256 `a164230c14d7a81b425a0d8a24ff60eb0e6dcd2b89394b40e35b5975f60a011f`。Windows 暫存 Git fixture 出現 LF→CRLF 提醒，退出碼仍為零；提醒中的 `src-v2/retired.ts` 為工具測試自建暫存儲存庫，沒有寫入正式來源。

| 重點 | 本次核對的現有契約位置／斷言 | 結論與限制 |
| --- | --- | --- |
| 三頁／保留總覽 | `suites/control-center.ts:11`、`:34`、`:202`、`:658`、`:673`：頁籤、數值標籤、詳細狀態及撤銷操作不可達 | 現有 Node 契約通過；沒有宣稱本次進行瀏覽器 UI 操作 |
| 單次快照與命令晚到 | control-center `:39`、`:469`、`:615`、`:701`、`:820`：建構／遠端刷新各一次、換頁／關閉後舊工作不重建 | 現有契約通過；直接計數來源呼叫，沒有新增效能收集器 |
| Native／Catalog／固定／禁止／停用 | `suites/native-routing.ts`、`native-transport.ts`、`progressive-routing.ts`、`adapters.ts`：確切 URL、禁止、固定與停用原文 | 通過；原網址合法傳輸與已撤銷原線對照分開判定 |
| 預設／保存／等待／失敗／遠端 | `regressions/v220-settings.ts`、`v220-settings-policy.ts`、`suites/state.ts`：true 預設、保存 false/true、缺值非法、不強制寫入、鎖等待抑制、失敗清理及遠端重疊 | 通過；Catalog-only 情境明確覆寫 false，不以測試預設反推產品預設 |
| 影片備援／音訊隔離 | `functional-races/runtime.ts`、`rescue-runtime.ts`、`suites/orchestration.ts:433`、`adapters.ts:2742` | 通過；保留 recovery 事件及影音分離，沒有用報告紀錄取代派送／重載斷言 |
| 恢復額度、位置／倍速、一次補正 | `functional-races/recovery.ts`、`restore-closed-loop.ts`、`restore-ownership.ts`、`recovery-restore-controller.ts`、`player-restore-readback.ts` | 通過；讀回真實 fixture 狀態及副作用，不能證明真實網站本輪自然恢復曾發生 |
| 過期授權／同步重入 | `functional-races/routing-convergence.ts`、`cr-routing.ts`、`xhr-response-convergence.ts`、`cr-xhr-send-conversion.ts`、`suites/state.ts` | 通過；A02 的內部計數觀測另列清除負擔，未以測試通過否認殘留 |
| 取消／晚到／資源清理 | `startup-abort.ts`、`cr-measurement-lifecycle.ts`、`visibility-ownership.ts`、`up141-retry-transport.ts`、`support/scope.ts` 及對應工具測試 | 通過；清理契約涵蓋自有 timers／subscriptions／wrappers，無新增診斷專用資源 |
| 無診斷歷程／敏感輸出 | `up141-retry-policy.ts:350`、playurl-summary 安全欄位、控制中心撤銷操作、verify 禁止標記 | 有負向契約，但舊檢查沒有禁止 A01／A02／A03，所以完整 verify 通過不能推出撤除已零殘留；這是本次明確記錄的覆蓋缺口 |

離線基線未失敗。沒有新執行瀏覽器、安裝版驗收、自然事件窗口或安全差異掃描；這次只有文件，且沒有授權／傳輸實作差異。既有安裝驗收、效用 FAIL、INVALID、停止決策及永久執行禁令完整保持。

## 文件與交付核對

本次完整結果只保存在本報告；文件清單登記為 v2.2.1、2026-11-01 固定紀錄並新增正文保護，HISTORY 補版本／議題／日期導覽，TODO 保存本次完成及未啟動的清除／第二階段狀態。工具結果與維護說明分別追加既有日誌，沒有另建平行結論報告，也不回寫產品 TEST_REPORT 或 Release 快照。

交付檢查為 `docs:check`、`archive:check`、`git diff --check`，並逐檔核對 211 個閱讀基準、80 個發行建置輸入、所有其他未授權範圍與三份日誌的完整既有正文前綴。公開連結檢查的既有不可變斷鏈、歷史原址限制、私有證據及外部未連線限制照實保留；實際數量與最終檢查結果追加工具／維護日誌。

本次交付只提交推送 main，不遞增版本、不建立標籤、不發布 Release，不啟動後續清除、整合重構或已停止瀏覽器案例。

## 附錄：完整逐檔覆蓋與原始雜湊

以下是執行開始 HEAD 的實體檔案 SHA-256（保留原始換行位元組）。閱讀範圍包含空白、註解及所有分支；分段首尾連續、無漏頁。每列結論為本檔實際用途及交叉索引，不能單憑雜湊或搜尋命中代替閱讀。`A` 為確認殘留，`N` 為必要保留，`O` 為可整合負擔觀察；未標 A 的檔案未發現本次定義的診斷專用流程。

### 產品來源、宣告與 metadata：93 檔

| 檔案 | 完整閱讀行範圍／段數 | 原始 SHA-256 | 結論 |
| --- | --- | --- | --- |
| `src-v2/adapters/fetch-hook.ts` | 1–276／1 | `b8d52918c182b2738bc957bec4fa004790d5eba4772f5c060801e811d167cacb` | Fetch 正規化、單一讀取器與取消 |
| `src-v2/adapters/navigation.ts` | 1–33／1 | `c8fa3a0d201ff649199c93469284b57312829d25c52e948df61ac4a7bb562a27` | SPA 導覽與自有包裝清理 |
| `src-v2/adapters/page-playinfo.ts` | 1–116／1 | `9de1d6998e99847b6bdc3deec64ada08721797538a404126d837620b7873d3a8` | 頁面 playinfo 低信任來源與同步處理 |
| `src-v2/adapters/player-controls.ts` | 1–1419／4 | `d6bf36495ace49a57fe481759f0f99d9905ca476b0f0e1953fa29033aeace548` | 可信操作、修訂、還原所有權 |
| `src-v2/adapters/player-media.ts` | 1–151／1 | `acd45f9fecd1eb51e8e87722296b4eb8c304dbe7715cfd29a5f2de558570a114` | 真實媒體快照與總影格進度 N02 |
| `src-v2/adapters/player-method.ts` | 1–42／1 | `691f0becb27af0e53e9f52a53ce6a3bdd46e42db18e8a5b66bc5ca7aea87c012` | SDK 方法描述子及包裝所有權 |
| `src-v2/adapters/player-sdk.ts` | 1–14／1 | `d7fe4b1ce5b0c375525f57d8bd46b67a724b309b490ba3f657b3f8654bd1b6fb` | SDK 與核心讀取／呼叫 |
| `src-v2/adapters/player.ts` | 1–133／1 | `6c8f67fbcbd9f5ffa832151275c934a7ba15d3f1aaa699e8679d5c8334bf9981` | 播放器適配與恢復執行 |
| `src-v2/adapters/playurl.ts` | 1–232／1 | `b41474dcabd3817fcdfa1552247457ec67fcfd30cd274147f9ee848835f3b22d` | playurl 適配與生命週期 |
| `src-v2/adapters/range-probe.ts` | 1–115／1 | `49f363fbde6fb628fa31c45240dcc383870377ad2dd9f8fa1a4ed4e15d066281` | 有界 Range 主動探測 |
| `src-v2/adapters/scheduler.ts` | 1–15／1 | `e3ffcfe1ae9c448db862a5e0610ec01ca89a511d3d8e224933fe862e9421f319` | 注入式排程與取消 |
| `src-v2/adapters/transport-context.ts` | 1–329／1 | `a91f19b567b60b4856edd5890b238b6026a245302297af11c0218acf010feba3` | 當次請求歸因、總覽計數 N03 |
| `src-v2/adapters/transport-ports.ts` | 1–29／1 | `8f26c3ff470310266cd78c8df4d545636a53cb67a120163fa23969b47fee704b` | 傳輸窄契約 |
| `src-v2/adapters/transport.ts` | 1–123／1 | `354a872b80a91ae7c9118a238dbce612be4c2a4efeb8028374c3f4622d3f4b70` | Fetch／XHR 安裝、回復與釋放 |
| `src-v2/adapters/visibility.ts` | 1–114／1 | `f783b2929cf085b4281dd946fcac4f18c9ba6b21860e850db2ac2dfed7b5abf4` | 可見性適配 |
| `src-v2/adapters/webrtc.ts` | 1–78／1 | `679615d4f687ef6ef7e2f9067387f97151b5f49bfa804e243d76c6e616614c0b` | WebRTC 設定適配 |
| `src-v2/adapters/xhr-early-retry.ts` | 1–483／2 | `74e9eb897eeb9ef46df9e2e416fd44c925ecc112deb24b671419ec7b36a95171` | 單次 XHR 提前重試交接 N04 |
| `src-v2/adapters/xhr-hook.ts` | 1–667／2 | `5067077063b462bcf7454ef72ffbf07c8788221e26ee94bdd0d3fbfd062558cc` | XHR 原生差異及重入防護 |
| `src-v2/adapters/xhr-request.ts` | 1–72／1 | `504106cf4489562ddf0b4f0127c279b0945839b8e766d4ea55858372b612080f` | XHR 請求正規化 |
| `src-v2/adapters/xhr-response.ts` | 1–88／1 | `c0f26cb247c8bfa1bd1590c48064072eed98173f8b4a25df057b38a65064512a` | XHR 回應轉換與當前摘要 N03 |
| `src-v2/adapters/xhr-values.ts` | 1–92／1 | `279e619587cd96b3ef93df642de10f14af6ca62826cfb088c397d567ce76096e` | XHR 原生欄位處理 |
| `src-v2/application/control-commands.ts` | 1–35／1 | `b487446e9f1d975e900e600d993de78cf4c0a216c540e4dc3e4e818ae7514343` | 設定及清除學習命令 |
| `src-v2/application/control-ports.ts` | 1–21／1 | `7bd5903e96a39f7a79741c6b433e96669237932e74ebad2dc0bd39e86bb7cb54` | 保留命令契約 |
| `src-v2/application/early-retry-contracts.ts` | 1–148／1 | `af5e8c94a3e539bc6c283df73dbe88ba0828905b0fca8789cd90a1f029aec4e7` | 提前重試功能契約；未接線窄介面 O03 |
| `src-v2/application/early-retry-controller.ts` | 1–291／1 | `5ab7d093f5a1de9119b4c5625772c9182ad56668efd1c020729336a192ff46cc` | 提前重試當前狀態與次數 N04 |
| `src-v2/application/lifecycle-controller.ts` | 1–108／1 | `f29d25c9e82d7f7fc4796cc7e3435369993a193d4e451617999003c948a2c8c1` | 內容生命週期組合 |
| `src-v2/application/lifecycle-ports.ts` | 1–14／1 | `1b9ff043e83e4fa9057f0751cab4d6a4a5df1ab17d30a58ab8a9d28bf43159c1` | 生命週期窄契約 |
| `src-v2/application/measurement-contracts.ts` | 1–72／1 | `bc45358d72022fe8030910fb828d7ab05fae9d312f97a37d1187eb1e1ed4c00a` | 量測資格、當前狀態契約 N04 |
| `src-v2/application/measurement-controller.ts` | 1–696／2 | `5db69642aa687a6bf933b78b3edab275ff03592ce046add02dafd1c7ab445ae1` | 起播與健康探測、額度及清理 N04 |
| `src-v2/application/monitor-contracts.ts` | 1–76／1 | `9b7300efc66da03648088f7baea351b026d90a9e9981f2f1c5d51fbfc3bc427c` | 監控狀態契約 N02 |
| `src-v2/application/player-monitor.ts` | 1–537／2 | `b049d14ce58f33ba14911431765155955be7496b1ed4f045bb61df3bbdd3f863` | 一秒監控、進度、備援及取消 N02 |
| `src-v2/application/playurl-contracts.ts` | 1–63／1 | `566d1fb5a15be9c496589b86779375732139c78fac65bc8aa20378bef8709d34` | playurl 內容與授權契約 |
| `src-v2/application/playurl-controller.ts` | 1–286／1 | `214c8ae00eac8e0332dc04dbd4071eaf9e4e0c038af71adc09677d232c4a600c` | playurl 正規化與內容週期 |
| `src-v2/application/ports.ts` | 1–104／1 | `f0153e91ea7c6351c5fc23ba8d061bca9ab957ce08bce53cf5470fb0d3ea15d2` | 播放器、排程與探測基礎契約 |
| `src-v2/application/recovery-contracts.ts` | 1–108／1 | `6913126b7d0eaf0aa40e89ea1572593c706ffd63c840d66a27e0e95f1ce6b16c` | 恢復階段與所有權契約 N02 |
| `src-v2/application/recovery-controller.ts` | 1–1021／3 | `cd8e602c9029863e3664f1fa36d867db6275ef4c8c8554cd89c0e370361bb141` | 單次恢復、位置／倍速／播放還原 N02 |
| `src-v2/application/route-contracts.ts` | 1–233／1 | `978ec38695b0d0eac39b51dabd28db5f179d3604147f4b0889a69222f6529515` | 快照含確認殘留 A02；其他候選 O01 |
| `src-v2/application/route-coordinator.ts` | 1–1900／5 | `fcb1f65dc149b32bd4aea9523a4a198c236838c0292f5b8e7e27c08725c379d5` | 快照計數 A02；功能集合須保留 N01；候選 O01/O03 |
| `src-v2/application/routing/candidate-planning.ts` | 1–125／1 | `b535ea5fb63581f1f8dae29c1896e5ae8f549512ff88b5e7dce478aa9e4e53f1` | 候選選路及規劃 |
| `src-v2/application/routing/player-output.ts` | 1–147／1 | `7e716a5e5b6008bb63339a77a2bd6cd39d3df71c1a2de8cb461f1b4d4b2ef93c` | 合法播放器輸出與備援 |
| `src-v2/application/routing/request-routing.ts` | 1–62／1 | `1f2dabee294f9c21b8b4fe3e5a45c69668a85178dba0bf6336ce9602688cff4b` | 當次請求選路 |
| `src-v2/application/routing/route-materialization.ts` | 1–57／1 | `c7312a72c606cee9d4fad52a5d16e4cf2a502a9dccc1dbfa885959360347440b` | 精確授權路線實體化 |
| `src-v2/application/routing/route-restrictions.ts` | 1–82／1 | `777b55649123c37db41d22f8a527f21c9f67679b15952660bdc1a65ad6f5cf0e` | 禁止規則與資格 |
| `src-v2/application/routing/routing-ports.ts` | 1–46／1 | `ac3492df5c0490003ea9ebdc9447fc9ff4b11197345fbdfa1745b909163235c7` | 選路政策窄介面 |
| `src-v2/application/routing/transport-result.ts` | 1–102／1 | `5f44af33147e7ea2b957507d5700d6a5999ecba930e8fa7abb6ebfd49e5cf71f` | 傳輸結果至選路學習 N01 |
| `src-v2/application/runtime-controller.ts` | 1–84／1 | `3e1848387f30d85d691809772a8cb7bff90bfbd54bcbd2386ee1c79bded92965` | 影片備援事件轉交恢復 N05 |
| `src-v2/application/runtime-ports.ts` | 1–25／1 | `c137be4467d501c9784db9c82eb6b936ddba142a8f22d1d193a6280acdbdf1f7` | Runtime 窄契約 |
| `src-v2/domain/catalog.ts` | 1–60／1 | `da8c155d165c642d27ee0d5663978dc47f052627c13fd3fc4eb686ecc1100ad0` | 可信內建 CDN 清單 |
| `src-v2/domain/early-retry.ts` | 1–91／1 | `04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37` | 提前重試純資格判定 N04 |
| `src-v2/domain/evidence.ts` | 1–125／1 | `09536c6b455bfb322e75e6b1dc464ddba3e52e35c22609a10e3435d5dcc7fdfc` | 有界速度學習與熔斷 N01 |
| `src-v2/domain/model.ts` | 1–246／1 | `99d7c66e109ea5fdec0083ae6d86decfdd758a29ded48c3aecfaf55a863b4b99` | 兩個失去用途的事件成員 A01 |
| `src-v2/domain/playback-progress.ts` | 1–29／1 | `ce5c9ae64922b62655e20b97f798da38d5ee1c2b68f3a85f83a304ff2b02af82` | 時間／總影格進度比較 N02 |
| `src-v2/domain/player-output-plan.ts` | 1–97／1 | `87b54160afadd86b14fa61c644b1d66c09e318752321fcf12f4280aad6ba8dab` | 播放器輸出純規劃 |
| `src-v2/domain/playurl-content.ts` | 1–80／1 | `f7ea073fcadf47c69f1e3041d64211462dd9098f98642228d7d53263d914887d` | 內容目錄與指紋生命週期 |
| `src-v2/domain/playurl-model.ts` | 1–22／1 | `d6a8eee3a41291cebc65194a6523d454c22947ef9c0813d228d74c9be22d597b` | 播放資料格式契約 |
| `src-v2/domain/probe-model.ts` | 1–5／1 | `4549d113c83233f0ea3615ef701f05a94215df08af613f0fdc3e54f3890e8e03` | 探測結果契約 |
| `src-v2/domain/probe-range.ts` | 1–43／1 | `7cf9b62c33ae30f5bbd6f6db4e50e5badc35b1fa0bfedfe46dfd8bfb425b8121` | 探測範圍純規劃 |
| `src-v2/domain/route-policy.ts` | 1–47／1 | `73ce25cc3f5bfbb07246487bd0f0ff5b509f18c8176e5f7834ad47358fbc15e5` | 選路政策純判定 |
| `src-v2/domain/routing.ts` | 1–234／1 | `4afc33e629e7da0c38a635289c661055e7952057d4856e2aa3e6ddd1bf164dc5` | 排名與需求餘裕 N01 |
| `src-v2/domain/transport-model.ts` | 1–47／1 | `7db42b25b0770a9d9b0665f5b7d686ddaa643f654dcfffbdecad5f512d253538` | 傳輸當前摘要契約 N03 |
| `src-v2/domain/url-policy.ts` | 1–107／1 | `22de63bea2e0a0255c85711b8aecb05629628d1eac81c55a6e438bdf384b360f` | 媒體 URL 分類及合法原網址 N06 |
| `src-v2/entry.ts` | 1–173／1 | `be89b5a181dd2223224db79b52f8cbfb3fc49b1ee536369840cf65c2f77cc4c9` | 唯一入口組合；沒有診斷注入 |
| `src-v2/globals.d.ts` | 1–12／1 | `1b8cb3275e13390b6dc043286fd95afbad90cff72219c35a1fbe840d5b0088c9` | 平台全域宣告；無剪貼簿宣告 |
| `src-v2/metadata.txt` | 1–39／1 | `ee6ec6d2929cd23cf6660f21ad1e90a1b9304e3594c97ac829ad9b820a0add68` | 腳本 metadata；無剪貼簿授權 |
| `src-v2/platform/runtime-id-port.ts` | 1–3／1 | `5e36145e91f90bb44b95d9a48727b9df672aadd88f0014c15c1c7533d56e1f32` | 執行個體 ID 窄契約 |
| `src-v2/platform/runtime-ids.ts` | 1–20／1 | `0f23e774e77bd29f7917a839fa07cd012af5a32fedf82bd8fc887bb63e1a7d6e` | 執行個體 ID 建立 |
| `src-v2/platform/storage-port.ts` | 1–7／1 | `d87da38f7797216eefd7d91391cb5fecb8265921deb7d1f4e769f3b970f08a62` | 儲存與鎖契約 |
| `src-v2/platform/storage.ts` | 1–47／1 | `1f4bd90d5d709d0eef64152ad6f3a2c7d1267e08d03c504a7cc0afa6d1859d8d` | GM 儲存、鎖、訂閱與清理 |
| `src-v2/state/evidence-ports.ts` | 1–14／1 | `14e8688e5437689932303ca27c35fa9285411ca6448c4c16207c6f64e826ea4a` | 選路學習窄契約 N01 |
| `src-v2/state/evidence-store.ts` | 1–193／1 | `bbc5e57574e9bd479b448c9ab0f2d5599af9ad0c1bbbec2eeaa99b8eab2a8389` | 有界選路學習持久資料 N01 |
| `src-v2/state/measurement-meta-ports.ts` | 1–11／1 | `6b5b29ef3600940bd7282a7c40766fb5c42ad477757a289dd3c12477fe3c1c64` | 量測 metadata 窄契約 N04 |
| `src-v2/state/measurement-meta-store.ts` | 1–47／1 | `687634317bbca20d0434ef1b70186bbac58f5aff3300d0d4e00929d265da90f6` | 探測游標／冷卻與鎖 N04 |
| `src-v2/state/restriction-contracts.ts` | 1–27／1 | `5af87a6620869e2e0558c43dc1bf0534d4bb8bffa4d878d8444b3727e68e6399` | 禁止資料契約 |
| `src-v2/state/restriction-store.ts` | 1–163／1 | `99d6a2858422df8e94e221950f7f9eb713519a81098fd0eefbf48de7bc7589fc` | 禁止資料與遠端合併 |
| `src-v2/state/session-contracts.ts` | 1–27／1 | `5a4d84b961cac8a2057b64f59cd19b9bbf66cd9343a7f482229685122fd00be7` | Session 契約 |
| `src-v2/state/session-store.ts` | 1–66／1 | `85ac2878cfc33b82f4a704642d83d66f893097a0bafd77f32b906e1efde61ef6` | Session 與內容週期 |
| `src-v2/state/settings-contracts.ts` | 1–34／1 | `91e636c43e289e59546b5091ef2c69f3e5884c84c1919bc3a1acbedc32085a52` | schema 2 設定契約 N06 |
| `src-v2/state/settings-policy.ts` | 1–26／1 | `2d3bd64447891ddee7991f8c523f7b80daa230480b1c3a60e7b28930c53ce881` | 逐欄設定失效比較 |
| `src-v2/state/settings-store.ts` | 1–192／1 | `ba60bb9750a6bf606bffd5a9844c866321559d325c2f9ce77455514e7f9e2f8f` | 設定預設、抑制與鎖 N06 |
| `src-v2/state/signed-route-vault.ts` | 1–484／2 | `24d5f7bc9dc46a1758478a251f5ac075465c0f52e40736692d35f59143d63322` | 唯一簽名授權索引 N01/N06 |
| `src-v2/state/vault-contracts.ts` | 1–92／1 | `4d7b27000906baea4a9b21ce8a68e5f90719d66b317720e3eeacd8dab07bb66a` | Vault 不透明授權契約 |
| `src-v2/ui/cdn-view.ts` | 1–93／1 | `4c9f3a2f0d4e43a8b2ea8491d2c9a50b3d891c9bb9f9121debc9e6f93f51c825` | CDN 當次共用模型 N03 |
| `src-v2/ui/control-center.ts` | 1–236／1 | `c78731d7dc1df0f7e70db7264fe10230fb9e78ab27e87847777a2109a2969093` | 三頁與單次刷新 N03 |
| `src-v2/ui/control-contracts.ts` | 1–96／1 | `2b7968ef5e728830cf3601c8bb154c30079ff1ff7c3025f7f46761778f56772a` | UI 契約候選 O02；非報告管線 |
| `src-v2/ui/control-read-model.ts` | 1–32／1 | `1d10441be0394bdf20424f3b1b0610a6886c9e9f48ee7d3d7e4a79516674e7a0` | 唯讀模型／功能通知 N03/N05；候選 O02 |
| `src-v2/ui/elements.ts` | 1–32／1 | `b56e1315765050b1fee98563ccd1a01e195dc7eee109e15b828a7d0651a67e7f` | UI 元件 |
| `src-v2/ui/labels.ts` | 1–132／1 | `aba4bee094132ccbeb10472d855c593a228f7305f0352dc1f8164b3e4286e617` | 當前狀態標籤 |
| `src-v2/ui/overview-view.ts` | 1–172／1 | `08ba2f29dfb89f3f8a055619ecba0228119d4432479098aafa2e6e2521c21f10` | 總覽數值及按需詳細狀態 N03 |
| `src-v2/ui/player-panel.ts` | 1–73／1 | `011ae453e4d6dce5972eb07af28a46971e411d3bed7f7ed4d37d7909fe6006a9` | 播放器面板入口 |
| `src-v2/ui/setting-controls.ts` | 1–43／1 | `182c5a6a38c15ff92655cbc176afa37f3f61fba1e018e5789d193a6de212afcd` | 共用開關與可信命令 |
| `src-v2/ui/settings-view.ts` | 1–91／1 | `aff368ae2a54bc14017e1aea695b26971577de3c2608db0085b922f4d112fda5` | 六項設定畫面 |
| `src-v2/ui/status-summary.ts` | 1–150／1 | `f00ac55b7395bfcf4dd2788a0ef49bb9ea3ad142bba75f8b34702e7e8e798dd9` | 按需詳細狀態文字 N03 |
| `src-v2/ui/styles.ts` | 1–33／1 | `5e15f6ad9faa3f4b86f02fc73d45eed61fcc7ae3472de9cdca427cf63965112c` | 三頁控制中心樣式 |

### 測試、回歸與支援情境：90 檔

| 檔案 | 完整閱讀行範圍／段數 | 原始 SHA-256 | 結論 |
| --- | --- | --- | --- |
| `tests-v2/domain-boundaries.ts` | 1–233／1 | `4f55e04ded32cc7efec4c04d0ef4d3c06a743ac77d5f7b6c88d1e67af686e9d7` | 純領域邊界；數字 fixture／無效敘述觀察 O04 |
| `tests-v2/domain-progress-convergence.ts` | 1–70／1 | `f9342a97763d1507e360ffa46ba46139fb0fa3d521156148227f502ae84ff209` | 時間與影格嚴格邊界 N02 |
| `tests-v2/imports.ts` | 1–12／1 | `f03ab24f3498d7b5421f3ec2402d367cf70957fc9f60c1b0af92145d2afa911a` | 全部非入口模組匯入純度 |
| `tests-v2/regressions/archive.ts` | 1–610／2 | `df9650dd907ce8137b1eabe012d8a3520b71497e57f8893789715d348c4f42fb` | 封存原件與追加保護 |
| `tests-v2/regressions/cc39-integration.ts` | 1–127／1 | `c3858c471f06708a11a95aa0efeb4bf1ba7d0b6b244d51f3eb0a84c3eda53e46` | 控制命令、設定失效與接線 |
| `tests-v2/regressions/documentation.ts` | 1–871／3 | `1b997018bf7db148bb6693d85779215a71f7f490668d73e88a9b468dca93c120` | 文件分類、退役來源與連結保護 |
| `tests-v2/regressions/functional-races/adapter-controls.ts` | 1–331／1 | `0507b45e769ac04a8ef70223be75c8fcc14fe9279d6fdfa988a01c58eaa82379` | 導覽、可見性及包裝清理 |
| `tests-v2/regressions/functional-races/br01-followthrough.ts` | 1–924／3 | `fceae29dea8a33729112efcbc163040d5d5562cf1608f52839b3342b018186c9` | 重載後可信操作與續行；固定掉幀欄位 N07 |
| `tests-v2/regressions/functional-races/br01-play-intent.ts` | 1–400／1 | `1c8441db410812493d06562b1f0b29ea425e913123461bcf4c261e37ea4c9be9` | 可信播放意圖與取消 |
| `tests-v2/regressions/functional-races/br01-player.ts` | 1–167／1 | `f2bf4a7e0a3b3b2b5bb020c81d3b4c175b60dc7db5b9fd5f5237838e5c7037d9` | 播放器 SDK／原生落點與重入 |
| `tests-v2/regressions/functional-races/br01-reload-controls.ts` | 1–690／2 | `876e730d18fdc32a2afb60fbf15c8a90b6d94b65813197e21ab6a189b5459ed9` | 重載控制方法所有權與清理 |
| `tests-v2/regressions/functional-races/br01.ts` | 1–475／2 | `6da57b64c24f457a71186a7ee79f03abcf5316dcb69ff5a73d593091f3acee57` | 恢復觸發、額度及期限 |
| `tests-v2/regressions/functional-races/br06.ts` | 1–1539／4 | `e74ba593411491b9ff6288036af46926911adb1782bf7667e5f29e32d4b5823d` | 新尋位意圖撤銷舊恢復 |
| `tests-v2/regressions/functional-races/br08-player.ts` | 1–471／2 | `ca342d77a49770655d7b8dfe22738aa0e888346106c401f80d1e7037541bec48` | 拖曳與播放器控制適配 |
| `tests-v2/regressions/functional-races/br08.ts` | 1–767／2 | `24a94b0b9c93b28540d42fbc2b3e6dbf83f9dde0b1e306b6e33e473b9e404c18` | 拖曳期間不得恢復 |
| `tests-v2/regressions/functional-races/br09.ts` | 1–653／2 | `c97a25a0a0d5d0f8d953f26fd19c7d520dc91e9aaaa9f0260c99518f267edf49` | 歸零目標撤銷舊位置 |
| `tests-v2/regressions/functional-races/content-domain.ts` | 1–117／1 | `31e3b8395f6221b41360292749edb185e4cfc680ca92caf14b7436ea15157271` | 內容目錄歷史上限與汰換 N01 |
| `tests-v2/regressions/functional-races/content.ts` | 1–381／2 | `ad46827191cf1253cbd0d3e55f6512f12d63932cd4ff3cea80fc99622708ad24` | 內容週期、低信任資料與晚到工作 |
| `tests-v2/regressions/functional-races/cr-measurement-errors.ts` | 1–53／1 | `fca970add230f345899b5ab81b7090f6b5d6cf59917f676d661b9e1af97aec3a` | 量測保存失敗及未處理拒絕 |
| `tests-v2/regressions/functional-races/cr-measurement-lifecycle.ts` | 1–158／1 | `e3554170207cefd395eade990e0c30b62eac336cf8361324c8dee76a706b3c53` | 量測重入與生命週期 |
| `tests-v2/regressions/functional-races/cr-routing.ts` | 1–226／1 | `7d273b68587a827aa33845619c0d10a28d0e66911c7df228fdb583a26456d98c` | 選路授權及重入競態 |
| `tests-v2/regressions/functional-races/cr-startup.ts` | 1–157／1 | `a9cd2377844daa153d9ca41cbea3b1485024ce28218cbdbd95c7dccbfe636778` | 起播工作與清理 |
| `tests-v2/regressions/functional-races/cr-xhr-fixture.ts` | 1–183／1 | `0d483d67dcb751bae93ffe223e468e95ac209ddfe8e47867f3902d1a8c7de23f` | XHR 合約情境資源 |
| `tests-v2/regressions/functional-races/cr-xhr-headers.ts` | 1–96／1 | `617f08c5e73e1fdbaebb4e49987578524461837b36da556e006adb646c7b1332` | XHR 標頭及原生行為 |
| `tests-v2/regressions/functional-races/cr-xhr-send-conversion.ts` | 1–86／1 | `fdcbdf4294ba77b18099a2294ea0a482f853b5fff0bf9f66a740ffafe6c3d940` | XHR send 轉型重入 |
| `tests-v2/regressions/functional-races/measurement-metadata.ts` | 1–489／2 | `41b31aae59fc476d5c454f98409eb4265014e04780f7778f095af47f00aa5a90` | 量測 metadata 與遠端協調 |
| `tests-v2/regressions/functional-races/player-convergence.ts` | 1–425／1 | `a9984661f87df4e8e5314e5e3f3106b4795bd2de43c8b042f2a46dc125fa37d9` | 播放器收斂與所有權 |
| `tests-v2/regressions/functional-races/recovery.ts` | 1–682／2 | `07b8df6fe46ab5277c9740a4b2609377e695198f42c17c5d2f86017b5fda1acc` | 恢復取消、額度及舊工作隔離 |
| `tests-v2/regressions/functional-races/rescue-goals.ts` | 1–229／1 | `73c3b4d4fd8dec0172421cf8819b0dc14da3f2e271166309bda4aabca763466e` | 位置還原目標 |
| `tests-v2/regressions/functional-races/rescue-position.ts` | 1–159／1 | `c5e96862c0b3f9326d1850200f8e3f633aa576c53cb355e44070cc6815857e93` | 可信位置與實際副作用；Node trace N07 |
| `tests-v2/regressions/functional-races/rescue-recovery.ts` | 1–291／1 | `a8a195047dbc5e05e0b4e427372794e75bab338bc7d23f2076615c5ed4831a2d` | 恢復階段與取消 |
| `tests-v2/regressions/functional-races/rescue-runtime.ts` | 1–302／1 | `15b65b0c1184ad5bb62dffcff99fc25d7c21214c1062a31aae5f4924de53d696` | 影音備援隔離與功能事件 N05 |
| `tests-v2/regressions/functional-races/rescue-sustained.ts` | 1–76／1 | `3f2fef002391bf669175baa4b86bc71d6432ad9e605f73e71a5be34d1aa205c6` | 逐秒恢復後進度；測試樣本 N07 |
| `tests-v2/regressions/functional-races/rescue-timing.ts` | 1–303／1 | `3d16e6652410663759d7959c1a7aeb77263d22ca17d638baf1ee3bb890d54c45` | 恢復原有時序及期限 |
| `tests-v2/regressions/functional-races/restore-closed-loop.ts` | 1–388／2 | `c30eece30807066dee5f06e3fa0e9f8c95ffc2af62b198dbe5acd03fbc411913` | 還原閉環與失效 |
| `tests-v2/regressions/functional-races/restore-ownership.ts` | 1–49／1 | `201b187315dc0d0b99954f5f3086bcfb3fde5981779f5a2fa1b936beedcc57ed` | 使用者操作優先權 |
| `tests-v2/regressions/functional-races/routing-convergence.ts` | 1–416／2 | `9bcca7003b6071f40d602a4511ff49b267807ce27f2b2053361ca2a78c3a5478` | 同步重入、提交順序；A02 測試引用／O01 |
| `tests-v2/regressions/functional-races/routing-fixture.ts` | 1–75／1 | `740a3b8b1d0bb6e4b02efd4069745ae6cb8b69052302bab197889e24862086f1` | 具名選路基礎情境 |
| `tests-v2/regressions/functional-races/routing-modularization.ts` | 1–144／1 | `116774c3a445c206f7844f613bdd45a28151b7240c882a65ece130017abeff1a` | 選路模組化契約 |
| `tests-v2/regressions/functional-races/routing.ts` | 1–280／1 | `6bc660b049dc57d343393fe43a0c5e62b6ccb2555f9630bd9c38a82d3a33b788` | 選路及儲存競態 |
| `tests-v2/regressions/functional-races/runtime.ts` | 1–265／1 | `d06b34ef51772c84843d0ae8d9991a07ff3e7f0612ec72388fe451b6ac418ebd` | Runtime 影音備援、設定與清理 N05 |
| `tests-v2/regressions/functional-races/startup-abort.ts` | 1–119／1 | `f9c326206880fa815a675324a0586877143010b708b54c2a35f96a4a7136f518` | 起播等待取消及原因 |
| `tests-v2/regressions/functional-races/up141-backups.ts` | 1–175／1 | `0e7bd7e4d8e26e8943f7f8bde4eef3550eb7cad566c4fa993d62754b978989e5` | 備援家族排序 |
| `tests-v2/regressions/functional-races/up141-probe.ts` | 1–243／1 | `9643dc259a5aee75f564e8eb8ba089f05fb699ca2748ab59889803c9451e3aa5` | 健康探測範圍與節流 |
| `tests-v2/regressions/functional-races/up141-start.ts` | 1–182／1 | `54c75a4c3855d9dfc6e7652de354f1743989dfaab1a2a5677ae1d45d508ee527` | 起播提前放行 |
| `tests-v2/regressions/functional-races/visibility-ownership.ts` | 1–273／1 | `2150d6c3bb34782ae9101b51048c8f281a9c7ae2313c542b18252e93f29d4145` | 可見性包裝所有權 |
| `tests-v2/regressions/functional-races/xhr-response-convergence.ts` | 1–393／2 | `03922b07e1742e01f46db19b7aa8cc6559a2edb0902d1f30cca9e7bf46dedc7d` | XHR 延後回應與舊身分 |
| `tests-v2/regressions/functional-races/xhr.ts` | 1–1430／4 | `e3338bddd5583f9bbf84040e9ac9c14e698a81559347dcfc5792f84cdf7b07bd` | XHR open/send/abort 原生相容 |
| `tests-v2/regressions/player-restore-ownership.ts` | 1–105／1 | `576b10f80e0f97ad50967aed98ce39596096628f6721db9245edefb73f73e001` | 播放器還原所有權 |
| `tests-v2/regressions/player-restore-readback.ts` | 1–130／1 | `1cd9b6e4380cb3545fd1b4c21faa2aeb6b1ae42ac411406ef62468f0c7916751` | 還原讀回與一次補正 |
| `tests-v2/regressions/project-config.ts` | 1–195／1 | `5ab5afcc6e2cbb01bbcbe7aed13c11084443239744a2f1a4772fd50124d69ecd` | 固定工具配置核對 |
| `tests-v2/regressions/recovery-restore-controller.ts` | 1–243／1 | `b0b4f1e0683eafebc9b450129d0048b1173131d76515c098f113e959ea1c5750` | 恢復還原控制器閉環 |
| `tests-v2/regressions/up141-api.ts` | 1–264／1 | `af7e12f656084e290e181293c91b6e28b0b5326920c03cfb31a15632598e0eef` | 播放 API 辨識與原文傳遞 |
| `tests-v2/regressions/up141-retry-policy.ts` | 1–387／1 | `06ae28ac723300dd68b49570ccdc42d5896ba01a34fbdc0014c5cc638da1656b` | 提前重試資格、取消、無歷程快照 N04 |
| `tests-v2/regressions/up141-retry-transport.ts` | 1–683／2 | `f470ac2b635a24d6dd5bafbacb1ab343f2245fb1e6cb335a57814c3d9d24b695` | 提前重試派送、授權、清理；受控樣本抑制 O03 |
| `tests-v2/regressions/up141-test-release.ts` | 1–285／1 | `76b08dea183963d54e2974f89bae38eca1886a2d6b4c2510502fe75935e471c4` | 保留功能離線效用模型 N07 |
| `tests-v2/regressions/upstream-comparison.ts` | 1–490／2 | `a88d59859aed7d879d9df01ee09ae5a492b52fe0ba24d95c2c8b2dd58bbb5e24` | 固定上游模擬器的有效性契約 N07 |
| `tests-v2/regressions/v220-settings-policy.ts` | 1–42／1 | `82721aa249bc998826856f22dfae004bb0fc79ce1179cd722411905863bc6215` | 逐欄設定比較與失效範圍 |
| `tests-v2/regressions/v220-settings.ts` | 1–62／1 | `2b7312b1ef33303532f7f1a1036fea83c387310f0a28dfced956ac939e8239b1` | Native 新預設、缺值／非法／保存／鎖／失敗／遠端 N06 |
| `tests-v2/suites/adapter-boundaries.ts` | 1–435／1 | `ace0ed41c14dc6c3730e9e966a0bd73bb4948f3191b9f84a2666021ab666ab25` | 適配邊界與清理；前置串接 O04 |
| `tests-v2/suites/adapters.ts` | 1–2870／7 | `d57b3a87fafe82bc9b0c3a848a67be4a833acc3c5f896e3fd3f3af3e6f4cd723` | Fetch/XHR、合法 Native、禁止、影音隔離；前置串接 O04 |
| `tests-v2/suites/application.ts` | 1–2741／7 | `29da8ea9846d0864cad6c3519624af7473630bed139b6daaec7dcc2d368b18ec` | 量測／恢復／選路契約；A02 引用、前置串接 O04 |
| `tests-v2/suites/control-center.ts` | 1–837／3 | `2b6bf67d0ddfd2ce1be0f7e182f06fda67fa9f329289912ce9da253f775d1708` | 三頁、總覽、單次快照、可信命令與失效 N03；舊名稱 O04 |
| `tests-v2/suites/domain.ts` | 1–389／1 | `5edd6cdb22d56f72674eabe4775f523bdf0e082afc0758b03b8bdfdfe4ce80ed` | 需求／排名與有界學習 N01；無效前置 O04 |
| `tests-v2/suites/measurement-state.ts` | 1–151／1 | `c97f7b3ef406ff27b1f75765abc42f0fda588cbc95cadcb06911f72ed4b604a7` | 量測儲存與舊 lock waiter |
| `tests-v2/suites/native-routing.ts` | 1–1499／5 | `3ffe608661967d6c065a8959a5b15c81eab765834dea17a639e59899a4f87aba` | Native／Catalog、禁止與過期授權 N06；前置串接 O04 |
| `tests-v2/suites/native-transport.ts` | 1–2310／6 | `1b345090fcc1cd05041429f0310df18371f507721969ab513a7f2b086006924e` | 等待後／送出前授權重查及原生相容 N06；前置串接 O04 |
| `tests-v2/suites/orchestration.ts` | 1–483／2 | `a66ca2542de38f041eb721805b28c51532877c832c91a0b1375be686d8ad6076` | 原線對照狀態／舊診斷參數殘留 A03；功能恢復契約 N05 |
| `tests-v2/suites/playurl-summary.ts` | 1–635／2 | `2e485f40c5011c2403c5e430317f4ae5754c53ef12f4b2d92db065cad539fe8f` | 當前播放摘要、安全欄位與 getter 快取 N03；前置串接 O04 |
| `tests-v2/suites/progressive-playurl.ts` | 1–1017／3 | `146e69f80ae1213a3d760453670e0cec6f37f53a7ccbaa9a0577966c2c54b1c6` | MP4/FLV/DASH 內容與授權 |
| `tests-v2/suites/progressive-routing.ts` | 1–1129／3 | `34a868168fc066e678045f5f9aab808b558cd32fd54a4d662724f49841a49e6e` | progressive 選路、探測、失效；前置串接 O04 |
| `tests-v2/suites/progressive-transport.ts` | 1–295／1 | `945eb2b31708fc90f7977823e065a0c9c7a8f8f6e449d0962c0c959f4dc4de4d` | progressive 傳輸、取消與停用；getter 副作用 O04 |
| `tests-v2/suites/state.ts` | 1–1638／5 | `b04ae083ec39a0d9e14c8520d210df259b7959d715ef20d96687d66f73f4331f` | Vault／設定／禁止與過期授權；舊命名／前置 O04 |
| `tests-v2/support/catalog-settings.ts` | 1–15／1 | `f8c4daf03bb628df625e29163e7ae9051c9d78abd84f9458f5a4110d9402e0cf` | 明確 Catalog-only 前置 N06 |
| `tests-v2/support/clock.ts` | 1–79／1 | `4ae9355a5660a8abd58efe850b48b97251854ae68f193b448d6967dc5a60da86` | 虛擬時鐘及自有任務 |
| `tests-v2/support/controllers.ts` | 1–53／1 | `ee95e93d2aaafbf74f4a3564083403912defc78f077c6480fd925c3cf6d4ab5e` | 窄功能 stub；各案例覆寫必要方法 |
| `tests-v2/support/deferred.ts` | 1–22／1 | `45a9bb8eed19e68f17063568bbb899171b12ceb968a9601dde4de23dc9e9e3a5` | 顯式完成／拒絕信號 |
| `tests-v2/support/fixture-context.ts` | 1–9／1 | `8c2fe97ccaaa0b8a67ebb68d28bd7317a538ec1c5b8559cf1030e92a1359c040` | 情境描述子與可變閉包 |
| `tests-v2/support/measurement-storage-scenario.ts` | 1–107／1 | `b54d157cc74661cf85dc632a1e6545b8edf08e1326ea166be118e4e9e0325d37` | 獨立子程序觀察實際儲存拒絕 N07 |
| `tests-v2/support/player.ts` | 1–80／1 | `e65b493adec61b12d6d99ca8a95a6e47f289275ae5f2b777062992556dbc8d02` | 恢復讀回、落點與 SDK 模型 |
| `tests-v2/support/playurl.ts` | 1–11／1 | `30cb1f4e6520711bde2b33dfce57ee69c3af6217d8039523b294516c2803345d` | 具名播放轉換結果 |
| `tests-v2/support/progress-event.ts` | 1–10／1 | `7a224fe59b2367ad9b90a84b3c2e3a94548ada32c7da07fb5093cd94fc4635c6` | 合約用 ProgressEvent 形狀 |
| `tests-v2/support/rescue-acceptance.ts` | 1–61／1 | `ea919a28e2bddded0e41164d080305b1b856d092563310be5eb624622953f965` | 測試專用持續播放與位置判定 N07 |
| `tests-v2/support/rescue-dom.ts` | 1–253／1 | `53c4882ef72c484505a674cacea81195702cc97c9708fc858a7815509919bcc3` | 可信輸入模型及資源清理；固定掉幀欄位 N07 |
| `tests-v2/support/rescue-player.ts` | 1–71／1 | `e3412f216170fa0c605c5bee0488a42bf8cf00f58a6771b6aef1a1cebf856a8d` | 恢復副作用情境及 Node trace N07 |
| `tests-v2/support/runtime-fixture.ts` | 1–266／1 | `dddde8bd72b701836af9ae76f4bffdad8fbb747636b6b9832d5bb27ea05b7771` | Runtime 完整功能接線情境 |
| `tests-v2/support/scope.ts` | 1–52／1 | `fe41d8fb7f532dc375fe412c3b6cef7dfd811c872287898dfdc02a34b2105bac` | 逆序清理與全域描述子回復 |
| `tests-v2/support/startup-abort.ts` | 1–94／1 | `63b349335c317903ffcf6c43821fb81bb06a4adf58bfefa39e7ad038fca3c0e8` | 起播取消顯式情境 |
| `tests-v2/support/storage.ts` | 1–42／1 | `3b51a58218d17282d06c37f185bb52528ea66c24ee44d32c0676b0a2fa1ff6e3` | 儲存與延後鎖模型 |
| `tests-v2/tooling.ts` | 1–596／2 | `3f8b790eaa5272cd496fd6a3ac58cd33a1c65f2f4e1c62d3ec1998ae63bad0ef` | 測試監督、報告、期限與清理契約 N07 |

### 建置、檢查、測試與評估工具：28 檔

| 檔案 | 完整閱讀行範圍／段數 | 原始 SHA-256 | 結論 |
| --- | --- | --- | --- |
| `scripts/build.mts` | 1–87／1 | `c790d7a2e22bcc02831e710828633822c5036cdd8bcc47d92f18a9731d828e9e` | 純本機單一入口建置與輸入雜湊 |
| `scripts/checks/architecture-check.mts` | 1–18／1 | `78b2aecab394ca1d8b0a5a710e137a70e15c8f3cc3132448ee39c26d89f63d8c` | 分層 AST 圖檢查 |
| `scripts/checks/architecture-rules.mts` | 1–207／1 | `e23caeb1619de7a4a9f9358bf17ea603403e7ffb223385b7f4e10d331cda0926` | 分層、契約及副作用唯一所有者 |
| `scripts/checks/archive-check.mts` | 1–759／3 | `25dce02f4817098a853cdd1cdb03100b9a8f56dc0cda0feb5be30a0fd5d266c0` | 原件、搬移、追加日誌與 checksum 檢查 |
| `scripts/checks/docs-check.mts` | 1–714／2 | `3af97bb3163b804fc94dc4c525e5934f61cfe77346e3803698a0b1c6defb5848` | GFM／分類／導覽／保護；通用檢查報告 N07 |
| `scripts/checks/format.mts` | 1–61／1 | `7167b8534d3e415415ffbd2451077fb93d5a414acf9978a2fca293ddc2175263` | 固定範圍格式檢查／整理 |
| `scripts/checks/project-config.mts` | 1–89／1 | `21dca014148aaa79f25f21451caf8ae284ec882596cdff998265db04115062ef` | 固定工具與版本一致性 |
| `scripts/checks/typecheck.mts` | 1–9／1 | `77cdb95973b549f97896692944a74da0b02cdf890ac2efedeb08421ac7c6f117` | 三份 tsconfig 型別核對 |
| `scripts/evaluation/early-retry-evaluation.mts` | 1–167／1 | `5e95d92ac5ffc0da15cfef3f014e1cfcb78c00ef9f868ef81a7c26089add5601` | 保留提前重試功能離線效用評估 N07 |
| `scripts/evaluation/upstream-compare.mts` | 1–131／1 | `b3467d1995c887391cb174579819929fb0710238bc88d7b5a7e5b73090f1bc55` | 保留固定上游離線比較 N07 |
| `scripts/evaluation/upstream-compare/cases.mts` | 1–377／1 | `abaad5f8b7d91f8cab867e83476a590a7342db8a2479f46e66765baaf28854d7` | 固定歷史版本行為比較情境 N07 |
| `scripts/evaluation/upstream-compare/inputs.mts` | 1–49／1 | `97c97f87dae16711ced71824aa84e23671523645ba165a13141a42e8f6b33b02` | 不可變上游來源大小及雜湊 N07 |
| `scripts/evaluation/upstream-compare/model.mts` | 1–357／1 | `b2b2bc1b93ebcfd0737ec3ce0dac061b0a7ace7ce033ea9c5170fbd9a94bf78a` | 比較有效性、假時鐘及模型結果 N07 |
| `scripts/evaluation/upstream-compare/page.mts` | 1–843／2 | `ecac0d50bdb4c6b6f9001c141627cefceab3dfec7f162960be77b912b18cf8d3` | Node VM 模擬平台；歷史 API 形狀與採樣 N07 |
| `scripts/evaluation/upstream-compare/worker.mts` | 1–34／1 | `9fa48c31b310939a2fe4467dc35003299a46273f3796c800380e170533f35367` | 隔離比較 worker；不匯入正式 bundle |
| `scripts/lib/lib.mts` | 1–62／1 | `df93eeae4709223989fd9fceb40b46ea852e3185ab4b0d31d822b3ebf8858f2c` | 本機工具共用函式 |
| `scripts/lib/typescript-ast.mts` | 1–25／1 | `a3de5c096006f8b63f0347a74097dbc3e2302b4d475f5395db53c97e23c2f180` | 固定 TypeScript AST 支援 |
| `scripts/package.mts` | 1–31／1 | `e4f2c1996276e32b299f1bd99d61497054e4add778adf95e9333afeae89e94ee` | 本機封裝與 checksum；本輪只由 verify 用暫存目錄 |
| `scripts/test.mts` | 1–345／1 | `5a6fc20aa2e9bf3b8b192b3052237666c5417a7840d8d8df2c7be675942c555c` | 具名 Node 測試監督與摘要 N07 |
| `scripts/testing/architecture-tests.mts` | 1–222／1 | `306f751768034f6ebdd30e733840d625dad9bb4db6f775c393f40fd11641d24f` | 架構規則反例與功能所有權契約 |
| `scripts/testing/import-purity.mts` | 1–84／1 | `e106d3ab7764513e1d9c17d29a4a962bfc0e5cea1b0d697301de67b430dfda25` | 離線匯入副作用陷阱 |
| `scripts/testing/test-contracts.mts` | 1–72／1 | `3aff60cb5d8ecf5aba846080aed32c8605ba18da9d5c0db3a40c38126f7f7267` | 測試登記及 only 防護 |
| `scripts/testing/test-process.mts` | 1–68／1 | `1c5dfde89c9604e9c087d7807d5a8467dd26b02c0939f9a37b99c0cb6f0898eb` | 有界子程序、輸出與退出碼 |
| `scripts/testing/test-registry.mts` | 1–75／1 | `8a2d64d487cb789f8c43bd9a33e60f530f3881b27c3f4edc35f5609abcc1e765` | 18 個保留套件入口 |
| `scripts/testing/test-reporter.mts` | 1–77／1 | `036ea72d9becc3b9c2dcf56ae874220491f4460e50995de15dfd6aee088e3cab` | Node 事件至機器摘要；非產品報告 N07 |
| `scripts/verify.mts` | 1–99／1 | `d5e8267dacb888b163046c9094a3f1db92d956a5ee7274ec70aa1407b490f3d1` | 固定工具離線驗證；撤銷功能負向標記 N07 |
| `scripts/verify.ps1` | 1–7／1 | `d4ec60593d67f310eeb0d49a1fba198175e119ea879d6109f0dbb09c1d2cdb0d` | PowerShell verify 啟動器 |
| `scripts/verify.sh` | 1–4／1 | `0f4ad6edf745ed38c903460190875cb8fa8c9bb88068bf94c17ab0dcaacbbf6f` | POSIX verify 啟動器 |

本報告是固定版本的清查紀錄；目前工作與後續是否啟動以 [TODO](../../../docs/TODO.md) 為準，產品驗收仍以 [TEST_REPORT](../../../docs/TEST_REPORT.md) 的各輪證據為準。
