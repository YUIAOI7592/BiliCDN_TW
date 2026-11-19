# BiliCDN_TW v2.2.23 完整驗證報告

驗證日期為 2026-11-19（Asia/Taipei）。產品基準為 `0b8e25d`，上游基準為 v1.4.1 至 v1.4.2 的固定差異。

## 驗收結論

本版修復牆鐘回退下的設定生效順序、部分啟動清理、網站播放資料還原與選路快照換期，並吸收 v1.4.2 的語系頁、主片導航配對、輔助請求隔離及尋位期間的起播保護。發布狀態依下列驗收分段。

## 自動驗證

修復前六個缺陷案例各自在預期斷言失敗，兩個對照通過，八案保留具名身分移入正式套件。上游變更以合成 Fetch／XHR、URL、播放器狀態及時鐘驗證。原來源重現語系中繼資料、導航等價、API 先到、預載隔離及尋位資格缺口。 [上游與驗收去向](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/UPSTREAM_MANIFEST.md#v142-與-v2223)

在 Windows 使用工作區提供的 Node 24.22.3 及 npm 11.20.0 執行 `npm run verify`，18 個正式套件共 2,279 案全數通過，失敗、跳過、取消及待辦均為零。131 條業務規則的具名案例均通過。檢查另包含型別、架構、格式、文件、公開封存、決定性建置及暫存封裝。

## 安全差異

Codex Security 已完成 `0b8e25d..497f328` 的固定差異審查（`f84c960e-a399-4f1b-a15b-c6cac50a5131`），涵蓋 36 個變更檔案，無可報告的安全發現。首輪檢視後，換片配對改採同一單調時鐘，要求直接播放頁的路徑身分相符，保留同片刷新之前的原期限，並讓嚴格模式的輔助 XHR 擁有獨立 JSON 輸出。相關回歸案例在最終差異通過。審查採靜態程式與離線契約證據。

<a name="公開交付與安裝結案"></a>

## 封存與公開交付

v2.2.22 五項原件與標籤和原校驗一致，獨立解壓後逐項驗證。封存包 SHA-256 為 `39636c5e3da0ce0bbfe817cb583d0196754875e99cbc0ca3dd4b151f47364faa`。前版的發布與安裝原判已保存在[完整歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2222-完整正文保存2026-11-19)。

2026-11-19 02:48（Asia/Taipei）核對 GitHub 正式 Release 與公開 API，latest 指向 `v2.2.23`，唯一附件為 `BiliCDN_TW.user.js`。公開標籤解析至 `1ff266b9d75608ddc2c848d704af84824b72af29`。latest 與固定版本下載均回傳 HTTP 200，版本皆為 v2.2.23，與該提交的封裝逐位元組相同，皆為 554,918 bytes，SHA-256 為 `fd5d30dfe1a7a1249d2211b3879392221baa852071d65a4ed0cfad8902c8e924`。 [GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.23) · [latest 下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js) · [固定版本下載](https://github.com/YUIAOI7592/BiliCDN_TW/releases/download/v2.2.23/BiliCDN_TW.user.js)

## 來源隔離與實際安裝

發行時採 Node 自動契約與公開產物核對。發布後的已安裝驗收見下方 R1。IAB 來源隔離未執行，原作者的實機證據只適用 v1.4.2。

<a name="v2223-r1-安裝驗收-2026-11-19"></a>

### v2.2.23 R1 安裝驗收

2026-11-19 約 21:34 至 21:46:37（Asia/Taipei）。第一次能力確認後的單調計時錨點為 21:34:07.115，至關閉分頁經過 749.759 秒。使用單一自有 IAB 分頁，IAB 視窗維持隱藏，頁面讀得 `document.hidden=false`。依原定順序完成前置後即進入下一項，分段時間作截止。固定起點為標籤 `v2.2.23`／`1ff266b`。兩片均為 P1／Auto／1 倍速。**七項核心案例及清理通過。**

| 案例 | 判定與實際證據 |
| --- | --- |
| I-01 載入身分 | **PASS**。主樣片保持 `/zh-Hant/`。Debugger 取得完整 555,811 bytes 執行來源，辨識外層後，本體為 UTF-8 位元組區間 `[672, 555590)`。其 554,918 bytes 逐位元組等於固定提交中的官方附件，SHA-256 為 `fd5d30dfe1a7a1249d2211b3879392221baa852071d65a4ed0cfad8902c8e924`。控制中心顯示 v2.2.23。 |
| I-02 執行期接線 | **PASS**。實際 Fetch、XHR `open`／`send` 均指向相符的載入來源，共用一個 `TransportContext`。沿外層包裝查到已登記的 `popstate` 與 History `pushState`／`replaceState` 內層共用產品回呼。實際 Lifecycle 與傳輸共用 Playurl、Session、設定與選路，換片配對方法屬同一來源。控制中心命令及面板共用同一 Store，讀模型使用同一 Session、設定、傳輸及選路快照。產品確認兩個傳輸掛鉤已安裝，取證時有 77 次 Fetch、168 次 XHR 進入及 211 筆觀察回應。 |
| I-03 語系頁與等價導覽 | **PASS**。在初次的繁中語系文件暫停且靜音後，透過實際 `replaceState` 加入唯一 `p=1`，沿用原 History state。正式回呼比較正規化鍵相同，文件時間基準一致，世代／內容週期為 `1／0`。確認網址仍屬本輪後復原，讀回仍為 `1／0`。 |
| I-04 正常播放與尋位 | **PASS**。真實播放器在 60.007 秒內前進 59.468 秒。121 筆樣本均為同一媒體、靜音、1 倍速及播放中，最大取樣間隔 0.507 秒。事件觀察無媒體錯誤、非預期暫停、尋位或更換媒體，窗口內 Debugger 停用。收窗後以可信控制暫停在 1406.881 秒，輸入 1437 秒並收到原生 `seeking`／`seeked`，續播至 1442.611 秒。 |
| I-05 設定往返 | **PASS**。在暫停且靜音時，以可信操作將「慢請求提前重試」由開啟切至關閉，再恢復開啟。Store 已確認修訂依序為 0、2、4，暫時抑制均回到零。控制項讀回與每次提交一致。復原前核對仍為本輪寫入的欄位與修訂，其他偏好與原快照一致。 |
| I-06 控制中心 | **PASS**。可信操作完成「總覽 → 播放設定 → 總覽」，共用頁首均顯示「停用腳本」，對應啟用狀態。總覽實際渲染與同次快照一致，涵蓋選定路線、影片供片、`2160p / av1`、歸因已確認與目前內容傳輸的保守吞吐提示。 |
| I-07 真實換片 | **PASS**。以網站連結從 `BV1tFZZBQE57` 換至 `BV1BDVzzZEg4`，同一文件與產品實例，仍在 `/zh-Hant/`。更換媒體後確認靜音。新片無媒體錯誤，進度由 615.256 前進至 644.159 秒。世代／內容週期由 `1／0` 變為 `2／0`，現行影片請求與 206 回應屬於 `2／0`。總覽選定路線與影片供片均為新片資料，吞吐提示為目前內容傳輸。 |

| 條件式案例 | 判定與證據 |
| --- | --- |
| O-01 主 API 與網址配對 | **INVALID**。同文件換片與終局世代已知，Network 事件游標回報截斷，無法對齊主 API 派送、接納與網址變更順序。 |
| O-02 預載與預覽隔離 | **證據不足**。可用事件中未取得帶明確輔助標記、且能核對主片前後狀態的完整自然請求。 |
| O-03 尋位與起播測速 | **證據不足**。正式尋位前已讀得起播狀態 `complete`，本輪未觀察到額度尚未認領時的尋位情境。 |

已復核設定與臨時網址復原。關頁前播放器保持靜音且暫停，自有取樣、監聽及斷點已解除，Network、Debugger 與物件群組已釋放，確認自有分頁已移除。三項條件式觀察各保留原判。四組故障修復、Catalog-only 拒絕及跨分頁冷卻沿用正式自動契約。

<a name="v2222-r1-安裝驗收-2026-11-19"></a>

[v2.2.22 R1 安裝結果](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2222-r1-安裝驗收-2026-11-19)。

## 歷史驗證導覽

<a name="v2220-安裝身分與變更接線重新判定2026-11-13"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2220-安裝身分與變更接線重新判定2026-11-13)。

<a name="驗收門檻檢討2026-11-13"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#驗收門檻檢討2026-11-13)。

<a name="管理器探索禁令撤銷註記2026-11-13"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#管理器探索禁令撤銷註記2026-11-13)。

<a name="v2218-r1-安裝身分與設定頁2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2218-r1-安裝身分與設定頁2026-11-12)。

<a name="文件與測試清查整理2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#文件與測試清查整理2026-11-12)。

<a name="斷言審核與精簡2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#斷言審核與精簡2026-11-12)。

<a name="全量逐案語意審核與最終精簡2026-11-12"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#全量逐案語意審核與最終精簡2026-11-12)。

<a name="v2217-r1-採樣與抑制專項2026-11-11"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r1-採樣與抑制專項2026-11-11)。

<a name="v2217-r2-低緩衝與額度受控補驗2026-11-11"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2217-r2-低緩衝與額度受控補驗2026-11-11)。

<a name="v2216-r1-載入身分與選路提交接線2026-11-09"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2216-r1-載入身分與選路提交接線2026-11-09)。

<a name="v2215-r1-載入身分與模組初始化2026-11-09"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2215-r1-載入身分與模組初始化2026-11-09)。

<a name="v2219-r1-安裝身分與變更接線2026-11-12"></a>

[v2.2.19 原始發行與 R1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2219-完整正文保存2026-11-12)。

版本、議題、日期由 [HISTORY](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md) 維護；以下錨點只作相容導引。

<a name="v2214-載入身分驗證2026-11-08"></a>

[原版載入身分與 R1／R2 限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2214-載入身分驗證2026-11-08)。

<a name="v2212-r1-三頁與刷新專項2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2212-r1-三頁與刷新專項2026-11-08)。

<a name="v2211-r1-熔斷安裝驗收2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r1-熔斷安裝驗收2026-11-06)。

<a name="v2211-r2-受控熔斷與安裝接線2026-11-06"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2211-r2-受控熔斷與安裝接線2026-11-06)。

<a name="v2210-r1-安裝版驗收2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r1-安裝版驗收2026-11-05)。

<a name="v2210-r2-補驗能力確認2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r2-補驗能力確認2026-11-05)。

<a name="v2210-r3-補驗2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r3-補驗2026-11-05)。

<a name="v2210-r4-正數-timeout-專項2026-11-05"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2210-r4-正數-timeout-專項2026-11-05)。

<a name="v228-r2-專項完成2026-11-0304"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r2-專項完成2026-11-0304)。

<a name="v224-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v224-r1-安裝驗收2026-11-01)。

<a name="v223-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-r1-安裝驗收2026-11-01)。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。

<a name="v225-r1-安裝驗收2026-11-01"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v225-r1-安裝驗收2026-11-01)。

<a name="三十五項閉環對照"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#三十五項閉環對照)。

<a name="v226-r1-安裝驗收2026-11-02"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v226-r1-安裝驗收2026-11-02)。

<a name="驗證階段與證據範圍"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#驗證階段與證據範圍)。

<a name="v2213-r1-選路黑名單與來源驗收2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r1-選路黑名單與來源驗收2026-11-08)。

<a name="v2213-r2-本版變更接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r2-本版變更接線補驗2026-11-08)。

<a name="v2213-r3-更新確認與實機觀察2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r3-更新確認與實機觀察2026-11-08)。

<a name="v2213-r4-自主接線補驗2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r4-自主接線補驗2026-11-08)。

<a name="v2213-r5-受控真實-api-接線2026-11-08"></a>

[原版結果與限制](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-r5-受控真實-api-接線2026-11-08)。

<a name="公開交付核對2026-11-06"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付核對2026-11-06)。

<a name="研究項目完成對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#研究項目完成對照)。

<a name="v228-r1-正數-timeout-專項2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v228-r1-正數-timeout-專項2026-11-03)。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#隔離-b-分支原型驗證2026-10-30)。

<a name="公開交付"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#公開交付)。

<a name="修復結果與證據邊界"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#修復結果與證據邊界)。

<a name="發布與安裝限制"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布與安裝限制)。

<a name="2026-10-30up141-安裝版實測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-30up141-安裝版實測)。

<a name="2026-10-31更新後安裝核對"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31更新後安裝核對)。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31六十分鐘驗證計畫執行結果)。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31iab-可用但持續靜音前提受阻)。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31依使用者更正靜音方法續行與下載工具超時)。

<a name="2026-10-31補測與單分頁重測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31補測與單分頁重測)。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#2026-10-31一次授權的單分頁缺口補測)。

<a name="v220-安裝驗收-r12026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v220-安裝驗收-r12026-11-01)。

<a name="澄清後在原期限內續行"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#澄清後在原期限內續行)。

<a name="auto-2-倍補充與本次驗收結案"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#auto-2-倍補充與本次驗收結案)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-r1-安裝驗收2026-11-01)。

<a name="全文閱讀覆蓋清單"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#全文閱讀覆蓋清單)。

<a name="發布後公開核對2026-11-01"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-01)。

<a name="固定合成模型對照"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#固定合成模型對照)。

<a name="發布後公開核對2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#發布後公開核對2026-11-03)。

<a name="v227-r1-基本安裝驗收2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-r1-基本安裝驗收2026-11-03)。

<a name="v227-xhr-timeout-起播分支調查2026-11-03"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v227-xhr-timeout-起播分支調查2026-11-03)。

<a name="政策映射與契約保留"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#政策映射與契約保留)。
