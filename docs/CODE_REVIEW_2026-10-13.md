# BiliCDN_TW 整體程式碼檢查報告

日期：2026-10-13（台北時間）。基準 **v2.1.22／`c4e7de4ff75949e5fb71ea284a2f7af0366d01be`**，開始時工作目錄乾淨。本輪按「先報告後修」執行，沒有修復、升版、提交、推送或發布。

**確認 5 個新缺陷：4 個 P2、1 個 P3。另有 3 個 XHR 疑點具靜態及 Node 模型證據，但缺原生對照，不列已確認缺陷。** 46 個現行來源檔全部有逐檔閱讀紀錄；這不等於全部功能情境均已通過。BR-01 專項與原自然停滯原因仍跳過，P01／P02 封存安裝窗口沒有重開。

## 1. 範圍、基準與證據層級

主代理與三個子代理分工，逐模組追蹤輸入、狀態、非同步邊界、所有權與清理，對照現行契約和正式測試。四小時為上限，完成閱讀、重現及複核後提早交付。開始時間 `2026-10-13T13:38:37Z`，完成時間與保護檢查見本機 `FINAL_VALIDATION.json`。

| 項目 | 本輪結果 |
| --- | --- |
| 全部現行來源 | 44 個執行期 TS 模組、globals.d.ts、metadata.txt，共 46 檔有覆蓋狀態 |
| 既有自動基準 | 沿用已保存的 808／808；release manifest 45 個來源雜湊一致，發行標籤至 HEAD 的來源／正式測試／建置配置沒有差異 |
| 新獨立契約 | 21 個不同案例：12 pass／9 fail；失敗斷言表達正確行為，未修來源確實不通過 |
| 型別檢查 | A、B、C、主代理的獨立重現均通過；不修改正式測試登記 |
| 獨立複核 | 5 個確認根因皆有另一名代理或主代理的反證紀錄 |
| 原生瀏覽器 | 一個 IAB 隔離窗口在校準前受工具阻塞，沒有執行原生案例，不計來源或安裝驗收 |
| 安全 | 沒有執行完整 Codex Security 掃描；目的地政策疑點另外標為安全敏感 |
| 來源與發行 | 產品、正式測試、建置配置、版本及 Release 未修改；本機文件與私有重現除外 |

工具版本：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。原 808／808、typecheck、architecture、verify 是發布時的既有結果，**本輪沒有重跑完整驗證**。新失敗不是「808 套件退步」，而是原套件未涵蓋的交錯；也不能用原 808 通過否認新缺陷。

本機完整產物：[本輪證據目錄](../.work/code-review/2026-10-13-c4e7de4/)、[基準適用性](../.work/code-review/2026-10-13-c4e7de4/BASELINE_EVIDENCE.json)、[逐檔覆蓋](../.work/code-review/2026-10-13-c4e7de4/COVERAGE.md)、[疑點台帳](../.work/code-review/2026-10-13-c4e7de4/LEDGER.md)、[續行檢查點](../.work/code-review/2026-10-13-c4e7de4/CHECKPOINT.md)。`.work` 是本機私有證據，不是正式套件或公開發行輸入。

## 2. 已確認缺陷總表

| ID | 優先級 | 問題及實際影響 | 本輪案例／複核 |
| --- | --- | --- | --- |
| CR-01 | P2 | Native 備援失敗後，已選中的合法原線沒有套用，後續重試反被阻擋 | A-R1，C 獨立複核 |
| CR-02 | P2 | 漸進式相同來源集合只換序就撤銷授權，丟棄合法在途結果 | A-R2，主代理獨立複核 |
| CR-03 | P2 | pending 起播在內容切換時取消，會重新開啟每分頁一次的探測預算 | C01，A 獨立複核 |
| CR-04 | P2 | 一次證據儲存拒絕未釋放 running，阻擋後續健康探索 | C02，B 獨立複核 |
| CR-05 | P3 | 更多成功傳輸反而撤回已確認的播放證據，診斷誤報未確認 | R01，C 獨立複核 |

P2 表示具體條件下功能不符合契約，P3 表示診斷呈現錯誤。沒有將這些問題歸因為原 BR-01 自然停滯，也沒有證據支持廣泛、必然或永久的播放失效。

## 3. CR-01：Native 備援失敗後未套用合法原線

**觸發條件：** 啟用原生來源參考；可信 playurl 同一表示有原線 A 與另一個 Native 備援 B。預設 Catalog-only 不受這個特定分支影響。

事件順序為：播放器請求 B → B 發生可歸因 network failure → circuit 阻擋 B → recover 選定仍合法的 A → 播放器重試 B → 腳本把 A 的計畫實體化為 B → 最後限制檢查回傳 `url=null`。已規劃的恢復路線因此無法生效，可能持續卡住，是否恢復取決於網站是否自行改請 A。

根因在 [routing.ts](../src-v2/domain/routing.ts) 第 105～106 行：root candidate 使用 `action: 'pass'`；[route-coordinator.ts](../src-v2/application/route-coordinator.ts) 第 884～888 行對 pass 一律返回呼叫者的 URL。此 URL 在重試入口是 B，不一定是 Vault 的 A。第 363～375 行已記錄 A 的 fallback，第 477～485 行卻核對錯誤的 B 並阻擋。

既有契約要求合法選路計畫由後續請求實際套用，Native 必須使用目前 Vault 的精確 URL。禁止規則仍有效，這是決策與實際目標失配，**不是已證實的禁止繞過**。

- 正確契約：重試 B 應套用合法 A；實際為 null。
- 正常對照：相同失敗、circuit 與計畫，只改為播放器直接請求 A，通過。
- 使用真正 PlayurlAdapter／Controller／Vault／RouteCoordinator／stores，只有時鐘與記憶體儲存是替身。
- [案例與結果](../.work/code-review/2026-10-13-c4e7de4/a-content/REPORT.md)、[獨立複核](../.work/code-review/2026-10-13-c4e7de4/c-player-measurement/CROSS_REVIEW_A01.md)。

最小修正方向：區分「原樣通行」和「選中 Vault root-original」，後者保存精確授權能力並在實體化時重查。不能只按 host 拼 URL，也不能讓所有 pass 都改用 root，否則影響未知請求、原線對照及 DASH 查詢字串。必要回歸含 Native 失敗回原線、原線被禁止、真正來源失效、固定 Catalog 及影音分離；修復時應做授權差異安全審查。

## 4. CR-02：相同漸進式備援換序撤銷有效授權

**觸發條件：** 同一 MP4 分段的可信回應，primary A 完全相同，合法 backups 由 `[B,C]` 改成 `[C,B]`；URL、簽名及內容週期都未改變。

第一份回應建立 revision 1 與在途傳輸；第二份只換序，Vault 卻建立 revision 2；原傳輸正常完成後被 authority 檢查丟棄。實際健康樣本 0，預期 1。這也使仍屬舊身分的工作失去提交資格；沒有證明自然網站發生的頻率。

[signed-route-vault.ts](../src-v2/state/signed-route-vault.ts) 第 87～91 行逐索引比較 URL，將集合等價誤判為順序等價；第 97～100 行撤銷 handles，第 124～127 行旋轉身分。[route-coordinator.ts](../src-v2/application/route-coordinator.ts) 第 721～725 行拒絕舊身分是必要保護，問題在上游過早撤銷。[playurl-controller.ts](../src-v2/application/playurl-controller.ts) 第 119～122 行的 progressive 刷新讓 MP4／FLV 共享此路徑；**執行重現是 MP4，FLV 是同分支靜態推論**。

[PROJECT_CONTEXT](PROJECT_CONTEXT.md) 第 78 行及 [ARCHITECTURE](ARCHITECTURE.md) 第 64 行已明定相同正規化集合不無故輪替。

- 兩個正確契約失敗：revision 1→2；合法在途成功樣本 1→0。合併成一個根因。
- 正常對照：相同順序不旋轉；真正簽名更新仍正確撤銷舊完成。
- [案例與结果](../.work/code-review/2026-10-13-c4e7de4/a-content/REPORT.md)、[主代理反證](../.work/code-review/2026-10-13-c4e7de4/root/CROSS_REVIEW_A02.md)。

最小修正方向：以有界、正規化的 URL 集合決定授權是否改變，將 primary／標準來源與輸出順序分開處理。必要回歸含 MP4／FLV 全排列、在途 success／failure、重複來源、容量邊界、真正新增／刪除與換簽名。不能以取消 authority 檢查或保留失效 URL 修復。

## 5. CR-03：取消 pending 起播後重開分頁預算

**觸發條件：** 分頁第一個合資格起播窗口已啟動，但探測未完成，可信新內容觸發 epoch 切換。

真正 PlayurlController 通知 Runtime reset，舊 3 個 probe 全部 abort；新內容媒體請求再次 prepareStartup，累計 probe 數變成 6。反覆在未完成窗口切換可重開預算，也再次讓後續媒體請求等待。這不表示一個窗口同時超過 3 個候選。

[measurement-controller.ts](../src-v2/application/measurement-controller.ts) 第 74～78 行 reset 清空 pending 並撤銷 marker；第 149 行讓舊工作退出；但 `#startupUsed` 第 162 行才在完成時設置，第 93～105 行因而允許新窗口。Runtime 的同步取消本身正確，錯在「已開始」沒有保留分頁預算。

[PROJECT_CONTEXT](PROJECT_CONTEXT.md) 第 26、71 行與 [ARCHITECTURE](ARCHITECTURE.md) 第 83、99 行明定每分頁一次，換片不重開。

- 正確契約：切換前後累計仍 3；實際 3→6。
- 正常對照：已完成窗口再切內容，3→3。
- 案例走真實 Runtime 內容訂閱，不直接改 private marker。[結果](../.work/code-review/2026-10-13-c4e7de4/c-player-measurement/startup-budget.log)、[獨立反證](../.work/code-review/2026-10-13-c4e7de4/a-content/C01-COUNTERREVIEW.md)。

最小修正方向：首個合法窗口開始即保留預算，同時讓後來等待者加入正在進行的共用 Promise。不能只提前設 used 卻保留原入口順序，造成後續 waiter 跳過 gate。必要回歸含 pending 的 epoch／generation／設定 reset、完成後 reset、多等待者、單一取消及無合法候選。這是新 Node 競態證據，**沒有恢復封存的 P01／P02 安裝驗收**。

## 6. CR-04：儲存拒絕後 running 未釋放

**觸發條件：** 合資格健康探索取得成功探測後，記錄證據的外部儲存發生一次同步例外或拒絕。正式平台的 `GM_setValue`／lock 邊界可傳播此例外；未聲稱實際 GM 經常失敗。

probe 完成 → RouteCoordinator.recordChallenge → EvidenceStore.record 的 set 拋錯 → runCandidate 拒絕 → runRound 跳過末尾清理 → tick 的 fire-and-forget Promise 產生未處理拒絕。儲存恢復且冷卻超過 10 分鐘，下一個合資格 tick 仍被留下的 running 阻擋，手動 request 也不能啟動新輪次。

[measurement-controller.ts](../src-v2/application/measurement-controller.ts) 第 196 行未接拒絕；第 234 行 finally 只清 planning；第 253、280 行 await 拒絕跳過第 261 行 running 清理。外部可達鏈為 [storage.ts](../src-v2/platform/storage.ts) 第 14～16 行、[evidence-store.ts](../src-v2/state/evidence-store.ts) 第 106 行、[route-coordinator.ts](../src-v2/application/route-coordinator.ts) 第 713 行。

- 正確契約失敗：`unhandled=1`、狀態 running、探測累計 1→1。
- 正常儲存對照：`unhandled=0`、狀態 complete，下一輪累計 3→6。
- 兩組 `cleanupDone=true`。獨立子程序只觀察未處理拒絕，不吞成測試成功。[結果](../.work/code-review/2026-10-13-c4e7de4/c-player-measurement/measurement-errors.log)、[B 複核](../.work/code-review/2026-10-13-c4e7de4/b-transport-state/CROSS_REVIEW_C02.md)。

影響限於持續合資格播放期間的後續健康探索；unsafe tick、cancel、reset 或重新載入可解除，**不是所有播放失敗，也不是絕對無法恢復**。必要契約是有限工作必須在拒絕後收束並可按冷卻重新執行。

最小修正方向：使用具 round 所有權的 finally 清理 running，接住背景拒絕並記錄固定失敗狀態；晚到舊 round 不得清除新 round。必要回歸含 set／lock 拒絕、取消後拒絕、reset 後晚到結果、冷卻後重啟。不能將持久化故障算成 CDN 失敗或無限立即重試。

## 7. CR-05：後續成功傳輸撤回已確認播放證據

**觸發條件：** 同一 fallback attempt、identity、decision 與主機，先取得直接 206 與兩個有效進度 tick，在 30 秒觀察期內又完成另一個成功分段。

案例在第 28、29 秒取得進度並成為 `playback-observed`；29.5 秒第二筆成功到達，狀態退回 `response-observed`；30 秒变成 `unconfirmed`，但 `playbackAt` 仍保留第 29 秒。UI 因而顯示「30 秒內未取得足夠證據」，與已取得證據矛盾。這是診斷錯誤，不直接改路線或重載播放器。

[recorder.ts](../src-v2/diagnostics/recorder.ts) 第 305～306 行無條件降級並清除 progressTicks，第 75 行到期轉 unconfirmed；第 84 行 attempt 觀察發生在第 93 行 route-confirmed 去重之前，所以去重無效。[route-coordinator.ts](../src-v2/application/route-coordinator.ts) 第 763～791 行讓每筆合法成功分段都能到達此入口。

- 正確契約：後續同路線成功不應撤銷未失效的已確認進度；實際 unconfirmed。
- 正常對照：同樣第 28／29 秒進度但沒有額外回應，30 秒仍 playback-observed。
- 沒有新內容、seek、混合主機或新救援；使用真正 DiagnosticRecorder 的型別化事件入口。[案例](../.work/code-review/2026-10-13-c4e7de4/root/diagnostic-progress.ts)、[結果](../.work/code-review/2026-10-13-c4e7de4/root/RESULT.tap)、[C 複核](../.work/code-review/2026-10-13-c4e7de4/c-player-measurement/CROSS_REVIEW_R01.md)。

最小修正方向：已確認播放後仍累計同路線傳輸，但不因更多成功資料降級；保留真正 mixed／seek／lifecycle 的撤銷。必要回歸含確認前多回應、確認後額外分段、期限前後、不同 requestId 及混合主機。不得藉此放寬播放恢復判定。

## 8. 靜態證據充分，但尚未完成原生重現

下列三項各有 1 個正確契約失敗與 2 個正常對照，執行真正產品模組；NativeXhr 外部模型按規範模擬相關邊界。**尚缺可用 IAB 原生比對，因此不計入上述 5 個已確認缺陷，也沒有安裝版通過判定。**

| ID | 因果與位置 | Node 結果／缺少條件 |
| --- | --- | --- |
| S-01／B-01 | xhr-hook.ts 第 288～289 行保存原始 header 參數，第 145～146 行 reopen 再次交给原生；可變 toString 被執行第二次 | Range 由 bytes=0-99 變成 bytes=100-199；靜態字串與無 reopen 對照通過。需原生 ByteString 轉換／重入校準 |
| S-02／B-02 | xhr-hook.ts 第 78～95 行保留相對 URL，第 178 行依 location 判政策，原生 open 卻可能按 document base 解析 | 合成 base 指向 HTTPDNS 時預期 sends=0、模型=1；絕對阻擋／普通相對對照成立。**安全敏感**，需精確阻止外送的原生目的地對照；不宣稱已確認漏洞 |
| S-03／B-03 | xhr-hook.ts 第 234～243 行先標 sent；body 轉換拋錯後未恢復，第 124 行擋更正後的 send | 模型原生未送出且 OPENED，hook 第二次 send 卻 InvalidStateError；一般送出／重複 send 拒絕對照成立。需原生 Web IDL 轉換及 send flag 對照 |

完整來源、規範依據、重現及最小修正風險見 [B 報告](../.work/code-review/2026-10-13-c4e7de4/b-transport-state/REPORT.md)。續查必須先有正常可導覽的 IAB 自有隔離頁，再完成一次安全原生對照；不得改用外部瀏覽器或讓 HTTPDNS／CDN 校準請求外送。

另有 `hostLockedStreams` 容量、PagePlayinfo 卸載 descriptor 及設定命令例外回饋等靜態線索，缺可達影響或明確契約，列於台帳的未深入項，不計已確認或必修缺陷。

## 9. 契約未定、已排除與未深入

| 分類 | 項目 | 收束理由 |
| --- | --- | --- |
| 契約未定 | 同 generation 的 API 逆序回應政策 | 現行沒有「最後發出」或「最後回應」優先的新增規則，不能自行選答案 |
| 契約未定 | 清除學習與排隊寫入、跨 store 部分失敗的屏障／原子性 | 已有鎖內有效性保護，但清除是否取消所有既存工作沒有完整契約 |
| 既有限制 | 無 Web Locks 的跨分頁一致性、GM 通知順序 | 先保留平台既有限制；沒有新原生排序證據，不列新缺陷 |
| 已排除 | 舊 epoch 的 startup 選擇仍提交 | marker 和 Runtime abort 有效；CR-03 是預算問題，非舊提交 |
| 已排除 | 低信任提示覆寫可信 Native、固定主機繞禁止、只剩探測前三候選 | Vault／政策／完整 Catalog 分支有對應防護，已逐段核對 |
| 已排除 | 相同 cid／排列觸發 epoch、progressive 部分輸出 | 有界內容集合及先規劃後輸出有效；CR-02 是授權集合順序，非 BR-03 epoch 回歸 |
| 已排除 | retained dimensions 自動清 failed、拖曳仍建新 token、晚到 SDK 直接復活動作 | 進度、dragging 與 token／lifecycle 身分檢查存在；沒有重開 BR-01 專項 |
| 已排除 | UI 晚到回呼重開視圖、診斷 snapshot 啟動學習、模板版號造成舊產物 | viewRevision、防副作用邊界及 build 版本置換有效 |
| 既有明示限制 | Visibility 還原第三方 descriptor、不可觀察的外部核心替換 | 已在現行安全／產品指南說明，不能把舊限制重列新缺陷 |
| 未深入 | 部分初始化每一步拋錯、任意頁面 getter／descriptor 重入、瀏覽器平台差異 | 已讀來源，沒有對全部組合建模或原生故障注入 |
| 未深入 | 巨量長期 streamKey 成長及特殊卸載時序 | 尚缺正常流量規模、可達卸載與可量化功能影響 |

「已排除」僅針對台帳中具體假設，不表示對應模組永遠不會出錯。既有通過瀏覽器案例沒有重測；正式測試替身涵蓋不足之處已列明。

## 10. 重跑入口與結果

在專案根目錄執行單一入口，會先做本輪重現的型別檢查，再執行指定案例：

```powershell
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs --list
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs content
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs startup-budget
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs measurement-errors
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs diagnostic-progress
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs xhr-headers
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs xhr-relative
node .work/code-review/2026-10-13-c4e7de4/run-repros.mjs xhr-send-conversion
```

| 組別 | 不同案例 | pass | fail | 意義 |
| --- | --- | --- | --- | --- |
| content | 6 | 3 | 3 | CR-01／02 兩個根因；CR-02 兩個症狀合併 |
| startup-budget | 2 | 1 | 1 | CR-03 |
| measurement-errors | 2 | 1 | 1 | CR-04 |
| diagnostic-progress | 2 | 1 | 1 | CR-05 |
| 三組 XHR | 9 | 6 | 3 | S-01～03，尚缺原生前提 |
| 合計 | 21 | 12 | 9 | 全部為新私有契約；獨立複核的重跑不重複計數 |

各組未修來源的退出碼為 1，**不能算整體通過**。沒有 only、skip、todo 或 cancelled；型別檢查與清理另記。重跑會更新各組執行 log；本輪原始結果另保存於 `ORIGINAL_RESULTS.json`，原調查歷史不覆寫。資料全為合成、外部儲存為記憶體，沒有真 CDN 探測或使用者資料寫入。

## 11. 瀏覽器限制與清理

唯一新增瀏覽器目的為 XHR 原生語意隔離，不操作指定影片或已安裝 singleton。可見 IAB 自有空白頁嘗試 loopback 合成服務時連線逾時，接著錯誤頁被轉成 data URL，瀏覽器 URL 政策拒絕後續導覽與明確關閉。沒有原生 XHR 案例執行，也沒有安裝 hook、CDN 請求、設定、學習資料或剪貼簿操作。

兩個本機服務程序均已停止。錯誤分頁沒有標記保留，但**明確關閉未獲確認**，不以工具可能自動清理冒充完成。詳細事件與清理狀態見 [BROWSER_LIMITATION.json](../.work/code-review/2026-10-13-c4e7de4/BROWSER_LIMITATION.json)。本輪停止這個受阻窗口，不循環重試，不繞過 URL 政策。

## 12. 交付狀態與後續修復範圍

本輪全模組閱讀、確認缺陷重現、正常對照及獨立複核已完成；保留 3 個缺原生對照疑點、未深入組合及一個未確認關閉的自有錯誤分頁。此報告完成的是**程式碼調查交付**，不是功能修復或全部瀏覽器驗收。

已確認 CR-01～05 可作下一輪修復計畫的輸入。S-01～03 必須先補原生前提才能升級判定；其餘政策未定及限制不自動成為必修項。BR-01 仍跳過，P01／P02 不恢復自主續測。現行 [TODO](TODO.md)、[INDEX](INDEX.md) 與 [TEST_REPORT](TEST_REPORT.md) 已同步本次調查狀態，歷史通過和限制不回寫。
