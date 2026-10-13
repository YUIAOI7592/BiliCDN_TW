<a name="bilicdn_tw-v2122-release-verification--2026-10-12"></a>

# BiliCDN_TW v2.1.22 P05 驗證報告

日期：2026-10-12（台北時間）。基準 v2.1.21／`f534838`，開始時乾淨。只修診斷複製；公開 API、應用層介面、GM 權限及 schema 2 不變。BR-01 跳過，已通過 UI 項目不重測。

| 層級 | 結果 |
| --- | --- |
| 未修來源契約 | 20 fail／17 pass，保留原結果 |
| 修復後 control-center | 37／37；新增 20 案 |
| 全套正式測試 | 19 套件、808／808，無 only／skip／todo／cancelled |
| typecheck／architecture | 通過 |
| 最終 verify | 通過，退出 0；確定性建置、語法、v2-only 與暫存封裝校驗通過 |
| 獨立 Codex Security 差異 | 3／3 檔案、0 候選／0 發現，已封存 |
| IAB 原生通道 | 可信 writeText、API 讀回、真正 Ctrl+V 與完整原內容復原通過 |
| 指定影片修復來源 | 3,392 字元全文讀回／貼上相符，GM／播放器呼叫及正式持久寫入 0；自有 UI 清理通過 |
| 公開更新產物 | v2.1.22 已發布；唯一附件及未帶憑證的 latest 版本／大小／SHA-256 一致 |
| 實際新版 P05 | 通過；31,204 字元報告完整讀回與真正 Ctrl+V 一致，原剪貼簿與資源復原通過 |

工具：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。修復以原生優先、GM 不可用備援與單一 pending 寫入處理；不宣稱定位或修復 Tampermonkey GM 通道。

安全掃描 `70b8d2c4-2c21-4465-a8c8-47eee5ba09d1` 於 `2026-10-12T13:48:17.943313Z` 封存。審查可信入口、完整報告、原生 receiver、例外、同步重入、過期視圖及重複寫入。不可變範圍為 UI／型別／正式測試三檔；後續版本與文件交付不冒充掃描範圍。工具回報 usage 2,339,563 tokens（來源 codex_rollout、2 threads，包含同任務累計 context，非修復的增量成本）。

證據在 `.work/functional-fixes/p05-copy-native/2026-10-12-f534838/`；全文對照、重跑入口、發布與實際安裝見 [P05 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_FIX_REPORT.md)。原剪貼簿與貼上內容只留記憶體，檔案只保存長度／雜湊／比較與清理狀態。

## 發布核對

v2.1.22 於 `2026-10-12T13:57:43Z` [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.22)。發布時 main／peeled tag 均為 `d1056ba1d67d571bf6f43b80c5accf3ab695cac8`，tag ref `33365b1a5e8ab706042301c984e613001710b8d5`。唯一附件 338,653 bytes，SHA-256 `7a4411c594385a65489a2b294df543ebe479d49ec8e8c37a797118a79f980508`；`2026-10-12T13:58:14Z` 公開 latest 核對一致。既有忽略規則排除新 Release 目錄，封裝快照於後續 `5ae9d6b` 提交 main；標籤及附件未改寫。

## 實際安裝

初始公開更新入口沒有載入新版，舊本體觀察保留在 INSTALLED_PRECONDITION.json；使用者更新後該阻塞解除。Tampermonkey 5.5.1／v2.1.22 完整本體 335,100 字元，完整 IIFE 332,291 字元、SHA-256 `7de1d31f1f7298275eee71a3b9c68b5612e70f515efce4aa1edf3160df7113de` 與發行同段一致，唯一 RuntimeController／ControlCenter 各 1，事件無截斷。

實際可見入口的指標操作開啟 UI，再以真正 Tab／Enter 啟動診斷及複製。**31,204 字元**當次報告，API 讀回與真正 Ctrl+V 逐字相符，SHA-256 `a2a456e87fa3d7886d5497274273b1099bcadf3d8a607180fae6231efc45e646`。只提交一次，pending 已收束，報告不變、焦點保持。全部原剪貼簿項目／格式／文字與真正貼上復原相符；沒有保存原內容或報告本文。

原生 Escape 關閉 UI，自有觀察器／屬性、Debugger 及 object group 清理，paste sink 清空，自有分頁 0、loopback 31996 listener 0。INSTALLED_COPY.json、CLEANUP.json 與無報告本文的成功提示截圖保存證據。BR-01 仍跳過，其他已通過案例不重測；GM 根因不因原生成功而宣稱修復。

## 2026-10-13 文件結案補記

依使用者批准完成 [TODO 證據核對與結案](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO_CLOSURE_2026-10-13.md)。只讀既有紀錄、核對來源差異並更新文件，沒有新增自動測試、安全掃描或瀏覽器驗收。

- P01 第 2～4 輪的 24＋10＋2 個案例沿用；真 installed pending gate 的 bounded prepare 與 P02 等待者交錯前提未成立，限制封存，不判通過或產品失敗。
- P03 同片自然 API 安裝子項沿用；本版原 808／808 紀錄中的 43 個具名 BR-03 案例核對成功。IAB 第 4 輪格式／hook 17 案沿用，舊 Chrome 154 來源隔離 31／31 保留原版本／環境，不轉算 IAB；完整內容週期交錯的 IAB 來源證據缺口明列限制，不增加安裝門檻。
- P04、P05、BR-10 已完成且不重測；BR-01 與原自然停滯原因保持跳過。沒有已批准的自主接續測試項目。

本次文件結案不表示完整產品矩陣全部通過。版本維持 v2.1.22，只有文件提交與 main 推送；既有發行標籤、附件及 Release 快照保持原狀。

<a name="bilicdn_tw-v2121-release-verification--2026-10-11"></a>

## 歷史導覽

- [v2.1.21 完整原報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2121-release-verification--2026-10-11)
- [原 P05 失敗與 GM 校準](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_IAB_RESULT_2026-10-12.md)
- [更早完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
