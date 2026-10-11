<a name="bilicdn_tw-v2120-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.20 BR-01 新意圖位置保存驗證 — 2026-10-11

## 2026-10-11 IAB 第 4 輪

以 `14ea6a5` 為基準，[TODO 第 4 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_TODO_R4_2026-10-11.md) **新增實際安裝／原生 XHR timeout 2 案，以及內建瀏覽器來源隔離格式與 hook 資源 17 項通過，沒有新確認的產品缺陷。** 前 3 輪有效結果沿用。B02 播放器焦點 2 倍的未觀察尾段嘗試兩次，均在新按鍵前被收集器中斷，不算產品通過或失敗；未再跑無新前提的背景、gate 或既知無效故障窗口。

逾時採非阻塞啟動與連續游標，完整 DONE→timeout→loadend，無截斷；來源隔離的 12 個合成 API 均先攔截再回應，GM 不存在、記憶體寫入 0。獨立 B02 收集器的最小對照證實跨呼叫變數重設未更新舊閉包，下次須先隔離驗證工具。最終 7 個觀察包裝還原、timer／訂閱釋放、攔截空、5 個受控 request 樣本零匹配；實際分頁為零、服務停止，C01 通過。原工具錯誤頁與第一窗網路缺口保留歷史紀錄，不補算案例。保存證據斷言、自有模型型別檢查、5 份文件 GFM／連結與 diff 檢查另存；未改正式來源、重跑完整 npm／verify／安全掃描或發布新版。累計缺口見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 2026-10-11 IAB 第 3 輪

依使用者要求，只用內建瀏覽器續做可執行 TODO，沿用既有通過結果。以 `783ece1` 為基準完成 [TODO 第 3 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_TODO_R3_2026-10-11.md)：**新增 XHR 同步／abort／本地終止 10 案、雙分頁 Catalog 合併／GM 同步與診斷讀取子項通過；沒有新確認的產品缺陷，本輪未取得完整通過。** timeout 子項因事件截斷及工具逾時無產品判定，B06 新晚到成功窗口被網站在實際 SDK 前換核心／暫停而作廢，停止重複嘗試。

三個文件實例的完整 v2.1.20／Tampermonkey 5.5.1 身分與唯一 singleton 均核對。兩頁設定已精確復原，受控 31 個 request 的記憶體／持久樣本零匹配，6 個 SDK／證據包裝及 4 個設定 listener 清理，自有分頁為 0。只更新瀏覽器證據與文件，沒有改執行期來源、完整 npm／verify／安全重跑或新 Release。具體再開前提及未執行項見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

保存證據的 12 個一致性斷言、5 份文件的 GFM／16 表格／142 連結與 `git diff --check` 通過。這些檢查不代替新的執行期測試。

## 2026-10-11 IAB 第 2 輪

依使用者指示，先提交／推送第 1 輪文件為 `24dcdfd`，再完成 [BR-01 內建瀏覽器第 2 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_BR01_R2_2026-10-11.md)。**新增播放器焦點／滑鼠 seek、inner 長按、2 倍晚到 SDK 拒絕及 pending 政策撤銷子項通過；沒有新確認的產品缺陷，固定矩陣仍未取得完整通過。** 第 1 輪有效核心期限沿用。真背景校準沒有 hidden 轉換、原生 repeat／cancel 能力不足、部分安裝交錯沒有成立；具體原因見新報告。

獨立 P01 的原生／實際安裝 XHR 子集 **24／24**；最終 Network 無截斷，所有本地拒絕請求未到達送出前攔截層。14 個保存證據的一致性斷言通過；沒有重跑完整 npm／verify／安全掃描，來源與版本未變。最終包裝還原、受控樣本零匹配、自有分頁為 0、服務停止；第一個影片實例失去連線時逐一 dispose 未被觀察，歷史限制明列。累計缺口見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)，不把 P02–P05 或自然網路起因加為 BR-01 門檻。

## 2026-10-11 IAB 第 1 輪

使用者另行要求重啟後，以 v2.1.20／`0d036f4` 執行並收束 [BR-01 內建瀏覽器第 1 輪](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_BR01_R1_2026-10-11.md)。**核心 15／30／15 秒救援在 Auto 1／2 倍均通過；固定矩陣未取得完整通過，沒有新確認的產品缺陷。** 正常播放、12 秒延遲、wrapper 故障長按與音訊隔離另有有效安裝證據。背景前提、原生特殊輸入、晚到 SDK 操作矩陣及部分未執行子項的具體原因見該報告，不以來源隔離代替安裝結果。

本輪來源隔離最終 S03 為 74 個情境通過，自有新模型型別檢查及 8 個證據複核斷言通過；未重跑完整 npm／verify／安全掃描。正式來源與發布產物未修改，沒有升版、提交或推送。自有測試頁／服務已收束，設定復原，受控樣本零匹配；工具錯誤頁的自動關閉尚未觀察，單獨列明。當前狀態以 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md) 為準。

## 先前的環境與文件工作

2026-10-11 使用者停止自主故障測試後，另授權的 [內建瀏覽器 Tampermonkey 可用性重新驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md) 確認完整 v2.1.20、唯一實例、可信輸入、控制中心及合成 Fetch／XHR 攔截通過。背景窗口因實際切換與 getter 未充分校準而無效，已撤回背景能力失敗判定；selectedTab 2→3→2 與 prototype getter=false／Runtime visible=true 保留為觀察。今後瀏覽器測試只使用內建瀏覽器＋Tampermonkey，BR-01 自主目標保持停止；本次環境確認沒有重跑 npm 或修改發布快照，也不增加 BR-01 通過項目。

## 2026-10-11 文件方案更新

依使用者最新指示，新增 [IAB_TESTING](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_TESTING.md)，統一來源隔離、安裝版與環境校準；禁止改用外部瀏覽器。新矩陣尚未整輪執行，本次沒有重跑程式、自動測試、安全掃描或故障注入，也沒有升版／發布。當前工作與啟動狀態見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

下方數字保留 **v2.1.20 發布與當時 Chrome 證據**，不轉算為內建瀏覽器完整通過。整理前的完整正文另存 [指南快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/IAB_GUIDES_BEFORE_2026-10-11.md#docs-test-report-md)，歷史 Release 與安全封存不回寫。

## v2.1.20 修復時驗證

基準v2.1.19／ff725e918793531cb39bd9aa7d506779360c754e，開始時乾淨。修正新paused-transition保存SDK舊位置，見 [修正報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_NATIVE_POSITION_FIX_REPORT.md)。必要本機門檻通過；發布核對另記於下節，完整實際安裝矩陣未通過。

| 項目 | 本輪結果 |
| --- | --- |
| 執行期未修改時正確契約 | 12 fail／4 pass |
| 最終型別正確契約＋不可變原來源重建 | 12 fail／29 pass，含既有25正常案；不回滾來源 |
| 新正式回歸 | 16／16；application286／286 |
| npm test／最終verify | 19套件／771／771；0 fail／skip／todo／cancelled |
| typecheck／architecture | 通過，44個執行期模組 |
| npm run verify v2.1.20 | 退出0；確定性建置、語法、v2-only及封裝校驗通過 |
| Chrome原生HAVE_NOTHING位置讀取 | 自有iframe真正空video6／6，無getter覆寫 |
| Chrome Adapter／Recovery模型 | 自有iframe受控媒體／FakeClock6／6；不是安裝singleton |
| Codex Security差異 | 已封存2／2，0候選／0發現；封存後test-only参数修正另審查驗證 |

Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2。證據與重跑入口存於 .work/functional-fixes/br01-native-position/2026-10-11-ff725e9/。Chrome ownVideos=0、iframe移除；沒有修改網站媒體getter、控制器或起播預算。

## 安全範圍

掃描2661c0e4-d1dc-44cc-b4a6-089883858759於2026-10-11T05:02:52.273269Z封存，獨立架構及位置／恢復／路線消費邊界完成。runtime SHA-256 417fdbdcd229e47a5d7e7f75584fb8cfe55eac0e57b24859e62b4a142d0afa28封存後不變。原封存br09.ts的一個armRouteFailure參數錯誤由typecheck抓到；改為傳入真正VideoSnapshot後，父代理另審查單行test-only差異與重新驗證，不冒充原封存測試雜湊。根SECURITY.md人工解析，因工具錯報Windows目錄不存在；舊安全產物不回寫。新try只保證native讀取邊界，不宣稱所有既有getter安全。

## 發布與實際安裝

v2.1.20於2026-10-11T05:09:46Z（Asia/Taipei13:09:46）[正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.20)。發布時遠端main與peeled tag均為18f0c4f1923e62692ee4a52bac18f475ad837e15，tag ref為11a0c3784dd7fc937f0a9065cfbab704b35669f6。唯一BiliCDN_TW.user.js附件336,219 bytes，SHA-256 b8e5bd4744737537f348fcc7d9fb9f258fd41bc5e60327e5f4259560dcd5b54e；05:10:16.111Z無認證公開latest版本／大小／SHA-256完全一致。封裝前diff檢查通過，Release快照不回寫；後續純文件提交另推main。

05:12:19.828Z指定影片完整執行本體exact v2.1.19，非v2.1.20；Debugger身分事件無截斷或未排空。新版安裝前提不通過，已請使用者完成必要Tampermonkey手動更新，工具不能操作擴充功能更新介面。這是實際載入阻塞，不是發布授權；沒有以舊版或來源結果計入新版通過。

使用者更新後05:17:15.659Z，完整本體 exact v2.1.20、Runtime／ControlCenter各唯一1，身分事件未截斷且排空。實際 Auto1 新目標與 Auto2 有效0保存修正通過；正常播放／短seek／12秒影片延遲、31秒拖曳及可信 pointercancel／lostpointercapture、可信控制撤銷後晚到拒絕取得有效子項。自然 Auto2 stall 的一次實際重載及9秒後 recovered 有完整媒體／動作紀錄，但長歷史Network截斷，不計完整合併窗口。當輪完整同版失敗退出與其餘矩陣**未取得完整通過**；當時持續執行的目標其後已由使用者停止。詳見 [實際v2.1.20續測](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.20_BR01_ACCEPTANCE.md)。更新前載入阻塞已解除；本輪沒有新的來源變更或完整自動重跑。

以下為更新前 v2.1.19 的歷史結果：完整本體／唯一singleton已確認。正常Auto1／2、播放中12秒video延遲及Auto1完整15／30／post15＋不重試取得有效子項；新意圖保存舊SDK位置不通過，由本版修正。Auto2完整停滯、晚到SDK全矩陣、真正hidden、自然pending gate及其他剩餘項未取得全部有效證據，**BR-01整體不通過**。見 [實際續測二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.19_INSTALLED_CONTINUATION.md)。v2.1.20實際安裝前提未成立時，不計新版通過；須核對body／唯一singleton後重跑本輪缺口及剩餘矩陣。原87.785秒自然網路起因獨立未定位。

<a name="歷史驗證導覽"></a>

## 歷史導覽

- [v2.1.19完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2119-release-verification--2026-10-11)
- [v2.1.17二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)
- [更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
