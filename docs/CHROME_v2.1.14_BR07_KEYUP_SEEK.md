# BR-07：網站右鍵在 keyup 尋位，未取得新使用者所有權

日期：2026-10-10（Asia/Taipei）。版本：實際 Chrome／Tampermonkey **v2.1.14**，發行提交 `056d1a4a9607ed8e96dda45880ec4f82522230a2`。狀態：**P2，已重現、未修復；BR-06 安裝驗收未通過，BR-01 完整驗收未結案。**

## 結論與影響

指定風景片的右方向鍵，在可信 **keyup** 派送期間才真正前進 5 秒；左方向鍵則在 keydown 尋位。v2.1.14 實作了已選定的「同一 keydown 派送」策略，因此能辨識左鍵，卻漏掉網站實際的右鍵提交入口。這是修復策略與現場使用行為的覆蓋缺口，不能把 keydown 模型測試通過擴大為右鍵安裝驗收通過。

已有停滯時，右鍵雖更新位置及 seekRevision，userRevision 不變，Monitor 將它視為網站重試而沿用舊期限。本次 Auto 1／2 倍有效窗口分別在新右鍵後 **6.995／7.673 秒**備援；1 倍還在新右鍵後 **21.994 秒**重載，而非重新給予 15／30 秒寬限。正常短 seek 可以恢復播放，因此一般播放測試容易漏掉此問題。未觀察到本輪回寫舊位置；主要已證實影響是新使用者操作的期限被縮短。

## 身分與測試邊界

- 只使用使用者指定的 `BV1tFZZBQE57`，全程由網站 Auto 選擇表示，不鎖畫質、不停用其他腳本、不改 Chrome 設定。
- 執行腳本完整包含 `Release/v2.1.14/BiliCDN_TW.user.js` 本體，ControlCenter singleton 為 1。重新連線後再次核對；沒有沿用舊 remote object 身分。
- 公開腳本 317,276 bytes，SHA-256 `fc2a38d182fd94b3c2ffc786510e858f99f41d702ed279a6c88da7edc0d6c02a`。
- 攔截先於 seek 安裝，僅持有 Vault 辨識為當前 generation／epoch 的 video Request；audio 立即通行。沒有取代媒體 getter、Monitor、Recovery 或播放控制器。
- 1 倍停滯由真正進度列點擊建立；2 倍重跑以實際網站 SDK `player.seek(500)` 建立初始停滯，接著使用真正可信 BODY 右鍵。後者初始 seek 是受控 SDK 邊界，右鍵是原生使用者輸入。
- 事件記錄只保存有界純值，不保存簽名 URL、路徑、查詢或播放器物件。原生 hidden 為 false，Runtime 真正可見性為 true。

## 原生事件證據與正常對照

無故障的 Auto 1 倍、BODY 焦點，取得下列原生順序：

| 事件位置 | 影片位置 | seeking | userRevision |
| --- | ---: | --- | ---: |
| Right：keydown capture | 1105.655021 | false | 13 |
| Right：keydown window 尾端，phase 3 | 1105.655021 | false | 13 |
| Right：keyup window 尾端，keyup phase 3／keydown phase 0 | 1110.655021 | true | **13** |
| Left：keydown capture | 1112.145688 | false | 13 |
| Left：keydown window 尾端，phase 3 | 1107.145688 | true | **14** |
| Left：keyup | 1107.145688 | true | 14 |

Auto 2 倍的播放器焦點對照也呈現相同行為：左鍵在 keydown 更新一次修訂，右鍵到 keyup 才尋位且未更新。觀察網站公開 seek 方法的相容包裝，在右鍵入口沒有接到呼叫；直接媒體尋位與原生事件證據已足以定位入口，不推定其他腳本的內部實作或其責任。

## 有效停滯窗口

| 證據 | Auto 1 倍 | Auto 2 倍重跑 |
| --- | ---: | ---: |
| 新右鍵焦點 | 播放器 DIV | BODY |
| isTrusted | true | true |
| 新目標 | 1953.601941 → 1958.601941 | 500.5 → 505.5 |
| userRevision | **8 → 8** | **3 → 3** |
| 初始 seek 至備援 | 15.942 秒 | 15.957 秒 |
| 新右鍵至備援 | **6.995 秒** | **7.673 秒** |
| 新右鍵至重載 | **21.994 秒** | 有效窗口尚未涵蓋重載 |
| 被持有 video／通行 audio | 7／5 | 9／4 |
| 被持有 audio | 0 | 0 |
| 有效窗口 Network 截斷／觀察列丟失 | false／false | false／false |

1 倍故障與備援窗口的 Auto 狀態成立；重載過渡中選單短暫無有效項目，未將該空值誤認為鎖定畫質。兩輪最終均恢復實際播放。2 倍重跑的有效連續捕捉涵蓋故障、釋放及之後約 7 秒；更晚的收尾 Network 緩衝有淘汰，該尾段只保留狀態／清理證據，不作完整 30／15 秒或網路終止矩陣通過依據。

## 根因與精確位置

1. [player.ts:88](../src-v2/adapters/player.ts#L88) 只註冊 keydown 候選，沒有可信 keyup 的實際命令觀察入口。
2. [player.ts:136](../src-v2/adapters/player.ts#L136) 建立的候選持有原 keydown；[player.ts:155](../src-v2/adapters/player.ts#L155) 在其 `eventPhase === NONE` 時撤銷。右鍵真正於 keyup 改位置時，原 keydown 已結束，所以不會增加 userRevision。零延遲清理不是這項缺口的唯一原因，延長 timer 也不能跨過明確 phase 檢查。
3. [player-monitor.ts:165](../src-v2/application/player-monitor.ts#L165) 只有 userRevision／媒體身分改變才結束舊停滯段；[player-monitor.ts:172](../src-v2/application/player-monitor.ts#L172) 的單純 seekRevision 重綁保留 startedAt。這個規則本來用來阻止網站／Auto 重試無限延長期限，不能把所有 seekRevision 改變都改成使用者操作。
4. 正式 [br06.ts:105](../tests-v2/regressions/functional-races/br06.ts#L105) 模型將左右鍵都安排在 keydown 執行。來源隔離同樣證明同派送策略，沒有覆蓋網站右鍵的 keyup 提交；此處是需要校準的測試前提。

## 獨立契約與重跑

證據根目錄：`.work/functional-fixes/br06/2026-10-10-45a4420/`。本輪沒有修改執行期或正式測試；私有調查案例不加入正式登記。

```powershell
node .work/functional-fixes/br06/2026-10-10-45a4420/run-br07-contracts.mjs
node node_modules/typescript/bin/tsc --noEmit -p .work/functional-fixes/br06/2026-10-10-45a4420/br07-tsconfig.json
node .work/functional-fixes/br06/2026-10-10-45a4420/analyze-br07.mjs
npm test -- application --name BR-06
```

正確行為契約：**2 fail／3 pass，退出碼 1**。失敗為 `BR-07 trusted right seek during keyup acquires one new user revision`、`BR-07 trusted keyup seek receives a fresh 15000 ms grace`；正常對照為 keydown 左鍵、滑鼠新寬限及合成 keyup 不得取得身分。沒有斷言錯誤行為應成立，也沒有 only／skip／todo／cancelled。私有 TypeScript 檢查通過。Node 可信事件只是型別化模型，原生可信性與派送順序由 Chrome 證明。

既有正式 BR-06 **40／40** 再跑通過，說明其覆蓋未包含這個實際入口。它不代表新增缺陷通過；發布前 514 正式案例、安全審查及來源隔離結果仍保留其原範圍。

主要證據檔：`installed-identity.json`、`installed-retry-identity.json`、`installed-keyup-right-left-control-1x.json`、`installed-keyup-trace-right-2x.json`、`installed-valid-key-stall-1x-final.json`、`installed-valid-body-stall-2x-fresh.json`、`br07-analysis.json`、`br07-contracts-result.txt`、`installed-cleanup.json`、`installed-retry-cleanup.json`。

首次點擊沒有真正改變位置、小窗中的不可見進度列，以及起始游標過舊的第一輪 2 倍網路紀錄，均保留為校準／無效窗口，不列故障驗收。重試時重新取得真正 Chrome、重新核對本體／singleton，並在攔截前更新單一游標；沒有用內建瀏覽器冒充 Tampermonkey。

## 清理與限制

每輪釋放 held requests、清空 Fetch patterns，保留 request ID 學習寫入過濾至晚到結果；最後取消計時器、DOM 監聽器、路線／恢復訂閱，僅還原仍屬自己持有的 XHR send、evidence.record 及 site.seek 包裝，移除觀察器並停止 Network。

第一輪過濾集合含保守收集的無歸因 ID，172 個 ID 的記憶體／schema 2 持久樣本匹配均為 0；重跑修正驗收器的非空 kind 判斷後，41 個受控 ID 的兩者匹配仍為 0，held 剩餘 0。沒有清除使用者學習資料。末次狀態為 Auto 2 倍、非 seeking／非 paused、實際位置及影格前進；後段網路捕捉限制如上。

## 最小修正方向與後續驗收

先調整既定的 keydown-only 設計：在真正可信、同一 **keyup 派送**內觀察右鍵提交，保留有限目標變更、播放器／媒體／內容身分、真正可見性及輸入排除條件。需處理同一操作的 keydown／keyup 去重、長按／repeat、忽略／例外、焦點變更與腳本自身還原；不可將任意派送後 Promise／timer 或所有 seekRevision 視為使用者命令，也不直接引入時間關聯窗口。

必要回歸：右鍵 keyup 取得一次身分及新 14,999／15,000、29,999／30,000 ms 邊界；左鍵 keydown 不重複計數；長按加速釋放是否真的 seek；合成／editable／IME／修飾鍵／hidden／生命週期失效排除；新操作撤銷舊 token、晚到 reload／play 不回寫。先校準網站原生左右鍵時序，再建立正式失敗契約。

本輪依已批准計畫「新缺陷另寫報告，不自行擴大修復範圍」交付 BR-07，沒有直接改寫新政策或再發版。完整重載後 15 秒無進度退出、不重試、拖曳／pointercancel、真正 hidden、晚到 SDK／核心替換、生命週期／政策與影音隔離，以及 BR-02～05 新版交叉驗收仍待完成。原 87.785 秒自然網路起因也未結案。
