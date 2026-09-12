# BiliCDN_TW v1.6.3 測試報告

## 範圍

本版將 Worker 攔截改為預設啟用，並修補差異掃描發現的兩個 Worker 信任邊界。不可變前版為 v1.6.2，SHA-256 為 `1c1620013f636a0feae46d1cc3f75d8f6c3a0d1ecec62e7c1b875523bb289cc7`。

## 驗收重點

- 正式未插樁 userscript 的 `EnableWorkerIntercept` 預設為 `true`。
- 預設載入會安裝安全攔截器，但在頁面未建立 Worker 時不建立 Blob、MessageChannel、Worker 或額外主動網路請求。
- 明確設定為 `false` 時仍在讀取或替換頁面 Worker 前返回，不安裝 wrapper，也不為 Worker 攔截建立 Blob 或 MessageChannel。
- 頁面預先替換 `unsafeWindow.Worker` 無法取得 wrapper URL、bootstrap token 或 transferred port。
- 原始 classic／module Worker 在一次性 bootstrap 與私有 port 建立前不執行；原型污染不能竊取 MessagePort 或替換 policy payload。
- bytes／stats 必須來自完成 `ready` 的同一私有 port，並繼續套用 exact catalog 與有限 schema。
- module Worker 的 constructor-time message 會等原始 module 載入後再依序交付；bootstrap 缺失或逾時則清除 policy、原樣啟動原 Worker，後續不再改寫或回報 telemetry。
- 安全亂數、來源守門、PCDN／URL 守門、單 reader 取消傳播及 bounded diagnostics 維持不變。

## 完整驗證

- 完整 Node／VM 回歸：270/270 通過。
- 獨立 CS-001～003 子集：19/19 通過（不重複計入 270 項）。
- 新增 Worker 信任邊界案例：頁面 pre-hook、classic bootstrap 順序、MessagePort／MessageEvent 原型污染、module 啟動順序／訊息排隊及 bootstrap timeout 的無 policy fail-open。
- 語法、不可變 fixture、可重現建置、v1.6.2 incremental 與 v1.3.4 cumulative patch 實際套用、SHA-256 與 tracked exclusion：全部通過。
- Codex Security 首次 v1.6.2→候選差異掃描回報 2 項 Low，均已修補；最終差異掃描 `8e773f33-82ba-4b74-b8b6-4a5e41fafd25` 完整覆蓋 9 個差異面，回報 0 項可報告弱點。

正式 userscript SHA-256：`4184185d2b0191670aa82c28073d193abd0a99b5815bfa72166366383eabd45a`。

## 實機界線

VM／mock 僅證明控制與安全邏輯。尚未證明 Bilibili 當前播放器會建立可攔截 Worker，也未驗證預設啟用對真實 Chrome／Tampermonkey 的相容性。極早送給 module Worker 的訊息需由 wrapper 重新派送，因此依賴原生 `isTrusted` 的特殊 Worker 仍可能有相容性差異；遇到問題可將檔頭 `EnableWorkerIntercept` 設為 `false` 後重整。更新後需播放數部影片，再提供控制中心「進階 → Worker 使用量」或完整診斷報告。
