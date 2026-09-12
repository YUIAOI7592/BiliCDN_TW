# v1.8.2 驗證報告

## 基準與範圍

- 不可變 v1.8.1 SHA-256：`9f99486a60538d8909a5b60b2a1b15757453b2cb7bed5581edcfd52f37b281d5`。
- 工具：Node 26.8.1、npm 11.19.0、esbuild 0.28.2；無新增依賴。
- 修補 Catalog／Native 決策旁路、內嵌候選歸因／起播入口及診斷來源。並非增加最高速度或保證所有卡頓可恢復。

## 自動測試

- 首輪開發候選完整 Node 套件：315／315 通過，0 skip。含固定歷史重現，不全部視為新版本功能案例。
- 新增 19 項：固定 v1.8.1 旁路重現、exact-only admission、第三方限制、重複／衝突／過期候選、來源接管、重複終態、容量、Fetch cancel／403／body error、XHR redirect／假事件／重新 open、Catalog 未列在頁面仍參賽、健康不換線、產生來源與實際 Catalog recovery 觀察。
- 未插樁正式 userscript 的 Akamai-only 頁面 250 秒 healthy／seek／failure VM 流程：兩版非 probe 請求均 57 次；v1.8.1 probe 為 0，本版為 8（恢復一次起播加既有週期，各四候選），每輪 Native 最多 1、Range 額度不超過既有 768 KiB。healthy／seek 的實際請求 host 序列相同。故障流程另檢查既有額度；不將這個 trace 當成所有故障恢復皆已實測。
- bytes 指程式 Range／採樣額度；不宣稱瀏覽器 wire bytes 絕無跨 chunk 超收。
- 修補後產物 `node scripts/verify.mjs`：327／327，0 skip，獨立 CS 子集 17／17；語法、固定 fixture SHA、可重現建置、兩份 patch 實際套用及 SHA 均通過。安全掃描後另補的 12 項涵蓋 exact backup、非同步撤銷、XHR 屬性遮蔽、native reopen、HEAD／空 body 與等價 URL。安全子集不重複計入總數。

## 安全流程

Codex Security 首輪 v1.8.1→未發布候選 `2b235af` 差異掃描已完成，scan `b3d80c0e-181a-498d-908f-5a090044e671`，17 個來源／產物審查面，確認 3 項 Low：

1. 成功 backup B 的解鎖被錯用於未完成 primary A 的 Catalog 改寫／測速。
2. 衝突頁面候選失去 context 後，退回 legacy 改寫旁路。
3. XHR 公開 responseURL／header／status 可遮蔽，讓無關原生完成被誤認為頁面候選成功。

首輪候選不發布，原 bytes 與 SHA 保存在 `tests/fixtures/BiliCDN_TW_1.8.2.pre-security.user.js` 作負向控制。修補採 exact 已完成樣本、來源感知測速守門、原生 XHR accessor 快照與私有 request state；獨立覆核再補 native silent reopen、HEAD 空 payload 及 URL canonicalization。

最終候選 `184bdce6282401534b5def151a51300044ed2a32` 的完整 v1.8.1→候選差異掃描已封存：`466a66a9-681a-4df2-a095-2bccc7e06c6b`。17／17 審查面已檢查，但兩項 HTTP method admission 候選維持 **deferred**，coverage 為 partial；不是零問題安全通過，**目前不發布 GitHub Release**：

- Fetch 非 GET 的 exact URL 成功非空回應也可解鎖頁面候選。
- XHR 使用原生 prototype.open 在 OPENED 狀態重新開啟同 URL，可能讓快取的 GET 與實際方法不同；實際同 URL 非空回應仍可解鎖。

未插樁 bundle VM 已重現上述資格與 Ledger 變化；不同 query 與空 payload 反例均不解鎖。尚未證明真實已知 CDN 存在可利用的方法差異回應，也未以 Chrome 驗證同狀態原生 reopen。原批准計畫要求真實媒體成功，未明文規定 GET-only；掃描上下文新增的 GET 保證不可冒充使用者原要求。仍須釐清方法證據與 GET 媒體資格的邊界，不能因缺實機證據就宣稱安全。

候選 userscript SHA-256：`2875f7341f3e40f67b5b4c8783f1c8564d13581cb054e66b7a73b3100f2345d6`。第二輪掃描工具跨任務 aggregate 為 5,588,732 tokens（含 cached input 5,292,544）；第一輪為 11,501,808 tokens。第二輪 scan goal 另計 274,381 tokens／約 11 分鐘，與 aggregate 計量範圍不同，不加總；以上不是帳單或實機驗證時間。

新增攻擊面為 page-hint→成功 exact Transport→Ledger／主動 probe／Catalog URL。page-hint 自身不得寫 GM、測速或授權 Native primary；已知家族必須 exact URL 同版本成功終態，第三方頁面 URL 不解鎖。Catalog 權限不因 Native 評級擴張。SECURITY.md 的舊全面 page-state 禁令尚待精確政策差異確認；此限制差異不是安全豁免。

## 實機與已知限制

本輪未安裝候選到使用者 Chrome／Tampermonkey，未宣稱實機通過。須以自動畫質、2x、至少四分鐘播放與實際請求交叉確認，另涵蓋 4K、seek、SPA、背景切回及控制中心。

頁面 representation metadata 仍是不可信提示；衝突保持 unknown，不提供 Watchdog 懲罰歸因。能力查詢 good 不證明硬體解碼或 2x 流暢。GM 多分頁合併仍非原子；無可安全改寫樣本時保留原生播放。

頁面來源 XHR 若原生錯誤沒有可核對的 final URL，只記錄錯誤、不猜測處罰 Native host；既有 Watchdog 仍可按實際停滯條件修復。具有原生 URL 的 HTTP 失敗、可信 API 路線及 Fetch 的既有失敗路徑保留。HEAD／Content-Length 本身不算完成影片 body。

## 交付

本目錄保存 userscript、build manifest、增量／累計 patch 及 SHA 清單。GitHub Release 只上傳 BiliCDN_TW.user.js；其他檔案留儲存庫。不自動安裝瀏覽器、不建構 CI/CD。
