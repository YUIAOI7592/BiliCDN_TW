# BiliCDN_TW v2.1.27 BR-01 救援修復驗證

<a name="bilicdn_tw-v2127-release-verification--2026-10-17"></a>

日期：2026-10-17（Asia/Taipei）。基準 ccf947a／v2.1.26；產品三階段 d6982c7、1402390、97d598b 完成後統一升版。可信未完成目標保護、有條件初始化還原及一般停滯加速已完成；[完整修復紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_RESCUE_FIX_v2.1.27.md)。自然起因暫緩，不開安裝故障窗口，歷史矩陣／FAIL／私有證據不回寫。

| 層級 | 實際結果與邊界 |
| --- | --- |
| 正式契約 N | 19 套件 1134／1134；基準 930 加產品單元 110、產品整合 58、純驗收工具 36；0 fail／skip／todo／cancelled |
| 分階段驗證 N | verify 1038／1060／1134；受影響套件、格式、嚴格型別、99 模組架構、確定性建置、語法、v2-only、封裝與 diff 檢查通過 |
| 升版後最終 N | v2.1.27 verify 退出0：格式、嚴格型別、99模組架構、1134案例、確定性建置、JS語法、v2-only、暫存封裝／校驗全部通過 |
| Codex Security | 固定 ccf947a..97d598b，27／27 正式項目、0 候選／0 發現、coverage complete，無延期；已封存 |
| IAB 來源 S | 最終97d598b，I-P01／02／03／I-R03 × 1／2 倍，共8／8；真實可信鍵盤／按鈕，自有媒體／SDK／FakeClock，無正式 GM |
| 來源證據重播 | 私有嚴格型別、node:test 8／8，退出0，與正式1134分開；首輪 blur FAIL 及中間產物保留 |
| 公開交付 | 本地 v2.1.27 382934 bytes，SHA-256 1b2ec2175ba2f1193509b0dea3e2f295ea8275b022ccb5a76e77d55c954f3795；推送／標籤／唯一附件及公開 latest 核對待發布後記錄 |
| 實際安裝 I | 尚未執行 v2.1.27；發布後僅指定影片 Auto1／2 倍正常操作、短 seek、倍速及控制中心；不把來源救援算成安裝故障救援通過 |

工具保持 Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2／Prettier3.9.10，無新增依賴、設定、持久欄位、CI/CD 或執行期載入。99個執行期模組，狀態與副作用所有者不變。

## 先紅後綠、單元及整合

修改前位置16案中 I-P01／I-P04 ×兩倍速真實4 fail；另固定ccf947a初始化四案全fail。期限新14案12 fail／2 pass。後續死核心4秒、還原跳躍、同步失效的play拒絕、子元素blur及暫停未知移位均保存紅色紀錄後修復，不改成預期失敗、不skip、不改寫歷史瀏覽器資料。

新產品單元：Observer46、Visibility2、Recovery52、Monitor10。相依服務使用 satisfies 最小替身；DOM事件替身屬Node契約，不充當瀏覽器可信輸入證據。新整合：位置／初始化20、時序12、Runtime26；真實Observer／Adapter／Recovery，及必要Monitor／Runtime共同執行，外部SDK／媒體／路線維持替身。驗收判定工具36單獨分類。

涵蓋非零／真正零、A→B、完成後使用目前位置、未知／換所有者撤銷、可信播放交接、位置與倍速各讀一次及捕獲後重查；首個自有初始化、第二seek／核心／期限／新操作撤銷；seek→rate→play逐項最多一次與邊界重入；舊Promise resolve／reject、reset、資源釋放及終止後120tick不重載。完整恢復另驗兩個有效樣本與後續15個一秒區段，位置誤差≤1秒（按經過時間／倍速校正），保存與seek目標差≤0.000001秒。尾段停滯、影格／身分／倍速／額度改變與缺尾段均使驗收失敗。

同一事件腳本舊／新1／2倍比較：15000／30000／45000ms → 6000／12000／27000ms；一秒監控的250ms相位偏移在27250ms終止。一般升為長seek保留起點、同段不降級，表示／網站seek／通知合併不補額度。此結果只證明指定事件時序與正常對照，不量測真實網站誤介入率。

## 新安全差異

scan 6cd20a95-d167-4f23-8f59-2856849ee830，固定 ccf947a0d70086247691cb7cb8da18586af059c4..97d598ba415d65698c062cc5db04efa74af55082，2026-10-16T22:28:58.781986Z完成。snapshot digest：codex-security-snapshot/v1:sha256:292aa572d0f5bda2d325b9d18de997f5a11ff9f20c2b04220bec24e3a67b579a。

前置3／3；Observer／Adapter／Visibility七項、Recovery與契約七項由兩個唯讀子代理分工，主代理審Monitor／入口／測試與工具十三項。無存活候選，無需候選驗證或攻擊路徑階段；opaque proof不授予Native路線、GM或新網路權限，SDK因果標記不是認證。canonical manifest／findings／coverage／threatmodel／report／SARIF由Codex Security工具封存於 scanId 對應目錄；沒有普通檔案工具寫入封存區。

工具計量 coverage=complete、source=codex_rollout、threadCount=3：total7295105 tokens、input7268873、cachedInput6886656、output26232、reasoningOutput8035。這是工具回報的串流彙總，非獨立審查次數、測試數或瀏覽器證據。掃描模型gpt-6.1-sol／xhigh；不推定為主代理實際模型。

## 來源、清理與證據入口

最終來源JS SHA-256：55df86a4e9bc96db42736ec466a662f2a486687d803b8f0221e3dd32a8fa7741，未修改97d598b產品來源；診斷插樁產物不納入驗收。I-P01歸零／I-P02不歸零均保存2811.002824，I-P03真正零保存0，I-R03初始化到3844後仍還原2811.002824與指定倍速，再驗有效進度與15秒尾段，各1／2倍分列。

每案訂閱／控制器／Adapter先釋放，再核對timer0、SDK方法還原，最後釋放FakeClock；頁面工具監聽器解除／隨分頁關閉釋放。沒有建立transport攔截或受控學習；held／patterns／breakpoints均0，自有分頁0、loopback31999停止且主機連線拒絕。無正式GM，沒有讀寫或清空使用者資料。

私有證據 .work/br01-fix/2026-10-17-v2.1.27-ccf947a/：FORMAL-CASES.json（逐案ID／來源SHA／狀態／退出）、FORMAL-OUTCOME.json（完整結果）、TIMING-COMPARISON.json、SOURCE-RESULT／MANIFEST／CLEANUP／REPLAY、來源JS／map及截圖、各階段紅綠／verify紀錄。舊 [r2調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_RCA_R2_2026-10-16.md) 的FAIL與隔離缺口保留；批准等待不能算執行超時的更正仍有效。

## 發布與安裝邊界

必要自動、安全及來源通過後統一封裝，GitHub只發布BiliCDN_TW.user.js。發布後先嘗試公開latest入口，再核對Tampermonkey、完整本體、singleton及hooks；當次入口實際受阻才請必要手動更新。v2.1.26完整正文及調查補記已原樣追加至 [歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2126-release-verification--2026-10-16)，既有Release／安全封存不回寫。

本輪沒有自然故障起因調查或安裝故障注入；正常安裝回歸通過也不代表這些項目通過。後續發布／安裝實測只追加main現行報告，不回寫已發布快照。
