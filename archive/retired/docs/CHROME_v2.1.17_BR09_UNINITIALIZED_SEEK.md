# BR-09：未初始化媒體的歸零目標漏撤銷舊位置還原

日期：**2026-10-11**。優先級 **P2**，功能／操作所有權缺陷，**未修復、未發布修補**。基準 `7ad32efb6fba09300f61c333812642efc6acb6f5`，正式版本 v2.1.17。本輪只調查及建立獨立契約，沒有修改執行期、正式測試登記、版本或 Release。

**已確認來源缺口及原生 Chrome 來源隔離中的實際舊位置覆寫；尚未取得網站安裝 singleton 同一完整因果的重現。** 不能把最初網站的 3152→2037 秒回退直接歸因為 BR-09，也不宣稱 BR-01 完整驗收完成。目標依「找到問題並詳細報告」條件收尾，下一輪需先修復此缺口，再續跑剩餘安裝矩陣。

## 使用者影響與觸發條件

合法自有重載尚持有保存位置時，網站內部直接更新未初始化媒體的目標，未經可觀察的公開 SDK seek。若新目標最後是 **0**，可能沒有後續原生 seeking 事件；腳本不知道還原位置已過期，核心就緒後仍 seek 回舊位置。使用者的新起點或 SDK 最新目標被覆寫，可能再次尋位或播放錯誤片段。

問題需要同一媒體／播放器／內容所有權仍有效、還原前的有限目標變更未經公開 SDK 方法或 seeking、且後續恢復資格仍成立。沒有新的目標變更時，原有保存位置還原仍是正常行為。這不是 CDN 授權繞過，也不是 Auto 降畫質缺陷；1／2 倍的時間政策不需因此改動。

## 原生邊界與既有防護

HTML 的 `currentTime` setter 在 `HAVE_NOTHING` 時保存預設起點，並不立即執行一般 seek；metadata 載入後，非零預設起點會再執行 seek，零起點則不需要此分支。這解釋為何正常非零目標可能被後續 seeking 防護捕捉，而歸零不能依賴它。[WHATWG 媒體規則](https://html.spec.whatwg.org/multipage/media.html#dom-media-currenttime)

真正 Chrome 無來源 video 的原生對照：`currentTime=978`，`readyState=0`、`seeking=false`，一個原生事件迴圈後 seeking／seeked 仍為空。現行 PlayerAdapter 的 seekRevision 仍是0，targetSec仍是null；再設0也未更新修訂。公開 SDK seek 與腳本自己的 pendingSeek 對照各保持原契約。這個對照在自有 iframe，沒有變更網站媒體 getter。

網站實際 SDK reader 已唯讀核對：readyState低於1或duration未知時使用 SDK 快取位置，其他情況才使用媒體 currentTime。不能把快取值當成新的媒體目標之證明。網站的內部 port seek 與媒體操作也不是必然經過公開 `window.player.seek`；安裝觀察中曾看到原生位置變化但公開 seek 修訂保持不變。

## 精確根因

- [PlayerAdapter.controls](../../../src-v2/adapters/player.ts#L103) 第110–113行，只在 `video.seeking` 為真才採樣有限目標並增加 seekRevision，漏掉 HAVE_NOTHING 的直接目標變更。
- [媒體及公開 seek 觀察](../../../src-v2/adapters/player.ts#L187) 第187–193、205–215行，另外依賴 seeking 事件及公開 SDK 包裝；內部直接寫入而沒有原生事件時，兩個入口也不會補上。
- [RecoveryController 所有權](../../../src-v2/application/recovery-controller.ts#L283) 第283–288行，僅 seekRevision 已改變時才設 `restorePosition=false`。修訂漏變，舊保存位置保留。
- [恢復副作用](../../../src-v2/application/recovery-controller.ts#L245) 第245–252行，合法核心就緒後依該旗標呼叫 PlayerAdapter.seek。既有 generation／epoch、授權、核心及使用者檢查均可成立，但沒有證明保存位置仍是最新目標。

既有防護有效的入口沒有被推翻：公開SDK seek、一般原生seeking、可信新userRevision及可觀察外部核心替換仍會撤銷。缺口是「有新目標、但沒有上述修訂／事件」，不是要把所有網站變動猜成新使用者操作。

## 最小確定性事件順序

1. 保存位置0.25，合法stall意圖依既有30秒門檻呼叫一次自有reload。
2. 同一原生媒體進入HAVE_NOTHING；SDK/core/FakeClock是自有模型，reload方法實際呼叫原生pause／load。
3. 內部直接將原生currentTime設為0.7，再改為0；每步都呼叫真正PlayerAdapter.controls，原生seeking仍false，seekRevision未增加。
4. 本地靜音WAV Blob載入metadata／data，真正原生currentTime為0；沒有歸零引發的seeking保護，第一個合法替換核心就緒。
5. 真正RecoveryController下一次tick仍呼叫seek(0.25)，原生媒體從0變成0.25。

**預期：** 舊位置還原失效，新的0保留；可在既有所有權有效時繼續有界倍速／播放恢復。**實際：** `actualSeeks=[0.25]`、`afterRestore=0.25`。這是完整來源隔離因果，SDK／核心／時鐘模型與真實原生媒體分列，沒有操作安裝 singleton 的私有token或重設預算。

## 正確契約與正常對照

| 證據 | 結果 | 邊界 |
| --- | --- | --- |
| Node PlayerAdapter→Recovery，未知目標變更、再歸零 | 原五案 **2 fail／3 pass**，exit1 | 使用FakeClock及型別完整媒體模型；失敗斷言要求不回寫舊位置 |
| Chrome原生HAVE_NOTHING＋現行Adapter | 兩項正確撤銷條件失敗，公開／內部來源對照通過 | 真原生媒體，SDK模型，不是網站安裝矩陣 |
| Chrome原生Blob完整恢復鏈：unknown-zero | **失敗**：0→0.25 | 原生metadata與seek事件未被替換 |
| 同鏈unknown-positive | 通過：保留0.7、零過期seek | 原生metadata的seeking捕捉新目標，既有防護成立 |
| 同鏈public-zero | 通過：保留0、零過期seek | 公開SDK包裝增加修訂，保護成立 |
| 同鏈unchanged | 通過：一次合法seek(0.25) | 沒有新目標，保留原有正常還原 |

Node非零案例安排「初始化完成、尚無seeking觀察」的控制器交錯，不代表正常Chrome metadata必然漏事件；Chrome非零正常對照已反證這種普遍化。已確定的原生覆寫以unknown-zero為主。原生完整鏈為 **1個正確契約失敗／3個正常對照通過**，不合併成全部測試通過。

## 同片安裝觀察與未確認回退

01:12:30.917（Asia/Taipei）重新核對完整v2.1.17 IIFE **329134字元**逐字匹配Release，唯一Runtime／ControlCenter各1；發布檔332575bytes，SHA-256 `4bb4601a91e5e752595a5a8ec1b4d8905036954f299d578ca93209c059ce6a06`。只使用[指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 1／2倍分開。

- Auto2的約12秒video-only窗口成立新unbuffered seek，audio通行，釋放後時間／影格恢復，腳本reload0；有一次符合15秒政策的video fallback及網站自行換核心／解析度。
- Auto1約12秒窗口成立播放中延遲，audio通行，Auto正常降至720P，進度持續、reload0；進度locator未提交seek，不能算長seek子項。
- Auto1可信進度長按約30秒保持dragging、沒有新route/core action；工具單次hold上限30000ms，不宣稱31秒。第一窗釋放後曾3152→2037；此前有工具上限錯誤、前置網路處理空隙及網站換核心，不能確認腳本導致回退。
- 正常短拖曳保留3228附近新目標，另一30秒拖曳保留1790附近目標；後续兩次實際自有恢復鏈分列，不補算原故障窗口完整15／30／post15。最終長滾動觀察有dropped／everDropped，不能補齊歷史。

因此，本次新缺陷的確證來自來源契約＋原生Chrome邊界／完整來源隔離；上述網站異常只提供追查線索。沒有把受控SDK／FakeClock當作安裝版完整故障證據。

## 重跑與原始證據

私有證據根目錄：`.work/browser-acceptance/br01/2026-10-11-7ad32ef/`。獨立入口：

```powershell
node .work/browser-acceptance/br01/2026-10-11-7ad32ef/run-br09.mjs
```

未修來源預期2 fail／3 pass、exit1。`br09-contracts.ts`、`br09-contract-results.txt`、`br09-native.ts`、`br09-native-media.json`、`br09-native-recovery.json`保存契約與結果；README有Chrome自有iframe重跑方式。初次Node strip-only loader不支援parameter property，以及兩次隔離回傳校準錯誤均不算產品失敗；有效入口使用本專案既有esbuild。

## 最小修正方向與必要回歸

適配器應有界保存未初始化媒體的目標觀察，識別有限位置變動，**先撤銷舊位置還原**；0有效，不依賴truthiness。來源不確定時不增加userRevision、不延長同段15／30期限，也不全面把正常播放時間增量當seek。區分自己的reload初始歸零、自己的pendingSeek與後續未知新目標；對SDK快取／媒體讀值不一致採保守撤銷，不能用舊快取恢復授權。

正式修復前移植失敗契約，加入真原生metadata後的非零正常對照、未知正值→0、首次歸零與自有reload基準、公開seek、自己的還原、目標交錯、媒體／核心替換、晚到Promise及1／2倍。維持既有副作用前資格重查、15／30／15、breaker、影音隔離與schema2。不得只移除所有位置還原來繞過正常對照。

## 清理與剩餘驗收

全部自有攔截解除：held0、patterns空；12個原觀察描述子＋1個位置讀取描述子還原，繼承方法自有遮蔽移除，timer／liveXHR0；自有iframe、video、Blob及監聽器清理。43個已分類受控request IDs的記憶體／持久學習樣本匹配0，startup／challenge受控工作0，未分類量測0；僅證明已分類身分沒有污染，不宣稱所有未知Auto路徑覆蓋。最後同片Auto1、readyState4、時間繼續前進。最終複核自有測試iframe為0，另有3個網站來源iframe；沒有刪除網站資源。

BR-01完整15／30／post15無進度退出與三tick不重試、帶動作的新seek／拖曳／pointercancel／近0、晚到SDK完成／拒絕及外部核心、真正hidden、生命週期／政策／audio隔離、BR-02～05新版實際hooks與自然pending startup gate仍待驗收。原87.785秒自然網路起因獨立未定。**BR-09未修前不宣稱完整BR-01結案。** 現行狀態見[TODO](../../../docs/TODO.md)、[安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md)及[最新版驗證](../../../docs/TEST_REPORT.md)。
