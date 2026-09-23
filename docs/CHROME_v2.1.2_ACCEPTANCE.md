# BiliCDN_TW v2.1.2 Chrome/Tampermonkey 驗收

2026-09-24，在額外建立的 Chrome 影片分頁測試；使用者原有分頁未操作。控制中心診斷報告確認安裝版本為 `2.1.2`。測試結束後已關閉額外分頁。本記錄只保留 hostname、方法、狀態及有界摘要，未保存 signed URL、path、query、token 或 HAR。

## 正常自動模式

- Fetch 與 XHR hook 均顯示 `installed`。所取快照有 78 次 Fetch、466 次 XHR 進入 hook，363 次辨識為媒體，544 次呼叫原生方法，506 次觀察到回應。這些是腳本計數，不能單獨當作瀏覽器網路證據。
- 最新成功影片請求：原始 host 為預設不可用的 `upos-sz-mirrorcosov.bilivideo.com`；腳本在請求攔截時換成 `upos-hz-mirrorakam.akamaized.net`，診斷記為 Native signed，回應 host 同為 Akamai，狀態 206。
- 最新成功音訊請求：原始 host 同為 `mirrorcosov`；腳本換成 `upos-sz-mirroraliov.bilivideo.com`，診斷記為 Catalog，回應 host 同為 `mirroraliov`，狀態 206。
- Chrome Network 在播放及 seek 後，實際記錄到上述兩個目的 host 的 XHR 與 206 回應；一段 seek 擷取中，各有五筆同 host 的請求／回應配對。這證實這兩種目的 host 確實進入瀏覽器請求，不只是路由計畫。由於診斷的 RequestId 與 Chrome requestId 不共用識別碼、重複分段又使用同 host，本次以測試窗口的 host／方法／狀態交叉核對，**未宣稱逐筆唯一配對**。
- 起播預測試顯示 `preflight-skipped:xhr-explicit-timeout`，沒有延後播放器請求；因此本次不驗收三秒預測試時序。

## 僅本分頁原始 signed URL 對照

- 在同一額外分頁啟用對照模式後以站內換片建立新 generation。診斷確認 `originalComparison=true`、量測 `disabled`；未修改持久設定。
- 新片原始 primary 為預設不可用的 `mirrorcosov`。腳本將本片合法 signed 備援 Akamai 提供給播放器；最近一次本地阻止記為 `mirrorcosov`／`default-unavailable`、未呼叫原生網路。最新成功影片與音訊請求均為原樣送出 Akamai，回應 host 為 Akamai，狀態 206。
- Chrome Network 在對照模式重播後觀察到 Akamai 的新 XHR 與 206 回應；一段未截斷的後續擷取有五筆 Akamai 新請求、六筆 206 回應，沒有 `mirrorcosov` 新請求。控制中心當時顯示健康播放及約 35 秒可播放緩衝。
- 這證明此樣本中「禁止的原始 primary → 合法 signed 備援」的後態；它不是 verified Transport failure 後自動 fallback 的實機注入測試。後者仍只有自動合約測試覆蓋，未在 Chrome 自然重現。

## 邊界

- Network 事件緩衝在較長播放窗口曾截斷；上列未截斷窗口只證明該窗口內的請求，不能外推為所有影片或 Worker／瀏覽器 redirect 都被攔截。
- 對照模式下診斷將媒體關聯標為 `weak`，representation 與 affinity 為空；這是觀察模式不授予健康評級的既有行為，不能把播放中的 Akamai 回應誤寫成新評級。
- 未發生自然 verified failure、DASH 6006 或死核心，因此未宣稱 Chrome 已驗證這些故障救援。v2.1.2 的 264 項自動合約測試與本次 Chrome 觀察分開計數。
