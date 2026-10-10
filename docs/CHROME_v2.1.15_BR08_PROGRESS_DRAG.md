# BR-08：進度列外層命中區拖曳未取得保護，按住期間啟動影片備援

日期：2026-10-10（Asia/Taipei）。版本：實際 Chrome／Tampermonkey **v2.1.15**，發行提交 `3f7c73335a58dd89d4bc8a4209b7ecf3c70acaf8`。狀態：**P2，已重現、未修復；BR-01 完整安裝版驗收未結案。** 本輪只保存新缺陷及正常對照，未修改執行期或正式測試。

## 結論與使用者影響

網站的 `.bpx-player-progress-wrap` 外層區域也會接收合法進度拖曳，但 PlayerAdapter 只把內層 `.bpx-player-progress` 等元素視為進度拖曳。本次先以已完成的內層click建立尋位停滯，再開始外層按下、移動並持續按住的拖曳預覽；腳本增加 userRevision 卻保持 `dragging=false`，使 Monitor 在使用者尚未釋放滑鼠前建立新的停滯段。預覽可以到mouseup才提交媒體位置，不要求pointerdown當下又有新seek才能取得拖曳保護。

指定風景片、Auto 2 倍及受控 video-only 等待中，真實可信外層 pointerdown 後 **15.079 秒**發生一次 video route-fallback，當時滑鼠尚未釋放、內容／媒體／核心所有權仍有效、影片沒有暫停或錯誤。這違反已確定的「使用者拖曳期間不啟動救援，結束後才從最新目標建立基準」契約。可能影響長拖曳或按住預覽時的路線選擇；若停滯和重載額度持續有效，30 秒核心重載後果另由私有模型重現，**本輪未取得該後果的有效安裝版證據**。

問題與 BR-07 的 keyup 修復分開：可信 pointerdown 已被認出是播放器操作，缺失的是進度拖曳命中範圍，而非鍵盤派送時序或新的使用者修訂。

## 身分及測試邊界

- 只使用使用者指定的 [風景影片 BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/)，由網站 Auto 選擇畫質，這一缺陷窗口為 2 倍速；沒有切換影片、鎖画質、修改 Chrome 設定或停用其他腳本。
- `identity-v2.1.15.json` 保存完整 Release 執行 body 匹配、singletonCount=1。公開腳本 317,487 bytes，SHA-256 `affedbeef854462c60fd5fd68947fc4c37ef7ddb7bd2922e72fed6cca6b342bf`。
- 使用真正原生可信 pointer 輸入；觀察列的 `trusted=true`。沒有替換媒體 getter、PlayerMonitor、RecoveryController 或頁面播放器來製造安裝版證據。
- 故障攔截在手勢前已安裝，精確分類當前 Vault 的 video Request，audio 通行。受控 request ID 的學習寫入過濾跨窗口保留，不清除使用者的既有學習資料。
- 觀察器只讀取有界純值。派送尾端記錄 event target class、`recognized`、控制快照及媒體狀態；`recognized=false` 是對既有拖曳 selector 的讀回，不是攔截或改寫網站事件。

`BR08-geometry.json`保存真實DOM矩形：progress-area與wrap皆10px高，內層progress只有4px高，三者同起點y=432、寬1030px。這解釋wrapper自身仍有可命中的下方區域，並非點在播放器外。`drag-ownership-initial.json`另保存真實outer drag的down／move期間媒體持續播放，到mouseup才尋位305.587378秒，證明這個區域的正常預覽／提交邊界；單靠矩形不推論任何click handler內部設計。

現場重跑入口：保持Auto及實際播放，先安裝當前video的精確故障攔截，用一次內層完整click建立尋位停滯；讀取當時矩形，指標落在wrap內且inner範圍外，再真實按下、移動且不釋放，持續完整捕捉至第一個合資格15秒tick；保存pointerdown／既有媒體目標／dragging／路線動作，再釋放並清理。正常對照用相同程序建立初始停滯，後續拖曳另命中inner。座標隨頁面layout重新讀取，不固定使用本次y值，也不把預覽或尋位變化當作播放進度。

## 實際安裝版事件順序

證據目錄：`.work/functional-fixes/br07/2026-10-10-9d98d09/installed/`。

| 事件／採樣 | Unix ms | 位置／影格 | 控制與有效前提 |
| --- | ---: | --- | --- |
| 初始內層完整click | 1791632083876／1791632083889 | 後續網站建立685.199029秒的初始停滯 | 可信inner pointerdown／up皆recognized=true；此click已釋放，與下面新的外層拖曳分開 |
| 外層可信 pointerdown／開始拖曳預覽 | 1791632084889 | 保持初始685.199029 秒／14363 frames，seeking=true | target=`bpx-player-progress-wrap bpx-state-active`，recognized=false、dragging=false、userRevision=32、core8／media1；不宣稱此down再次提交685 |
| 備援前最近採樣 | 1791632099943 | 685.699029 秒／14363 frames，seeking=true | core8，paused=false、ended=false、mediaError=false，dragging=false，generation1／epoch0 |
| 一次 video route-fallback | **1791632099968** | 距 pointerdown **15.079 秒** | decision-1513、recovery-12；尚未收到後續 pointerup |
| 備援後最近採樣 | 1791632100193 | 685.699029 秒／14363 frames，seeking=true | 同 core8／media1，paused=false；仍 Auto2倍、真正前景 |
| 最後有效定期採樣 | 1791632103943 | 685.699029 秒／14363 frames | 仍 core8、paused=false、seeking=true |
| 首個保存的外部換核心／暫停快照 | 1791632103987 | 0 秒／0 frames，paused=true | latest 快照 core9、coreReloadRevision=0；在備援之後，不能作為先前備援的原因 |
| 外層可信 pointerup | 1791632104047 | 網站後續目標變化另列 | 距 pointerdown19.158秒；該時才釋放手勢，target仍為wrapper，recognized=false |

網站將目標由685.199029調整到685.699029，影格保持14363且仍seeking，因此這0.5秒的尋位調整不算實際播放進度。備援前後皆為原生 hidden=false、Runtime visible=true、Auto=true／2倍；沒有因背景、pause、error或先前換核心撤銷這段窗口。

`BR08-wrapper-held-before-release.json` 保存83個定期採樣及109個事件，observer dropped=false；62個連續Network batches未截斷。`BR08-wrapper-up.json` 另保存真正pointerup，沒有把清理時的人工作業當作網站自然釋放。該窗口的 script reloadCount=2已達既有總額；19秒後網站又自行換核心並暫停，所以**不得把本次窗口補算成真實30秒reload或重載後完整15秒退出**。

## 正常對照與因果複核

`BR08-inner-normal-control.json`：可信pointerdown落在 `.bpx-player-progress-schedule`，recognized=true／dragging=true；真pointerup後dragging=false，網站完成正常尋位。此為正常手勢辨識對照，單獨不宣稱15秒故障時限通過。

另以相同Auto2倍及video-only故障類型，使用當時有效的新core／表示完成 `BR08-inner-held-fault-control.json` 與 `BR08-inner-held-fault-up.json`：

- 同樣先完成一次內層click建立2962.868932秒的初始停滯，再於1791632248554以可信pointerdown開始inner拖曳；recognized=true、userRevision=34、dragging=true，不將既有媒體目標誤說為這次down的新提交。
- 持續按住至1791632264942的最後定期採樣，已過 **16.388秒**，仍dragging=true、paused=false／seeking=true、core9／media1、generation1／epoch0、真正前景、影片影格停在14776；沒有route-action或core action。
- 1791632265104真正pointerup後dragging=false，最新目標1634.228155另列；並非沿用外層案例的舊位置。
- 此正常故障對照有72採樣、80事件，dropped=false；58個Network batches未截斷。外層與內層並非同一核心／表示的複製快照，而是前後各自有有效身分的實際網站操作。

根代理執行現場輸入，另一代理唯讀複核原始JSON、時間、前提與來源。外層備援在有效且未釋放的手勢內；內層同類等待可保持dragging並抑制救援。後續外部core替換不能推翻已發生的契約違反。

## 根因與精確位置

1. [player.ts:80](../src-v2/adapters/player.ts#L80) 在document捕捉可信播放器區域pointerdown，會清除鍵盤候選並增加userRevision，這部分正常。
2. [player.ts:84](../src-v2/adapters/player.ts#L84) 的dragging判定只查：

   ```ts
   event.target.closest('.bpx-player-progress, .bilibili-player-video-progress, [role="slider"]')
   ```

   真正功能性外層 `.bpx-player-progress-wrap` 本身不在selector中；`closest()`只走自己及祖先，不往下找內層子節點，因此外層命中會得到false。已辨識的內層子節點則正常。
3. [player-monitor.ts:103](../src-v2/application/player-monitor.ts#L103) 以 `!controls.dragging` 作停滯資格；漏辨後 [player-monitor.ts:167](../src-v2/application/player-monitor.ts#L167) 建立起點，[player-monitor.ts:180](../src-v2/application/player-monitor.ts#L180) 到15秒，再由 [player-monitor.ts:192](../src-v2/application/player-monitor.ts#L192) 備援。這是現場15.079秒後果的因果路徑。
4. [recovery-controller.ts:165](../src-v2/application/recovery-controller.ts#L165) 在有效stall達30秒時可重載；私有完整Adapter／Monitor／Recovery模型證明漏辨也能進入該後果，現場未形成必要窗口。
5. [player.ts:86](../src-v2/adapters/player.ts#L86) 已有pointerup／pointercancel／lostpointercapture／blur釋放，不需要把所有pointer操作當成進度拖曳。修復仍須維持範圍、可信輸入與釋放所有權。

## 獨立正確契約與重跑

私有目錄：`.work/functional-fixes/br07/2026-10-10-9d98d09/installed/review-br08/`；未加入正式套件登記，正式來源唯讀。

```powershell
node .work/functional-fixes/br07/2026-10-10-9d98d09/installed/review-br08/run.mjs
node node_modules/typescript/bin/tsc --project .work/functional-fixes/br07/2026-10-10-9d98d09/installed/review-br08/tsconfig.json
```

保存的未修來源結果：**7案，3 fail／4 pass，exit 1；skipped／todo／cancelled皆0**。斷言表達正確行為，不以斷言錯誤結果存在代替失敗契約。

| 案例 | 正確預期／本輪結果 |
| --- | --- |
| `BR-08 wrapper hitbox trusted pointerdown owns the active progress drag` | 應dragging=true；實際false，fail |
| `BR-08 wrapper drag held for 15000 ms must not issue video fallback` | 應fallback0；實際1，fail |
| `BR-08 wrapper drag held for 30000 ms must not reload the core` | 應reload0；實際1，fail；這一項僅模型 |
| inner descendant持續31秒 | dragging=true、fallback／reload皆0，pass |
| inner pointercancel後新寬限 | 14,999ms不備援、15,000ms一次，pass |
| 合成wrapper pointerdown | 不取得可信操作所有權，pass |
| 播放器外可信pointerdown | 不取得播放器所有權，pass |

`node-pre-fix-metadata.json` 保存Node26.8.1、基準提交、前後來源SHA-256完全一致。模型使用真正PlayerAdapter／PlayerMonitor／RecoveryController、FakeClock及testScope；Node的isTrusted替身和合成媒體只作因果契約，不冒充Chrome原生輸入。私有型別檢查由根代理另記；未實際再跑的正式全套不標新通過。

## 清理、資料及限制

外層 `BR08-wrapper-up.json` 保存heldRequests=0、patternsCleared=true、100 owned IDs的memory／persisted匹配皆0。內層 `BR08-inner-held-fault-up.json` 保存heldRequests=0、patternsCleared=true、累積107 IDs兩者仍0；先前ID資格未清空，以保護晚到結果。SDK候選另有 `sdk-cleanup-readback.json` 證明自有adapter／SDK包裝與API均已不在，與本次pointer觀察分開。

`final-cleanup.json`於1791632442312完成最後清理讀回：107 IDs清理前後memory／persisted匹配皆0，heldRequests=0、patternsCleared=true；queryObjects未找到活owned XHR metadata。observerAbsent／pointerApiAbsent／sdkApiAbsent、sendRestored／evidenceRecordRestored皆true，ownedIframes=0，Network／Debugger／Runtime皆已停用。沒有用來源iframe清理或單輪故障釋放替代這份最後證據。

最終對帳讀取全部19份保存observer JSON，包括partial及正常外層拖曳初查，但不把這些補充窗口提升為合資格故障驗收。107 IDs中有98個request-started、96個transport-completed（93abort／3success）；11個缺completion保存，其中9個亦無start，包含原四個歷史缺口。這是保守收集／觀察窗口的事件對帳限制，不宣稱107個都有完整終止事件，也不因缺少記錄推論仍有活請求。最後空的live XHR讀回不能重建歷史事件。重算入口為私有`installed/pending-owned.mjs`與`pending-owned-summary.json`。

更晚的 `tail-before-BR08-inner-fault.json`及`final-observer-before-cleanup.json` Network有截斷，只提供後續自然播放狀態與對帳輔助，不作重載時限或完整傳輸矩陣證據；不影響先前已完整捕捉的15秒缺陷窗口。最後清理時為Auto2倍，實際1979.879978秒／35714frames、ready4、非paused／seeking。`final-handoff.json`交還頁面為Auto1倍、paused、2042.773843秒、own iframe0；畫面保存於`final-Auto-landscape.png`，不把交還時的暫停算成測試失敗。

額外工具清理：真正載入的SDK驗收helper為較早草稿，雖已移除自有包裝，語意恢復時留下值等於prototype原方法的adapter自有reload影子屬性。`sdk-inherited-descriptor-cleanup.json`於1791632695695保存只在own value仍精確等於prototype原方法且SDK API已不存在時移除自有shadow，結果hasOwnReload=false／reloadEqualsPrototype=true／sdkApiAbsent=true；Runtime再次停用。此為自有驗收工具的descriptor清理，不是產品缺陷，不回寫較早cleanup讀回。

本輪已確認的是外層拖曳誤觸備援及適配器狀態缺失。Auto1倍外層重跑、pointercancel／失去捕捉的真實手勢、30秒核心重載後果與完整15秒退出仍未由此完成。原87.785秒自然網路起因、真正hidden、晚到SDK完成／拒絕及其他BR-01剩餘矩陣維持各自待項。

## 最小修正方向與必要回歸

先校準網站實際功能性進度命中範圍，讓可信pointerdown命中wrapper自身時，也能取得拖曳所有權。不得用「播放器任意按下都拖曳」擴大範圍，亦不得改成所有seekRevision都延長期限。保存手勢所有權，真正pointerup／pointercancel／失去捕捉／blur／生命週期失效時釋放；新手勢與舊釋放交錯須避免撤銷錯誤所有者。

先移植本輪正確失敗契約，再補wrapper／inner／子節點、合成與播放器外輸入、按住跨15／30秒、移出命中區、取消／捕捉釋放及reset回歸。拖曳期間不建立救援；釋放後以最新目標建立新15／30秒期限，腳本自身還原和鍵盤派送修訂維持原所有權。

Chrome修复驗收只用指定風景片，Auto1／2倍分開，以精確video-only故障重跑外層與內層對照，完整保存可信按下／釋放、最新目標、動作次數、音訊通行、學習過濾及清理。未有有效前提的完整30／15窗口仍誠實標待驗收。本輪不擴修、不再升版或發布；後續修復另依批准範圍執行。
