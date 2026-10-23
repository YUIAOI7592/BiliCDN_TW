# BiliCDN_TW v2.1.28 唯讀緩衝趨勢驗證

日期：2026-10-23（Asia/Taipei）。功能基準 8e410b7／v2.1.27，執行期完成提交 34672b0237d2ef1afd32254fe57f58ce27920d01；其後僅升版、文件、固定比較原件路徑及封裝維護。使用者另行指示發布，取代本功能原先只作本機交付的範圍。

## 驗證結果

| 層級 | 結果與界線 |
| --- | --- |
| 原始實作 N | 19 套件 1456／1456；基準 1297 加 143 單元、16 整合，0 fail／skip／todo／cancelled |
| 升版驗證 N | 完整 verify 退出 0：格式、型別、101 模組架構、1456 案、確定性建置、語法、v2-only 與暫存封裝校驗通過 |
| Codex Security | 固定 8e410b7..34672b0，25／25 正式項目，連同其餘 14 個變更檔案審查；0 候選／0 發現，coverage complete，無延期 |
| 乾淨來源 N | 644 個公開輸入，npm ci 及完整 verify 退出 0；1456 案、輸入雜湊零變更，403700 bytes 本體逐位元組一致；專用暫存副本已清除 |
| 來源瀏覽器 S | 本輪未執行，Node 模型不代替可信瀏覽器或網站驗收 |
| 實際安裝 I | 發布後另行核對；目前未執行，不以 v2.1.27 的結果補算 |
| 公開交付 | v2.1.28 發布準備中，發布後核對遠端 main／標籤、唯一附件及 public latest |

工具版本、依賴、設定與持久 schema 均不變。本功能只輸出診斷，沒有啟用預測救援；一般 6／12／15 秒、長 seek 15／30／15 秒與原有所有權、額度保持。

## 行為契約與非干預

[完整功能報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/BUFFER_TREND_2026-10-23.md) 與 [逐案 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/BUFFER_TREND_2026-10-23.json) 保存來源集合摘要 aac2698251764f46c51eee5dca7940829099393174ef90f77f16dafdaa559d0a、全部具名案例及十二個 1／2 倍合成窗口。發布不改寫其中原先的未發布身分、結果或限制。

驗證完整八秒窗口、1.5 秒空隙、僅內插、倍速校正、下降兩秒與低緩衝十秒門檻、時間／影格前進、資格失效、完成傳輸去重及上限。資料不足 candidate 為 null，不能當健康。正常播放、兩秒抖動、五秒停頓及突發回補不產生候選；兩組下降情境各倍速首次候選為 8000 ms，沒有新增控制副作用。

真實 Monitor／Runtime／Recorder 與必要 Routes／Recovery／記憶體儲存整合，核對事件、決策、親和、計畫、SDK 與寫入軌跡不變。既有精確期限、零／非零位置、倍速、初始化、新操作、晚到 Promise、兩樣本 recovered、後續十五秒播放及終止後 120 tick 契約維持。資源由所屬元件釋放後先核對，再釋放 FakeClock。

診斷只輸出有限數值、布林及列舉；32 筆／8 KiB 趨勢、Recorder 128 KiB、匯出 96 KiB 上限及優先縮減契約通過。沒有 URL、請求／內容識別或核心物件輸出；沒有新增 UI、設定、持久鍵、網路或計時器。

## 本輪安全差異

Codex Security scan b66acf88-7651-4fd7-b044-2c32e18ff44d，完成於 2026-10-23T05:40:04.394817Z。固定範圍為 8e410b797a4195dfec9060e0af36872491131b3f..34672b0237d2ef1afd32254fe57f58ce27920d01；snapshot digest 為 codex-security-snapshot/v1:sha256:fb3cc62c693bbf564c85523a04ad0b899f48c2c19b33e5a2045b942910495638。主代理審查維護／保護差異，兩位獨立審查者分別檢查 Monitor／Runtime／領域及診斷輸出鏈，未發現可報告安全候選。

canonical findings SHA-256 dc80d86ff553bd12f57ec2167a29cc7ff2d6829999ab36061d79e3addc2c5465；coverage SHA-256 e86e0657ef5af51caf2062b7bbb6e1923920de86d16cef9589ee2bd7b35fb6e4。工具管理的原件保持原位。工具提供的使用量為部分歷史彙整，含 rollout_unavailable，不能作本次純增量成本；不將使用量不完整誤稱掃描覆蓋不足。

## 封裝原件

v2.1.28 完整腳本為 403700 bytes，SHA-256 8b3ec29aa2b26cb0b9708a91aed65e2d6411e09875e2ac87c70436f0eeec418d。版本設定以 release.json 為準；舊 v2.1.27 五項原件已按原 bytes／SHA 移至封存，其完整現行報告追加保存。修改保護適用範圍前保存 [原清單快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/originals/PRE_RELEASE_2026-10-23_34672b0.json)，沒有改寫原始雜湊。

## 發布與安裝限制

本輪沒有量測真實網站卡頓率、誤介入率或 CPU／記憶體開銷。完成傳輸 bytes 不等於即時頻寬；影子候選不授予換線、探測或重載權限。自然起因、安裝版故障注入、背景／gate／剪貼簿寫入及歷史矩陣不重開。控制中心入口點擊沿用使用者跳過決定，不作阻塞。

外部連結未自動連網，私有證據未載入；精確歷史斷鏈／搬移網址限制由文件檢查分列，不宣稱全部連結有效。公開封存不讀取本機私有 payload，本輪沒有私有搬移。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

仍被不可變 Release 引用的 v2.1.8 入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版完整正文已原樣追加至 [v2.1.27 歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2127-完整報告2026-10-17)。其他版本由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯；舊 1134 案、實際安裝與原始限制不回寫。
