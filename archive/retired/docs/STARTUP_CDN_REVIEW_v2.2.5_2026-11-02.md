# v2.2.5 起播 CDN 多次切換調查紀錄

## 調查基準與判定方式

日期：2026-11-02（Asia/Taipei）。程式基準為 v2.2.5／`0e1375a224eee0afa409e0a6fea50837968c9aac`。使用者回報起播需要經過多輪 CDN 才找到可用來源，要求逐步討論並保存可疑點。工作狀態集中於 [TODO](../../../docs/TODO.md#起播-cdn-多次切換逐步調查)，現行產品規則仍以 [ARCHITECTURE](../../../docs/ARCHITECTURE.md) 為準。

下表區分已由程式碼確認的機制，以及該機制可能造成的影響。全部項目都尚未確認為使用者此次多次換站的根因，也未決定必須修改；需後續用當片、媒體種類、請求順序與失敗結果驗證。這是固定版本的程式碼調查，不是新安裝驗收或修復交付。

## 已保存疑點

### 第一步 主線與備援清單

| ID | 程式碼已確認的機制 | 可能影響與待核對事項 | 定義位置 |
| --- | --- | --- | --- |
| S01 | 無足夠學習資料時，可落到排名最前的合法 Catalog；條件相同以 catalogIndex 排序 | 清單順序可能決定起手主機；核對連續換站前是否缺少有效速度、是否一直由相同未測主機開始 | [routing](../../../src-v2/domain/routing.ts) |
| S02 | Evidence 依主機與 video／audio 分開，樣本 TTL 為 24 小時；並非每支影片各自保存一份供片保證 | 舊片的成功與速度可能不代表當片；核對樣本年齡、來源及當片回應 | [evidence](../../../src-v2/domain/evidence.ts)、[EvidenceStore](../../../src-v2/state/evidence-store.ts) |
| S03 | 有成功且達需求 1.35 倍的備援優先，剩餘可納入未實測的合法候選；最多五條 | 主線與前幾個備援可能都沒有當片成功證據；核對輸出清單與實際重試順序 | [player-output-plan](../../../src-v2/domain/player-output-plan.ts)、[player-output](../../../src-v2/application/routing/player-output.ts) |
| S04 | 一般 plan 呼叫可直接重用既有合法計畫；健康邊界也優先沿用目前主機 | 符合限制不等於已證明當片目前可下載；核對初始計畫是否未有成功傳輸便被反覆沿用。故障／watchdog／設定重選有另外邊界，不能概括為永遠不換站 | [RouteCoordinator.plan](../../../src-v2/application/route-coordinator.ts)、[chooseRoute](../../../src-v2/domain/routing.ts) |
| S05 | 允許 Native、startup 且無合法固定或沿用主機時，原始來源優先於其他歷史足速候選 | 即使其他 CDN 有較好舊速度，第一步仍可能先試原始來源；這是既有偏好，是否符合期望需另討論 | [chooseRoute](../../../src-v2/domain/routing.ts) |

### 第二步 起播預測速

| ID | 程式碼已確認的機制 | 可能影響與待核對事項 | 定義位置 |
| --- | --- | --- | --- |
| S06 | XHR 只有非同步且 timeout=0 才等待起播 gate；同步或明確 timeout 的 XHR 直接送出 | 網站自設 timeout 時可能完全跳過預測速；核對真正請求類型、timeout 與 startup reason | [XHR hook](../../../src-v2/adapters/xhr-hook.ts) |
| S07 | 第一筆合資格影音請求共用一次窗口，開始即消耗預算；同次頁面載入不替 video 另外保留一輪 | 音訊先到可能用掉機會，影片只等待音訊那輪結束；核對第一個啟動窗口的 kind／representation | [MeasurementController](../../../src-v2/application/measurement-controller.ts)、[startupOptions](../../../src-v2/application/route-coordinator.ts) |
| S08 | 最多三個候選；Native 模式先納入這次請求的原始主機及至多一個其他 Native，Catalog 依持久游標補位；Catalog-only 依游標選三個 | 未必包含歷史最好的主機，Native 模式留給 Catalog 的位置也可能只有一個；核對候選組裝與當片成功主機是否落在窗口外 | [startupCandidates](../../../src-v2/application/routing/candidate-planning.ts) |
| S09 | 五分鐘內更新且有有效速度的 Catalog 證據，可以下載 16 KiB 後沿用快取速度；一般新量測需至少 64 KiB | 通過本輪小樣本不代表重新量到完整速度；核對是否以近期舊速度取得足速資格 | [startupCandidates](../../../src-v2/application/routing/candidate-planning.ts)、[probeStartup](../../../src-v2/application/measurement-controller.ts) |
| S10 | 沒有候選達 1.35 倍時，Native 模式先找 original 候選，再找最快有效結果；original 這項不要求本輪測試成功 | A 原主機測失敗、B 成功但僅達需求 1.2 倍、C 失敗時，仍可能選回合法 A；需以正式契約確認預期退路，再判定是否修正 | [runStartup](../../../src-v2/application/measurement-controller.ts) |
| S11 | 原始候選測試成功且速度達最快合格候選九成時，會保留原始候選 | 原始候選可能略低於 1.35 倍仍被保留；需確認此偏好與足速目標的取捨 | [runStartup](../../../src-v2/application/measurement-controller.ts) |
| S12 | 起播以檔案開頭短範圍、最多三秒判定；Catalog-only 可在第一個合格結果出現時提早收束 | 能取到開頭不保證後續串流穩定，提早放行也未必取得最快候選；需核對首段／後段速度及後續失敗，不能據此推定策略錯誤 | [runStartup／probeStartup](../../../src-v2/application/measurement-controller.ts) |
| S13 | Catalog-only 若本輪沒有有效結果，不提交新的起播選擇；原計畫若仍符合限制，後續可繼續使用 | 全部預測試沒成功時，仍可能回到先前缺乏證據的主機，而非取得新一批候選；核對失敗類型及既有計畫是否被失效 | [runStartup](../../../src-v2/application/measurement-controller.ts)、[RouteCoordinator](../../../src-v2/application/route-coordinator.ts) |

上述 original 指「啟動這輪 gate 的請求原本要送往的主機」，不保證等於 B 站最初 playurl 的主機；第一步可能已改寫輸出。

## 第三步 實際下載與換站

預測速結束或跳過後，適配器重新取得當前路線，核對設定、內容與授權再送出。Fetch／XHR 的完成觀察交回 RouteCoordinator；網站播放器也能根據已取得的備援網址自行重試。

| 結果或操作 | 現行處理 |
| --- | --- |
| 播放器請求已登記備援 | 在無固定主機、候選仍合法等條件下承接播放器的主機，建立 player-fallback 計畫；Native 與 Catalog-only 的判斷分支各自保留 |
| 成功下載 | 保存該影音種類的速度／健康證據；同一影片表示累積兩筆成功後確認表示，成功觀察再更新親和 |
| 網路／本文讀取／timeout／HTTP 5xx 等已分類失敗 | 保存該主機與影音種類的失敗，建立故障冷卻，對已知表示重新選路；新計畫不代表腳本重送同一網站請求 |
| Native 簽名路線的 403／451／959 | 撤銷該表示的 Native 主機資格並重選 |
| Catalog 403 | 標記當前媒體資源與主機不相容，設定串流 host-lock；video 另嘗試 startup fallback，不直接將所有影片的該主機一律判死 |
| 使用者／網站取消 | 不當成一般 CDN 失敗樣本 |
| 其他未被分類的 HTTP 4xx，例如 Catalog 404 | 不形成一般失敗樣本，也不走一般 recover 分支；後續可能由播放器自行重試 |

來源：[request routing](../../../src-v2/application/route-coordinator.ts)、[TransportResult 分類](../../../src-v2/application/routing/transport-result.ts)、[HTTP 失敗類別](../../../src-v2/adapters/transport-context.ts)、[Runtime 轉交](../../../src-v2/application/runtime-controller.ts)。影片備援事件可交給恢復控制器，音訊不觸發影片恢復；播放器重載的條件另在後續步驟討論。

### 第三步新增的待驗證點

| ID | 已確認機制與待驗證影響 | 定義位置 |
| --- | --- | --- |
| T01 | 腳本遇失敗可先選 C，播放器又可能請求備援 B，而腳本承接 B；可能形成兩層換站交錯。是否實際發生反覆切換，仍須重建同一表示的請求／決策順序 | [applyNormal／applyCatalogOnly／observe](../../../src-v2/application/route-coordinator.ts) |
| T02 | 傳輸失敗後 observe 中的重選需求使用 video 8 Mbps／audio 0.5 Mbps，並非原播放資料階段依碼率與倍率推算的需求；高碼率影片可能選到相對不足的路線，需對照當前實際需求與新排名 | [observe](../../../src-v2/application/route-coordinator.ts)、[PlayurlController](../../../src-v2/application/playurl-controller.ts) |
| T03 | Catalog 404 等未分類 4xx 不累積一般失敗，也不走一般 recover；可能沒有及時降低該主機資格，並增加對播放器備援的依賴。需區分資源特有失敗與整個主機故障，不能直接改成全域封鎖 | [responseFailure](../../../src-v2/adapters/transport-context.ts)、[classifyTransportResult](../../../src-v2/application/routing/transport-result.ts) |

## 後續判定需要的最小資料

每次換站需對齊同一內容／表示、video 或 audio、請求輸出角色、主機、決策原因、失敗類別、實際需求與可用樣本。先區分播放器重試、腳本重新規劃及後續恢復介入，不能僅憑畫面主機名稱改變的次數認定故障。

本輪保存與分析沒有修改產品、測試、設定、版本或 Release，沒有啟動瀏覽器或恢復已結束窗口。各疑點的處理方向須待逐步討論與驗證後再制定。

## 第四步 恢復與重載

本段於 2026-11-02 接續追加，基準仍為文首 v2.2.5／0e1375a。前述 S01–S13、T01–T03 的正文與判定保留。本段為程式碼追查，尚未將新增情境轉為失敗契約或安裝版重現。

### 備援與恢復的銜接

RouteCoordinator 選到不同合法主機時，會發出 route-fallback。Runtime 只將 video 事件轉給 Recovery；audio 備援不觸發影片恢復。Recovery.armRouteFailure 要求先前出現過健康播放器狀態，且目前不是暫停、尋位、結束或媒體錯誤，還要通過來源及操作所有權檢查；收到事件不等於立即重載。

沒有任何起播進度的冷起播另走 PlayerMonitor.observeStartup。它從首筆有 kind 的影音請求計時，至少 15 秒後仍無起播進度、緩衝不足一秒，且 readyState<=1 或寬高皆零等條件成立，才嘗試一次替代路線。找得到替代路線，才呼叫 armStartupFailure 建立冷起播恢復動作。

來源：[RuntimeController](../../../src-v2/application/runtime-controller.ts)、[PlayerMonitor](../../../src-v2/application/player-monitor.ts)、[RecoveryController](../../../src-v2/application/recovery-controller.ts)、[RouteCoordinator.requestStarted](../../../src-v2/application/route-coordinator.ts)。

### 計時起點與升級順序

| 路徑 | 備援／建立動作 | 重載條件與起點 |
| --- | --- | --- |
| 純冷起播 | 首筆影音請求至少 15 秒且滿足上述條件，嘗試一次 video 替代路線 | 成功建立恢復動作後，仍符合死核心或 startupStalled 才在該動作至少 4 秒後重載；條件持續成立時約首筆影音請求後 19 秒，受一秒 tick 誤差影響 |
| 已進入一般非尋位停滯 | 同一停滯段起點 6 秒提交合法 video 備援 | 同一停滯起點 12 秒重載，並非換備援後再等 12 秒 |
| 長尋位／可信目標未完成 | 同一停滯段起點 15 秒備援 | 同一起點 30 秒重載；由一般段升級時保留起點，不重新累計 |
| 未併入停滯段的 route-failure／watchdog 等恢復動作 | 符合各自資格後建立 token | 死核心在 token 起點至少 4 秒；其他無合格進度的情況最多等待 30 秒。首次合格進度、停滯段合併或所有權變動會影響後續分支，不能一律套用此等待值 |

純冷起播條件的「未觀察到進度」有自己的紀錄方式：真正時間／影格前進，或非尋位時緩衝曾達一秒，皆會設 startupObservedProgress。Recovery 的 hadHealthy 則可由 readyState>=2、已有尺寸或新影格成立。這兩個訊號不是同一份判定。

每次實際進入 reload 前先扣重載額度並設 90 秒冷卻；同一 Recovery.reset 之間最多兩次，冷起播另有一次性重載標記。reset 會重設這些欄位，不能把額度稱為永久整分頁上限。重載失敗、逾時或所有權撤銷不會無限重試。

### 重載後的位置與倍率還原

重載呼叫網站既有播放器 SDK reload，並保存本次播放器、媒體、核心、內容與操作修訂。後續先確認屬於本次重載的核心，再依序處理：

1. 還原保存位置，核對原生位置落地及 seeking 結束；容許約一秒誤差並沿用片尾裁切。
2. 還原保存倍率，核對原生倍率。
3. 原本正在播放時呼叫 play，再觀察連續兩個合格進度樣本，才確認 recovered。

SDK 返回或 Promise 完成不能單獨代替落地確認。SDK 已返回、原生值明確不符、非尋位且至少一秒等條件成立時，位置與倍率各保留一次原生補正；未知值或仍 pending 不直接補寫。首次合格進度前，初始化、位置、倍率與播放共用 reload 起點後的 15 秒期限，不是各階段各有 15 秒。若在期限內先出現合格進度，可在同一穩定所有者下繼續有界確認連續進度；不能把一次短暫前進當成完整還原成功。

新的使用者操作、拖曳、內容／媒體變更、真正隱藏、停用、失去授權及無法核對的核心替換會撤銷舊動作。這些是必要的所有權保障；後續調查須區分使用者操作與網站自身初始化，不以放寬所有權換取成功。

來源：[RecoveryController](../../../src-v2/application/recovery-controller.ts)、[PlayerControlObserver.reload／performRestore／readRestore](../../../src-v2/adapters/player-controls.ts)、[恢復還原契約](../../../src-v2/application/recovery-contracts.ts)。

### 第四步新增的待驗證點

| ID | 程式碼已確認的機制 | 可能影響與待驗證情境 | 定義位置 |
| --- | --- | --- | --- |
| R01 | 冷起播的 15 秒從首筆影音請求算，4 秒則從之後建立的恢復 token 算 | 不能解讀為點擊播放後四秒就救援；持續符合條件時約需 19 秒才可能重載，先到的 audio 也會影響起點。應分列首筆 audio／video、建立動作與重載時間，再判斷等待是否合適 | [requestStarted](../../../src-v2/application/route-coordinator.ts)、[observeStartup](../../../src-v2/application/player-monitor.ts)、[advanceToken](../../../src-v2/application/recovery-controller.ts) |
| R02 | observeStartup 在呼叫 recoverStartup 之前，已將 startupRescueAttempted 設為 true；只有取得 fallback 才 armStartupFailure | 若當時沒有替代路線或提交失效，這次冷起播救援仍已消耗；後續條件改善時不會由同一路徑再嘗試。需核對 fixed 模式、候選池及提交失效情境；不能直接移除一次性限制製造無限重試 | [observeStartup](../../../src-v2/application/player-monitor.ts) |
| R03 | 冷起播要求 readyState<=1 或尺寸皆零；一般停滯在尚無 startupObservedProgress、也未尋位且無 pending 目標時不建立停滯段。一般 watchdog 亦有起播進度／首筆請求條件 | 可構造的靜態疑點為 readyState=2、已有尺寸、緩衝<1 秒、時間不前進、已送影音請求但尚無明確失敗：可能同時不進入冷起播與一般停滯救援。需先查既有契約並建立最小模型，確認是否為實際可達狀態 | [sampleProgress／advanceStall／observeStartup／tick](../../../src-v2/application/player-monitor.ts) |
| R04 | recoverStartup 再呼叫 startupOptions(root)，未傳原量測游標，因此使用預設 0 與最多三個候選；preferredHosts 只在這批候選內比對 | 原先游標輪次測成功的主機若在新三個候選之外，可能不被救援選中；後續退路也未重新量測。需對照原候選、有效結果、fallback 清單與實際選擇，不把兩次候選池當成相同 | [recoverStartup／startupOptions](../../../src-v2/application/route-coordinator.ts)、[startupCandidates](../../../src-v2/application/routing/candidate-planning.ts) |
| R05 | 首次合格進度前，初始化與位置／倍率／播放共用重載後 15 秒期限；補正另有已返回且至少一秒等前提。首次進度後保留同一穩定所有者的有界連續確認 | 初始化較慢或 SDK 長時間 pending 時，可能壓縮還原／確認時間並終止。應先分列每階段耗時、原生讀回與實際失敗原因；尚不能據此要求延長期限或省略確認 | [restoreReady／restore／resumeVerified／endInvalidToken](../../../src-v2/application/recovery-controller.ts)、[readRestore](../../../src-v2/adapters/player-controls.ts) |
| R06 | reload 在取得 SDK 呼叫結果之前，已增加 reloadCount、設 90 秒冷卻，冷起播也先設 startupReloaded；SDK 缺方法、拋錯、拒絕或同步重入撤銷仍保留已扣額度 | 實際未成功重建核心時也可能進入冷卻，需區分已發動重載與準備失敗是否影響後續起播。事前扣額度本身具有防重入意義，不預設退還額度或追加重試 | [reload](../../../src-v2/application/recovery-controller.ts)、[PlayerControlObserver.reload](../../../src-v2/adapters/player-controls.ts) |

上述新增疑點均未確認為使用者此次問題的根因。原始碼追查也看到既有 C-04 冷起播、還原與所有權測試；本輪沒有執行它們，不將靜態檢閱寫成新增測試通過。恢復內的保護、取消、一次額度與可信控制要求仍保持。

## 第五步 位置倍率還原與成功確認

本節依 2026-11-02 使用者要求，接續第四步的重載流程，細查重載後的還原與結案；分析基準仍為 v2.2.5／`0e1375a`。只追加程式與既有契約的靜態檢閱，不修改執行期、測試、設定或發行原件，不啟動瀏覽器。以下「待驗證」不代表已重現，也不將既有設計條件直接判成缺陷。

### 還原的實際順序

1. **保存值與取得資格：** Recovery 在建立 token 時捕獲位置、倍率及原本是否應播放，不是在 SDK reload 返回後才讀保存值。位置可能來自可信未完成目標或當前捕獲／停滯目標；倍率經 PlayerAdapter 優先取有效 SDK getPlaybackRate，再回退播放器快照。保存前後仍核對操作、內容、媒體與核心。
2. **等本次核心可還原：** 先確認本次重載所有權、路線資格與健康核心；相符替換核心須有正確重載修訂、非零核心身分及初始化狀態不是 false。保留尺寸或 SDK 返回本身不能完成整個恢復。
3. **位置先落地：** 有限片長時將目標裁至片尾前 0.1 秒；位置政策已撤銷時跳過舊位置。正常先呼叫 SDK seek；沒有方法才走既有原生備援。原生 currentTime 到目標一秒範圍內、非 seeking 且 readyState>=1 時，Observer 記下第一次落地位置與時刻；Controller 再核對當前位置與預期前進量。
4. **倍率再確認，之後才 play：** 原生倍率必須等於保存倍率，且位置已知、非 seeking。SDK 未有效執行時，位置與倍率各有原條件下的一次原生補正；之後仍重新檢查先前位置是否相符。原本應播放才呼叫 SDK play，播放拋錯或 Promise 拒絕記為 recovered-paused，不能說已恢復連續播放。play 前後重新核對位置、倍率與所有權。
5. **確認真正進度：** 還原後另以 play 前原生位置與時刻建立基準，清掉先前連續計數。後續非暫停／尋位／結束／錯誤、同一操作與媒體／核心，時間每次前進超過 0.05 秒；有影格計數時也須增加。再核對原生倍率及位置範圍，連續兩筆合格採樣才 recovered。位置跳躍、只有畫面尺寸、SDK 快取或未知原生值不能代替進度。

一般執行沿用既有一秒 tick，兩筆採樣通常約需兩次 tick；排程與樣本資格仍會影響時間，不能宣稱固定兩秒保證成功。首次進度與 15 秒共用期限、首次進度後的有界確認、一次補正及 90 秒重載冷卻均沿用第四步，不是每階段重新取得預算。

來源：[token 保存](../../../src-v2/application/recovery-controller.ts)、[播放器讀值優先序](../../../src-v2/adapters/player.ts)、[SDK 命令與原生落地讀回](../../../src-v2/adapters/player-controls.ts)、[進度比較](../../../src-v2/domain/playback-progress.ts)。

### Pending 與失敗的必要區分

R05 的 pending 疑點在此補充精確邊界：SDK Promise 仍 pending **只阻擋強制原生補正，不一定阻擋向下一階段前進**。實際原生位置已落地且倍率等事實相符時，即使 Promise 尚未結束也能繼續；既有 SR2-U-R02 明確斷言此行為。真正需要追查的是「仍 pending 且原生結果持續不符」是否耗盡原 15 秒，而不是把所有非同步命令都當成卡住。

位置讀回未知與已知錯位也不同：未知值不授予推測寫入；補正只能在既有所有權、非 pending／seeking、readyState>=1、命令至少一秒及尚有一次額度等條件成立時進行。這些保護不因本次調查而放寬。recovered-paused 是獨立終態，不能與有連續進度的 recovered 混為一談。

### 第五步新增的待驗證點

| ID | 程式碼已確認的機制 | 可能影響與最小驗證方向 | 定義位置 |
| --- | --- | --- | --- |
| R07 | SDK seek 拋錯會向外傳遞，由還原階段結束為 restore-threw；SDK setPlaybackRate 拋錯則可在重新核對所有權後使用既有原生備援 | 同樣是 SDK 方法故障，位置與倍率的退路不同。需分開測試「未改任何狀態就拋錯」與「改媒體／操作後拋錯」，確認是否有可安全保留的恢復機會；目前屬錯誤政策差異，不能據此直接加原生 seek 重試或吞掉原始例外 | [seekCommand／rateCommand](../../../src-v2/adapters/player-controls.ts)、[restore catch](../../../src-v2/application/recovery-controller.ts) |
| R08 | 位置落地時間只記第一次；positionMatches 以當前原生倍率回推整段落地後時間。倍率階段完成時又用同一公式檢查先前位置 | 若網站已在還原期間播放，落地後先按舊倍率前進，再於延遲補正時換成保存倍率，舊時間也會被套上新倍率，可能把正確位置判為不符而留在 rate 階段。優先以同一穩定所有者建立「播放中延遲換倍率」模型；現有閉環情境在 reload 後先暫停，不能直接證明已覆蓋此分支 | [positionMatches／restore](../../../src-v2/application/recovery-controller.ts)、[noteRestoreLanding](../../../src-v2/adapters/player-controls.ts)、[restore-closed-loop fixture](../../../tests-v2/regressions/functional-races/restore-closed-loop.ts) |
| R09 | 建立恢復 token 時保存倍率優先讀有效 SDK getPlaybackRate；還原成功與後續進度則要求原生倍率等於該保存值 | 若 token 建立前 SDK 已有舊倍率快取、但原生倍率不同，可能保存並還原舊值。需查明網站此狀態是否可達，再用真實 PlayerAdapter／Observer 與 Recovery 對照捕獲值、還原值與使用者操作修訂。現有 SR2-I11／I12 保護的是 play 後的原生讀回，不能直接證明建立 token 前的來源一致 | [PlayerAdapter.playbackRate](../../../src-v2/adapters/player.ts)、[begin／resumeVerified／matchesRestoreProgress](../../../src-v2/application/recovery-controller.ts)、[既有閉環案例](../../../tests-v2/regressions/functional-races/restore-closed-loop.ts) |
| R10 | recovered 要求兩筆連續合格進度，但不另要求緩衝水位或目前 CDN 連續供片；位置範圍有下界與按保存倍率推算的上界，沒有要求每秒完整前進保存倍率的秒數 | 短暫播放後又停住仍可能先結束本次恢復，後續再由 Monitor 判斷新停滯。這首先是成功語意與產品政策的待討論點，不是已確認錯判；需以「兩筆合格進度後再次耗盡緩衝」及「少量慢速前進」檢查交接，不預設增加緩衝門檻。既有 90 秒冷卻與重載總額仍有效，不能推論會立即連續重載 | [recordProgress／acceptHealthy／matchesRestoreProgress／begin](../../../src-v2/application/recovery-controller.ts)、[既有零緩衝恢復模型](../../../tests-v2/regressions/functional-races/rescue-recovery.ts) |

R08 的靜態數值反例：假設同一合法所有者、原生讀回已知且始終非 seeking，位置於相對時間 0 落在 120 秒，媒體未暫停並以 1 倍播放；保存倍率是 2，但 SDK 倍率命令未生效。兩秒後真實位置為 122，原生補正把倍率改成 2；positionMatches 此時卻算出 `120 + 2 × 2 = 124`，超過一秒容差。若之後持續 2 倍，這個兩秒差仍會保留；程式可能持續等到原期限。此例只由公式推導，尚未以 Node 契約或安裝版重現；前提包含網站會在此階段自行播放、SDK 命令已返回及所有權未失效，不能略去前提宣稱實際缺陷。

### 現有契約與本輪證據邊界

本輪閱讀了 [SR2-U-R01–R07](../../../tests-v2/regressions/recovery-restore-controller.ts) 的一秒補正、pending 但已落地、無效補正、一次額度、同步重入、真正零與片尾裁切案例；也閱讀 [SR2-U 原生讀回](../../../tests-v2/regressions/player-restore-readback.ts)、[SR2-I 還原閉環](../../../tests-v2/regressions/functional-races/restore-closed-loop.ts) 及 [U-P02](../../../tests-v2/regressions/functional-races/rescue-recovery.ts) 的相關前置與斷言。這些是既有覆蓋的靜態證據，不是本輪新執行結果。SR2-I01 另有十五秒持續播放驗證，不應把產品的兩筆成功門檻誤寫為既有測試完全不查持續播放。

建議下一輪先驗證 R08 的時間／倍率反例，再確認 R09 的保存來源是否可實際不一致；R07 與 R10 先討論預期政策。R05 的 pending 分支與上述條件一起核對。此排序只是調查建議，未啟動修復或新增測試。

此階段本身不反覆重新排名或逐一試 CDN；選路改變、播放器自行使用備援與 SDK reload 重新發出請求仍須接回第三、四步辨識。即使確認本節某個還原問題，也不能單憑它解釋所有起播換站。保存的 R07–R10 均尚未確認為使用者此次現象的根因，不恢復診斷或要求完整 Network 才能判定獨立產品行為。

## 第六步 恢復後的沿用學習與再次介入

本節依 2026-11-02 使用者要求接續追加，基準仍為 v2.2.5／`0e1375a`。追查第五步之後的計畫沿用、傳輸學習、健康探索、提前重試及再次停滯的交接。只分析現行程式與相關既有案例；沒有修改產品／測試／設定、開啟瀏覽器或啟動修復。

### 正常播放後如何接手

1. **恢復結案保留原額度：** Recovery.finish 清除當次 token、播放意圖訂閱及暫停計時，保存最後狀態。它不清除 RouteCoordinator 計畫，也不重開起播 gate；已用 reloadCount、startupReloaded 與 breakerUntil 保留至各自既有 reset 邊界。recovered 不等於全部控制器重新啟動。
2. **後續請求沿用合法計畫：** RouteCoordinator.plan 在一般邊界可直接返回原決策；已分類失敗、watchdog 或設定重選才有另外的重新決策邊界。恢復結案本身不依新速度重排所有 CDN，也不由腳本補送原網站請求。播放器仍可依既有備援網址重試。
3. **實際下載繼續學習：** 傳輸完成先核對世代、內容、授權及政策，合法證據保存後才執行控制確認。video 的表示確認、親和與 Native 解鎖各依原條件更新；audio 不建立 video 親和。這與第三步同一路徑，並非新一輪測速。v2.2.5 的畫面容量會讀取目前計畫主機的有效影片證據，不要求改變決策才能顯示新速度。
4. **既有 tick 依序交接：** Monitor 先採樣原生播放進度，再處理停滯／Recovery、watchdog 與冷起播，之後呼叫健康量測與提前重試，最後發布畫面快照。同一次 tick 不會先量測、再補判該次停滯。stableProgressSec 實作為連續合格進度 tick 的計數，單次不合格即歸零；預設一秒排程下才近似經過秒數，不能把欄位名稱當成獨立牆鐘。
5. **再度停住則回到停滯判斷：** Monitor 一筆合格進度即可結束目前 stall，與 Recovery 的連續兩筆 recovered 不同。之後沒有進度可建立新 stall；一般 6 秒備援／12 秒重載、長尋位 15／30 秒仍按第四步處理。重載冷卻、總額、失敗停滯抑制及所有權不因換一個 stall ID 自動解除。

來源：[Recovery.finish／reset](../../../src-v2/application/recovery-controller.ts)、[plan／observe／confirmObservedTransport](../../../src-v2/application/route-coordinator.ts)、[Monitor.tick／sampleProgress／advanceStall／observeStall](../../../src-v2/application/player-monitor.ts)、[原生播放快照](../../../src-v2/adapters/player-media.ts)。

### 健康探索與提前重試的適用範圍

| 項目 | 現行條件與動作 | 對起播調查的意義 |
| --- | --- | --- |
| 健康探索進入 | 有已確認表示／需求、可見、非停用／尋位／恢復，連續進度至少 20 個合格 tick、按倍率折算緩衝至少 30 秒 | 長期無法建立進度或緩衝的播放，不會靠這條路持續補測新節點；這是避免主動探測搶佔播放資源的既有政策 |
| 健康候選及額度 | 受共用 10 分鐘冷卻約束；同表示／主機嘗試不足 6 小時或該影音主機證據更新不足 6 小時會跳過；不選當時 Session 親和主機。固定或串流 host-lock 可使候選不存在 | 「沒有正在測速」不代表功能壞掉；候選新鮮度、已嘗試及共用冷卻是不同限制，不能只看畫面最後主機推定 |
| 健康輪次執行 | 每輪最多依序三個，每個原期限 3 秒；一般最多讀 384 KiB、高需求 768 KiB，至少 64 KiB 的合格直接 Range 回應才形成速度證據。狀態變得不安全會取消 | 已選候選與輪次冷卻在探測結果出來前登記；開始後失敗／取消不等於未消耗。等待鎖期間資格失效則有另外的拒絕契約，不能混為一談 |
| 健康結果 | 成功保存證據，不提交播放計畫或親和；一般探測失敗不建立播放斷路。Native-invalid 可撤銷該 Native 候選資格 | 量到較快節點不會立即把目前流暢路線切過去；合法選路邊界日後才使用證據。不能將 UI／事件中的 challenge 候選視為實際影音回應主機 |
| 提前重試模式與時機 | 只在 Catalog-only、無固定主機、非恢復／stall、播放狀態合格且連續進度至少 10 個 tick 時評估；要求 0<可播放緩衝<6 秒等原條件 | Native 預設開啟時，即使提前重試開關是 true，仍被 route-mode 排除；完全卡住、冷起播或正在恢復也不保證能使用。這是目前明確契約，不因本次討論自行變更 |
| 提前重試替代證據 | 替代主機須有同內容／表示／授權／政策下、60 秒內兩個不同請求 ID 的合格 video 傳輸，並達 1.35 倍需求；起播／健康探測只寫 EvidenceStore，不加入這份功能資格帳本 | 某主機在健康探索測得很快，仍可能無法用作提前重試替代。該功能沿用窄傳輸證明，不藉調查新增探測或放寬資格 |

提前重試取得兩秒一次性許可後，仍由網站相符重試認領並經原生 send 接受，RouteCoordinator 才提交計畫與親和；不是控制器自行下載新媒體。每請求一次、同主機八秒、三十秒最多三次與低緩衝段一次等限制繼續保留，交接失敗可使本文件生命週期的提前重試保持 suspended，reset 不重開已用低緩衝額度或解除該 breaker。

來源：[健康量測 tick／tryStart／runRound／unsafeReason](../../../src-v2/application/measurement-controller.ts)、[challenge／recordChallenge／earlyRetryAlternative／acceptEarlyRetry](../../../src-v2/application/route-coordinator.ts)、[提前重試控制器](../../../src-v2/application/early-retry-controller.ts)、[提前重試純判定](../../../src-v2/domain/early-retry.ts)、[現行量測與恢復契約](../../../docs/ARCHITECTURE.md#量測與恢復)。

### 第六步新增的待驗證點

| ID | 程式碼已確認的機制 | 可能影響與最小驗證方向 | 性質與定義位置 |
| --- | --- | --- | --- |
| H01 | observe 的控制檢查核對 generation／epoch／授權與政策修訂，但 confirmObservedTransport 不另外要求成功完成的 decisionId 仍是目前計畫；同表示的合法成功可更新 Session 親和 | A 較早送出的傳輸在 B 已成為目前路線之後才成功，可能使親和變回 A，而計畫仍為 B。需以同一內容／同一政策、兩個合法決策與可控制的完成／儲存順序確認；再核對表示切換時對親和的沿用。現有跨政策／換片失效案例不能直接證明同政策亂序也被隔離 | 優先驗證的控制交接疑點；[observe／confirmObservedTransport／choose](../../../src-v2/application/route-coordinator.ts)、[chooseRoute](../../../src-v2/domain/routing.ts) |
| H02 | Monitor 一筆合格進度就 endStall(true)，不取消仍在確認中的 Recovery token；再次無進度可以建立新 stall。新 stall 到門檻會 armStall 並視條件再次 recover，舊 stall token 可被 superseded-by-stall 結束 | 若每次備援後只有一小段進度，足以清 Monitor 停滯卻不足以持續播放，可能不斷建立新 6 秒段與新備援；這比 R10 的「兩筆成功後再停」更早。需用「6 秒備援、單筆時間／影格前進、再停 6 秒」的連續模型核對請求、決策、token 與重載次數，不預設每次小進度都應被忽略 | 優先驗證的停滯段交接疑點；[advanceStall／endStall／observeStall](../../../src-v2/application/player-monitor.ts)、[armStall](../../../src-v2/application/recovery-controller.ts) |
| H03 | 健康探索要求連續進度與高緩衝，又受 10 分鐘共用冷卻及 6 小時候選限制；選定候選、開始輪次後的失敗／取消保留已登記限制 | 已預測速但仍間歇卡住時，健康探索未必能快速補足替代證據。需區分等待鎖前後、實際是否開始、取消原因與候選排除原因，確認是否有「早已恢復資格卻長期沒有候選」的實際情境；不能直接移除資源保護或重試冷卻 | 既有政策的適用限制，待先討論預期；[tryStart／unsafeReason](../../../src-v2/application/measurement-controller.ts)、[challenge](../../../src-v2/application/route-coordinator.ts) |
| H04 | 提前重試要求 Catalog-only、無固定路線、已有至少 10 個連續進度 tick，且 Monitor 傳入 recovering 時也包含目前存在 stall | 預設 Native 或已卡住的場景不能期待此功能接手每一輪慢請求。需按 Native／Catalog、仍在播放／完全停滯分列案例，核對排除是否符合產品預期；開關預設 true 不能被解讀為所有模式都會執行 | 明確保留的模式／階段契約；[Monitor.tick](../../../src-v2/application/player-monitor.ts)、[EarlyRetry.unsafe／tick](../../../src-v2/application/early-retry-controller.ts) |
| H05 | 提前重試的成功帳本由符合條件的實際影片傳輸填入，起播／健康探測不填入；替代主機還須在同內容等資格下有兩筆近期傳輸 | 即使測速找到快主機，若未有兩筆相符實際傳輸，仍可能 no-alternative。需對照「有探測證據但無傳輸」與「已有兩筆合法傳輸」的資格結果，確認這層有意保守的證明邊界是否符合期望；不能拿一般速度樣本直接替代原許可 | 明確保留的證據邊界；[observe／earlyRetryAlternative](../../../src-v2/application/route-coordinator.ts)、[evaluateEarlyRetry](../../../src-v2/domain/early-retry.ts) |

H01 不能直接解讀為舊 A 一完成就把所有請求切回 A：目前計畫可繼續重用 B，固定／禁止規則仍有優先性；若 A 已有未到期的播放斷路，成功樣本也不立即清掉 circuitUntil。需要驗證的是同政策內的親和／計畫不一致及後續合法決策邊界，而不是宣稱已繞過限制。來源：[plan／choose](../../../src-v2/application/route-coordinator.ts)、[addEvidenceSample](../../../src-v2/domain/evidence.ts)。

H02 也不代表核心可以無限重載。新的 stall 不能消除既有 90 秒 breaker、重載總額與 failedStall 抑制；未曾重載時的一小段進度是否可反覆刷新備援段，與已重載後被冷卻攔住是不同情境。這些屬靜態可構造路徑，尚未執行最小模型或安裝版重現。

### 覆蓋對照與調查優先順序

本輪閱讀相關現有案例：

- [routing convergence](../../../tests-v2/regressions/functional-races/routing-convergence.ts) 已保護「證據先保存再確認」、儲存期間政策失效不提交控制、影音隔離。
- [A03 固定 CDN 與晚到傳輸](../../../tests-v2/regressions/functional-races/routing.ts) 核對設定／政策修訂後的舊完成不得覆寫親和；此條件與 H01 的同政策亂序不同。
- [rescue timing](../../../tests-v2/regressions/functional-races/rescue-timing.ts) 已保護短暫停止進度後恢復不誤備援、一般 6／12／15 時限及傳輸備援合併。H02 需要額外核對跨多個新段的單筆進度交接，不能只看一段時限。
- [UP141-TEST 自動探索](../../../tests-v2/regressions/up141-test-release.ts) 已有共用冷卻、三候選、健康探索不變親和、不安全狀態及失敗冷卻；[量測 metadata](../../../tests-v2/regressions/functional-races/measurement-metadata.ts) 有精確十分鐘與鎖等待契約。
- [UP141-RETRY policy](../../../tests-v2/regressions/up141-retry-policy.ts) 已保護模式排除、連續進度門檻、一次嘗試、十個健康 tick、交接失敗跨 reset 保持 suspended；[重試傳輸](../../../tests-v2/regressions/up141-retry-transport.ts) 保護原生接受後才提交許可與親和。本輪只追查與本階段相連的相關定義／斷言，未宣稱逐份完整重讀或重新執行。

後續調查建議先對 H02 建立多段停滯的行為對照，再核對 H01 的同政策完成順序；第五步 R08 仍為位置／倍率還原的優先反例。H03–H05 先與使用者討論產品政策及適用範圍，不直接列為必須刪除的限制。全部 H01–H05 均尚未確認為使用者此次多輪 CDN 的根因；本次只保存分析，未新增診斷、輪詢、探測或 Network 完整性門檻。

## 第七步 換片與切畫質的失效邊界

本節於 2026-11-02 依使用者要求追加，基準仍為 v2.2.5／`0e1375a`。調查同一腳本執行個體中的導覽、可信內容判定、表示切換與舊工作提交；只閱讀程式及相關既有案例並保存分析，沒有修改產品／測試、啟動瀏覽器或建立新的通過結論。

### 三種身分與兩個重設入口

- **世代 generation：** BrowserNavigation 的導覽鍵真正改變時，由 Lifecycle 建立新世代，epoch 回到 0。它能在新 API 返回前清除舊片狀態；分 P 改變也在此範圍。
- **內容週期 epoch：** 網址未改變也可以由可信 playurl 判定新內容。同一世代內有效 cid 不同便增加 epoch；不能只靠網址判斷換片。
- **影片表示 representation 與授權身分：** 同片的畫質／編碼各自登記於 Vault。新增表示或表示來源更新，不必然改變 generation／epoch；個別來源被提升或替換時，仍可另行撤銷 handle／旋轉 authorityRevision。整片身分相同不等於每一筆原生來源永遠有效。

兩條重設入口都會完整重設 Runtime，組合關係必須追到 entry.ts：Lifecycle 的依賴名稱雖為 monitor，正式入口實際傳入 runtime。因此其 beginGeneration 呼叫的是 Runtime.reset，再依序重設 Monitor、Measurement、Recovery 與 Player；不是只呼叫 PlayerMonitor.reset。可信 API 內容改變則依 Session.beginEpoch → Vault.reset → Routes.resetEpoch → 同步通知 Runtime → 登記新表示的順序執行。

本輪曾因 Lifecycle 的依賴名稱而懷疑兩條入口重設範圍不同，追到正式組合後已排除，**不列為缺陷或待釐清**。不能只憑窄介面名稱推論正式執行物件。來源：[entry 組合](../../../src-v2/entry.ts)、[Lifecycle](../../../src-v2/application/lifecycle-controller.ts)、[Runtime.reset](../../../src-v2/application/runtime-controller.ts)、[PlayurlController.ingest](../../../src-v2/application/playurl-controller.ts)、[Session](../../../src-v2/state/session-store.ts)。

### 保留與失效對照

| 情境 | 世代／內容週期 | 路線、確認資料與工作 |
| --- | --- | --- |
| 同片追蹤參數、等價網址 | 均保持 | 支援路徑只忽略 vd_source／spm_id_from、尾斜線與一般影片缺省／單一 p=1 差異，參數名稱穩定排序；不清計畫、表示與影音摘要，也不重新回填過期頁面資料 |
| 影片路徑、分 P、OGV 集數或其他非等價導覽鍵改變 | 新 generation，epoch=0 | 清 Session 表示／親和、Vault 精確來源及 Routes 計畫／影音摘要／請求，完整 Runtime.reset；舊世代完成不得回填新畫面或執行控制 |
| 導覽鍵未變，可信 API 的有效 cid 改變 | generation 保持，epoch 增加 | 同步撤銷舊內容身分與未完成工作，再登記新內容；舊媒體完成因 epoch 等核對失效 |
| 兩側有效 cid 相同，切畫質／編碼或清單排列變化 | 均保持 | 不清整片 Runtime；可新增不同表示，個別 Vault 授權更新仍按來源規則處理。API 列出新畫質不直接確認正在播放該畫質 |
| 任一側缺 cid | 使用合法 primary 父目錄集合備援 | 有影片就比影片；集合交集可沿用並合併，非空無交集或影片／純音訊型態改變則保守增加 epoch。音訊重疊不能遮掩不同影片；未知且無有效目錄不更新基準 |
| 同片但 history 改了未知／內容參數 | 導覽鍵仍可能建立新 generation | 後續 API 即使有相同 cid，也不能撤銷先前已發生的導覽重設；這是兩層不同判定，不代表所有同 cid 的網址變動均被忽略 |

真正內容重設不清除持久的主機／影音學習資料；EvidenceStore 依原 24 小時 TTL 與限制沿用。Recovery.reset 會清除舊 token、該控制器的重載計數與 breaker 等狀態；Measurement.reset 則不清 startupUsed，因此同一腳本執行個體內的站內換片不重開每分頁起播測速 gate。Monitor 的冷起播救援觀察會重設，不能把它與測速 gate 當成同一預算。整頁重新載入後的新腳本執行個體另當別論。

來源：[navigationKey](../../../src-v2/adapters/navigation.ts)、[內容純判定](../../../src-v2/domain/playurl-content.ts)、[Vault.register／reset](../../../src-v2/state/signed-route-vault.ts)、[Routes.resetEpoch／observe](../../../src-v2/application/route-coordinator.ts)、[Measurement.reset](../../../src-v2/application/measurement-controller.ts)、[Recovery.reset](../../../src-v2/application/recovery-controller.ts)、[Monitor.reset](../../../src-v2/application/player-monitor.ts)。

### 切畫質時何時確認新表示

Playurl 依分支、表示 id、codec 與高度等欄位產生表示鍵並登記 Vault；畫質／編碼不同通常形成不同表示，而不是一律當作新影片。頁面／播放器提示不自行改變內容基準，也不能覆寫已可信提升的來源。

RouteCoordinator 以成功影片傳輸確認表示：目前仍是 A 時，第一筆合法 B 成功只設暫定表示，第二筆同一 B 的合格成功才將 Session.representation 改為 B，並可確認 B 的親和。若中間收到目前 A 的影片成功或其他表示，暫定計數會依既有分支重設；audio 不確認 video。這個兩筆門檻不能只因 API 宣告新畫質而省略，過渡期間保存的已確認表示仍可能是 A。

同片切換通常不撤銷 A 的整個 Vault 群組，因播放器可以合法自適應切回。此保留與「舊 A 的在途傳輸是否還應改變目前確認結果」是兩個問題，也是下列 L02 的重點。v2.2.5 的容量投影與需求畫面使用已確認表示；不應將過渡期間或表示確認順序的問題誤判為倍率公式本身出錯。

來源：[PlayurlAdapter.normalize](../../../src-v2/adapters/playurl.ts)、[Vault.register](../../../src-v2/state/signed-route-vault.ts)、[confirmObservedTransport／snapshot／capacity](../../../src-v2/application/route-coordinator.ts)、[控制中心表示更新契約](../../../tests-v2/suites/control-center.ts)。

### 第七步新增的待驗證點

| ID | 程式碼已確認的機制 | 可能影響與最小驗證方向 | 性質與定義位置 |
| --- | --- | --- | --- |
| L01 | Fetch／XHR 的 playurl 接納檢查請求 generation；內容控制器依到達時的有效 cid／目錄判定，沒有另外的同世代 API 請求先後順序政策 | 在 generation 未變、B 的不同 cid 已被接納之後，尚未去重的舊 A 回應晚到，仍可能被視為另一個新內容，讓 epoch 再變。應建立兩個不同請求／回應、B 先到 A 後到的最小模型，檢查最終內容與取消順序；先確認實際網站是否在無新世代的情況下形成此順序 | 優先驗證的內容回應順序疑點；[Fetch](../../../src-v2/adapters/fetch-hook.ts)、[XHR](../../../src-v2/adapters/xhr-hook.ts)、[ingest](../../../src-v2/application/playurl-controller.ts)、[observePlayurlContent](../../../src-v2/domain/playurl-content.ts) |
| L02 | 同片不同畫質通常仍有合法 Vault 身分；傳輸控制檢查 generation／epoch／authority／policy，但 confirmObservedTransport 沒有另比對最新影片請求或畫質選擇修訂 | B 已由兩筆成功確認後，兩個更早送出的 A 請求才依序完成，可能重新把確認表示與親和切成 A，即使最新送出的影片請求仍為 B。需同時保存兩表示決策、請求起點／完成順序、Session 表示、最新請求及容量／需求結果；並與真正新送出的自適應切回 A 對照，不能禁止所有合法回切 | 優先驗證的表示交接疑點；[observe／confirmObservedTransport／capacity](../../../src-v2/application/route-coordinator.ts)、[Vault.register](../../../src-v2/state/signed-route-vault.ts) |
| L03 | cid 只能來自已辨識 API 所屬請求；任一側缺失時，目錄無交集便保守重設，即使使用者只切同片畫質 | 若實際請求缺少有效 cid，且新畫質／編碼的父目錄未被既有集合收錄，可能清除路線、畫面摘要與恢復狀態。需先確認當次 cid 是否有效及目錄是否真的無交集，再判斷是否只是必要保守行為；目前已有 cid 缺失與目錄集合契約，不因同片外觀直接放寬隔離 | 既有內容備援政策的適用限制；[playurlRequestContext／observePlayurlContent](../../../src-v2/domain/playurl-content.ts)、[現有內容契約](../../../tests-v2/regressions/functional-races/content.ts) |
| L04 | 導覽鍵只排除兩個明確追蹤參數等已列差異，其他參數仍影響 generation；同 cid 的沿用規則只在後續 API 內容判定生效 | 若網站或其他程式在切畫質時真的以 history 改變另個參數，即使 cid 不變也會先清資料。可用同片新增／修改未豁免參數的純導覽案例核對，但尚未觀察到網站因此修改何種參數；不能據此猜測實際畫質參數或擴充忽略清單 | 明確保留的導覽保守邊界；[navigationKey](../../../src-v2/adapters/navigation.ts)、[checkNavigation／beginGeneration](../../../src-v2/application/lifecycle-controller.ts) |

L01 與一般舊媒體完成不同：媒體觀察有 epoch 檢查，API 本身則可能是觸發新 epoch 的來源；不能簡單要求所有 API 返回時的 epoch 必須等於送出時，否則也可能擋住本來應接納的新內容。generation 已變時的舊 API 另有拒絕保護，不能將 L01 推廣為所有換片均會失效。

L02 與 H01 也不同：H01 是同表示不同決策／主機的親和更新，L02 是不同表示的確認回退。真正換片／分 P 已建立新 generation 或 epoch、來源授權已旋轉、政策失效的舊工作仍會被既有保護拒絕；需要確認的是所有上述身分仍有效時的回應順序。L02 尚未以執行測試重現，不將靜態推導寫成已發現的使用者根因。

### 現有覆蓋與下一步判定

本輪閱讀相關來源、組合關係及以下既有案例的前置與斷言，未重新執行產品測試：

- [V224 導覽整合](../../../tests-v2/regressions/functional-races/navigation.ts) 保護等價網址、超過頁面資料期限後仍保持決策、真正分 P 清空資料、舊完成不得回填及新影音分別重建。
- [BR-03 內容](../../../tests-v2/regressions/functional-races/content.ts) 保護相同 cid 的畫質／codec 變化、不同 cid 即使共用路徑也失效、缺 cid 的集合沿用／重設、提示不改基準、新世代清基準、恢復與延遲起播量測在新 cid 後失效。
- [R01 Runtime](../../../tests-v2/regressions/functional-races/runtime.ts) 保護同步通知先於新登記、畫質保持 epoch，以及 generation／epoch 改變後不得還原上一片位置、倍率或播放。
- [V225 表示與需求](../../../tests-v2/suites/control-center.ts) 保護第一筆新表示成功仍維持舊表示、第二筆才改用新碼率。該案例沒有在 B 確認後再放行舊 A 的兩個在途完成，不能單憑此案宣稱 L02 已覆蓋。

既有案例已清楚保護真正內容切換，不把本輪順序疑點概括成「所有換片隔離都壞了」。後續建議先以可控制完成順序的契約驗證 L02，再驗證 L01 的無新世代 API 逆序；L03、L04 先核對網站實際前提，視為保守政策的取捨。前面 R08、H01、H02 的調查排序與原判定保留。所有新項均未確認為此次起播多輪換 CDN 的根因；本輪沒有新增診斷收集、探測、瀏覽器窗口或完整 Network 門檻。

## 判定收斂與離線反例

2026-11-02 使用者要求以更嚴謹方式排除泛稱的「可能」。本段在前七步的靜態檢閱之後追加實際離線驗證，不回寫先前「未執行」的歷史限制。基準仍為 v2.2.5／`0e1375a224eee0afa409e0a6fea50837968c9aac`；產品、正式測試、工具、版本及 Release 與 HEAD 的差異為空。本次只新增本機一次性重現程序與文件結果，未實作產品修復。

### 判定方式的修正

每項應分開寫四件事，避免以同一個「可能」混合不同未知：

1. **精確前提：** 模式、身分／授權、資料、請求順序及是否有同步失效。未列明前提的因果句不能作為確定結論。
2. **條件成立後的輸出：** 可以由完整分支推導或受控案例驗證的結果，明確寫「會」，並提供反向對照；不能只搜尋到一段程式就省略其他 guard。
3. **產品判定：** 已證實的行為仍可能是既有政策；需對照期望與不變量，不能把所有限制都叫缺陷，也不能用斷言現況成功代替修復通過。
4. **現場關聯：** 上述結果已確定後，剩下的未知是使用者現場是否滿足前提；不以未掌握現場資料為由，繼續把已重現的輸出稱為「可能」。

若進一步修改程式，應把選定的不變量轉為正式回歸契約，例如成功候選與本輪未成功候選的優先序、同一需求來源的一致性、舊傳輸是否仍可提交控制。H01／L02 不能簡化成拒絕所有非最新請求，因為合法並行傳輸與真正自適應回切仍須保留。R06 的事前扣額度、Native 精確授權及取消所有權也不能為消除表面不確定而放寬。

### 四項已取得確定結果

| ID | 本次受控前提 | 實際觀察與斷言結果 | 收斂後的判定 |
| --- | --- | --- | --- |
| S10 | Native 模式、候選／政策仍有效；需求 10 Mbps，原始候選 A 與另一候選回傳 timeout 結果，B 的合格直接 Range 回應折算安全速度 12 Mbps，未達 1.35 倍需求 | 真實 MeasurementController 選中 A，且真實 RouteCoordinator 的後續決策主機也是 A。A 的本輪結果 valid=false；將 B 安全速度改為 20 Mbps 的對照則確實選 B | **已離線重現選擇行為。**在這組前提下「會選中本輪逾時但仍合法的 A」，不再寫成可能；是否要改變此退路屬產品政策判定 |
| T02 | 真實 Vault 登記 4 Mbps 影片，Routes 的控制倍率為 2，合法影片傳輸發生已分類 network 失敗 | 依既有碼率／倍率公式得到需求 10 Mbps；包住真實 recover 呼叫並繼續執行原方法，確實收到 requiredMbps=8 | **已離線重現需求來源不一致。**固定 8 與公式 10 的差異已確定；有無因此選錯最終主機仍取決於當次候選／證據 |
| R04 | Native 模式、同一有效表示；以游標 5 取得另一批合法候選，挑出不在游標 0 三候選內的偏好主機，為其保存成功 video 證據，再傳入 recoverStartup | 真實 recoverStartup 返回非空決策，主機屬於重新建立的游標 0 候選，且不等於傳入的合法偏好主機 | **已離線重現候選集合排除。**偏好主機在重建集合之外時不會被選；本案證明函式行為，沒有冒稱已重演使用者當輪的完整測速網路 |
| L02 | 同一 generation／epoch／政策，A、B 表示的授權仍有效；先確認 A，留下兩個 A 在途請求，再送出並完成 B 的兩個請求，確認 B，最後完成那兩個舊 A | Session.representation 確實回到 A；latestRequested('video').representation 仍是 B；currentCapacity.representation 也回到 A。在完成舊 A 前改接納新 cid 的對照，舊 A 身分失效，完成後 Session 仍未確認且影音摘要不回填 | **已離線重現表示確認回退，並排除「真正新內容同樣未隔離」的泛化。**物理播放器此時是否仍顯示 B 未實測；可確定的是確認資料與最新影片請求不一致 |

程序包含 S10 兩案、L02 兩案、T02 一案及 R04 一案，共六個現況特徵驗證。結果六案均成功重現各自斷言，fail／cancelled／skipped／todo 均為 0。這不是六個產品修復 PASS；正式套件與案例總數未變，也未跑完整 verify 或安裝版驗收。

本輪沒有把 R08 的數值推導或 R09 的 SDK／原生倍率來源直接升格為實際重現；前者尚需真實 Observer 與還原階段的受控模型，後者需區分合法來源選擇與可重現快取不一致。上一則「可直接進實作」應理解為不必等待現場追因，但仍須先建立離線回歸，不能理解為五項都已證明是缺陷。

### 重現程序與證據範圍

使用鎖定 Node 26.8.1 及本機 esbuild 0.28.2。程序在 `.work/startup-review-2026-11-02/rigor-check.test.ts`，匯入現行 MeasurementController／RouteCoordinator／PlayurlController／Vault、既有 fixture、testScope(t)、FakeClock 及 FakeStorage。網路探測只使用固定輸入替身；沒有 HTTP 服務、瀏覽器、外部請求或產品插樁，也沒有新增診斷錄製器。案例的傳輸皆為合成資料。

先以 esbuild 將此程序及實際匯入來源 bundle 為本機 ESM，再以鎖定 Node 的 `--test --test-reporter=tap --test-timeout=10000` 執行。初次直接啟動時使用了該 Node 不支援的 `--experimental-transform-types`，退出碼 9，未執行任何案例；錯誤原文另存，不算產品失敗。改走專案既有的先 bundle 再執行方式後，退出碼 0，六案完成。未下載或更換工具版本。

以下為本機程序與輸出的原始 SHA-256；不作公開 Release 產物，也不將私有檔案作為現行指南的必要閱讀連結：

| 本機檔案（上述工作目錄內） | SHA-256 |
| --- | --- |
| rigor-check.test.ts | 03e0c85c94379af9f4fd0cc8aa4244a955ac9674b7ab8bc2234a77bd073c6772 |
| rigor-check.bundle.mjs | 00ca2e51edf3c3ae585cdf2bb76cf8f6dd832da4d121b52f3963a5e45086a4e8 |
| rigor-check.results.tap | 5fcdbc3eb61bb67eb9ab8472bfc93eeaa95eded47bafddc770c8b760e72951b2 |
| rigor-check.direct-node.log | 95854b66648850e9c7f2de6a611180c013ea0a13795c954258afcf90fef391ff |

本段提供受控前提、正反向結果及程序指紋，用以取代四項條件式輸出的含糊敘述。使用者現場根因仍未確認，其餘調查條目尚未因這六案而全部獲得證實或排除。前七步原文保留；後續判定以本段新增證據銜接，不恢復已停止窗口，也不要求完整 Network 作為獨立產品案例的門檻。


## v2.2.6 實作結論導引（2026-11-02）

上述原始觀察、可能性判讀與六案現況驗證均保留。35 項已依使用者批准政策整合為確定規則及正式回歸，結果見 [v2.2.6 完整報告](../../../docs/TEST_REPORT.md#三十五項閉環對照)；不回寫本文件當時判定，也不將離線結果當作使用者現場根因或安裝版通過。
