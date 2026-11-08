# 工具鏈相容性與版本鎖定評估（v2.2.16 基準）

日期：2026-11-09（Asia/Taipei）。固定 main／`b549d5cf80cdd36a53af7d4b89d1c79f22645c99`，產品 v2.2.16。本輪依批准計畫只比較、研究與記錄；沒有修改產品、正式測試、工具程式、版本或設定，沒有解除任何鎖定，也沒有啟動瀏覽器或正式發布。

## 研究結論

現用 Node 26.8.1 與 Codex 內建 Node 24.22.1，各自完成十八套件／2,306 案，全部通過。逐案名稱、參數展開、註冊順序、來源位置及結果相同；使用者腳本與 source map 逐位元組相同。兩套環境的五種離線評估數值與退出碼也相同，提前重試原有的效用 FAIL 保留。

這些證據支持「目前來源與既有依賴，在這兩套實際環境下可執行」，沒有發現本輪覆蓋範圍內的 API、語法或平台不相容。不能據此宣稱所有 Node 24／26、未來 Codex Runtime、其他作業系統或全新安裝流程均受支援。

原版 `verify` 仍拒絕 Node 24.22.1，原因是精確版本政策；系統 Node 26.13.0 也受到同一限制。本輪沒有改寫或繞寫正式設定，也沒有將組件矩陣稱為「原版 verify 通過」。建議下一階段處理執行來源、Node 支援條件及版本紀錄語意；九項開發依賴的精確鎖定先保留。

## 固定環境與輸入

| 項目 | A：現有基準 | B：Codex 候選 | C：系統預設 |
| --- | --- | --- | --- |
| Node 實測版本 | 26.8.1 | 24.22.1 | 26.13.0 |
| 來源 | 既有 up141 解壓工具鏈 | Codex 依賴工具當次回傳的內建 Runtime | 當次 shell 的第一個 node |
| Node 執行檔 SHA-256 | `5cba0ea928508c65ddadefc0681d2fb6d95f1f3beea4428f04397631140ee8e5` | `86f361a88f4cc3ecaf1ea93236b0d8edf07bf00fe87ad9f60305513f58fc2c17` | `14319838b3f355e0398c13569a90270bce4fc68f25189f58c59b03dadae0e6d5` |
| npm CLI 實測版本 | 11.19.0 | 同一份 11.19.0 CLI，以 B 的 Node 執行 | 系統 11.20.0 |
| 比較範圍 | 完整組件矩陣 | 相同完整組件矩陣 | PATH、版本及原版 verify 前置拒絕 |
| 執行時間 | 03:41:40.741–03:42:11.568 | 03:43:00.919–03:43:32.360 | 單次版本／拒絕核對 |

上述時間只記錄這次工具執行，不是效能基準。A／B 依序執行，父程序與各自測試子程序的 Node 版本一致。完整案例沒有以不同 Node 的父子程序混跑。

凍結並核對 1,021 個 Git 追蹤檔與根目錄 node_modules 的 2,261 個一般檔案。矩陣結束後全部 SHA-256 相同；三項既有 dist 生成物已按凍結原始位元組恢復。正式 v2.2.16 五份 Release 原件及標籤所指提交 `517c04be217ff3374d25e9e2cc7f06f898a5f45b` 沒有改變。

- package-lock.json SHA-256：`1929e085622dfc1f0fe7acceadab2fefe912a0ec29cd7d99cceb9eec4b829efa`。
- release.json SHA-256：`6cb7824904f733f9192c8b60edb9112e6da41d67674aa87ec99aa7cb3929f42d`。
- 固定來源、依賴、時限與輸入；沒有 npm ci、重新安裝、升降套件、轉換鎖定檔或下載另一套 runtime。
- Git 2.56.0.windows.4、GitHub CLI 2.103.3、PowerShell 7.6.9 保持相同。Codex bundle 標示為 26.1104.22356，這是工具識別資料，不是 Node 版本要求。
- Python 實測為 Codex 內建 3.12.14；正式追蹤來源沒有 Python 程式、依賴配置或版本檔。既有歷史 Python 分析不成為目前工具入口。
- Codex 內建 pnpm 套件標示為 11.25.0；僅盤點，沒有執行安裝或替換 npm。內建 Node 套件目錄未發現 npm，不能把系統 npm 當成 Codex 內建 npm。

## 版本需求與消費者

以下位置以固定基準提交為準，避免未來工具整理改變本次證據。

| 類別 | 現行要求與消費者 | 本次判讀 |
| --- | --- | --- |
| Node 精確版本 | [release／verify](https://github.com/YUIAOI7592/BiliCDN_TW/blob/b549d5cf80cdd36a53af7d4b89d1c79f22645c99/scripts/verify.mts#L13) 要求 26.8.1 | 是強制政策；本次功能矩陣未證實必須精確到此版本 |
| Node 最低版本 | package.json 與 lock 根目錄宣告 `>=26.8.1` | 與精確閘門代表不同要求；B 不符合宣告，但組件實際可執行，不可只改其中一處 |
| TypeScript | 7.0.2，型別、架構及案例定義分析使用 `typescript/unstable/sync`／`unstable/ast` | 精確鎖定有 API 與工具一致性用途；A／B 都能載入平台元件及執行 AST 檢查 |
| esbuild | 0.28.2，建置時另檢查精確版本 | 控制產品與測試打包；本輪固定此版本，沒有測試其他 esbuild |
| Node 輸出目標 | 正式測試、匯入純度、提前重試及優化評估四處指定 `node26` | 是編譯假設；這次生成的程式在 B 可執行，不代表任意未來 node26 輸出必然適用 Node 24 |
| 瀏覽器輸出目標 | 正式 build 為 `chrome120` | 與本機 Node 分開；本輪完全保持 |
| Node 型別 | `@types/node` 26.6.4，測試與工具 tsconfig 使用 Node 型別 | 版本號不同本身不是錯誤；需要對實際 API 與執行環境持續核對，型別通過不能單獨證明相容 |
| npm 紀錄 | [build](https://github.com/YUIAOI7592/BiliCDN_TW/blob/b549d5cf80cdd36a53af7d4b89d1c79f22645c99/scripts/build.mts#L71) 的 node 取實測值，npm 取 release 設定 | 沒有精確 npm 執行閘門。本輪另以 CLI 確認 11.19.0，但一般直接 Node 建置不等於測得 npm |
| 報告中的 Node | 測試報告記錄實際版本，父程序核對報告生產者版本 | 是證據一致性檢查，不是固定 26.8.1 的專案鎖定，應保留 |
| 啟動來源 | npm scripts、verify.ps1／verify.sh 使用裸 `node`，多數子工具使用 `process.execPath` | shell 預設落到 C；後續需先明確選擇父程序，再維持子程序一致 |

九項直接開發依賴的宣告、lock 解析及安裝版本逐項一致：

| 套件 | 精確版本 | 已安裝套件宣告的 Node 下限 |
| --- | --- | --- |
| TypeScript | 7.0.2 | >=16.20.0 |
| esbuild | 0.28.2 | >=18 |
| @types/node | 26.6.4 | 未宣告 |
| Prettier | 3.9.10 | >=14 |
| unified | 11.0.5 | 未宣告 |
| remark-parse | 11.0.0 | 未宣告 |
| remark-gfm | 4.0.1 | 未宣告 |
| markdownlint | 0.41.1 | >=22 |
| github-slugger | 2.0.0 | 未宣告 |

套件未宣告 engines 不等於支援任意 Node。lock 中第三方有宣告的 Node 範圍沒有要求 26.8.1；該最低要求來自專案根目錄。實際相容結論仍以本輪執行為限。

## 比較方法與結果

私有執行器只匯入現有工具並保存結果，沒有修改正式來源或替換版本讀取。每套環境各執行一次完整測試，個別組件另依同一設定執行；沒有為取得 verify 摘要而重跑整套。

| 面向 | A | B | 判定 |
| --- | --- | --- | --- |
| `.mts`／ESM／型別移除 | 成立 | 成立 | 本次可執行 |
| 配置與九項依賴一致性 | 通過 | 通過 | 沒有套件漂移 |
| 產品／測試／工具三組型別 | 通過 | 通過 | 不改型別或來源 |
| AST 架構 | 109 個執行期模組通過 | 同樣通過 | 無循環／列出邊界違規 |
| 唯讀格式、文件、公開封存 | 通過 | 通過 | 使用同一凍結正文與原件 |
| 完整測試及工具契約 | 2,306 通過 | 2,306 通過 | failed／skipped／todo／cancelled 均為零 |
| 測試事件與來源映射 | 結構有效 | 結構有效 | 除耗時與 runtime 紀錄外，逐案無差異 |
| 兩次無寫入建置 | 自身一致 | 自身一致 | 產品產物跨環境一致 |
| JavaScript 語法與既有禁止標記 | 通過 | 通過 | 沒有恢復已撤除管線或授權 |
| 暫存封裝 | 五檔／四筆校驗通過 | 同樣通過 | 目標隔離、證據副本保留、scratch 已移除 |
| npm 入口 `test -- --list` | 退出 0、十八套件 | 同樣結果 | 指定相同 npm CLI，子程序 PATH 首項為所選 Node 目錄 |
| 原版 verify | 版本條件成立，未呼叫完整命令 | 原樣執行後退出 1 | B 的實測錯誤為 `Expected Node 26.8.1; found 24.22.1` |

C 原樣執行 verify 同樣退出 1，錯誤為 `Expected Node 26.8.1; found 26.13.0`；沒有對 C 執行完整功能矩陣。verify.ps1／verify.sh 的裸 node 行為由原始碼與 PATH 清單判讀，未額外啟動它們重跑矩陣。

各套件 A／B 都通過，案例數逐項一致：

| 套件 | A 案例 | B 案例 |
| --- | ---: | ---: |
| architecture | 52 | 52 |
| imports | 1 | 1 |
| domain-boundaries | 3 | 3 |
| domain | 111 | 111 |
| state | 81 | 81 |
| application | 849 | 849 |
| adapters | 214 | 214 |
| native-routing | 13 | 13 |
| native-transport | 222 | 222 |
| orchestration | 40 | 40 |
| adapter-boundaries | 84 | 84 |
| measurement-state | 135 | 135 |
| progressive-playurl | 64 | 64 |
| progressive-routing | 71 | 71 |
| progressive-transport | 4 | 4 |
| playurl-summary | 22 | 22 |
| control-center | 108 | 108 |
| tooling | 232 | 232 |
| 合計 | 2,306 | 2,306 |

有序 `suite／name／kind` JSON 的 SHA-256 皆為 `e96fff6f4a140a0305199085876b57ac8d030bbf1e05daa4486b25420f8220b6`。比較同時核對來源檔案、行列、案例狀態與順序，沒有只憑總數判定。既有測試工具契約涵蓋退出碼、異常／未完成報告、輸出／期限監督及資源清理；本輪沒有新增或修改案例、期限或有效斷言。

### 產物與評估

| 產物 | A／B bytes | A／B SHA-256 |
| --- | ---: | --- |
| 使用者腳本 | 538,269 | `7068ee5a53b3646c08a67691055f59905b6b4d7d585269b41284ca4fa9cfd145` |
| 外部 source map | 985,755 | `065358266e87e1b38e41fe3b3f5e25c20c78e3c7983817048c30482b6ced3166` |

建置清單唯一差異是 `tools.node` 的 26.8.1／24.22.1；其餘來源雜湊、選項與工具欄位一致。暫存封裝的校驗清單含各自路徑及建置清單雜湊，不能要求整份校驗文字跨目錄相同；每份四筆檔案校驗均獨立成立。

| 評估 | A／B 退出碼 | 數值比較與原判定 |
| --- | --- | --- |
| routing | 0／0 | JSON 完全相同 |
| measurement | 0／0 | JSON 完全相同 |
| deadlines | 0／0 | JSON 完全相同 |
| optimization | 0／0 | JSON 完全相同，7,680 組模型不計入正式案例數 |
| 六情境 early-retry | 1／1 | JSON 完全相同，原效用 FAIL 保持 |

early-retry 的「慢案例至少改善 500 ms」及「正常案例沒有不必要介入」仍為 false，「沒有停頓退步」為 true。私有執行器記錄退出 1 是否符合原結果，只證明效用結果未因 runtime 改變，不將效用 FAIL 包裝成效用通過。

沒有新執行來源隔離、Tampermonkey 安裝、自然請求效用、歷史瀏覽器矩陣或完整兩版上游比較；正式 tooling 契約的通過也不等於這些外部證據成立。

## 版本鎖定建議與優先順序

以下是本次研究建議，不是已實施的新政策。現行要求仍由 release、package、lock、正式工具與 DEVELOPMENT 維護。

| 優先序／項目 | 處置建議 | 依據、風險與後續必要工作 |
| --- | --- | --- |
| P0：父程序選擇與 PATH | 候選調整 | 明確解析 Codex Runtime 並維持子程序一致，避免裸 node 悄悄落到系統版本；路徑與 bundle 版本不宜硬寫成永久常數 |
| P0：Node 精確限制 | 候選移除 | 本輪 B 的完整組件及產物等價；後續另立方案，將精確版本拒絕改為可驗證的支援條件，不宣稱所有相近版本皆相容 |
| P0：Node 最低版本 | 候選調整 | package 與 lock 根目錄必須與新支援政策一起調整；單次 24.22.1 結果不足以聲稱整個 Node 24 系列可用 |
| P0：npm／Node 工具紀錄 | 候選調整 | 分開設定要求、實際執行與未使用；沒有呼叫 npm 的建置不能冒稱實測 npm，不因內建 pnpm 可用便更換套件管理器 |
| P1：四處 node26 目標 | 候選調整 | 與後續選定且已驗證的執行範圍對齊；目前可執行不代表保留 node26 假設對未來語法安全 |
| P1：@types/node | 保留現版並列追蹤 | 已通過實際契約，沒有本輪證據要求降版；後續需防止型別允許的較新 API 超出支援 runtime，不以改版本號取代驗證 |
| TypeScript | 保留精確鎖定 | unstable AST／同步 API 與平台套件有耦合；本輪沒有測試其他編譯器版本，不夾帶升級 |
| esbuild | 保留精確鎖定 | 產品、source map 與測試打包可重現依賴此版本；runtime 遷移不必同時改 bundler |
| Prettier／五項文件工具 | 保留精確鎖定 | 格式與 GFM／錨點行為需穩定；沒有證據支持本次一起解鎖 |
| package-lock／報告實測版本 | 保留 | 依賴重現與證據一致性不是過時 runtime 鎖定；原報告、Release 與保護資料不可改寫 |
| Python | 沒有可移除的專案鎖定 | 只記錄可用環境；不新增 requirements、版本檔或替代工具 |
| Git／Shell／其他工具 | 維持能力核對與實測紀錄 | 本輪版本相同，未測其他版本；不新增沒有依據的精確要求 |

建議下一階段先定案 Node 支援方式、父子程序選擇與版本紀錄，再處理編譯目標及型別對齊。乾淨安裝、未來 runtime 更新及其他平台仍須另有相應證據；不能把本報告作為無條件移除全部版本保護的依據。

## 原始證據與限制

私有根目錄為 `.work/toolchain-compatibility-2026-11-09/`，不作正式建置或測試輸入，也不公開機器專用絕對路徑。

| 證據 | 私有相對位置 | 內容 |
| --- | --- | --- |
| 凍結清單 | `before.json` | HEAD／標籤、1,021 份追蹤檔、2,261 份依賴、runtime 身分及原 dist 雜湊 |
| 方法 | `audit.mjs`、`compare.mjs`、`entrypoints.mjs`、`config.json` | 實際命令、比較欄位、預期政策拒絕及原效用退出碼 |
| A／B 原結果 | `baseline/`、`candidate/` | 每步 stdout／stderr／退出碼、完整 contracts、兩次建置核對、五檔封裝副本與評估 JSON |
| 綜合比較 | `comparison.json` | 案例／來源位置、產物、manifest、評估與來源定義位置的逐項差異 |
| npm／PATH | `npm-entrypoints.json`、`shell-environment.json` | 指定 Node 的 npm 入口、系統解析順序與 shell 識別 |
| 不變性 | `after-matrix.json` | 追蹤來源、依賴與恢復後 dist 的差異均為空 |
| 工具準備事件 | `preparation.json` | 首次私有備份缺少目的目錄，修正後按已凍結雜湊補存；沒有重建基準或影響產品結果 |

`before.json` SHA-256 為 `9ec34af9d9266b17a11420da7a0fdc260cf63a0afa25b0e7c0175bce1070e8d3`；`comparison.json` 為 `5309f2b0a33a3e18407de05b4ff0fb5aa4e72e1558855c9437991c75feba595c`。原始資料在本機保存；公開 checkout 不包含這些私有工具及數字檔，不宣稱公開文件檢查已重算其內容。

完整矩陣在允許暫存 Git fixture 寫入的環境執行，沒有以權限受阻替代產品判定。測試清理、封裝 scratch 與程序返回均成立；本輪沒有網站請求或正式 GM 儲存操作。

本次沒有測試乾淨安裝、其他 npm／pnpm 組合、跨平台或未來 Codex bundle；C 只有啟動來源與政策核對。既有樣本量、效用 FAIL、安裝驗收判定及停止決策完整保持。版本限制的修改需在報告確認後另立實作範圍。

## 工具鏈整理實作銜接

2026-11-09：使用者批准另立的工具鏈整理實作計畫。凍結 main／774a2314a1e75785be719fb2393ef740158a75a2、1,022 個追蹤檔與 2,261 個依賴檔；沿用上文十八套件／2,306 案及 Release 原件作比較。當次透過 Codex 依賴工具重新取得的 Node 為 24.22.1；實作採能力檢查加完整驗證，不把此版本寫成新鎖定。原研究與各項限制不改寫，階段結果於本節追加，工作狀態只由 TODO 維護。

私有工具與原始結果使用新的 `.work/toolchain-implementation-2026-11-09/`；不覆寫研究目錄。產品版本維持 v2.2.16，不重新發布腳本。
