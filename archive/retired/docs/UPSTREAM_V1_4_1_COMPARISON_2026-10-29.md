# 原作者 v1.4.1 與 v2.1.36 來源比較 — 2026-10-29

本輪依使用者要求下載保存原作者 v1.4.1，對照本專案 v2.1.36。結論是有可確認的 API 涵蓋差異，以及值得評估的量測方法；不能由原作者的版本號或模擬成績判定整體播放效果優於 v2。這是來源與有限離線函式比較，沒有執行網站播放、安裝更新或完整安全掃描。

## 固定輸入與保存

| 項目 | 本輪固定值 |
| --- | --- |
| 原作者 | jiyunshi，MIT |
| 上游提交 | [b32f949d216dc92cd1efa0b0d023f650b126fcb8](https://github.com/jiyunshi/Bilibili-CDN-TW/commit/b32f949d216dc92cd1efa0b0d023f650b126fcb8)，台灣時間 2026-10-26 00:44:30 |
| 保存原件 | [BiliCDN_TW_1.4.1.original.user.js](../../../baseline/BiliCDN_TW_1.4.1.original.user.js)，356,597 bytes |
| SHA-256 | `ad57b6fcbe60c126e15214631e63128adaf2b680aa7ebaa2cccdd91e720e4c51` |
| Git blob | `1a3a15b31ef5892b9d088093176d78f1d5ad0a8c`，與 GitHub Contents API 一致 |
| 發行下載核對 | 本輪另讀取 Greasy Fork 公開下載，完整位元組與固定 GitHub 原件一致 |
| 本專案提交 | `21322e2d38e6f7e2c1f066abc22591d61afb1eb1`，產品 v2.1.36 |
| v2 發行本體 SHA-256 | `3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7` |
| v2 來源核對 | 發行 BUILD_MANIFEST 中全部 67 個 src-v2 輸入雜湊與本輪來源一致 |

來源 URL、UTC 核對時間、下載雜湊及八個函式案例保存在 [provenance.json](../../../baseline/BiliCDN_TW_1.4.1.provenance.json)。新原件使用獨立 [SHA256SUMS](../../../baseline/BiliCDN_TW_1.4.1.SHA256SUMS.txt)；原 v1.3.4 原件與其校驗清單保持原樣。v1.4.1 本身有不只一筆提交，因此本輪以完整提交與本體雜湊固定輸入。

## 從原 v1.3.4 新增的方向

對既有 v1.3.4 原件執行 `git diff --no-index --numstat`，得到新增 1,148 行、移除 610 行；包含註解與整理，不能當成功能數或效能指標。原作者的 [固定提交 CHANGELOG](https://github.com/jiyunshi/Bilibili-CDN-TW/blob/b32f949d216dc92cd1efa0b0d023f650b126fcb8/CHANGELOG.md) 記載：

- v1.3.5～1.3.6 調整量測偏移、評分、香港候選與斷網對照，讓已有實測證據的白名單優先供片。
- v1.3.7 補上相對 API URL，處理換片、畫質與音軌切換的誤判。
- v1.4.0 加入起播競速、慢片段提前逾時、兩個 OGV API、機房分散，並移除 Worker 攔截。
- v1.4.1 擴充診斷與修正未量測備援排序。

以下結論另核對兩邊實作，不直接把上述修復套用為 v2 的缺陷。

## 主要行為差異

| 項目 | 原作者 v1.4.1 | 本專案 v2.1.36 | 比較判斷 |
| --- | --- | --- | --- |
| 一般 API 相對 URL | 先正規化，再辨識 API | isPlayurlApi 接受明確 base；Fetch／XHR 入口使用頁面基底 | 兩邊都辨識一般 playurl 的 `//` URL，無須照搬舊修復 |
| 番劇 API | 辨識 `/ogv/player/playview` 與 `/ogv/player/pre/check/drm` | 路徑規則只有 `/player/.*playurl` | 確認的入口涵蓋差異，優先評估補齊 |
| 資料巢狀結構 | 處理 data.video_info.dash | PlayurlAdapter 已遍歷 data／result／video_info | v2 主要差異在 API 入口；解析器並非完全不支援該結構 |
| 香港候選 | 有 cn-hk-eq-01-03／05／01 三台 | Catalog 11 台、4 台預設不可用，不含上述三台 | 是候選池差異；尚未驗證使用者網路上的新節點效益 |
| 起播探測 | Akamai 且 Range 至少 64 KiB 才規劃雙線競速；依路徑去重，最多保留 200 筆；最多 256 KiB、1.2 秒；先完成或到期比較收到量 | 每分頁一次共用窗口、最多三候選、3 秒；依既有證據使用 16／256／512 KiB，等待全部完成或期限，再按有效吞吐選擇 | v2 並非先完成即釋放；值得量測等待尾端的成本，但不能直接縮成 1.2 秒或改成雙發 |
| 健康主動量測 | 最短冷卻 90 秒；384／768 KiB，3 秒；有大小資訊時跳過前 1 MiB，64 KiB 對齊隨機取點 | 冷卻 10 分鐘，最多三候選；384／768 KiB，3 秒；Range 固定從 0 開始 | 檔頭快取可能使樣本偏樂觀，是量測設計疑點；本輪沒有量得 v2 的實際偏差 |
| 探測回應資格 | 起播與吞吐探測接受 206 或其他成功狀態；這兩個 fetch 沒有指定拒絕轉址 | 主動探測拒絕轉址，要求直接同主機 HTTPS 206 | 評估偏移／起播方法時仍須保留 v2 的資格檢查 |
| 排名 | EWMA、8 分鐘吞吐數值衰減、分段餘裕獎勵、延遲／抖動／失敗懲罰；起播與備援不含探索加分 | 每種類最多 12 樣本、24 小時期限；單樣本乘 0.7、雙樣本取較低值、更多樣本取加權下四分位；1.35 倍餘裕，健康親和保持 | 演算法不同；v2 沒有上游「2 倍即封頂」的同一公式問題，不能用上游評分替換證據政策 |
| 被動量測 | 同主機累積 1 MiB 或 15 秒，減少小片段瞬時速度影響 | 完成傳輸依影片／音訊分開存證據，有 64 KiB 吞吐門檻 | 可研究樣本偏差，不能共用影片／音訊樣本或直接移植聚合 Map |
| 慢片段補發 | XHR 已下載至少 1.5 秒、緩衝低於 6 秒且下載跟不上需求時，提早設 timeout；80% 以上不動；同主機 8 秒、全域 30 秒最多三次 | 緩衝候選只作診斷；沒有此套 XHR 提前逾時機制 | 這是新的傳輸控制能力，不能當作診斷小修。此前採用否決仍有效 |
| 真正停滯 | readyState 小於 3 且緩衝不足 1 秒，連續約 2／3 tick 才換路；有 seek／切畫質保護 | 依實際時間／影格進度及操作所有權；一般停滯 6 秒備援、12 秒重載，長 seek 為 15／30 秒，重載後 15 秒期限 | 處理範圍不同，不能只比較秒數說誰恢復較快 |
| 核心恢復 | 主要調整路線與促使下載器重試，未見 v2 等價的自有核心重載／位置倍速還原流程 | RecoveryController 擁有重載、位置與倍速原生確認、可信操作撤銷及有限補正 | v2 多處理一類失效核心問題；本輪未取得兩版真實救援優劣證據 |
| 備援分散 | 最多兩條生成備援；以 BCache 主機前綴區分機房，已量測的異機房優先，缺證據時仍保留異機房退路 | Catalog 最多五個不同主機備援；沒有地理／機房分組 | 不同主機不等於不同機房；若納入香港節點，須一起評估群組及證據排序 |
| 診斷 | 補入節點實測、播放狀態、停滯／補發／競速歷史，較易直接閱讀 | 已有型別化事件、路線排名、恢復階段、bufferTrend v6、事故紀錄及有界輸出 | 可參考摘要呈現；不能以「原作者新增診斷」推論 v2 缺少相同能力 |
| Worker | v1.4.0 起移除攔截 | 現行產品禁止讀取、包裝或取代 Worker | 方向一致，沒有移植需求 |

上游還加入本機斷網對照與死節點複查；v2 的主動量測失敗不建立播放斷路器，播放傳輸的失敗另由有期限的證據政策處理。兩者的故障模型不同，不能把上游針對「誤判 30 天」的修復直接當成 v2 缺陷。

## 可執行確認的 API 差異

離線只執行原作者已核對雜湊的三段辨識宣告，使用固定 URL／location；v2 直接匯入純 catalog 模組。沒有啟動完整腳本、DOM hooks、媒體網路或計時器。八項結果全部符合下表，詳細輸入見 provenance。

| 輸入 | v1.4.1 | v2.1.36 |
| --- | --- | --- |
| 一般 playurl，完整 HTTPS／省略協定各一案 | true／true | true／true |
| OGV playview，完整 HTTPS／省略協定各一案 | true／true | false／false |
| OGV pre/check/drm，完整 HTTPS／省略協定各一案 | true／true | false／false |
| 無關 API、無關主機各一案 | false／false | false／false |

v2 的 Fetch 與 XHR 都先經此辨識，只有通過才走 trusted-api 的資料轉換。故可確認這兩個端點目前不走該 API 改寫入口；這不代表每支番劇必然播放失敗，其他頁面提示或媒體攔截路徑仍可能提供部分處理。

補齊前應以端點、主機、資料分支及內容週期契約界定行為；尤其 pre/check/drm 可能提供片頭資料，須核對它與正片／預取回應的順序，不能只把名稱加入寬鬆正規表示式。

## 原始碼核對位置

| 主題 | 上游原件行號與識別字 | v2 來源 |
| --- | --- | --- |
| API／香港節點 | 112～172：PLAYURL_PREFIXES、isPlayUrlApi、PREFERRED_CDN_LIST | [catalog.ts](../../../src-v2/domain/catalog.ts)、[playurl.ts](../../../src-v2/adapters/playurl.ts)、[fetch-hook.ts](../../../src-v2/adapters/fetch-hook.ts)、[xhr-hook.ts](../../../src-v2/adapters/xhr-hook.ts) |
| 評分／被動證據 | 690～918：recordCdnThroughput、notePassiveThroughput、getCdnHealthScore | [evidence.ts](../../../src-v2/domain/evidence.ts)、[routing.ts](../../../src-v2/domain/routing.ts)、[route-coordinator.ts](../../../src-v2/application/route-coordinator.ts) |
| 備援 | 2032～2075：buildBackupUrls、cdnSiteGroup | [player-output-plan.ts](../../../src-v2/domain/player-output-plan.ts) |
| 起播 | 3024～3114：StartupRace | [measurement-controller.ts](../../../src-v2/application/measurement-controller.ts) 的 #runStartup／#probeStartup |
| 探測 | 3501～3665：pickProbeOffset、probeCdnThroughput | [range-probe.ts](../../../src-v2/adapters/range-probe.ts) |
| 慢片段／停滯 | 2616～2620、4449～4515、4868～4888：_forceTimeout、maybeHedgeSlowSegment、starving | [player-monitor.ts](../../../src-v2/application/player-monitor.ts)、[recovery-controller.ts](../../../src-v2/application/recovery-controller.ts) |
| 診斷 | BiliCDN.report／buf／diag、recentHedges、StartupRace.history | [recorder.ts](../../../src-v2/diagnostics/recorder.ts)、[report.ts](../../../src-v2/diagnostics/report.ts) |

## 評估次序與驗證限制

1. 優先評估兩個 OGV 端點：目前有來源級可重現差異，且 v2 已具備相關巢狀解析。先補對照契約，再界定是否實作。
2. 其次研究探測偏移及起播等待：明確比較冷／熱樣本、檔案大小界限、無效 Range、取消、1／2 倍播放及額外流量；保留 Vault 身分、同主機 206、共用預算與前景資格。
3. 香港節點與機房備援一併評估：原作者單一網路的結果只提供候選線索。使用者網路、Auto、音訊／影片、簽名與長時間穩定性尚無本輪證據，既有停止的 CDN 研究不自動恢復。
4. 慢片段補發維持研究項目：上游以 XHR 在途 loaded／total 及 timeout 為介入入口；v2 的完成傳輸與唯讀候選不能提供等價控制證據。須另行設計取消、網站重試、操作所有權、音視訊隔離及清理，再評估收益。

原作者將慢片段補發的自然救援效果列為尚未實測，模擬改善不能換算成本輪網站改善；手動 hedgeTest 也不能代替自然故障證據。本輪沒有重跑上游完整測試、效能模擬、v2 全套契約或安裝版驗收。既有 `compare:upstream` 固定使用 v1.3.4／v2.1.27，本輪沒有把它的歷史結果重標為新版本比較。

本輪以 Node v26.12.1 完成八項離線函式斷言及來源雜湊核對；`node --check` 通過上游完整原件語法。這不是專案指定 Node v26.8.1 下的發布驗證。文件與封存結案檢查另記於 [維護日誌](DOC_MAINTENANCE_HISTORY.md#2026-10-29原作者-v141-保存與來源比較)。
