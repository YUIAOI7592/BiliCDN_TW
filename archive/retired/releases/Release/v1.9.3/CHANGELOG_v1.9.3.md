# v1.9.3 — 限制狀態熱路徑與背景影片觀察修復

- black／dead 的 Tampermonkey 儲存同步改為一秒 freshness gate，同一週期內的選路、診斷與面板查詢共用記憶體狀態。
- 每個 restriction store 每輪只讀一次 GM；無到期或污染資料時不寫回，到達已知到期時間時可立即刷新。
- Watchdog 與 seek 預熱改用同一主影片 resolver；影片因背景或折疊暫時成為零尺寸時，不再被當成不存在。
- SPA、停用及重新啟用會清除影片 resolver 快取，新的可見播放器仍具有優先權。
- 移除沒有實際互斥作用的 BroadcastChannel；支援環境仍以 Web Locks 協調測速，不支援時維持原有冷卻及額度。
- 不改 CDN 清單、路由評分、2x／AV1、Watchdog 門檻、測速預算、preconnect 或 Native Route。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
