# v1.8.8 — 已完成 SPA 預抓的 Route Pool 接續修復

- 修正 Bilibili 在使用者點擊站內推薦前，已完成下一支影片 playurl 預抓；之後 SPA reset 清除結果，導致新頁 API／頁面 Route Pool 仍為零的問題。
- 跨片 playurl 不再提前套用目前頁面的路由轉換；改以影片 key 暫存原始回應，等精確相符的 SPA 目的頁成為目前頁面後，才在新 generation 建立可信 Route Pool。
- Fetch 與 XHR 共用相同流程；不同目的頁、停用／重新啟用與容量淘汰的資料不能被後續頁面採用。
- 暫存只存在本分頁記憶體，最多 8 筆、每筆 1 MiB、合計 2 MiB；不寫 GM、診斷或完整 URL。
- 同片 playurl 仍立即使用既有轉換；播放、Catalog／Native 評分、Watchdog、測速預算與冷卻均不變。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
