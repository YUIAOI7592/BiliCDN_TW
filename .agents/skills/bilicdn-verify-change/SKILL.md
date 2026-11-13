---
name: bilicdn-verify-change
description: 修改 BiliCDN 的來源、測試或維護工具時，選擇契約、執行驗證並說明證據範圍；純文件維護使用 bilicdn-maintain-docs。
---

# BiliCDN 變更驗證

本 Skill 是開發與驗證方法的入口。從本檔所在目錄向上三層取得儲存庫根目錄，所有命令在該根目錄執行；不固定磁碟、使用者名稱或 Runtime 路徑。

## 開始與選擇範圍

先核對工作樹、當次要求及 [TODO](../../../docs/TODO.md)，遵守 [AGENTS](../../../AGENTS.md)。修改程式前讀 [架構契約](../../../docs/ARCHITECTURE.md) 與 [安全邊界](../../../SECURITY.md)，保留無關變更。

1. 修復先用領域層、控制器或適配器契約重現失敗；保持行為的重構先讓原實作通過具名契約，不虛構紅燈。
2. 依變更選擇所屬案例及下表門檻；新增測試、全域替換、計時器或非同步交錯時讀[測試契約](references/test-contracts.md)。
3. 執行命令前讀 [Runtime 與命令](references/runtime-and-commands.md)，確認入口不啟動本機網站服務。使用 apply_patch 修改來源。
4. 完成對應套件，再對最終差異執行完整 verify；失敗先修正並重驗受影響範圍，同一最終差異通過後不逐項重跑。

## 依變更選擇驗證範圍

| 工作 | 必要驗證 | 證據界線 |
| --- | --- | --- |
| 來源、測試或工具 | 修改前相應契約、修改後對應套件及 `npm run verify` | 單項通過不能代替 verify；不刪案例或降低斷言 |
| 安全敏感差異或明確安全要求 | 固定差異的 Codex Security 審查 | verify 不包含安全掃描；一般修改不自動全庫掃描 |
| 純文件或驗收紀錄 | [文件維護](../bilicdn-maintain-docs/SKILL.md)的文件、差異及必要封存檢查 | 不因此執行產品、安全或瀏覽器測試 |
| 正式發行 | 最終差異 verify、適用安全審查及[發行流程](../bilicdn-release/SKILL.md) | 公開交付與安裝驗收分開 |
| 已安裝身分、行為或故障 | [IAB Skill](../bilicdn-iab-validation/SKILL.md)依當次斷言選必要證據 | Node、來源隔離與實際安裝不是通用的三級關卡 |
| 明確要求離線比較或模型評估 | [離線評估](../bilicdn-offline-evaluation/SKILL.md) | 模型完成不等於效益通過，不納入 verify 全綠 |

新增案例以具體變更或缺陷為依據；每個門檻說明保護的契約，不以「還可以多測」擴張任務。已指定的案例不能因難取證而降級。

## 實作與輸出

資料與副作用歸屬依架構文件：狀態存於所屬 Store，跨功能動作透過控制器及型別化事件，瀏覽器差異留在適配器；UI 消費快照，產品變更經 ControlCommandPort。重構保持 getter、參數、短路讀值、註冊／清理及等待後重查順序，不提前快照狀態；新純助手只回傳事實，不搬走原呼叫端的資格或預算。

結果記錄實際 Runtime／npm、差異範圍、命令、退出碼、失敗與修復前後證據。工具變更的結果追加工具日誌，產品驗收寫入相應報告；按[文件更新對照](../bilicdn-maintain-docs/references/update-map.md)同步權威內容。完成後依 AGENTS 的既有授權交付，當次只調查或暫緩提交的要求優先。
