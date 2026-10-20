# v1.9.6 — 失敗導向診斷與事故時間線

- 將診斷記錄器改為失敗導向：Transport、host restriction、fallback、Watchdog 與播放器 core 的重要因果不再受 Verbose 開關影響。
- 成功媒體請求不再逐筆保存 `request／headers／eof`；改以五秒、媒體種類、route type、group 與 host 彙總次數、bytes、TTFB、耗時及進度間隔。
- 新增本分頁事故時間線：自動事故或「標記剛剛卡頓」會納入前 60 秒脈絡並收集後續 30 秒；相關故障可延長，但不超過首次觸發後 90 秒。
- 凍結事故不會被後續健康流量覆蓋；`player.reload()` 後仍保留，完整頁面重新整理後清除，不寫入 Tampermonkey GM 儲存。
- 控制中心診斷加入「標記剛剛卡頓」與「清除事故記錄」；兩項操作只修改本分頁診斷記憶體，不發送網路、不改播放或學習狀態。
- 事件改用明確 schema；未知欄位會增加 `droppedFields`，外部網域只顯示本分頁穩定別名 `external#N`，不保存 URL、path、query、token、影片 ID 或 cookie。
- 每次合法 route recovery 使用同一 `actionId` 串接失敗、fallback 計畫、下一筆請求、實際後態與 core 結果。
- 修正已由 playurl 產生的 Catalog URL 在請求原樣送出時被誤標為 `root-original`；現在保留請求起始時的 `catalog-generated` 來源。

本版不改 CDN 選路、黑名單、Watchdog、2x、AV1、測速或播放器恢復行為，也不新增網路請求。依使用者要求，不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
