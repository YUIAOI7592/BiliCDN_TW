# BiliCDN_TW v2 專案脈絡

本文件是現行產品與開發契約。文件用途及歷史紀錄見 [docs/INDEX.md](INDEX.md)；版本與工具設定以 [release.json](../release.json)、[package.json](../package.json) 和 lockfile 為準。目前正式發行為 [v2.1.8](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.8)。

**v2.1.8 已確認發布**，包含 MP4／FLV 修正；自動驗證及必要安全審閱已完成，封存安全報告的 `partial coverage` 中途標記限制保留於 [TEST_REPORT](TEST_REPORT.md)。依使用者要求先發布 userscript，再完成 Tampermonkey 更新；本次授權的合法 MP4 試看片段與公開 DASH 瀏覽器回歸已完成。完整公開 MP4 尚無現場樣本，FLV 只有自動契約證據，兩者保留為覆蓋限制。

## 現行產品

- 正常模式參考 B 站原生來源為持久開關，預設關閉。發布前完成自動與必要安全驗證，實際 Chrome／Tampermonkey 結果另行記錄。
- 唯一正式來源：`src-v2/`。
- 正式入口：`src-v2/entry.ts`。
- 目標平台：最新版 Chrome＋Tampermonkey。
- 正式產物：`Release/v<version>/BiliCDN_TW.user.js`（`version` 取自 `release.json`）。
- v1.9.6 僅作功能參考，不是建置輸入或相容目標。
- 歷史計畫、研究與驗收記錄集中於 `archive/retired/docs/`；舊開發工具與本機證據集中於 `archive/retired/local/`。位置對照見 [封存索引](../archive/retired/README.md)，現行 `src-v2/`、`tests-v2/`、授權基準與全部 `Release/` 維持原位。

v2 是全新 TypeScript 架構。它不讀取 v1 設定或學習資料，不提供 `unsafeWindow.BiliCDN`、檔頭設定、舊 snapshot alias、migration 或測試 bridge。

## 產品不變量

- 首筆可歸因的播放器媒體請求可觸發一次最長三秒、最多三條合法路線並行的起播預測試；等待中的請求共用一個窗口，MP4／FLV 不逐段重開窗口。預設正常模式不以 `root-original` 或 `native-signed` 候選身分探測或回退。
- Catalog 保留 11 個內建節點，其中 4 個預設不可用。探測上限不縮減完整候選池；其餘合法節點可參與排名、備援與後續健康測速。Catalog-only 播放器輸出最多五個與主線及彼此不同 Host 的合法備用網址。
- 預設正常模式只依內建 Catalog 候選選路、探測和提供播放器網址，不直接採用 B 站提供的原始或備用路線；若 Catalog Host 與原線重合，生成的網址可能與原線相同。無法安全生成合法 Catalog 路線時，在送出前封鎖該媒體請求。
- 開啟持久原生來源參考開關後，正常模式才可依現有授權與限制條件納入原始及 Native 路線。本分頁原線對照模式獨立於此開關，只使用 B 站提供的合法 exact signed URL，且不進行腳本測速、自動換線或核心恢復。
- 起播期無明確 Transport 失敗而持續無影片進度時，可一次性提交不同 host 的合法備援，並由唯一恢復控制器受限重載。
- 健康播放期間量測只更新證據，不改 affinity。
- Catalog 只來自內建可信清單；Native 只能使用當前 epoch、同 representation 的 exact signed URL。可信 API 首次接納同群組時，撤銷先前 page-hint／player-MPD 的可選路線與 handle；後到提示不得重新授權。
- 路徑無法安全辨識的當前 epoch exact signed URL 只可供觀察與禁止判定，不授予 Native 選路或主動測速權限。
- signed URL 不得持久化或進入診斷。
- black、dead、使用者停用、預設不可用與 host-lock 優先於排名、固定設定及 fallback。
- video／audio 證據與恢復隔離。
- 已開始的播放器請求不取消、不重送。
- Fetch／XHR hook 安裝狀態與原生呼叫僅屬腳本內證據；Catalog-only 政策只涵蓋腳本處理的 playurl 輸出與可攔截媒體請求，實際網路請求及其他瀏覽器入口須由 Chrome Network 核對。
- Fetch body 維持單 reader，取消原因傳回原 reader。
- Fetch 的政策判定與原生送出共用同一個瀏覽器正規化的 Request；主動測速不跟隨轉址，只接受受檢 host 的直接 206 回應。
- 停用後不改寫、不主動量測；網站請求保持原樣。
- 網站 Worker constructor 完全不碰觸。
- 所有 affinity 變更由 `RouteCoordinator` 建立可追溯的 `RouteDecision`。
- 所有 reload 或恢復操作由 `RecoveryController` 建立可追溯的 `RecoveryAction`。
- `RuntimeController` 統一協調設定失效、探測／恢復重設與 fallback 事件；控制中心透過 `ControlCommands` 執行變更。`PlayurlController` 管理 representation 登記與 epoch，適配器處理 payload 相容及寫回。
- `MeasurementMetaStore` 保留既有 metadata key 與量測鎖語意，按需讀取資料；不可把它描述成與設定、限制、證據 store 相同的驗證與訂閱機制。
- `SignedRouteVault` 集中管理簽名路線授權與索引；適配器的請求狀態、payload 和 manifest fingerprint 仍可能在分頁記憶體中含完整網址，禁止進入持久學習資料及診斷。

## v2.1.8 MP4／FLV 契約

- `PlayurlAdapter` 辨識 root、`data`、`result`、`video_info` 已知容器中的 DASH 與 MP4／FLV `durl`；保留分段順序及原有時長、大小、品質資料，不以 `order` 是否存在或連續作為分段索引。
- 每段各有 representation 身分。Catalog 改寫使用 Vault 提供的第一個合法、可安全換 Host 的來源 handle，必要時可取自同段備用來源；不以不同片段的 path/query 代替本段來源，不建立第二份 Native 授權索引。
- 可安全換成正常 Catalog 目標的 PCDN 來源僅提供生成能力，不因此取得 Native 可選資格；DASH 則保留同 representation 合法 incoming exact／Catalog alias 的既有 path/query 行為。Catalog-only 起播沒有有效測速結果時不提交測速贏家，送出前由完整剩餘合法 Catalog 池正常排名。
- 已辨識的 progressive／混合播放資料先完成規劃才寫回 URL 欄位；必要分段無法規劃時回傳拒絕結果，保留輸入而不輸出部分成功的分段列表。此原子性描述 payload 寫回，不表示 Vault／控制器登記可回滾。
- 處理結果為 readonly `PlayurlTransformResult`，含 `accepted`、已辨識格式、影片／音訊／分段數量、數字 upstream code 與固定原因列舉。Fetch／XHR 依 `accepted` 判斷；Catalog-only 拒絕時 Fetch 提供 HTTP 503，XHR 提供安全失敗內容並保留原生 HTTP 狀態。
- 模式依序套用整體停用、分頁原生對照及正常選路；正常模式保留固定 CDN／自動選路與原生來源開關，禁止規則始終有效。固定 CDN、Catalog overrides 或原生來源設定變更會失效舊計畫並重設測速／恢復；送出與提交仍重查當前身分及設定。
- 傳輸摘要只保存一筆最近結果，使用明確欄位清單、最多三種格式及有上限的數量，不保存回應 body、網址、path/query/token 或例外文字。它是腳本觀察，不是實際 CDN 目的地或播放成功的證明。

## 交付規則

- 外部 B 站 CDN 優化專案的調查見 [archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md](../archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md)；Node 初篩與內建瀏覽器播放結果見 [archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md)。新增節點計畫已撤銷，只保留測試紀錄；現行 Catalog 與發布範圍不變。

- 工具版本由 release 設定與 lockfile 鎖定；TypeScript 同時供型別檢查與本機 AST 架構檢查使用，esbuild 供建置／測試打包使用。
- 發布前必須通過 typecheck、architecture、功能測試、可重現建置、語法與 checksum 驗證。
- mock／自動測試與真實 Chrome／Tampermonkey 結果分開記錄。
- GitHub Release 只附 userscript；CHANGELOG、TEST_REPORT、manifest 與 SHA-256 留在儲存庫。
- v2 不產生 incremental／cumulative patch，也不依賴舊 bundle fixture。
- 不建立 CI/CD 或 GitHub Actions。
- Codex Security 按風險使用：安全敏感變更或使用者明確要求時執行，不強制每版掃描。`npm run verify` 不包含安全掃描。
- 程式或發行狀態改變時，同步維護現行指南與最新驗證摘要；歷史文件保留原始日期、版本、觀察及限制，已封裝的 `Release/v*/` 不回寫。
- v2.1.6 Chrome／Tampermonkey 驗收已由使用者批准通過、已結案；其覆蓋限制與舊文件的待驗收文字不構成現行待辦。v2.1.7 沒有新的瀏覽器結果宣稱。
- v2.1.8 已完成發布、Tampermonkey 更新及本次授權的 Chrome 回歸：合法 MP4 試看片段與公開 DASH 均有超過 12 秒的連續播放觀察及 Catalog 直接 HTTPS 206 證據。原 MP4 影片已改會員限定，不宣稱完整公開 MP4 驗收；公開 DASH 較早短暫緩衝後恢復，不宣稱零緩衝。完整公開 MP4 與 FLV 現場覆蓋限制不另列為已批准待辦，也不重開 v2.1.6 驗收。
