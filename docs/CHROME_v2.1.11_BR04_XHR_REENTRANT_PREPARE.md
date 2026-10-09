# BR-04：內部 XHR 重新準備遭同步重入失效 — v2.1.11

**2026-10-10 02:58（Asia/Taipei）：真正 Chrome 155／Tampermonkey 安裝版確認重現。** 優先級 **P2**。等待起播窗口的 XHR 在內部 `open()` 回呼中再次遇到同步限制例外，會留下原生 UNSENT、腳本 metadata 卻為 sent 的不一致狀態；原請求沒有送出或終止通知，非同步鏈產生未處理的 `InvalidStateError`。

本輪完成使用者設定的「找到可重現問題並撰寫詳細報告」條件，停止擴展驗收。**沒有修復或發布，完整產品驗收仍未完成。** BR-01 長停滯沒有因此定位或結案。

## 基準及影響

提交為 `f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e`，版本 **2.1.11**。真正 Chrome user agent 為 **155.0.0.0**；執行中的 Tampermonkey userscript 完整包含正式產物程式正文，SHA-256 為 `9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`。本輪保留先前四份未提交驗收文件，未修改 `src-v2/`、`tests-v2/` 或 Release 快照。

觸發條件必須同時成立：

1. 合法媒體 XHR 為非同步 GET、沒有顯式 timeout，真正起播 gate 延遲原生送出。
2. 設定非預設 responseType（本次為 json），第一次不合法同步 `open(..., false)` 例外被網站捕捉；Chrome 原生退回 UNSENT，腳本保留等待請求。
3. gate 完成時，內部重新 `open()` 同步觸發 OPENED 的 `readystatechange`。
4. 該回呼再次嘗試不合法同步 open 並捕捉例外，使同一原生物件再次退回 UNSENT。

使用者影響是等待此請求的呼叫端收不到 load／error／abort／timeout／loadend，可能持續等待。未證明一般播放都會觸發；網站的顯式 timeout 請求會略過 gate，不屬此次重現條件。沒有證明它是 BR-01 的根因。

## 被違反的契約

BR-02 已選定「failed open 保留舊等待請求的所有權及後續終止通知」。本次第二次 failed open 沒有成功建立新請求，原等待請求仍有所有權；內部送出必須重新確認原生準備有效，或以相容的失敗路徑終止一次，不能將外部 send 已返回的請求留在無可完成狀態。

原生 XHR 對照**不會自動恢復被同步限制失效的 OPENED**。其 UNSENT／InvalidStateError 是原生現象；產品缺陷是攔截器在所承諾的延遲送出流程中，未處理回呼再次失效，造成 metadata／原生狀態分歧及未處理非同步拒絕。

## Chrome 原生及安裝版對照

| 案例 | 回呼內操作 | 結果 | 契約 |
| --- | --- | --- | --- |
| `native-syntax` | 無效 method，捕捉 SyntaxError | 維持 OPENED，Blob 200，loadend 一次 | 原生正常對照通過 |
| `native-sync` | 同步限制，捕捉 InvalidAccessError | 原生 UNSENT；隨後 send 同步拋 InvalidStateError | 原生邊界校準通過，不算產品通過 |
| `installed-syntax` | 真 gate 的內部 OPENED 回呼遇 SyntaxError | 原請求受控 200，DONE，loadend 一次 | 正常對照通過 |
| `installed-sync` | 同一 gate 的內部 OPENED 回呼遇同步限制 | 原生／公開 readyState 0、metadata sent、needsNativeOpen false、loadend 0 次；未處理 InvalidStateError | **正確契約失敗，確認 BR-04** |

兩個安裝版案例均先觀察到 `waitingPhase=waiting`、readyState 1，第一次 failed open 後 readyState 0；內部 OPENED 回呼各執行一次。真正 MeasurementController 狀態為 **running／delayed、3 候選**，沒有替換 `willGateStartup` 或 `prepareStartup`。

全部合成請求先以 CDP Request 階段攔截再回覆。完整有效事件窗口有 **3 個 Range 探測＋1 個無 Range 正常對照請求**，事件未截斷、沒有未讀分頁。探測刻意回覆 200，所以 gate 最終為 inconclusive／skipped；仍完成原等待流程。問題案例沒有第二個原請求送出。沒有探測或外送真實 CDN 測試資料。

## 精確根因

來源為 [xhr-hook.ts](../src-v2/adapters/xhr-hook.ts)：

- **第 112 行**：failed open 還原舊 waiting metadata；原生 UNSENT 時設定 `needsNativeOpen=true`。
- **第 128–135 行**：內部 `reopen()` 呼叫原生 open，同步事件返回後只以 `waiting(this, meta)` 檢查 metadata 身分及 phase，沒有確認原生仍可送出；之後將 `needsNativeOpen=false`，覆蓋回呼中第二次失敗所設的 true。
- **第 216 行**：metadata 改為 sent 後呼叫原生 send，因原生 UNSENT 拋 InvalidStateError。
- **第 221 行**：`prepareStartup(...).then(perform, perform)` 沒有處理 perform 本身的例外；外部 send 已返回，呼叫端只能收到未處理 Promise 拒絕。

此為單一準備失效／提交邊界問題，UNSENT、終止事件遺失及未處理拒絕合併為一項，不拆成三個缺陷。

## 證據及重跑

私有目錄：`.work/chrome-v2.1.11/2026-10-10/br04/`。

| 檔案 | 用途 |
| --- | --- |
| `repro.ts`、`rerun.mjs` | 獨立 Node 正確契約與既有測試執行器入口，未登記正式套件 |
| `node-result.json` | 1 正常對照通過、1 正確契約失敗；預期原送出 1 次，實際 0，exit 1 |
| `chrome-installed-harness.js` | 真正原生 iframe＋安裝版共享 gate 的四個具名情境及所有權清理 |
| `chrome-installed-result.json` | Chrome 155 狀態、完整事件、契約判定、guard 與版本校驗 |
| `chrome-discarded-query-round.json` | 第一輪加入 case 查詢參數破壞精確授權、未命中 gate；已作廢，不混算產品結果 |
| `RERUN.md` | 安裝版 CDP 入口、攔截回覆、資源清理及斷言步驟 |
| `chrome-screen.png` | 指定風景影片的現場截圖；行為證據以 JSON 事件為準 |

Node 根目錄重跑（目前預期 exit 1）：

```powershell
node .work/chrome-v2.1.11/2026-10-10/br04/rerun.mjs
```

Chrome 正確契約要求安裝版問題案例完成一次原請求，或有明確且相容的單次終止；目前 `expectedTerminal=1`、`actualTerminal=0`。沒有只斷言錯誤行為存在，也沒有將這個失敗算成整體通過。

## 測試替身及清理複核

- Native 來自新建 iframe，open 及保存的 originalOpen／Send／Abort／SetHeader 均核對為 native code。
- 執行實際安裝的 XhrHookAdapter、RouteCoordinator、MeasurementController 及原生 XHR；只以合成 API 回應提供合法路線，送出前阻止合成請求外送。
- 唯讀閉包參照取得實際元件，沒有加入公開橋接。歷史寫入邊界只過濾本輪擁有的 request ID／合成 startup 樣本及起播游標寫入，沒有替換 gate 或 native open／send。
- RSC 回呼沒有隨機等待；兩案例共享同一真正 gate，正常對照成立。Node 與 Chrome 各自重現相同 source 邊界。
- 已還原 instance 級寫入方法、移除本輪事件監聽器、abort 擁有的 XHR、撤銷 Blob、移除 iframe、停用 Debugger、清空攔截並關閉本輪分頁；使用者其他分頁未操作。
- 初次合成 Fetch 回應缺少 CORS 標頭，是工具失敗，補齊後合法 ingress 通過。探測實際透過 XHR，因此有效輪的 200 探測屬刻意不合格回覆，不宣稱健康量測成功。

## 最小修正方向及必要回歸

1. 內部原生 open 回呼返回後，除 metadata 身分／phase 外重新驗證原生準備仍有效；回呼再次失效不可被外層盲目清除標記。
2. 對仍擁有的等待請求提供有界重新準備或單次相容終止，不能無限 reopen。
3. 處理 gate 回呼中的 throw，避免送出提交失敗後沒有終止通知或產生未處理拒絕。
4. 正式回歸加入同一真 gate 的 SyntaxError 正常對照與二次同步限制、headers／選項還原中重入、回呼成功 reopen／abort、持續失效上限，以及已送出請求不得重送。
5. 修復後重跑 BR-02／BR-03 所有權矩陣及安裝版本案例；必要驗證與安全差異審查依實際修補另行記錄。

這是修正方向，不是已批准或已實作的修復。未完成的完整 gate、恢復、R04、生命週期與 BR-01 仍見 [中途報告](CHROME_v2.1.11_PROGRESS.md)及[工作狀態](TODO.md)。
