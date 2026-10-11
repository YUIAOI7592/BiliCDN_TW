# v2.1.20 內建瀏覽器 TODO 第 4 輪 — 2026-10-11

基準：`14ea6a57f133c916513e30621ab84d5713ce9ee4`，開始時工作目錄乾淨。瀏覽器工作約 19:36–19:47（Asia/Taipei）。現行累計狀態見 [TODO](TODO.md)，執行邊界見 [IAB_TESTING](IAB_TESTING.md)。

**新增 XHR 真正逾時 2 個對照及來源隔離 17 項通過，沒有新確認的產品缺陷。** 已通過的前 3 輪案例沒有重測。本輪未取得完整通過：產品請求與測試資源已清理，但最初連線失敗產生的工具錯誤分頁被 URL 政策阻擋，尚無關閉證據；其他沒有新前提的固定矩陣未執行。

## 本輪選擇與身分

- 只使用 Codex 內建瀏覽器。網站只開指定風景影片，Auto，保留進入時的 2 倍速；本輪沒有新的 1／2 倍播放故障矩陣，不把無倍速關聯的傳輸測試計成兩倍速通過。
- 完整 v2.1.20 本體相符，Tampermonkey 5.5.1，Runtime／ControlCenter 各唯一一個；身分事件未截斷。產物 SHA-256：`b8e5bd4744737537f348fcc7d9fb9f258fd41bc5e60327e5f4259560dcd5b54e`。
- 重新設計 P01 收集器：頁面立即啟動、立即讀取，單一 Fetch／Network 游標連續排空，不再用長時間 awaitPromise 阻塞工具事件處理。這是本次重開逾時子項的新前提。
- P05 的 MP4／FLV 與 hook 安裝／釋放此前只有其他層級或歷史證據，這輪補內建瀏覽器來源隔離；不重跑 R3 診斷讀取。
- 沒有再開背景、可信 repeat／pointercancel、封閉 Shadow DOM UI 或長時間 BR-01 故障窗口；也沒有重載同片追逐 startup gate。

## P01：真正 timeout 通過

| 項目 | 原生 XHR | 實際安裝 hook |
| --- | --- | --- |
| 測試資源 | 自有無腳本 iframe 的原生 XHR | 指定影片的實際 XHR |
| 期限 | 1000 ms | 1000 ms |
| 實際 DONE 時間 | 約 1009.8 ms | 約 1009.4 ms |
| 事件順序 | OPENED readystatechange → loadstart → DONE readystatechange → timeout → loadend | 相同 |
| 最終狀態 | readyState=4、status=0、response／responseText 為空字串 | 相同 |
| 判定 | VALID／PASS | VALID／PASS |

請求只指向同源自有非媒體端點，送出前已安裝精確 XHR Request 攔截，沒有轉送至網站伺服器或 CDN。兩筆均捕捉到 request、paused 與 native timeout 導致的 loadingFailed；沒有 responseReceived、截斷或丟失，最大讀取間隔 125 ms。

最終 held=0、patterns=0、自有請求=0、timer 清除、iframe 移除。原生已逾時的 2 個攔截 ID 在清理時回報失效，與尚未釋放的請求分列。上輪的兩個無效 timeout 窗口保留，這輪的成功不回寫舊結果。

累計 P01 已有 R2 的 24 案、R3 的 10 案及本輪 2 案；真 singleton gate 內的 bounded prepare 仍沒有成立前提，不能因此宣稱整個 P01 完成。

## P05：格式與 hook 資源通過

來源隔離頁綁定 loopback，使用當前來源、真正瀏覽器 Fetch／XHR 與記憶體 FakeStorage。GM 不存在，沒有連到使用者正式持久資料。工具先安裝精確合成 API Request 攔截，再啟動矩陣；12 筆請求全部在送出前以自有 JSON 回應，沒有外送。

| 群組 | 案例數 | 預期與實際 | 判定 |
| --- | --- | --- | --- |
| MP4 × Fetch／XHR text／XHR json | 3 | code=0，Catalog 輸出；兩個分段身分分離，order／length／size 不變，XHR 重複 getter 一致 | VALID／PASS |
| FLV × 三種傳輸 | 3 | 與上列相同；不是將片段順序排序或合併 | VALID／PASS |
| DASH＋MP4 混合 × 三種傳輸 | 3 | 3 video／1 audio／2 segments，合法 Catalog 輸出與音訊分類保留 | VALID／PASS |
| 無效混合 durl=null × 三種傳輸 | 3 | 拒絕整份回應、不外洩巢狀來源；Fetch 為 503，XHR 保留原生 200，內容均為安全失敗物件 | VALID／PASS |
| 完成後 dispose | 1 | Fetch 與 XHR 四個方法、三個 getter 的原描述子還原 | VALID／PASS |
| 重複 install／dispose | 3 | 同次重複 install 不疊加，dispose 後原生描述子全部相符 | VALID／PASS |
| 其他擁有者接手後 dispose | 1 | 新 Fetch／open 包裝保留；測試自身再依所有權還原 | VALID／PASS |

單一 Network 游標記錄完整 12 次 request／paused／200 response／finished，無 loadingFailed、無截斷，最大讀取間隔 39 ms。完成時自有請求與記憶體寫入均為 0；清理後儲存訂閱=0、timer=0、held=0、patterns=0、原生描述子還原。23 個打包輸入與 bundle 雜湊另存，型別檢查通過。

這是 **S 層來源隔離**，不是現場 MP4／FLV 播放或安裝版 singleton。沒有測試解碼與播放品質，也不擴大成整個 P05／UI 匯出已通過。

## 未執行項與停止理由

| 項目 | 本輪處理 |
| --- | --- |
| E04／B07 真背景、S02 repeat／cancel | 沒有新工具能力，不重複既知無效操作 |
| B02／B03 新操作後完整 30 秒尾端、B06 其餘晚到 SDK | 沒有新增能維持必要播放／核心前提的證據，不再開同樣故障窗口 |
| P01 bounded prepare／P02 真 gate | 本文件自然 startup 仍為 preflight-skipped:xhr-explicit-timeout；没有 pending gate，不改 timeout 或預算 |
| P03 自然 request cid／epoch | 本輪沒有在新自然 API 前取得完整請求觀察，未執行契約判定；不以最後 epoch=0 補算通過 |
| P04 UI 關閉／切頁、P05 完整 UI 匯出 | 封閉 Shadow DOM 操作能力沒有改善；沿用命令／診斷子項，不能冒充 UI |
| 原自然停滯網路原因 | 沒有新增自然故障證據，未擴展調查 |

## 清理、工具限制與交付

網站最後 paused=true、readyState=4、位置約 32.54 秒，pendingMediaCount=0、recovering=false；沒有網站媒體故障注入、學習抑制包裝或設定變更。網站與成功的來源隔離頁均已明確關閉，loopback 服務已停止。

最初受限環境的 loopback 服務無法連線，產生一個工具錯誤頁；在主機重新啟動並確認 HTTP 200 後，新的 HTTP 分頁才執行矩陣。錯誤頁沒有執行產品來源、建立合成請求或連接 GM，但取得／關閉被 Browser Use 的 data URL 政策拒絕。本輪沒有繞過政策，最後清單仍有該空錯誤頁，因此 C01 的「全部自有分頁已關閉」尚無證據，不能把整輪清理標為通過。

證據目錄：`.work/iab-testing/2026-10-11-v2.1.20-14ea6a5-r4/`，含基準、身分、P01／P05 原始結果、來源與打包雜湊、清理、案例、重跑說明及截圖。9 個保存證據斷言、5 份文件 GFM／17 表格／145 連結與 `git diff --check` 通過；這些檢查不重跑瀏覽器。

正式 `src-v2/`、`tests-v2/`、版本與 Release 均未改動。沒有重跑已通過的完整 npm／verify／安全掃描，沒有升版、發布或排程。剩餘產品範圍仍見 TODO；只有新工具能力、自然前提或相關來源修改才重新開啟對應窗口。
