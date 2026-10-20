# v1.8.0

- 新增每個 playinfo epoch 專屬的 Signed Route Pool；video／audio representation 分組保存最多四條 exact signed route，完整 URL 在 SPA、停用、重啟或新 epoch 時清除。
- 新增 `nativeRouteRatings_v1` host-only 評級 Ledger：video 最多 48 筆、audio 最多 16 筆，六小時未見即刪除，超額依 `lastSeen` 淘汰。
- Trusted Catalog 與 Native Route 使用相同需求、吞吐、抖動、延遲及失敗尺度評分，但 Native 評級不會取得 catalog、合成換 host、preconnect 或 forced redirect 權限。
- 已知 bilivideo／Akamai 家族可在目前 representation 確認後探索；其他 HTTPS 網域必須先有一次可歸因的真實播放器傳輸成功，才可持久評級與日後 probe。
- 陌生節點最多占用既有 bakeoff 四個名額中的一個；未提高每輪候選、Range bytes、三秒 timeout、九十秒冷卻或四分鐘週期。
- 第一筆 Native probe 僅在需求餘裕、現用路線比較、分數差距、時效與 soft-block 條件全部成立時，暫定影響下一筆尚未開始的同組請求；真實傳輸成功後才成為 confirmed。
- 自動畫質不再以 `dash.video[0]` 代表目前畫質。active representation 由 `videoHeight` 匹配或八秒內兩筆有效影片傳輸確認，音訊、預取及舊 epoch 不得冒充。
- 診斷分開顯示目前請求路線、Catalog 改寫建議、active／tentative representation、Native 狀態、Ledger 容量及最近 bakeoff 後態；公開快照不包含 Native hostname 歷史或 signed URL。
- 固定 CDN 模式維持最高優先權並停用 Native primary／主動探索；原始 signed URL 仍保留為最終備援。
- Worker 維持 v1.7.0 的完整移除狀態；2x、AV1、Watchdog、HTTPDNS、UCB／EWMA參數及單一控制中心未改。
