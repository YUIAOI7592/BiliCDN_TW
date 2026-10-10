<a name="bilicdn_tw-v2117-release-verification--2026-10-11"></a>
<a name="bilicdn_tw-v2117-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.17 修復與發行驗證 — 2026-10-11

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
