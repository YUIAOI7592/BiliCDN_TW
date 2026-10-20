# 已退出現行流程的檔案

本頁說明退出流程資料的配置。版本／議題／日期導覽見 [HISTORY](../../docs/HISTORY.md)，目前程式與流程見 [INDEX](../../docs/INDEX.md)。下方有日期的搬移數量保留原範圍；本頁不重複維護現行產品版本。

## 配置

| 位置 | 保存內容 | Git 可見範圍 |
| --- | --- | --- |
| `docs/` | 歷史計畫、研究、驗收、版本報告閱讀版、完整日誌及指南快照 | 經檢查的 Markdown 文件 |
| `docs/evidence/` | 已結案驗收的指定證據圖片 | 原本已追蹤的指定圖片 |
| `releases/Release/` | 過往正式發行原件，原始位元組及版本目錄結構不變 | 公開封存 |
| `originals/` | 搬移前原始正文及完整日誌基準 TAR | 公開原件快照 |
| `local/2026-10-20-cleanup/` | 本輪退出流程的私有工作資料、證據及獨立搬移清單 | 忽略，本機保存 |
| `local/development/` | v1.5.5 開發稿 | 忽略，本機保存 |
| `local/scripts/` | v1.5.x package／security 準備工具 | 忽略，本機保存 |
| `local/review/` | v1.5.1 審查與重現資料 | 忽略，本機保存 |
| `local/security/` | 七組已完成、sealed 的 v1.5–v1.6 安全掃描，包含原 Git 快照 | 忽略，本機保存 |
| `local/work/` | 已完成的一次性工具、舊測試快照、瀏覽器筆記與發行草稿 | 忽略，本機保存 |
| `local/src/` | 舊版剩下的空 `worker/` 目錄 | 忽略，本機保存 |

`local/relocation-manifest.json` 是 2026-10-03 第一次搬移的本機清單，記錄每個檔案的舊／新路徑、bytes 與原始 SHA-256，以及保留位置的檔案校驗值；不納入公開儲存庫。

[公開搬移清單](../relocation-manifest.json) 記錄本輪公開位置、原件／閱讀版雜湊及 URL 編輯；私有清單另存 `local/2026-10-20-cleanup/private-manifest.json`，不公開檔案內容。`Release/` 根目錄僅保留現行版，舊版從 [發行封存](releases/Release) 查閱；原始文件可由 [TAR](originals/PRE_CLEANUP_2026-10-20_0f4cb8d.tar) 及 [固定提交](https://github.com/YUIAOI7592/BiliCDN_TW/tree/0f4cb8d669a144cf6876575a979fd98e4b586300) 追溯。

完整歷史驗證及發布後補記見歷史導覽；最新版完整正文在 [TEST_REPORT](../../docs/TEST_REPORT.md)。2026-10-11 加入的 [九份原指南快照](docs/IAB_GUIDES_BEFORE_2026-10-11.md) 當時使公開歷史 Markdown 從原 13 份增為 14 份；這是當時範圍，後續新增不回寫原數量。

## 舊位置對照

下列對照及原位說明保存 2026-10-03 首次封存整理的範圍；目前位置依上方配置與公開搬移清單查閱。

| 原位置 | 新位置 |
| --- | --- |
| `docs/SECURITY_REVIEW_v1.6.0.md`、`PLAN_v2.0.2.md`、`POST_RELEASE_v2.0.2.md` | `archive/retired/docs/`，檔名保留 |
| `docs/CHROME_v2.0.3_ACCEPTANCE.md`、`CHROME_v2.1.2_ACCEPTANCE.md`、`CHROME_v2.1.6_ACCEPTANCE.md` | `archive/retired/docs/`，檔名保留 |
| `docs/CDN_*_2026-09-25.md`（五份） | `archive/retired/docs/`，檔名保留 |
| `docs/evidence/` | `archive/retired/docs/evidence/` |
| `development/`、`review/`、`security/`、空的 `src/` | `archive/retired/local/` 下的同名目錄 |
| `scripts/package-v153.cjs`、`package-v154.cjs`、`package-v155.cjs`、`prepare-security-v155.cjs` | `archive/retired/local/scripts/` |
| `.work/clean-v160/`、`.work/v182-security/` | `archive/retired/local/work/` |
| `.work/` 內已完成的一次性 `.cjs`、舊瀏覽器／preflight 紀錄、v2.1.5／v2.1.6 發行草稿 | `archive/retired/local/work/`，檔名保留 |
| `docs/TEST_REPORT.md` 的 v2.1.7 至 v2.0.2 歷史正文（2026-10-06） | [docs/TEST_REPORT_HISTORY.md](docs/TEST_REPORT_HISTORY.md)，十二個主要區塊保留原文 |
| `docs/INDEX.md` 的三段 2026-10-03 整理紀錄（2026-10-06 搬移） | [docs/DOC_MAINTENANCE_HISTORY.md](docs/DOC_MAINTENANCE_HISTORY.md)，原日期及數量保留 |

`.work/npm-cache/`、`.work/dependencies.json` 與 `.codex/` 本機工具資料仍留在原位。既有 `archive/pre-upstream-v1.3.4-20260904/`、授權原件及全部 `Release/` 也維持原位。後續根目錄整理已將來源校驗清單集中到 `baseline/SHA256SUMS.txt`，內容不變。

## 保存與使用規則

- 這些檔案退出目前的 npm 建置與測試流程。舊 helper 含當時目錄與版本假設，不能作為現行發布命令。
- sealed scan、checkpoint、source snapshot 與內嵌 `.git` 內容保持原 bytes。舊紀錄內的原始路徑保留為當時證據，以本索引與本機搬移清單查找新位置。
- 搬移閱讀版僅調整已登記的連結 URL，並與 TAR 原始正文核對；研究數值、瀏覽器觀察、取消決定與覆蓋限制保留。既有封存正文不因一般格式整理回寫。
- **v2.1.6 Chrome／Tampermonkey 驗收仍已通過、已結案**；移動文件不產生新的驗收待辦。新增 CDN 計畫仍已撤銷。
- 公開文件／指定圖片與本機原始資料分區保存；新增公開材料前須確認沒有 signed URL、憑證、IP 或播放器物件。
- 原始碼位於 `src-v2/`、契約測試位於 `tests-v2/`；根目錄文件為 README、AGENTS、SECURITY，其他現行指南與最新版報告集中於 `docs/`，過往版本紀錄在本封存區。封存檔案不作 v2 建置輸入。
- TEST_REPORT_HISTORY、DOC_MAINTENANCE_HISTORY 及 TEST_TOOLING_REPORT 的全部既有正文只追加。必要歷史入口保留；已失效原網址、既有快照斷鏈、私有證據及未連線外部網址分別列限制，不能合稱連結全部有效。

## 第一次封存整理的搬移驗證

以下記錄適用於 **2026-10-03／v2.1.7**；其中 11 份文件及其他盤點數量均為當時範圍。

本次 33 組位置調整搬移 **604 個檔案**。搬移後、修正文件相對連結前，604 個 SHA-256 全部與原檔一致；其中本機歷史資料保留原內容。另核對 **327 個現行來源、測試、工具、設定、授權基準與 Release 檔案**，位置及 SHA-256 均未改變。後續的文件連結修正、Git 忽略規則及完整 npm 驗證另行檢查，不作新的 Chrome 驗收證據。

整理完成後，**25 份公開 Markdown 的 128 個本機連結及錨點**檢查通過；**592 個搬移的本機檔案**及 **327 個保留原位檔案**再次核對 SHA-256 一致。本機資料與搬移 manifest 均維持 Git 忽略，公開範圍只有兩份封存索引、11 份歷史文件及指定截圖。

`npm run verify` 通過型別、架構、626 項功能斷言、18 項架構斷言、40 個非入口模組匯入檢查、可重現建置、語法與暫存封裝 checksum 驗證。第一次執行因 Windows 沙箱阻擋 esbuild 的上層目錄讀取而失敗，使用適當權限重新執行後完整通過；沒有為此修改工具或程式。`git diff --check` 通過。已發布 Release 內容及驗收狀態保持原狀。

## 後續根目錄文件整理

以下同樣是 **2026-10-03／v2.1.7** 的歷史結果。2026-10-06 中文化與報告搬移結果另見 [文件維護歷史](docs/DOC_MAINTENANCE_HISTORY.md)。

同日再將五份現行文件集中至 `docs/`，來源校驗清單移至 `baseline/SHA256SUMS.txt`。六份檔案移動前後 bytes 一致，再依新位置修正文件連結與封裝讀取路徑。本機清單為 `local/root-document-relocation.json`，保留原始 SHA-256；第一次搬移清單仍保存當時路徑。

本索引誤接的重複專案脈絡已移除，現行契約集中於 `docs/PROJECT_CONTEXT.md`。最新公開文件連結檢查為 **25 份 Markdown／129 個連結及錨點**，完整 `npm run verify` 通過；正式產物與原始封存證據保持不變。
