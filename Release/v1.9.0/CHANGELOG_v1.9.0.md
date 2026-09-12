# v1.9.0 — 播放器 MPD 同步與 SPA Route Pool 自癒

- 當 SPA 沒有新 playurl／`__playinfo__` 時，只讀目前 `player.getManifest()` 與 `player.__core().getMpd()`，經有界欄位複製後重建 representation 與 Route Pool。
- 播放器同步只在短期有界重試及實際媒體 context miss 時執行；不開啟統計面板、不修改播放器，也不新增 Bilibili API／媒體請求。
- 首筆 Fetch／XHR 仍缺少 context 時，先同步重讀一次；若播放器資料尚不可用，再以該 exact URL 建立最多 16 組 transport bootstrap，保留既有 Catalog 改寫而不猜測 representation。
- 資料優先序固定為可信 playurl API、player MPD、page-hint、transport bootstrap；可信 API 稍後抵達會接管較低層資料。
- 新增播放器同步狀態、來源、重試與兜底計數；診斷與頁面快照不公開 signed URL、path、query 或 token。
- 保留 2x、AV1、Catalog／Native 評分、Watchdog、黑名單、測速預算、背景續播及 Worker 移除狀態。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
