<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

# BiliCDN_TW v2.1.9 發行驗證 — 2026-10-09

本報告記錄以 `71f7ddd6f7cb5e538244419e801925e1a7d1ab10` 為基準的 17 項功能與競態修復，包含嚴格影音隔離。使用者在完成本機修復後授權推送 GitHub 以提供更新；本版已於 2026-10-09 發布，標籤對應提交 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7`。現行指南見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)，逐項來源、契約與剩餘限制見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/FUNCTIONAL_FIX_REPORT.md)。

## 修復與相容性

涵蓋 R01–R04、A01–A03、B1–B5 及 C-01–C-05。修復內容週期撤銷、播放器採樣與恢復、漸進式簽名刷新、政策版本、跨執行環境樣本 ID、鎖後量測資格、XHR 取消與重用、單節點設定合併及過期 UI 回呼。修改執行期前先建立失敗契約，調查證據與正式回歸分開保留。

schema 2、持久鍵、舊樣本讀取、完整 Catalog 候選池、Vault 唯一授權、Fetch 單讀取器及 Worker 不介入維持不變。不新增同世代 API 逆序回應、清除學習屏障或原生 GM 通知競合政策；沒有 Web Locks 的既有限制仍在，不宣稱恢復歷史遺失樣本。

## 自動發行驗證

2026-10-09 在版本 2.1.9 上重新執行下列命令，全部通過：

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm run architecture` | 43 個執行期模組，通過分層與所有權規則 |
| `npm test` | 19 個登記套件、299 個具名案例全部通過；無 only、skip、todo、cancelled |
| `npm run verify` | 通過型別、架構、測試、42 個非入口模組匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗 |

工具版本：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。發行記錄保存在本機 `.work/release-v2.1.9/`，不作 Release 附件。此次 299 案例與 v2.1.8 的歷史斷言數、後來工具遷移的 215 案例具有不同計數脈絡，不互相換算。

## 獨立安全差異審查

Codex Security 掃描 `7038b1e4-687a-4df3-b492-2cf73065727e` 已於 2026-10-09 完成封存。審閱全部 41 個變更來源檔，覆蓋狀態 `complete`，未完成審查項目 0，可回報發現 0。範圍包括 Vault 授權刷新、政策失效、舊工作提交及 XHR 狀態攔截；獨立於 npm verify。

受審快照摘要：`codex-security-snapshot/v1:sha256:041ddddd42903006c268b668cac1562a53f5c690108c095e31de695d9ee43b14`。發行前比較 45 個來源檔，44 個保持受審雜湊，唯一變更為 metadata 的版本 2.1.8→2.1.9；未再修改執行期邏輯。掃描結果不保證不存在漏洞，也不代表瀏覽器驗收通過。

## 封裝與更新

v2.1.9 使用者腳本為 **292,728 bytes**，SHA-256 **`051066c36a2e90aa19507671de75483667beb9757502b54f44522e4390b07f55`**。版本化封裝保存發行前報告、變更紀錄、建置資訊清單與校驗值；GitHub Release 只上傳 `BiliCDN_TW.user.js`。發布後的讀回狀態只更新現行文件，舊版及本版已發布快照不回寫。

`@updateURL` 與 `@downloadURL` 維持 [最新 Release 使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。版本化封裝內保存發布前的驗證快照，以下為發布後另行讀回的結果。

## 發布確認

2026-10-09 15:42:33（Asia/Taipei）正式發布 [v2.1.9](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.9)。GitHub latest API 確認為最新、非草稿、非預發行，只有一個附件 `BiliCDN_TW.user.js`。遠端標籤解析至 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7`，發布時 main 亦為此提交；後續只補入發布文件，不修改已發布產物。

15:43:07 從實際 latest 更新網址取得 HTTP 200，下載結果的 `@version` 為 2.1.9、大小 292,728 bytes，SHA-256 與本機已驗證產物及 GitHub 附件摘要三者一致。讀回紀錄保存在本機 `.work/release-v2.1.9/published-readback.json`。217 個歷史 Release 檔案未改動，v2.1.8 正文已搬移保留；本版封裝校驗及 `git diff --check` 通過。

## Chrome／Tampermonkey 狀態

**v2.1.9 新差異尚未執行真實瀏覽器驗收。** 待驗收範圍包括原生 XHR 事件與同步 setter、換片／seek／晚到 play、嚴格影音隔離及控制中心快速操作，步驟見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/FUNCTIONAL_FIX_REPORT.md#chrome-與-tampermonkey-待驗收步驟)。沒有變更瀏覽器設定；發布不表示使用者分頁已安裝新版。

v2.1.8 的合法 MP4 試片／公開 DASH 觀察、完整公開 MP4／FLV 覆蓋限制及其安全報告標記均保留於歷史正文。v2.1.6 驗收仍為已批准結案，不因本版修復重新開啟。

## 歷史驗證導覽

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
