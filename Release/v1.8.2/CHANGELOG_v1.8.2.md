# v1.8.2

- 統一 playurl／Fetch／XHR 的 Catalog／Native 決策；移除舊 transform 自行提升 Akamai 的行為。
- 內建 Catalog 不需出現在本片資料即可參與測速與合法選路。Native 只用本片已取得資格的完整 signed URL。
- 內嵌 playinfo 使用獨立、受限且不持久化的候選；known-family exact 請求成功完成後只解鎖該 URL。頁面第三方域名、redirect、取消、合成事件與舊候選不解鎖。
- 補齊頁面-only 影片成功後的一次起播測速，仍使用四候選／最多一 Native 與既有流量／冷卻。健康評級變動不換線。
- 診斷分列 Catalog 建議、route 計畫與實際後態，未知不再冒充 Catalog；碼率標示可信 API／頁面提示，保留有界去敏資料。
- 安全覆核後限制 Catalog 樣本為實際成功的 exact 頁面 URL；衝突／失效候選不得退回舊改寫器。XHR 使用捕捉的原生存取器及私有請求狀態，HEAD／空 body 不授權候選；無法歸因的 URL-less 錯誤只記錄、不猜測處罰。
- 不變更 2x／AV1、Watchdog 門檻、CDN catalog、UCB／EWMA、Worker 移除狀態、單一控制中心或自動更新來源。

實際驗收、安全掃描及限制見同目錄 TEST_REPORT。此版不新增補抓 playurl API、遙測、依賴或 CI/CD。
