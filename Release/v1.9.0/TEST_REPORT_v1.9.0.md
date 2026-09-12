# v1.9.0 功能驗證報告

## 基準與問題

不可變 v1.8.9 SHA-256：`c2f0db083c7821326d20a6d7dfc9b4e9dc010773756ef4a557c545c65fa7d3f3`。
工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

真實 Chrome／Tampermonkey 的 SPA 觀察顯示：部分站內換片沒有新的 playurl 請求，`__playinfo__` 仍是舊物件；但穩定的外層 `window.player` 已更新 manifest，新的 `player.__core()` 亦能提供目前 MPD。新 core／manifest 約在換頁後數百毫秒可用，早於首批媒體 XHR。這說明只攔截 playurl 或等待 `__playinfo__` 無法涵蓋所有播放器時序。

## 功能驗證

- 固定 v1.8.9 重現：舊 `__playinfo__`、沒有 playurl、已有目前 player MPD 時，SPA Route Pool 仍為零。
- 驗證延遲 core、同步首請求 context miss、第一筆 Fetch、暫時沒有 player、快速連續 SPA、暫態舊 MPD與 manifest 不相符。
- 驗證可信 playurl 稍後接管 player MPD；停用狀態不讀 player，且原始 Fetch／XHR 維持原樣。
- 驗證讀取 player 不新增 MPD 媒體請求，公開快照不含 token、path 或完整 signed URL。
- 完整功能回歸：339 項通過，0 失敗，0 skip。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用及 SHA-256 由 `npm run verify` 驗證。
- 依使用者要求，不執行 Code Security 掃描或獨立安全子集。

## 實機界線

上述 Chrome 觀察用來確認 v1.8.9 缺口及 player MPD 的可用時序；v1.9.0 安裝後的播放複驗另行執行。應以自動畫質＋2x 連續切換多支站內推薦，檢查控制中心顯示 player MPD 已採用、representation／Route Pool 不再長期為零，並覆蓋 seek、背景切回與短片片尾。Node／VM 結果不冒充 Chrome 實際播放證據。
