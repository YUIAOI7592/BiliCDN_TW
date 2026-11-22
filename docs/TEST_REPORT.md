# BiliCDN_TW v2.2.26 完整驗證報告

驗證日期為 2026-11-22（Asia/Taipei）。修復前用 v2.2.25 的正式 XHR 掛鉤、選路器及證據儲存層重現。

## 驗收結論

有合法替代來源時，第一筆影片 XHR 原生逾時後，網站發起的下一筆同資源 XHR 在證據寫入完成前即可改派。兩種受控交錯中，錯派從 **2/2 降到 0/2**。腳本未自行發起重試。真站尋位的節省秒數尚未量測。[v2.2.25 真站時序](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#基準片的續播尋位延遲)

## 自動驗證

扣住證據儲存鎖，等待第一筆失敗開始寫入後，在鎖仍被占用時檢查第二筆實際原生 `send()` 的目標、送出次數、Range 與 timeout。修復前兩案均在目的地主機斷言失敗。

| 網站發起的重送 | v2.2.25 | v2.2.26 | 保留設定 |
| --- | --- | --- | --- |
| 預設模式，在原生逾時回呼立即重送 | 派回 A | 證據鎖釋放前派往合法 B 一次 | 相同 Range、13 秒 timeout |
| 僅內建模式且固定 A，事先 open，逾時後 3 ms send | 派回 A | 證據鎖釋放前派往合法 B 一次 | 相同 Range、16 秒 timeout |

另驗證逾時前已派送的請求、已提交失敗、唯一合法來源、Fetch／音訊／其他影片表示、授權與政策修訂、換片、取消、合成逾時和已知跨主機轉址。證據寫入失敗與重疊提交只清除各自登記；三秒期限及最多 32 筆同時有效。晚到結果不奪回已採用的備援。[正式 XHR 掛鉤案例](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/cases/transport/xhr.ts) · [選路控制器案例](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/cases/routing/pending-xhr-timeout.ts) · [業務契約](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/business-contracts.json)

Windows 完整 `npm run verify` 通過，18 個正式套件共 2,325 案，失敗、取消、跳過與待辦均為零，132 條業務規則均連到通過的具名案例。檢查包含型別、架構、格式、文件、公開封存、可重現建置、產物語法及暫存封裝校驗。執行環境為工作區提供的 Node 24.22.3，用同一 Node 執行 npm CLI 11.20.0。

| 工具 | 執行位置 |
| --- | --- |
| Node | `C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe` |
| npm CLI | `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` |

## 安全差異

逾時訊號限已派送且歸屬明確的可信原生影片 XHR。選路仍驗證目前內容、來源授權、政策與合法輸出 URL，Native 使用精確授權，僅內建模式只採用合法 Catalog。暫避只在記憶體保存。未另執行安全掃描。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.25 的五個發行原件已與 Git 標籤、原校驗清單及獨立解壓副本逐檔核對，依授權轉入公開封存。封存 SHA-256 為 `f34af2e49b16d63a916cd1b2ae81267f9a0308331d2285ff621aaf9692515f1c`。全部公開包獨立解壓後通過 `archive:check -- --restore-root`。原 Git 標籤與 GitHub Release 保留。[v2.2.25 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2225-完整正文保存2026-11-22)

2026-11-22 16:00（Asia/Taipei）發布。發布時遠端 `main` 與 `v2.2.26` 標籤均指向 `a5b112b49937370d28c54c9d20833587cf52f2b5`。GitHub latest 為 v2.2.26，唯一附件為 `BiliCDN_TW.user.js`。未帶憑證取得 latest 與固定版本均回傳 HTTP 200，腳本標頭版本均為 2.2.26。兩個公開檔案與正式封裝逐位元組相同，皆為 562,498 bytes，SHA-256 為 `74e9bec4f6558c4126a9082aa440ef1428508abdee36aae35b8c6f975bb676a4`，與 GitHub 附件登記一致。[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.26) · [latest 下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) · [固定版下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/download/v2.2.26/BiliCDN_TW.user.js)

## 來源隔離與實際安裝

發布前以 Node 驗證正式掛鉤與受控事件。來源隔離未執行。安裝版於 R1 取得自然逾時改派的直接證據。

<a name="v2226-r1-安裝驗收與供片調查"></a>

### v2.2.26 R1 安裝驗收與供片調查

2026-11-22 16:03:50.480 至 16:12:13.971（Asia/Taipei）。單一隱藏 Codex IAB 分頁，沿用既有 Tampermonkey。兩個 P1 各用新文件，保留網站續播與 Auto 畫質。靜音確認於導覽後 919.3／1,311.2 ms，兩次均讀到真正主影片 `muted=true`、`readyState=0`。播放確認從靜音、實際倍率及進度成立後起算。

| 案例 | 結果與證據 |
| --- | --- |
| I-01 安裝身分與接線 | **PASS**。兩份影片文件實際 Fetch、XHR `open`／`send` 各自指向同一腳本。從管理器外層切出完整本體，各 562,498 bytes，版本及 SHA-256 與正式附件相同。三個函式閉包引用同一個 TransportContext 及 RouteCoordinator。 |
| I-02 自然逾時後暫避 | **PASS，完整配對 1/1**。同一影片表示、授權週期和 Range，普通決策原擬回到 A，暫避後實際原生送出 B 一次，早於首筆失敗證據提交。B 由同主機直接回 206 並完成。下列時序取自掛鉤及獨立配對的 Network。 |
| I-03 正常播放 | **PASS，4/4**。四窗各至少 60 秒，倍率符合、持續靜音與進度，無連續兩秒無合格進度及媒體錯誤。另記 2× 畫格掉落，見下表。 |
| I-04 安裝版受控注入 | **未執行**。本輪已有自然命中與提交前改派證據。網站沒有注入故障或隔離正式學習的變更，固定 Catalog、事先 `open()` 等受控邊界沿用正式 Node 回歸。 |

<a name="v2226-r1-自然逾時改派"></a>

#### 影片 XHR 自然逾時與改派

第二片 `BV1BDVzzZEg4` 的單調時間，從該文件導覽起算。A 為 `upos-sz-mirroraliov.bilivideo.com`，B 為 `cn-hk-eq-01-03.bilivideo.com`。

| 時點（ms） | 觀察 |
| --- | --- |
| 1,658.0 | 第一筆同資源影片 XHR 原生送往 A，網站設定 5,000 ms timeout。Network 約 697 ms 收到 206 標頭，本文未完成。 |
| 6,663.2 | 原生可信逾時，掛鉤終態 status 0，已觀察 4,322,134 bytes。選路器同步登記 A 的暫避，失敗證據開始提交。 |
| 6,666.1、6,667.1 | 兩次選路判定的普通目標都為 A，暫避分支均選到合法 Native B。 |
| 6,667.4 | 網站下一筆 XHR 實際只送 B 一次，距逾時 **4.2 ms**。同一表示與授權，Network 也確認同一 Range，保留 5,000 ms timeout。 |
| 6,669.8 | 首筆失敗證據才回傳 `committed`，晚於 B 送出約 2.4 ms。 |
| 7,833.8 | B 的同一筆掛鉤終態為 206，收到標頭約 96.5 ms，約 1,166.5 ms 完成 9,278,256 bytes。Network 觀察到直接 206、完整非瀏覽器快取傳輸，編碼傳輸量 9,290,209 bytes。 |

第二片產品觀測取得 74 筆歸因影片 XHR 終態，其中 73 筆 206 成功及一次可信原生逾時。該逾時的暫避登記、同資源重送及非快取 206 完成均為 1/1。基準片較晚啟用產品觀測點，該段 24 筆歸因影片 XHR 終態皆為 206，起播段的可信逾時分母未取得。這次直接觀察到暫避改變派送主機，若重送到 A 需再等多久未量測。

#### 播放與畫格

| P1 樣片 | 倍率 | 窗長／媒體進度（秒） | 原生畫面 | 最低可播緩衝（秒） | 掉落／總畫格 |
| --- | --- | --- | --- | --- | --- |
| `BV1tFZZBQE57` | 1× | 60.114／60.114 | 2160p | 69.408 | 11／3,604（0.3%） |
| `BV1tFZZBQE57` | 2× | 60.002／120.016 | 2160p | 34.205 | 743／7,193（10.3%） |
| `BV1BDVzzZEg4` | 2× | 60.028／119.704 | 1080p → 2160p | 0 | 914／7,186（12.7%） |
| `BV1BDVzzZEg4` | 1× | 60.124／60.126 | 2160p | 28.657 | 0／3,607（0%） |

可播緩衝為原生連續緩衝按倍率折算。四窗共 616 筆取樣，最長間隔 626 ms。基準片同一 500 ms 排程格偶有兩次取樣，停滯依實際單調時間與進度判定。畫格為原生 `getVideoPlaybackQuality()` 差值，兩片可配對的 2160p 影片表示為 AV1、約 60 fps。樣本來自隱藏 IAB，掉幀來源及實際前景呈現尚未分離。

基準片續播 `seeking` 至 `seeked` 為 **0.421 秒**，首個 `playing` 於導覽後 2.901 秒。首次正常窗口前另有 `waiting` 至 `playing` **1.811 秒**。第二片續播尋位 **0.831 秒**，首個 `playing` 於 2.188 秒。逾時發生在第二片已完成續播尋位後，其 2× 窗口另有一次 **0.189 秒**的 `waiting` 至 `playing`。兩筆等待和播放窗口分列，未以時間接近推定 CDN 因果。

#### 站方來源、實際傳輸及快取

頁面內嵌原始播放資訊均為 DASH。基準片 21 個影片表示，第二片 18 個，各有 3 個音訊表示，兩片所列主機均為 `upos-hz-mirrorakam.akamaized.net` 與 `upos-sz-mirrorcosov.bilivideo.com`。未取得原始 `playurl` HTTP 正文。下表只計可用 Network 配對至普通 XHR 完成的影音 206，位元組為 Network 編碼傳輸量，時間為派送至收到標頭。

| 樣片 | 媒體 | 實際回應主機 | 非瀏覽器快取／瀏覽器快取 | 標頭時間（ms） | 非快取編碼傳輸量（bytes） |
| --- | --- | --- | --- | --- | --- |
| 基準片 | 影片 | `upos-sz-mirroraliov.bilivideo.com` | 29／0 | 8.6–184.7 | 196,594,280 |
| 基準片 | 音訊 | `upos-sz-mirroraliov.bilivideo.com` | 47／0 | 7.8–40.3 | 2,617,789 |
| 第二片 | 影片 | `cn-hk-eq-01-03.bilivideo.com` | 27／5 | 90.9–130.6 | 143,430,210 |
| 第二片 | 影片 | `upos-sz-mirroraliov.bilivideo.com` | 4／2 | 8.3–34.1 | 3,741,019 |
| 第二片 | 音訊 | `upos-sz-mirroraliov.bilivideo.com` | 31／2 | 8.2–543.7 | 825,130 |

CDP 49 次續讀有 8 次環形緩衝截斷，上表是完整配對子集，無法作為全窗 CDN 比率。`mirroraliov` 的上述非瀏覽器快取回應均帶有邊緣 HIT 訊號；香港 `cn-hk-eq-01-03` 的邊緣快取狀態未知。另由請求堆疊辨認每片各 3 筆範圍探測，均排除於表外。基準片探測 `mirrorcos`、`cn-hk-eq-01-03`、`cn-hk-eq-01-05`；第二片探測 `mirroraliov`、`cn-hk-eq-01-03`、`cn-hk-eq-01-01`。

**下一案優先調查 2160p／60 fps 的 2× 畫格掉落。** 基準片 2× 的最低可播緩衝仍為 34.205 秒，掉落率由 1× 的 0.3% 增至 10.3%。先以相同表示和倍率區分解碼、畫格呈現與背景排程。香港節點已有真實成功供片樣本，單機單次結果不足以調整 CDN 預設排名。

**清理 PASS。** 每片恢復進頁時的 1×，保持靜音並暫停。移除兩份文件的取樣器、媒體監聽與共 12 個觀測點，銷毀 CDP 物件群組及關閉 Network／Debugger／Runtime。Page.disable 未成功，由關閉自有分頁結束其生命週期，IAB 清單確認分頁已移除。

<a name="v2225-r1-安裝驗收與供片調查"></a>

[v2.2.25 R1 安裝驗收與供片調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2225-r1-安裝驗收與供片調查)。

<a name="v2224-r1-安裝驗收與供片調查"></a>

[v2.2.24 R1 安裝驗收與供片調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2224-r1-安裝驗收與供片調查)。

<a name="v2223-r1-安裝驗收-2026-11-19"></a>

[v2.2.23 R1 安裝結果](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2223-r1-安裝驗收-2026-11-19)。

<a name="v2222-r1-安裝驗收-2026-11-19"></a>

[v2.2.22 R1 安裝結果](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2222-r1-安裝驗收-2026-11-19)。

## 歷史驗證導覽

<a name="v2220-安裝身分與變更接線重新判定2026-11-13"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2220-安裝身分與變更接線重新判定2026-11-13)。

<a name="驗收門檻檢討2026-11-13"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#驗收門檻檢討2026-11-13)。

<a name="管理器探索禁令撤銷註記2026-11-13"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#管理器探索禁令撤銷註記2026-11-13)。

<a name="v2218-r1-安裝身分與設定頁2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2218-r1-安裝身分與設定頁2026-11-12)。

<a name="文件與測試清查整理2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#文件與測試清查整理2026-11-12)。

<a name="斷言審核與精簡2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#斷言審核與精簡2026-11-12)。

<a name="全量逐案語意審核與最終精簡2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#全量逐案語意審核與最終精簡2026-11-12)。

<a name="v2217-r1-採樣與抑制專項2026-11-11"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r1-採樣與抑制專項2026-11-11)。

<a name="v2217-r2-低緩衝與額度受控補驗2026-11-11"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r2-低緩衝與額度受控補驗2026-11-11)。

<a name="v2216-r1-載入身分與選路提交接線2026-11-09"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2216-r1-載入身分與選路提交接線2026-11-09)。

<a name="v2215-r1-載入身分與模組初始化2026-11-09"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2215-r1-載入身分與模組初始化2026-11-09)。

<a name="v2219-r1-安裝身分與變更接線2026-11-12"></a>

[v2.2.19 原始發行與 R1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2219-完整正文保存2026-11-12)。

版本、議題、日期由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 維護；以下錨點只作相容導引。

<a name="v2214-載入身分驗證2026-11-08"></a>

[原版載入身分與 R1／R2 限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2214-載入身分驗證2026-11-08)。

<a name="v2212-r1-三頁與刷新專項2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2212-r1-三頁與刷新專項2026-11-08)。

<a name="v2211-r1-熔斷安裝驗收2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r1-熔斷安裝驗收2026-11-06)。

<a name="v2211-r2-受控熔斷與安裝接線2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r2-受控熔斷與安裝接線2026-11-06)。

<a name="v2210-r1-安裝版驗收2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r1-安裝版驗收2026-11-05)。

<a name="v2210-r2-補驗能力確認2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r2-補驗能力確認2026-11-05)。

<a name="v2210-r3-補驗2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r3-補驗2026-11-05)。

<a name="v2210-r4-正數-timeout-專項2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r4-正數-timeout-專項2026-11-05)。

<a name="v228-r2-專項完成2026-11-0304"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r2-專項完成2026-11-0304)。

<a name="v224-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-r1-安裝驗收2026-11-01)。

<a name="v223-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-r1-安裝驗收2026-11-01)。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。

<a name="v225-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-r1-安裝驗收2026-11-01)。

<a name="三十五項閉環對照"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#三十五項閉環對照)。

<a name="v226-r1-安裝驗收2026-11-02"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v226-r1-安裝驗收2026-11-02)。

<a name="驗證階段與證據範圍"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#驗證階段與證據範圍)。

<a name="v2213-r1-選路黑名單與來源驗收2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r1-選路黑名單與來源驗收2026-11-08)。

<a name="v2213-r2-本版變更接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r2-本版變更接線補驗2026-11-08)。

<a name="v2213-r3-更新確認與實機觀察2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r3-更新確認與實機觀察2026-11-08)。

<a name="v2213-r4-自主接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r4-自主接線補驗2026-11-08)。

<a name="v2213-r5-受控真實-api-接線2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r5-受控真實-api-接線2026-11-08)。

<a name="公開交付核對2026-11-06"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付核對2026-11-06)。

<a name="研究項目完成對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#研究項目完成對照)。

<a name="v228-r1-正數-timeout-專項2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r1-正數-timeout-專項2026-11-03)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。

<a name="公開交付"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付)。

<a name="修復結果與證據邊界"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#修復結果與證據邊界)。

<a name="發布與安裝限制"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布與安裝限制)。

<a name="2026-10-30up141-安裝版實測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="2026-10-31更新後安裝核對"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="v220-安裝驗收-r12026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v220-安裝驗收-r12026-11-01)。

<a name="澄清後在原期限內續行"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#澄清後在原期限內續行)。

<a name="auto-2-倍補充與本次驗收結案"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#auto-2-倍補充與本次驗收結案)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-r1-安裝驗收2026-11-01)。

<a name="全文閱讀覆蓋清單"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#全文閱讀覆蓋清單)。

<a name="發布後公開核對2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-01)。

<a name="固定合成模型對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#固定合成模型對照)。

<a name="發布後公開核對2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-03)。

<a name="v227-r1-基本安裝驗收2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-r1-基本安裝驗收2026-11-03)。

<a name="v227-xhr-timeout-起播分支調查2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-xhr-timeout-起播分支調查2026-11-03)。

<a name="政策映射與契約保留"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#政策映射與契約保留)。
