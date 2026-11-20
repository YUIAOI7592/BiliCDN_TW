# BiliCDN_TW v2.2.24 完整驗證報告

驗證日期為 2026-11-20（Asia/Taipei）。修復前使用 v2.2.23 標籤（`1ff266b`）的產品來源。

## 驗收結論

起播探測收到內建 CDN 對當前資源的直接 HTTP 404 或 410 後，後續備援會避開該主機與資源的配對。四個離線重現案例的下一筆播放請求從四次選回缺檔主機降至零次，四案皆找到其他合法來源。同一主機仍可供應另一份資源。

## 自動驗證

正式案例以記憶體 HTTP 回應驅動 Range 探測、起播控制器與選路器。A 有近期高速紀錄，這次回傳表列狀態。B 回應足速，起播選中 B。B 的普通傳輸隨後發生網路錯誤，案例核對同一內容週期下一筆請求選定的主機與派送網址。[回歸案例](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/cases/routing/measurement/startup-catalog-status.ts)

| 起播時 A 的回應 | v2.2.23 後續備援 | v2.2.24 後續備援 |
| --- | --- | --- |
| 404、410，各測預設與僅使用內建 CDN 模式 | 4/4 選回 A | 0/4 選回 A |
| 403，兩種模式 | 0/2 選回 A | 0/2 選回 A |
| 416、429，各測兩種模式 | 4/4 選回 A | 4/4 選回 A |

十案每次只探測三個不同主機，重入起播不新增探測。A 的全域速度證據與限制維持原值，另一份資源的請求仍能派往 A。其他案例核對精確 Native 來源、內容或來源授權更換後的晚到結果、轉址、回應主機不符，以及既有三秒截止與取消行為。

另兩案直接核對健康探測候選。缺檔前 A 可供兩份資源挑戰。起播探測回報 404 或 410 後，舊版仍對缺檔資源提議 A，修正版只在另一份資源保留 A。兩案均在原判定失敗、修後通過。

Windows 的完整 `npm run verify` 通過。18 個套件共 2,296 案全部通過，失敗、取消、跳過及待辦均為零。131 條業務規則全部連到通過的具名案例。驗證涵蓋型別、架構、文件、公開封存、可重現建置及暫存封裝。首輪受限程序無法建立測試連結及 Git Bash 所需的系統物件，解除該環境限制後重跑完整驗證，未調整測試斷言。

| 工具 | 版本 | 本輪執行路徑 |
| --- | --- | --- |
| Node | 24.22.3 | `C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe` |
| npm | 11.20.0 | `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` |

## 安全差異

產品差異只將 404 與 410 納入起播探測既有的資源級排除判定，沿用原有的回應歸屬與來源授權檢查。本版未另執行安全掃描。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.23 的五項發行原件已對照標籤及原校驗，獨立解壓後均逐位元組相符。公開封存包 SHA-256 為 `2f56cbde0b40fa43bb9e5e365ea996b87c701e8384fd95ce9499641eaa45a000`。[v2.2.23 完整報告及安裝驗收](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2223-完整正文保存2026-11-20)

2026-11-20 22:50（Asia/Taipei）核對 GitHub 正式 Release。latest 指向 v2.2.24，唯一附件為 `BiliCDN_TW.user.js`。發行時遠端 main 與版本標籤均解析到 `62c251990324d40cdaa99c6b7615fbd5a1e625c8`。未帶憑證下載 latest 與固定版本，兩者均回傳 HTTP 200，標頭版本為 2.2.24，內容與正式封裝逐位元組相同，皆為 554,942 bytes，SHA-256 為 `4d27ce1d5729f130942799639dfd7e2680f64eab621a04b6703cdecaf77da0c1`。[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.24) · [latest 下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) · [固定版下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/download/v2.2.24/BiliCDN_TW.user.js)

## 來源隔離與實際安裝

正式發布時未執行瀏覽器來源隔離或安裝版播放驗收。使用者更新後的環境另於下列 R1 驗收。

<a name="v2224-r1-安裝驗收與供片調查"></a>

### v2.2.24 R1 安裝驗收與供片調查

2026-11-20（Asia/Taipei），在單一隱藏 IAB 分頁及現有 Tampermonkey 執行。最初同源校準的工具連線中斷，重新接回同一 `robots.txt` 分頁後確認 CDP 可用。兩個影片的新文件分別於 23:11:48.927 與 23:16:27.650 建立。CDP 在導覽前開啟 Network 與 Debugger。工具拒絕 `Page.addScriptToEvaluateOnNewDocument`，因此改在每次導覽後立即確認主媒體靜音，當時均為 `readyState=0`。第二個文件可沿已定位的正式程式行取得不中斷執行的起播事件。

| 案例 | 結果與證據 |
| --- | --- |
| I-01 載入本體與接線 | **PASS**。兩個文件均從實際 Fetch、XHR `open`／`send` 的函式位置找到當前執行的完整來源。取出 Tampermonkey 外層中的本體，兩份均為 554,942 bytes，SHA-256 與上方正式附件一致。Fetch 與 XHR 閉包共用同一傳輸實例、起播控制器和選路器。 |
| I-02 正常播放 | **PASS**。四個窗口皆以原生 `playbackRate` 設定並讀回倍率，維持網站原有 Auto，取樣總數 964，最大間隔 515.8 ms。各窗均持續靜音且畫面有進度，未觀察到連續兩秒無合格進度、媒體錯誤、非預期暫停或窗內尋位。 |
| I-03 已安裝實例受控缺檔排除 | **PASS**。第二片取樣結束後暫停播放器並確認靜音。在仍暫停的 JavaScript 執行緒中，由實際傳輸閉包取得選路器。兩份當期 `player-mpd` 影片資源 X（2160p AV1／60 fps）、Y（1080p AV1／60 fps）均有 `upos-sz-mirrorali.bilivideo.com` 與 `upos-sz-mirrorbos.bilivideo.com` 兩個合法內建候選。分別向 X 的候選輸入 404 與 410 後，X 的兩對皆由可選變為排除，Y 的兩對仍可選。只操作記憶體排除表與合法候選查詢，保持執行緒暫停直到關頁。 |
| O-01 自然缺檔備援 | **證據不足**。基準片起播快照有三個候選及一筆截止前採納的內建 206。第二片有三筆實際探測開始，其中兩筆是內建候選，截止前採納一筆原始來源 206。兩片共兩筆正式採納結果，其中內建 404／410 為 0，同資源雙故障後備援的有效機會為 0。 |
| O-02 起播遇上自然尋位 | **證據不足**。第二片有一筆可配對的首次認領。主影片原生 `seeking` 與最近一次監測狀態在 `832.8 ms` 均為 false。XHR `834.8 ms` 進入等待，`836.6 ms` 認領並啟動三次探測，`989.4 ms` 接納原始來源的 206，`990.3 ms` 解除同一筆 XHR 的等待，合計 `155.5 ms`。在 `1150.1 ms` 首次觀察到真正尋位與最近監測的 false 同時出現，此時額度已結束。首次認領遇到尋位的有效機會為 0。以上以同文件單調時間量測到等待解除，原生送出後及伺服器等待另計。 |

**播放窗口。** 各窗有 241 筆原生樣本。可播緩衝以當前連續緩衝的媒體秒數除以實際倍速計算。秒數四捨五入到小數點後兩位。

| P1 樣片 | 倍率 | 窗長／進度（秒） | 實際畫面 | 最低可播緩衝（秒） | 停滯 |
| --- | --- | --- | --- | --- | --- |
| `BV1tFZZBQE57` | 1× | 120.00／120.00 | 2160p | 11.39 | 0 |
| `BV1tFZZBQE57` | 2× | 120.00／239.91 | 2160p | 3.39 | 0 |
| `BV1BDVzzZEg4` | 2× | 120.00／239.91 | 1080p → 2160p | 13.48 | 0 |
| `BV1BDVzzZEg4` | 1× | 120.01／120.12 | 2160p | 68.07 | 0 |

第二片轉為 2160p 後，已歸因的當前影片表示為 AV1／60 fps。基準片窗口沒有同等編碼讀值。網站兩片均顯示 Auto，實際尺寸取自原生播放器。

**現場供片。** 第二片的站方主文件內嵌 `__playinfo__` 宣告 DASH（18 個影片表示、3 個音訊表示）。兩類媒體均列出 `upos-hz-mirrorakam.akamaized.net` 與 `upos-sz-mirrorcosov.bilivideo.com`。這輪未取得兩片可配對的原始 `playurl` HTTP 正文，基準片的站方來源清單保留未知。

| 樣片／證據 | 媒體 | 完成回應主機 | 成功 206 | 首位元組（ms） | 位元組 |
| --- | --- | --- | --- | --- | --- |
| 基準片／Network 可配對子集 | 影片 | `upos-sz-mirroralib.bilivideo.com` | 57 | 78–710 | 432,105,966 |
| 基準片／Network 可配對子集 | 影片 | `upos-sz-mirroraliov.bilivideo.com` | 3 | 19–140 | 21,279,318 |
| 基準片／Network 可配對子集 | 音訊 | `upos-sz-mirroraliov.bilivideo.com` | 54 | 8–18 | 2,926,450 |
| 第二片／選路器歸因至窗口結束 | 影片 | `upos-sz-mirroralib.bilivideo.com` | 91 | 7–912 | 564,944,851 |
| 第二片／選路器歸因至窗口結束 | 音訊 | `upos-sz-mirroraliov.bilivideo.com` | 91 | 8–59 | 2,433,465 |

基準片 Network 游標曾截斷。表中只計開始、回應與完成可配對且沒有快取標記的普通請求，位元組為 Network 的編碼傳輸量。另見三筆健康探測回 206 後取消。`upos-hz-mirrorakam.akamaized.net` 有影片 206、取消或未取得完成證據，其中一筆在約 2,291 ms 收到回應後取消。本輪未將該筆歸為卡頓原因。

第二片表內數值是選路器觀察到的完成與媒體位元組。目標和回應主機一致，影片 4 筆使用內建改寫、87 筆使用 Native 簽名來源，音訊 91 筆使用內建改寫。另有一筆影片、一筆音訊取消。一倍速後段另由 Network 配對確認同兩台主機有 18 筆影片、17 筆音訊 206 完成，均無快取標記。早期 Network 事件鏈有缺口，第二片全窗的快取分母未知。

**清理與下一案。** 恢復兩片進入時的 1×，播放器保持靜音並暫停。解除自有採樣、監聽、13 個程式觀測點及 Network 收集，確認測試分頁已關閉。起播與尋位交錯仍是最窄的產品候選。第二片確實出現原生尋位和較舊監測狀態不同步，但發生在測速結束後。下一案可先鎖定「首次請求撞上尋位、監測尚未更新」的受控回歸。這輪的正常起播等待與兩片供片結果只代表當次連線，缺檔發生率與節省秒數仍未知。[起播判定來源](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/application/measurement/measurement-controller.ts#L166)

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
