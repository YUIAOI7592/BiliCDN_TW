# 離線評估工具

本頁集中評估操作、固定基準、退出碼與期限；所有命令從儲存庫根目錄執行。一般開發與發布見 [DEVELOPMENT](../../docs/DEVELOPMENT.md)。評估不構成瀏覽器續跑或產品採用授權，遵守 [永久禁令](../../AGENTS.md#使用者永久執行禁令)，歷史 loopback 模式不得執行。

## 原版與 v2 的獨立離線比較

[upstream-compare.mts](upstream-compare.mts) 固定讀取並校驗既有 v1.3.4 原件與已發布 v2.1.27 完整腳本，每版／情境使用新 Node 子程序及模擬頁面。先執行 `npm run compare:upstream -- --calibrate`，再執行不帶選項的完整摘要或 `--json` 機器結果；未知或重複選項退出 2，失敗／無效退出 1，全部有效且適用斷言通過退出 0。

比較使用現有 FakeClock、記憶體 GM、固定單一 AVC、共同合法來源及前景模型；1／2 倍分開，60 秒健康前置後執行固定情境。進度是模型輸入，可信事件也是 Node 模型，不代表瀏覽器可信輸入或真實播放效果。原版缺少核心重載／還原能力的專屬斷言標為不適用，共同斷言仍執行。原件不能成為正式 v2 建置／測試輸入；`verify` 只執行不載入原件的中立工具契約，不執行兩版比較。

每個比較案例與清理各 5 秒、子程序外層 60 秒、輸出上限 32 MiB。頁面生命週期計時器／監聽器與未完成請求分開盤點，再由模擬頁面釋放；不以強殺程序或強清時鐘算通過，不取代產品元件 dispose 契約。比較工具不寫檔；若保存結果，使用按日期登記的公開調查報告及精確允許的合成 JSON。執行中暫存與結案後的私有證據位置統一依 [工作資料與結案](../../docs/DEVELOPMENT.md#工作資料與結案)，不把一次性輸出留在正式來源或 Release。結果入口由 [HISTORY](../../docs/HISTORY.md) 維護。

## 已撤除的專用評估

診斷成本、緩衝趨勢／shadow／live／risk／adoption 及 scripts/iab 工具已於 v2.2.1 撤除；沒有正式可執行副本。[固定提交中的原工具與操作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md) 可供歷史追溯；原報告、效用 FAIL 與停止決策保持。

## 慢請求提前重試

`npm run evaluate:early-retry -- --json` 獨立執行六個固定模型情境，保存 policy／input SHA-256、逐案預測、held-out 未來供片、停頓及不必要重下載。退出碼 0 為門檻全通過、1 為效用 FAIL、2 為非法參數；不能把效用 FAIL 改為預期失敗或混入 verify 的全綠。測試工具無執行期依賴、不連網，不為取得介入放寬產品資格。它不能證明原生瀏覽器或實機效益。

<a name="實際緩衝效用與採用判定工具"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#實際緩衝效用與採用判定工具)；現行內容以本頁正文為準。

<a name="緩衝影子效用與成本評估"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#緩衝影子效用與成本評估)；現行內容以本頁正文為準。

<a name="診斷成本基準"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#診斷成本基準)；現行內容以本頁正文為準。

<a name="唯讀緩衝趨勢診斷"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#唯讀緩衝趨勢診斷)；現行內容以本頁正文為準。

## 選路模型對照

### v2.2.12 優化補充模型

`npm run evaluate:routing -- --optimization` 獨立輸出 JSON，不讀取 `.work`、歷史報告、網站 bundle 或 GM 資料。只接受單一 `--optimization` 選項，非法組合退出 2。退出 0 只代表模型執行完成，計算契約由工具測試獨立核對；不代表實機效用通過。原模式及六情境提前重試評估保持獨立，後者原有的效用 FAIL 不被此模式覆蓋。

輸出包含輸入／實際純政策／工具來源 SHA-256、7,680 組合成條件、五種相同決策前提的未來結果，以及一／兩倍的均勻與 VBR 片段軌跡。前三種未來為持續慢、原路突然恢復、替代路線變慢；另保留替代結果未知與交接未確認。每次決策先執行正式純政策，之後才揭露未來。合成符合比例不能當作現場適用率。

片段採序列下載及整段完成後 append：下載秒數為回應等待加 `bytes × 8 / 本文 bits/s`，期限為連續媒體緩衝除以實際倍率，停頓為下載超過期限的部分。完成後緩衝為 `max(0, 舊緩衝 − 倍率 × 下載秒數) + 片段媒體秒數`。相同總 bytes 的均勻／VBR 對照保存碼率、FPS、大小、時長及表示軌跡；FPS 不再次乘入碼率。沒有模擬漸進 append、網站 ABR、解碼或音訊競爭。

兩秒政策交接預算只計一次；合成實際交接耗時另列。輸出完成時間差、停頓差、期限誤判、額外下載及換站；未完成或未知結果為 `null`，未模擬探測／重載也為 `null`，不能解讀成零成本。獨立算式、資源守恆及重現性契約在 [v2212-evaluation.ts](../../tests-v2/regressions/v2212-evaluation.ts)，模型組數不列入正式案例數。

### 提前重試資格與覆蓋

| 層次 | 正式來源 | 契約與拒絕邊界 |
| --- | --- | --- |
| 請求與適配器跟蹤 | [XHR hook](../../src-v2/adapters/xhr-hook.ts)、[Fetch hook](../../src-v2/adapters/fetch-hook.ts) | [實傳契約](../../tests-v2/regressions/up141-retry-transport.ts)：XHR timeout 0／1／500／3000／10000／13000；正數不跟蹤提前重試。同步、非 GET、無效 Range、音訊、停用均不因 timeout=0 自動合格。 |
| 可信進度與結果 | [TransportAdapter](../../src-v2/adapters/transport.ts) | 同一實傳契約核對不可信 progress 不提供速度、200 不冒充 206；保留原取消、重用及網站 timeout 寫入優先斷言。 |
| 控制與替代資格 | [EarlyRetryController](../../src-v2/application/early-retry-controller.ts) | [控制器契約](../../tests-v2/regressions/up141-retry-policy.ts)：Catalog、固定／停用、播放狀態及同內容兩筆實傳；主動探測不取得替代權限。 |
| 判斷、許可與認領 | [純政策](../../src-v2/domain/early-retry.ts)、[RouteCoordinator](../../src-v2/application/route-coordinator.ts) | 同控制器／實傳契約核對 1.35 倍、完成度、兩秒交接、許可過期、認領與送出一次。7,680 組模型僅補充純政策條件，不繞過前層資格。 |
| 起播獨立流程 | [MeasurementController](../../src-v2/application/measurement-controller.ts) | [正數 timeout 起播契約](../../tests-v2/regressions/functional-races/xhr.ts)：正數仍可等待起播窗口，不能與提前重試的正數排除混用。 |

真正現場各層適用率仍未量測；沒有為拒絕原因新增產品計數器或公開測試介面。

### 後續取證方法契約

私有離線方法另驗證：排程遲到只取下一個未過期時點；保存成功才推進游標，部分保存失敗可重讀去重；來源截止固定，晚取回不延長或補造邊界；容量溢位及尾段缺口明列。此方法不屬產品測試或正式採樣管線，原始結果只放當輪私有工作目錄。真正 IAB 校準須另案依 [IAB_TESTING](../../docs/IAB_TESTING.md) 執行，工具缺口只限制相依結論，不能否定獨立播放／UI 結果。

`npm run evaluate:routing -- --deadlines` 固定 304c631 舊純政策及目前純政策，使用相同已審閱數字／服務軌跡與資源上限。輸出送出前資料的預測、平均絕對誤差、低估耗時、期限誤判、起播等待、換站、下載及表示軌跡；含競爭流量、速度突降／回升、VBR 大段、過期緩衝及兩秒交接抑制重試的反例。固定表示與明列的 Auto 外生假設分開，沒有重建網站私有 ABR；探測部分下載採線性交付假設，重載未模擬而固定為零，缺少替代服務不算失敗。數字對照不是實機效用或未來分位數保證。原十場景與歷史結果保持。

`npm run evaluate:routing -- --measurement` 使用固定 304c631 基準與已審閱的合成數字，核對零起點、清理延遲、牆鐘跳變、VBR 大請求、倍率與快照年齡。正式純函式與獨立公式逐筆對照，輸出輸入雜湊、誤差、剩餘期限與表示假設。此模式不讀取私有研究、封存原件或網站 bundle；合成閉合算式的零誤差只證明計算一致，不代表實際預測無誤。尚未模擬的探測、恢復或 Auto 效果保持未識別。

`npm run evaluate:routing` 以固定 v2.2.6 提交 048b0f94e6bb98922ee5bcc0d1b30003cf3b12a9 的純選路模組及目前正式純政策，離線編譯並比較十個固定合成場景，輸出 JSON、輸入 SHA-256、主機、首段可用毫秒、緩衝不足毫秒、換站、下載量、探測數／量及重載數。需要本機完整 Git 基準，不取網路、不寫結果檔；可按需導向工作目錄，參數不影響輸入。

這是路線／首段模型，探測流量與三秒等待按相同最壞上限記帳；未模擬恢復控制器，重載固定為零，並非證明實際沒有重載。未選主機不因缺值算失敗；held-out 未來傳輸與估計分離，包含估計勝出卻實際較差的反例。它不取代真實 MeasurementController、所有權交錯及資源契約，也不證明安裝效益。四個工具契約確認重現性、來源／期限選擇、反例及探索上限。退出 0 表示模型完成，執行錯誤非零；沒有宣稱通過實機效用門檻。
