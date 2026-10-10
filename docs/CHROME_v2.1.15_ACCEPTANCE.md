# v2.1.15 Chrome／Tampermonkey 安裝驗收 — 2026-10-10

本文件記錄 BR-07 發布後的實際安裝版結果。**完整 v2.1.15 本體／唯一 singleton 已核對，Auto 1／2 倍取得部分通過；續測確認 P2 [BR-08 進度列外層拖曳漏辨](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 尚未修復，完整 BR-01 未結案。** 依計畫「新問題並詳細報告」條件收尾，沒有擴修。 [修復與來源隔離](BR07_FIX_REPORT.md)、[最新版發行驗證](TEST_REPORT.md) 與本文件分列；v2.1.14 的 [原缺陷](CHROME_v2.1.14_BR07_KEYUP_SEEK.md)／[安裝紀錄](CHROME_v2.1.14_ACCEPTANCE.md) 保留原始結果。

## 身分與執行邊界

- 只使用指定風景影片 `https://www.bilibili.com/video/BV1tFZZBQE57/`；Auto 為主，1／2 倍分開。不切片、不鎖畫質、不改 Chrome 設定或停用其他腳本。
- v2.1.15 於 2026-10-10T10:57:18Z 發布，來源／peeled tag `3f7c73335a58dd89d4bc8a4209b7ecf3c70acaf8`；唯一腳本 **317,487 bytes**，SHA-256 `affedbeef854462c60fd5fd68947fc4c37ef7ddb7bd2922e72fed6cca6b342bf`。10:57:38Z 公開 latest 無登入讀回一致。
- **更新前中途觀察：** 10:59:19Z fresh scriptParsed／context 完整本體比對 v2.1.14=true、v2.1.15=false，證據 `installed/update-prerequisite.json`。工具禁止擴充介面，由使用者手動更新；當時 Auto 2 倍／約 1269 秒播放及暫停 1352.24 秒只為舊版交接，不計新版通過。
- **更新後實際身分：** 2026-10-10T11:04:00.468Z，指定同片重新取得 script51／context2，完整 Release v2.1.15 body 匹配=true、singletonCount=1，大小／SHA-256 與上述公開產物一致，見 `installed/identity-v2.1.15.json`。每次重新連線重新取得身分，不沿用舊 remote object。
- 來源隔離 **40／40 有效案例**及 Node 正式模型另列；自有 iframe 不代替實際網站。原生 auto-repeat 未證明，IME／nested／媒體或播放器替換的完整 Chrome 矩陣未宣稱完成。

## BR-07 與 BR-01 矩陣

| 場景 | 1 倍 | 2 倍 | 有效結果與限制 |
| --- | --- | --- | --- |
| 公開更新產物、完整 body／singleton | 通過（同一產物） | 通過（同一產物） | v2.1.15、317,487 bytes／SHA-256 完全匹配，singleton 1 |
| BODY／播放器 Right／Left 新修訂 | 通過 | 通過 | 四次可信操作各 +1：4→8／10→14；Right keyup、Left keydown 與先前原生校準一致，本次 capture 不額外量測網站 handler 內精確提交位置 |
| 正常播放／暫停恢復／短 seek | 部分通過 | 通過（列明範圍） | 兩種倍速都有實際時間／影格前進，無備援或重載；1 倍最後 player Left 保存時仍 seeking，不補算該次 settled |
| 故障舊段後新 Right 寬限 | 新 15 秒通過 | 新 15／30 秒通過 | 新 keyup 後 15.427／15.310 秒各一次備援；2 倍 30.309 秒一次自有重載；新目標有效 |
| 約 12 秒 video-only 延遲 | 通過（列明範圍） | 通過（列明範圍） | seek→release 12.075／12.169 秒，首次有效進度 17.863／21.985 秒；各一次備援、核心重載 0、audio 通行；不宣稱 15 秒前恢復 |
| 完整 15／30／重載後 15 秒 | 未形成完整窗口 | 15／30 通過，後 15 秒待驗收 | 1 倍網站提前外部換核心／paused；2 倍重載後 paused／核心空值，完整 15 秒無進度 failed／釋放及不重試前提未成立 |
| 新操作與進度拖曳所有權 | 剩餘邊界待驗收 | **BR-08 失敗，未修復** | wrapper 真實按住 15.079 秒誤觸備援；inner 同類故障按住超過 16 秒無動作。pointercancel、失去捕捉、近 0／重載前後操作未全部完成 |
| 實際 SDK 晚到完成／拒絕 | 待驗收 | 前提未成立 | 網站在腳本重載前換核心／paused，沒有實際方法 return 被延後；僅證明撤銷，不能算晚到矩陣通過 |
| 真正背景與返回 | 待驗收 | 前提未成立 | 387 採樣 nativeHidden=false／Runtime visible=true，沒有 visibilitychange；只證明前景播放 |
| 生命週期／政策／影音隔離 | 待驗收 | 待驗收 | 尚缺本版完整的失效／audio fallback 不啟動影片恢復／有效 video 救援交錯 |
| BR-02～05 安裝交叉回歸 | BR-02 子集通過（非倍速情境） | 同左；其餘待驗收 | Blob／native 及精確本地 HTTPDNS 拒絕所有權通過；BR-03 及真正共用 gate BR-04／05 未形成，startup.state=skipped、reason=preflight-skipped:xhr-explicit-timeout、candidates=0、delayed=false |

約 12 秒兩輪釋放後仍有網站／網路等待，因此各一次 video fallback 符合超過 15 秒仍無進度的政策；不能寫成「沒有備援」或「15 秒前恢復」。1 倍最後 recovery 標籤仍 play-intent，2 倍為 recovered；實際進度與標籤分列。Auto 正常由 4K 降 1080P 不列缺陷，重載時 qualitySelected=null 不表示鎖畫質。

故障中新 Right 1 倍於第一個失效採樣 19.902 秒已外部換核心／paused，沒有腳本重載；2 倍自有重載後第一個採樣已 paused，兩者僅支持列明期限及撤銷。網站提前 pause／error／外部換核心不計完整重載後 15 秒退出，沒有新前提不重複同一失效窗口。

## 新 BR-08 與正常反證

實際 hitbox 為 **10 px** 的 `.bpx-player-progress-wrap` 外層，內層 `.bpx-player-progress` 為 **4 px**。外圈仍執行網站合法 seek，但腳本拖曳 selector 漏掉 wrapper，可信 pointerdown 更新 userRevision 卻維持 dragging=false。Auto 2 倍 video-only 窗口中，未釋放的有效手勢內 **15.079 秒**出現一次 video fallback，前後 paused／error=false、內容／媒體／核心身分有效、真正前景。

同類 inner 故障對照由可信 pointerdown 取得 dragging=true，連續有效定期採樣至少 **16.388 秒**仍按住而沒有 route／core 動作；真 pointerup 後回 false。後段網站外部換核心不能抹除已成立的外層備援，也不能補算現場 30 秒重載。

[詳細 BR-08 報告](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 包含原始事件順序、位置、根因及修復方向。私有 `installed/review-br08/` 七正確契約 **3 fail／4 pass、exit 1**，私有完整型別檢查通過；來源前後 hash 相同、未登記正式套件。這些預期失敗是新缺陷證據，與發布前 **574 正式通過**分列；30 秒拖曳重載只由模型重現，現場未形成有效窗口。本輪不修 runtime、不再升版或重發。

## XHR 與未成立前提

`blob-failed-open-v215.json` 的 20 有效對照與 1 guard 尚未就緒觀察分開；`httpdns-failed-open-v215.json` 重跑同 20 並增加 5 本地終止所有權觀察，不能加總成 46 個獨立通過。原生／安裝 hook 的例外與狀態一致：無效 method／禁止 method／無效 URL 為 1→1，同步 timeout 限制在此 Chrome 兩者皆 1→0，metadata 保留。已送出 Blob default／text／json 完整收到 2→3→4、load／loadend，json responseText 仍按原生拋錯。

精確送出前 guard 先安裝，本地 failed reopen 保持 DONE4／status0，一次 readystatechange→error→loadend；第二次 send 拋 InvalidStateError。成功 reopen 只保留舊 readystatechange，其後舊 error／loadend 被所有權檢查停止。此為 BR-02 相容子集，不能替代 cid／BR-03、BR-04 上限或 BR-05 原因的真實共用 gate 證據。

背景讀保存的原生 hidden getter，不能以腳本維持 visible 的字串判定真正前景。SDK 候選只控制自有回傳邊界；實際方法未到達前網站已換核心，沒有把空 records／held=0 當作晚到完成通過，也未替換媒體 getter或控制器製造證據。

## 故障窗口、清理與交接

每個故障窗口使用新單一 Fetch／Network 游標，先精確攔截當前 video、audio 通行。列明的有效窗口連續處理事件並核對 hasMore／truncated／dropped；更晚 `tail-before-BR08-inner-fault.json` Network 截斷只作後續自然播放／對帳輔助，不作完整逾時證據。

受控 IDs 過濾保留到晚到結果收尾，未清除使用者既有學習資料。最終 `installed/final-cleanup.json` 核對：

- 累積 **107** 受控 IDs，清理前後記憶體／schema 2 持久樣本匹配皆 **0**；相符活 XHR 為空。19 份 observer JSON 保存 98 starts／96 completions（93 abort、3 success），11 IDs 缺 completion（9 無 start、2 有 start）；這些歷史捕捉缺口保留，不能宣稱 107／107 傳輸完成，最後空值也不重建舊事件。
- held requests **0**、Fetch patterns 清空；自有 observer／pointer／SDK API 已移除，send／證據記錄包裝已還原，自有 iframe **0**。
- Network／Debugger／Runtime 觀察關閉；SDK 自有 wrapper 的還原另有 readback。補充 sdk-inherited-descriptor-cleanup.json 清掉先前工具草稿建立的繼承方法遮蔽，hasOwnReload=false、reload 與同一原型一致；這是工具清理，沒有列為產品缺陷或覆寫其他腳本所有權。
- 清理前同片 Auto 2 倍正常進度 **1979.88 秒／35714 frames**；最後透過網站原生控制交接為 **Auto 1 倍、暫停 2042.773843 秒**，截圖 `installed/final-Auto-landscape.png`。

證據根目錄 `.work/functional-fixes/br07/2026-10-10-9d98d09/`，原始 JSON、獨立複核、私有失敗契約及最終清理分列。**本輪完成新缺陷報告及收尾，完整 BR-01 安裝驗收未完成。** 原 87.785 秒自然網路起因與其他產品驗收獨立保留。
