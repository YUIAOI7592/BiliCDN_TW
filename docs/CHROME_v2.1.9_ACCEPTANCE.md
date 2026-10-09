# v2.1.9 Chrome／Tampermonkey 功能驗收 — 2026-10-09

**狀態：後續已確認 BR-02 XHR 例外處理缺陷，BR-01 播放停滯仍待定位；不宣稱全面驗收通過。** 前一輪的 18 個合成輸入原生 XHR 案例全部通過；續測新增的 failed open 矩陣有六個失敗情境，詳見 [BR-02 詳細報告](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md)。本次使用已安裝的使用者腳本與真實 Chrome，另有 CDN 播放、控制中心與 Web Locks 證據；與 299 個正式 Node 契約案例分開計算。

使用者其後設定「持續測試，直到全部驗收完成或找到問題並撰寫詳細報告」目標。本輪按第二個條件交付 BR-02 報告、Chrome 原始結果及獨立失敗契約；下列先前播放紀錄保留當時快照，剩餘矩陣沒有改標通過。

## 環境與範圍

- 日期與時間使用 Asia/Taipei；指定影片的主要診斷快照為 17:06:24、17:17:31、17:27:39。
- Chrome 154.0.0.0；實際分頁診斷版本 **2.1.9**。使用者截圖顯示 Tampermonkey 5.5.0，並同時啟用 Bilibili Evolved 2.11.4；沒有停用其他擴充套件或腳本作隔離對照。
- 本機提交 `b177f76b824b3ef2027023afd933a252939d1ca5`；已發布 v2.1.9 標籤提交 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7` 不作重新發布。本次未修改執行期來源、正式測試或 Release。
- 使用者最後明確指定 [OLED 展示影片 BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/)。本輪重新續測後的播放對照均使用同一網址，不以其他題材換片。影片標題中的 HDR／240 幀不是實際解碼規格證據。
- 初始設定：啟用、Catalog 自動選路、原生來源關閉、無 Catalog overrides、AV1 偏好、WebRTC／HTTPDNS 阻擋啟用。最終設定完整讀回相同；最終指定影片恢復 4K／2 倍速。

## 實際播放與控制中心

| 情境 | 實測結果與限制 |
| --- | --- |
| 載入新版及攔截 | 診斷確認 2.1.9，Fetch／XHR 均安裝；DASH 21 個影片表示、3 個音訊表示。 |
| 4K 連續播放 | 15.18 秒觀察窗內，時間由 1056.506→1086.874 秒，3840×2160、2 倍速、readyState 4、mediaError null；影格持續增加。捕捉窗無截斷，觀察到 Catalog HTTPS 206、已配對請求無重新導向。 |
| 暫停／恢復 | 暫停約 3.56 秒，位置維持 1115.081 秒、影格不變；播放按鈕恢復後時間繼續增加。 |
| 一般 seek | 由約 1137 秒跳至約 1562 秒；隨後退出 seeking、readyState 回到 4，10 秒觀察窗末端約 1576.710 秒。沒有跳回原位置，2 倍速維持。這不等於 pending reload／play 的競態驗收。 |
| 4K→1080P | 實際寬高變為 1920×1080，時間持續前進；沒有媒體錯誤。 |
| 1080P→8K | 觀察到實際 7680×4320；另有約 20 秒的 8K／2 倍速持續播放樣本。沒有依標題宣稱 HDR 或 240 FPS。 |
| 8K→4K | 第一輪出現下述停滯，不能列整項通過。另一個未執行合成 XHR 測試的新分頁，第二輪成功回到 3840×2160；約 20 秒內由 2097.667→2137.684 秒，緩衝由低點恢復。 |
| 最終狀態 | 17:27:39：2160p／AV1、2 倍速、watchdog healthy、seeking false、readyState 4、reloadCount 0；約 56.68 秒媒體緩衝，相當於 28.34 秒可播放時間。影片與音訊最新回應均 HTTP 206。 |
| R02 設定鎖 | 在真實 `navigator.locks` 持有 `bilicdn.v2.settings` 鎖，經可信 UI 排入兩筆 Catalog 單節點變更；確認 pending 2，釋放後兩筆變更均保留。 |
| R03 過期視圖 | 命令等待同一把鎖時切至設定頁，完成後未蓋掉新頁；另一命令等待時關閉控制中心，完成後未重開。未另宣稱焦點的全部競態分支通過。 |
| 設定清理 | 前段測試以產品「還原預設設定（不清除測速紀錄）」還原已知等於預設的初始設定；後段完整讀回核對一致，沒有清除學習資料。 |

網路視窗內也出現未完整歸因的 DNS 失敗及取消事件，不宣稱整個瀏覽器零網路錯誤。以主機、狀態與播放進度記錄證據，不保存 HAR、簽名 URL、媒體路徑／查詢、Cookie 或播放器物件。部分早期窗口曾截斷，沒有用它們支持「全部請求正常」的結論。

## 原生 XHR：18 個合成輸入案例

案例直接使用安裝版腳本所攔截的 **Chrome 原生 XMLHttpRequest**，沒有以 FakeXhr 取代。正常對照使用本機 Blob；失敗對照使用本地政策拒絕，以及限定測試 URL 的 Chrome DevTools 回應注入。後者是合成回應，不是真實 API／CDN 成功證據。

| 案例群 | 數量 | 結果 |
| --- | ---: | --- |
| HTTPDNS 本地失敗：default／text／json、空回應及非法 getter | 3 | 通過；未發出測試 HTTPDNS 原生請求。 |
| 排隊本地失敗前 abort、重複 abort、非法 send／header | 1 | 通過；一次 readystatechange→abort→loadend，事件內 DONE，結束後 UNSENT。 |
| 排隊失敗前及 readystatechange／error／abort 回呼內 reopen | 4 | 通過；新 Blob 請求正常完成，沒有舊 loadend 污染。 |
| 正常 Blob default／text／json | 3 | 通過；保留正常回應型別與完成事件。 |
| 原生已送出 Blob 的 abort | 1 | 通過；取消通知沒有被攔截器重複發送。 |
| 同步 Blob 與禁止 setter | 1 | 通過；responseType／timeout setter 實際丟出 InvalidAccessError，正常同步 send 成功。 |
| 同步 HTTPDNS 本地拒絕 | 1 | 通過；NetworkError。 |
| 不可接納的 playurl 回應：default／text／json | 3 | 通過；保留 HTTP 422；文字 response 與 responseText 一致，JSON 為物件，JSON responseText 仍丟出 InvalidStateError。 |
| 已送出原生 XHR 的明確 timeout | 1 | 通過；120 ms timeout 只出現一次 readystatechange→timeout→loadend。 |

**覆蓋界線：** 上述本地排隊取消不是 startup gate 取消；同步 Blob 也沒有經過 CDN 改寫後的 reopen。因此不能把 B1–B5 的所有分支都標為瀏覽器通過。Node 正式契約仍保留其獨立證據身分。

## BR-01：切回 4K 後長時間停滯，待定位

**現象已觀察，根因未確認。** 影響是同一影片無法前進；列為優先續查，不新增「已確認程式缺陷」計數。

第一輪在 1080P→8K 播放後切回 4K，畫面停在 **1844.274899 秒**。17:15:06 起的樣本至 17:17:31 診斷快照至少涵蓋約 **2 分 24 秒**：seeking true、readyState 1、緩衝 0、影格 0、mediaError null。播放器監控為 seek-grace，Recovery 顯示 healthy、reloadCount 0；最後影片請求失敗，音訊先前仍有成功 206。

事故分頁重新整理並按播放後仍一度停在續播位置。新的同網址分頁也有續播等待，稍後恢復 1080P；恢復發生在觀察窗之間，不能判定由腳本、網站或外部操作中的哪個機制觸發。該乾淨分頁重做 8K→4K 成功，是一個正常對照，不是穩定重現或根因排除。

靜態對照提供續查方向：

- [PlayerMonitor](../src-v2/application/player-monitor.ts) 第 70、84 行：每次 seeking 都延後 grace，且清除 stallTicks。這能解釋持續 seeking 時 watchdog 不會進入 recovering，不能單獨證明造成最初停滯。
- [RecoveryController](../src-v2/application/recovery-controller.ts) 第 65、70、79 行：seeking 期間不建立恢復動作，已有恢復會被中斷。
- 事故快照為同一網址、generation 1／epoch 1、2160p HEVC；較早及乾淨對照為 epoch 0、AV1。[PlayurlController](../src-v2/application/playurl-controller.ts) 第 78–90 行以來源目錄推導內容變化；需要再確認這次世代內內容週期變動的輸入，不能直接斷定是錯誤 reset。

續查應在同片記錄品質／codec 切換、每次 seek 起訖、表示身分、請求開始／取消／逾時與恢復動作，建立有界且確定性的失敗契約；並區分 CDN 傳輸、網站播放器與 Evolved 共存影響。本次未修改恢復政策或自動套用修復。

## 尚未完成的情境

- 已確認 BR-02 的修復及回歸；來源、精確邊界與正常對照見 [詳細報告](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md)。
- 真正 startup gate 的晚到完成／abort、政策變更後 send、同步改寫 reopen 的選項與 headers／credentials。
- 音訊單獨失敗而影片維持健康時的 R04 隔離，以及影片自身符合條件時的恢復對照。
- pending play／reload 時換片、seek、停用再啟用；SPA 內容切換與世代交錯。
- 跨分頁遠端設定合併、背景切換、固定主機與禁止規則交錯。
- MP4／FLV 的真實播放與授權刷新；此指定樣本為 DASH。

## 本機產物與操作清理

去敏感化資料位於 `.work/chrome-v2.1.9/2026-10-09/`，未作 GitHub Release 附件：

- `evidence.json`：前段控制中心、Web Locks 與播放觀察。
- `real-xhr-contracts.js`／`real-xhr-results.json`：14 案例原始測試與事件序列。
- `real-playurl-types.js`／`real-playurl-types-results.json`：3 種回應型別與 HTTP 狀態。
- `real-xhr-timeout.js`／`real-xhr-timeout-results.json`：原生明確 timeout。
- `specified-video-observations.json`：指定影片 20 組觀察／測試及 3 份診斷快照。
- `specified-video-stall-diagnostics.png`、`final-healthy-control-center.png`：事故與最終狀態截圖。

限定測試 URL 的攔截已清除；本機 Blob 已 revoke，暫時播放器事件觀察器與頁面測試變數已移除。設定完整核對還原；播放過程依產品正常機制產生的學習／故障證據保留，沒有為測試結果清除它們。沒有修改瀏覽器設定、提交、推送或發布。

先前座標誤點推薦內容是代理操作錯誤，不算產品自動切片缺陷。已改為檢查隱藏面板的 pointer-events／實際命中，先點開「更多播放設定」，並核對操作後選取狀態；本輪重新續測後沒有再切換其他影片。
