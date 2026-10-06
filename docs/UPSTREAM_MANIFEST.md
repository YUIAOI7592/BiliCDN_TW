<a name="upstream-and-historical-sources"></a>

# 上游與歷史來源

本文件是 v2 系列的現行來源歸屬與建置指南。下列版本化來源是歷史基準；現行來源為 `src-v2/`，版本／工具設定以 `release.json` 及 lockfile 為準。文件用途見 [文件索引](INDEX.md)，授權與作者資訊見 [第三方聲明](THIRD_PARTY_NOTICES.md)。

<a name="attribution-baseline"></a>

## 來源歸屬基準

`baseline/BiliCDN_TW_1.3.4.original.user.js` 是不可變的上游來源歸屬基準。歷史 v1 Release 與 tag 保留供調查使用。

SHA-256 清單為 [baseline/SHA256SUMS.txt](../baseline/SHA256SUMS.txt)，內容保留相對於儲存庫根目錄的路徑，須從根目錄進行校驗。

<a name="v2-relationship"></a>

## 與 v2 的關係

v2 系列從 v2.0.0 的 TypeScript 架構重整開始；v1.9.6 僅作使用者可見不變量的行為參考。現行 v2 建置、測試及封裝不得匯入：

- v1 原始碼樹；
- v1 正式 bundle；
- v1 測試 bridge 或 fixture；
- incremental 或 cumulative patch 產物。

沒有 v1 儲存遷移或執行期相容層；既有 v1 Tampermonkey 值既不讀取，也不刪除。

<a name="third-party-tooling"></a>

## 第三方工具

- TypeScript 7.0.2 及 lockfile 鎖定的平台套件：開發型別檢查及本機 AST 架構／測試 API。
- esbuild 0.28.2 及 lockfile 鎖定的平台套件：只作建置／測試打包。
- `@types/node` 26.6.4 及 lockfile 鎖定的 `undici-types`：只供開發型別檢查。Node 26.8.1 內建測試 API 執行本機契約。

發行 userscript 為單一 IIFE，沒有執行期第三方依賴。授權聲明集中於 `docs/THIRD_PARTY_NOTICES.md`。
