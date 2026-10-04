# 授權與建置工具

本文件說明現行 v2 的來源與開發依賴；工具精確版本及平台套件以 [release.json](../release.json) 與 [package-lock.json](../package-lock.json) 為準。文件用途見 [索引](INDEX.md)。

原始 userscript：jiyunshi，MIT。保留 metadata author／license 及 [LICENSE](../LICENSE)；固定來源見 [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md)。

TypeScript 7.0.2：Microsoft Corp.，Apache-2.0。用於型別檢查，並由本機架構／測試工具使用其 AST API；不是只有型別檢查用途。TypeScript 及 lockfile 鎖定的平台套件不進入 userscript 執行環境。安裝後的 `node_modules/typescript/LICENSE`、`NOTICE.txt` 與各平台套件的 notices 是本機授權核對來源。

esbuild 0.28.2：Evan Wallace，MIT。只用於本機建置與測試打包；esbuild、其平台執行檔及 Node 不進入 userscript 執行環境。平台套件依 lockfile 安裝，不提交工具本體。

官方資料：[release](https://github.com/evanw/esbuild/releases/tag/v0.28.2)、[MIT](https://github.com/evanw/esbuild/blob/v0.28.2/LICENSE.md)、[API](https://esbuild.github.io/api/)。
