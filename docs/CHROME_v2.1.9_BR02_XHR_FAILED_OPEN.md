# BR-02：XHR `open()` 拋出例外後，原請求失去終止事件與狀態所有權

日期：2026-10-09（Asia/Taipei）。**已確認功能缺陷，優先級 P2；尚未修復。** 本報告完成「持續驗收，直到全部完成或找到問題並撰寫詳細報告」的第二個退出條件，不代表所有驗收通過。

## 結論與使用者影響

在 BiliCDN v2.1.9 的真實 Chrome 分頁中，XHR 因政策被排入本地失敗後，如果呼叫端在同一個 JavaScript 工作內再次呼叫會拋出例外的 `open()`，原本應收到的 `readystatechange → error → loadend` 會全部消失。即使呼叫端已捕捉該例外，請求仍無法正常結束。等待 `error` 或 `loadend` 才解除載入狀態、釋放資源或開始重試的程式會因此一直等待。

同一根因也使已完成的虛擬 `DONE` 狀態倒退到 `OPENED`，以及在 `readystatechange` 回呼中吞掉後續 `error／loadend`。這些症狀合併為一項發現。

觸發條件包含無效 method、禁止的 method、無法解析的 URL，以及不合法的同步 XHR 選項。這是呼叫端輸入錯誤後的相容性缺陷；本次沒有證明一般播放都會走到這個分支，也沒有把它當作先前 8K→4K 停滯的根因。

## 環境與證據界線

- 本機提交：`b177f76b824b3ef2027023afd933a252939d1ca5`；已安裝腳本診斷版本 2.1.9；Chrome 154.0.0.0。
- 使用者提供的管理介面截圖顯示 Tampermonkey 5.5.0 與 Bilibili Evolved 2.11.4。實測保留共存環境；未停用其他腳本或修改瀏覽器設定。
- 本輪瀏覽器只使用 [使用者指定的風景展示片](https://www.bilibili.com/video/BV1tFZZBQE57/)。XHR 使用合成測試 URL 與本機 Blob，沒有對真實 CDN 人為注入故障。
- 已安裝腳本使用 **Chrome 原生 XMLHttpRequest** 執行失敗矩陣；另以臨時同源空白 iframe 的原生 XHR 作正常對照。該建構函式確認為 native code；iframe、Blob 與測試變數均已清理。
- 獨立 Node 契約直接打包現行 `XhrHookAdapter`，只替換瀏覽器邊界；不作真實瀏覽器證據，也未加入正式測試登記。
- 六個瀏覽器失敗情境與 Node 的對應結果一致。同步選項情境在共存 Chrome 中的末態是 `UNSENT`，其餘等待情境是 `OPENED`；本報告只把共同可確認的終止事件遺失歸因於該缺陷。

## 被違反的契約

現行產品要求 XHR 重用、取消、逾時、文字／JSON 行為相容，且請求事件由該請求擁有。原請求的所有權應在一次**成功的重新 open** 後移交。

WHATWG 的 `open()` 步驟先驗證 method、URL 與同步選項，再終止前一個 fetch 並初始化新請求；`send()` 也必須拒絕已開始的請求再次送出。拋出上述驗證例外，不表示一次成功的重新 open。[XHR open 規範](https://xhr.spec.whatwg.org/#the-open()-method)、[XHR send 規範](https://xhr.spec.whatwg.org/#the-send()-method)。

## 最小事件順序

HTTPDNS 阻擋保持啟用。以下程式只展示順序；瀏覽器重跑時應先依後述入口安裝精確的送出前保護攔截。

```javascript
const xhr = new XMLHttpRequest();
const events = [];
for (const type of ['readystatechange', 'error', 'loadend']) {
  xhr.addEventListener(type, () => events.push(type));
}
xhr.open('GET', 'https://httpdns.bilivideo.com/bilicdn-browser-contract');
events.length = 0;
xhr.send(); // 腳本排入本地失敗微任務，尚未呼叫原生 send。
try {
  xhr.open('BAD METHOD', 'https://example.invalid/synthetic-control');
} catch (error) {
  // Chrome 正常拋出 SyntaxError；此處已捕捉。
}
await Promise.resolve();
```

**預期：** 原請求仍完成一次 `readystatechange → error → loadend`，最後 `readyState === 4`，沒有原生 HTTPDNS 請求。

**實際：** `events` 為空、`readyState === 1`。問題不依賴隨機計時；取消本地微任務所有權的動作發生在同一個同步呼叫堆疊。

## 真實 Chrome 結果

主要矩陣共八個案例：兩個正常對照通過，六個正確契約失敗。失敗不是預期行為通過，不能計入通過數。

| 案例 | 預期 | v2.1.9 實際 |
| --- | --- | --- |
| 原生 iframe：Blob 請求後 failed open | 保留原請求並正常完成 | 通過，HTTP 200、原本文 |
| 安裝腳本：Blob 請求後 failed open | 保留原請求並正常完成 | 通過，HTTP 200、原本文 |
| 本地等待＋非法 method | 捕捉 SyntaxError 後原失敗仍完成 | **失敗：零終止事件，state 1** |
| 本地等待＋TRACE | 捕捉 SecurityError 後原失敗仍完成 | **失敗：零終止事件，state 1** |
| 本地等待＋無效 URL | 捕捉 SyntaxError 後原失敗仍完成 | **失敗：零終止事件，state 1** |
| 本地等待＋非零 timeout 的同步 open | 捕捉 InvalidAccessError 後原失敗仍完成 | **失敗：零終止事件，state 0** |
| 本地失敗已完成後 failed open | 保留 DONE | **失敗：4 倒退為 1** |
| readystatechange 回呼內 failed open | error、loadend 照常完成 | **失敗：只有 readystatechange** |

補充正常對照：沒有 failed open 的本地拒絕正常完成三個事件，零原生送出；另以兩個內容不同的 Blob 重測原生 iframe 與安裝版，均保留第一個 Blob 的本文。這排除了把本地 Blob 成功誤當成原 URL 保留的疑慮。

主矩陣的精確 HTTPDNS 防漏攔截沒有捕捉到原生請求。另一次「failed open 後再次 send」探索中，安裝版未拋出應有的 InvalidStateError，但瀏覽器也沒有捕捉到受保護目標的 requestPaused；因此**沒有確認該共存瀏覽器實際向 HTTPDNS 出站**。

## 根因與精確位置

來源：[src-v2/adapters/xhr-hook.ts](../src-v2/adapters/xhr-hook.ts)。

1. **第 65–66 行：** 尚未成功呼叫原生 `open()`，便把前一筆 metadata 設為 terminal 並呼叫 cleanup。
2. **第 73–80 行：** 新 metadata 立即覆蓋 WeakMap；新狀態是 opened、virtualReadyState 是 null。
3. **第 81–82 行：** 才呼叫原生 `open()`。它拋出例外時，沒有回復前一筆所有權、事件監聽或虛擬狀態。
4. **第 46–59 行：** 舊本地失敗微任務及事件序列會核對 WeakMap／phase；因此視為原請求已失去所有權而直接返回。這項防止成功 reopen 污染新請求的保護本身合理，錯誤在於失敗 open 也先移交了所有權。
5. **第 87–88 行與第 130–132 行：** 下一次 send 讀取錯誤的新 metadata；原生 XHR 仍可能保存舊目的地，但政策檢查已使用新輸入。

正式回歸替身 [tests-v2/regressions/functional-races/xhr.ts](../tests-v2/regressions/functional-races/xhr.ts) 第 40–45 行的 open 直接覆寫狀態，沒有 method／URL／同步選項驗證失敗邊界。既有 B4 的成功 reopen 案例因此不能發現本次問題；原先 299 案例通過與本次新失敗並不矛盾。

## 獨立重現與反證

在儲存庫根目錄執行：

```powershell
node .work/chrome-v2.1.9/2026-10-09/followup/run-failed-open.mjs
```

現行未修改來源的結果：**9 個具名 node:test 案例，2 通過、7 失敗，退出碼 1；cancelled／skipped／todo 均為 0。** 七個失敗斷言描述正確契約，沒有把錯誤行為寫成應通過的斷言。

其中六項對應 Chrome 已確認情境；第七項驗證原生請求目的地與政策 metadata 分裂的影響。在只含本專案攔截器的合成模型中，第二次 send 會呼叫保存了 HTTPDNS 舊 URL 的原生 send。這是安全相關的控制流程證據，但不替代前述尚未成立的真實瀏覽器出站證據。

反證與限制：

- 原生 iframe 的 failed open 及原生 Blob 正常完成，例外本身不必然破壞請求。
- 沒有 failed open 的本地拒絕正常完成；缺陷不在一般本地錯誤通知。
- 實測沒有修改 XHR prototype、產品來源或其他腳本設定來製造主矩陣失敗。
- 獨立模型驗證源碼已足以產生相同功能錯誤，但沒有完全模擬網站／Evolved 的其他包裝。共存環境的所有額外副作用不一併歸因給 BiliCDN。
- 本次由同一代理以規範、原生對照、來源及獨立契約複核；沒有宣稱另一代理或 Codex Security 已完成新審查。

## 最小修正方向與必要回歸

本次只交付問題，沒有套用修復。修正時應讓 open 的所有權移交具有例外安全性：原生驗證失敗須保留舊 metadata、cleanup、虛擬狀態與待完成工作；成功 open 才永久撤銷舊請求。不能只把 WeakMap 指回舊值，因為舊 phase 和事件監聽也已被破壞。

同時必須處理原生 open 同步觸發 readystatechange、回呼內再次 open／abort 的所有權。不能為修正失敗路徑而重新引入成功 reopen 的舊事件污染。政策檢查使用的 method／URL 必須與原生 XHR 最後一次成功 open 一致。

正式回歸至少包含：

- 本報告六個例外／事件情境與不同 Blob 的原生對照。
- 真正 startup gate 等待時 failed open、接著 abort／gate 晚到，原請求不遺失也不重送。
- 已送出原生請求、尚未 send 的 OPENED、虛擬 DONE 各自遇到 failed open。
- SyntaxError、SecurityError、同步 InvalidAccessError，及 Web IDL 參數轉換例外。
- 成功 open 的同步 readystatechange 內再次 open／abort，維持現有 B2／B4 保護。
- 以受控網路驗證「政策 metadata 與原生實際目的地」始終相同；安全相關修補另做 Codex Security 差異審查。

## BR-01 的續測結果

本輪新分頁在沒有手動切畫質、沒有故障注入的續播過程中，也出現影片維持 seeking、readyState 1、零緩衝。已捕捉的位置 3483.438359 秒，在恢復播放操作後約 45 秒才收到 seeked／playing，實際尺寸轉為 1080P。稍後又有 emptied／loadedmetadata／seeking 序列，再度回到 4K；這些變化發生時沒有本輪畫質切換操作。只能確認播放器有自然降級／重新載入的現象，未定位發起者。

當時產品診斷有影片請求逾時及其他請求取消；seeking 期間監控持續為 seek-grace。來源確實每次 seeking 都延後 grace，但「最初傳輸失敗、網站／共存腳本重新載入、監控恢復邊界」尚未分離。**BR-01 保持待定位，不與本次已確認 BR-02 合併。**

## 產物與結束狀態

本機證據在 `.work/chrome-v2.1.9/2026-10-09/followup/`：

| 檔案 | 用途 |
| --- | --- |
| `failed-open-matrix.js`、`failed-open-matrix-results.json` | 真實 Chrome 八案例與防漏計數 |
| `failed-open-local.js`、`failed-open-local-results.json` | 初始最小失敗及正常本地拒絕對照 |
| `different-blob-control.js`、`different-blob-control-results.json` | 不同 Blob 的原 URL 保留對照 |
| `failed-open-policy.js`、`failed-open-policy-results.json` | 再次 send 的探索；未確認實際出站 |
| `failed-open-contract.ts`、`run-failed-open.mjs`、`failed-open-contract.log` | 獨立來源重現與退出碼紀錄 |
| `failed-open-browser.png` | 以實測結果產生的臨時驗收工具面板截圖；明確標為非產品介面 |
| `progress.json` | 同片續播的樣本、播放器事件及去敏感化產品快照 |

精確重跑與清理方式見同目錄 `RERUN.md`。所有用於防漏的 CDP Fetch patterns、臨時 iframe／Blob、事件觀察器及畫面上的驗收工具面板都已移除。本輪未改腳本設定；為避免片尾自動連播，測試分頁最後暫停在指定影片，沒有換片。

正式來源、正式測試、Release 與既有安全產物未修改，未提交、推送或發布；沒有重跑完整 npm verify 或新安全掃描。其他尚未覆蓋的驗收仍見 [完整瀏覽器範圍](CHROME_v2.1.9_ACCEPTANCE.md#尚未完成的情境)，本次按使用者設定的「找到問題並完成詳細報告」條件結束。
