# v2 工作狀態與後續方向

本文件只記錄現行範圍；文件用途見 [索引](INDEX.md)，產品契約見 [PROJECT_CONTEXT](PROJECT_CONTEXT.md)，開發與發布流程見 [DEVELOPMENT](DEVELOPMENT.md)。

## 目前待完成

本次修復、發布、Tampermonkey 標準更新與已安排的 Chrome 回歸均已完成，沒有尚待施作的已批准項目。

原 MP4 影片已改會員限定，現場證據只涵蓋合法 30 秒試看片段；依使用者要求，另以公開 DASH 影片驗證播放及 Network。完整公開 MP4 與 FLV 尚無現場樣本，保留為覆蓋限制，不另列為已批准待辦。詳細結果見 [TEST_REPORT](TEST_REPORT.md)。

## 已完成／已結案

- **v2.1.8 已發布並確認為最新正式 Release**，附件只有 userscript；MP4／FLV 修正、自動驗證及安全審閱已完成。封存安全報告的中途 `partial coverage` 標記限制保留於 [TEST_REPORT](TEST_REPORT.md)，不將來源審閱當作瀏覽器驗收。
- **v2.1.8 Tampermonkey 更新及本次 Chrome 回歸已完成**：授權 MP4 試看片段與公開 DASH 均有超過 12 秒的連續播放及 Catalog 直接 HTTPS 206 證據。DASH 較早短暫緩衝後恢復，覆蓋限制另行保留。
- 四階段模組化改善已於 **v2.1.7** 發布；該版自動驗證、發布與安全掃描紀錄的限制仍保留於 TEST_REPORT。
- **v2.1.6 Chrome／Tampermonkey 驗收已批准通過、已結案**。其歷史覆蓋限制不列為待辦，也不因 v2.1.7 文件整理而重新開啟。
- 新增 CDN 節點計畫已撤銷；保留 [研究與測試結果](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md)，不把候選建議列為待施作工作。

## 持續維護規則

程式、工具或發布狀態變更時，依 [文件維護對照](INDEX.md#維護對照) 同步現行指南。舊版報告、計畫或驗收文件中的待辦用語只描述當時狀態；目前工作以上方現行狀態為準。

自動驗證、安全掃描與實際 Chrome／Tampermonkey 結果分開記錄。後續若安排瀏覽器回歸，範圍與證據應針對新差異記錄；不把歷史驗收重新列入本清單。

## 尚未安排的方向

下列方向須另有需求及證據才安排，不是本次工作或已批准的待辦：

- 記住「上次 CDN」的偏好設定。
- 更積極的起播 preconnect 或挑戰測速頻率。
- Chrome＋Tampermonkey 以外的瀏覽器支援。
