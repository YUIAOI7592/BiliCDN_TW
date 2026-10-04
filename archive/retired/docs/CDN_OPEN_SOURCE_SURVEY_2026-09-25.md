# B 站 CDN 優化公開專案調查（2026-09-25）

> **後續決定：**新增 CDN 節點的計畫已撤銷；公開來源與候選分析僅作研究紀錄。Node 初篩及內建瀏覽器播放觀察見[測試結果](CDN_TEST_RESULTS_2026-09-25.md)，不代表任何新 Host 獲准加入 Catalog。

> **文件定位：2026-09-25 公開來源研究快照。** 外部專案描述、當時基線與研究建議均保留原貌，未在本次文件整理中重新查證；建議不等於目前待辦。現行版本與文件分類見[文件索引](../../../docs/INDEX.md)。

## 範圍與判讀方式

本次以 `bilibili/B站 + CDN/UPOS/PCDN + 優選/切換/測速/加速` 的中英文組合搜尋 GitHub 與 Greasy Fork，沿專案 README、原始碼頁及其明示的衍生專案追查；納入瀏覽器腳本、擴充套件、DNS/代理及下載工具。下表記錄可核對的一手專案，不聲稱涵蓋網路上每個未被索引、已刪除或私有的實作。來源描述是作者宣稱與設計線索，**不是本機實測或對效能的背書**。本次未安裝第三方腳本，也未以真實影片驗證它們的速度。

「值得學習」指值得設計或測試研究；「可考慮整合」仍需先通過本專案的契約測試、Chrome/Tampermonkey 實測與相應安全驗證。公開可閱讀的程式碼不等於有再利用授權；若日後複製任何實作，須先核對該版本的授權並補 notices。

## 調查當日的 BiliCDN_TW v2 基線

`src-v2/` 已有可信內建 Catalog、當次 epoch 的 exact signed Native URL、限制優先序、video/audio 分離、起播期最多三路／三秒預測試、健康期間順序量測、Host 證據及 circuit、不同 Host 備援，以及只在路線決策／恢復控制器改變播放的架構。`MeasurementController` 現用 256/512 KiB 起播樣本和 384/768 KiB 健康樣本；健康量測需可見、穩定進度 20 秒和 30 秒緩衝。`RouteCoordinator` 已優先保留不同 Host 的備援、按 stream 記錄 Catalog 403 不相容，並防止健康探索直接改線。這些現有能力不應當作新的整合需求。

## 專案索引與判斷

| 專案／一手來源 | 主要做法或可學處 | 對 v2 的判斷 |
| --- | --- | --- |
| [Bili Pilot](https://github.com/siwei-yuan/bili-pilot)／[問題分析](https://github.com/siwei-yuan/bili-pilot/blob/main/docs/PROBLEM_AND_SOLUTION.md) | 只比較當前 track 的 signed URL；對不同位移的真實 DASH Range 作比較，指出小 Range 成功未必代表整段能按時完成；足夠緩衝時才預取完整段。 | **高研究價值**：先借鑑「位移與完整段完成時間」的測試設計。分段快取與合成 206 涉及新的媒體資料面，暫不直接整合。 |
| [SanJerry007/bilibili-cdn-optimizer](https://github.com/SanJerry007/bilibili-cdn-optimizer/blob/main/README.md) | 只用 API 提供的鏡像；緩衝足夠後逐路量持續吞吐，略過初始 warm-up，再用有界時間／流量窗測量；區分測速贏家與目前實際 Host。 | **高研究價值**：評估第二階段持續吞吐樣本與「決策／實際請求」分離顯示；不得照搬較大的預設流量或從提示授權路線。 |
| [stabruriss/bilibili-accelerator](https://github.com/stabruriss/bilibili-accelerator/blob/main/README.en.md) | exact Akamai URL、內建 UPOS 白名單、保留原生備援；按 Host 摘要速度、TTFB、最差完成時間，區分完整測速與輕量再驗證。 | **可考慮整合**：研究樣本尾部延遲與「先輕驗、退化才完整重測」。現有 vault／限制與安全邊界多已涵蓋。 |
| [liiliiliil/bili-cdn-switcher](https://github.com/liiliiliil/bili-cdn-switcher) | 擴充套件限定頁籤的候選與規則、可見且有緩衝才復測；緩衝持續下降時保守地提前嘗試下一候選，並說明已開始的請求無法中途改線。 | **可考慮整合**：被動緩衝趨勢訊號值得測試；若要提早改 affinity，必須由 `RouteCoordinator` 判定為可歸因的退化，且不破壞健康播放不改線。MV3 規則不能直接搬入 userscript。 |
| [realzza/bilibili-accelerator](https://github.com/realzza/bilibili-accelerator) | 依持續吞吐而非應答時間排序，卡頓備援遍歷候選；有跨瀏覽器相容性與其他改寫腳本共存的經驗。 | **學習與相容性參考**：可比對緩衝門檻、復測節流、同時安裝時的 hook 衝突；v2 目標仍是 Chrome＋Tampermonkey。 |
| [Kanda-Akihito-Kun/ccb](https://github.com/Kanda-Akihito-Kun/ccb) | 大型節點／地區清單、手動切換、普通影片／番劇／直播覆蓋；作者明示強力改寫所有備援可能使影片失敗，並提醒以實際網路請求核對。 | **學習**：頁型及 iframe 驗收案例、不可把所有 backup 指向一個 Host。大量外部節點及遠端清單不納入 v2 的可信 Catalog。 |
| [maxzrb/bilibiliccb](https://github.com/maxzrb/bilibiliccb) | CCB 衍生版，內嵌節點資料、按營運商篩選、測試真實分片可用性、保持備援 Host 多樣性。 | **研究**：分片驗活與備援多樣性有用；現有 v2 已保留不同 Host 備援。502 節點清單、遠端更新與以 `no-cors` 延遲選最快均不宜直接帶入。 |
| [shiinayane/BiliKit-Web](https://github.com/shiinayane/BiliKit-Web) | 與其他功能同時改寫 playurl，明示同類腳本會互搶；限 UPOS 類改寫並重建備援。 | **相容性參考**：補充同時安裝另一個 CDN 改寫器的驗收案例。不要整合免登入、畫質解鎖等無關功能。 |
| [a0972199950/bilibili-cdn-switcher](https://github.com/a0972199950/bilibili-cdn-switcher) | 面向台灣／新加坡的擴充套件，提供地區預設線、原始模式、原生備援與逐節點測速。 | **地區案例**：TW/SG 測試情境可借鑑，固定「最快」節點不應普遍化；倉庫頁面未顯示授權檔，勿複製程式碼。 |
| [tunecc/VidBoost](https://github.com/tunecc/VidBoost) | 綜合影片增強工具內提供 CDN 手動切換、節點測速與番劇模式。 | **低優先**：功能與現有路線控制重疊；可作番劇交互及腳本共存對照。 |
| [Bilibili Video CDN Switcher](https://greasyfork.org/en/scripts/500213-bilibili-video-cdn-switcher/code)／[腳本頁](https://greasyfork.org/en/scripts/500213-bilibili-video-cdn-switcher) | 早期 playurl 回應改寫與手動指定 CDN，亦處理 Fetch/XHR。 | **歷史與相容性參考**：腳本頁標示 `No License`，可觀察行為，不複製實作。任意使用者 Host 不符 v2 Catalog 邊界。 |
| [BiliUniverse/Redirect](https://github.com/BiliUniverse/Redirect/releases) | 面向代理工具的 PCDN/MCDN/海外 CDN 重定向；版本紀錄列出新 Host 家族、資源請求排除與 IPv6 修正。 | **分類參考**：定期核對 URL 類型與負例測試；代理 MITM／遠端模組不屬於本 userscript。 |
| [bili-cdn-dns-pin](https://github.com/zizhenliu0427/bili-cdn-dns-pin)／[miyouzi/akamTester](https://github.com/miyouzi/akamTester) | 以 TCP/TLS 延遲挑同一 CDN 名下的 edge IP，再透過 hosts／DNS 釘選。 | **診斷參考**：提醒「選錯 Host」與「同 Host 的 DNS edge 不佳」是兩個問題。Tampermonkey 無權控制系統 DNS，不整合釘 IP。 |
| [MrTangLuyao/Bilibili-thread-ripper](https://github.com/MrTangLuyao/Bilibili-thread-ripper) | 為冷門影片與單連線瓶頸拆分 Range 並行下載、重組給播放器。 | **另類架構參考**：可作瓶頸辨識與對照組；會接管媒體下載及緩衝，超出 v2 路線選擇範圍，亦增加連線與流量。 |
| [ClownpieceStripedAbyss/bilibili-cdn-switcher](https://github.com/ClownpieceStripedAbyss/bilibili-cdn-switcher) | 本機 nginx/Rust 代理限定 playurl 路徑，避免遞迴替換回應中的所有 URL。 | **解析邊界參考**：驗證只改明確媒體欄位的測試；自簽 TLS／代理不整合。 |
| [chrisliu298/bilibili-cdn-fix](https://github.com/chrisliu298/bilibili-cdn-fix) | 公開跨日期、跨 Host 的測速筆記與瀏覽器 probe，顯示節點表現可能迅速反轉，並區分單連線與多連線瓶頸。 | **測試方法參考**：固定影片、清晰度、網路、時間與冷／暖快取；此庫自述沒有授權，勿複製 `probe.js`。 |

## 當時提出的研究方向（非目前待辦）

1. **P1：測速可信度實驗。** 用目前 `MeasurementController` 的短樣本作基線，在安全緩衝且未停用時，對同一合法 route 增加有上限的第二階段持續吞吐樣本；比較兩階段的排名一致性、流量、TTFB、最差完成時間及真實播放卡頓。參考 Bili Pilot、SanJerry007 與 stabruriss。先做純函式／控制器契約測試，再做 Chrome Network A/B；任何結果都不得存 signed URL 或在健康播放中直接切 Host。
2. **P1：退化訊號實驗。** 研究可觀察的緩衝下降斜率與實際傳輸失敗是否能比現有 no-progress/watchdog 更早、且低誤判地預測卡頓。先只記錄有界診斷；若要觸發路線變更，須沿 `RouteCoordinator` 的合法備援流程，保持音視分離、generation 驗證及不取消已送出的網站請求。參考 liiliiliil 與 realzza。
3. **P2：跨位置 Range 驗證。** 在不預取播放器媒體、不合成回應的前提下，設計受當次 exact URL、representation、流量和緩衝限制的實驗，檢查「開頭 64 KiB 可讀但後續段逾時／無內容」的頻率。只有證據支持時才考慮產品化。參考 Bili Pilot、CCB 衍生版。新增主動網路行為前須做安全差異掃描。
4. **P2：相容性與診斷。** 增加同時安裝另一 CDN 改寫腳本、番劇 iframe、冷門影片與台灣／新加坡網路的驗收矩陣；把「路線決策 Host」和 Chrome Network「實際 Host」分別記錄。針對同 Host 但不同 DNS edge 的問題提供排查文字，不宣稱 userscript 可改系統 DNS。

## 不建議直接整合的做法

- 下載或執行遠端節點表、任意使用者輸入 Host、地區固定最快 Host、把 signed path/query 寫入本機紀錄。
- 系統 hosts／DNS 釘 IP、全站 HTTPS MITM、擴充套件 DNR 規則：平台權限與本專案交付型態不同。
- 為了加速而接管播放器請求、並行拆段、預取快取或合成 206：需要獨立架構與完整資料面驗證；不作 v2.1.4 的順手改動。
- 依 `no-cors` 可連通或一次峰值 Mbps 推定該 Host 對當前影片、當前位移可用；測速與實際播放須各自驗證。

## CDN Host 清單追查（2026-09-25 補充）

這一節只比對**主機名事實與候選資格**，沒有對 B 站媒體 URL 發送請求。Host 出現在清單中，不能證明它接受目前影片的簽名、回傳直接 206、在台灣夠快，或適合進入可信 Catalog。

| 清單來源 | 核對結果 | 對可信度的意義 |
| --- | --- | --- |
| [CCB 的 `data/cdn.json`](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/cdn.json)、[`update.go`](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/update.go)、[`info.json`](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/info.json) | 數百個地區節點，含「海外」與「香港」；更新器從第三方子域資料來源收集並匹配地區，另加部分內建節點；檔內記錄最近成功更新為 2026-09-05。 | 適合發現主機名；子域被收錄不是媒體 Range 可用性驗證，也不可在執行時抓取成為候選。 |
| [TW/SG 擴充套件 `cdn-list.json`](https://github.com/a0972199950/bilibili-cdn-switcher/blob/master/src/cdn-list.json) | 20 個實際 Host 選項；與本專案 11 個 Catalog Host 有 8 個重疊，另有 12 個未列入。註解說清單源自 PiliNaraRogerMod／BiliRoaming，故不把此衍生關係視為獨立測速證據。 | 有地區使用案例，但預設「TW/SG 最快」是作者的環境判斷，不能作本專案的全域預設。 |
| [stabruriss 的內建允許清單](https://github.com/stabruriss/bilibili-accelerator/blob/main/bilibili-accelerator.user.js) | 只有 `cosov`、`aliov`、`cn-hk-eq-01-03` 三個可生成 Host；前兩個已在本專案 Catalog。原始碼註解稱三者已驗證可接一般 bilivideo signed URL；Akamai 必須使用 API 原樣給的 URL。 | 對 `cn-hk-eq-01-03` 是較強的設計佐證，但仍需在我們的 Chrome/Tampermonkey 環境重驗。 |
| [BiliUniverse Redirect 發布紀錄](https://github.com/BiliUniverse/Redirect/releases) | 記錄香港 `cn-hk-eq-01-03` 等 Equinix Host，另記錄 `upos-sz-mirrorawsov` 海外 Host。 | 交叉確認 Host 名稱與分類；代理的「可重定向來源」並不等於可生成的播放目標。 |

### 可研究的新增 Host（都尚未加入 `TRUSTED_CATALOG`）

| 優先 | Host | 現有佐證與判斷 |
| --- | --- | --- |
| 1 | `cn-hk-eq-01-03.bilivideo.com` | [stabruriss 內建可生成清單](https://github.com/stabruriss/bilibili-accelerator/blob/main/bilibili-accelerator.user.js)、[CCB 香港清單](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/cdn.json)、[BiliUniverse 發布紀錄](https://github.com/BiliUniverse/Redirect/releases)皆有。**首選驗證候選**，尚非已證實適合本專案。 |
| 2 | `upos-sz-mirror08c.bilivideo.com` | [TW/SG 清單](https://github.com/a0972199950/bilibili-cdn-switcher/blob/master/src/cdn-list.json)與 [CCB](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/cdn.json)皆有；[個人跨日期測速紀錄](https://github.com/chrisliu298/bilibili-cdn-fix)曾報告美國網路表現，但地區與時間不同。可列第二輪驗證。 |
| 3 | `upos-sz-mirrorhwo1.bilivideo.com` | 同時在 [TW/SG 清單](https://github.com/a0972199950/bilibili-cdn-switcher/blob/master/src/cdn-list.json)和 [CCB](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/cdn.json)，亦見上述[美國測速紀錄](https://github.com/chrisliu298/bilibili-cdn-fix)。與目前預設不可用的 `mirrorhw`／`mirrorhwov` 是不同 Host，不能沿用或否定其狀態；可列第二輪驗證。 |
| 後續 | `upos-sz-mirrorawsov.bilivideo.com`、`upos-sz-mirrorcoso1.bilivideo.com` | `awsov` 見 [CCB](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/cdn.json)與 [BiliUniverse](https://github.com/BiliUniverse/Redirect/releases)；`coso1` 見 [CCB](https://github.com/Kanda-Akihito-Kun/ccb/blob/main/data/cdn.json)與 [TW/SG 清單](https://github.com/a0972199950/bilibili-cdn-switcher/blob/master/src/cdn-list.json)。目前只有收錄／分類佐證，缺少足夠的 signed Range 與台灣播放證據。 |

**不作 Catalog 候選：** `upos-hz-mirrorakam.akamaized.net` 需 API 當次簽發的 exact URL，應維持 Native 路線；`cn-jxnc-cmcc-bcache-06.bilivideo.com` 雖被 TW/SG 擴充套件列為預設，但屬地區／BCache 節點，缺乏足以授予全域改寫的證據。大量 `cn-*`、`static`、`estg`、`302` 主機亦不因列名便自動信任。現有 Catalog 已有 8 個與 TW/SG 清單重疊，無需重複新增。

**若決定納入：** 先以測試中的合法 signed URL，在台灣 Chrome Network 核對 video 與 audio、熱門與冷門片、不同清晰度、跨頁切換下的實際 Host、直接 206、轉址、403、超時與流量；測試只接受當次 epoch、同 representation 的 URL。建立域／控制器契約測試後，才把通過的個別 Host 寫進內建 Catalog，保留黑／死／停用／預設不可用限制與有界測速。Catalog 擴張會授予新的主動網路目的地，屬安全敏感變更，實作時須做安全差異掃描。

原先的[新增 CDN 節點驗證方案](CDN_CANDIDATE_TEST_PLAN_2026-09-25.md)已撤銷，僅作歷史測試設計；已完成的觀察以[測試結果](CDN_TEST_RESULTS_2026-09-25.md)為準。

## 驗證狀態

本文件是網路來源與本機程式碼對照的**研究紀錄**。後續已完成 Node 媒體探測與內建瀏覽器播放，詳見[測試結果](CDN_TEST_RESULTS_2026-09-25.md)；它們不構成新增 Host 的授權或 Chrome/Tampermonkey 正式驗收。`src-v2/` 未因本調查修改；調查當時，v2.1.4 的安全修復、差異掃描與發布流程另行進行。現行版本狀態見[文件索引](../../../docs/INDEX.md)。
