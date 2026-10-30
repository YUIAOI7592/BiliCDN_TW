# 全分支與歷史證據整併 — 2026-10-31

基準 main 為 0b4d441，先以 a59d29d 保存討論決策、已執行實機紀錄及永久禁令。來源分支為 codex/upstream-141-early-retry 的 2a5851761d5a066cd3b54cb447b9da546a23187e，保留 3cadfd8 與 2a58517 原提交歷史。其餘三個工作分支已為 main 祖先。

## 合併範圍

提前重試執行期早已由 273f8c3 移入並由後續提交修正；本次保留 main 的 src-v2、tests-v2、scripts、版本、工具鏈及已發布 Release 原件。僅補入分支獨有證據、原型報告、相容導覽與日誌追加紀錄，不升版或發布。私有證據不公開。

分支驗證補充原文見 [歷史報告](TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)，原型見 [固定紀錄](UPSTREAM_V1_4_1_EARLY_RETRY_PROTOTYPE_2026-10-30.md)。原型全文與兩份 JSON 逐位元組比對上述固定提交；舊效用仍為 VALID／FAIL，不改判。

| 原件 | bytes | SHA-256 |
| --- | ---: | --- |
| archive/retired/docs/UPSTREAM_V1_4_1_EARLY_RETRY_PROTOTYPE_2026-10-30.md | 4156 | c3b0871e6ca841132ef8a7be53a42c44c665f059ae2d0778e20f8fcb0b4a8dbe |
| archive/retired/docs/evidence/UPSTREAM_V1_4_1_EARLY_RETRY_EFFICACY_2026-10-30.json | 6785 | 31a06ccd301f9a9add79158adac0058665eb6fd34953d2a398a8f598bd8cbc35 |
| baseline/UP141_B_pre_prototype_relocation_2026-10-30_613632f.json | 485913 | 057ce517961e0c18e7702a2f32eeeba7b3812307e079d63e373af4f15ae88475 |

## 驗證

合併驗證進行中；執行結果將在完成檢查後追加。沒有瀏覽器操作、服務啟動或新增實機窗口。

### 完成檢查

Node 26.8.1 下完整 verify 退出 0：2999 個契約通過，無失敗、略過、待實作或取消；型別、架構、格式、文件、公開封存、決定性建置、語法與暫存封裝均通過。對合併前 a59d29d 的 src-v2、tests-v2、scripts、package.json、package-lock.json、release.json 與 Release 差異為零；原型三份原件與 2a58517 完全相同。

首次受限權限執行有六個封存工具案例因自有暫存 Git 無法寫入 config 而失敗；改用正常使用者權限重跑同一完整命令後全數通過，未改測試或期待。本輪不建立新版 Release、不執行瀏覽器或實機窗口。合併提交及遠端祖先關係另於推送後核對。
