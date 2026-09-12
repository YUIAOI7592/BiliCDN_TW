# 專案交接脈絡

目前模組化版本為 v1.7.0；本版依 v1.6.3 實機樣本完整移除 Worker 攔截、私有通道、統計、設定與獨立建置流程。樣本共 3 次 Worker constructor，全部為 Blob Worker 且安全放行，包裝、媒體觀察與改寫均為 0。這足以支持個人版移除，但不宣稱所有 Bilibili 頁面都不使用 Worker。播放與 CDN 選路邏輯不變。來源仍為正式 v1.5.5，不使用 development 草稿。

- 上游：baseline/BiliCDN_TW_1.3.4.original.user.js，SHA-256 acaa3d61c169a0a39ef403d7442e1decc1b20540ea9ada3e8cf5e459bb88f579。
- 重構基準：tests/fixtures/BiliCDN_TW_1.5.5.user.js，SHA-256 fccf8ca10c9086b8edae3ba9b170b14ff5c92451ccd921c5834960e5624b441f。
- 原始碼 src；目前候選交付 Release/v1.7.0；暫存 dist。
- 本機封裝、雙 patch、乾淨 checkout 及兩套 verify 已通過。正式掃描執行已完成、0 findings，但封存 coverage 保留兩筆早期進行中紀錄而仍為 partial；不得稱完整安全驗收。2026-09-11 使用者明確指示推送並正式發布 v1.6.0，見 TEST_REPORT 與公開安全摘要。

runtime 持有 generation，playback 持有 epoch／registry，transport 持有單次請求終態，routing 保留健康／處分及 Watchdog 回收來源區別。所有實例由主入口建立，import 不讀 GM／DOM 或啟動網路。v1.7.0 不讀取或覆寫 `unsafeWindow.Worker`，也不建立 Worker 用 Blob、MessageChannel、listener 或 timer。

保留既有驗證意義；v1.6.3 Worker 測試作為不可變歷史重現，v1.7.0 的 CS-003 驗收改為確認攻擊面不存在。測試 getter 只存在 dist test entry，不能發布。

2026-09-11 實機探索發現控制中心的 CDN 選路「取消」沿用通用 close 行為，會終止整個操作 session。v1.6.0 已改為子頁返回、操作後回到父畫面、診斷複製不關窗；v1.7.0 移除進階頁面並把 Verbose 併入診斷畫面。

2026-09-12 v1.6.3 首次 Codex Security 差異掃描回報兩項 Low：可被頁面預先替換的 Worker constructor，以及原始 Worker 在 bootstrap 前執行造成 MessagePort 原型污染。修補後改從隔離 realm 捕捉原生 Worker，原始 classic／module code 延後至 authenticated bootstrap，並綁定原生私有通道方法；最終掃描結果以 v1.6.3 TEST_REPORT 為準。

使用者不打算閱讀診斷，複製報告主要協助後續分析。保持單一控制中心，不恢復 page mutator 或 console 控制。

公開 repo：YUIAOI7592/BiliCDN_TW。不設 CI/CD，不自動發布。提交訊息依使用者要求附執行當下實際顯示的模型／推理強度；原作者 MIT 歸屬不變。

延後頻寬算法替換、跨分頁 GM 原子協調與跨播放器辨識。能力 good 不證明硬體解碼或 2x 流暢；實機驗收仍需使用者執行。

本機歷代 Release、baseline、archive、development 保留原樣；公開開發與測試不依賴未上傳的封存。
