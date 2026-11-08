# v2.2.15 模組歸屬整合紀錄

基準：main／dc3b6f08ce6a09ffcb5a0009d803a9adad8d60ea，v2.2.14。此紀錄保存本次實作對照；目前工作狀態見 [TODO](../../../docs/TODO.md)，最終結果見 [TEST_REPORT](../../../docs/TEST_REPORT.md)。

## 固定基線

- 鎖定 Node 26.8.1、npm 11.19.0 與現有依賴；103 個執行期模組、372 條直接依賴（含型別），架構檢查無循環或分層違規。
- 十八套件／2,269 案完整基線通過，failed／skipped／todo／cancelled 均零；保存案例順序、名稱、參數展開及模組 SHA-256 於 `.work/modularization-v2215/`。
- 首次沙箱執行有十個工具案例無法在暫存目錄建立 Git 儲存庫；產品案例通過。相同未修改來源取得必要暫存寫入權限後，全部案例通過；環境限制不改判為產品問題。
- 本次只作離線實作與交付，不啟動瀏覽器，不恢復既有停止窗口。

## 責任與相容邊界

保留六層及入口組合：RouteCoordinator 擁有路線與提交，MeasurementController 擁有探測，RecoveryController 擁有重載，Observer 擁有可信操作，Vault 擁有 Native 精確授權。助手僅有具名窄能力；不新增依賴、設定、持久鍵、診斷或週期工作。

依序完成契約歸位、選路助手、量測／恢復／播放器／XHR 熱點、功能測試分布及完整交付。每階段獨立提交；既有案例名稱、參數、順序、有效斷言與副作用保持。完成對照及風險驗證於實際完成後追加。

## 契約與歸屬階段

完成四組應用功能與三組適配器歸位；共用模型拆回所屬功能，起播／還原／停滯政策各自歸位，計時及探測微型模型併入純政策。Runtime／Lifecycle 的依賴型別留在本地，原測試改由現有建構簽章取得窄型別，不新增產品接口。

型別、架構、匯入純度及唯讀格式通過；十八套件／2,273 案通過，原 2,269 案名稱與參數無遺失，新增四個功能私有邊界拒絕契約。既有架構案例名稱保留，實際唯一所有者及偽同名檔案位置配合新目錄核對。

歷史閱讀版只調整已登記 URL，連至重構前固定提交；不可變報告原文保持，新增來源搬移對照。九份列入舊清理保護的產品原始碼從固定基準逐檔保存至 `archive/retired/originals/v2.2.14-modularization/`，原 bytes／SHA-256 不變，舊清理保護改核對這些 `.snapshot` 原件，並非取消保護。Release、安全、原始證據與三份既有日誌正文均未回寫。

## 選路助手階段

請求分類、輸出歸因與 URL 物化合併為 request-policy。RetryEvidence 私有帳本保留每請求去重、32 筆界線、60 秒有效期、抑制引用計數與跨 reset 的抑制生命週期；所有保存資格、候選檢查、許可與提交仍在 Coordinator。純 route-projection 只組裝數字與摘要，現有外部讀取與前後所有權重驗順序不變。

新增兩個回歸保護帳本與投影，先保存缺少抽取模組的拒絕結果，再實作。architecture／imports／application／native-routing／progressive-routing／control-center 對應檢查通過；原案例不刪減。容量缺值、樣本過期、重入快照及三頁既有契約由原套件一併覆蓋。

## 量測與恢復熱點

量測的起播結果資格、決勝及健康探測結果分類集中於 startup-evaluation；需求與授權讀取、探測、鎖、三秒窗口及取消仍由 MeasurementController 執行，沒有提前快取跨回呼的資料。新增短快取／新速度資格及同速逆序完成兩個回歸；application 841 案及 measurement-state 135 案通過，另增加量測私有邊界拒絕契約。

恢復的舊／目標倍率可達區間、已落地位置驗證、已知錯位及後續進度界線併入 restore-policy。時鐘仍在原條件成立的位置讀取；Controller 保留 token、還原階段、派送及一次補正。新增四案保護一／兩倍、未知讀值不取得補正與不讀時鐘，以及一秒漂移邊界；domain 111 案與 application 841 案通過。

## 播放器與原生適配器

PlayerInputBindings 集中可信輸入篩選、播放失效／鍵盤／指標釋放註冊與原順序清理；狀態、手勢及 SDK 回呼仍由 Observer 管理，SDK 描述子恢復已與安全呼叫共置。新增兩案核對合成輸入拒絕、自有 listener 及清理中新增 listener 的所有權。Node 原生 EventTarget 的 boolean capture 移除差異由既有模型的正規化方式抽為窄資源，不改產品 capture 行為。型別、adapters 212 案與 application 841 案通過；不是瀏覽器原生輸入證據。

XHR 原生準備抽至 xhr-dispatch，仍逐步核對 metadata／readyState，重開最多兩次並採網站最新 timeout。當筆進度、計時凍結及一次終止併入 xhr-request；Hook 保留唯一 metadata 索引、原生 send 接受與安裝／還原。新增兩案核對 setter 重入、最新 timeout 及兩次準備界線；adapters 214 案與 native-transport 222 案通過。

## 測試分布對照

原十八套件保持選擇器及案例註冊順序。14 個大型入口改為明確匯入，原內嵌案例拆為 38 個功能檔；完整情境仍獨立建立，只共用窄資源。98 份階段前回歸（93 份基線檔及 5 份本輪新增助手回歸）按用途搬移如下；版本及事故名稱不改。

| 舊路徑（tests-v2/ 下） | 新路徑（tests-v2/ 下） |
| --- | --- |
| `regressions/archive.ts` | `cases/tooling/archive.ts` |
| `regressions/cc39-integration.ts` | `cases/playback/cc39-integration.ts` |
| `regressions/documentation.ts` | `cases/tooling/documentation.ts` |
| `regressions/functional-races/adapter-controls.ts` | `cases/playback/adapter-controls.ts` |
| `regressions/functional-races/br01-followthrough.ts` | `cases/playback/br01-followthrough.ts` |
| `regressions/functional-races/br01-play-intent.ts` | `cases/playback/br01-play-intent.ts` |
| `regressions/functional-races/br01-player.ts` | `cases/playback/br01-player.ts` |
| `regressions/functional-races/br01-reload-controls.ts` | `cases/playback/br01-reload-controls.ts` |
| `regressions/functional-races/br01.ts` | `cases/playback/br01.ts` |
| `regressions/functional-races/br06.ts` | `cases/playback/br06.ts` |
| `regressions/functional-races/br08-player.ts` | `cases/playback/br08-player.ts` |
| `regressions/functional-races/br08.ts` | `cases/playback/br08.ts` |
| `regressions/functional-races/br09.ts` | `cases/playback/br09.ts` |
| `regressions/functional-races/content-domain.ts` | `cases/playurl/content-domain.ts` |
| `regressions/functional-races/content.ts` | `cases/playurl/content.ts` |
| `regressions/functional-races/cr-measurement-errors.ts` | `cases/routing/measurement/cr-measurement-errors.ts` |
| `regressions/functional-races/cr-measurement-lifecycle.ts` | `cases/routing/measurement/cr-measurement-lifecycle.ts` |
| `regressions/functional-races/cr-routing.ts` | `cases/routing/cr-routing.ts` |
| `regressions/functional-races/cr-startup.ts` | `cases/routing/measurement/cr-startup.ts` |
| `regressions/functional-races/cr-xhr-fixture.ts` | `cases/transport/cr-xhr-fixture.ts` |
| `regressions/functional-races/cr-xhr-headers.ts` | `cases/transport/cr-xhr-headers.ts` |
| `regressions/functional-races/cr-xhr-send-conversion.ts` | `cases/transport/cr-xhr-send-conversion.ts` |
| `regressions/functional-races/measurement-metadata.ts` | `cases/routing/measurement/measurement-metadata.ts` |
| `regressions/functional-races/navigation.ts` | `cases/playback/navigation.ts` |
| `regressions/functional-races/player-convergence.ts` | `cases/playback/player-convergence.ts` |
| `regressions/functional-races/recovery.ts` | `cases/playback/recovery.ts` |
| `regressions/functional-races/rescue-goals.ts` | `cases/playback/rescue-goals.ts` |
| `regressions/functional-races/rescue-position.ts` | `cases/playback/rescue-position.ts` |
| `regressions/functional-races/rescue-recovery.ts` | `cases/playback/rescue-recovery.ts` |
| `regressions/functional-races/rescue-runtime.ts` | `cases/playback/rescue-runtime.ts` |
| `regressions/functional-races/rescue-sustained.ts` | `cases/playback/rescue-sustained.ts` |
| `regressions/functional-races/rescue-timing.ts` | `cases/playback/rescue-timing.ts` |
| `regressions/functional-races/restore-closed-loop.ts` | `cases/playback/restore-closed-loop.ts` |
| `regressions/functional-races/restore-ownership.ts` | `cases/playback/restore-ownership.ts` |
| `regressions/functional-races/routing-convergence.ts` | `cases/routing/routing-convergence.ts` |
| `regressions/functional-races/routing-fixture.ts` | `cases/routing/routing-fixture.ts` |
| `regressions/functional-races/routing-modularization.ts` | `cases/routing/routing-modularization.ts` |
| `regressions/functional-races/routing.ts` | `cases/routing/routing.ts` |
| `regressions/functional-races/runtime.ts` | `cases/playback/runtime.ts` |
| `regressions/functional-races/startup-abort.ts` | `cases/routing/measurement/startup-abort.ts` |
| `regressions/functional-races/up141-backups.ts` | `cases/routing/up141-backups.ts` |
| `regressions/functional-races/up141-probe.ts` | `cases/routing/measurement/up141-probe.ts` |
| `regressions/functional-races/up141-start.ts` | `cases/routing/measurement/up141-start.ts` |
| `regressions/functional-races/visibility-ownership.ts` | `cases/playback/visibility-ownership.ts` |
| `regressions/functional-races/xhr-response-convergence.ts` | `cases/transport/xhr-response-convergence.ts` |
| `regressions/functional-races/xhr.ts` | `cases/transport/xhr.ts` |
| `regressions/player-restore-ownership.ts` | `cases/playback/player-restore-ownership.ts` |
| `regressions/player-restore-readback.ts` | `cases/playback/player-restore-readback.ts` |
| `regressions/project-config.ts` | `cases/tooling/project-config.ts` |
| `regressions/recovery-restore-controller.ts` | `cases/playback/recovery-restore-controller.ts` |
| `regressions/up141-api.ts` | `cases/playurl/up141-api.ts` |
| `regressions/up141-retry-policy.ts` | `cases/routing/up141-retry-policy.ts` |
| `regressions/up141-retry-transport.ts` | `cases/transport/up141-retry-transport.ts` |
| `regressions/up141-test-release.ts` | `cases/tooling/up141-test-release.ts` |
| `regressions/upstream-comparison.ts` | `cases/tooling/upstream-comparison.ts` |
| `regressions/v220-settings-policy.ts` | `cases/state/v220-settings-policy.ts` |
| `regressions/v220-settings.ts` | `cases/state/v220-settings.ts` |
| `regressions/v2211-circuit-domain.ts` | `cases/state/v2211-circuit-domain.ts` |
| `regressions/v2211-circuit-routing.ts` | `cases/routing/v2211-circuit-routing.ts` |
| `regressions/v2211-circuit-state.ts` | `cases/state/v2211-circuit-state.ts` |
| `regressions/v2212-evaluation.ts` | `cases/tooling/v2212-evaluation.ts` |
| `regressions/v2212-route-retirement.ts` | `cases/routing/v2212-route-retirement.ts` |
| `regressions/v2213-health-controller.ts` | `cases/routing/measurement/v2213-health-controller.ts` |
| `regressions/v2213-health-routing.ts` | `cases/routing/v2213-health-routing.ts` |
| `regressions/v2213-meta.ts` | `cases/state/v2213-meta.ts` |
| `regressions/v2213-native-sources.ts` | `cases/playurl/v2213-native-sources.ts` |
| `regressions/v2213-policy.ts` | `cases/routing/v2213-policy.ts` |
| `regressions/v2213-restriction-state.ts` | `cases/state/v2213-restriction-state.ts` |
| `regressions/v2215-measurement.ts` | `cases/routing/measurement/v2215-measurement.ts` |
| `regressions/v2215-player-bindings.ts` | `cases/playback/v2215-player-bindings.ts` |
| `regressions/v2215-restoration.ts` | `cases/playback/v2215-restoration.ts` |
| `regressions/v2215-routing.ts` | `cases/routing/v2215-routing.ts` |
| `regressions/v2215-xhr.ts` | `cases/transport/v2215-xhr.ts` |
| `regressions/v226-api-order.ts` | `cases/playurl/v226-api-order.ts` |
| `regressions/v226-demand.ts` | `cases/routing/v226-demand.ts` |
| `regressions/v226-flow.ts` | `cases/playback/v226-flow.ts` |
| `regressions/v226-http-status.ts` | `cases/transport/v226-http-status.ts` |
| `regressions/v226-interleavings.ts` | `cases/routing/v226-interleavings.ts` |
| `regressions/v226-monitor.ts` | `cases/playback/v226-monitor.ts` |
| `regressions/v226-recovery.ts` | `cases/playback/v226-recovery.ts` |
| `regressions/v226-routing.ts` | `cases/routing/v226-routing.ts` |
| `regressions/v226-startup.ts` | `cases/routing/measurement/v226-startup.ts` |
| `regressions/v226-ui-state.ts` | `cases/ui/v226-ui-state.ts` |
| `regressions/v227-capacity-ui.ts` | `cases/ui/v227-capacity-ui.ts` |
| `regressions/v227-completion-owner.ts` | `cases/routing/v227-completion-owner.ts` |
| `regressions/v227-completion.ts` | `cases/routing/v227-completion.ts` |
| `regressions/v227-evaluation.ts` | `cases/tooling/v227-evaluation.ts` |
| `regressions/v227-evidence-state.ts` | `cases/state/v227-evidence-state.ts` |
| `regressions/v227-evidence.ts` | `cases/state/v227-evidence.ts` |
| `regressions/v227-route-owner.ts` | `cases/routing/v227-route-owner.ts` |
| `regressions/v227-routing.ts` | `cases/routing/v227-routing.ts` |
| `regressions/v227-startup.ts` | `cases/routing/measurement/v227-startup.ts` |
| `regressions/v229-evidence-state.ts` | `cases/state/v229-evidence-state.ts` |
| `regressions/v229-measurement.ts` | `cases/routing/measurement/v229-measurement.ts` |
| `regressions/v229-playback-facts.ts` | `cases/playback/v229-playback-facts.ts` |
| `regressions/v230-evaluation.ts` | `cases/tooling/v230-evaluation.ts` |
| `regressions/v230-policy.ts` | `cases/routing/v230-policy.ts` |
| `regressions/v230-startup.ts` | `cases/routing/measurement/v230-startup.ts` |

測試定義檢查新增執行期靜態匯入追蹤，保留具名案例、拒絕 only 與空套件的原規則；三個薄入口負向／正向案例通過。歷史連結保留日誌全文，新來源例外採固定提交的完整前綴證明；三個新增案例驗證追加不能擴大、原文修改及不可讀提交均拒絕。已搬移閱讀副本只調整登記過的 URL，原快照與不可變文件保持。

## 功能分布階段完成（2026-11-09）

完整十八套件／2,292 案通過，原 2,269 案的名稱、參數展開與相對註冊順序逐項零遺失。新增 23 案為五個架構、十二個助手／純驗證及六個工具契約；不是瀏覽器窗口。型別、107 個模組架構與匯入純度、文件及公開封存檢查通過。來源閱讀副本只改登記的 URL；晚期追加日誌由 dc3b6f0 固定全文與雜湊證明，不改原文。

## 最終離線核對

固定 Node 26.8.1／npm 11.19.0，v2.2.15 verify 已實際通過完整十八套件／2,292 案、可重現建置、語法、v2-only／禁止標記及暫存封裝。公開封存 509 項與 128 個不變證明、本機 11,922 檔通過。完整原 2,269 案及三份日誌在本輪前的全文前綴、上一版完整報告與五份 Release 原件逐項核對保持。

重新量得 107 個執行期模組、445 條直接依賴（包含型別及重複匯入邊），基線為 103／372；型別歸位增加明確直接匯入，沒有以檔案或依賴數下降宣稱收益。RouteCoordinator 現為 2,798 行，計畫／選擇的高耦合狀態仍保留。可確認成果是功能契約歸位、單消費者轉接撤除、重試帳本與純投影／驗證責任集中；不宣稱未量測效能改善。正式腳本 535,486 bytes／SHA-256 96bff42ad7ac5deb9b500605b244af3598a6f67b7f93bf85d6c26992ff0b8cef。

## 安全差異結案

Codex Security 掃描 06be0f32-1aa1-4cdf-b535-45599ef32046 固定 dc3b6f0→60870f9，291 個來源差異項目與額外定義檢查支援均完成，canonical 已封印讀回；漏洞、未結案候選與 deferred 為零。三組獨立差異檢查與父代理工具檢查覆蓋原生派送、精確授權、重入／取消與唯一所有者；不是安裝版驗收。工具計量及範圍由最新版 TEST_REPORT 保存，完整 canonical 由本機 Codex Security 管理。

## v2.2.15 公開交付（2026-11-09）

發行提交 3a90b6c，main／標籤與正式唯一腳本附件已核對；精確公開 latest 實際 GET 為 v2.2.15／535,486 bytes／SHA-256 96bff42ad7ac5deb9b500605b244af3598a6f67b7f93bf85d6c26992ff0b8cef。五項本機產物與提交位元組一致；發布前發現報告行尾轉換，依既有 Release raw 規則保留原封裝 bytes 後才推送。公開結果更新只用後續文件提交，不移動標籤或回寫 Release。沒有啟動瀏覽器或改動已結案功能窗口。
