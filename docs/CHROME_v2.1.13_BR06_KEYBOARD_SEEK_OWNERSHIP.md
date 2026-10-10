# BR-06：頁面鍵盤 seek 沿用舊救援期限 — v2.1.13／2026-10-10

**已在實際 Chrome／Tampermonkey v2.1.13 重現，未修復，建議 P2。** Auto 影片停滯時，頁面 BODY 焦點下的可信方向鍵可以成功尋位，但 PlayerAdapter 沒有把它辨識為新的使用者操作。新 seek 因而沿用上一段停滯期限；1 倍／2 倍的獨立窗口分別在新操作後 **8.205／6.986 秒**觸發 video 備援，違反「新使用者 seek 重新取得 15 秒寬限」的契約。

本次已達成「找到可重現問題並撰寫詳細報告」的自主測試退出條件。**BR-01 完整安裝版驗收未通過**；既有 A／B／C 修復、v2.1.13 發布及先前有效證據保持原範圍。這不是原 87.785 秒自然網路起因的定位，也沒有現場證據證明新目標被舊位置覆寫或核心提前重載。

## 基準與可信度

- 開始基準：main 45a442071c93f20fa7aeb7dcecfb67c6ba66f526，工作目錄乾淨；執行期來源／v2.1.13 標籤為 fc2b3b5ed58e307d8c87e2326769cfa8a390cf46。
- 實際執行的 Debugger source 完整包含發布腳本 body，ControlCenter singleton 一個；同片重新載入後再次核對。腳本 314,188 bytes，SHA-256 646515874ea4088b11830907826c5d1275f823c155a5fb1523999a9755ffa816。
- 2026-10-10 約 13:45–13:57（Asia/Taipei）續測。唯一影片為 [使用者指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 選取，1／2 倍分開確認。沒有操作畫質、修改 ABR／Chrome 設定或停用其他腳本。Auto 降到 720P 是正常調整，不列缺陷。
- 觀察的是實際安裝的 PlayerAdapter、PlayerMonitor、RecoveryController、RouteCoordinator，沒有替換控制器或媒體 getter。鍵盤事件的 `isTrusted=true`、`target=BODY` 是現場事件紀錄；Node 替身不代替這項證據。

## 事件順序與實際結果

先建立正常時間／影格前進基準，安裝精確、非 Document 的 Request-stage 攔截，再用進度列 seek 到未緩衝位置。只延遲當前 Vault 可歸因的 video 請求，audio 與其他請求立即放行。約 8 秒後發出新的可信 ArrowRight，網站實際將目標再向前移 5 秒。

| 窗口 | 新操作前 → 後 | 使用者／seek 修訂 | 新鍵盤操作至備援 | 結果 |
| --- | --- | --- | --- | --- |
| Auto 1 倍 | 2542 → 2547 秒 | user 4 → 4；seek 7 → 8 | 8.205 秒 | 一次 video 備援，零核心重載；未取得新 15 秒寬限 |
| Auto 2 倍 | 469.320388 → 474.320388 秒 | user 8 → 8；seek 15 → 16 | 6.986 秒 | 一次 video 備援，零核心重載；同一缺陷獨立重現 |
| Auto 1 倍滑鼠對照 | 2933 → 3126.101941 秒 | user 5 → 6；seek 11 → 12 | 觀察約 14.3 秒 | 無備援／重載，仍為 seek-grace；新的寬限成立 |

1 倍的可信 keydown 時刻為 1791611429644，備援為 1791611437849；2 倍為 1791611603863／1791611610849。這是實際事件時間差，不冒充私有停滯起點或 FakeClock 邊界。產品一秒 tick 的相位無法解釋少掉約 7–8 秒的新寬限。

兩個鍵盤窗口分別持有 7／9 個 video 請求，各有 4 個 audio 攔截即時放行；滑鼠對照持有 8 個 video、4 個 audio 放行。三個窗口所有採樣保持指定速率、Auto、epoch 0、可見且未 paused／mediaError；Fetch／Network 單一游標沒有截斷，觀察器沒有淘汰資料。放行後均恢復真實時間及影格進度，最新位置沒有被初始 seek 目標蓋回。

**預期：** 確實造成新 seek 的可信使用者鍵盤命令，應撤銷舊還原並開始新的停滯段；新段未滿 15 秒不備援，未滿 30 秒不重載。

**實際：** seekRevision 已更新、舊動作可撤銷，但 userRevision 未更新，因此舊 startedAt 與已用額度仍保留，新目標過早進入救援。

## 根因與可達入口

1. [player.ts:63–75](../src-v2/adapters/player.ts) 的 keydown 監聽要求 `region.contains(event.target)`。BODY 不屬播放器區域，所以第 73 行提早 return，沒有增加 userRevision。事件可信且屬支援的 ArrowRight 仍被排除。
2. 網站的頁面鍵盤處理實際尋位；[player.ts:76–100](../src-v2/adapters/player.ts) 的媒體觀察／site.seek 包裝只更新 seekRevision 與 targetSec，不能補上缺失的使用者身分。
3. [player-monitor.ts:163–180](../src-v2/application/player-monitor.ts) 只在 userRevision／mediaId 改變時結束舊段。單獨 seekRevision 改變走 rebound 分支：撤銷舊 token、綁定最新目標，但保留 startedAt 及 fallbackAttempted。這對網站／Auto 自行調整是正確設計，對被錯分的使用者快捷鍵則導致提早救援。

可達入口就是網站支援的 BODY／頁面焦點方向鍵 seek；不依賴修改設定或不合法路線。本輪保留其他腳本的實際環境，沒有對網站快捷鍵的提供者作超出證據的歸因。

既有 [控制器回歸](../tests-v2/regressions/functional-races/br01.ts) 直接注入已增加的 userRevision，因此新 seek 測試通過；[適配器回歸](../tests-v2/regressions/functional-races/br01-player.ts) 未測可信 BODY keydown 與實際尋位的關聯。兩者之間的觀察缺口讓正式測試漏掉本問題。

## 獨立正確契約與重跑

證據存於 `.work/functional-review/br01-remaining/2026-10-10-45a4420/`，沒有覆寫先前調查／發布證據。keyboard-contracts.ts 使用真正 PlayerAdapter／PlayerMonitor／RecoveryController、FakeClock、testScope 與型別化事件邊界，表達正確契約；**2 fail／3 pass，退出碼 1**，不是整體通過，也沒有加入正式測試登記。

| 具名案例 | 未修改來源的結果 |
| --- | --- |
| BR-06 trusted page keyboard seek starts a new user revision | 失敗：預期 1，實際 0 |
| BR-06 trusted page keyboard seek receives a fresh 15000 ms grace period | 失敗：新操作後 7000 ms 預期零備援，實際一次 |
| BR-06 control: in-player keyboard seek receives fresh grace | 通過，14,999／15,000 ms 邊界成立 |
| BR-06 control: pointer seek receives fresh grace | 通過，14,999／15,000 ms 邊界成立 |
| BR-06 control: synthetic page key cannot extend an existing stall | 通過，不把合成事件當新使用者命令 |

```powershell
node .work/functional-review/br01-remaining/2026-10-10-45a4420/run-contracts.mjs
node .work/functional-review/br01-remaining/2026-10-10-45a4420/analyze.mjs
node node_modules/typescript/bin/tsc --noEmit -p .work/functional-review/br01-remaining/2026-10-10-45a4420/tsconfig.json
```

第一條應退出 1 並保留兩個正確契約失敗；第二條檢查已保存的現場窗口、身分、控制與清理證據，不代表重新執行 Chrome 或全矩陣通過。獨立契約型別檢查通過。既有正式 BR-01 application 22／22、adapter 4／4 本輪重跑通過；它們沒有覆蓋本缺陷，不作否定現場證據的理由。

## 最小修正方向與必要回歸

修復應在 PlayerAdapter 關聯「可信鍵盤意圖」與「確實發生的播放器命令」，以有界、短期狀態補上 userRevision。頁面焦點不能被一律排除，但也不能讓任意頁面按鍵或輸入框操作重設救援期限。

- 檢查支援鍵、可信來源、可見／當前播放器、editable／輸入法等排除條件；只有可關聯的實際 seek 才取得新的使用者操作身分。
- 保留 site.seek 的 receiver／參數／結果／例外、腳本還原來源標記、同步重入與清理所有權；相鄰鍵盤命令各自更新目標，不回寫舊位置。
- 不以「任何 seekRevision 改變都重新計時」代替，否則網站重試／Auto 調整會重新造成無限延長。不要僅刪掉 inRegion 而對所有可信鍵一律增加操作修訂。
- 正式回歸須補 BODY／播放器焦點、ArrowLeft／ArrowRight、連續新 seek、輸入框／未造成 seek 的鍵、合成事件、腳本自己的 seek、網站／Auto 目標調整、同步回呼及生命週期清理。
- 精確驗證每次有效新 seek 的 14,999／15,000 與 29,999／30,000 ms 邊界及新段額度；實際安裝版仍分開跑 Auto 1／2 倍，不能只靠注入 userRevision 的控制器案例。

## 證據限制、作廢與清理

初次 raw key 指令不受工具支援，video locator 的按鍵操作亦失敗；該校準輪已排除並清理。另一次 Vault.match 回傳層級用錯，零 video 請求被持有；它只可作正常鍵盤觀察，不能算故障重現。保留 installed-keyboard-control-calibration-invalid.json 與 installed-auto-1x-keyboard-seek.json，不混入三個有效窗口。後續使用 match.context 與支援的 body locator 按鍵，真正事件確認 trusted／BODY。

三個有效窗口的持有與事件處理在單一有界 pump 中連續進行，放行後立即清空攔截 patterns。所有受控 video request IDs 的 evidence.record 過濾保留到晚到完成；核對兩輪觀察器合計 62 個 owned IDs，在實際記憶體及 schema 2 持久資料中的命中均為 0，未清除使用者資料。最終採樣為 Auto 2 倍、readyState 4、時間與影格前進、無 mediaError／恢復 token；自有計時器、監聽器、訂閱及 send／evidence.record 包裝均清理，Network 停用、自建分頁關閉。

來源、正式測試、schema、版本及 Release 保持不變；沒有新增修復、安全掃描、封裝或發布宣稱。私有資料包含重跑入口、原始安全化事件、summary.json、contracts-result.txt、儲存／清理紀錄及 chrome-final-auto.png。

## 剩餘驗收

BR-06 修復前，新鍵盤操作所有權這一項不能標為通過。安裝版重載後完整 15 秒無進度退出／不重試、拖曳／pointercancel、故障中 pause／倍速、晚到 reload／play、真正 hidden 及其餘核心交錯仍按 [v2.1.13 安裝紀錄](CHROME_v2.1.13_ACCEPTANCE.md) 保留待驗收。原自然網路起因與其他完整產品驗收不因本次找到新缺陷結案。
