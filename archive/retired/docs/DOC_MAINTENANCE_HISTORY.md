# 文件維護歷史

本文件於 2026-10-06 搬入 `docs/INDEX.md` 的三段 2026-10-03 紀錄。原始日期、盤點數量及驗證敘述保留；各段只描述當時的整理範圍。現行維護規則見 [文件索引](../../../docs/INDEX.md#維護對照)，配置見 [封存索引](../README.md)。後續整理依實際執行日期另增紀錄。

---

## 2026-10-03 文件維護紀錄

搬移前核對根目錄與 `docs/` 的 **23 份 Markdown 文件**，索引涵蓋全部文件；當時 **117 個本機連結及頁內錨點**檢查通過。已依程式修正儲存驗證／同步、signed route 索引與記憶體網址、瀏覽器 hook 還原、AST／匯入檢查、工具與封裝命令的描述，並補齊發布狀態與歷史文件標示。

文件差異檢查通過；本次變更限於文件，原始研究與驗收證據保留。這份維護紀錄不新增 runtime 測試、安全掃描或瀏覽器驗收結果。

## 2026-10-03 第一次封存整理紀錄

依程式與工具的實際引用，將歷史文件及已完成的本機舊工具／證據搬入 `archive/retired/`。搬移清單與校驗摘要見[封存索引](../README.md)。公開文件連結隨新位置更新，本機原始資料保持忽略，v2.1.6 驗收與已撤銷 CDN 計畫的狀態不變。

搬移後核對 **25 份公開 Markdown／128 個本機連結及錨點**，全部有效；`npm run verify` 完整通過，`Release/` 與現行來源校驗保持一致。此紀錄是位置整理的自動回歸，不新增安全掃描或 Chrome 驗收結果。

## 2026-10-03 根目錄文件集中整理

五份仍在使用的文件（PROJECT_CONTEXT、CHANGELOG、TEST_REPORT、TODO、UPSTREAM_MANIFEST）由根目錄集中至 `docs/`；來源 SHA-256 清單移至 `baseline/SHA256SUMS.txt`，內容不變。根目錄的 Markdown 因而由八份減為 README、AGENTS、SECURITY 三份。同步修正開發指引、封裝輸入與連結，移除封存索引中誤接的重複專案脈絡。

**25 份公開 Markdown／129 個本機連結及錨點**全部有效，baseline 校驗及 `npm run verify` 完整通過。原始碼、測試、正式 Release 與封存原始證據保持不變；封裝腳本只調整兩個文件讀取路徑。

## 2026-10-06 文件重整與繁體中文化

適用版本：**v2.1.8**。依工作樹實施文件重整，先前未提交的 ARCHITECTURE 狀態修正納入基準。現行入口見 [文件索引](../../../docs/INDEX.md)，2026-10-04 的版本／發布／瀏覽器證據仍集中於 [TEST_REPORT](../../../docs/TEST_REPORT.md)。

### 內容與位置

- 全文中文化 AGENTS、SECURITY、ARCHITECTURE、DEVELOPMENT、UPSTREAM_MANIFEST；中文化 v2.1.8 完整報告及 CHANGELOG 開頭／最新條目。README、PROJECT_CONTEXT、TODO、INDEX 與 THIRD_PARTY_NOTICES 核對用語及分工。
- 新增 `TEST_REPORT_HISTORY.md`，從 `Published BiliCDN_TW v2.1.7 test report` 標題至原檔結尾搬入十二個主要區塊。新增本文件，搬入 INDEX 的三段 2026-10-03 整理紀錄。搬移原文比對只允許 Markdown 相對連結的位置調整；順序、日期、數值、雜湊、命令、當時本機證據路徑與 pending 敘述均保留。
- CHANGELOG 的 v2.1.7 以下正文與搬移前完全相同。兩份封存索引更新為十三份歷史 Markdown，舊盤點數字仍保留於各自日期紀錄。
- 英文標題翻譯後以 `<a name="原錨點"></a>` 保留別名；最新版報告與 INDEX 保留搬出章節的主要錨點及導引。TEST_REPORT／CHANGELOG 指向其他儲存庫文件的連結使用完整 GitHub URL，固定封裝輸入路徑不變。
- 共修改十四份既有文件、新增兩份歷史文件。原始碼、測試、腳本、設定、版本號、授權原件、`.gitignore` 及正式 Release 未修改；未擴大私有資料追蹤範圍。

### 實際檢查

- 盤點 **27 份公開 Markdown**：根目錄 3、`docs/` 9、封存索引 2、歷史文件 13，不含 Release 快照及私有封存。**187 個本機／儲存庫文件連結與錨點**檢查通過；程式碼區塊範例不作連結處理。完整 GitHub `blob/main` 連結以本地檔案及錨點對照核實；此次未重新查核外部網站或遠端發布狀態，新文件須隨一般儲存庫提交後才能從遠端閱讀。
- 十二個歷史報告及三段整理紀錄的正文比對通過；翻譯指南的原標題別名、報告主要錨點及 INDEX 原錨點均存在。設定預設值、Catalog 11／4、每分頁一次的三候選／三秒起播、四種模式、store 同步差異、hook 證據及掃描／瀏覽器限制已交叉核對。
- **1,000 個受保護檔案**的位置與 SHA-256 與整理前基準一致，涵蓋追蹤中的來源／測試／腳本／設定、授權基準、Release 及納入基準的本機封存／證據。
- `npm run verify` 通過型別、42 個執行期模組的架構檢查、**891 項功能斷言**、**18 項架構斷言**、**41 個非入口模組**匯入純度、可重現建置、JavaScript 語法、v2-only bundle 及暫存封裝 checksum。一般沙盒首次執行因 esbuild 無法讀取上層目錄失敗；經審核權限重跑同一命令後完整通過，沒有修改工具或程式來繞過限制。
- 重建 userscript 為 **285,037 bytes**，SHA-256 `c2bda1e0be4b086e7622e34d3fba0a6cdfdd5eb612afea700289758112c9eb4f`，與 `Release/v2.1.8/BiliCDN_TW.user.js` 一致。未執行會覆寫正式 Release 的 `npm run package`。
- `git diff --check` 通過，差異僅有上述十六份文件；新增本紀錄後再次檢查文件連結、錨點、歷史正文及受保護檔案。

本次只新增實際執行的自動／文件檢查紀錄，未執行新的 Chrome／Tampermonkey 驗收或正式安全掃描。v2.1.8 安全報告的 `partial coverage`、MP4 試片範圍、完整公開 MP4／FLV 現場限制及較早 DASH 緩衝均沿用原紀錄；v2.1.6 驗收維持已批准結案，新增 CDN 計畫維持撤銷。

## 2026-10-07 測試工具遷移的文件更新

更新 AGENTS、ARCHITECTURE、DEVELOPMENT、INDEX、TODO、來源及工具授權指南，記錄 Node 內建測試命令、雙份型別設定、期限、清理責任及案例數語意。新增 [工具驗證紀錄](../../../docs/TEST_TOOLING_REPORT.md) 與 [原行為遷移對照](../../../tests-v2/MIGRATION.md)；詳細工具結果集中於前者。

本次盤點 **29 份公開 Markdown**，**206 個本機／儲存庫連結與錨點**通過檢查；外部 URL 未重新逐站查核。原文件整理、歷史正文、舊錨點及較早 changelog 保留。**983 份非本次修改範圍檔案**校驗通過，涵蓋正式來源、Release、授權基準及既有私有證據。`git diff --check` 通過。

`npm run typecheck`、`npm run architecture`、`npm test` 及 `npm run verify` 通過；完整執行為 **215 個具名案例**，與舊 891 項功能斷言分開計數。userscript SHA-256 與已發布 v2.1.8 一致。此次新增自動／工具證據，發行、安全與瀏覽器紀錄沿用其原有日期及覆蓋限制。
