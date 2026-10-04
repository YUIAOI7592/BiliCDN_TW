# v2 工作狀態與後續方向

本文件只記錄現行範圍；文件用途見 [索引](INDEX.md)，產品契約見 [PROJECT_CONTEXT](PROJECT_CONTEXT.md)，開發與發布流程見 [DEVELOPMENT](DEVELOPMENT.md)。

## 目前進行中：v2.1.8 發布準備

- 工作樹已新增 progressive playurl、Catalog 來源與候選池、傳輸接納結果及安全摘要的修正和契約套件；最終自動驗證及必要安全審閱以 [TEST_REPORT](TEST_REPORT.md) 本次紀錄為準，不沿用舊版通過結果。
- `release.json` 已設為 **2.1.8**；完成必要安全審閱與發行驗證後，先發布 GitHub userscript 並確認 Release。現在仍屬發布準備，最新已發布版為 v2.1.7。
- **依使用者要求，發布後再透過 Tampermonkey 的標準最新版本網址更新**，接續目標 MP4 與 DASH 回歸及實際 Network 目的地驗證。FLV 目前只有自動契約證據；若沒有合法可用的 FLV 樣本，就保留此限制，不宣稱完成實際 FLV 播放驗收。

## 已完成／已結案

- 四階段模組化改善已完成，正式發行為 **v2.1.7**；自動驗證、發布與安全掃描紀錄的限制見 [TEST_REPORT](TEST_REPORT.md)。
- **v2.1.6 Chrome／Tampermonkey 驗收已批准通過、已結案**。其歷史覆蓋限制不列為待辦，也不因 v2.1.7 文件整理而重新開啟。
- 新增 CDN 節點計畫已撤銷；保留 [研究與測試結果](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md)，不把候選建議列為待施作工作。

## 持續維護規則

程式、工具或發布狀態變更時，依 [文件維護對照](INDEX.md#維護對照) 同步現行指南。舊版報告、計畫或驗收文件中的待辦用語只描述當時狀態；目前工作以上方 v2.1.8 發布準備與發布後回歸為準。

自動驗證、安全掃描與實際 Chrome／Tampermonkey 結果分開記錄。後續若安排瀏覽器回歸，範圍與證據應針對新差異記錄；不把歷史驗收重新列入本清單。

## 尚未安排的方向

下列方向須另有需求及證據才安排，不是本次工作或已批准的待辦：

- 記住「上次 CDN」的偏好設定。
- 更積極的起播 preconnect 或挑戰測速頻率。
- Chrome＋Tampermonkey 以外的瀏覽器支援。
