# 專案文件入口

本頁只負責導覽。產品版本以 [release.json](../release.json) 為準；工作狀態只看 [TODO](TODO.md)，驗收結果只看 [TEST_REPORT](TEST_REPORT.md)，歷史追溯由 [HISTORY](HISTORY.md) 進入。

## 閱讀路徑

先依目的選擇下列路徑；開始維護前先讀 TODO，確認本次工作範圍及停止／結案決策。

| 目的 | 閱讀順序 |
| --- | --- |
| 安裝、操作與排查 | [README](../README.md) |
| 開始修改程式 | [TODO](TODO.md) → [AGENTS](../AGENTS.md) → [PROJECT_CONTEXT](PROJECT_CONTEXT.md) → [SECURITY](../SECURITY.md) → [ARCHITECTURE](ARCHITECTURE.md) → [DEVELOPMENT](DEVELOPMENT.md) |
| 撰寫或執行測試 | [TODO](TODO.md) → [DEVELOPMENT 測試套件與隔離](DEVELOPMENT.md#test-suites-and-isolation)；涉及瀏覽器時再讀 [IAB_TESTING](IAB_TESTING.md)；結果與限制看 [TEST_REPORT](TEST_REPORT.md) |
| 準備發布 | [TODO](TODO.md) → [AGENTS 發行規則](../AGENTS.md#release-rules) → [DEVELOPMENT 封裝與發行](DEVELOPMENT.md#packaging-and-release)，並依 [發布文件更新順序](DEVELOPMENT.md#release-documentation) 準備文件 |
| 查舊版或舊議題 | [HISTORY](HISTORY.md) → 依版本、議題或日期進入原始報告 |

修改時需要更新哪些文件，直接查 [文件更新對照表](DEVELOPMENT.md#documentation-update-map)。

## 現行指南

| 文件 | 唯一維護內容 |
| --- | --- |
| [README](../README.md) | 安裝、操作、預設設定、排查與使用者可見功能 |
| [AGENTS](../AGENTS.md) | 強制流程、不變量與授權界線 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 現行產品行為、模式、救援政策與資格 |
| [ARCHITECTURE](ARCHITECTURE.md) | 分層、內部介面、資料流、狀態及副作用所有權 |
| [SECURITY](../SECURITY.md) | 信任邊界、安全要求與平台限制 |
| [DEVELOPMENT](DEVELOPMENT.md) | 環境、命令、測試、建置、發布與文件維護 |
| [IAB_TESTING](IAB_TESTING.md) | 校準、隔離、批准等待、判定、清理及停止規則 |
| [TODO](TODO.md) | 當前工作、批准範圍及停止／結案狀態 |
| [TEST_REPORT](TEST_REPORT.md) | 最新版完整證據、結果與限制 |
| [CHANGELOG](CHANGELOG.md) | 各版行為差異與證據入口 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游、來源基準及 v1／v2 關係 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權及工具用途 |
| [測試遷移](../tests-v2/MIGRATION.md) | 原測試行為與遷移對照 |

## 證據與歷史

[歷史索引](HISTORY.md) 涵蓋原始版本報告、議題、日期、[工具驗證](TEST_TOOLING_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md) 與封存。歷史原文中的「目前」「待完成」只描述當時版本，不構成新工作授權。

## 檔案配置

既有版本紀錄維持原路徑；新增紀錄、發布文件與正文保護的維護方式統一見 [DEVELOPMENT](DEVELOPMENT.md#documentation-maintenance)。

[文件清單](doc-manifest.json) 保存分類、權威、相容錨點與保護基準，不保存產品結果。`npm run docs:check` 只讀檢查；舊 Release 的不可變斷鏈及外部連結限制另外列出。

## 舊連結導引

<a name="br01-followthrough-status"></a>

<a name="p05-v2122-本輪交付"></a>

<a name="2026-10-03-文件維護紀錄"></a>

<a name="2026-10-03-第一次封存整理紀錄"></a>

<a name="2026-10-03-根目錄文件集中整理"></a>

<a name="專案文件索引與維護規則"></a>

<a name="發行與驗證紀錄"></a>

<a name="歷史計畫與瀏覽器紀錄"></a>

<a name="iab調查與結案紀錄"></a>

<a name="已撤銷的-cdn-新增研究"></a>

<a name="不回寫的歷史資料"></a>

<a name="維護對照"></a>

<a name="文件整理歷史導覽"></a>

以上舊章節入口保留相容；歷史正文與版本／議題／日期導覽見 [HISTORY](HISTORY.md)。目前工作狀態只看 [TODO](TODO.md)。
