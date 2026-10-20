# CR-01～05 與 XHR 修復報告

日期：2026-10-13。基準 v2.1.22／`c4e7de4`，保留開始時五份未提交調查文件。目標版本 v2.1.23；本報告分開記錄正式契約、原生來源隔離、安全審查、發布與實際安裝。

## 修復範圍

[原調查](CODE_REVIEW_2026-10-13.md)的五項確認缺陷已修復。一次有界 IAB 原生定位另確認 S-01、S-03，合計七项；S-02 沒有取得必要原生對照，不作推測性修改。公開 API、GM 權限、設定、schema 2 及執行期依賴不變。

| 項目 | 修復與契約 | 來源／正式案例 |
| --- | --- | --- |
| CR-01 | 原樣通行與選中的原線分離；返回原線解析 Vault 精確 handle，檢查當前身分、政策及禁止規則；同主機 DASH 保留當次查詢字串 | [routing](../../../src-v2/domain/routing.ts)、[RouteCoordinator](../../../src-v2/application/route-coordinator.ts)、[cr-routing](../../../tests-v2/regressions/functional-races/cr-routing.ts) |
| CR-02 | MP4／FLV 正規化、去重及限額後比較 URL 集合；換序及同集合 primary 變更保留身分與 handle，更新標準來源／順序；真換簽名仍撤銷 | [Vault](../../../src-v2/state/signed-route-vault.ts)、[cr-routing](../../../tests-v2/regressions/functional-races/cr-routing.ts) |
| CR-03 | 第一個合法起播窗口開始即消耗分頁預算；後來等待者先加入 pending；reset 不恢復預算，沒有合法候選不消耗 | [MeasurementController](../../../src-v2/application/measurement-controller.ts)、[cr-startup](../../../tests-v2/regressions/functional-races/cr-startup.ts) |
| CR-04 | planning／running 由各輪所有權在 finally 釋放；probe／鎖／寫入拒絕以固定原因收束，冷卻後可再量測；舊完成／拒絕不清除新工作 | [MeasurementController](../../../src-v2/application/measurement-controller.ts)、[errors](../../../tests-v2/regressions/functional-races/cr-measurement-errors.ts)、[lifecycle](../../../tests-v2/regressions/functional-races/cr-measurement-lifecycle.ts) |
| CR-04 儲存對照 | set 成功後才發布記憶體 payload；失敗不得留下成功樣本，也不算 CDN 失敗 | [EvidenceStore](../../../src-v2/state/evidence-store.ts)、[lifecycle](../../../tests-v2/regressions/functional-races/cr-measurement-lifecycle.ts) |
| CR-05 | 只有首次有效回應建立進度基準；額外同身分／路線成功不撤回已確認進度或首次 playbackAt，也不延長觀察期限 | [recorder](../../../src-v2/diagnostics/recorder.ts)、[cr-diagnostics](../../../tests-v2/regressions/functional-races/cr-diagnostics.ts) |
| S-01 | header 在公開入口依 ByteString 轉換一次，原生接受後才存字串；內部 reopen 不再次呼叫原物件，重入後選擇正確 metadata | [XHR](../../../src-v2/adapters/xhr-hook.ts)、[cr-xhr-headers](../../../tests-v2/regressions/functional-races/cr-xhr-headers.ts) |
| S-03 | 字串分支 body 在變更 phase 前完成 USVString 轉換；失敗後仍可更正送出。平台品牌檢查保留跨 realm 原生 body；轉換內 open／abort 以當前所有者處理 | [XHR](../../../src-v2/adapters/xhr-hook.ts)、[cr-xhr-send-conversion](../../../tests-v2/regressions/functional-races/cr-xhr-send-conversion.ts) |

全部正式新增案例由既有套件匯入，不依賴 `.work`。原 12 案及正常對照先移植，再修改執行期；未修失敗不算通過。

## 修復前後與重跑入口

| 證據 | 結果 |
| --- | --- |
| 原 CR-01～05 正式契約，未修來源 | 12 案，6 fail／6 pass |
| 同一 12 案，首次修復後 | 12／12 |
| S-01／S-03 正式契約，未修 XHR | 新六案 2 fail／4 pass；篩選日誌含既有正常對照，共 16 案、2 fail／14 pass |
| CR-04 記憶體發布補充契約，未修 EvidenceStore | 失敗；寫入拋錯後仍看見成功樣本 |
| 最終全套 | 19 套件、841／841，比原 808 新增 33 案；0 fail／skip／todo／cancelled |
| 分批套件 | progressive-routing 29、orchestration 38、measurement-state 40、diagnostics 16、native-transport 147，均通過 |
| typecheck／architecture | 通過；44 個執行期模組架構檢查 |

```powershell
npm test -- progressive-routing
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

原生交錯依 [XHR](https://xhr.spec.whatwg.org/) 與 [Web IDL](https://webidl.spec.whatwg.org/#es-union)校準。`cr-measurement-errors` 使用獨立 Node 子程序觀察未處理拒絕，輸入只來自本機正式測試來源，沒有網路、正式儲存或共用可變狀態。

## IAB 原生來源隔離

只使用 Codex 內建瀏覽器的可見自有 loopback 頁面；真正 XHR、合成回應及記憶體依賴。没有操作正式設定、學習資料或安裝 singleton，也沒有重開 BR-01／P01／P02 窗口。

| 原生／hook 對照 | 修復前 | 修復後 |
| --- | --- | --- |
| S-01 header 物件與內部 reopen | 原生轉換一次，hook 兩次；一般字串正常 | 兩者一次、HTTP 200 |
| S-03 body 轉換拋錯後更正 | 原生保留原例外並可再送；hook 第二次 InvalidStateError | 兩者同一原例外、可更正送出，HTTP 200 |
| 跨 realm body | 未列修復前門檻 | Blob、Document、FormData、URLSearchParams、ArrayBuffer、Uint8Array、DataView 七組各與原生一致 |
| body 轉換內 open／abort | 依原生模型校準 | 兩組各只送出一次、HTTP 200；未 send 時 abort 不把原生 OPENED 清成 UNSENT |

修復後 **11 組／22 筆觀察全部相符**。這是修復來源驗證，不是實際 Tampermonkey 安裝版矩陣。

S-02 僅完成精確 HTTPDNS 攔截控制，請求在送出前被捕獲並取消；没有執行 relative URL／文件 base 的原生差異對照。單次工具呼叫耗時 389.4255 秒，整個定位窗口達 15 分鐘上限，依停止規則收束。工具逾時不證明產品缺陷，不再次循環重跑。

清理：自有 IAB 分頁 53／54 已關閉、iframe 移除、hooks 還原、請求終止、Fetch patterns 清空、loopback 14123 服務停止。HTTPDNS 控制請求沒有外送。原生校準發現替身的 unsent abort 語意錯誤，已修正正式替身及對應契約，沒有修改產品迎合替身。

## 獨立安全差異審查

Codex Security 掃描 `54077ae0-1f99-479d-bbea-e66e08f57e31` 已於 `2026-10-13T15:07:25.758289Z` 封存：23／23 個變更來源／測試檔、0 候選、0 可報告發現。核對 Vault 授權、原線實體化、量測所有權與例外、診斷單調證據、XHR 轉換／重入／平台品牌。獨立架構與兩個分區複核完成；不是全儲存庫安全保證。

固定差異摘要為 `codex-security-snapshot/v1:sha256:85faf012e78350492acb676cadf2e7faacb7b124f0eec3468f6563e4c5bf5252`。工具回報 8,709,858 tokens，來源 codex_rollout、3 threads，包含同任務累計 context，**不是本次修復的增量成本**。後续版本／文件／封裝不冒充掃描範圍。

Windows 政策解析 helper 無法辨識路徑，複核者改以直接讀取確認只有根目錄 SECURITY.md 適用。另記 raw SharedArrayBuffer 不在本次七種原生 body 矩陣，沒有確認相容性結果；不把它列為已確認缺陷或安全發現。

## 證據與剩餘限制

私有證據根目錄：`.work/functional-fixes/cr01-cr05/2026-10-13-c4e7de4/`。

- `BASELINE.json`：提交、狀態、版本、工具與來源雜湊。
- `before.log`、`after-first.log`、`xhr-formal-before.log`、`evidence-before.log`：不可覆寫的先紅後綠證據。
- `full-test.log`、分批日誌、`typecheck.log`、`architecture.log`、後續 `verify.log`：正式執行結果。
- `XHR_BEFORE.json`、`XHR_AFTER.json`、`xhr-browser.ts`、`xhr-server.mjs`：原生矩陣、控制與清理。入口只供自有 loopback，不能接正式儲存。
- `CHECKPOINT.md`：續行位置；安全 canonical 原件由 Codex Security 封存，與一般 verify 分開。

S-02 保留未確認、無新增修復；共享記憶體 body 未校準。BR-01 與原自然停滯原因持續跳過，P01／P02 安裝窗口限制封存，其他已通過瀏覽器案例不重測。這些限制不改記為通過。

## 發布與安裝

**七項修復與 v2.1.23 發布完成。** 最終 verify 退出 0，包含 841 契約、確定性建置、語法、v2-only 與暫存封裝校驗。GFM／連結、歷史保留與差異檢查通過。

於 `2026-10-13T15:14:37Z` [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.23)。發布提交與當時遠端 main／peeled tag 均為 `f219caa93b93c7f468e71cf2efdabe8bb8e33673`；tag ref 為 `24e7f68520d6ea2343f9b34ab6eb9090121a894c`。唯一附件 `BiliCDN_TW.user.js`，343,834 bytes；SHA-256 `ae68637fd73599d6561ca396249246c64f070491030a5e106260d597ceb41f2a`。未帶憑證的公開 latest 於 `2026-10-13T15:15:58.554Z` 核對版本、大小及完整雜湊一致。封裝快照在同一發布提交，後續文件補記不回寫快照或標籤。

**首次安裝核對尚未成立。** IAB 公開 latest 入口只到沒有確認按鈕的 Tampermonkey 中繼頁。指定影片的新文件完整執行本體仍為 v2.1.22：335,099 字元，包含與 v2.1.22 Release 完全相同的 332,291 字元 IIFE，該段 SHA-256 `7de1d31f1f7298275eee71a3b9c68b5612e70f515efce4aa1edf3160df7113de`。事件沒有截斷。沒有在舊版執行本輪驗收，Debugger 已停用、自有分頁 55／56 已關閉；沒有改設定或學習資料。

使用者隨後完成更新，`2026-10-13T15:22:07.770Z` **v2.1.23 實際安裝身分核對通過**：完整執行本體 340,281 字元，包含與正式附件逐字相同的 337,472 字元 IIFE，該段 SHA-256 `9e97abd7dbab28eb633b46f1774a7b381c562d41109a8dcd994600145f05589f`。RuntimeController／ControlCenter 各 1；Fetch 與 XHR open／send／setRequestHeader／abort 的函式位置均屬於這份新版腳本。事件無截斷，沒有替換 singleton 或變更設定。

此結果證明新版完整本體及 hooks 已載入；七項因果契約的證據仍分別是 Node 與上述 IAB 原生來源隔離，不擴大宣稱整份安裝矩陣通過。object group、Debugger 與自有分頁 57 已清理；沒有重測舊通過案例。`RELEASE_VERIFICATION.json`、`INSTALLED_PRECONDITION.json`、`INSTALLED_IDENTITY.json` 分別保存發布、首次舊版與更新後身分證據。
