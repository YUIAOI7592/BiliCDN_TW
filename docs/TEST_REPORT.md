# BiliCDN_TW v2.2.12 完整驗證報告

日期：2026-11-07（Asia/Taipei）。以 main 060b79f／v2.2.11 凍結基準；七份研究文件先以 b3185ed 獨立保存，產品／測試各階段分別提交。

## 驗收結論

十八套件／2,140 案完整通過，failed／cancelled／skipped／todo 均零；原 2,106 案的名稱、kind 及參數展開無遺失，新增 34 案。退休最後成功主機索引，UI 合併同批 monitor／routes 刷新，settings、換頁與命令完成仍立即刷新。選路、熔斷、W／G／C、Native 預設、schema 2、四鍵、網路及恢復額度不變。

本版採離線交付。最終 verify、型別、架構、唯讀格式、文件、封存、差異及安全封印均已通過；兩次建置、語法、暫存封裝及校驗一致。正式封裝及公開核對完成後另列實際結果。沒有啟動瀏覽器、更新安裝版或重跑已通過熔斷窗口；實機適用率與效益尚未新增驗證。原六情境提前重試效用仍 FAIL，與功能契約／模型算式通過分開。

## 自動驗證

固定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10。基線首次工具套件有八案因沙箱限制暫存 Git 配置而失敗；在具備權限的環境重核 tooling 203／203 通過。原始失敗保存，合併十八套件建立 2,106 案對照。實作後完整 2,140 案在同一有權限執行中全部通過。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 106 | PASS |
| state | 56 | PASS |
| application | 827 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 84 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 108 | PASS |
| tooling | 209 | PASS |

新增應用 16 案（生命週期 1、適配器資格 15）、控制中心 12 案、工具 6 案。重現失敗及修後結果、名稱多重集合、套件原始輸出保存於本機 .work/v2.2.12，不作正式建置輸入。型別、102 模組架構、唯讀格式及完整 verify 已通過；verify 使用暫存封裝，沒有改寫已發布原件。

## 政策與契約對照

兩個原索引案例改驗精確已保存健康樣本與當前生命週期摘要；新增真實 Session／Vault／Routes／EvidenceStore 組合確認舊完成不能回填新片的歸因及容量，而合法跨片學習仍保留。沒有空值相容殼。

同批 2／8 次通知各一份最新完整快照；不同批可更新。設定同步撤銷舊佇列，快照讀取前先取消舊工作，讀取後再核對視圖；關閉、重開、換頁、同步重入與讀取中再通知皆有反向案例。命令成功／失敗及詳細狀態按需契約保持，Runtime 功能事件仍同步。原 CC39 通知案例只調整到指定 microtask 後讀畫面，內容與清理斷言保留。

XHR timeout 0／1／500／3000／10000／13000 ms 均核對；正數仍排除提前重試。timeout=0 仍需其他資格；同步、非 GET、Range、音訊、不可信進度、200／206 及停用分別驗證。原正數 timeout 起播、Native／Catalog、固定／禁止、影音隔離、鎖等待、取消、同步重入、晚到與恢復案例全數保留。完整映射見[測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v2212-索引退役刷新與評估)。

## 離線評估與限制

`npm run evaluate:routing -- --optimization` 的 7,680 組固定輸入中 1,076 組符合純政策；這不是現場適用率。相同前提的持續慢模型節省停頓 14 秒、原路恢復模型沒有停頓收益且較晚完成、替代路線變慢模型增加停頓 7 秒；已完成重送各多下載 100,000 bytes。缺少替代結果或交接未確認均保留缺值。兩秒政策預算及合成實際交接分欄且不重複計入。

均勻／VBR 都是 12,000,000 bytes、四段各四媒體秒、6 Mbps／60 FPS 的固定表示，本文容量 8 Mbps；1 倍停頓分別 0／4.1 秒，2 倍分別 4.4／6.1 秒。FPS 沒有重複乘入碼率，表示軌跡與每段剩餘緩衝保存；序列整段 append 不代表網站漸進 append、ABR 或解碼。未模擬探測／重載為 null，不是零。

工具以獨立算式逐列核對資格、兩秒交接、期限及資源守恆；保存輸入及來源 SHA-256，輸出可重現。原 `evaluate:early-retry -- --json` 另跑退出 1：慢案例至少改善 500 ms 及正常案例無不必要介入兩門檻仍失敗，noStallRegression 通過，不更改原判定。操作與各層資格見[評估指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/README.md#v2212-優化補充模型)。

五案私有方法契約通過：遲到跳過舊時點、部分保存失敗不推進游標且重讀去重、固定截止及停止冪等、晚取回不補造邊界、容量溢位明列。它們不計入 2,140 案，也不證明 IAB 已校準。未新增診斷頁面、產品計數器、採樣管線或效能收益宣稱。

## 安全差異

Codex Security 掃描 b3c3ca06-4bb1-4bc0-8bfb-cae432ca45c4，固定 b3185ed..faa96cd；14 個來源／測試檔，另核對四份變更指南。能力前置 ready，獨立架構核對及父代理逐檔來源／消費者審查完成；成立漏洞、未結候選及未審檔案均零。正式產物已封印並讀回，後續產品／測試／工具來源與受審提交一致，不以契約測試取代安全審查。

掃描工具記錄 model=gpt-6-astra、reasoningEffort=xhigh；usage 來源 codex_rollout，threadCount=3、totalTokens=9,384,141、cachedInputTokens=9,119,232。此工具彙整含快取及串接紀錄，不當作獨立量得的純掃描增量。

## 交付與安裝範圍

v2.2.11 五項 Release 原件已逐筆核對原 SHA-256，按原始 bytes 搬至 archive/retired/releases/Release/v2.2.11；原搬移清單另存不可變快照。上一版完整報告含 R1／R2 已原樣追加，三份日誌只追加。本版腳本 512,863 bytes，SHA-256：`9a8ec881aa30390576e8c90d67d0034f51da307df9a36f96b83ec22ffa3b1235`。五項正式封裝及公開核對完成後另記，不移動舊標籤。

<a name="v2211-r1-熔斷安裝驗收2026-11-06"></a>
<a name="v2211-r2-受控熔斷與安裝接線2026-11-06"></a>
<a name="公開交付核對2026-11-06"></a>

v2.2.11 的 R1 原判定及 R2 受控／安裝接線通過與方法限制，完整保存於[上一版正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-完整正文保存2026-11-07)，不回填、不轉移為本版安裝驗收通過。

## 歷史驗證導覽

[v2.2.10 完整正文與 R1–R4](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-完整正文保存2026-11-06)；[原研究](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/CIRCUIT_BREAKER_RESEARCH_v2.2.10_2026-11-05.md)。現行工作只見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

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

以上舊錨點僅作相容導引；原文與判定見上列 v2.2.10 完整保存。
