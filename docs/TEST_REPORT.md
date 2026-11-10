# BiliCDN_TW v2.2.17 完整驗證報告

發行驗證日期：2026-11-10（Asia/Taipei）。修復基準 main／f7fa3c4、v2.2.16；發行採離線方式。2026-11-11 另依使用者授權完成下方 R1 安裝專項及 R2 受控補驗。

## 驗收結論

假停滯與恢復後的提前重試抑制已修復並發布 v2.2.17。十八套件／2,416 案通過，原 2,387 案名稱、參數展開及相對註冊順序完整保留；新增 25 個應用與四個 UI 案例。安全差異、完整 verify、格式、文件、公開／本機封存、差異及公開下載核對通過。

更新後 R1 已確認安裝身分、正常播放的短間隔採樣信用，以及尋位停滯後達十次／十秒才解除抑制的接線。低緩衝下仍保留段落的 `stable-retained` 分支未出現；實際重試介入及播放收益仍未證實。詳見下方專項，不概括為所有實機分支通過。

R2 以真實控制器、選路、儲存及 XHR 適配器完成低緩衝受控整合：解除段落抑制、真實許可與模擬網站交接、已用重試／備援／重載額度保持，以及獨立健康確認後重新開放均通過。沒有開啟瀏覽器；安裝版低緩衝分支與實際重試收益仍未新增驗證。

## 自動驗證

當次依賴工具取得 Codex 內建 Node 24.22.1；使用明確執行檔，父子 Runtime 一致，未使用 npm CLI。這是實測環境，不是新的 Node 版本鎖定；九項開發依賴保持。型別三組、109 個模組的架構與完整測試均已通過，failed／skipped／todo／cancelled 為零。最終 verify 的 2,416 案用時 28,715.4 ms，包含匯入純度、可重現建置、語法、撤除功能禁止標記及暫存五項封裝／校驗；不啟動網站服務。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| architecture | 52 | PASS |
| imports | 1 | PASS |
| domain-boundaries | 3 | PASS |
| domain | 111 | PASS |
| state | 81 | PASS |
| application | 874 | PASS |
| adapters | 214 | PASS |
| native-routing | 13 | PASS |
| native-transport | 222 | PASS |
| orchestration | 40 | PASS |
| adapter-boundaries | 84 | PASS |
| measurement-state | 135 | PASS |
| progressive-playurl | 64 | PASS |
| progressive-routing | 71 | PASS |
| progressive-transport | 4 | PASS |
| playurl-summary | 22 | PASS |
| control-center | 112 | PASS |
| tooling | 313 | PASS |

先建立九個正式反例／控制案例，修改前八案失敗、一案控制通過。最終原案例名稱、參數與相對順序逐項對照通過。基線工具套件的沙箱 Git／Bash 存取限制另記，相同來源在允許暫存 Git 操作的環境通過；沒有放寬斷言或期限。

同輸入九組對照以固定 Git 基準非入口來源執行：999／1,001 ms 與固定 999 ms 正常前進不再觸發多餘備援；低緩衝穩定後能進入原有重試評估；真正停滯的 ID、起點、備援／重載截止及副作用序列保持。BR-07 另外核對 14,999／15,000 ms 精確邊界。詳細政策映射與原始證據索引見[實作紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/PROGRESS_STABILITY_v2.2.17_2026-11-10.md)。合成 arm 不代表網站已認領或播放效益。

## 安全差異

Codex Security 已完成並讀回不可變 f7fa3c4→ea09ca0 的 canonical 封印，scan ID ab1fd296-fbb1-45d9-ba30-362c5dd63275。全部 31 個變更檔案覆蓋，確認漏洞、未結案候選與 deferred 為零；執行模型 gpt-6-astra／xhigh。後續 b59ab8d 僅強化既有期限測試，執行期不變；版本、文件及封裝另行核對。

掃描回報部分 rollout 計量：input 9,468,681（cached 9,095,936）、output 32,732、total 9,501,413 tokens；三個可取得 thread，另有 rollout_unavailable，因此不是完整耗用或費用。安全範圍已完成，計量缺口不冒稱完整統計。

## 功能與政策保持

進度與採樣信用分開：十次且十秒取得重試／停滯穩定資格，二十次且二十秒取得健康探索穩定資格。999 ms 有效；長缺口、重複與未知時間不補造信用。穩定但低緩衝時保留原停滯段及額度，只有十秒緩衝才能結束；重試自己的健康額度重新開放另行確認。

Recovery 的兩筆進度、還原及絕對期限不變。正數 timeout 仍可起播測速、仍不取得提前重試資格。Native 精確授權、黑名單／熔斷 W／G／C、需求公式、schema 2、四鍵及探測／重載／重試上限保持。三頁與單次快照、立即設定刷新、按需詳細狀態保持；沒有恢復診斷或新增收集器。

## 來源隔離與實際安裝

發行時沒有啟動來源隔離、IAB 或 Tampermonkey 驗收；更新後的新 R1 結果另列下方。v2.2.16 的載入與初始化只屬舊版，原文與限制保留於下方相容入口。原提前重試六情境效用 FAIL、自然交接、跨分頁與實機因果缺口保持；離線契約通過不宣稱實際播放收益，不恢復已停止窗口。

## 公開交付與安裝結案

v2.2.16 五份 Release 原件已與 f7fa3c4 逐位元組比對，標準 TAR＋gzip 及獨立解壓核對完成；原始雜湊不變，完整舊報告含 R1 已原樣加入歷史。公開封存 519 個搬移項目、三份追加日誌及本機原有 9,372 份資料通過；本輪新增 37 件核心證據與安全原件亦完成壓縮、獨立還原及既有檢查器核對，原始結果與中間失敗保持。

2026-11-10 22:33:31（Asia/Taipei）公開核對：發行 main 與 v2.2.17 標籤解參照均為 149f697a2eb3856b89e9181d7bc515b7155efe5d；[正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.17) 非草稿／預覽版且為 latest，唯一附件 BiliCDN_TW.user.js。版本附件與既有精確 latest 網址均實際 GET／HTTP 200、@version 2.2.17、543,717 bytes、SHA-256 b6dff6e3cecd48eb40589587ae2093e47ad38a34f56c1fc76c3288accec1967b，與本機及 GitHub asset digest 一致。

封裝報告保留當時待公開核對的文字；後續只更新現行文件，不回寫五份原件或移動標籤。後續 main 的文件提交不代表另一版產品；發行輪次沒有新增安裝驗收，後續 R1 另列。

## v2.2.17 R1 採樣與抑制專項（2026-11-11）

依使用者更新後的專項授權，凍結 main／2c3444ff28f9c766d4ebe3014884e5a996813549。以 01:02:16 的能力檢查前時鐘作保守起算，最多三十分鐘、最後五分鐘只清理；01:14:37 已關閉唯一自有 IAB 分頁。固定 BV1tFZZBQE57／P1／Auto／1 倍；一個三分鐘正常播放窗口，加一次網站進度列尋位後的兩分鐘窗口。沒有重跑選單、三頁、設定保存、正數 timeout 或熔斷窗口。

| 案例 | 判定 | 實際證據與界線 |
| --- | --- | --- |
| L0 安裝身分 | PASS | Tampermonkey 5.5.1、GM_info 版本 2.2.17；完整執行本體與 543,717-byte 發行原件逐字相符，SHA-256 同上。Runtime、Monitor、ControlCenter、EarlyRetry、Transport 各一個實例，Fetch／XHR hooks 均 installed |
| P1 正常播放及短間隔 | PASS | 固定 180,000 ms、180 筆，位置前進 179.998611 秒；全部 progress／healthy，沒有停滯段或恢復動作。179 組相鄰產品採樣間隔為 996.2–1,003.6 ms，其中 64 組不足一秒，每組仍增加一次信用並累積相同有效時間 |
| R1 尋位後穩定解除抑制 | PASS，限已觀察分支 | 一次正常尋位後捕捉 stalled→confirming→settling；同段 ID、起點與截止保持。第十次有效進度、10,002.7 ms 時段落結束，重試由 stall-confirming 回到 waiting／no-qualified-request；未提早解除 |
| 低緩衝保留段落 | 未觀察到 | 穩定門檻成立時緩衝約 31.13 秒，已超過十秒，沒有 stable-retained 樣本。不能用上述段落結束分支替代低緩衝保留額度分支；該項僅沿用既有離線契約 |
| 實際重試介入與收益 | 未驗證 | 兩窗 attempts 均為零；no-qualified-request 表示已進入評估而沒有合格請求，不代表網站已重送或有效益 |
| Z0 清理 | PASS | 真正媒體 paused=true、muted=true；兩個非暫停觀察點移除、採樣 interval／截止 timer 清除、registry／媒體引用刪除、物件群組釋放、Debugger 停用，自有分頁數為零 |

正常窗口緩衝為 67.61–76.57 秒；觀測期間 Auto 顯示 4K，沒有強制畫質。尋位窗口共 120 筆，117 筆 progress、兩筆 owner-changed、一筆 stalled；11 筆保留同一停滯段，recoveryActive 均為 false。這是網站尋位的真實停滯與抑制接線，沒有執行 SDK 重載／還原，不外推為 Recovery 所有分支。

採樣完整性分開核對：P1 最大缺口含尾段 1,007.7 ms、截止延遲 1 ms；R1 為 1,012.1 ms、5.9 ms。兩窗來源容量 2,000 列，overflow／採樣錯誤均為零；媒體身分、1 倍、靜音及無媒體錯誤保持。來源固定截止，工具晚取回沒有延長窗口。正式窗口前游標之後沒有 Debugger 暫停事件，也沒有事件淘汰。

方法限制原樣記錄：校準的兩個非暫停斷點未取得資料，原因未識別，已於正式窗口前移除。改用已核對純讀取的 Monitor／EarlyRetry 當前 snapshot，由臨時一秒採樣器複製窄數字與分類；沒有產品訂閱、傳輸包裝、控制命令、網路故障或額度重設。讀取有時序成本，快照也不是完整事件歷程。R1 首次增量讀取誤沿用 P1 游標而回傳空批；來源有界陣列仍完整保存，後續按 seq 保存全量有界批次並核對 1–120 連續，沒有補造資料。十秒取回為盡力排程，部分較晚，與來源採樣缺口分開計算。

本輪未寫入產品設定、未修改 timeout 或清除／回灌學習；正常播放的合法學習保留。新證據與分析執行器依既有 schema 2 私有封存保存，公開文件不列私有成員。只更新文件與證據索引，不修改產品、正式測試、版本、Release 或標籤；文件、公開／本機封存、獨立還原及差異檢查後主動提交推送 main。

結案核對：39 件包內原件由系統 tar 獨立還原、既有 ArchiveStorage 核對，連同另存清理截圖共 40 件與來源逐位元組相符；本輪散件及還原副本已清除。文件檢查與公開／本機封存通過，三份日誌既有前綴保持。沒有重跑完整產品測試或 verify，原離線 2,416 案與本輪實機結果分開。

## v2.2.17 R2 低緩衝與額度受控補驗（2026-11-11）

凍結乾淨 main／f57ca6af055dd5bf19debdd9fc9cf7e216ee8cd3，記錄全部 499 份 Git 追蹤檔案雜湊。使用當次 Codex 內建 Node 24.22.1；採注入時鐘與獨立串行鎖記憶體儲存，時間數字屬模擬時間，不是真實播放時長。01:59:39 起算，總上限六十分鐘；受控執行器均已結束並釋放資源，沒有重跑 R1、正式 2,416 案、verify 或其他瀏覽器功能。

真實元件包括 Monitor、Recovery、EarlyRetry、RouteCoordinator、Session、Vault、相關 Store、Runtime 事件接線、PlayerAdapter 及 XHR 傳輸適配器。替代站證據由普通 XHR 成功終止、歸因及確認保存建立，沒有直接填入成功帳本、設定段落或清除額度。播放器／SDK、原生 XHR、時鐘、排程及儲存為外部窄替身；起播／量測不在本輪範圍，沒有探測。Node 合成事件的可信標記只證明適配器契約，不是瀏覽器原生可信事件證據。

| 案例 | 判定 | 已核對結果 |
| --- | --- | --- |
| C1 低緩衝解除抑制 | PASS | 五秒緩衝；九次／9,000 ms 仍為 stall-confirming、arm=0。十次／10,000 ms 進入 stable-retained，原段 ID、起點及截止保持；真實 prepare、arm 各一次 |
| C2 已用重試額度保持 | PASS | 模擬原生 timeout→網站重送→真實認領→原生接受→成功終止成立；親和在原生 send 接受後才提交。另一筆符合其他資格的新請求仍被 episode-used 拒絕，attempts／arm 保持一次 |
| C3-A 已用備援保持 | PASS | 真實選路提交一次備援並經 Runtime 交接恢復。十次／十秒後原段 stable-retained、action=spent、fallbackAvailable=false；再次停滯七秒，段落／截止不變，沒有第二次備援或 SDK 重載。此案不宣稱已下載備援網路資料 |
| C3-B 已用重載保持 | PASS | 正常期限經真實 Recovery 派送一次 SDK 替身重載，完成成功還原後進入 stable-retained；再次停滯十三秒，reloadCount=1、剩餘次數=1、SDK 重載仍一次，原段及截止保持 |
| C4 段落結束與重試額度分離 | PASS | 短暫十秒緩衝可結束 Monitor 段落，回到五秒仍為 episode-used。獨立健康確認第十筆僅九秒，仍未開放；第十一筆達十秒後解除段落額度限制。再提供合格低緩衝機會，prepare／arm／認領累積各二次，沒有途中 reset |

固定需求為 4 Mbps × 1 倍 × 1.25＝5 Mbps。慢請求總量 1,000,000 bytes、已收 100,000 bytes、近期速度 50,000 bytes/s，原路預測剩餘十八秒；兩筆合格替代實傳推導保守容量約 26.667 Mbps、本文 40 Mbps、等待 100 ms。替代總時間為 2,000＋100＋200＝2,300 ms，包含一次兩秒交接預算，符合五秒緩衝的四秒期限；預測差 15.7 秒只是公式結果，不能視為實際收益。獨立分析器核對數值、序號、選路提交順序、段落與額度軌跡。

方法校準原件保留：首次誤將選路決策回傳值當布林；之後發現最初兩筆請求尚未確認表示，不能作替代站實傳信用，遂補足經正常流程保存的合格請求。另一次 C4 已由真實排程提早 arm，執行器卻尚未設好模擬網站接手，造成後續讀不到在途樣本；改在高緩衝準備該請求，再降至五秒檢驗。這些為方法／前置失效，原執行器 FAIL／INVALID 字串仍保存，不列為產品失敗。C3-A／C3-B 已通過的軌跡直接採用，沒有因後續記錄調整重跑。獨立算式的浮點尾差改以毫秒核算，沒有變更產品門檻或斷言預期。

清理通過：三組獨立情境均等待結果保存收束，停止 Runtime、結束本地 XHR 並釋放 scope；原 hooks 還原，活動請求、排程工作、鎖佇列及儲存訂閱為零。真實網路、正式 GM 與探測呼叫為零；Node 程序結束釋放本地合成事件回呼與引用。正式學習資料沒有被讀作情境、清除或回灌。五項私有驗收與三組執行序列另列，正式案例數保持 2,416。

結論：**低緩衝保留停滯段時，解除提前重試抑制及已用額度保持的受控整合通過；安裝版低緩衝分支與實際重試收益仍未新增驗證。** R1 原文、原效用 FAIL 與其他證據限制保持。產品、正式測試、依賴、版本、Release 及標籤不變；證據壓縮、獨立還原及文件／公開與本機封存／差異核對完成後，只提交推送文件與索引。

結案核對：22 件原件共 977,884 bytes，壓縮為 183,327 bytes；由系統 tar 獨立解壓，再經既有 ArchiveStorage 及逐檔原始位元組核對。本輪散件與還原副本已在再次核對 SHA-256 後移除。文件檢查通過 299 份 Markdown／4,871 個本機或儲存庫連結；公開及本機封存通過，私有原件共 9,480 件。另核對 493 份範圍外追蹤檔案未變、R1 正文完整、三份日誌既有前綴與版本標籤保持；歷史斷鏈與未核對項目沿原分類保留。

<a name="v2216-r1-載入身分與選路提交接線2026-11-09"></a>

[v2.2.16 R1 原始載入、方法錯誤及限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2216-r1-載入身分與選路提交接線2026-11-09)。

<a name="v2215-r1-載入身分與模組初始化2026-11-09"></a>

[v2.2.15 R1 原始載入判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2215-r1-載入身分與模組初始化2026-11-09)。

## 歷史驗證導覽

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
