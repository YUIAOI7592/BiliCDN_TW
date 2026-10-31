# 上游與歷史來源

本文件是 v2 系列的現行來源歸屬與建置指南。下列版本化來源是歷史基準；現行來源為 `src-v2/`，版本／工具設定以 `release.json` 及依賴鎖定檔為準。文件用途見 [文件索引](INDEX.md)，授權與作者資訊見 [第三方聲明](THIRD_PARTY_NOTICES.md)。

## 來源歸屬基準

`baseline/BiliCDN_TW_1.3.4.original.user.js` 是不可變的上游來源歸屬基準。歷史 v1 Release 與標籤保留供調查使用。

SHA-256 清單為 [baseline/SHA256SUMS.txt](../baseline/SHA256SUMS.txt)，內容保留相對於儲存庫根目錄的路徑，須從根目錄進行校驗。

## 與 v2 的關係

### 後續上游保存

[原作者 v1.4.1 原件](../baseline/BiliCDN_TW_1.4.1.original.user.js) 固定於提交 `b32f949d216dc92cd1efa0b0d023f650b126fcb8`，保存日期 2026-10-29。完整來源、下載核對與比較身分見 [provenance](../baseline/BiliCDN_TW_1.4.1.provenance.json)，原始位元組校驗見 [獨立 SHA-256 清單](../baseline/BiliCDN_TW_1.4.1.SHA256SUMS.txt)。它是後續調查原件，不替換 v1.3.4 來源歸屬基準，也不匯入正式建置／測試。

版本化比較由 [HISTORY](HISTORY.md) 導覽，2026-10-29 結果見 [v1.4.1 與 v2.1.36 來源比較](../archive/retired/docs/UPSTREAM_V1_4_1_COMPARISON_2026-10-29.md)。

### v2 建置界線

v2 系列從 v2.0.0 的 TypeScript 架構重整開始；v1.9.6 僅作使用者可見不變量的行為參考。現行 v2 建置、測試及封裝不得匯入：

- v1 原始碼樹；
- v1 正式打包產物；
- v1 測試橋接介面或測試情境；
- 增量或累積修補產物。

沒有 v1 儲存遷移或執行期相容層；既有 v1 Tampermonkey 值既不讀取，也不刪除。

## 第三方工具

- TypeScript 7.0.2 及依賴鎖定檔鎖定的平台套件：開發型別檢查及本機 AST 架構／測試 API。
- esbuild 0.28.2 及依賴鎖定檔鎖定的平台套件：只作建置／測試打包。
- Prettier 3.9.10：只作本機格式化與唯讀格式檢查。
- unified、remark-parse、remark-gfm、markdownlint、github-slugger：只作本機離線文件檢查，版本與授權見 [第三方聲明](THIRD_PARTY_NOTICES.md)。
- `@types/node` 26.6.4 及依賴鎖定檔鎖定的 `undici-types`：只供開發型別檢查。Node 26.8.1 內建測試 API 執行本機契約。

`archive:check` 使用上述既有工具與 Node 內建檔案／雜湊 API 作離線維護檢查，不新增依賴，也不把封存來源加入產品建置。

發行使用者腳本為單一 IIFE，沒有執行期第三方依賴。授權聲明集中於 `docs/THIRD_PARTY_NOTICES.md`。
