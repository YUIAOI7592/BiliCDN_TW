# BiliCDN_TW v2.1.39 正式整合版驗證

日期：2026-10-31（Asia/Taipei）。第一階段基準 main 0b4d441，509f56a 完成全部原工作分支與歷史證據的一般合併並推送。第二階段以 codex/control-center-integration 修改業務邏輯及 UI。本版依使用者明確決策正式整合，不把舊效用 FAIL、INVALID 或不足實機改判通過。

## 功能與預設

| 能力 | 本版實際行為 |
| --- | --- |
| OGV | 保留開啟；pre/check/drm 僅辨識、原文傳遞、不改 Vault／epoch |
| 六個自動功能 | 起播提前放行、中段探測、備援分散、提前重試、WebRTC／HTTPDNS 阻止均保留真實開關；新安裝／缺值 true，明確 false 保留 |
| 香港 CDN | 三台一般 Catalog 預設可用，原覆寫保留；原四台預設不可用不變 |
| 格式偏好 | codec 設定及排序能力已刪除，舊 AV1 設定不改表示順序；辨識與歸因保留 |
| 手動操作 | 手動測速、手動最近影片 CDN 封鎖、HK 定向驗證及特殊 context／challenge 分支完整移除 |
| 額外詳記 | verbose 與排名歷史收集器移除；相容欄位空陣列／零；基本事件與 bufferTrend v6 保持 |
| 控制中心 | 標題無 v2；總覽／CDN／播放設定／診斷四頁，真實讀模型、按需報告及匯出 |

schema 2、原儲存鍵、singleton、名稱、namespace 與 latest 更新鏈保留。設定切換不重開起播／冷卻／提前重試額度、不取消網站請求、不放寬恢復與可見性政策。

## 自動驗證

具名紅色契約先覆蓋 CC39 設定／移除／CDN／診斷與 UI，再修改來源。指定工具鏈下 npm run typecheck、npm run architecture（114 runtime 模組）、npm test、npm run verify 全部通過：**3010 案，零失敗／取消／略過／待實作**，控制中心其中 59 案。verify 另核對格式、文件、封存、確定性建置、語法及暫存封裝校驗。docs:check 通過 241 Markdown／2505 本機與儲存庫連結；archive:check 通過 424 搬移檔、三份只追加日誌、123 適用不變檔、66 checksum／306 筆。git diff --check 與暫存差異檢查通過；最後發布文件會再獨立核對。

七個不可變舊失效連結、430 歷史原址限制、十八個私有引用及 411 外部未連網引用保留，不代表外部可達性通過。所有既有發布原件保持位元組與 SHA-256；v2.1.38 五項產物搬至封存，第二階段前配置原件另有精確保護。

舊合併階段完整 verify 2999 案，僅用來證明第一階段未改產品。測試工具的暫存 Git 寫入需正常授權；未改期待或版本鎖。指定 Node 26.8.1／npm 11.19.0，無新增依賴或 CI。

## 獨立效用與已知限制

獨立 early-retry-evaluation 命令真實退出碼 **1，VALID／FAIL**。輸入 SHA-256 9130e0dd4af45496cbbd23dab07737060449b3b94629dfb33d0c986ffd740763，政策 SHA-256 04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37。固定持續慢速可改善，正常突發回補仍可能產生不必要的 100,000 bytes 重下載；沒有更改輸入、門檻或判定。原始 [本輪 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/CC39_EARLY_RETRY_EFFICACY_2026-10-31.json) 精確保護，歷史 FAIL 原件保持。預設開啟來自使用者整合決策，不是效用通過。

## 安全差異

Codex Security 差異掃描已完成並封存：scan 4e827d91-2cf2-4af9-9da9-8b3295aea53b，固定來源範圍 509f56ae9d47ea1d68504d3a3d655c6035831bd2 至 af4f57fb6801dd7fb6c702db70993595629223ef。獨立架構模型及分組審查覆蓋完整 60 項來源清單，另核對 package-lock 與使用者腳本 metadata；無待審項、零可報告發現。跟查包括 Vault 授權、HK 一般 Catalog 限制、鎖內測量重驗、原生 timeout 所有權與許可、可信 UI、去敏及匯出資源清理。

此為固定差異與相關路徑的靜態安全審查，結合本輪契約證據；沒有宣稱整庫無漏洞、瀏覽器原生相容或效用通過。canonical report.md 保存在 Codex Security 本機掃描目錄，SHA-256 為 0f797d5034cd5b7933d6208e9920f306260b1ab913c55340d1b7be8b1c6c5ac2；私有掃描產物未自動公開。後續封裝與指南修改不改該來源範圍。

## 來源隔離與實際安裝

**本版未執行，安裝身分與實機 UI／播放驗收未驗證。** 本回合工具清單沒有既有 IAB 程式化控制能力；可用 Windows Computer Use 的輸入方法會自動啟用目標視窗，與使用者禁止搶焦點衝突，也無法先由目前能力保證播放靜音。因此未操作安裝入口或影片，不要求前景／面板／手動例外。這是工具與執行界線，不判為產品測試 FAIL。全程未啟動本機服務、未播放有聲媒體；沒有重開原兩輪或停止矩陣，舊版安裝身分不補算本版。

## 公開交付與安裝結案

本封裝快照完成時公開發布尚待執行；唯一腳本為 BiliCDN_TW.user.js，版本 2.1.39，507387 bytes，SHA-256 583c906d9f5123cd6c220fe78c815242a74d661bee3b0358b24bd69e379fd5e3。發布後 main／標籤／唯一附件及公開 latest 核對記於 [現行完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#公開交付與安裝結案)，不回寫已發布封裝。發布和實際安裝驗收分開。

## 歷史驗證導覽

<a name="發布與安裝限制"></a>

v2.1.38 完整正文已追加至 [歷史全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2138-完整正文保存2026-10-31)。其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

舊 v2.1.8 錨點保留作歷史導覽；不描述本版結果。

## 2026-10-30：UP141 安裝版實測

此相容入口指向 [v2.1.38 完整實測](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)，原始 FAIL／INVALID 與未完成窗口保持。

## 隔離 B 分支原型驗證（2026-10-30）

原型與獨立 FAIL 見 [歷史原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。
