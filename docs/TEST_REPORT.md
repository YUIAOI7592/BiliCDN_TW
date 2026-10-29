# BiliCDN_TW v2.1.38 UP141 完整測試版驗證

日期：2026-10-30（Asia/Taipei）。本版定位為**測試版／實機待驗證**；v2.1.37 亦依使用者更正為測試定位。基準 main c3081113f1657a93c48e4df4a342811d19f76671，整合來源 273f8c3f29458221cca4dd898297389389324ae5，最終來源 4bcc29dc706778259befda3fb3e16cab39f6d3f8；B 固定來源 3cadfd8633fabbaa4dbe20226e2d1b87714edc8c，原分支、歷史 FAIL 及安全報告保持。正式採用方案留待實機結果。

## 功能與預設

| 能力 | 測試版狀態 |
| --- | --- |
| OGV 正片 playview | 包含、開啟；pre/check/drm 僅診斷，原文通行、不改 Vault／epoch |
| 起播提前放行 | 包含、預設開啟；獨立開關關閉後等全部候選或原三秒期限 |
| 健康中段探測 | 包含、預設開啟；獨立開關可對照首段，可靠大小驗證保持 |
| 備援家族分散 | 包含、預設開啟；獨立開關恢復原排序，最多五個及合法性不變 |
| 三台 HK | 全部包含、個別預設關閉；原四台預設不可用不變；Catalog 合計 14 台／7 台預設關閉 |
| 指定 HK 驗證 | 可信按鈕可安排已啟用主機；共用十分鐘跨分頁鎖、最多三台、每台三秒，不改親和 |
| 提前重試原型 | 完整包含、預設關閉；原生 timeout、網站自行重試、兩秒許可及原資格／額度保持 |
| 診斷 | 測試身分、有效設定、候選／探測狀態、提前重試階段及原因均可匯出；新事件最多十六筆 |

操作入口、如何確認生效、取證及清理集中於 [測試操作表](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/UP141_TEST_RELEASE_2026-10-30.md)。schema 2 缺值 A=true、B=false；明確 false 保留，關閉在儲存等待前抑制新動作。切換不取消網站請求、不重開起播或冷卻、不重設恢復期限。固定 CDN 勾選不能解除禁止，測試按鈕不接受任意 URL。

## 自動驗證

執行期變更先以具名契約重現。原 B 匯入 RED／37 案綠燈、HK 清單與開關 RED、timeout 觀察 RED、定向探測失敗／來源撤銷 RED 均保留本機工作日誌。新契約覆蓋設定鎖及遠端變更、冷卻／重複安排、白名單、禁止、晚到提交、首段對照、UI 可信輸入、診斷去敏／容量及 Runtime 訂閱清理；B 原生 setter 品牌、轉換、相同值、重入、重用、許可及正常流量契約保持。

指定 Node 26.8.1／npm 11.19.0 下，typecheck、architecture（111 個 runtime 模組，無循環）、完整 npm test 及 npm run verify 均通過 **2,999 案**，零失敗／取消／略過／待實作；verify 包含格式、文件、封存、決定性建置、語法及暫存封裝校驗。最後三項紅色契約重現探測取消後等待證據儲存鎖的晚到提交，修復後以固定 4bcc29d 重新跑完完整測試及 verify。完整測試使用可寫自有暫存 Git 的正常授權環境，未改測試期待。git diff --check 與已暫存差異檢查通過。

文件準備檢查通過 235 Markdown／2,343 本機及儲存庫連結；封存通過 419 搬移檔、三份只追加日誌、124 個適用不變檔、64 份 checksum／298 筆。七個不可變舊失效、430 個歷史原址限制、十八個私有引用未核對及 386 個外部未連網引用照實分列；這不是外部連結可用性證明。封裝後新增保護清單另行核對。獨立效用命令與安全掃描分開，不列為 verify 內的預期失敗。

## 獨立效用與已知限制

`npm run evaluate:early-retry -- --json` 重跑結果為 **VALID／FAIL，退出碼 1**。固定六案：持續慢速 1／2 倍改善停頓 14,000／16,000 ms；健康緩衝及近完成不介入；正常突發回補 1／2 倍各有不必要的 100,000 bytes 重下載。沒有修改輸入、門檻或期待；此結果允許交付預設關閉原型，不能支持正式採用或預設開啟。

本次原始 JSON 保存為 [UP141 測試版效用證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/evidence/UP141_TEST_EFFICACY_2026-10-30.json)。舊 B 原件仍在 [原分支固定證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/codex/upstream-141-early-retry/archive/retired/docs/evidence/UPSTREAM_V1_4_1_EARLY_RETRY_EFFICACY_2026-10-30.json)，不回寫。模型無法證明網站自然介入、原生相容或供片效益。

## 安全差異

新的 Codex Security 掃描 ca200567-14aa-49b2-8625-2b0842fc1c17 固定審查 c308111..273f8c3，完整覆蓋 48 項來源／設定／測試差異，涵蓋 HK 授權、定向探測、設定、診斷與 XHR 控制。後續掃描 55815894-6853-4c00-903c-98420e6782dd 固定審查 273f8c3..4bcc29d，完整覆蓋五檔晚到證據提交修復及固定診斷原因；兩次均完成、無可報告安全發現，無延後或未結案項目。兩份 canonical report、coverage、findings、threatmodel 與 SARIF 由插件管理保存，合起來覆蓋最終整合執行期來源。

掃描記錄模型為 gpt-6-astra／xhigh；這是安全掃描工具記錄，不推定主實作代理設定。Daybreak advisory 未授權不阻擋本輪，未修改設定或權限。舊 A／B 掃描只作歷史證據，不代替本輪。安全掃描與 verify 分開；沒有瀏覽器攻擊驗證，也不能據此宣稱不存在所有漏洞。

## 來源隔離與實際安裝

**本次均未執行。** 使用者要求止於測試版發布與公開附件核對，IAB／Tampermonkey 安裝、OGV 自然換集、起播／中段／排序對照、HK 兩片兩倍速及提前重試正常／自然故障窗口全部延後。未消耗或重開原實機預算，不沿用舊版結果補算，不安排第三輪或恢復 IR36、P01／P02 等停止工作。

<a name="發布與安裝限制"></a>

## 公開交付與安裝結案

封裝前必要自動與安全檢查已完成。本機使用者腳本為 v2.1.38，507,104 bytes，SHA-256 為 `6464ef5f6fd21ea849e045cf1b7efe93f6d2aa72626f50642b16770893991e73`。封裝快照止於本機驗證；公開 latest 版本、唯一附件、大小及 SHA-256 於發布後追加至現行 TEST_REPORT，未核對前不宣稱公開交付完成。

v2.1.37 標籤與附件原始位元組保留，只追加 Release 說明的測試定位更正。GitHub Release 不設 prerelease 以維持既有 latest 更新鏈；該狀態不代表正式驗收。實機後才決定正式版本。

2026-10-30 公開核對已完成：[v2.1.38 測試 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.38) 的 main 發布提交及標籤目標均為 `7bbb02ba90af06724af790cd5f578b84e56a18a5`。Release ID 428229134，唯一附件 BiliCDN_TW.user.js（asset ID 689454412），507,104 bytes；GitHub 回報 digest 與無認證公開 latest 下載均為 `6464ef5f6fd21ea849e045cf1b7efe93f6d2aa72626f50642b16770893991e73`，與本機封裝逐位元組相同。腳本版本為 2.1.38，名稱、namespace 及 latest 更新網址保持；78 個建置輸入雜湊、五項封裝與 Git 暫存版本均一致。封裝正文保留發布前快照，本段為發布後現行報告補記。

[v2.1.37 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.37) 已更正標題並追加日期說明，舊說明全文前綴及附件中繼資料均保持。標籤目標仍為 624029dbaad2dc4418b43cd18da7d66b89bc83ca；公開附件仍為 451,802 bytes、SHA-256 `1293587c8bd0c5133289a981feccc3ffa6c28297da06e4d6d9570d3895222ac4`。原 B 分支仍為 2a5851761d5a066cd3b54cb447b9da546a23187e。原件、三份日誌前綴及完整舊報告保存核對通過。

封裝後文件與公開封存通過：237 個 Markdown、419 搬移檔、三份只追加日誌、129 個適用不變檔、65 份 checksum／302 筆；歷史／私有／外部連結限制維持分列。本次交付已結案，未執行安裝或實機專項，沒有啟動後續自主窗口。

## 歷史驗證導覽

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

舊相容入口見 [v2.1.8](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。上一版全文見 [v2.1.37](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2137-完整報告2026-10-30)，其餘由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 追溯。
