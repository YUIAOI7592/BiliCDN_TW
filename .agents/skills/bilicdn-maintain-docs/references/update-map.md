# 文件更新對照

## 依變更選擇權威

| 修改內容 | 更新位置 |
| --- | --- |
| 產品模式、資格、救援或行為 | [ARCHITECTURE](../../../../docs/ARCHITECTURE.md)及契約；影響使用者操作、預設或可見功能時更新 [README](../../../../README.md) |
| 分層、介面、資料流及所有權 | ARCHITECTURE；強制流程、授權或不變量改變才同步 [AGENTS](../../../../AGENTS.md) |
| 信任、敏感資料、儲存與網路安全 | [SECURITY](../../../../SECURITY.md)，責任同時改變才更新架構 |
| 測試或維護工具 | 正式來源與登記；方法由[變更驗證](../../bilicdn-verify-change/SKILL.md)維護，原行為／遷移對照改變才更新 [MIGRATION](../../../../tests-v2/MIGRATION.md) |
| Runtime、建置與依賴 | 驗證 Skill 及當輪[工具日誌](../../../../docs/TEST_TOOLING_REPORT.md)；授權／用途改變更新[第三方聲明](../../../../docs/THIRD_PARTY_NOTICES.md)，來源基準改變更新[上游歸屬](../../../../docs/UPSTREAM_MANIFEST.md) |
| 瀏覽器方法 | [IAB Skill](../../bilicdn-iab-validation/SKILL.md)所屬參考；實際結果另外寫入報告 |
| 工作範圍、停止、跳過與結案 | [TODO](../../../../docs/TODO.md)，其他入口只連結 |
| 新文件、Skill、標題及導航 | 文件清單、[INDEX](../../../../docs/INDEX.md)或 [HISTORY](../../../../docs/HISTORY.md)及相應 Skill 入口 |
| 正式換版 | [發行 Skill](../../bilicdn-release/SKILL.md)的唯一順序；不在本表重列發布程序 |
| 封存、工作資料與目錄政策 | [封存 Skill](../../bilicdn-archive-workspace/SKILL.md)及相關清單；不順便處置未授權資料 |

## 維護既有段落

同議題先找現行全部提及，再修改權威原章節；政策改變替換原規則，不在文末累積相反說明。歷史差異留在版本紀錄，原 FAIL／INVALID、限制與停止決策不改算通過。

README 面向安裝、操作、預設、排查及隱私；公式、授權、內部時序與工具操作連權威來源，但使用者需要的限制保留簡短說明。INDEX 按目的導覽，版本、日期與研究清單集中 HISTORY。TODO 維護目前工作、已結案、未啟動建議與停止邊界，不重貼驗收數字。

實測寫 [TEST_REPORT](../../../../docs/TEST_REPORT.md)或對應原紀錄，不把新案例數回填舊版。普通修復不另建 FIX／ACCEPTANCE／CONTINUATION 多份報告；必要獨立研究放已登記的 archive/retired/docs，標示版本／日期並由 HISTORY 導覽，同議題按日期追加。

拆分、刪除或保留相容入口依當次遷移範圍決定；若已明確要求刪除且不留副本，不能以保留歷史為由新增空殼或副本。來源證明與受保護證據仍依[登記規則](document-registry.md)核對，不把單次遷移要求當成其他文件的永久刪除規則。
