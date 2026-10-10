<a name="v2-architecture"></a>

# v2 架構

本文件描述 [src-v2](../src-v2/entry.ts) 的 **BR-07 keydown／keyup seek 本機修復**，預定 v2.1.15；保留 BR-01～06 與既有 17 項功能修復。設定版本以 [release.json](../release.json) 為準；發布／安裝狀態見 [驗證報告](TEST_REPORT.md) 及 [BR-07 交付](BR07_FIX_REPORT.md)。原自然網路起因與其他完整驗收獨立追蹤。文件分工見 [索引](INDEX.md)、[開發流程](DEVELOPMENT.md) 及 [安全政策](../SECURITY.md)。

修復背景：[BR-07](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 在 v2.1.14 安裝版確認網站右鍵於 keyup 尋位。新實作為該 keyup 建立獨立同派送候選，不沿用已結束的 keydown；當次派送沒有可觀察的新 seek 仍保守不歸因。原觀察及失敗結果保留，完整安裝矩陣待新版取證。

<a name="dependency-direction"></a>

## 依賴方向

v2.1.9 的 [功能與競態修復](FUNCTIONAL_FIX_REPORT.md) 納入下列所有權規則；來源與正式回歸案例可逐項對照。

[architecture-rules.mjs](../scripts/architecture-rules.mjs) 允許的匯入關係如下：

| 匯入層 | 允許的目標層 |
| --- | --- |
| `domain` | `domain` |
| `platform` | `platform` |
| `state` | `state`、`domain`、`platform` |
| `application` | `application`、`state`、`domain`、`platform` |
| `adapters` | `adapters`、`application`、`state`、`domain`、`platform` |
| `diagnostics` | `diagnostics`、`domain` |
| `ui` | `ui`、`diagnostics`、`application`、`state`、`domain`、`platform` |
| `entry.ts` | 所有組合層 |

此表列出可以匯入的層，並不要求全部匯入。目前狀態儲存元件從 `platform/storage.ts` 匯入 `StoragePort` 型別；該模組也實作 Tampermonkey 儲存。UI 匯入應用層／狀態層型別與領域輔助函式，消費快照，透過 `ControlCommandPort` 執行產品變更；UI 不匯入瀏覽器適配器。診斷匯入領域模型。[entry.ts](../src-v2/entry.ts) 建立、連接這些物件並啟動執行環境。

AST 檢查涵蓋 `src-v2/` 下除宣告檔以外的執行期 `.ts`。它檢查值／型別匯入、重新匯出、`import type` 及 `import-equals` 宣告，拒絕非相對匯入與動態 `import()`，並偵測依賴循環。額外語法規則拒絕領域層／應用層中列出的瀏覽器／GM 全域及直接時鐘／亂數呼叫、路線協調器以外的點號 `setAffinity()` 呼叫、恢復控制器以外應用層的點號 `reload()` 呼叫，以及命令接收器以外列出的 UI 修改操作。這些是語法及依賴檢查，不能完整證明執行期效果或所有權。

獨立的匯入純度測試將全部非入口、非宣告模組打包在一起，停用未使用程式碼移除（tree shaking）並忽略打包最佳化註記，再於不載入 `node:test` 的獨立 Node 子程序匯入，期限為 3 秒。外層具名案例監督結果，框架不受全域陷阱干擾。測試攔截固定清單中的瀏覽器、網路、GM、計時器全域與 `Date.now`／`Math.random`，檢查匯入時行為；建構函式及方法仍須契約測試。18 項架構規則期待各自使用具名 `node:test` 案例；命令、期限與實際保障範圍見 [測試流程](DEVELOPMENT.md#test-suites-and-isolation)。

<a name="domain"></a>

## 領域層

`domain/` 包含純粹的模型與演算法：

- 帶有品牌型別的生命週期及動作 ID；
- URL 接納及主機置換規則；
- 請求 cid 正規化及有界、順序無關的內容父目錄集合比較（`playurl-content.ts`）；
- 內建節點清單（Catalog）定義；
- 有界證據窗口、安全吞吐量及斷路器；
- 候選資格及確定性排名；
- 以可信主機或不透明索引表達的 Catalog 限制快照及播放器輸出計畫；
- 唯讀 playurl 結果模型，明確記錄接納結果、辨識格式、數量、數字上游 `code` 及固定拒絕原因聯集。

領域層以參數接收時間與相對 URL 基底，不執行 I/O。輸出政策函式回傳主機或不透明索引的決策，不提交親和主機（目前路線綁定）或啟動探測。URL 政策輔助函式可以檢查 URL 字串，但不保存它們。

<a name="state"></a>

## 狀態層

- `SessionStore` 保存不可變的世代、內容週期、媒體表示及親和主機快照。路線協調器呼叫 `setAffinity`；啟動世代或內容週期時也會在工作階段重設中清除親和主機。
- `RestrictionStore` 依主機與媒體種類管理會到期的黑名單（`black`）／失效（`dead`）紀錄。Catalog 使用者覆寫設定位於 `SettingsStore`，預設值位於領域層 Catalog，當前串流的主機鎖定位於路線協調器／Vault。
- `EvidenceStore` 管理有界的影片／音訊主機證據。
- `SignedRouteVault` 以不透明識別碼管理當前內容週期的完整原生簽名路線（Native）URL。
- 首次可信 playurl API 媒體表示取代同群組較低信任的 page-hint／player-MPD 路線。Vault 撤銷暫時不透明識別碼並變更授權身分；路線協調器在保存身分不符時丟棄計畫及相關權限。後到提示不得為已可信的群組恢復可選 Native 路線。
- 路徑無法辨識的精確簽名 URL 只可建立觀察及主機限制索引，不取得 Native 選路或主動探測能力。
- Vault 也保存有界、當前內容週期的 playurl 輸出 URL 對照，包含原始／輸出主機、主線／備援角色、來源及決策 ID。它擁有選路授權與簽名路線索引，透過不透明識別碼及中繼資料提供候選。完整 URL 仍會經過輸入接納、輸出生成及瀏覽器送出／探測介面。`PlayerAdapter` 在取代／重設前保存序列化資訊清單指紋，XHR 在記憶體保存每筆請求的 URL 狀態；兩者不得成為另一份 Native 授權索引。這些 URL 不持久化，也不包含在診斷請求模型中。
- `SettingsStore` 管理型別化 v2 產品設定，包括正常選路是否參考 B 站 Native 來源的持久開關，預設關閉。
- `SettingsStore.setCatalogEnabled(host, enabled)` 在 settings 鎖內讀取並合併單一節點；一般 update 與 reset 保留完整設定更新／還原語意。
- 可信 MP4／FLV 更新替換同段的有界來源集合；變更時 Vault 撤銷舊 handles、aliases、輸出索引並旋轉授權身分。相同正規化集合不輪替，DASH 保留既有查詢字串處理。
- `MeasurementMetaStore` 管理既有游標／冷卻儲存存取，向呼叫端提供 `measurement` 鎖。

| 儲存元件 | 持久鍵 | 讀取／更新行為 |
| --- | --- | --- |
| `SettingsStore` | `bilicdn.v2.settings` | 解析第 2 版資料結構設定，監聽遠端變更，更新／重設時加鎖。原生來源參考預設關閉。 |
| `RestrictionStore` | `bilicdn.v2.restrictions` | 解析有界、會到期的紀錄，監聽遠端變更，修改時加鎖。 |
| `EvidenceStore` | `bilicdn.v2.routeEvidence` | 解析有界影片／音訊證據，監聽遠端變更，記錄／清除時加鎖。 |
| `MeasurementMetaStore` | `bilicdn.v2.meta` | 每次 `get()` 重新讀取儲存；沒有值變更監聽器或快取狀態。 |

[量測中繼資料](../src-v2/state/measurement-meta-store.ts) 保留既有相容語意：接收物件，將游標／時間戳轉為數字並以零作替代，將游標下限設為零。它不強制有限數字上界，也不驗證儲存的資料結構。`update()` 合併既有欄位、寫入資料結構 2 及 `updatedAt`，不自行取得鎖；`clear()` 也直接刪除。`MeasurementController` 以 `withLock()` 包住游標／冷卻更新，並在回呼函式內檢查生命週期標記。

[TampermonkeyStorage](../src-v2/platform/storage.ts) 在可用時以 `bilicdn.v2.` 名稱前綴使用 `navigator.locks`，否則直接執行回呼函式。跨分頁序列化取決於 Web Locks 是否可用。簽名路線與工作階段狀態僅保存在記憶體。

<a name="application-controllers"></a>

## 應用控制器

- `RouteCoordinator` 產生路線決策、套用親和主機、規劃考慮群組的備援，提交證據或路線失效前驗證探測／傳輸結果。
- 僅 `MeasurementController` 啟動主動探測。它管理每分頁一次、由播放器請求觸發的有界起播預測試：最多三個並行候選，共用三秒期限；後續安全輪次依序量測最多三個挑戰候選。MP4／FLV 分段共用起播窗口。路線協調器在提交前驗證起播選擇；健康探索只記錄證據，不變更親和主機。
- 主動起播及健康探測拒絕轉址，只計入已接納主機的直接 206 Range 回應。
- `RecoveryController` 管理播放器核心重載及恢復播放狀態。`RouteCoordinator` 管理路線備援；`PlayerMonitor` 偵測 Watchdog／冷啟動條件，`RuntimeController` 只將 video 備援事件轉交影片核心恢復，audio 不能建立影片恢復意圖。
- `LifecycleController` 在啟動、SPA 導覽鍵變更及啟用／停用變更時開始世代。頁面賦值只作有界待處理輸入，不自動切換世代。
- `PlayerMonitor` 每秒取樣播放器，推進恢復監控週期並提供型別化觀察。
- `PlayurlController` 登記正規化媒體表示、管理內容週期並請求輸出計畫。playurl 適配器負責資料內容解析、欄位相容及寫回。
- `RuntimeController` 協調設定失效、探測／恢復重設、監控器生命週期及備援事件。`ControlCommands` 提供 UI 的型別化修改介面，安排對照、黑名單、重設及資料清除的執行順序。

控制器接收型別化介面，常用 `Pick` 縮小介面。`NavigationPort`、`SchedulerPort` 及 `PlayerPort.observePlayIntent` 將 History 包裝函式、計時器 API 及啟動意圖檢查留在應用層政策之外。`PlayerPort` 不暴露原始播放器／核心物件。生命週期敏感的探測／傳輸提交依情況檢查當前世代、內容週期、路線身分或控制器標記；證據寫入取得儲存鎖後再次檢查有效性條件。恢復 Promise 使用生命週期序號／權杖，已釋放的生命週期觀察器忽略排隊中的頁面賦值。這些防護適用於生命週期工作；一般使用者設定寫入不綁定世代。

`PlayurlRequestContext` 是內部唯讀 `{ contentId: string | null }`，由 `PlayurlPort.transform` 可選第四參數明確傳入。Fetch 在 await 前從既有平台 Request.url 保存 cid；XHR 在一次參數轉換後建立候選 metadata，failed open 回復舊 metadata，成功重入保留新請求 context。getter 不改讀當前頁面身分。只有現有 `isPlayurlApi` 接納的 URL 可供解析；唯一一個最多 20 位十進位字串，去除前導零，全零／重複／空白／負數／小數／超長均為缺失，避免 Number 精度損失。

`PlayurlController` 私有保存 cid 及已觀察的完整父目錄集合。兩側有效 cid 相同便沿用，不同便換片；任一側缺少時，從各 primary 經 `parseMediaUrl` 取父目錄，忽略主機／查詢／排列。有影片只比影片，兩側純音訊才比音訊，音訊交集不能掩蓋影片變更。交集沿用並合併歷史，支援完整清單與互斥子集往返；非空無交集或型態改變則重設。首次 cid 對齊既有目錄後綁定，無法對齊先重設。無 cid 且沒有有效目錄不變更基準。影片 128／音訊 64 上限，優先本次集合、舊集合按固定字串排序填入，不因淘汰本身增加 epoch。

只有 trusted-api 更新內容基準，保留重複回應／同物件防篡改及 generation 防護；低信任提示不觸發換片或擴充歷史，generation 改變清空全部基準。cid／目錄不持久化、不進診斷，也不提供 Native 授權。沒有有效 cid 或共同路徑的同片無法可靠辨識，仍保守重設；此修復不新增 API 逆序回應政策。來源與回歸詳見 [BR-03 修復報告](BR03_FIX_REPORT.md)。

真正內容改變時，`PlayurlController` 在 Session／Vault／Routes 重設後、登記新表示前，同步通知 generation／epoch。Runtime 訂閱後重設監控、量測、恢復及播放器快取，釋放時取消訂閱。同片排列及 cid 可對齊的畫質／編碼切換不通知，每分頁一次的起播預算不重開。

`RouteCoordinator` 擁有單調路線政策修訂號；設定／對照模式失效及內容重設會遞增。`TransportContext` 在建立請求時保存修訂號。傳輸證據寫入維持原生命週期／授權檢查，完成後若政策過期便停止控制副作用；儲存鎖等待後再次檢查，合法固定主機優先於健康親和。

`platform/runtime-ids.ts` 的 factory 由入口呼叫，以 Web Crypto 產生執行環境前綴並注入傳輸及選路控制器。request／startup／challenge ID 在工作建立時分配，同工作重報不換 ID；字串沿用 schema 2 原欄位，上限 64 字元，不帶 URL 或使用者資料。模組匯入不取得亂數。

量測鎖回呼先重查最新安全狀態、表示與控制器標記，才選擇記錄嘗試的候選及提交冷卻；首次播放位置只作基準。普通恢復在 seek／ended／mediaError 時先終止舊動作，再考慮還原；只有仍擁有停滯／操作修訂的 BR-01 stall 意圖可處理持續 seeking。play Promise 檢查生命週期與當前 token，避免晚到拒絕覆寫較新結果。

`PlayerControlSnapshot` 只提供媒體／核心不透明數字識別、seek／使用者操作修訂、拖曳、目標位置及自有 reload 修訂。PlayerAdapter 觀察播放器區域可信 pointer／非 seek key，後者僅 keydown；BR-07 的 seek 鍵可來自 BODY／頁面。keydown／keyup 捕捉皆只保存一筆私有候選，排除 editable／控制中心／組字／Ctrl／Meta／Alt／合成輸入；候選的事件仍派送、同播放器／媒體／生命週期、真正可見且有限位置改變並 seeking，才更新一次 userRevision。site.seek、媒體觀察、controls 與該事件種類的 window 冒泡皆可確認；同派送去重，keydown、repeat、keyup 各自造成新 seek 時各自取得修訂。新事件撤銷上一候選，外層冒泡／timeout 必須檢查候選身分。eventPhase NONE 拒絕派送後工作，可取消零延遲 timeout 只清理參照，不提供延遲窗口或按住狀態。入口注入 Scheduler 與真正可見性查詢，DOM／事件不交給應用層。一般 site seek 更新觀察修訂，腳本 seek 使用內部標記並清除候選；pendingSeek 保守抑制來源，不因可信輸入全面清空。reset 移除監聽器，僅在仍擁有方法時還原 wrapper。Monitor 仍以新使用者修訂重開停滯，網站／Auto 的單純 seekRevision 保留原期限。頁面核心標記是因果觀察，並非認證：等待自有 reload 時未經可觀察方法的外部替換仍有辨識限制。

PlayerMonitor 擁有單一停滯段。15 秒合法 video 備援與 Runtime 通知合併同一 token；30 秒最多一次 core reload；重載後 15 秒沒有進度釋放 token。Auto 表示／網站 seek 更新撤銷舊動作、重新綁定最新請求，但不重開同段時限／額度。新的使用者操作與真 hidden／pause／失效結束舊段。首次有效進度結束計時，RecoveryController 等兩個連續有效採樣才 recovered。

`RouteCoordinator.recoveryEligible` 為唯讀查詢：核對請求 generation／epoch／政策／授權修訂、Vault video 身分、身分綁定計畫、固定主機及現行限制。RecoveryController 在 reload 及 seek／rate／play 每個副作用前重查捕獲資格、媒體／核心／操作所有權；重載替換只接納標記相符的自有替換。已初始化核心的普通等待亦有 30 秒上限，既有死核心／冷起播 4 秒及長暫停觸發維持。

<a name="progressive-playurl-processing-v218"></a>

## 漸進式 playurl 處理（v2.1.8）

[PlayurlAdapter](../src-v2/adapters/playurl.ts) 在有界深度內走訪已辨識的根層／`data`／`result`／`video_info` 容器，收集 DASH 與 MP4／FLV `durl`。分段身分包含分支、格式、畫質及陣列索引；缺少或重複的 `order` 不會合併不同分段。資料內容保留原始分段順序與中繼資料，DASH 編解碼器排序獨立運作。解析器拒絕格式錯誤的資料內容、非零頂層 `code`、不支援格式及超過容量的影片／音訊項目。

控制器逐段登記，維持當前世代／內容週期及可信來源提升規則。漸進式 Catalog 生成從 `SignedRouteVault` 取得該段第一個安全來源的不透明識別碼，不假設第一個提供的 URL 可以改寫。精確來源路徑／查詢字串保持與本段關聯。Vault 僅在換主機後能生成正常內建 Catalog 目標時，才可為此保留安全可改寫的 PCDN 來源；它不取得 Native 可選資格，也不得成為第二份 URL 索引。DASH 保留既有行為：同媒體表示中，傳入的安全精確 URL 或 Catalog 別名 URL 連同當前查詢字串保留。

所有已辨識的漸進式或混合格式輸出，先完成規劃才寫回 URL。必要分段若沒有合法主線，拒絕整個回應，不部分取代 URL 或丟棄失敗分段。此原子性限於資料內容寫回，不回滾 Vault／控制器登記。既有僅含 DASH 清空欄位處理另行維持。[PlayurlTransformResult](../src-v2/domain/playurl-model.ts) 表達結果；每個消費端都檢查 `accepted`，不能只判斷結果物件是否為真值。

僅使用 Catalog 模式下，Fetch 拒絕的 playurl 變成安全 HTTP 503 回應。XHR `text`（文字）／`json`（JSON）讀取存取器提供安全失敗內容，保留原生 HTTP 狀態；嚴格模式不支援的 XHR 回應類型在送出前拒絕。允許 Native、原線對照及整體停用原樣放行的政策維持各自語意。Fetch／XHR 等待後仍重查設定與生命週期有效性。

<a name="adapters"></a>

## 適配器

XHR waiting 請求的內部原生 open 準備最多兩次，包含政策目標變更的 reopen。每次 open、responseType、timeout、credentials 及每個 header 還原後，均以安裝時保存的原生 readyState getter 加上 metadata 身分／phase 判斷能否繼續；準備後重新計算最新合法目標，完全穩定才建立歸因及 send。gate continuation 的未交付原生例外只終止仍擁有當前請求的 waiter，依序送出一次 readystatechange／error／loadend，保留 DONE 與空回應。直接 send 的原生例外仍同步拋出；未接受的 native send 清除 pending 歸因而不記錄 CDN 失敗樣本，已送出請求不重播。

起播等待的三個取消邊界使用 signal.reason 原值，包括物件身分與 falsy 值；只有缺少 reason 能力才建立 AbortError。拒絕只屬於該等待者，共用 probe controller 與每分頁預算維持原語意，各完成路徑以 finally 移除 listener。

適配器將瀏覽器行為轉為型別化觀察：

- 獨立的 `FetchHookAdapter` 與 `XhrHookAdapter`，透過 `TransportContext` 共用型別化送出檢查及觀察建構；
- `TransportAdapter` 安裝／驗證兩個攔截，還原不完整安裝並回報整合攔截快照；
- `RangeProbeAdapter` 提供起播及健康探測共用的直接同主機 HTTPS 206 讀取器，限制計入 bytes、傳遞取消並釋放讀取器。量測控制器管理期限及結果解讀；路線協調器管理授權檢查與證據提交。失敗的健康挑戰不開啟播放斷路器；
- playurl 解析及轉換寫回；
- `__playinfo__` 與播放器資訊清單接納；
- 影片／播放器解析；
- `BrowserNavigation`：僅在包裝函式仍擁有 History 方法時還原，取消訂閱後忽略排隊中的回呼函式；
- `BrowserScheduler`：為延遲／週期計時器回傳取消函式，並排入不可取消的微任務；
- 可見性／背景行為；
- 可還原的 WebRTC 封鎖。

Tampermonkey 儲存及值變更監聽器由 `platform/storage.ts` 實作。適配器不擁有選路政策或施加懲罰。應用層的計時器分別由量測期限、播放器監控的週期計時器及生命週期微任務管理；恢復由監控器監控週期推進。UI 直接面向瀏覽器：`PlayerPanel` 擁有獨立的 1.5 秒週期計時器，`ControlCenter` 直接排入焦點工作。

XHR 每次 open 建立獨立 metadata，區分 opened／waiting／sent／terminal。參數依序轉換一次後，先暫存新所有權供同步事件使用，原生 open 成功才永久清理舊請求；拋錯只在候選仍為當前所有者時回復，不能覆蓋巢狀成功 open。尚未原生送出的取消與本地拒絕由該 metadata 擁有；每個事件回呼後重查所有權，舊 headers／progress 監聽也先檢查身分。reopen／abort 不讓舊 loadend 或 gate 繼續影響新請求。虛擬終止使用 DONE、空回應及終止事件，abort 完成回到 UNSENT；原生已送出的事件由瀏覽器處理。readyState／response／responseText 與方法攔截共同追蹤安裝所有權，只還原仍由本攔截持有的描述子。同步重開只保留合法選項，非同步重開保留 timeout、responseType、credentials 與 headers。

Chrome 同步選項驗證失敗可能把原生 XHR 清成 UNSENT；只有尚未送出的 waiting 請求可標記 needsNativeOpen，在 gate 釋放時重新準備，再檢查所有權與最新政策；已送出的請求絕不因此重播。以上例外安全性納入 v2.1.10，證據見 [BR-02 修復報告](BR02_FIX_REPORT.md)。

ControlCenter 在開啟、關閉及換頁時更新視圖版本；命令完成與排隊焦點只在仍擁有當前開啟視圖時作用。設定命令完成不代表 UI 必須仍開啟。

<a name="route-lifecycle"></a>

## 路線生命週期

1. 可信 playurl 回應或有界頁面／播放器提示建立媒體表示群組。
2. Vault 保存當前世代／內容週期的精確 Native URL。
3. 路線協調器接納當前候選、套用限制並排名。原生來源開關關閉時，正常選路只接納生成的內建 Catalog 路線；原始及 Native 簽名 URL 留在 Vault，供歸因及獨立對照模式使用。
4. 第一筆符合條件的 Fetch／非同步 XHR 媒體請求可等待最多三秒的合法路線並行預測試，同窗口的全部請求共用期限。開關關閉時只探測 Catalog；可辨識的 B 站媒體 URL 若不能安全生成合法 Catalog 路線，送出前封鎖。
5. 傳輸適配器在送出時請求決策，保存不可變的請求脈絡。
   Fetch 政策輸入與原生送出使用同一個平台正規化 Request；頁面自行加入的 `href` 屬性不能讓受檢 URL 與送出 URL 不同。
   監控器／UI 啟動前先嘗試安裝攔截並記錄驗證狀態；安裝失敗不阻止 UI 啟動。傳輸層檢查可辨識的非 GET 媒體但不改寫，XHR 在 `send()` 重查。開關關閉時，不能送往允許 Catalog 路線的已辨識媒體請求，在原生呼叫前封鎖，包括非 GET 及舊世代請求。
6. 完成後產生型別化觀察並更新證據。已確認失敗可開啟媒體種類斷路器，請求考慮群組的備援。
7. 冷啟動無進度時可提交一次不同主機的合法備援，並啟動既有的一次性核心恢復。原生來源開關關閉時，備援也必須是 Catalog。
8. 以決策後觀察到的主機確認路線結果，不能只憑計畫。

Catalog HTTP 403 只失效當前串流／主機配對，影響後續排名、備援及主動挑戰。恢復依媒體種類記錄從計畫、攔截入口到回應或失敗的有界動作；來自無關決策的同主機請求不能確認該動作。

開啟持久原生來源參考後，正常選路可依原有規則考慮合法原始及精確 Native 簽名路線。關閉時，playurl 只輸出安全生成的 Catalog 主備 URL；沒有合法路線時，輸出沒有可用路線。它不取消已送出的網站請求。整體停用仍原樣保留網站請求。

原線對照僅存在目前分頁的路線協調器，獨立於持久原生來源開關。它只使用影片提供的合法精確簽名 URL；主線被禁止時可提升合法原始備援，並停用主動探測及自動恢復。切換時清除計畫／親和主機，重設量測／核心恢復。完整重載後不保留，也不回溯還原已交給播放器的 URL。

健康量測不得變更親和主機。

Catalog 保留全部 11 個內建主機，其中 4 個預設不可用。起播三個探測的限制不縮小一般排名、備援或後續健康探索的候選池。僅使用 Catalog 輸出選擇合法主線及最多五個與主線及彼此不同主機的合法備援。當前黑名單（`black`）／失效（`dead`）、使用者覆寫設定、預設可用性、主機鎖定及串流／主機不相容限制仍有效。

僅使用 Catalog 起播沒有有效探測結果時，不提交測速贏家。最終送出對完整剩餘合法 Catalog 池作一般排名；探測 403 仍排除當前串流／主機配對。保留期限限制，不讓失敗探測路線取得特別優先權。

模式依序套用整體停用、分頁原線對照；正常選路再套用固定／自動選路及原生來源開關。固定主機、Catalog 覆寫設定或原生來源設定變更會失效計畫並重設量測／恢復。等待中的起播結果不得覆蓋新固定主機；最終送出使用當前設定與授權。

<a name="diagnostics"></a>

## 診斷

記錄器消費型別化 `DomainEvent`，彙總成功流量並保存有界失敗事故。UI 讀取模型為快照，讀取不能改變選路或啟動網路工作。攔截入口、媒體辨識、原生呼叫及回應階段與瀏覽器網路面板（Network）確認分開。僅使用 Catalog 規則涵蓋腳本改寫的 playurl 輸出及可攔截媒體送出；其他瀏覽器入口的流量須另行觀察。

`RouteSnapshot`、`TransportSnapshot`、`DiagnosticSnapshot` 及 `ControlCenterSnapshot` 提供具體唯讀欄位。診斷請求序列化使用明確的有界欄位清單，匯出時清理傳入的讀取模型。外部資料內容由對應適配器／儲存元件解析器驗證，中繼資料則保留上述相容行為。產品設定／選路命令使用 `ControlCommandPort`；UI 也直接呼叫僅作診斷的標記、清除及報告操作。UI 不直接讀寫儲存鍵。

自 v2.1.8 起，`TransportSnapshot.lastPlayurl` 保存一筆不可變的最近結果：Fetch／XHR、觀察時間、原生 HTTP 狀態、接納結果、辨識出的 DASH／MP4／FLV 格式、影片／音訊／分段數量、數字上游 `code` 及拒絕原因。`TransportContext` 複製固定欄位清單，去重後最多三種格式，數量限制為 0–65,535，丟棄非有限值或非安全整數的上游 `code`。不複製原始資料內容、URL、路徑、權杖或例外文字。控制中心及既有診斷匯出消費此摘要；接納結果不證明實際網路目的地或播放成功。
