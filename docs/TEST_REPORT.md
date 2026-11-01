# BiliCDN_TW v2.2.3 介面精簡、初始化整合與測試情境重整驗證

日期：2026-11-01（Asia/Taipei）。基線為乾淨 main／`e4eeb294173b5141ff279456f559cb2e45e7979b`，執行順序為基線、測試清理與分組重整、內部介面、首次刷新、最終驗證及交付。原 [v2.2.2 整合盤點](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/POST_DIAGNOSTICS_INTEGRATION_v2.2.2_2026-11-01.md) 保留原文；本版只實作已批准的優先整理項目。

## 實作結果與契約

| 範圍 | 實作 | 保留的行為 |
| --- | --- | --- |
| 十三個現役套件 | 直接組裝必要資源與轉移，移除數字情境、跨完整案例的建立鏈與 extendFixture 支援檔；共用本地窄資源工具，閉包欄位使用明確存取器 | 原套件選擇器、案例名稱及參數展開；每案 testScope／defineGlobal 清理 |
| O02／O03-1 | 刪除 ControlCenterSnapshot 的 version／releaseStage、ControlModelSources.now、工廠版本參數與未用 EarlyRetryEvidenceControlPort | 中心 deps.version／deps.now 仍由入口注入；實際重試抑制、成功帳本及資格維持 |
| O01-1 | 刪除 recentPlans／lastSuccess 的型別與快照投影 | 私有 #plans、#lastSuccess、latestVideoHost()、當前計畫與影音資料保持 |
| O01-2 | 總覽／CDN 不再自行做完整首次刷新，由中心建構後統一執行一次 | 三頁文字、勾選、固定主機與限制；通知、可信事件及命令流程保持 |

使用者操作、Native 預設 true 與既有布林值、schema 2、四個儲存鍵不變，沒有資料遷移。通知合併、latestVideoHost 退役與重試抑制重封裝維持延後；已撤除功能不恢復。

### 測試前置狀態與有效斷言

固定基線為 18 套件／1,598 案全部通過。逐套件保存名稱及參數展開；原 1,598 案均完整保留。十三個現役套件包含 domain-boundaries、domain、state、measurement-state、native-routing、progressive-routing、application、adapter-boundaries、native-transport、progressive-transport、adapters、playurl-summary、orchestration。progressive-playurl 原始位元組保持，僅重跑相容性；不恢復撤除的套件。

清除已確認無作用的常值與私有 DefaultOff 誤稱，保留呼叫、getter、await 與清理的必要副作用。情境重整階段使用既有 Node 契約執行器，另在忽略的工作目錄對十二個原繼承套件逐一比對 check 函式實際進入的分支與斷言序列；原基線案例全部保留，分支／斷言序列相同。domain-boundaries 的三個具名案例保留原斷言。這些是離線測試比對，沒有產品插樁或新增收集功能。

前置狀態複查進一步移除無用途的 Runtime reset／dispose、純領域計算重播及無關的 XHR／過期回應前置操作；既有 getter 轉換、等待／釋放配對及有效斷言依實際用途保留。保留的設定、鎖等待與生命週期轉移由各自案例直接建立。未以空值、常值或刪除案例代替有效斷言。

另逐項核對負向案例的實際觸發：倍速案例執行十次真正的 Monitor tick，先確認十次速率觀察再驗零寫入；暫停死核心保留健康基準及停滯 tick。schema 2 缺值案例保留含舊 codec 的實際儲存資料，跨分頁案例先存 Native=false 再派送未來時間戳的遠端 Native=true 更新；低信任來源先失效，頁面提示先經實際 transform。兩個停用傳輸情境明確設定 disabled=true／Native=false 並斷言前提。這些補強避免以新預設或未執行操作形成表面通過；案例名稱與原有效斷言不減少。共用 API 失敗檢查集中於既有 loading／錯誤案例，六種去除敏感原始資料的斷言與後續 getter／重入檢查保持。

介面修改前，40 群組的原決策重用及紀錄所有權先通過，新增「快照不含 recentPlans／lastSuccess」斷言如預期失敗；刪除投影後通過，且快照讀取後逐組再次重用原決策。同步重入仍驗內層獨立決策、事件 ID／順序與外層返回後成為可重用計畫。

新增 `V223 navigation initializes all three pages once from the current model` 一案。Node UI 替身先重現首次開啟、返回與重開總覽均寫入兩次；移除兩處視圖刷新後均為一次，CDN 各限制列也只填入一次。三頁初始化內容、六設定、Native／Catalog 勾選與入口注入版本同案確認。既有建構／刷新單份快照、按需詳細文字、遠端更新、保存失敗、鎖等待及失效視圖晚到完成契約保持。

## 自動驗證

沿用 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2 及鎖定開發工具，沒有新增依賴。已核對正式命令不啟動網站服務；verify 只於暫存位置驗封裝並清理，不覆寫 Release 原件。

最終完整離線測試為 **18 套件／1,599 案通過**：原 1,598 案名稱與參數展開完整，加一案初始化契約；failed／cancelled／skipped／todo 均為 0。下表為完整案例對照，並非安裝實測。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| `architecture` | 41 | 通過 |
| `imports` | 1 | 通過 |
| `domain-boundaries` | 3 | 通過 |
| `domain` | 11 | 通過 |
| `state` | 35 | 通過 |
| `application` | 588 | 通過 |
| `adapters` | 210 | 通過 |
| `native-routing` | 13 | 通過 |
| `native-transport` | 167 | 通過 |
| `orchestration` | 38 | 通過 |
| `adapter-boundaries` | 54 | 通過 |
| `measurement-state` | 94 | 通過 |
| `progressive-playurl` | 29 | 通過 |
| `progressive-routing` | 51 | 通過 |
| `progressive-transport` | 4 | 通過 |
| `playurl-summary` | 22 | 通過 |
| `control-center` | 41 | 通過 |
| `tooling` | 197 | 通過 |

型別、架構（91 個執行期模組、無匯入循環）、格式、文件、封存、完整測試與最終 verify 全部通過。verify 另核對鎖定工具配置、匯入純度、兩次建置一致、語法、撤除標記與暫存封裝校驗；完整執行無 only／skipped／todo／cancelled。

| 契約面向 | 直接證據範圍 |
| --- | --- |
| 畫面與設定 | control-center：三頁、總覽／詳細狀態、單份快照、一次首次刷新；state：缺值／既有值／重設／保存／失敗／遠端與鎖等待 |
| 選路與傳輸 | Native／Catalog／固定／禁止／停用；正常精確 Native、送出前重查、XHR 各型別／重用、Fetch 單一讀取器與取消原因 |
| 恢復與監控 | 影片備援轉交恢復、音訊隔離、額度、位置／倍速還原、停止與資源清理 |
| 競態 | 過期授權、同步重入、鎖等待、取消、晚到工作及失效視圖拒絕提交；多群組與決策所有權保持 |

### 安全差異

已完整核對相對基線的八份產品來源差異與正式 bundle 差異：未用型別／組裝依賴、只讀快照投影及兩處重複首次刷新。沒有修改授權、傳輸、可信事件處理或生命週期控制分支。依本次計畫的風險規則，不觸發新的 Codex Security 掃描；既有安全產物及判定保持，不宣稱本版完成新掃描。

正式 bundle 的差異限於版本、讀模型簽章／欄位、其他計畫與最後成功的投影，以及兩處 refresh(initialModel) 移除；沒有恢復診斷錄製、原線對照或掉幀收集用途。Native Vault、功能事件及恢復所有權不變。

## 發行產物與證據保存

v2.2.3 腳本 **418,897 bytes**；SHA-256：`7fc87054390d7141abcd2b8481054578d16b7ddf77852dbdcdf7f6146fd66914`。相對 v2.2.2 減少 573 bytes。可確認的執行工作減少為不再展開其他表示的完整計畫集合、不再複製 lastSuccess，以及每次開啟總覽／CDN 少做一遍完整刷新；不宣稱未量測的效能改善。測試重整優先明確隔離與必要狀態，沒有以行數減少作為成果。

三份版本設定已同步。換版前完整 TEST_REPORT（含公開交付與第二階段銜接）原樣追加至 [v2.2.2 全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v222-完整正文保存2026-11-01)。前版五份 Release 原始位元組移至 archive/retired/releases/Release/v2.2.2/，保留校驗值；先保存搬移清單原件，再更新保護範圍。舊清查、整合報告、安全產物與歷史證據不改寫，三份日誌只追加。

### 公開交付與安裝結案

封裝快照保存發布前檢查點；以下為 2026-11-01 發布後追加，五份本機 Release 原件不回寫。

正式 [v2.2.3 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.3) 已發布，非 draft／prerelease，並為 latest。發布時遠端 main 與標籤所指提交均為 `c28b674f4cec54529c537755bd9c50d9827cb974`；標籤物件為 `f51a2780169342d030de377e05ae55da709a8434`。Release ID `430417538`，唯一附件為 `BiliCDN_TW.user.js`（asset ID `697607951`）。

獨立下載公開 main 原件、v2.2.3 標籤原件、版本附件及 [latest 腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，四者都與本機逐位元組相同：版本 **2.2.3**、**418,897 bytes**、SHA-256 **7fc87054390d7141abcd2b8481054578d16b7ddf77852dbdcdf7f6146fd66914**。GitHub 附件 digest 亦一致。

後續 main 的文件結案提交與發行提交分開；v2.2.3 標籤維持上述發行提交。原件保護再次核對前版五檔、423 份既有原件與三份日誌全部既有前綴；另核對 189 份本次未變更的正式來源／測試／工具原始雜湊不變。這些原件與差異核對不代表重新全文閱讀舊清查的 211 檔，也不代表安裝版驗收。

### 來源隔離與實際安裝

本版發行與公開核對階段未啟動瀏覽器、更新安裝版或恢復停止窗口；封裝快照中的未實測敘述只屬當時檢查點。使用者隨後明確授權驗收已更新的安裝版，結果見下方 R1。來源隔離未另行執行；既有未解問題、效用 FAIL、INVALID 與永久執行禁令保持，工作狀態由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

<a name="v223-r1-安裝驗收2026-11-01"></a>

## v2.2.3 R1 基本安裝驗收（2026-11-01）

使用者確認內建瀏覽器腳本已更新，並明確要求設定目標開始驗收。以 main／`798209d` 凍結本輪，沒有重新下載或安裝腳本。核心 **7／7 PASS**；本輪已結束，沒有續測或新增窗口。

### 範圍與執行身分

T0 採首次工具準備的保守起點 **15:10:08 Asia/Taipei**，硬截止 **15:40:08**，最後五分鐘從 **15:35:08** 起只供清理／報告；實際瀏覽器清理已於 **15:30:59.991 前**完成。工具往返及等待計入總期限，純執行時間未獨立量測；兩個播放窗口另以頁內單調時計記錄。

只使用一個自有 IAB 分頁，指定樣片 `BV1tFZZBQE57`／P1／Auto。初次導覽後立即對真正媒體設靜音並讀回，當時 paused=true／muted=true；後續播放與兩個計分窗口保持靜音。不要求起播前已靜音、不要求前景、不啟動本機網站服務。其他腳本、帳戶及瀏覽器設定保持；沒有故障注入、清除學習或重設預算。

實際管理器為 **Tampermonkey 5.5.1**，腳本版本 **2.2.3**。從已載入使用者腳本取出完整正式本體，核對 **418,897 bytes**、SHA-256 **7fc87054390d7141abcd2b8481054578d16b7ddf77852dbdcdf7f6146fd66914**，與 Release 完全一致。RuntimeController、ControlCenter、TransportAdapter 各一個，Fetch／XHR hooks 均 installed。身分取得使用短暫的正常 Monitor 呼叫斷點，隨即移除並恢復執行；暫停時間不計入播放窗口，沒有手動呼叫產品 tick。

### 核心結果

| ID | 斷言與實際結果 | 判定 |
| --- | --- | --- |
| I223-01 | 完整本體、管理器版本、唯一執行個體及 hooks 核對一致 | PASS |
| I223-02 | 總覽／CDN／播放設定三頁初始化與切換正確；總覽緩衝、吞吐、餘裕及影音狀態有實際資料；詳細文字點擊前不存在、點擊後完整顯示；關閉重開後畫面正確；無撤除功能入口 | PASS |
| I223-03 | Native 以可信 UI 輸入 false→true→false，UI、當次模型與 GM 儲存於命令完成後一致，原有 false 保留 | PASS |
| I223-04 | 六個設定顯示與原值一致；起播提前放行以可信 UI true→false→true，完成保存後再讀新快照；全部設定除 updatedAt 外還原。WebRTC／HTTPDNS 開關保持原值 | PASS |
| I223-P1 | Auto 1 倍完整 60 秒，實際進度約 60.003 秒；同媒體、全程靜音，採樣及媒體事件未見暫停、尋位、等待或錯誤 | PASS |
| I223-P2 | 經網站選單切到 2 倍並讀回；Auto 2 倍完整 60 秒，實際進度約 119.901 秒；同媒體、全程靜音，採樣及媒體事件未見暫停、尋位、等待或錯誤 | PASS |
| I223-07 | 逐欄還原設定、網站倍速還原 1 倍並暫停且保留靜音；採樣／事件監聽、靜音 guard、斷點與遠端物件群組解除，registry 移除，唯一測試分頁關閉，IAB 分頁為零 | PASS |

首次刷新「一次」的精確呼叫數由前述 Node 契約驗證；本輪安裝版確認的是首次內容、切換與重開的實際畫面，沒有向產品加入刷新計數插樁。Native 保存通過不擴張為所有實際目的地均已驗證。

### 播放窗口與證據邊界

| 窗口 | Asia/Taipei 起訖 | 單調時長 | 採樣數 | 媒體進度 | 實際解析度 |
| --- | --- | ---: | ---: | ---: | --- |
| 1 倍 | 15:23:50.472–15:24:50.476 | 60,003.8 ms | 62 | +60.002936 秒 | 3840×2160 |
| 2 倍 | 15:26:23.101–15:27:23.102 | 60,000.5 ms | 62 | +119.900549 秒 | 3840×2160 |

兩窗均保持 Auto，控制中心顯示 2160p／av1；沒有強制畫質。約每秒採樣，最大間隔分別為 1,014.8／1,014.4 ms，沒有觀察到無進度區段、媒體替換、paused／seeking／ended／error 或 waiting／stalled 事件。靜音不停止音訊下載；功能快照仍觀察到影片與音訊各自成功的 HTTP 206 回應。這些回應是腳本觀察，不冒稱完整瀏覽器 Network 取證。

一般播放與設定操作依實際產品行為判定，沒有要求診斷報告或完整 Network 成功。自然主動量測、提前重試效用、備援恢復、Native 各實際目的地、指定香港供片、背景與跨分頁行為均未在本輪另行驗證，不阻塞已凍結的基本核心結果。初始功能狀態曾顯示 recovered、reloadCount=0，不據此判為重載恢復通過；舊效用 FAIL、INVALID、未解根因及停止矩陣不改判。

本機忽略證據位於 `.work/iab-testing/2026-11-01-v2.2.3-798209d-R1/`，包含 BASELINE、CASES、P1／P2、SUMMARY、CLEANUP 及五張截圖；不輸出簽名媒體網址、Cookie、IP 或播放器物件。P1／P2 原始 JSON 的 SHA-256 分別為 `0eefb660ad8d9e75696de47912a9c3666206dbd3d37e8080171688eb9ace7749`、`050ed5ae463bfc6bb88d039fa330d95204a820b7a56fa277257f8359371268cb`。

清理批次曾有一次字串語法錯誤，工具在執行前拒絕該批次；修正後完成還原及清理，沒有重跑已通過窗口。最終 paused=true、muted=true、rate=1，原設定除更新時間外一致；本輪沒有安裝 Fetch／Network 攔截或產品包裝。正常播放產生的學習／限制資料保留，不以舊快照覆蓋。

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
