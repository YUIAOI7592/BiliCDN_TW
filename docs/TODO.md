# 目前工作

現行版本 **v2.2.17**。工作與授權只在本頁維護；驗收結果見 [TEST_REPORT](TEST_REPORT.md)，歷史原判定見 [HISTORY](HISTORY.md)。

## v2.2.17 假停滯與重試抑制修復

原調查及九組證據保持原文，見[研究報告](../archive/retired/docs/RECOVERING_SUPPRESSION_v2.2.16_2026-11-10.md)。已完成有效觀察次數與單調時間雙門檻、恢復動作與段落額度分離；完整契約、安全、verify、封裝、main／標籤推送與公開 latest 核對通過，本工作結案。對照見[實作紀錄](../archive/retired/docs/PROGRESS_STABILITY_v2.2.17_2026-11-10.md)，正式結果見 [TEST_REPORT](TEST_REPORT.md)。本輪只離線交付，沒有啟動瀏覽器；後續實機需另案只驗本次修復。

## 下一步優先順序

| 順序／分類 | 待辦與完成界線 |
| --- | --- |
| 1／本版驗收證據 | 另案核對採樣修復與穩定後抑制接線；沒有自動啟動的 IAB 輪次，已通過且未改的功能不重測 |
| 2／研究與證據 | 校準窗口游標與通道分母，再分析提前重試實際適用率、交接成本與效益；正數 timeout 擴張另立方案，原效用 FAIL 保留 |
| 可延後／程式優化 | 播放器操作與 RecoveryController 狀態整理；以責任與副作用契約為準，不因行數直接拆分 |
| 條件成立才補／驗收證據 | Native 自然刷新、真正跨分頁協作、健康中段、P01／P02 及歷史供片／恢復等缺口；沿用下方限制，不重跑已通過窗口 |

這是後續建議排序，不構成修改政策或恢復停止驗收的授權；現有黑名單及 Native 缺少部分實機分支證據，不等於已確認功能失效。

## 全工作區整理

已完成逐檔盤點、消費者核對、工具與測試支架清理，以及壓縮封存後的上游比較讀取修正；完整驗證及新增證據還原通過，結果與保留理由見[工作區整理報告](../archive/retired/docs/WORKSPACE_CLEANUP_2026-11-10.md#最終驗證與結案)。產品程式未改，版本維持 v2.2.16；依授權提交推送 main，不發布、不恢復歷史研究或瀏覽器工作。

## archive 精簡與保護規則重整

使用者其後批准 `.work` 第一批四個已驗證副本目錄清理，原結果見[第一批紀錄](../archive/retired/docs/ARCHIVE_COMPACTION_2026-11-10.md#work-第一批副本清理)。後續已另行批准全面整理；41 個任務目錄完成逐檔分類、唯一證據壓縮保存及冗餘清理，up141 退役 Runtime 已刪除，不搬入 tools 或另存備份。現用工具與任務資料分工已更新，詳細數字、還原結果與限制見[全面整理紀錄](../archive/retired/docs/ARCHIVE_COMPACTION_2026-11-10.md#work-全面整理與工具歸位)。完成文件與封存檢查後主動提交推送 main，版本維持 v2.2.16；不恢復歷史研究或瀏覽器工作。

依使用者批准計畫完成，基準 main／2077805，原交付結果見[清理報告的最終結案](../archive/retired/docs/ARCHIVE_COMPACTION_2026-11-10.md#最終結案)。原先保留的 34 項已另經批准完成處置：32 個編譯快取刪除，兩個原生模組壓縮並驗證還原後移除散件，這批待釐清項目歸零；新舊清單及處置證明保留，詳見[後續處置紀錄](../archive/retired/docs/ARCHIVE_COMPACTION_2026-11-10.md#原-34-項的後續處置)。本輪只更新封存位置與文件，文件、公開／本機封存及完整還原核對已通過，依授權提交推送 main，版本維持 v2.2.16；沒有自動啟動的後續清理或瀏覽器工作。

## 七日舊副本清理

依使用者確認的「只清非保護的舊副本與快取」範圍完成並結案；逐檔還原依據、刪除結果與保留界線見[本次維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#七日舊副本清理2026-11-09)。受保護歷史及用途未能確認的資料保留，這次清理不建立自動到期刪除政策。完成文件與封存檢查後依既有授權主動提交推送 main；產品版本維持 v2.2.16。

## 工具鏈相容性與版本鎖定評估

已依批准計畫完成現有環境與 Codex 內建 Runtime 的比較，原始結果與逐項建議見[研究報告](../archive/retired/docs/TOOLCHAIN_COMPATIBILITY_v2.2.16_2026-11-09.md#研究結論)。研究階段止於報告，沒有修改程式或版本限制；使用者其後批准另立的工具鏈整理實作計畫，執行狀態見下節，不回寫原研究判定。

研究文件已依既有授權提交推送，當時沒有升版、正式封裝、移動標籤、發布或恢復瀏覽器窗口。乾淨安裝與未來 runtime 更新的證據限制保留，既有效用 FAIL 及安裝判定保持。

## 工具鏈整理實作

已依批准計畫完成，基準 main／774a231、產品版本維持 v2.2.16。Codex 使用當次解析的內建 Runtime，Node 版本鎖定改為能力探測與完整 verify，既有 CLI、開發依賴及原功能契約保持；設定、編譯目標、工具紀錄與現行指南已同步。自動驗證、舊環境工具補驗及安全差異掃描完成，完整結果見[原研究的實作銜接](../archive/retired/docs/TOOLCHAIN_COMPATIBILITY_v2.2.16_2026-11-09.md#完整驗證與安全差異結果)。各階段獨立提交，收尾檢查後主動推送 main；不升版、正式封裝、發布或啟動瀏覽器。

本工作結案，沒有自動啟動的下一項修改。未來 Runtime 更新仍按當次能力與完整驗證判定，不將單次通過外推為所有版本／平台；乾淨安裝尚未新增驗證，既有效用 FAIL、安裝判定與停止窗口保持。當時保留的 up141 工具鏈已依後續批准的 `.work` 全面整理計畫刪除，歷史版本與驗證紀錄保持；目前仍使用 Codex 依賴工具取得 Runtime。

## v2.2.16 選路狀態與提交整理

已完成請求所有權、重試許可及保存契約整理，離線驗證、安全審查、原樣封存、封裝、main／標籤推送與正式 Release／公開 latest 核對均完成，本工作結案；結果由 [TEST_REPORT](TEST_REPORT.md) 維護，階段對照見[本輪紀錄](../archive/retired/docs/ROUTING_OWNERSHIP_v2.2.16_2026-11-09.md)。播放器／恢復延後；交付採離線方式，後續另獲授權的載入核對見下節，歷史功能窗口保持停止。

## v2.2.16 載入確認

使用者更新後的新載入身分與本次選路／提交重構接線確認已結案，結果見 [TEST_REPORT](TEST_REPORT.md#v2216-r1-載入身分與選路提交接線2026-11-09)。唯一自有分頁、domains 與觀察引用已清理，未重測未修改的播放、選單、設定及熔斷窗口。僅完成載入與初始化接線，不擴張為全部政策分支通過。驗收結案時先存本機；使用者其後要求提交推送本批文件，並授權往後完成已授權工作且通過檢查後主動提交推送，規則見 [AGENTS](../AGENTS.md#發行規則)。本次純文件交付不升版、封裝或發布。

## v2.2.15 模組歸屬整合

依批准計畫完成契約歸位、選路助手、控制器與測試功能分布；原 2,269 案及順序保留，完整 2,292 案通過。全部離線門檻、安全差異掃描、封裝、正式發布及公開 latest 核對已完成，此工作結案；實作對照見[本輪紀錄](../archive/retired/docs/MODULARIZATION_v2.2.15_2026-11-08.md)。本次離線交付不調整產品政策，交付時未啟動瀏覽器；後續另獲授權的載入確認見下節。

## v2.2.15 載入確認

使用者更新後的本版載入身分與模組初始化確認已結案，結果見 [TEST_REPORT](TEST_REPORT.md#v2215-r1-載入身分與模組初始化2026-11-09)。唯一自有分頁及觀察引用已清理；已通過且未修改的功能未重測。驗收結案時先只存本機，使用者其後明確要求提交並推送本批文件；本次不升版、不封裝或發布，歷史功能窗口保持停止。

## v2.2.14 全面清理

依批准計畫完成版本占位符、額外本機封存清單、舊工作歸檔及可重建快取清理；離線門檻、安全審查、正式發布與公開 latest 核對均已完成，結果見[原版完整報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2214-完整正文保存2026-11-09)。完整分類及保留理由見[清理報告](../archive/retired/docs/CLEANUP_v2.2.14_2026-11-08.md)。清理交付沒有調整產品政策，當時未啟動瀏覽器；該工作已結案，後續另獲授權的載入核對見下節，歷史功能窗口保持停止。

## 已結案與未啟動工作

使用者更新後另獲授權的 v2.2.14 載入身分核對已結案，完整本體／管理器／唯一實例／hooks 與清理結果見 [原版載入紀錄](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2214-載入身分驗證2026-11-08)。R1 工具受阻原判保留，R2 自主補驗完成；沒有活動中的自有分頁、斷點或觀察資源，不恢復歷史功能窗口。使用者已另行要求將這次六份驗收文件提交並推送 main；不升版、不封裝、不發布。

| 項目 | 目前狀態與下一步 |
| --- | --- |
| v2.2.13 九項改善及 R1–R5 | 產品與文件已交付；R5 受控真實 API→Vault changed-set 核心通過，同集合、晚到控制與自然 SDK 採用限制保持，見[原版完整報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-完整正文保存2026-11-08) |
| 播放判讀更正 | B1 與使用者人工操作可播放，R3 未建立播放缺陷；不啟動修補或重測 |
| v2.2.12 三頁／設定／刷新 | 已結案，不重測 |
| 提前重試自然研究 | 已完成並清理，原效用 FAIL 與現場效益未識別保持 |
| 提前重試後續研究 | 恢復／停滯段抑制的離線調查已完成，見本頁新研究與優先順序；窗口游標／通道分母及實機效用研究尚未啟動，正數 timeout 資格調整須另立方案 |
| 熔斷、Auto 與歷史瀏覽器工作 | 保持結案／停止；沒有活動中的自有瀏覽器或觀察資源 |

## 尚未解決的問題與證據缺口

<a name="v2139-驗收後待調查"></a>

| 編號／項目 | 現況與限制 |
| --- | --- |
| 正常進度被判為停滯 | v2.2.17 已修復並完成離線回歸；歷史樣本支持機制，但仍沒有逐筆實機因果或修後播放效益證明，詳見[新調查](../archive/retired/docs/RECOVERING_SUPPRESSION_v2.2.16_2026-11-10.md#結論與證據分層) |
| v2.2.13 R3 播放判讀 | 已更正：R3 只觀察到當時未播放，沒有測試正常點擊後仍失敗；B1 與使用者人工操作可播放，不登記為已確認播放缺陷。原黑畫面及取證限制保留，見[更正紀錄](../archive/retired/docs/BLACK_SCREEN_INVESTIGATION_v2.2.13_2026-11-08.md#使用者人工播放與判讀更正)；沒有啟動修補或新窗口 |
| CC39-R01：N05 卡頓 | 移除 Evolved 後未再現；舊取消請求發起者與卡頓根因未確認，不因一次正常窗口判已解決 |
| CC39-R02：HK04 | 合法備援恢復資格缺陷已修復；舊網站 emptied／loadstart 原因仍未知，修後未自然觸發恢復 |
| CC39-R03：香港供片 | 修前 01-05／01-01 仍有影片 timeout；01-03 新取證前提誤選而 INVALID。修後 01-05 video circuit-open、由其他 CDN 供片，不能以香港音訊 206 代算影片成功 |
| CC39-R04：playerReady | 使用者移除 Evolved 後未再觀察到；舊提示完整因果未確認，取消獨立重測 |
| 條件式行為與通道 | 剩餘 gate 缺口為封存的 P01 bounded prepare／P02 等待者交錯；普通自然正數 timeout 起播已有另輪證據。健康中段、家族排序、提前重試許可撤銷、HTTPDNS 與跨頁的實際分層見[研究覆蓋表](../archive/retired/docs/TODO_OPTIMIZATION_RESEARCH_v2.2.11_2026-11-07.md#五條件式覆蓋與證據分層)，不另開測試湊樣本 |
| 提前重試效用 | 原 FAIL 保留；[本輪自然研究](../archive/retired/docs/EARLY_RETRY_APPLICABILITY_RESEARCH_v2.2.12_2026-11-08.md#自然請求與逐層分母) 已確認觀察子集的正數 timeout 排除，但無介入樣本；交接成本、替代預測及因果收益仍未識別 |

這些是未解問題或證據缺口；上列提前重試新研究已結案，其他項目沒有因此啟動新實測或修復。可重現步驟、有效性、實際主機與清理結果集中於 TEST_REPORT 的歷史導覽及對應研究，不在此複製矩陣與通過數。

## 執行邊界

- v2.2.8 發行採離線交付，後續另獲授權的 R2 專項與原生校準亦已結案；v2.2.6、先前撤除及各版舊輪次維持原結案，自動結果與安裝實測分開。
- 瀏覽器只用 IAB＋Tampermonkey，同時一個自有測試分頁，保持靜音；其餘永久界線與已確認靜音方法見 [AGENTS](../AGENTS.md#使用者永久執行禁令)。
- 已通過項目不重測。新案例必須先凍結範圍、次數、硬截止、清理時間與可沿用證據；不繼承舊輪次剩餘預算或自動安排重跑。
- 原十二個五分鐘窗口、IR36、自然起因、BR-01 歷史矩陣及已撤銷 CDN 研究維持停止／結案，不隨工具恢復、文件整理或發布啟動。
- P01 bounded prepare／P02 真 gate 仍須使用者明確恢復要求及指定影片自然 pending gate 的新前提；不改網站 timeout、重設預算或反覆刷新製造條件。
- 過往輪次對控制中心入口／返回導覽的跳過決定保留；v2.2.6 R1 另獲授權的入口、三頁及重開結果依當輪紀錄，不將舊跳過限制套用為本輪未測，也不追加新的導覽測試。
- 不實作未授權的偏好記憶、提高探測頻率或其他平台擴展；舊採用否決與原 FAIL／INVALID 保留。

## 過往工作檢查點

清理前的完整工作正文、已結案長篇紀錄與停止決策保存在 [8f3cf2f 固定全文快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/8f3cf2fa4f92c67e2fb6a008a605a459c1d15b1b/docs/TODO.md)。本頁只保留目前工作、未啟動問題與必要相容入口，不把歷史待完成文字轉為新授權。

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

重構前的完整工作狀態可由 [1edfeaa 固定快照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/1edfeaa6ad7a6b9dabc7d81da3b4414c3a31ba78/docs/TODO.md) 還原；其中停止決策仍適用。

<details>
<summary>舊工作入口相容導引</summary>

<a name="v220-安裝版驗收範圍"></a>
<a name="v2-工作狀態與後續方向"></a>
<a name="現在的執行狀態"></a>

舊版的[驗收範圍](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TODO.md#v220-安裝版驗收範圍)、[工作方向](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TODO.md#v2-工作狀態與後續方向)及[執行狀態](https://github.com/YUIAOI7592/BiliCDN_TW/blob/6df9edacf8afa83ef4608fa0496d8d2e0ecf7cbb/docs/TODO.md#現在的執行狀態)保留固定原文；現行工作只看本頁開頭。

</details>

<a name="自動畫質與選路數學模型研究"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/8f3cf2fa4f92c67e2fb6a008a605a459c1d15b1b/docs/TODO.md#自動畫質與選路數學模型研究)。

<a name="auto-決策與換站收益校準"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/8f3cf2fa4f92c67e2fb6a008a605a459c1d15b1b/docs/TODO.md#auto-決策與換站收益校準)。

<a name="起播-cdn-多次切換逐步調查"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/8f3cf2fa4f92c67e2fb6a008a605a459c1d15b1b/docs/TODO.md#起播-cdn-多次切換逐步調查)。

<a name="文件整理2026-11-08"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/8f3cf2fa4f92c67e2fb6a008a605a459c1d15b1b/docs/TODO.md#文件整理2026-11-08)。

<a name="v2212-提前重試適用率研究"></a>

[原始紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/8f3cf2fa4f92c67e2fb6a008a605a459c1d15b1b/docs/TODO.md#v2212-提前重試適用率研究)。
