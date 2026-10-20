# v1.9.2 — 隔夜起播與長暫停影片核心恢復

- 納入 v1.9.1 起播保護：隔夜健康資料與探測快取過期時，自動延遲 probe／bakeoff，直到播放器有連續進度及至少 12 秒實際可播放緩衝；額度耗盡後跳過，不強行測速。
- 修復長時間暫停後恢復時，音訊仍下載但影片 DASH core 未初始化而永久黑屏的狀態。
- 只有同 generation 曾健康播放、長暫停後恢復、MPD 仍有影片且持續缺少影片 metadata／Transport／影格時，才觸發一次 Bilibili 既有 `player.reload()`。
- 重建後恢復原播放位置、有效倍速及播放意圖；每個 resume token 最多一次、每 generation 最多兩次，失敗後進入 90 秒 breaker。
- 自動模式只在本分頁暫避原路線兩分鐘，不寫入 black／dead／soft；固定 CDN 與全部禁止規則維持原語意。
- 背景 hidden 事件仍隔離以維持續傳，真正返回前景的 visible 事件可到達 Bilibili 播放器。
- Manifest 與診斷新增 core identity／initialized、影片核心恢復狀態與有界後態；reload 呼叫本身不冒充恢復成功。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
