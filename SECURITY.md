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
6. playurl 到 Native 主動 probe、GM Ledger 與播放器 exact signed URL 的三條資料流。

## Native Route 邊界

v1.8.0 將非 catalog 的原生 signed URL 視為不可信媒體路線，而不是可信 CDN。完整 URL 只能存在於目前 playinfo epoch，跨影片僅保存經驗證的 hostname 健康評級。Native 評級不得授予 catalog 成員資格、合成換 host、preconnect 或 forced redirect 權限；第三方網域需先有可歸因的真實播放器傳輸成功，才可持久評級及日後主動探索。

v1.8.1 將評級與換線權限分離。健康播放期間的 probe／bakeoff 只能更新評級；Route Affinity 只可在可信 playurl 新 epoch、verified Transport failure、Watchdog recovery 或可信使用者固定／自動設定邊界改變。頁面 `__playinfo__` 相容 hook 不得建立、清除或提交 Native state。

## 不得誤述

v1.7.0 不攔截網站 Worker；任何重新引入 Worker 包裝、私有通道或政策同步的變更都必須視為新增攻擊面重新審查。

沒有真實 Chrome、Tampermonkey 與 Bilibili 實機證據時，不得宣稱特定 CDN、CORS／Range、4K／AV1／HEVC、背景播放、seek 或 SPA 已通過正式環境驗證。
