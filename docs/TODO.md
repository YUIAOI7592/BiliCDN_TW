# v2 工作狀態與後續方向

更新：2026-10-31。現行版本 **v2.1.40**，與 [release.json](../release.json) 一致；本頁只維護目前工作與啟動界線，逐項結果見 [TEST_REPORT](TEST_REPORT.md)。

## 現在的執行狀態

本次文件一致性整理已完成。產品修復交付與兩輪定向實測均已結束，沒有正在執行或排程中的瀏覽器案例；文件整理不恢復任何舊窗口。

| 工作 | 當前狀態 | 權威入口 |
| --- | --- | --- |
| 文件紀錄與導覽 | 已核對現行指南、目前狀態、歷史連結及執行界線；文件／封存／差異檢查通過，只修改文件 | [本次維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-31現行文件與歷史狀態全面對齊) |
| 現行產品交付 | v2.1.40 已發布，安裝完整本體已核對；固定 CDN 合法備援恢復資格缺陷已修復 | [修復、發布與安裝證據](TEST_REPORT.md#公開交付與安裝結案) |
| 整體核心驗收 | 未完成；未解根因、香港影片供片及自然恢復證據缺口保留 | [完整結果](TEST_REPORT.md) |
| 瀏覽器執行 | 移除 Evolved 後的修前／修後兩輪已結束並清理，不追加第三輪 | [修後定向窗口](TEST_REPORT.md#修後唯一-hk04-定向窗口) |

## 尚未解決的問題與證據缺口

<a name="v2139-驗收後待調查"></a>

| 編號／項目 | 現況與限制 |
| --- | --- |
| CC39-R01：N05 卡頓 | 移除 Evolved 後未再現；舊取消請求發起者與卡頓根因未確認，不因一次正常窗口判已解決 |
| CC39-R02：HK04 | 合法備援恢復資格缺陷已修復；舊網站 emptied／loadstart 原因仍未知，修後未自然觸發恢復 |
| CC39-R03：香港供片 | 修前 01-05／01-01 仍有影片 timeout；01-03 新取證前提誤選而 INVALID。修後 01-05 video circuit-open、由其他 CDN 供片，不能以香港音訊 206 代算影片成功 |
| CC39-R04：playerReady | 使用者移除 Evolved 後未再觀察到；舊提示完整因果未確認，取消獨立重測 |
| 條件式行為與通道 | 自然 gate、健康中段、家族排序、提前重試許可撤銷、HTTPDNS、剪貼簿及單分頁界線下的同步缺口，只依既有證據判定，不另開測試湊樣本 |
| 提前重試效用 | 原 FAIL 保留；正式預設與接線通過不等於效用通過 |

這些是未解問題或證據缺口，尚未啟動新的實測或修復輪次。可重現步驟、有效性、實際主機與清理結果集中於 TEST_REPORT，不在此複製矩陣與通過數。

## 執行邊界

- 本次只整理文件；產品來源、測試、工具、版本與發布快照維持。文件檢查不代表新的執行期或安裝驗收。
- 瀏覽器只用 IAB＋Tampermonkey，同時一個自有測試分頁，保持靜音；其餘永久界線與已確認靜音方法見 [AGENTS](../AGENTS.md#使用者永久執行禁令)。
- 已通過項目不重測。新案例必須先凍結範圍、次數、硬截止、清理時間與可沿用證據；不繼承舊輪次剩餘預算或自動安排重跑。
- 原十二個五分鐘窗口、IR36、自然起因、BR-01 歷史矩陣及已撤銷 CDN 研究維持停止／結案，不隨工具恢復、文件整理或發布啟動。
- P01 bounded prepare／P02 真 gate 仍須使用者明確恢復要求及指定影片自然 pending gate 的新前提；不改網站 timeout、重設預算或反覆刷新製造條件。
- 控制中心入口點擊與返回導覽沿用使用者跳過決定，不作阻塞、不安排續測。
- 不實作未授權的偏好記憶、提高探測頻率或其他平台擴展；舊採用否決與原 FAIL／INVALID 保留。

## 歷史決策與停止範圍

<a name="up141-本輪範圍與期限"></a>
<a name="後續方向"></a>
<a name="新功能整合決定討論歷史"></a>
<a name="控制中心介面決定討論歷史"></a>
<a name="ir36-本輪範圍與期限"></a>

| 歷史議題 | 原始範圍與結果 |
| --- | --- |
| UP141、六開關及控制中心整合 | [v2.1.39 完整報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2139-完整報告保存2026-10-31)、[分支整併](../archive/retired/docs/BRANCH_INTEGRATION_2026-10-31.md)、[v2.1.38 操作表](../archive/retired/docs/UP141_TEST_RELEASE_2026-10-30.md) |
| IR36 | [R1 原件](../archive/retired/docs/INSTALLED_RESTORE_IR36_2026-10-25.md)、[R2 結果](../archive/retired/docs/INSTALLED_RESTORE_IR36_R2_2026-10-25.md) |
| 診斷效能與候選撤回 | [成本及採用決策](../archive/retired/docs/DIAGNOSTICS_COST_2026-10-25.md) |
| 唯讀緩衝與提前備援採用否決 | [採用決策](../archive/retired/docs/BUFFER_ADOPTION_DECISION_2026-10-25.md) |
| 更早的停止與結案 | [結案紀錄](../archive/retired/docs/TODO_CLOSURE_2026-10-13.md) |

以上只作追溯，不是目前待辦或啟動授權。

## 維護與追溯

目前狀態只在本頁維護，最新版完整驗收只在 [TEST_REPORT](TEST_REPORT.md)；工具與環境結果按日期追加至 [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md)。方法見 [DEVELOPMENT](DEVELOPMENT.md#文件維護與結案)，版本／議題／日期導覽見 [HISTORY](HISTORY.md)。

本次整理前的完整 TODO 保存在 [fede700 固定快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/fede7003e7c5056b9ca1a713dbee7266370e45e0/docs/TODO.md)，包含本日所有歷史檢查點及先記錄、未實作等當時決策；不把它們繼續混列為現行狀態。更早正文見 [51ee733 固定快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/51ee733664570d880f5fcf324f5cc555067e233e/docs/TODO.md) 與 [重整前快照](../archive/retired/docs/DOCS_BEFORE_REORGANIZATION_2026-10-17.md#docs-todo-md)。
