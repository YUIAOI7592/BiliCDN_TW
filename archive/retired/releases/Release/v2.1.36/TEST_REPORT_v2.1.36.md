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

v2.1.35 完整正文已原文追加保存，五項原始封裝逐位元組歸檔；不回寫舊 Release。v2.1.36 必要自動、安全與來源門檻已通過；確定性完整腳本為 439664 bytes、SHA-256 3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7，封裝五項原件與校驗清單一致。封裝時公開發布、latest 校驗及安裝回歸尚未執行，完成後只在現行報告追加，不回寫發布快照。控制中心入口依既有決定跳過，不恢復網站故障注入、背景、gate、剪貼簿或歷史矩陣。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.35 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2135-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。
