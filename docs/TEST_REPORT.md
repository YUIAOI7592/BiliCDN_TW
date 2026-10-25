# BiliCDN_TW v2.1.36 救援還原閉環與原生寫入所有權驗證

日期：2026-10-25（Asia/Taipei）。基準 20ba3b2／v2.1.35，最終執行期來源 c0bd053，接續檢查點 6b8d4c3。完整紅綠及效益紀錄見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/RESTORE_VERIFICATION_2026-10-25.md)，本頁保存本版完整驗證與交付結果。

## 驗證結果

SDK getter／呼叫期間的新操作撤銷舊原生備援。還原依序核對原生位置與 seeking、原生倍速，再 play 與兩個合格原生進度樣本；SDK 返回、Promise 完成或快取不能冒充成功。命令滿一秒、非 pending／seeking、原生值明確不符且仍有所有權，才允許位置與倍速各一次補正；與既有備援共用額度，失敗不重試。play 前另取原生進度基準，等待期間不算播放時間。

新增 117 案（61 單元、56 多元件整合），最終完整與乾淨 c0bd053 來源各 2842 案通過，tooling 564 案；零失敗、略過、待實作或取消。另含公開 JSON 的乾淨 staged tree b9f6358d5c95d2104e5915934349836a41647af0 亦 2842 案通過，792 個公開輸入雜湊保持。上述已通過證據沿用，沒有重跑已完成瀏覽器窗口。本版另外完成 typecheck、architecture、npm test 及 verify，完整各 2842 案通過；verify 的格式、文件／封存、可重現建置、語法、v2 標記與封裝校驗皆退出 0。

## 行為契約與非干預

真正 Observer／Adapter／Recovery 的正常與忽略 seek／rate／both 各 1／2 倍確認保存目標、補正次數、十五秒連續播放與清理。加入真正 Monitor／Runtime／Routes 的 978 秒目標在六個既有 tick 內 recovered；原生失敗保留原十五秒期限，終止後 120 tick 不重試。這些是合成整合情境，不是網站成功率或延遲量測。

候選 v6、一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻與生命週期額度維持。沒有提前備援、產品新計時器／請求／設定／持久欄位／依賴。

## 本輪安全差異

沿用已完成的最終 Codex Security 掃描 1f186e41-b2b2-43b7-ac8d-bed33e5976cb，固定 20ba3b2→c0bd053，28 個面向完整覆蓋，無可報告發現。本次執行期來源逐檔無差異，沒有將初版只到 0c39818 的掃描替代最終範圍；canonical 報告仍由 Codex Security 管理。版本／文件與自有來源工具變更不擴張產品安全範圍，靜態審查不等於安裝攻擊驗證。

## IAB 來源隔離

本次新對話的 Page.getResourceTree、Runtime.evaluate 與事件讀取正常，沒有修改權限檔或沿用舊拒絕作結論。正常、忽略 seek、忽略倍速、同時忽略、延遲 SDK 與新可信操作各 1／2 倍，十二案 VALID＋PASS；另十三個具名證據重播通過。完整原生樣本、命令順序及逐案清理見 [來源證據 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/RESTORE_SOURCE_2026-10-25.json)。

正常一倍沿用凍結 bundle 7df49fbbdec6ec10080515e482c9d4d7394e944a505e55e8fc86f97cfa2e6d9a；其餘十一案使用修正錯速前提的工具 bundle 9edb372512f86589013db792cad655b8906910e5131448b34a1b72132f30650a（90802 bytes），完整載入本體已核對。修正只處理自有合成 SDK 的 load 重設倍速，正式產品保持 c0bd053。原正常一倍沒有重跑；正常二倍主機收集器參照問題以頁內未截斷完整緩衝從零游標回收，沒有拼接或補跑。

前十案核對原還原意圖 recovered、正確位置／倍速、兩個合格樣本及至少十五秒逐秒時間／影格進度；正常與延遲無補正，忽略項按需各一次且等待至少一秒。新可信操作兩案均撤銷舊意圖，保留暫停及新倍速，後續至少十六秒無 setRate、play 或補正。所有案例只有一次重載，清理確認 timer／timeout／listener／controller 歸零、SDK 方法還原及媒體來源釋放；分頁及服務已關閉，埠無監聽，事件無例外／截斷。

早先 invalid 片段、舊對話 CDP 拒絕與錯誤設定指引原文保留，沒有改寫為通過。本層使用真正 HTMLVideoElement 與原生媒體事實，但 SDK、可見性及監控節拍為自有模型，不代替 Tampermonkey 安裝版或網站故障救援。原十二個五分鐘窗口、自然起因及歷史矩陣保持停止。

## 發布與安裝限制

v2.1.35 完整正文已原文追加保存，五項原始封裝逐位元組歸檔；不回寫舊 Release。v2.1.36 必要自動、安全與來源門檻已通過；確定性完整腳本為 439664 bytes、SHA-256 3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7，封裝五項原件與校驗清單一致。公開交付、latest 校驗與更新後安裝正常回歸已完成，結果見下一節；[封裝當時的報告快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/v2.1.36/Release/v2.1.36/TEST_REPORT_v2.1.36.md) 保留原先尚未執行的時間點，不回寫為發布後結果。控制中心入口依既有決定跳過，不恢復網站故障注入、背景、gate、剪貼簿或歷史矩陣。

### 公開交付與安裝結案

發布提交 110574f；發布時遠端 main 與 v2.1.36 標籤一致。正式 GitHub Release 僅有 BiliCDN_TW.user.js，版本附件與公開 latest 下載皆為 439664 bytes、SHA-256 3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7，與本機完整腳本逐位元組相同。[交付與安裝 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/RESTORE_DELIVERY_2026-10-25.json) 保存公開校驗、初次更新限制、使用者確認後的身分及完整正常回歸資料。

首次公開更新入口停在 Tampermonkey 中繼頁，指定影片實際仍精確包含 v2.1.35 完整本體，當時新版回歸未執行；原紀錄保留。使用者確認更新至 v2.1.36 後，另開新文件核對完整執行本體 437706 bytes、SHA-256 07dae8cec5ba86429093863f2a34bc5a2e3ddc9e00e7618127cf8b4ad9b6a4d3，重載後同樣完整相符。實際 Tampermonkey 5.5.1，Runtime／ControlCenter 各一，Fetch／XHR hooks 均 installed，設定未停用。

指定影片保持 Auto，實際 3840×2160；1／2 倍各完成可信暫停／恢復與方向鍵約五秒短 seek，再於 seeking 結束後完整觀察十五秒。每窗十六筆連續樣本，十五個區段均有時間及影格前進，倍速、媒體／核心與操作身分一致；沒有 waiting／stalled／seeking／pause／error／ended 事件，Recovery 始終 healthy、reloadCount=0。原二倍速保持；自有 timer／listener／subscription、斷點、偵錯物件群組及分頁已釋放。五個具名安裝證據重播通過，另核對五項發布原件保持，獨立於正式 2842 案與來源十三個重播。

本輪公開交付與安裝正常回歸結案；不把正常播放轉算為網站故障救援成功率。來源工具、原始證據、畫面及主機日誌收入本機私有封存；發布標籤、附件及五項封裝原件保持不變，後續只提交現行文件與新證據。

### 文件與封存檢查邊界

2026-10-25 後續另行授權調查：使用者確認將工作區根目錄權限套用到子資料夾後，普通權限正式本機封存驗證退出 0，10351 檔、69 份校驗清單／323 筆通過。原九十個 EPERM 與當時非零結果保留；九十檔仍符合原 bytes／SHA-256，原私有清單不變。修復動作與完整歸因限制見 [工具紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md#2026-10-25舊私有封存-eperm-調查與本機驗證)。這是後續環境驗證，不回寫發布快照或增加產品／瀏覽器案例。

以下段落保存上述權限修復前的發布結案檢查點；當時的本機封存限制已由後續結果解除，其他歷史／私有引用與外部連結限制仍依各自範圍保留。

結案 docs:check、公開 archive:check 與 git diff --check 通過，原三份日誌及還原報告的完整既有正文前綴保持。因本輪工具資料歸檔，另執行 archive:check -- --local：退出 1，既有 2026-10-20-cleanup 的 md-bold-audit/vendor 有九十個檔案因 EPERM 無法開啟；本機檢查報告列 10261 個檔案，不能宣稱完整私有封存驗證通過。本輪來源與安裝證據另有逐檔雜湊及重播，未修改舊私有檔案、權限或原清單以消除錯誤。七個不可變舊失效連結、430 個搬移後原址限制、十八個私有引用未核對及外部未連網連結仍分列。

本次文件狀態核對只檢查指南與既有證據的一致性，沒有重跑本節產品或瀏覽器案例。結果見 [文件維護紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-25文件狀態全面核對)。

## IR36 安裝版救援獨立結果

2026-10-25 另依使用者授權，以 9f8f435／v2.1.36、IAB＋Tampermonkey、指定影片 P1／Auto 執行八案固定範圍。結果為三案 INVALID、五案未執行，沒有 VALID＋PASS／FAIL，未施加有效網站故障或確認產品缺陷。loopback 校準與保留文件的完整本體／singleton／hooks 核對不能替代網站可信尋位；兩種進度區定位都超時後停止共用方法。完整前提、逐案時序、期限偏差與去敏 JSON 見 [本輪報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/INSTALLED_RESTORE_IR36_2026-10-25.md)。

S2 從主機啟動至收束 503.344 秒，超過五分鐘且事件截斷，維持無效；S1 第二次收集器參照遺失，缺受控 ID 尾端持久化稽核，C01 也為 INVALID。最終分頁／攔截／持有請求／自有服務退出、原倍速 2 與 IAB 隱藏狀態還原，但不據此補判完整清理通過。正常播放／Replay 改變的網站續播位置未聲稱還原。21 個輔助工具／證據重播通過，獨立於正式產品測試與原有來源、正常安裝回歸；本輪沒有執行期修改、升版或 Release，全部既有來源隔離及正常回歸證據與限制仍按原範圍保留。

### IR36 第二輪工具修正與原八案

2026-10-25 依另行授權完成可信尋位、文件內 registry、固定截止及受控尾端抑制工具修正，無 GM／登入資料的 loopback 校準後，維持原八案、指定影片 P1、既有 Auto 偏好及 1／2 倍。共十一次嘗試，八案全部 INVALID、C01 INVALID；沒有 VALID＋PASS／FAIL 或確認產品缺陷。B2 有一次合法重載，但原生倍速已等於保存值，不能忽略命令造出不符；其他相關窗口未見合法重載。U 未取得受控 SDK pending，條件式暫停／改速未執行。逐案前提、完整時序、原始失敗與校準限制見 [R2 報告與 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/INSTALLED_RESTORE_IR36_R2_2026-10-25.md)。

R2 首次的舊強制清理在一筆受控請求未完成時解除抑制，無法補證晚到提交未進學習；C01 不因最後資源退出而轉 PASS。後續工具已校準保留抑制直到文件卸載，但不回填早期缺口。所有自有分頁、攔截、服務與偵錯資源退出，原二倍與 IAB 顯示狀態還原；本輪含等待上界約七十九分鐘，各次嘗試／清理在原期限內，未恢復歷史矩陣。逐案 Auto 標籤、originalComparison 及部分精確十秒前置證據不足亦保留，不宣稱全範圍通過。

本輪定向工具二十八案，結案前再補 SDK pending／Recovery 尾端契約；最終正式完整 2883 案（tooling 599）通過，另完成型別與架構檢查。補充工具只做 Node 驗證，沒有新瀏覽器窗口。兩段不可變 Codex Security 工具差異審查無可報告發現；必要檢查與精確範圍見 [工具日誌](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md)。產品來源／版本／Release 未變，沒有自動修復、升版或發布。以上獨立於既有來源隔離與安裝正常回歸，原證據及全部限制保留。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.35 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2135-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。
