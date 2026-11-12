# BiliCDN_TW v2.2.20 完整驗證報告

驗證日期：2026-11-12–13（Asia/Taipei）。基準 main／b656d7a、v2.2.19；三批來源提交為 b19ffe8、37f7624、719c888。範圍為使用者批准的程式清理與結構收斂。

## 驗收結論

三批實作、型別、架構、格式及完整十八套件／2,200 案通過；安全差異審查已完成並封印，候選、可報告漏洞及 deferred 均為零。版本同步後整輪 verify 已通過；正式封裝與公開核對的完成結果追加於本報告。

可確認收益是減少無消費資料及重複介面，集中相同解析與判斷。不宣稱播放速度、卡頓或提前重試效益改善。使用者設定、UI、schema 2、四個持久鍵與更新網址保持；歷史效用 FAIL、INVALID 及實機證據限制維持原判。

## 三批實作與功能保持

| 批次／提交 | 完成範圍 | 保留契約 |
| --- | --- | --- |
| 一／b19ffe8 | 移除 Session recovering、請求與候選冗餘欄位、未消費量測／恢復快照、pendingMedia 集合及內部多餘匯出 | 真正恢復狀態、hostChanged、取消分類、Catalog 成員檢查、candidateOrder、64 筆熔斷屏障、私有期限與時鐘求值 |
| 二／37f7624 | 決策 ID 對政策修訂的私有索引取代完整紀錄；量測強制 proposeChallenge／commitChallenge，移除舊 challenge 包裝與未使用 demand 參數 | 256 筆上限及更新／淘汰順序、無 request 過期控制隔離、共同認領及一般探索退路、名額／取消／冷卻 |
| 三／719c888 | 兩個 Store 共用 storedHost；normal／Catalog 共用首次影片親和判斷；Windows cwd 比較目錄身分 | 字串轉換與例外、短路 getter 順序、分開的來源參數／備援／最終授權與提交、空白路徑／參數／退出碼 |

lastDecisionId／noteDecision 保留 Session 快照身分變更；提前重試樣本抑制、Vault 測試查詢、Native 相容分支及恢復還原證明保持。沒有拆分大型播放器／恢復狀態所有權，沒有新增執行期依賴、CI、遠端載入或持久鍵。

## 自動驗證

基準 2,186 案，新增五個無 request 觀察／決策容量契約及九個兩 Store 主機解析邊界契約，總計 2,200 案；現有熔斷容量、重複完成、原生派送例外、備援、同步重入、量測認領與取消契約繼續通過。新契約在相應執行期修改前先驗證；測試替身改用兩階段協定，移除內部計數／完整紀錄斷言，保留產品結果斷言。

| 檢查 | 結果 |
| --- | --- |
| typecheck | PASS，來源、測試及工具 |
| architecture | PASS，110 個正式模組、無循環匯入 |
| format:check | PASS |
| 完整測試 | PASS，18 套件／2,200 案；failed、skipped、todo、cancelled 全為 0 |
| verify | PASS，含全套測試、可重現建置、語法、v2-only 與暫存五項封裝校驗 |
| 文件、公開封存及差異 | PASS；相容錨點補回後整輪檢查通過，既有歷史限制分列 |

初次沙箱測試保留五項工具失敗：符號連結 EPERM、cwd 等價路徑大小寫差異、三項 MSYS 權限限制。cwd 改以目錄 dev／ino 身分核對後，批准在沙箱外重跑完整測試，318 個工具案例全數通過；沒有跳過或降低門檻。一次新增契約原先誤假設無 request 成功會綁定親和，基準結果顯示不會，已修正為驗證原有控制／親和語意；這不是產品修復。詳見[工具紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md#2026-11-12-v2220-清理與啟動器路徑契約)。

當次內建依賴工具提供 Node 24.22.1，明確執行路徑為 `C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1111-574-0_26.1111.574.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe`。沒有啟動本機網站服務、瀏覽器或音訊；本機交付核對資料保存於 .work/source-cleanup-v2220/。

## 安全差異

Codex Security scan `a92d1486-a6c0-4261-aa2c-4460bcaaf17b` 已完成並讀回 canonical 封印。固定範圍 `b656d7afeee774b443d8798a6a7f8efd1dbba7d9..719c888c1ba25354a8b59925fb1bdb9aa5c98f1d`，64 個來源／測試／工具檔完整覆蓋；候選、漏洞及未解項目均為零。

審查涵蓋決策政策與所有權、提案私有證明及共同認領、一般探索退路、Host 解析及例外邊界、Native 精確授權、候選同分規則、XHR 終止分類、恢復期限及 getter 順序。這是固定差異審查，不是全庫逐行漏洞審計或安裝版驗收。工具回報三個關聯執行緒累計 6,401,677 tokens（其中快取輸入 6,267,008）；此為工具的累計計量，不當作本次掃描新增用量。掃描產物由插件管理，既有安全原件保持。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.19 五項發行原件已與 b656d7a Git 位元組、原 SHA256SUMS、ArchiveStorage 及獨立系統 tar 解壓逐項核對，再移除原位置。公開壓縮檔 154,730 bytes，SHA-256 `f1b2f935552c76afbe7ca221fda4daaa8290a1baa33ebefdff7fd0ea46bd7ff7`。八份公開壓縮檔完整解壓後，archive:check --restore-root 通過；534 項搬移、三份追加日誌、154 項原件保護、87 份校驗清單／390 筆校驗通過。另行 archive:check --local 核對 9,495 個檔案、93 份清單／419 筆校驗通過；公共還原目錄不混用私有還原要求。

正式五項產物已獨占建立，118 項建置輸入、重建腳本及四筆 SHA256SUMS 一致；腳本 538,970 bytes，SHA-256 `f5ec98a6b3503d1ac9260127719f14ab18a64df3f4828367a3f0983206c75403`。登記本版五項保護後最後整輪 verify 再次通過，包含 2,200 案及 159 項原件保護。公開交付待核對；Release 快照描述封裝當時，後續只更新本現行報告。

## 來源隔離與實際安裝

本次未啟動 Codex 內建瀏覽器來源隔離或 Tampermonkey 安裝版驗收，也未重啟低緩衝補驗及提前重試效益研究。自動驗證不代表安裝版通過。上一版完整正文、R1 與原限制保存於[歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2219-完整正文保存2026-11-12)。

## 歷史驗證導覽

<a name="v2218-r1-安裝身分與設定頁2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2218-r1-安裝身分與設定頁2026-11-12)。

<a name="文件與測試清查整理2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#文件與測試清查整理2026-11-12)。

<a name="斷言審核與精簡2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#斷言審核與精簡2026-11-12)。

<a name="全量逐案語意審核與最終精簡2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#全量逐案語意審核與最終精簡2026-11-12)。

<a name="v2217-r1-採樣與抑制專項2026-11-11"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r1-採樣與抑制專項2026-11-11)。

<a name="v2217-r2-低緩衝與額度受控補驗2026-11-11"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r2-低緩衝與額度受控補驗2026-11-11)。

<a name="v2216-r1-載入身分與選路提交接線2026-11-09"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2216-r1-載入身分與選路提交接線2026-11-09)。

<a name="v2215-r1-載入身分與模組初始化2026-11-09"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2215-r1-載入身分與模組初始化2026-11-09)。

<a name="v2219-r1-安裝身分與變更接線2026-11-12"></a>

[v2.2.19 原始發行與 R1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2219-完整正文保存2026-11-12)。

版本、議題、日期由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 維護；以下錨點只作相容導引。

<a name="v2214-載入身分驗證2026-11-08"></a>

[原版載入身分與 R1／R2 限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2214-載入身分驗證2026-11-08)。

<a name="v2212-r1-三頁與刷新專項2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2212-r1-三頁與刷新專項2026-11-08)。

<a name="v2211-r1-熔斷安裝驗收2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r1-熔斷安裝驗收2026-11-06)。

<a name="v2211-r2-受控熔斷與安裝接線2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r2-受控熔斷與安裝接線2026-11-06)。

<a name="v2210-r1-安裝版驗收2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r1-安裝版驗收2026-11-05)。

<a name="v2210-r2-補驗能力確認2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r2-補驗能力確認2026-11-05)。

<a name="v2210-r3-補驗2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r3-補驗2026-11-05)。

<a name="v2210-r4-正數-timeout-專項2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r4-正數-timeout-專項2026-11-05)。

<a name="v228-r2-專項完成2026-11-0304"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r2-專項完成2026-11-0304)。

<a name="v224-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-r1-安裝驗收2026-11-01)。

<a name="v223-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-r1-安裝驗收2026-11-01)。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。

<a name="v225-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-r1-安裝驗收2026-11-01)。

<a name="三十五項閉環對照"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#三十五項閉環對照)。

<a name="v226-r1-安裝驗收2026-11-02"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v226-r1-安裝驗收2026-11-02)。

<a name="驗證階段與證據範圍"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#驗證階段與證據範圍)。

<a name="v2213-r1-選路黑名單與來源驗收2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r1-選路黑名單與來源驗收2026-11-08)。

<a name="v2213-r2-本版變更接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r2-本版變更接線補驗2026-11-08)。

<a name="v2213-r3-更新確認與實機觀察2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r3-更新確認與實機觀察2026-11-08)。

<a name="v2213-r4-自主接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r4-自主接線補驗2026-11-08)。

<a name="v2213-r5-受控真實-api-接線2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r5-受控真實-api-接線2026-11-08)。

<a name="公開交付核對2026-11-06"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付核對2026-11-06)。

<a name="研究項目完成對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#研究項目完成對照)。

<a name="v228-r1-正數-timeout-專項2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r1-正數-timeout-專項2026-11-03)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。

<a name="公開交付"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付)。

<a name="修復結果與證據邊界"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#修復結果與證據邊界)。

<a name="發布與安裝限制"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布與安裝限制)。

<a name="2026-10-30up141-安裝版實測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="2026-10-31更新後安裝核對"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="v220-安裝驗收-r12026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v220-安裝驗收-r12026-11-01)。

<a name="澄清後在原期限內續行"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#澄清後在原期限內續行)。

<a name="auto-2-倍補充與本次驗收結案"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#auto-2-倍補充與本次驗收結案)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-r1-安裝驗收2026-11-01)。

<a name="全文閱讀覆蓋清單"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#全文閱讀覆蓋清單)。

<a name="發布後公開核對2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-01)。

<a name="固定合成模型對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#固定合成模型對照)。

<a name="發布後公開核對2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-03)。

<a name="v227-r1-基本安裝驗收2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-r1-基本安裝驗收2026-11-03)。

<a name="v227-xhr-timeout-起播分支調查2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-xhr-timeout-起播分支調查2026-11-03)。

<a name="政策映射與契約保留"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#政策映射與契約保留)。
