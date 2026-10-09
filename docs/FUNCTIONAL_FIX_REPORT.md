# BiliCDN_TW 功能與競態修復對照

2026-10-09，以 v2.1.8／`71f7ddd6f7cb5e538244419e801925e1a7d1ab10` 為基準，完成 16 項已確認缺陷及已決定的 R04 嚴格影音隔離，共 17 項本機修復。此實作階段未升版、提交、發布或變更瀏覽器設定，schema 2、持久鍵及已發布 Release 快照保持不變。其後使用者授權推送更新，改以 v2.1.9 發行；最新發行狀態見 [驗證報告](TEST_REPORT.md)。

修改前先移植失敗契約，再分批修正執行期邏輯。正式 `npm run verify` 通過 **299 個具名案例**、43 個執行期模組架構與 42 個非入口模組匯入純度、確定性建置、語法及暫存封裝校驗。原 v2.1.8 的 215 案例基準與新增案例不能換算成歷史 891 項斷言數。

## 修復與回歸對照

| 項目 | 修復結果與來源 | 正式回歸位置與契約名稱 |
| --- | --- | --- |
| R01 | [PlayurlController](../src-v2/application/playurl-controller.ts) 同步通知內容週期；[Runtime](../src-v2/application/runtime-controller.ts) 重設並釋放訂閱 | [runtime.ts](../tests-v2/regressions/functional-races/runtime.ts)：`R01`，generation／epoch、同片畫質、登記順序、釋放 |
| C-01 | [RecoveryController](../src-v2/application/recovery-controller.ts) 在任何還原前處理 seek／ended／mediaError | [recovery.ts](../tests-v2/regressions/functional-races/recovery.ts)：`C-01`，中斷與正常還原對照 |
| C-04 | [PlayerMonitor](../src-v2/application/player-monitor.ts) 首次位置只建立基準 | recovery.ts：`C-04`，非零續播停滯與真實增量對照 |
| C-05 | RecoveryController 的 play 拒絕檢查生命週期與最近動作 | recovery.ts：`C-05`，舊 Promise／reset／新恢復完成 |
| R04 | Runtime 只以 video 備援建立影片核心恢復意圖 | runtime.ts：`R04`，音訊隔離、影片合法恢復及健康影片對照 |
| A01 | [Vault](../src-v2/state/signed-route-vault.ts) 刷新漸進式可信來源、撤銷舊授權，正規化相同集合保留身分 | [routing.ts](../tests-v2/regressions/functional-races/routing.ts)：`A01`，MP4／FLV、八次刷新、舊 handles／aliases、空合法來源及 DASH |
| A02 | PlayurlController 從已接納的 parseMediaUrl 結果推導內容鍵 | routing.ts：`A02`，絕對及協定相對 URL 換片 |
| A03 | [RouteCoordinator](../src-v2/application/route-coordinator.ts) 政策版本控制完成結果；[排名](../src-v2/domain/routing.ts) 合法固定主機優先 | routing.ts 與 runtime.ts：`A03`，先完成／晚完成、成功／失敗儲存鎖等待、真正設定訂閱 |
| C-02 | [平台 ID factory](../src-v2/platform/runtime-ids.ts) 由入口注入，請求及量測工作沿用獨立 ID | recovery.ts：`C-02`，雙執行環境、startup／challenge、同工作去重與 64 字元上限；state 既有 schema 讀取 |
| C-03 | [MeasurementController](../src-v2/application/measurement-controller.ts) 取得鎖後先重查安全條件及表示，再記錄候選／冷卻 | recovery.ts：`C-03`，hidden／seek／recovering／低緩衝／表示／停用、取得鎖時間及正常對照 |
| B1 | [XhrHookAdapter](../src-v2/adapters/xhr-hook.ts) 送出前重查最新限制，舊世代不得使用舊計畫 | [xhr.ts](../tests-v2/regressions/functional-races/xhr.ts)：`B1`，HTTPDNS、禁止主機、gate、過期 opaque 歸因 |
| B2 | XHR 等待／原生送出／終止狀態分離，取消只完成一次 | xhr.ts：`B2`，DONE→UNSENT、空回應、重複取消、gate 晚到、原生已送出及明確 timeout |
| B3 | XHR 安全失敗維持 default／text 字串及 json 物件，getter 例外與原生 HTTP 狀態維持 | xhr.ts：`B3` 與正常型別對照；攔截還原保留後來的所有者 |
| B4 | 排隊本地失敗及事件回呼重查 metadata 所有權 | xhr.ts：`B4`，排隊後 reopen、readystatechange／abort／error 內重用 |
| B5 | 同步重開不寫 responseType／timeout；非同步保留 headers／credentials／選項 | xhr.ts：`B5`，同步／非同步、停用前後與正常原生送出 |
| R02 | [SettingsStore](../src-v2/state/settings-store.ts) 單 host 鎖內合併；[ControlCommands](../src-v2/application/control-commands.ts) 明確提供命令 | [control-center.ts](../tests-v2/suites/control-center.ts)：`R02`，連續勾選、序列對照、遠端設定及無效 host |
| R03 | [ControlCenter](../src-v2/ui/control-center.ts) 視圖版本限制命令完成及焦點 | control-center.ts：`R03`，關閉／切頁後完成、排隊焦點及仍開啟正常刷新 |

## 重跑與證據

從儲存庫根目錄執行 `npm test -- application`、`npm test -- progressive-routing`、`npm test -- native-transport`、`npm test -- orchestration`、`npm test -- control-center`。完整門檻為 `npm run typecheck`、`npm run architecture`、`npm test`、`npm run verify` 及 `git diff --check`。套件正式登記，完整執行不允許預期失敗、only、skip、todo 或 cancelled。

原調查證據保存在 `.work/functional-review/2026-10-09-71f7ddd/`，不改寫也不作正式測試輸入。此次本機逐批紀錄與最終交付位於 `.work/functional-fixes/2026-10-09/`；最初移植的失敗紀錄保存在 `.work/functional-review/functional-fixes-*.log`。所有測試使用合成資料，不連線探測真實 CDN。

安全差異審查獨立於 verify，使用 Codex Security 的實際 working-tree 快照，重點涵蓋 Vault 授權刷新、政策失效、舊工作提交及 XHR 攔截。掃描 `7038b1e4-687a-4df3-b492-2cf73065727e` 已於 2026-10-09 完成及封存：41 個變更來源檔全部審閱，覆蓋狀態 `complete`、未完成審查項目 0、可回報發現 0。這是本次差異的靜態審查結果，不是不存在漏洞或瀏覽器驗收通過的保證。

受審快照摘要為 `codex-security-snapshot/v1:sha256:041ddddd42903006c268b668cac1562a53f5c690108c095e31de695d9ee43b14`。主代理審閱 23 個檔案，三個獨立審查分別審閱傳輸 4 個、選路 7 個及量測／恢復 7 個；另有獨立架構模型。實作交付時只補寫文件，正式來源雜湊與受審版本相同。v2.1.9 發行前另核對 45 個來源檔：44 個雜湊保持相同，唯一差異為 metadata 的版本由 2.1.8 改為 2.1.9；執行期邏輯未再修改。權威報告、結果與覆蓋檔案位置見本次 `.work/functional-fixes/2026-10-09/REPORT.md`。

## Chrome 與 Tampermonkey 待驗收步驟

本次新修改 **尚未執行真實瀏覽器驗收**。以下待安排，不重開歷史已完成的 v2.1.6／v2.1.8 驗收。

1. 在日後獲授權的測試版本記錄 Chrome、Tampermonkey、腳本版本與提交；使用合法影片，記錄 DASH／MP4／FLV 的實際可用範圍。不得保存簽名 URL、HAR、Cookie 或播放器物件。
2. XHR：在受控測試頁等待 startup gate 時取消，核對一次 readystatechange／abort／loadend、DONE→UNSENT 與零晚到請求；在事件處理器內 reopen，核對新請求不收到舊終止事件。另測送出後原生 abort／timeout、text／json getter、同步重開、header／credentials 保留。事件契約依 [WHATWG XHR](https://xhr.spec.whatwg.org/#request-error-steps)，自動替身不能證明原生細節。
3. 換片／恢復：於待恢復及 pending play 時切片、seek、停用再啟用，確認新片不被跳回舊位置或舊倍速；同片換畫質正常、每分頁起播窗口不重開。
4. 影音隔離：音訊失敗只更新其路線及證據，影片持續進度時不重載；影片自身無進度且符合 watchdog／起播救援條件時仍可恢復。以有界事件與真實 Network 主機／狀態分開判讀。
5. 控制中心：快速改兩個 Catalog checkbox、跨分頁設定變更、按操作後關閉或切頁，確認資料均保留、視窗不重開、焦點不被晚到回呼奪走。

## 相容性與剩餘限制

保留 Catalog 完整候選池、Vault 唯一授權、Fetch 單讀取器、控制器所有權及 Worker 不介入。舊樣本繼續讀取；隨機前綴避免跨執行環境的確定性序號碰撞，但不能復原歷史覆蓋資料。沒有 Web Locks 時仍沿用原跨分頁序列化限制。

本輪不新增同世代 API 逆序回應政策、清除學習資料屏障或原生 GM 通知競合政策。契約測試及靜態安全審查不證明真實 CDN、瀏覽器事件、所有網站播放器版本均正常；上述真實驗收仍須另行安排；發行狀態獨立記錄於最新版驗證報告。
