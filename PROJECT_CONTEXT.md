# 專案交接脈絡

目前模組化版本為 v1.6.3；本版在 v1.6.2 可觀測性基礎上，依使用者明確要求將 Worker 攔截預設改為啟用，以便實機蒐集需求證據，並修補頁面預先替換 Worker 與原始 Worker 原型污染兩個私有通道邊界。播放與 CDN 選路邏輯不變。來源仍為正式 v1.5.5，不使用 development 草稿。

- 上游：baseline/BiliCDN_TW_1.3.4.original.user.js，SHA-256 acaa3d61c169a0a39ef403d7442e1decc1b20540ea9ada3e8cf5e459bb88f579。
- 重構基準：tests/fixtures/BiliCDN_TW_1.5.5.user.js，SHA-256 fccf8ca10c9086b8edae3ba9b170b14ff5c92451ccd921c5834960e5624b441f。
- 原始碼 src；目前候選交付 Release/v1.6.3；暫存 dist。
- 本機封裝、雙 patch、乾淨 checkout 及兩套 verify 已通過。正式掃描執行已完成、0 findings，但封存 coverage 保留兩筆早期進行中紀錄而仍為 partial；不得稱完整安全驗收。2026-09-11 使用者明確指示推送並正式發布 v1.6.0，見 TEST_REPORT 與公開安全摘要。

本輪只改模組結構與本機工具。runtime 持有 generation，playback 持有 epoch／registry，transport 持有單次請求終態，routing 保留健康／處分及 Watchdog 回收來源區別。所有实例由主入口建立，import 不讀 GM／Worker／DOM 或啟動網路。

保留既有驗證意義；v1.6.3 增加預設啟用與明確 opt-out 驗收。CS 子集 19 項不另加總。測試 getter 只存在 dist test entry，不能發布。

2026-09-11 實機探索發現控制中心的 CDN 選路「取消」沿用通用 close 行為，會終止整個操作 session。v1.6.0 已改為子頁返回、操作後回到父畫面、診斷複製不關窗；重新安裝後已實機確認 CDN 選路、診斷、節點維護、進階／Worker 統計往返、診斷複製及 Escape 關閉。

2026-09-12 v1.6.3 首次 Codex Security 差異掃描回報兩項 Low：可被頁面預先替換的 Worker constructor，以及原始 Worker 在 bootstrap 前執行造成 MessagePort 原型污染。修補後改從隔離 realm 捕捉原生 Worker，原始 classic／module code 延後至 authenticated bootstrap，並綁定原生私有通道方法；最終掃描結果以 v1.6.3 TEST_REPORT 為準。

使用者不打算閱讀診斷，複製報告主要協助後續分析。保持單一控制中心，不恢復 page mutator、console 控制或普通 Worker policy。

公開 repo：YUIAOI7592/BiliCDN_TW。不設 CI/CD，不自動發布。提交訊息依使用者要求附執行當下實際顯示的模型／推理強度；原作者 MIT 歸屬不變。

延後頻寬算法替換、跨分頁 GM 原子協調與跨播放器辨識。Worker 自 v1.6.3 預設啟用；仍只使用固定 schema 的 ready 回報與本分頁／累計計數，不擴張控制能力。能力 good 不证明硬體解碼或 2x 流暢；實機驗收仍需使用者執行。

本機歷代 Release、baseline、archive、development 保留原樣；公開開發與測試不依賴未上傳的封存。
