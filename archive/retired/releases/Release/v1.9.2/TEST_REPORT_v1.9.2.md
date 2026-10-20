# v1.9.2 功能驗證報告

## 基準與範圍

已發布不可變 v1.9.0 SHA-256：`f7628173de6fce49bd8606ac31ab647a7bd02152bc6ab6b93c437524ead74f9f`。

工作區在本輪開始時包含尚未獨立封裝的 v1.9.1 起播保護，因此 v1.9.2 同時交付該修補；增量 patch 以可核對的已發布 v1.9.0 為基準，不虛構不存在的 v1.9.1 發布產物。工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

## 問題證據

真實 Chrome 中曾觀察到：影片正常播放後長時間暫停，恢復時 `<video>` 為 `paused=false`、`readyState=0`、尺寸為零；音訊 Transport 與緩衝仍前進，但影片 segment 不再完成，`player.__core().state.initialized=false`。Bilibili core 同時記錄影片 SIDX 重試失敗及 video scheduler 未啟動。這是本修補的實機問題證據，不等於修補後實機驗收。

## 自動功能驗證

- v1.9.1 起播保護：兩個有效進度 tick、12 秒實際可播放緩衝、paused／seek／低資料、短片完整緩衝及量測流量不增加。
- v1.9.2 核心恢復：強證據 10 秒、缺少 initialized 欄位時 15 秒加音訊進展、只 reload 一次、位置／2x／播放意圖恢復。
- 初次起播、短暫暫停、新影片 Transport／影格恢復、固定 CDN、缺少 reload API、reload timeout 與 90 秒 breaker。
- hidden 事件維持隔離；visible 事件不再被腳本吞掉。黑名單、dead、soft、設定排除、Native／Catalog、SPA、Fetch／XHR 及 Worker 已移除狀態保持原回歸。
- 完整功能回歸：349 項通過，0 失敗，0 skip。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用與 SHA-256 由 `npm run verify` 驗證。
- 依使用者要求，不執行 Code Security 掃描或獨立安全子集。

## 尚待真實 Chrome／Tampermonkey 複驗

安裝 v1.9.2 後，正常播放一段時間，長時間暫停並切換至其他視窗，再恢復播放。成功標準是影片 core 自動重建、時間與 2x 恢復、只有一次 reload，且沒有循環重載。Node／VM 驗證不冒充這項實機結果。
