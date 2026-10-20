# v1.8.9 — 未讀取 XHR 預抓的 SPA 接續修復

- 修正下一支影片的 playurl XHR 已完成，但播放器尚未讀取 `response`／`responseText` 就先 SPA，導致 v1.8.8 staging 沒有執行、新頁 Route Pool 仍為零的問題。
- playurl XHR 進入可信原生 `DONE` 時先完成一次轉換與快取；文字及 `responseType=json` 都能在頁面 getter 之前保留精確目的頁資料。
- 頁面稍後讀取 getter 會重用同一份快取，不重複轉換、不修改瀏覽器持有的 JSON 物件。
- 原有精確影片 key、generation、錯頁隔離、停用清理及 staging 容量限制維持不變。
- 不改 CDN 清單、Catalog／Native 排名、2x、AV1、Watchdog、測速預算或冷卻。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
