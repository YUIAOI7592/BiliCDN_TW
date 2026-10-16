# BiliCDN_TW v2.1.26 四階段模組收斂驗證

**2026-10-16 發布後 BR-01 調查補記（ccf947a，產品未變）：** 第一輪含批准等待的 65127.7786 秒不得判執行超時，原判斷已撤回。第二輪私有 369 案為 362 pass／7 fail、退出 1；產品單元 195／195、整合 26／4、工具／判定器 127／127、證據重播 14／3。來源六案 4 pass／2 fail，Auto 1／2 倍各完成 20 分鐘自然窗口，起因仍未定位；受控 1 倍僅傳輸／清理通過，2 倍未完整通過，首次 1 倍隔離缺口保留。工具資源已清理，BR-01 未修復。詳見 [第二輪根因與修復規格](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_RCA_R2_2026-10-16.md)、[第一輪更正](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_RCA_2026-10-16.md)。正式 930 案基準沿用同一來源，調查不併入正式案例；下方原發布正文及 Release 快照不回寫。

<a name="bilicdn_tw-v2126-release-verification--2026-10-16"></a>

日期：2026-10-16（Asia/Taipei）。乾淨基準 a716369／v2.1.25，唯一正式來源 src-v2。四階段提交 93074b7（契約／視圖）、91507a2（XHR）、fdb59ae（選路）、8242e8f（播放器／恢復）後才統一升版。保持對外介面、設定、儲存 schema、事件順序、期限及狀態所有權。[完整實作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CONVERGENCE_v2.1.26_REPORT.md)。

**BR-01 位置遺失未修復；歷史故障、背景、gate、剪貼簿及 P01／P02 矩陣不恢復。** 既有正式回歸仍執行；[位置調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.24_POSITION_LOSS_2026-10-14.md) 的獨立 1 fail／2 pass 不轉算本輪正式套件。

| 層級 | 結果 |
| --- | --- |
| 正式契約 N | 19 套件 930／930，新增 41 案；0 fail／skip／todo／cancelled |
| 型別／格式／架構 N | 三專案嚴格型別、唯讀格式、99 模組／循環與唯一寫入權責通過；架構套件 37 案、工具 34 案 |
| v2.1.26 最終自動驗證 N | 升版後 format:check、typecheck、architecture、npm test（930／930）、verify 全通過；確定性建置、JS 語法、v2-only、暫存封裝與校驗通過 |
| Codex Security | 新固定差異 28／28 正式項目（含 3 個刪除契約）及 5 份文件完成交叉審查；0 候選／0 發現，完整覆蓋與封存完成 |
| IAB 原生校準 E | 自有 Fetch／XHR 各一次精確送出前合成回應，2 個事件、無截斷、held／patterns 歸零 |
| IAB 來源隔離 S | 傳輸／選路／所有權 23／23；播放器可信輸入／SDK／清理、控制中心設定／診斷／鍵盤邊界通過；正式 GM 寫入 0 |
| 公開更新產物 | v2.1.26 已發布；main／peeled tag、唯一腳本附件與公開 latest 的版本／372,448 bytes／SHA-256 一致；後續安裝文件另提交 main，標籤／快照不回寫 |
| 實際安裝 I | 本輪範圍 PASS：Tampermonkey 5.5.1／完整 v2.1.26 本體、Runtime／ControlCenter 各 1、Fetch／XHR hooks；指定影片 Auto 1／2 倍、pause／resume／短 seek、控制中心及鍵盤邊界通過 |

工具維持 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2、Prettier 3.9.10，未新增依賴、CI/CD 或執行期載入。三個小契約合併後加入各有用途的 XHR／選路／純進度助手，最終 99 模組；不以模組數或行數驗收，沒有第二個狀態所有者。

v2.1.26 封裝為 372,448 bytes，SHA-256 `107d345c557e18769e0d2e8876e3d046107c051e795228c69f72c97bcfbdaea0`，唯一公開附件與未帶憑證取得的公開 latest 全文相同。第一階段同版腳本與基準逐位元組相同：368,486 bytes、SHA-256 `2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6`。後續重構保持行為，不要求新舊 JS 文字相同。

## 行為契約與整合

XHR 新 20 案先由舊實作通過，原生 getter／receiver／readyState／responseType／例外順序及模式快取重置留在 hook。助手只轉換當筆狀態；metadata WeakMap、open／send／abort／派送／安裝還原不搬動。保留 JSON 身分、重讀一次轉換、拒絕、同步重入及 reopen，沒有新增 in-flight sentinel。

選路新 9 案先由舊實作通過，涵蓋來源分支／ID、事件重入、完成→證據保存→確認、政策失效、Catalog 403／Native 失效及影音隔離。既有模式／固定／禁止／精確 Native／晚到契約照常執行。協調器仍保存計畫、發事件、寫 Vault／親和，等待後重查目前資格。

播放器新 9 行為案先由舊實作通過；加強影格 getter 同步 reset 讀序後，以 esbuild onLoad 在記憶體載入固定 fdb59ae 的三個舊模組再次 9／9，不反覆改寫 tracked runtime。另有 3 個純領域案。註冊與反向清理、SDK receiver／參數／回傳／例外、首次／缺影格／0.05 秒、修訂／重入／晚到 Promise／reset／釋放保持。Monitor 的 available 資格與兩者首次樣本政策不強行統一；Recovery 的兩輪終止及逐副作用所有權檢查保持。

各階段 verify 為 889／909／918／930 案，模組 95／96／98／99；受影響套件及工具問題分列於 [工具紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_TOOLING_REPORT.md)。

## 新安全差異與計量

scan `701c41d6-b599-407e-91bd-5df887f01f2d` 於 2026-10-15T17:26:13Z 完成；固定 a716369b14bd211795f2c60cc57da5e7370df773..8242e8f4b94996dd47fa787bcfdd6f487ed895d5。snapshot digest：`codex-security-snapshot/v1:sha256:5efc8fba89eafedce19783dac36d168df0b03a968d6fa6f1d184c66aa1840e10`。後續版本／文件／封裝不冒充該執行期差異範圍。

前置能力 3／3、獨立 fresh-context 架構與 38 個引用檔範圍核對完成。XHR 作者審契約／選路 15 項，播放器作者審 XHR 3 項，選路作者審播放器 6 項，主代理審 4 個測試入口及 5 份文件。0 候選，無需候選驗證／攻擊路徑階段；既有平台、來源標籤及 BR-01 限制不誤列新發現。根 SECURITY 舊版標頭在後續現行指南修正，固定模型保留原觀察。

工具 coverage=complete、source=codex_rollout：總 16,245,432 tokens、輸入 16,191,177、快取輸入 15,908,992；此彙總不是漏洞數、獨立審查次數或瀏覽器證據。掃描目標計量 538,337 tokens、15 分 7 秒，口徑不同。canonical manifest／findings／coverage、threatmodel、report 與 SARIF 已由工具封存，前版安全產物不回寫。

## 合成來源與清理

同一 Codex IAB、自有 loopback、記憶體 FakeStorage／合成資料，無正式 GM 接線。MP4／FLV／mixed／invalid-mixed × Fetch／XHR text／json 共 12 次送出前回應；文字 getter 交替順序、一次轉換、JSON 身分及原生 responseText 例外保持。另核對完成→保存→確認，事件／保存期間政策失效阻止舊提交，每組與整體還原，共 23 案。

播放器自有空 video 的可信 SDK-play／Right 取得原 `sdk-return`、1 次意圖、seekRevision 1、userRevision 2、target 5；資訊清單只轉換一次、額外欄位丟棄、零面積快取保留，play／seek／reload 描述子還原。控制中心 Enter 設定／返回、空白鍵診斷的 6 個可信事件沒有觸發外層 handler 或取消預設；唯讀報告 3,383 字元、來源版本正確、無原始 URL、儲存鍵 0，沒有剪貼簿寫入。

最終來源 SHA-256：transport `547d06e006a848ebecc08ff4403172e5a038cab362bc6c1187585f5e1ae7b1fd`；UI `acc4daca63c15b685873a35ef17620ff1de0ac657bf31846ea367a9c2a8b1d6c`；player `2273d0a4018354868036d24b52b0cbf79273739f7f7216680fd53b2ded98c927`。傳輸在最終 runtime 重建全文相同，沒有用舊版或無效窗口補算。

自有請求、held／patterns、timer、storage listener 皆 0；Fetch／XHR 與 SDK 還原、UI 監聽器移除，自有分頁全關閉、loopback 31996 停止且 listener 0。私有證據 .work/v2126/iab/；S 層不代替 Tampermonkey 安裝驗收。

## 正式發布與實際安裝

2026-10-15T17:34:04Z [正式發布 v2.1.26](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.26)，發布時遠端 main／peeled tag 同為 bf536c5e1c2f9bdcf1954857686c6770ccdfd6f8。唯一 BiliCDN_TW.user.js 附件的 GitHub digest、公開 latest 與本機封裝版本／大小／SHA-256 一致，四個封裝輸入的校驗亦通過。後續僅補發布後文件至 main，不回寫已發布快照或標籤。

先嘗試公開 latest 更新入口，實際停在 Tampermonkey 中繼頁，工具不能操作管理器確認頁；該影片的完整執行 IIFE 仍與 v2.1.25 相同（366,528 bytes／a85809d70a3bc8a711de6df57f2120c44ff0c6b8fdf51c160ed0a08f5d8b340d），所以沒有作新版功能判定。使用者確認更新後，原工具分頁失效、分頁清單為空；在同一 IAB 新建指定影片文件，取得 Tampermonkey 5.5.1／script 2.1.26。完整可執行 IIFE 為 370,490 bytes、SHA-256 `43597d8e9302a044e5b32a70e8db84811f7e8cf48a7a991e2e055cbfadae01df`，與封裝同段一致；RuntimeController／ControlCenter 各 1，Fetch／XHR hooks installed。管理器包裝與 metadata 不混入 IIFE 雜湊，整份公開附件另核對。

Auto 1 倍窗口：28.8784 秒內媒體時間 +28.882920 秒、影格 +1,731；Auto 2 倍：35.7705 秒內時間 +71.543344 秒、影格 +4,288。兩窗分別完成可信暫停／恢復、Right 約 5 秒短 seek；seek 收束後才開始採樣，結束 readyState 4、seeking false、正常播放，coreId 保持、reloadRevision／reloadCount 均 0，畫質始終 Auto，沒有強制品質或網站故障注入。

控制中心概覽、Enter 設定／返回與空白鍵診斷通過；鍵盤前後 userRevision 14、seekRevision 6 皆不變。32,665 字元診斷報告 readonly、版本正確且無原始 URL，未寫入剪貼簿或設定。Escape 關閉後，Debugger／斷點解除、object group 釋放、所有自有分頁關閉；自有請求／攔截／包裝／timer／訂閱 0，原本 2 倍速及 Auto 保留。已安裝產品 hooks 不作工具包裝清理。

本輪有限安裝範圍 PASS 並結案，BR-01 整體仍不通過。私有 INSTALLED.json、CLEANUP_INSTALLED.json 及 installed-v26-diagnostics.png 與來源證據分開保存；沒有恢復歷史矩陣或留下自主續測項目。文件 GFM／連結／完整歷史保存及 git diff --check 另檢查，不將後續文件更新計為新的執行期測試。

發布後文件檢查通過：16 份現行文件、33 個 GFM 表格、369 個本機／儲存庫連結，格式／表格／連結錯誤 0；v2.1.25 完整正文保存、原 Release 未變及 git diff --check 通過。後續只有文件 main 提交，不重新封裝。

<a name="bilicdn_tw-v2125-release-verification--2026-10-14"></a>
<a name="bilicdn_tw-v2124-release-verification--2026-10-14"></a>
<a name="歷史驗證導覽"></a>

## 歷史報告

v2.1.25 完整正文（含發布後安裝、原限制及導引）原樣追加至 [歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2125-release-verification--2026-10-14)。[v2.1.24](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2124-release-verification--2026-10-14) 與 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md) 保存更早結果；既有 Release／調查／安全封存不回寫。
