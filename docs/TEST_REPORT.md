<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

# BiliCDN_TW v2.1.8 發行驗證 — 2026-10-04

本報告記錄已發布的 MP4／FLV 修復；v2.1.7 及更早證據見下方[歷史導覽](#歷史驗證導覽)。依使用者要求，v2.1.8 先發布再執行新的 Chrome 回歸，讓 Tampermonkey 使用既有更新 URL。於 2026-10-04（Asia/Taipei）發布 [v2.1.8](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.8)，標籤／提交為 `b6e2ff11ef53ce3a338cc197c90edecdf0bb2b60`。先前 `Release/v*/` 快照保持原樣。現行指南見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)。

<a name="reproduction-and-implementation"></a>

## 重現與實作

原目標頁面的 playurl 請求回傳 HTTP 200／上游 `code` 0，包含一個 MP4 `durl` 分段。舊適配器只辨識 DASH，因此拒絕結果；Fetch 攔截輸出本機 HTTP 503／`code` -1，未提供可播放資料。當時尚未啟動媒體 CDN 請求，不能據此宣稱全部 Catalog 主機失敗。修改執行期程式前，契約測試已重現解析器拒絕及 Fetch 503。

修復接納 MP4／FLV 分段與已辨識的混合 DASH 分支，保留分段順序及非 URL 中繼資料；必要分段全部規劃後才寫回 URL。資料格式錯誤、容量不足或無可用輸出時，嚴格漸進式回應整份拒絕。Vault 管理的來源不透明識別碼用於同段內建節點清單（Catalog）輸出；精確原生簽名路線（Native）授權仍有界且獨立。完整 Catalog 資格及排名保留，起播探測共用最多三個候選／三秒窗口。無明確結果時不提交測速贏家，送出依當前完整合法候選池判斷。固定主機、Catalog 及原生來源設定變更會失效計畫、取消腳本探測／恢復。最近 playurl 診斷只含有界格式／數量／狀態／`code`／原因欄位。

<a name="automated-verification"></a>

## 自動驗證

2026-10-04 的 `npm run typecheck`、`npm run architecture`、`npm test` 及 `npm run verify` 均通過。結果為 **891 項功能斷言**、**18 項架構斷言**、**42 個執行期模組**，以及 **41 個非入口模組**的匯入純度檢查。verify 通過確定性建置、JavaScript 語法、僅含 v2 的打包產物及暫存封裝／校驗值，未覆寫已發布 Release 產物。`git diff --check` 通過。一般沙盒阻止 esbuild 讀取上層目錄；使用經審核的執行權限後，相同 `npm test`／`verify` 命令通過。

四個新獨立套件涵蓋漸進式解析／生命週期／授權／容量（139 項斷言）、完整候選池選路及起播／固定設定競態（58）、MP4 Fetch／XHR 整合（15）、安全型別化 playurl 摘要（49）。既有 DASH、四種模式、設定、來源授權、影片／音訊、Fetch 讀取器／取消／正規化及 XHR 相容契約仍通過。另有狀態層斷言區分僅使用 Catalog 來源材料與 Native 授權。

<a name="separate-security-and-browser-evidence"></a>

## 分開記錄的安全與瀏覽器證據

最終 Codex Security 差異掃描 `447fbcd6-b672-4e0f-a572-e7805ef97e45` 已完成，並封存為不可變更的產物。權威變更程式清單的 **30 個項目**全部完成審閱，沒有合理候選或可報告問題。最終語意提交已結案所有來源面，但工具仍保留一筆已被取代的中途待審紀錄，因此正式覆蓋狀態仍為 **`partial`（部分覆蓋）**。該紀錄列出九個其後已審閱、以 `no_issue_found` 結案的 Vault／playurl／傳輸（`transport`）檔案；這是保留的檢查點限制，不代表來源未審閱。已封存且不可變更的產物保持原樣。不可變受審工作樹摘要雜湊為 `07ca765f6c2faae011f89cbf0e27dac032e98f3193a120a9e95570b2ef7efa8a`，基準為 `fa3946ec2807360c8a2b84291c213d624ef4142d`。此結果是靜態變更程式審閱，不是全儲存庫稽核或瀏覽器驗收。

封裝前，**43 個建置資訊清單輸入**均符合已驗證雜湊。v2.1.8 使用者腳本為 **285,037 bytes**，SHA-256 為 **`c2bda1e0be4b086e7622e34d3fba0a6cdfdd5eb612afea700289758112c9eb4f`**。後續修改只涉及發布證據及文件，應用層執行期程式不變。掃描目標工具記錄 723,436 tokens（模型詞元）及 1,174 秒（19 分 34 秒）；這是其目標計數，不是帳單。

發布後，使用者完成 Tampermonkey 標準更新。DevTools 確認安裝版本 **2.1.8**，包含漸進式解析器。下方真實瀏覽器觀察與自動、安全證據分開。FLV 目前只有自動覆蓋，沒有建立合法現場樣本。

已封存且不可變更的發現項目 SHA-256 為 `efdc076ba573da8e9437295c83f80cf46366c28cd83e0ae468e676440330fd8a`；覆蓋狀態 SHA-256 為 `8ebb2dd034a43582c872fe71d5581309e17fcea229e905e919fbfdd5af123542`。

<a name="publication-confirmation"></a>

## 發布確認

2026-10-04 的 GitHub 讀回確認 v2.1.8 為最新非草稿、非預發行版本，只有一個附件：`BiliCDN_TW.user.js`，285,037 bytes，GitHub 附件摘要雜湊與上方已驗證 SHA-256 一致。遠端 `main` 與 `refs/tags/v2.1.8` 當時都指向 `b6e2ff11ef53ce3a338cc197c90edecdf0bb2b60`。使用者在遠端 README 的修改已合併，未強制推送；最新 Release 更新 URL 提供此修復。版本化封裝保存發布前驗證快照，後續發布／瀏覽器狀態只記在現行文件。

發布後另外開啟新的 Chrome 目標分頁。最初 DevTools 確認**安裝版本仍為 2.1.7**，沒有漸進式解析器，頁面仍顯示 `code` -1；這不是 v2.1.8 測試結果。使用者完成正常 Tampermonkey 更新後，DevTools 才確認 v2.1.8。瀏覽器工具政策禁止控制擴充功能管理頁；使用者指定正常 Release 更新後，未嘗試本機檔案匯入或繞過政策。

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

## 標準更新後的 Chrome／Tampermonkey 觀察

於 2026-10-04（Asia/Taipei）在獨立 Chrome 分頁觀察，沿用網站既有倍速（初始化後為 2x）。未變更播放偏好或帳號權益。只記錄有界中繼資料、實際回應主機／狀態及影片時間／錯誤值；未持久化簽名媒體 URL、路徑、查詢字串、權杖或原始資料內容。截圖僅涵蓋影片標題與播放器，排除登入帳號資訊。

| 案例 | 播放觀察 | 實際網路面板（Network）觀察 |
| --- | --- | --- |
| 原始 [MP4 目標](https://www.bilibili.com/video/BV1Xwa96pE7g/) — 僅授權試片 | playurl HTTP 200／`code` 0，`format: mp4`，一個 `durl` 分段。13:48:26.878 至 13:48:43.315 UTC 的九個樣本：目前播放時間 0.799119 → 4.525805 → 8.623854 → 12.716896 → 16.827735 → 20.922018 → 25.011643 → 29.098042 → 試片結束 30.296938 秒。無媒體錯誤；`readyState`（就緒狀態） 4，持續播放至試片結束。連續進度觀察超過 12 秒實際經過時間。 | HTTPS `upos-sz-mirrorali.bilivideo.com`，直接 **206 媒體回應（`Media`）**，無磁碟快取或媒體轉址。此窗口事件擷取未截斷。 |
| 替代公開 [DASH 影片](https://www.bilibili.com/video/BV1YgT26qETR/) — 使用者回報原片改會員限定後選用 | 伺服器端渲染（SSR）播放資訊 `code` 0，18 個 DASH 影片媒體表示、3 個音訊媒體表示，沒有 `durl`。上游 `format: flv720` 標籤不表示此為漸進式 FLV 樣本。13:54:46.966 至 13:54:59.103 UTC 的七個穩定樣本：365.202979 → 369.262146 → 373.316104 → 377.346458 → 381.420513 → 385.440562 → 389.501470 秒。全部正在播放、`readyState`（就緒狀態） 4、無媒體錯誤。 | 影片及音訊請求與各自同串流媒體表示路徑的比對只在記憶體進行。實際目的地為 Catalog 主機 `upos-sz-mirrorali.bilivideo.com` 及 `upos-sz-mirroraliov.bilivideo.com`，直接 HTTPS **206**；未截斷的擷取中未觀察到媒體轉址。 |

較早 DASH 窗口在約 95.95 秒時短暫停留 `readyState`（就緒狀態） 2，之後恢復播放。部分網路事件回報 DNS 失敗及取消請求；本紀錄不宣稱每個 Catalog 主機成功或全程無緩衝。後續穩定窗口確認連續進度達 12.137 秒實際經過時間。

原上傳者已將 MP4 目標改為會員限定。成功觀察只涵蓋網站合法 30 秒試片，**不涵蓋完整會員內容**。依使用者指示，後續正常播放回歸採替代公開 DASH 影片。完整公開漸進式 MP4 及合法現場 FLV 樣本尚未建立；這些是覆蓋限制，不是新的實作待辦，也不代表全部格式均經瀏覽器驗收。本機裁切截圖保存在 `.work/v2.1.8-mp4-chrome-2026-10-04.png` 及 `.work/v2.1.8-dash-chrome-2026-10-04.png`，屬私有證據，不是 Release 附件。未匯出 HAR 或簽名回應資料內容。

上述觀察後，九份現行文件同步發布／更新／瀏覽器狀態。當時這些文件的 **103 個本機連結及錨點**與 `git diff --check` 均通過。該次文件檢查未重跑執行期測試、未變更應用層程式，也未改動封裝 Release 快照。

**v2.1.6 驗收維持已批准、已結案。** v2.1.8 發布已完成，自動／安全與新瀏覽器證據各自記錄。

## 歷史驗證導覽

下列十二個區塊於 2026-10-06 移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，正文保留原文與當時限制。原主要標題錨點保留為導引；歷史「待完成」不構成目前工作，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。文件搬移與本次檢查另見 [文件維護歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

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
