# BiliCDN_TW v2.2.7 選路、容量與起播探索驗證

日期：2026-11-03（Asia/Taipei）。基準 main／048b0f94e6bb98922ee5bcc0d1b30003cf3b12a9（v2.2.6），程式範圍固定至 5ca6b0c5acc15d5f9e17ee2704fa0105ac819431。各階段先失敗回歸再實作並獨立提交；原研究與 v2.2.6 R1 保留。

## 修復結果與證據邊界

來源共用證據政策、快慢 EWMA、探索名額及資料充分時完成期限已正式採用。保留單一選路／探測／重載所有者、精確 Native 授權、影音隔離、取消與晚到提交檢查。schema 2 與四鍵保持；樣本只增可選數值，舊資料可讀、不強制寫回。沒有新增探測、下載、重載額度、週期計時器、診斷／原線對照／掉幀收集或執行期依賴。

本次只有離線驗證與發布核對，未啟動瀏覽器、更新安裝版或恢復停止窗口；未證實使用者現場多輪切換的唯一根因，不把模型改善稱為實機改善。

## 研究項目完成對照

| 項目 | 已實作規則 | 正式驗證 |
| --- | --- | --- |
| F01／P01 | 同一純政策分組、來源平等；固定與目前沿用有具名例外 | v227-routing、v227-route-owner；原固定／禁止契約 |
| F02／P02 | 五分鐘 sample.at 與 24 小時 TTL 分開，閒置不改測量時間 | v227-evidence、v227-evidence-state；v225 TTL／遠端更新 |
| F03／P04 | 25% 需求裕度＋一般 1 倍，單筆 0.7；早重試 1.35 保持 | v227-routing、v227-startup；UP141-RETRY |
| F04／P03 | 普通同分依候選序號；Catalog-only 首足速提前放行獨立 | v227-startup；UP141-START |
| F05 | 16 KiB 可達性不新增速度／新鮮度、不解除再驗證 | v227-startup、v227-evidence；measurement-state |
| F06 | 健康、充分、時效、重試兩筆實傳資格分開 | v227-evidence、v227-completion；UP141-RETRY 全套 |
| F07／P04 | 隔離到期待再驗證，64 KiB 合法速度成功解除，失敗原退避 | v227-evidence；v227-startup |
| F08／D02 | 三名額中保留一探索，固定游標，不增加預算 | v227-startup；v227-evaluation；原三秒／下載／取消案例 |
| F09／D02 | 精確閉合 Range＋兩秒內有效緩衝；全組 ETA 或全組吞吐 | v227-completion、v227-completion-owner；native-transport 新 Range 案 |
| D01 | 二／五筆 EWMA，快慢與最新取小值，單筆再折扣 | v227-evidence 的排序／去重／升降／邊界；固定模型 |

來源與測試在 [共用容量政策](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/domain/route-capacity.ts)、[證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/domain/evidence.ts)、[完成期限](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/src-v2/domain/route-completion.ts) 及 [具名回歸](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/regressions)。完整操作不變量見 [架構契約](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/ARCHITECTURE.md#選路證據與完成期限)。

## 自動驗證

鎖定 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2、Prettier 3.9.10。執行入口已核對，不啟動網站服務；測試只在暫存位置建立 Git。基線十八套件／1,856 案全部通過。按套件、案例名稱、kind 及參數展開逐項多重集合對照，原案無遺失；新增 75 案，最終 **18 套件／1,931 案全通過**，failed／cancelled／skipped／todo 均零。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 41 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 81 | PASS |
| state | 37 | PASS |
| application | 753 | PASS |
| adapters | 210 | PASS |
| native-routing | 13 | PASS |
| native-transport | 174 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 65 | PASS |
| measurement-state | 94 | PASS |
| progressive-playurl | 29 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 92 | PASS |
| tooling | 201 | PASS |

型別、96 模組架構無循環、完整測試、格式、文件、封存、git diff --check 與 npm run verify 均已通過。verify 完成兩次一致建置、語法、撤除標記、唯一讀取器相關契約與暫存封裝／校驗，不覆寫舊 Release。完整結果保存於 .work/v227/verify.log，原案例多重集合對照無缺漏。

## 政策映射與契約保留

一般需求比 1.2 改判足速，備援分散使用近期足速且 1 倍門檻；原始來源可憑同組更佳證據勝出，冷啟動同分依候選序號。真實 Native 主線可能改選精確備援，測試在 base／backup 中核對相同授權。保留名稱、事件與副作用斷言，沒有刪除有效案例或用常值通過。

舊 V226 T01 兩參數案例改明確使用 2 Mbps 影片，使第三筆單樣本折扣後仍足速，隔離「舊備援不能搶回健康新路線」；新案例另驗單筆不足且有近期足速替代會重選、沒有替代則保留。原未來完成時間替身改為當次時鐘內的真實順序；雙 EWMA 取代分位數數值預期。排名裁切案先建立真實親和再加入十四個更快來源，仍斷言同一決策、目前主機與不在前十二排名。早重試替身明確給本文速度，原資格斷言保持。完整映射見 [測試遷移](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/tests-v2/MIGRATION.md#v227-選路與容量政策對照)。

三頁、單次快照、按需詳細狀態、失效視圖、Native／Catalog／固定／禁止／停用、恢復額度及還原、過期授權、重入／並行、取消、晚到與資源釋放皆沿用原具名契約；兩主機兩表示的 96 種有限交錯仍通過。

## 固定合成模型對照

[離線對照工具](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/routing-evaluation.mts) 使用基準真實純政策與目前真實純政策，共十個固定場景；輸入 SHA-256 為 `41783c5c6cd5c0f38e4b259325fd2b36027b255741f6cb69cc024fea18e68a05`。未來供片與選擇分離；沒有將未選來源缺值算失敗。單位為毫秒／bytes；以下探測均相同最多三個、每個 192 KiB／三秒最壞上限記帳。這是首段模型，未執行 RecoveryController，重載零是模型範圍，不能宣稱真實重載減少。

| 場景 | 主機：舊→新 | 首段可用 ms | 緩衝不足 ms | 新換站 | 新下載 bytes | 新探測數／bytes | 新重載 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| original-faster | catalog.example → original.example | 400.0 → 266.7 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| healthy-current | original.example → original.example | 800.0 → 800.0 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| fresh-insufficient | catalog.example → catalog.example | 400.0 → 400.0 | 0.0 → 0.0 | 1 | 1000000 | 0／0 | 0 |
| historical-capacity | catalog.example → original.example | 400.0 → 266.7 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| small-response | catalog.example → original.example | 306.6 → 61.8 | 206.6 → 0.0 | 0 | 65536 | 0／0 | 0 |
| large-body | catalog.example → catalog.example | 1100.0 → 1100.0 | 100.0 → 100.0 | 0 | 8000000 | 0／0 | 0 |
| unknown-size | catalog.example → original.example | 400.0 → 266.7 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| reserved-exploration | catalog.example → original.example | 3400.0 → 3266.7 | 2400.0 → 2266.7 | 0 | 1589824 | 3／589824 | 0 |
| expired-isolation | catalog.example → catalog.example | 400.0 → 400.0 | 0.0 → 0.0 | 0 | 1000000 | 0／0 | 0 |
| future-divergence | catalog.example → original.example | 300.0 → 5000.0 | 0.0 → 4000.0 | 0 | 1000000 | 0／0 | 0 |

original-faster 與小請求模型可減少等待；future-divergence 則新版選擇實際較慢，明確保留反例，沒有宣稱所有網路分布改善。reserved-exploration 以相同三次預算接觸未知來源。工具四案只驗證模型重現性與政策對照；真實量測資源上限由控制器契約驗證。原提前重試效用 FAIL 仍獨立保留，不混入 verify 全綠。

## 安全差異

Codex Security 掃描 0eaaf6bd-c86d-48fa-af4e-6d621c48323f，固定 048b0f9..5ca6b0c。前置能力通過；獨立架構檢查後由父審查與三組檔案審查完整覆蓋 51 個變更來源／工具／配置／測試檔，未發現成立安全漏洞、待釐清候選或未審檔案。正式產物已封印：report.md、scan-manifest.json、findings.json、coverage.json、threatmodel.md 及 SARIF。範圍為固定程式差異，不等同所有瀏覽器排程／平台隔離證明；後續版本、文件與原件搬移不變更已掃描的程式。

## 交付與安裝範圍

v2.2.6 五份原件已移至 archive/retired/releases/Release/v2.2.6，大小、SHA-256、修改時間與原始位元組均一致；三份追加日誌及研究原文前綴完整保留。v2.2.7 腳本 473572 bytes，SHA-256：`b003602488183398bc9af5a7d4ed42e3280719e794b528b20c81c3387df9b672`。本機五份產物由鎖定工具封裝，公開 main／標籤／唯一附件／latest 核對於發布後追加至現行報告，不回寫封裝快照。本次未執行安裝驗收，不啟動歷史窗口。

## 發布後公開核對（2026-11-03）

核對時間 2026-11-02T19:17:44.292Z（Asia/Taipei 03:17:44）。發行提交及遠端 main／v2.2.7 解參照均為 `80935889d8c01a7f56f4815509f8a3ef034a0303`；正式 [GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.7) 非 draft／prerelease，唯一附件為 BiliCDN_TW.user.js。

公開版本附件與 latest 均實際下載並逐 bytes 比對本機封裝：版本 **2.2.7**、**473,572 bytes**、SHA-256 `b003602488183398bc9af5a7d4ed42e3280719e794b528b20c81c3387df9b672`；GitHub asset digest 亦一致。來源為正式附件與既有更新網址，不啟動瀏覽器或安裝腳本。結果保存 .work/v227/public-verification.json。

發行後 main 僅追加本次核對與工作結案文件；v2.2.7 標籤與五份 Release 快照保持發行原件。三份日誌、研究原文前綴與上一版完整報告再次核對，未更動已掃描的程式或測試。文件／封存／差異檢查通過；安裝版仍未驗證，歷史提前重試效用 FAIL 與停止決策均保留。

## 歷史驗證導覽

[v2.2.6 完整正文與 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v226-完整正文保存2026-11-03)；[所有歷史與停止決策](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。目前工作只在 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

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

舊錨點原文見上列 v2.2.6 完整保存，僅作相容導引。

## v2.2.7 R1 基本安裝驗收（2026-11-03）

使用者已更新並明確授權本輪，基準 main 3950c00e2c15df09aae1bbaa0cc96bce62f7d9df／發行標籤 v2.2.7。只用一個新建 IAB 分頁、指定片 BV1tFZZBQE57／P1／Auto；沒有重新安裝、要求前景、本機服務、故障注入、強制畫質或重開舊矩陣。

T0 保守採第一次 inventory 前的 UTC 時鐘讀值，Asia/Taipei **20:47:07**，精度一秒；21:12:07 起保留清理、21:17:07 硬截止。初始記錄曾把 inventory 中的分頁 metadata 時間 20:47:14.618 誤當 T0，原檔保留並改用更早時鐘，縮短而非延長預算。首次 inventory 的獨立單調起點未量測；正式播放窗口均有頁內單調起訖。瀏覽器工作於 **21:10:29** 清理完成，文件結案在截止前完成，沒有追加輪次。

### R1 結果與範圍

**核心 8／8 PASS；條件式 I6 證據不足。** 一般播放與設定依自己的有效證據成立，不要求完整 Network 或探測自然出現。以下未實測分支不改判 PASS。

| 案例 | 結果 | 實際證據 |
| --- | --- | --- |
| E0 能力 | PASS | type=iab；同源 CDP 讀寫、實際 isTrusted 滑鼠事件與清理成立，未操作外部 Chrome |
| I0 安裝身分 | PASS | Tampermonkey 5.5.1／2.2.7；已載入完整本體與發行檔逐 bytes 相符，473,572 bytes／SHA-256 b003602488183398bc9af5a7d4ed42e3280719e794b528b20c81c3387df9b672；Runtime／Transport／ControlCenter 各一，Fetch／XHR 安裝與所有權快照 installed |
| I1 Auto 1 倍 | PASS | 60,003.9 ms、242 筆；前進 60.000786 秒，全程靜音、無暫停／尋位／結束／媒體錯誤，沒有兩秒無進度 |
| I2 Auto 2 倍 | PASS | 60,001.3 ms、242 筆；前進 119.916792 秒，全程靜音、無暫停／尋位／結束／媒體錯誤，沒有兩秒無進度 |
| I3 容量與倍率 | PASS | 安全吞吐、當前主機、近期容量、需求及餘裕均有實際值；1／2 倍的原生倍率、模型及畫面一致，影音 206 摘要各自呈現 |
| I4 三頁與詳細狀態 | PASS | 正常可信入口、總覽／CDN／播放設定切換、詳細文字原先為空且點擊後建立、關閉重開成功；沒有退役頁面 |
| I5 Native 保存 | PASS | 原始 false 經可信 checkbox 變為 true，實際 GM 持久值讀回 true；核對當次寫入修訂後再由 UI 復原 false，其他設定保持 |
| C0 清理 | PASS | 兩個自動截止觀察器、一次性輸入觀察、斷點／Debugger、遠端引用與 UI 訂閱均釋放；暫停並保持靜音、恢復 1 倍後關閉唯一自有分頁，剩餘零個 |
| I6 自然起播／探索 | 證據不足 | startup=skipped、xhr-explicit-timeout、candidates=0；網站明確 timeout 的正常跳過與畫面提示相符，未消耗起播窗口，但不能算三候選／探索名額實測通過 |

開始時 Auto 曾選 3840×2160，兩個正式窗口均為 **1280×720／av1**；沒有強制畫質，不宣稱本輪完成 4K／8K 窗口。開始至真正媒體靜音讀回的區間不計播放窗口；沒有追加起播前靜音門檻。

### R1 數值、來源與限制

同份模型／UI 核對的 1 倍讀值為安全吞吐 **32.358223 Mbps**、需求 **2.00 Mbps**、餘裕 **16.179111 倍**（畫面 32.36／16.18）；2 倍為 **10.850675 Mbps**、需求 **2.083395 Mbps**、餘裕 **5.208170 倍**（畫面 10.85／2.08／5.21）。兩次皆為目前影片主機 upos-sz-mirroraliov.bilivideo.com 的近期充分容量。該 720p 表示 bandwidth=833358；1 倍觸及 2 Mbps 下限，2 倍按真實倍率計算，所以此片需求不會恰好翻倍；兩次速度亦有新樣本，不能將全部餘裕變化歸因倍率。

準備期間亦觀察到影片由 upos-sz-mirroralib.bilivideo.com 回應，音訊由 upos-sz-mirroraliov.bilivideo.com 回應；正式總覽核對時兩者均有各自 206 摘要。這些是腳本歸因的正常傳輸，不是「測速抽中的節點」，也不冒稱獨立 Chrome Network 最終目的地證明。未觀察到起播主動探測或完整健康輪次，沒有為湊條件增加流量／重設冷卻。關閉的提前重試與三個 HK override 原值保持；沒有清除學習或既有禁止資料。

三候選探索、隔離到期再驗證、五分鐘／24 小時到期、主動完成期限決策、HTTP 故障、過期許可、重載／補正及提前重試效用均未另開安裝矩陣。詳細狀態有目前請求完成預估，這只證明當前顯示資料可用，不證明預測準確或模型效益。原 FAIL／INVALID、停止決策及現場唯一根因未確認狀態保留。

網站入口需先展開「更多播放设置」。一般 AX／locator 無法讀取產品封閉 Shadow DOM，改用限定 CDP 原生滑鼠與唯讀節點內容核對；沒有修改 isTrusted、直接呼叫產品命令或改造媒體 getter。倍速使用真正 HTMLMediaElement setter 並讀回，無控制器重建或 tick 呼叫。

### R1 證據與清理

私有去敏證據位於 .work/iab-testing/2026-11-03-v2.2.7-3950c00-r1：BASELINE（含原始時間記錄與修正）、IDENTITY、INITIAL、INPUT-CALIBRATION、I1／I2 原始連續樣本與模型、I3 數值、I4 三頁／詳細／重開、I5 持久讀回／復原、CASES、SUMMARY、CLEANUP、CHECKPOINT／RERUN 與實際截圖。未保存簽名媒體 URL、Cookie、IP 或播放器物件。

原生媒體在清理時 paused=true、muted=true、rate=1；控制中心關閉、訂閱零、視圖與鍵盤釋放，工具 registry 均不存在、無自有攔截／持有請求／包裝／受控樣本；遠端物件引用釋放，自有 IAB 分頁零個。產品、測試、版本、Release 及標籤保持；本次僅更新文件並執行文件／封存／差異與原件核對，不冒稱重新跑過 1,931 案。是否有新工作只看 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。
