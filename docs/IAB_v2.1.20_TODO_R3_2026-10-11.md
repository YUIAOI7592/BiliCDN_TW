# v2.1.20 內建瀏覽器 TODO 第 3 輪 — 2026-10-11

基準：`783ece1e4fe9a8c52b331089928175af73d9cc9b`，開始時工作目錄乾淨。瀏覽器工作約 18:58–19:23（Asia/Taipei）。現行範圍與累計結果見 [TODO](TODO.md) 及 [IAB_TESTING](IAB_TESTING.md)；本紀錄不改寫前兩輪證據。

**本輪新增 XHR 10 個對照、雙分頁設定同步／合併與診斷讀取子項通過；沒有新確認的產品缺陷。本輪未取得完整通過。** 逾時子項缺完整工具證據，B06 新窗口沒有實際 SDK 呼叫前提。所有自有分頁、攔截、觀察器與設定變更均已清理。正式來源與版本未變，沒有升版或發布。

## 執行邊界與沿用證據

- 全程只用 Codex 內建瀏覽器＋Tampermonkey，只開指定風景影片。網站維持 Auto；本輪新增 SDK 窗口為 2 倍，沒有把它算成 1 倍通過。
- 三次文件實例均核對完整 v2.1.20 產物、Tampermonkey 5.5.1、Runtime／ControlCenter 各唯一一個。重新連線後重新取得身分，沒有沿用失效 handle。
- 完整 Release 腳本 SHA-256：`b8e5bd4744737537f348fcc7d9fb9f258fd41bc5e60327e5f4259560dcd5b54e`。Tampermonkey 外層包裝隨文件改變，不能拿整個包裝的雜湊代替產物身分。
- 沿用 [第 1 輪](IAB_v2.1.20_BR01_R1_2026-10-11.md) Auto 1／2 倍核心 15／30／15、正常播放、12 秒延遲、wrapper 長按與 S01／S03；沿用 [第 2 輪](IAB_v2.1.20_BR01_R2_2026-10-11.md) 已通過操作、inner、晚到拒絕、政策撤銷及 XHR 24 案。本輪沒有重跑這些通過案例。
- 背景、可信 repeat／pointercancel、封閉 Shadow DOM UI 沒有新增工具能力，沒有再次嘗試同一方法。

## 新增結果

| ID／子項 | 有效性／判定 | 實際證據與限制 |
| --- | --- | --- |
| P01 同步 Blob 的 setter／send，原生及安裝各一案 | VALID／PASS，2 案 | 同步 responseType／timeout setter 各拋 InvalidAccessError；正常同步 send 取得完整文字及 DONE |
| P01 未送出前 failed synchronous open | VALID／PASS，4 案 | 原生及安裝各覆蓋 json／timeout；InvalidAccessError 後為 UNSENT，再 send 拋 InvalidStateError |
| P01 原生已送出後重複 abort | VALID／PASS，2 案 | 原生及安裝均只一次 abort→loadend；事件中 DONE，返回後 UNSENT、空回應 |
| P01 本地拒絕後 failed synchronous open | VALID／PASS，2 案 | json／timeout 兩案保留 readystatechange→error→loadend；DONE 及 null／空字串符合型別，json 的 responseText 仍拋原生例外 |
| P01 實際 timeout | INVALID／無產品判定 | 第一窗兩種 XHR 都出現 timeout→loadend，但 Network 游標截斷；修正收集方式後第二窗遇到工具命令逾時，執行狀態遺失。停止第三次嘗試，不計 2 案通過 |
| P04 雙分頁單節點更新 | VALID／PASS | 兩個同片實例並行呼叫既有 setCatalogEnabled，最終兩個 overrides 均存在，沒有互相覆蓋；Web Locks 可用 |
| P04 原生 GM 遠端通知及復原 | VALID／PASS | 兩頁收到 remote=true；一般 verbose 更新也同步。兩個 host 原為無 override，復原後精確恢復空 map；verbose=false。只允許 updatedAt 正常遞增 |
| P05 診斷讀取 | VALID／PASS，限定已執行子項 | 兩次實際 buildReport；6 個探測／寫入／恢復邊界呼叫數全為 0，狀態差異路徑為空；輸出 49,177 bytes、可解析、未出現原始 URL／cid 等禁止欄位 |
| P05 現場格式觀察 | 有限觀察，非完整格式矩陣 | 實際 hook 後續記錄自然 DASH XHR 200、accepted=true，21 video／3 audio；本輪沒有再執行 MP4／FLV 合成矩陣 |
| B06 reload→新拖曳→晚到成功，Auto 2 倍 | INVALID／無產品判定 | 第一階段網站先替換核心並暫停，腳本 reload／play 副作用皆為 0；沒有自有 SDK Promise 可供延後。意圖以 ownership-ended 結束，未執行後續拖曳／成功回呼 |
| C01 清理 | VALID／PASS | 詳見下節；受控 31 個 request ID 的記憶體及持久樣本均為 0，自有分頁最後為 0 |

P01 的 10 案是本輪新增的狀態／事件對照，不包含兩個沒有完整 Network 證據的 timeout 案；與第 2 輪 24 案不同。HTTPDNS 合成端點在建立請求前已裝精確 XHR Request 攔截。截斷窗口不能用最後清理成功補成完整網路證據。

P04 呼叫實際安裝版的既有產品命令，不宣稱完成控制中心點擊。選取的兩個 Catalog host 原本預設不可用，暫存 false 不新增可用路線。復原透過既有 updateSettings，在其 settings 鎖內讀取最新欄位並只移除仍為工具寫入值的 host；未清除學習、reset 或覆蓋整份舊設定。

P05 使用真實元件快照建立讀取模型，未包含 UI 的 host evidence 彙總列，也未注入識別字串。前置觀察曾使用整份 JSON 相等斷言，沒有保存差異路徑，該結果另存、不作產品缺陷判定；加入差異定位後，上表窗口確認狀態不變。報告的 generatedAt 隨讀取時間變動，不要求兩份報告位元組相等。本子項不等於整個控制中心匯出、所有識別來源或全部格式都已驗證。

## 未執行與再次執行的必要前提

| 項目 | 本輪處理與具體條件 |
| --- | --- |
| P01 bounded prepare／gate 交錯 | 未執行；需要實際等待中的 installed startup gate，不能自行建立控制器或重設預算 |
| P02 真 singleton gate | 各新文件自然起播均為 preflight-skipped:xhr-explicit-timeout；沒有實際 pending gate，不改網站 timeout 或反覆重載 |
| P03 同片 request cid／epoch | 自然 DASH API 出現前後 epoch 均為 0，但本輪沒有保留該原請求 cid；Resource Timing 已無對應項目。只能記錄自然回應及 epoch 觀察，不能判 request-owned cid 契約通過；須在下一個本來就需要的自然 API 前安裝精確觀察 |
| P04 關閉／切頁後 UI 回呼 | 封閉 Shadow DOM 點擊仍無新工具能力；不以直接命令呼叫替代 |
| E04／B07、S02 repeat／cancel | 不重跑 bringToFront、queued、900 ms 按鍵或不支援的 raw input。需要新的實際分頁切換／原生輸入能力 |
| B02／B03 新操作後完整 30 秒尾端 | 原先網站提前終止／尾端截斷的缺口保留；這輪不重跑已通過的前半段 |
| B06 其餘完成／拒絕交叉組合 | 新 2 倍窗口沒有實際 reload；1 倍也沒有新增可避免網站提前換核心的前提。不能拿無 SDK 呼叫的窗口冒充晚到測試 |

沒有新增自然網路起因調查，沒有把 P 項併入 BR-01 救援門檻，也沒有確認新的產品失敗。

## 清理與證據

1. 第一個 XHR 情境明確撤銷 14 個 Blob、移除 iframe、中止自有請求。逾時重試的工具狀態遺失後，重新取得該自有分頁並關閉，確認清單為空；沒有宣稱逐一呼叫到已遺失的 dispose。
2. 設定觀察的 4 個 listener 移除，兩頁設定與初始有效值及 map 形狀一致。沒有直接刪除 GM 資料。
3. B06 精確攔截解除後，再處理尾端新讀到的 10 個 paused ID，最終 held=0、patterns=0、pendingMediaCount=0。原生已取消的 ID 回報失效屬清理結果，不能當成仍持有中的請求。
4. 保留受控樣本抑制至尾端收束；31 個 request ID 的 memoryMatches／persistentMatches 均為 0，startup／challenge 為 0。6 個方法依原描述子與所有權還原，timer／訂閱移除，自有屬性刪除。
5. 故障後網站曾維持 paused、readyState=0；這輪不宣稱已取得正常播放恢復證據。自有頁面最後全部卸載，分頁清單為空，沒有留下故障或設定要求使用者清理。

本機完整證據：`.work/iab-testing/2026-10-11-v2.1.20-783ece1-r3/`，含身分、案例、原始失效窗口、設定事件、診斷計數、SDK 觀察、清理、重跑步驟及證據複核入口。沒有完整 npm／verify／安全掃描重跑；新增的是 IAB 現場證據與本機保存結果的一致性檢查。

12 個保存證據複核斷言通過；5 份更新文件的 GFM 檢查通過，16 個表格、142 個本機／同儲存庫連結及證據引用無錯誤。`git diff --check` 通過；src-v2、tests-v2、scripts、版本檔與 Release 相對基準沒有差異。
