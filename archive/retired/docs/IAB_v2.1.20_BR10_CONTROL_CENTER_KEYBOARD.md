# v2.1.20 IAB 第 6 輪：BR-10 控制中心鍵盤衝突

日期：2026-10-11。基準：`f8f6f87d89d158ecfcf4d6486bbd77598510fed0`，開始時工作目錄乾淨。現行範圍見 [TODO](../../../docs/TODO.md)，操作規則見 [IAB_TESTING](../../../docs/IAB_TESTING.md)。

**BR-10 已重現，尚未修復。** 控制中心內已聚焦的「CDN 與播放設定」按鈕，會受到頁面鍵盤處理干擾：Enter／空白鍵未啟動按鈕，Enter 還將焦點移到播放器彈幕輸入框。實際安裝版有失敗證據；未修改的控制中心來源在自有頁面也取得失敗與正常對照。

本輪只繼續 BR-01 以外的 P 項。BR-01 與原自然停滯原因保持跳過；既有通過案例沒有重測。依 TODO 的新缺陷規則，確認 BR-10 後清理並交付報告，沒有自行擴大成修復／發布。

## 判定與使用者影響

| 項目 | 判定 |
| --- | --- |
| 優先級 | P2：一般功能缺陷，影響控制中心的鍵盤操作及焦點隔離 |
| 觸發條件 | 控制中心開啟、按鈕已聚焦，同頁存在會處理 Enter／空白鍵的鍵盤監聽器 |
| 預期 | Enter／空白鍵啟動聚焦按鈕；進入「CDN 與播放設定」，焦點留在控制中心 |
| 安裝版實際結果 | 視窗停留總覽；兩種按鍵的 keydown 均從未取消變為已取消；Enter 將焦點移到 `.bpx-player-dm-input` |
| 直接影響 | 使用鍵盤無法沿該入口開啟設定；控制中心按鍵被頁面操作消費 |
| 未證實範圍 | 未判定滑鼠入口失效、資料遺失、所有控制元件失效或其他快捷鍵；沒有測試傳送彈幕 |
| 與 BR-01 關係 | UI 鍵盤事件隔離問題，不涉及 seek 救援期限或 BR-01 驗收 |

沒有停用其他腳本，也沒有將衝突歸罪於特定網站模組或第三方腳本。現場證據能確認事件被取消及焦點移出；尚未定位是哪個外部監聽器呼叫 `preventDefault()`。這不影響控制中心缺少鍵盤事件隔離的來源與隔離重現結論。

## 本輪範圍與沿用結果

| 範圍 | 本輪處理 |
| --- | --- |
| P01／P02 真正 startup gate | 沒有新前提，不重跑。唯一新影片文件的實際狀態仍是 `preflight-skipped:xhr-explicit-timeout`；沒有修改 timeout 或預算 |
| P03 同片 cid／epoch | 沿用第 5 輪通過結果，未重測 |
| P04 設定／儲存 | 沿用第 3 輪合併、GM 通知與命令結果；嘗試尚未完成的真實 UI 入口時發現 BR-10 |
| P04 關閉／切頁後晚到命令 | 未執行：未能進入設定，沒有呼叫或延後任何設定命令；不能把 BR-10 推論為過期回呼缺陷 |
| P05 完整 UI 診斷／複製 | 未執行：在同一控制中心入口發現缺陷後停止擴展；未呼叫完整 UI `buildReport` 或操作剪貼簿 |
| 已完成的 P05 子項 | 第 3 輪診斷讀取、第 4 輪格式及 hook 清理結果沿用 |

原先「封閉 Shadow DOM 缺操作能力」須限縮：本輪新增的原生 Tab／Enter／Space 能力校準通過，可以操作自有封閉 Shadow DOM；實際產品入口則因 BR-10 失敗。這不追溯改寫先前工具點擊失敗，也不以命令或來源頁代替安裝版 UI 驗收。

## 環境與產物身分

- 唯一瀏覽器：Codex 內建瀏覽器，IAB id 3。
- 唯一網站影片：[指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)。現場 Auto、2 倍速；這次 UI 缺陷不宣稱取得 1／2 倍播放矩陣。
- Tampermonkey 5.5.1，`GM_info.script.version` 為 2.1.20。
- 完整執行來源包含本機 Release 全文；Runtime／ControlCenter 各一個實例，身分事件沒有截斷。
- Release：336,219 bytes，SHA-256 `b8e5bd4744737537f348fcc7d9fb9f258fd41bc5e60327e5f4259560dcd5b54e`。
- 當次含 Tampermonkey 包裝的完整來源 SHA-256：`3166e946986388c1a8d21ce8e38f9c9c0f4b2305a9905996e8d12bc0cefa2ce1`。
- Node v26.8.1；只用於自有頁面建置、靜態型別及保存證據檢查，不另啟 headless 瀏覽器。

## 安裝版事件順序

1. 使用現有 `ControlCenter.show()` 開啟實際 singleton。這是觀察用的既有入口，不宣稱 Tampermonkey 選單點擊通過。
2. 原生 Tab 兩次；畫面白色焦點框位於「CDN 與播放設定」，外層 `document.activeElement` 是控制中心宿主。
3. 原生 Space：可信 keydown 在 window 捕捉階段 `defaultPrevented=false`；派送結束後為 `true`。keyup 沒有取消，焦點仍在控制中心，但沒有 click、畫面仍為總覽。
4. 重新開啟總覽並校準同一按鈕焦點，原生 Enter：可信 keydown 同樣由未取消變為已取消，派送後焦點移出控制中心。
5. 讀取焦點元素的 tag、class、placeholder，確認是播放器彈幕輸入框；沒有讀取或輸入其內容。

具因果觀察的 Space keydown 時間為 `1791726440061`，Enter keydown 為 `1791726440152`（epoch milliseconds）。兩者皆在捕捉時 `eventPhase=1`、派送後 `eventPhase=0`。在建立取消原因觀察器之前的入口探查也失敗，另保留於 UI 事件列；沒有把那些探查另算新的正式案例。

## 來源根因與測試缺口

基準來源位置：

| 位置 | 說明 |
| --- | --- |
| [control-center.ts:138](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f8f6f87d89d158ecfcf4d6486bbd77598510fed0/src-v2/ui/control-center.ts#L138) | 建立封閉 Shadow DOM 的事件邊界 |
| [control-center.ts:145](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f8f6f87d89d158ecfcf4d6486bbd77598510fed0/src-v2/ui/control-center.ts#L145) | 只在可信 Escape 呼叫 `preventDefault`／`stopPropagation`；Enter／Space 直接返回 |
| [control-center.ts:243](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f8f6f87d89d158ecfcf4d6486bbd77598510fed0/src-v2/ui/control-center.ts#L243) | 設定入口本來透過原生按鈕 click 進入設定視圖 |
| [control-center.ts:338](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f8f6f87d89d158ecfcf4d6486bbd77598510fed0/src-v2/ui/control-center.ts#L338) | 按鈕只在 click 階段停止事件；前面的 keydown 已被取消時，無法補救原生啟動 |
| [control-center 測試:20](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f8f6f87d89d158ecfcf4d6486bbd77598510fed0/tests-v2/suites/control-center.ts#L20) | 最小 DOM 明確不模擬原生焦點；`emit('click')` 直接呼叫監聽器，未涵蓋跨 shadow 的鍵盤派送與預設按鈕行為 |

封閉 Shadow DOM 不會自動阻止這些鍵盤事件傳至頁面。在頁面側，事件目標是宿主 div，頁面以 input／textarea 排除輸入的邏輯未必能看見內部聚焦按鈕。控制中心的 click 防護發生得太晚，因此會出現「按鍵是真的、按鈕有焦點，卻不會 click」的行為。

## 未修改來源的隔離對照

自有 loopback 頁面匯入真正 `ControlCenter`，沒有修改該模組。依賴採記憶體儲存與未啟動的控制器；沒有 GM、媒體、網路攔截或探測。全程以 IAB 真正原生輸入，不使用合成 click／KeyboardEvent。

受控變因僅為自有 `document` 的 bubble keydown 監聽器：當事件目標是控制中心宿主，Enter／Space 呼叫 `preventDefault()`，Enter 另聚焦自有外部 input。這是機制重現，不冒充取得實際網站快捷鍵的完整程式。

| 情境 | 正確契約 | 實際結果／判定 |
| --- | --- | --- |
| 無外部監聽器，Enter | 進入設定 | 標題變成「CDN 與播放設定」，keydown 未取消：正常對照通過 |
| 無外部監聽器，Space | 進入設定 | 標題變成「CDN 與播放設定」，keydown 未取消：正常對照通過 |
| 有外部監聽器，Space | 控制中心操作不被頁面快捷鍵消費 | 外部呼叫一次，keydown 被取消，標題仍總覽：契約不通過 |
| 有外部監聽器，Enter | 控制中心操作不被頁面快捷鍵消費或搶焦點 | 外部呼叫累計兩次，焦點變成 `host-input`，標題仍總覽：契約不通過 |

這是 **2 個正常對照通過、2 個缺陷情境失敗**。保存結果的一致性斷言通過，不能改記為產品契約全部通過。

## 重現入口與證據

本機根目錄：`.work/iab-testing/2026-10-11-v2.1.20-f8f6f87-r6/`。

```powershell
node .work/iab-testing/2026-10-11-v2.1.20-f8f6f87-r6/build-source.mjs
node .work/iab-testing/2026-10-11-v2.1.20-f8f6f87-r6/source-server.mjs
```

在內建瀏覽器開啟 `http://127.0.0.1:31992/`，按 Open product ControlCenter，原生 Tab 兩次後，先用 Enter／Space 驗證正常設定入口。Escape 關閉後，勾選 Controlled document keyboard handler，重做入口一次，即可重現。不要點擊清除、還原或測速。結束關閉自有頁面並停止伺服器。若執行環境隔離使 loopback 不可達，需由主機啟動同一個僅綁定 127.0.0.1 的伺服器，不修改瀏覽器或網路安全設定。

| 檔案 | 用途 |
| --- | --- |
| `BASELINE.json`／`IDENTITY.json` | 提交、版本、工作範圍及實際完整本體身分 |
| `KEYBOARD_CAPABILITY.json` | 自有封閉 Shadow DOM 原生可信輸入校準 |
| `UI_BASELINE.json`、`INSTALLED_SPACE.json`、`INSTALLED_ENTER.json` | 真實安裝 UI、焦點及按鍵取消觀察 |
| `source-keyboard.ts`、`build-source.mjs`、`source-server.mjs`、`SOURCE_IDENTITY.json` | 未修改 UI 來源、完整依賴雜湊及重跑入口 |
| `SOURCE_*_NORMAL.json`／`SOURCE_*_FAILURE.json` | 來源對照與失敗事件 |
| `screenshots/` | 已聚焦設定按鈕、現場失敗、來源正常與失敗畫面 |
| `INSTALLED_CLEANUP.json`、`SOURCE_CLEANUP.json`、`FINAL_TABS.json` | 方法、listener、timer、設定及分頁清理 |
| `EVIDENCE_VALIDATION.json`／`DOC_VALIDATION.json` | 保存證據一致性與文件檢查，不代替產品測試 |

## 清理與驗證界線

- 安裝頁 8 個方法觀察包裝均按完整描述子還原，繼承方法的自有遮蔽移除；7 個事件 listener 移除，剩餘 observer timer 為零。
- 沒有啟用設定命令延後，pending 為空；完整 UI 診斷報告呼叫為零。設定與起始快照相等，未修改剪貼簿。
- 沒有安裝故障攔截、持有網路請求、建立受控 CDN probe 或受控學習樣本。自然播放的正常樣本不被清除。
- 來源頁 4 個 listener 移除、timer 零、記憶體儲存鍵零，控制器從未啟動。
- 自有校準、影片、來源頁均關閉；連線失敗頁之後由分頁清單確認不存在，最終 IAB 分頁為零。兩個 loopback 服務已停止。
- 首次來源服務在沙箱中對主機不可達，該頁是工具無效窗口；改成主機 loopback 服務後才取得有效來源對照。清理工具一次異常延遲不計任何新增測試或播放時間證據。
- 自有 TypeScript 模型型別檢查通過、保存證據 7 組一致性檢查通過；產品來源、正式測試及版本未改，沒有重跑完整 npm／verify 或安全掃描。

## 最小修正方向與後續回歸

1. 在控制中心的鍵盤事件邊界隔離會冒泡到頁面的操作，保留按鈕、checkbox、select、textarea 的原生預設行為；不能對所有按鍵一律 `preventDefault()`，否則會破壞本來的鍵盤操作。
2. 保留可信事件限制、Escape 關閉、closed Shadow DOM 與視圖版本所有權。需要分開驗證 keydown／keyup，以及頁面捕捉監聽器；單純 shadow bubble 防護不能宣稱攔得住已先執行的外層 capture。
3. 加入具原生派送順序的契約：Enter／Space 按鈕啟動、設定輸入、診斷複製、Tab／Shift+Tab、外部快捷鍵與關閉後正常頁面按鍵。不要只直接呼叫 click handler。
4. 修復後只重跑 BR-10 及仍未執行的 P04 UI 晚到命令／P05 完整 UI 報告；其他已通過結果沿用。P01／P02 仍須新的自然 pending gate 前提，BR-01 不恢復。

本輪沒有把上述方向實作成補丁，也沒有升版或發布。下一步是 BR-10 的獨立修復範圍；它不應重新打開 BR-01。
