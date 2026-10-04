# 內建瀏覽器 Range 與實際播放對照（2026-09-25）

> **歷史實驗紀錄：2026-09-25，Codex 內建瀏覽器。** 本文保留當時的 Range 與播放證據，不構成現行 userscript 的 Chrome/Tampermonkey 驗收；新增 CDN 節點計畫已撤銷，Catalog 未因本實驗變動。現行版本與文件分類見[文件索引](../../../docs/INDEX.md)。

## 問題與結論

本次檢查：短 Range 的成功和完成時間，能否代表同一 Host 在較大、較後段的 Range 及實際播放中的表現。測試涵蓋**現有全部 11 個 Catalog Host**；沒有增加節點、改動評選機制或變更使用者設定。

在兩部公開影片中，9/11 個 Host 都完成兩次 16 KiB video Range；其中只有 7/11 個也完成兩部影片的 512 KiB 開頭及中段 Range。`mirrorcos` 的四次 512 KiB video Range 都在 5 秒期限內未完成，`mirrorbos` 有兩次未完成；兩者卻各自在同一內建瀏覽器完成超過三分鐘的低畫質影片播放，觀察區間沒有等待、停頓或播放錯誤。這顯示**單次短 Range 不足以預測較大 Range，單次較大 Range 失敗也不足以判定低畫質播放會失敗**。本次沒有執行 v2 的評選機制，因此不能據此斷定目前的評選結果有錯，也不能據此調整權重或預設可用狀態。

## 環境與方法

- 時間：2026-09-25 約 16:16–16:57（UTC+8）。使用 Codex **內建瀏覽器**、這台電腦當時的網路及匿名可觀看的兩部公開影片；網路出口位置未知，時區不是台灣網路位置的證據。沒有使用既有 Chrome/Tampermonkey 腳本。
- 影片 A 約 4 分鐘，影片 B 約 27 分鐘。Range 探測選兩片當次 `playurl` 中的 AVC video 表示（id 32）；實際播放使用影片 B 的匿名自動畫質，觀測 video 解碼尺寸為 640×295、1×、靜音。這是低碼率案例，不代表高畫質。
- 對每個 Catalog Host、每部影片，以當次簽發的同一 video URL 保留路徑與查詢，只替換 Host；按順序測 0 位移 16 KiB、0 位移 512 KiB、檔案中段 512 KiB。每個 Range 先向當次原生 Host `upos-sz-mirrorcosov.bilivideo.com` 取得對照。`fetch` 不帶憑證、停用快取、拒絕轉址、5 秒截止。
- 成功條件是 HTTPS 直接 `206`、正確 `Content-Range`、完整位元組、與同資源原生回應的 SHA-256 一致。video 有 66 次候選請求和 24 次原生對照；原生對照均成功。另用影片 B 的 audio 對三個代表 Host 各測同樣三種 Range，共 9 次候選和 3 次成功的原生對照。
- 實際播放只選擇較大 video Range 有未完成樣本的 `mirrorcos`、`mirrorbos`，及原生路線。為強制測試指定 video Host，在**暫時測試分頁**中改寫後續媒體 XHR/Fetch 的 Host，保留當次簽名 URL 其他部分；再跳到尚未緩存的影片位置。CDP 網路事件核對 video 請求和回應 Host。audio 在兩個指定 Host 的播放中仍採網站原樣簽發的 `upos-hz-mirrorakam.akamaized.net` URL。這是測試分頁的暫時改寫，**不是**本專案 v2 路由的驗收。
- 播放分頁保持可見。計入的連續區間以 `currentTime`、經過時間、`waiting`／`stalled`／error 事件、`readyState` 與緩衝量觀察；中斷過的嘗試不計入。測試後已暫停播放、隱藏內建瀏覽器並關閉兩個暫時分頁。
- 不保存或在報告中輸出簽名 URL、媒體路徑／查詢／內容、Cookie、IP、影片 ID 或 HAR；原始位元組只在測試分頁記憶體中用於雜湊比對。

## 現有 11 個 Catalog Host：video Range

各欄 `x/2` 表示兩部影片各一次；完成時間依序為影片 A／B 的完整回應毫秒數，不是首位元組延遲，也不是穩定吞吐量。`>5000` 表示由 5 秒截止取消；`—` 表示無成功樣本。成功的回應均符合直接 `206`、Range、位元組長度和雜湊條件。

| Catalog Host | 原本預設禁用 | 16 KiB | 512 KiB 開頭 | 512 KiB 中段 | 512 KiB 開頭 ms（A／B） | 512 KiB 中段 ms（A／B） | 當次例外 |
| --- | :---: | ---: | ---: | ---: | --- | --- | --- |
| `upos-sz-mirroraliov.bilivideo.com` | 否 | 2/2 | 2/2 | 2/2 | 20／12 | 2954／198 | A 的中段明顯慢於開頭 |
| `upos-sz-mirrorcosov.bilivideo.com` | 是 | 2/2 | 2/2 | 2/2 | 79／82 | 79／94 | 兩片的原生 Host；不能當作切換收益 |
| `upos-sz-mirrorali.bilivideo.com` | 否 | 2/2 | 2/2 | 2/2 | 189／114 | 803／113 | — |
| `upos-sz-mirroralib.bilivideo.com` | 否 | 2/2 | 2/2 | 2/2 | 350／505 | 454／319 | 與同日較早 Node 複測結果不同 |
| `upos-sz-mirrorali02.bilivideo.com` | 否 | 2/2 | 2/2 | 2/2 | 1031／933 | 715／937 | — |
| `upos-sz-mirrorbos.bilivideo.com` | 否 | 2/2 | 1/2 | 1/2 | 1361／>5000 | 949／>5000 | B 的兩個 512 KiB 請求逾時 |
| `upos-tf-all-tx.bilivideo.com` | 否 | 2/2 | 2/2 | 2/2 | 642／817 | 882／493 | — |
| `upos-sz-mirrorcos.bilivideo.com` | 否 | 2/2 | 0/2 | 0/2 | >5000／>5000 | >5000／>5000 | 四個 512 KiB 請求逾時 |
| `upos-sz-mirrorhwov.bilivideo.com` | 是 | 0/2 | 0/2 | 0/2 | — | — | 瀏覽器 `TypeError`，沒有 HTTP 回應 |
| `upos-sz-mirrorhw.bilivideo.com` | 是 | 2/2 | 2/2 | 2/2 | 297／90 | 255／233 | 成功不改變預設禁用狀態 |
| `upos-hz-mirroraliov.bilivideo.com` | 是 | 0/2 | 0/2 | 0/2 | — | — | 瀏覽器 `TypeError`，沒有 HTTP 回應 |

原生對照的 512 KiB 開頭完成時間，影片 A 的四個批次為 330、80、81、78 ms；影片 B 為 78、82、80、80 ms。中段依序為 A：147、79、81、78 ms；B：81、80、85、79 ms。首批有較明顯的暖機影響。所有 24 次原生 Range 對照均為直接 `206` 並取得預期長度。

## Audio 抽樣

只對影片 B 的三個 Host 測試 audio；表中依序為 16 KiB／512 KiB 開頭／512 KiB 中段的完整回應毫秒數。三個 Host 各 3/3 通過直接 `206`、Range、長度和雜湊比對。原生對照依序為 62／82／79 ms。

| Host | Audio 完成時間 ms |
| --- | --- |
| `upos-sz-mirroraliov.bilivideo.com` | 10／11／224 |
| `upos-sz-mirroralib.bilivideo.com` | 227／262／396 |
| `upos-sz-mirrorcos.bilivideo.com` | 800／652／507 |

`mirrorcos` 的 audio 512 KiB 成功與 video 512 KiB 逾時並存，說明 video／audio 要保留分流證據；這次音訊抽樣不能代表其餘 8 個 Host。

## 影片 B 實際播放

三次都是單次、可見分頁、匿名低畫質播放。網路事件觀察到指定 video Host 的多筆 `206`；候選播放的 audio 繼續由 B 站當次簽發的原樣 Akamai URL 回應 `206`。CDP 事件緩衝曾截斷較早事件，因此不宣稱統計涵蓋區間內每筆請求。B 站登入提示曾使原生與 `mirrorbos` 的**前一次嘗試**暫停；關閉提示後重新計時，下表不含被中斷的區間。

| 路線 | 計入連續區間 | 播放進度 | waiting／stalled／error | 當次最小緩衝前瞻 | 網路核對 |
| --- | ---: | ---: | ---: | ---: | --- |
| 原生 video `upos-sz-mirrorcosov.bilivideo.com` | 200 秒 | +200 秒 | 0／0／0 | 約 70 秒 | 抽樣中 video 40 筆 `206`；audio 為原樣 Akamai `206` |
| 指定 video `upos-sz-mirrorcos.bilivideo.com` | 193 秒 | +193 秒 | 0／0／0 | 約 22 秒 | 指定 video 多筆 `206`；audio 為原樣 Akamai `206` |
| 指定 video `upos-sz-mirrorbos.bilivideo.com` | 188 秒 | +188 秒 | 0／0／0 | 約 69 秒 | 指定 video 多筆 `206`；audio 為原樣 Akamai `206` |

原生補測從影片約 1001 秒開始；`mirrorcos` 從約 923 秒、`mirrorbos` 從約 949 秒開始。播放區間有重疊但起點沒有完全一致。播放器實際切片請求比 512 KiB 測試 Range 小，足以解釋「512 KiB 截止前未完成」和「本次低碼率播放順利」可以同時成立；本次沒有量到高碼率持續吞吐能力。最小緩衝前瞻是取樣值，不能當成完整的卡頓保證。

## 對後續討論的邊界

1. 16 KiB 的單點速度沒有可靠代表 512 KiB 的中段表現；例如 `mirroraliov` 在影片 A 的 512 KiB 開頭為 20 ms，中段卻為 2954 ms。連線暖機、快取、位移與當次網路狀態都可能影響數字，不能直接按本表排序上線。
2. 5 秒內未完成 512 KiB 應記為**此條件的探測失敗**，不能直接貼成「該 Host 不相容」；`mirrorcos` 與 `mirrorbos` 的播放結果是反例。反過來，這兩個 Host 低畫質播放通過也不能證明其高畫質穩定。
3. 這是外部測試分頁的 Host 改寫，沒有安裝或執行本專案 v2 userscript；無法評價現行 `RouteCoordinator`、`MeasurementController` 的真實選擇或 Chrome/Tampermonkey 驗收結果。
4. 因此本報告僅保存量測證據供後續討論；不調整 Catalog、預設禁用、短測尺寸、評分權重或發布計畫。
