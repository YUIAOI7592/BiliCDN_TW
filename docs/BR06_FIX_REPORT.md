# BR-06 修復與驗證 — 2026-10-10

基準 v2.1.13／45a442071c93f20fa7aeb7dcecfb67c6ba66f526。原始 [BR-06 調查](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)、未提交 v2.1.13 驗收追加與既有 Release 保留。修復採同一 keydown 派送策略；Auto、15／30／15 秒、schema 2、選路授權與影音隔離不變。發布讀回與實際安裝版結果另列於 [最新版報告](TEST_REPORT.md)／[安裝驗收](CHROME_v2.1.14_ACCEPTANCE.md)。

## 修復與正式契約對照

| 需求 | 來源與契約 |
| --- | --- |
| BODY／播放器焦點有效按鍵取得一次 userRevision | PlayerAdapter 私有候選；application 匯入 functional-races/br06.ts 的原始兩缺陷、鍵盤／滑鼠／合成三對照 |
| 同派送確認，實際有限位置改變且 seeking | 捕捉可信 keydown；seek wrapper、媒體觀察、controls 及 window 冒泡確認；直接尋位、重複回呼、位置 0、停止傳播案例 |
| 排除不適用輸入 | 8 種 seek 鍵、Shift／repeat；6 類輸入目標、Ctrl／Meta／Alt／IME、忽略或不變目標、合成與腳本還原案例 |
| 派送結束與所有權 | eventPhase NONE 拒絕晚到；一筆候選、注入可取消 timeout 僅清理；hidden／lifecycle／media／player／reset、重入、延後 Promise 案例 |
| 方法相容 | Reflect.apply 保留 receiver、參數、結果與原例外；finally 觀察；既有 BR-01 wrapper／外部所有權清理對照保留 |
| 控制器時間與晚到提交 | 真正 Adapter／Monitor／Recovery；新 userRevision 重開 14,999／15,000、29,999／30,000、重載後 15,000；舊 reload／play 拒絕不能復活舊動作 |

執行期差異只有 `src-v2/adapters/player.ts` 及 `src-v2/entry.ts`。入口注入既有 Scheduler 與 VisibilityAdapter.isActuallyVisible；沒有應用層 DOM、跨模組設定、公開 API、持久欄位或新的 Native 授權索引。Monitor 仍只以新使用者修訂重開停滯，網站 seek／Auto 重綁保留舊期限。候選確認時清空腳本 pending seek 的舊觀察，避免其遮蔽新的 site seek。

## 修復前後與工具校準

原五契約先移入正式 application；未修改執行期來源時 **2 fail／3 pass，退出碼 1**，保存 `pre-fix-contracts.txt`。新增至 **40 個 BR-06 案例全通過**，全套 **19 套件、514 案例**；typecheck、architecture（44 模組）、npm test、verify、diff check 已執行。發布版本的最終 verify 結果另存。

Node EventTarget 在監聽器之間會清除 eventPhase。首輪替身因此使正常 seek 無法歸因，失敗紀錄保留；正式替身明確建模瀏覽器派送期間與 NONE 邊界，並非聲稱 Node 可建立可信瀏覽器事件。Chrome 原生可信按鍵另確認監聽器間 microtask 仍看到捕捉 phase 1，候選未提前清除。早期 Chrome 期限結果用錯 `recovery.phase` 欄位，實際 `state=failed`；校準紀錄保留，最終矩陣重新建立，沒有將作廢輪算通過。

重跑：

```powershell
npm test -- application --name BR-06
npm test -- adapters
npm run typecheck
npm run architecture
npm test
npm run verify
git diff --check
```

證據：`.work/functional-fixes/br06/2026-10-10-45a4420/`。正式測試不匯入該目錄，沒有 only／skip／todo／cancelled／預期失敗。

## 獨立安全差異審查

Codex Security **60289fdb-632c-49af-9c37-e55c21464f59** 已封存：7 個來源／測試檔完整覆蓋，0 可報告發現、0 未決候選。Digest：`codex-security-snapshot/v1:sha256:dfa2dc8b2b4d27a3c3cc6b6910910255ee3d9757adfcb4b8de2a915ca4925028`。獨立架構複核核對可信輸入、生命週期、原生可見性、Core／路線所有權及資源清理。政策 resolver 在 Windows 根目錄失敗，離線盤點只有根 SECURITY.md，已手動解析完整政策；不宣稱 helper 成功。

來源 hash（後續版本／文件變更不屬於該安全快照）：

- player.ts：`6890e938f49f4e4390c92cf685a63a63474c240bd2f95ab3d8596e3f48b61189`
- entry.ts：`ee27b53d710bfe057a2ca12f946d74360dbfebcf31b5bb115a619d8ae339e28f`

插件報告保存在 Codex Security 掃描目錄，與 verify 分開。插件度量為累計 5,628,537 tokens（含 5,312,128 cached input，3 個 thread），不是本次新增推理用量。此結果不是全產品無漏洞保證。既有指南的 region-only 鍵盤描述已在本輪現行指南對齊，不回寫原安全快照。

## Chrome 來源隔離

**15／15 通過**：可信 BODY 左／右／Home、1／2 倍模型的 15／30／15 邊界與不重試、直接 media seek、停止傳播、忽略／例外／腳本來源排除、真正派送結束後的 timer、editable／Ctrl／hidden／lifecycle、合成事件。`chrome-source-matrix.json` 保存完整記錄，`chrome-source-first.json` 保存真正 trusted=true 與監聽器间 microtask 的 phase 1 證據。

這是實際 Chrome 可信鍵盤配合修復來源、合成媒體狀態與 FakeClock；不是等待 30 秒的網站故障、原生媒體 getter 證據或 Tampermonkey singleton 驗收。例外來源隔離只是無 seek 對照，完整 wrapper 原例外由正式契約驗證。iframe 中的合成 getter 從未套用到網站影片。來源 iframe、監聽器與計時器已清理，網站 URL 維持指定風景片，主頁只有一個 video。

## 安裝版完成門檻與限制

**2026-10-10 續測更新：v2.1.14 已發布並核對完整安裝本體／singleton；BR-06 安裝驗收未通過。** 現行同一 keydown 策略能涵蓋左鍵，網站右鍵卻於 keyup 才真正尋位，未更新 userRevision。Auto 1／2 倍新右鍵後 6.995／7.673 秒即備援，1 倍 21.994 秒重載。這是已選策略與正式模型的覆蓋缺口；原 40 正式契約再跑通過，新的私有正確契約 2 fail／3 pass。詳見 [BR-07](CHROME_v2.1.14_BR07_KEYUP_SEEK.md)，原來源隔離與安全結果不擴大為網站右鍵通過。以下為完整驗收門檻，逐項狀態以新版安裝文件為準。

新版須先核對完整執行 body／singleton；不能用 v2.1.13、Node 或上述來源隔離替代。完整 BR-01 尚需實際新版 Auto 1／2 倍的 BODY／播放器／滑鼠、新 seek／拖曳／pause／rate、原生 hidden／實際 Runtime 可見性、延後 SDK 邊界、完整重載後 15 秒失敗／不重試及交叉失效／影音隔離。逐項結果以安裝驗收文件為準。

同一事件派送內沒有可觀察 seek 的命令不取得新寬限；派送後網站重試只撤銷舊還原，不猜測使用者身分。直接 media seek 若停止傳播、沒有包裝／媒體／controls 同步觀察，保守不歸因。核心標記與網站自然網路起因的既有限制仍保留；原 87.785 秒自然原因不因此結案。
