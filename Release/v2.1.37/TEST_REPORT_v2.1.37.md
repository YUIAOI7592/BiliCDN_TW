# BiliCDN_TW v2.1.37 上游 v1.4.1 改進吸收驗證

日期：2026-10-30（Asia/Taipei）。基準產品 v2.1.36／21322e2，A 候選 be8dc3e，後續正式子集移除未取得資格的三台香港候選。完整採用決策由 [本輪紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/UPSTREAM_V1_4_1_ADOPTION_2026-10-30.md) 追溯；本頁保存正式版本驗證及交付結果。

## 驗證結果

已完成 OGV 正片 playview 入口、Catalog-only 起播合格候選提早收束、有可靠大小的健康中段探測、實測足夠備援的家族排序，以及控制中心有界摘要。正式 Catalog 維持 11 台／4 台預設不可用，三台香港候選未取得實機門檻，排除於正式清單。

正式 HK 排除先以 UP141-ROUTE 取得 7 pass／2 fail 紅燈，再修改來源取得 9／9 通過。最終 v2.1.37 來源已在指定 Node 26.8.1／npm 11.19.0 下完成 verify：完整 2939 案通過，零失敗、略過、待實作或取消；型別、架構、格式、文件／封存、決定性建置、語法與封裝校驗均通過。普通沙箱的 tooling 暫存 Git 寫入失敗，改用正常權限重跑後通過；沒有改動期待或將權限失敗當成產品缺陷。

正式子集準備檢查：typecheck、104 個 runtime 模組的 architecture、format:check 通過；docs:check 通過 232 個 Markdown／2261 本機與儲存庫連結，archive:check 通過 414 搬移檔、三份只追加日誌、137 不變檔及 63 份 checksum／294 筆。七個不可變舊失效、430 個歷史原址限制、十八個私有引用未核對及 371 個外部未連網引用仍分列。普通 sandbox 的完整 npm test 退出 1，tooling 建立暫存 Git 儲存庫時無法寫入 .git/config；該次不能算全套通過，須以正常授權的可寫暫存環境完成最終驗證。

## 行為契約與非干預

起播維持每分頁一次、最多三候選、三秒共用期限。Catalog-only 首個安全吞吐達需求 1.35 倍的候選可提早釋放，快取候選須收滿 16 KiB；結果封存後晚到完成不新增學習或再次提交。固定慢尾端模型在 500 ms 釋放，相對原三秒等待減少 2500 ms；這是離線模型，未量測網站起播效益。

健康量測仍維持十分鐘跨分頁冷卻、最多三個依序候選、每候選三秒。中段只使用當前 Vault 來源 handle 的可靠大小，同輪共用範圍、跳過首 1 MiB、64 KiB 對齊；未知大小及起播／Native 從零開始。416 只撤銷大小，不加探測或播放斷路。主機家族只作有足夠證據路線間的排序，不保證物理機房隔離。

OGV pre/check/drm 原文通行，不改 Vault／epoch；API 入口、Fetch 單一讀取器及 XHR text／json／重用語意由契約核對。影片／音訊、原線對照、停用、Native 授權及禁止規則維持。一般 6／12／15、長 seek 15／30／15、核心恢復所有權及 bufferTrend v6 不變。

慢請求提前重試仍屬獨立原型；本版沒有其控制器、設定開關、timeout 控制或額外補送請求。未通過原生相容性、受控效用及自然故障完整門檻前，不納入正式版。

## 本輪安全差異

Codex Security 掃描 e7524c92-b87d-4130-bef1-e780815fd314 已完成，固定 A 候選範圍三十個審查項全數覆蓋，無可報告發現；canonical 報告由 Codex Security 工作台管理。該掃描沒有覆蓋未合入正式版的 B 原型，也不冒充最終 HK 排除後的相同來源雜湊。另已逐行核對 be8dc3e 到正式子集的執行期差異：只移除 Catalog 與家族表中的三台 HK，沒有其他執行期改動或擴張權限；對應拒絕契約及完整 verify 通過。安全審查獨立於 npm run verify，不表示已完成安裝攻擊驗證。

## 來源隔離與安裝結果

使用者於本輪明確要求暫緩 IAB／Tampermonkey 測試，先完成全部實作與必要自動／安全驗證再統一 Release。原計畫的 OGV 自然換集、起播對照、香港供片、提前重試自然窗口及安裝回歸均未執行，不填 PASS／FAIL，也不沿用 v2.1.36 的實機結果作為本版證據。此前已停止的 IR36、P01／P02 及其他歷史矩陣維持停止。

這次正式交付採用 A 的來源改進，實際網站效益及安裝相容性仍未驗證；香港候選與 B 控制能力維持原門檻，未因暫緩測試而啟用。

## 發布與安裝限制

v2.1.36 最新完整報告原文追加至歷史彙編，五項 Release 原件按原始位元組封存；已發布標籤與附件不回寫。v2.1.37 本機封裝使用已通過決定性驗證的完整腳本：451,802 bytes，SHA-256 1293587c8bd0c5133289a981feccc3ffa6c28297da06e4d6d9570d3895222ac4。這是本機產物身分，公開交付另須核對 main、標籤、唯一附件及 latest；不以本機封裝冒充遠端發布。

### 公開交付與安裝結案

公開交付尚未執行；IAB／Tampermonkey 依使用者要求暫緩，沒有本版完整執行本體、singleton、hooks 或正常播放回歸證據。公開附件核對與安裝驗收分別記錄，不能以正式 Release 推論安裝通過。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.36 最新完整報告原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2136-完整報告2026-10-30)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。
