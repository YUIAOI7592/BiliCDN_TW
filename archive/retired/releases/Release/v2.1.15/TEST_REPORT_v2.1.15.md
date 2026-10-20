<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.15 修復與發行驗證 — 2026-10-10

基準 **v2.1.14／9d98d09**。本輪修復 BR-07：網站右方向鍵在可信 keyup 派送才尋位，原 keydown 候選已失效，導致新命令沿用舊救援期限。PlayerAdapter 改為分別觀察 keydown／keyup，每次可信派送中的實際新 seek 取得一次使用者修訂；重複觀察去重，不建立按住狀態或延遲關聯窗口。Auto、15／30／15 秒、BR-01～06、schema 2 及公開 API 保持原契約。詳見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR07_FIX_REPORT.md)。

**BR-07 正式契約、v2.1.15 最終 verify、獨立安全差異審查及 Chrome 來源隔離已通過；正在封裝發布，實際安裝驗收待完成。** 未取得公開讀回前不宣稱發布。原 v2.1.14 完整報告與缺陷證據已移入歷史，不代替本輪結果。

## 自動驗證

| 項目 | 本輪結果 |
| --- | --- |
| 原五正式契約，修改執行期前 | **2 fail／3 pass，退出碼 1**；保存原紅燈紀錄，不計入通過 |
| 最小修復後原五契約 | **5／5 通過** |
| 擴充鍵盤／派送／控制器回歸 | **BR-06／BR-07 100／100**，分別 40／60 個正式案例 |
| typecheck／architecture | 通過；**44 個執行期模組**架構檢查通過 |
| npm test | **19 套件、574 個正式案例通過** |
| verify（升版前） | 通過；設定版本 **v2.1.14**，包括全套、確定性建置、語法、v2-only 及暫存封裝 checksum |
| verify（最終 v2.1.15） | 通過；574 案例、確定性建置、語法、v2-only 與 checksum 均通過 |
| diff check | 本輪文件檢查通過；最後整合差異另核對 |

正式回歸沿用 application 明確匯入的 functional-races/br06.ts；不匯入調查目錄，也不新增測試登記。替身分開建模事件種類與網站提交階段；可信事件模型不能替代 Chrome 原生輸入。最終正式執行不得留下 only／skip／todo／cancelled／預期失敗。

新證據目錄：.work/functional-fixes/br07/2026-10-10-9d98d09/。開始時提交 9d98d09d86f2a719556efccb7852c2e0e62d751e、工作目錄乾淨；Node 26.8.1／npm 11.19.0。原紅燈、最小修復、100 個鍵盤契約、整合 574 個及 verify-preversion 分開保存，沒有 only／skip／todo／cancelled／預期失敗。

## 獨立安全差異審查

Codex Security 差異掃描 **3e3d133e-7f39-4bf8-a0ba-d22d188a639a** 已於 **2026-10-10T10:51:13Z** 封存並讀回，兩個來源／測試差異檔及相關所有權邊界完整覆蓋，**0 可報告發現、無未處理候選**。三項 preflight 通過，Daybreak Blue granted；模型 gpt-6.1-sol／ultra，獨立審查約 10 分鐘。涵蓋可信派送、重入、腳本來源抑制、生命週期／動作所有權、清理及資料輸出。政策 resolver 誤報既有根目錄不存在，直接核對可讀 root SECURITY.md 且無巢狀政策後完成，不構成差異覆蓋缺口。封存原件不修改，逐檔雜湊相同的匯出位於本輪私有 security/。安全與 verify 分列，沒有宣稱安裝版通過。

## Chrome 來源隔離與安裝版

Chrome 修復來源隔離 **40／40 個有效案例通過**：真正可信 keydown／keyup、BODY／播放器焦點及 Auto 1／2 倍模型、八種 keyup、直接／停止傳播尋位、keydown／keyup 各自新 seek、位置 0、排除／方法相容、腳本還原、Event.NONE 延後及合成輸入、15／30／15 精確邊界與失敗後不重試。使用自有 iframe 的合成媒體／FakeClock，沒有修改網站 getter／控制器，不代替實際 Tampermonkey singleton。

`source/chrome-results.json` 共 42 份記錄，40 份有效 pass=true；初始校準觀察及 timer 尚未完成的無效觀察不列通過，後者已由 timer 收束的有效列替代，沒有確認新缺陷。800 ms 持鍵只產生 keydown／keyup 兩事件，**未證明原生 auto-repeat**；IME、nested 派送及媒體／播放器替換仍為正式模型證據，未宣稱完整 Chrome 覆蓋。清理後 browser／synthetic timer pending 均 0、seek／reload wrapper 已還原、自有 root 移除、iframe 殘留 0。

[v2.1.15 安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_ACCEPTANCE.md) 全部待新版實際驗收。先核對完整新版 body／唯一 singleton，再只用指定風景片、Auto 1／2 倍分開驗證新鍵盤寬限、12 秒 video-only 延遲、30 秒一次重載及其後完整 15 秒 failed／不重試、新操作、晚到 SDK／核心、真正背景及交叉失效／影音隔離。

## 發布與公開更新核對

待必要正式契約、整合檢查、安全差異審查及 Chrome 來源隔離通過後，依常設授權直接提交、升修補版、封裝、推送 main／標籤及發布 GitHub Release。基準未漂移且版本未使用時採 v2.1.15，Release 僅附 BiliCDN_TW.user.js。發布後核對遠端 main／標籤、唯一附件及公開 latest 版本、大小、SHA-256；未取得讀回證據不得標示完成。

<a name="歷史驗證導覽"></a>

## 剩餘限制與歷史

每次 keydown、repeat 或 keyup 若各自造成新 seek，各自取得一次身分；沒有實際位置變化則不計數。同一派送結束後的 Promise／timer／網站重試不取得使用者身分，網站／Auto 的單純 seekRevision 重綁仍保留期限。pendingSeek 保守抑制腳本還原；無法可靠辨識來源時撤銷過期還原，但不猜測新使用者命令。

工具截斷、網站提前 pause／error／外部換核心只證明相應撤銷，不計完整逾時通過。原 87.785 秒自然網路起因、沒有有效 cid 或共同路徑的保守重設及其他產品完整驗收不因此結案。

<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.14 完整正文與 BR-07 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2114-release-verification--2026-10-10)
- [v2.1.13 完整正文與 BR-06 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
