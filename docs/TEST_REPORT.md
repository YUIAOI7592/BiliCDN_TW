# BiliCDN_TW v2.1.29 緩衝候選 v3 驗證

日期：2026-10-23（Asia/Taipei）。發布前來源基準為 4ce7195，功能實作為 a268bab。舊版完整報告原文先追加保存，再更新本固定入口；原件及歷史結果不回寫。

## 驗證結果

| 層級 | 結果與界線 |
| --- | --- |
| 已完成的功能來源 N | 1773／1773 通過，較凍結基準新增 241 案；詳見下列原始功能證據 |
| 效用整合 N | 100 次執行全部有效且通過，含兩倍速各自的固定與保留情境 |
| 功能乾淨來源 N | 662 公開輸入，npm ci／verify／效用命令均退出 0，輸入雜湊零變更 |
| v2.1.29 升版驗證 N | 型別、101 模組架構、1773／1773、格式、文件／公開封存、完整 verify 通過；無略過或取消 |
| v2.1.29 乾淨來源 N | 669 公開輸入；npm ci、verify 1773 案及效用 100 案全部退出 0，輸入雜湊零變更；效用 JSON 與主工作區逐位元組一致 |
| 本輪安全差異 | 依風險不另開 Codex Security，理由見下節；舊掃描不作本次證據 |
| 來源瀏覽器 S | 本輪未執行 |
| 實際安裝 I | 本版未執行，與公開產物核對分開記錄 |
| 公開交付 | 尚未發布；推送、標籤、附件及公開 latest 均須實際核對 |

## 行為契約與非干預

[完整 v3 功能報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BUFFER_CANDIDATE_V3_2026-10-23.md) 及 [逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CANDIDATE_V3_2026-10-23.json) 保存來源／情境雜湊、紅色契約、預期／實際及清理。產品修改前 58 個新契約為 26 通過／32 失敗，修正後全部通過；撤回 v2 原型的 FAIL 保持。

八秒窗口、下降至少兩秒、目前校正緩衝不超過十秒維持。首次成立從零確認，後續創低區間累計兩秒才成立；回補／持平當下撤銷顯示，未補回基準保留有界證據，完整補回、資格失效、八秒未創低及所有者變更清除。

每倍速的兩秒抖動、突發回補、低緩衝鋸齒各零候選；慢／快耗盡提前十八／三秒，兩種微量回補耗盡均提前五秒。短持平及極小回補正常對照仍各有兩段、合計四秒候選，不宣稱消除全部多餘候選或量得真實網站誤報率。

一般 6／12／15 秒、長 seek 15／30／15 秒及既有額度、冷卻、兩樣本 recovered、十五秒持續播放與終止後不重載契約維持。PlayerMonitor 唯一保存確認狀態；Runtime 只轉交、Recorder 只驗證複製輸出。診斷為 schemaVersion 3／buffer-window-v3，舊版本分開解析，內部證據與身分不輸出。容量與清理保持，沒有新增設定、持久鍵、依賴、計時器、網路工作或提前備援。

## 本輪安全差異

執行期差異限純數值確認、Monitor 自有記憶體狀態及既有診斷白名單版本，不擴大可信操作、Native 授權、網路、儲存或複製權限。Runtime、Routes、Recovery、Measurement 與控制觀察者來源不變，依專案風險規則不要求新增安全掃描。版本／原因白名單、去敏、副本隔離、有界性、重入及非干預由正式契約核對；這是風險判斷，不是新的掃描結論。

## 封裝與公開交付

v2.1.28 五項原件按原 bytes／SHA-256 歸檔，原成本比較只更新封存路徑，仍載入原 v2.1.27／v2.1.28 腳本。[升版前清單快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-23_4ce7195.json) 保存舊保護資料，不更新原件雜湊掩蓋變更。

確定性建置為 407926 bytes，SHA-256 為 e0c178987111d99ae69762287fe3769cc1af722a1ee6e586d125ce0ba8b2e9b4；版本為 v2.1.29。正式五檔封裝完成，四筆 checksum 與原始保護均核對；封裝後的完整 verify 再次通過。Release 只上傳 BiliCDN_TW.user.js；封裝後的快照不回寫，公開交付等後續結果只更新本現行報告。

## 發布與安裝限制

自然起因、故障注入、背景／gate／剪貼簿及歷史矩陣不重開；既有六組五十秒樣片仍為工具阻塞／未執行，不轉算通過。正常安裝另記，控制中心入口沿用跳過決定。

沒有量測真實網站卡頓率、救援成功率或瀏覽器純功能成本。傳輸 bytes 不等於即時頻寬，影子候選不授予控制權。外部文件連結未自動連網、私有 payload 未讀取；歷史斷鏈與搬移限制分列。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版完整報告見 [v2.1.28 歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2128-完整報告2026-10-23)，其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。舊發布時 1456 案及安裝結果不回寫。
