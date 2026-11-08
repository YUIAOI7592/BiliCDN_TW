# v2.2.13 黑畫面與無法起播調查（2026-11-08）

## 調查結論

**R3 黑畫面現象保留，根因尚不能確定為腳本、網站或網路。** 本次先稽核舊工具，再完成一次新的 B1 自然觀察，沒有修改產品、正式測試或設定，也沒有人工改寫／清除學習資料。新文件的完整 v2.2.13 本體吻合正式附件，在沒有起播前／窗口中 Debugger 暫停的情況下自然播放成功；這排除「這版在此環境必然無法播放」，不能回推 R3 當時沒有故障或已查明根因。

| 判定 | 具體依據 | 結論界線 |
| --- | --- | --- |
| 確認工具證據不足 | R3 沒有保存媒體 backendNode／document 身分及 prototype getter 對照；清理檔的 paused 在工具自己 pause 後讀取 | 不能把清理讀值當成清理前狀態；也不能反向認定所有零值都是工具製造，因為清理前輸出另有 readyState 0／進度 0 |
| 新方法可辨識真實播放 | B1 同一 document 2839、影片 backendNode 3028，直接與 prototype 讀值相符；從初始化 0 變為 readyState 4、3840×2160、持續前進，畫面有影像 | 是新文件的同節點校準，沒有回溯證明 R3 的元素／作用域相同 |
| status 0 不足以定因 | B1 保存的 105 筆 XHR 終止有 104 筆可信 load／206、1 筆可信 abort／0，沒有 native timeout 或受控 retry timeout | 該筆是原生中止，發起者未知；R3 的單筆摘要沒有終止種類，不能套用 B1 分類 |
| 未支持刷新必定直接取消的假設 | 真實 Fetch／XHR 適配器各一個私有反證：送出接受後刷新 authority，舊 206 仍交付完整 131,072 bytes，send 一次、abort 零 | 只反駁「來源刷新必定直接取消或丟本文」；不證明 R3 實際收到本文，也不排除其他時序問題 |
| 網路、網站、腳本三者尚無單獨定因證據 | R3 缺 loadingFailed、原生終止、本文及媒體初始化的完整配對；B1 未再現黑畫面，Network 早段截斷 | 不宣稱網路全程無誤、網站無錯或腳本完全無缺陷，不以正常重開取代因果對照 |

本次調查已結案；**未查明根因不等於產品通過，也不等於已證明產品故障**。原 R1／R2／R3 判定及限制保持，不重測選單、三頁、倍速、timeout 專項或熔斷窗口。後續若要修復，需先取得相應反例；本次沒有可據以直接修改產品的確定故障。

## 基準與證據索引

使用者明確建立新的調查目標，沒有延長 R3。凍結 main cff9597bb823fdd7fdb12cec21e3da37779470ff，產品仍為 v2.2.13；發行標籤對應 626432a800b42b56478676716f6f526209953543。正式本體 532,263 bytes，SHA-256 ab0c2b1ad1a80f3f9d042cad9f426fe3c7574d655629e194ee4f8f9d3affb706。開始時六份未提交 R3 文件保留，原始段落不回寫。

整體上限由 18:52:37 Asia/Taipei 起算四十五分鐘。離線分成工具、來源及網路三組交叉稽核，再做唯一 B1 分頁；IAB 階段上限二十分鐘、最後五分鐘保留清理。沒有本機網站服務、外部瀏覽器或前景要求。

私有根目錄為 `.work/investigations/2026-11-08-v2.2.13-black-screen/`：

| 位置 | 保存內容 |
| --- | --- |
| PLAN.md | 執行前範圍、硬期限、方法與清理 |
| tool-audit | R3 十四份輸入的雜湊／閱讀範圍、媒體與作用域稽核、B1 方法核對 |
| source-audit | 來源刷新到傳輸／恢復追查、兩個私有反證與四十五個實際打包輸入雜湊 |
| network-audit | status 0 分支、九個來源輸入雜湊、觀察器規格／VM 校準、B1 終止與 Network 配對分析 |
| live-B1 | 安裝身分、初始／窗內／晚讀媒體、105 筆終止、去敏 Network 子集、畫面及清理 |
| preserved-docs | 本次寫入調查結果前的六份 R3 文件副本 |
| FINAL_INTEGRITY.json | 最終文件檢查、來源／發行／原紀錄保護及私有檔案雜湊 |

原 R3 目錄 `.work/iab-testing/2026-11-08-v2.2.13-cff9597-R3/` 原樣保留。私有資料只含數字、枚舉、主機、去敏代碼與局部比較結果；不保存簽名 URL、路徑、query、Range 原文、Cookie、IP 或播放器／核心物件。URL＋Range 指紋只是本輪加鹽配對提示，不是授權或永久身分。

## 先排除工具誤判

R3 的 SCOPE_PROOF 只證明頁面與使用者腳本的 registry 可見性不同，沒有比較兩者的 document／video，因此不能推出「媒體必定讀錯」。其前置 350 列與正式窗口批次都是來源資料，不是三分鐘媒體採樣。CLEANUP 先 pause 再讀 paused，FINAL_INTEGRITY 又引用該摘要，不是獨立的清理前播放證據。

另一方面，R3 清理前的工具輸出確有正面積 VIDEO 的 readyState 0、currentTime 0、paused=true；黑畫面也有截圖。因此不能把現象一筆勾銷為清理造成。欠缺的是同節點、同時點的媒體身分與終止資料。

播放器適配器 `PlayerAdapter.currentTime()` 在原生 readyState 0 時優先取原生 currentTime；SDK／網站可能仍保有舊尋位位置。故「網站顯示 54:34、原生讀 0」不矛盾，也不證明已解碼播放。後續沒有額外呼叫會更新媒體快取或操作所有權的 snapshot／controls 等產品方法。

B1 使用 DOM.describeNode／resolveNode，對同一實體節點比較直接屬性與 HTMLMediaElement／HTMLVideoElement prototype getter，讀後即釋放遠端引用：

| 時點 | 實體身分 | 媒體讀值 | 用途 |
| --- | --- | --- | --- |
| 導覽後約 1.26 秒 | document 2839／video 3028 | readyState 0、time 0、paused=true、0×0、muted=true、error=null | 正常初始化讀值，不能只憑此判無法起播 |
| 窗內約 108.84 秒 | 同 document／backendNode；frontend nodeId 已變 | readyState 4、time 3372.024365、paused=false、3840×2160、muted=true、error=null | 與當時網站約 56:13 一致，證明新文件自然播放 |
| 窗口後約 375.51 秒 | 同 document／backendNode | readyState 4、time 3638.698466、paused=false、尺寸不變 | 晚讀 follow-up，只作其後仍能播放的旁證，不回填原窗口或起播耗時 |

各次直接與 prototype 值一致、own-property overrides 為空，畫面可見實際影像。這支持目前主頁讀取指向真實活動媒體；**沒有完成使用者腳本詞法作用域的同 backendNode 比較，也沒有證明 prototype getter 未被其他程式包裝**。不把這兩個未測項隱藏為完整跨作用域校準，不據此替 R3 改判。

本輪沒有發送 Debugger.pause，也沒有身分暫停；完整腳本在窗口後由 getScriptSource 核對，包含與本機正式本體完全相同的全部文字，包裝前綴一行。管理器為 Tampermonkey 5.5.1、腳本 2.2.13。沒有操作正常播放按鈕、尋位、切畫質或修改設定；網站自然恢復保存位置，不把影片標題的 240 幀宣稱為實際 FPS。

## 終止分類與網路證據

XHR `noteHeaders()` 以 readyState≥2 記錄回應時間；失敗直接進 DONE(4) 也可能進入此路徑。settle 之後可能把 status 0 記到最後摘要，所以 `responseObserved=true` 不等於收到合法 HTTP headers。`nativeCalled=true` 又是在原生 send 呼叫前設立，不能獨自證明接受送出。對應實作位於 `src-v2/adapters/xhr-hook.ts:343`、`src-v2/adapters/transport-context.ts:269` 及 `src-v2/adapters/xhr-request.ts:48`。

status 0 本身不能區分 error、abort、timeout 或某些 Fetch 無 HTTP 回應情況；應使用可信原生終止及 Network 結果。標準依據為 [XHR status 定義](https://xhr.spec.whatwg.org/#the-status-attribute)，瀏覽器失敗欄位見 [CDP loadingFailed](https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-loadingFailed)。R3 沒有這些逐請求資料，已無法由最後一筆摘要重建完整原因。

B1 在既有 XHR settle 局部值、分類完成後使用不暫停觀察點，只複製當時已有的資料；沒有包裝 Fetch／XHR、呼叫產品判斷方法或寫入 GM。來源以單調時鐘自動停止，105 列均在外層 180 秒截止前，產品分類為 video 52／audio 53，其中成功 104、中止 1，errors／overflow 皆零。所有終止事件 trusted=true；沒有 failure、nativeTimeout 或 controlledTimeout。

唯一 status 0 是影片 mirroralib 的可信 abort，bytes 0、耗時約 15.2 ms、終止時 timeout 10,000 ms。它只證原生中止，**不能區分網站、腳本哪個既有分支或其他原生取消的發起者**；timeoutAtSettle 也不是入口／送出原值保持的配對證明。其餘 104 筆為 load／206，證明這次有大量成功影音交付，不將短成功一律算作合格速度／觀察信用。

Network 在導覽前啟用，但第一份批次的取回時間為窗口開始後約 74.95 秒，早段 buffer 已截斷。保存後才推進游標仍不能挽回已遺失事件；**不公布完整請求分母，不宣稱全程沒有網路錯誤**。窗內只保存八筆請求／二十三列，八個指紋可唯一配對到 WIRE、主機相符，七筆有完整 Network 終止；另一筆缺 finished，不算完整配對。第二批十二筆請求全在窗口後，獨立列為 follow-up。MIME 曾將四筆實際音訊推測為影片，以產品 context.kind 校正；中止那筆沒有 Network 配對，發起者仍未知。

外層窗口為 19:06:58.872–19:09:58.872 Asia/Taipei；工具來源第一筆於稍後約 1.286 秒建立自己的 180 秒截止，停止回呼較該截止晚約 1.7 ms。已逐列以外層截止重新篩選，最後一筆在外層截止前 49 ms，沒有把較晚可接納區間算進窗口。結果於窗口後才取回，取回時間與晚讀媒體另列，不宣稱精確三分鐘連續播放、起播延遲或固定十秒落地。

## 來源刷新與腳本控制路徑

逐段追到 PlayurlController／SignedRouteVault、RouteCoordinator 及 Fetch／XHR 適配器：可信集合變更撤銷舊 handles、aliases 與輸出角色，旋轉 authority；舊結果不得因此取得健康、確認表示、親和、重試或熔斷降級信用。這些是控制隔離，不是網站已接受傳輸的 abort 命令。

兩個私有真元件案例只以原生 API 窄替身產生 206，走正常 send、刷新及終止：Fetch／XHR 各 send 一次，authority 1→2、同 epoch，abort／recovery 事件均零；網站仍得到逐 byte 相同的 128 KiB，XHR 一次 load。舊健康樣本零符合現行授權契約，外部 GM／Fetch／XHR 呼叫零。未實例化 RecoveryController／SDK；recovery 零指 Routes 事件零，不能單獨證明所有間接重載交錯。這不是實機故障注入，也沒有重跑或增加正式 2,261 案。

仍有需要保留的機制假設：若同一批結果每次都在 authority 旋轉後完成，可能得不到學習／表示確認信用。但 R3 的 11 筆可信 API 接納、240 筆集合變更只是來源事件，缺送出 authority、終止、保存資格與播放前後的配對，**未證實發生信用飢餓，更未證實它造成無法起播**。也沒有證據支持為了畫面而放寬舊授權。

## 原因分類與下一步

| 分類 | 已知 | 尚缺的因果證據 |
| --- | --- | --- |
| 驗收工具 | R3 作用域讀取曾錯；清理 paused 不可前推；起播前短暫身分暫停確曾發生；B1 無暫停可正常播放 | R3 暫停起迄與網站看門狗／取消／失敗的配對，不能只憑 B1 正常就歸因暫停 |
| 腳本 | 已查路徑及兩個受控案例未見刷新取消已接受傳輸；舊信用拒絕機制存在；B1 正式本體正常交付／播放 | R3 是否有本地拒絕、反覆重載、信用飢餓或錯誤改寫先於黑畫面 |
| 網站 | API 200 接納與媒體播放是不同階段；保存位置不能證解碼；B1 自然恢復位置可播放 | R3 的 MSE append／媒體重建／原生取消發起者及當時網站狀態 |
| 網路 | B1 有可信 206 交付，唯一保存的 status 0 是 abort | R3 DNS／連線／CORS／timeout 或 HTTP 失敗的逐請求原生證據；B1 缺早段 Network，不能替它排除 |

最值得先修正的是**調查方法的起播干擾與事件保存缺口**，尚無依據指定產品修補。若使用者另授權下一次重現，先在導覽前準備短且已校準的非暫停觀察，持續及時排空；同一時點配對實體媒體、原生終止、改寫目標與來源 authority。只在失敗實際重現後，才依分支安排最小對照；不先清學習、改 timeout、關腳本或反覆刷新。若需暫存共享設定，另說明具體對照再取得授權。

## 清理與交付邊界

先保存清理前正常媒體，再對同一 backendNode 真正靜音並 pause，讀回 muted／paused=true；該值只證清理。自有觀察器的頁面 alias 與使用者腳本 registry 都刪除、timer 清除、條件斷點解除、DOM／Runtime 物件群組釋放，Network／Debugger／DOM／Runtime 關閉，唯一自有 IAB 分頁關閉並核對為零。

工具設定寫入、清除學習、回灌與人工恢復均零；正常播放可產生合法學習，因此不以整份 GM 雜湊不變作保留標準。沒有讀出播放器／核心物件。受控反證只用隔離記憶體，正式產品／測試／設定／版本與 Release 不變。本次僅保存本機研究與文件，不提交推送、升版或發布。文件、封存、差異及完整性檢查結果另由最終紀錄確認；不冒稱新增完整產品回歸或安裝版全部通過。

結案文件核對：docs:check、archive:check、git diff --check 已實際通過。首輪 docs:check 因新歷史紀錄未登記保護基準而拒絕；只新增本報告的初始 prefix 雜湊，未更改既有保護。完整性初稿以 raw bytes 比對歷史文字時遇到既有三個 CRLF 差異；獨立確認 LF 正規化全文相同後，依既有文字保護語意修正私有 oracle，發行產物仍逐原始 bytes 比較。首次失敗及最後逐項結果保存私有目錄，未藉修改歷史內容通過。

## 使用者人工播放與判讀更正

使用者隨後回報自己在 Codex 瀏覽器點擊即可播放，並提供有實際影像的截圖。這是使用者人工操作回報與畫面證據，不冒稱代理另做一次操作或連續播放量測；它與本輪 B1 已確認可播放的結果一致。沒有因此接管或關閉使用者目前分頁，也沒有啟動新驗收窗口。

**撤回「R3 已確認無法起播」的表述。** R3 只記錄到當時未播放的狀態與黑畫面，沒有驗證正常點擊播放後仍失敗，也未排除自動起播／操作前提。把「尚未起播」推論成「無法起播」是驗收判讀錯誤，責任在代理；不能把尚未完成的播放操作或證據當成網站、網路或產品故障。

本紀錄標題沿用當時待查問題名稱，不表示該缺陷已成立。現行判定是：**v2.2.13 已有可播放證據；R3 未建立播放失敗案例，因此不登記為已確認的播放缺陷。** 當時零值、黑畫面與工具限制原文保留，狀態形成原因沒有被識別；這不構成後續修補或自動續測的依據。所有新入口應連到此更正，而非沿用「無法起播」作既定事實。
