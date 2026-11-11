# BiliCDN_TW v2.2.18 完整驗證報告

發行驗證日期：2026-11-11（Asia/Taipei）。基準 main／33565b2、v2.2.17；三批實作提交為 9e52184、1ef8b08、5f61b93。採離線建置與自動驗證，安裝版另行判定。

## 驗收結論

三項政策固定啟用、控制器狀態整理及建置／封裝護欄已完成。十八套件／2,432 案通過，包含型別、109 個模組架構、格式、文件、公開封存、可重現建置、語法及空暫存目錄五項封裝。安全差異掃描完成，沒有可報告漏洞或未結案候選。正式封裝與最後一輪 verify 已完成，公開下載另見下方交付狀態。

本次可驗收收益是減少政策組合、讓恢復階段明確，以及阻止誤覆寫與縮短失敗輸出；不宣稱播放速度或卡頓改善。提前重試六情境效用 FAIL 與歷史實機證據缺口保持。

最新安裝結果見 [2026-11-12 R1](#v2218-r1-安裝身分與設定頁2026-11-12)：安裝身分、設定頁內容與偏好保持、清理通過；播放器入口點擊及設定保存不在通過範圍。2026-11-11 更新嘗試的 INVALID 保留，不再作為目前待更新狀態。

## 自動驗證

當次依賴工具取得 Codex 內建 Node 24.22.1，明確執行且父子 Runtime 一致。實際路徑與原始日誌保留於本輪本機證據；沒有改動工具鏈、開發依賴或版本鎖定政策。執行期最終來源的完整 verify 為 2,432 案、29,153.5 ms；版本與正式封裝完成後再驗證為 2,432 案、28,884.4 ms；failed／skipped／todo／cancelled 均為零。沒有啟動網站服務。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 52 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 111 | PASS |
| state | 86 | PASS |
| application | 878 | PASS |
| adapters | 214 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 84 | PASS |
| measurement-state | 135 | PASS |
| progressive-playurl | 64 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 112 | PASS |
| tooling | 320 | PASS |

相較基準新增十六案：七個交付工具、五個舊設定相容、兩個退役欄位通知、兩個零時間重載案例。工具契約先出現五個預期失敗；零時間重載兩個反例也先失敗，修改後通過。沙箱內 Git／Bash／連結暫存操作限制與產品失敗分開，相同來源在允許所需暫存操作的環境通過，沒有放寬斷言。

控制器整理前凍結第二批的 2,430 案。第三批完整保留原 876 個應用案例並新增兩案，十八組既有 JSON 副作用／快照軌跡逐項相同；PlayerControlObserver 方法經欄位反向映射及格式正規化後與第二批相同。一般停滯 6／12 秒、長 seek 15／30 秒、死核心 4 秒、重載後 15 秒、真正位置零、SDK getter 重入、使用者操作、晚到 Promise、一次補正與已用額度保持皆由既有及新增契約覆蓋。

## 安全差異

Codex Security 已完成並讀回 33565b2→5f61b93 的 canonical 封印，scan ID 6fe384c6-86e0-4ef5-a732-7bf682717ef4。二十七個來源／測試／工具變更檔案與五份隨附文件已審閱；可報告漏洞、候選及 deferred 均為零。掃描設定為 gpt-6-astra／xhigh；後續版本、文件與封裝管理另行核對，沒有在掃描後修改執行期。

重點為 Native 精確授權、設定失效與取消、主動探測及重載唯一所有者、getter 重入、晚到結果、預算與恢復 token。這是固定差異的安全審查，不是全儲存庫逐行審計或 Tampermonkey 實機驗收；既有效用 FAIL 不轉寫為漏洞。

## 功能與政策保持

起播提前放行、健康中段探測與合格備援家族分散固定啟用，內部停用參數及三個 UI 控制項一起移除。起播仍要求有效足速結果；中段仍要求目前來源的可靠大小，否則使用首段；分散只排序合格備援。來源失效、全部不足速、禁止規則與截止到期的退路保持。

舊設定三欄的 true／false／缺值／非法值都不再控制政策；schema 2 與四個儲存鍵不變，載入不強制寫回，下次正常保存才淘汰退役欄位。提前重試、WebRTC、HTTPDNS、整體停用、Native、固定 CDN 與逐台設定保持；退役欄位通知不取消已開始工作或重開額度。

RecoveryController 明確區分 waiting／prepared／submitted，還原以位置、倍速、播放、進度具名階段表達；保留同一 token 身分及自然恢復獨立路徑。PlayerControlObserver 只收斂私有尋位、重載與還原紀錄。PlayerMonitor 未修改；999 ms 採樣、低緩衝 stable-retained、提前重試交接及獨立健康額度重開契約保持。

<a name="來源隔離與實際安裝"></a>

## 前輪來源隔離與實際安裝（2026-11-11）

本輪依 TODO 凍結範圍，23:52:45（Asia/Taipei）起算，總上限十五分鐘、最後三分鐘只清理；23:54:50 前結束。唯一自有 IAB 分頁先開公開 latest 更新入口，抵達 Tampermonkey 安裝中繼頁；同分頁新載入 BV1tFZZBQE57／P1／Auto 後，Debugger 讀到的完整 userscript 來源仍含 @version 2.2.17。因此新版安裝身分前提未成立，L0 窗口列 INVALID，S1 新版設定頁未執行；不能算產品功能失敗或新版通過。沒有驗證新版本的完整本體相等、GM_info、singleton 或 hooks。

頁面起播後立即將真正 video 靜音並讀回，稍後暫停；清理前 muted=true、paused=true。Debugger／Runtime 停用，自有分頁關閉並核對為零，Z0 通過。沒有設定寫入、故障注入、訂閱或採樣計時器，也沒有開新播放窗口。第一次跨導覽 scriptParsed 游標有截斷；其後只重新啟用 Debugger 枚舉已載入腳本，第二次清單無截斷，沒有刷新產品或重跑驗收。

當時公開更新入口已嘗試但未完成安裝更新，因此以需先完成新版更新、另獲授權才建立新有界窗口的條件結案，不自動補跑。使用者後續確認更新並授權的結果見下方 R1，前輪 INVALID 原判保持。此前輪未新增來源隔離、提前重試介入與實際播放效益驗證；舊 v2.2.17 R1／R2 原文與所有 FAIL／INVALID 保存在下方歷史入口。

## v2.2.18 R1 安裝身分與設定頁（2026-11-12）

使用者確認更新後授權續行 L0／S1／Z0，沿用十五分鐘上限、最後三分鐘只清理。T0 為 00:00:21（Asia/Taipei），00:04:19 已結束；固定 BV1tFZZBQE57／P1／Auto／1 倍與一個自有 IAB 分頁，不重新下載／安裝、不重跑播放或故障窗口。基準 main／71eab777ee3cd8b77ac454d2e809707f5901fcfb，版本與發行原件保持。

| 案例 | 判定 | 證據與界線 |
| --- | --- | --- |
| L0 安裝身分 | PASS | 實際 GM_info：Tampermonkey 5.5.1、腳本 2.2.18。Debugger 取得完整執行來源，排除管理器包裝後與本機發行原件逐字相同：543,678 bytes、SHA-256 bb50cce1420c120066f1b7366d039604e97bc04a8d6867f8cdb7d6c8f8f2cf33。Runtime、ControlCenter、Monitor、EarlyRetry、Transport 各一個實例；真實 Transport snapshot 的 fetchInstalled／xhrInstalled 均 true、hookState=installed |
| S1 設定頁內容 | PASS，限內容與偏好保持 | 播放設定完整畫面只保留提前重試、WebRTC、HTTPDNS 三個開關，均勾選；退役三項不再顯示。整體停用按鈕、Native、CDN 選擇欄（目前 Auto）、逐台設定及展開後的清除／還原維護工具可見。前後設定快照（包含 updatedAt）完全相同，沒有操作保存、重設或清除；未展開 CDN 選項清單或驗證其切換 |
| Z0 清理 | PASS | 真正媒體 muted=true、paused=true、rate=1；關閉控制中心，釋放工具物件群組、停用 Debugger／Runtime，關閉自有分頁並核對為零。沒有新增斷點、攔截、訂閱或採樣計時器 |

方法限制：播放器設定浮層的 AX／locator 點擊未開啟控制中心，命中位置讀回為底下 video／浮層，因此入口點擊不算通過；過程曾使影片前進，立即再次靜音暫停，沒有把它當播放驗收。改由同一個既有 ControlCenter.show() 開啟，未重建控制器。closed ShadowRoot 不在一般 AX 中，通用 CUA click 回報不能點入；以截圖座標及受支援 CDP Input 切換播放設定／CDN、展開維護工具，畫面核對完成。這證明安裝版設定內容與可信分頁操作，不替代播放器入口驗收。

Debugger 已載入腳本枚舉無截斷；完整本體與 GM_info 由實際 hook 閉包取得。FetchHookAdapter 額外 queryObjects 回傳零不作唯一所有權證據；採用已確認唯一 Transport 的 hook snapshot。沒有持久化簽名 URL、播放器或核心物件，只保存窄結果與三張畫面。前輪 INVALID 原判保持，本輪不新增來源隔離、恢復／提前重試實機效益或保存設定的驗收。

## 公開交付與安裝結案

v2.2.17 五份 Release 原件已與固定基準逐位元組相符，完成 TAR＋gzip、獨立解壓與原始雜湊核對。上一版完整報告（含 R1／R2）原樣追加至歷史；既有封存內容保持。

公開封存 524 個搬移項目、三份追加日誌與完整六個公開壓縮包的系統 tar 獨立還原及 --restore-root 核對通過。23:52:45 公開核對：發行 main 與 v2.2.18 標籤解參照均為 c2ce4f5b37f3f736d256dbe3160c3a8ee10562cd；[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.18) 非草稿／預覽版且為 latest，唯一附件 BiliCDN_TW.user.js。版本下載與既有精確 latest 網址均 GET／HTTP 200、@version 2.2.18、543,678 bytes、SHA-256 bb50cce1420c120066f1b7366d039604e97bc04a8d6867f8cdb7d6c8f8f2cf33，與本機、可重現建置及 GitHub asset digest 一致。

封裝快照保留封裝當時文字；後續只更新現行報告，不回寫 Release 原件或移動版本標籤。本機原有 9,480 件加本輪十一件證據，共 9,491 件封存核對通過。本輪測試、軌跡對照、公開下載與安裝限制原件由系統 tar 獨立還原，再經 ArchiveStorage 及逐位元組核對；散件與還原副本清除，.work 回到空目錄。安全 canonical 原件留在 Codex Security 管理的持久掃描目錄。結案文件檢查通過 301 份 Markdown／5,033 個本機或儲存庫連結；歷史斷鏈與未核對外部連結仍依原分類保留。

## 文件與測試清查整理（2026-11-12）

以 main／fa7781d 的 v2.2.18 為基準，修正現行文件的退役開關描述、前後驗收輪次及主私有清單的公開證明範圍。保留原 INVALID、R1 內容驗收界線與歷史證據，沒有修改執行期、測試、版本或 Release。

十八個套件入口的靜態引用追蹤涵蓋 194 個測試 TypeScript 檔中的 193 個；剩餘 measurement-storage-scenario.ts 由契約透過 esbuild 建置並在子程序執行。未發現未接入的測試檔；這不是所有斷言的逐案審核。退役欄位相容、在途工作與額度保持、移除 UI 的否定契約仍有效，既有版本前綴及案例名稱保留。tooling 目錄中的 up141-test-release.ts 實際由 application 套件載入，本次不搬移或改名。

本次以依賴工具取得的 Node 24.22.1 執行 docs:check 通過：301 份 Markdown、5,037 個本機／儲存庫連結；另有七個不可變歷史斷鏈、672 個封存原網址不可用、十八個私有證據引用未核對及 951 個外部連結未擷取，依既有分類保留。git diff --check 通過，並人工對照來源與完整章節，核對固定政策資格、兩輪驗收的範圍及停止條件。文件檢查不代表語意自動驗證；沒有重跑完整 2,432 案、安全掃描或瀏覽器窗口，前述結果仍屬各原輪次證據。

<a name="v2217-r1-採樣與抑制專項2026-11-11"></a>

[v2.2.17 R1 原始採樣、尋位與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r1-採樣與抑制專項2026-11-11)。

<a name="v2217-r2-低緩衝與額度受控補驗2026-11-11"></a>

[v2.2.17 R2 原始受控整合與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r2-低緩衝與額度受控補驗2026-11-11)。

<a name="v2216-r1-載入身分與選路提交接線2026-11-09"></a>

[v2.2.16 R1 原始載入、方法錯誤及限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2216-r1-載入身分與選路提交接線2026-11-09)。

<a name="v2215-r1-載入身分與模組初始化2026-11-09"></a>

[v2.2.15 R1 原始載入判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2215-r1-載入身分與模組初始化2026-11-09)。

## 歷史驗證導覽

版本、議題、日期由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 維護；以下錨點只作相容導引。

<a name="v2214-載入身分驗證2026-11-08"></a>

[原版載入身分與 R1／R2 限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2214-載入身分驗證2026-11-08)。

<a name="v2212-r1-三頁與刷新專項2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2212-r1-三頁與刷新專項2026-11-08)。

<a name="v2211-r1-熔斷安裝驗收2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r1-熔斷安裝驗收2026-11-06)。

<a name="v2211-r2-受控熔斷與安裝接線2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r2-受控熔斷與安裝接線2026-11-06)。

<a name="v2210-r1-安裝版驗收2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r1-安裝版驗收2026-11-05)。

<a name="v2210-r2-補驗能力確認2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r2-補驗能力確認2026-11-05)。

<a name="v2210-r3-補驗2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r3-補驗2026-11-05)。

<a name="v2210-r4-正數-timeout-專項2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r4-正數-timeout-專項2026-11-05)。

<a name="v228-r2-專項完成2026-11-0304"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r2-專項完成2026-11-0304)。

<a name="v224-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-r1-安裝驗收2026-11-01)。

<a name="v223-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-r1-安裝驗收2026-11-01)。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。

<a name="v225-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-r1-安裝驗收2026-11-01)。

<a name="三十五項閉環對照"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#三十五項閉環對照)。

<a name="v226-r1-安裝驗收2026-11-02"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v226-r1-安裝驗收2026-11-02)。

<a name="驗證階段與證據範圍"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#驗證階段與證據範圍)。

<a name="v2213-r1-選路黑名單與來源驗收2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r1-選路黑名單與來源驗收2026-11-08)。

<a name="v2213-r2-本版變更接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r2-本版變更接線補驗2026-11-08)。

<a name="v2213-r3-更新確認與實機觀察2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r3-更新確認與實機觀察2026-11-08)。

<a name="v2213-r4-自主接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r4-自主接線補驗2026-11-08)。

<a name="v2213-r5-受控真實-api-接線2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r5-受控真實-api-接線2026-11-08)。

<a name="公開交付核對2026-11-06"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付核對2026-11-06)。

<a name="研究項目完成對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#研究項目完成對照)。

<a name="v228-r1-正數-timeout-專項2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r1-正數-timeout-專項2026-11-03)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。

<a name="公開交付"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付)。

<a name="修復結果與證據邊界"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#修復結果與證據邊界)。

<a name="發布與安裝限制"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布與安裝限制)。

<a name="2026-10-30up141-安裝版實測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="2026-10-31更新後安裝核對"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="v220-安裝驗收-r12026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v220-安裝驗收-r12026-11-01)。

<a name="澄清後在原期限內續行"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#澄清後在原期限內續行)。

<a name="auto-2-倍補充與本次驗收結案"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#auto-2-倍補充與本次驗收結案)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-r1-安裝驗收2026-11-01)。

<a name="全文閱讀覆蓋清單"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#全文閱讀覆蓋清單)。

<a name="發布後公開核對2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-01)。

<a name="固定合成模型對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#固定合成模型對照)。

<a name="發布後公開核對2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-03)。

<a name="v227-r1-基本安裝驗收2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-r1-基本安裝驗收2026-11-03)。

<a name="v227-xhr-timeout-起播分支調查2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-xhr-timeout-起播分支調查2026-11-03)。

<a name="政策映射與契約保留"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#政策映射與契約保留)。
