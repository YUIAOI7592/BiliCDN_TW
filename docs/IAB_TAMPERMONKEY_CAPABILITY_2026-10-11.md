# Codex 內建瀏覽器 Tampermonkey 可用性確認

後續規則更新（2026-10-11）：使用者已將測試環境由「預設」收斂為**只使用 Codex 內建瀏覽器＋Tampermonkey**。現行方法依 [IAB_TESTING](IAB_TESTING.md)；下方保留當時的實測與判定文字，不授權外部 Chrome 測試，也不代表新一輪 BR-01 已執行。

日期：2026-10-11（Asia/Taipei）。本輪只確認使用者已安裝的內建瀏覽器 Tampermonkey 能否作為測試環境；原 BR-01 自主目標保持暫停。

**判定：可以使用。後續預設改為 Codex 內建瀏覽器＋Tampermonkey。** 正式來源、測試、版本與 Release 均未修改；本輪不代表 BR-01 完整驗收通過。

**重新驗證：一般測試能力通過；本輪背景測試窗口無效。** 工具分頁選取已改變，但未證明實際視窗進入背景，也未獨立校準所讀取的 prototype getter。原先「背景能力檢查不通過」判定已撤回；下述 false／true 數值保留為觀察，不能判定內建瀏覽器不具背景能力。

## 實際環境與結果

僅使用指定風景影片 `https://www.bilibili.com/video/BV1tFZZBQE57/`，畫質維持 Auto；本輪輸入確認時為實際 2 倍速。

| 確認項目 | 結果 | 實際證據 |
| --- | --- | --- |
| 使用的瀏覽器 | 通過 | 工具選定 Codex In-app Browser，type=iab、browser ID=3 |
| Tampermonkey 實際執行 | 通過 | 腳本執行環境的 GM_info.scriptHandler=Tampermonkey、version=5.5.1、script.version=2.1.20 |
| 完整本體及唯一實例 | 通過 | 14:38:14.959 完整執行本體 exact v2.1.20=true；Debugger 275 個 scriptParsed、truncated=false、hasMore=false；Runtime／ControlCenter 各 1 |
| 可信鍵盤輸入 | 通過 | BODY 右方向鍵造成實際新 seek，userRevision 2→3、seekRevision 2→4、目標變為 725.021732 秒；未以合成事件代替 |
| 控制中心 | 通過 | 呼叫既有 GM 選單使用的 ControlCenter.show，實際介面顯示並取得畫面，之後關閉；未修改設定 |
| Fetch／XHR 攔截 | 通過 | 先裝兩個精確同源合成 URL 的送出前攔截，再呼叫實際頁面 Fetch／XHR；兩次 requestPaused 均以合成 JSON 回應完成，XHR 有 load→loadend，errors=0、truncated=false |
| 隱藏面板作背景證據 | 不成立 | visibility.set(false) 後原生 hidden=false、Runtime visible=true；還原後亦相同，不能宣稱真正背景通過 |

完整執行本體 SHA-256：`06f4294bb404c153db7ad29e8ba592b625288a7d95e8913d23979d7e8960bffb`。這是去除 userscript header 後的本體，與整份 Release 附件雜湊不同。本輪 GM_info／完整本體核對是執行中腳本的證據，並未操作擴充功能管理頁。

## 能力範圍與限制

可使用頁面操作、可信輸入、畫面、實際腳本身分、singleton、Debugger、Network／Fetch 與合成回應建立測試證據。官方 [Browser 文件](https://learn.chatgpt.com/docs/browser?surface=app) 說明內建瀏覽器的操作與觀察功能；Tampermonkey 是否可用則以本輪實測為依據。

這次確認沒有完成 Auto 1／2 倍的 BR-01 故障矩陣，沒有證明背景、自然 pending startup gate 或所有晚到 SDK 行為。外部 Chrome 與內建瀏覽器的現場結果應分列，不能互相補算。擴充功能管理／更新介面也未在本輪確認可以自動操作。

## 清理與保存

合成 Fetch／XHR 不屬於 playurl 或媒體 URL；兩個資源均在送出前以工具回應，未施加 CDN 故障。完成後取消自有請求、移除自有頁面屬性、清空 Fetch patterns、移除斷點並停用 Debugger、關閉控制中心及還原面板顯示狀態。沒有建立常駐觀察器、修改媒體 getter、控制器、其他腳本或 Chrome 設定。

私有證據：`.work/browser-capability/2026-10-11-iab-tampermonkey/RESULT.json`、`control-center.png`。預設環境規則已寫入 [AGENTS](../AGENTS.md#required-workflow) 與 [開發指南](DEVELOPMENT.md#真實-chrome-驗證)。沒有執行新的 npm 測試或封裝，也沒有變更已發布快照。

## 同日重新驗證：新增分頁與切換

本轮重新開啟同一指定風景影片，實際為 Auto／2 倍速。重新取得執行身分：Tampermonkey 5.5.1、完整 v2.1.20 本體相符、Runtime／ControlCenter 各 1；Debugger 272 個 scriptParsed、truncated=false、hasMore=false。本體 SHA-256 與上節相同。

| 項目 | 結果 | 本輪證據 |
| --- | --- | --- |
| 新增另一分頁並切換 | 操作通過 | 影片分頁 2 → 新 about:blank 分頁 3；工具 selectedTab=3，另讀取該分頁 AX 狀態 |
| 真正背景狀態 | 測試窗口無效 | 每 250 ms 有界記錄共 200 筆，prototype getter 為 true 筆數 0；可見性事件 0；getter=false、Runtime visible=true，但實際背景前提與 getter 原生性未獨立校準 |
| 返回原分頁 | 操作通過 | 關閉自有分頁 3 後 selectedTab=2，原生 hidden=false、Runtime visible=true |
| 可信鍵盤與播放 | 通過 | 真正 Right 輸入使 userRevision 1→2、seekRevision 2→4，最新目標 1791.596711；後續時間／影格持續前進，readyState=4、paused=false |
| 控制中心 | 通過 | 既有 show 方法顯示實際介面，保存畫面後 close；沒有修改設定 |
| Fetch／XHR 精確攔截 | 通過 | 先裝兩個精確 URL 與 Fetch／XHR resourceType 的 Request 攔截，兩次送出前以合成 JSON 回應；errors=0、XHR load→loadend、truncated=false、hasMore=false |
| 清理 | 通過 | 自有 timer／listener／頁面屬性已移除、Fetch patterns 空、斷點移除／Debugger 停用、控制中心關閉、object group 釋放、兩個自有分頁關閉；最後工具分頁數 0 |

本輪工具沒有取代 hidden getter；BiliCDN 的 VisibilityAdapter 只在 document 實例覆寫 hidden=false／visibilityState=visible，安裝前另外保存 Document.prototype.hidden getter 供 isActuallyVisible 使用。測試直接呼叫當時的 prototype getter，因而繞過 BiliCDN 自己的實例覆寫；但未獨立驗證其他腳本是否改過 prototype，不能把「工具沒有修改」寫成「原生 getter 從未被取代」。Runtime 與直接 getter 讀值也不是兩份完全獨立的背景證據。每 250 ms 採樣上限為 200，事件紀錄上限為 20；到達採樣上限後不再新增週期紀錄，清理前另讀取當下及返回狀態。這些結果沒有證明 BR-01 故障救援通過，也沒有增加新的產品缺陷。

使用者提出前景覆寫疑問後，已唯讀複核 [VisibilityAdapter](../src-v2/adapters/visibility.ts) 與原始工具呼叫。背景驗證需同時校準網站所見值、可信原生值與 Runtime 判定，並確認實際分頁／視窗切換；本輪只有工具 selectedTab 的變化，open_in_codex 又回傳 queued，故撤回能力失敗判定。此複核沒有重新執行瀏覽器或 Node 測試，原始 RESULT.json 保留原觀察。

工具邊界另外記錄：`open_in_codex` 對新分頁回傳 queued；`Page.bringToFront` 未改變 IAB 的 selectedTab，不能拿它當作已返回的證據。有效返回以關閉自有分頁後的 selectedTab=2 為準。唯讀 Playwright 範圍未提供 Document，原生 getter 改由允許的 CDP 讀取；Fetch 清理使用 `enable({patterns:[]})`。這些是測試工具限制，沒有改設定或繞過限制。

後續一般測試仍預設內建瀏覽器＋Tampermonkey。背景驗收只計入實際取得 native hidden=true／Runtime visible=false 的窗口；分頁選取成功本身不足以計分。原自主故障目標保持暫停。本輪私有證據另存 `recheck-tabs/RESULT.json` 與 `recheck-tabs/control-center.png`，不覆寫前一次結果；本輪沒有執行新的 npm／安全掃描、封裝或發布。
