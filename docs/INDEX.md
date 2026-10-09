# 專案文件索引與維護規則

本索引於 **2026-10-06** 完成文件重整，**2026-10-10** 更新至 **v2.1.11 BR-03 已發布**；01:52 正式發布、01:53 公開更新讀回確認一致（Asia/Taipei），設定版本為 v2.1.11。現行驗證與歷史發布狀態見 [驗證報告](TEST_REPORT.md)，目前工作見 [工作狀態](TODO.md)。[BR-03 修復報告](BR03_FIX_REPORT.md) 分列 382 個正式案例、獨立安全審查、Chrome 來源隔離與修復版待安裝驗收；既有瀏覽器實測及 BR-01 異常保留於 [v2.1.10 紀錄](CHROME_v2.1.10_ACCEPTANCE.md)。歷史「待驗收」「未發布」或研究建議只描述當時狀態，不自動成為目前待辦。

2026-10-07 的 Markdown 粗體渲染盤點與排版修正見 [文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-07-markdown-粗體渲染修正)；後續排版檢查方式列於 DEVELOPMENT。

產品行為以 [src-v2/entry.ts](../src-v2/entry.ts) 及其模組為準；版本與工具以 [release.json](../release.json)、[package.json](../package.json) 及 [package-lock.json](../package-lock.json) 為準。指南與程式不一致時，先確認實際行為再修正文檔，歷史觀察保留原始版本與日期。

閱讀入口：

2026-10-09 的 [功能與競態修復對照](FUNCTIONAL_FIX_REPORT.md) 記錄 v2.1.9 的 17 項修復、正式回歸及新的瀏覽器待驗收範圍；舊版已發布驗收維持原紀錄。

- 一般使用者：README → 安裝／模式／操作／排查。
- 開發者：PROJECT_CONTEXT → SECURITY → ARCHITECTURE → DEVELOPMENT，並遵守 AGENTS。
- 維護者：TODO → 最新 TEST_REPORT → CHANGELOG；追溯舊證據時進入歷史報告與封存索引。

## 現行指南

| 文件 | 主要責任 |
| --- | --- |
| [README](../README.md) | 安裝、功能、四種模式、控制中心、排查及隱私 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 產品契約、不變量及已確定交付邊界 |
| [AGENTS](../AGENTS.md) | 必要開發流程、架構、安全及發行／文件要求 |
| [ARCHITECTURE](ARCHITECTURE.md) | 依賴、狀態、控制器、適配器、生命週期與診斷 |
| [DEVELOPMENT](DEVELOPMENT.md) | 環境、命令、測試隔離、建置、瀏覽器檢查及封裝 |
| [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md) | 測試遷移、套件登記、BR-02 替身校準及 2026-10-10 BR-03 交錯契約驗證 |
| [測試遷移對照](../tests-v2/MIGRATION.md) | 原 891 項功能斷言的行為群組、分支及參數矩陣對照 |
| [SECURITY](../SECURITY.md) | 信任邊界、持久資料、網路權限及診斷限制 |
| [TODO](TODO.md) | 目前已批准工作、結案事項及未安排方向 |
| [FUNCTIONAL_FIX_REPORT](FUNCTIONAL_FIX_REPORT.md) | v2.1.9 的 17 項修復、正式契約及瀏覽器驗收步驟 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游基準、v1／v2 關係及來源校驗 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權、工具用途及版本 |

本索引管理文件用途、入口及維護對照。這些指南隨程式或發布狀態更新，不能以舊版規格取代目前實作。現行說明、變更紀錄及最新版報告使用繁體中文；封存的歷史正文保留原文。

2026-10-07 中文化範圍為 **14 份 Markdown**：根目錄 README、AGENTS、SECURITY，`docs/` 的十份文件，以及 `tests-v2/MIGRATION.md`；2026-10-09 新增修復對照報告沿用相同政策。CHANGELOG 的全部版本條目使用繁體中文，仍保留各版當時的驗證狀態；測試遷移對照以中文說明行為，英文欄逐字保留原案例群組。封存正文、82 份 Release Markdown 快照、本機工作資料及第三方／產生的文件不翻譯。繁體中文標題若取代既有標題，必須保留原錨點別名；既有別名及跨文件引用繼續有效。

共用用語為「儲存元件（store）」「測試情境（fixture）」「建立函式（factory）」「中繼資料（metadata）」「原始碼對照（source map）」「報告產生器（reporter）」「堆疊資訊（stack）」。瀏覽器 hook 稱為「攔截」，測試 hook 稱為「測試掛鉤」或「清理掛鉤」。產品名稱、授權名稱、程式識別字、命令、網址、路徑及原始狀態值可以保留英文，必要時補上中文解釋。翻譯必須維持規則強度、條件、數值與證據界線；日期固定的封存正文保持原樣，維護結果另追加有日期的紀錄。

2026-10-07 中文化的實際檢查見 [文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-07-現行-markdown-文件繁體中文化)。

## 檔案配置

根目錄保留 README、AGENTS、SECURITY、LICENSE 及必要建置設定；其餘現行文件集中於 `docs/`。封裝固定讀取 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md`，來源原件及校驗清單位於 `baseline/`。

歷史報告、整理紀錄、計畫、研究、驗收及截圖集中於 [archive/retired](../archive/retired/README.md)。[封存總覽](../archive/README.md) 說明公開文件與忽略的本機資料分區。2026-10-07 盤點為 **29 份公開 Markdown**：根目錄 3 份、`docs/` 10 份、封存索引 2 份、歷史文件 13 份及測試遷移對照 1 份；不計入 Release 快照或私有本機封存。2026-10-06 的 27 份盤點及更早數字保留於 [有日期的維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

## 發行與驗證紀錄

| 文件／產物 | 閱讀方式 |
| --- | --- |
| [CHANGELOG](CHANGELOG.md) | v2.0.0～v2.1.10 全部條目使用繁體中文；功能差異、順序及當時驗證狀態保留 |
| [TEST_REPORT](TEST_REPORT.md) | BR-03 本機修復／382 案例／安全／Chrome 隔離結果；保留 v2.1.10 發布與原驗收正文及歷史導覽 |
| [CHROME_v2.1.9_ACCEPTANCE](CHROME_v2.1.9_ACCEPTANCE.md) | 2026-10-09 部分真實瀏覽器驗收、18 個原生 XHR 案例及待定位停滯 |
| [CHROME_v2.1.9_BR02_XHR_FAILED_OPEN](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md) | 持續驗收確認的 XHR 例外安全性缺陷、六個 Chrome 失敗情境、根因與原始重現入口 |
| [BR02_FIX_REPORT](BR02_FIX_REPORT.md) | v2.1.10 修復、40 個新增正式契約、來源隔離驗證、安全審查及後續安裝版證據／gate 限制 |
| [CHROME_v2.1.10_ACCEPTANCE](CHROME_v2.1.10_ACCEPTANCE.md) | 68 個安裝版 XHR 案例執行通過、同片操作、87.8 秒 seek 追加觀察及未完成範圍 |
| [CHROME_v2.1.10_BR03_CONTENT_EPOCH](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) | 相同 DASH 清單排列誤觸 epoch、音訊授權失效、來源／安裝版重現與修正方向 |
| [BR03_FIX_REPORT](BR03_FIX_REPORT.md) | BR-03 本機修復、43 個新增正式契約、修復前後結果、安全差異審查、Chrome 來源隔離及安裝版待驗收 |
| [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md) | v2.0.2～v2.1.9 的歷史完整報告，包括發行前模組化驗證 |
| [DOC_MAINTENANCE_HISTORY](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) | 2026-10-03 三段原整理紀錄及後續有日期的文件檢查 |
| [v2.1.10 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.10) | 2026-10-09 已發布；唯一附件及公開 latest 版本、大小、SHA-256 均核對一致 |
| [Release/v2.1.10](../Release/v2.1.10/) | 本次封裝快照；發布後不回寫 |
| [v2.1.9 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.9) | 2026-10-09 已發布並核對 latest 下載；附件只有 `BiliCDN_TW.user.js` |
| [Release/v2.1.9](../Release/v2.1.9/) | 當次使用者腳本、報告、變更紀錄、資訊清單、校驗值快照；發布後不回寫 |

自動驗證、安全掃描與真實瀏覽器驗收分開記錄。v2.1.8 的安全 `partial coverage`、MP4 試片／公開 DASH 觀察、較早 DASH 緩衝及完整公開 MP4／FLV 限制均保存於歷史報告；v2.1.9 發行前靜態差異審查為完整覆蓋，後續 BR-02 修復另有獨立報告，不沿用歷史安全結果。BR-01 停滯與其餘未覆蓋情境仍保留。**v2.1.6 Chrome／Tampermonkey 驗收已批准通過、已結案**，歷史覆蓋限制不構成待辦。

## 歷史計畫與瀏覽器紀錄

| 文件 | 保留範圍／狀態 |
| --- | --- |
| [SECURITY_REVIEW_v1.6.0](../archive/retired/docs/SECURITY_REVIEW_v1.6.0.md) | v1.6.0 候選版安全紀錄，不是現行政策或掃描 |
| [PLAN_v2.0.2](../archive/retired/docs/PLAN_v2.0.2.md) | 當時實作計畫；例外不作現行開發／發行規則 |
| [POST_RELEASE_v2.0.2](../archive/retired/docs/POST_RELEASE_v2.0.2.md) | 當時事故、修復及工作狀態 |
| [CHROME_v2.0.3_ACCEPTANCE](../archive/retired/docs/CHROME_v2.0.3_ACCEPTANCE.md) | 該版針對性瀏覽器回歸證據 |
| [CHROME_v2.1.2_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.2_ACCEPTANCE.md) | 該版觀察與覆蓋限制 |
| [CHROME_v2.1.6_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md) | 已批准通過且結案的驗收，保留觀察與限制 |

## 已撤銷的 CDN 新增研究

**新增節點計畫已撤銷。** 下列五份文件保留 2026-09-25 起的調查、實驗及停止新增節點決定。候選排序、建議及當時測試計畫不授權修改 Catalog，也不列入目前待辦。

| 文件 | 用途 |
| --- | --- |
| [CDN_OPEN_SOURCE_SURVEY](../archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md) | 外部專案及候選來源研究快照 |
| [CDN_NODE_FULL_SCREENING](../archive/retired/docs/CDN_NODE_FULL_SCREENING_2026-09-25.md) | Node 初篩，非正式瀏覽器驗收 |
| [CDN_CANDIDATE_TEST_PLAN](../archive/retired/docs/CDN_CANDIDATE_TEST_PLAN_2026-09-25.md) | 已撤銷測試草案 |
| [CDN_RANGE_PLAYBACK_EXPERIMENT](../archive/retired/docs/CDN_RANGE_PLAYBACK_EXPERIMENT_2026-09-25.md) | 當時 Range／播放實驗及限制 |
| [CDN_TEST_RESULTS](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md) | 跨環境結果及停止新增節點決定 |

## 不回寫的歷史資料

`Release/v*/`、`baseline/`、封存 v1 程式及安全產物保存當時證據，不作現行 v2 建置／測試輸入。文件維護不修改已封裝報告、校驗值、舊測試結果或已封存且不可變更的安全掃描。後續狀態更新最新版 TEST_REPORT，或新增有日期／版本的紀錄。

## 維護對照

| 變更來源 | 應檢查文件 |
| --- | --- |
| `domain/`、`state/settings-store.ts`、控制中心文字與命令 | README、PROJECT_CONTEXT；預設值、模式、操作名稱及例外 |
| 儲存解析器／鎖／監聽器、Vault、Fetch／XHR、瀏覽器攔截 | SECURITY、ARCHITECTURE；要求、實際保障與平台限制 |
| 控制器、介面、依賴規則及測試支援 | ARCHITECTURE、AGENTS、DEVELOPMENT；權責、生命週期及檢查範圍 |
| `scripts/`、工具設定、package 及依賴鎖定檔 | DEVELOPMENT、UPSTREAM_MANIFEST、THIRD_PARTY_NOTICES；命令、用途及輸出 |
| 實際測試、安全掃描、瀏覽器驗收 | TEST_REPORT 及對應日期／版本紀錄；只記錄已取得證據 |
| 測試執行器、測試資源範圍、FakeClock、型別設定 | TEST_TOOLING_REPORT、測試遷移對照；與產品發行及瀏覽器紀錄分開 |
| 封裝及 GitHub 發布 | README、CHANGELOG、TEST_REPORT、PROJECT_CONTEXT、本索引；版本、狀態、連結、雜湊及附件 |
| 使用者新增、取消或結案範圍 | TODO、PROJECT_CONTEXT 及相關歷史狀態標示 |

每次維護依序檢查：

1. 對照程式、設定及腳本核對文字、命令；測試數量只列於有日期／版本的驗證紀錄。
2. 檢查根目錄、`docs/` 及公開封存的 Markdown 連結、路徑、錨點及用途；新增文件納入索引。完成的歷史文件移至 `archive/retired/docs/`，同步更新連結。
3. 歷史資料標示適用版本／日期及現行指南入口，保留觀察、取消決定與限制。翻譯標題保留原錨點別名，搬移章節在固定入口留下導引。
4. 確認舊待辦未重新開啟，簽名 URL、憑證、IP 及播放器物件未進入文件。
5. 換版時將上一版完整 TEST_REPORT 加入歷史報告，再更新固定入口及原錨點導引；CHANGELOG 保留舊條目。兩個封裝輸入指向其他文件時使用完整儲存庫 URL，已發布快照不回寫。
6. 執行 `git diff --check`，確認差異範圍及受保護檔案未改變；實際執行的自動驗證按日期記錄，不將文件檢查寫成新安全掃描或瀏覽器驗收。

這些規則隨專案變更執行，不代表已建立排程、CI/CD 或持續監控。

## 文件整理歷史導覽

三段 2026-10-03 原紀錄已於 2026-10-06 搬入 [文件維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)，原日期、盤點數量及驗證敘述保留。本次整理的實際檢查也在該文件另立日期紀錄。

<a name="2026-10-03-文件維護紀錄"></a>

- [2026-10-03 文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-文件維護紀錄)

<a name="2026-10-03-第一次封存整理紀錄"></a>

- [2026-10-03 第一次封存整理紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-第一次封存整理紀錄)

<a name="2026-10-03-根目錄文件集中整理"></a>

- [2026-10-03 根目錄文件集中整理](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-根目錄文件集中整理)
