# v1.8.3 功能驗證報告

## 範圍與基準

不可變 v1.8.2 SHA-256：`e2be3130304706060acfef3dd2edecbc7f4422445f14c7a61a0049050a0cabb1`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。模組來源是唯一建置輸入。

依使用者要求，本版不執行 Codex Security 掃描或獨立 CS 子集；歷史檔案保留，不以舊版結果替本版背書。`npm test` 與共用 verify 改跑功能回歸選集；總數不與先前包含安全／Worker 案例的完整集合直接比較。

## 問題重現與功能案例

固定 v1.8.2 可重現：頁面原始 cosov URL 繞過排除並送出。
v1.8.3 專項 19 案例涵蓋：

- black、dead 分別覆蓋原始／固定／未知 representation、新處分加入已 open 的 XHR、既有 affinity、成功樣本、primary／backup／audio、重复 playinfo 與 SPA。
- 禁止的 host 不接收 probe、confirm、bakeoff 或 preconnect；明確啟用 preset 不豁免其他處分。
- 全部禁止時 Fetch 拒絕；XHR 無 native send、status=0、error/loadend 各一次，重複 send 拒絕、再次 open 可正常使用。
- host-lock、live/resource 不合成替代；若來源被禁且無合法替代則本地阻止。
- Native 隔離經 Pool 建立仍保留；black 到期但 dead 仍有效時繼續禁止。
- 在途 XHR 繼續交付原始 response；腳本停用時恢復原始行為。

既有功能回歸保留 Fetch 單 reader/cancel、XHR JSON／重用、停用／SPA、倍速、codec、Watchdog 與診斷等驗證。四項歷史測試做必要調整：固定不再豁免停用、受保護路徑使用未禁止 host、timeout 後仍受 soft 限制、媒體錯誤測試不再同時讓所有 latency probe 失敗。未放寬正式禁止判定來迎合舊測試。

## 本機結果

- 共用 verify 完成：292 項功能回歸通過、0 失敗；含上述 19 項本版專項，不重複加總。
- 語法、兩次建置一致性、不可變樣本、incremental/cumulative patch 實際套用一致性與 SHA-256 均通過。
- 既有 250 秒健康／雙 CDN／seek 流程仍比較請求數和 Range 額度；Range 計數不是瀏覽器實際 wire bytes 的保證。

## 實機驗收界線

本報告的自動結果是 VM／本機結果；v1.8.3 尚待使用者安裝後的真實 Chrome／Tampermonkey 播放驗證，不宣稱瀏覽器已通過。
優先自動畫質＋2x：確認被禁 host 沒有**新發起**的媒體請求、合法替代可播放、流暢時不反覆換線，再觀察 seek／SPA／背景切回。升級前已在途請求與瀏覽器自動 HTTP redirect 不能由本次發送前判定倒回取消；本版不加入額外手動 redirect/retry 網路。

仍待追查：媒體識別失聯、換片候選清空、未改寫也卡頓。嚴格禁止但沒有合法替代時會拒絕播放請求；不把這種本地拒絕算 CDN 下載失敗，也不宣稱全部卡頓已修復。
