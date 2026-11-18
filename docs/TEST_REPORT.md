# BiliCDN_TW v2.2.21 完整驗證報告

驗證日期為 2026-11-18（Asia/Taipei）。基準 main／abd0ace，產品修復提交為 51f00da。

## 驗收結論

本版修復設定讀取失敗導致的覆寫、健康探測候選授權失效、無本文的 playurl Fetch 回應及 SDK 播放同步重設。原重現與修後契約見自動驗證。正式交付與安裝分別判定。

## 自動驗證

完整 verify 通過 18 套件／2,227 案，失敗、跳過、取消及待辦皆為零。型別、架構、格式、文件、公開封存、確定性建置、語法與暫存封裝校驗均通過。

| 受影響契約 | 修正前 | 修正後 |
| --- | --- | --- |
| 設定鎖內讀取與通知 | 4 個缺陷重現，1 個無資料對照通過 | state 96 案通過 |
| 健康探測與保存 | 3 個鎖邊界缺陷重現，1 個保存對照通過 | measurement-state 138 案通過 |
| Fetch 無本文回應 | 204、205、304 共 3 案失敗 | playurl-summary 26 案通過 |
| SDK 播放返回時的生命週期 | Promise 成功與拒絕共 2 案失敗 | 恢復相關篩選 18 案通過 |

PCDN 案例核對備援清單非空、主機去重且皆在可信 Catalog。封裝案例核對建置清單記載的腳本 SHA-256 與同一次封裝的腳本一致。整輪結果與實際工具環境見[工具紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md)。

## 安全差異

Codex Security 已於 2026-11-18 22:06（Asia/Taipei）完成固定差異審查並核對封存結果，掃描 ID 為 `a0f16b24-1ad3-422b-b722-4cb588f6ab19`。差異為 `abd0ace7ed2b7f05534fa718c5403c12308a9101..51f00da63409fa0c93037f4a82ac5d77f8c056c8`，13 個變更檔案全部完成審查，候選、可報告漏洞與未解項目均為零。

審查涵蓋設定寫入與通知、健康探測和證據保存的路線授權、Fetch 無本文分支、SDK 播放重設後的狀態所有權與相應契約。審查以固定差異、相依原始碼與現有自動契約為證據。工作台初始啟動無法解析 Git 工作樹，改在官方本機工作台入口指定可信 Git 後完成，封存結果由 Codex Security 讀回。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.20 五份原件已與來源標籤及原始校驗核對。公開 TAR＋gzip 為 153,579 bytes，SHA-256 `9a514a7f6963cb4ad6e6c703a0d5ad3521eac2731972cb21cea8bc2571a4f310`。九包已用系統 tar 獨立解壓，再以 `archive:check --restore-root` 核對通過。當版報告保存在[完整歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2220-完整正文保存2026-11-18)。

初次預檢的憑證失效已透過 GitHub CLI 裝置登入恢復。發行時遠端 main 與 `v2.2.21` 標籤均指向 `95853b07782af9db39bcc6bb015152c00fd5a217`。2026-11-18 22:11:38（Asia/Taipei）發布 [v2.2.21](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.21) 為正式最新版，唯一附件為 `BiliCDN_TW.user.js`。

公開 latest 與固定版本下載均為 HTTP 200。兩者的版本 v2.2.21、540,300 bytes 與 SHA-256 `2202170b1837534e2636f456e9b702e2466d4efad611c496a145f9fb327ebc7d` 均與本機封裝及 GitHub 附件摘要相符。追加此核對後，版本標籤及封裝快照維持原件。

## 來源隔離與實際安裝

2026-11-18 22:23:35 至 22:31:54（Asia/Taipei）在單一自有 Codex 內建瀏覽器分頁查證已手動更新的安裝。以 `v2.2.21` 標籤 `95853b0` 與正式附件為基準。**安裝 4 案通過。四項瀏覽器來源隔離未執行，整輪驗收未取得完整通過。**

| 安裝案例 | 判定與實際證據 |
| --- | --- |
| I-01 完整載入身分 | **PASS**。Debugger 取得的載入來源中，UTF-8 位元組區間 `[672, 540972)` 為唯一一份含 metadata 的正式腳本。540,300 bytes 的 SHA-256 為 `2202170b1837534e2636f456e9b702e2466d4efad611c496a145f9fb327ebc7d`。控制中心顯示 v2.2.21。 |
| I-02 實例與接線 | **PASS**。從入口監聽器查到九個相關類別各一個實例。控制命令與執行期共用 SettingsStore，核對鎖內讀取與寫入方法。量測、選路、探測器及 EvidenceStore 的候選提交與樣本保存方法指向同一載入來源。實際頁面 Fetch 與 XHR `open`／`send`／`abort` 均指向該來源，兩個 hook 共用 TransportContext；另外核對 playurl 轉換方法及無本文分支的位置。RecoveryController 與執行期共用 PlayerAdapter，實際播放與還原讀回方法也在同一來源。收尾時自檢回報 Fetch／XHR 皆已安裝，計數分別為 85／216 次進入、263 筆回應。 |
| I-03 正常播放 | **PASS**。`BV1tFZZBQE57` P1／Auto／1 倍。原生媒體靜音後量測 65.978 秒，進度前進 65.972 秒。124 筆取樣均維持同一媒體、靜音、播放中及無媒體錯誤；事件監聽覆蓋全窗，最大取樣間隔 5.153 秒，無等待、卡住或其他失效事件，Debugger 未暫停。可信點擊暫停在 1045.324 秒，尋位至 1090.713 秒，播放器自行續播，讀回進度持續前進至 1105.988 秒。 |
| I-04 設定往返 | **PASS**。播放器暫停且靜音時，以可信點擊開啟控制中心。「慢請求提前重試」由開啟切為關閉，核對同頁勾選、已提交值與提交時間，確認暫時抑制已解除。復原前以本次寫入值與時間確認仍由本輪持有，恢復為開啟並再次讀回。整體停用、Native、WebRTC 與 HTTPDNS 值在往返檢查一致。 |

I-02 的實例與方法證據涵蓋接線。當輪傳輸快照沒有 playurl 摘要，沒有取得自然健康完整協定或其他修復分支的實際觸發證據。管理器安裝版本、完整 Network 流量、跨重載保存、壓力與效益研究未納入本輪。

以標籤相符的模組和契約預製一份本機 HTML，包含 17 個合成子情境。清理安裝階段後，在同一個 IAB 分頁直接開啟檔案，URL 政策拒絕 `file:` 協定，測具未開始執行。

| 來源隔離案例 | 判定 |
| --- | --- |
| S-01 設定讀取失敗與通知 | **未執行**。本機檔案導覽遭拒。 |
| S-02 健康探測授權撤回 | **未執行**。本機檔案導覽遭拒。 |
| S-03 Fetch 無本文回應 | **未執行**。本機檔案導覽遭拒，未取得瀏覽器原生 Response 對照。 |
| S-04 SDK 播放同步重設 | **未執行**。本機檔案導覽遭拒。 |

收尾確認設定已復原、控制中心關閉、播放器靜音且暫停，觀察計時器及監聽移除，Debugger 解除、遠端物件群釋放，自有分頁已關閉且 IAB 分頁清單為空。脫敏摘要保存在本機工作資料。自動契約、固定差異安全審查與公開交付沿用本頁各節證據，歷史原判見[歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)。

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
