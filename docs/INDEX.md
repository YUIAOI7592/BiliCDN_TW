# 專案文件索引與維護規則

更新：2026-10-13。現行版本 **v2.1.23**，依 [release.json](../release.json)、[package.json](../package.json)、[package-lock.json](../package-lock.json) 與 [src-v2](../src-v2/entry.ts) 核對。

**v2.1.23 修復與發布完成。** CR-01～05 及原生確認的 S-01／S-03 共七項已修復，正式 841／841、verify、安全差異 0 發現及 IAB 原生 11 組來源對照通過。公開最新產物核對一致；使用者更新後完整新版本體、唯一 singleton 及 hooks 身分核對通過，不代替整份安裝功能矩陣。發布／安裝與限制分列於 [修復報告](CR01_CR05_FIX_REPORT.md)；[原調查](CODE_REVIEW_2026-10-13.md) 的失敗與當時判定保留。

**稍早的 TODO 證據核對與文件結案維持有效。** 已通過案例沿用；P01 bounded prepare／P02 真 gate 前提未成立，限制封存；P03 依原方案分列 Node、來源隔離與同片安裝證據，不再擴大安裝門檻。當時沒有已批准的自主接續測試，現在另有上述新調查結果。缺證據情境未改記通過，也沒有重測；詳見 [2026-10-13 結案紀錄](TODO_CLOSURE_2026-10-13.md)。

**目前決定：依使用者要求跳過 BR-01。** 剩餘專項驗收已退出現行待辦，不再自主續測或阻擋其他工作／發布；既有修復、正式回歸及證據保留，不把跳過改記為通過。只有使用者明確要求才恢復。現行範圍以 [TODO](TODO.md) 為準，下方逐輪結果保留當時判定。

**BR-10 修復、v2.1.21 發布及安裝入口驗證通過。** 控制中心正式套件 17／17、全套 788／788；獨立安全差異審查 0 發現。來源及公開 latest 核對通過。代理由內建瀏覽器公開網址觸發更新，實際新版 Auto 1／2 倍 Enter／Space 四案、P04 關閉／切頁兩案與 P05 完整報告通過。見 [修復報告](BR10_FIX_REPORT.md)。

**歷史 v2.1.21 P05 實際複製不通過，GM 通道根因未定位。** 使用者改採 IAB 真正貼上與讀回後，合成對照及完整快照復原通過；當次 18,150 字元報告與兩種讀回的原文字 61 字元不符。批准的單次 GM 純文字校準有完成通知但仍未變；原內容與自有資源保護完成，沒有推測性產品修改或新發布。見 [本輪結果](P05_COPY_IAB_RESULT_2026-10-12.md)，先前 [PowerShell 調查](P05_COPY_CHANNEL_REPORT_2026-10-12.md) 保留原判定。

**今後所有瀏覽器測試只用 Codex 內建瀏覽器＋Tampermonkey。** 唯一方案是 [IAB_TESTING](IAB_TESTING.md)；[TODO](TODO.md) 記錄目前狀態，[TEST_REPORT](TEST_REPORT.md) 記錄版本證據。先前 [收集器修復與第 5 輪](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md) 完成工具隔離驗證及 30 個 tooling 契約，新增 B02 滑鼠 1 倍 30 秒尾段、P03 同片自然 cid／epoch 通過，該輪沒有新確認的產品缺陷。其他失效窗口按前提停止，最終資源及分頁清理完成；前 4 輪有效結果沿用，固定矩陣未完整通過。只改工具、測試與文件，沒有產品來源修改、升版或發布。

[內建瀏覽器可用性紀錄](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md) 已確認一般操作、完整腳本身分與合成傳輸能力；背景窗口已作廢並撤回能力失敗判定。它不等於 BR-01 完整通過。歷史 Chrome 報告維持原環境，不改名成 IAB 證據。

閱讀順序：

- 使用者：README → 模式／設定／排查。
- 開發者：AGENTS → PROJECT_CONTEXT → SECURITY → ARCHITECTURE → DEVELOPMENT。
- 測試：TODO → IAB_TESTING → 對應版本 TEST_REPORT／原始證據。
- 追溯：本頁下方版本目錄 → 修復／安裝報告 → 封存與 Release 快照。

## 現行指南

| 文件 | 主要責任 |
| --- | --- |
| [README](../README.md) | 安裝、功能、四種模式、控制中心、排查及隱私 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 產品契約、不變量及已確定交付邊界 |
| [AGENTS](../AGENTS.md) | 必要開發流程、架構、安全及發行／文件要求 |
| [ARCHITECTURE](ARCHITECTURE.md) | 依賴、狀態、控制器、適配器、生命週期與診斷 |
| [DEVELOPMENT](DEVELOPMENT.md) | 環境、命令、測試隔離、建置、瀏覽器檢查及封裝 |
| [IAB_TESTING](IAB_TESTING.md) | 唯一瀏覽器測試方案；固定矩陣、真背景校準、資料隔離、判定及停止條件 |
| [TEST_REPORT](TEST_REPORT.md) | 最新版自動、安全、來源隔離、發布與實際安裝證據 |
| [CR-01～05 與 XHR 修復](CR01_CR05_FIX_REPORT.md) | v2.1.23 七項修復、33 個新增契約、安全與 IAB 原生對照；S-02 保留未確認 |
| [整體程式碼檢查](CODE_REVIEW_2026-10-13.md) | v2.1.22／c4e7de4 的 46 檔覆蓋、5 個新缺陷、3 個原生待證疑點及本機重現；只調查不修復 |
| [TODO 證據核對與結案](TODO_CLOSURE_2026-10-13.md) | 2026-10-13 逐項證據、P01／P02 限制封存、P03 範圍更正；不新增功能通過判定 |
| [IAB 可用性紀錄](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md) | 2026-10-11 能力實測與背景窗口作廢原因 |
| [BR-01 IAB 第 1 輪](IAB_v2.1.20_BR01_R1_2026-10-11.md) | v2.1.20 的新安裝／來源證據、完整期限通過及明確缺口 |
| [BR-01 IAB 第 2 輪](IAB_v2.1.20_BR01_R2_2026-10-11.md) | 新操作、inner 拖曳、晚到 SDK、等待中政策撤銷與獨立 XHR 子集；累計缺口見 TODO |
| [IAB TODO 第 3 輪](IAB_v2.1.20_TODO_R3_2026-10-11.md) | XHR 同步／取消、雙分頁設定與診斷子項；工具／自然前提不足時停止，不重測既有通過案例 |
| [IAB TODO 第 4 輪](IAB_v2.1.20_TODO_R4_2026-10-11.md) | 19 項新增通過、兩次 B02 無效窗口與工具閉包對照；最終清理完成 |
| [收集器修復與 IAB 第 5 輪](IAB_v2.1.20_COLLECTOR_R5_2026-10-11.md) | 工具契約／隔離、B02 滑鼠 1 倍尾段與 P03 同片通過；其他前提中斷後停止 |
| [BR-10 與 IAB 第 6 輪](IAB_v2.1.20_BR10_CONTROL_CENTER_KEYBOARD.md) | 非 BR-01 TODO 續行；控制中心 Enter／Space 衝突的安裝證據、來源對照與修正方向 |
| [BR-10 修復與發布](BR10_FIX_REPORT.md) | 鍵盤隔離修復、正式契約、安全及來源／安裝 UI 證據 |
| [P05 剪貼簿通道調查](P05_COPY_CHANNEL_REPORT_2026-10-12.md) | 2026-10-12 真正複製／貼上與 PowerShell 不一致的校準、停止原因及清理限制；無產品修改 |
| [P05 IAB 實際複製結果](P05_COPY_IAB_RESULT_2026-10-12.md) | 改用 IAB 門檻後的全文不符、單次 GM 格式校準及完整原內容保護；本次不通過，根因未定位 |
| [P05 原生複製修復](P05_COPY_FIX_REPORT.md) | v2.1.22 修復、發布與實際全文讀回／貼上通過；原 GM 限制保留 |
| [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md) | 測試遷移、套件登記、XHR 原生替身及 BR-07 keydown／keyup 提交階段校準 |
| [測試遷移對照](../tests-v2/MIGRATION.md) | 原 891 項功能斷言的行為群組、分支及參數矩陣對照 |
| [SECURITY](../SECURITY.md) | 信任邊界、持久資料、網路權限及診斷限制 |
| [TODO](TODO.md) | 目前已批准工作、結案事項及未安排方向 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游基準、v1／v2 關係及來源校驗 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權、工具用途及版本 |

現行指南以繁體中文維護；識別字、命令及原始狀態值保留英文。歷史正文不翻譯或重寫，標題改名保留被引用錨點。「儲存元件」「測試情境」「建立函式」「中繼資料」「原始碼對照」「報告產生器」「堆疊資訊」用語保持一致；瀏覽器攔截與測試清理掛鉤分開描述。

Markdown 格式依 [GFM 約定](DEVELOPMENT.md#markdown-format) 維護；格式整理檢查實際解析與連結，不改動歷史結果、程式碼、Release 快照或不可變封存。

2026-10-12 已盤點 170 份公開 Markdown，核對 18 份現行文件／入口並補齊過期內容；全量格式、連結、來源事實及受保護資料結果見 [本次文件核對紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-12-全量文件現況核對)。這項文件檢查不產生新的功能驗收。

## 檔案配置

根目錄保留 README、AGENTS、SECURITY、LICENSE 與必要設定；現行指南集中 docs。封裝固定讀取 CHANGELOG、TEST_REPORT，兩者連到儲存庫文件使用完整 GitHub URL。Release／baseline／封存不作 v2 建置或測試輸入。

本次整理前的九份指南完整保存於 [IAB_GUIDES_BEFORE_2026-10-11](../archive/retired/docs/IAB_GUIDES_BEFORE_2026-10-11.md)，包括當時尚未提交的能力核對文字；它只作歷史快照，不是下一輪操作方案。[文件維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) 追加本次實際檢查，[封存總覽](../archive/README.md) 與 [退出流程資料](../archive/retired/README.md) 保留原配置。

<a name="br01-followthrough-status"></a>

## 發行與驗證紀錄

本表只說明各版報告的用途。過去「未修復」「正在續行」「待安裝」等文字描述當時時間點，不能覆蓋目前 TODO。新版整份矩陣沒有取得有效通過時，不以修復發布或舊子項代替。

| 版本／範圍 | 修復與調查 | 實際安裝／階段紀錄 |
| --- | --- | --- |
| v2.1.22 | [P05 原生優先](P05_COPY_FIX_REPORT.md)、[最新版完整驗證](TEST_REPORT.md) | 本輪來源／安裝分列 |
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

- [CHANGELOG](CHANGELOG.md)：各版功能差異與當時驗證狀態。
- [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md)：固定報告換版時保存的歷史完整正文。
- [v2.1.21 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.21)、[Release/v2.1.21](../Release/v2.1.21/)：歷史已發布產物與不可回寫的封裝快照；唯一公開附件為使用者腳本。較早版本沿上表與 Release 目錄追溯。
- [DOC_MAINTENANCE_HISTORY](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)：文件維護與檢查，不等同新程式測試。

v2.1.6 驗收已批准通過、已結案；歷史覆蓋限制不轉為現行待辦。BR-01 原 87.785 秒自然網路起因與完整產品交叉回歸分開，不作救援修復的隱含新增門檻。

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

## P05 v2.1.22 本輪交付

**P05 修復、發布及實際安裝驗收通過。** 控制中心 37／37、全套 808／808、verify、安全差異及來源讀回／貼上通過，公開產物一致。更新後完整 v2.1.22 本體及唯一實例核對通過，真實 UI 的 31,204 字元報告讀回／真正貼上全文相符，全部原剪貼簿及自有資源清理通過。詳見 [P05 修復報告](P05_COPY_FIX_REPORT.md)。BR-01 保持跳過；P01／P02 依本日結案決定限制封存。
