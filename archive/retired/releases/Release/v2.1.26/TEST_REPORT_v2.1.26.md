# BiliCDN_TW v2.1.26 四階段模組收斂驗證

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
| 公開更新產物 | 尚未發布；完成封裝後推送 main／標籤、唯一附件並核對公開 latest 版本／大小／SHA-256 |
| 實際安裝 I | 新版尚未執行；發布後先嘗試公開更新入口，再核對完整本體／唯一實例／hooks 及指定影片 Auto 1／2 倍正常操作 |

工具維持 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2、Prettier 3.9.10，未新增依賴、CI/CD 或執行期載入。三個小契約合併後加入各有用途的 XHR／選路／純進度助手，最終 99 模組；不以模組數或行數驗收，沒有第二個狀態所有者。

v2.1.26 建置為 372,448 bytes，SHA-256 `107d345c557e18769e0d2e8876e3d046107c051e795228c69f72c97bcfbdaea0`，正式封裝與公開核對另記。第一階段同版腳本與基準逐位元組相同：368,486 bytes、SHA-256 `2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6`。後續重構保持行為，不要求新舊 JS 文字相同。

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

<a name="bilicdn_tw-v2125-release-verification--2026-10-14"></a>
<a name="bilicdn_tw-v2124-release-verification--2026-10-14"></a>
<a name="歷史驗證導覽"></a>

## 歷史報告

v2.1.25 完整正文（含發布後安裝、原限制及導引）原樣追加至 [歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2125-release-verification--2026-10-14)。[v2.1.24](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2124-release-verification--2026-10-14) 與 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md) 保存更早結果；既有 Release／調查／安全封存不回寫。
