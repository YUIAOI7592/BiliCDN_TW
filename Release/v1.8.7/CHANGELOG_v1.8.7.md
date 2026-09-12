# v1.8.7 — SPA playurl generation 競態修復

- 修正 Bilibili 在新影片 playurl 請求先於 `pushState` 發出、回應晚於 SPA generation reset 完成時，可信 Route Pool 被保持為零的問題。
- Fetch 與 XHR 共用受限接納規則：只接受緊鄰該次 SPA、且請求中的 `bvid`／`aid`／`epid` 與目前頁面精確相符的回應。
- 不同影片的晚到回應、停用／重新啟用產生的舊回應，以及缺少精確分 P 識別的跨 generation 回應仍維持 fail-open 隔離。
- 不取消或重送已開始的播放器請求；播放、Catalog／Native 評分、Watchdog、測速預算與冷卻均不變。
- 保留 v1.8.6 的片尾 `buffered-to-end` 修正與播放器控制中心按鈕。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
