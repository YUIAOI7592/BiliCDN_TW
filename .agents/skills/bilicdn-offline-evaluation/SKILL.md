---
name: bilicdn-offline-evaluation
description: 在明確要求時執行 BiliCDN 上游比較、選路或提前重試離線模型，固定來源並區分模型完成與效益判定；不自動啟動實機研究。
---

# BiliCDN 離線評估

儲存庫根目錄位於本檔目錄向上三層。先確認當次問題及 [TODO](../../../docs/TODO.md) 的停止狀態，遵守 [AGENTS](../../../AGENTS.md)。使用既有正式腳本，不恢復已退役診斷／IAB 執行器，不執行歷史 loopback 模式。

## 選擇模式

先讀[模型、來源與限制](references/models.md)的相應章節；按[當次 Runtime](../bilicdn-verify-change/references/runtime-and-commands.md#環境需求)從根目錄執行，只選能回答已授權問題的模式。選路入口只用下表的無參數或單一選項，另核對輸出的模式／scope，不依退出 0 推論參數已被嚴格驗證。

| 目的 | 入口 |
| --- | --- |
| 固定原版與 v2 完整腳本比較 | 先 `npm run compare:upstream -- --calibrate`，再 `npm run compare:upstream -- --json` |
| 提前重試六情境效用 | `npm run evaluate:early-retry -- --json` |
| 原選路十場景對照 | `npm run evaluate:routing` |
| 優化條件與未來結果 | `npm run evaluate:routing -- --optimization` |
| 請求完成期限對照 | `npm run evaluate:routing -- --deadlines` |
| 量測數字與公式對照 | `npm run evaluate:routing -- --measurement` |

不因工具可用而恢復已暫緩的效益研究。獨立評估不加入 verify 的全綠，也不將舊原件加入正式 v2 建置或契約測試。

## 執行與結果

先核對固定基準、輸入、選項、期限、退出碼及必要本機 Git 物件；缺失就記錄限制，不網路補抓或換成其他版本。模型使用既定合成資料，不讀正式 GM、簽名媒體或網站私人狀態，不為取得介入放寬產品資格。

區分模型成功執行、公式一致、效用門檻與實機結論。退出 0 的含義依模式；提前重試效用 FAIL 不能改成預期失敗，未知／未模擬欄位不補零，合成符合比例不當現場適用率。

工具不自動寫結果檔；必要時導向當輪 .work，結案依[保存分類](../bilicdn-archive-workspace/references/layout-and-retention.md#工作資料與結案)處理。公開報告按日期／版本登記並由 HISTORY 導覽，僅保留精確允許的合成 JSON。輸出記錄來源／輸入雜湊、模式、結果、假設及限制，不新增產品計數器或公開取證介面。

瀏覽器校準及效益取證另依當次授權使用 [IAB Skill](../bilicdn-iab-validation/SKILL.md)，離線完成不自動產生新窗口或產品採用決定。
