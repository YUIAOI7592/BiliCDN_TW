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

指定影片自有記憶體 UI 的 **3,392 字元報告**，真正 Tab／Enter 啟动複製後提示「已複製報告」，API 及真正 Ctrl+V 全文相符。SHA-256 `111d3421d50d118a4e797af61d13a3b429032cb97fb1d5cf5f30796b5c32a610`；報告本身未寫檔。GM 呼叫 0、播放器呼叫 0、正式持久写入 0、控制器未啟動。沒有替換安裝版 singleton，沒有重複 UI 宿主。清理移除宿主、按鈕／document listener 及自有 globals，釋放控制器和 CDP object group。

復原前核對完整項目仍由本轮持有，還原全部格式後 API 及真正貼上均與原內容相符；原內容只留記憶體。CALIBRATION.json、SOURCE_COPY.json、SOURCE_CLEANUP.json 保存比較 metadata。

## 發布與實際安裝

尚未發布／載入 v2.1.22；本節會在公開產物與新版真實 UI 完整讀回／貼上後更新，不能用來源或 Node 算安裝通過。

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
