# BiliCDN_TW v2.1.10 Chrome／Tampermonkey 自主驗收 — 2026-10-09～10

**部分驗收完成；確認 BR-03 後依「找到問題並交付詳細報告」条件收尾，沒有宣稱全套通過。** BR-02／XHR 本輪 68 個案例執行通過；相同 DASH 清單排列改變誤觸 epoch 的新缺陷見 [BR-03 報告](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md)。BR-01 長 seek 另取得追加現場證據，根因仍未定位。

開始時間 2026-10-09 23:46（Asia/Taipei），基準 `c836a17818cd4ae86195e41b1e1c0933cff8cab0`，工作目錄乾淨，版本 2.1.10。透過 Chrome 154 中 Tampermonkey 實際解析的 userscript source、BR-02 `needsNativeOpen` 標記與產品診斷 version 核對載入修復版本。Bilibili Evolved 2.11.4 保持啟用；未調整 Chrome 設定或停用其他腳本。

只指定 [BV1tFZZBQE57 風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)。本輪有一次代理誤點：已收合選單的座標落到推薦影片，立即返回指定頁；該段資料排除，不能當作產品自動換片證據。之後輸入以目前 URL、可見控制與 `elementFromPoint` 三重核對。這個操作錯誤保留於本機 CHECKPOINT，不隱去。

## 實際安裝版 XHR 結果

| 群組 | 結果 | 證據檔 |
| --- | --- | --- |
| BR-02 原生 Blob 正常對照與原六個失敗情境 | 8／8 通過 | `br02-installed-matrix.json` |
| 文字／JSON／default、本地取消、重用、Blob、同步 setter 與 HTTPDNS | 14／14 通過 | `xhr-compatibility.json` |
| OPENED／已送出／DONE 的例外、同步回呼、參數轉換、重入與禁止第二次 send | 42／42 通過 | `br02-extended-installed.json` |
| 被拒 playurl 的 default／text／json 回應與 HTTP 422 | 3／3 通過 | `xhr-playurl-types.json` |
| 真正原生已送出 XHR 顯式 timeout，終止事件各一次 | 1／1 通過 | `xhr-timeout.json` |

合計 **68 個案例執行**，包括原生對照與重疊契約，不能當成 68 個新增正式單元測試。HTTPDNS 設精確送出前攔截，首批未截斷窗口捕捉為零；最後 guard 讀回已截斷，不能據此宣稱整段零原生嘗試。被拒 API 與 timeout 使用送出前攔截的合成受控回應／等待；測試資料沒有刻意外送。Blob 物件 URL、iframe、監聽器、合成全域及 Fetch patterns 已清理。

擴充矩陣初版的兩個失敗是工具期待錯誤：尚未 send 的 OPENED 原生 `abort()` 保持 readyState 1，原生與安裝版都如此；修正期待後 42／42 通過。初版 JS／JSON 保留為 `br02-extended-initial.*`，不列產品缺陷。另一次 playurl 回應因分開工具呼叫耗盡 3 秒 timeout，改成單回合送出／fulfill 後通過；首個音訊注入沒有有效命中，也不列成功案例。

**真正 startup gate 等待中的 failed open／同步限制／晚到取消，尚未在安裝版触發。** 現場網站 XHR 使用顯式 timeout，診斷標為 `xhr-explicit-timeout`、略過起播 gate。先前 Node／31 個 Chrome 來源隔離結果仍是不同證據；本輪不能替此邊界結案。

## 指定影片操作及網路觀察

| 情境 | 實際結果／限制 |
| --- | --- |
| 持續播放 | 取得真正 4K 3840×2160、8K 7680×4320 與時間／影格前進；另有自然 timeout／fallback，不宣稱全程無異常 |
| 暫停／續播 | 約 88.2 秒暫停，位置 1526.848306、影格 21853 保持，續播正常且保留 2× |
| 第一輪 8K → 4K | 實際解碼轉為 3840×2160 並持續前進；一次正常結果不能排除 BR-01 間歇性故障 |
| 重載後 8K、4K 切換及實際進度條 seek | 出現 **87.8 秒長 seek**，最後只有 1920×1080；選單仍顯示 4K。不列正常 seek 通過 |
| R04 音訊注入 | 真正命中一次 30280 音訊請求、Request 階段 ConnectionReset，當時影片正常且 reloadCount 不變；但產品歸屬 kind=null／waiting-data，沒有形成 audio 備援事件，**不能證明嚴格隔離** |
| 網路正向證據 | 收到真實媒體 HTTP 206、bytes 與完成事件；只保存請求識別碼／主機／類型／時間／狀態，不保存簽名 URL |

Network 捕捉部分窗口截斷，不能推論沒有失敗或全量統計。Debug 條件斷點未命中快取中的畫質回應，不能作內容判定證據；BR-03 改以完整、受控、未截斷的 API 攔截窗口複核。

## BR-01 追加觀察

重新載入同一影片還原合成內容後，診斷是 generation 1／epoch 0、可信真實 DASH 21 video／3 audio。8K 播放先遇到實際 timeout；之後點 4K，再以真正進度條跳到 977.5 秒。2026-10-10 00:16:13.996 開始 seeking，位置卡在 978、readyState 1、零新影格／無緩衝，00:17:41.781 才 seeked，約 **87.785 秒**。

事件包含 video timeout、route-fallback、`seek-interrupted` 及多筆網站 abort；在停滯期間 watchdog 為 `seek-grace`。00:17:41.782 恢復 playing 時解碼是 1080p，00:17:43.996 currentTime 982.415021、readyState 4。沒有終端 mediaError。這不是「永遠無法恢復」，也不是乾淨的單一步驟 seek 對照，網路／網站／腳本責任尚需分離。

這段 epoch 維持 0，沒有觀察到 BR-03 的錯誤 epoch 增加；不能把兩項當作同根因。證據為 `final-actions.json`、`final-playback-observation.json`、`restored-live-diagnostics.json`、`final-installed-diagnostics.json` 與 `seek-late-recovery.png`。

## BR-03 與剩餘範圍

獨立來源四契約為 **2 通過／2 失敗**；實際安裝版相同清單改排列造成 epoch **2 → 3**，正常對照 **4 → 4**。詳見 [詳細報告](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md)，不計入 68 個 XHR 通過數。

待深入／未結案包括：真正 startup gate、可正確歸屬的 audio 備援／video 有效恢復對照、BR-01 單獨 seek 與畫質切換責任定位、SPA 內容切换及恢復中再次失敗。未切換其他影片，完整公開 MP4／FLV 等舊覆蓋限制不新增為本輪完成宣稱。既有 v2.1.9 R02／R03 證據保持其原日期與版本。

## 產物與清理

證據／可重跑失敗契約／執行入口／RERUN／CHECKPOINT 位於 `.work/chrome-v2.1.10/2026-10-09/`。合成 API 與媒體已於 Request 階段攔截，BR-03 窗口四次 fulfill、零合成媒體外送。完成後清除攔截並重載指定頁，觀測計時器已 dispose，最後在該片約 982.67 秒暫停。

本輪沒有修復來源、修改正式測試或登記、提交、推送、升版、封裝或新 Codex Security 掃描。獨立紅燈契約不能與已發布版 339 個正式通過結果混算；原始安全產物與 Release 快照不改寫。僅更新現行瀏覽器狀態與文件，文件檢查結果另存本機。
