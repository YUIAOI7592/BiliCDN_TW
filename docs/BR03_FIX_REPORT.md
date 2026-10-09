# BR-03 本機修復與驗證報告 — 2026-10-10

**後續發行狀態：** 使用者已授權直接發布更新，本修復正納入 v2.1.11。發布結果見 [最新版驗證報告](TEST_REPORT.md)；下方「未發布／未提交」保留 01:17 本機修復交付時的範圍，Tampermonkey 修復版仍待驗收。

**BR-03 本機修復完成、未發布。** 相同內容的 DASH 排列、畫質或編碼清單改變，現在以請求所屬 cid 優先判定；缺少 cid 時使用有界、順序無關的完整父目錄集合。真正換片仍同步撤銷舊授權與工作。本輪沒有提交、推送、升版、正式封裝或更新 Tampermonkey。

原始觀察與失敗證據保留於 [BR-03 調查](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md)；既有安裝版結果仍見 [v2.1.10 驗收](CHROME_v2.1.10_ACCEPTANCE.md)。本報告描述新的修復輪，不回寫原調查、Release 或已封存安全產物。

## 基準與交付

- 開始：2026-10-10 00:40:20（Asia/Taipei）。HEAD：`c836a17818cd4ae86195e41b1e1c0933cff8cab0`；設定版本：2.1.10。
- Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2；工具及依賴設定未變更。
- 保留開始時八份已修改文件，以及兩份未追蹤的 v2.1.10／BR-03 驗收文件。基準 patch、檔案雜湊及原文件備份獨立保存。
- 本機證據：`.work/functional-fixes/br03/2026-10-10-c836a17/`。包含 `baseline.json`、紅燈／綠燈 log、Chrome JSON／截圖、`RERUN.md`、安全報告指標與續行檢查點。這些私有證據不作正式測試輸入。

## 根因與實作

舊判定只看 DASH 第一個影片（缺少時第一個音訊）的父目錄。相同清單若把不同編碼目錄移到第一位，會誤當新內容，增加 epoch、清空 Vault 並重設 Runtime，使仍有效的音訊與非同步工作失效。

| 修復面 | 現行來源與行為 |
| --- | --- |
| cid 正規化 | [playurl-content.ts](../src-v2/domain/playurl-content.ts) 只解析既有 `isPlayurlApi` 接納的 URL，唯一一個 1～20 位 ASCII 十進位 cid，去除前導零；不轉成 Number。零、重複、空白、負數、小數及超長值均視為缺失。 |
| 私有介面 | [playurl-model.ts](../src-v2/domain/playurl-model.ts)、[ports.ts](../src-v2/application/ports.ts) 增加唯讀 `PlayurlRequestContext`，由 [PlayurlAdapter](../src-v2/adapters/playurl.ts) 的可選第四參數傳入控制器；既有三參數呼叫相容。 |
| 請求所有權 | [Fetch](../src-v2/adapters/fetch-hook.ts) 在等待前保存平台 Request.url 的 cid；[XHR](../src-v2/adapters/xhr-hook.ts) 從一次轉換的 URL 建立候選 metadata。BR-02 failed open 回復整份舊 metadata，同步成功重入使用新 metadata；所有 text／json getter 使用請求自己的 context。 |
| 內容週期 | [PlayurlController](../src-v2/application/playurl-controller.ts) 只允許 trusted-api 更新私有 cid／目錄基準；同物件防篡改與重複回應防護先執行。generation 改變清空基準。 |
| 真換片撤銷 | 順序維持 Session → Vault → Routes → generation／epoch 同步通知 Runtime → 新表示登記；起播預算不重開。Vault 仍是唯一 Native 授權來源，cid 不提供 URL 選路權限。 |

兩側有效 cid 相同時維持 epoch，即使清單完全換組；cid 不同則重設，即使路徑／音訊相同。首次 cid 與既有路徑對齊可沿用；已有基準但無法對齊則先重設。缺少 cid 的重疊回應保留已綁定 cid，缺少 cid 且不重疊的換片會解除舊綁定。

備援從所有 primary 經 `parseMediaUrl` 正規化後取完整父目錄，忽略主機、查詢與排列。兩側有影片只比較影片，兩側純音訊才比較音訊；型態改變或非空集合無交集便保守重設。無 cid 且完全沒有有效目錄不更新基準。重疊時合併歷史，支援完整清單 → 子集 A → 子集 B；影片上限 128、音訊 64，優先本次集合，再按固定字串排序填入舊項目，淘汰本身不增加 epoch。

cid 與目錄只在分頁記憶體使用，不讀取頁面全域／播放器／回應欄位猜測 cid，不進入診斷、持久資料或公開橋接。page-hint／player-MPD 不綁定 cid、不擴充基準、不觸發換片。schema 2、四個持久鍵、DASH 查詢字串、MP4／FLV 授權刷新及 Worker 不介入均維持原契約。

## 正式案例與修復前後結果

共新增 **43 個具名案例**，沿用已登記套件，未新增登記或依賴調查目錄。

| 案例來源／數量 | 覆蓋與重跑 |
| --- | --- |
| [content.ts](../tests-v2/regressions/functional-races/content.ts)：21 | `npm test -- orchestration`。原四契約、audio 身分、cid 相同／不同／首次／缺失恢復、子集、低信任、同物件防篡改、generation、正常／撤銷的恢復與 deferred 起播量測、診斷／持久資料隱私。 |
| [content-domain.ts](../tests-v2/regressions/functional-races/content-domain.ts)：5 | `npm test -- domain`。字串精度與 URL 接納、三目錄全部六種排列、協定相對 URL／簽名、兩種容量淘汰、無效基準。 |
| [xhr.ts](../tests-v2/regressions/functional-races/xhr.ts)：14 | `npm test -- native-transport`。Fetch 一次轉換與等待前 cid；XHR text／json failed open、重用、重複 getter、同步重入；十種缺失／不合法 cid 在兩種傳輸均不串錯身分。既有 BR-02 契約保留。 |
| [progressive-playurl.ts](../tests-v2/suites/progressive-playurl.ts)：3 | `npm test -- progressive-playurl`。MP4、FLV、混合格式：同 cid 六次完全換目錄不換 epoch，漸進式舊簽名仍撤銷，不同 cid 仍換片。 |

[runtime-fixture.ts](../tests-v2/support/runtime-fixture.ts) 可選擇注入 RangeProbePort，讓新增交錯案例使用真正 MeasurementController、FakeClock 與 deferred；資源由 testScope 管理，其他案例保留既有替身。

修改執行期前已保存：

- `red-orchestration.log`：原四個 BR-03 契約，2 通過／2 失敗，失敗斷言要求正確的 epoch／音訊身分。
- `red-expanded-orchestration.log`：擴充當時 31 個 orchestration 案例，18 通過／13 失敗。
- `red-native-transport.log`：103 個案例，89 通過／14 失敗，確認傳輸缺少 request context。

上述均為未修復來源的**預期失敗證據**，不算整套通過。測試開發中曾將 startup 提交錯誤期待為 affinity 變更；依現有契約改為 selectedHost／startup snapshot，沒有為迎合斷言修改執行期。

| 最後驗證 | 結果 |
| --- | --- |
| 分批套件 | domain 7、orchestration 33、native-transport 103、progressive-playurl 30、progressive-routing 20、progressive-transport 4、diagnostics 14，全部通過 |
| `npm run typecheck` | 來源與正式測試通過 |
| `npm run architecture` | 44 個執行期模組、無循環，通過 |
| `npm test` | 19 套件、382 個具名案例通過；0 fail／skipped／todo／cancelled |
| `npm run verify` | 型別、架構、382 案例、43 個非入口模組匯入純度、確定性建置、語法、v2-only、暫存封裝校驗通過 |
| `git diff --check`、文件連結、受審雜湊 | 通過。13 份 Markdown、222 個本機／同儲存庫連結、38 個錨點；14 個受審檔、68 個其他基準來源／測試檔及本版 5 個 Release 檔雜湊一致。結果存於 `final-checks.json`／`document-checks.json`；外站連結未重新抓取。 |

沒有 only／skip／todo／cancelled 留在正式完整執行。verify 只寫 dist／暫存封裝，沒有寫入 Release；文件交付後沒有再更動受審來源或正式測試。

## 獨立 Codex Security 差異審查

掃描 `a9c3fb49-d46b-4a8e-81ee-29856ab3e908` 已完成並封存，14 個變更來源／測試檔完整覆蓋，**0 個可報告安全發現、0 個待驗證候選**。獨立代理建立架構模型與執行 preflight，主代理逐檔檢查 cid 來源、Fetch／XHR 所有權、備援合併、舊授權撤銷、低信任污染及診斷／儲存投影。沒有候選進入驗證／攻擊路徑階段；不是宣稱另有執行中的候選驗證。

固定差異 digest：`codex-security-snapshot/v1:sha256:31543372cedbba943e0f4de533b3d34d68790794e4c471de11ee123284685033`。preflight 三項通過、無設定修改；Daybreak advisory 為 granted／Daybreak Blue。掃描在 2026-10-10 01:09:35（Asia/Taipei）封存。canonical report／manifest／findings／coverage／SARIF 位於本機 Codex Security scan store，本輪 `.work/.../SECURITY_SCAN.md` 提供精確連結；不手改 canonical 產物。

此為 BR-03 差異審查，不是全儲存庫無漏洞保證。cid 仍是關聯值，不是密碼學驗證；缺少 cid 時的父目錄交集是選定的啟發式，不能宣稱所有真實內容的目錄全球唯一。工具回報三個 thread 的彙總 token usage 為 10,196,183（其中 cached input 9,769,984、output 40,175），不是本修復新增 token 的精確成本；安全子目標另記錄 355,964 tokens、616 秒，兩者統計範圍不同，不相加。

## Chrome：來源隔離

真實 Chrome 154，使用當前修復來源打包、本機記憶體儲存與原生 Fetch／XHR。合成 API 先設定 Request 階段攔截，回填受控 JSON；不以替身取代瀏覽器 XHR。這不是 Tampermonkey 安裝版驗收。

| 有效完成輪 | 結果與證據 |
| --- | --- |
| BR-03 Fetch／XHR text／XHR json | **31／31 通過**。涵蓋不同／同目錄排列、音訊身分、真換片、cid 相同／不同、首次綁定、重複 cid 備援、子集、failed open 與同步重入；`chrome-br03-results.json`／`chrome-br03.png`。 |
| Request 攔截收據 | 65 次合成 API fulfill，0 unexpected、0 HTTPDNS 事件，未截斷；`chrome-br03-guard.json`。收據僅對應成功第二輪。 |
| BR-02 相容性對照 | **31／31 通過**，Blob 原生／攔截 XHR、例外、取消、gate、重入及轉換對照；`chrome-br02-results.json`／`chrome-br02.png`。最終輪 HTTPDNS 目標事件 0、未截斷、無未讀頁；`chrome-br02-guard.json`。 |

兩組結果皆記錄 `restored: true`。完成後清理 hooks、請求、Blob、監聽器、測試觀察器與攔截，關閉隔離頁並停止本次伺服器。沒有修改 Chrome 設定或停用其他腳本。

工具限制另列：首次沙盒 localhost 不能由 Chrome 存取，改用核對過的 host 本機伺服器。首輪 BR-03 因不支援的 heading-level locator 造成工具中斷而作廢；清理期間曾短暫移除攔截，因此**不對作廢輪宣稱完整的零外送收據**，僅採用重新載入後、先安裝攔截的完整成功輪。BR-02 轉場一度讀到 stale interception id，另以乾淨新輪重跑；該工具錯誤不算產品通過或失敗。

## Chrome：既有安裝版基本播放

只操作使用者指定的 [風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，使用既有安裝 v2.1.10；沒有安裝本次修復。各操作分開：

- 4K／2 倍速播放時間持續前進；暫停 32.879 秒，位置維持 1091.697004 秒，續播正常。
- 4K → 1080P 後，原生解碼高度 1080、readyState 4 且時間繼續前進。
- 獨立 seek 至 26:00：seeking → seeked 約 **2489 ms**，之後持續播放；先前另一次 21:00 seek 的即時取樣早於實際完成，不以該即時位置作成功證據。
- 恢復 4K 後，解碼高度 2160、readyState 4、無 media error，最後暫停在 1674.375 秒。測試觀察器已移除。

證據為 `chrome-site-basics.json` 與 `chrome-site-final.png`。本段短程未重現 BR-01，不能推論 BR-01 已修復，更不能作 BR-03 修復版已安裝的證明。

## 尚待驗收與續行

1. 本輪交付可審查的本機修改；發布、推送及升版另行安排。**Tampermonkey BR-03 修復版仍待安裝與驗收。**
2. 更新後記錄實際版本／產物，重跑同一 BR-03 矩陣與 BR-02 failed open 對照；同片播放、暫停、畫質切換、seek 分步驗證。只用指定風景影片。
3. BR-01 根因定位、真正 startup gate 交錯與 R04 完整影音故障隔離保持待辦，不因本次通過而結案。
4. 沒有有效 cid、也沒有共同路徑時，無法可靠證明同片，採保守重設。容量淘汰後已失去的目錄同樣不推測身分。
5. 本輪沒有新增同世代 API 逆序回應政策，沒有改 schema 2 或清空學習資料。

可重跑入口與安全清理步驟見本輪 `RERUN.md`；續行狀態見 `CHECKPOINT.md`／`checkpoint.json`。原始調查目錄保持唯讀，修復前失敗證據與最後通過結果分開保存。
