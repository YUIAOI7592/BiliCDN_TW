# BiliCDN_TW v2.1.17 Chrome 驗證與安裝驗收

**最後判定：BR-01整體不通過，本輪判定完成。** 見 [最終通過／不通過矩陣](BR01_v2.1.17_FINAL_ACCEPTANCE.md)：Auto2完整15／30／重載後15秒退出與不重試通過；Auto1完整期限、晚到SDK、真正背景／gate及其餘不通過項目均明列原因。以下保留來源隔離、發布與較早安裝窗口的日期／原始限制，不沿用其未定狀態作本輪結論。

日期：2026-10-11；修復基準 v2.1.16／`1e376978c757c0a1e622668fd04fdaad658dc7ef`。本文件分開保存來源隔離、真實 SDK 校準與新版 Tampermonkey 驗收。v2.1.17 已於 00:31:14（Asia/Taipei）正式發布，唯一腳本 **332,575 bytes**；公開 latest 的版本與 SHA-256 `4bb4601a91e5e752595a5a8ec1b4d8905036954f299d578ca93209c059ce6a06` 一致。00:32:42.615 仍是 v2.1.16 的觀察保留；使用者更新後，00:34:48.957 已核對 v2.1.17 完整執行本體匹配及唯一 Runtime／ControlCenter。新版驗收開始，既有版本結果不計入新版通過。

修復因果與正式契約見 [BR-01 後續修復報告](BR01_FOLLOWTHROUGH_FIX_REPORT.md)，整合與發行見 [驗證報告](TEST_REPORT.md)。網站只使用 [指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 1／2 倍分開，不改網站 ABR、Chrome 設定或其他腳本。

## 最後來源隔離：22 個有效案例通過

使用本機自有 iframe 中的真正 PlayerAdapter、PlayerMonitor、RecoveryController；媒體與時鐘是合成資料及 FakeClock，路線資格是受控模型。沒有安裝 singleton、GM 寫入、CDN 探測或網站媒體 getter 修改。原生 Chrome 輸入的可信性與控制器模型時間分列。

| 場景 | 1 倍模型 | 2 倍模型 | 證據邊界 |
| --- | --- | --- | --- |
| 14,999／15,000、29,999／30,000、重載後 14,999／15,000 ms | 通過 | 通過 | 各一次備援／重載，完整逾時後釋放，再三 tick 不重試 |
| SDK 新 seek 與兩次進度跨觀察租期 | 通過 | 通過 | 977 保留；不回寫978；兩個有效採樣才 recovered，沒有重複備援 |
| 政策、模擬 hidden、reset 失效 | 三案通過 | 三案通過 | 零過期 seek／rate／play；模擬 hidden 不等於網站真背景 |
| 首個合法核心後再次外部替換 | 通過 | 通過 | 第一核心先合法採用，第二核心撤銷舊動作 |
| 真正 BODY Space | 通過 | 通過 | trusted=true，新 userRevision 一次，舊 token 結束，零過期還原 |
| 真正 BODY 倍速變更 | ArrowUp 通過 | ArrowDown 通過 | 1→2／2→1 的實際改變各取得一次修訂 |
| 真正 BODY ArrowRight 新 seek | 通過 | 通過 | 新目標5，只有網站方法的一次 seek，舊還原不回寫 |
| 輸入框可信 Space | 通過 | 通過 | userRevision 不變，沒有網站播放操作 |
| 可信進度指標按住／放開 | 通過 | 通過 | 按住31秒是 FakeClock 時間；零救援，放開後新15秒邊界成立 |

前四列合計12個控制器模型案例，後五列10個真正輸入案例，總計 **22／22**。首輪發現的重複 fallback 與跨租期誤撤銷保留原失敗，補正式契約後以上述最後來源重跑。`final-matrix` 的初次 `owner-replace` 是第一個合法核心，不能當外部替換失敗；排除該校準，以獨立 `final-second-core` 取得第二核心證據。

執行 bundle SHA-256：`6c8d1caca5c0c1d23a406c5ec54b1dada4ddecde7b66106b8b05593cd938536e`；原生 Debugger 取得的完整本體與本機 bundle 一致，唯一來源。這是來源隔離 bundle，不是發布使用者腳本的校驗值。最後 `timers=0`、自有 root 移除、分頁關閉、本機 helper 停止；網站不留來源模型。

## v2.1.16 SDK 校準：不計新版自動救援

Auto 1／2 倍手動呼叫實際 Adapter.reload，均觀察返回前同步 native pause、null 核心，約300ms新核心、約1秒初始化整秒 seek、約2秒網站 play。BODY 可信 Space 的實際 paused 改變沒有舊版 userRevision。這些窗口沒有建立 Recovery token 或故障攔截，只校準 SDK 方法；2倍首批 Network 截斷保留，1倍獨立15秒窗口完整。清理方法完整描述子與包裝所有權，計時器／XHR觀察器／持有請求均零。

重新連線後另核對 v2.1.16 完整執行本體匹配、唯一 ControlCenter／Runtime；指定影片 Auto 2、正常暫停、native前景。這只是發布前裝置基準。

## v2.1.17 安裝矩陣：已載入，部分取得證據

| 場景 | 當前狀態／通過條件 |
| --- | --- |
| 完整版本／singleton／hooks 身分 | 通過；00:34:48.957 完整 IIFE 329,134 字元逐字匹配 Release 執行本體，唯一 Runtime／ControlCenter 各1，當前 hooks 與本版身分一致；字元數不是腳本 bytes |
| 正常 Auto 1／2 倍 | 基本子集通過；播放、BODY Space 暫停／恢復、左右短 seek，取得時間及影格進度；Auto 仍由網站選擇，未鎖畫質 |
| 實際自有 SDK 重載後恢復 | 兩倍速均已觀察直接鏈：腳本 reload→同步 pause／null→首次有標記新核心→SDK seek→rate／play→實際進度→recovered；以下列出窗口限制，不能算完整停滯矩陣 |
| 12 秒 video-only 延遲 | 待驗收；Auto1 首次座標操作沒有產生 seek，第二次進度 locator 超時；兩次均作廢，不以正常播放或後續救援補算 |
| 完整15／30／重載後15 | 待驗收；原 Auto2 故障窗口先由網站 pause／外部換核心撤銷；後段實際自有重載恢復不能回填原窗口。尚無完整無進度後failed／釋放、再三tick不重試的現場證據 |
| BODY pause／rate／seek、拖曳／pointercancel／近0 | 正常 BODY pause／resume／短 seek 已觀察修訂；故障／重載中新命令、拖曳及近0的完整安裝矩陣仍待。位置0與網站正規化值須分列 |
| 延後SDK完成／拒絕、外部核心 | 待驗收；真正方法已呼叫，只控制自有回傳邊界；不復活token或回寫舊位置 |
| 真正背景 | 待驗收；原生hidden=true且Runtime visible=false，不以被覆寫visibilityState作證據 |
| 生命週期／政策／影音隔離 | 待驗收；既有操作精確復原，audio不能建立影片核心意圖 |
| BR-02～05相關實際hooks／內容／gate | 原歷史子集分列；新版剩餘自然前提待成立，不重設控制器／startup預算製造前提 |

### 實際 SDK 恢復的可追溯事件

- **Auto2，00:45:06.017 自有重載。** 同步 pause／null 後，約288ms取得 `core5`／reload標記1；SDK 把最新位置設為1516，約1秒腳本還原2倍速並呼叫play，00:45:11.016以進度確認 `core-3 recovered`、reloadCount1。沒有 Adapter.seek，未把原保存的1516.967991回寫。此段在原攔截釋放後發生，Network紀錄已結束，僅確認實際安裝控制器與SDK恢復鏈。
- **Auto1，00:51:00.017 自有重載。** 同步 pause／null 後，約296ms取得 `core7`／reload標記2；SDK 設最新位置1836，seek修訂22→23、user修訂10不變。00:51:01.016／.017還原1倍速並play，後續時間1836.490667→1836.741333、影格106→113繼續增加，00:51:04.015 `core-5 recovered`、reloadCount2。沒有 Adapter.seek，未回寫1836.172853。此段是作廢進度點擊前提的後續；觀察器舊歷史曾滾動淘汰，Network曾截斷，僅採直接保留的恢復子集。

原 Auto2 故障窗口共135筆攔截：22筆當時有效video被持有、35筆video通行、27筆audio通行、51筆未知／非當前身分通行。雖該批沒有截斷，事件處理有22.479／21.768秒空隙；時間為消費時刻，身分也在消費時比對當時Vault，不能宣稱所有Auto video連續被延遲。Auto1批有76.071秒處理空隙及一次截斷，不能證明精確12秒故障或完整期限。兩個封閉較早Auto2觀察器紀錄沒有歷史淘汰；最終長時滾動讀回有 `everDropped=true`，不補算已缺失事件，也不倒推早期完整子集失效。

故障前攔截限定video，audio通行；單一 Fetch／Network游標完整捕捉且無截斷／丟失才計完整時序。此次真正 startup 狀態為 `preflight-skipped:xhr-explicit-timeout`，未產生合資格 pending gate，不修改網站timeout或重設預算製造前提。受控request／startup／challenge的學習抑制保留至晚到結果收束：最後2027個已分類request ID，在記憶體／持久樣本均零匹配、未知量測0、四個抑制包裝仍擁有所有權；startup／challenge實際分類數為0。這只證明已分類ID，不能證明歷史故障覆蓋完整。

### 清理與續行

00:56:37.356 清理12項包裝完整描述子，全部仍有所有權且還原成功；自有遮蔽移除、計時器清除、XHR觀察器0、持有請求0、攔截patterns空、觀察器錯誤0。清理後第一次檢查誤讀 `deps.runtime` 產生TypeError，原紀錄保留；00:57:30.601獨立正確檢查證明觀察器入口已移除，generation1／epoch0，網站Auto1、readyState4、paused=false，時間2225.34持續播放。最終風景畫面另存私有證據，控制列隱藏，Auto／倍速由DOM讀回證明。

本生命週期重載額度已用2次，不能藉修改控制器或breaker重測。續行須以同一指定影片真正重新載入建立新生命週期，先取得完整身分及新游標，校準實際seek後才開始故障；完整窗口需持續處理事件，若網站先pause／error／外部換核心即列撤銷，不能重複相同前提補算。真正背景與pending gate仍須自然前提成立。網站提前 error／外部換核心只證明撤銷，自己的SDK正常paused過渡依本版所有權條件判定。

原87.785秒自然網路起因、Auto位置跳變及其餘完整產品驗收保持獨立。本輪私有新證據：`.work/functional-fixes/br01-followthrough/2026-10-10-1e37697/`；歷史 [v2.1.16驗收](CHROME_v2.1.16_ACCEPTANCE.md) 與 Release快照不改寫。

<a name="2026-10-11-續測與-br-09"></a>

## 2026-10-11 續測與 BR-09

本節是前述窗口之後的獨立續測，基準 main `7ad32efb6fba09300f61c333812642efc6acb6f5`，開始時工作目錄乾淨。01:12:30.917（Asia/Taipei）再次核對完整 v2.1.17 IIFE 329,134 字元與 Release 逐字匹配，唯一 Runtime／ControlCenter 各1、開始時重載0。只使用指定風景影片，Auto 1／2 倍分開；沒有修改執行期、正式測試、版本、Release 或 Chrome 設定。

**續測確認 BR-09，依「找到問題並詳細報告」分支結束本輪；BR-01 完整安裝驗收仍未完成。** [BR-09 詳細報告](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md)記錄未初始化原生媒體的新目標歸零漏撤銷舊位置還原，包含正確失敗契約、原生 Chrome 邊界、完整來源隔離、正常對照及最小修正方向。網站安裝 singleton 尚未取得同一完整因果重現，不能把第一個網站位置回退直接歸因於此缺口。

| 續測項目 | 有效結果與限制 |
| --- | --- |
| Auto2 約12秒 video-only 延遲 | 有效新 seek；audio 通行，釋放後時間及影格增加，腳本 reload0。一次合法 video fallback 及網站自行換核心／解析度分列；窗口沒有 Network 截斷或觀察器丟失 |
| Auto1 約12秒 video-only 延遲 | 播放中延遲及 Auto 降解析度後有實際進度、audio 通行、reload0；進度 locator 未提交新 seek，不能算長 seek 通過 |
| Auto1 可信進度拖曳 | 約30秒 dragging 保護期間無新監控備援／核心動作；工具單次 hold 上限30,000ms，不宣稱31秒。第一窗有前置事件處理空隙與網站換核心，不能當完整期限或回退因果證據 |
| 拖曳正常對照 | 短拖曳保留3228附近新目標；另一完整30秒拖曳觀察保留1790附近目標，後段自有重載／進度分列，不回填缺少的完整故障時序 |
| BR-09 Node 獨立契約 | 正確斷言 **2 fail／3 pass，exit1**；非零且無後續 seeking 的交錯是模型條件，不代表正常 Chrome metadata 必然漏事件 |
| BR-09 Chrome 原生完整來源隔離 | 自有 iframe 中使用真正 PlayerAdapter／Recovery 及原生 Blob 媒體，SDK／核心／時鐘為模型。歸零目標被舊0.25覆寫：**1個失敗／3個正常對照通過**；非零 metadata、公開歸零及未改目標對照均成立，不計網站安裝矩陣 |

本輪仍沒有完整15／30／重載後15秒無進度失敗、釋放後三tick不重試的安裝窗口。帶 token 的新操作、pointercancel／近0、晚到 SDK 完成／拒絕與外部核心、真正 hidden、生命週期／政策／影音隔離及新版 BR-02～05 hooks／自然 pending startup gate 仍待驗收。網站5秒 XHR timeout 導致 startup skipped，沒有修改 timeout 或重設控制器／起播預算製造前提；本生命週期兩次重載額度也不手動重設。

01:39左右清理全部自有攔截及觀察器：held0、patterns空、12個觀察描述子及1個位置讀取描述子還原，繼承方法遮蔽移除，timer／liveXHR0。43個已分類受控 request IDs 在記憶體／持久樣本均零匹配，startup／challenge分類0、未分類量測0；僅證明已分類身分沒有污染。長時間最終觀察有 dropped／everDropped，不能補齊歷史，較早封閉窗口各自保留其完整性。

後續原生 Blob 來源隔離只使用自有 iframe，全部媒體、Blob URL、監聽器與模型計時器清理；沒有替換網站媒體 getter 或控制器。最後仍是指定風景影片 Auto1、readyState4、正常時間進度，另存畫面。原始結果、重跑入口及檢查點位於 `.work/browser-acceptance/br01/2026-10-11-7ad32ef/`。原87.785秒自然網路起因獨立未定，BR-09未修復；本輪不發布新版本。

## 2026-10-11 最後二元判定

使用者要求本輪所有項目給通過或不通過；[獨立最終報告](BR01_v2.1.17_FINAL_ACCEPTANCE.md)保存固定矩陣、完整Auto2因果與Auto1失效窗口，不再用未定狀態延長這輪測試。新證據獨立保存於 `.work/browser-acceptance/br01/2026-10-11-7ad32ef-final/`，未覆寫上述原始紀錄。首次座標誤選影片的窗口全部作廢，返回指定影片後重新核對本體／singleton；這個操作錯誤與有效後續證據分列。

Auto2有效主窗最大Network消費間距244ms、無截斷／觀察丟失：15秒一次video備援，30秒一次實際Adapter.reload，重載後15秒`reload-timeout`／isRecovering=false，再5.940秒沒有重試。Auto1兩個窗口分別因網站提前pause／外部核心及無當前授權request／held0而不通過完整期限。真正背景原生hidden仍false，startup为顯式XHR timeout跳過；這些子項不通過，但不直接認定新產品缺陷。

正常Auto1 BODY暫停／恢復／短seek與停用／啟用子集、新版安裝XHR／NativeXhr的8／8 Blob對照通過；不擴大為故障中token、影音故障隔離或真正gate驗收。全部6項包裝按所有權還原，timer／訂閱／攔截清理、held0／patterns空、觀察器移除，123個已分類受控ID記憶體／持久匹配均0。最後指定影片Auto1正常進度後暫停，兩個自有分頁均關閉。正式來源／測試／Release不變；BR-09未修，**BR-01整體不通過**。
