# BR-01 後續修復：自有重載過渡與操作所有權

日期：2026-10-11；基準 **v2.1.16／1e376978c757c0a1e622668fd04fdaad658dc7ef**。本輪 v2.1.17 已完成修復、必要整合檢查、獨立安全差異審查與 Chrome 來源隔離，於 **00:31:14（Asia/Taipei）正式發布**。實際新版已載入，正常 Auto 1／2 倍與自有重載恢復取得部分通過；**BR-01 完整安裝驗收仍未完成**。最新版結果見 [固定驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md)；[v2.1.16 安裝證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.16_ACCEPTANCE.md) 保留原始限制。

## 問題與已確認因果

腳本自己的 SDK reload 會正常同步 pause、清空同一媒體核心。舊 Monitor 因 paused 結束停滯，Recovery 的非 paused／固定核心／seek 修訂檢查也撤銷動作，因而無法等到新核心再安全還原。另一方面，BODY 可信 Space 實際 pause／resume 沒有更新 userRevision；若只放寬 paused，舊還原就可能反過來覆寫真正的新使用者暫停。

實際 v2.1.16 Auto 1／2 倍手動 Adapter.reload 的原生方法／媒體時序與正式端到端紅燈相符：reload 返回前同步 pause；返回時 coreId0、位置／readyState 清空；約 +286／300 ms 新核心，+863／951 ms SDK 自行整秒 seek，+2018／1968 ms 原生 play。20／15 秒後只是後續讀回，並非初始化卡住那麼久。BODY Space 同一可信 keydown 派送中的 paused 變化已取得現場證據。

這些方法窗口沒有建立 Recovery token，也沒有故障攔截，**只校準 SDK 邊界**。Auto 2 首批 Network 有截斷，Auto 1 有獨立完整連續對照；observer 事件與 Network 不能互相補缺。原約 19～20 秒網站外部暫停／核心替換與 87.785 秒自然 CDN 起因仍未定位，不併入本次因果。

## 修復／正式案例對照

| 修復面 | 來源與契約 |
| --- | --- |
| 有限 own reload 證明 | [PlayerAdapter](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/adapters/player.ts) 的私有單一 owner 綁定 SDK／媒體／生命週期／user／reload 修訂，最多 15 秒；old core→null→首個標記替換，第二替換、hidden、reset、新操作、外部 reload、throw／reject 均撤銷。[PlayerPort](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/application/ports.ts) optional readonly ownedReload，缺失=false |
| 真正 BODY 操作 | 同 trusted keydown、同媒體／SDK／core／內容的實際 paused 或 rate 變化才增加一次 userRevision；region 舊行為保留。排除 editable／控制中心／IME／modifiers／synthetic／keyup／忽略命令與派送後工作，腳本內部操作先清候選 |
| 有界核心恢復 | [RecoveryController](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/application/recovery-controller.ts) 只用精確本次 reload 證明容許 paused／null gap，首新核心就緒後處理 rate／play；SDK 未知非 user seek 撤銷舊位置還原，不能猜成新使用者或重開期限 |
| 停滯協調與進度 | [PlayerMonitor](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/application/player-monitor.ts) 與 Recovery 共用現有意圖、先處理終止期限；已完成 seek／核心切換只建立採樣基準。等待兩個有效進度時不得再次備援，failed 後的 SDK resume 不重試，新的使用者操作／真正恢復後新停滯才可重新建立 |
| 方法／晚到所有權 | SDK setter／accessor、receiver、參數、原回傳及例外保留；完整描述子與函式所有權一起核對，繼承方法清理自有 shadow。舊 Promise／timer／core 讀取不撤銷或標記新 owner，方法讀取同步新操作後不呼叫過期 reload |
| 正式入口 | [br01-followthrough.ts](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/functional-races/br01-followthrough.ts) 在 application；[br01-reload-controls.ts](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/functional-races/br01-reload-controls.ts) 在 adapters；沒有新增測試套件登記或調查目錄匯入 |

不改 Auto／ABR、15／30／15 秒、總重載額度、breaker、影音隔離、Vault 授權／政策、公開 API 或 schema 2。沒有換影片、強制畫質或取消／重送已開始的網站請求。SDK 初始化未知新目標優先撤銷舊位置還原，不能用小數取整容差授權回寫。

## 契約與來源隔離進度

原正式六個端到端正確契約在未改執行期時 **3 fail／3 pass**；BODY 原 30 個 **10 fail／20 pass**。Player 的 proof 擴充、方法 cleanup／then-return、準備讀取重入均先保存獨立紅燈，最後 Player 本輪 **50／50** 正式契約、adapters **102／102**、application **231／231** 通過。進度基準追加 **1 fail／1 pass**、終止後 SDK resume 追加 **1 fail／1 pass**；不是把故障行為作預期成功。

Chrome 最後來源隔離 **22／22** 通過，分為 **12 個控制模型與 10 個真正可信輸入**。自有 iframe、合成媒體／FakeClock 的 1／2 倍 14,999／15,000、29,999／30,000、post14,999／15,000 邊界成立，每段一次備援與重載，timeout 後三 tick 無再重載；BODY Space／ArrowDown（2→1 倍）實際操作取得新修訂並撤銷舊意圖。這不是安裝 singleton 證據；指標按住 31 秒是模型時間，不是網站實際 31 秒故障窗口。

首輪來源還原窗口發現兩個同範圍缺口：已有第一個實際進度、等待確認時多一次 route fallback；兩個進度跨 owned lease 到期時因舊 seek 修訂誤撤銷。兩者及 snapshot 同步重入反證均已補正式契約並修復，最後來源矩陣通過；原紅燈記錄保留。原「owner-replace」校準其實是合法採用第一核心，已排除該錯誤預期，改以 `final-second-core` 驗證第二次外部核心替換撤銷。

來源 bundle SHA-256：`6c8d1caca5c0c1d23a406c5ec54b1dada4ddecde7b66106b8b05593cd938536e`。清理讀回 timers=0、rootRemoved；自有來源分頁已關閉，127.0.0.1 驗證 helper 已停止。

重跑命令：

```powershell
npm test -- adapters --name 'BR-01 reload controls'
npm test -- application --name 'BR-01 followthrough|BR-01 progress ownership|BR-01 late SDK ownership|BR-01 review'
npm run typecheck
npm run architecture
npm test
npm run verify
git diff --check
```

所有案例使用具名 node:test、testScope、FakeClock、deferred 與完整型別模型。Node 的 trusted 派送僅作契約，真 Chrome 可信輸入、原生 SDK 方法及實際安裝分別驗證。完整正式套件不允許 only／skip／todo／cancelled／預期失敗。

## 發布、剩餘驗收與證據位置

最終 **19 套件／716 項正式契約全部通過**；typecheck、architecture（44 個 runtime 模組）、npm run verify 與 git diff --check 均通過。verify 包含確定性建置、語法、儲存命名空間及封裝校驗，不包含安全掃描。正式完整執行沒有 only／skip／todo／cancelled 或預期失敗。

獨立 Codex Security 差異掃描 `39e2743e-185d-4c7d-a04d-f6580e61385a` 已封存：**11／11 檔案覆蓋、0 候選、0 發現**。最終四份 runtime 雜湊與掃描時一致。掃描宿主曾回報工作目錄變動，因此不宣稱整體 snapshot 始終不變；其後三份版本 JSON 遞增屬掃描外變更，由主代理另行核對。安全機器產物保留於私有存放位置。

[v2.1.17 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 於 2026-10-10T16:31:14Z 發布，即 2026-10-11 00:31:14（Asia/Taipei）。發行提交／peeled tag 為 `1b87d3f759e479e67650e291b5a8d8f107102145`，發布時遠端 main 相同；annotated tag ref 為 `87109266a5044055dffae653000f376ca6f0c80c`。唯一附件 `BiliCDN_TW.user.js` **332,575 bytes**，SHA-256 **`4bb4601a91e5e752595a5a8ec1b4d8905036954f299d578ca93209c059ce6a06`**；16:31:40Z 的無認證公開 latest 核對版本、大小與完整產物一致。後續文件提交不改發行標籤或 Release 快照。

16:32:42.615Z 仍為完整 v2.1.16 的觀察保留。使用者更新後，**16:34:48.957Z／00:34:48.957（Asia/Taipei）** 核對實際 v2.1.17 完整 IIFE（329,134 字元）與 Release 執行本體相符、唯一 Runtime／ControlCenter；Release 腳本仍為上述 332,575 bytes。新結果只計此新版身分下的窗口。

實際 Auto **1／2 倍** BODY Space pause／resume、鍵盤短 seek 與時間／影格進度已取得正常對照。兩個獨立後段停滯分別由 Recovery 自動呼叫一次 Adapter.reload，**Auto 2 累計 reloadCount=1、Auto 1 累計=2**，均接納本次標記核心、還原合法倍速／播放意圖並到達 `recovered`；不是單段重載兩次。SDK 更新整數目標後，Adapter 沒有 seek 回寫舊保存位置（2 倍 1516.967991→1516、1 倍 1836.172853→1836），之後有實際時間及影格進度。

原 Auto 2 長攔截窗口先被網站 pause／外部核心替換撤銷，後續自動恢復屬獨立 episode，不能回填原窗口完整 15／30／post15。Auto 2 Network 有未持續 pump、未知分類放行與後段未捕捉的限制；Auto 1 followthrough 的直接重載／恢復事件保留，但其 `everDropped=true`／Network 截斷不作完整故障時序。Auto 1 兩個 12 秒嘗試分別未提交 seek、進度列 locator timeout，均不計通過。這些樣本未確認新功能缺陷。

**仍待完成：** 有效完整 15／30／重載後 15 秒失敗釋放、12 秒 video-only 受控延遲、真正 hidden、真正 pending singleton gate，以及新操作／晚到 SDK 完成和拒絕／生命週期／政策／影音隔離的完整矩陣。

16:56:37.369Z 最終清理：12／12 工具描述子仍由工具持有且完整還原、timer 清除、live XHR=0、observerFaults=0、held=0、patterns 空。已知 2,027 個受控 request ID 的記憶體／持久樣本零匹配，unclassified=0、四個分類 hook 均持有；本輪 startup／challenge 數均0，不能代替真 gate 驗收。historical everDropped=true 保留，不補未觀測歷史。初次清理後查詢錯讀 `deps.runtime` 造成 TypeError，原記錄未刪；16:57:30.601Z 獨立正確 postcheck 確認觀察器 entry 不存在、generation1／epoch0、Auto1／readyState4／paused=false／位置2225.339652。最後風景截圖與 Auto／倍速 DOM 證據分列。

剩餘安裝驗收只使用指定風景影片 Auto 1／2 倍；詳見 [v2.1.17 安裝驗收紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.17_ACCEPTANCE.md)。網站提前 pause／error／外部換核心只證明撤銷；截斷窗口與缺少自然前提列待驗收。不能替換網站媒體 getter、控制器或維持假播放製造通過。

私有新證據在 `.work/functional-fixes/br01-followthrough/2026-10-10-1e37697/`：`evidence/CAUSAL_REPORT.md` 整合因果與證據限制；`application/` 與 `player/` 保存正式紅燈／綠燈；`tests-final.txt` 與 `verify-final.txt` 保存整合結果；`source/` 保存首輪反證、最後矩陣與清理。`installed-v217-identity.json`、`installed-normal-auto1-controls.json`、`installed-auto1-sdk-followthrough.json` 及 `installed-review/auto2-long-stall/` 分列新版身分、正常操作、自有恢復與原攔截窗口限制；12 秒未成立前提、`installed-cleanup.json` 的原 postcheck 錯誤、`installed-cleanup-postcheck.json` 的獨立確認及最後風景截圖也保留。安全結果獨立封存。原調查、Release 快照與歷史安全封存保持原狀。
