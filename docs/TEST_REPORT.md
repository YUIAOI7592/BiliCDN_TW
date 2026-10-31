# BiliCDN_TW v2.2.1 診斷撤除與保留功能驗證

日期：2026-11-01（Asia/Taipei）。基準為 6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb／v2.2.0。

## 變更

完整撤除診斷錄製、事故／請求／提前重試歷程、緩衝趨勢、報告產生／複製／匯出、診斷頁、剪貼簿授權與分頁原線對照。診斷專用評估與 IAB 收集／插樁／判定工具退出正式來源，固定提交可追溯原碼。

控制中心保留總覽、CDN、播放設定三頁；總覽數值、詳細狀態與單次刷新快照保留。正常選路、Native 開關、學習、量測、提前重試、停滯／備援恢復及整體停用保留。設定 schema 2、四鍵、Native 預設 true 及既有布林值不變，不遷移或清除使用者資料。

## 自動驗證

固定 Node 26.8.1 完整測試已通過 1,598 案，failed／cancelled／skipped／todo 均為 0。相較 v2.2.0 的 3,050 案，淨減少 1,452 案，來自撤銷診斷、緩衝評估、IAB 工具、剪貼簿與原線對照專用案例。混合案例直接驗證狀態及副作用；新增三個退役原碼追溯工具契約，另將舊混合案例的音訊禁止、XHR 單次送出／送出前限制重查、需求餘裕門檻恢復為三個獨立功能案例。三頁與移除操作的新契約先於來源修改執行並確認失敗，修改後通過。

型別、91 個正式模組的架構／循環檢查、完整測試及最終 verify 已通過；verify 包含格式、文件、封存、匯入純度、確定性建置、語法、移除標記與封裝校驗。封存核對 439 個搬移項目、56 份閱讀版；三份追加日誌保留原始前綴，v2.2.0 完整報告原文及五份 Release 原件保持。七個不可變舊斷鏈、434 個歷史網址限制、十八個私有引用未核對、外部網址未連網驗證分開記錄；未執行本機搬移或 local 模式。

## 安全審查結果

Codex Security 差異掃描 `4409e3da-7ffc-4ce3-baa0-74dc4a4aa090` 已完成並封存，範圍為 `6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb..5cc72ee9dede4dd91d3a0de1b1228f81758bbe8d`。149 個來源清單項目加 26 個其他變更路徑全部核對，包括基準中的刪除檔；零可回報發現、零未結候選。Native／Catalog 授權、恢復 token、重入與晚到提交、可信 UI、工具 Git／檔案邊界均完成審查。

掃描後只修正文案／metadata 說明、恢復兩個誤改的間接開發依賴版本文字，以及補回上述三個功能測試；正式 TypeScript 與掃描 head 相同，bundle 執行本體逐字一致。最終鎖檔相較基準僅產品版本改為 2.2.1。後續變更已人工核對並通過完整 verify。工作台統計為 21,828,144 tokens（含 20,986,496 cached input，輸出 66,876）；這是工具回傳的整合統計，不換算為計費金額。Daybreak 權限不可用，使用可用的標準靜態差異流程；安全審查不代替安裝實測。

## 發行產物

v2.2.1 腳本為 419,507 bytes，比 v2.2.0 的 507,211 bytes 減少 17.3%。SHA-256：`e89b94bb92eecb818ce038f09c1de2b9fb5db8b2ffa35adb2357141384db149d`。

此封裝時點已通過自動及安全驗證；公開推送與 latest 下載讀回將追加於現行報告，封裝快照不回寫。GitHub Release 只附唯一使用者腳本。

### 公開交付讀回（2026-11-01）

正式 [v2.2.1 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.1) 已發布並設為 latest，非草稿、非預發布。發行提交及標籤解參照均為 `1e4e70cccf13e0dea1346c1fbd89d44dad063ce1`；推送時遠端 main 同步至該提交，後續 main 僅追加交付紀錄。

公開 main 腳本、v2.2.1 標籤腳本與 latest 下載均獨立讀回：版本 2.2.1、419,507 bytes、SHA-256 `e89b94bb92eecb818ce038f09c1de2b9fb5db8b2ffa35adb2357141384db149d`，逐位元組等於本機封裝。Release API 確認附件只有 `BiliCDN_TW.user.js`，大小與 digest 同值。五份儲存庫封裝檔、建置輸入雜湊及 Git blob 均已核對；發布後不回寫封裝快照。

本次交付完成；未操作 IAB、未更新管理器安裝版，也未恢復已停止的播放或故障窗口。

## 安裝與歷史判定

本次未啟動瀏覽器、安裝或播放窗口。一般播放與設定驗收依直接產品行為判定，不要求診斷工具或完整 Network 成功；特定問題缺少時序只限制該問題結論。

v2.2.0 全文與追加更正見 [歷史完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v220-完整正文保存2026-11-01)。原 INVALID 與操作錯誤不改 PASS，已通過的播放及設定不被工具失敗概括否定。既有未解問題、效用 FAIL 及停止決策由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

<a name="歷史驗證導覽"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#歷史驗證導覽)；現行內容以本頁正文為準。

<a name="公開交付與安裝結案"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#公開交付與安裝結案)；現行內容以本頁正文為準。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#隔離-b-分支原型驗證2026-10-30)；現行內容以本頁正文為準。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#bilicdn_tw-v218-release-verification--2026-10-04)；現行內容以本頁正文為準。

<a name="修復與根因"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#修復與根因)；現行內容以本頁正文為準。

<a name="來源隔離與實際安裝"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#來源隔離與實際安裝)；現行內容以本頁正文為準。

<a name="安全差異"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#安全差異)；現行內容以本頁正文為準。

<a name="發布與安裝限制"></a>

<a name="修後唯一-hk04-定向窗口"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#發布與安裝限制)；現行內容以本頁正文為準。

<a name="2026-10-30up141-安裝版實測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-30up141-安裝版實測)；現行內容以本頁正文為準。

<a name="2026-10-31更新後安裝核對"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31更新後安裝核對)；現行內容以本頁正文為準。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31六十分鐘驗證計畫執行結果)；現行內容以本頁正文為準。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31iab-可用但持續靜音前提受阻)；現行內容以本頁正文為準。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)；現行內容以本頁正文為準。

<a name="2026-10-31補測與單分頁重測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31補測與單分頁重測)；現行內容以本頁正文為準。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31一次授權的單分頁缺口補測)；現行內容以本頁正文為準。

<a name="v220-安裝驗收-r12026-11-01"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#v220-安裝驗收-r12026-11-01)；現行內容以本頁正文為準。

<a name="澄清後在原期限內續行"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#澄清後在原期限內續行)；現行內容以本頁正文為準。

<a name="auto-2-倍補充與本次驗收結案"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#auto-2-倍補充與本次驗收結案)；現行內容以本頁正文為準。

<a name="公開交付"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#公開交付)；現行內容以本頁正文為準。
