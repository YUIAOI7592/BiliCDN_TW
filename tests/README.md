# 測試說明

使用 Node 內建 `node:test`、`vm`，無第三方依賴。**目前所有新版驗收 target 均為 v1.5.5**；由 `harness/current-script.js` 統一選擇。開發可用 `BILICDN_TEST_TARGET` 指定候選檔，verify 會明確固定正式輸出。舊版本檔名與測試標題表示該組來源，不表示新版驗收還在測舊版；固定歷史重現仍載入原基準。

- `stall-recovery-v155.test.js`：固定 v1.5.4 SHA、timeout 未修復與 breaker 清掉後來網路處分的重現；實際包裝 XHR/native 模擬事件、128 KiB／3 秒 timeout 證據、同 host 30 秒限制、200/206 metadata、單次終態、listener 清理、repeated send/open、epoch/reuse/取消/seek、無 DNS 推論、音訊/unknown/non-catalog、breaker 保留真實失敗及本波 snapshot 撤銷、影片請求換 host 計數、後續實際狀態、緊急測速冷卻，以及與 v1.5.4 相同的 250 秒健康 2x trace。

- `verbose-v154.test.js`：固定 v1.5.3 SHA／三項重現；可信選單、GM read/write/readback、事件及 pending 上限／TTL／去敏／合併、實際 Fetch/XHR（含直接 abort/reuse）、host-lock、舊 epoch、合成事件、Console 失敗；readyState 與 grace/attribution/breaker、恢復觀察；v1.5.3／新版本 Verbose 關與開的 250 秒非零測速 trace。

- `media-attribution-v153.test.js`：v1.5.2 SHA 與錯誤音訊歸因重現，video/audio/FLAC/Dolby/muxed/unknown、registry 上限、並行、epoch、Fetch/XHR/PerformanceObserver、Watchdog 處罰來源及 250 秒雙 CDN 2x/seek 對比。
- `codec-ui-v153.test.js`：v1.5.2 固定 30fps 與跨 view 焦點問題重現，實際配置、2 pending/128 cache/single-flight、能力拒絕/晚到/無效欄位、auto 原序、掉幀、焦點循環、移除元素及遲到 clipboard。

- `functional-v152.test.js`：固定 v1.5.1 SHA、舊版 R1/R3/R5/R6 重現、共用 URL 守門、root-original、測速門檻與時鐘。
- `lifecycle-v152.test.js`：實際 Fetch/XHR/Worker 入口、長度邊界、延遲 body／getter／重複 open、取消交錯、單次採樣、跨分頁到期、無面板快照，以及推進超過 240 秒的兩倍速正常播放對比。
- `functional-v151.test.js`：固定 v1.5.0 重現；PCDN 分級、直播／resource、partial sample、候選公平性、單一控制中心。
- `functional-v144.test.js`：固定 v1.4.3 重現；可信 UI、偽造事件、capability、toast、clipboard fallback、SPA／停用；對話框元件級焦點持續回歸，完整跨 view 案例在 v153 測試。
- `functional-v143.test.js`：固定 v1.4.2 重現；runtime、2x bakeoff、representation、catalog override、checkbox、history、visibility、HTTPDNS、health merge 與 Web Locks。
- `playback-codec-v142.test.js`：固定 v1.4.1 重現；2x 回退、ratechange、SPA、Watchdog、AV1/HEVC/AVC。
- `upstream-v134-compat.test.js`：官方 v1.3.4 缺口固定重現及新增頁型、fail-open、HTTPDNS 503、XHR JSON、SPA identity、取消及參數不變量。
- `regression-core.test.js`：Fetch/XHR、host-lock、PCDN、contiguous buffer、停用與網路次數。
- `security-cs001/002/003.test.js`：控制面／catalog、console／transport、Worker 私有 policy／有限 stats。
- `harness/userscript-vm.js`：GM/DOM/closed Shadow/可信與合成事件/Fetch/XHR/Worker/video/codec/共享 GM mock。原 `runTimers` 保留；`advanceAsync(ms)` 依到期順序執行 timer，清空微任務，涵蓋重入、取消和 interval，並設失控上限。

執行：

```powershell
node --test tests\*.test.js
node --test tests\security-cs001.test.js tests\security-cs002.test.js tests\security-cs003.test.js
node --test review\2026-09-08-v151\reproduce.test.cjs
```

完整測試 230 項（既有 200＋新增 30，含子案例與固定舊版重現）；獨立 CS 子集 19 項包含在完整測試內，不重複加總。review 的 9 項只證明固定 v1.5.1 問題可重現，不代表新版本仍有 R7。

`scripts/verify.ps1`、`verify.sh` 預設驗證 v1.5.5：syntax、全部測試、CS 子集、incremental/cumulative patch 及 SHA-256。

所有結果都是靜態／VM/mock，不是真實 Chrome/Tampermonkey、CDN CORS/Range 或顯卡硬解驗證。
