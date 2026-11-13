# Runtime、命令與建置

## 環境需求

Codex 執行 Node 或必要的 Python 前，以 load_workspace_dependencies 取得當次路徑並明確執行；不得硬寫安裝位置或退回系統／歷史 up141 Runtime。取得失敗只停止相依工作。專案不固定 Node／Python 版本；Node 須具備原生 mts／ESM／型別移除、所用測試 API 與來源映射能力。

需要 npm 時記錄實際 npm CLI 路徑與版本，以選定 Node 執行，僅在當次程序 PATH 前置該 Node 目錄，保持父子版本一致。不假定 Codex 附帶 npm，不自動換 pnpm，也不改全域 PATH。一般使用者可沿用自己的 PATH；verify.ps1 依 -NodePath、BILICDN_NODE、PATH 選擇，verify.sh 依 BILICDN_NODE、PATH 選擇。啟動器管理 cwd、含空白引數及子程序退出碼，不能以版本字串假稱來自 Codex。

直接依賴與解析版本由 [package.json](../../../../package.json)／[lock](../../../../package-lock.json) 固定；需要建立或重建開發依賴時，以所選 Runtime 執行 `npm ci`，既有依賴檢查不自動重裝。專案無執行期依賴；Python 沒有正式來源或依賴鎖定。授權見[第三方聲明](../../../../docs/THIRD_PARTY_NOTICES.md)。一次相容結果不外推其他平台或未來版本，型別套件版本也不是 Node 版本。

[toolchain](../../../../scripts/lib/toolchain.mts) 的 node24 語法目標不代表 Runtime 白名單。verify 及實際執行測試（含套件／名稱篩選）以選定 Node 執行最多五秒的隔離 mts 探測，核對成功、位置、完整報告、退出碼及父子版本；同程序共用完成 Promise，成功與失敗均清理，不提供略過或自動下載替代。探測不計入正式案例，完整 verify 才支持當次相容結論。純 test --list 及用法錯誤不啟探測；環境訊息在 stderr，JSON stdout 不混入文字。

## 命令與範圍

從儲存庫根目錄執行；既有命令若開始使用本機網站服務，遵守 AGENTS 停止相依工作。

| 命令 | 用途 |
| --- | --- |
| `npm run typecheck` | 產品、測試、維護工具三個嚴格 TypeScript 專案，不輸出檔案 |
| `npm run architecture` | 正式來源的 AST、依賴及列出的所有權檢查 |
| `npm run format:check` | 維護範圍唯讀格式核對 |
| `npm run format` | 寫入維護範圍格式；代理來源修改仍使用 apply_patch |
| `npm test` | 完整登記套件，含架構、匯入純度及工具契約 |
| `npm test -- adapters` | 選定套件；suites/adapters 為相容別名 |
| `npm test -- application --name "startup"` | 依實際名稱正規表示式選案 |
| `npm test -- --list` | 列選擇器與來源，不執行測試 |
| `npm run build` | 正式 IIFE、source map 與建置清單 |
| `npm run verify` | 完整自動驗證及暫存封裝 |

文件命令由[文件維護](../../bilicdn-maintain-docs/SKILL.md)維護，封存／還原命令見[封存程序](../../bilicdn-archive-workspace/references/packing-and-restore.md)，正式封裝見[發行流程](../../bilicdn-release/SKILL.md)，專項模型見[離線評估](../../bilicdn-offline-evaluation/SKILL.md)。選定任務才讀相應方法，不把專項評估混入正式套件。

## 完整驗證

[verify](../../../../scripts/verify.mts) 核對能力、格式、公開封存、文件、型別、架構、全部測試、兩次建置與資訊清單一致性、JavaScript 語法、禁止的歷史／Worker 標記及必要儲存標記，最後再建置並校驗暫存封裝 SHA-256。使用 dist 下新建的 verify-package-* 目錄，核對解析位置與前綴後清理，不寫入正式 Release。它不包含安全審查、IAB 或實機效益。

失敗摘要包含套件、階段與原因，退出碼仍為 1；不重複傾印完整 outcome。已通過的最終差異不必逐項重跑，單項檢查保留供定位問題使用。

[project-config](../../../../scripts/checks/project-config.mts) 核對產品版本、直接依賴、lock 與安裝版本；唯讀、不連網、不執行套件，不能證明整個 node_modules 原始內容未被改寫，也不能代替實際乾淨安裝。build 另核對載入的 esbuild 與已安裝 TypeScript 精確版本。

## 原始碼格式與靜態規則

Prettier 依 [.prettierrc.json](../../../../.prettierrc.json) 與 [format 工具](../../../../scripts/checks/format.mts)的固定範圍處理正式來源、測試、工具及維護 JSON；不寫 Release、封存、基準、私有證據、生成 JS 或 lock。嵌入語言格式化關閉；最多四次計算取得穩定結果，check 模式不寫入。

三個型別專案保留 strict、未使用宣告／參數及明確型別匯入檢查。移除綁定仍保留初始化副作用；未用位置參數不改呼叫介面。不加入 ESLint／typescript-eslint，架構使用鎖定 TypeScript 的 AST。Node 只移除型別、不讀取 tsconfig；工具以可移除語法及明確匯入使用原生 mts，不新增轉譯載入器。

## 建置輸出

[build](../../../../scripts/build.mts) 從 src-v2/entry.ts 產生單一 Chrome 120 IIFE，不分割或上傳。dist 包含 BiliCDN_TW.user.js、外部 map、build-manifest.json；清單保存實際 Node、esbuild、核對的 TypeScript、選項、來源／metadata 輸入及腳本雜湊，不填未使用的 npm，也不聲稱 build 已作 typecheck。

[metadata](../../../../src-v2/metadata.txt) 的 @version 只有一個 __VERSION__ 占位符，由 release.json 注入；缺失、重複或混用數字版本拒絕建置。版本標頭不證明完整已發布或已載入本體。v2 不匯入歷史 v1、不加入執行期依賴、遠端載入或 Worker 攔截。
