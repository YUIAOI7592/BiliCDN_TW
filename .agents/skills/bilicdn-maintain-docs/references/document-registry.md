# 文件格式、登記與保護

## Markdown 格式（GFM）

指南使用真正標題、段落、清單與表格，不以大量粗體冒充章節。清單、表格及程式區塊前後保留空行；表格有標題及分隔列，欄位數一致，管線字元須跳脫，不能把多列字串誤當表格。跨行說明使用正文或清單，不把整段流程塞進單格；程式及路徑適當使用 inline code 或 fenced code。

標題與自訂錨點須符合 GitHub 解析；改標題前查引用，保留仍有用途的錨點。核對實際 GFM 解析、相對連結、URL 編碼、reference definitions 與 HTML 錨點，不只目測。Skill 的 YAML frontmatter 是中繼資料，正文檢查忽略其內容但保留原行號；name／description 另由 Skill 格式驗證核對。

現行文件維持單一 H1；歷史合併日誌保留原標題。表格中的管線字元即使位於 inline code 也須跳脫；核對粗體緊鄰中英文標點時的解析。保留既有 GitHub Alerts、必要 HTML 錨點及程式區塊；格式整理不變更程式、雜湊或 URL 的值。

## 文件登記與唯一權威

[doc-manifest](../../../../docs/doc-manifest.json) schemaVersion 維持 1；公開封存位置清單維持 schema 2。新增公開 Markdown（含 Skill 與 references）登記 path、kind、topics、versions、date、requiredAnchors；owners 為每個主題指定唯一權威，不存 PASS 數或工作狀態。

Skill 主入口及維護參考可用 guide，各自登記明確子主題。INDEX 直接連各 Skill，Skill 直接連所屬參考，維持最多兩次點擊。無限定版本／日期的現行指南使用 versions 空陣列、date null；固定來源、調查版本及日期保留實際關聯，不能推測日期或把它當成功證據。

文件刪除或拆分時同步移除原 documents／owners 登記及現行引用；替換已廢棄的 requiredAnchors，不藉此保留空殼。相容導覽是否仍有用途按任務判定，已明確授權刪除的原操作文件不建立新副本。

## 原文與歷史引用

protections 的 exact 保護全文，prefix 只許追加；文字按 LF，二進位按原位元組。三份日誌 TEST_REPORT_HISTORY、DOC_MAINTENANCE_HISTORY、TEST_TOOLING_REPORT 的全部既有正文只追加，完整基準補足較短 prefix 的尾段。發行原件、baseline 與安全產物不回寫，不刪基準或改雜湊掩蓋失敗。

歷史閱讀版只作已登記且可重建的 URL 編輯。原件移出實體位置前仍需授權與來源／完整性證明；已批准廢棄的操作指南使用精確 Git 原文證明，不新增封存副本或重新發布過時方法。

- immutableLinkExceptions 僅適用雜湊相符的 immutable 原檔，逐筆 source、line、url、sha256、reason；修復後刪失效例外。
- privateEvidenceReferences 僅登記受保護 record 的精確私有引用，無論本機是否存在都列未核對，不讀私有內容。
- historicalReferences 核對來源、行號、原 URL、原文雜湊及保存／退役目標；journal 新舊前綴可用 sourceRevision 固定。已失效原網址不算有效現行連結。
- sourceRelocations 要求原位置不存在及唯一有效目標。retiredSources 指定不存在路徑、完整 Git 提交及原 blob SHA-256；Markdown 錨點須在該原文成立。Git 證據不足就失敗，不以新 Skill 的同名錨點代算。

歷史例外不可套用現行指南、未知新錯誤或整個目錄。封存來源目錄可用固定 Git tree 證明，空目錄殘留不算來源；受保護原文的原判定不因方法轉換而改寫。

unchangedFiles 表示既定輪次未改產品；後續已授權變更先保留舊基準再更新適用範圍，不改歷史 entries、原始雜湊或 URL 編輯證據消除失敗。

## 檢查器的證據界線

docs:check 掃描 Git 已追蹤及未忽略的新 Markdown；沒有 Git 時使用明確公開目錄，包括 .agents/skills 與登記的發行目錄。不掃私有 .work、其他代理本機資料或依賴。檢查 GFM、引用、權威、導航、錨點、版本／命令及原文保護；對 guide／navigation／status 的可見長段落檢查重複，忽略程式、表格、引文及歷史紀錄的重複。

JSON 結果 schemaVersion 2，分列 findings、legacyLinks、archivedReferences、privateEvidenceNotChecked、externalLinksNotFetched；外部 URL 不連網。自動檢查不證明語意一致、全部網站可達或私有證據已核對。
