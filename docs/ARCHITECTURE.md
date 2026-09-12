# v1.6.0 架構

`.mjs` import/export 連接模組，狀態存在工廠實例閉包；沒有共用的可變全域大物件。`src/main.mjs` 明確建立實例並連接有限的依賴 getter／必要 setter。延後讀取維持既有循環關係，但不把所有狀態交給每個模組。

| 區域 | 所有權／責任 |
| --- | --- |
| config / settings | 檔頭設定及版本，執行時傳入，非 define |
| runtime | generation、主動取消、SPA／visibility／WebRTC、啟停、指定控制命令 |
| policy | catalog、URL 分類、root-original／host-lock、sink 守門 |
| routing | health／限制／UCB、verified failure、probe／bakeoff／HTTPDNS |
| transport | Fetch／XHR、request sequence、terminal-once、bytes 去重與證據 |
| playback | 倍速、epoch、representation、codec 查詢、Watchdog |
| diagnostics | 有界事件、報告、唯讀快照，不從 log 觸發控制 |
| ui | closed Shadow DOM、可信事件／capability、視圖、播放器面板 |

UI 只取得指定操作、健康狀態副本及 Watchdog 唯讀方法。privileged commands 位於 runtime/controls，不透過 page API 公開。匯入主模組本身不讀 GM／DOM 或啟動網路。

v1.7.0 不再包含 Worker 子系統或獨立 Worker bundle。網站 Worker 保持瀏覽器原生處理，主腳本不讀取或替換 constructor，也不建立 Worker 用 Blob／MessageChannel。

主程式為私有 IIFE、無 globalName。metadata 第一，其後為私有可編輯設定，再進入打包閉包。只有一份可執行 userscript，無 chunk、Node API、@require 或外部 source map；map 只留 dist。

esbuild 不壓縮、不 tree-shake、不移除 Console、保留名稱。target esnext；另將 `class-static-blocks` 設為 false，避免 keepNames 額外引入 static block 語法，不是全面舊瀏覽器轉譯。

歷史樣本用原 VM，新版內部驗收用獨立 test entry；正式檔不能包含 test bridge。未插樁正式檔另經 Fetch／XHR／選單入口及網站 Worker 身分不變測試。以上皆非實機播放證據。
