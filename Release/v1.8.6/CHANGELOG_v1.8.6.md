# v1.8.6 — SPA、片尾 Watchdog 與控制中心入口

- 修正 `__playinfo__` 在 `pushState`／`replaceState` 之前於同一事件循環指派時，SPA reset 會遺失新片 Route Pool、representation 與串流估計的問題。
- 新增具序號與目標頁面的 pending assignment；快速連續換片只採用最新且與目前頁面吻合的資料，沒有新指派時不會回填舊值。
- Watchdog 新增 `buffered-to-end` 判定：目前 contiguous range 已緩衝至有效 duration 結尾時，不再誤判低 buffer、重選 CDN、預連線或測速。
- 播放器設定面板新增全寬「⚙️ 開啟 BiliCDN 控制中心」按鈕；啟用與停用狀態均可使用，且只接受真實使用者點擊。
- 控制中心仍由閉包內入口直接開啟，不增加頁面公開函式；SPA 重建面板時會補回按鈕且不重複插入。
- 診斷新增去敏的 playinfo 生命週期摘要，並能顯示 `buffered-to-end` 與剩餘時間。
- CDN catalog、2x、AV1、評分算法、Watchdog 原門檻、測速預算與冷卻維持 v1.8.5 行為。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅需提供 `BiliCDN_TW.user.js`；其他建置與驗證資料留在儲存庫。
