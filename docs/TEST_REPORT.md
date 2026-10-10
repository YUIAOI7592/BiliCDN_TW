<a name="bilicdn_tw-v2115-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.15 修復與發行驗證 — 2026-10-10

基準 **v2.1.14／9d98d09**。本輪修復 BR-07：網站右方向鍵在可信 keyup 派送才尋位，原 keydown 候選已失效，導致新命令沿用舊救援期限。PlayerAdapter 改為分別觀察 keydown／keyup，每次可信派送中的實際新 seek 取得一次使用者修訂；重複觀察去重，不建立按住狀態或延遲關聯窗口。Auto、15／30／15 秒、BR-01～06、schema 2 及公開 API 保持原契約。詳見 [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR07_FIX_REPORT.md)。

**BR-07 修復與 v2.1.15 發布完成；實際安裝版已有部分通過，新增 BR-08 未修、完整 BR-01 未結案。** 正式契約、最終 verify、獨立安全差異及 Chrome 來源隔離通過，發布時遠端 main／標籤／唯一附件與公開 latest 核對完成。使用者更新後，11:04:00Z 完整 v2.1.15 執行本體匹配、singleton 1；正常 Auto 1／2 倍鍵盤及新 15 秒寬限有證據。續測確認 [BR-08 進度列外層拖曳漏辨](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)，依新缺陷報告退出條件收尾，沒有擴修或宣稱全面驗收。原 v2.1.14 及更新前中途觀察保留。

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
| diff check | 發布後文件差異檢查通過；13 份現行文件／新報告的 278 連結及 33 顯式錨點核對無錯誤，未新增執行期測試宣稱 |

正式回歸沿用 application 明確匯入的 functional-races/br06.ts；不匯入調查目錄，也不新增測試登記。替身分開建模事件種類與網站提交階段；可信事件模型不能替代 Chrome 原生輸入。最終正式執行不得留下 only／skip／todo／cancelled／預期失敗。

新證據目錄：.work/functional-fixes/br07/2026-10-10-9d98d09/。開始時提交 9d98d09d86f2a719556efccb7852c2e0e62d751e、工作目錄乾淨；Node 26.8.1／npm 11.19.0。原紅燈、最小修復、100 個鍵盤契約、整合 574 個及 verify-preversion 分開保存，沒有 only／skip／todo／cancelled／預期失敗。

## 獨立安全差異審查

Codex Security 差異掃描 **3e3d133e-7f39-4bf8-a0ba-d22d188a639a** 已於 **2026-10-10T10:51:13Z** 封存並讀回，兩個來源／測試差異檔及相關所有權邊界完整覆蓋，**0 可報告發現、無未處理候選**。三項 preflight 通過，Daybreak Blue granted；模型 gpt-6.1-sol／ultra，獨立審查約 10 分鐘。涵蓋可信派送、重入、腳本來源抑制、生命週期／動作所有權、清理及資料輸出。政策 resolver 誤報既有根目錄不存在，直接核對可讀 root SECURITY.md 且無巢狀政策後完成，不構成差異覆蓋缺口。封存原件不修改，逐檔雜湊相同的匯出位於本輪私有 security/。安全與 verify 分列，沒有宣稱安裝版通過。

## Chrome 來源隔離與安裝版

Chrome 修復來源隔離 **40／40 個有效案例通過**：真正可信 keydown／keyup、BODY／播放器焦點及 Auto 1／2 倍模型、八種 keyup、直接／停止傳播尋位、keydown／keyup 各自新 seek、位置 0、排除／方法相容、腳本還原、Event.NONE 延後及合成輸入、15／30／15 精確邊界與失敗後不重試。使用自有 iframe 的合成媒體／FakeClock，沒有修改網站 getter／控制器，不代替實際 Tampermonkey singleton。

`source/chrome-results.json` 共 42 份記錄，40 份有效 pass=true；初始校準觀察及 timer 尚未完成的無效觀察不列通過，後者已由 timer 收束的有效列替代，沒有確認新缺陷。800 ms 持鍵只產生 keydown／keyup 兩事件，**未證明原生 auto-repeat**；IME、nested 派送及媒體／播放器替換仍為正式模型證據，未宣稱完整 Chrome 覆蓋。清理後 browser／synthetic timer pending 均 0、seek／reload wrapper 已還原、自有 root 移除、iframe 殘留 0。

[v2.1.15 安裝矩陣](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.15_ACCEPTANCE.md) 已取得實際完整 body／singleton 1；317,487 bytes 與公開 Release SHA-256 一致。更新前 10:59:19Z 仍 v2.1.14 的紀錄 installed/update-prerequisite.json 保留為歷史中途觀察，使用者完成手動更新後重新取身分，沒有操作或繞過擴充介面。正常 Auto 1／2 倍 BODY／播放器 Right／Left 各新增一次 userRevision，播放／暫停恢復有實際時間及影格進度；1 倍最後一次 player Left 保存時仍 seeking，未補算 settled。

約 12 秒 video-only 窗口，1／2 倍的實際 seek→release 為 12.075／12.169 秒，首次有效進度 17.863／21.985 秒；各一次合法 video fallback、核心重載 0、audio 通行。故障舊段後新可信 Right keyup，1／2 倍在新操作後 15.427／15.310 秒各一次備援；2 倍 30.309 秒一次自有重載。1 倍網站先外部換核心，2 倍重載後 paused，均未形成完整重載後 15 秒無進度退出／不重試前提。實際 BR-02 Blob／native 與本地 HTTPDNS 拒絕所有權子集通過；BR-03 及共用 startup gate BR-04／05 待驗收（實際 startup.state=skipped、reason=preflight-skipped:xhr-explicit-timeout、candidates=0、delayed=false；沒有重建 gate）。晚到 SDK 由網站先換核心、尚未到實際方法回傳；真正 hidden 387 採樣皆 false，必要前提未形成。

**新 BR-08，P2、未修復：** 10 px 功能性 wrapper 外圈未命中 4 px inner selector，可信按住期間 dragging=false，15.079 秒啟動一次影片備援；inner 故障按住超過 16 秒保持 dragging=true 且無動作。私有七個正確契約 **3 fail／4 pass、退出碼 1** 是未修來源的缺陷證據，與發布前 **574 正式通過**分列；30 秒拖曳重載僅模型證據，未宣稱現場成立。

最終 installed/final-cleanup.json 讀回 107 受控 IDs 記憶體／持久匹配前後皆 0、相符活 XHR 空、自有 observer／pointer／SDK API 已移除、send／證據包裝已還原、自有 iframe 0、held requests 0／patterns 已清，Network／Debugger／Runtime 觀察已關閉。SDK 繼承方法的工具草稿遮蔽另已清理，hasOwnReload=false／方法等於原型；未列為產品缺陷。清理前 Auto 2 倍實際 1979.88 秒／35714 frames；交接由網站原生控制暫停於 **2042.773843 秒、Auto 1 倍**。最終事件對帳有 98 starts／96 completions，11 IDs 缺 completion（9 無 start、2 有 start），不能宣稱 107／107 傳輸完成；歷史捕捉缺口未由最後活請求空值重建。晚到 tail 的截斷不作完整期限證據。

## 發布與公開更新核對

v2.1.15 於 **2026-10-10T10:57:18Z（Asia/Taipei 18:57:18）** [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.15)。發行提交／peeled tag `3f7c73335a58dd89d4bc8a4209b7ecf3c70acaf8`，標籤物件 `d838c3a804d4a5a55f4b7b931cdaf15f8476b745`；發布時遠端 main 一致。唯一附件 `BiliCDN_TW.user.js`，**317,487 bytes**，SHA-256 `affedbeef854462c60fd5fd68947fc4c37ef7ddb7bd2922e72fed6cca6b342bf`。**10:57:38Z** 無登入公開 latest 下載核對版本、大小及雜湊全部匹配，更新網址維持原位。發布後補驗收文件不改寫發行標籤或 Release 快照。

<a name="歷史驗證導覽"></a>

## 剩餘限制與歷史

每次 keydown、repeat 或 keyup 若各自造成新 seek，各自取得一次身分；沒有實際位置變化則不計數。同一派送結束後的 Promise／timer／網站重試不取得使用者身分，網站／Auto 的單純 seekRevision 重綁仍保留期限。pendingSeek 保守抑制腳本還原；無法可靠辨識來源時撤銷過期還原，但不猜測新使用者命令。

工具截斷、網站提前 pause／error／外部換核心只證明相應撤銷，不計完整逾時通過。原 87.785 秒自然網路起因、沒有有效 cid 或共同路徑的保守重設及其他產品完整驗收不因此結案。

<a name="bilicdn_tw-v2114-release-verification--2026-10-10"></a>
<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

- [v2.1.14 完整正文與 BR-07 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2114-release-verification--2026-10-10)
- [v2.1.13 完整正文與 BR-06 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2113-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
