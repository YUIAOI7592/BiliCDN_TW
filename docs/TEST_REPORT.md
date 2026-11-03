# BiliCDN_TW v2.2.8 正數 XHR timeout 起播修復驗證

日期：2026-11-03（Asia/Taipei）。固定基準 main ddd41a0ad91a9a5673e8944ff86c5cb234f46443／v2.2.7；程式與測試審查固定至 6840815281b0cfb1d70409123b4aae66dd1b8ba8。先保存基線與失敗回歸，再修改執行期，各階段獨立提交。

## 修復結果與證據邊界

合格非同步媒體 GET XHR 的正數 timeout 不再排除起播測速，與零值共用既有一次三秒窗口。網站 timeout 保持最新值；沒有六秒門檻、沒有自動延長或清零。等待另計，三秒加五秒原生期限可能約八秒；瀏覽器排程及網站外部看門狗各自存在，不宣稱端到端期限完全不變。

重新準備不覆寫網站較新的 timeout；同世代換片的 Catalog 等待者也檢查 epoch。起播租期保存唯一 startedAt／deadlineAt，接納結果時檢查絕對期限，恰好三秒及之後的結果不回填；既有候選、bytes、一次預算、足速與退路保持。提前重試正數 timeout 的原限制保持。三頁、詳細狀態按需建立、Native 預設、schema 2 與四鍵均不變。

本版採離線驗證交付，未開瀏覽器、更新安裝版或恢復歷史窗口。原 v2.2.7 指定片 86／86 略過是修前證據，不能改寫成修後實測；原始摘要、完整逐筆陣列未保存與清理讀回限制均保留在歷史正文。本版不宣稱已改善實機起播速度或解決多輪換站的全部原因。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10。命令已確認不啟動網站服務。基線原產品套件通過，工具套件初次因沙箱禁止暫存 Git config 寫入失敗；原輸出保留，以正常權限重跑工具套件通過，沒有修改門檻。

**18 套件／1,982 案全通過**，failed／cancelled／skipped／todo 均零；原 1,931 案名稱、kind 與參數展開多重集合無缺漏，新增 51 案。原始結果、環境重跑及案例對照保存在 .work/v228；基線案例 SHA-256 為 884cdfd376204371e9e2bded65a7f19a7177e219b019fe22f6727fcf9f52b66b。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 81 | PASS |
| state | 37 | PASS |
| application | 756 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 65 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 92 | PASS |
| tooling | 201 | PASS |

型別、96 模組架構、格式、文件、封存、git diff --check 及 npm run verify 全部通過；verify 再次通過 1,982 案、兩次一致建置、JavaScript 語法、撤除標記與暫存封裝校驗。沒有本機網站服務或瀏覽器操作，輸出保存在 .work/v228/verify.log。

## 失敗回歸與契約對照

| 項目 | 修前／修後證據 |
| --- | --- |
| 正數 timeout、網站改值與共用等待 | 24 案先行回歸中 21 案失敗，修後全通過；0 與正數在 Native 開／關均使用真實起播、選擇與送出組合 |
| 絕對期限 | 延遲排程下 2,999 ms 對照原本通過，3,000／3,001 ms 原本錯誤接納；修後均符合接納邊界，晚到不新增學習／提交 |
| 同世代換片 | Catalog 舊內容等待者原本仍送出，新增失敗回歸後補 epoch 檢查；Native 按目前限制原樣處理，不套舊歸因 |
| 取消與重新準備 | 並行 Fetch／XHR、單筆 abort、成功／失敗 open、停用、禁止、送出與 probe 例外均收束，原生 send 最多一次 |
| 資格與資源 | 固定、停用、非 GET、非媒體、同步、playurl、影片優先及純音訊保持；沒有新探測或輪次 |
| UI 與其餘功能 | 退役原因移除，原 UI 案轉負向文案檢查；原 1,931 案中其餘有效事件、所有權、恢復、還原、設定及清理斷言保持 |

原案例政策映射見[測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v228-正數-xhr-timeout-起播契約)。Node 原生 XHR 替身的送出時間／timeout 及事件紀錄只證明程式契約，不代替瀏覽器計時或安裝實測。

## 安全差異

Codex Security 掃描 174fe7d9-2fba-4fbc-b94d-ecb02a856ac4，固定 ddd41a0..6840815 的七個變更來源／測試檔。能力前置檢查、獨立架構檢查、XHR／量測獨立來源審查及父審查的 UI／測試差異均完成，七檔完整覆蓋；成立漏洞、待釐清候選與未審檔案均零。正式產物已封印並讀回，保存在 Codex Security 工作台：report.md、scan-manifest.json、findings.json、coverage.json、threatmodel.md 與 SARIF。固定掃描快照的舊 timeout 文件敘述已由本版現行指南修正；後續版本與文件維護未改動已掃描的執行期／測試程式。掃描是來源審查，不代替瀏覽器計時或安裝證據。

## 交付與安裝範圍

v2.2.7 五份原件已按位元組搬至 archive/retired/releases/Release/v2.2.7，保留原校驗內容。v2.2.8 腳本 474,008 bytes，SHA-256：`7573766cb33a425a109b5edb2649998e1cf90b6d7f3d8dddf052e338c6bd6027`。五份本機產物已由鎖定工具封裝，公開核對見下節；Release 快照保持封裝時原件，後續結果只追加現行報告。

安裝版尚未驗證。使用者更新並另行授權後，僅依本次缺陷的新專項驗收：固定指定片 P1／Auto／1 倍、一個 IAB 分頁、十五分鐘總期限含最後三分鐘清理、一個九十秒自然窗口；須核對正數 timeout 的合格影片請求、真正起播輪次、探測／選擇、等待後送出與 timeout 保持。每批立即保存去敏證據。一般播放正常不代替此證據；前提不足不改 timeout、重設額度或自動補跑。永久靜音、無網站服務與不要求前景的規則保持。

## 歷史驗證導覽

[v2.2.7 完整正文、R1 與 XHR 調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-完整正文保存2026-11-03)；[歷史導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)；目前工作只見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

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

舊錨點僅保留導引，原文見上列完整歷史保存。

## 發布後公開核對（2026-11-03）

正式 [v2.2.8 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.8) 已發布，非 draft／prerelease，唯一附件為 BiliCDN_TW.user.js。發行提交與標籤解參照為 b58bad4c72aefa6e090a2e0814f01c86ff58ceba；公開核對當時 main 相同，後續 main 僅追加本節及工作結案，不移動標籤。

版本附件與公開 latest 均實際下載並與本機逐 bytes 比對：版本 **2.2.8**、**474,008 bytes**、SHA-256 `7573766cb33a425a109b5edb2649998e1cf90b6d7f3d8dddf052e338c6bd6027`，GitHub asset digest 亦一致。核對時間為 Asia/Taipei **22:50:03**；原始公開核對保存在 .work/v228/public-verification.json。

上一版五份原件、完整報告及三份追加日誌前綴均按原始 bytes 核對；本版五份產物、建置來源雜湊及已掃描程式未變亦通過。文件／封存／差異檢查完成後提交推送 main；不再次升版、封裝或發布。安裝版仍未驗證，原 R1／調查限制及停止決策保持。
