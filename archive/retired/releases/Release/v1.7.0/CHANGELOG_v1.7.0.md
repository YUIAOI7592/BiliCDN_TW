# v1.7.0

- 完整移除 Worker 攔截、constructor 包裝、私有 MessagePort、capability bootstrap、policy／stats schema 與相關 timer／listener。
- 刪除 `EnableWorkerIntercept` 設定及 `src/worker/`；網站的一般、Blob、data 與 module Worker 全部交由瀏覽器原樣處理。
- esbuild 不再建立或內嵌獨立 Worker bundle；build manifest 移除 Worker 輸入與 `workerSha256`。
- 診斷報告、唯讀頁面快照及控制中心移除 Worker 欄位與「進階」頁；Verbose 開關合併到診斷畫面。
- 從 v1.6.x 升級時最佳努力刪除舊 `workerStats_v1`；固定 CDN、catalog override、health 與處分資料不受影響。
- 保留 v1.6.3 Worker 案例作不可變歷史重現；v1.7.0 的 CS-003 驗收改為確認攻擊面不存在及網站 Worker 完全不受腳本觸碰。
- 主執行緒 Fetch／XHR、CDN 選路、2x 假定、AV1、Watchdog、UCB／EWMA、測速額度、timeout 與冷卻均未調整。

實機移除依據為 3 次可見 Worker constructor 全部屬 Blob Worker 且安全放行，成功包裝、媒體請求與改寫皆為 0。這只支持本個人版的取捨，不代表所有 Bilibili 頁面都不使用 Worker。
