# v1.9.4 — 長暫停後播放意圖未成立黑屏修復

- 長暫停期間暫時觀察目前主影片元素的 `play()`；只有同一呼叫具有 transient user activation 時才建立可信恢復意圖。
- 不辨識 Bilibili 的播放按鈕、CSS selector、空白鍵或快捷鍵，也不永久修改播放器方法。
- 死影片仍維持 paused 時，若 `readyState=0`、尺寸為零、MPD 仍有影片且 core 未初始化，連續四秒後最多呼叫一次既有 `player.reload()`。
- 保存位置優先使用外層 `player.getCurrentTime()`，倍速優先使用 `player.getPlaybackRate()`，避免死 `<video>` 的零值覆蓋正確狀態。
- 新核心出現影片證據後恢復位置與倍速，並只嘗試一次播放；若瀏覽器拒絕，不循環重試。
- 核心重建不再觸發路由恢復、host 暫避、black／dead／soft、probe、bakeoff、preconnect 或主動測速。
- 保留 paused 轉為播放的原有保守路徑，以及 90 秒 breaker、每 generation 兩次上限與所有既有 CDN 禁止規則。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
