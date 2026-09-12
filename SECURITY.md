# BiliCDN_TW 安全政策

## 信任邊界

這是具有 Tampermonkey GM 權限、在 Bilibili 頁面執行的 userscript。下列來源一律視為不可信：

- Bilibili 頁面及第三方 JavaScript
- `unsafeWindow` 上的物件與函式
- `console` 輸出與頁面合成事件
- playurl／CDN 回應中的 URL、host、數值與巢狀欄位
- BroadcastChannel 與 PerformanceObserver 資料

## 受保護資產

- GM 持久設定與健康資料
- CDN catalog 與選路完整性
- 使用者頻寬與播放可用性
- 簽名媒體 URL 的 path／query
- 診斷資料隱私

## 審查重點

1. 不可信來源到 GM 寫入與控制函式的資料流。
2. 不可信 host 到 URL hostname、Fetch、XHR 與 preconnect 的資料流。
3. probe、bakeoff、timer 與其他可造成流量放大的路徑。
4. 無界容器、統計數值及跨分頁資料。
5. Fetch／XHR 取消、錯誤與 response body 的生命週期。

## 不得誤述

v1.7.0 不攔截網站 Worker；任何重新引入 Worker 包裝、私有通道或政策同步的變更都必須視為新增攻擊面重新審查。

沒有真實 Chrome、Tampermonkey 與 Bilibili 實機證據時，不得宣稱特定 CDN、CORS／Range、4K／AV1／HEVC、背景播放、seek 或 SPA 已通過正式環境驗證。
