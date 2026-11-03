# BiliCDN_TW v2.2.8 正數 XHR timeout 起播修復驗證

日期：2026-11-03（Asia/Taipei）。固定基準 main ddd41a0ad91a9a5673e8944ff86c5cb234f46443／v2.2.7；程式與測試審查固定至 6840815281b0cfb1d70409123b4aae66dd1b8ba8。先保存基線與失敗回歸，再修改執行期，各階段獨立提交。

## 修復結果與證據邊界

合格非同步媒體 GET XHR 的正數 timeout 不再排除起播測速，與零值共用既有一次三秒窗口。網站 timeout 保持最新值；沒有六秒門檻、沒有自動延長或清零。等待另計，三秒加五秒原生期限可能約八秒；瀏覽器排程及網站外部看門狗各自存在，不宣稱端到端期限完全不變。

重新準備不覆寫網站較新的 timeout；同世代換片的 Catalog 等待者也檢查 epoch。起播租期保存唯一 startedAt／deadlineAt，接納結果時檢查絕對期限，恰好三秒及之後的結果不回填；既有候選、bytes、一次預算、足速與退路保持。提前重試正數 timeout 的原限制保持。三頁、詳細狀態按需建立、Native 預設、schema 2 與四鍵均不變。

發行階段採離線驗證交付，當時未開瀏覽器、更新安裝版或恢復歷史窗口；後續新授權的 R1／R2 結果見各節。原 v2.2.7 指定片 86／86 略過是修前證據，不能改寫成修後實測；原始摘要、完整逐筆陣列未保存與清理讀回限制均保留在歷史正文。本版不宣稱已改善實機起播速度或解決多輪換站的全部原因。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10。命令已確認不啟動網站服務。基線原產品套件通過，工具套件初次因沙箱禁止暫存 Git config 寫入失敗；原輸出保留，以正常權限重跑工具套件通過，沒有修改門檻。

**18 套件／1,982 案全通過**，failed／cancelled／skipped／todo 均零；原 1,931 案名稱、kind 與參數展開多重集合無缺漏，新增 51 案。原始結果、環境重跑及案例對照保存在 .work/v228；基線案例 SHA-256 為 884cdfd376204371e9e2bded65a7f19a7177e219b019fe22f6727fcf9f52b66b。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 81 | PASS |
| state | 37 | PASS |
| application | 756 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 65 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 92 | PASS |
| tooling | 201 | PASS |

型別、96 模組架構、格式、文件、封存、git diff --check 及 npm run verify 全部通過；verify 再次通過 1,982 案、兩次一致建置、JavaScript 語法、撤除標記與暫存封裝校驗。沒有本機網站服務或瀏覽器操作，輸出保存在 .work/v228/verify.log。

## 失敗回歸與契約對照

| 項目 | 修前／修後證據 |
| --- | --- |
| 正數 timeout、網站改值與共用等待 | 24 案先行回歸中 21 案失敗，修後全通過；0 與正數在 Native 開／關均使用真實起播、選擇與送出組合 |
| 絕對期限 | 延遲排程下 2,999 ms 對照原本通過，3,000／3,001 ms 原本錯誤接納；修後均符合接納邊界，晚到不新增學習／提交 |
| 同世代換片 | Catalog 舊內容等待者原本仍送出，新增失敗回歸後補 epoch 檢查；Native 按目前限制原樣處理，不套舊歸因 |
| 取消與重新準備 | 並行 Fetch／XHR、單筆 abort、成功／失敗 open、停用、禁止、送出與 probe 例外均收束，原生 send 最多一次 |
| 資格與資源 | 固定、停用、非 GET、非媒體、同步、playurl、影片優先及純音訊保持；沒有新探測或輪次 |
| UI 與其餘功能 | 退役原因移除，原 UI 案轉負向文案檢查；原 1,931 案中其餘有效事件、所有權、恢復、還原、設定及清理斷言保持 |

原案例政策映射見[測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v228-正數-xhr-timeout-起播契約)。Node 原生 XHR 替身的送出時間／timeout 及事件紀錄只證明程式契約，不代替瀏覽器計時或安裝實測。

## 安全差異

Codex Security 掃描 174fe7d9-2fba-4fbc-b94d-ecb02a856ac4，固定 ddd41a0..6840815 的七個變更來源／測試檔。能力前置檢查、獨立架構檢查、XHR／量測獨立來源審查及父審查的 UI／測試差異均完成，七檔完整覆蓋；成立漏洞、待釐清候選與未審檔案均零。正式產物已封印並讀回，保存在 Codex Security 工作台：report.md、scan-manifest.json、findings.json、coverage.json、threatmodel.md 與 SARIF。固定掃描快照的舊 timeout 文件敘述已由本版現行指南修正；後續版本與文件維護未改動已掃描的執行期／測試程式。掃描是來源審查，不代替瀏覽器計時或安裝證據。

## 交付與安裝範圍

v2.2.7 五份原件已按位元組搬至 archive/retired/releases/Release/v2.2.7，保留原校驗內容。v2.2.8 腳本 474,008 bytes，SHA-256：`7573766cb33a425a109b5edb2649998e1cf90b6d7f3d8dddf052e338c6bd6027`。五份本機產物已由鎖定工具封裝，公開核對見下節；Release 快照保持封裝時原件，後續結果只追加現行報告。

發行時安裝版尚未驗證；使用者更新後新授權的專項結果見下列 R1。專項固定指定片 P1／Auto／1 倍、一個 IAB 分頁、十五分鐘總期限含最後三分鐘清理、一個九十秒自然窗口。一般播放正常不代替起播證據；前提不足不改 timeout、重設額度或自動補跑。永久靜音、無網站服務與不要求前景的規則保持。

## 歷史驗證導覽

[v2.2.7 完整正文、R1 與 XHR 調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-完整正文保存2026-11-03)；[歷史導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)；目前工作只見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

<a name="bilicdn_tw-v227-選路容量與起播探索驗證"></a>
<a name="研究項目完成對照"></a>
<a name="政策映射與契約保留"></a>
<a name="固定合成模型對照"></a>
<a name="發布後公開核對2026-11-03"></a>
<a name="bilicdn_tw-v226-確定性選路狀態機與提交所有權驗證"></a>
<a name="驗證階段與證據範圍"></a>
<a name="三十五項閉環對照"></a>
<a name="來源隔離與實際安裝"></a>
<a name="公開交付與安裝結案"></a>
<a name="v226-r1-安裝驗收2026-11-02"></a>
<a name="v225-r1-安裝驗收2026-11-01"></a>
<a name="v224-r1-安裝驗收2026-11-01"></a>
<a name="v223-r1-安裝驗收2026-11-01"></a>
<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>
<a name="bilicdn_tw-v225-安全吞吐需求餘裕與樣本時效修復驗證"></a>
<a name="新增回歸與保留契約"></a>
<a name="發布後公開核對2026-11-01"></a>
<a name="核心案例與結果"></a>
<a name="倍率速度與播放窗口"></a>
<a name="節點準備與證據限制"></a>
<a name="工具與清理"></a>
<a name="清除結果與零殘留範圍"></a>
<a name="全文閱讀覆蓋清單"></a>
<a name="v221-r1-安裝驗收2026-11-01"></a>
<a name="隔離-b-分支原型驗證2026-10-30"></a>
<a name="修復與根因"></a>
<a name="發布與安裝限制"></a>
<a name="修後唯一-hk04-定向窗口"></a>
<a name="2026-10-30up141-安裝版實測"></a>
<a name="2026-10-31更新後安裝核對"></a>
<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>
<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>
<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>
<a name="2026-10-31補測與單分頁重測"></a>
<a name="2026-10-31一次授權的單分頁缺口補測"></a>
<a name="v220-安裝驗收-r12026-11-01"></a>
<a name="澄清後在原期限內續行"></a>
<a name="auto-2-倍補充與本次驗收結案"></a>
<a name="公開交付"></a>
<a name="v227-r1-基本安裝驗收2026-11-03"></a>
<a name="r1-結果與範圍"></a>
<a name="r1-數值來源與限制"></a>
<a name="r1-證據與清理"></a>
<a name="v227-xhr-timeout-起播分支調查2026-11-03"></a>
<a name="實際分支結果"></a>
<a name="原因與影響範圍"></a>
<a name="證據保存與工具限制"></a>

舊錨點僅保留導引，原文見上列完整歷史保存。

## 發布後公開核對（2026-11-03）

正式 [v2.2.8 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.8) 已發布，非 draft／prerelease，唯一附件為 BiliCDN_TW.user.js。發行提交與標籤解參照為 b58bad4c72aefa6e090a2e0814f01c86ff58ceba；公開核對當時 main 相同，後續 main 僅追加本節及工作結案，不移動標籤。

版本附件與公開 latest 均實際下載並與本機逐 bytes 比對：版本 **2.2.8**、**474,008 bytes**、SHA-256 `7573766cb33a425a109b5edb2649998e1cf90b6d7f3d8dddf052e338c6bd6027`，GitHub asset digest 亦一致。核對時間為 Asia/Taipei **22:50:03**；原始公開核對保存在 .work/v228/public-verification.json。

上一版五份原件、完整報告及三份追加日誌前綴均按原始 bytes 核對；本版五份產物、建置來源雜湊及已掃描程式未變亦通過。文件／封存／差異檢查完成後提交推送 main；不再次升版、封裝或發布。安裝版仍未驗證，原 R1／調查限制及停止決策保持。

## v2.2.8 R1 正數 timeout 專項（2026-11-03）

使用者確認已更新並新授權。基準 main 2dca84a；唯一 IAB 背景分頁，指定 BV1tFZZBQE57／P1／Auto／1 倍。自然窗口為 Asia/Taipei **23:27:10.300–23:28:40.300**，完整九十秒；沒有重新安裝、改 timeout、修改設定、重設額度或補跑。工具初次準備早於目標建立時間 23:21:55，採更保守的 23:21 起算／23:36 硬截止，最後三分鐘保留清理；原始前置單調起點未量測。23:30:42 已完成媒體暫停靜音及分頁清理。

**已確認正數 timeout 不再阻擋起播測速，送出邊界保留網站值。逐筆影片／音訊分類證據不足，因此不宣稱本輪全部專項通過，也沒有確認產品 FAIL。**

| 項目 | 結果與直接證據 |
| --- | --- |
| 安裝身分 | PASS：Tampermonkey 5.5.1／2.2.8，已載入完整本體與發行原件逐字元一致，474,008 bytes／SHA-256 7573766cb33a425a109b5edb2649998e1cf90b6d7f3d8dddf052e338c6bd6027；RuntimeController、ControlCenter、TransportAdapter 各一，Fetch／XHR hooks installed |
| 正數 timeout 起播接線 | PASS：api-xhr-1 為合格非同步媒體 GET，timeout 10,000 ms，23:27:11.941 進入 prepareStartup；下一毫秒保留唯一窗口，啟動三個候選。api-xhr-9 的 13,000 ms 請求加入同一窗口，未另開輪次 |
| 起播結果與有界等待 | PASS：唯一輪次 elapsedMs=3,002，deadline 收束；兩個有效 206 結果均未達當時 29.1070725 Mbps 需求，選最快有效 aliov，result=insufficient。此為正常不足速選擇，不是測速未啟動 |
| 等待後送出及 timeout | PASS（程式送出邊界）：api-xhr-9 於 23:27:13.995 進入、23:27:14.947 到原生 send 呼叫邊界，等待 952 ms，13,000→13,000 ms，目標 aliov。118 筆可配對媒體請求全部保持值、無重複原生 send 觀察；119 筆媒體入口均為正數 |
| 逐筆影片歸因 | 證據不足：觀察器錯讀 meta.applied.kind，正確欄位應為 meta.applied.context.kind；逐筆均 null。影片優先程式契約、4K Auto 畫面及影音回應可支持流程判讀，但不冒充本輪直接記錄的逐筆 video 標籤 |
| 真正原生 timeout 到期與動態改值 | 未執行：本輪不修改網站 timeout，不以送出前讀值宣稱已驗證原生計時起點、到期事件或全部網站改值交錯 |
| 清理 | PASS：七個不暫停觀察點移除、Debugger 停用、物件群組與記憶體 registry 清除；真正媒體 paused=true／muted=true／rate=1，唯一自有分頁關閉後 IAB 零分頁。無自有計時器、攔截或訂閱；設定與初讀一致，合法自然學習保留 |

本輪候選依序為 upos-sz-mirroraliov.bilivideo.com、upos-sz-mirrorali.bilivideo.com、upos-sz-mirrorali02.bilivideo.com，每個上限 512 KiB。期限前接納 aliov 的 524,288 bytes／187 ms／保守 22.4294 Mbps，及 ali 的 524,288 bytes／606 ms／6.9213 Mbps；ali02 沒有本輪接納結果，不能推定已全面故障。已選主機仍不代表所有後續實際回應都由它提供。

觀察記錄 405 列，容量 10,000，dropped=0，條件在固定截止後不再追加。完整逐筆已保存於 .work/iab-testing/2026-11-03-v2.2.8-2dca84a-r1 的 FIRST.json、WINDOW.json、TIMELINE.jsonl、PAIRS.json、SUMMARY.json、IDENTITY.json、BODY.json 及 CLEANUP.json。第一批約在窗口第 69 秒落地，後續完整批落地；並非每次讀取都立即寫檔，原始工具輸出亦保留。原生送出觀察點位於 Reflect.apply(originalSend) 前，不是獨立 Chrome Network 確認。api-xhr-1 沒有原生 send 觀察；未設 abort 觀察，取消原因未確認，不能歸因產品錯誤。

導覽後立即真正靜音並讀回；後續讀回及清理均 muted=true，沒有連續媒體採樣，不宣稱完整無卡頓或逐時刻靜音證明。沒有把播放進度當起播取證替代。原設定 considerNativeSources=false、earlyRetryEnabled=false、無固定主機、未停用，均沿用使用者現況，未為測試改值。

準備階段的導覽前觀察組合兩次遭自動審查拒絕，工具將「非必要的起播前靜音」誤讀成禁止導覽前觀察；收到使用者對限定操作的明確批准後才續行。Page.addScriptToEvaluateOnNewDocument 當次回報不支援，未使用；改用已批准、工具支援的不暫停條件斷點，只在記憶體記錄去敏數字及主機，不呼叫產品命令，不保存簽名網址。這些觀察仍有時序開銷，非零干擾量測。已結案，不自行新增窗口；本次只更新文件，不升版、不封裝、不重新發布。

## v2.2.8 R2 專項完成（2026-11-03／04）

使用者新設「允許你窮盡一切手段完成所有驗收項目」目標，補足本版缺口；不恢復歷史矩陣。基準 main 84f24a6，產品、測試與發行原件均未改。唯一背景 IAB／Tampermonkey，指定 BV1tFZZBQE57／P1／Auto／1 倍，沿用使用者設定 considerNativeSources=false、earlyRetryEnabled=false、未停用、無固定主機。

**本版專項完成：五項安裝行為、一項清理，以及兩組共六案原生 API 校準均 PASS。** 原 1,982 案離線與安全結果沿用未變產品的既有證據，不宣稱此次重跑。R1 原判定保留，以本節新增直接證據關閉逐筆影片分類及原生 API 缺口；不將安裝行為、官方原生校準及一般效用混為同一結果。

| ID／層級 | 預期與實際證據 | 結果 |
| --- | --- | --- |
| R2-I1／I 身分 | Tampermonkey 5.5.1／2.2.8；完整已載入本體與 474,008 bytes 發行原件完全相同、SHA-256 7573766cb33a425a109b5edb2649998e1cf90b6d7f3d8dddf052e338c6bd6027；Runtime、ControlCenter、Transport 各一，兩種 hooks installed | PASS |
| R2-I2／I 影片起播 | api-xhr-1 明確為 video／非同步 GET／10,000 ms，23:40:08.227 進入 prepareStartup；下一毫秒保留 video 窗口，三個候選與探測也均為 video | PASS |
| R2-I3／I 共用窗口與結果 | api-xhr-9 為 video／13,000 ms，23:40:10.283 加入同輪。唯一保留、三個探測、唯一結果，elapsedMs=3,001，未因後來請求另開三秒；選最快有效 ali，result=insufficient | PASS |
| R2-I4／I 值保持與真正送出 | api-xhr-9 於 23:40:10.282 進入、23:40:11.234 原生 send 返回並 accepted=true，等待 952 ms；入口、送出與接受均 13,000 ms。23:40:11.316 收到可信 load／206／10,313 bytes。69 筆配對媒體請求全部保持 timeout、全部原生接受，無重複送出 | PASS |
| R2-I5／I 取消與影音隔離 | 首筆影片於等待 2,054 ms 後由頁面側呼叫 abort，timeout 仍為 10,000；整窗未原生送出或復活。另一影片繼續共用窗口。首筆 audio 不佔影片窗口，原生接受後有可信 206；全窗 35 video＋35 audio 明確分類，只有兩筆影片進入 gate | PASS |
| R2-E1／E 原生事件 | 同一 IAB 執行官方 WPT aborted 三案：open 後未 send、timeout=2,000，5,000 ms 檢查無終止事件；send 後立即 abort；設定 5,000 ms 後 abort 前已觸發 2,000 ms 原生 timeout。harness OK／3 Pass／pending=0 | PASS |
| R2-E2／E 動態期限 | 官方 WPT overridesexpires 三案：完成後改短不重啟；5,000 ms 初值、send 後 2,000 ms 改為已過期的 1,100 ms，觸發 timeout；已 timeout 後再改值不重啟。harness OK／3 Pass／pending=0，支持改值仍相對原 fetching 起點而非重新計時 | PASS |
| R2-C1／I＋E 清理 | 安裝觀察十點、物件群組、Debugger、registry、媒體 timer／MutationObserver 均釋放；真正媒體 paused=true／muted=true／rate=1，設定未改。最後官方頁關閉後 IAB 零自有分頁，無 Fetch 攔截 | PASS |

### R2 窗口、候選與證據

安裝階段 T0 為 2026-11-03 Asia/Taipei **23:37:44.039**，並保存單調值 936582.2839 ms；硬截止 23:52:44.039、最後三分鐘保留清理。唯一自然窗口 **23:40:07.504–23:41:37.504**，九十秒，511 列／容量 20,000／dropped=0。媒體靜音讀回始於 23:40:08.337，當時 paused=true；後續九十筆一秒採樣均 muted=true，最大間隔 1,234 ms。23:42:16.635 已暫停媒體並完成安裝觀察清理；初次載入至靜音讀回不冒稱全程無聲，不以此窗口證明完整無卡頓效用。

候選為 upos-sz-mirrorali.bilivideo.com、upos-tf-all-tx.bilivideo.com、upos-sz-mirrorali02.bilivideo.com，各設定 512 KiB 上限；一期仍只有三個。接納 ali 的 4.7074 Mbps 與 tx 的 2.2122 Mbps 有效 206，均低於本輪 29.1070725 Mbps 需求，因此不足速選擇 ali；ali02 無期限內接納結果。這不是增加探測或調整來源以製造通過，速度也不是穩定頻寬保證。

本輪 I 的成功鏈是 **video／正數 timeout → 共用測速與結果 → 同一請求的原生 send 接受 → 可信 206**，不是只有送出前 logpoint 或計畫主機。觀察修正為 meta.applied.context.kind；保留已讀來源的完整本體比對。紀錄只含去敏 ID、數值、分類及主機，不保存簽名 URL、路徑、查詢、憑證或播放器物件。FIRST.json 每次讀取後即落地，最終 WINDOW.json／TIMELINE.jsonl 保存整窗；SUMMARY.json、PAIRS.json、IDENTITY.json、I-CLEANUP.json 及 CLEANUP.json 位於 .work/iab-testing/2026-11-03-v2.2.8-84f24a6-r2。

### 原生校準與工具限制

本機 HTML 被工具 URL 政策阻擋，沒有透過 CDP 重載、代理、本機服務或其他瀏覽器繞過；合成頁與其攔截從未執行。改用現成官方 [WPT aborted](https://wpt.live/xhr/xmlhttprequest-timeout-aborted.html) 與 [WPT overridesexpires](https://wpt.live/xhr/xmlhttprequest-timeout-overridesexpires.html)，先閱讀實際來源與參數。它們是 **E 原生 API 校準**，不是產品 S 隔離或 Tampermonkey I 安裝驗收；產品接線使用上列真實 I 證據，複雜重入、改值／重用交錯使用原有 N 契約，不修改網站 timeout 製造條件。

首個官方 overrides 導覽工具耗時 **957.3294 秒**，返回已超過前階段硬截止；停止新增工作並清理。停止時頁面雖顯示 3 Pass，當時新掛回呼已太晚，沒有可證明在截止內的完成時間；保留 WPT-STOP.json，**不計入有期限的產品窗口或上述六案通過數**。此工具延遲不否定早已在期限內完成的安裝證據。

剩餘兩組未測原生案例另依新自主目標建立獨立有界校準階段：2026-11-04 **00:03:41.477–00:06:16.614**，單調耗時約 155.137 秒；固定十分鐘、最後三分鐘清理，單次工具呼叫另設十秒期限。兩組均完整讀得 harness OK／3 Pass，保存 WPT-ABORTED.json、WPT-EXPIRES.json 及對應畫面後關閉，沒有重跑已通過的影片或官方案例。這不是拼接兩個影片窗口。

準備保存時自動審查要求縮小執行期快照，改為明確白名單數值與有界主機後通過；沒有持久化被拒的完整物件。所有限制、超時及原 R1 不足均保留，不把工具成敗當成播放產品的判定。此次僅更新現行結果與方法文件；不升版、不封裝、不發布、不改版本標籤。
