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

## v2.1.37 完整報告（2026-10-30）

以下保留發布當時全文；2026-10-30 後續使用者將 v2.1.37 與下一版定位為測試版，現行結果由 TEST_REPORT 維護，原判定不回寫。

# BiliCDN_TW v2.1.37 上游 v1.4.1 改進吸收驗證

日期：2026-10-30（Asia/Taipei）。基準產品 v2.1.36／21322e2，A 候選 be8dc3e，後續正式子集移除未取得資格的三台香港候選。完整採用決策由 [本輪紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/UPSTREAM_V1_4_1_ADOPTION_2026-10-30.md) 追溯；本頁保存正式版本驗證及交付結果。

## 驗證結果

已完成 OGV 正片 playview 入口、Catalog-only 起播合格候選提早收束、有可靠大小的健康中段探測、實測足夠備援的家族排序，以及控制中心有界摘要。正式 Catalog 維持 11 台／4 台預設不可用，三台香港候選未取得實機門檻，排除於正式清單。

正式 HK 排除先以 UP141-ROUTE 取得 7 pass／2 fail 紅燈，再修改來源取得 9／9 通過。最終 v2.1.37 來源已在指定 Node 26.8.1／npm 11.19.0 下完成 verify：完整 2939 案通過，零失敗、略過、待實作或取消；型別、架構、格式、文件／封存、決定性建置、語法與封裝校驗均通過。普通沙箱的 tooling 暫存 Git 寫入失敗，改用正常權限重跑後通過；沒有改動期待或將權限失敗當成產品缺陷。

正式子集準備檢查：typecheck、104 個 runtime 模組的 architecture、format:check 通過；docs:check 通過 232 個 Markdown／2261 本機與儲存庫連結，archive:check 通過 414 搬移檔、三份只追加日誌、137 不變檔及 63 份 checksum／294 筆。七個不可變舊失效、430 個歷史原址限制、十八個私有引用未核對及 371 個外部未連網引用仍分列。普通 sandbox 的完整 npm test 退出 1，tooling 建立暫存 Git 儲存庫時無法寫入 .git/config；該次不能算全套通過，須以正常授權的可寫暫存環境完成最終驗證。

## 行為契約與非干預

起播維持每分頁一次、最多三候選、三秒共用期限。Catalog-only 首個安全吞吐達需求 1.35 倍的候選可提早釋放，快取候選須收滿 16 KiB；結果封存後晚到完成不新增學習或再次提交。固定慢尾端模型在 500 ms 釋放，相對原三秒等待減少 2500 ms；這是離線模型，未量測網站起播效益。

健康量測仍維持十分鐘跨分頁冷卻、最多三個依序候選、每候選三秒。中段只使用當前 Vault 來源 handle 的可靠大小，同輪共用範圍、跳過首 1 MiB、64 KiB 對齊；未知大小及起播／Native 從零開始。416 只撤銷大小，不加探測或播放斷路。主機家族只作有足夠證據路線間的排序，不保證物理機房隔離。

OGV pre/check/drm 原文通行，不改 Vault／epoch；API 入口、Fetch 單一讀取器及 XHR text／json／重用語意由契約核對。影片／音訊、原線對照、停用、Native 授權及禁止規則維持。一般 6／12／15、長 seek 15／30／15、核心恢復所有權及 bufferTrend v6 不變。

慢請求提前重試仍屬獨立原型；本版沒有其控制器、設定開關、timeout 控制或額外補送請求。未通過原生相容性、受控效用及自然故障完整門檻前，不納入正式版。

B 原型來源固定為 3cadfd8633fabbaa4dbe20226e2d1b87714edc8c，位於 [獨立分支](https://github.com/YUIAOI7592/BiliCDN_TW/tree/codex/upstream-141-early-retry)。原型完整測試 2977 案通過，但獨立 held-out 效用為 VALID／FAIL、退出 1：持續慢速可改善，正常突發恢復在 1／2 倍各產生不必要的 100,000 bytes 重下。原型與 [固定效用證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/codex/upstream-141-early-retry/archive/retired/docs/evidence/UPSTREAM_V1_4_1_EARLY_RETRY_EFFICACY_2026-10-30.json) 保留供重現，沒有調整期待或啟用正式控制。

## 本輪安全差異

Codex Security 掃描 e7524c92-b87d-4130-bef1-e780815fd314 已完成，固定 A 候選範圍三十個審查項全數覆蓋，無可報告發現；canonical 報告由 Codex Security 工作台管理。該掃描沒有覆蓋未合入正式版的 B 原型，也不冒充最終 HK 排除後的相同來源雜湊。另已逐行核對 be8dc3e 到正式子集的執行期差異：只移除 Catalog 與家族表中的三台 HK，沒有其他執行期改動或擴張權限；對應拒絕契約及完整 verify 通過。安全審查獨立於 npm run verify，不表示已完成安裝攻擊驗證。

B 另以 bab220b7-b1a7-409a-b11d-0de94e0955c1 審查固定 613632f..3cadfd8 的全部 26 項差異，無可報告發現。其來源安全結論不改變效用 FAIL、原型預設關閉或未採用狀態，也不補算延後的原生／安裝驗收。

B 的文件／封存重現補充另存 2a5851761d5a066cd3b54cb447b9da546a23187e，與安全掃描的 src-v2／tests-v2／scripts 共 301 個檔案完全相同；其完整 verify 亦 2977 案通過。效用退出 1 的獨立命令沒有納入 verify 改寫期待，仍保持失敗與不採用。

## 來源隔離與安裝結果

使用者於本輪明確要求暫緩 IAB／Tampermonkey 測試，先完成全部實作與必要自動／安全驗證再統一 Release。原計畫的 OGV 自然換集、起播對照、香港供片、提前重試自然窗口及安裝回歸均未執行，不填 PASS／FAIL，也不沿用 v2.1.36 的實機結果作為本版證據。此前已停止的 IR36、P01／P02 及其他歷史矩陣維持停止。

這次正式交付採用 A 的來源改進，實際網站效益及安裝相容性仍未驗證；香港候選與 B 控制能力維持原門檻，未因暫緩測試而啟用。

## 發布與安裝限制

v2.1.36 最新完整報告原文追加至歷史彙編，五項 Release 原件按原始位元組封存；已發布標籤與附件不回寫。v2.1.37 本機封裝使用已通過決定性驗證的完整腳本：451,802 bytes，SHA-256 1293587c8bd0c5133289a981feccc3ffa6c28297da06e4d6d9570d3895222ac4。這是本機產物身分，公開交付另須核對 main、標籤、唯一附件及 latest；不以本機封裝冒充遠端發布。

### 公開交付與安裝結案

2026-10-30 已完成 [正式 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.37)。版本標籤解參照與發布時遠端 main 均為 624029dbaad2dc4418b43cd18da7d66b89bc83ca；唯一附件為 BiliCDN_TW.user.js，451,802 bytes。GitHub API digest 與直接下載的公開 latest 本體均為上述 SHA-256，版本標頭為 2.1.37；全部 74 個建置輸入亦與資訊清單一致。B 分支已推送至 2a5851761d5a066cd3b54cb447b9da546a23187e，沒有作為正式腳本附件發布。

後續 main 的本次交付紀錄提交僅修改文件，不移動版本標籤、不重寫 Release 快照或腳本附件。IAB／Tampermonkey 依使用者要求暫緩，沒有本版完整執行本體、singleton、hooks 或正常播放回歸證據。公開附件核對與安裝驗收分別記錄，不能以正式 Release 推論安裝通過；沒有安排自主補測。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.36 最新完整報告原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2136-完整報告2026-10-30)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。

## 隔離 B 分支原型驗證（2026-10-30）

執行期固定提交 3cadfd8633fabbaa4dbe20226e2d1b87714edc8c，基底為 613632fc33dd493a951a6b9942a870755ceab530。只在 `codex/upstream-141-early-retry` 保存，schema 2 的 earlyRetryEnabled 預設及缺值均為 false；沒有 B 正式 Release。固定設計、程式及結果見 [原型紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/codex/upstream-141-early-retry/archive/retired/docs/UPSTREAM_V1_4_1_EARLY_RETRY_PROTOTYPE_2026-10-30.md)，效用原始輸出見 [受保護 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/codex/upstream-141-early-retry/archive/retired/docs/evidence/UPSTREAM_V1_4_1_EARLY_RETRY_EFFICACY_2026-10-30.json)。分支連結描述未發布原型，不表示已推送或附件存在。

Node 26.8.1／npm 11.19.0 下，完整 npm test 2977 案通過，零失敗、略過、待實作或取消；其中 UP141-RETRY 應用契約 37 案、可信 UI 1 案。typecheck、110 模組 architecture、format:check、git diff --check、建置及 JavaScript 語法檢查通過。完整腳本 SHA-256 為 84da0795b7a3f896960960d82a976ac13d7b6f95f763856253f5f1373105b173；只屬未發布 B 原型，不能當作正式 A 附件。原型程式提交時的封存配置仍保護部分舊來源，後續只移除本次合法修改的十筆 unchangedFiles，先保存原配置 raw 快照。

補齊文件及封存後，完整 npm run verify 實際退出 0：2977 案、型別、110 模組架構、唯讀格式、文件、公開封存、兩次決定性建置、語法、v2-only 標記及暫存封裝校驗通過。使用一般使用者的正常可寫權限執行，沒有改工具設定、期待或隔離規則。沒有產生 B 的 Release 目錄，verify 僅使用自有暫存封裝並完成清理。最後補充另重跑 docs:check，通過 233 個 Markdown／2283 本機及儲存庫連結；archive:check 通過 414 搬移檔、三份完整前綴日誌、127 不變檔與 63 份 checksum／294 筆。七個舊不可變失效、430 歷史原址、十八個私有引用未核對及 375 外部未連網引用分列；git diff --check 通過。

獨立效用命令實際退出 1，valid=true、passed=false。兩個持續慢速模型分別減少 14000／16000 ms 停頓；兩個正常突發回補模型在 1／2 倍各發生一次不必要的 100000 bytes 重下。正常非干預門檻未通過，不降低期待、不啟用正式預設。政策 SHA-256 04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37，固定輸入 SHA-256 9130e0dd4af45496cbbd23dab07737060449b3b94629dfb33d0c986ffd740763。

B 的 Codex Security 掃描 bab220b7-b1a7-409a-b11d-0de94e0955c1 已完成，固定 613632f→3cadfd8 的二十六個審查項全數覆蓋，無可報告發現；canonical 報告由 Codex Security 工作台保管。文件／封存補充未改動該固定執行期、測試或工具來源。安全掃描不授予採用資格；有效效用失敗仍保留。原生瀏覽器相容、安裝受控故障及自然對照全部依使用者指示延後，未執行；Node 原生替身只作模型契約。維持既有停止矩陣，沒有 B 採用、自然故障改善率或安裝通過宣稱。

## v2.1.38 完整正文保存（2026-10-31）

以下為第二階段改版前的完整正文，含當版實機與永久禁令討論後的補充；不回寫原觀察。

# BiliCDN_TW v2.1.38 UP141 完整測試版驗證

日期：2026-10-30（Asia/Taipei）。本版定位為**測試版／實機待驗證**；v2.1.37 亦依使用者更正為測試定位。基準 main c3081113f1657a93c48e4df4a342811d19f76671，整合來源 273f8c3f29458221cca4dd898297389389324ae5，最終來源 4bcc29dc706778259befda3fb3e16cab39f6d3f8；B 固定來源 3cadfd8633fabbaa4dbe20226e2d1b87714edc8c，原分支、歷史 FAIL 及安全報告保持。正式採用方案留待實機結果。

## 功能與預設

| 能力 | 測試版狀態 |
| --- | --- |
| OGV 正片 playview | 包含、開啟；pre/check/drm 僅診斷，原文通行、不改 Vault／epoch |
| 起播提前放行 | 包含、預設開啟；獨立開關關閉後等全部候選或原三秒期限 |
| 健康中段探測 | 包含、預設開啟；獨立開關可對照首段，可靠大小驗證保持 |
| 備援家族分散 | 包含、預設開啟；獨立開關恢復原排序，最多五個及合法性不變 |
| 三台 HK | 全部包含、個別預設關閉；原四台預設不可用不變；Catalog 合計 14 台／7 台預設關閉 |
| 指定 HK 驗證 | 可信按鈕可安排已啟用主機；共用十分鐘跨分頁鎖、最多三台、每台三秒，不改親和 |
| 提前重試原型 | 完整包含、預設關閉；原生 timeout、網站自行重試、兩秒許可及原資格／額度保持 |
| 診斷 | 測試身分、有效設定、候選／探測狀態、提前重試階段及原因均可匯出；新事件最多十六筆 |

操作入口、如何確認生效、取證及清理集中於 [測試操作表](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/UP141_TEST_RELEASE_2026-10-30.md)。schema 2 缺值 A=true、B=false；明確 false 保留，關閉在儲存等待前抑制新動作。切換不取消網站請求、不重開起播或冷卻、不重設恢復期限。固定 CDN 勾選不能解除禁止，測試按鈕不接受任意 URL。

## 自動驗證

執行期變更先以具名契約重現。原 B 匯入 RED／37 案綠燈、HK 清單與開關 RED、timeout 觀察 RED、定向探測失敗／來源撤銷 RED 均保留本機工作日誌。新契約覆蓋設定鎖及遠端變更、冷卻／重複安排、白名單、禁止、晚到提交、首段對照、UI 可信輸入、診斷去敏／容量及 Runtime 訂閱清理；B 原生 setter 品牌、轉換、相同值、重入、重用、許可及正常流量契約保持。

指定 Node 26.8.1／npm 11.19.0 下，typecheck、architecture（111 個 runtime 模組，無循環）、完整 npm test 及 npm run verify 均通過 **2,999 案**，零失敗／取消／略過／待實作；verify 包含格式、文件、封存、決定性建置、語法及暫存封裝校驗。最後三項紅色契約重現探測取消後等待證據儲存鎖的晚到提交，修復後以固定 4bcc29d 重新跑完完整測試及 verify。完整測試使用可寫自有暫存 Git 的正常授權環境，未改測試期待。git diff --check 與已暫存差異檢查通過。

文件準備檢查通過 235 Markdown／2,343 本機及儲存庫連結；封存通過 419 搬移檔、三份只追加日誌、124 個適用不變檔、64 份 checksum／298 筆。七個不可變舊失效、430 個歷史原址限制、十八個私有引用未核對及 386 個外部未連網引用照實分列；這不是外部連結可用性證明。封裝後新增保護清單另行核對。獨立效用命令與安全掃描分開，不列為 verify 內的預期失敗。

## 獨立效用與已知限制

`npm run evaluate:early-retry -- --json` 重跑結果為 **VALID／FAIL，退出碼 1**。固定六案：持續慢速 1／2 倍改善停頓 14,000／16,000 ms；健康緩衝及近完成不介入；正常突發回補 1／2 倍各有不必要的 100,000 bytes 重下載。沒有修改輸入、門檻或期待；此結果允許交付預設關閉原型，不能支持正式採用或預設開啟。

本次原始 JSON 保存為 [UP141 測試版效用證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/UP141_TEST_EFFICACY_2026-10-30.json)。舊 B 原件仍在 [原分支固定證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/codex/upstream-141-early-retry/archive/retired/docs/evidence/UPSTREAM_V1_4_1_EARLY_RETRY_EFFICACY_2026-10-30.json)，不回寫。模型無法證明網站自然介入、原生相容或供片效益。

## 安全差異

新的 Codex Security 掃描 ca200567-14aa-49b2-8625-2b0842fc1c17 固定審查 c308111..273f8c3，完整覆蓋 48 項來源／設定／測試差異，涵蓋 HK 授權、定向探測、設定、診斷與 XHR 控制。後續掃描 55815894-6853-4c00-903c-98420e6782dd 固定審查 273f8c3..4bcc29d，完整覆蓋五檔晚到證據提交修復及固定診斷原因；兩次均完成、無可報告安全發現，無延後或未結案項目。兩份 canonical report、coverage、findings、threatmodel 與 SARIF 由插件管理保存，合起來覆蓋最終整合執行期來源。

掃描記錄模型為 gpt-6-astra／xhigh；這是安全掃描工具記錄，不推定主實作代理設定。Daybreak advisory 未授權不阻擋本輪，未修改設定或權限。舊 A／B 掃描只作歷史證據，不代替本輪。安全掃描與 verify 分開；沒有瀏覽器攻擊驗證，也不能據此宣稱不存在所有漏洞。

## 來源隔離與實際安裝

**發布時均未執行。** 當時使用者要求止於測試版發布與公開附件核對，IAB／Tampermonkey 安裝、OGV 自然換集、起播／中段／排序對照、HK 兩片兩倍速及提前重試正常／自然故障窗口全部延後。發布未消耗或重開原實機預算。後續明確啟動的當版實測見下節；不沿用舊版結果補算，不安排第三輪或恢復 IR36、P01／P02 等停止工作。

## 2026-10-30：UP141 安裝版實測

基準 HEAD `0b4d44173901817b4c0e7cbe522ffb10b5d03347`。本輪僅測試已發布 v2.1.38，沒有修改產品來源、版本或附件。A 自 20:58:01 開始，原清理／硬截止為 22:43:01／22:58:01（Asia/Taipei）；22:12 起提前進入清理及報告，22:15:51 收尾，約 77 分 50 秒。B 起點為 22:15:51，次日 00:00:51 轉清理、00:15:51 硬截止。兩輪各最多 120 分鐘，各保留十五分鐘清理額度，不挪用 A 餘額、不追加第三輪。

### 安裝、樣片與環境

由 IAB 既有公開 latest 使用者腳本入口更新；中繼頁沒有安裝確認按鈕，故不以該頁當作安裝證據。新影片文件實際取得 Tampermonkey 5.5.1、腳本 2.1.38，抽取完整已載入本體為 507,104 bytes，SHA-256 `6464ef5f6fd21ea849e045cf1b7efe93f6d2aa72626f50642b16770893991e73`，與公開附件相同。Runtime／ControlCenter 各一個，Fetch／XHR hooks 均 installed。後續新片、重載亦重新核對；其他腳本保持。

- S1：BV1tFZZBQE57，P1，時長 3,910 秒；標題宣稱 8K HDR／240 幀，當輪 Auto 實際 3840×2160、AV1。使用原歷史基準，不宣稱 8K／240 幀播放通過。
- S2：BV1BDVzzZEg4，P1，時長 3,700 秒；標題「地球上10,000个美丽的地方 60FPS 8K 超高清」。結果前由 S1 可見推薦固定候選，三分鐘校準完成後凍結：185 秒連續樣本、約 184 秒進度、41 筆影片 206、零核心重載，Auto 實際 3840×2160、AV1。沒有依測試結果換片。
- E04 **INVALID**：兩個無產品的自有控制頁實際切換，均未形成 false→true→false。使用者將本對話與 IAB 顯示後，visibility 已 true，但 Page.bringToFront／面板操作仍無可驗證的原生背景轉換。已用一次新前提重試，未繼續同方法重跑；健康／提前重試的完整前景相容性驗收因此不成立。
- 合成 loopback 直接 206／Content-Range 與跨呼叫收集器校準通過。早期收集器閉包未隨外層重新指定變數更新，原窗口保留 INVALID；改為單一狀態物件後在合成來源驗證。部分網站高流量或工具返回空隙仍造成 Network 截斷，逐窗保留，不以 Monitor 連續樣本補成完整網路時序。

### A 功能結果

| 案例 | 實際證據 | 判定／限制 |
| --- | --- | --- |
| A-ID | 完整已安裝本體、管理器、唯一 singleton、hooks 與測試身分一致 | 安裝身分 VALID／PASS |
| A-OGV | 港澳台可播放番劇「第二次被異世界召喚」自然下一集；實際 Fetch `/ogv/player/playview` 200、DASH accepted；第二至第三集 generation 3→4、epoch 各為 0，第三集 readyState 4／播放中／無媒體錯誤 | 自然正片入口及換集 VALID／PASS；未自然出現 pre/check/drm，該子項 insufficient；不宣稱一般 API 逆序已解決 |
| A-START | 開／關有效設定及新文件均核對；兩片自然 XHR 都為 `preflight-skipped:xhr-explicit-timeout` | 相容性略過有觀察；無可比較 gate，實機效益 insufficient，未改網站 timeout 或重開同分頁預算 |
| A-RANGE | S2 中段輪：已知大小，HK05 直接 206／相同區間，三秒未完成有效量測；關閉中段後首段輪：兩個請求均從零開始，直接 206／區間一致，HK05 有效安全吞吐 3.9112 Mbps | 首段／中段行為有完整 Network 證據；E04 限制仍在，不宣稱中段未快取或效益已證明 |
| A-HK-PROBE | 三台均勾選、可信按鈕排程；S1 低緩衝取消；S2 遵守跨分頁十分鐘冷卻與禁止，先後中段／首段輪，未增加額外 HEAD | HK05 首段 3.9112 Mbps < 當時 8 Mbps×1.35=10.8 Mbps，效用 FAIL；HK01 未取得有效吞吐；HK03 受限制未取得有效探測；取消不是主機故障 |
| A-BACKUP | 開／關可操作；關閉側自然新文件備援最多五個；恢復開啟並關閉 HK 後，輸出仍最多五個且不含關閉 HK | 缺相同授權與足夠家族證據的完整配對，分散效益 insufficient；沒有強制切換流暢親和 |
| A-DIAG | 實際控制中心呈現測試身分／有效設定／候選／探測，原生鍵盤可操作閉合 Shadow DOM；複製按鈕、選取全文複製、合成頁貼上三方一致，47,845 bytes | 功能 VALID／PASS；未含原始 URL／Range／cid／權杖／XHR，bufferTrend schema 6；剪貼簿原始空格式恢復限制另列 C01 |

### 香港候選逐條件結果

下表僅描述本次安裝版觀察，不能取代完整正式門檻。固定主機仍服從 circuit-open／禁止，未清除限制；成功音訊或其他主機接手不算指定 HK 影片成功。所有採樣窗口 reloadCount 均為 0。

| 主機尾碼 | S1／1 倍 | S1／2 倍 | S2／1 倍 | S2／2 倍 |
| --- | --- | --- | --- | --- |
| HK03 | 70 秒、網路完整；影片由 Bos／Ali 供應，指定主機不足 | 修正設定焦點後見兩筆 HK03 timeout；另有尋位與網路截斷，窗口 INVALID | 70 秒、網路完整；影片由 Ali 供應，指定主機不足 | 初次暫停 INVALID；恢復播放一次後仍由 Ali 供片且網路截斷，INVALID |
| HK05 | 80 秒、15 筆 HK05 影片成功；尾端網路截斷，INVALID，保留成功觀察 | 初次四筆成功後一筆 timeout／轉 Ali且網路截斷；收集器修正後 68 秒只由 Ali 供片，指定主機不足 | 70 秒、13 筆 HK05 影片成功、網路完整，超過 60 秒供片觀察 | 初次全程暫停 INVALID；恢復播放一次後 17 筆 HK05 成功，但網路截斷，INVALID |
| HK01 | 68 秒、直接 206 為音訊；影片已 circuit-open／由 Ali 接手，歸因工具欄位亦不完整，不能算影片通過 | 70 秒、兩筆 HK01 影片 timeout、Ali 接手，最低緩衝 0；網路完整，供片 FAIL | 70 秒、網路完整；影片由前主機及 Ali 供應，指定主機不足 | 70 秒、影片 Ali；末尾暫停與網路截斷，INVALID |

三台均未達兩片兩倍速探測／餘裕與正常供片全門檻。HK05 有局部成功供片，但有效探測不足需求，不能以片段成功推翻失敗或補足缺樣；HK01 有完整失敗窗口。測試版仍保留三台，維持預設關閉，不在本輪刪除、正式採用或另發新版。

### A 清理與證據範圍

A 三開關恢復 true、HK 三台 false、B false、fixedHost=null、Native=false、原線對照=false、腳本啟用；原四台預設不可用維持。香港沿用 catalogOverrides，清理留下三個明確 false，沒有整體 reset／清空學習／覆寫舊快照。原一倍速已由實際媒體值核對；新載入曾恢復網站儲存的二倍速，另經原生控制復原，不以 UI 標籤代替媒體讀值。

自有觀察器逐窗 finish／到期收束，registry 已移除；Network 已停用，沒有網站故障攔截、媒體 getter 修改或請求重播。自有 loopback 服務與凍結分頁暫留，明確交接 B 輪，最終再退出。

剪貼簿原始為零格式；IAB write([]) 拒絕，原生 write([]) 未清除既有文字。自有文字已清為空字串，但無法恢復「零格式」原狀，**C01 完整清理不能列 PASS**。產品匯出的後一次操作以可還原的空文字格式為基準並已復原；不以此抹除首次限制。

本機去敏 JSON、截圖及 SHA-256 清單保存於 `.work/iab-testing/2026-10-30-v2.1.38-0b4d441-up141/`；WINDOW-SUMMARY.json 由原件重算，保留所有失敗／無效嘗試與尾端旗標。沒有把先前文字進度報告當作證據來源；HK05／S1／1 倍最終按原始 truncated=true 更正為 INVALID。

### B 原生相容性、窗口及阻塞

原生無產品 loopback 頁與安裝版 S1 各建立五個自有、未送出的 XHR。七項對照一致：getter 品牌檢查、setter 品牌檢查先於轉換、單次轉換及相同值寫入、轉換例外身分、數值轉換、轉換期間重入 open、failed open 後重用。兩側 created=5／disposed=5／sent=0。這僅為 **原生基本相容性 VALID／PASS**，不代表已驗證提前 timeout 的寫入所有權、真實終止事件、網站重試或送出後交接。

受控故障 **INVALID／未注入**：E04 真實前景切換校準未成立，且當時沒有合格在途請求。未改網站 timeout、媒體 getter 或正式樣本來製造資格；沒有安裝網站攔截或重播請求。部分網站起播請求有明確 timeout，但本輪不能由此推定所有媒體請求均有網站 timeout。

結果前已保存八個正常窗口及十六個自然窗口的固定順序，每窗 180 秒。兩片、兩倍速及開／關交錯保持；關閉側控制器不提供完整反事實資格統計，因此「合格機會數」為不可量測，不填零。

| 窗口 | 已保存結果 | 判定／限制 |
| --- | --- | --- |
| B-N01：S1／1 倍／開 | 79.003 秒、79 筆樣本；觀測工具 lease 到期；網路截斷；15 筆影片 206、提前重試次數 0、核心重載 0 | INVALID，不能算完整三分鐘開啟側，未追加同條件重跑 |
| B-N02：S1／1 倍／關 | 完整 180 秒、180 筆樣本、進度 178.999591 秒；最大樣本間隔 1,004 ms；網路未截斷；36 筆影片 206；無暫停／seek／媒體錯誤；最低緩衝 29.936 秒、核心重載 0 | 正常供片觀察完整；只有關閉側，不能形成開／關效益或成本結論，亦不能補足 E04 |
| B-N03～N08 | 六個正常窗口尚未啟動 | 未執行：工具不可用 |
| B-F01～F16 | 十六個自然窗口尚未啟動 | 未執行：工具不可用；介入成功率、停頓改善與自然合格機會均無法計算 |

約 22:33（Asia/Taipei），切換至 S2 的準備期間，本對話工具更新明確移除 `mcp__cua_repl`；後續不能操作或讀取 IAB。S2 新分頁曾完成網站載入，但其新文件完整身分尚未核對，也沒有開始 N03。未改用 Chrome／Edge、獨立 CDP、Playwright 或其他介面繞過。剩餘二十二窗的純觀測時間為六十六分鐘，另需切換與清理；原 00:00:51／00:15:51 截止不因阻塞重設。

最後可驗證狀態：N02 的觀察器已 finish，計時器／訂閱已收束；S1 已經可信播放按鈕暫停。設定為 A 三項 true、B false、HK 三台 false、自動模式、Native false、腳本啟用。B 原生對照的自有 XHR 已 abort 清理，沒有網站故障攔截。工具退出後無法完成最終分頁、Network／Debugger 參照及瀏覽器狀態清理核對，與 A 的剪貼簿格式限制一併記為 **C01 INVALID**，不宣稱全部資源已恢復。

B 未達受控及自然效用門檻，仍為預設關閉測試原型；原離線效用 FAIL 保留。這次沒有變更產品、版本、預設、標籤或 Release，也不以安裝身分通過或單個正常供片窗口宣稱正式採用。

<a name="發布與安裝限制"></a>

## 公開交付與安裝結案

封裝前必要自動與安全檢查已完成。本機使用者腳本為 v2.1.38，507,104 bytes，SHA-256 為 `6464ef5f6fd21ea849e045cf1b7efe93f6d2aa72626f50642b16770893991e73`。封裝快照止於本機驗證；公開 latest 版本、唯一附件、大小及 SHA-256 於發布後追加至現行 TEST_REPORT，未核對前不宣稱公開交付完成。

v2.1.37 標籤與附件原始位元組保留，只追加 Release 說明的測試定位更正。GitHub Release 不設 prerelease 以維持既有 latest 更新鏈；該狀態不代表正式驗收。實機後才決定正式版本。

2026-10-30 公開核對已完成：[v2.1.38 測試 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.38) 的 main 發布提交及標籤目標均為 `7bbb02ba90af06724af790cd5f578b84e56a18a5`。Release ID 428229134，唯一附件 BiliCDN_TW.user.js（asset ID 689454412），507,104 bytes；GitHub 回報 digest 與無認證公開 latest 下載均為 `6464ef5f6fd21ea849e045cf1b7efe93f6d2aa72626f50642b16770893991e73`，與本機封裝逐位元組相同。腳本版本為 2.1.38，名稱、namespace 及 latest 更新網址保持；78 個建置輸入雜湊、五項封裝與 Git 暫存版本均一致。封裝正文保留發布前快照，本段為發布後現行報告補記。

[v2.1.37 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.37) 已更正標題並追加日期說明，舊說明全文前綴及附件中繼資料均保持。標籤目標仍為 624029dbaad2dc4418b43cd18da7d66b89bc83ca；公開附件仍為 451,802 bytes、SHA-256 `1293587c8bd0c5133289a981feccc3ffa6c28297da06e4d6d9570d3895222ac4`。原 B 分支仍為 2a5851761d5a066cd3b54cb447b9da546a23187e。原件、三份日誌前綴及完整舊報告保存核對通過。

封裝後文件與公開封存通過：237 個 Markdown、419 搬移檔、三份只追加日誌、129 個適用不變檔、65 份 checksum／302 筆；歷史／私有／外部連結限制維持分列。發布交付當時已結案，尚未執行安裝或實機專項；後續使用者明確啟動的測試結果見本報告上方當版實測章節。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

舊相容入口見 [v2.1.8](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版全文見 [v2.1.37](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2137-完整報告2026-10-30)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。

## 隔離 B 分支原型驗證（2026-10-30）

此舊分支補充已原樣保存於 [歷史完整紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。原型提交、效用 FAIL 與安全證據維持原判定；目前版本結果見本報告前文。

## v2.1.39 完整報告保存（2026-10-31）

# BiliCDN_TW v2.1.39 正式整合版驗證

日期：2026-10-31（Asia/Taipei）。第一階段基準 main 0b4d441，509f56a 完成全部原工作分支與歷史證據的一般合併並推送。第二階段以 codex/control-center-integration 修改業務邏輯及 UI。本版依使用者明確決策正式整合，不把舊效用 FAIL、INVALID 或不足實機改判通過。

## 功能與預設

| 能力 | 本版實際行為 |
| --- | --- |
| OGV | 保留開啟；pre/check/drm 僅辨識、原文傳遞、不改 Vault／epoch |
| 六個自動功能 | 起播提前放行、中段探測、備援分散、提前重試、WebRTC／HTTPDNS 阻止均保留真實開關；新安裝／缺值 true，明確 false 保留 |
| 香港 CDN | 三台一般 Catalog 預設可用，原覆寫保留；原四台預設不可用不變 |
| 格式偏好 | codec 設定及排序能力已刪除，舊 AV1 設定不改表示順序；辨識與歸因保留 |
| 手動操作 | 手動測速、手動最近影片 CDN 封鎖、HK 定向驗證及特殊 context／challenge 分支完整移除 |
| 額外詳記 | verbose 與排名歷史收集器移除；相容欄位空陣列／零；基本事件與 bufferTrend v6 保持 |
| 控制中心 | 標題無 v2；總覽／CDN／播放設定／診斷四頁，真實讀模型、按需報告及匯出 |

schema 2、原儲存鍵、singleton、名稱、namespace 與 latest 更新鏈保留。設定切換不重開起播／冷卻／提前重試額度、不取消網站請求、不放寬恢復與可見性政策。

## 自動驗證

具名紅色契約先覆蓋 CC39 設定／移除／CDN／診斷與 UI，再修改來源。指定工具鏈下 npm run typecheck、npm run architecture（114 runtime 模組）、npm test、npm run verify 全部通過：**3010 案，零失敗／取消／略過／待實作**，控制中心其中 59 案。verify 另核對格式、文件、封存、確定性建置、語法及暫存封裝校驗。docs:check 通過 241 Markdown／2505 本機與儲存庫連結；archive:check 通過 424 搬移檔、三份只追加日誌、123 適用不變檔、66 checksum／306 筆。git diff --check 與暫存差異檢查通過；最後發布文件會再獨立核對。

七個不可變舊失效連結、430 歷史原址限制、十八個私有引用及 411 外部未連網引用保留，不代表外部可達性通過。所有既有發布原件保持位元組與 SHA-256；v2.1.38 五項產物搬至封存，第二階段前配置原件另有精確保護。

舊合併階段完整 verify 2999 案，僅用來證明第一階段未改產品。測試工具的暫存 Git 寫入需正常授權；未改期待或版本鎖。指定 Node 26.8.1／npm 11.19.0，無新增依賴或 CI。

## 獨立效用與已知限制

獨立 early-retry-evaluation 命令真實退出碼 **1，VALID／FAIL**。輸入 SHA-256 9130e0dd4af45496cbbd23dab07737060449b3b94629dfb33d0c986ffd740763，政策 SHA-256 04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37。固定持續慢速可改善，正常突發回補仍可能產生不必要的 100,000 bytes 重下載；沒有更改輸入、門檻或判定。原始 [本輪 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/CC39_EARLY_RETRY_EFFICACY_2026-10-31.json) 精確保護，歷史 FAIL 原件保持。預設開啟來自使用者整合決策，不是效用通過。

## 安全差異

Codex Security 差異掃描已完成並封存：scan 4e827d91-2cf2-4af9-9da9-8b3295aea53b，固定來源範圍 509f56ae9d47ea1d68504d3a3d655c6035831bd2 至 af4f57fb6801dd7fb6c702db70993595629223ef。獨立架構模型及分組審查覆蓋完整 60 項來源清單，另核對 package-lock 與使用者腳本 metadata；無待審項、零可報告發現。跟查包括 Vault 授權、HK 一般 Catalog 限制、鎖內測量重驗、原生 timeout 所有權與許可、可信 UI、去敏及匯出資源清理。

此為固定差異與相關路徑的靜態安全審查，結合本輪契約證據；沒有宣稱整庫無漏洞、瀏覽器原生相容或效用通過。canonical report.md 保存在 Codex Security 本機掃描目錄，SHA-256 為 0f797d5034cd5b7933d6208e9920f306260b1ab913c55340d1b7be8b1c6c5ac2；私有掃描產物未自動公開。後續封裝與指南修改不改該來源範圍。

## 來源隔離與實際安裝

**本版未執行，安裝身分與實機 UI／播放驗收未驗證。** 本回合工具清單沒有既有 IAB 程式化控制能力；可用 Windows Computer Use 的輸入方法會自動啟用目標視窗，與使用者禁止搶焦點衝突，也無法先由目前能力保證播放靜音。因此未操作安裝入口或影片，不要求前景／面板／手動例外。這是工具與執行界線，不判為產品測試 FAIL。全程未啟動本機服務、未播放有聲媒體；沒有重開原兩輪或停止矩陣，舊版安裝身分不補算本版。

## 公開交付與安裝結案

本封裝快照完成時公開發布尚待執行；唯一腳本為 BiliCDN_TW.user.js，版本 2.1.39，507387 bytes，SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3。發布後 main／標籤／唯一附件及公開 latest 核對記於 [現行完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#公開交付與安裝結案)，不回寫已發布封裝。發布和實際安裝驗收分開。

2026-10-31 01:43:45（Asia/Taipei）已公開 [v2.1.39 正式整合版](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.39)。整合分支來源提交 0fa13f6 以一般 merge 納入 main，發布提交為 9f8a88034d2ae625b17d3cc90817442a46b81093；五個 codex 工作分支端點均已核對為祖先，分支與工作樹未刪除。遠端 main 與標籤解參照都指向該發布提交；附註標籤物件為 e29853c3ead4c644b87c872a48fd6d2cbd537bb1。main 後續只追加本核對與結案紀錄，標籤及封裝原件不再改寫。

GitHub 公開 latest API 回報 draft=false、prerelease=false，只有一個 BiliCDN_TW.user.js 附件。另直接下載既有公開 latest/download 入口，核對版本 2.1.39、507387 bytes 與上述完整 SHA-256，均與本機及 GitHub digest 一致。未透過瀏覽器安裝，不宣稱已更新 Tampermonkey；來源隔離、視覺與實機結果仍為未驗證。

## 2026-10-31：更新後安裝核對

18:12（Asia/Taipei），使用者回報已更新 v2.1.39 並要求驗證。當回合基準為 main 2f39f17，開始前工作目錄乾淨。本機腳本與 GitHub 公開 latest API 均為 2.1.39、507387 bytes、SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3，只有一個腳本附件。這次重新核對只證明發行檔，使用者更新回報尚未由工具獨立驗證。

| 案例 | 本次結果 |
| --- | --- |
| F-CC39：本機／公開附件身分 | PASS；版本、大小及 GitHub digest 與本機完整 SHA-256 一致 |
| I-CC39-IDENTITY：完整安裝、管理器、singleton／hooks | INVALID；當回合沒有 IAB 分頁、JavaScript 或 CDP 控制／讀取能力，無法取得必要證據 |
| I-CC39-UI：四頁、真實數據、移除項目與報告匯出 | 未執行；完整安裝身分未成立 |
| I-CC39-SETTINGS：六個開關、既有 false、香港候選與逐台覆寫 | 未執行；完整安裝身分未成立 |
| I-CC39-PLAY：靜音下基本播放及實際路線 | 未執行；工具不能先確認靜音與安裝身分 |

當回合只呼叫 Computer Use 的唯讀 list_windows()，未啟用、輸入、截圖或導航任何視窗。返回外部 Chrome 及 Codex 宿主兩個視窗；它不暴露 IAB 分頁或執行環境。已發現的視窗不作為替代瀏覽器，亦未透過系統或私有介面存取瀏覽器資料。工具目錄搜尋僅回傳不適用的外部／雲端能力，未安裝或使用。具體工具界線另見工具日誌。

未新增網路攔截、斷點、頁面訂閱、計時器或測試分頁，故無新增瀏覽器測試資源待清理；未宣稱前輪資源或目前網站狀態已核對。沒有啟動本機服務、切換前景、搶焦點或播放媒體；不要求使用者例外操作。沒有重跑既有自動測試、安全掃描或效用命令，歷史 3010 PASS 與效用 FAIL 保持其原執行日期，不補算本次安裝證據。

## 2026-10-31：六十分鐘驗證計畫執行結果

18:39（Asia/Taipei），依使用者明確批准的更新後驗證計畫開始。接受使用者已完成 v2.1.39 更新，驗收對象直接為已安裝版本；不再次下載、安排更新確認或要求重新安裝。基準 main cff1dff，開始前工作目錄乾淨。總上限六十分鐘，最後十分鐘保留清理及報告；本次在最小工具檢查後立即停止，未啟動瀏覽器測試窗口，沒有循環等待或追加輪次。

一次列舉當回合可呼叫工具後，只有通用 node_repl，以及僅開啟面板的 open_in_codex，沒有 IAB 瀏覽器／分頁讀取、互動、頁面 JavaScript 或 CDP 控制工具。面板工具的說明明確要求另用 browser 工具檢查或互動，不能由它取得完整安裝或功能證據。這是工具前提未成立，不是使用者未更新，也沒有證據判定產品失敗。

| 案例／範圍 | 結果 | 本次證據或未執行原因 |
| --- | --- | --- |
| CC39-60-TOOL：一次最小工具檢查 | INVALID | 無所需 IAB 讀取／操作能力，依計畫立即停止 |
| CC39-60-ID：版本、管理器、完整本體、singleton／hooks、原狀態 | 未執行 | 無法存取已安裝分頁的執行環境 |
| CC39-60-UI：四頁、真實資料、移除項目、鍵盤及生命週期 | 未執行 | 工具前提不成立 |
| CC39-60-DIAG：問題標記、清除、完整報告、匯出及複製 | 未執行 | 未接觸診斷或剪貼簿 |
| CC39-60-SETTINGS：六個真實開關及跨分頁同步 | 未執行 | 未操作任何設定，無法驗畫面至功能接線 |
| CC39-60-CDN：逐台／固定、限制、Native 及原線對照 | 未執行 | 未操作任何模式或限制 |
| CC39-60-PLAY：S1／S2、1／2 倍、提前重試開關八個六十秒窗口及操作 | 未執行 | 未啟動播放；無法事前確認靜音或取得連續證據 |
| CC39-60-HK：S1 三台依 03／05／01，各兩倍速的六個六十秒窗口 | 未執行 | 未發出測試請求或變更固定主機 |
| CC39-60-OGV：既定番劇一次自然換集 | 未執行 | 未導航或換集 |
| CC39-60-CLEAN：自有資源結束 | 無新增瀏覽器資源 | 無分頁、觀察器、訂閱、計時器、斷點、Blob、剪貼簿或設定變更；不補算產品生命週期清理通過 |

本輪未完成安裝版驗收。沒有重查公開附件、改用外部瀏覽器、建立服務、要求前景、搶焦點或播放聲音；產品、已發布檔及既有設定未改。既有 3010 自動 PASS、安全審查及提前重試效用 FAIL 保留原日期與範圍，未重跑、未算成本次通過。工具界線追加於工具日誌，當前工作狀態由 TODO 維護。

## 2026-10-31：IAB 可用但持續靜音前提受阻

本輪接受使用者已完成 v2.1.39 更新，不下載、不安排更新確認或重新安裝。依使用者批准的「核心驗收完成，條件式證據另列限制」計畫，18:58:38.510（Asia/Taipei）開始；基準 main 27941936c79f86f60739f0e71e707ff7c9c35b55，工作目錄乾淨。總上限六十分鐘，最遲 19:48:38.510 清理、19:58:38.510 截止；本次遇前提不足立即提前清理，不追加窗口。主機單調計時起點 2517537714212、頻率 10000000 Hz；18:59:42.081 已觀察到瀏覽器清理完成，檢查及瀏覽器清理的含工具往返上界為 63.572 秒，不宣稱為純瀏覽器執行工時。

當次 mcp__cua_repl 的唯讀 getState 回報 type=iab，初始分頁為空；選取該 IAB 後，以 visible=false 建立唯一 about:blank 分頁並成功取得空白頁狀態。瀏覽器能力列出 visibility／viewport，分頁能力列出 pageAssets／webmcp／cdp。CDP 文件要求第一個命令前先導覽到預定 HTTP／HTTPS 網頁；本次只讀文件，沒有發送 CDP 命令，不能宣稱其命令權限、Network 連續事件或產品內部讀取已通過。

核心阻塞為**無法在可能自動播放的導覽前，確認聲音輸出已被持續抑制**。上述當次文件化介面未提供分頁／瀏覽器持續靜音設定及回讀；空白頁無媒體不證明下一個文件已靜音，隱藏瀏覽器也不是靜音。未以導覽後修改媒體、取消音訊請求、修改 getter 或 Windows 前景輸入替代。這是本次可用方法的前提缺口，不是產品 FAIL、不表示使用者沒有更新，也不宣稱所有 IAB 永遠不支援靜音。

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| CC39-MUTE-TOOL：一次 IAB 能力檢查 | PASS | IAB 列舉、選取、自有空白分頁建立及讀取成功；僅此範圍 | 可信產品操作、CDP 命令與連續事件 |
| CC39-MUTE-PRE：持續靜音前提 | 證據不足 | 文件化能力沒有導覽前可確認且持續生效的靜音控制；未導覽媒體網站 | 跨導覽／播放器替換的無聲保證 |
| CC39-MUTE-ID：安裝身分與原狀態 | 未執行 | 未進入已安裝產品的播放文件；未讀取或更改設定／診斷 | 管理器、完整本體、唯一實例及 Fetch／XHR hooks |
| CC39-MUTE-UI：四頁、鍵盤、資料與移除項目 | 未執行 | 執行身分及無聲前提未成立 | UI、實際主機、輸入元素與訂閱生命週期 |
| CC39-MUTE-DIAG：事故記錄與匯出 | 未執行 | 未操作產品診斷 | 同一完整報告、JSON、96 KiB、去敏、空排名與 bufferTrend v6 |
| CC39-MUTE-S01–S06：六個開關 | 未執行 | 未操作設定，不能宣稱接線 PASS | 畫面至 SettingsState 至消費者，以及自然行為 |
| CC39-MUTE-CDN：逐台、固定、Native、原線對照與維護取消 | 未執行 | 未操作模式或限制 | 14 台清單、香港三台、限制優先及持久／分頁語意 |
| N01–N08：兩片、兩倍速、提前重試開／關 | 未執行 | 八個六十秒窗口均未開始 | 正常播放、卡頓、主機、重播及核心重載 |
| CC39-MUTE-OPS：暫停／恢復與短 seek | 未執行 | 未開始播放 | 操作回歸 |
| H01–H06：S1 香港 03／05／01，各 1／2 倍 | 未執行 | 六個六十秒窗口均未開始，未變更固定主機 | 直接影片 206 與正常供片 |
| CC39-MUTE-OGV：第二次被異世界召喚第二至第三集 | 未執行 | 未導覽番劇或搜尋替代作品 | 正片 API 接納、內容切換及播放 |
| CC39-MUTE-COPY／SYNC：剪貼簿與跨分頁同步 | 未執行 | 未觸碰剪貼簿，也未建立第二個分頁 | 兩項條件式能力 |
| CC39-MUTE-CLEAN：本輪自有資源 | PASS | 唯一空白分頁 close 成功，隨後 IAB tabs.list 為空；沒有設定、剪貼簿、攔截、訂閱、計時器、斷點或 Blob 變更 | 未運行產品生命週期／匯出 Blob 清理，不能補算產品通過 |

**本輪未完成核心驗收。** 既有 3010 自動契約、安全審查、移除路徑與遷移證據仍屬原執行日期，本次未重跑；提前重試效用 FAIL 原樣保留。沒有產品缺陷可由本輪證據確認。沒有啟動網站服務、要求前景、操作外部瀏覽器或啟動播放；未重查公開附件、未使用安裝入口。

去敏基準、逐項未執行案例與清理操作順序保存在本機忽略目錄 .work/iab-testing/2026-10-31-v2.1.39-2794193-post-update/EVIDENCE.json；不保存列舉時所見的無關應用、外部分頁標題或網址。參考本體版本／SHA-256 沿用已批准計畫，本輪實際載入本體身分為未知，兩者不混用。具體工具界線見 [工具日誌](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md#2026-10-31iab-恢復與持續靜音前提)，目前工作只在 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

本次文件檢查於 19:02 完成：docs:check 退出 0，241 Markdown／2518 本機與儲存庫連結；archive:check 退出 0，424 搬移檔、三份只追加日誌、123 不變檔及 66 checksum／306 筆；git diff --check 通過。七個不可變舊斷鏈、430 歷史原址限制、十八個私有引用及 412 外部未連線引用仍分列，不代表外部可達性或私有封存通過。這次僅使用主機 Node 26.13.0／npm 11.20.0 執行文件及封存檢查，沒有執行要求指定工具鏈的產品 verify。只有四份既有文件與忽略目錄的去敏證據有本輪寫入，沒有提交、推送或發布。

## 2026-10-31：依使用者更正靜音方法續行與下載工具超時

19:05（Asia/Taipei），使用者明確指定起播後立即靜音。先前將跨頁自動靜音當成唯一方法過於限縮；本次依新指示在同一原期限內續行，19:48:38.510 仍為測試截止，19:58:38.510 仍為硬截止，沒有重開六十分鐘。此更正不回寫先前檢查點、不修改永久指引，也不構成其他歷史矩陣的重啟。

在不顯示的自有 IAB 分頁開啟 S1 P1。音量圖示因控制列隱藏無可點擊範圍，快捷鍵未提供立即靜音確認；經已支援的 CDP 設定真實 HTMLMediaElement.muted=true 並讀回，沒有修改 getter、偽造進度或抑制音訊下載。其後以本分頁自有 MutationObserver／volumechange 監聽器維持實際 muted；準備與 UI 測試期間暫停。最初載入至完成確認的區間不宣稱全程無聲，也不算正常播放計分窗口；沒有要求使用者前景、調音量或例外操作。

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| 已安裝 v2.1.39 身分 | PASS | Tampermonkey 5.5.1；從已載入管理器包裝內取出完整本體，507387 bytes，SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3；Runtime／ControlCenter 各一個，Fetch／XHR 均 installed | 不代表其他實例或新文件通過 |
| 媒體靜音 | PASS | 原生 muted=true 可讀回；結束前仍 muted=true、paused=true、2 倍 | 初始未確認區間、跨新文件未實測 |
| 控制中心與資料 | 證據不足 | 已見正確標題、四頁標籤，總覽／播放設定／診斷內容；總覽區分選定路線與影片／音訊 206 回應及時間。四個設定輸入在更新後保持同一元素 | CDN 頁、完整鍵盤／重開、四頁移除項目全覆蓋；入口使用既有 show，不算入口按鈕驗收 |
| 六開關接線 | PASS | 六項可信 change 均核對畫面及 SettingsState；Measurement／RouteCoordinator／Monitor 與共享 Fetch／XHR context 讀值一致。四個自動策略、WebRTC、HTTPDNS 均完成切換及還原；提前重試關閉觀察到 settings 撤銷原因 | 新文件 gate、自然中段／家族排序、未認領許可與自然 HTTPDNS 攔截未完成 |
| WebRTC 描述子 | PASS | 開啟時四項 API 為封鎖 accessor；關閉還原原資料描述子或不存在狀態，再次開／關後六個描述子欄位身分均相同；最後恢復開啟，未建立點對點連線 | 其他腳本競態未注入 |
| 問題標記、清除及實際 JSON 匯出 | INVALID | 獨立觀察：自有分頁標記 count=1，清除後標記／事故為 null；下載與同一份完整報告逐字一致，79090 bytes、可解析、未命中檢查的敏感模式；rankings 空、rankingDropped／rankingEvicted 為零，bufferTrend schema 6／buffer-window-v6 | 合併工具呼叫超出階段與測試截止，不能算符合時限的診斷驗收；剪貼簿未測 |
| CDN／Native／原線對照、維護取消與遠端同步 | 未執行 | 超時後停止新增案例；原香港三台明確 false 保留 | 全部對應行為 |
| N01–N08、H01–H06、OGV、完整暫停／恢復及短 seek | 未執行 | 沒有開始固定正常、香港或 OGV 計分窗口；準備期播放／暫停不代算 | 全部播放回歸 |
| 自有清理與設定還原 | PASS | 除正常 updatedAt 外原設定欄位一致，提前重試 false、香港三台 false、fixedHost=null、Native=false；ControlCenter 訂閱 3→0，自有觀察器及靜音監聽器移除，斷點／除錯物件組／Debugger 釋放，唯一分頁關閉且清單為空 | 先前取得的 closure scope 未確認 exportUrl 變成 null，單靠該讀回不能確認產品 Blob 撤銷或判定洩漏；分頁卸載已完成，Blob 子項仍證據不足 |

診斷／匯出工具呼叫的外層實際 wall time 為 **2376.3149 秒（約 39 分 36 秒）**，內部 download event 與 path 都指定 timeoutMs=5000，但未能約束整次工具返回。沒有逐子呼叫時間分界，不推測哪一步等待或是否涉及批准等待。19:53:40.545 的主機讀回距原 T0 為 3302.036 秒，已超過預定測試截止；返回後立即清理，未再開始案例。最後十分鐘因此未完整保留，這是本輪執行限制，不能改截止或忽略超時來算通過。

已載入本體、六開關及匯出的直接觀察保留，不以超時抹除，也不以片段成功宣稱整輪完成。**本輪未完成核心驗收；沒有確認產品缺陷。** 原提前重試效用 FAIL 與全部舊結果不改判。更正後去敏資料保存在本機忽略目錄同一輪的 RESUMED_EVIDENCE.json，另有 exported-report.json 與 settings-restored.png；下載原件為本機 BiliCDN-diagnostics.json。產品來源、版本、發布檔保持；沒有提交、推送或發布。

## 2026-10-31：補測與單分頁重測

**本輪未完成核心驗收。** 使用者先授權補完未測項目，21:23 再明確要求一次只開一個分頁並重新測試。當時立即關閉第二個自有分頁、逐欄還原改動；此前雙分頁期間的 N01／HK01 觀察保留為 INVALID，不作本輪播放驗收依據。先前已通過的六開關接線、WebRTC 描述子還原及匯出內容不重測；下列 UI 補測與單分頁播放證據分開列示，不互相代算。

補測起點為 20:51:15.633；一次歷史入口查詢工具實際持續 **819.807 秒**，等待計入時間，不以查詢取得入口代算播放。使用者明確要求重測後，單分頁輪次 T0 為 **21:24:10.332**（Asia/Taipei），另保存主機單調計時；最遲清理 22:14:10.332、硬截止 22:24:10.332。從建立基準到最後關閉，全程只有 IAB 分頁 3；S1、S2、S1、OGV 均在同一分頁導覽，沒有背景測試播放器或第二分頁同步測試。各 60 秒窗口起訖均檢查分頁數為 1。

每次新文件核對 Tampermonkey **5.5.1**、腳本 **2.1.39**、完整本體 **507,387 bytes**／SHA-256 `583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3`、唯一 Runtime／ControlCenter 及 Fetch／XHR hooks。只使用已安裝版本，未更新、下載安裝、重建控制器或修改產品。導覽後依使用者更正立即以真實 muted setter 靜音，MutationObserver／volumechange 只維持靜音；所有窗口 muted=true，音訊請求保留，未修改媒體 getter。

### 控制中心、診斷與政策補測

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| 四頁導覽、鍵盤及訂閱生命週期 | PASS | 總覽／CDN／播放設定／診斷均取得；Tab、Enter、Space、Escape 可用；關閉訂閱歸零、重開三個訂閱 | 入口按鈕沿用原跳過決定，不代算入口點擊 |
| 總覽完整即時對照與移除項目掃描 | 證據不足 | 已取得畫面與真實狀態片段；六開關頁沒有被移除的設定入口 | 尚未完成每個總覽欄位、無資料／較早回應標示及四頁全部移除入口的完整逐項對照；來源／契約證據仍獨立保留 |
| 六開關接線及 WebRTC 還原 | PASS | 沿用前次可信 UI → SettingsState → 實際消費者與描述子還原證據 | 自然行為另列，不因接線通過宣稱效用通過 |
| 14 台逐台清單與固定選單 | PASS | 各開關以可信 Space 切換再還原；固定選單逐一取得 14 主機後回自動；香港三台可見，四台預設停用不變 | 全部政策組合的實際請求效果未窮舉 |
| Native 與分頁原線對照 | PASS | Native 在新文件保留；原線對照僅本分頁生效，完整重載後關閉，持久設定未寫入對照值 | Native／原線在每一種既有限制下的請求效果未完整覆蓋 |
| 遠端同步 | 未執行 | 單分頁重測不建立第二分頁。先前補測已觀察同一輸入元素 connected=true 且 true→false 更新，僅保留為先前證據 | 本次單分頁輪次不重測跨分頁 |
| 維護工具 | PASS | 兩項確認介面均展開後取消，未按確認執行 | 未執行清除學習或重設設定，符合範圍 |
| 事故標記、更新、清除與匯出 Blob | PASS | 僅自有分頁操作；本次匯出建立 40,727-byte JSON Blob，離開診斷頁觀察到 revoke，outstanding=0；兩個自有 URL 包裝均按所有權還原 | 匯出文字一致、去敏、大小及 v6 schema 沿用前次已取得實際檔案的證據，不重複計次 |
| 剪貼簿 | 未執行 | 未覆寫剪貼簿 | 尚無完整格式與所有權復原證據 |

### 單分頁固定播放矩陣

固定 S1=`BV1tFZZBQE57`、S2=`BV1BDVzzZEg4`，P1、保留 Auto 偏好，不強制解析度。正常窗口腳本啟用、自動 CDN、Native／原線對照關閉；香港窗口僅允許當台香港覆寫、固定該台、提前重試回原 false。沒有清冷卻、限制或學習資料。實際解碼尺寸與路線表示摘要分開保存，不以標題或路線 metadata 代替播放器尺寸。

每窗頁內 250 ms 取樣，共 242 筆，最長取樣間隔小於 304 ms；另記媒體事件、型別化路線事件、SettingsState 變動、提前重試及恢復快照。N01–N04 的瀏覽器 Network 游標截斷，雖頁內進度完整仍列 INVALID。N05 起改成一次持續工具呼叫、每 1.5 秒排空事件，後十窗無截斷；沒有拼接窗口或自行重跑無效案例。

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| N01 S1／1 倍／提前重試開，21:25:15.633 起 | INVALID | 完整 60 秒，進度 +59.998 秒；Network 游標截斷 | 完整網路事件，不能計入核心通過 |
| N02 S1／1 倍／關，21:26:26.246 起 | INVALID | 進度 +59.999 秒；Network 游標截斷 | 同上 |
| N03 S1／2 倍／關，21:27:51.831 起 | INVALID | 進度 +120.004 秒；工具往返間隙仍有截斷 | 同上 |
| N04 S1／2 倍／開，21:28:55.185 起 | INVALID | 進度 +120.010 秒；Network 游標截斷 | 同上 |
| N05 S2／1 倍／開，21:30:42.543 起 | FAIL | 進度 +55.744 秒；可信 waiting→playing 間隔 4.284 秒，約 3.995 秒無合格進度；無媒體錯誤或腳本核心重載 | 卡頓歸因未確認，不能直接判為新版缺陷 |
| N06 S2／1 倍／關，21:31:56.610 起 | PASS | 進度 +60.010 秒，無兩秒停滯、非預期暫停或腳本重載；影片實際主機 mirrorali02 | 當窗路線快照無音訊回應資料，未捏造音訊主機 |
| N07 S2／2 倍／關，21:33:04.764 起 | PASS | 進度 +120.022 秒，事件完整且無停滯／重載 | 沒有新媒體回應；影片主機僅為窗前較早的 mirrorali02，音訊無資料 |
| N08 S2／2 倍／開，21:34:14.737 起 | PASS | 進度 +119.994 秒，事件完整且無停滯／重載 | 同上；不能由無新請求證明提前重試效用 |
| HK01 01-03／1 倍，21:35:57.824 起 | FAIL | 有合資格影片請求但失敗，沒有該台直接影片 206；影片由 mirrorali 接手，該台音訊 206 不代算 | 故障根因未確認 |
| HK02 01-03／2 倍，21:37:09.207 起 | 證據不足 | 影片 circuit-open，沒有合資格影片請求；保留熔斷，正常播放由其他 CDN 供片 | 該台 2 倍影片供片 |
| HK03 01-05／1 倍，21:38:41.852 起 | PASS | 14 個可歸因影片直接 206，播放 +60.003 秒；音訊亦有該台成功回應 | 不推論長期穩定性 |
| HK04 01-05／2 倍，21:39:50.177 起 | FAIL | 先有 12 個影片直接 206，後續影片失敗；約 14.755 秒無進度，可信 emptied／loadstart 後位置 0 且暫停；Recovery 為 no-legal-video-route、reloadCount 未增加，窗口後才恢復原進度 | 網站清空／重載與腳本恢復失敗的根因及責任歸屬未確認 |
| HK05 01-01／1 倍，21:41:37.554 起 | FAIL | 有一次直接影片 206，也有影片失敗，之後由 mirrorali 接手；進度 +60.003 秒不抵消供片失敗 | 故障根因未確認 |
| HK06 01-01／2 倍，21:42:47.647 起 | 證據不足 | 影片 circuit-open，無該台合資格影片請求；保留限制 | 該台 2 倍影片供片 |
| OGV 第二集→第三集，一次下一集 | INVALID | 固定歷史入口 ep743313→ep743314；正片 ogv-playview 200／accepted=true，generation 1→2、epoch 維持 0；第三集靜音播放 17.419→56.236 秒 | Network 游標截斷；最後觀察比播放階段二十分鐘上限晚 1.789 秒，正向片段保留但不計完整核心通過 |
| 暫停／恢復及短 seek | 未執行 | 先前雙分頁補測有操作片段，單分頁重測未再完成獨立案例 | 不以換片或清理的暫停代算 |

正常八窗含間隔耗時 599.999 秒；香港準備完成至六窗收回 474.951 秒。OGV 本身 63.406 秒，但整個播放階段實際為 1201.789 秒，超出的 1.789 秒如實保留，不調整起點。21:45:17.422 轉清理，21:45:54.806 已完成瀏覽器資源還原；沒有占用原先保留的最後十分鐘，也沒有追加故障／效用矩陣。正常窗播放器實際尺寸包含 1920×1080／3840×2160；香港最後一台出現 1080p→720p→2160p 的 Auto 變化，原始逐筆尺寸與路線表示摘要均保存。

### 條件式證據、問題與清理

自然起播 gate 在開／關的新有效文件均因網站明確 XHR timeout 略過，只作相容觀察。未出現合資格健康輪、中段 Range、足夠家族排序樣本、待認領提前重試許可或自然 HTTPDNS 攔截證據；列「接線 PASS／行為證據不足」。14 窗提前重試 attempts 與腳本 reloadCount 均未增加，不推論原效用通過；原提前重試效用 **FAIL 保持**。

待調查問題的重現條件：CC39-R01 為 S2／P1／Auto／1 倍／提前重試開的 N05，窗口約第 8.708 秒開始 waiting、12.992 秒 playing；CC39-R02 為 S1／P1／Auto、固定並允許香港 01-05／2 倍／提前重試關的 HK04，約第 45.215 秒可信 waiting、第 50.310 秒 emptied／loadstart。CC39-R03 為香港 01-03、01-01 的合資格影片請求失敗與後續熔斷。這些均是有效失敗觀察；未確認為產品程式缺陷，不在驗收中修來源或解除限制。

清理 PASS：只還原本輪欄位與逐台覆寫，深層比對除 updatedAt 外與基準一致；fixedHost=null、Native=false、原線對照=false、提前重試=false、香港三台明確 false。退出前 rate=1、paused=true、muted=true。所有 14 窗自有訂閱／計時器／媒體監聽器已釋放，控制中心訂閱 Array(0)，靜音觀察器與除錯物件組／Debugger 移除，唯一分頁關閉且 IAB 清單為空；不清既有健康證據、限制或其他腳本。匯出 Blob 撤銷證據見上表，不再沿用先前 closure scope 不足作為唯一結論。

去敏證據位於本機忽略目錄 `.work/iab-testing/2026-10-31-v2.1.39-2794193-single-tab/`：EVIDENCE.json、14 個案例 JSON、ANALYSIS.json、含逐案 SHA-256 的 VERDICTS.json、settings-restored.png。每案含完整安裝身分、設定前提、起訖、原始事件、完整性及資源退出；未寫出媒體簽名 URL、查詢、權杖、Cookie、IP 或播放器／核心物件。前次補測另存 round2 目錄，雙分頁結果不覆蓋本次。14 窗共 PASS 4、FAIL 4、INVALID 4、證據不足 2；OGV 另列 INVALID。必要項目尚有無效、失敗及缺口，因此不宣稱核心驗收完成。

本次離線 docs:check、archive:check 與 git diff --check 均通過：241 Markdown／2522 本機與儲存庫連結，424 搬移檔、三份只追加日誌、123 不變檔、66 checksum／306 筆。七個不可變舊斷鏈、430 歷史原址限制、十八個私有引用與 412 外部未連線引用保持原限制。產品來源、測試、腳本、版本、依賴及 Release 無差異；沒有提交、推送或發布。

## 2026-10-31：一次授權的單分頁缺口補測

**本輪未完成核心驗收；這次授權的補測已完成。** 使用者另行明確批准一次最多三十分鐘的單分頁補測，只補總覽／移除項目、N01–N04、一次 OGV 與暫停／恢復／短 seek。已通過案例與先前有效 FAIL 不重測；上一節的 INVALID 原件保持，本節是新的獨立觀察，不能回填為舊窗口通過。

T0 為 **22:00:13.184**（Asia/Taipei），另存單調起點；最遲轉清理 **22:20:13.184**，硬截止 **22:30:13.184**。全程只使用 IAB 分頁 5，S1 與 OGV 共用同一分頁，沒有第二分頁、背景播放器或跨分頁同步測試。S1 與 OGV 新文件均核對完整 **507,387 bytes**／SHA-256 `583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3`、v2.1.39、Tampermonkey 5.5.1、唯一 Runtime／ControlCenter 及已安裝 Fetch／XHR hooks。使用既有安裝，沒有更新或重裝。

### 本次補測結果

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| 總覽緩衝、倍速、吞吐與需求餘裕 | PASS | 暫停時原生緩衝 73.791911 秒、2 倍速，UI 折算 36.9 秒；無容量排名時吞吐／餘裕顯示「—」。可信 UI 暫時固定現用 mirrorali02 後，自然既有資料 safeMbps=1.624019347、ratio=0.203002418，UI 為 1.62／0.20、需求 8.00 Mbps；隨後回自動 | 不追加探測、不製造上限或空資料；播放器完全沒有媒體的分支未自然出現 |
| 選定路線、影片／音訊主機及較早回應 | PASS | 選定 mirrorali02 與實際影片 mirrorali02、音訊 mirroraliov 分別對照；HTTP 206 與時間符合路線快照。自然等待後分別顯示 91／90 秒前及「較早的回應」 | 完全沒有回應主機時的文案未自然出現，不以來源閱讀代算該 UI 分支 |
| 四頁移除項目掃描 | PASS | 總覽／CDN／播放設定／診斷逐頁保存全部操作控件；沒有格式偏好、額外診斷詳記、手動測速、手動封鎖或香港定向驗證入口 | 執行路徑移除沿用既有來源／契約證據，本次不重跑產品測試 |
| 暫停／恢復與短 seek | PASS | 暫停前 2288.358404 秒，約 10.7 秒後仍相同；恢復後前進。可信進度列操作產生 seeking→seeked→playing，實際 seek 約 +2.93 秒，之後持續播放 | 點擊意圖為 +8 秒，但實際落點不同；僅按已觀察的短 seek 判定，不宣稱精確八秒 |
| N01 S1／1 倍／提前重試開，22:03:49.596 起 | PASS | 連續 60.001 秒，進度 +60.003 秒；完整網路與頁內事件，無卡頓／錯誤／重播／腳本核心重載 | 不推論提前重試效用 |
| N02 S1／1 倍／關，22:04:56.626 起 | PASS | 連續 60.005 秒，進度 +60.004 秒；同上 | 同上 |
| N03 S1／2 倍／關，22:06:03.690 起 | PASS | 連續 60.009 秒，進度 +120.021 秒；同上 | 同上 |
| N04 S1／2 倍／開，22:07:16.149 起 | PASS | 連續 60.003 秒，進度 +120.011 秒；同上 | 同上 |
| OGV 第二集→第三集，一次自然下一集 | PASS | ep743313→ep743314；準備至主觀察收回 57.738 秒，Network 無截斷。正片 ogv-playview 200／accepted=true、15 影片與 3 音訊表示；generation 1→2，epoch=0。第三集播放 100.471→118.175 秒，muted=true、無媒體錯誤 | 清理截圖另有「utils.playerReady 失敗」提示；來源與發生時點未確認，未據此推翻已直接觀察的換集／播放，也不忽略此提示 |
| 本輪還原與資源清理 | PASS | 22:13:37.718 開始、22:13:38.037 完成；除 updatedAt 外設定與本輪基準一致，rate=2、paused=true、muted=true。控制中心訂閱 0、自有觀察器／計時器／監聽器與除錯參照釋放，唯一分頁關閉、清單為空 | 本次未再次匯出，Blob 建立／撤銷沿用上一輪 PASS，不重測 |

四窗皆為 S1／P1／Auto，實際解碼 **3840×2160**；各 242 筆取樣，最長間隔 **258.4 ms**，所有樣本保持靜音與指定倍速，沒有兩秒無合格進度、媒體事件錯誤、設定漂移、影片元素替換或提前重試動作。影片與音訊當窗均有實際 206，主機分別為 `upos-sz-mirrorali02.bilivideo.com`、`upos-sz-mirroraliov.bilivideo.com`；原生 Network 與產品完成事件相符，沒有輸出原始媒體 URL。每窗起訖分頁數為 1，所有自有窗口資源到期釋放。暫停／seek、總覽固定選擇與身分斷點均在計分窗口之外。

只改提前重試、倍速與暫時固定欄位，可信 UI 操作後逐項還原；清理前無其他設定修改證據，不以舊整份快照寫回。香港三台明確 false、Native=false、原線對照=false 與其他五開關 true 保持。導覽依使用者更正立即靜音，觀察器只維持真實 muted 屬性；沒有修改媒體 getter、取消音訊下載、清冷卻或既有限制。維護、匯出、剪貼簿與遠端同步沒有重測。

### 保留問題與當前門檻

合併採用本節四個新窗口與上一節其餘有效觀察，正常播放為 **7 PASS／1 FAIL（N05）**；香港仍為 **1 PASS／3 FAIL（HK01／HK04／HK05）／2 證據不足（HK02／HK06）**。OGV 新觀察 PASS；舊四個 N 窗與舊 OGV 的 INVALID 均原樣保留。**核心仍未通過**，不能用補測成功抵消 S2 卡頓、香港供片失敗或熔斷下缺樣。

離線檢視 HK04 舊證據：香港 01-05 約第 33.771 秒影片失敗，後續 mirrorali 多次取消，45.215 秒 waiting、50.310 秒 emptied／loadstart。來源的 recoveryEligible 還要求計畫主機符合固定主機；因此固定 01-05 而網站走 mirrorali 的條件可能解釋恢復資格被拒絕，**這是來源推論，不是已確認根因**。`no-legal-video-route` 不能擴張解讀為整個 Catalog 無可用主機。舊 Network 失敗資料缺少可靠請求主機配對，不將一般 DNS 錯誤歸因到特定影片請求。CC39-R01／R02／R03 保留待調查；清理截圖提示另記 CC39-R04，不在本輪修產品。

自然 gate、健康輪、家族排序效果、提前重試許可撤銷與 HTTPDNS 攔截仍缺必要條件；剪貼簿與跨分頁同步本輪未執行。原提前重試效用 **FAIL 不改判**。沒有重開故障／效用矩陣或追加未授權輪次。

本機去敏證據在 `.work/iab-testing/2026-10-31-v2.1.39-2794193-single-tab-supplement/`：EVIDENCE.json、N01–N04.json、OGV.json、ANALYSIS.json、VERDICTS.json 及 settings-restored.png；逐案本體身分、起訖、前提、事件完整性、雜湊與清理結果均保存。舊 single-tab／round2 原件不改寫；來源、產品 API、設定結構、版本與發布檔未變。文件檢查結果另存 VALIDATION.json。

離線 docs:check、archive:check 及 git diff --check 通過：241 Markdown／2524 本機與儲存庫連結、424 搬移檔、三份只追加日誌、123 不變檔、66 checksum／306 筆。七個不可變舊斷鏈、430 歷史原址限制、十八個私有引用與 412 外部未連線引用保持原限制；沒有重跑產品驗證、提交、推送或發布。

## 歷史驗證導覽

<a name="發布與安裝限制"></a>

v2.1.38 完整正文已追加至 [歷史全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2138-完整正文保存2026-10-31)。其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

舊 v2.1.8 錨點保留作歷史導覽；不描述本版結果。

## 2026-10-30：UP141 安裝版實測

此相容入口指向 [v2.1.38 完整實測](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)，原始 FAIL／INVALID 與未完成窗口保持。

## 隔離 B 分支原型驗證（2026-10-30）

原型與獨立 FAIL 見 [歷史原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。

## v2.1.40 完整正文保存（2026-11-01）

以下原樣保存 v2.1.40 最新完整報告，包括原日期、安裝證據、未解根因、FAIL 與停止決策。現行版本見 [TEST_REPORT](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md)。

# BiliCDN_TW v2.1.40 固定 CDN 備援恢復修復驗證

日期：2026-10-31（Asia/Taipei）。基準 v2.1.39／27941936c79f86f60739f0e71e707ff7c9c35b55。使用者已移除 Bilibili-Evolved，另行批准根因調查、確認缺陷修復及最多兩次各三十分鐘的單分頁定向實測。

## 修復與根因

固定 CDN 是合法候選的選路偏好。舊 recoveryEligible 在選路器已排除失敗固定主機並選出合法備援後，仍要求計畫主機等於原固定偏好，因此阻止恢復。正式紅色契約已重現，修復移除這項重複限制；目前計畫身分、影片種類、generation／epoch、policy／authority revision、Vault 與禁止規則均保留。沒有 API、設定 schema、timeout、探測資格或恢復額度變更。

這能確認腳本的備援恢復缺陷，不能代替香港最初逾時、舊 HK04 網站 emptied／loadstart 或 N05 取消請求的根因證據。

## 自動驗證

新增 12 案契約通過：正常固定／合法備援、black／dead、停用、原線對照、政策／世代／授權更新、無合法候選、音訊隔離，以及真實 Monitor／Runtime／Recovery 閉環的進度取消與一次有界重載。型別與 114 模組架構通過。

完整測試初次只因沙箱不能寫入工具契約自有暫存 Git 設定失敗；正常授權環境的 tooling 重跑 599 案通過，未改測試期待。指定 Node 26.8.1 下完整 verify 通過：3022 案，零失敗／取消／略過／待實作；另通過型別、架構、格式、文件、封存、確定性建置、JavaScript 語法與暫存封裝校驗。沒有重開舊效用矩陣。

## 安全差異

Codex Security diff scan 8085f3df-8db2-422b-9c95-3bd30c6d58f9 已完成，零發現；凍結基準至修復來源／測試差異共兩個 source-like 檔案，既有四份報告文件另檢視。獨立架構檢視與父審查核對 current-plan、Vault、政策失效、禁止規則、Native／Catalog 邊界及 reload 所有權。掃描後僅加入版本／封裝及文件維護；執行期修復保持同一行差異。

## 來源隔離與實際安裝

舊完整報告見 [v2.1.39 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2139-完整報告保存2026-10-31)。其中 FAIL／INVALID 與提前重試效用 FAIL 原樣保留，屬移除前環境；既有 PASS 不重跑，也不跨版本宣稱新驗收。

修前取證 T0=23:03:28.220，最遲清理 23:23:28.220、硬截止 23:33:28.220；23:12:52.519 已完成清理。全程只有 IAB 分頁 6，新 S2／S1 文件核對 Tampermonkey 5.5.1、v2.1.39 完整本體 507,387 bytes、SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3、唯一 Runtime／ControlCenter 與 Fetch／XHR hooks。261 個 parsed scripts 的完整清單僅辨識到 BiliCDN userscript，未見 Evolved；S1 清單亦未見 Evolved。依使用者已確認的方法立即靜音，音訊下載保留，沒有媒體 getter 覆寫。

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| RCA-N05：S2／P1／Auto／1 倍／提前重試開 | PASS | 60.001 秒、242 筆；進度 +60.009 秒，無 waiting、失敗、取消或核心重載，影片 12 次 206、實際 3840×2160 | 舊卡頓未再現，原取消發起者未知；未啟動停用對照，不能判移除 Evolved 已解決 |
| RCA-HK01：預定 01-03／1 倍 | INVALID | 選單操作誤落 mirrorcos；起始 fixedHost 不符，保留偏差且未重跑 | 01-03 本輪失敗根因 |
| RCA-HK04：01-05／2 倍／提前重試關 | FAIL | 60.004 秒，進度 +120.010 秒；14 次該台影片 206，但約第 42.055 秒影片 timeout，後續 mirrorali 約第 47.338 秒亦 timeout；無卡頓／清空或腳本重載 | 最初逾時的網路根因、舊網站清空原因；流暢播放不抵消供片失敗 |
| RCA-HK05：01-01／1 倍／提前重試關 | FAIL | 60.005 秒，進度 +60.004 秒；一次該台影片 206，也有該台影片 timeout；其後其他 CDN 供片 | 該 timeout 的網路根因；起始前在途請求缺當窗 Native request 配對 |
| 獨立 timeout 歸因 | 證據不足 | 送出斷點讀到影片 XHR timeout=10000，堆疊由網站 core.9c6ca999.js 的 load／executeRequest 經 BiliCDN send／perform；當時提前重試關閉。原生 timeout 回呼斷點未再命中 | 不能把這筆備援請求的值回填為每次香港請求的精確 timeout／設定者 |
| utils.playerReady 被動觀察 | 證據不足 | 新文件未載入 Evolved，playerReady console 查詢 0 筆；未另開 OGV 或獨立重測 | 舊錯誤完整因果仍未知，未再現不作根因證明 |
| 自有清理 | PASS | 原設定逐欄還原；fixedHost=null、Native=false、提前重試=false、香港三台 false；rate=1、paused=true、muted=true；自有窗口／靜音觀察器、斷點與遠端參照釋放，中心訂閱 0、分頁清單空 | 本輪沒有匯出或剪貼簿操作 |

窗口均連續收取 Network，無截斷，頁內 250 ms 取樣；歸因斷點在計分窗口外。舊資料不能可靠配對的 DNS 錯誤沒有移植到新根因。自有去敏證據位於本機忽略目錄 .work/iab-testing/2026-10-31-cc40-root-cause/pre/，包含 EVIDENCE、四案原始 JSON、VERDICTS 與 settings-restored.png；舊兩輪 29 個證據檔的雜湊另存 .work/cc40/old-evidence-hashes.json。

## 公開交付與安裝結案

v2.1.40 已正式發布：[GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.40)。發布時 main／版本標籤均核對為 51d6b718a1e5735e91897e2d5c872baba005cd5c；唯一附件 BiliCDN_TW.user.js 為 507,322 bytes，公開 latest 實際下載亦為 SHA-256 0877ef16869c6270c613ae24ae71b50c358d99e765f70b3303fc412f574d8f58。發布快照保存當時待安裝狀態，不回寫；後續安裝結果見下節。

### 修後唯一 HK04 定向窗口

本輪 T0=23:28:05.228、清理界線 23:48:05.228、硬截止 23:58:05.228。公開使用者腳本入口只到 Tampermonkey 中繼頁，新文件仍完整載入 v2.1.39，當時沒有開始計分。使用者回覆已更新後，原分頁 7 已不存在且清單空；沿用原截止建立唯一分頁 8，沒有重疊分頁或重開輪次。完整載入 v2.1.40 的 507,322 bytes／SHA-256 與已發布附件完全一致，管理器 5.5.1、Runtime／ControlCenter 各一、Fetch／XHR hooks 正常。290 個 parsed scripts 的完整清單僅一個 userscript，未見 Evolved。

準備時播放器沿用舊片尾位置；文字「重播」點擊未建立有效區間，檢視實際父控件後，可信重播容器操作回到開頭。尚未開始計分的固定選單及暫停／播放狀態均讀回再修正；不以這些準備片段代算 seek／重播驗收或窗口。所有身分斷點在窗口前解除。

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| v2.1.40 實際安裝身分 | PASS | 完整本體、singleton 與 hooks 均核對，沒有使用舊版本計分 | 不代替所有功能重驗 |
| POST-HK04：S1／P1／Auto／固定並允許 01-05／2 倍／提前重試關 | 證據不足 | 23:34:20.616 起連續 60.001 秒、242 筆、最長間隔 258.6 ms；進度 +119.997 秒。Network 無截斷，無媒體事件、卡頓、影片元素替換、設定漂移或腳本重載 | 01-05 影片供片與自然恢復均未取得必要條件 |
| 該窗實際影片／音訊供應 | 證據不足 | 01-05 的影片排名明確 circuit-open，保留限制；影片全部由 mirrorali 供應。依時間／requestId 無歧義配對，mirrorali 影片直接 206 共 24 次，01-05 音訊直接 206 共 24 次 | 音訊不能代算香港影片供片。工具初步摘要只數 01-05 的全部 206，細分種類後已更正，不判完整通過 |
| 自然恢復行為 | 證據不足 | 計分窗 Recovery 全程 healthy、reloadCount=0；未自然觸發恢復 | 不能以流暢播放宣稱實機救援閉環通過；離線契約獨立支持本次修復 |
| 逐欄還原及清理 | PASS | 23:35:56.733 完成；設定除 updatedAt 外與更新後基準一致，rate=1／paused=true／muted=true、中心訂閱 0，自有窗口／靜音監聽／Debugger／遠端參照釋放，分頁清單空 | 無第三輪或額外重跑 |

修後收集器另保存安全 Range、Network requestId 及去敏來源函式／腳本檔名，沒有保存媒體 URL／查詢。新文件 playerReady console 查詢仍 0 筆，只作被動未再現觀察。證據在 .work/iab-testing/2026-10-31-cc40-root-cause/post/，含 EVIDENCE、POST-HK04、VERDICTS 及清理截圖；舊 29 個證據檔再次核對雜湊完全不變。

本次確認並修復的是合法備援恢復資格；N05 舊卡頓取消來源、香港最初 timeout 的網路根因及舊網站清空原因仍未確認。兩次有界實測均已結束，沒有追加第三輪。文件／封存與差異檢查在最後追加後執行，後續僅提交這些驗證記錄。

本次安裝結案時的離線 docs:check、archive:check、git diff --check 通過：243 Markdown／2597 本機與儲存庫連結、429 搬移檔、三份只追加日誌、128 不變檔、67 checksum／310 筆；七個不可變舊斷鏈、430 歷史原址限制、十八個私有引用及 422 外部未連線引用保持原限制。後續純文件整理的核對另按日期追加至維護與工具日誌，不算新的產品驗收。

**本次尚未完成全部根因調查或整體核心驗收。** 已確認的恢復資格缺陷與其他未解傳輸／網站問題分別判定；香港缺樣及原提前重試效用 FAIL 保留。

## 歷史驗證導覽

v2.1.39 完整正文已追加至 [歷史原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2139-完整報告保存2026-10-31)，保留各次工具受阻、移除前安裝、單分頁矩陣及一次授權補測。其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="發布與安裝限制"></a>

舊發布／安裝限制依版本保留，請由 [版本索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md#版本) 查原文；本版公開交付見上文。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[v2.1.8 完整發行驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-發行驗證--2026-10-04)。

<a name="2026-10-31更新後安裝核對"></a>

[v2.1.39 更新後安裝核對原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[v2.1.39 六十分鐘驗證原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[v2.1.39 靜音前提檢查點原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[v2.1.39 更正後靜音操作與工具超時原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[v2.1.39 單分頁重測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[v2.1.39 一次授權補測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="2026-10-30up141-安裝版實測"></a>

[v2.1.38 UP141 安裝版實測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[隔離 B 分支原型原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。以上相容錨點只提供歷史導引，不表示本版測試結果。


## v2.2.0 完整正文保存（2026-11-01）

# BiliCDN_TW v2.2.0 結構精簡與行為契約驗證

日期：2026-11-01（Asia/Taipei）。基準為 v2.1.40／1edfeaa6ad7a6b9dabc7d81da3b4414c3a31ba78。使用者批准完整重構、Native 新預設及正式 v2.2.0 交付；本次不恢復已停止瀏覽器案例。

## 變更與結構證據

| 項目 | 基準 | v2.2.0 |
| --- | --- | --- |
| 模型／介面契約檔 | 40 | 27；同功能共置，消費端直接匯入契約 |
| scripts 頂層檔案 | 31 | 6；其餘分為 checks／testing／evaluation／iab／lib |
| 數字情境分派套件 | 13 | 0；具名建立函式與每案獨立狀態 |
| CDN 初次頁面完整模型讀取 | 18 | 1；刷新亦共用當次模型，命令完成重讀 |
| 產品規則正文 | PROJECT_CONTEXT＋ARCHITECTURE | ARCHITECTURE 六部分；舊產品錨點只導引 |

契約檔盤點包含 model、port／ports 及 contracts；ControlReadModel 的執行實作不列為純契約。SettingsStore 單一布林預設表使新安裝、缺值、非法欄位及還原預設啟用 Native；既有 true／false 保留，schema 2、四鍵及讀取不寫入維持。Catalog-only 回歸顯式關閉 Native。

設定抑制／保存、逐欄失效比較、同步路線解析／組裝、恢復階段與 SDK 派送簡化；原單一所有者、等待後授權、取消、同步重入、晚到工作、恢復期限與額度保持。詳細契約見 [ARCHITECTURE](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/ARCHITECTURE.md)，專項評估操作見 [評估指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/README.md)。

## 自動驗證

固定 Node 26.8.1／npm 11.19.0 的完整 `npm run verify` 通過，3,050 個契約案例全部成功，failure／cancelled／skipped／todo 均為 0。其中工具套件 603 案、架構規則 41 案；另已通過獨立型別檢查、104 個正式模組的分層及無循環核對、匯入純度、確定性建置、語法、v2-only bundle 與校驗碼。

新預設、設定鎖等待／失敗／遠端更新、逐欄失效及單次 UI 快照均有具名案例。相同明確設定的選路、額度、事件順序、過期授權、同步重入、取消及晚到工作沿用原契約。13 份套件的 116 個測試宣告及其參數展開保持，唯一名稱變更是 Native 缺值案例由 default off 改為 default on；共用情境刪除與當案無關的前置設定與輸出，仍以 testScope 管理資源。

文件及封存檢查通過；保留七個不可變舊斷鏈、431 個歷史原網址限制與十八個未核對私有引用，外部 URL 未連網驗證。沒有本機私有搬移，不執行 `--local`；這些既有範圍限制不列為新通過項目。

## 安全差異

Codex Security 安全差異掃描 `e098a1e8-c94e-4dbc-a3db-d8ce98dfcfba` 已完成，範圍為 `1edfeaa6ad7a6b9dabc7d81da3b4414c3a31ba78..25a446c4ad05aef5344b9999e06e6cc5d3669fd0`；214 個變更清單項目核對完成，零可回報發現、零未結候選。選路、傳輸及恢復十五份關鍵檔案另有完整獨立審查。來源、授權、重入、取消、晚到工作、去敏及本機工具邊界依保留的威脅模型核對；這不是瀏覽器實測或「沒有任何漏洞」的保證。

掃描完成後正式 `src-v2/` 與掃描 head 相同；另修正三處評估工具搬移後的字串路徑，沒有改變授權或傳輸邏輯。八個上游雜湊輸入讀取及收集器離線建置通過，沒有執行收集器或啟動服務；最後完整 verify 再次通過。工作台保存封存結果與報告；其 rollout 用量為總計 16,289,220 tokens（含 15,619,328 cached input，輸出 59,747），此為工具彙整的六個執行緒用量，不另推算單次掃描淨用量。

## 公開交付

2026-11-01 02:23（Asia/Taipei）已發布正式 [v2.2.0 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.0)，不是 draft 或 prerelease，且為公開 latest。發布提交為 `49345bad6cdb9e49e7cf1420288e926d0ace11be`；遠端 main 與標籤解參照均核對至該提交，後續 main 僅追加本次交付紀錄。

| 核對來源 | 腳本版本 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| 本機封裝、遠端 main 原始檔、v2.2.0 標籤原始檔及公開 latest 實際下載 | 2.2.0 | 507,211 bytes | `abca87caeb995fb924f5869c8fd60accdfe250994b448607e22803a38a610a1f` |

四份腳本逐一下載／讀取後核對一致；Release 唯一附件為 `BiliCDN_TW.user.js`，GitHub 回傳的附件 digest 亦相同。[既有 latest 更新入口](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) 保持不變。Release 中的報告保留發布前檢查點，五份封裝原件已登記雜湊保護，不回寫。這些公開交付結果不代表 Tampermonkey 已安裝新版。

## 瀏覽器與既有證據限制

發布時未執行 IAB 來源隔離、Tampermonkey 實際安裝或播放驗收；2026-11-01 使用者另行授權後的校準結果見下節，不能以 Node 契約或工具能力代算產品通過。舊窗口不因新授權的一次有界驗收而恢復。

v2.1.40 的香港影片供片與自然恢復證據不足、N05 取消來源及網站清空根因未確認、提前重試原效用 FAIL 等結論完整保留於 [上一版完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。這次結構與預設變更不解決或抹除那些缺口，後續執行界線只看 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## v2.2.0 安裝驗收 R1（2026-11-01）

使用者表示內建瀏覽器已更新到 v2.2.0，明確要求設立目標並開始驗收。基準 HEAD 為 d84821b7a8652f37e96cbd14e2da6269f4d7b2ab，本機發行腳本雜湊與上列公開交付一致；安裝本體尚未取得，不能把使用者回報當成工具核實。

本輪先凍結 I220-01 身分、I220-02 設定／控制中心、I220-03／04 Auto 1／2 倍各 60 秒及 I220-05 清理，限同時一個自有 IAB 分頁。保守 T0=02:32:45、校準上限 02:40:45、清理保留起點 02:57:45、硬截止 03:02:45（Asia/Taipei）。未保存單調起點，因此不提出精確執行耗時；本輪沒有產品計時窗口。

以下是使用者澄清前、截至 02:39:25 的首次校準檢查點；其後未開始產品案例的續行結果另列於下節，不將工具窗口與產品窗口混合計分。

| 案例 | 層級 | 結果 | 實際證據與限制 |
| --- | --- | --- | --- |
| E220-READ | E | PASS | 無媒體文字頁上的 Runtime.evaluate 回傳 ready=complete、mediaCount=0 |
| E220-MUTE | E | PASS | 無來源合成 video 的真正 muted=true、paused=true；未替換 getter，不能代算新影片文件的靜音 |
| E220-NAV | E | INVALID | 預先注入 API 不支援；設置執行前斷點後的首次影片導覽沒有暫停事件，回報分頁不再屬於當前工作階段；已關閉，未取得新文件媒體或聲音輸出證據 |
| E220-PAUSED-EVAL | E | INVALID | 後續無媒體頁可取得 instrumentation 暫停，但 Debugger.evaluateOnCallFrame 及替代校準的 Debugger.setSkipAllPauses 逾時；這是助手所選方法的限制，不是使用者要求的必要靜音門檻 |
| I220-01 | I | 未執行 | 助手誤設起播前靜音門檻而未進行；未取得 GM_info、完整安裝本體、唯一 Runtime／ControlCenter 或 hooks |
| I220-02 | I | 未執行 | 未讀寫正式設定或操作控制中心，Native 保留與刷新只維持既有 Node 證據 |
| I220-03／I220-04 | I | 未執行 | 固定影片 Auto 1／2 倍窗口均未開始，沒有 video／audio Network 計分資料 |
| I220-05 | I | PASS | 僅對實際建立的校準資源：靜音守護停止、合成媒體／標記移除、Debugger 解除、唯一分頁關閉，最終清單空 |

初次游標為 69，未收到預期事件；新校準頁的同一游標 38→39→40 分別收到 scriptParsed 與晚到 paused，truncated=false、hasMore=false。替代校準最後游標 49；這些是 debugger 能力證據，不是產品 Network 連續性。Page.addScriptToEvaluateOnNewDocument 與 raw Page.navigate 明確回報不支援；後者按工具指示改用 tab.goto，沒有更換瀏覽器或繞過安全拒絕。暫停的解除成功，正常執行時的真正靜音成功。助手當時將「新頁起播前可可靠完成」當作必要條件，這個額外條件已由下列使用者澄清更正。

02:39:25 前完成清理讀回：guardStopped=true、media=[]、Debugger.disable 成功，IAB 分頁清單空。沒有修改正式設定、倍速、播放器 getter、帳戶／瀏覽器設定，沒有故障攔截或受控學習樣本；沒有要求前景、啟動本機服務、另開外部瀏覽器或追加產品窗口。第一次失效導覽缺少媒體讀回，不能宣稱已完成無聲播放驗證。

**本輪核心安裝驗收未完成，沒有確認產品缺陷。** 只完成環境校準中可獨立證明的項目與清理。原始有界摘要保存在本機 `.work/iab-testing/2026-11-01-v2.2.0-d84821b-r1/` 的 BASELINE、CASES、TIMELINE、CLEANUP、CHECKPOINT、RERUN 與 REPORT；不包含簽名網址、憑證或播放器物件。

### 靜音要求更正

2026-11-01 使用者再次指出，只要求靜音，沒有要求起播前已靜音。[2026-10-31 19:05 原紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時) 已明確記載「起播後立即靜音」，並成功用真正 HTMLMediaElement.muted 屬性操作及讀回。助手卻沿用較舊的「導覽前先確認」摘要，再自行增加預注入／執行前暫停門檻，錯把所選方法受限推論為安裝驗收必然受阻。

撤回這個額外門檻及據此要求新工具能力／重複批准的結論；正確做法是導覽／起播後立即靜音並讀回，後續維持靜音，最初未確認區間不算計分窗口。工具逾時、清理與未執行結果保留，不因此改判 PASS；本次更正沒有執行新的瀏覽器窗口，也不重開原 [範圍與期限](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md#v220-安裝版驗收範圍)。

### 澄清後在原期限內續行

使用者將目標恢復 active 後，於同一原期限內續行先前未開始的產品案例。只建立一個自有 IAB 分頁；導覽後立即使用真正 muted 屬性及讀回，首次讀值 muted=true、paused=true、readyState=0；其後媒體正常播放時仍 muted=true。自有 MutationObserver／volumechange 僅維持真正靜音，沒有 getter 替換、前景要求、本機服務或音訊下載抑制。這條方法成功，證明先前「必須有起播前注入／暫停能力」的停止理由不成立。

| 案例 | 結果 | 預期／實際與證據範圍 |
| --- | --- | --- |
| I220-01 安裝身分 | PASS | Tampermonkey 5.5.1、腳本 2.2.0；實際載入完整本體 507,211 bytes、SHA-256 與公開附件一致；RuntimeController／ControlCenter／TransportAdapter 各一個，Fetch／XHR hooks=true、state=installed |
| I220-02 設定與 CDN 畫面 | PASS | 既有 Native=false 保留，畫面正確顯示預設啟用說明；可信滑鼠操作 false→true→false，命令完成後模型與 checkbox 一致且未停留 disabled。原設定逐欄還原，僅 updatedAt 因真實寫入改變 |
| I220-03 Auto 1 倍媒體觀察 | PASS（僅媒體） | 計分區間 02:56:19.135–02:57:19.135，前後各 10 秒；60 筆每秒樣本全部 muted=true、rate=1、正常播放且同一媒體，無 paused／ended／seeking／error。Auto 實際 3840×2160，首末採樣進度 59.000165 秒、影格 10497→14034，最大採樣間隔約 1002.3 ms |
| I220-03 完整傳輸窗口 | INVALID | 同一 Network 游標共讀 163 事件、最大讀取間隔 12,307 ms，最後回報 truncated=true；雖觀察到 video 17 筆及 audio 16 筆 206，不能宣稱完整請求／完成時序。分類以當次 playurl 音訊／影片路徑在記憶體比對，原值不輸出或持久化 |
| I220-04 Auto 2 倍 | 未執行 | 剩餘時間不足在 02:57:45 清理起點前完成另一個含前後置的 80 秒窗口；沒有縮短、重開計時或追加輪次 |
| I220-05 清理 | PASS | 02:58:01.248 完成：設定除 updatedAt 外還原，rate=1／paused=true／muted=true，觀察器與窗口已停止、中心已關閉、Debugger／Network 已解除、遠端物件群組已釋放，IAB 自有分頁為 0 |

完整本體核對後只以正常 PlayerMonitor.tick 斷點短暫取得 GM_info 與既有實例，立即解除並 resume；身分暫停時間不計入播放窗口。原入口點擊／返回導覽仍沿用跳過決定，開啟中心使用既有 show，不冒充入口 UI 驗收。單次完整快照及未要求報告時不計算詳細證據仍依正式 Node 契約；本輪未另包裝產品方法計數。

本輪最終 **核心驗收未完成**，原因是 I220-03 的 Network 截斷及 I220-04 時間不足；沒有確認新的產品缺陷，也不把影片穩定進度補算完整傳輸通過。證據為本輪私有目錄的 CONTINUED_EVIDENCE.json、screenshots/native-restored.png 及 screenshots/playback-cleanup.png；先前校準原件與更正記錄保留。

### Auto 2 倍補充與本次驗收結案

使用者其後明確選擇「新增 15 分鐘完成 2 倍案例」，限定未開始的 Auto 2 倍、新文件必要身分核對及清理；已通過功能不重測，1 倍 INVALID 不重跑。補充輪 T0=2026-11-01 03:09:32.195（Asia/Taipei）、主機單調起點 2201008.1549 ms；清理保留起點 03:19:32.195、硬截止 03:24:32.195。實際清理於 03:15:25.983 前完成，單調經過約 353,787.8 ms，未占用截止後時間。

| 項目 | 結果 | 實際證據 |
| --- | --- | --- |
| 新文件身分 | PASS | Tampermonkey 5.5.1／腳本 2.2.0；完整本體 507,211 bytes、SHA-256 與公開附件一致，RuntimeController／ControlCenter／TransportAdapter 各一個，Fetch／XHR hooks installed |
| I220-04 Auto 2 倍媒體觀察 | PASS（僅媒體） | 真正播放器選單切至 2.0x，原生 rate=2、muted=true；Auto 實際 3840×2160。計分區間 03:12:41.533–03:13:41.533，前後各 10 秒，總觀察 80,001.7 ms／81 筆，計分 60 筆全部靜音、2 倍、正常播放且同一媒體，無 paused／ended／seeking／error |
| 2 倍進度 | PASS（僅媒體） | 首末採樣進度 117.995722 秒、影格 11323→18394；最大採樣間隔約 1001.7 ms，最小逐筆媒體進度 1.988972 秒 |
| I220-04 完整傳輸窗口 | INVALID | 全事件批次合計 5,138 筆，其中保留 123 筆去敏媒體 Network 摘要；首批與後續批次 truncated=true，最大讀取空隙 53,687 ms，超過凍結的 15 秒上限。沒有本機容量丟棄，仍不能宣稱完整傳輸通過 |
| 有限傳輸觀察 | 僅保留觀察，不補算完整性 | 保存的事件中 video 20 筆／audio 21 筆均為 206，主機分別為 mirrorali／mirrorcos；首批包含較早緩存事件，不把這些數量當成完整 60 秒窗口的精確總數 |
| 設定、倍速及清理 | PASS | 全部腳本設定（含 updatedAt）與本次開始一致；確認最後寫入仍為 2 倍才用真實選單還原 1 倍。讀回 rate=1／paused=true／muted=true、觀察器及窗口停止；Network／Debugger／物件群組解除，IAB 自有分頁為 0 |

Network 缺口是本次收集執行不符合凍結條件，不能推定產品缺陷：游標先建立後未在啟動觀察前重新排空，首批已截斷；其後模型／工具呼叫間又留下約 54 秒空隙。將讀取改成全事件、只保留去敏 Network 摘要，或解除身分 Debugger，都不能補回已遺失事件。批次陣列保存每次實際時間、游標、count／hasMore／truncated；統計從此陣列重算，避免跨工具呼叫的原始值變數與函式閉包讀值不一致。清理後的證據組裝變數名稱錯誤已修正，沒有重複瀏覽器動作或改寫採樣。

原始去敏證據保存於 `.work/iab-testing/2026-11-01-v2.2.0-5fbffbc-rate2/EVIDENCE.json` 及兩張 screenshots；不保存簽名網址、路徑、查詢、憑證或播放器物件。1 倍原 INVALID、舊故障／背景／跨分頁限制維持，不追加窗口。

**本次授權的有界驗收執行及紀錄已完成，整體核心驗收仍未通過。** 已證明 v2.2.0 安裝身分、設定／控制中心，以及 Auto 1／2 倍的正常靜音媒體播放；兩個完整傳輸窗口均為 INVALID，不能宣稱全項或完整網路驗收通過。沒有確認需修改產品的新缺陷，不升版、不改寫 Release。

## 歷史驗證導覽

[v2.1.40 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01) 保留全部原始觀察與停止決策；其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="bilicdn_tw-v2140-固定-cdn-備援恢復修復驗證"></a>

[BiliCDN_TW v2.1.40 固定 CDN 備援恢復修復驗證：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="修復與根因"></a>

[修復與根因：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="來源隔離與實際安裝"></a>

[來源隔離與實際安裝：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="公開交付與安裝結案"></a>

[公開交付與安裝結案：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="修後唯一-hk04-定向窗口"></a>

[修後唯一 HK04 定向窗口：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="發布與安裝限制"></a>

舊發布／安裝限制依版本保留，請由 [版本索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md#版本) 查原文；現行版公開交付見上文。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[v2.1.8 完整發行驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-發行驗證--2026-10-04)。

<a name="2026-10-31更新後安裝核對"></a>

[v2.1.39 更新後安裝核對原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[v2.1.39 六十分鐘驗證原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[v2.1.39 靜音前提檢查點原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[v2.1.39 更正後靜音操作與工具超時原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[v2.1.39 單分頁重測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[v2.1.39 一次授權補測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="2026-10-30up141-安裝版實測"></a>

[v2.1.38 UP141 安裝版實測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[隔離 B 分支原型原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。以上相容錨點只提供歷史導引，不表示本版測試結果。


### v2.2.0 判定範圍更正（2026-11-01）

原始 INVALID、工具事件缺口與助手誤設起播前靜音門檻的操作錯誤完整保留，不改成 PASS。已核實的安裝身分、設定操作及 Auto 1／2 倍媒體進度各自成立；完整 Network 取證失敗只限制請求時序／目的地結論，不能概括為腳本核心功能失敗。診斷不是產品主要目的，v2.2.1 已依使用者要求撤除全部診斷與原線對照；舊窗口不重跑。


## v2.2.1 完整正文保存（2026-11-01）

以下原樣保存換版前完整報告，包含發布與另行授權的 R1 結果；不改判原有缺口。

# BiliCDN_TW v2.2.1 診斷撤除與保留功能驗證

日期：2026-11-01（Asia/Taipei）。基準為 6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb／v2.2.0。

## 變更

完整撤除診斷錄製、事故／請求／提前重試歷程、緩衝趨勢、報告產生／複製／匯出、診斷頁、剪貼簿授權與分頁原線對照。診斷專用評估與 IAB 收集／插樁／判定工具退出正式來源，固定提交可追溯原碼。

控制中心保留總覽、CDN、播放設定三頁；總覽數值、詳細狀態與單次刷新快照保留。正常選路、Native 開關、學習、量測、提前重試、停滯／備援恢復及整體停用保留。設定 schema 2、四鍵、Native 預設 true 及既有布林值不變，不遷移或清除使用者資料。

## 自動驗證

固定 Node 26.8.1 完整測試已通過 1,598 案，failed／cancelled／skipped／todo 均為 0。相較 v2.2.0 的 3,050 案，淨減少 1,452 案，來自撤銷診斷、緩衝評估、IAB 工具、剪貼簿與原線對照專用案例。混合案例直接驗證狀態及副作用；新增三個退役原碼追溯工具契約，另將舊混合案例的音訊禁止、XHR 單次送出／送出前限制重查、需求餘裕門檻恢復為三個獨立功能案例。三頁與移除操作的新契約先於來源修改執行並確認失敗，修改後通過。

型別、91 個正式模組的架構／循環檢查、完整測試及最終 verify 已通過；verify 包含格式、文件、封存、匯入純度、確定性建置、語法、移除標記與封裝校驗。封存核對 439 個搬移項目、56 份閱讀版；三份追加日誌保留原始前綴，v2.2.0 完整報告原文及五份 Release 原件保持。七個不可變舊斷鏈、434 個歷史網址限制、十八個私有引用未核對、外部網址未連網驗證分開記錄；未執行本機搬移或 local 模式。

## 安全審查結果

Codex Security 差異掃描 `4409e3da-7ffc-4ce3-baa0-74dc4a4aa090` 已完成並封存，範圍為 `6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb..5cc72ee9dede4dd91d3a0de1b1228f81758bbe8d`。149 個來源清單項目加 26 個其他變更路徑全部核對，包括基準中的刪除檔；零可回報發現、零未結候選。Native／Catalog 授權、恢復 token、重入與晚到提交、可信 UI、工具 Git／檔案邊界均完成審查。

掃描後只修正文案／metadata 說明、恢復兩個誤改的間接開發依賴版本文字，以及補回上述三個功能測試；正式 TypeScript 與掃描 head 相同，bundle 執行本體逐字一致。最終鎖檔相較基準僅產品版本改為 2.2.1。後續變更已人工核對並通過完整 verify。工作台統計為 21,828,144 tokens（含 20,986,496 cached input，輸出 66,876）；這是工具回傳的整合統計，不換算為計費金額。Daybreak 權限不可用，使用可用的標準靜態差異流程；安全審查不代替安裝實測。

## 發行產物

v2.2.1 腳本為 419,507 bytes，比 v2.2.0 的 507,211 bytes 減少 17.3%。SHA-256：`e89b94bb92eecb818ce038f09c1de2b9fb5db8b2ffa35adb2357141384db149d`。

封裝快照保存當時自動與安全驗證；公開交付讀回及後續安裝驗收由本頁接續記錄，已發布快照不回寫。GitHub Release 只附唯一使用者腳本。

### 公開交付讀回（2026-11-01）

正式 [v2.2.1 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.1) 已發布並設為 latest，非草稿、非預發布。發行提交及標籤解參照均為 `1e4e70cccf13e0dea1346c1fbd89d44dad063ce1`；推送時遠端 main 同步至該提交，後續 main 僅追加交付紀錄。

公開 main 腳本、v2.2.1 標籤腳本與 latest 下載均獨立讀回：版本 2.2.1、419,507 bytes、SHA-256 `e89b94bb92eecb818ce038f09c1de2b9fb5db8b2ffa35adb2357141384db149d`，逐位元組等於本機封裝。Release API 確認附件只有 `BiliCDN_TW.user.js`，大小與 digest 同值。五份儲存庫封裝檔、建置輸入雜湊及 Git blob 均已核對；發布後不回寫封裝快照。

發布階段交付完成；當時未操作 IAB、未更新管理器安裝版，也未恢復已停止的播放或故障窗口。之後另獲授權的 R1 安裝驗收記錄於下文。

## 安裝與歷史判定

上述發布階段未啟動瀏覽器、安裝或播放窗口。使用者更新後另行授權的 v2.2.1 R1 安裝驗收見下節。一般播放與設定驗收依直接產品行為判定，不要求診斷工具或完整 Network 成功；特定問題缺少時序只限制該問題結論。

v2.2.0 全文與追加更正見 [歷史完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v220-完整正文保存2026-11-01)。原 INVALID 與操作錯誤不改 PASS，已通過的播放及設定不被工具失敗概括否定。既有未解問題、效用 FAIL 及停止決策由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

## v2.2.1 R1 安裝驗收（2026-11-01）

使用者已更新內建瀏覽器腳本，並明確要求設定目標開始驗收。本輪基本安裝／操作與播放範圍 **PASS**，七項核心案例及清理全部通過；這不代表所有條件式恢復或效用已實測。

範圍先凍結為單一 IAB＋Tampermonkey 分頁、既有基準 BV1tFZZBQE57／p1、Auto 1／2 倍各一次完整 60 秒、三頁介面及必要設定操作。保守 T0=04:19:28（Asia/Taipei），總上限 30 分鐘、04:44:28 起只清理、04:49:28 硬截止；04:28:06 已完成清理。首次工具清單未同時取得主機單調值，後續 BASELINE 另存單調檢查點，不冒稱精確 T0。沒有要求前景、啟動本機網站服務、改畫質或增加故障窗口。

| 案例 | 預期與實際證據 | 結果 |
| --- | --- | --- |
| I01 安裝身分 | 實際 Tampermonkey 5.5.1／腳本 2.2.1；Runtime、ControlCenter 各一個實例；hookState=installed。完整 IIFE 執行本體 417,570 bytes／SHA-256 a78a15a782ec46a73fa36787431b14a349ccb54b1baf870ff022860508acafa4，大小及雜湊均與已發布腳本本體一致；管理器包裝與 metadata 另分，不誤稱整份包裝等於附件 | PASS |
| I02 三頁與總覽 | 實際開啟總覽、CDN、播放設定；沒有診斷、報告、原線對照入口。總覽可播放緩衝、安全吞吐、需求餘裕、影音回應及最近狀態存在；詳細狀態可展開，列出攔截、量測、恢復／備援、提前重試與路線資料 | PASS |
| I03 Native 保存 | 原值 false；可信 UI 切為 true，當前模型、勾選狀態及 GM 儲存皆 true；再以 UI 還原 false，三者一致。既有明確 false 維持，不以新版預設覆蓋使用者設定 | PASS |
| I04 播放設定保存 | 原提前重試 false；可信 UI 切為 true，勾選、模型及 GM 儲存皆 true，再還原 false。三頁均可正常切換；未執行清除學習或還原預設 | PASS |
| I05 Auto 1 倍 | 04:25:00.253–04:26:00.255，共 62 筆、60.0022 秒；媒體前進 60.001291 秒，增加 3,597 影格，音訊已解碼位元組增加 779,574；3840×2160，緩衝最低 28.07 秒 | PASS |
| I06 Auto 2 倍 | 04:26:25.286–04:27:25.289，共 62 筆、60.0035 秒；媒體前進 120.009266 秒，增加 7,193 影格，音訊已解碼位元組增加 1,319,336；3840×2160，緩衝最低 25.93 秒 | PASS |
| I07 還原與清理 | 設定記憶體與 GM 保存值逐欄等於原設定，僅正常保存時間戳更新；1 倍、paused=true、muted=true。讀取計時器自行截止並移除，Debugger 斷點／暫停解除、物件群組釋放，自有 IAB 分頁關閉後清單為空；無自有攔截、產品包裝或 Network 訂閱 | PASS |

兩個播放窗口均為同一媒體、無 paused／seeking／ended／error、所有樣本真正 muted=true；最大採樣間隔分別 1,002.9／1,003.3 ms，未觀察到連續兩秒無時間及影格進度。每秒以原生媒體讀值核對；靜音沒有取消音訊下載，音訊解碼量持續增加。1 倍掉幀增量為 0，2 倍為 769，僅記錄本輪外部驗收的媒體採樣結果；腳本沒有掉幀收集或顯示功能。本輪沒有設定掉幀通過門檻，不據此推定 CDN 故障或宣稱零掉幀。

導覽後立即對真正媒體靜音並讀回，當時播放器尚為 paused；後續播放與清理保持靜音。這次沒有增加起播前靜音、預注入或先暫停腳本的必要門檻。Debugger 只在窗口前短暫取得身分，斷點移除後恢復並停用；暫停時間不計入播放窗。

工具限制另記：DOM／AX 快照未呈現封閉 Shadow DOM，使用同一 IAB 的受控 CDP 讀取既有節點，依實際可見控制項座標送出可信滑鼠輸入；沒有以直接命令呼叫代算 UI 通過。一次 28 秒等待受到工具約 20 秒外層截止，頁內有界讀取仍連續完成且自行清理；以原同一份完整資料核對上述最大間隔，沒有重跑或拼接窗口。Debugger 初始事件讀取曾截斷，已取得的完整腳本本體與實例證據各自核對；沒有把此工具事件缺口當一般播放失敗。

自然健康量測、提前重試接管、備援重載／位置倍速還原及實際目的地完整時序本輪未驗證；固定 CDN、禁止規則、整體停用、背景與跨分頁同步也沒有新增安裝版案例，沿用各自既有契約及限制。本輪不宣稱其實測通過，不恢復 P01／P02、BR-01 或舊效用窗口。原提前重試效用 FAIL 與未解問題不變。

原始去敏證據與畫面保存在本機 `.work/iab-testing/2026-11-01-v2.2.1-ff65595-r1/`。PLAYBACK-1X.json SHA-256 為 ca5eecd1da7ad21506279c6a46dc5c56a0409d79f671ff56887e62e16fe0d3ff；PLAYBACK-2X.json 為 38fd64f957e8a8716795954b49a51df8188928084f41429632c5a9053caf1cc7。公開文件只保存有界結果，不輸出簽名網址、憑證、IP 或播放器物件。

<a name="歷史驗證導覽"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#歷史驗證導覽)；現行內容以本頁正文為準。

<a name="公開交付與安裝結案"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#公開交付與安裝結案)；現行內容以本頁正文為準。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#隔離-b-分支原型驗證2026-10-30)；現行內容以本頁正文為準。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#bilicdn_tw-v218-release-verification--2026-10-04)；現行內容以本頁正文為準。

<a name="修復與根因"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#修復與根因)；現行內容以本頁正文為準。

<a name="來源隔離與實際安裝"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#來源隔離與實際安裝)；現行內容以本頁正文為準。

<a name="安全差異"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#安全差異)；現行內容以本頁正文為準。

<a name="發布與安裝限制"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#發布與安裝限制)；現行內容以本頁正文為準。

<a name="修後唯一-hk04-定向窗口"></a>

此舊入口只指向 [v2.1.40 的 HK04 原始窗口](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)，不是本版 R1 或目前待補案例。

<a name="2026-10-30up141-安裝版實測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-30up141-安裝版實測)；現行內容以本頁正文為準。

<a name="2026-10-31更新後安裝核對"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31更新後安裝核對)；現行內容以本頁正文為準。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31六十分鐘驗證計畫執行結果)；現行內容以本頁正文為準。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31iab-可用但持續靜音前提受阻)；現行內容以本頁正文為準。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)；現行內容以本頁正文為準。

<a name="2026-10-31補測與單分頁重測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31補測與單分頁重測)；現行內容以本頁正文為準。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31一次授權的單分頁缺口補測)；現行內容以本頁正文為準。

<a name="v220-安裝驗收-r12026-11-01"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#v220-安裝驗收-r12026-11-01)；現行內容以本頁正文為準。

<a name="澄清後在原期限內續行"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#澄清後在原期限內續行)；現行內容以本頁正文為準。

<a name="auto-2-倍補充與本次驗收結案"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#auto-2-倍補充與本次驗收結案)；現行內容以本頁正文為準。

<a name="公開交付"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#公開交付)；現行內容以本頁正文為準。


## v2.2.2 完整正文保存（2026-11-01）

以下原樣保存換版前完整報告，包含公開交付與第二階段盤點銜接；原始判定及限制不變。

# BiliCDN_TW v2.2.2 診斷殘留清除與保留功能驗證

日期：2026-11-01（Asia/Taipei）。起點為乾淨 main／`65c2dc0e201c5e986f0254524814419294e35e88`；先保護行為契約，再清除 A01–A03。原 [v2.2.1 清查報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/CODE_AUDIT_POST_DIAGNOSTICS_v2.2.1_2026-11-01.md) 保留原文；本版結果承接其階段門檻。

## 清除結果與零殘留範圍

確認診斷專用流程、契約、失去用途的診斷測試支架為零；新增確認殘留及待釐清項目均為零。此結論限定下列 211 份正式來源、宣告、metadata、測試與工具，以及由入口建置的正式 bundle。不是以關鍵字清零代替用途判讀。

| 項目 | 完成內容 | 保留契約與證據 |
| --- | --- | --- |
| A01 | 移除 DomainEvent 中沒有產生者／消費者的 transport、route-observed 成員 | TransportObservation 與 route-planned／route-decision／request-started／route-confirmed／recovery 等功能事件保持；影片備援仍交由 Runtime 觸發恢復，音訊不觸發影片重載 |
| A02 | 移除 RouteSnapshot.planCount 型別與快照計算，正式 bundle 無此計算 | 私有 #plans 及各表示計畫保留；40 組保存 representation／decision，逐組以嚴格身分驗證重用與 decisionRecord 所有權；同步重入驗獨立 decision-2、事件順序及外層返回後重用 decision-1 |
| A03 | 移除 orchestration 的 comparison 狀態／存取器／賦值，以及 observeRetry／_observeRetry 參數與轉傳 | 原案例名稱與選擇器保持；Native 失效順序、影音隔離、Runtime 釋放及 clearLearning 的 evidence→restrictions→meta 次序仍直接斷言 |

正式 TypeScript 差異只有上述三處刪除，沒有改寫授權、傳輸、選路分支或設定。三頁控制中心、總覽全部數值與詳細狀態、單次刷新共用快照保持。Native 預設 true、既有布林值、schema 2、四個儲存鍵不變，沒有資料遷移。

### 必要保留與非殘留判定

| 類別 | 產生／寫入與消費 | 判定 |
| --- | --- | --- |
| N01 選路學習與現行計畫 | TransportObservation／主動量測寫入 EvidenceStore；rankRoutes、選路確認與 circuit 讀取；#plans 由 RouteCoordinator 提交並用於各表示重用 | 必要功能，不是診斷歷程 |
| N02 媒體進度與恢復 | player-media／player-controls 讀取 totalVideoFrames 與真正時間；Monitor／Recovery 比較進度、期限、還原階段及 token | 必要控制狀態；掉幀 mock 的 0 僅補全原生型別，沒有掉幀收集器 |
| N03 當前總覽 | TransportContext 維護當前計數、最後一筆摘要；ControlReadModelPort 單次 snapshot 供三頁刷新；詳細文字按需建立 | 使用者要求保留的畫面資料，沒有報告／匯出／剪貼簿管線 |
| N04 提前重試協作 | XhrEarlyRetry 的有界在途速率與 timedout／claimed 交接，供 EarlyRetryController 判定目前許可狀態 | 真正重試所需的短期控制資料；不是事故錄製或診斷歷程 |
| N05 功能事件 | Routes 發布 recovery；Runtime 核對 video／當前資格後 armRouteFailure；ControlReadModelPort 訂閱更新畫面 | 保留影片恢復交接；只供畫面刷新的投影留待發布後分析，未提前重構 |
| N06 合法 Native／原網址 | SignedRouteVault 授權當前內容的精確 URL；正常 original／root-original／inspectOriginal 用於合法傳輸與禁止判定 | 正常來源政策，不是已撤除的分頁原線對照 |
| N07 離線工具與否定契約 | Node reporter／testScope 管理測試輸出；上游比較固定載入歷史版本至 Node VM；verify 及 UI 測試檢查撤除標記不存在 | 通用測試與歷史相容用途；不進產品、不啟動網站服務，不因名稱誤刪 |

舊 DIAG 案例前綴、diagnostic 表示鍵與不必要的情境鏈，經追查實際執行的是保留的選路／總覽契約；它們不建立診斷流程。命名及前置狀態負擔交由第二階段分析，不把一般待整理程式碼誤列為確認診斷殘留。第二階段已在公開發布核對完成後展開並交付整合報告，本版未實作 O01–O04；發布後結果見下方公開交付段落。

## 自動驗證

Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2，沿用鎖定版本。先完整閱讀 npm 命令及工具，確認沒有本機網站服務；verify 的封裝驗證只用暫存目錄並清理。

多群組案例在移除產品欄位前先執行，所有 40 組決策斷言通過，最後「快照不再含 planCount」斷言如預期失敗；刪除欄位後同案通過。routing convergence 八案與 orchestration 38 案通過。原 1,598 案完整執行通過，failed／cancelled／skipped／todo 均為 0；沒有新增或刪除保留功能案例。

首次完整測試因沙箱禁止工具測試在暫存 Git 配置寫入而失敗；相同命令在允許暫存 Git 寫入後通過 1,598 案。這是工具權限限制，原失敗保留於本機工作紀錄，沒有改產品或降低斷言。

最終 verify 已通過；包含固定工具配置、格式、文件、封存、型別、架構、完整測試、匯入純度、兩次確定性建置、語法、移除標記及暫存封裝校驗。

| 契約面向 | 現有直接驗證 |
| --- | --- |
| 三頁與畫面資料 | control-center：三頁／撤除入口、總覽與詳細狀態、CDN 建構／刷新各一次 snapshot、失效視圖不更新 |
| Native／Catalog／固定／禁止／停用 | state、native-routing、native-transport、progressive-routing／transport：保存值、預設、禁止聯集、送出前政策重查及停用原請求 |
| 恢復與影音隔離 | orchestration／application、CC40／R04：影片備援觸發恢復、音訊獨立；恢復額度、位置、倍速及一次補正 |
| 過期授權／重入／取消／晚到 | routing convergence、BR-02～05、SR1／SR2、量測儲存／生命週期回歸：當前身分與事件順序、取消原因及失效後拒絕提交 |
| 資源釋放 | testScope、FakeClock、匯入純度與 UI 訂閱清理；沒有新增專用收集器 |

### 安全差異

已核對相對起點的完整產品差異：兩個未使用事件型別刪除、一個快照欄位型別刪除與該欄位投影刪除。正式 bundle 相對 v2.2.1 只改版本標頭並刪除一行 planCount 計算，其他位元組一致。沒有修改授權或傳輸分支，依風險規則本次不觸發新的 Codex Security 掃描；原 v2.2.1 安全產物及原判定保留，不冒稱本版新掃描。

## 發行產物

v2.2.2 腳本 **419,470 bytes**；SHA-256：`ffece767ff55ddcd08db7fb286189d49cf6bd4d4e141dd283648b6d29548bd08`。相對 v2.2.1 減少 37 bytes，僅為移除投影的產物差異，不宣稱實測效能收益。建置資訊清單仍有 80 個輸入：74 個來源 TS 與六個建置／配置檔；其餘 19 份來源亦已全文閱讀，metadata 由建置前置。

前版五份 Release 原件已按原位元組移至 archive/retired/releases/Release/v2.2.1/；原始大小與 SHA-256 全部保持。換版前完整 TEST_REPORT 原樣追加至 [歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)，包含後續 R1 安裝結果；三份既有日誌原文只追加。先保存搬移清單快照，再更新本版適用範圍。

### 公開交付與安裝結案

本節為封裝前檢查點；公開 main／標籤／唯一附件及 latest 下載核對由發布後接續記錄，已發布的五份封裝快照不回寫。

2026-11-01 發布後追加：正式 [v2.2.2 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.2) 已發布，非 draft／prerelease，並為 latest。發布時遠端 main 與標籤所指提交均為 `f4cc2e45689b5b9c4b0e99d82f65be38d7600132`；標籤物件為 `49f4da56426a6c86e6f3b1c21f529524ae7518cc`。GitHub Release ID `430365704`，唯一附件 `BiliCDN_TW.user.js`（asset ID `697337978`）。

獨立下載公開 main 原件、v2.2.2 標籤原件、版本附件及 [latest 腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，四者都與本機正式腳本逐位元組相同：版本 **2.2.2**、**419,470 bytes**、SHA-256 **ffece767ff55ddcd08db7fb286189d49cf6bd4d4e141dd283648b6d29548bd08**。GitHub 附件 digest 亦一致。

完成上述公開核對後才以該提交開始第二階段，[整合盤點報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/POST_DIAGNOSTICS_INTEGRATION_v2.2.2_2026-11-01.md) 只分析、不實作。後續 main 的文件提交與發行提交分開；v2.2.2 標籤及五份 Release 原件不變。本段為現行報告追加，不回寫封裝快照，也不改原 v2.2.1 清查結論。

### 來源隔離與實際安裝

本次依指示沒有啟動瀏覽器、更新安裝版、播放或故障窗口，v2.2.2 安裝驗收 **未執行**。離線通過不代表實機通過；不恢復停止輪次。v2.2.1 R1 已通過的範圍保存在 [當版全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；既有未解問題、效用 FAIL／INVALID 與永久禁令保持。

## 全文閱讀覆蓋清單

實際清單：來源／宣告／metadata 93 檔、測試／回歸／支援 90 檔、工具 28 檔，共 211 檔、58,535 行。按連續範圍逐段閱讀全部 379 頁，無截斷頁或缺頁；完成後再次核對實體 SHA-256。下表記原始位元組雜湊，範圍為一基行號；關鍵字與引用搜尋只作輔助。

| 檔案 | 完整連續閱讀範圍 | SHA-256 | 用途與結論 |
| --- | --- | --- | --- |
| `src-v2/adapters/fetch-hook.ts` | 1–194；195–276 | `b8d52918c182b2738bc957bec4fa004790d5eba4772f5c060801e811d167cacb` | Fetch 正規化、單一讀取器與取消 |
| `src-v2/adapters/navigation.ts` | 1–33 | `c8fa3a0d201ff649199c93469284b57312829d25c52e948df61ac4a7bb562a27` | SPA 導覽與自有包裝清理 |
| `src-v2/adapters/page-playinfo.ts` | 1–116 | `9de1d6998e99847b6bdc3deec64ada08721797538a404126d837620b7873d3a8` | 頁面 playinfo 低信任來源與同步處理 |
| `src-v2/adapters/player-controls.ts` | 1–245；246–473；474–707；708–955；956–1181；1182–1410；1411–1419 | `d6bf36495ace49a57fe481759f0f99d9905ca476b0f0e1953fa29033aeace548` | 可信操作、修訂、還原所有權 |
| `src-v2/adapters/player-media.ts` | 1–151 | `acd45f9fecd1eb51e8e87722296b4eb8c304dbe7715cfd29a5f2de558570a114` | 真實媒體快照與總影格進度 N02 |
| `src-v2/adapters/player-method.ts` | 1–42 | `691f0becb27af0e53e9f52a53ce6a3bdd46e42db18e8a5b66bc5ca7aea87c012` | SDK 方法描述子及包裝所有權 |
| `src-v2/adapters/player-sdk.ts` | 1–14 | `d7fe4b1ce5b0c375525f57d8bd46b67a724b309b490ba3f657b3f8654bd1b6fb` | SDK 與核心讀取／呼叫 |
| `src-v2/adapters/player.ts` | 1–133 | `6c8f67fbcbd9f5ffa832151275c934a7ba15d3f1aaa699e8679d5c8334bf9981` | 播放器適配與恢復執行 |
| `src-v2/adapters/playurl.ts` | 1–203；204–232 | `b41474dcabd3817fcdfa1552247457ec67fcfd30cd274147f9ee848835f3b22d` | playurl 適配與生命週期 |
| `src-v2/adapters/range-probe.ts` | 1–115 | `49f363fbde6fb628fa31c45240dcc383870377ad2dd9f8fa1a4ed4e15d066281` | 有界 Range 主動探測 |
| `src-v2/adapters/scheduler.ts` | 1–15 | `e3ffcfe1ae9c448db862a5e0610ec01ca89a511d3d8e224933fe862e9421f319` | 注入式排程與取消 |
| `src-v2/adapters/transport-context.ts` | 1–239；240–329 | `a91f19b567b60b4856edd5890b238b6026a245302297af11c0218acf010feba3` | 當次請求歸因、總覽計數 N03 |
| `src-v2/adapters/transport-ports.ts` | 1–29 | `8f26c3ff470310266cd78c8df4d545636a53cb67a120163fa23969b47fee704b` | 傳輸窄契約 |
| `src-v2/adapters/transport.ts` | 1–123 | `354a872b80a91ae7c9118a238dbce612be4c2a4efeb8028374c3f4622d3f4b70` | Fetch／XHR 安裝、回復與釋放 |
| `src-v2/adapters/visibility.ts` | 1–114 | `f783b2929cf085b4281dd946fcac4f18c9ba6b21860e850db2ac2dfed7b5abf4` | 可見性適配 |
| `src-v2/adapters/webrtc.ts` | 1–78 | `679615d4f687ef6ef7e2f9067387f97151b5f49bfa804e243d76c6e616614c0b` | WebRTC 設定適配 |
| `src-v2/adapters/xhr-early-retry.ts` | 1–221；222–458；459–483 | `74e9eb897eeb9ef46df9e2e416fd44c925ecc112deb24b671419ec7b36a95171` | 單次 XHR 提前重試交接 N04 |
| `src-v2/adapters/xhr-hook.ts` | 1–198；199–401；402–623；624–667 | `5067077063b462bcf7454ef72ffbf07c8788221e26ee94bdd0d3fbfd062558cc` | XHR 原生差異及重入防護 |
| `src-v2/adapters/xhr-request.ts` | 1–72 | `504106cf4489562ddf0b4f0127c279b0945839b8e766d4ea55858372b612080f` | XHR 請求正規化 |
| `src-v2/adapters/xhr-response.ts` | 1–88 | `c0f26cb247c8bfa1bd1590c48064072eed98173f8b4a25df057b38a65064512a` | XHR 回應轉換與當前摘要 N03 |
| `src-v2/adapters/xhr-values.ts` | 1–92 | `279e619587cd96b3ef93df642de10f14af6ca62826cfb088c397d567ce76096e` | XHR 原生欄位處理 |
| `src-v2/application/control-commands.ts` | 1–35 | `b487446e9f1d975e900e600d993de78cf4c0a216c540e4dc3e4e818ae7514343` | 設定及清除學習命令 |
| `src-v2/application/control-ports.ts` | 1–21 | `7bd5903e96a39f7a79741c6b433e96669237932e74ebad2dc0bd39e86bb7cb54` | 保留命令契約 |
| `src-v2/application/early-retry-contracts.ts` | 1–148 | `af5e8c94a3e539bc6c283df73dbe88ba0828905b0fca8789cd90a1f029aec4e7` | 提前重試功能契約；未接線窄介面 O03 |
| `src-v2/application/early-retry-controller.ts` | 1–224；225–291 | `5ab7d093f5a1de9119b4c5625772c9182ad56668efd1c020729336a192ff46cc` | 提前重試當前狀態與次數 N04 |
| `src-v2/application/lifecycle-controller.ts` | 1–108 | `f29d25c9e82d7f7fc4796cc7e3435369993a193d4e451617999003c948a2c8c1` | 內容生命週期組合 |
| `src-v2/application/lifecycle-ports.ts` | 1–14 | `1b9ff043e83e4fa9057f0751cab4d6a4a5df1ab17d30a58ab8a9d28bf43159c1` | 生命週期窄契約 |
| `src-v2/application/measurement-contracts.ts` | 1–72 | `bc45358d72022fe8030910fb828d7ab05fae9d312f97a37d1187eb1e1ed4c00a` | 量測資格、當前狀態契約 N04 |
| `src-v2/application/measurement-controller.ts` | 1–251；252–484；485–696 | `5db69642aa687a6bf933b78b3edab275ff03592ce046add02dafd1c7ab445ae1` | 起播與健康探測、額度及清理 N04 |
| `src-v2/application/monitor-contracts.ts` | 1–76 | `9b7300efc66da03648088f7baea351b026d90a9e9981f2f1c5d51fbfc3bc427c` | 監控狀態契約 N02 |
| `src-v2/application/player-monitor.ts` | 1–242；243–477；478–537 | `b049d14ce58f33ba14911431765155955be7496b1ed4f045bb61df3bbdd3f863` | 一秒監控、進度、備援及取消 N02 |
| `src-v2/application/playurl-contracts.ts` | 1–63 | `566d1fb5a15be9c496589b86779375732139c78fac65bc8aa20378bef8709d34` | playurl 內容與授權契約 |
| `src-v2/application/playurl-controller.ts` | 1–217；218–286 | `214c8ae00eac8e0332dc04dbd4071eaf9e4e0c038af71adc09677d232c4a600c` | playurl 正規化與內容週期 |
| `src-v2/application/ports.ts` | 1–104 | `f0153e91ea7c6351c5fc23ba8d061bca9ab957ce08bce53cf5470fb0d3ea15d2` | 播放器、排程與探測基礎契約 |
| `src-v2/application/recovery-contracts.ts` | 1–108 | `6913126b7d0eaf0aa40e89ea1572593c706ffd63c840d66a27e0e95f1ce6b16c` | 恢復階段與所有權契約 N02 |
| `src-v2/application/recovery-controller.ts` | 1–280；281–511；512–737；738–956；957–1021 | `cd8e602c9029863e3664f1fa36d867db6275ef4c8c8554cd89c0e370361bb141` | 單次恢復、位置／倍速／播放還原 N02 |
| `src-v2/application/route-contracts.ts` | 1–232 | `4ee36ea40f6439a6e2b4bc22b0251e23102073ae08ec4fcf8d63080f6b9b34e5` | A02 已關閉；保留現行計畫與總覽資料 N01/N03 |
| `src-v2/application/route-coordinator.ts` | 1–247；248–466；467–705；706–926；927–1138；1139–1346；1347–1556；1557–1803；1804–1899 | `099817f2c00d6681822e15f8d57c8e12cd868d133ee3676f090c9e181f96a469` | A02 已關閉；#plans、選路學習與恢復事件保留 N01/N05 |
| `src-v2/application/routing/candidate-planning.ts` | 1–125 | `b535ea5fb63581f1f8dae29c1896e5ae8f549512ff88b5e7dce478aa9e4e53f1` | 候選選路及規劃 |
| `src-v2/application/routing/player-output.ts` | 1–147 | `7e716a5e5b6008bb63339a77a2bd6cd39d3df71c1a2de8cb461f1b4d4b2ef93c` | 合法播放器輸出與備援 |
| `src-v2/application/routing/request-routing.ts` | 1–62 | `1f2dabee294f9c21b8b4fe3e5a45c69668a85178dba0bf6336ce9602688cff4b` | 當次請求選路 |
| `src-v2/application/routing/route-materialization.ts` | 1–57 | `c7312a72c606cee9d4fad52a5d16e4cf2a502a9dccc1dbfa885959360347440b` | 精確授權路線實體化 |
| `src-v2/application/routing/route-restrictions.ts` | 1–82 | `777b55649123c37db41d22f8a527f21c9f67679b15952660bdc1a65ad6f5cf0e` | 禁止規則與資格 |
| `src-v2/application/routing/routing-ports.ts` | 1–46 | `ac3492df5c0490003ea9ebdc9447fc9ff4b11197345fbdfa1745b909163235c7` | 選路政策窄介面 |
| `src-v2/application/routing/transport-result.ts` | 1–102 | `5f44af33147e7ea2b957507d5700d6a5999ecba930e8fa7abb6ebfd49e5cf71f` | 傳輸結果至選路學習 N01 |
| `src-v2/application/runtime-controller.ts` | 1–84 | `3e1848387f30d85d691809772a8cb7bff90bfbd54bcbd2386ee1c79bded92965` | 影片備援事件轉交恢復 N05 |
| `src-v2/application/runtime-ports.ts` | 1–25 | `c137be4467d501c9784db9c82eb6b936ddba142a8f22d1d193a6280acdbdf1f7` | Runtime 窄契約 |
| `src-v2/domain/catalog.ts` | 1–60 | `da8c155d165c642d27ee0d5663978dc47f052627c13fd3fc4eb686ecc1100ad0` | 可信內建 CDN 清單 |
| `src-v2/domain/early-retry.ts` | 1–91 | `04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37` | 提前重試純資格判定 N04 |
| `src-v2/domain/evidence.ts` | 1–125 | `09536c6b455bfb322e75e6b1dc464ddba3e52e35c22609a10e3435d5dcc7fdfc` | 有界速度學習與熔斷 N01 |
| `src-v2/domain/model.ts` | 1–238 | `daaf9d880d85d51e1c74afef6f606386e1aba6044b4be5a360963845ca753c51` | A01 已關閉；保留 TransportObservation 與功能事件 N01/N05 |
| `src-v2/domain/playback-progress.ts` | 1–29 | `ce5c9ae64922b62655e20b97f798da38d5ee1c2b68f3a85f83a304ff2b02af82` | 時間／總影格進度比較 N02 |
| `src-v2/domain/player-output-plan.ts` | 1–97 | `87b54160afadd86b14fa61c644b1d66c09e318752321fcf12f4280aad6ba8dab` | 播放器輸出純規劃 |
| `src-v2/domain/playurl-content.ts` | 1–80 | `f7ea073fcadf47c69f1e3041d64211462dd9098f98642228d7d53263d914887d` | 內容目錄與指紋生命週期 |
| `src-v2/domain/playurl-model.ts` | 1–22 | `d6a8eee3a41291cebc65194a6523d454c22947ef9c0813d228d74c9be22d597b` | 播放資料格式契約 |
| `src-v2/domain/probe-model.ts` | 1–5 | `4549d113c83233f0ea3615ef701f05a94215df08af613f0fdc3e54f3890e8e03` | 探測結果契約 |
| `src-v2/domain/probe-range.ts` | 1–43 | `7cf9b62c33ae30f5bbd6f6db4e50e5badc35b1fa0bfedfe46dfd8bfb425b8121` | 探測範圍純規劃 |
| `src-v2/domain/route-policy.ts` | 1–47 | `73ce25cc3f5bfbb07246487bd0f0ff5b509f18c8176e5f7834ad47358fbc15e5` | 選路政策純判定 |
| `src-v2/domain/routing.ts` | 1–234 | `4afc33e629e7da0c38a635289c661055e7952057d4856e2aa3e6ddd1bf164dc5` | 排名與需求餘裕 N01 |
| `src-v2/domain/transport-model.ts` | 1–47 | `7db42b25b0770a9d9b0665f5b7d686ddaa643f654dcfffbdecad5f512d253538` | 傳輸當前摘要契約 N03 |
| `src-v2/domain/url-policy.ts` | 1–107 | `22de63bea2e0a0255c85711b8aecb05629628d1eac81c55a6e438bdf384b360f` | 媒體 URL 分類及合法原網址 N06 |
| `src-v2/entry.ts` | 1–173 | `be89b5a181dd2223224db79b52f8cbfb3fc49b1ee536369840cf65c2f77cc4c9` | 唯一入口組合；沒有診斷注入 |
| `src-v2/globals.d.ts` | 1–12 | `1b8cb3275e13390b6dc043286fd95afbad90cff72219c35a1fbe840d5b0088c9` | 平台全域宣告；無剪貼簿宣告 |
| `src-v2/metadata.txt` | 1–39 | `ee6ec6d2929cd23cf6660f21ad1e90a1b9304e3594c97ac829ad9b820a0add68` | 腳本 metadata；無剪貼簿授權 |
| `src-v2/platform/runtime-id-port.ts` | 1–3 | `5e36145e91f90bb44b95d9a48727b9df672aadd88f0014c15c1c7533d56e1f32` | 執行個體 ID 窄契約 |
| `src-v2/platform/runtime-ids.ts` | 1–20 | `0f23e774e77bd29f7917a839fa07cd012af5a32fedf82bd8fc887bb63e1a7d6e` | 執行個體 ID 建立 |
| `src-v2/platform/storage-port.ts` | 1–7 | `d87da38f7797216eefd7d91391cb5fecb8265921deb7d1f4e769f3b970f08a62` | 儲存與鎖契約 |
| `src-v2/platform/storage.ts` | 1–47 | `1f4bd90d5d709d0eef64152ad6f3a2c7d1267e08d03c504a7cc0afa6d1859d8d` | GM 儲存、鎖、訂閱與清理 |
| `src-v2/state/evidence-ports.ts` | 1–14 | `14e8688e5437689932303ca27c35fa9285411ca6448c4c16207c6f64e826ea4a` | 選路學習窄契約 N01 |
| `src-v2/state/evidence-store.ts` | 1–193 | `bbc5e57574e9bd479b448c9ab0f2d5599af9ad0c1bbbec2eeaa99b8eab2a8389` | 有界選路學習持久資料 N01 |
| `src-v2/state/measurement-meta-ports.ts` | 1–11 | `6b5b29ef3600940bd7282a7c40766fb5c42ad477757a289dd3c12477fe3c1c64` | 量測 metadata 窄契約 N04 |
| `src-v2/state/measurement-meta-store.ts` | 1–47 | `687634317bbca20d0434ef1b70186bbac58f5aff3300d0d4e00929d265da90f6` | 探測游標／冷卻與鎖 N04 |
| `src-v2/state/restriction-contracts.ts` | 1–27 | `5af87a6620869e2e0558c43dc1bf0534d4bb8bffa4d878d8444b3727e68e6399` | 禁止資料契約 |
| `src-v2/state/restriction-store.ts` | 1–163 | `99d6a2858422df8e94e221950f7f9eb713519a81098fd0eefbf48de7bc7589fc` | 禁止資料與遠端合併 |
| `src-v2/state/session-contracts.ts` | 1–27 | `5a4d84b961cac8a2057b64f59cd19b9bbf66cd9343a7f482229685122fd00be7` | Session 契約 |
| `src-v2/state/session-store.ts` | 1–66 | `85ac2878cfc33b82f4a704642d83d66f893097a0bafd77f32b906e1efde61ef6` | Session 與內容週期 |
| `src-v2/state/settings-contracts.ts` | 1–34 | `91e636c43e289e59546b5091ef2c69f3e5884c84c1919bc3a1acbedc32085a52` | schema 2 設定契約 N06 |
| `src-v2/state/settings-policy.ts` | 1–26 | `2d3bd64447891ddee7991f8c523f7b80daa230480b1c3a60e7b28930c53ce881` | 逐欄設定失效比較 |
| `src-v2/state/settings-store.ts` | 1–192 | `ba60bb9750a6bf606bffd5a9844c866321559d325c2f9ce77455514e7f9e2f8f` | 設定預設、抑制與鎖 N06 |
| `src-v2/state/signed-route-vault.ts` | 1–216；217–448；449–484 | `24d5f7bc9dc46a1758478a251f5ac075465c0f52e40736692d35f59143d63322` | 唯一簽名授權索引 N01/N06 |
| `src-v2/state/vault-contracts.ts` | 1–92 | `4d7b27000906baea4a9b21ce8a68e5f90719d66b317720e3eeacd8dab07bb66a` | Vault 不透明授權契約 |
| `src-v2/ui/cdn-view.ts` | 1–93 | `4c9f3a2f0d4e43a8b2ea8491d2c9a50b3d891c9bb9f9121debc9e6f93f51c825` | CDN 當次共用模型 N03 |
| `src-v2/ui/control-center.ts` | 1–231；232–236 | `c78731d7dc1df0f7e70db7264fe10230fb9e78ab27e87847777a2109a2969093` | 三頁與單次刷新 N03 |
| `src-v2/ui/control-contracts.ts` | 1–96 | `2b7968ef5e728830cf3601c8bb154c30079ff1ff7c3025f7f46761778f56772a` | UI 契約候選 O02；非報告管線 |
| `src-v2/ui/control-read-model.ts` | 1–32 | `1d10441be0394bdf20424f3b1b0610a6886c9e9f48ee7d3d7e4a79516674e7a0` | 唯讀模型／功能通知 N03/N05；候選 O02 |
| `src-v2/ui/elements.ts` | 1–32 | `b56e1315765050b1fee98563ccd1a01e195dc7eee109e15b828a7d0651a67e7f` | UI 元件 |
| `src-v2/ui/labels.ts` | 1–132 | `aba4bee094132ccbeb10472d855c593a228f7305f0352dc1f8164b3e4286e617` | 當前狀態標籤 |
| `src-v2/ui/overview-view.ts` | 1–172 | `08ba2f29dfb89f3f8a055619ecba0228119d4432479098aafa2e6e2521c21f10` | 總覽數值及按需詳細狀態 N03 |
| `src-v2/ui/player-panel.ts` | 1–73 | `011ae453e4d6dce5972eb07af28a46971e411d3bed7f7ed4d37d7909fe6006a9` | 播放器面板入口 |
| `src-v2/ui/setting-controls.ts` | 1–43 | `182c5a6a38c15ff92655cbc176afa37f3f61fba1e018e5789d193a6de212afcd` | 共用開關與可信命令 |
| `src-v2/ui/settings-view.ts` | 1–91 | `aff368ae2a54bc14017e1aea695b26971577de3c2608db0085b922f4d112fda5` | 六項設定畫面 |
| `src-v2/ui/status-summary.ts` | 1–123；124–150 | `f00ac55b7395bfcf4dd2788a0ef49bb9ea3ad142bba75f8b34702e7e8e798dd9` | 按需詳細狀態文字 N03 |
| `src-v2/ui/styles.ts` | 1–33 | `5e15f6ad9faa3f4b86f02fc73d45eed61fcc7ae3472de9cdca427cf63965112c` | 三頁控制中心樣式 |
| `tests-v2/domain-boundaries.ts` | 1–233 | `4f55e04ded32cc7efec4c04d0ef4d3c06a743ac77d5f7b6c88d1e67af686e9d7` | 純領域邊界；數字 fixture／無效敘述觀察 O04 |
| `tests-v2/domain-progress-convergence.ts` | 1–70 | `f9342a97763d1507e360ffa46ba46139fb0fa3d521156148227f502ae84ff209` | 時間與影格嚴格邊界 N02 |
| `tests-v2/imports.ts` | 1–12 | `f03ab24f3498d7b5421f3ec2402d367cf70957fc9f60c1b0af92145d2afa911a` | 全部非入口模組匯入純度 |
| `tests-v2/regressions/archive.ts` | 1–197；198–401；402–610 | `df9650dd907ce8137b1eabe012d8a3520b71497e57f8893789715d348c4f42fb` | 封存原件與追加保護 |
| `tests-v2/regressions/cc39-integration.ts` | 1–127 | `c3858c471f06708a11a95aa0efeb4bf1ba7d0b6b244d51f3eb0a84c3eda53e46` | 控制命令、設定失效與接線 |
| `tests-v2/regressions/documentation.ts` | 1–226；227–407；408–601；602–799；800–871 | `1b997018bf7db148bb6693d85779215a71f7f490668d73e88a9b468dca93c120` | 文件分類、退役來源與連結保護 |
| `tests-v2/regressions/functional-races/adapter-controls.ts` | 1–212；213–331 | `0507b45e769ac04a8ef70223be75c8fcc14fe9279d6fdfa988a01c58eaa82379` | 導覽、可見性及包裝清理 |
| `tests-v2/regressions/functional-races/br01-followthrough.ts` | 1–240；241–517；518–781；782–924 | `fceae29dea8a33729112efcbc163040d5d5562cf1608f52839b3342b018186c9` | 重載後可信操作與續行；固定掉幀欄位 N07 |
| `tests-v2/regressions/functional-races/br01-play-intent.ts` | 1–298；299–400 | `1c8441db410812493d06562b1f0b29ea425e913123461bcf4c261e37ea4c9be9` | 可信播放意圖與取消 |
| `tests-v2/regressions/functional-races/br01-player.ts` | 1–167 | `f2bf4a7e0a3b3b2b5bb020c81d3b4c175b60dc7db5b9fd5f5237838e5c7037d9` | 播放器 SDK／原生落點與重入 |
| `tests-v2/regressions/functional-races/br01-reload-controls.ts` | 1–260；261–516；517–690 | `876e730d18fdc32a2afb60fbf15c8a90b6d94b65813197e21ab6a189b5459ed9` | 重載控制方法所有權與清理 |
| `tests-v2/regressions/functional-races/br01.ts` | 1–274；275–475 | `6da57b64c24f457a71186a7ee79f03abcf5316dcb69ff5a73d593091f3acee57` | 恢復觸發、額度及期限 |
| `tests-v2/regressions/functional-races/br06.ts` | 1–260；261–540；541–802；803–1052；1053–1311；1312–1539 | `e74ba593411491b9ff6288036af46926911adb1782bf7667e5f29e32d4b5823d` | 新尋位意圖撤銷舊恢復 |
| `tests-v2/regressions/functional-races/br08-player.ts` | 1–259；260–471 | `ca342d77a49770655d7b8dfe22738aa0e888346106c401f80d1e7037541bec48` | 拖曳與播放器控制適配 |
| `tests-v2/regressions/functional-races/br08.ts` | 1–263；264–536；537–767 | `24a94b0b9c93b28540d42fbc2b3e6dbf83f9dde0b1e306b6e33e473b9e404c18` | 拖曳期間不得恢復 |
| `tests-v2/regressions/functional-races/br09.ts` | 1–279；280–507；508–653 | `c97a25a0a0d5d0f8d953f26fd19c7d520dc91e9aaaa9f0260c99518f267edf49` | 歸零目標撤銷舊位置 |
| `tests-v2/regressions/functional-races/content-domain.ts` | 1–117 | `31e3b8395f6221b41360292749edb185e4cfc680ca92caf14b7436ea15157271` | 內容目錄歷史上限與汰換 N01 |
| `tests-v2/regressions/functional-races/content.ts` | 1–204；205–381 | `ad46827191cf1253cbd0d3e55f6512f12d63932cd4ff3cea80fc99622708ad24` | 內容週期、低信任資料與晚到工作 |
| `tests-v2/regressions/functional-races/cr-measurement-errors.ts` | 1–53 | `fca970add230f345899b5ab81b7090f6b5d6cf59917f676d661b9e1af97aec3a` | 量測保存失敗及未處理拒絕 |
| `tests-v2/regressions/functional-races/cr-measurement-lifecycle.ts` | 1–158 | `e3554170207cefd395eade990e0c30b62eac336cf8361324c8dee76a706b3c53` | 量測重入與生命週期 |
| `tests-v2/regressions/functional-races/cr-routing.ts` | 1–196；197–226 | `7d273b68587a827aa33845619c0d10a28d0e66911c7df228fdb583a26456d98c` | 選路授權及重入競態 |
| `tests-v2/regressions/functional-races/cr-startup.ts` | 1–157 | `a9cd2377844daa153d9ca41cbea3b1485024ce28218cbdbd95c7dccbfe636778` | 起播工作與清理 |
| `tests-v2/regressions/functional-races/cr-xhr-fixture.ts` | 1–183 | `0d483d67dcb751bae93ffe223e468e95ac209ddfe8e47867f3902d1a8c7de23f` | XHR 合約情境資源 |
| `tests-v2/regressions/functional-races/cr-xhr-headers.ts` | 1–96 | `617f08c5e73e1fdbaebb4e49987578524461837b36da556e006adb646c7b1332` | XHR 標頭及原生行為 |
| `tests-v2/regressions/functional-races/cr-xhr-send-conversion.ts` | 1–86 | `fdcbdf4294ba77b18099a2294ea0a482f853b5fff0bf9f66a740ffafe6c3d940` | XHR send 轉型重入 |
| `tests-v2/regressions/functional-races/measurement-metadata.ts` | 1–226；227–489 | `41b31aae59fc476d5c454f98409eb4265014e04780f7778f095af47f00aa5a90` | 量測 metadata 與遠端協調 |
| `tests-v2/regressions/functional-races/player-convergence.ts` | 1–242；243–425 | `a9984661f87df4e8e5314e5e3f3106b4795bd2de43c8b042f2a46dc125fa37d9` | 播放器收斂與所有權 |
| `tests-v2/regressions/functional-races/recovery.ts` | 1–243；244–469；470–682 | `07b8df6fe46ab5277c9740a4b2609377e695198f42c17c5d2f86017b5fda1acc` | 恢復取消、額度及舊工作隔離 |
| `tests-v2/regressions/functional-races/rescue-goals.ts` | 1–216；217–229 | `73c3b4d4fd8dec0172421cf8819b0dc14da3f2e271166309bda4aabca763466e` | 位置還原目標 |
| `tests-v2/regressions/functional-races/rescue-position.ts` | 1–159 | `c5e96862c0b3f9326d1850200f8e3f633aa576c53cb355e44070cc6815857e93` | 可信位置與實際副作用；Node trace N07 |
| `tests-v2/regressions/functional-races/rescue-recovery.ts` | 1–254；255–291 | `a8a195047dbc5e05e0b4e427372794e75bab338bc7d23f2076615c5ed4831a2d` | 恢復階段與取消 |
| `tests-v2/regressions/functional-races/rescue-runtime.ts` | 1–262；263–302 | `15b65b0c1184ad5bb62dffcff99fc25d7c21214c1062a31aae5f4924de53d696` | 影音備援隔離與功能事件 N05 |
| `tests-v2/regressions/functional-races/rescue-sustained.ts` | 1–76 | `3f2fef002391bf669175baa4b86bc71d6432ad9e605f73e71a5be34d1aa205c6` | 逐秒恢復後進度；測試樣本 N07 |
| `tests-v2/regressions/functional-races/rescue-timing.ts` | 1–260；261–303 | `3d16e6652410663759d7959c1a7aeb77263d22ca17d638baf1ee3bb890d54c45` | 恢復原有時序及期限 |
| `tests-v2/regressions/functional-races/restore-closed-loop.ts` | 1–222；223–388 | `c30eece30807066dee5f06e3fa0e9f8c95ffc2af62b198dbe5acd03fbc411913` | 還原閉環與失效 |
| `tests-v2/regressions/functional-races/restore-ownership.ts` | 1–49 | `201b187315dc0d0b99954f5f3086bcfb3fde5981779f5a2fa1b936beedcc57ed` | 使用者操作優先權 |
| `tests-v2/regressions/functional-races/routing-convergence.ts` | 1–233；234–421 | `feb94b160f31c0bd1b79dbce22c82357fa6170389bbf1feba560db28185d90f5` | 獨立內層決策、事件 ID／順序與外層提交重用直接斷言 |
| `tests-v2/regressions/functional-races/routing-fixture.ts` | 1–75 | `740a3b8b1d0bb6e4b02efd4069745ae6cb8b69052302bab197889e24862086f1` | 具名選路基礎情境 |
| `tests-v2/regressions/functional-races/routing-modularization.ts` | 1–144 | `116774c3a445c206f7844f613bdd45a28151b7240c882a65ece130017abeff1a` | 選路模組化契約 |
| `tests-v2/regressions/functional-races/routing.ts` | 1–207；208–280 | `6bc660b049dc57d343393fe43a0c5e62b6ccb2555f9630bd9c38a82d3a33b788` | 選路及儲存競態 |
| `tests-v2/regressions/functional-races/runtime.ts` | 1–246；247–265 | `d06b34ef51772c84843d0ae8d9991a07ff3e7f0612ec72388fe451b6ac418ebd` | Runtime 影音備援、設定與清理 N05 |
| `tests-v2/regressions/functional-races/startup-abort.ts` | 1–119 | `f9c326206880fa815a675324a0586877143010b708b54c2a35f96a4a7136f518` | 起播等待取消及原因 |
| `tests-v2/regressions/functional-races/up141-backups.ts` | 1–175 | `0e7bd7e4d8e26e8943f7f8bde4eef3550eb7cad566c4fa993d62754b978989e5` | 備援家族排序 |
| `tests-v2/regressions/functional-races/up141-probe.ts` | 1–223；224–243 | `9643dc259a5aee75f564e8eb8ba089f05fb699ca2748ab59889803c9451e3aa5` | 健康探測範圍與節流 |
| `tests-v2/regressions/functional-races/up141-start.ts` | 1–182 | `54c75a4c3855d9dfc6e7652de354f1743989dfaab1a2a5677ae1d45d508ee527` | 起播提前放行 |
| `tests-v2/regressions/functional-races/visibility-ownership.ts` | 1–219；220–273 | `2150d6c3bb34782ae9101b51048c8f281a9c7ae2313c542b18252e93f29d4145` | 可見性包裝所有權 |
| `tests-v2/regressions/functional-races/xhr-response-convergence.ts` | 1–223；224–393 | `03922b07e1742e01f46db19b7aa8cc6559a2edb0902d1f30cca9e7bf46dedc7d` | XHR 延後回應與舊身分 |
| `tests-v2/regressions/functional-races/xhr.ts` | 1–223；224–479；480–709；710–919；920–1143；1144–1385；1386–1430 | `e3338bddd5583f9bbf84040e9ac9c14e698a81559347dcfc5792f84cdf7b07bd` | XHR open/send/abort 原生相容 |
| `tests-v2/regressions/player-restore-ownership.ts` | 1–105 | `576b10f80e0f97ad50967aed98ce39596096628f6721db9245edefb73f73e001` | 播放器還原所有權 |
| `tests-v2/regressions/player-restore-readback.ts` | 1–130 | `1cd9b6e4380cb3545fd1b4c21faa2aeb6b1ae42ac411406ef62468f0c7916751` | 還原讀回與一次補正 |
| `tests-v2/regressions/project-config.ts` | 1–195 | `5ab5afcc6e2cbb01bbcbe7aed13c11084443239744a2f1a4772fd50124d69ecd` | 固定工具配置核對 |
| `tests-v2/regressions/recovery-restore-controller.ts` | 1–243 | `b0b4f1e0683eafebc9b450129d0048b1173131d76515c098f113e959ea1c5750` | 恢復還原控制器閉環 |
| `tests-v2/regressions/up141-api.ts` | 1–215；216–264 | `af7e12f656084e290e181293c91b6e28b0b5326920c03cfb31a15632598e0eef` | 播放 API 辨識與原文傳遞 |
| `tests-v2/regressions/up141-retry-policy.ts` | 1–270；271–387 | `06ae28ac723300dd68b49570ccdc42d5896ba01a34fbdc0014c5cc638da1656b` | 提前重試資格、取消、無歷程快照 N04 |
| `tests-v2/regressions/up141-retry-transport.ts` | 1–242；243–494；495–683 | `f470ac2b635a24d6dd5bafbacb1ab343f2245fb1e6cb335a57814c3d9d24b695` | 提前重試派送、授權、清理；受控樣本抑制 O03 |
| `tests-v2/regressions/up141-test-release.ts` | 1–225；226–285 | `76b08dea183963d54e2974f89bae38eca1886a2d6b4c2510502fe75935e471c4` | 保留功能離線效用模型 N07 |
| `tests-v2/regressions/upstream-comparison.ts` | 1–240；241–490 | `a88d59859aed7d879d9df01ee09ae5a492b52fe0ba24d95c2c8b2dd58bbb5e24` | 固定上游模擬器的有效性契約 N07 |
| `tests-v2/regressions/v220-settings-policy.ts` | 1–42 | `82721aa249bc998826856f22dfae004bb0fc79ce1179cd722411905863bc6215` | 逐欄設定比較與失效範圍 |
| `tests-v2/regressions/v220-settings.ts` | 1–62 | `2b7312b1ef33303532f7f1a1036fea83c387310f0a28dfced956ac939e8239b1` | Native 新預設、缺值／非法／保存／鎖／失敗／遠端 N06 |
| `tests-v2/suites/adapter-boundaries.ts` | 1–271；272–435 | `ace0ed41c14dc6c3730e9e966a0bd73bb4948f3191b9f84a2666021ab666ab25` | 適配邊界與清理；前置串接 O04 |
| `tests-v2/suites/adapters.ts` | 1–212；213–461；462–702；703–942；943–1186；1187–1443；1444–1688；1689–1926；1927–2157；2158–2401；2402–2647；2648–2867；2868–2870 | `d57b3a87fafe82bc9b0c3a848a67be4a833acc3c5f896e3fd3f3af3e6f4cd723` | Fetch/XHR、合法 Native、禁止、影音隔離；前置串接 O04 |
| `tests-v2/suites/application.ts` | 1–223；224–478；479–745；746–992；993–1232；1233–1459；1460–1684；1685–1935；1936–2181；2182–2392；2393–2626；2627–2753 | `10bf9ac3e865d84232fe70f76cca2dea345a0abd47d5dff2f5d987414ed5d208` | 40 組逐組驗證計畫重用及紀錄所有權；保留量測／恢復契約 |
| `tests-v2/suites/control-center.ts` | 1–260；261–488；489–700；701–837 | `2b6bf67d0ddfd2ce1be0f7e182f06fda67fa9f329289912ce9da253f775d1708` | 三頁、總覽、單次快照、可信命令與失效 N03；舊名稱 O04 |
| `tests-v2/suites/domain.ts` | 1–268；269–389 | `5edd6cdb22d56f72674eabe4775f523bdf0e082afc0758b03b8bdfdfe4ce80ed` | 需求／排名與有界學習 N01；無效前置 O04 |
| `tests-v2/suites/measurement-state.ts` | 1–151 | `c97f7b3ef406ff27b1f75765abc42f0fda588cbc95cadcb06911f72ed4b604a7` | 量測儲存與舊 lock waiter |
| `tests-v2/suites/native-routing.ts` | 1–201；202–392；393–607；608–838；839–1052；1053–1261；1262–1469；1470–1499 | `3ffe608661967d6c065a8959a5b15c81eab765834dea17a639e59899a4f87aba` | Native／Catalog、禁止與過期授權 N06；前置串接 O04 |
| `tests-v2/suites/native-transport.ts` | 1–221；222–437；438–665；666–881；882–1105；1106–1328；1329–1563；1564–1794；1795–1996；1997–2232；2233–2310 | `1b345090fcc1cd05041429f0310df18371f507721969ab513a7f2b086006924e` | 等待後／送出前授權重查及原生相容 N06；前置串接 O04 |
| `tests-v2/suites/orchestration.ts` | 1–269；270–460 | `6d16315a9749ba098f16a6d16438d52a16694f1125ae57e38dedbd4a4cf993ae` | A03 已關閉；Native 失效、影音隔離、清理及 clearLearning 次序保留 |
| `tests-v2/suites/playurl-summary.ts` | 1–250；251–484；485–635 | `2e485f40c5011c2403c5e430317f4ae5754c53ef12f4b2d92db065cad539fe8f` | 當前播放摘要、安全欄位與 getter 快取 N03；前置串接 O04 |
| `tests-v2/suites/progressive-playurl.ts` | 1–205；206–447；448–675；676–891；892–1017 | `146e69f80ae1213a3d760453670e0cec6f37f53a7ccbaa9a0577966c2c54b1c6` | MP4/FLV/DASH 內容與授權 |
| `tests-v2/suites/progressive-routing.ts` | 1–212；213–462；463–714；715–933；934–1129 | `34a868168fc066e678045f5f9aab808b558cd32fd54a4d662724f49841a49e6e` | progressive 選路、探測、失效；前置串接 O04 |
| `tests-v2/suites/progressive-transport.ts` | 1–234；235–295 | `945eb2b31708fc90f7977823e065a0c9c7a8f8f6e449d0962c0c959f4dc4de4d` | progressive 傳輸、取消與停用；getter 副作用 O04 |
| `tests-v2/suites/state.ts` | 1–236；237–445；446–704；705–892；893–1130；1131–1371；1372–1608；1609–1638 | `b04ae083ec39a0d9e14c8520d210df259b7959d715ef20d96687d66f73f4331f` | Vault／設定／禁止與過期授權；舊命名／前置 O04 |
| `tests-v2/support/catalog-settings.ts` | 1–15 | `f8c4daf03bb628df625e29163e7ae9051c9d78abd84f9458f5a4110d9402e0cf` | 明確 Catalog-only 前置 N06 |
| `tests-v2/support/clock.ts` | 1–79 | `4ae9355a5660a8abd58efe850b48b97251854ae68f193b448d6967dc5a60da86` | 虛擬時鐘及自有任務 |
| `tests-v2/support/controllers.ts` | 1–53 | `ee95e93d2aaafbf74f4a3564083403912defc78f077c6480fd925c3cf6d4ab5e` | 窄功能 stub；各案例覆寫必要方法 |
| `tests-v2/support/deferred.ts` | 1–22 | `45a9bb8eed19e68f17063568bbb899171b12ceb968a9601dde4de23dc9e9e3a5` | 顯式完成／拒絕信號 |
| `tests-v2/support/fixture-context.ts` | 1–9 | `8c2fe97ccaaa0b8a67ebb68d28bd7317a538ec1c5b8559cf1030e92a1359c040` | 情境描述子與可變閉包 |
| `tests-v2/support/measurement-storage-scenario.ts` | 1–107 | `b54d157cc74661cf85dc632a1e6545b8edf08e1326ea166be118e4e9e0325d37` | 獨立子程序觀察實際儲存拒絕 N07 |
| `tests-v2/support/player.ts` | 1–80 | `e65b493adec61b12d6d99ca8a95a6e47f289275ae5f2b777062992556dbc8d02` | 恢復讀回、落點與 SDK 模型 |
| `tests-v2/support/playurl.ts` | 1–11 | `30cb1f4e6520711bde2b33dfce57ee69c3af6217d8039523b294516c2803345d` | 具名播放轉換結果 |
| `tests-v2/support/progress-event.ts` | 1–10 | `7a224fe59b2367ad9b90a84b3c2e3a94548ada32c7da07fb5093cd94fc4635c6` | 合約用 ProgressEvent 形狀 |
| `tests-v2/support/rescue-acceptance.ts` | 1–61 | `ea919a28e2bddded0e41164d080305b1b856d092563310be5eb624622953f965` | 測試專用持續播放與位置判定 N07 |
| `tests-v2/support/rescue-dom.ts` | 1–253 | `53c4882ef72c484505a674cacea81195702cc97c9708fc858a7815509919bcc3` | 可信輸入模型及資源清理；固定掉幀欄位 N07 |
| `tests-v2/support/rescue-player.ts` | 1–71 | `e3412f216170fa0c605c5bee0488a42bf8cf00f58a6771b6aef1a1cebf856a8d` | 恢復副作用情境及 Node trace N07 |
| `tests-v2/support/runtime-fixture.ts` | 1–266 | `dddde8bd72b701836af9ae76f4bffdad8fbb747636b6b9832d5bb27ea05b7771` | Runtime 完整功能接線情境 |
| `tests-v2/support/scope.ts` | 1–52 | `fe41d8fb7f532dc375fe412c3b6cef7dfd811c872287898dfdc02a34b2105bac` | 逆序清理與全域描述子回復 |
| `tests-v2/support/startup-abort.ts` | 1–94 | `63b349335c317903ffcf6c43821fb81bb06a4adf58bfefa39e7ad038fca3c0e8` | 起播取消顯式情境 |
| `tests-v2/support/storage.ts` | 1–42 | `3b51a58218d17282d06c37f185bb52528ea66c24ee44d32c0676b0a2fa1ff6e3` | 儲存與延後鎖模型 |
| `tests-v2/tooling.ts` | 1–217；218–450；451–596 | `3f8b790eaa5272cd496fd6a3ac58cd33a1c65f2f4e1c62d3ec1998ae63bad0ef` | 測試監督、報告、期限與清理契約 N07 |
| `scripts/build.mts` | 1–87 | `c790d7a2e22bcc02831e710828633822c5036cdd8bcc47d92f18a9731d828e9e` | 純本機單一入口建置與輸入雜湊 |
| `scripts/checks/architecture-check.mts` | 1–18 | `78b2aecab394ca1d8b0a5a710e137a70e15c8f3cc3132448ee39c26d89f63d8c` | 分層 AST 圖檢查 |
| `scripts/checks/architecture-rules.mts` | 1–207 | `e23caeb1619de7a4a9f9358bf17ea603403e7ffb223385b7f4e10d331cda0926` | 分層、契約及副作用唯一所有者 |
| `scripts/checks/archive-check.mts` | 1–225；226–418；419–626；627–759 | `25dce02f4817098a853cdd1cdb03100b9a8f56dc0cda0feb5be30a0fd5d266c0` | 原件、搬移、追加日誌與 checksum 檢查 |
| `scripts/checks/docs-check.mts` | 1–236；237–431；432–638；639–714 | `3af97bb3163b804fc94dc4c525e5934f61cfe77346e3803698a0b1c6defb5848` | GFM／分類／導覽／保護；通用檢查報告 N07 |
| `scripts/checks/format.mts` | 1–61 | `7167b8534d3e415415ffbd2451077fb93d5a414acf9978a2fca293ddc2175263` | 固定範圍格式檢查／整理 |
| `scripts/checks/project-config.mts` | 1–89 | `21dca014148aaa79f25f21451caf8ae284ec882596cdff998265db04115062ef` | 固定工具與版本一致性 |
| `scripts/checks/typecheck.mts` | 1–9 | `77cdb95973b549f97896692944a74da0b02cdf890ac2efedeb08421ac7c6f117` | 三份 tsconfig 型別核對 |
| `scripts/evaluation/early-retry-evaluation.mts` | 1–167 | `5e95d92ac5ffc0da15cfef3f014e1cfcb78c00ef9f868ef81a7c26089add5601` | 保留提前重試功能離線效用評估 N07 |
| `scripts/evaluation/upstream-compare.mts` | 1–131 | `b3467d1995c887391cb174579819929fb0710238bc88d7b5a7e5b73090f1bc55` | 保留固定上游離線比較 N07 |
| `scripts/evaluation/upstream-compare/cases.mts` | 1–214；215–377 | `abaad5f8b7d91f8cab867e83476a590a7342db8a2479f46e66765baaf28854d7` | 固定歷史版本行為比較情境 N07 |
| `scripts/evaluation/upstream-compare/inputs.mts` | 1–49 | `97c97f87dae16711ced71824aa84e23671523645ba165a13141a42e8f6b33b02` | 不可變上游來源大小及雜湊 N07 |
| `scripts/evaluation/upstream-compare/model.mts` | 1–227；228–357 | `b2b2bc1b93ebcfd0737ec3ce0dac061b0a7ace7ce033ea9c5170fbd9a94bf78a` | 比較有效性、假時鐘及模型結果 N07 |
| `scripts/evaluation/upstream-compare/page.mts` | 1–259；260–511；512–742；743–843 | `ecac0d50bdb4c6b6f9001c141627cefceab3dfec7f162960be77b912b18cf8d3` | Node VM 模擬平台；歷史 API 形狀與採樣 N07 |
| `scripts/evaluation/upstream-compare/worker.mts` | 1–34 | `9fa48c31b310939a2fe4467dc35003299a46273f3796c800380e170533f35367` | 隔離比較 worker；不匯入正式 bundle |
| `scripts/lib/lib.mts` | 1–62 | `df93eeae4709223989fd9fceb40b46ea852e3185ab4b0d31d822b3ebf8858f2c` | 本機工具共用函式 |
| `scripts/lib/typescript-ast.mts` | 1–25 | `a3de5c096006f8b63f0347a74097dbc3e2302b4d475f5395db53c97e23c2f180` | 固定 TypeScript AST 支援 |
| `scripts/package.mts` | 1–31 | `e4f2c1996276e32b299f1bd99d61497054e4add778adf95e9333afeae89e94ee` | 本機封裝與 checksum；本輪只由 verify 用暫存目錄 |
| `scripts/test.mts` | 1–250；251–345 | `5a6fc20aa2e9bf3b8b192b3052237666c5417a7840d8d8df2c7be675942c555c` | 具名 Node 測試監督與摘要 N07 |
| `scripts/testing/architecture-tests.mts` | 1–202；203–222 | `306f751768034f6ebdd30e733840d625dad9bb4db6f775c393f40fd11641d24f` | 架構規則反例與功能所有權契約 |
| `scripts/testing/import-purity.mts` | 1–84 | `e106d3ab7764513e1d9c17d29a4a962bfc0e5cea1b0d697301de67b430dfda25` | 離線匯入副作用陷阱 |
| `scripts/testing/test-contracts.mts` | 1–72 | `3aff60cb5d8ecf5aba846080aed32c8605ba18da9d5c0db3a40c38126f7f7267` | 測試登記及 only 防護 |
| `scripts/testing/test-process.mts` | 1–68 | `1c5dfde89c9604e9c087d7807d5a8467dd26b02c0939f9a37b99c0cb6f0898eb` | 有界子程序、輸出與退出碼 |
| `scripts/testing/test-registry.mts` | 1–75 | `8a2d64d487cb789f8c43bd9a33e60f530f3881b27c3f4edc35f5609abcc1e765` | 18 個保留套件入口 |
| `scripts/testing/test-reporter.mts` | 1–77 | `036ea72d9becc3b9c2dcf56ae874220491f4460e50995de15dfd6aee088e3cab` | Node 事件至機器摘要；非產品報告 N07 |
| `scripts/verify.mts` | 1–99 | `d5e8267dacb888b163046c9094a3f1db92d956a5ee7274ec70aa1407b490f3d1` | 固定工具離線驗證；撤銷功能負向標記 N07 |
| `scripts/verify.ps1` | 1–7 | `d4ec60593d67f310eeb0d49a1fba198175e119ea879d6109f0dbb09c1d2cdb0d` | PowerShell verify 啟動器 |
| `scripts/verify.sh` | 1–4 | `0f4ad6edf745ed38c903460190875cb8fa8c9bb88068bf94c17ab0dcaacbbf6f` | POSIX verify 啟動器 |

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



## v2.2.3 離線驗證銜接（2026-11-01）

前段保存的 v2.2.2 全文及其 211 檔閱讀清單只屬當版證據；v2.2.3 的介面、初始化與十三套件整理結果由現行 [TEST_REPORT](../../../docs/TEST_REPORT.md) 維護，不改寫原清查與整合盤點。原 1,598 案保留，加一案初始化；離線驗證與未執行安裝版驗收分列，舊判定不改寫。


## v2.2.3 公開核對銜接（2026-11-01）

公開 main／標籤／唯一附件與 latest 核對結果已追加於 [現行完整報告](../../../docs/TEST_REPORT.md#公開交付與安裝結案)。本版封裝快照不回寫，舊版全文與判定保持；沒有新安裝或播放窗口。


## v2.2.3 R1 安裝驗收銜接（2026-11-01）

使用者確認更新並另行授權後，基本安裝驗收七個核心案例 PASS，兩個 Auto 1／2 倍窗口及清理均完成；完整身分、觀察、限制與原始證據索引只由 [現行完整報告](../../../docs/TEST_REPORT.md#v223-r1-安裝驗收2026-11-01) 維護。發布時的未實測檢查點及舊版全文不回寫；沒有恢復停止矩陣，沒有改判舊效用 FAIL／INVALID。本次文件提交不移動發行標籤或改寫 Release 原件。


<a name="v223-完整正文保存2026-11-01"></a>

## v2.2.3 完整正文保存（2026-11-01）

下列原樣保存換版前完整正文，含公開核對及 R1 基本安裝驗收；原結果與限制不改判。

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


## v2.2.4 修復與公開交付銜接（2026-11-01）

同片等價導覽及儀錶板缺值修復、完整離線與安全驗證、公開產物核對集中於 [最新版完整報告](../../../docs/TEST_REPORT.md)。上方 v2.2.3 全文及原 R1 判定保持，該輪未涵蓋的新回歸不倒寫為已測。v2.2.4 封裝保持發布時原件，後續安裝驗收須另行授權與記錄。


## v2.2.4 R1 安裝驗收銜接（2026-11-01）

使用者另行授權後的本版六個核心案例、等價網址即時身分比較、Auto 1／2 倍窗口、缺值與測速證據界線及清理，集中於 [最新版完整 R1](../../../docs/TEST_REPORT.md#v224-r1-安裝驗收2026-11-01)。前次離線發布與未實測檢查點仍按當時事實保存；舊 FAIL／INVALID、停止決策及 v2.2.3 原七項結果不改寫，Release 五份原件保持。


## v2.2.4 完整正文保存（2026-11-01）

以下完整原文保存發布、自動驗證及 R1 安裝驗收的當時判定；後續容量問題的修復見最新版 TEST_REPORT，不回寫本段。

# BiliCDN_TW v2.2.4 儀錶板資料遺失與缺值顯示修復驗證

日期：2026-11-01（Asia/Taipei）。基準為乾淨 main／`1c981da4796c84ea3abacf0433bf350931d66769`。本次依使用者批准方案修正導覽身分及唯讀顯示；原 v2.2.3 全文、公開核對及 R1 基本安裝驗收保存於 [歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-完整正文保存2026-11-01)。

## 修復結果與證據邊界

已重現並修正：同片追蹤參數／等價網址導致 generation 改變、表示及影音摘要清空；舊 512 字元截斷漏掉後段分 P 變更。新導覽鍵只在支援的單層影片／OGV 播放路徑忽略 vd_source、spm_id_from 並正規化末尾斜線；一般影片缺省與單一 p=1 等價，其他內容／未知參數及重複值順序保留。未知路徑保留完整原始輸入。真換片、分 P、cid／內容改變、停用與授權失效仍沿用原隔離與取消；五秒／跨頁 250 毫秒頁面資料期限保持。

使用者截圖可確認播放器有緩衝／倍速，但傳輸歸因及速度資料缺失；這次沒有取得該次實際網址變動或 hooks 的完整因果。已修正的重設路徑與截圖式缺值的 Node UI 契約分列，不宣稱已在使用者瀏覽器完整重現並消除所有缺值原因。

總覽及按需詳細狀態共用當次純衍生結果：有效播放器尺寸可以先顯示並標示編碼未確認，與已確認表示高度一致才沿用原畫質／codec；有效速度不因缺需求而隱藏，餘裕須有有效速度／倍率／推導需求。缺值按攔截、歸因與計畫狀態說明，影音各自區分實際回應、等待回應及尚無觀察；明確舊 generation／epoch 資料不顯示。沒有增加輪詢、訂閱、探測、持久鍵或診斷歷程，沒有用顯示備援授權選路。

Native 預設及既有布林值、schema 2、四個儲存鍵、兩筆成功影片傳輸的確認門檻、量測／恢復額度及可信事件所有權不變，無資料遷移。階段提交為導覽 `3c03495`、UI `871df88`。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2；已核對測試及 verify 不啟動網站服務，verify 僅在暫存位置核對封裝，不覆寫 Release。

基線 18 套件／1,599 案全部通過。初次沙箱執行中工具套件 9 案因自有暫存 Git 配置寫入被拒而失敗；以必要權限重跑基線後全數通過，環境限制不列產品失敗。正式案例名稱及參數展開逐項對照，原 1,599 案完整保留；新增 35 案，完整測試為 **18 套件／1,634 案通過**，failed／cancelled／skipped／todo 均為零。

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
| `orchestration` | 40 | 通過 |
| `adapter-boundaries` | 65 | 通過 |
| `measurement-state` | 94 | 通過 |
| `progressive-playurl` | 29 | 通過 |
| `progressive-routing` | 51 | 通過 |
| `progressive-transport` | 4 | 通過 |
| `playurl-summary` | 22 | 通過 |
| `control-center` | 63 | 通過 |
| `tooling` | 197 | 通過 |

### 新增回歸與既有契約

| 範圍 | 證據 |
| --- | --- |
| 導覽鍵 11 案 | 追蹤增刪／排序、重複值順序、重複 p、真分 P、內容與未知參數、OGV、未知路徑、512 字元後差異、影片及集數路徑 |
| 真實元件整合 2 案 | Navigation／Lifecycle／Session／Vault／Routes／Runtime／TransportContext 組合；頁面資料超過五秒後等價導覽仍保持原決策身分及影音摘要，真分 P 撤銷舊身分、拒絕晚到回填，新影音各自重建且兩筆影片後才確認 |
| UI 22 案 | 截圖式有緩衝／尺寸但無歸因；無效／零／不可用尺寸；畫質相符與不符；速度與需求部分缺值、非有限、零及溢位／下溢；六類提示；待回應目標與影音隔離；舊世代／週期列 |
| 既有契約 | 三頁首次刷新與單份快照、按需詳細文字、設定鎖與失敗／遠端更新、失效視圖晚到命令、Native／Catalog／固定／禁止／停用、影音隔離、恢復額度／位置／倍速、取消及重入全部保持 |

導覽修改前四個適配器案例與一個整合案例如預期失敗；UI 修改前 17 個新增案例中 12 個失敗。修復後相關套件及完整測試均通過。新增導覽整合測試停止週期監控以隔離導覽時間與無關停滯；不將此替身情境宣稱為連續播放或恢復實測。

原四個無效容量案例保留名稱及不產生假需求／非有限餘裕的斷言；依新功能調整過時的「缺需求必須連速度一起隱藏」預期，改驗有限正速度仍顯示、無效需求不形成容量宣告。沒有刪除保留功能案例、常值替代或空實作取代有效斷言。

型別與架構檢查通過，92 個執行期模組無匯入循環。最終 verify 全部通過，包含型別、架構、格式、文件、封存、1,634 案測試、兩次確定性建置、語法、撤除功能禁止標記及暫存封裝校驗。暫存工具測試所需 Git 配置寫入在授權權限下執行，不啟動服務。git diff --check 通過；正式封裝及公開核對依下節記錄。

### 安全差異

Codex Security 差異掃描 `b2d6e70e-e8e6-44aa-9d59-b2446fb51996` 固定範圍 `1c981da4796c84ea3abacf0433bf350931d66769..871df885a373f2f9b94f1d9249d0d472d240fc8b`，包含全部八份來源／測試變更。能力預檢通過，全部八份變更檔及必要支持路徑已靜態審查，獨立架構核對完成；封存的掃描結果為 complete、零可回報發現、八個表面均 no_issue_found，沒有延後審查。後續版本、文件及搬移差異另行核對，正式程式、可執行測試及工具原始碼與掃描 head 保持一致；tests-v2/MIGRATION.md 是後續文件說明。不把靜態安全檢查當成安裝實測。工作台回傳關聯三個對話累計用量 8,500,118 tokens（其中 cached input 8,275,968、output 28,909）；它包含關聯對話上下文，不能當成本次差異掃描的獨立增量用量。

## 發行產物與證據保存

腳本版本 **2.2.4**、**421,364 bytes**；SHA-256：`57300645ad2da226e4141f6ebe0439a3da4e718a534408bc9fc20968f4446d89`。建置與安全掃描 head 的產品來源一致，版本三檔與文件／封存差異另核對，沒有新增依賴。

本機忽略證據位於 `.work/v224/`，包含原始檔雜湊、基線與完整案例結果、紅／綠測試及名稱對照。原 v2.2.3 五份 Release 原件已依原始位元組歸檔，原 main 完整報告（含 7／7 R1）追加至歷史正文；既有安全產物、停止決策與日誌原文保持。先保存搬移清單原件，再更新新版本適用保護範圍。

### 公開交付與安裝結案

五份本機產物已封裝並逐項核對 SHA-256，v2.2.4 發行檔以原始位元組加入 Git，不做換行轉換。此為發布前檢查點；公開核對依實際完成結果追加，封裝後五份原件不回寫。

2026-11-01 發布後追加：正式 [v2.2.4 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.4) 已發布，非 draft／prerelease。發行時遠端 main 與標籤所指提交均為 `7f3c5e0023b29b4a386c3e5011add0d37d2f6e23`，標籤物件 `29befe32ece5a618bf604f62be6a5d62406674d1`。Release ID `430557228`，唯一附件 BiliCDN_TW.user.js，asset ID `698233887`；附件 digest 與本機 SHA-256 一致。

獨立下載公開 main 原件、v2.2.4 標籤原件、版本附件及 [latest 腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，四者均為 **2.2.4／421,364 bytes／SHA-256 57300645ad2da226e4141f6ebe0439a3da4e718a534408bc9fc20968f4446d89**，與本機逐位元組一致。後續 main 文件結案與發行提交分開，v2.2.4 標籤維持上述提交。

本版五份 Release 原件與上一版五份歸檔原件、三份日誌全部舊正文前綴及完整 v2.2.3 報告保持；後續只做文件結案，不重跑已通過的執行期驗證。發布結案時尚未實測安裝版；使用者後續另行授權的 R1 見下節，原截圖的實際觸發因果仍未確認，舊判定不改寫。

### 來源隔離與實際安裝

修復及發布階段未啟動瀏覽器、更新安裝版或恢復停止窗口，也未另做來源隔離。後續以使用者已更新的安裝版執行以下 R1；沒有重新安裝或切換來源。v2.2.3 的七項基本驗收只屬當版當輪；舊 FAIL、INVALID 與未解根因不改判。

<a name="v224-r1-安裝驗收2026-11-01"></a>

## v2.2.4 R1 安裝驗收（2026-11-01）

使用者確認內建瀏覽器腳本已更新後另行授權。基線 main／`2571dfdf579970324bac0fecdbe792061cb79740`；僅使用 Codex 內建瀏覽器＋Tampermonkey、一個自有分頁及 `BV1tFZZBQE57`／P1／Auto，不強制畫質、不改帳戶設定。凍結六個核心案例；T0 為 20:12:31.886（Asia/Taipei），20:37:31.886 起僅清理及報告，硬截止 20:42:31.886，不追加輪次。瀏覽器操作與清理於 20:23:50.642 前完成，分頁已關閉。

### 核心案例與實際結果

| 案例 | 必要證據與結果 | 判定 |
| --- | --- | --- |
| I224-01：安裝身分 | 實際載入完整本體 421,364 bytes，SHA-256 與本版正式腳本一致；Tampermonkey 5.5.1／腳本 2.2.4；RuntimeController、ControlCenter、TransportAdapter 各一個，Fetch／XHR hooks 均已安裝 | 有效／PASS |
| I224-02：三頁與資料顯示 | 總覽、CDN、播放設定切換正常；總覽為播放正常、2160p／av1，緩衝有效。安全吞吐及需求餘裕缺值時明示「目前路線尚無有效速度樣本」；影音各顯示實際回應主機／206。詳細文字點開才建立，重開後恢復收合；沒有診斷頁、報告或原線對照入口 | 有效／PASS |
| I224-03：同片等價網址 | 透過現有 History 包裝改變追蹤參數，再測缺省 p→單一 p=1、移除末尾斜線及參數排序；即時前後 Session 與實際決策物件身分相同，generation 1／epoch 0、video:group-6、影音摘要均保持 | 有效／PASS |
| I224-P1：Auto 1 倍 | 一個完整 60 秒窗口，實際播放進度增加 59.998229 秒；全程靜音，沒有觀察到媒體錯誤、等待、停滯、暫停或 seek 事件 | 有效／PASS |
| I224-P2：Auto 2 倍 | 透過網站倍速選單切為 2 倍；一個完整 60 秒窗口，實際播放進度增加 120.006166 秒，其餘條件同上 | 有效／PASS |
| I224-06：還原及清理 | 透過網站選單還原 1 倍、暫停並保留真正靜音；還原網址／History state，設定模型與儲存值逐欄等於原值；移除全部自有觀察資源、斷點與物件群組，IAB 自有分頁為零 | 有效／PASS |

六個核心案例 **6／6 PASS**，無核心 FAIL 或 INVALID。各案例只作本表範圍判定，不擴張為所有故障或條件式能力已驗證。

實際腳本本體從已載入的執行來源讀取並核對完整雜湊，沒有下載替換或重新注入產品。原有 Native=false、提前重試=false 等設定完整保留，沒有為湊案例切換。導覽後立即對真正媒體靜音並讀回；兩個計分窗口全部採樣均 muted=true，沒有替換媒體或靜音失敗。起始導覽至第一次讀回的區間不列為「已證明全程靜音」窗口，也沒有追加起播前靜音門檻。不要求前景、不啟動本機網站服務，不取消音訊下載。

### 等價網址與播放窗口證據

追蹤參數變動的即時前後比較保持 decision-166；第二組比較保持 decision-209，當時文件已存在 366,993.7 毫秒，超過頁面資料五秒期限。每組均比對當下實際計畫物件，而非跨自然媒體分段要求決策 ID 永久相同。兩組均保持表示及影音回應，重開畫面仍能正常顯示；本次沒有執行真正換片／分 P 的新安裝版窗口，相關拒絕舊完成及重建能力仍引用上節 Node 契約。

| 窗口 | 本地時間 | 單調時鐘長度 | 採樣／最大間隔 | 尺寸／進度 |
| --- | --- | ---: | --- | --- |
| I224-P1 | 20:19:38.623–20:20:38.624 | 60,001.4 ms | 62 筆／1,007.9 ms | 3840×2160；+59.998229 秒 |
| I224-P2 | 20:21:10.257–20:22:10.262 | 60,004.8 ms | 62 筆／1,003.6 ms | 3840×2160；+120.006166 秒 |

兩窗均為相同媒體、倍率固定、沒有 seeking／paused／ended 或媒體錯誤；error、pause、seeking、stalled、waiting 事件各零。相鄰採樣亦未觀察到停進度區間；這是有界媒體進度與事件證據，不宣稱排除採樣間所有短暫異常，也不含掉幀收集。Recovery reloadCount=0，不把正常進度恢復狀態當成重載效用通過。

### 節點與缺值的判讀邊界

- 量測狀態所保留的最近主機為 `upos-sz-mirroralib.bilivideo.com`，lastAttemptAt=1793535313755；讀取時為 waiting，原因曾為 cross-tab-cooldown、low-buffer，清理時為 awaiting-progress。起播量測為 skipped／preflight-skipped:xhr-explicit-timeout，候選數零；沒有觀察到該次量測的完整送出、回應或成功速度證據，不能宣稱測速成功，也不能以冷卻原因推定另有分頁。
- 播放的實際影音回應起初均為 `upos-sz-mirrorali02.bilivideo.com`／206；最後影片為 `upos-sz-mirrorali.bilivideo.com`／206，音訊仍為 ali02／206。這些是腳本功能摘要中的回應主機，不能冒稱為主動測速目標或完整 Network 取證。
- 有界讀取時沒有該量測主機的 challengeEvidence；只讀了當時可得主機，沒有建立歷程收集器或遍歷宣稱全輪所有測速。未手動探測、重設冷卻、提高頻率或製造失敗。
- 本輪自然狀態已確認表示並有影音歸因，但當前路線缺有效速度，因此驗證了相應提示。截圖式「完全無歸因時顯示播放器尺寸」及「有速度但無需求」未自然出現，安裝版該兩分支未驗證；其自動契約見上節。使用者原截圖實際觸發因果仍未完整重現，不宣稱所有儀錶板缺值原因均已消失。

一般播放與三頁操作依上述產品行為判定，不要求完整 Network、診斷報告或工具事件成功。未測來源切換隔離、故障注入、自然恢復、提前重試效用或歷史已停止矩陣；不由本輪 PASS 改判任何舊 FAIL／INVALID。

### 工具限制、清理與原始證據

準備期間出現一次 REPL 區域變數作用域問題、一次導覽運算式在執行前語法錯誤，以及一次 DOM nodeId 無法供捲動使用；改用當次有效物件、正確運算式及可信捲動操作後完成準備。所有身分斷點均立即移除並恢復執行；不把準備錯誤列為產品失敗或額外播放輪次。一次跨自然分段的舊決策比較不具即時比較前提，未用作判定，正式證據改為每次變動的即時前後同物件比較。

清理時快速 JSON 字串比較因 CDP 重排 catalogOverrides 鍵順序而回傳 false；原始 false 保留，另以完整結構比對確認初始、模型及儲存值逐欄相等，updatedAt 同為 1793517717160，沒有設定變更。最後媒體 paused=true、muted=true、rate=1；自有 MutationObserver、計時器、事件監聽與暫存登記移除，Debugger 停用、斷點清除、物件群組釋放、唯一分頁關閉。全程沒有安裝 Network／Fetch 攔截、替換產品 hook 或修改媒體 getter。

私有有界證據位於 `.work/iab-testing/2026-11-01-v2.2.4-2571dfd-R1/`：BASELINE、IDENTITY、OVERVIEW、DETAILS、NAVIGATION、MEASUREMENT、P1、P2、CLEANUP、SUMMARY、CASES，以及畫面截圖；不提交簽名 URL、Cookie、IP 或播放器物件。P1 原始 JSON SHA-256 為 `49e10d2eb889ccd02393a8c645df6eda50542699a3204951424e466abbfdfb1c`；P2 為 `78b07a23f823e14b387412f11763b8ccfdd99069533a3ea2a3b61b2a9c16a0f0`。本次僅維護驗收文件，不重跑已通過的執行期測試、不修改產品或 Release、不升版或發布。

文件結案檢查通過 256 Markdown／3,153 本機及儲存庫連結；7 個不可變舊斷鏈、434 個歷史原址限制、18 個私有證據未核對及 576 個外部未連線引用另列。封存檢查通過 454 搬移項目、三份追加日誌、111 未變檔、72 checksum／330 列，未執行 local 模式。git diff --check 通過；三份日誌全部原位元組前綴及本版五份 Release 原件重新核對一致，差異僅七份驗收文件及導覽／登記。

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


### v2.2.5 容量修復的判讀補充（2026-11-01）

v2.2.4 R1 的六項基本案例及原始缺值觀察保持；該輪沒有驗證「合法樣本成功提交後數字更新」、倍率改變後的需求數值及 24 小時到期。v2.2.5 以離線反例修正這些路徑，不將合成傳輸位元組當成實機測速，也不以新缺陷否定獨立成立的播放與操作結果。


## v2.2.5 R1 安裝驗收導引（2026-11-01）

使用者更新後另行授權的完整 R1 記錄維護於 [最新版 TEST_REPORT](../../../docs/TEST_REPORT.md#v225-r1-安裝驗收2026-11-01)。本次不換版，不移動 v2.2.5 標籤，不改發布快照或已保存的 v2.2.4 原始結果；本節只追加導引。


## v2.2.5 完整正文保存（2026-11-02）

以下為換版前完整正文，包含 R1 原始結果與限制；不回寫當時判定。

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


## v2.2.6 完整正文保存（2026-11-03）

換版前完整原文包含 R1、公開核對及限制；不回寫當時判定。

# BiliCDN_TW v2.2.6 確定性選路、狀態機與提交所有權驗證

日期：2026-11-02（Asia/Taipei）。產品基準為 main／0e1375a224eee0afa409e0a6fea50837968c9aac（v2.2.5）；先以 abf2115 獨立保存調查文件及六案原始觀察，再依序提交需求、起播、提交、恢復與 UI 整合。最終執行期提交為 029618571132709a3ed8f247b0b8346d65bf6a02；後續為版本、文件、封存與封裝。

## 驗證階段與證據範圍

各階段按自己的範圍判定；發布時的離線定位與後續 R1 結果是不同時點。當前工作與停止狀態只由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

| 階段 | 已有結果與範圍 | 詳細紀錄 |
| --- | --- | --- |
| 離線契約與工具 | 18 套件／1,856 案及必要檢查通過；35 項有正式對照 | [自動驗證](#自動驗證)、[35 項對照](#三十五項閉環對照) |
| 安全差異 | 審查完成；發現的低風險同步重入問題已修正並複核 | [安全差異](#安全差異) |
| 正式發布 | 發行提交、標籤、唯一附件與當次公開 latest 位元組核對完成；封裝快照保留發布前時點 | [公開交付](#公開交付與安裝結案) |
| 已安裝版 R1 | 凍結核心 7／7、條件式目前狀態 1／1、清理均 PASS；正式窗口為 Auto／720p，1／2 倍各 60 秒 | [R1 完整結果](#v226-r1-安裝驗收2026-11-02) |
| R1 未涵蓋分支 | 故障恢復、提前重試效用、完整起播時序等未於本輪安裝版執行；不以離線結果補算 | [R1 限制與清理](#v226-r1-安裝驗收2026-11-02) |

## 修復結果與證據邊界

35 項調查均有確定規則與正式案例對照，見下表。離線反例已改為期望行為回歸；原調查與六案現況特徵證據完整保留，不回寫成六案產品 PASS。這些離線結果證明受控交錯與狀態契約，尚未證明使用者現場多輪換 CDN 的唯一根因；安裝版基本播放已另由 R1 驗證，其有限範圍不能推廣為 35 項全部安裝實測。

合法固定與禁止規則優先，足速證據優先；起播維持三候選／三秒，可信影音由影片取得一次窗口。失敗結果不再藉原始來源偏好勝出；無有效結果只走一次合法未測退路。傳輸與 API 依送出／路線／選擇所有權提交，健康證據與控制資格分開。恢復使用同段額度、絕對期限及原生讀回；畫面僅顯示目前階段、等待、原因、期限及現有額度。

三頁控制中心、Native 預設及既有布林值、schema 2、四個儲存鍵、24 小時 TTL 與樣本算法保持。沒有增加主動探測、下載上限、重載次數、週期計時器、診斷／原線對照／掉幀收集、持久格式或執行期依賴。單次刷新共用快照、詳細文字按需建立仍由既有 UI 契約驗證。

## 三十五項閉環對照

表內案例均納入本次完整執行並通過；政策保留項同時保留拒絕／失效對照。精確案例名稱與參數映射見 [測試遷移對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v226-確定性流程與交錯契約)。來源包括 [v226-demand](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-demand.ts)、[v226-flow](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-flow.ts)、[v226-startup](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-startup.ts)、[v226-routing](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-routing.ts)、[v226-api-order](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-api-order.ts)、[v226-http-status](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-http-status.ts)、[v226-monitor](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-monitor.ts)、[v226-recovery](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-recovery.ts)、[v226-interleavings](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-interleavings.ts) 及 [v226-ui-state](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-ui-state.ts)；表列既有案例位於 [功能競態回歸](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/functional-races) 與 [恢復／讀回回歸](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions)。

| 項目 | 現行確定規則 | 正式案例與結果（均 PASS） |
| --- | --- | --- |
| S01 | 未驗證來源使用固定順序；足速證據優先，合法固定與禁止規則優先。 | domain／cold startup；v226-startup；routing-convergence |
| S02 | 跨片主機學習保留 24 小時 TTL，容量標明 current-transport／current-probe／historical-cache。 | V225 capacity TTL；v226-routing；control-center |
| S03 | 最多五條備援，足速證據與家族分散優先，未測來源不標健康。 | UP141-ROUTE measured sufficient backups diversify families before same-family headroom |
| S04 | 合法計畫與穩定主機可重用；失敗、限制或身分撤銷不能靠舊計畫復活。 | routing-convergence；v226-interleavings；v226-routing |
| S05 | 取消未成功原始來源的隱含優先，足速候選間保留合法穩定主機。 | domain cold startup；v226-routing S10／S11 |
| S06 | 同步／明確 timeout XHR 保留原生送出並顯示跳過理由，不扣未啟動窗口。 | native-transport XHR；v226-ui-state |
| S07 | 可信混合內容由影片保留唯一窗口，可信純音訊可使用；低信任影片不能奪取純音訊預算。 | v226-startup S07 三案 |
| S08 | 完整合法池按證據排序後選三個，未知來源沿游標；Native 數量與精確授權不變。 | v226-startup；v226-routing R04；progressive-routing |
| S09 | 16 KiB 快取驗證沿用歷史速度，不新增完整速度樣本；新量測仍需 64 KiB。 | UP141-START cached candidate must complete all 16KiB before early release；measurement-state |
| S10 | 本輪足速、最快有效、一次合法未測退路依序選擇；失敗原主機不能壓過有效結果。 | v226-routing safe=12／20、demand=10 |
| S11 | 移除低於足速門檻仍可藉九成偏好勝出的路徑。 | v226-routing S11：13.4 對 14.8 Mbps |
| S12 | 三候選共用三秒；Catalog-only 既有開關仍可在首個足速結果提早放行。 | UP141-START；measurement-state；v226-flow |
| S13 | 全未成功只提交一次未測退路；無退路明確耗盡，取消與終態不復活。 | v226-startup S13／cancellation；v226-flow |
| T01 | 舊輸出備援依目前計畫改寫；新路線成功後不被舊備援奪回。 | v226-routing T01 native=false／true；v226-interleavings |
| T02 | 失敗重選使用共用碼率／倍率需求，刪除獨立 video 8 Mbps 分支。 | v226-demand；v226-routing T02：4 Mbps × 2 → 10 Mbps |
| T03 | 404／410 限當前資源與主機；其他 4xx 明確拒絕；取消不算失敗，403 沿專用規則。 | v226-http-status 八案；native-transport |
| R01 | 冷起播由第一筆影片送出起算；音訊不建立影片救援。 | v226-routing R01；v226-monitor |
| R02 | 準備無候選不扣提交額度；相同資格等待，新增來源才重備，期限不重開。 | v226-monitor R02 三案 |
| R03 | 已有尺寸／readyState=2 仍按實際無進度與低緩衝判定冷停滯。 | v226-monitor R03；BR-01 initialized stalled core |
| R04 | 恢復偏好主機從完整合法池核對，不受重新建立的前三候選排除。 | v226-routing R04 valid preferred host survives a different startup cursor |
| R05 | 首次進度前共用重載後十五秒；首次進度後使用固定十五秒確認期限。 | BR-01 exact 15/30/15 boundaries；SR2；v226-flow |
| R06 | 先捕獲有效 SDK 方法，真正派送前扣額度；派送後失敗不退還；重入撤銷不得派送。 | v226-recovery R06；BR-01；recovery-restore-controller |
| R07 | SDK 尋位／倍率失敗同用拒絕結果；至少一秒、已知不符且位置基準有效才可一次原生補正。 | SR1／SR2；player-restore-readback；recovery-restore-controller |
| R08 | 倍率前後依舊／目標倍率的可達區間驗證，單一位置基準不以新倍率回算舊時間。 | player-restore-readback 的倍率分段與位置未知／錯位拒絕 |
| R09 | 保存有效原生倍率優先；play 拒絕結案為已還原但暫停，晚到結果不能復活。 | v226-recovery R09；BR-01 late play rejection；SR2 |
| R10 | 兩筆連續合格進度確認恢復；低緩衝段須十個健康 tick 且緩衝至少十秒才結束。 | BR-01 two genuine progressing samples；v226-monitor R05 H02 |
| H01 | 舊決策合法成功可學習，不能改寫新計畫／親和／表示或觸發恢復。 | v226-routing H01；v226-interleavings 96 案 |
| H02 | 短暫進度進入確認，維持同段 ID、起點與備援／重載額度，不重領六秒。 | v226-monitor R05 H02；UP141-MON；v226-flow |
| H03 | 合格 tick 依時間去重，排程斷層重算穩定度；鎖等待、無候選、取消與冷卻分開。 | v226-monitor H03；up141-probe；measurement-metadata |
| H04 | 提前重試依當次 Catalog 傳輸判定；Native 開啟不排除 Catalog，真正 Native 不擴權。 | up141-retry-policy；up141-test-release；xhr |
| H05 | 替代資格仍需同內容／表示／授權／政策內六十秒兩筆不同實際影片傳輸；探測不得授權。 | up141-retry-policy；早重試逾時／取消／額度與原生 XHR 契約 |
| L01 | API 送出序號以已接納回應為水位；同步重入使用獨立處理所有者，外層不採用內層 epoch。 | v226-api-order 十案；XHR protocol-relative CID；functional-races/content |
| L02 | 同選擇並行請求共享修訂；舊 A 完成不能覆寫 B，新送出的 A 回切須兩筆新成功。 | v226-routing L02；v226-interleavings 96 案 |
| L03 | 缺 cid 的目錄備援仍保守失效，具名內容判定不以外觀推定同片。 | BR-03 missing cid uses overlap without forgetting cid；functional-races/content |
| L04 | 只排除既有追蹤／等價參數；未知參數、真正換片及分 P 仍失效。 | V224 navigation identity: unknown parameter；adapter-boundaries；v226-interleavings |

交錯矩陣列舉兩主機、兩表示的四筆並行請求全部 24 個完成順序，分別套用無邊界、內容、政策及授權失效，共 96 案；斷言決策／選擇身分、事件、學習、恢復副作用及晚到拒絕。這是所列有限交錯的窮舉，不宣稱涵蓋任意瀏覽器排程。同步 API 重入另驗 Native 開／關、較舊／較新回應、低信任提示及世代變更；被拒新回應不得推進接納水位。

## 自動驗證

固定 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。命令已檢查不啟動網站服務；完整測試的工具案例只在暫存位置建立 Git 儲存庫。最初受限權限造成 tooling 暫存 Git 失敗，已與產品結果分開，依授權重跑基線通過。

基線 **18 套件／1,675 案**，按套件、名稱及參數展開逐項對照無遺失。新增 **181 案**（domain 26、application 150、native-transport 1、control-center 4），最終 **18 套件／1,856 案全部通過**；failed／cancelled／skipped／todo 均為零。六案原始觀察不計入新正式案例數。政策明確變更的既有案例保留名稱及有效斷言，映射見 MIGRATION。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 37 | PASS |
| state | 35 | PASS |
| application | 738 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 168 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 65 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 88 | PASS |
| tooling | 197 | PASS |

型別、架構（94 個執行期模組、無循環）、完整測試、格式、文件、封存與差異檢查全部通過。最終 verify 同時通過固定專案配置、上述檢查、兩次相同建置、JavaScript 語法、v2-only／撤除功能禁止標記及暫存封裝校驗值；沒有覆寫已發行原件。文件檢查保留 7 個不可變舊斷鏈，434 個封存後不可用的歷史原網址、18 個未檢查私有引用及 586 個未抓取外部連結如實列明，不當成新增失敗或外部網址已驗證。

## 安全差異

本次涉及傳輸及授權提交，使用 Codex Security 完成不可變差異審查。第一輪 f00f5b0b-8735-4bcd-8fa4-6379a0f24b29 覆蓋 0e1375a..30185d7 的 65 個來源／測試檔，無成立安全漏洞。第二輪 dc39e6d8-bd87-45c3-8e46-067812f5ca29 覆蓋 30185d7..f7ba9d4 的 25 檔，實際 Node 反例確認一項低風險同步 API 重入授權混合（csf_bbd37bf36cc614f7a5a7aaa8）。其影響限已接納精確媒體來源的內容週期完整性，未證明任意主機、資料外洩或帳戶影響。

0296185 已修正處理所有權與回呼後生命週期檢查，新增六案先失敗後通過。最終修正差異掃描 0f7c786e-a997-4b4d-9f02-3139e1359da8 完整審閱剩餘三檔與 SDK 清理回呼，無新增成立漏洞；已確認原重入路徑在回呼返回後被所有者檢查阻斷。三輪原始安全產物保存在工具管理的不可變掃描目錄，不改寫前輪 finding 為從未發生。Daybreak 存取未授予屬顯示限制，未阻擋實際靜態審查與 Node 反例。

工具實測用量如下，三輪 coverage 均 complete；輸入含快取，數字不能相加當作互不重疊成本，也不能換算實際帳務。

| 掃描 | totalTokens | inputTokens | cachedInputTokens |
| --- | ---: | ---: | ---: |
| f00f5b0b | 42,841,061 | 42,748,014 | 42,299,264 |
| dc39e6d8 | 10,901,507 | 10,878,747 | 10,784,512 |
| 0f7c786e | 2,245,463 | 2,233,690 | 2,196,864 |

## 來源隔離與實際安裝

本版發布時按使用者批准採離線交付，當時未啟動瀏覽器、本機網站服務、來源隔離頁或安裝版窗口，也未自動更新安裝版。使用者自行更新後另行批准的 [v2.2.6 R1](#v226-r1-安裝驗收2026-11-02) 結果見下節；不沿用 v2.2.5 R1 作新版證據，其他已結束窗口仍保持停止。

## 公開交付與安裝結案

發布前已核對 v2.2.5 五份原件，搬移至 archive/retired/releases/Release/v2.2.5；大小、SHA-256 與 mtime 完全不變。當前完整 v2.2.5 報告（含 R1）原樣追加到歷史正文，與當年 Release 快照分開保存。新版本五份本機產物及校驗值已登記保護；Release 中報告保留封裝當時的發布前狀態，以下為實際發布後追加結果，不回寫封裝原件。

2026-11-02 04:07:54（Asia/Taipei）公開核對完成：遠端 main 與 v2.2.6 標籤解析為發行提交 `85f95d636eb1d319ad5743a4e863a464e697d872`。正式 [GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.6) 非草稿／非預發行，唯一附件為 BiliCDN_TW.user.js。逐位元組下載正式附件與公開 latest 更新入口，兩者均與本機封裝相同：

- 版本：2.2.6。
- 大小：455,309 bytes。
- SHA-256：`798bbb33cb6bcc8c117ba389c151f5f6a2afff3e6f521f1d221acf3d7a57caca`。

本次記錄完成後 main 僅追加交付文件，標籤維持上述發行提交，產品來源、版本與五份封裝原件保持相同。上述公開交付階段未觸發安裝版更新或新的瀏覽器窗口；其後新授權的 R1 見下節。

## v2.2.6 R1 安裝驗收（2026-11-02）

**本輪凍結核心 7／7 PASS，條件式目前狀態 1／1 PASS，清理 PASS。** 這是基本播放、數值及操作驗收，不是 35 項所有交錯的安裝版通過，也沒有證明使用者多輪換 CDN 的唯一根因已解決。

使用者已更新腳本後另行要求設立目標。本輪為唯一自有 IAB 分頁＋Tampermonkey，基準片 BV1tFZZBQE57／P1／Auto，1 倍、2 倍各一個完整 60 秒窗口；未強制畫質、未改帳戶／其他腳本或瀏覽器設定、未下載重裝腳本。T0 為 20:29:11，原定 20:54:11 起清理、20:59:11 硬截止（Asia/Taipei）；20:52 前已完成瀏覽器操作與清理，沒有追加窗口。最初網站依播放紀錄續播，正式窗口前以真正媒體 currentTime 設定至 300 秒再播放，不修改 getter 或偽造進度。

初次「CDP 原生輸入＋短暫唯讀斷點」組合被自動審查拒絕後停止該路徑，使用者明確批准相同限定操作才繼續，未間接繞過拒絕。網站設定入口的隱藏子頁先經實際畫面確認，再進入「更多播放設定」；成功的原生點擊讀得 isTrusted=true，未修改 event.isTrusted 或強制呼叫產品命令。身分取得後移除斷點並停用 Debugger，暫停區間不計入播放窗口。

| ID／層級 | 預期與實際證據 | 結果 |
| --- | --- | --- |
| E0／E | 工具動態選取 type=iab；同來源 CDP 及真正靜音可操作，明確批准後可信原生輸入成立 | PASS |
| I0／I | 完整已載入 metadata＋程式本體為 455,309 bytes，SHA-256 與正式原件相同；Tampermonkey 5.5.1／腳本 2.2.6；RuntimeController、ControlCenter、TransportAdapter 各一個，Fetch／XHR hooks 均 installed | PASS |
| I1／I | Auto／1 倍，20:45:06.188 開始，60,003.1 ms／62 筆；時間前進 59.997 秒、實際影格增加 1,799，最小可播放緩衝 67.12 秒 | PASS |
| I2／I | Auto／2 倍，20:46:45.294 開始，60,006.5 ms／62 筆；時間前進 119.936 秒、實際影格增加 3,595，最小原生前置緩衝 64.17 媒體秒（按 2 倍折算 32.09 秒） | PASS |
| I3／I | 當前影片主機 alib 的 current-transport 速度 13.3742379747 Mbps，畫面 13.37；碼率 833,358 bps、實際 2 倍，需求 2.083395 Mbps／畫面 2.08，餘裕 6.42，與當前計畫主機一致 | PASS |
| I4／I | 總覽、CDN、播放設定均可切換，重開使用目前 2 倍狀態；CDN 15 個選項（Auto＋14 主機）與 15 個開關（Native＋14），設定六項；詳細狀態按需展開 1,073 字元，按鈕改顯示「收起詳細狀態」，沒有撤除的頁面或報告入口 | PASS |
| I5／I | 原 Native=false，可信 UI 切 true 後目前值與 GM 儲存皆 true；跨頁再讀，核對仍為工具最後寫入後切回 false，兩處皆 false；除 updatedAt 外其他設定保持 | PASS |
| I6／I，條件式 | 只核對目前起播為 skipped／xhr-explicit-timeout、候選 0，畫面明示網站 timeout 跳過；目前影音各有 HTTP 206 回應摘要。未取得初始完整請求序列，不宣稱探測總數或起播換站次數 | PASS（限目前狀態） |

兩個播放窗口均為真正媒體靜音、未暫停／尋位／結束／error；最長採樣間隔約 1.006 秒，沒有連續兩秒無合格進度。Auto 正式窗口的實際原生尺寸均 **1280×720**，表示標示 av1；標題含 8K、初期選單曾顯示 4K，都不當作本輪 4K／8K 播放通過。播放通過也不代表沒有換站。

需求倍率按實際碼率計算且保留 2 Mbps 下限：此表示 1 倍需求為 2.00 Mbps、2 倍為 2.08 Mbps，因此不要求畫面數字機械翻倍。影片回應觀察到 upos-sz-mirroralib.bilivideo.com／upos-sz-mirroraliov.bilivideo.com 等當前摘要；音訊摘要獨立為 upos-sz-mirroraliov.bilivideo.com。未將計畫主機當成所有請求的實際回應，也不把普通傳輸證據叫作本輪主動測速抽樣。

保留使用者原設定：Native 與慢請求提前重試均 false、HK 三節點覆寫 false、固定主機為空；其餘開關未變。Native 開關僅驗保存／失效與復原，未宣稱實際 Native 供片；提前重試關閉，沒有驗其效用。完整 Network、背景真實轉換、來源隔離、故障注入、3 秒探測上限、重載還原／額度、24 小時過期及 API／表示逆序，均未於本輪安裝版執行；不以離線契約代算。詳細狀態曾呈現停滯段／備援狀態，沒有完整因果序列，不能據此判為新版誤介入或將一般播放算作恢復驗證。

清理：兩個有界觀察器均在各自 60 秒截止時釋放 interval／timeout／volume listener／MutationObserver；結果保存後刪除唯一 registry。沒有 Fetch 攔截、持有請求、受控故障樣本、產品橋接或新控制器；未清空／回滾正常學習。原生倍率由工具最後寫入的 2 還原為 1，媒體保持 muted=true 並 pause；設定目前值與 GM 儲存逐欄核對原值，關閉中心及唯一自有分頁後 IAB 自有分頁為 0。

私有去敏證據保存在 .work/iab-testing/2026-11-02-v2.2.6-226c88a-r1：BASELINE／IDENTITY、I1／I2 完整樣本與起訖模型、I3 數值、三頁／詳細狀態、Native 保存／復原、CASES／ANALYSIS／SUMMARY／CLEANUP 與兩張實際截圖。原始簽名 URL／權杖／播放器物件未寫入。正式來源、測試、版本、標籤、五份 Release 及既有歷史報告不變，僅追加本次文件結果；目前狀態由 TODO 維護。

## 歷史驗證導覽

[v2.2.5 起播調查與六案原始結果](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/STARTUP_CDN_REVIEW_v2.2.5_2026-11-02.md)；[v2.2.5 完整正文與 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-完整正文保存2026-11-02)；[其餘版本與停止決策](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。現行工作只由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

<a name="v225-r1-安裝驗收2026-11-01"></a>
<a name="v224-r1-安裝驗收2026-11-01"></a>
<a name="v223-r1-安裝驗收2026-11-01"></a>
<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

以上舊入口保留導引，原文與限制見 [完整歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，不構成新版驗收。

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

其餘歷史錨點的原始正文與逐項導引見 [v2.2.5 完整保存](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-完整正文保存2026-11-02)。


## v2.2.7 完整正文保存（2026-11-03）

以下完整保存 v2.2.7 離線發布、R1、XHR timeout 調查與原始限制。現行規則見[架構](../../../docs/ARCHITECTURE.md)，目前工作只見[TODO](../../../docs/TODO.md)。

# BiliCDN_TW v2.2.7 選路、容量與起播探索驗證

日期：2026-11-03（Asia/Taipei）。基準 main／048b0f94e6bb98922ee5bcc0d1b30003cf3b12a9（v2.2.6），程式範圍固定至 5ca6b0c5acc15d5f9e17ee2704fa0105ac819431。各階段先失敗回歸再實作並獨立提交；原研究與 v2.2.6 R1 保留。

## 修復結果與證據邊界

來源共用證據政策、快慢 EWMA、探索名額及資料充分時完成期限已正式採用。保留單一選路／探測／重載所有者、精確 Native 授權、影音隔離、取消與晚到提交檢查。schema 2 與四鍵保持；樣本只增可選數值，舊資料可讀、不強制寫回。沒有新增探測、下載、重載額度、週期計時器、診斷／原線對照／掉幀收集或執行期依賴。

本次只有離線驗證與發布核對，未啟動瀏覽器、更新安裝版或恢復停止窗口；未證實使用者現場多輪切換的唯一根因，不把模型改善稱為實機改善。

## 研究項目完成對照

| 項目 | 已實作規則 | 正式驗證 |
| --- | --- | --- |
| F01／P01 | 同一純政策分組、來源平等；固定與目前沿用有具名例外 | v227-routing、v227-route-owner；原固定／禁止契約 |
| F02／P02 | 五分鐘 sample.at 與 24 小時 TTL 分開，閒置不改測量時間 | v227-evidence、v227-evidence-state；v225 TTL／遠端更新 |
| F03／P04 | 25% 需求裕度＋一般 1 倍，單筆 0.7；早重試 1.35 保持 | v227-routing、v227-startup；UP141-RETRY |
| F04／P03 | 普通同分依候選序號；Catalog-only 首足速提前放行獨立 | v227-startup；UP141-START |
| F05 | 16 KiB 可達性不新增速度／新鮮度、不解除再驗證 | v227-startup、v227-evidence；measurement-state |
| F06 | 健康、充分、時效、重試兩筆實傳資格分開 | v227-evidence、v227-completion；UP141-RETRY 全套 |
| F07／P04 | 隔離到期待再驗證，64 KiB 合法速度成功解除，失敗原退避 | v227-evidence；v227-startup |
| F08／D02 | 三名額中保留一探索，固定游標，不增加預算 | v227-startup；v227-evaluation；原三秒／下載／取消案例 |
| F09／D02 | 精確閉合 Range＋兩秒內有效緩衝；全組 ETA 或全組吞吐 | v227-completion、v227-completion-owner；native-transport 新 Range 案 |
| D01 | 二／五筆 EWMA，快慢與最新取小值，單筆再折扣 | v227-evidence 的排序／去重／升降／邊界；固定模型 |

來源與測試在 [共用容量政策](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/domain/route-capacity.ts)、[證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/domain/evidence.ts)、[完成期限](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/domain/route-completion.ts) 及 [具名回歸](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions)。完整操作不變量見 [架構契約](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/ARCHITECTURE.md#選路證據與完成期限)。

## 自動驗證

鎖定 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2、Prettier 3.9.10。執行入口已核對，不啟動網站服務；測試只在暫存位置建立 Git。基線十八套件／1,856 案全部通過。按套件、案例名稱、kind 及參數展開逐項多重集合對照，原案無遺失；新增 75 案，最終 **18 套件／1,931 案全通過**，failed／cancelled／skipped／todo 均零。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 81 | PASS |
| state | 37 | PASS |
| application | 753 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 174 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 65 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 92 | PASS |
| tooling | 201 | PASS |

型別、96 模組架構無循環、完整測試、格式、文件、封存、git diff --check 與 npm run verify 均已通過。verify 完成兩次一致建置、語法、撤除標記、唯一讀取器相關契約與暫存封裝／校驗，不覆寫舊 Release。完整結果保存於 .work/v227/verify.log，原案例多重集合對照無缺漏。

## 政策映射與契約保留

一般需求比 1.2 改判足速，備援分散使用近期足速且 1 倍門檻；原始來源可憑同組更佳證據勝出，冷啟動同分依候選序號。真實 Native 主線可能改選精確備援，測試在 base／backup 中核對相同授權。保留名稱、事件與副作用斷言，沒有刪除有效案例或用常值通過。

舊 V226 T01 兩參數案例改明確使用 2 Mbps 影片，使第三筆單樣本折扣後仍足速，隔離「舊備援不能搶回健康新路線」；新案例另驗單筆不足且有近期足速替代會重選、沒有替代則保留。原未來完成時間替身改為當次時鐘內的真實順序；雙 EWMA 取代分位數數值預期。排名裁切案先建立真實親和再加入十四個更快來源，仍斷言同一決策、目前主機與不在前十二排名。早重試替身明確給本文速度，原資格斷言保持。完整映射見 [測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v227-選路與容量政策對照)。

三頁、單次快照、按需詳細狀態、失效視圖、Native／Catalog／固定／禁止／停用、恢復額度及還原、過期授權、重入／並行、取消、晚到與資源釋放皆沿用原具名契約；兩主機兩表示的 96 種有限交錯仍通過。

## 固定合成模型對照

[離線對照工具](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/routing-evaluation.mts) 使用基準真實純政策與目前真實純政策，共十個固定場景；輸入 SHA-256 為 `41783c5c6cd5c0f38e4b259325fd2b36027b255741f6cb69cc024fea18e68a05`。未來供片與選擇分離；沒有將未選來源缺值算失敗。單位為毫秒／bytes；以下探測均相同最多三個、每個 192 KiB／三秒最壞上限記帳。這是首段模型，未執行 RecoveryController，重載零是模型範圍，不能宣稱真實重載減少。

| 場景 | 主機：舊→新 | 首段可用 ms | 緩衝不足 ms | 新換站 | 新下載 bytes | 新探測數／bytes | 新重載 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| original-faster | catalog.example → original.example | 400.0 → 266.7 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| healthy-current | original.example → original.example | 800.0 → 800.0 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| fresh-insufficient | catalog.example → catalog.example | 400.0 → 400.0 | 0.0 → 0.0 | 1 | 1000000 | 0／0 | 0 |
| historical-capacity | catalog.example → original.example | 400.0 → 266.7 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| small-response | catalog.example → original.example | 306.6 → 61.8 | 206.6 → 0.0 | 0 | 65536 | 0／0 | 0 |
| large-body | catalog.example → catalog.example | 1100.0 → 1100.0 | 100.0 → 100.0 | 0 | 8000000 | 0／0 | 0 |
| unknown-size | catalog.example → original.example | 400.0 → 266.7 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| reserved-exploration | catalog.example → original.example | 3400.0 → 3266.7 | 2400.0 → 2266.7 | 0 | 1589824 | 3／589824 | 0 |
| expired-isolation | catalog.example → catalog.example | 400.0 → 400.0 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| future-divergence | catalog.example → original.example | 300.0 → 5000.0 | 0.0 → 4000.0 | 0 | 1000000 | 0／0 | 0 |

original-faster 與小請求模型可減少等待；future-divergence 則新版選擇實際較慢，明確保留反例，沒有宣稱所有網路分布改善。reserved-exploration 以相同三次預算接觸未知來源。工具四案只驗證模型重現性與政策對照；真實量測資源上限由控制器契約驗證。原提前重試效用 FAIL 仍獨立保留，不混入 verify 全綠。

## 安全差異

Codex Security 掃描 0eaaf6bd-c86d-48fa-af4e-6d621c48323f，固定 048b0f9..5ca6b0c。前置能力通過；獨立架構檢查後由父審查與三組檔案審查完整覆蓋 51 個變更來源／工具／配置／測試檔，未發現成立安全漏洞、待釐清候選或未審檔案。正式產物已封印：report.md、scan-manifest.json、findings.json、coverage.json、threatmodel.md 及 SARIF。範圍為固定程式差異，不等同所有瀏覽器排程／平台隔離證明；後續版本、文件與原件搬移不變更已掃描的程式。

## 交付與安裝範圍

v2.2.6 五份原件已移至 archive/retired/releases/Release/v2.2.6，大小、SHA-256、修改時間與原始位元組均一致；三份追加日誌及研究原文前綴完整保留。v2.2.7 腳本 473572 bytes，SHA-256：`b003602488183398bc9af5a7d4ed42e3280719e794b528b20c81c3387df9b672`。本機五份產物由鎖定工具封裝，公開 main／標籤／唯一附件／latest 核對於發布後追加至現行報告，不回寫封裝快照。本次未執行安裝驗收，不啟動歷史窗口。

## 發布後公開核對（2026-11-03）

核對時間 2026-11-02T19:17:44.292Z（Asia/Taipei 03:17:44）。發行提交及遠端 main／v2.2.7 解參照均為 `80935889d8c01a7f56f4815509f8a3ef034a0303`；正式 [GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.7) 非 draft／prerelease，唯一附件為 BiliCDN_TW.user.js。

公開版本附件與 latest 均實際下載並逐 bytes 比對本機封裝：版本 **2.2.7**、**473,572 bytes**、SHA-256 `b003602488183398bc9af5a7d4ed42e3280719e794b528b20c81c3387df9b672`；GitHub asset digest 亦一致。來源為正式附件與既有更新網址，不啟動瀏覽器或安裝腳本。結果保存 .work/v227/public-verification.json。

發行後 main 僅追加本次核對與工作結案文件；v2.2.7 標籤與五份 Release 快照保持發行原件。三份日誌、研究原文前綴與上一版完整報告再次核對，未更動已掃描的程式或測試。文件／封存／差異檢查通過；安裝版仍未驗證，歷史提前重試效用 FAIL 與停止決策均保留。

## 歷史驗證導覽

[v2.2.6 完整正文與 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v226-完整正文保存2026-11-03)；[所有歷史與停止決策](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。目前工作只在 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

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

舊錨點原文見上列 v2.2.6 完整保存，僅作相容導引。

## v2.2.7 R1 基本安裝驗收（2026-11-03）

使用者已更新並明確授權本輪，基準 main 3950c00e2c15df09aae1bbaa0cc96bce62f7d9df／發行標籤 v2.2.7。只用一個新建 IAB 分頁、指定片 BV1tFZZBQE57／P1／Auto；沒有重新安裝、要求前景、本機服務、故障注入、強制畫質或重開舊矩陣。

T0 保守採第一次 inventory 前的 UTC 時鐘讀值，Asia/Taipei **20:47:07**，精度一秒；21:12:07 起保留清理、21:17:07 硬截止。初始記錄曾把 inventory 中的分頁 metadata 時間 20:47:14.618 誤當 T0，原檔保留並改用更早時鐘，縮短而非延長預算。首次 inventory 的獨立單調起點未量測；正式播放窗口均有頁內單調起訖。瀏覽器工作於 **21:10:29** 清理完成，文件結案在截止前完成，沒有追加輪次。

### R1 結果與範圍

**核心 8／8 PASS；條件式 I6 證據不足。** 一般播放與設定依自己的有效證據成立，不要求完整 Network 或探測自然出現。以下未實測分支不改判 PASS。

| 案例 | 結果 | 實際證據 |
| --- | --- | --- |
| E0 能力 | PASS | type=iab；同源 CDP 讀寫、實際 isTrusted 滑鼠事件與清理成立，未操作外部 Chrome |
| I0 安裝身分 | PASS | Tampermonkey 5.5.1／2.2.7；已載入完整本體與發行檔逐 bytes 相符，473,572 bytes／SHA-256 b003602488183398bc9af5a7d4ed42e3280719e794b528b20c81c3387df9b672；Runtime／Transport／ControlCenter 各一，Fetch／XHR 安裝與所有權快照 installed |
| I1 Auto 1 倍 | PASS | 60,003.9 ms、242 筆；前進 60.000786 秒，全程靜音、無暫停／尋位／結束／媒體錯誤，沒有兩秒無進度 |
| I2 Auto 2 倍 | PASS | 60,001.3 ms、242 筆；前進 119.916792 秒，全程靜音、無暫停／尋位／結束／媒體錯誤，沒有兩秒無進度 |
| I3 容量與倍率 | PASS | 安全吞吐、當前主機、近期容量、需求及餘裕均有實際值；1／2 倍的原生倍率、模型及畫面一致，影音 206 摘要各自呈現 |
| I4 三頁與詳細狀態 | PASS | 正常可信入口、總覽／CDN／播放設定切換、詳細文字原先為空且點擊後建立、關閉重開成功；沒有退役頁面 |
| I5 Native 保存 | PASS | 原始 false 經可信 checkbox 變為 true，實際 GM 持久值讀回 true；核對當次寫入修訂後再由 UI 復原 false，其他設定保持 |
| C0 清理 | PASS | 兩個自動截止觀察器、一次性輸入觀察、斷點／Debugger、遠端引用與 UI 訂閱均釋放；暫停並保持靜音、恢復 1 倍後關閉唯一自有分頁，剩餘零個 |
| I6 自然起播／探索 | 證據不足 | startup=skipped、xhr-explicit-timeout、candidates=0；網站明確 timeout 的正常跳過與畫面提示相符，未消耗起播窗口，但不能算三候選／探索名額實測通過 |

開始時 Auto 曾選 3840×2160，兩個正式窗口均為 **1280×720／av1**；沒有強制畫質，不宣稱本輪完成 4K／8K 窗口。開始至真正媒體靜音讀回的區間不計播放窗口；沒有追加起播前靜音門檻。

### R1 數值、來源與限制

同份模型／UI 核對的 1 倍讀值為安全吞吐 **32.358223 Mbps**、需求 **2.00 Mbps**、餘裕 **16.179111 倍**（畫面 32.36／16.18）；2 倍為 **10.850675 Mbps**、需求 **2.083395 Mbps**、餘裕 **5.208170 倍**（畫面 10.85／2.08／5.21）。兩次皆為目前影片主機 upos-sz-mirroraliov.bilivideo.com 的近期充分容量。該 720p 表示 bandwidth=833358；1 倍觸及 2 Mbps 下限，2 倍按真實倍率計算，所以此片需求不會恰好翻倍；兩次速度亦有新樣本，不能將全部餘裕變化歸因倍率。

準備期間亦觀察到影片由 upos-sz-mirroralib.bilivideo.com 回應，音訊由 upos-sz-mirroraliov.bilivideo.com 回應；正式總覽核對時兩者均有各自 206 摘要。這些是腳本歸因的正常傳輸，不是「測速抽中的節點」，也不冒稱獨立 Chrome Network 最終目的地證明。未觀察到起播主動探測或完整健康輪次，沒有為湊條件增加流量／重設冷卻。關閉的提前重試與三個 HK override 原值保持；沒有清除學習或既有禁止資料。

三候選探索、隔離到期再驗證、五分鐘／24 小時到期、主動完成期限決策、HTTP 故障、過期許可、重載／補正及提前重試效用均未另開安裝矩陣。詳細狀態有目前請求完成預估，這只證明當前顯示資料可用，不證明預測準確或模型效益。原 FAIL／INVALID、停止決策及現場唯一根因未確認狀態保留。

網站入口需先展開「更多播放设置」。一般 AX／locator 無法讀取產品封閉 Shadow DOM，改用限定 CDP 原生滑鼠與唯讀節點內容核對；沒有修改 isTrusted、直接呼叫產品命令或改造媒體 getter。倍速使用真正 HTMLMediaElement setter 並讀回，無控制器重建或 tick 呼叫。

### R1 證據與清理

私有去敏證據位於 .work/iab-testing/2026-11-03-v2.2.7-3950c00-r1：BASELINE（含原始時間記錄與修正）、IDENTITY、INITIAL、INPUT-CALIBRATION、I1／I2 原始連續樣本與模型、I3 數值、I4 三頁／詳細／重開、I5 持久讀回／復原、CASES、SUMMARY、CLEANUP、CHECKPOINT／RERUN 與實際截圖。未保存簽名媒體 URL、Cookie、IP 或播放器物件。

原生媒體在清理時 paused=true、muted=true、rate=1；控制中心關閉、訂閱零、視圖與鍵盤釋放，工具 registry 均不存在、無自有攔截／持有請求／包裝／受控樣本；遠端物件引用釋放，自有 IAB 分頁零個。產品、測試、版本、Release 及標籤保持；本次僅更新文件並執行文件／封存／差異與原件核對，不冒稱重新跑過 1,931 案。是否有新工作只看 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## v2.2.7 XHR timeout 起播分支調查（2026-11-03）

依使用者新要求，以 main d8087ef 的現行程式調查正數 XHR timeout 是否讓起播測速失去作用；只調查與記錄，未修改產品或測試。使用一個新 IAB 分頁，指定 BV1tFZZBQE57／P1／Auto／1 倍，從自然導覽觀察，沿網站既有進度續播，沒有清快取、重設起播額度、改 timeout、製造請求或故障注入。導覽後立即將真正媒體靜音並讀回。

### 實際分支結果

固定窗口為 Asia/Taipei **21:28:05.543–21:29:35.543**，共 90 秒，包含初始導覽。使用自動截止且不暫停的五個條件觀察點，分別位於 XHR send 入口、起播等待分支、正數 timeout 略過分支、媒體 Fetch 與 prepareStartup 入口；僅記錄種類、數值及工具內請求識別，不保存媒體 URL。已載入完整腳本與 v2.2.7 發行本體相符：473,572 bytes，SHA-256 b003602488183398bc9af5a7d4ed42e3280719e794b528b20c81c3387df9b672，匹配腳本來源一份。

| 項目 | 當時工具統計 |
| --- | --- |
| 影片 XHR send | 48 筆，全部正數 timeout，全部配對到實際略過分支 |
| 音訊 XHR send | 38 筆，全部正數 timeout，全部配對到實際略過分支 |
| 合計 | 86／86，均為非停用狀態的非同步 GET |
| timeout 範圍 | 5,000–19,000 ms；首筆影片及音訊皆為 10,000 ms |
| XHR 起播等待／prepareStartup | 各 0 次 |
| 媒體 Fetch 攔截入口 | 0 次 |

XHR send 入口另有 86 筆非媒體呼叫，不混入分母。上述數量是適配器送出呼叫及實際分支命中，不宣稱全部成功完成或等同獨立 Network 最終目的地證據。事件以同一游標持續排空，工具回報 truncated=false。固定窗口後不追加資料或輪次。

**判定：本次指定影片的自然影音請求全部走到正數 timeout 略過分支，起播測速確實未啟動。** 不能擴張為所有影片、OGV、所有帳戶或其他播放器版本都必定相同；但現行條件對任何正數 timeout 都會排除起播等待。

### 原因與影響範圍

[XHR 條件](https://github.com/YUIAOI7592/BiliCDN_TW/blob/d8087ef0194ff3bbab2d32a2a7d50b9ae3f88db8/src-v2/adapters/xhr-hook.ts#L454) 要求 this.timeout === 0，才會繼續檢查 willGateStartup 並呼叫 prepareStartup；正數直接記錄 preflight-skipped:xhr-explicit-timeout，再執行正常 perform。沒有將 timeout 與三秒起播期限比較，所以 10 秒、19 秒也全部排除。這是專案保留原生逾時行為的相容政策，不是瀏覽器禁止對有 timeout 的 XHR 測速。

[noteUnpreflighted](https://github.com/YUIAOI7592/BiliCDN_TW/blob/d8087ef0194ff3bbab2d32a2a7d50b9ae3f88db8/src-v2/application/measurement-controller.ts#L249) 只更新可用窗口的目前顯示，不消耗或關閉起播租期。「未消耗窗口」不能解讀為已完成測速；後續請求若也全部被略過，窗口就一直未使用。普通選路與被動速度學習仍可執行；健康探索是另一條流程，本次沒有據此判定它失效。

同一條件至少可追溯到 03beb91（v2.1.7），原 S06 調查已列出覆蓋風險。現有 adapters 與 B2 契約刻意斷言明確 timeout 立即原生送出；它們證明相容政策保持，沒有證明網站實際請求能進入起播測速。原 R1 基本播放 PASS 保留，I6 原本的證據不足不改為 PASS；本次補上該路徑確實未啟動的證據。

後續修復需要同時定義有限 timeout 下的起播等待、原生計時起點、取消及晚到工作契約，不能只把網站 timeout 清零或直接移除 guard。這是建議，尚未實作或授權新的實測窗口。

### 證據保存與工具限制

原始工具文字輸出保存在 .work/xhr-timeout-review-2026-11-03/EVIDENCE.json，包含首批請求、完整本體核對、最終統計與五個觀察點移除結果。工具工作階段後續失去原有變數，完整逐筆陣列未落盤；只保留當時實際輸出的摘要與首批樣本，不冒稱可由保存檔逐筆重算全部 86 筆。

五個觀察點已於 **21:31:26.438** 移除；額外的管理器／singleton／租期唯讀核對遭自動審查逾時，沒有取得該次新讀值，不沿用舊分頁身分冒稱本輪完整安裝驗收。工作階段變更後的 inventory 顯示 IAB 分頁零個；未取得原分頁最後 pause／Debugger.disable 的讀回，因此不宣稱完整清理契約 PASS，也不重開分頁補跑。已完成的請求分支統計與這些未取得的額外證據分開記錄。本次不形成新的播放、效能或完整安裝驗收通過結論。


## v2.2.8 完整正文保存（2026-11-05）

現行結果見[最新版報告](../../../docs/TEST_REPORT.md)；以下原始完整正文包含當時全部限制，不回寫。

# BiliCDN_TW v2.2.8 正數 XHR timeout 起播修復驗證

驗證日期：2026-11-03／04（Asia/Taipei）。固定基準 main ddd41a0ad91a9a5673e8944ff86c5cb234f46443／v2.2.7；程式與測試審查固定至 6840815281b0cfb1d70409123b4aae66dd1b8ba8。先保存基線與失敗回歸，再修改執行期，各階段獨立提交。

## 驗收結論

**最終判定：v2.2.8 本次正數 XHR timeout 專項驗收通過（R2，8／8 PASS）。** 已確認正數 timeout 的影片請求啟動起播測速，等待後保留網站 timeout 原值，原生 send 接受後收到可信 206；清理完成。逐項證據見 [R2 完整紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#v228-r2-專項完成2026-11-0304)。八項包含五項安裝行為、兩組原生 API 校準及一項清理；兩組校準合計六案，與產品安裝證據分列。

本文依離線／發布、R1、R2 的時間順序保留原紀錄。R1 的證據不足、未執行及工具超時描述各自當時的檢查點；後續完成判定由 R2 的新增直接證據支持。原始判定、歷史限制及發行快照保留。

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

發行檢查點當時安裝版尚未驗證；使用者更新後的原始觀察見 [R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#v228-r1-正數-timeout-專項2026-11-03)，後續專項通過結果見 [R2](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#v228-r2-專項完成2026-11-0304)。各輪指定片 P1／Auto／1 倍、單一 IAB 分頁、窗口及清理時限分別記於對應段落。一般播放正常不代替起播證據；前提不足不改 timeout、重設額度或自動補跑。永久靜音、無網站服務與不要求前景的規則保持。

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

正式 [v2.2.8 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.8) 已發布，非 draft／prerelease，唯一附件為 BiliCDN_TW.user.js。發行提交與標籤解參照為 b58bad4c72aefa6e090a2e0814f01c86ff58ceba；公開核對當時 main 相同，後續 main 僅維護文件，不移動標籤。

版本附件與公開 latest 均實際下載並與本機逐 bytes 比對：版本 **2.2.8**、**474,008 bytes**、SHA-256 `7573766cb33a425a109b5edb2649998e1cf90b6d7f3d8dddf052e338c6bd6027`，GitHub asset digest 亦一致。核對時間為 Asia/Taipei **22:50:03**；原始公開核對保存在 .work/v228/public-verification.json。

上一版五份原件、完整報告及三份追加日誌前綴均按原始 bytes 核對；本版五份產物、建置來源雜湊及已掃描程式未變亦通過。該次發行核對於文件／封存／差異檢查後提交推送 main，當時尚未進行 v2.2.8 安裝驗收。後續 R1 原始觀察與 R2 通過結果分列下文；發行原件、修前調查限制及歷史停止決策保持，沒有再次升版、封裝或發布。

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


## v2.2.9 完整正文保存（2026-11-05）

現行結果見[最新版報告](../../../docs/TEST_REPORT.md)；以下原始完整正文包含當時全部限制，不回寫。

# BiliCDN_TW v2.2.9 完整驗證報告

日期：2026-11-05（Asia/Taipei）。以 304c631 為基準，修正傳輸與探測單調計時、清理前凍結、有效 bytes 核對，以及實際倍率／快照年齡與播放事實失效；保留原選路與 Catalog-only 起播早放政策。

## 驗收結論

本版採離線驗證交付；十八套件／2,021 案通過，failed／cancelled／skipped／todo 均零。安裝版、來源隔離與實機效益未測，不啟動瀏覽器、不恢復已停止窗口。型別、架構、完整測試、唯讀格式、文件、封存、git diff --check 與 verify 已通過。兩次建置、語法及暫存封裝校驗通過；公開交付核對在發布後追加。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10，命令確認不啟動網站服務。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 81 | PASS |
| state | 42 | PASS |
| application | 771 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 84 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 92 | PASS |
| tooling | 201 | PASS |

原 1,982 案名稱、kind 與參數展開以多重集合核對，政策差異見[測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md)。新增案例只補充契約，不刪除原有效斷言。原始結果及失敗回歸保存在本機 .work/v229，不作正式工具輸入。

## 模型與誤差界線

[固定數字模型](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/README.md#選路模型對照) 區分量測語意、快照年齡、表示與服務情境。獨立算式一致只證明實作計算，合成 Auto、FPS、VBR 或交接成本不是現場參數，也不是未來分位數保證。舊探索性資料未取得獨立核對的部分保持未知。

## 安全差異

Codex Security 掃描 5bb8484b-8697-46b3-bc49-559e32fea3a0，固定提交範圍及逐檔審查結果由工作台管理。能力前置檢查及全部變更來源／測試／工具的獨立來源審查已完成，成立漏洞、未結候選與未審檔案均零；正式產物已封印並讀回。來源掃描不代替原生瀏覽器計時或安裝證據。

## 交付與安裝範圍

前版 v2.2.8 五份原件按原始位元組封存並核對 SHA-256；本版腳本 485880 bytes；SHA-256：`ed2e5cd6f9959b49ed588118d52c7d8c5b3229e50d82ebc86442fadda75df6bf`。五項本機產物按鎖定工具封裝，公開 main／標籤／唯一腳本附件／latest 核對於發布後追加，發行快照不回寫。不改使用者 Native 預設、既有布林值、schema 2、四鍵或三頁操作。沒有新增診斷、原線對照、掉幀收集、剪貼簿、探測或恢復額度。

## 歷史驗證導覽

2026-11-05 公開交付核對：main 與 v2.2.9 均為 7ddae23e68361884e9709e3d82af31560e18675e；GitHub 正式 Release 只有 BiliCDN_TW.user.js。附件及公開 latest 皆為 2.2.9／485,880 bytes，SHA-256：`ed2e5cd6f9959b49ed588118d52c7d8c5b3229e50d82ebc86442fadda75df6bf`，與本機原件一致。v2.2.9 離線交付完成；安裝版未測。後續文件提交不移動標籤。

[v2.2.8 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-完整正文保存2026-11-05)，含原先已批准驗收及限制；[研究與執行計畫](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/MEASUREMENT_ROUTING_OPTIMIZATION_v2.2.9-v2.2.10_2026-11-05.md)。目前工作只見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

<a name="bilicdn_tw-v228-正數-xhr-timeout-起播修復驗證"></a>
<a name="修復結果與證據邊界"></a>
<a name="失敗回歸與契約對照"></a>
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
<a name="v228-r1-正數-timeout-專項2026-11-03"></a>
<a name="v228-r2-專項完成2026-11-0304"></a>
<a name="r2-窗口候選與證據"></a>
<a name="原生校準與工具限制"></a>

舊錨點僅保留相容導引，原文見上列歷史保存。

## v2.2.10 發布後補驗導引（2026-11-05）

R1／R2／R3 原始判定保留於現行 [TEST_REPORT](../../../docs/TEST_REPORT.md#v2210-r1-安裝版驗收2026-11-05)。新授權 R3 的播放／UI 與 R4 的正數 timeout 結果另見 [R4 銜接紀錄](../../../docs/TEST_REPORT.md#v2210-r4-正數-timeout-專項2026-11-05)，不回寫各輪原始限制或發行時點狀態。

使用者後續授權將上述本機紀錄提交推送 main；[2026-11-05 文件一致性核對](DOC_MAINTENANCE_HISTORY.md#v2210-驗收通過狀態一致性核對2026-11-05) 保存此次交付範圍。各輪原始限制與原先只存本機的時點敘述仍保留，不表示已發布快照同步改寫。

## v2.2.10 熔斷研究導引（2026-11-05）

後續[熔斷研究](CIRCUIT_BREAKER_RESEARCH_v2.2.10_2026-11-05.md#研究結論) 只分析現況與候選政策。來源隔離遇到協定限制，相依安裝自然觀察未啟動；不改判既有驗收，也不將離線模型寫成新的安裝證據。原始執行限制、數字索引及後續建議由單一研究報告保存，目前工作狀態由 [TODO](../../../docs/TODO.md) 維護。


## v2.2.10 完整正文保存（2026-11-06）

以下原始完整正文包含 R1–R4、原始判定、方法限制與已通過結論；現行結果見[最新版報告](../../../docs/TEST_REPORT.md)。

# BiliCDN_TW v2.2.10 完整驗證報告

日期：2026-11-05（Asia/Taipei）。沿用 v2.2.9 的量測與時間修正，完成相同量測語意估計、足速候選跨組完成排序、所有合法模式首個足速早放，以及含兩秒交接預算的提前重試；保留網站 timeout、唯一控制所有者與既有資源上限。

## 驗收結論

本版採離線驗證交付；十八套件／2,048 案通過，failed／cancelled／skipped／todo 均零。發行時安裝版、來源隔離與實機效益未測；發布後新授權 R3／R4 已完成本次基本播放、UI 及正數 timeout 補驗，方法偏差與結果見下節，不等於完成實機效益校準或歷史矩陣。本版型別、架構、完整測試、唯讀格式、文件、封存、git diff --check 及最終 verify 已通過；兩次建置、語法與暫存封裝校驗一致。兩份安全差異已封印；公開交付核對在發布後追加。

**v2.2.10 本次安裝驗收通過並清理完成。** 依據為 [R3 的 I1／I2／U0／U1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#v2210-r3-補驗2026-11-05) 及 [R4 的 T0／Z0](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#v2210-r4-正數-timeout-專項2026-11-05)；各輪原始 PASS、INVALID、未執行／未驗證與限制仍按原輪次閱讀。未按十秒落地及採樣粒度限制保留，不宣稱整套取證方法、所有影片／模式或實機效益校準通過。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10，命令確認不啟動網站服務。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 97 | PASS |
| state | 42 | PASS |
| application | 780 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 84 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 92 | PASS |
| tooling | 203 | PASS |

原 1,982 案名稱、kind 與參數展開以多重集合核對，政策差異見[測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md)。新增案例只補充契約，不刪除原有效斷言。原始結果及失敗回歸保存在本機 .work/v229，不作正式工具輸入。

## 模型與誤差界線

[固定數字模型](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/README.md#選路模型對照) 區分量測語意、快照年齡、表示與服務情境。獨立算式一致只證明實作計算，合成 Auto、FPS、VBR 或交接成本不是現場參數，也不是未來分位數保證。舊探索性資料未取得獨立核對的部分保持未知。

## 七步交付對照

| 步驟 | 實作及正式證據 |
| --- | --- |
| ① 基線與身分 | 304c631／原 1,982 案；研究獨立提交 eae7840；資料字典與停止狀態保留 |
| ② 量測方法 | v2.2.9 單調時鐘、清理前凍結、實收量與可見標頭核對、timingBasis；合法可達性與速度分離 |
| ③ 播放期限 | 實際倍率／連續緩衝與單調年齡，兩秒邊界及 Observer 失效通知；v2.2.9 已獨立發布並公開核對 |
| ④ 估計校準 | 相同語意近期樣本；十六個固定合成場景，預測只用送出前完成資料，原 EWMA 與數值保持 |
| ⑤ 起播 | 所有三種合法來源、開關關閉、當前倍率需求、唯一期限、取消及晚到最快結果均有回歸 |
| ⑥ 選路與重試 | 足速跨充分程度完成比較／整組退回；兩秒交接、完整重送、剩餘 bytes 與失敗重選提示 |
| ⑦ 驗證與交付 | 兩版各自完整離線、安全、封裝與公開核對；安裝版均另案 |

原 1,982 案及 v2.2.9 新增的 39 案完整保留；v2.2.10 再加 27 案，共 2,048。補充回歸先確認缺提示時會選較差的本文期限，再修正三個失敗入口；初次前置修訂未完整的試作輸出不作有效失敗證據。

## 固定合成對照與取捨

輸入 SHA-256：`e6523280ae5214137a99434f65fbea37a8c3c76dc972c70a0a205237e33dc5a2`。十六場景、各版十四筆可計誤差的預測；各有一筆選中服務未知，取消／未完成為零，未選來源缺值不列失敗。

| 指標 | 固定 v2.2.8 政策 | 本版政策 |
| --- | ---: | ---: |
| 平均絕對誤差 | 1,591.732 ms | 1,592.713 ms |
| 期限誤判 | 4 | 3 |
| 全模式早放算例等待 | 3,000 ms | 800 ms |

早放算例會選到足夠快但非整輪最快的路線；等待、各主機未來供片、下載、換站及表示軌跡均逐案輸出。兩秒交接算例將原可重試改為拒絕：這是已批准的保守取捨，並不保證停滯更少。探測部分下載用線性交付假設，三候選／每候選 256 KiB 上限相同；恢復未模擬，重載零是建模設定。Auto／4K／60000÷1001 FPS／VBR 僅為明列的外生壓力輸入，沒有還原網站閉環或解碼服務率。

既有六情境 `evaluate:early-retry` 另行執行為有效 **效用 FAIL**：不能滿足所有慢場景都改善及所有正常場景都不介入；原程式退出碼 1 與逐案結果保留，不更改舊效用門檻或稱作 PASS。它的「所有慢場景均介入改善」與本次明確採用的兩秒保守抑制不同；此結果列為效益限制，不冒充離線功能／安全契約失敗或已完成實機校準。完整測試、verify 與安全仍須獨立通過。

## 安全差異

Codex Security 掃描 68d06a33-f3d7-45a7-8eb9-abfe49533867，固定提交範圍及逐檔審查結果由工作台管理。前置檢查及固定 41763c5..faf9b1a 的 32 個來源／測試／工具全部審查，成立漏洞與未結項目零；補充掃描 68060141-20da-4e0b-b08c-4500d59dbc26 固定 faf9b1a..f9157f3 四檔，核對失敗重選提示及有效斷言補強，同樣無成立項目。兩份正式產物已封印並讀回。來源掃描不代替瀏覽器計時或安裝證據。

## 交付與安裝範圍

前版 v2.2.9 五份原件按原始位元組封存並核對 SHA-256；本版腳本 488579 bytes；SHA-256：`361b8d22a3b62b72fc671e3c440b4b089e8d3cc96a77050baf011b2b7aa5812f`。五項本機產物按鎖定工具封裝，公開 main／標籤／唯一腳本附件／latest 核對於發布後追加，發行快照不回寫。不改使用者 Native 預設、既有布林值、schema 2、四鍵或三頁操作。沒有新增診斷、原線對照、掉幀收集、剪貼簿、探測或恢復額度。

## 公開交付核對

2026-11-05 公開核對：main／v2.2.10 發行提交為 18b9cc90bd31e4f6ee4467a80f52b4562a30c7aa；[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.10) 只有 BiliCDN_TW.user.js。版本附件與公開 latest 皆為 2.2.10／488,579 bytes，SHA-256：`361b8d22a3b62b72fc671e3c440b4b089e8d3cc96a77050baf011b2b7aa5812f`，與本機五項封裝一致。後續文件提交只前進 main，不移動 v2.2.10 標籤。

v2.2.9 已先完成獨立發布核對，原發行提交 7ddae23、485,880 bytes／ed2e5cd6f9959b49ed588118d52c7d8c5b3229e50d82ebc86442fadda75df6bf；五份原件與完整報告保留於前版封存。兩批離線交付完成。R1 當時只完成部分安裝身分與觀察；後續基本播放、UI 與正數 timeout 的完成範圍以本報告驗收結論及 R3／R4 為準，原生計時的完整校準與實際效益仍未成立。

## 歷史驗證導覽

[v2.2.9 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v229-完整正文保存2026-11-05)，含原先已批准驗收及限制；[研究與執行計畫](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/MEASUREMENT_ROUTING_OPTIMIZATION_v2.2.9-v2.2.10_2026-11-05.md)。目前工作只見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

<a name="bilicdn_tw-v229-完整驗證報告"></a>
<a name="bilicdn_tw-v228-正數-xhr-timeout-起播修復驗證"></a>
<a name="修復結果與證據邊界"></a>
<a name="失敗回歸與契約對照"></a>
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
<a name="v228-r1-正數-timeout-專項2026-11-03"></a>
<a name="v228-r2-專項完成2026-11-0304"></a>
<a name="r2-窗口候選與證據"></a>
<a name="原生校準與工具限制"></a>

舊錨點僅保留相容導引，原文見上列歷史保存。

## v2.2.10 R4 正數 timeout 專項（2026-11-05）

**T0 PASS、清理 PASS；連同 R3，完成本次要求的播放、UI 與正數 timeout 補驗。** R4 只補 T0，沒有重測已通過項目。R3 的未驗證及 R1／R2 原判定保持，以本輪新證據銜接。

使用者明確批准最多十五分鐘、最後五分鐘清理的新輪次。21:58:23.146 起計，清理預留起點 22:08:23.146、硬截止 22:13:23.146；22:05:24.521 已關閉唯一自有分頁並讀回 IAB 清單為零，總計約七分一秒。先在首頁準備，再導覽指定 BV1tFZZBQE57／P1／Auto 一次，立即將真正 VIDEO 靜音並讀回；實際倍率 1，未更動設定或網站 timeout。初次建頁批次因沒有強制檢查空分頁前提而遭自動審查拒絕，改為先確認 IAB 清單零個才建立，安全檢查通過後繼續。

| 證據 | 結果 |
| --- | --- |
| 本文件身分 | v2.2.10 完整本體匹配 488,579 bytes 發行檔；Tampermonkey 5.5.1，Runtime／ControlCenter／TransportAdapter 各一個，Fetch／XHR installed。實際來源名稱與包裝一行偏移成立，十個觀察點均解析到預備行號。 |
| 唯一起播窗口 | 一次影片窗口，三個 Catalog 候選 mirrorali／mirrorbos／mirrorcos；各 512 KiB 上限，三個有效 HTTP 206 探測。需求約 29.107 Mbps，各候選未達足速，選定最快有效 mirrorali；不足速結果不妨礙證明起播測速有執行。 |
| 同請求配對 | api-xhr-9：video、非同步 GET、非 playurl，入口及 gate 均為 13,000 ms；gate 後等候本輪結果，原生送出及 accepted 仍為 13,000 ms；其後 trusted load／success／HTTP 206，10,313 bytes。只有一次原生送出紀錄。 |
| 相對時序 | 以紀錄器起點計：入口 2785.5 ms、gate 2786.4 ms、測速結果 3550.5 ms、send 3553.4 ms、accepted 3553.5 ms、成功終止 3680.1 ms。該等待者加入已開始的共用窗口，等待約 767.9 ms；整輪耗時不能與此等待者耗時混為一談。 |
| 有界資料 | 原九十秒收集範圍中 519 筆、序號完整連續、overflow=0／errors=0，所有列均在原截止前。沒有依賴整站 Network 完整性。 |
| 清理 | 設定前後逐值相同、倍率仍為 1；真正媒體 paused=true／muted=true，移除所有自有觀察點、兩處暫存屬性及物件群，解除 Debugger，分頁清單零個；未建立攔截或計時器。 |

本輪工具限制：Tampermonkey 的詞法 globalThis 暫存與 Runtime 預設／指定執行環境的 globalThis 讀值不同，最初直接讀回為空。後續在同一自然請求的非暫停觀察點，將原來已收集的去敏數字轉交到 document 自有暫存屬性，成功完整取回，並於清理中核對原作用域及 document 屬性皆刪除。這是既有資料取回，沒有重啟起播或重設收集截止。原定每十秒落地未達成，已列為方法偏差；原有完整連續的有界紀錄可支持上述單一請求配對，不能宣稱十秒排空方法已通過。暫存觀察語句有時序開銷，這些耗時不作效能校準或選路收益結論。

獨立離線稽核核對來源身分、序號、窗口、候選、同請求 timeout／終止、設定及清理，結果保存本機 `.work/iab-testing/2026-11-05-v2.2.10-9f150a8-R4/AUDIT.json`；其他去敏原件包含 PREPARE、SOURCE、IDENTITY、RECOVERED、PAIRS、T0_EVIDENCE、CLEANUP、CLOSED 與暫停截圖。沒有保存簽名 URL 或播放器／核心物件。此結果只證明本片本輪的自然正數 timeout 請求；不外推為所有影片、XHR timeout 數值或完整模型效用驗證。產品、正式測試、版本及 Release 不變，不提交推送或發布。

## v2.2.10 R3 補驗（2026-11-05）

**一般播放與 UI 補驗通過；T0 正數 timeout 未驗證，因此整輪未全部通過。** R1／R2 原判定保留。本輪由主代理操作，實際 inventory 有 IAB 且成功建立唯一自有分頁，不能將 R2 子代理的限制推論為所有代理不可用，也不能據此推定當時差異的根因。

能力檢查起點為 21:29:30.022，清理預留起點 21:54:30.022、硬截止 21:59:30.022；21:47:09 已取得暫停靜音及倍率復原讀回，隨後關閉分頁並核對 IAB 清單為空，早於清理預留起點。固定 BV1tFZZBQE57／P1／Auto，只導覽一次；網站從既有播放位置接續，未強制畫質、重設預算或重新整理。沒有要求前景、外部瀏覽器或本機網站服務。

| ID | 結果 | 證據及限制 |
| --- | --- | --- |
| 身分前置 | PASS | 本文件完整本體與 488,579 bytes 發行檔逐字一致；Tampermonkey 5.5.1／2.2.10，Runtime／ControlCenter／TransportAdapter 各一個，Fetch／XHR installed。 |
| I1 | PASS | 21:35:43.592 起九十秒；90 筆窗內樣本及獨立邊界，前進 89.999314 秒，最大間隔 1008.5 ms，截止晚 0.6 ms；倍率 1、靜音保持，未採樣到暫停、尋位、錯誤或連續兩秒無進度。 |
| I2 | PASS | 網站正常選單切至 2 倍並讀回；21:41:07.829 起九十秒，前進 179.996559 秒，最大間隔 1008.4 ms，截止晚 0.7 ms；90 筆窗內樣本及獨立邊界，未採樣到上述異常，總覽顯示按 2 倍速折算。 |
| U0 | PASS | 正常設定→更多播放設定→產品入口；總覽、CDN、播放設定切換，詳細文字展開／收起、關閉／重開成立。Native 原有 false、固定主機空值及倍率提示與讀模型相符；未逐欄凍結動態吞吐數字做同時點精度校準。 |
| U1 | PASS | 播放窗口結束後，提前放行 true→false；關閉重開仍 false，再復原 true 並讀回。其餘設定值保持，正常保存使 updatedAt 更新。 |
| T0 | 未驗證 | 預設來源 regex 使用 BiliCDN，但實際來源名稱為 Bilibili-CDN；十個非暫停條件斷點均未命中，沒有逐請求 timeout 配對。這是本輪觀察準備失誤，不是產品失敗或 IAB 不可用；未刷新補造起播，已移除全部觀察點。 |
| Z0 | PASS | 提前放行恢復 true、倍率恢復 1，真正 VIDEO paused=true／muted=true；兩個採樣器 dispose，registry 為空，解除 Debugger、釋放物件群並關閉唯一自有分頁，IAB 清單空。 |

操作方法修正：網站需點擊「更多播放設定」才讓產品入口實際可命中；AX 樹沒有呈現控制中心的封閉 Shadow DOM，曾造成操作者誤判尚未開啟。後續以畫面及 CDP 唯讀 DOM 交叉確認，依當前 box model 執行可信滑鼠輸入。沒有呼叫產品 show／命令、改樣式或偽造事件。截圖與 CSS 座標有差異，開關操作以 DOM 實際位置與保存值核對，不能只相信舊截圖座標。

採樣器先通過七組離線檢查，再取得本輪真實 IAB 邊界。完整性容差為最大缺口 1.5 秒／截止晚到 1 秒，兩窗均零溢位。每批保存完整有界累積數據，實際工具取回間隔不全符合原定十秒；窗內資料與自動終點沒有因此缺失，但不宣稱嚴格十秒落地已達成。暫停、尋位等以每秒狀態讀值核對，未建完整事件歷程，不能排除樣本間短暫事件。兩窗實際尺寸為 1280×720；Auto 畫質未強制，不外推為所有 4K／8K 場景通過。

私有證據位於 `.work/iab-testing/2026-11-05-v2.2.10-9f150a8-R3/`，包含離線檢查、來源身分、I1／I2 數字、UI 截圖、設定切換／重開／復原、詳細文字及清理。沒有輸出簽名 URL 或核心物件。本輪不再追加窗口；剩餘 T0 需要先修正來源匹配及可靠預備方式，另行取得新輪次授權。本次只更新本機紀錄，產品、正式測試、版本及 Release 不變，不提交推送或發布。

## v2.2.10 R1 安裝版驗收（2026-11-05）

**本輪已結案，核心驗收未完成；沒有確認產品 FAIL。** 有效的一般播放及身分結果保留，不能用無效窗口或 Network 缺口概括否定。

T0 02:06:07，觀察截止 02:21:07，硬截止 02:26:07；清理 02:22:30.109 完成。工具純執行／等待與各前置步驟未獨立計時；能力確認與完整安裝身分分開，後者占用主要觀察時段。固定指定片 P1／Auto／1、2 倍各九十秒；沒有換片、重載、預算重設、故障注入或無效重跑。

| ID | 範圍 | 結果 | 原因及證據界線 |
| --- | --- | --- | --- |
| E0 | 工具能力 | PASS | 本輪 IAB Runtime／Debugger／Network 可用；未使用外部瀏覽器或本機網站服務。 |
| I0 | 完整安裝身分 | PASS | 488,579 bytes 完整本體 SHA-256 匹配；Tampermonkey 5.5.1／腳本 2.2.10，Runtime／ControlCenter 各一個，Fetch／XHR installed。 |
| I1 | Auto 1 倍九十秒窗口 | INVALID | 未先建立有界採樣及自動終點；02:18:36.614 開始，預定 02:20:06.614，實際後讀 02:20:19.496，晚 12.882 秒。不能補算完整九十秒窗口。 |
| I2 | Auto 2 倍九十秒窗口 | 未執行 | 身分與入口操作占用時間，剩餘時間不足在固定清理時段前完成，不縮短或追加。 |
| U0 | 三頁、開關與倍率更新 | 未執行 | 控制中心入口未有效開啟；網站選單祖先 opacity=0／pointer-events=none，滑鼠及鍵盤嘗試未成功。尚未確認產品缺陷，未直接呼叫 show 或偽造可信事件。 |
| G0 | 獨立一般播放讀值 | PASS | Auto 3840×2160、1 倍、靜音；兩次讀值影片時間 1449.188907→1551.648470，總影格 31334→37476。只證明進度成立，不替代 I1 或連續無停頓判定。 |
| N0 | 獨立容量快照讀值 | PASS | 合法當前快照有吞吐與完成估計，後讀亦更新；只證明唯讀模型數值，沒有證明畫面、樣本精度或實機效益。 |
| S0 | 本輪起播提前放行 | 證據不足 | 當前 Catalog-only、早放開啟，起播三候選／adequate／measured／1524 ms；未取得足夠的逐結果時間與需求前提，不判早放 PASS 或 FAIL；Native 其餘模式未測。 |
| T0 | 正數 XHR timeout 與完整請求時序 | INVALID | 身分及入口操作期間未及時排空游標，Network truncated=true；沒有保存每筆原生送出前後 timeout，不否定一般播放。 |
| M0 | 完成估計語意、樣本時效與倍率配對 | 證據不足 | 快照有數字，但缺逐請求計時／大小／表示配對；二倍未測，不以快照數字冒稱公式或過期邊界實測通過。 |
| Z0 | 清理 | PASS | 02:22:30.109 真正 VIDEO paused=true、muted=true、rate=1；解除 Debugger／Network，釋放物件群與 REPL 引用、關閉唯一自有分頁，剩零個。沒有攔截、注入觀察器或設定改值。 |

原設定 disabled=false／Native=false／early=true／fixed=null 保持；Native=false 是原有布林，不是新預設變更。起播選定 mirroraliov；後來兩筆合法容量快照分別為 tf-all-tx 12.815 Mbps／1604.4 ms，以及 mirroraliov 566.366 Mbps／34.635 ms，不能把數字當作主動測速結果、真實容量校準或節點優劣證明。

本輪執行缺口：未先建立九十秒有界採樣與截止，且身分／入口操作期間未及時排空事件。這些是驗收執行問題，並非已確認腳本故障。後續若重新驗收，須另案凍結新期限及案例，先完成穩定入口與有界記錄；本輪不自動補跑。

證據保存於本機忽略目錄 `.work/iab-testing/2026-11-05-v2.2.10-9f150a8-R1/`，含 BASELINE、CASES、EVIDENCE、CLEANUP、REPORT 與暫停靜音截圖。公開文件只保存此去敏摘要；原始簽名 URL、完整網路內容、播放器／核心物件未寫入證據。

## v2.2.10 R2 補驗能力確認（2026-11-05）

使用者明確要求新目標完成尚未通過的驗收，並指定嘗試 GPT-6.1 Terra 執行瀏覽器操作；本次實際以 `gpt-6.1-terra`／high 啟動操作者。**目標尚未達成：IAB 當次不可用，四項補驗均未執行；沒有新的產品 PASS 或 FAIL。** R1 的 I0／G0／N0／Z0 原結果保留，沒有重測或改判。

本輪預定指定片 P1／Auto，1 倍、2 倍各一個完整九十秒窗口，以及三頁操作、自然正數 XHR timeout 的起播與原值保持。先完成可信入口及有自動截止的採樣校準，才啟動窗口；不以內部 `show()`、合成可信事件或修改 timeout／預算取代正常操作。範圍不包含重開早放全模式矩陣、完整完成模型校準或歷史故障案例。

首次 `getState()` 返回後立即取樣的近似 T0 為 21:02:02.675 +08:00，主機單調讀值 68,331,967.136 ms；這不是呼叫瞬間的精確 T0，也未與頁面時鐘相減。預定上限二十五分鐘，前七分鐘方法／身分、接續最多十三分鐘觀察、最後五分鐘清理。實際在前置能力確認即停止，沒有播放窗口或觀察時間；純工具執行／等待分界未另量測。

| ID | 本次補驗範圍 | 結果 | 實際證據與限制 |
| --- | --- | --- | --- |
| I1 | Auto 1 倍九十秒窗口 | 未執行 | 未建立 IAB 分頁；沒有啟動採樣或播放 |
| I2 | Auto 2 倍九十秒窗口 | 未執行 | 同上；沒有修改倍率 |
| U0 | 控制中心三頁與顯示更新 | 未執行 | 無頁面可供校準正常設定選單入口；不能聲稱操作方法已修正 |
| T0 | 正數 timeout 啟動起播且原值保持 | 未執行 | 沒有自然請求、觀察點或前後 timeout 配對，不能由 R1 起播摘要補算 |

具體工具結果：`getState()` 只列出外部 Chrome（type=extension），沒有 type=iab；隨後一次 `cua.createBrowserTab('iab', 'https://www.bilibili.com/', {visible:false})` 回傳 **`Browser is not available: iab`**。這是本輪實際能力結果，不是自動審查拒絕，也不代表產品或其他輪次永遠不支援。未改用外部瀏覽器、建立本機服務或要求前景。

沒有成功建立自有分頁、導覽、播放、設定寫入、計時器、斷點或攔截。操作者完成 CUA 結束摘要及重設；自有分頁數零的依據是建立失敗，沒有宣稱另一次分頁清單或媒體暫停／靜音讀回。原先 R1 已清理的事實保持，本次沒有新的媒體要停止。

本機去敏紀錄保存於 `.work/iab-testing/2026-11-05-v2.2.10-9f150a8-R2/`。操作與採樣修正仍未經 IAB 校準，不寫成已完成。再次執行須先出現內建瀏覽器可用的新前提，重新凍結期限並確認實際本體；沒有新前提不反覆重試，不將剩餘項目、舊 INVALID 或工具阻塞改成產品通過。此次只記錄狀態，不修改產品、測試、版本或發行原件。

本目標後續先完成可獨立進行的離線準備：在同一私有目錄建立九十秒有界媒體採樣器及六項合成檢查，鎖定 Node 26.8.1 執行通過。檢查自動截止、延遲不補算、媒體替換、失去靜音時暫停、registry 所有權／清理及倍率變更；只證明工具在合成媒體／排程下的行為，沒有注入 IAB，不新增產品或原生通過項目。正式來源、2,048 案測試及版本保持，控制中心操作與真實採樣仍未校準。

第三個目標回合完成受阻稽核：Terra 再做一次唯讀 inventory 核對，仍只有 type=extension 的 Chrome，沒有 type=iab；沒有重試建立分頁或操作外部瀏覽器。此次 getState 與 CUA 結束／reset 後記錄時間為 21:10:07.766 +08:00，並非精確的清單取樣瞬間。去敏證據為同目錄 INVENTORY_RECHECK.json；逐項完成稽核為 GOAL_AUDIT.json。原 IAB 缺席條件連續三個目標回合未解除，可獨立離線準備已完成，其餘均須實際瀏覽器，故目標列受阻而非完成；不自行增加輪次。
