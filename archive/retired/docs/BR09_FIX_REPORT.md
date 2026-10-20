# BR-09 修復與交付 — v2.1.18／2026-10-11

**BR-09 修復與 v2.1.18 正式發布通過；實際新版身分及 Auto1／2 基本回歸通過。** 03:13:23（Asia/Taipei）發布，main／tag／唯一附件及無認證公開 latest 完整核對；334,747 bytes／SHA-256 `812fa114b1b99d0a38f4d1df9622bce416147b05c048693d68ce4b24b16831c9`。本輪只修 BR-09，不擴展 BR-01 的整體重複驗收。原 [失敗報告](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md)及 v2.1.17 [最後二元判定](BR01_v2.1.17_FINAL_ACCEPTANCE.md)保持原事實。

## 根因與修改

自有 reload 將原生媒體重設到 HAVE_NOTHING 時，直接設定 currentTime 可改变位置而沒有 seeking。SDK 尚回傳舊快取；PlayerAdapter 原先只辨識公用 seek 包裝或 seeking，因此保存 0.25 的舊恢復意圖在觀察到 0.7→0 後仍可能回寫 0.25。這是可重現的 P2 位置所有權缺口，不把未完整歸因的網站回退都歸入此問題。

[PlayerAdapter](../../../src-v2/adapters/player.ts)新增私有單筆 NativePosition：媒體、播放器、內容 lifecycle、有限原生位置及 readyState。controls 確認鍵盤後採樣；當目前 readyState=0 且位置改變，更新既有 targetSec，適用時增加 seekRevision，Recovery 沿原所有權檢查撤銷 restorePosition。0 是有效位置，NaN／Infinity 不覆蓋有效基準。

讀取後再次核對控制版本、原基準、媒體、播放器、lifecycle、seek/user 修訂及 pendingSeek，避免 getter 同步重入提交舊結果。reset／媒體／播放器替換清除基準。reload 的 finally 同步採樣，保留本次正常初始零；來源標記一定釋放，觀察例外不得替換 SDK 原結果或原例外。已初始化正常播放增量不變成 seek。腳本自己的 seek、pendingSeek 及公用 seek 去重維持原契約。

未知原生目標只撤銷過期位置，不授予 userRevision、不重開 15／30／15 秒、不放寬路線或禁止規則。本輪沒有新增 API、應用介面、設定、schema 2 欄位、主動網路、診斷原生值或 Worker 操作。

## 正式契約對照

正式 [br09.ts](../../../tests-v2/regressions/functional-races/br09.ts)由既有 [application](../../../tests-v2/suites/application.ts)明確匯入。原五項先於執行期改動保存 **2 fail／3 pass**，修復後 **5／5**；擴充為 **25／25**，沒有調查目錄正式輸入。

| 群組／測試名称關鍵字 | 修復及回歸 |
| --- | --- |
| correct contract／normal control（原五項） | 未初始化未知正值及零撤銷；公用 seek、native seeking、未變目標對照 |
| 1x／2x unknown positive then zero、reload deadline | 兩速保留 0、不授予 userRevision；14,999／15,000 ms timeout 與三 tick 不重試 |
| synchronous reload／public seek／pendingSeek | 初始正常零保留，之後觀察新目標撤銷；同步非零結尾、去重與自己還原來源 |
| initialized／invalid | 正常播放不作 seek；非有限原生值不丟失有限基準 |
| reset／media／SDK／content lifecycle | 基準及動作不得跨所有者 |
| synchronous native read | getter 內 reset／新公用 seek 不能被舊結果蓋掉 |
| observation／original exception | SDK 回傳及原例外身分、來源標記清理 |
| late reload resolution／rejection | 新零目標或 reset 後晚到 Promise 不回寫舊位置、不復活動作 |

重跑正式契約：

```powershell
npm test -- application --name BR-09
```

## 自動、安全與 Chrome 證據

基準 v2.1.17／7ad32efb6fba09300f61c333812642efc6acb6f5，保留執行前八份未提交的驗收／索引／狀態文件。工具 Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2。完整 **19 套件／741 項、0 fail／skip／todo／cancelled**；application256、adapters102、typecheck、architecture44通過。最終 v2.1.18 verify 與發布結果見 [TEST_REPORT](../../../docs/TEST_REPORT.md)，未執行的項目不計通過。

獨立 Codex Security 差異 **ad0243d6-46b4-4245-a78e-1a1e8cc58f9c** 已於 2026-10-10T19:07:25.298326Z 封存，**3／3 來源／測試項、0 候選／0 發現**。凍結檔案為 player.ts、br09.ts、application.ts，發布前再核對雜湊。版本／文件／產物在封存後獨立核對，不冒充整個目錄始終不變或全倉安全審查；verify 不包括該掃描。

Chrome 自有 iframe 使用真正原生媒體／WAV Blob，確認實際 playbackRate **1／2**；四種恢復情境每速一次，**8／8**，另 **4／4** 原生邊界通過。未知零保持 0，未知正值保持 0.7，公用零保持 0，未改變目標仍正常還原 0.25。SDK／核心／Clock 受控，沒有取代原生媒體 getter、外送探測或學習樣本；iframe／影片／Blob 已清理。这是來源隔離，不是新版安裝 singleton 窗口。[本版瀏覽器紀錄](CHROME_v2.1.18_ACCEPTANCE.md)保留兩種證據的獨立判定。

## 私有重跑與檢查點

新證據 `.work/functional-fixes/br09/2026-10-11-7ad32ef/`：baseline、before-contracts、expanded-contracts、application、adapters、all-tests、typecheck、architecture、chrome-source-rates、installed-before-identity 與 CHECKPOINT。原調查目錄不回寫。

來源入口 `br09-native.ts` 透過本機 esbuild 封裝為 `br09-native.js` 後，只注入自有同源 iframe；呼叫該入口的 runNativeRecovery／runNativeBoundary 矩陣，最後移除 iframe 與 Blob。不得把私有入口加入正式測試 registry 或產品 bundle。執行 body／版本核對使用指定影片當前實際 userscript，不以 release.json 代替安裝身分。

## 限制及下一個判定

完全未經採樣、SDK 或媒體事件觀察的原生位置往返無法可靠辨識；本輪不建立網站 currentTime 全域 setter hook、不猜測這類操作身分。原 87.785 秒自然網路起因仍未定位。BR-01 其餘二元不通過項目不是本輪新修復範圍。

更新後 **2026-10-10T19:17:48.347Z** 已實際核對 v2.1.18 完整 IIFE 328,497 字元、Runtime／ControlCenter／PlayerAdapter 各唯一 1；同片 Auto1／2 的基本播放、UI 暫停／恢復、公用 SDK 短 seek 後時間／影格進度通過，reloadCount=0。沒有安裝長故障攔截、改媒體 getter 或新控制器。原缺陷的未知目標因果矩陣仍明確屬來源隔離，沒有宣稱網站 singleton 完整故障重現；BR-01 整體不通過狀態不因此結案。
