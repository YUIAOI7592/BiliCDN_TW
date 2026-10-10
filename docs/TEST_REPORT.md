<a name="bilicdn_tw-v2119-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.19 BR-01 空媒體鍵盤修復驗證 — 2026-10-11

基準 v2.1.18／953ffeaebff686eaaffe27ef2fe622bb97fa1b95，開始時工作目錄乾淨。詳見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_NATIVE_KEYBOARD_FIX_REPORT.md)。本機必要驗證通過；完整實際安裝 BR-01 尚未記為通過。

| 項目 | 本輪證據 |
| --- | --- |
| 修改執行期前正式正確契約 | 4 fail／7 pass；原失敗記錄保留 |
| 新正式回歸 | 14 項，既有 application 明確匯入 |
| typecheck／architecture | 通過；44 執行期模組 |
| npm test | 19 套件／755 項；0 fail／skip／todo／cancelled |
| 最終 npm run verify v2.1.19 | 退出 0；755 契約、確定性建置、語法、v2-only、校驗 |
| Chrome 原生可信鍵盤來源隔離 | 30／30；原生空 video，1／2 倍，不覆寫 getter |
| Codex Security 差異 | 已封存，2／2 凍結來源／測試項，0 候選／0 發現 |

Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2。私有證據 .work/functional-fixes/br01-final/2026-10-11-953ffea/ 保存修復前後、正式結果、Chrome 原生入口及檢查點。來源 Chrome SDK／核心／時鐘是自有模型，不代表實際 Tampermonkey。

## 安全範圍

掃描 d3d31ada-7afb-4e77-9fb4-e0378a0db1d2 於 2026-10-10T19:50:51.270579Z 封存。PlayerAdapter／br06.ts 全差異與控制器／Vault 消費邊界覆蓋，獨立架構確認。完成工具曾因草稿缺欄失敗；補齊真正覆蓋後成功封存並重新讀取，不將錯誤記為通過。policy helper 無法看見根目錄，人工確認根 SECURITY.md 是唯一適用政策並完整閱讀。版本／文件／產物於掃描封存後獨立核對。

## 發布與安裝

v2.1.19 於 2026-10-10T19:56:06Z 正式發布；發行提交／發布時 main／peeled tag 為 ee48076c0ae031dcaed0c2cec0b875cd07f6ddf6，tag ref 為 8352b52d2f5a9aab8de29fe17e2aeac444fd988a。唯一 BiliCDN_TW.user.js 附件 335,996 bytes，SHA-256 d51be6e17ca8263052b1022b465f4f8247f358eaa654be8ec1f128579b2354d1；19:56:35.988Z 無認證公開 latest 完整相同。發布通過，Release 快照不回寫。完整安裝驗收須重新確認本體／singleton，Auto1／2、15／30／15、不重試、新操作／晚到 SDK、拖曳、真正背景、政策／影音／傳輸／內容／gate 各自取得有效證據。原 v2.1.18 新键盤窗口證明本次缺口；Network 校準缺口不能算完整期限。沒有有效前提與證據者判為不通過。

19:58:35Z 新載入指定影片的完整本體 exact v2.1.18、非 v2.1.19。公開更新網址已實際開啟 Tampermonkey 使用者腳本更新頁；瀏覽器工具因 chrome-extension 協定安全政策拒絕操作，禁止替代通道繞過。此時安裝新版前提不通過，已請使用者完成該頁更新，不再次要求發布授權。

原 87.785 秒自然網路起因獨立未定位，不作本次修復門檻。公開 API、schema2、Auto／ABR及網路授權不變。

## 歷史導覽

- [v2.1.18 完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2118-release-verification--2026-10-11)
- [v2.1.17 BR-01 二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)
- [更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
