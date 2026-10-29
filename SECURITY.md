# 信任邊界與資料處理

本指南描述目前 `src-v2/` 的安全要求、實際防護及平台限制，版本以 [release.json](release.json) 為準。已執行的版本別安全審查見 [TEST_REPORT](docs/TEST_REPORT.md) 與 [歷史索引](docs/HISTORY.md)，不把歷史掃描當成新差異的驗證。

瀏覽器驗證只使用 **Codex 內建瀏覽器＋Tampermonkey**，資料隔離、送出前攔截與清理依 [IAB_TESTING](docs/IAB_TESTING.md)。來源隔離、環境校準與實際安裝各自判定；版本別證據由 [HISTORY](docs/HISTORY.md) 追溯。

## 不可信輸入

UP141 測試版包含三台預設關閉 HK 與預設關閉提前重試原型，測試身分不解除以下邊界。可信控制中心只能安排已啟用的三台固定 HK 主機；MeasurementController 重讀目前 video 表示、Catalog 自動模式、Vault 授權與禁止規則，消耗與自動探索相同的十分鐘跨分頁鎖。定向重測只略過自動探索的新鮮度與目前主機篩選，不能自帶 URL 或改親和。待執行要求及探測在政策／內容失效或卸載時撤銷；晚到結果不能續用舊授權。

提前重試只觀察最多十六筆精確歸因、直接 206、單一明確 Range 的非同步 video GET XHR；每筆最多八個近期進度樣本。只有原生可信 progress 提供 bytes，原始 URL／Range／XHR 留在適配器私有狀態。控制器沿用既有 tick，不自行送出媒體請求；原生 timeout setter 的品牌檢查、單次轉換、網站寫入修訂及重用恢復由 XhrHook 保管。兩秒一次性許可須由網站相符重試認領並被原生 send 接受後，RouteCoordinator 才提交親和。腳本要求的 timeout 不算 CDN 失敗、不生成成功樣本或核心恢復；交接失敗後本文件生命週期停用原型。診斷只消費固定狀態／原因與有界數值，Runtime 擁有訂閱清理。

schema 2 的三個 A 開關缺值為 true、提前重試缺值為 false；明確 false 保留。關閉時在儲存等待前抑制新動作，測速政策改變取消腳本探測並拒絕晚到提交，不取消網站請求或重開起播／健康預算。

頁面 JavaScript、`__playinfo__`、播放器資訊清單、playurl 資料內容、媒體 URL、回應標頭、主控台輸出及合成 DOM 事件都不可信。

- 選路前由 `domain/url-policy.ts` 解析並接納 URL。
- `SignedRouteVault` 擁有簽名路線索引、不透明識別碼及當前原生簽名路線（Native）選路授權。適配器及執行路徑也會在記憶體中處理 URL 與資料內容；`PlayerAdapter` 在取代／重設前保存序列化的資訊清單指紋，XHR 保存每筆請求的 URL 狀態。這些資料不得進入持久學習資料或診斷輸出，也不得成為另一份 Native 授權索引。
- 可信 playurl API 的媒體表示會取代較低信任的頁面及播放器提示所授予的 Native 資格；已撤銷的不透明識別碼不得啟動主動探測或建立新的健康證據。
- cid 僅來自所屬、已辨識的 API 請求，保存在 Fetch 閉包／XHR metadata 及控制器私有狀態。只作內容關聯，不是回應驗證或 Native 授權。父目錄備援上限為影片 128／音訊 64；低信任提示不更新基準。cid 與目錄不得輸出到診斷或持久資料。請求重用、failed open、同步重入均維持 context 所有權。
- 未知外部主機必須先有自然發生、可歸因的成功傳輸才可取得證據；不得預先主動探測。
- 控制中心在封閉 Shadow DOM 內執行，操作必須來自可信使用者事件。控制中心僅在當前 UI 自有冒泡邊界停止可信鍵盤傳播，不合成 click、不替代命令，保留原 click／change 信任檢查。關閉／重建清理監聽器並核對宿主身分；不修改全域事件原型或外層監聽器。外層 capture 先執行屬已知限制，須另以實際網站驗證。
- 可信未完成尋位目標只由控制觀察者保存；不透明捕獲證明不授予路線權限。真正零有效，未知位置／新操作／內容與媒體失效撤銷；播放交接須有可信來源。本次自有重載的第一個初始化尋位例外沿用原 15 秒界限及最新操作／路線授權，不接納第二尋位或替換核心。window 捕捉到子元素 blur 不取得視窗失焦資格；真正 window blur／hidden 仍通知控制失效，既有事件遮蔽保留。

已辨識的 MP4／FLV `durl` 分段及 DASH 別名仍是不可信資料內容。漸進式／混合格式輸出先完成規劃才寫回 URL；必要分段若沒有合法主線，不得丟棄該段或輸出部分改寫的成功結果。這是資料內容寫回的原子性，不保證回滾 Vault／控制器登記。型別化 playurl 結果的 `accepted` 必須由每個消費端檢查。嚴格模式下，Fetch 拒絕的 playurl 使用 HTTP 503；XHR 提供安全失敗內容，保留原生 HTTP 狀態。

內建節點清單（Catalog）的來源不透明識別碼表示當前分段已接納、可用於產生內建目標的 URL。改用同段的安全備用來源時，必須保留精確路徑／查詢字串關聯及當前授權檢查。此能力不授予新的 Native 選路權限；不得因另一來源能產生 Catalog 輸出，就把不安全或不可改寫的原線直接放行。

Vault 可以保存可改寫的 PCDN URL，僅在換主機後成為正常內建目標時供 Catalog 產生使用；它仍不可選為 Native。漸進式輸出使用同段的標準來源；同媒體表示的安全 DASH 精確／Catalog 別名請求保留當前查詢字串。兩者都不得放寬最終目標限制。

內部原線決策區分原樣通行與 Vault 選中的原線；後者以當前身分與不透明 handle 解析精確 URL，重查政策／禁止規則。同一選定主機上的 DASH 請求保留當次查詢字串。漸進式來源在正規化、去重、容量限制後以集合比較；相同集合更新 primary／順序但保留 handles／aliases／authority，真正新增、移除、換簽名或可信提升仍撤銷。

## 持久資料

產品使用四個持久鍵：`bilicdn.v2.settings`、`bilicdn.v2.restrictions`、`bilicdn.v2.routeEvidence` 及 `bilicdn.v2.meta`。

`SettingsStore`、`RestrictionStore` 及 `EvidenceStore` 依解析器實作的限制重建已知欄位；Tampermonkey API 可用時訂閱值變更。設定寫入與限制／證據修改使用各自儲存鎖。集合及樣本上限不能推論為每個原始外層欄位都有有限上界。

`MeasurementMetaStore` 按需讀取 schema 2 的自有資料欄位，拒絕陣列、accessor、數字字串及非有限值；游標限制為非負安全整數，冷卻時間限制為非負且不晚於本次合法時鐘。讀取不改寫儲存，明確更新只重建 schema、catalogCursor、lastChallengeAt、updatedAt，不延續未知 payload。無效欄位與時鐘按架構規則回退，不提供任意 Proxy 或平台 API 的完整例外隔離。量測控制器持有 `measurement` 鎖，起播在鎖內重讀游標及重新驗證標記；`get`、`update`、`clear` 不自行取得鎖。見 [measurement-meta-store.ts](src-v2/state/measurement-meta-store.ts) 與 [儲存架構](docs/ARCHITECTURE.md#狀態層)。

Web Locks 可用時使用鎖，否則儲存介面直接執行工作，沒有跨分頁序列化。Tampermonkey 監聽器 API 不可用時也有替代路徑。同步能力取決於平台 API 是否可用。

產品自有持久資料為設定、限制、主機證據及量測游標／時間中繼資料。不得新增持久化的簽名 URL、路徑、查詢字串、權杖、播放器物件、媒體表示狀態或事故時間線。中繼資料白名單只約束該鍵的後續明確更新；不是其他鍵或既存使用者資料的通用清理。

## 網路權限

- 適配器正規化外部觀察；只有應用層控制器可以發起選路、量測或恢復。
- 僅 `MeasurementController` 可以啟動主動探測。
- 僅 `RouteCoordinator` 可以變更親和主機（目前路線綁定）或提交備援。
- 僅 `RecoveryController` 可以重載播放器核心。
- 診斷消費型別化事件，不得施加懲罰或控制播放。
- 啟用時，Fetch 檢查的 Request 與原生 API 送出的 Request 是同一個平台正規化物件。主動探測拒絕轉址，只接納受檢主機的直接 Range 回應。
- 正常選路預設使用生成的內建 Catalog 路線。開啟原生來源參考後，僅接納合法且符合當前身分的精確路線；分頁原線對照獨立運作。整體停用會原樣放行網站請求，停止腳本主動量測／恢復。
- `trusted-api` 來源標籤依辨識出的 playurl 請求端點決定，不是密碼學來源保證，也不證明最終回應來源。仍須保留授權提升及已撤銷不透明識別碼的檢查。
- 僅使用 Catalog 媒體 Fetch 使用 `redirect: 'error'`。XHR 無法事先阻止轉址；觀察到非 Catalog 最終主機時，不確認為 Catalog 路線。未經已安裝 Fetch／XHR 攔截的請求及已送出的網站請求不在攔截範圍內；本專案的實際目的地確認使用內建瀏覽器 Network 證據，另記錄事件完整性。

候選清單保留全部 14 個 Catalog 主機，其中 7 個預設不可用。起播預算為每分頁一次、最多 3 個並行探測、共用 3 秒期限，MP4／FLV 不逐段建立預算。未探測候選在排名、備用輸出及後續探索前仍須通過相同限制與安全 URL 生成檢查。僅使用 Catalog 最多輸出 5 個與主線及彼此不同主機的備用網址。

僅使用 Catalog 起播沒有有效結果時，不提交測速贏家；最終送出對完整剩餘合法候選池排名。Catalog 403 只失效當前串流／主機配對，不因此授權原始來源備援。

整體停用優先於分頁原線對照及正常固定／自動選路。固定主機、Catalog 覆寫設定或原生來源設定變更會失效計畫並重設探測／恢復；舊非同步探測結果不得覆蓋當前設定。已送出的網站請求保持原樣。

首個合法起播窗口開始時立即消耗每分頁預算，後來的 Fetch／XHR 先加入共用 pending，再檢查已用預算；epoch／generation／設定 reset 不重開預算，沒有合法候選不消耗。健康量測的 planning／running 以各輪所有權在 finally 清理；probe、儲存鎖或寫入拒絕以固定 measurement-error 收束，遵守 10 分鐘冷卻，不輸出例外內容、不新增立即重試。`EvidenceStore` 只在寫入成功後發布記憶體成功樣本；舊完成或拒絕不能清除新輪次。

## 瀏覽器行為

### 可信播放意圖

長暫停後，網站核心可能忽略播放按鈕而不呼叫 SDK play。`PlayerAdapter` 同時觀察現有 SDK 方法及目前播放器區域的可信 `.bpx-player-ctrl-play` click；僅同一 paused 媒體、播放器、內容週期、真正可見且非 ended/error 才通知既有意圖。讀取前後核對控制／使用者修訂與清理狀態，事件與 DOM 不傳入應用層。

`RecoveryController` 保留暫停至少 30 秒、拖曳／路線授權／政策／操作所有權／額度檢查；死核心 4 秒、其他無進度 30 秒與重載後 15 秒期限維持。正常進度不多做重載，沒有新操作不替暫停影片自行播放。每輪返回的取消函式清理自有 document 捕捉監聽器，SDK 方法只還原自有包裝；Runtime reset 先解除 Recovery 訂閱。

此觀察不授予新的 Native 路線或傳輸權限。各版政策與修復證據由 [HISTORY](docs/HISTORY.md) 追溯；安裝版故障救援的未執行限制以 [TEST_REPORT](docs/TEST_REPORT.md) 原紀錄為準，歷史 FAIL 不回寫。

### 鍵盤、拖曳與自有重載

BODY／頁面焦點的 Space、k／K 及既有倍速鍵以私有 keydown 候選關聯實際控制變化；須 isTrusted、真正可見、同播放器／媒體／核心／生命週期，且事件仍在派送。只有 paused 或有限 playbackRate 在該派送內確實改變，才取得一次 userRevision。editable／封閉控制中心／IME／Ctrl／Meta／Alt、合成或忽略命令及派送後工作不能取得身分。播放器區域的既有 keydown 操作觀察及下述可信 seek 鍵規則保留；腳本的還原方法清除自己的候選，不能冒充使用者操作。零延遲 timeout 僅釋放參照，清理確認候選及監聽器所有權。

自有 SDK reload 的 pause／空核心例外僅屬本次合法 stall token 與 reload 修訂，透過 `PlayerPort.ownedReload(revision)` 回傳有界布林證明；DOM／核心／事件留在適配器私有記憶體。最多接納本次第一個替換核心，原核心在空隙後回來、第二次替換、新可信操作、hidden／control-loss 或生命週期失效都撤銷。空核心上的舊 reload 標記不具資格；首個非零替換須標記相符、初始化狀態不是 false 並通過健康觀察，每個 seek／setRate／play 前仍核對最新 video 請求、Vault、政策／限制與 token。

沒有有效可信目標證明時，SDK 初始化的未知 seek 撤銷舊位置還原，不猜成可信操作，不覆寫 SDK 最新目標；其餘合法播放意圖仍受重載後 15 秒無進度期限與所有權檢查。只有實際時間／影格進度才能停止無進度計時，兩個連續有效採樣才 recovered；保留尺寸、readyState 或初始化 seek 跳躍不能清除失敗／breaker。已還原且首次進度被接納後，以同一穩定所有者維持最多 15 秒的確認資格，不延長 pause／空核心租期、不授予還原副作用或新核心接納；未形成持續進度仍失敗。終止後 SDK resume 不重開救援，真正進度或新的使用者／媒體所有權才可清除失敗停滯抑制。觀察租期到期、同步重入與晚到 Promise 不能復活或回寫舊動作，也不能否定已接納的合法進度。此內部證明不授予 Native 權限，不新增持久或診斷識別資料；未經可觀察方法的外部核心替換仍有既有辨識限制，不能把頁面標記描述成認證。

控制觀察僅提供取消／動作所有權，不授予 Native 權限。可信 pointer／非 seek key 需 isTrusted 與播放器區域；非 seek key 僅觀察 keydown。可信 seek 鍵可來自頁面焦點，但排除 editable／控制中心／組字／Ctrl／Meta／Alt，須真正可見、該可信 keydown 或 keyup 尚在派送、同播放器／媒體／生命週期，且實際有限位置改變，並 seeking 或 readyState 0／捕捉核心未變／非 internalReload，才取得一次使用者修訂。同派送的 wrapper／媒體／controls／冒泡觀察去重；keydown、repeat、keyup 若各自形成新 seek，各自取得一次身分，沒有位置變化則不計數。eventPhase NONE、腳本還原及晚到工作不能取得新寬限；鍵盤不建立按住狀態或延遲窗口。零延遲 timer 僅釋放私有事件參照，清理綁定實際事件種類且舊回呼確認候選身分。pendingSeek 保守抑制腳本還原，不因可信輸入全面清空；來源無法可靠辨識時不猜測使用者歸因。媒體及 page seek／reload 另有觀察修訂。core reload／還原仍核對最新 video 請求、Vault／政策／禁止／固定路線、操作及核心身分。自有 reload 的替換標記來自頁面觀察，無法認證所有未經可觀察方法的外部替換。監聽器由 adapter reset 清理，seek／reload wrapper 還原確認目前所有權；不把 DOM／事件／核心物件交給應用層或診斷。

指標拖曳使用目前播放器區域內的可信 pointerdown 及已知進度祖先，包含功能性 `.bpx-player-progress-wrap`；命中祖先不能跨出播放器區域。尚未 seeking 或改位置的預覽也取得保護，但不因此授予新的選路／探測權限。單一私有手勢保存 pointerId、媒體、播放器及生命週期；新合法進度按下取代舊手勢，同指標可信 pointerup／pointercancel／lostpointercapture 才可釋放。合成事件、別的指標及非進度按下不撤銷當前手勢，同步重入後核對觀察版本與物件身分。

真正 hidden、可信失焦及生命週期／媒體／播放器失效撤銷手勢。`VisibilityAdapter` 的既有 guard 在阻擋事件前發布內部 control-loss 通知；入口注入，控制觀察取消訂閱，失敗 listener 不破壞 guard，controls() 保留真正可見性防漏。通知不把 DOM／事件交給應用層，不改網站可見性覆寫、不新增 pointer capture 或拖曳 timeout。

監控停滯、watchdog 及冷起播都排除 dragging，拖曳清除舊停滯及連續計數，不消耗起播救援嘗試。Recovery 收集位置／倍速前後核對 controls，提交 token 前重新檢查最新有效資格、生命週期、媒體／核心／操作、已存在 token、breaker 與總額；既有每個副作用及晚到 Promise 所有權檢查保留。一般停滯釋放後依是否尋位取得 6／12 或 15／30 秒；冷起播保留原 firstMediaAt，可能立即救援，不重開預算。外部操作介面與持久 schema 2 不變；內部 PlayerControlSnapshot 新增可選 pendingSeekGoal，只供 Monitor 判斷政策，不新增持久或診斷識別資料。

腳本不取代或檢視 `Worker`，不建立 Worker 二進位資料物件（Blob）或訊息通道，也不載入遠端程式。

WebRTC 還原前會確認已安裝的讀取存取器／寫入存取器仍屬於本腳本。可見性清理會移除自有監聽器，僅在安裝目標的目前 accessor 與本次 getter、setter、enumerable、configurable 全部相符時，還原保存的完整描述子或移除自有屬性。較新 accessor、資料屬性、刪除及旗標變更均保留；描述子讀取或還原失敗只放棄該項，不呼叫屬性 getter，也不在下次釋放重試。此檢查無法辨識完全相同描述子的重新安裝來源；control-loss 訂閱仍由取消函式管理。

### 還原補正與只讀進度的權限

自有重載的原生位置與倍速確認，分別受當前控制修訂、媒體／播放器／核心、內容週期、路線資格及原期限約束。SDK 返回或 Promise 完成不授予成功或額外寫入權限；原生未知值不觸發推測補正。SDK 命令滿一秒、非 pending／seeking、已知結果不符且仍持有所有權時，位置與倍速各最多補正一次，既有原生備援占用相同額度；寫入前消耗，失敗或重入不重試。完整順序與數值條件見 [自有重載產品契約](docs/PROJECT_CONTEXT.md#br-01-自有-sdk-重載後續恢復契約)。

只讀 progress 觀察與有界失敗證據不能延長寫入資格、再次接納核心、啟動 play 或新增 reload。play 方法 getter 返回後重查當前所有權；新操作、控制失效或逾期後的晚到工作不能回復舊授權。Observer 擁有命令與原生事實，Recovery 擁有階段與額度；診斷不得取得任一寫入權限，亦不建立可持久化的還原 token。

## 原生位置觀察邊界

沒有有效未完成目標證明時，未初始化媒體的有限原生位置（包含 0）優先於 SDK 快取，僅作新意圖保存值；未知目標變更只撤銷過期還原，不授予可信 userRevision、Vault 身分或恢復資格。新可信鍵盤目標另需同一 keydown／keyup 派送、捕捉核心不變、非 internalReload 與既有來源抑制。getter／SDK 返回後重查媒體、播放器、生命週期與操作修訂。

原生 readyState／currentTime 的例外回退不涵蓋全部頁面 getter。自有 reload 初始零、pendingSeek／internalSeek、正常播放增量及未知位置往返各有邊界；完全沒有被採樣的變化無法推定。新增觀察不產生網路、持久欄位或診斷識別。

## 測試工具與資料邊界

- 只在內建瀏覽器使用當前工具允許的控制介面；不繞過擴充功能頁面或工具安全限制，不換外部瀏覽器執行測試。
- 先精確比對 video／audio，再於送出前持有自有匹配請求；禁止規則／HTTPDNS 合成案例不得真的外送。完整簽名 URL 僅在測試記憶體比對，不寫入文件、截圖或事件輸出。
- 受控 transport／startup／challenge ID 必須在故障前具有寫入抑制，保留到晚到提交收束。不能以清空學習或整份舊資料覆蓋來清理受控樣本；無法隔離便不開始該故障窗。
- 只控制工具持有的回應或實際 SDK 方法的自有回傳邊界。保存 receiver、參數、例外與完整描述子，還原時確認所有權，不能覆寫其他腳本的新包裝。
- 不修改網站媒體 getter、重建 singleton 或重設預算來製造通過。背景測試區分 document 實例偽裝、已校準原生 getter 與 Runtime 資格；不以合成事件、面板隱藏或單一工具 ID 代替真正背景。
- 每窗保存事件完整性與清理結果。原始播放器／核心／DOM 物件不輸出；報告只保留有界狀態、次數、時間與不透明測試 ID。

## 回報

診斷輸出有上限並經遮蔽，可以包含正規化的 Catalog 或已知 Native 主機；未知第三方主機使用分頁代稱。不得包含媒體 URL、路徑、查詢字串、權杖、影片 ID、Cookie、IP 或播放器／核心物件。

最近 playurl 摘要只複製傳輸類型、時間、原生 HTTP 狀態、接納結果、最多三種已知格式、有上限的影片／音訊／分段數量、數字上游 `code` 及列舉拒絕原因。只保存一筆不可變紀錄，不保存資料內容、額外結果欄位或例外文字。此摘要不證明實際網路目的地或播放成功，也不新增持久鍵。

執行期問題請透過儲存庫問題追蹤區回報，不要附上未遮蔽的瀏覽器網路匯出檔。

## XHR 準備與取消原因

XHR 每個等待請求內部最多兩次原生 open；每個同步還原邊界重查 owner／phase／原生 OPENED，最新政策與原生目標一致才歸因及送出。未被原生接受的 dispatch 例外清除 pending 歸因，不記錄 CDN 失敗樣本；已送出請求不重播。本地終止事件逐個檢查所有權，不能污染重用的請求。起播 gate 的 AbortSignal reason 只回傳 caller，不輸出、持久化或傳給共用 probe controller；falsy 原值也必須保留。

XHR header 依 ByteString 在入口轉換一次，原生接受後才存字串供內部 reopen；body 的字串分支在 phase 變更前轉為 USVString，原例外保留，更正後可送出。平台品牌檢查保留跨 realm Blob／Document／FormData／URLSearchParams／ArrayBuffer／view，轉換重入後重新取得 metadata；已送出請求不重播。原生未送出的 abort 不一律變成 UNSENT，正式替身依原生對照校準。

版本別安全審查與原生 XHR 對照見 [CR 修復報告](archive/retired/docs/CR01_CR05_FIX_REPORT.md) 及 [TEST_REPORT](docs/TEST_REPORT.md)。S-02 相對 URL／base 與 raw SharedArrayBuffer 尚未取得原生結論，不能宣稱所有 body 型別或整份安裝矩陣通過。

## 剪貼簿寫入邊界

診斷複製在可信 click 內立即呼叫原生 Clipboard API，保留 receiver 與當次完整文字；API 不可取得時才呼叫一次 GM 純文字備援。原生拋錯／拒絕不自動改走 GM。單一 `ControlCenter` 的 pending 寫入跨關閉／重開仍有效，提示與按鈕只更新原宿主／ShadowRoot／視圖；不重新產生報告、不搶焦點、不新增剪貼簿讀取。GM 返回只提示交由管理器處理，不宣告複製成功。

原生 Promise 完成不取代完整讀回驗收；例外只顯示固定失敗提示，不輸出內容或錯誤細節。對應歷史證據見 [P05 修復報告](archive/retired/docs/P05_COPY_FIX_REPORT.md)。
