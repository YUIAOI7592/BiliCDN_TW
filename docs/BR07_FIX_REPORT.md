# BR-07 修復與驗證 — 2026-10-10

基準 **v2.1.14／9d98d09**，預定 v2.1.15。原 [BR-07 調查](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 與 [v2.1.14 安裝驗收](CHROME_v2.1.14_ACCEPTANCE.md) 保留。**本機自動驗證及 Chrome 來源隔離已通過；安全審查進行中，尚未發布或取得新版安裝驗收。** 即時狀態見 [最新版報告](TEST_REPORT.md)、[工作清單](TODO.md) 及 [v2.1.15 安裝矩陣](CHROME_v2.1.15_ACCEPTANCE.md)。

## 修復行為與契約對照

網站右方向鍵實際在 keyup 派送才尋位。v2.1.14 只建立 keydown 候選，右鍵新目標被視為網站調整而沿用舊停滯期限；原 Auto 1／2 倍在新命令後 6.995／7.673 秒便備援，1 倍 21.994 秒重載。修復為 keyup 建立自己的可信同派送候選，讓真正新使用者操作取得完整寬限。

| 需求 | 來源／正式契約對照 |
| --- | --- |
| Right keyup 與 Left keydown 皆取得新使用者身分 | PlayerAdapter 捕捉兩類事件；application 已匯入的 functional-races/br06.ts 移植原五契約 |
| 各派送獨立，實際新 seek 才計數 | keydown／repeat／keyup 若各自造成有限新位置且 seeking，各自增加一次 userRevision；沒有位置變化不計數 |
| 同派送多入口去重 | seek 包裝、媒體事件、controls 及該事件種類的 window 冒泡共同確認；一旦確認撤銷候選 |
| 排除與腳本來源 | 真可見性、editable／控制中心／IME／修飾鍵／合成輸入；內部 seek 標記與 pendingSeek 保守抑制維持，不因可信捕捉全面清空 |
| 重入、派送結束及資源清理 | 新事件取代候選；舊冒泡／timeout 檢查身分。Event.NONE 拒絕晚到，零延遲清理只釋放參照，不增加按住狀態或延遲窗口 |
| 方法及控制器相容 | 保留 receiver／參數／結果／例外；Adapter→Monitor→Recovery 新 userRevision 撤銷舊 token 並建立新段，網站／Auto 的單純 seekRevision 保留期限 |

執行期只調整 PlayerAdapter 的鍵盤觀察與候選事件種類，沿用 BR-06 已注入的 Scheduler／真正可見性。沒有新增公開 API、應用層介面、設定、持久欄位或 Native 授權索引。Auto、15／30／15、重載額度、breaker、影音隔離及 schema 2 保持原契約。

## 正式失敗契約與修復後結果

原五正確契約先移入正式 application，未修改執行期時 **2 fail／3 pass、退出碼 1**；兩失敗是可信 keyup 取得新修訂及新 15 秒寬限，三正常對照是 Left keydown、滑鼠新寬限及合成 keyup 排除。最小修復後原五 **5／5**；擴充為 **60 個 BR-07**，BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構及升版前 verify **v2.1.14** 通過。紅燈、綠燈、整合及版本驗證分開保存，升版後另作最終 verify／封裝。

正式測試情境分開設定事件種類與網站提交階段；Node 可信性與 eventPhase 只作型別化模型。擴充矩陣涵蓋各 seek 鍵、repeat／兩階段新 seek／不動、位置 0、多入口去重、排除、nested 派送、停止傳播、監聽器間 microtask、舊 timeout、所有權失效及方法相容。控制器以 FakeClock／deferred 驗證第 8 秒新命令重開 14,999／15,000、29,999／30,000 ms 邊界與晚到 reload／play；所有資源由 testScope 登記清理。

```powershell
npm test -- application --name BR-07
npm test -- application --name BR-06
npm test -- adapters
npm test -- orchestration
npm test -- measurement-state
npm test -- diagnostics
npm test -- native-transport
npm run typecheck
npm run architecture
npm test
npm run verify
git diff --check
```

證據目錄：`.work/functional-fixes/br07/2026-10-10-9d98d09/`。正式套件不匯入該目錄；最終不得保留 only／skip／todo／cancelled 或預期失敗。歷史 Node、來源隔離與安裝紀錄不作新結果。

## 獨立安全差異與 Chrome 來源隔離

Codex Security 差異掃描 **3e3d133e-7f39-4bf8-a0ba-d22d188a639a** 已於 2026-10-10T10:51:13Z 封存及讀回：兩個來源／正式測試差異檔與相關 Monitor／Recovery／Runtime／RouteCoordinator 邊界完整覆蓋，**0 可報告發現、無未處理候選**。三項 preflight 通過，Daybreak Blue granted，模型 gpt-6.1-sol／ultra。政策 resolver 誤報既有根目錄不存在；直接核對 root SECURITY.md 及無巢狀政策後完成，不造成差異覆蓋缺口。封存原件保持不變，雜湊一致的匯出保存在本輪 security/。安全與 verify、來源／安裝验收分列。

Chrome 修復來源隔離 **40／40 個有效案例通過**：真正可信 keydown／keyup、BODY／播放器焦點及 Auto 1／2 倍模型、八種 keyup、直接／停止傳播尋位、keydown／keyup 各自新 seek、位置 0、排除／方法相容、腳本還原、Event.NONE 延後及合成輸入、15／30／15 精確邊界與失敗後不重試。使用自有 iframe 的合成媒體／FakeClock，沒有修改網站 getter／控制器，不代替實際 Tampermonkey singleton。

`source/chrome-results.json` 共 42 份記錄，40 份有效 pass=true；初始校準觀察及 timer 尚未完成的無效觀察不列通過，後者已由 timer 收束的有效列替代，沒有確認新缺陷。800 ms 持鍵只產生 keydown／keyup 兩事件，**未證明原生 auto-repeat**；IME、nested 派送及媒體／播放器替換仍為正式模型證據，未宣稱完整 Chrome 覆蓋。清理後 browser／synthetic timer pending 均 0、seek／reload wrapper 已還原、自有 root 移除、iframe 殘留 0。

最終 **v2.1.15 verify 已通過**，仍為 574 正式案例；確定性建置、語法、v2-only 與暫存封裝 checksum 通過。升版只修改 release.json、package.json 及 package-lock.json 的版本；執行期／正式測試雜湊維持安全審查時內容。

## 發布與 BR-01 安裝驗收

必要正式／整合／安全／來源隔離通過後，依常設授權直接升修補版、封裝、提交、推送 main／標籤及發布。基準未漂移且版本未使用時採 **v2.1.15**；Release 僅附使用者腳本，核對公開 latest 版本、大小、SHA-256 及遠端 main／標籤。完成讀回後由本報告與 TEST_REPORT 記錄實際數值，未核對前不宣稱發布。

安裝驗收先比對完整新版 body／唯一 singleton，再只用指定風景片與 Auto 1／2 倍分開完成矩陣。尚未更新時維持待驗收；網站提前 pause／error／外部換核心或事件截斷不能算完整 30／15 秒通過。晚到 SDK 案例呼叫實際方法，只控制自有 Promise 邊界，明列受控條件。

每個故障窗口先建立新 Fetch／Network 游標，精確攔截當前 video、audio 通行；完整處理 hasMore 並核對 truncated／dropped。受控 ID 學習抑制保留至晚到結果收束，最後核對記憶體與持久樣本零匹配、釋放 held requests、清空攔截及還原自有包裝。

## 限制與完成標準

只有同派送內可確認的實際新 seek 才取得新寬限；無法可靠辨識來源時保守不歸因。被停止傳播的直接媒體寫入若沒有同步媒體／包裝／controls 觀察，仍可能缺少可歸因證據。新命令確認後由下一合資格監控 tick 建立新基準，保留既有每秒監控節奏。

**修復與發布完成：** 正式契約、整合檢查、安全差異及來源隔離通過，公開更新產物讀回完成。

**完整 BR-01 安裝驗收完成：** 新版剩餘矩陣全部取得有效通過證據；前提未成立、工具阻塞或新缺陷保持未完成。原 87.785 秒自然網路起因及其他完整產品驗收獨立，不因本次修復結案。
