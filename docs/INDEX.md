# 專案文件入口

本頁只負責導覽。產品版本以 [release.json](../release.json) 為準；工作狀態只看 [TODO](TODO.md)，驗收結果只看 [TEST_REPORT](TEST_REPORT.md)，歷史追溯由 [HISTORY](HISTORY.md) 進入。

## 閱讀路徑

先依目的選擇下列路徑；開始維護前先讀 TODO，確認本次工作範圍及停止／結案決策。

| 目的 | 閱讀順序 |
| --- | --- |
| 安裝、操作與排查 | [README](../README.md) |
| 研究剩餘 TODO 如何優化 | [v2.2.11 基準研究](../archive/retired/docs/TODO_OPTIMIZATION_RESEARCH_v2.2.11_2026-11-07.md#研究結論) → [建議順序與風險](../archive/retired/docs/TODO_OPTIMIZATION_RESEARCH_v2.2.11_2026-11-07.md#建議執行順序與風險) → [目前工作](TODO.md#剩餘-todo-優化研究)；[本版實作對照](TEST_REPORT.md#政策與契約對照)，未實作建議與實測仍分開 |
| UP141 歷史測試操作 | [v2.1.38 操作表](../archive/retired/docs/UP141_TEST_RELEASE_2026-10-30.md) → [對應完整報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2138-完整正文保存2026-10-31)；不構成新輪次授權 |
| 研究選路與開源方案 | [Auto 與選路數學模型](../archive/retired/docs/AUTO_CDN_MATHEMATICAL_MODEL_v2.2.8_2026-11-04.md#研究結論) → [參數驗證及保留資料](../archive/retired/docs/AUTO_CDN_MATHEMATICAL_MODEL_v2.2.8_2026-11-04.md#模型參數驗證與保留資料結果) → [既有選路研究](../archive/retired/docs/ROUTING_ALGORITHM_RESEARCH_v2.2.6_2026-11-03.md#研究結論) → [現行架構](ARCHITECTURE.md#選路與傳輸)；研究與採用狀態看 [TODO](TODO.md) |
| 校準 Auto 與換站收益 | [來源及收益界限](../archive/retired/docs/AUTO_CDN_MATHEMATICAL_MODEL_v2.2.8_2026-11-04.md#auto-結構識別與換站收益界限) → [編碼／分段期限](../archive/retired/docs/AUTO_CDN_MATHEMATICAL_MODEL_v2.2.8_2026-11-04.md#編碼能力與分段期限的離線驗證) → [逐筆時序核對](../archive/retired/docs/AUTO_CDN_MATHEMATICAL_MODEL_v2.2.8_2026-11-04.md#完成時間的逐筆時序核對) → [目前工作](TODO.md#auto-決策與換站收益校準)；觀察、合成重建與未識別參數分開閱讀 |
| 熔斷現行規則 | [狀態與期限](ARCHITECTURE.md#熔斷與降級觀察) → [原版完整驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-完整正文保存2026-11-07) → [執行紀錄](../archive/retired/docs/CIRCUIT_OBSERVATION_v2.2.11_2026-11-06.md) |
| 核對 v2.2.11 驗收輪次 | [R1 原判定](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r1-熔斷安裝驗收2026-11-06) → [R2 受控整合與安裝接線](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r2-受控熔斷與安裝接線2026-11-06)；證據層級、方法偏差及未測範圍由同一報告維護 |
| 研究熔斷與恢復 | [現況及研究結論](../archive/retired/docs/CIRCUIT_BREAKER_RESEARCH_v2.2.10_2026-11-05.md#研究結論) → [候選政策與模型](../archive/retired/docs/CIRCUIT_BREAKER_RESEARCH_v2.2.10_2026-11-05.md#候選政策與模型結果) → [瀏覽器限制](../archive/retired/docs/CIRCUIT_BREAKER_RESEARCH_v2.2.10_2026-11-05.md#來源隔離與安裝版執行情況)；工作狀態只看 [TODO](TODO.md) |
| 開始修改程式 | [TODO](TODO.md) → [AGENTS](../AGENTS.md) → [ARCHITECTURE](ARCHITECTURE.md) → [SECURITY](../SECURITY.md) → [DEVELOPMENT](DEVELOPMENT.md) |
| 撰寫或執行測試 | [TODO](TODO.md) → [DEVELOPMENT 測試套件與隔離](DEVELOPMENT.md#測試套件與隔離)；涉及瀏覽器時再讀 [IAB_TESTING](IAB_TESTING.md)；結果與限制看 [TEST_REPORT](TEST_REPORT.md) |
| 準備發布 | [TODO](TODO.md) → [AGENTS 發行規則](../AGENTS.md#發行規則) → [DEVELOPMENT 封裝與發行](DEVELOPMENT.md#封裝與發行)，並依 [發布文件更新順序](DEVELOPMENT.md#發布文件更新順序) 準備文件 |
| 查舊版或舊議題 | [HISTORY](HISTORY.md) → 依版本、議題或日期進入原始報告 |
| 核對自動驗證、發布與安裝結果 | [TEST_REPORT 驗收結論](TEST_REPORT.md#驗收結論) → [v2.2.12 R1 三頁／刷新專項](TEST_REPORT.md#v2212-r1-三頁與刷新專項2026-11-08)；目前工作與停止決策回到 [TODO](TODO.md) |
| 核對 v2.2.10 安裝輪次 | [原版結論](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-完整正文保存2026-11-06) → [R3 播放與 UI](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r3-補驗2026-11-05) → [R4 正數 timeout](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r4-正數-timeout-專項2026-11-05)；R1／R2 原判定由 [HISTORY](HISTORY.md#v2210-安裝驗收與工具限制2026-11-05) 進入 |
| 核對文件是否落後或矛盾 | [TODO](TODO.md) → [TEST_REPORT](TEST_REPORT.md) → [狀態與矛盾核對](DEVELOPMENT.md#狀態與矛盾核對) → [HISTORY](HISTORY.md)；修正權威內容，其他入口維持導引 |

修改時需要更新哪些文件，直接查 [文件更新對照表](DEVELOPMENT.md#文件更新對照表)。

## 現行指南

| 文件 | 唯一維護內容 |
| --- | --- |
| [README](../README.md) | 安裝、操作、預設設定、排查與使用者可見功能 |
| [AGENTS](../AGENTS.md) | 強制流程、不變量與授權界線 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 舊產品錨點相容導引，正文由 ARCHITECTURE 維護 |
| [ARCHITECTURE](ARCHITECTURE.md) | 產品模式、預設、流程、分層、契約及所有權 |
| [SECURITY](../SECURITY.md) | 信任邊界、安全要求與平台限制 |
| [DEVELOPMENT](DEVELOPMENT.md) | 環境、命令、測試、建置、發布與文件維護 |
| [離線評估](../scripts/evaluation/README.md) | 固定基準、專項操作、期限與退出碼 |
| [IAB_TESTING](IAB_TESTING.md) | 單分頁、靜音、校準、隔離、期限、判定及清理規則 |
| [TODO](TODO.md) | 當前工作、批准範圍及停止／結案狀態 |
| [TEST_REPORT](TEST_REPORT.md) | 最新版完整證據、結果與限制 |
| [CHANGELOG](CHANGELOG.md) | 各版行為差異與證據入口 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游、來源基準及 v1／v2 關係 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權及工具用途 |
| [測試遷移](../tests-v2/MIGRATION.md) | 原測試行為與遷移對照 |

## 證據與歷史

[歷史索引](HISTORY.md) 涵蓋原始版本報告、議題、日期、[工具驗證](TEST_TOOLING_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md) 與封存。歷史原文中的「目前」「待完成」只描述當時版本，不構成新工作授權。

多階段報告中的未發布／阻塞段落與後續完成段落屬不同檢查點；查現況先回到 TODO 與 TEST_REPORT。發行快照只保存封裝當時，後續安裝結果寫入現行報告；工具、來源隔離、安裝行為與效用結論按各自範圍閱讀。歷史證據不因文件整理改寫，全文快照、後續追加與各次逐檔核對由 [文件維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) 追溯。

## 檔案配置

[目錄結構、檔案分類與工作資料結案](DEVELOPMENT.md#儲存庫配置與封存維護) 統一由 DEVELOPMENT 維護；原始正文與固定提交入口見 [HISTORY 的封存與快照](HISTORY.md#封存與快照)。

## 舊連結導引

<a name="維護對照"></a>

此入口供既有維護日誌追溯；歷史正文與版本／議題／日期導覽見 [HISTORY](HISTORY.md)。目前工作狀態只看 [TODO](TODO.md)。
