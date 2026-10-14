<a name="bilicdn_tw-v2125-release-verification--2026-10-14"></a>

# BiliCDN_TW v2.1.25 模組化與標準化驗證

日期：2026-10-14（Asia/Taipei）。基準 v2.1.24／85196df，正式來源 src-v2。分階段提交工具遷移、格式、靜態規則、依賴契約與三組執行期拆分，保持既有產品行為。完整責任與來源案例見 [實作報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/MODULARIZATION_v2.1.25_REPORT.md)。

**BR-01 位置遺失未修復，歷史整份矩陣與 P01／P02 封存不重開。** 正常播放與模組化驗證不代替故障位置保護；原 [位置缺陷](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.24_POSITION_LOSS_2026-10-14.md) 保留。

| 層級 | 結果 |
| --- | --- |
| 完整正式契約 N | 19 套件 889／889，新增 34 案；0 fail／skip／todo／cancelled |
| 型別／格式／架構 N | 來源／測試／工具嚴格型別、唯讀 format:check、98 個模組與循環檢查通過；架構套件 37 案，工具 34 案 |
| verify N | 通過：格式、型別、架構、全部正式契約、確定性建置、JS 語法、v2-only、暫存封裝與校驗 |
| Codex Security | 固定差異 193／193，0 候選／0 發現、完整覆蓋與封存完成；與 verify 分開 |
| IAB 原生校準 E | 自有 Fetch／XHR 精確攔截、合成回應與解除通過；沙箱內服務不可達後改由主機 loopback 服務 |
| IAB 來源隔離 S | 17／17 傳輸／選路／所有權案例通過；來源 UI、播放器讀取／包裝與資源清理通過；無正式 GM 寫入 |
| 公開更新產物 | 尚未發布，待 main／標籤、唯一附件、公開 latest 版本／大小／SHA-256 核對 |
| 實際安裝 I | 尚未執行 v2.1.25 安裝；完整本體／唯一實例／hooks、指定影片 Auto 1／2 倍正常播放與 UI 操作另記 |

工具保持 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2；只新增開發用 Prettier 3.9.10。16 個維護工具使用原生 ESM .mts，生成的 JS 情境／產物仍保留。格式變更獨立提交；本輪不要求重構後 JS 文字與舊版一致，確定性在同一新版來源驗證。

本輪 v2.1.25 已另行執行 format:check、typecheck、architecture、npm test 與 verify，全部通過。封裝使用者腳本 368,486 bytes，SHA-256 `2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6`；原更新網址維持。此數字為本機封裝，公開更新核對另記。

## 安全範圍與計量

scan f1e3f151-b556-4e63-a9d7-25d68992a0ff 於 2026-10-14T14:59:24Z 完成；固定範圍 85196df1c176cef0e373dba8450a3dd5efc4e376..e5a9c403bac83859bd5540f78716522c1f52d1c6。封存 snapshot digest 為 codex-security-snapshot/v1:sha256:78f8a4cad039280f44b9d0be1fbc83009365a63918f613b85fd2caad9c143191。後續版本／文件／封裝變更不冒充該審查範圍。

前置能力就緒、獨立架構模型與交叉區域審查完成。Windows 政策解析 helper 的路徑錯誤另記，直接讀取固定修訂的根 SECURITY.md，未把政策當成缺失。安全工具回報彙總 13,294,781 tokens（其中快取輸入 13,011,712；來源 codex_rollout）；此為工具彙總計量，不代表獨立漏洞數或瀏覽器證據。

## 來源隔離與限制

合成 MP4／FLV／mixed／invalid-mixed 在真正 Fetch／XHR text／json 中核對 Catalog 輸出、分段 metadata／身分、重讀與拒絕；原生描述子還原、重複安裝、保留較新包裝共 17 案。自有請求／timer／listener 皆 0，正式持久寫入 0。控制中心完整 readonly 報告 3,391 bytes、不含原始 URL；可信鍵盤與播放器 SDK 回傳／MPD 投影／快取／包裝還原分列於實作報告。

第一個傳輸窗口因工具間隔超過自有期限作廢，修正連續服務後唯一重跑才計 PASS；UI 欠缺合成 GM_info 的診斷窗口也作廢，補齊環境後重跑才取得完整視圖。不得以這些合成來源替代 Tampermonkey 安裝證據。未重開歷史背景、故障注入、gate、剪貼簿或位置矩陣。

<a name="bilicdn_tw-v2124-release-verification--2026-10-14"></a>
<a name="歷史驗證導覽"></a>

## 歷史報告

上一版 v2.1.24 完整正文原樣追加至 [歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2124-release-verification--2026-10-14)。[文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md) 導向歷次結果；原 Release／失敗調查及安全封存不回寫。
