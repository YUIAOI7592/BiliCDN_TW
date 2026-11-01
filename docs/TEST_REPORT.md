# BiliCDN_TW v2.2.5 安全吞吐、需求餘裕與樣本時效修復驗證

日期：2026-11-01（Asia/Taipei）。起點為乾淨 `main／32dbf26b2852cd6a918059c0e2b0068c79b31e4a`、v2.2.4。容量投影與路線回歸提交 `258d9a2`；倍率／UI 與補充契約提交 `d02c75f`。本版採離線驗證後發布，安裝版結果另行記錄。

## 修復結果與證據邊界

四組離線反例為冷啟動排名固定缺值、播放器備援排名空白、舊排名的需求比例不隨倍率改變，以及過期速度仍從排名顯示。修復後安全吞吐由目前有效影片計畫主機的 video 證據即時計算；原排名、決策物件、親和與控制需求政策保留。需求按當前已確認碼率與實際倍率計算，缺少任一資料即保留缺值；有效速度獨立顯示。計算與時效的唯一規則來源見 [架構指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/ARCHITECTURE.md#控制中心資料流)。

本次沒有改選路、授權、傳輸提交或生命週期控制分支；新增容量投影只讀既有狀態並在身分變動時捨棄結果。每次完整快照仍只讀一次，使用原一秒監控刷新；詳細文字仍按需建立。沒有增加探測、輪詢、訂閱、持久資料、診斷或歷程收集。Native 預設及既有布林值、schema 2、四個儲存鍵、樣本算法／容量、量測與恢復額度、兩筆成功影片的確認門檻保持，無遷移。

測試中的 1 MiB／200 ms 與 41.94304 Mbps 是合成傳輸資料，不能當成實機測速。v2.2.4 R1 的六項基本驗收原文及結果完整保留；它沒有涵蓋成功學習後數字更新、倍率需求數值與樣本過期，後續判讀補充位於 [歷史全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-完整正文保存2026-11-01)。不回寫原 PASS／FAIL／INVALID，也不宣稱使用者原截圖的完整觸發因果已重現。

## 自動驗證

固定 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。命令已檢查不啟動網站服務；verify 的封裝檢查只用暫存位置。基線 **18 套件／1,634 案全部通過**；按套件與完整展開名稱逐項對照，原案例全部保留。新增路線 20 案、UI 21 案，最終 **18 套件／1,675 案全部通過**，failed／cancelled／skipped／todo 均為零。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | 通過 |
| imports | 1 | 通過 |
| domain-boundaries | 3 | 通過 |
| domain | 11 | 通過 |
| state | 35 | 通過 |
| application | 588 | 通過 |
| adapters | 210 | 通過 |
| native-routing | 13 | 通過 |
| native-transport | 167 | 通過 |
| orchestration | 40 | 通過 |
| adapter-boundaries | 65 | 通過 |
| measurement-state | 94 | 通過 |
| progressive-playurl | 29 | 通過 |
| progressive-routing | 71 | 通過 |
| progressive-transport | 4 | 通過 |
| playurl-summary | 22 | 通過 |
| control-center | 84 | 通過 |
| tooling | 197 | 通過 |

### 新增回歸與保留契約

| 範圍 | 驗證內容 |
| --- | --- |
| 真實 EvidenceStore／RouteCoordinator | 冷啟動、播放器備援及起播空排名，選中主機不在十二筆投影排名內仍讀到速度；一般傳輸、起播與健康量測只在合法提交後生效 |
| 時效與隔離 | TTL 前、恰好 TTL、後一毫秒、混合樣本衰減、全部過期及重新學習；音訊／其他主機隔離，清除與遠端更新；讀取不刪持久資料 |
| 所有權 | 停用、black／dead、Catalog 禁用、政策、generation、epoch、Vault 授權更新與同步重入捨棄舊容量；讀取不清計畫、不改 Session／親和、不發事件或寫入；失敗保存與舊工作不能形成當前容量 |
| 真實讀模型與 Node UI | 兩筆完成後下一次既有 tick 顯示速度；4 Mbps、1→2 倍需求 5→10 Mbps、餘裕減半；表示更換遵守原確認門檻；三頁切換／重開、遠端學習／清除及真換片 |
| 缺值與數值邊界 | 碼率／倍率缺失、零、負數、非有限、溢位／下溢與播放器不可用；有效速度獨立顯示；合法低碼率仍使用 2 Mbps 下限；快照各身分欄位不一致時不顯示另一計畫容量 |
| 刷新副作用 | 按需詳細文字不隨 tick 重建，下次要求取得新模型；倍率刷新不增事件、寫入、計時器或播放器命令；原單次完整快照、非同步設定失敗／鎖等待／晚到畫面與資源清理契約保持 |

執行期修改前，第一批路線 17 案均在缺少 currentCapacity 的舊版失敗；UI 實作前保留了冷啟動、備援、倍率／表示、過期與冷卻提示的失敗結果。排名裁切、量測來源與其他補充案例另於實作後加入，沒有宣稱它們全部完成紅綠循環。既有數值格式案例改注入新容量投影與明確碼率／倍率，保留名稱及有效速度、缺值、非有限數和無假需求的行為斷言。

原 Native／Catalog／固定／禁止／停用、影音隔離、過期授權、同步重入、取消、晚到工作、影片備援恢復、位置／倍速與額度契約均由完整套件回歸。TTL 的長時間測試停止假播放器週期 tick 以隔離時鐘，不冒稱 24 小時連續實機播放。

型別、架構（92 個執行期模組、無循環）、完整測試、格式、文件、封存、verify 與差異檢查均通過。verify 再執行全套 1,675 案，核對兩次建置一致、語法、撤除功能禁止標記與暫存封裝 checksum。文件初檢的版本欄位與 Markdown 空行問題已修正；未放寬檢查或案例斷言。基線、失敗回歸、最終案例、逐項對照與 verify 日誌保存於本機忽略的 `.work/v225/`，不作正式執行輸入。

## 安全差異

逐一核對本次執行期差異：RouteSnapshot 增加唯讀容量，RouteCoordinator 只在 snapshot 路徑呼叫既有政策與 Vault 讀取；UI 使用當次資料衍生數值及提示。沒有改動授權決策、請求送出／提交、取消、可信事件或生命週期控制。因此依本版批准的風險規則，不觸發 Codex Security 差異掃描；不將此寫成安全掃描通過。完整傳輸與授權契約仍由離線套件驗證，正式 bundle 另外檢查已撤除功能標記。

## 公開交付與安裝結案

v2.2.4 五份 Release 原件已核對既有 checksum、保護雜湊與逐位元組相等，移至 `archive/retired/releases/Release/v2.2.4/`；搬移清單舊版另存不可變快照。上一版完整 TEST_REPORT 含 R1 已原樣追加至歷史正文，三份日誌保留全部既有位元組前綴。

本版全部離線門檻已通過，建置腳本為 **424,558 bytes**，SHA-256：**c2ce2bad31c766e4c40236a1919b133f8272c9d33511e796f6803ba8d3f0f87f**。本段為封裝前檢查點；正式封裝五項本機產物後，提交推送 main／v2.2.5 標籤並發布唯一腳本附件，公開核對另於發布完成後追加，不將尚未完成的遠端動作寫成通過。

### 來源隔離與實際安裝

本次未啟動瀏覽器、安裝或更新腳本、來源隔離、故障注入或新播放窗口。v2.2.5 安裝版數值更新尚未驗證，須後續另行授權並記錄；不恢復已結束窗口，不將離線契約或公開附件核對當成實機 PASS。

<a name="v224-r1-安裝驗收2026-11-01"></a>

此相容入口導向 [v2.2.4 完整正文與 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-完整正文保存2026-11-01)，不是本版新增安裝驗收。

<a name="v223-r1-安裝驗收2026-11-01"></a>

此相容入口見 [v2.2.3 完整正文及 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-完整正文保存2026-11-01)，不是本版新增安裝驗收。

<a name="清除結果與零殘留範圍"></a>
<a name="全文閱讀覆蓋清單"></a>

這兩個舊入口導向 [v2.2.2 零殘留全文清查與逐檔 SHA-256](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v222-完整正文保存2026-11-01)。本版執行變更差異與契約核對，沒有將舊版 211 檔全文清查冒稱為本版重新全文閱讀。

## 歷史驗證導覽

[歷史索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)；[v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修復與根因"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="發布與安裝限制"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修後唯一-hk04-定向窗口"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-30up141-安裝版實測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31更新後安裝核對"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31補測與單分頁重測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="v220-安裝驗收-r12026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="澄清後在原期限內續行"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="auto-2-倍補充與本次驗收結案"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="公開交付"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。
