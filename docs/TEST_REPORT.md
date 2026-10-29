# BiliCDN_TW v2.1.37 上游 v1.4.1 改進吸收驗證

> [!NOTE]
> **本檔位於隔離 B 原型分支。** 下方正式 A 報告原文保留於 613632f 檢查點，交付文字只描述當時狀態；當時「本版沒有提前重試控制器／開關」不描述目前 B 分支來源。B 來源、驗證與限制另見[分支補充](#隔離-b-分支原型驗證2026-10-30)，最新正式交付見 [A 正式報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md)。不能用相同 v2.1.37 版本欄混認完整腳本；正式 A 正文與既有 Release 快照均保留。

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

v2.1.36 最新完整報告原文追加至歷史彙編，五項 Release 原件按原始位元組封存；已發布標籤與附件不回寫。v2.1.37 待全部實作及最終檢查完成後統一封裝／發布，目前未執行 npm run package，沒有新版附件、大小或 SHA-256 可宣稱。後續公開交付須核對 main、標籤、唯一腳本附件及 latest 的版本、大小與 SHA-256。

### 公開交付與安裝結案

公開交付尚未執行；IAB／Tampermonkey 依使用者要求暫緩，沒有本版完整執行本體、singleton、hooks 或正常播放回歸證據。公開附件核對與安裝驗收分別記錄，不能以正式 Release 推論安裝通過。

## 隔離 B 分支原型驗證（2026-10-30）

執行期固定提交 3cadfd8633fabbaa4dbe20226e2d1b87714edc8c，基底為 613632fc33dd493a951a6b9942a870755ceab530。只在 `codex/upstream-141-early-retry` 保存，schema 2 的 earlyRetryEnabled 預設及缺值均為 false；沒有 B 正式 Release。固定設計、程式及結果見 [原型紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/codex/upstream-141-early-retry/archive/retired/docs/UPSTREAM_V1_4_1_EARLY_RETRY_PROTOTYPE_2026-10-30.md)，效用原始輸出見 [受保護 JSON](https://github.com/YUIAOI7592/BiliCDN_TW/blob/codex/upstream-141-early-retry/archive/retired/docs/evidence/UPSTREAM_V1_4_1_EARLY_RETRY_EFFICACY_2026-10-30.json)。分支連結描述未發布原型，不表示已推送或附件存在。

Node 26.8.1／npm 11.19.0 下，完整 npm test 2977 案通過，零失敗、略過、待實作或取消；其中 UP141-RETRY 應用契約 37 案、可信 UI 1 案。typecheck、110 模組 architecture、format:check、git diff --check、建置及 JavaScript 語法檢查通過。完整腳本 SHA-256 為 84da0795b7a3f896960960d82a976ac13d7b6f95f763856253f5f1373105b173；只屬未發布 B 原型，不能當作正式 A 附件。原型程式提交時的封存配置仍保護部分舊來源，後續只移除本次合法修改的十筆 unchangedFiles，先保存原配置 raw 快照。

補齊文件及封存後，完整 npm run verify 實際退出 0：2977 案、型別、110 模組架構、唯讀格式、文件、公開封存、兩次決定性建置、語法、v2-only 標記及暫存封裝校驗通過。使用一般使用者的正常可寫權限執行，沒有改工具設定、期待或隔離規則。沒有產生 B 的 Release 目錄，verify 僅使用自有暫存封裝並完成清理。最後補充另重跑 docs:check，通過 233 個 Markdown／2283 本機及儲存庫連結；archive:check 通過 414 搬移檔、三份完整前綴日誌、127 不變檔與 63 份 checksum／294 筆。七個舊不可變失效、430 歷史原址、十八個私有引用未核對及 375 外部未連網引用分列；git diff --check 通過。

獨立效用命令實際退出 1，valid=true、passed=false。兩個持續慢速模型分別減少 14000／16000 ms 停頓；兩個正常突發回補模型在 1／2 倍各發生一次不必要的 100000 bytes 重下。正常非干預門檻未通過，不降低期待、不啟用正式預設。政策 SHA-256 04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37，固定輸入 SHA-256 9130e0dd4af45496cbbd23dab07737060449b3b94629dfb33d0c986ffd740763。

B 的 Codex Security 掃描 bab220b7-b1a7-409a-b11d-0de94e0955c1 已完成，固定 613632f→3cadfd8 的二十六個審查項全數覆蓋，無可報告發現；canonical 報告由 Codex Security 工作台保管。文件／封存補充未改動該固定執行期、測試或工具來源。安全掃描不授予採用資格；有效效用失敗仍保留。原生瀏覽器相容、安裝受控故障及自然對照全部依使用者指示延後，未執行；Node 原生替身只作模型契約。維持既有停止矩陣，沒有 B 採用、自然故障改善率或安裝通過宣稱。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

v2.1.8 相容入口導向 [當版報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版見 [v2.1.36 最新完整報告原文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2136-完整報告2026-10-30)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。
