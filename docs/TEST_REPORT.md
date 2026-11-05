# BiliCDN_TW v2.2.11 完整驗證報告

日期：2026-11-06（Asia/Taipei）。以 aadbc48／v2.2.10 為產品基準，實作新版熔斷降級與本頁穩定觀察，保留快速逐筆失敗隔離及原四級時長。

## 驗收結論

本版採離線交付；十八套件／2,106 案通過，failed／cancelled／skipped／todo 均零。原 2,048 案名稱、kind 與參數展開完整保留，新增 58 案。型別、架構、唯讀格式、文件、封存、git diff --check、兩份安全差異封印及補強後的最終 verify 均已通過；兩次建置、語法、暫存封裝與校驗一致。五項正式封裝及公開 main／標籤／唯一附件／latest 核對均完成，詳下列公開紀錄；發行快照不回寫。

新版安裝驗收、來源隔離、自然熔斷、真正 GM 跨分頁同步及實機效益均未執行；不啟動瀏覽器、不恢復停止窗口。v2.2.10 已通過的安裝驗收及各輪限制完整保存於[舊版正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-完整正文保存2026-11-06)，不將其通過狀態轉移到本版。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2／Prettier 3.9.10，命令不啟動網站服務。基線初跑 2,039 通過、9 個 tooling 暫存 Git 配置寫入遭沙箱拒絕；單獨在具備權限的環境重核 tooling 203／203 通過，原失敗保留。實作後完整回歸全部通過。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 106 | PASS |
| state | 56 | PASS |
| application | 811 | PASS |
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
| control-center | 96 | PASS |
| tooling | 203 | PASS |

逐案多重集合沒有遺失；原始結構化結果及對照保存在本機 .work/v2211，不作正式建置／測試輸入。

## 政策與契約對照

[執行紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/CIRCUIT_OBSERVATION_v2.2.11_2026-11-06.md#政策與狀態) 保存正式政策、舊預期映射及方法限制。W／G／C=300／120／60 秒為使用者選定初始值，不宣稱實機最佳。失敗每筆升級、四級期限保持且不得縮短舊截止；普通／探測成功不直接降級，24 小時速度過期不清除故障等級。

新增領域 9、狀態 14、執行期／傳輸 31、UI 4 案，核對精確期限、未決屏障、舊請求不續接、逐級恢復、清除世代、紀錄淘汰重建、修訂耗盡、未知寫入、無共同鎖，以及兩個真實 Store／不同頁面時間原點。模型不能冒稱 Tampermonkey 真正跨頁同步。原儲存重入案例改攔截實際 commit，原學習、親和、事件及摘要斷言不減少。

獨立審查發現的同窗口並行成功交錯，已先以真實 RouteCoordinator／EvidenceStore 回歸確認原提案錯失降級，再改用窗口 ID／epoch 及目前證明核對；保留所有失效與期限檢查。繼承的普通 XHR 合成事件來源不列為本差異新增漏洞，但新版信用另要求可信終止與相符可信 bytes；三個傳輸案例與一個領域整合負向案例核對正數 timeout、原生 send 一次、普通學習保留及降級拒絕。這些都是 Node 契約，不冒稱瀏覽器原生事件驗證。

## 安全差異

Codex Security 初掃 2d7b6e81-e7e4-4665-b5c3-62cf261178ad，固定 aadbc48..7f442d3、25 個變更來源／測試檔；補充掃描 d86d8bac-dc4d-4055-a373-d631f92a5ccf，固定 7f442d3..94a3531、6 檔。兩輪能力前置檢查 ready，具獨立架構核對、逐檔來源審查及父代理補核；成立漏洞、未結安全候選與未審來源均零。兩份正式產物已封印並讀回。不以全綠契約替代安全審查，也不以靜態審查宣稱原生或安裝版通過。

## 交付與安裝範圍

v2.2.10 五份 Release 原件已依原始位元組封存並核對；本版腳本 512504 bytes，SHA-256：`55133271b78b0265974b64fb713ff68b5d07c40d9df89bf67c988ed453d73acf`。本版五項封裝與公開 main／標籤／唯一腳本附件／latest 已核對一致。不改 Native 預設、既有布林、schema 2、四鍵、三頁及現有網路／恢復額度；沒有診斷、原線對照、掉幀或剪貼簿收集。

完整新政策只保證新版分頁協作；舊版分頁仍可按舊規則寫入。無共同鎖或無法確認儲存時禁止降級；觀察只採本頁普通實傳，不跨頁拼接稀疏成功。

## 公開交付核對（2026-11-06）

發行時遠端 main 與 v2.2.11 均為 `b9f6f57040404512184242a9d9c32e95f86dc3d7`。[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.11) 為非草稿、非預發行，唯一附件 BiliCDN_TW.user.js；附件及公開 latest 已分別重新下載，均為 2.2.11／512504 bytes，SHA-256：`55133271b78b0265974b64fb713ff68b5d07c40d9df89bf67c988ed453d73acf`，與本機完全一致。

後續文件提交只前進 main，v2.2.11 標籤維持發行提交。封裝報告保留當時公開核對前的狀態，現行本文追加結果；未啟動安裝版驗收、更新瀏覽器或恢復歷史窗口。

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
