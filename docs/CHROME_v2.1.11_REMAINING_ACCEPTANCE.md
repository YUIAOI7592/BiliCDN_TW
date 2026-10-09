# v2.1.11 BR-01 與剩餘驗收續測 — 2026-10-10

**本輪調查／交付完成，產品整體驗收尚未全數通過。** 使用者要求建立新目標後，03:02–03:36（Asia/Taipei）繼續驗收，沒有以先前 BR-04 作為提前退出條件。取得 BR-01 救援抑制的因果證據，新增已確認的 **BR-05 Fetch 取消原因遺失**；其餘 gate、恢復、影音隔離及生命週期均有具體結果或明確限制。BR-01 最初網路觸發原因、真正背景切換與若干 SDK 自然故障仍未證實，不宣稱全部驗收通過。

## 基準及證據層級

- HEAD：`f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e`，**v2.1.11**；開始／結束相同。Tampermonkey 5.5.1、Chrome 155，執行中的 userscript body 與 Release 相同，產物 SHA-256：`9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`。
- 唯一網站影片為使用者指定的 [BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/)。背景操作曾短暫開啟**同一影片**的臨時分頁，沒有播放其他影片、變更 Chrome 設定或停用其他腳本。
- 新證據：`.work/chrome-v2.1.11/2026-10-10/remaining-acceptance/`，原調查及 BR-04 不覆寫。正式來源、正式測試、scripts、Release、版本設定與 AGENTS 未修改；先前未提交的文件保留。
- 分開記錄：①正常網站／原生控制項；②真正 hooks 與受控合成請求；③安裝版類別加受控介面／時鐘；④獨立 Node 失敗契約。後两類不能替代自然 SDK／背景行為。
- 本次不重跑完整 npm／verify 或安全掃描。382 個正式案例及發行前安全結果仍是[既有發行證據](TEST_REPORT.md)，不算本輪的新通過數。

## BR-01 因果定位

正常分步對照成立：4K 原生進度列 seek 約 **2.393 秒**、8K 原生進度列 seek 約 **2.398 秒**；4K→8K→4K 皆有实际解碼尺寸及影格前進，正常輪 epoch 保持 0。暫停 **57.961 秒**後，原生播放按鈕續播並保留 2 倍速，沒有核心重載。

受控故障只延遲當時 Vault 精確來源所屬的影片 path，在原生進度列 seek 後得到以下序列：

| 時間（Asia/Taipei） | 可觀察狀態 |
| --- | --- |
| 03:22:56.271 | 原生 `seeking`，目標 1953.101941 秒、readyState 1、零緩衝；開始延遲影片請求 |
| 03:23:01.560 | 网站再發 seeking，位置改為 1953.601941；影格仍不前進 |
| 03:23:11.305 | 仍 seeking、readyState 1、零新影格／緩衝，watchdog `seek-grace`，Recovery 沒有重載 |
| 03:23:11.316 起 | 釋放已捕捉請求；14 筆 captured ID 中 9 筆繼續、5 筆已被網站取消 |
| 03:23:24.100 | `seeked`，readyState 4、取得缓衝；3ms 後 playing，4K／2 倍速正常 |

從第一個 seeking 到 seeked 為 **27.829 秒**。延遲解除後仍有網站重試過渡，因此不能把整段時間都當成設定的 hold 時間。此輪是受控網路等待，**不是自然重現原 87.785 秒故障**；guard 與 Network 窗口均完整。兩個正常 seek 的首次／舊網路收集部分窗口截斷，另保留限制，不推論零故障或全量 CDN 統計。

根因鏈已定位到下列設計：

- [PlayerMonitor](../src-v2/application/player-monitor.ts) 第 **70 行**每次 `video.seeking` 都把 `seekGraceUntil` 延到「現在＋5／8 秒」。它是 seeking 結束後的寬限，並非 seek 最長時間。
- 第 **84 行**在 seeking／寬限內將 watchdog 設 `seek-grace` 並清空 stall ticks；第 88–95 行的停滯選路救援無法成立。第 **98 行**也排除 startup rescue。
- [RecoveryController](../src-v2/application/recovery-controller.ts) 第 **65／70 行**拒絕 seeking 時建立恢復；第 **79–80 行**取消既有恢復，以保留使用者尋位。這項防護本身有必要。
- 安裝版 Monitor 的確定性時鐘對照：持續 seeking **90 秒**仍為 `seek-grace`／0 stall ticks／0 recovery；清除 seeking 後 8 秒才開始 stall，13 秒時才出現 watchdog recovery。另驗證首個非零位置只是基準（stable 0），下一個增量才為 stable 1。

因此可以解釋原 [87.785 秒現場](CHROME_v2.1.10_ACCEPTANCE.md#br-01-追加觀察)「長 seeking＋seek-grace＋seek-interrupted」為何沒有脚本救援。但**最初 timeout 是哪個 CDN／網站重試造成、以及最後 1080p 與 4K 標籤分歧，仍未建立乾淨因果證據**。BR-03 排列問題、BR-04 重入及 BR-05 取消原因都不能據此宣稱是 BR-01 起因。

若安排 BR-01 修復，先明確決定「超長 seek 且無影格／緩衝」的上限與恢復策略。以最新 seek 身分和使用者目標位置管理絕對期限，有限度切換當前請求路線；不能直接刪除 seeking 防護，或以舊恢復位置覆寫新 seek。仍需保存自然 timeout 到網站重試／降畫質的完整序列。

證據：`seek-4k-native.json`、`seek-8k-native.json`、兩份 `quality-*.json`、`pause-resume-native.json`、`controlled-seek-delay.json`、`monitor-seek-installed.json`。後者的重跑 helper 為同名 `.js`。

## 其餘覆蓋結果

| 區域 | 本輪結果 | 證據邊界 |
| --- | --- | --- |
| 真 singleton startup gate | 3 候選 running；等待中重複 abort 只終止一次；成功 Blob reopen；SyntaxError／單次 sync failed open 均正常完成；显式 timeout 原生終止一次 | `startup-gate-live-result.json`；Fetch 自訂取消原因**失敗，BR-05**；第一輪 probe 被保留至真 3 秒期限，不能算 206 成功輪 |
| 原生 probe 矩陣 | 206 有效、200 無效、short 206、403、全候選 network error、deadline、reset／晚到取消均有結果，沒有取消後選定舊 host | `startup-native-probe-rounds.json`、`startup-probe-edge-rounds.json`；新建安裝版 controller 的受控預算委派到既有 hooks，保留原 singleton 每分頁一次語意 |
| 短回應正常對照 | uncached 候選 short-response；已有健康證據的候選可用 16 bytes 驗證可達性，沿用 cached Mbps | 没有將此合法快取行為錯報為缺陷 |
| 等待中政策改變 | 固定主機變更後送往新固定 host；停用後原線通行；原線對照後不改寫；內容 epoch 改變取消探測但原網站請求可依最新 Catalog 政策完成 | `policy-during-gate.json`、`lifecycle-during-gate.json`；guard 未截斷，每有效請求只有一次 loadend。舊授權／測量 choice 沒有復活；不要求換 epoch 必須取消網站請求 |
| 恢復所有權與例外 | **16／16**：中斷先於還原、reload reject／throw／unavailable、晚到 reload／play、更新動作所有權、再次失敗、deadline／breaker、兩次重載預算、長暫停播放意圖 | `recovery-installed-matrix.json`；安裝版 constructor＋受控播放器介面／時鐘。不能宣稱自然 SDK 自行拒絕已實測 |
| 真 SDK 核心替換 | 受控 dead snapshot 觸發真正 PlayerAdapter／网站 `reload()`；core ordinal 1→2；恢复 2145.836962 秒、2 倍速，4K 原生解碼前進 | `real-core-reload.json`；觸發條件／時間受控，**核心替換、seek／rate／play 是真正 SDK**。不是自行斷言核心已死 |
| R04 剩餘交錯 | **13／13**：audio／video／重複／兩種順序、original comparison、paused／seeking／ended／mediaError；影片 watchdog 與 startup rescue 仍有效 | `r04-installed-matrix.json`；安裝版 Runtime／Recovery／Monitor 的受控型別事件。真正網路 audio 負向／video 正向证据保留前輪 `r04-*`，不能把受控事件叫自然 CDN 故障 |
| 鎖內量測資格 | **8／8**：正常、hidden、seeking、recovering、低緩衝、disabled、表示改變、世代失效。取得鎖後不安全者均 0 probe／0 candidate attempt，不消耗 cursor／冷卻；正常者以取得鎖的時間提交 | `measurement-lock-installed.json`；受控 lock／狀態，不替代真正 browser hidden |
| 真實生命週期組合 | **5／5**：same cid 排列保留 epoch／audio／待完成恢復；不同 cid 共用路徑同步撤銷；低信任不污染；實際設定停用／啟用；实际 history 同片 query SPA 及還原 | `lifecycle-live.json`；原有 Runtime／Session／Vault／Routes／設定。內容输入是合成可信 API 邊界，沒有切換其他影片 |
| 背景切換 | **待原生驗收** | `background-native.json`、`background-second-attempt.json`。新 blank tab 及同片臨時 tab＋Page.bringToFront 都未使主頁 hidden；兩次皆排除，不算通過。当前 Browser API 沒有可用的可信啟用分頁操作；Native Windows API 不可用 |
| BR-02／BR-03 | 本輪沒有再次全面重跑，保留前輪安装版 **42／42、31／31** 證據及已确认 BR-04 例外 | 前輪 [報告](CHROME_v2.1.11_PROGRESS.md)／[BR-04](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)；不重複合併計數 |

「恢復 16＋R04 13＋量測鎖 8＋實際生命週期 5」合計 **42 個新增受控案例通過**，不是 42 個自然網站故障，也不是前輪 BR-02 的 42 個案例。

## 新缺陷及附帶觀察

**BR-05 P2 已確認：**真正 gate Fetch 未保留取消原因。Chrome 原生對照保持原因，安裝版控制器丟失；獨立 Node 契約 **3 control pass／4 contract fail、exit 1**。详细入口、位置、影響及修正方向見 [BR-05 報告](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md)。本輪未修復。

**BR-04 仍未修復：**二次 sync failed open 令內部準備失效，先前 Chrome 複核成立。本輪沒有以重現它取代其他驗收，也沒有重新算通過。

另有兩個**待複核觀察**，不新增確認缺陷或修復政策：

- reset 後 controller 的 startup snapshot 可保留 `running` 舊文字，雖然 controller／host choice 已取消。受控 controller 結果可見；尚未在原 singleton 的控制中心畫面取得对应证据，应查明顯示是否持續誤導。
- 快速恢復 `fixedHost:null` 後接著變更 disabled，最後曾讀到先前測試 fixed host。沒有逐步 GM 儲存／通知對照，**不能推論是 R02 或確定 GM cache 根因**。最終以單次局部更新與持久讀回確認 null；不變更既有原生 GM 通知競合政策。見 `policy-during-gate.json`／`settings-restoration.json`。

## 工具排除與清理

- 一次進度列因控制列隱藏而未能點擊，先清除攔截，再以實際播放按鈕顯示控制列重做。首個 8K 內層 schedule 點擊未 seek，改讀 hit target 後使用 wrap；都不算產品失敗。
- 受控延遲輪在點擊後遇到工具迴圈變數錯誤；完成事件泵並釋放全部已捕捉請求。依實際 timestamp 分析，沒有冒稱預定延遲長度。真实长 seeking 及確定性 Monitor 對照仍成立。
- Node 背景定時 CDP 輪詢不可跨工具呼叫、動態匯入 scratch helper 及字串函式建立受限，改用單次呼叫內的分頁事件泵與明确 helper。沒有以工具錯誤當成功，沒有反覆盲試。
- 第一個「disabled during gate」輪的 startup 實為 skipped，**排除 gate 前提**；之後重建可信來源與 fresh controller，確認 running／3 candidates 後重做，見 `lifecycle-during-gate.json`。
- 所有合成請求 Request-stage guard 先安裝；有效矩陣窗口未截斷，合成請求未以 continue 外送。真实影片延遲輪的 continue 是使用者指定影片的正常請求，與合成證據分列。
- test-owned samples／startup samples／cursor 寫入在明確 instance 邊界過濾；不是清空學習資料。受控 delay 輪的網站 abort 沒有記錄成功／失敗樣本（filtered 0）。不宣稱全部真實播放學習狀態逐位元還原。
- 真實 disabled／fixedHost 及原線對照操作最終还原為 false／null／false；其他設定維持原值，`updatedAt` 因實際設定命令自然變動。schema 2 不變。
- 临時 controller、iframe／Blob／XHR、寫入／gate 方法及 reset 包裝還原；對照方法等於原型原方法。Debugger、Fetch patterns 清除，250ms observer、DOM／路線／恢復／visibility 訂閱移除，临時背景分頁關閉。
- 最後為指定影片 **3840×2160、2 倍速、readyState 4、seeking false、無 mediaError、healthy**。還原合成內容後真实 SDK 再次建立 core ordinal 3；最後 generation 9／epoch 3 是受控生命週期操作結果，不能當作正常畫質操作誤增 epoch。

最終证据為 `cleanup-and-final-state.json`、`final-observation.json`、`final-screen.png`／`film-proof.png`。正式來源等路径的 `git diff --name-only` 為空；交付前另檢查 Markdown 連結、來源引用及 `git diff --check`。

## 下一步與完成判定

本輪剩餘領域均已盤點、執行或留下具體不可執行前提；沒有用「找到 BR-04」結束新目標。但**產品驗收未全通過**：BR-04、BR-05 必須修復；BR-01 需決定超長 seek 政策並續查自然網路／網站降畫質序列。

真正背景／前景轉換、SDK 自然 reload 拒絕／晚到 play、真實跨影片 SPA 仍與受控證據分列。後者在「只使用此影片」邊界內不操作其他內容，採合成 cid 验证撤銷；不擅自解除限制。公開 MP4／FLV 等舊現場限制与 v2.1.9 UI 證據保留原版本，沒有因本輪追加而宣稱重新驗收。

私有 `.work/chrome-v2.1.11/2026-10-10/remaining-acceptance/CHECKPOINT.md` 記錄所有 helper、重跑入口與清理状态。另立修復範圍時，先正式化 BR-05 失敗契約，修 BR-04 所有權，再決定 BR-01；安裝新產物後重跑對應矩陣，發布驗證另行執行。
