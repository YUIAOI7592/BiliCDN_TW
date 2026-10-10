# BR-01 Auto 畫質深度調查 — v2.1.12／2026-10-10

**已定位腳本不介入長 seek 的救援抑制鏈，並重現兩項相關恢復缺口；本輪沒有修復。** 真正 Chrome／Tampermonkey 的 Auto 場景中，受控延遲影片請求約 12 秒後，seek 總共花 **28.133 秒**完成；取消攔截後的同片正常對照為 **1.555 秒**。有效輪 epoch 沒有改變，沒有腳本核心重載。原 v2.1.10 自然發生的 **87.785 秒**停滯，其最初 CDN／傳輸起因仍未證實，不能用受控延遲替代該結論。

目前工作見 [TODO](TODO.md)，既有發行驗證見 [TEST_REPORT](TEST_REPORT.md)。本文件是新的調查證據，不回寫 [v2.1.10 原觀察](CHROME_v2.1.10_ACCEPTANCE.md)、[v2.1.11 續測](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md) 或 Release 快照。

## 基準、使用場景與邊界

- 開始時 main／`c924b0216fe0a8f7a624f391d44b36660daca433`，工作目錄乾淨，版本 **v2.1.12**。本輪來源、正式測試、登記、版本及 Release 未改動。
- 實際 Chrome 155 的 Tampermonkey 腳本 body 與 v2.1.12 發行附件一致：**298,785 bytes**，SHA-256 `c3874efbf718a3eebcc64cf2591d1a328d7ddde1aac40b7d91faf593f7c6e28d`。
- 依使用者要求，主要使用場景是 **Auto 畫質**。Auto 因流量條件改變解析度屬正常行為，不能把降至 1080p 單獨判為缺陷。修復方向須保留網站的 Auto 適應能力。
- 網站只使用指定[風景影片 BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/)。沒有切換其他影片、變更 Chrome 設定或停用其他腳本。
- 有效現場輪使用既有 **2 倍速**、前景可見、正常腳本選路；1 倍速不是本輪已取得的現場對照。影片是 DASH；MP4／FLV 不在本輪現場覆蓋範圍。
- Chrome 操作約 **11:29–12:03（Asia/Taipei）**；後續為本機重現及報告驗證。工具為 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。

新私有證據根目錄：`.work/functional-review/br01/2026-10-10-c924b02/`。公開報告不包含媒體簽名 URL、路徑、查詢字串、cid 原值、Cookie、IP 或播放器／核心物件。

## Auto 現場時間線

有效證據是 `auto-unified-delay-late.json`。透過 Chrome Request 階段攔截實際播放 XHR，以記憶體中 Vault 當前影片路徑集合識別需要延遲的請求；只持有已知影片，其餘請求立即放行。沒有產生合成 CDN 請求，也沒有把全站離線或音訊失敗當作影片故障。

| 時間（Asia/Taipei）／相對時間 | 事件與實際狀態 |
| --- | --- |
| 11:57:38.257 | 起始標記：Auto（4K）、3840×2160、正常播放、可播放緩衝 10.51 秒、generation 1／epoch 1 |
| 11:57:38.374／0 秒 | 點擊同片播放位置，目標約 703.22 秒；`seeking=true`、readyState 1、可播放緩衝 0 |
| 11:57:38.800 | 第一個採樣到的 `seek-grace`；本輪所有 109 個 seeking 採樣的 `stallTicks` 均為 0 |
| 約 +2.102 秒 | 首個新影片請求出現 `abort`，本身耗時 2.051 秒，配置的 XHR timeout 為 10 秒 |
| +5.354 秒 | 未再操作使用者 seek，媒體再次產生 `seeking`，位置變為約 703.72 秒；不能僅以每個 seeking 事件判定新的使用者意圖 |
| 11:57:50.341／+11.967 秒 | 解除持有；4 個已知影片請求中 3 個已先終止，剩餘 1 個成功繼續；持有窗口另有 9 個非持有請求即時放行 |
| 11:57:52.838 | 可信 API 再次登記 21 個影片／3 個音訊表示，cid 關聯序號相同，epoch 仍為 1 |
| 11:58:06.507／+28.133 秒 | `seeked`，readyState 4、可播放緩衝約 2 秒；距解除持有仍有 **16.166 秒** |
| 11:58:34.941 | 後續正常前進、Auto（4K）、可播放緩衝 14.71 秒；同一觀察器內核心序號仍為 3，沒有 `player-reload` 事件 |

整個標記窗口 56.684 秒，取得 **19 個音訊成功傳輸**，其中 **3 個在 seeking 期間**。這證明影片延遲時音訊仍可通行；不是 R04 所有故障情境的完整驗收。有效窗口的 observer 沒有丟棄紀錄，合併的 Chrome 網路事件游標 `truncated=false`。

已能歸因為 video 的新請求，觀察到約 **2.051／3.050／4.050／5.050／4.051 秒**提前 abort，配置的 timeout 分別為 **10／13／16／19／16 秒**。另有 seek 開始時取消上一請求的 133 ms abort，及未能精確歸因的取消，兩者不混入此組重試比較。窗口沒有原生 XHR `timeout` 事件；未取得呼叫 abort 的網站堆疊，不能精確指認是哪個網站模組，也不能把提前取消直接改算 CDN 逾時。

延遲、解碼／緩衝以及網站重試共同決定實際完成時間。本輪足以證明「此 Auto 故障窗口內腳本沒有救援升級」，**不能把解除攔截後的 16.166 秒全部歸因於腳本，也不能證明重載一定能更快恢復**。

`final-auto-normal-control.json` 是解除攔截後的正常對照：Auto、同片另一播放位置、2 倍速，seek **1.555 秒**完成，epoch 1、沒有腳本重載或錯誤。這是單次因果對照，不是平均延遲、統計效能或相同片段的配對測量。較早更正過的正常 backward seek 為 4.134 秒；forward 的 1.610 秒只保留媒體事件證據，該輪網路緩衝曾截斷。

## 已確認的實作缺口

以下 BR-01-A／B／C 是本項調查內的追蹤名稱，不新增公開 API 或新的發行項目。前兩項的有界恢復門檻尚未成為已批准產品政策；已確認的是缺少退出／升級路徑，不能擅自把觀察窗口當作產品超時值。

### BR-01-A：持續 seeking 讓暫時寬限沒有終點

**優先級 P1，真實 Auto 現場＋靜態＋確定性重現。** 播放器尋位時影片無進度，使用者看到長時間等待；腳本在整段 seeking 內無法透過 watchdog 累積卡住證據或建立核心救援。

可達入口為正常使用者 seek → `PlayerMonitor.tick()`，以及 video 路線備援 → `RuntimeController.record()` → `RecoveryController.armRouteFailure()`。

- [player-monitor.ts:70](../src-v2/application/player-monitor.ts#L70)：每次取樣，只要 `video.seeking` 就把寬限推至「現在＋5／8 秒」，沒有保存該次尋位的絕對起點。
- [player-monitor.ts:84](../src-v2/application/player-monitor.ts#L84)：`video.seeking` 本身也無條件進入 `seek-grace` 並把 stallTicks 歸零。因此**只停止延長計時器仍不足以修復**，即使計時器過期，seeking 分支仍會阻止 watchdog。
- [player-monitor.ts:98](../src-v2/application/player-monitor.ts#L98)：startup 救援也明確排除 seeking；[114](../src-v2/application/player-monitor.ts#L114) 將該狀態傳給量測，健康探索暫停本身符合避免干擾播放的既有契約。
- [runtime-controller.ts:52](../src-v2/application/runtime-controller.ts#L52) 只轉交 video 備援；[recovery-controller.ts:65](../src-v2/application/recovery-controller.ts#L65) 拒絕在 seeking 時建立 route-failure 意圖，已有意圖則在 [79](../src-v2/application/recovery-controller.ts#L79) 以 `seek-interrupted` 結束。

反證：短程正常 seek 不重載、最新使用者 seek 撤銷舊還原是必要保護，不能直接移除。已送出請求的原生取消語意也不能為了製造備援而更改。此次正常 seek 對照成立，受控 Auto 故障輪 epoch 沒有改變；不是 BR-03 換片重設造成這段救援未介入。

最小獨立重現：保持可見、播放意圖、核心已初始化、readyState 1、0 緩衝、不再增加影格，固定 seeking 為 true。FakeClock 前進 300 秒後仍為 `seek-grace`、stallTicks 0。斷言要求離開暫時寬限而失敗；**300 秒只是觀察期限，不是建議等待 300 秒才救援**。

修正方向：先明確辨識一段尋位及最新使用者意圖，保存起始時刻與進度基準，再建立不由持續 seeking 每 tick 延長的有界升級。Auto 的正常重試／換表示應有等待機會；新使用者操作撤銷舊工作。何時改線、何時僅終止等待、何時可重載必須在修復計畫中分開決定。

### BR-01-B：已初始化但無進度的核心可無限保留恢復意圖

**優先級 P1，靜態＋確定性重現；尚未證明它是原現場卡住的實際動作。** 這是修復 A 之後必須一併考慮的第二道阻礙：即使讓 watchdog／備援成功建立意圖，現有恢復也不一定會處理還活著的卡住核心。

可達入口為影片曾健康播放 → seeking 已結束但緩衝為 0／無影格前進 → video fallback 或 watchdog 建立 route-failure 意圖。進度不再前進，readyState 1，寬高仍為 3840×2160、`coreInitialized=true`。

- [recovery-controller.ts:124](../src-v2/application/recovery-controller.ts#L124)：`dead` 必須同時 readyState 0、寬高 0、核心未初始化。
- [125](../src-v2/application/recovery-controller.ts#L125)：一般卡住只在來源為 `startup-failure` 時構成 `startupStalled`。
- [128](../src-v2/application/recovery-controller.ts#L128)：4 秒後也只有上述兩種狀態能開始重載。
- [129](../src-v2/application/recovery-controller.ts#L129)：15 秒 timeout 只在已開始重載後生效；**沒有涵蓋開始重載前的等待**。

FakeClock 前進 300 秒後，route-failure token 仍存在、`isRecovering()=true`，沒有進度、沒有重載／完成／失敗。新意圖因既有 token 被拒絕，量測也會因 recovering 停止；該狀態不必然讓網站永久不能播放，但腳本工作沒有自己的結束上限。

現場有效 Auto seeking 窗口沒有建立本項 token，因此不宣稱 B 已在該輪觸發。另一輪手動呼叫網站 reload 後經 play 恢復的觀察，也不能證明重載能解決原自然故障，詳見作廢與探索證據。

修正方向：所有恢復意圖都應有包含準備期的有限生命週期。區分解碼器仍存在、影片無進度、路線嘗試及核心真正死亡；處理活核心的重載條件須保留正常 Auto 切換、重載上限及冷卻。即使選擇不重載，也須明確終止意圖並釋放控制權。

### BR-01-C：尋位打斷恢復後，保留的寬高可被誤認為播放已恢復

**優先級 P2，靜態＋確定性重現。** 主要影響恢復狀態的可信度，沒有證據顯示它造成最初的 CDN 延遲。

事件順序：先建立 route-failure 意圖 → 使用者 seek 使該意圖正確以 `seek-interrupted` 失敗 → 下一個取樣仍 seeking、readyState 1、0 緩衝、影格不變。

[recovery-controller.ts:83](../src-v2/application/recovery-controller.ts#L83) 的 `healthy` 包含「寬或高大於 0」，[96](../src-v2/application/recovery-controller.ts#L96) 在無 token、未暫停、原狀態 failed／breaker 時直接設為 `recovered / healthy-playback-observed`，沒有要求 seeking 結束或真實播放進度。Node 正確契約在這一步失敗。

反證：寬高可以作「核心／解碼器存在」的線索，但不是卡住後的播放恢復證據。有效 Chrome 延遲輪開始前 recovery 就已顯示歷史 `recovered`；那個歷史值不能作本輪救援成功證據，也不直接證明 C 在此輪發生過狀態轉換。

修正方向：拆開核心存在與恢復完成的判定；failed／breaker 清除應要求屬於當前尋位／恢復動作的實際進度或足夠播放證據，不能僅靠保留的 decoder dimensions。

## 正式測試與獨立失敗契約

正式來源沒有修改，重新執行 **`npm run typecheck`、`npm run architecture`、`npm test` 全部通過**：44 個執行期模組、19 套件、448 個具名案例。沒有 failed／skipped／todo／cancelled。這不代表上述缺口已修復，表示既有正式契約未涵蓋這些升級條件。

獨立重現位於私有證據目錄的 `repro.ts`／`run.mjs`，使用實際 PlayerMonitor／RecoveryController、FakeClock、testScope、完整型別 PlayerPort 與既有測試支援，**沒有改正式登記、沒有 `as never`**。

| 具名 Node 案例 | 結果／角色 |
| --- | --- |
| `BR-01 control: a short user seek preserves the target without reload` | 通過，保留正常 seek 及不回寫舊位置 |
| `BR-01 control: Auto representation downshift with progress causes no forced reload` | 通過；以尺寸下降且仍有進度作控制器對照，不是完整網站 ABR 重選矩陣 |
| `BR-01 control: a later user seek cancels an older core restore` | 通過，保留最新使用者操作所有權 |
| `BR-01 candidate liveness: unchanged seeking without frames or buffer must leave temporary grace` | 失敗，A；尚待批准有界升級政策 |
| `BR-01 candidate liveness: an initialized stalled core must not retain its recovery token indefinitely` | 失敗，B；尚待決定準備期終止／救援策略 |
| `BR-01 diagnostic contract: a cancelled recovery must not become recovered while the user seek is still stalled` | 失敗，C；正確診斷契約 |

獨立重現總計 **3 pass／3 fail，退出碼 1**，skipped／todo／cancelled 均為 0；不混入正式 448 pass，也不把失敗當作套件通過。重現 TypeScript 的獨立設定已通過。精確命令及 Chrome 重跑條件見私有 `RERUN.md`；`node-results.txt` 保存完整 TAP。

本輪未修改執行期差異，不重新封裝、不執行新安全差異掃描；`npm run verify` 的通過紀錄仍是先前 v2.1.12 發行時證據，不冒充本輪新執行。文件及受保護來源核對另列在本輪 `logs/final-checks.txt`。

## 排除、作廢與仍待查的前提

| 證據／假設 | 判定與使用限制 |
| --- | --- |
| `auto-unified-delay-late.json`、`final-auto-normal-control.json` | 有效主要故障／正常對照；使用同一合併網路游標，沒有事件截斷 |
| `auto-normal-backward-corrected.json` | 有效正常 seek；先重新確認進度條座標 |
| `auto-normal-forward.json` | 只有媒體 seek 延遲可用，網路資料截斷，不稱完整網路對照 |
| `auto-normal-backward.json` | 過期座標點到暫停，不是 backward seek；不列通過 |
| `auto-video-delay-mid.json`／`auto-video-delay.json` | 初次攔截準備及捕捉不完整，不能證明影片實際被持有的精確窗口 |
| `auto-clean-video-delay.json`／`auto-confirmed-hold.json` | Fetch 與 Network 分開游標未取得所需 requestPaused 事件，不能算有效注入；後來改為同一游標完整捕捉 |
| `auto-unified-delay.json` | 有效輪的中途快照；完成結論以 `-late` 完整窗口為準 |
| `auto-new-seek-control.json`、`stall-after-release.json` | 接續早期不完整注入；只作探索觀察，不作自然故障或乾淨正常對照 |
| `manual-sdk-reload-control.json`／`manual-sdk-reload-resume.json` | 明確手動網站核心重載＋play 的探索，既非自然 SDK 故障也非腳本自動恢復成功；不能據此認定重載為唯一修法 |
| `sdk-auto-state.json`、`auto-stall.png` | 早期混合狀態，只作現場快照；當時的降解析度／品質文字不能單獨定義新缺陷 |
| 同片 epoch 0→1 的早期觀察 | 發生在準備不完整的階段，缺少完整前後請求 cid／內容基準；後續有效窗口 epoch 1 穩定。不能判定 BR-03 回歸 |
| Auto 解析度與選單文字不同 | 網站 Auto 實際表示、選單標籤以及 Session 確認時間可能不同；RouteCoordinator 在兩次成功影片傳輸後才更新目前表示。未證明持續不一致由本腳本造成，不能當作固定畫質被強制降級 |
| SDK 提前取消等於 CDN timeout | 排除這項推論；[route-coordinator.ts:744](../src-v2/application/route-coordinator.ts#L744) 不把 abort 作健康懲罰是現行語意，不能全面改判為失敗 |

原 87.785 秒自然停滯仍需完整的最初請求、原生 transport 錯誤與網站重試時間線，才能區分傳輸速度、Range／緩衝、ABR 決策或核心內部停滯。本輪沒有錄到該自然起因。網站 Abort 呼叫的堆疊與 1 倍速自然長 seek 對照也未取得。

## 修復計畫應涵蓋的驗證

以 Auto 為主要驗收契約，先確定有限尋位／等待的政策，再先建立正式失敗案例。至少涵蓋：

1. 正常短 seek、快速連續 seek、Auto 改表示仍正常前進、緩衝短暫不足後恢復；不得無故重載或鎖定解析度。
2. seeking 無進度，及 seeking 結束但已初始化核心無進度兩種狀態；分別驗證有界升級和所有退出路徑。
3. 每次新使用者 seek、播放／暫停意圖、倍速與當前目標；不能回寫被替代的舊位置。媒體 seeking 事件不必然代表新的使用者命令。
4. 世代／內容週期、core 替換、停用／原線對照、背景、ended／mediaError、設定與禁止規則在等待期間改變；晚到 reload／play 結果仍檢查所有權。
5. video 與 audio 的故障和證據隔離；維持 Vault 唯一授權、Catalog／Native 合法決策與已送出請求的原生語意。不要把所有網站 abort 都懲罰為 CDN 故障。
6. 尋位仍卡住時不能顯示本輪「播放已恢復」；分開觀察 route 計畫、原生送出、影片進度、核心重載與使用者位置保留。
7. 真實安裝版 Auto 的 1 倍／2 倍速正常與受控故障；固定畫質只作必要邊界對照。來源隔離、受控安裝版與自然故障分列。

這是調查後的修復方向，不代表本輪已經實作或批准特定秒數、重載觸發條件。BR-02／03／04／05、真正 startup gate、background／SDK 自然故障與 R04 完整驗收不能由本項結果替代結案。

## 清理與交付狀態

測試觀察器以安裝實例為範圍，250 ms 有界採樣；請求、進度、完成事件只保存可歸因的中繼資料。故障窗口透過該實例的 EvidenceStore.record 掛鉤抑制 owned video request IDs 的持久樣本，保留晚到結果的過濾；沒有清空學習資料。

清理時直接檢查 schema 2 儲存資料，**98 個 owned IDs 沒有留下樣本**；這不是完整儲存內容前後相等的聲明。非故障窗正常傳輸及正常音訊仍可學習，不能宣稱所有使用者資料完全未變。未能精確歸因的請求不滿足既有樣本寫入條件。

已停止持有，清空攔截 patterns，停用本輪 Network 捕捉；還原自己仍擁有的 XHR send、EvidenceStore.record 及內容追蹤掛鉤，清理監聽器／計時器／訂閱和暫存屬性，關閉本輪新建測試分頁，未操作使用者其他分頁。最後快照 Auto（4K）、readyState 4、可播放緩衝 **34.84 秒**、正常前進、seeking false、沒有 mediaError，截圖為 `final-auto.png`。

交付包括本報告、獨立 Node 重現、完整有效／作廢證據、摘要產生入口、正式測試紀錄、重跑說明與更新的檢查點。**BR-01 調查目標完成；修復、原自然起因定位與完整產品驗收仍未完成。**
