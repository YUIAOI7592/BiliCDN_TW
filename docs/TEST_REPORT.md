# BiliCDN_TW v2.1.31 可見性屬性還原所有權驗證

日期：2026-10-24（Asia/Taipei）。基準 f582069／v2.1.30，執行期修復 c65c506。上一版完整正文已原文追加保存；已發布五檔、歷史結果與安全原件不回寫。

## 驗證結果

新增三十五個具名契約：三十三個 VisibilityAdapter 單元案例、兩個真實 Runtime 整合案例（1／2 倍）。在未修改產品上，同一批斷言為十八通過／十七失敗，退出 1；修復後三十五案全部通過，退出 0。正常還原對照在紅色階段即通過。逐案名稱、來源雜湊、失敗與修復後結果見 [公開證據 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/VISIBILITY_OWNERSHIP_2026-10-24.json)。

功能來源及升版後完整 verify 均為 1869／1869，較 v2.1.30 增加三十五案；型別、102 模組架構、格式、文件／封存、確定性建置及封裝通過，無略過、取消或待實作。來源階段的乾淨副本有六百九十項輸入；加入 v2.1.31 封裝與公開證據後的新副本有六百九十七項。兩次 npm ci 與完整 verify 均退出 0，檢查前後輸入雜湊不變。最後報告與日誌補登只另跑文件、封存及差異核對，不冒稱新增執行期測試。

初次綠色執行有兩個整合案例錯把既有 Lifecycle reset 算成額外副作用；改以同一設定腳本的獨立正常對照核對，保留原失敗紀錄。初次嚴格型別檢查、受限工具程序的暫存 Git 權限，以及第一份乾淨副本的測試格式問題均已修正並重跑；不把這些失敗列為產品通過。

## 行為契約與非干預

每個成功安裝的屬性綁定原 document、完整原描述子及安裝 accessor；還原只在 getter、setter、enumerable、configurable 全部仍相符時執行。較新 getter／setter、資料屬性、刪除或旗標改動均保留。比對不呼叫屬性 getter；單項讀取／還原失敗不阻止其他清理，釋放後不重試。原有 setter、監聽器順序、真正可見性與 control-loss 訂閱生命週期保持。

Runtime 停用／啟用與獨立正常對照的 SDK 呼叫、reset 及三次設定寫入完全相同，沒有額外選路、探測、重載或寫入。整合案例先釋放所屬元件，再核對計時器、監聽器與儲存訂閱歸零；VisibilityAdapter 沒有新增計時器。

完整既有套件維持一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻、生命週期兩次重載、位置／倍速還原、新操作、晚到 Promise、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick。候選 v4、設定、持久欄位、依賴及控制權不變。

## 本輪安全差異

Codex Security 掃描 42695205-75ca-42b8-b771-8fe7dc608187 已完成封存，固定差異 f58206939dde5507717ef24bf8efe84370acbd89 至 c65c5069d901bfa42045b05e886ec423c0f6e191。六項來源清單及三份變更指南完成審查，另由獨立架構審查交叉核對，零可報告發現、無待判定候選。這是指定差異審查，不是全儲存庫無漏洞保證；後續測試清理斷言與發布記帳由自動驗證承接，不宣稱同一掃描涵蓋全部後續提交。工具回報總 token 6,996,534，計量為 partial 且包含快取與共用歷史，不作本次純掃描用量。

## 來源隔離

IAB 自有 loopback 頁面載入實際 VisibilityAdapter 模組，在全新原生 iframe 分別驗證兩個屬性的正常繼承、accessor、資料描述子、較新 getter／setter、資料屬性、刪除、兩個旗標與重新啟用，共二十案通過。getter 執行數為零；不接正式 GM 儲存，結束 iframe 為零、來源服務及自有分頁已關閉。

第一次校準因 strict eval 的模組變數未暴露而失效，尚未執行產品斷言；改正取得模組方式並清理舊 iframe 後才重跑。首次工具呼叫送出至返回的 1340.5 秒僅為總間隔，批准等待與實際執行時間未分離，不據此宣稱執行超時。原失效紀錄保留。

## 交付與安裝狀態

v2.1.30 五項 Release 原件已按原 bytes／SHA-256 搬入公開封存；[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_c65c506.json) 保存保護資料。[v2.1.31 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.31) 已發布，發布提交 a4d5603abc98af8d76b90ae2007301a8b5abc854。當時遠端 main 與標籤解參照一致，唯一附件及無登入憑證的公開 latest HTTP 200 全文均為 415770 bytes／SHA-256 5461c534325ad2063007eb220576b2d4b5d9472cce9d3a00a773e23521dd2507，與本機逐位元組一致。後續文件提交不移動標籤，不回寫五項 Release 快照。

公開更新入口當次停在 Tampermonkey 中繼頁，影片本體仍精確等同 v2.1.30。使用者完成必要更新後，重新核對 Tampermonkey 5.5.1／v2.1.31、完整本體 413812 bytes／SHA-256 36e48b746b596638260c5821a87482e6ddde1331c0975b9d55920b228e725258，與已發布本體一致；Runtime／ControlCenter 各一，Fetch／XHR installed、fetch-and-xhr-verified。斷點只用於身分核對，已解除後才觀察播放。

指定影片保持 Auto，當次實際 3840×2160。1／2 倍真實按鈕暫停／恢復及分頁原生 Right 短 seek 均有狀態對照。有效窗口各以單次完整 await 取得十六筆樣本、十五個一秒區段；每段時間增加大於 0.05 秒且影格增加，倍速精確，沒有 paused／seeking／ended／error，reloadCount 為零。一倍經過 15049.1 ms、影片前進 15.0552 秒；二倍有效重跑經過 15125.6 ms、前進 30.247595 秒。

二倍首窗第十一個區段末出現 seeking，連續非尋位前提中斷且原收集器未記錄事件來源，判 INVALID／產品 verdict=null，不能作正常播放通過或新修復缺陷的證據。補上同窗 seeking／seeked 等媒體事件收集後只重跑一次，有效重跑沒有事件；原窗口完整保留，不拼接或覆寫。收尾斷言曾遇跨 realm 空陣列原型差異，改用事件數精確等於零驗證，產品期待不變。原有二倍設定恢復，自有 timer／listener、斷點、遠端物件參照及分頁均清理；三份乾淨來源暫存目錄已移除。

[交付與安裝 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/VISIBILITY_OWNERSHIP_DELIVERY_2026-10-24.json) 保存版本、雜湊、逐秒資料、逐案有效性與清理結果。正常安裝回歸與來源隔離分開，不替代故障救援驗收。

## 發布與安裝限制

所有權依可觀察描述子判斷，無法辨識完全相同描述子的重新安裝來源；未增加原生 getter 身分認證，既有取值失敗的保守行為保持。必要自動、安全、公開下載與安裝正常回歸均已分層記錄；一次無效安裝窗口保留，不等同已定位網站尋位起因。

本輪安裝回歸只涵蓋指定 BV1tFZZBQE57 的 Auto 1／2 倍正常播放、暫停／恢復、短 seek 及十五秒進度。控制中心入口沿用跳過決定。自然起因、故障注入、背景／gate／剪貼簿、六組五十秒樣片及歷史矩陣不重開。沒有量測真實網站誤報率、卡頓率或救援成功率；不啟用提前備援。外部文件連結不自動連網，私有證據及不可變歷史連結限制分列。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.30 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2130-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊版本結果保持。
