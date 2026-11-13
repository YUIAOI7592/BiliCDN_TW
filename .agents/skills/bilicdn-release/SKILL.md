---
name: bilicdn-release
description: 準備、封裝或交付已授權的 BiliCDN 正式版本，核對版本文件與公開附件；純文件提交及已安裝版本查證不啟動發行。
---

# BiliCDN 正式發行

本 Skill 維護發行順序。儲存庫根目錄位於本檔目錄向上三層；先讀 [AGENTS 發行授權](../../../AGENTS.md#發行規則)及 [TODO](../../../docs/TODO.md)。當次起草、僅查證、保留本機或暫緩要求優先。Skill 被選用不擴張發布權限，也不恢復已停止驗收。

## 發布前

1. 確認本次已授權產品變更完成，核對差異、工作樹及必要契約結果。Runtime 與完整 verify 按[變更驗證](../bilicdn-verify-change/SKILL.md)執行；安全敏感差異另作固定差異安全審查。離線效用 FAIL 與未驗證實機範圍照實保留，不改算 PASS。
2. 換版前把上一版完整 TEST_REPORT 正文追加至歷史驗收日誌，保留原判定、限制及版本／日期入口，再更新最新版固定入口。其他受影響指南依[更新對照](../bilicdn-maintain-docs/references/update-map.md)修正。
3. 同步 release.json、package.json 及 lock 的產品版本；指南引用版本來源。CHANGELOG 保留舊條目並新增本版行為差異與證據入口；TEST_REPORT 分列自動、安全、來源隔離及安裝結果，未執行、FAIL、INVALID 與依指示跳過照實保留。TODO 只維護工作及停止狀態，HISTORY 登記版本、議題、日期。
4. 保留 docs/CHANGELOG.md、docs/TEST_REPORT.md 兩個封裝輸入路徑；其儲存庫文件連結使用完整 URL。前版五項 Release 原件及校驗先核對，再按[封存程序](../bilicdn-archive-workspace/references/packing-and-restore.md)壓縮、獨立解壓、逐檔驗證，成功後才移除舊散件；原位元組、標籤及雜湊不改寫。
5. 對最終差異執行 `npm run verify`；同一差異已通過便不逐項重跑。驗證失敗或修復未完成不得發布。

## 封裝與公開交付

`npm run package` 會建置並在 `Release/v<version>/` 獨占建立以下五項產物：

- `BiliCDN_TW.user.js`
- `CHANGELOG_v<version>.md`
- `TEST_REPORT_v<version>.md`
- `BUILD_MANIFEST_v<version>.json`
- `SHA256SUMS_v<version>.txt`

package 在建置前拒絕非空目的地，不提供覆寫。失敗保留當時內容供核對，不自動清空。核對已發布版本時不執行正式 package，使用 verify 的暫存封裝。Release 只保留現行版本原件。

封裝核對通過後依既有授權提交並推送 main／版本標籤、建立正式 GitHub Release。附件只有 BiliCDN_TW.user.js，更新 URL 維持本儲存庫 latest 入口；不新增歷史修補產物、CI/CD 或 GitHub Actions。工具受阻時保留完成的準備與具體限制，不把本機封裝稱為已發布。

發布後分別核對遠端 main、版本標籤、唯一附件，以及公開 latest 下載的版本、大小與 SHA-256；不能只看本機檔案或上傳回應。

## 安裝與完成判定

公開產物、實際安裝及效益結論各自記錄。若需要安裝更新，依 [IAB 身分與更新](../bilicdn-iab-validation/references/assertions-and-evidence.md#安裝更新與已更新查證)使用既有公開入口；使用者已回報更新完成或只要求查證時直接核對，不先重裝。發布不隱含新增瀏覽器窗口或補跑矩陣。

交付摘要列版本／提交、驗證範圍、公開核對結果、安裝限制與未完成的必要項目。純文件或未改產品的維護工作依 AGENTS 提交推送，不升產品版本、不正式封裝、不建立標籤或 Release。
