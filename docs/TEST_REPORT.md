# BiliCDN_TW v2.2.1 診斷撤除與保留功能驗證

日期：2026-11-01（Asia/Taipei）。基準為 6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb／v2.2.0。

## 變更

完整撤除診斷錄製、事故／請求／提前重試歷程、緩衝趨勢、報告產生／複製／匯出、診斷頁、剪貼簿授權與分頁原線對照。診斷專用評估與 IAB 收集／插樁／判定工具退出正式來源，固定提交可追溯原碼。

控制中心保留總覽、CDN、播放設定三頁；總覽數值、詳細狀態與單次刷新快照保留。正常選路、Native 開關、學習、量測、提前重試、停滯／備援恢復及整體停用保留。設定 schema 2、四鍵、Native 預設 true 及既有布林值不變，不遷移或清除使用者資料。

## 自動驗證

固定 Node 26.8.1 完整測試已通過 1,598 案，failed／cancelled／skipped／todo 均為 0。相較 v2.2.0 的 3,050 案，淨減少 1,452 案，來自撤銷診斷、緩衝評估、IAB 工具、剪貼簿與原線對照專用案例。混合案例直接驗證狀態及副作用；新增三個退役原碼追溯工具契約，另將舊混合案例的音訊禁止、XHR 單次送出／送出前限制重查、需求餘裕門檻恢復為三個獨立功能案例。三頁與移除操作的新契約先於來源修改執行並確認失敗，修改後通過。

型別、91 個正式模組的架構／循環檢查、完整測試及最終 verify 已通過；verify 包含格式、文件、封存、匯入純度、確定性建置、語法、移除標記與封裝校驗。封存核對 439 個搬移項目、56 份閱讀版；三份追加日誌保留原始前綴，v2.2.0 完整報告原文及五份 Release 原件保持。七個不可變舊斷鏈、434 個歷史網址限制、十八個私有引用未核對、外部網址未連網驗證分開記錄；未執行本機搬移或 local 模式。

## 安全審查結果

Codex Security 差異掃描 `4409e3da-7ffc-4ce3-baa0-74dc4a4aa090` 已完成並封存，範圍為 `6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb..5cc72ee9dede4dd91d3a0de1b1228f81758bbe8d`。149 個來源清單項目加 26 個其他變更路徑全部核對，包括基準中的刪除檔；零可回報發現、零未結候選。Native／Catalog 授權、恢復 token、重入與晚到提交、可信 UI、工具 Git／檔案邊界均完成審查。

掃描後只修正文案／metadata 說明、恢復兩個誤改的間接開發依賴版本文字，以及補回上述三個功能測試；正式 TypeScript 與掃描 head 相同，bundle 執行本體逐字一致。最終鎖檔相較基準僅產品版本改為 2.2.1。後續變更已人工核對並通過完整 verify。工作台統計為 21,828,144 tokens（含 20,986,496 cached input，輸出 66,876）；這是工具回傳的整合統計，不換算為計費金額。Daybreak 權限不可用，使用可用的標準靜態差異流程；安全審查不代替安裝實測。

## 發行產物

v2.2.1 腳本為 419,507 bytes，比 v2.2.0 的 507,211 bytes 減少 17.3%。SHA-256：`e89b94bb92eecb818ce038f09c1de2b9fb5db8b2ffa35adb2357141384db149d`。

此封裝時點已通過自動及安全驗證；公開推送與 latest 下載讀回將追加於現行報告，封裝快照不回寫。GitHub Release 只附唯一使用者腳本。

### 公開交付讀回（2026-11-01）

正式 [v2.2.1 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.1) 已發布並設為 latest，非草稿、非預發布。發行提交及標籤解參照均為 `1e4e70cccf13e0dea1346c1fbd89d44dad063ce1`；推送時遠端 main 同步至該提交，後續 main 僅追加交付紀錄。

公開 main 腳本、v2.2.1 標籤腳本與 latest 下載均獨立讀回：版本 2.2.1、419,507 bytes、SHA-256 `e89b94bb92eecb818ce038f09c1de2b9fb5db8b2ffa35adb2357141384db149d`，逐位元組等於本機封裝。Release API 確認附件只有 `BiliCDN_TW.user.js`，大小與 digest 同值。五份儲存庫封裝檔、建置輸入雜湊及 Git blob 均已核對；發布後不回寫封裝快照。

發布階段交付完成；當時未操作 IAB、未更新管理器安裝版，也未恢復已停止的播放或故障窗口。之後另獲授權的 R1 安裝驗收記錄於下文。

## 安裝與歷史判定

上述發布階段未啟動瀏覽器、安裝或播放窗口。使用者更新後另行授權的 v2.2.1 R1 安裝驗收見下節。一般播放與設定驗收依直接產品行為判定，不要求診斷工具或完整 Network 成功；特定問題缺少時序只限制該問題結論。

v2.2.0 全文與追加更正見 [歷史完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v220-完整正文保存2026-11-01)。原 INVALID 與操作錯誤不改 PASS，已通過的播放及設定不被工具失敗概括否定。既有未解問題、效用 FAIL 及停止決策由 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 維護。

## v2.2.1 R1 安裝驗收（2026-11-01）

使用者已更新內建瀏覽器腳本，並明確要求設定目標開始驗收。本輪基本安裝／操作與播放範圍 **PASS**，七項核心案例及清理全部通過；這不代表所有條件式恢復或效用已實測。

範圍先凍結為單一 IAB＋Tampermonkey 分頁、既有基準 BV1tFZZBQE57／p1、Auto 1／2 倍各一次完整 60 秒、三頁介面及必要設定操作。保守 T0=04:19:28（Asia/Taipei），總上限 30 分鐘、04:44:28 起只清理、04:49:28 硬截止；04:28:06 已完成清理。首次工具清單未同時取得主機單調值，後續 BASELINE 另存單調檢查點，不冒稱精確 T0。沒有要求前景、啟動本機網站服務、改畫質或增加故障窗口。

| 案例 | 預期與實際證據 | 結果 |
| --- | --- | --- |
| I01 安裝身分 | 實際 Tampermonkey 5.5.1／腳本 2.2.1；Runtime、ControlCenter 各一個實例；hookState=installed。完整 IIFE 執行本體 417,570 bytes／SHA-256 a78a15a782ec46a73fa36787431b14a349ccb54b1baf870ff022860508acafa4，大小及雜湊均與已發布腳本本體一致；管理器包裝與 metadata 另分，不誤稱整份包裝等於附件 | PASS |
| I02 三頁與總覽 | 實際開啟總覽、CDN、播放設定；沒有診斷、報告、原線對照入口。總覽可播放緩衝、安全吞吐、需求餘裕、影音回應及最近狀態存在；詳細狀態可展開，列出攔截、量測、恢復／備援、提前重試與路線資料 | PASS |
| I03 Native 保存 | 原值 false；可信 UI 切為 true，當前模型、勾選狀態及 GM 儲存皆 true；再以 UI 還原 false，三者一致。既有明確 false 維持，不以新版預設覆蓋使用者設定 | PASS |
| I04 播放設定保存 | 原提前重試 false；可信 UI 切為 true，勾選、模型及 GM 儲存皆 true，再還原 false。三頁均可正常切換；未執行清除學習或還原預設 | PASS |
| I05 Auto 1 倍 | 04:25:00.253–04:26:00.255，共 62 筆、60.0022 秒；媒體前進 60.001291 秒，增加 3,597 影格，音訊已解碼位元組增加 779,574；3840×2160，緩衝最低 28.07 秒 | PASS |
| I06 Auto 2 倍 | 04:26:25.286–04:27:25.289，共 62 筆、60.0035 秒；媒體前進 120.009266 秒，增加 7,193 影格，音訊已解碼位元組增加 1,319,336；3840×2160，緩衝最低 25.93 秒 | PASS |
| I07 還原與清理 | 設定記憶體與 GM 保存值逐欄等於原設定，僅正常保存時間戳更新；1 倍、paused=true、muted=true。讀取計時器自行截止並移除，Debugger 斷點／暫停解除、物件群組釋放，自有 IAB 分頁關閉後清單為空；無自有攔截、產品包裝或 Network 訂閱 | PASS |

兩個播放窗口均為同一媒體、無 paused／seeking／ended／error、所有樣本真正 muted=true；最大採樣間隔分別 1,002.9／1,003.3 ms，未觀察到連續兩秒無時間及影格進度。每秒以原生媒體讀值核對；靜音沒有取消音訊下載，音訊解碼量持續增加。1 倍掉幀增量為 0，2 倍為 769；掉幀如實保留為顯示／效能觀察，本輪沒有設定掉幀通過門檻，不據此推定 CDN 故障或宣稱零掉幀。

導覽後立即對真正媒體靜音並讀回，當時播放器尚為 paused；後續播放與清理保持靜音。這次沒有增加起播前靜音、預注入或先暫停腳本的必要門檻。Debugger 只在窗口前短暫取得身分，斷點移除後恢復並停用；暫停時間不計入播放窗。

工具限制另記：DOM／AX 快照未呈現封閉 Shadow DOM，使用同一 IAB 的受控 CDP 讀取既有節點，依實際可見控制項座標送出可信滑鼠輸入；沒有以直接命令呼叫代算 UI 通過。一次 28 秒等待受到工具約 20 秒外層截止，頁內有界讀取仍連續完成且自行清理；以原同一份完整資料核對上述最大間隔，沒有重跑或拼接窗口。Debugger 初始事件讀取曾截斷，已取得的完整腳本本體與實例證據各自核對；沒有把此工具事件缺口當一般播放失敗。

自然健康量測、提前重試接管、備援重載／位置倍速還原及實際目的地完整時序本輪未驗證；固定 CDN、禁止規則、整體停用、背景與跨分頁同步也沒有新增安裝版案例，沿用各自既有契約及限制。本輪不宣稱其實測通過，不恢復 P01／P02、BR-01 或舊效用窗口。原提前重試效用 FAIL 與未解問題不變。

原始去敏證據與畫面保存在本機 `.work/iab-testing/2026-11-01-v2.2.1-ff65595-r1/`。PLAYBACK-1X.json SHA-256 為 ca5eecd1da7ad21506279c6a46dc5c56a0409d79f671ff56887e62e16fe0d3ff；PLAYBACK-2X.json 為 38fd64f957e8a8716795954b49a51df8188928084f41429632c5a9053caf1cc7。公開文件只保存有界結果，不輸出簽名網址、憑證、IP 或播放器物件。

<a name="歷史驗證導覽"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#歷史驗證導覽)；現行內容以本頁正文為準。

<a name="公開交付與安裝結案"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#公開交付與安裝結案)；現行內容以本頁正文為準。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#隔離-b-分支原型驗證2026-10-30)；現行內容以本頁正文為準。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#bilicdn_tw-v218-release-verification--2026-10-04)；現行內容以本頁正文為準。

<a name="修復與根因"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#修復與根因)；現行內容以本頁正文為準。

<a name="來源隔離與實際安裝"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#來源隔離與實際安裝)；現行內容以本頁正文為準。

<a name="安全差異"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#安全差異)；現行內容以本頁正文為準。

<a name="發布與安裝限制"></a>

<a name="修後唯一-hk04-定向窗口"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#發布與安裝限制)；現行內容以本頁正文為準。

<a name="2026-10-30up141-安裝版實測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-30up141-安裝版實測)；現行內容以本頁正文為準。

<a name="2026-10-31更新後安裝核對"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31更新後安裝核對)；現行內容以本頁正文為準。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31六十分鐘驗證計畫執行結果)；現行內容以本頁正文為準。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31iab-可用但持續靜音前提受阻)；現行內容以本頁正文為準。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)；現行內容以本頁正文為準。

<a name="2026-10-31補測與單分頁重測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31補測與單分頁重測)；現行內容以本頁正文為準。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#2026-10-31一次授權的單分頁缺口補測)；現行內容以本頁正文為準。

<a name="v220-安裝驗收-r12026-11-01"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#v220-安裝驗收-r12026-11-01)；現行內容以本頁正文為準。

<a name="澄清後在原期限內續行"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#澄清後在原期限內續行)；現行內容以本頁正文為準。

<a name="auto-2-倍補充與本次驗收結案"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#auto-2-倍補充與本次驗收結案)；現行內容以本頁正文為準。

<a name="公開交付"></a>

此舊入口的原文及當時判定見 [固定歷史版本](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TEST_REPORT.md#公開交付)；現行內容以本頁正文為準。
