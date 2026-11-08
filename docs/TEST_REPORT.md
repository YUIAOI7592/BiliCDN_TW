# BiliCDN_TW v2.2.13 完整驗證報告

日期：2026-11-08（Asia/Taipei）。乾淨 main 24021da／v2.2.12 凍結基準；各階段先建立失敗回歸，再修改執行期並獨立提交。

## 驗收結論

九項改善已完成，完整 2,261 案、verify 及三批安全封印均通過：限制保存／通知、Native 起播候選、重試替代站、可信 DASH 更新、共享到期再驗證、來源額度、有界解析及統一禁止原因。公開交付進度分列如下；安裝版與真正跨頁協作未執行，不能由離線通過代算。原提前重試六情境效用 FAIL、既有安裝判定及歷史限制保持。

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

本版只做離線契約、靜態安全、建置與公開交付核對。沒有啟動瀏覽器、更新安裝版、重新開啟停止窗口或重測已通過的熔斷二十分鐘；自然通知交錯、真正跨頁協作及播放效益未新增驗證。合作新版分頁的共享一次由真實 Store＋串行記憶體鎖契約支持，不冒稱 Tampermonkey 雙頁實測。

無共同鎖／權威讀取及保存未知／混版協定退回不得取得優先再驗證。普通探索仍須既有六小時門檻；標記滿額不得藉淘汰最舊資料重新發放機會。正常探測失敗不新增播放熔斷。

## 公開交付與安裝結案

v2.2.12 五份 Release 原件已核對 bytes／SHA-256，原樣搬至 archive/retired/releases/Release/v2.2.12；原搬移清單另保存不可變快照。上一版完整正文含 R1、研究入口、後續文件交付與限制已原樣追加歷史，三份日誌只追加。

五項正式產物已封裝、登記並核對；正式發行提交為 `626432a800b42b56478676716f6f526209953543`，發布時遠端 main 與 v2.2.13 標籤均指向此提交。後續公開核對以文件提交推送 main，標籤保持發行提交，不改寫 Release 快照。

2026-11-08 09:06:15 Asia/Taipei 完成獨立下載。[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.13) 非草稿／非預發行，只有 `BiliCDN_TW.user.js` 一個附件，亦為 GitHub latest。[版本附件](https://github.com/YUIAOI7592/BiliCDN_TW/releases/download/v2.2.13/BiliCDN_TW.user.js) 與[公開 latest](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) 均回傳 200、版本 2.2.13、532,263 bytes，逐 bytes 相同於正式產物；SHA-256 均為 `ab0c2b1ad1a80f3f9d042cad9f426fe3c7574d655629e194ee4f8f9d3affb706`，符合唯一附件 digest。舊 v2.2.12 標籤保持 `2798719546b73918aa92b993cfbdf01c1ceff2dc`。

原件、完整舊報告及三份日誌前綴已另做 SHA-256／bytes 核對。正式封裝後文件與封存檢查再通過，受審產品／測試／工具未變；安裝版仍未執行，不將公開更新可取得寫成 Tampermonkey 已驗收。

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
