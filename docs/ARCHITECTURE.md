<a name="v2-architecture"></a>

# v2 架構

本文件描述 [src-v2](../src-v2/entry.ts) 的 **v2.1.8** 實作，包含 MP4／FLV 修正；版本以 [release.json](../release.json) 為準。[驗證報告](TEST_REPORT.md) 分別保存自動驗證、安全審閱及其封存覆蓋標記限制、詳細瀏覽器證據。依 2026-10-04 紀錄，更新後已完成授權的合法 MP4 試看片段與公開 DASH Chrome／Tampermonkey 回歸；完整公開 MP4 及合法現場 FLV 樣本尚未建立，維持覆蓋限制，不新增待辦。本文件是持續維護的設計參考；文件分工見 [索引](INDEX.md)、[開發流程](DEVELOPMENT.md) 及 [安全政策](../SECURITY.md)。

<a name="dependency-direction"></a>

## 依賴方向

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

此表列出可以匯入的層，並不要求全部匯入。目前 state store 從 `platform/storage.ts` 匯入 `StoragePort` 型別；該模組也實作 Tampermonkey 儲存。UI 匯入 application／state 型別與 domain helper，消費快照，透過 `ControlCommandPort` 執行產品變更；UI 不匯入瀏覽器適配器。診斷匯入 domain model。[entry.ts](../src-v2/entry.ts) 建立、連接這些物件並啟動執行環境。

AST 檢查涵蓋 `src-v2/` 下除宣告檔以外的執行期 `.ts`。它檢查值／型別匯入、重新匯出、import type 及 import-equals 宣告，拒絕非相對匯入與動態 `import()`，並偵測依賴循環。額外語法規則拒絕 domain／application 中列出的瀏覽器／GM 全域及直接時鐘／亂數呼叫、coordinator 以外的點號 `setAffinity()` 呼叫、recovery 以外 application 層的點號 `reload()` 呼叫，以及 command receiver 以外列出的 UI 修改操作。這些是語法及依賴檢查，不能完整證明執行期效果或所有權。

獨立的匯入純度測試將全部非入口、非宣告模組打包在一起，停用 tree shaking 並忽略 annotation，再於不載入 `node:test` 的 raw Node 子程序匯入，期限為 3 秒。外層具名案例監督結果，框架不受全域陷阱干擾。測試攔截固定清單中的瀏覽器、網路、GM、計時器全域與 `Date.now`／`Math.random`，檢查匯入時行為；constructor 及方法仍須契約測試。18 項架構規則期待各自使用具名 `node:test` 案例；命令、期限與實際保障範圍見 [測試流程](DEVELOPMENT.md#test-suites-and-isolation)。

<a name="domain"></a>

## 領域層

`domain/` 包含純粹的模型與演算法：

- 帶有品牌型別的生命週期及動作 ID；
- URL 接納及 Host 置換規則；
- 內建節點清單（Catalog）定義；
- 有界證據窗口、安全吞吐量及斷路器；
- 候選資格及確定性排名；
- 以可信 Host 或不透明索引表達的 Catalog 限制快照及播放器輸出計畫；
- 唯讀 playurl 結果模型，明確記錄接納結果、辨識格式、數量、數字 upstream code 及固定拒絕原因聯集。

domain 以參數接收時間與相對 URL 基底，不執行 I/O。輸出政策函式回傳 Host 或不透明索引的決策，不提交 affinity（目前路線綁定）或啟動探測。URL 政策 helper 可以檢查 URL 字串，但不保存它們。

<a name="state"></a>

## 狀態層

- `SessionStore` 保存不可變的 generation、epoch、representation 及 affinity 快照。coordinator 呼叫 `setAffinity`；啟動 generation 或 epoch 時也會在 session 重設中清除 affinity。
- `RestrictionStore` 依 Host 與媒體種類管理會到期的 black／dead 紀錄。Catalog 使用者 override 位於 `SettingsStore`，預設值位於 domain Catalog，當前 stream 的 Host lock 位於 coordinator／Vault。
- `EvidenceStore` 管理有界的影片／音訊 Host 證據。
- `SignedRouteVault` 以不透明 handle 管理當前 epoch 的完整原生簽名路線（Native）URL。
- 首次可信 playurl API representation 取代同群組較低信任的 page-hint／player-MPD 路線。Vault 撤銷暫時 handle 並變更授權身分；coordinator 在保存身分不符時丟棄計畫及相關權限。後到提示不得為已可信的群組恢復可選 Native 路線。
- 路徑無法辨識的 exact signed URL 只可建立觀察及 Host 限制索引，不取得 Native 選路或主動探測能力。
- Vault 也保存有界、當前 epoch 的 playurl 輸出 URL 對照，包含原始／輸出 Host、主線／備援角色、來源及決策 ID。它擁有選路授權與簽名路線索引，透過 handle 及 metadata 提供候選。完整 URL 仍會經過輸入接納、輸出生成及瀏覽器送出／探測 port。`PlayerAdapter` 在取代／重設前保存序列化 manifest fingerprint，XHR 在記憶體保存每筆請求的 URL 狀態；兩者不得成為另一份 Native 授權索引。這些 URL 不持久化，也不包含在診斷請求模型中。
- `SettingsStore` 管理型別化 v2 產品設定，包括正常選路是否參考 B 站 Native 來源的持久開關，預設關閉。
- `MeasurementMetaStore` 管理既有游標／冷卻儲存存取，向呼叫端提供 `measurement` 鎖。

| Store | 持久鍵 | 讀取／更新行為 |
| --- | --- | --- |
| `SettingsStore` | `bilicdn.v2.settings` | 解析 schema-2 設定，監聽遠端變更，更新／重設時加鎖。原生來源參考預設關閉。 |
| `RestrictionStore` | `bilicdn.v2.restrictions` | 解析有界、會到期的紀錄，監聽遠端變更，修改時加鎖。 |
| `EvidenceStore` | `bilicdn.v2.routeEvidence` | 解析有界影片／音訊證據，監聽遠端變更，記錄／清除時加鎖。 |
| `MeasurementMetaStore` | `bilicdn.v2.meta` | 每次 `get()` 重新讀取儲存；沒有值變更 listener 或快取狀態。 |

[量測 metadata](../src-v2/state/measurement-meta-store.ts) 保留既有相容語意：接收物件，將游標／時間戳轉為數字並以零作替代，將游標下限設為零。它不強制有限數字上界，也不驗證儲存的 schema。`update()` 合併既有欄位、寫入 schema 2 及 `updatedAt`，不自行取得鎖；`clear()` 也直接刪除。`MeasurementController` 以 `withLock()` 包住游標／冷卻更新，並在 callback 內檢查生命週期標記。

[TampermonkeyStorage](../src-v2/platform/storage.ts) 在可用時以 `bilicdn.v2.` 名稱前綴使用 `navigator.locks`，否則直接執行 callback。跨分頁序列化取決於 Web Locks 是否可用。簽名路線與 session 狀態僅保存在記憶體。

<a name="application-controllers"></a>

## 應用控制器

- `RouteCoordinator` 產生路線決策、套用 affinity、規劃考慮群組的備援，提交證據或路線失效前驗證探測／傳輸結果。
- 僅 `MeasurementController` 啟動主動探測。它管理每分頁一次、由播放器請求觸發的有界起播預測試：最多三個並行候選，共用三秒期限；後續安全輪次依序量測最多三個挑戰候選。MP4／FLV 分段共用起播窗口。coordinator 在提交前驗證起播選擇；健康探索只記錄證據，不變更 affinity。
- 主動起播及健康探測拒絕轉址，只計入已接納 Host 的直接 206 Range 回應。
- `RecoveryController` 管理播放器核心重載及恢復播放狀態。`RouteCoordinator` 管理路線備援；`PlayerMonitor` 偵測 Watchdog／冷啟動條件，`RuntimeController` 將路線備援事件轉交核心恢復。
- `LifecycleController` 在啟動、SPA navigation key 變更及啟用／停用變更時開始 generation。頁面賦值只作有界待處理輸入，不自動切換 generation。
- `PlayerMonitor` 每秒取樣播放器，推進恢復 tick 並提供型別化觀察。
- `PlayurlController` 登記正規化 representation、管理內容 epoch 並請求輸出計畫。playurl 適配器負責 payload 解析、欄位相容及寫回。
- `RuntimeController` 協調設定失效、探測／恢復重設、monitor 生命週期及備援事件。`ControlCommands` 提供 UI 的型別化修改介面，安排對照、黑名單、重設及資料清除的執行順序。

控制器接收型別化 port，常用 `Pick` 縮小介面。`NavigationPort`、`SchedulerPort` 及 `PlayerPort.observePlayIntent` 將 History wrapper、計時器 API 及啟動意圖檢查留在 application 政策之外。`PlayerPort` 不暴露原始播放器／核心物件。生命週期敏感的探測／傳輸提交依情況檢查當前 generation、epoch、路線身分或控制器標記；證據寫入取得儲存鎖後再次檢查有效性條件。恢復 promise 使用生命週期 serial／token，已 dispose 的生命週期 observer 忽略排隊中的頁面賦值。這些防護適用於生命週期工作；一般使用者設定寫入不綁定 generation。

可信 API 輸入的內容 key 改變時，`PlayurlController` 開始新的內容 epoch；這與生命週期 generation 重設分開。

<a name="progressive-playurl-processing-v218"></a>

## 漸進式 playurl 處理（v2.1.8）

[PlayurlAdapter](../src-v2/adapters/playurl.ts) 在有界深度內走訪已辨識的 root／`data`／`result`／`video_info` 容器，收集 DASH 與 MP4／FLV `durl`。分段身分包含分支、格式、畫質及陣列索引；缺少或重複的 `order` 不會合併不同分段。payload 保留原始分段順序與 metadata，DASH codec 排序獨立運作。parser 拒絕格式錯誤的 payload、非零頂層 code、不支援格式及超過容量的影片／音訊項目。

控制器逐段登記，維持當前 generation／epoch 及可信來源提升規則。漸進式 Catalog 生成從 `SignedRouteVault` 取得該段第一個安全不透明來源 handle，不假設第一個提供的 URL 可以改寫。exact source path／query 保持與本段關聯。Vault 僅在換 Host 後能生成正常內建 Catalog 目標時，才可為此保留安全可改寫的 PCDN 來源；它不取得 Native 可選資格，也不得成為第二份 URL 索引。DASH 保留既有行為：同 representation 的安全 incoming exact／Catalog alias URL 連同當前 query 保留。

所有已辨識的漸進式或混合格式輸出，先完成規劃才寫回 URL。必要分段若沒有合法主線，拒絕整個回應，不部分取代 URL 或丟棄失敗分段。此原子性限於 payload 寫回，不回滾 Vault／控制器登記。既有 DASH-only 清空欄位處理另行維持。[PlayurlTransformResult](../src-v2/domain/playurl-model.ts) 表達結果；每個消費端都檢查 `accepted`，不能只判斷結果物件是否為 truthy。

Catalog-only 模式下，Fetch 拒絕的 playurl 變成安全 HTTP 503 回應。XHR text／json getter 提供安全失敗內容，保留原生 HTTP 狀態；嚴格模式不支援的 XHR response type 在送出前拒絕。允許 Native、原線對照及整體停用原樣放行的政策維持各自語意。Fetch／XHR 等待後仍重查設定與生命週期有效性。

<a name="adapters"></a>

## 適配器

適配器將瀏覽器行為轉為型別化觀察：

- 獨立的 `FetchHookAdapter` 與 `XhrHookAdapter`，透過 `TransportContext` 共用型別化送出檢查及觀察建構；
- `TransportAdapter` 安裝／驗證兩個 hook，還原不完整安裝並回報整合 hook 快照；
- `RangeProbeAdapter` 提供起播及健康探測共用的直接同 Host HTTPS 206 reader，限制計入 bytes、傳遞取消並釋放 reader。量測控制器管理期限及結果解讀；coordinator 管理授權檢查與證據提交。失敗的健康挑戰不開啟播放斷路器；
- playurl 解析及轉換寫回；
- `__playinfo__` 與播放器 manifest 接納；
- video／播放器解析；
- `BrowserNavigation`：僅在 wrapper 仍擁有 History 方法時還原，unsubscribe 後忽略排隊中的 callback；
- `BrowserScheduler`：為 timeout／interval 回傳取消函式，並排入不可取消的 microtask；
- 可見性／背景行為；
- 可還原的 WebRTC 封鎖。

Tampermonkey 儲存及值變更 listener 由 `platform/storage.ts` 實作。適配器不擁有選路政策或施加懲罰。application 的計時器分別由量測期限、player monitor interval 及生命週期 microtask 管理；恢復由 monitor tick 推進。UI 直接面向瀏覽器：`PlayerPanel` 擁有獨立的 1.5 秒 interval，`ControlCenter` 直接排入 focus 工作。

<a name="route-lifecycle"></a>

## 路線生命週期

1. 可信 playurl 回應或有界頁面／播放器提示建立 representation 群組。
2. Vault 保存當前 generation／epoch 的 exact Native URL。
3. coordinator 接納當前候選、套用限制並排名。原生來源開關關閉時，正常選路只接納生成的內建 Catalog 路線；原始及 Native signed URL 留在 Vault，供歸因及獨立對照模式使用。
4. 第一筆符合條件的 Fetch／非同步 XHR 媒體請求可等待最多三秒的合法路線並行預測試，同窗口的全部請求共用期限。開關關閉時只探測 Catalog；可辨識的 B 站媒體 URL 若不能安全生成合法 Catalog 路線，送出前封鎖。
5. 傳輸適配器在送出時請求決策，保存不可變的請求脈絡。
   Fetch 政策輸入與原生送出使用同一個平台正規化 Request；頁面自行加入的 `href` 屬性不能讓受檢 URL 與送出 URL 不同。
   monitor／UI 啟動前先嘗試安裝 hook 並記錄驗證狀態；安裝失敗不阻止 UI 啟動。傳輸層檢查可辨識的非 GET 媒體但不改寫，XHR 在 `send()` 重查。開關關閉時，不能送往允許 Catalog 路線的已辨識媒體請求，在原生呼叫前封鎖，包括非 GET 及舊 generation 請求。
6. 完成後產生型別化觀察並更新證據。已確認失敗可開啟媒體種類斷路器，請求考慮群組的備援。
7. 冷啟動無進度時可提交一次不同 Host 的合法備援，並啟動既有的一次性核心恢復。原生來源開關關閉時，備援也必須是 Catalog。
8. 以決策後觀察到的 Host 確認路線結果，不能只憑計畫。

Catalog HTTP 403 只失效當前 stream／Host 配對，影響後續排名、備援及主動挑戰。恢復依媒體種類記錄從計畫、hook 入口到回應或失敗的有界動作；來自無關決策的同 Host 請求不能確認該動作。

開啟持久原生來源參考後，正常選路可依原有規則考慮合法原始及 exact Native signed 路線。關閉時，playurl 只輸出安全生成的 Catalog 主備 URL；沒有合法路線時，輸出沒有可用路線。它不取消已送出的網站請求。整體停用仍原樣保留網站請求。

原線對照僅存在目前分頁的 coordinator，獨立於持久原生來源開關。它只使用影片提供的合法 exact signed URL；主線被禁止時可提升合法原始備援，並停用主動探測及自動恢復。切換時清除計畫／affinity，重設量測／核心恢復。完整重載後不保留，也不回溯還原已交給播放器的 URL。

健康量測不得變更 affinity。

Catalog 保留全部 11 個內建 Host，其中 4 個預設不可用。起播三個探測的限制不縮小一般排名、備援或後續健康探索的候選池。Catalog-only 輸出選擇合法主線及最多五個與主線及彼此不同 Host 的合法備援。當前 black／dead、使用者 override、預設可用性、Host lock 及 stream／Host 不相容限制仍有效。

Catalog-only 起播沒有有效探測結果時，不提交測速贏家。最終送出對完整剩餘合法 Catalog 池作一般排名；探測 403 仍排除當前 stream／Host 配對。保留期限限制，不讓失敗探測路線取得特別優先權。

模式依序套用整體停用、分頁原線對照；正常選路再套用固定／自動選路及原生來源開關。固定 Host、Catalog override 或原生來源設定變更會失效計畫並重設量測／恢復。等待中的起播結果不得覆蓋新固定 Host；最終送出使用當前設定與授權。

<a name="diagnostics"></a>

## 診斷

recorder 消費型別化 `DomainEvent`，彙總成功流量並保存有界失敗事故。UI 讀取模型為快照，讀取不能改變選路或啟動網路工作。hook 入口、媒體辨識、原生呼叫及回應階段與瀏覽器 Network 確認分開。Catalog-only 規則涵蓋腳本改寫的 playurl 輸出及可攔截媒體送出；其他瀏覽器入口的流量須另行觀察。

`RouteSnapshot`、`TransportSnapshot`、`DiagnosticSnapshot` 及 `ControlCenterSnapshot` 提供具體唯讀欄位。診斷請求序列化使用明確的有界欄位清單，匯出時清理傳入的讀取模型。外部 payload 由對應適配器／store parser 驗證，metadata 則保留上述相容行為。產品設定／選路命令使用 `ControlCommandPort`；UI 也直接呼叫僅作診斷的標記、清除及報告操作。UI 不直接讀寫儲存鍵。

自 v2.1.8 起，`TransportSnapshot.lastPlayurl` 保存一筆不可變的最近結果：Fetch／XHR、觀察時間、原生 HTTP 狀態、接納結果、辨識出的 DASH／MP4／FLV 格式、影片／音訊／分段數量、數字 upstream code 及拒絕原因。`TransportContext` 複製固定欄位清單，去重後最多三種格式，數量限制為 0–65,535，丟棄非有限值或非安全整數的 upstream code。不複製原始 payload、URL、path、token 或例外文字。控制中心及既有診斷匯出消費此摘要；接納結果不證明實際網路目的地或播放成功。
