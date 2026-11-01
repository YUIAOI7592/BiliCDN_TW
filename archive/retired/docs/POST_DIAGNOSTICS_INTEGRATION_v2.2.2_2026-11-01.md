# BiliCDN_TW v2.2.2：診斷撤除後整合盤點

日期：2026-11-01（Asia/Taipei）。本報告在公開 v2.2.2 交付核對完成後開始，只分析 O01–O04，不實作整合。工作狀態由 [TODO](../../../docs/TODO.md) 維護；發布與零殘留證據由 [TEST_REPORT](../../../docs/TEST_REPORT.md) 維護。

## 凍結基準與方法

分析基準為 `v2.2.2` 所指的提交 **f4cc2e45689b5b9c4b0e99d82f65be38d7600132**；標籤物件為 `49f4da56426a6c86e6f3b1c21f529524ae7518cc`。開始分析前已核對公開 main、標籤、唯一附件與 latest 下載：版本 2.2.2、419,470 bytes、SHA-256 `ffece767ff55ddcd08db7fb286189d49cf6bd4d4e141dd283648b6d29548bd08` 全部一致。後續文件提交不移動標籤、不重封裝或再次發布。

第一階段完整閱讀 211 檔、58,535 行；逐檔原始雜湊與連續範圍保存在 [發布時固定報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/Release/v2.2.2/TEST_REPORT_v2.2.2.md#全文閱讀覆蓋清單)。第二階段沿用該基準，重讀下列候選的定義、寫入、讀取、訂閱與測試組裝；引用搜尋只用於交叉核對消費者。來源連結固定到上述提交，行號不隨 main 的後續文件維護漂移。

A01–A03 已關閉；沒有新增確認診斷殘留或待釐清項目。下列項目屬於撤除後可收斂的資料介面、重複工作與測試組裝，或應保留的功能控制資料。僅測試使用的介面不會因此自動成為診斷功能；仍須判讀它驗證的行為。原 [v2.2.1 清查報告](CODE_AUDIT_POST_DIAGNOSTICS_v2.2.1_2026-11-01.md) 原文與當時判定保持。

## 排序與建議邊界

| 編號 | 項目 | 排序 | 建議範圍 |
| --- | --- | --- | --- |
| O01-1 | `recentPlans`／`lastSuccess` 快照投影 | 優先整理 | 移除沒有正式畫面消費者的投影；功能行為改以決策與完成狀態驗證 |
| O01-2 | 總覽／CDN 首次重複 refresh | 優先整理 | 確定一個初始化刷新所有者，保留一次 snapshot |
| O01-3 | 路線通知引起的重複完整快照 | 可延後 | 僅評估 UI 通知合併；不合併功能事件或改變恢復交接 |
| O01-4 | `latestVideoHost()` 與私有最後成功摘要 | 可延後 | 明確處理僅測試消費的既有契約，再決定是否撤除方法與狀態 |
| O02 | 模型版本、`releaseStage`、未使用時鐘依賴 | 優先整理 | 刪除未讀取的模型欄位與依賴，保留真正顯示版本及時間的入口 |
| O03-1 | 重試證據控制介面與測試權限 | 優先整理／可延後 | 先移除未引用型別；抑制能力的重新封裝另列較高風險工作 |
| O03-2 | 重試成功帳本與在途狀態交接 | 維持現狀 | 保留嚴格成功資格、有界資料與狀態交接，不併入一般學習樣本 |
| O04-1 | 長情境鏈與繼承式 fixture | 優先整理 | 按行為拆分必要前置狀態，不刪案例、斷言或清理 |
| O04-2 | 無效常值、未讀回傳欄位、舊私有名稱 | 優先整理 | 逐項確認無副作用後清理；保留原案例名稱及選擇器 |
| K01 | 恢復事件、當前總覽、getter／操作副作用 | 維持現狀 | 不以精簡為由移除功能所有權、畫面資料或必要前置動作 |

此排序反映修改邊界與證據強度，沒有量測 CPU、記憶體、渲染時間或實際播放收益。可減少的負擔僅指目前可直接確認的投影、掃描、欄位、重複呼叫及不必要測試前置狀態。

## O01：事件、訂閱與快照

### O01-1：收斂沒有正式消費者的路線投影

- **定義與寫入：** [RouteSnapshot](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/route-contracts.ts#L101) 宣告 `recentPlans` 與 `lastSuccess`。[RouteCoordinator.snapshot()](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/route-coordinator.ts#L1519) 每次展開全部 `#plans`、排除當前表示再取最後四筆，另將 `#lastSuccess` 轉成物件。
- **讀取消費者：** 三頁視圖與 status-summary 沒有讀取這兩個欄位。`recentPlans` 的有效斷言在 [application](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/suites/application.ts#L1716) 驗四筆上限、[routing convergence](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/regressions/functional-races/routing-convergence.ts#L310) 驗外層重入決策。adapters 的 `promotedPlan` 只被建立並放回 fixture，沒有後續讀取；另有 `void snapshot().recentPlans`。`lastSuccess` 投影沒有正式讀者，也沒有測試直接讀取。
- **建議與負擔：** 後續先把計畫重用／重入測試改成各表示的決策身分與事件斷言，再移除兩個快照欄位。可以減少每次畫面快照的全計畫展開、四筆摘要組裝與最後成功物件複製。保留真正用於選路重用的 `#plans`；不順帶刪除私有 `#lastSuccess`，後者另見 O01-4。
- **風險、相容影響與契約：** 改變內部匯出的 `RouteSnapshot` 形狀，相關型別與測試組裝須同步調整；不影響使用者操作與儲存格式。不得以刪除四筆上限斷言掩蓋仍存在的無界新集合，也不得削弱現有重入／外層提交順序。總覽仍需要 `activePlan.ranking`、`latest`、`requested`、表示歸因與備援狀態，不能整包移除路線快照。
- **驗證：** 保留 40 群組逐組重用、重入的內外層獨立決策與事件順序；驗證總覽與詳細狀態內容、CDN 一次 snapshot、完整案例對照、型別與架構。若另決定保留相容欄位，必須記載期限與實際消費者，不能改成空陣列充當完成。

### O01-2：統一首次畫面刷新的所有者

- **定義與寫入：** [ControlCenter 導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/ui/control-center.ts#L194) 取得一份模型、傳給 view，再呼叫 `#refresh(model)`；[overview](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/ui/overview-view.ts#L170) 與 [CDN](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/ui/cdn-view.ts#L91) 在回傳 binding 前也已 `refresh(initialModel)`。
- **讀取消費者與現況：** 同一份模型先由 view 更新，再由中心呼叫 binding.refresh 更新。這是首次 DOM 更新重複，沒有第二次取得完整快照；不能將其描述成違反單次 snapshot 契約。settings view 的建構與 toggle 初始化應另行核對，不能假定與前兩頁完全相同。
- **建議與負擔：** 讓 view 只建立元件並回傳刷新介面，由中心負責首次狀態填入；建構時仍直接傳入同一模型給需要的開關。可去除兩頁明確重複的首次 refresh 呼叫，不新增頁面級資料存取。
- **風險、相容影響與契約：** 影響內部 view 工廠與 binding 的初始化約定；無儲存相容影響。需保留初始文字／checked／disabled、詳細狀態展開、總電源按鈕與非同步命令擁有者，避免初始畫面短暫錯誤或無內容。
- **驗證：** 以三頁初次開啟及來回導覽契約確認完整顯示；保留每次建構／刷新一次 snapshot 的測試，另以有意義的狀態變化驗證初始化與後續刷新結果一致。命令完成必須讀取新模型，失效 view 不得更新 DOM。

### O01-3：只在 UI 邊界評估合併通知

- **定義與寫入：** [requestStarted](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/route-coordinator.ts#L192) 連續發布 `request-started` 與 `attribution-changed`。其他 plan／decision／confirmed／recovery 也同步通知同一 listener 集合。[ControlReadModel.subscribe](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/ui/control-read-model.ts#L23) 訂閱 settings、monitor、routes，對 UI 只傳遞失效通知，不使用事件 payload。
- **讀取消費者與現況：** 中心開啟期間每個通知可觸發完整 snapshot／view refresh。Monitor 每秒發布當前狀態；設定的 pending-off、提交與釋放也分別通知。同一次操作可能多次建模，但每次刷新仍只取一份模型。[Runtime](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/runtime-controller.ts#L44) 另有真正的影片備援恢復事件消費者。
- **建議與負擔：** 若後續需要減少重複建模，僅在中心／read model 的 UI 訂閱邊界合併同一同步批次通知，或以明確的顯示修訂判斷是否刷新。先確認需求，再選一種方式；不要建立另一個平行事件匯流排。靜態上可避免相鄰通知重複建模，收益未實測。
- **風險、相容影響與契約：** UI 通知的同步時機會改變，屬於較高風險的內部行為相容修改。不能延後 Runtime 的 recovery 交接，不能吞掉等待鎖時立即停用的狀態，也不能讓命令完成後沿用提交前模型。不要將所有 DomainEvent 改成非同步，或僅因 UI 不讀 payload 就刪除功能事件。
- **驗證：** 先新增同一操作連續通知、鎖等待、保存失敗、遠端更新、隱藏／關閉後晚到通知與命令完成後讀新模型的契約。保留同步重入事件順序、影片備援／音訊隔離與 pending-off 契約，再比較快照呼叫次數。未完成此證據前可延後。

### O01-4：最後成功主機方法應獨立決策

- **定義、寫入與讀取：** `#lastSuccess` 在成功傳輸時寫入、reset 時清除；[latestVideoHost()](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/route-coordinator.ts#L704) 讀 video 摘要，核對 success、matched、60 秒與 responseHost。除了 O01-1 的未讀快照投影，方法的呼叫只在 [adapters 的 reset](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/suites/adapters.ts#L2528) 與 [abort 保留最後成功主機](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/suites/adapters.ts#L2639) 斷言；目前正式 Monitor／UI／恢復沒有呼叫此方法。
- **建議與負擔：** 先移除 O01-1 的投影。方法、私有 Map 與兩個測試斷言是否退役，另以功能契約決策處理；若無保留需求，可用產品真正消費的當前傳輸／健康狀態驗證 reset 與 abort，再撤除沒有正式讀者的狀態維護。不要把測試當成正式功能呼叫鏈。
- **風險、相容影響與契約：** 會改變 `RouteCoordinatorPort` 的方法契約及原本明確驗證的最後成功摘要語意，超出 v2.2.2 清除範圍，因此可延後。原 abort 不得覆寫健康成功學習、reset 不得遺留內容狀態，仍是必須保留的產品行為；不能只刪測試取得綠燈。
- **驗證：** 先確認替代斷言能分辨成功、abort、換片 reset、過期與歸因不符，且讀取的是正式消費狀態。重新追查所有方法引用、執行傳輸／影音隔離／健康學習與完整測試，確認沒有 API 消費者後才安排修改。

## O02：移除重複版本與未讀模型依賴

- **定義與寫入：** [ControlCenterSnapshot](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/ui/control-contracts.ts#L11) 包含 `releaseStage`、`version`；同檔 `ControlModelSources` 要求 `now`。read model 每次填入 `releaseStage: 'stable'` 及工廠接收的 version，卻沒有讀 `sources.now`。
- **讀取消費者與現況：** 來源／測試沒有讀模型的 `releaseStage`、`version`。[entry](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/entry.ts#L139) 將同一版本同時傳給 ControlCenterDependencies 與 createControlReadModel；真正標題讀的是 `deps.version`。真正時間讀取是 `deps.now` 傳給總覽，與未用的 `sources.now` 不同。
- **建議與負擔：** 保留入口取得的一份版本供中心標題，移除模型版本與 stage；刪除 sources.now 及 read model 不再需要的 version 參數。可縮小每次 snapshot 形狀及工廠／測試組裝依賴，不影響任何既有顯示。
- **風險、相容影響與契約：** 改變內部匯出 Snapshot、Sources 與工廠簽章；相關測試 fixture 需同步調整。無使用者 API、設定值或儲存格式影響。不得刪除 `ControlCenterDependencies.now`、GM_info 的實際版本來源、建置版號或安裝身分核對。
- **驗證：** 型別／架構檢查全部組裝點，控制中心標題仍顯示注入版本，總覽相對時間與詳細狀態維持，三頁共用單次模型、晚到命令不更新失效 DOM。以編譯及消費者查核確認沒有空值或硬編碼版本替代。

## O03：提前重試的功能資料與測試邊界

### O03-1：未使用型別與有作用的抑制能力分開處理

- **定義與寫入：** [EarlyRetryEvidenceControlPort](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/early-retry-contracts.ts#L85) 只有定義，沒有任何匯入或實作宣告引用。實際 [suppressEarlyRetryEvidence()](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/route-coordinator.ts#L294) 直接存在協調器，驗證請求 ID 範圍，使用固定上限 32 的參考計數 Map、即時過濾及冪等釋放。
- **讀取消費者與現況：** 方法僅由 [up141-retry-transport](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/regressions/up141-retry-transport.ts#L60) 呼叫，清理由 testScope.defer 登記。協調器的成功寫入與備援資格讀取會檢查該抑制集合。案例驗證受控成功不成為提前重試的替代證據，同時一般 EvidenceStore 仍保留成功學習；這是有效斷言，不是空支架或報告錄製。
- **建議與負擔：** 優先刪除沒有引用的介面宣告。若後續要縮小正式物件上的測試控制面，另設計具明確所有權的窄注入能力或私有帳本邊界，保留相同功能測試；不要只改名為「測試用」後留下任意橋接、全域開關或完整 Store 權限。後者列可延後，不能與刪除無用型別綁成一次低風險整理。
- **風險、相容影響與契約：** 刪未讀型別只有內部型別表面影響；重封裝方法會涉及證據資格與抑制生命週期。必須保留有界參數、重疊參考計數、冪等釋放、一般學習不受抑制及晚到成功的資格檢查。沒有使用者資料遷移需求。
- **驗證：** 使用現有受控成功／33 ID 拒絕案例，另在後續改抑制所有權前補齊重疊取得／釋放、例外清理、reset 與晚到完成契約。核對測試不污染產品成功帳本，且沒有抑制一般學習；若改資格或傳輸分支，按風險執行安全差異掃描。

### O03-2：成功帳本與兩筆交接狀態維持現狀

- **定義、寫入與讀取：** [#retrySuccesses 的寫入](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/route-coordinator.ts#L1420) 只收符合當前身分、Catalog、206、URL／host 一致、至少 64 KiB 已核實內容且已進入一般學習的成功。最多 32 筆，60 秒範圍；[earlyRetryAlternative](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/route-coordinator.ts#L235) 要求同政策／內容身分的兩個獨立請求與足夠吞吐餘裕。
- **另一條消費鏈：** [XhrEarlyRetry](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/adapters/xhr-early-retry.ts#L346) 記錄最多兩筆 timedout／claimed 交接，[EarlyRetryController](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/src-v2/application/early-retry-controller.ts#L66) 消費後更新當前狀態、原因，再核對 revision／pending 及當前傳輸 state。這不是供匯出或事故回放的歷程。
- **建議與負擔：** 保留兩條功能資料鏈。一般 EvidenceStore 的長期速度學習與重試的短期精確成功資格不同，不能為了減少集合合併成同一樣本來源。當前成功帳本、在途樣本與交接資料均有界，沒有足夠依據提出新的通用傳輸／歷程框架。
- **風險、相容影響與契約：** 誤併可能讓過期、不同表示、未核實位元組或受控成功授權重試，也可能遺失使用者要求保留的當前狀態與理由。維持現狀沒有 API／儲存相容影響。
- **驗證依據：** up141-retry-transport、提前重試控制器與傳輸回歸涵蓋成功資格、網站重試交接、取消與過期；整體 1,598 案在發布前通過。這只能支持現有契約，不能由此推論尚未執行的安裝版效用通過。

## O04：測試情境組裝與無效敘述

### O04-1：按行為拆開長前置鏈

- **定義與寫入：** [extendFixture](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/support/fixture-context.ts#L2) 以 Object.create 與屬性描述元繼承可變閉包。application、adapters、native-transport、state、progressive-routing 的具名建立函式仍有逐層呼叫前一情境的鏈；例如 [progressive-routing](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/suites/progressive-routing.ts#L95) 後段 fixture 繼承前段資源建立及路線／量測操作。
- **讀取消費者與現況：** 末端案例常只使用少數欄位，卻先完成前面多種功能操作；有些基底是空 extendFixture。雖然數字 scenario 分派已撤除，具名函式本身不代表前置狀態已最小化。繼承保留 getter，因此不能將每個 fixture 直接展平成物件 spread。
- **建議與負擔：** 先畫每案需要的資源與狀態轉移，抽出窄的基礎建立器，再以「當前 Native」「待設定鎖」「已完成成功學習」「播放器恢復中」等實際角色組裝。共享的是建立方法；每個案例仍建立自己的可變狀態。可減少跨不相關行為的前置操作、閉包繼承層與閱讀跳轉，不以減少檔案或行數為目標。
- **風險、相容影響與契約：** 只有測試私有介面影響，無產品 API／儲存變更；但若漏掉早期副作用，會使測試走到不同路線或失去競態前提。必須保持案例名稱、套件選擇器、有效斷言、testScope 與 defineGlobal 清理，不能共用跨案例活物件。
- **驗證：** 每拆一個行為群先核對來源前置動作與受測分支，再執行該套件及相關競態回歸；最後對照 1,598 案名稱／數量與全部有效斷言，檢查計時器、攔截、訂閱及取消清理。不能只以完整測試通過證明情境等價；需保留能區分 Native／Catalog／停用等分支的直接斷言。

### O04-2：清理無效值與舊私有名稱，保留副作用

- **定義與寫入：** [native-routing](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/suites/native-routing.ts#L191) 有獨立的 `void 'catalog-generated'` 等常值敘述；state 與 progressive-routing 也有 `void null`／數字／布林。adapters 的 promotedPlan 只回傳未使用。這些不是有效斷言；獨立常值也不會觸發 getter 或操作。
- **讀取消費者與命名：** [state 私有建立函式](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/suites/state.ts#L333) 仍稱 DefaultOff，實際案例已驗缺值預設啟用。UP141-DIAG 具名案例現在驗總覽吞吐、等待、探測與播放入口摘要，並非診斷管線；`diagnostic:*` 表示鍵則是普通不透明測試鍵。
- **建議與負擔：** 移除逐項確認純粹無效的敘述、未讀 fixture 欄位，並改正誤導的私有函式／變數名稱。保留案例既有名稱與識別碼供歷史對照；若日後要更名案例，須先建立對照，不在本次清理中偷換測試契約。可消除誤認斷言與誤判功能殘留的閱讀負擔。
- **風險、相容影響與契約：** 僅測試私有介面；不得以 `void` 搜尋結果批次刪除。對 [xhr.response／responseText](https://github.com/YUIAOI7592/BiliCDN_TW/blob/f4cc2e45689b5b9c4b0e99d82f65be38d7600132/tests-v2/regressions/functional-races/xhr.ts#L338) 的讀取會觸發懶轉換與快取；`vault.register`、apply、observe、clearLearning 等即使回傳值不讀，仍改變必要狀態。刪除它們會削弱測試。
- **驗證：** 以 AST 與人工用途追查區分 literal、getter 與 call／await；核對每個移除項沒有讀者、副作用或隱含前提。保留 XHR 首讀／重讀快取、Native 資格、clearLearning 次序與 Runtime 清理斷言，再按 O04-1 的案例對照執行。

## K01：應保留的邊界

| 功能資料／操作 | 寫入與正式消費 | 維持原因、風險與驗證 |
| --- | --- | --- |
| recovery／route-fallback 影片事件 | RouteCoordinator 產生；Runtime 讀當前請求與資格，交 RecoveryController | 保留同步事件與唯一重載所有權；音訊不得觸發影片恢復。現有 orchestration／恢復競態驗證 |
| 總覽當前與詳細狀態 | Monitor、Measurement、Recovery、Transport、Routes 產生；overview／status-summary 讀取 | 保留目前緩衝、吞吐、需求餘裕、影音回應與各控制狀態；不以縮小模型刪掉使用者指定資料，不新增歷程錄製器 |
| `activePlan.ranking` 與當前請求歸因 | Coordinator 組裝；總覽與按需詳細狀態讀取 | 與未消費的 recentPlans 投影不同。保留最多 12 筆畫面候選與按需文字，不新增完整報告 |
| 設定 pending-off 及生命週期核對 | Store／Runtime 發布，授權及控制器讀取；非同步完成前再核對當前身分 | 合併 UI 通知不得改變立即抑制、失敗清理、重入、晚到工作與取消原因。維持現有鎖範圍／世代／token 契約 |
| Native、學習與真實媒體進度 | Vault 精確授權；EvidenceStore／Monitor／Recovery 消費功能資料 | 正常 Native／原網址不是原線對照，totalVideoFrames 不是掉幀收集。schema 2、四鍵與布林相容保持 |

上述項目沒有提議公開 API 或儲存格式變更；若未來為整合必須變更內部匯出型別或方法，影響已列在各項，不得擴大為新的傳輸框架、診斷功能或平台依賴。

## 後續實作的建議順序與交付界線

建議先處理 O02、O04-2 的明確無用定義與純敘述，再按行為群拆 O04-1；以新直接斷言保護後處理 O01-1／O01-2。O03-1 的未用型別可獨立清理，抑制能力的重新封裝、O01-3 通知時機及 O01-4 方法退役另行規劃。這是後續建議，不是本次新增實作授權或已完成變更。

本階段沒有修改產品、測試、介面、設定、版本或五份 Release 原件；沒有啟動瀏覽器、建立本機網站服務、執行新的播放窗口或效能收集。沿用的 1,598 案是發布前離線基線，本階段不將靜態分析冒充新的執行期／安裝版驗收。文件登記、原文保護、歷史導覽、工作狀態與追加日誌由後續文件提交保存，標籤維持發布提交。
