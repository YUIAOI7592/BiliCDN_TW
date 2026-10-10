<a name="trust-boundaries-and-data-handling"></a>

# 信任邊界與資料處理

**2026-10-11 目前政策維護對象為 v2.1.17 BR-01 SDK 重載後續恢復候選版，修復與必要驗證完成，尚未發布。** typecheck、44 個執行期模組架構、19 套件／716／716 與最終 verify v2.1.17 通過；本輪獨立 Codex Security 差異 `39e2743e-185d-4c7d-a04d-f6580e61385a` 已封存，11／11 差異項、0 候選／0 可報告發現。主機另警告整體工作目錄變動；四個執行期檔案與凍結來源雜湊一致，不宣稱整體目錄快照一致。最後 Chrome 來源隔離 22／22（12 個控制模型＋10 個真正可信輸入）通過並完成清理；自有 iframe、合成媒體／FakeClock 及 31 秒模型拖曳不代表新版安裝驗收。已發布／安裝基準仍為 v2.1.16，發布／公開核對及新版安裝結果各自待完成。新增內部所有權證明不放寬既有網路授權、持久資料或診斷限制。

本文件是 `src-v2/` **v2.1.17 BR-01 後續恢復契約**的執行期信任邊界指南，保留 BR-08 完整拖曳及 BR-01～07。BR-08 與 v2.1.16 的修復、必要驗證及發布／公開產物核對為上一輪完成證據；2026-10-10 21:11:07.331（Asia/Taipei）實際 Chrome 已核對該版完整本體、唯一 singleton 及 hooks，BR-01 完整安裝驗收仍未完成，已有 Auto 1／2 倍拖曳保護、基本播放及約 12 秒 video-only 延遲後恢復的部分證據。設定版本以 release.json 為準，本輪修復見 [後續修復報告](docs/BR01_FOLLOWTHROUGH_FIX_REPORT.md)，發布及安裝驗收見 [驗證報告](docs/TEST_REPORT.md)；安全差異與 Chrome／Tampermonkey 分列，不能互相替代。原 [BR-08 進度拖曳漏辨](docs/CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 是功能缺陷證據，未當成已解決的安全發現。文件用途見 [文件索引](docs/INDEX.md)，本文件本身不要求啟動安全掃描。

<a name="untrusted-inputs"></a>

## 不可信輸入

頁面 JavaScript、`__playinfo__`、播放器資訊清單、playurl 資料內容、媒體 URL、回應標頭、主控台輸出及合成 DOM 事件都不可信。

- 選路前由 `domain/url-policy.ts` 解析並接納 URL。
- `SignedRouteVault` 擁有簽名路線索引、不透明識別碼及當前原生簽名路線（Native）選路授權。適配器及執行路徑也會在記憶體中處理 URL 與資料內容；`PlayerAdapter` 在取代／重設前保存序列化的資訊清單指紋，XHR 保存每筆請求的 URL 狀態。這些資料不得進入持久學習資料或診斷輸出，也不得成為另一份 Native 授權索引。
- 可信 playurl API 的媒體表示會取代較低信任的頁面及播放器提示所授予的 Native 資格；已撤銷的不透明識別碼不得啟動主動探測或建立新的健康證據。
- BR-03 的 cid 僅來自所屬、已辨識的 API 請求，保存在 Fetch 閉包／XHR metadata 及控制器私有狀態。只作內容關聯，不是回應驗證或 Native 授權。父目錄備援上限為影片 128／音訊 64；低信任提示不更新基準。cid 與目錄不得輸出到診斷或持久資料。請求重用、failed open、同步重入均維持 context 所有權。
- 未知外部主機必須先有自然發生、可歸因的成功傳輸才可取得證據；不得預先主動探測。
- 控制中心在封閉 Shadow DOM 內執行，操作必須來自可信使用者事件。

已辨識的 MP4／FLV `durl` 分段及 DASH 別名仍是不可信資料內容。漸進式／混合格式輸出先完成規劃才寫回 URL；必要分段若沒有合法主線，不得丟棄該段或輸出部分改寫的成功結果。這是資料內容寫回的原子性，不保證回滾 Vault／控制器登記。型別化 playurl 結果的 `accepted` 必須由每個消費端檢查。嚴格模式下，Fetch 拒絕的 playurl 使用 HTTP 503；XHR 提供安全失敗內容，保留原生 HTTP 狀態。

內建節點清單（Catalog）的來源不透明識別碼表示當前分段已接納、可用於產生內建目標的 URL。改用同段的安全備用來源時，必須保留精確路徑／查詢字串關聯及當前授權檢查。此能力不授予新的 Native 選路權限；不得因另一來源能產生 Catalog 輸出，就把不安全或不可改寫的原線直接放行。

Vault 可以保存可改寫的 PCDN URL，僅在換主機後成為正常內建目標時供 Catalog 產生使用；它仍不可選為 Native。漸進式輸出使用同段的標準來源；同媒體表示的安全 DASH 精確／Catalog 別名請求保留當前查詢字串。兩者都不得放寬最終目標限制。

<a name="persistent-data"></a>

## 持久資料

產品使用四個持久鍵：`bilicdn.v2.settings`、`bilicdn.v2.restrictions`、`bilicdn.v2.routeEvidence` 及 `bilicdn.v2.meta`。

`SettingsStore`、`RestrictionStore` 及 `EvidenceStore` 依解析器實作的限制重建已知欄位；Tampermonkey API 可用時訂閱值變更。設定寫入與限制／證據修改使用各自儲存鎖。集合及樣本上限不能推論為每個原始外層欄位都有有限上界。

`MeasurementMetaStore` 按需重新讀取物件，轉換游標／冷卻欄位，更新時保留既有原始欄位；沒有值變更監聽器，也沒有完整資料結構或有限上界驗證。量測控制器在規劃寫入時使用它的 `measurement` 鎖；`get`、`update`、`clear` 不自行取得鎖。見 [measurement-meta-store.ts](src-v2/state/measurement-meta-store.ts)。

Chrome Web Locks 可用時使用鎖，否則儲存介面直接執行工作，沒有跨分頁序列化。Tampermonkey 監聽器 API 不可用時也有替代路徑。同步能力取決於平台 API 是否可用。

產品自有持久資料為設定、限制、主機證據及量測游標／時間中繼資料。不得新增持久化的簽名 URL、路徑、查詢字串、權杖、播放器物件、媒體表示狀態或事故時間線。中繼資料的原始欄位合併不提供通用儲存清理能力。

<a name="network-authority"></a>

## 網路權限

- 適配器正規化外部觀察；只有應用層控制器可以發起選路、量測或恢復。
- 僅 `MeasurementController` 可以啟動主動探測。
- 僅 `RouteCoordinator` 可以變更親和主機（目前路線綁定）或提交備援。
- 僅 `RecoveryController` 可以重載播放器核心。
- 診斷消費型別化事件，不得施加懲罰或控制播放。
- 啟用時，Fetch 檢查的 Request 與原生 API 送出的 Request 是同一個平台正規化物件。主動探測拒絕轉址，只接納受檢主機的直接 Range 回應。
- 正常選路預設使用生成的內建 Catalog 路線。開啟原生來源參考後，僅接納合法且符合當前身分的精確路線；分頁原線對照獨立運作。整體停用會原樣放行網站請求，停止腳本主動量測／恢復。
- `trusted-api` 來源標籤依辨識出的 playurl 請求端點決定，不是密碼學來源保證，也不證明最終回應來源。仍須保留授權提升及已撤銷不透明識別碼的檢查。
- 僅使用 Catalog 媒體 Fetch 使用 `redirect: 'error'`。XHR 無法事先阻止轉址；觀察到非 Catalog 最終主機時，不確認為 Catalog 路線。未經已安裝 Fetch／XHR 攔截的請求及已送出的網站請求不在攔截範圍內；實際目的地須由 Chrome 開發者工具的網路面板（Network）證據確認。

候選清單保留全部 11 個 Catalog 主機，其中 4 個預設不可用。起播預算為每分頁一次、最多 3 個並行探測、共用 3 秒期限，MP4／FLV 不逐段建立預算。未探測候選在排名、備用輸出及後續探索前仍須通過相同限制與安全 URL 生成檢查。僅使用 Catalog 最多輸出 5 個與主線及彼此不同主機的備用網址。

僅使用 Catalog 起播沒有有效結果時，不提交測速贏家；最終送出對完整剩餘合法候選池排名。Catalog 403 只失效當前串流／主機配對，不因此授權原始來源備援。

整體停用優先於分頁原線對照及正常固定／自動選路。固定主機、Catalog 覆寫設定或原生來源設定變更會失效計畫並重設探測／恢復；舊非同步探測結果不得覆蓋當前設定。已送出的網站請求保持原樣。

<a name="browser-behavior"></a>

## 瀏覽器行為

本輪 BODY／頁面焦點的 Space、k／K 及既有倍速鍵以私有 keydown 候選關聯實際控制變化；須 isTrusted、真正可見、同播放器／媒體／核心／生命週期，且事件仍在派送。只有 paused 或有限 playbackRate 在該派送內確實改變，才取得一次 userRevision。editable／封閉控制中心／IME／Ctrl／Meta／Alt、合成或忽略命令及派送後工作不能取得身分。播放器區域的既有 keydown 操作觀察及下述 BR-07 seek 鍵規則保留；腳本的還原方法清除自己的候選，不能冒充使用者操作。零延遲 timeout 僅釋放參照，清理確認候選及監聽器所有權。

自有 SDK reload 的 pause／空核心例外僅屬本次合法 stall token 與 reload 修訂，透過 `PlayerPort.ownedReload(revision)` 回傳有界布林證明；DOM／核心／事件留在適配器私有記憶體。最多接納本次第一個替換核心，原核心在空隙後回來、第二次替換、新可信操作、hidden／control-loss 或生命週期失效都撤銷。空核心上的舊 reload 標記不具資格；首個非零替換須標記相符、初始化狀態不是 false 並通過健康觀察，每個 seek／setRate／play 前仍核對最新 video 請求、Vault、政策／限制與 token。

SDK 初始化的未知 seek 撤銷舊位置還原，不猜成可信操作，不覆寫 SDK 最新目標；其餘合法播放意圖仍受重載後 15 秒無進度期限與所有權檢查。只有實際時間／影格進度才能停止無進度計時，兩個連續有效採樣才 recovered；保留尺寸、readyState 或初始化 seek 跳躍不能清除失敗／breaker。已還原且首次進度被接納後，以同一穩定所有者維持最多 15 秒的確認資格，不延長 pause／空核心租期、不授予還原副作用或新核心接納；未形成持續進度仍失敗。終止後 SDK resume 不重開救援，真正進度或新的使用者／媒體所有權才可清除失敗停滯抑制。觀察租期到期、同步重入與晚到 Promise 不能復活或回寫舊動作，也不能否定已接納的合法進度。此內部證明不授予 Native 權限，不新增持久或診斷識別資料；未經可觀察方法的外部核心替換仍有既有辨識限制，不能把頁面標記描述成認證。

BR-01 的控制觀察僅提供取消／動作所有權，不授予 Native 權限。可信 pointer／非 seek key 需 isTrusted 與播放器區域；非 seek key 僅觀察 keydown。BR-07 的 seek 鍵可來自頁面焦點，但排除 editable／控制中心／組字／Ctrl／Meta／Alt，須真正可見、該可信 keydown 或 keyup 尚在派送、同播放器／媒體／生命週期，且實際有限位置改變並 seeking 才取得一次使用者修訂。同派送的 wrapper／媒體／controls／冒泡觀察去重；keydown、repeat、keyup 若各自形成新 seek，各自取得一次身分，沒有位置變化則不計數。eventPhase NONE、腳本還原及晚到工作不能取得新寬限；鍵盤不建立按住狀態或延遲窗口。零延遲 timer 僅釋放私有事件參照，清理綁定實際事件種類且舊回呼確認候選身分。pendingSeek 保守抑制腳本還原，不因可信輸入全面清空；來源無法可靠辨識時不猜測使用者歸因。媒體及 page seek／reload 另有觀察修訂。core reload／還原仍核對最新 video 請求、Vault／政策／禁止／固定路線、操作及核心身分。自有 reload 的替換標記來自頁面觀察，無法認證所有未經可觀察方法的外部替換。監聽器由 adapter reset 清理，seek／reload wrapper 還原確認目前所有權；不把 DOM／事件／核心物件交給應用層或診斷。

BR-08 指標拖曳使用目前播放器區域內的可信 pointerdown 及已知進度祖先，包含功能性 `.bpx-player-progress-wrap`；命中祖先不能跨出播放器區域。尚未 seeking 或改位置的預覽也取得保護，但不因此授予新的選路／探測權限。單一私有手勢保存 pointerId、媒體、播放器及生命週期；新合法進度按下取代舊手勢，同指標可信 pointerup／pointercancel／lostpointercapture 才可釋放。合成事件、別的指標及非進度按下不撤銷當前手勢，同步重入後核對觀察版本與物件身分。

真正 hidden、可信失焦及生命週期／媒體／播放器失效撤銷手勢。VisibilityAdapter 的既有 guard 在阻擋事件前發布內部 control-loss 通知；入口注入，控制觀察取消訂閱，失敗 listener 不破壞 guard，controls() 保留真正可見性防漏。通知不把 DOM／事件交給應用層，不改網站可見性覆寫、不新增 pointer capture 或拖曳 timeout。

監控停滯、watchdog 及冷起播都排除 dragging，拖曳清除舊停滯及連續計數，不消耗起播救援嘗試。Recovery 收集位置／倍速前後核對 controls，提交 token 前重新檢查最新有效資格、生命週期、媒體／核心／操作、已存在 token、breaker 與總額；既有每個副作用及晚到 Promise 所有權檢查保留。一般停滯釋放後取得新 15／30 秒；冷起播保留原 firstMediaAt，可能立即救援，不重開預算。公開 API、應用層快照及 schema 2 不變，也不新增持久或診斷識別資料。

腳本不取代或檢視 `Worker`，不建立 Worker 二進位資料物件（Blob）或訊息通道，也不載入遠端程式。

WebRTC 還原前會確認已安裝的讀取存取器／寫入存取器仍屬於本腳本。可見性清理會移除監聽器，嘗試還原保存的 `document` 屬性描述子或移除自有屬性；目前可見性實作還原前沒有檢查屬性描述子所有權。描述攔截時必須依各自的還原行為說明。

<a name="reporting"></a>

## 回報

診斷輸出有上限並經遮蔽，可以包含正規化的 Catalog 或已知 Native 主機；未知第三方主機使用分頁代稱。不得包含媒體 URL、路徑、查詢字串、權杖、影片 ID、Cookie、IP 或播放器／核心物件。

最近 playurl 摘要只複製傳輸類型、時間、原生 HTTP 狀態、接納結果、最多三種已知格式、有上限的影片／音訊／分段數量、數字上游 `code` 及列舉拒絕原因。只保存一筆不可變紀錄，不保存資料內容、額外結果欄位或例外文字。此摘要不證明實際網路目的地或播放成功，也不新增持久鍵。

執行期問題請透過儲存庫問題追蹤區回報，不要附上未遮蔽的瀏覽器網路匯出檔。


## XHR 準備與取消原因

XHR 每個等待請求內部最多兩次原生 open；每個同步還原边界重查 owner／phase／原生 OPENED，最新政策與原生目標一致才歸因及送出。未被原生接受的 dispatch 例外清除 pending 歸因，不記錄 CDN 失敗樣本；已送出請求不重播。本地終止事件逐個檢查所有權，不能污染重用的請求。起播 gate 的 AbortSignal reason 只回傳 caller，不輸出、持久化或傳給共用 probe controller；falsy 原值也必須保留。
