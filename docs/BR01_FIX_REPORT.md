# BR-01 修復交付 — v2.1.13／2026-10-10

基準 v2.1.12／c924b0216fe0a8f7a624f391d44b36660daca433，保留原未提交調查文件。**A／B／C 本機修復、正式契約、verify、安全差異及 Chrome 來源隔離完成；發布正在執行，實際新版安裝版待驗收。** 本文後續記錄發布／安裝讀回，不回寫原 [調查](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) 或歷史 Release。

## 行為及來源對照

Auto 是主要場景，不強制畫質、不變更網站 ABR，正常降解析度不列缺陷。每秒監控在時間達標後的第一個合資格 tick 動作：15 秒最多一次合法 video 備援，30 秒最多一次核心重載，重載後 15 秒沒有進度則失敗退出。保留既有重載總額、90 秒 breaker、死核心／冷起播 4 秒及長暫停意圖門檻，不重開起播 gate 預算。

| 項目 | 修復及精確入口 | 主要正式契約 |
| --- | --- | --- |
| A：seeking 無限寬限 | [PlayerMonitor](../src-v2/application/player-monitor.ts#L163) 單一停滯段；網站 retry／Auto 改表示重綁最新 video 請求但保留起點及額度 | br01.ts 的 A、exact 15/30/15 boundaries、website target adjustments、dragging and hidden |
| B：初始化核心無限意圖 | [RecoveryController](../src-v2/application/recovery-controller.ts#L165) 普通活核心等待也有 30 秒上限，重載後 15 秒終止並釋放 token | B、reload rejection、missing legal authority、no retry after terminal failure |
| C：寬高誤標恢復 | [RecoveryController](../src-v2/application/recovery-controller.ts#L104) 分離核心存在與實際進度，兩次連續有效採樣才 recovered | C、two genuine progressing samples、time jump without new frames |
| 操作／核心所有權 | [PlayerAdapter](../src-v2/adapters/player.ts#L34) 數字身分／修訂，內部 seek／reload 標記；[RecoveryController](../src-v2/application/recovery-controller.ts#L248) 每個副作用及非同步提交重查 | user seek 到 0、rate command、同步 reset／新操作、外部／自有核心替換、late play rejection |
| 路線／影音隔離 | [RouteCoordinator](../src-v2/application/route-coordinator.ts#L185) 唯讀資格；[Runtime](../src-v2/application/runtime-controller.ts#L52) 僅 video 備援建立核心意圖；[entry](../src-v2/entry.ts#L47) 注入真可見性／資格 | policy revocation、既有 R01／R04／BR-03 orchestration |

有效進度需非 seeking／paused／ended／mediaError、影片時間前進大於 0.05 秒，可取得影格數時還須有新影格。首次採樣、seek 位置跳躍、緩衝／尺寸不算。第一個有效進度停止救援時鐘，RecoveryController 留有界確認窗口等第二次；不在 play 呼叫後直接宣告成功。

新可信使用者操作、拖曳、真 hidden、pause／ended／error、停用、對照或生命週期失效停止本段。新 seek 從新目標開始；網站自行改目標撤銷舊還原但不延長原段。重載／seek／rate／play 前重查當前請求、授權、政策及操作；已開始的網站請求不由腳本取消或重送。

## 測試及失敗紀錄

正式案例在 [br01.ts](../tests-v2/regressions/functional-races/br01.ts)（application，22 個）與 [br01-player.ts](../tests-v2/regressions/functional-races/br01-player.ts)（adapters，4 個），沿用既有正式登記。原六個案例先在未修改執行期來源時執行，**3 正常對照 pass／A、B、C fail／退出碼 1**。pre-fix-contracts.txt 保留失敗斷言，沒有將錯誤行為存在當作正確契約。

完整具名案例、Fixture／FakeClock／deferred／testScope 安排：14,999／15,000、29,999／30,000、重載後 14,999／15,000 ms；單次備援／重載／終止；新 seek／拖曳／hidden／pause／disable／0 位置；Auto 表示／編碼變更；有進度降畫質；授權失效；同步還原／reload 重入；late play／reload reject；核心替換及兩次進度。方法回傳／例外原身分、參數／receiver、內部 seek、外部 reload marker、reset 與新 wrapper 所有權另有直接適配器契約。可信真輸入與網站 SDK 時序仍需 Chrome 證據，不能從 Node 合成事件推出。

原 recovery 正常對照改為等待兩次進度；R01／R04／BR-03 orchestration 先建立可歸因的實際合成 video 請求，再測備援，沒有放鬆生產資格。474 全套／typecheck／architecture（44 模組）及 verify 通過；19 套件無 failed／only／skip／todo／cancelled。verify 同時檢查 43 非入口純度、兩次確定性建置、語法、v2-only 與暫存封裝 checksum。相關輸出與 git diff --check 分列保存。

```powershell
npm test -- application --name BR-01
npm test -- adapters --name 'BR-01 adapter'
npm test -- orchestration
npm run typecheck
npm run architecture
npm test
npm run verify
git diff --check
```

## 獨立安全差異審查

Codex Security 6aa22069-fc37-4842-a30c-2727ece75b37，17 個變更來源／測試檔完整覆蓋，0 可報告發現／未驗證候選，已封存、無漂移警告。Snapshot digest：codex-security-snapshot/v1:sha256:87e2a78798ea66c638e2e5f8bcd2c4a748469536bd2b046c39f482655c9b1911。新模型、獨立架構及兩個互不重疊來源複核，root SECURITY 直接核對；政策 helper 的 Windows 路徑失敗由祖先／子目錄盤點替代，沒有省略來源審查。

封存前 17 檔 SHA-256 一致。安全複核後僅補四個適配器契約、版本與文件，主代理另核對，7 執行期檔保持受審雜湊；不宣稱新增測試或升版在原安全快照內。插件管理 canonical report／manifest／findings／coverage；本機重跑檢查點保存 scanId、hash 與來源對照。這是靜態差異審查，不是全庫安全或現場播放保證；verify 不含安全掃描。

## Chrome 來源隔離

來源隔離 22／22，在實際 Chrome 中使用實際 PlayerAdapter／RouteCoordinator／Monitor／Recovery 及記憶體 stores，合成 DOM 媒體狀態、FakeClock。1／2 倍速各跑邊界、一次備援／重載、標記自有替換、重載後終止／不重試、正常短 seek／清理，另有原生 Blob Fetch／XHR。沒有合成 CDN 網路探測或 GM 學習寫入。

首輪 12／22 失敗揭露首次進度沒有釋放停滯段，已修正並重跑 22／22；早期失敗與調查證據保留。暫存 iframe 已移除，測試元件、Clock tasks／storage 訂閱清理通過。**這不是實際經過 12／30 秒的網站故障注入，也不是 Tampermonkey singleton。**

## 發布與安裝版

待發布 v2.1.13，預定唯一腳本 314,188 bytes，SHA-256 646515874ea4088b11830907826c5d1275f823c155a5fb1523999a9755ffa816。公開 latest、遠端 main／tag、唯一附件及實際載入 body 必須發布後讀回，本段尚不宣稱完成。

安裝後只用指定 [風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 1／2 倍分開、正常播放／pause／seek、約 12 秒 video-only 延遲及超過 30 秒停滯，核對一次重載與終止、最新位置及清理。精確 Request stage 攔截先安裝；音訊通行，同一 Fetch／Network 游標完全捕捉，受控 owned request ID 的證據寫入抑制且保留晚到過濾。未實際載入新版不得以舊版或隔離替代。

## 限制與續行

- 原 87.785 秒自然 CDN 起因仍待定位，本輪修復不能推出當時網路原因；其他完整產品驗收另列 TODO。
- 控制觀察不是頁面核心認證。自有 reload pending 時的首次替換只由標記關聯，未經可觀察 site reload 方法的外部替換存在因果辨識限制；不能宣稱可阻止已控制頁面 player 的所有腳本。
- 可信 pointer／key 觀察只涵蓋選中播放器區域。無法可靠區分的目標變更仍優先撤銷舊位置還原。
- schema 2、持久鍵、公開 API／設定／依賴／更新 URL 不變；沒有 cid 或共同路徑的同片保守重設，沒有新增 API 逆序回應政策。
- 新證據在 .work/functional-fixes/br01/2026-10-10-c924b02/，原調查及 Release 快照不回寫；RERUN.md 與 CHECKPOINT.md 提供續行入口。
