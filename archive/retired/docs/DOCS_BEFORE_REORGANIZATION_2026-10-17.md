# 文件重整前快照 — 2026-10-17

基準：9c796a8413cf490cd6260ea952013c4af2f46648／v2.1.27。保存重整前的導覽、工作沿革與歷史矩陣；不是現行規則、工作授權或新的驗收結果。現行入口見 [INDEX](../../../docs/INDEX.md)，目前工作見 [TODO](../../../docs/TODO.md)。

原文以 Markdown 原始文字保存，內部路徑以原文件所在目錄解讀；不執行其中命令。

<a name="docs-index-md"></a>

## docs/INDEX.md

~~~~~~~~~~markdown
# 專案文件索引與維護規則

更新：2026-10-17。現行版本 **v2.1.27**，依 [release.json](../release.json)、[package.json](../package.json)、[package-lock.json](../package-lock.json) 與 [src-v2](../src-v2/entry.ts) 核對。

目前工作與啟動狀態見 [TODO](TODO.md)，最新 [BR-01 救援修復](BR01_RESCUE_FIX_v2.1.27.md) 已發布：正式 1134 案、安全差異、自有來源八案與公開校驗通過。安裝版新本體／唯一實例／hooks、Auto1／2倍正常操作及15秒播放通過；控制中心視圖／關閉通過，入口點擊依使用者指示跳過，返回保留原始觀察。細節見 [TEST_REPORT](TEST_REPORT.md)。清理完成、沒有自主續測項目，不宣稱本輪未執行的安裝故障救援通過。

v2.1.26 完整驗證正文與發布後調查補記已追加原樣保存於歷史；第一輪批准等待更正、第二輪 FAIL 與隔離限制、既有 Release 及安全封存不回寫。自然起因暫緩，歷史矩陣不重開。

2026-10-17 使用者指示跳過控制中心入口點擊：不作本輪驗收／結案阻塞，不安排續測；原觀察保留，不轉算通過。詳見 [目前狀態](TODO.md) 與 [修復紀錄](BR01_RESCUE_FIX_v2.1.27.md)。

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
| v2.1.27 | [位置與救援修復](BR01_RESCUE_FIX_v2.1.27.md)、[最新版完整驗證](TEST_REPORT.md) | 已發布、結案；正式／安全／來源／公開校驗及正常安裝通過，控制中心入口點擊依指示跳過、返回觀察保留；安裝故障救援未實測 |
| v2.1.26／ccf947a BR-01 第二輪 | [完整自然窗口、逐案判定與修復規格](BR01_RCA_R2_2026-10-16.md) | 369 案、7 真實失敗；來源 4 pass／2 fail；自然起因未定位，受控 2 倍未完整通過，首次 1 倍隔離缺口保留；工具資源已清理 |
| v2.1.26／ccf947a BR-01 第一輪 | [第一輪與批准時間更正](BR01_RCA_2026-10-16.md) | 原 298 案及觀察保留；撤回 18 小時執行超時判定，不以新輪補填舊結果 |
| v2.1.26 | [四階段收斂](CONVERGENCE_v2.1.26_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2126-release-verification--2026-10-16) | 已發布；自動／安全／來源／公開校驗、完整本體／唯一實例及 Auto 1／2 倍正常安裝／控制中心通過，BR-01 與歷史矩陣不動 |
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
- [v2.1.27 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.27) 與 [Release/v2.1.27](../Release/v2.1.27/)：目前正式版本，公開附件只有使用者腳本；安裝後文件另提交main，快照不回寫。
- [v2.1.26 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.26) 與 [Release/v2.1.26](../Release/v2.1.26/)：前版不可變快照，公開附件只有使用者腳本；發布後安裝文件不回寫快照。
- [v2.1.25 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.25) 與 [Release/v2.1.25](../Release/v2.1.25/)：歷史不可變快照，公開附件只有使用者腳本；最新版發布狀態見 TEST_REPORT。
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

2026-10-17 v2.1.27 結案後已完成現行指南、來源／設定／既有結果核對及全部公開 Markdown 的解析／連結檢查；修正封存索引、歷史矩陣版本、失效導覽及結案範圍。範圍與數量見 [完整文件核對紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#docs-closeout-v2127-20261017)，不表示重跑產品或瀏覽器驗收。

三段 2026-10-03 原紀錄已於 2026-10-06 搬入 [文件維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)，原日期、盤點數量及驗證敘述保留。本次整理的實際檢查也在該文件另立日期紀錄。

<a name="2026-10-03-文件維護紀錄"></a>

- [2026-10-03 文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-文件維護紀錄)

<a name="2026-10-03-第一次封存整理紀錄"></a>

- [2026-10-03 第一次封存整理紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-第一次封存整理紀錄)

<a name="2026-10-03-根目錄文件集中整理"></a>

- [2026-10-03 根目錄文件集中整理](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-根目錄文件集中整理)
~~~~~~~~~~

<a name="docs-todo-md"></a>

## docs/TODO.md

~~~~~~~~~~markdown
# v2 工作狀態與後續方向

更新：2026-10-17。現行版本 **v2.1.27**，以 [release.json](../release.json) 為準；發布與實際安裝結果見 [TEST_REPORT](TEST_REPORT.md)。

## 現在的執行狀態

**2026-10-17 使用者結案決定：控制中心入口點擊依指示跳過，不作本輪驗收或結案阻塞，也不安排續測。** 這是縮減驗收範圍，不將既有未通過紀錄改成通過；救援修復與其他已取得結果維持原判定。

使用者批准的 BR-01 有限救援修復已完成三階段實作並發布 v2.1.27：可信未完成目標與有條件初始化還原、一般 6／12／15 與長 seek 15／30／15 秒、完整救援與持續播放驗收。分階段 verify 1038／1060／1134 全通過，安全差異 27 項完整審查、0 發現，自有來源八案及公開校驗通過。安裝版 Auto1／2 倍正常操作／播放通過，控制中心視圖與關閉通過；入口點擊／返回導覽保留工具及網站限制。清理完成，本輪收束，沒有自主續測項目。詳見 [修復紀錄](BR01_RESCUE_FIX_v2.1.27.md)。

| 項目 | 最新判定 | 證據與邊界 |
| --- | --- | --- |
| 失效歸零覆蓋可信目標 | 修復；正式契約與來源驗證通過 | 非零、真正零、A→B、完成／所有者失效、初始化及新操作保護；舊 I-P01／04 FAIL 保留於原報告 |
| 救援速度與動作額度 | 正式契約通過 | 一般 6／12／15、長 seek 15／30／15；同起點、單段一次、生命週期兩次、90 秒冷卻；理想普通無進度終止 45→27 秒 |
| 自動／安全／來源 | 通過 | 1134／1134（新產品單元 110、整合 58、工具 36）、99 模組、verify；固定安全差異 0 發現，IAB 自有來源 8／8 |
| v2.1.27 發布／正常安裝 | 已交付、結案 | main／標籤、唯一附件／公開latest一致；完整新本體／singleton／hooks、Auto1／2倍操作及15秒播放通過。控制中心視圖／關閉通過，入口點擊依指示跳過、返回原始觀察保留，均不安排續測；詳見 TEST_REPORT |
| 安裝版故障救援與自然起因 | 本輪不執行 | 自然起因暫緩；沒有新自然根因或安裝故障救援通過宣稱 |
| BR-01 歷史整份矩陣 | 保持停止 | 原結果不回寫、不重跑、不把新版正常回歸補算舊故障矩陣 |
| P01／P02 及其餘結案 | 沿用原判定 | pending gate 缺前提及其他封存限制見 [結案紀錄](TODO_CLOSURE_2026-10-13.md) |

## 執行邊界

- 本輪已完成批准的有限正常回歸並結案；不再續測，也不開自然觀察或安裝故障注入窗口。
- 第一輪 65127.7786 秒包含批准等待，執行超時判斷已撤回；第二輪 369 案與 7 個真實失敗及隔離缺口保留於 [r2 調查](BR01_RCA_R2_2026-10-16.md)，不以新修復更改歷史證據。
- 工具校準、文件整理或發布不自行恢復已停止工作；P01／P02 仍需明確授權與自然 pending gate 新前提。
- 唯一瀏覽器方案為 [IAB_TESTING](IAB_TESTING.md)。新自動、來源與安裝分別判定，未實測不宣稱通過。

<details>
<summary>歷史交付、已結案項目與 BR-01 矩陣（保留原判定）</summary>

下列保留各輪當時的授權、觀察與結案細節；其中「本輪」「目前」以原版本／日期為準，不能取代上方最新狀態或構成續測授權。

### 2026-10-14 政策重評與安裝結果

**2026-10-14：依使用者新授權，僅重開 BR-01 救援政策重評與已確認入口修復。** 保留 15／30／15 秒，修復失效核心忽略可信播放按鈕造成意圖遺漏；不重開歷史整份矩陣或 P01／P02。正式 855／855、來源隔離與安全差異通過；發布及實際安裝結果見 [本輪報告](BR01_POLICY_REASSESSMENT_2026-10-14.md)、[TEST_REPORT](TEST_REPORT.md)。

**v2.1.24 已載入並核對完整本體與唯一實例。Auto 1／2 倍正常長暫停後播放通過；BR-01 整體不通過。** 新版可信播放入口已生效，但另確認失效媒體重設後遺失使用者尋位目標；獨立契約 1 fail／2 pass。故障窗口的傳輸收集限制與局部媒體證據分列，不擴大通過範圍。詳見 [位置遺失報告](BR01_v2.1.24_POSITION_LOSS_2026-10-14.md)。本輪停止重跑，未作後續執行期修改。

## 既有交付與結案沿革

**CR-01～05 及原生確認的 S-01／S-03 已修復並發布 v2.1.23。** 33 個新增正式契約、19 套件 841／841、型別／架構／verify 與 IAB 11 組原生對照通過；獨立安全差異 23／23 檔、0 發現。main／標籤、唯一附件與公開 latest 已核對一致。使用者更新後，實際新版完整本體、唯一 RuntimeController／ControlCenter 與 Fetch／XHR hooks 核對通過；不將身分／來源結果擴大為整份安裝矩陣通過。詳見 [修復報告](CR01_CR05_FIX_REPORT.md)。

| 項目 | 本輪判定 | 範圍 |
| --- | --- | --- |
| CR-01／02 | 已修復 | 精確所選原線與來源集合授權，保留真正撤銷 |
| CR-03／04 | 已修復 | 起播開始消耗預算；量測拒絕及舊工作依所有權收束 |
| CR-05 | 已修復 | 額外成功回應不撤回已確認進度；不代表 BR-01 結案 |
| S-01／03 | 原生確認並修復 | header 一次轉換與 body 轉換失敗可更正送出 |
| S-02 | 未確認，限制封存 | 工具達 15 分鐘定位上限，未取得 relative URL／base 對照；不自行修復或重跑 |

原始 [整體調查](CODE_REVIEW_2026-10-13.md) 與未修失敗紀錄保持原狀。raw SharedArrayBuffer 不在本次七種原生 body 對照內，未確認相容性，不列已確認缺陷。該版交付時 BR-01 跳過；本輪新授權範圍見頁首，已通過瀏覽器案例不重測。

**稍早的 2026-10-13 TODO 證據核對與文件結案維持有效。** 當時沒有已批准、需要自主接續的測試項目；本次新調查結果另列於上表。P01 已執行的 36 案、P03 同片安裝子項及 P04／P05／BR-10 沿用通過；P01 bounded prepare／P02 真 gate 因自然前提未成立，限制封存。P03 其他矩陣依原方案核對來源隔離／Node，沒有額外安裝門檻；缺少的來源隔離結果明列證據不足。詳見 [結案紀錄](TODO_CLOSURE_2026-10-13.md)。該次文件結案沒有重測或新增產品通過判定。

**2026-10-11 使用者決定跳過 BR-01。** BR-01 剩餘專項驗收已移出現行待辦，不再自主續測、重開故障窗口或作為其他 TODO／發布的門檻。既有修復、正式回歸與實測證據保留；此決定不代表未執行的項目通過。只有使用者明確要求恢復 BR-01，才重新安排該項工作。其後已另行授權繼續 BR-01 以外的 TODO。

**BR-10 修復、v2.1.21 發布及安裝入口驗證通過。** 控制中心正式套件 17／17、全套 788／788；獨立安全差異審查 0 發現。來源隔離及公開 latest 身分核對通過。代理透過內建瀏覽器公開更新入口完成載入新版，不需手動更新；Auto 1／2 倍 Enter／Space 四案、P04 關閉／切頁兩案、P05 完整報告通過。上述既有結果不重測；見 [修復報告](BR10_FIX_REPORT.md)。

**歷史 v2.1.21 P05 實際複製不通過，GM 通道根因未定位。** 使用者改以 IAB 真正貼上與讀回驗證；64 字元合成對照及完整快照復原通過，已核對 v2.1.21 全本體與唯一實例。真實 UI 的當次 18,150 字元報告與兩種讀回的原文字 61 字元均不符。另行批准的單次 GM 純文字校準取得完成回呼，讀回仍未變，不能推測補格式參數就能修復。原剪貼簿完整保留，分頁／服務及觀察器已清理；沒有產品修改或新發布。見 [本輪結果與續查條件](P05_COPY_IAB_RESULT_2026-10-12.md)。先前 [PowerShell 通道調查](P05_COPY_CHANNEL_REPORT_2026-10-12.md) 保留歷史判定；沒有新寫入端觀察能力時不重複窗口。

**2026-10-11 第 5 輪已收束；收集器修復與隔離驗證通過，新增 B02 滑鼠 1 倍的 30 秒尾段及 P03 同片自然 cid／epoch 子項通過。** 沒有新確認的產品缺陷，固定矩陣仍未完整通過。見 [收集器與第 5 輪報告](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md)。前 4 輪有效結果沿用；B02 其餘新尾段及 B03 釋放前置在網站換核心／暫停後停止，沒有反覆重跑。正式工具套件 30／30，最後自有分頁為零、包裝／攔截清理、107 個受控 request 樣本零匹配，C01 通過。只改工具、測試與文件；產品來源與版本未變，沒有發布或排程。

唯一現行瀏覽器方案：[IAB_TESTING](IAB_TESTING.md)。從現在起不使用外部 Chrome／Edge、獨立 Playwright／Puppeteer 或 headless 瀏覽器測試；Node、自動型別／架構／建置仍保留。

2026-10-11 已取得內建瀏覽器的完整 v2.1.20／Tampermonkey 身分、可信輸入、基本播放／控制中心及精確合成 Fetch／XHR 能力證據。先前背景窗口未證明真正分頁切換與 getter 來源，原能力失敗判定已撤回；這是無效窗口，不是已確認的新產品缺陷。見 [可用性紀錄](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md)。

<a name="本輪結果與再次執行前提"></a>

## BR-01 歷史矩陣：仍不恢復整份驗收

下表只保存停止時的通過結果與證據缺口，**不是現行待辦或續測授權**。即使日後出現新的工具能力或自然前提，也不自動恢復 BR-01。既有正式回歸仍保留在一般測試套件；不刪除測試或改寫結果。

| 固定 ID | 停止時的結果 | 歷史證據缺口 |
| --- | --- | --- |
| E01～E03 | 通過 | 已保存兩次完整本體及唯一實例；新文件載入才重新核對 |
| E04／B07 | 第 2 輪 E04 無效，B07 未執行 | 新觀察器 dropped=0，但兩個控制頁仍原生 hidden=false；需要可證明 false→true→false 的實際切換，不再重複 bringToFront／queued 操作 |
| S01／S03 | 通過 | 精確期限與 74 個最終來源非同步／隔離情境有證據；不代替安裝版 |
| S02 | 已執行的鍵盤／拖曳子項通過 | 900 ms 真按鍵仍只有一組 keydown／keyup、repeat=false；pointercancel 缺可信能力，不以合成事件補算 |
| B01／B04 | Auto 1／2 倍通過 | 正常操作、12 秒延遲、音訊通行、時間與影格進度已保存 |
| B02 | BODY、播放器焦點、第二次滑鼠 seek 的新修訂及 15 秒寬限，1／2 倍均有通過子項；R5 滑鼠 1 倍完整 30 秒尾段通過 | R2 播放器焦點 1 倍在 30 秒前換核心。收集器修復後，R5 播放器焦點 2 倍／滑鼠 2 倍分別在新操作後 19.743／19.788 秒被網站換核心並暫停；無新前提不重跑 |
| B03 | wrapper／inner 故障長按 1／2 倍通過；inner 1 倍釋放後新 15 秒通過 | 原生 cancel 缺能力；R5 1 倍先因命中失效作廢，修正後 dragging 成立但網站在 22.596 秒換核心／暫停；未取得釋放尾段。2 倍網站暫停限制沿用，沒有新前提不重跑 |
| B05 | Auto 1／2 倍完整通過 | 每窗備援 1、reload 1、reload-timeout 終止 1；之後至少三 tick 不重試 |
| B06 | 第 2 輪 2 倍實際 reload→新 pause→晚到拒絕、play→新 seek→晚到拒絕通過 | R3 在 SDK 前換核心；R5 1 倍真正 reload 後空核心期間按鍵未取得新修訂，晚到成功窗口無效。須先有實際方法與可用新操作共存，沒有新前提不重跑 |
| B08 | 音訊隔離、既有命令及 pending 政策撤銷通過 | 原線對照 1 倍／停用 2 倍均撤銷等待意圖並復原；封閉 Shadow DOM UI 點擊仍不支援，命令不冒充 UI |
| C01 | 第 5 輪最終清理通過：分頁／held／patterns 為零，20 個包裝及 3 個 observer timer／訂閱釋放；107 個受控 request 記憶體／持久樣本零匹配 | 最後 B03 cleanup 的 4 筆取消／放行競合錯誤保留；原生終止證據確認後清理完成，不補算無效窗口 |

新增結果與清理見 [第 5 輪報告](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md)，本機證據位於 `.work/iab-testing/2026-10-11-v2.1.20-f5f26e3-r5/`。沿用證據見 [第 1 輪](IAB_v2.1.20_BR01_R1_2026-10-11.md)、[第 2 輪](IAB_v2.1.20_BR01_R2_2026-10-11.md)、[第 3 輪](IAB_v2.1.20_TODO_R3_2026-10-11.md) 與 [第 4 輪](IAB_v2.1.20_TODO_R4_2026-10-11.md)。歷史 Chrome 結果仍見 [原報告](CHROME_v2.1.20_BR01_ACCEPTANCE.md)，不轉算 IAB 通過。這些歷史報告的續行文字由本頁最新的「跳過 BR-01」決定取代。

<a name="與-br-01-分開的工作"></a>

## 本輪已結案：完成與限制封存

P01～P05 維持獨立範圍。下表區分已完成與限制封存，不表示所有矩陣均已通過；原始結果及逐項環境見 [2026-10-13 結案紀錄](TODO_CLOSURE_2026-10-13.md)。

| 項目 | 狀態 | 證據與邊界 |
| --- | --- | --- |
| P01 已執行 XHR | 已通過 | 第 2 輪 24 案、第 3 輪 10 案、第 4 輪真正 timeout 2 案沿用，不再重跑；原無效窗口不計入 |
| P01 bounded prepare／P02 真 gate | 限制封存 | 自然 XHR 明設 timeout，依契約 skipped，沒有 pending gate；等待者、取消原因與終止交錯未取得安裝證據，不判通過或產品失敗 |
| P03 同片自然 API | 安裝子項已通過 | R5 兩筆均與原請求 cid 相符、accepted=true、epoch 0→0，第二筆同 cid；不製造不同影片或 cid |
| P03 排列／換組／缺失 cid／格式 | 證據核對結案 | v2.1.22 發布驗證中的 43 個 BR-03 Node 案例、IAB 第 4 輪格式／hook 17 案沿用；舊 Chrome 來源隔離 31／31 保留原環境。完整內容週期交錯的 IAB 來源證據不足，限制封存，不增加安裝門檻 |
| P04 設定／儲存／UI | 已完成 | 雙分頁合併與原生 GM remote 通知沿用；v2.1.21 關閉／切頁後命令完成兩案通過，設定及包裝已復原 |
| P05 診斷／格式／資源 | 已完成 | v2.1.22 的 31,204 字元全文讀回／真正貼上一致，原內容與資源復原通過；其餘已通過結果沿用。見 [修復報告](P05_COPY_FIX_REPORT.md) |
| BR-10 控制中心鍵盤衝突 | 已完成 | v2.1.21 Auto 1／2 倍 Enter／Space 四案通過；見 [修復報告](BR10_FIX_REPORT.md) |
| BR-01 歷史矩陣與原自然停滯原因 | 原矩陣仍跳過 | 本輪僅政策重評與播放意圖入口；不擴張舊矩陣或宣稱原網路起因已定位 |

P01／P02 只有使用者明確要求恢復，且取得指定影片自然 pending gate 的新前提時才重新安排；不改網站 timeout、重設預算或反覆刷新製造條件。其他封存限制也不自動產生新窗口。若日後另行授權工作發現新缺陷，先保存最小重現、正常對照、來源位置及詳細報告，再決定修復範圍。

## 已完成／已結案

下列是各版修復與發布的歷史狀態，不代表最新版整份安裝矩陣已通過：

| 修復 | 版本／紀錄 |
| --- | --- |
| 17 項功能／競態契約 | v2.1.9，[修復對照](FUNCTIONAL_FIX_REPORT.md) |
| BR-02 failed open 所有權 | v2.1.10，[修復](BR02_FIX_REPORT.md) |
| BR-03 內容穩定識別 | v2.1.11，[修復](BR03_FIX_REPORT.md) |
| BR-04 有界 XHR 準備、BR-05 取消原因 | v2.1.12，[修復](BR04_BR05_FIX_REPORT.md) |
| BR-01 Auto 15／30／15 救援 | v2.1.13，[原修復](BR01_FIX_REPORT.md) |
| BR-06／07 鍵盤 keydown／keyup | v2.1.14／15，[BR-06](BR06_FIX_REPORT.md)、[BR-07](BR07_FIX_REPORT.md) |
| BR-08 完整拖曳 | v2.1.16，[修復](BR08_FIX_REPORT.md) |
| BR-01 自有 SDK 後續恢復 | v2.1.17，[修復](BR01_FOLLOWTHROUGH_FIX_REPORT.md) |
| BR-09 未初始化媒體目標 | v2.1.18，[修復](BR09_FIX_REPORT.md) |
| BR-01 未初始化媒體鍵盤身分 | v2.1.19，[修復](BR01_NATIVE_KEYBOARD_FIX_REPORT.md) |
| BR-01 新意圖原生位置保存 | v2.1.20，[修復](BR01_NATIVE_POSITION_FIX_REPORT.md) |
| BR-10 控制中心鍵盤隔離 | v2.1.21，修復、發布及 Auto 1／2 倍入口四案通過；P04 與 P05 報告通過。P05 複製另於 v2.1.22 完成，見上表。[BR-10 修復與安裝](BR10_FIX_REPORT.md) |

v2.1.6 的瀏覽器驗收已批准通過並結案，原覆蓋限制不轉為現行待辦。2026-09-25 起的新增 CDN 研究已撤銷，不授權修改 Catalog。更早的逐輪進度完整保留於 [改寫前快照](../archive/retired/docs/IAB_GUIDES_BEFORE_2026-10-11.md#docs-todo-md) 及 [歷史索引](INDEX.md#發行與驗證紀錄)。

## P05 v2.1.22 本輪交付

**P05 修復、發布及實際安裝驗收通過。** 控制中心 37／37、全套 808／808、verify、安全差異及原生來源讀回／貼上通過，公開產物一致。更新後完整 v2.1.22 本體及唯一實例核對通過，真實 UI 的 31,204 字元報告讀回／真正貼上全文相符，全部原剪貼簿及自有資源清理通過。詳見 [P05 修復報告](P05_COPY_FIX_REPORT.md)。BR-01 保持跳過；P01／P02 依上表限制封存。

</details>

## 持續維護規則

先建立正式失敗契約再改來源；正式套件不得保留 only／skip／todo／cancelled。必要自動及風險要求的安全驗證完成後，依 AGENTS 常設授權發布修復；安裝版證據另列。文件整理不冒充執行測試，不回寫 Release 快照、原失敗紀錄或安全封存。

## 尚未安排的方向

記憶最近 CDN 偏好、增加預連線／挑戰頻率及其他平台相容性擴展，均沒有本輪實作授權。瀏覽器測試環境已固定為 IAB，不能為上述方向擅自啟用外部瀏覽器。
~~~~~~~~~~

<a name="docs-iab_testing-md"></a>

## docs/IAB_TESTING.md

~~~~~~~~~~markdown
# Codex 內建瀏覽器測試方案

日期：2026-10-11 初稿，2026-10-17 更新。適用目前 `src-v2/`；版本以 [release.json](../release.json) 為準，目前為 **v2.1.27**。

**所有瀏覽器測試只使用 Codex 內建瀏覽器＋Tampermonkey。** 包含來源隔離、安裝版、背景、傳輸與發布後回歸；不得改用外部 Chrome／Edge、獨立 Playwright／Puppeteer 或 headless 瀏覽器。Node 契約、型別、架構及建置檢查仍保留。

本文件保存操作與判定規則，**不構成測試啟動授權**。目前工作只看 [TODO](TODO.md)；BR-01 歷史整份矩陣仍跳過，P01／P02 維持限制封存。2026-10-14 的有限政策重評及安裝續驗已收束，不因工具校準、文件整理或發布自動開下一輪。

2026-10-16 使用者另行批准 v2.1.26 四階段收斂的有限來源及正常安裝回歸：來源只驗本輪 XHR getter／快取、選路提交順序、播放器控制與清理；安裝只驗指定影片 Auto 1／2 倍、暫停／恢復／短 seek、控制中心及鍵盤邊界。E／S 與發布後有限 I 範圍已通過、清理及結案；詳見 [收斂報告](CONVERGENCE_v2.1.26_REPORT.md)，不能恢復歷史矩陣。

v2.1.24 的完整本體與正常播放入口結果屬歷史；當版正式 855／855 與獨立位置調查 1 fail／2 pass 見 [v2.1.24 完整報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2124-release-verification--2026-10-14)。**v2.1.24 的 BR-01 整體不通過，位置遺失為當時未修復缺陷**；傳輸限制與局部媒體證據見 [位置報告](BR01_v2.1.24_POSITION_LOSS_2026-10-14.md)。v2.1.25 模組化、來源及有限正常安裝已結案，結果見 [v2.1.25 完整報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2125-release-verification--2026-10-14)。兩者都不構成續測授權。

2026-10-17 使用者批准的 v2.1.27 有限救援修復、發布與正常安裝回歸已結案：來源八案通過，指定影片 Auto 1／2 倍正常播放、暫停／恢復、短 seek 與倍速通過；控制中心視圖與關閉已驗，入口點擊依使用者指示跳過，不作結案阻塞或安排續測。原始返回導覽限制保留，不轉算通過。自動、來源、安裝與清理分列於 [救援修復紀錄](BR01_RESCUE_FIX_v2.1.27.md)。不開自然觀察或安裝故障窗口，歷史矩陣保持停止，文件核對不啟動新窗口。

版本別工具能力、IAB 第 1～6 輪及 P05 通道結果由 [歷史導覽](INDEX.md#歷史計畫與瀏覽器紀錄) 追溯。既有通過沿用；舊 Chrome 證據保留原環境，不轉算新的 IAB 通過。

<a name="scope"></a>

<a name="v2123-本輪來源邊界"></a>

## 1. 範圍與證據層級

網站只使用 [指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 畫質，1 倍與 2 倍速分開。保持其他已安裝腳本與瀏覽器設定；不以強制畫質、停用其他腳本、改網站 timeout、媒體 getter、控制器或重設預算來製造成功。

| 層級 | 執行位置 | 可以證明 | 不能代替 |
| --- | --- | --- | --- |
| N：正式契約 | 現有 Node 套件 | 精確邊界、所有權與非同步交錯 | 瀏覽器原生行為與實際播放 |
| S：來源隔離 | 內建瀏覽器的自有 loopback 頁面／iframe | 真正 Fetch／XHR、可信輸入、修復來源與原生對照；`FakeClock` 僅在自有情境 | 已安裝 Tampermonkey singleton 的行為 |
| I：實際安裝 | 內建瀏覽器＋Tampermonkey 的指定影片 | 完整本體、真正 singleton／hooks、Auto 播放與可觀察故障恢復 | 未發生的自然條件、其他站點／格式或其他瀏覽器 |
| E：環境校準 | 同一內建瀏覽器的自有控制頁與指定影片 | 操作、可見性、事件及攔截能力是否足以支持本案例 | 產品契約通過 |

自有控制頁只服務合成資料，綁定 loopback，不包含登入資料或簽名媒體網址，不開第二種影片。S 的儲存使用注入介面與自有資料；不得把合成資料接到使用者正式 GM 持久資料。

每份結果都寫明層級、版本、來源雜湊與情境。相同瀏覽器不會讓 S 自動變成 I。已發布版本的舊 Chrome 紀錄保留原證據身份，不改名冒充內建瀏覽器結果。

<a name="preflight"></a>

## 2. 開始前只做一次的環境確認

1. 記錄 HEAD、工作目錄狀態、release.json、工具版本、目標腳本附件與執行本體 SHA-256。版本標頭不能代替完整本體核對。
2. 明確選取工具回報 `type=iab` 的瀏覽器；動態取得 browser／tab ID，不硬編碼歷史 ID。透過目前工具文件列出的 API 控制分頁與讀取 CDP，不另啟瀏覽器控制程序。
3. 核對實際 GM_info 的 scriptHandler、管理器版本、腳本版本；對照已載入完整本體、Runtime／`ControlCenter` 各一個實例與 hook 安裝狀態。Debugger 暫停僅用於身分取得，完成即解除；暫停中的時間不能算故障期限。
4. 記錄原設定、目前播放位置／速度、真正媒體狀態、控制修訂、授權與剩餘重載額度。只讀必要的有界欄位；原始網址與播放器物件留在分頁記憶體，不輸出至報告。
5. 在自有合成端點先證明精確 Request 攔截與清理可用，再開始網站故障案例。已知 raw CDP 需明列 Fetch／XHR resourceType；清理採 `Fetch.enable({patterns:[]})`，不能假設所有 CDP 命令都可用。
6. 建立新單一 Fetch／Network 游標；前置請求、測試期間與晚到結果使用同一連續游標，持續分頁讀取至 hasMore=false，記錄 truncated／dropped／讀取空隙。背景觀察器需明列容量；丟棄過事件的窗口不能宣稱完整時序。
7. 確認沒有前輪遺留的請求、攔截、計時器、包裝或斷點。版本、導覽、重新連線或執行實例改變時重做身分確認；同一實例的每個普通操作不重做全部準備。

故障窗口前先用最小操作驗證本機服務、JavaScript／CDP、可信輸入、事件讀取與解除，及早觸發可預見的工具批准。已有工作授權直接沿用；工具強制批准仍須遵守。CDP 回傳必須檢查 exceptionDetails／Error subtype、實際方法與隔離審計；例外物件也可能有 objectId，不能據此判成功。非同步評估完整 await 後才採用結果。

目前已取得的一般能力證據見 [2026-10-11 可用性紀錄](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md)。其中背景窗口已作廢，不能當成本方案的 E04 通過。

<a name="visibility"></a>

## 3. 前景偽裝與真正背景的校準

BiliCDN 的 [VisibilityAdapter](../src-v2/adapters/visibility.ts) 在 document **實例**覆寫 hidden=false、visibilityState=visible，讓網站繼續把頁面視為前景；安裝時另保存 prototype hidden getter，供自己的監控、量測與恢復使用。讀值分成三欄：

| 觀察欄位 | 方法與用途 |
| --- | --- |
| 網站所見 | 讀 document.hidden／visibilityState；啟用時保持 false／visible 是預期行為 |
| 經校準的瀏覽器原生狀態 | 使用來源已核對的原生 getter，觀察實際前景→背景→前景轉換 |
| Runtime 判定 | 讀真正 singleton 所連接的 `VisibilityAdapter.isActuallyVisible()`／相同注入查詢；背景應 false，返回應 true，不新增公開測試 API |

不能把第二、三欄當作兩份獨立的原生性證明，因為它們可能依賴同一個 getter；也不能只靠函式名稱或 `[native code]` 字串認定原生。

### E04 的實際步驟

1. 先在內建瀏覽器開兩個自有、未載入產品來源的合成控制分頁 A／B，確認其載入腳本與 getter 描述子。必要的原生參照在來源安裝前保存。對同源自有 iframe 的借用亦須確認取得時機與來源，不能假設空白 iframe 永遠沒有擴充腳本。
2. 用實際分頁選取操作 A→B→A，保存 UI／選取狀態，以及 A 的連續原生 hidden 紀錄。不能用關閉面板代替；queued 的 UI 操作與工具 selectedTab 改變，都不足以單獨證明實體 WebContents 已背景化。
3. 控制頁必須出現 false→true→false，才通過環境正反對照。若工具無法完成實際切換，記錄具體操作與結果，停止這個背景案例；不假設所有內建瀏覽器都不支援背景。
4. 安裝版指定影片重新取得原生參照及描述子：若使用工具允許的 document-start／來源執行前捕捉，必須保留它早於覆寫的實際時序證據；不能假定攔截安裝順序。比對 BiliCDN 的 document 實例覆寫與 prototype 來源，排除未知包裝。這一步不可用時，E04 記為無效，不能拿來源隔離結果補算。
5. 再由影片 A 切至自有控制分頁 B。要求經校準的原生 hidden=true、Runtime visible=false，而網站所見可繼續是 false／visible。返回後原生 hidden=false、Runtime visible=true；背景時間不得計入新的救援期限。
6. 不修改 document／Document.prototype getter、不使用可見性模擬或合成 visibilitychange 冒充真背景，不停用腳本取得「較好看的」結果。S 層的注入可見性模型可驗證控制器邏輯，但必須標明 S。

一次方法未形成前提，只能歸因為該窗口無效。只有新增可證明的實際切換方法或觀察器修正，才允許同輪再做一次；不得重複同一無效操作。

<a name="matrix"></a>

## 4. 固定驗收矩陣

下表保留 **v2.1.20 的歷史完整矩陣**，未重新啟動，並非 v2.1.27 的追加驗收清單。表內 S01、B04、B05 的 15／30 秒是該版門檻；目前一般非尋位停滯為 6／12／15 秒，長 seek／未完成可信目標為 15／30／15 秒，精確邊界由正式 Node 契約驗證，詳見 [現行救援契約](PROJECT_CONTEXT.md#recovery-contract)。不得依舊 B04 的 12 秒窗口推論新版一般停滯不應救援。

另行授權新一輪時，才先寫定該輪必測 ID、來源差異及沿用證據。歷史 BR-01 方案包含 E01～E04、S01～S03、B01～B08 與清理 C01；傳輸／內容等交叉項 P01～P05 另列，不能在執行中無限加項。自然網路起因另立調查，不作救援修復的隱含新增門檻；目前已結案範圍以 TODO 為準。

| ID | 情境 | 有效前提與通過條件 |
| --- | --- | --- |
| E01 | 環境與安裝身分 | iab、Tampermonkey、完整本體雜湊、唯一實例、實際 hooks 全部相符 |
| E02 | 可信輸入 | 實際鍵盤／指標操作；校準 Right 的 keyup、Left 的 keydown，實際新目標與修訂相符；合成事件不計可信輸入 |
| E03 | 傳輸觀察 | 自有 Fetch／XHR 各一次精確送出前合成回應；事件完整、無外送、可清理 |
| E04 | 真背景校準 | 依上一節完成控制頁與安裝版的前景→背景→前景證據 |
| S01 | 精確救援時間 | 自有 `FakeClock` 的 14,999／15,000、29,999／30,000、重載後 14,999／15,000 ms；只一次備援／重載，失敗釋放後不重試 |
| S02 | 操作與來源所有權 | 真正可信鍵盤／指標搭配自有模型，含頁面焦點、兩種派送、repeat、位置 0、拖曳／cancel、輸入排除、腳本來源抑制 |
| S03 | 非同步與生命週期 | 真正 Adapter→Monitor→Recovery 的自有模型：晚到／拒絕、核心替換、政策／授權／generation／epoch 失效、影音隔離 |
| B01 | 正常 Auto，1／2 倍各一窗 | 穩定播放、pause／resume、短 seek；保存時間及影格增量；正常 ABR 調整不視為缺陷、不鎖畫質、沒有無因重載 |
| B02 | 故障中的新 seek | BODY／播放器焦點的可信按鍵與滑鼠對照，確認最新目標與新 userRevision；舊停滯第 8 秒左右的新命令取得完整新期限，舊還原不回寫 |
| B03 | 長拖曳，1／2 倍分開 | 當下重新量取 wrapper／inner，按住跨過 31 秒，含尚未提交 seek 預覽；dragging=true 且沒有新監控備援／重載。釋放／cancel 清理，普通停滯由最新目標重計；冷起播保留既有 firstMediaAt 政策 |
| B04 | 約 12 秒 video-only 延遲 | 精確持有 video，audio 通行；釋放後有實際時間／影格進度。以「實際連續無進度起點」而非攔截開始時間判斷 15 秒門檻；門檻前不得多餘救援 |
| B05 | 完整 15／30／15，1／2 倍各一窗 | 前景、合法 video 備援可用、額度可用、breaker 已到期且持續無進度；15 秒後首個合資格 tick 一次備援、30 秒後首個合資格 tick 一次實際 reload，均不得重複；合法自有 SDK pause／空核心依既有例外觀察；重載後完整 15 秒仍無有效進度則 failed、token 釋放，至少再看三個 tick 不重試 |
| B06 | 新操作與晚到 SDK | 真正 reload／play 已被呼叫，只延後自有回傳 Promise；新 seek、拖曳、pause／倍速撤銷舊動作，晚到完成／拒絕不能復活或回寫；保存 receiver、參數、回傳／例外與描述子 |
| B07 | 背景期間撤銷 | E04 已通過；切換後無新救援／主動量測、舊還原不能提交，返回建立新基準，不計背景時間；不得要求背景影片本身必須停止播放 |
| B08 | 政策、生命週期與影音隔離 | 既有 UI 的啟用／停用或對照失效撤銷舊工作；audio 故障不建立 video 核心意圖，有效 video 救援仍可用。真換片只在 S 測，不向指定影片注入不同 cid |
| P01 | BR-02／04 XHR | 原例外／重入、failed open、本地終止、reopen／abort、text／json、同步／非同步／timeout 的 36 個安裝／原生對照案例沿用。真 installed gate 中的 bounded prepare 限制封存，未判通過；其他來源證據保持原環境 |
| P02 | BR-05 真 singleton gate | 保留契約：自然首筆媒體請求啟動 pending gate，Fetch／XHR 等待者、單方取消、原因身分及單次終止正確。目前自然 XHR 明設 timeout，前提未成立，限制封存；不以自建控制器替代 |
| P03 | BR-03 同片內容 | I 的同片自然 API／原請求 cid／epoch 子項已通過，不製造不同 cid／影片。排列、完全換組、缺失 cid、MP4／FLV／混合格式依原方案分列 S／N；已核對的 Node 與歷史來源結果沿用，缺少的 IAB 來源證據列結案限制，不擴大安裝門檻 |
| P04 | 設定／儲存／控制中心 | I 以可精確復原的單節點變更、關閉／切頁後完成及相同影片雙分頁同步驗證；清除學習／reset 等破壞性與鎖交錯矩陣在自有 S／N 儲存驗證，不清使用者資料 |
| P05 | 診斷、格式與資源 | 讀取診斷不啟動探測、不洩漏原始識別；DASH 現場與 MP4／FLV 合成分列；重複安裝／釋放、timer／subscription／reader 清理在 S／N 與實際自有資源核對 |
| C01 | 每窗清理 | 自有 held=0、攔截空、無自有未完請求／timer／listener／斷點／iframe／Blob、包裝按所有權還原；受控樣本記憶體／持久匹配為 0 |

B02～B06 的操作所有權情境按 1／2 倍分開保存。真正連續鍵盤重複、pointercancel、外部核心替換等若當下工具不能產生必要原生事件，該子項記錄無效原因，不能用 dispatchEvent 補通過。來源隔離與正式契約仍可提供各自範圍的證據。

網站在 30 秒前因普通 pause／error／外部換核心終止窗口時，只能評價對應撤銷契約；B05 完整期限沒有被測到。合法自有 reload 造成的暫時 SDK pause／空核心則依產品契約繼續觀察，不能把所有 pause 一律作廢。

<a name="controlled-faults"></a>

## 5. 故障注入、資料與清理

- 故障前先取得當前 video／audio 的歸因與精確請求範圍，只在記憶體比對 URL；不得以整個 CDN 主機或萬用媒體路徑阻擋音訊與其他網站工作。
- 僅持有送出前的自有匹配請求，不取消或重送已開始的網站請求。HTTPDNS／禁止路線案例先裝精確攔截，禁止拿真外送作封鎖驗證。
- gate 觀察器與游標在重新載入前準備；真實新請求、實際 pending 狀態與等待者必須有時間順序。若無法及時取得精確候選與安全攔截，停止該子項，不擴大攔截範圍或重設預算。
- 原生對照用自有合成頁的原生 Fetch／XHR；同片安裝版只改工具擁有的回應／Promise 邊界。合成 API 及媒體不得被寫入正式學習。
- 故障前先建立受控 transport／startup／challenge 工作 ID 的歸屬表與寫入抑制，沿用工作建立時的 ID，不只記錄網站 requestId。讀取完整資料只留本機記憶體，公開結果僅報數量與有界摘要。
- 每個可能提交證據的非同步尾端都收束後才解除抑制；若無法證明樣本隔離，該故障窗不得開始。不能事後清空全部學習資料掩蓋污染，也不能用舊快照覆蓋其他分頁新寫入。
- 設定變更只用產品既有命令；復原前確認該欄位仍為工具最後寫入的值，保留使用者或遠端的新修改。整體 reset／clear 不用於恢復測試初始狀態。
- 每個攔截立即登記 finally 清理。攔截生效期間持續處理事件，不在模型長等待時留住未服務的請求。事件截斷、失去連線或例外時先停止故障並收束自有請求；必要時卸載自有測試分頁後再撤除攔截。
- 跨工具呼叫的收集器以單一狀態物件保存游標、持有請求及錯誤，方法從該物件讀寫；不得假定重新指定外層變數會更新先前函式的閉包。先在自有合成端點驗證跨呼叫續讀／清理，再開網站故障。先保存取得的整批事件與暫停 ID，再進行可能失敗的分類；不匹配請求立即放行。
- 游標建立與首次排空在同一有界呼叫完成；每批完整 await 至 hasMore=false，不留下跨呼叫的背景 Promise。持有、finally 解除及解除後突發排空先在自有來源驗證；模型返回空隙超過後端容量會使窗口截斷，不能靠媒體樣本補成完整傳輸證據。
- 精確攔截須對應當前媒體／核心的實際新 video 請求；舊 latestRequested 清單不能單獨證明會命中。沒有實際匹配／持有就沒有施加故障，不能把健康播放算成受控恢復通過。
- 有期限的觀察器由所屬資源自動截止，第一次停止時保存實際終點並清理 timer／listener／subscription；晚到 stop 不延長窗口。觀察終點、工具返回及操作收尾分開記錄，停止後的資料不能補進有效窗口。
- 使用 [IabEventCollector](../scripts/iab-event-collector.mts) 時，每窗建立新實例，注入文件化的 CDP capability。放行錯誤保留請求所有權；只有相同 networkId 的原生終止證據才能另行確認結束。cleanup 完成不會消除已記錄的窗口錯誤。
- 指標先移入並重新量測可見進度列；按下後立即核對 dragging，未成立即釋放，不能先等完整長按時間。讀取到網站前提失效時，在同一工具呼叫內解除攔截並收尾，避免模型往返期間繼續持有。
- 保存方法完整描述子，只還原仍由工具持有的包裝；原為繼承方法則移除自有遮蔽，不覆寫其他腳本新包裝。
- 清理未完成會使本輪交付不通過，另列清理原因；不得先宣稱通過再把殘留交給下一輪。

### 剪貼簿校準與保護

P05 複製先用自有頁的唯一合成文字，以真正複製、真正貼上及預定讀回方式證明共同通道，再操作產品。`Get-Clipboard -Raw` 讀空且正常退出不代表內容真的為空；需另查原生存取是否成功。隔離層外讀回也不能假設與 IAB 使用同一剪貼簿，本輪已取得兩者不一致的證據。

覆寫前須能完整保存並復原實際複製通道的原格式；Windows 快照不能假設涵蓋 IAB 剪貼簿。原內容只留記憶體，復原前核對內容與可用變更序號仍屬本輪，保留使用者的新寫入；真空資料與空文字分開。通道沒有格式或序號能力時列限制，不以盲目清空取代復原。

目前按使用者明確決定，以 IAB 真正 Ctrl+V、剪貼簿 API 與當次完整報告逐字比較，不要求 PowerShell 讀回。原生 Clipboard API 可作只讀通道對照；不得使用會先改寫剪貼簿的工具貼上方法。只有原生對照證明平台換行轉換，才另列 LF／CRLF 相等，不能 trim 或重新序列化。校準最多 10 分鐘；共同通道或復原前提不成立就停止，不進產品判定，也不據此修復、升版或重複寫入。

實際 UI 不符即記本次不通過，但必須另分來源缺陷與管理器／通道未定位。GM 返回或完成回呼不是讀回證據；不得因逾時再寫一次或無條件使用第二條寫入路徑。直接 API 合成探針不是原生 UI 驗收，須有明確授權且只作定位；沒有新前提不重跑。

<a name="p05-原生優先驗證"></a>

### 解除延遲與剪貼簿寫入

解除受控延遲時立即清空原生攔截模式，確認之後沒有新的 `Fetch.requestPaused`，再觀察恢復。不得保留攔截並仰賴不連續輪詢逐筆放行。Network 截斷的完整時序窗口作廢；獨立媒體採樣只保留其直接證明的結果，不補算傳輸矩陣通過。

P05 原生優先寫入須由真正可信按鈕操作立即啟動；當次完整報告以 API 讀回與真正 Ctrl+V 雙重逐字比較，不 trim、不重序列化、不以完成提示代替讀回。完整項目快照只留記憶體，寫入收束且所有權相符才復原；原內容不寫檔。來源記憶體 UI 與實際安裝的完整本體／唯一 singleton 分列。已通過結果及先前 GM 通道限制見 [P05 修復報告](P05_COPY_FIX_REPORT.md)。

<a name="verdict"></a>

## 6. 結果、期限與停止規則

每個已執行案例分開記錄「窗口有效性」與「產品斷言」：

| 有效性 | 產品判定 | 報告用語 |
| --- | --- | --- |
| VALID | PASS | 通過，附預期／實際／證據 |
| VALID | FAIL | 不通過，附可重現缺陷與位置 |
| INVALID | 不作產品判定 | 本窗口作廢，列出工具／前提／證據缺口 |
| 尚未執行 | 無結果 | 列在本輪清單，不能填成 PASS 或 FAIL |

不使用「待驗收」取代具體結果。作廢不是產品失敗，也不是環境永遠不支援。已執行輪次的總結只說 **本輪範圍全部通過** 或 **本輪未取得完整通過**，後者必須列明：確認缺陷、作廢 ID、未執行 ID 與各自原因，不能把三者混成同一種問題。

- 同一版本／倍速／前提先做一個完整窗口；有效通過後不為湊次數重跑。
- 2026-10-13 已封存的 P01／P02 缺口不因自然前提或工具能力改變而自動恢復；須同時取得使用者明確恢復要求與指定影片自然 pending gate 的新前提。文件結案不將未執行情境填成 PASS。
- 無效窗口只有在新增必要前提、修正觀察器或來源變更後，才在同輪重跑一次；相同條件不重複消耗時間。仍無效便結束該項並交付原因。
- 背景與 gate 各預留最多 10 分鐘建立前提；沒有新證據就停止該項，繼續獨立案例。預設一輪最多 120 分鐘，最後 15 分鐘保留清理／報告；使用者明確指定其他期限時從其指示。
- 調查預算計實際瀏覽器執行，批准等待不計入。分別保存呼叫總間隔、執行、批准等待及未知時間；沒有分界就標未量測，不能用呼叫總間隔判執行超時。若含全部等待的上界仍低於預算，可據此判未超預算，但不得稱為純執行工時。批准或斷線破壞連續窗口時，先作廢並清理，不拼接前後證據。
- 找到新確認缺陷時先收束故障、保存最小案例與正常對照、精確來源位置、根因與修正方向，再停止擴大本輪範圍。不得把修復、重新發布或新矩陣默默併入這輪文件方案。
- 若只剩工具或自然前提問題，交付終局的本輪結果與具體再開條件，不持續循環「再試一次」。
- 只有本輪所有必測 ID／子項具有 VALID＋PASS 且 C01 通過，才可宣稱該範圍驗收完成。縮小範圍需明示；不能偷偷刪掉失敗／作廢行以結案。

<a name="evidence"></a>

## 7. 證據目錄與重跑入口

新一輪建立 `.work/iab-testing/<日期>-<版本>-<短提交>-<輪次>/`，保留原始歷史工作目錄。這是命名方案，目錄與執行器須在實際開跑時建立；本文件不宣稱已有一鍵 IAB 測試命令。

| 檔案 | 內容 |
| --- | --- |
| `BASELINE.json` | 基準、來源／產物雜湊、環境、版本／singleton、原狀態及預定 ID；不含 URL／憑證／播放器物件 |
| `CASES.json` | ID、層級、倍速、前提、開始／結束、validity、PASS／FAIL 或無產品判定、失效原因與證據指向 |
| `TIMELINE.jsonl` | 連續有界事件摘要、游標／截斷／丟失狀態；寫出前去除網址、路徑、查詢、cookie、IP、物件 |
| `CLEANUP.json` | held／patterns、自有資源、方法所有權、設定復原、受控樣本匹配數 |
| `CHECKPOINT.md` | 已完成 ID、問題、剩餘前提與下一個具體步驟；不把過期 tab/object ID 當續行入口 |
| `RERUN.md` | 使用的工具能力、操作序列、預期值與清理步驟；需重新解析當前實例／請求身分 |
| `REPORT.md` | 本輪二元總結、案例對照、確認缺陷與無效／未執行範圍 |
| `screenshots/` | 必要的可核對畫面；沒有畫面也不能用修改過的媒體 getter 冒充現場 |

CASES 的必要欄位：`id, level, version, bodySha256, rate, preconditions, validity, verdict, reason, expected, actual, evidence, cleanup`。verdict 只在 VALID 時為 PASS／FAIL，INVALID 時為 null；時限案例另寫實際 t0、第一次合資格 tick、備援／reload／終止次數與時間。報告不只保存最後狀態，也保存因果順序。

同一內容改寫後重新連線時，先讀 CHECKPOINT 並重新核對安裝本體，不能復用舊 singleton handle。持續觀察的缺口要明記；不能把兩個分開窗口拼成一個完整時限。

<a name="release"></a>

## 8. 修復、發布與後續執行

修復時先建立正式失敗契約，按差異選取 N／S／I 案例。必要自動驗證仍為 typecheck、architecture、npm test、verify、git diff --check；Codex Security 依安全敏感性或使用者要求另跑，不在 verify 內。

按 [AGENTS 發行規則](../AGENTS.md#release-rules) 完成已授權的功能修復交付；必要來源隔離同樣只在內建瀏覽器執行。公開產物核對與 I 層安裝驗收分別記錄。

Tampermonkey 更新先用內建瀏覽器開啟本儲存庫既有 [公開 latest 使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，再於新載入的指定影片核對完整本體與 singleton。v2.1.21 已以此流程成功取得新版；更新中繼頁本身不等於安裝成功。不能把「擴充功能介面受限」直接推論成「公開更新入口不能使用」。只有當次可用入口實際受阻或仍需使用者完成確認時，才請求必要手動步驟；不改用外部瀏覽器、不繞過工具限制。

只有使用者明確要求恢復 BR-01，才重新安排其專項矩陣；先核對新差異及可沿用證據，不重測已通過項目。一次結束便保存總結與清理，不自動建立排程或下一輪。

## 9. 依據與文件責任

- OpenAI 官方 [Browser 文件](https://learn.chatgpt.com/docs/browser?surface=app) 描述內建瀏覽器操作、分頁布局與受控 CDP；它沒有替本專案證明 Tampermonkey、實際背景或完整故障矩陣通過。
- 實際已知能力與撤回的背景判定：[2026-10-11 可用性報告](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md)。
- 產品契約：[PROJECT_CONTEXT](PROJECT_CONTEXT.md)；原生／偽裝可見性與所有權：[ARCHITECTURE](ARCHITECTURE.md#visibility-boundary)、[SECURITY](../SECURITY.md#browser-behavior)。
- 工作範圍與當前執行狀態只看 [TODO](TODO.md)；已取得的版本證據只看 [TEST_REPORT](TEST_REPORT.md) 與有日期的原始報告。
~~~~~~~~~~
