# 本機開發與手動發布

先讀 AGENTS、PROJECT_CONTEXT、SECURITY、UPSTREAM_MANIFEST；不要修改 fixtures、baseline 或歷代正式輸出。

1. Node 26.8.1、npm 11.19.0，執行 `npm ci`。
2. 修改 src，不直接編輯 dist；`npm test` 先重建再遞迴測試。
3. 完成抽離／回歸後才更新 release.json、package.json、metadata、fallback 與 lockfile。
4. 準備 CHANGELOG／TEST_REPORT；`npm run package` 只作本機封裝，不代表安全掃描完成。
5. `npm run verify` 驗證兩次建置一致、syntax、全部測試、CS 子集、實際 patch 套用與 SHA。
6. 對固定 range 執行正式 Codex Security。受阻則保留候選，不以 VM 子集代替。
7. 更新報告、再次 package／verify，在乾淨本機 checkout 用 lockfile 重建，檢查公開檔案。
8. 確認完成後手動推送 main／版本標籤；不自動安裝瀏覽器腳本。

沒有 CI/CD、GitHub Actions 或自動部署。兩套 verify shell 只轉呼共同 Node 邏輯。manifest 不帶時間戳／絕對路徑，SHA 使用 repo-relative 路徑。

唯一建置依賴為 esbuild 及必要平台套件。不提交 node_modules、dist、個人診斷、raw 安全工作檔、archive 或 development；必要舊版樣本已按原 bytes 放 fixtures。

若受限工具環境拒絕 esbuild 讀取目錄資訊，不能以跳過建置／測試視為成功。
