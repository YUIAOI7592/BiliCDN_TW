# BiliCDN_TW v2.1.33 緩衝候選到期驗證

日期：2026-10-24（Asia/Taipei）。基準 4e06eac／v2.1.32，執行期修復 d6197de。只修正唯讀周期確認額度的到期處理；不調整門檻、不啟用提前備援。

## 驗證結果

新增三十四個具名契約：三十個純領域單元、四個真實 Monitor／Runtime／Recorder 整合案例，1／2 倍各自登記。未修改產品為十八通過／十六失敗，退出 1；最小修復後同一批斷言三十四案全通過，退出 0。[逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CYCLE_RENEWAL_2026-10-24.json) 保存來源雜湊、紅綠結果、固定輸入、完整前後觀察與來源隔離。

首次綠色嘗試中，四案把報告 creditMs 誤當成專屬周期額度而失敗；該欄原本是短期及周期確認的最大值。修正測試語意後，在舊產品重新取得十八通過／十六失敗，再以相同斷言轉綠；沒有降低候選或確認時間的要求，原失敗仍保存。

功能來源完整 verify 1938／1938、tooling 398 案、型別、102 模組架構、格式、文件／封存、確定性建置及封裝全部通過。全新七百一十項輸入副本 npm ci／verify 退出 0，輸入雜湊不變，副本已清理。第一次乾淨副本因受限 Git 暫存失敗而漏入新測試，型別檢查失敗；修正環境後另開新副本重跑，原紀錄保留。升版後完整 verify 再次 1938 案通過；另以含封裝的 717 輸入全新副本執行 npm ci／verify，均退出 0、輸入不變且已清理。發布準備時尚未暫存搬移曾使文件檢查找不到舊 Release 路徑，更新索引後文件及完整驗證全通過，原日誌保留。

## 行為契約與非干預

根因是最近欠量超過八秒時，程式只清除欠量與時間戳；若同筆樣本結束回補並建立新欠量，後段便沿用先前 cycleCreditMs。現在到期分支同時撤銷該額度，新證據首次成立從零開始，1999 ms 不確認、2000 ms 才可確認。7999／8000 ms 尚有效，8001 ms 才到期；獨立且仍有效的短期證據保持原判定。

| 固定情境（各 1／2 倍） | 舊實作 | 修正後 |
| --- | --- | --- |
| 舊證據到期、單次下降後立即回補 | 第 17 秒多出一秒候選；合計兩段、兩秒 | 該段消失；只保留先前合法的一段、一秒 |
| 舊證據到期、新欠量持續下降 | 第 17 秒直接沿用舊確認；合計四秒 | 第 19 秒完成新的兩秒確認；合計兩秒 |

原有一百次功能情境及七十二次周期開發／保留情境在修復前後全部有效、通過，完整結果物件逐項相同，包含候選段、十五秒後續、首次／最後提前量、輸入、操作、副作用、容量與清理。兩小時情境仍在原容量限制內。這是指定離線模型的非干預及效用證據，不是網站誤報率或救援成功率。

PlayerMonitor 仍是唯一候選狀態所有者；純函式只回傳下一狀態，Runtime 轉交、Recorder 投影。沒有新增欄位、計時器、依賴、持久資料或網路工作。schemaVersion 4／buffer-window-v4 保持，屬既有到期契約修復；歷史 v4 結果仍以當時來源為準。

一般 6／12／15 秒、長 seek 15／30／15 秒、死核心四秒、長暫停三十秒、九十秒冷卻及生命週期兩次重載維持。完整套件包含位置／倍速還原、新操作、晚到 Promise、兩樣本 recovered、十五秒持續播放及終止後一百二十 tick；既有路線、探測、親和、寫入與控制所有權不變。

## 本輪安全差異

本輪風險評估：執行期差異只有純領域到期分支撤銷既有數值狀態，沒有新增輸入、權限、資料輸出、網路、持久化或控制路徑。依既有按風險規則，不另執行 Codex Security 掃描；不把上一版掃描當成本輪安全通過。型別、架構、資料邊界及非干預由本輪自動契約覆蓋。

## 來源隔離

Codex IAB 自有 loopback 頁面載入實際 assessBufferTrend／observeBufferCycle 來源，以六十秒健康前置及固定合成時間執行四個 1／2 倍對照，全部通過；同時核對輸入未被修改。沒有接正式 GM、建立產品控制器、修改影片 getter 或注入故障。純函式沒有自有 timer／listener／subscription；分頁與服務已清理。這只證明瀏覽器中相同來源的計算，不是安裝版故障救援。

## 發布與安裝限制

v2.1.32 完整報告原文追加保存，五項 Release 按原 bytes／SHA-256 歸檔；[升版前清單](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-24_d6197de.json) 保留保護基準。本次執行期檔案不在 unchangedFiles 中，沒有解除或重算舊來源保護。

[v2.1.33 正式 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.33) 已發布，發布提交 bbc4b27789a01eaf1f7d34a8d2fa4362c58cff30。當時遠端 main 與標籤解參照相同；唯一腳本附件與無登入憑證的公開 latest HTTP 200 全文均為 417110 bytes／SHA-256 892fb339625d4d2a241ce4387050c8d08201e224c6211844c5be5f0eaad5a761，與本機逐位元組一致。後續文件提交不移動標籤、不修改 Release 快照。

本次公開更新入口停在 Tampermonkey 中繼頁，工具沒有可操作的管理器確認頁。新載入指定影片的完整本體為 415118 bytes／SHA-256 d0286eb6ef089cb5d89432cc0fef65fa59f35cfb948e880f452f52b9a5cb548e，精確等同 v2.1.32；新版本應為 415152 bytes／SHA-256 febc3f34f91e834cf4ac05d162b754e259ddc4508a14a4362b6e83bc19de69e2。因此 v2.1.33 管理器／singleton／hooks 及 Auto 1／2 倍正常回歸均未執行、產品判定 null，不以舊版本播放補算。

未重複要求發布或工作批准；後續安裝核對需要同一 IAB 的管理器實際完成更新。自有影片、更新分頁及 Debugger 已清理，沒有留下故障攔截或背景收集器。公開發布、來源驗證與文件交付已結案，安裝限制另列於 [交付 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_CYCLE_RENEWAL_DELIVERY_2026-10-24.json)。

首次回補前的共同輸入仍可能產生候選；小幅回補、真正緩慢耗盡及真實網站節奏的取捨沒有被本次修復全面解決。診斷 creditMs 不能單獨解讀為候選已成立，仍須看 candidate、原因碼及資料品質。

控制中心入口依指示跳過；自然起因、安裝故障注入、背景／gate／剪貼簿、六組五十秒樣片及歷史矩陣不重開。不宣稱降低真實卡頓率，不啟用預測救援。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.32 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2132-完整報告2026-10-24)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。舊結果保持。
