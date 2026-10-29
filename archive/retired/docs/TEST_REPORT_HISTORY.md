# 歷史驗證報告

<a name="bilicdn_tw-v2118-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.18 BR-09 修復與發布驗證 — 2026-10-11

基準 v2.1.17／`7ad32efb6fba09300f61c333812642efc6acb6f5`；保留原有未提交的驗收文件。**BR-09 修復與 v2.1.18 正式發布通過**：正式契約、整合 verify、Chrome 來源隔離、安全差異及公開更新產物核對全部完成。更新後完整 v2.1.18 執行本體及同片 Auto1／2 基本回歸通過，與原生來源因果矩陣分列。詳見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR09_FIX_REPORT.md)。

## 先紅後綠與自動驗證

| 項目 | 本輪實際結果 |
| --- | --- |
| 原五正式契約，修改來源前 | 2 fail／3 pass；原失敗紀錄保留 |
| 新增 BR-09 正式回歸 | 25／25 通過，由既有 application 明確登記 |
| application／adapters | 256／256、102／102 通過 |
| npm run typecheck | 通過 |
| npm run architecture | 44 個 runtime 模組通過 |
| npm test | 19 套件／741 項通過；0 fail／skip／todo／cancelled |
| npm run verify v2.1.18 | 退出 0；741 契約、確定性建置、語法、v2-only、封裝及校驗通過 |
| git diff --check／staged check | 發行提交前退出 0；後續純文件變更另重查 |

工具 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2。私有證據 `.work/functional-fixes/br09/2026-10-11-7ad32ef/` 保存 before-contracts、expanded-contracts、all-tests、typecheck、architecture 與原生來源矩陣。修復前紅燈不計入完整測試綠燈，正式套件不匯入調查目錄。

## Chrome 來源隔離

真正 Chrome 原生媒體／WAV Blob，在自有 iframe 分開核對實際 playbackRate 1／2；未知正值→0、未知正值、公用 seek 到 0 及未改變目標，每速各四項，共 **8／8 通過**。四項原生邊界另 **4／4 通過**。SDK／核心／時鐘為受控模型，媒體 getter 保持原生，並未以此宣稱安裝 singleton 故障驗收。較早未明確設 defaultPlaybackRate 的校準紀錄保留；最終採 `chrome-source-rates.json`。iframe、影片及 Blob 清理，沒有 CDN 探測或學習寫入。見 [瀏覽器紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.18_ACCEPTANCE.md)。

## 獨立安全差異審查

Codex Security `ad0243d6-46b4-4245-a78e-1a1e8cc58f9c` 於 **2026-10-10T19:07:25.298326Z** 封存，**3／3 來源／測試差異項、0 候選／0 發現**。覆蓋 PlayerAdapter 所有實際差異、25 案 fixture 及正式登記；獨立架構模型與 Recovery／Monitor／Routes／Vault／儲存／診斷邊界作支持，不宣稱全儲存庫審查。

凍結三檔 SHA-256 保存於私有安全摘要；後續版本／文件／產物變更與此範圍分列，發布前重查三檔雜湊。安全審查不包含於 verify，機器封存不公開個人絕對路徑。

## 發布與安裝判定

[v2.1.18 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.18) 於 **2026-10-10T19:13:23Z／2026-10-11 03:13:23（Asia/Taipei）** 發布。發行提交、發布時遠端 main 及 peeled tag 均為 **`1de7851a3ae5499423e34390dd0a7ebdc6f278bc`**；annotated tag ref **`6e9cd1fc334aa12193cca8cbbbe41f87618743d4`**。後续純文件提交使 main 前進，不改發行標籤與 Release 快照。

唯一附件 **BiliCDN_TW.user.js，334,747 bytes**；SHA-256 **`812fa114b1b99d0a38f4d1df9622bce416147b05c048693d68ce4b24b16831c9`**。**2026-10-10T19:13:46.8251059Z** 無認證公開 latest 下載核對 v2.1.18、大小、雜湊及完整產物相同（exact=true）。封裝時的 TEST_REPORT 保存發布前快照，不回寫。

發布後首輪 **19:14:49.220Z** 仍 exact v2.1.17 的不通過（版本前提）保留。使用者更新後，同一指定影片 **2026-10-10T19:17:48.347Z** 完整 v2.1.18 IIFE **328,497 字元**與發行本體相符，matchingScripts=1、無截斷／未讀事件。唯讀實際 Hook 閉包／prototype 查詢確認 Runtime／ControlCenter／PlayerAdapter 各 1；沒有新增公開橋接或更換控制器。

**新版正常 Auto1／2 基本回歸通過**：各自時間與影格前進、UI 暫停／恢復及公用 SDK 約 5 秒短 seek 後繼續播放，reloadCount=0／recovering=false／無 mediaError。1 倍初次速度由實際 SDK 設定（原 UI locator timeout 保留為工具紀錄），2 倍選單由真正 UI 選擇；兩速皆補齊 UI 暫停／恢復。短 seek 是實際網站 SDK，不冒充可信指標／鍵盤操作或故障中所有權矩陣。原缺陷的原生 Blob 因果矩陣仍是來源隔離；沒有在網站 singleton 製造完整未知目標歸零故障。

BR-01 v2.1.17 [整體不通過判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)保留，本輪不重跑全部 BR-01 或把其餘證據空缺當已修程式缺陷。

## 限制與歷史導覽

完全在兩次觀察之間完成、沒有 SDK 或媒體事件可見的原生位置往返，不能由有限採樣可靠辨識。未知目標只撤銷位置還原、不取得 userRevision、不延長原期限。Auto／ABR、15／30／15 秒、route／Vault 權限、影音隔離及 schema 2 保持既有契約；原 87.785 秒自然網路起因獨立未定位。

<a name="bilicdn_tw-v2117-release-verification--2026-10-11"></a>
<a name="bilicdn_tw-v2117-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2116-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>
<a name="歷史驗證導覽"></a>

- [v2.1.17 完整正文與最後二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2117-release-verification--2026-10-11)
- [v2.1.16 及更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
- [BR-09 原始失敗報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md)

## 2026-10-11 換版保存：v2.1.17 完整正文及 BR-09 原失敗

以下保留換版前完整正文、原日期、數值、錨點、發布與安裝限制。換行依文件工具處理；原始位元組副本 SHA-256 `30e8496681b5235931ba0bef478bdb817def575bac2746a098e8a2a264ee2537` 另存本輪私有證據，不宣稱封存檔逐位元組相同。

<a name="bilicdn_tw-v2117-release-verification--2026-10-11"></a>
<a name="bilicdn_tw-v2117-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.17 修復與發行驗證 — 2026-10-11

**同版最後安裝判定：BR-01整體不通過，本輪判定完成。** [完整二元矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)記錄Auto2完整15／30／重載後15秒通過、單次實際重載及退出後不重試；Auto1完整期限與其他不通過項目的前提／證據原因分列。新版實際XHR與原生8／8對照通過，6／6自有描述子還原、訂閱／timer／攔截清理，123個已分類受控ID記憶體／持久零匹配。BR-09未修；本輪僅瀏覽器、文件及私有證據，不重新執行716套件或verify，不增加新的安全核准。下文是發布及較早續測的原始證據，未定用語只描述其當時狀態。

**同版續測新增未修復 P2 [BR-09](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md)：** 未初始化媒體的歸零目標可能被舊保存位置覆寫。獨立Node2 fail／3 pass，Chrome原生Blob來源隔離1個正確契約失敗／3個正常對照通過；不是正式716案例的重新執行或修復綠燈。來源、正式登記及Release未變，本輪沒有新增verify／安全核准。安裝版Auto1／2延遲子集与未定网站回退、完整矩陣剩餘範圍見[最新安裝紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.17_ACCEPTANCE.md#2026-10-11-續測與-br-09)。下文發布驗證保持原始事實。

基準 **v2.1.16／1e376978c757c0a1e622668fd04fdaad658dc7ef**，開始時工作目錄乾淨。本輪 v2.1.17 **修復、必要整合檢查、安全差異審查及 Chrome 來源隔離已通過，00:31:14（Asia/Taipei）正式發布；實際新版正常 Auto 1／2 倍及自有重載恢復取得部分通過，完整安裝驗收仍未完成**。修復 [BR-01 自有 reload 過渡與操作所有權](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_FOLLOWTHROUGH_FIX_REPORT.md)，不改 Auto／ABR、15／30／15 秒、重載額度、breaker、影音隔離及 schema 2。

## 修復前因果證據

實際 v2.1.16 PlayerAdapter.reload 的 Auto 1／2 倍受控 SDK 方法窗口均觀察到同步原生 pause、同一媒體 coreId=0，之後新核心初始化、自行整秒 seek 並 play。這是手動呼叫方法的語意校準，**沒有 Recovery token 或故障注入，不能算自動救援驗收**。Auto 2 首批 Network 截斷保留；Auto 1 另有完整連續方法窗口。BODY 可信 Space 的 pause／resume 已改變 paused，但 userRevision 都未改變。

新正式端到端六契約使用真正 Adapter／Monitor／Recovery／Runtime／Routes／Vault：修來源前 **3 fail／3 pass**。網站原先約 19～20 秒提前 pause／外部換核心仍只證明舊意圖撤銷，不能拿來宣稱完整逾時失敗或修改外部核心政策。原 87.785 秒自然網路起因保持待定位。

## 自動驗證與先行紅燈

| 證據 | 已保存結果 |
| --- | --- |
| 新紅燈前既有完整基準 | **637／637**；只代表 v2.1.16 基準 |
| 原正式六契約，執行期來源未改 | **3 fail／3 pass、退出 1**，sourceBefore／After 相同 |
| BODY 操作原 30 契約，Player 未改 | **10 fail／20 pass、退出 1** |
| 擴充 owned proof 紅燈 | **15 fail／28 pass**，含上述 30 項，不重複加總 |
| 方法邊界追加 | **3 fail／1 pass**：描述子／繼承清理、then getter 回傳相容 |
| 準備同步重入追加 | **3 fail／0 pass**：新使用者命令與舊讀取不得覆寫新 owner |
| 進度所有權追加 | **1 fail／1 pass**：已完成 seek 不算實際播放前進 |
| 終止後 SDK resume 追加 | **1 fail／1 pass**：同操作無進度不得重新建立救援 |
| Player 本輪局部修復 | 新增 **50／50** 正式案例；當次 adapters **102／102**、typecheck 及 diff 檢查通過 |
| application 最終交叉 | **231／231**，包括來源反證的正式修復契約 |
| 最終 typecheck／architecture | **通過**；architecture 檢查 **44 個 runtime 模組** |
| 最終 npm test | **19 套件／716 項全部通過**；沒有 only／skip／todo／cancelled 或預期失敗 |
| 最終 npm run verify（v2.1.17） | **退出 0**；完整契約、確定性建置、語法、儲存命名空間及封裝校驗通過 |
| 最終 git diff --check | **退出 0** |

修復前失敗是正確契約紅燈，不能加進完整測試通過。具名 node:test、testScope、FakeClock、deferred 與型別化 DOM／SDK 模型均在正式套件；沒有把調查目錄作測試輸入。Node 可信事件替身只建立派送模型，真正可信輸入另由 Chrome 驗證。

私有證據目錄 `.work/functional-fixes/br01-followthrough/2026-10-10-1e37697/`，包括 application/formal-red、progress-owner-red、late-sdk-resume-red、player/各階段紅燈與 evidence/CAUSAL_REPORT.md；`tests-final.txt`、`verify-final.txt` 保存最終整合結果。工具基準 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2。本輪最終結果為 716 項，不沿用 v2.1.16 的 637 項；發行產物與公開 latest 已核對，實際安裝結果另列。

## Chrome 來源隔離

首輪 `source/time-boundaries-first.json` 在自有 iframe 的合成媒體／FakeClock，**1 倍與 2 倍均符合** 14,999／15,000、29,999／30,000、重載後 14,999／15,000 ms；每段一次備援、一次重載、reload-timeout 釋放，後續三 tick 沒有再重載。沒有來源網路請求，非安裝 singleton，也不等於網站 Auto／ABR 端到端。

首輪 `source/restore-first.json` 發現：SDK 初始化 seek 後已有實際時間／影格前進，等待確認時再多一次路線備援。另一獨立反證發現第一個有效進度在 owned lease 到期前、第二個跨到期時會被舊 seekRevision 撤銷。**兩項同範圍缺口均已補正式契約並修復，最後來源矩陣通過；原未通過記錄保留。**

最後來源隔離 **22／22 通過**：**12 個控制模型、10 個真正可信輸入**。自有 iframe 使用合成媒體／FakeClock；真正可信 BODY Space、ArrowDown、指標、seek 及 editable 排除與模型結果分列。指標按住 31 秒是模型時間，不能計為安裝網站實際 31 秒故障窗口。原「owner-replace」預期經校準屬合法第一核心採用，該窗口不計失敗；以 `final-second-core` 驗證第二核心替換撤銷。不得把原生 SDK 手動方法窗口與 Controller 自動救援合併計分。

來源 bundle SHA-256 **`6c8d1caca5c0c1d23a406c5ec54b1dada4ddecde7b66106b8b05593cd938536e`**。最後清理讀回 timers=0、rootRemoved；自有來源分頁已關閉，127.0.0.1 驗證 helper 已停止。沒有安裝 singleton 或真 CDN 故障驗收，來源隔離不能替代新版安裝矩陣。

## 獨立安全差異審查

Codex Security 差異掃描 **`39e2743e-185d-4c7d-a04d-f6580e61385a`** 已封存：**11／11 檔案覆蓋、0 候選、0 發現**。範圍涵蓋 own reload／核心／使用者所有權、同步重入、授權／政策重查、晚到 Promise、可信輸入及方法／計時器清理；安全結果與 npm run verify 分開。

最終四份 runtime 雜湊與掃描時一致。宿主曾回報工作目錄變動，故不宣稱整體 snapshot 始終不變。三份版本 JSON 在掃描後更新為 v2.1.17，屬安全掃描外的版本變更，由主代理另行核對；配置後四份 runtime 雜湊再讀回一致。機器報告保留私有，不公開個人絕對路徑。既有 v2.1.16 安全掃描不作本輪結果。

安全宿主的 `codex_rollout` 工具統計涵蓋5個執行緒：total 16,413,173 tokens、input 16,348,140（其中cached input 15,788,416）、output 65,033（其中reasoning output 14,919）。快取數包含於輸入，不另加總；這是工具回傳的執行緒統計，不推算成單次掃描新增用量或費用。

## 發布與實際安裝驗收

[v2.1.17 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 於 **2026-10-10T16:31:14Z** 發布，即 **2026-10-11 00:31:14（Asia/Taipei）**。發行提交及遠端 peeled tag 均為 **`1b87d3f759e479e67650e291b5a8d8f107102145`**，發布時遠端 main 相同；annotated tag ref 為 `87109266a5044055dffae653000f376ca6f0c80c`。

Release 唯一附件 **`BiliCDN_TW.user.js`，332,575 bytes**，SHA-256 **`4bb4601a91e5e752595a5a8ec1b4d8905036954f299d578ca93209c059ce6a06`**。**16:31:40Z** 無認證公開 latest 核對 v2.1.17、大小、雜湊及完整產物相符（exact=true）。v2.1.16 產物與 v2.1.17 發布前封裝快照不回寫；發布後現行文件提交可使 main 前進，發行標籤仍指向上述發行提交。

**16:32:42.615Z** 指定同片仍 exact v2.1.16 的原觀察保留。更新後 **16:34:48.957Z／00:34:48.957（Asia/Taipei）** 已核對 v2.1.17 實際完整 IIFE（329,134 字元）與 Release 執行本體相符，唯一 Runtime／ControlCenter；版本身分與公開下載核對分開取得。

新版已開始部分驗收，只使用指定風景影片 Auto 1／2 倍；完整狀態見 [v2.1.17 Chrome／Tampermonkey 驗收紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.17_ACCEPTANCE.md)。

| 實際新版子項 | 取得的證據與限制 |
| --- | --- |
| 正常 Auto 1／2 倍 | BODY Space 暫停／恢復、鍵盤短 seek 均取得新使用者修訂，後續時間與影格前進；沒有將正常 ABR 調整判成缺陷 |
| Auto 2 自有重載恢復 | 後段獨立停滯由 Recovery 自動 reload 一次，累計 reloadCount=1；同步 native pause／null 後接納標記核心、rate2／play、實際進度後 recovered。保存1516.967991，SDK新目標1516，Adapter.seek=0 |
| Auto 1 自有重載恢復 | 另一停滯由 Recovery 自動 reload 一次，累計 reloadCount=2；SDK新目標1836，未回寫保存1836.172853，rate1／play、實際進度後 recovered。直接方法／core事件有效；歷史 everDropped 與 Network 截斷不計完整故障時序 |
| 原 Auto 2 受控長窗口 | 網站先 pause／外部核心替換撤銷；之後一般播放及更晚自有重載分開，不回填完整15／30／post15。Network 未連續pump、未知分類放行及後段覆蓋缺口保留 |
| Auto 1 兩次12秒嘗試 | 一次未提交 seek，一次進度列 locator timeout；均不計受控延遲通過 |
| 最終清理／受控樣本 | 12／12 工具描述子持有且完整還原、timer清除、live XHR=0／observerFaults=0／held=0／patterns空；已知2,027 request ID記憶體／持久零匹配、unclassified=0，四分類hook持有。startup／challenge均0，historical everDropped保留，不補未知／未觀測歷史 |

以上沒有確認新功能缺陷，亦不等於 BR-01 全面結案。有效完整15／30／重載後15秒失敗釋放、12秒 video-only、真正 hidden、真正 pending singleton gate、新操作／晚到 SDK 完成及拒絕、生命週期／政策／影音隔離完整矩陣仍待取得。控制方法 Promise 邊界、原生媒體進度與學習零匹配分列；網站提前 pause／error／外部換核心、截斷窗口及缺少自然前提不能算完整通過。

私有安裝證據包括 `installed-v217-identity.json`、`installed-normal-auto2-*`、`installed-normal-auto1-controls.json`、`installed-auto1-sdk-followthrough.json`、兩個12秒窗口與 `installed-review/auto2-long-stall/`。觀察器單一游標、真正ID學習抑制及包裝所有權的限制保留，沒有修改產品 getter／clock／controller 製造前提。

`installed-cleanup.json` 保存 **16:56:37.369Z** 清理及原 postcheck 因錯讀 `deps.runtime` 的 TypeError；這是工具查詢錯誤，不刪除或冒充產品例外。`installed-cleanup-postcheck.json` 在 **16:57:30.601Z** 另行正確核對觀察器 entry 不存在、generation1／epoch0、Auto1／readyState4／paused=false／位置2225.339652。最後風景截圖 `installed-final-auto1.png` 的控制列隱藏，Auto／倍速由獨立 DOM 讀回支持。

<a name="歷史驗證導覽"></a>

## 歷史與剩餘限制

原自然網路原因、真背景工具限制、同片自然內容生命週期／實際 singleton gate 前提與其餘完整產品驗收仍獨立。沒有有效 cid 及共同路徑時維持保守重設。不能用無限制放行 paused、猜測 SDK 取整位置或延長所有 lease 來掩蓋所有權。

上一版完整正文逐位元組保留，原日期、錨點、發布校驗、部分安裝結果與 Network／observer 缺口不改寫。原 SHA-256 `829ec0af4b26d95be2f16176aaa816bc8cd645f3e32143a99a97863d35040228`，正文 11,474 bytes，歷史檔只新增、不刪舊內容。

<a name="bilicdn_tw-v2116-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.16 完整正文與部分安裝驗收](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2116-release-verification--2026-10-10)
- [v2.1.15 完整正文與 BR-08 調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2115-release-verification--2026-10-10)
- [v2.1.14 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2114-release-verification--2026-10-10)
- [v2.1.13 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

---

本文件於 2026-10-06 自 `docs/TEST_REPORT.md` 搬入 v2.0.2～v2.1.7 的十二個主要紀錄區塊，包括發行前模組化驗證。英文正文、順序、日期、數值與當時的 pending 敘述保留；僅按位置調整 Markdown 連結。原文的 current release、first section 等用語保留其原報告脈絡；歷史狀態只適用於記錄當時，不構成目前待辦。

現行入口：[最新版驗證報告](../../../docs/TEST_REPORT.md)、[文件索引](../../../docs/INDEX.md)、[工作狀態](../../../docs/TODO.md)。封存配置見 [封存索引](../README.md)。


## 2026-10-10 換版保存：v2.1.16 完整正文與部分安裝驗收

以下原文保留 v2.1.16 日期、原錨點、637 正式案例、發布校驗、部分安裝驗收及原始限制；「本輪未確認新缺陷」只描述當時的驗收範圍。後續 BR-01 自有 reload／BODY 操作因果複核及修復見 [最新版報告](../../../docs/TEST_REPORT.md)。歷史 Release 與安全封存不改寫。

<a name="bilicdn_tw-v2116-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.16 修復與發行驗證 — 2026-10-10

基準 **v2.1.15／f0c2d39**，開始時工作目錄乾淨。BR-08 完整拖曳契約已完成本機修復：進度列外層及其子節點取得立即保護，私有手勢核對指標／媒體／播放器／內容所有權；可信失焦與真正 hidden 在既有事件 guard 阻擋前通知 PlayerAdapter。Monitor 三個救援入口與 Recovery token 建立均拒絕 dragging，提交前重查最新資格。Auto、15／30／15 秒、重載額度、breaker、影音隔離、公開 API／應用層快照與 schema 2 保持原契約。

**BR-08 修復與 v2.1.16 發布完成；正式／安全／Chrome 來源隔離及公開產物核對通過。新版完整本體與 singleton 已核對，Auto 1／2 倍拖曳保護、正常播放及約 12 秒延遲恢復取得安裝證據；BR-01 完整安裝矩陣仍未完成。** 詳見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR08_FIX_REPORT.md)、[新版安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.16_ACCEPTANCE.md)。v2.1.15 原失敗及歷史 Release 保留，不將舊版或模型結果計為新版安裝通過。

## 自動驗證與先行失敗契約

| 項目 | 結果 |
| --- | --- |
| 原七個正式契約，未改執行期 | **3 fail／4 pass、退出碼 1**；原紅燈與來源 SHA-256 另存，不計入通過 |
| 擴充 application 紅燈 | 28 個：21 fail／7 pass；最終 controls 同步重入補充為 2 fail／0 pass |
| adapters 紅燈 | 25 個：16 fail／9 pass；早期指標重入補充為 2 fail／2 pass |
| 最終 BR-08 正式案例 | **63／63 通過**：application 34、adapters 29；原七個包含於其中，不重複加總 |
| typecheck／architecture | 通過；**44 個執行期模組** |
| npm test | **19 套件／637 個正式案例通過**，無 only／skip／todo／cancelled／預期失敗 |
| 最終 npm run verify（v2.1.16） | 通過：637 案例、確定性建置、語法、v2-only、暫存封裝 checksum |
| git diff --check | 通過；發布文件整理後再核對 |

具名契約由既有 application／adapters 明確匯入 functional-races/br08.ts／br08-player.ts，使用 testScope、FakeClock、deferred 及型別完整的指標／事件邊界。closest 只搜尋祖先；可見性整合包含真正 VisibilityAdapter guard。正式測試不匯入 .work/。其他套件與 BR-02～07 交叉回歸包含於全套，沒有另增測試登記。

證據目錄 .work/functional-fixes/br08/2026-10-10-f0c2d39/；初始提交 f0c2d39fc9af64eecdc67b2b734b956905bae482，Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2。無效的多套件 CLI 呼叫退出碼 2 單列，不算測試失敗或通過。紅燈、局部綠燈、整合與最終版本 verify 分開保存。

## 獨立安全差異審查

最終 Codex Security 差異掃描 **25cfd1fe-bfd4-425c-a105-2976799c04b8** 已於 **2026-10-10T12:54:19.753947Z** 完成、封存並讀回。不可變快照摘要 eb363339baed391b074ba8ab6e995e058c7ec69d72cf205c1780ac06b3b7ca0c，**14／14 差異面完整覆蓋、0 可報告發現、無未處理候選或延後面**。兩個獨立工作者分工來源／測試，主代理核對版本設定、架構及相關授權／生命週期邊界。三項 preflight 通過；Daybreak Blue granted，模型 gpt-6.1-sol／ultra。

涵蓋可信輸入、同步重入、通知／手勢與恢復所有權、清理、資料輸出。政策 resolver 誤報既有根目錄不存在；直接讀 root SECURITY.md 並確認沒有巢狀政策後完成。保留既有 VisibilityAdapter 描述子還原限制，不宣稱本輪擴修。最終六份封存檔逐檔 SHA-256 相同匯出至本輪 security/final/；封存原件不修改。

較早的 9c437e78-50d0-4748-aba5-7d500aed2a4a 掃描已完成，但其後追加早期指標重入防護，**不是最終差異核准**；上列第二次完整掃描才對應最終來源。安全審查與 verify、瀏覽器證據分列。

## Chrome 來源隔離

最終修復來源在 Chrome 自有 iframe 取得 **31 個有效通過、0 有效失敗**。原始記錄共 33 份，2 個輸入校準窗口無效並明列理由，不加總通過。Debugger 完整已載入 bundle SHA-256 為 9c77ba0fa7bf7c5f0283f78e8d7f00ebe48d15dddf23d91796e56be0372bf0f1，與本機建置相同，沒有截斷。

真正可信滑鼠／觸控涵蓋 wrapper 自身／子節點、inner、舊版、slider、區域外排除；1／2 倍模型按住 31 秒無救援，放開位置 0 重新取得精確 15／30／15 秒並觀察三 tick 不重試；冷起播按住不消耗嘗試，釋放沿用原 firstMediaAt；舊 token 撤銷、雙指標取代與舊指標釋放、真正 lostpointercapture、原有 blur guard 前通知及失敗 listener 隔離、放開移出命中區與所有權替換。

媒體與 FakeClock **僅在自有 iframe**；Route／Measurement 使用受控介面，沒有 GM、學習資料或真實 CDN 探測。這是修復來源組合，不是網站 Auto／ABR 或安裝 singleton。真正 hidden、任意同步 getter／nested 邊界的完整證據仍為正式契約，沒有冒充現場通過。兩個無效校準分別為第一次 CDP touchEnd 結束錯誤指標與滑鼠未產生捕捉遺失前提；真正雙觸控及可信觸控 lostcapture 的新前提案例通過。

清理核對 timer 0、subscription 0、方法及 hidden／visibility 描述子還原、自有 DOM／API／iframe 移除、來源分頁關閉、本機伺服器停止。私有 source/chrome-results.json、chrome-summary.json、chrome-loaded-identity.json、chrome-proof.png 分列結果、身分與清理；不代表安裝版故障過濾／樣本清理。

## 發布與安裝版

v2.1.16 於 **2026-10-10T13:05:38Z（Asia/Taipei 21:05:38）** [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.16)。發行提交／peeled tag `ff0cb07063032aeb49a9e52ccc630685bec46cf8`，標籤物件 `0dc8c0590ad3a63282c029fdc0d2e3ab56c1bbbe`；發布時遠端 main 一致。唯一附件 `BiliCDN_TW.user.js`，**320,794 bytes**，SHA-256 `5eaeb8444503886244b06f81cb24a81081720a0ea5dcb978c284c776eb05e8d4`。**13:06:11.073Z** 無登入公開 latest 讀回版本、大小與雜湊匹配。發布後文件更新不改發行標籤或 Release 快照。

[新版安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.16_ACCEPTANCE.md) 於 **13:11:07.331Z** 核對已載入的完整 body 與 v2.1.16 匹配、沒有截斷，ControlCenter／Runtime 各 1，實際 Fetch／XHR hooks 與共用控制器／ID 來源一致。只用指定風景影片 Auto 1／2 倍；每次同片刷新重新取得身分。

| 新版實際安裝項目 | 證據與結果 |
| --- | --- |
| wrapper／inner × Auto 1／2 | 四窗主連續記錄 32.116～32.212 秒；初始 nonpaused seeking／低緩衝，已命中手勢全採樣 dragging=true，無新增 route／core action，reloadCount 0，可信釋放 false |
| 正常播放／暫停恢復／短 seek | 1／2 倍分開，實際時間與影格前進、無核心重載；正常 Auto 解析度變化不列缺陷 |
| 約 12 秒 video-only | 1 倍窗口 hold 12.215 秒＋20 秒連續尾段，2347.898058→2361.768725 秒／24540→25439 影格、healthy／recovered；2 倍 hold 12.129 秒＋15 秒連續尾段取得進度、獨立後續觀察 recovered；audio 通行，各有一次合法 15 秒備援、兩窗重載 0 |
| 學習與記錄完整性 | 主窗口沒有截斷／dropped／pump errors；四拖曳窗確認 IDs 24／24／24／12，延遲窗累積 10，memory／persisted 0 匹配、unclassified 0；沒有受控 startup／challenge 工作，不冒充真 gate 樣本驗收 |
| 既有原線對照控制 | false→true→false 精確復原、generation／epoch 不變、播放時間前進／重載 0；無有效 token，不計帶動作政策撤銷 |
| 實際 XHR／原生 Blob 對照 | **33／33 對通過**、66 次執行／588 完整事件；BR-02 原生所有權、例外、同步／終止事件重入及 text/json 子集；首次 32／33 的原生同錯測試期待校準保留，非產品缺陷 |
| 最終工具清理 | 14:09:11.153Z body／singleton／共用控制器再核對；patterns 空、held 0、方法完整描述子還原、timer／live XHR observers 0、observer 遮蔽移除；10 個受控 IDs 記憶體及持久零匹配，設定精確復原 |

四拖曳窗網站在約 19～20 秒 paused／外部核心替換，不能計完整 30 秒重載與重載後 15 秒退出。前三窗 32 秒後有 42～50 秒 Network 讀取空檔，不宣稱整段持續處理；第四窗 12 個 start 中只保存 11 個腳本 completion，最後一筆以原生 Network canceled 收束，不補造腳本事件。2 倍延遲的首次進度與後續 recovered 間 Network 空檔 73.179 秒、重接首批 truncated=true，僅後續獨立媒體狀態可用，不計完整連續窗口。詳列原始檔、逐窗限制及清理於安裝矩陣，不因工具清理倒寫歷史缺口。

<a name="歷史驗證導覽"></a>

## 剩餘限制與歷史

BR-08 修復與發布完成，安裝矩陣已有上述部分通過。13:07:51.193Z 更新前舊版身分仍保留於 installed/update-prerequisite.json；13:11:07.331Z 起使用實際新版計分，兩者分列。完整 15／30／15、新操作／晚到 SDK 與位置還原、帶 token 的生命週期／政策／影音隔離仍待有效前提。真正背景工具阻塞，原生 hidden=false 不算背景；實際 singleton gate 因網站顯式 XHR timeout 而 skipped，不能算 BR-04／05 pending gate。網站提前 pause／error／外部換核心、事件截斷或缺失只證明列明的撤銷，不算完整期限，沒有新前提不重複同樣失效窗口。原 87.785 秒自然網路起因、缺少有效 cid 且無共同路徑時的保守重設及其他產品完整驗收仍獨立。本輪安裝窗口未確認新功能缺陷。

另有一次 Auto 新表示附近位置 2913.218677→0.307 秒的未定位觀察，距原線對照復原 174.648 秒，沒有新腳本恢復／重載、core 或 epoch 改變。這不是已證實政策／腳本缺陷，亦不能用即時模式旗標復原代替完整播放相容。長時間後 observer 採樣達 2000 列上限，淘汰旗標為 true，關鍵事件仍保存；因果及 Network 缺口在安裝報告明列，不補算整段完整觀察。最後清理的 Network readback 截斷亦保留，不能回填先前時序。Blob 原生對照的資源清理與安裝故障觀察器清理各自保存，虛擬政策／媒體歸因／pending gate／cid 等子項沒有因此通過。

<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.15 完整正文與 BR-08 原始調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2115-release-verification--2026-10-10)
- [v2.1.14 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2114-release-verification--2026-10-10)
- [v2.1.13 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

---


---




## 2026-10-10 換版保存：v2.1.15 完整正文與 BR-08 調查追加

以下原文保留 v2.1.15 日期、原錨點、發布讀回及原始失敗；「BR-08 未修復」僅描述當時。現行修復與發布狀態見 [最新版報告](../../../docs/TEST_REPORT.md)。

<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.15 修復與發行驗證 — 2026-10-10

基準 **v2.1.14／9d98d09**。本輪修復 BR-07：網站右方向鍵在可信 keyup 派送才尋位，原 keydown 候選已失效，導致新命令沿用舊救援期限。PlayerAdapter 改為分別觀察 keydown／keyup，每次可信派送中的實際新 seek 取得一次使用者修訂；重複觀察去重，不建立按住狀態或延遲關聯窗口。Auto、15／30／15 秒、BR-01～06、schema 2 及公開 API 保持原契約。詳見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR07_FIX_REPORT.md)。

**BR-07 修復與 v2.1.15 發布完成；實際安裝版已有部分通過，新增 BR-08 未修、完整 BR-01 未結案。** 正式契約、最終 verify、獨立安全差異及 Chrome 來源隔離通過，發布時遠端 main／標籤／唯一附件與公開 latest 核對完成。使用者更新後，11:04:00Z 完整 v2.1.15 執行本體匹配、singleton 1；正常 Auto 1／2 倍鍵盤及新 15 秒寬限有證據。續測確認 [BR-08 進度列外層拖曳漏辨](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)，依新缺陷報告退出條件收尾，沒有擴修或宣稱全面驗收。原 v2.1.14 及更新前中途觀察保留。

## 自動驗證

| 項目 | 本輪結果 |
| --- | --- |
| 原五正式契約，修改執行期前 | **2 fail／3 pass，退出碼 1**；保存原紅燈紀錄，不計入通過 |
| 最小修復後原五契約 | **5／5 通過** |
| 擴充鍵盤／派送／控制器回歸 | **BR-06／BR-07 100／100**，分別 40／60 個正式案例 |
| typecheck／architecture | 通過；**44 個執行期模組**架構檢查通過 |
| npm test | **19 套件、574 個正式案例通過** |
| verify（升版前） | 通過；設定版本 **v2.1.14**，包括全套、確定性建置、語法、v2-only 及暫存封裝 checksum |
| verify（最終 v2.1.15） | 通過；574 案例、確定性建置、語法、v2-only 與 checksum 均通過 |
| diff check | 發布後文件差異檢查通過；13 份現行文件／新報告的 278 連結及 33 顯式錨點核對無錯誤，未新增執行期測試宣稱 |

正式回歸沿用 application 明確匯入的 functional-races/br06.ts；不匯入調查目錄，也不新增測試登記。替身分開建模事件種類與網站提交階段；可信事件模型不能替代 Chrome 原生輸入。最終正式執行不得留下 only／skip／todo／cancelled／預期失敗。

新證據目錄：.work/functional-fixes/br07/2026-10-10-9d98d09/。開始時提交 9d98d09d86f2a719556efccb7852c2e0e62d751e、工作目錄乾淨；Node 26.8.1／npm 11.19.0。原紅燈、最小修復、100 個鍵盤契約、整合 574 個及 verify-preversion 分開保存，沒有 only／skip／todo／cancelled／預期失敗。

## 獨立安全差異審查

Codex Security 差異掃描 **3e3d133e-7f39-4bf8-a0ba-d22d188a639a** 已於 **2026-10-10T10:51:13Z** 封存並讀回，兩個來源／測試差異檔及相關所有權邊界完整覆蓋，**0 可報告發現、無未處理候選**。三項 preflight 通過，Daybreak Blue granted；模型 gpt-6.1-sol／ultra，獨立審查約 10 分鐘。涵蓋可信派送、重入、腳本來源抑制、生命週期／動作所有權、清理及資料輸出。政策 resolver 誤報既有根目錄不存在，直接核對可讀 root SECURITY.md 且無巢狀政策後完成，不構成差異覆蓋缺口。封存原件不修改，逐檔雜湊相同的匯出位於本輪私有 security/。安全與 verify 分列，沒有宣稱安裝版通過。

## Chrome 來源隔離與安裝版

Chrome 修復來源隔離 **40／40 個有效案例通過**：真正可信 keydown／keyup、BODY／播放器焦點及 Auto 1／2 倍模型、八種 keyup、直接／停止傳播尋位、keydown／keyup 各自新 seek、位置 0、排除／方法相容、腳本還原、Event.NONE 延後及合成輸入、15／30／15 精確邊界與失敗後不重試。使用自有 iframe 的合成媒體／FakeClock，沒有修改網站 getter／控制器，不代替實際 Tampermonkey singleton。

`source/chrome-results.json` 共 42 份記錄，40 份有效 pass=true；初始校準觀察及 timer 尚未完成的無效觀察不列通過，後者已由 timer 收束的有效列替代，沒有確認新缺陷。800 ms 持鍵只產生 keydown／keyup 兩事件，**未證明原生 auto-repeat**；IME、nested 派送及媒體／播放器替換仍為正式模型證據，未宣稱完整 Chrome 覆蓋。清理後 browser／synthetic timer pending 均 0、seek／reload wrapper 已還原、自有 root 移除、iframe 殘留 0。

[v2.1.15 安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_ACCEPTANCE.md) 已取得實際完整 body／singleton 1；317,487 bytes 與公開 Release SHA-256 一致。更新前 10:59:19Z 仍 v2.1.14 的紀錄 installed/update-prerequisite.json 保留為歷史中途觀察，使用者完成手動更新後重新取身分，沒有操作或繞過擴充介面。正常 Auto 1／2 倍 BODY／播放器 Right／Left 各新增一次 userRevision，播放／暫停恢復有實際時間及影格進度；1 倍最後一次 player Left 保存時仍 seeking，未補算 settled。

約 12 秒 video-only 窗口，1／2 倍的實際 seek→release 為 12.075／12.169 秒，首次有效進度 17.863／21.985 秒；各一次合法 video fallback、核心重載 0、audio 通行。故障舊段後新可信 Right keyup，1／2 倍在新操作後 15.427／15.310 秒各一次備援；2 倍 30.309 秒一次自有重載。1 倍網站先外部換核心，2 倍重載後 paused，均未形成完整重載後 15 秒無進度退出／不重試前提。實際 BR-02 Blob／native 與本地 HTTPDNS 拒絕所有權子集通過；BR-03 及共用 startup gate BR-04／05 待驗收（實際 startup.state=skipped、reason=preflight-skipped:xhr-explicit-timeout、candidates=0、delayed=false；沒有重建 gate）。晚到 SDK 由網站先換核心、尚未到實際方法回傳；真正 hidden 387 採樣皆 false，必要前提未形成。

**新 BR-08，P2、未修復：** 10 px 功能性 wrapper 外圈未命中 4 px inner selector，可信按住期間 dragging=false，15.079 秒啟動一次影片備援；inner 故障按住超過 16 秒保持 dragging=true 且無動作。私有七個正確契約 **3 fail／4 pass、退出碼 1** 是未修來源的缺陷證據，與發布前 **574 正式通過**分列；30 秒拖曳重載僅模型證據，未宣稱現場成立。

最終 installed/final-cleanup.json 讀回 107 受控 IDs 記憶體／持久匹配前後皆 0、相符活 XHR 空、自有 observer／pointer／SDK API 已移除、send／證據包裝已還原、自有 iframe 0、held requests 0／patterns 已清，Network／Debugger／Runtime 觀察已關閉。SDK 繼承方法的工具草稿遮蔽另已清理，hasOwnReload=false／方法等於原型；未列為產品缺陷。清理前 Auto 2 倍實際 1979.88 秒／35714 frames；交接由網站原生控制暫停於 **2042.773843 秒、Auto 1 倍**。最終事件對帳有 98 starts／96 completions，11 IDs 缺 completion（9 無 start、2 有 start），不能宣稱 107／107 傳輸完成；歷史捕捉缺口未由最後活請求空值重建。晚到 tail 的截斷不作完整期限證據。

## 發布與公開更新核對

v2.1.15 於 **2026-10-10T10:57:18Z（Asia/Taipei 18:57:18）** [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.15)。發行提交／peeled tag `3f7c73335a58dd89d4bc8a4209b7ecf3c70acaf8`，標籤物件 `d838c3a804d4a5a55f4b7b931cdaf15f8476b745`；發布時遠端 main 一致。唯一附件 `BiliCDN_TW.user.js`，**317,487 bytes**，SHA-256 `affedbeef854462c60fd5fd68947fc4c37ef7ddb7bd2922e72fed6cca6b342bf`。**10:57:38Z** 無登入公開 latest 下載核對版本、大小及雜湊全部匹配，更新網址維持原位。發布後補驗收文件不改寫發行標籤或 Release 快照。

<a name="歷史驗證導覽"></a>

## 剩餘限制與歷史

每次 keydown、repeat 或 keyup 若各自造成新 seek，各自取得一次身分；沒有實際位置變化則不計數。同一派送結束後的 Promise／timer／網站重試不取得使用者身分，網站／Auto 的單純 seekRevision 重綁仍保留期限。pendingSeek 保守抑制腳本還原；無法可靠辨識來源時撤銷過期還原，但不猜測新使用者命令。

工具截斷、網站提前 pause／error／外部換核心只證明相應撤銷，不計完整逾時通過。原 87.785 秒自然網路起因、沒有有效 cid 或共同路徑的保守重設及其他產品完整驗收不因此結案。

<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.14 完整正文與 BR-07 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2114-release-verification--2026-10-10)
- [v2.1.13 完整正文與 BR-06 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

---

## 2026-10-10 換版保存：v2.1.14 完整正文與 BR-07 調查追加

以下原文保留 v2.1.14 的日期、原錨點、發布讀回、安裝失敗與限制；「BR-07 未修復」只描述當時。現行修復與發布狀態見 [最新版報告](../../../docs/TEST_REPORT.md)。

<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.14 發行驗證 — 2026-10-10

基準 v2.1.13／45a442071c93f20fa7aeb7dcecfb67c6ba66f526。本輪修復 BR-06 同一 keydown 派送內的鍵盤 seek 所有權；Auto、15／30／15、BR-01～05、schema 2 不變。**v2.1.14 已發布並核對實際安裝本體；右鍵 keyup 提交入口確認 BR-07，安裝版驗收未通過，完整 BR-01 未結案。** [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR06_FIX_REPORT.md) 與 [BR-07 詳細報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 分列原驗證範圍及新證據。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。原五正式契約先得到 2 fail／3 pass、退出碼 1，保存未修來源紀錄。最終 BR-06 40／40，全套 19 套件／514 正式案例，44 執行期模組與 43 非入口匯入純度通過；typecheck、architecture、npm test、verify、diff check 已通過。版本遞增後的最終 verify／封裝與 checksum 紀錄另存。沒有 only／skip／todo／cancelled／預期失敗。證據位於 .work/functional-fixes/br06/2026-10-10-45a4420/。

Node EventTarget 派送邊界與 Chrome 不同，替身已明確建模，校準失敗輪保留而不計入通過。正式 suite 不匯入調查目錄。原始 v2.1.13 未提交驗收文件已保留，上一版 TEST_REPORT 完整原文加入歷史報告。

## 獨立安全差異審查

Codex Security 60289fdb-632c-49af-9c37-e55c21464f59 已封存：7 個變更來源／測試檔完整覆蓋、0 可報告發現、0 未決候選。Digest：codex-security-snapshot/v1:sha256:dfa2dc8b2b4d27a3c3cc6b6910910255ee3d9757adfcb4b8de2a915ca4925028。獨立架構複核確認可信同派送關聯、媒體／生命週期、真正可見性、路線／核心／token 與清理控制。Windows 政策 resolver 失敗，根 SECURITY.md 已手動解析，沒有其他嵌套政策。來源保持受審 SHA-256；之後版本／文件變更不屬該安全快照，由主代理另核對。插件報告累計度量 5,628,537 tokens，含 5,312,128 cached input、3 threads；不是本次新增推理用量。與 verify 分開，不能擴大為全產品無漏洞保證。

## Chrome 來源隔離

15／15：真正 trusted BODY 按鍵、監聽器間原生 microtask（eventPhase 1）保留候選、1／2 倍模型的 15／30／15 邊界與不重試、直接 seek、停止傳播、Home 到 0、editable／Ctrl／合成／忽略／例外／腳本還原／hidden／lifecycle／派送後 timer 排除。使用修復来源、合成 media 狀態与 FakeClock；**不是網站 30 秒故障或實際 Tampermonkey singleton 驗收**。所有合成 getter 僅在自有 iframe；網站 getter 未修改。iframe／計時器／監聽器已清理，指定風景片主頁一個 video，來源 raw JSON 與截圖另存。

## 發布與安裝版

v2.1.14 已依 AGENTS.md 常設授權封裝／提交／推送／正式 Release，只附 BiliCDN_TW.user.js。發布時公開 main／peeled tag／唯一附件／latest 版本、大小與 SHA-256 讀回完成，數值見下方發布紀錄。後續驗收文件提交不改版本標籤或發行產物。

實際新版 body／singleton 已核對，Auto 1／2 倍完整矩陣見 [安裝驗收](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_ACCEPTANCE.md)。正常播放、左鍵與短 seek 有通過證據；右鍵未取得新期限。重載後完整 15 秒無進度、不重試、故障新操作、真正 hidden、晚到 SDK 邊界與交叉失效／影音隔離仍待有效取證；網站提前 pause／error／外部換核心只證明撤銷。

## 剩餘限制與歷史

沒有派送期間可觀察 seek 的鍵盤命令不猜測使用者歸因；派送後網站重試保留期限，只撤銷舊還原。既有外部核心因果觀察限制、原 87.785 秒自然網路原因與其餘產品完整驗收不因此結案。沒有有效 cid 或共同路徑的同片仍保守重設。持久鍵、公開 API、依賴與更新 URL 不變。

<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.13 完整正文與 BR-06 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

## 2026-10-10T07:55:30Z 發布讀回

**BR-06 修復與 v2.1.14 發布完成。** 發布提交／peeled tag 056d1a4a9607ed8e96dda45880ec4f82522230a2，遠端 main 核對一致。唯一附件 BiliCDN_TW.user.js，317,276 bytes；無登入公開 latest API／下載核對 2.1.14、大小及 SHA-256 fc2a38d182fd94b3c2ffc786510e858f99f41d702ed279a6c88da7edc0d6c02a，2026-10-10T07:56:00Z 完成。最終 v2.1.14 verify／封裝／提交差異檢查均通過。提交前新契約檔尾空白另清理，不改受審執行期；該非語意測試空白差異與版本／文件在原安全快照之外。既有 Release 快照與原調查保留。

GitHub CLI 一般沙箱讀不到有效 keyring，提升至系統金鑰圈後已核對有效登入並正常發布。發布初期 Chrome 仍完整載入 v2.1.13；工具禁止擴充功能頁面，沒有操作或繞過。使用者手動更新後，07:59:37Z 已核對 v2.1.14 完整執行本體、singleton 1，重連後亦再核對；安裝前提已成立。

## 2026-10-10 安裝續測：BR-07 已重現、未修復

實際指定風景片 Auto 1／2 倍，右方向鍵於 keyup 才改變位置，原 keydown 已為 phase 0，userRevision 不變。新右鍵後 6.995／7.673 秒便備援，1 倍 21.994 秒重載；左鍵於 keydown 更新一次修訂作正常對照。有效故障窗口未截斷；舊 2 倍游標與重跑更晚收尾的淘汰尾段不作完整逾時證據。詳細前提、時序、根因及修正方向見 [BR-07](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_BR07_KEYUP_SEEK.md)。

本輪私有正確契約 **2 fail／3 pass，退出碼 1**，明列為缺陷證據；私有 TypeScript 檢查通過。既有正式 BR-06 **40／40** 再跑通過，但模型把左右鍵都放在 keydown，沒有覆蓋真實右鍵入口。沒有修改執行期或正式測試，沒有重跑或宣稱新的全套 verify／安全掃描；前述 514 案例及 15／15 來源隔離保留發布時範圍。

兩輪請求、攔截、觀察器、包裝與計時器已清理；172 個保守收集 ID 及重跑 41 個受控 ID 的記憶體／持久樣本匹配均為 0。依批准計畫交付新缺陷報告，不自動擴大修復。BR-01 完整矩陣與原自然網路起因仍未結案。

---

## 2026-10-10 換版保存：v2.1.10 完整正文與 BR-03 本機交付

以下全文保留換版前固定入口的版本、日期、原錨點與限制；「未發布」只描述當時。現行發布狀態見 [最新版報告](../../../docs/TEST_REPORT.md)。

<a name="br03-local-fix-verification--2026-10-10"></a>

# BR-03 本機修復驗證 — 2026-10-10，未發布

基準 `c836a17818cd4ae86195e41b1e1c0933cff8cab0`，設定版本仍為 **2.1.10**。BR-03 已改用請求所屬 cid 優先、有界父目錄集合備援；相同清單排列不再誤增 epoch，真正換片仍同步撤銷舊工作。完整來源／案例對照、原始紅燈紀錄、重跑入口與限制見 [BR-03 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)，目前工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

| 驗證 | 本輪結果 |
| --- | --- |
| `npm run typecheck` | 來源／測試通過 |
| `npm run architecture` | 44 個執行期模組通過、無循環 |
| `npm test` | 19 套件、382 個具名案例通過；新增 43 個，沒有 only／skip／todo／cancelled |
| `npm run verify` | 382 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗全部通過 |
| 獨立 Codex Security | `a9c3fb49-d46b-4a8e-81ee-29856ab3e908` 完成封存；14 個變更來源／測試檔完整覆蓋，0 可報告發現、0 待驗證候選 |
| Chrome 修復來源隔離 | BR-03 31／31、BR-02 相容性 31／31；成功輪 Request 事件未截斷，hooks restored；工具失敗輪作廢並另列限制 |
| Chrome 既有安裝版 | 指定同片暫停／續播、4K↔1080P、獨立 seek 正常，恢復 4K 並暫停；這是舊 v2.1.10，沒有安裝 BR-03 修復 |
| 文件／差異檢查 | 連結、錨點、`git diff --check` 與來源／Release 雜湊結果保存在本輪證據目錄 |

證據保存於 `.work/functional-fixes/br03/2026-10-10-c836a17/`。Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2，無工具版本變更。修復前的原四契約 2 通過／2 失敗、擴充失敗結果均單獨保存，不混算通過。安全快照 digest 為 `codex-security-snapshot/v1:sha256:31543372cedbba943e0f4de533b3d34d68790794e4c471de11ee123284685033`；安全封存後只補交付文件與重跑說明，受審來源／測試保持雜湊一致。

**沒有提交、推送、升版或發布；Tampermonkey BR-03 修復版仍待驗收。** schema 2、持久鍵及既有 Release 不變。沒有有效 cid 也沒有共同路徑時仍保守重設。BR-01、真正 startup gate 與 R04 完整故障隔離未結案；來源隔離或短程播放不能替代安裝版矩陣。

以下完整保留 **v2.1.10 發布及修復前驗收正文**；其中「BR-03 尚未修復」「本輪僅文件」均指原日期的那次工作，不描述上方本機修復。版本未變更，因此未搬移本版正文；Release 快照不回寫。

---

<a name="bilicdn_tw-v2110-release-verification--2026-10-09"></a>

# BiliCDN_TW v2.1.10 發行驗證 — 2026-10-09

本版從 `b177f76b824b3ef2027023afd933a252939d1ca5` 修復 BR-02 XHR failed open 所有權問題。使用者在完成本機修復後授權推送更新，本版已於 2026-10-09 20:58（Asia/Taipei）發布；標籤對應提交 `49995fbc29ee638739487b3a27aa5c4a662a8741`，公開 latest 下載校驗一致。完整變更與契約見 [BR-02 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR02_FIX_REPORT.md)，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 修復與相容性

open 先完成一次參數轉換，暫存新 metadata 供同步回呼使用。原生成功後才撤銷舊所有權；失敗時只還原仍由候選持有的物件，較新的巢狀請求不被覆蓋。舊監聽器先驗證身分，避免事件及觀察污染。Chrome 非法 Window 同步選項造成 UNSENT 時，只重新準備尚未原生送出的 waiting 請求，保留選項／headers 並重查政策；已送出工作不重播。

只新增內部狀態，未新增公開 API、設定或持久欄位。schema 2、Vault 唯一授權、嚴格影音隔離、Fetch 單讀取器及 Worker 不介入保持原狀。BR-01 畫質切換停滯沒有併入本修復。

## 自動發行驗證

工具版本：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。v2.1.10 已通過獨立 typecheck、architecture、npm test 與完整 verify，所有命令退出碼為 0。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 來源及測試通過 |
| `npm run architecture` | 43 個執行期模組通過，無匯入循環 |
| `npm test` | 19 個套件、339 個具名案例通過；新增 40 個 BR-02 契約，native-transport 共 89 個 |
| `npm run verify` | 型別、架構、339 案例、42 個非入口模組匯入純度、確定性建置、語法、v2-only 及暫存封裝校驗全部通過 |

沒有 only、skip、todo 或 cancelled。失敗契約先於來源修復建立，修復前 77 個傳輸案例中 17 個失敗，Chrome UNSENT 邊界也先建立失敗證據；紅燈紀錄不計入通過。發行證據另存本機 `.work/release-v2.1.10/`。

## 獨立安全審查

BR-02 固定差異的 Codex Security 掃描 `574bdde1-ec2c-470e-8119-23423ff96a1e` 已封存，兩個來源／測試檔完整覆蓋，0 個可報告的新安全發現、0 個待驗證候選。快照 digest 為 `codex-security-snapshot/v1:sha256:0eb35c75c23262e74f4b477f0d49b5c9f5a6d928a480b3c9e3488d205672a629`，preflight ready；Daybreak granted／Daybreak Blue。

升版沒有再次修改受審 xhr-hook.ts 或正式契約；其他執行期檔案相對基準只有 metadata 版本變更。發布前重新比對受審雜湊及版本差異，沿用此已完成的安全審查，不宣稱另跑新掃描。它不代表全專案或 BR-01 全面無漏洞；原始安全產物不回寫。

## 封裝與更新

正式產物為 `Release/v2.1.10/BiliCDN_TW.user.js`，**293,972 bytes**，SHA-256 為 `f30464996ee9da7e3b655e029746693e3db1c8b547ea70ed44a794d00a04acf8`。GitHub Release 僅上傳使用者腳本；報告、CHANGELOG、BUILD_MANIFEST 與 SHA256SUMS 留在儲存庫。既有 Release 不覆寫；公開 latest 下載已核對相同版本、大小及 SHA-256。

更新 URL 維持 [最新使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。版本、依賴鎖根版本與 metadata 一致；沒有新增執行期依賴或 CI/CD。

## 發布確認

2026-10-09 20:58（Asia/Taipei）完成 [v2.1.10 正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.10)。main 與標籤已推送，唯一附件為 BiliCDN_TW.user.js。20:58 的公開 latest 讀回確認版本 2.1.10、293,972 bytes 及上述 SHA-256 一致。此後僅補寫現行發布狀態，不回寫封裝報告或 Release 快照。

## Chrome／Tampermonkey 狀態

BR-02 修復來源已在真實 Chrome 154 的隔離頁通過 31／31 個案例，使用原生 XHR、Blob 及受控合成輸入。HTTPDNS 先設定精確 Request 攔截及頁面 CSP，捕捉窗口未截斷、目標 requestPaused 為 0；hook、監聽器、Blob、攔截及測試伺服器已清理。

以上是發行時的來源隔離證據。**2026-10-09～10 已實際載入 Tampermonkey v2.1.10 進行部分驗收：68 個 XHR 案例執行通過**，含原生對照；真正 startup gate 的 failed open 交錯尚未觸發，不能用隔離或 Node 結果替代。

指定 [BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/) 取得播放、88.2 秒暫停／續播與一次 8K→4K 正常對照；另一次切換加 seek 停滯 87.8 秒後以 1080p 恢復，BR-01 根因仍待定位。新確認的 **BR-03** 是相同 DASH 清單排列誤增 epoch，來源契約 2 通過／2 失敗，實際安裝版 2→3、正常對照 4→4；尚未修復。完整證據與剩餘範圍見 [v2.1.10 安裝版紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.10_ACCEPTANCE.md) 及 [BR-03 詳細報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.10_BR03_CONTENT_EPOCH.md)。

本輪依「找到問題並撰寫詳細報告」條件交付，沒有宣稱全套驗收完成。僅新增證據／文件，未修改來源、正式測試、Release 或版本，未提交／推送。本輪未重新執行完整 npm 發行驗證或安全掃描，上方 339 個正式案例及安全结果保持原執行日期；獨立失敗契約不混算。

## 歷史驗證導覽

<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

- [v2.1.9 完整歷史驗證與當時瀏覽器狀態](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v219-release-verification--2026-10-09)

v2.1.8 的完整正文於 2026-10-09 移入歷史報告，保留原始數值、日期、發布及瀏覽器限制。舊錨點導引如下：

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 發行驗證 — 2026-10-04](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)

<a name="reproduction-and-implementation"></a>

- [v2.1.8 重現與實作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#reproduction-and-implementation)

<a name="automated-verification"></a>

- [v2.1.8 自動驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#automated-verification)

<a name="separate-security-and-browser-evidence"></a>

- [v2.1.8 安全與瀏覽器證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#separate-security-and-browser-evidence)

<a name="publication-confirmation"></a>

- [v2.1.8 發布確認](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#publication-confirmation)

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

- [v2.1.8 Chrome／Tampermonkey 觀察](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#chrome--tampermonkey-observations-after-standard-update)

更早十二個區塊於 2026-10-06 移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，正文保留原文與當時限制。原主要標題錨點保留為導引；歷史「待完成」不構成目前工作，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。文件搬移與本次檢查另見 [文件維護歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

<a name="published-bilicdn_tw-v217-test-report"></a>

- [v2.1.7 已發布驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#published-bilicdn_tw-v217-test-report)

<a name="historical-modularization-verification--before-release"></a>

- [發行前模組化驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-modularization-verification--before-release)

<a name="historical-v216-test-report"></a>

- [v2.1.6 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v216-test-report)

<a name="historical-v215-test-report"></a>

- [v2.1.5 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v215-test-report)

<a name="historical-v214-test-report"></a>

- [v2.1.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v214-test-report)

<a name="historical-v213-test-report"></a>

- [v2.1.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v213-test-report)

<a name="historical-v212-test-report"></a>

- [v2.1.2 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v212-test-report)

<a name="historical-v211-test-report"></a>

- [v2.1.1 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v211-test-report)

<a name="historical-v210-test-report"></a>

- [v2.1.0 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v210-test-report)

<a name="historical-v204-test-report"></a>

- [v2.0.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v204-test-report)

<a name="historical-v203-test-report"></a>

- [v2.0.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v203-test-report)

<a name="historical-v202-verification-unchanged-scope"></a>

- [v2.0.2 歷史驗證（當時範圍不變）](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v202-verification-unchanged-scope)

<!-- 2026-10-10 換版保存：以下為 v2.1.12 最新正文，含原未提交 Auto 調查追加；原始日期與限制不變。 -->

<a name="bilicdn_tw-v2112-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.12 發行驗證 — 2026-10-10

基準 v2.1.11／f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e；本輪只修 BR-04／BR-05。**修復、v2.1.12 發布與兩項實際安裝版驗收完成；BR-01 與其餘完整驗收未結案。** 正式契約、來源隔離、獨立安全審查、公開產物與安裝版結果分列。完整對照見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR04_BR05_FIX_REPORT.md)。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。v2.1.12 的 typecheck、architecture 及 npm test 通過；44 個執行期模組、19 套件、448 個具名案例，沒有 failed／only／skipped／todo／cancelled。新增 19 個 BR-04 與 47 個 BR-05。未修來源的 native-transport 115 pass／23 fail、measurement-state 4 pass／28 fail 單獨保留，不混算通過。

完整 npm run verify 已通過：型別、架構、448 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 及暫存封裝 checksum。git diff --check 通過；證據位於 .work/functional-fixes/br04-br05/2026-10-10-f27b3a2/。

## 獨立安全審查

最終凍結差異的 Codex Security **9ceb91f0-9690-4372-9e86-8e07ea29c11b** 已封存：12 個變更來源／測試／版本設定檔完整覆蓋、0 可報告發現、0 待驗證候選、沒有快照漂移警告。Snapshot digest 為 codex-security-snapshot/v1:sha256:4ae67faaca413f0591719ff73b61c0d6f30c000a19f0d23fc22cd66ed6a0d213。封存前核對 10 個獨立複核來源／測試的最終 SHA-256，全部一致；另外審查兩份版本設定，只有版本變更。完整報告與 receipt 由 Codex Security 管理保存，與一般 verify 分開。首輪漂移報告保留，未當作最終快照。 安全不屬於 npm run verify，也不是全儲存庫無漏洞保證。

## Chrome 來源隔離

Chrome 155 原生 Fetch／XHR／RangeProbe，36／36 通過，75 次合成直接 206 探測與 39 次 media 回應；真正共用 gate 完成 measured。BR-02、BR-03 各 31／31。有效攔截窗口沒有截斷、沒有合成請求外送，無未處理拒絕，hooks 已還原；作廢工具輪與清理詳見修復報告。這是修復來源＋記憶體儲存，**不是 Tampermonkey singleton 驗收**。

## 產物與發布

2026-10-10 04:24:04（Asia/Taipei）[發布 v2.1.12](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.12)。來源提交 cdbb10b3e9ce8f56485dd427dd38d10e848ba005，遠端 main 及標籤 peeled commit 一致，annotated tag 物件 67d1d2a8ba6134b279769b2929400659ad67aaba。使用者腳本 298,785 bytes，SHA-256 c3874efbf718a3eebcc64cf2591d1a328d7ddde1aac40b7d91faf593f7c6e28d。GitHub Release 唯一附件為 BiliCDN_TW.user.js；04:24:40 未認證的公開 latest API／下載回傳 200，版本、大小與 SHA-256 全部一致。更新 URL 保持 [公開 latest](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。發布後只補現行文件，不覆寫 Release 快照或重封裝產物。

## Tampermonkey 與剩餘限制

實際 Tampermonkey 已自動更新 v2.1.12，Debug source 的完整程式 body 與發布附件相同。**35／35 通過**：2 原生 XHR、5 安裝版 XHR 共用 gate 重入／abort／replace、9 原生 Fetch reason、18 安裝版預取消／等待取消、1 未取消的共用 Fetch 正常對照。真 singleton／probe 未替换，gate measured；合成請求精確送出前攔截，3 Range 206、2 CORS OPTIONS、3 media 200，沒有外送或事件截斷。有效輪執行前後完整 routeEvidence 相同，合成樣本／cursor 寫入只在本輪以實例掛鉤抑制並清理；測試邊界詳見 [安裝版紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.12_ACCEPTANCE.md)。

同一支指定風景影片的播放前進、暫停穩定、恢復及短程方向鍵 seek 通過；seeked 約 317 ms、無 mediaError，之後持續播放。沒有切換影片、修改 Chrome 設定或停用其他腳本。作廢輪因測試攔截器缺少 CORS 回應，正常 XHR 對照失敗，不計通過；其錯誤樣本抑制也造成三筆合成學習樣本及退避，已依精確 owned IDs／時間清理。最多三筆可能被有界保留淘汰的先前樣本無法重建，不宣稱完整復原歷史資料。BR-01 長 seek 政策／原網路起因、background／SDK 自然故障及其餘完整產品驗收見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 2026-10-10 BR-01 Auto 調查追加

本次在 main／c924b0216fe0a8f7a624f391d44b36660daca433，核對實際 Tampermonkey v2.1.12 body 與上述產物一致。以 Auto 為主要場景，11:57 的有效影片受控延遲 seek **28.133 秒**，解除攔截後正常對照 **1.555 秒**；epoch 維持 1，沒有腳本核心重載，網路事件沒有截斷。原 87.785 秒自然故障起因未證實，未把 Auto 正常降畫質判為缺陷。完整事件、救援缺口、作廢輪與清理限制見 [BR-01 Auto 深度調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md)。

本輪重新執行 typecheck、architecture（44 模組）、npm test（19 套件、448 具名案例）通過。獨立調查重現 **3 pass／3 fail／退出碼 1** 另存，兩個有界恢復候選斷言尚待政策，未登記正式套件；不能算作修復通過。沒有修改執行期來源／正式測試／版本／Release，沒有新 verify 或安全掃描／發布；既有發行結果保持其原日期。新證據在 .work/functional-review/br01/2026-10-10-c924b02/，BR-01 修復及其餘完整驗收仍未完成。

## 歷史驗證導覽

<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

- [v2.1.11 完整發布與續測正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2111-release-verification--2026-10-10)
- [v2.1.10 完整歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2110-release-verification--2026-10-09)
- [其餘歷史導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 原錨點與完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)


---

<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

# BiliCDN_TW v2.1.9 發行驗證 — 2026-10-09

**目前另有 BR-02 本機修復、未發布。** 新增 40 個正式契約與 31 個 Chrome 來源隔離案例；最新自動／安全結果及安裝版待驗收狀態見 [BR-02 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR02_FIX_REPORT.md)。以下 v2.1.9 發行數字與當時安裝版觀察保持原紀錄，不將本機建置當成已發布版本。

本報告記錄以 `71f7ddd6f7cb5e538244419e801925e1a7d1ab10` 為基準的 17 項功能與競態修復，包含嚴格影音隔離。使用者在完成本機修復後授權推送 GitHub 以提供更新；本版已於 2026-10-09 發布，標籤對應提交 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7`。現行指南見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)，逐項來源、契約與剩餘限制見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/FUNCTIONAL_FIX_REPORT.md)。

## 修復與相容性

涵蓋 R01–R04、A01–A03、B1–B5 及 C-01–C-05。修復內容週期撤銷、播放器採樣與恢復、漸進式簽名刷新、政策版本、跨執行環境樣本 ID、鎖後量測資格、XHR 取消與重用、單節點設定合併及過期 UI 回呼。修改執行期前先建立失敗契約，調查證據與正式回歸分開保留。

schema 2、持久鍵、舊樣本讀取、完整 Catalog 候選池、Vault 唯一授權、Fetch 單讀取器及 Worker 不介入維持不變。不新增同世代 API 逆序回應、清除學習屏障或原生 GM 通知競合政策；沒有 Web Locks 的既有限制仍在，不宣稱恢復歷史遺失樣本。

## 自動發行驗證

2026-10-09 在版本 2.1.9 上重新執行下列命令，全部通過：

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm run architecture` | 43 個執行期模組，通過分層與所有權規則 |
| `npm test` | 19 個登記套件、299 個具名案例全部通過；無 only、skip、todo、cancelled |
| `npm run verify` | 通過型別、架構、測試、42 個非入口模組匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗 |

工具版本：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。發行記錄保存在本機 `.work/release-v2.1.9/`，不作 Release 附件。此次 299 案例與 v2.1.8 的歷史斷言數、後來工具遷移的 215 案例具有不同計數脈絡，不互相換算。

## 獨立安全差異審查

Codex Security 掃描 `7038b1e4-687a-4df3-b492-2cf73065727e` 已於 2026-10-09 完成封存。審閱全部 41 個變更來源檔，覆蓋狀態 `complete`，未完成審查項目 0，可回報發現 0。範圍包括 Vault 授權刷新、政策失效、舊工作提交及 XHR 狀態攔截；獨立於 npm verify。

受審快照摘要：`codex-security-snapshot/v1:sha256:041ddddd42903006c268b668cac1562a53f5c690108c095e31de695d9ee43b14`。發行前比較 45 個來源檔，44 個保持受審雜湊，唯一變更為 metadata 的版本 2.1.8→2.1.9；未再修改執行期邏輯。掃描結果不保證不存在漏洞，也不代表瀏覽器驗收通過。

## 封裝與更新

v2.1.9 使用者腳本為 **292,728 bytes**，SHA-256 **`051066c36a2e90aa19507671de75483667beb9757502b54f44522e4390b07f55`**。版本化封裝保存發行前報告、變更紀錄、建置資訊清單與校驗值；GitHub Release 只上傳 `BiliCDN_TW.user.js`。發布後的讀回狀態只更新現行文件，舊版及本版已發布快照不回寫。

`@updateURL` 與 `@downloadURL` 維持 [最新 Release 使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。版本化封裝內保存發布前的驗證快照，以下為發布後另行讀回的結果。

## 發布確認

2026-10-09 15:42:33（Asia/Taipei）正式發布 [v2.1.9](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.9)。GitHub latest API 確認為最新、非草稿、非預發行，只有一個附件 `BiliCDN_TW.user.js`。遠端標籤解析至 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7`，發布時 main 亦為此提交；後續只補入發布文件，不修改已發布產物。

15:43:07 從實際 latest 更新網址取得 HTTP 200，下載結果的 `@version` 為 2.1.9、大小 292,728 bytes，SHA-256 與本機已驗證產物及 GitHub 附件摘要三者一致。讀回紀錄保存在本機 `.work/release-v2.1.9/published-readback.json`。217 個歷史 Release 檔案未改動，v2.1.8 正文已搬移保留；本版封裝校驗及 `git diff --check` 通過。

## Chrome／Tampermonkey 狀態

**2026-10-09 已執行部分真實瀏覽器驗收，尚未全面通過。** Chrome 154.0.0.0 的實際分頁診斷確認載入 2.1.9；使用者截圖顯示 Tampermonkey 5.5.0，並與 Bilibili Evolved 2.11.4 共存。18 個原生 XHR 合成輸入案例、真實 Web Locks 下的 R02／R03 控制中心操作，以及指定展示影片的部分播放／seek／畫質情境通過。

第一輪 8K→4K 曾在 seeking 狀態停滯至少約 2 分 24 秒，乾淨分頁第二輪切換正常；原因仍待定位，不計為已確認程式缺陷，也不能列為整項通過。最終回到正常 4K／AV1／2 倍速，完整設定讀回與初始一致。實測資料、異常及尚未覆蓋範圍見 [v2.1.9 Chrome 紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.9_ACCEPTANCE.md)；原始步驟見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/FUNCTIONAL_FIX_REPORT.md#chrome-與-tampermonkey-待驗收步驟)。本輪未修改執行期來源、瀏覽器設定或 Release；未重新宣稱自動測試或安全掃描結果。

**同日晚間續測已確認未修復的 BR-02。** failed open 會使本地等待的 XHR 遺失 error／loadend，或使虛擬 DONE 倒退；Chrome 新矩陣兩個正常對照通過、六個情境失敗，額外不同 Blob 對照也通過。獨立來源重現為 9 案例、2 通過／7 預期失敗、退出碼 1，沒有加入正式套件或當作整體通過。詳見 [BR-02 問題報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md)。本次完成使用者設定的「找到問題並撰寫詳細報告」條件，未完成的驗收仍保留。

v2.1.8 的合法 MP4 試片／公開 DASH 觀察、完整公開 MP4／FLV 覆蓋限制及其安全報告標記均保留於歷史正文。v2.1.6 驗收仍為已批准結案，不因本版修復重新開啟。

---

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

# BiliCDN_TW v2.1.8 發行驗證 — 2026-10-04

本報告記錄已發布的 MP4／FLV 修復；v2.1.7 及更早證據見下方[歷史導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#歷史驗證導覽)。依使用者要求，v2.1.8 先發布再執行新的 Chrome 回歸，讓 Tampermonkey 使用既有更新 URL。於 2026-10-04（Asia/Taipei）發布 [v2.1.8](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.8)，標籤／提交為 `b6e2ff11ef53ce3a338cc197c90edecdf0bb2b60`。先前 `Release/v*/` 快照保持原樣。現行指南見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)。

<a name="reproduction-and-implementation"></a>

## 重現與實作

原目標頁面的 playurl 請求回傳 HTTP 200／上游 `code` 0，包含一個 MP4 `durl` 分段。舊適配器只辨識 DASH，因此拒絕結果；Fetch 攔截輸出本機 HTTP 503／`code` -1，未提供可播放資料。當時尚未啟動媒體 CDN 請求，不能據此宣稱全部 Catalog 主機失敗。修改執行期程式前，契約測試已重現解析器拒絕及 Fetch 503。

修復接納 MP4／FLV 分段與已辨識的混合 DASH 分支，保留分段順序及非 URL 中繼資料；必要分段全部規劃後才寫回 URL。資料格式錯誤、容量不足或無可用輸出時，嚴格漸進式回應整份拒絕。Vault 管理的來源不透明識別碼用於同段內建節點清單（Catalog）輸出；精確原生簽名路線（Native）授權仍有界且獨立。完整 Catalog 資格及排名保留，起播探測共用最多三個候選／三秒窗口。無明確結果時不提交測速贏家，送出依當前完整合法候選池判斷。固定主機、Catalog 及原生來源設定變更會失效計畫、取消腳本探測／恢復。最近 playurl 診斷只含有界格式／數量／狀態／`code`／原因欄位。

<a name="automated-verification"></a>

## 自動驗證

2026-10-04 的 `npm run typecheck`、`npm run architecture`、`npm test` 及 `npm run verify` 均通過。結果為 **891 項功能斷言**、**18 項架構斷言**、**42 個執行期模組**，以及 **41 個非入口模組**的匯入純度檢查。verify 通過確定性建置、JavaScript 語法、僅含 v2 的打包產物及暫存封裝／校驗值，未覆寫已發布 Release 產物。`git diff --check` 通過。一般沙盒阻止 esbuild 讀取上層目錄；使用經審核的執行權限後，相同 `npm test`／`verify` 命令通過。

四個新獨立套件涵蓋漸進式解析／生命週期／授權／容量（139 項斷言）、完整候選池選路及起播／固定設定競態（58）、MP4 Fetch／XHR 整合（15）、安全型別化 playurl 摘要（49）。既有 DASH、四種模式、設定、來源授權、影片／音訊、Fetch 讀取器／取消／正規化及 XHR 相容契約仍通過。另有狀態層斷言區分僅使用 Catalog 來源材料與 Native 授權。

<a name="separate-security-and-browser-evidence"></a>

## 分開記錄的安全與瀏覽器證據

最終 Codex Security 差異掃描 `447fbcd6-b672-4e0f-a572-e7805ef97e45` 已完成，並封存為不可變更的產物。權威變更程式清單的 **30 個項目**全部完成審閱，沒有合理候選或可報告問題。最終語意提交已結案所有來源面，但工具仍保留一筆已被取代的中途待審紀錄，因此正式覆蓋狀態仍為 **`partial`（部分覆蓋）**。該紀錄列出九個其後已審閱、以 `no_issue_found` 結案的 Vault／playurl／傳輸（`transport`）檔案；這是保留的檢查點限制，不代表來源未審閱。已封存且不可變更的產物保持原樣。不可變受審工作樹摘要雜湊為 `07ca765f6c2faae011f89cbf0e27dac032e98f3193a120a9e95570b2ef7efa8a`，基準為 `fa3946ec2807360c8a2b84291c213d624ef4142d`。此結果是靜態變更程式審閱，不是全儲存庫稽核或瀏覽器驗收。

封裝前，**43 個建置資訊清單輸入**均符合已驗證雜湊。v2.1.8 使用者腳本為 **285,037 bytes**，SHA-256 為 **`c2bda1e0be4b086e7622e34d3fba0a6cdfdd5eb612afea700289758112c9eb4f`**。後續修改只涉及發布證據及文件，應用層執行期程式不變。掃描目標工具記錄 723,436 tokens（模型詞元）及 1,174 秒（19 分 34 秒）；這是其目標計數，不是帳單。

發布後，使用者完成 Tampermonkey 標準更新。DevTools 確認安裝版本 **2.1.8**，包含漸進式解析器。下方真實瀏覽器觀察與自動、安全證據分開。FLV 目前只有自動覆蓋，沒有建立合法現場樣本。

已封存且不可變更的發現項目 SHA-256 為 `efdc076ba573da8e9437295c83f80cf46366c28cd83e0ae468e676440330fd8a`；覆蓋狀態 SHA-256 為 `8ebb2dd034a43582c872fe71d5581309e17fcea229e905e919fbfdd5af123542`。

<a name="publication-confirmation"></a>

## 發布確認

2026-10-04 的 GitHub 讀回確認 v2.1.8 為最新非草稿、非預發行版本，只有一個附件：`BiliCDN_TW.user.js`，285,037 bytes，GitHub 附件摘要雜湊與上方已驗證 SHA-256 一致。遠端 `main` 與 `refs/tags/v2.1.8` 當時都指向 `b6e2ff11ef53ce3a338cc197c90edecdf0bb2b60`。使用者在遠端 README 的修改已合併，未強制推送；最新 Release 更新 URL 提供此修復。版本化封裝保存發布前驗證快照，後續發布／瀏覽器狀態只記在現行文件。

發布後另外開啟新的 Chrome 目標分頁。最初 DevTools 確認**安裝版本仍為 2.1.7**，沒有漸進式解析器，頁面仍顯示 `code` -1；這不是 v2.1.8 測試結果。使用者完成正常 Tampermonkey 更新後，DevTools 才確認 v2.1.8。瀏覽器工具政策禁止控制擴充功能管理頁；使用者指定正常 Release 更新後，未嘗試本機檔案匯入或繞過政策。

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

## 標準更新後的 Chrome／Tampermonkey 觀察

於 2026-10-04（Asia/Taipei）在獨立 Chrome 分頁觀察，沿用網站既有倍速（初始化後為 2x）。未變更播放偏好或帳號權益。只記錄有界中繼資料、實際回應主機／狀態及影片時間／錯誤值；未持久化簽名媒體 URL、路徑、查詢字串、權杖或原始資料內容。截圖僅涵蓋影片標題與播放器，排除登入帳號資訊。

| 案例 | 播放觀察 | 實際網路面板（Network）觀察 |
| --- | --- | --- |
| 原始 [MP4 目標](https://www.bilibili.com/video/BV1Xwa96pE7g/) — 僅授權試片 | playurl HTTP 200／`code` 0，`format: mp4`，一個 `durl` 分段。13:48:26.878 至 13:48:43.315 UTC 的九個樣本：目前播放時間 0.799119 → 4.525805 → 8.623854 → 12.716896 → 16.827735 → 20.922018 → 25.011643 → 29.098042 → 試片結束 30.296938 秒。無媒體錯誤；`readyState`（就緒狀態） 4，持續播放至試片結束。連續進度觀察超過 12 秒實際經過時間。 | HTTPS `upos-sz-mirrorali.bilivideo.com`，直接 **206 媒體回應（`Media`）**，無磁碟快取或媒體轉址。此窗口事件擷取未截斷。 |
| 替代公開 [DASH 影片](https://www.bilibili.com/video/BV1YgT26qETR/) — 使用者回報原片改會員限定後選用 | 伺服器端渲染（SSR）播放資訊 `code` 0，18 個 DASH 影片媒體表示、3 個音訊媒體表示，沒有 `durl`。上游 `format: flv720` 標籤不表示此為漸進式 FLV 樣本。13:54:46.966 至 13:54:59.103 UTC 的七個穩定樣本：365.202979 → 369.262146 → 373.316104 → 377.346458 → 381.420513 → 385.440562 → 389.501470 秒。全部正在播放、`readyState`（就緒狀態） 4、無媒體錯誤。 | 影片及音訊請求與各自同串流媒體表示路徑的比對只在記憶體進行。實際目的地為 Catalog 主機 `upos-sz-mirrorali.bilivideo.com` 及 `upos-sz-mirroraliov.bilivideo.com`，直接 HTTPS **206**；未截斷的擷取中未觀察到媒體轉址。 |

較早 DASH 窗口在約 95.95 秒時短暫停留 `readyState`（就緒狀態） 2，之後恢復播放。部分網路事件回報 DNS 失敗及取消請求；本紀錄不宣稱每個 Catalog 主機成功或全程無緩衝。後續穩定窗口確認連續進度達 12.137 秒實際經過時間。

原上傳者已將 MP4 目標改為會員限定。成功觀察只涵蓋網站合法 30 秒試片，**不涵蓋完整會員內容**。依使用者指示，後續正常播放回歸採替代公開 DASH 影片。完整公開漸進式 MP4 及合法現場 FLV 樣本尚未建立；這些是覆蓋限制，不是新的實作待辦，也不代表全部格式均經瀏覽器驗收。本機裁切截圖保存在 `.work/v2.1.8-mp4-chrome-2026-10-04.png` 及 `.work/v2.1.8-dash-chrome-2026-10-04.png`，屬私有證據，不是 Release 附件。未匯出 HAR 或簽名回應資料內容。

上述觀察後，九份現行文件同步發布／更新／瀏覽器狀態。當時這些文件的 **103 個本機連結及錨點**與 `git diff --check` 均通過。該次文件檢查未重跑執行期測試、未變更應用層程式，也未改動封裝 Release 快照。

**v2.1.6 驗收維持已批准、已結案。** v2.1.8 發布已完成，自動／安全與新瀏覽器證據各自記錄。

---

# Published BiliCDN_TW v2.1.7 test report

> Current release evidence is summarized in the first section. All later version/pre-release sections are dated historical records; their pending or unpublished language describes that time, not the current backlog. Document status is indexed in [docs/INDEX.md](../../../docs/INDEX.md). Packaged `Release/v*/` reports remain immutable snapshots.

## Release scope

Released on 2026-10-03 (Asia/Taipei) as [v2.1.7](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.7), commit `03beb91a5fdc34c8bcaf6f623783bfc411737d0e`, from baseline `307f9a6f38b5a559e05e32c50c5b3f8ca1636257`, after the completed modularization implementation documented below. Settings schema/defaults, the Catalog roster, Native-source opt-in, original comparison and UI/diagnostic semantics remain compatible with v2.1.6.

## Final automated verification

On 2026-10-03 (Asia/Taipei), `npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` all passed for v2.1.7. The architecture check covers 41 runtime modules; tests retain 626 functional assertions and add 18 architecture assertions plus import-purity checks for all 40 non-entry modules. Verify passed deterministic double build, JavaScript syntax, v2-only bundle and package/checksum validation in a temporary directory. `git diff --check` also passed.

The production userscript is **273,691 bytes**, SHA-256 **`6cc8d1bdcc1afd76859a7831c3b467d9d7f5fddf4f238df47a4a28c475f2e405`**. Formal release packaging uses these same build inputs and retains the packaged script, report, changelog, manifest and checksum list under `Release/v2.1.7/`.

## Security evidence and browser status

The final implementation diff was reviewed in Codex Security scan `650fe466-dc70-4427-be60-b8da85b84e0b`: all 53 changed review items were examined with zero reportable findings. The sealed coverage document retains one stale intermediate deferred entry even though both runtime and script/test surfaces are closed as `no_issue_found`; the canonical partial-coverage limitation remains explicit in the implementation record below. A readback for this release confirmed the same sealed result. Before release metadata changes, all 38 `src-v2/` inputs in the verified build manifest matched their current SHA-256 hashes. Subsequent release edits update version metadata, release documentation and packaging inclusion only; no application runtime body was changed after the scan.

**v2.1.6 Chrome/Tampermonkey acceptance remains passed and closed.** No new real-browser v2.1.7 result is claimed by this release; any later browser regression record applies to the new release difference.

## Publication contract

The GitHub Release contains only `BiliCDN_TW.user.js`. Changelog, test report, build manifest and checksums stay in the repository under `Release/v2.1.7/`; prior release directories and unrelated user documentation remain preserved.

Publication readback confirmed v2.1.7 as the latest non-draft/non-prerelease, exactly one uploaded userscript asset, the remote tag matching the release commit, and asset size/SHA-256 matching the verified package above. Current repository documentation can subsequently receive maintenance edits without rewriting the packaged release report.

## First post-release archive verification — 2026-10-03

Historical documents and completed local tools/evidence were moved into `archive/retired/`; current source, tests, tool scripts, configuration, attribution baseline and all Release snapshots retain their locations. Before link adjustments, all 604 relocated files matched their pre-move SHA-256. Subsequent checks confirmed all 592 relocated local files and 327 protected files remain byte-identical. The 11 relocated Markdown files changed relative link targets only; the acceptance screenshot is unchanged. The selective Git ignore rules expose curated archival documentation while retaining private artifacts and the relocation manifest as ignored local data.

All 128 local links/anchors across 25 public Markdown files passed. `npm run verify` passed typecheck, architecture, 626 functional assertions, 18 architecture assertions, 40 non-entry import-purity checks, deterministic build, syntax and temporary packaging/checksums. The initial sandboxed attempt failed because esbuild could not read an ancestor directory; the same command passed with appropriate permissions and no tool/runtime edits. `git diff --check` passed. This is an automated layout regression record, not a new security scan or Chrome/Tampermonkey acceptance. The published v2.1.7 userscript and immutable packaged reports are unchanged.

## Root-document consolidation verification — 2026-10-03

Five active documents were consolidated under `docs/`, and the upstream checksum list moved to `baseline/SHA256SUMS.txt` without changing its contents. Root Markdown files are now README, AGENTS and SECURITY. Packaging retains its versioned output names and reads changelog/report from their new locations. The archive index's accidentally concatenated duplicate project-context block was removed; the authoritative project context remains in `docs/PROJECT_CONTEXT.md`.

All 129 local links/anchors across 25 public Markdown files passed. Baseline checksum validation and `git diff --check` passed. `npm run verify` completed with the same 626 functional/18 architecture assertions and 40-module import-purity coverage, plus deterministic build, syntax and temporary packaging/checksum validation. All source, tests, released artifacts and archived raw evidence remain unchanged; the packaging script changes only its two document input paths. The rebuilt userscript SHA-256 remains the published hash recorded above. No new security scan or real-browser acceptance is claimed.

---

# Historical modularization verification — before release

> This is the 2026-10-02 pre-release record. Its then-current v2.1.6 metadata and unpublished status were superseded by the v2.1.7 publication section above; the original evidence is retained.

## Scope and completed stages

Verified on 2026-10-02 against baseline `307f9a6f38b5a559e05e32c50c5b3f8ca1636257`. This working-tree refactor completes the four-stage modularization plan. The configured version remains **v2.1.6**; no release was published and existing `Release/` artifacts were not changed. Pre-existing `PROJECT_CONTEXT.md` and CDN/Chrome documents were preserved.

1. Split the original test program into independent suites, made domain URL resolution accept an explicit base URL, and replaced import-pattern checks with TypeScript AST dependency/ownership rules and import-purity tests.
2. Added navigation, scheduler and play-intent ports; centralized application settings/reset/fallback orchestration and typed UI commands; moved measurement metadata into its own state store and playurl registration/epoch handling into an application controller.
3. Extracted pure route eligibility/output planning, independent Fetch/XHR hooks with a shared send-time policy context, and the shared bounded Range probe adapter. Route affinity, active probe initiation and player reload remain owned by their respective controllers; retained signed URLs remain in `SignedRouteVault`.
4. Added explicit readonly snapshots and minimum controller interfaces, removed dependency-bypassing `as never` casts, and verified isolated suite state and resource cleanup. Settings schema/defaults, Catalog hosts, UI capabilities and diagnostic field meanings are preserved.

## Contract reproduction and automated results

Failure-first contracts reproduced browser-global-dependent domain classification, a disposed lifecycle applying queued page data, already-aborted/mid-read-aborted probe behavior, and a stale startup waiter writing measurement metadata after reset. The corresponding runtime fixes pass. The original **556 assertions** remain covered in seven extracted behavioral suites; four new suites add **70 assertions**, for **626 functional assertions** total.

| Verification | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run architecture` | Passed: 41 runtime modules, AST layer/ownership rules and no cycles |
| `npm test` | Passed: 626 functional assertions, 18 architecture assertions and import-purity checks for all 40 non-entry modules |
| `npm run verify` | Passed: all preceding gates, deterministic double build, JavaScript syntax, v2-only bundle and package/checksum validation |
| `git diff --check` | Passed |

Every suite runs in a separate process and restores its owned globals, hooks, subscriptions and timers in `finally`. Regression coverage includes Catalog-only/Native/comparison/disabled modes, settings synchronization, SPA/trusted promotion, generation and setting races, video/audio isolation, Catalog 403, Fetch single-reader/cancellation/Request normalization, and XHR text/json/reuse/timeout/abort/send-time checks. Verification packages into a temporary `dist/verify-package-*` directory and checks cleanup containment, so running `verify` does not overwrite a published release. Explicit `npm run package` retains its release-writing behavior.

## Final security diff scan

Codex Security scan `650fe466-dc70-4427-be60-b8da85b84e0b` completed and sealed the immutable final source diff. The review covered **53 of 53 changed source/config/test items with zero reportable findings**: 28 runtime paths and 25 build/test paths, with supporting authority, restriction, generation, privacy and baseline-extraction tracing. No source changes followed the scan; this verification record was added afterward.

**Canonical coverage-record limitation:** after the final draft was successfully submitted with `completeness: complete` and an empty deferred list, the sealed readback still reports `completeness: partial` and retains the earlier `scripts-tests-review` deferred entry. The same sealed document contains the completed 25-file review surface marked `no_issue_found`, and the workbench reports 53/53 reviews closed. The independent script/test reviewer completed all 25 paths and returned no candidates. This is a discrepancy in the saved coverage record, not an unperformed review; a canonical zero-deferred result is therefore **not claimed**. The supported tool does not permit modifying sealed scans, so the immutable artifacts were preserved and this limitation is recorded explicitly.

Canonical local report: `C:\Users\qwe15\.codex\state\plugins\codex-security\scans\BiliCDN_TW_Codex_Handoff\307f9a6f38b5a559e05e32c50c5b3f8ca1636257_20261002T150214Z_yekz7bna\report.md`.

The scan tool reported **12,472,914 total tokens**, including **11,789,824 cached input tokens**, across four threads (`codex_rollout` accounting). This is the tool's measured accounting, not a billing estimate. Static source review and automated contracts do not establish actual Chrome Network destinations.

## Browser acceptance and delivery

**The user's v2.1.6 Chrome/Tampermonkey acceptance remains passed and closed.** This unreleased refactor has no new browser-acceptance claim and does not reopen the accepted work. If a later release is requested, browser regression evidence should cover that new diff separately. This delivery consists of reviewable working-tree changes and verification records; versioning and publication remain separately arranged.

---

# Historical v2.1.6 test report

## Scope

Predecessor: v2.1.5. This update adds a persisted, default-off option to consider Bilibili-provided Native sources in normal routing. With the option off, script-transformed playurl output and intercepted media dispatch use only safely generated built-in Catalog routes, or block before dispatch if none is legal. The per-tab original comparison mode remains an explicit exception; disabling the script still passes website requests through.

## Contract tests and local verification

On 2026-09-29, `npm run typecheck`, `npm run architecture`, `npm test` (**556 assertions**) and `npm run verify` passed. Verify includes deterministic double build, JavaScript syntax, a v2-only bundle check and package checksum validation; it does not run a security scan. Targeted contracts reproduced concrete failures before their fixes, and the full suite verifies completed behavior. It covers schema-2 defaults, save/sync/reset including a future timestamp across tabs and a delayed settings lock; Catalog-only video/audio choices, output, startup probes, 403 and recovery; preserved backup path/query and same-Host Catalog provenance; opaque, unreplaceable, oversized and non-GET blocking; known PCDN suffixes; Fetch/XHR final destination and redirect observations; page playinfo synchronous handoff, existing values, dynamic getters and unsupported formats; nested Dolby/FLAC audio; mode changes, old player backups including exhausted provenance indexes, SPA generation, in-flight Fetch while disabling the script, XHR partial and stale playurl responses, async results and reused playurl objects across epochs. Native-enabled and per-tab original comparison behavior remain covered separately.

## Security review

Interim Codex Security working-tree diff scan `d3b45965-0037-41aa-b2b9-283d13552e84` identified three low-severity snapshot issues: stale XHR playurl data after SPA, non-monotonic cross-tab reset, and old-object/new-epoch identity reuse. Contracts reproduced them and the source was repaired. A later pre-fix scan `fd6494c2-0a4b-49e4-be68-be8793bbfe44` found that bounded output indexes could omit an emitted external Native backup; a red cap-exhaustion contract led to pruning any output the strict hook could not later recognize. The final post-fix Codex Security diff scan `8e87267d-ecf7-40c8-990b-b9c19ec0b411` covered all 17 changed review items with **zero reportable findings and zero deferred items**. This is source-level review, not real Chrome Network acceptance or proof that browser-owned redirects and unhooked requests use Catalog.

## Chrome/Tampermonkey acceptance

**User approved on 2026-10-01: acceptance passed and is closed.** The user explicitly confirmed that acceptance must not be counted as unfinished work. The coverage limits below remain factual records and do not create pending acceptance, retesting or investigation tasks.

Real Chrome/Tampermonkey acceptance was performed on 2026-09-30 and continued in new user-authorized Chrome tabs on 2026-10-01 (Asia/Taipei), with installed v2.1.6 confirmed. Observed cases cover Catalog-only output/traffic, Native on-to-off synchronization, seek, 720P/2x playback, SPA, fresh fixed Catalog, per-tab original comparison and its exit on reload, whole-script disable/re-enable, settings reset/synchronization, and no-legal-Catalog dispatch blocks with a displayed reason. Two complete fresh-document blocking traces contained zero media requests; an earlier reload interval contained two Native cosov requests whose attribution was not preserved, so that interval remains **unexplained**. Browser coverage did not establish dedicated Fetch/non-GET/opaque cases, active probes, 403/redirect/fallback/core recovery or background/resume; these are recorded coverage limits of the approved acceptance. Chrome reported full version 154.0.8037.58; the tool blocked access to Tampermonkey's version page. Settings were restored to the initial defaults, and one paused test tab was left open. See [archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md](CHROME_v2.1.6_ACCEPTANCE.md) for exact counts, limits and the final screenshot. No signed media URLs or HAR exports were retained. This later browser record does not replace the immutable test report packaged with the release.

---

# Historical v2.1.5 test report

## Baseline and scope

Predecessor: published v2.1.4 commit `09f04e82ffaac5276ed220f89d742cbe03ce0ec5`. This update changes fallback attribution and diagnostics only. It does not add Catalog hosts, change route selection or switching timing, increase probe cost, or change the player-core reload threshold.

## Contract reproduction and verification

New contracts were written before their corresponding runtime changes. A fake-clock incident replay covers brief progress inside the old buffer, 11 zero-byte aborts, a separate timeout, a second fallback with matching video `206`, and two progressing player ticks beyond the buffer boundary. The first fallback never claims takeover. Counterexamples cover wrong host or decision, stale epoch or authority, audio, redirect or changed response URL, HTTP `200`, empty `206`, pause, seek, disabled/comparison mode and lifecycle change. Additional cases verify speed-demand labels, report privacy and 96 KiB export under oversized evidence. A red contract also exposed that oversized report pruning attempted to mutate a frozen snapshot; the repaired path is covered.

Final verification on 2026-09-26: `npm run typecheck`, `npm run architecture`, `npm test` (**349 assertions**) and `npm run verify` all passed. Verify includes deterministic double build, syntax, v2-only bundle and package checksum validation. The Codex Security diff scan is separate from `verify`.

## Security review

Final source and test working-tree diff scan `73db4cdb-1f96-4ec4-930a-e4b3b2b5f844` covered all eight changed TypeScript files and completed with **zero reportable security findings**. It checked route identity, transport response URL metadata, diagnostic privacy and bounded output. This static result does not establish browser playback or the absence of every fault.

## Chrome/Tampermonkey acceptance

Post-release acceptance on 2026-09-26 (Asia/Taipei) used a new public Bilibili video tab in Chrome with Tampermonkey. The script's diagnostic report displayed `current.version: "2.1.5"`, confirming that the updated userscript was running. The player showed 1080P high bitrate, AV1 and the user's existing 2x speed. From 01:38:12 to 01:41:26 local time, the same video played continuously for 3 minutes 13 seconds: sampled playback position advanced from 664.9 to 1051.4 seconds, `paused` remained false, and `readyState` remained 4. No black screen was observed at the sampled checks. Chrome Network showed media XHR `206` responses from `upos-hz-mirrorakam.akamaized.net`; the captured Network events do not establish a complete video/audio request inventory or redirect history.

After that video ended, Bilibili automatically opened the next video. In the new video, pause succeeded, a seek moved playback from about 1213 to 261 seconds, playback resumed with `readyState` 4, and a second pause succeeded. The diagnostic report was opened to verify the version before the timed playback; it was not re-inspected after the pause and seek. Chrome and Tampermonkey version numbers were not captured. The user's 2026-09-26 approval formally accepts the observed v2.1.5 normal-playback validation. The transport fault did not recur, so actual black-screen fallback recovery remains **contract-tested, real-browser pending**; no real fallback takeover is claimed.

---

# Historical v2.1.4 test report

## Baseline and scope

Immutable predecessor: v2.1.3 commit `6322c06`. This release addresses three findings from Codex Security scan `cf49b015-ecb4-48d8-91f9-2b61adb709f4`: a Fetch checked/sent destination mismatch, lower-trust Native route contamination, and active probe redirects. It also closes the same Fetch boundary after startup waiting and clears provisional route invalidation when trusted playurl takes authority. CDN ranking, playback speed, Codec selection and measurement budgets are unchanged.

## Automated reproduction and verification

New contract cases first reproduced a provisional invalid-host flag suppressing a newly trusted exact URL, a mutable Fetch URL and method being sent after an SPA generation change, and a prohibited original host being sent from the same stale-generation branch. Each failed before its corresponding runtime fix. The completed suite passes **311** domain/controller/adapter assertions. Existing and new cases cover forged `Request.href`, string/URL/Request input, GET/POST and `init.method`, streaming body, abort and single-reader behavior, hint/API ordering and handle revocation, stale plans/probe results, direct 206 Range acceptance and same-/cross-host redirect rejection.

`npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` passed on 2026-09-24. Architecture check covered 28 TypeScript modules with no import cycle. Verify includes deterministic double build, syntax, v2-only bundle checks, package equality and SHA-256. It does **not** include Codex Security.

## Security verification

An interim v2.1.4 working-tree diff scan (`724a180d-130a-43a1-9247-5f62d5447a02`) found the startup-wait/SPA branch still dispatched the original mutable Fetch input. That finding was reproduced by a failing contract test and fixed; no release was made from that snapshot. The final Codex Security diff scan (`dc9c0242-05a9-46cf-bc69-feb8136055ab`) reviewed 11 changed source/config/test/release items and completed with **zero reportable findings**. This is a static diff-scan result, not a Chrome Network result.

The three findings from the original scan were checked individually against the current source and passing contracts:

- `csf_593a2c7f450a4906aaf271ca` — **fixed**: enabled Fetch constructs one platform `Request`, reads its URL/method/signal and sends that Request or a rewrite built from it; forged `href`, method override, mutable input after preflight, HTTPDNS and forbidden media cases pass.
- `csf_39f7c70dad56927d52424c3e` — **fixed**: trusted API promotion revokes provisional Native handles, plans, invalid state and authority; later hints and old async results cannot reinstate candidates or update health. Hint/API ordering, cross-key exact URL and stale-result cases pass.
- `csf_f11ae85718c76268b449316e` — **fixed**: startup and healthy probes set `redirect: 'error'`; only a direct, same-host HTTPS `206` response can create a valid sample. Redirect, mismatched-host and absent-response-URL cases pass; failed active probes do not create a playback circuit.

These verdicts establish source-level remediation and preserved ordinary Request/Catalog/probe behavior. Whether Bilibili's real Chrome media entry points follow the tested hooks remains part of post-update acceptance.

## Chrome/Tampermonkey

No current-version Chrome acceptance is claimed. Following the user's requested order, publish first, then the user updates Tampermonkey, then use an extra Chrome tab to compare actual media request URLs, response hosts and redirects with the script's bounded diagnostics. Source-level contract tests cannot prove that every browser media entry point is intercepted.

---

# Historical v2.1.3 test report

## Scope

Only user-facing wording in the control center and player setting panel changed. Internal route, transport, measurement and recovery state machines, the CDN roster, settings values and the machine-readable diagnostic report remain unchanged. The v2.1.2 release artifact is not overwritten.

## Automated verification

On 2026-09-24, `npm run verify` passed: TypeScript typecheck, architecture boundaries, all 264 domain/controller/adapter assertions, deterministic double build, JavaScript syntax, v2-only bundle checks, package equality and SHA-256 validation. The test runner's first sandboxed invocation could not resolve its temporary esbuild entry because Windows denied access to the temporary directory; rerunning the same command with the permitted environment passed all 264 assertions. This was a test-environment failure, not a functional assertion failure.

## Chrome/Tampermonkey

The new wording cannot be inspected in the user's installed Tampermonkey script until v2.1.3 is published and installed. Chrome UI inspection is therefore pending after update; no playback or CDN behavior is claimed to have been verified by this copy-only change. No Code Security scan was run.

---

# Historical v2.1.2 test report

## Baseline and scope

Immutable predecessor: v2.1.1 commit `305244d57119799b94b5971aabc37c1df991a757`; packaged userscript SHA-256 `20414a4e33cc124db7a0b52c60dcfcc104e69de4ad6ecf1cea5a2051421f08f7`.

This release adds host-level playurl-to-segment lineage, stream-specific Catalog incompatibility, fallback after-state correlation and a per-tab original signed-URL comparison mode. It does not change the CDN roster, scoring formula, player speed, Codec preference or measurement budget. No Code Security scan was run.

## Automated reproduction and verification

The added contracts first failed for four concrete gaps: an original backup promoted after a prohibited primary still had the blocked primary's plan; a same-host unrelated decision could impersonate fallback after-state; a later no-alternative recovery left an older fallback looking current; and an exact signed URL with an unrecognized path lost its playurl output lineage. After repair, the suite passes 264 domain/controller/adapter assertions. It also checks actual native Fetch/XHR dispatch, strict prohibited-host handling, Catalog 403 avoidance in later ranking, probe-result isolation, fallback plan versus later request/response, and original mode without preflight or automatic recovery.

Passed on 2026-09-24: `npm run typecheck`, `npm run architecture` (28 TypeScript modules, no import cycles), and `npm test` (264 assertions). `npm run verify` additionally checks deterministic double build, JavaScript syntax, v2 bundle invariants, package equality and SHA-256. The packaged SHA-256 list is the authority for the release artifact.

## Chrome/Tampermonkey evidence and pending acceptance

An additional Chrome test tab on the previously installed script produced actual Network `206` media responses from `upos-sz-mirroraliov.bilivideo.com` and `upos-hz-mirrorakam.akamaized.net` during playback/seek. The event buffer was truncated, so this does **not** prove complete first-request interception, fallback, or v2.1.2 behavior. A later computer-use attempt stopped because the Windows browser URL could not be determined confidently; no further browser action was taken. Only hosts/status were retained, not signed URLs, paths or queries.

Per the user-requested order, formal v2.1.2 Chrome Network acceptance follows push, Release and the user's Tampermonkey update. In an extra tab, compare a newly delivered playurl host and a later segment's actual Chrome Request URL, script RequestId/DecisionId, response host and status; then check a real legal fallback's subsequent request and the per-tab original comparison mode. If no real fallback occurs naturally, report that case as unverified in Chrome rather than fabricate a failure. Browser redirects or non-Fetch/XHR entry points remain a known boundary.

---

# Historical v2.1.1 test report

## Baseline and observed browser evidence

Immutable predecessor: v2.1.0 commit `f62cb5e18974b58e6d9b3d3741beeb4e52c8bb86`; packaged userscript SHA-256 `2403f7021c98b7b4f4b2303a05c5b85bd58c4c677c73ec0db8b3a2124e962137`.

Before the code change, an additional Chrome/Tampermonkey video tab showed the BiliCDN v2 player-panel entry and actual Network media XHR traffic. After a reload, the retained Network events included seven GET media requests to `upos-sz-mirroraliov.bilivideo.com` and `upos-hz-mirrorakam.akamaized.net`, each with a 206 response at the same host. The earliest Network events were evicted (`truncated=true`), so this capture does not establish the first-request/preflight timing. A subsequent seek capture was not truncated: eight GET/XHR requests to those two hosts received 206 responses. All eight URLs had a media suffix and `/upgcxcode/`, so they do **not** reproduce the missing-suffix case. Network alone did not establish video versus audio for each request, and no natural fallback occurred. No HAR, signed URL, path, query or token was saved to the repository or report. This is a limited v2.1.0 baseline, not post-update v2.1.1 acceptance.

## Reproductions and automated verification

New tests first failed on a current-epoch, suffix-less exact signed URL being rejected by the Vault, and on non-GET requests to a prohibited media host reaching the native transport. The repaired suite has 231 passing assertions. New contracts cover exact opaque observation without Native selection or probe, strict host blocking on opaque and non-GET Fetch/XHR, legal exact opaque backups in playurl output, Fetch `Request` dispatch to the chosen host, explicit XHR timeout labeling, partial hook-install rollback, and distinct hook/recognition/native-call/response diagnostic stages. Existing tests cover GET replacement, XHR revalidation at `send()`, abort, reuse, Fetch cancellation and one-reader behavior.

Passed on 2026-09-23: `npm run typecheck`, `npm run architecture`, `npm test` (231 assertions) and `npm run verify`. The verifier completed deterministic double build, JavaScript syntax, v2-only bundle checks, package equality and SHA-256 validation. The packaged SHA list is authoritative. No Code Security scan was run.

## Chrome/Tampermonkey acceptance after update

Publication precedes formal Chrome acceptance per user instruction. After installing v2.1.1, use an extra test tab to compare each script-observed RequestId/DecisionId, method, media kind, original/target/response hosts and status with Chrome Network. During the measured interval, newly dispatched media requests to a prohibited host must be zero; a claimed host rewrite must match the browser's actual Request URL. Repeat first play, seek and a real fallback. If a request remains unmatched, retain only a sanitized initiator classification and continue investigating. Source-level passing tests do not prove coverage of Worker-initiated traffic or browser redirects.

---

# Historical v2.1.0 test report

## Automated scope

Baseline: published v2.0.4 commit `363d527136c876a162d06c78d77e8663ce2a62cc`. New tests first reproduced first-Catalog cold selection, unattributed first-request rewrite, abort-triggered probing, missing no-failure startup rescue and missing bounded deadline; runtime was then changed.

The source-level suite has 206 passing assertions. New contracts cover legal original pass-through before preflight, exact signed backup versus synthesized Catalog URL, measured Catalog victory, low-confidence original fallback, a shared three-second deadline with hanging probes, previously aborted requests starting no probe, current-stream 16 KiB Catalog compatibility, stream-scoped Catalog 403 exclusion, strict blacklist admission, actual Fetch/XHR native dispatch after the gate, XHR abort and explicit-timeout semantics, sequential fair challengers, 15-second no-progress fallback and a single first-start core reload. Existing restriction, Native group isolation, host-lock, disabled, Fetch single-reader/cancel, XHR and incident tests remain included.

Verification commands and reproducible build/checksums are recorded by `npm run verify` and the packaged build manifest. This report does not equate source-level fake transport/player contracts with real Chrome playback. No Code Security scan was run.

## Real Chrome / Tampermonkey

Pending publication and user update, per the requested order. In an additional test tab, compare the first browser media request's true dispatch time and target/response hosts with the preflight's three-second window and result; then check automatic quality, seek, SPA, background return, 2x as a user selection and no healthy-probe-induced switch. A naturally occurring 6006 or dead core is not claimed to have been reproduced in Chrome.

Unsupported entries—including synchronous XHR, XHR with an explicit finite timeout, unknown/unmatched media, Worker-initiated media and URL shapes that cannot be safely rewritten—are not held by preflight; diagnosis must mark them as such. A probe predicts only the sampled URL and interval, not later CDN availability.

---

# Historical v2.0.4 test report

## Current release

Immutable predecessor: v2.0.3 commit `28b1cf57a3c3eaeafc30c282f9f5ec67a8406c0a`, userscript SHA-256 `667476a1a8b04c75437410c35ac15b5d52f568682d7d3934f55e22650507a19d`.

Before changing runtime logic, the new source-level test failed because a default-unavailable Catalog media URL with `os=mcdn` passed unchanged. A separate no-file controller reproduction showed that an audio-blacklisted host remained eligible for ungrouped media. The previous control-center button stored user blacklists as video-only; a regression reproducing an existing stored row failed for audio before the compatibility fix.

The functional suite now has 166 passing assertions. New contracts cover default-unavailable PCDN/live/resource pass-through, unrestricted live preservation, blocked playurl primary/backup, user-wide black against matched audio, ungrouped audio-black eligibility, black/dead special-media rejection, native Fetch/XHR refusal and enable-between-XHR-open/send revalidation. Existing video/audio recovery, Native exact URL, host-lock, disabled mode, cancellation and single-reader tests remain included.

Automated verification passed on 2026-09-22: `npm run typecheck`, `npm run architecture`, `npm test` (166 assertions) and `npm run verify` (deterministic double build, JavaScript syntax, v2 bundle invariants, package equality and checksums). No Code Security scan.

Real Chrome/Tampermonkey v2.0.4 acceptance: pending publication and user update. No current-version playback or absence of black-screen regression is claimed. A userscript cannot retroactively prevent a browser redirect or intercept media initiated outside its playurl and page Fetch/XHR paths; if Bilibili issues those requests, browser network initiator evidence is needed to evaluate coverage.

---

# Historical v2.0.3 test report

## Current release

Immutable predecessor: v2.0.2 commit `7739d5ada141d4d35192dc6ae06693ace25f7d13`, script SHA-256 `d36b1271af5107b14c3820d7afc55ea56ba0ec0f307643b2b1c2471792745ea8`.

The installed v2.0.2 report showed repeated zero-byte Catalog aborts followed by successful Akamai fallbacks in multiple groups. This does not establish why the browser aborted. The same report had playing media but stale pause-armed recovery state.

Before changing runtime logic, separate source-level contracts failed for (1) a new quality retaining its cold Catalog plan after observed Native affinity, and (2) healthy short resume retaining pause-armed. Both now pass.

The suite has 148 passing assertions. Additional checks cover different-quality exact Native URL, no fabricated observed affinity, missing Native capability, explicit fixed mode, and a newly blacklisted affinity host. Existing v2.0.2 restriction, backup, responseHost, incident, playback-rate and cancellation tests remain included.

Passed on 2026-09-21: `npm run verify` completed types, architecture, all 148 assertions, deterministic double build, syntax, package equality and checksums. No Code Security or independent security suite.

Chrome/Tampermonkey acceptance of v2.0.3 is pending user installation. The supplied v2.0.2 report is user runtime evidence, not a v2.0.3 real-browser test. No natural dead-core reproduction is required for publication. Historical black-screen causes remain unconfirmed. See `archive/retired/docs/POST_RELEASE_v2.0.2.md` for the evidence trail.

Deliverables: `Release/v2.0.3/` script, changelog, report, manifest, SHA-256; GitHub Release attaches only the script. No previous release directory is overwritten.

---

# Historical v2.0.2 verification (unchanged scope)

## Baseline and evidence

Immutable baseline: v2.0.1 commit `66f7c36dd3605933342ec0536892753f5bfe8cca`, userscript SHA-256 `ec2be1e39cea70ddfb04241b26b23b7f787d63896bea100bcb5e12cc8d3ef279`.

The submitted report establishes an uninitialized video core and no reload, not a proven connection to prohibited cosov. Recorded successful video was rewritten to mirrorali; the last video terminal was an abort. The root cause of the historical black screen remains unconfirmed.

## Reproductions and functional verification

Before runtime fixes, new assertions reproduced: empty response URL inventing a host, prohibited original retained in playurl backups, a player backup rewritten to primary, paused dead core failing to create an incident, and a challenger selecting default-unavailable cosov.

The complete source-level functional suite now has 140 passing assertions, including:

- Existing evidence/ranking, limits, cancellation, XHR JSON, disabled behavior, rate preservation, core restore and safe measurement contracts.
- Default-unavailable output removal; independent black/dead cases against cached fallback, fixed CDN and playurl output.
- Native XHR open target; restriction added between open and send; single native send; no-alternative XHR/Fetch local blocking; disabled original pass-through.
- Permitted Catalog backup adoption and subsequent group affinity plan; weak query match cannot claim backup role.
- Exact Native audio backup, video-affinity isolation, invalid Native exclusion on request/output and generation cleanup.
- Host-lock cannot restore a dead root; no-alternative player output contains neither prohibited primary nor backups.
- Missing response URL stays null; target-host network failure still opens the appropriate circuit; latest abort does not erase last successful video observation.
- Sustained dead paused core captures evidence without reload; timer gaps and initial startup do not falsely count as continuous prior-healthy death.
- First paused-tick play observer, original return preservation, untrusted calls rejected, trusted long-pause intent while paused, one reload, reset restores owned method.
- Late manual mark and 1,000 subsequent successes preserve the frozen core incident; 128 KiB recorder and 96 KiB report checks.

These are source-level fake-player/transport contracts, not real Chrome playback. Passing assertions are not claimed to exhaust all browser-specific URL or player lifecycle variants.

## Release verification

Passed on 2026-09-21: `npm run verify` completed all 140 assertions, strict types, architecture, deterministic build, syntax, bundle/package and checksum checks with Node 26.8.1, TypeScript 7.0.2 and esbuild 0.28.2.

Run `npm run verify` for strict TypeScript, architecture/cycles, all functional assertions, deterministic double build, JavaScript syntax, bundle invariants, package equality and SHA-256. The release checksum list is authoritative. No Code Security scan or independent security suite is run.

## Real Chrome / Tampermonkey: pending after installation

Per user instruction, publish first, then perform targeted acceptance after the user updates. No preserved failed/paused tab was operated during this code repair. No v2.0.2 Chrome pass is claimed here.

Use an additional tab: compare native outbound/response hosts with the report; check legal backup behavior, prohibited-host absence, fixed/automatic mode, user-selected speed, one seek/quality/SPA/background-return sequence, and incident marking. Natural dead-core reproduction is not a publication gate. Do not infer consumed media or a black-screen cause solely from a route plan or host label.

## Deliverables

`Release/v2.0.2/`: userscript, CHANGELOG, TEST_REPORT, manifest and SHA-256 list. GitHub Release attaches only `BiliCDN_TW.user.js`. Existing v2 storage is preserved; no history patches, CI, remote code or telemetry are added.


<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.11 發行驗證 — 2026-10-10

以 `c836a17818cd4ae86195e41b1e1c0933cff8cab0` 為基準，納入 BR-03 內容識別修復。使用者已授權直接提交、升版、推送與發布，並要求將此預設交付規則保存於 [AGENTS](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/AGENTS.md#release-rules)。本報告是 **v2.1.11 現行發布報告**；已於 2026-10-10 01:52（Asia/Taipei）正式發布，01:53 公開 latest 下載讀回一致。修復前後對照見 [BR-03 報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)，目前待驗收範圍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 修復與相容性

可信 playurl 的所屬請求 cid 優先識別內容；同 cid 的排列、畫質或編碼清單完全換組均保留 epoch，不同 cid 即使共用路徑也重設。缺少 cid 時以有界完整父目錄集合備援，影片 128／音訊 64，忽略主機、查詢與順序，重疊保留歷史。低信任提示不能更新基準，Fetch／XHR metadata 保持請求 context 所有權，真正換片仍同步撤銷舊工作。

沒有有效 cid 也沒有共同路徑時採保守重設。不新增 API 逆序回應政策、公開橋接、持久鍵或 schema；schema 2、Vault 唯一授權、MP4／FLV 簽名刷新、嚴格影音隔離、Fetch 單讀取器及 Worker 不介入保持原契約。

## 自動發行驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。在 2.1.11 版本設定重新執行必要命令；執行結果與封裝校驗存入本機 `.work/release-v2.1.11/`。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 來源／測試通過 |
| `npm run architecture` | 44 個執行期模組、無循環 |
| `npm test` | 19 套件、382 個具名案例通過；新增 43 個 BR-03，沒有 only／skip／todo／cancelled |
| `npm run verify` | 型別、架構、382 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗通過 |

修復前的原四契約 2 通過／2 失敗與擴充紅燈紀錄保留在修復證據目錄，不混算通過；正式測試不匯入調查目錄。文件連結／錨點、受審雜湊、歷史產物與 `git diff --check` 另行核對。

## 獨立安全差異審查

BR-03 Codex Security 掃描 `a9c3fb49-d46b-4a8e-81ee-29856ab3e908` 已於 2026-10-10 01:09:35（Asia/Taipei）封存。完整覆蓋 14 個變更來源／測試檔，0 個可報告發現、0 個待驗證候選。快照 digest：`codex-security-snapshot/v1:sha256:31543372cedbba943e0f4de533b3d34d68790794e4c471de11ee123284685033`。

此次發行只變更版本設定、metadata 版本與交付文件；受審 14 檔保持 SHA-256 一致，其他執行期邏輯未再修改，因此沿用該已完成差異審查，沒有宣稱重新掃描。安全封存產物不回寫；這不是全儲存庫安全保證。

## 封裝與更新

正式產物為 `Release/v2.1.11/BiliCDN_TW.user.js`，**296,341 bytes**，SHA-256 為 `9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`。GitHub Release 僅上傳此腳本；CHANGELOG、TEST_REPORT、BUILD_MANIFEST、SHA256SUMS 留在儲存庫。更新 URL 維持 [最新使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，發布後核對版本、大小與 SHA-256。舊 Release 與原始調查文件保持雜湊一致。

## 發布確認

2026-10-10 01:52（Asia/Taipei）完成 [v2.1.11 正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.11)。修復提交 `d3d1bc3185d51b62891920135b4126441e059696` 與 annotated tag 已推送，標籤指向該提交；唯一附件為 BiliCDN_TW.user.js。01:53 無登入的公開 latest API 與下載 URL 讀回確認版本 2.1.11、296,341 bytes 及上述 SHA-256 一致，現有 Tampermonkey 更新網址已提供新版；不宣稱使用者裝置已自動安裝。

發布前檢查 18 份 Markdown、319 個本機／儲存庫連結與 91 個錨點，0 錯誤；82 個來源／測試檔與 14 個受審檔雜湊一致，262 個歷史 Release 檔及兩份原始調查文件不變。上一版完整報告已保存。封裝的報告與 CHANGELOG 是發布前準備快照；此後只更新現行文件，Release 快照不回寫。

## Chrome／Tampermonkey

**2026-10-10 03:02–03:36 新目標續測追加：調查交付完成，整體產品驗收尚未全通過。** 正常原生 4K／8K seek 約 2.393／2.398 秒，長暫停與畫質分步操作正常；受控 27.829 秒長 seek 及安裝版 Monitor 90 秒時鐘對照定位到持續 seeking 抑制救援，原始網路起因未證實。42 個新增受控恢復／R04／鎖／生命週期案例通過，真 gate 邊界與真正 SDK 核心替換另有實測；真正 background 未取得 hidden 前提，SDK 自然拒絕等不冒稱通過。新增 BR-05 取消原因遺失在 Chrome／安裝版確認，獨立 Node 為 3 control pass／4 contract fail、exit 1，**不是正式套件通過結果**。完整分層證據與限制見 [剩餘驗收報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_REMAINING_ACCEPTANCE.md) 與 [BR-05](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md)。BR-04／05 未修復；來源、正式套件及 Release 未改，本輪不新增完整 verify 或安全掃描結果。下文保留之前各輪的時間點。

**2026-10-10 02:58 續測追加：BR-04 已由 Node 疑點升為真正 Chrome 155／v2.1.11 安裝版確認缺陷。** 真正 3 候選起播 gate 中，SyntaxError 正常對照完成一次；二次同步限制重入使原生 UNSENT、metadata sent、終止事件遺失，並產生未處理 InvalidStateError。完整事件及攔截窗口未截斷，已清理並達成找問題／詳細報告的替代完成條件；沒有修復或宣稱全面驗收。見 [BR-04 報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)。下方發行及中途暫停文字保留其時間點。

2026-10-10 修復輪的真正 Chrome 154 **來源隔離** BR-03 31／31、BR-02 對照 31／31 通過。成功輪合成請求於送出前攔截，事件未截斷、hooks restored；作廢輪與清理限制見 [BR-03 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)。本次發行不新增瀏覽器執行證據。

**2026-10-10 v2.1.11 Tampermonkey 安裝版部分驗收完成，依使用者要求暫停。** 實際產物一致；BR-03 31 個有效案例、BR-02 42 個原生對照通過，真正 startup gate 與 R04 取得部分證據，同片畫質及網站播放器入口 seek 正常。新增暫定 BR-04 在獨立 Node 契約重現，Chrome 複核尚未執行，不能算確認的 Chrome 缺陷或正式套件結果。完整證據、作廢輪與清理限制見 [中途報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_PROGRESS.md)。網站僅使用指定 [風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)；BR-01 原 87.8 秒停滯、完整 gate／恢復／R04 矩陣保持待定位／驗收，不宣稱整體通過。

## 歷史驗證導覽

<a name="br03-local-fix-verification--2026-10-10"></a>

- [BR-03 發行前本機完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#br03-local-fix-verification--2026-10-10)

<a name="bilicdn_tw-v2110-release-verification--2026-10-09"></a>

- [v2.1.10 完整發布／修復前驗收正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2110-release-verification--2026-10-09)

上一版完整正文已按日期移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，保留原始限制與錨點導引。現行行為見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)，歷史待完成不自動成為目前待辦。

<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

- [v2.1.9 完整歷史驗證與當時瀏覽器狀態](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v219-release-verification--2026-10-09)

v2.1.8 的完整正文於 2026-10-09 移入歷史報告，保留原始數值、日期、發布及瀏覽器限制。舊錨點導引如下：

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 發行驗證 — 2026-10-04](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)

<a name="reproduction-and-implementation"></a>

- [v2.1.8 重現與實作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#reproduction-and-implementation)

<a name="automated-verification"></a>

- [v2.1.8 自動驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#automated-verification)

<a name="separate-security-and-browser-evidence"></a>

- [v2.1.8 安全與瀏覽器證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#separate-security-and-browser-evidence)

<a name="publication-confirmation"></a>

- [v2.1.8 發布確認](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#publication-confirmation)

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

- [v2.1.8 Chrome／Tampermonkey 觀察](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#chrome--tampermonkey-observations-after-standard-update)

更早十二個區塊於 2026-10-06 移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，正文保留原文與當時限制。原主要標題錨點保留為導引；歷史「待完成」不構成目前工作，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。文件搬移與本次檢查另見 [文件維護歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

<a name="published-bilicdn_tw-v217-test-report"></a>

- [v2.1.7 已發布驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#published-bilicdn_tw-v217-test-report)

<a name="historical-modularization-verification--before-release"></a>

- [發行前模組化驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-modularization-verification--before-release)

<a name="historical-v216-test-report"></a>

- [v2.1.6 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v216-test-report)

<a name="historical-v215-test-report"></a>

- [v2.1.5 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v215-test-report)

<a name="historical-v214-test-report"></a>

- [v2.1.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v214-test-report)

<a name="historical-v213-test-report"></a>

- [v2.1.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v213-test-report)

<a name="historical-v212-test-report"></a>

- [v2.1.2 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v212-test-report)

<a name="historical-v211-test-report"></a>

- [v2.1.1 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v211-test-report)

<a name="historical-v210-test-report"></a>

- [v2.1.0 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v210-test-report)

<a name="historical-v204-test-report"></a>

- [v2.0.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v204-test-report)

<a name="historical-v203-test-report"></a>

- [v2.0.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v203-test-report)

<a name="historical-v202-verification-unchanged-scope"></a>

- [v2.0.2 歷史驗證（當時範圍不變）](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v202-verification-unchanged-scope)


## 2026-10-10 換版保存：v2.1.13 完整正文與 BR-06 調查追加

以下原文保存換版前未提交驗收文件、版本、日期與限制；現行狀態見最新版報告。

<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.13 發行驗證 — 2026-10-10

基準 v2.1.12／c924b0216fe0a8f7a624f391d44b36660daca433。本輪修復 BR-01 A／B／C，Auto 是主要使用場景，不鎖畫質或修改 ABR。**修復與發布完成；實際新版部分安裝版驗收已有有效證據，完整矩陣未結案。** [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_FIX_REPORT.md) 分開記錄自動、來源隔離、安全及實際安裝版。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。先登記原三個缺陷與三個正常對照，未修來源為 3 pass／3 fail／退出碼 1，失敗紀錄獨立保存。最終完整 verify 通過：44 執行期模組、19 套件、474 正式案例（新增 22 控制器及 4 適配器）、43 非入口模組匯入純度、型別／架構、確定性建置、語法、v2-only 與暫存封裝 checksum；沒有 failed／only／skip／todo／cancelled。git diff --check 通過。證據位於 .work/functional-fixes/br01/2026-10-10-c924b02/。

## 獨立安全審查

Codex Security 6aa22069-fc37-4842-a30c-2727ece75b37 已封存：17 個變更來源／測試檔完整覆蓋，0 可報告發現、0 待驗證候選，封存時無快照漂移。Digest：codex-security-snapshot/v1:sha256:87e2a78798ea66c638e2e5f8bcd2c4a748469536bd2b046c39f482655c9b1911。7 個執行期來源保持受審 SHA-256；其後只有四個補充適配器契約、版本及文件修改，另由主代理核對，不屬於原安全快照。完整報告由插件管理，與 verify 分開。不是全儲存庫無漏洞保證。

## Chrome 來源隔離

22／22：1 倍／2 倍的 15／30／15 秒邊界、每段一次備援／重載、核心替換、無進度終止、正常短 seek 和清理，另有原生 Blob Fetch／XHR 對照。實際適配器／控制器搭配合成 DOM 狀態、記憶體儲存與 FakeClock，**不是實際經過 12／30 秒的網站延遲或 Tampermonkey 安裝版**。首輪失敗找出首次進度沒有釋放停滯段，已修正；作廢輪證據保留。隔離 iframe 已移除。

## 發布與安裝版

v2.1.13 於 2026-10-10T05:07:23Z／台北 13:07:23 [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.13)，來源／標籤提交 fc2b3b5ed58e307d8c87e2326769cfa8a390cf46，main／peeled tag 核對一致。唯一附件 BiliCDN_TW.user.js：314,188 bytes，SHA-256 646515874ea4088b11830907826c5d1275f823c155a5fb1523999a9755ffa816；無登入公開 latest API 與下載核對版本／大小／雜湊完成。Chrome 實際執行 body 完整包含該腳本，singleton 一個。發布後現行文件另追加讀回與驗收結果，Release 快照不覆寫。

新版 Auto 1／2 倍速、分開的 12 秒影片延遲已取得有效恢復證據，音訊通行且有效窗口無 Fetch／Network 事件截斷。1 倍尋位 16.772 秒，一次備援／零重載；2 倍尋位 34.395 秒，一次備援／一次核心重載，之後時間及影格恢復。65 秒影片持有輪由網站約第 24 秒提前暫停／外部核心替換，腳本撤銷且未持續重試；因此安裝版「重載後完整 15 秒無進度退出」仍待取得前提，不能用本輪或來源隔離代替。故障期間新操作、真正 hidden／晚到提交等完整矩陣亦未結案。受控 98 個 IDs 沒有記憶體／持久樣本，schema 2 保持；全部攔截／觀察器已清理。詳見 [安裝版證據及續行](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.13_ACCEPTANCE.md)。

## 剩餘限制

**2026-10-10 約 13:45–13:57 續測確認 BR-06，未修復。** 在同一指定風景片、實際 v2.1.13 Auto 1／2 倍，新可信 BODY 方向鍵 seek 只更新 seekRevision，userRevision 未增加；分別 8.205／6.986 秒便觸發備援。滑鼠故障對照取得新修訂及寬限，三個窗口無事件截斷；獨立正確契約 2 fail／3 pass、退出碼 1，型別檢查通過。既有正式 BR-01 application 22／22、adapter 4／4 重跑通過，未覆蓋此入口，不能把新失敗算入通過。62 個受控 IDs 無記憶體／持久樣本，自有攔截及觀察器已清理。已達成「找到問題並交付報告」的自主目標，完整安裝版驗收未通過；來源、正式測試、版本與 Release 不變，沒有新的安全或完整 verify 宣稱。詳見 [BR-06 根因與證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)。

原 87.785 秒自然網路起因未定位，其他完整產品驗收仍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。控制觀察不能認證頁面核心；自有 reload 等待中、未經可觀察 reload 方法的外部替換，不能完全辨識因果。沒有有效 cid 或共同路徑的同片仍保守重設。schema 2、持久鍵、公開設定、依賴及更新 URL 不變。

## 歷史驗證導覽

<a name="bilicdn_tw-v2112-release-verification--2026-10-10"></a>

- [v2.1.12 完整正文及 Auto 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2112-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

- [v2.1.11 原錨點](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2111-release-verification--2026-10-10)

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 原錨點](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)


<a name="bilicdn_tw-v2119-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.19 BR-01 空媒體鍵盤修復驗證 — 2026-10-11

基準 v2.1.18／953ffeaebff686eaaffe27ef2fe622bb97fa1b95，開始時工作目錄乾淨。詳見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_NATIVE_KEYBOARD_FIX_REPORT.md)。本機必要驗證通過；完整實際安裝 BR-01 尚未記為通過。

| 項目 | 本輪證據 |
| --- | --- |
| 修改執行期前正式正確契約 | 4 fail／7 pass；原失敗記錄保留 |
| 新正式回歸 | 14 項，既有 application 明確匯入 |
| typecheck／architecture | 通過；44 執行期模組 |
| npm test | 19 套件／755 項；0 fail／skip／todo／cancelled |
| 最終 npm run verify v2.1.19 | 退出 0；755 契約、確定性建置、語法、v2-only、校驗 |
| Chrome 原生可信鍵盤來源隔離 | 30／30；原生空 video，1／2 倍，不覆寫 getter |
| Codex Security 差異 | 已封存，2／2 凍結來源／測試項，0 候選／0 發現 |

Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2。私有證據 .work/functional-fixes/br01-final/2026-10-11-953ffea/ 保存修復前後、正式結果、Chrome 原生入口及檢查點。來源 Chrome SDK／核心／時鐘是自有模型，不代表實際 Tampermonkey。

## 安全範圍

掃描 d3d31ada-7afb-4e77-9fb4-e0378a0db1d2 於 2026-10-10T19:50:51.270579Z 封存。PlayerAdapter／br06.ts 全差異與控制器／Vault 消費邊界覆蓋，獨立架構確認。完成工具曾因草稿缺欄失敗；補齊真正覆蓋後成功封存並重新讀取，不將錯誤記為通過。policy helper 無法看見根目錄，人工確認根 SECURITY.md 是唯一適用政策並完整閱讀。版本／文件／產物於掃描封存後獨立核對。

## 發布與安裝

v2.1.19 於 2026-10-10T19:56:06Z 正式發布；發行提交／發布時 main／peeled tag 為 ee48076c0ae031dcaed0c2cec0b875cd07f6ddf6，tag ref 為 8352b52d2f5a9aab8de29fe17e2aeac444fd988a。唯一 BiliCDN_TW.user.js 附件 335,996 bytes，SHA-256 d51be6e17ca8263052b1022b465f4f8247f358eaa654be8ec1f128579b2354d1；19:56:35.988Z 無認證公開 latest 完整相同。發布通過，Release 快照不回寫。完整安裝驗收須重新確認本體／singleton，Auto1／2、15／30／15、不重試、新操作／晚到 SDK、拖曳、真正背景、政策／影音／傳輸／內容／gate 各自取得有效證據。原 v2.1.18 新键盤窗口證明本次缺口；Network 校準缺口不能算完整期限。沒有有效前提與證據者判為不通過。

19:58:35Z 新載入指定影片的完整本體 exact v2.1.18、非 v2.1.19。公開更新網址已實際開啟 Tampermonkey 使用者腳本更新頁；瀏覽器工具因 chrome-extension 協定安全政策拒絕操作，禁止替代通道繞過。此時安裝新版前提不通過，已請使用者完成該頁更新，不再次要求發布授權。

原 87.785 秒自然網路起因獨立未定位，不作本次修復門檻。公開 API、schema2、Auto／ABR及網路授權不變。

## 歷史導覽

- [v2.1.18 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2118-release-verification--2026-10-11)
- [v2.1.17 BR-01 二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)
- [更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)


<a name="bilicdn_tw-v2120-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.20 BR-01 新意圖位置保存驗證 — 2026-10-11

## 2026-10-11 IAB 第 6 輪：非 BR-01 TODO 與 BR-10

以 `f8f6f87` 為基準，只使用內建瀏覽器繼續 P 項，**已確認 BR-10 控制中心鍵盤衝突，尚未修復**。原生 Tab／Enter／Space 的自有封閉 Shadow DOM 能力校準通過；實際 v2.1.20 設定按鈕的可信 keydown 被取消，Enter 將焦點移至彈幕輸入框。未修改 UI 來源的隔離頁取得 2 個正常對照通過、2 個缺陷情境失敗，見 [BR-10／第 6 輪報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_BR10_CONTROL_CENTER_KEYBOARD.md)。

BR-01 沒有恢復、既有通過案例未重測。P01／P02 無新自然 gate 前提，沒有反覆載入；P04 延後命令與 P05 完整 UI 報告／複製在新缺陷出現後未執行，不能補算通過。實際完整本體及唯一 singleton 核對；8 個方法包裝、7 個 listener 還原，設定未改，pending／observer timer 為零；來源頁 listener／timer 清理、記憶體儲存鍵零，最終 IAB 分頁為零。沒有故障攔截或受控學習樣本。

自有來源模型型別檢查與保存證據 7 組一致性檢查通過；這不代表 BR-10 契約通過。產品來源、正式套件、版本與 Release 不變，沒有新的完整 npm／verify 或安全掃描，也沒有升版／發布。

## 2026-10-11 使用者決定跳過 BR-01

使用者要求停止繼續投入 BR-01；剩餘專項驗收已移出現行待辦，不再自主續測或作為其他工作／發布門檻。歷次通過、無效與未執行結果原樣保留，跳過不改記為通過；既有正式回歸不刪除。只有使用者明確要求才恢復 BR-01。P01～P05 保持獨立範圍，現況見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。本次只改文件，沒有新增執行期、瀏覽器或安全驗證。

## 2026-10-11 IAB 收集器修復與第 5 輪

以 `f5f26e3` 為基準，[第 5 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md) **收集器修復、7 個新增正式契約及 IAB loopback 隔離通過；完整 tooling 30／30、typecheck 通過。** 新增 B02 第二次滑鼠 seek 1 倍的 30 秒尾段通過：新修訂後 16.459 秒備援一次、31.460 秒實際 reload 一次，保存最新目標。P03 兩個自然 API 均與原請求 cid 相符，epoch 維持 0，限定同片安裝子項通過。

B02 播放器焦點／滑鼠 2 倍在新操作後約 19.7 秒由網站換核心並暫停；B03 1 倍修正命中後 dragging 成立，但 22.596 秒後前提中斷。B06 空核心期間的新按鍵未取得修訂，無產品判定；沒有反覆開相同失效窗口。最終 3 文件、20 個包裝及 timer／訂閱清理，held／patterns／分頁為零，107 個受控 request 樣本零匹配。B03 cleanup 的 4 筆取消／放行競合錯誤保留，不補算通過。沒有新確認的產品缺陷，固定矩陣未完整通過；缺口見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。只改測試工具、契約與文件，未改產品來源、升版、完整 verify 或安全封存。

## 2026-10-11 IAB 第 4 輪

以 `14ea6a5` 為基準，[TODO 第 4 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_TODO_R4_2026-10-11.md) **新增實際安裝／原生 XHR timeout 2 案，以及內建瀏覽器來源隔離格式與 hook 資源 17 項通過，沒有新確認的產品缺陷。** 前 3 輪有效結果沿用。B02 播放器焦點 2 倍的未觀察尾段嘗試兩次，均在新按鍵前被收集器中斷，不算產品通過或失敗；未再跑無新前提的背景、gate 或既知無效故障窗口。

逾時採非阻塞啟動與連續游標，完整 DONE→timeout→loadend，無截斷；來源隔離的 12 個合成 API 均先攔截再回應，GM 不存在、記憶體寫入 0。獨立 B02 收集器的最小對照證實跨呼叫變數重設未更新舊閉包，下次須先隔離驗證工具。最終 7 個觀察包裝還原、timer／訂閱釋放、攔截空、5 個受控 request 樣本零匹配；實際分頁為零、服務停止，C01 通過。原工具錯誤頁與第一窗網路缺口保留歷史紀錄，不補算案例。保存證據斷言、自有模型型別檢查、5 份文件 GFM／連結與 diff 檢查另存；未改正式來源、重跑完整 npm／verify／安全掃描或發布新版。累計缺口見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 2026-10-11 IAB 第 3 輪

依使用者要求，只用內建瀏覽器續做可執行 TODO，沿用既有通過結果。以 `783ece1` 為基準完成 [TODO 第 3 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_TODO_R3_2026-10-11.md)：**新增 XHR 同步／abort／本地終止 10 案、雙分頁 Catalog 合併／GM 同步與診斷讀取子項通過；沒有新確認的產品缺陷，本輪未取得完整通過。** timeout 子項因事件截斷及工具逾時無產品判定，B06 新晚到成功窗口被網站在實際 SDK 前換核心／暫停而作廢，停止重複嘗試。

三個文件實例的完整 v2.1.20／Tampermonkey 5.5.1 身分與唯一 singleton 均核對。兩頁設定已精確復原，受控 31 個 request 的記憶體／持久樣本零匹配，6 個 SDK／證據包裝及 4 個設定 listener 清理，自有分頁為 0。只更新瀏覽器證據與文件，沒有改執行期來源、完整 npm／verify／安全重跑或新 Release。具體再開前提及未執行項見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

保存證據的 12 個一致性斷言、5 份文件的 GFM／16 表格／142 連結與 `git diff --check` 通過。這些檢查不代替新的執行期測試。

## 2026-10-11 IAB 第 2 輪

依使用者指示，先提交／推送第 1 輪文件為 `24dcdfd`，再完成 [BR-01 內建瀏覽器第 2 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_BR01_R2_2026-10-11.md)。**新增播放器焦點／滑鼠 seek、inner 長按、2 倍晚到 SDK 拒絕及 pending 政策撤銷子項通過；沒有新確認的產品缺陷，固定矩陣仍未取得完整通過。** 第 1 輪有效核心期限沿用。真背景校準沒有 hidden 轉換、原生 repeat／cancel 能力不足、部分安裝交錯沒有成立；具體原因見新報告。

獨立 P01 的原生／實際安裝 XHR 子集 **24／24**；最終 Network 無截斷，所有本地拒絕請求未到達送出前攔截層。14 個保存證據的一致性斷言通過；沒有重跑完整 npm／verify／安全掃描，來源與版本未變。最終包裝還原、受控樣本零匹配、自有分頁為 0、服務停止；第一個影片實例失去連線時逐一 dispose 未被觀察，歷史限制明列。累計缺口見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)，不把 P02–P05 或自然網路起因加為 BR-01 門檻。

## 2026-10-11 IAB 第 1 輪

使用者另行要求重啟後，以 v2.1.20／`0d036f4` 執行並收束 [BR-01 內建瀏覽器第 1 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_BR01_R1_2026-10-11.md)。**核心 15／30／15 秒救援在 Auto 1／2 倍均通過；固定矩陣未取得完整通過，沒有新確認的產品缺陷。** 正常播放、12 秒延遲、wrapper 故障長按與音訊隔離另有有效安裝證據。背景前提、原生特殊輸入、晚到 SDK 操作矩陣及部分未執行子項的具體原因見該報告，不以來源隔離代替安裝結果。

本輪來源隔離最終 S03 為 74 個情境通過，自有新模型型別檢查及 8 個證據複核斷言通過；未重跑完整 npm／verify／安全掃描。正式來源與發布產物未修改，沒有升版、提交或推送。自有測試頁／服務已收束，設定復原，受控樣本零匹配；工具錯誤頁的自動關閉尚未觀察，單獨列明。當前狀態以 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 為準。

## 先前的環境與文件工作

2026-10-11 使用者停止自主故障測試後，另授權的 [內建瀏覽器 Tampermonkey 可用性重新驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md) 確認完整 v2.1.20、唯一實例、可信輸入、控制中心及合成 Fetch／XHR 攔截通過。背景窗口因實際切換與 getter 未充分校準而無效，已撤回背景能力失敗判定；selectedTab 2→3→2 與 prototype getter=false／Runtime visible=true 保留為觀察。今後瀏覽器測試只使用內建瀏覽器＋Tampermonkey，BR-01 自主目標保持停止；本次環境確認沒有重跑 npm 或修改發布快照，也不增加 BR-01 通過項目。

## 2026-10-11 文件方案更新

依使用者最新指示，新增 [IAB_TESTING](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_TESTING.md)，統一來源隔離、安裝版與環境校準；禁止改用外部瀏覽器。新矩陣尚未整輪執行，本次沒有重跑程式、自動測試、安全掃描或故障注入，也沒有升版／發布。當前工作與啟動狀態見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

下方數字保留 **v2.1.20 發布與當時 Chrome 證據**，不轉算為內建瀏覽器完整通過。整理前的完整正文另存 [指南快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/IAB_GUIDES_BEFORE_2026-10-11.md#docs-test-report-md)，歷史 Release 與安全封存不回寫。

## v2.1.20 修復時驗證

基準v2.1.19／ff725e918793531cb39bd9aa7d506779360c754e，開始時乾淨。修正新paused-transition保存SDK舊位置，見 [修正報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_NATIVE_POSITION_FIX_REPORT.md)。必要本機門檻通過；發布核對另記於下節，完整實際安裝矩陣未通過。

| 項目 | 本輪結果 |
| --- | --- |
| 執行期未修改時正確契約 | 12 fail／4 pass |
| 最終型別正確契約＋不可變原來源重建 | 12 fail／29 pass，含既有25正常案；不回滾來源 |
| 新正式回歸 | 16／16；application286／286 |
| npm test／最終verify | 19套件／771／771；0 fail／skip／todo／cancelled |
| typecheck／architecture | 通過，44個執行期模組 |
| npm run verify v2.1.20 | 退出0；確定性建置、語法、v2-only及封裝校驗通過 |
| Chrome原生HAVE_NOTHING位置讀取 | 自有iframe真正空video6／6，無getter覆寫 |
| Chrome Adapter／Recovery模型 | 自有iframe受控媒體／FakeClock6／6；不是安裝singleton |
| Codex Security差異 | 已封存2／2，0候選／0發現；封存後test-only参数修正另審查驗證 |

Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2。證據與重跑入口存於 .work/functional-fixes/br01-native-position/2026-10-11-ff725e9/。Chrome ownVideos=0、iframe移除；沒有修改網站媒體getter、控制器或起播預算。

## 安全範圍

掃描2661c0e4-d1dc-44cc-b4a6-089883858759於2026-10-11T05:02:52.273269Z封存，獨立架構及位置／恢復／路線消費邊界完成。runtime SHA-256 417fdbdcd229e47a5d7e7f75584fb8cfe55eac0e57b24859e62b4a142d0afa28封存後不變。原封存br09.ts的一個armRouteFailure參數錯誤由typecheck抓到；改為傳入真正VideoSnapshot後，父代理另審查單行test-only差異與重新驗證，不冒充原封存測試雜湊。根SECURITY.md人工解析，因工具錯報Windows目錄不存在；舊安全產物不回寫。新try只保證native讀取邊界，不宣稱所有既有getter安全。

## 發布與實際安裝

v2.1.20於2026-10-11T05:09:46Z（Asia/Taipei13:09:46）[正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.20)。發布時遠端main與peeled tag均為18f0c4f1923e62692ee4a52bac18f475ad837e15，tag ref為11a0c3784dd7fc937f0a9065cfbab704b35669f6。唯一BiliCDN_TW.user.js附件336,219 bytes，SHA-256 b8e5bd4744737537f348fcc7d9fb9f258fd41bc5e60327e5f4259560dcd5b54e；05:10:16.111Z無認證公開latest版本／大小／SHA-256完全一致。封裝前diff檢查通過，Release快照不回寫；後續純文件提交另推main。

05:12:19.828Z指定影片完整執行本體exact v2.1.19，非v2.1.20；Debugger身分事件無截斷或未排空。新版安裝前提不通過，已請使用者完成必要Tampermonkey手動更新，工具不能操作擴充功能更新介面。這是實際載入阻塞，不是發布授權；沒有以舊版或來源結果計入新版通過。

使用者更新後05:17:15.659Z，完整本體 exact v2.1.20、Runtime／ControlCenter各唯一1，身分事件未截斷且排空。實際 Auto1 新目標與 Auto2 有效0保存修正通過；正常播放／短seek／12秒影片延遲、31秒拖曳及可信 pointercancel／lostpointercapture、可信控制撤銷後晚到拒絕取得有效子項。自然 Auto2 stall 的一次實際重載及9秒後 recovered 有完整媒體／動作紀錄，但長歷史Network截斷，不計完整合併窗口。當輪完整同版失敗退出與其餘矩陣**未取得完整通過**；當時持續執行的目標其後已由使用者停止。詳見 [實際v2.1.20續測](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.20_BR01_ACCEPTANCE.md)。更新前載入阻塞已解除；本輪沒有新的來源變更或完整自動重跑。

以下為更新前 v2.1.19 的歷史結果：完整本體／唯一singleton已確認。正常Auto1／2、播放中12秒video延遲及Auto1完整15／30／post15＋不重試取得有效子項；新意圖保存舊SDK位置不通過，由本版修正。Auto2完整停滯、晚到SDK全矩陣、真正hidden、自然pending gate及其他剩餘項未取得全部有效證據，**BR-01整體不通過**。見 [實際續測二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.19_INSTALLED_CONTINUATION.md)。v2.1.20實際安裝前提未成立時，不計新版通過；須核對body／唯一singleton後重跑本輪缺口及剩餘矩陣。原87.785秒自然網路起因獨立未定位。

<a name="歷史驗證導覽"></a>

## 歷史導覽

- [v2.1.19完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2119-release-verification--2026-10-11)
- [v2.1.17二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)
- [更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v2121-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.21 BR-10 驗證報告

日期：2026-10-11～12（台北時間）。基準 v2.1.20／`55ae4b0`，開始時乾淨。本版修復控制中心 Enter／Space 被頁面快捷鍵取消；不新增焦點循環、不更改 API／設定／schema 2。詳見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR10_FIX_REPORT.md)。

## 正式與來源驗證

| 層級 | 結果 |
| --- | --- |
| 未改執行期的正確契約 | 9 pass／2 fail；兩個正常按鍵對照通過、兩個頁面干擾案失敗 |
| 修復後 control-center | 17／17，新增 10 案、保留原 7 案 |
| npm test | 19 套件、788／788，無 fail／skip／todo／cancelled |
| typecheck／architecture | 通過；44 個執行期模組，無循環 |
| 最終 npm run verify | 通過，退出 0；確定性建置、語法、v2-only 與暫存封裝校驗通過 |
| 獨立 Codex Security 差異 | 完成，2／2 表面、0 候選／0 發現；與 verify 分開 |
| IAB 自有頁 | Enter／Space 正常及外部冒泡快捷鍵對照 4／4 通過 |
| IAB 指定影片來源 UI | Enter／Space 2／2 通過，焦點保持控制中心、沒有正式設定寫入 |

工具為 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。證據與重跑入口在 `.work/functional-fixes/br10/2026-10-11-55ae4b0/`。來源 UI 只接記憶體依賴，控制器未啟動；兩個驗證分頁的 listener／timer 已清理並關閉。

## 安全與限制

掃描 `b73a3463-a58f-47ec-8eba-c1b79bfe5b93` 於 `2026-10-11T15:23:21.723484Z` 封存，涵蓋 UI 與正式測試差異。可信事件、命令權限、同步重入、清理與輸出沒有可報告發現。Windows 指南解析問題以直接讀取 SECURITY.md 補足。後續文件／版本／封裝不冒充該不可變掃描內容。

ShadowRoot 冒泡隔離不能撤銷外層 capture 已做的取消；本輪指定影片的實際事件環境通過，不能推論所有第三方 capture handler。Node 事件模型不代替原生輸入；來源驗證不代替實際安裝。

## 發布與安裝

v2.1.21 已於 `2026-10-11T15:33:58Z` [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.21)。發布時 main 與 peeled tag 均為 `6f843536103b191d322d0b515bf4e700430b3fff`，tag ref 為 `35603a6d221ec394d03b7f3fd86dee639e12f870`。唯一附件 `BiliCDN_TW.user.js` 為 337,000 bytes，SHA-256 `09b1c36fd9f8da578189fd5360481127552f4277585ede83e00aa526c344884b`。15:34:29Z 未帶憑證的公開 latest 版本、大小與 SHA-256 均一致；證據為 RELEASE_IDENTITY.json。Release 快照保留封裝時狀態，不回寫發布後紀錄。

代理已在內建瀏覽器開啟公開更新網址，後續新指定影片文件載入 Tampermonkey 5.5.1／腳本 v2.1.21；撤回先前「必須手動更新」判斷。完整執行來源 333,559 字元，IIFE 330,750 字元，SHA-256 `e35ddb7f73a38d495c01e7f02736f3787bfc177165eadfb7e5e349c2ede1eb22` 與 Release 同段一致，RuntimeController／ControlCenter 各一個實例。

| 新版安裝子項 | 結果 |
| --- | --- |
| BR-10 Auto 1／2 倍 Enter／Space | 4／4 通過；設定頁正常開啟，焦點留在控制中心 |
| P04 關閉／切頁後完成 | 2／2 通過；真實 UI／命令只延後回傳，舊回呼未重開或覆蓋視圖，設定及命令包裝已復原 |
| P05 完整報告 | 通過；80,653 字元與當次結果相同，10 個 readModel 欄位完整；probe／reload／學習及儲存寫入觀察均為 0，已列敏感模式未命中 |
| P05 複製 | 驗證未通過；原生啟動後工具讀到空內容，進一步 GM／原生剪貼簿校準逾時，未確認產品根因 |

實際安裝共 7 個上述通過案例；複製未計通過。`show()`／focus 與倍速、暫停屬準備，命令由原生按鍵啟動，不冒稱滑鼠入口或播放驗收。P04 僅改 fixedHost 並復原 null，其他設定欄位核對不變（updatedAt 除外）。剪貼簿空文字已復原，但空項目集合的原始表示未能由工具精確重建。自有兩個分頁已明確關閉、IAB 清單為空、loopback 31993 已停止；剩餘觀察包裝隨文件銷毀，不宣稱逐一原位還原。

安裝證據為工具返回觀察的摘要，完整本體及安裝截圖匯出逾時未列為產物。只在剪貼簿通道校準成功後重跑 P05 複製一次；已通過子項不重測。本輪 UI 安裝矩陣未全部通過，具體事件與清理見修復報告。

## 2026-10-12 P05 讀回通道調查

基準 v2.1.21／`99dd071`，開始時工作目錄乾淨。只做環境校準，不重跑上述安裝案例。自有頁的 61 字元中文多行文字經真正 Ctrl+C／Ctrl+V 完整相符，IAB 剪貼簿 API 也逐字相符；隔離層外 PowerShell `Get-Clipboard -Raw` 在 5,057 ms／47 次讀取中仍得到原本 3 字元文字，Windows 序號維持 557。這是本輪共同讀回通道不成立的證據，不是 P05 產品缺陷；隔離層內的空讀值另因原生剪貼簿存取被拒而無效。

依停止條件沒有執行實際「複製報告」、重新取得安裝身分或修改執行期；產品成敗無新判定。Windows 原文字及七種格式確認未變，保存程序與服務已停止。IAB 原剪貼簿沒有可復原備份，保留合成文字；校準頁已關閉，錯誤頁因 URL 政策不能顯式關閉，只能由回合自動清理，未補算清理通過。版本維持 v2.1.21，沒有封裝或新 Release。本次只執行文件檢查，不產生新的 Node／安全／安裝通過數；完整證據與再開條件見 [調查報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_CHANNEL_REPORT_2026-10-12.md)。

BR-01 依使用者決定保持跳過。其他已通過結果沿用，沒有新前提的 P01／P02 不重跑；目前範圍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 2026-10-12 P05 IAB 真正貼上與讀回

基準 `99b3308`、v2.1.21，開始時乾淨。使用者改採 IAB 讀回門檻後，完整保存原項目及格式，64 字元合成文字的真正複製／貼上與 API 逐字相符，快照復原及原內容真正貼上確認通過。重新取得完整 v2.1.21 本體、Tampermonkey 5.5.1 與唯一 RuntimeController／ControlCenter 身分；沒有重測既有通過項目。

**實際 P05 不通過：** 真實 UI 的可信複製事件後，當次完整報告 18,150 字元，而 IAB API 及真正 Ctrl+V 均為原文字 61 字元，全文不符。另行批准的單次 GM 純文字校準正常返回並收到完成回呼，原生 Clipboard API、工具讀回及貼上仍未變。不能把完成通知當成成功，也沒有證據支持只補格式能修復；產品根因仍未定位。

原剪貼簿完整保留、原內容只留記憶體，兩個自有分頁及 loopback 31995 已清理，Debugger／觀察器釋放。沒有產品、正式測試、設定、版本或 Release 修改；本次只新增瀏覽器證據及文件檢查，不重跑自動契約或安全掃描。BR-01 保持跳過，沒有新前提時不重複同樣窗口。全文比較、來源位置、工具限制及續查條件見 [本輪報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_IAB_RESULT_2026-10-12.md)。

<a name="bilicdn_tw-v2120-release-verification--2026-10-11"></a>
<a name="歷史驗證導覽"></a>

## 歷史導覽

- [v2.1.20 完整原報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2120-release-verification--2026-10-11)
- [BR-10 原始調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_BR10_CONTROL_CENTER_KEYBOARD.md)
- [更早完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v2122-release-verification--2026-10-12"></a>

# BiliCDN_TW v2.1.22 P05 驗證報告

日期：2026-10-12（台北時間）。基準 v2.1.21／`f534838`，開始時乾淨。只修診斷複製；公開 API、應用層介面、GM 權限及 schema 2 不變。BR-01 跳過，已通過 UI 項目不重測。

| 層級 | 結果 |
| --- | --- |
| 未修來源契約 | 20 fail／17 pass，保留原結果 |
| 修復後 control-center | 37／37；新增 20 案 |
| 全套正式測試 | 19 套件、808／808，無 only／skip／todo／cancelled |
| typecheck／architecture | 通過 |
| 最終 verify | 通過，退出 0；確定性建置、語法、v2-only 與暫存封裝校驗通過 |
| 獨立 Codex Security 差異 | 3／3 檔案、0 候選／0 發現，已封存 |
| IAB 原生通道 | 可信 writeText、API 讀回、真正 Ctrl+V 與完整原內容復原通過 |
| 指定影片修復來源 | 3,392 字元全文讀回／貼上相符，GM／播放器呼叫及正式持久寫入 0；自有 UI 清理通過 |
| 公開更新產物 | v2.1.22 已發布；唯一附件及未帶憑證的 latest 版本／大小／SHA-256 一致 |
| 實際新版 P05 | 通過；31,204 字元報告完整讀回與真正 Ctrl+V 一致，原剪貼簿與資源復原通過 |

工具：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。修復以原生優先、GM 不可用備援與單一 pending 寫入處理；不宣稱定位或修復 Tampermonkey GM 通道。

安全掃描 `70b8d2c4-2c21-4465-a8c8-47eee5ba09d1` 於 `2026-10-12T13:48:17.943313Z` 封存。審查可信入口、完整報告、原生 receiver、例外、同步重入、過期視圖及重複寫入。不可變範圍為 UI／型別／正式測試三檔；後續版本與文件交付不冒充掃描範圍。工具回報 usage 2,339,563 tokens（來源 codex_rollout、2 threads，包含同任務累計 context，非修復的增量成本）。

證據在 `.work/functional-fixes/p05-copy-native/2026-10-12-f534838/`；全文對照、重跑入口、發布與實際安裝見 [P05 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_FIX_REPORT.md)。原剪貼簿與貼上內容只留記憶體，檔案只保存長度／雜湊／比較與清理狀態。

## 發布核對

v2.1.22 於 `2026-10-12T13:57:43Z` [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.22)。發布時 main／peeled tag 均為 `d1056ba1d67d571bf6f43b80c5accf3ab695cac8`，tag ref `33365b1a5e8ab706042301c984e613001710b8d5`。唯一附件 338,653 bytes，SHA-256 `7a4411c594385a65489a2b294df543ebe479d49ec8e8c37a797118a79f980508`；`2026-10-12T13:58:14Z` 公開 latest 核對一致。既有忽略規則排除新 Release 目錄，封裝快照於後續 `5ae9d6b` 提交 main；標籤及附件未改寫。

## 實際安裝

初始公開更新入口沒有載入新版，舊本體觀察保留在 INSTALLED_PRECONDITION.json；使用者更新後該阻塞解除。Tampermonkey 5.5.1／v2.1.22 完整本體 335,100 字元，完整 IIFE 332,291 字元、SHA-256 `7de1d31f1f7298275eee71a3b9c68b5612e70f515efce4aa1edf3160df7113de` 與發行同段一致，唯一 RuntimeController／ControlCenter 各 1，事件無截斷。

實際可見入口的指標操作開啟 UI，再以真正 Tab／Enter 啟動診斷及複製。**31,204 字元**當次報告，API 讀回與真正 Ctrl+V 逐字相符，SHA-256 `a2a456e87fa3d7886d5497274273b1099bcadf3d8a607180fae6231efc45e646`。只提交一次，pending 已收束，報告不變、焦點保持。全部原剪貼簿項目／格式／文字與真正貼上復原相符；沒有保存原內容或報告本文。

原生 Escape 關閉 UI，自有觀察器／屬性、Debugger 及 object group 清理，paste sink 清空，自有分頁 0、loopback 31996 listener 0。INSTALLED_COPY.json、CLEANUP.json 與無報告本文的成功提示截圖保存證據。BR-01 仍跳過，其他已通過案例不重測；GM 根因不因原生成功而宣稱修復。

## 2026-10-13 文件結案補記

依使用者批准完成 [TODO 證據核對與結案](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO_CLOSURE_2026-10-13.md)。只讀既有紀錄、核對來源差異並更新文件，沒有新增自動測試、安全掃描或瀏覽器驗收。

- P01 第 2～4 輪的 24＋10＋2 個案例沿用；真 installed pending gate 的 bounded prepare 與 P02 等待者交錯前提未成立，限制封存，不判通過或產品失敗。
- P03 同片自然 API 安裝子項沿用；本版原 808／808 紀錄中的 43 個具名 BR-03 案例核對成功。IAB 第 4 輪格式／hook 17 案沿用，舊 Chrome 154 來源隔離 31／31 保留原版本／環境，不轉算 IAB；完整內容週期交錯的 IAB 來源證據缺口明列限制，不增加安裝門檻。
- P04、P05、BR-10 已完成且不重測；BR-01 與原自然停滯原因保持跳過。沒有已批准的自主接續測試項目。

本次文件結案不表示完整產品矩陣全部通過。版本維持 v2.1.22，只有文件提交與 main 推送；既有發行標籤、附件及 Release 快照保持原狀。

## 2026-10-13 整體程式碼調查補記

其後依使用者批准，以 v2.1.22／`c4e7de4` 執行完整來源閱讀與新疑點驗證，見 [整體程式碼檢查報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CODE_REVIEW_2026-10-13.md)。46 個來源檔有覆蓋紀錄；確認 CR-01～05 共 5 個新缺陷，均未修復。另 3 個 XHR 疑點只具靜態與 Node 模型結果，缺 IAB 原生對照，不計確認。

既有發布來源雜湊及來源／正式測試／建置差異核對一致，**沿用原 808／808 而未重跑**。新私有契約共 21 案：12 pass／9 fail，所有分區重現型別檢查通過。這些 fail 是未修來源的正確契約失敗，不能算完整測試通過；9 次失敗對應 5 個確認根因及 3 個尚缺原生證據的根因，其中 CR-02 兩個症狀合併。

沒有新安裝驗收或 Codex Security 掃描。IAB 原生隔離在校準前因連線及 URL 政策受阻，兩個本機服務已停止，錯誤分頁的明確關閉未獲確認。BR-01 專項仍跳過，P01／P02 封存窗口與既有通過案例沒有重測。產品、正式測試、版本及 Release 未改；本次只交付本機調查證據與文件，不提交、推送或發布。此前 P05 安裝通過與歷史證據仍描述其原範圍，不因本輪診斷狀態新缺陷而被改寫。

<a name="bilicdn_tw-v2121-release-verification--2026-10-11"></a>

## 歷史導覽

- [v2.1.21 完整原報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2121-release-verification--2026-10-11)
- [原 P05 失敗與 GM 校準](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_IAB_RESULT_2026-10-12.md)
- [更早完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)


<a name="bilicdn_tw-v2123-release-verification--2026-10-13"></a>

# BiliCDN_TW v2.1.23 修復驗證報告

日期：2026-10-13。基準 v2.1.22／c4e7de4，保留五份原調查文件。修復 CR-01～05 與原生確認的 S-01／S-03，共七項；S-02 未確認且沒有修改。公開 API、GM 權限、設定、schema 2 及執行期依賴不變。

| 層級 | 結果 |
| --- | --- |
| 未修 CR 正式契約 | 12 案、6 fail／6 pass；原紀錄保留 |
| 修復後全部正式測試 | 19 套件、841／841；新增 33 案；0 fail／skip／todo／cancelled |
| 型別／架構 | 通過；44 個 runtime 模組 |
| Codex Security 差異 | 23／23 檔、0 候選／0 發現；獨立封存 |
| IAB XHR 原生來源 | 11 組／22 筆觀察相符，包含七種跨 realm body；自有資源已清理 |
| 最終 verify | 通過，退出 0；841 契約、確定性建置、語法、v2-only 與暫存封裝／校驗通過 |
| 封裝／公開產物 | 正式發布；遠端 main／標籤、唯一附件、公開 latest 版本／大小／SHA-256 全部一致 |
| v2.1.23 實際安裝身分 | 使用者更新後，完整 IIFE 與附件逐字相同；唯一 RuntimeController／ControlCenter 及新版 Fetch／XHR hooks 核對通過 |

工具：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。分批 progressive-routing 29、orchestration 38、measurement-state 40、diagnostics 16、native-transport 147 均通過。正式契約及正常對照見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CR01_CR05_FIX_REPORT.md)。

安全掃描 54077ae0-1f99-479d-bbea-e66e08f57e31 於 2026-10-13T15:07:25.758289Z 完成，固定差異摘要 85faf012e78350492acb676cadf2e7faacb7b124f0eec3468f6563e4c5bf5252。工具回報 8,709,858 tokens（codex_rollout、3 threads，含累計 context，非修復增量成本）。後續版本／文件／封裝不冒充安全審查範圍。

S-02 原生定位因工具單次呼叫耗時 389.4255 秒而達整體時限；只有送出前攔截控制，沒有相對 URL／base 結論。raw SharedArrayBuffer 亦未列本輪原生 body 通過。BR-01 保持跳過；P01／P02 安裝窗口限制封存；其他已通過瀏覽器案例未重測。這些限制不改記通過。

私有證據：.work/functional-fixes/cr01-cr05/2026-10-13-c4e7de4/。安全 canonical 與一般 verify 分開保存。

## 發布與安裝核對

v2.1.23 於 2026-10-13T15:14:37Z [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.23)。當時 main／peeled tag 同為 f219caa93b93c7f468e71cf2efdabe8bb8e33673；唯一附件 343,834 bytes，SHA-256 ae68637fd73599d6561ca396249246c64f070491030a5e106260d597ceb41f2a。公開 latest 未带憑證下載逐字一致。封裝快照已隨發布提交保存，後續文件不回寫 Release。

首次公開更新入口沒有確認按鈕，指定影片仍執行完整 v2.1.22；沒有用舊版驗收新版。使用者更新後，實際完整本體 340,281 字元，內含與 v2.1.23 附件逐字相同的 337,472 字元 IIFE，該段 SHA-256 9e97abd7dbab28eb633b46f1774a7b381c562d41109a8dcd994600145f05589f。RuntimeController／ControlCenter 各 1；Fetch／XHR hooks 為新版。事件無截斷，object group、Debugger 與自有分頁均清理。

這是安裝身分通過，不是整份安裝功能矩陣通過。因果回歸仍分列 Node／IAB 來源，不重測已通過案例、不重開 BR-01／P01／P02。原始前提與更新後證據見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CR01_CR05_FIX_REPORT.md#發布與安裝)。

<a name="bilicdn_tw-v2122-release-verification--2026-10-12"></a>

## 歷史報告

<a name="歷史驗證導覽"></a>

上一版 v2.1.22 全文（含 2026-10-13 結案與原調查補記）已原樣封存至 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2122-release-verification--2026-10-12)。其他版本由 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md) 追溯；原 Release 快照及失敗紀錄不回寫。

<a name="bilicdn_tw-v2124-release-verification--2026-10-14"></a>

# BiliCDN_TW v2.1.24 救援政策重評與修復驗證

日期：2026-10-14（Asia/Taipei），基準 v2.1.23／c3f1a49，開始工作目錄乾淨。本輪確認並修復可信播放按鈕未進入既有長暫停救援的入口缺陷；**保留 15／30／15 秒**。不重開歷史整份 BR-01 或 P01／P02，原自然停滯原因沒有新結論。

| 層級 | 結果 |
| --- | --- |
| 未修來源正式契約 | 原 8 案：2 fail／6 pass，失敗紀錄保留 |
| 修復後正式契約 | 新增 14 案；adapters 116／116、application 286／286 |
| 完整自動驗證 | 19 套件 855／855；0 fail／skip／todo／cancelled |
| 型別／架構 | 通過，44 runtime 模組 |
| 最終 verify | 通過：型別、架構、完整契約、確定性建置、語法、v2-only、暫存封裝與校驗 |
| Codex Security 差異 | 完成，4／4 來源／測試檔與 README 名稱核對；0 候選／0 發現 |
| IAB 來源隔離 | 原版可信 click 未建立意圖；修復版建立意圖、單次重載、有限退出、正常進度零重載；自有 iframe 清理通過 |
| 公開更新產物 | main／標籤、唯一附件、公開 latest 版本／大小／SHA-256 全部相符 |
| 實際 v2.1.24 安裝 | 完整本體及唯一實例相符；Auto 1／2 倍正常播放入口通過；最新尋位位置保護不通過、尚未修復，故障傳輸窗口限制分列 |
| 安裝後新調查契約 | 位置遺失 1 fail／2 pass、獨立型別通過；不計入已發布正式 855 案 |

工具：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。修復／政策／案例對照見 [本輪報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_POLICY_REASSESSMENT_2026-10-14.md)。

安全掃描 89c38d47-f92f-411b-8d1a-8b3e869da0da 於 2026-10-13T16:28:11Z 完成；凍結摘要 f4abf3c9ef5e09c011b1e610f57c2234f3c354e78fbc17fe28faf578baf34379。後續版本／文件／封裝不冒充該安全審查範圍。

發布前 v2.1.23 Auto 2 倍延遲窗有實際恢復，但含取消／放行競合與觀察限制；當時後續 1 倍起始狀態已失效，正常比較作廢。更新後的 v2.1.24 正常 1／2 倍另行執行並通過。來源進度模型不等於真影片恢復，有限退出也不等於恢復成功。私有證據 .work/functional-fixes/br01-policy/2026-10-13-c3f1a49/。

<a name="bilicdn_tw-v2123-release-verification--2026-10-13"></a>
<a name="歷史驗證導覽"></a>

## 歷史報告

上一版 v2.1.23 完整正文原樣追加至 [歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2123-release-verification--2026-10-13)。歷史 Release、原失敗與安全封存不回寫。

## 公開產物核對與續行狀態

v2.1.24 於 2026-10-13T16:34:31Z [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.24)。發布時 main／peeled tag 同為 73d339e1e923ed1fc5d6606871f08a22a78d9947；唯一附件 345,540 bytes，SHA-256 9a58836ab79b56ca8b4a4741a3236011df19aade872baea19d8e56066cef7e3d。公開 latest 未帶憑證下載逐字一致。後續文件不回寫 Release 快照。

**v2.1.24 已載入並核對完整本體與唯一實例。Auto 1／2 倍正常長暫停後播放通過；BR-01 整體不通過。** 新版可信播放入口已生效，但另確認失效媒體重設後遺失使用者尋位目標，尚未修復；獨立契約 1 fail／2 pass。故障窗口的傳輸收集限制與局部媒體證據分列，不擴大通過範圍。詳見 [位置遺失報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.24_POSITION_LOSS_2026-10-14.md)。本輪停止重跑，未作後續執行期修改。


---

<a name="bilicdn_tw-v2125-release-verification--2026-10-14"></a>

# BiliCDN_TW v2.1.25 模組化與標準化驗證

日期：2026-10-14 實作／發布，2026-10-15 安裝紀錄（Asia/Taipei）。基準 v2.1.24／85196df，正式來源 src-v2。分階段提交工具遷移、格式、靜態規則、依賴契約與三組執行期拆分，保持既有產品行為。完整責任與來源案例見 [實作報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/MODULARIZATION_v2.1.25_REPORT.md)。

**BR-01 位置遺失未修復，歷史整份矩陣與 P01／P02 封存不重開。** 正常播放與模組化驗證不代替故障位置保護；原 [位置缺陷](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.24_POSITION_LOSS_2026-10-14.md) 保留。

| 層級 | 結果 |
| --- | --- |
| 完整正式契約 N | 19 套件 889／889，新增 34 案；0 fail／skip／todo／cancelled |
| 型別／格式／架構 N | 來源／測試／工具嚴格型別、唯讀 format:check、98 個模組與循環檢查通過；架構套件 37 案，工具 34 案 |
| verify N | 通過：格式、型別、架構、全部正式契約、確定性建置、JS 語法、v2-only、暫存封裝與校驗 |
| Codex Security | 固定差異 193／193，0 候選／0 發現、完整覆蓋與封存完成；與 verify 分開 |
| IAB 原生校準 E | 自有 Fetch／XHR 精確攔截、合成回應與解除通過；沙箱內服務不可達後改由主機 loopback 服務 |
| IAB 來源隔離 S | 17／17 傳輸／選路／所有權案例通過；來源 UI、播放器讀取／包裝與資源清理通過；無正式 GM 寫入 |
| 公開更新產物 | 已發布 v2.1.25：main／標籤、唯一附件與公開 latest 的版本／大小／SHA-256 核對一致；安裝紀錄另提交 main，標籤與快照不回寫 |
| 實際安裝 I | 本輪正常回歸範圍 PASS：Tampermonkey 5.5.1／完整 v2.1.25 執行本體、Runtime／ControlCenter 各 1、Fetch／XHR hooks；指定影片 Auto 1／2 倍播放／暫停／恢復／短 seek 及控制中心操作通過 |

工具保持 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2；只新增開發用 Prettier 3.9.10。16 個維護工具使用原生 ESM .mts，生成的 JS 情境／產物仍保留。格式變更獨立提交；本輪不要求重構後 JS 文字與舊版一致，確定性在同一新版來源驗證。

本輪 v2.1.25 已另行執行 format:check、typecheck、architecture、npm test 與 verify，全部通過。封裝使用者腳本 368,486 bytes，SHA-256 `2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6`；原更新網址維持。2026-10-14T15:10:20Z 發布的唯一附件與 2026-10-15 再取的公開 latest，版本／大小／雜湊皆相同；版本標籤 peeled commit 為 6916e0523a9aa4906d761598943333fecebac57a。

## 發布後實際安裝

公開更新入口先停在 Tampermonkey 中繼頁，工具不能操作管理器確認頁，影片仍為舊本體；該次不作新版功能判定。使用者確認更新後，2026-10-15 重新載入指定 BV1tFZZBQE57 才取得有效 v2.1.25 窗口。管理器外包裝與 metadata 以外的完整可執行 IIFE 為 366,528 bytes、SHA-256 `a85809d70a3bc8a711de6df57f2120c44ff0c6b8fdf51c160ed0a08f5d8b340d`，與封裝同段一致；整份公開附件雜湊另列於上文。

Auto 1 倍：9.866 秒內媒體時間 +9.860 秒、影格 +592；Auto 2 倍：15.105 秒內時間 +30.208 秒、影格 +1,811。兩窗各完成可信暫停／恢復及 Right 短 seek，之後 readyState 4、seeking false 且持續播放，核心 reloadRevision／reloadCount 均 0。概覽／設定／診斷操作通過；Enter／Space 未改變 userRevision／seekRevision，32,213 字元報告 readonly、版本正確且無原始 URL。未重跑歷史故障、背景、gate 或剪貼簿矩陣。

控制中心關閉，斷點／Debugger／object group、自有分頁及 loopback 服務已清理；自有攔截／包裝／頁面 timer／訂閱均 0，沒有設定或剪貼簿寫入，倍速恢復原本 2 倍。原始安全摘要與畫面位於 .work/iab-testing/2026-10-14-v2.1.25-modularization/；細項與判定邊界見實作報告。本輪範圍通過，BR-01 整體仍不通過。

發布後文件檢查：15 份現行文件、32 個 GFM 表格、356 個本機／儲存庫連結，Markdown／表格／連結錯誤 0；上一版完整報告仍原樣保存在歷史，git diff --check 通過。只提交 main 的後續文件，不重新封裝或改寫版本標籤／Release／安全封存。

## 安全範圍與計量

scan f1e3f151-b556-4e63-a9d7-25d68992a0ff 於 2026-10-14T14:59:24Z 完成；固定範圍 85196df1c176cef0e373dba8450a3dd5efc4e376..e5a9c403bac83859bd5540f78716522c1f52d1c6。封存 snapshot digest 為 codex-security-snapshot/v1:sha256:78f8a4cad039280f44b9d0be1fbc83009365a63918f613b85fd2caad9c143191。後續版本／文件／封裝變更不冒充該審查範圍。

前置能力就緒、獨立架構模型與交叉區域審查完成。Windows 政策解析 helper 的路徑錯誤另記，直接讀取固定修訂的根 SECURITY.md，未把政策當成缺失。安全工具回報彙總 13,294,781 tokens（其中快取輸入 13,011,712；來源 codex_rollout）；此為工具彙總計量，不代表獨立漏洞數或瀏覽器證據。

## 來源隔離與限制

合成 MP4／FLV／mixed／invalid-mixed 在真正 Fetch／XHR text／json 中核對 Catalog 輸出、分段 metadata／身分、重讀與拒絕；原生描述子還原、重複安裝、保留較新包裝共 17 案。自有請求／timer／listener 皆 0，正式持久寫入 0。控制中心完整 readonly 報告 3,391 bytes、不含原始 URL；可信鍵盤與播放器 SDK 回傳／MPD 投影／快取／包裝還原分列於實作報告。

第一個傳輸窗口因工具間隔超過自有期限作廢，修正連續服務後唯一重跑才計 PASS；UI 欠缺合成 GM_info 的診斷窗口也作廢，補齊環境後重跑才取得完整視圖。不得以這些合成來源替代 Tampermonkey 安裝證據。未重開歷史背景、故障注入、gate、剪貼簿或位置矩陣。

<a name="bilicdn_tw-v2124-release-verification--2026-10-14"></a>
<a name="歷史驗證導覽"></a>

## 歷史報告

上一版 v2.1.24 完整正文原樣追加至 [歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2124-release-verification--2026-10-14)。[文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md) 導向歷次結果；原 Release／失敗調查及安全封存不回寫。

# BiliCDN_TW v2.1.26 四階段模組收斂驗證

**2026-10-16 發布後 BR-01 調查補記（ccf947a，產品未變）：** 第一輪含批准等待的 65127.7786 秒不得判執行超時，原判斷已撤回。第二輪私有 369 案為 362 pass／7 fail、退出 1；產品單元 195／195、整合 26／4、工具／判定器 127／127、證據重播 14／3。來源六案 4 pass／2 fail，Auto 1／2 倍各完成 20 分鐘自然窗口，起因仍未定位；受控 1 倍僅傳輸／清理通過，2 倍未完整通過，首次 1 倍隔離缺口保留。工具資源已清理，BR-01 未修復。詳見 [第二輪根因與修復規格](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_RCA_R2_2026-10-16.md)、[第一輪更正](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_RCA_2026-10-16.md)。正式 930 案基準沿用同一來源，調查不併入正式案例；下方原發布正文及 Release 快照不回寫。

<a name="bilicdn_tw-v2126-release-verification--2026-10-16"></a>

日期：2026-10-16（Asia/Taipei）。乾淨基準 a716369／v2.1.25，唯一正式來源 src-v2。四階段提交 93074b7（契約／視圖）、91507a2（XHR）、fdb59ae（選路）、8242e8f（播放器／恢復）後才統一升版。保持對外介面、設定、儲存 schema、事件順序、期限及狀態所有權。[完整實作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CONVERGENCE_v2.1.26_REPORT.md)。

**BR-01 位置遺失未修復；歷史故障、背景、gate、剪貼簿及 P01／P02 矩陣不恢復。** 既有正式回歸仍執行；[位置調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.24_POSITION_LOSS_2026-10-14.md) 的獨立 1 fail／2 pass 不轉算本輪正式套件。

| 層級 | 結果 |
| --- | --- |
| 正式契約 N | 19 套件 930／930，新增 41 案；0 fail／skip／todo／cancelled |
| 型別／格式／架構 N | 三專案嚴格型別、唯讀格式、99 模組／循環與唯一寫入權責通過；架構套件 37 案、工具 34 案 |
| v2.1.26 最終自動驗證 N | 升版後 format:check、typecheck、architecture、npm test（930／930）、verify 全通過；確定性建置、JS 語法、v2-only、暫存封裝與校驗通過 |
| Codex Security | 新固定差異 28／28 正式項目（含 3 個刪除契約）及 5 份文件完成交叉審查；0 候選／0 發現，完整覆蓋與封存完成 |
| IAB 原生校準 E | 自有 Fetch／XHR 各一次精確送出前合成回應，2 個事件、無截斷、held／patterns 歸零 |
| IAB 來源隔離 S | 傳輸／選路／所有權 23／23；播放器可信輸入／SDK／清理、控制中心設定／診斷／鍵盤邊界通過；正式 GM 寫入 0 |
| 公開更新產物 | v2.1.26 已發布；main／peeled tag、唯一腳本附件與公開 latest 的版本／372,448 bytes／SHA-256 一致；後續安裝文件另提交 main，標籤／快照不回寫 |
| 實際安裝 I | 本輪範圍 PASS：Tampermonkey 5.5.1／完整 v2.1.26 本體、Runtime／ControlCenter 各 1、Fetch／XHR hooks；指定影片 Auto 1／2 倍、pause／resume／短 seek、控制中心及鍵盤邊界通過 |

工具維持 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2、Prettier 3.9.10，未新增依賴、CI/CD 或執行期載入。三個小契約合併後加入各有用途的 XHR／選路／純進度助手，最終 99 模組；不以模組數或行數驗收，沒有第二個狀態所有者。

v2.1.26 封裝為 372,448 bytes，SHA-256 `107d345c557e18769e0d2e8876e3d046107c051e795228c69f72c97bcfbdaea0`，唯一公開附件與未帶憑證取得的公開 latest 全文相同。第一階段同版腳本與基準逐位元組相同：368,486 bytes、SHA-256 `2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6`。後續重構保持行為，不要求新舊 JS 文字相同。

## 行為契約與整合

XHR 新 20 案先由舊實作通過，原生 getter／receiver／readyState／responseType／例外順序及模式快取重置留在 hook。助手只轉換當筆狀態；metadata WeakMap、open／send／abort／派送／安裝還原不搬動。保留 JSON 身分、重讀一次轉換、拒絕、同步重入及 reopen，沒有新增 in-flight sentinel。

選路新 9 案先由舊實作通過，涵蓋來源分支／ID、事件重入、完成→證據保存→確認、政策失效、Catalog 403／Native 失效及影音隔離。既有模式／固定／禁止／精確 Native／晚到契約照常執行。協調器仍保存計畫、發事件、寫 Vault／親和，等待後重查目前資格。

播放器新 9 行為案先由舊實作通過；加強影格 getter 同步 reset 讀序後，以 esbuild onLoad 在記憶體載入固定 fdb59ae 的三個舊模組再次 9／9，不反覆改寫 tracked runtime。另有 3 個純領域案。註冊與反向清理、SDK receiver／參數／回傳／例外、首次／缺影格／0.05 秒、修訂／重入／晚到 Promise／reset／釋放保持。Monitor 的 available 資格與兩者首次樣本政策不強行統一；Recovery 的兩輪終止及逐副作用所有權檢查保持。

各階段 verify 為 889／909／918／930 案，模組 95／96／98／99；受影響套件及工具問題分列於 [工具紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md)。

## 新安全差異與計量

scan `701c41d6-b599-407e-91bd-5df887f01f2d` 於 2026-10-15T17:26:13Z 完成；固定 a716369b14bd211795f2c60cc57da5e7370df773..8242e8f4b94996dd47fa787bcfdd6f487ed895d5。snapshot digest：`codex-security-snapshot/v1:sha256:5efc8fba89eafedce19783dac36d168df0b03a968d6fa6f1d184c66aa1840e10`。後續版本／文件／封裝不冒充該執行期差異範圍。

前置能力 3／3、獨立 fresh-context 架構與 38 個引用檔範圍核對完成。XHR 作者審契約／選路 15 項，播放器作者審 XHR 3 項，選路作者審播放器 6 項，主代理審 4 個測試入口及 5 份文件。0 候選，無需候選驗證／攻擊路徑階段；既有平台、來源標籤及 BR-01 限制不誤列新發現。根 SECURITY 舊版標頭在後續現行指南修正，固定模型保留原觀察。

工具 coverage=complete、source=codex_rollout：總 16,245,432 tokens、輸入 16,191,177、快取輸入 15,908,992；此彙總不是漏洞數、獨立審查次數或瀏覽器證據。掃描目標計量 538,337 tokens、15 分 7 秒，口徑不同。canonical manifest／findings／coverage、threatmodel、report 與 SARIF 已由工具封存，前版安全產物不回寫。

## 合成來源與清理

同一 Codex IAB、自有 loopback、記憶體 FakeStorage／合成資料，無正式 GM 接線。MP4／FLV／mixed／invalid-mixed × Fetch／XHR text／json 共 12 次送出前回應；文字 getter 交替順序、一次轉換、JSON 身分及原生 responseText 例外保持。另核對完成→保存→確認，事件／保存期間政策失效阻止舊提交，每組與整體還原，共 23 案。

播放器自有空 video 的可信 SDK-play／Right 取得原 `sdk-return`、1 次意圖、seekRevision 1、userRevision 2、target 5；資訊清單只轉換一次、額外欄位丟棄、零面積快取保留，play／seek／reload 描述子還原。控制中心 Enter 設定／返回、空白鍵診斷的 6 個可信事件沒有觸發外層 handler 或取消預設；唯讀報告 3,383 字元、來源版本正確、無原始 URL、儲存鍵 0，沒有剪貼簿寫入。

最終來源 SHA-256：transport `547d06e006a848ebecc08ff4403172e5a038cab362bc6c1187585f5e1ae7b1fd`；UI `acc4daca63c15b685873a35ef17620ff1de0ac657bf31846ea367a9c2a8b1d6c`；player `2273d0a4018354868036d24b52b0cbf79273739f7f7216680fd53b2ded98c927`。傳輸在最終 runtime 重建全文相同，沒有用舊版或無效窗口補算。

自有請求、held／patterns、timer、storage listener 皆 0；Fetch／XHR 與 SDK 還原、UI 監聽器移除，自有分頁全關閉、loopback 31996 停止且 listener 0。私有證據 .work/v2126/iab/；S 層不代替 Tampermonkey 安裝驗收。

## 正式發布與實際安裝

2026-10-15T17:34:04Z [正式發布 v2.1.26](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.26)，發布時遠端 main／peeled tag 同為 bf536c5e1c2f9bdcf1954857686c6770ccdfd6f8。唯一 BiliCDN_TW.user.js 附件的 GitHub digest、公開 latest 與本機封裝版本／大小／SHA-256 一致，四個封裝輸入的校驗亦通過。後續僅補發布後文件至 main，不回寫已發布快照或標籤。

先嘗試公開 latest 更新入口，實際停在 Tampermonkey 中繼頁，工具不能操作管理器確認頁；該影片的完整執行 IIFE 仍與 v2.1.25 相同（366,528 bytes／a85809d70a3bc8a711de6df57f2120c44ff0c6b8fdf51c160ed0a08f5d8b340d），所以沒有作新版功能判定。使用者確認更新後，原工具分頁失效、分頁清單為空；在同一 IAB 新建指定影片文件，取得 Tampermonkey 5.5.1／script 2.1.26。完整可執行 IIFE 為 370,490 bytes、SHA-256 `43597d8e9302a044e5b32a70e8db84811f7e8cf48a7a991e2e055cbfadae01df`，與封裝同段一致；RuntimeController／ControlCenter 各 1，Fetch／XHR hooks installed。管理器包裝與 metadata 不混入 IIFE 雜湊，整份公開附件另核對。

Auto 1 倍窗口：28.8784 秒內媒體時間 +28.882920 秒、影格 +1,731；Auto 2 倍：35.7705 秒內時間 +71.543344 秒、影格 +4,288。兩窗分別完成可信暫停／恢復、Right 約 5 秒短 seek；seek 收束後才開始採樣，結束 readyState 4、seeking false、正常播放，coreId 保持、reloadRevision／reloadCount 均 0，畫質始終 Auto，沒有強制品質或網站故障注入。

控制中心概覽、Enter 設定／返回與空白鍵診斷通過；鍵盤前後 userRevision 14、seekRevision 6 皆不變。32,665 字元診斷報告 readonly、版本正確且無原始 URL，未寫入剪貼簿或設定。Escape 關閉後，Debugger／斷點解除、object group 釋放、所有自有分頁關閉；自有請求／攔截／包裝／timer／訂閱 0，原本 2 倍速及 Auto 保留。已安裝產品 hooks 不作工具包裝清理。

本輪有限安裝範圍 PASS 並結案，BR-01 整體仍不通過。私有 INSTALLED.json、CLEANUP_INSTALLED.json 及 installed-v26-diagnostics.png 與來源證據分開保存；沒有恢復歷史矩陣或留下自主續測項目。文件 GFM／連結／完整歷史保存及 git diff --check 另檢查，不將後續文件更新計為新的執行期測試。

發布後文件檢查通過：16 份現行文件、33 個 GFM 表格、369 個本機／儲存庫連結，格式／表格／連結錯誤 0；v2.1.25 完整正文保存、原 Release 未變及 git diff --check 通過。後續只有文件 main 提交，不重新封裝。

<a name="bilicdn_tw-v2125-release-verification--2026-10-14"></a>
<a name="bilicdn_tw-v2124-release-verification--2026-10-14"></a>
<a name="歷史驗證導覽"></a>

## 歷史報告

v2.1.25 完整正文（含發布後安裝、原限制及導引）原樣追加至 [歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2125-release-verification--2026-10-14)。[v2.1.24](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2124-release-verification--2026-10-14) 與 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md) 保存更早結果；既有 Release／調查／安全封存不回寫。

## v2.1.27 完整報告（2026-10-17）

# BiliCDN_TW v2.1.27 BR-01 救援修復驗證

**2026-10-17 結案範圍補記：使用者明確指示跳過控制中心入口點擊。該項不作本輪驗收或結案阻塞，不安排續測；下列原始觀察仍保留，未轉算通過。** 本補記僅更新現行文件，不修改測試、產品或已發布快照。

main 的後續文件與開發工具驗證另見 [工具日誌](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md#2026-10-20-工作區歸檔與獨立重跑)；下列 1134 案仍描述 v2.1.27 發布時結果，不改成維護工作樹的新增工具案例數。

2026-10-17 結案後已另做完整文件核對，結果見 [維護紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#docs-closeout-v2127-20261017)。下列執行期與瀏覽器數字仍是原始實測結果，沒有因文件整理重跑或增加案例。

日期：2026-10-17（Asia/Taipei）。基準 ccf947a／v2.1.26；產品三階段 d6982c7、1402390、97d598b 完成後統一升版。可信未完成目標保護、有條件初始化還原及一般停滯加速已完成；[完整修復紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BR01_RESCUE_FIX_v2.1.27.md)。自然起因暫緩，不開安裝故障窗口，歷史矩陣／FAIL／私有證據不回寫。

| 層級 | 實際結果與邊界 |
| --- | --- |
| 正式契約 N | 19 套件 1134／1134；基準 930 加產品單元 110、產品整合 58、純驗收工具 36；0 fail／skip／todo／cancelled |
| 分階段驗證 N | verify 1038／1060／1134；受影響套件、格式、嚴格型別、99 模組架構、確定性建置、語法、v2-only、封裝與 diff 檢查通過 |
| 升版後最終 N | v2.1.27 verify 退出0：格式、嚴格型別、99模組架構、1134案例、確定性建置、JS語法、v2-only、暫存封裝／校驗全部通過 |
| Codex Security | 固定 ccf947a..97d598b，27／27 正式項目、0 候選／0 發現、coverage complete，無延期；已封存 |
| IAB 來源 S | 最終97d598b，I-P01／02／03／I-R03 × 1／2 倍，共8／8；真實可信鍵盤／按鈕，自有媒體／SDK／FakeClock，無正式 GM |
| 來源證據重播 | 私有嚴格型別、node:test 8／8，退出0，與正式1134分開；首輪 blur FAIL 及中間產物保留 |
| 公開交付 | v2.1.27 已發布；main／peeled tag 523a093、唯一腳本附件與公開 latest 全文一致，382934 bytes，SHA-256 1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795；後續安裝文件另提交 main |
| 實際安裝 I | Tampermonkey 5.5.1、完整 v2.1.27 本體、Runtime／ControlCenter 各1、Fetch／XHR hooks；指定影片 Auto1／2 倍正常操作及各15秒播放通過；控制中心視圖／關閉通過，入口與返回限制分列 |
| 安裝證據重播 | 私有 node:test 6／6、退出0，含正常播放、有效 UI 序列、清理及「限制不可轉算通過」紀錄核對；不把6項說成6個產品功能通過 |

工具保持 Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2／Prettier3.9.10，無新增依賴、設定、持久欄位、CI/CD 或執行期載入。99個執行期模組，狀態與副作用所有者不變。

## 先紅後綠、單元及整合

修改前位置16案中 I-P01／I-P04 ×兩倍速真實4 fail；另固定ccf947a初始化四案全fail。期限新14案12 fail／2 pass。後續死核心4秒、還原跳躍、同步失效的play拒絕、子元素blur及暫停未知移位均保存紅色紀錄後修復，不改成預期失敗、不skip、不改寫歷史瀏覽器資料。

新產品單元：Observer46、Visibility2、Recovery52、Monitor10。相依服務使用 satisfies 最小替身；DOM事件替身屬Node契約，不充當瀏覽器可信輸入證據。新整合：位置／初始化20、時序12、Runtime26；真實Observer／Adapter／Recovery，及必要Monitor／Runtime共同執行，外部SDK／媒體／路線維持替身。驗收判定工具36單獨分類。

涵蓋非零／真正零、A→B、完成後使用目前位置、未知／換所有者撤銷、可信播放交接、位置與倍速各讀一次及捕獲後重查；首個自有初始化、第二seek／核心／期限／新操作撤銷；seek→rate→play逐項最多一次與邊界重入；舊Promise resolve／reject、reset、資源釋放及終止後120tick不重載。完整恢復另驗兩個有效樣本與後續15個一秒區段，位置誤差≤1秒（按經過時間／倍速校正），保存與seek目標差≤0.000001秒。尾段停滯、影格／身分／倍速／額度改變與缺尾段均使驗收失敗。

同一事件腳本舊／新1／2倍比較：15000／30000／45000ms → 6000／12000／27000ms；一秒監控的250ms相位偏移在27250ms終止。一般升為長seek保留起點、同段不降級，表示／網站seek／通知合併不補額度。此結果只證明指定事件時序與正常對照，不量測真實網站誤介入率。

## 新安全差異

scan 6cd20a95-d167-4f23-8f59-2856849ee830，固定 ccf947a0d70086247691cb7cb8da18586af059c4..97d598ba415d65698c062cc5db04efa74af55082，2026-10-16T22:28:58.781986Z完成。snapshot digest：codex-security-snapshot/v1:sha256:292aa572d0f5bda2d325b9d18de997f5a11ff9f20c2b04220bec24e3a67b579a。

前置3／3；Observer／Adapter／Visibility七項、Recovery與契約七項由兩個唯讀子代理分工，主代理審Monitor／入口／測試與工具十三項。無存活候選，無需候選驗證或攻擊路徑階段；opaque proof不授予Native路線、GM或新網路權限，SDK因果標記不是認證。canonical manifest／findings／coverage／threatmodel／report／SARIF由Codex Security工具封存於 scanId 對應目錄；沒有普通檔案工具寫入封存區。

工具計量 coverage=complete、source=codex_rollout、threadCount=3：total7295105 tokens、input7268873、cachedInput6886656、output26232、reasoningOutput8035。這是工具回報的串流彙總，非獨立審查次數、測試數或瀏覽器證據。掃描模型gpt-6.1-sol／xhigh；不推定為主代理實際模型。

## 來源、清理與證據入口

最終來源JS SHA-256：55df86a4e9bc96db42736ec466a662f2a486687d803b8f0221e3dd32a8fa7741，未修改97d598b產品來源；診斷插樁產物不納入驗收。I-P01歸零／I-P02不歸零均保存2811.002824，I-P03真正零保存0，I-R03初始化到3844後仍還原2811.002824與指定倍速，再驗有效進度與15秒尾段，各1／2倍分列。

每案訂閱／控制器／Adapter先釋放，再核對timer0、SDK方法還原，最後釋放FakeClock；頁面工具監聽器解除／隨分頁關閉釋放。沒有建立transport攔截或受控學習；held／patterns／breakpoints均0，自有分頁0、loopback31999停止且主機連線拒絕。無正式GM，沒有讀寫或清空使用者資料。

私有證據 .work/br01-fix/2026-10-17-v2.1.27-ccf947a/：FORMAL-CASES.json（逐案ID／來源SHA／狀態／退出）、FORMAL-OUTCOME.json（完整結果）、TIMING-COMPARISON.json、SOURCE-RESULT／MANIFEST／CLEANUP／REPLAY、來源JS／map及截圖、各階段紅綠／verify紀錄。舊 [r2調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BR01_RCA_R2_2026-10-16.md) 的FAIL與隔離缺口保留；批准等待不能算執行超時的更正仍有效。

## 發布與安裝邊界

必要自動、安全及來源通過後統一封裝，GitHub只發布BiliCDN_TW.user.js。發布後先嘗試公開latest入口，再核對Tampermonkey、完整本體、singleton及hooks；當次入口實際受阻才請必要手動更新。v2.1.26完整正文及調查補記已原樣追加至 [歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2126-release-verification--2026-10-16)，既有Release／安全封存不回寫。

本輪沒有自然故障起因調查或安裝故障注入；正常安裝回歸通過也不代表這些項目通過。後續發布／安裝實測只追加main現行報告，不回寫已發布快照。

## 發布後實際安裝與限制

2026-10-16T22:36:22Z 正式發布 [v2.1.27](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.27)。公開 Release 僅 BiliCDN_TW.user.js；GitHub 附件 digest、無憑證公開 latest 全文與本地封裝一致。標籤 peeled commit 523a093744dd81beaee07a739173b3fd6b0342ea；main 後續只增加安裝／文件紀錄，標籤及封裝不回寫。第一個發行 Git 操作因自動批准審查未在期限內完成而未執行，工具允許的一次重試成功；該等待間隔不稱為 Git 執行耗時。

公開更新入口當次停在 Tampermonkey 中繼頁，完整本體仍等於 v2.1.26；使用者確認更新後才取得有效新文件。完整可執行 IIFE（不含 metadata／管理器外包裝）380977 bytes，SHA-256 c97b1e15c57f43f2db7ccd2434d3dc8490badae6040eae465b71155865d16188，與封裝同段一致。管理器5.5.1、版本2.1.27、Runtime／ControlCenter 各1、Fetch／XHR installed 均通過；hooks 是腳本觀察，不當作 Chrome Network 目的地確認。

Auto1倍：15.0104秒內影片時間+15.011336秒、影格+899；Auto2倍：15.0096秒內時間+30.018192秒、影格+1800。兩窗分別完成暫停／恢復、Right短seek，16個樣本均保持同一媒體、Auto及指定倍速，非seeking／paused／error／ended，逐段時間與影格前進，reloadCount為0。瀏覽器時間僅作正常播放觀察，精確救援毫秒期限仍由FakeClock契約判定。

控制中心入口被網站設定覆蓋層擋住，原生Enter／空白鍵未開啟；工具也不能點擊closed Shadow DOM。自動批准審查拒絕直接呼叫show，使用者明確批准「僅開啟既有控制中心」後才執行，未重建控制器或修改設定。概覽、原生Tab／Enter進入設定及診斷、Escape關閉通過；有效設定導覽序列的userRevision14／seekRevision6保持不變，設定內容雜湊前後相同。診斷21865字元、readonly、版本2.1.27、無原始URL。跨呼叫後返回鍵盤序列焦點未確立，未算通過；入口點擊、返回及剪貼簿寫入不宣稱通過，也沒有重開其歷史矩陣。

第一筆UI觀察誤用不存在的ControlCenter.deps.player，CDP返回例外，該筆作廢；改由Runtime.player讀取並嚴格檢查exceptionDetails／Error／實際value後，以單一有界序列重驗，才採用上列修訂／設定結果。原始限制與工具錯誤保存在INSTALLED-NORMAL.json，不以undefined相等當作通過。

控制中心關閉、恢復原2倍與播放後關閉自有分頁；Debugger／斷點解除、5個遠端物件參照釋放。自有held／patterns／請求／timer／listener／subscription／wrapper及分頁皆0，來源服務已停止；未安裝故障攔截或受控學習。INSTALLED-IDENTITY／NORMAL、PUBLIC-RELEASE／VERIFICATION、BROWSER-REPLAY及DELIVERY-AUDIT.json與截圖保存於本輪私有目錄。來源重播8／8與安裝重播6／6各自判定，均不改正式1134數量。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

舊 Release 的 v2.1.8 入口導向 [當版完整歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)，不表示該版證據屬於目前版本。

上一版 v2.1.26 的完整驗證正文及發布後 BR-01 調查補記已原樣保存在 [v2.1.26 歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2126-release-verification--2026-10-16)；更早的 v2.1.25 見 [當版完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2125-release-verification--2026-10-14)。其餘版本由 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md#版本) 追溯。歷史結果、Release 快照及安全封存不回寫；本節亦保留舊報告連往「歷史驗證導覽」的入口。

## v2.1.28 完整報告（2026-10-23）

# BiliCDN_TW v2.1.28 唯讀緩衝趨勢驗證

日期：2026-10-23（Asia/Taipei）。功能基準 8e410b7／v2.1.27，執行期完成提交 34672b0237d2ef1afd32254fe57f58ce27920d01；其後僅升版、文件、固定比較原件路徑及封裝維護。使用者另行指示發布，取代本功能原先只作本機交付的範圍。

## 驗證結果

| 層級 | 結果與界線 |
| --- | --- |
| 原始實作 N | 19 套件 1456／1456；基準 1297 加 143 單元、16 整合，0 fail／skip／todo／cancelled |
| 升版驗證 N | 完整 verify 退出 0：格式、型別、101 模組架構、1456 案、確定性建置、語法、v2-only 與暫存封裝校驗通過 |
| Codex Security | 固定 8e410b7..34672b0，25／25 正式項目，連同其餘 14 個變更檔案審查；0 候選／0 發現，coverage complete，無延期 |
| 乾淨來源 N | 644 個公開輸入，npm ci 及完整 verify 退出 0；1456 案、輸入雜湊零變更，403700 bytes 本體逐位元組一致；專用暫存副本已清除 |
| 來源瀏覽器 S | 本輪未執行，Node 模型不代替可信瀏覽器或網站驗收 |
| 實際安裝 I | Tampermonkey 5.5.1、完整 v2.1.28 本體、唯一實例與 hooks 通過；指定影片 Auto 1／2 倍正常操作及各十五秒播放通過，詳見下節 |
| 公開交付 | 已正式發布；main／peeled tag 4ea26c11b9225c42303b49e280ce5c1a8e873b74、唯一腳本附件與 public latest 全文相符；後續僅驗收文件提交 main |

工具版本、依賴、設定與持久 schema 均不變。本功能只輸出診斷，沒有啟用預測救援；一般 6／12／15 秒、長 seek 15／30／15 秒與原有所有權、額度保持。

## 行為契約與非干預

[完整功能報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BUFFER_TREND_2026-10-23.md) 與 [逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_TREND_2026-10-23.json) 保存來源集合摘要 aac2698251764f46c51eee5dca7940829099393174ef90f77f16dafdaa559d0a、全部具名案例及十二個 1／2 倍合成窗口。發布不改寫其中原先的未發布身分、結果或限制。

驗證完整八秒窗口、1.5 秒空隙、僅內插、倍速校正、下降兩秒與低緩衝十秒門檻、時間／影格前進、資格失效、完成傳輸去重及上限。資料不足 candidate 為 null，不能當健康。正常播放、兩秒抖動、五秒停頓及突發回補不產生候選；兩組下降情境各倍速首次候選為 8000 ms，沒有新增控制副作用。

真實 Monitor／Runtime／Recorder 與必要 Routes／Recovery／記憶體儲存整合，核對事件、決策、親和、計畫、SDK 與寫入軌跡不變。既有精確期限、零／非零位置、倍速、初始化、新操作、晚到 Promise、兩樣本 recovered、後續十五秒播放及終止後 120 tick 契約維持。資源由所屬元件釋放後先核對，再釋放 FakeClock。

診斷只輸出有限數值、布林及列舉；32 筆／8 KiB 趨勢、Recorder 128 KiB、匯出 96 KiB 上限及優先縮減契約通過。沒有 URL、請求／內容識別或核心物件輸出；沒有新增 UI、設定、持久鍵、網路或計時器。

## 本輪安全差異

Codex Security scan b66acf88-7651-4fd7-b044-2c32e18ff44d，完成於 2026-10-23T05:40:04.394817Z。固定範圍為 8e410b797a4195dfec9060e0af36872491131b3f..34672b0237d2ef1afd32254fe57f58ce27920d01；snapshot digest 為 codex-security-snapshot/v1:sha256:fb3cc62c693bbf564c85523a04ad0b899f48c2c19b33e5a2045b942910495638。主代理審查維護／保護差異，兩位獨立審查者分別檢查 Monitor／Runtime／領域及診斷輸出鏈，未發現可報告安全候選。

canonical findings SHA-256 dc80d86ff553bd12f57ec2167a29cc7ff2d6829999ab36061d79e3addc2c5465；coverage SHA-256 e86e0657ef5af51caf2062b7bbb6e1923920de86d16cef9589ee2bd7b35fb6e4。工具管理的原件保持原位。工具提供的使用量為部分歷史彙整，含 rollout_unavailable，不能作本次純增量成本；不將使用量不完整誤稱掃描覆蓋不足。

## 封裝原件

v2.1.28 完整腳本為 403700 bytes，SHA-256 8b3ec29aa2b26cb0b9708a91aed65e2d6411e09875e2ac87c70436f0eeec418d。版本設定以 release.json 為準；舊 v2.1.27 五項原件已按原 bytes／SHA 移至封存，其完整現行報告追加保存。修改保護適用範圍前保存 [原清單快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-23_34672b0.json)，沒有改寫原始雜湊。

## 發布後實際安裝

公開 latest 回應 200、版本 2.1.28、403700 bytes，SHA-256 與封裝一致；GitHub 只有 BiliCDN_TW.user.js 附件，API digest 相符，非 draft／prerelease。公開入口當次停在 Tampermonkey 中繼頁，完整舊本體仍等於 v2.1.27；使用者完成更新後才核對新版文件。

完整執行 IIFE（不含 metadata／管理器外包裝）401743 bytes，SHA-256 0d8b9e9c629c9432a605fa2994fd876d5f36ad31435863e93931471aab4ea3d1，與封裝同段一致；管理器 5.5.1、版本 2.1.28、Runtime／ControlCenter 各一個，Fetch／XHR installed。hooks 屬腳本觀察，不當作 Network 目的地確認。

Auto 1 倍有效窗口：15012.7 ms 內位置增加 14.971896 秒、影格增加 901；Auto 2 倍：15008.2 ms 內增加 30.017074 秒、影格增加 1800。各 16 筆樣本、十五個區段均保持同媒體、Auto、指定倍速、非 paused／seeking／ended／error，時間增加 >0.05 秒且影格增加，reloadCount 為 0。兩倍速均完成原生暫停／恢復；各次 Right 短 seek 的 userRevision 與 seekRevision 恰增一次，目標前進約五秒。

真實診斷輸出 28315 bytes，bufferTrend schemaVersion 1／algorithm buffer-window-v1、14 筆／7736 bytes，沒有原始 URL。此為唯讀報告檢查，沒有開啟控制中心或寫剪貼簿。私有安裝證據重播 node:test 五項全部通過、退出 0，與正式 1456 案分開；只證明已收集資料符合指定判定。

初始參照／結果綁定錯誤未取得有效採樣；切換倍速時浮動小窗的不可見控制項不算產品失敗。首次 2 倍系列起點仍 seeking，保留但不計持續播放；確認 seek 結束後才開始獨立完整窗口，沒有拼接。觀察均在單次呼叫完整 await，沒有跨呼叫背景 Promise。最後恢復原 2 倍播放、解除斷點／Debugger、釋放遠端物件群並關閉自有分頁；自有攔截、請求、timer、listener、subscription、wrapper 及分頁均零。本輪未安裝故障注入。

## 發布與安裝限制

本輪沒有量測真實網站卡頓率、誤介入率或 CPU／記憶體開銷。完成傳輸 bytes 不等於即時頻寬；影子候選不授予換線、探測或重載權限。自然起因、安裝版故障注入、背景／gate／剪貼簿寫入及歷史矩陣不重開。控制中心入口點擊沿用使用者跳過決定，不作阻塞。

外部連結未自動連網，私有證據未載入；精確歷史斷鏈／搬移網址限制由文件檢查分列，不宣稱全部連結有效。公開封存不讀取本機私有 payload，本輪沒有私有搬移。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

仍被不可變 Release 引用的 v2.1.8 入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版完整正文已原樣追加至 [v2.1.27 歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2127-完整報告2026-10-17)。其他版本由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯；舊 1134 案、實際安裝與原始限制不回寫。

## v2.1.29 完整報告（2026-10-24）

# BiliCDN_TW v2.1.29 緩衝候選 v3 驗證

日期：2026-10-23（Asia/Taipei）。發布前來源基準為 4ce7195，功能實作為 a268bab。舊版完整報告原文先追加保存，再更新本固定入口；原件及歷史結果不回寫。

## 驗證結果

| 層級 | 結果與界線 |
| --- | --- |
| 已完成的功能來源 N | 1773／1773 通過，較凍結基準新增 241 案；詳見下列原始功能證據 |
| 效用整合 N | 100 次執行全部有效且通過，含兩倍速各自的固定與保留情境 |
| 功能乾淨來源 N | 662 公開輸入，npm ci／verify／效用命令均退出 0，輸入雜湊零變更 |
| v2.1.29 升版驗證 N | 型別、101 模組架構、1773／1773、格式、文件／公開封存、完整 verify 通過；無略過或取消 |
| v2.1.29 乾淨來源 N | 669 公開輸入；npm ci、verify 1773 案及效用 100 案全部退出 0，輸入雜湊零變更；效用 JSON 與主工作區逐位元組一致 |
| 本輪安全差異 | 依風險不另開 Codex Security，理由見下節；舊掃描不作本次證據 |
| 來源瀏覽器 S | 本輪未執行 |
| 實際安裝 I | 使用者更新後，完整本體、管理器、唯一實例／hooks 及 Auto 1／2 倍正常操作與十五秒播放通過；故障救援未執行 |
| 公開交付 | main、v2.1.29 標籤、唯一腳本附件及公開 latest 完整位元組核對一致；實際資料見下列交付證據 |

## 行為契約與非干預

[完整 v3 功能報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BUFFER_CANDIDATE_V3_2026-10-23.md) 及 [逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CANDIDATE_V3_2026-10-23.json) 保存來源／情境雜湊、紅色契約、預期／實際及清理。產品修改前 58 個新契約為 26 通過／32 失敗，修正後全部通過；撤回 v2 原型的 FAIL 保持。

八秒窗口、下降至少兩秒、目前校正緩衝不超過十秒維持。首次成立從零確認，後續創低區間累計兩秒才成立；回補／持平當下撤銷顯示，未補回基準保留有界證據，完整補回、資格失效、八秒未創低及所有者變更清除。

每倍速的兩秒抖動、突發回補、低緩衝鋸齒各零候選；慢／快耗盡提前十八／三秒，兩種微量回補耗盡均提前五秒。短持平及極小回補正常對照仍各有兩段、合計四秒候選，不宣稱消除全部多餘候選或量得真實網站誤報率。

一般 6／12／15 秒、長 seek 15／30／15 秒及既有額度、冷卻、兩樣本 recovered、十五秒持續播放與終止後不重載契約維持。PlayerMonitor 唯一保存確認狀態；Runtime 只轉交、Recorder 只驗證複製輸出。診斷為 schemaVersion 3／buffer-window-v3，舊版本分開解析，內部證據與身分不輸出。容量與清理保持，沒有新增設定、持久鍵、依賴、計時器、網路工作或提前備援。

## 本輪安全差異

執行期差異限純數值確認、Monitor 自有記憶體狀態及既有診斷白名單版本，不擴大可信操作、Native 授權、網路、儲存或複製權限。Runtime、Routes、Recovery、Measurement 與控制觀察者來源不變，依專案風險規則不要求新增安全掃描。版本／原因白名單、去敏、副本隔離、有界性、重入及非干預由正式契約核對；這是風險判斷，不是新的掃描結論。

## 封裝與公開交付

v2.1.28 五項原件按原 bytes／SHA-256 歸檔，原成本比較只更新封存路徑，仍載入原 v2.1.27／v2.1.28 腳本。[升版前清單快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-23_4ce7195.json) 保存舊保護資料，不更新原件雜湊掩蓋變更。

確定性建置為 407926 bytes，SHA-256 為 e0c178987111d99ae69762287fe3769cc1af722a1ee6e586d125ce0ba8b2e9b4；版本為 v2.1.29。正式五檔封裝完成，四筆 checksum 與原始保護均核對；封裝後的完整 verify 再次通過。Release 只上傳 BiliCDN_TW.user.js；封裝後的快照不回寫，公開交付等後續結果只更新本現行報告。

[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.29) 已發布。發布提交為 f962bd0ce5678cb413cc861db0ea15fe22270c36，公開 main 與標籤當時均指向該提交；後續 main 文件提交不移動標籤。唯一附件名稱、大小、GitHub digest 及不使用登入憑證的公開 latest HTTP 200 全文均與本機原件一致。[交付與安裝逐項 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CANDIDATE_V3_DELIVERY_2026-10-23.json) 保存核對時間、雜湊、乾淨來源與原始正常取樣，與舊效用證據分開。

## 發布與安裝限制

本輪公開更新入口實際停在 Tampermonkey 中繼頁，新載入影片當時完整本體仍等同 v2.1.28；使用者完成必要手動更新後重新核對。Tampermonkey 5.5.1／腳本 2.1.29、完整可執行本體 405968 bytes／8b5778ed48ba542c43ef972ba3fdc1b6e109937502e22879ee38e388bc97f627（移除 metadata 與管理器外層包裝），與已發布本體一致。Runtime／ControlCenter 各一，Fetch／XHR 均為 installed、fetch-and-xhr-verified。

指定影片 BV1tFZZBQE57 維持 Auto，當次實際 3840×2160；1／2 倍分別以完整 await 的十五秒取樣驗證十五個一秒區段，每段時間增加大於 0.05 秒且影格增加，無 paused／seeking／error／ended。兩倍速的真實按鈕暫停／恢復、鍵盤短 seek 與倍速操作均有媒體狀態對照。沒有強制畫質或以標題宣稱 8K 通過；原 2 倍設定恢復，取樣計時器、斷點、除錯參照及自有分頁已清理。這是正常回歸，不能代替候選效用窗口或安裝版故障救援。

自然起因、故障注入、背景／gate／剪貼簿及歷史矩陣不重開；既有六組五十秒樣片仍為工具阻塞／未執行，不轉算通過。正常安裝另記，控制中心入口沿用跳過決定。

沒有量測真實網站卡頓率、救援成功率或瀏覽器純功能成本。傳輸 bytes 不等於即時頻寬，影子候選不授予控制權。外部文件連結未自動連網、私有 payload 未讀取；歷史斷鏈與搬移限制分列。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版完整報告見 [v2.1.28 歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2128-完整報告2026-10-23)，其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。舊發布時 1456 案及安裝結果不回寫。

## v2.1.30 完整報告（2026-10-24）

# BiliCDN_TW v2.1.30 周期候選與診斷成本驗證

日期：2026-10-24（Asia/Taipei）。功能基準 60de147／v2.1.29，執行期實作 ff22213，效用證據 a8713c6。上一版完整正文已先追加保存，原發布產物與歷史結果不回寫。

## 驗證結果

功能來源完整 verify 1834／1834 通過，較本輪基準 1795 新增三十九案；相對已發布版 1773 新增六十一案。型別、102 模組架構、格式、文件／公開封存、確定性建置與封裝契約通過，無略過、取消或待實作。升版後完整 verify 同為 1834 案通過。乾淨公開來源 687 項輸入，先以 npm ci 安裝鎖定依賴，verify 1834 案及功能 100／周期 72 案均退出 0；檢查後輸入雜湊零變更，兩組逐案結果與主工作區完全相同。

[完整功能報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BUFFER_CANDIDATE_V4_2026-10-24.md) 與 [逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CANDIDATE_V4_2026-10-24.json) 保存來源／輸入雜湊、紅色契約、七十二次新整合、一百次原情境與四十八次成本比較，均有效且通過。紅色階段六十次為三十通過／三十失敗，修復後轉綠，舊證據不回寫。

兩倍速的兩秒周期 75% 回補耗盡均提前六十八秒出現候選，最後候選距耗盡兩秒；六秒完整回補正常對照由四十秒候選縮為首周期兩秒。共同前綴正常對照仍有五秒候選，不能預知未來回補。報告 schemaVersion 4／buffer-window-v4 增加有界 cycle 數值，短期趨勢與周期欠量分開解釋，候選不取得控制權。

## 行為契約與非干預

原一百組的情境雜湊、暖機／情境輸入、媒體軌跡及操作陣列與 v3 證據一致。一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻、生命週期兩次重載、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick 契約維持。所有權、設定、持久欄位、依賴、計時器與網路工作不增加。

兩小時及傳輸情境保持樣本三十二／旁證一百二十八、趨勢三十二筆／8 KiB、Recorder 128 KiB／匯出 96 KiB 上限，清理核對通過。完整腳本本機配對成本每 tick 中位數約減少 31%，包含前輪 Recorder 容量優化；不能當作瀏覽器純功能開銷或真實播放改善。

## 本輪安全差異

Codex Security 掃描 d3b2242c-b346-4c59-9940-a04843cf492e 已完成，固定差異 67b45c4 至 ff22213，二十四項清單完成交叉審查，零可報告發現。範圍涵蓋投影、隔離、有界性與控制邊界；後續測試、原件搬移路徑與升版記帳另由自動檢查驗證，不冒稱同一掃描涵蓋全部後續提交。

## 交付與安裝狀態

v2.1.29 五項原件按原 bytes／SHA-256 搬入公開封存，原成本比較仍使用原始腳本。[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_a8713c6.json) 保留原保護資料。v2.1.30 本機確定性腳本 415345 bytes，SHA-256 124830e7d08e71ef34a2ba048c6624f578060276a09b01e0b9905c0f4175f03d。必要自動、安全與乾淨來源驗證已完成；[正式 v2.1.30 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.30) 已發布，發布提交 f4468f0a29bf97e5e359ae22020962f81a6ab3c4；遠端 main 當時與標籤解參照一致，後續文件提交不移動標籤。唯一附件名稱、大小與 digest，及無登入憑證的公開 latest HTTP 200 全文，均與本機一致。[交付與安裝 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CANDIDATE_V4_DELIVERY_2026-10-24.json) 分列完整證據；已發布五檔快照不回寫。

## 發布與安裝限制

本輪來源隔離未執行。公開更新入口當次停在 Tampermonkey 中繼頁，影片本體仍精確等同 v2.1.29；使用者完成必要手動更新後重新驗收通過。Tampermonkey 5.5.1／腳本 2.1.30、完整可執行本體 413387 bytes／fb14da950bcfff4e0a2951d494b7f474b0e24827518c595e18430f493e396ace 與已發布本體一致；Runtime／ControlCenter 各一，Fetch／XHR 均 installed、fetch-and-xhr-verified，即時報告為 schemaVersion 4／buffer-window-v4。

指定 BV1tFZZBQE57 維持 Auto，當次實際 3840×2160；1／2 倍各以完整 await 十五秒取得十六筆原生媒體樣本，十五個一秒區段時間增加大於 0.05 秒且影格增加，沒有 paused／seeking／error／ended。兩倍速真實按鈕暫停／恢復、綁定分頁原生鍵盤短 seek 均有實際狀態對照，重載計數為零；既有二倍設定恢復，自有計時器、斷點、來源參照及分頁已清理。locator.press 曾逾時、raw CDP Input 不支援，未作通過證據；使用有新能力前提的分頁原生按鍵完成。這是正常安裝回歸，不是候選效用或故障救援驗收。

原六組五十秒樣片維持工具阻塞／未執行，不拼接短窗口。自然起因、故障注入、背景／gate／剪貼簿及歷史矩陣不重開；控制中心入口沿用跳過決定。既有正常安裝結果只屬當時版本。

沒有量測真實網站誤報率、卡頓率或救援成功率；不啟用提前備援。外部文件連結未自動連網、私有證據未載入，歷史斷鏈／搬移限制分列。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.29 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2129-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊 1773 案及安裝結果保持。

## v2.1.31 完整報告（2026-10-24）

# BiliCDN_TW v2.1.31 可見性屬性還原所有權驗證

日期：2026-10-24（Asia/Taipei）。基準 f582069／v2.1.30，執行期修復 c65c506。上一版完整正文已原文追加保存；已發布五檔、歷史結果與安全原件不回寫。

## 驗證結果

新增三十五個具名契約：三十三個 VisibilityAdapter 單元案例、兩個真實 Runtime 整合案例（1／2 倍）。在未修改產品上，同一批斷言為十八通過／十七失敗，退出 1；修復後三十五案全部通過，退出 0。正常還原對照在紅色階段即通過。逐案名稱、來源雜湊、失敗與修復後結果見 [公開證據 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/VISIBILITY_OWNERSHIP_2026-10-24.json)。

功能來源及升版後完整 verify 均為 1869／1869，較 v2.1.30 增加三十五案；型別、102 模組架構、格式、文件／封存、確定性建置及封裝通過，無略過、取消或待實作。來源階段的乾淨副本有六百九十項輸入；加入 v2.1.31 封裝與公開證據後的新副本有六百九十七項。兩次 npm ci 與完整 verify 均退出 0，檢查前後輸入雜湊不變。最後報告與日誌補登只另跑文件、封存及差異核對，不冒稱新增執行期測試。

初次綠色執行有兩個整合案例錯把既有 Lifecycle reset 算成額外副作用；改以同一設定腳本的獨立正常對照核對，保留原失敗紀錄。初次嚴格型別檢查、受限工具程序的暫存 Git 權限，以及第一份乾淨副本的測試格式問題均已修正並重跑；不把這些失敗列為產品通過。

## 行為契約與非干預

每個成功安裝的屬性綁定原 document、完整原描述子及安裝 accessor；還原只在 getter、setter、enumerable、configurable 全部仍相符時執行。較新 getter／setter、資料屬性、刪除或旗標改動均保留。比對不呼叫屬性 getter；單項讀取／還原失敗不阻止其他清理，釋放後不重試。原有 setter、監聽器順序、真正可見性與 control-loss 訂閱生命週期保持。

Runtime 停用／啟用與獨立正常對照的 SDK 呼叫、reset 及三次設定寫入完全相同，沒有額外選路、探測、重載或寫入。整合案例先釋放所屬元件，再核對計時器、監聽器與儲存訂閱歸零；VisibilityAdapter 沒有新增計時器。

完整既有套件維持一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻、生命週期兩次重載、位置／倍速還原、新操作、晚到 Promise、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick。候選 v4、設定、持久欄位、依賴及控制權不變。

## 本輪安全差異

Codex Security 掃描 42695205-75ca-42b8-b771-8fe7dc608187 已完成封存，固定差異 f58206939dde5507717ef24bf8efe84370acbd89 至 c65c5069d901bfa42045b05e886ec423c0f6e191。六項來源清單及三份變更指南完成審查，另由獨立架構審查交叉核對，零可報告發現、無待判定候選。這是指定差異審查，不是全儲存庫無漏洞保證；後續測試清理斷言與發布記帳由自動驗證承接，不宣稱同一掃描涵蓋全部後續提交。工具回報總 token 6,996,534，計量為 partial 且包含快取與共用歷史，不作本次純掃描用量。

## 來源隔離

IAB 自有 loopback 頁面載入實際 VisibilityAdapter 模組，在全新原生 iframe 分別驗證兩個屬性的正常繼承、accessor、資料描述子、較新 getter／setter、資料屬性、刪除、兩個旗標與重新啟用，共二十案通過。getter 執行數為零；不接正式 GM 儲存，結束 iframe 為零、來源服務及自有分頁已關閉。

第一次校準因 strict eval 的模組變數未暴露而失效，尚未執行產品斷言；改正取得模組方式並清理舊 iframe 後才重跑。首次工具呼叫送出至返回的 1340.5 秒僅為總間隔，批准等待與實際執行時間未分離，不據此宣稱執行超時。原失效紀錄保留。

## 交付與安裝狀態

v2.1.30 五項 Release 原件已按原 bytes／SHA-256 搬入公開封存；[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_c65c506.json) 保存保護資料。[v2.1.31 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.31) 已發布，發布提交 a4d5603abc98af8d76b90ae2007301a8b5abc854。當時遠端 main 與標籤解參照一致，唯一附件及無登入憑證的公開 latest HTTP 200 全文均為 415770 bytes／SHA-256 5461c534325ad2063007eb220576b2d4b5d9472cce9d3a00a773e23521dd2507，與本機逐位元組一致。後續文件提交不移動標籤，不回寫五項 Release 快照。

公開更新入口當次停在 Tampermonkey 中繼頁，影片本體仍精確等同 v2.1.30。使用者完成必要更新後，重新核對 Tampermonkey 5.5.1／v2.1.31、完整本體 413812 bytes／SHA-256 36e48b746b596638260c5821a87482e6ddde1331c0975b9d55920b228e725258，與已發布本體一致；Runtime／ControlCenter 各一，Fetch／XHR installed、fetch-and-xhr-verified。斷點只用於身分核對，已解除後才觀察播放。

指定影片保持 Auto，當次實際 3840×2160。1／2 倍真實按鈕暫停／恢復及分頁原生 Right 短 seek 均有狀態對照。有效窗口各以單次完整 await 取得十六筆樣本、十五個一秒區段；每段時間增加大於 0.05 秒且影格增加，倍速精確，沒有 paused／seeking／ended／error，reloadCount 為零。一倍經過 15049.1 ms、影片前進 15.0552 秒；二倍有效重跑經過 15125.6 ms、前進 30.247595 秒。

二倍首窗第十一個區段末出現 seeking，連續非尋位前提中斷且原收集器未記錄事件來源，判 INVALID／產品 verdict=null，不能作正常播放通過或新修復缺陷的證據。補上同窗 seeking／seeked 等媒體事件收集後只重跑一次，有效重跑沒有事件；原窗口完整保留，不拼接或覆寫。收尾斷言曾遇跨 realm 空陣列原型差異，改用事件數精確等於零驗證，產品期待不變。原有二倍設定恢復，自有 timer／listener、斷點、遠端物件參照及分頁均清理；三份乾淨來源暫存目錄已移除。

[交付與安裝 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/VISIBILITY_OWNERSHIP_DELIVERY_2026-10-24.json) 保存版本、雜湊、逐秒資料、逐案有效性與清理結果。正常安裝回歸與來源隔離分開，不替代故障救援驗收。

## 發布與安裝限制

所有權依可觀察描述子判斷，無法辨識完全相同描述子的重新安裝來源；未增加原生 getter 身分認證，既有取值失敗的保守行為保持。必要自動、安全、公開下載與安裝正常回歸均已分層記錄；一次無效安裝窗口保留，不等同已定位網站尋位起因。

本輪安裝回歸只涵蓋指定 BV1tFZZBQE57 的 Auto 1／2 倍正常播放、暫停／恢復、短 seek 及十五秒進度。控制中心入口沿用跳過決定。自然起因、故障注入、背景／gate／剪貼簿、六組五十秒樣片及歷史矩陣不重開。沒有量測真實網站誤報率、卡頓率或救援成功率；不啟用提前備援。外部文件連結不自動連網，私有證據及不可變歷史連結限制分列。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.30 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2130-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊版本結果保持。

## v2.1.32 完整報告（2026-10-24）

# BiliCDN_TW v2.1.32 量測中繼資料驗證

日期：2026-10-24（Asia/Taipei）。基準 ac44474／v2.1.31，執行期修復 5fa25f8。只改善量測中繼資料的驗證與既有鎖內提交，不新增設定、持久欄位、依賴或計時器。

## 驗證結果

新增三十五個具名契約：三十個單元、五個真實 Store／MeasurementController 整合案例。原產品首次三十一案為九通過／二十二失敗，退出 1；額外健康游標上限案例在修正前使三十五案為三十四通過／一失敗，退出 1；最終三十五案全部通過，退出 0。正常對照、原始失敗、各階段來源雜湊及逐案名稱保存在 [公開 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/MEASUREMENT_METADATA_2026-10-24.json)。

功能來源完整 verify 1904／1904，較 v2.1.31 增加三十五案；型別、102 模組架構、格式、文件／封存、確定性建置及封裝通過，沒有略過、取消或待實作。七百項輸入的乾淨來源副本 npm ci 與完整 verify 均退出 0，輸入雜湊不變，副本已清理。升版後完整 verify 再次 1904 案通過；含封裝的全新副本有 707 項輸入，npm ci／verify 均退出 0，輸入不變，副本已清理。最後補登交付結果只再執行文件／封存與差異核對，不宣稱新增執行期案例。

原工具程序的暫存 Git 權限失敗及測試型別／格式調整均保留在本機日誌，完成修正後重跑；不以失敗執行宣稱通過。新案例屬既有正式 measurement-state 套件，沒有獨立產品測試橋接。

## 行為契約與非干預

MeasurementMetaStore 只讀 schema 2 的自有資料描述子，拒絕陣列、繼承欄位、accessor 與數值強制轉換。catalogCursor 限非負安全整數；lastChallengeAt 限有限、非負且不晚於明確注入的目前時間，合法小數與真正零保留。非法欄位各自歸零，不連帶丟棄另一合法值。

get 重新讀取最新儲存，不寫入或遷移；update 以最新合法值合併，非法部分更新保留合法目前值，只寫 schema、catalogCursor、lastChallengeAt、updatedAt。未知歷史欄位只在明確更新時不再保存，不事後清空其他使用者資料。回傳副本互不影響；儲存 get／set／delete 例外保持原傳播語意。

起播選擇仍使用同步快照，不因等鎖延長起播期限。既有 withLock 回呼取得鎖後先核對標記、重讀目前游標，再核對標記及遞增；兩個等待者與外部更新不再被舊游標覆蓋。起播與健康量測游標達安全整數上限時歸零。健康計畫繼續在既有鎖內重新檢查資格、保存冷卻與安排工作。

只有 MeasurementController 啟動主動探測；路線、授權、親和、恢復、控制觀察與診斷所有權不變。完整既有契約維持一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻、生命週期兩次重載、位置／倍速、新操作、晚到 Promise、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick；候選 v4 不變。

## 本輪安全差異

新的 Codex Security 掃描 b0be17ea-8c04-4dc4-b6c4-e8cf890c80a7 已完成封存，固定 ac4447451c22125931feb56535b1854ec86712e1 至 5fa25f82d675eef14bc177279d978ceb1b3030d1。六項來源清單與四份變更指南完成檢查，獨立架構審查交叉核對；零可報告發現、無待判定候選。這是指定差異審查，不是全案無漏洞保證。後續版本／文件／封裝記帳由自動核對承接，不宣稱掃描涵蓋所有後續提交。

工具回報總 token 5,780,067，coverage 為 partial，包含快取及共用歷史，另有缺失 thread；不作本次獨立掃描成本。

## 來源隔離

IAB 自有頁面載入真實 Store 與 MeasurementController，以記憶體儲存、模擬 probe 和原生 Web Locks 驗證八項：原生鎖可用、非法游標獨立預設、唯讀不遷移、四欄白名單、未知 getter 零執行、起播不等待被持有的 metadata 鎖、兩個排隊回呼保存最新游標及冷卻，以及清理。全部通過；自有 timer、活動鎖及儲存項目歸零。

單頁兩個控制器不是實際跨分頁 GM 驗收。未接正式 GM 或執行真實 CDN 探測；來源分頁及服務已關閉。第一次本機服務在受限程序中無法由 IAB 連線，沒有產品斷言；改用主機服務後完成。原錯誤分頁由使用者關閉，工具已核對不存在。

修正後工具呼叫送出至返回為 4014.3937 秒總間隔；實際執行、批准等待及其他等待沒有分離量測，均保留未知，不能據此判為執行超時。

## 發布與安裝狀態

v2.1.31 完整報告原文追加保存，五項 Release 依原 bytes／SHA-256 搬入公開封存。[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_5fa25f8.json) 保留原保護資料。[v2.1.32 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.32) 已發布，發布提交 30ffffd226c55f1a12207b14d5743d34beb4aa26。當時遠端 main 與標籤解參照一致；唯一附件及無登入憑證的公開 latest HTTP 200 全文均為 417076 bytes／SHA-256 156d4b0f80fc30c8e88a220bc39727c49b95408585e6c39bf7c9d193f8737e0d，與本機逐位元組一致。後續文件提交不移動標籤、不回寫五項 Release 快照。

公開更新入口首次停在 Tampermonkey 中繼頁，工具清單沒有可操作的管理器確認頁；新載入指定影片的完整本體仍為 413812 bytes／SHA-256 36e48b746b596638260c5821a87482e6ddde1331c0975b9d55920b228e725258，精確等同已發布 v2.1.31。當時 v2.1.32 安裝身分與 Auto 1／2 倍正常回歸記為工具阻塞／未執行，產品判定為 null；原紀錄保持，不以後續結果回寫。

首次嘗試未重複請求工作授權或使用者操作；發布交付完成後保留上述實際阻塞。自有更新與影片分頁已關閉，Debugger 已解除，未建立故障攔截或額外播放收集器。[交付 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/MEASUREMENT_METADATA_DELIVERY_2026-10-24.json) 保存公開校驗、完整本體及清理證據。

使用者確認完成更新後，於 2026-10-24 的新文件核對 Tampermonkey 5.5.1／v2.1.32，完整本體 415118 bytes／SHA-256 d0286eb6ef089cb5d89432cc0fef65fa59f35cfb948e880f452f52b9a5cb548e 與發布檔一致；重載後再次全文比對相同。Runtime／ControlCenter 各一，Fetch／XHR installed、fetch-and-xhr-verified。短暫 Debugger 只取得身分，斷點與暫停在操作及播放窗口前解除。

指定影片 BV1tFZZBQE57 保持 Auto，當次實際 3840×2160。1／2 倍各完成真實按鈕暫停／恢復與分頁原生 Right 約五秒短 seek，再各以單次完整 await 取得十六筆樣本、十五個一秒區段。每區段時間增加大於 0.05 秒且影格增加，倍速精確、同媒體與內容，沒有 paused／seeking／ended／error 或新可信輸入；同步媒體事件收集為零。1 倍經過 15018.8 ms、影片前進 15.017997 秒；2 倍經過 15011.9 ms、前進 30.021783 秒。兩窗首次即有效通過，recovery 保持 healthy，reloadCount 為零。

倍速選單前兩次定位把顯示文字當成 listitem 的無障礙名稱，未找到項目；依已觀察文字修正後成功。這是操作定位失敗，尚未開始播放窗口，不是產品失敗，也未用重跑挑選窗口。原二倍速已恢復，自有計時器、監聽器、斷點、遠端物件參照及分頁均清理。

[安裝版逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/MEASUREMENT_METADATA_INSTALLED_2026-10-24.json) 保存逐秒、操作前後、有效性及清理結果。另以五個具名 node:test 重播身分、兩倍速操作／進度、清理與五檔不變條件，全部通過；這五個證據檢查不加入正式 1904 案。本輪正常安裝回歸已完成，原中繼頁阻塞、來源隔離及實際安裝分開記錄。

## 發布與安裝限制

普通欄位讀取不執行 getter 或強制轉換，但 Object.getOwnPropertyDescriptor 仍可能觸發 Proxy trap；沒有承諾任意 Proxy／受損 GM 平台隔離。缺少 Web Locks 時沿用直接執行退化，不宣稱跨分頁互斥。get／update／clear 本身不另外加鎖。

時鐘非法時以零處理；時鐘倒退使原冷卻落在未來時，該欄失效歸零。沒有新增跨分頁單調時鐘；探測仍須通過原資格與額度。白名單是明確 metadata 更新的持久邊界，不是全儲存清理或安全沙箱。

本輪完成的安裝版只涵蓋管理器、完整本體、唯一實例、hooks 與指定影片 Auto 1／2 倍正常播放、暫停／恢復、短 seek 及十五秒進度。控制中心入口維持依指示跳過；自然起因、故障注入、背景／gate／剪貼簿、六組五十秒樣片與歷史矩陣不重開。不宣稱真實卡頓率或救援成功率改善，不啟用提前備援。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.31 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2131-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊結果保持。

## v2.1.33 完整報告（2026-10-24）

# BiliCDN_TW v2.1.33 緩衝候選到期驗證

日期：2026-10-24（Asia/Taipei）。基準 4e06eac／v2.1.32，執行期修復 d6197de。只修正唯讀周期確認額度的到期處理；不調整門檻、不啟用提前備援。

## 驗證結果

新增三十四個具名契約：三十個純領域單元、四個真實 Monitor／Runtime／Recorder 整合案例，1／2 倍各自登記。未修改產品為十八通過／十六失敗，退出 1；最小修復後同一批斷言三十四案全通過，退出 0。[逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CYCLE_RENEWAL_2026-10-24.json) 保存來源雜湊、紅綠結果、固定輸入、完整前後觀察與來源隔離。

首次綠色嘗試中，四案把報告 creditMs 誤當成專屬周期額度而失敗；該欄原本是短期及周期確認的最大值。修正測試語意後，在舊產品重新取得十八通過／十六失敗，再以相同斷言轉綠；沒有降低候選或確認時間的要求，原失敗仍保存。

功能來源完整 verify 1938／1938、tooling 398 案、型別、102 模組架構、格式、文件／封存、確定性建置及封裝全部通過。全新七百一十項輸入副本 npm ci／verify 退出 0，輸入雜湊不變，副本已清理。第一次乾淨副本因受限 Git 暫存失敗而漏入新測試，型別檢查失敗；修正環境後另開新副本重跑，原紀錄保留。升版後完整 verify 再次 1938 案通過；另以含封裝的 717 輸入全新副本執行 npm ci／verify，均退出 0、輸入不變且已清理。發布準備時尚未暫存搬移曾使文件檢查找不到舊 Release 路徑，更新索引後文件及完整驗證全通過，原日誌保留。

## 行為契約與非干預

根因是最近欠量超過八秒時，程式只清除欠量與時間戳；若同筆樣本結束回補並建立新欠量，後段便沿用先前 cycleCreditMs。現在到期分支同時撤銷該額度，新證據首次成立從零開始，1999 ms 不確認、2000 ms 才可確認。7999／8000 ms 尚有效，8001 ms 才到期；獨立且仍有效的短期證據保持原判定。

| 固定情境（各 1／2 倍） | 舊實作 | 修正後 |
| --- | --- | --- |
| 舊證據到期、單次下降後立即回補 | 第 17 秒多出一秒候選；合計兩段、兩秒 | 該段消失；只保留先前合法的一段、一秒 |
| 舊證據到期、新欠量持續下降 | 第 17 秒直接沿用舊確認；合計四秒 | 第 19 秒完成新的兩秒確認；合計兩秒 |

原有一百次功能情境及七十二次周期開發／保留情境在修復前後全部有效、通過，完整結果物件逐項相同，包含候選段、十五秒後續、首次／最後提前量、輸入、操作、副作用、容量與清理。兩小時情境仍在原容量限制內。這是指定離線模型的非干預及效用證據，不是網站誤報率或救援成功率。

PlayerMonitor 仍是唯一候選狀態所有者；純函式只回傳下一狀態，Runtime 轉交、Recorder 投影。沒有新增欄位、計時器、依賴、持久資料或網路工作。schemaVersion 4／buffer-window-v4 保持，屬既有到期契約修復；歷史 v4 結果仍以當時來源為準。

一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻及生命週期兩次重載維持。完整套件包含位置／倍速還原、新操作、晚到 Promise、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick；既有路線、探測、親和、寫入與控制所有權不變。

## 本輪安全差異

本輪風險評估：執行期差異只有純領域到期分支撤銷既有數值狀態，沒有新增輸入、權限、資料輸出、網路、持久化或控制路徑。依既有按風險規則，不另執行 Codex Security 掃描；不把上一版掃描當成本輪安全通過。型別、架構、資料邊界及非干預由本輪自動契約覆蓋。

## 來源隔離

Codex IAB 自有 loopback 頁面載入實際 assessBufferTrend／observeBufferCycle 來源，以六十秒健康前置及固定合成時間執行四個 1／2 倍對照，全部通過；同時核對輸入未被修改。沒有接正式 GM、建立產品控制器、修改影片 getter 或注入故障。純函式沒有自有 timer／listener／subscription；分頁與服務已清理。這只證明瀏覽器中相同來源的計算，不是安裝版故障救援。

## 發布與安裝限制

v2.1.32 完整報告原文追加保存，五項 Release 按原 bytes／SHA-256 歸檔；[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_d6197de.json) 保留保護基準。本次執行期檔案不在 unchangedFiles 中，沒有解除或重算舊來源保護。

[v2.1.33 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.33) 已發布，發布提交 bbc4b27789a01eaf1f7d34a8d2fa4362c58cff30。當時遠端 main 與標籤解參照相同；唯一腳本附件與無登入憑證的公開 latest HTTP 200 全文均為 417110 bytes／SHA-256 892fb339625d4d2a241ce4387050c8d08201e224c6211844c5be5f0eaad5a761，與本機逐位元組一致。後續文件提交不移動標籤、不修改 Release 快照。

首次公開更新入口停在 Tampermonkey 中繼頁，工具沒有可操作的管理器確認頁。新載入指定影片的完整本體為 415118 bytes／SHA-256 d0286eb6ef089cb5d89432cc0fef65fa59f35cfb948e880f452f52b9a5cb548e，精確等同 v2.1.32；新版本應為 415152 bytes／SHA-256 febc3f34f91e834cf4ac05d162b754e259ddc4508a14a4362b6e83bc19de69e2。當時 v2.1.33 管理器／singleton／hooks 及 Auto 1／2 倍正常回歸均未執行、產品判定 null；原紀錄保持，不以後續結果回寫。

首次嘗試未重複要求發布或工作批准；當時後續安裝核對需要同一 IAB 的管理器實際完成更新。自有影片、更新分頁及 Debugger 已清理，沒有留下故障攔截或背景收集器。公開發布、來源驗證與文件交付已結案，安裝限制另列於 [交付 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CYCLE_RENEWAL_DELIVERY_2026-10-24.json)。

首次回補前的共同輸入仍可能產生候選；小幅回補、真正緩慢耗盡及真實網站節奏的取捨沒有被本次修復全面解決。診斷 creditMs 不能單獨解讀為候選已成立，仍須看 candidate、原因碼及資料品質。

控制中心入口依指示跳過；自然起因、安裝故障注入、背景／gate／剪貼簿、六組五十秒樣片及歷史矩陣不重開。不宣稱降低真實卡頓率，不啟用預測救援。

## 更新後的安裝版正常回歸

使用者確認完成更新後，於 2026-10-24 的新文件核對 Tampermonkey 5.5.1／v2.1.33；完整執行本體為 415152 bytes／SHA-256 febc3f34f91e834cf4ac05d162b754e259ddc4508a14a4362b6e83bc19de69e2，與已發布腳本一致，重載後再次全文比對相同。Runtime／ControlCenter 各一，Fetch／XHR installed、fetch-and-xhr-verified。Debugger 只用於身分檢查，斷點及暫停在操作與播放窗口開始前解除。

指定影片 BV1tFZZBQE57 保持 Auto，當次實際 3840×2160。1／2 倍各完成真實按鈕暫停／恢復、原生 Right 約五秒短 seek，再以單次完整 await 取得十六筆樣本、十五個一秒區段。每區段時間增加大於 0.05 秒且影格增加，倍速精確、同媒體與內容，沒有 paused／seeking／ended／error 或新可信輸入；同步媒體事件收集為零。

| 窗口 | 實際經過 ms | 影片前進秒數 | 影格增加 | 合格區段 |
| --- | ---: | ---: | ---: | ---: |
| 1 倍 | 15010.0 | 15.009813 | 900 | 15／15 |
| 2 倍 | 15007.9 | 30.015718 | 1799 | 15／15 |

兩個窗口首次即有效通過，Recovery 保持 healthy、reloadCount 為零。原二倍速已恢復；自有 timer、listener、subscription、斷點、遠端物件參照及分頁均歸零，未留下跨呼叫背景 Promise。

[安裝版逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CYCLE_RENEWAL_INSTALLED_2026-10-24.json) 保存操作前後、逐秒資料、有效性與清理結果。五個具名 node:test 重播身分、各倍速操作／進度、清理與五項 Release 原件不變條件，全部通過；這五個證據檢查不加入正式 1938 案。原中繼頁阻塞、來源隔離與更新後正常安裝分開記錄；後續僅提交文件，不改版本、標籤、附件或已發布快照。

本輪只證明正常安裝操作與這兩段連續播放；未測安裝版故障救援或真實候選效用，不將十五秒窗口補算為先前未執行的六組五十秒樣片。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.32 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2132-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊結果保持。

## v2.1.34 完整報告（2026-10-24）

# BiliCDN_TW v2.1.34 低緩衝候選驗證

日期：2026-10-24（Asia/Taipei）。基準 b4f997c／v2.1.33，執行期功能提交 a32cff3。新增唯讀低緩衝分支，補足慢下降及未補足周期漏報；不啟用提前備援，不改救援期限或狀態所有權。

## 驗證結果

先凍結來源、初始緩衝、六十秒健康前置、外部停滯標註及期待，再於未修改產品執行六十八案：二十二通過、四十六失敗，真實退出碼 1。修復後同批契約六十八案全通過，退出 0。主要二十案與獨立保留四十八案各自以 1／2 倍登記，不把多元件整合算成單元測試。

[逐案完整 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_LOW_V5_2026-10-24.json) 保存來源／情境雜湊、紅綠斷言、完整輸入／輸出、候選段、首次／最後提前量、最大空窗、十五秒後續、資料品質、操作軌跡及清理。固定輸入 SHA-256 為 9fd9fce86dc0e84736f6ae06a2acad26b5fce29c4311770ce00916690aef9e17。CLI 歷史基礎工具來源與本輪 b4f997c 比較基準分列，不重新解釋舊 candidate。

正式套件由 1938 增至 2175 案，新增 237 案；其中 tooling 410 案。功能來源完整 verify、型別、102 個執行期模組架構、格式、文件／封存、確定性建置及差異檢查通過。全新來源副本不帶既有 node_modules 或私有工作資料，npm ci、完整 verify 2175 案及低緩衝命令六十八案均退出 0。後續升版驗證另記於交付紀錄，不回寫 v2.1.33 發布時 1938 案。

初次原型曾因離線讀取器尚未接受 v5 證據而拒絕資料；另一次完整驗證的新投影斷言，錯將未發布的 reset 快照與 Recorder 上次資料比較。修正版本讀取器及只在完成發布的 tick 核對投影後，重跑固定期待全部通過；沒有放寬候選時間、正常上限或保留組。原失敗日誌保留。基準第一次在受限程序的 Git 工具情境遇權限失敗，主機環境重跑未修改產品 1938 案通過，兩次結果分開保存。

## 效用與正常對照

下表兩倍速分別取得相同結果；時間均為情境開始後的實際秒數，健康前置不計入。

| 固定耗盡情境 | 首次候選 | 提前量 | 正常配對 |
| --- | ---: | ---: | --- |
| 十二秒緩衝，每秒減少 0.1 秒 | 82 秒 | 38 秒 | 第 85 秒補回；一段、三秒候選 |
| 十二秒緩衝，每秒減少 0.2 秒 | 42 秒 | 18 秒 | 第 45 秒補回；一段、三秒候選 |
| 十二秒緩衝，每秒減少 0.249 秒 | 35 秒 | 14 秒 | 第 38 秒補回；一段、三秒候選 |
| 四秒緩衝，三秒周期補回 75% | 8 秒 | 6 秒 | 第 10 秒補回；一段、一秒候選 |
| 四秒緩衝，四秒周期補回 75% | 7 秒 | 4 秒 | 第 9 秒補回；一段、一秒候選 |

正常配對首次完整回補立即撤銷，觀察至至少 120 秒沒有再次候選。十個共同前綴契約確認耗盡／正常配對在事件分歧前逐樣本相同，產品沒有取得未來停滯標註。

獨立保留組涵蓋 4.5／5 秒、三／四秒周期與 60%／85%／95% 回補，七／十二秒的 0.125／0.175 秒慢下降，以及完整回補、兩秒抖動及不規則取樣；耗盡案至少提前三秒，完整回補及抖動無新增候選。原有一百次功能及七十二次周期情境全部有效通過：正常候選段數／總時間未增加，耗盡首次提前量未縮短、最大空窗未增加、最後候選符合原門檻。副作用、清理及情境雜湊一致。

## 行為契約與非干預

保留 v4 短期／周期結果優先；只有完整八秒有效窗口、校正緩衝不超過四秒，且持續嚴格下降或仍有有效周期欠量時，才啟動獨立低緩衝確認。首次累計為零，後續創低區間累計滿兩秒；回補、持平、未創低不顯示候選，完整補回或證據失效清除。證據類型改變不借用額度；到期與新證據同筆時先清除再從零開始。

PlayerMonitor 在既有候選狀態保存 lowConfirmation，重用樣本窗口；純函式接收明確時間及唯讀資料，Runtime 只轉交，Recorder 白名單投影。schemaVersion 5／buffer-window-v5 新增有界 lowBuffer 證據；離線工具分別接受 v1～v5。舊報告及原件不改。沒有新設定、持久欄位、依賴、網路、計時器或控制 API。

新契約涵蓋四秒與 1999／2000、7999／8000／8001、1500／1501 ms 邊界，重讀／倒退／非法值、進度／影格、證據切換、內容／核心／倍速／表示／路線／操作失效、重入與停止。診斷驗證版本／原因／證據一致、缺少證據拒絕 true、去敏、副本隔離、容量及清除。

真實 Routes／Recovery／Monitor／Runtime／Recorder 整合確認低緩衝候選不新增決策、親和、探測、SDK 或寫入。一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻與生命週期額度保持；完整既有契約涵蓋位置／倍速、新操作、晚到 Promise、兩個有效樣本 recovered、十五秒持續播放與終止後 120 tick。

兩小時、固定內容切換與傳輸旁證整合各倍速通過；新增長情境觀察到樣本最多九筆、完成旁證八筆、趨勢十五筆／7646 bytes、報告 21134 bytes，保持既有上限。既有超量、32 筆／8 KiB、Recorder 128 KiB／匯出 96 KiB 契約仍通過。所屬資源釋放後先核對 timer／subscription 歸零，再釋放 FakeClock。

## 本輪安全差異

新的 Codex Security 差異掃描 e8288ee7-8aed-4ed3-a944-8e038249ad55，固定範圍 b4f997c 至 a32cff3，已完成全部三十五個變更檔案與直接支援路徑審查，未發現可報告安全問題。使用新產生的儲存庫威脅模型與獨立交叉審查，未沿用舊版安全結果；範圍涵蓋低緩衝數值證據、診斷白名單、版本讀取、有界性及控制所有權。這是差異審查與本輪自動證據，不宣稱經過安裝版攻擊或故障測試。掃描識別及摘要另存於本輪交付證據，canonical 原件維持工具管理。

IAB 自有 loopback 隔離頁載入本輪實際純模型、診斷驗證器及評分器，六十八案通過，核對輸入不變與投影可接納；未接正式 GM，沒有產品控制操作。這不取代 Node 真實元件投影相等契約，也不是實際安裝播放證據。來源 bundle SHA-256 為 bf30cdd9ef1842d61cd7a8df6a127e6108e0ec51a568ea320bc62a622ce8abd2；自有分頁與服務均已關閉，未留下計時器、訂閱、攔截或跨呼叫背景工作。

## 發布與安裝限制

v2.1.33 完整報告原文追加，五項 Release 原始位元組歸檔；保留原封存清單快照與不可變合成證據。本輪執行期檔案沒有適用 unchangedFiles，未解除或重算舊來源保護。版本升為 v2.1.34，公開提交／標籤／唯一腳本附件與 latest 校驗待發布後另記；本快照不預先宣稱安裝版通過。

正常回補之前仍可能產生候選；共同前綴不可預知、下降後持平、突然失效與資料不足仍是限制。本輪補足指定模型的兩類漏報並維持既有成本上限，不代表量得真實網站誤報率或救援成功率。candidate 仍只供診斷，不啟用提前備援。

控制中心入口依指示跳過。自然起因、安裝版故障注入、六組五十秒樣片、背景／gate／剪貼簿及歷史矩陣均不恢復；來源隔離、正常安裝與公開發布分開記錄。

## 公開交付與當次安裝核對

[v2.1.34 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.34) 已發布，發布提交 26171960a3eb151518caf8024f197b16c6be2529。當時遠端 main 與版本標籤解參照一致；唯一 BiliCDN_TW.user.js 附件及公開 latest HTTP 200 全文均為 420404 bytes／SHA-256 504f63ffa61cce2d974ef4722344919d63ecadb5e542e362aad87948c3608392，與本機逐位元組相同。

升版完整 verify 再次 2175 案通過；735 項輸入的全新來源副本 npm ci／verify／低緩衝命令全部退出 0，輸入雜湊不變。功能階段 728 項副本與本次副本均已移除，自有證據與日誌留在本機封存。第一次升版檢查發現報告缺少歷史引用的章節錨點，恢復原 Markdown 標題後重新封裝未發布快照、完整與乾淨驗證皆通過。正式發布後不回寫 Release。

文件檢查通過；仍保留七個不可變舊失效連結、430 個歸檔後歷史網址限制、十八個私有證據引用及 343 個未連網外部連結，不能稱為全部網址均可達。封存檢查通過 399 個搬移項目、五十六份閱讀版、286 筆校驗記錄。npm ci 提示三個既有開發依賴低風險 advisory；本輪沒有升級依賴或執行強制 audit 修正，不將差異安全審查視為完整依賴稽核。

當次公開更新入口停在 Tampermonkey 中繼頁，工具未取得可操作的管理器確認頁。新載入指定影片的完整執行本體為 415152 bytes／SHA-256 febc3f34f91e834cf4ac05d162b754e259ddc4508a14a4362b6e83bc19de69e2，精確等同 v2.1.33；新版預期本體為 418446 bytes／SHA-256 74ba2f9c35de15ed939a8359227979acee4b15f2eb0abf1f8a38b222b704dd59。因此新版管理器／唯一實例／hooks、Auto 1／2 倍正常操作及十五秒播放均未執行，判定 null，不能用舊版播放或來源隔離補算。

已提出必要的管理器手動更新；沒有重複詢問發布或既有工作授權。自有影片／更新分頁及 Debugger 已關閉，沒有斷點、故障攔截或背景收集器。發布與文件交付完成，安裝正常回歸待實際更新後另記；[交付 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_LOW_V5_DELIVERY_2026-10-24.json) 保存遠端、公開下載、安全識別、清理與未執行結果。

## 使用者更新後的實際安裝正常回歸

2026-10-24 使用者確認更新後，另開指定影片 BV1tFZZBQE57，核對 Tampermonkey 5.5.1／腳本 v2.1.34；完整執行本體 418446 bytes／SHA-256 74ba2f9c35de15ed939a8359227979acee4b15f2eb0abf1f8a38b222b704dd59 與發布原件的完整 IIFE 相同。Runtime／ControlCenter 各一個，Fetch／XHR hooks 均為 installed／fetch-and-xhr-verified；診斷實際為 schemaVersion 5／buffer-window-v5。初次更新入口受阻與舊版本體紀錄保持原判定，不以本次結果覆寫。

| 實際安裝項目 | 結果 |
| --- | --- |
| Auto 1 倍 | 暫停／恢復／約五秒短 seek 通過；十五秒窗口實際 15014.2 ms，十六個樣本、十五個區段均時間增加 >0.05 秒且影格增加 |
| Auto 2 倍 | 暫停／恢復／約五秒短 seek 通過；十五秒窗口實際 15054.4 ms，十六個樣本、十五個區段均時間及影格增加 |
| 身分及品質 | 兩窗同一媒體／內容、實際倍速固定、3840 × 2160；沒有 seeking／paused／ended／error 或新輸入中斷 |
| 救援與清理 | 兩窗沒有額外救援事件或 reload，結束為 healthy／reloadCount 0；自有 timer／listener／subscription／斷點／遠端參照組／分頁全數歸零 |

原始倍速為二倍，結束保持二倍；觀察使用既有快照及唯讀數值，未修改產品欄位、getter、GM 資料或建立控制器。每窗在單次有界呼叫內完整 await，finally 釋放資源。身分校準時曾見較早 route-failure 意圖已 recovered、reloadCount 0；發生於本次有效窗口之前，保留原讀值，不據此推斷自然起因或故障救援效果。

另以五個具名 node:test 重播真實證據，五項通過、零失敗／略過／取消；獨立於正式 2175 案。發布的五個原件再次逐檔校驗不變。[安裝證據 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_LOW_V5_INSTALLED_2026-10-24.json) 保存完整樣本、操作、完整本體身分與重播結果；畫面與收集原件留在本機私有封存。文件及封存檢查、git diff --check 通過後提交結案，發布標籤與附件不改。

本次只證明正常安裝回歸；不宣稱真實低緩衝漏報率、誤報率或故障救援成功率改善。控制中心入口仍依指示跳過，六組五十秒樣片、自然起因、安裝故障注入及歷史矩陣保持未執行／停止。交付及自有資源清理結案，沒有自主續跑中的瀏覽器窗口。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.33 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2133-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。


## v2.1.35 完整報告（2026-10-24）

# BiliCDN_TW v2.1.35 候選持續性與撤銷品質驗證

日期：2026-10-24（Asia/Taipei）。固定基準 f505704／v2.1.34，功能提交 5c5f982。新增每份有效部分周期證據最多一次的尾段補顯，僅供診斷；救援期限、動作額度與狀態所有權保持。

## 驗證結果

在未修改產品上先執行新整合契約：132 案中 110 通過、22 真實失敗，退出碼 1；另有純領域紅色契約 70 案中 38 通過、32 失敗。固定正常撤銷對照通過，沒有把十三秒累計候選誤寫成持平後殘留。修復後原批契約轉綠，擴充正式套件由 2175 增至 2595 案，新增 420 案；tooling 434 案。新增多元件案例明列整合，不算單元測試。

[完整逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CONTINUITY_V6_2026-10-24.json) 保存基準與來源／情境雜湊、132 案紅色斷言與綠色完整輸入／輸出、240 案既有指標比較、候選段、十五秒後續、覆蓋品質、操作與清理。紅色完整原始輸出另留私有封存，公開記錄其 bytes／SHA-256 及全部逐案斷言。固定輸入雜湊為 586fef8f888dd53b7fa1def6745617356bf7c772e88f1505a66bcc02f3d9fa09。

功能階段完整 verify 2595 案、格式、型別、102 個執行期模組架構、文件／封存、確定性建置、語法及差異檢查通過。746 項輸入的乾淨來源副本未攜帶 node_modules、Git 或私有工作資料；npm ci、完整 verify 與 continuity 132 次執行均退出 0，輸入雜湊不變，暫存副本已清除。升版及公開交付結果另追加，不改寫 v2.1.34 發布時 2175 案。

升版後完整 verify 2595 案通過。最終 753 項輸入的乾淨來源 npm ci、完整 verify 及 continuity 132 次執行均退出 0，來源雜湊保持且暫存副本清除。首輪乾淨發布驗證因新公開 JSON 受既有忽略規則排除而失敗；精確加入該份合成證據後另開副本重跑，保留首輪失敗，不調整產品或斷言。

基準第一次完整驗證在受限程序遇六個 Git 暫存情境權限失敗；其餘產品案例通過，主機環境獨立重跑原 tooling 410 案通過，不能把第一次完整執行算成成功。開發中修正了指標測試的 owner/state 前提與 1500 ms 測試的同步時間戳；未調整固定候選時間、正常成本或停止門檻。原日誌保留。npm ci 回報三項既有低風險開發依賴 advisory，本輪不升級依賴或強制 audit 修正。

## 效用與撤銷品質

所有固定情境各自使用初始緩衝完成六十秒健康前置，1／2 倍分案。五組主要耗盡配對結果一致：

| 初始校正緩衝／四秒周期回補 | 耗盡 | v5 最後候選 | v6 最後候選 |
| --- | ---: | ---: | ---: |
| 4 秒／75% | 11 秒 | 7 秒 | 10 秒 |
| 4.5 秒／85% | 19 秒 | 15 秒 | 18 秒 |
| 4.5 秒／95% | 43 秒 | 39 秒 | 42 秒 |
| 5 秒／85% | 23 秒 | 19 秒 | 22 秒 |
| 5 秒／95% | 59 秒 | 55 秒 | 58 秒 |

首次提前量保持至少三秒；最後候選距耗盡四秒縮為一秒，末端 false 區間三秒縮為零。這兩個指標分開計算。新增正常配對在原耗盡時刻完整補回，最多新增一段、一秒候選；第一個有效回補樣本撤銷，後續沒有追加。64 個共同前綴契約核對耗盡／正常配對分歧前逐樣本相同。

新模式共 132 次版本執行，包含五組主要配對、4.25／4.75／5.25 秒 × 三／四／五秒周期 × 65%／90%／97.5% 回補配對、持平與微降反例，各兩倍速。矩陣曾參與唯讀評估，標為固定評估組，不冒稱未見過的保留組。微降反例只新增一個樣本；原無限補顯多出的六秒未出現。十二秒緩衝每秒下降 0.5 秒至三秒後持平，總候選維持十三秒，持平後殘留零。

原有 100 次功能、72 次周期、68 次低緩衝全部有效通過。逐項與 v5 比較：正常段數與總時間沒有增加，耗盡首次提前量未縮短、最大有效空窗及末端指標未退步；輸入雜湊與操作軌跡一致。只有上述五組耗盡、各兩倍速新增尾段訊號。

指標區分累計候選、首次／最後提前量、全程有效間隔、最後十五秒覆蓋、末端 false、缺資料及首次候選前／截尾後區段。null、空隙與所有者更換不拼接；跨截尾且沒有新候選時，末端及最後訊號未判定。撤銷從第一個有效可觀察持平／回補樣本起算。不規則取樣按實際毫秒，最多補顯一個有效區間；沒有獨立計時器，因此不宣稱牆鐘一秒撤銷保證。

## 行為契約與非干預

v5 true 與原原因優先且不消耗機會。只有 v5 false、完整八秒有效窗口、0 < 校正緩衝 ≤1 秒、前後同一已確認 2000 ms 的 partial-cycle 證據、最近至少 2000 ms 嚴格合格下降且未使用時才補顯。tailUsed 在原低緩衝證據保存；部分回補、持平、新低點與原 true 不重發。實際撤銷／重建才可重新從零確認；重讀不消耗或延長，不一致狀態撤銷。

PlayerMonitor 仍是唯一窗口與確認狀態所有者，純領域函式只回傳事實／下一狀態。Runtime 轉交，Recorder 驗證、複製、保存；清除診斷不重設 Monitor 或救援。schemaVersion 6／buffer-window-v6 僅新增白名單布林及兩個尾段原因碼，歷史 v1～v5 分版讀取，不重新解釋 candidate。沒有新設定、持久欄位、依賴、網路、訂閱或計時器。

正式契約涵蓋零／一秒、1999／2000、7999／8000／8001、1500／1501 ms，重讀／倒退／非法值、影格／時間進度、證據生命週期、內容／核心／表示／路線／倍速／控制修訂、同步重入及停止。診斷核對證據與原因一致、未知欄位不外洩、副本隔離、清除及容量。真實 Routes／Recovery／Monitor／Runtime／Recorder 整合確認候選不新增決策、事件、親和、探測、SDK 或儲存寫入；清除報告後已使用證據仍不能補顯。

一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻及生命週期兩次重載維持。完整原有契約保留位置／倍速、新操作、晚到 Promise、兩個有效樣本 recovered、十五秒持續播放及終止後 120 tick。

兩小時固定內容切換及完成旁證各倍速通過；觀察到樣本最多九筆、完成旁證八筆、趨勢十五筆／7609 bytes、報告 21466 bytes。32／128 筆、趨勢 32 筆／8 KiB、Recorder 128 KiB／匯出 96 KiB 上限及超量契約通過。所屬資源先釋放並核對 timer／subscription 歸零，再釋放 FakeClock。

## 本輪安全差異

Codex Security 新掃描 fe9dc246-ac41-4b03-a0bb-6fe3e9e59f16，固定 f505704 至 5c5f982，完成三十個變更來源及五個指南／資料檔審查。新威脅模型經獨立架構核對，產品與工具另行交叉審查，未發現可報告安全問題；未沿用舊版結論。保留診斷與控制權分離、任意 Proxy 非通用隔離邊界及瀏覽器收集器不同輸出契約的限制，不宣稱全庫／依賴稽核或安裝攻擊測試通過。canonical 報告維持工具管理；交付記錄保存識別與範圍。

工具 token 彙整為 8,679,803（含大量既有對話快取；coverage=partial、missingThreadCount=10），不是可獨立歸因本次掃描的淨用量。

## 發布與安裝限制

前版完整報告原文追加保存，五項 Release 依原始 bytes／SHA-256 歸檔；舊封存清單已保存，本輪變更來源沒有適用 unchangedFiles 保護，未用更新原始雜湊掩蓋修改。v2.1.35 自動、安全及離線效用已通過；公開發布與實際安裝結果分開追加，未執行項目不算通過。

IAB 自有 loopback 來源隔離 132 次執行通過，使用實際純領域模組與診斷投影、同一凍結輸入及 v5 原證據，核對尾段、正常成本、第一筆持平／回補撤銷、輸入不可變及額外敏感欄位排除。bundle SHA-256 為 d22e01d57422d14a5d8a6cd4babd772af186d507575d9eb1c58863ee7b0b9326。未接 GM，產品計時器、監聽器、訂閱、儲存寫入及網路工作均為零；結果回傳後自有分頁與來源服務已釋放。此層只證明瀏覽器中來源計算及投影，不代替完整安裝版。

candidate 仍只供診斷，不啟用提前備援。正常共同前綴不可預知、候選間斷、突然失效與缺資料仍為限制；本輪只證明指定模型的最後訊號與正常成本取捨，不代表全程連續或真實網站救援成功率改善。

控制中心入口依指示跳過。自然起因、安裝版故障注入、六組五十秒樣片、背景／gate／剪貼簿及歷史矩陣均不恢復。

### 公開交付與安裝結案

發布提交 48f82c4，遠端 main 與 v2.1.35 標籤於發布時一致；唯一附件及公開 latest 均為 422,022 bytes、SHA-256 7458f27610a0b2a9f13e07c1e087502198809dacb2a411f5112acf9aaf3b9cc3，完整下載逐位元組相同。[交付與安裝 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CONTINUITY_V6_DELIVERY_2026-10-24.json) 保存來源隔離、乾淨驗證、初次更新阻塞及使用者確認後的正常回歸。

第一次公開入口停在 Tampermonkey 中繼頁，工具沒有管理器確認頁；新影片本體仍精確等同 v2.1.34，當次新版回歸未執行。使用者回覆已更新後，另開新文件核對完整 v2.1.35 執行本體 420,064 bytes、SHA-256 582353e62546a90a7bf6632dde7fb290b17eacbeb9f13967579aadb252a2da1a，重載後再核對相同；Tampermonkey 5.5.1、Runtime／ControlCenter 各一，Fetch／XHR hooks 正常，診斷為 schema 6／buffer-window-v6。

指定影片 Auto 實際 3840×2160，1／2 倍各一次暫停／恢復及可信鍵盤方向鍵短 seek 五秒，再完整 await 十五秒。兩窗各十六筆樣本、十五個連續區段，時間增加 >0.05 秒、影格增加，媒體／內容／控制身分與倍速一致；沒有等待、停滯、錯誤、新輸入或重載，Recovery 最終 healthy、reloadCount=0。原二倍速保持，自有 timer／listener／subscription、斷點、偵錯器參照與分頁歸零。五個具名 node:test 重播身分、各倍速操作／進度、清理及五個發布原件全部通過；這是證據重播，正式數仍為 2595。

本輪安裝正常回歸結案；未在安裝版製造耗盡或故障，不用上述正常播放補算尾段候選實際故障救援。發布快照維持封裝時原件，之後只提交文件及新證據，不改標籤或附件。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.34 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2134-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。

## v2.1.36 完整報告：2026-10-30

以下保存 v2.1.37 換版前的最新版完整正文；原日期、版本、未執行與歷史限制均保留。

# BiliCDN_TW v2.1.36 救援還原閉環與原生寫入所有權驗證

日期：2026-10-25（Asia/Taipei）。基準 20ba3b2／v2.1.35，最終執行期來源 c0bd053，接續檢查點 6b8d4c3。完整紅綠及效益紀錄見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/RESTORE_VERIFICATION_2026-10-25.md)，本頁保存本版完整驗證與交付結果。

## 驗證結果

SDK getter／呼叫期間的新操作撤銷舊原生備援。還原依序核對原生位置與 seeking、原生倍速，再 play 與兩個合格原生進度樣本；SDK 返回、Promise 完成或快取不能冒充成功。命令滿一秒、非 pending／seeking、原生值明確不符且仍有所有權，才允許位置與倍速各一次補正；與既有備援共用額度，失敗不重試。play 前另取原生進度基準，等待期間不算播放時間。

新增 117 案（61 單元、56 多元件整合），最終完整與乾淨 c0bd053 來源各 2842 案通過，tooling 564 案；零失敗、略過、待實作或取消。另含公開 JSON 的乾淨 staged tree b9f6358d5c95d2104e5915934349836a41647af0 亦 2842 案通過，792 個公開輸入雜湊保持。上述已通過證據沿用，沒有重跑已完成瀏覽器窗口。本版另外完成 typecheck、architecture、npm test 及 verify，完整各 2842 案通過；verify 的格式、文件／封存、可重現建置、語法、v2 標記與封裝校驗皆退出 0。

## 行為契約與非干預

真正 Observer／Adapter／Recovery 的正常與忽略 seek／rate／both 各 1／2 倍確認保存目標、補正次數、十五秒連續播放與清理。加入真正 Monitor／Runtime／Routes 的 978 秒目標在六個既有 tick 內 recovered；原生失敗保留原十五秒期限，終止後 120 tick 不重試。這些是合成整合情境，不是網站成功率或延遲量測。

候選 v6、一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻與生命週期額度維持。沒有提前備援、產品新計時器／請求／設定／持久欄位／依賴。

## 本輪安全差異

沿用已完成的最終 Codex Security 掃描 1f186e41-b2b2-43b7-ac8d-bed33e5976cb，固定 20ba3b2→c0bd053，28 個面向完整覆蓋，無可報告發現。本次執行期來源逐檔無差異，沒有將初版只到 0c39818 的掃描替代最終範圍；canonical 報告仍由 Codex Security 管理。版本／文件與自有來源工具變更不擴張產品安全範圍，靜態審查不等於安裝攻擊驗證。

## IAB 來源隔離

本次新對話的 Page.getResourceTree、Runtime.evaluate 與事件讀取正常，沒有修改權限檔或沿用舊拒絕作結論。正常、忽略 seek、忽略倍速、同時忽略、延遲 SDK 與新可信操作各 1／2 倍，十二案 VALID＋PASS；另十三個具名證據重播通過。完整原生樣本、命令順序及逐案清理見 [來源證據 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/RESTORE_SOURCE_2026-10-25.json)。

正常一倍沿用凍結 bundle 7df49fbbdec6ec10080515e482c9d4d7394e944a505e55e8fc86f97cfa2e6d9a；其餘十一案使用修正錯速前提的工具 bundle 9edb372512f86589013db792cad655b8906910e5131448b34a1b72132f30650a（90802 bytes），完整載入本體已核對。修正只處理自有合成 SDK 的 load 重設倍速，正式產品保持 c0bd053。原正常一倍沒有重跑；正常二倍主機收集器參照問題以頁內未截斷完整緩衝從零游標回收，沒有拼接或補跑。

前十案核對原還原意圖 recovered、正確位置／倍速、兩個合格樣本及至少十五秒逐秒時間／影格進度；正常與延遲無補正，忽略項按需各一次且等待至少一秒。新可信操作兩案均撤銷舊意圖，保留暫停及新倍速，後續至少十六秒無 setRate、play 或補正。所有案例只有一次重載，清理確認 timer／timeout／listener／controller 歸零、SDK 方法還原及媒體來源釋放；分頁及服務已關閉，埠無監聽，事件無例外／截斷。

早先 invalid 片段、舊對話 CDP 拒絕與錯誤設定指引原文保留，沒有改寫為通過。本層使用真正 HTMLVideoElement 與原生媒體事實，但 SDK、可見性及監控節拍為自有模型，不代替 Tampermonkey 安裝版或網站故障救援。原十二個五分鐘窗口、自然起因及歷史矩陣保持停止。

## 發布與安裝限制

v2.1.35 完整正文已原文追加保存，五項原始封裝逐位元組歸檔；不回寫舊 Release。v2.1.36 必要自動、安全與來源門檻已通過；確定性完整腳本為 439664 bytes、SHA-256 3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7，封裝五項原件與校驗清單一致。公開交付、latest 校驗與更新後安裝正常回歸已完成，結果見下一節；[封裝當時的報告快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/v2.1.36/Release/v2.1.36/TEST_REPORT_v2.1.36.md) 保留原先尚未執行的時間點，不回寫為發布後結果。控制中心入口依既有決定跳過，不恢復網站故障注入、背景、gate、剪貼簿或歷史矩陣。

### 公開交付與安裝結案

發布提交 110574f；發布時遠端 main 與 v2.1.36 標籤一致。正式 GitHub Release 僅有 BiliCDN_TW.user.js，版本附件與公開 latest 下載皆為 439664 bytes、SHA-256 3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7，與本機完整腳本逐位元組相同。[交付與安裝 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/RESTORE_DELIVERY_2026-10-25.json) 保存公開校驗、初次更新限制、使用者確認後的身分及完整正常回歸資料。

首次公開更新入口停在 Tampermonkey 中繼頁，指定影片實際仍精確包含 v2.1.35 完整本體，當時新版回歸未執行；原紀錄保留。使用者確認更新至 v2.1.36 後，另開新文件核對完整執行本體 437706 bytes、SHA-256 07dae8cec5ba86429093863f2a34bc5a2e3ddc9e00e7618127cf8b4ad9b6a4d3，重載後同樣完整相符。實際 Tampermonkey 5.5.1，Runtime／ControlCenter 各一，Fetch／XHR hooks 均 installed，設定未停用。

指定影片保持 Auto，實際 3840×2160；1／2 倍各完成可信暫停／恢復與方向鍵約五秒短 seek，再於 seeking 結束後完整觀察十五秒。每窗十六筆連續樣本，十五個區段均有時間及影格前進，倍速、媒體／核心與操作身分一致；沒有 waiting／stalled／seeking／pause／error／ended 事件，Recovery 始終 healthy、reloadCount=0。原二倍速保持；自有 timer／listener／subscription、斷點、偵錯物件群組及分頁已釋放。五個具名安裝證據重播通過，另核對五項發布原件保持，獨立於正式 2842 案與來源十三個重播。

本輪公開交付與安裝正常回歸結案；不把正常播放轉算為網站故障救援成功率。來源工具、原始證據、畫面及主機日誌收入本機私有封存；發布標籤、附件及五項封裝原件保持不變，後續只提交現行文件與新證據。

### 文件與封存檢查邊界

2026-10-25 後續另行授權調查：使用者確認將工作區根目錄權限套用到子資料夾後，普通權限正式本機封存驗證退出 0，10351 檔、69 份校驗清單／323 筆通過。原九十個 EPERM 與當時非零結果保留；九十檔仍符合原 bytes／SHA-256，原私有清單不變。修復動作與完整歸因限制見 [工具紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md#2026-10-25舊私有封存-eperm-調查與本機驗證)。這是後續環境驗證，不回寫發布快照或增加產品／瀏覽器案例。

以下段落保存上述權限修復前的發布結案檢查點；當時的本機封存限制已由後續結果解除，其他歷史／私有引用與外部連結限制仍依各自範圍保留。

結案 docs:check、公開 archive:check 與 git diff --check 通過，原三份日誌及還原報告的完整既有正文前綴保持。因本輪工具資料歸檔，另執行 archive:check -- --local：退出 1，既有 2026-10-20-cleanup 的 md-bold-audit/vendor 有九十個檔案因 EPERM 無法開啟；本機檢查報告列 10261 個檔案，不能宣稱完整私有封存驗證通過。本輪來源與安裝證據另有逐檔雜湊及重播，未修改舊私有檔案、權限或原清單以消除錯誤。七個不可變舊失效連結、430 個搬移後原址限制、十八個私有引用未核對及外部未連網連結仍分列。

本次文件狀態核對只檢查指南與既有證據的一致性，沒有重跑本節產品或瀏覽器案例。結果見 [文件維護紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-25文件狀態全面核對)。

## IR36 安裝版救援獨立結果

2026-10-25 另依使用者授權，以 9f8f435／v2.1.36、IAB＋Tampermonkey、指定影片 P1／Auto 執行八案固定範圍。結果為三案 INVALID、五案未執行，沒有 VALID＋PASS／FAIL，未施加有效網站故障或確認產品缺陷。loopback 校準與保留文件的完整本體／singleton／hooks 核對不能替代網站可信尋位；兩種進度區定位都超時後停止共用方法。完整前提、逐案時序、期限偏差與去敏 JSON 見 [本輪報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/INSTALLED_RESTORE_IR36_2026-10-25.md)。

S2 從主機啟動至收束 503.344 秒，超過五分鐘且事件截斷，維持無效；S1 第二次收集器參照遺失，缺受控 ID 尾端持久化稽核，C01 也為 INVALID。最終分頁／攔截／持有請求／自有服務退出、原倍速 2 與 IAB 隱藏狀態還原，但不據此補判完整清理通過。正常播放／Replay 改變的網站續播位置未聲稱還原。21 個輔助工具／證據重播通過，獨立於正式產品測試與原有來源、正常安裝回歸；本輪沒有執行期修改、升版或 Release，全部既有來源隔離及正常回歸證據與限制仍按原範圍保留。

### IR36 第二輪工具修正與原八案

2026-10-25 依另行授權完成可信尋位、文件內 registry、固定截止及受控尾端抑制工具修正，無 GM／登入資料的 loopback 校準後，維持原八案、指定影片 P1、既有 Auto 偏好及 1／2 倍。共十一次嘗試，八案全部 INVALID、C01 INVALID；沒有 VALID＋PASS／FAIL 或確認產品缺陷。B2 有一次合法重載，但原生倍速已等於保存值，不能忽略命令造出不符；其他相關窗口未見合法重載。U 未取得受控 SDK pending，條件式暫停／改速未執行。逐案前提、完整時序、原始失敗與校準限制見 [R2 報告與 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/INSTALLED_RESTORE_IR36_R2_2026-10-25.md)。

R2 首次的舊強制清理在一筆受控請求未完成時解除抑制，無法補證晚到提交未進學習；C01 不因最後資源退出而轉 PASS。後續工具已校準保留抑制直到文件卸載，但不回填早期缺口。所有自有分頁、攔截、服務與偵錯資源退出，原二倍與 IAB 顯示狀態還原；本輪含等待上界約七十九分鐘，各次嘗試／清理在原期限內，未恢復歷史矩陣。逐案 Auto 標籤、originalComparison 及部分精確十秒前置證據不足亦保留，不宣稱全範圍通過。

本輪定向工具二十八案，結案前再補 SDK pending／Recovery 尾端契約；最終正式完整 2883 案（tooling 599）通過，另完成型別與架構檢查。補充工具只做 Node 驗證，沒有新瀏覽器窗口。兩段不可變 Codex Security 工具差異審查無可報告發現；必要檢查與精確範圍見 [工具日誌](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md)。產品來源／版本／Release 未變，沒有自動修復、升版或發布。以上獨立於既有來源隔離與安裝正常回歸，原證據及全部限制保留。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.35 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2135-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。
