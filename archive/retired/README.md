# 已退出現行流程的檔案

整理日期：**2026-10-03**，現行版本 **v2.1.7**。本資料夾集中保存舊版開發／研究／驗證資料；目前程式、命令與文件用途見 [專案文件索引](../../docs/INDEX.md)和[開發流程](../../docs/DEVELOPMENT.md)。

## 配置

| 位置 | 保存內容 | Git 可見範圍 |
| --- | --- | --- |
| `docs/` | 11 份歷史計畫、研究與驗收紀錄 | 經檢查的 Markdown 文件 |
| `docs/evidence/` | 已結案 v2.1.6 驗收的最終設定截圖 | 原本已追蹤的指定圖片 |
| `local/development/` | v1.5.5 開發稿 | 忽略，本機保存 |
| `local/scripts/` | v1.5.x package／security 準備工具 | 忽略，本機保存 |
| `local/review/` | v1.5.1 審查與重現資料 | 忽略，本機保存 |
| `local/security/` | 七組已完成、sealed 的 v1.5–v1.6 安全掃描，包含原 Git 快照 | 忽略，本機保存 |
| `local/work/` | 已完成的一次性工具、舊測試快照、瀏覽器筆記與發行草稿 | 忽略，本機保存 |
| `local/src/` | 舊版剩下的空 `worker/` 目錄 | 忽略，本機保存 |

`local/relocation-manifest.json` 是本次搬移的本機清單，記錄每個檔案的舊／新路徑、bytes 與原始 SHA-256，以及保留位置的檔案校驗值；不納入公開儲存庫。

## 舊位置對照

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

`.work/npm-cache/`、`.work/dependencies.json` 與 `.codex/` 本機工具資料仍留在原位。既有 `archive/pre-upstream-v1.3.4-20260904/`、授權原件及全部 `Release/` 也維持原位。後續根目錄整理已將來源校驗清單集中到 `baseline/SHA256SUMS.txt`，內容不變。

## 保存與使用規則

- 這些檔案退出目前的 npm 建置與測試流程。舊 helper 含當時目錄與版本假設，不能作為現行發布命令。
- sealed scan、checkpoint、source snapshot 與內嵌 `.git` 內容保持原 bytes。舊紀錄內的原始路徑保留為當時證據，以本索引與本機搬移清單查找新位置。
- 歷史 Markdown 僅調整相對連結；研究數值、瀏覽器觀察、取消決定與覆蓋限制保留。
- **v2.1.6 Chrome／Tampermonkey 驗收仍已通過、已結案**；移動文件不產生新的驗收待辦。新增 CDN 計畫仍已撤銷。
- 公開文件／指定圖片與本機原始資料分區保存；新增公開材料前須確認沒有 signed URL、憑證、IP 或播放器物件。
- 原始碼位於 `src-v2/`、契約測試位於 `tests-v2/`；根目錄文件為 README、AGENTS、SECURITY，其他現行指南與報告集中於 `docs/`。封存檔案不作 v2 建置輸入。

## 第一次封存整理的搬移驗證

本次 33 組位置調整搬移 **604 個檔案**。搬移後、修正文件相對連結前，604 個 SHA-256 全部與原檔一致；其中本機歷史資料保留原內容。另核對 **327 個現行來源、測試、工具、設定、授權基準與 Release 檔案**，位置及 SHA-256 均未改變。後續的文件連結修正、Git 忽略規則及完整 npm 驗證另行檢查，不作新的 Chrome 驗收證據。

整理完成後，**25 份公開 Markdown 的 128 個本機連結及錨點**檢查通過；**592 個搬移的本機檔案**及 **327 個保留原位檔案**再次核對 SHA-256 一致。本機資料與搬移 manifest 均維持 Git 忽略，公開範圍只有兩份封存索引、11 份歷史文件及指定截圖。

`npm run verify` 通過型別、架構、626 項功能斷言、18 項架構斷言、40 個非入口模組匯入檢查、可重現建置、語法與暫存封裝 checksum 驗證。第一次執行因 Windows 沙箱阻擋 esbuild 的上層目錄讀取而失敗，使用適當權限重新執行後完整通過；沒有為此修改工具或程式。`git diff --check` 通過。已發布 Release 內容及驗收狀態保持原狀。

## 後續根目錄文件整理

同日再將五份現行文件集中至 `docs/`，來源校驗清單移至 `baseline/SHA256SUMS.txt`。六份檔案移動前後 bytes 一致，再依新位置修正文件連結與封裝讀取路徑。本機清單為 `local/root-document-relocation.json`，保留原始 SHA-256；第一次搬移清單仍保存當時路徑。

本索引誤接的重複專案脈絡已移除，現行契約集中於 `docs/PROJECT_CONTEXT.md`。最新公開文件連結檢查為 **25 份 Markdown／129 個連結及錨點**，完整 `npm run verify` 通過；正式產物與原始封存證據保持不變。
