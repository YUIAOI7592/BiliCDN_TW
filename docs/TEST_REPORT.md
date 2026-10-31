# BiliCDN_TW v2.2.0 結構精簡與行為契約驗證

日期：2026-11-01（Asia/Taipei）。基準為 v2.1.40／1edfeaa6ad7a6b9dabc7d81da3b4414c3a31ba78。使用者批准完整重構、Native 新預設及正式 v2.2.0 交付；本次不恢復已停止瀏覽器案例。

## 變更與結構證據

| 項目 | 基準 | v2.2.0 |
| --- | --- | --- |
| 模型／介面契約檔 | 40 | 27；同功能共置，消費端直接匯入契約 |
| scripts 頂層檔案 | 31 | 6；其餘分為 checks／testing／evaluation／iab／lib |
| 數字情境分派套件 | 13 | 0；具名建立函式與每案獨立狀態 |
| CDN 初次頁面完整模型讀取 | 18 | 1；刷新亦共用當次模型，命令完成重讀 |
| 產品規則正文 | PROJECT_CONTEXT＋ARCHITECTURE | ARCHITECTURE 六部分；舊產品錨點只導引 |

契約檔盤點包含 model、port／ports 及 contracts；ControlReadModel 的執行實作不列為純契約。SettingsStore 單一布林預設表使新安裝、缺值、非法欄位及還原預設啟用 Native；既有 true／false 保留，schema 2、四鍵及讀取不寫入維持。Catalog-only 回歸顯式關閉 Native。

設定抑制／保存、逐欄失效比較、同步路線解析／組裝、恢復階段與 SDK 派送簡化；原單一所有者、等待後授權、取消、同步重入、晚到工作、恢復期限與額度保持。詳細契約見 [ARCHITECTURE](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/ARCHITECTURE.md)，專項評估操作見 [評估指南](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/scripts/evaluation/README.md)。

## 自動驗證

產品契約第一輪通過；新預設、設定鎖等待／失敗／遠端更新、逐欄失效及單次 UI 快照已有具名案例。固定 Node 26.8.1／npm 11.19.0 的完整 verify、工具及最終文件檢查正在進行，完成後記錄實際結果。

## 安全差異

授權、恢復與傳輸變更將執行 Codex Security 的不可變提交範圍安全差異掃描。尚未把待執行項目記為通過。

## 公開交付

版本設定為 2.2.0，正式封裝、main／標籤、唯一附件與公開 latest 下載核對待完成。本機原始碼提交不等於使用者腳本發布。

## 瀏覽器與既有證據限制

本版沒有執行 IAB 來源隔離、Tampermonkey 實際安裝或播放驗收，不能以 Node 契約代算。遵守單一自有分頁、禁止本機網站服務、不要求前景及全程靜音限制；本次不啟動舊窗口或新增實測輪次。

v2.1.40 的香港影片供片與自然恢復證據不足、N05 取消來源及網站清空根因未確認、提前重試原效用 FAIL 等結論完整保留於 [上一版完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。這次結構與預設變更不解決或抹除那些缺口，後續執行界線只看 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 歷史驗證導覽

[v2.1.40 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01) 保留全部原始觀察與停止決策；其他版本見 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)。

<a name="bilicdn_tw-v2140-固定-cdn-備援恢復修復驗證"></a>

[BiliCDN_TW v2.1.40 固定 CDN 備援恢復修復驗證：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="修復與根因"></a>

[修復與根因：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="來源隔離與實際安裝"></a>

[來源隔離與實際安裝：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="公開交付與安裝結案"></a>

[公開交付與安裝結案：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="修後唯一-hk04-定向窗口"></a>

[修後唯一 HK04 定向窗口：v2.1.40 原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2140-完整正文保存2026-11-01)。

<a name="發布與安裝限制"></a>

舊發布／安裝限制依版本保留，請由 [版本索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md#版本) 查原文；現行版公開交付見上文。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[v2.1.8 完整發行驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-發行驗證--2026-10-04)。

<a name="2026-10-31更新後安裝核對"></a>

[v2.1.39 更新後安裝核對原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[v2.1.39 六十分鐘驗證原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[v2.1.39 靜音前提檢查點原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[v2.1.39 更正後靜音操作與工具超時原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[v2.1.39 單分頁重測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[v2.1.39 一次授權補測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="2026-10-30up141-安裝版實測"></a>

[v2.1.38 UP141 安裝版實測原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[隔離 B 分支原型原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。以上相容錨點只提供歷史導引，不表示本版測試結果。
