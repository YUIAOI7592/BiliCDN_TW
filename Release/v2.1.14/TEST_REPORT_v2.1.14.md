<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.14 發行驗證 — 2026-10-10

基準 v2.1.13／45a442071c93f20fa7aeb7dcecfb67c6ba66f526。本輪修復 BR-06 同派送鍵盤 seek 所有權；Auto、15／30／15、BR-01～05、schema 2 不變。**本機修復與發布準備完成；發布讀回與實際新版完整安裝驗收另列，未宣稱結案。** [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR06_FIX_REPORT.md) 記錄前後、完整契約、清理及限制。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。原五正式契約先得到 2 fail／3 pass、退出碼 1，保存未修來源紀錄。最終 BR-06 40／40，全套 19 套件／514 正式案例，44 執行期模組與 43 非入口匯入純度通過；typecheck、architecture、npm test、verify、diff check 已通過。版本遞增後的最終 verify／封裝與 checksum 紀錄另存。沒有 only／skip／todo／cancelled／預期失敗。證據位於 .work/functional-fixes/br06/2026-10-10-45a4420/。

Node EventTarget 派送邊界與 Chrome 不同，替身已明確建模，校準失敗輪保留而不計入通過。正式 suite 不匯入調查目錄。原始 v2.1.13 未提交驗收文件已保留，上一版 TEST_REPORT 完整原文加入歷史報告。

## 獨立安全差異審查

Codex Security 60289fdb-632c-49af-9c37-e55c21464f59 已封存：7 個變更來源／測試檔完整覆蓋、0 可報告發現、0 未決候選。Digest：codex-security-snapshot/v1:sha256:dfa2dc8b2b4d27a3c3cc6b6910910255ee3d9757adfcb4b8de2a915ca4925028。獨立架構複核確認可信同派送關聯、媒體／生命週期、真正可見性、路線／核心／token 與清理控制。Windows 政策 resolver 失敗，根 SECURITY.md 已手動解析，沒有其他嵌套政策。來源保持受審 SHA-256；之後版本／文件變更不屬該安全快照，由主代理另核對。插件報告累計度量 5,628,537 tokens，含 5,312,128 cached input、3 threads；不是本次新增推理用量。與 verify 分開，不能擴大為全產品無漏洞保證。

## Chrome 來源隔離

15／15：真正 trusted BODY 按鍵、監聽器間原生 microtask（eventPhase 1）保留候選、1／2 倍模型的 15／30／15 邊界與不重試、直接 seek、停止傳播、Home 到 0、editable／Ctrl／合成／忽略／例外／腳本還原／hidden／lifecycle／派送後 timer 排除。使用修復来源、合成 media 狀態与 FakeClock；**不是網站 30 秒故障或實際 Tampermonkey singleton 驗收**。所有合成 getter 僅在自有 iframe；網站 getter 未修改。iframe／計時器／監聽器已清理，指定風景片主頁一個 video，來源 raw JSON 與截圖另存。

## 發布與安裝版

目標 v2.1.14 先核對遠端版本未使用；依 AGENTS.md 常設授權直接封裝／提交／推送／正式 Release，只附 BiliCDN_TW.user.js。公開 main／peeled tag／唯一附件／latest 版本、大小與 SHA-256 讀回須完成後另記；未發布不能標通過。

實際新版 body／singleton 與 Auto 1／2 倍完整矩陣見 [安裝驗收](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_ACCEPTANCE.md)。重載後完整 15 秒無進度、不重試、故障新操作、真正 hidden、晚到 SDK 邊界與交叉失效／影音隔離仍依有效前提逐項取證；網站提前 pause／error／外部換核心只證明撤銷。新版未載入前，不開始計算新版通過。

## 剩餘限制與歷史

沒有派送期間可觀察 seek 的鍵盤命令不猜測使用者歸因；派送後網站重試保留期限，只撤銷舊還原。既有外部核心因果觀察限制、原 87.785 秒自然網路原因與其餘產品完整驗收不因此結案。沒有有效 cid 或共同路徑的同片仍保守重設。持久鍵、公開 API、依賴與更新 URL 不變。

<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.13 完整正文與 BR-06 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
