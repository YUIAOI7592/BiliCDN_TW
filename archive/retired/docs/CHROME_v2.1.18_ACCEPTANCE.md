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

## 實際安裝身分與正常基本回歸：通過

發布後首輪 **2026-10-10T19:14:49.220Z** 完整 IIFE 仍與 v2.1.17 相符的版本不通過紀錄保留。使用者更新後，原自有分頁已不存在，重新開啟同一指定 URL（沒有換影片）。**2026-10-10T19:17:48.347Z** 實際 v2.1.18 完整 IIFE **328,497 字元**與 Release body 相符，matchingScripts=1、無 truncated／hasMore。唯讀 Hook 閉包及 prototype 查詢確認 Runtime／ControlCenter／PlayerAdapter 各唯一 **1**，沒有增加公開橋接或替換控制器。

| 新版正常基本窗口 | 結果與範圍 |
| --- | --- |
| Auto1 播放 | 509.710318→534.540729，影格 23506→24995；rate1、正常 ready4 |
| Auto1 暫停／恢復 | 實際 SDK 與後續真正 UI 兩種入口均 observed paused=true→false；UI userRevision6→7 |
| Auto1 短 seek | 實際公用 SDK 目標539.589491，後續554.919589／影格26046，非 seeking／paused／error |
| Auto2 播放 | 555.370824→612.684845，影格26073→29508；rate2 |
| Auto2 暫停／恢復 | 真正 UI observed paused=true→false，userRevision4→5 |
| Auto2 短 seek | 實際公用 SDK 目標618.465845，後續670.280866／影格32718，非 seeking／paused／error |

各窗口 recovering=false、reloadCount=0；暫停後短暫 pause-armed 在後續有進度時回 healthy。1 倍初始設定由實際 SDK 完成，2 倍由 UI 選單，原 UI locator timeout 保留為工具問題。短 seek 非可信指標／鍵盤操作，不算故障中新操作矩陣。沒有網路故障注入、受控學習樣本、原生 getter 替換或控制器替身。公開 Release／latest 核對見 [TEST_REPORT](../../../docs/TEST_REPORT.md)。

最後 **2026-10-10T19:24:04.899Z** 正常 rate2／paused=false／ready4／時間773.678678、影格38914，recovery=healthy／reloadCount=0，還原測試前2倍。工具只建立 Debugger／remote object group，已 disable／release；沒有方法包裝、故障攔截、網站 Blob／iframe、timer 或訂閱待清，自有來源 iframe 讀回不存在。畫面 `installed-final-v218.png` 與 `installed-basic-auto1-auto2.json` 保存於本輪私有證據，不公開原生物件或 URL。

本輪不復寫 [BR-01 v2.1.17 整體不通過矩陣](BR01_v2.1.17_FINAL_ACCEPTANCE.md)，也沒有在網站 singleton 製造完整 BR-09 未初始化未知目標故障。因果修復由原生來源隔離證明，版本／正常網站回歸分列；沒有完整原生歸因的網站位置回退不強行指稱為本缺陷。原自然網路起因不因修補而結案。
