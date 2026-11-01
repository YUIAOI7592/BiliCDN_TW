# BiliCDN_TW v2.2.4 儀錶板資料遺失與缺值顯示修復驗證

日期：2026-11-01（Asia/Taipei）。基準為乾淨 main／`1c981da4796c84ea3abacf0433bf350931d66769`。本次依使用者批准方案修正導覽身分及唯讀顯示；原 v2.2.3 全文、公開核對及 R1 基本安裝驗收保存於 [歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-完整正文保存2026-11-01)。

## 修復結果與證據邊界

已重現並修正：同片追蹤參數／等價網址導致 generation 改變、表示及影音摘要清空；舊 512 字元截斷漏掉後段分 P 變更。新導覽鍵只在支援的單層影片／OGV 播放路徑忽略 vd_source、spm_id_from 並正規化末尾斜線；一般影片缺省與單一 p=1 等價，其他內容／未知參數及重複值順序保留。未知路徑保留完整原始輸入。真換片、分 P、cid／內容改變、停用與授權失效仍沿用原隔離與取消；五秒／跨頁 250 毫秒頁面資料期限保持。

使用者截圖可確認播放器有緩衝／倍速，但傳輸歸因及速度資料缺失；這次沒有取得該次實際網址變動或 hooks 的完整因果。已修正的重設路徑與截圖式缺值的 Node UI 契約分列，不宣稱已在使用者瀏覽器完整重現並消除所有缺值原因。

總覽及按需詳細狀態共用當次純衍生結果：有效播放器尺寸可以先顯示並標示編碼未確認，與已確認表示高度一致才沿用原畫質／codec；有效速度不因缺需求而隱藏，餘裕須有有效速度／倍率／推導需求。缺值按攔截、歸因與計畫狀態說明，影音各自區分實際回應、等待回應及尚無觀察；明確舊 generation／epoch 資料不顯示。沒有增加輪詢、訂閱、探測、持久鍵或診斷歷程，沒有用顯示備援授權選路。

Native 預設及既有布林值、schema 2、四個儲存鍵、兩筆成功影片傳輸的確認門檻、量測／恢復額度及可信事件所有權不變，無資料遷移。階段提交為導覽 `3c03495`、UI `871df88`。

## 自動驗證

鎖定 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2；已核對測試及 verify 不啟動網站服務，verify 僅在暫存位置核對封裝，不覆寫 Release。

基線 18 套件／1,599 案全部通過。初次沙箱執行中工具套件 9 案因自有暫存 Git 配置寫入被拒而失敗；以必要權限重跑基線後全數通過，環境限制不列產品失敗。正式案例名稱及參數展開逐項對照，原 1,599 案完整保留；新增 35 案，完整測試為 **18 套件／1,634 案通過**，failed／cancelled／skipped／todo 均為零。

| 套件 | 案例 | 結果 |
| --- | ---: | --- |
| `architecture` | 41 | 通過 |
| `imports` | 1 | 通過 |
| `domain-boundaries` | 3 | 通過 |
| `domain` | 11 | 通過 |
| `state` | 35 | 通過 |
| `application` | 588 | 通過 |
| `adapters` | 210 | 通過 |
| `native-routing` | 13 | 通過 |
| `native-transport` | 167 | 通過 |
| `orchestration` | 40 | 通過 |
| `adapter-boundaries` | 65 | 通過 |
| `measurement-state` | 94 | 通過 |
| `progressive-playurl` | 29 | 通過 |
| `progressive-routing` | 51 | 通過 |
| `progressive-transport` | 4 | 通過 |
| `playurl-summary` | 22 | 通過 |
| `control-center` | 63 | 通過 |
| `tooling` | 197 | 通過 |

### 新增回歸與既有契約

| 範圍 | 證據 |
| --- | --- |
| 導覽鍵 11 案 | 追蹤增刪／排序、重複值順序、重複 p、真分 P、內容與未知參數、OGV、未知路徑、512 字元後差異、影片及集數路徑 |
| 真實元件整合 2 案 | Navigation／Lifecycle／Session／Vault／Routes／Runtime／TransportContext 組合；頁面資料超過五秒後等價導覽仍保持原決策身分及影音摘要，真分 P 撤銷舊身分、拒絕晚到回填，新影音各自重建且兩筆影片後才確認 |
| UI 22 案 | 截圖式有緩衝／尺寸但無歸因；無效／零／不可用尺寸；畫質相符與不符；速度與需求部分缺值、非有限、零及溢位／下溢；六類提示；待回應目標與影音隔離；舊世代／週期列 |
| 既有契約 | 三頁首次刷新與單份快照、按需詳細文字、設定鎖與失敗／遠端更新、失效視圖晚到命令、Native／Catalog／固定／禁止／停用、影音隔離、恢復額度／位置／倍速、取消及重入全部保持 |

導覽修改前四個適配器案例與一個整合案例如預期失敗；UI 修改前 17 個新增案例中 12 個失敗。修復後相關套件及完整測試均通過。新增導覽整合測試停止週期監控以隔離導覽時間與無關停滯；不將此替身情境宣稱為連續播放或恢復實測。

原四個無效容量案例保留名稱及不產生假需求／非有限餘裕的斷言；依新功能調整過時的「缺需求必須連速度一起隱藏」預期，改驗有限正速度仍顯示、無效需求不形成容量宣告。沒有刪除保留功能案例、常值替代或空實作取代有效斷言。

型別與架構檢查通過，92 個執行期模組無匯入循環。最終 verify 全部通過，包含型別、架構、格式、文件、封存、1,634 案測試、兩次確定性建置、語法、撤除功能禁止標記及暫存封裝校驗。暫存工具測試所需 Git 配置寫入在授權權限下執行，不啟動服務。git diff --check 通過；正式封裝及公開核對依下節記錄。

### 安全差異

Codex Security 差異掃描 `b2d6e70e-e8e6-44aa-9d59-b2446fb51996` 固定範圍 `1c981da4796c84ea3abacf0433bf350931d66769..871df885a373f2f9b94f1d9249d0d472d240fc8b`，包含全部八份來源／測試變更。能力預檢通過，全部八份變更檔及必要支持路徑已靜態審查，獨立架構核對完成；封存的掃描結果為 complete、零可回報發現、八個表面均 no_issue_found，沒有延後審查。後續版本、文件及搬移差異另行核對，正式來源／測試／工具與掃描 head 保持一致。不把靜態安全檢查當成安裝實測。工作台回傳關聯三個對話累計用量 8,500,118 tokens（其中 cached input 8,275,968、output 28,909）；它包含關聯對話上下文，不能當成本次差異掃描的獨立增量用量。

## 發行產物與證據保存

腳本版本 **2.2.4**、**421,364 bytes**；SHA-256：`57300645ad2da226e4141f6ebe0439a3da4e718a534408bc9fc20968f4446d89`。建置與安全掃描 head 的產品來源一致，版本三檔與文件／封存差異另核對，沒有新增依賴。

本機忽略證據位於 `.work/v224/`，包含原始檔雜湊、基線與完整案例結果、紅／綠測試及名稱對照。原 v2.2.3 五份 Release 原件已依原始位元組歸檔，原 main 完整報告（含 7／7 R1）追加至歷史正文；既有安全產物、停止決策與日誌原文保持。先保存搬移清單原件，再更新新版本適用保護範圍。

### 公開交付與安裝結案

此為發布前檢查點；版本產物與公開核對依實際完成結果追加，封裝後五份原件不回寫。

### 來源隔離與實際安裝

本輪不啟動瀏覽器、不更新安裝版或恢復停止窗口。v2.2.4 安裝版及使用者原截圖情境尚未實測，來源隔離亦未另行執行。v2.2.3 的七項基本驗收只屬當版當輪，不涵蓋本次新增的導覽重建回歸；舊 FAIL、INVALID 與未解根因不改判。

<a name="v223-r1-安裝驗收2026-11-01"></a>

此相容入口見 [v2.2.3 完整正文及 R1](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v223-完整正文保存2026-11-01)，不是本版新增安裝驗收。

<a name="清除結果與零殘留範圍"></a>
<a name="全文閱讀覆蓋清單"></a>

這兩個舊入口導向 [v2.2.2 零殘留全文清查與逐檔 SHA-256](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v222-完整正文保存2026-11-01)。本版執行變更差異與契約核對，沒有將舊版 211 檔全文清查冒稱為本版重新全文閱讀。

## 歷史驗證導覽

[歷史索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)；[v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修復與根因"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="發布與安裝限制"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修後唯一-hk04-定向窗口"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-30up141-安裝版實測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31更新後安裝核對"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31補測與單分頁重測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="v220-安裝驗收-r12026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="澄清後在原期限內續行"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="auto-2-倍補充與本次驗收結案"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="公開交付"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。
