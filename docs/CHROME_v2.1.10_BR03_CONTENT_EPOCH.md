# BR-03：相同 DASH 清單排列改變誤觸內容週期 — 2026-10-10

**已確認功能缺陷，建議 P2，尚未修復。** 相同影音 URL、表示與欄位完全不變，只對調不同目錄的兩個 video 項目，`PlayurlController` 就把同一份內容判成換片，重設 Vault 與 Runtime。獨立來源契約重現了音訊授權失效；實際 Tampermonkey v2.1.10 也重現錯誤 epoch 增加。這不是 BR-02 failed open 的回歸，也尚不能認定是 BR-01 停滯的根因。

基準提交 `c836a17818cd4ae86195e41b1e1c0933cff8cab0`，開始時工作目錄乾淨；本輪只調查與新增文件／私有證據，未修改執行期、正式測試、Release 或版本。整輪範圍與未完成驗收見 [Chrome 紀錄](CHROME_v2.1.10_ACCEPTANCE.md)，現行工作見 [TODO](TODO.md)。

## 使用者影響及契約

[產品契約](PROJECT_CONTEXT.md) 要求同片畫質切換不重設內容週期；只有確認內容改變才同步撤銷舊工作。清單排列本身不代表影片改變。本案例使用兩次新回應物件，完整 video／audio 集合相同，因此也不涉及同物件防篡改或過期回應的產品政策。

錯誤重設會清除影音路線、親和與授權索引，重設監控採樣、量測、恢復及播放器快取。來源契約直接確認原本仍合法的音訊 `RouteIdentity` 變成非當前身分；依賴 epoch／控制器標記的工作也會按既有防護失去提交資格。這可能中斷同片量測或恢復協調，但本輪沒有證明必然造成播放停止、網路請求被取消或資料外洩。

觸發前提是合法清單包含父目錄不同的 video 表示，且下一個可信回應改變第一項；相同目錄排列的正常對照不受影響。本輪沒有證明線上 API 普遍提供此排列，也不估算發生率。

## 最小事件順序

合成清單包含 video 80／AVC 1080p、video 120／AV1 2160p 與 audio 30280。video 分別放在同一合成內容的 `avc`、`av1` 子目錄，audio 保持相同。

1. 從可信 playurl 入口接納第一份清單 `[video80, video120]`。
2. 保存當前 epoch；來源契約另外保存 audio 身分並確認有效。
3. 送入新的可信回應物件，內容只是 `[video120, video80]`，audio 不變。
4. 預期 epoch、Runtime 重設次數與既有 audio 身分保持不變。
5. 實際 epoch 增加、Runtime 重設，既有 audio 身分失效。

兩份輸入的原始 video URL 集合以排序後相等斷言核對，沒有變更簽名、來源集合或設定。Chrome 使用相同合成回應從已安裝的 XHR playurl 觀察入口進入；不是直接改寫內部 Session，也沒有以新建置替換安裝腳本。

## 根因及精確位置

| 位置 | 行為及影響 |
| --- | --- |
| [playurl-controller.ts](../src-v2/application/playurl-controller.ts)，78–90 行 | 只從 `dash.video[0] ?? dash.audio[0]` 的正規化 URL 父目錄產生 `contentKey`；第一項換目錄即認定換片 |
| 同檔 81–88 行 | `beginEpoch()`、`vault.reset()`、`routes.resetEpoch()`，隨後同步通知內容週期訂閱者 |
| [runtime-controller.ts](../src-v2/application/runtime-controller.ts)，30–33、60 行 | 收到通知即重設 monitor／measurement／recovery／player，並記錄 `content-epoch` |
| [signed-route-vault.ts](../src-v2/state/signed-route-vault.ts)，56–61、135–138 行 | reset 清除索引並更新 epoch；`isCurrentIdentity` 要求 epoch 與物件身分均一致，舊 audio 因此失效 |

問題位於判定是否換片的前提，後續撤銷本身符合真正換片的設計。不可藉由放寬 Vault 的 epoch 驗證或移除 Runtime 同步重設來掩蓋。

## 重現與正常對照

私有證據目錄：`.work/chrome-v2.1.10/2026-10-09/`。日期採實際開始日；測試跨越台北午夜。原 v2.1.9 調查證據未覆寫。

來源入口，從專案根目錄執行：

```powershell
node .work/chrome-v2.1.10/2026-10-09/run-br03-content.mjs
```

此入口以 esbuild 載入目前來源及既有 runtime fixture，執行四個具名 `node:test`，使用合成資料與既有清理機制，不探測 CDN。它是獨立失敗契約，沒有登記到正式套件。未修復時退出碼 **1** 是缺陷證據，不能列作測試通過。

| 契約 | 未修復結果 |
| --- | --- |
| `BR-03 identical DASH inventory reordered across representation directories keeps the content epoch` | 失敗：預期 0，實際 1；generation 不變 |
| `BR-03 same-content permutation preserves the issued audio authority identity` | 失敗：預期 true，實際 false |
| `BR-03 control: same-directory DASH permutation preserves epoch and runtime` | 通過：epoch 與重設次數不變 |
| `BR-03 control: genuinely disjoint content revokes previous audio and resets runtime` | 通過：真正不同內容增加 epoch、重設 Runtime 並撤銷 audio |

原始來源結果為 **2 通過／2 失敗**，見 `br03-content-contract.log` 與 `br03-content-execution.json`。重跑輸出另存帶時間的檔案，原始紀錄保留。

Chrome 154 的實際安裝版結果：

| 情境 | 預期 | 實際 |
| --- | --- | --- |
| 不同目錄、相同清單排列改變 | epoch 2 → 2 | **2 → 3，失敗** |
| 相同目錄、相同清單排列改變 | epoch 4 → 4 | **4 → 4，通過** |

四次合成 API 回應均為 HTTP 200／code 0，product `lastPlayurl.accepted=true`，videoCount 2／audioCount 1。實際載入版本從 Tampermonkey 解析的 script source 及產品診斷核對為 2.1.10；Bilibili Evolved 2.11.4 保持啟用。Chrome 的 epoch 觀察與來源契約的音訊身分斷言分列，沒有宣稱瀏覽器能直接讀取私有 Vault。

證據為 `br03-installed-result.json`、四份 `br03-*-synthetic.json`／`br03-control-*.json`、`br03-fixtures.json` 及 `br03-synthetic-network-guard.json`。後者記錄四次送出前 fulfill、零合成媒體送出、捕捉未截斷及攔截已清除。頁面保持暫停測試；完成後重新載入同一指定影片，恢復真實內容。

## Chrome 重跑邊界

1. 僅開啟 [指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，確認實際產品診斷版本並暫停。
2. 在送出前啟用 CDP Fetch Request 攔截：精確 API `https://api.bilibili.com/x/player/playurl?bcdn_browser_content_contract=*`，限定 XHR；合成媒體 `*/upgcxcode/bilicdn-browser-contract/*` 限定 XHR／Fetch／Media。
3. 以主頁面的真正 XHR 請求該合成 API，從 `br03-fixtures.json` 依序 fulfill first／permuted；每次完成後從控制中心診斷讀取 epoch。回應具 JSON content type 及精確 bilibili origin CORS。
4. 每個請求啟動、攔截與 fulfill 在同一次操作中完成，避免 XHR 3 秒期限被工具回合消耗。維持連續事件 cursor；任何合成媒體請求一律在 Request 階段 fail，禁止 continue。
5. 以 controlFirst／controlPermuted 建立正常對照；保存版本、accepted、epoch 及捕捉完整性，不保存真實簽名 URL。
6. finally 撤銷未完成合成 XHR、清除攔截與測試全域，再重新載入同一影片。未設攔截不可執行此 Chrome 合成案例。

## 最小修正方向與必要回歸

內容身分判定應對清單排列、同片表示／編碼選擇保持穩定；不能把第一個表示的完整父目錄當作唯一身分。優先確認可用的可信內容識別資訊及現有輸入介面，訂出明確判定，再修改。單純對 URL 排序或截取固定路徑深度不足以保證畫質子集變動與真正換片均正確。

必要回歸為本四個契約，另補同片畫質／編碼子集、簽名更新、協定相對 URL、音訊不變／共用音訊目錄、真正不同內容及低信任提示不能驅動 epoch。維持真正換片的同步撤銷、Vault 唯一授權與有界儲存，不持久化原始路徑或新增另一份授權索引。

BR-01 需獨立比較網站請求、timeout、abort、seek／核心恢復交錯；本輪實際長 seek 發生在重載後 epoch 0，沒有此假 epoch 切換證據。修復 BR-03 不應被描述成已解決 BR-01。
