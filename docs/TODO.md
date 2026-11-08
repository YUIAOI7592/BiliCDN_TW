# 目前工作

現行版本 **v2.2.14**。工作與授權只在本頁維護；驗收結果見 [TEST_REPORT](TEST_REPORT.md)，歷史原判定見 [HISTORY](HISTORY.md)。

## v2.2.14 全面清理

依批准計畫完成版本占位符、額外本機封存清單、舊工作歸檔及可重建快取清理；正在完成最終離線驗證與公開交付。完整分類、保留理由與實際清理量見[清理報告](../archive/retired/docs/CLEANUP_v2.2.14_2026-11-08.md)。沒有調整選路、授權、熔斷、量測、重試或恢復政策，也沒有啟動瀏覽器。

## 已結案與未啟動工作

| 項目 | 目前狀態與下一步 |
| --- | --- |
| v2.2.13 九項改善及 R1–R5 | 產品與文件已交付；R5 受控真實 API→Vault changed-set 核心通過，同集合、晚到控制與自然 SDK 採用限制保持，見[原版完整報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#v2213-完整正文保存2026-11-08) |
| 播放判讀更正 | B1 與使用者人工操作可播放，R3 未建立播放缺陷；不啟動修補或重測 |
| v2.2.12 三頁／設定／刷新 | 已結案，不重測 |
| 提前重試自然研究 | 已完成並清理，原效用 FAIL 與現場效益未識別保持 |
| 提前重試後續研究 | 尚未啟動；先補窗口游標／通道分母，再釐清恢復與停滯段抑制；正數 timeout 資格調整須另立方案 |
| 熔斷、Auto 與歷史瀏覽器工作 | 保持結案／停止；沒有活動中的自有瀏覽器或觀察資源 |

## 尚未解決的問題與證據缺口

<a name="v2139-驗收後待調查"></a>

| 編號／項目 | 現況與限制 |
| --- | --- |
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
