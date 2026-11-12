# BiliCDN_TW v2.2.19 完整驗證報告

驗證日期：2026-11-12（Asia/Taipei）。基準 main／fb1d57d、v2.2.18；三批來源提交為 5279bbb、cea2af3、049c545。範圍為已批准的正式來源精簡；功能、政策及暫緩項目保持。

## 驗收結論

三批實作與來源驗證已完成：移除無消費者的私有資料及參數、共用既有純判斷、集中 playurl 登記。完整 verify 通過十八套件／2,186 案，包含型別、109 個正式模組架構、格式、文件、公開封存、可重現建置、語法及空暫存目錄五項封裝。安全差異掃描已完成並封印，沒有可報告漏洞或待查候選。版本與正式封裝的最終驗證、公開交付結果見下方。

可驗收收益是移除重複資料與判斷、集中登記責任；不宣稱播放速度、卡頓或提前重試效用改善。原六情境效用 FAIL、歷史 INVALID 及實機證據缺口保留。本輪沒有啟動瀏覽器、重新安裝或重跑舊窗口；v2.2.18 安裝通過不能外推為本版通過。

## 三批實作與功能保持

| 批次 | 完成範圍 | 保留的契約 |
| --- | --- | --- |
| 一 | 移除 startup lease 未使用的牆鐘副本、RetrySuccess.bytes、pending serial 副本、page-playinfo.current()、manual- 測速文案與未使用的傳輸觀察 URL 參數 | UI deadlineAt、單調期限、生命週期回呼、實際速度計算、請求身分、直接回應證明與取消 |
| 二 | 播放器備援篩選沿用 adequateCapacity；媒體路徑四個判斷共用本模組助手 | 足速／eligible／成功筆數、16 KiB 邊界、不同主機集合、協定及 getter 讀取順序 |
| 三 | PlayurlController 私有登記助手共用 Vault.register 與 trusted identity 記錄 | 原 opaque／normal 呼叫位置、bandwidth 捕獲時點、來源上限、低信任返回、可信提升撤銷、最後所有權檢查與原子寫回 |

來源共十三檔，新增 42 行、移除 88 行；另調整五個測試檔。行數只描述差異，不作效能或品質指標。沒有新增狀態所有者、Native URL 索引、公開 API、儲存鍵、依賴或通用框架。

## 功能與政策保持

三項固定政策及其原資格、提前重試開關與正數 timeout 排除、恢復門檻／額度、999 ms 採樣與 stable-retained 保持。Session 欄位／身分、pending 計數、RouteCoordinator normal／Catalog 分支、safeHost 儲存抽象及 RecoveryController／PlayerControlObserver 再整理均暫緩。沒有為了精簡刪除 getter 前後的所有權檢查，也沒有合併 Fetch／XHR 的不同時序。

## 自動驗證

基準完整執行為十八套件／2,183 案；先建立並通過 URL 邊界與 normal／opaque 登記的三個契約，再修改對應正式來源。新增案例驗證精確邊界、metadata、可信提升、舊 identity 失效與低信任不能擴充；原案例及斷言全部保留。三個傳輸測試只適配被刪參數，不改預期值。

分批通過 application、adapters、control-center、domain、native-transport、progressive-playurl 與型別檢查。固定來源完整 verify 為 2,186 案、27,568.1 ms；更新版本及文件後 verify 為 2,186 案、27,392.2 ms；正式封裝與保護登記後最終 verify 為 2,186 案、26,955.5 ms。三輪 failed／skipped／todo／cancelled 均為零；沒有 only 留在完整執行。

首輪沙箱內工具套件受暫存 Git／Bash 權限限制；同一基準在允許必要操作後通過，沒有放寬斷言。opaque 新案例初稿錯把 weak match 當 matched，改用實際 match.context 並明確驗證兩者差異後，於正式來源修改前通過；這是案例前提修正，不是產品修復或抓錯證據。

當次依賴工具提供 Node 24.22.1，明確執行路徑為 `C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1110-778-0_26.1110.778.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe`；父子 Runtime 一致。沒有改工具鏈或啟動本機網站服務；原始日誌保存在本機 `.work/source-cleanup-v2219/`。

## 安全差異

Codex Security scan `39e893e9-5b85-46f9-a70a-46e9e0e6c43c` 已完成並讀回 canonical 封印。固定基準 fb1d57d，來源／測試差異 digest 為 `989498197951ce0feb76e2074f1e73bbce8bb87f1137e12a710d4103ecac07b3`；十八檔全部覆蓋，候選、可報告漏洞及 deferred 均為零。掃描設定記錄為 gpt-6-astra／high；未提供可核對的 token 用量，不另估算。

審查追入 Native 精確授權、trusted identity、低信任來源限制、getter／重入順序、Fetch 單讀取器、XHR 身分與取消、起播單調期限及提前重試帳本。這是單次固定差異審查，不是全庫逐行漏洞審計或實機驗收。後續只有版本、文件與封裝管理；執行期及測試程式未再修改。掃描產物由 Codex Security 保存，沒有重寫既有安全原件。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.18 五項發行原件與 fb1d57d 的 Git 位元組逐項相同，已移至公開壓縮封存；ArchiveStorage 與獨立系統 tar 解壓後逐項核對通過。壓縮檔 154,046 bytes，SHA-256 `f40778455a12715f9e58fe4711cec71dca729218a72f67fe4a179a0b3230cd06`。上一版完整報告含 R1、測試審核及原 FAIL／INVALID，以原正文追加保存於[完整歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2218-完整正文保存2026-11-12)。

七份公開壓縮檔已完整解壓至隔離目錄，archive:check --restore-root 通過逐檔核對；封存當下公開清單 529 項搬移、三份追加日誌及 149 項原件保護通過。另行 --local 核對 9,495 個檔案、92 份校驗清單／415 筆校驗通過。加入本版五項正式產物後，最終 verify 核對 154 項原件保護。

正式封裝完成，五項產物獨占建立；117 項建置輸入雜湊、重建腳本與四筆 SHA256SUMS 逐項相同。腳本 542,470 bytes，SHA-256 `3db831468fe2fc616ebea5325c157a5c39ccf31a5478ac3a92409aa67fa11764`。Release 內報告保留封裝前時點，後續驗證只更新本現行報告，不覆寫快照。

2026-11-12 21:34（Asia/Taipei）公開核對通過：main 與 v2.2.19 標籤指向發行提交 ba17af7571e7b9890659ead31f3a9fe27454a3e1；[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.19) 為 latest、非草稿、非預發行，只有 BiliCDN_TW.user.js 一個附件。匿名 latest 與固定版本下載均為 HTTP 200，版本、542,470 bytes、SHA-256 及完整位元組都與本機原件相同，GitHub 附件 digest 亦一致。後續文件結案提交不移動標籤或重封裝。

文件結案前 docs:check 通過 303 份 Markdown／5,240 個本機或儲存庫連結，git diff --check 通過。既有七個不可變斷鏈、672 個封存後原網址、18 個私有證據引用與未抓取外部連結均依原規則分列；結構通過不取代人工語意核對。安裝版未驗證，既有窗口保持結案；工作狀態由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

<a name="來源隔離與實際安裝"></a>

<a name="v2218-r1-安裝身分與設定頁2026-11-12"></a>

<a name="文件與測試清查整理2026-11-12"></a>

<a name="斷言審核與精簡2026-11-12"></a>

<a name="全量逐案語意審核與最終精簡2026-11-12"></a>

[v2.2.18 原始發行、R1、文件與逐案測試審核全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2218-完整正文保存2026-11-12)。

<a name="v2217-r1-採樣與抑制專項2026-11-11"></a>

[v2.2.17 R1 原始採樣、尋位與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r1-採樣與抑制專項2026-11-11)。

<a name="v2217-r2-低緩衝與額度受控補驗2026-11-11"></a>

[v2.2.17 R2 原始受控整合與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r2-低緩衝與額度受控補驗2026-11-11)。

<a name="v2216-r1-載入身分與選路提交接線2026-11-09"></a>

[v2.2.16 R1 原始載入、方法錯誤及限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2216-r1-載入身分與選路提交接線2026-11-09)。

<a name="v2215-r1-載入身分與模組初始化2026-11-09"></a>

[v2.2.15 R1 原始載入判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2215-r1-載入身分與模組初始化2026-11-09)。

## 歷史驗證導覽

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
