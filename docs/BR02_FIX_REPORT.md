# BR-02 XHR 例外安全性修復 — 2026-10-09

**狀態：修復已隨 v2.1.10 發布，公開更新下載已核對；Tampermonkey 修復版待驗收。** 基準為 `b177f76b824b3ef2027023afd933a252939d1ca5`。本機修復交付時維持版本 2.1.9、未提交／發布；其後使用者授權推送更新，發行狀態與新版產物校驗見 [最新驗證報告](TEST_REPORT.md)。原始問題及當時失敗證據見 [BR-02 調查報告](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md)。BR-01 不在本次修復範圍。

## 修復與契約

原 `open()` 在原生驗證之前撤銷舊 phase、監聽器與 metadata。無效 method／URL 或同步選項拋錯後，原生請求與政策身分分離，使排隊錯誤遺失、DONE 倒退，並可能錯誤允許第二次 send。

[XhrHookAdapter](../src-v2/adapters/xhr-hook.ts) 現在先按參數順序完成一次轉換，再暫存候選 metadata，供原生同步事件使用。成功後才釋放舊請求；失敗時只有仍持有候選的呼叫可以回復舊所有權，並傳回原例外。較新的巢狀 open 不會被外層蓋掉；舊狀態／進度監聽器也先檢查所有權。必要的 ByteString／USVString、參數省略及 credentials 語意一起保留，未新增公開 API 或持久資料。

Chrome 154 另有實測邊界：Window 同步選項不合法時，原生 open 拋 InvalidAccessError 並把底層重設為 UNSENT，沒有終止事件。初版修復的 Chrome 矩陣增加 gate 交錯後為 30 通過／1 失敗，捕捉到晚到 send 的 InvalidStateError。補充修復只標記**仍未原生送出的 waiting 請求**；gate 釋放時重新準備原目標、選項與 headers，然後重查所有權及送出政策。期間 abort 或成功 reopen 仍可撤銷它。已送出請求不重播；原生自身的重設／取消行為不被偽裝成成功完成。

## 正式契約與修復前後證據

正式案例位於 [functional-races/xhr.ts](../tests-v2/regressions/functional-races/xhr.ts)，由既有 `native-transport` 套件登記，新增 40 個 `BR-02` 具名案例。替身先模擬原生驗證，再變更狀態；OPENED→OPENED 不憑空發事件，並依 Chrome 證據模擬同步選項錯誤的 UNSENT 邊界。每個 XHR 由 testScope 登記取消清理。

| 契約群組／名稱前綴 | 覆蓋 |
| --- | --- |
| `BR-02 control`、`BR-02 contract` | 原始九個契約及正常對照；四類例外、DONE、事件尾端與禁止第二次 send |
| `BR-02 failed open preserves startup waiter` | gate 正常釋放、重複 abort、晚到不送出 |
| `BR-02 failed open preserves ... native request` | OPENED／已送出／DONE、原生監聽及完成觀察 |
| `BR-02 successful open synchronous callback`、`retiring an active request` | 回呼內 send／abort／open，較新請求不被外層清理 |
| `BR-02 throwing`、`converts`、`conversion reentry`、`missing arguments` | 一次轉換、轉換順序、原例外、缺少參數、Symbol／ByteString 與轉換重入 |
| `BR-02 omitted async`、`custom method casing` | 省略／明確 undefined、credentials 與 method 保存 |
| `BR-02 failed open preserves ... playurl`、`failed sync open with JSON` | default／text／json、HTTP 狀態及 getter 例外 |
| `BR-02 gated failed sync open`、`native preparation lost`、`never replays` | Chrome 特有重設、options／headers、再準備期間取消／取代，已送出不重播 |

先增測試、後改來源。第一輪正式傳輸套件 77 案例為 **60 通過／17 失敗**；修復後通過。Chrome 新發現再先建立 timeout／json 的兩個正式失敗契約，才補上處理。這些紅燈結果是修復前證據，不計作通過。

執行入口：`npm test -- native-transport`；完整驗證及獨立安全審查結果如下。原調查目錄及其失敗紀錄保持不變。

## 自動驗證

執行環境：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。最後清理登記後的完整 verify 已通過；結果不含預期失敗、only、skip、todo 或 cancelled。

| 命令 | 最終結果 |
| --- | --- |
| `npm run typecheck` | 來源與測試型別通過 |
| `npm run architecture` | 43 個執行期模組通過 |
| `npm test` | 19 個套件、339 個具名案例通過；其中 native-transport 為 89 個 |
| `npm run verify` | 339 案例、型別、架構、匯入純度、確定性建置、語法、v2-only 及暫存封裝 checksum 通過 |
| `git diff --check` | 通過；12 份 Markdown 的 202 個本機／同儲存庫連結及 38 個錨點有效，來源／測試／建置雜湊與受驗版本一致 |

修復階段的本機建置 SHA-256 為 `030fec5d63409d4ff617c166123eb09b07f7a5909f08ba8f49b877b08965748c`，僅用於辨識當時驗證來源，不是已發布 v2.1.9 的新附件。該階段未改 `release.json`、依賴設定或 `Release/`；後續 v2.1.10 升版與新封裝另依最新驗證報告記錄，既有 Release 不覆寫。

## 獨立安全差異審查

已完成新的 Codex Security 差異審查，掃描 ID `574bdde1-ec2c-470e-8119-23423ff96a1e`，於 2026-10-09 19:13（Asia/Taipei）封存。兩個變更來源／測試檔完成審查，coverage 為 complete，**0 個可報告的新安全發現、0 個待驗證候選**。能力檢查為 ready，Daybreak 狀態為 granted／Daybreak Blue。

審查追蹤政策與原生目標一致性、一次參數轉換、例外回復、同步重入、舊監聽器所有權及 waiting 再準備。獨立代理建立來源支持的威脅模型，主代理複核兩個差異檔及必要的選路／Vault 邊界。這是固定差異的審查，沒有宣稱整個專案或 BR-01 全面無漏洞，也不沿用 v2.1.9 歷史掃描。

固定快照 digest：`codex-security-snapshot/v1:sha256:0eb35c75c23262e74f4b477f0d49b5c9f5a6d928a480b3c9e3488d205672a629`。不可變更的 report／manifest／findings／coverage／threatmodel 保存在本機 Codex Security scan 目錄 `b177f76b824b3ef2027023afd933a252939d1ca5_20261009T110601Z_2pwc4ai2`；完整路徑見本次證據目錄的 `SECURITY_SCAN.md`。封存後只更新交付文件，來源與測試雜湊維持受審版本。

## 真實 Chrome 隔離驗證

2026-10-09 19:01（Asia/Taipei），Chrome 154.0.0.0 的本機測試頁載入修復來源，使用**真正 Chrome XMLHttpRequest**，其 open／send 確認為 native code；選路／設定／gate 介面為合成測試輸入。**31／31 通過**，涵蓋五個原生對照、Blob 回應、原例外與事件順序、零原生送出、本地拒絕、gate／取消、同步回呼及參數轉換。

HTTPDNS 使用精確合成 URL，先設 CDP Request 階段攔截，另有只允許 loopback／Blob 的頁面 CSP。捕捉窗口沒有截斷，測試目標 requestPaused 為 0；這與 context 的 nativeCalled=0 一起構成此矩陣的證據，不宣稱涵蓋所有網路入口。測試結束已還原 XHR hook、撤銷 Blob、清理監聽器與 Fetch patterns。

這是**來源隔離驗證，並非 Tampermonkey 安裝版驗收**。修復驗證沒有變更安裝版、其他腳本、瀏覽器設定或切換影片。修復產物尚未實際安裝驗收，因此網站播放／暫停／seek 回歸保持待驗收；更新後只使用使用者指定的 [BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/)，重跑 BR-02 矩陣與同片基本操作。

## 證據與限制

本機證據位於 `.work/functional-fixes/br02/2026-10-09-b177f76/`，包含基準、未修復與初版修復的失敗紀錄、正式驗證、Chrome JSON／截圖、可重跑頁面與 RERUN／CHECKPOINT。截圖是明確標示的開發驗證頁，不是產品介面。

原 `.work/chrome-v2.1.9/2026-10-09/followup/` 不覆寫；已發布 Release 與既有安全產物不變。原生其他包裝若在成功改變原生請求後再自行拋錯，不等同本次 Chrome 原生驗證失敗契約；本次不宣稱能回復任意第三方包裝的副作用。BR-01 與 v2.1.9 其他未完成驗收仍各自保留。
