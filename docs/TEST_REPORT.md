# BiliCDN_TW v2.2.1 診斷撤除與保留功能驗證

日期：2026-11-01（Asia/Taipei）。基準為 6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb／v2.2.0。

## 變更

完整撤除診斷錄製、事故／請求／提前重試歷程、緩衝趨勢、報告產生／複製／匯出、診斷頁、剪貼簿授權與分頁原線對照。診斷專用評估與 IAB 收集／插樁／判定工具退出正式來源，固定提交可追溯原碼。

控制中心保留總覽、CDN、播放設定三頁；總覽數值、詳細狀態與單次刷新快照保留。正常選路、Native 開關、學習、量測、提前重試、停滯／備援恢復及整體停用保留。設定 schema 2、四鍵、Native 預設 true 及既有布林值不變，不遷移或清除使用者資料。

## 自動驗證

固定 Node 26.8.1 完整測試已通過 1,595 案，failed／cancelled／skipped／todo 均為 0。相較 v2.2.0 的 3,050 案，減少來自撤銷診斷、緩衝評估、IAB 工具、剪貼簿與原線對照專用案例；混合案例保留功能斷言，直接驗證狀態及副作用，新增退役原碼追溯的三個工具契約。三頁與移除操作的新契約先於來源修改執行並確認失敗，修改後通過。

型別、91 個正式模組的架構／循環檢查、完整測試及 verify 已通過；verify 包含格式、文件、封存、匯入純度、確定性建置、語法、移除標記與封裝校驗。安全差異掃描與公開發行進行中；尚未宣稱發布或安裝通過。

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
