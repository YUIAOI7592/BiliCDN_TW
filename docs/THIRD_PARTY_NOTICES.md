# 授權與建置工具

本文件集中現行 v2 的作者、授權與開發工具用途；來源基準及 v1／v2 關係見 [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md)。直接依賴及完整解析版本由 [package.json](../package.json)／[package-lock.json](../package-lock.json) 維護，[release.json](../release.json) 另核對 TypeScript／esbuild 版本，不在多份指南重列版本清單。

原始腳本作者為 jiyunshi；客製修改由 YUIAOI7592 及貢獻者維護，均依儲存庫 [MIT LICENSE](../LICENSE) 所列著作權與條款。使用者腳本中繼資料保留原作者及 `license`，上游原件保持原始位元組。

下表列套件本身的授權與用途；不是全部間接依賴的授權清單。本機核對以已安裝套件的 `package.json`、授權及第三方通知為準，平台套件也須保留各自聲明。

| 工具 | 套件授權／歸屬 | 開發用途及本機核對來源 |
| --- | --- | --- |
| TypeScript | Apache-2.0／Microsoft | 型別檢查與架構／測試 AST；`node_modules/typescript/LICENSE`、`NOTICE.txt` 及鎖定的平台套件聲明 |
| esbuild | MIT／Evan Wallace | 建置與測試打包；`node_modules/esbuild/LICENSE.md` 及所用平台套件聲明 |
| `@types/node` | MIT／DefinitelyTyped 貢獻者 | Node 測試與工具型別；`node_modules/@types/node/LICENSE` |
| `undici-types` | MIT | 間接開發型別依賴；`node_modules/undici-types/LICENSE` |
| Prettier | MIT／Prettier 貢獻者 | 維護來源／設定格式化及唯讀檢查；`node_modules/prettier/LICENSE`、`THIRD-PARTY-NOTICES.md` |
| unified、remark-parse、remark-gfm | MIT | GFM 解析；各套件根目錄的 `license` |
| markdownlint | MIT | Markdown 格式檢查；`node_modules/markdownlint/LICENSE` |
| github-slugger | ISC | GitHub 標題錨點；`node_modules/github-slugger/LICENSE` |

TypeScript 的 NOTICE 與 Prettier 的第三方通知另列內含元件；不能把套件主授權當成全部內含程式的唯一授權。依賴只作本機開發，不進入單一 IIFE 使用者腳本；文件檢查不在執行時連網。

Node 以內建 `node:test`、斷言與報告 API 執行契約，npm 提供既有命令及依賴安裝。Runtime 選擇與能力判定由 [環境需求](DEVELOPMENT.md#環境需求) 維護，實際使用路徑與版本記於當輪工具日誌；型別套件版本不代表所用 Node 版本，也不證明其執行相容性。
