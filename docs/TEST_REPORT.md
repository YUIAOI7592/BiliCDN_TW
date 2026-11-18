# BiliCDN_TW v2.2.22 完整驗證報告

驗證日期為 2026-11-18（Asia/Taipei）。基準 main／2ed2bae。四批提交依序為 e24684a、d82f2ff、cd5c1df、9eb0967。

## 驗收結論

本版修復較舊的設定還原結果覆蓋已生效偏好，以及導覽與生命週期啟動失敗留下本次包裝與回呼。同步修正控制中心操作與換版引用，並集中選路快照的選擇與計畫投影。完整驗證與公開核對按各節記錄。

## 自動驗證

| 契約 | 修改前證據 | 修改後定向驗證 |
| --- | --- | --- |
| 設定發布 | 同一 Store 更新與遠端通知各重現一案，舊還原結果覆回頁面 | state 98 案通過。確認回傳、持久值、快取、通知及 WebRTC 一致 |
| 導覽與啟動回退 | History 與監聽安裝各一案、生命週期一案、正式入口一案失敗 | adapter-boundaries 84 案與 orchestration 39 案通過。原生 API 及描述子回復，自有訂閱、計時器與晚到回呼收束 |
| 選路快照 | 原來源的無選擇、待確認與已確認快照通過 | application 765 案與 control-center 106 案通過。排名順序、上限、快照凍結與唯讀行為保持 |
| 文件 | 核對 README 的操作位置與歷史結論落點 | docs:check、archive:check 與 git diff --check 通過 |

完整 `npm run verify` 通過 18 套件／2,234 案，失敗、跳過、取消及待辦均為零。型別、架構、格式、文件、公開封存、確定性建置、語法與暫存封裝校驗通過。實際工具環境見[工具紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md#2026-11-18-v2222-整合與發行驗證)。

## 安全差異

2026-11-18 23:26（Asia/Taipei）完成 Codex Security 固定差異審查。掃描 ID 為 `03776ed4-770d-4da3-955a-f0d0ddde2f8d`，範圍為 `2ed2baecb1b2652b1194042e6169ffbadf114380..d82f2ff0c006b2be13f0c56d13606c37a39074e7`，9 檔全部覆蓋，候選、可報告問題及未解項目均為零。

審查以固定差異、相依來源及記憶體契約為依據，涵蓋設定發布順序、History 包裝所有權及啟動回退。初次工作台入口無法解析 Git 工作樹，指定可信 Git 後由官方工作台啟動，並由 Codex Security 讀回封存結果。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.21 五項發行原件與當版標籤、原始校驗及獨立 tar 解壓比對一致。公開 TAR＋gzip 為 152,670 bytes，SHA-256 `e8984cd3cb10bfdb79dbd665f01a269c641fe020c32be8d2708b77b38ca3360d`。十個公開包解壓至同一還原根後，`archive:check --restore-root` 通過。換版前的完整現行報告已追加至[歷史原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2221-完整正文保存2026-11-18)。

2026-11-18 23:35:34（Asia/Taipei）發布 [v2.2.22](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.22) 為正式最新版。發行時遠端 main 與 v2.2.22 標籤解參照均為 `8e2bd6070c13051477df2c3c235e82dae86adee0`。唯一附件為 `BiliCDN_TW.user.js`。

公開 latest 與固定版本下載均回傳 HTTP 200，版本均為 v2.2.22，大小均為 542,386 bytes。SHA-256 `9ecda13768287397a645f431a1534e95f35dd95b220c44d4d60e305ea78aa6c4` 與本機封裝、重建結果及 GitHub 附件摘要一致。Release 快照保留封裝當時的驗證狀態。

## 來源隔離與實際安裝

發行時採自動契約、安全差異及公開產物核對，正式入口記憶體模型已有啟動失敗回退證據。IAB 來源隔離未執行。v2.2.21 的安裝與來源隔離判定見[當版原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2221-完整正文保存2026-11-18)。

<a name="v2222-r1-安裝驗收-2026-11-19"></a>

### v2.2.22 R1 安裝與正常回歸

2026-11-19 00:03:48 至 00:15:25（Asia/Taipei），使用單一背景 Codex IAB 分頁及既有 Tampermonkey 安裝。基準為 `v2.2.22`／`8e2bd60`，沿用 `BV1tFZZBQE57` P1／Auto／1 倍速。**六項安裝案例及清理通過。**

| 案例 | 判定與實際證據 |
| --- | --- |
| I-01 載入身分 | **PASS**。Debugger 取得當前文件的完整執行來源，辨識 Tampermonkey 外層後，本體為 UTF-8 位元組區間 `[671, 543057)`。全本體 542,386 bytes 與 SHA-256 `9ecda13768287397a645f431a1534e95f35dd95b220c44d4d60e305ea78aa6c4` 均與固定附件相符。控制中心顯示 `v2.2.22`。 |
| I-02 執行期接線 | **PASS**。實際 Fetch 和 XHR `open`／`send` 指向同一執行來源，並共用 `TransportContext`。沿網站外層 History 包裝取得 `pushState`／`replaceState` 內層，兩者與已登記的 `popstate` 共用同一產品回呼，接至實際 `LifecycleController`。傳輸、生命週期與總覽共用 `SettingsStore`、`SessionStore` 與 `RouteCoordinator`。設定命令與播放器面板引用同一 Store，總覽讀取同一協調器的 `snapshot()`。收尾快照回報兩個傳輸 hook 皆已安裝，有 85 次 Fetch、188 次 XHR 進入及 240 筆觀察到的回應。 |
| I-03 等價同頁導覽 | **PASS**。靜音且暫停時，透過實際 `replaceState` 於 P1 加入唯一的 `p=1`。正式導覽回呼執行且判定正規化鍵相同，文件時間基準及 History state 保持一致，Session 世代／內容週期前後皆為 `1／0`。核對所有權後移除 `p=1`，原網址已復原。 |
| I-04 正常播放 | **PASS**。真實播放器在 60.002 秒窗口內前進 60.004 秒。121 筆取樣均為同一媒體、原生靜音、1 倍速及播放中，最大取樣間隔 0.509 秒。事件觀察未出現錯誤、非預期暫停、尋位或媒體更換，窗口內 Debugger 已停用。可信暫停讀回 1195.345 秒，可信尋位後為 1223.270 秒，播放器自行續播至 1223.993 秒，隨即再次暫停。 |
| I-05 設定往返 | **PASS**。播放器靜音且暫停時，以兩次可信 `change` 將「慢請求提前重試」由開啟切至關閉，再恢復開啟。兩次提交的修訂均前進，暫時抑制計數均回到零，核取方塊與 Store 已提交值一致。復原前核對欄位及修訂仍屬本輪。整體停用、Native、WebRTC 與 HTTPDNS 的值維持原樣。此證據適用同頁操作。 |
| I-06 控制中心 | **PASS**。可信操作完成「總覽 → 播放設定 → 總覽」，兩頁共用頁首顯示「停用腳本」，符合啟用狀態。讀取總覽實際繪製時保留的快照，選定路線、格式和安全吞吐提示均與畫面相符。路線來自目前親和，歸因已確認，表示選擇為已確認且有兩筆樣本。待確認狀態未自然出現。 |

收尾確認設定和網址已復原，媒體保持靜音且暫停。播放取樣、靜音及設定觀察已解除，斷點為零，Debugger 與物件群組已釋放，自有分頁關閉後確認已移除。設定競態與啟動失敗回退的分支證據沿用本版自動契約。安裝紀錄的傳輸計數來自產品快照，完整 Network、管理器版本、跨重載保存及效益研究未納入本輪。

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
