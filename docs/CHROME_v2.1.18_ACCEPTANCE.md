# Chrome／Tampermonkey v2.1.18 — BR-09

日期 2026-10-11（Asia/Taipei）。只使用指定 [風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，保留 Auto，不改 Chrome 設定或停用其他腳本。

## 來源隔離：通過

Chrome 原生媒體及 WAV Blob、自有 iframe；SDK／核心／Clock 為受控模型。沒有替換原生媒體 getter 或外送測試。最終 `chrome-source-rates.json` 明確核對 native playbackRate=1／2；較早未设 defaultPlaybackRate 的校準紀錄保留。

| 原生來源案例 | 1 倍 | 2 倍 | 實際結果 |
| --- | --- | --- | --- |
| reload 未初始化後未知正值→0 | 通過 | 通過 | 不呼叫舊 seek，最終 0 |
| reload 未初始化後未知正值 | 通過 | 通過 | 不呼叫舊 seek，最終 0.7 |
| 公用 seek 到 0 正常對照 | 通過 | 通過 | 保留 0，無重複修訂 |
| 未改變 reload 目標正常對照 | 通過 | 通過 | 原還原正常執行一次，0.25 |

原生邊界另 4／4：native HAVE_NOTHING 無 seeking 的未知位置及零取得 seek 修訂但 userRevision=0、正常 reload 初始零與公用來源保持。共八個恢復案例＋四項邊界通過，不加進741個Node正式案例數。

清理：自有 iframe 已移除、影片／Blob 釋放，沒有 CDN 探測、學習寫入或永久攔截。SDK／FakeClock 成果不算安裝 singleton 故障窗口。

## 實際安裝：不通過（版本前提）

最近核對 **2026-10-10T19:02:29.710Z**，指定影片完整 IIFE 仍與 v2.1.17 發行本體一致，runtimeChars=326325、matchingScripts=1；尚未实际載入 v2.1.18，不能開始計新版通過。發布／公開產物核對見 [TEST_REPORT](TEST_REPORT.md)。

本輪不復寫 [BR-01 v2.1.17 整體不通過矩陣](BR01_v2.1.17_FINAL_ACCEPTANCE.md)。下一次只在實際新版載入後驗證 BR-09 可達窗口及 Auto1／2 基本播放、暫停、seek；沒有完整原生歸因的網站位置回退，不強行指稱為本缺陷。原自然網路起因不因修補而結案。
