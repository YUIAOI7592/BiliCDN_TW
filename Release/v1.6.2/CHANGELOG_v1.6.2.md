# v1.6.2

- 補足 Worker 攔截啟用後的量測盲區，現在能區分：攔截器是否安裝、頁面是否呼叫 `Worker` constructor、因來源／安全條件原樣放行、成功包裝、私有 bootstrap 完成、Worker 網路／媒體活動，以及攔截器被頁面替換。
- Worker 以既有私有 `MessagePort` 回報固定 `{ version: 1, type: "ready" }`，普通 Worker message 仍不能影響 policy 或診斷結果。
- 控制中心與診斷報告分開顯示「本分頁」和「累計」數值，避免舊資料被誤判為目前影片的使用證據。
- 唯讀頁面快照只增加有界計數與固定狀態，不公開 Worker script URL、path 或 query。
- Worker 維持預設關閉；本版不自動重裝被替換的攔截器，也不改 CDN catalog、播放、2x、AV1、Watchdog、測速額度、timeout 或冷卻。

