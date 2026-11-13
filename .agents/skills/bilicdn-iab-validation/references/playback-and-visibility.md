# 播放窗口與可見性校準

## 展示樣片選擇與唯讀窗口

已有凍結片單就沿用，不因結果換片；[BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/)只作既有歷史比較基準。獲准選新展示樣片時優先自然風景、海洋、動植物、微距、城市或 OLED 色彩，排除評測、教學、電影片段及固定測試圖。4K／8K 標題只是候選，既有帳戶在固定影片／分 P 正常播放至少三分鐘後才凍結，不購買、改帳戶或逐片重複索取批准。

只用 Auto，已納入的 1／2 倍分開；標題與實際解析度、編碼、幀率分列，Auto 未選 8K 不算 8K 通過。保持其他腳本與瀏覽器設定；使用者自行改環境另記，不回填舊窗口。不得改網站 timeout、媒體 getter、控制器或重設預算製造成功。

播放／效益計畫凍結影片、分 P、順序、倍率、時長、前後置、觀察方式與截止；請求時序另定容量及讀取節奏。每窗完整連續，不拼接；換所有者或救援介入分段，不跨段配對。同媒體且非暫停／尋位／結束／錯誤時，連續兩秒無合格進度可記觀察卡頓，不能當產品觸發門檻或 CDN 歸因。十五秒仍播放不單獨證明多餘介入；指定後續觀察必須完整。

歷史片單、矩陣與窗口預算不帶入新輪次；目前停止與再開條件只看 [TODO](../../../../docs/TODO.md)。

## 前景偽裝與真正背景

[VisibilityAdapter](../../../../src-v2/adapters/visibility.ts) 取得 Document.prototype.hidden 描述子，再嘗試於 document 覆寫 hidden=false、visibilityState=visible；覆寫可能失敗，捕獲 getter 也可能早已被其他程式包裝。

分列網站所見、經來源／realm／文件關係校準的瀏覽器狀態，以及實際接線的 Runtime 判定。Runtime 優先呼叫保存 getter；缺失時回退 document.visibilityState，例外或未安裝／已解除時可回報 visible。true 不保證真正前景；同一 getter 的 prototype 與 Runtime 讀值不是獨立證據。函式名、native code 字樣、selectedTab、queued 或面板隱藏都不足以證明原生性或背景。

## E04 的適用條件

只有完整前景→背景→前景斷言才要求原生 hidden 的 false→true→false、對應 Runtime 狀態與網站偽裝讀值。核對 getter 來源及與安裝時捕獲的關係；document 實例覆寫本身不改 prototype，不把腳本之前預注入當通用前置。

只取當下可見性資格時取得相應有效狀態即可。完整轉換沒有符合單分頁、不要求前景、不搶焦點的方法就列未執行；開始後來源或連續性失效列 INVALID。不得用 S 模型、改 getter、合成 visibilitychange 或停用腳本代算 I 原生轉換，也不恢復舊雙分頁方法。

產品資格與計時見 [ARCHITECTURE](../../../../docs/ARCHITECTURE.md#網站前景偽裝與內部可見性)；N 驗精確邊界，瀏覽器記錄採樣與 tick 誤差，不能把一般 UI 或身分查證變成完整背景校準。
