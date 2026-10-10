# v2.1.14 Chrome／Tampermonkey 安裝驗收 — 2026-10-10

本文件只記錄實際載入 v2.1.14 後的結果；[BR-06 修復及來源隔離](BR06_FIX_REPORT.md)、[v2.1.13 歷史驗收](CHROME_v2.1.13_ACCEPTANCE.md) 分列。未核對新版執行 body／singleton 前，以下矩陣均為待驗收。

| 場景 | 狀態與有效前提 |
| --- | --- |
| 最新產物／實際 body／唯一 singleton | 待新版發布及實際載入 |
| Auto 1／2 倍 BODY 方向鍵、播放器焦點、滑鼠 | 待驗收；須確認新 userRevision、完整寬限與最新位置 |
| 正常 Auto、暫停／恢復、短 seek、12 秒 video-only 延遲 | 待新版驗收；v2.1.13 結果僅歷史證據 |
| 30 秒一次重載、其後完整 15 秒失敗且不重試 | 待驗收；提前 pause／error／換核心只證明撤銷 |
| 故障／重載前後 seek、拖曳／pointercancel、pause／rate、近 0 | 待驗收；精確 0 與網站正規化位置分列 |
| 晚到 reload／play 完成／拒絕、外部核心替換 | 待驗收；受控自有 SDK 回傳邊界另列 |
| 真正 hidden／返回新基準 | 待驗收；以原生 hidden getter 與 Runtime 真實可見性查詢為準，不能用被維持 visible 的 document.visibilityState |
| 生命週期／政策失效、影音隔離、BR-02～05 | 待新版交叉回歸 |

網站只使用指定風景片 `BV1tFZZBQE57`，不切影片、鎖畫質、改 Chrome 設定或停用其他腳本。先安裝精確當前 video 攔截、audio 通行；Fetch／Network 共用單一游標，持續分頁處理、不截斷。受控 IDs 的學習寫入過濾保留至晚到結果清理完成，核對記憶體及持久樣本後才釋放。不得為製造安裝版通過而替換控制器或媒體 getter。

證據目錄 `.work/functional-fixes/br06/2026-10-10-45a4420/`。原自然停滯網路原因與其他完整產品驗收不在本輪結案範圍。
