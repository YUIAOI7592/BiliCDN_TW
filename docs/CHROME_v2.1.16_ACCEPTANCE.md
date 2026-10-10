# v2.1.16 Chrome／Tampermonkey 安裝驗收 — 2026-10-10

本文件記錄 BR-08 發布後的 BR-01 剩餘實際安裝矩陣。**Chrome 已核對並實際執行 v2.1.16：Auto 1／2 倍、wrapper／inner 四種拖曳保護與釋放，以及正常播放、暫停／恢復、短 seek、約 12 秒 video-only 延遲後的進度恢復取得有效證據。完整 BR-01 仍未結案。** [修復及來源隔離](BR08_FIX_REPORT.md)、[最新版驗證](TEST_REPORT.md)、[原 BR-08 失敗](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 分列。Node 637 與 Chrome 自有 iframe 31 有效案例不能替代安裝版。

## 身分與執行邊界

- 基準 v2.1.15／f0c2d39；v2.1.16 於 2026-10-10T13:05:38Z 正式發布，發行提交／peeled tag ff0cb07063032aeb49a9e52ccc630685bec46cf8、標籤物件 0dc8c0590ad3a63282c029fdc0d2e3ab56c1bbbe；唯一腳本 320,794 bytes，SHA-256 5eaeb8444503886244b06f81cb24a81081720a0ea5dcb978c284c776eb05e8d4，13:06:11.073Z 公開 latest 無登入讀回匹配。
- 13:07:51.193Z 更新前的完整 body 比對 v2.1.15=true／v2.1.16=false，installed/update-prerequisite.json 保留，不列新版通過。使用者完成更新後，**13:11:07.331Z** 完整 body216Match=true、body215Match=false、沒有截斷，ControlCenter／Runtime 各 1；實際 Fetch／XHR hooks、Runtime 共用 Player／Session／Routes／Measurement／Recovery 與 ID 來源核對一致，保存 identity-v2.1.16.json。後續同片刷新重新核對，沒有沿用舊 remote object。
- 網站只用 [指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 1／2 倍分開；不切片、不強制畫質、不改 Chrome 設定或停用其他腳本。
- 新證據 .work/functional-fixes/br08/2026-10-10-f0c2d39/installed/；每次連線／刷新重新取得完整 body／singleton／hooks，不沿用舊 remote object。
- 來源隔離合成媒體／時鐘只在自有 iframe。安裝版不得替換網站媒體 getter／控制器、重設 gate 預算或強制維持播放。

## 安裝矩陣與判定

| 場景 | 1 倍 | 2 倍 | 必要有效證據 |
| --- | --- | --- | --- |
| 完整產物／body／singleton／hooks | 通過 | 通過 | 完整已載入 body 匹配、singleton 1、實際共用 hooks／控制器 |
| BR-08 wrapper／inner 按住 | 拖曳保護／釋放通過 | 拖曳保護／釋放通過 | 四窗均按住超過 32 秒，dragging=true，無新增備援／核心重載；一般釋放後精確期限與位置還原仍待合資格窗口 |
| 正常 Auto／12 秒 video-only | 通過 | 通過 | 可信播放／暫停恢復／短 seek；精確 video 攔截約 12 秒，audio 通行，恢復時間／影格進度、沒有核心重載或強制畫質 |
| 完整 15／30／重載後 15 秒 | 前提未成立 | 前提未成立 | 網站在約 19～20 秒 paused／外部換核心，不能拼接成完整期限通過 |
| 新操作／晚到 SDK | 部分觀察；待完整窗口 | 部分觀察；待完整窗口 | 正常鍵盤 seek／拖曳／pause／rate 已觀察；實際 reload token、晚到完成／拒絕、位置 0 還原仍待驗收 |
| 真正背景／返回 | 工具阻塞 | 工具阻塞 | 本輪原生 hidden=false；工具不能取得真正背景窗口，不能用網站覆寫的 visibilityState 代替 |
| 生命週期／政策／影音隔離 | 部分觀察；待完整窗口 | 部分觀察；待完整窗口 | 同片外部核心替換未見腳本重載；原線對照控制 false→true→false 精確復原。帶有效 token 的政策／生命週期撤銷與 audio fallback 隔離仍待驗收 |
| 傳輸／內容交叉 | BR-02 原生子集通過；其餘待 | BR-02 原生子集通過；其餘待 | 新版 hooks 與原生 Blob 共 33 對相容，與倍速無關只計一次；自然 Auto 表示變化保持 epoch，但非完整 cid 重排證據；真 gate 因顯式 timeout 而 skipped |

每種前提／倍速先執行一個完整窗口，只有新增必要前提才重跑。提前 pause／error／換核心只能證明撤銷，截斷／丟失不能計完整時序。沒有真正 hidden 不重複已知前景操作；沒有真 gate 不改網站 timeout／重建控制器。禁止注入不同 cid 製造換片。

## 四個長按窗口

每窗先量取當時 wrapper／inner 矩形並確認 elementFromPoint 命中，再以可信指標建立故障中手勢。初始均 Auto、指定倍速、nonpaused／seeking、零可播放緩衝、沒有 mediaError／ended、generation 1／epoch 0／media 1、原生 hidden=false／Runtime visible=true。網站後續約 0.5 秒的目標調整沒有新影格，不當作播放進度。

| 窗口及私有檔案 | 主連續 pump | 主採樣／批次／事件 | 首次 paused／core 2→3 的採樣區間 | 結果 |
| --- | --- | --- | --- | --- |
| Auto 1 wrapper：auto1-wrapper-valid.json | 32.212 秒 | 129／196／132 | 19.832～20.082 秒 | 全採樣 dragging=true；無新增 route／core action，reloadCount=0；釋放 false |
| Auto 2 inner：auto2-inner-valid.json | 32.116 秒 | 128／194／133 | 18.926～19.178 秒 | 同上 |
| Auto 2 wrapper：auto2-wrapper-valid.json | 32.116 秒 | 129／194／144 | 18.582～18.833 秒 | 同上；開始時既有 recovered 不是本窗新動作 |
| Auto 1 inner：auto1-inner-valid.json | 32.158 秒 | 129／199／133 | 19.793～20.046 秒 | 同上；32.169 秒即結束長按並連續收束 |

四窗主 pump 批次沒有 truncated／hasMore、observer 沒有 dropped／fault，最大主批間隔 236～239 ms。前三窗手勢實際維持更久，但 32 秒後各有 42.877／42.075／50.383 秒 Network 讀取空檔，**不宣稱整段 74～82 秒持續處理網路**。後續 drain 沒有截斷，不能補算連續性。Auto 1 inner 全份最大批間隔 420 ms，沒有同類空檔。未保存逐批 afterSequence 的限制保留，僅核對已保存序號唯一有序、cursor 非遞減與事件數總和。

網站先 paused／核心失去初始化後仍保持 dragging，證明手勢沒有因媒體事件被提早清掉；不能證明後續合資格 tick 已按最新位置重開 15／30 秒，也不能以 currentTime 與控制快照同步讀值的差異判定位置回寫缺陷。本輪沒有由四窗確認新的功能缺陷。

## 正常 Auto 與約 12 秒延遲

normal-auto1.json／normal-auto2.json 保存可信播放、暫停、恢復及短尋位。兩倍速均取得 nonpaused／nonseeking 的時間與影格增量，沒有核心重載。Auto 顯示從 4K 變為 720p／1080p60 屬正常 ABR，未鎖畫質；短 seek 期間的普通 route-failure／播放意圖不被抹去或宣稱完全沒有意圖。2 倍 BODY Right 的 seekRevision 2→3／userRevision 1→2 保存於 auto2-delay12-final.json，只算該正常輸入修訂對照，不替代故障中完整新期限。

| 受控窗口 | 實際 video hold | 連續尾段 | 進度／核心結果 |
| --- | --- | --- | --- |
| auto2-delay12.json | 12.129 秒，5 個當前 video 請求 | 放行後 15 秒，合計 27.273 秒 | 1247.024271→1249.932875 秒、12591→12879 影格；readyState 4、core 2、reloadCount 0；後續獨立觀察 recovered |
| auto1-delay12.json | 12.215 秒，5 個當前 video 請求 | 放行後 20 秒，合計 32.445 秒 | 2347.898058→2361.768725 秒、24540→25439 影格；nonpaused／nonseeking、readyState 4、watchdog healthy、recovered、core 2、reloadCount 0 |

兩窗主連續窗口精確攔截 video，audio 正常成功且沒有被 hold；Fetch／Network 單一游標、主窗批次未截斷，沒有 pump errors。上述 hold 是整個窗口的實測時間，不代表每筆請求各自被延後 12 秒；fault 啟用較 seek 早約 0.8 秒，fault 啟用至關閉約 13 秒。各 5 個受控請求皆原生 abort 結束（放行時 4 個已結束，另 1 個繼續後取消），保持網站取消語意，不改算 CDN 故障。音訊於故障期間成功分別 2／3 次。

真正時間與新影格進度首次出現於 1 倍 19.307 秒、2 倍 26.180 秒；兩窗各有一次符合政策的影片備援，分別在 15.041／15.913 秒，沒有核心重載，不能說完全沒有救援動作。Auto 2 的首次尾段進度剛恢復時意圖尚在，auto2-delay12-final.json 的後續 6 秒觀察才取得 recovered；中間 **73.179 秒** Network 空檔後的首批 **truncated=true**，該後段只算獨立媒體／observer 狀態，**不算連續完整 Network 窗口**。這是受控送出前網路延遲，沒有修改網站 XHR timeout、媒體 getter 或控制器，不宣稱自然 CDN 故障重現。

## 新版實際 XHR 的原生交叉對照

使用實際 v2.1.16 XHR hooks 與其 metadata，對照自有 about:blank iframe 中原生 open／send／abort 的 NativeXhr；成功 send 只讀兩個自有 JSON Blob，不外送 URL、不修改網站 prototype。**33／33 對通過**（66 次 installed／native 執行、588 個完整事件），涵蓋 OPENED／sent／DONE 的 failed open、三類 validation 例外、Window 同步限制對照、終止事件內 failed／successful reopen、同步 OPENED 回呼 send／abort／reopen、default／text／json getters 及轉換拋錯的原物件身分。四種輸入轉換未計次，不宣稱一次轉換／順序的現場驗證。

xhr-cross-regression-first.json 原始結果 32 對有效通過，唯一差異是測試期待錯誤：尚未 send 的 OPENED 在同步回呼 abort 後，原生與腳本都保持 OPENED、仍可 send；nativeParity=true。校準私有期待後再跑 xhr-cross-regression-final.json，33 對與原生狀態、例外、事件及 getter 全一致，117 ms，沒有 timeout／truncated。未修改正式來源，原紀錄保留；另一代理唯讀分析於 xhr-cross-analysis.md。

這只完成 BR-02 的原生所有權／相容子集，**不涵蓋** Catalog／HTTPDNS 虛擬 DONE、媒體路線送出歸因、真正 singleton pending gate BR-04／05 或 playurl cid／epoch 的 BR-03 矩陣。Blob、請求、監聽器、計時器及對照 iframe 全部清理（2 Blob revoke、其餘計數 0、frame disconnected）。

## 觀察與清理契約

精確攔截在故障前安裝，限定當前 video、audio 通行。每窗口新單一 Fetch／Network 游標，持續處理至 hasMore=false，保存 truncated／dropped。受控 transport／startup／challenge ID 的學習抑制保留至晚到提交收束，不能只過濾 transport；清理核對記憶體／持久零匹配，不清除既有學習。

SDK 回傳控制明列受控邊界；保存完整方法描述子，還原僅限仍由工具持有的 wrapper，繼承方法刪除自有遮蔽。最後核對 held=0、patterns 空、自有 observer／API／iframe／timer／listener清除；歷史事件缺口不補算完成。來源隔離的清理不代替此處安裝版清理。

四個拖曳窗確認受控 transport IDs 分別 24／24／24／12，記憶體及持久樣本零匹配、unclassified 0。前三窗各 24 個受控 start／completion 可對帳；Auto 1 inner 在釋放前保存 observer，12 start 中只捕捉 11 個腳本 completion，最後一筆另有精確 Network canceled／ERR_ABORTED 及 held=0 的收束，**不補造第 12 個 transport 事件**。音訊成功分別 7／8／7／4，audio held=0。startup／challenge 受控 work 均為 0，不能以過濾器存在或零匹配宣稱真 gate 樣本隔離已驗收。

約 12 秒兩窗各確認 5 個受控 transport IDs，最後累積 10；主窗保存時 memory／persisted matches 0、unclassified 0、observer faults 0、沒有 dropped。各 5／5 受控 completion 對帳全為 abort；suppressed 0，因此零匹配沒有額外證明成功健康樣本被實際過濾。學習過濾保存至晚到結果收束，沒有清除既有學習資料。延遲原始檔的 held=0 不能代替全工具清理，timer／方法／listener 清理另存最終結果。每個已結束的拖曳 context 方法完整描述子還原，timer 清除、live XHR observers 0；第一窗初次 cleanup 的 held=12 保留原紀錄，另由 auto1-final-held-cleanup.json 記錄同片刷新後 12 個原生已結束請求與最終 held=0，不倒寫初次結果。

**最終清理於 14:09:11.153Z** 保存 final-cleanup.json：完整 body216Match 重新核對、唯一 singleton／共用控制器、disabled=false／originalComparison=false、dragging=false／coreReloadRevision 0。patterns 清空、held=0，observer 入口自有遮蔽移除，XHR.send／evidence.record／ids.next 的完整描述子均核對所有權後還原，timer 清除、live XHR observers 0，10 個已確認 IDs 記憶體及持久樣本仍零匹配。網站保持 Auto 1 倍並正常暫停，沒有遺留自有 SDK 回傳 wrapper；final-proof.png 保存指定影片畫面。

最終長時間整理後的 observer 淘汰旗標為 true，Fetch readback 亦 truncated=true、未讀到新的 paused 事件；**不能由此補算歷史完整性**。清理依已確認請求完成對帳、held=0、patterns 清空與描述子實際讀回判定，不把後來的工具清理當成先前缺失事件。所有有效主窗口的完整性仍以各自原始檔的旗標為準。

## 目前結果與續行條件

BR-08 修復與發布完成，新版安裝的四種命中／拖曳保護、釋放及正常 Auto／約 12 秒延遲取得證據；完整 BR-01 未完成。剩餘需有效 nonpaused／無 error／授權／額度／breaker 前提持續到 30 秒並實際呼叫 reload，才能驗證重載後完整 15 秒失敗／三 tick 不重試、晚到 SDK 與最新位置還原。四窗都在約 19～20 秒失去該前提，不重跑相同窗口製造通過。

真正背景尚未取得：原生 hidden=false 的前景操作不算背景。工具不支援此次 window 控制，Native computer API 不可用；true-background-tool.json 保存單次能力阻塞，不改 Chrome 設定。真 singleton startup gate 每次新載入皆 preflight-skipped:xhr-explicit-timeout，原生 video XHR timeout 10,000／13,000 ms；需要同片自然產生無顯式 timeout 的可延後請求才續驗，不能重建 gate 或改網站 timeout。帶有效 token 的生命週期／政策撤銷、audio fallback 隔離、近 0 位置與晚到 SDK 仍列待驗收。

另有**未定位的位置跳變觀察**，不列已確認腳本缺陷：Auto 1 倍正常播放中暫時以既有 commands 切換原線對照 false→true→false，即時 556 ms 內位置 2739.038058→2739.590058、影格 +32，沒有跳變。恢復模式 **174.648 秒後**，最後正常採樣 2913.218677 秒至第一個 seeking 的 0.307 秒相隔 100 ms；新 video 表示 group-14 的請求已早 1.225 秒開始，在 seeking 當刻原生 abort，約 3.25 秒後 resize 720p／seeked 並恢復進度。userRevision 5、media 1／core 2／generation 1／epoch 0 不變，沒有新 route／core action 或腳本重載。comparison-control.json、comparison-followup-observer.json、獨立 comparison-analysis.md 保存前後事件。

這不支持「模式控制同步 seek」或「腳本 Recovery 重載／內容重設」的解釋，但未保存 SDK stack、完整 Network／Range 與當時路線政策，仍不能排除延遲政策影響或確認網站 ABR 根因。長時間整理期間 observer 的 2000 列採樣上限已淘汰舊列，dropped／everDropped=true；4818 項事件仍包含控制與跳變關鍵時序，不能宣稱整段無觀察丟失。後續需在自然 Auto 表示變化時，用有界但持續排空的 Network／SDK 呼叫觀察確認位置提交來源及正常對照，不改畫質或將其他腳本停用。原線對照只計 immediate flag 精確復原，不能據此宣稱完整播放相容通過。

本輪沒有足夠證據確認新產品缺陷。原 87.785 秒自然停滯網路起因與其他完整產品驗收獨立保留。私有 installed/analysis.md 由另一代理唯讀複核原始窗口；CHECKPOINT.md 保存可續行前提與資源清理。Release 快照及原失敗紀錄不回寫。
