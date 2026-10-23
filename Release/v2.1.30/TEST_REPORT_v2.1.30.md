# BiliCDN_TW v2.1.30 周期候選與診斷成本驗證

日期：2026-10-24（Asia/Taipei）。功能基準 60de147／v2.1.29，執行期實作 ff22213，效用證據 a8713c6。上一版完整正文已先追加保存，原發布產物與歷史結果不回寫。

## 驗證結果

功能來源完整 verify 1834／1834 通過，較本輪基準 1795 新增三十九案；相對已發布版 1773 新增六十一案。型別、102 模組架構、格式、文件／公開封存、確定性建置與封裝契約通過，無略過、取消或待實作。升版後完整 verify 同為 1834 案通過。乾淨公開來源 687 項輸入，先以 npm ci 安裝鎖定依賴，verify 1834 案及功能 100／周期 72 案均退出 0；檢查後輸入雜湊零變更，兩組逐案結果與主工作區完全相同。

[完整功能報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BUFFER_CANDIDATE_V4_2026-10-24.md) 與 [逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CANDIDATE_V4_2026-10-24.json) 保存來源／輸入雜湊、紅色契約、七十二次新整合、一百次原情境與四十八次成本比較，均有效且通過。紅色階段六十次為三十通過／三十失敗，修復後轉綠，舊證據不回寫。

兩倍速的兩秒周期 75% 回補耗盡均提前六十八秒出現候選，最後候選距耗盡兩秒；六秒完整回補正常對照由四十秒候選縮為首周期兩秒。共同前綴正常對照仍有五秒候選，不能預知未來回補。報告 schemaVersion 4／buffer-window-v4 增加有界 cycle 數值，短期趨勢與周期欠量分開解釋，候選不取得控制權。

## 行為契約與非干預

原一百組的情境雜湊、暖機／情境輸入、媒體軌跡及操作陣列與 v3 證據一致。一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻、生命週期兩次重載、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick 契約維持。所有權、設定、持久欄位、依賴、計時器與網路工作不增加。

兩小時及傳輸情境保持樣本三十二／旁證一百二十八、趨勢三十二筆／8 KiB、Recorder 128 KiB／匯出 96 KiB 上限，清理核對通過。完整腳本本機配對成本每 tick 中位數約減少 31%，包含前輪 Recorder 容量優化；不能當作瀏覽器純功能開銷或真實播放改善。

## 本輪安全差異

Codex Security 掃描 d3b2242c-b346-4c59-9940-a04843cf492e 已完成，固定差異 67b45c4 至 ff22213，二十四項清單完成交叉審查，零可報告發現。範圍涵蓋投影、隔離、有界性與控制邊界；後續測試、原件搬移路徑與升版記帳另由自動檢查驗證，不冒稱同一掃描涵蓋全部後續提交。

## 交付與安裝狀態

v2.1.29 五項原件按原 bytes／SHA-256 搬入公開封存，原成本比較仍使用原始腳本。[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_a8713c6.json) 保留原保護資料。v2.1.30 本機確定性腳本 415345 bytes，SHA-256 124830e7d08e71ef34a2ba048c6624f578060276a09b01e0b9905c0f4175f03d。必要自動、安全與乾淨來源驗證已完成；公開交付核對將另行追加，這份封裝前報告不宣稱安裝成功。

## 發布與安裝限制

本輪來源瀏覽器未執行，Tampermonkey 新版安裝尚未核對。原六組五十秒樣片維持工具阻塞／未執行，不拼接短窗口。自然起因、故障注入、背景／gate／剪貼簿及歷史矩陣不重開；控制中心入口沿用跳過決定。既有正常安裝結果只屬當時版本。

沒有量測真實網站誤報率、卡頓率或救援成功率；不啟用提前備援。外部文件連結未自動連網、私有證據未載入，歷史斷鏈／搬移限制分列。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.29 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2129-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊 1773 案及安裝結果保持。
