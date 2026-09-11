# 專案交接脈絡

目前模組化正式版 v1.6.0，來源為正式 v1.5.5，不使用 development 草稿。最後 timeout capability、最小 bytes／elapsed／間隔與重複 send 修補均保留。

- 上游：baseline/BiliCDN_TW_1.3.4.original.user.js，SHA-256 acaa3d61c169a0a39ef403d7442e1decc1b20540ea9ada3e8cf5e459bb88f579。
- 重構基準：tests/fixtures/BiliCDN_TW_1.5.5.user.js，SHA-256 fccf8ca10c9086b8edae3ba9b170b14ff5c92451ccd921c5834960e5624b441f。
- 原始碼 src；本機交付 Release/v1.6.0；暫存 dist。
- 本機封裝、雙 patch、乾淨 checkout 及兩套 verify 已通過。正式掃描執行已完成、0 findings，但封存 coverage 保留兩筆早期進行中紀錄而仍為 partial；不得稱完整安全驗收。2026-09-11 使用者明確指示推送並正式發布 v1.6.0，見 TEST_REPORT 與公開安全摘要。

本輪只改模組結構與本機工具。runtime 持有 generation，playback 持有 epoch／registry，transport 持有單次請求終態，routing 保留健康／處分及 Watchdog 回收來源區別。所有实例由主入口建立，import 不讀 GM／Worker／DOM 或啟動網路。

保留既有 230 項驗證意義；新增 18 項模組／未插樁產物驗收及額外歷史 review 9 項。目前 257 項無 skip。CS 子集 19 項不另加總。測試 getter 只存在 dist test entry，不能發布。

2026-09-11 實機探索發現控制中心的 CDN 選路「取消」沿用通用 close 行為，會終止整個操作 session。v1.6.0 已改為子頁返回、操作後回到父畫面、診斷複製不關窗；重新安裝後已實機確認 CDN 選路、診斷、節點維護、進階／Worker 統計往返、診斷複製及 Escape 關閉。

使用者不打算閱讀診斷，複製報告主要協助後續分析。保持單一控制中心，不恢復 page mutator、console 控制或普通 Worker policy。

公開 repo：YUIAOI7592/BiliCDN_TW。不設 CI/CD，不自動發布。提交訊息依使用者要求附實際模型／推理強度，本輪 Daybreak Blue xhigh；原作者 MIT 歸屬不變。

延後頻寬算法替換、跨分頁 GM 原子協調、跨播放器辨識、Worker 協定擴充。能力 good 不证明硬體解碼或 2x 流暢；實機驗收仍需使用者執行。

本機歷代 Release、baseline、archive、development 保留原樣；公開開發與測試不依賴未上傳的封存。
