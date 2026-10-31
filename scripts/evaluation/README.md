# 離線評估工具

本頁集中評估操作、固定基準、退出碼與期限；所有命令從儲存庫根目錄執行。一般開發與發布見 [DEVELOPMENT](../../docs/DEVELOPMENT.md)。評估不構成瀏覽器續跑或產品採用授權，遵守 [永久禁令](../../AGENTS.md#使用者永久執行禁令)，歷史 loopback 模式不得執行。

## 原版與 v2 的獨立離線比較

[upstream-compare.mts](upstream-compare.mts) 固定讀取並校驗既有 v1.3.4 原件與已發布 v2.1.27 完整腳本，每版／情境使用新 Node 子程序及模擬頁面。先執行 `npm run compare:upstream -- --calibrate`，再執行不帶選項的完整摘要或 `--json` 機器結果；未知或重複選項退出 2，失敗／無效退出 1，全部有效且適用斷言通過退出 0。

比較使用現有 FakeClock、記憶體 GM、固定單一 AVC、共同合法來源及前景模型；1／2 倍分開，60 秒健康前置後執行固定情境。進度是模型輸入，可信事件也是 Node 模型，不代表瀏覽器可信輸入或真實播放效果。原版缺少核心重載／還原能力的專屬斷言標為不適用，共同斷言仍執行。原件不能成為正式 v2 建置／測試輸入；`verify` 只執行不載入原件的中立工具契約，不執行兩版比較。

每個比較案例與清理各 5 秒、子程序外層 60 秒、輸出上限 32 MiB。頁面生命週期計時器／監聽器與未完成請求分開盤點，再由模擬頁面釋放；不以強殺程序或強清時鐘算通過，不取代產品元件 dispose 契約。比較工具不寫檔；若保存結果，使用按日期登記的公開調查報告及精確允許的合成 JSON，執行紀錄直接保存於被忽略的本機封存，不留 `.work` 或額外 `dist` 產物。結果入口由 [HISTORY](../../docs/HISTORY.md) 維護。

## 已撤除的專用評估

診斷成本、緩衝趨勢／shadow／live／risk／adoption 及 scripts/iab 工具已於 v2.2.1 撤除；沒有正式可執行副本。[固定提交中的原工具與操作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md) 可供歷史追溯；原報告、效用 FAIL 與停止決策保持。

## 慢請求提前重試

`npm run evaluate:early-retry -- --json` 獨立執行六個固定模型情境，保存 policy／input SHA-256、逐案預測、held-out 未來供片、停頓及不必要重下載。退出碼 0 為門檻全通過、1 為效用 FAIL、2 為非法參數；不能把效用 FAIL 改為預期失敗或混入 verify 的全綠。測試工具無執行期依賴、不連網，不為取得介入放寬產品資格。它不能證明原生瀏覽器或實機效益。

<a name="實際緩衝效用與採用判定工具"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#實際緩衝效用與採用判定工具)；現行內容以本頁正文為準。

<a name="緩衝影子效用與成本評估"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#緩衝影子效用與成本評估)；現行內容以本頁正文為準。

<a name="診斷成本基準"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#診斷成本基準)；現行內容以本頁正文為準。

<a name="唯讀緩衝趨勢診斷"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/scripts/evaluation/README.md#唯讀緩衝趨勢診斷)；現行內容以本頁正文為準。
