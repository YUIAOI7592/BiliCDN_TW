# v2 架構

本文件是現行產品契約與內部架構的共同來源；正式來源為 `src-v2/`、入口為 `src-v2/entry.ts`，版本以 [release.json](../release.json) 為準。工作與停止決策只看 [TODO](TODO.md)，自動驗證及安裝版證據分列於 [TEST_REPORT](TEST_REPORT.md)。舊產品入口由 [PROJECT_CONTEXT](PROJECT_CONTEXT.md) 保留錨點導引。

## 模式與預設

面向台灣網路環境的 Bilibili Tampermonkey 腳本，提供合法 CDN 選路、有界主動量測、有限核心恢復。支援 DASH 與已辨識的 MP4／FLV 分段資料。產品不控制網站 Worker，不加入執行期第三方依賴或遠端程式載入。

**Auto 畫質是主要使用場景。** 畫質及 ABR 由網站決定，正常表示／解析度下降不是缺陷。使用者倍速保持，量測依倍速估算需求。影片格式由 B 站決定；腳本不排序 DASH／OGV 表示，仍保留 codec 辨識、Vault 歸因及畫質顯示。

預設設定與操作名稱見 [README](../README.md#預設設定)。使用者勾選或固定主機不能解除黑名單、故障或其他禁止規則；單節點設定在鎖內合併，過期視圖回呼不能重新開窗或搶焦點。

| 模式 | 路線 | 主動工作 |
| --- | --- | --- |
| 正常／Native 關閉 | 合法 Catalog 主線與最多 5 個不同主機的備援 | 按資格量測、備援及恢復 |
| 正常／Native 開啟 | Catalog 及當前內容的合法精確 Native 來源 | 同樣受限制與授權檢查 |
| 整體停用 | 網站原請求 | 停止腳本改寫與主動工作，不取消已送出請求 |

整體停用停止腳本改寫與主動工作。原生來源開關是持久設定；v2.2.1 已撤除分頁原線對照。

「允許參考 B 站原生來源」預設啟用：新安裝、缺值、非法欄位及還原預設均使用 true，既有布林 true／false 保留。schema 2 與四個儲存鍵不變，讀取不強制升級寫入。布林預設只由 SettingsStore 的 BOOLEAN_DEFAULTS 定義；其他預設及使用者操作見 [README](../README.md#預設設定)。

## 模組與所有權

分層、單一副作用所有者與純契約一併受架構檢查保護。

application 的 routing、measurement、playback、playurl 群組將控制器與契約共置；Runtime／Lifecycle 的本地依賴介面不另設轉接檔。adapters 的 transport、player、playurl 群組分別管理原生差異。State、UI 與工具維持原有用途分布。群組不新增控制所有者，外部只能匯入指定所有者及共享契約，不能直接依賴功能私有助手。

`domain/model.ts` 僅保存共用 ID、媒體種類、時鐘與轉移結果基礎；選路、證據、傳輸資料直接匯入各功能模型。需求、完成預算、量測計時及探測型別與對應純政策共置；起播、還原、停滯分別依所屬生命週期維護。路線功能事件與備援動作由選路契約定義，不建立中介轉匯出入口。

### 依賴方向

本節定義目前的依賴方向與檢查邊界；歷史修復與版本證據由 [HISTORY](HISTORY.md) 追溯。

[architecture-rules.mts](../scripts/checks/architecture-rules.mts) 允許的匯入關係如下：

| 匯入層 | 允許的目標層 |
| --- | --- |
| `domain` | `domain` |
| `platform` | `platform` |
| `state` | `state`、`domain`、`platform` |
| `application` | `application`、`state`、`domain`、`platform` |
| `adapters` | `adapters`、`application`、`state`、`domain`、`platform` |
| `ui` | `ui`、`application`、`state`、`domain`、`platform` |
| `entry.ts` | 所有組合層 |

此表列出可以匯入的層，並不要求全部匯入。狀態儲存元件從 `platform/storage-port.ts` 匯入 `StoragePort` 型別；`platform/storage.ts` 實作 Tampermonkey 儲存。執行識別碼介面也獨立於產生器。同功能模型與具名介面共置於 `*-contracts.ts`；量測、監控、playurl、恢復、選路、提前重試、設定、Session、Restriction、Vault 及控制中心已合併。提前重試控制與傳輸許可仍是不同窄介面。消費端直接匯入契約，實作不轉匯出型別；設定讀取共用 `SettingsReader`／`SettingsObserver`，不傳入完整 Store。契約不得依賴具體 Store、控制器或適配器。`SettingsChange` 唯一定義於狀態模型；三個視圖使用具名唯讀快照，經 ControlCommandPort 修改設定或執行保留命令。UI 匯入應用層／狀態層型別與領域輔助函式，消費快照，透過 `ControlCommandPort` 執行產品變更；UI 不匯入瀏覽器適配器。[entry.ts](../src-v2/entry.ts) 建立、連接這些物件並啟動執行環境。

AST 檢查涵蓋 `src-v2/` 下除宣告檔以外的執行期 `.ts`。它檢查值／型別匯入、重新匯出、`import type` 及 `import-equals` 宣告，拒絕非相對匯入與動態 `import()`，並偵測依賴循環與契約對實作的依賴。唯一寫入者依完整相對路徑辨識，不能以同名檔案繞過；只有 `application/measurement/measurement-controller.ts` 可以呼叫 `probe.read()`。額外語法規則拒絕領域層／應用層中列出的瀏覽器／GM 全域及直接時鐘／亂數呼叫、路線協調器以外的點號 `setAffinity()` 呼叫、恢復控制器以外應用層的點號 `reload()` 呼叫，以及命令接收器以外列出的 UI 修改操作。這些是語法及依賴檢查，不能完整證明執行期效果或所有權。

獨立的匯入純度測試將全部非入口、非宣告模組打包在一起，停用未使用程式碼移除（tree shaking）並忽略打包最佳化註記，再於不載入 `node:test` 的獨立 Node 子程序匯入，期限為 3 秒。外層具名案例監督結果，框架不受全域陷阱干擾。測試攔截固定清單中的瀏覽器、網路、GM、計時器全域與 `Date.now`／`Math.random`，檢查匯入時行為；建構函式及方法仍須契約測試。架構規則期待各自使用具名 `node:test` 案例；命令、期限與實際保障範圍見 [測試流程](DEVELOPMENT.md#測試套件與隔離)。

### 領域層

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

### 模組責任邊界

| 協調／所有者 | 獨立助手 | 保留權責 |
| --- | --- | --- |
| RouteCoordinator | routing/ 的 request-policy、候選／限制／播放器輸出、傳輸分類、私有 RetryEvidence、純 route-projection 與熔斷觀察 | 所有政策修訂、計畫、工作 ID、事件、等待後重新驗證、傳輸提交、親和與 Vault 登記 |
| ControlCenter | ControlReadModelPort／labels／styles／elements／overview／settings views | 宿主／封閉 ShadowRoot、鍵盤／焦點、視圖版本與非同步命令 |
| PlayerAdapter | media／sdk／input-bindings 與單一 PlayerControlObserver | 既有外部及測試覆寫介面；Observer 擁有操作修訂、可信目標及自有重載，私有 bindings 只管理註冊與按原順序清理 |
| PlayerMonitor／RecoveryController | domain/playback-progress 的純控制身分、時間及影格比較 | Monitor 保有停滯段；Recovery 保有 token、額度、breaker、reload／restore；兩者各自保留資格、基準、計數與終止檢查順序 |
| XhrHookAdapter | xhr-values／xhr-request／xhr-response | 唯一 metadata WeakMap、原生 getter／guards、派送、安裝與按所有權還原；回應助手只轉換及快取當筆狀態 |

助手沒有第二份 Native 授權索引或可獨立變更親和的能力。詳見 [模組化紀錄](../archive/retired/docs/MODULARIZATION_v2.1.25_REPORT.md)。

### 應用控制器

| 所有者 | 唯一責任 |
| --- | --- |
| RouteCoordinator | 路線政策、計畫與許可；親和變更、備援及傳輸提交 |
| MeasurementController | 起播與健康主動探測；鎖內規劃及取消 |
| RecoveryController | token、階段、補正額度、breaker 與核心 reload |
| PlayerMonitor | 既有一秒 tick、停滯段、進度與當前監控狀態 |
| PlayurlController | 表示登記、內容關聯與同步 epoch 通知 |
| RuntimeController | 訂閱、設定失效與 video 備援轉交；audio 不建立 video 恢復意圖 |
| LifecycleController | 啟動、SPA 導覽及啟停世代；頁面賦值只是有界輸入 |
| ControlCommands | UI 命令與設定／清除操作順序 |

控制器接收各用途的具名最小介面；這些介面可從純契約縮小能力，不能從具體類別推導。`NavigationPort`、`SchedulerPort` 及 `PlayerPort.observePlayIntent` 將 History 包裝函式、計時器 API 及啟動意圖檢查留在應用層政策之外。`PlayerPort` 不暴露原始播放器／核心物件。生命週期敏感的探測／傳輸提交依情況檢查當前世代、內容週期、路線身分或控制器標記；證據寫入取得儲存鎖後再次檢查有效性條件。恢復 Promise 使用生命週期序號／權杖，已釋放的生命週期觀察器忽略排隊中的頁面賦值。這些防護適用於生命週期工作；一般使用者設定寫入不綁定世代。

## 選路與傳輸

禁止規則涵蓋原始、Native、Catalog、固定及備援；每次跨等待、外部回呼與送出邊界重新檢查授權。

### 內容、格式與授權

辨識入口共用 classifyPlayurlApi：原 playurl 保持既有接納規則；新 OGV playview 只接納 api.bilibili.com 的 HTTPS、精確路徑、無憑證且無非預設埠，包含明確基底解析的協定相對 URL。data.video_info.dash 沿用解析器；pre/check/drm 只記端點種類，不解析改寫內容、不登記 Vault 或改正片 epoch。可信 API 在實際派送前取得跨 Fetch／XHR 的送出序號；同世代已接納回應的最高序號形成水位。較早且不同 cid 或缺 cid 的回應不能更新內容與授權；較早且已確認同 cid 的回應只能補缺少的表示，既有表示沿用目前 Vault 來源。

cid 只從已辨識 playurl **所屬請求 URL** 取得：唯一、最多 20 位十進位字串，移除前導零；全零、重複、空白、負數、小數或超長視為缺失。Fetch 在等待前保存，XHR metadata 隨 failed open 回復與重入所有權移交；送出時只補序號／世代，保留 open 已解析的 cid，支援協定相對 URL 而不重新採用較晚的 base。不讀頁面／播放器／payload 猜 cid；cid 只關聯內容，不提供路線授權。

前後有效 cid 相同便保持 epoch，即使整批畫質／編碼／目錄改變；不同便換片。任一側缺失時，用所有合法 primary 的完整父目錄集合備援：忽略主機、查詢及排列，有影片只比影片，純音訊才比音訊，交集沿用並合併。非空無交集或型態改變則保守重設；無 cid 且無有效目錄不更新基準。上限 video 128／audio 64，本次優先、舊項固定排序補入，不因淘汰單獨增加 epoch。

API 水位只在適配器完成合法輸出檢查與原子寫回後確認。Controller 保留當次候選的請求脈絡與內容週期，確認時重查物件、世代及 epoch；拒絕輸出、寫回失敗或同步重入後已失效的回應不推進已接納水位。

只有 trusted-api 更新內容基準；page-hint／player-MPD 不擴充、不改 cid、不觸發換片。generation 改變清空基準與 API 水位；真正換片依 **Session→Vault→Routes 重設→同步通知 Runtime→登記新表示** 撤銷舊監控、量測、恢復與播放器快取，不重開每分頁起播預算。沒有有效 cid 又無共同路徑時採保守重設。

### 來源更新與傳輸

Vault 是唯一 Native 授權來源。每組可信 API 來源只掃描 primary 與 backups 的前 16 個原始位置；page-hint／player-MPD 等較低信任來源維持前 4 個位置。先截取再驗證及 canonical exact URL 去重，空值、非法值與重複值仍占掃描位置，不把第 17 筆壓縮進來。每組最多接納 4 個精確 URL：可保存的原始 primary 優先，其餘先採可選來源，再採僅供歸因／Catalog 生成的來源；各類內先不同主機、再同主機變體，均按原位置決勝。PCDN 只在能安全生成 Catalog 時保留，opaque 只沿原精確觀察資格保存，兩者都不因此取得 Native 可選或主動探索權限。

可信 DASH 與 MP4／FLV 都以最後接納的最多四個 URL 集合比較，未接納項目變動不旋轉權限。相同集合更新 primary／順序但保留 handles／aliases／authority；真正新增、移除、換簽名或可信提升撤銷舊 handles／aliases／輸出對照並旋轉授權。較低信任提示不能延伸既有 trusted 群組，舊 authority 的晚到工作不取得健康或控制例外。Native 輸出只使用已接納來源；Vault 滿額的相容 fallback 也受相同四筆接納結果限制，不以額外 alias 放回被排除的來源。無合法新來源不復用舊簽名。

內部原線決策區分原樣通行與 Vault 選中的原線；後者以當前身分與不透明 handle 解析精確 URL，重查政策／禁止規則。同一選定主機上的 DASH 請求保留當次查詢字串。

同一次同步決策共用解析 URL、分類及 AppliedRouteDecision 共同欄位；助手不持有授權。Catalog-only、Native 與不可改寫來源仍分支處理，RouteCoordinator 保有計畫、許可與提交。

DomainEvent 只保留有產生者與功能消費者的事件；TransportObservation 是傳輸／學習輸入，沒有同名的獨立診斷事件。RouteSnapshot 不投影計畫總數；私有計畫集合仍保存各表示的當前決策，重用與同步重入提交順序由行為契約保護。

### 漸進式 playurl 處理

[PlayurlAdapter](../src-v2/adapters/playurl/playurl.ts) 在有界深度內走訪已辨識的根層／`data`／`result`／`video_info` 容器，先統計所有容器的 DASH、Dolby／FLAC 與 MP4／FLV `durl` 項目總數，並凍結每個容器的成員數。超過影片 128／音訊 64 時，在讀取任何成員欄位前拒絕；通過後只處理已計入預檢的索引，讀取成員時的陣列增長不擴大解析額度，再逐項驗證及正規化。分段身分包含分支、格式、畫質及陣列索引；缺少或重複的 `order` 不會合併不同分段。資料內容保留原始分段順序與中繼資料，DASH 表示順序由網站保留。格式錯誤、非零頂層 `code` 及不支援格式仍拒絕。

控制器逐段登記，維持當前世代／內容週期及可信來源提升規則。漸進式 Catalog 生成從 `SignedRouteVault` 取得該段第一個安全來源的不透明識別碼，不假設第一個提供的 URL 可以改寫。精確來源路徑／查詢字串保持與本段關聯。Vault 僅在換主機後能生成正常內建 Catalog 目標時，才可為此保留安全可改寫的 PCDN 來源；它不取得 Native 可選資格，也不得成為第二份 URL 索引。DASH 保留既有行為：同媒體表示中，傳入的安全精確 URL 或 Catalog 別名 URL 連同當前查詢字串保留。

所有已辨識的漸進式或混合格式輸出，先完成規劃才寫回 URL。必要分段若沒有合法主線，拒絕整個回應，不部分取代 URL 或丟棄失敗分段。此原子性限於資料內容寫回，不回滾 Vault／控制器登記。既有僅含 DASH 清空欄位處理另行維持。[PlayurlTransformResult](../src-v2/domain/playurl-model.ts) 表達結果；每個消費端都檢查 `accepted`，不能只判斷結果物件是否為真值。

僅使用 Catalog 模式下，Fetch 拒絕的 playurl 變成安全 HTTP 503 回應。XHR `text`（文字）／`json`（JSON）讀取存取器提供安全失敗內容，保留原生 HTTP 狀態；嚴格模式不支援的 XHR 回應類型在送出前拒絕。允許 Native 及整體停用原樣放行的政策維持各自語意。Fetch／XHR 等待後仍重查設定與生命週期有效性。

### 路線生命週期

1. 可信 API 或有界頁面／播放器提示建立表示，Vault 保存當前世代與內容週期的精確來源。
2. Routes 接納、限制及排名；關閉 Native 時只產生合法 Catalog 主備 URL，無安全目標便拒絕可辨識媒體送出。
3. 合資格請求共用起播窗口，適配器在最終送出前取得當前決策及不可變請求脈絡。
4. 完成後依原身分提交證據；政策已過期的結果不能改親和、當前表示、授權或觸發恢復。
5. 失敗可提交合法同媒體備援；audio 與 video 健康／恢復隔離，結果依實際觀察主機確認，不能只憑計畫。

媒體請求的不可變脈絡包含送出序號、路線修訂及表示選擇修訂。相同有效表示的並行請求共享選擇修訂；兩個不同成功請求才確認新表示，等待期間不顯示舊表示容量。新送出的合法回切建立新修訂；即使前一個表示仍待確認、Session 尚記得更早的相同表示，也必須以兩筆新選擇的不同成功請求重新確認。較早路線／選擇的合法完成仍可提交健康證據，但不能重設目前親和、表示或觸發恢復；舊播放器輸出清單也不能奪回腳本已提交的新路線。

合法固定主機優先於健康親和。每筆傳輸保存路線政策修訂，設定失效後的舊結果可按原資格保留歷史證據，但不能改寫親和、當前表示、來源授權或觸發恢復；儲存等待前後均檢查。影片、音訊的證據及恢復隔離，audio 備援不能建立 video 核心意圖。

固定主機失敗或受限後，選路器選出的當前合法備援可以取得恢復資格，不再要求其主機等於固定偏好。資格仍依世代、內容週期、表示授權、政策修訂、當前計畫身分及禁止規則核對；不改寫固定設定，也不增加重載額度。

Catalog HTTP 403、404／410 只失效當前資源／主機配對，影響後續排名、備援及主動挑戰，不建立全域主機死亡；其他 4xx 明確記為請求拒絕，不建立立即重試。傳輸結果依當前請求與路線身分歸因；來自無關決策的同主機請求不能確認該路線。

### 適配器

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

XHR 每次 open 建立獨立 metadata，區分 opened／waiting／sent／terminal。參數依序轉換一次後，先暫存新所有權供同步事件使用，原生 open 成功才永久清理舊請求；拋錯只在候選仍為當前所有者時回復，不能覆蓋巢狀成功 open。尚未原生送出的取消與本地拒絕由該 metadata 擁有；每個事件回呼後重查所有權，舊 headers／progress 監聽也先檢查身分。reopen／abort 不讓舊 loadend 或 gate 繼續影響新請求。虛擬終止使用 DONE、空回應及終止事件；waiting 的自有中止完成後回到 UNSENT，尚未原生送出的其他 abort 依原生狀態處理，不一律改成 UNSENT。原生已送出的事件由瀏覽器處理。readyState／response／responseText 與方法攔截共同追蹤安裝所有權，只還原仍由本攔截持有的描述子。同步重開只保留合法選項，非同步重開保留 timeout、responseType、credentials 與 headers。

值轉換助手處理一次性的 ByteString／USVString 與跨 realm body 品牌；hook 保有 metadata、原生派送及轉換重入後的所有權重查。轉換時機、例外身分、已送出請求不重播及原生 abort 狀態要求見 [XHR 安全與相容邊界](../SECURITY.md#xhr-準備與取消原因)。

Chrome 同步選項驗證失敗可能把原生 XHR 清成 UNSENT；只有尚未送出的 waiting 請求可標記 needsNativeOpen，在 gate 釋放時重新準備，再檢查所有權與最新政策；已送出的請求絕不因此重播。版本別例外對照由 [HISTORY](HISTORY.md) 追溯。

XHR 的 response／responseText 共用同一組文字轉換及快取助手，JSON 分支也由該助手處理；助手只取得當次 metadata 與最小轉換能力。原生 getter、readyState／responseType／世代檢查與模式切換快取重置仍在 hook，status 延遲至原有摘要通知位置讀取。重入只保留當次 metadata，沒有新增 in-flight 去重或第二索引。

Fetch 輸入與原生送出共用同一正規化 Request，保持單一讀取器。Fetch／XHR 只共用相同失敗分類與完成資料組裝；各自保有原生回應、重入、取消及重用規則，不建立通用傳輸框架。

## 量測與恢復

主動工作只能由既有控制器啟動；健康探索不更換流暢播放的親和。

playback-flow 的純轉移函式涵蓋起播保留／探測／四種結案、停滯進度確認及位置／倍率／播放／進度還原。每次轉移回傳下一階段、允許的副作用與拒絕原因；終態與非法事件不授權副作用。應用層保有工作租期與唯一提交權，純函式不讀取外部環境，也不建立另一個控制器。取消後的晚到工作仍須通過當前租期／token 核對。

控制需求由純函式 controlPlaybackDemand 統一計算，起播、一般選路、失敗重選及 Monitor 使用相同碼率／倍率與缺值預設，不另使用固定 8 Mbps。UI 使用同模組的 observedPlaybackDemand，只接納有效實際碼率與倍率；未知、非有限及算術溢位／下溢維持缺值，不取得控制資格。

### 選路證據與完成期限

禁止、失效、無授權、不相容與隔離中的來源先排除；同時有多項主機限制時，排名及送出共用 black → dead → catalog-disabled → default-unavailable → host-lock → circuit-open 的原因順序。合法固定優先，其次保留合法且足速的目前主機。需要新決策時，近期充分／單筆的足速來源依下述資料完整性規則決定是否合併比較完成時間；不能合併時才依充分、單筆分組，其後為近期有效但不足速、歷史／待再驗證估計、未驗證退路。原始、Native、Catalog 不另加來源偏好，排名與最終選擇共用純政策；固定及目前路線沿用有具名原因。健康探索只更新證據，不直接換站；一般請求若目前近期容量不足且另有近期足速來源才重新評估。沒有足速替代、缺值或僅自然變舊仍保留合法計畫；真正失敗、政策或所有權失效則重新檢查。單筆試用同樣受不足速條件約束，不能冒充充分證據。

控制需求仍含 25% 裕度，一般足速為需求餘裕至少 1；提前重試獨立保留 1.35。每主機／影音類別最多十二筆、24 小時 TTL（含恰好期限）；近期速度樣本距今不超過五分鐘，至少兩個不同請求才為充分，單筆為試用。時效取 sample.at，不取 updatedAt；可達性、容量充分程度、時效與控制資格分開。

有效速度依時間及請求 ID 穩定排序、去重重建快慢 EWMA；半衰長度二筆及五筆，第一筆初始化，後續 α=1−2^(-1/H)，保守速度為快線、慢線、最新值的最小值，只有一筆再乘 0.7。閒置不虛構測量時間；新低值立即限制，回升受慢線約束。跨片合法學習可用作歷史估計，不取得當前內容或提前重試授權。

成功樣本可增加可選 bytes／elapsedMs／timingBasis，沿用 ttfbMs；bytes 須正安全整數、耗時有限正數、回應等待須小於總耗時。timingBasis 分為 Fetch 消費串流交付（fetch-consumer）、XHR 原生終止（xhr-terminal）、探測讀取器交付（probe-reader）；ttfbMs 是 API 可觀察回應等待，不是精確 RTT。非法新欄位丟棄而保留有效舊欄位；舊資料仍可計整體吞吐，缺少計時不推算本文速度。schema 2、四鍵、不強制寫入及既有解析上限保持。

入口注入單調時鐘，真正派送前起算傳輸；起播等待不計入速度。終止／EOF／探測達上限先凍結，再解除訂閱或等待 reader.cancel；清理延遲不進入分母。牆鐘只負責持久樣本、TTL 及跨分頁冷卻。零起點有效，缺時鐘、倒退、零耗時、回應晚於終止、可見長度／範圍矛盾或超額 chunk 不取得速度資格，不虛構一毫秒，也不將合法可達性成功記為網路失敗。實收 bytes 與配額計入量分開；64 KiB 速度門檻、既有配額及無範圍證明接納限制保持。

本文 Mbps=bytes×8÷(elapsedMs−ttfbMs)÷1000；完成毫秒=TTFB+請求 bytes×8÷(保守本文 Mbps×1000)，不能把包含 TTFB 的整體吞吐再次加上 TTFB。請求大小只取單一閉合合法 Range；未知、開放、suffix、多重或溢位不猜。Runtime 沿 Monitor 既有 tick 提供連續媒體緩衝、實際倍率及生命週期／表示／選擇／授權／政策／播放修訂。剩餘期限=max(0,媒體緩衝秒數÷實際倍率−單調採樣年齡秒數)；下游不再扣年齡或除倍率。恰好兩秒有效，超過或失效不用；Observer 的暫停／恢復、倍率、尋位、清空與替換通知撤銷舊事實，Runtime 只轉交失效，不授予可信操作。未觀察到的事件仍有辨識限制，重新接納靠既有一秒更新，不新增輪詢。相同比較組全部有近期本文速度、TTFB、大小與有效緩衝才比較完成時間，不齊則整組吞吐排序。模型只用於新決策及起播結果，不改網站 timeout 或自行重送。

完成估計只組合與當次請求相同 timingBasis 的近期有效計時；舊樣本仍供合法整體容量估計，缺新語意證明不取得新版完成比較資格。起播使用 probe-reader，Fetch／XHR 分別使用自身語意，失敗重選沿用所屬請求的提示；提示不授權。需要新決策時，所有近期充分／單筆的足速候選均可比較才合併按完成時間排序；完全同時先充分程度再固定序號。任一足速候選缺值，整個足速組回到原分組與吞吐規則；其他組不變。健康親和不因微小預測差換站。

隔離期限維持原退避；到期為待再驗證，不能直接回到充分。已有探索名額或自然傳輸中至少 64 KiB 的合法成功速度樣本才解除；短可達性成功不解除、失敗按原退避升級。合法成功只學習，不直接搶回健康親和。

### 熔斷與降級觀察

熔斷依主機與影音種類共享。每筆不同普通請求的合法 network／body／網站 timeout／5xx 失敗照常升級，最高四級；期限依序為 10 分鐘、30 分鐘、2 小時、6 小時。新截止為 max(原截止, 鎖內提交時間＋新等級期限)，不因舊等級低、牆鐘回退或晚到成功縮短有效隔離。取消、腳本提前重試取消、資源型 4xx 與探測失敗仍沿原分類，不新增主機熔斷。隔離中合法成功可保存健康證據，但不能降低等級。

隔離到期只恢復依法再判斷來源的資格，不自動降級或探測。普通／探測的合格速度成功仍可解除到期待再驗證狀態；等級另由本頁普通實傳觀察取得信用。樣本 24 小時 TTL 不清除等級，主機紀錄仍受影片 64／音訊 32 筆容量淘汰及手動清除約束。

| 狀態 | 結果 |
| --- | --- |
| 有效隔離 | 先依截止排除，即使舊資料 L0 仍有效；成功不開始觀察 |
| 等待新實傳 | 到期且 L>0，第一筆具當前控制戳記、至少 64 KiB、有效速度及計時且保存確認的普通成功開始觀察 |
| 觀察中 | W=300 秒；成功間隔及距最後成功不得超過 G=120 秒，恰好 G 有效 |
| 待結算 | 滿 W 後需要期末合格成功、D 前納入請求全部結案及沒有已知待提交失敗；結算須早於 H=D+60 秒 |
| 降級完成 | 共同鎖內重讀並核對版本、所有權及期限，只降一級；尚有等級便以提交時刻開始下一段 W，舊請求不續接信用 |

RouteCoordinator 私有管理影片／音訊各一個活躍窗口，每窗最多 64 筆未決 metadata；新流量於 D 後不加入舊結算屏障。成功接納從保存確認的本頁單調時間開始，不倒推送出時間；處理延遲超過 G 的結果不提供信用。沒有成功不開始；只有開頭成功、缺口超限、到 H、容量超限、暫停／尋位／倍率／表示／主機／政策／內容或媒體所有權失效均撤銷進度。舊合法失敗仍可升級，舊成功不能復活窗口。所有權在鎖等待後再次核對，不以只有最後請求有效排除合法並行工作。

降級提案依私有證明、窗口 ID、epoch 與共享控制版本判斷；等待提交時，同一有效窗口新增成功可以更新進度，不因不可變快照物件替換而遺失合法結算。XHR 的降級信用另要求可信原生終止與相符的可信 progress bytes；這與提前重試是否跟蹤分開，正數 timeout 也適用。此資格只約束降級信用，不改普通學習、網站 timeout、原生 send 或原取消契約；Node 替身只證明事件路徑，不冒稱瀏覽器原生驗證。

觀察只使用既有派送、終止、失效及一秒更新，不增加計時器。單調時間不可用、倒退、相鄰控制事件空白超過 G，或牆鐘／單調增量差超過 G，撤銷觀察而不記來源故障。暫停或 Runtime 停止後不累積信用，合格播放事實恢復後只接納新送出工作。背景或閒置本身不算主機失敗。

本頁觀察不合併其他分頁的間隔。EvidenceStore 以共享清除世代、紀錄身分及熔斷修訂核對一次性提案；普通樣本不改熔斷修訂。共同鎖不可用便禁止降級，普通播放與原失敗處理保持。兩頁對同版本完整觀察也只能降一次；未知遠端未決請求不在本頁屏障內，按實際儲存提交順序處理，不宣稱失敗永遠優先。

### 起播與健康量測

每個腳本執行個體共用一次起播 gate：可信播放資料含影片時由影片取得窗口，音訊不消耗；可信純音訊仍可使用，較低信任的暫存影片群組不能搶走其窗口；沒有可信清單時，原合法影片請求的相容路徑保留。最多 3 個並行候選、共用 3 秒期限，MP4／FLV 分段不各開預算。同步 XHR 不等待 gate，也不消耗尚未啟動的預算。合格非同步媒體 GET 不因 timeout 為零或正數而排除；不設六秒門檻，不延長、縮短或清零網站 timeout。可用、已啟動及已結束由單一租期表達；取消立即反映於目前狀態，reset 不重開已用窗口。

起播從完整合法池按共用證據分組選最多三個；有近期足速且存在探索候選時，最多兩個已知名額加一個探索名額。探索按隔離到期待驗證、從未測試、證據已舊，再沿既有游標／固定順序；Native 備援依原順序跳過被限制、不相容或失效者，成功接納一個才停止，數量與精確授權資格保持。結果依本輪足速、最快有效、一次合法未測退路；普通同分按原候選序號，不受完成先後影響。所有合法模式（原始、Catalog、精確 Native）在既有開關啟用時，首個本輪有效且達需求 1 倍的結果可提前收束；它是足夠快而非全輪最快。接納前重讀當前需求、內容、政策及授權，倍率變更不重開窗口；封存後取消其餘自有探測，晚到結果不回填。關閉則維持整輪完成或截止；近期 Catalog 快取仍須完整 16 KiB 直接 HTTPS 206，只證明可達性，不更新速度或新鮮度。沒有未測退路時明確耗盡，Native 依限制原樣交還網站，Catalog 不復活舊計畫；晚到探測不新增學習或再次提交。

健康播放時須真正前景、二十個連續合格進度 tick、三十秒可播放緩衝且不在 seeking／recovering；時間去重及超過兩秒的排程斷層會重建穩定度，不以呼叫次數冒充秒數。等待儲存鎖、沒有候選、共用冷卻及已啟動取消使用不同狀態；共用跨分頁冷卻，每 10 分鐘最多依序量測 3 個候選、其中最多一個 Native，下載額度不增加。RouteCoordinator 先產生無控制副作用的提案；MeasurementController 在 measurement 共同鎖內重讀政策、表示及所有者，必要時取得下述到期版本認領，再由 Routes 提交嘗試及工作身分。健康探索只更新證據，不變更流暢播放的親和主機。主動探測拒絕轉址，只接受符合限制的直接同主機 HTTPS 206。

健康候選先選尚未被新版分頁共同認領的到期隔離版本；資格綁定主機、影音類別與 EvidenceStore 的熔斷控制戳記，同一版本只認領一次。成功、失敗或取消後都不追加專用重測，探測成功仍不提供觀察降級信用。此優先序須有新版協定、確認保存及真正共同鎖；共同協調能力不足、96 筆認領滿額、認領保存失敗／未確認或協定退回時，停止本輪優先認領，改由 Routes 重新提出符合原六小時候選嘗試／證據新鮮度限制的一般探索候選。這個退路沿用本輪名額，不再次認領或增加冷卻、游標及探測；明確讀到不同協調世代時則終止舊輪次。它不解除其他禁止、目前主機排除、Native 精確授權、十分鐘冷卻或每輪資源上限；不保證舊版分頁遵守新協定。

Catalog-only 健康輪次有目前來源 handle 的可靠總大小時，使用同輪共用、跳過首 1 MiB、64 KiB 對齊且完整不越界的中段範圍。大小只由有效 Content-Range 建立，保存在 Vault 既有 handle 的記憶體資料；來源／授權撤銷即失效。未知大小、小資源、起播及 Native 探測從零開始，不追加 HEAD 或大小探針。非零偏移須核對回應範圍；416 撤銷大小，不立即補探或建立播放斷路。中段不保證未快取。

Catalog 含 14 個主機、原四台預設不可用；三台 HK 預設可用並保留 hk-eq-01 家族，既有 catalogOverrides 仍優先。備援最多五個，先採近期有效成功速度證據且達 1 倍需求，再在其中分散已知家族；未知或不足的異家族不超越合格同家族。家族不保證物理機房獨立。固定與 Native 授權語意保持。

schema 2 保留六個自動功能開關，缺值全部為 true；明確 false 保留。起播、中段、備援分散與提前重試的關閉沿用儲存等待期間的立即抑制；WebRTC／HTTPDNS 沿用設定提交後的生效路徑。關閉起播提前放行仍等全部候選或三秒期限；關閉中段改用首段；關閉分散恢復原排序。測速政策切換取消受影響探測，不重開起播／冷卻或恢復預算。codec／verbose 已移除，舊欄位忽略並在正常保存時淘汰。

手動測速、手動封鎖及香港定向驗證入口與其執行路徑已移除。現行量測只有起播及一般自動健康探索；勾選或固定節點不安排額外驗證。

首個合法起播窗口開始時立即消耗每分頁預算，後來的 Fetch／XHR 先加入共用 pending，再檢查已用預算；epoch／generation／設定 reset 不重開預算，沒有合法候選不消耗。健康量測的 planning／running 以各輪所有權在 finally 清理；probe、儲存鎖或寫入拒絕以固定 measurement-error 收束，遵守 10 分鐘冷卻，不輸出例外內容、不新增立即重試。

<a name="up141-提前重試原型"></a>

起播在首次保留租期時建立唯一單調 startedTick／deadlineTick，截止為 startedTick+3000；後來的合格等待者只共用剩餘期限。每筆探測結果在接納前核對租期、控制標記及絕對時間，單調 now>=deadlineTick 不納入結果或新增學習；排程延遲不延長接納期限，但實際釋放可能晚於截止。網站 timeout 自原生 send 後計時，測速等待另計，不能宣稱端到端總期限不變；網站自己的 abort／看門狗仍可取消。等待期間或重新 open 的網站 timeout 更新保持最新值，每個準備步驟後仍核對 metadata／原生狀態；同世代換片也核對 epoch，嚴格 Catalog 拒絕舊內容，Native 只依目前限制安全原樣放行且不使用舊歸因。

### 慢請求提前重試

XhrHook／私有 XhrEarlyRetry 實作 InFlightVideoPort，保管原始 XHR、單一 Range 與 timeout 寫入修訂；輸出最多十六筆不可變在途摘要，每筆最多八個近期樣本。純 evaluateEarlyRetry 只計算輸入事實。EarlyRetryController 使用 PlayerMonitor 更新播放／恢復狀態後的既有一秒 tick，持有每請求、八秒主機、三十秒分頁及低緩衝段額度，不新增週期計時器。RouteCoordinator 窄介面準備／認領／撤銷兩秒一次性許可，網站相符重試通過原生 send 後才提交親和。

提前重試按實際影片 Catalog 請求判定；開啟 Native 不排除合格 Catalog 請求，真正 Native、固定主機、尋位、恢復與停滯段仍不取得資格。正數 XHR timeout 保持排除，不能從可參與起播推論為可提前重試。資格維持 1,500 ms、完成度低於 80%、0 < 已按倍速折算的緩衝 < 6 秒、至少一秒近期速度低於需求。替代主機須有六十秒內兩個不同工作 ID、各至少 64 KiB 的成功 video 證據且達 1.35 倍需求；當前內容與授權仍有效，不為資格追加探測。

Routes 回傳符合實傳資格的有界 Catalog 候選清單，Controller 以同一份當次請求事實逐一執行純政策，再從 eligible 者選完整替代總時間最短的主機；完全相同時依 Catalog 固定序號。全部不合格時，顯示固定候選順序中第一個實際拒絕原因，不將不同時點拼成一次判斷。prepare、認領及原生接受仍由 RouteCoordinator 重新核對所選主機與許可；prepare 失敗不在同次判斷中改選另一台。

替代時間使用同一本文速度加 TTFB 公式，容量仍來自原兩筆合格實傳帳本；缺本文計時不授權。原路線只計剩餘 bytes，不再加已付回應等待；替代路線沒有可重用 Range 證明時仍按網站完整重送大小。替代總時間=既有兩秒許可交接預算+替代請求預測完成時間；以此總時間核對不超過緩衝 0.8 倍且至少節省一秒。兩秒為保守控制上限，不是實測延遲或重送保證；不延長許可，也不自行送出。近期進度速度與請求年齡使用單調觀察，缺值或倒退不製造速度，許可／帳本與跨分頁時間仍分開。此政策會抑制部分原本可觸發的低緩衝重試。每請求一次、同主機八秒一次、分頁三十秒最多三次、同低緩衝段一次；恢復十秒緩衝及連續十個健康 tick 才離開該段。

Runtime 擁有提前重試的生命週期重設及卸載；控制器僅保留當前 state／reason／host 與次數，適配器提供原生 timeout 與認領觀察。控制中心按當次快照顯示，不保留事件歷程。關閉不取消已送出的網站請求，交接失敗只停目前頁面的提前重試控制，恢復契約保持。歷史效用結果由 [HISTORY](HISTORY.md) 追溯。

### Auto 救援與操作所有權

| 情境 | 備援／觸發條件 | 重載或等待上限 | 後續期限 |
| --- | --- | --- | --- |
| 一般非尋位停滯 | 同一起點 6 秒提交合法 video 備援 | 同一起點 12 秒重載 | 重載後 15 秒無進度即終止 |
| 長 seek／可信目標未完成 | 同一起點 15 秒備援 | 同一起點 30 秒重載 | 重載後 15 秒無進度即終止 |
| 死核心／一次性冷起播 | 冷起播自首筆影片請求十五秒、無進度且低緩衝；尺寸或 readyState=2 不排除 | 救援提交後四秒門檻；死核心仍按原四秒 | 不重開起播 gate；純音訊不建立影片救援 |
| 長暫停後可信播放 | 暫停至少 30 秒，且有新的合法播放意圖 | 死核心 4 秒；其他無進度／已初始化核心等待 30 秒 | 重載後 15 秒 |
| 自有 reload 的 pause／空核心租期 | 本次合法 stall token，最多接納首個相符替換核心 | 15 秒 | 不因首次進度或只讀觀察延長寫入租期 |
| 原生位置／倍速補正 | SDK 命令至少 1 秒、非 pending／seeking、已知結果不符 | 各一次，含既有原生備援；寫入前消耗 | 沿原重載期限，不另建計時器 |
| 首次進度後確認 | 同一穩定所有者，兩個連續有效樣本才 recovered | 最多 15 秒 | 不授予新還原或核心接納 |
| 整體 breaker | 保留每段一次重載及總額 | 90 秒 | 不以尺寸、readyState 或 SDK resume 重開 |

重載先由 Observer 準備仍屬於當前所有者的可呼叫 SDK 方法，Recovery 重驗後才扣提交額度與派送；SDK 不可用明確結案且不扣已提交額度，準備時綁定 seek／control 修訂，提交前的最後重入也須重新核對，派送後拋錯／拒絕不退還。位置、倍率、播放、進度確認分階段，保存倍率優先有效原生值。倍率命令前確認位置，命令後用舊／目標倍率的可達範圍核對，通過才更新單一位置基準；未知、pending 或不在已確認位置可達範圍的讀值不授予倍率補正，SDK 尋位／倍率拒絕均依相同的一次原生補正條件處理。播放拒絕結案為已還原但暫停。

### 一般停滯與操作所有權

一般段遇 seeking 或未完成可信目標即升為長 seek，保留原起點，同段不降級。先到的合法 video 傳輸備援與同段 token 合併，不新增備援或重開計時；既有死核心 4 秒仍優先保留。理想排程下，一般故障無進度終止由 45 秒縮至 27 秒；實際動作受一秒 tick 排程影響，這不是對真實誤介入率的量測。

沒有合法路線或必要身分時明確退出，不繞過限制，不建立虛假健康樣本。額度與期限依上表。原死核心、可信長暫停播放意圖及一次性冷起播保留自己的觸發規則，不因本方案重開 gate 預算。

首次採樣、seek 跳躍、保留尺寸或緩衝增加不是播放進度。合格採樣須非 seeking／paused／ended／mediaError，影片時間前進超過 0.05 秒；有影格計數時也須新增影格。單筆進度進入確認階段，保留停滯段 ID、起點與備援／重載額度；兩個連續有效採樣才 recovered，連續十個健康 tick 且緩衝至少十秒才結束低緩衝段。重載首次進度及其後確認各有絕對十五秒期限，偶發前進不延長。

此處影格計數來自原生 `getVideoPlaybackQuality().totalVideoFrames`，供停滯、可信目標及恢復的進度確認使用。

新使用者操作撤銷舊還原；新 seek 用最新目標重新建立停滯段。網站／Auto 的目標或表示變化會撤銷過期動作並重新綁定當前 video，但保留原停滯起點與已用額度。暫停、真正 hidden、ended、mediaError、停用及生命週期失效依契約結束舊段，不能累計背景時間。

可信 seek keydown／keyup 各自在同一派送內確認實際有限新目標才取得一次 userRevision，包含位置 0；BODY／頁面焦點有效，editable、控制中心、IME、Ctrl／Meta／Alt、合成事件、忽略命令及派送後工作無效。pendingSeek／internalSeek 保留腳本來源抑制。HAVE_NOTHING 的可信新目標另須捕捉核心不變、非 internalReload；未知目標只更新 seekRevision、撤銷舊還原，不猜成使用者命令。

可信進度按下立即建立由 pointerId、播放器、媒體及內容擁有的手勢，不要求當下 seeking 或位置改變。有效 dragging 同時排除停滯、watchdog、冷起播救援及新 Recovery token；同指標可信釋放／cancel／lost capture 或真正 window 失焦／hidden／生命週期失效才清理。子元素 blur 經 window 捕捉不等於視窗失焦，不清可信目標或手勢。一般停滯在釋放後第一個合資格 tick 從最新目標建立新期限；尚無播放進度的冷起播仍按首筆影片 firstMediaAt('video')，可能立即救援，不新增全域釋放寬限。

### 長暫停後的可信播放意圖

長暫停後，網站核心可能忽略播放按鈕而不呼叫 SDK play；目前播放器區域的可信播放按鈕與既有 SDK play 都可通知同一恢復意圖。兩個入口都必須符合 [可信播放資格](../SECURITY.md#可信播放意圖)，沒有合資格操作不替暫停影片自行播放。

`PlayerAdapter` 將 SDK 方法與目前播放器區域的可信播放按鈕觀察交給單一 `PlayerControlObserver`；透過最小埠通知 Recovery，不傳遞 DOM／事件。可信來源、同媒體／播放器／內容、可見性、paused／ended／error 及讀取前後修訂檢查統一見 [安全政策](../SECURITY.md#可信播放意圖)。

每輪取消函式清理自有 document 捕捉監聽器；SDK 方法只還原自有包裝，Runtime reset 先重設恢復、解除播放意圖觀察，再重設播放器。資格與期限依上表，沒有新意圖不替暫停影片自行播放。

### BR-01 自有 SDK 重載後續恢復契約

Recovery 的還原以單一 phase 表達 position → rate → progress；原生補正使用兩個各自的一次額度，移除表達相同階段的重複旗標。Observer 保有唯一命令、可信目標、操作修訂與 reload 所有權；SDK 派送助手不取得授權。

SDK 方法取得或呼叫期間可能同步執行新操作。腳本在 SDK 呼叫及原生媒體備援寫入前，重查媒體、播放器、核心、內容週期、控制修訂、真正可見性與當前恢復資格；SDK 倍速方法拋錯不授權覆寫較新的使用者設定。

還原依序確認 seek 的原生位置落地且 seeking 結束，再設定與確認原生倍速，最後才追加 SDK play。SDK 返回、Promise 完成或錯位影格不能代替原生確認。位置容許一秒誤差並沿用片尾裁切，真正零目標有效；不可讀或非有限原生值屬未知。原政策已撤銷位置還原時，不再寫回舊目標。

同一合法自有重載內，符合上表條件才允許原生補正。既有原生備援占用同一額度；寫入前先消耗，失敗、重入或無效都不重試。未完成確認不追加 play、不以錯位或錯速進度宣告 recovered，也不停止原期限；不新增原生 play 備援、reload 或計時器。

play 方法只取得一次，getter 返回後仍重查所有權。播放位置以 play 前的原生位置與時間建立基準，不能把等待 seek／倍速時的暫停時間當成已播放時間。同一 tick 還原前的快照不能否定剛完成的還原；後續兩樣本使用原生位置與倍速，SDK 快取或未知回讀不能補算。已開始還原卻失敗的同一所有者，也不能只靠錯位／錯速進度清成 recovered；新的操作／媒體所有者重新建立基準，正確原生播放仍沿既有兩樣本政策確認。

合法 stall token 的自有 reload 可在上表的有界所有權內跨過 SDK 暫時 pause／空核心，最多接納第一個相符替換核心；舊核心回來、第二次替換、新使用者操作、真正 hidden 或失效撤銷。這是頁面因果觀察，不保證認證所有未經可觀察方法的外部替換。

沒有有效目標證明的路徑，SDK 自行 seek 仍撤銷舊位置還原；其餘合法倍速與播放意圖受最新授權、期限及 token 限制。每個 reload／seek／setRate／play 前與 Promise 提交時重查所有權。首次進度後可在同一穩定所有者下有界確認連續進度，不延長 pause／空核心資格、不授予新副作用。failed／breaker 不因尺寸或 readyState 清除；終止後 SDK 自行 resume 不能反覆重開救援。

PlayerControlObserver 唯一保存可信、未完成的尋位目標，與觀察用 targetSec 分開。鍵盤須在同一可信派送內確認實際有限目標；指標須在目前進度手勢內觀察實際目標，真正零有效。失效時同一所有者由非零 readyState 跌至 0 的歸零可保留目標；未知位置、媒體／內容／核心替換、新操作及控制失效保守撤銷。可信播放按鈕／播放鍵可交接同一 paused 目標，不能靠修訂數相同猜測來源。

Recovery 透過必要的 captureResumePosition／validateResumePosition 內部契約捕獲位置與不透明證明，保存前後及每個副作用前重查。沒有可信目標時，未初始化 video 的有限原生 currentTime（包含 0）仍優先於 SDK 快取，其他狀態維持原回退。目標附近的非 seeking 基準與兩個合格進度樣本才完成目標；後續新意圖使用目前位置。原生讀取例外僅回退該次讀取，不宣稱全部頁面 getter 例外安全。

有有效目標證明時，本次自有 reload 內或首個相符替換核心尚無穩定播放基準前的第一個 SDK seek 可標記為初始化候選；等待 seeking 結束才依序還原 seek／rate／play。第二個 seek／替換、新操作或 原期限到期撤銷，沒有證明仍維持原取消政策。目標與重載狀態都只留記憶體，不新增設定或持久欄位。

`readRestore` 的 command 讀取仍要求完整寫入租期；progress 模式只供同一私有命令／媒體／核心／控制修訂的原生事實觀察，不延長 reload 租期，也不能授權 `correctRestore` 或 play。Recovery 以最新政策與穩定所有者判斷是否接納進度，未知資料清除連續樣本。還原失敗後最多保留一份只讀驗證事實，避免 SDK 快取把錯位／錯速進度清成 recovered；新操作、媒體／核心／內容或 reset 撤銷，不保留可再次執行的 token、額度或計時器。

### 原生位置與保存值

`PlayerAdapter` 的私有 NativePosition 只保存一筆媒體、播放器、生命週期、有限位置及 readyState 基準。HAVE_NOTHING 的未知目標變更更新既有 targetSec／seekRevision，撤銷過期位置還原；未取得可信派送證據時不增加 userRevision。getter 返回後重查觀察版本、原基準、操作修訂、pendingSeek 及當前所有者；reset／替換清除基準，自有 reload 初始零另有來源標記。

`RecoveryPlayerPort.captureResumePosition()` 優先捕獲 Observer 仍有效且未完成的可信目標與不透明證明；沒有該目標才捕獲原有位置讀取結果。Recovery 的 stall 路徑在沒有證明時沿用該段 `targetSec`，其他路徑沿用捕獲位置及有限值回退。內部 `PlayerControlSnapshot` 新增可選 `pendingSeekGoal` 供 Monitor 選擇長 seek 政策；不是持久欄位或第二個目標所有者。

`currentTime()` 在目前 video.readyState===0 時一次讀取原生位置，有限值（包含 0）優先於 SDK 快取；其他情況保留 SDK／snapshot 回退。例外回退只涵蓋該次原生 readyState／currentTime 讀取，不保證 video 選取或所有 snapshot getter 例外安全。Recovery 在保存前後及副作用前繼續核對 mediaId、coreId、seekRevision、userRevision、lifecycleSerial、路線與資格；保存值不授予新權限。

## 狀態與生命週期

持久資料與純記憶體授權分開；元件各自釋放自己擁有的取消函式、訂閱、計時器與等待工作。

### 狀態層

| 所有者 | 位置／鍵 | 責任 |
| --- | --- | --- |
| SettingsStore | bilicdn.v2.settings | schema 2 設定、鎖內更新／重設及遠端通知 |
| RestrictionStore | bilicdn.v2.restrictions | 有界、到期的 black／dead；依主機與媒體種類隔離 |
| EvidenceStore | bilicdn.v2.routeEvidence | 有界 video／audio 主機證據；成功寫入才發布記憶體樣本 |
| MeasurementMetaStore | bilicdn.v2.meta | 按需讀游標／冷卻及到期版本認領，不快取資料、不訂閱；提供 measurement 鎖 |
| SessionStore | 記憶體 | 不可變世代、epoch、表示、親和；親和只由 Routes 寫入或生命週期重設 |
| SignedRouteVault | 記憶體 | 唯一 Native 精確 URL、handle、授權及有界輸出對照 |

[量測中繼資料](../src-v2/state/measurement-meta-store.ts) 只接納非陣列物件的 schema 2 自有資料欄位，不呼叫 accessor 或數值轉換。游標須為非負安全整數；冷卻時間須為非負有限數值，且不晚於本次注入時鐘。無效欄位各自回到零，不接受其他 schema。`get()` 讀取不寫入；`update()` 以最新合法值合併 schema、catalogCursor、lastChallengeAt、updatedAt，並保留已驗證的可選 coordinationProtocol／coordinationGeneration／revalidationClaims，未知欄位不延續。非法更新欄位保留當前合法值，真正零可明確寫入；非法時鐘按零處理，時鐘倒退造成的未來時間視為無效，沒有新增跨分頁單調時鐘協調。

到期版本認領保存在同一 meta 鍵，最多 96 筆主機／影音記錄，各含熔斷控制戳記、不透明 claimId／roundId；不含 URL、內容或表示索引。協定初始化、認領與保存確認都要求當前真正共同鎖，讀取快照不初始化。保存認領前，由 EvidenceStore 權威重讀目前熔斷控制，確認同步、戳記相同且隔離已到期，再重驗協調世代；不能以通知尚未抵達的本頁快取覆蓋較新認領。相同戳記已認領便拒絕再次認領；滿額不淘汰既有憑證來增加名額。偵測協定遺失／回退便停止該頁的優先認領，清除則寫入新協調世代及空清單。新版分頁只在共同儲存／鎖作用域內協作，舊版可丟棄可選欄位，因此不保證新舊版混用時共享一次。

`MeasurementController` 仍唯一啟動探測，Routes 保有候選提案及提交所有權。起播選擇維持原同步快照與三秒共用期限；延後取得 `measurement` 鎖後重新讀游標，再檢查生命週期標記才遞增，不以等待前的值覆蓋其他分頁。游標到最大安全整數時回到零，同輪候選也使用相同安全遞增。健康量測的提案、認領、嘗試與十分鐘冷卻在鎖內協調。`get()`、`update()` 不自行取鎖；`clear()` 自行取得 measurement 鎖，確認空游標／冷卻及新協調世代已保存，不能巢狀持有同一鎖。沒有新增快取、訂閱或計時器；平台沒有 Web Locks 時不能保證跨分頁序列化，也不發放優先再驗證認領。

RestrictionStore 的遠端通知只提示重讀目前持久值，不直接接納通知 payload，也不以 updatedAt 決定新舊。add／remove／clear 在 restrictions 鎖內先確認讀取，再保存及讀回核對；只有確認後才發布本頁狀態。讀失敗保留最近已確認的快取，不能當空資料覆寫；寫入拋錯仍以讀回判斷是否已保存，結果不符或未知則回報失敗。clear 寫入確認的 schema 2 空 records，不依賴可能吞掉例外的刪除 API。這些操作不保證四個儲存鍵的共同交易或舊版分頁不寫回舊資料。

[TampermonkeyStorage](../src-v2/platform/storage.ts) 在可用時以 `bilicdn.v2.` 名稱前綴使用 `navigator.locks`，否則直接執行回呼函式。跨分頁序列化取決於 Web Locks 是否可用。簽名路線與工作階段狀態僅保存在記憶體。

證據 schema 2 允許可選 controlProtocol／generation／dataRevision，紀錄內 circuitControl 保存不透明 recordId、安全整數 revision 及最後控制提交 ID。重建紀錄或修訂耗盡更換身分，資料修訂耗盡更換世代。讀取不遷移，普通合法寫入逐步補入；缺版本的舊請求先完成正常學習，後續帶當前戳記的新送出才提供觀察信用。

證據通知僅提示重讀目前持久值，不以通知 payload 或 updatedAt 決定控制新舊。清除寫入空紀錄與新世代，保留標記；舊通知、快照及降級提案不能復活資料。仍合法抵達的普通結果依原健康資格處理。讀失敗不當成空資料覆寫；寫入結果未知時重讀確認，無法確認不重試同一憑證、不給信用。完整新政策只保證新版分頁協作；舊版分頁仍可能按舊規則寫入，偵測版本遺失會撤銷本頁觀察，不強制重新載入。

SettingsStore 的單節點命令在 settings 鎖內合併；update／reset 保留各自鎖範圍及發布時機。五組 pending-off 是私有固定鍵計數，共用取得／釋放；重疊、拒絕、遠端通知與原通知順序保持。正規化、時間戳及保存共用一步，讀取沒有寫入副作用。

### 設定失效

| 變動 | 即時與提交後效果 | 不變的邊界 |
| --- | --- | --- |
| disabled | 提交後由 Lifecycle 開新世代，Runtime 更新可見性與工作資格 | 不取消網站已送出請求 |
| fixedHost／considerNativeSources／catalogOverrides | Runtime 失效路線計畫並重設量測／恢復；Measurement 取消受影響的探測 | 最終送出及等待後核對新政策，不重開起播預算 |
| startupEarlyReleaseEnabled／healthMiddleRangeEnabled | Measurement 取消當輪及起播探測；關閉在等待 settings 鎖時先抑制 | 原冷卻與已用預算保留 |
| backupFamilyDiversityEnabled | 關閉等待期間先抑制，下一次輸出規劃使用新排序 | 不主動更換親和 |
| earlyRetryEnabled | 關閉等待期間先抑制，Runtime 取消提前重試 | 不取消網站已送出請求 |
| blockWebRtc／blockHttpDns | 設定提交後由現有適配器／傳輸路徑讀取 | 保留原生差異與按所有權清理 |
| updatedAt | 不構成路線或量測政策差異 | 不因通知時間變動重設預算 |

Runtime 使用 sameRouteSettings，Measurement 使用 sameMeasurementSettings 逐欄比較，不建立 JSON 字串簽章；catalogOverrides 保留既有項目順序比較語意。測速／備援／提前重試缺值預設及舊 codec／verbose 淘汰方式見模式與預設及 README。

### 生命週期與提交

BrowserNavigation 在已支援的一般影片及 OGV 單層播放路徑比較完整的規範化導覽鍵：忽略 vd_source／spm_id_from，正規化末尾斜線，一般影片缺省分 P 與單一 p=1 等價。其他參數按名稱穩定排序，保留重複值順序、其他分 P、內容及未知參數；未知路徑使用完整原始路徑／查詢，不截取前 512 字元。等價導覽不重設世代或回填頁面資料；真正導覽仍經原失效流程。頁面資料的五秒及跨頁 250 毫秒接納期限保持。

真正內容改變時，`PlayurlController` 在 Session／Vault／Routes 重設後、登記新表示前，同步通知 generation／epoch。Runtime 訂閱後重設監控、量測、恢復及播放器快取，釋放時取消訂閱。同片排列及 cid 可對齊的畫質／編碼切換不通知，每分頁一次的起播預算不重開。

`RouteCoordinator` 擁有單調路線政策修訂號；設定失效及內容重設會遞增。`TransportContext` 在建立請求時保存修訂號。傳輸證據寫入維持原生命週期／授權檢查，完成後若政策過期便停止控制副作用；儲存鎖等待後再次檢查，合法固定主機優先於健康親和。

`platform/runtime-ids.ts` 的 factory 由入口呼叫，以 Web Crypto 產生執行環境前綴並注入傳輸及選路控制器。request／startup／challenge ID 在工作建立時分配，同工作重報不換 ID；字串沿用 schema 2 原欄位，上限 64 字元，不帶 URL 或使用者資料。模組匯入不取得亂數。

Vault 的輸出對照及來源大小只附著於既有 handle 與 RouteIdentity。PlayerAdapter 的資訊清單指紋、XHR 請求 URL 留在記憶體，不建立另一份可授權的 Native 索引；敏感值不持久化或輸出。

### 網站前景偽裝與內部可見性

[VisibilityAdapter](../src-v2/adapters/visibility.ts) 安裝時保存 Document.prototype 的 hidden getter，再於 document 實例覆寫 hidden=false、visibilityState=visible。網站因此看到前景；`isActuallyVisible()` 透過保存的 getter 查詢內部資格。Runtime／監控／量測使用此資格，不從被覆寫的頁面值推斷前景。

真正 hidden 與可信且 `event.target === window` 的 blur guard 在阻擋事件前通知控制失效，供 `PlayerAdapter` 清理手勢及所有權。子元素 blur 經 window 捕捉不取得視窗失焦資格；既有事件遮蔽保留。背景播放本身可持續；背景停止的是不合資格的主動量測／救援與舊還原提交。

保存 getter 缺失時會退回 visibilityState；讀取拋錯時按現有 fail-open 行為視為未隱藏，dispose 後查詢也回傳可見。因此可見性查詢本身不是原生 getter 來源或背景能力的保證，測試仍須先校準。

測試需要校準保存的 getter 來源與真正分頁切換。prototype 讀值與 Runtime 若共用 getter，並非兩份獨立原生證明；面板隱藏或工具選取 ID 也不是原生 hidden 的證據。步驟與無效窗口判定見 [IAB_TESTING 的 E04](IAB_TESTING.md#3-前景偽裝與真正背景的校準)。可見性清理的描述子所有權限制見 [SECURITY](../SECURITY.md#瀏覽器行為)。

可見性覆寫的原始描述子、安裝目標與本次 accessor 只由 VisibilityAdapter 保存；dispose 先比較目前 getter／setter 身分及 enumerable／configurable，仍相符才還原原件或刪除自有屬性。較新描述子與刪除狀態不覆寫，失敗項目不重試；不執行屬性 getter。監聽器維持原反向釋放順序，control-loss 訂閱不隨停用清空，重新啟用取得新的還原基準。完全相同描述子的重新安裝來源不可辨識。

<a name="診斷與-ui"></a>

## 控制中心與狀態

<a name="診斷"></a>
<a name="唯讀緩衝趨勢"></a>
<a name="播放進度"></a>
<a name="控制中心與診斷資料流"></a>
<a name="控制中心複製所有權"></a>

上述舊錨點保留相容導引。診斷、事故／請求歷程、緩衝趨勢、報告及剪貼簿功能均已撤除；[撤除前架構](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/ARCHITECTURE.md#診斷與-ui) 僅描述歷史版本。

### 控制中心資料流

ControlCenter 只提供總覽、CDN、播放設定三頁，經 ControlReadModelPort 訂閱並取得當次快照。每次建構／刷新共用單份模型，CDN 開關不各自取快照；snapshot() 沒有詳細證據參數。

`createControlReadModel(sources)` 只組合畫面使用的功能來源，不接收版本或時鐘；版本與顯示時間仍由入口直接注入 ControlCenter。快照不包含未使用的 version／releaseStage，亦不展開其他表示的 recentPlans。RouteCoordinator 保留私有計畫集合、目前影音請求與回應摘要；健康學習由 EvidenceStore 保存，不另維護沒有產品消費者的最後成功主機索引。

總覽與 CDN 視圖保留初始模型供閉包及開關初始化，完整首次刷新統一由 ControlCenter 在建構視圖後執行一次；播放設定也使用同一中心流程。讀模型以 settings／monitor／routes 分類通知。ControlCenter 將同批 monitor／routes 通知合併為一個 microtask，執行時才取得最新快照；settings、換頁及命令完成仍立即刷新。排隊工作綁定視圖修訂，關閉、重開或明確刷新撤銷舊工作；快照讀取期間的新通知保留到下一次刷新，讀回後再次核對視圖所有權。此合併只作用於 UI，功能事件與 Runtime 的影片恢復交接維持同步。

總覽保留目前緩衝、保守吞吐、需求餘裕、影音回應、量測／恢復／提前重試狀態與詳細狀態。資料僅為功能本身的當前狀態、最後一筆摘要與既有計數，不建立另一套歷程。選路學習的 EvidenceStore 仍供選路與量測使用，不列舉為報告。

總覽與按需詳細狀態共用 overviewPresentation 的當次純衍生結果。已確認表示且與可用播放器高度一致時顯示畫質／codec，否則使用有效原生尺寸並標示編碼未確認；播放器資訊不設定表示或授予選路權限。安全吞吐獨立驗證有限正數，需求倍率及推導需求都有效才顯示餘裕。缺值依既有攔截、歸因及計畫狀態說明，不猜測網路故障。影音各自使用當前世代／內容週期的回應，送出目標只表示等待回應，不當成實際主機；有明確舊世代／週期的列不顯示。

`RouteSnapshot.currentCapacity` 只投影已確認影片表示的當前計畫：generation、epoch、representation、decisionId、host、routeType、safeMbps 及樣本狀態。讀取直接核對計畫所有權、Vault 身分、停用與現行限制，讀取後再次核對以拒絕同步重入造成的舊結果；不呼叫會清理計畫的 `#currentPlan()`，不選路、改親和、發布事件或保存資料。速度由該主機的 video 證據與當次時鐘經既有 evidenceMetrics 計算；決策排名保留決策當時資訊，不作即時速度來源。既有跨內容主機學習仍依原期限使用，投影所屬計畫必須是當前內容。

樣本時效沿用 24 小時（恰好期限有效、超過排除）；容量、EWMA 與充分程度見[選路證據與完成期限](#選路證據與完成期限)；普通傳輸、起播與健康量測合法提交的影片樣本均可使用，每次快照重新判定，讀取不刪持久資料。只在保留的正數成功速度全部超期時標示「目前路線的速度樣本已過期」，其餘缺值標示「目前路線尚無有效速度樣本」。速度提示標明所屬主機，不混用影音回應主機；近期充分、單筆試用、歷史估計、待再驗證及過期分開標示，歷史需求餘裕明確標為歷史估計。有效完成時間及缺值原因同屬唯讀投影。

畫面需求為 `max(2, bandwidth / 1,000,000 × playbackRate × 1.25)` Mbps，餘裕為安全吞吐除以需求。僅接受播放器可用、當前已確認影片碼率與原生倍率為有限正數、計算沒有溢位或下溢的結果；缺值不填預設碼率或 2 倍，也不從舊排名反推。有效速度可獨立顯示，缺需求時提示「尚無有效需求估計」。倍率／表示在下一次既有刷新反映，控制用途的需求及缺省政策不變。共用冷卻顯示「共用測速冷卻中」，不推定另有分頁。

`TransportSnapshot.lastPlayurl` 保存一筆不可變的最近結果：Fetch／XHR、觀察時間、原生 HTTP 狀態、接納結果、辨識出的 DASH／MP4／FLV 格式、影片／音訊／分段數量、數字上游 `code` 及拒絕原因。`TransportContext` 複製固定欄位清單，去重後最多三種格式，數量限制為 0–65,535，丟棄非有限值或非安全整數的上游 `code`。不複製原始資料內容、URL、路徑、權杖或例外文字。控制中心消費此摘要；接納結果不證明實際網路目的地或播放成功。

非同步命令完成後重讀新快照；晚到回呼不更新失效視圖。ControlCenter 保管宿主、封閉 ShadowRoot、視圖版本與訂閱；一秒 tick 刷新既有欄位，不新增輪詢。入口只注入版本，UI 不派送 GM／剪貼簿 API。可信鍵盤事件在 ShadowRoot 冒泡邊界隔離，保留表單原生操作；Escape 關閉，關閉時清理監聽器。

功能事件僅服務路線狀態更新及影片備援轉交恢復；音訊備援不觸發影片恢復。Runtime 不再訂閱診斷採樣、恢復歷程或提前重試歷程。

### 隔離 B 原型的傳輸控制

此舊入口的原型原文見 [固定快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/ARCHITECTURE.md#隔離-b-原型的傳輸控制)，不構成現行工作授權。
