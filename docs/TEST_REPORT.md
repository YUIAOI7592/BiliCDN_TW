# BiliCDN_TW v2.2.9 完整驗證報告

日期：2026-11-05（Asia/Taipei）。以 304c631 為基準，修正傳輸與探測單調計時、清理前凍結、有效 bytes 核對，以及實際倍率／快照年齡與播放事實失效；保留原選路與 Catalog-only 起播早放政策。

## 驗收結論

本版採離線驗證交付；十八套件／2,021 案通過，failed／cancelled／skipped／todo 均零。安裝版、來源隔離與實機效益未測，不啟動瀏覽器、不恢復已停止窗口。型別、架構、完整測試、唯讀格式、文件、封存、git diff --check 與 verify 已通過。兩次建置、語法及暫存封裝校驗通過；公開交付核對在發布後追加。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10，命令確認不啟動網站服務。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 81 | PASS |
| state | 42 | PASS |
| application | 771 | PASS |
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
| control-center | 92 | PASS |
| tooling | 201 | PASS |

原 1,982 案名稱、kind 與參數展開以多重集合核對，政策差異見[測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md)。新增案例只補充契約，不刪除原有效斷言。原始結果及失敗回歸保存在本機 .work/v229，不作正式工具輸入。

## 模型與誤差界線

[固定數字模型](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/README.md#選路模型對照) 區分量測語意、快照年齡、表示與服務情境。獨立算式一致只證明實作計算，合成 Auto、FPS、VBR 或交接成本不是現場參數，也不是未來分位數保證。舊探索性資料未取得獨立核對的部分保持未知。

## 安全差異

Codex Security 掃描 5bb8484b-8697-46b3-bc49-559e32fea3a0，固定提交範圍及逐檔審查結果由工作台管理。能力前置檢查及全部變更來源／測試／工具的獨立來源審查已完成，成立漏洞、未結候選與未審檔案均零；正式產物已封印並讀回。來源掃描不代替原生瀏覽器計時或安裝證據。

## 交付與安裝範圍

前版 v2.2.8 五份原件按原始位元組封存並核對 SHA-256；本版腳本 485880 bytes；SHA-256：`ed2e5cd6f9959b49ed588118d52c7d8c5b3229e50d82ebc86442fadda75df6bf`。五項本機產物按鎖定工具封裝，公開 main／標籤／唯一腳本附件／latest 核對於發布後追加，發行快照不回寫。不改使用者 Native 預設、既有布林值、schema 2、四鍵或三頁操作。沒有新增診斷、原線對照、掉幀收集、剪貼簿、探測或恢復額度。

## 歷史驗證導覽

[v2.2.8 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-完整正文保存2026-11-05)，含原先已批准驗收及限制；[研究與執行計畫](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/MEASUREMENT_ROUTING_OPTIMIZATION_v2.2.9-v2.2.10_2026-11-05.md)。目前工作只見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

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

舊錨點僅保留相容導引，原文見上列歷史保存。
