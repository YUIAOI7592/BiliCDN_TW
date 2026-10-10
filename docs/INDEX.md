# 專案文件索引與維護規則

<a name="br01-followthrough-status"></a>

**2026-10-11 現行版本 v2.1.17：BR-01 SDK 重載後續恢復修復、必要驗證、正式發布及公開產物核對完成；新版安裝驗收已有部分證據，完整矩陣未結案。** 原 application **3 fail／3 pass**、BODY 播放／倍速入口 **10 fail／20 pass** 先於執行期修補保存；最後全套 **19 套件／716／716**、typecheck、**44 個執行期模組**架構及 verify **v2.1.17** 通過。獨立安全差異 **11／11 項、0 候選／0 可報告發現**，Chrome 最後來源隔離 **22／22**（12 個控制模型＋10 個真正可信輸入）通過並完成清理；自有 iframe／合成媒體／FakeClock 與 31 秒模型拖曳不代表安裝驗收。掃描的整體工作目錄變動警告保留，四個凍結執行期檔案雜湊一致不等於整體快照一致。[v2.1.17](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 於 00:31:14（Asia/Taipei）發布，唯一 **332,575 bytes** 腳本與無認證公開 latest 的版本／大小／SHA-256 核對一致；00:34:48.957 已核對指定影片完整新版執行本體、唯一 Runtime／ControlCenter 及 hooks。Auto 1／2 倍正常暫停／恢復／短 seek 與各一次真正自有 SDK 重載後續恢復子集取得證據；完整期限、精確延遲、真正背景／gate 與晚到 SDK 等剩餘項目仍待驗收。現行契約見 [後續修復報告](BR01_FOLLOWTHROUGH_FIX_REPORT.md)、[PROJECT_CONTEXT](PROJECT_CONTEXT.md#br01-owned-sdk-reload)、[架構](ARCHITECTURE.md)、[開發流程](DEVELOPMENT.md) 與 [TODO](TODO.md)。手動實際 SDK 校準不等於控制器救援；原 87.785 秒自然網路起因仍待定位，已有 timeout 不能單獨證明 CDN 故障。

### v2.1.16 已發布基準

**現行交付：BR-08 完整拖曳契約修復與 v2.1.16 發布完成；BR-01 完整安裝版驗收已有部分證據，仍未完成。** 全套 **637 正式案例**、typecheck、architecture、verify **v2.1.16** 與 diff 檢查通過；獨立安全差異 **14／14 覆蓋、0 可報告發現**，Chrome 來源隔離 **31 個有效案例通過**，兩個無效校準窗口排除並完成清理。21:05:38（Asia/Taipei）已發布，遠端 main／標籤、唯一 **320,794 bytes** 腳本及公開 latest 版本／SHA-256 核對一致；21:11:07.331 已核對實際新版完整本體／singleton 1／hooks。Auto 1／2 倍 wrapper／inner 四個超過 32 秒拖曳窗口與釋放、正常播放／暫停／短 seek、約 12 秒 video-only 延遲後恢復均有證據，腳本重載 0；完整逾時及其餘矩陣仍待完成，來源隔離不能代替安裝版。見 [BR-08 修復](BR08_FIX_REPORT.md)、[TEST_REPORT](TEST_REPORT.md)、[v2.1.16 安裝矩陣](CHROME_v2.1.16_ACCEPTANCE.md) 與 [TODO](TODO.md)。以下日期及「未修復」保留原輪次狀態。

新版實際 XHR hook 與 NativeXhr 的 Blob **33／33 成對對照**通過，僅涵蓋 BR-02 原生所有權、例外、事件重入及 getter 子集；Catalog／HTTPDNS 虛擬拒絕、媒體歸因、真正 pending gate 與 cid／epoch 仍待驗收，正式案例仍為 637。另有模式復原約 174.648 秒後 **2913 → 0.307 秒**的 Auto 位置跳變待定位；沒有新路線／核心動作或生命週期變更，SDK／完整 Network 不足且採樣上限 dropped，未確認腳本缺陷。兩者的證據範圍與續查條件見 [v2.1.16 安裝紀錄](CHROME_v2.1.16_ACCEPTANCE.md) 與 [TODO](TODO.md)。

**歷史交付：BR-07 修復與 v2.1.15 發布完成；當時實際新版部分驗收，新 BR-08 未修、完整 BR-01 未完成。** BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構與最終 verify **v2.1.15** 通過；來源隔離 **40／40 有效案例**，獨立安全完整覆蓋／0 可報告發現。公開 latest **2.1.15／317,487 bytes／SHA-256** 與實際完整 body／singleton 1 已核對，Auto 1／2 倍正常鍵盤及新 15 秒寬限取得證據。續測確認 [BR-08 進度列外層拖曳漏辨](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)，已報告並清理，未擴修。見 [BR-07 修復](BR07_FIX_REPORT.md)、[TEST_REPORT](TEST_REPORT.md) 及 [安裝矩陣](CHROME_v2.1.15_ACCEPTANCE.md)。v2.1.14 原 [缺陷](CHROME_v2.1.14_BR07_KEYUP_SEEK.md)、[安裝](CHROME_v2.1.14_ACCEPTANCE.md)、更新前 10:59Z 中途觀察與完整歷史保留；以下較早日期只描述當時。

**先前續測：2026-10-10 約 13:45–13:57 確認 [BR-06 鍵盤 seek 所有權缺口](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)，當時未修復。** 實際 Auto 1／2 倍的新 BODY 方向鍵 seek 沿用舊停滯期限，8.205／6.986 秒便備援；滑鼠對照通過，獨立正確契約 2 fail／3 pass。當輪達成找問題並交付報告的退出條件，來源與 Release 沒有修改。

**2026-10-10 歷史交付：[BR-01 A／B／C 修復](BR01_FIX_REPORT.md) 及 v2.1.13 發布完成。** Auto 長 seek 有界救援，474 正式案例／verify、安全差異及來源隔離 22／22 通過；公開產物與實際新版 body 已核對，[安裝版](CHROME_v2.1.13_ACCEPTANCE.md) 的 Auto 延遲恢復取得部分證據，完整矩陣未結案。原自然網路起因與其他完整驗收不因此結案。[v2.1.12 原調查](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) 保留原始失敗證據。

**歷史瀏覽器狀態：2026-10-10 03:02–03:36 已續測 BR-01 與剩餘領域，交付 [完整覆蓋報告](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md)。** BR-01 seeking 的救援抑制機制已定位，原始網路起因未證實；新增 [BR-05 Fetch 取消原因遺失](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md)。42 個新增受控案例、真 gate 與真 SDK 核心替換有結果，真正背景操作仍未取得 hidden 前提；**產品驗收未全通過，BR-04／05 未修復**。正式來源及 Release 未修改。

**2026-10-10 02:58 先前續測：BR-04 已在真正 Chrome 155／v2.1.11 安裝版確認。** 當輪達成找問題並交付詳細報告的替代完成條件；新的續測目標沒有以此提前退出。見 [BR-04 報告](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)。下方中途暫停文字保留其時間點。

**2026-10-10 02:42 中途狀態：v2.1.11 安裝版驗收部分完成，當時依使用者要求暫停。** BR-03 31 個有效案例與 BR-02 42 個對照通過，當時 BR-04 僅 Node 重現；見 [中途報告](CHROME_v2.1.11_PROGRESS.md)。下文發行時的待安裝文字保留其當時範圍。

本索引於 **2026-10-11** 更新至 **v2.1.17 BR-01 後續恢復修復、必要驗證、正式發布與公開核對完成、實際新版部分安裝驗收**，保留 v2.1.16 發布／公開產物及部分安裝證據。本輪完整證據見 [TEST_REPORT](TEST_REPORT.md) 與 [v2.1.17 安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md)；剩餘範圍以 [TODO](TODO.md) 為準。已分類受控資料與工具清理完成不補齊 Network 缺口或歷史滾動淘汰（everDropped=true；最終 dropped=false）；完整安裝矩陣未結案。v2.1.12 的 35 項安裝驗收保留其當時範圍，下方歷史日期不代替現行狀態。

2026-10-07 的 Markdown 粗體渲染盤點與排版修正見 [文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-07-markdown-粗體渲染修正)；後續排版檢查方式列於 DEVELOPMENT。

產品行為以 [src-v2/entry.ts](../src-v2/entry.ts) 及其模組為準；版本與工具以 [release.json](../release.json)、[package.json](../package.json) 及 [package-lock.json](../package-lock.json) 為準。指南與程式不一致時，先確認實際行為再修正文檔，歷史觀察保留原始版本與日期。

閱讀入口：

2026-10-09 的 [功能與競態修復對照](FUNCTIONAL_FIX_REPORT.md) 記錄 v2.1.9 的 17 項修復、正式回歸及新的瀏覽器待驗收範圍；舊版已發布驗收維持原紀錄。

- 一般使用者：README → 安裝／模式／操作／排查。
- 開發者：PROJECT_CONTEXT → SECURITY → ARCHITECTURE → DEVELOPMENT，並遵守 AGENTS。
- 維護者：TODO → 最新 TEST_REPORT → CHANGELOG；追溯舊證據時進入歷史報告與封存索引。

## 現行指南

| 文件 | 主要責任 |
| --- | --- |
| [README](../README.md) | 安裝、功能、四種模式、控制中心、排查及隱私 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 產品契約、不變量及已確定交付邊界 |
| [AGENTS](../AGENTS.md) | 必要開發流程、架構、安全及發行／文件要求 |
| [ARCHITECTURE](ARCHITECTURE.md) | 依賴、狀態、控制器、適配器、生命週期與診斷 |
| [DEVELOPMENT](DEVELOPMENT.md) | 環境、命令、測試隔離、建置、瀏覽器檢查及封裝 |
| [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md) | 測試遷移、套件登記、XHR 原生替身及 BR-07 keydown／keyup 提交階段校準 |
| [測試遷移對照](../tests-v2/MIGRATION.md) | 原 891 項功能斷言的行為群組、分支及參數矩陣對照 |
| [SECURITY](../SECURITY.md) | 信任邊界、持久資料、網路權限及診斷限制 |
| [TODO](TODO.md) | 目前已批准工作、結案事項及未安排方向 |
| [FUNCTIONAL_FIX_REPORT](FUNCTIONAL_FIX_REPORT.md) | v2.1.9 的 17 項修復、正式契約及瀏覽器驗收步驟 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游基準、v1／v2 關係及來源校驗 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權、工具用途及版本 |

本索引管理文件用途、入口及維護對照。這些指南隨程式或發布狀態更新，不能以舊版規格取代目前實作。現行說明、變更紀錄及最新版報告使用繁體中文；封存的歷史正文保留原文。

2026-10-07 中文化範圍為 **14 份 Markdown**：根目錄 README、AGENTS、SECURITY，`docs/` 的十份文件，以及 `tests-v2/MIGRATION.md`；2026-10-09 新增修復對照報告沿用相同政策。CHANGELOG 的全部版本條目使用繁體中文，仍保留各版當時的驗證狀態；測試遷移對照以中文說明行為，英文欄逐字保留原案例群組。封存正文、82 份 Release Markdown 快照、本機工作資料及第三方／產生的文件不翻譯。繁體中文標題若取代既有標題，必須保留原錨點別名；既有別名及跨文件引用繼續有效。

共用用語為「儲存元件（store）」「測試情境（fixture）」「建立函式（factory）」「中繼資料（metadata）」「原始碼對照（source map）」「報告產生器（reporter）」「堆疊資訊（stack）」。瀏覽器 hook 稱為「攔截」，測試 hook 稱為「測試掛鉤」或「清理掛鉤」。產品名稱、授權名稱、程式識別字、命令、網址、路徑及原始狀態值可以保留英文，必要時補上中文解釋。翻譯必須維持規則強度、條件、數值與證據界線；日期固定的封存正文保持原樣，維護結果另追加有日期的紀錄。

2026-10-07 中文化的實際檢查見 [文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-07-現行-markdown-文件繁體中文化)。

## 檔案配置

根目錄保留 README、AGENTS、SECURITY、LICENSE 及必要建置設定；其餘現行文件集中於 `docs/`。封裝固定讀取 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md`，來源原件及校驗清單位於 `baseline/`。

歷史報告、整理紀錄、計畫、研究、驗收及截圖集中於 [archive/retired](../archive/retired/README.md)。[封存總覽](../archive/README.md) 說明公開文件與忽略的本機資料分區。2026-10-07 盤點為 **29 份公開 Markdown**：根目錄 3 份、`docs/` 10 份、封存索引 2 份、歷史文件 13 份及測試遷移對照 1 份；不計入 Release 快照或私有本機封存。2026-10-06 的 27 份盤點及更早數字保留於 [有日期的維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

## 發行與驗證紀錄

| 文件／產物 | 閱讀方式 |
| --- | --- |
| [CHANGELOG](CHANGELOG.md) | v2.0.0～v2.1.17 條目使用繁體中文；功能差異、順序及當時驗證狀態保留，v2.1.17 發布／公開產物核對完成 |
| [BR04_BR05_FIX_REPORT](BR04_BR05_FIX_REPORT.md) | 有界 XHR 準備、取消 reason、66 新契約、來源隔離及分列安裝驗收 |
| [BR01_FIX_REPORT](BR01_FIX_REPORT.md) | v2.1.13 A／B／C 原修復：Auto 15／30／15 秒有界救援、26 新契約、安全差異、來源隔離與當時發布／安裝；不包含目前 SDK 後續恢復修補 |
| [BR01_FOLLOWTHROUGH_FIX_REPORT](BR01_FOLLOWTHROUGH_FIX_REPORT.md) | v2.1.17 自有 reload／BODY 操作、SDK seek、跨租期進度與終止後不重試；先行失敗、716 正式契約、安全差異、22 個來源隔離及分列交付／安裝狀態 |
| [CHROME_v2.1.17_ACCEPTANCE](CHROME_v2.1.17_ACCEPTANCE.md) | v2.1.17 完整實際本體、Auto 1／2 倍正常操作與自有 SDK 重載後續恢復子集；22 個來源隔離、舊版 SDK 校準、清理及完整安裝矩陣剩餘限制分列 |
| [CHROME_v2.1.12_ACCEPTANCE](CHROME_v2.1.12_ACCEPTANCE.md) | 實際新版產物身分、35 項共用 gate 矩陣、同片基本回歸、作廢輪及資料清理限制 |
| [CHROME_v2.1.12_BR01_AUTO_INVESTIGATION](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) | Auto 影片延遲／正常 seek、救援抑制鏈、無界意圖與誤標恢復、獨立重現、原自然起因與政策限制 |
| [BR07_FIX_REPORT](BR07_FIX_REPORT.md) | keydown／keyup 各派送實際 seek 所有權、正式失敗契約、必要驗證及發布對照 |
| [BR08_FIX_REPORT](BR08_FIX_REPORT.md) | 完整拖曳命中／手勢所有權、control-loss、監控與恢復提交門檻、正式契約、獨立安全、來源隔離及發布核對；安裝版分列 |
| [CHROME_v2.1.16_ACCEPTANCE](CHROME_v2.1.16_ACCEPTANCE.md) | BR-08 來源隔離與實際新版安裝證據分列；BR-01 剩餘矩陣、前提、清理及待驗收狀態 |
| [CHROME_v2.1.15_ACCEPTANCE](CHROME_v2.1.15_ACCEPTANCE.md) | 實際新版完整身分、Auto 1／2 倍正常／故障窗口、BR-08 新缺陷、未成立矩陣與最終清理 |
| [CHROME_v2.1.15_BR08_PROGRESS_DRAG](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) | P2 外層命中區長拖曳漏辨，現場 15 秒備援、正常 inner 反證、私有 3 fail／4 pass 與修復方向 |
| [CHROME_v2.1.14_BR07_KEYUP_SEEK](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) | v2.1.14 原始右鍵 keyup 缺陷、原生時序、有效停滯窗口與清理限制 |
| [CHROME_v2.1.14_ACCEPTANCE](CHROME_v2.1.14_ACCEPTANCE.md) | v2.1.14 實際本體／singleton、正常對照、BR-07 失敗與待驗收矩陣 |
| [TEST_REPORT](TEST_REPORT.md) | v2.1.17 本輪修復／最終整合／安全／來源隔離、已完成發布／公開核對與待新版安裝狀態；v2.1.16 完整正文另存 archive |
| [CHROME_v2.1.13_ACCEPTANCE](CHROME_v2.1.13_ACCEPTANCE.md) | 新版 body、Auto 1／2 倍速影片延遲、一次重載、網站暫停撤銷、清理與待驗收矩陣 |
| [CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md) | 可信 BODY 方向鍵漏掉使用者修訂，Auto 1／2 倍提早備援、滑鼠對照、獨立失敗契約、根因與剩餘驗收 |
| [CHROME_v2.1.9_ACCEPTANCE](CHROME_v2.1.9_ACCEPTANCE.md) | 2026-10-09 部分真實瀏覽器驗收、18 個原生 XHR 案例及待定位停滯 |
| [CHROME_v2.1.9_BR02_XHR_FAILED_OPEN](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md) | 持續驗收確認的 XHR 例外安全性缺陷、六個 Chrome 失敗情境、根因與原始重現入口 |
| [BR02_FIX_REPORT](BR02_FIX_REPORT.md) | v2.1.10 修復、40 個新增正式契約、來源隔離驗證、安全審查及後續安裝版證據／gate 限制 |
| [CHROME_v2.1.10_ACCEPTANCE](CHROME_v2.1.10_ACCEPTANCE.md) | 68 個安裝版 XHR 案例執行通過、同片操作、87.8 秒 seek 追加觀察及未完成範圍 |
| [CHROME_v2.1.10_BR03_CONTENT_EPOCH](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) | 相同 DASH 清單排列誤觸 epoch、音訊授權失效、來源／安裝版重現與修正方向 |
| [CHROME_v2.1.11_PROGRESS](CHROME_v2.1.11_PROGRESS.md) | 安裝版 31 個 BR-03／42 個 BR-02 對照、部分 gate／R04、同片回歸、暫定 BR-04 Node 失敗及暫停檢查點 |
| [CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md) | 續測確認內部 XHR 準備遭同步重入失效，真 gate／原生對照、根因、重跑及清理證據 |
| [CHROME_v2.1.11_REMAINING_ACCEPTANCE](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md) | BR-01 救援抑制定位、正常網站／真 gate／真 SDK／42 個新增受控案例、完整剩餘覆蓋與原生限制 |
| [CHROME_v2.1.11_BR05_FETCH_ABORT_REASON](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md) | 真 gate Fetch 遺失取消原因，Chrome 原生對照、Node 3 pass／4 fail、位置與最小修正方向 |
| [BR03_FIX_REPORT](BR03_FIX_REPORT.md) | BR-03 本機修復、43 個新增正式契約、修復前後結果、安全差異審查、Chrome 來源隔離及安裝版待驗收 |
| [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md) | v2.0.2～v2.1.9 的歷史完整報告，包括發行前模組化驗證 |
| [DOC_MAINTENANCE_HISTORY](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) | 2026-10-03 三段原整理紀錄及後續有日期的文件檢查 |
| [v2.1.16 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.16) | 2026-10-10 已發布；遠端 main／標籤、唯一腳本及公開 latest 版本、大小、SHA-256 核對一致 |
| [Release/v2.1.16](../Release/v2.1.16/) | BR-08 封裝快照；保持發布準備當時內容，發布後不回寫 |
| [v2.1.10 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.10) | 2026-10-09 已發布；唯一附件及公開 latest 版本、大小、SHA-256 均核對一致 |
| [Release/v2.1.10](../Release/v2.1.10/) | 本次封裝快照；發布後不回寫 |
| [v2.1.9 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.9) | 2026-10-09 已發布並核對 latest 下載；附件只有 `BiliCDN_TW.user.js` |
| [Release/v2.1.9](../Release/v2.1.9/) | 當次使用者腳本、報告、變更紀錄、資訊清單、校驗值快照；發布後不回寫 |

自動驗證、安全掃描與真實瀏覽器驗收分開記錄。v2.1.8 的安全 `partial coverage`、MP4 試片／公開 DASH 觀察、較早 DASH 緩衝及完整公開 MP4／FLV 限制均保存於歷史報告；v2.1.9 發行前靜態差異審查為完整覆蓋，後續 BR-02 修復另有獨立報告，不沿用歷史安全結果。BR-01 停滯與其餘未覆蓋情境仍保留。**v2.1.6 Chrome／Tampermonkey 驗收已批准通過、已結案**，歷史覆蓋限制不構成待辦。

## 歷史計畫與瀏覽器紀錄

| 文件 | 保留範圍／狀態 |
| --- | --- |
| [SECURITY_REVIEW_v1.6.0](../archive/retired/docs/SECURITY_REVIEW_v1.6.0.md) | v1.6.0 候選版安全紀錄，不是現行政策或掃描 |
| [PLAN_v2.0.2](../archive/retired/docs/PLAN_v2.0.2.md) | 當時實作計畫；例外不作現行開發／發行規則 |
| [POST_RELEASE_v2.0.2](../archive/retired/docs/POST_RELEASE_v2.0.2.md) | 當時事故、修復及工作狀態 |
| [CHROME_v2.0.3_ACCEPTANCE](../archive/retired/docs/CHROME_v2.0.3_ACCEPTANCE.md) | 該版針對性瀏覽器回歸證據 |
| [CHROME_v2.1.2_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.2_ACCEPTANCE.md) | 該版觀察與覆蓋限制 |
| [CHROME_v2.1.6_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md) | 已批准通過且結案的驗收，保留觀察與限制 |

## 已撤銷的 CDN 新增研究

**新增節點計畫已撤銷。** 下列五份文件保留 2026-09-25 起的調查、實驗及停止新增節點決定。候選排序、建議及當時測試計畫不授權修改 Catalog，也不列入目前待辦。

| 文件 | 用途 |
| --- | --- |
| [CDN_OPEN_SOURCE_SURVEY](../archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md) | 外部專案及候選來源研究快照 |
| [CDN_NODE_FULL_SCREENING](../archive/retired/docs/CDN_NODE_FULL_SCREENING_2026-09-25.md) | Node 初篩，非正式瀏覽器驗收 |
| [CDN_CANDIDATE_TEST_PLAN](../archive/retired/docs/CDN_CANDIDATE_TEST_PLAN_2026-09-25.md) | 已撤銷測試草案 |
| [CDN_RANGE_PLAYBACK_EXPERIMENT](../archive/retired/docs/CDN_RANGE_PLAYBACK_EXPERIMENT_2026-09-25.md) | 當時 Range／播放實驗及限制 |
| [CDN_TEST_RESULTS](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md) | 跨環境結果及停止新增節點決定 |

## 不回寫的歷史資料

`Release/v*/`、`baseline/`、封存 v1 程式及安全產物保存當時證據，不作現行 v2 建置／測試輸入。文件維護不修改已封裝報告、校驗值、舊測試結果或已封存且不可變更的安全掃描。後續狀態更新最新版 TEST_REPORT，或新增有日期／版本的紀錄。

## 維護對照

| 變更來源 | 應檢查文件 |
| --- | --- |
| `domain/`、`state/settings-store.ts`、控制中心文字與命令 | README、PROJECT_CONTEXT；預設值、模式、操作名稱及例外 |
| 儲存解析器／鎖／監聽器、Vault、Fetch／XHR、瀏覽器攔截 | SECURITY、ARCHITECTURE；要求、實際保障與平台限制 |
| 控制器、介面、依賴規則及測試支援 | ARCHITECTURE、AGENTS、DEVELOPMENT；權責、生命週期及檢查範圍 |
| `scripts/`、工具設定、package 及依賴鎖定檔 | DEVELOPMENT、UPSTREAM_MANIFEST、THIRD_PARTY_NOTICES；命令、用途及輸出 |
| 實際測試、安全掃描、瀏覽器驗收 | TEST_REPORT 及對應日期／版本紀錄；只記錄已取得證據 |
| 測試執行器、測試資源範圍、FakeClock、型別設定 | TEST_TOOLING_REPORT、測試遷移對照；與產品發行及瀏覽器紀錄分開 |
| 封裝及 GitHub 發布 | README、CHANGELOG、TEST_REPORT、PROJECT_CONTEXT、本索引；版本、狀態、連結、雜湊及附件 |
| 使用者新增、取消或結案範圍 | TODO、PROJECT_CONTEXT 及相關歷史狀態標示 |

每次維護依序檢查：

1. 對照程式、設定及腳本核對文字、命令；測試數量只列於有日期／版本的驗證紀錄。
2. 檢查根目錄、`docs/` 及公開封存的 Markdown 連結、路徑、錨點及用途；新增文件納入索引。完成的歷史文件移至 `archive/retired/docs/`，同步更新連結。
3. 歷史資料標示適用版本／日期及現行指南入口，保留觀察、取消決定與限制。翻譯標題保留原錨點別名，搬移章節在固定入口留下導引。
4. 確認舊待辦未重新開啟，簽名 URL、憑證、IP 及播放器物件未進入文件。
5. 換版時將上一版完整 TEST_REPORT 加入歷史報告，再更新固定入口及原錨點導引；CHANGELOG 保留舊條目。兩個封裝輸入指向其他文件時使用完整儲存庫 URL，已發布快照不回寫。
6. 執行 `git diff --check`，確認差異範圍及受保護檔案未改變；實際執行的自動驗證按日期記錄，不將文件檢查寫成新安全掃描或瀏覽器驗收。

這些規則隨專案變更執行，不代表已建立排程、CI/CD 或持續監控。

## 文件整理歷史導覽

三段 2026-10-03 原紀錄已於 2026-10-06 搬入 [文件維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)，原日期、盤點數量及驗證敘述保留。本次整理的實際檢查也在該文件另立日期紀錄。

<a name="2026-10-03-文件維護紀錄"></a>

- [2026-10-03 文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-文件維護紀錄)

<a name="2026-10-03-第一次封存整理紀錄"></a>

- [2026-10-03 第一次封存整理紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-第一次封存整理紀錄)

<a name="2026-10-03-根目錄文件集中整理"></a>

- [2026-10-03 根目錄文件集中整理](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-根目錄文件集中整理)
