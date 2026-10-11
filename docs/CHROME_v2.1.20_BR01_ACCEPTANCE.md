# v2.1.20 BR-01 實際安裝續測 — 2026-10-11

只使用指定風景影片 BV1tFZZBQE57，Auto 1／2 倍分開。本輪正式來源、測試、版本與 Release 沒有再修改；771 項自動驗證是發布時的證據。目標維持執行中，**目前完整 BR-01 判定不通過**；以下逐項區分通過子項與未成立窗口，不用舊版本或來源模型補算。

## 新版身分

使用者更新後，2026-10-11T05:17:15.659Z 核對完整執行本體 exact v2.1.20=true、exact v2.1.19=false；本體 SHA-256 為 `06f4294bb404c153db7ad29e8ba592b625288a7d95e8913d23979d7e8960bffb`。此值是去除 userscript header 後的執行本體，與 [發布附件](TEST_REPORT.md) 的整份檔案雜湊不同。Debugger 身分事件 truncated=false、hasMore=false；Runtime／ControlCenter 各唯一 1。每次同片重新載入均重新核對本體、singleton 與物件身分，沒有重建控制器或重設預算。

先前 05:12:19.828Z 的 v2.1.19 觀察保留為更新前歷史；必要手動更新已完成，不能繼續列為目前阻塞。

## 本輪二元結果

| 子項 | 判定 | 實際證據與界線 |
| --- | --- | --- |
| 新意圖保存最新原生位置 | 通過 | Auto1 原生 3581.742358、SDK 舊值 3576.742358；新 paused-transition 重載保存前者。沒有觀察到 Adapter.seek 回寫舊值 |
| 新意圖保存有效位置 0 | 通過 | Auto2 原生 0、SDK 舊值 3661.60994；新 paused-transition 重載保存 0 |
| 正常 Auto1／2 | 通過 | 實際時間／影格前進、UI 暫停／恢復及 BODY 左／右短 seek；可信新 seek 更新 userRevision，正常主窗沒有多餘 Adapter 效果 |
| 播放中 12 秒 video 延遲 | 通過 | 1／2 倍分別攔到 3／4 個實際影片請求，放行後有時間與影格進度、無備援／重載；兩個主窗沒有新的 audio 請求，不虛構音訊樣本 |
| 外層進度列長按 | 通過 | Auto1 連續 dragging=true 31.383 秒、mouse up 釋放；Auto2 真正 touch 指標連續 31.709 秒，無監控備援或重載 |
| 原生取消與失去捕捉 | 通過 | Auto2 同一可信 pointerId=2 的 pointercancel、lostpointercapture 均釋放手勢；實際目標為 progress-schedule。這不是合成 DOM 派送 |
| 可信控制操作撤銷＋晚到拒絕 | 通過子項 | 真實 Adapter.reload 已呼叫且取得自然 thenable；控制點擊 user2→3，舊 token 於逾時前 ownership-ended；受控回傳邊界其後拒絕，無復活或 seek／setRate／play 回寫。未冒充自然 Promise 拒絕或完整新 seek 矩陣 |
| 真實 Auto2 停滯成功恢復 | 通過子項 | 媒體／控制器紀錄無掉列；備援後 15 秒一次實際重載，setRate(2)／play，9 秒後 recovered，沒有 Adapter.seek。Network 長歷史截斷，因此不計完整合併窗口 |
| 同版完整 15／30／post15 失敗退出 | 不通過 | 新長 seek／播放耗盡窗口先遭網站外部換核心及暫停，僅證明撤銷；上述成功恢復也不證明無進度時的完整 post15 分支 |
| 新操作／SDK 完成、拒絕全矩陣 | 不通過 | 有效控制點擊＋拒絕子項已完成；core 尚未出現的 Right 被網站忽略、另一次外部換核心發生在實際 reload 前，均不計晚到案例通過 |
| 真正背景 | 不通過 | 自有空白頁＋可信分頁快捷鍵仍原生 hidden=false、Runtime visible=true；沒有製造 hidden 或使用可見性覆寫值補算 |
| 自然 pending startup gate／其餘交叉全矩陣 | 不通過 | 尚無符合限制的完整同版證據；已知原生 XHR explicit-timeout 跳過不等於 pending gate |

兩個新位置案例走既有長暫停／死核心恢復路徑，實際 SDK play 明確由工具呼叫；它們不算長停滯 15／30／15。位置 0 是實際原生值，沒有替換媒體 getter。第一次 touch 命中隱藏控制層、dragging=false 的窗口保留作校準，沒有當成產品缺陷；hover 後重新確認實際進度列命中，才取得有效取消證據。

## 自然成功窗口的精確順序

Auto2 的持續媒體／控制器觀察中，人工影片延遲已結束，沒有再送出使用者操作。重載前約 30 秒的 120 個採樣沒有 paused、error、hidden 或路線資格失效；userRevision=5、policyRevision=1，影格數維持 2399，位置變化不能單獨算播放進度。

- video fallback：1791697800530 ms。
- core reloading／實際 Adapter.reload：1791697815530／1791697815531 ms。
- 實際 setRate(2)／play：1791697817530 ms；沒有 Adapter.seek。
- 兩次實際進度確認後 recovered：1791697824530 ms。

1314 個觀察列 dropped=false、faults=0；來源為 stall、保存位置 1063.005376。最終媒體實際 time=1405.483729、frames=17015、rate=2、readyState=4，watchdog healthy。這證明真實成功恢復子項，不能把後來回讀 Network 的 truncated=true 改寫成完整窗口，也不能把成功分支代替 post15 無進度失敗。

## 證據、清理與續行

私有證據位於 `.work/functional-fixes/br01-native-position/2026-10-11-ff725e9/installed-220/`，包含 installed 身分、各倍速前後狀態、具名窗口、Network、校準失敗、final-cleanup 與畫面。原始 v2.1.19 失敗資料不覆寫；[修正報告](BR01_NATIVE_POSITION_FIX_REPORT.md) 保留先紅後綠與安全範圍。

九份結束的 Network 紀錄中，已攔到的當前媒體 Native IDs 均有 loadingFinished／loadingFailed，保留數 0、patterns 空；網站取消造成的失效 interception 回覆保留原紀錄，不宣稱所有窗口零錯誤。各自有過濾仍存的最後檢查，受控 request／startup／challenge 的記憶體／持久樣本匹配均為 0。最後 6／6 方法描述子還原、繼承遮蔽移除、計時器與訂閱清除，指標觀察器移除、受控 Promise 收束、自有空白分頁關閉。沒有留下攔截、Getter 改寫、設定變更或其他腳本變更。

下一個完整窗口使用新的單一 Network 游標持續排空；前段正常通行，僅在真正 stall 重載後延遲當前合法 video，audio 通行，避免前段人工等待先耗盡網站重試。學習過濾需在重載配置請求身分前啟動，維持至晚到結果收束。此策略不變更控制器、媒體 getter、網站 timeout、Auto 或起播預算。完整失敗退出、新操作全矩陣與真正背景仍需有效證據；原 87.785 秒自然網路起因獨立未定位。
