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

## 真實 Chrome／Tampermonkey 複驗

2026-09-13 使用 Chrome 153、Tampermonkey 與已安裝的 v1.9.0，以自動畫質、2x 及站內 SPA 連續切換實測：

- `BV1d7b16bEuG`：播放器實際提供 4K／8K；強制 8K 時確認 `4320p/AV1`、約 33.2 Mbps、player MPD 10 組、Native 當前群組 1，前方緩衝約 18–23 秒。回到自動後 B 站降至 `720p/HEVC`，Route Pool 未遺失。
- `BV1kd2HB7EjM`：標題雖稱 8K，播放器最高為 4K；自動 4K、2x 下確認 `1620p/HEVC`、player MPD 9 組，前方緩衝回升至約 72 秒。
- `BV1fyXzBgEsC`：自動 4K、2x 下確認 `2160p/HEVC`、player MPD 9 組、同步第一次嘗試即採用，前方緩衝約 66–73 秒。

三支影片的控制中心均顯示播放器同步為 `adopted`、來源為 `player-mpd`；SPA 後 representation 與 Route Pool 均能重建，未觀察到健康播放期間反覆換 host。第一支 8K 顯示自動畫質會在高負載時由 B 站主動降級，這不等同腳本 Route Pool 失效。

這些結果是本機單一帳號、裝置及網路的功能證據，不代表所有地區、影片、硬體解碼或長時間播放情境。Node／VM 結果仍不冒充 Chrome 實際播放證據。
