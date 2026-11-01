# BiliCDN_TW v2.2.5 安全吞吐、需求餘裕與樣本時效修復驗證

日期：2026-11-01（Asia/Taipei）。起點為乾淨 `main／32dbf26b2852cd6a918059c0e2b0068c79b31e4a`、v2.2.4。容量投影與路線回歸提交 `258d9a2`；倍率／UI 與補充契約提交 `d02c75f`。本版採離線驗證後發布，安裝版結果另行記錄。

## 修復結果與證據邊界

四組離線反例為冷啟動排名固定缺值、播放器備援排名空白、舊排名的需求比例不隨倍率改變，以及過期速度仍從排名顯示。修復後安全吞吐由目前有效影片計畫主機的 video 證據即時計算；原排名、決策物件、親和與控制需求政策保留。需求按當前已確認碼率與實際倍率計算，缺少任一資料即保留缺值；有效速度獨立顯示。計算與時效的唯一規則來源見 [架構指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/ARCHITECTURE.md#控制中心資料流)。

本次沒有改選路、授權、傳輸提交或生命週期控制分支；新增容量投影只讀既有狀態並在身分變動時捨棄結果。每次完整快照仍只讀一次，使用原一秒監控刷新；詳細文字仍按需建立。沒有增加探測、輪詢、訂閱、持久資料、診斷或歷程收集。Native 預設及既有布林值、schema 2、四個儲存鍵、樣本算法／容量、量測與恢復額度、兩筆成功影片的確認門檻保持，無遷移。

測試中的 1 MiB／200 ms 與 41.94304 Mbps 是合成傳輸資料，不能當成實機測速。v2.2.4 R1 的六項基本驗收原文及結果完整保留；它沒有涵蓋成功學習後數字更新、倍率需求數值與樣本過期，後續判讀補充位於 [歷史全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-完整正文保存2026-11-01)。不回寫原 PASS／FAIL／INVALID，也不宣稱使用者原截圖的完整觸發因果已重現。

## 自動驗證

固定 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。命令已檢查不啟動網站服務；verify 的封裝檢查只用暫存位置。基線 **18 套件／1,634 案全部通過**；按套件與完整展開名稱逐項對照，原案例全部保留。新增路線 20 案、UI 21 案，最終 **18 套件／1,675 案全部通過**，failed／cancelled／skipped／todo 均為零。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | 通過 |
| imports | 1 | 通過 |
| domain-boundaries | 3 | 通過 |
| domain | 11 | 通過 |
| state | 35 | 通過 |
| application | 588 | 通過 |
| adapters | 210 | 通過 |
| native-routing | 13 | 通過 |
| native-transport | 167 | 通過 |
| orchestration | 40 | 通過 |
| adapter-boundaries | 65 | 通過 |
| measurement-state | 94 | 通過 |
| progressive-playurl | 29 | 通過 |
| progressive-routing | 71 | 通過 |
| progressive-transport | 4 | 通過 |
| playurl-summary | 22 | 通過 |
| control-center | 84 | 通過 |
| tooling | 197 | 通過 |

### 新增回歸與保留契約

| 範圍 | 驗證內容 |
| --- | --- |
| 真實 EvidenceStore／RouteCoordinator | 冷啟動、播放器備援及起播空排名，選中主機不在十二筆投影排名內仍讀到速度；一般傳輸、起播與健康量測只在合法提交後生效 |
| 時效與隔離 | TTL 前、恰好 TTL、後一毫秒、混合樣本衰減、全部過期及重新學習；音訊／其他主機隔離，清除與遠端更新；讀取不刪持久資料 |
| 所有權 | 停用、black／dead、Catalog 禁用、政策、generation、epoch、Vault 授權更新與同步重入捨棄舊容量；讀取不清計畫、不改 Session／親和、不發事件或寫入；失敗保存與舊工作不能形成當前容量 |
| 真實讀模型與 Node UI | 兩筆完成後下一次既有 tick 顯示速度；4 Mbps、1→2 倍需求 5→10 Mbps、餘裕減半；表示更換遵守原確認門檻；三頁切換／重開、遠端學習／清除及真換片 |
| 缺值與數值邊界 | 碼率／倍率缺失、零、負數、非有限、溢位／下溢與播放器不可用；有效速度獨立顯示；合法低碼率仍使用 2 Mbps 下限；快照各身分欄位不一致時不顯示另一計畫容量 |
| 刷新副作用 | 按需詳細文字不隨 tick 重建，下次要求取得新模型；倍率刷新不增事件、寫入、計時器或播放器命令；原單次完整快照、非同步設定失敗／鎖等待／晚到畫面與資源清理契約保持 |

執行期修改前，第一批路線 17 案均在缺少 currentCapacity 的舊版失敗；UI 實作前保留了冷啟動、備援、倍率／表示、過期與冷卻提示的失敗結果。排名裁切、量測來源與其他補充案例另於實作後加入，沒有宣稱它們全部完成紅綠循環。既有數值格式案例改注入新容量投影與明確碼率／倍率，保留名稱及有效速度、缺值、非有限數和無假需求的行為斷言。

原 Native／Catalog／固定／禁止／停用、影音隔離、過期授權、同步重入、取消、晚到工作、影片備援恢復、位置／倍速與額度契約均由完整套件回歸。TTL 的長時間測試停止假播放器週期 tick 以隔離時鐘，不冒稱 24 小時連續實機播放。

型別、架構（92 個執行期模組、無循環）、完整測試、格式、文件、封存、verify 與差異檢查均通過。verify 再執行全套 1,675 案，核對兩次建置一致、語法、撤除功能禁止標記與暫存封裝 checksum。文件初檢的版本欄位與 Markdown 空行問題已修正；未放寬檢查或案例斷言。基線、失敗回歸、最終案例、逐項對照與 verify 日誌保存於本機忽略的 `.work/v225/`，不作正式執行輸入。

## 安全差異

逐一核對本次執行期差異：RouteSnapshot 增加唯讀容量，RouteCoordinator 只在 snapshot 路徑呼叫既有政策與 Vault 讀取；UI 使用當次資料衍生數值及提示。沒有改動授權決策、請求送出／提交、取消、可信事件或生命週期控制。因此依本版批准的風險規則，不觸發 Codex Security 差異掃描；不將此寫成安全掃描通過。完整傳輸與授權契約仍由離線套件驗證，正式 bundle 另外檢查已撤除功能標記。

## 公開交付與安裝結案

v2.2.4 五份 Release 原件已核對既有 checksum、保護雜湊與逐位元組相等，移至 `archive/retired/releases/Release/v2.2.4/`；搬移清單舊版另存不可變快照。上一版完整 TEST_REPORT 含 R1 已原樣追加至歷史正文，三份日誌保留全部既有位元組前綴。

本版全部離線門檻已通過，建置腳本為 **424,558 bytes**，SHA-256：**c2ce2bad31c766e4c40236a1919b133f8272c9d33511e796f6803ba8d3f0f87f**。本段為封裝前檢查點；正式封裝五項本機產物後，提交推送 main／v2.2.5 標籤並發布唯一腳本附件，公開核對另於發布完成後追加，不將尚未完成的遠端動作寫成通過。

### 發布後公開核對（2026-11-01）

正式 [v2.2.5 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.5) 已發布。發行提交 **77eef1c25639a99c889fe390fa82c295298b2b43**，標籤物件 **ba518994ad2a358981a1d816fd729e996487753c**；推送後遠端 main 與解參照標籤均為該提交。Release 為正式版本、非 draft／prerelease，唯一附件為 BiliCDN_TW.user.js。

公開固定附件、latest 更新下載、main 原件與 v2.2.5 標籤原件均直接下載核對，版本 **2.2.5**、**424,558 bytes**，SHA-256 均為 **c2ce2bad31c766e4c40236a1919b133f8272c9d33511e796f6803ba8d3f0f87f**，與本機逐位元組相等。本機五份產物、上一版五份原件、Git 索引及三份日誌完整既有前綴也核對一致；CRLF 原件以個別 Git 屬性保留行尾，沒有改寫原件來通過差異檢查。

封裝後文件檢查通過 258 Markdown／3,277 本機及儲存庫連結；7 個不可變舊斷鏈、434 個歷史原址限制、18 個私有證據未核對與 585 個外部未連線引用分列。封存檢查通過 459 搬移項目、三份追加日誌、117 未變檔與 73 checksum／334 列。發布結案只更新文件並推送 main，不重新封裝、不升版，也不移動 v2.2.5 標籤。

### 來源隔離與實際安裝

修復及發布階段未啟動瀏覽器、安裝或更新腳本、來源隔離、故障注入或播放窗口。使用者後續確認已更新安裝版並另行授權以下 R1；未重新安裝或切換來源，也未恢復已結束窗口。發行快照保留發布當時的未實測狀態。

<a name="v225-r1-安裝驗收2026-11-01"></a>

## v2.2.5 R1 安裝驗收（2026-11-01）

基準為乾淨 main／`ac8dd571ab68668eb40d3503f14235cbffd3ab54`，使用者已更新安裝版。本輪只用 Codex 內建瀏覽器＋Tampermonkey、一個自有分頁與 `BV1tFZZBQE57／P1／Auto`；未強制畫質、改帳戶設定或停用其他腳本。凍結六個核心案例，Auto 1／2 倍各一個完整 60 秒窗口，不追加輪次。總時限保守採首個瀏覽器檢查前的 UTC 讀值為 T0：22:27:59（Asia/Taipei）；22:52:59 起只清理、硬截止 22:57:59。媒體及 registry 於 22:39:56.782 核對完成，隨即釋放偵錯資源並關閉分頁；自有分頁為零。

### 核心案例與結果

| 案例 | 預期與實際證據 | 判定 |
| --- | --- | --- |
| I225-01：安裝身分 | 實際載入完整本體 424,558 bytes，SHA-256 與上節正式附件一致；Tampermonkey 5.5.1／腳本 2.2.5；RuntimeController、ControlCenter、TransportAdapter 各一個，Fetch／XHR hooks 均已安裝 | 有效／PASS |
| I225-02：合法樣本與數值更新 | 當前影片計畫為 Catalog player-fallback、ranking 為空；影片主機 ali 的保留 video 樣本可獨立重算保守速度。兩窗分別取得 15／25 個不同樣本更新時點與 9／12 種畫面速度，容量、畫面速度及餘裕逐筆符合當前資料 | 有效／PASS |
| I225-P1：Auto 1 倍 | 60,006.9 ms、進度 +60.000515 秒；已確認碼率 11,642,829 bps，需求 14.55353625 Mbps，畫面顯示 14.55；62 筆起訖及週期樣本全部靜音、正常播放且數值相符 | 有效／PASS |
| I225-P2：Auto 2 倍 | 透過網站倍速選單切 2 倍；60,001.6 ms、進度 +120.011525 秒；同碼率需求 29.1070725 Mbps，畫面顯示 29.11；62 筆樣本全部靜音、正常播放且數值相符 | 有效／PASS |
| I225-05：三頁與詳細狀態 | CDN、播放設定、總覽正常切換且保留原值；總覽恢復有效速度／餘裕，詳細文字只在要求時建立、其間不自動重寫，再次要求取得新數值；重開中心後收合 | 有效／PASS |
| I225-06：還原與清理 | 網站選單還原 1 倍，媒體 paused=true、muted=true；設定模型、儲存值與基線逐欄相等；兩窗 observer 已自動截止，移除全部自有監聽、timer、registry、斷點與物件群組並關閉分頁 | 有效／PASS |

六個核心案例 **6／6 PASS**，無核心 FAIL 或 INVALID。這是本輪具體斷言的結果，不擴張為所有缺值原因、格式或故障能力均已驗證。腳本來源直接從實際載入的執行來源取出完整正文並核對，沒有下載重裝、重建控制器或注入另一份產品。

### 倍率、速度與播放窗口

| 窗口 | Asia/Taipei 起訖 | 連續長度 | 樣本／最大間隔 | 需求／播放進度 |
| --- | --- | ---: | --- | --- |
| I225-P1 | 22:32:47.455–22:33:47.462 | 60,006.9 ms | 62 筆／1,005.6 ms | 14.55 Mbps；+60.000515 秒 |
| I225-P2 | 22:35:36.471–22:36:36.473 | 60,001.6 ms | 62 筆／1,007.3 ms | 29.11 Mbps；+120.011525 秒 |

兩窗實際尺寸均 3840×2160、已確認 2160p／av1，Auto 選到 4K；標題中的 8K 不算 8K 實測。兩窗 rate 固定、同一媒體、未 seeking／paused／ended／mediaError，waiting、stalled、error、pause、seeking、ratechange 事件各零；相鄰樣本沒有兩秒無合格進度。Recovery reloadCount 均為零，不當成重載效用通過。這些是有界採樣與事件證據，不宣稱排除樣本間所有短暫異常。

速度使用本輪真正 singleton 的當前主機 video 證據；外部離線核對按既有 TTL、單筆折扣／雙筆取小值／多筆衰減加權分位數重算，不呼叫產品 tick 或改控制資料。兩窗各 62 筆的 currentCapacity 均與獨立計算相符，UI 速度及餘裕的兩位小數亦逐筆吻合，沒有需要以舊樣本補配的列。1 倍速度顯示由 37.43 等多次更新至窗口終點 127.26 Mbps；2 倍由 42.30 等多次更新至終點 46.67 Mbps。這些是當時保守學習值，不能當成寬頻上限或整段固定速率；窗口後截圖的 35.18 Mbps／1.21 倍是另一個較晚時點。

同碼率需求由 14.55353625 精確加倍至 29.1070725 Mbps。由於自然下載持續改變速度，不能跨兩窗宣稱畫面餘裕必定直接減半；每筆餘裕均核對為當下安全吞吐除以當下需求。倍率更新未借用舊排名比例。

### 節點、準備與證據限制

- 兩窗容量所屬影片主機為 `upos-sz-mirrorali.bilivideo.com`；影片實際功能回應摘要亦為該主機／206，音訊為 `upos-sz-mirroraliov.bilivideo.com`／206。影音各自讀取，不用音訊樣本補影片容量。
- 準備時量測元件保留最近主機 `upos-sz-mirroralib.bilivideo.com`、lastAttemptAt=1793543365486，range 為 head／sizeKnown，之後原因為 cross-tab-cooldown 或 low-buffer。這不能證明該主機主動測速成功，也不能推定另有分頁；畫面已使用「共用測速冷卻中」。本輪主要速度更新證據來自普通影片傳輸學習，未手動探測或重設冷卻。
- 初次靜音讀回為 paused=true、time=0；播放器自然恢復上次位置後再次確認 muted=true。首次導覽至第一次真正媒體靜音讀回的區間不列已證明全程無聲窗口。兩個計分窗口全部樣本均 muted=true；未追加起播前靜音門檻，未取消音訊下載。
- 因自動恢復的播放位置接近片尾，2 倍計分前透過網站進度列尋位至同片較早區間，等待 seeking=false 再開始窗口；該準備尋位與倍率變更不計入兩個連續窗口。沒有切換影片或用改 getter、預算／控制器重設製造進度。
- 觀察開始時已有有效學習，未自然取得「完全無樣本→第一筆有效速度」的完整起點；未自然取得有速度但缺碼率／未知倍率、表示更換或樣本全部過期。24 小時前／恰好／後一毫秒的邊界保留離線契約，不調整瀏覽器時鐘、不等同本輪 I 層通過。
- 未做來源隔離、Native／Catalog 模式切換、背景／跨分頁、故障注入、自然恢復、提前重試效用或舊矩陣。原 Native=false、earlyRetry=false 與香港節點關閉等個人設定完整保留，不為湊案例改動。使用者原截圖的完整觸發因果仍未確認，舊版 PASS／FAIL／INVALID 不改寫。

### 工具與清理

高階點擊在準備時無法定位隱藏的入口，且不支援封閉 ShadowRoot；身分取得後直接呼叫既有中心開啟方法，入口本身沿用跳過決定，不列點擊通過。三頁與詳細操作改用同一 IAB 已授權 CDP 的原生滑鼠輸入，沒有換瀏覽器或修改 DOM 來假造 UI。第一次廣義搜尋 show 方法得到的斷點位置不合適，立即移除，再以真正監控 tick 的短暫斷點取得 singleton；身分取得後立即移除並恢復，所有暫停均在計分窗口前。清理時第一次選單定位未生效，重新讀取當前狀態後用網站既有選項還原並讀回 1 倍，沒有留下錯速。

兩個外部唯讀 observer 各自固定 60 秒自動截止，保存真正終點，晚到讀取不延長窗口。每窗一個 interval、一個截止 timeout 與六個媒體事件監聽均由同一 owner 管理並移除；中心重開後 observer 改從 owner 讀當前 ShadowRoot，沒有把舊閉包的已卸載視圖當成新畫面。清理確認 registry 已刪、監聽零、媒體暫停且靜音、rate=1，Debugger 停用、物件群組釋放、唯一自有分頁關閉。未建立 Network／Fetch 攔截、產品包裝、合成樣本或持久寫入抑制；正常播放新學習保留。

原始有界證據位於本機忽略的 `.work/iab-testing/2026-11-01-v2.2.5-ac8dd57-R1/`，包含 BASELINE、IDENTITY、CASES、P1、P2、UI、CLEANUP、ANALYSIS 及畫面截圖；不提交簽名 URL、Cookie、IP 或播放器物件。本輪只更新文件與導覽，不修改產品、測試、工具、版本或 Release，也不重跑已通過的執行期驗證。

P1 原始 JSON SHA-256：`9de6f27ffff4c52aae530cceb123929cc1b3b605714b386a6e512052f1507b88`；P2：`b54c2ba54c70014e7e060e53c8ae046a04b489337041b3f7c8ad43aaef0cccc3`。文件檢查通過 258 Markdown／3,281 本機及儲存庫連結，原有 7 個不可變舊斷鏈、434 個歷史原址限制、18 個私有證據未核對與 586 個外部未連線引用分列。封存檢查通過 459 搬移項目、三份追加日誌、117 未變檔與 73 checksum／334 列；git diff --check 通過。產品、測試、工具與本版五份 Release 共 220 檔 SHA-256 未變，三份日誌全部既有位元組前綴保持。

<a name="v224-r1-安裝驗收2026-11-01"></a>

此相容入口導向 [v2.2.4 完整正文與 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-完整正文保存2026-11-01)，不是本版新增安裝驗收。

<a name="v223-r1-安裝驗收2026-11-01"></a>

此相容入口見 [v2.2.3 完整正文及 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-完整正文保存2026-11-01)，不是本版新增安裝驗收。

<a name="清除結果與零殘留範圍"></a>
<a name="全文閱讀覆蓋清單"></a>

這兩個舊入口導向 [v2.2.2 零殘留全文清查與逐檔 SHA-256](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v222-完整正文保存2026-11-01)。本版執行變更差異與契約核對，沒有將舊版 211 檔全文清查冒稱為本版重新全文閱讀。

## 歷史驗證導覽

[歷史索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)；[v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修復與根因"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="發布與安裝限制"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修後唯一-hk04-定向窗口"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-30up141-安裝版實測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31更新後安裝核對"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31補測與單分頁重測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="v220-安裝驗收-r12026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="澄清後在原期限內續行"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="auto-2-倍補充與本次驗收結案"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="公開交付"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。
