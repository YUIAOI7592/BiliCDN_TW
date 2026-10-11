<a name="bilicdn_tw-v2120-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.20 BR-01 新意圖位置保存驗證 — 2026-10-11

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

使用者更新後05:17:15.659Z，完整本體 exact v2.1.20、Runtime／ControlCenter各唯一1，身分事件未截斷且排空。實際 Auto1 新目標與 Auto2 有效0保存修正通過；正常播放／短seek／12秒影片延遲、31秒拖曳及可信 pointercancel／lostpointercapture、可信控制撤銷後晚到拒絕取得有效子項。自然 Auto2 stall 的一次實際重載及9秒後 recovered 有完整媒體／動作紀錄，但長歷史Network截斷，不計完整合併窗口。完整同版失敗退出與其餘矩陣目前**不通過，原目標持續執行**；詳見 [實際v2.1.20續測](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.20_BR01_ACCEPTANCE.md)。更新前載入阻塞已解除；本輪沒有新的來源變更或完整自動重跑。

v2.1.19完整本體／唯一singleton已確認。正常Auto1／2、播放中12秒video延遲及Auto1完整15／30／post15＋不重試取得有效子項；新意圖保存舊SDK位置不通過，由本版修正。Auto2完整停滯、晚到SDK全矩陣、真正hidden、自然pending gate及其他剩餘項未取得全部有效證據，**BR-01整體不通過**。見 [實際續測二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.19_INSTALLED_CONTINUATION.md)。v2.1.20實際安裝前提未成立時，不計新版通過；須核對body／唯一singleton後重跑本輪缺口及剩餘矩陣。原87.785秒自然網路起因獨立未定位。

## 歷史導覽

- [v2.1.19完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2119-release-verification--2026-10-11)
- [v2.1.17二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)
- [更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
