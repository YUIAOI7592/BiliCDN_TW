# v2.1.25 模組化與 TypeScript 標準化紀錄

日期：2026-10-14 實作，2026-10-15 完成發布後安裝紀錄（Asia/Taipei）。基準 v2.1.24／85196df；正式來源仍為 `src-v2/`。本輪保持產品模式、儲存 schema、期限、取消與所有權語意，依使用者計畫分階段提交，最後統一發布 v2.1.25。

**BR-01 位置遺失未修復，歷史矩陣與 P01／P02 限制封存不重開。** 本輪的正常播放驗收不取代故障位置保護結果；原始證據見 [位置報告](BR01_v2.1.24_POSITION_LOSS_2026-10-14.md)。

## 實作與責任

| 階段 | 結果 | 提交 |
| --- | --- | --- |
| 維護工具 | 16 個 `.mjs` 遷移 `.mts`，Node 原生 ESM、工具 tsconfig、具名程序／事件／報告型別；原 CLI／期限／清理／封裝保留 | 281f0b1 |
| 格式基準 | 正式來源、測試及工具的格式變更獨立提交，透過 apply_patch 套用 | 4308113 |
| 靜態標準 | Prettier 3.9.10、format／format:check、verify 唯讀格式檢查、未使用宣告／參數及型別匯入檢查 | 7adcb70 |
| 依賴契約 | StoragePort／RuntimeIdPort 與實作分離，各用途模型與最小介面獨立；AST 精確路徑權責及契約依賴檢查 | e609f22 |
| 選路 | 無狀態候選、限制、URL 物化與主備規劃獨立；協調器保有所有修訂、計畫、提交與親和寫入，Vault 保有唯一 Native 授權 | 8fa3f10 |
| 診斷／UI | 單一去敏器、私有有界嘗試追蹤與報告序列化；文字／樣式／三個視圖獨立，控制中心保有宿主／鍵盤／視圖版本／pending 複製 | 3541154 |
| 播放器／XHR | 媒體／SDK 讀取、方法包裝及單一控制觀察者；XHR 值轉換／狀態助手，hook 保有唯一 WeakMap、安裝／還原與原生派送 | e5a9c40 |

主代理管理共用設定／契約、整合、文件、提交及發布；子代理 A 管工具後轉選路、B 管診斷／UI、C 管播放器／XHR。每輪開工先固定檔案／測試權責，共用檔案先協調；全域格式與完整驗證在子代理停止寫入後執行。安全審查改採交叉區域分工。

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2 保持；僅新增開發依賴 Prettier 3.9.10。ESLint 暫緩；未新增執行期依賴、遠端程式或 CI/CD。工具由 Node 直接執行，生成 JS 測試情境／產物保留。

## 自動驗證 N

- 工具遷移階段完整 857 案；同版本使用者腳本 345,540 bytes、SHA-256 `9a58836ab79b56ca8b4a4741a3236011df19aade872baea19d8e56066cef7e3d`，與基準逐字一致。後續格式與拆分使建置文字改變，不沿用該雜湊。
- 標準化完整 859 案；契約整合 881 案；執行期整合 **19 套件、889／889**，0 fail／skip／todo／cancelled。
- 型別涵蓋來源／測試／工具三份設定；架構 **98 個模組**、無循環；架構檢查器 37 案、工具 34 案。
- 新增合計 34 案：工具遷移 2、格式 2、精確權責／契約架構 19、播放器 3、選路 4、診斷／UI 4；執行期拆分前先以舊實作通過新增行為契約。
- verify 通過格式、型別、架構、全部契約、確定性建置、JS 語法、v2-only、暫存封裝及校驗；各受影響套件與 git diff --check 通過。
- 補充 Node 新舊診斷器對照：10 組種子共 2,000 次轉換與 10 份超量報告，快照、報告全文及 verbose 讀取次數一致；不另計正式案例，不當成瀏覽器證據。

## 內建瀏覽器來源隔離 E／S

唯一環境為 Codex 內建瀏覽器，自有 loopback 31995；來源未連接正式 GM 儲存、沒有播放第二種影片。測試程式與清理證據位於 `.work/iab-testing/2026-10-14-v2.1.25-modularization/`。

| 項目 | 判定 | 證據與限制 |
| --- | --- | --- |
| 原生 Fetch／XHR 精確攔截 | PASS | 各一個自有端點合成回應，移除 patterns；未改瀏覽器設定 |
| MP4／FLV／mixed／invalid-mixed × Fetch／XHR text／json | PASS，12 案 | 合成 API 在送出前精確回應；Catalog 輸出、分段身分／原 metadata、重讀及拒絕結果正確 |
| 安裝／還原與較新包裝所有權 | PASS，5 案 | 完整原生描述子還原，重複安裝不重疊，較新包裝保留；自有請求 0、timer 0、儲存 listener 0、寫入 0 |
| 控制中心 | PASS | 概覽／設定呈現、可信 Enter 鍵邊界、Space 診斷視圖；報告 readonly、3,391 bytes、不含原始 URL；宿主／事件及 timer 清理 |
| 播放器來源 | PASS | 真 DOM 影片快取及零面積保留，MPD 只轉換一次、不複製額外 SDK 欄位；可信點擊單一意圖、userRevision +1、原 SDK 回傳值及方法還原 |

傳輸第一次窗口因工具呼叫間隔超過 20 秒期限作廢，雖個別斷言成立也不算通過；收束後修正為同一呼叫連續服務，唯一重跑完成 17／17，事件 sequence 57～68 無截斷。UI 診斷第一個窗口欠缺合成 GM_info，視圖前提不完整；補入自有管理器資訊後重跑才取得完整報告。這些是測試情境修正，未修改產品執行期。

來源 bundle SHA-256：transport `90fc4376158782b3025e848efc282087b6f9a83e2218d9afbab94693d132c464`；UI `87f518cb5d313ea4551eed0f3b12e80df505d732147b24ff33c53d973040bc6a`；player `1f6d6ff3b6694c344b03d8e665f25729b10f09ba67d9cf162820595d4f7a087a`。它們是合成測試 bundle，不能代替正式使用者腳本本體。

## 安全、發布與實際安裝

Codex Security 固定範圍 `85196df1c176cef0e373dba8450a3dd5efc4e376..e5a9c403bac83859bd5540f78716522c1f52d1c6`，scan `f1e3f151-b556-4e63-a9d7-25d68992a0ff`；前置能力就緒、獨立架構模型保存，193／193 個來源／測試項目完成審查，0 候選／0 發現；2026-10-14T14:59:24Z 完成封存。結果記入最新版 [TEST_REPORT](../../../docs/TEST_REPORT.md)。

### 公開發布

[v2.1.25 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.25) 於 2026-10-14T15:10:20Z 發布。發布提交 6916e0523a9aa4906d761598943333fecebac57a；遠端 main 與 annotated tag 的 peeled commit 核對相同，標籤物件為 6c783f8f34964de3546b2ea13f0bd5eb7787cb82。後續 main 的安裝紀錄提交不移動版本標籤，也不回寫已發布快照。

唯一附件 BiliCDN_TW.user.js，368,486 bytes，SHA-256 `2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6`。2026-10-15 再次取得公開 latest，版本、大小及 SHA-256 與本機封裝／GitHub 附件一致。

### 實際安裝 I：本輪範圍通過

先嘗試既有公開 latest 入口，但停在 Tampermonkey 安裝中繼頁，工具未取得可操作的管理器確認頁；指定影片仍執行舊本體，該次不作新版功能判定。使用者於 2026-10-15 確認已更新後，在同一內建瀏覽器新載入指定 BV1tFZZBQE57 才開始有效窗口。前次 Debugger 暫停與跨日工具空窗不計入播放或故障期限。

| 項目 | 有效判定與證據 |
| --- | --- |
| 完整執行身分 | PASS：Tampermonkey 5.5.1、GM_info 腳本 2.1.25；完整可執行 IIFE 366,528 UTF-8 bytes，SHA-256 `a85809d70a3bc8a711de6df57f2120c44ff0c6b8fdf51c160ed0a08f5d8b340d`，與封裝中相同 IIFE 一致。雜湊排除管理器外包裝及 metadata，與整份附件雜湊分列 |
| 唯一實例／hooks | PASS：RuntimeController／ControlCenter 各 1；Fetch／XHR 均 installed，原因 fetch-and-xhr-verified；頁面面板 1 |
| Auto 1 倍 | PASS：9.866 秒內媒體時間 +9.860 秒、影格 +592；可信暫停／恢復及 Right 短 seek 後 readyState 4、seeking false 且繼續進度 |
| Auto 2 倍 | PASS：15.105 秒內媒體時間 +30.208 秒、影格 +1,811；可信暫停／恢復及 Right 短 seek 後 readyState 4、seeking false 且繼續進度 |
| 控制中心 | PASS：經實際播放器入口開啟概覽、設定與診斷；設定 Enter、診斷 Space 前後 userRevision／seekRevision 不變、保持播放。32,213 字元唯讀 JSON 報告為 v2.1.25，無原始 URL；未操作複製、清除或設定寫入 |
| 清理 | PASS：關閉控制中心、移除斷點並停用 Debugger、釋放 object group、關閉自有影片分頁、停止 loopback 服務；自有攔截／包裝／頁面 timer／訂閱均 0，設定寫入與剪貼簿寫入 0，倍速復原原本 2 倍 |

兩個倍速窗口及最終狀態的核心 reloadRevision／reloadCount 均 0。完整樣本及畫面保存在上述私有證據目錄的 INSTALLED.json／installed-v25-diagnostics.jpg。只判定本輪模組化差異與正常回歸範圍通過；BR-01 位置遺失未修復，歷史故障、背景、gate 與剪貼簿矩陣維持封存。
