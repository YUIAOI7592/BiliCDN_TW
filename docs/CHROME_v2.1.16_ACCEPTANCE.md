# v2.1.16 Chrome／Tampermonkey 安裝驗收 — 2026-10-10

本文件記錄 BR-08 發布後所需的 BR-01 剩餘實際安裝矩陣。**目前尚未取得新版完整執行 body／唯一 singleton 身分，全部安裝子項待開始；完整 BR-01 未結案。** [修復及來源隔離](BR08_FIX_REPORT.md)、[最新版驗證](TEST_REPORT.md)、[原 BR-08 失敗](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 分列。Node 637 與 Chrome 自有 iframe 31 有效案例不能替代安裝版。

## 身分與執行邊界

- 基準 v2.1.15／f0c2d39；新版 v2.1.16 發布與公開產物核對待完成，實際版本身分待更新。
- 網站只用 [指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 1／2 倍分開；不切片、不強制畫質、不改 Chrome 設定或停用其他腳本。
- 新證據 .work/functional-fixes/br08/2026-10-10-f0c2d39/installed/；每次連線／刷新重新取得完整 body／singleton／hooks，不沿用舊 remote object。
- 來源隔離合成媒體／時鐘只在自有 iframe。安裝版不得替換網站媒體 getter／控制器、重設 gate 預算或強制維持播放。

## 剩餘矩陣

| 場景 | 1 倍 | 2 倍 | 必要有效證據 |
| --- | --- | --- | --- |
| 完整產物／body／singleton／hooks | 待更新 | 待更新 | 與公開 v2.1.16 完整 body 匹配，singleton 1，實際 hooks |
| BR-08 wrapper／inner 按住 | 待驗收 | 待驗收 | 重新量矩形，當前有效 video 故障中按住 31 秒，dragging=true、無監控備援／重載；釋放用最新位置 |
| 正常 Auto／12 秒 video-only | 待驗收 | 待驗收 | 播放／暫停恢復／短 seek，有時間與新影格；audio 通行，無多餘重載，正常 ABR 不算缺陷 |
| 完整 15／30／重載後 15 秒 | 待驗收 | 待驗收 | 有效前景／授權／額度／breaker／非 paused/error：一次備援、至多一次實際重載、再完整 15 秒 failed／釋放，至少三 tick 不重試 |
| 新操作／晚到 SDK | 待驗收 | 待驗收 | 實際 reload/play 先呼叫才控制自有回傳；新 seek/drag/pause/rate 撤銷，完成／拒絕不復活；近 0 及網站正規化值分列 |
| 真正背景／返回 | 待驗收 | 待驗收 | 原生 hidden=true 且 Runtime visible=false，背景停止救援、返回建立新段不計背景時間 |
| 生命週期／政策／影音隔離 | 待驗收 | 待驗收 | 既有腳本控制暫變精確復原；audio fallback 無影片 token，合法 video 救援有效 |
| 傳輸／內容交叉 | 待驗收 | 待驗收 | 新版 hooks BR-02、同片自然 cid/epoch；原生同片新載入的 singleton pending gate BR-04／05 |

每種前提／倍速先執行一個完整窗口，只有新增必要前提才重跑。提前 pause／error／換核心只能證明撤銷，截斷／丟失不能計完整時序。沒有真正 hidden 不重複已知前景操作；沒有真 gate 不改網站 timeout／重建控制器。禁止注入不同 cid 製造換片。

## 觀察與清理契約

精確攔截在故障前安裝，限定當前 video、audio 通行。每窗口新單一 Fetch／Network 游標，持續處理至 hasMore=false，保存 truncated／dropped。受控 transport／startup／challenge ID 的學習抑制保留至晚到提交收束，不能只過濾 transport；清理核對記憶體／持久零匹配，不清除既有學習。

SDK 回傳控制明列受控邊界；保存完整方法描述子，還原僅限仍由工具持有的 wrapper，繼承方法刪除自有遮蔽。最後核對 held=0、patterns 空、自有 observer／API／iframe／timer／listener清除；歷史事件缺口不補算完成。來源隔離的清理不代替此處安裝版清理。

## 目前結果與續行條件

尚未載入實際 v2.1.16，沒有新增安裝版通過宣稱。正式發布及公開產物核對後，取得實際新版再依表續測；若擴充介面受工具政策限制，僅請使用者更新既有腳本。新缺陷另寫完整報告、不自行擴大修復範圍。原自然 87.785 秒停滯網路起因與其他產品驗收獨立保留。
