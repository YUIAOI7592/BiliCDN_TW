# v1.8.4 功能驗證報告

## 基準與實機問題

不可變 v1.8.3 SHA-256：`a55b80eb3d23cf9c15145399978b532117c2b2bce5205615a8d2d7d1ebcac4f6`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

v1.8.3 真實 Chrome／Tampermonkey 觀察三支自動畫質＋2x 影片：兩支及回訪原片可穩定播放、seek 後恢復；背景分頁 65.745 秒內影片進度增加 131.495 秒、影格增加 7920，buffer 約 70 秒。初次原片則可見同一 Akamai Range 在約 61 ms 內啟動六次，均為快取 206；buffered ranges 為空且影片總影格不增加。Watchdog 已累積三次修復嘗試但請求仍留在原 host。

同時確認：頁面原始 cosov 被替換到 Catalog 後實際播放成功，診斷仍顯示 `unlockedUrls=0`、`activeRepresentation=null`、`awaiting-video-completion`。這證明改寫後的成功終態失去 group provenance；不等於 Akamai 初始不產生可播放 buffer 的根因已被完整證明。

## 修補驗證

新增 6 項專項案例，均至少經模組或正式未插樁 userscript 入口：

- legal Watchdog recovery 即使沒有可懲罰 host，也會讓下一筆 exact Native Fetch／XHR 改到合格 Catalog。
- recovery affinity 持續約束後續請求，不會因第一筆 Catalog 成功就立即回到 Native。
- 被排除的頁面 URL 在 playinfo 輸出 Catalog URL 後，Fetch 與 XHR 成功終態都能確認同一 video representation。
- Catalog 成功只增加 `catalogVerifiedUrls`；原始 Native `unlockedUrls` 保持 0，沒有 Native Ledger／probe 權限提升。
- 正式 XHR 案例重現「第一筆 Native、Watchdog 恢復、下一筆相同 URL」流程，後續 host 不再是原 Akamai。

## 本機結果

- `npm test`：298 項功能回歸通過、0 失敗、0 skip；包含上述 6 項，不重複加總。
- 相關路由／限制／timeout／250 秒流程專項 77 項通過。
- 黑／dead／soft、Fetch 單 reader、XHR JSON／重用、host-lock、PCDN、停用／SPA、2x、AV1、contiguous buffer、控制中心與有界診斷回歸通過。
- 健康 250 秒流程的播放器請求、probe 數與 Range 額度未因本修補增加。Range 額度及觀察媒體 bytes 不是瀏覽器實際 wire bytes 的保證。

依使用者要求，本版不執行 Code Security 掃描或獨立安全子集。

## 實機驗收界線

v1.8.4 尚待安裝後重測先前故障影片。成功標準是：若再次進入零 buffer／同 Range 迴圈，Watchdog recovery 後的新播放器請求應改到 Catalog 並恢復影格與 buffer；正常播放期間不應額外換 host。

VM／本機結果不等於真實 Chrome 驗收。仍需自動畫質、1080p／4K 2x、seek、SPA、背景分頁，以及先前 Akamai 現場的實際重測。修補改善故障恢復，不宣稱已證明 Akamai 初始 append 失敗的瀏覽器內部根因。
