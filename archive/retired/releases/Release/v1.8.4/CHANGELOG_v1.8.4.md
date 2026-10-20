# v1.8.4 — Native 卡頓恢復與 Catalog 媒體歸因

- 修正頁面原始節點因排除規則改寫到 Catalog 後，成功的 Fetch／XHR 仍無法建立 representation、路由後態與起播樣本的循環依賴。
- 新增有界的「腳本產生 Catalog URL」與「已完成 Catalog URL」來源對應；完整 URL 仍只存在目前 epoch。Catalog 成功不會解鎖原始 Native signed URL，也不會授予 Native 評級或主動探索權限。
- Watchdog recovery affinity 現在優先於 exact Native fallback，並維持到 playinfo epoch 改變。故障時後續相同 Range 會實際改走選定 Catalog，不再只增加修復次數卻繼續請求原 host。
- 健康播放時播放器自行採用原始備援的語意不變；只有既有合法 recovery 邊界啟用強制 affinity。
- 診斷新增 `catalogVerifiedUrls`，並將累計量正名為「觀察媒體資料（含快取重送，非 wire bytes）」。
- black／dead／soft、設定排除、Native 隔離、2x、AV1、Watchdog 門檻、測速額度與冷卻保持 v1.8.3 語意。

本版未執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`；其他建置與驗證資料留在儲存庫。
