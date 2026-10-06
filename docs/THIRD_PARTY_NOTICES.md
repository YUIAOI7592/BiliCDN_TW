# 授權與建置工具

本文件集中現行 v2 的作者、授權與開發工具用途；來源基準及 v1／v2 關係見 [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md)。工具精確版本及平台套件以 [release.json](../release.json) 與 [package-lock.json](../package-lock.json) 為準。文件用途見 [索引](INDEX.md)。

原始 userscript：jiyunshi，MIT。保留 metadata author／license 及 [LICENSE](../LICENSE)；固定來源見 [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md)。

TypeScript 7.0.2：Microsoft Corp.，Apache-2.0。用於型別檢查，並由本機架構／測試工具使用其 AST API。TypeScript 及 lockfile 鎖定的平台套件不進入 userscript 執行環境。安裝後的 `node_modules/typescript/LICENSE`、`NOTICE.txt` 與各平台套件的授權聲明是本機授權核對來源。

esbuild 0.28.2：Evan Wallace，MIT。只用於本機建置與測試打包；esbuild、其平台執行檔及 Node 不進入 userscript 執行環境。平台套件依 lockfile 安裝，不提交工具本體。

官方資料：[release](https://github.com/evanw/esbuild/releases/tag/v0.28.2)、[MIT](https://github.com/evanw/esbuild/blob/v0.28.2/LICENSE.md)、[API](https://esbuild.github.io/api/)。

`@types/node` 26.6.4：DefinitelyTyped 貢獻者，MIT；`undici-types` 8.9.0：MIT。兩者只供 Node 測試及本機工具的開發型別檢查，精確解析版本由 lockfile 鎖定，不進入 userscript。安裝後的 `node_modules/@types/node/LICENSE`、`node_modules/undici-types/LICENSE` 與其 `package.json` 是本機核對來源。

Node.js 26.8.1 的內建 `node:test`、assert 及 reporter API 用於本機測試，不新增測試框架或執行期依賴；介面依據 [該版官方文件](https://nodejs.org/download/release/v26.8.1/docs/api/test.html)。
