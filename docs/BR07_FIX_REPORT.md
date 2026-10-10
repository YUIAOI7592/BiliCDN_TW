# BR-07 修復與驗證 — 2026-10-10

基準 **v2.1.14／9d98d09**，已發布 **v2.1.15**。原 [BR-07 調查](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 與 [v2.1.14 安裝](CHROME_v2.1.14_ACCEPTANCE.md) 保留。**修復、必要自動／安全／來源隔離及公開產物核對完成；實際新版鍵盤與新 15 秒寬限取得證據。** 續測新增 [BR-08 外層進度拖曳漏辨](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)，未擴修，完整 BR-01 未結案。見 [最新版報告](TEST_REPORT.md)、[工作清單](TODO.md) 及 [安裝矩陣](CHROME_v2.1.15_ACCEPTANCE.md)。

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

原五正確契約先移入正式 application，未修改執行期時 **2 fail／3 pass、退出碼 1**；兩失敗是可信 keyup 取得新修訂及新 15 秒寬限，三正常對照是 Left keydown、滑鼠新寬限及合成 keyup 排除。最小修復後原五 **5／5**；擴充為 **60 個 BR-07**，BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構及升版前 verify **v2.1.14** 與最終 verify **v2.1.15** 通過。紅燈、綠燈、整合及版本驗證分開保存，最終 verify／封裝結果另存，不覆寫升版前紀錄。

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

Codex Security 差異掃描 **3e3d133e-7f39-4bf8-a0ba-d22d188a639a** 已於 2026-10-10T10:51:13Z 封存及讀回：兩個來源／正式測試差異檔與相關 Monitor／Recovery／Runtime／RouteCoordinator 邊界完整覆蓋，**0 可報告發現、無未處理候選**。三項 preflight 通過，Daybreak Blue granted，模型 gpt-6.1-sol／ultra。政策 resolver 誤報既有根目錄不存在；直接核對 root SECURITY.md 及無巢狀政策後完成，不造成差異覆蓋缺口。封存原件保持不變，雜湊一致的匯出保存在本輪 security/。安全與 verify、來源／安裝驗收分列。

Chrome 修復來源隔離 **40／40 個有效案例通過**：真正可信 keydown／keyup、BODY／播放器焦點及 Auto 1／2 倍模型、八種 keyup、直接／停止傳播尋位、keydown／keyup 各自新 seek、位置 0、排除／方法相容、腳本還原、Event.NONE 延後及合成輸入、15／30／15 精確邊界與失敗後不重試。使用自有 iframe 的合成媒體／FakeClock，沒有修改網站 getter／控制器，不代替實際 Tampermonkey singleton。

`source/chrome-results.json` 共 42 份記錄，40 份有效 pass=true；初始校準觀察及 timer 尚未完成的無效觀察不列通過，後者已由 timer 收束的有效列替代，沒有確認新缺陷。800 ms 持鍵只產生 keydown／keyup 兩事件，**未證明原生 auto-repeat**；IME、nested 派送及媒體／播放器替換仍為正式模型證據，未宣稱完整 Chrome 覆蓋。清理後 browser／synthetic timer pending 均 0、seek／reload wrapper 已還原、自有 root 移除、iframe 殘留 0。

最終 **v2.1.15 verify 已通過**，仍為 574 正式案例；確定性建置、語法、v2-only 與暫存封裝 checksum 通過。升版只修改 release.json、package.json 及 package-lock.json 的版本；執行期／正式測試雜湊維持安全審查時內容。

## 發布與 BR-01 安裝驗收

v2.1.15 於 **2026-10-10T10:57:18Z（Asia/Taipei 18:57:18）** [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.15)。發行提交／peeled tag `3f7c73335a58dd89d4bc8a4209b7ecf3c70acaf8`，標籤物件 `d838c3a804d4a5a55f4b7b931cdaf15f8476b745`；發布時遠端 main 一致。唯一附件 `BiliCDN_TW.user.js`，**317,487 bytes**，SHA-256 `affedbeef854462c60fd5fd68947fc4c37ef7ddb7bd2922e72fed6cca6b342bf`。**10:57:38Z** 無登入公開 latest 下載核對版本、大小及雜湊全部匹配，更新網址維持原位。發布後補驗收文件不改寫發行標籤或 Release 快照。

更新前 **10:59:19Z** 同片仍執行完整 v2.1.14 的證據 installed/update-prerequisite.json 保留；工具禁止擴充介面，由使用者手動更新既有腳本。更新後 **11:04:00Z** 已重新核對完整 v2.1.15 body 匹配及 singleton 1，大小／SHA-256 與 Release 一致。正常 Auto 1／2 倍 BODY／播放器 Right／Left 每命令修訂 +1，暫停恢復與實際進度成立。故障新 Right 在 15.427／15.310 秒各一次備援，2 倍 30.309 秒一次重載；其後 paused，未補算完整重載後 15 秒通過。約 12 秒 video-only 解除後在 17.863／21.985 秒取得有效進度，各一次備援、核心重載 0。實際 BR-02 Blob／native 及精確本地拒絕子集通過，BR-03／真正共用 gate、SDK 晚到與真正 hidden 必要前提未成立，分列待驗收。

後續 **BR-08 P2** 確認功能性外層進度拖曳未設 dragging，真實按住 15.079 秒誤觸影片備援；inner 持續故障按住超過 16 秒不啟動動作。私有七正確契約 3 fail／4 pass／exit 1 是新缺陷證據，不算正式 574 通過；現場 30 秒拖曳重載未成立。依計畫新缺陷退出條件停止擴展，不改本版 runtime／Release。

每個故障窗口先建立新 Fetch／Network 游標，精確攔截當前 video、audio 通行；完整處理 hasMore 並核對 truncated／dropped。受控 ID 學習抑制保留至收尾，最終 107 IDs 記憶體／持久匹配前後皆 0、相符活 XHR 空、held requests 0／patterns 清除、自有 observer／pointer／SDK API 移除、send／證據包裝還原、iframe 0，Network／Debugger／Runtime 觀察關閉。SDK 繼承方法的工具草稿遮蔽另已清除，hasOwnReload=false、方法與原型一致，沒有修改產品方法。清理前正常 Auto 2 倍實際 1979.88 秒／35714 frames，交接 Auto 1 倍暫停 2042.773843 秒；事件對帳的 11 個 completion 缺口保留，沒有把最後活 XHR 空值補算為 107／107 傳輸完成。

## 限制與完成標準

只有同派送內可確認的實際新 seek 才取得新寬限；無法可靠辨識來源時保守不歸因。被停止傳播的直接媒體寫入若沒有同步媒體／包裝／controls 觀察，仍可能缺少可歸因證據。新命令確認後由下一合資格監控 tick 建立新基準，保留既有每秒監控節奏。

**修復與發布完成：** 正式契約、整合檢查、安全差異及來源隔離通過，公開更新產物讀回完成。

**完整 BR-01 安裝驗收尚未完成：** BR-08 未修復；完整重載後 15 秒退出／不重試、拖曳邊界、真正 hidden、實際晚到 SDK 與剩餘生命週期／政策／影音隔離／傳輸矩陣待有效證據。原 87.785 秒自然網路起因及其他產品驗收獨立，不能因 BR-07 修復而結案。
