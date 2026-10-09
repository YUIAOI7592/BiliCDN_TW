# v2 工作狀態與後續方向

本文件只記錄現行範圍；文件用途見 [索引](INDEX.md)，產品契約見 [PROJECT_CONTEXT](PROJECT_CONTEXT.md)，開發與發布流程見 [DEVELOPMENT](DEVELOPMENT.md)。現行狀態更新至 **2026-10-10**；各版完成狀態以其日期的驗證／發布／瀏覽器紀錄為依據；2026-10-06 文件整理見 [維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

## 目前待完成

**v2.1.10 已發布 BR-02 修復，安裝版部分驗收完成。** 使用者更新後，本輪真正 Chrome／Tampermonkey 的 68 個 XHR 案例執行通過，取得同片播放／暫停及一次 8K→4K 正常對照；真正 startup gate 的 failed open 交錯仍未觸發，不宣稱 BR-02 全矩陣結案。新增正式契約、來源隔離及安全審查保留於 [BR-02 修復報告](BR02_FIX_REPORT.md)，當時 [原調查](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md) 不覆寫。

**BR-03 已隨 v2.1.11 發布；修復版安裝驗收待完成。** 2026-10-10 01:52（Asia/Taipei）從 `d3d1bc3185d51b62891920135b4126441e059696` 發布，01:53 公開 latest 讀回的版本、大小與 SHA-256 一致；AGENTS 已記錄修復通過必要驗證後自主提交／升版／推送／發布的持續授權。 請求 cid 優先、缺少時以有界父目錄集合判定內容，修正相同清單排列誤增 epoch／撤銷音訊身分。新增 43 個正式契約，全套 382 案例及完整 verify 通過；獨立安全差異審查 14 個來源／測試檔完整覆蓋、無可報告發現。Chrome 修復來源 BR-03 31／31 與 BR-02 對照 31／31 通過；尚未安裝修復產物。詳細交付及下一步見 [BR-03 修復報告](BR03_FIX_REPORT.md)，[原調查](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) 保留失敗紀錄。

BR-01 根因仍待定位：先前驗收重載後 4K 切換加 seek 停滯約 87.8 秒，最後解碼降為 1080p，選單仍顯示 4K；當段 epoch 維持 0，沒有證明與 BR-03 同根因。BR-03 修復輪在既有 v2.1.10 安裝版分開操作暫停、4K↔1080P、seek，短程正常，不能據此結案。其餘真正 gate／恢復／影音故障隔離等未改標通過，詳見 [v2.1.10 瀏覽器紀錄](CHROME_v2.1.10_ACCEPTANCE.md)。前段 18 個原生 XHR、R02／R03 控制中心交錯及部分播放證據維持 [v2.1.9 原紀錄](CHROME_v2.1.9_ACCEPTANCE.md) 的日期與範圍。

v2.1.8 在 2026-10-04 的修復、發布、Tampermonkey 標準更新與當時已安排的 Chrome 回歸仍維持已完成；該證據不覆蓋v2.1.9 修改。

原 MP4 影片已改會員限定，現場證據只涵蓋合法 30 秒試看片段；另以公開 DASH 影片驗證播放及網路面板（Network）。完整公開 MP4 與 FLV 尚無現場樣本，保留為覆蓋限制，不另列為已批准待辦。詳細結果見 [v2.1.8 歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。

## 已完成／已結案

- **2026-10-10 BR-03 本機修復**：382 個正式案例、完整 verify、安全差異審查與 Chrome 來源隔離完成；未提交、升版或發布。安裝版驗收仍列於上方。
- **2026-10-10 自主測試交付**：實際安裝版版本核對、68 個 XHR 案例執行與部分同片回歸；找到 BR-03 並完成詳細報告後，依使用者設定的替代完成條件收尾。全套產品驗收未完成，剩餘範圍列於上方。
- **2026-10-09 v2.1.10 已發布**：BR-02 所有權修復、339 個正式案例及完整 verify 通過，安全差異審查完成、無可報告的新安全發現。main／標籤已推送；公開更新網址的版本、293,972 bytes 及 SHA-256 均一致。Chrome 31 個來源隔離案例通過；安裝版驗收仍列於上方。
- **2026-10-09 v2.1.9 已發布**：17 項功能與競態修復、299 個具名測試案例及完整發行驗證通過，獨立安全差異審查完整覆蓋且無可回報發現。main／標籤已推送，公開 latest 使用者腳本的版本、大小與 SHA-256 均核對一致；新瀏覽器驗收仍分開列於上方。
- **2026-10-07 Markdown 粗體修正完成**：盤點專案 Markdown，修正 README 與三份公開歷史指南的八處失效標記；範圍與渲染驗證見 [文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-07-markdown-粗體渲染修正)。
- **2026-10-07 單元測試工具遷移完成**：15 契約套件、架構與匯入純度改用 Node 內建測試，新增執行器／清理／時鐘契約；實際驗證見 [工具紀錄](TEST_TOOLING_REPORT.md)。版本維持 v2.1.8。
- **v2.1.8 已發布**，GitHub 附件只有使用者腳本；修復及自動／安全審閱完成紀錄見 [歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。已封存且不可變更的安全報告保留中途 `partial coverage` 標記限制，來源審閱與瀏覽器驗收分開記錄。
- **v2.1.8 Tampermonkey 更新及本次 Chrome 回歸已完成**，涵蓋授權 MP4 試片及公開 DASH；較早 DASH 緩衝及格式限制保留於報告。
- 四階段模組化改善已於 **v2.1.7** 發布；自動驗證、發布及安全掃描限制見 [歷史驗證報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#published-bilicdn_tw-v217-test-report)。
- **v2.1.6 Chrome／Tampermonkey 驗收已批准通過、已結案**。歷史覆蓋限制不列為待辦，不因後續文件整理重新開啟；見 [驗收紀錄](../archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md)。
- 新增 CDN 節點計畫已撤銷；保留 [研究與測試結果](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md)，候選建議不列為待施作工作。

## 持續維護規則

程式、工具或發布狀態變更時，依 [文件維護對照](INDEX.md#維護對照) 同步現行指南。舊版報告、計畫或驗收中的待辦用語只描述當時狀態；目前工作以上方現行狀態為準。

自動驗證、安全掃描與實際 Chrome／Tampermonkey 結果分開記錄。後續安排瀏覽器回歸時，針對新差異記錄範圍與證據，不將歷史驗收重新列入本清單。

## 尚未安排的方向

下列方向須另有需求及證據才安排，不是本次工作或已批准待辦：

- 記住「上次 CDN」的偏好設定。
- 更積極的起播預先連線（preconnect）或挑戰測速頻率。
- Chrome＋Tampermonkey 以外的瀏覽器支援。
