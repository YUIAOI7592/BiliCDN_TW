> 歷史快照：這是 2026-09-25 09:07–09:54（UTC+8）Node 全量初篩完成時的原始對話報告，保留完整 Host 名稱與當時判定。其後已做內建瀏覽器三分鐘播放；最新結論與停止新增節點的決定見 [CDN_TEST_RESULTS_2026-09-25.md](CDN_TEST_RESULTS_2026-09-25.md)。本快照中的「尚未播放驗收」描述只適用於初篩完成當時。

# B 站 CDN 全量初篩與比較測試報告

> **文件定位：2026-09-25 Node 初篩歷史證據。** 下文的候選優先序與「下一步 Chrome 播放驗收」是當時建議；新增節點計畫已撤銷，不形成目前待辦。現行版本與文件分類見[文件索引](../../../docs/INDEX.md)。

**測試已完成，專案檔案、腳本及使用者設定均未改動。** 這份報告只評價本機當次的網路探測；沒有把任何新 Host 納入 Catalog。

## 範圍與方法

測試於 **2026-09-25 01:07–01:54 UTC** 執行（台灣時間 09:07–09:54）。使用這台電腦的網路、匿名可觀看的兩部公開影片及 Node 內建 `fetch`。時區不代表電腦位於台灣，也無法據此推定 ISP。

來源為專案原有 11 個 Catalog Host、當次擷取的 [CCB 清單](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/cdn.json) 495 筆、[TW/SG 清單](https://github.com/a0972199950/bilibili-cdn-switcher/blob/master/src/cdn-list.json) 20 筆，以及先前選出的五個重點候選；去重後共 **503 個 Host**。來源快照的 SHA-256 分別為 `8c5bad9fe25689416670a8f86ce6fdf1f7088778fa5aa45d14d5d4f0de7ce0d0` 與 `cbfe6b1e8f101f9641cbf732220b82034f956deecdd0b3ecce1ff685bb8ec860`。

- **初篩：** 451 個合格 Host 全數接受最多 16 KiB 的 HTTPS Range 請求；最多四個並行、每次三秒。核對直接 `206`、`Content-Range`、完整位元組及與原生回應相同的 SHA-256。每 20 個 Host 更新簽名 URL 並重測原生對照；23 次原生對照均成功。初篩失敗的 213 個 Host 全部再試一次。
- **複測：** 原 Catalog 初篩通過者及選出的外部 Host，使用兩部影片的 video／audio 開頭與合法後段，各做最多 64 KiB 的位元組比對。另對 65 個 Host 進行每輪三次、兩輪相隔至少 30 分鐘的順序 512 KiB video 測量，與同資源原生 Host 交錯比較；390 次成對原生測量均成功。13 個重點 Host 還做了第二部影片的三次 512 KiB 測量。
- **速度欄位：**「安全 Mbps」是實測吞吐量乘以 0.7；最低值是成功樣本中的最低值。成功數不足時，所列速度**不能視為穩定速度**。成對倍數是候選與原生 Host 的中位比值。
- **用量：** 計入探測中的原生對照後，共讀取 **447.30 MiB** 媒體資料，低於 500 MiB 上限。原始簽名 URL、媒體內容、Cookie、IP 及影片 ID 均未寫入報告或專案檔案。

## 總結果

| 階段 | 結果 |
|---|---:|
| 去重後盤點 | 503 Host |
| 結構性排除 | 52：`gotcha` 41、`bcache` 8、PCDN 2、Akamai 名稱 1 |
| 接受 16 KiB 初篩 | 451 |
| 第一次通過 | 238 |
| 重試後才通過 | 3 |
| 兩次均未通過 | 210 |
| 進入完整複測 | 65，另對 3 個初篩重試成功者補做 64 KiB |
| 65 個中兩部影片 video／audio、多位移全通過 | 47 |
| 65 個中兩輪 512 KiB 全部 6/6 通過 | 51 |
| **外部 Host 同時達成上述兩項** | **28** |

210 個初篩未通過者的**第二次**結果為：逾時 94、DNS `ENOTFOUND` 62、HTTP 403 共 49、HTTP 404 共 2、HTTP 570 共 1、連線重設 1、`ENOENT` 1。這表示它們在**本機、這兩次簽名 URL 與三秒限制下**無法提供正確位元組；不能推論所有地區或時間都不可用。沒有合格 Host 遺漏初篩；只有初篩通過者中的一部分因測試預算而未做深入測量。

### 原有 11 個 Catalog Host

來源：`C`＝現有 Catalog、`L`＝CCB、`T`＝TW/SG。64 KiB 的 `8/8` 表示兩部影片、video／audio、開頭／後段均通過；512 KiB 的 `6/6` 表示第一部影片兩輪測速全通過。「第二影片」是額外測試。

| 原 Catalog Host | 來源 | 預設禁用 | 16K | 64K | 512K 兩輪 | 安全最低／中位 Mbps | TTFB 中位 ms | 對原生倍數 | 第二影片 512K |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| `upos-sz-mirroraliov.bilivideo.com` | C+L+T | 否 | 1/1 | 8/8 | 6/6 | 29.07／195.73 | 9.0 | 19.17× | 3/3 |
| `upos-sz-mirrorcosov.bilivideo.com` | C+L+T | 是 | 1/1 | 8/8 | 6/6 | 9.79／11.71 | 77.5 | 同原生 | 3/3 |
| `upos-sz-mirrorali.bilivideo.com` | C+L+T | 否 | 1/1 | 8/8 | 6/6 | 2.23／4.33 | 313.5 | 0.37× | 3/3 |
| `upos-sz-mirroralib.bilivideo.com` | C+L+T | 否 | 1/1 | 8/8 | 3/6 | 1.74／4.20 | 138.0 | 0.42× | 0/3 |
| `upos-sz-mirrorali02.bilivideo.com` | C | 否 | 1/1 | 8/8 | 6/6 | 1.16／1.57 | 963.0 | 0.17× | 3/3 |
| `upos-sz-mirrorbos.bilivideo.com` | C | 否 | 1/1 | 8/8 | 6/6 | 1.76／4.09 | 343.0 | 0.44× | 2/3 |
| `upos-tf-all-tx.bilivideo.com` | C+T | 否 | 1/1 | 8/8 | 6/6 | 1.94／3.01 | 376.5 | 0.33× | 3/3 |
| `upos-sz-mirrorcos.bilivideo.com` | C+L+T | 否 | 1/1 | 7/8 | 3/6 | 1.53／6.12 | 185.0 | 0.59× | 0/3 |
| `upos-sz-mirrorhwov.bilivideo.com` | C+T | 是 | ENOTFOUND | — | — | — | — | — | — |
| `upos-sz-mirrorhw.bilivideo.com` | C+L+T | 是 | 1/1 | 8/8 | 6/6 | 2.82／21.36 | 43.0 | 2.17× | 3/3 |
| `upos-hz-mirroraliov.bilivideo.com` | C | 是 | ENOTFOUND | — | — | — | — | — | — |

`aliov` 在第一部影片的本機測速很快，但第二部影片的最低安全速度降至 **3.91 Mbps**；因此表中的 195.73 Mbps 中位數不能當作普遍保證。`cosov` 在這組測量中就是原生 Host，不能解讀成切換後的加速收益。`hw` 雖在 Node 探測通過，仍是專案原本的預設禁用項，本次結果不足以改變該設定。`alib`、`cos` 的大區塊成功率不足；`bos` 額外第二影片為 2/3，應保留疑慮。兩個 `ENOTFOUND` Host 均已重試。

### 值得下一步 Chrome 播放驗收的外部 Host

下表前 **28 個**同時通過兩部影片的 video／audio 多位移比對，以及相隔 30 分鐘的兩輪 512 KiB 測量。這是「值得後續驗收」的網路證據，**尚非 Chrome CORS、真實播放或整合核准**。後 28 個至少有一項未通過。`P` 代表先前挑出的重點候選。

| 外部 Host | 來源 | 64K | 512K | 安全最低／中位 Mbps | TTFB 中位 ms | 對原生中位倍數 | 未通過類別 |
|---|---|---:|---:|---:|---:|---:|---|
| `cn-gddg-cm-01-18.bilivideo.com` | L | 8/8 | 6/6 | 7.47／21.91 | 39.5 | 2.18× | — |
| `cn-gddg-cm-01-03.bilivideo.com` | L | 8/8 | 6/6 | 6.73／19.32 | 45.5 | 1.88× | — |
| `cn-gddg-cm-01-02.bilivideo.com` | L | 8/8 | 6/6 | 6.41／18.70 | 46.5 | 0.67× | — |
| `cn-gddg-cm-01-05.bilivideo.com` | L | 8/8 | 6/6 | 5.64／19.84 | 43.5 | 2.29× | — |
| `cn-jssz-cm-02-34.bilivideo.com` | L | 8/8 | 6/6 | 5.33／14.98 | 60.0 | 1.09× | — |
| `cn-jssz-cm-02-20.bilivideo.com` | L | 8/8 | 6/6 | 5.30／14.05 | 62.0 | 1.34× | — |
| `cn-jxnc-cm-01-09.bilivideo.com` | L | 8/8 | 6/6 | 4.98／13.63 | 65.5 | 1.35× | — |
| `cn-jxnc-cm-01-04.bilivideo.com` | L | 8/8 | 6/6 | 4.64／13.41 | 64.5 | 1.30× | — |
| `cn-gddg-cm-01-04.bilivideo.com` | L | 8/8 | 6/6 | 4.49／22.67 | 38.5 | 2.01× | — |
| `cn-jssz-cm-02-18.bilivideo.com` | L | 8/8 | 6/6 | 4.21／14.98 | 60.0 | 0.42× | — |
| `cn-jssz-cm-02-35.bilivideo.com` | L | 8/8 | 6/6 | 4.18／14.54 | 63.5 | 1.44× | — |
| `upos-sz-mirror08c.bilivideo.com` | L+T+P | 8/8 | 6/6 | 3.83／14.43 | 63.0 | 0.43× | — |
| `upos-sz-mirror08h.bilivideo.com` | L+T | 8/8 | 6/6 | 3.62／19.84 | 48.5 | 0.53× | — |
| `upos-sz-mirrorhwb.bilivideo.com` | L+T | 8/8 | 6/6 | 2.76／20.32 | 43.5 | 1.42× | — |
| `cn-gddg-ct-01-12.bilivideo.com` | L | 8/8 | 6/6 | 2.74／6.36 | 155.5 | 0.63× | — |
| `upos-sz-mirror08ct.bilivideo.com` | L+T | 8/8 | 6/6 | 2.58／19.26 | 48.0 | 0.49× | — |
| `cn-hk-eq-01-12.bilivideo.com` | L | 8/8 | 6/6 | 2.32／3.61 | 176.0 | 0.40× | — |
| `cn-hk-eq-01-13.bilivideo.com` | L | 8/8 | 6/6 | 2.29／4.55 | 146.0 | 0.19× | — |
| `upos-sz-mirrorhwdisp.bilivideo.com` | L | 8/8 | 6/6 | 2.29／6.75 | 44.0 | 0.19× | — |
| `cn-zjjh-ct-04-12.bilivideo.com` | L | 8/8 | 6/6 | 2.27／4.39 | 278.0 | 0.43× | — |
| `upos-sz-estghw.bilivideo.com` | L | 8/8 | 6/6 | 2.26／14.39 | 61.5 | 0.63× | — |
| `cn-hk-eq-01-08.bilivideo.com` | L | 8/8 | 6/6 | 1.98／4.61 | 186.5 | 0.32× | — |
| `upos-sz-mirrorhwo1.bilivideo.com` | L+T+P | 8/8 | 6/6 | 1.93／21.75 | 42.5 | 1.56× | — |
| `upos-sz-mirror08disp.bilivideo.com` | L | 8/8 | 6/6 | 1.50／6.31 | 63.5 | 0.17× | — |
| `cn-hk-eq-01-06.bilivideo.com` | L | 8/8 | 6/6 | 1.42／3.75 | 159.5 | 0.31× | — |
| `upos-sz-mirrorbd.bilivideo.com` | L | 8/8 | 6/6 | 1.29／6.46 | 132.0 | 0.45× | — |
| `upos-sz-mirrorzos.bilivideo.com` | L | 8/8 | 6/6 | 1.23／2.97 | 518.0 | 0.21× | — |
| `cn-zjjh-ct-04-06.bilivideo.com` | L | 8/8 | 6/6 | 1.05／7.62 | 266.5 | 0.69× | — |
| `cn-gdjm-cm-01-08.bilivideo.com` | L | 7/8 | 6/6 | 6.92／20.32 | 44.5 | 2.14× | HTTP/2 串流錯誤 |
| `cn-gdjm-cm-01-01.bilivideo.com` | L | 7/8 | 6/6 | 6.73／19.91 | 44.5 | 1.92× | HTTP/2 串流錯誤 |
| `cn-gdjm-cm-01-06.bilivideo.com` | L | 7/8 | 6/6 | 6.37／16.84 | 46.5 | 1.66× | HTTP/2 串流錯誤 |
| `cn-gdjm-cm-01-04.bilivideo.com` | L | 7/8 | 6/6 | 6.16／18.58 | 47.5 | 0.58× | HTTP/2 串流錯誤 |
| `cn-gdjm-cm-01-03.bilivideo.com` | L | 7/8 | 6/6 | 5.27／19.63 | 45.0 | 2.03× | HTTP/2 串流錯誤 |
| `cn-hbwh-cm-01-06.bilivideo.com` | L | 7/8 | 6/6 | 4.88／13.26 | 66.0 | 0.47× | HTTP/2 串流錯誤 |
| `cn-hbwh-cm-01-19.bilivideo.com` | L | 7/8 | 6/6 | 4.83／12.54 | 69.0 | 0.49× | HTTP/2 串流錯誤 |
| `cn-fjqz-cm-01-09.bilivideo.com` | L | 7/8 | 6/6 | 4.78／13.08 | 68.0 | 1.04× | HTTP/2 串流錯誤 |
| `cn-fjqz-cm-01-01.bilivideo.com` | L | 7/8 | 6/6 | 4.77／12.74 | 70.5 | 1.21× | HTTP/2 串流錯誤 |
| `cn-hbwh-cm-01-11.bilivideo.com` | L | 7/8 | 6/6 | 4.68／13.53 | 64.5 | 0.96× | HTTP/2 串流錯誤 |
| `cn-sdjn-cm-02-03.bilivideo.com` | L | 7/8 | 6/6 | 4.55／12.91 | 67.0 | 1.26× | HTTP/2 串流錯誤 |
| `cn-sdjn-cm-02-07.bilivideo.com` | L | 7/8 | 6/6 | 4.54／12.41 | 70.5 | 0.96× | HTTP/2 串流錯誤 |
| `cn-hbwh-cm-01-10.bilivideo.com` | L | 7/8 | 6/6 | 4.50／12.21 | 71.0 | 0.93× | HTTP/2 串流錯誤 |
| `cn-sccd-cm-03-05.bilivideo.com` | L | 7/8 | 6/6 | 3.70／11.96 | 72.5 | 1.26× | HTTP/2 串流錯誤 |
| `cn-fjqz-cm-01-08.bilivideo.com` | L | 7/8 | 6/6 | 3.52／14.46 | 62.0 | 1.40× | HTTP/2 串流錯誤 |
| `upos-sz-mirrorbdb.bilivideo.com` | L | 8/8 | 5/6 | 1.78／2.78 | 398.0 | 0.26× | 逾時 |
| `upos-tf-all-hw.bilivideo.com` | T | 8/8 | 3/6 | 1.49／7.67 | 117.0 | 0.52× | 逾時 |
| `upos-sz-estgcos.bilivideo.com` | L | 8/8 | 5/6 | 1.46／2.47 | 1138.0 | 0.17× | 逾時 |
| `upos-sz-mirrorcosdisp.bilivideo.com` | L | 8/8 | 2/6 | 1.44／1.50 | 1246.5 | 0.21× | 逾時 |
| `cn-hk-eq-01-14.bilivideo.com` | L | 8/8 | 4/6 | 1.26／6.56 | 245.0 | 0.46× | 逾時 |
| `cn-hk-eq-01-03.bilivideo.com` | L+P | 8/8 | 1/6 | 1.21／1.21 | 123.0 | 0.08× | 逾時 |
| `cn-hk-eq-01-10.bilivideo.com` | L | 8/8 | 1/6 | 1.18／1.18 | 526.0 | 0.12× | 逾時 |
| `cn-jxjj-ct-01-02.bilivideo.com` | L | 7/8 | 6/6 | 1.03／5.52 | 152.5 | 0.24× | HTTP/2 串流錯誤 |
| `upos-sz-estgoss.bilivideo.com` | L | 8/8 | 3/6 | 1.00／2.01 | 1149.0 | 0.08× | 逾時 |
| `upos-sz-mirrorcoso1.bilivideo.com` | L+T+P | 8/8 | 0/6 | — | — | — | 逾時 |
| `cn-hk-eq-01-11.bilivideo.com` | L | 7/8 | 0/6 | — | — | — | 逾時 |
| `upos-sz-mirrorcosb.bilivideo.com` | L+T | 8/8 | 0/6 | — | — | — | 逾時 |
| `cn-hk-eq-01-01.bilivideo.com` | L | 8/8 | 0/6 | — | — | — | 逾時 |

初篩第一次逾時、重試才通過的三個 Host 另做了 64 KiB：`cn-hk-eq-01-09.bilivideo.com` 為 8/8、`cn-sdqd-cu-01-21.bilivideo.com` 為 8/8、`cn-hljheb-ct-01-03.bilivideo.com` 為 5/8（HTTP/2 串流錯誤）。它們沒有兩輪 512 KiB 成績，均列為**未定**，不能因一次 16 KiB 成功而升級。

## 瀏覽器核對與判定

新開的 B 站測試分頁被動觀察到正常播放持續推進，取樣期間 `readyState=4`、未見取樣卡頓；擷取到 `upos-sz-mirroraliov.bilivideo.com` 與原樣 Akamai Native Host 的 `206` 媒體回應。事件緩衝有截斷，因此這只是取樣觀察。**外部候選沒有被切入 Chrome 播放路線**；Node 成功不能證明 Chrome CORS 或實際播放成功。Akamai 只作 B 站當次給出的原樣 Native 對照，未作通用替換 Host。

依本次證據，優先安排 Chrome 播放驗收的是 `cn-gddg-cm-01-18`、`01-03`、`01-05`、`01-04`，以及 `cn-jssz-cm-02-34`、`02-20`、`cn-jxnc-cm-01-09`、`01-04`（完整網域如上表）。它們的多位移與兩輪大區塊測試完整，且本機最低速度相對較好。`mirror08c`、`mirrorhwo1` 也通過，額外第二影片 512 KiB 均為 3/3；但前者成對中位速度低於原生，後者最低速度偏低。香港 `01-03` 與 `mirrorcoso1` 的大區塊逾時明顯；`mirrorawsov` 兩次 DNS 失敗，均不列入後續播放候選。**本次不建議直接更改 Catalog。**

## 完整初篩清單：其餘 492 個非 Catalog Host

以下各組列出**完整名稱**。`L`＝CCB、`T`＝TW/SG、`P`＝先前重點候選；`pass-first` 只代表 16 KiB 初篩第一次通過，其中部分已在上表複測，其餘尚無深入成績。`fail` 是重試後的錯誤類別。排除項沒有發送一般媒體 Host 替換請求。

<details>
<summary>52 個排除項與 208 個外部初篩失敗項</summary>

**排除：bcache｜L（6）**

`cn-hk-eq-bcache-13.bilivideo.com`、`cn-sh-office-bcache-01.bilivideo.com`、`cn-zjhz3-wasu-bcache-05.bilivideo.com`、`cn-zjhz3-wasu-bcache-11.bilivideo.com`、`cn-zjhz3-wasu-bcache-15.bilivideo.com`、`cn-zjhz3-wasu-bcache-20.bilivideo.com`

**排除：bcache｜L+T（1）**

`cn-jxnc-cmcc-bcache-06.bilivideo.com`

**排除：bcache｜T（1）**

`cn-hk-eq-bcache-01.bilivideo.com`

**排除：gotcha｜L（41）**

`c0--cn-gotcha01.bilivideo.com`、`c1--cn-gotcha09.bilivideo.com`、`c1--cn-gotcha208.bilivideo.com`、`d0--cn-gotcha01.bilivideo.com`、`d0--cn-gotcha09.bilivideo.com`、`d0--cn-gotcha208-01.bilivideo.com`、`d1--cn-gotcha04.bilivideo.com`、`d1--cn-gotcha04b.bilivideo.com`、`d1--cn-gotcha07.bilivideo.com`、`d1--cn-gotcha07b.bilivideo.com`、`d1--cn-gotcha09.bilivideo.com`、`d1--cn-gotcha101.bilivideo.com`、`d1--cn-gotcha102.bilivideo.com`、`d1--cn-gotcha204-1.bilivideo.com`、`d1--cn-gotcha204-2.bilivideo.com`、`d1--cn-gotcha204-3.bilivideo.com`、`d1--cn-gotcha204-4.bilivideo.com`、`d1--cn-gotcha204.bilivideo.com`、`d1--cn-gotcha207.bilivideo.com`、`d1--cn-gotcha208.bilivideo.com`、`d1--cn-gotcha208b.bilivideo.com`、`d1--cn-gotcha209.bilivideo.com`、`d1--cn-gotcha209b.bilivideo.com`、`d1--cn-gotcha211.bilivideo.com`、`d1--cn-gotcha308.bilivideo.com`、`d1--ov-gotcha01.bilivideo.com`、`d1--ov-gotcha03.bilivideo.com`、`d1--ov-gotcha05.bilivideo.com`、`d1--ov-gotcha07.bilivideo.com`、`d1--ov-gotcha207.bilivideo.com`、`d1--ov-gotcha207b.bilivideo.com`、`d1--ov-gotcha208.bilivideo.com`、`d1--ov-gotcha209.bilivideo.com`、`d1--ov-gotcha210.bilivideo.com`、`d1--p1--cn-gotcha04.bilivideo.com`、`d1--p2--cn-gotcha04.bilivideo.com`、`d1--tf-gotcha01-loc.bilivideo.com`、`d1--tf-gotcha01.bilivideo.com`、`d1--tf-gotcha04.bilivideo.com`、`d1--tf-gotcha08.bilivideo.com`、`d1-cn-gotcha210.bilivideo.com`

**排除：僅保留為原樣 Native｜L+T（1）**

`upos-hz-mirrorakam.akamaized.net`

**排除：PCDN｜L（2）**

`upos-sz-302kodo.bilivideo.com`、`upos-sz-302ppio.bilivideo.com`

**失敗：ECONNRESET｜L（1）**

`cn-jssz-cm-02-40.bilivideo.com`

**失敗：ENOENT｜L（1）**

`upos-sz-mirrorctos.bilivideo.com`

**失敗：ENOTFOUND｜L（59）**

`cn-gdgz-cm-01-02.bilivideo.com`、`cn-gdgz-cm-01-10.bilivideo.com`、`cn-gdgz-fx-01-09.bilivideo.com`、`cn-gdgz-fx-01-10.bilivideo.com`、`cn-gdst-cm-01-01.bilivideo.com`、`cn-gdst-cm-01-02.bilivideo.com`、`cn-gdst-cm-01-03.bilivideo.com`、`cn-gdst-cm-01-04.bilivideo.com`、`cn-gdst-cm-01-05.bilivideo.com`、`cn-gdst-cm-01-06.bilivideo.com`、`cn-gdst-cm-01-07.bilivideo.com`、`cn-gdst-cm-01-10.bilivideo.com`、`cn-gdst-cm-01-12.bilivideo.com`、`cn-gdst-cm-01-15.bilivideo.com`、`cn-gdst-cm-01-17.bilivideo.com`、`cn-hbyc-ct-02-02.bilivideo.com`、`cn-hbyc-ct-02-04.bilivideo.com`、`cn-hbyc-ct-02-06.bilivideo.com`、`cn-hbyc-ct-02-10.bilivideo.com`、`cn-hbyc-ct-02-11.bilivideo.com`、`cn-hbyc-ct-02-12.bilivideo.com`、`cn-hbyc-ct-02-19.bilivideo.com`、`cn-hbyc-ct-02-23.bilivideo.com`、`cn-hk-eq-01-07.bilivideo.com`、`cn-hljheb-cm-01-01.bilivideo.com`、`cn-hljheb-cm-01-03.bilivideo.com`、`cn-lnsy-cm-01-05.bilivideo.com`、`cn-lnsy-cm-01-07.bilivideo.com`、`cn-lnsy-cm-01-08.bilivideo.com`、`cn-nmghhht-cm-01-11.bilivideo.com`、`cn-sccd-cu-01-01.bilivideo.com`、`cn-sccd-cu-01-02.bilivideo.com`、`cn-sccd-cu-01-03.bilivideo.com`、`cn-sccd-cu-01-04.bilivideo.com`、`cn-sccd-cu-01-05.bilivideo.com`、`cn-sccd-cu-01-06.bilivideo.com`、`cn-sccd-cu-01-07.bilivideo.com`、`cn-sccd-cu-01-08.bilivideo.com`、`cn-sccd-cu-01-09.bilivideo.com`、`cn-scdy-ct-01-05.bilivideo.com`、`cn-sh-ct-01-01.bilivideo.com`、`cn-sh-ct-01-06.bilivideo.com`、`cn-sh-ct-01-13.bilivideo.com`、`cn-sh-ct-01-15.bilivideo.com`、`cn-sh-ct-01-23.bilivideo.com`、`cn-sh-ct-01-24.bilivideo.com`、`cn-sh-ct-01-35.bilivideo.com`、`cn-sh-ct-01-36.bilivideo.com`、`cn-sxty-cm-02-04.bilivideo.com`、`cn-sxty-cm-02-09.bilivideo.com`、`cn-sxty-cm-02-10.bilivideo.com`、`cn-xj-cm-02-01.bilivideo.com`、`cn-xj-cm-02-03.bilivideo.com`、`cn-xj-cm-02-04.bilivideo.com`、`cn-xj-cm-02-06.bilivideo.com`、`cn-xj-ct-02-02.bilivideo.com`、`cn-zjjh-ct-04-16.bilivideo.com`、`upos-sz-dynqn.bilivideo.com`、`upos-sz-mirrorasiaov.bilivideo.com`

**失敗：ENOTFOUND｜L+P（1）**

`upos-sz-mirrorawsov.bilivideo.com`

**失敗：HTTP 403｜L（49）**

`cn-hbwh-cm-01-08.bilivideo.com`、`cn-hncs-cm-03-09.bilivideo.com`、`cn-hnzz-cm-01-01.bilivideo.com`、`cn-hnzz-cm-01-02.bilivideo.com`、`cn-hnzz-cm-01-03.bilivideo.com`、`cn-hnzz-cm-01-04.bilivideo.com`、`cn-hnzz-cm-01-05.bilivideo.com`、`cn-hnzz-cm-01-06.bilivideo.com`、`cn-hnzz-cm-01-09.bilivideo.com`、`cn-hnzz-cm-01-10.bilivideo.com`、`cn-hnzz-cm-01-11.bilivideo.com`、`cn-hnzz-cm-01-13.bilivideo.com`、`cn-hnzz-cm-01-14.bilivideo.com`、`cn-hnzz-cm-01-15.bilivideo.com`、`cn-hnzz-cm-01-16.bilivideo.com`、`cn-jxjj-ct-01-01.bilivideo.com`、`cn-sdqd-cu-01-01.bilivideo.com`、`cn-sxxa-ct-03-01.bilivideo.com`、`cn-sxxa-ct-03-02.bilivideo.com`、`cn-sxxa-ct-03-03.bilivideo.com`、`cn-sxxa-ct-03-04.bilivideo.com`、`cn-tj-cm-02-01.bilivideo.com`、`cn-tj-cm-02-02.bilivideo.com`、`cn-tj-cm-02-03.bilivideo.com`、`cn-tj-cm-02-04.bilivideo.com`、`cn-tj-cm-02-05.bilivideo.com`、`cn-tj-cm-02-06.bilivideo.com`、`cn-xj-ct-01-01.bilivideo.com`、`cn-xj-ct-01-02.bilivideo.com`、`cn-xj-ct-01-03.bilivideo.com`、`cn-xj-ct-01-04.bilivideo.com`、`cn-xj-ct-01-05.bilivideo.com`、`cn-zjhz-cm-01-01.bilivideo.com`、`cn-zjhz-cm-01-07.bilivideo.com`、`cn-zjhz-cm-01-08.bilivideo.com`、`cn-zjhz-cm-01-11.bilivideo.com`、`cn-zjhz-cm-01-12.bilivideo.com`、`cn-zjhz-cm-01-16.bilivideo.com`、`cn-zjhz-cm-01-17.bilivideo.com`、`cn-zjhz-cm-01-19.bilivideo.com`、`cn-zjhz-cm-01-28.bilivideo.com`、`cn-zjhz-cu-01-01.bilivideo.com`、`cn-zjhz-cu-01-02.bilivideo.com`、`cn-zjhz-cu-01-04.bilivideo.com`、`cn-zjhz-cu-01-05.bilivideo.com`、`cn-zjhz-cu-v-02.bilivideo.com`、`upos-sz-static.bilivideo.com`、`upos-sz-staticcos-cmask.bilivideo.com`、`upos-sz-staticcos.bilivideo.com`

**失敗：HTTP 404｜L（2）**

`upos-sz-mirroralibstar1.bilivideo.com`、`upos-sz-mirrorcosbstar.bilivideo.com`

**失敗：HTTP 570｜L（1）**

`upos-sz-mirrorcf1ov.bilivideo.com`

**失敗：逾時｜L（93）**

`cn-bj-cc-03-14.bilivideo.com`、`cn-bj-cc-03-17.bilivideo.com`、`cn-cq-ct-01-05.bilivideo.com`、`cn-cq-ct-01-16.bilivideo.com`、`cn-cq-ct-01-20.bilivideo.com`、`cn-cq-ct-01-24.bilivideo.com`、`cn-fjqz-cm-01-05.bilivideo.com`、`cn-gddg-ccc-01-01.bilivideo.com`、`cn-gddg-cm-01-13.bilivideo.com`、`cn-gddg-ct-01-17.bilivideo.com`、`cn-gdfs-cc-02-02.bilivideo.com`、`cn-gdfs-cc-02-06.bilivideo.com`、`cn-gdfs-cc-02-07.bilivideo.com`、`cn-gdfs-cc-02-18.bilivideo.com`、`cn-gdfs-ct-01-01.bilivideo.com`、`cn-gdfs-ct-01-04.bilivideo.com`、`cn-gdfs-ct-01-05.bilivideo.com`、`cn-gdfs-ct-01-06.bilivideo.com`、`cn-gdfs-ct-01-07.bilivideo.com`、`cn-gdfs-ct-01-08.bilivideo.com`、`cn-gdfs-ct-01-09.bilivideo.com`、`cn-gdfs-ct-01-10.bilivideo.com`、`cn-gdfs-ct-01-12.bilivideo.com`、`cn-gdfs-ct-01-13.bilivideo.com`、`cn-gdfs-ct-01-14.bilivideo.com`、`cn-gdfs-ct-01-16.bilivideo.com`、`cn-gdfs-ct-01-17.bilivideo.com`、`cn-gdfs-ct-01-18.bilivideo.com`、`cn-gdfs-ct-01-19.bilivideo.com`、`cn-gdfs-ct-01-21.bilivideo.com`、`cn-gdfs-ct-01-22.bilivideo.com`、`cn-gdgz-fx-01-01.bilivideo.com`、`cn-gdgz-fx-01-02.bilivideo.com`、`cn-gdgz-fx-01-03.bilivideo.com`、`cn-gdgz-fx-01-04.bilivideo.com`、`cn-gdgz-fx-01-05.bilivideo.com`、`cn-gdgz-fx-01-06.bilivideo.com`、`cn-gdgz-fx-01-07.bilivideo.com`、`cn-gdgz-fx-01-08.bilivideo.com`、`cn-gdjm-cm-01-02.bilivideo.com`、`cn-hblf-ct-01-06.bilivideo.com`、`cn-hblf-ct-01-19.bilivideo.com`、`cn-hbsjz-cm-02-04.bilivideo.com`、`cn-hbwh-cm-01-15.bilivideo.com`、`cn-hncs-cm-03-01.bilivideo.com`、`cn-hncs-cm-03-04.bilivideo.com`、`cn-hncs-cu-01-01.bilivideo.com`、`cn-hncs-cu-01-02.bilivideo.com`、`cn-hncs-cu-01-03.bilivideo.com`、`cn-hncs-cu-01-04.bilivideo.com`、`cn-hncs-cu-01-05.bilivideo.com`、`cn-hncs-cu-01-06.bilivideo.com`、`cn-hncs-cu-01-07.bilivideo.com`、`cn-hncs-cu-01-09.bilivideo.com`、`cn-hncs-cu-01-10.bilivideo.com`、`cn-hncs-cu-v-01.bilivideo.com`、`cn-hncs-cu-v-03.bilivideo.com`、`cn-lnsy-cm-01-01.bilivideo.com`、`cn-lnsy-cm-01-02.bilivideo.com`、`cn-lnsy-cm-01-03.bilivideo.com`、`cn-lnsy-cm-01-04.bilivideo.com`、`cn-lnsy-cm-01-06.bilivideo.com`、`cn-lnsy-cm-01-09.bilivideo.com`、`cn-lnsy-cu-01-07.bilivideo.com`、`cn-sccd-ct-01-02.bilivideo.com`、`cn-sccd-ct-01-08.bilivideo.com`、`cn-sccd-ct-01-10.bilivideo.com`、`cn-sccd-ct-01-17.bilivideo.com`、`cn-sccd-ct-01-18.bilivideo.com`、`cn-sccd-ct-01-19.bilivideo.com`、`cn-sccd-ct-01-20.bilivideo.com`、`cn-sccd-ct-01-21.bilivideo.com`、`cn-sccd-ct-01-22.bilivideo.com`、`cn-sccd-ct-01-23.bilivideo.com`、`cn-sccd-ct-01-24.bilivideo.com`、`cn-sccd-ct-01-25.bilivideo.com`、`cn-sccd-ct-01-26.bilivideo.com`、`cn-sccd-ct-01-27.bilivideo.com`、`cn-sccd-ct-01-29.bilivideo.com`、`cn-sdjn-cm-02-12.bilivideo.com`、`cn-sdqd-cu-01-09.bilivideo.com`、`cn-sdqd-cu-01-16.bilivideo.com`、`cn-sdqd-cu-01-17.bilivideo.com`、`cn-sdqd-cu-01-22.bilivideo.com`、`cn-sxxa-cm-01-04.bilivideo.com`、`cn-sxxa-cu-02-01.bilivideo.com`、`cn-sxxa-cu-02-02.bilivideo.com`、`cn-tj-cm-02-07.bilivideo.com`、`cn-tj-fx-01-01.bilivideo.com`、`cn-tj-fx-01-05.bilivideo.com`、`cn-zjhz-cm-01-04.bilivideo.com`、`cn-zjhz-cu-01-06.bilivideo.com`、`cn-zjjh-ct-04-15.bilivideo.com`

**失敗：逾時｜T（1）**

`upos-sz-mirroralio1.bilivideo.com`

</details>

<details>
<summary>229 個外部首次初篩通過項、3 個重試通過項</summary>

**首次通過｜L（220）**

`cn-bj-fx-01-04.bilivideo.com`、`cn-bj-fx-01-05.bilivideo.com`、`cn-bj-se-01-03.bilivideo.com`、`cn-bj-se-01-04.bilivideo.com`、`cn-bj-se-01-05.bilivideo.com`、`cn-bj-se-01-06.bilivideo.com`、`cn-cq-cm-01-01.bilivideo.com`、`cn-cq-cm-01-02.bilivideo.com`、`cn-cq-cm-01-04.bilivideo.com`、`cn-fjfz-fx-01-01.bilivideo.com`、`cn-fjfz-fx-01-02.bilivideo.com`、`cn-fjfz-fx-01-03.bilivideo.com`、`cn-fjfz-fx-01-04.bilivideo.com`、`cn-fjfz-fx-01-05.bilivideo.com`、`cn-fjfz-fx-01-06.bilivideo.com`、`cn-fjqz-cm-01-01.bilivideo.com`、`cn-fjqz-cm-01-02.bilivideo.com`、`cn-fjqz-cm-01-03.bilivideo.com`、`cn-fjqz-cm-01-04.bilivideo.com`、`cn-fjqz-cm-01-06.bilivideo.com`、`cn-fjqz-cm-01-07.bilivideo.com`、`cn-fjqz-cm-01-08.bilivideo.com`、`cn-fjqz-cm-01-09.bilivideo.com`、`cn-gddg-cm-01-02.bilivideo.com`、`cn-gddg-cm-01-03.bilivideo.com`、`cn-gddg-cm-01-04.bilivideo.com`、`cn-gddg-cm-01-05.bilivideo.com`、`cn-gddg-cm-01-06.bilivideo.com`、`cn-gddg-cm-01-14.bilivideo.com`、`cn-gddg-cm-01-18.bilivideo.com`、`cn-gddg-ct-01-10.bilivideo.com`、`cn-gddg-ct-01-11.bilivideo.com`、`cn-gddg-ct-01-12.bilivideo.com`、`cn-gddg-ct-01-13.bilivideo.com`、`cn-gddg-ct-01-15.bilivideo.com`、`cn-gddg-ct-01-18.bilivideo.com`、`cn-gddg-ct-01-21.bilivideo.com`、`cn-gddg-ct-01-24.bilivideo.com`、`cn-gddg-cu-01-04.bilivideo.com`、`cn-gddg-cu-01-06.bilivideo.com`、`cn-gddg-cu-01-07.bilivideo.com`、`cn-gdgz-gd-01-01.bilivideo.com`、`cn-gdjm-cm-01-01.bilivideo.com`、`cn-gdjm-cm-01-03.bilivideo.com`、`cn-gdjm-cm-01-04.bilivideo.com`、`cn-gdjm-cm-01-05.bilivideo.com`、`cn-gdjm-cm-01-06.bilivideo.com`、`cn-gdjm-cm-01-07.bilivideo.com`、`cn-gdjm-cm-01-08.bilivideo.com`、`cn-hbsjz-cm-02-01.bilivideo.com`、`cn-hbsjz-cm-02-02.bilivideo.com`、`cn-hbsjz-cm-02-03.bilivideo.com`、`cn-hbsjz-cm-02-05.bilivideo.com`、`cn-hbsjz-cm-02-07.bilivideo.com`、`cn-hbsjz-cm-02-08.bilivideo.com`、`cn-hbsjz-cm-02-09.bilivideo.com`、`cn-hbsjz-cm-02-10.bilivideo.com`、`cn-hbsjz-cm-02-11.bilivideo.com`、`cn-hbsjz-cm-02-12.bilivideo.com`、`cn-hbsjz-cm-02-13.bilivideo.com`、`cn-hbsjz-cm-02-14.bilivideo.com`、`cn-hbwh-cm-01-01.bilivideo.com`、`cn-hbwh-cm-01-02.bilivideo.com`、`cn-hbwh-cm-01-03.bilivideo.com`、`cn-hbwh-cm-01-04.bilivideo.com`、`cn-hbwh-cm-01-05.bilivideo.com`、`cn-hbwh-cm-01-06.bilivideo.com`、`cn-hbwh-cm-01-07.bilivideo.com`、`cn-hbwh-cm-01-09.bilivideo.com`、`cn-hbwh-cm-01-10.bilivideo.com`、`cn-hbwh-cm-01-11.bilivideo.com`、`cn-hbwh-cm-01-12.bilivideo.com`、`cn-hbwh-cm-01-13.bilivideo.com`、`cn-hbwh-cm-01-14.bilivideo.com`、`cn-hbwh-cm-01-16.bilivideo.com`、`cn-hbwh-cm-01-17.bilivideo.com`、`cn-hbwh-cm-01-18.bilivideo.com`、`cn-hbwh-cm-01-19.bilivideo.com`、`cn-hbwh-cm-01-20.bilivideo.com`、`cn-hbwh-fx-01-01.bilivideo.com`、`cn-hbwh-fx-01-02.bilivideo.com`、`cn-hbwh-fx-01-12.bilivideo.com`、`cn-hbwh-fx-01-13.bilivideo.com`、`cn-hbyc-ct-01-13.bilivideo.com`、`cn-hk-eq-01-01.bilivideo.com`、`cn-hk-eq-01-06.bilivideo.com`、`cn-hk-eq-01-08.bilivideo.com`、`cn-hk-eq-01-10.bilivideo.com`、`cn-hk-eq-01-11.bilivideo.com`、`cn-hk-eq-01-12.bilivideo.com`、`cn-hk-eq-01-13.bilivideo.com`、`cn-hk-eq-01-14.bilivideo.com`、`cn-hljheb-ct-01-02.bilivideo.com`、`cn-hljheb-ct-01-04.bilivideo.com`、`cn-hljheb-ct-01-07.bilivideo.com`、`cn-hncs-cm-03-05.bilivideo.com`、`cn-hncs-cm-03-08.bilivideo.com`、`cn-hncs-cm-03-11.bilivideo.com`、`cn-hncs-cm-03-12.bilivideo.com`、`cn-hncs-fx-01-01.bilivideo.com`、`cn-hnzz-fx-01-01.bilivideo.com`、`cn-hnzz-fx-01-08.bilivideo.com`、`cn-jsnj-fx-02-05.bilivideo.com`、`cn-jsnj-fx-02-07.bilivideo.com`、`cn-jsnj-fx-02-10.bilivideo.com`、`cn-jsnj-gd-01-02.bilivideo.com`、`cn-jssz-cm-02-07.bilivideo.com`、`cn-jssz-cm-02-08.bilivideo.com`、`cn-jssz-cm-02-18.bilivideo.com`、`cn-jssz-cm-02-20.bilivideo.com`、`cn-jssz-cm-02-25.bilivideo.com`、`cn-jssz-cm-02-31.bilivideo.com`、`cn-jssz-cm-02-34.bilivideo.com`、`cn-jssz-cm-02-35.bilivideo.com`、`cn-jssz-cm-02-42.bilivideo.com`、`cn-jxjj-ct-01-02.bilivideo.com`、`cn-jxjj-ct-01-05.bilivideo.com`、`cn-jxjj-ct-01-14.bilivideo.com`、`cn-jxnc-cm-01-04.bilivideo.com`、`cn-jxnc-cm-01-09.bilivideo.com`、`cn-jxnc-cm-01-12.bilivideo.com`、`cn-jxnc-cm-01-19.bilivideo.com`、`cn-jxnc-cm-01-42.bilivideo.com`、`cn-lndl-ct-01-01.bilivideo.com`、`cn-lndl-ct-01-04.bilivideo.com`、`cn-lnsy-cu-01-01.bilivideo.com`、`cn-lnsy-cu-01-03.bilivideo.com`、`cn-lnsy-cu-01-04.bilivideo.com`、`cn-lnsy-cu-01-06.bilivideo.com`、`cn-nmghhht-cu-01-01.bilivideo.com`、`cn-nmghhht-cu-01-07.bilivideo.com`、`cn-nmghhht-cu-01-08.bilivideo.com`、`cn-nmghhht-cu-01-09.bilivideo.com`、`cn-nmghhht-cu-01-10.bilivideo.com`、`cn-nmghhht-cu-01-12.bilivideo.com`、`cn-nmghhht-cu-01-13.bilivideo.com`、`cn-nmghhht-cu-01-14.bilivideo.com`、`cn-nmghhht-cu-01-15.bilivideo.com`、`cn-sccd-cm-03-01.bilivideo.com`、`cn-sccd-cm-03-02.bilivideo.com`、`cn-sccd-cm-03-05.bilivideo.com`、`cn-sccd-cm-03-07.bilivideo.com`、`cn-sccd-fx-01-01.bilivideo.com`、`cn-sccd-fx-01-06.bilivideo.com`、`cn-sdjn-cm-02-01.bilivideo.com`、`cn-sdjn-cm-02-02.bilivideo.com`、`cn-sdjn-cm-02-03.bilivideo.com`、`cn-sdjn-cm-02-04.bilivideo.com`、`cn-sdjn-cm-02-05.bilivideo.com`、`cn-sdjn-cm-02-06.bilivideo.com`、`cn-sdjn-cm-02-07.bilivideo.com`、`cn-sdjn-cm-02-08.bilivideo.com`、`cn-sdjn-cm-02-09.bilivideo.com`、`cn-sdjn-cm-02-10.bilivideo.com`、`cn-sdjn-cm-02-11.bilivideo.com`、`cn-sdjn-cm-02-13.bilivideo.com`、`cn-sdjn-fx-01-01.bilivideo.com`、`cn-sdjn-fx-01-02.bilivideo.com`、`cn-sdqd-ccc-01-01.bilivideo.com`、`cn-sdqd-cu-01-08.bilivideo.com`、`cn-sdqd-cu-01-11.bilivideo.com`、`cn-sdqd-cu-01-23.bilivideo.com`、`cn-sdqd-cu-01-24.bilivideo.com`、`cn-sdqd-cu-01-25.bilivideo.com`、`cn-sxty-cu-03-01.bilivideo.com`、`cn-sxty-cu-03-02.bilivideo.com`、`cn-sxty-cu-03-03.bilivideo.com`、`cn-sxty-cu-03-04.bilivideo.com`、`cn-sxty-cu-03-05.bilivideo.com`、`cn-sxty-cu-03-06.bilivideo.com`、`cn-sxty-cu-03-07.bilivideo.com`、`cn-sxty-cu-03-08.bilivideo.com`、`cn-sxty-cu-03-09.bilivideo.com`、`cn-sxxa-cm-01-01.bilivideo.com`、`cn-sxxa-cm-01-02.bilivideo.com`、`cn-sxxa-cm-01-03.bilivideo.com`、`cn-sxxa-cm-01-05.bilivideo.com`、`cn-sxxa-cm-01-06.bilivideo.com`、`cn-sxxa-cm-01-08.bilivideo.com`、`cn-sxxa-cm-01-09.bilivideo.com`、`cn-sxxa-cm-01-11.bilivideo.com`、`cn-sxxa-cm-01-12.bilivideo.com`、`cn-tj-cu-01-01.bilivideo.com`、`cn-tj-cu-01-02.bilivideo.com`、`cn-tj-cu-01-03.bilivideo.com`、`cn-tj-cu-01-04.bilivideo.com`、`cn-tj-cu-01-05.bilivideo.com`、`cn-tj-cu-01-06.bilivideo.com`、`cn-tj-cu-01-07.bilivideo.com`、`cn-tj-cu-01-08.bilivideo.com`、`cn-tj-cu-01-09.bilivideo.com`、`cn-tj-cu-01-10.bilivideo.com`、`cn-tj-cu-01-11.bilivideo.com`、`cn-tj-cu-01-12.bilivideo.com`、`cn-tj-cu-01-13.bilivideo.com`、`cn-tj-cu-01-16.bilivideo.com`、`cn-tj-cu-01-17.bilivideo.com`、`cn-zjjh-ct-04-03.bilivideo.com`、`cn-zjjh-ct-04-06.bilivideo.com`、`cn-zjjh-ct-04-12.bilivideo.com`、`cn-zjjh-ct-04-13.bilivideo.com`、`cn-zjjh-ct-04-14.bilivideo.com`、`cn-zjjh-ct-04-24.bilivideo.com`、`cn-zjjh-ct-04-26.bilivideo.com`、`cn-zjjh-ct-04-27.bilivideo.com`、`cn-zjjh-ct-04-28.bilivideo.com`、`cn-zjjh-ct-04-29.bilivideo.com`、`cn-zjjh-ct-04-30.bilivideo.com`、`cn-zjjh-ct-04-33.bilivideo.com`、`cn-zjjh-ct-04-34.bilivideo.com`、`ec-jssz-ct-01-02.bilivideo.com`、`upos-sz-estgcos.bilivideo.com`、`upos-sz-estghw.bilivideo.com`、`upos-sz-estgoss.bilivideo.com`、`upos-sz-mirror08disp.bilivideo.com`、`upos-sz-mirrorbd.bilivideo.com`、`upos-sz-mirrorbdb.bilivideo.com`、`upos-sz-mirrorcosdisp.bilivideo.com`、`upos-sz-mirrorhwdisp.bilivideo.com`、`upos-sz-mirrorzos.bilivideo.com`

**首次通過｜L+P（1）**

`cn-hk-eq-01-03.bilivideo.com`

**首次通過｜L+T（4）**

`upos-sz-mirror08ct.bilivideo.com`、`upos-sz-mirror08h.bilivideo.com`、`upos-sz-mirrorcosb.bilivideo.com`、`upos-sz-mirrorhwb.bilivideo.com`

**首次通過｜L+T+P（3）**

`upos-sz-mirror08c.bilivideo.com`、`upos-sz-mirrorcoso1.bilivideo.com`、`upos-sz-mirrorhwo1.bilivideo.com`

**首次通過｜T（1）**

`upos-tf-all-hw.bilivideo.com`

**重試通過｜L（3）**

`cn-hk-eq-01-09.bilivideo.com`、`cn-hljheb-ct-01-03.bilivideo.com`、`cn-sdqd-cu-01-21.bilivideo.com`

</details>
