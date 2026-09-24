# BiliCDN_TW v2 專案脈絡

## 現行產品

- 開發目標：v2.1.4；修復 Fetch 目的地一致性、可信候選來源隔離及主動測速轉址邊界。自動與安全驗證後先發布，使用者更新後再做 Chrome 針對性驗收。
- 唯一正式來源：`src-v2/`。
- 正式入口：`src-v2/entry.ts`。
- 目標平台：最新版 Chrome＋Tampermonkey。
- 正式產物：`Release/v2.1.4/BiliCDN_TW.user.js`。
- v1.9.6 僅作功能參考，不是建置輸入或相容目標。

v2 是全新 TypeScript 架構。它不讀取 v1 設定或學習資料，不提供 `unsafeWindow.BiliCDN`、檔頭設定、舊 snapshot alias、migration 或測試 bridge。

## 產品不變量

- 首筆可歸因的播放器媒體請求可觸發一次最長三秒、最多三條合法路線的起播預測試；無法測試時合法原線必須有界放行。
- 起播期無明確 Transport 失敗而持續無影片進度時，可一次性提交不同 host 的合法備援，並由唯一恢復控制器受限重載。
- 健康播放期間量測只更新證據，不改 affinity。
- Catalog 只來自內建可信清單；Native 只能使用當前 epoch、同 representation 的 exact signed URL。可信 API 首次接納同群組時，撤銷先前 page-hint／player-MPD 的可選路線與 handle；後到提示不得重新授權。
- 路徑無法安全辨識的當前 epoch exact signed URL 只可供觀察與禁止判定，不授予 Native 選路或主動測速權限。
- signed URL 不得持久化或進入診斷。
- black、dead、使用者停用、預設不可用與 host-lock 優先於排名、固定設定及 fallback。
- video／audio 證據與恢復隔離。
- 已開始的播放器請求不取消、不重送。
- Fetch／XHR hook 安裝狀態與原生呼叫僅屬腳本內證據；實際網路請求須由 Chrome Network 核對。
- Fetch body 維持單 reader，取消原因傳回原 reader。
- Fetch 的政策判定與原生送出共用同一個瀏覽器正規化的 Request；主動測速不跟隨轉址，只接受受檢 host 的直接 206 回應。
- 停用後不改寫、不主動量測；網站請求保持原樣。
- 網站 Worker constructor 完全不碰觸。
- 所有 affinity 變更由 `RouteCoordinator` 建立可追溯的 `RouteDecision`。
- 所有 reload 或恢復操作由 `RecoveryController` 建立可追溯的 `RecoveryAction`。

## 交付規則

- TypeScript 7.0.2、esbuild 0.28.2、Node 26.8.1。
- 發布前必須通過 typecheck、architecture、功能測試、可重現建置、語法與 checksum 驗證。
- mock／自動測試與真實 Chrome／Tampermonkey 結果分開記錄。
- GitHub Release 只附 userscript；CHANGELOG、TEST_REPORT、manifest 與 SHA-256 留在儲存庫。
- v2 不產生 incremental／cumulative patch，也不依賴舊 bundle fixture。
- 不建立 CI/CD 或 GitHub Actions。
- Codex Security 按風險使用：安全敏感變更或使用者明確要求時執行，不強制每版掃描；v2.1.4 的三項修復必須完成差異掃描及逐項驗證。`npm run verify` 不包含安全掃描。
