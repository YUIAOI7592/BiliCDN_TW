# BiliCDN_TW v2.2.2 診斷殘留清除與保留功能驗證

日期：2026-11-01（Asia/Taipei）。起點為乾淨 main／`65c2dc0e201c5e986f0254524814419294e35e88`；先保護行為契約，再清除 A01–A03。原 [v2.2.1 清查報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/CODE_AUDIT_POST_DIAGNOSTICS_v2.2.1_2026-11-01.md) 保留原文；本版結果承接其階段門檻。

## 清除結果與零殘留範圍

確認診斷專用流程、契約、失去用途的診斷測試支架為零；新增確認殘留及待釐清項目均為零。此結論限定下列 211 份正式來源、宣告、metadata、測試與工具，以及由入口建置的正式 bundle。不是以關鍵字清零代替用途判讀。

| 項目 | 完成內容 | 保留契約與證據 |
| --- | --- | --- |
| A01 | 移除 DomainEvent 中沒有產生者／消費者的 transport、route-observed 成員 | TransportObservation 與 route-planned／route-decision／request-started／route-confirmed／recovery 等功能事件保持；影片備援仍交由 Runtime 觸發恢復，音訊不觸發影片重載 |
| A02 | 移除 RouteSnapshot.planCount 型別與快照計算，正式 bundle 無此計算 | 私有 #plans 及各表示計畫保留；40 組保存 representation／decision，逐組以嚴格身分驗證重用與 decisionRecord 所有權；同步重入驗獨立 decision-2、事件順序及外層返回後重用 decision-1 |
| A03 | 移除 orchestration 的 comparison 狀態／存取器／賦值，以及 observeRetry／_observeRetry 參數與轉傳 | 原案例名稱與選擇器保持；Native 失效順序、影音隔離、Runtime 釋放及 clearLearning 的 evidence→restrictions→meta 次序仍直接斷言 |

正式 TypeScript 差異只有上述三處刪除，沒有改寫授權、傳輸、選路分支或設定。三頁控制中心、總覽全部數值與詳細狀態、單次刷新共用快照保持。Native 預設 true、既有布林值、schema 2、四個儲存鍵不變，沒有資料遷移。

### 必要保留與非殘留判定

| 類別 | 產生／寫入與消費 | 判定 |
| --- | --- | --- |
| N01 選路學習與現行計畫 | TransportObservation／主動量測寫入 EvidenceStore；rankRoutes、選路確認與 circuit 讀取；#plans 由 RouteCoordinator 提交並用於各表示重用 | 必要功能，不是診斷歷程 |
| N02 媒體進度與恢復 | player-media／player-controls 讀取 totalVideoFrames 與真正時間；Monitor／Recovery 比較進度、期限、還原階段及 token | 必要控制狀態；掉幀 mock 的 0 僅補全原生型別，沒有掉幀收集器 |
| N03 當前總覽 | TransportContext 維護當前計數、最後一筆摘要；ControlReadModelPort 單次 snapshot 供三頁刷新；詳細文字按需建立 | 使用者要求保留的畫面資料，沒有報告／匯出／剪貼簿管線 |
| N04 提前重試協作 | XhrEarlyRetry 的有界在途速率與 timedout／claimed 交接，供 EarlyRetryController 判定目前許可狀態 | 真正重試所需的短期控制資料；不是事故錄製或診斷歷程 |
| N05 功能事件 | Routes 發布 recovery；Runtime 核對 video／當前資格後 armRouteFailure；ControlReadModelPort 訂閱更新畫面 | 保留影片恢復交接；只供畫面刷新的投影留待發布後分析，未提前重構 |
| N06 合法 Native／原網址 | SignedRouteVault 授權當前內容的精確 URL；正常 original／root-original／inspectOriginal 用於合法傳輸與禁止判定 | 正常來源政策，不是已撤除的分頁原線對照 |
| N07 離線工具與否定契約 | Node reporter／testScope 管理測試輸出；上游比較固定載入歷史版本至 Node VM；verify 及 UI 測試檢查撤除標記不存在 | 通用測試與歷史相容用途；不進產品、不啟動網站服務，不因名稱誤刪 |

舊 DIAG 案例前綴、diagnostic 表示鍵與不必要的情境鏈，經追查實際執行的是保留的選路／總覽契約；它們不建立診斷流程。命名及前置狀態負擔交由第二階段分析，不把一般待整理程式碼誤列為確認診斷殘留。第二階段已在公開發布核對完成後展開並交付整合報告，本版未實作 O01–O04；發布後結果見下方公開交付段落。

## 自動驗證

Node 26.8.1／npm 11.19.0／TypeScript 7.0.2／esbuild 0.28.2，沿用鎖定版本。先完整閱讀 npm 命令及工具，確認沒有本機網站服務；verify 的封裝驗證只用暫存目錄並清理。

多群組案例在移除產品欄位前先執行，所有 40 組決策斷言通過，最後「快照不再含 planCount」斷言如預期失敗；刪除欄位後同案通過。routing convergence 八案與 orchestration 38 案通過。原 1,598 案完整執行通過，failed／cancelled／skipped／todo 均為 0；沒有新增或刪除保留功能案例。

首次完整測試因沙箱禁止工具測試在暫存 Git 配置寫入而失敗；相同命令在允許暫存 Git 寫入後通過 1,598 案。這是工具權限限制，原失敗保留於本機工作紀錄，沒有改產品或降低斷言。

最終 verify 已通過；包含固定工具配置、格式、文件、封存、型別、架構、完整測試、匯入純度、兩次確定性建置、語法、移除標記及暫存封裝校驗。

| 契約面向 | 現有直接驗證 |
| --- | --- |
| 三頁與畫面資料 | control-center：三頁／撤除入口、總覽與詳細狀態、CDN 建構／刷新各一次 snapshot、失效視圖不更新 |
| Native／Catalog／固定／禁止／停用 | state、native-routing、native-transport、progressive-routing／transport：保存值、預設、禁止聯集、送出前政策重查及停用原請求 |
| 恢復與影音隔離 | orchestration／application、CC40／R04：影片備援觸發恢復、音訊獨立；恢復額度、位置、倍速及一次補正 |
| 過期授權／重入／取消／晚到 | routing convergence、BR-02～05、SR1／SR2、量測儲存／生命週期回歸：當前身分與事件順序、取消原因及失效後拒絕提交 |
| 資源釋放 | testScope、FakeClock、匯入純度與 UI 訂閱清理；沒有新增專用收集器 |

### 安全差異

已核對相對起點的完整產品差異：兩個未使用事件型別刪除、一個快照欄位型別刪除與該欄位投影刪除。正式 bundle 相對 v2.2.1 只改版本標頭並刪除一行 planCount 計算，其他位元組一致。沒有修改授權或傳輸分支，依風險規則本次不觸發新的 Codex Security 掃描；原 v2.2.1 安全產物及原判定保留，不冒稱本版新掃描。

## 發行產物

v2.2.2 腳本 **419,470 bytes**；SHA-256：`ffece767ff55ddcd08db7fb286189d49cf6bd4d4e141dd283648b6d29548bd08`。相對 v2.2.1 減少 37 bytes，僅為移除投影的產物差異，不宣稱實測效能收益。建置資訊清單仍有 80 個輸入：74 個來源 TS 與六個建置／配置檔；其餘 19 份來源亦已全文閱讀，metadata 由建置前置。

前版五份 Release 原件已按原位元組移至 archive/retired/releases/Release/v2.2.1/；原始大小與 SHA-256 全部保持。換版前完整 TEST_REPORT 原樣追加至 [歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)，包含後續 R1 安裝結果；三份既有日誌原文只追加。先保存搬移清單快照，再更新本版適用範圍。

### 公開交付與安裝結案

本節為封裝前檢查點；公開 main／標籤／唯一附件及 latest 下載核對由發布後接續記錄，已發布的五份封裝快照不回寫。

2026-11-01 發布後追加：正式 [v2.2.2 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.2.2) 已發布，非 draft／prerelease，並為 latest。發布時遠端 main 與標籤所指提交均為 `f4cc2e45689b5b9c4b0e99d82f65be38d7600132`；標籤物件為 `49f4da56426a6c86e6f3b1c21f529524ae7518cc`。GitHub Release ID `430365704`，唯一附件 `BiliCDN_TW.user.js`（asset ID `697337978`）。

獨立下載公開 main 原件、v2.2.2 標籤原件、版本附件及 [latest 腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，四者都與本機正式腳本逐位元組相同：版本 **2.2.2**、**419,470 bytes**、SHA-256 **ffece767ff55ddcd08db7fb286189d49cf6bd4d4e141dd283648b6d29548bd08**。GitHub 附件 digest 亦一致。

完成上述公開核對後才以該提交開始第二階段，[整合盤點報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/POST_DIAGNOSTICS_INTEGRATION_v2.2.2_2026-11-01.md) 只分析、不實作。後續 main 的文件提交與發行提交分開；v2.2.2 標籤及五份 Release 原件不變。本段為現行報告追加，不回寫封裝快照，也不改原 v2.2.1 清查結論。

### 來源隔離與實際安裝

本次依指示沒有啟動瀏覽器、更新安裝版、播放或故障窗口，v2.2.2 安裝驗收 **未執行**。離線通過不代表實機通過；不恢復停止輪次。v2.2.1 R1 已通過的範圍保存在 [當版全文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；既有未解問題、效用 FAIL／INVALID 與永久禁令保持。

## 全文閱讀覆蓋清單

實際清單：來源／宣告／metadata 93 檔、測試／回歸／支援 90 檔、工具 28 檔，共 211 檔、58,535 行。按連續範圍逐段閱讀全部 379 頁，無截斷頁或缺頁；完成後再次核對實體 SHA-256。下表記原始位元組雜湊，範圍為一基行號；關鍵字與引用搜尋只作輔助。

| 檔案 | 完整連續閱讀範圍 | SHA-256 | 用途與結論 |
| --- | --- | --- | --- |
| `src-v2/adapters/fetch-hook.ts` | 1–194；195–276 | `b8d52918c182b2738bc957bec4fa004790d5eba4772f5c060801e811d167cacb` | Fetch 正規化、單一讀取器與取消 |
| `src-v2/adapters/navigation.ts` | 1–33 | `c8fa3a0d201ff649199c93469284b57312829d25c52e948df61ac4a7bb562a27` | SPA 導覽與自有包裝清理 |
| `src-v2/adapters/page-playinfo.ts` | 1–116 | `9de1d6998e99847b6bdc3deec64ada08721797538a404126d837620b7873d3a8` | 頁面 playinfo 低信任來源與同步處理 |
| `src-v2/adapters/player-controls.ts` | 1–245；246–473；474–707；708–955；956–1181；1182–1410；1411–1419 | `d6bf36495ace49a57fe481759f0f99d9905ca476b0f0e1953fa29033aeace548` | 可信操作、修訂、還原所有權 |
| `src-v2/adapters/player-media.ts` | 1–151 | `acd45f9fecd1eb51e8e87722296b4eb8c304dbe7715cfd29a5f2de558570a114` | 真實媒體快照與總影格進度 N02 |
| `src-v2/adapters/player-method.ts` | 1–42 | `691f0becb27af0e53e9f52a53ce6a3bdd46e42db18e8a5b66bc5ca7aea87c012` | SDK 方法描述子及包裝所有權 |
| `src-v2/adapters/player-sdk.ts` | 1–14 | `d7fe4b1ce5b0c375525f57d8bd46b67a724b309b490ba3f657b3f8654bd1b6fb` | SDK 與核心讀取／呼叫 |
| `src-v2/adapters/player.ts` | 1–133 | `6c8f67fbcbd9f5ffa832151275c934a7ba15d3f1aaa699e8679d5c8334bf9981` | 播放器適配與恢復執行 |
| `src-v2/adapters/playurl.ts` | 1–203；204–232 | `b41474dcabd3817fcdfa1552247457ec67fcfd30cd274147f9ee848835f3b22d` | playurl 適配與生命週期 |
| `src-v2/adapters/range-probe.ts` | 1–115 | `49f363fbde6fb628fa31c45240dcc383870377ad2dd9f8fa1a4ed4e15d066281` | 有界 Range 主動探測 |
| `src-v2/adapters/scheduler.ts` | 1–15 | `e3ffcfe1ae9c448db862a5e0610ec01ca89a511d3d8e224933fe862e9421f319` | 注入式排程與取消 |
| `src-v2/adapters/transport-context.ts` | 1–239；240–329 | `a91f19b567b60b4856edd5890b238b6026a245302297af11c0218acf010feba3` | 當次請求歸因、總覽計數 N03 |
| `src-v2/adapters/transport-ports.ts` | 1–29 | `8f26c3ff470310266cd78c8df4d545636a53cb67a120163fa23969b47fee704b` | 傳輸窄契約 |
| `src-v2/adapters/transport.ts` | 1–123 | `354a872b80a91ae7c9118a238dbce612be4c2a4efeb8028374c3f4622d3f4b70` | Fetch／XHR 安裝、回復與釋放 |
| `src-v2/adapters/visibility.ts` | 1–114 | `f783b2929cf085b4281dd946fcac4f18c9ba6b21860e850db2ac2dfed7b5abf4` | 可見性適配 |
| `src-v2/adapters/webrtc.ts` | 1–78 | `679615d4f687ef6ef7e2f9067387f97151b5f49bfa804e243d76c6e616614c0b` | WebRTC 設定適配 |
| `src-v2/adapters/xhr-early-retry.ts` | 1–221；222–458；459–483 | `74e9eb897eeb9ef46df9e2e416fd44c925ecc112deb24b671419ec7b36a95171` | 單次 XHR 提前重試交接 N04 |
| `src-v2/adapters/xhr-hook.ts` | 1–198；199–401；402–623；624–667 | `5067077063b462bcf7454ef72ffbf07c8788221e26ee94bdd0d3fbfd062558cc` | XHR 原生差異及重入防護 |
| `src-v2/adapters/xhr-request.ts` | 1–72 | `504106cf4489562ddf0b4f0127c279b0945839b8e766d4ea55858372b612080f` | XHR 請求正規化 |
| `src-v2/adapters/xhr-response.ts` | 1–88 | `c0f26cb247c8bfa1bd1590c48064072eed98173f8b4a25df057b38a65064512a` | XHR 回應轉換與當前摘要 N03 |
| `src-v2/adapters/xhr-values.ts` | 1–92 | `279e619587cd96b3ef93df642de10f14af6ca62826cfb088c397d567ce76096e` | XHR 原生欄位處理 |
| `src-v2/application/control-commands.ts` | 1–35 | `b487446e9f1d975e900e600d993de78cf4c0a216c540e4dc3e4e818ae7514343` | 設定及清除學習命令 |
| `src-v2/application/control-ports.ts` | 1–21 | `7bd5903e96a39f7a79741c6b433e96669237932e74ebad2dc0bd39e86bb7cb54` | 保留命令契約 |
| `src-v2/application/early-retry-contracts.ts` | 1–148 | `af5e8c94a3e539bc6c283df73dbe88ba0828905b0fca8789cd90a1f029aec4e7` | 提前重試功能契約；未接線窄介面 O03 |
| `src-v2/application/early-retry-controller.ts` | 1–224；225–291 | `5ab7d093f5a1de9119b4c5625772c9182ad56668efd1c020729336a192ff46cc` | 提前重試當前狀態與次數 N04 |
| `src-v2/application/lifecycle-controller.ts` | 1–108 | `f29d25c9e82d7f7fc4796cc7e3435369993a193d4e451617999003c948a2c8c1` | 內容生命週期組合 |
| `src-v2/application/lifecycle-ports.ts` | 1–14 | `1b9ff043e83e4fa9057f0751cab4d6a4a5df1ab17d30a58ab8a9d28bf43159c1` | 生命週期窄契約 |
| `src-v2/application/measurement-contracts.ts` | 1–72 | `bc45358d72022fe8030910fb828d7ab05fae9d312f97a37d1187eb1e1ed4c00a` | 量測資格、當前狀態契約 N04 |
| `src-v2/application/measurement-controller.ts` | 1–251；252–484；485–696 | `5db69642aa687a6bf933b78b3edab275ff03592ce046add02dafd1c7ab445ae1` | 起播與健康探測、額度及清理 N04 |
| `src-v2/application/monitor-contracts.ts` | 1–76 | `9b7300efc66da03648088f7baea351b026d90a9e9981f2f1c5d51fbfc3bc427c` | 監控狀態契約 N02 |
| `src-v2/application/player-monitor.ts` | 1–242；243–477；478–537 | `b049d14ce58f33ba14911431765155955be7496b1ed4f045bb61df3bbdd3f863` | 一秒監控、進度、備援及取消 N02 |
| `src-v2/application/playurl-contracts.ts` | 1–63 | `566d1fb5a15be9c496589b86779375732139c78fac65bc8aa20378bef8709d34` | playurl 內容與授權契約 |
| `src-v2/application/playurl-controller.ts` | 1–217；218–286 | `214c8ae00eac8e0332dc04dbd4071eaf9e4e0c038af71adc09677d232c4a600c` | playurl 正規化與內容週期 |
| `src-v2/application/ports.ts` | 1–104 | `f0153e91ea7c6351c5fc23ba8d061bca9ab957ce08bce53cf5470fb0d3ea15d2` | 播放器、排程與探測基礎契約 |
| `src-v2/application/recovery-contracts.ts` | 1–108 | `6913126b7d0eaf0aa40e89ea1572593c706ffd63c840d66a27e0e95f1ce6b16c` | 恢復階段與所有權契約 N02 |
| `src-v2/application/recovery-controller.ts` | 1–280；281–511；512–737；738–956；957–1021 | `cd8e602c9029863e3664f1fa36d867db6275ef4c8c8554cd89c0e370361bb141` | 單次恢復、位置／倍速／播放還原 N02 |
| `src-v2/application/route-contracts.ts` | 1–232 | `4ee36ea40f6439a6e2b4bc22b0251e23102073ae08ec4fcf8d63080f6b9b34e5` | A02 已關閉；保留現行計畫與總覽資料 N01/N03 |
| `src-v2/application/route-coordinator.ts` | 1–247；248–466；467–705；706–926；927–1138；1139–1346；1347–1556；1557–1803；1804–1899 | `099817f2c00d6681822e15f8d57c8e12cd868d133ee3676f090c9e181f96a469` | A02 已關閉；#plans、選路學習與恢復事件保留 N01/N05 |
| `src-v2/application/routing/candidate-planning.ts` | 1–125 | `b535ea5fb63581f1f8dae29c1896e5ae8f549512ff88b5e7dce478aa9e4e53f1` | 候選選路及規劃 |
| `src-v2/application/routing/player-output.ts` | 1–147 | `7e716a5e5b6008bb63339a77a2bd6cd39d3df71c1a2de8cb461f1b4d4b2ef93c` | 合法播放器輸出與備援 |
| `src-v2/application/routing/request-routing.ts` | 1–62 | `1f2dabee294f9c21b8b4fe3e5a45c69668a85178dba0bf6336ce9602688cff4b` | 當次請求選路 |
| `src-v2/application/routing/route-materialization.ts` | 1–57 | `c7312a72c606cee9d4fad52a5d16e4cf2a502a9dccc1dbfa885959360347440b` | 精確授權路線實體化 |
| `src-v2/application/routing/route-restrictions.ts` | 1–82 | `777b55649123c37db41d22f8a527f21c9f67679b15952660bdc1a65ad6f5cf0e` | 禁止規則與資格 |
| `src-v2/application/routing/routing-ports.ts` | 1–46 | `ac3492df5c0490003ea9ebdc9447fc9ff4b11197345fbdfa1745b909163235c7` | 選路政策窄介面 |
| `src-v2/application/routing/transport-result.ts` | 1–102 | `5f44af33147e7ea2b957507d5700d6a5999ecba930e8fa7abb6ebfd49e5cf71f` | 傳輸結果至選路學習 N01 |
| `src-v2/application/runtime-controller.ts` | 1–84 | `3e1848387f30d85d691809772a8cb7bff90bfbd54bcbd2386ee1c79bded92965` | 影片備援事件轉交恢復 N05 |
| `src-v2/application/runtime-ports.ts` | 1–25 | `c137be4467d501c9784db9c82eb6b936ddba142a8f22d1d193a6280acdbdf1f7` | Runtime 窄契約 |
| `src-v2/domain/catalog.ts` | 1–60 | `da8c155d165c642d27ee0d5663978dc47f052627c13fd3fc4eb686ecc1100ad0` | 可信內建 CDN 清單 |
| `src-v2/domain/early-retry.ts` | 1–91 | `04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37` | 提前重試純資格判定 N04 |
| `src-v2/domain/evidence.ts` | 1–125 | `09536c6b455bfb322e75e6b1dc464ddba3e52e35c22609a10e3435d5dcc7fdfc` | 有界速度學習與熔斷 N01 |
| `src-v2/domain/model.ts` | 1–238 | `daaf9d880d85d51e1c74afef6f606386e1aba6044b4be5a360963845ca753c51` | A01 已關閉；保留 TransportObservation 與功能事件 N01/N05 |
| `src-v2/domain/playback-progress.ts` | 1–29 | `ce5c9ae64922b62655e20b97f798da38d5ee1c2b68f3a85f83a304ff2b02af82` | 時間／總影格進度比較 N02 |
| `src-v2/domain/player-output-plan.ts` | 1–97 | `87b54160afadd86b14fa61c644b1d66c09e318752321fcf12f4280aad6ba8dab` | 播放器輸出純規劃 |
| `src-v2/domain/playurl-content.ts` | 1–80 | `f7ea073fcadf47c69f1e3041d64211462dd9098f98642228d7d53263d914887d` | 內容目錄與指紋生命週期 |
| `src-v2/domain/playurl-model.ts` | 1–22 | `d6a8eee3a41291cebc65194a6523d454c22947ef9c0813d228d74c9be22d597b` | 播放資料格式契約 |
| `src-v2/domain/probe-model.ts` | 1–5 | `4549d113c83233f0ea3615ef701f05a94215df08af613f0fdc3e54f3890e8e03` | 探測結果契約 |
| `src-v2/domain/probe-range.ts` | 1–43 | `7cf9b62c33ae30f5bbd6f6db4e50e5badc35b1fa0bfedfe46dfd8bfb425b8121` | 探測範圍純規劃 |
| `src-v2/domain/route-policy.ts` | 1–47 | `73ce25cc3f5bfbb07246487bd0f0ff5b509f18c8176e5f7834ad47358fbc15e5` | 選路政策純判定 |
| `src-v2/domain/routing.ts` | 1–234 | `4afc33e629e7da0c38a635289c661055e7952057d4856e2aa3e6ddd1bf164dc5` | 排名與需求餘裕 N01 |
| `src-v2/domain/transport-model.ts` | 1–47 | `7db42b25b0770a9d9b0665f5b7d686ddaa643f654dcfffbdecad5f512d253538` | 傳輸當前摘要契約 N03 |
| `src-v2/domain/url-policy.ts` | 1–107 | `22de63bea2e0a0255c85711b8aecb05629628d1eac81c55a6e438bdf384b360f` | 媒體 URL 分類及合法原網址 N06 |
| `src-v2/entry.ts` | 1–173 | `be89b5a181dd2223224db79b52f8cbfb3fc49b1ee536369840cf65c2f77cc4c9` | 唯一入口組合；沒有診斷注入 |
| `src-v2/globals.d.ts` | 1–12 | `1b8cb3275e13390b6dc043286fd95afbad90cff72219c35a1fbe840d5b0088c9` | 平台全域宣告；無剪貼簿宣告 |
| `src-v2/metadata.txt` | 1–39 | `ee6ec6d2929cd23cf6660f21ad1e90a1b9304e3594c97ac829ad9b820a0add68` | 腳本 metadata；無剪貼簿授權 |
| `src-v2/platform/runtime-id-port.ts` | 1–3 | `5e36145e91f90bb44b95d9a48727b9df672aadd88f0014c15c1c7533d56e1f32` | 執行個體 ID 窄契約 |
| `src-v2/platform/runtime-ids.ts` | 1–20 | `0f23e774e77bd29f7917a839fa07cd012af5a32fedf82bd8fc887bb63e1a7d6e` | 執行個體 ID 建立 |
| `src-v2/platform/storage-port.ts` | 1–7 | `d87da38f7797216eefd7d91391cb5fecb8265921deb7d1f4e769f3b970f08a62` | 儲存與鎖契約 |
| `src-v2/platform/storage.ts` | 1–47 | `1f4bd90d5d709d0eef64152ad6f3a2c7d1267e08d03c504a7cc0afa6d1859d8d` | GM 儲存、鎖、訂閱與清理 |
| `src-v2/state/evidence-ports.ts` | 1–14 | `14e8688e5437689932303ca27c35fa9285411ca6448c4c16207c6f64e826ea4a` | 選路學習窄契約 N01 |
| `src-v2/state/evidence-store.ts` | 1–193 | `bbc5e57574e9bd479b448c9ab0f2d5599af9ad0c1bbbec2eeaa99b8eab2a8389` | 有界選路學習持久資料 N01 |
| `src-v2/state/measurement-meta-ports.ts` | 1–11 | `6b5b29ef3600940bd7282a7c40766fb5c42ad477757a289dd3c12477fe3c1c64` | 量測 metadata 窄契約 N04 |
| `src-v2/state/measurement-meta-store.ts` | 1–47 | `687634317bbca20d0434ef1b70186bbac58f5aff3300d0d4e00929d265da90f6` | 探測游標／冷卻與鎖 N04 |
| `src-v2/state/restriction-contracts.ts` | 1–27 | `5af87a6620869e2e0558c43dc1bf0534d4bb8bffa4d878d8444b3727e68e6399` | 禁止資料契約 |
| `src-v2/state/restriction-store.ts` | 1–163 | `99d6a2858422df8e94e221950f7f9eb713519a81098fd0eefbf48de7bc7589fc` | 禁止資料與遠端合併 |
| `src-v2/state/session-contracts.ts` | 1–27 | `5a4d84b961cac8a2057b64f59cd19b9bbf66cd9343a7f482229685122fd00be7` | Session 契約 |
| `src-v2/state/session-store.ts` | 1–66 | `85ac2878cfc33b82f4a704642d83d66f893097a0bafd77f32b906e1efde61ef6` | Session 與內容週期 |
| `src-v2/state/settings-contracts.ts` | 1–34 | `91e636c43e289e59546b5091ef2c69f3e5884c84c1919bc3a1acbedc32085a52` | schema 2 設定契約 N06 |
| `src-v2/state/settings-policy.ts` | 1–26 | `2d3bd64447891ddee7991f8c523f7b80daa230480b1c3a60e7b28930c53ce881` | 逐欄設定失效比較 |
| `src-v2/state/settings-store.ts` | 1–192 | `ba60bb9750a6bf606bffd5a9844c866321559d325c2f9ce77455514e7f9e2f8f` | 設定預設、抑制與鎖 N06 |
| `src-v2/state/signed-route-vault.ts` | 1–216；217–448；449–484 | `24d5f7bc9dc46a1758478a251f5ac075465c0f52e40736692d35f59143d63322` | 唯一簽名授權索引 N01/N06 |
| `src-v2/state/vault-contracts.ts` | 1–92 | `4d7b27000906baea4a9b21ce8a68e5f90719d66b317720e3eeacd8dab07bb66a` | Vault 不透明授權契約 |
| `src-v2/ui/cdn-view.ts` | 1–93 | `4c9f3a2f0d4e43a8b2ea8491d2c9a50b3d891c9bb9f9121debc9e6f93f51c825` | CDN 當次共用模型 N03 |
| `src-v2/ui/control-center.ts` | 1–231；232–236 | `c78731d7dc1df0f7e70db7264fe10230fb9e78ab27e87847777a2109a2969093` | 三頁與單次刷新 N03 |
| `src-v2/ui/control-contracts.ts` | 1–96 | `2b7968ef5e728830cf3601c8bb154c30079ff1ff7c3025f7f46761778f56772a` | UI 契約候選 O02；非報告管線 |
| `src-v2/ui/control-read-model.ts` | 1–32 | `1d10441be0394bdf20424f3b1b0610a6886c9e9f48ee7d3d7e4a79516674e7a0` | 唯讀模型／功能通知 N03/N05；候選 O02 |
| `src-v2/ui/elements.ts` | 1–32 | `b56e1315765050b1fee98563ccd1a01e195dc7eee109e15b828a7d0651a67e7f` | UI 元件 |
| `src-v2/ui/labels.ts` | 1–132 | `aba4bee094132ccbeb10472d855c593a228f7305f0352dc1f8164b3e4286e617` | 當前狀態標籤 |
| `src-v2/ui/overview-view.ts` | 1–172 | `08ba2f29dfb89f3f8a055619ecba0228119d4432479098aafa2e6e2521c21f10` | 總覽數值及按需詳細狀態 N03 |
| `src-v2/ui/player-panel.ts` | 1–73 | `011ae453e4d6dce5972eb07af28a46971e411d3bed7f7ed4d37d7909fe6006a9` | 播放器面板入口 |
| `src-v2/ui/setting-controls.ts` | 1–43 | `182c5a6a38c15ff92655cbc176afa37f3f61fba1e018e5789d193a6de212afcd` | 共用開關與可信命令 |
| `src-v2/ui/settings-view.ts` | 1–91 | `aff368ae2a54bc14017e1aea695b26971577de3c2608db0085b922f4d112fda5` | 六項設定畫面 |
| `src-v2/ui/status-summary.ts` | 1–123；124–150 | `f00ac55b7395bfcf4dd2788a0ef49bb9ea3ad142bba75f8b34702e7e8e798dd9` | 按需詳細狀態文字 N03 |
| `src-v2/ui/styles.ts` | 1–33 | `5e15f6ad9faa3f4b86f02fc73d45eed61fcc7ae3472de9cdca427cf63965112c` | 三頁控制中心樣式 |
| `tests-v2/domain-boundaries.ts` | 1–233 | `4f55e04ded32cc7efec4c04d0ef4d3c06a743ac77d5f7b6c88d1e67af686e9d7` | 純領域邊界；數字 fixture／無效敘述觀察 O04 |
| `tests-v2/domain-progress-convergence.ts` | 1–70 | `f9342a97763d1507e360ffa46ba46139fb0fa3d521156148227f502ae84ff209` | 時間與影格嚴格邊界 N02 |
| `tests-v2/imports.ts` | 1–12 | `f03ab24f3498d7b5421f3ec2402d367cf70957fc9f60c1b0af92145d2afa911a` | 全部非入口模組匯入純度 |
| `tests-v2/regressions/archive.ts` | 1–197；198–401；402–610 | `df9650dd907ce8137b1eabe012d8a3520b71497e57f8893789715d348c4f42fb` | 封存原件與追加保護 |
| `tests-v2/regressions/cc39-integration.ts` | 1–127 | `c3858c471f06708a11a95aa0efeb4bf1ba7d0b6b244d51f3eb0a84c3eda53e46` | 控制命令、設定失效與接線 |
| `tests-v2/regressions/documentation.ts` | 1–226；227–407；408–601；602–799；800–871 | `1b997018bf7db148bb6693d85779215a71f7f490668d73e88a9b468dca93c120` | 文件分類、退役來源與連結保護 |
| `tests-v2/regressions/functional-races/adapter-controls.ts` | 1–212；213–331 | `0507b45e769ac04a8ef70223be75c8fcc14fe9279d6fdfa988a01c58eaa82379` | 導覽、可見性及包裝清理 |
| `tests-v2/regressions/functional-races/br01-followthrough.ts` | 1–240；241–517；518–781；782–924 | `fceae29dea8a33729112efcbc163040d5d5562cf1608f52839b3342b018186c9` | 重載後可信操作與續行；固定掉幀欄位 N07 |
| `tests-v2/regressions/functional-races/br01-play-intent.ts` | 1–298；299–400 | `1c8441db410812493d06562b1f0b29ea425e913123461bcf4c261e37ea4c9be9` | 可信播放意圖與取消 |
| `tests-v2/regressions/functional-races/br01-player.ts` | 1–167 | `f2bf4a7e0a3b3b2b5bb020c81d3b4c175b60dc7db5b9fd5f5237838e5c7037d9` | 播放器 SDK／原生落點與重入 |
| `tests-v2/regressions/functional-races/br01-reload-controls.ts` | 1–260；261–516；517–690 | `876e730d18fdc32a2afb60fbf15c8a90b6d94b65813197e21ab6a189b5459ed9` | 重載控制方法所有權與清理 |
| `tests-v2/regressions/functional-races/br01.ts` | 1–274；275–475 | `6da57b64c24f457a71186a7ee79f03abcf5316dcb69ff5a73d593091f3acee57` | 恢復觸發、額度及期限 |
| `tests-v2/regressions/functional-races/br06.ts` | 1–260；261–540；541–802；803–1052；1053–1311；1312–1539 | `e74ba593411491b9ff6288036af46926911adb1782bf7667e5f29e32d4b5823d` | 新尋位意圖撤銷舊恢復 |
| `tests-v2/regressions/functional-races/br08-player.ts` | 1–259；260–471 | `ca342d77a49770655d7b8dfe22738aa0e888346106c401f80d1e7037541bec48` | 拖曳與播放器控制適配 |
| `tests-v2/regressions/functional-races/br08.ts` | 1–263；264–536；537–767 | `24a94b0b9c93b28540d42fbc2b3e6dbf83f9dde0b1e306b6e33e473b9e404c18` | 拖曳期間不得恢復 |
| `tests-v2/regressions/functional-races/br09.ts` | 1–279；280–507；508–653 | `c97a25a0a0d5d0f8d953f26fd19c7d520dc91e9aaaa9f0260c99518f267edf49` | 歸零目標撤銷舊位置 |
| `tests-v2/regressions/functional-races/content-domain.ts` | 1–117 | `31e3b8395f6221b41360292749edb185e4cfc680ca92caf14b7436ea15157271` | 內容目錄歷史上限與汰換 N01 |
| `tests-v2/regressions/functional-races/content.ts` | 1–204；205–381 | `ad46827191cf1253cbd0d3e55f6512f12d63932cd4ff3cea80fc99622708ad24` | 內容週期、低信任資料與晚到工作 |
| `tests-v2/regressions/functional-races/cr-measurement-errors.ts` | 1–53 | `fca970add230f345899b5ab81b7090f6b5d6cf59917f676d661b9e1af97aec3a` | 量測保存失敗及未處理拒絕 |
| `tests-v2/regressions/functional-races/cr-measurement-lifecycle.ts` | 1–158 | `e3554170207cefd395eade990e0c30b62eac336cf8361324c8dee76a706b3c53` | 量測重入與生命週期 |
| `tests-v2/regressions/functional-races/cr-routing.ts` | 1–196；197–226 | `7d273b68587a827aa33845619c0d10a28d0e66911c7df228fdb583a26456d98c` | 選路授權及重入競態 |
| `tests-v2/regressions/functional-races/cr-startup.ts` | 1–157 | `a9cd2377844daa153d9ca41cbea3b1485024ce28218cbdbd95c7dccbfe636778` | 起播工作與清理 |
| `tests-v2/regressions/functional-races/cr-xhr-fixture.ts` | 1–183 | `0d483d67dcb751bae93ffe223e468e95ac209ddfe8e47867f3902d1a8c7de23f` | XHR 合約情境資源 |
| `tests-v2/regressions/functional-races/cr-xhr-headers.ts` | 1–96 | `617f08c5e73e1fdbaebb4e49987578524461837b36da556e006adb646c7b1332` | XHR 標頭及原生行為 |
| `tests-v2/regressions/functional-races/cr-xhr-send-conversion.ts` | 1–86 | `fdcbdf4294ba77b18099a2294ea0a482f853b5fff0bf9f66a740ffafe6c3d940` | XHR send 轉型重入 |
| `tests-v2/regressions/functional-races/measurement-metadata.ts` | 1–226；227–489 | `41b31aae59fc476d5c454f98409eb4265014e04780f7778f095af47f00aa5a90` | 量測 metadata 與遠端協調 |
| `tests-v2/regressions/functional-races/player-convergence.ts` | 1–242；243–425 | `a9984661f87df4e8e5314e5e3f3106b4795bd2de43c8b042f2a46dc125fa37d9` | 播放器收斂與所有權 |
| `tests-v2/regressions/functional-races/recovery.ts` | 1–243；244–469；470–682 | `07b8df6fe46ab5277c9740a4b2609377e695198f42c17c5d2f86017b5fda1acc` | 恢復取消、額度及舊工作隔離 |
| `tests-v2/regressions/functional-races/rescue-goals.ts` | 1–216；217–229 | `73c3b4d4fd8dec0172421cf8819b0dc14da3f2e271166309bda4aabca763466e` | 位置還原目標 |
| `tests-v2/regressions/functional-races/rescue-position.ts` | 1–159 | `c5e96862c0b3f9326d1850200f8e3f633aa576c53cb355e44070cc6815857e93` | 可信位置與實際副作用；Node trace N07 |
| `tests-v2/regressions/functional-races/rescue-recovery.ts` | 1–254；255–291 | `a8a195047dbc5e05e0b4e427372794e75bab338bc7d23f2076615c5ed4831a2d` | 恢復階段與取消 |
| `tests-v2/regressions/functional-races/rescue-runtime.ts` | 1–262；263–302 | `15b65b0c1184ad5bb62dffcff99fc25d7c21214c1062a31aae5f4924de53d696` | 影音備援隔離與功能事件 N05 |
| `tests-v2/regressions/functional-races/rescue-sustained.ts` | 1–76 | `3f2fef002391bf669175baa4b86bc71d6432ad9e605f73e71a5be34d1aa205c6` | 逐秒恢復後進度；測試樣本 N07 |
| `tests-v2/regressions/functional-races/rescue-timing.ts` | 1–260；261–303 | `3d16e6652410663759d7959c1a7aeb77263d22ca17d638baf1ee3bb890d54c45` | 恢復原有時序及期限 |
| `tests-v2/regressions/functional-races/restore-closed-loop.ts` | 1–222；223–388 | `c30eece30807066dee5f06e3fa0e9f8c95ffc2af62b198dbe5acd03fbc411913` | 還原閉環與失效 |
| `tests-v2/regressions/functional-races/restore-ownership.ts` | 1–49 | `201b187315dc0d0b99954f5f3086bcfb3fde5981779f5a2fa1b936beedcc57ed` | 使用者操作優先權 |
| `tests-v2/regressions/functional-races/routing-convergence.ts` | 1–233；234–421 | `feb94b160f31c0bd1b79dbce22c82357fa6170389bbf1feba560db28185d90f5` | 獨立內層決策、事件 ID／順序與外層提交重用直接斷言 |
| `tests-v2/regressions/functional-races/routing-fixture.ts` | 1–75 | `740a3b8b1d0bb6e4b02efd4069745ae6cb8b69052302bab197889e24862086f1` | 具名選路基礎情境 |
| `tests-v2/regressions/functional-races/routing-modularization.ts` | 1–144 | `116774c3a445c206f7844f613bdd45a28151b7240c882a65ece130017abeff1a` | 選路模組化契約 |
| `tests-v2/regressions/functional-races/routing.ts` | 1–207；208–280 | `6bc660b049dc57d343393fe43a0c5e62b6ccb2555f9630bd9c38a82d3a33b788` | 選路及儲存競態 |
| `tests-v2/regressions/functional-races/runtime.ts` | 1–246；247–265 | `d06b34ef51772c84843d0ae8d9991a07ff3e7f0612ec72388fe451b6ac418ebd` | Runtime 影音備援、設定與清理 N05 |
| `tests-v2/regressions/functional-races/startup-abort.ts` | 1–119 | `f9c326206880fa815a675324a0586877143010b708b54c2a35f96a4a7136f518` | 起播等待取消及原因 |
| `tests-v2/regressions/functional-races/up141-backups.ts` | 1–175 | `0e7bd7e4d8e26e8943f7f8bde4eef3550eb7cad566c4fa993d62754b978989e5` | 備援家族排序 |
| `tests-v2/regressions/functional-races/up141-probe.ts` | 1–223；224–243 | `9643dc259a5aee75f564e8eb8ba089f05fb699ca2748ab59889803c9451e3aa5` | 健康探測範圍與節流 |
| `tests-v2/regressions/functional-races/up141-start.ts` | 1–182 | `54c75a4c3855d9dfc6e7652de354f1743989dfaab1a2a5677ae1d45d508ee527` | 起播提前放行 |
| `tests-v2/regressions/functional-races/visibility-ownership.ts` | 1–219；220–273 | `2150d6c3bb34782ae9101b51048c8f281a9c7ae2313c542b18252e93f29d4145` | 可見性包裝所有權 |
| `tests-v2/regressions/functional-races/xhr-response-convergence.ts` | 1–223；224–393 | `03922b07e1742e01f46db19b7aa8cc6559a2edb0902d1f30cca9e7bf46dedc7d` | XHR 延後回應與舊身分 |
| `tests-v2/regressions/functional-races/xhr.ts` | 1–223；224–479；480–709；710–919；920–1143；1144–1385；1386–1430 | `e3338bddd5583f9bbf84040e9ac9c14e698a81559347dcfc5792f84cdf7b07bd` | XHR open/send/abort 原生相容 |
| `tests-v2/regressions/player-restore-ownership.ts` | 1–105 | `576b10f80e0f97ad50967aed98ce39596096628f6721db9245edefb73f73e001` | 播放器還原所有權 |
| `tests-v2/regressions/player-restore-readback.ts` | 1–130 | `1cd9b6e4380cb3545fd1b4c21faa2aeb6b1ae42ac411406ef62468f0c7916751` | 還原讀回與一次補正 |
| `tests-v2/regressions/project-config.ts` | 1–195 | `5ab5afcc6e2cbb01bbcbe7aed13c11084443239744a2f1a4772fd50124d69ecd` | 固定工具配置核對 |
| `tests-v2/regressions/recovery-restore-controller.ts` | 1–243 | `b0b4f1e0683eafebc9b450129d0048b1173131d76515c098f113e959ea1c5750` | 恢復還原控制器閉環 |
| `tests-v2/regressions/up141-api.ts` | 1–215；216–264 | `af7e12f656084e290e181293c91b6e28b0b5326920c03cfb31a15632598e0eef` | 播放 API 辨識與原文傳遞 |
| `tests-v2/regressions/up141-retry-policy.ts` | 1–270；271–387 | `06ae28ac723300dd68b49570ccdc42d5896ba01a34fbdc0014c5cc638da1656b` | 提前重試資格、取消、無歷程快照 N04 |
| `tests-v2/regressions/up141-retry-transport.ts` | 1–242；243–494；495–683 | `f470ac2b635a24d6dd5bafbacb1ab343f2245fb1e6cb335a57814c3d9d24b695` | 提前重試派送、授權、清理；受控樣本抑制 O03 |
| `tests-v2/regressions/up141-test-release.ts` | 1–225；226–285 | `76b08dea183963d54e2974f89bae38eca1886a2d6b4c2510502fe75935e471c4` | 保留功能離線效用模型 N07 |
| `tests-v2/regressions/upstream-comparison.ts` | 1–240；241–490 | `a88d59859aed7d879d9df01ee09ae5a492b52fe0ba24d95c2c8b2dd58bbb5e24` | 固定上游模擬器的有效性契約 N07 |
| `tests-v2/regressions/v220-settings-policy.ts` | 1–42 | `82721aa249bc998826856f22dfae004bb0fc79ce1179cd722411905863bc6215` | 逐欄設定比較與失效範圍 |
| `tests-v2/regressions/v220-settings.ts` | 1–62 | `2b7312b1ef33303532f7f1a1036fea83c387310f0a28dfced956ac939e8239b1` | Native 新預設、缺值／非法／保存／鎖／失敗／遠端 N06 |
| `tests-v2/suites/adapter-boundaries.ts` | 1–271；272–435 | `ace0ed41c14dc6c3730e9e966a0bd73bb4948f3191b9f84a2666021ab666ab25` | 適配邊界與清理；前置串接 O04 |
| `tests-v2/suites/adapters.ts` | 1–212；213–461；462–702；703–942；943–1186；1187–1443；1444–1688；1689–1926；1927–2157；2158–2401；2402–2647；2648–2867；2868–2870 | `d57b3a87fafe82bc9b0c3a848a67be4a833acc3c5f896e3fd3f3af3e6f4cd723` | Fetch/XHR、合法 Native、禁止、影音隔離；前置串接 O04 |
| `tests-v2/suites/application.ts` | 1–223；224–478；479–745；746–992；993–1232；1233–1459；1460–1684；1685–1935；1936–2181；2182–2392；2393–2626；2627–2753 | `10bf9ac3e865d84232fe70f76cca2dea345a0abd47d5dff2f5d987414ed5d208` | 40 組逐組驗證計畫重用及紀錄所有權；保留量測／恢復契約 |
| `tests-v2/suites/control-center.ts` | 1–260；261–488；489–700；701–837 | `2b6bf67d0ddfd2ce1be0f7e182f06fda67fa9f329289912ce9da253f775d1708` | 三頁、總覽、單次快照、可信命令與失效 N03；舊名稱 O04 |
| `tests-v2/suites/domain.ts` | 1–268；269–389 | `5edd6cdb22d56f72674eabe4775f523bdf0e082afc0758b03b8bdfdfe4ce80ed` | 需求／排名與有界學習 N01；無效前置 O04 |
| `tests-v2/suites/measurement-state.ts` | 1–151 | `c97f7b3ef406ff27b1f75765abc42f0fda588cbc95cadcb06911f72ed4b604a7` | 量測儲存與舊 lock waiter |
| `tests-v2/suites/native-routing.ts` | 1–201；202–392；393–607；608–838；839–1052；1053–1261；1262–1469；1470–1499 | `3ffe608661967d6c065a8959a5b15c81eab765834dea17a639e59899a4f87aba` | Native／Catalog、禁止與過期授權 N06；前置串接 O04 |
| `tests-v2/suites/native-transport.ts` | 1–221；222–437；438–665；666–881；882–1105；1106–1328；1329–1563；1564–1794；1795–1996；1997–2232；2233–2310 | `1b345090fcc1cd05041429f0310df18371f507721969ab513a7f2b086006924e` | 等待後／送出前授權重查及原生相容 N06；前置串接 O04 |
| `tests-v2/suites/orchestration.ts` | 1–269；270–460 | `6d16315a9749ba098f16a6d16438d52a16694f1125ae57e38dedbd4a4cf993ae` | A03 已關閉；Native 失效、影音隔離、清理及 clearLearning 次序保留 |
| `tests-v2/suites/playurl-summary.ts` | 1–250；251–484；485–635 | `2e485f40c5011c2403c5e430317f4ae5754c53ef12f4b2d92db065cad539fe8f` | 當前播放摘要、安全欄位與 getter 快取 N03；前置串接 O04 |
| `tests-v2/suites/progressive-playurl.ts` | 1–205；206–447；448–675；676–891；892–1017 | `146e69f80ae1213a3d760453670e0cec6f37f53a7ccbaa9a0577966c2c54b1c6` | MP4/FLV/DASH 內容與授權 |
| `tests-v2/suites/progressive-routing.ts` | 1–212；213–462；463–714；715–933；934–1129 | `34a868168fc066e678045f5f9aab808b558cd32fd54a4d662724f49841a49e6e` | progressive 選路、探測、失效；前置串接 O04 |
| `tests-v2/suites/progressive-transport.ts` | 1–234；235–295 | `945eb2b31708fc90f7977823e065a0c9c7a8f8f6e449d0962c0c959f4dc4de4d` | progressive 傳輸、取消與停用；getter 副作用 O04 |
| `tests-v2/suites/state.ts` | 1–236；237–445；446–704；705–892；893–1130；1131–1371；1372–1608；1609–1638 | `b04ae083ec39a0d9e14c8520d210df259b7959d715ef20d96687d66f73f4331f` | Vault／設定／禁止與過期授權；舊命名／前置 O04 |
| `tests-v2/support/catalog-settings.ts` | 1–15 | `f8c4daf03bb628df625e29163e7ae9051c9d78abd84f9458f5a4110d9402e0cf` | 明確 Catalog-only 前置 N06 |
| `tests-v2/support/clock.ts` | 1–79 | `4ae9355a5660a8abd58efe850b48b97251854ae68f193b448d6967dc5a60da86` | 虛擬時鐘及自有任務 |
| `tests-v2/support/controllers.ts` | 1–53 | `ee95e93d2aaafbf74f4a3564083403912defc78f077c6480fd925c3cf6d4ab5e` | 窄功能 stub；各案例覆寫必要方法 |
| `tests-v2/support/deferred.ts` | 1–22 | `45a9bb8eed19e68f17063568bbb899171b12ceb968a9601dde4de23dc9e9e3a5` | 顯式完成／拒絕信號 |
| `tests-v2/support/fixture-context.ts` | 1–9 | `8c2fe97ccaaa0b8a67ebb68d28bd7317a538ec1c5b8559cf1030e92a1359c040` | 情境描述子與可變閉包 |
| `tests-v2/support/measurement-storage-scenario.ts` | 1–107 | `b54d157cc74661cf85dc632a1e6545b8edf08e1326ea166be118e4e9e0325d37` | 獨立子程序觀察實際儲存拒絕 N07 |
| `tests-v2/support/player.ts` | 1–80 | `e65b493adec61b12d6d99ca8a95a6e47f289275ae5f2b777062992556dbc8d02` | 恢復讀回、落點與 SDK 模型 |
| `tests-v2/support/playurl.ts` | 1–11 | `30cb1f4e6520711bde2b33dfce57ee69c3af6217d8039523b294516c2803345d` | 具名播放轉換結果 |
| `tests-v2/support/progress-event.ts` | 1–10 | `7a224fe59b2367ad9b90a84b3c2e3a94548ada32c7da07fb5093cd94fc4635c6` | 合約用 ProgressEvent 形狀 |
| `tests-v2/support/rescue-acceptance.ts` | 1–61 | `ea919a28e2bddded0e41164d080305b1b856d092563310be5eb624622953f965` | 測試專用持續播放與位置判定 N07 |
| `tests-v2/support/rescue-dom.ts` | 1–253 | `53c4882ef72c484505a674cacea81195702cc97c9708fc858a7815509919bcc3` | 可信輸入模型及資源清理；固定掉幀欄位 N07 |
| `tests-v2/support/rescue-player.ts` | 1–71 | `e3412f216170fa0c605c5bee0488a42bf8cf00f58a6771b6aef1a1cebf856a8d` | 恢復副作用情境及 Node trace N07 |
| `tests-v2/support/runtime-fixture.ts` | 1–266 | `dddde8bd72b701836af9ae76f4bffdad8fbb747636b6b9832d5bb27ea05b7771` | Runtime 完整功能接線情境 |
| `tests-v2/support/scope.ts` | 1–52 | `fe41d8fb7f532dc375fe412c3b6cef7dfd811c872287898dfdc02a34b2105bac` | 逆序清理與全域描述子回復 |
| `tests-v2/support/startup-abort.ts` | 1–94 | `63b349335c317903ffcf6c43821fb81bb06a4adf58bfefa39e7ad038fca3c0e8` | 起播取消顯式情境 |
| `tests-v2/support/storage.ts` | 1–42 | `3b51a58218d17282d06c37f185bb52528ea66c24ee44d32c0676b0a2fa1ff6e3` | 儲存與延後鎖模型 |
| `tests-v2/tooling.ts` | 1–217；218–450；451–596 | `3f8b790eaa5272cd496fd6a3ac58cd33a1c65f2f4e1c62d3ec1998ae63bad0ef` | 測試監督、報告、期限與清理契約 N07 |
| `scripts/build.mts` | 1–87 | `c790d7a2e22bcc02831e710828633822c5036cdd8bcc47d92f18a9731d828e9e` | 純本機單一入口建置與輸入雜湊 |
| `scripts/checks/architecture-check.mts` | 1–18 | `78b2aecab394ca1d8b0a5a710e137a70e15c8f3cc3132448ee39c26d89f63d8c` | 分層 AST 圖檢查 |
| `scripts/checks/architecture-rules.mts` | 1–207 | `e23caeb1619de7a4a9f9358bf17ea603403e7ffb223385b7f4e10d331cda0926` | 分層、契約及副作用唯一所有者 |
| `scripts/checks/archive-check.mts` | 1–225；226–418；419–626；627–759 | `25dce02f4817098a853cdd1cdb03100b9a8f56dc0cda0feb5be30a0fd5d266c0` | 原件、搬移、追加日誌與 checksum 檢查 |
| `scripts/checks/docs-check.mts` | 1–236；237–431；432–638；639–714 | `3af97bb3163b804fc94dc4c525e5934f61cfe77346e3803698a0b1c6defb5848` | GFM／分類／導覽／保護；通用檢查報告 N07 |
| `scripts/checks/format.mts` | 1–61 | `7167b8534d3e415415ffbd2451077fb93d5a414acf9978a2fca293ddc2175263` | 固定範圍格式檢查／整理 |
| `scripts/checks/project-config.mts` | 1–89 | `21dca014148aaa79f25f21451caf8ae284ec882596cdff998265db04115062ef` | 固定工具與版本一致性 |
| `scripts/checks/typecheck.mts` | 1–9 | `77cdb95973b549f97896692944a74da0b02cdf890ac2efedeb08421ac7c6f117` | 三份 tsconfig 型別核對 |
| `scripts/evaluation/early-retry-evaluation.mts` | 1–167 | `5e95d92ac5ffc0da15cfef3f014e1cfcb78c00ef9f868ef81a7c26089add5601` | 保留提前重試功能離線效用評估 N07 |
| `scripts/evaluation/upstream-compare.mts` | 1–131 | `b3467d1995c887391cb174579819929fb0710238bc88d7b5a7e5b73090f1bc55` | 保留固定上游離線比較 N07 |
| `scripts/evaluation/upstream-compare/cases.mts` | 1–214；215–377 | `abaad5f8b7d91f8cab867e83476a590a7342db8a2479f46e66765baaf28854d7` | 固定歷史版本行為比較情境 N07 |
| `scripts/evaluation/upstream-compare/inputs.mts` | 1–49 | `97c97f87dae16711ced71824aa84e23671523645ba165a13141a42e8f6b33b02` | 不可變上游來源大小及雜湊 N07 |
| `scripts/evaluation/upstream-compare/model.mts` | 1–227；228–357 | `b2b2bc1b93ebcfd0737ec3ce0dac061b0a7ace7ce033ea9c5170fbd9a94bf78a` | 比較有效性、假時鐘及模型結果 N07 |
| `scripts/evaluation/upstream-compare/page.mts` | 1–259；260–511；512–742；743–843 | `ecac0d50bdb4c6b6f9001c141627cefceab3dfec7f162960be77b912b18cf8d3` | Node VM 模擬平台；歷史 API 形狀與採樣 N07 |
| `scripts/evaluation/upstream-compare/worker.mts` | 1–34 | `9fa48c31b310939a2fe4467dc35003299a46273f3796c800380e170533f35367` | 隔離比較 worker；不匯入正式 bundle |
| `scripts/lib/lib.mts` | 1–62 | `df93eeae4709223989fd9fceb40b46ea852e3185ab4b0d31d822b3ebf8858f2c` | 本機工具共用函式 |
| `scripts/lib/typescript-ast.mts` | 1–25 | `a3de5c096006f8b63f0347a74097dbc3e2302b4d475f5395db53c97e23c2f180` | 固定 TypeScript AST 支援 |
| `scripts/package.mts` | 1–31 | `e4f2c1996276e32b299f1bd99d61497054e4add778adf95e9333afeae89e94ee` | 本機封裝與 checksum；本輪只由 verify 用暫存目錄 |
| `scripts/test.mts` | 1–250；251–345 | `5a6fc20aa2e9bf3b8b192b3052237666c5417a7840d8d8df2c7be675942c555c` | 具名 Node 測試監督與摘要 N07 |
| `scripts/testing/architecture-tests.mts` | 1–202；203–222 | `306f751768034f6ebdd30e733840d625dad9bb4db6f775c393f40fd11641d24f` | 架構規則反例與功能所有權契約 |
| `scripts/testing/import-purity.mts` | 1–84 | `e106d3ab7764513e1d9c17d29a4a962bfc0e5cea1b0d697301de67b430dfda25` | 離線匯入副作用陷阱 |
| `scripts/testing/test-contracts.mts` | 1–72 | `3aff60cb5d8ecf5aba846080aed32c8605ba18da9d5c0db3a40c38126f7f7267` | 測試登記及 only 防護 |
| `scripts/testing/test-process.mts` | 1–68 | `1c5dfde89c9604e9c087d7807d5a8467dd26b02c0939f9a37b99c0cb6f0898eb` | 有界子程序、輸出與退出碼 |
| `scripts/testing/test-registry.mts` | 1–75 | `8a2d64d487cb789f8c43bd9a33e60f530f3881b27c3f4edc35f5609abcc1e765` | 18 個保留套件入口 |
| `scripts/testing/test-reporter.mts` | 1–77 | `036ea72d9becc3b9c2dcf56ae874220491f4460e50995de15dfd6aee088e3cab` | Node 事件至機器摘要；非產品報告 N07 |
| `scripts/verify.mts` | 1–99 | `d5e8267dacb888b163046c9094a3f1db92d956a5ee7274ec70aa1407b490f3d1` | 固定工具離線驗證；撤銷功能負向標記 N07 |
| `scripts/verify.ps1` | 1–7 | `d4ec60593d67f310eeb0d49a1fba198175e119ea879d6109f0dbb09c1d2cdb0d` | PowerShell verify 啟動器 |
| `scripts/verify.sh` | 1–4 | `0f4ad6edf745ed38c903460190875cb8fa8c9bb88068bf94c17ab0dcaacbbf6f` | POSIX verify 啟動器 |

## 歷史驗證導覽

[歷史索引](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/HISTORY.md)；[v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)。

<a name="v221-r1-安裝驗收2026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="隔離-b-分支原型驗證2026-10-30"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修復與根因"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="發布與安裝限制"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="修後唯一-hk04-定向窗口"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-30up141-安裝版實測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31更新後安裝核對"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31六十分鐘驗證計畫執行結果"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31iab-可用但持續靜音前提受阻"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31依使用者更正靜音方法續行與下載工具超時"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31補測與單分頁重測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="2026-10-31一次授權的單分頁缺口補測"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="v220-安裝驗收-r12026-11-01"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="澄清後在原期限內續行"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="auto-2-倍補充與本次驗收結案"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。

<a name="公開交付"></a>

此相容入口保留歷史導引，原文見 [v2.2.1 完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#v221-完整正文保存2026-11-01)；不是本版新增實測。
