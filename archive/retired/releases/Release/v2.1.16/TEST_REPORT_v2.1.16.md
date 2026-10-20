<a name="bilicdn_tw-v2116-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.16 修復與發行驗證 — 2026-10-10

基準 **v2.1.15／f0c2d39**，開始時工作目錄乾淨。BR-08 完整拖曳契約已完成本機修復：進度列外層及其子節點取得立即保護，私有手勢核對指標／媒體／播放器／內容所有權；可信失焦與真正 hidden 在既有事件 guard 阻擋前通知 PlayerAdapter。Monitor 三個救援入口與 Recovery token 建立均拒絕 dragging，提交前重查最新資格。Auto、15／30／15 秒、重載額度、breaker、影音隔離、公開 API／應用層快照與 schema 2 保持原契約。

**BR-08 必要自動驗證、安全差異與 Chrome 來源隔離通過；v2.1.16 待正式發布與公開產物核對。BR-01 完整安裝版尚未完成。** 詳見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR08_FIX_REPORT.md)、[新版安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.16_ACCEPTANCE.md)。v2.1.15 原失敗及歷史 Release 保留，不將舊版或模型結果計為新版安裝通過。

## 自動驗證與先行失敗契約

| 項目 | 結果 |
| --- | --- |
| 原七個正式契約，未改執行期 | **3 fail／4 pass、退出碼 1**；原紅燈與來源 SHA-256 另存，不計入通過 |
| 擴充 application 紅燈 | 28 個：21 fail／7 pass；最終 controls 同步重入補充為 2 fail／0 pass |
| adapters 紅燈 | 25 個：16 fail／9 pass；早期指標重入補充為 2 fail／2 pass |
| 最終 BR-08 正式案例 | **63／63 通過**：application 34、adapters 29；原七個包含於其中，不重複加總 |
| typecheck／architecture | 通過；**44 個執行期模組** |
| npm test | **19 套件／637 個正式案例通過**，無 only／skip／todo／cancelled／預期失敗 |
| 最終 npm run verify（v2.1.16） | 通過：637 案例、確定性建置、語法、v2-only、暫存封裝 checksum |
| git diff --check | 通過；發布文件整理後再核對 |

具名契約由既有 application／adapters 明確匯入 functional-races/br08.ts／br08-player.ts，使用 testScope、FakeClock、deferred 及型別完整的指標／事件邊界。closest 只搜尋祖先；可見性整合包含真正 VisibilityAdapter guard。正式測試不匯入 .work/。其他套件與 BR-02～07 交叉回歸包含於全套，沒有另增測試登記。

證據目錄 .work/functional-fixes/br08/2026-10-10-f0c2d39/；初始提交 f0c2d39fc9af64eecdc67b2b734b956905bae482，Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2。無效的多套件 CLI 呼叫退出碼 2 單列，不算測試失敗或通過。紅燈、局部綠燈、整合與最終版本 verify 分開保存。

## 獨立安全差異審查

最終 Codex Security 差異掃描 **25cfd1fe-bfd4-425c-a105-2976799c04b8** 已於 **2026-10-10T12:54:19.753947Z** 完成、封存並讀回。不可變快照摘要 eb363339baed391b074ba8ab6e995e058c7ec69d72cf205c1780ac06b3b7ca0c，**14／14 差異面完整覆蓋、0 可報告發現、無未處理候選或延後面**。兩個獨立工作者分工來源／測試，主代理核對版本設定、架構及相關授權／生命週期邊界。三項 preflight 通過；Daybreak Blue granted，模型 gpt-6.1-sol／ultra。

涵蓋可信輸入、同步重入、通知／手勢與恢復所有權、清理、資料輸出。政策 resolver 誤報既有根目錄不存在；直接讀 root SECURITY.md 並確認沒有巢狀政策後完成。保留既有 VisibilityAdapter 描述子還原限制，不宣稱本輪擴修。最終六份封存檔逐檔 SHA-256 相同匯出至本輪 security/final/；封存原件不修改。

較早的 9c437e78-50d0-4748-aba5-7d500aed2a4a 掃描已完成，但其後追加早期指標重入防護，**不是最終差異核准**；上列第二次完整掃描才對應最終來源。安全審查與 verify、瀏覽器證據分列。

## Chrome 來源隔離

最終修復來源在 Chrome 自有 iframe 取得 **31 個有效通過、0 有效失敗**。原始記錄共 33 份，2 個輸入校準窗口無效並明列理由，不加總通過。Debugger 完整已載入 bundle SHA-256 為 9c77ba0fa7bf7c5f0283f78e8d7f00ebe48d15dddf23d91796e56be0372bf0f1，與本機建置相同，沒有截斷。

真正可信滑鼠／觸控涵蓋 wrapper 自身／子節點、inner、舊版、slider、區域外排除；1／2 倍模型按住 31 秒無救援，放開位置 0 重新取得精確 15／30／15 秒並觀察三 tick 不重試；冷起播按住不消耗嘗試，釋放沿用原 firstMediaAt；舊 token 撤銷、雙指標取代與舊指標釋放、真正 lostpointercapture、原有 blur guard 前通知及失敗 listener 隔離、放開移出命中區與所有權替換。

媒體與 FakeClock **僅在自有 iframe**；Route／Measurement 使用受控介面，沒有 GM、學習資料或真實 CDN 探測。這是修復來源組合，不是網站 Auto／ABR 或安裝 singleton。真正 hidden、任意同步 getter／nested 邊界的完整證據仍為正式契約，沒有冒充現場通過。兩個無效校準分別為第一次 CDP touchEnd 結束錯誤指標與滑鼠未產生捕捉遺失前提；真正雙觸控及可信觸控 lostcapture 的新前提案例通過。

清理核對 timer 0、subscription 0、方法及 hidden／visibility 描述子還原、自有 DOM／API／iframe 移除、來源分頁關閉、本機伺服器停止。私有 source/chrome-results.json、chrome-summary.json、chrome-loaded-identity.json、chrome-proof.png 分列結果、身分與清理；不代表安裝版故障過濾／樣本清理。

## 發布與安裝版

設定已升為 **v2.1.16**，GitHub 發布前 main 仍為 f0c2d39，版本標籤未使用；正式封裝、提交、標籤／Release 及公開 latest 的版本／大小／SHA-256 尚待完成。本段將於發布读回後更新；發行快照保留封裝時狀態，不事後回寫。

[新版安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.16_ACCEPTANCE.md) 需實際新版完整 body／唯一 singleton／hooks 身分才開始計分。只用指定風景影片 Auto 1／2 倍，BR-08 按住 31 秒、正常／12 秒延遲、完整停滯期限、新操作與晚到 SDK、真正背景、生命週期／政策／影音隔離及實際 BR-02～05 交叉矩陣均另列。缺少真背景、完整無進度或真正 pending gate 前提時保持待驗收；不以舊版／Node／來源隔離替代。

<a name="歷史驗證導覽"></a>

## 剩餘限制與歷史

BR-08 本機修復完成，發布與安裝驗收分開。網站提前 pause／error／外部換核心、事件截斷或缺失只證明列明的撤銷，不算完整期限。沒有新前提不重複無效窗口。原 87.785 秒自然網路起因、缺少有效 cid 且無共同路徑時的保守重設及其他產品完整驗收仍獨立。

<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.15 完整正文與 BR-08 原始調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2115-release-verification--2026-10-10)
- [v2.1.14 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2114-release-verification--2026-10-10)
- [v2.1.13 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
