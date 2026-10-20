# BR-01 位置保存、救援時機與 v2.1.27 驗證

日期：2026-10-17（Asia/Taipei）。固定產品基準 ccf947a／v2.1.26。本紀錄隨已授權的三階段修復更新；自然故障起因、安裝版故障注入與歷史矩陣排除。已發布版本及原始調查證據不回寫。

## 第一階段：位置與有條件還原

先重跑正式基準 verify：930 案全部通過。I-P01／I-P04 × 1／2 倍在未修改實作上維持真實失敗，正常零、無歸零、完成與失效對照保留。首個正式位置套件共 16 案；另以固定 ccf947a 來源打包確認四個初始化還原契約真實失敗，沒有改動工作目錄來源或原瀏覽器資料。

Observer 唯一保存可信未完成目標，Adapter 提供內部捕獲／驗證，Recovery 在準備及副作用前重新檢查。有效證明可跨本次自有重載的第一個有界初始化 seek；未知來源及第二次操作不取得例外。位置與倍速各讀取一次，真正零有效，沒有最後非零值回退。

正式新增單元與整合分列：Observer 40、Recovery 48 個隔離單元，位置／初始化整合 20 案，共新增 108 案。初始化路徑含 stall／trusted-player-play、1／2 倍及 recovered 後 15 秒尾段。第一階段完整 verify **1038／1038**，含格式、型別、99 模組架構、可重現建置、語法及封裝檢查；git diff --check 通過。版本暫維持 v2.1.26。

## 後續階段與證據邊界

第二階段先執行 14 個新時序契約，取得 12 fail／2 pass，才修改期限。一般段 5999／6000、11999／12000、長 seek 14999／15000 與 29999／30000、重載後 14999／15000 均以 FakeClock 驗證；原本等待 15 秒的新普通段契約按批准政策改成 5999／6000，不放寬長 seek。

相同事件腳本對固定 d6982c7 與新實作各跑 1／2 倍：舊版實測備援 15000／重載 30000／終止 45000 ms，新版 6000／12000／27000 ms。250 ms 相位偏移的一秒監控排程在 27250 ms 終止，沒有重複動作。原始輸出及 TIMING-COMPARISON.json 保存在本機目錄。此比較不宣稱真實伺服器誤介入率。

補充「較晚進入的死核心 route token」紅色整合案例，確認合併不得把其 4 秒期限改成普通 12 秒；兩倍速都先失敗後修正通過。第二階段新增 10 個 Monitor 隔離單元與 12 個 Monitor＋Recovery 整合，完整 verify **1060／1060**，格式、型別、99 模組架構、完整測試、建置及封裝通過，版本仍為 v2.1.26。

第三階段加入真實 Observer／Adapter／Recovery／Monitor／Runtime 組合的 26 案，涵蓋真正零、2811.002824 目標、SDK 初始化到 3844、音訊隔離、政策失效、每個 seek／rate／play 邊界的新 seek／pause／倍速操作，與成功後 15 個一秒區段。判定器另有 36 個純工具案例，不算產品單元。

整合先揭露兩個邊界：還原跳躍被算成播放進度，以及 play 同步失效時返回拒絕 Promise 未被接住。均保留紅色證據後修正：還原後另建進度基準，並在所有權早退前接住 Promise，舊拒絕仍不能改新狀態。

IAB 自有來源初驗另取得真實 FAIL：子元素 blur 在 window 捕捉階段被誤當視窗失焦，提前撤銷目標。補單元後，同時狹化 Observer 與 VisibilityAdapter 的通知到 event.target === window；既有前景偽裝與 stopImmediatePropagation 語意保留。真正視窗失焦／hidden 仍撤銷；暫停時未知位置變動亦不得冒充進度。原始 SOURCE-FIRST-FAIL／SOURCE-DIAGNOSTIC 與診斷產物保留，不當成通過。

第三階段完整 verify **1134／1134**；正式基準 930 加新產品單元 110、產品整合 58、判定器 36。最終 97d598b 來源八案通過，並以 node:test 重播 8／8、退出 0；初驗 FAIL 與中間成功資料分別保留。自動、來源與實際安裝分開，不將歷史 FAIL 改寫為修復後 PASS。

本機執行紀錄：`.work/br01-fix/2026-10-17-v2.1.27-ccf947a/`。第一輪及第二輪調查仍見 [根因報告](BR01_RCA_R2_2026-10-16.md)。

## 最終來源與安全驗證

最終執行期提交 97d598ba415d65698c062cc5db04efa74af55082；來源本體 SHA-256 55df86a4e9bc96db42736ec466a662f2a486687d803b8f0221e3dd32a8fa7741。I-P01 原生歸零、I-P02 不歸零、I-P03 真正零及 I-R03 初始化還原，各 1／2 倍共八案：前三者保存正確目標，後者確認 seek→rate→play、兩個合格樣本 recovered 與其後 15 個一秒區段。實際可信鍵盤／按鈕由 IAB 派送，媒體／SDK／時間為自有替身；GM 不存在，不混算安裝版故障證據。

每案先取消訂閱、dispose Recovery／reset Adapter，再驗 timer 0 與 SDK 方法還原，最後才釋放 FakeClock。頁面工具監聽器解除／隨自有分頁關閉釋放；沒有安裝 transport held／patterns／breakpoints 或學習樣本。分頁 0，loopback 31999 停止且主機端連線拒絕。SOURCE-RESULT／MANIFEST／CLEANUP、來源 JS／map 與 screenshot 保存在本機證據目錄。

Codex Security scan 6cd20a95-d167-4f23-8f59-2856849ee830 固定 ccf947a..97d598b，前置 3／3、27／27 正式來源項目由主代理及兩個唯讀審查分工完成；0 候選／0 發現、coverage complete、無 deferred。2026-10-16T22:28:58.781986Z 封存；模型與 canonical manifest／findings／coverage／report／SARIF 由工具保存，不回寫前版安全封存。同頁 SDK 因果標記不描述成認證。發布與安裝後續結果見 [TEST_REPORT](../../../docs/TEST_REPORT.md)。

## 證據入口與移入正式套件

- 單元：adapters 登記 rescue-goals（46）及 visibility（2）；application 登記 rescue-recovery（52）、rescue-timing 的 Monitor 單元（10）。
- 整合：application 登記 rescue-position（20）、rescue-timing（12）、rescue-runtime（26）；真實產品單元共同執行一律列整合。
- 純驗收工具：rescue-sustained（36）；負例包含尾段停滯／影格／倍速／身分／動作變更、缺尾段、時間空隙與錯誤位置。判定器通過不代替產品案例通過。
- FORMAL-CASES.json 保存 1134 個具名案例 ID、套件、來源 SHA-256、狀態與退出碼；FORMAL-OUTCOME.json 保存完整逐案結果。SOURCE-REPLAY.json 為八個真實來源結果重播，與正式數量分列。

舊 r1／r2 原始 FAIL、批准等待更正與自然起因未定位保留；本輪不再調查自然起因、不開安裝故障窗口，不宣稱歷史整份矩陣已通過。

## 正式交付及有限安裝回歸

v2.1.27於2026-10-16T22:36:22Z正式發布，main／peeled標籤523a093、唯一腳本及公開latest全文一致：382934 bytes，SHA-256 1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795。公開入口當次受阻、舊本體仍為v2.1.26，使用者完成必要更新後才採用新窗口；完整IIFE380977 bytes／c97b1e15c57f43f2db7ccd2434d3dc8490badae6040eae465b71155865d16188、Tampermonkey5.5.1、Runtime／ControlCenter各1、Fetch／XHR hooks通過。

指定影片Auto1／2倍各暫停／恢復、短seek與15秒正常播放通過，reloadCount均0；持續播放觀察分別取得時間+15.011336／+30.018192秒、影格+899／+1800。控制中心入口受網站覆蓋／鍵盤行為阻擋，直接show先被自動批准審查拒絕，使用者明確授權後才開啟既有介面。原生Tab／Enter可進設定／唯讀診斷，Escape關閉；有效序列設定及使用者／seek修訂未變。入口點擊與返回導覽未算通過，closed Shadow DOM點擊能力、首筆無效UI觀察及修正後結果完整分列於TEST_REPORT。

來源8／8與安裝證據重播6／6均經私有嚴格型別與node:test執行；其中限制紀錄核對不算產品功能通過。恢復原2倍／播放、關閉控制中心及自有分頁，清理斷點／Debugger／5個遠端參照，自有攔截／timer／listener／subscription／wrapper為0。本輪依範圍收束，無自主續測；安裝版故障救援仍未實測，自然起因與歷史矩陣不動。

## 使用者結案決定：跳過入口點擊

2026-10-17 使用者明確指示「控制中心點擊不是重點，跳過」。控制中心入口點擊移出本輪必要驗收，不作結案阻塞，也不安排續測。原始入口／返回觀察及工具限制保留，不改寫為通過；救援修復、發布與其他已完成驗證維持原判定。這是驗收範圍調整，沒有修改產品、正式案例、版本或已發布快照。
