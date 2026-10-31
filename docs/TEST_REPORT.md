# BiliCDN_TW v2.2.0 結構精簡與行為契約驗證

日期：2026-11-01（Asia/Taipei）。基準為 v2.1.40／1edfeaa6ad7a6b9dabc7d81da3b4414c3a31ba78。使用者批准完整重構、Native 新預設及正式 v2.2.0 交付；本次不恢復已停止瀏覽器案例。

## 變更與結構證據

| 項目 | 基準 | v2.2.0 |
| --- | --- | --- |
| 模型／介面契約檔 | 40 | 27；同功能共置，消費端直接匯入契約 |
| scripts 頂層檔案 | 31 | 6；其餘分為 checks／testing／evaluation／iab／lib |
| 數字情境分派套件 | 13 | 0；具名建立函式與每案獨立狀態 |
| CDN 初次頁面完整模型讀取 | 18 | 1；刷新亦共用當次模型，命令完成重讀 |
| 產品規則正文 | PROJECT_CONTEXT＋ARCHITECTURE | ARCHITECTURE 六部分；舊產品錨點只導引 |

契約檔盤點包含 model、port／ports 及 contracts；ControlReadModel 的執行實作不列為純契約。SettingsStore 單一布林預設表使新安裝、缺值、非法欄位及還原預設啟用 Native；既有 true／false 保留，schema 2、四鍵及讀取不寫入維持。Catalog-only 回歸顯式關閉 Native。

設定抑制／保存、逐欄失效比較、同步路線解析／組裝、恢復階段與 SDK 派送簡化；原單一所有者、等待後授權、取消、同步重入、晚到工作、恢復期限與額度保持。詳細契約見 [ARCHITECTURE](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/ARCHITECTURE.md)，專項評估操作見 [評估指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/README.md)。

## 自動驗證

固定 Node 26.8.1／npm 11.19.0 的完整 `npm run verify` 通過，3,050 個契約案例全部成功，failure／cancelled／skipped／todo 均為 0。其中工具套件 603 案、架構規則 41 案；另已通過獨立型別檢查、104 個正式模組的分層及無循環核對、匯入純度、確定性建置、語法、v2-only bundle 與校驗碼。

新預設、設定鎖等待／失敗／遠端更新、逐欄失效及單次 UI 快照均有具名案例。相同明確設定的選路、額度、事件順序、過期授權、同步重入、取消及晚到工作沿用原契約。13 份套件的 116 個測試宣告及其參數展開保持，唯一名稱變更是 Native 缺值案例由 default off 改為 default on；共用情境刪除與當案無關的前置設定與輸出，仍以 testScope 管理資源。

文件及封存檢查通過；保留七個不可變舊斷鏈、431 個歷史原網址限制與十八個未核對私有引用，外部 URL 未連網驗證。沒有本機私有搬移，不執行 `--local`；這些既有範圍限制不列為新通過項目。

## 安全差異

Codex Security 安全差異掃描 `e098a1e8-c94e-4dbc-a3db-d8ce98dfcfba` 已完成，範圍為 `1edfeaa6ad7a6b9dabc7d81da3b4414c3a31ba78..25a446c4ad05aef5344b9999e06e6cc5d3669fd0`；214 個變更清單項目核對完成，零可回報發現、零未結候選。選路、傳輸及恢復十五份關鍵檔案另有完整獨立審查。來源、授權、重入、取消、晚到工作、去敏及本機工具邊界依保留的威脅模型核對；這不是瀏覽器實測或「沒有任何漏洞」的保證。

掃描完成後正式 `src-v2/` 與掃描 head 相同；另修正三處評估工具搬移後的字串路徑，沒有改變授權或傳輸邏輯。八個上游雜湊輸入讀取及收集器離線建置通過，沒有執行收集器或啟動服務；最後完整 verify 再次通過。工作台保存封存結果與報告；其 rollout 用量為總計 16,289,220 tokens（含 15,619,328 cached input，輸出 59,747），此為工具彙整的六個執行緒用量，不另推算單次掃描淨用量。

## 公開交付

2026-11-01 02:23（Asia/Taipei）已發布正式 [v2.2.0 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.0)，不是 draft 或 prerelease，且為公開 latest。發布提交為 `49345bad6cdb9e49e7cf1420288e926d0ace11be`；遠端 main 與標籤解參照均核對至該提交，後續 main 僅追加本次交付紀錄。

| 核對來源 | 腳本版本 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| 本機封裝、遠端 main 原始檔、v2.2.0 標籤原始檔及公開 latest 實際下載 | 2.2.0 | 507,211 bytes | `abca87caeb995fb924f5869c8fd60accdfe250994b448607e22803a38a610a1f` |

四份腳本逐一下載／讀取後核對一致；Release 唯一附件為 `BiliCDN_TW.user.js`，GitHub 回傳的附件 digest 亦相同。[既有 latest 更新入口](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) 保持不變。Release 中的報告保留發布前檢查點，五份封裝原件已登記雜湊保護，不回寫。這些公開交付結果不代表 Tampermonkey 已安裝新版。

## 瀏覽器與既有證據限制

發布時未執行 IAB 來源隔離、Tampermonkey 實際安裝或播放驗收；2026-11-01 使用者另行授權後的校準結果見下節，不能以 Node 契約或工具能力代算產品通過。舊窗口不因新授權的一次有界驗收而恢復。

v2.1.40 的香港影片供片與自然恢復證據不足、N05 取消來源及網站清空根因未確認、提前重試原效用 FAIL 等結論完整保留於 [上一版完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。這次結構與預設變更不解決或抹除那些缺口，後續執行界線只看 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## v2.2.0 安裝驗收 R1（2026-11-01）

使用者表示內建瀏覽器已更新到 v2.2.0，明確要求設立目標並開始驗收。基準 HEAD 為 d84821b7a8652f37e96cbd14e2da6269f4d7b2ab，本機發行腳本雜湊與上列公開交付一致；安裝本體尚未取得，不能把使用者回報當成工具核實。

本輪先凍結 I220-01 身分、I220-02 設定／控制中心、I220-03／04 Auto 1／2 倍各 60 秒及 I220-05 清理，限同時一個自有 IAB 分頁。保守 T0=02:32:45、校準上限 02:40:45、清理保留起點 02:57:45、硬截止 03:02:45（Asia/Taipei）。未保存單調起點，因此不提出精確執行耗時；本輪沒有產品計時窗口。

| 案例 | 層級 | 結果 | 實際證據與限制 |
| --- | --- | --- | --- |
| E220-READ | E | PASS | 無媒體文字頁上的 Runtime.evaluate 回傳 ready=complete、mediaCount=0 |
| E220-MUTE | E | PASS | 無來源合成 video 的真正 muted=true、paused=true；未替換 getter，不能代算新影片文件的靜音 |
| E220-NAV | E | INVALID | 預先注入 API 不支援；設置執行前斷點後的首次影片導覽沒有暫停事件，回報分頁不再屬於當前工作階段；已關閉，未取得新文件媒體或聲音輸出證據 |
| E220-PAUSED-EVAL | E | INVALID | 後續無媒體頁可取得 instrumentation 暫停，但 Debugger.evaluateOnCallFrame 及替代校準的 Debugger.setSkipAllPauses 逾時；這是助手所選方法的限制，不是使用者要求的必要靜音門檻 |
| I220-01 | I | 未執行 | 助手誤設起播前靜音門檻而未進行；未取得 GM_info、完整安裝本體、唯一 Runtime／ControlCenter 或 hooks |
| I220-02 | I | 未執行 | 未讀寫正式設定或操作控制中心，Native 保留與刷新只維持既有 Node 證據 |
| I220-03／I220-04 | I | 未執行 | 固定影片 Auto 1／2 倍窗口均未開始，沒有 video／audio Network 計分資料 |
| I220-05 | I | PASS | 僅對實際建立的校準資源：靜音守護停止、合成媒體／標記移除、Debugger 解除、唯一分頁關閉，最終清單空 |

初次游標為 69，未收到預期事件；新校準頁的同一游標 38→39→40 分別收到 scriptParsed 與晚到 paused，truncated=false、hasMore=false。替代校準最後游標 49；這些是 debugger 能力證據，不是產品 Network 連續性。Page.addScriptToEvaluateOnNewDocument 與 raw Page.navigate 明確回報不支援；後者按工具指示改用 tab.goto，沒有更換瀏覽器或繞過安全拒絕。暫停的解除成功，正常執行時的真正靜音成功。助手當時將「新頁起播前可可靠完成」當作必要條件，這個額外條件已由下列使用者澄清更正。

02:39:25 前完成清理讀回：guardStopped=true、media=[]、Debugger.disable 成功，IAB 分頁清單空。沒有修改正式設定、倍速、播放器 getter、帳戶／瀏覽器設定，沒有故障攔截或受控學習樣本；沒有要求前景、啟動本機服務、另開外部瀏覽器或追加產品窗口。第一次失效導覽缺少媒體讀回，不能宣稱已完成無聲播放驗證。

**本輪核心安裝驗收未完成，沒有確認產品缺陷。** 只完成環境校準中可獨立證明的項目與清理。原始有界摘要保存在本機 `.work/iab-testing/2026-11-01-v2.2.0-d84821b-r1/` 的 BASELINE、CASES、TIMELINE、CLEANUP、CHECKPOINT、RERUN 與 REPORT；不包含簽名網址、憑證或播放器物件。

### 靜音要求更正

2026-11-01 使用者再次指出，只要求靜音，沒有要求起播前已靜音。[2026-10-31 19:05 原紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時) 已明確記載「起播後立即靜音」，並成功用真正 HTMLMediaElement.muted 屬性操作及讀回。助手卻沿用較舊的「導覽前先確認」摘要，再自行增加預注入／執行前暫停門檻，錯把所選方法受限推論為安裝驗收必然受阻。

撤回這個額外門檻及據此要求新工具能力／重複批准的結論；正確做法是導覽／起播後立即靜音並讀回，後續維持靜音，最初未確認區間不算計分窗口。工具逾時、清理與未執行結果保留，不因此改判 PASS；本次更正沒有執行新的瀏覽器窗口，也不重開原 [範圍與期限](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md#v220-安裝版驗收範圍)。

## 歷史驗證導覽

[v2.1.40 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01) 保留全部原始觀察與停止決策；其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="bilicdn_tw-v2140-固定-cdn-備援恢復修復驗證"></a>

[BiliCDN_TW v2.1.40 固定 CDN 備援恢復修復驗證：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="修復與根因"></a>

[修復與根因：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="來源隔離與實際安裝"></a>

[來源隔離與實際安裝：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="公開交付與安裝結案"></a>

[公開交付與安裝結案：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="修後唯一-hk04-定向窗口"></a>

[修後唯一 HK04 定向窗口：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="發布與安裝限制"></a>

舊發布／安裝限制依版本保留，請由 [版本索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md#版本) 查原文；現行版公開交付見上文。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[v2.1.8 完整發行驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-發行驗證--2026-10-04)。

<a name="2026-10-31更新後安裝核對"></a>

[v2.1.39 更新後安裝核對原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[v2.1.39 六十分鐘驗證原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[v2.1.39 靜音前提檢查點原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[v2.1.39 更正後靜音操作與工具超時原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[v2.1.39 單分頁重測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[v2.1.39 一次授權補測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="2026-10-30up141-安裝版實測"></a>

[v2.1.38 UP141 安裝版實測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[隔離 B 分支原型原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。以上相容錨點只提供歷史導引，不表示本版測試結果。
