# 封存說明

本目錄保存已退出現行建置／測試流程的歷史資料。2026-10-03 新增的[整理索引](retired/README.md)記錄本次位置調整；現行文件與開發入口見 [docs/INDEX.md](../docs/INDEX.md)。

## 分區

- `retired/docs/`：可公開的歷史計畫、研究、驗收與對應截圖。
- `retired/local/`：僅留在本機的舊開發稿、輔助腳本、審查、sealed scan 與獨立 Git 快照；由 `.gitignore` 排除。
- `pre-upstream-v1.3.4-20260904/`：既有本機封存，維持原位及原內容。

## 既有上游更新前封存

`pre-upstream-v1.3.4-20260904/` 保存工作區清理前的完整自訂專案，包括 v1.3.3～v1.4.4 userscript、測試、報告、patch、security artifacts 與交接文件。

封存資料只供比較與選擇性移植，不是新上游基準，也不得整包覆蓋 v1.3.4。
