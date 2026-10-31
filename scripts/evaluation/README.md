# 離線評估工具

本頁集中評估操作、固定基準、退出碼與期限；所有命令從儲存庫根目錄執行。一般開發與發布見 [DEVELOPMENT](../../docs/DEVELOPMENT.md)。評估不構成瀏覽器續跑或產品採用授權，遵守 [永久禁令](../../AGENTS.md#使用者永久執行禁令)，歷史 loopback 模式不得執行。

## 原版與 v2 的獨立離線比較

[upstream-compare.mts](upstream-compare.mts) 固定讀取並校驗既有 v1.3.4 原件與已發布 v2.1.27 完整腳本，每版／情境使用新 Node 子程序及模擬頁面。先執行 `npm run compare:upstream -- --calibrate`，再執行不帶選項的完整摘要或 `--json` 機器結果；未知或重複選項退出 2，失敗／無效退出 1，全部有效且適用斷言通過退出 0。

比較使用現有 FakeClock、記憶體 GM、固定單一 AVC、共同合法來源及前景模型；1／2 倍分開，60 秒健康前置後執行固定情境。進度是模型輸入，可信事件也是 Node 模型，不代表瀏覽器可信輸入或真實播放效果。原版缺少核心重載／還原能力的專屬斷言標為不適用，共同斷言仍執行。原件不能成為正式 v2 建置／測試輸入；`verify` 只執行不載入原件的中立工具契約，不執行兩版比較。

每個比較案例與清理各 5 秒、子程序外層 60 秒、輸出上限 32 MiB。頁面生命週期計時器／監聽器與未完成請求分開盤點，再由模擬頁面釋放；不以強殺程序或強清時鐘算通過，不取代產品元件 dispose 契約。比較工具不寫檔；若保存結果，使用按日期登記的公開調查報告及精確允許的合成 JSON，執行紀錄直接保存於被忽略的本機封存，不留 `.work` 或額外 `dist` 產物。結果入口由 [HISTORY](../../docs/HISTORY.md) 維護。

## 實際緩衝效用與採用判定工具

使用 `npm run evaluate:buffer-live -- --input "evidence.json" --json` 唯讀重播本輪 schemaVersion 1 證據。工具固定核對 d0c2c8c／v2.1.35、422022 bytes 與原件 SHA-256；不讀正式 GM、不連網、不重新計算產品 candidate。摘要與 JSON 分別提供窗口結果、十五／六十秒後續、配對、提前量及採用門檻。十二個窗口完整有效時退出 0，缺少窗口、無效或輸入錯誤退出 1，非法參數退出 2。退出 0 仍可能因事件不足得到 insufficient；不表示授權產品操作。

`evaluate:buffer-live` 的 `--serve` 是仍保存在來源中的歷史 loopback 校準模式；自 2026-10-31 起依永久禁令不得執行，不能把參數存在當成啟動授權。離線 `--input` 重播仍可依其契約使用。自有 HTML 直接開檔，檔案來源不能驗證的 HTTP 行為列為未驗證；實際安裝資料依 [IAB 唯讀窗口](../../docs/IAB_TESTING.md#展示樣片選擇與唯讀窗口) 取得，不能以模型結果代替。

收集會話使用既有 Monitor／Routes 訂閱，只有工具自有的期限／租約計時器。binding 與 session 共用同一高精度起點；含六十秒前置時固定截止為 430000 ms，對齊餘裕不能縮短三百秒計分或六十五秒後續。`live-pump.mts` 的 host 狀態只保存資料，每次明確傳入當前分頁及 CDP capability，先排空、完整 await 八秒、再排空同一游標；不同分頁先拒絕，失效後不能靜默重啟。`drainRemoteSession` 拒絕 CDP 例外、跳號及截斷，重建白名單副本，並驗證固定截止、經過時間、租約餘額及清理狀態。排空期間不穿插其他工作，不能把已換頁參照封在舊閉包；呼叫端先核對完整執行身分。

公開輸出只留數值、布林、固定原因及會話內序號。cachedAlternatives 只是既有排名的觀察數量，alternative=null 表示沒有觀察到可驗證的新鮮替代資格；不能用排名代替提交時授權。工具與判定器的 Node 契約列入 tooling；目前瀏覽器能力是否通過、工作是否啟動，分別見原報告及 TODO。

### 風險覆蓋與可介入性離線評估

在原命令加 `--risk`，例如 `npm run evaluate:buffer-live -- --input "archive/retired/docs/evidence/BUFFER_LIVE_EVALUATION_R2_2026-10-25.json" --risk --json`，即可重用既有證據，輸出原採用決策及另列的風險覆蓋。工具不重算歷史 candidate、不重跑網站；以左端有效樣本代表相鄰區間並裁切計分範圍，不外插。大於 1,500 ms 空隙、換身分、資料不足、不適用與緩衝分帶分列；零低緩衝暴露不能解釋成預警能力通過。

`npm run evaluate:buffer-live -- --supply --json` 執行固定十種供給情境的 1／2 倍共二十次整合案例。每次使用新子程序、FakeClock、記憶體儲存及真實 Monitor／Runtime／Recorder／Routes／Recovery；六十秒健康前置後觀察一百二十秒。只有合法完成且可依序追加的媒體區段才能補充緩衝，SDK reload／play 不會自動產生播放進度。輸出包含固定輸入、來源與情境雜湊、逐秒觀察、供給帳冊、斷言、退出碼及清理；工具 bundle 使用系統暫存目錄並釋放，不寫 `.work` 或額外 `dist`。

案例及清理各五秒、整組六十秒、子程序輸出 32 MiB；超時或缺少必要資料判無效。`--risk`、`--supply`、`--serve` 互斥，supply 不接受 input。非法參數退出 2；有效且全部適用契約通過退出 0；真實效用失敗或無效退出 1。正式 tooling 驗證工具正確性，獨立 supply 命令另外檢驗效用；因此完整 verify 通過仍可能伴隨 supply 的真實紅色結果，不能改寫期待使其轉綠。

可介入性只評估明確提供的唯讀條件；缺少派送前時機、新鮮成功、當前禁止或授權資格均標 unknown，不能從 cached ranking 補算。即使合成輸入得到 known-pass，`productActionAuthorized` 仍為 false，不構成選路授權。實際資料、合成資料與正常成本分開報告，合成結果不能補足實際採用門檻；效用失敗時停止於評估，不調整候選或救援。結果入口見 [HISTORY](../../docs/HISTORY.md)。

`npm run evaluate:buffer-live -- --decision --json` 固定核對原十二窗的 bytes／SHA-256，重用原採用判定，另執行初始四秒緩衝的不足供給／完整回補配對，各自登記 1／2 倍。兩個子程序各持有兩個全新情境；案例及清理各五秒、整組六十秒、輸出 32 MiB。`--decision` 與 input、risk、supply、serve 互斥；不帶 json 顯示摘要，非法參數退出 2，效用失敗或無效退出 1。

配對分析器只檢查固定取樣點：共同觀察前綴內的預警也會出現在零候選正常對照；首次可區分樣本若為回補，仍須撤銷。它輸出可用取樣點的提前量上限，不複製 candidate 演算法，也不推斷所有未來訊號都無法區分。資料缺失、身分不合、非正常對照或取樣空隙只能 invalid，不能用來證明條件衝突。

決策器分開保留實際採用結論、效用斷言及可行性。只有實際門檻、效用與已知資格全部成立才建議進入受控原型；缺少資料時建議當下不採用，底層仍記 insufficient。觀察的排他衝突與目前候選紅色契約不能被單元測試通過掩蓋，評估輸出始終不授權產品操作或發布。輸入、逐案結果與來源雜湊由按日期報告保存；原十二窗不重跑，獨立命令的紅色不改為正式套件預期失敗。

## 緩衝影子效用與成本評估

`npm run evaluate:buffer-shadow` 執行真實 Monitor／Runtime／Recorder 的離線整合情境；加 `-- --json` 輸出 schemaVersion 1 的完整輸入、輸出、來源／情境雜湊、逐項斷言及清理。每案先暖機六十秒。判定器只分析觀察，不重寫產品緩衝演算法；正常對照出現候選是評估結果，不被改成零或直接視為產品錯誤。具名判定器及整合契約加入 tooling 套件。

`npm run evaluate:buffer-shadow -- --cost --json` 另以未修改的 v2.1.27／v2.1.28 完整腳本建立全新子程序／模擬頁面。每倍速有獨立六十秒套件，各含兩組不計分暖機及十組配對量測、交替版本順序；每次先六十虛擬秒健康播放，再量測十分鐘。每案與清理仍各五秒，輸出上限 32 MiB；超時／無效保留非零結果，不調寬期限。

兩命令退出碼為 0／1／2（契約成立且有效／斷言失敗或無效／非法參數）。只讀已發布原件及產品來源，不連外、不碰正式 GM、不新增依賴；中間打包使用系統暫存目錄並清理。功能與成本分檔保存；成本應獨立執行，避免與完整測試同時量測。啟動、tick、程序 CPU／heap 是本機模型數值，不設機器相關門檻，也不代表瀏覽器純功能開銷。來源與安裝版證據分列，樣片步驟見 [IAB 指南](../../docs/IAB_TESTING.md#展示樣片選擇與唯讀窗口)，結果由 [HISTORY](../../docs/HISTORY.md) 追溯。

新增 --cost-v3 --json 比較已發布 v2.1.28／v2.1.29；--cost-source --json 比較已發布 v2.1.29／當前確定性建置，臨時腳本有 bytes／SHA-256，不能冒充發布版。三種成本選項互斥，原 --cost 語意保持。功能輸出另列候選中斷區間與最後候選提前量，不合併原候選段或改寫十五秒後續。worker 候選／趨勢／斷言必須一致；收集器對過期、未來與所有者變動資料不作有效歸因。

`npm run evaluate:buffer-shadow -- --holdout --json` 獨立執行固定於 observation-inputs.mts 的外部輸入及效用門檻，各倍速使用新子程序；不混入原有功能清單。此選項與所有成本模式互斥。輸出包含凍結輸入與雜湊、完整逐案結果、候選連續性及清理。有效性與效用斷言分開；有效案例未達事前門檻仍須退出 1，不能因正式 verify 通過而轉算成功。既有缺口、真實退出碼與數據只看 [評估報告](../../archive/retired/docs/BUFFER_OBSERVATION_OPTIMIZATION_2026-10-23.md#獨立保留情境)。

候選 v2 的兩秒確認原型未通過保留耗盡情境，未接入現行來源。可重播差異、具名契約、正確非零退出碼與來源基準集中於 [原型評估](../../archive/retired/docs/BUFFER_CANDIDATE_CONFIRMATION_2026-10-23.md#驗證與重播)；僅在獨立副本套用。現行 evaluate:buffer-shadow 驗證目前來源，不能改寫未採用 v2 的結果；成本命令固定載入已發布腳本，版本及證據不可混算。

## 診斷成本基準

`evaluate:diagnostics` 的 schemaVersion 2 固定核對 v2.1.36 完整腳本 bytes／SHA-256，並從固定 Git 提交獨立打包基準 Recorder；工作來源使用確定性建置。發布原件可位於現行或封存 Release，均不覆寫。工具保存產品、輸入與工具雜湊，結束再次核對工具未變更；需要該固定 Git 提交及本機原件，不連網取得替代輸入。

預設成本模式與 `--profile` 模式互斥；`--json` 只改輸出格式。正常完整腳本各倍速兩組暖機、十組交替計分，每次六十秒虛擬健康前置及六百個一秒 tick，逐 tick 完成 video／audio 請求。事故、容量及超大匯出使用獨立 Recorder 情境，不併入正常成本。成本與 profile 不並行，也不與其他測試同時量測；CPU、tick、heap 包含離線模型及宿主工作，不表示瀏覽器純功能成本。

profile 在隔離子程序使用 Node CPU profiler，並以可還原的 JSON／TextEncoder／structuredClone 包裝計數；預設成本模式不裝包裝。結果分開保存，不能用 profile 計時決定採用。`times`、startupMs、caseDurationMs 以毫秒、CPU 以微秒、heap 與工作量大小以 UTF-8 bytes 表示；預熱後的計數和六百筆計分樣本分列。每個案例包含清理實際不得超過五秒，每倍速／工作負載套件六十秒，監督程序保留 32 MiB 輸出限制；無效案例退出 1，非法參數失敗。退出 0 僅表示量測有效且行為摘要一致，不等於產品優化獲准。

`summary.timingAccepted` 要求兩倍速各十組至少八組 CPU 總量下降，且 tick 中位數／p95 的跨組中位數不增加；另須確認熱點工作量下降、逐步快照／報告及產品效果一致，才具備採用資格。方向不一致最多一輪相同規格確認，仍不足即撤回候選。回退後的工具校準不能算成第三輪候選採用。具名工具契約在 tooling，固定壓力情境在 diagnostics；結果由 [HISTORY](../../docs/HISTORY.md) 追溯，不回寫已發布報告。

分位數沿用既有成本工具的排序後索引 floor((n−1)×p)；十組彙總使用下中位數。CPU 改善組數使用每個配對的 user＋system 原值，嚴格小於才算改善，不以 heap、單次最快值或跨輪合併代替。

## 唯讀緩衝趨勢診斷

影子規則及資格集中於 [PROJECT_CONTEXT](../../docs/ARCHITECTURE.md#唯讀緩衝趨勢)，所有權集中於 [ARCHITECTURE](../../docs/ARCHITECTURE.md#依賴方向)。本功能只讀取 Monitor 已取得的媒體／控制快照及 Runtime 轉交的既有完成事件，不新增網路讀取器或計時器。

目前來源的報告唯一輸出為 recorder.bufferTrend，含 schemaVersion 6、algorithm buffer-window-v6、latest 與 history；歷史發布原件保持各自版本。讀取模型中的同名副本不重複輸出。每筆包含窗口時間、內插、進度品質、倍速、起訖緩衝、變化量、斜率、狀態、候選及固定原因碼；cycle 只輸出 netLossSec、creditMs、lastLossAgeMs、rangeTroughSec 四個有界數值或 null，不輸出內部峰值、物件或識別碼。cycle-draining-low 表示周期證據，即使八秒 state 為 stable／filling 仍可成立；cycle-loss-confirming、cycle-range-pending 與 refill-cycle-balanced 分開說明確認及範圍抑制。transport 只列已觀察完成的數量、bytes、跨窗口與覆蓋品質，不提供即時頻寬。

離線讀取器接受匹配的 v1～v6 標記，同一案例不得混合版本或重新解釋舊 candidate。即時 Recorder 只接納 v6 白名單投影；true 必須具備短期 draining-low、完整 cycle-draining-low、有效低緩衝或尾段證據，舊即時版本及失效證據拒絕。原周期契約使用 npm test -- domain --name buffer-v4、npm test -- diagnostics --name buffer-v4 及 npm run evaluate:buffer-shadow -- --cycle-holdout --json；原一百次情境仍用不帶模式選項的功能命令。各模式與所有成本／holdout 模式互斥，依倍速分案；首次提前量與最後候選空窗分開驗收。v4 原始效用保存在 [當時報告](../../archive/retired/docs/BUFFER_CANDIDATE_V4_2026-10-24.md)，現行效用與限制只看 [TEST_REPORT](../../docs/TEST_REPORT.md)，歷史期待及發布原件不回寫。

lowBuffer 輸出 basis（steady-decline／partial-cycle）、creditMs（0～2000）、declineCoverageMs（0～8000）及 v6 的 tailUsed 布林，沒有內部確認基準或識別碼。low-buffer-confirming 為 false，low-buffer-steady／low-buffer-cycle 必須為 true 且確認滿兩秒；慢下降要求完整八秒覆蓋，周期要求有效正欠量，兩者均要求目前校正緩衝不超過四秒。low-buffer-tail 為 true、low-buffer-tail-used 為 false；兩者均要求部分周期、已使用標記、兩秒確認／下降覆蓋及大於零且不超過一秒的緩衝。Recorder、離線驗證器及瀏覽器投影均核對版本與證據一致性，不能用新規則重算歷史 candidate。

使用 npm run evaluate:buffer-shadow -- --continuity --json 執行固定尾段與正常配對，與其他情境及成本模式互斥；同樣使用逐案子程序、五秒案例／清理、六十秒套件與 32 MiB 輸出界限。continuity-inputs.mts 固定輸入，tests-v2/fixtures/buffer-continuity-v5.json 保存原 v5 候選事實，不能當作第二份產品演算法。基準、情境及來源雜湊隨結果輸出；正式契約使用 domain／application／diagnostics／orchestration／tooling 的 --name buffer-v6 篩選。

持續性指標分列候選時間、首次與最後提前量、首次前／截尾後空白、觀察到的 false 間隔、末端空窗及最後十五秒覆蓋品質。缺樣、null 或換所有者不跨段連接；末端覆蓋不完整保持未判定。撤銷從第一個可觀察的持平／回補樣本算起；一秒固定樣本與不規則取樣分開，不把候選總時間解讀為撤銷延遲。新矩陣已參與設計評估，不稱為未見過的獨立保留組。

使用 npm run evaluate:buffer-shadow -- --low-buffer --json 重跑凍結於 low-inputs.mts 的主要配對與獨立保留組；它與其他情境／成本模式互斥，沿用逐案子程序、五秒案例與清理、六十秒套件及 32 MiB 輸出上限。初始緩衝明確輸入並用於全部六十秒健康前置。正式契約用 npm test -- domain --name buffer-v5、application／diagnostics／orchestration／tooling 同名篩選；完整比較另跑既有功能與 --cycle-holdout，分列首次／最後提前量、候選空窗、段數、時間、十五秒後續及清理。

Recorder 的內部容量檢查可直接序列化已去敏的自有資料，不先深複製整個快照；公開 snapshot 與 buildReport 始終使用 detached capture。這只減少診斷熱路徑工作，不改候選、淘汰順序、截斷計數、32 筆／8 KiB、128 KiB 或 96 KiB 上限。來源效能與發布版分開比較，不以 heap 或單次計時設跨機器通過門檻。

資料不足與不適用的 candidate 為 null；有效非候選為 false，候選為 true。樣本最多 32 筆，傳輸去重最多 128 筆。報告歷史含最新結果，受 32 筆及 8 KiB 雙重上限限制，實際可少於 32 筆。Recorder 128 KiB／匯出 96 KiB 上限維持，先移除趨勢歷史並記錄 bufferTrendEvicted／bufferTrendDropped；非法資料記 bufferTrendRejected。清除診斷只清報告，不重設觀察器、期限或額度。

重跑使用既有命令：npm test -- domain、npm test -- application、npm test -- diagnostics、npm test -- orchestration，再執行 npm run verify。具名案例與逐秒合成軌跡見 [本輪離線驗收](../../archive/retired/docs/BUFFER_TREND_2026-10-23.md)。compare:upstream 固定載入原版及封存的已發布 v2.1.27 本體，不驗證本功能新來源。合成進度與候選不能換算為網站救援成功率或誤介入率；發布狀態只看 [TODO](../../docs/TODO.md)。

## 慢請求提前重試

`npm run evaluate:early-retry -- --json` 獨立執行六個固定模型情境，保存 policy／input SHA-256、逐案預測、held-out 未來供片、停頓及不必要重下載。退出碼 0 為門檻全通過、1 為效用 FAIL、2 為非法參數；不能把效用 FAIL 改為預期失敗或混入 verify 的全綠。測試工具無執行期依賴、不連網，不為取得介入放寬產品資格。它不能證明原生瀏覽器或實機效益。
