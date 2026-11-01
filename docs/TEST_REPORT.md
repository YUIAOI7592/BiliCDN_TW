# BiliCDN_TW v2.2.4 儀錶板資料遺失與缺值顯示修復驗證

日期：2026-11-01（Asia/Taipei）。基準為乾淨 main／`1c981da4796c84ea3abacf0433bf350931d66769`。本次依使用者批准方案修正導覽身分及唯讀顯示；原 v2.2.3 全文、公開核對及 R1 基本安裝驗收保存於 [歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-完整正文保存2026-11-01)。

## 修復結果與證據邊界

已重現並修正：同片追蹤參數／等價網址導致 generation 改變、表示及影音摘要清空；舊 512 字元截斷漏掉後段分 P 變更。新導覽鍵只在支援的單層影片／OGV 播放路徑忽略 vd_source、spm_id_from 並正規化末尾斜線；一般影片缺省與單一 p=1 等價，其他內容／未知參數及重複值順序保留。未知路徑保留完整原始輸入。真換片、分 P、cid／內容改變、停用與授權失效仍沿用原隔離與取消；五秒／跨頁 250 毫秒頁面資料期限保持。

使用者截圖可確認播放器有緩衝／倍速，但傳輸歸因及速度資料缺失；這次沒有取得該次實際網址變動或 hooks 的完整因果。已修正的重設路徑與截圖式缺值的 Node UI 契約分列，不宣稱已在使用者瀏覽器完整重現並消除所有缺值原因。

總覽及按需詳細狀態共用當次純衍生結果：有效播放器尺寸可以先顯示並標示編碼未確認，與已確認表示高度一致才沿用原畫質／codec；有效速度不因缺需求而隱藏，餘裕須有有效速度／倍率／推導需求。缺值按攔截、歸因與計畫狀態說明，影音各自區分實際回應、等待回應及尚無觀察；明確舊 generation／epoch 資料不顯示。沒有增加輪詢、訂閱、探測、持久鍵或診斷歷程，沒有用顯示備援授權選路。

Native 預設及既有布林值、schema 2、四個儲存鍵、兩筆成功影片傳輸的確認門檻、量測／恢復額度及可信事件所有權不變，無資料遷移。階段提交為導覽 `3c03495`、UI `871df88`。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2；已核對測試及 verify 不啟動網站服務，verify 僅在暫存位置核對封裝，不覆寫 Release。

基線 18 套件／1,599 案全部通過。初次沙箱執行中工具套件 9 案因自有暫存 Git 配置寫入被拒而失敗；以必要權限重跑基線後全數通過，環境限制不列產品失敗。正式案例名稱及參數展開逐項對照，原 1,599 案完整保留；新增 35 案，完整測試為 **18 套件／1,634 案通過**，failed／cancelled／skipped／todo 均為零。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| `architecture` | 41 | 通過 |
| `imports` | 1 | 通過 |
| `domain-boundaries` | 3 | 通過 |
| `domain` | 11 | 通過 |
| `state` | 35 | 通過 |
| `application` | 588 | 通過 |
| `adapters` | 210 | 通過 |
| `native-routing` | 13 | 通過 |
| `native-transport` | 167 | 通過 |
| `orchestration` | 40 | 通過 |
| `adapter-boundaries` | 65 | 通過 |
| `measurement-state` | 94 | 通過 |
| `progressive-playurl` | 29 | 通過 |
| `progressive-routing` | 51 | 通過 |
| `progressive-transport` | 4 | 通過 |
| `playurl-summary` | 22 | 通過 |
| `control-center` | 63 | 通過 |
| `tooling` | 197 | 通過 |

### 新增回歸與既有契約

| 範圍 | 證據 |
| --- | --- |
| 導覽鍵 11 案 | 追蹤增刪／排序、重複值順序、重複 p、真分 P、內容與未知參數、OGV、未知路徑、512 字元後差異、影片及集數路徑 |
| 真實元件整合 2 案 | Navigation／Lifecycle／Session／Vault／Routes／Runtime／TransportContext 組合；頁面資料超過五秒後等價導覽仍保持原決策身分及影音摘要，真分 P 撤銷舊身分、拒絕晚到回填，新影音各自重建且兩筆影片後才確認 |
| UI 22 案 | 截圖式有緩衝／尺寸但無歸因；無效／零／不可用尺寸；畫質相符與不符；速度與需求部分缺值、非有限、零及溢位／下溢；六類提示；待回應目標與影音隔離；舊世代／週期列 |
| 既有契約 | 三頁首次刷新與單份快照、按需詳細文字、設定鎖與失敗／遠端更新、失效視圖晚到命令、Native／Catalog／固定／禁止／停用、影音隔離、恢復額度／位置／倍速、取消及重入全部保持 |

導覽修改前四個適配器案例與一個整合案例如預期失敗；UI 修改前 17 個新增案例中 12 個失敗。修復後相關套件及完整測試均通過。新增導覽整合測試停止週期監控以隔離導覽時間與無關停滯；不將此替身情境宣稱為連續播放或恢復實測。

原四個無效容量案例保留名稱及不產生假需求／非有限餘裕的斷言；依新功能調整過時的「缺需求必須連速度一起隱藏」預期，改驗有限正速度仍顯示、無效需求不形成容量宣告。沒有刪除保留功能案例、常值替代或空實作取代有效斷言。

型別與架構檢查通過，92 個執行期模組無匯入循環。最終 verify 全部通過，包含型別、架構、格式、文件、封存、1,634 案測試、兩次確定性建置、語法、撤除功能禁止標記及暫存封裝校驗。暫存工具測試所需 Git 配置寫入在授權權限下執行，不啟動服務。git diff --check 通過；正式封裝及公開核對依下節記錄。

### 安全差異

Codex Security 差異掃描 `b2d6e70e-e8e6-44aa-9d59-b2446fb51996` 固定範圍 `1c981da4796c84ea3abacf0433bf350931d66769..871df885a373f2f9b94f1d9249d0d472d240fc8b`，包含全部八份來源／測試變更。能力預檢通過，全部八份變更檔及必要支持路徑已靜態審查，獨立架構核對完成；封存的掃描結果為 complete、零可回報發現、八個表面均 no_issue_found，沒有延後審查。後續版本、文件及搬移差異另行核對，正式程式、可執行測試及工具原始碼與掃描 head 保持一致；tests-v2/MIGRATION.md 是後續文件說明。不把靜態安全檢查當成安裝實測。工作台回傳關聯三個對話累計用量 8,500,118 tokens（其中 cached input 8,275,968、output 28,909）；它包含關聯對話上下文，不能當成本次差異掃描的獨立增量用量。

## 發行產物與證據保存

腳本版本 **2.2.4**、**421,364 bytes**；SHA-256：`57300645ad2da226e4141f6ebe0439a3da4e718a534408bc9fc20968f4446d89`。建置與安全掃描 head 的產品來源一致，版本三檔與文件／封存差異另核對，沒有新增依賴。

本機忽略證據位於 `.work/v224/`，包含原始檔雜湊、基線與完整案例結果、紅／綠測試及名稱對照。原 v2.2.3 五份 Release 原件已依原始位元組歸檔，原 main 完整報告（含 7／7 R1）追加至歷史正文；既有安全產物、停止決策與日誌原文保持。先保存搬移清單原件，再更新新版本適用保護範圍。

### 公開交付與安裝結案

五份本機產物已封裝並逐項核對 SHA-256，v2.2.4 發行檔以原始位元組加入 Git，不做換行轉換。此為發布前檢查點；公開核對依實際完成結果追加，封裝後五份原件不回寫。

2026-11-01 發布後追加：正式 [v2.2.4 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.4) 已發布，非 draft／prerelease。發行時遠端 main 與標籤所指提交均為 `7f3c5e0023b29b4a386c3e5011add0d37d2f6e23`，標籤物件 `29befe32ece5a618bf604f62be6a5d62406674d1`。Release ID `430557228`，唯一附件 BiliCDN_TW.user.js，asset ID `698233887`；附件 digest 與本機 SHA-256 一致。

獨立下載公開 main 原件、v2.2.4 標籤原件、版本附件及 [latest 腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，四者均為 **2.2.4／421,364 bytes／SHA-256 57300645ad2da226e4141f6ebe0439a3da4e718a534408bc9fc20968f4446d89**，與本機逐位元組一致。後續 main 文件結案與發行提交分開，v2.2.4 標籤維持上述提交。

本版五份 Release 原件與上一版五份歸檔原件、三份日誌全部舊正文前綴及完整 v2.2.3 報告保持；後續只做文件結案，不重跑已通過的執行期驗證。發布結案時尚未實測安裝版；使用者後續另行授權的 R1 見下節，原截圖的實際觸發因果仍未確認，舊判定不改寫。

### 來源隔離與實際安裝

修復及發布階段未啟動瀏覽器、更新安裝版或恢復停止窗口，也未另做來源隔離。後續以使用者已更新的安裝版執行以下 R1；沒有重新安裝或切換來源。v2.2.3 的七項基本驗收只屬當版當輪；舊 FAIL、INVALID 與未解根因不改判。

<a name="v224-r1-安裝驗收2026-11-01"></a>

## v2.2.4 R1 安裝驗收（2026-11-01）

使用者確認內建瀏覽器腳本已更新後另行授權。基線 main／`2571dfdf579970324bac0fecdbe792061cb79740`；僅使用 Codex 內建瀏覽器＋Tampermonkey、一個自有分頁及 `BV1tFZZBQE57`／P1／Auto，不強制畫質、不改帳戶設定。凍結六個核心案例；T0 為 20:12:31.886（Asia/Taipei），20:37:31.886 起僅清理及報告，硬截止 20:42:31.886，不追加輪次。瀏覽器操作與清理於 20:23:50.642 前完成，分頁已關閉。

### 核心案例與實際結果

| 案例 | 必要證據與結果 | 判定 |
| --- | --- | --- |
| I224-01：安裝身分 | 實際載入完整本體 421,364 bytes，SHA-256 與本版正式腳本一致；Tampermonkey 5.5.1／腳本 2.2.4；RuntimeController、ControlCenter、TransportAdapter 各一個，Fetch／XHR hooks 均已安裝 | 有效／PASS |
| I224-02：三頁與資料顯示 | 總覽、CDN、播放設定切換正常；總覽為播放正常、2160p／av1，緩衝有效。安全吞吐及需求餘裕缺值時明示「目前路線尚無有效速度樣本」；影音各顯示實際回應主機／206。詳細文字點開才建立，重開後恢復收合；沒有診斷頁、報告或原線對照入口 | 有效／PASS |
| I224-03：同片等價網址 | 透過現有 History 包裝改變追蹤參數，再測缺省 p→單一 p=1、移除末尾斜線及參數排序；即時前後 Session 與實際決策物件身分相同，generation 1／epoch 0、video:group-6、影音摘要均保持 | 有效／PASS |
| I224-P1：Auto 1 倍 | 一個完整 60 秒窗口，實際播放進度增加 59.998229 秒；全程靜音，沒有觀察到媒體錯誤、等待、停滯、暫停或 seek 事件 | 有效／PASS |
| I224-P2：Auto 2 倍 | 透過網站倍速選單切為 2 倍；一個完整 60 秒窗口，實際播放進度增加 120.006166 秒，其餘條件同上 | 有效／PASS |
| I224-06：還原及清理 | 透過網站選單還原 1 倍、暫停並保留真正靜音；還原網址／History state，設定模型與儲存值逐欄等於原值；移除全部自有觀察資源、斷點與物件群組，IAB 自有分頁為零 | 有效／PASS |

六個核心案例 **6／6 PASS**，無核心 FAIL 或 INVALID。各案例只作本表範圍判定，不擴張為所有故障或條件式能力已驗證。

實際腳本本體從已載入的執行來源讀取並核對完整雜湊，沒有下載替換或重新注入產品。原有 Native=false、提前重試=false 等設定完整保留，沒有為湊案例切換。導覽後立即對真正媒體靜音並讀回；兩個計分窗口全部採樣均 muted=true，沒有替換媒體或靜音失敗。起始導覽至第一次讀回的區間不列為「已證明全程靜音」窗口，也沒有追加起播前靜音門檻。不要求前景、不啟動本機網站服務，不取消音訊下載。

### 等價網址與播放窗口證據

追蹤參數變動的即時前後比較保持 decision-166；第二組比較保持 decision-209，當時文件已存在 366,993.7 毫秒，超過頁面資料五秒期限。每組均比對當下實際計畫物件，而非跨自然媒體分段要求決策 ID 永久相同。兩組均保持表示及影音回應，重開畫面仍能正常顯示；本次沒有執行真正換片／分 P 的新安裝版窗口，相關拒絕舊完成及重建能力仍引用上節 Node 契約。

| 窗口 | 本地時間 | 單調時鐘長度 | 採樣／最大間隔 | 尺寸／進度 |
| --- | --- | ---: | --- | --- |
| I224-P1 | 20:19:38.623–20:20:38.624 | 60,001.4 ms | 62 筆／1,007.9 ms | 3840×2160；+59.998229 秒 |
| I224-P2 | 20:21:10.257–20:22:10.262 | 60,004.8 ms | 62 筆／1,003.6 ms | 3840×2160；+120.006166 秒 |

兩窗均為相同媒體、倍率固定、沒有 seeking／paused／ended 或媒體錯誤；error、pause、seeking、stalled、waiting 事件各零。相鄰採樣亦未觀察到停進度區間；這是有界媒體進度與事件證據，不宣稱排除採樣間所有短暫異常，也不含掉幀收集。Recovery reloadCount=0，不把正常進度恢復狀態當成重載效用通過。

### 節點與缺值的判讀邊界

- 量測狀態所保留的最近主機為 `upos-sz-mirroralib.bilivideo.com`，lastAttemptAt=1793535313755；讀取時為 waiting，原因曾為 cross-tab-cooldown、low-buffer，清理時為 awaiting-progress。起播量測為 skipped／preflight-skipped:xhr-explicit-timeout，候選數零；沒有觀察到該次量測的完整送出、回應或成功速度證據，不能宣稱測速成功，也不能以冷卻原因推定另有分頁。
- 播放的實際影音回應起初均為 `upos-sz-mirrorali02.bilivideo.com`／206；最後影片為 `upos-sz-mirrorali.bilivideo.com`／206，音訊仍為 ali02／206。這些是腳本功能摘要中的回應主機，不能冒稱為主動測速目標或完整 Network 取證。
- 有界讀取時沒有該量測主機的 challengeEvidence；只讀了當時可得主機，沒有建立歷程收集器或遍歷宣稱全輪所有測速。未手動探測、重設冷卻、提高頻率或製造失敗。
- 本輪自然狀態已確認表示並有影音歸因，但當前路線缺有效速度，因此驗證了相應提示。截圖式「完全無歸因時顯示播放器尺寸」及「有速度但無需求」未自然出現，安裝版該兩分支未驗證；其自動契約見上節。使用者原截圖實際觸發因果仍未完整重現，不宣稱所有儀錶板缺值原因均已消失。

一般播放與三頁操作依上述產品行為判定，不要求完整 Network、診斷報告或工具事件成功。未測來源切換隔離、故障注入、自然恢復、提前重試效用或歷史已停止矩陣；不由本輪 PASS 改判任何舊 FAIL／INVALID。

### 工具限制、清理與原始證據

準備期間出現一次 REPL 區域變數作用域問題、一次導覽運算式在執行前語法錯誤，以及一次 DOM nodeId 無法供捲動使用；改用當次有效物件、正確運算式及可信捲動操作後完成準備。所有身分斷點均立即移除並恢復執行；不把準備錯誤列為產品失敗或額外播放輪次。一次跨自然分段的舊決策比較不具即時比較前提，未用作判定，正式證據改為每次變動的即時前後同物件比較。

清理時快速 JSON 字串比較因 CDP 重排 catalogOverrides 鍵順序而回傳 false；原始 false 保留，另以完整結構比對確認初始、模型及儲存值逐欄相等，updatedAt 同為 1793517717160，沒有設定變更。最後媒體 paused=true、muted=true、rate=1；自有 MutationObserver、計時器、事件監聽與暫存登記移除，Debugger 停用、斷點清除、物件群組釋放、唯一分頁關閉。全程沒有安裝 Network／Fetch 攔截、替換產品 hook 或修改媒體 getter。

私有有界證據位於 `.work/iab-testing/2026-11-01-v2.2.4-2571dfd-R1/`：BASELINE、IDENTITY、OVERVIEW、DETAILS、NAVIGATION、MEASUREMENT、P1、P2、CLEANUP、SUMMARY、CASES，以及畫面截圖；不提交簽名 URL、Cookie、IP 或播放器物件。P1 原始 JSON SHA-256 為 `49e10d2eb889ccd02393a8c645df6eda50542699a3204951424e466abbfdfb1c`；P2 為 `78b07a23f823e14b387412f11763b8ccfdd99069533a3ea2a3b61b2a9c16a0f0`。本次僅維護驗收文件，不重跑已通過的執行期測試、不修改產品或 Release、不升版或發布。

文件結案檢查通過 256 Markdown／3,153 本機及儲存庫連結；7 個不可變舊斷鏈、434 個歷史原址限制、18 個私有證據未核對及 576 個外部未連線引用另列。封存檢查通過 454 搬移項目、三份追加日誌、111 未變檔、72 checksum／330 列，未執行 local 模式。git diff --check 通過；三份日誌全部原位元組前綴及本版五份 Release 原件重新核對一致，差異僅七份驗收文件及導覽／登記。

<a name="v223-r1-安裝驗收2026-11-01"></a>

此相容入口見 [v2.2.3 完整正文及 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-完整正文保存2026-11-01)，不是本版新增安裝驗收。

<a name="清除結果與零殘留範圍"></a>
<a name="全文閱讀覆蓋清單"></a>

這兩個舊入口導向 [v2.2.2 零殘留全文清查與逐檔 SHA-256](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v222-完整正文保存2026-11-01)。本版執行變更差異與契約核對，沒有將舊版 211 檔全文清查冒稱為本版重新全文閱讀。

## 歷史驗證導覽

[歷史索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)；[v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修復與根因"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="發布與安裝限制"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修後唯一-hk04-定向窗口"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-30up141-安裝版實測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31更新後安裝核對"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31補測與單分頁重測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="v220-安裝驗收-r12026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="澄清後在原期限內續行"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="auto-2-倍補充與本次驗收結案"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="公開交付"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。
