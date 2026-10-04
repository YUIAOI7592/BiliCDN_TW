# B 站 CDN 節點測試結果（2026-09-25）

> **歷史測試彙總與已結案決定：2026-09-25。** 保留 Node／內建瀏覽器證據與停止新增節點的決定；下列結果不代表現行 userscript 的 Chrome/Tampermonkey 驗收。現行版本與文件分類見[文件索引](../../../docs/INDEX.md)。

## 目前決定

**停止新增 CDN 節點的計畫，只保留測試結果。** 本紀錄不授權修改 `TRUSTED_CATALOG`、預設可用狀態、選路與測速機制，也不把任何候選標為可直接上線。原有 11 個 Catalog Host 及使用者設定均未因測試變動。

原因是：28 個外部 Host 在單一公開影片的低畫質播放通過，不等於跨影片、畫質、網路與時段的穩定收益。若全部加入，原有 11 個 Catalog Host 加上 28 個會成為 39 個，其中約 35 個預設可用；現行起播最多同測 3 路、健康量測每 10 分鐘最多 3 個候選，而音訊證據僅保留 32 個 Host。大量啟用會稀釋探索機會並超過音訊證據容量。

以下是當次對話中已完成測試的去識別摘要。沒有保存簽名 URL、路徑、查詢、媒體內容、Cookie、IP、影片 ID 或 HAR；因此無法憑本文件重播逐筆請求。測試時間使用 UTC+8 記錄，**時區不能證明網路位於台灣**。

## 第一階段：Node 網路初篩與複測

**時間：**2026-09-25 09:07–09:54（UTC+8）。使用這台電腦的網路、匿名可觀看的兩部公開影片，以及 Node 內建 `fetch`。來源包含原有 Catalog、當次擷取的 CCB 與 TW/SG 公開清單；去重後 503 個 Host。公開清單快照的 SHA-256 分別為 CCB `8c5bad9fe25689416670a8f86ce6fdf1f7088778fa5aa45d14d5d4f0de7ce0d0`、TW/SG `cbfe6b1e8f101f9641cbf732220b82034f956deecdd0b3ecce1ff685bb8ec860`。

| 項目 | 結果 |
| --- | ---: |
| 去重後盤點 | 503 Host |
| 排除一般媒體 Host 替換 | 52：`gotcha` 41、`bcache` 8、PCDN 2、僅能使用當次原樣 Native URL 的 Akamai 1 |
| 16 KiB HTTPS Range 初篩 | 451 Host 全數測試；第一次通過 238、重試通過 3、兩次均未通過 210 |
| 原生對照 | 23 次初篩對照與 390 次成對 512 KiB 對照成功 |
| 深入複測 | 65 Host；其中 47 個通過兩部影片 video/audio 開頭與後段 64 KiB 比對，51 個完成兩輪 512 KiB 的 6/6 測量 |
| 同時達成兩項深入門檻的外部 Host | 28 |
| 包含原生對照的探測讀取量 | 447.30 MiB |

210 個初篩未通過 Host 的第二次失敗類別：逾時 94、`ENOTFOUND` 62、HTTP 403 共 49、HTTP 404 共 2、HTTP 570 共 1、連線重設 1、`ENOENT` 1。這只描述當次簽名 URL、這台電腦的網路與每請求 3 秒限制，不是永久不可用判定。只有部分初篩通過 Host 進入深入複測；28 個是**網路探測入選數**，不是 Catalog 核准數。

503 個 Host 的逐名排除、失敗與通過分類，以及 65 個深入複測 Host 的逐項成績，保留於[當次 Node 全量初篩報告快照](CDN_NODE_FULL_SCREENING_2026-09-25.md)。該快照的瀏覽器驗收狀態停留在初篩完成當時；後續播放結果以下節為準。

### 原有 11 個 Catalog Host

`64 KiB` 的 `8/8` 表示兩部影片的 video/audio、開頭/後段都通過；`512 KiB` 的 `6/6` 表示第一部影片兩輪各三次都通過。「最低安全 Mbps」是成功樣本吞吐量經 0.7 折減後的最低值，不能視為所有網路的保證。

| Host | 原本預設禁用 | 16 KiB | 64 KiB | 512 KiB | 最低安全 Mbps | 第二影片 512 KiB |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `upos-sz-mirroraliov.bilivideo.com` | 否 | 1/1 | 8/8 | 6/6 | 29.07 | 3/3 |
| `upos-sz-mirrorcosov.bilivideo.com` | 是 | 1/1 | 8/8 | 6/6 | 9.79 | 3/3 |
| `upos-sz-mirrorali.bilivideo.com` | 否 | 1/1 | 8/8 | 6/6 | 2.23 | 3/3 |
| `upos-sz-mirroralib.bilivideo.com` | 否 | 1/1 | 8/8 | 3/6 | 1.74 | 0/3 |
| `upos-sz-mirrorali02.bilivideo.com` | 否 | 1/1 | 8/8 | 6/6 | 1.16 | 3/3 |
| `upos-sz-mirrorbos.bilivideo.com` | 否 | 1/1 | 8/8 | 6/6 | 1.76 | 2/3 |
| `upos-tf-all-tx.bilivideo.com` | 否 | 1/1 | 8/8 | 6/6 | 1.94 | 3/3 |
| `upos-sz-mirrorcos.bilivideo.com` | 否 | 1/1 | 7/8 | 3/6 | 1.53 | 0/3 |
| `upos-sz-mirrorhwov.bilivideo.com` | 是 | `ENOTFOUND` | — | — | — | — |
| `upos-sz-mirrorhw.bilivideo.com` | 是 | 1/1 | 8/8 | 6/6 | 2.82 | 3/3 |
| `upos-hz-mirroraliov.bilivideo.com` | 是 | `ENOTFOUND` | — | — | — | — |

`mirroraliov` 的第二部影片最低安全速度降至 3.91 Mbps，不能以第一部的速度代表普遍表現。`mirrorcosov` 當次就是原生 Host，不能把其結果解讀為切換收益。`mirrorhw` 雖通過 Node 探測，原本的預設禁用狀態仍保留。兩個 `ENOTFOUND` Host 已重試。

## 第二階段：Codex 內建瀏覽器實際播放

**時間：**2026-09-25 11:22–12:27（UTC+8）。使用與現有 Chrome/Tampermonkey 腳本分離的內建瀏覽器，匿名播放公開影片，480p、1×、靜音，兩個暫時分頁並行。測試期間暫時改寫播放器當次 `playurl` 回應，使 video/audio 路線指向指定候選 Host；頁面再次索取播放位址時也維持該指定。這是測試分頁內的暫時操作，並非 v2 腳本的路由行為。

每個 Host 的計入區間至少 180 秒；採樣檢查 `currentTime` 與經過時間同步推進、影片未暫停、`readyState=4`，並從瀏覽器網路事件核對候選 Host 的 video/audio `206` 回應及其他媒體 Host 是否接手。採樣不是逐幀量測，不能保證區間內完全沒有短暫卡頓。下表秒數取整；「通過」只表示**這部影片在此內建瀏覽器的三分鐘播放通過**。

| 外部 Host | 連續播放 | 本次觀察 |
| --- | ---: | --- |
| `cn-gddg-cm-01-18.bilivideo.com` | 193 秒 | 通過；另一部影片的 video Range 曾連續回應 403 |
| `cn-gddg-cm-01-03.bilivideo.com` | 196 秒 | 通過；另一部影片的 video Range 曾連續回應 403 |
| `cn-gddg-cm-01-05.bilivideo.com` | 182 秒 | 通過；另一部影片的 video Range 曾連續回應 403 |
| `cn-gddg-cm-01-04.bilivideo.com` | 188 秒 | 通過；另一部影片的 video Range 曾連續回應 403 |
| `cn-jssz-cm-02-34.bilivideo.com` | 198 秒 | 通過 |
| `cn-jssz-cm-02-20.bilivideo.com` | 194 秒 | 通過 |
| `cn-jxnc-cm-01-09.bilivideo.com` | 194 秒 | 通過 |
| `cn-jxnc-cm-01-04.bilivideo.com` | 190 秒 | 通過 |
| `cn-gddg-cm-01-02.bilivideo.com` | 193 秒 | 通過 |
| `cn-jssz-cm-02-18.bilivideo.com` | 192 秒 | 通過 |
| `cn-jssz-cm-02-35.bilivideo.com` | 248 秒 | 通過 |
| `upos-sz-mirror08c.bilivideo.com` | 183 秒 | 通過 |
| `upos-sz-mirror08h.bilivideo.com` | 188 秒 | 通過 |
| `upos-sz-mirrorhwb.bilivideo.com` | 193 秒 | 通過 |
| `cn-gddg-ct-01-12.bilivideo.com` | 187 秒 | 通過；起始一次 video 503，後續重試回應 206 |
| `upos-sz-mirror08ct.bilivideo.com` | 192 秒 | 通過 |
| `cn-hk-eq-01-12.bilivideo.com` | 187 秒 | 通過 |
| `cn-hk-eq-01-13.bilivideo.com` | 193 秒 | 通過 |
| `upos-sz-mirrorhwdisp.bilivideo.com` | 188 秒 | 通過 |
| `cn-zjjh-ct-04-12.bilivideo.com` | 191 秒 | 通過 |
| `upos-sz-estghw.bilivideo.com` | 186 秒 | 通過 |
| `cn-hk-eq-01-08.bilivideo.com` | 196 秒 | 通過 |
| `upos-sz-mirrorhwo1.bilivideo.com` | 191 秒 | 通過 |
| `upos-sz-mirror08disp.bilivideo.com` | 201 秒 | 通過 |
| `cn-hk-eq-01-06.bilivideo.com` | 195 秒 | 通過 |
| `upos-sz-mirrorbd.bilivideo.com` | 195 秒 | 通過 |
| `upos-sz-mirrorzos.bilivideo.com` | 190 秒 | 通過 |
| `cn-zjjh-ct-04-06.bilivideo.com` | 192 秒 | 通過 |

**彙總：**28/28 在指定 Host 上播放至少 180 秒，計入的播放區間都有 video/audio 成功回應，沒有觀察到其他媒體 Host 接手。其中 23 個未觀察到 HTTP 例外；4 個在另一部影片有 video 403，1 個在本片起始有 video 503。這五個例外不能被總通過率掩蓋。

最初的兩個鏡像節點測試曾因暫時攔截器只處理第一次 `playurl`，於頁面續取播放位址後回到原生 Host；已重新以涵蓋續取回應的設定播放，只有重測中全程維持候選 Host 的區間計入上表。第一個廣東節點在完成 193 秒後，頁面自動播放下一部影片並出現原生請求；該請求不屬於已完成的候選播放區間。

## 證據邊界

- 另有[現有 11 個 Catalog Host 的內建瀏覽器 Range／原生與指定 Host 播放對照](CDN_RANGE_PLAYBACK_EXPERIMENT_2026-09-25.md)。該實驗在同日稍後進行，檢查短測對較大 Range 與低畫質播放的預測力；沒有變更本報告的「停止新增節點」決定。
- Node 初篩與內建瀏覽器播放是兩種不同證據；前者可比對 Range 位元組與保守吞吐量，後者可觀察真實播放器進度與瀏覽器媒體請求。
- 內建瀏覽器測試沒有使用本專案的 Chrome/Tampermonkey 路由，也沒有完成高碼率、跨網路、跨時段或成對原生播放比較。不能據此聲稱加入 Catalog 會改善觀看體驗。
- 本報告記錄觀察，不排序上線優先序、不建立新增批次；原有 4 個預設禁用 Host 的設定不因測試改變。
