# TODO 證據核對與結案紀錄

日期：2026-10-13（Asia/Taipei）。基準 **v2.1.22／`531e4b64ff2976464ae723c6cffadf03adc3ed32`**，開始時 main 與遠端相同、工作目錄乾淨。現行狀態見 [TODO](../../../docs/TODO.md)，原驗證結果見 [TEST_REPORT](../../../docs/TEST_REPORT.md)。

**本輪是文件結案，沒有新增功能驗證。** 依使用者批准的計畫核對既有報告、原始結果及相關來源差異；沒有開啟瀏覽器、重跑產品測試、修改來源或測試工具。版本維持 v2.1.22。

## 結案結果

| 項目 | 採用證據與結果 | 本輪處置 |
| --- | --- | --- |
| P01 已執行 XHR | v2.1.20 IAB 第 2 輪 24 案、第 3 輪 10 案、第 4 輪 2 案，合計 36 個已通過案例 | 沿用通過；不含尚未執行的 installed gate 交錯 |
| P01 bounded prepare／P02 真 gate | 自然請求設定明確 XHR timeout，依契約跳過 gate；沒有真 pending gate | 前提未成立，限制封存；不列自主續測，不判通過或產品失敗 |
| P03 同片自然 API | v2.1.20 IAB 第 5 輪兩筆請求所屬 cid 比對成功、accepted=true、epoch 0→0，第二筆同 cid | 安裝子項已通過；不增加不同影片／cid 或格式的安裝門檻 |
| P03 其他矩陣 | 最新版發布驗證的 Node 紀錄含 43 個 BR-03 通過案例；舊外部 Chrome 來源隔離 31／31；IAB 第 4 輪 12 個格式及 5 個 hook 資源案例，具體範圍見下節 | 按環境與情境沿用；未覆蓋的內容週期交錯列限制，不新增測試輪次 |
| P04、BR-10 | v2.1.21 實際 UI 關閉／切頁後完成兩案，以及 Auto 1／2 倍 Enter／Space 四案通過 | 已完成，不重測 |
| P05 | v2.1.22 真實 UI 複製的 31,204 字元全文讀回與真正貼上一致，原剪貼簿與資源安全復原 | 已完成，不重測；不宣稱定位 GM 通道根因 |
| BR-01、原 87.785 秒自然停滯原因 | 使用者已決定跳過；原修復、測試及未覆蓋範圍保留 | 不列現行待辦，不改記通過 |

本輪整理後沒有已批准、需要自主接續的測試項目。這個工作狀態不等於完整產品矩陣全部通過，也不是沒有缺陷的保證。

## P01／P02：通過案例與封存限制

P01 採用 [第 2 輪](IAB_v2.1.20_BR01_R2_2026-10-11.md#5-p01獨立-xhr-子集-2424)、[第 3 輪](IAB_v2.1.20_TODO_R3_2026-10-11.md) 與 [第 4 輪](IAB_v2.1.20_TODO_R4_2026-10-11.md)。已核對各輪原始 JSON：

- 第 2 輪採用完整收集的 24／24 結果，Network 未截斷；第一個截斷窗口仍不採計。
- 第 3 輪 12 筆斷言中，只採用 10 筆不依賴完整網路窗口的 Blob／本地所有權案例。兩筆 timeout 雖有局部斷言成功，當輪 Network 截斷，仍維持無效。
- 第 4 輪另有原生／安裝 hook 各一筆完整 timeout 窗口；DONE、空回應與 timeout→loadend 符合原判定，收集未截斷。原生已終止的兩個攔截 ID 清理錯誤保留，不改寫成未發生。

現行 [XHR 入口](../../../src-v2/adapters/xhr-hook.ts) 僅在非同步、合資格媒體 GET 且 `timeout === 0` 時等待起播 gate；明確 timeout 記錄 `preflight-skipped:xhr-explicit-timeout` 後維持直接送出。這與 [產品契約](../../../docs/PROJECT_CONTEXT.md#選路與量測) 及第 3～5 輪觀察一致，沒有依據把跳過本身列為程式缺陷。

以下安裝版情境仍未取得自然前提，**限制封存，未作通過判定**：

- 真 singleton pending gate 中，XHR 的有界重新準備、同步重入、abort／reopen 及單次終止所有權。
- 同一 gate 的 Fetch／XHR 等待者、單方取消、取消原因原值／物件身分，以及其他等待者繼續完成。

只有使用者明確要求恢復，且取得指定影片自然 pending gate 的新前提，才重新安排。不得修改網站 timeout、重設預算、重建控制器或反覆刷新製造條件。合成／Node 證據不能替代上述安裝前提。

## P03：逐項證據與適用版本

現行 [P03 定義](../../../docs/IAB_TESTING.md#4-固定驗收矩陣) 從一開始就將安裝版限制為同片自然 API；排列、完全換組、缺失 cid 與格式矩陣屬來源隔離／Node。先前對話將後者稱為額外安裝缺口，是範圍解讀錯誤，本輪更正。

### Node：最新版發布驗證已執行的案例

直接核對 v2.1.22 發布驗證所採用的 `TEST.log`，43 個 BR-03 案例均有具名成功紀錄，包含在原 808／808 中；不是只查看測試原始碼便判通過，也不是本日重跑。該紀錄來自升版前的修復來源驗證，版本及發布採用關係見 [P05 修復報告](P05_COPY_FIX_REPORT.md)。

| 情境 | 具名案例／對應套件 | 結果 |
| --- | --- | --- |
| 所有排列與正常對照 | `BR-03 all permutations use exact normalized parents independent of host and signature`；`identical DASH inventory reordered across representation directories keeps the content epoch`；domain／orchestration | N 通過；包含音訊授權、同目錄及真換片對照 |
| 相同 cid 完全換畫質／編碼組 | `BR-03 same request cid permits an entirely different quality and codec inventory`；orchestration | N 通過；不同 cid 共用路徑仍撤銷的對照通過 |
| cid 缺失、首次綁定及恢復 | `BR-03 missing cid uses overlap without forgetting cid; a disjoint fallback unbinds it`；兩個 `first cid binding` 案例；orchestration | N 通過；另有 Fetch／XHR 十種不合法／缺失 cid 案例 |
| 完整清單／子集及容量 | `BR-03 full inventory to disjoint subsets and back retains observed directories`；video 128／audio 64 容量案例 | N 通過；包含固定淘汰順序、無效首項及協定相對 URL |
| MP4／FLV／混合格式 | `BR-03 mp4`、`BR-03 flv`、`BR-03 mixed same-cid source refresh preserves epoch and different cid revokes old authority`；progressive-playurl | N 三案通過；同 cid 六次刷新、簽名撤銷及不同 cid 對照 |
| 請求與生命週期所有權 | Fetch 等待前保存 cid、XHR failed open／重入／重複 getter、低信任來源、generation、延後工作及診斷／持久資料隱私 | N 通過；完整 43 個名稱保存於本機證據索引 |

正式入口仍明確匯入對應回歸；案例位於 [內容回歸](../../../tests-v2/regressions/functional-races/content.ts)、[領域回歸](../../../tests-v2/regressions/functional-races/content-domain.ts)、[傳輸回歸](../../../tests-v2/regressions/functional-races/xhr.ts) 與 [漸進式套件](../../../tests-v2/suites/progressive-playurl.ts)。

### 瀏覽器：原環境與覆蓋限制

| 環境／版本 | 已保存案例及結果 | 不延伸的結論 |
| --- | --- | --- |
| 2026-10-10 外部 Chrome 154，BR-03 修復來源、v2.1.11 發布前 | [原報告](BR03_FIX_REPORT.md#chrome來源隔離) 與 `chrome-br03-results.json`：31／31、restored=true；Fetch／XHR text／json 的排列、same cid with disjoint codecs、首次綁定、duplicate cid uses fallback、子集及 failed open／重入 | 不是 IAB，也不是 Tampermonkey 安裝版；重複 cid 對照不能擴張成全部缺失 cid 瀏覽器情境 |
| v2.1.20 IAB＋Tampermonkey，第 5 輪 | [原報告](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md)：`P03-natural-same-content` 為 VALID／PASS；兩個自然 API 與原請求身分相符，epoch 保持 0 | 只沿用同片子項，不宣稱 v2.1.22 本日重新驗證 |
| v2.1.20 IAB 來源隔離，第 4 輪 | [格式與 hook 原報告](IAB_v2.1.20_TODO_R4_2026-10-11.md#p05格式與-hook-資源通過) 與 `P05_SOURCE.json`：MP4／FLV／mixed／invalid-mixed 各三種傳輸共 12 案，另 5 個 install／dispose／所有權案例全部通過，未截斷且已清理 | 格式輸出、分段身分、音訊分類及失敗回應已有 S 證據；不是實際播放，也未涵蓋反覆換組／缺失 cid 的完整內容週期交錯 |
| IAB 來源隔離的完整內容週期交錯 | 未找到排列、同 cid 完全換組、缺失 cid 及漸進式多次刷新交錯的完整 IAB 結果 | 證據不足，未作通過判定；N 及舊 Chrome 的已覆蓋情境照常沿用，不抹除上列 IAB 格式通過結果，不增加安裝門檻或自動重測 |

相關來源差異已核對 `v2.1.11..531e4b6`：內容判定領域模組、PlayurlController 與 Fetch hook 未變；XHR hook 有後續準備流程修改（65 行新增、25 行刪除），因此舊 Chrome 結果不能當成新版完整傳輸證據。內容回歸僅新增一行實際請求歸因前置，其餘已列領域／格式案例未變；最新版 43 案成功紀錄提供當次 Node 證據。

另核對 `v2.1.20..531e4b6` 的正式來源差異，只有控制中心及 GM 型別更新；P01 傳輸、P03 內容與格式來源未變。第 2～5 輪結果因此保留原版本沿用，沒有把文件核對換算成新版現場執行。

## 文件檢查與交付

本輪同步 TODO、索引、IAB 方案、產品脈絡及最新版測試報告；維護歷史只新增本日紀錄。舊 Release、歷史驗收、原始 JSON／log 及安全產物不回寫。

本機核對目錄：`.work/todo-closure/2026-10-13-531e4b6/`。`BASELINE.json` 保存提交與追蹤檔雜湊，`EVIDENCE_INDEX.json` 保存既有結果的路徑、雜湊及範圍摘要，`DOC_VALIDATION.json` 保存 GFM／連結／錨點／差異範圍檢查，`DELIVERY.json` 保存提交及遠端核對。本輪不保存 cid、原始媒體 URL 或報告私密本文。

文件檢查通過：7 份 Markdown、19 個表格、211 個本機／同儲存庫連結及錨點、67 個粗體節點；`git diff --check` 通過，482 個非本輪修改的追蹤檔雜湊不變。維護歷史原有 9 個 lint 提示經基準比對確認未改，保留原文；新增內容沒有格式錯誤。外部網站連結未重新抓取。

交付只提交文件並推送 main，維持 v2.1.22，不建立標籤、封裝或 Release。沒有新增 npm、Codex Security 或瀏覽器通過宣稱；文件結案與功能驗證通過分開。
