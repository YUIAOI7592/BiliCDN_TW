# 壓縮、清理與還原

## 先證明再移除

新原件包用標準 TAR＋gzip，公開／私有分開，依任務分包，目標未壓縮內容每包不超過 256 MiB，單一大型原件獨立保存。固定容器排序、時間及權限，原件本身不改寫；清單保存相對路徑、大小、SHA-256、來源及必要時間。既有 gzip／ZIP 先驗完整性與重複性，保留一份，不再套一層壓縮。

清理前列原件、可重建副本與未知資料。舊依賴在隔離目錄用精確 lock 重建，不執行舊安裝腳本、不動根依賴；重建不同就保留原件。Git 副本查 refs、index、工作差異及不可達物件，主倉庫穩定提交以外的必要物件另存救援包並獨立還原；bundle --all 不足以證明全部保存。原件逐位元組還原與 Git 物件等價重建分列，不保證快取 pack 排列一致。

固定順序：壓縮 → 新目錄獨立解壓 → 逐檔比對 → 新清單驗證 → 刪除已授權原位置。每一步失敗保留來源與紀錄。目的地限定核對後的根，拒絕連結、路徑逃逸、重複成員、超量輸出及衝突；不得解回來源或 Release。

TAR 只接納已支援的標準 PAX 路徑、大小及被動 metadata，拒絕未知解讀欄位及覆蓋未使用的局部延伸標頭。私有大檔串流核對，僅指定且有上限的 metadata 可完整載入；不執行封存程式或恢復舊測試。

## 命令與還原

先按[當次 Runtime](../../bilicdn-verify-change/references/runtime-and-commands.md#環境需求)選擇 Node／npm。

| 命令 | 證明範圍 |
| --- | --- |
| `npm run archive:check` | 公開包、原件、閱讀版 URL 編輯、追加日誌及現行 Release |
| `npm run archive:check -- --local` | 額外核對本機私有清單、原位資料、包及已保存重建證明，需要 Git |
| `npm run archive:check -- --json` | schemaVersion 1 機器結果，可與 local 合用 |
| `npm run archive:check -- --restore-root <目錄>` | 唯讀核對已完整解壓的 payload 與包內清單 |

公開核對不讀私有索引或檔名，也不要求 Git。檢查器不解壓、不刪除、不改寫；退出碼 0 為通過、1 為核對失敗、2 為 CLI 用法錯誤。結果中的 packedFiles、reconstructedFiles、reconstructedChecksumTargets、restoreChecked 分別判讀，既存重建證明不等於本次新讀原件。

使用標準 tar 還原前，確認目的地是新空目錄並先通過公開檢查。將清單中已核對的包與還原根絕對路徑，分別保存於 PowerShell 的 `$archiveBundlePath`、`$archiveRestoreRoot`；只有兩者均已賦值且符合前述範圍時，才逐包執行：

```powershell
& tar -xzf $archiveBundlePath -C $archiveRestoreRoot
if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed' }
```

全部包完成才執行 restore-root。私有還原先通過 local，私有包解至同一還原根，最後 local 與 restore-root 一起核對。缺包、讀取失敗或不完整解壓都不能算通過。

## 清單與完成

公開 schema 2 的 bundles 保存壓縮大小／SHA-256、TAR 大小、索引及各成員證明；邏輯路徑可由實體檔或包成員提供。既有 schema 1 與舊清單仍可核對。localManifestProof 固定主私有清單大小與 SHA-256，local 模式先驗證再解析，不允許主私有清單降回 schema 1；additionalLocalManifests 依各自 schema 核對，沒有冒稱全都具相同公開證明。

跨輪維護先保存舊清單基準；歷史刪除表不是永久新增的資料保留義務。不得刪保護登記或更改雜湊掩蓋失敗。明確要求不留副本的操作文件遷移，其適用界線由[本 Skill 入口](../SKILL.md#執行順序)維護，精確 Git 引用依[文件登記](../../bilicdn-maintain-docs/references/document-registry.md)核對。

不以本機壓縮稱異機備份，不使用 force push、不重寫 Git 歷史或廣域清空；完成交付依 AGENTS 主動提交推送，私有原件維持本機保存。容量報告分列原工作區減少、封存增加及整體淨減；未知或未能還原項目明列。
