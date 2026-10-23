# BiliCDN_TW v2.1.32 量測中繼資料驗證

日期：2026-10-24（Asia/Taipei）。基準 ac44474／v2.1.31，執行期修復 5fa25f8。只改善量測中繼資料的驗證與既有鎖內提交，不新增設定、持久欄位、依賴或計時器。

## 驗證結果

新增三十五個具名契約：三十個單元、五個真實 Store／MeasurementController 整合案例。原產品首次三十一案為九通過／二十二失敗，退出 1；額外健康游標上限案例在修正前使三十五案為三十四通過／一失敗，退出 1；最終三十五案全部通過，退出 0。正常對照、原始失敗、各階段來源雜湊及逐案名稱保存在 [公開 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/MEASUREMENT_METADATA_2026-10-24.json)。

功能來源完整 verify 1904／1904，較 v2.1.31 增加三十五案；型別、102 模組架構、格式、文件／封存、確定性建置及封裝通過，沒有略過、取消或待實作。七百項輸入的乾淨來源副本 npm ci 與完整 verify 均退出 0，輸入雜湊不變，副本已清理。升版後的最終完整與乾淨來源核對在交付時另記。

原工具程序的暫存 Git 權限失敗及測試型別／格式調整均保留在本機日誌，完成修正後重跑；不以失敗執行宣稱通過。新案例屬既有正式 measurement-state 套件，沒有獨立產品測試橋接。

## 行為契約與非干預

MeasurementMetaStore 只讀 schema 2 的自有資料描述子，拒絕陣列、繼承欄位、accessor 與數值強制轉換。catalogCursor 限非負安全整數；lastChallengeAt 限有限、非負且不晚於明確注入的目前時間，合法小數與真正零保留。非法欄位各自歸零，不連帶丟棄另一合法值。

get 重新讀取最新儲存，不寫入或遷移；update 以最新合法值合併，非法部分更新保留合法目前值，只寫 schema、catalogCursor、lastChallengeAt、updatedAt。未知歷史欄位只在明確更新時不再保存，不事後清空其他使用者資料。回傳副本互不影響；儲存 get／set／delete 例外保持原傳播語意。

起播選擇仍使用同步快照，不因等鎖延長起播期限。既有 withLock 回呼取得鎖後先核對標記、重讀目前游標，再核對標記及遞增；兩個等待者與外部更新不再被舊游標覆蓋。起播與健康量測游標達安全整數上限時歸零。健康計畫繼續在既有鎖內重新檢查資格、保存冷卻與安排工作。

只有 MeasurementController 啟動主動探測；路線、授權、親和、恢復、控制觀察與診斷所有權不變。完整既有契約維持一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻、生命週期兩次重載、位置／倍速、新操作、晚到 Promise、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick；候選 v4 不變。

## 本輪安全差異

新的 Codex Security 掃描 b0be17ea-8c04-4dc4-b6c4-e8cf890c80a7 已完成封存，固定 ac4447451c22125931feb56535b1854ec86712e1 至 5fa25f82d675eef14bc177279d978ceb1b3030d1。六項來源清單與四份變更指南完成檢查，獨立架構審查交叉核對；零可報告發現、無待判定候選。這是指定差異審查，不是全案無漏洞保證。後續版本／文件／封裝記帳由自動核對承接，不宣稱掃描涵蓋所有後續提交。

工具回報總 token 5,780,067，coverage 為 partial，包含快取及共用歷史，另有缺失 thread；不作本次獨立掃描成本。

## 來源隔離

IAB 自有頁面載入真實 Store 與 MeasurementController，以記憶體儲存、模擬 probe 和原生 Web Locks 驗證八項：原生鎖可用、非法游標獨立預設、唯讀不遷移、四欄白名單、未知 getter 零執行、起播不等待被持有的 metadata 鎖、兩個排隊回呼保存最新游標及冷卻，以及清理。全部通過；自有 timer、活動鎖及儲存項目歸零。

單頁兩個控制器不是實際跨分頁 GM 驗收。未接正式 GM 或執行真實 CDN 探測；來源分頁及服務已關閉。第一次本機服務在受限程序中無法由 IAB 連線，沒有產品斷言；改用主機服務後完成。原錯誤分頁由使用者關閉，工具已核對不存在。

修正後工具呼叫送出至返回為 4014.3937 秒總間隔；實際執行、批准等待及其他等待沒有分離量測，均保留未知，不能據此判為執行超時。

## 發布與安裝狀態

v2.1.31 完整報告原文追加保存，五項 Release 依原 bytes／SHA-256 搬入公開封存。[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_5fa25f8.json) 保留原保護資料。v2.1.32 正在完成最終封裝與公開發布核對；安裝版尚未驗收，不以來源隔離替代。

## 發布與安裝限制

普通欄位讀取不執行 getter 或強制轉換，但 Object.getOwnPropertyDescriptor 仍可能觸發 Proxy trap；沒有承諾任意 Proxy／受損 GM 平台隔離。缺少 Web Locks 時沿用直接執行退化，不宣稱跨分頁互斥。get／update／clear 本身不另外加鎖。

時鐘非法時以零處理；時鐘倒退使原冷卻落在未來時，該欄失效歸零。沒有新增跨分頁單調時鐘；探測仍須通過原資格與額度。白名單是明確 metadata 更新的持久邊界，不是全儲存清理或安全沙箱。

安裝版只另行核對管理器、完整本體、唯一實例、hooks 與指定影片 Auto 1／2 倍正常播放、暫停／恢復、短 seek 及十五秒進度。控制中心入口維持依指示跳過；自然起因、故障注入、背景／gate／剪貼簿、六組五十秒樣片與歷史矩陣不重開。不宣稱真實卡頓率或救援成功率改善，不啟用提前備援。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.31 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2131-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊結果保持。
