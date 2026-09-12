# v1.9.0 架構

`.mjs` import/export 連接模組，狀態存在工廠實例閉包；沒有共用的可變全域大物件。`src/main.mjs` 明確建立實例並連接有限的依賴 getter／必要 setter。延後讀取維持既有循環關係，但不把所有狀態交給每個模組。

v1.8.2 的兩階段選路：Catalog 選路器從合格內建清單提出建議（不受本片 host 清單限制），路由協調器再比較符合資格的本片 Native signed route。主動測速仍最多四個名額，其中 Native 最多一個；健康播放只更新評級。

頁面 `__playinfo__` 僅建立記憶體 page-hint 候選，不能覆蓋可信 API Pool。每個 known-family exact URL 必須在當前 generation／候選版本經 Fetch EOF 或可信 XHR 成功終態確認，才解鎖該 URL；redirect、query 改變、取消與合成事件不解鎖。其他第三方頁面 URL 不取得 Ledger／probe 權限。合計 128 video／64 audio group、每組四條、16 KiB／URL、1 MiB 字元上限；衝突保持 ambiguous。page-hint 碼率不提供 Watchdog 處罰歸因。

v1.9.0 增加播放器只讀同步層：在 SPA 沒有可信 playurl 時，以 `player.getManifest()` 驗證目前影片 key，再從當前 `player.__core().getMpd()` 白名單複製 representation。同步採短期有界重試；媒體 context miss 只額外同步讀取一次。若仍沒有對應資料，僅以該 exact URL 建立有界 transport bootstrap，保留既有改寫行為但不猜測 representation。可信 API 隨後到達時清除較低層來源並接管。此層不開統計面板、不修改播放器、不發出網路，也不持久化或公開 signed URL。

第一個可用的頁面影片完成樣本只安排一次起播量測；可信 API 稍後接管保留已觀察 affinity 與排程旗標。診斷的 root-original、catalog-generated 依請求及產生來源證據區分，不以 host 成員資格猜測；host 變更計數只由後續影片觀察增加。

| 區域 | 所有權／責任 |
| --- | --- |
| config / settings | 檔頭設定及版本，執行時傳入，非 define |
| runtime | generation、主動取消、SPA／visibility／WebRTC、啟停、指定控制命令 |
| policy | catalog、URL 分類、root-original／host-lock、sink 守門 |
| routing | catalog health／限制／UCB、Native signed route pool／host-only Ledger、verified failure、probe／bakeoff／HTTPDNS |
| transport | Fetch／XHR、request sequence、terminal-once、bytes 去重與證據 |
| playback | 倍速、epoch、representation、codec 查詢、Watchdog |
| diagnostics | 有界事件、報告、唯讀快照，不從 log 觸發控制 |
| ui | closed Shadow DOM、可信事件／capability、視圖、播放器面板 |

UI 只取得指定操作、健康狀態副本及 Watchdog 唯讀方法。privileged commands 位於 runtime/controls，不透過 page API 公開。匯入主模組本身不讀 GM／DOM 或啟動網路。

v1.7.0 不再包含 Worker 子系統或獨立 Worker bundle。網站 Worker 保持瀏覽器原生處理，主腳本不讀取或替換 constructor，也不建立 Worker 用 Blob／MessageChannel。

v1.8.0 在 `routing/native-routes.mjs` 分開兩種生命週期：完整 signed URL 只進目前 playinfo epoch 的 representation group；跨影片 Ledger 只保留 hostname 與有界健康數值。v1.8.1 再加入 session Route Affinity，把「評級」與「換線權」分開。健康 probe／bakeoff 只更新排名；新 playinfo、verified Transport failure、Watchdog recovery 或可信固定／自動設定才是合法 route transition boundary。

自動畫質以 active representation 驅動 Native 探索：初始 group 可用有效影片傳輸加高度吻合確認；其後切換必須有兩筆連續同組完成證據，舊 active group 插入即重新計數。同高度不同 codec 不因 `videoHeight` 單獨確認。representation 改變只更新測速樣本指向，不建立 route grace 或新 bakeoff；顯著勝出的 probe 只成為 `probe-qualified` 評級。

Route Affinity 優先跨 representation 延續 host。Catalog 可依既有安全改寫生成該 group URL；Native 必須由新 group 提供同 host 的 exact signed URL，否則整個 epoch 降級回 Catalog，不能合成 Native URL或在舊 group 返回時反覆彈跳。planned route 與 observed host 分開記錄，只有後續影片 Fetch／XHR 才能證明實際 host 變更。

主程式為私有 IIFE、無 globalName。metadata 第一，其後為私有可編輯設定，再進入打包閉包。只有一份可執行 userscript，無 chunk、Node API、@require 或外部 source map；map 只留 dist。

esbuild 不壓縮、不 tree-shake、不移除 Console、保留名稱。target esnext；另將 `class-static-blocks` 設為 false，避免 keepNames 額外引入 static block 語法，不是全面舊瀏覽器轉譯。

歷史樣本用原 VM，新版內部驗收用獨立 test entry；正式檔不能包含 test bridge。未插樁正式檔另經 Fetch／XHR／選單入口及網站 Worker 身分不變測試。以上皆非實機播放證據。
