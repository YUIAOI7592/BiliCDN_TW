# BiliCDN_TW v2.1.40 固定 CDN 備援恢復修復驗證

日期：2026-10-31（Asia/Taipei）。基準 v2.1.39／27941936c79f86f60739f0e71e707ff7c9c35b55。使用者已移除 Bilibili-Evolved，另行批准根因調查、確認缺陷修復及最多兩次各三十分鐘的單分頁定向實測。

## 修復與根因

固定 CDN 是合法候選的選路偏好。舊 recoveryEligible 在選路器已排除失敗固定主機並選出合法備援後，仍要求計畫主機等於原固定偏好，因此阻止恢復。正式紅色契約已重現，修復移除這項重複限制；目前計畫身分、影片種類、generation／epoch、policy／authority revision、Vault 與禁止規則均保留。沒有 API、設定 schema、timeout、探測資格或恢復額度變更。

這能確認腳本的備援恢復缺陷，不能代替香港最初逾時、舊 HK04 網站 emptied／loadstart 或 N05 取消請求的根因證據。

## 自動驗證

新增 12 案契約通過：正常固定／合法備援、black／dead、停用、原線對照、政策／世代／授權更新、無合法候選、音訊隔離，以及真實 Monitor／Runtime／Recovery 閉環的進度取消與一次有界重載。型別與 114 模組架構通過。

完整測試初次只因沙箱不能寫入工具契約自有暫存 Git 設定失敗；正常授權環境的 tooling 重跑 599 案通過，未改測試期待。指定 Node 26.8.1 下完整 verify 通過：3022 案，零失敗／取消／略過／待實作；另通過型別、架構、格式、文件、封存、確定性建置、JavaScript 語法與暫存封裝校驗。沒有重開舊效用矩陣。

## 安全差異

Codex Security diff scan 8085f3df-8db2-422b-9c95-3bd30c6d58f9 已完成，零發現；凍結基準至修復來源／測試差異共兩個 source-like 檔案，既有四份報告文件另檢視。獨立架構檢視與父審查核對 current-plan、Vault、政策失效、禁止規則、Native／Catalog 邊界及 reload 所有權。掃描後僅加入版本／封裝及文件維護；執行期修復保持同一行差異。

## 來源隔離與實際安裝

舊完整報告見 [v2.1.39 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2139-完整報告保存2026-10-31)。其中 FAIL／INVALID 與提前重試效用 FAIL 原樣保留，屬移除前環境；既有 PASS 不重跑，也不跨版本宣稱新驗收。

修前取證 T0=23:03:28.220，最遲清理 23:23:28.220、硬截止 23:33:28.220；23:12:52.519 已完成清理。全程只有 IAB 分頁 6，新 S2／S1 文件核對 Tampermonkey 5.5.1、v2.1.39 完整本體 507,387 bytes、SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3、唯一 Runtime／ControlCenter 與 Fetch／XHR hooks。261 個 parsed scripts 的完整清單僅辨識到 BiliCDN userscript，未見 Evolved；S1 清單亦未見 Evolved。依使用者已確認的方法立即靜音，音訊下載保留，沒有媒體 getter 覆寫。

| 測了什麼 | 結果 | 發現什麼問題／證據 | 哪些仍未驗證 |
| --- | --- | --- | --- |
| RCA-N05：S2／P1／Auto／1 倍／提前重試開 | PASS | 60.001 秒、242 筆；進度 +60.009 秒，無 waiting、失敗、取消或核心重載，影片 12 次 206、實際 3840×2160 | 舊卡頓未再現，原取消發起者未知；未啟動停用對照，不能判移除 Evolved 已解決 |
| RCA-HK01：預定 01-03／1 倍 | INVALID | 選單操作誤落 mirrorcos；起始 fixedHost 不符，保留偏差且未重跑 | 01-03 本輪失敗根因 |
| RCA-HK04：01-05／2 倍／提前重試關 | FAIL | 60.004 秒，進度 +120.010 秒；14 次該台影片 206，但約第 42.055 秒影片 timeout，後續 mirrorali 約第 47.338 秒亦 timeout；無卡頓／清空或腳本重載 | 最初逾時的網路根因、舊網站清空原因；流暢播放不抵消供片失敗 |
| RCA-HK05：01-01／1 倍／提前重試關 | FAIL | 60.005 秒，進度 +60.004 秒；一次該台影片 206，也有該台影片 timeout；其後其他 CDN 供片 | 該 timeout 的網路根因；起始前在途請求缺當窗 Native request 配對 |
| 獨立 timeout 歸因 | 證據不足 | 送出斷點讀到影片 XHR timeout=10000，堆疊由網站 core.9c6ca999.js 的 load／executeRequest 經 BiliCDN send／perform；當時提前重試關閉。原生 timeout 回呼斷點未再命中 | 不能把這筆備援請求的值回填為每次香港請求的精確 timeout／設定者 |
| utils.playerReady 被動觀察 | 證據不足 | 新文件未載入 Evolved，playerReady console 查詢 0 筆；未另開 OGV 或獨立重測 | 舊錯誤完整因果仍未知，未再現不作根因證明 |
| 自有清理 | PASS | 原設定逐欄還原；fixedHost=null、Native=false、提前重試=false、香港三台 false；rate=1、paused=true、muted=true；自有窗口／靜音觀察器、斷點與遠端參照釋放，中心訂閱 0、分頁清單空 | 本輪沒有匯出或剪貼簿操作 |

窗口均連續收取 Network，無截斷，頁內 250 ms 取樣；歸因斷點在計分窗口外。舊資料不能可靠配對的 DNS 錯誤沒有移植到新根因。自有去敏證據位於本機忽略目錄 .work/iab-testing/2026-10-31-cc40-root-cause/pre/，包含 EVIDENCE、四案原始 JSON、VERDICTS 與 settings-restored.png；舊兩輪 29 個證據檔的雜湊另存 .work/cc40/old-evidence-hashes.json。

## 公開交付與安裝結案

本版封裝／發布及修後定向安裝驗證待執行；將核對唯一腳本附件與公開 latest 的版本、大小及 SHA-256。修後只安排一次 HK04 相關窗口，不重跑其他已通過項目。

**本次尚未完成全部根因調查或整體核心驗收。** 已確認的恢復資格缺陷與其他未解傳輸／網站問題分別判定；香港缺樣及原提前重試效用 FAIL 保留。

## 歷史驗證導覽

v2.1.39 完整正文已追加至 [歷史原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2139-完整報告保存2026-10-31)，保留各次工具受阻、移除前安裝、單分頁矩陣及一次授權補測。其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="發布與安裝限制"></a>

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

<a name="2026-10-31更新後安裝核對"></a>

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

<a name="2026-10-31補測與單分頁重測"></a>

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

<a name="2026-10-30up141-安裝版實測"></a>

<a name="隔離-b-分支原型驗證2026-10-30"></a>

以上舊錨點均導向 v2.1.39 歷史原文，不表示本版測試結果。
