# 專案文件入口

本頁只負責導覽。產品版本以 [release.json](../release.json) 為準；工作狀態只看 [TODO](TODO.md)，驗收結果只看 [TEST_REPORT](TEST_REPORT.md)。

## 閱讀路徑

- 使用者：[安裝與操作](../README.md)。
- 開發者：[必要流程](../AGENTS.md) → [產品契約](PROJECT_CONTEXT.md) → [安全](../SECURITY.md) → [架構](ARCHITECTURE.md) → [開發流程](DEVELOPMENT.md)。
- 測試：[工作範圍](TODO.md) → [瀏覽器方法](IAB_TESTING.md) → [實測結果](TEST_REPORT.md)。
- 追溯：[HISTORY](HISTORY.md)，按版本、議題或日期找原始紀錄。

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

既有版本紀錄維持原路徑。新的一般修復只更新當版 TEST_REPORT，不再分開建立多份 FIX／ACCEPTANCE／CONTINUATION；必要的獨立調查或設計才放入按版本分類的紀錄目錄。維護方式見 [DEVELOPMENT](DEVELOPMENT.md#documentation-maintenance)。

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
