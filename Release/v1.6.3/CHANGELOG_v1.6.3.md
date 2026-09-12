# v1.6.3

- 依使用者明確要求，將 `EnableWorkerIntercept` 預設由 `false` 改為 `true`，讓 v1.6.2 新增的 Worker 可觀測性可以在一般安裝後直接蒐集實機證據。
- 保留檔頭 opt-out；若遇到相容性問題，可將 `EnableWorkerIntercept` 改回 `false`，重整後完全不安裝 Worker 攔截器。
- 預設安裝攔截器本身不建立 Worker、Blob、MessageChannel 或額外網路請求；只有頁面實際建立可安全包裝的 Worker 時才啟動私有通道。
- 修補安全差異掃描發現的兩個 Worker 信任邊界：不再以可被頁面預先替換的 `unsafeWindow.Worker` 作原生基底；classic／module 原始 Worker 都延後至 capability bootstrap、私有 port 綁定及 `ready` 回報之後才啟動。
- 私有通道固定使用啟動前捕捉的原生 MessageEvent getter、Reflect apply 及綁定後的 MessagePort 方法；bytes／stats 只有在同一 port 完成一次合法 `ready` 後才接受。
- constructor 返回後、原始 module 尚未載入完成的普通 message 會有界地排隊，再依序交給原始 Worker；classic 相對 `importScripts()`、取消傳播與 terminate 語意保持不變。
- capability bootstrap 逾時時會清除內嵌 policy 並只啟動原始 Worker；主頁不再追蹤該 Worker，遲到的 capability／port 會被關閉，避免留下無法同步停用的改寫能力。
- 不改 CDN catalog、播放、2x、AV1、Watchdog、測速額度、timeout 或冷卻。
