# BiliCDN_TW v2.2.6 確定性選路、狀態機與提交所有權驗證

日期：2026-11-02（Asia/Taipei）。產品基準為 main／0e1375a224eee0afa409e0a6fea50837968c9aac（v2.2.5）；先以 abf2115 獨立保存調查文件及六案原始觀察，再依序提交需求、起播、提交、恢復與 UI 整合。最終執行期提交為 029618571132709a3ed8f247b0b8346d65bf6a02；後續為版本、文件、封存與封裝。

## 修復結果與證據邊界

35 項調查均有確定規則與正式案例對照，見下表。離線反例已改為期望行為回歸；原調查與六案現況特徵證據完整保留，不回寫成六案產品 PASS。這些結果證明受控交錯與狀態契約，尚未證明使用者現場多輪換 CDN 的唯一根因，也不代表安裝版播放通過。

合法固定與禁止規則優先，足速證據優先；起播維持三候選／三秒，可信影音由影片取得一次窗口。失敗結果不再藉原始來源偏好勝出；無有效結果只走一次合法未測退路。傳輸與 API 依送出／路線／選擇所有權提交，健康證據與控制資格分開。恢復使用同段額度、絕對期限及原生讀回；畫面僅顯示目前階段、等待、原因、期限及現有額度。

三頁控制中心、Native 預設及既有布林值、schema 2、四個儲存鍵、24 小時 TTL 與樣本算法保持。沒有增加主動探測、下載上限、重載次數、週期計時器、診斷／原線對照／掉幀收集、持久格式或執行期依賴。單次刷新共用快照、詳細文字按需建立仍由既有 UI 契約驗證。

## 三十五項閉環對照

表內案例均納入本次完整執行並通過；政策保留項同時保留拒絕／失效對照。精確案例名稱與參數映射見 [測試遷移對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v226-確定性流程與交錯契約)。來源包括 [v226-demand](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-demand.ts)、[v226-flow](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-flow.ts)、[v226-startup](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-startup.ts)、[v226-routing](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-routing.ts)、[v226-api-order](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-api-order.ts)、[v226-http-status](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-http-status.ts)、[v226-monitor](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-monitor.ts)、[v226-recovery](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-recovery.ts)、[v226-interleavings](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-interleavings.ts) 及 [v226-ui-state](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/v226-ui-state.ts)；表列既有案例位於 [功能競態回歸](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions/functional-races) 與 [恢復／讀回回歸](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions)。

| 項目 | 現行確定規則 | 正式案例與結果（均 PASS） |
| --- | --- | --- |
| S01 | 未驗證來源使用固定順序；足速證據優先，合法固定與禁止規則優先。 | domain／cold startup；v226-startup；routing-convergence |
| S02 | 跨片主機學習保留 24 小時 TTL，容量標明 current-transport／current-probe／historical-cache。 | V225 capacity TTL；v226-routing；control-center |
| S03 | 最多五條備援，足速證據與家族分散優先，未測來源不標健康。 | UP141-ROUTE measured sufficient backups diversify families before same-family headroom |
| S04 | 合法計畫與穩定主機可重用；失敗、限制或身分撤銷不能靠舊計畫復活。 | routing-convergence；v226-interleavings；v226-routing |
| S05 | 取消未成功原始來源的隱含優先，足速候選間保留合法穩定主機。 | domain cold startup；v226-routing S10／S11 |
| S06 | 同步／明確 timeout XHR 保留原生送出並顯示跳過理由，不扣未啟動窗口。 | native-transport XHR；v226-ui-state |
| S07 | 可信混合內容由影片保留唯一窗口，可信純音訊可使用；低信任影片不能奪取純音訊預算。 | v226-startup S07 三案 |
| S08 | 完整合法池按證據排序後選三個，未知來源沿游標；Native 數量與精確授權不變。 | v226-startup；v226-routing R04；progressive-routing |
| S09 | 16 KiB 快取驗證沿用歷史速度，不新增完整速度樣本；新量測仍需 64 KiB。 | UP141-START cached candidate must complete all 16KiB before early release；measurement-state |
| S10 | 本輪足速、最快有效、一次合法未測退路依序選擇；失敗原主機不能壓過有效結果。 | v226-routing safe=12／20、demand=10 |
| S11 | 移除低於足速門檻仍可藉九成偏好勝出的路徑。 | v226-routing S11：13.4 對 14.8 Mbps |
| S12 | 三候選共用三秒；Catalog-only 既有開關仍可在首個足速結果提早放行。 | UP141-START；measurement-state；v226-flow |
| S13 | 全未成功只提交一次未測退路；無退路明確耗盡，取消與終態不復活。 | v226-startup S13／cancellation；v226-flow |
| T01 | 舊輸出備援依目前計畫改寫；新路線成功後不被舊備援奪回。 | v226-routing T01 native=false／true；v226-interleavings |
| T02 | 失敗重選使用共用碼率／倍率需求，刪除獨立 video 8 Mbps 分支。 | v226-demand；v226-routing T02：4 Mbps × 2 → 10 Mbps |
| T03 | 404／410 限當前資源與主機；其他 4xx 明確拒絕；取消不算失敗，403 沿專用規則。 | v226-http-status 八案；native-transport |
| R01 | 冷起播由第一筆影片送出起算；音訊不建立影片救援。 | v226-routing R01；v226-monitor |
| R02 | 準備無候選不扣提交額度；相同資格等待，新增來源才重備，期限不重開。 | v226-monitor R02 三案 |
| R03 | 已有尺寸／readyState=2 仍按實際無進度與低緩衝判定冷停滯。 | v226-monitor R03；BR-01 initialized stalled core |
| R04 | 恢復偏好主機從完整合法池核對，不受重新建立的前三候選排除。 | v226-routing R04 valid preferred host survives a different startup cursor |
| R05 | 首次進度前共用重載後十五秒；首次進度後使用固定十五秒確認期限。 | BR-01 exact 15/30/15 boundaries；SR2；v226-flow |
| R06 | 先捕獲有效 SDK 方法，真正派送前扣額度；派送後失敗不退還；重入撤銷不得派送。 | v226-recovery R06；BR-01；recovery-restore-controller |
| R07 | SDK 尋位／倍率失敗同用拒絕結果；至少一秒、已知不符且位置基準有效才可一次原生補正。 | SR1／SR2；player-restore-readback；recovery-restore-controller |
| R08 | 倍率前後依舊／目標倍率的可達區間驗證，單一位置基準不以新倍率回算舊時間。 | player-restore-readback 的倍率分段與位置未知／錯位拒絕 |
| R09 | 保存有效原生倍率優先；play 拒絕結案為已還原但暫停，晚到結果不能復活。 | v226-recovery R09；BR-01 late play rejection；SR2 |
| R10 | 兩筆連續合格進度確認恢復；低緩衝段須十個健康 tick 且緩衝至少十秒才結束。 | BR-01 two genuine progressing samples；v226-monitor R05 H02 |
| H01 | 舊決策合法成功可學習，不能改寫新計畫／親和／表示或觸發恢復。 | v226-routing H01；v226-interleavings 96 案 |
| H02 | 短暫進度進入確認，維持同段 ID、起點與備援／重載額度，不重領六秒。 | v226-monitor R05 H02；UP141-MON；v226-flow |
| H03 | 合格 tick 依時間去重，排程斷層重算穩定度；鎖等待、無候選、取消與冷卻分開。 | v226-monitor H03；up141-probe；measurement-metadata |
| H04 | 提前重試依當次 Catalog 傳輸判定；Native 開啟不排除 Catalog，真正 Native 不擴權。 | up141-retry-policy；up141-test-release；xhr |
| H05 | 替代資格仍需同內容／表示／授權／政策內六十秒兩筆不同實際影片傳輸；探測不得授權。 | up141-retry-policy；早重試逾時／取消／額度與原生 XHR 契約 |
| L01 | API 送出序號以已接納回應為水位；同步重入使用獨立處理所有者，外層不採用內層 epoch。 | v226-api-order 十案；XHR protocol-relative CID；functional-races/content |
| L02 | 同選擇並行請求共享修訂；舊 A 完成不能覆寫 B，新送出的 A 回切須兩筆新成功。 | v226-routing L02；v226-interleavings 96 案 |
| L03 | 缺 cid 的目錄備援仍保守失效，具名內容判定不以外觀推定同片。 | BR-03 missing cid uses overlap without forgetting cid；functional-races/content |
| L04 | 只排除既有追蹤／等價參數；未知參數、真正換片及分 P 仍失效。 | V224 navigation identity: unknown parameter；adapter-boundaries；v226-interleavings |

交錯矩陣列舉兩主機、兩表示的四筆並行請求全部 24 個完成順序，分別套用無邊界、內容、政策及授權失效，共 96 案；斷言決策／選擇身分、事件、學習、恢復副作用及晚到拒絕。這是所列有限交錯的窮舉，不宣稱涵蓋任意瀏覽器排程。同步 API 重入另驗 Native 開／關、較舊／較新回應、低信任提示及世代變更；被拒新回應不得推進接納水位。

## 自動驗證

固定 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。命令已檢查不啟動網站服務；完整測試的工具案例只在暫存位置建立 Git 儲存庫。最初受限權限造成 tooling 暫存 Git 失敗，已與產品結果分開，依授權重跑基線通過。

基線 **18 套件／1,675 案**，按套件、名稱及參數展開逐項對照無遺失。新增 **181 案**（domain 26、application 150、native-transport 1、control-center 4），最終 **18 套件／1,856 案全部通過**；failed／cancelled／skipped／todo 均為零。六案原始觀察不計入新正式案例數。政策明確變更的既有案例保留名稱及有效斷言，映射見 MIGRATION。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 37 | PASS |
| state | 35 | PASS |
| application | 738 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 168 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 65 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 88 | PASS |
| tooling | 197 | PASS |

型別、架構（94 個執行期模組、無循環）、完整測試、格式、文件、封存與差異檢查全部通過。最終 verify 同時通過固定專案配置、上述檢查、兩次相同建置、JavaScript 語法、v2-only／撤除功能禁止標記及暫存封裝校驗值；沒有覆寫已發行原件。文件檢查保留 7 個不可變舊斷鏈，434 個封存後不可用的歷史原網址、18 個未檢查私有引用及 586 個未抓取外部連結如實列明，不當成新增失敗或外部網址已驗證。

## 安全差異

本次涉及傳輸及授權提交，使用 Codex Security 完成不可變差異審查。第一輪 f00f5b0b-8735-4bcd-8fa4-6379a0f24b29 覆蓋 0e1375a..30185d7 的 65 個來源／測試檔，無成立安全漏洞。第二輪 dc39e6d8-bd87-45c3-8e46-067812f5ca29 覆蓋 30185d7..f7ba9d4 的 25 檔，實際 Node 反例確認一項低風險同步 API 重入授權混合（csf_bbd37bf36cc614f7a5a7aaa8）。其影響限已接納精確媒體來源的內容週期完整性，未證明任意主機、資料外洩或帳戶影響。

0296185 已修正處理所有權與回呼後生命週期檢查，新增六案先失敗後通過。最終修正差異掃描 0f7c786e-a997-4b4d-9f02-3139e1359da8 完整審閱剩餘三檔與 SDK 清理回呼，無新增成立漏洞；已確認原重入路徑在回呼返回後被所有者檢查阻斷。三輪原始安全產物保存在工具管理的不可變掃描目錄，不改寫前輪 finding 為從未發生。Daybreak 存取未授予屬顯示限制，未阻擋實際靜態審查與 Node 反例。

工具實測用量如下，三輪 coverage 均 complete；輸入含快取，數字不能相加當作互不重疊成本，也不能換算實際帳務。

| 掃描 | totalTokens | inputTokens | cachedInputTokens |
| --- | ---: | ---: | ---: |
| f00f5b0b | 42,841,061 | 42,748,014 | 42,299,264 |
| dc39e6d8 | 10,901,507 | 10,878,747 | 10,784,512 |
| 0f7c786e | 2,245,463 | 2,233,690 | 2,196,864 |

## 來源隔離與實際安裝

本版按使用者批准採離線交付，沒有啟動瀏覽器、本機網站服務、來源隔離頁或安裝版窗口，沒有自動更新安裝版。IAB／Tampermonkey 的 v2.2.6 驗收為 **未執行**，不沿用 v2.2.5 R1 當作新版通過；已結束窗口保持停止。

## 公開交付與安裝結案

發布前已核對 v2.2.5 五份原件，搬移至 archive/retired/releases/Release/v2.2.5；大小、SHA-256 與 mtime 完全不變。當前完整 v2.2.5 報告（含 R1）原樣追加到歷史正文，與當年 Release 快照分開保存。v2.2.6 公開 main／標籤、唯一腳本附件及 latest 位元組核對於實際發布後追加，本段目前不宣稱遠端已完成。

## 歷史驗證導覽

[v2.2.5 起播調查與六案原始結果](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/STARTUP_CDN_REVIEW_v2.2.5_2026-11-02.md)；[v2.2.5 完整正文與 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-完整正文保存2026-11-02)；[其餘版本與停止決策](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。現行工作只由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

<a name="v225-r1-安裝驗收2026-11-01"></a>
<a name="v224-r1-安裝驗收2026-11-01"></a>
<a name="v223-r1-安裝驗收2026-11-01"></a>
<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

以上舊入口保留導引，原文與限制見 [完整歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，不構成新版驗收。

<a name="bilicdn_tw-v225-安全吞吐需求餘裕與樣本時效修復驗證"></a>
<a name="新增回歸與保留契約"></a>
<a name="發布後公開核對2026-11-01"></a>
<a name="核心案例與結果"></a>
<a name="倍率速度與播放窗口"></a>
<a name="節點準備與證據限制"></a>
<a name="工具與清理"></a>
<a name="清除結果與零殘留範圍"></a>
<a name="全文閱讀覆蓋清單"></a>
<a name="v221-r1-安裝驗收2026-11-01"></a>
<a name="隔離-b-分支原型驗證2026-10-30"></a>
<a name="修復與根因"></a>
<a name="發布與安裝限制"></a>
<a name="修後唯一-hk04-定向窗口"></a>
<a name="2026-10-30up141-安裝版實測"></a>
<a name="2026-10-31更新後安裝核對"></a>
<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>
<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>
<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>
<a name="2026-10-31補測與單分頁重測"></a>
<a name="2026-10-31一次授權的單分頁缺口補測"></a>
<a name="v220-安裝驗收-r12026-11-01"></a>
<a name="澄清後在原期限內續行"></a>
<a name="auto-2-倍補充與本次驗收結案"></a>
<a name="公開交付"></a>

其餘歷史錨點的原始正文與逐項導引見 [v2.2.5 完整保存](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-完整正文保存2026-11-02)。
