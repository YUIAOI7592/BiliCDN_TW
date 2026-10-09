<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.11 發行驗證 — 2026-10-10

以 `c836a17818cd4ae86195e41b1e1c0933cff8cab0` 為基準，納入 BR-03 內容識別修復。使用者已授權直接提交、升版、推送與發布，並要求將此預設交付規則保存於 [AGENTS](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/AGENTS.md#release-rules)。本報告是 **v2.1.11 現行發布報告**；已於 2026-10-10 01:52（Asia/Taipei）正式發布，01:53 公開 latest 下載讀回一致。修復前後對照見 [BR-03 報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)，目前待驗收範圍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 修復與相容性

可信 playurl 的所屬請求 cid 優先識別內容；同 cid 的排列、畫質或編碼清單完全換組均保留 epoch，不同 cid 即使共用路徑也重設。缺少 cid 時以有界完整父目錄集合備援，影片 128／音訊 64，忽略主機、查詢與順序，重疊保留歷史。低信任提示不能更新基準，Fetch／XHR metadata 保持請求 context 所有權，真正換片仍同步撤銷舊工作。

沒有有效 cid 也沒有共同路徑時採保守重設。不新增 API 逆序回應政策、公開橋接、持久鍵或 schema；schema 2、Vault 唯一授權、MP4／FLV 簽名刷新、嚴格影音隔離、Fetch 單讀取器及 Worker 不介入保持原契約。

## 自動發行驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。在 2.1.11 版本設定重新執行必要命令；執行結果與封裝校驗存入本機 `.work/release-v2.1.11/`。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 來源／測試通過 |
| `npm run architecture` | 44 個執行期模組、無循環 |
| `npm test` | 19 套件、382 個具名案例通過；新增 43 個 BR-03，沒有 only／skip／todo／cancelled |
| `npm run verify` | 型別、架構、382 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗通過 |

修復前的原四契約 2 通過／2 失敗與擴充紅燈紀錄保留在修復證據目錄，不混算通過；正式測試不匯入調查目錄。文件連結／錨點、受審雜湊、歷史產物與 `git diff --check` 另行核對。

## 獨立安全差異審查

BR-03 Codex Security 掃描 `a9c3fb49-d46b-4a8e-81ee-29856ab3e908` 已於 2026-10-10 01:09:35（Asia/Taipei）封存。完整覆蓋 14 個變更來源／測試檔，0 個可報告發現、0 個待驗證候選。快照 digest：`codex-security-snapshot/v1:sha256:31543372cedbba943e0f4de533b3d34d68790794e4c471de11ee123284685033`。

此次發行只變更版本設定、metadata 版本與交付文件；受審 14 檔保持 SHA-256 一致，其他執行期邏輯未再修改，因此沿用該已完成差異審查，沒有宣稱重新掃描。安全封存產物不回寫；這不是全儲存庫安全保證。

## 封裝與更新

正式產物為 `Release/v2.1.11/BiliCDN_TW.user.js`，**296,341 bytes**，SHA-256 為 `9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`。GitHub Release 僅上傳此腳本；CHANGELOG、TEST_REPORT、BUILD_MANIFEST、SHA256SUMS 留在儲存庫。更新 URL 維持 [最新使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，發布後核對版本、大小與 SHA-256。舊 Release 與原始調查文件保持雜湊一致。

## 發布確認

2026-10-10 01:52（Asia/Taipei）完成 [v2.1.11 正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.11)。修復提交 `d3d1bc3185d51b62891920135b4126441e059696` 與 annotated tag 已推送，標籤指向該提交；唯一附件為 BiliCDN_TW.user.js。01:53 無登入的公開 latest API 與下載 URL 讀回確認版本 2.1.11、296,341 bytes 及上述 SHA-256 一致，現有 Tampermonkey 更新網址已提供新版；不宣稱使用者裝置已自動安裝。

發布前檢查 18 份 Markdown、319 個本機／儲存庫連結與 91 個錨點，0 錯誤；82 個來源／測試檔與 14 個受審檔雜湊一致，262 個歷史 Release 檔及兩份原始調查文件不變。上一版完整報告已保存。封裝的報告與 CHANGELOG 是發布前準備快照；此後只更新現行文件，Release 快照不回寫。

## Chrome／Tampermonkey

2026-10-10 修復輪的真正 Chrome 154 **來源隔離** BR-03 31／31、BR-02 對照 31／31 通過。成功輪合成請求於送出前攔截，事件未截斷、hooks restored；作廢輪與清理限制見 [BR-03 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)。本次發行不新增瀏覽器執行證據。

**v2.1.11 Tampermonkey 安裝版仍待更新後驗收。** 舊 v2.1.10 的同片暫停／續播、4K↔1080P、獨立 seek 正常對照不替代修復版矩陣。網站僅使用指定 [風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)；畫質與 seek 分步操作。BR-01 原 87.8 秒停滯、真正 startup gate 交錯及 R04 完整驗收保持待定位／驗收，不能因 BR-03 修復結案。

## 歷史驗證導覽

<a name="br03-local-fix-verification--2026-10-10"></a>

- [BR-03 發行前本機完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#br03-local-fix-verification--2026-10-10)

<a name="bilicdn_tw-v2110-release-verification--2026-10-09"></a>

- [v2.1.10 完整發布／修復前驗收正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2110-release-verification--2026-10-09)

上一版完整正文已按日期移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，保留原始限制與錨點導引。現行行為見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)，歷史待完成不自動成為目前待辦。

<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

- [v2.1.9 完整歷史驗證與當時瀏覽器狀態](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v219-release-verification--2026-10-09)

v2.1.8 的完整正文於 2026-10-09 移入歷史報告，保留原始數值、日期、發布及瀏覽器限制。舊錨點導引如下：

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 發行驗證 — 2026-10-04](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)

<a name="reproduction-and-implementation"></a>

- [v2.1.8 重現與實作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#reproduction-and-implementation)

<a name="automated-verification"></a>

- [v2.1.8 自動驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#automated-verification)

<a name="separate-security-and-browser-evidence"></a>

- [v2.1.8 安全與瀏覽器證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#separate-security-and-browser-evidence)

<a name="publication-confirmation"></a>

- [v2.1.8 發布確認](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#publication-confirmation)

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

- [v2.1.8 Chrome／Tampermonkey 觀察](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#chrome--tampermonkey-observations-after-standard-update)

更早十二個區塊於 2026-10-06 移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，正文保留原文與當時限制。原主要標題錨點保留為導引；歷史「待完成」不構成目前工作，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。文件搬移與本次檢查另見 [文件維護歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

<a name="published-bilicdn_tw-v217-test-report"></a>

- [v2.1.7 已發布驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#published-bilicdn_tw-v217-test-report)

<a name="historical-modularization-verification--before-release"></a>

- [發行前模組化驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-modularization-verification--before-release)

<a name="historical-v216-test-report"></a>

- [v2.1.6 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v216-test-report)

<a name="historical-v215-test-report"></a>

- [v2.1.5 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v215-test-report)

<a name="historical-v214-test-report"></a>

- [v2.1.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v214-test-report)

<a name="historical-v213-test-report"></a>

- [v2.1.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v213-test-report)

<a name="historical-v212-test-report"></a>

- [v2.1.2 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v212-test-report)

<a name="historical-v211-test-report"></a>

- [v2.1.1 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v211-test-report)

<a name="historical-v210-test-report"></a>

- [v2.1.0 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v210-test-report)

<a name="historical-v204-test-report"></a>

- [v2.0.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v204-test-report)

<a name="historical-v203-test-report"></a>

- [v2.0.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v203-test-report)

<a name="historical-v202-verification-unchanged-scope"></a>

- [v2.0.2 歷史驗證（當時範圍不變）](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v202-verification-unchanged-scope)
