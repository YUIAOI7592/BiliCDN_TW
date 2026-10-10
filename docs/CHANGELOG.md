<a name="bilicdn_tw-changelog"></a>

# BiliCDN_TW 變更紀錄

> v2.1.16 已發布，BR-08 完整拖曳契約修復、必要驗證與公開產物核對完成；實際新版完整本體／singleton／hooks 已核對，Auto 1／2 倍拖曳、基本播放與約 12 秒 video-only 延遲後恢復已有部分證據，BR-01 完整安裝驗收仍未完成。舊條目保留其當時狀態。現行行為與證據見 [使用指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/README.md)、[驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md) 及 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)。

## v2.1.16

2026-10-10 **21:05:38（Asia/Taipei）** [發布 v2.1.16](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.16)，基準 v2.1.15／`f0c2d39`，發行提交／peeled tag `ff0cb07063032aeb49a9e52ccc630685bec46cf8`，annotated tag `0dc8c0590ad3a63282c029fdc0d2e3ab56c1bbbe`；遠端 main 在發布時匹配。唯一腳本 **320,794 bytes**，SHA-256 `5eaeb8444503886244b06f81cb24a81081720a0ea5dcb978c284c776eb05e8d4`；21:06:11.073 無登入公開 latest 的版本、大小與校驗值匹配。**BR-08 修復與發布完成**；21:07:51 的實際 v2.1.15 觀察保留，21:11:07.331 指定影片已核對 v2.1.16 完整本體、singleton 1 及 hooks，開始取得新版安裝證據。修復／案例對照見 [BR-08 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR08_FIX_REPORT.md)，來源隔離與實際新版結果分列於 [v2.1.16 驗收紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.16_ACCEPTANCE.md)；[v2.1.15 原缺陷](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 與歷史 Release 保留原樣。

- 補入目前播放器區域內的 `.bpx-player-progress-wrap` 命中，沿用既有 inner／舊版／slider；可信進度按下即取得拖曳保護，涵蓋未提交 seek 的預覽。單一手勢綁定 pointerId、媒體、播放器及內容生命週期，同指標可信結束事件才能釋放；新手勢、同步重入及舊終止事件維持所有權。
- VisibilityAdapter 在既有可信失焦／真正 hidden guard 前通知內部 control-loss，入口明確注入並清理訂閱；監聽器例外不破壞原 guard。reset、媒體／播放器替換及生命週期失效撤銷手勢，不新增拖曳 timeout 或 pointer capture。
- Monitor 的停滯／watchdog／冷起播三個入口均排除 dragging，清除舊停滯與連續計數而不消耗起播嘗試。Recovery 在讀取保存值前後核對 controls，提交前重查資格、生命週期／操作／媒體／核心、既有 token、breaker 與重載額度；晚到 reload／play 的所有權防護保留。
- 一般停滯於釋放後第一個合資格 tick 建立新 15／30 秒期限，位置 0 有效；未進展冷起播仍依原 firstMediaAt 與既有一次性預算評估，可能釋放後立即救援。Auto／ABR、15／30／15、影音隔離、Vault／政策規則、公開 API／應用層快照及 schema 2 不變。
- 原七個正確契約先保存 **3 fail／4 pass**，修復後通過；全套 **637 正式案例**、typecheck、architecture、verify **v2.1.16** 與 diff 檢查通過。獨立 Codex Security 最終差異 **14／14 完整覆蓋、0 可報告發現**；Chrome 來源隔離 **31 個有效案例通過**，兩個無效校準窗口排除，清理完成。
- **實際新版安裝驗收部分完成**：指定風景影片 Auto 1／2 倍的 wrapper／inner 四個超過 32 秒拖曳窗口均有保護與釋放證據、腳本重載 0；正常播放／暫停／短 seek 與約 12 秒 video-only 延遲後的實際時間／影格恢復取得證據。延遲兩窗各在無進度達 15 秒後提交一次合法路線備援，audio 通行、核心重載 0、受控學習樣本 0。2 倍的後續 recovered 獨立觀察與前窗有缺口，未計連續時序；釋放後網站提前暫停／換核心只證明撤銷，完整 15／30／15、操作／晚到 SDK／真正背景與交叉回歸矩陣仍待完成。來源隔離及 Node 契約不能替代安裝版，原 87.785 秒自然網路起因及其餘完整產品驗收保持獨立。

## v2.1.15

2026-10-10 **18:57:18（Asia/Taipei）** [發布 v2.1.15](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.15)，基準 v2.1.14／9d98d09，發行提交／peeled tag `3f7c73335a58dd89d4bc8a4209b7ecf3c70acaf8`。唯一腳本 **317,487 bytes**，SHA-256 `affedbeef854462c60fd5fd68947fc4c37ef7ddb7bd2922e72fed6cca6b342bf`；18:57:38 無登入公開 latest 核對匹配。BR-07 修復與發布完成，實際完整新版 body／singleton 1 已於 19:04:00 核對，安裝結果分列。交付見 [BR-07 修復](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR07_FIX_REPORT.md)，原 [缺陷報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 保留。

- 同時捕捉可信 keydown／keyup，各自建立同派送候選；每派送實際新 seek 更新一次使用者修訂，同派送多入口去重，repeat 或 keyup 各自新尋位各自計數。
- 冒泡確認與清理使用實際事件種類；重入與舊 timeout 維持候選所有權，派送後工作不能取得身分。不引入按住狀態、延遲窗口或新的公開 API／持久欄位。
- 原五契約先保存 2 fail／3 pass→修復後 5／5；BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構與最終 verify **v2.1.15** 通過，Chrome 來源隔離 **40／40 有效案例**通過；獨立安全差異完整覆蓋，**0 可報告發現、無未處理候選**。新版實際安裝驗收分列待完成，Release 快照保留封裝時狀態。
- Auto、15／30／15、腳本還原來源抑制、影音隔離、Vault 授權及 schema 2 不變；[新版安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_ACCEPTANCE.md) 與來源隔離分列。
- 發布後 Auto 1／2 倍正常鍵盤及新 15 秒寬限通過；約 12 秒 video-only 釋放後有進度、各一次備援而無核心重載。2 倍達 30 秒一次重載，其後 paused，完整 15 秒退出仍待驗收。續測新增 **[BR-08 外層進度拖曳漏辨](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)**：按住期間 15.079 秒誤觸備援，尚未修復；私有七契約 3 fail／4 pass 與正式 574 分列。本輪只補報告，不改已發布來源／產物。

## v2.1.14

2026-10-10 15:55:30（Asia/Taipei）已發布，基準 v2.1.13／45a4420，發行提交／標籤 `056d1a4a9607ed8e96dda45880ec4f82522230a2`。唯一腳本 317,276 bytes，SHA-256 `fc2a38d182fd94b3c2ffc786510e858f99f41d702ed279a6c88da7edc0d6c02a`，公開 latest 與實際安裝本體已核對。見 [BR-06 交付](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR06_FIX_REPORT.md)。發布後調查確認 [BR-07](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_BR07_KEYUP_SEEK.md)：原策略漏掉網站右鍵 keyup，尚未修復；封裝快照保留發布準備當時狀態。

- BODY／頁面可信 seek 鍵只在同一 keydown 派送內實際尋位時取得一次新使用者身分與完整寬限；不使用 250 ms 窗口。
- 排除 editable／控制中心／IME／修飾鍵／合成／忽略命令／延後工作及腳本還原；候選綁定生命週期／媒體／播放器，私有參照、計時器與 listener 確實清理。
- 原 2 fail／3 pass 保留，新增 40 正式契約，全套 514／verify 通過；独立安全差異 7 檔、0 可報告發現，Chrome 來源隔離 15／15，安裝矩陣分列。
- Auto、15／30／15、影音隔離、BR-02～05、Vault 授權、schema 2、公開設定與更新 URL 保持原契約。

## v2.1.13

2026-10-10 13:07（Asia/Taipei）已發布，修復 BR-01 A／B／C；基準 c924b0216fe0a8f7a624f391d44b36660daca433，來源／標籤 fc2b3b5ed58e307d8c87e2326769cfa8a390cf46。唯一腳本 314,188 bytes，SHA-256 646515874ea4088b11830907826c5d1275f823c155a5fb1523999a9755ffa816，公開 latest 與實際載入 body 核對一致。安裝版部分結果及待完成矩陣見 [驗收紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.13_ACCEPTANCE.md)；封裝快照保留發布準備當時狀態。見 [BR-01 交付](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_FIX_REPORT.md)。

- Auto 長 seek／活核心停滯：15 秒最多一次合法 video 備援，30 秒最多一次核心重載，重載後 15 秒無進度確實退出；網站重試與表示切換不延長同段期限。
- 新使用者操作、drag／pause／hidden／失效撤銷舊還原；最新位置包含 0，操作前重查 Vault／政策／核心／媒體身分。音訊備援仍不建立影片恢復。
- 首次採樣、seek 跳躍或尺寸不代表恢復，兩個連續實際播放進度採樣才 recovered；正常 Auto 降畫質不受干預。既有死核心／冷起播／長暫停與起播 gate 預算保留。
- 新增 26 正式契約，全套 474 與 verify 通過；獨立 Codex Security 17 檔完整覆蓋、0 可報告發現，來源隔離 22／22。安裝版與原 87.785 秒自然網路原因仍單獨列明，schema 2／依賴／公開設定／更新 URL 不變。

## v2.1.12

2026-10-10 04:24:04（Asia/Taipei），從 `cdbb10b3e9ce8f56485dd427dd38d10e848ba005` [發布 v2.1.12](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.12)，04:24:40 公開 latest 核對版本、大小與 SHA-256。交付與驗證見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR04_BR05_FIX_REPORT.md) 與 [現行驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md)。

- XHR 保存原生 readyState getter；內部準備最多兩次，每個同步邊界重查所有權與最新合法目標。gate continuation 例外確實終止，已送出請求不重播。
- 原生 send 尚未接受的例外清除 pending 歸因，不建立 CDN 失敗樣本；直接 send 保留同步原例外。
- 起播 gate 取消使用 signal.reason，保留 Error、物件及 falsy 原值；其他 Fetch／XHR waiter 與每分頁預算不受單一取消影響。
- 新增 66 個正式案例，全套 448 個。真正 Chrome 來源隔離 36／36；BR-02／03 對照各 31／31。發布後實際新版 Tampermonkey 35／35 共用 gate 矩陣及同片基本回歸通過；作廢輪與資料清理限制見 [安裝版紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.12_ACCEPTANCE.md)。
- 產物 298,785 bytes，SHA-256 c3874efbf718a3eebcc64cf2591d1a328d7ddde1aac40b7d91faf593f7c6e28d。schema 2、依賴、公開設定與更新 URL 不變；BR-01 不在此輪修復。

## v2.1.11

2026-10-10 01:52（Asia/Taipei），從提交 `d3d1bc3185d51b62891920135b4126441e059696` [發布 v2.1.11](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.11)，修復 BR-03；01:53 公開 latest 下載的版本、大小與 SHA-256 已核對。修復前後契約、安全與 Chrome 來源隔離見 [BR-03 報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)，發布讀回見 [本版驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md)。

- 以所屬 playurl 請求的唯一、有效 cid 優先識別內容；相同 cid 的清單排列或完全不同畫質／編碼組仍保留 epoch，不同 cid 即使共用路徑也同步撤銷舊工作。
- 缺少 cid 時，以順序無關的完整父目錄集合備援；影片／音訊分開、容量為 128／64，保留重疊歷史並確定性淘汰。無 cid 也無共同路徑時保守重設。
- Fetch／XHR 保存請求建立時的 cid；failed open、同步重入及重複 getter 保持所有權，低信任提示不能污染內容基準。cid 不授權 Native、不進入持久資料或診斷；schema 2 不變。
- 新增 43 個正式案例，全套 382 個；獨立 Codex Security 完整覆蓋 14 個來源／測試檔，0 個可報告發現。真實 Chrome 來源隔離 BR-03 31／31、BR-02 31／31 通過，Tampermonkey 修復版待驗收。
- AGENTS 記錄使用者的持續授權：修復及必要驗證完成後，自主提交、升版、推送及發布可供腳本更新的 Release；發布後核對公開下載。當次明確限定工作範圍仍優先。
- BR-01 停滯、真正 startup gate 交錯與 R04 完整安裝版驗收保持獨立；GitHub Release 僅附使用者腳本，舊 Release 不覆寫。
- 使用者腳本為 296,341 bytes，SHA-256 `9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`；已通過 v2.1.11 的 typecheck、architecture、382 案例及完整 verify。

## v2.1.10

2026-10-09，依使用者授權從提交 `49995fbc29ee638739487b3a27aa5c4a662a8741` [發布 v2.1.10](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.10)，修復 BR-02 XHR `open()` 例外安全性。原始調查、修復前後契約與真實 Chrome 隔離證據見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR02_FIX_REPORT.md)，發行與更新狀態見 [v2.1.10 歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2110-release-verification--2026-10-09)。

- 參數先依原生順序轉換一次，候選 metadata 暫存後才呼叫原生 open；成功才釋放舊請求，失敗保留原所有權與例外。
- 同步事件中的 send／abort／再次 open 遵守最新所有權；failed open 不再吞終止事件、倒退虛擬 DONE 或錯誤允許第二次 send。
- Chrome 同步選項錯誤造成 UNSENT 時，只重新準備尚未送出的 waiting 請求，重查政策並保留選項／headers；已送出請求不重播。
- 新增 40 個正式契約，全套 339 個案例；BR-02 安全差異審查完整覆蓋兩個來源／測試檔，沒有可報告的新安全發現。
- 真實 Chrome 來源隔離驗證 31／31 通過；Tampermonkey 修復版及指定風景影片的播放／暫停／seek 回歸仍待更新後驗收。BR-01 停滯原因保持獨立待定位。
- schema 2、持久資料、依賴及更新 URL 保持不變；不改寫舊 Release。
- typecheck、architecture、339 案例與完整 verify 通過。使用者腳本為 293,972 bytes，SHA-256 `f30464996ee9da7e3b655e029746693e3db1c8b547ea70ed44a794d00a04acf8`；GitHub Release 只附此腳本。

## v2.1.9

2026-10-09 從提交 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7` [發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.9)功能與競態修復，共 17 項；逐項來源與回歸契約見 [修復對照報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/FUNCTIONAL_FIX_REPORT.md)，發布讀回與驗證範圍見 [v2.1.9 驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v219-release-verification--2026-10-09)。

- 內容切換同步撤銷舊量測、監控及恢復工作；seek、首次採樣與晚到 play 結果遵守動作所有權，音訊備援不建立影片重載意圖。
- MP4／FLV 可信來源刷新時撤銷過期授權；正規化內容鍵、固定主機優先與政策版本檢查避免舊請求重新控制路線。
- 每次執行使用隨機樣本 ID 前綴，量測取得鎖後重查安全條件；schema 2、持久鍵及舊樣本相容性保持不變。
- XHR 送出前重查政策，隔離等待、送出及終止狀態，修復取消／重用、文字／JSON 回應與同步 setter 相容性。
- Catalog 單節點設定在鎖內合併；控制中心過期回呼不能重開視窗或覆蓋新頁面。
- 型別、架構、299 個具名測試案例及完整 verify 通過；獨立 Codex Security 差異審查完整覆蓋 41 個變更來源檔、0 項可回報發現。Chrome／Tampermonkey 新差異尚未實測。
- 使用者腳本為 292,728 bytes，SHA-256 `051066c36a2e90aa19507671de75483667beb9757502b54f44522e4390b07f55`；GitHub Release 只上傳此腳本，更新 URL 維持原位。

## v2.1.8

2026-10-04 [發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.8) MP4／FLV 修正，GitHub Release 附件只有使用者腳本。自動驗證、安全審閱、標準 Tampermonkey 更新及授權的 MP4 試片／公開 DASH 回歸已完成；詳細證據、安全報告的 `partial coverage`、較早 DASH 緩衝及完整公開 MP4／FLV 覆蓋限制見 [v2.1.8 驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。下列 Catalog 指內建節點清單，Native 指原生簽名路線。

- 在 DASH 之外接納已辨識的 MP4／FLV `durl` 容器，保留分段順序與中繼資料。必要漸進式輸出先全部規劃才寫回 URL；漸進式／混合輸出失敗時原子拒絕，不提供部分改寫的分段清單。
- 透過當前 Vault 的不透明識別碼取得各漸進式分段的安全 Catalog 來源；主來源不可改寫時，可使用同段安全備用來源。保留 Native 來源授權、歸因及限制。
- 保留全部 11 個 Catalog 內建主機，其中 4 個預設不可用。起播探測最多三個並行候選，共用三秒窗口；其餘合法 Catalog 候選仍參與排名、備援及後續健康探索。僅使用 Catalog 的播放器輸出最多五個不同主機的備援。
- 僅使用 Catalog 的起播沒有有效量測時，不提交測速贏家，由最終送出對完整剩餘合法池排名。保留安全的當前 DASH 查詢字串處理，區分可改寫 PCDN 來源能力與 Native 可選資格。
- 固定主機、Catalog 覆寫設定或原生來源設定變更後，失效計畫並重設量測／恢復，避免等待中的探測覆蓋新固定主機。
- 將布林值形式的 playurl 接納結果改為型別化結果。Fetch／XHR 檢查 `accepted`；嚴格 Fetch 拒絕維持 HTTP 503，XHR 保留原生 HTTP 狀態。顯示一筆有界的最近格式／數量／`code`／原因摘要，不包含原始回應本文、簽名 URL 或例外文字。
- 新增漸進式 playurl／選路／傳輸及安全摘要契約套件。自動／安全證據集中於 TEST_REPORT；Chrome／Tampermonkey 回歸依序在發布及標準更新後完成。已批准的 v2.1.6 驗收維持結案。
- 從標籤提交 `b6e2ff11ef53ce3a338cc197c90edecdf0bb2b60` 發布 v2.1.8，保留較早 Release 產物。使用者腳本（使用者腳本）為 285,037 bytes，SHA-256 `c2bda1e0be4b086e7622e34d3fba0a6cdfdd5eb612afea700289758112c9eb4f`。

## v2.1.7

- 將應用層協調、瀏覽器導覽／排程／播放意圖介面、playurl 登記、量測中繼資料、路線／輸出政策、Fetch／XHR 攔截及有界 Range 探測拆成明確模組。
- 設定結構與預設值、內建 Catalog 清單、Native 來源選用開關、原線對照、介面能力及診斷欄位語意維持與 v2.1.6 相容。
- 防止已釋放的生命週期觀察器及量測鎖重設前的等待者提交舊工作；探測已預先取消或中途打斷時清理讀取器，不產生有效量測結果。
- 將行為測試拆為獨立套件，新增抽象語法樹（AST）的依賴／權責與匯入純度檢查，強化唯讀快照及型別化測試情境。
- 在暫存目錄驗證封裝校驗值，不覆寫既有發行版。未新增執行期依賴、遠端程式碼、Worker 攔截或 CI/CD。
- 保留已完成的 v2.1.6 Chrome 驗收。v2.1.7 自動驗證與來源安全審閱證據分開記錄；安全報告保留已說明的過時覆蓋標記。

## v2.1.6

- 新增持久化開關，決定正常選路是否考慮 Bilibili 提供的 Native 來源；既有及新建 v2 設定均預設關閉。每分頁的原線對照模式仍維持獨立。
- 預設正常模式只提供、探測及送出安全產生的內建 Catalog 路線。無法產生允許的 Catalog 路線時，在送出前阻擋媒體請求，不退回 Bilibili 提供的原始或備用 URL。
- 精確簽名 URL 保存在當前內容週期的 Vault，供歸因及明確使用這些 URL 的模式使用。保留主機限制、腳本停用時的直通及已送出的網站請求。
- 有界的來源追溯索引已滿時，省略關閉 Native 來源後無法辨識的外部播放器備援。
- 未新增 Catalog 主機、執行期依賴、遠端程式碼或歷史修補附件。

## v2.1.5

- 區分選定備援、已送出請求、符合條件的影片資料，以及與該路線接手一致的播放進展。仍在切換備援當時既有緩衝內的進展標為未確認；另一影片主機成功時產生混合證據。
- 新增有界的播放器時間軸，以及各次備援的成功、失敗、中止與逾時證據。逾時與中止分開；核心恢復標為播放器進展，不視為 CDN 確認。
- 顯示所選路線的保守速度與需求的關係，保留既有決策原因、路線選擇、CDN 清單、探測預算及重載門檻。
- 落實記憶體內 128 KiB、匯出 96 KiB 的診斷上限；報告大幅截短時仍保留事故觸發原因及最近備援摘要。診斷不新增簽名媒體 URL 或查詢字串。
- 完成來源層契約及安全差異審閱。真實 Chrome／Tampermonkey 故障重現安排在安裝此更新後進行。

## v2.1.4

- 啟用時只正規化 Fetch 請求一次，主機檢查及原生送出均使用同一個 `Request`，包含等待起播或單頁應用（SPA）世代變更之後。過時世代的請求送出前仍檢查當前主機限制。
- 同一媒體表示的可信 playurl 資料到達時，取代信任較低的頁面／播放器 Native 候選。撤銷舊不透明識別碼、計畫、無效主機標記，以及延遲探測／證據的授權；內建 Catalog 資格不變。
- 拒絕主動量測重新導向；起播及健康探測必須取得獲准主機直接回傳的 206 Range 回應。保留既有窗口、位元組上限、冷卻及播放備援行為。
- 依變更風險使用 Codex Security，不一律禁止或要求每次發行都使用。本版執行安全差異掃描，並針對全部三項發現進行驗證。

## v2.1.3

- 以易懂的繁體中文改寫控制中心及播放器面板標籤。總覽說明播放、所選 CDN、腳本實際觀察的請求／回應主機、歸因、備援及量測，主要介面不以內部狀態碼呈現。
- 說明每分頁原線對照模式只使用 Bilibili 提供的原始或備用 URL，不測速或自動切換，並於啟用後套用至新的播放。以使用者用語解釋設定、停用的操作及診斷報告。
- 保留報告原始技術資料供排查。路線、限制、播放、探測、恢復、儲存及網路行為均未改變；v2.1.2 保持原貌。

## v2.1.2

- 以有界的原始／輸出主機、主／備援角色、來源及決策 ID 中繼資料，連結 playurl 輸出與後續媒體請求。沒有可辨識媒體路徑的精確簽名 URL 仍僅供觀察，但保留此主機層追溯關係；簽名 URL 不進入診斷。
- Catalog 403 在後續排名、備援組裝及健康挑戰選取中，只表示當前串流／主機配對不相容。不因單一相容性回應而全域懲罰該 CDN。
- 分別追蹤合法備援的已規劃、已進入攔截、已觀察回應或請求失敗狀態。後續狀態必須關聯同一決策及請求；無關的同主機請求不能確認備援。沒有合法不同路線時清除較早備援，不將其顯示為當前備援。
- 新增每分頁原始簽名 URL 對照模式供排查。不產生合成 CDN URL、主動探測或腳本自動路線／核心恢復；既有黑名單、失效及預設限制仍適用。禁止的主來源可提升自身合法簽名備援。完整重新載入會退出此模式。
- CDN 清單、評分公式、播放速率行為及探測上限不變。未執行 Code Security 掃描，未產生歷史修補檔案。

## v2.1.1

- 播放器監控或介面啟動前先安裝並驗證 Fetch／XHR 攔截；部分安裝失敗時，回復該次已安裝的攔截並回報狀態。
- 即使路徑缺少已知媒體副檔名，仍辨識當前內容週期的精確簽名媒體 URL。這些不透明 URL 僅供觀察，不合成改寫、不作 Native 選取、不產生健康樣本或主動探測。
- 送出前重新檢查已辨識的 GET 及非 GET 媒體主機。非 GET 請求保留原 URL，但不能直接送至黑名單、失效或停用主機；XHR 在設定變更或起播等待後於 `send()` 重新檢查。
- playurl 輸出保留合法的不透明簽名主來源及備用 URL，移除禁止的來源。Fetch 的 `Request` 輸入及 XHR 逾時／中止／重用行為仍由契約涵蓋。
- 分別回報攔截安裝、媒體辨識、原生呼叫及回應階段。明確的 XHR 逾時標為略過預檢，不代表略過攔截；只有 Chrome 開發者工具的網路面板（Network）能確認實際瀏覽器請求。
- 保留 CDN 清單、排名、播放速度、編解碼器偏好及恢復策略。未執行 Code Security 掃描，未產生歷史修補檔案。

## v2.1.0

- 首個可歸因的播放器媒體 Fetch 或非同步 XHR 共用一個最長三秒的冷起播預檢閘門。以有界 Range 讀取，並行探測最多三條不同且合法的精確簽名或 Catalog 路線；窗口未得結論時放行合法原線或替代路線。
- 此影片產生的 URL 取得 16 KiB 相容性回應後，才重用近期跨分頁 Catalog 吞吐量。完整起播樣本寫入既有證據儲存元件；單靠探測永不開啟持久主機斷路器。
- 防止無法歸因的首個媒體請求盲選第一個 Catalog。保留精確簽名備援，包括 Catalog 主機上的備援；永不送出黑名單預檢候選。
- 15 秒後偵測沒有進展、沒有緩衝的初始停滯，最多提交一次合法不同主機備援，不懲罰原來源。播放器仍停滯時，既有 `RecoveryController` 可重載核心一次；實際恢復仍須新的媒體證據。
- 將每輪單一健康挑戰者改為最多三個依序且公平的候選，沿用跨分頁十分鐘冷卻。無效及 HTTP 4xx 嘗試有界，後續輪次略過；健康探索永不切換播放主機。
- 保留使用者選定的播放速度、v2 儲存、CDN 清單、媒體種類隔離及嚴格限制。未執行 Code Security 掃描。自動結果與更新後 Chrome 驗收分開記錄。

## v2.0.4

- PCDN 標記、直播、資源及特殊連接埠媒體 URL 直通前，先套用黑名單、失效、Catalog 停用及預設不可用限制。未受限制的特殊媒體保持原狀；禁止主機無法安全改寫時於本機阻擋。
- 媒體尚未確認所屬媒體表示時，同時依影片及音訊限制篩選候選與送出主機，不預設為影片。即使 XHR 在腳本停用時開啟，仍於 `send()` 重新檢查。
- 控制中心主機黑名單同時涵蓋影片及音訊。先前已儲存、由使用者建立的僅影片黑名單列，載入後套用同一有效範圍；其他按種類的限制保留其範圍與期限。
- 在 Catalog 啟用開關旁顯示作用中的黑名單／失效懲罰。保留設定、證據、路線排名、播放速率及量測預算；未變更 Worker 攔截或新增主動網路工作。
- 來源層 Fetch／XHR、playurl 及控制器契約通過。這些適配器以外由瀏覽器發起的請求，以及送出後重新導向，無法追溯阻擋；針對性 Chrome 驗收安排在安裝後。未執行 Code Security 掃描。

## v2.0.3

- 首次使用某影片畫質時，依該群組自身能力解析已觀察的影片親和主機，不復活其冷起播計畫。
- 保留精確 Native URL、明確播放器備援、既有請求群組恢復、固定 CDN 及主機限制。未新增探測或中止懲罰。
- 健康的短暫恢復播放後，清除過時的暫停待命診斷；不增加恢復權杖或重載。
- 保留已發布的 v2.0.2。來源層重現通過；針對性 Chrome 驗收安排在使用者安裝後。歷史黑畫面原因仍未確認。

## v2.0.2

- 從播放器主／備援輸出篩除禁止主機，包含受阻根來源、無效 Native 路線及主機鎖定還原。主動挑戰者重用限制檢查。
- 當前內容週期的 Vault 追蹤有界的精確輸出角色。播放器請求合法備援時給予明確協調的備援決策，不改寫回主來源；固定模式及影片／音訊隔離仍有效。
- 瀏覽器未提供回應 URL 時，`responseHost` 回報 `null`。保留送出目標的失敗歸因，並區分最近成功與最新中止。
- 以連續有效監控週期偵測持續未初始化的核心，自動擷取診斷證據，不將暫停狀態視為重載授權。
- 第一個符合條件的暫停監控週期即安裝臨時播放觀察器；保留既有可信長暫停啟動及單次恢復限制。
- 手動標記停滯時保留自動凍結的事故，分開計算滾動情境到期，並在主機旁顯示傳輸結果／狀態。
- 保留使用者選定的播放速率、v2 學習／設定、既有 CDN 清單及量測預算。未變更 Code Security 或 CI。
- Chrome 驗收安排在發布及使用者安裝後；本版不確立所有歷史黑畫面的原因。

## v2.0.1

- 送出時擷取不可變的請求情境，保留世代、內容週期、歸因及實際送出／回應主機，不依賴目前啟用的媒體表示。
- 合併穩定媒體表示群組與產生的 Catalog 別名；MPD 接納維持唯讀，證據更新時保留符合資格的已提交路線。
- 彙總成功傳輸、限制排名明細，並優先保留事故證據，不清空報告事件陣列。
- 保留播放器重載失敗原因，處理非同步重載／播放拒絕，不建立重試迴圈。
- 顯示近期請求／回應歸因；沒有合適影片觀察時，停用封鎖目前影片主機的操作。
- 移除每秒強制寫入 2x。尊重使用者播放速度；只在無法取得速率時以 2x 估算需求，核心恢復後還原已保存的速度。
- 保留 v2 設定及健康資料。未執行 Code Security 掃描，未產生歷史修補或變更 CI。
- 依使用者要求先發布，再作針對性 Chrome 驗收；真實瀏覽器結果仍待驗收，未宣稱通過。

## v2.0.0

- 以嚴格 TypeScript 重建執行期，明確分為領域、狀態、應用、適配器、使用者介面（UI）及診斷層。
- 以有界影片／音訊證據、保守吞吐量及按種類斷路器建立確定性的 Catalog／Native 排名，取代 v1 路由器。
- 新增單一安全挑戰者模型；起播不作主動量測，健康探索永不改變親和主機。
- 引入當前內容週期的不透明 Native 路線識別碼；完整簽名 URL 永不持久化或回報。
- 新增僅供 v2 使用的設定、限制、證據及協調儲存，採用 Web Locks 與 Tampermonkey 值變更同步。
- 以可追溯路線決策及恢復動作統一傳輸、Watchdog 與播放器核心恢復。
- 保留 2x 播放、AV1／HEVC 偏好、自動畫質、背景播放、WebRTC 阻擋、手動 HTTPDNS 政策、嚴格限制、控制中心及以失敗為主的事故紀錄。
- 移除 v1 儲存遷移、標頭設定、公開頁面 API、相容別名、AutoPilot HTTPDNS、多候選競速、延遲探測、舊測試情境及歷史修補產生功能。
- 官方支援限於當前 Chrome 與 Tampermonkey。
