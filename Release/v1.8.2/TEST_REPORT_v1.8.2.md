# v1.8.2 驗證報告

## 基準與範圍

- 不可變 v1.8.1 SHA-256：`9f99486a60538d8909a5b60b2a1b15757453b2cb7bed5581edcfd52f37b281d5`。
- 工具：Node 26.8.1、npm 11.19.0、esbuild 0.28.2；無新增依賴。
- 修補 Catalog／Native 決策旁路、內嵌候選歸因／起播入口及診斷來源。並非增加最高速度或保證所有卡頓可恢復。

## 自動測試

- 開發候選完整 Node 套件：315／315 通過，0 skip。含固定歷史重現，不全部視為新版本功能案例。
- 新增 19 項：固定 v1.8.1 旁路重現、exact-only admission、第三方限制、重複／衝突／過期候選、來源接管、重複終態、容量、Fetch cancel／403／body error、XHR redirect／假事件／重新 open、Catalog 未列在頁面仍參賽、健康不換線、產生來源與實際 Catalog recovery 觀察。
- 未插樁正式 userscript 的 Akamai-only 頁面 250 秒 healthy／seek／failure VM 流程：兩版非 probe 請求均 57 次；v1.8.1 probe 為 0，本版為 8（恢復一次起播加既有週期，各四候選），每輪 Native 最多 1、Range 額度不超過既有 768 KiB。healthy／seek 的實際請求 host 序列相同。故障流程另檢查既有額度；不將這個 trace 當成所有故障恢復皆已實測。
- bytes 指程式 Range／採樣額度；不宣稱瀏覽器 wire bytes 絕無跨 chunk 超收。
- 最終正式產物 `node scripts/verify.mjs`：315／315，獨立 CS 子集 17／17，語法、固定 fixture SHA、重現建置、增量／累計 patch 實際套用及 SHA 驗證通過。安全子集不重複計入總數。

## 安全流程

Codex Security v1.8.1→v1.8.2 差異掃描：待執行。不得以 VM 安全子集代替正式掃描。

新增攻擊面為 page-hint→成功 exact Transport→Ledger／主動 probe／Catalog URL。page-hint 自身不得寫 GM、測速或授權 Native primary；已知家族必須 exact URL 同版本成功終態，第三方頁面 URL 不解鎖。Catalog 權限不因 Native 評級擴張。SECURITY.md 的舊全面 page-state 禁令尚待精確政策差異確認；此限制差異不是安全豁免。

## 實機與已知限制

本輪未安裝候選到使用者 Chrome／Tampermonkey，未宣稱實機通過。須以自動畫質、2x、至少四分鐘播放與實際請求交叉確認，另涵蓋 4K、seek、SPA、背景切回及控制中心。

頁面 representation metadata 仍是不可信提示；衝突保持 unknown，不提供 Watchdog 懲罰歸因。能力查詢 good 不證明硬體解碼或 2x 流暢。GM 多分頁合併仍非原子；無可安全改寫樣本時保留原生播放。

## 交付

本目錄保存 userscript、build manifest、增量／累計 patch 及 SHA 清單。GitHub Release 只上傳 BiliCDN_TW.user.js；其他檔案留儲存庫。不自動安裝瀏覽器、不建構 CI/CD。
