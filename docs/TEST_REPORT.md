# BiliCDN_TW v2.1.39 正式整合版驗證

日期：2026-10-31（Asia/Taipei）。第一階段基準 main 0b4d441，509f56a 完成全部原工作分支與歷史證據的一般合併並推送。第二階段以 codex/control-center-integration 修改業務邏輯及 UI。本版依使用者明確決策正式整合，不把舊效用 FAIL、INVALID 或不足實機改判通過。

## 功能與預設

| 能力 | 本版實際行為 |
| --- | --- |
| OGV | 保留開啟；pre/check/drm 僅辨識、原文傳遞、不改 Vault／epoch |
| 六個自動功能 | 起播提前放行、中段探測、備援分散、提前重試、WebRTC／HTTPDNS 阻止均保留真實開關；新安裝／缺值 true，明確 false 保留 |
| 香港 CDN | 三台一般 Catalog 預設可用，原覆寫保留；原四台預設不可用不變 |
| 格式偏好 | codec 設定及排序能力已刪除，舊 AV1 設定不改表示順序；辨識與歸因保留 |
| 手動操作 | 手動測速、手動最近影片 CDN 封鎖、HK 定向驗證及特殊 context／challenge 分支完整移除 |
| 額外詳記 | verbose 與排名歷史收集器移除；相容欄位空陣列／零；基本事件與 bufferTrend v6 保持 |
| 控制中心 | 標題無 v2；總覽／CDN／播放設定／診斷四頁，真實讀模型、按需報告及匯出 |

schema 2、原儲存鍵、singleton、名稱、namespace 與 latest 更新鏈保留。設定切換不重開起播／冷卻／提前重試額度、不取消網站請求、不放寬恢復與可見性政策。

## 自動驗證

具名紅色契約先覆蓋 CC39 設定／移除／CDN／診斷與 UI，再修改來源。指定工具鏈下 npm run typecheck、npm run architecture（114 runtime 模組）、npm test、npm run verify 全部通過：**3010 案，零失敗／取消／略過／待實作**，控制中心其中 59 案。verify 另核對格式、文件、封存、確定性建置、語法及暫存封裝校驗。docs:check 通過 241 Markdown／2505 本機與儲存庫連結；archive:check 通過 424 搬移檔、三份只追加日誌、123 適用不變檔、66 checksum／306 筆。git diff --check 與暫存差異檢查通過；最後發布文件會再獨立核對。

七個不可變舊失效連結、430 歷史原址限制、十八個私有引用及 411 外部未連網引用保留，不代表外部可達性通過。所有既有發布原件保持位元組與 SHA-256；v2.1.38 五項產物搬至封存，第二階段前配置原件另有精確保護。

舊合併階段完整 verify 2999 案，僅用來證明第一階段未改產品。測試工具的暫存 Git 寫入需正常授權；未改期待或版本鎖。指定 Node 26.8.1／npm 11.19.0，無新增依賴或 CI。

## 獨立效用與已知限制

獨立 early-retry-evaluation 命令真實退出碼 **1，VALID／FAIL**。輸入 SHA-256 9130e0dd4af45496cbbd23dab07737060449b3b94629dfb33d0c986ffd740763，政策 SHA-256 04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37。固定持續慢速可改善，正常突發回補仍可能產生不必要的 100,000 bytes 重下載；沒有更改輸入、門檻或判定。原始 [本輪 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/CC39_EARLY_RETRY_EFFICACY_2026-10-31.json) 精確保護，歷史 FAIL 原件保持。預設開啟來自使用者整合決策，不是效用通過。

## 安全差異

Codex Security 差異掃描已完成並封存：scan 4e827d91-2cf2-4af9-9da9-8b3295aea53b，固定來源範圍 509f56ae9d47ea1d68504d3a3d655c6035831bd2 至 af4f57fb6801dd7fb6c702db70993595629223ef。獨立架構模型及分組審查覆蓋完整 60 項來源清單，另核對 package-lock 與使用者腳本 metadata；無待審項、零可報告發現。跟查包括 Vault 授權、HK 一般 Catalog 限制、鎖內測量重驗、原生 timeout 所有權與許可、可信 UI、去敏及匯出資源清理。

此為固定差異與相關路徑的靜態安全審查，結合本輪契約證據；沒有宣稱整庫無漏洞、瀏覽器原生相容或效用通過。canonical report.md 保存在 Codex Security 本機掃描目錄，SHA-256 為 0f797d5034cd5b7933d6208e9920f306260b1ab913c55340d1b7be8b1c6c5ac2；私有掃描產物未自動公開。後續封裝與指南修改不改該來源範圍。

## 來源隔離與實際安裝

**本版未執行，安裝身分與實機 UI／播放驗收未驗證。** 本回合工具清單沒有既有 IAB 程式化控制能力；可用 Windows Computer Use 的輸入方法會自動啟用目標視窗，與使用者禁止搶焦點衝突，也無法先由目前能力保證播放靜音。因此未操作安裝入口或影片，不要求前景／面板／手動例外。這是工具與執行界線，不判為產品測試 FAIL。全程未啟動本機服務、未播放有聲媒體；沒有重開原兩輪或停止矩陣，舊版安裝身分不補算本版。

## 公開交付與安裝結案

本封裝快照完成時公開發布尚待執行；唯一腳本為 BiliCDN_TW.user.js，版本 2.1.39，507387 bytes，SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3。發布後 main／標籤／唯一附件及公開 latest 核對記於 [現行完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#公開交付與安裝結案)，不回寫已發布封裝。發布和實際安裝驗收分開。

2026-10-31 01:43:45（Asia/Taipei）已公開 [v2.1.39 正式整合版](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.39)。整合分支來源提交 0fa13f6 以一般 merge 納入 main，發布提交為 9f8a88034d2ae625b17d3cc90817442a46b81093；五個 codex 工作分支端點均已核對為祖先，分支與工作樹未刪除。遠端 main 與標籤解參照都指向該發布提交；附註標籤物件為 e29853c3ead4c644b87c872a48fd6d2cbd537bb1。main 後續只追加本核對與結案紀錄，標籤及封裝原件不再改寫。

GitHub 公開 latest API 回報 draft=false、prerelease=false，只有一個 BiliCDN_TW.user.js 附件。另直接下載既有公開 latest/download 入口，核對版本 2.1.39、507387 bytes 與上述完整 SHA-256，均與本機及 GitHub digest 一致。未透過瀏覽器安裝，不宣稱已更新 Tampermonkey；來源隔離、視覺與實機結果仍為未驗證。

## 2026-10-31：更新後安裝核對

18:12（Asia/Taipei），使用者回報已更新 v2.1.39 並要求驗證。當回合基準為 main 2f39f17，開始前工作目錄乾淨。本機腳本與 GitHub 公開 latest API 均為 2.1.39、507387 bytes、SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3，只有一個腳本附件。這次重新核對只證明發行檔，使用者更新回報尚未由工具獨立驗證。

| 案例 | 本次結果 |
| --- | --- |
| F-CC39：本機／公開附件身分 | PASS；版本、大小及 GitHub digest 與本機完整 SHA-256 一致 |
| I-CC39-IDENTITY：完整安裝、管理器、singleton／hooks | INVALID；當回合沒有 IAB 分頁、JavaScript 或 CDP 控制／讀取能力，無法取得必要證據 |
| I-CC39-UI：四頁、真實數據、移除項目與報告匯出 | 未執行；完整安裝身分未成立 |
| I-CC39-SETTINGS：六個開關、既有 false、香港候選與逐台覆寫 | 未執行；完整安裝身分未成立 |
| I-CC39-PLAY：靜音下基本播放及實際路線 | 未執行；工具不能先確認靜音與安裝身分 |

當回合只呼叫 Computer Use 的唯讀 list_windows()，未啟用、輸入、截圖或導航任何視窗。返回外部 Chrome 及 Codex 宿主兩個視窗；它不暴露 IAB 分頁或執行環境。已發現的視窗不作為替代瀏覽器，亦未透過系統或私有介面存取瀏覽器資料。工具目錄搜尋僅回傳不適用的外部／雲端能力，未安裝或使用。具體工具界線另見工具日誌。

未新增網路攔截、斷點、頁面訂閱、計時器或測試分頁，故無新增瀏覽器測試資源待清理；未宣稱前輪資源或目前網站狀態已核對。沒有啟動本機服務、切換前景、搶焦點或播放媒體；不要求使用者例外操作。沒有重跑既有自動測試、安全掃描或效用命令，歷史 3010 PASS 與效用 FAIL 保持其原執行日期，不補算本次安裝證據。

## 2026-10-31：六十分鐘驗證計畫執行結果

18:39（Asia/Taipei），依使用者明確批准的更新後驗證計畫開始。接受使用者已完成 v2.1.39 更新，驗收對象直接為已安裝版本；不再次下載、安排更新確認或要求重新安裝。基準 main cff1dff，開始前工作目錄乾淨。總上限六十分鐘，最後十分鐘保留清理及報告；本次在最小工具檢查後立即停止，未啟動瀏覽器測試窗口，沒有循環等待或追加輪次。

一次列舉當回合可呼叫工具後，只有通用 node_repl，以及僅開啟面板的 open_in_codex，沒有 IAB 瀏覽器／分頁讀取、互動、頁面 JavaScript 或 CDP 控制工具。面板工具的說明明確要求另用 browser 工具檢查或互動，不能由它取得完整安裝或功能證據。這是工具前提未成立，不是使用者未更新，也沒有證據判定產品失敗。

| 案例／範圍 | 結果 | 本次證據或未執行原因 |
| --- | --- | --- |
| CC39-60-TOOL：一次最小工具檢查 | INVALID | 無所需 IAB 讀取／操作能力，依計畫立即停止 |
| CC39-60-ID：版本、管理器、完整本體、singleton／hooks、原狀態 | 未執行 | 無法存取已安裝分頁的執行環境 |
| CC39-60-UI：四頁、真實資料、移除項目、鍵盤及生命週期 | 未執行 | 工具前提不成立 |
| CC39-60-DIAG：問題標記、清除、完整報告、匯出及複製 | 未執行 | 未接觸診斷或剪貼簿 |
| CC39-60-SETTINGS：六個真實開關及跨分頁同步 | 未執行 | 未操作任何設定，無法驗畫面至功能接線 |
| CC39-60-CDN：逐台／固定、限制、Native 及原線對照 | 未執行 | 未操作任何模式或限制 |
| CC39-60-PLAY：S1／S2、1／2 倍、提前重試開關八個六十秒窗口及操作 | 未執行 | 未啟動播放；無法事前確認靜音或取得連續證據 |
| CC39-60-HK：S1 三台依 03／05／01，各兩倍速的六個六十秒窗口 | 未執行 | 未發出測試請求或變更固定主機 |
| CC39-60-OGV：既定番劇一次自然換集 | 未執行 | 未導航或換集 |
| CC39-60-CLEAN：自有資源結束 | 無新增瀏覽器資源 | 無分頁、觀察器、訂閱、計時器、斷點、Blob、剪貼簿或設定變更；不補算產品生命週期清理通過 |

本輪未完成安裝版驗收。沒有重查公開附件、改用外部瀏覽器、建立服務、要求前景、搶焦點或播放聲音；產品、已發布檔及既有設定未改。既有 3010 自動 PASS、安全審查及提前重試效用 FAIL 保留原日期與範圍，未重跑、未算成本次通過。工具界線追加於工具日誌，當前工作狀態由 TODO 維護。

## 歷史驗證導覽

<a name="發布與安裝限制"></a>

v2.1.38 完整正文已追加至 [歷史全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2138-完整正文保存2026-10-31)。其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

舊 v2.1.8 錨點保留作歷史導覽；不描述本版結果。

## 2026-10-30：UP141 安裝版實測

此相容入口指向 [v2.1.38 完整實測](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)，原始 FAIL／INVALID 與未完成窗口保持。

## 隔離 B 分支原型驗證（2026-10-30）

原型與獨立 FAIL 見 [歷史原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。
