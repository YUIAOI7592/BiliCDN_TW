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
| 公開更新產物 | 尚未發布，發布後記錄 |
| 實際新版 P05 | 尚未載入新版，不以来源或 Node 代替 |

工具：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。修復以原生優先、GM 不可用備援與單一 pending 寫入處理；不宣稱定位或修復 Tampermonkey GM 通道。

安全掃描 `70b8d2c4-2c21-4465-a8c8-47eee5ba09d1` 於 `2026-10-12T13:48:17.943313Z` 封存。審查可信入口、完整報告、原生 receiver、例外、同步重入、過期視圖及重複寫入。不可變範圍為 UI／型別／正式測試三檔；後續版本與文件交付不冒充掃描範圍。工具回報 usage 2,339,563 tokens（來源 codex_rollout、2 threads，包含同任務累計 context，非修復的增量成本）。

證據在 `.work/functional-fixes/p05-copy-native/2026-10-12-f534838/`；全文對照、重跑入口、發布與實際安裝見 [P05 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_FIX_REPORT.md)。原剪貼簿與貼上內容只留記憶體，檔案只保存長度／雜湊／比較與清理狀態。

<a name="bilicdn_tw-v2121-release-verification--2026-10-11"></a>

## 歷史導覽

- [v2.1.21 完整原報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2121-release-verification--2026-10-11)
- [原 P05 失敗與 GM 校準](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_IAB_RESULT_2026-10-12.md)
- [更早完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
