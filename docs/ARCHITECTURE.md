# v2 架構

本文件是現行產品契約與內部架構的共同來源；正式來源為 `src-v2/`、入口為 `src-v2/entry.ts`，版本以 [release.json](../release.json) 為準。工作與停止決策只看 [TODO](TODO.md)，自動驗證及安裝版證據分列於 [TEST_REPORT](TEST_REPORT.md)。舊產品入口由 [PROJECT_CONTEXT](PROJECT_CONTEXT.md) 保留錨點導引。

## 模式與預設

面向台灣網路環境的 Bilibili Tampermonkey 腳本，提供合法 CDN 選路、有界主動量測、有限核心恢復及本機診斷。支援 DASH 與已辨識的 MP4／FLV 分段資料。產品不控制網站 Worker，不加入執行期第三方依賴或遠端程式載入。

**Auto 畫質是主要使用場景。** 畫質及 ABR 由網站決定，正常表示／解析度下降不是缺陷。使用者倍速保持，量測依倍速估算需求。影片格式由 B 站決定；腳本不排序 DASH／OGV 表示，仍保留 codec 辨識、Vault 歸因及畫質顯示。

預設設定與操作名稱見 [README](../README.md#預設設定)。使用者勾選或固定主機不能解除黑名單、故障或其他禁止規則；單節點設定在鎖內合併，過期視圖回呼不能重新開窗或搶焦點。

| 模式 | 路線 | 主動工作 |
| --- | --- | --- |
| 正常／Native 關閉 | 合法 Catalog 主線與最多 5 個不同主機的備援 | 按資格量測、備援及恢復 |
| 正常／Native 開啟 | Catalog 及當前內容的合法精確 Native 來源 | 同樣受限制與授權檢查 |
| 分頁原線對照 | 當片合法原始／備用簽名路線 | 不主動探測、換主機或重建核心 |
| 整體停用 | 網站原請求 | 停止腳本改寫與主動工作，不取消已送出請求 |

停用優先於對照與正常模式。原生來源開關是持久設定；原線對照只屬本分頁，完整重載不保留，也不能倒回已交給播放器的 URL。

「允許參考 B 站原生來源」預設啟用：新安裝、缺值、非法欄位及還原預設均使用 true，既有布林 true／false 保留。schema 2 與四個儲存鍵不變，讀取不強制升級寫入。布林預設只由 SettingsStore 的 BOOLEAN_DEFAULTS 定義；其他預設及使用者操作見 [README](../README.md#預設設定)。

## 模組與所有權

分層、單一副作用所有者與純契約一併受架構檢查保護。

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
| `diagnostics` | `diagnostics`、`domain` |
| `ui` | `ui`、`diagnostics`、`application`、`state`、`domain`、`platform` |
| `entry.ts` | 所有組合層 |

此表列出可以匯入的層，並不要求全部匯入。狀態儲存元件從 `platform/storage-port.ts` 匯入 `StoragePort` 型別；`platform/storage.ts` 實作 Tampermonkey 儲存。執行識別碼介面也獨立於產生器。同功能模型與具名介面共置於 `*-contracts.ts`；量測、監控、playurl、恢復、選路、提前重試、設定、Session、Restriction、Vault、診斷及控制中心已合併。提前重試控制與傳輸許可仍是不同窄介面。消費端直接匯入契約，實作不轉匯出型別；設定讀取共用 `SettingsReader`／`SettingsObserver`，不傳入完整 Store。契約不得依賴具體 Store、控制器或適配器。`SettingsChange` 唯一定義於狀態模型；四個視圖使用具名唯讀快照，經 ControlCommandPort 修改設定或執行保留命令。UI 匯入應用層／狀態層型別與領域輔助函式，消費快照，透過 `ControlCommandPort` 執行產品變更；UI 不匯入瀏覽器適配器。診斷匯入領域模型。[entry.ts](../src-v2/entry.ts) 建立、連接這些物件並啟動執行環境。

AST 檢查涵蓋 `src-v2/` 下除宣告檔以外的執行期 `.ts`。它檢查值／型別匯入、重新匯出、`import type` 及 `import-equals` 宣告，拒絕非相對匯入與動態 `import()`，並偵測依賴循環與契約對實作的依賴。唯一寫入者依完整相對路徑辨識，不能以同名檔案繞過；只有 `application/measurement-controller.ts` 可以呼叫 `probe.read()`。額外語法規則拒絕領域層／應用層中列出的瀏覽器／GM 全域及直接時鐘／亂數呼叫、路線協調器以外的點號 `setAffinity()` 呼叫、恢復控制器以外應用層的點號 `reload()` 呼叫，以及命令接收器以外列出的 UI 修改操作。這些是語法及依賴檢查，不能完整證明執行期效果或所有權。

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
| RouteCoordinator | routing/ 的請求分類、資格、傳輸結果、證據組裝、候選、限制、URL 物化及播放器主備規劃 | 所有政策修訂、計畫、工作 ID、事件、等待後重新驗證、傳輸提交、親和與 Vault 登記 |
| DiagnosticRecorder | 單一 event-sanitizer、route-attempt-tracker、report | 事件／流量／事故緩衝；報告助手只消費去敏後的 detached capture |
| ControlCenter | ControlReadModelPort／labels／styles／elements／overview／settings／diagnostics views | 宿主／封閉 ShadowRoot、鍵盤／焦點、視圖版本與 pending 複製 |
| PlayerAdapter | media／sdk／method 與單一 PlayerControlObserver | 既有外部及測試覆寫介面；所有控制修訂、監聽器及自有重載觀察集中於 observer |
| PlayerMonitor／RecoveryController | domain/playback-progress 的純控制身分、時間及影格比較 | Monitor 保有停滯段；Recovery 保有 token、額度、breaker、reload／restore；兩者各自保留資格、基準、計數與終止檢查順序 |
| XhrHookAdapter | xhr-values／xhr-request／xhr-response | 唯一 metadata WeakMap、原生 getter／guards、派送、安裝與按所有權還原；回應助手只轉換及快取當筆狀態 |

助手沒有第二份 Native 授權索引或可獨立變更親和的能力。嘗試追蹤保留六個 attempt、32 個 request IDs 與既有期限；responseIds 集合沒有另加明確數量上限，不能把所有內部集合描述成逐項有界。詳見 [模組化紀錄](../archive/retired/docs/MODULARIZATION_v2.1.25_REPORT.md)。

### 應用控制器

| 所有者 | 唯一責任 |
| --- | --- |
| RouteCoordinator | 路線政策、計畫與許可；親和變更、備援及傳輸提交 |
| MeasurementController | 起播與健康主動探測；鎖內規劃及取消 |
| RecoveryController | token、階段、補正額度、breaker 與核心 reload |
| PlayerMonitor | 既有一秒 tick、停滯段、進度及唯一緩衝趨勢窗口 |
| PlayurlController | 表示登記、內容關聯與同步 epoch 通知 |
| RuntimeController | 訂閱、設定失效與 video 備援轉交；audio 不建立 video 恢復意圖 |
| LifecycleController | 啟動、SPA 導覽及啟停世代；頁面賦值只是有界輸入 |
| ControlCommands | UI 命令與設定／清除操作順序 |

控制器接收各用途的具名最小介面；這些介面可從純契約縮小能力，不能從具體類別推導。`NavigationPort`、`SchedulerPort` 及 `PlayerPort.observePlayIntent` 將 History 包裝函式、計時器 API 及啟動意圖檢查留在應用層政策之外。`PlayerPort` 不暴露原始播放器／核心物件。生命週期敏感的探測／傳輸提交依情況檢查當前世代、內容週期、路線身分或控制器標記；證據寫入取得儲存鎖後再次檢查有效性條件。恢復 Promise 使用生命週期序號／權杖，已釋放的生命週期觀察器忽略排隊中的頁面賦值。這些防護適用於生命週期工作；一般使用者設定寫入不綁定世代。

## 選路與傳輸

禁止規則涵蓋原始、Native、Catalog、固定及備援；每次跨等待、外部回呼與送出邊界重新檢查授權。

### 內容、格式與授權

辨識入口共用 classifyPlayurlApi：原 playurl 保持既有接納規則；新 OGV playview 只接納 api.bilibili.com 的 HTTPS、精確路徑、無憑證且無非預設埠，包含明確基底解析的協定相對 URL。data.video_info.dash 沿用解析器；pre/check/drm 只記端點種類，不解析改寫內容、不登記 Vault 或改正片 epoch。沒有新增同世代 API 逆序政策。

cid 只從已辨識 playurl **所屬請求 URL** 取得：唯一、最多 20 位十進位字串，移除前導零；全零、重複、空白、負數、小數或超長視為缺失。Fetch 在等待前保存，XHR metadata 隨 failed open 回復與重入所有權移交。不讀頁面／播放器／payload 猜 cid；cid 只關聯內容，不提供路線授權。

前後有效 cid 相同便保持 epoch，即使整批畫質／編碼／目錄改變；不同便換片。任一側缺失時，用所有合法 primary 的完整父目錄集合備援：忽略主機、查詢及排列，有影片只比影片，純音訊才比音訊，交集沿用並合併。非空無交集或型態改變則保守重設；無 cid 且無有效目錄不更新基準。上限 video 128／audio 64，本次優先、舊項固定排序補入，不因淘汰單獨增加 epoch。

只有 trusted-api 更新內容基準；page-hint／player-MPD 不擴充、不改 cid、不觸發換片。generation 改變清空基準；真正換片依 **Session→Vault→Routes 重設→同步通知 Runtime→登記新表示** 撤銷舊監控、量測、恢復與播放器快取，不重開每分頁起播預算。沒有有效 cid 又無共同路徑時採保守重設，不新增同世代 API 逆序政策。

### 來源更新與傳輸

Vault 是唯一 Native 授權來源。可信提升撤銷較低信任 handle；無法辨識的精確路線只能作觀察／限制，不能主動探測或 Native 選路。可信 MP4／FLV 來源在正規化、去重及容量限制後以集合比較；相同集合更新 primary／順序但保留 handles／aliases／authority，真正新增、移除、換簽名或可信提升仍撤銷舊 handles／aliases 並旋轉授權。無合法新來源拒絕輸出，不重用舊簽名。DASH 保留既有查詢行為。

內部原線決策區分原樣通行與 Vault 選中的原線；後者以當前身分與不透明 handle 解析精確 URL，重查政策／禁止規則。同一選定主機上的 DASH 請求保留當次查詢字串。

同一次同步決策共用解析 URL、分類及 AppliedRouteDecision 共同欄位；助手不持有授權。Catalog-only、Native、原線對照與不可改寫來源仍分支處理，RouteCoordinator 保有計畫、許可與提交。

### 漸進式 playurl 處理

[PlayurlAdapter](../src-v2/adapters/playurl.ts) 在有界深度內走訪已辨識的根層／`data`／`result`／`video_info` 容器，收集 DASH 與 MP4／FLV `durl`。分段身分包含分支、格式、畫質及陣列索引；缺少或重複的 `order` 不會合併不同分段。資料內容保留原始分段順序與中繼資料，DASH 表示順序由網站保留。解析器拒絕格式錯誤的資料內容、非零頂層 `code`、不支援格式及超過容量的影片／音訊項目。

控制器逐段登記，維持當前世代／內容週期及可信來源提升規則。漸進式 Catalog 生成從 `SignedRouteVault` 取得該段第一個安全來源的不透明識別碼，不假設第一個提供的 URL 可以改寫。精確來源路徑／查詢字串保持與本段關聯。Vault 僅在換主機後能生成正常內建 Catalog 目標時，才可為此保留安全可改寫的 PCDN 來源；它不取得 Native 可選資格，也不得成為第二份 URL 索引。DASH 保留既有行為：同媒體表示中，傳入的安全精確 URL 或 Catalog 別名 URL 連同當前查詢字串保留。

所有已辨識的漸進式或混合格式輸出，先完成規劃才寫回 URL。必要分段若沒有合法主線，拒絕整個回應，不部分取代 URL 或丟棄失敗分段。此原子性限於資料內容寫回，不回滾 Vault／控制器登記。既有僅含 DASH 清空欄位處理另行維持。[PlayurlTransformResult](../src-v2/domain/playurl-model.ts) 表達結果；每個消費端都檢查 `accepted`，不能只判斷結果物件是否為真值。

僅使用 Catalog 模式下，Fetch 拒絕的 playurl 變成安全 HTTP 503 回應。XHR `text`（文字）／`json`（JSON）讀取存取器提供安全失敗內容，保留原生 HTTP 狀態；嚴格模式不支援的 XHR 回應類型在送出前拒絕。允許 Native、原線對照及整體停用原樣放行的政策維持各自語意。Fetch／XHR 等待後仍重查設定與生命週期有效性。

### 路線生命週期

1. 可信 API 或有界頁面／播放器提示建立表示，Vault 保存當前世代與內容週期的精確來源。
2. Routes 接納、限制及排名；關閉 Native 時只產生合法 Catalog 主備 URL，無安全目標便拒絕可辨識媒體送出。
3. 合資格請求共用起播窗口，適配器在最終送出前取得當前決策及不可變請求脈絡。
4. 完成後依原身分提交證據；政策已過期的結果不能改親和、當前表示、授權或觸發恢復。
5. 失敗可提交合法同媒體備援；audio 與 video 健康／恢復隔離，結果依實際觀察主機確認，不能只憑計畫。

合法固定主機優先於健康親和。每筆傳輸保存路線政策修訂，設定／對照失效後的舊結果可按原資格保留歷史證據，但不能改寫親和、當前表示、來源授權或觸發恢復；儲存等待前後均檢查。影片、音訊的證據及恢復隔離，audio 備援不能建立 video 核心意圖。

固定主機失敗或受限後，選路器選出的當前合法備援可以取得恢復資格，不再要求其主機等於固定偏好。資格仍依世代、內容週期、表示授權、政策修訂、當前計畫身分及禁止規則核對；不改寫固定設定，也不增加重載額度。

Catalog HTTP 403 只失效當前串流／主機配對，影響後續排名、備援及主動挑戰。恢復依媒體種類記錄從計畫、攔截入口到回應或失敗的有界動作；來自無關決策的同主機請求不能確認該動作。

原線對照僅存在目前分頁的路線協調器，獨立於持久原生來源開關。它只使用影片提供的合法精確簽名 URL；主線被禁止時可提升合法原始備援，並停用主動探測及自動恢復。切換時清除計畫／親和主機，重設量測／核心恢復。完整重載後不保留，也不回溯還原已交給播放器的 URL。

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

XHR 的 response／responseText 共用同一組文字轉換及快取助手，JSON 分支也由該助手處理；助手只取得當次 metadata 與最小轉換能力。原生 getter、readyState／responseType／世代檢查與模式切換快取重置仍在 hook，status 延遲至原有診斷通知位置讀取。重入只保留當次 metadata，沒有新增 in-flight 去重或第二索引。

Fetch 輸入與原生送出共用同一正規化 Request，保持單一讀取器。Fetch／XHR 只共用相同失敗分類與完成資料組裝；各自保有原生回應、重入、取消及重用規則，不建立通用傳輸框架。

## 量測與恢復

主動工作只能由既有控制器啟動；健康探索不更換流暢播放的親和。

### 起播與健康量測

每分頁首次合資格媒體請求共用一次起播 gate：最多 3 個並行候選、共用 3 秒期限，MP4／FLV 分段不各開預算。同步 XHR 及明確 timeout 的 XHR 不等待 gate。探測沒有贏家時，仍從完整合法候選池排名；不能因此放行未授權 Native。

Catalog-only 起播的首個合格 Catalog 結果可提早收束窗口：直接同主機 HTTPS 206、安全吞吐至少為需求 1.35 倍；近期快取證據仍須完整下載 16 KiB。其餘探測以明確取消原因清理，已封存窗口的晚到結果不新增學習或再次提交。允許 Native 時保留完整比較；沒有合格者沿用三秒期限及原退路。診斷保存窗口實際等待時間及 qualified-early／measured／inconclusive 原因。

健康播放時須真正前景、穩定進度、足夠緩衝且不在 seeking／recovering；共用跨分頁冷卻，每 10 分鐘最多依序量測 3 個候選。取得鎖後重新檢查資格、表示及控制器標記，通過才消耗候選嘗試／游標／冷卻。健康探索只更新證據，不變更流暢播放的親和主機。主動探測拒絕轉址，只接受符合限制的直接同主機 HTTPS 206。

Catalog-only 健康輪次有目前來源 handle 的可靠總大小時，使用同輪共用、跳過首 1 MiB、64 KiB 對齊且完整不越界的中段範圍。大小只由有效 Content-Range 建立，保存在 Vault 既有 handle 的記憶體資料；來源／授權撤銷即失效。未知大小、小資源、起播及 Native 探測從零開始，不追加 HEAD 或大小探針。非零偏移須核對回應範圍；416 撤銷大小，不立即補探或建立播放斷路。中段不保證未快取。

Catalog 含 14 個主機、原四台預設不可用；三台 HK 預設可用並保留 hk-eq-01 家族，既有 catalogOverrides 仍優先。備援最多五個，先採成功證據且達 1.35 倍需求，再在其中分散已知家族；未知或不足的異家族不超越合格同家族。家族不保證物理機房獨立。固定、Native 與原線對照授權語意保持。

schema 2 保留六個自動功能開關，缺值全部為 true；明確 false 保留。起播、中段、備援分散與提前重試的關閉沿用儲存等待期間的立即抑制；WebRTC／HTTPDNS 沿用設定提交後的生效路徑。關閉起播提前放行仍等全部候選或三秒期限；關閉中段改用首段；關閉分散恢復原排序。測速政策切換取消受影響探測，不重開起播／冷卻或恢復預算。codec／verbose 已移除，舊欄位忽略並在正常保存時淘汰。

手動測速、手動封鎖及香港定向驗證入口與其執行路徑已移除。現行量測只有起播及一般自動健康探索；勾選或固定節點不安排額外驗證。

首個合法起播窗口開始時立即消耗每分頁預算，後來的 Fetch／XHR 先加入共用 pending，再檢查已用預算；epoch／generation／設定 reset 不重開預算，沒有合法候選不消耗。健康量測的 planning／running 以各輪所有權在 finally 清理；probe、儲存鎖或寫入拒絕以固定 measurement-error 收束，遵守 10 分鐘冷卻，不輸出例外內容、不新增立即重試。

手動測速、手動封鎖及香港定向驗證入口與其執行路徑已移除。現行量測只有起播及一般自動健康探索；勾選或固定節點不安排額外驗證。

<a name="up141-提前重試原型"></a>

### 慢請求提前重試

XhrHook／私有 XhrEarlyRetry 實作 InFlightVideoPort，保管原始 XHR、單一 Range 與 timeout 寫入修訂；輸出最多十六筆不可變在途摘要，每筆最多八個近期樣本。純 evaluateEarlyRetry 只計算輸入事實。EarlyRetryController 使用 PlayerMonitor 更新播放／恢復狀態後的既有一秒 tick，持有每請求、八秒主機、三十秒分頁及低緩衝段額度，不新增週期計時器。RouteCoordinator 窄介面準備／認領／撤銷兩秒一次性許可，網站相符重試通過原生 send 後才提交親和。

資格維持 1,500 ms、完成度低於 80%、0 < 已按倍速折算的緩衝 < 6 秒、至少一秒近期速度低於需求。替代主機須有六十秒內兩個不同工作 ID、各至少 64 KiB 的成功 video 證據且達 1.35 倍需求；當前內容與授權仍有效，不為資格追加探測。估計原請求超過緩衝的 0.8 倍、完整重試可在其內完成並至少節省一秒才動作。每請求一次、同主機八秒一次、分頁三十秒最多三次、同低緩衝段一次；恢復十秒緩衝及連續十個健康 tick 才離開該段。

Runtime 擁有提前重試事件訂閱及卸載；控制器發布 fixed state／reason，適配器只提供原生 timeout 與認領觀察，不能向診斷交出控制能力。Recorder 與事故快照最多保留十六筆新事件，沿用 128 KiB／匯出 96 KiB 淘汰；bufferTrend v6 不變。控制中心讀模型帶 releaseStage=stable、有效設定及候選狀態。關閉不取消網站已送請求，交接失敗只停目前頁面的提前重試控制，原恢復契約保持。正式整合不改寫歷史效用結果；版本別證據見 [TEST_REPORT](TEST_REPORT.md) 與 [HISTORY](HISTORY.md)。

### Auto 救援與操作所有權

| 情境 | 備援／觸發條件 | 重載或等待上限 | 後續期限 |
| --- | --- | --- | --- |
| 一般非尋位停滯 | 同一起點 6 秒提交合法 video 備援 | 同一起點 12 秒重載 | 重載後 15 秒無進度即終止 |
| 長 seek／可信目標未完成 | 同一起點 15 秒備援 | 同一起點 30 秒重載 | 重載後 15 秒無進度即終止 |
| 死核心／一次性冷起播 | 保留各自資格及首次媒體時間 | 4 秒門檻 | 不重開起播 gate |
| 長暫停後可信播放 | 暫停至少 30 秒，且有新的合法播放意圖 | 死核心 4 秒；其他無進度／已初始化核心等待 30 秒 | 重載後 15 秒 |
| 自有 reload 的 pause／空核心租期 | 本次合法 stall token，最多接納首個相符替換核心 | 15 秒 | 不因首次進度或只讀觀察延長寫入租期 |
| 原生位置／倍速補正 | SDK 命令至少 1 秒、非 pending／seeking、已知結果不符 | 各一次，含既有原生備援；寫入前消耗 | 沿原重載期限，不另建計時器 |
| 首次進度後確認 | 同一穩定所有者，兩個連續有效樣本才 recovered | 最多 15 秒 | 不授予新還原或核心接納 |
| 整體 breaker | 保留每段一次重載及總額 | 90 秒 | 不以尺寸、readyState 或 SDK resume 重開 |

### 一般停滯與操作所有權

一般段遇 seeking 或未完成可信目標即升為長 seek，保留原起點，同段不降級。先到的合法 video 傳輸備援與同段 token 合併，不新增備援或重開計時；既有死核心 4 秒仍優先保留。理想排程下，一般故障無進度終止由 45 秒縮至 27 秒；實際動作受一秒 tick 排程影響，這不是對真實誤介入率的量測。

沒有合法路線或必要身分時明確退出，不繞過限制，不建立虛假健康樣本。額度與期限依上表。原死核心、可信長暫停播放意圖及一次性冷起播保留自己的觸發規則，不因本方案重開 gate 預算。

首次採樣、seek 跳躍、保留尺寸或緩衝增加不是播放進度。合格採樣須非 seeking／paused／ended／mediaError，影片時間前進超過 0.05 秒；有影格計數時也須新增影格。第一個有效進度停止無進度計時，兩個連續有效採樣才 recovered。

新使用者操作撤銷舊還原；新 seek 用最新目標重新建立停滯段。網站／Auto 的目標或表示變化會撤銷過期動作並重新綁定當前 video，但保留原停滯起點與已用額度。暫停、真正 hidden、ended、mediaError、停用、對照及生命週期失效依契約結束舊段，不能累計背景時間。

可信 seek keydown／keyup 各自在同一派送內確認實際有限新目標才取得一次 userRevision，包含位置 0；BODY／頁面焦點有效，editable、控制中心、IME、Ctrl／Meta／Alt、合成事件、忽略命令及派送後工作無效。pendingSeek／internalSeek 保留腳本來源抑制。HAVE_NOTHING 的可信新目標另須捕捉核心不變、非 internalReload；未知目標只更新 seekRevision、撤銷舊還原，不猜成使用者命令。

可信進度按下立即建立由 pointerId、播放器、媒體及內容擁有的手勢，不要求當下 seeking 或位置改變。有效 dragging 同時排除停滯、watchdog、冷起播救援及新 Recovery token；同指標可信釋放／cancel／lost capture 或真正 window 失焦／hidden／生命週期失效才清理。子元素 blur 經 window 捕捉不等於視窗失焦，不清可信目標或手勢。一般停滯在釋放後第一個合資格 tick 從最新目標建立新期限；尚無播放進度的冷起播仍按原 firstMediaAt，可能立即救援，不新增全域釋放寬限。

### 長暫停後的可信播放意圖

長暫停後，網站核心可能忽略播放按鈕而不呼叫 SDK play；目前播放器區域的可信播放按鈕與既有 SDK play 都可通知同一恢復意圖。兩個入口都必須符合 [可信播放資格](../SECURITY.md#可信播放意圖)，沒有合資格操作不替暫停影片自行播放。

`PlayerAdapter` 將 SDK 方法與目前播放器區域的可信播放按鈕觀察交給單一 `PlayerControlObserver`；透過最小埠通知 Recovery，不傳遞 DOM／事件。可信來源、同媒體／播放器／內容、可見性、paused／ended／error 及讀取前後修訂檢查統一見 [安全政策](../SECURITY.md#可信播放意圖)。

每輪取消函式清理自有 document 捕捉監聽器；SDK 方法只還原自有包裝，Runtime reset 先解除 Recovery 訂閱。資格與期限依上表，沒有新意圖不替暫停影片自行播放。

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
| MeasurementMetaStore | bilicdn.v2.meta | 按需讀游標／冷卻，不快取、不訂閱；提供 measurement 鎖 |
| SessionStore | 記憶體 | 不可變世代、epoch、表示、親和；親和只由 Routes 寫入或生命週期重設 |
| SignedRouteVault | 記憶體 | 唯一 Native 精確 URL、handle、授權及有界輸出對照 |

[量測中繼資料](../src-v2/state/measurement-meta-store.ts) 只接納非陣列物件的 schema 2 自有資料欄位，不呼叫 accessor 或數值轉換。游標須為非負安全整數；冷卻時間須為非負有限數值，且不晚於本次注入時鐘。無效欄位各自回到零，不接受其他 schema。讀取沒有寫入副作用；`update()` 以最新合法值合併有效部分更新，只保存 schema、catalogCursor、lastChallengeAt、updatedAt，未知欄位不再延續。非法更新欄位保留當前合法值，真正零可明確寫入；非法時鐘按零處理，時鐘倒退造成的未來時間視為無效，沒有新增跨分頁單調時鐘協調。

`MeasurementController` 仍唯一擁有計畫及探測。起播選擇維持原同步快照與三秒共用期限；延後取得 `measurement` 鎖後重新讀游標，再檢查生命週期標記才遞增，不以等待前的值覆蓋其他分頁。游標到最大安全整數時回到零，同輪候選也使用相同安全遞增。健康量測的選擇、嘗試與十分鐘冷卻仍在鎖內規劃。`get()`、`update()` 不自行取鎖，`clear()` 保留直接刪除；沒有新增快取、訂閱、計時器或持久欄位。平台沒有 Web Locks 時仍不能保證跨分頁序列化。

[TampermonkeyStorage](../src-v2/platform/storage.ts) 在可用時以 `bilicdn.v2.` 名稱前綴使用 `navigator.locks`，否則直接執行回呼函式。跨分頁序列化取決於 Web Locks 是否可用。簽名路線與工作階段狀態僅保存在記憶體。

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

真正內容改變時，`PlayurlController` 在 Session／Vault／Routes 重設後、登記新表示前，同步通知 generation／epoch。Runtime 訂閱後重設監控、量測、恢復及播放器快取，釋放時取消訂閱。同片排列及 cid 可對齊的畫質／編碼切換不通知，每分頁一次的起播預算不重開。

`RouteCoordinator` 擁有單調路線政策修訂號；設定／對照模式失效及內容重設會遞增。`TransportContext` 在建立請求時保存修訂號。傳輸證據寫入維持原生命週期／授權檢查，完成後若政策過期便停止控制副作用；儲存鎖等待後再次檢查，合法固定主機優先於健康親和。

`platform/runtime-ids.ts` 的 factory 由入口呼叫，以 Web Crypto 產生執行環境前綴並注入傳輸及選路控制器。request／startup／challenge ID 在工作建立時分配，同工作重報不換 ID；字串沿用 schema 2 原欄位，上限 64 字元，不帶 URL 或使用者資料。模組匯入不取得亂數。

Vault 的輸出對照及來源大小只附著於既有 handle 與 RouteIdentity。PlayerAdapter 的資訊清單指紋、XHR 請求 URL 留在記憶體，不建立另一份可授權的 Native 索引；敏感值不持久化或輸出。

### 網站前景偽裝與內部可見性

[VisibilityAdapter](../src-v2/adapters/visibility.ts) 安裝時保存 Document.prototype 的 hidden getter，再於 document 實例覆寫 hidden=false、visibilityState=visible。網站因此看到前景；`isActuallyVisible()` 透過保存的 getter 查詢內部資格。Runtime／監控／量測使用此資格，不從被覆寫的頁面值推斷前景。

真正 hidden 與可信且 `event.target === window` 的 blur guard 在阻擋事件前通知控制失效，供 `PlayerAdapter` 清理手勢及所有權。子元素 blur 經 window 捕捉不取得視窗失焦資格；既有事件遮蔽保留。背景播放本身可持續；背景停止的是不合資格的主動量測／救援與舊還原提交。

保存 getter 缺失時會退回 visibilityState；讀取拋錯時按現有 fail-open 行為視為未隱藏，dispose 後查詢也回傳可見。因此可見性查詢本身不是原生 getter 來源或背景能力的保證，測試仍須先校準。

測試需要校準保存的 getter 來源與真正分頁切換。prototype 讀值與 Runtime 若共用 getter，並非兩份獨立原生證明；面板隱藏或工具選取 ID 也不是原生 hidden 的證據。步驟與無效窗口判定見 [IAB_TESTING 的 E04](IAB_TESTING.md#3-前景偽裝與真正背景的校準)。可見性清理的描述子所有權限制見 [SECURITY](../SECURITY.md#瀏覽器行為)。

可見性覆寫的原始描述子、安裝目標與本次 accessor 只由 VisibilityAdapter 保存；dispose 先比較目前 getter／setter 身分及 enumerable／configurable，仍相符才還原原件或刪除自有屬性。較新描述子與刪除狀態不覆寫，失敗項目不重試；不執行屬性 getter。監聽器維持原反向釋放順序，control-loss 訂閱不隨停用清空，重新啟用取得新的還原基準。完全相同描述子的重新安裝來源不可辨識。

## 診斷與 UI

診斷唯讀消費型別化事件；視圖只消費當次快照與需要的命令，不取得 Store 或平台派送能力。

### 診斷

記錄器消費型別化 `DomainEvent`，彙總成功流量並保存有界失敗事故。UI 讀取模型為快照，讀取不能改變選路或啟動網路工作。攔截入口、媒體辨識、原生呼叫及回應階段與瀏覽器網路面板（Network）確認分開。僅使用 Catalog 規則涵蓋腳本改寫的 playurl 輸出及可攔截媒體送出；其他瀏覽器入口的流量須另行觀察。

`RouteSnapshot`、`TransportSnapshot`、`DiagnosticSnapshot` 及 `ControlCenterSnapshot` 提供具體唯讀欄位。診斷請求序列化使用明確的有界欄位清單，匯出時清理傳入的讀取模型。外部資料內容由對應適配器／儲存元件解析器驗證，中繼資料依上述已知欄位規則重建。產品設定／選路命令使用 `ControlCommandPort`；UI 也直接呼叫僅作診斷的標記、清除及報告操作。UI 不直接讀寫儲存鍵。

`TransportSnapshot.lastPlayurl` 保存一筆不可變的最近結果：Fetch／XHR、觀察時間、原生 HTTP 狀態、接納結果、辨識出的 DASH／MP4／FLV 格式、影片／音訊／分段數量、數字上游 `code` 及拒絕原因。`TransportContext` 複製固定欄位清單，去重後最多三種格式，數量限制為 0–65,535，丟棄非有限值或非安全整數的上游 `code`。不複製原始資料內容、URL、路徑、權杖或例外文字。控制中心及既有診斷匯出消費此摘要；接納結果不證明實際網路目的地或播放成功。

### 唯讀緩衝趨勢

以下描述目前來源的 v6 規則；歷史 v2.1.34 的 v5、v2.1.29 的 v3 與更早原件保持，對應版本的發布與驗收由 [HISTORY](HISTORY.md#版本) 追溯。既有 v4 原始結果保存在 [周期候選紀錄](../archive/retired/docs/BUFFER_CANDIDATE_V4_2026-10-24.md)，最新版驗收以 [TEST_REPORT](TEST_REPORT.md) 為準。

Monitor 使用既有一秒取樣，觀察最近完整八秒的緩衝影片秒數／當次有效倍速。八秒減少至少兩個實際可播放秒數為下降，增加至少兩秒為回補，其餘為平穩。持續合格前進、下降且目前可播放緩衝不超過十秒是候選的基礎資格；首次成立並下降時，以前一有效樣本為確認基準，累計時間從零開始。後續每次跌破本次歷史低點才累計該有效樣本區間，累計滿兩秒且當次創低才為候選。這是唯讀診斷假設，不觸發選路、探測、重載、還原、incident 或額度消耗；原救援時序維持。

短期確認在緩衝增加、持平或回落但尚未跌破先前低點時，不累計時間；尚未補回確認基準則保留有界證據，完整補回才清除。短期基礎資格消失、資料失效或超過八秒沒有再創低也清除該確認；逾期當次合法下降只能重新從零開始。同時間重讀不替換樣本、不累計或延長期限。以下周期證據另外處理緩慢欠量，兩者只產生同一個唯讀 candidate。

v4 另在每次回補結束、再次下降時比較周期峰值，累計欠量最多兩秒；最近一次欠量超過八秒即失效。欠量達兩秒、目前緩衝不超過十秒時，累計其後合法下降區間兩秒，回補／持平不計時，無須每次突破更早周期的最低點。回補或持平立即撤銷顯示；短期 state 仍描述八秒事實，周期原因及 cycle 數值另外說明候選依據。

周期欠量到期時，其確認額度同步撤銷；即使同一筆樣本重新形成合法欠量，也須從零累計其後兩秒下降。尚未到期的獨立短期確認仍按自身規則判定，不因周期到期一起清除。診斷 creditMs 是兩種確認的最大值，不能單獨代替候選及原因碼判定。

完整補回或累計欠量尚不足兩秒時，保留前周期低點作為已觀察範圍；仍在範圍內的短期下降不重複確認，跌破範圍、欠量達標或八秒證據失效後再評估。不加入浮點容忍門檻，首次回補前仍可能有候選，不能宣稱消除所有多餘訊號。周期與短期確認同屬 Monitor 的單一有界狀態，不新增平行候選或控制資格。

v5 保留上述候選與原因的優先序，另在校正緩衝不超過四秒時接納低緩衝證據：完整八秒每個有效區間均嚴格下降，或已完成回補且再次下降形成仍有效的正欠量；兩者同時成立採周期證據。完整補回且仍在已回補範圍內繼續抑制，尚有欠量的範圍不遮蔽低緩衝周期證據。

低緩衝確認首次為零，之後創新低才累計實際區間，滿兩秒才顯示候選。回補、持平或未創低立即撤銷顯示；部分回補保留證據，補回基準清除。緩衝超過四秒、證據種類改變、欠量失效、超過八秒未創低或資格失效都清除低緩衝確認；到期與新證據同筆時先撤銷再從零開始，不借用短期／周期確認額度。只有單一 candidate，沒有新增任何救援觸發。

v6 保留 v5 的候選與原因優先序；只有原結果為 false、校正緩衝大於零且不超過一秒、前次與本次持有同一份已完成兩秒確認的有效 partial-cycle 證據，且最近至少兩秒持續合格下降時，才允許該份證據補顯一次。tailUsed 隨原低緩衝證據保存；部分回補、持平、新低點及原候選再次成立都不補發機會。下一有效樣本回到原規則，僅在原證據真正撤銷／重建後重新確認。資料不足不得提升為候選，同時間重讀不消耗或延長補顯。

第一個有效持平或回補樣本仍立即撤銷；下降期間的候選總時間與撤銷延遲分開。補顯只改善指定模型最後一次訊號的可見性，不保證全程連續，也不預知下一秒回補。一秒取樣的固定正常配對最多新增一秒；不規則取樣按實際有效區間記錄，不新增牆鐘撤銷計時器。

不足八秒、超過 1.5 秒取樣空隙、非法倍速或數值屬資料不足，不能當成健康。暫停、尋位、拖曳、隱藏、停用、對照、錯誤、結束、片尾完整緩衝或正在救援時不產生候選；控制、媒體、內容、倍速或路線觀察身分改變須重建窗口。缺影格時可用時間判斷，但會標明品質。

傳輸只作旁證，成功、失敗與中止分開統計。沒有完成請求表示未觀察到完成，不能推論零頻寬；跨窗口的完整請求 bytes 不代表逐秒吞吐。結果只進入既有診斷 JSON，不新增 UI 或設定，欄位與重跑方式見 [DEVELOPMENT](DEVELOPMENT.md#唯讀緩衝趨勢診斷)。

唯讀緩衝趨勢的八秒樣本、完成傳輸旁證與候選狀態由 PlayerMonitor 唯一保存。v6 的常數大小狀態包含短期確認、周期峰值／低點、回補階段、最多兩秒欠量與確認時間及時間戳；另有獨立且有界的 lowConfirmation，包含證據種類、累計創低確認及一次性 tailUsed 布林。前次樣本與連續下降覆蓋都沿用既有窗口，不另存樣本。buffer-cycle.ts 只回傳判定與下一狀態，短期事實及 v3 相容確認仍由 buffer-trend.ts 提供，不保存環境狀態。低緩衝及尾段分支只在原候選未成立時提供輸出，原候選原因優先；證據到期或切換不得借用確認額度或補顯機會，狀態不一致撤銷證據。Runtime 轉交既有 transport-completed 的最小投影及 Monitor 快照，不保存第二份窗口；診斷只重建結果的數值／布林／列舉投影。樣本與確認在媒體、控制、內容、倍速或路線觀察身分改變時失效，沒有額外計時器、請求或授權索引；影子結果不得送入選路、量測、恢復或播放命令。Recorder 清除只影響報告，不重設確認或救援。

周期欠量、時間戳及所屬 cycleCreditMs 在到期分支一起失效，先撤銷再處理同樣本的新周期；不借用舊確認額度。短期 confirmation 有獨立的創低期限，仍留在同一 Monitor 狀態內，依自身資格判定。

### 播放進度

診斷同一次嘗試只有首次有效回應初始化播放進度基準；後續同身分及同路線成功不撤回 playback-observed／首次 playbackAt，也不延長 30 秒觀察期限。混合主機、seek、生命週期及新嘗試仍按原契約中斷。

### 控制中心與診斷資料流

ControlCenter 經 ControlReadModelPort 訂閱及取得畫面快照。createControlReadModel 組裝設定、路線、播放與基本診斷；每次建構／刷新只取得一份完整模型，CDN 的所有開關共用同一份資料。詳細 evidence 只在明確報告要求時建立。

非同步命令結束先清 pending，再讀新快照；不得沿用提交前模型。ControlCenter 保存宿主、封閉 ShadowRoot、視圖版本及訂閱，晚到回呼不能更新失效視圖。播放器 tick 更新既有緊湊欄位，不替換焦點、不加輪詢。入口注入版本與剪貼簿服務，UI 不派送 GM／平台 API。

控制中心以當前封閉 ShadowRoot 的冒泡邊界隔離可信 keydown／keypress／keyup，讓 Enter／Space 及表單維持原生預設操作；Escape 關閉。關閉與宿主重建會清理監聽器。不新增焦點循環，亦無法撤銷外層捕捉階段已做的取消。

SettingsState 不含 codec／verbose。PlayurlAdapter 改寫 URL 後保留網站原始表示順序；codec 僅辨識表示。DiagnosticEventSanitizer 不收取 verbose，Recorder 不建立、去重或淘汰額外排名歷史，舊 rankings 欄位永遠空陣列、相關淘汰計數為零。選路需要的即時 ranking 與簡短決策摘要、基本流量、事故及提前重試事件保留；128 KiB／96 KiB／十六筆新事件與 bufferTrend v6 不變。

### 控制中心複製所有權

`ControlCenter` 擁有跨關閉／重開的單一 pending 寫入；clipboard 適配器負責原生 receiver 與 GM 純文字派送。完成回呼只更新原宿主／ShadowRoot／視圖，不重新序列化或搶焦點。可信 click、原生優先／不可取得才備援、失敗及提示要求見 [安全政策](../SECURITY.md#剪貼簿寫入邊界)。

原生 Promise 完成不取代完整讀回驗收；例外只顯示固定失敗提示，不輸出內容或錯誤細節。對應歷史證據由 [HISTORY](HISTORY.md) 追溯。

### 隔離 B 原型的傳輸控制

此相容入口描述 2026-10-30 固定原型，原文見 [2a58517 架構快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/2a5851761d5a066cd3b54cb447b9da546a23187e/docs/ARCHITECTURE.md#隔離-b-原型的傳輸控制)。當前實作見本文件 UP141 提前重試章節，原型限制不作現行工作狀態。
