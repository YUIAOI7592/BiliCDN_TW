# v1.9.5 功能驗證報告

## 基準與範圍

不可變 v1.9.4 Git commit：`00e228af1484ac526bebc7163c2cff11485e6772`；userscript SHA-256：`3ba990b2bf5f00409a7e8e8dda27e4a10046ecb5734b512b3b470e098067255c`。工具鏈：Node 26.8.1、npm 11.19.0、esbuild 0.28.2。

本版只修正 Native 音訊失敗後被重新選回及其後 DASH core 永久黑屏的恢復路徑；不加入「首次沿用上次 CDN」，不調整 CDN 清單、路由評分、2x、AV1、測速預算或黑名單規則。

## 自動功能驗證

- 固定重現影片使用 Catalog、音訊使用 Native Akamai，音訊發生真實 XHR network error 後下一筆同 group 請求又回到 Akamai的故障。
- 下一筆音訊請求保留 representation 的 exact path／query，只將 host 改為合格 Catalog；影片 Route Affinity、影片觀察與影片 host 不變。
- soft block、invalid 及同媒體種類 recovery avoid 會約束 exact original、current Native、backup 與 probe；來源驗證仍可在 soft block 建立後完成失敗歸因。
- audio／video avoid 分離；同 host 的 audio 失敗不連坐 video。Native probe 403 不建立 fallback 或核心恢復 token。
- fallback 後正常影片進展會取消核心重建；只有 core initialized=false、MPD 仍有影片 group且死核心形狀維持四秒時只呼叫一次 reload，並恢復 349.434 秒、2x 與播放意圖。
- 初次起播、paused、seek、ended、media error、舊 epoch、缺少 fallback及缺少 core initialized 強證據均不觸發 route-failure reload。
- 完整功能回歸：371 項通過，0 失敗，0 skip。
- `node --check`、可重現建置、封裝、incremental／cumulative patch 套用與 SHA-256 由 `npm run verify` 驗證。
- 依使用者要求，不執行 Code Security 掃描或獨立安全子集。

## 真實 Chrome／Tampermonkey

本輪未在網站端強制造成 Akamai 音訊故障，因此「實機故障注入」未完成，不宣稱已在真實 Chrome 重現該 CDN failure。正常播放、背景切換、seek、SPA 與暫停恢復仍需在安裝 v1.9.5 後驗收；自動 harness、靜態檢查與實機結果分開記錄。
