# 專案文件索引與維護規則

更新：2026-10-16。現行版本 **v2.1.26**，依 [release.json](../release.json)、[package.json](../package.json)、[package-lock.json](../package-lock.json) 與 [src-v2](../src-v2/entry.ts) 核對。

目前工作與啟動狀態見 [TODO](TODO.md)，已取得證據見 [TEST_REPORT](TEST_REPORT.md)。四階段收斂正式 930／930、新固定安全差異與 IAB 合成來源通過；正式發布及新版安裝分列，不沿用前版判定。v2.1.24 的位置調查 1 fail／2 pass 保留，**BR-01 整體不通過、位置遺失尚未修復**。歷史故障矩陣不恢復。

2026-10-16 使用者批准的 [v2.1.26 四階段收斂](CONVERGENCE_v2.1.26_REPORT.md) 已分階段驗證及提交，版本統一升至 v2.1.26，正在進行最終交付。v2.1.25 完整報告已原樣保存於歷史；既有 Release 與安全封存不回寫。

閱讀順序：

- 使用者：README → 功能、模式、設定與排查。
- 開發者：AGENTS → PROJECT_CONTEXT → SECURITY → ARCHITECTURE → DEVELOPMENT。
- 測試：TODO → IAB_TESTING → 對應版本 TEST_REPORT／原始證據。
- 追溯：版本紀錄 → 修復／安裝報告 → 封存與 Release 快照。

## 現行指南

| 文件 | 主要責任 |
| --- | --- |
| [README](../README.md) | 安裝、功能、四種模式、控制中心、排查及隱私 |
| [AGENTS](../AGENTS.md) | 必要開發流程、架構、安全、發行及文件要求 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 產品契約、不變量及交付邊界 |
| [SECURITY](../SECURITY.md) | 信任邊界、持久資料、網路權限及診斷限制 |
| [ARCHITECTURE](ARCHITECTURE.md) | 依賴、狀態、控制器、適配器、生命週期與診斷 |
| [DEVELOPMENT](DEVELOPMENT.md) | 環境、命令、測試隔離、建置及封裝 |
| [IAB_TESTING](IAB_TESTING.md) | 唯一瀏覽器方案、校準、隔離、判定及停止規則 |
| [TODO](TODO.md) | 目前狀態、已批准工作、歷史結案及未安排方向 |
| [TEST_REPORT](TEST_REPORT.md) | 最新版自動、安全、來源隔離、發布與安裝證據 |
| [CHANGELOG](CHANGELOG.md) | 各版功能差異與當時驗證狀態 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游基準、v1／v2 關係及來源校驗 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權、工具用途及版本 |

現行指南以繁體中文維護；識別字、命令及原始狀態值保留英文。「儲存元件」「測試情境」「建立函式」「中繼資料」「原始碼對照」「報告產生器」「堆疊資訊」用語保持一致；瀏覽器攔截與測試清理掛鉤分開描述。Markdown 依 [GFM 約定](DEVELOPMENT.md#markdown-format)，保留標題相容錨點與歷史結果。

## 檔案配置

根目錄保留 README、AGENTS、SECURITY、LICENSE 與必要設定；現行指南及版本報告集中於 docs。封裝固定讀取 CHANGELOG、TEST_REPORT，兩者的儲存庫文件連結使用完整 GitHub URL。Release／baseline／封存不作 v2 建置或測試輸入。

本輪不搬移歷史檔案。[封存總覽](../archive/README.md)、[退出流程資料](../archive/retired/README.md) 及 [IAB 指南改寫前快照](../archive/retired/docs/IAB_GUIDES_BEFORE_2026-10-11.md) 保留原配置；文件檢查追加至 [維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

<a name="br01-followthrough-status"></a>

<a name="p05-v2122-本輪交付"></a>

## 發行與驗證紀錄

本表描述各版報告的用途。歷史「未修復」「續行中」「待安裝」只代表當時時間點；現行狀態由 TODO 說明。發布、身分核對及個別子項不能代替最新版整份安裝矩陣通過。

| 版本／範圍 | 修復與調查 | 實際安裝／階段紀錄 |
| --- | --- | --- |
| v2.1.26 | [四階段收斂](CONVERGENCE_v2.1.26_REPORT.md)、[最新版完整驗證](TEST_REPORT.md) | 自動／安全／來源通過；發布與實際安裝另記，BR-01 與歷史矩陣不動 |
| v2.1.25 | [模組化與標準化](MODULARIZATION_v2.1.25_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2125-release-verification--2026-10-14) | 已發布；完整執行本體／唯一實例、Auto 1／2 倍正常回歸及控制中心通過；BR-01 位置缺陷仍未修復 |
| v2.1.24 | [政策重評與播放意圖入口](BR01_POLICY_REASSESSMENT_2026-10-14.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2124-release-verification--2026-10-14) | [新位置缺陷](BR01_v2.1.24_POSITION_LOSS_2026-10-14.md)：正常入口通過、整體不通過 |
| v2.1.23 | [CR-01～05／S-01／S-03 修復](CR01_CR05_FIX_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2123-release-verification--2026-10-13) | 新本體／singleton／hooks 身分通過；S-02 未確認 |
| v2.1.22 | [P05 原生優先](P05_COPY_FIX_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2122-release-verification--2026-10-12) | 實際全文讀回／貼上通過，原 GM 限制保留 |
| v2.1.21 | [BR-10 鍵盤隔離](BR10_FIX_REPORT.md)、[完整原驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2121-release-verification--2026-10-11) | 歷史來源／安裝分列 |
| v2.1.20 | [新意圖原生位置保存](BR01_NATIVE_POSITION_FIX_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2120-release-verification--2026-10-11) | [BR-01 安裝子項、事件缺口與清理](CHROME_v2.1.20_BR01_ACCEPTANCE.md) |
| v2.1.19 | [空媒體鍵盤所有權](BR01_NATIVE_KEYBOARD_FIX_REPORT.md) | [安裝續測二元判定與新位置缺陷](BR01_v2.1.19_INSTALLED_CONTINUATION.md) |
| v2.1.18 | [BR-09 修復](BR09_FIX_REPORT.md) | [安裝紀錄](CHROME_v2.1.18_ACCEPTANCE.md) |
| v2.1.17 | [SDK 後續恢復](BR01_FOLLOWTHROUGH_FIX_REPORT.md)、[BR-09 原調查](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md) | [安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md)、[當輪二元判定](BR01_v2.1.17_FINAL_ACCEPTANCE.md) |
| v2.1.16 | [BR-08 完整拖曳修復](BR08_FIX_REPORT.md) | [安裝紀錄](CHROME_v2.1.16_ACCEPTANCE.md) |
| v2.1.15 | [BR-07 keyup 修復](BR07_FIX_REPORT.md)、[BR-08 原調查](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) | [安裝紀錄](CHROME_v2.1.15_ACCEPTANCE.md) |
| v2.1.14 | [BR-06 鍵盤修復](BR06_FIX_REPORT.md)、[BR-07 原調查](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) | [安裝紀錄](CHROME_v2.1.14_ACCEPTANCE.md) |
| v2.1.13 | [BR-01 Auto 有界救援](BR01_FIX_REPORT.md)、[BR-06 原調查](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md) | [安裝紀錄](CHROME_v2.1.13_ACCEPTANCE.md) |
| v2.1.12 | [BR-04／05 修復](BR04_BR05_FIX_REPORT.md)、[BR-01 Auto 原調查](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) | [安裝 gate／回歸矩陣](CHROME_v2.1.12_ACCEPTANCE.md) |
| v2.1.11 | [BR-03 修復](BR03_FIX_REPORT.md)、[BR-04 原調查](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)、[BR-05 原調查](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md) | [中途紀錄](CHROME_v2.1.11_PROGRESS.md)、[領域覆蓋](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md) |
| v2.1.10 | [BR-02 修復](BR02_FIX_REPORT.md)、[BR-03 原調查](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) | [安裝紀錄](CHROME_v2.1.10_ACCEPTANCE.md) |
| v2.1.9 | [17 項功能與競態修復](FUNCTIONAL_FIX_REPORT.md)、[BR-02 原調查](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md) | [安裝紀錄](CHROME_v2.1.9_ACCEPTANCE.md) |

- [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md)：固定入口換版時保存的完整正文。
- [v2.1.25 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.25) 與 [Release/v2.1.25](../Release/v2.1.25/)：上一版不可變快照，公開附件只有使用者腳本；最新版發布狀態見 TEST_REPORT。
- [v2.1.24 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.24) 與 [Release/v2.1.24](../Release/v2.1.24/)：歷史產物及不可回寫快照。
- [DOC_MAINTENANCE_HISTORY](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)：文件維護與檢查，不等同新程式測試。

v2.1.6 驗收已批准通過並結案，原覆蓋限制不轉為現行待辦。BR-01 原自然網路起因與救援／位置保護分開，沒有新根因結論或隱含新增驗收門檻。

## 歷史計畫與瀏覽器紀錄

| 文件 | 保留範圍／狀態 |
| --- | --- |
| [SECURITY_REVIEW_v1.6.0](../archive/retired/docs/SECURITY_REVIEW_v1.6.0.md) | v1.6.0 候選版安全紀錄，不是現行政策或掃描 |
| [PLAN_v2.0.2](../archive/retired/docs/PLAN_v2.0.2.md) | 當時實作計畫；例外不作現行開發／發行規則 |
| [POST_RELEASE_v2.0.2](../archive/retired/docs/POST_RELEASE_v2.0.2.md) | 當時事故、修復及工作狀態 |
| [CHROME_v2.0.3_ACCEPTANCE](../archive/retired/docs/CHROME_v2.0.3_ACCEPTANCE.md) | 該版針對性瀏覽器回歸證據 |
| [CHROME_v2.1.2_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.2_ACCEPTANCE.md) | 該版觀察與覆蓋限制 |
| [CHROME_v2.1.6_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md) | 已批准通過且結案的驗收，保留觀察與限制 |

### IAB、調查與結案紀錄

| 文件 | 版本／用途 |
| --- | --- |
| [工具驗證](TEST_TOOLING_REPORT.md)、[測試遷移](../tests-v2/MIGRATION.md) | 按日期保存工具校準與原行為對照；舊案例數不代表目前正式數量 |
| [整體程式碼調查](CODE_REVIEW_2026-10-13.md) | v2.1.22／c4e7de4 原調查與未修結果 |
| [TODO 證據結案](TODO_CLOSURE_2026-10-13.md) | P01／P02 限制封存與 P03 原範圍；不新增功能通過 |
| [IAB 能力](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md) | v2.1.20 身分／工具能力與作廢背景窗口 |
| [IAB 第 1 輪](IAB_v2.1.20_BR01_R1_2026-10-11.md)、[第 2 輪](IAB_v2.1.20_BR01_R2_2026-10-11.md) | v2.1.20 期限、操作、SDK 與 XHR 子項 |
| [IAB 第 3 輪](IAB_v2.1.20_TODO_R3_2026-10-11.md)、[第 4 輪](IAB_v2.1.20_TODO_R4_2026-10-11.md) | v2.1.20 獨立 P 項、格式／hook 與無效窗口 |
| [收集器／第 5 輪](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md)、[BR-10／第 6 輪](IAB_v2.1.20_BR10_CONTROL_CENTER_KEYBOARD.md) | 工具隔離、新增子項、鍵盤衝突與清理 |
| [P05 通道調查](P05_COPY_CHANNEL_REPORT_2026-10-12.md)、[實際複製結果](P05_COPY_IAB_RESULT_2026-10-12.md) | v2.1.21 複製失敗與通道限制；後續修復見 v2.1.22 報告 |

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
| 瀏覽器環境、工具與驗收方法 | IAB_TESTING、AGENTS、DEVELOPMENT、TODO；校準前提、唯一環境及判定門檻 |

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
