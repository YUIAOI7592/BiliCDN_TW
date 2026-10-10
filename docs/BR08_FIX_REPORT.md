# BR-08 修復與驗證 — 2026-10-10

基準 **v2.1.15／f0c2d39**；目標 **v2.1.16**。採用完整拖曳契約，已完成本機修復及必要驗證，正式發布／公開產物核對待完成；BR-01 安裝版完整驗收另列。[原始 BR-08 報告](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)、歷史 Release 與原紅燈保持不變。現行入口：[最新版驗證](TEST_REPORT.md)、[工作狀態](TODO.md)、[v2.1.16 安裝矩陣](CHROME_v2.1.16_ACCEPTANCE.md)。

## 缺陷與修復結果

網站功能性外層進度列為 10 px wrapper，內層僅 4 px。v2.1.15 未辨識 wrapper，真實 Auto 2 倍故障中按住時 dragging=false，15.079 秒誤觸一次影片備援；inner 對照按住至少 16.388 秒無動作。現場沒有形成有效 30 秒重載窗口，模型重現與現場結果分列。

修復將 wrapper 及其子節點納入現有選擇器，命中仍須位於目前播放器區域。按下立即取得拖曳保護，即使尚未提交 seek。單一私有手勢保存 pointerId／媒體／播放器／內容；新合法進度按下取代舊手勢，其他按下不清除有效手勢。只接受相同指標的可信結束事件，區域外放開仍可結束，合成與舊指標事件沒有撤銷權。

可信 blur／真正 hidden 透過 VisibilityAdapter 的內部 subscribeControlLoss 在原 guard 阻擋前通知；失敗 listener 隔離。入口明確注入，PlayerAdapter 清理時取消訂閱，controls 仍以真正可見性核對。沒有新增產品 pointer capture、拖曳 timeout 或 preventDefault；原可見性覆寫與 guard 策略不變。

Monitor 一般停滯、舊 watchdog、冷起播均拒絕 dragging，清除停滯及連續計數且不消耗一次性嘗試。Recovery 在 Runtime video fallback／長暫停播放意圖／paused-transition 的 token 建立前後核對最新控制、操作／媒體／核心、世代／內容與授權資格；保存位置與倍速各讀一次，提交前重查 token／額度／breaker。已存在的 token 在下一次既有資格檢查撤銷，晚到 reload／play 不復活。

## 來源與正式契約對照

| 修復需求 | 來源位置 | 正式契約 |
| --- | --- | --- |
| wrapper／子節點，保留 inner／舊版／slider，限制目前區域 | [PlayerAdapter](../src-v2/adapters/player.ts)，control pointerdown | [br08-player.ts](../tests-v2/regressions/functional-races/br08-player.ts)：hit protects uncommitted preview、outside slider ancestor、synthetic/external pointerdown；[br08.ts](../tests-v2/regressions/functional-races/br08.ts)：原七契約 |
| 指標取代、區域外結束、合成排除及同步重入 | PlayerAdapter 私有 gesture／pointer revision／release | only current trusted pointer owner can release、nonprogress preserves owner、visibility/initial-region/matched-hit-region reentry、nested synthetic |
| blur／hidden 在 guard 前通知、清理 | [VisibilityAdapter](../src-v2/adapters/visibility.ts)、[entry 注入](../src-v2/entry.ts) | trusted blur reaches player before guard、hidden visibilitychange/webkitvisibilitychange、listener failures、disable/reinstall、reset unsubscribes |
| 拖曳阻止三種監控救援 | [PlayerMonitor](../src-v2/application/player-monitor.ts)，active/watchdog/startup gates | held wrapper exact boundaries、held non-seeking preview、watchdog reset、cold startup does not consume rescue |
| token 提交前最新資格及同步重入 | [RecoveryController](../src-v2/application/recovery-controller.ts)，begin/ownership | dragging prevents stall/startup/long-pause/paused-transition token；rate reentry、eligibility changes during final controls、newer token/breaker/quota |
| 放開後期限、位置 0 與晚到結果 | Monitor／Recovery 既有 stall intent | ordinary release exact 15/30 from zero；cold startup original age；late reload/play rejection、drag revokes old intent |
| BR-01～07 相容 | 未擴充公開 API、應用層 ports／snapshot、schema 2 | 全套 application／adapters／orchestration／measurement／diagnostics／native-transport 等既有回歸 |

正式 application **34**＋adapters **29**，共 **63** 個 BR-08 案例。每個案例名稱與斷言直接保存在上述正式模組；套件明確匯入、不讀調查目錄。完整型別替身使用祖先限定 closest 與真正 VisibilityAdapter guard，testScope 管理全域替換、計時器、訂閱與取消。

**期限優先規則：** 一般停滯放開後第一個合資格 tick，以最新目標建立新 15／30 秒段。沒有實際進度且尚未提交 seek 的冷起播仍依原 firstMediaAt，可能釋放後立即救援；沒有全域「釋放後再等 15 秒」，不重開 gate 預算。Auto／ABR 不被強制，15／30／15、重載總額與 90 秒 breaker、影音隔離及禁止／授權規則保留。

## 修復前後及重跑入口

原七契約先移入正式套件，未改執行期時 **3 fail／4 pass、exit 1**；root 核對來源 SHA-256 未變後才授權 runtime 修改。擴充 application 紅燈 21 fail／7 pass，adapters 紅燈 16 fail／9 pass。交叉複核後先新增 final-controls（2 fail）及早期 pointer 重入（2 fail／2 pass），再修相應同步邊界。紅燈保留，不算整體通過。

最終 **63／63 BR-08、19 套件／637 正式案例**、typecheck、architecture（44 模組）、v2.1.16 verify、diff check 通過。無 only／skip／todo／cancelled／預期失敗。無效多套件 CLI 呼叫單列。證據在 .work/functional-fixes/br08/2026-10-10-f0c2d39/，包含 application/、player/、integration/、source/、security/final/ 及 CHECKPOINT.md。

```powershell
npm test -- application --name BR-08
npm test -- adapters --name BR-08
npm test -- native-transport
npm test -- orchestration
npm test -- measurement-state
npm test -- diagnostics
npm run typecheck
npm run architecture
npm test
npm run verify
git diff --check
```

## 安全與 Chrome 來源隔離

最終 Codex Security 差異掃描 **25cfd1fe-bfd4-425c-a105-2976799c04b8** 於 **2026-10-10T12:54:19.753947Z** 封存並讀回，14／14 差異面、0 可報告發現、無未處理候選。最終快照 eb363339baed391b074ba8ab6e995e058c7ec69d72cf205c1780ac06b3b7ca0c。兩個獨立工作者及主代理核對可信輸入、重入、手勢／通知／恢復所有權、清理與資料輸出；三項 preflight 通過，Daybreak Blue granted。政策 resolver 視圖錯誤以直接 root SECURITY.md／無巢狀政策核對補足。六份原件雜湊一致匯出，安全與 verify 分列。

第一次不可變掃描後追加早期 pointer 重入修正，因此第一次 9c437e78-50d0-4748-aba5-7d500aed2a4a 不是最終核准；上述第二次完整掃描對應最終來源。既有非本輪的 VisibilityAdapter 描述子清理限制沒有被宣稱修復。

Chrome 最終來源隔離 **31 有效通過／0 有效失敗**，另 2 無效輸入校準保留。真正可信滑鼠及觸控、雙指標舊結束、lostcapture、blur guard、1／2 倍按住 31 秒、釋放位置 0／精確期限／三 tick 不重試、冷起播與 watchdog、舊意圖撤銷及所有權替換通過。自有 iframe 中用合成媒體／FakeClock與受控路線，不是網站 Auto 或實際 singleton。Debugger 已載入完整 bundle 與本機 SHA-256 相同；沒有 GM／真實探測／學習資料。

清理後自有計時器／訂閱 0、方法與可見性描述子還原、DOM／API／iframe 清除、分頁及本機伺服器關閉。滑鼠 capture 前提未成立與最初 touchEnd 指標校準保留無效，不加總通過。真正 hidden／任意 nested/getter 邊界仍依正式模型證據分列。

## 發布及剩餘驗收

v2.1.16 待正式封裝／提交／推送 main／標籤／Release及公開 latest 核對；完成後更新此處，不回寫封裝快照。只附使用者腳本，更新網址不變。

新版 [BR-01 安裝矩陣](CHROME_v2.1.16_ACCEPTANCE.md) 尚未取得新版執行 body／singleton，因此不開始計分。只用指定風景影片、Auto 1／2 倍分開。原 87.785 秒自然網路起因保持獨立；真正 background、完整停滯、pending startup gate 及晚到 SDK 的必要前提不成立時保持待驗收，不能替換網站 getter／controller 或強制維持播放來製造通過。
