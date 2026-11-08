# BiliCDN_TW v2.2.13 完整驗證報告

日期：2026-11-08（Asia/Taipei）。乾淨 main 24021da／v2.2.12 凍結基準；各階段先建立失敗回歸，再修改執行期並獨立提交。

## 驗收結論

九項改善已完成，完整 2,261 案、verify 及三批安全封印均通過：限制保存／通知、Native 起播候選、重試替代站、可信 DASH 更新、共享到期再驗證、來源額度、有界解析及統一禁止原因。發布時採離線交付；使用者更新後另行授權的安裝結果見下列 R1，真正跨頁協作仍未執行。原提前重試六情境效用 FAIL、既有安裝判定及歷史限制保持。

後續依使用者縮減範圍完成 [R2 本版變更接線補驗](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#v2213-r2-本版變更接線補驗2026-11-08)：**受控補驗完成，安裝版可信清單再次刷新仍未驗證**。R1 一般選路、Native 接線及來源提升的既有通過證據沿用；固定主機操作 INVALID 保留於 [R1 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#v2213-r1-選路黑名單與來源驗收2026-11-08)，未修改的選單不再當成本版待補門檻。不把 N 層結果或自然條件缺席改寫成完整安裝版全部通過。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10。原十八套件／2,149 案先完整通過；其中包含 v2.2.12 發布時 2,140 案及後續文件工具九案，歷史數字不回寫。最終來源 61a4840 的十八套件／2,261 案完整通過，failed／cancelled／skipped／todo 均零；新增 112 案，唯一改名是正式來源政策映射，其餘名稱、kind 與參數展開完整保留。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 107 | PASS |
| state | 81 | PASS |
| application | 837 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 84 | PASS |
| measurement-state | 135 | PASS |
| progressive-playurl | 64 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 108 | PASS |
| tooling | 218 | PASS |

基線、每階段 red／green、完整輸出與具名案例對照保存在私有 .work/v2.2.13。未使用正式 GM 資料、外部瀏覽器或本機網站服務；封裝驗證只使用暫存位置。中途 orchestration 仍期待刪除 meta 鍵的一案失敗已保留，按新可確認清除政策修正後通過，不刪除案例。型別、103 模組架構、唯讀格式、文件、封存及差異檢查通過；最終 verify 再執行完整 2,261 案、兩次可重現建置、語法、退役標記與暫存封裝／校驗，全部通過。受審來源之後沒有變更。

## 九項閉環與政策映射

| 項目 | 實作與有效驗證 |
| --- | --- |
| ① 限制清除 | 鎖內讀取／保存／權威讀回；空 payload 實際 records 為空才確認。涵蓋保存拋錯但已成功、讀取失敗、不符及無鎖限制。 |
| ② 限制通知 | 通知只提示重讀，不依舊 payload 或牆鐘排序；本頁修訂防止同步重入的舊讀值覆寫。 |
| ③ Native 起播 | 首個備援被禁止、熔斷或不相容時繼續查找；僅成功接納後停止，不擴大 Native／三候選額度。 |
| ④ 重試替代 | 全部合格 Catalog 替代者按完整 eligible 條件評估，依含兩秒交接的耗時決勝；準備／認領只重驗選中站，資格變更不轉授。 |
| ⑤ DASH 刷新 | 普通與 unknown-primary 接納共用來源更新；相同 canonical 集合保留身分，換簽名／集合撤銷舊 handles、aliases 及 output roles。 |
| ⑥ 到期再驗證 | 只讀提案、共同鎖確認認領後提交；每個 host／kind 控制戳記共享一次，後續候選同流程、只首候選更新冷卻／游標，取消不退還。 |
| ⑦ 四來源 | 可信前 16 raw 位置、低信任前 4；最多接納 4 exact，primary 優先、可選 Native 優先及同類主機分散。空／非法／重複占 raw 位置，PCDN／opaque 不取得額外權限。 |
| ⑧ 有界解析 | 先核對陣列及影片 128／音訊 64 累積上限，再讀取成員欄位；超額拒絕維持原子性。 |
| ⑨ 禁止原因 | black → dead → catalog-disabled → default-unavailable → host-lock → circuit-open；排名與派送共用來源，仍在各提交邊界重查。 |

完整舊新案例名稱及預期映射見[測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v2213-選路限制與-native-來源)。原第五 raw 來源拒絕案例改為第十七位置，新增第十六／非法前置／同主機 query 等對照；meta 清除改為等待保存空 payload 及新協調世代。PCDN 前置使用獨立表示，避免可信刷新撤銷別案狀態；原有效斷言保持。

來源更新後已派送的網站請求不取消；晚到工作不得取得新親和、表示確認、重試或降級信用。Native 預設及既有布林、schema 2、四個儲存鍵、三頁／單次快照、正數 timeout 起播與提前重試排除、熔斷期限、W／G／C、影音隔離及恢復額度保持。

## 安全差異

Codex Security 三批不可變差異均完成逐檔覆蓋、正式封印及讀回；成立漏洞、未結安全候選與未審檔案均零。來源範圍連續覆蓋 24021da 至最終 61a4840；後續文件、版本及封裝沒有改動受審來源。

| 不可變差異 | 變更來源／測試檔 | 掃描 ID |
| --- | ---: | --- |
| 24021da..a12debd | 36 | 48d8f3e9-8072-495e-a1a0-679dd10b78cd |
| a12debd..835e596 | 9 | 9d127e65-9ea1-45d6-94ca-da378a514b40 |
| 835e596..61a4840 | 2 | ab26779b-fa56-4251-9e0d-1dd0a366ef3d |

首批保存完成草稿時誤將 surface ID 當作 deferred ID，工具拒絕寫入；其後過早封印也被拒絕，本輪當時停止，原錯誤保留。續行只修正登記、保留原模型與 surface ID，正式草稿接受後封印成功，沒有重建或替換原掃描。交叉審查指出的滿額退路、延遲控制快取及陣列 getter／非法 length 屬功能正確性缺口，先補 red／green，再以後兩批獨立封印銜接，沒有混入首批不可變結果。

工具記錄三批 model=gpt-6.1-sol、reasoningEffort=ultra；usage 來源 codex_rollout，coverage=complete。三批 totalTokens 分別 27,246,294／2,841,862／1,268,294；合計 inputTokens 31,281,795、cachedInputTokens 30,711,040、totalTokens 31,356,450。此為工具含快取及串接的記帳，不能當作獨立量得的純掃描增量或費用。安全產物保存於 Codex Security 各掃描的不可變目錄，不回寫舊安全結果。

## 來源隔離與實際安裝

發布階段只做離線契約、靜態安全、建置與公開交付核對，當時沒有啟動瀏覽器或更新安裝版。後續使用者自行更新並另行授權 R1；不重新開啟停止窗口或重測已通過的熔斷二十分鐘，自然通知交錯、真正跨頁協作及播放效益沒有因此通過。合作新版分頁的共享一次由真實 Store＋串行記憶體鎖契約支持，不冒稱 Tampermonkey 雙頁實測。

無共同鎖／權威讀取及保存未知／混版協定退回不得取得優先再驗證。普通探索仍須既有六小時門檻；標記滿額不得藉淘汰最舊資料重新發放機會。正常探測失敗不新增播放熔斷。

## 公開交付與安裝結案

v2.2.12 五份 Release 原件已核對 bytes／SHA-256，原樣搬至 archive/retired/releases/Release/v2.2.12；原搬移清單另保存不可變快照。上一版完整正文含 R1、研究入口、後續文件交付與限制已原樣追加歷史，三份日誌只追加。

五項正式產物已封裝、登記並核對；正式發行提交為 `626432a800b42b56478676716f6f526209953543`，發布時遠端 main 與 v2.2.13 標籤均指向此提交。後續公開核對以文件提交推送 main，標籤保持發行提交，不改寫 Release 快照。

2026-11-08 09:06:15 Asia/Taipei 完成獨立下載。[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.13) 非草稿／非預發行，只有 `BiliCDN_TW.user.js` 一個附件，亦為 GitHub latest。[版本附件](https://github.com/YUIAOI7592/BiliCDN_TW/releases/download/v2.2.13/BiliCDN_TW.user.js) 與[公開 latest](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) 均回傳 200、版本 2.2.13、532,263 bytes，逐 bytes 相同於正式產物；SHA-256 均為 `ab0c2b1ad1a80f3f9d042cad9f426fe3c7574d655629e194ee4f8f9d3affb706`，符合唯一附件 digest。舊 v2.2.12 標籤保持 `2798719546b73918aa92b993cfbdf01c1ceff2dc`。

原件、完整舊報告及三份日誌前綴已另做 SHA-256／bytes 核對。正式封裝後文件與封存檢查再通過，受審產品／測試／工具未變；公開交付時尚未安裝實測，後續 R1 另記，不將公開更新可取得寫成 Tampermonkey 已驗收。

## 歷史驗證導覽

[v2.2.12 完整正文、R1 及研究銜接](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2212-完整正文保存2026-11-08)；[各版本原始驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)；[研究與版本導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。歷史 PASS／FAIL／INVALID 及未執行保持，舊研究不是新測試授權。

<a name="v2211-r1-熔斷安裝驗收2026-11-06"></a>
<a name="v2211-r2-受控熔斷與安裝接線2026-11-06"></a>
<a name="公開交付核對2026-11-06"></a>
<a name="bilicdn_tw-v2210-完整驗證報告"></a>
<a name="模型與誤差界線"></a>
<a name="七步交付對照"></a>
<a name="固定合成對照與取捨"></a>
<a name="公開交付核對"></a>
<a name="bilicdn_tw-v229-完整驗證報告"></a>
<a name="bilicdn_tw-v228-正數-xhr-timeout-起播修復驗證"></a>
<a name="修復結果與證據邊界"></a>
<a name="失敗回歸與契約對照"></a>
<a name="bilicdn_tw-v227-選路容量與起播探索驗證"></a>
<a name="研究項目完成對照"></a>
<a name="政策映射與契約保留"></a>
<a name="固定合成模型對照"></a>
<a name="發布後公開核對2026-11-03"></a>
<a name="bilicdn_tw-v226-確定性選路狀態機與提交所有權驗證"></a>
<a name="驗證階段與證據範圍"></a>
<a name="三十五項閉環對照"></a>
<a name="來源隔離與實際安裝"></a>
<a name="公開交付與安裝結案"></a>
<a name="v226-r1-安裝驗收2026-11-02"></a>
<a name="v225-r1-安裝驗收2026-11-01"></a>
<a name="v224-r1-安裝驗收2026-11-01"></a>
<a name="v223-r1-安裝驗收2026-11-01"></a>
<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>
<a name="bilicdn_tw-v225-安全吞吐需求餘裕與樣本時效修復驗證"></a>
<a name="新增回歸與保留契約"></a>
<a name="發布後公開核對2026-11-01"></a>
<a name="核心案例與結果"></a>
<a name="倍率速度與播放窗口"></a>
<a name="節點準備與證據限制"></a>
<a name="工具與清理"></a>
<a name="清除結果與零殘留範圍"></a>
<a name="全文閱讀覆蓋清單"></a>
<a name="v221-r1-安裝驗收2026-11-01"></a>
<a name="隔離-b-分支原型驗證2026-10-30"></a>
<a name="修復與根因"></a>
<a name="發布與安裝限制"></a>
<a name="修後唯一-hk04-定向窗口"></a>
<a name="2026-10-30up141-安裝版實測"></a>
<a name="2026-10-31更新後安裝核對"></a>
<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>
<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>
<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>
<a name="2026-10-31補測與單分頁重測"></a>
<a name="2026-10-31一次授權的單分頁缺口補測"></a>
<a name="v220-安裝驗收-r12026-11-01"></a>
<a name="澄清後在原期限內續行"></a>
<a name="auto-2-倍補充與本次驗收結案"></a>
<a name="公開交付"></a>
<a name="v227-r1-基本安裝驗收2026-11-03"></a>
<a name="r1-結果與範圍"></a>
<a name="r1-數值來源與限制"></a>
<a name="r1-證據與清理"></a>
<a name="v227-xhr-timeout-起播分支調查2026-11-03"></a>
<a name="實際分支結果"></a>
<a name="原因與影響範圍"></a>
<a name="證據保存與工具限制"></a>
<a name="v228-r1-正數-timeout-專項2026-11-03"></a>
<a name="v228-r2-專項完成2026-11-0304"></a>
<a name="r2-窗口候選與證據"></a>
<a name="原生校準與工具限制"></a>
<a name="v2210-r4-正數-timeout-專項2026-11-05"></a>
<a name="v2210-r3-補驗2026-11-05"></a>
<a name="v2210-r1-安裝版驗收2026-11-05"></a>
<a name="v2210-r2-補驗能力確認2026-11-05"></a>
<a name="v2212-r1-三頁與刷新專項2026-11-08"></a>

以上舊錨點保留相容入口；其原始正文見歷史驗證導覽。

## v2.2.13 R1 選路、黑名單與來源驗收（2026-11-08）

使用者自行更新後另行授權本輪，以乾淨 main bb4ca71／v2.2.13 為基準。主代理使用唯一 IAB 自有分頁，固定 BV1tFZZBQE57／P1／Auto／1 倍，沿網站保存位置播放，不重置預算、清除學習或改網站 timeout。保守 T0 為 10:26:30 Asia/Taipei，操作截止 10:51:30、總截止 10:56:30；10:48:06.158 已完成清理，跨度上界 1,296.158 秒。第一個清單呼叫沒有獨立精確時戳，T0 不作效能計時。

**本輪未全部通過：** 安裝層核心四個 PASS、一個 INVALID；指定固定站的 R1 因操作方法無效，兩個條件式實機分支證據不足。隔離記憶體五案通過，支持原計畫 B0／N1 兩個 N 層核心項目及 Native 契約；不代算安裝版黑名單增刪或全部可信清單更新。原 I／N 混合核心合計六 PASS／一 INVALID，清理完成不表示全部核心驗收通過，不自行補跑。

| 案例 | 層級 | 結果 | 實際證據與限制 |
| --- | --- | --- | --- |
| E0 完整身分 | I 核心 | PASS | Tampermonkey 5.5.1／2.2.13；當前包裝內完整本體 532,263 bytes、SHA-256 同正式附件。Runtime／ControlCenter／Transport 各一個，Fetch／XHR hooks installed。 |
| R0 一般選路 | I 核心 | PASS | Auto／1 倍、靜音讀值保持，操作讀值進度 2,098.33→2,339.75 秒，清理時 2,756.02 秒；影音有匹配的 HTTP 206 成功摘要。曾由 mirroralib 供影片、mirroraliov 供音訊，後續都走 mirroraliov；不宣稱固定時長無卡頓或效益。 |
| R1 模式與 Native 操作 | I 核心 | INVALID | Native false→true→false、保存及關閉重開子項通過；預定固定 mirroralib 未成立，鍵盤操作一度保存 mirroraliov，立即還原 Auto。此項不算產品 FAIL 或指定站 PASS。 |
| B0 黑名單增刪／排除 | N 核心 | PASS | 真實 RestrictionStore／Routes＋獨立記憶體，固定／自動／Native 均不能繞過黑名單；移除後可選，另一筆原限制保持，影片限制不誤傷同主機音訊。 |
| B1 安裝版限制 | I 條件式 | 證據不足 | 當前有效限制清單為空；UI 無單筆新增／刪除入口。沒有把合成限制寫進 GM，也不以整體清除學習製造案例。 |
| N0 Native 來源接線 | I 核心 | PASS | 開啟時 Akamai 出現在 native-signed 合格候選；cosov 在 root／Native／Catalog 三種角色都因 default-unavailable 排除。關閉後排名只有 Catalog；既有路線可繼續實傳，沒有要求 Native 必須勝出。 |
| N1 可信來源集合更新 | N 核心 | PASS | 同集合重排保留 authority／handle；新集合撤銷舊 handle、最多四來源，低信任及逆序 API 不回滾。此為合成內容的真實元件整合。 |
| N2 安裝版完整刷新分支 | I 條件式 | 證據不足 | 已看到 page-hint→trusted-api 提升與新授權；未配對兩次 trusted-api 集合替換、同集合重排或舊在途完成，不把來源提升擴張為這些分支通過。 |
| Z0 清理與資料保存 | I＋N 核心 | PASS | 正式保存設定除 updatedAt 外逐欄等於原值；媒體 paused／muted=true、rate=1、error=null。Debugger／物件群組清理、自有分頁零；記憶體整合 timer／listener 零，沒有清除學習。 |

### 來源與實際派送的證據範圍

初始已確認影片表示為 2160／AV1，bandwidth 11,642,829；當時四個來源來自 page-hint。自然 XHR playurl 回應摘要為 HTTP 200、code 0、DASH，接納 21 影片／3 音訊表示。原影片群組由 authority 6 更新為 30，原音訊由 22 更新為 46，均成為 trusted-api 且各兩筆精確來源；當前 Auto 後續選到另一個 1080／AV1 表示，authority 33、bandwidth 2,515,924。沒有強制畫質或把不同表示的需求硬相比。

接納主機為 cosov 與 Akamai；接納不代表放行，cosov 的禁止原因仍生效。Native 開啟時 Akamai 合法候選未必勝過目前足速 Catalog；關閉後 Catalog-only 排名與新的成功傳輸符合設定。以上是已核對安裝程式的當前快照／接線事實，不是完整 Network 時序、所有晚到工作或換站效益證明。

### 操作偏差與方法限制

初次固定站鍵盤操作遭自動審查拒絕，使用者隨後明確批准暫時固定 mirroralib、還原 Auto 及 Native 往返。CUA 直接點 closed ShadowRoot 內容不支援；已核對命中的 CDP 原生滑鼠可操作按鈕與 checkbox。raw CDP key dispatch 不支援，改用工具指定的 tab keypress。原生 select 逐鍵立即觸發 change，加上非同步保存 pending，使預定 Home＋四次 Down 沒有建立目標；實際一度選成 mirroraliov，這是測試操作偏差，已還原且沒有再嘗試固定站湊通過。

入口重開初次位於選單動畫過程，核對新矩形及實際命中後才成功點擊；沒有改網站樣式或直接呼叫 show／產品命令。身分斷點短暫暫停均解除，未將其時間算成網路期限或播放故障；區塊內唯讀 handle 未跨呼叫保留後，只重取頂層引用，沒有重新導覽。證據落地初稿被審查視為可能含 URL 的 source 欄位而拒絕；後續只保存經白名單核對的布林、枚舉、數字及主機，不保存簽名 URL、路徑、查詢或物件。

總覽曾顯示恢復狀態文字，同時真正媒體仍前進且 error=null；本輪沒有調查這項狀態文字的因果，不據此新增恢復成功或產品故障結論。沒有重測已通過的五分鐘／二十分鐘熔斷窗口，也不把自然顯示的等級／進度當作本輪新熔斷驗收。

### 隔離整合與清理

N 層使用非入口真實 Session／Vault／Routes／RestrictionStore／EvidenceStore／PlayurlController／Adapter 與獨立記憶體鎖，共五案 PASS。外部 Fetch／XHR／GM 入口有拒絕檢查，呼叫數零；每案獨立資源、結束 timer 零、dispose 後 listener 零。私有初始 oracle 誤認固定站被黑就應整體 block，已依既有合法 fallback 政策校正為不得選或物化被黑站；原失敗保留，不算產品缺陷。Native 黑名單直接斷言在同一 N 層補齊，原四案結果保留，不追加瀏覽器輪次或正式案例數。

本輪僅改 Native 與暫存固定設定，最後正式 GM 保存值和原設定逐欄一致，沒有回灌整份學習。正常播放及其他分頁合法新增學習繼續保留。導覽後立即真正靜音，所有取得的媒體讀值均靜音；最初載入至首次確認及未採樣區間不新增全程無聲的量測保證。最終暫停靜音、解除自有斷點／Debugger／物件群組並關閉分頁；沒有工具網路攔截、頁內採樣器、訂閱或週期 timer，也沒有操作使用者 Chrome。

私有證據目錄為 .work/iab-testing/2026-11-08-v2.2.13-bb4ca71-R1：PLAN、BASELINE、INSTALLATION、SOURCE_PROMOTION、METHOD_LIMITS、HOOKS、CASES、UI_FINAL、SETTINGS_RESTORATION、CLEANUP、兩張畫面及 controlled 結果／38 檔輸入雜湊。五份 Release 原件與各層證據各自保持；本輪不新增正式 2,261 案計數。文件只保存本機，不提交推送、升版或發布；產品、正式測試、版本與 Release 不變。

## v2.2.13 R2 本版變更接線補驗（2026-11-08）

依使用者批准的「受控整合＋短實機、分層結案」，以 main bb4ca71／v2.2.13 及既有六份未提交文件為基準。開始時間為 11:24:39 Asia/Taipei，總上限六十分鐘；四組受控補驗在二十五分鐘期限內完成，IAB 自 11:30:21.781 起算、11:39:04.552 清理完畢，耗時 8 分 42.771 秒。既有正式 2,261 案與 R1 五案不重跑，R1 原始判定及限制不回填。

**本次受控補驗完成：** C1–C4 共八個私有組合案例全部通過，清理通過；唯一實機刷新專項沒有取得所需配對，列為證據不足。這是使用者已批准的分層結案，不代表所有安裝版分支均經實測。固定主機、選單、三頁、一般播放／倍速、timeout 及熔斷窗口均不列入本輪測試。

| 項目 | 層級／結果 | 新增證據 |
| --- | --- | --- |
| C1 限制提交到選路 | N 私有受控，3／3 PASS | 保存前失敗不發布提案；保存後拋錯但權威吻合可確認；清除讀回未知保留最後確認限制，恢復後依權威更新。舊 payload 不復活或覆蓋較新限制，斷言連到真實 Routes 輸出。 |
| C2 來源接納到起播 | N 私有受控，1／1 PASS | 前十六原始位置含非法及重複值；第十六筆接納、第十七筆無精確授權，共四來源。首個 Native 備援被黑後，真 Measurement 實際探測後續合法 Native；三候選、Native 備援一筆、每筆 256 KiB 上限保持，被黑與第十七來源不探測／學習。 |
| C3 共享認領到探測 | N 私有多實例，2／2 PASS | 兩組真 Store／Routes／Measurement 共用 FIFO 鎖，同控制版本只啟動一次優先探測，保存確認先於探測；取消不退還。另一 Store 清除新世代後，舊 pending 完成不能復活標記或啟動第二／第三候選。 |
| C4 多候選到重試送出 | N 私有原生替身，2／2 PASS | A 吞吐較高卻超期，B 與 C 合格而 B 更快，控制器僅準備 B。替身 send 返回前不提交 B 親和，接受後才提交；B 認領前失效則拒絕原許可，不轉授 A／C，網站請求沿當前合法原路線送出。 |
| I-FRESH 可信集合再次刷新 | I，證據不足 | 完成唯一三分鐘窗口，未配對同內容／表示的兩次 trusted-api 來源更新。觀察點未自然命中，不宣稱已校準全部實機作用域，也不把缺席判成產品失敗。 |
| Z0 設定與資源清理 | N＋I，PASS | 工具設定寫入零，正式保存設定逐欄完全相同；不清除或回灌學習。媒體暫停且靜音；registry／timer／斷點／物件群組及 Debugger 清理、自有 IAB 分頁零。 |

### 九項改動與證據沿用

| 本版改動 | 正式契約／R1 沿用 | R2 新增及安裝層界線 |
| --- | --- | --- |
| ① 限制清除確認 | 正式保存失敗／未知等契約；R1 基本增刪排除 | C1 補保存結果到實際選路；未在正式 GM 製造失敗或清除。 |
| ② 權威通知 | 正式亂序／重入契約 | C1 舊通知與恢復後權威到選路；真正 GM 跨頁通知仍未測。 |
| ③ Native 起播漏選 | 正式候選契約；R1 Native 一般接線 | C2 首備援禁止後繼續查找並實際探測。 |
| ④ 重試替代站 | 正式多候選政策與既有傳輸契約 | C4 控制器到適配器精確交接；合成原生事件不稱為 IAB 原生證據。 |
| ⑤ 可信 DASH 刷新 | R1 N 層集合重排、替換及撤銷；I 層來源提升 | 不重跑既有 N 案；I-FRESH 所需再次刷新配對未取得。 |
| ⑥ 共享到期再驗證 | 正式共同鎖、版本與世代契約 | C3 多實例競爭及清除交錯；不是真正雙 IAB 分頁。 |
| ⑦ 四來源與 raw16 | 正式接納契約；R1 四來源上限 | C2 將 16／17 位置接到起播候選及探測。 |
| ⑧ 超額提前拒絕 | 正式契約完整通過 | 無新原生接縫，不重測。 |
| ⑨ 禁止原因一致 | 正式順序契約；R1 各角色禁止 | 沿用原因順序，C1／C2 只新增限制到實際輸出的證據。 |

### 實機窗口、方法與限制

當前 Tampermonkey 5.5.1／腳本 2.2.13，完整本體 532,263 bytes、SHA-256 ab0c2b1ad1a80f3f9d042cad9f426fe3c7574d655629e194ee4f8f9d3affb706；Runtime／ControlCenter／Transport 各一，Fetch／XHR hooks installed。指定片 P1／Auto、原有一倍播放，不操作控制中心。當輪原設定 Native／提前重試均為 true、fixedHost 為 null、Catalog overrides 為空；這是本輪讀到的現有設定，不把 R1 的舊 false 值還原到現在。

來源窗口於 11:33:54.701 開始，以單調時間固定 180,000 ms，截止回呼晚 1.3 ms；來源於截止及之後拒收，晚讀不能延長。窗口內 Debugger 暫停零；四個觀察位置已解析為當版可執行行，但沒有自然命中，產品事件零、觀察例外及 overflow 均零。工具哨兵只證跨呼叫保存，不是產品事件。最終 hooks 最近接納 API 的時刻早於窗口起點；窗口外的新 API 摘要不能補進窗口。沒有重新導覽、切畫質、尋位或切換設定來製造第二次回應。

增量保存共十批，保存成功才推進游標；最大取回間隔 40.003 秒，落後時跳過過期時點，不連續補抓。來源收集有獨立容量與截止，這些取回間隔不等同事件遺失，但本輪也不宣稱精確十秒採樣或完整 Network。單一 ingestSequence 僅是來源順序提示，不能在同步重入下當嚴格請求配對；撤銷觀察點只在 handles 迴圈後，不能單獨證明 aliases／output roles 全部撤銷。因缺少必要事件，不作上述分支的安裝通過結論。

私有工具修正及原始失敗另行記錄：觀察器最初路徑多上一層而 ENOENT，改為正確基底；本體結尾長度多取一字元後依精確終止字串修正；窗口結束讀取時區塊內的遠端引用未保留，改於窗口外重新取得並立即解除身分暫停。這些是工具方法問題，不算產品故障或新窗口。C1／C2 初稿 guard 經交叉稽核後改為可構造 XHR、補齊 GM namespace／listener；C4 補 GM 守衛，原稿另存。C3 私有讀回 oracle 曾誤定位後續冷卻寫入，修正為認領保存→確認→probe；C4 初次清理受 Node EventTarget 布林 capture 差異影響，以獨立重現校準私有替身，保留原清理斷言。僅對新修改的私有工具重驗，沒有弱化產品斷言或重跑正式套件。

受控層外部 Fetch／XHR／GM 呼叫均零，各案 timer／listener 零；C3 另有 FIFO queue 零，C1／C2 未讀取私有 queue，不擴張該主張。三份輸入清單為 43／42／57 檔，逐項雜湊吻合。最終真正媒體 paused／muted=true、rate=1、error=null；工具只做正常播放與唯讀觀察，保留其合法學習，不保證學習整份雜湊不變。沒有本機網站服務、外部瀏覽器、要求前景、正式故障注入或重設預算。

本輪私有索引為 .work/iab-testing/2026-11-08-v2.2.13-bb4ca71-R2：PLAN、BASELINE、三組 controlled 結果與輸入雜湊、OBSERVER_SPEC、INSTALLATION、WINDOW、十批增量、OBSERVATION_RESULT、CLEANUP 及暫停畫面。文件、封存及差異檢查通過；FINAL_INTEGRITY 另確認 R1 正文、三份日誌原有內容、五份 Release 原件與正式產品／測試／工具及版本保持。現行狀態按本節及 TODO 銜接，本次只保存本機，不提交推送、升版或發布。

### R2 文件交付授權銜接（2026-11-08）

使用者在補驗結案後明確授權將本次文件更新提交並推送 main。本次交付包含同批六份文件內保留的 R1 原始紀錄與 R2 補驗結果；前文的本機保存限制仍描述各輪結案當時的授權，不是目前禁止交付。受控八案通過、實機可信清單再次刷新證據不足及所有原始限制保持，沒有新增測試、瀏覽器輪次、版本標籤或 Release。
