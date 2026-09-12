# 專案交接脈絡

目前交付為 v1.8.4，以不可變 v1.8.3（SHA-256 a55b80eb3d23cf9c15145399978b532117c2b2bce5205615a8d2d7d1ebcac4f6）為基準。頁面候選被改寫到 Catalog 後，成功終態會以獨立的 Catalog 證據建立 representation，不解鎖原始 Native URL；Watchdog recovery affinity 會實際約束後續相同請求直到 epoch 改變。v1.8.3 的共用 host-access 禁止效力保持不變。

本版依使用者要求不執行 Code Security 掃描或獨立安全子集；必要功能回歸、封裝與實機狀態分開記錄於 TEST_REPORT。v1.8.3 實機已重現 Native 相同 Range 反覆交付但 buffer／影格不前進，以及 Catalog 成功播放仍無 representation 歸因；v1.8.4 修正 recovery 不生效與改寫 provenance 失聯，仍須使用者更新後重測真實影片。

- 上游：baseline/BiliCDN_TW_1.3.4.original.user.js，SHA-256 acaa3d61c169a0a39ef403d7442e1decc1b20540ea9ada3e8cf5e459bb88f579。
- 重構基準：tests/fixtures/BiliCDN_TW_1.5.5.user.js，SHA-256 fccf8ca10c9086b8edae3ba9b170b14ff5c92451ccd921c5834960e5624b441f。
- 原始碼 src；目前交付 Release/v1.8.4；暫存 dist。功能驗收狀態見本版 TEST_REPORT，不以舊版通過狀態代替。
- v1.8.0 已由 v1.8.1 取代；v1.8.1 的正式 Codex Security 差異掃描狀態以本版 TEST_REPORT 為準，掃描不等於 Chrome／Tampermonkey 實機播放驗證。

runtime 持有 generation，playback 持有 epoch／registry，transport 持有單次請求終態，routing 保留 catalog health、Native host-only Ledger、Route Affinity、處分及 Watchdog 回收來源區別。完整 signed URL 只在目前 epoch 的 route group 中存在；新 epoch、SPA、停用或重啟即清除。健康 probe 不能改 Route Affinity；真實 Transport／Watchdog recovery 才能開啟換線邊界。所有實例由主入口建立，import 不讀 GM／DOM 或啟動網路。v1.7.0 起不讀取或覆寫 `unsafeWindow.Worker`。

保留既有驗證意義；v1.8.1 新增健康 probe 僅評級、連續 representation 證據、合法 recovery boundary、跨畫質 exact Native affinity、缺少 exact Native 時 Catalog 降級及 `__playinfo__` 隔離案例。v1.6.3 Worker 測試仍作不可變歷史重現，CS-003 驗收確認攻擊面不存在。測試 getter 只存在 dist test entry，不能發布。

2026-09-11 實機探索發現控制中心的 CDN 選路「取消」沿用通用 close 行為，會終止整個操作 session。v1.6.0 已改為子頁返回、操作後回到父畫面、診斷複製不關窗；v1.7.0 移除進階頁面並把 Verbose 併入診斷畫面。

2026-09-12 v1.6.3 首次 Codex Security 差異掃描回報兩項 Low：可被頁面預先替換的 Worker constructor，以及原始 Worker 在 bootstrap 前執行造成 MessagePort 原型污染。修補後改從隔離 realm 捕捉原生 Worker，原始 classic／module code 延後至 authenticated bootstrap，並綁定原生私有通道方法；最終掃描結果以 v1.6.3 TEST_REPORT 為準。

使用者不打算閱讀診斷，複製報告主要協助後續分析。保持單一控制中心，不恢復 page mutator 或 console 控制。

公開 repo：YUIAOI7592/BiliCDN_TW。不設 CI/CD，不自動發布。提交訊息依使用者要求附執行當下實際顯示的模型／推理強度；原作者 MIT 歸屬不變。

延後頻寬算法替換、跨分頁 GM 原子協調與跨播放器辨識。能力 good 不證明硬體解碼或 2x 流暢；實機驗收仍需使用者執行。

本機歷代 Release、baseline、archive、development 保留原樣；公開開發與測試不依賴未上傳的封存。
