# 專案文件入口

本頁只負責導覽。產品版本以 [release.json](../release.json) 為準；工作狀態只看 [TODO](TODO.md)，驗收結果只看 [TEST_REPORT](TEST_REPORT.md)，歷史追溯由 [HISTORY](HISTORY.md) 進入。

## 閱讀路徑

先依目的選擇下列路徑；開始維護前先讀 TODO，確認本次工作範圍及停止／結案決策。

| 目的 | 閱讀順序 |
| --- | --- |
| 安裝、操作與排查 | [README](../README.md) |
| 理解選路、熔斷、恢復與資料顯示 | [ARCHITECTURE](ARCHITECTURE.md)；使用者操作回到 README，安全要求見 SECURITY |
| 研究選路、Auto、熔斷或提前重試效益 | [HISTORY 議題](HISTORY.md#議題) → 該議題的原始研究與限制；是否已採用或啟動只看 TODO |
| 開始修改程式 | [TODO](TODO.md) → [AGENTS](../AGENTS.md) → [ARCHITECTURE](ARCHITECTURE.md) → [SECURITY](../SECURITY.md) → [變更驗證 Skill](../.agents/skills/bilicdn-verify-change/SKILL.md) |
| 維護代理指引或純文件 | [AGENTS](../AGENTS.md) → [文件維護 Skill](../.agents/skills/bilicdn-maintain-docs/SKILL.md) → 受影響議題的權威文件與事實來源 |
| 撰寫或執行測試 | [TODO](TODO.md) → [測試契約與隔離](../.agents/skills/bilicdn-verify-change/references/test-contracts.md)；涉及瀏覽器時讀 [IAB Skill](../.agents/skills/bilicdn-iab-validation/SKILL.md)，結果與限制看 [TEST_REPORT](TEST_REPORT.md) |
| 判斷驗證門檻是否適用 | [變更驗證範圍](../.agents/skills/bilicdn-verify-change/SKILL.md#依變更選擇驗證範圍) → [IAB 門檻適用表](../.agents/skills/bilicdn-iab-validation/references/assertions-and-evidence.md#門檻的適用範圍)；每項要求對應斷言、證據及受影響範圍 |
| 準備發布 | [TODO](TODO.md) → [AGENTS 發行規則](../AGENTS.md#發行規則) → [發行 Skill](../.agents/skills/bilicdn-release/SKILL.md) |
| 查舊版或舊議題 | [HISTORY](HISTORY.md) → 依版本、議題或日期進入原始報告 |
| 核對自動驗證、發布與安裝結果 | [TEST_REPORT 驗收結論](TEST_REPORT.md#驗收結論)；舊版本與各輪原判定由 [HISTORY 版本](HISTORY.md#版本) 進入 |
| 核對文件是否落後或矛盾 | [TODO](TODO.md) → [TEST_REPORT](TEST_REPORT.md) → [狀態與矛盾核對](../.agents/skills/bilicdn-maintain-docs/SKILL.md#全面檢討) → [HISTORY](HISTORY.md)；修正權威內容，其他入口維持導引 |

修改時需要更新哪些文件，直接查 [文件更新對照表](../.agents/skills/bilicdn-maintain-docs/references/update-map.md#依變更選擇權威)。

新版本或研究只在 HISTORY 登記版本、議題與日期入口；本表不逐版累積第二份報告目錄。避免重複與過時規則的操作方式見[更新現有段落](../.agents/skills/bilicdn-maintain-docs/references/update-map.md#維護既有段落)。

## 專案 Skills

流程只由以下六個 Skill 維護，支援按任務自動選用或以名稱明確呼叫；名稱及描述先供選擇，正文與 references 按需閱讀。這些入口不提供新授權，也不恢復已停止工作。

| Skill | 唯一維護流程 |
| --- | --- |
| [bilicdn-verify-change](../.agents/skills/bilicdn-verify-change/SKILL.md) | Runtime、契約、測試、建置及變更驗證 |
| [bilicdn-iab-validation](../.agents/skills/bilicdn-iab-validation/SKILL.md) | IAB 身分、播放、證據、故障及清理 |
| [bilicdn-release](../.agents/skills/bilicdn-release/SKILL.md) | 換版文件順序、正式封裝與公開交付 |
| [bilicdn-maintain-docs](../.agents/skills/bilicdn-maintain-docs/SKILL.md) | 文件／Skills 檢討、登記、引用及結案 |
| [bilicdn-archive-workspace](../.agents/skills/bilicdn-archive-workspace/SKILL.md) | 工作區分類、封存、清理及還原 |
| [bilicdn-offline-evaluation](../.agents/skills/bilicdn-offline-evaluation/SKILL.md) | 固定基準比較、模型模式、退出碼與效用限制 |

## 現行指南

以下列出指南及持續維護的入口、狀態與紀錄；歷史日誌中的規則按當時日期閱讀。

| 文件 | 唯一維護內容 |
| --- | --- |
| [README](../README.md) | 安裝、操作、預設設定、排查與使用者可見功能 |
| [AGENTS](../AGENTS.md) | 強制流程、不變量與授權界線 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 舊產品錨點相容導引，正文由 ARCHITECTURE 維護 |
| [ARCHITECTURE](ARCHITECTURE.md) | 產品模式、預設、流程、分層、契約及所有權 |
| [SECURITY](../SECURITY.md) | 信任邊界、安全要求與平台限制 |
| [TODO](TODO.md) | 當前工作、批准範圍及停止／結案狀態 |
| [TEST_REPORT](TEST_REPORT.md) | 最新版完整證據、結果與限制 |
| [CHANGELOG](CHANGELOG.md) | 各版行為差異與證據入口 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游、來源基準及 v1／v2 關係 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權及工具用途 |
| [HISTORY](HISTORY.md) | 版本、議題、日期與封存導覽 |
| [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md) | 按日期追加的實際工具環境、驗證結果與方法限制 |
| [doc-manifest.json](doc-manifest.json) | 文件／Skills 分類、權威、錨點、版本欄位與原文保護；維護方式見文件維護 Skill |
| [測試遷移](../tests-v2/MIGRATION.md) | 原測試行為與遷移對照 |

## 證據與歷史

[歷史索引](HISTORY.md) 涵蓋原始版本報告、議題、日期、[工具驗證](TEST_TOOLING_REPORT.md)、[完整歷史驗證](../archive/retired/docs/TEST_REPORT_HISTORY.md) 與封存。歷史原文中的「目前」「待完成」只描述當時版本，不構成新工作授權。

多階段報告中的未發布／阻塞段落與後續完成段落屬不同檢查點；查現況先回到 TODO 與 TEST_REPORT。工具日誌並非全篇依日期排序，早期導言中的「最新」亦屬原檢查點，不能代替後續日期紀錄。發行快照只保存封裝當時，後續安裝結果寫入現行報告；工具、來源隔離、安裝行為與效用結論按各自範圍閱讀。歷史證據不因文件整理改寫，全文快照、後續追加與各次逐檔核對由 [文件維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) 追溯。

## 檔案配置

[目錄結構、檔案分類與工作資料結案](../.agents/skills/bilicdn-archive-workspace/references/layout-and-retention.md#儲存庫配置) 由工作區封存 Skill 維護；原始正文與固定提交入口見 [HISTORY 的封存與快照](HISTORY.md#封存與快照)。

## 舊連結導引

<a name="維護對照"></a>

此入口供既有維護日誌追溯；歷史正文與版本／議題／日期導覽見 [HISTORY](HISTORY.md)。目前工作狀態只看 [TODO](TODO.md)。
