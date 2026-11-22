# BiliCDN_TW v2.2.25 完整驗證報告

驗證日期為 2026-11-22（Asia/Taipei）。修復前以 v2.2.24 標籤的產品來源及正式 Fetch／XHR 掛鉤重現。

## 驗收結論

實際尋位或仍有效的進度條拖曳期間，第一筆媒體請求直接走正常選路。尚未使用的起播測速額度留給尋位結束後的下一筆合格請求。

## 自動驗證

受控時鐘在兩次監測之間切換尋位。當探測不回應時，v2.2.24 的 Fetch 與非同步 XHR 均啟動三次探測，至第 2,999 ms 仍未送出，於第 3,000 ms 派送。兩個具名回歸在修復前均在「立即原生派送一次」的斷言失敗。

| 情境 | v2.2.24 | v2.2.25 |
| --- | --- | --- |
| 尋位中第一筆 Fetch | 原生派送在模擬時鐘 3,000 ms | 同一模擬時間派送一次，零探測、游標為 0 |
| 尋位中第一筆非同步 XHR | 原生派送在模擬時鐘 3,000 ms | 同一模擬時間派送一次，零探測、游標為 0 |

兩案在尋位結束、監測仍保留舊狀態時立即允許下一筆合格請求認領一次。每案三次探測，游標進至 1，第三筆請求直接派送。XHR 所設 13 秒 timeout 維持原值。另核對無影片、原生讀值失敗、可信拖曳、媒體更換、候選選取期間開始尋位或換片、同內容重入以及既有等待者個別取消。案例已登記至[業務契約](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/business-contracts.json)，正式傳輸斷言見[Fetch／XHR 回歸案例](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/cases/transport/xhr.ts)。

Windows `npm run verify` 通過，18 個正式套件共 2,314 案，失敗、取消、跳過與待辦均為零，131 條業務規則皆有通過的具名案例。驗證另含型別、架構、格式、文件、公開封存、建置及暫存封裝。初次完整驗證發現過早檢查個別取消會改變共用探測的既有合約。修正後保留原測試斷言，31 個取消對照通過。執行環境為工作區提供的 Node 24.22.3，並用同一 Node 執行系統 npm CLI 11.20.0。

| 工具 | 執行位置 |
| --- | --- |
| Node | `C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe` |
| npm CLI | `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` |

## 安全差異

即時尋位與拖曳資料只提供測速資格訊號。一般選路、精確來源授權與主機限制仍在原路徑執行。控制器在認領前重新檢查內容與租期，個別取消維持原始原因與共用工作所有權。未另執行安全掃描。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.24 的五個發行原件與標籤、校驗清單及獨立解壓副本相符，已轉入公開封存。封存 SHA-256 為 `1206a31ed426e48a39c7c8047f47acd4202760ab2804d7a0650f370dcacc7c4f`。[v2.2.24 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2224-完整正文保存2026-11-22)

2026-11-22 08:16（Asia/Taipei）核對 GitHub 正式 Release。發布時遠端 `main` 與 `v2.2.25` 標籤均指向 `d25732e9c206c67b2716d6356487a70c47afd595`。公開 latest 為 v2.2.25，唯一附件為 `BiliCDN_TW.user.js`。未帶憑證取得 latest 與固定版本均回傳 HTTP 200，標頭版本為 2.2.25，兩份與正式封裝逐位元組相同，皆為 556,978 bytes，SHA-256 為 `7f59515504b9bd28e3a0901b2be8bbfeba10065351a73fde9a0f155624e6e689`，與附件登記一致。[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.25) · [latest 下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) · [固定版下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/download/v2.2.25/BiliCDN_TW.user.js)

## 來源隔離與實際安裝

發布時已完成 Node 驗收。使用者更新後的 IAB 驗收與供片調查見下方。來源隔離未執行。

<a name="v2225-r1-安裝驗收與供片調查"></a>

### v2.2.25 R1 安裝驗收與供片調查

2026-11-22 15:25:48.922 至 15:33:09.333（Asia/Taipei）。單一隱藏 IAB 分頁沿用現有 Tampermonkey。兩片各自以新文件載入，保留網站續播位置。在兩個主影片均為 `readyState=0` 時設定靜音並讀回，換媒體由同一觀測器確認。起播時序用同文件的單調時鐘，觀測點保持不中斷執行。

| 案例 | 結果與證據 |
| --- | --- |
| I-01 正式本體與接線 | **PASS**。兩個文件的 Fetch、XHR `open`／`send` 指向同一份執行來源。從 Tampermonkey 包裝取出的完整本體均為 556,978 bytes，SHA-256 與正式附件相符。兩個掛鉤共用同一傳輸實例、起播控制器及選路器，起播控制器已接上即時尋位讀值。 |
| I-02 已安裝即時尋位判定 | **PASS**。兩窗結束後在第二片保持靜音，暫停並用原生 setter 在已緩衝區間內尋位 0.75 秒。同一媒體及文件下，原生 `seeking` 和已安裝實例注入的讀值皆依序為 false → true → false。true 與 false 分別在原生 `seeking`／`seeked` 事件回呼內同步讀到。已完成的起播狀態物件一致。 |
| I-03 正常播放 | **PASS**。兩支 P1 樣片使用網站 Auto 與原生倍率。共四個至少 60 秒的連續窗口，485 筆樣本，最大取樣間隔 508.4 ms。四窗皆持續靜音、有畫格和時間進度，沒有連續兩秒無合格進度或媒體錯誤。下表從正常播放已建立時起算。 |
| O-01 尋位搶在首筆測速前 | **證據不足**。兩個新文件各有一次可配對的首次額度認領，各發三筆探測。三次資格讀取均在各片真正尋位前回 false。基準片在 3,939.2 ms 解除共用等待、4,072.8 ms 才尋位；第二片在 1,263.2 ms 解除等待、1,395.7 ms 才尋位。符合「額度尚可用且正在尋位」的自然機會為 0/2，首筆直接派送與保留額度沿用正式 Node 回歸。 |

| P1 樣片 | 倍率 | 窗長／進度（秒） | 原生畫面 | 最低可播緩衝（秒） |
| --- | --- | --- | --- | --- |
| `BV1tFZZBQE57` | 1× | 60.000／59.998 | 2160p | 16.925 |
| `BV1tFZZBQE57` | 2× | 60.004／119.932 | 2160p | 34.321 |
| `BV1BDVzzZEg4` | 2× | 60.007／119.907 | 1080p | 0 |
| `BV1BDVzzZEg4` | 1× | 60.494／60.594 | 1080p | 8.312 |

可播緩衝使用當前連續緩衝範圍除以原生倍率。第二片 2× 曾讀到零，進度取樣與媒體事件仍顯示持續播放。兩片後段歸因已確認的影片表示皆為 AV1，約 60 fps。第二片這次 Auto 實際停在 1080p，v2.2.24 的同片不同窗口曾升至 2160p。兩輪播放區段與供片路線有差異，未量測新版對 Auto 畫質的影響。

**站方來源與實際供片。** 主文件原始內嵌 `__playinfo__` 為 DASH。兩片分別列 21、18 個影片表示及各 3 個音訊表示，所列影音主機為 `upos-hz-mirrorakam.akamaized.net` 和 `upos-sz-mirrorcosov.bilivideo.com`。未取得可歸屬的原始 `playurl` HTTP 正文。下表僅計從當次導覽至正常播放窗口結束、選路器已歸因的普通 206 終態，時間使用 XHR 開始到收到標頭，位元組為產品觀察值。

| 樣片 | 媒體及路線 | 實際回應主機 | 完成 206 | 標頭時間（ms） | 位元組 |
| --- | --- | --- | --- | --- | --- |
| 基準片 | 影片，原始 | `upos-hz-mirrorakam.akamaized.net` | 2 | 4–110 | 11,222 |
| 基準片 | 影片，內建 | `upos-sz-mirrorbos.bilivideo.com` | 23 | 377–979 | 221,629,882 |
| 基準片 | 影片，Native 簽名 | `upos-sz-mirroraliov.bilivideo.com` | 29 | 9–25 | 197,803,613 |
| 基準片 | 音訊，原始 | `upos-hz-mirrorakam.akamaized.net` | 55 | 3–756 | 2,942,892 |
| 第二片 | 影片，內建 | `upos-sz-mirroraliov.bilivideo.com` | 52 | 4–539 | 126,256,203 |
| 第二片 | 音訊，Native 簽名 | `upos-hz-mirrorakam.akamaized.net` | 53 | 7–284 | 1,396,636 |

基準片另有影片兩次取消、兩次逾時及音訊一次取消。第二片有影片、音訊各一次取消。Network 只有基準片的可配對子集，本輪未取得屬第二個文件的 Network 時間線。第二片的原生 Resource Timing 另確認 24 筆 `mirroraliov` 影片 206 有非零傳輸量。音訊未公開對應 Resource Timing，兩個文件均沒有全窗快取分母。

#### 基準片的續播尋位延遲

從文件導覽起算的同一單調時間軸如下。主影片在 4.073 秒開始續播尋位，40.492 秒收到原生 `seeked`，40.509 秒進入 `playing`，尋位歷時 **36.419 秒**。起播測速在 3.939 秒已解除等待，三筆 206 都被接納，原始主機的短探測約 6.67 Mbps。

| 時點（秒） | 觀察 |
| --- | --- |
| 6.173 | 一筆已歸因的影片 XHR 派往 `upos-hz-mirrorakam.akamaized.net`。 |
| 19.179 | 原生傳輸逾時，這筆嘗試歷時 13.006 秒。 |
| 19.182 | 下一筆影片 XHR 約在 3.1 ms 後派回同一台原始主機。 |
| 35.188 | 第二筆原生傳輸逾時，這筆嘗試歷時 16.006 秒。 |
| 35.192–37.310 | 下一筆改派 `upos-sz-mirrorbos.bilivideo.com`，以 206 完成，約 10.3 MB。後續同主機再成功傳輸，接著尋位結束。 |

**下一案優先修正逾時後立即重送的選路交錯。** 用 v2.2.25 的正式路由、播放資訊適配器及證據儲存層在記憶體重現。固定同一合法影片資源與兩個內建候選，讓第一筆原始路線的 13.006 秒影片逾時等待證據鎖。在該次提交前推進模擬時鐘 3 ms，下一筆實際派送 URL 選回原主機。釋放鎖後，僅憑第一筆失敗即建立影片熔斷，下一筆同資源改派合法內建候選。這組結果支持直接修復選路順序。現場未取得第一筆證據的提交時點與兩筆請求的精確分段配對，36.419 秒是觀察到的尋位時間，修復可節省多少尚未量測。[證據寫入](https://github.com/YUIAOI7592/BiliCDN_TW/blob/d25732e9c206c67b2716d6356487a70c47afd595/src-v2/state/evidence-store.ts#L293) · [失敗後改派](https://github.com/YUIAOI7592/BiliCDN_TW/blob/d25732e9c206c67b2716d6356487a70c47afd595/src-v2/application/routing/route-coordinator.ts#L2074)

**清理 PASS。** 兩片均恢復進頁時的 1×，維持靜音並暫停。解除原生採樣、Resource Timing、九個程式觀測點與 CDP 物件群組及觀測領域。確認自有分頁已關閉。

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
