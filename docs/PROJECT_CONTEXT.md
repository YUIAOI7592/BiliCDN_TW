# BiliCDN_TW v2 專案脈絡

本文件是現行產品與開發契約。文件用途及歷史紀錄見 [文件索引](INDEX.md)；版本與工具設定以 [release.json](../release.json)、[package.json](../package.json) 和 [依賴鎖定檔](../package-lock.json) 為準。內建節點清單稱為 Catalog，原生簽名路線稱為 Native。

依 **2026-10-04** 紀錄，[v2.1.8](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.8) 已發布，包含 MP4／FLV 修正；標準更新及授權的 MP4 試片／公開 DASH 回歸已完成。自動、安全、瀏覽器結果及覆蓋限制見 [驗證報告](TEST_REPORT.md)，目前已批准工作見 [TODO](TODO.md)。

## 現行產品

- 正常模式參考 B 站原生來源為持久開關，預設關閉。發布前完成自動與必要安全驗證，實際 Chrome／Tampermonkey 結果另行記錄。
- 唯一正式來源：`src-v2/`。
- 正式入口：`src-v2/entry.ts`。
- 目標平台：最新版 Chrome＋Tampermonkey。
- 正式產物：`Release/v<version>/BiliCDN_TW.user.js`（`version` 取自 `release.json`）。
- v1.9.6 僅作功能參考，不是建置輸入或相容目標。
- 歷史計畫、研究與驗收記錄集中於 `archive/retired/docs/`；舊開發工具與本機證據集中於 `archive/retired/local/`。位置對照見 [封存索引](../archive/retired/README.md)，現行 `src-v2/`、`tests-v2/`、授權基準與全部 `Release/` 維持原位。

v2 是全新 TypeScript 架構。它不讀取 v1 設定或學習資料，不提供 `unsafeWindow.BiliCDN`、檔頭設定、舊快照別名、遷移或測試橋接介面。

## 產品不變量

- 每分頁首筆可歸因的播放器媒體請求可觸發一次最長三秒、最多三條合法路線並行的起播預測試；等待中的請求共用一個窗口，MP4／FLV 不逐段重開窗口。預設正常模式不以 `root-original` 或 `native-signed` 候選身分探測或回退。
- Catalog 保留 11 個內建節點，其中 4 個預設不可用。探測上限不縮減完整候選池；其餘合法節點可參與排名、備援與後續健康測速。僅使用 Catalog 播放器輸出最多五個與主線及彼此不同主機的合法備用網址。
- 預設正常模式只依內建 Catalog 候選選路、探測和提供播放器網址，不直接採用 B 站提供的原始或備用路線；若 Catalog 主機與原線重合，生成的網址可能與原線相同。無法安全生成合法 Catalog 路線時，在送出前封鎖該媒體請求。
- 開啟持久原生來源參考開關後，正常模式才可依現有授權與限制條件納入原始及 Native 路線。本分頁原線對照模式獨立於此開關，只使用 B 站提供的合法精確簽名 URL，且不進行腳本測速、自動換線或核心恢復。
- 起播期無明確傳輸失敗而持續無影片進度時，可一次性提交不同主機的合法備援，並由唯一恢復控制器受限重載。
- 健康播放期間量測只更新證據，不改親和主機。
- Catalog 只來自內建可信清單；Native 只能使用當前內容週期、同媒體表示的精確簽名 URL。可信 API 首次接納同群組時，撤銷先前 page-hint／player-MPD 的可選路線與不透明識別碼；後到提示不得重新授權。
- 路徑無法安全辨識的當前內容週期精確簽名 URL 只可供觀察與禁止判定，不授予 Native 選路或主動測速權限。
- 簽名 URL 不得持久化或進入診斷。
- 黑名單（`black`）、失效（`dead`）、使用者停用、預設不可用與主機鎖定優先於排名、固定設定及備援。
- 影片／音訊證據與恢復隔離。
- 已開始的播放器請求不取消、不重送。
- Fetch／XHR 攔截安裝狀態與原生呼叫僅屬腳本內證據；僅使用 Catalog 政策只涵蓋腳本處理的 playurl 輸出與可攔截媒體請求，實際網路請求及其他瀏覽器入口須由 Chrome 開發者工具的網路面板（Network）核對。
- Fetch 本文維持單讀取器，取消原因傳回原讀取器。
- Fetch 的政策判定與原生送出共用同一個瀏覽器正規化的 Request；主動測速不跟隨轉址，只接受受檢主機的直接 206 回應。
- 停用後不改寫、不主動量測；網站請求保持原樣。
- 網站 Worker 建構函式完全不碰觸。
- 所有親和主機變更由 `RouteCoordinator` 建立可追溯的 `RouteDecision`。
- 所有重載或恢復操作由 `RecoveryController` 建立可追溯的 `RecoveryAction`。
- `RuntimeController` 統一協調設定失效、探測／恢復重設與備援事件；控制中心透過 `ControlCommands` 執行變更。`PlayurlController` 管理媒體表示登記與內容週期，適配器處理資料內容相容及寫回。
- `MeasurementMetaStore` 保留既有中繼資料鍵與量測鎖語意，按需讀取資料；不可把它描述成與設定、限制、證據儲存元件相同的驗證與訂閱機制。
- `SignedRouteVault` 集中管理簽名路線授權與索引；適配器的請求狀態、資料內容和資訊清單指紋仍可能在分頁記憶體中含完整網址，禁止進入持久學習資料及診斷。

## v2.1.8 MP4／FLV 契約

以下契約自 v2.1.8 納入。

- `PlayurlAdapter` 辨識根層、`data`、`result`、`video_info` 已知容器中的 DASH 與 MP4／FLV `durl`；保留分段順序及原有時長、大小、品質資料，不以 `order` 是否存在或連續作為分段索引。
- 每段各有媒體表示身分。Catalog 改寫使用 Vault 提供的第一個合法、可安全換主機的來源不透明識別碼，必要時可取自同段備用來源；不以不同片段的路徑／查詢字串代替本段來源，不建立第二份 Native 授權索引。
- 可安全換成正常 Catalog 目標的 PCDN 來源僅提供生成能力，不因此取得 Native 可選資格；DASH 則保留同媒體表示合法傳入的精確／Catalog 別名的既有路徑／查詢字串行為。僅使用 Catalog 起播沒有有效測速結果時不提交測速贏家，送出前由完整剩餘合法 Catalog 池正常排名。
- 已辨識的漸進式／混合播放資料先完成規劃才寫回 URL 欄位；必要分段無法規劃時回傳拒絕結果，保留輸入而不輸出部分成功的分段列表。此原子性描述資料內容寫回，不表示 Vault／控制器登記可回滾。
- 處理結果為唯讀 `PlayurlTransformResult`，含 `accepted`、已辨識格式、影片／音訊／分段數量、數字上游 `code` 與固定原因列舉。Fetch／XHR 依 `accepted` 判斷；僅使用 Catalog 拒絕時 Fetch 提供 HTTP 503，XHR 提供安全失敗內容並保留原生 HTTP 狀態。
- 模式依序套用整體停用、分頁原生對照及正常選路；正常模式保留固定 CDN／自動選路與原生來源開關，禁止規則始終有效。固定 CDN、Catalog 覆寫設定或原生來源設定變更會失效舊計畫並重設測速／恢復；送出與提交仍重查當前身分及設定。
- 傳輸摘要只保存一筆最近結果，使用明確欄位清單、最多三種格式及有上限的數量，不保存回應本文、網址、路徑／查詢字串／權杖或例外文字。它是腳本觀察，不是實際 CDN 目的地或播放成功的證明。

## 交付規則

- 外部 B 站 CDN 優化專案的調查見 [外部 CDN 專案研究（2026-09-25）](../archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md)；Node 初篩與內建瀏覽器播放結果見 [CDN 測試結果（2026-09-25）](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md)。新增節點計畫已撤銷，只保留測試紀錄；現行 Catalog 與發布範圍不變。

- 工具版本由發行設定與依賴鎖定檔鎖定；TypeScript 同時供型別檢查與本機 AST 架構檢查使用，esbuild 供建置／測試打包使用。
- 發布前必須通過型別檢查（`typecheck`）、架構檢查（`architecture`）、功能測試、可重現建置、語法與校驗值驗證。
- 模擬／自動測試與真實 Chrome／Tampermonkey 結果分開記錄。
- GitHub Release 只附使用者腳本；CHANGELOG、TEST_REPORT、資訊清單與 SHA-256 留在儲存庫。
- v2 不產生增量／累積修補，也不依賴舊打包產物測試情境。
- 不建立 CI/CD 或 GitHub Actions。
- Codex Security 按風險使用：安全敏感變更或使用者明確要求時執行，不強制每版掃描。`npm run verify` 不包含安全掃描。
- 程式或發行狀態改變時，同步維護現行指南與最新驗證摘要；歷史文件保留原始日期、版本、觀察及限制，已封裝的 `Release/v*/` 不回寫。
- v2.1.6 Chrome／Tampermonkey 驗收已由使用者批准通過、已結案；其覆蓋限制與舊文件的待驗收文字不構成現行待辦。v2.1.7 沒有新的瀏覽器結果宣稱。
- v2.1.8 的 2026-10-04 完成紀錄與限制見 [TEST_REPORT](TEST_REPORT.md)：完整公開 MP4 尚無現場樣本，FLV 僅有自動契約證據；覆蓋限制不另列為已批准待辦，也不重開 v2.1.6 驗收。
