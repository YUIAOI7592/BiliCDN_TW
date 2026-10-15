<a name="bilicdn_tw-v2125-release-verification--2026-10-14"></a>

# BiliCDN_TW v2.1.25 模組化與標準化驗證

日期：2026-10-14 實作／發布，2026-10-15 安裝紀錄（Asia/Taipei）。基準 v2.1.24／85196df，正式來源 src-v2。分階段提交工具遷移、格式、靜態規則、依賴契約與三組執行期拆分，保持既有產品行為。完整責任與來源案例見 [實作報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/MODULARIZATION_v2.1.25_REPORT.md)。

**BR-01 位置遺失未修復，歷史整份矩陣與 P01／P02 封存不重開。** 正常播放與模組化驗證不代替故障位置保護；原 [位置缺陷](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.24_POSITION_LOSS_2026-10-14.md) 保留。

| 層級 | 結果 |
| --- | --- |
| 完整正式契約 N | 19 套件 889／889，新增 34 案；0 fail／skip／todo／cancelled |
| 型別／格式／架構 N | 來源／測試／工具嚴格型別、唯讀 format:check、98 個模組與循環檢查通過；架構套件 37 案，工具 34 案 |
| verify N | 通過：格式、型別、架構、全部正式契約、確定性建置、JS 語法、v2-only、暫存封裝與校驗 |
| Codex Security | 固定差異 193／193，0 候選／0 發現、完整覆蓋與封存完成；與 verify 分開 |
| IAB 原生校準 E | 自有 Fetch／XHR 精確攔截、合成回應與解除通過；沙箱內服務不可達後改由主機 loopback 服務 |
| IAB 來源隔離 S | 17／17 傳輸／選路／所有權案例通過；來源 UI、播放器讀取／包裝與資源清理通過；無正式 GM 寫入 |
| 公開更新產物 | 已發布 v2.1.25：main／標籤、唯一附件與公開 latest 的版本／大小／SHA-256 核對一致；安裝紀錄另提交 main，標籤與快照不回寫 |
| 實際安裝 I | 本輪正常回歸範圍 PASS：Tampermonkey 5.5.1／完整 v2.1.25 執行本體、Runtime／ControlCenter 各 1、Fetch／XHR hooks；指定影片 Auto 1／2 倍播放／暫停／恢復／短 seek 及控制中心操作通過 |

工具保持 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2；只新增開發用 Prettier 3.9.10。16 個維護工具使用原生 ESM .mts，生成的 JS 情境／產物仍保留。格式變更獨立提交；本輪不要求重構後 JS 文字與舊版一致，確定性在同一新版來源驗證。

本輪 v2.1.25 已另行執行 format:check、typecheck、architecture、npm test 與 verify，全部通過。封裝使用者腳本 368,486 bytes，SHA-256 `2cdf191565668fb1c63bd815fedec1fd227b7e476885a6102c83c530e8657aa6`；原更新網址維持。2026-10-14T15:10:20Z 發布的唯一附件與 2026-10-15 再取的公開 latest，版本／大小／雜湊皆相同；版本標籤 peeled commit 為 6916e0523a9aa4906d761598943333fecebac57a。

## 發布後實際安裝

公開更新入口先停在 Tampermonkey 中繼頁，工具不能操作管理器確認頁，影片仍為舊本體；該次不作新版功能判定。使用者確認更新後，2026-10-15 重新載入指定 BV1tFZZBQE57 才取得有效 v2.1.25 窗口。管理器外包裝與 metadata 以外的完整可執行 IIFE 為 366,528 bytes、SHA-256 `a85809d70a3bc8a711de6df57f2120c44ff0c6b8fdf51c160ed0a08f5d8b340d`，與封裝同段一致；整份公開附件雜湊另列於上文。

Auto 1 倍：9.866 秒內媒體時間 +9.860 秒、影格 +592；Auto 2 倍：15.105 秒內時間 +30.208 秒、影格 +1,811。兩窗各完成可信暫停／恢復及 Right 短 seek，之後 readyState 4、seeking false 且持續播放，核心 reloadRevision／reloadCount 均 0。概覽／設定／診斷操作通過；Enter／Space 未改變 userRevision／seekRevision，32,213 字元報告 readonly、版本正確且無原始 URL。未重跑歷史故障、背景、gate 或剪貼簿矩陣。

控制中心關閉，斷點／Debugger／object group、自有分頁及 loopback 服務已清理；自有攔截／包裝／頁面 timer／訂閱均 0，沒有設定或剪貼簿寫入，倍速恢復原本 2 倍。原始安全摘要與畫面位於 .work/iab-testing/2026-10-14-v2.1.25-modularization/；細項與判定邊界見實作報告。本輪範圍通過，BR-01 整體仍不通過。

發布後文件檢查：15 份現行文件、32 個 GFM 表格、356 個本機／儲存庫連結，Markdown／表格／連結錯誤 0；上一版完整報告仍原樣保存在歷史，git diff --check 通過。只提交 main 的後續文件，不重新封裝或改寫版本標籤／Release／安全封存。

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
