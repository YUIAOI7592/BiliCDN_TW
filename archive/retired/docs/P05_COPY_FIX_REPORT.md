# P05 原生優先修復與驗收

日期：2026-10-12。基準 v2.1.21／`f534838`，開始時工作目錄乾淨。目標 v2.1.22；本輪只處理診斷複製，BR-01 保持跳過，已通過項目不重測。

## 問題與修改

v2.1.21 真正 UI 複製後，當次 18,150 字元報告與 IAB 讀回／真正貼上的原文字不符；GM 純文字校準有完成通知仍未更新。原始 [失敗紀錄](P05_COPY_IAB_RESULT_2026-10-12.md) 保留，不把這次改用原生通道描述成修復 Tampermonkey 本身。

`src-v2/ui/control-center.ts` 新增私有 copy 操作，保留完整報告與原 receiver，在可信 click 內立即呼叫 writeText。API 查詢不可用才呼叫 GM(text, 'text')；原生拋錯或拒絕不再次寫入。aria-live status 分開提示原生完成、GM 已交付及失敗。單一未完成寫入跨關閉／開啟仍排他；宿主／ShadowRoot／視圖版本及操作標記控制晚到更新，不搶焦點。`globals.d.ts` 只補純文字型別；無新權限、設定、schema 或剪貼簿讀取。

## 正式案例對照

正式入口 `node scripts/test.mjs --suite control-center`，案例位於 `tests-v2/suites/control-center.ts`，不匯入調查資料。

| 修改契約 | 案例 |
| --- | --- |
| 原生優先、可信派送、receiver、中文多行長文字 | native write starts in trusted dispatch with exact full report and original receiver |
| API 不可取得才 GM，固定格式及非成功提示 | navigator／clipboard／method／clipboard-getter／method-getter unavailable 五案 |
| 原生例外不重複寫入、GM 失敗提示 | native throw／reject 兩案、GM missing／throw 兩案 |
| 合成／舊節點無權寫入 | synthetic and detached old copy buttons cannot initiate a write |
| 單一 pending、跨 close/reopen 與完成後釋放 | pending native write remains single flight across repeat click and close/reopen |
| 晚到完成／拒絕不污染新視圖 | close／navigate／rebuild × resolve／reject 六案 |
| 同步重入撤銷舊寫入或 UI 更新 | clipboard lookup reentry、native write reentry 兩案 |

未改來源保存 **20 fail／17 pass**（BEFORE.log）；修復後 **37／37**（AFTER.log），全套 **808／808、19 套件**（TEST.log）；typecheck／architecture 及最終 verify 通過（退出 0，VERIFY.log），確定性建置／語法／v2-only／暫存封裝校驗完成。沒有預期失敗留在正式套件；發布核對另列下方。

## 安全差異

Codex Security `70b8d2c4-2c21-4465-a8c8-47eee5ba09d1` 已封存，三個修改檔案完整審查，0 候選／0 發現。安全政策由官方 helper 以正常使用者權限取得；sandbox 的路徑可見性錯誤沒有被當作通過。結果與 verify 分開；封存檔案逐字複製至私有 evidence/security，無修改。版本／文件／封裝不屬該不可變 runtime 差異。

## 內建瀏覽器來源證據

只使用 IAB 與指定風景影片、Auto；既有倍速保留，未加入播放驗收。原剪貼簿一個 text/plain 項目完整保存於記憶體，快照往返及真正貼上對照證明可安全復原。自有頁可信原生 writeText 的唯一 67 字元中文多行標記，讀回與 Ctrl+V 逐字相符；沒有重做 GM 實際校準。

指定影片自有記憶體 UI 的 **3,392 字元報告**，真正 Tab／Enter 啟動複製後提示「已複製報告」，API 及真正 Ctrl+V 全文相符。SHA-256 `111d3421d50d118a4e797af61d13a3b429032cb97fb1d5cf5f30796b5c32a610`；報告本身未寫檔。GM 呼叫 0、播放器呼叫 0、正式持久寫入 0、控制器未啟動。沒有替換安裝版 singleton，沒有重複 UI 宿主。清理移除宿主、按鈕／document listener 及自有 globals，釋放控制器和 CDP object group。

復原前核對完整項目仍由本輪持有，還原全部格式後 API 及真正貼上均與原內容相符；原內容只留記憶體。CALIBRATION.json、SOURCE_COPY.json、SOURCE_CLEANUP.json 保存比較 metadata。

## 發布與實際安裝

**修復與發布通過。** v2.1.22 於 `2026-10-12T13:57:43Z` [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.22)。發布時 main 與 peeled tag 為 `d1056ba1d67d571bf6f43b80c5accf3ab695cac8`；tag ref `33365b1a5e8ab706042301c984e613001710b8d5`。唯一附件 `BiliCDN_TW.user.js` 338,653 bytes、SHA-256 `7a4411c594385a65489a2b294df543ebe479d49ec8e8c37a797118a79f980508`；13:58:14Z 未帶憑證的公開 latest 核對一致。RELEASE_IDENTITY.json、PUBLIC_LATEST.json、REMOTE_IDENTITY.txt 保存證據。

既有忽略規則排除新 Release 目錄，首次提交未帶入封裝快照；核對後以 `5ae9d6b` 明確提交五個 v2.1.22 封裝檔至 main，沒有重寫已發布標籤、快照或附件。後續文件提交與發行提交分開。

最初安裝更新前提受阻：公開 latest 與版本專屬下載入口後，新文件仍執行完整 v2.1.21。沒有重跑舊版複製；INSTALLED_PRECONDITION.json 與 UPDATE_ENTRY.png 保留當時證據。使用者完成更新後重新取得文件及連線身分，該阻塞已解除。

**P05 實際安裝驗收通過。** Tampermonkey 5.5.1／v2.1.22 完整執行本體 335,100 字元，包含完整發行 IIFE 332,291 字元，SHA-256 `7de1d31f1f7298275eee71a3b9c68b5612e70f515efce4aa1edf3160df7113de`；RuntimeController／ControlCenter 各一個實例，Debugger 事件完整、沒有截斷。全程只使用指定影片，Auto／2 倍保留，未增加播放驗收。

播放器設定須先真正懸停齒輪，再開啟「更多播放設定」，才看得到 BiliCDN 按鈕。先前對隱藏按鈕的工具操作沒有開啟 UI，不算產品失敗或通過。直接 CDP 呼叫 show 的準備方式被自動審查拒絕，沒有執行或改用間接程式呼叫；改以可見按鈕的真實指標操作成功。影片結束遮罩曾以同片重播移除，屬操作準備，不計播放／BR-01 驗收。

在實際 UI 以真正 Tab／Enter 進入診斷及啟動「複製報告」，兩個原生 click 均可信。當次 **31,204 字元／31,212 UTF-8 bytes** 報告，API 讀回與真正 Ctrl+V **逐字一致**，沒有換行修正、trim 或重新序列化；SHA-256 `a2a456e87fa3d7886d5497274273b1099bcadf3d8a607180fae6231efc45e646`。只送出一次複製，506 ms 觀察到成功提示，pending 收束、報告未重建、焦點仍為複製按鈕。原生 API 與 singleton 沒有被替換。

復原前完整項目仍由本輪持有；全部原格式／文字復原後，API 及真正貼上均相符。原內容與貼上內容不寫檔；INSTALLED_COPY.json 只保存比較、長度、雜湊及有界事件。自有 root 觀察器／屬性移除，原生 Escape 關閉 UI，object group／Debugger 釋放，paste sink 清空，自有分頁剩餘 0、loopback 31996 listener 0；CLEANUP.json 保存最後核對。來源 UI 的資源先前已清理。

![v2.1.22 真實複製成功提示，未包含報告本文](evidence/P05_v2.1.22_COPY_2026-10-12.png)

## 重跑與限制

```powershell
node scripts/test.mjs --suite control-center
npm run typecheck
npm run architecture
npm test
npm run verify
git diff --check
```

私有重跑入口及證據存於 `.work/functional-fixes/p05-copy-native/2026-10-12-f534838/`。原生 Promise 完成只是產品提示；驗收仍比對當次完整內容。GM 正常返回不證明寫入，既有 IAB GM 未生效根因不在本次範圍。已提交剪貼簿寫入不可取消；不以 timeout 啟動第二個寫入，使用者的新內容不覆蓋。BR-01 保持跳過，P01／P02 無新前提不重測。
