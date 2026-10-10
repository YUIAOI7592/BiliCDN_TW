<a name="bilicdn_tw-v2118-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.18 BR-09 修復與發布驗證 — 2026-10-11

基準 v2.1.17／`7ad32efb6fba09300f61c333812642efc6acb6f5`；保留原有未提交的驗收文件。BR-09 正式修復、完整測試、Chrome 來源隔離、獨立安全差異與 v2.1.18 最終 verify 通過；封裝與發布核對另列，未執行項目不提前計為通過。詳見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR09_FIX_REPORT.md)。

## 先紅後綠與自動驗證

| 項目 | 本輪實際結果 |
| --- | --- |
| 原五正式契約，修改來源前 | 2 fail／3 pass；原失敗紀錄保留 |
| 新增 BR-09 正式回歸 | 25／25 通過，由既有 application 明確登記 |
| application／adapters | 256／256、102／102 通過 |
| npm run typecheck | 通過 |
| npm run architecture | 44 個 runtime 模組通過 |
| npm test | 19 套件／741 項通過；0 fail／skip／todo／cancelled |
| npm run verify v2.1.18 | 退出 0；741 契約、確定性建置、語法、v2-only、封裝及校驗通過 |
| git diff --check | 退出 0；發布前再次核對 |

工具 Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2。私有證據 `.work/functional-fixes/br09/2026-10-11-7ad32ef/` 保存 before-contracts、expanded-contracts、all-tests、typecheck、architecture 與原生來源矩陣。修復前紅燈不計入完整測試綠燈，正式套件不匯入調查目錄。

## Chrome 來源隔離

真正 Chrome 原生媒體／WAV Blob，在自有 iframe 分開核對實際 playbackRate 1／2；未知正值→0、未知正值、公用 seek 到 0 及未改變目標，每速各四項，共 **8／8 通過**。四項原生邊界另 **4／4 通過**。SDK／核心／時鐘為受控模型，媒體 getter 保持原生，並未以此宣稱安裝 singleton 故障驗收。較早未明確設 defaultPlaybackRate 的校準紀錄保留；最終採 `chrome-source-rates.json`。iframe、影片及 Blob 清理，沒有 CDN 探測或學習寫入。見 [瀏覽器紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.18_ACCEPTANCE.md)。

## 獨立安全差異審查

Codex Security `ad0243d6-46b4-4245-a78e-1a1e8cc58f9c` 於 **2026-10-10T19:07:25.298326Z** 封存，**3／3 來源／測試差異項、0 候選／0 發現**。覆蓋 PlayerAdapter 所有實際差異、25 案 fixture 及正式登記；獨立架構模型與 Recovery／Monitor／Routes／Vault／儲存／診斷邊界作支持，不宣稱全儲存庫審查。

凍結三檔 SHA-256 保存於私有安全摘要；後續版本／文件／產物變更與此範圍分列，發布前重查三檔雜湊。安全審查不包含於 verify，機器封存不公開個人絕對路徑。

## 發布與安裝判定

本版尚未完成發布核對，不提前填入遠端提交、標籤、附件或公開下載結果。依常設授權完成必要驗證後直接發布；Release 只附 `BiliCDN_TW.user.js`，公開 latest 必須核對版本／大小／SHA-256。

實際修補版安裝目前 **不通過：尚未載入 v2.1.18**。最近於 **2026-10-10T19:02:29.710Z** 核對指定影片完整 body 仍是 v2.1.17、matchingScripts=1。來源隔離與 Node 結果不能取代實際新版。BR-01 v2.1.17 [整體不通過判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)保留，本輪不重跑全部 BR-01 或把其餘證據空缺當已修程式缺陷。

## 限制與歷史導覽

完全在兩次觀察之間完成、沒有 SDK 或媒體事件可見的原生位置往返，不能由有限採樣可靠辨識。未知目標只撤銷位置還原、不取得 userRevision、不延長原期限。Auto／ABR、15／30／15 秒、route／Vault 權限、影音隔離及 schema 2 保持既有契約；原 87.785 秒自然網路起因獨立未定位。

<a name="bilicdn_tw-v2117-release-verification--2026-10-11"></a>
<a name="bilicdn_tw-v2117-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2116-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>
<a name="歷史驗證導覽"></a>

- [v2.1.17 完整正文與最後二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2117-release-verification--2026-10-11)
- [v2.1.16 及更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
- [BR-09 原始失敗報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md)
