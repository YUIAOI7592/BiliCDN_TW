# v1.8.1

- 修復 v1.8.0 在健康播放期間因 Native probe、representation 預取及每組獨立 route state 造成反覆換 CDN 的問題。
- 新增 session Route Affinity；Native Ledger 只提供評級，只有新 playinfo、verified Transport failure、Watchdog recovery 或可信固定／自動設定可以改變計畫路線。
- bakeoff／四分鐘週期只更新 Catalog／Native 評級，不再因測速勝出建立 forced redirect、切換寬限或立即改寫下一筆健康請求。
- 分離 representation revision、planned route 與 observed host；representation 變動不再被計為 CDN 切換，只有後續影片 Fetch／XHR 才形成實際 host 後態。
- 初始 representation 需有效影片傳輸加高度吻合，或兩筆連續傳輸；其後畫質／codec 切換一律要求兩筆連續同組傳輸，避免同高度 AV1／HEVC 預取反覆切換 active group。
- 自動畫質優先延續 Route Affinity：Catalog 仍可安全換 host；Native 僅能使用新 group 自己保存的同 host exact signed URL，缺少時整個 epoch 降級回 Catalog，不能合成 Native URL。
- 修復可信 playurl 建立 Signed Route Pool 後，被頁面 `__playinfo__` 相容 setter 清除的問題；page-compatible 轉換不再建立、清除或提交 Native 狀態。
- verified Catalog／Native 失敗及 Watchdog 卡頓現在會建立合法 recovery boundary，避開失敗 host 並保留既有即時復原能力；已開始的播放器請求不取消、不重送。
- 診斷新增 Route Affinity、計畫路線、實際後態、最近合法 recovery boundary 與穩定性守門計數，不把測速勝出或 representation 變動描述成已換 CDN。
- Known Native 仍只有 `*.bilivideo.com|cn|net` 與 `*.akamaized.net`；未加入 CloudFront、Fastly、Azure 或 Cloudflare。
- v1.8.0 保留作歷史版本，但因健康播放反覆換路問題由本版取代。
