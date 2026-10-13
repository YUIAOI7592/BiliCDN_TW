<a name="bilicdn_tw-v2123-release-verification--2026-10-13"></a>

# BiliCDN_TW v2.1.23 修復驗證報告

日期：2026-10-13。基準 v2.1.22／c4e7de4，保留五份原調查文件。修復 CR-01～05 與原生確認的 S-01／S-03，共七項；S-02 未確認且沒有修改。公開 API、GM 權限、設定、schema 2 及執行期依賴不變。

| 層級 | 結果 |
| --- | --- |
| 未修 CR 正式契約 | 12 案、6 fail／6 pass；原紀錄保留 |
| 修復後全部正式測試 | 19 套件、841／841；新增 33 案；0 fail／skip／todo／cancelled |
| 型別／架構 | 通過；44 個 runtime 模組 |
| Codex Security 差異 | 23／23 檔、0 候選／0 發現；獨立封存 |
| IAB XHR 原生來源 | 11 組／22 筆觀察相符，包含七種跨 realm body；自有資源已清理 |
| 最終 verify | 通過，退出 0；841 契約、確定性建置、語法、v2-only 與暫存封裝／校驗通過 |
| 封裝／公開產物 | 正式發布；遠端 main／標籤、唯一附件、公開 latest 版本／大小／SHA-256 全部一致 |
| v2.1.23 實際安裝身分 | 使用者更新後，完整 IIFE 與附件逐字相同；唯一 RuntimeController／ControlCenter 及新版 Fetch／XHR hooks 核對通過 |

工具：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。分批 progressive-routing 29、orchestration 38、measurement-state 40、diagnostics 16、native-transport 147 均通過。正式契約及正常對照見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CR01_CR05_FIX_REPORT.md)。

安全掃描 54077ae0-1f99-479d-bbea-e66e08f57e31 於 2026-10-13T15:07:25.758289Z 完成，固定差異摘要 85faf012e78350492acb676cadf2e7faacb7b124f0eec3468f6563e4c5bf5252。工具回報 8,709,858 tokens（codex_rollout、3 threads，含累計 context，非修復增量成本）。後續版本／文件／封裝不冒充安全審查範圍。

S-02 原生定位因工具單次呼叫耗時 389.4255 秒而達整體時限；只有送出前攔截控制，沒有相對 URL／base 結論。raw SharedArrayBuffer 亦未列本輪原生 body 通過。BR-01 保持跳過；P01／P02 安裝窗口限制封存；其他已通過瀏覽器案例未重測。這些限制不改記通過。

私有證據：.work/functional-fixes/cr01-cr05/2026-10-13-c4e7de4/。安全 canonical 與一般 verify 分開保存。

## 發布與安裝核對

v2.1.23 於 2026-10-13T15:14:37Z [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.23)。當時 main／peeled tag 同為 f219caa93b93c7f468e71cf2efdabe8bb8e33673；唯一附件 343,834 bytes，SHA-256 ae68637fd73599d6561ca396249246c64f070491030a5e106260d597ceb41f2a。公開 latest 未带憑證下載逐字一致。封裝快照已隨發布提交保存，後續文件不回寫 Release。

首次公開更新入口沒有確認按鈕，指定影片仍執行完整 v2.1.22；沒有用舊版驗收新版。使用者更新後，實際完整本體 340,281 字元，內含與 v2.1.23 附件逐字相同的 337,472 字元 IIFE，該段 SHA-256 9e97abd7dbab28eb633b46f1774a7b381c562d41109a8dcd994600145f05589f。RuntimeController／ControlCenter 各 1；Fetch／XHR hooks 為新版。事件無截斷，object group、Debugger 與自有分頁均清理。

這是安裝身分通過，不是整份安裝功能矩陣通過。因果回歸仍分列 Node／IAB 來源，不重測已通過案例、不重開 BR-01／P01／P02。原始前提與更新後證據見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CR01_CR05_FIX_REPORT.md#發布與安裝)。

<a name="bilicdn_tw-v2122-release-verification--2026-10-12"></a>

## 歷史報告

<a name="歷史驗證導覽"></a>

上一版 v2.1.22 全文（含 2026-10-13 結案與原調查補記）已原樣封存至 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2122-release-verification--2026-10-12)。其他版本由 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md) 追溯；原 Release 快照及失敗紀錄不回寫。
