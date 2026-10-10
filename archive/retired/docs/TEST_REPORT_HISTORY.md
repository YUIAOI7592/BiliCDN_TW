# 歷史驗證報告

本文件於 2026-10-06 自 `docs/TEST_REPORT.md` 搬入 v2.0.2～v2.1.7 的十二個主要紀錄區塊，包括發行前模組化驗證。英文正文、順序、日期、數值與當時的 pending 敘述保留；僅按位置調整 Markdown 連結。原文的 current release、first section 等用語保留其原報告脈絡；歷史狀態只適用於記錄當時，不構成目前待辦。

現行入口：[最新版驗證報告](../../../docs/TEST_REPORT.md)、[文件索引](../../../docs/INDEX.md)、[工作狀態](../../../docs/TODO.md)。封存配置見 [封存索引](../README.md)。

---


## 2026-10-10 換版保存：v2.1.14 完整正文與 BR-07 調查追加

以下原文保留 v2.1.14 的日期、原錨點、發布讀回、安裝失敗與限制；「BR-07 未修復」只描述當時。現行修復與發布狀態見 [最新版報告](../../../docs/TEST_REPORT.md)。

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

---

## 2026-10-10 換版保存：v2.1.10 完整正文與 BR-03 本機交付

以下全文保留換版前固定入口的版本、日期、原錨點與限制；「未發布」只描述當時。現行發布狀態見 [最新版報告](../../../docs/TEST_REPORT.md)。

<a name="br03-local-fix-verification--2026-10-10"></a>

# BR-03 本機修復驗證 — 2026-10-10，未發布

基準 `c836a17818cd4ae86195e41b1e1c0933cff8cab0`，設定版本仍為 **2.1.10**。BR-03 已改用請求所屬 cid 優先、有界父目錄集合備援；相同清單排列不再誤增 epoch，真正換片仍同步撤銷舊工作。完整來源／案例對照、原始紅燈紀錄、重跑入口與限制見 [BR-03 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)，目前工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

| 驗證 | 本輪結果 |
| --- | --- |
| `npm run typecheck` | 來源／測試通過 |
| `npm run architecture` | 44 個執行期模組通過、無循環 |
| `npm test` | 19 套件、382 個具名案例通過；新增 43 個，沒有 only／skip／todo／cancelled |
| `npm run verify` | 382 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗全部通過 |
| 獨立 Codex Security | `a9c3fb49-d46b-4a8e-81ee-29856ab3e908` 完成封存；14 個變更來源／測試檔完整覆蓋，0 可報告發現、0 待驗證候選 |
| Chrome 修復來源隔離 | BR-03 31／31、BR-02 相容性 31／31；成功輪 Request 事件未截斷，hooks restored；工具失敗輪作廢並另列限制 |
| Chrome 既有安裝版 | 指定同片暫停／續播、4K↔1080P、獨立 seek 正常，恢復 4K 並暫停；這是舊 v2.1.10，沒有安裝 BR-03 修復 |
| 文件／差異檢查 | 連結、錨點、`git diff --check` 與來源／Release 雜湊結果保存在本輪證據目錄 |

證據保存於 `.work/functional-fixes/br03/2026-10-10-c836a17/`。Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2，無工具版本變更。修復前的原四契約 2 通過／2 失敗、擴充失敗結果均單獨保存，不混算通過。安全快照 digest 為 `codex-security-snapshot/v1:sha256:31543372cedbba943e0f4de533b3d34d68790794e4c471de11ee123284685033`；安全封存後只補交付文件與重跑說明，受審來源／測試保持雜湊一致。

**沒有提交、推送、升版或發布；Tampermonkey BR-03 修復版仍待驗收。** schema 2、持久鍵及既有 Release 不變。沒有有效 cid 也沒有共同路徑時仍保守重設。BR-01、真正 startup gate 與 R04 完整故障隔離未結案；來源隔離或短程播放不能替代安裝版矩陣。

以下完整保留 **v2.1.10 發布及修復前驗收正文**；其中「BR-03 尚未修復」「本輪僅文件」均指原日期的那次工作，不描述上方本機修復。版本未變更，因此未搬移本版正文；Release 快照不回寫。

---

<a name="bilicdn_tw-v2110-release-verification--2026-10-09"></a>

# BiliCDN_TW v2.1.10 發行驗證 — 2026-10-09

本版從 `b177f76b824b3ef2027023afd933a252939d1ca5` 修復 BR-02 XHR failed open 所有權問題。使用者在完成本機修復後授權推送更新，本版已於 2026-10-09 20:58（Asia/Taipei）發布；標籤對應提交 `49995fbc29ee638739487b3a27aa5c4a662a8741`，公開 latest 下載校驗一致。完整變更與契約見 [BR-02 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR02_FIX_REPORT.md)，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 修復與相容性

open 先完成一次參數轉換，暫存新 metadata 供同步回呼使用。原生成功後才撤銷舊所有權；失敗時只還原仍由候選持有的物件，較新的巢狀請求不被覆蓋。舊監聽器先驗證身分，避免事件及觀察污染。Chrome 非法 Window 同步選項造成 UNSENT 時，只重新準備尚未原生送出的 waiting 請求，保留選項／headers 並重查政策；已送出工作不重播。

只新增內部狀態，未新增公開 API、設定或持久欄位。schema 2、Vault 唯一授權、嚴格影音隔離、Fetch 單讀取器及 Worker 不介入保持原狀。BR-01 畫質切換停滯沒有併入本修復。

## 自動發行驗證

工具版本：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。v2.1.10 已通過獨立 typecheck、architecture、npm test 與完整 verify，所有命令退出碼為 0。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 來源及測試通過 |
| `npm run architecture` | 43 個執行期模組通過，無匯入循環 |
| `npm test` | 19 個套件、339 個具名案例通過；新增 40 個 BR-02 契約，native-transport 共 89 個 |
| `npm run verify` | 型別、架構、339 案例、42 個非入口模組匯入純度、確定性建置、語法、v2-only 及暫存封裝校驗全部通過 |

沒有 only、skip、todo 或 cancelled。失敗契約先於來源修復建立，修復前 77 個傳輸案例中 17 個失敗，Chrome UNSENT 邊界也先建立失敗證據；紅燈紀錄不計入通過。發行證據另存本機 `.work/release-v2.1.10/`。

## 獨立安全審查

BR-02 固定差異的 Codex Security 掃描 `574bdde1-ec2c-470e-8119-23423ff96a1e` 已封存，兩個來源／測試檔完整覆蓋，0 個可報告的新安全發現、0 個待驗證候選。快照 digest 為 `codex-security-snapshot/v1:sha256:0eb35c75c23262e74f4b477f0d49b5c9f5a6d928a480b3c9e3488d205672a629`，preflight ready；Daybreak granted／Daybreak Blue。

升版沒有再次修改受審 xhr-hook.ts 或正式契約；其他執行期檔案相對基準只有 metadata 版本變更。發布前重新比對受審雜湊及版本差異，沿用此已完成的安全審查，不宣稱另跑新掃描。它不代表全專案或 BR-01 全面無漏洞；原始安全產物不回寫。

## 封裝與更新

正式產物為 `Release/v2.1.10/BiliCDN_TW.user.js`，**293,972 bytes**，SHA-256 為 `f30464996ee9da7e3b655e029746693e3db1c8b547ea70ed44a794d00a04acf8`。GitHub Release 僅上傳使用者腳本；報告、CHANGELOG、BUILD_MANIFEST 與 SHA256SUMS 留在儲存庫。既有 Release 不覆寫；公開 latest 下載已核對相同版本、大小及 SHA-256。

更新 URL 維持 [最新使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。版本、依賴鎖根版本與 metadata 一致；沒有新增執行期依賴或 CI/CD。

## 發布確認

2026-10-09 20:58（Asia/Taipei）完成 [v2.1.10 正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.10)。main 與標籤已推送，唯一附件為 BiliCDN_TW.user.js。20:58 的公開 latest 讀回確認版本 2.1.10、293,972 bytes 及上述 SHA-256 一致。此後僅補寫現行發布狀態，不回寫封裝報告或 Release 快照。

## Chrome／Tampermonkey 狀態

BR-02 修復來源已在真實 Chrome 154 的隔離頁通過 31／31 個案例，使用原生 XHR、Blob 及受控合成輸入。HTTPDNS 先設定精確 Request 攔截及頁面 CSP，捕捉窗口未截斷、目標 requestPaused 為 0；hook、監聽器、Blob、攔截及測試伺服器已清理。

以上是發行時的來源隔離證據。**2026-10-09～10 已實際載入 Tampermonkey v2.1.10 進行部分驗收：68 個 XHR 案例執行通過**，含原生對照；真正 startup gate 的 failed open 交錯尚未觸發，不能用隔離或 Node 結果替代。

指定 [BV1tFZZBQE57](https://www.bilibili.com/video/BV1tFZZBQE57/) 取得播放、88.2 秒暫停／續播與一次 8K→4K 正常對照；另一次切換加 seek 停滯 87.8 秒後以 1080p 恢復，BR-01 根因仍待定位。新確認的 **BR-03** 是相同 DASH 清單排列誤增 epoch，來源契約 2 通過／2 失敗，實際安裝版 2→3、正常對照 4→4；尚未修復。完整證據與剩餘範圍見 [v2.1.10 安裝版紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.10_ACCEPTANCE.md) 及 [BR-03 詳細報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.10_BR03_CONTENT_EPOCH.md)。

本輪依「找到問題並撰寫詳細報告」條件交付，沒有宣稱全套驗收完成。僅新增證據／文件，未修改來源、正式測試、Release 或版本，未提交／推送。本輪未重新執行完整 npm 發行驗證或安全掃描，上方 339 個正式案例及安全结果保持原執行日期；獨立失敗契約不混算。

## 歷史驗證導覽

<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

- [v2.1.9 完整歷史驗證與當時瀏覽器狀態](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v219-release-verification--2026-10-09)

v2.1.8 的完整正文於 2026-10-09 移入歷史報告，保留原始數值、日期、發布及瀏覽器限制。舊錨點導引如下：

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 發行驗證 — 2026-10-04](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)

<a name="reproduction-and-implementation"></a>

- [v2.1.8 重現與實作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#reproduction-and-implementation)

<a name="automated-verification"></a>

- [v2.1.8 自動驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#automated-verification)

<a name="separate-security-and-browser-evidence"></a>

- [v2.1.8 安全與瀏覽器證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#separate-security-and-browser-evidence)

<a name="publication-confirmation"></a>

- [v2.1.8 發布確認](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#publication-confirmation)

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

- [v2.1.8 Chrome／Tampermonkey 觀察](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#chrome--tampermonkey-observations-after-standard-update)

更早十二個區塊於 2026-10-06 移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，正文保留原文與當時限制。原主要標題錨點保留為導引；歷史「待完成」不構成目前工作，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。文件搬移與本次檢查另見 [文件維護歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

<a name="published-bilicdn_tw-v217-test-report"></a>

- [v2.1.7 已發布驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#published-bilicdn_tw-v217-test-report)

<a name="historical-modularization-verification--before-release"></a>

- [發行前模組化驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-modularization-verification--before-release)

<a name="historical-v216-test-report"></a>

- [v2.1.6 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v216-test-report)

<a name="historical-v215-test-report"></a>

- [v2.1.5 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v215-test-report)

<a name="historical-v214-test-report"></a>

- [v2.1.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v214-test-report)

<a name="historical-v213-test-report"></a>

- [v2.1.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v213-test-report)

<a name="historical-v212-test-report"></a>

- [v2.1.2 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v212-test-report)

<a name="historical-v211-test-report"></a>

- [v2.1.1 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v211-test-report)

<a name="historical-v210-test-report"></a>

- [v2.1.0 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v210-test-report)

<a name="historical-v204-test-report"></a>

- [v2.0.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v204-test-report)

<a name="historical-v203-test-report"></a>

- [v2.0.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v203-test-report)

<a name="historical-v202-verification-unchanged-scope"></a>

- [v2.0.2 歷史驗證（當時範圍不變）](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v202-verification-unchanged-scope)

<!-- 2026-10-10 換版保存：以下為 v2.1.12 最新正文，含原未提交 Auto 調查追加；原始日期與限制不變。 -->

<a name="bilicdn_tw-v2112-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.12 發行驗證 — 2026-10-10

基準 v2.1.11／f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e；本輪只修 BR-04／BR-05。**修復、v2.1.12 發布與兩項實際安裝版驗收完成；BR-01 與其餘完整驗收未結案。** 正式契約、來源隔離、獨立安全審查、公開產物與安裝版結果分列。完整對照見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR04_BR05_FIX_REPORT.md)。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。v2.1.12 的 typecheck、architecture 及 npm test 通過；44 個執行期模組、19 套件、448 個具名案例，沒有 failed／only／skipped／todo／cancelled。新增 19 個 BR-04 與 47 個 BR-05。未修來源的 native-transport 115 pass／23 fail、measurement-state 4 pass／28 fail 單獨保留，不混算通過。

完整 npm run verify 已通過：型別、架構、448 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 及暫存封裝 checksum。git diff --check 通過；證據位於 .work/functional-fixes/br04-br05/2026-10-10-f27b3a2/。

## 獨立安全審查

最終凍結差異的 Codex Security **9ceb91f0-9690-4372-9e86-8e07ea29c11b** 已封存：12 個變更來源／測試／版本設定檔完整覆蓋、0 可報告發現、0 待驗證候選、沒有快照漂移警告。Snapshot digest 為 codex-security-snapshot/v1:sha256:4ae67faaca413f0591719ff73b61c0d6f30c000a19f0d23fc22cd66ed6a0d213。封存前核對 10 個獨立複核來源／測試的最終 SHA-256，全部一致；另外審查兩份版本設定，只有版本變更。完整報告與 receipt 由 Codex Security 管理保存，與一般 verify 分開。首輪漂移報告保留，未當作最終快照。 安全不屬於 npm run verify，也不是全儲存庫無漏洞保證。

## Chrome 來源隔離

Chrome 155 原生 Fetch／XHR／RangeProbe，36／36 通過，75 次合成直接 206 探測與 39 次 media 回應；真正共用 gate 完成 measured。BR-02、BR-03 各 31／31。有效攔截窗口沒有截斷、沒有合成請求外送，無未處理拒絕，hooks 已還原；作廢工具輪與清理詳見修復報告。這是修復來源＋記憶體儲存，**不是 Tampermonkey singleton 驗收**。

## 產物與發布

2026-10-10 04:24:04（Asia/Taipei）[發布 v2.1.12](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.12)。來源提交 cdbb10b3e9ce8f56485dd427dd38d10e848ba005，遠端 main 及標籤 peeled commit 一致，annotated tag 物件 67d1d2a8ba6134b279769b2929400659ad67aaba。使用者腳本 298,785 bytes，SHA-256 c3874efbf718a3eebcc64cf2591d1a328d7ddde1aac40b7d91faf593f7c6e28d。GitHub Release 唯一附件為 BiliCDN_TW.user.js；04:24:40 未認證的公開 latest API／下載回傳 200，版本、大小與 SHA-256 全部一致。更新 URL 保持 [公開 latest](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。發布後只補現行文件，不覆寫 Release 快照或重封裝產物。

## Tampermonkey 與剩餘限制

實際 Tampermonkey 已自動更新 v2.1.12，Debug source 的完整程式 body 與發布附件相同。**35／35 通過**：2 原生 XHR、5 安裝版 XHR 共用 gate 重入／abort／replace、9 原生 Fetch reason、18 安裝版預取消／等待取消、1 未取消的共用 Fetch 正常對照。真 singleton／probe 未替换，gate measured；合成請求精確送出前攔截，3 Range 206、2 CORS OPTIONS、3 media 200，沒有外送或事件截斷。有效輪執行前後完整 routeEvidence 相同，合成樣本／cursor 寫入只在本輪以實例掛鉤抑制並清理；測試邊界詳見 [安裝版紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.12_ACCEPTANCE.md)。

同一支指定風景影片的播放前進、暫停穩定、恢復及短程方向鍵 seek 通過；seeked 約 317 ms、無 mediaError，之後持續播放。沒有切換影片、修改 Chrome 設定或停用其他腳本。作廢輪因測試攔截器缺少 CORS 回應，正常 XHR 對照失敗，不計通過；其錯誤樣本抑制也造成三筆合成學習樣本及退避，已依精確 owned IDs／時間清理。最多三筆可能被有界保留淘汰的先前樣本無法重建，不宣稱完整復原歷史資料。BR-01 長 seek 政策／原網路起因、background／SDK 自然故障及其餘完整產品驗收見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 2026-10-10 BR-01 Auto 調查追加

本次在 main／c924b0216fe0a8f7a624f391d44b36660daca433，核對實際 Tampermonkey v2.1.12 body 與上述產物一致。以 Auto 為主要場景，11:57 的有效影片受控延遲 seek **28.133 秒**，解除攔截後正常對照 **1.555 秒**；epoch 維持 1，沒有腳本核心重載，網路事件沒有截斷。原 87.785 秒自然故障起因未證實，未把 Auto 正常降畫質判為缺陷。完整事件、救援缺口、作廢輪與清理限制見 [BR-01 Auto 深度調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md)。

本輪重新執行 typecheck、architecture（44 模組）、npm test（19 套件、448 具名案例）通過。獨立調查重現 **3 pass／3 fail／退出碼 1** 另存，兩個有界恢復候選斷言尚待政策，未登記正式套件；不能算作修復通過。沒有修改執行期來源／正式測試／版本／Release，沒有新 verify 或安全掃描／發布；既有發行結果保持其原日期。新證據在 .work/functional-review/br01/2026-10-10-c924b02/，BR-01 修復及其餘完整驗收仍未完成。

## 歷史驗證導覽

<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

- [v2.1.11 完整發布與續測正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2111-release-verification--2026-10-10)
- [v2.1.10 完整歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2110-release-verification--2026-10-09)
- [其餘歷史導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 原錨點與完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)


---

<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

# BiliCDN_TW v2.1.9 發行驗證 — 2026-10-09

**目前另有 BR-02 本機修復、未發布。** 新增 40 個正式契約與 31 個 Chrome 來源隔離案例；最新自動／安全結果及安裝版待驗收狀態見 [BR-02 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR02_FIX_REPORT.md)。以下 v2.1.9 發行數字與當時安裝版觀察保持原紀錄，不將本機建置當成已發布版本。

本報告記錄以 `71f7ddd6f7cb5e538244419e801925e1a7d1ab10` 為基準的 17 項功能與競態修復，包含嚴格影音隔離。使用者在完成本機修復後授權推送 GitHub 以提供更新；本版已於 2026-10-09 發布，標籤對應提交 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7`。現行指南見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)，逐項來源、契約與剩餘限制見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/FUNCTIONAL_FIX_REPORT.md)。

## 修復與相容性

涵蓋 R01–R04、A01–A03、B1–B5 及 C-01–C-05。修復內容週期撤銷、播放器採樣與恢復、漸進式簽名刷新、政策版本、跨執行環境樣本 ID、鎖後量測資格、XHR 取消與重用、單節點設定合併及過期 UI 回呼。修改執行期前先建立失敗契約，調查證據與正式回歸分開保留。

schema 2、持久鍵、舊樣本讀取、完整 Catalog 候選池、Vault 唯一授權、Fetch 單讀取器及 Worker 不介入維持不變。不新增同世代 API 逆序回應、清除學習屏障或原生 GM 通知競合政策；沒有 Web Locks 的既有限制仍在，不宣稱恢復歷史遺失樣本。

## 自動發行驗證

2026-10-09 在版本 2.1.9 上重新執行下列命令，全部通過：

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm run architecture` | 43 個執行期模組，通過分層與所有權規則 |
| `npm test` | 19 個登記套件、299 個具名案例全部通過；無 only、skip、todo、cancelled |
| `npm run verify` | 通過型別、架構、測試、42 個非入口模組匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗 |

工具版本：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。發行記錄保存在本機 `.work/release-v2.1.9/`，不作 Release 附件。此次 299 案例與 v2.1.8 的歷史斷言數、後來工具遷移的 215 案例具有不同計數脈絡，不互相換算。

## 獨立安全差異審查

Codex Security 掃描 `7038b1e4-687a-4df3-b492-2cf73065727e` 已於 2026-10-09 完成封存。審閱全部 41 個變更來源檔，覆蓋狀態 `complete`，未完成審查項目 0，可回報發現 0。範圍包括 Vault 授權刷新、政策失效、舊工作提交及 XHR 狀態攔截；獨立於 npm verify。

受審快照摘要：`codex-security-snapshot/v1:sha256:041ddddd42903006c268b668cac1562a53f5c690108c095e31de695d9ee43b14`。發行前比較 45 個來源檔，44 個保持受審雜湊，唯一變更為 metadata 的版本 2.1.8→2.1.9；未再修改執行期邏輯。掃描結果不保證不存在漏洞，也不代表瀏覽器驗收通過。

## 封裝與更新

v2.1.9 使用者腳本為 **292,728 bytes**，SHA-256 **`051066c36a2e90aa19507671de75483667beb9757502b54f44522e4390b07f55`**。版本化封裝保存發行前報告、變更紀錄、建置資訊清單與校驗值；GitHub Release 只上傳 `BiliCDN_TW.user.js`。發布後的讀回狀態只更新現行文件，舊版及本版已發布快照不回寫。

`@updateURL` 與 `@downloadURL` 維持 [最新 Release 使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。版本化封裝內保存發布前的驗證快照，以下為發布後另行讀回的結果。

## 發布確認

2026-10-09 15:42:33（Asia/Taipei）正式發布 [v2.1.9](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.9)。GitHub latest API 確認為最新、非草稿、非預發行，只有一個附件 `BiliCDN_TW.user.js`。遠端標籤解析至 `7ef87c0ec456f13895a0ba770a5b7a54baab52a7`，發布時 main 亦為此提交；後續只補入發布文件，不修改已發布產物。

15:43:07 從實際 latest 更新網址取得 HTTP 200，下載結果的 `@version` 為 2.1.9、大小 292,728 bytes，SHA-256 與本機已驗證產物及 GitHub 附件摘要三者一致。讀回紀錄保存在本機 `.work/release-v2.1.9/published-readback.json`。217 個歷史 Release 檔案未改動，v2.1.8 正文已搬移保留；本版封裝校驗及 `git diff --check` 通過。

## Chrome／Tampermonkey 狀態

**2026-10-09 已執行部分真實瀏覽器驗收，尚未全面通過。** Chrome 154.0.0.0 的實際分頁診斷確認載入 2.1.9；使用者截圖顯示 Tampermonkey 5.5.0，並與 Bilibili Evolved 2.11.4 共存。18 個原生 XHR 合成輸入案例、真實 Web Locks 下的 R02／R03 控制中心操作，以及指定展示影片的部分播放／seek／畫質情境通過。

第一輪 8K→4K 曾在 seeking 狀態停滯至少約 2 分 24 秒，乾淨分頁第二輪切換正常；原因仍待定位，不計為已確認程式缺陷，也不能列為整項通過。最終回到正常 4K／AV1／2 倍速，完整設定讀回與初始一致。實測資料、異常及尚未覆蓋範圍見 [v2.1.9 Chrome 紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.9_ACCEPTANCE.md)；原始步驟見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/FUNCTIONAL_FIX_REPORT.md#chrome-與-tampermonkey-待驗收步驟)。本輪未修改執行期來源、瀏覽器設定或 Release；未重新宣稱自動測試或安全掃描結果。

**同日晚間續測已確認未修復的 BR-02。** failed open 會使本地等待的 XHR 遺失 error／loadend，或使虛擬 DONE 倒退；Chrome 新矩陣兩個正常對照通過、六個情境失敗，額外不同 Blob 對照也通過。獨立來源重現為 9 案例、2 通過／7 預期失敗、退出碼 1，沒有加入正式套件或當作整體通過。詳見 [BR-02 問題報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md)。本次完成使用者設定的「找到問題並撰寫詳細報告」條件，未完成的驗收仍保留。

v2.1.8 的合法 MP4 試片／公開 DASH 觀察、完整公開 MP4／FLV 覆蓋限制及其安全報告標記均保留於歷史正文。v2.1.6 驗收仍為已批准結案，不因本版修復重新開啟。

---

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

# BiliCDN_TW v2.1.8 發行驗證 — 2026-10-04

本報告記錄已發布的 MP4／FLV 修復；v2.1.7 及更早證據見下方[歷史導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TEST_REPORT.md#歷史驗證導覽)。依使用者要求，v2.1.8 先發布再執行新的 Chrome 回歸，讓 Tampermonkey 使用既有更新 URL。於 2026-10-04（Asia/Taipei）發布 [v2.1.8](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.8)，標籤／提交為 `b6e2ff11ef53ce3a338cc197c90edecdf0bb2b60`。先前 `Release/v*/` 快照保持原樣。現行指南見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)。

<a name="reproduction-and-implementation"></a>

## 重現與實作

原目標頁面的 playurl 請求回傳 HTTP 200／上游 `code` 0，包含一個 MP4 `durl` 分段。舊適配器只辨識 DASH，因此拒絕結果；Fetch 攔截輸出本機 HTTP 503／`code` -1，未提供可播放資料。當時尚未啟動媒體 CDN 請求，不能據此宣稱全部 Catalog 主機失敗。修改執行期程式前，契約測試已重現解析器拒絕及 Fetch 503。

修復接納 MP4／FLV 分段與已辨識的混合 DASH 分支，保留分段順序及非 URL 中繼資料；必要分段全部規劃後才寫回 URL。資料格式錯誤、容量不足或無可用輸出時，嚴格漸進式回應整份拒絕。Vault 管理的來源不透明識別碼用於同段內建節點清單（Catalog）輸出；精確原生簽名路線（Native）授權仍有界且獨立。完整 Catalog 資格及排名保留，起播探測共用最多三個候選／三秒窗口。無明確結果時不提交測速贏家，送出依當前完整合法候選池判斷。固定主機、Catalog 及原生來源設定變更會失效計畫、取消腳本探測／恢復。最近 playurl 診斷只含有界格式／數量／狀態／`code`／原因欄位。

<a name="automated-verification"></a>

## 自動驗證

2026-10-04 的 `npm run typecheck`、`npm run architecture`、`npm test` 及 `npm run verify` 均通過。結果為 **891 項功能斷言**、**18 項架構斷言**、**42 個執行期模組**，以及 **41 個非入口模組**的匯入純度檢查。verify 通過確定性建置、JavaScript 語法、僅含 v2 的打包產物及暫存封裝／校驗值，未覆寫已發布 Release 產物。`git diff --check` 通過。一般沙盒阻止 esbuild 讀取上層目錄；使用經審核的執行權限後，相同 `npm test`／`verify` 命令通過。

四個新獨立套件涵蓋漸進式解析／生命週期／授權／容量（139 項斷言）、完整候選池選路及起播／固定設定競態（58）、MP4 Fetch／XHR 整合（15）、安全型別化 playurl 摘要（49）。既有 DASH、四種模式、設定、來源授權、影片／音訊、Fetch 讀取器／取消／正規化及 XHR 相容契約仍通過。另有狀態層斷言區分僅使用 Catalog 來源材料與 Native 授權。

<a name="separate-security-and-browser-evidence"></a>

## 分開記錄的安全與瀏覽器證據

最終 Codex Security 差異掃描 `447fbcd6-b672-4e0f-a572-e7805ef97e45` 已完成，並封存為不可變更的產物。權威變更程式清單的 **30 個項目**全部完成審閱，沒有合理候選或可報告問題。最終語意提交已結案所有來源面，但工具仍保留一筆已被取代的中途待審紀錄，因此正式覆蓋狀態仍為 **`partial`（部分覆蓋）**。該紀錄列出九個其後已審閱、以 `no_issue_found` 結案的 Vault／playurl／傳輸（`transport`）檔案；這是保留的檢查點限制，不代表來源未審閱。已封存且不可變更的產物保持原樣。不可變受審工作樹摘要雜湊為 `07ca765f6c2faae011f89cbf0e27dac032e98f3193a120a9e95570b2ef7efa8a`，基準為 `fa3946ec2807360c8a2b84291c213d624ef4142d`。此結果是靜態變更程式審閱，不是全儲存庫稽核或瀏覽器驗收。

封裝前，**43 個建置資訊清單輸入**均符合已驗證雜湊。v2.1.8 使用者腳本為 **285,037 bytes**，SHA-256 為 **`c2bda1e0be4b086e7622e34d3fba0a6cdfdd5eb612afea700289758112c9eb4f`**。後續修改只涉及發布證據及文件，應用層執行期程式不變。掃描目標工具記錄 723,436 tokens（模型詞元）及 1,174 秒（19 分 34 秒）；這是其目標計數，不是帳單。

發布後，使用者完成 Tampermonkey 標準更新。DevTools 確認安裝版本 **2.1.8**，包含漸進式解析器。下方真實瀏覽器觀察與自動、安全證據分開。FLV 目前只有自動覆蓋，沒有建立合法現場樣本。

已封存且不可變更的發現項目 SHA-256 為 `efdc076ba573da8e9437295c83f80cf46366c28cd83e0ae468e676440330fd8a`；覆蓋狀態 SHA-256 為 `8ebb2dd034a43582c872fe71d5581309e17fcea229e905e919fbfdd5af123542`。

<a name="publication-confirmation"></a>

## 發布確認

2026-10-04 的 GitHub 讀回確認 v2.1.8 為最新非草稿、非預發行版本，只有一個附件：`BiliCDN_TW.user.js`，285,037 bytes，GitHub 附件摘要雜湊與上方已驗證 SHA-256 一致。遠端 `main` 與 `refs/tags/v2.1.8` 當時都指向 `b6e2ff11ef53ce3a338cc197c90edecdf0bb2b60`。使用者在遠端 README 的修改已合併，未強制推送；最新 Release 更新 URL 提供此修復。版本化封裝保存發布前驗證快照，後續發布／瀏覽器狀態只記在現行文件。

發布後另外開啟新的 Chrome 目標分頁。最初 DevTools 確認**安裝版本仍為 2.1.7**，沒有漸進式解析器，頁面仍顯示 `code` -1；這不是 v2.1.8 測試結果。使用者完成正常 Tampermonkey 更新後，DevTools 才確認 v2.1.8。瀏覽器工具政策禁止控制擴充功能管理頁；使用者指定正常 Release 更新後，未嘗試本機檔案匯入或繞過政策。

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

## 標準更新後的 Chrome／Tampermonkey 觀察

於 2026-10-04（Asia/Taipei）在獨立 Chrome 分頁觀察，沿用網站既有倍速（初始化後為 2x）。未變更播放偏好或帳號權益。只記錄有界中繼資料、實際回應主機／狀態及影片時間／錯誤值；未持久化簽名媒體 URL、路徑、查詢字串、權杖或原始資料內容。截圖僅涵蓋影片標題與播放器，排除登入帳號資訊。

| 案例 | 播放觀察 | 實際網路面板（Network）觀察 |
| --- | --- | --- |
| 原始 [MP4 目標](https://www.bilibili.com/video/BV1Xwa96pE7g/) — 僅授權試片 | playurl HTTP 200／`code` 0，`format: mp4`，一個 `durl` 分段。13:48:26.878 至 13:48:43.315 UTC 的九個樣本：目前播放時間 0.799119 → 4.525805 → 8.623854 → 12.716896 → 16.827735 → 20.922018 → 25.011643 → 29.098042 → 試片結束 30.296938 秒。無媒體錯誤；`readyState`（就緒狀態） 4，持續播放至試片結束。連續進度觀察超過 12 秒實際經過時間。 | HTTPS `upos-sz-mirrorali.bilivideo.com`，直接 **206 媒體回應（`Media`）**，無磁碟快取或媒體轉址。此窗口事件擷取未截斷。 |
| 替代公開 [DASH 影片](https://www.bilibili.com/video/BV1YgT26qETR/) — 使用者回報原片改會員限定後選用 | 伺服器端渲染（SSR）播放資訊 `code` 0，18 個 DASH 影片媒體表示、3 個音訊媒體表示，沒有 `durl`。上游 `format: flv720` 標籤不表示此為漸進式 FLV 樣本。13:54:46.966 至 13:54:59.103 UTC 的七個穩定樣本：365.202979 → 369.262146 → 373.316104 → 377.346458 → 381.420513 → 385.440562 → 389.501470 秒。全部正在播放、`readyState`（就緒狀態） 4、無媒體錯誤。 | 影片及音訊請求與各自同串流媒體表示路徑的比對只在記憶體進行。實際目的地為 Catalog 主機 `upos-sz-mirrorali.bilivideo.com` 及 `upos-sz-mirroraliov.bilivideo.com`，直接 HTTPS **206**；未截斷的擷取中未觀察到媒體轉址。 |

較早 DASH 窗口在約 95.95 秒時短暫停留 `readyState`（就緒狀態） 2，之後恢復播放。部分網路事件回報 DNS 失敗及取消請求；本紀錄不宣稱每個 Catalog 主機成功或全程無緩衝。後續穩定窗口確認連續進度達 12.137 秒實際經過時間。

原上傳者已將 MP4 目標改為會員限定。成功觀察只涵蓋網站合法 30 秒試片，**不涵蓋完整會員內容**。依使用者指示，後續正常播放回歸採替代公開 DASH 影片。完整公開漸進式 MP4 及合法現場 FLV 樣本尚未建立；這些是覆蓋限制，不是新的實作待辦，也不代表全部格式均經瀏覽器驗收。本機裁切截圖保存在 `.work/v2.1.8-mp4-chrome-2026-10-04.png` 及 `.work/v2.1.8-dash-chrome-2026-10-04.png`，屬私有證據，不是 Release 附件。未匯出 HAR 或簽名回應資料內容。

上述觀察後，九份現行文件同步發布／更新／瀏覽器狀態。當時這些文件的 **103 個本機連結及錨點**與 `git diff --check` 均通過。該次文件檢查未重跑執行期測試、未變更應用層程式，也未改動封裝 Release 快照。

**v2.1.6 驗收維持已批准、已結案。** v2.1.8 發布已完成，自動／安全與新瀏覽器證據各自記錄。

---

# Published BiliCDN_TW v2.1.7 test report

> Current release evidence is summarized in the first section. All later version/pre-release sections are dated historical records; their pending or unpublished language describes that time, not the current backlog. Document status is indexed in [docs/INDEX.md](../../../docs/INDEX.md). Packaged `Release/v*/` reports remain immutable snapshots.

## Release scope

Released on 2026-10-03 (Asia/Taipei) as [v2.1.7](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.7), commit `03beb91a5fdc34c8bcaf6f623783bfc411737d0e`, from baseline `307f9a6f38b5a559e05e32c50c5b3f8ca1636257`, after the completed modularization implementation documented below. Settings schema/defaults, the Catalog roster, Native-source opt-in, original comparison and UI/diagnostic semantics remain compatible with v2.1.6.

## Final automated verification

On 2026-10-03 (Asia/Taipei), `npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` all passed for v2.1.7. The architecture check covers 41 runtime modules; tests retain 626 functional assertions and add 18 architecture assertions plus import-purity checks for all 40 non-entry modules. Verify passed deterministic double build, JavaScript syntax, v2-only bundle and package/checksum validation in a temporary directory. `git diff --check` also passed.

The production userscript is **273,691 bytes**, SHA-256 **`6cc8d1bdcc1afd76859a7831c3b467d9d7f5fddf4f238df47a4a28c475f2e405`**. Formal release packaging uses these same build inputs and retains the packaged script, report, changelog, manifest and checksum list under `Release/v2.1.7/`.

## Security evidence and browser status

The final implementation diff was reviewed in Codex Security scan `650fe466-dc70-4427-be60-b8da85b84e0b`: all 53 changed review items were examined with zero reportable findings. The sealed coverage document retains one stale intermediate deferred entry even though both runtime and script/test surfaces are closed as `no_issue_found`; the canonical partial-coverage limitation remains explicit in the implementation record below. A readback for this release confirmed the same sealed result. Before release metadata changes, all 38 `src-v2/` inputs in the verified build manifest matched their current SHA-256 hashes. Subsequent release edits update version metadata, release documentation and packaging inclusion only; no application runtime body was changed after the scan.

**v2.1.6 Chrome/Tampermonkey acceptance remains passed and closed.** No new real-browser v2.1.7 result is claimed by this release; any later browser regression record applies to the new release difference.

## Publication contract

The GitHub Release contains only `BiliCDN_TW.user.js`. Changelog, test report, build manifest and checksums stay in the repository under `Release/v2.1.7/`; prior release directories and unrelated user documentation remain preserved.

Publication readback confirmed v2.1.7 as the latest non-draft/non-prerelease, exactly one uploaded userscript asset, the remote tag matching the release commit, and asset size/SHA-256 matching the verified package above. Current repository documentation can subsequently receive maintenance edits without rewriting the packaged release report.

## First post-release archive verification — 2026-10-03

Historical documents and completed local tools/evidence were moved into `archive/retired/`; current source, tests, tool scripts, configuration, attribution baseline and all Release snapshots retain their locations. Before link adjustments, all 604 relocated files matched their pre-move SHA-256. Subsequent checks confirmed all 592 relocated local files and 327 protected files remain byte-identical. The 11 relocated Markdown files changed relative link targets only; the acceptance screenshot is unchanged. The selective Git ignore rules expose curated archival documentation while retaining private artifacts and the relocation manifest as ignored local data.

All 128 local links/anchors across 25 public Markdown files passed. `npm run verify` passed typecheck, architecture, 626 functional assertions, 18 architecture assertions, 40 non-entry import-purity checks, deterministic build, syntax and temporary packaging/checksums. The initial sandboxed attempt failed because esbuild could not read an ancestor directory; the same command passed with appropriate permissions and no tool/runtime edits. `git diff --check` passed. This is an automated layout regression record, not a new security scan or Chrome/Tampermonkey acceptance. The published v2.1.7 userscript and immutable packaged reports are unchanged.

## Root-document consolidation verification — 2026-10-03

Five active documents were consolidated under `docs/`, and the upstream checksum list moved to `baseline/SHA256SUMS.txt` without changing its contents. Root Markdown files are now README, AGENTS and SECURITY. Packaging retains its versioned output names and reads changelog/report from their new locations. The archive index's accidentally concatenated duplicate project-context block was removed; the authoritative project context remains in `docs/PROJECT_CONTEXT.md`.

All 129 local links/anchors across 25 public Markdown files passed. Baseline checksum validation and `git diff --check` passed. `npm run verify` completed with the same 626 functional/18 architecture assertions and 40-module import-purity coverage, plus deterministic build, syntax and temporary packaging/checksum validation. All source, tests, released artifacts and archived raw evidence remain unchanged; the packaging script changes only its two document input paths. The rebuilt userscript SHA-256 remains the published hash recorded above. No new security scan or real-browser acceptance is claimed.

---

# Historical modularization verification — before release

> This is the 2026-10-02 pre-release record. Its then-current v2.1.6 metadata and unpublished status were superseded by the v2.1.7 publication section above; the original evidence is retained.

## Scope and completed stages

Verified on 2026-10-02 against baseline `307f9a6f38b5a559e05e32c50c5b3f8ca1636257`. This working-tree refactor completes the four-stage modularization plan. The configured version remains **v2.1.6**; no release was published and existing `Release/` artifacts were not changed. Pre-existing `PROJECT_CONTEXT.md` and CDN/Chrome documents were preserved.

1. Split the original test program into independent suites, made domain URL resolution accept an explicit base URL, and replaced import-pattern checks with TypeScript AST dependency/ownership rules and import-purity tests.
2. Added navigation, scheduler and play-intent ports; centralized application settings/reset/fallback orchestration and typed UI commands; moved measurement metadata into its own state store and playurl registration/epoch handling into an application controller.
3. Extracted pure route eligibility/output planning, independent Fetch/XHR hooks with a shared send-time policy context, and the shared bounded Range probe adapter. Route affinity, active probe initiation and player reload remain owned by their respective controllers; retained signed URLs remain in `SignedRouteVault`.
4. Added explicit readonly snapshots and minimum controller interfaces, removed dependency-bypassing `as never` casts, and verified isolated suite state and resource cleanup. Settings schema/defaults, Catalog hosts, UI capabilities and diagnostic field meanings are preserved.

## Contract reproduction and automated results

Failure-first contracts reproduced browser-global-dependent domain classification, a disposed lifecycle applying queued page data, already-aborted/mid-read-aborted probe behavior, and a stale startup waiter writing measurement metadata after reset. The corresponding runtime fixes pass. The original **556 assertions** remain covered in seven extracted behavioral suites; four new suites add **70 assertions**, for **626 functional assertions** total.

| Verification | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run architecture` | Passed: 41 runtime modules, AST layer/ownership rules and no cycles |
| `npm test` | Passed: 626 functional assertions, 18 architecture assertions and import-purity checks for all 40 non-entry modules |
| `npm run verify` | Passed: all preceding gates, deterministic double build, JavaScript syntax, v2-only bundle and package/checksum validation |
| `git diff --check` | Passed |

Every suite runs in a separate process and restores its owned globals, hooks, subscriptions and timers in `finally`. Regression coverage includes Catalog-only/Native/comparison/disabled modes, settings synchronization, SPA/trusted promotion, generation and setting races, video/audio isolation, Catalog 403, Fetch single-reader/cancellation/Request normalization, and XHR text/json/reuse/timeout/abort/send-time checks. Verification packages into a temporary `dist/verify-package-*` directory and checks cleanup containment, so running `verify` does not overwrite a published release. Explicit `npm run package` retains its release-writing behavior.

## Final security diff scan

Codex Security scan `650fe466-dc70-4427-be60-b8da85b84e0b` completed and sealed the immutable final source diff. The review covered **53 of 53 changed source/config/test items with zero reportable findings**: 28 runtime paths and 25 build/test paths, with supporting authority, restriction, generation, privacy and baseline-extraction tracing. No source changes followed the scan; this verification record was added afterward.

**Canonical coverage-record limitation:** after the final draft was successfully submitted with `completeness: complete` and an empty deferred list, the sealed readback still reports `completeness: partial` and retains the earlier `scripts-tests-review` deferred entry. The same sealed document contains the completed 25-file review surface marked `no_issue_found`, and the workbench reports 53/53 reviews closed. The independent script/test reviewer completed all 25 paths and returned no candidates. This is a discrepancy in the saved coverage record, not an unperformed review; a canonical zero-deferred result is therefore **not claimed**. The supported tool does not permit modifying sealed scans, so the immutable artifacts were preserved and this limitation is recorded explicitly.

Canonical local report: `C:\Users\qwe15\.codex\state\plugins\codex-security\scans\BiliCDN_TW_Codex_Handoff\307f9a6f38b5a559e05e32c50c5b3f8ca1636257_20261002T150214Z_yekz7bna\report.md`.

The scan tool reported **12,472,914 total tokens**, including **11,789,824 cached input tokens**, across four threads (`codex_rollout` accounting). This is the tool's measured accounting, not a billing estimate. Static source review and automated contracts do not establish actual Chrome Network destinations.

## Browser acceptance and delivery

**The user's v2.1.6 Chrome/Tampermonkey acceptance remains passed and closed.** This unreleased refactor has no new browser-acceptance claim and does not reopen the accepted work. If a later release is requested, browser regression evidence should cover that new diff separately. This delivery consists of reviewable working-tree changes and verification records; versioning and publication remain separately arranged.

---

# Historical v2.1.6 test report

## Scope

Predecessor: v2.1.5. This update adds a persisted, default-off option to consider Bilibili-provided Native sources in normal routing. With the option off, script-transformed playurl output and intercepted media dispatch use only safely generated built-in Catalog routes, or block before dispatch if none is legal. The per-tab original comparison mode remains an explicit exception; disabling the script still passes website requests through.

## Contract tests and local verification

On 2026-09-29, `npm run typecheck`, `npm run architecture`, `npm test` (**556 assertions**) and `npm run verify` passed. Verify includes deterministic double build, JavaScript syntax, a v2-only bundle check and package checksum validation; it does not run a security scan. Targeted contracts reproduced concrete failures before their fixes, and the full suite verifies completed behavior. It covers schema-2 defaults, save/sync/reset including a future timestamp across tabs and a delayed settings lock; Catalog-only video/audio choices, output, startup probes, 403 and recovery; preserved backup path/query and same-Host Catalog provenance; opaque, unreplaceable, oversized and non-GET blocking; known PCDN suffixes; Fetch/XHR final destination and redirect observations; page playinfo synchronous handoff, existing values, dynamic getters and unsupported formats; nested Dolby/FLAC audio; mode changes, old player backups including exhausted provenance indexes, SPA generation, in-flight Fetch while disabling the script, XHR partial and stale playurl responses, async results and reused playurl objects across epochs. Native-enabled and per-tab original comparison behavior remain covered separately.

## Security review

Interim Codex Security working-tree diff scan `d3b45965-0037-41aa-b2b9-283d13552e84` identified three low-severity snapshot issues: stale XHR playurl data after SPA, non-monotonic cross-tab reset, and old-object/new-epoch identity reuse. Contracts reproduced them and the source was repaired. A later pre-fix scan `fd6494c2-0a4b-49e4-be68-be8793bbfe44` found that bounded output indexes could omit an emitted external Native backup; a red cap-exhaustion contract led to pruning any output the strict hook could not later recognize. The final post-fix Codex Security diff scan `8e87267d-ecf7-40c8-990b-b9c19ec0b411` covered all 17 changed review items with **zero reportable findings and zero deferred items**. This is source-level review, not real Chrome Network acceptance or proof that browser-owned redirects and unhooked requests use Catalog.

## Chrome/Tampermonkey acceptance

**User approved on 2026-10-01: acceptance passed and is closed.** The user explicitly confirmed that acceptance must not be counted as unfinished work. The coverage limits below remain factual records and do not create pending acceptance, retesting or investigation tasks.

Real Chrome/Tampermonkey acceptance was performed on 2026-09-30 and continued in new user-authorized Chrome tabs on 2026-10-01 (Asia/Taipei), with installed v2.1.6 confirmed. Observed cases cover Catalog-only output/traffic, Native on-to-off synchronization, seek, 720P/2x playback, SPA, fresh fixed Catalog, per-tab original comparison and its exit on reload, whole-script disable/re-enable, settings reset/synchronization, and no-legal-Catalog dispatch blocks with a displayed reason. Two complete fresh-document blocking traces contained zero media requests; an earlier reload interval contained two Native cosov requests whose attribution was not preserved, so that interval remains **unexplained**. Browser coverage did not establish dedicated Fetch/non-GET/opaque cases, active probes, 403/redirect/fallback/core recovery or background/resume; these are recorded coverage limits of the approved acceptance. Chrome reported full version 154.0.8037.58; the tool blocked access to Tampermonkey's version page. Settings were restored to the initial defaults, and one paused test tab was left open. See [archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md](CHROME_v2.1.6_ACCEPTANCE.md) for exact counts, limits and the final screenshot. No signed media URLs or HAR exports were retained. This later browser record does not replace the immutable test report packaged with the release.

---

# Historical v2.1.5 test report

## Baseline and scope

Predecessor: published v2.1.4 commit `09f04e82ffaac5276ed220f89d742cbe03ce0ec5`. This update changes fallback attribution and diagnostics only. It does not add Catalog hosts, change route selection or switching timing, increase probe cost, or change the player-core reload threshold.

## Contract reproduction and verification

New contracts were written before their corresponding runtime changes. A fake-clock incident replay covers brief progress inside the old buffer, 11 zero-byte aborts, a separate timeout, a second fallback with matching video `206`, and two progressing player ticks beyond the buffer boundary. The first fallback never claims takeover. Counterexamples cover wrong host or decision, stale epoch or authority, audio, redirect or changed response URL, HTTP `200`, empty `206`, pause, seek, disabled/comparison mode and lifecycle change. Additional cases verify speed-demand labels, report privacy and 96 KiB export under oversized evidence. A red contract also exposed that oversized report pruning attempted to mutate a frozen snapshot; the repaired path is covered.

Final verification on 2026-09-26: `npm run typecheck`, `npm run architecture`, `npm test` (**349 assertions**) and `npm run verify` all passed. Verify includes deterministic double build, syntax, v2-only bundle and package checksum validation. The Codex Security diff scan is separate from `verify`.

## Security review

Final source and test working-tree diff scan `73db4cdb-1f96-4ec4-930a-e4b3b2b5f844` covered all eight changed TypeScript files and completed with **zero reportable security findings**. It checked route identity, transport response URL metadata, diagnostic privacy and bounded output. This static result does not establish browser playback or the absence of every fault.

## Chrome/Tampermonkey acceptance

Post-release acceptance on 2026-09-26 (Asia/Taipei) used a new public Bilibili video tab in Chrome with Tampermonkey. The script's diagnostic report displayed `current.version: "2.1.5"`, confirming that the updated userscript was running. The player showed 1080P high bitrate, AV1 and the user's existing 2x speed. From 01:38:12 to 01:41:26 local time, the same video played continuously for 3 minutes 13 seconds: sampled playback position advanced from 664.9 to 1051.4 seconds, `paused` remained false, and `readyState` remained 4. No black screen was observed at the sampled checks. Chrome Network showed media XHR `206` responses from `upos-hz-mirrorakam.akamaized.net`; the captured Network events do not establish a complete video/audio request inventory or redirect history.

After that video ended, Bilibili automatically opened the next video. In the new video, pause succeeded, a seek moved playback from about 1213 to 261 seconds, playback resumed with `readyState` 4, and a second pause succeeded. The diagnostic report was opened to verify the version before the timed playback; it was not re-inspected after the pause and seek. Chrome and Tampermonkey version numbers were not captured. The user's 2026-09-26 approval formally accepts the observed v2.1.5 normal-playback validation. The transport fault did not recur, so actual black-screen fallback recovery remains **contract-tested, real-browser pending**; no real fallback takeover is claimed.

---

# Historical v2.1.4 test report

## Baseline and scope

Immutable predecessor: v2.1.3 commit `6322c06`. This release addresses three findings from Codex Security scan `cf49b015-ecb4-48d8-91f9-2b61adb709f4`: a Fetch checked/sent destination mismatch, lower-trust Native route contamination, and active probe redirects. It also closes the same Fetch boundary after startup waiting and clears provisional route invalidation when trusted playurl takes authority. CDN ranking, playback speed, Codec selection and measurement budgets are unchanged.

## Automated reproduction and verification

New contract cases first reproduced a provisional invalid-host flag suppressing a newly trusted exact URL, a mutable Fetch URL and method being sent after an SPA generation change, and a prohibited original host being sent from the same stale-generation branch. Each failed before its corresponding runtime fix. The completed suite passes **311** domain/controller/adapter assertions. Existing and new cases cover forged `Request.href`, string/URL/Request input, GET/POST and `init.method`, streaming body, abort and single-reader behavior, hint/API ordering and handle revocation, stale plans/probe results, direct 206 Range acceptance and same-/cross-host redirect rejection.

`npm run typecheck`, `npm run architecture`, `npm test` and `npm run verify` passed on 2026-09-24. Architecture check covered 28 TypeScript modules with no import cycle. Verify includes deterministic double build, syntax, v2-only bundle checks, package equality and SHA-256. It does **not** include Codex Security.

## Security verification

An interim v2.1.4 working-tree diff scan (`724a180d-130a-43a1-9247-5f62d5447a02`) found the startup-wait/SPA branch still dispatched the original mutable Fetch input. That finding was reproduced by a failing contract test and fixed; no release was made from that snapshot. The final Codex Security diff scan (`dc9c0242-05a9-46cf-bc69-feb8136055ab`) reviewed 11 changed source/config/test/release items and completed with **zero reportable findings**. This is a static diff-scan result, not a Chrome Network result.

The three findings from the original scan were checked individually against the current source and passing contracts:

- `csf_593a2c7f450a4906aaf271ca` — **fixed**: enabled Fetch constructs one platform `Request`, reads its URL/method/signal and sends that Request or a rewrite built from it; forged `href`, method override, mutable input after preflight, HTTPDNS and forbidden media cases pass.
- `csf_39f7c70dad56927d52424c3e` — **fixed**: trusted API promotion revokes provisional Native handles, plans, invalid state and authority; later hints and old async results cannot reinstate candidates or update health. Hint/API ordering, cross-key exact URL and stale-result cases pass.
- `csf_f11ae85718c76268b449316e` — **fixed**: startup and healthy probes set `redirect: 'error'`; only a direct, same-host HTTPS `206` response can create a valid sample. Redirect, mismatched-host and absent-response-URL cases pass; failed active probes do not create a playback circuit.

These verdicts establish source-level remediation and preserved ordinary Request/Catalog/probe behavior. Whether Bilibili's real Chrome media entry points follow the tested hooks remains part of post-update acceptance.

## Chrome/Tampermonkey

No current-version Chrome acceptance is claimed. Following the user's requested order, publish first, then the user updates Tampermonkey, then use an extra Chrome tab to compare actual media request URLs, response hosts and redirects with the script's bounded diagnostics. Source-level contract tests cannot prove that every browser media entry point is intercepted.

---

# Historical v2.1.3 test report

## Scope

Only user-facing wording in the control center and player setting panel changed. Internal route, transport, measurement and recovery state machines, the CDN roster, settings values and the machine-readable diagnostic report remain unchanged. The v2.1.2 release artifact is not overwritten.

## Automated verification

On 2026-09-24, `npm run verify` passed: TypeScript typecheck, architecture boundaries, all 264 domain/controller/adapter assertions, deterministic double build, JavaScript syntax, v2-only bundle checks, package equality and SHA-256 validation. The test runner's first sandboxed invocation could not resolve its temporary esbuild entry because Windows denied access to the temporary directory; rerunning the same command with the permitted environment passed all 264 assertions. This was a test-environment failure, not a functional assertion failure.

## Chrome/Tampermonkey

The new wording cannot be inspected in the user's installed Tampermonkey script until v2.1.3 is published and installed. Chrome UI inspection is therefore pending after update; no playback or CDN behavior is claimed to have been verified by this copy-only change. No Code Security scan was run.

---

# Historical v2.1.2 test report

## Baseline and scope

Immutable predecessor: v2.1.1 commit `305244d57119799b94b5971aabc37c1df991a757`; packaged userscript SHA-256 `20414a4e33cc124db7a0b52c60dcfcc104e69de4ad6ecf1cea5a2051421f08f7`.

This release adds host-level playurl-to-segment lineage, stream-specific Catalog incompatibility, fallback after-state correlation and a per-tab original signed-URL comparison mode. It does not change the CDN roster, scoring formula, player speed, Codec preference or measurement budget. No Code Security scan was run.

## Automated reproduction and verification

The added contracts first failed for four concrete gaps: an original backup promoted after a prohibited primary still had the blocked primary's plan; a same-host unrelated decision could impersonate fallback after-state; a later no-alternative recovery left an older fallback looking current; and an exact signed URL with an unrecognized path lost its playurl output lineage. After repair, the suite passes 264 domain/controller/adapter assertions. It also checks actual native Fetch/XHR dispatch, strict prohibited-host handling, Catalog 403 avoidance in later ranking, probe-result isolation, fallback plan versus later request/response, and original mode without preflight or automatic recovery.

Passed on 2026-09-24: `npm run typecheck`, `npm run architecture` (28 TypeScript modules, no import cycles), and `npm test` (264 assertions). `npm run verify` additionally checks deterministic double build, JavaScript syntax, v2 bundle invariants, package equality and SHA-256. The packaged SHA-256 list is the authority for the release artifact.

## Chrome/Tampermonkey evidence and pending acceptance

An additional Chrome test tab on the previously installed script produced actual Network `206` media responses from `upos-sz-mirroraliov.bilivideo.com` and `upos-hz-mirrorakam.akamaized.net` during playback/seek. The event buffer was truncated, so this does **not** prove complete first-request interception, fallback, or v2.1.2 behavior. A later computer-use attempt stopped because the Windows browser URL could not be determined confidently; no further browser action was taken. Only hosts/status were retained, not signed URLs, paths or queries.

Per the user-requested order, formal v2.1.2 Chrome Network acceptance follows push, Release and the user's Tampermonkey update. In an extra tab, compare a newly delivered playurl host and a later segment's actual Chrome Request URL, script RequestId/DecisionId, response host and status; then check a real legal fallback's subsequent request and the per-tab original comparison mode. If no real fallback occurs naturally, report that case as unverified in Chrome rather than fabricate a failure. Browser redirects or non-Fetch/XHR entry points remain a known boundary.

---

# Historical v2.1.1 test report

## Baseline and observed browser evidence

Immutable predecessor: v2.1.0 commit `f62cb5e18974b58e6d9b3d3741beeb4e52c8bb86`; packaged userscript SHA-256 `2403f7021c98b7b4f4b2303a05c5b85bd58c4c677c73ec0db8b3a2124e962137`.

Before the code change, an additional Chrome/Tampermonkey video tab showed the BiliCDN v2 player-panel entry and actual Network media XHR traffic. After a reload, the retained Network events included seven GET media requests to `upos-sz-mirroraliov.bilivideo.com` and `upos-hz-mirrorakam.akamaized.net`, each with a 206 response at the same host. The earliest Network events were evicted (`truncated=true`), so this capture does not establish the first-request/preflight timing. A subsequent seek capture was not truncated: eight GET/XHR requests to those two hosts received 206 responses. All eight URLs had a media suffix and `/upgcxcode/`, so they do **not** reproduce the missing-suffix case. Network alone did not establish video versus audio for each request, and no natural fallback occurred. No HAR, signed URL, path, query or token was saved to the repository or report. This is a limited v2.1.0 baseline, not post-update v2.1.1 acceptance.

## Reproductions and automated verification

New tests first failed on a current-epoch, suffix-less exact signed URL being rejected by the Vault, and on non-GET requests to a prohibited media host reaching the native transport. The repaired suite has 231 passing assertions. New contracts cover exact opaque observation without Native selection or probe, strict host blocking on opaque and non-GET Fetch/XHR, legal exact opaque backups in playurl output, Fetch `Request` dispatch to the chosen host, explicit XHR timeout labeling, partial hook-install rollback, and distinct hook/recognition/native-call/response diagnostic stages. Existing tests cover GET replacement, XHR revalidation at `send()`, abort, reuse, Fetch cancellation and one-reader behavior.

Passed on 2026-09-23: `npm run typecheck`, `npm run architecture`, `npm test` (231 assertions) and `npm run verify`. The verifier completed deterministic double build, JavaScript syntax, v2-only bundle checks, package equality and SHA-256 validation. The packaged SHA list is authoritative. No Code Security scan was run.

## Chrome/Tampermonkey acceptance after update

Publication precedes formal Chrome acceptance per user instruction. After installing v2.1.1, use an extra test tab to compare each script-observed RequestId/DecisionId, method, media kind, original/target/response hosts and status with Chrome Network. During the measured interval, newly dispatched media requests to a prohibited host must be zero; a claimed host rewrite must match the browser's actual Request URL. Repeat first play, seek and a real fallback. If a request remains unmatched, retain only a sanitized initiator classification and continue investigating. Source-level passing tests do not prove coverage of Worker-initiated traffic or browser redirects.

---

# Historical v2.1.0 test report

## Automated scope

Baseline: published v2.0.4 commit `363d527136c876a162d06c78d77e8663ce2a62cc`. New tests first reproduced first-Catalog cold selection, unattributed first-request rewrite, abort-triggered probing, missing no-failure startup rescue and missing bounded deadline; runtime was then changed.

The source-level suite has 206 passing assertions. New contracts cover legal original pass-through before preflight, exact signed backup versus synthesized Catalog URL, measured Catalog victory, low-confidence original fallback, a shared three-second deadline with hanging probes, previously aborted requests starting no probe, current-stream 16 KiB Catalog compatibility, stream-scoped Catalog 403 exclusion, strict blacklist admission, actual Fetch/XHR native dispatch after the gate, XHR abort and explicit-timeout semantics, sequential fair challengers, 15-second no-progress fallback and a single first-start core reload. Existing restriction, Native group isolation, host-lock, disabled, Fetch single-reader/cancel, XHR and incident tests remain included.

Verification commands and reproducible build/checksums are recorded by `npm run verify` and the packaged build manifest. This report does not equate source-level fake transport/player contracts with real Chrome playback. No Code Security scan was run.

## Real Chrome / Tampermonkey

Pending publication and user update, per the requested order. In an additional test tab, compare the first browser media request's true dispatch time and target/response hosts with the preflight's three-second window and result; then check automatic quality, seek, SPA, background return, 2x as a user selection and no healthy-probe-induced switch. A naturally occurring 6006 or dead core is not claimed to have been reproduced in Chrome.

Unsupported entries—including synchronous XHR, XHR with an explicit finite timeout, unknown/unmatched media, Worker-initiated media and URL shapes that cannot be safely rewritten—are not held by preflight; diagnosis must mark them as such. A probe predicts only the sampled URL and interval, not later CDN availability.

---

# Historical v2.0.4 test report

## Current release

Immutable predecessor: v2.0.3 commit `28b1cf57a3c3eaeafc30c282f9f5ec67a8406c0a`, userscript SHA-256 `667476a1a8b04c75437410c35ac15b5d52f568682d7d3934f55e22650507a19d`.

Before changing runtime logic, the new source-level test failed because a default-unavailable Catalog media URL with `os=mcdn` passed unchanged. A separate no-file controller reproduction showed that an audio-blacklisted host remained eligible for ungrouped media. The previous control-center button stored user blacklists as video-only; a regression reproducing an existing stored row failed for audio before the compatibility fix.

The functional suite now has 166 passing assertions. New contracts cover default-unavailable PCDN/live/resource pass-through, unrestricted live preservation, blocked playurl primary/backup, user-wide black against matched audio, ungrouped audio-black eligibility, black/dead special-media rejection, native Fetch/XHR refusal and enable-between-XHR-open/send revalidation. Existing video/audio recovery, Native exact URL, host-lock, disabled mode, cancellation and single-reader tests remain included.

Automated verification passed on 2026-09-22: `npm run typecheck`, `npm run architecture`, `npm test` (166 assertions) and `npm run verify` (deterministic double build, JavaScript syntax, v2 bundle invariants, package equality and checksums). No Code Security scan.

Real Chrome/Tampermonkey v2.0.4 acceptance: pending publication and user update. No current-version playback or absence of black-screen regression is claimed. A userscript cannot retroactively prevent a browser redirect or intercept media initiated outside its playurl and page Fetch/XHR paths; if Bilibili issues those requests, browser network initiator evidence is needed to evaluate coverage.

---

# Historical v2.0.3 test report

## Current release

Immutable predecessor: v2.0.2 commit `7739d5ada141d4d35192dc6ae06693ace25f7d13`, script SHA-256 `d36b1271af5107b14c3820d7afc55ea56ba0ec0f307643b2b1c2471792745ea8`.

The installed v2.0.2 report showed repeated zero-byte Catalog aborts followed by successful Akamai fallbacks in multiple groups. This does not establish why the browser aborted. The same report had playing media but stale pause-armed recovery state.

Before changing runtime logic, separate source-level contracts failed for (1) a new quality retaining its cold Catalog plan after observed Native affinity, and (2) healthy short resume retaining pause-armed. Both now pass.

The suite has 148 passing assertions. Additional checks cover different-quality exact Native URL, no fabricated observed affinity, missing Native capability, explicit fixed mode, and a newly blacklisted affinity host. Existing v2.0.2 restriction, backup, responseHost, incident, playback-rate and cancellation tests remain included.

Passed on 2026-09-21: `npm run verify` completed types, architecture, all 148 assertions, deterministic double build, syntax, package equality and checksums. No Code Security or independent security suite.

Chrome/Tampermonkey acceptance of v2.0.3 is pending user installation. The supplied v2.0.2 report is user runtime evidence, not a v2.0.3 real-browser test. No natural dead-core reproduction is required for publication. Historical black-screen causes remain unconfirmed. See `archive/retired/docs/POST_RELEASE_v2.0.2.md` for the evidence trail.

Deliverables: `Release/v2.0.3/` script, changelog, report, manifest, SHA-256; GitHub Release attaches only the script. No previous release directory is overwritten.

---

# Historical v2.0.2 verification (unchanged scope)

## Baseline and evidence

Immutable baseline: v2.0.1 commit `66f7c36dd3605933342ec0536892753f5bfe8cca`, userscript SHA-256 `ec2be1e39cea70ddfb04241b26b23b7f787d63896bea100bcb5e12cc8d3ef279`.

The submitted report establishes an uninitialized video core and no reload, not a proven connection to prohibited cosov. Recorded successful video was rewritten to mirrorali; the last video terminal was an abort. The root cause of the historical black screen remains unconfirmed.

## Reproductions and functional verification

Before runtime fixes, new assertions reproduced: empty response URL inventing a host, prohibited original retained in playurl backups, a player backup rewritten to primary, paused dead core failing to create an incident, and a challenger selecting default-unavailable cosov.

The complete source-level functional suite now has 140 passing assertions, including:

- Existing evidence/ranking, limits, cancellation, XHR JSON, disabled behavior, rate preservation, core restore and safe measurement contracts.
- Default-unavailable output removal; independent black/dead cases against cached fallback, fixed CDN and playurl output.
- Native XHR open target; restriction added between open and send; single native send; no-alternative XHR/Fetch local blocking; disabled original pass-through.
- Permitted Catalog backup adoption and subsequent group affinity plan; weak query match cannot claim backup role.
- Exact Native audio backup, video-affinity isolation, invalid Native exclusion on request/output and generation cleanup.
- Host-lock cannot restore a dead root; no-alternative player output contains neither prohibited primary nor backups.
- Missing response URL stays null; target-host network failure still opens the appropriate circuit; latest abort does not erase last successful video observation.
- Sustained dead paused core captures evidence without reload; timer gaps and initial startup do not falsely count as continuous prior-healthy death.
- First paused-tick play observer, original return preservation, untrusted calls rejected, trusted long-pause intent while paused, one reload, reset restores owned method.
- Late manual mark and 1,000 subsequent successes preserve the frozen core incident; 128 KiB recorder and 96 KiB report checks.

These are source-level fake-player/transport contracts, not real Chrome playback. Passing assertions are not claimed to exhaust all browser-specific URL or player lifecycle variants.

## Release verification

Passed on 2026-09-21: `npm run verify` completed all 140 assertions, strict types, architecture, deterministic build, syntax, bundle/package and checksum checks with Node 26.8.1, TypeScript 7.0.2 and esbuild 0.28.2.

Run `npm run verify` for strict TypeScript, architecture/cycles, all functional assertions, deterministic double build, JavaScript syntax, bundle invariants, package equality and SHA-256. The release checksum list is authoritative. No Code Security scan or independent security suite is run.

## Real Chrome / Tampermonkey: pending after installation

Per user instruction, publish first, then perform targeted acceptance after the user updates. No preserved failed/paused tab was operated during this code repair. No v2.0.2 Chrome pass is claimed here.

Use an additional tab: compare native outbound/response hosts with the report; check legal backup behavior, prohibited-host absence, fixed/automatic mode, user-selected speed, one seek/quality/SPA/background-return sequence, and incident marking. Natural dead-core reproduction is not a publication gate. Do not infer consumed media or a black-screen cause solely from a route plan or host label.

## Deliverables

`Release/v2.0.2/`: userscript, CHANGELOG, TEST_REPORT, manifest and SHA-256 list. GitHub Release attaches only `BiliCDN_TW.user.js`. Existing v2 storage is preserved; no history patches, CI, remote code or telemetry are added.


<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.11 發行驗證 — 2026-10-10

以 `c836a17818cd4ae86195e41b1e1c0933cff8cab0` 為基準，納入 BR-03 內容識別修復。使用者已授權直接提交、升版、推送與發布，並要求將此預設交付規則保存於 [AGENTS](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/AGENTS.md#release-rules)。本報告是 **v2.1.11 現行發布報告**；已於 2026-10-10 01:52（Asia/Taipei）正式發布，01:53 公開 latest 下載讀回一致。修復前後對照見 [BR-03 報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)，目前待驗收範圍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 修復與相容性

可信 playurl 的所屬請求 cid 優先識別內容；同 cid 的排列、畫質或編碼清單完全換組均保留 epoch，不同 cid 即使共用路徑也重設。缺少 cid 時以有界完整父目錄集合備援，影片 128／音訊 64，忽略主機、查詢與順序，重疊保留歷史。低信任提示不能更新基準，Fetch／XHR metadata 保持請求 context 所有權，真正換片仍同步撤銷舊工作。

沒有有效 cid 也沒有共同路徑時採保守重設。不新增 API 逆序回應政策、公開橋接、持久鍵或 schema；schema 2、Vault 唯一授權、MP4／FLV 簽名刷新、嚴格影音隔離、Fetch 單讀取器及 Worker 不介入保持原契約。

## 自動發行驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。在 2.1.11 版本設定重新執行必要命令；執行結果與封裝校驗存入本機 `.work/release-v2.1.11/`。

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | 來源／測試通過 |
| `npm run architecture` | 44 個執行期模組、無循環 |
| `npm test` | 19 套件、382 個具名案例通過；新增 43 個 BR-03，沒有 only／skip／todo／cancelled |
| `npm run verify` | 型別、架構、382 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 與暫存封裝校驗通過 |

修復前的原四契約 2 通過／2 失敗與擴充紅燈紀錄保留在修復證據目錄，不混算通過；正式測試不匯入調查目錄。文件連結／錨點、受審雜湊、歷史產物與 `git diff --check` 另行核對。

## 獨立安全差異審查

BR-03 Codex Security 掃描 `a9c3fb49-d46b-4a8e-81ee-29856ab3e908` 已於 2026-10-10 01:09:35（Asia/Taipei）封存。完整覆蓋 14 個變更來源／測試檔，0 個可報告發現、0 個待驗證候選。快照 digest：`codex-security-snapshot/v1:sha256:31543372cedbba943e0f4de533b3d34d68790794e4c471de11ee123284685033`。

此次發行只變更版本設定、metadata 版本與交付文件；受審 14 檔保持 SHA-256 一致，其他執行期邏輯未再修改，因此沿用該已完成差異審查，沒有宣稱重新掃描。安全封存產物不回寫；這不是全儲存庫安全保證。

## 封裝與更新

正式產物為 `Release/v2.1.11/BiliCDN_TW.user.js`，**296,341 bytes**，SHA-256 為 `9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`。GitHub Release 僅上傳此腳本；CHANGELOG、TEST_REPORT、BUILD_MANIFEST、SHA256SUMS 留在儲存庫。更新 URL 維持 [最新使用者腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，發布後核對版本、大小與 SHA-256。舊 Release 與原始調查文件保持雜湊一致。

## 發布確認

2026-10-10 01:52（Asia/Taipei）完成 [v2.1.11 正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.11)。修復提交 `d3d1bc3185d51b62891920135b4126441e059696` 與 annotated tag 已推送，標籤指向該提交；唯一附件為 BiliCDN_TW.user.js。01:53 無登入的公開 latest API 與下載 URL 讀回確認版本 2.1.11、296,341 bytes 及上述 SHA-256 一致，現有 Tampermonkey 更新網址已提供新版；不宣稱使用者裝置已自動安裝。

發布前檢查 18 份 Markdown、319 個本機／儲存庫連結與 91 個錨點，0 錯誤；82 個來源／測試檔與 14 個受審檔雜湊一致，262 個歷史 Release 檔及兩份原始調查文件不變。上一版完整報告已保存。封裝的報告與 CHANGELOG 是發布前準備快照；此後只更新現行文件，Release 快照不回寫。

## Chrome／Tampermonkey

**2026-10-10 03:02–03:36 新目標續測追加：調查交付完成，整體產品驗收尚未全通過。** 正常原生 4K／8K seek 約 2.393／2.398 秒，長暫停與畫質分步操作正常；受控 27.829 秒長 seek 及安裝版 Monitor 90 秒時鐘對照定位到持續 seeking 抑制救援，原始網路起因未證實。42 個新增受控恢復／R04／鎖／生命週期案例通過，真 gate 邊界與真正 SDK 核心替換另有實測；真正 background 未取得 hidden 前提，SDK 自然拒絕等不冒稱通過。新增 BR-05 取消原因遺失在 Chrome／安裝版確認，獨立 Node 為 3 control pass／4 contract fail、exit 1，**不是正式套件通過結果**。完整分層證據與限制見 [剩餘驗收報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_REMAINING_ACCEPTANCE.md) 與 [BR-05](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md)。BR-04／05 未修復；來源、正式套件及 Release 未改，本輪不新增完整 verify 或安全掃描結果。下文保留之前各輪的時間點。

**2026-10-10 02:58 續測追加：BR-04 已由 Node 疑點升為真正 Chrome 155／v2.1.11 安裝版確認缺陷。** 真正 3 候選起播 gate 中，SyntaxError 正常對照完成一次；二次同步限制重入使原生 UNSENT、metadata sent、終止事件遺失，並產生未處理 InvalidStateError。完整事件及攔截窗口未截斷，已清理並達成找問題／詳細報告的替代完成條件；沒有修復或宣稱全面驗收。見 [BR-04 報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)。下方發行及中途暫停文字保留其時間點。

2026-10-10 修復輪的真正 Chrome 154 **來源隔離** BR-03 31／31、BR-02 對照 31／31 通過。成功輪合成請求於送出前攔截，事件未截斷、hooks restored；作廢輪與清理限制見 [BR-03 修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR03_FIX_REPORT.md)。本次發行不新增瀏覽器執行證據。

**2026-10-10 v2.1.11 Tampermonkey 安裝版部分驗收完成，依使用者要求暫停。** 實際產物一致；BR-03 31 個有效案例、BR-02 42 個原生對照通過，真正 startup gate 與 R04 取得部分證據，同片畫質及網站播放器入口 seek 正常。新增暫定 BR-04 在獨立 Node 契約重現，Chrome 複核尚未執行，不能算確認的 Chrome 缺陷或正式套件結果。完整證據、作廢輪與清理限制見 [中途報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.11_PROGRESS.md)。網站僅使用指定 [風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)；BR-01 原 87.8 秒停滯、完整 gate／恢復／R04 矩陣保持待定位／驗收，不宣稱整體通過。

## 歷史驗證導覽

<a name="br03-local-fix-verification--2026-10-10"></a>

- [BR-03 發行前本機完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#br03-local-fix-verification--2026-10-10)

<a name="bilicdn_tw-v2110-release-verification--2026-10-09"></a>

- [v2.1.10 完整發布／修復前驗收正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2110-release-verification--2026-10-09)

上一版完整正文已按日期移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，保留原始限制與錨點導引。現行行為見 [文件索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/INDEX.md)，歷史待完成不自動成為目前待辦。

<a name="bilicdn_tw-v219-release-verification--2026-10-09"></a>

- [v2.1.9 完整歷史驗證與當時瀏覽器狀態](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v219-release-verification--2026-10-09)

v2.1.8 的完整正文於 2026-10-09 移入歷史報告，保留原始數值、日期、發布及瀏覽器限制。舊錨點導引如下：

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 發行驗證 — 2026-10-04](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)

<a name="reproduction-and-implementation"></a>

- [v2.1.8 重現與實作](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#reproduction-and-implementation)

<a name="automated-verification"></a>

- [v2.1.8 自動驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#automated-verification)

<a name="separate-security-and-browser-evidence"></a>

- [v2.1.8 安全與瀏覽器證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#separate-security-and-browser-evidence)

<a name="publication-confirmation"></a>

- [v2.1.8 發布確認](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#publication-confirmation)

<a name="chrome--tampermonkey-observations-after-standard-update"></a>

- [v2.1.8 Chrome／Tampermonkey 觀察](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#chrome--tampermonkey-observations-after-standard-update)

更早十二個區塊於 2026-10-06 移入 [歷史驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)，正文保留原文與當時限制。原主要標題錨點保留為導引；歷史「待完成」不構成目前工作，現行工作見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。文件搬移與本次檢查另見 [文件維護歷史](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

<a name="published-bilicdn_tw-v217-test-report"></a>

- [v2.1.7 已發布驗證報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#published-bilicdn_tw-v217-test-report)

<a name="historical-modularization-verification--before-release"></a>

- [發行前模組化驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-modularization-verification--before-release)

<a name="historical-v216-test-report"></a>

- [v2.1.6 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v216-test-report)

<a name="historical-v215-test-report"></a>

- [v2.1.5 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v215-test-report)

<a name="historical-v214-test-report"></a>

- [v2.1.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v214-test-report)

<a name="historical-v213-test-report"></a>

- [v2.1.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v213-test-report)

<a name="historical-v212-test-report"></a>

- [v2.1.2 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v212-test-report)

<a name="historical-v211-test-report"></a>

- [v2.1.1 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v211-test-report)

<a name="historical-v210-test-report"></a>

- [v2.1.0 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v210-test-report)

<a name="historical-v204-test-report"></a>

- [v2.0.4 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v204-test-report)

<a name="historical-v203-test-report"></a>

- [v2.0.3 歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v203-test-report)

<a name="historical-v202-verification-unchanged-scope"></a>

- [v2.0.2 歷史驗證（當時範圍不變）](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#historical-v202-verification-unchanged-scope)


## 2026-10-10 換版保存：v2.1.13 完整正文與 BR-06 調查追加

以下原文保存換版前未提交驗收文件、版本、日期與限制；現行狀態見最新版報告。

<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.13 發行驗證 — 2026-10-10

基準 v2.1.12／c924b0216fe0a8f7a624f391d44b36660daca433。本輪修復 BR-01 A／B／C，Auto 是主要使用場景，不鎖畫質或修改 ABR。**修復與發布完成；實際新版部分安裝版驗收已有有效證據，完整矩陣未結案。** [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_FIX_REPORT.md) 分開記錄自動、來源隔離、安全及實際安裝版。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。先登記原三個缺陷與三個正常對照，未修來源為 3 pass／3 fail／退出碼 1，失敗紀錄獨立保存。最終完整 verify 通過：44 執行期模組、19 套件、474 正式案例（新增 22 控制器及 4 適配器）、43 非入口模組匯入純度、型別／架構、確定性建置、語法、v2-only 與暫存封裝 checksum；沒有 failed／only／skip／todo／cancelled。git diff --check 通過。證據位於 .work/functional-fixes/br01/2026-10-10-c924b02/。

## 獨立安全審查

Codex Security 6aa22069-fc37-4842-a30c-2727ece75b37 已封存：17 個變更來源／測試檔完整覆蓋，0 可報告發現、0 待驗證候選，封存時無快照漂移。Digest：codex-security-snapshot/v1:sha256:87e2a78798ea66c638e2e5f8bcd2c4a748469536bd2b046c39f482655c9b1911。7 個執行期來源保持受審 SHA-256；其後只有四個補充適配器契約、版本及文件修改，另由主代理核對，不屬於原安全快照。完整報告由插件管理，與 verify 分開。不是全儲存庫無漏洞保證。

## Chrome 來源隔離

22／22：1 倍／2 倍的 15／30／15 秒邊界、每段一次備援／重載、核心替換、無進度終止、正常短 seek 和清理，另有原生 Blob Fetch／XHR 對照。實際適配器／控制器搭配合成 DOM 狀態、記憶體儲存與 FakeClock，**不是實際經過 12／30 秒的網站延遲或 Tampermonkey 安裝版**。首輪失敗找出首次進度沒有釋放停滯段，已修正；作廢輪證據保留。隔離 iframe 已移除。

## 發布與安裝版

v2.1.13 於 2026-10-10T05:07:23Z／台北 13:07:23 [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.13)，來源／標籤提交 fc2b3b5ed58e307d8c87e2326769cfa8a390cf46，main／peeled tag 核對一致。唯一附件 BiliCDN_TW.user.js：314,188 bytes，SHA-256 646515874ea4088b11830907826c5d1275f823c155a5fb1523999a9755ffa816；無登入公開 latest API 與下載核對版本／大小／雜湊完成。Chrome 實際執行 body 完整包含該腳本，singleton 一個。發布後現行文件另追加讀回與驗收結果，Release 快照不覆寫。

新版 Auto 1／2 倍速、分開的 12 秒影片延遲已取得有效恢復證據，音訊通行且有效窗口無 Fetch／Network 事件截斷。1 倍尋位 16.772 秒，一次備援／零重載；2 倍尋位 34.395 秒，一次備援／一次核心重載，之後時間及影格恢復。65 秒影片持有輪由網站約第 24 秒提前暫停／外部核心替換，腳本撤銷且未持續重試；因此安裝版「重載後完整 15 秒無進度退出」仍待取得前提，不能用本輪或來源隔離代替。故障期間新操作、真正 hidden／晚到提交等完整矩陣亦未結案。受控 98 個 IDs 沒有記憶體／持久樣本，schema 2 保持；全部攔截／觀察器已清理。詳見 [安裝版證據及續行](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.13_ACCEPTANCE.md)。

## 剩餘限制

**2026-10-10 約 13:45–13:57 續測確認 BR-06，未修復。** 在同一指定風景片、實際 v2.1.13 Auto 1／2 倍，新可信 BODY 方向鍵 seek 只更新 seekRevision，userRevision 未增加；分別 8.205／6.986 秒便觸發備援。滑鼠故障對照取得新修訂及寬限，三個窗口無事件截斷；獨立正確契約 2 fail／3 pass、退出碼 1，型別檢查通過。既有正式 BR-01 application 22／22、adapter 4／4 重跑通過，未覆蓋此入口，不能把新失敗算入通過。62 個受控 IDs 無記憶體／持久樣本，自有攔截及觀察器已清理。已達成「找到問題並交付報告」的自主目標，完整安裝版驗收未通過；來源、正式測試、版本與 Release 不變，沒有新的安全或完整 verify 宣稱。詳見 [BR-06 根因與證據](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)。

原 87.785 秒自然網路起因未定位，其他完整產品驗收仍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。控制觀察不能認證頁面核心；自有 reload 等待中、未經可觀察 reload 方法的外部替換，不能完全辨識因果。沒有有效 cid 或共同路徑的同片仍保守重設。schema 2、持久鍵、公開設定、依賴及更新 URL 不變。

## 歷史驗證導覽

<a name="bilicdn_tw-v2112-release-verification--2026-10-10"></a>

- [v2.1.12 完整正文及 Auto 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2112-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

- [v2.1.11 原錨點](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2111-release-verification--2026-10-10)

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 原錨點](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)
