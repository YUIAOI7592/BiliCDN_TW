# BR-05：起播 gate 遺失 Fetch 取消原因 — 2026-10-10

**已確認、未修復；功能優先級 P2。** v2.1.11 安裝版的第一個可安全預測試的影音 Fetch，在等待起播 gate 時遭取消，Promise 拒絕值被替換為新建的 `DOMException("Aborted", "AbortError")`，不再是呼叫端的 `AbortSignal.reason`。真正 Chrome 的未攔截 Fetch 正常對照會保留同一個原因物件。這是獨立相容性缺陷，**没有證明它造成 BR-01 長 seek**。

## 基準與影響

- 提交：`f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e`，BiliCDN_TW **2.1.11**、Tampermonkey **5.5.1**、Chrome **155**。執行中的腳本 body 與 Release 產物一致；完整產物 SHA-256 為 `9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`。
- 違反現行 [Fetch 契約](PROJECT_CONTEXT.md) 與 [必要不變量](../AGENTS.md#required-invariants)「維持單一讀取器，並傳遞取消原因」。原因物件、Error、字串皆受影響；採用 `reason` 身分或特定錯誤型別區分取消／期限的呼叫端可能進入錯誤分支。沒有驗證 B 站目前是否依賴自訂原因。
- 可達入口為網站的 `fetch(mediaUrl, {signal})`。僅在 `recognizesMedia()` 且 GET 進入 startup gate 的分支成立；停用、未管理 URL 或沒有 gate 的原生直通不能據本發現列為受影響。
- 不涉及新的原生來源授權、資料洩漏或安全繞過；本次沒有擴展安全掃描，也没有修復、提交或發布。

## 事件順序及預期／實際

1. 在送出前安裝合成 API／影音 Request-stage 攔截，再以可信合成 playurl 登記精確來源。
2. 安裝版 XHR 啟動真正的共用 startup gate：`running`、3 candidates、`delayed: true`。
3. 同一來源的 Fetch 加入等待，立刻執行 `controller.abort(reason)`，其中 `reason` 是唯一的測試物件。
4. Fetch 拒絕。預期 `caught === reason`；實際 **false**、名稱為 `AbortError`。同 gate 的其他 XHR 仍各自完成，單一呼叫取消沒有取消共用窗口。
5. Chrome 原生 iframe Fetch 與安裝版控制器的獨立對照再測物件、Error、字串：原生 **3／3 保留原因**，控制器 **3／3 遺失原因**；等待中取消也遺失。

完整安裝版路徑見 `.work/chrome-v2.1.11/2026-10-10/remaining-acceptance/startup-gate-live-result.json` 的 `fetchOutcome`。原生／控制器對照見 `fetch-abort-reason-control.json`；重跑 helper 為同名 `.js`。首次 helper 的案例標籤欄位被錯誤名稱覆蓋，只修正測試標籤後重跑；執行期來源沒有變更，第一個完整 gate 的失敗紀錄保留。

## 根因及位置

- [fetch-hook.ts](../src-v2/adapters/fetch-hook.ts) **第 70–71 行**把平台正規化 Request 的 signal 傳入 `prepareStartup()`，直接等待其 Promise；錯誤在原生 Fetch 送出前向外傳遞。
- [measurement-controller.ts](../src-v2/application/measurement-controller.ts) **第 90 行、第 118 行**在已取消 signal 的兩個邊界自行建立 `AbortError`。
- 同檔 **第 122 行**的等待中 abort listener 也自行建立 `AbortError`，沒有使用 `signal.reason`。
- 已送出的媒體 Fetch 在 [fetch-hook.ts](../src-v2/adapters/fetch-hook.ts) 第 103–108 行重新拋出原生錯誤；stream cancel 在第 141–143 行傳遞 reader 的取消原因。這些分支不是本次根因，不能以修它們代替 gate 修復。

## 獨立失敗契約

在儲存庫根目錄執行：

```powershell
node .work/chrome-v2.1.11/2026-10-10/remaining-acceptance/br05/rerun.mjs
```

`br05/repro.ts` 使用具名 `node:test`、`testScope`、`FakeClock` 與受控 probe，不連線 CDN。執行結果為 **7 案例：3 正常對照通過、4 正確契約失敗、exit 1；0 cancelled／skipped／todo**，保存在 `br05/node-result.json`。四個斷言要求原始原因身分相同，实际均收到 `AbortError: Aborted`。這是未修復缺陷的失敗證據，**不是正式套件通過結果**；沒有登記到正式測試或改變其來源。

## 最小修正方向與必要回歸

在 gate 的已取消及等待中取消邊界使用呼叫端的 `signal.reason`，包括 falsy 字串等合法原因；不要以 truthiness 判斷是否存在。若相容平台需要 fallback，明確限於沒有 reason 能力的情境。維持單一等待者的 abort listener 清理及共用 gate 的所有權，不能為修原因而取消其他等待者或整個探測。

修復前先把契約移入正式量測／Fetch 套件，涵蓋預先取消、等待中取消、物件／Error／字串／falsy 原因、原生直通、已送出／讀取中取消，以及單一 Fetch 取消但其他 XHR／Fetch 繼續。須另有「完成後 abort 不重複終止」「generation／epoch 撤銷不被自訂原因繞過」對照。安裝修復版本後重跑真正 gate，不能以 Node 或原 v2.1.11 宣稱修復版驗收通過。

## 清理與限制

合成 URL 攔截先於送出，相關 guard 事件窗口未截斷；請求由測試 fulfill／fail 或原生取消，沒有將合成請求繼續送到 CDN。iframe、Blob、測試 XHR、暫時委派及證據方法均已清理。後續 probe 邊界矩陣使用新的**受控 controller 預算**，並在原有 hooks 內執行；它們不是原有 singleton 多次使用起播預算的證據。

真實網站只使用指定[風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，保留 Chrome 設定與其他腳本。完整續測、BR-01 因果定位及待驗收限制見 [本輪報告](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md)。
