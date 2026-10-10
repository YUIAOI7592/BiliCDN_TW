<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.14 發行驗證 — 2026-10-10

基準 v2.1.13／45a442071c93f20fa7aeb7dcecfb67c6ba66f526。本輪修復 BR-06 同一 keydown 派送內的鍵盤 seek 所有權；Auto、15／30／15、BR-01～05、schema 2 不變。**v2.1.14 已發布並核對實際安裝本體；右鍵 keyup 提交入口確認 BR-07，安裝版驗收未通過，完整 BR-01 未結案。** [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR06_FIX_REPORT.md) 與 [BR-07 詳細報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 分列原驗證範圍及新證據。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。原五正式契約先得到 2 fail／3 pass、退出碼 1，保存未修來源紀錄。最終 BR-06 40／40，全套 19 套件／514 正式案例，44 執行期模組與 43 非入口匯入純度通過；typecheck、architecture、npm test、verify、diff check 已通過。版本遞增後的最終 verify／封裝與 checksum 紀錄另存。沒有 only／skip／todo／cancelled／預期失敗。證據位於 .work/functional-fixes/br06/2026-10-10-45a4420/。

Node EventTarget 派送邊界與 Chrome 不同，替身已明確建模，校準失敗輪保留而不計入通過。正式 suite 不匯入調查目錄。原始 v2.1.13 未提交驗收文件已保留，上一版 TEST_REPORT 完整原文加入歷史報告。

## 獨立安全差異審查

Codex Security 60289fdb-632c-49af-9c37-e55c21464f59 已封存：7 個變更來源／測試檔完整覆蓋、0 可報告發現、0 未決候選。Digest：codex-security-snapshot/v1:sha256:dfa2dc8b2b4d27a3c3cc6b6910910255ee3d9757adfcb4b8de2a915ca4925028。獨立架構複核確認可信同派送關聯、媒體／生命週期、真正可見性、路線／核心／token 與清理控制。Windows 政策 resolver 失敗，根 SECURITY.md 已手動解析，沒有其他嵌套政策。來源保持受審 SHA-256；之後版本／文件變更不屬該安全快照，由主代理另核對。插件報告累計度量 5,628,537 tokens，含 5,312,128 cached input、3 threads；不是本次新增推理用量。與 verify 分開，不能擴大為全產品無漏洞保證。

## Chrome 來源隔離

15／15：真正 trusted BODY 按鍵、監聽器間原生 microtask（eventPhase 1）保留候選、1／2 倍模型的 15／30／15 邊界與不重試、直接 seek、停止傳播、Home 到 0、editable／Ctrl／合成／忽略／例外／腳本還原／hidden／lifecycle／派送後 timer 排除。使用修復来源、合成 media 狀態与 FakeClock；**不是網站 30 秒故障或實際 Tampermonkey singleton 驗收**。所有合成 getter 僅在自有 iframe；網站 getter 未修改。iframe／計時器／監聽器已清理，指定風景片主頁一個 video，來源 raw JSON 與截圖另存。

## 發布與安裝版

v2.1.14 已依 AGENTS.md 常設授權封裝／提交／推送／正式 Release，只附 BiliCDN_TW.user.js。發布時公開 main／peeled tag／唯一附件／latest 版本、大小與 SHA-256 讀回完成，數值見下方發布紀錄。後續驗收文件提交不改版本標籤或發行產物。

實際新版 body／singleton 已核對，Auto 1／2 倍完整矩陣見 [安裝驗收](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_ACCEPTANCE.md)。正常播放、左鍵與短 seek 有通過證據；右鍵未取得新期限。重載後完整 15 秒無進度、不重試、故障新操作、真正 hidden、晚到 SDK 邊界與交叉失效／影音隔離仍待有效取證；網站提前 pause／error／外部換核心只證明撤銷。

## 剩餘限制與歷史

沒有派送期間可觀察 seek 的鍵盤命令不猜測使用者歸因；派送後網站重試保留期限，只撤銷舊還原。既有外部核心因果觀察限制、原 87.785 秒自然網路原因與其餘產品完整驗收不因此結案。沒有有效 cid 或共同路徑的同片仍保守重設。持久鍵、公開 API、依賴與更新 URL 不變。

<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.13 完整正文與 BR-06 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

## 2026-10-10T07:55:30Z 發布讀回

**BR-06 修復與 v2.1.14 發布完成。** 發布提交／peeled tag 056d1a4a9607ed8e96dda45880ec4f82522230a2，遠端 main 核對一致。唯一附件 BiliCDN_TW.user.js，317,276 bytes；無登入公開 latest API／下載核對 2.1.14、大小及 SHA-256 fc2a38d182fd94b3c2ffc786510e858f99f41d702ed279a6c88da7edc0d6c02a，2026-10-10T07:56:00Z 完成。最終 v2.1.14 verify／封裝／提交差異檢查均通過。提交前新契約檔尾空白另清理，不改受審執行期；該非語意測試空白差異與版本／文件在原安全快照之外。既有 Release 快照與原調查保留。

GitHub CLI 一般沙箱讀不到有效 keyring，提升至系統金鑰圈後已核對有效登入並正常發布。發布初期 Chrome 仍完整載入 v2.1.13；工具禁止擴充功能頁面，沒有操作或繞過。使用者手動更新後，07:59:37Z 已核對 v2.1.14 完整執行本體、singleton 1，重連後亦再核對；安裝前提已成立。

## 2026-10-10 安裝續測：BR-07 已重現、未修復

實際指定風景片 Auto 1／2 倍，右方向鍵於 keyup 才改變位置，原 keydown 已為 phase 0，userRevision 不變。新右鍵後 6.995／7.673 秒便備援，1 倍 21.994 秒重載；左鍵於 keydown 更新一次修訂作正常對照。有效故障窗口未截斷；舊 2 倍游標與重跑更晚收尾的淘汰尾段不作完整逾時證據。詳細前提、時序、根因及修正方向見 [BR-07](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.14_BR07_KEYUP_SEEK.md)。

本輪私有正確契約 **2 fail／3 pass，退出碼 1**，明列為缺陷證據；私有 TypeScript 檢查通過。既有正式 BR-06 **40／40** 再跑通過，但模型把左右鍵都放在 keydown，沒有覆蓋真實右鍵入口。沒有修改執行期或正式測試，沒有重跑或宣稱新的全套 verify／安全掃描；前述 514 案例及 15／15 來源隔離保留發布時範圍。

兩輪請求、攔截、觀察器、包裝與計時器已清理；172 個保守收集 ID 及重跑 41 個受控 ID 的記憶體／持久樣本匹配均為 0。依批准計畫交付新缺陷報告，不自動擴大修復。BR-01 完整矩陣與原自然網路起因仍未結案。
