# 封存說明

本目錄保存已退出現行建置／測試流程的歷史資料。現行配置見[封存索引](retired/README.md)，目前文件與開發入口見 [docs/INDEX.md](../docs/INDEX.md)。2026-10-03 的位置整理及後續檢查見 [文件維護歷史](retired/docs/DOC_MAINTENANCE_HISTORY.md)。

本頁只說明封存分區；現行版本以 [release.json](../release.json) 為準。版本／議題／日期追溯集中於 [HISTORY](../docs/HISTORY.md)，下方有日期的搬移數量保留當時範圍。

## 分區

- `retired/docs/`：公開歷史計畫、研究、驗收、版本驗證、文件整理紀錄與指南快照；搬移的版本報告提供只調整連結 URL 的閱讀版，原始正文另存 TAR。對應截圖位於 `evidence/`，文件分類由清單維護。
- `retired/releases/Release/`：過往正式發行原件，保留位元組、檔名與版本目錄結構；儲存庫根目錄 `Release/` 僅保留現行版本五項封裝檔。
- `retired/originals/`：清理前原始正文及完整日誌基準的 TAR 快照；固定提交另保留原始儲存庫路徑。
- `retired/local/`：僅留在本機的舊開發稿、輔助腳本、私有證據、sealed scan 與獨立 Git 快照；由 `.gitignore` 排除。本輪私有搬移使用日期子目錄及獨立清單，公開 checkout 不含其內容。
- `pre-upstream-v1.3.4-20260904/`：既有本機封存，維持原位及原內容。

[搬移清單](relocation-manifest.json) 登記公開舊／新路徑、原件雜湊、閱讀版 URL 編輯及精確歷史引用限制。核對方式見 [DEVELOPMENT](../docs/DEVELOPMENT.md#文件登記與保護)；舊歷史網址失效另列限制，不宣稱搬移已修復原網址。

## 歷史報告入口

- [TEST_REPORT_HISTORY](retired/docs/TEST_REPORT_HISTORY.md)：持續追加上一版完整報告，歷史正文及原始限制原樣保留；最新版完整正文見 [TEST_REPORT](../docs/TEST_REPORT.md)。首次搬入的 v2.0.2～v2.1.7 十二個主要紀錄區塊及其英文正文保留。
- [DOC_MAINTENANCE_HISTORY](retired/docs/DOC_MAINTENANCE_HISTORY.md)：從 `docs/INDEX.md` 搬入三段 2026-10-03 紀錄，後續文件檢查另按日期新增。
- [改寫前指南快照](retired/docs/IAB_GUIDES_BEFORE_2026-10-11.md)：2026-10-11 九份指南的完整原文，只作追溯，不取代現行指南。
- [過往 Release 原件](retired/releases/Release)；[原始文件 TAR](retired/originals/PRE_CLEANUP_2026-10-20_0f4cb8d.tar) 與 [整理前固定提交](https://github.com/YUIAOI7592/BiliCDN_TW/tree/0f4cb8d669a144cf6876575a979fd98e4b586300)。

上述歷史資料不取代現行報告或待辦；已發布 Release 與 sealed 安全產物維持原樣。TEST_REPORT_HISTORY、DOC_MAINTENANCE_HISTORY 與 TEST_TOOLING_REPORT 的全部既有正文只追加，不因搬移回寫原始觀察。

## 既有上游更新前封存

`pre-upstream-v1.3.4-20260904/` 保存工作區清理前的完整自訂專案，包括 v1.3.3～v1.4.4 userscript、測試、報告、patch、security artifacts 與交接文件。

封存資料只供比較與選擇性移植，不是新上游基準，也不得整包覆蓋 v1.3.4。
