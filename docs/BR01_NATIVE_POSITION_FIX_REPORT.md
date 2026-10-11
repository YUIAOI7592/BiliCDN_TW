# BR-01 新救援意圖保存過期 SDK 位置 — 2026-10-11

基準 v2.1.19／ff725e918793531cb39bd9aa7d506779360c754e，開始時工作目錄乾淨。修補目標 v2.1.20；發布及實際安裝結果見 [最新驗證](TEST_REPORT.md)。此修正不代表 BR-01 完整安裝矩陣通過。

## 實際缺口與影響

指定風景影片、Auto 2 倍、真正可信 Right keyup 後，原生 currentTime 與 controls.targetSec 均為 **1949.969979**，userRevision **2→3**。其後新建立的 paused-transition 意圖仍保存 **1944.969979**：SDK 在 HAVE_NOTHING 時回傳尋位前的快取位置。這不是舊 token 未撤銷，而是新 token 第一次保存就使用舊值。

現場一次實際 reload 於 1791694029515 ms 發生，1791694044514 ms 以 reload-timeout 結束並釋放意圖，後續沒有重試。**這個現場窗口沒有觀察到 Adapter.seek 回寫舊值**，不能宣稱已證明網站倒退；潛在影響是後續核心可初始化並允許還原時，使用者新目標被錯誤保存的舊位置覆寫。正式因果契約確實證明該條路徑可回寫 120 而非新目標。

原始私有證據保留於 .work/functional-fixes/br01-final/2026-10-11-953ffea/：219-auto2-empty-core-new-full-before.json、219-auto2-empty-core-full-input.json、219-auto2-empty-core-full15-30-15.json、219-auto2-empty-core-full-network.json。它是既有長暫停／死核心 4 秒恢復路徑，**不算完整 15／30／15 停滯驗收**。

## 根因、契約與修正

[PlayerAdapter.currentTime](../src-v2/adapters/player.ts) 原先始終優先 getCurrentTime，僅在 SDK 非有限值時才回退原生快照。[RecoveryController.#begin](../src-v2/application/recovery-controller.ts) 對非 stall 意圖讀取此值，並依既有前後 controls／生命週期／資格檢查提交。所有權沒有改變，因此那些檢查不能識別同一 SDK 的過期快取。

修正僅在目前媒體 readyState===0 且原生 currentTime 有限時，以該值保存新目標，**0 也有效**。其他狀態、非有限原生值或 native getter 拋錯仍走既有 SDK／snapshot 回退。該讀取只返回數字，不建立 userRevision、路線權限或新恢復政策。讀取前後的同步媒體／核心／操作／生命週期撤銷仍由 RecoveryController 負責。

未新增公開 API、設定、持久欄位、Worker 行為、遠端載入或診斷欄位；Auto／ABR、15／30／15、額度、breaker、影音隔離及 schema 2 保持。例外回退不宣稱覆蓋 video() 選取或所有既有 snapshot getter。

## 契約與結果

正式案例位於既有 application 匯入的 [br09.ts](../tests-v2/regressions/functional-races/br09.ts)，不讀取調查目錄。

| 群組 | 案例 | 修復前 | 修復後 |
| --- | --- | --- | --- |
| 新目標讀取 | 1／2 倍 × 0、5、978 | 6 fail，全部讀到 SDK 120 | 6 pass |
| 新 paused-transition 保存／還原 | 同上，真正 Adapter→Recovery | 6 fail，還原 120 | 6 pass，還原新目標 |
| 正常對照 | 已初始化 SDK 語意、非有限 native、getter 例外、同步換媒體 | 4 pass | 4 pass |
| 既有 BR-09 | 未知位置、初始歸零、來源抑制、重入、晚到結果 | 25 pass | 25 pass |

先保存正式來源未改時 12 fail／4 pass。初始新增換媒體測試的呼叫參數被 typecheck 抓到，已修正為傳入 VideoSnapshot，不以型別斷言掩蓋。修正後再以 git show ff725e9 的原 PlayerAdapter 建置全部 41 案，仍為 **12 fail／29 pass**；正式來源沒有為此回滾。最終 16 案、application 286 及全套 771 通過；完整整合／發布以最新驗證為準。

重跑：`npm test -- application --name 'BR-01 native position'`。私有可重跑入口 .work/functional-fixes/br01-native-position/2026-10-11-ff725e9/build-baseline.mjs 只在建置中替換原版本，不修改正式來源；修復前失敗紀錄不能當正式全綠。

## 安全與 Chrome 證據

Codex Security 2661c0e4-d1dc-44cc-b4a6-089883858759 於 2026-10-11T05:02:52.273269Z 封存，**2／2 差異項、0 候選／0 發現**。獨立架構複核了位置觀察與恢復／Vault 授權的分離。受審 runtime SHA-256 417fdbdcd229e47a5d7e7f75584fb8cfe55eac0e57b24859e62b4a142d0afa28，封存後未變。封存測試的參數錯誤另以單行 test-only 修正；父代理審查此差異及重新驗證，不宣稱封存的測試雜湊等於最終測試。政策工具誤報 Windows 根目錄不存在，人工確認根 SECURITY.md 為唯一適用政策。安全封存不回写。

Chrome 來源隔離 **12／12**：6 案使用真正空 video 的原生 HAVE_NOTHING／currentTime，不覆寫 getter；6 案使用自有 iframe 內受控媒體狀態與真正 Adapter／Recovery／FakeClock，明列控制模型。own video=0，iframe 已移除。沒有改網站媒體 getter、控制器、Chrome 設定或其他腳本。這些結果不代替新版 Tampermonkey singleton。

## BR-01 安裝判定與續行

[v2.1.19 實際續測](BR01_v2.1.19_INSTALLED_CONTINUATION.md) 的正常 Auto1／2、12 秒播放中 video 延遲及 Auto1 完整期限等有效子項為通過。Auto2 完整停滯、真正 hidden、晚到 SDK 全矩陣與自然 pending gate 等沒有完整證據，**整體不通過**。新版本必須核對完整執行本體及唯一 singleton 後，重跑新位置保存與剩餘矩陣。提前 pause／error／外部換核心只證明撤銷，不能補算完整期限；同片自然 gate 缺前提也不算通過。原 87.785 秒自然網路起因獨立未定位。
