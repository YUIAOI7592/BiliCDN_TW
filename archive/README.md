# 封存說明

本目錄保存已退出現行建置／測試流程的歷史資料。現行配置見[封存索引](retired/README.md)，目前文件與開發入口見 [docs/INDEX.md](../docs/INDEX.md)。2026-10-03 的位置整理及後續檢查見 [文件維護歷史](retired/docs/DOC_MAINTENANCE_HISTORY.md)。

## 分區

- `retired/docs/`：2026-10-06 盤點為 13 份公開歷史 Markdown，含計畫、研究、驗收、版本驗證及文件整理紀錄；對應截圖位於 `evidence/`。
- `retired/local/`：僅留在本機的舊開發稿、輔助腳本、審查、sealed scan 與獨立 Git 快照；由 `.gitignore` 排除。
- `pre-upstream-v1.3.4-20260904/`：既有本機封存，維持原位及原內容。

## 歷史報告入口

- [TEST_REPORT_HISTORY](retired/docs/TEST_REPORT_HISTORY.md)：從 `docs/TEST_REPORT.md` 搬入 v2.0.2～v2.1.7 的十二個主要紀錄區塊，保留英文正文。
- [DOC_MAINTENANCE_HISTORY](retired/docs/DOC_MAINTENANCE_HISTORY.md)：從 `docs/INDEX.md` 搬入三段 2026-10-03 紀錄，後續文件檢查另按日期新增。

上述歷史資料不取代現行報告或待辦；已發布 Release 與 sealed 安全產物維持原樣。

## 既有上游更新前封存

`pre-upstream-v1.3.4-20260904/` 保存工作區清理前的完整自訂專案，包括 v1.3.3～v1.4.4 userscript、測試、報告、patch、security artifacts 與交接文件。

封存資料只供比較與選擇性移植，不是新上游基準，也不得整包覆蓋 v1.3.4。
