# 內建瀏覽器方案改寫前的指南快照 — 2026-10-11

這是文件改寫前的逐檔正文，包含當時未提交的可用性更正。只供追溯，不是現行測試政策。現行入口為 [文件索引](../../../docs/INDEX.md) 與 [內建瀏覽器測試方案](../../../docs/IAB_TESTING.md)。各正文保留在程式區塊內，原相對連結只按原檔案位置解讀。

<a name="readme-md"></a>

## README.md

~~~~~~~~markdown
# BiliCDN_TW

BiliCDN_TW 是針對台灣網路環境維護的 Bilibili Tampermonkey 腳本，提供 CDN 選路、有限度的故障恢復與本機診斷。正式支援 **Google Chrome 與 Tampermonkey**。

正常模式預設從腳本的 **內建節點清單（Catalog）** 選路。若希望 B 站當次提供的原始與備用網址也參與選路，可在控制中心開啟「允許參考 B 站原生來源」。

目前最新公開版本 **v2.1.18 已發布**，修復 BR-09：未初始化媒體的新尋位目標（包含 0）會撤銷舊保存位置的還原，保留正常自有重載及腳本還原。15／30／15 秒、Auto／ABR 與 schema 2 不變。本版修復、驗證、公開產物及實際安裝分開記錄於 [BR-09 報告](docs/BR09_FIX_REPORT.md) 與 [最新版驗證](docs/TEST_REPORT.md)；更新網址保持 [最新 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest)。BR-01 v2.1.17 整體安裝判定不通過，本輪修補不取代其完整驗收。

GitHub Release 附件只有使用者腳本，更新網址維持原位。發布後核對公開 latest 版本、大小與 SHA-256；來源隔離及 Node 不代替 Tampermonkey 安裝驗收。

> [!IMPORTANT]
> **原作者與原始腳本：** [jiyunshi－Bilibili CDN 台灣優化](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)。本儲存庫源自原作者 MIT 授權腳本的個人修改專案；v2 是以 TypeScript 重新設計與重構的版本，並非原作者的官方版本。
>
> **AI 協作聲明：** 本修改版的維護者本人不具備自行撰寫程式的能力；程式分析、修改、測試與文件主要由 AI 協助完成。使用者應自行判斷是否適合安裝。

## 安裝與更新

1. 在最新版 Chrome 安裝 Tampermonkey。
2. 開啟 **[安裝／更新腳本](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)**，並在 Tampermonkey 確認安裝。也可從 [最新 Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest) 取得同一檔案。
3. 停用其他會改寫 Bilibili 影音網址的腳本，避免多個腳本同時選路。
4. 重新載入 Bilibili 影片分頁，讓新版本生效。

腳本的自動更新網址固定指向本儲存庫的最新 Release。從 v2 更新會沿用既有 v2 設定與學習資料；v1 設定不會遷移，使用 v1 的使用者請停用舊腳本後安裝 v2。

GitHub Release 只提供 `BiliCDN_TW.user.js`。建置資訊、校驗碼與驗證紀錄保存在儲存庫的 [Release 目錄](Release/)。

## 功能概覽

- **自動或固定 CDN：** 依合法候選與近期傳輸證據選路，也可指定內建節點。
- **影片與音訊分開判斷：** 量測、健康證據與故障處理分開記錄，避免互相影響。
- **有限度的測速與恢復：** 起播時可測試候選；健康播放期間更新證據，遇到符合條件的故障時才嘗試備援或重建播放器核心。
- **保留播放選擇：** 倍速由使用者／B 站播放器決定，包含 2x；腳本依目前倍速估算需求。畫質仍由播放器選擇，影片格式可設定 AV1、HEVC、AVC 或由 B 站決定。
- **背景播放協助：** 減少頁面切到背景時因可見性事件造成的播放中斷；健康測速仍會檢查分頁是否真的在前景。
- **連線與節點控制：** 可阻止網頁使用 WebRTC、HTTPDNS，並設定個別 CDN 的可用性。
- **本機故障診斷：** 保存有限的事故前後狀態，供使用者複製報告排查。

### v2.1.8 MP4／FLV 修正

v2.1.8 增加 MP4／FLV `durl` 播放資料處理，保留原有分段順序、時長與大小，並為每段提供符合目前模式的主備網址。預設模式會從同段原始與備用來源中選擇可安全改寫的來源；只要有必要分段無法產生合法路線，整份已辨識的播放資料便不會部分改寫後放行。

控制中心新增「最近播放資料」摘要，區分 Fetch／XHR、接納結果、DASH／MP4／FLV、影片／音訊／分段數量、上游 HTTP 狀態、數字錯誤代碼及拒絕原因。摘要不包含回應內容或簽名網址。原生來源開關、原生對照、整體停用及固定 CDN 的既有模式繼續適用；在途測速結果不能覆蓋剛選定的固定 CDN。

## 開啟控制中心

可從以下任一入口開啟：

- Tampermonkey 選單中的「⚙️ 開啟 BiliCDN v2 控制中心」。
- B 站播放器設定面板中的「⚙️ 開啟 BiliCDN 設定與診斷」。

首頁顯示腳本模式、選定 CDN、影片／音訊請求與回應來源、可播放緩衝、測速及恢復狀態。「CDN 與播放設定」提供選路與功能開關；「查看診斷報告」提供事故記錄。

### 四種使用模式

| 模式 | 可選來源 | 測速與自動恢復 |
| --- | --- | --- |
| 正常模式，原生來源關閉（預設） | 安全產生的合法內建 CDN 主備網址 | 依播放狀態與限制執行 |
| 正常模式，原生來源開啟 | 內建 CDN，以及 B 站當次提供的合法原始／備用網址 | 依播放狀態與限制執行 |
| 「測試：只用 B 站原本提供的 CDN」 | 本片合法的原始／備用網址 | 不主動測速、不自動換 CDN、不重建核心 |
| 停用腳本 | 網站原本的請求 | 停止腳本改寫、主動測速與恢復 |

**原生來源開關預設關閉，會保存並同步到其他分頁。** 關閉時，腳本辨識到的 B 站影音若無法安全改寫、沒有合法內建路線，或請求方式不適合改寫，會在送出前擋下請求，並顯示原因。若內建 CDN 與原始來源剛好是同一個主機，產生的網址可能相同，仍屬合法內建路線。

**原生對照只影響目前分頁，與持久開關分開運作。** 完整重新整理後退出；來源受到的禁止規則仍然有效。請開額外測試分頁，先啟用對照，再透過站內換片載入影片。已交給播放器的網址無法倒回重選，已送出的網站請求也不會取消。

### 預設設定

| 設定 | 預設值 |
| --- | --- |
| 腳本 | 啟用 |
| 選路 | 自動挑選內建 CDN |
| 允許參考 B 站原生來源 | 關閉 |
| 偏好的影片格式 | AV1 |
| 阻止網頁使用 WebRTC | 開啟 |
| 阻止網頁使用 HTTPDNS | 開啟 |
| 記錄更多診斷細節 | 關閉 |

影片格式偏好會在下次取得新的播放網址時生效。內建 Catalog 保留完整 **11 個節點，其中 4 個預設不可用**，可在設定中勾選允許；**勾選節點或固定 CDN 都不會解除黑名單、故障標記及其他禁止規則**。清單定義見 [catalog.ts](src-v2/domain/catalog.ts)。

### 測速、封鎖與清除資料

| 控制中心操作 | 實際作用 |
| --- | --- |
| 安排測速（不會立即換 CDN） | 等待播放穩定、緩衝充足及冷卻完成後量測候選；原生對照期間停用 |
| 封鎖最近成功回應的影片 CDN 24 小時（影片＋音訊） | 將最近成功的影片 CDN 加入 24 小時黑名單，同時限制該主機的影片與音訊；最近 60 秒沒有可用觀察時無法操作 |
| 清除測速紀錄、黑名單與故障標記 | 清除健康證據、節點限制與測速協調資料，保留功能設定 |
| 還原預設設定（不清除測速紀錄） | 重設功能與節點設定，保留既有測速紀錄 |
| 清除本分頁事故記錄 | 清除目前分頁的事故記錄，保留 CDN 設定與持久學習資料 |

## 選路、測速與恢復規則

每分頁首次符合條件的播放器媒體請求可觸發一次起播預測試，最多等待 **3 秒**、並行測試 **3 個合法候選**。同一窗口的請求共用期限，MP4／FLV 不會為每一段各開三秒測試。這是探測預算，完整 Catalog 中其餘合法節點仍可參與一般排名、備援及後續健康測速；預設模式的播放器輸出為一條主線及最多五個不同主機的合法 Catalog 備用網址。測試沒有明確結果時，仍須依目前模式選合法路線；預設模式不會因此放行原生來源。同步 XHR 與有明確逾時的 XHR 不等待起播測速，仍須通過送出前檢查。

健康播放時，符合前景、播放進度與緩衝條件後，每 **10 分鐘**最多順序量測 **3 個候選**，並共用跨分頁冷卻資料。手動安排測速也會遵守這些條件。結果只更新健康證據，**不會因測速結果或其他分頁的新資料，在流暢播放中更換目前 CDN**。

發生已確認的傳輸故障或符合 Watchdog 條件時，腳本可選擇合法備援。起播持續約 **15 秒**沒有影片進度、且符合恢復條件時，會嘗試一次不同主機的合法備援；必要時受限重建播放器核心，嘗試恢復播放位置與倍速。恢復有冷卻與次數上限，播放器拒絕自動播放時需手動按播放。

CDN 是否可用取決於當時的網路、媒體與網站回應；指定節點、測速或自動恢復都不能保證每次播放成功。

## 卡頓或黑屏時如何排查

1. 先保留出問題的分頁，避免重新整理清掉本分頁記錄。
2. 開啟「查看診斷報告」，按 **「記下剛剛的卡頓」**。
3. 等待約 30 秒收集後續狀態，再重新進入診斷頁，按「複製報告」。
4. 到 [GitHub Issues](https://github.com/YUIAOI7592/BiliCDN_TW/issues) 提供報告，以及腳本版本、Chrome／Tampermonkey 版本、畫質、影片格式、倍速與重現步驟。

診斷會區分選定備援、腳本看到新請求、收到影音資料，以及播放進度。播放器有進度不一定能證明某條備援已接手；若只留下健康觀察，也無法還原更早或重新整理前的故障。

**「腳本看到請求」不等於 Chrome 開發者工具的網路面板（Network）已確認實際目的地。** 腳本主要處理播放網址與可攔截的 Fetch／XHR；瀏覽器其他入口及 XHR 轉址存在控制限制。需要確認影音是否真的送往內建 CDN 時，請查看 Chrome 開發者工具的「網路」面板。不要把含簽名影音網址、權杖或 Cookie 的原始網路匯出檔直接貼到問題回報。

## 本機資料與隱私

設定與學習資料保存在 Tampermonkey 本機儲存空間，腳本沒有自動上傳診斷的功能。播放與主動測速仍會對 CDN 發送請求；診斷報告由使用者自行複製與分享。

| 儲存鍵 | 內容 |
| --- | --- |
| `bilicdn.v2.settings` | 功能、選路與節點設定 |
| `bilicdn.v2.restrictions` | 黑名單、故障與使用者節點限制 |
| `bilicdn.v2.routeEvidence` | 影片／音訊分開的主機健康證據 |
| `bilicdn.v2.meta` | 跨分頁測速冷卻與候選游標 |

完整簽名影音網址、路徑、查詢字串、權杖、播放器物件及事故時間線不寫入持久儲存。簽名網址只在目前播放生命週期的記憶體中使用；事故記錄保留在目前分頁，完整重新整理後消失。

診斷報告不包含完整影音網址、影片識別碼、Cookie、IP 或播放器物件。內建及已知來源可顯示主機；未知外部來源使用本分頁的代稱。

## 目前版本的驗證紀錄

**2026-10-10 本輪 BR-08 修復及 v2.1.16 發布完成：** 原七正式契約先保存 3 fail／4 pass，最終 BR-08 63／63（application 34／adapters 29）、全套 19 套件／637 正式案例及 v2.1.16 verify 通過；最終獨立安全差異 14／14 覆蓋、0 可報告發現。Chrome 來源隔離 31 個有效通過，2 個無效輸入校準排除；自有 iframe 的合成媒體與 FakeClock 不代替實際 Tampermonkey 安裝驗收。21:05:38（Asia/Taipei）已發布，遠端 main／標籤、唯一附件 **320,794 bytes** 及公開 latest 版本／SHA-256 核對一致；21:11:07.331 已核對實際新版完整本體／singleton 1／hooks。Auto 1／2 倍的 wrapper／inner 各持續按住超過 32 秒，四個有效窗口均有 dragging 保護、釋放後 dragging=false 且沒有腳本重載；正常播放／暫停／短 seek 及約 12 秒 video-only 延遲後的時間／影格恢復均有證據。延遲兩窗各在連續無進度達 15 秒後提交一次合法路線備援，audio 通行、核心重載 0、受控記憶體／持久樣本 0；2 倍的後續 recovered 獨立觀察與先前窗口間有缺口，未當成連續時序。釋放後的網站提前暫停／換核心不能計入完整 BR-01 逾時，其餘矩陣仍待完成。發布及剩餘矩陣見 [BR-08 修復](docs/BR08_FIX_REPORT.md)、[最新版驗證](docs/TEST_REPORT.md) 與 [v2.1.16 安裝版](docs/CHROME_v2.1.16_ACCEPTANCE.md)。

**2026-10-10 歷史 BR-07（v2.1.15）：** 原五契約 2 fail／3 pass→修復後 5／5；BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構與最終 verify **v2.1.15** 通過，Chrome 來源隔離 **40／40 有效案例**通過；獨立安全差異完整覆蓋，**0 可報告發現、無未處理候選**。公開 latest 已核對 **2.1.15、317,487 bytes** 及 SHA-256 一致；實際完整本體／singleton 1 也已核對。[安裝驗收](docs/CHROME_v2.1.15_ACCEPTANCE.md) 有正常 Auto 1／2 倍、鍵盤新寬限與約 12 秒影片延遲後恢復證據，但新 BR-08 拖曳缺陷及未成立的完整逾時、背景／SDK 等矩陣仍未完成。BR-08 私有正確契約 **3 fail／4 pass** 是缺陷證據，與發布前 574 正式通過分列。原生 auto-repeat、IME／nested／替換的完整 Chrome 覆蓋未宣稱完成。v2.1.14 原報告保留在 [歷史報告](archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2114-release-verification--2026-10-10)，自然網路起因與其他產品矩陣保持各自範圍。

**v2.1.6 Chrome／Tampermonkey 驗收已通過並結案。** v2.1.8 回歸另行記錄，歷史觀察及限制見 [v2.1.6 驗收紀錄](archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md)。

## 開發與專案結構

正式來源為 `src-v2/`，入口是 `src-v2/entry.ts`，契約測試位於 `tests-v2/`。v2.1.7 將應用協調、瀏覽器操作、路由政策與傳輸協定分開，並以抽象語法樹（AST）架構規則、型別化介面與獨立測試套件保護職責邊界。

現行指南、變更紀錄與驗證報告集中於 `docs/`；根目錄保留 README、AGENTS、安全政策、授權及必要建置設定。已退出流程的計畫、研究、驗收與舊工具集中於 [archive/retired](archive/retired/README.md)，來源原件與校驗碼集中於 `baseline/`。封存保留原始證據與位置對照，已發布的 `Release/` 產物維持原位。

開發工具版本由 [release.json](release.json) 與 [package-lock.json](package-lock.json) 鎖定：Node.js **26.8.1**、npm **11.19.0**、TypeScript **7.0.2**、esbuild **0.28.2**。

```powershell
npm ci
npm run typecheck
npm run architecture
npm test
npm run verify
```

可用 `npm test -- adapters` 單獨執行一個套件。`npm run build` 產生本機使用者腳本；`npm run package` 建立版本發行目錄。`npm run verify` 在暫存目錄檢查封裝，不覆寫已發布的檔案，也不包含 Codex Security 掃描。

正式產物是單一立即呼叫函式（IIFE）形式的使用者腳本，沒有執行期第三方依賴、遠端程式載入、Worker 攔截或 CI/CD。進一步說明：

- [架構與職責邊界](docs/ARCHITECTURE.md)
- [開發、測試與發行流程](docs/DEVELOPMENT.md)
- [信任邊界與資料處理](SECURITY.md)
- [版本變更](docs/CHANGELOG.md)
- [驗證與瀏覽器紀錄](docs/TEST_REPORT.md)

## 授權

MIT。原作者、原始來源與建置工具的授權資訊見 [LICENSE](LICENSE)、[來源基準](docs/UPSTREAM_MANIFEST.md) 與 [第三方聲明](docs/THIRD_PARTY_NOTICES.md)。
~~~~~~~~

<a name="agents-md"></a>

## AGENTS.md

~~~~~~~~markdown
<a name="codex-development-guide--bilicdn_tw-v2"></a>

# Codex 開發指南 — BiliCDN_TW v2

<a name="current-target"></a>

## 現行目標

- 唯一正式來源：`src-v2/`。
- 入口：`src-v2/entry.ts`。
- 測試：`tests-v2/`。
- 發行產物：`Release/v<version>/BiliCDN_TW.user.js`，`version` 取自 `release.json`。通過自動驗證及必要安全驗證後發布；Chrome／Tampermonkey 驗收另行記錄。
- 歷史 v1 Release 與標籤僅供參考；v2 建置及測試不得匯入。
- 現行文件與歷史紀錄的狀態見 `docs/INDEX.md`。有版本的計畫、驗收紀錄及發行快照只描述當時版本；目前工作見 `docs/TODO.md`。
- 已退出流程的文件位於 `archive/retired/docs/`；舊本機工具與私有證據位於 `archive/retired/local/`。封存不作 v2 建置／測試輸入，配置見 `archive/retired/README.md`。

<a name="required-workflow"></a>

## 必要流程

1. 閱讀 `docs/PROJECT_CONTEXT.md`、`SECURITY.md`、`docs/ARCHITECTURE.md` 及 `docs/DEVELOPMENT.md`。
2. 修改執行期邏輯前，先以領域層、控制器或適配器契約測試重現行為。
3. 維持分層方向：領域層 → 狀態層 → 應用層 → 適配器層／UI 組合。下層不得匯入上層。
4. 原始碼修改使用 `apply_patch`，保留使用者的無關變更。
5. 發布前執行 `npm run typecheck`、`npm run architecture`、`npm test` 及 `npm run verify`。
6. 分開記錄自動驗證與真實 Chrome／Tampermonkey 結果。

瀏覽器驗收預設使用 **Codex 內建瀏覽器的 Tampermonkey**。每次先核對實際管理器、腳本完整本體、版本與唯一執行個體；外部 Chrome 僅在需要環境差異對照時另列結果。內建瀏覽器面板隱藏不等於原生背景，背景案例仍須取得原生 hidden 與 Runtime 實際可見性的有效證據。工具能力確認不代表功能矩陣通過，也不自動恢復已暫停的自主目標。2026-10-11 實測依據見 `docs/IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md`。

背景能力先用新增分頁並切換驗證，不能只用隱藏面板。BiliCDN 會在 document 實例偽裝前景；測試須區分網站所見值、經校準的原生值與 Runtime 判定，並證明實際切換。2026-10-11 的工具 selectedTab 2→3→2 與 prototype getter=false／Runtime visible=true 未充分證明這些前提，背景窗口無效，原能力失敗判定已撤回；不得推論為 BR-01 產品缺陷或內建瀏覽器不具背景能力。

契約使用具名 `node:test` 案例，各案例以測試情境建立函式重建可變狀態。使用 `testScope(t)` 登記清理，全域替換經 `defineGlobal()`；計時器、攔截、訂閱及取消函式由所屬資源明確管理。禁止僅執行標記（`only`）、略過（`skipped`）、待實作（`todo`）或取消（`cancelled`）留在完整執行。新套件加入 `scripts/test-registry.mjs`，命令、期限及原契約對照見 `docs/DEVELOPMENT.md` 與 `tests-v2/MIGRATION.md`。工具驗證另按日期記錄於 `docs/TEST_TOOLING_REPORT.md`，不回寫已發布報告。

<a name="architectural-rules"></a>

## 架構規則

- `domain` 必須保持純粹，不得讀取 GM、DOM、Fetch、XHR、環境時鐘或計時器。時間及相對 URL 的基底必須明確傳入；可以使用注入的 `Clock`。
- 匯入非入口模組時，不得讀取 GM、修改頁面、建立計時器或啟動網路工作。`entry.ts` 負責啟動組合後的執行環境。
- `entry.ts` 只組合介面、儲存元件與控制器。
- 不得使用動態依賴集合、跨模組設定函式或公開可變的 Map／Set／計時器。
- 僅 `RouteCoordinator` 可以變更路線親和主機（目前路線綁定）。
- 僅 `MeasurementController` 可以啟動主動探測。
- 僅 `RecoveryController` 可以重載播放器核心。
- 對生命週期敏感的非同步工作，提交狀態前必須檢查適用的世代、內容週期、身分或控制器標記。
- `SignedRouteVault` 擁有簽名路線索引、不透明識別碼及原生簽名路線（Native）選路授權。政策輔助函式使用不透明識別碼與有界中繼資料；適配器與執行路徑也會處理記憶體中的 URL、資料內容及資訊清單指紋。不得建立另一份可獨立授權的 Native URL 索引，也不得持久化或輸出這些原始值。
- 診斷只能唯讀消費型別化事件。

<a name="required-invariants"></a>

## 必要不變量

- 內建節點清單（Catalog）目標僅來自可信內建項目；Native 目標必須是當前內容週期的精確 URL。
- 正常選路預設只使用 Catalog；持久原生來源開關、分頁原線對照及整體停用必須維持各自語意。
- 禁止規則適用於原始、Native、Catalog、固定及備援路線。
- 影片與音訊的健康／恢復互相隔離。
- 健康探索不得變更目前主機。
- Fetch 維持單一讀取器，並傳遞取消原因。
- XHR 的 `text`（文字）／`json`（JSON）／重用／逾時／中止行為維持相容。
- 停用期間停止所有腳本改寫及主動網路行為，不取消網站請求。
- 不得讀取、取代或包裝網站的 Worker 建構函式。
- 不得持久化或輸出簽名 URL／路徑／查詢字串／權杖、Cookie、IP 或播放器／核心物件。
- 編解碼器能力檢查不得阻擋 playurl；掉幀僅作診斷。

<a name="release-rules"></a>

## 發行規則

- 使用者已授權本專案的預設修復交付流程：功能修復完成且通過必要自動驗證及按風險要求的安全驗證後，直接提交、遞增修補版本、封裝、推送 GitHub main／版本標籤並發布正式 GitHub Release，讓 Tampermonkey 的既有更新網址取得新版；不需使用者每次重複要求推送或再次確認。僅推送原始碼不算完成腳本更新交付。
- 若當次使用者明確要求只調查、起草計畫、保留本機修改或暫緩發布，遵守該次範圍；不得把未完成修復或失敗驗證當成可發布結果。若工具或權限實際阻塞，完成可做的準備並具體回報阻塞原因。
- 發布後核對遠端 main、版本標籤、唯一腳本附件，以及公開 latest 更新下載的版本、大小與 SHA-256；真實 Chrome／Tampermonkey 安裝版驗收另行記錄，未實測不得宣稱通過。
- 不得加入 CI/CD、GitHub Actions、執行期依賴或遠端程式載入。
- v2 不產生歷史修補產物。
- GitHub Release 只包含 `BiliCDN_TW.user.js`。
- 更新 URL 維持指向本儲存庫的最新 Release。
- Codex Security 按風險使用：安全敏感變更或使用者明確要求時執行，不自動要求每版掃描。`npm run verify` 不包含安全掃描。
- 已知實際執行模型與推理設定時，提交訊息須記錄該資訊；不得複製過時署名。

<a name="documentation-maintenance"></a>

## 文件維護

- 隨對應原始碼變更更新現行指南。依程式／設定核對預設值、介面／權責、儲存行為、UI 名稱、測試命令及發布狀態。
- 事實來源為 `release.json`、`package.json`、`package-lock.json`、`src-v2/` 及 `scripts/`；有日期的測試／瀏覽器紀錄只作對應版本的證據。
- 歷史紀錄標示版本／日期並連至現行指南。保留原始觀察、限制及計畫撤銷狀態；不得將舊待完成文字或已批准驗收的限制轉為現行待辦。
- 維持 `docs/INDEX.md`、`docs/TODO.md` 與 `docs/TEST_REPORT.md` 最新版內容一致。修正現行文件時，不得回寫 `Release/v*/` 快照或已封存且不可變更的安全產物。
- `docs/TEST_REPORT.md` 保存最新版完整報告與歷史導覽；換版時將上一版完整正文加入 `archive/retired/docs/TEST_REPORT_HISTORY.md`，保留日期、版本、原錨點導引及原始限制。文件整理結果另按日期記入 `archive/retired/docs/DOC_MAINTENANCE_HISTORY.md`。
- 保留 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md` 兩個封裝輸入路徑；它們指向其他儲存庫文件的連結使用完整儲存庫 URL，確保複製到 Release 後仍可閱讀。
- 僅修改文件時，檢查連結、引用路徑／名稱、事實一致性及 `git diff --check`。未實際執行時，不得宣稱新的執行期測試或瀏覽器驗收。
~~~~~~~~

<a name="security-md"></a>

## SECURITY.md

~~~~~~~~markdown
<a name="trust-boundaries-and-data-handling"></a>

# 信任邊界與資料處理

## 現行 BR-01 新意圖位置觀察（v2.1.20）

HAVE_NOTHING的有限原生位置（包含0）優先於SDK快取，仅作新意圖保存值，不授予事件信任、userRevision、Vault身分或恢復資格。Recovery保存前後及副作用前的生命週期／路線／控制所有權檢查不變。新增try只涵蓋native readyState／currentTime；不宣稱video選取或所有snapshot getter的普遍例外安全。沒有新增網路／持久化／資料輸出。

本輪安全差異封存與封存後單行測試參數修正各自記錄於 [修正報告](docs/BR01_NATIVE_POSITION_FIX_REPORT.md)。來源模型不能替代新版真實安裝。[v2.1.19續測](docs/BR01_v2.1.19_INSTALLED_CONTINUATION.md) 保留不通過的完整矩陣與新位置保存缺陷，不回寫舊安全產物。以下版本段落保留原日期政策及證據。

## v2.1.19 空媒體鍵盤所有權紀錄

HAVE_NOTHING 保存有限新目標而沒有 seeking 時，只在同一可信派送、捕捉核心不變、非 internalReload，且候選／觀察版本、媒體／播放器／生命週期及真正可見性仍有效時，取得一次 userRevision。getter／SDK 返回後重查，pendingSeek／internalSeek 保守來源抑制不變；未知、合成、派送後及換核心不得取得新寬限。控制身分不授予 Native／探測權限，路線／Vault 仍獨立核對。

Codex Security `d3d31ada-7afb-4e77-9fb4-e0378a0db1d2` 已封存，2／2 凍結來源／測試項、0 候選／0 發現。來源隔離 30／30 不代表完整安裝驗收；版本／文件／產物另行核對。詳見 [本輪修復](docs/BR01_NATIVE_KEYBOARD_FIX_REPORT.md)。下列版本段落保留當時範圍。

## 現行 BR-09 所有權邊界（v2.1.18）

有限的原生位置觀察僅撤銷過期還原，不產生可信使用者身分或路線授權。原生媒體／播放器／lifecycle／操作修訂在 getter 返回後再次核對；reset、媒體及播放器替換清除私有單筆基準。自有 reload 初始零與 pendingSeek 的來源標記保持，正常播放增量不算 seek；原生值及物件不輸出至診斷或持久資料。

本輪 Codex Security 差異 `ad0243d6-46b4-4245-a78e-1a1e8cc58f9c` 已封存，3／3 來源／測試項覆蓋、0 候選／0 發現。它是凍結執行期差異的安全審查；後續版本、文件及產物另行核對，不宣稱全儲存庫審查或實際安裝通過。完全未被採样觀察的原生位置往返無法推定。見 [BR-09 修復](docs/BR09_FIX_REPORT.md) 與 [驗證](docs/TEST_REPORT.md)。

## v2.1.17 發布與驗收歷史



**2026-10-11 目前政策維護對象為已發布 v2.1.17 的 BR-01 SDK 重載後續恢復契約，修復、必要驗證、發布與公開產物核對完成；實際新版安裝驗收已有部分證據，完整矩陣未結案。** typecheck、44 個執行期模組架構、19 套件／716／716 與最終 verify v2.1.17 通過；本輪獨立 Codex Security 差異 `39e2743e-185d-4c7d-a04d-f6580e61385a` 已封存，11／11 差異項、0 候選／0 可報告發現。主機另警告整體工作目錄變動；四個執行期檔案與凍結來源雜湊一致，不宣稱整體目錄快照一致。最後 Chrome 來源隔離 22／22（12 個控制模型＋10 個真正可信輸入）通過並完成清理；自有 iframe、合成媒體／FakeClock 及 31 秒模型拖曳不代表新版安裝驗收。[v2.1.17](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 的公開版本／唯一腳本／SHA-256 核對完成，00:34:48.957（Asia/Taipei）已核對指定影片完整新版執行本體、唯一 Runtime／ControlCenter 及 hooks。Auto 1／2 倍正常控制與各一次真正自有 SDK 重載後續恢復取得安裝子集證據；完整期限、真正背景／gate、晚到 SDK 等仍待驗收。新增內部所有權證明不放寬既有網路授權、持久資料或診斷限制。

本文件是 `src-v2/` **v2.1.17 BR-01 後續恢復契約**的執行期信任邊界指南，保留 BR-08 完整拖曳及 BR-01～07。BR-08 與 v2.1.16 的修復、必要驗證及發布／公開產物核對為上一輪完成證據；2026-10-10 21:11:07.331（Asia/Taipei）實際 Chrome 核對該版完整本體、唯一 singleton 及 hooks，該版 Auto 1／2 倍拖曳保護、基本播放及約 12 秒 video-only 延遲後恢復保留其日期與範圍。v2.1.17 的安裝工具已還原 12／12 自有方法完整描述子，timer／liveXHR=0、held=0、patterns 空且觀察器移除；2,027 個已分類受控 request ID 的記憶體／持久樣本匹配皆 0，四個學習攔截 hook 的清理前所有權已確認。這些結果只證明受控資料及自有資源清理，Network 處理缺口與歷史滾動淘汰（everDropped=true；最終 dropped=false）不能補算歷史時序或未分類工作。設定版本以 release.json 為準，本輪修復見 [後續修復報告](docs/BR01_FOLLOWTHROUGH_FIX_REPORT.md)，發布及安裝驗收見 [驗證報告](docs/TEST_REPORT.md) 與 [v2.1.17 安裝矩陣](docs/CHROME_v2.1.17_ACCEPTANCE.md)；安全差異與 Chrome／Tampermonkey 分列，不能互相替代。原 [BR-08 進度拖曳漏辨](docs/CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 是功能缺陷證據，未當成已解決的安全發現。文件用途見 [文件索引](docs/INDEX.md)，本文件本身不要求啟動安全掃描。

<a name="untrusted-inputs"></a>

## 不可信輸入

頁面 JavaScript、`__playinfo__`、播放器資訊清單、playurl 資料內容、媒體 URL、回應標頭、主控台輸出及合成 DOM 事件都不可信。

- 選路前由 `domain/url-policy.ts` 解析並接納 URL。
- `SignedRouteVault` 擁有簽名路線索引、不透明識別碼及當前原生簽名路線（Native）選路授權。適配器及執行路徑也會在記憶體中處理 URL 與資料內容；`PlayerAdapter` 在取代／重設前保存序列化的資訊清單指紋，XHR 保存每筆請求的 URL 狀態。這些資料不得進入持久學習資料或診斷輸出，也不得成為另一份 Native 授權索引。
- 可信 playurl API 的媒體表示會取代較低信任的頁面及播放器提示所授予的 Native 資格；已撤銷的不透明識別碼不得啟動主動探測或建立新的健康證據。
- BR-03 的 cid 僅來自所屬、已辨識的 API 請求，保存在 Fetch 閉包／XHR metadata 及控制器私有狀態。只作內容關聯，不是回應驗證或 Native 授權。父目錄備援上限為影片 128／音訊 64；低信任提示不更新基準。cid 與目錄不得輸出到診斷或持久資料。請求重用、failed open、同步重入均維持 context 所有權。
- 未知外部主機必須先有自然發生、可歸因的成功傳輸才可取得證據；不得預先主動探測。
- 控制中心在封閉 Shadow DOM 內執行，操作必須來自可信使用者事件。

已辨識的 MP4／FLV `durl` 分段及 DASH 別名仍是不可信資料內容。漸進式／混合格式輸出先完成規劃才寫回 URL；必要分段若沒有合法主線，不得丟棄該段或輸出部分改寫的成功結果。這是資料內容寫回的原子性，不保證回滾 Vault／控制器登記。型別化 playurl 結果的 `accepted` 必須由每個消費端檢查。嚴格模式下，Fetch 拒絕的 playurl 使用 HTTP 503；XHR 提供安全失敗內容，保留原生 HTTP 狀態。

內建節點清單（Catalog）的來源不透明識別碼表示當前分段已接納、可用於產生內建目標的 URL。改用同段的安全備用來源時，必須保留精確路徑／查詢字串關聯及當前授權檢查。此能力不授予新的 Native 選路權限；不得因另一來源能產生 Catalog 輸出，就把不安全或不可改寫的原線直接放行。

Vault 可以保存可改寫的 PCDN URL，僅在換主機後成為正常內建目標時供 Catalog 產生使用；它仍不可選為 Native。漸進式輸出使用同段的標準來源；同媒體表示的安全 DASH 精確／Catalog 別名請求保留當前查詢字串。兩者都不得放寬最終目標限制。

<a name="persistent-data"></a>

## 持久資料

產品使用四個持久鍵：`bilicdn.v2.settings`、`bilicdn.v2.restrictions`、`bilicdn.v2.routeEvidence` 及 `bilicdn.v2.meta`。

`SettingsStore`、`RestrictionStore` 及 `EvidenceStore` 依解析器實作的限制重建已知欄位；Tampermonkey API 可用時訂閱值變更。設定寫入與限制／證據修改使用各自儲存鎖。集合及樣本上限不能推論為每個原始外層欄位都有有限上界。

`MeasurementMetaStore` 按需重新讀取物件，轉換游標／冷卻欄位，更新時保留既有原始欄位；沒有值變更監聽器，也沒有完整資料結構或有限上界驗證。量測控制器在規劃寫入時使用它的 `measurement` 鎖；`get`、`update`、`clear` 不自行取得鎖。見 [measurement-meta-store.ts](src-v2/state/measurement-meta-store.ts)。

Chrome Web Locks 可用時使用鎖，否則儲存介面直接執行工作，沒有跨分頁序列化。Tampermonkey 監聽器 API 不可用時也有替代路徑。同步能力取決於平台 API 是否可用。

產品自有持久資料為設定、限制、主機證據及量測游標／時間中繼資料。不得新增持久化的簽名 URL、路徑、查詢字串、權杖、播放器物件、媒體表示狀態或事故時間線。中繼資料的原始欄位合併不提供通用儲存清理能力。

<a name="network-authority"></a>

## 網路權限

- 適配器正規化外部觀察；只有應用層控制器可以發起選路、量測或恢復。
- 僅 `MeasurementController` 可以啟動主動探測。
- 僅 `RouteCoordinator` 可以變更親和主機（目前路線綁定）或提交備援。
- 僅 `RecoveryController` 可以重載播放器核心。
- 診斷消費型別化事件，不得施加懲罰或控制播放。
- 啟用時，Fetch 檢查的 Request 與原生 API 送出的 Request 是同一個平台正規化物件。主動探測拒絕轉址，只接納受檢主機的直接 Range 回應。
- 正常選路預設使用生成的內建 Catalog 路線。開啟原生來源參考後，僅接納合法且符合當前身分的精確路線；分頁原線對照獨立運作。整體停用會原樣放行網站請求，停止腳本主動量測／恢復。
- `trusted-api` 來源標籤依辨識出的 playurl 請求端點決定，不是密碼學來源保證，也不證明最終回應來源。仍須保留授權提升及已撤銷不透明識別碼的檢查。
- 僅使用 Catalog 媒體 Fetch 使用 `redirect: 'error'`。XHR 無法事先阻止轉址；觀察到非 Catalog 最終主機時，不確認為 Catalog 路線。未經已安裝 Fetch／XHR 攔截的請求及已送出的網站請求不在攔截範圍內；實際目的地須由 Chrome 開發者工具的網路面板（Network）證據確認。

候選清單保留全部 11 個 Catalog 主機，其中 4 個預設不可用。起播預算為每分頁一次、最多 3 個並行探測、共用 3 秒期限，MP4／FLV 不逐段建立預算。未探測候選在排名、備用輸出及後續探索前仍須通過相同限制與安全 URL 生成檢查。僅使用 Catalog 最多輸出 5 個與主線及彼此不同主機的備用網址。

僅使用 Catalog 起播沒有有效結果時，不提交測速贏家；最終送出對完整剩餘合法候選池排名。Catalog 403 只失效當前串流／主機配對，不因此授權原始來源備援。

整體停用優先於分頁原線對照及正常固定／自動選路。固定主機、Catalog 覆寫設定或原生來源設定變更會失效計畫並重設探測／恢復；舊非同步探測結果不得覆蓋當前設定。已送出的網站請求保持原樣。

<a name="browser-behavior"></a>

## 瀏覽器行為

本輪 BODY／頁面焦點的 Space、k／K 及既有倍速鍵以私有 keydown 候選關聯實際控制變化；須 isTrusted、真正可見、同播放器／媒體／核心／生命週期，且事件仍在派送。只有 paused 或有限 playbackRate 在該派送內確實改變，才取得一次 userRevision。editable／封閉控制中心／IME／Ctrl／Meta／Alt、合成或忽略命令及派送後工作不能取得身分。播放器區域的既有 keydown 操作觀察及下述 BR-07 seek 鍵規則保留；腳本的還原方法清除自己的候選，不能冒充使用者操作。零延遲 timeout 僅釋放參照，清理確認候選及監聽器所有權。

自有 SDK reload 的 pause／空核心例外僅屬本次合法 stall token 與 reload 修訂，透過 `PlayerPort.ownedReload(revision)` 回傳有界布林證明；DOM／核心／事件留在適配器私有記憶體。最多接納本次第一個替換核心，原核心在空隙後回來、第二次替換、新可信操作、hidden／control-loss 或生命週期失效都撤銷。空核心上的舊 reload 標記不具資格；首個非零替換須標記相符、初始化狀態不是 false 並通過健康觀察，每個 seek／setRate／play 前仍核對最新 video 請求、Vault、政策／限制與 token。

SDK 初始化的未知 seek 撤銷舊位置還原，不猜成可信操作，不覆寫 SDK 最新目標；其餘合法播放意圖仍受重載後 15 秒無進度期限與所有權檢查。只有實際時間／影格進度才能停止無進度計時，兩個連續有效採樣才 recovered；保留尺寸、readyState 或初始化 seek 跳躍不能清除失敗／breaker。已還原且首次進度被接納後，以同一穩定所有者維持最多 15 秒的確認資格，不延長 pause／空核心租期、不授予還原副作用或新核心接納；未形成持續進度仍失敗。終止後 SDK resume 不重開救援，真正進度或新的使用者／媒體所有權才可清除失敗停滯抑制。觀察租期到期、同步重入與晚到 Promise 不能復活或回寫舊動作，也不能否定已接納的合法進度。此內部證明不授予 Native 權限，不新增持久或診斷識別資料；未經可觀察方法的外部核心替換仍有既有辨識限制，不能把頁面標記描述成認證。

BR-01 的控制觀察僅提供取消／動作所有權，不授予 Native 權限。可信 pointer／非 seek key 需 isTrusted 與播放器區域；非 seek key 僅觀察 keydown。BR-07 的 seek 鍵可來自頁面焦點，但排除 editable／控制中心／組字／Ctrl／Meta／Alt，須真正可見、該可信 keydown 或 keyup 尚在派送、同播放器／媒體／生命週期，且實際有限位置改變，並 seeking 或 readyState 0／捕捉核心未變／非 internalReload，才取得一次使用者修訂。同派送的 wrapper／媒體／controls／冒泡觀察去重；keydown、repeat、keyup 若各自形成新 seek，各自取得一次身分，沒有位置變化則不計數。eventPhase NONE、腳本還原及晚到工作不能取得新寬限；鍵盤不建立按住狀態或延遲窗口。零延遲 timer 僅釋放私有事件參照，清理綁定實際事件種類且舊回呼確認候選身分。pendingSeek 保守抑制腳本還原，不因可信輸入全面清空；來源無法可靠辨識時不猜測使用者歸因。媒體及 page seek／reload 另有觀察修訂。core reload／還原仍核對最新 video 請求、Vault／政策／禁止／固定路線、操作及核心身分。自有 reload 的替換標記來自頁面觀察，無法認證所有未經可觀察方法的外部替換。監聽器由 adapter reset 清理，seek／reload wrapper 還原確認目前所有權；不把 DOM／事件／核心物件交給應用層或診斷。

BR-08 指標拖曳使用目前播放器區域內的可信 pointerdown 及已知進度祖先，包含功能性 `.bpx-player-progress-wrap`；命中祖先不能跨出播放器區域。尚未 seeking 或改位置的預覽也取得保護，但不因此授予新的選路／探測權限。單一私有手勢保存 pointerId、媒體、播放器及生命週期；新合法進度按下取代舊手勢，同指標可信 pointerup／pointercancel／lostpointercapture 才可釋放。合成事件、別的指標及非進度按下不撤銷當前手勢，同步重入後核對觀察版本與物件身分。

真正 hidden、可信失焦及生命週期／媒體／播放器失效撤銷手勢。VisibilityAdapter 的既有 guard 在阻擋事件前發布內部 control-loss 通知；入口注入，控制觀察取消訂閱，失敗 listener 不破壞 guard，controls() 保留真正可見性防漏。通知不把 DOM／事件交給應用層，不改網站可見性覆寫、不新增 pointer capture 或拖曳 timeout。

監控停滯、watchdog 及冷起播都排除 dragging，拖曳清除舊停滯及連續計數，不消耗起播救援嘗試。Recovery 收集位置／倍速前後核對 controls，提交 token 前重新檢查最新有效資格、生命週期、媒體／核心／操作、已存在 token、breaker 與總額；既有每個副作用及晚到 Promise 所有權檢查保留。一般停滯釋放後取得新 15／30 秒；冷起播保留原 firstMediaAt，可能立即救援，不重開預算。公開 API、應用層快照及 schema 2 不變，也不新增持久或診斷識別資料。

腳本不取代或檢視 `Worker`，不建立 Worker 二進位資料物件（Blob）或訊息通道，也不載入遠端程式。

WebRTC 還原前會確認已安裝的讀取存取器／寫入存取器仍屬於本腳本。可見性清理會移除監聽器，嘗試還原保存的 `document` 屬性描述子或移除自有屬性；目前可見性實作還原前沒有檢查屬性描述子所有權。描述攔截時必須依各自的還原行為說明。

<a name="reporting"></a>

## 回報

診斷輸出有上限並經遮蔽，可以包含正規化的 Catalog 或已知 Native 主機；未知第三方主機使用分頁代稱。不得包含媒體 URL、路徑、查詢字串、權杖、影片 ID、Cookie、IP 或播放器／核心物件。

最近 playurl 摘要只複製傳輸類型、時間、原生 HTTP 狀態、接納結果、最多三種已知格式、有上限的影片／音訊／分段數量、數字上游 `code` 及列舉拒絕原因。只保存一筆不可變紀錄，不保存資料內容、額外結果欄位或例外文字。此摘要不證明實際網路目的地或播放成功，也不新增持久鍵。

執行期問題請透過儲存庫問題追蹤區回報，不要附上未遮蔽的瀏覽器網路匯出檔。


## XHR 準備與取消原因

XHR 每個等待請求內部最多兩次原生 open；每個同步還原边界重查 owner／phase／原生 OPENED，最新政策與原生目標一致才歸因及送出。未被原生接受的 dispatch 例外清除 pending 歸因，不記錄 CDN 失敗樣本；已送出請求不重播。本地終止事件逐個檢查所有權，不能污染重用的請求。起播 gate 的 AbortSignal reason 只回傳 caller，不輸出、持久化或傳給共用 probe controller；falsy 原值也必須保留。
~~~~~~~~

<a name="docs-project-context-md"></a>

## docs/PROJECT_CONTEXT.md

~~~~~~~~markdown
# BiliCDN_TW v2 專案脈絡

## 現行 BR-01 新意圖位置保存（v2.1.20）

新恢復意圖在原生 HAVE_NOTHING 下保存有限 currentTime，包含0，避免 SDK 的尋位前快取覆蓋新目標。已初始化媒體保留 SDK 讀取語意；非有限值或原生讀取例外回退。位置只是觀察，不授予新使用者修訂或路線資格；Recovery 保留保存前後及每個副作用前的所有權重查。Auto／ABR、15／30／15、schema2不變。

來源／正式契約與真實安裝分列，見 [修正](BR01_NATIVE_POSITION_FIX_REPORT.md)、[v2.1.19續測二元判定](BR01_v2.1.19_INSTALLED_CONTINUATION.md) 及 [最新驗證](TEST_REPORT.md)。完整安裝矩陣不因本機修正自動通過；下列版本段落保留發布時範圍。

## v2.1.19 空媒體鍵盤修復紀錄

可信 keydown／keyup 的實際有限新目標，在 seeking 或原生 HAVE_NOTHING 下可取得一次新使用者修訂；後者另要求捕捉核心未變且非 internalReload。候選仍須同一派送／版本／媒體／播放器／內容及真正可見，internalSeek／pendingSeek 來源抑制不變。未知位置只撤銷過期還原，不能猜成使用者。公開 API、schema 2、Auto／ABR 和 15／30／15 不變。

本機正式 755 契約、整合驗證及 Chrome 原生可信輸入來源隔離 30／30 通過；安全凍結差異 2／2、0 發現已封存。發布與實際新版完整 BR-01 安裝判定以 [最新驗證](TEST_REPORT.md) 及 [修復報告](BR01_NATIVE_KEYBOARD_FIX_REPORT.md) 為準，下列版本段落保留當時範圍。

## 現行 BR-09 契約（v2.1.18）

PlayerAdapter 在目前媒體／播放器／內容生命週期內保存一筆私有原生位置基準。HAVE_NOTHING 期間觀察到不同的有限位置（包含 0），即撤銷過期位置還原；不要求 seeking 事件，也不依 SDK 快取判定。正常已初始化播放進度不增加 seek 修訂。腳本自有 reload 的初始歸零及 pendingSeek／內部還原保留來源抑制。

未知目標變更只撤銷舊位置，不授予使用者修訂、不重開 15／30／15 秒、不新增路線權限。每次讀取後重查媒體、播放器、內容及操作修訂；reset／替換清除基準。完全未被觀察的原生位置往返無法由採樣推定，這是明確限制。

本輪 BR-09 正式契約與來源隔離通過；發布及實際安裝判定見 [修復報告](BR09_FIX_REPORT.md)、[最新版驗證](TEST_REPORT.md) 與 [v2.1.18 瀏覽器紀錄](CHROME_v2.1.18_ACCEPTANCE.md)。BR-01 整體不通過的 v2.1.17 判定保留，本輪不以 BR-09 修補取代全部 BR-01 驗收。

## v2.1.17 判定與發布歷史



本文件是現行產品與開發契約。文件用途及歷史紀錄見 [文件索引](INDEX.md)；版本與工具設定以 [release.json](../release.json)、[package.json](../package.json) 和 [依賴鎖定檔](../package-lock.json) 為準。內建節點清單稱為 Catalog，原生簽名路線稱為 Native。

**2026-10-11 現行驗收判定：BR-01整體不通過，本輪判定完成。** [最終矩陣](BR01_v2.1.17_FINAL_ACCEPTANCE.md)只記通過／不通過：Auto2完整有界救援通過，Auto1完整期限與未取得必要現場證據的項目不通過；原因與程式缺陷分列。已確認未修來源問題BR-09保留，其他有效子集及發布證據不作廢。本輪不修改產品契約、來源或Release；以下較早同版狀態保留歷史時間點，現行結論以上段為準。

### 本輪之前的同版紀錄

**2026-10-11 續測新增未修復的 P2 [BR-09](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md)。** HAVE_NOTHING的直接有限目標變更不一定產生seeking；歸零後可能漏撤銷舊位置，原生Chrome來源隔離已取得0→舊0.25的覆寫，另三個正常對照通過。既有「未知新目標先撤銷舊還原、0有效」契約不變；目前實作的這個入口尚未滿足。Node2 fail／3 pass與發布時716正式通過分列，網站完整因果、BR-01完整安裝矩陣仍待。正式來源／測試／版本未變，現行待修見[TODO](TODO.md)。

**2026-10-11 現行版本 v2.1.17：BR-01 SDK 重載後續恢復修復、必要驗證、正式發布及公開產物核對完成；新版安裝驗收已有部分證據，完整矩陣未結案。** 自有 SDK reload 的暫時 paused／空核心、初始化 seek 撤銷舊位置還原、BODY 播放／倍速鍵的實際新操作，以及進度確認與終止後不重試均已納入正式契約。全套 **19 套件／716／716 正式案例**、typecheck、**44 個執行期模組**架構檢查及最終 verify **v2.1.17** 通過；獨立 Codex Security 差異 **11／11 項、0 候選／0 可報告發現**。掃描主機另警告整體工作目錄變動；四個執行期檔案與凍結來源雜湊一致，不能據此宣稱整體目錄快照一致。Chrome 最後來源隔離 **22／22**（12 個控制模型＋10 個真正可信輸入）通過並完成清理；自有 iframe、合成媒體／FakeClock 與 31 秒模型拖曳不代表新版安裝驗收。[v2.1.17](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 於 00:31:14（Asia/Taipei）發布，唯一 **332,575 bytes** 腳本及無認證公開 latest 的版本／大小／SHA-256 核對一致；**00:34:48.957 已核對指定影片的完整 v2.1.17 執行本體、唯一 Runtime／ControlCenter 及 hooks**。Auto 1／2 倍正常暫停／恢復／短 seek，以及各一次真正腳本自有 SDK 重載後續恢復取得安裝版證據；完整期限、背景與 gate 等剩餘項目仍待驗收。詳見 [BR-01 後續修復](BR01_FOLLOWTHROUGH_FIX_REPORT.md)、[v2.1.17 安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md)、[驗證報告](TEST_REPORT.md) 與 [TODO](TODO.md)。

### 已發布基準與上一輪安裝證據

**BR-08 完整拖曳契約修復與 v2.1.16 發布完成；BR-01 完整安裝驗收仍未完成。** 本輪修復外層進度列漏辨，將拖曳保護涵蓋監控的停滯、watchdog、冷起播及所有核心恢復入口。公開發行基準為 v2.1.16，必要驗證、來源隔離及公開產物核對完成；2026-10-10 21:11:07.331（Asia/Taipei）已核對實際新版完整本體、唯一 singleton 及 hooks。Auto 1／2 倍 wrapper／inner 的四個超過 32 秒拖曳窗口及釋放取得有效保護證據，正常播放／暫停／短 seek 及約 12 秒 video-only 延遲後恢復已取得證據、腳本重載 0；完整停滯退出與其餘安裝矩陣仍待完成。原 [BR-08](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 的失敗與 inner 對照保持原狀，現行工作見 [驗證報告](TEST_REPORT.md) 與 [TODO](TODO.md)。Auto 長 seek 的 15／30／15、既有修復及 schema 2 不變；自然網路起因與其他驗收獨立追蹤。

BR-07 修復與 v2.1.15 發布已完成，實際安裝版取得部分驗收。可信 keydown／keyup 同派送實際 seek 涵蓋網站右鍵提交；該版正式 574 案例、最終 verify、獨立安全差異及 Chrome 來源隔離通過，公開 latest 版本／大小／SHA-256 與實際 body／singleton 1 核對完成。Auto 1／2 倍正常鍵盤及新 15 秒寬限有證據，續測再發現 BR-08。歷史結果見 [BR-07 修復報告](BR07_FIX_REPORT.md) 與 [v2.1.15 安裝版](CHROME_v2.1.15_ACCEPTANCE.md)。

## 現行產品

<a name="br01-owned-sdk-reload"></a>

### BR-01 自有 SDK 重載後續恢復契約

v2.1.17 只在 RecoveryController 已持有的合法停滯 token 與本次自有 reload 所有權均有效時，容許 SDK 重載同步暫停及暫時沒有核心。這些階段不結束同一段救援，也不能重開起播預算、停滯期限、重載額度或 breaker。只有本次 reload 修訂對應的第一個替換核心可進入還原；空核心、保留的舊標記、可觀察的外部 reload／後續替換及新使用者操作不能取得此資格。還原須通過健康觀察，核心不為空、本次 reload 標記相符且初始化狀態不是 false，並在每個副作用前重查生命週期、當前 video 路線、政策／授權與操作身分。這是適配器的私有因果觀察，不認證所有未經可觀察方法的外部核心替換。

SDK 初始化若自行尋位，仍立即撤銷舊位置還原，不把它猜成新的使用者操作，也不再回寫保存的舊位置或小數位置。符合自有重載所有權的播放意圖可以有界等待；普通網站 pause、可信新 pause／seek／倍速、拖曳、真正 hidden、失焦或所有權失效仍撤銷舊動作。重載後完整 15 秒沒有實際進度須失敗並釋放意圖；第一個有效進度停止無進度重載計時，兩個連續有效採樣才標示 recovered；確認期間若 15 秒未形成持續進度仍失敗。已還原並接納實際進度後，只以相同穩定所有者完成有界確認，不能因自有觀察租期到期或 SDK seek 修訂已改變而否定已接納的進度，也不再授予 seek／rate／play 或新核心接納。終止後 SDK 自行 resume 不重新救援，須有真正進度或新的使用者／媒體所有權才可建立新停滯段。

BODY／頁面焦點的可信 Space、k／K 與既有倍速鍵，只在同一 keydown 派送內確實改變 paused 或有限 playbackRate 時取得一次新 userRevision。按鍵本身、忽略命令、合成事件、輸入欄位／控制中心、組字／修飾鍵與派送後工作都不能取得身分；沿用真正可見性及播放器／媒體／核心／內容所有權檢查。播放器區域的既有操作觀察及 BR-06／07 seek 派送規則保持。

手動呼叫 v2.1.16 實際安裝版 Adapter.reload 的 Chrome 校準，已分別觀察 Auto 1／2 倍同步 native pause、空核心、第一個標記新核心及 SDK 整秒 seek；它沒有經由 Recovery token 啟動，只校準 SDK 時序。v2.1.17 最後的 22 個來源隔離案例另驗證控制器契約與真正可信輸入，仍不能替代修補版安裝驗收。實際載入 v2.1.17 後，Auto 1／2 倍各觀察一次 Recovery 啟動的自有 reload：跨過 SDK pause／空核心、接納第一個標記新核心、保留 SDK 整秒 seek，再還原倍速／播放意圖，兩次時間／影格進度後 recovered；未呼叫 Adapter.seek 回寫舊位置。這些證據只證明自有重載後續恢復子集；攔截窗口釋放後的恢復、網站提前暫停／外部換核心與失敗的 seek 前提不補算完整 15／30／重載後 15 秒退出。Auto 1 倍 Network 有截斷及 76.071 秒處理空隙，歷史滾動觀察曾淘汰事件（everDropped=true；最終 dropped=false），不能補成連續證據。原 87.785 秒自然停滯的完整因果仍待定位：既有證據含先前 video timeout 與非零傳輸 bytes，但欠缺原始 timeout 設定、完整 Network 及 SDK 操作者，不能據此認定 CDN 故障。其他剩餘驗收繼續分列。

2026-10-10 的 [BR-07 修復](BR07_FIX_REPORT.md) 以既有 BR-06 同派送機制同時觀察 keydown／keyup。BODY／頁面可信 ArrowLeft／Right、Home／End、j/J、l/L 先建立私有候選，僅該派送內的實際有限尋位取得一次新修訂；同派送多入口觀察去重，keydown、repeat、keyup 各自造成新 seek 時各自計數。editable／控制中心／IME／Ctrl／Meta／Alt、合成／忽略命令、延後工作及腳本還原不重開期限。Shift／repeat 必須確實造成新 seek。鍵盤不建立按住狀態或延遲關聯窗口；pendingSeek 的保守腳本來源抑制保持。Monitor 的網站／Auto 重綁語意、15／30／15 與真 hidden 撤銷不變；正式契約、來源隔離及完整安裝結果分列。

BR-08 的完整拖曳契約由單一私有手勢持有：目前播放器區域內的可信進度 pointerdown（含 `.bpx-player-progress-wrap`）立即保護尚未提交 seek 的預覽，保存 pointerId、媒體、播放器及內容生命週期。相同可信指標的 pointerup／pointercancel／lostpointercapture 才可釋放，允許移出命中區後結束；非進度按下、其他指標或合成終止不能撤銷當前手勢。真正 hidden、可信失焦、reset、媒體／播放器替換及內容失效撤銷手勢，不新增 timeout 或 pointer capture。

拖曳期間清除舊停滯段與 watchdog 計數，監控不提交備援，Recovery 不建立新 token；舊 token 在所有權檢查時失效，晚到 Promise 不復活。普通 BR-01 停滯在釋放後第一個合資格 tick 從最新位置重新取得 15／30 秒期限，位置 0 有效。尚無播放進度、未提交 seek 的冷起播依原 firstMediaAt 重評，可能釋放後立即救援；不新增全域釋放寬限，也不重開每分頁起播預算。

v2.1.9 包含以 `71f7ddd` 為基準的 **17 項功能與競態修復**；修復及新增契約見 [修復對照報告](FUNCTIONAL_FIX_REPORT.md)。schema 2、持久鍵及舊樣本相容性維持不變；2026-10-04 的已發布驗收不構成本次修復的瀏覽器證據。

- 正常模式參考 B 站原生來源為持久開關，預設關閉。發布前完成自動與必要安全驗證，實際 Chrome／Tampermonkey 結果另行記錄。
- 唯一正式來源：`src-v2/`。
- 正式入口：`src-v2/entry.ts`。
- 目標平台：最新版 Chrome＋Tampermonkey。
- 正式產物：`Release/v<version>/BiliCDN_TW.user.js`（`version` 取自 `release.json`）。
- v1.9.6 僅作功能參考，不是建置輸入或相容目標。
- 歷史計畫、研究與驗收記錄集中於 `archive/retired/docs/`；舊開發工具與本機證據集中於 `archive/retired/local/`。位置對照見 [封存索引](../archive/retired/README.md)，現行 `src-v2/`、`tests-v2/`、授權基準與全部 `Release/` 維持原位。

v2 是全新 TypeScript 架構。它不讀取 v1 設定或學習資料，不提供 `unsafeWindow.BiliCDN`、檔頭設定、舊快照別名、遷移或測試橋接介面。

## 產品不變量

- Auto 是主要使用場景，不鎖畫質或改網站 ABR。單一無進度停滯段於 15 秒最多嘗試一次合法 video 備援，30 秒最多重載一次，重載後 15 秒沒有進度則失敗退出；依每秒監控的第一個合資格 tick 執行。保留總額與 90 秒 breaker。
- 首次採樣、seek 跳躍、寬高／緩衝增加不能宣告 recovered；非 seeking／paused／ended／error 的時間前進超過 0.05 秒，且可取得影格時有新影格才是進度。首次有效進度結束救援計時，連續兩次才宣告恢復。
- 新使用者操作、拖曳、普通網站暫停、真正 hidden、生命週期或授權失效撤銷舊還原；僅本次合法自有 reload 的暫時 SDK pause／空核心適用上述有界後續恢復。網站重試／Auto 改表示重新綁定最新 video 請求，保留同段起點及已用額度，不能回寫舊位置。位置 0 有效；既有死核心／長暫停／冷起播門檻保留。

- 每分頁首筆可歸因的播放器媒體請求可觸發一次最長三秒、最多三條合法路線並行的起播預測試；等待中的請求共用一個窗口，MP4／FLV 不逐段重開窗口。預設正常模式不以 `root-original` 或 `native-signed` 候選身分探測或回退。
- Catalog 保留 11 個內建節點，其中 4 個預設不可用。探測上限不縮減完整候選池；其餘合法節點可參與排名、備援與後續健康測速。僅使用 Catalog 播放器輸出最多五個與主線及彼此不同主機的合法備用網址。
- 預設正常模式只依內建 Catalog 候選選路、探測和提供播放器網址，不直接採用 B 站提供的原始或備用路線；若 Catalog 主機與原線重合，生成的網址可能與原線相同。無法安全生成合法 Catalog 路線時，在送出前封鎖該媒體請求。
- 開啟持久原生來源參考開關後，正常模式才可依現有授權與限制條件納入原始及 Native 路線。本分頁原線對照模式獨立於此開關，只使用 B 站提供的合法精確簽名 URL，且不進行腳本測速、自動換線或核心恢復。
- 起播期無明確傳輸失敗而持續無影片進度時，可一次性提交不同主機的合法備援，並由唯一恢復控制器受限重載。
- 健康播放期間量測只更新證據，不改親和主機。
- Catalog 只來自內建可信清單；Native 只能使用當前內容週期、同媒體表示的精確簽名 URL。可信 API 首次接納同群組時，撤銷先前 page-hint／player-MPD 的可選路線與不透明識別碼；後到提示不得重新授權。
- 路徑無法安全辨識的當前內容週期精確簽名 URL 只可供觀察與禁止判定，不授予 Native 選路或主動測速權限。
- 簽名 URL 不得持久化或進入診斷。
- 黑名單（`black`）、失效（`dead`）、使用者停用、預設不可用與主機鎖定優先於排名、固定設定及備援。
- 影片／音訊證據與恢復嚴格隔離。audio 備援只能處理音訊路線，不能建立影片核心重載意圖；影片自身的 watchdog、播放意圖與起播救援仍有效。
- 已開始的播放器請求不取消、不重送。
- Fetch／XHR 攔截安裝狀態與原生呼叫僅屬腳本內證據；僅使用 Catalog 政策只涵蓋腳本處理的 playurl 輸出與可攔截媒體請求，實際網路請求及其他瀏覽器入口須由 Chrome 開發者工具的網路面板（Network）核對。
- Fetch 本文維持單讀取器，取消原因傳回原讀取器。
- Fetch 的政策判定與原生送出共用同一個瀏覽器正規化的 Request；主動測速不跟隨轉址，只接受受檢主機的直接 206 回應。
- 停用後不改寫、不主動量測；網站請求保持原樣。
- 網站 Worker 建構函式完全不碰觸。
- 所有親和主機變更由 `RouteCoordinator` 建立可追溯的 `RouteDecision`。
- 所有重載或恢復操作由 `RecoveryController` 建立可追溯的 `RecoveryAction`。
- `RuntimeController` 統一協調設定失效、探測／恢復重設與備援事件；控制中心透過 `ControlCommands` 執行變更。`PlayurlController` 管理媒體表示登記與內容週期，適配器處理資料內容相容及寫回。
- `MeasurementMetaStore` 保留既有中繼資料鍵與量測鎖語意，按需讀取資料；不可把它描述成與設定、限制、證據儲存元件相同的驗證與訂閱機制。
- `SignedRouteVault` 集中管理簽名路線授權與索引；適配器的請求狀態、資料內容和資訊清單指紋仍可能在分頁記憶體中含完整網址，禁止進入持久學習資料及診斷。

<a name="未發布修復契約"></a>

## v2.1.9 修復契約

2026-10-09 的 **BR-02 修復納入 v2.1.10**：XHR open 使用可回復的所有權移交，失敗不撤銷原本地請求，成功同步回呼可操作新請求。Chrome 同步選項錯誤清除底層準備時，只重新準備仍未送出的 waiting 請求，保留送出前政策重查；已送出不重播。正式、Chrome 隔離及後續安裝版部分驗收／gate 限制見 [BR-02 修復報告](BR02_FIX_REPORT.md)。下列 17 項仍描述已發布 v2.1.9。

2026-10-10 [BR-03 原調查](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) 確認首項父目錄判定造成清單排列誤增 epoch；現已在本機修復。BR-01 長 seek 與未完成驗收見 [安裝版紀錄](CHROME_v2.1.10_ACCEPTANCE.md)，不因 BR-03 修復結案。

- 可信內容識別優先採用所屬 playurl 請求的 cid：唯一一個 1～20 位十進位字串、去除前導零且非零，不從頁面／播放器／回應猜測。相同 cid 的畫質／編碼清單完全換組仍維持 epoch，不同 cid 即使共用路徑也重設。
- 任一側缺少 cid 時，以已接納 primary 的完整父目錄集合備援；有影片只比較影片，純音訊才比較音訊。交集保留歷史，影片 128／音訊 64 上限，優先本次再排序填入舊項。首次 cid 先對齊既有基準；無 cid 且完全無有效目錄不更新。低信任提示及重複物件不能污染基準，generation 改變清除基準。
- 沒有有效 cid、也沒有共同路徑時無法可靠證明同片，採保守重設；不新增 API 逆序回應政策。cid／目錄只在私有記憶體，不能授予 Native 權限、持久化或進入診斷。
- 真換片時同步重設監控、量測、恢復及播放器快取，再登記新表示；同片排列／換畫質不重設，每分頁一次的起播預算不重開。
- 新可信 MP4／FLV 回應刷新同段的有界來源；來源改變即撤銷舊 handles／aliases 及授權身分，同一正規化來源集合保留身分。沒有合法新來源時拒絕輸出，不回用舊簽名；DASH、同物件防篡改及低信任提示限制維持原契約。
- 合法固定主機優先於健康親和。舊政策修訂的傳輸完成可留下仍符合生命週期／授權條件的健康證據，但不得更新目前表示、親和或 Native 授權，也不得觸發恢復；儲存等待前後均檢查。
- 首次非零播放位置只建立採樣基準。恢復先處理 seek、ended 及媒體錯誤；晚到的 play 拒絕只能改變仍由該恢復動作擁有的結果。
- 健康探索在取得鎖後重查當前安全條件及表示；取消的規劃不消耗候選嘗試、游標或冷卻，時間以取得鎖時為準。
- request／startup／challenge 樣本使用平台注入的執行環境隨機前綴與序號，長度不超過 64 字元；同工作重複回報沿用 ID。schema 2、持久鍵與舊樣本相容，不清除資料，也不能復原過去已被覆蓋的樣本。
- XHR 送出前重查政策。等待期間中止會完成一次終止通知且不晚到送出；reopen 撤銷舊事件所有權。安全失敗內容維持 text／json 型別，同步 XHR 重開不寫入禁止的 responseType／timeout setter。已送出請求維持原生取消／逾時。
- Catalog checkbox 透過單節點命令在鎖內合併最新設定；非同步 UI 命令可完成，但只有當前開啟視圖可以刷新或移動焦點。

## v2.1.8 MP4／FLV 契約

以下契約自 v2.1.8 納入。

- `PlayurlAdapter` 辨識根層、`data`、`result`、`video_info` 已知容器中的 DASH 與 MP4／FLV `durl`；保留分段順序及原有時長、大小、品質資料，不以 `order` 是否存在或連續作為分段索引。
- 每段各有媒體表示身分。Catalog 改寫使用 Vault 提供的第一個合法、可安全換主機的來源不透明識別碼，必要時可取自同段備用來源；不以不同片段的路徑／查詢字串代替本段來源，不建立第二份 Native 授權索引。
- 可安全換成正常 Catalog 目標的 PCDN 來源僅提供生成能力，不因此取得 Native 可選資格；DASH 則保留同媒體表示合法傳入的精確／Catalog 別名的既有路徑／查詢字串行為。僅使用 Catalog 起播沒有有效測速結果時不提交測速贏家，送出前由完整剩餘合法 Catalog 池正常排名。
- 已辨識的漸進式／混合播放資料先完成規劃才寫回 URL 欄位；必要分段無法規劃時回傳拒絕結果，保留輸入而不輸出部分成功的分段列表。此原子性描述資料內容寫回，不表示 Vault／控制器登記可回滾。
- 處理結果為唯讀 `PlayurlTransformResult`，含 `accepted`、已辨識格式、影片／音訊／分段數量、數字上游 `code` 與固定原因列舉。Fetch／XHR 依 `accepted` 判斷；僅使用 Catalog 拒絕時 Fetch 提供 HTTP 503，XHR 提供安全失敗內容並保留原生 HTTP 狀態。
- 模式依序套用整體停用、分頁原生對照及正常選路；正常模式保留固定 CDN／自動選路與原生來源開關，禁止規則始終有效。固定 CDN、Catalog 覆寫設定或原生來源設定變更會失效舊計畫並重設測速／恢復；送出與提交仍重查當前身分及設定。
- 傳輸摘要只保存一筆最近結果，使用明確欄位清單、最多三種格式及有上限的數量，不保存回應本文、網址、路徑／查詢字串／權杖或例外文字。它是腳本觀察，不是實際 CDN 目的地或播放成功的證明。

## 交付規則

- 外部 B 站 CDN 優化專案的調查見 [外部 CDN 專案研究（2026-09-25）](../archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md)；Node 初篩與內建瀏覽器播放結果見 [CDN 測試結果（2026-09-25）](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md)。新增節點計畫已撤銷，只保留測試紀錄；現行 Catalog 與發布範圍不變。

- 工具版本由發行設定與依賴鎖定檔鎖定；TypeScript 同時供型別檢查與本機 AST 架構檢查使用，esbuild 供建置／測試打包使用。
- 發布前必須通過型別檢查（`typecheck`）、架構檢查（`architecture`）、功能測試、可重現建置、語法與校驗值驗證。
- 模擬／自動測試與真實 Chrome／Tampermonkey 結果分開記錄。
- GitHub Release 只附使用者腳本；CHANGELOG、TEST_REPORT、資訊清單與 SHA-256 留在儲存庫。
- v2 不產生增量／累積修補，也不依賴舊打包產物測試情境。
- 不建立 CI/CD 或 GitHub Actions。
- Codex Security 按風險使用：安全敏感變更或使用者明確要求時執行，不強制每版掃描。`npm run verify` 不包含安全掃描。
- 程式或發行狀態改變時，同步維護現行指南與最新驗證摘要；歷史文件保留原始日期、版本、觀察及限制，已封裝的 `Release/v*/` 不回寫。
- v2.1.6 Chrome／Tampermonkey 驗收已由使用者批准通過、已結案；其覆蓋限制與舊文件的待驗收文字不構成現行待辦。v2.1.7 沒有新的瀏覽器結果宣稱。
- v2.1.8 的 2026-10-04 完成紀錄與限制見 [歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)：完整公開 MP4 尚無現場樣本，FLV 僅有自動契約證據；覆蓋限制不另列為已批准待辦，也不重開 v2.1.6 驗收。
~~~~~~~~

<a name="docs-architecture-md"></a>

## docs/ARCHITECTURE.md

~~~~~~~~markdown
<a name="v2-architecture"></a>

# v2 架構

## 現行 BR-01 新意圖位置保存（v2.1.20）

PlayerAdapter.currentTime 在目前 video.readyState===0 時一次讀取原生位置，有限值（包含0）優先；其他情況保留 SDK／snapshot 回退。RecoveryController.#begin 仍保存前後核對 mediaId、coreId、seekRevision、userRevision、lifecycleSerial 與資格，再建立 token。這不新增控制快照欄位、持久狀態或 Native 授權來源。

原生 getter 例外回退只涵蓋該次readyState／currentTime讀取，不聲稱所有video選取或snapshot getter均安全。正式與來源隔離結果、完整安裝判定見 [修正](BR01_NATIVE_POSITION_FIX_REPORT.md) 與 [最新驗證](TEST_REPORT.md)。以下各版為歷史契約。

## v2.1.19 空媒體鍵盤修復紀錄

可信 keydown／keyup 的實際有限新目標，在 seeking 或原生 HAVE_NOTHING 下可取得一次新使用者修訂；後者另要求捕捉核心未變且非 internalReload。候選仍須同一派送／版本／媒體／播放器／內容及真正可見，internalSeek／pendingSeek 來源抑制不變。未知位置只撤銷過期還原，不能猜成使用者。公開 API、schema 2、Auto／ABR 和 15／30／15 不變。

本機正式 755 契約、整合驗證及 Chrome 原生可信輸入來源隔離 30／30 通過；安全凍結差異 2／2、0 發現已封存。發布與實際新版完整 BR-01 安裝判定以 [最新驗證](TEST_REPORT.md) 及 [修復報告](BR01_NATIVE_KEYBOARD_FIX_REPORT.md) 為準，下列版本段落保留當時範圍。

## 現行差異：BR-09（v2.1.18）

PlayerAdapter.controls 在確認鍵盤觀察後採樣原生位置；私有 NativePosition 僅一筆，保存媒體、播放器、lifecycle、位置及 readyState。HAVE_NOTHING 的未知有限目標變更更新既有 targetSec／seekRevision，Recovery 沿用原所有權檢查撤銷保存位置。沒有新增應用層介面、診斷事件、持久欄位或第二授權索引。

原生 getter 可同步重入，因此提交基準前重查控制版本、原基準、操作修訂、pendingSeek 與當前媒體／播放器／內容；清理增加版本並撤銷基準。自有 reload 返回時同步記錄正常初始零，觀察例外不能改寫 SDK 回傳或原例外，內部來源標記在 finally 釋放。正常播放時間增量不算 seek；未知目標不授予 userRevision。

[BR-09 修復](BR09_FIX_REPORT.md) 記錄正式 25 個新增契約、來源隔離與採樣限制；現行發布／安裝判定以 [TEST_REPORT](TEST_REPORT.md) 為準。

## v2.1.17 發布與驗收歷史



**2026-10-11 現行架構為已發布 v2.1.17 的 BR-01 SDK 重載後續恢復修復；實際新版安裝驗收已有部分證據，完整矩陣未結案。** 正式契約、typecheck、44 個執行期模組架構、全套 19 套件／716／716 與最終 verify v2.1.17 通過；獨立安全差異 11／11 項、0 候選／0 可報告發現，Chrome 最後來源隔離 22／22 通過。掃描主機的整體工作目錄變動警告與四個凍結執行期檔案的雜湊核對分列，不能宣稱整體快照一致。[v2.1.17](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 正式發布及公開版本／唯一腳本／SHA-256 核對完成；00:34:48.957（Asia/Taipei）已核對指定影片的完整新版執行本體、唯一 Runtime／ControlCenter 及 hooks。Auto 1／2 倍正常暫停／恢復／短 seek，以及各一次真正自有 SDK 重載後續恢復子集取得證據，詳見 [本輪修復](BR01_FOLLOWTHROUGH_FIX_REPORT.md)、[v2.1.17 安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md) 與 [驗證報告](TEST_REPORT.md)。

本文件描述 [src-v2](../src-v2/entry.ts) 的 **v2.1.17 BR-01 後續恢復契約**，保留 BR-08 完整拖曳及 BR-01～07 與既有 17 項。版本以 [release.json](../release.json) 為準；發布／安裝狀態見 [驗證報告](TEST_REPORT.md)。上一輪於 2026-10-10 21:11:07.331（Asia/Taipei）核對實際 v2.1.16 完整本體、唯一 singleton 及 hooks；該版 Auto 1／2 倍拖曳、基本播放及約 12 秒 video-only 延遲後恢復的證據保留其版本。v2.1.17 的實際自有重載已觀察 SDK pause／null／第一個標記核心、SDK 整秒 seek 保留與 rate／play 還原後兩次時間／影格進度；未回寫舊位置。完整 15／30／重載後 15 秒失敗退出、精確 12 秒 video-only 延遲、真正 hidden、真正 pending startup gate 及晚到 SDK 操作矩陣仍待驗收；網路處理缺口與歷史滾動淘汰（everDropped=true；最終 dropped=false）不補算歷史時序。v2.1.17 最後來源隔離使用自有 iframe、合成媒體／FakeClock，其中 12 個控制模型與 10 個真正可信輸入、31 秒模型拖曳均只證明對應來源契約。原自然網路起因與其他完整驗收獨立追蹤，來源隔離不代替安裝版。文件分工見 [索引](INDEX.md)、[開發流程](DEVELOPMENT.md) 及 [安全政策](../SECURITY.md)。

修復背景：[BR-07](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 在 v2.1.14 安裝版確認網站右鍵於 keyup 尋位。該修復為 keyup 建立獨立同派送候選，不沿用已結束的 keydown；當次派送沒有可觀察的新 seek 仍保守不歸因。v2.1.15 真實 Auto 1／2 倍已驗證正常鍵盤修訂及新 15 秒寬限，續測確認 [BR-08](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) 外層進度拖曳漏辨。原觀察及失敗結果保留，本輪不以本機修復宣稱新版安裝驗收完成。

<a name="dependency-direction"></a>

## 依賴方向

v2.1.9 的 [功能與競態修復](FUNCTIONAL_FIX_REPORT.md) 納入下列所有權規則；來源與正式回歸案例可逐項對照。

[architecture-rules.mjs](../scripts/architecture-rules.mjs) 允許的匯入關係如下：

| 匯入層 | 允許的目標層 |
| --- | --- |
| `domain` | `domain` |
| `platform` | `platform` |
| `state` | `state`、`domain`、`platform` |
| `application` | `application`、`state`、`domain`、`platform` |
| `adapters` | `adapters`、`application`、`state`、`domain`、`platform` |
| `diagnostics` | `diagnostics`、`domain` |
| `ui` | `ui`、`diagnostics`、`application`、`state`、`domain`、`platform` |
| `entry.ts` | 所有組合層 |

此表列出可以匯入的層，並不要求全部匯入。目前狀態儲存元件從 `platform/storage.ts` 匯入 `StoragePort` 型別；該模組也實作 Tampermonkey 儲存。UI 匯入應用層／狀態層型別與領域輔助函式，消費快照，透過 `ControlCommandPort` 執行產品變更；UI 不匯入瀏覽器適配器。診斷匯入領域模型。[entry.ts](../src-v2/entry.ts) 建立、連接這些物件並啟動執行環境。

AST 檢查涵蓋 `src-v2/` 下除宣告檔以外的執行期 `.ts`。它檢查值／型別匯入、重新匯出、`import type` 及 `import-equals` 宣告，拒絕非相對匯入與動態 `import()`，並偵測依賴循環。額外語法規則拒絕領域層／應用層中列出的瀏覽器／GM 全域及直接時鐘／亂數呼叫、路線協調器以外的點號 `setAffinity()` 呼叫、恢復控制器以外應用層的點號 `reload()` 呼叫，以及命令接收器以外列出的 UI 修改操作。這些是語法及依賴檢查，不能完整證明執行期效果或所有權。

獨立的匯入純度測試將全部非入口、非宣告模組打包在一起，停用未使用程式碼移除（tree shaking）並忽略打包最佳化註記，再於不載入 `node:test` 的獨立 Node 子程序匯入，期限為 3 秒。外層具名案例監督結果，框架不受全域陷阱干擾。測試攔截固定清單中的瀏覽器、網路、GM、計時器全域與 `Date.now`／`Math.random`，檢查匯入時行為；建構函式及方法仍須契約測試。18 項架構規則期待各自使用具名 `node:test` 案例；命令、期限與實際保障範圍見 [測試流程](DEVELOPMENT.md#test-suites-and-isolation)。

<a name="domain"></a>

## 領域層

`domain/` 包含純粹的模型與演算法：

- 帶有品牌型別的生命週期及動作 ID；
- URL 接納及主機置換規則；
- 請求 cid 正規化及有界、順序無關的內容父目錄集合比較（`playurl-content.ts`）；
- 內建節點清單（Catalog）定義；
- 有界證據窗口、安全吞吐量及斷路器；
- 候選資格及確定性排名；
- 以可信主機或不透明索引表達的 Catalog 限制快照及播放器輸出計畫；
- 唯讀 playurl 結果模型，明確記錄接納結果、辨識格式、數量、數字上游 `code` 及固定拒絕原因聯集。

領域層以參數接收時間與相對 URL 基底，不執行 I/O。輸出政策函式回傳主機或不透明索引的決策，不提交親和主機（目前路線綁定）或啟動探測。URL 政策輔助函式可以檢查 URL 字串，但不保存它們。

<a name="state"></a>

## 狀態層

- `SessionStore` 保存不可變的世代、內容週期、媒體表示及親和主機快照。路線協調器呼叫 `setAffinity`；啟動世代或內容週期時也會在工作階段重設中清除親和主機。
- `RestrictionStore` 依主機與媒體種類管理會到期的黑名單（`black`）／失效（`dead`）紀錄。Catalog 使用者覆寫設定位於 `SettingsStore`，預設值位於領域層 Catalog，當前串流的主機鎖定位於路線協調器／Vault。
- `EvidenceStore` 管理有界的影片／音訊主機證據。
- `SignedRouteVault` 以不透明識別碼管理當前內容週期的完整原生簽名路線（Native）URL。
- 首次可信 playurl API 媒體表示取代同群組較低信任的 page-hint／player-MPD 路線。Vault 撤銷暫時不透明識別碼並變更授權身分；路線協調器在保存身分不符時丟棄計畫及相關權限。後到提示不得為已可信的群組恢復可選 Native 路線。
- 路徑無法辨識的精確簽名 URL 只可建立觀察及主機限制索引，不取得 Native 選路或主動探測能力。
- Vault 也保存有界、當前內容週期的 playurl 輸出 URL 對照，包含原始／輸出主機、主線／備援角色、來源及決策 ID。它擁有選路授權與簽名路線索引，透過不透明識別碼及中繼資料提供候選。完整 URL 仍會經過輸入接納、輸出生成及瀏覽器送出／探測介面。`PlayerAdapter` 在取代／重設前保存序列化資訊清單指紋，XHR 在記憶體保存每筆請求的 URL 狀態；兩者不得成為另一份 Native 授權索引。這些 URL 不持久化，也不包含在診斷請求模型中。
- `SettingsStore` 管理型別化 v2 產品設定，包括正常選路是否參考 B 站 Native 來源的持久開關，預設關閉。
- `SettingsStore.setCatalogEnabled(host, enabled)` 在 settings 鎖內讀取並合併單一節點；一般 update 與 reset 保留完整設定更新／還原語意。
- 可信 MP4／FLV 更新替換同段的有界來源集合；變更時 Vault 撤銷舊 handles、aliases、輸出索引並旋轉授權身分。相同正規化集合不輪替，DASH 保留既有查詢字串處理。
- `MeasurementMetaStore` 管理既有游標／冷卻儲存存取，向呼叫端提供 `measurement` 鎖。

| 儲存元件 | 持久鍵 | 讀取／更新行為 |
| --- | --- | --- |
| `SettingsStore` | `bilicdn.v2.settings` | 解析第 2 版資料結構設定，監聽遠端變更，更新／重設時加鎖。原生來源參考預設關閉。 |
| `RestrictionStore` | `bilicdn.v2.restrictions` | 解析有界、會到期的紀錄，監聽遠端變更，修改時加鎖。 |
| `EvidenceStore` | `bilicdn.v2.routeEvidence` | 解析有界影片／音訊證據，監聽遠端變更，記錄／清除時加鎖。 |
| `MeasurementMetaStore` | `bilicdn.v2.meta` | 每次 `get()` 重新讀取儲存；沒有值變更監聽器或快取狀態。 |

[量測中繼資料](../src-v2/state/measurement-meta-store.ts) 保留既有相容語意：接收物件，將游標／時間戳轉為數字並以零作替代，將游標下限設為零。它不強制有限數字上界，也不驗證儲存的資料結構。`update()` 合併既有欄位、寫入資料結構 2 及 `updatedAt`，不自行取得鎖；`clear()` 也直接刪除。`MeasurementController` 以 `withLock()` 包住游標／冷卻更新，並在回呼函式內檢查生命週期標記。

[TampermonkeyStorage](../src-v2/platform/storage.ts) 在可用時以 `bilicdn.v2.` 名稱前綴使用 `navigator.locks`，否則直接執行回呼函式。跨分頁序列化取決於 Web Locks 是否可用。簽名路線與工作階段狀態僅保存在記憶體。

<a name="application-controllers"></a>

## 應用控制器

- `RouteCoordinator` 產生路線決策、套用親和主機、規劃考慮群組的備援，提交證據或路線失效前驗證探測／傳輸結果。
- 僅 `MeasurementController` 啟動主動探測。它管理每分頁一次、由播放器請求觸發的有界起播預測試：最多三個並行候選，共用三秒期限；後續安全輪次依序量測最多三個挑戰候選。MP4／FLV 分段共用起播窗口。路線協調器在提交前驗證起播選擇；健康探索只記錄證據，不變更親和主機。
- 主動起播及健康探測拒絕轉址，只計入已接納主機的直接 206 Range 回應。
- `RecoveryController` 管理播放器核心重載及恢復播放狀態。`RouteCoordinator` 管理路線備援；`PlayerMonitor` 偵測 Watchdog／冷啟動條件，`RuntimeController` 只將 video 備援事件轉交影片核心恢復，audio 不能建立影片恢復意圖。
- `LifecycleController` 在啟動、SPA 導覽鍵變更及啟用／停用變更時開始世代。頁面賦值只作有界待處理輸入，不自動切換世代。
- `PlayerMonitor` 每秒取樣播放器，推進恢復監控週期並提供型別化觀察。
- `PlayurlController` 登記正規化媒體表示、管理內容週期並請求輸出計畫。playurl 適配器負責資料內容解析、欄位相容及寫回。
- `RuntimeController` 協調設定失效、探測／恢復重設、監控器生命週期及備援事件。`ControlCommands` 提供 UI 的型別化修改介面，安排對照、黑名單、重設及資料清除的執行順序。

控制器接收型別化介面，常用 `Pick` 縮小介面。`NavigationPort`、`SchedulerPort` 及 `PlayerPort.observePlayIntent` 將 History 包裝函式、計時器 API 及啟動意圖檢查留在應用層政策之外。`PlayerPort` 不暴露原始播放器／核心物件。生命週期敏感的探測／傳輸提交依情況檢查當前世代、內容週期、路線身分或控制器標記；證據寫入取得儲存鎖後再次檢查有效性條件。恢復 Promise 使用生命週期序號／權杖，已釋放的生命週期觀察器忽略排隊中的頁面賦值。這些防護適用於生命週期工作；一般使用者設定寫入不綁定世代。

`PlayurlRequestContext` 是內部唯讀 `{ contentId: string | null }`，由 `PlayurlPort.transform` 可選第四參數明確傳入。Fetch 在 await 前從既有平台 Request.url 保存 cid；XHR 在一次參數轉換後建立候選 metadata，failed open 回復舊 metadata，成功重入保留新請求 context。getter 不改讀當前頁面身分。只有現有 `isPlayurlApi` 接納的 URL 可供解析；唯一一個最多 20 位十進位字串，去除前導零，全零／重複／空白／負數／小數／超長均為缺失，避免 Number 精度損失。

`PlayurlController` 私有保存 cid 及已觀察的完整父目錄集合。兩側有效 cid 相同便沿用，不同便換片；任一側缺少時，從各 primary 經 `parseMediaUrl` 取父目錄，忽略主機／查詢／排列。有影片只比影片，兩側純音訊才比音訊，音訊交集不能掩蓋影片變更。交集沿用並合併歷史，支援完整清單與互斥子集往返；非空無交集或型態改變則重設。首次 cid 對齊既有目錄後綁定，無法對齊先重設。無 cid 且沒有有效目錄不變更基準。影片 128／音訊 64 上限，優先本次集合、舊集合按固定字串排序填入，不因淘汰本身增加 epoch。

只有 trusted-api 更新內容基準，保留重複回應／同物件防篡改及 generation 防護；低信任提示不觸發換片或擴充歷史，generation 改變清空全部基準。cid／目錄不持久化、不進診斷，也不提供 Native 授權。沒有有效 cid 或共同路徑的同片無法可靠辨識，仍保守重設；此修復不新增 API 逆序回應政策。來源與回歸詳見 [BR-03 修復報告](BR03_FIX_REPORT.md)。

真正內容改變時，`PlayurlController` 在 Session／Vault／Routes 重設後、登記新表示前，同步通知 generation／epoch。Runtime 訂閱後重設監控、量測、恢復及播放器快取，釋放時取消訂閱。同片排列及 cid 可對齊的畫質／編碼切換不通知，每分頁一次的起播預算不重開。

`RouteCoordinator` 擁有單調路線政策修訂號；設定／對照模式失效及內容重設會遞增。`TransportContext` 在建立請求時保存修訂號。傳輸證據寫入維持原生命週期／授權檢查，完成後若政策過期便停止控制副作用；儲存鎖等待後再次檢查，合法固定主機優先於健康親和。

`platform/runtime-ids.ts` 的 factory 由入口呼叫，以 Web Crypto 產生執行環境前綴並注入傳輸及選路控制器。request／startup／challenge ID 在工作建立時分配，同工作重報不換 ID；字串沿用 schema 2 原欄位，上限 64 字元，不帶 URL 或使用者資料。模組匯入不取得亂數。

量測鎖回呼先重查最新安全狀態、表示與控制器標記，才選擇記錄嘗試的候選及提交冷卻；首次播放位置只作基準。普通恢復在 seek／ended／mediaError 時先終止舊動作，再考慮還原；只有仍擁有停滯／操作修訂的 BR-01 stall 意圖可處理持續 seeking。play Promise 檢查生命週期與當前 token，避免晚到拒絕覆寫較新結果。

`PlayerControlSnapshot` 只提供媒體／核心不透明數字識別、seek／使用者操作修訂、拖曳、目標位置及自有 reload 修訂。PlayerAdapter 觀察播放器區域可信 pointer／非 seek key，後者僅 keydown；BR-07 的 seek 鍵可來自 BODY／頁面。keydown／keyup 捕捉皆只保存一筆私有候選，排除 editable／控制中心／組字／Ctrl／Meta／Alt／合成輸入；候選的事件仍派送、同播放器／媒體／生命週期、真正可見且有限位置改變，並 seeking 或 readyState 0／捕捉核心未變／非 internalReload，才更新一次 userRevision。site.seek、媒體觀察、controls 與該事件種類的 window 冒泡皆可確認；同派送去重，keydown、repeat、keyup 各自造成新 seek 時各自取得修訂。新事件撤銷上一候選，外層冒泡／timeout 必須檢查候選身分。eventPhase NONE 拒絕派送後工作，可取消零延遲 timeout 只清理參照，不提供延遲窗口或鍵盤按住狀態。入口注入 Scheduler 與真正可見性查詢，DOM／事件不交給應用層。一般 site seek 更新觀察修訂，腳本 seek 使用內部標記並清除候選；pendingSeek 保守抑制來源，不因可信輸入全面清空。reset 移除監聽器，僅在仍擁有方法時還原 wrapper。Monitor 仍以新使用者修訂重開停滯，網站／Auto 的單純 seekRevision 保留原期限。BODY 播放／倍速另採私有 keydown 候選：Space、k／K 或既有倍速鍵須在該派送內確實改變 paused／有限 rate，且核心也仍相同，才能增加一次 userRevision；腳本的還原方法不消費此候選。頁面核心標記是因果觀察，並非認證：等待自有 reload 時未經可觀察方法的外部替換仍有辨識限制。

BR-08 進度命中使用 target.closest 的 `.bpx-player-progress-wrap, .bpx-player-progress, .bilibili-player-video-progress, [role="slider"]`，命中祖先仍須位於目前播放器區域；不向下搜尋子節點。可信進度 pointerdown 立即建立單一私有手勢，不要求 seeking 或位置改變。手勢保存 pointerId、媒體、播放器與內容生命週期，controls.dragging 由有效所有者推導。新合法進度按下取代舊手勢，非進度按下保留有效手勢；只有同指標可信 pointerup／pointercancel／lostpointercapture 釋放。同步重入須核對觀察版本及手勢物件，不能覆寫或清除較新手勢；hidden、失焦、reset、媒體／播放器替換及內容失效撤銷手勢，不新增 timeout 或 pointer capture。

`VisibilityAdapter.subscribeControlLoss(listener): () => void` 是適配器內部通知。既有可信 blur／真正 hidden guard 在 stopImmediatePropagation 前通知 PlayerAdapter，單一 listener 的例外不破壞原 guard。入口明確注入，取消函式由播放器控制觀察管理，reset／重新綁定清理；controls() 仍以真正可見性查詢防漏。BR-08 不變更公開 API、PlayerControlSnapshot、應用層介面與 schema 2，不傳遞 DOM／事件或播放器物件到應用層。

PlayerMonitor 擁有單一停滯段。15 秒合法 video 備援與 Runtime 通知合併同一 token；30 秒最多一次 core reload；重載後 15 秒沒有進度釋放 token。Auto 表示／網站 seek 更新撤銷舊動作、重新綁定最新請求，但不重開同段時限／額度。新的使用者操作與真 hidden／pause／失效結束舊段。首次有效進度結束計時，RecoveryController 等兩個連續有效採樣才 recovered。

本輪 BR-01 後續恢復透過內部可選 `PlayerPort.ownedReload(revision): boolean` 查詢自有 reload 所有權，不把 DOM 或核心物件交給應用層。PlayerAdapter 私有紀錄本次 reload 修訂、原媒體／播放器／核心、生命週期、使用者修訂與第一個替換核心，最多有界保存 15 秒；每次查詢重查身分及真正可見性。暫時空核心可等待，但舊核心在空隙後回來、第二次替換、新操作、hidden／control-loss 或 reset 撤銷所有權。還原 wrapper 與 timer 清理各自核對物件／方法所有權，不能清掉較新工作。

`RecoveryController.ongoingStallReload` 提供 Monitor 唯讀資格查詢；只有同停滯 token 與合法自有 reload 才可跨過 SDK 暫時 paused／空核心，Monitor 不在此期間重建停滯或取消同一救援。首個非零替換核心須標記等於本次修訂、初始化狀態不是 false，並通過健康觀察，才可還原；不能把空核心上的舊標記當成資格。SDK 自行 seek 只更新目前目標與觀察身分，禁止舊位置還原；有效的倍速／播放意圖仍受本次 token、最新路線授權與期限限制。新的可信操作、可觀察的外部 reload 或第二次核心替換撤銷該例外；首個替換的因果觀察不能認證所有未經可觀察方法的外部替換，普通 pause 政策保持。

重載後無進度達 15 秒先完成一次失敗終止並釋放 token，不能因 adapter 自有觀察到期只留下模糊 ownership-ended。真正時間／影格進度仍須操作、媒體／核心與 seek 修訂一致；首次有效進度停止無進度重載計時，兩次連續有效採樣才 recovered，SDK 位置跳躍及保留尺寸不算進度。已還原且有首次進度時，`ongoingStallReload` 另以相同穩定所有者維持最多 15 秒的確認資格，不延長 adapter 的 pause／空核心租期，也不授予新的 seek／rate／play 或核心接納；未形成持續進度仍失敗。終止後保存失敗停滯的 userRevision／mediaId，SDK 自行 resume 不重開救援；真正進度或新的使用者／媒體所有權才可清除此抑制。跨租期確認、同步重入、晚到完成及清理均已由本輪最終正式契約與來源隔離驗證，實際新版安裝另列。

停滯、舊 watchdog、冷起播三個監控救援入口皆排除 dragging，拖曳期間清除舊停滯及 watchdog 連續計數，不消耗一次性起播救援嘗試。一般停滯在釋放後第一個合資格 tick 從最新位置建立新 15／30 秒基準；冷起播仍按原 firstMediaAt 重評，可能立即救援，不新增全域釋放寬限或重開起播預算。

`RouteCoordinator.recoveryEligible` 為唯讀查詢：核對請求 generation／epoch／政策／授權修訂、Vault video 身分、身分綁定計畫、固定主機及現行限制。RecoveryController 建立 token 前讀取控制基準，位置／倍速各讀取一次，收集後重新取 controls 與最新資格，再核對生命週期、媒體／核心／seek／使用者修訂、現有 token、breaker 及總額；拖曳不得建立恢復意圖。reload 及 seek／rate／play 每個副作用前仍重查捕獲資格與所有權；重載替換只接納標記相符的自有替換。已初始化核心的普通等待亦有 30 秒上限，既有死核心／冷起播 4 秒及長暫停觸發維持。

<a name="progressive-playurl-processing-v218"></a>

## 漸進式 playurl 處理（v2.1.8）

[PlayurlAdapter](../src-v2/adapters/playurl.ts) 在有界深度內走訪已辨識的根層／`data`／`result`／`video_info` 容器，收集 DASH 與 MP4／FLV `durl`。分段身分包含分支、格式、畫質及陣列索引；缺少或重複的 `order` 不會合併不同分段。資料內容保留原始分段順序與中繼資料，DASH 編解碼器排序獨立運作。解析器拒絕格式錯誤的資料內容、非零頂層 `code`、不支援格式及超過容量的影片／音訊項目。

控制器逐段登記，維持當前世代／內容週期及可信來源提升規則。漸進式 Catalog 生成從 `SignedRouteVault` 取得該段第一個安全來源的不透明識別碼，不假設第一個提供的 URL 可以改寫。精確來源路徑／查詢字串保持與本段關聯。Vault 僅在換主機後能生成正常內建 Catalog 目標時，才可為此保留安全可改寫的 PCDN 來源；它不取得 Native 可選資格，也不得成為第二份 URL 索引。DASH 保留既有行為：同媒體表示中，傳入的安全精確 URL 或 Catalog 別名 URL 連同當前查詢字串保留。

所有已辨識的漸進式或混合格式輸出，先完成規劃才寫回 URL。必要分段若沒有合法主線，拒絕整個回應，不部分取代 URL 或丟棄失敗分段。此原子性限於資料內容寫回，不回滾 Vault／控制器登記。既有僅含 DASH 清空欄位處理另行維持。[PlayurlTransformResult](../src-v2/domain/playurl-model.ts) 表達結果；每個消費端都檢查 `accepted`，不能只判斷結果物件是否為真值。

僅使用 Catalog 模式下，Fetch 拒絕的 playurl 變成安全 HTTP 503 回應。XHR `text`（文字）／`json`（JSON）讀取存取器提供安全失敗內容，保留原生 HTTP 狀態；嚴格模式不支援的 XHR 回應類型在送出前拒絕。允許 Native、原線對照及整體停用原樣放行的政策維持各自語意。Fetch／XHR 等待後仍重查設定與生命週期有效性。

<a name="adapters"></a>

## 適配器

XHR waiting 請求的內部原生 open 準備最多兩次，包含政策目標變更的 reopen。每次 open、responseType、timeout、credentials 及每個 header 還原後，均以安裝時保存的原生 readyState getter 加上 metadata 身分／phase 判斷能否繼續；準備後重新計算最新合法目標，完全穩定才建立歸因及 send。gate continuation 的未交付原生例外只終止仍擁有當前請求的 waiter，依序送出一次 readystatechange／error／loadend，保留 DONE 與空回應。直接 send 的原生例外仍同步拋出；未接受的 native send 清除 pending 歸因而不記錄 CDN 失敗樣本，已送出請求不重播。

起播等待的三個取消邊界使用 signal.reason 原值，包括物件身分與 falsy 值；只有缺少 reason 能力才建立 AbortError。拒絕只屬於該等待者，共用 probe controller 與每分頁預算維持原語意，各完成路徑以 finally 移除 listener。

適配器將瀏覽器行為轉為型別化觀察：

- 獨立的 `FetchHookAdapter` 與 `XhrHookAdapter`，透過 `TransportContext` 共用型別化送出檢查及觀察建構；
- `TransportAdapter` 安裝／驗證兩個攔截，還原不完整安裝並回報整合攔截快照；
- `RangeProbeAdapter` 提供起播及健康探測共用的直接同主機 HTTPS 206 讀取器，限制計入 bytes、傳遞取消並釋放讀取器。量測控制器管理期限及結果解讀；路線協調器管理授權檢查與證據提交。失敗的健康挑戰不開啟播放斷路器；
- playurl 解析及轉換寫回；
- `__playinfo__` 與播放器資訊清單接納；
- 影片／播放器解析；
- `BrowserNavigation`：僅在包裝函式仍擁有 History 方法時還原，取消訂閱後忽略排隊中的回呼函式；
- `BrowserScheduler`：為延遲／週期計時器回傳取消函式，並排入不可取消的微任務；
- 可見性／背景行為；
- 可還原的 WebRTC 封鎖。

Tampermonkey 儲存及值變更監聽器由 `platform/storage.ts` 實作。適配器不擁有選路政策或施加懲罰。應用層的計時器分別由量測期限、播放器監控的週期計時器及生命週期微任務管理；恢復由監控器監控週期推進。UI 直接面向瀏覽器：`PlayerPanel` 擁有獨立的 1.5 秒週期計時器，`ControlCenter` 直接排入焦點工作。

XHR 每次 open 建立獨立 metadata，區分 opened／waiting／sent／terminal。參數依序轉換一次後，先暫存新所有權供同步事件使用，原生 open 成功才永久清理舊請求；拋錯只在候選仍為當前所有者時回復，不能覆蓋巢狀成功 open。尚未原生送出的取消與本地拒絕由該 metadata 擁有；每個事件回呼後重查所有權，舊 headers／progress 監聽也先檢查身分。reopen／abort 不讓舊 loadend 或 gate 繼續影響新請求。虛擬終止使用 DONE、空回應及終止事件，abort 完成回到 UNSENT；原生已送出的事件由瀏覽器處理。readyState／response／responseText 與方法攔截共同追蹤安裝所有權，只還原仍由本攔截持有的描述子。同步重開只保留合法選項，非同步重開保留 timeout、responseType、credentials 與 headers。

Chrome 同步選項驗證失敗可能把原生 XHR 清成 UNSENT；只有尚未送出的 waiting 請求可標記 needsNativeOpen，在 gate 釋放時重新準備，再檢查所有權與最新政策；已送出的請求絕不因此重播。以上例外安全性納入 v2.1.10，證據見 [BR-02 修復報告](BR02_FIX_REPORT.md)。

ControlCenter 在開啟、關閉及換頁時更新視圖版本；命令完成與排隊焦點只在仍擁有當前開啟視圖時作用。設定命令完成不代表 UI 必須仍開啟。

<a name="route-lifecycle"></a>

## 路線生命週期

1. 可信 playurl 回應或有界頁面／播放器提示建立媒體表示群組。
2. Vault 保存當前世代／內容週期的精確 Native URL。
3. 路線協調器接納當前候選、套用限制並排名。原生來源開關關閉時，正常選路只接納生成的內建 Catalog 路線；原始及 Native 簽名 URL 留在 Vault，供歸因及獨立對照模式使用。
4. 第一筆符合條件的 Fetch／非同步 XHR 媒體請求可等待最多三秒的合法路線並行預測試，同窗口的全部請求共用期限。開關關閉時只探測 Catalog；可辨識的 B 站媒體 URL 若不能安全生成合法 Catalog 路線，送出前封鎖。
5. 傳輸適配器在送出時請求決策，保存不可變的請求脈絡。
   Fetch 政策輸入與原生送出使用同一個平台正規化 Request；頁面自行加入的 `href` 屬性不能讓受檢 URL 與送出 URL 不同。
   監控器／UI 啟動前先嘗試安裝攔截並記錄驗證狀態；安裝失敗不阻止 UI 啟動。傳輸層檢查可辨識的非 GET 媒體但不改寫，XHR 在 `send()` 重查。開關關閉時，不能送往允許 Catalog 路線的已辨識媒體請求，在原生呼叫前封鎖，包括非 GET 及舊世代請求。
6. 完成後產生型別化觀察並更新證據。已確認失敗可開啟媒體種類斷路器，請求考慮群組的備援。
7. 冷啟動無進度時可提交一次不同主機的合法備援，並啟動既有的一次性核心恢復。原生來源開關關閉時，備援也必須是 Catalog。
8. 以決策後觀察到的主機確認路線結果，不能只憑計畫。

Catalog HTTP 403 只失效當前串流／主機配對，影響後續排名、備援及主動挑戰。恢復依媒體種類記錄從計畫、攔截入口到回應或失敗的有界動作；來自無關決策的同主機請求不能確認該動作。

開啟持久原生來源參考後，正常選路可依原有規則考慮合法原始及精確 Native 簽名路線。關閉時，playurl 只輸出安全生成的 Catalog 主備 URL；沒有合法路線時，輸出沒有可用路線。它不取消已送出的網站請求。整體停用仍原樣保留網站請求。

原線對照僅存在目前分頁的路線協調器，獨立於持久原生來源開關。它只使用影片提供的合法精確簽名 URL；主線被禁止時可提升合法原始備援，並停用主動探測及自動恢復。切換時清除計畫／親和主機，重設量測／核心恢復。完整重載後不保留，也不回溯還原已交給播放器的 URL。

健康量測不得變更親和主機。

Catalog 保留全部 11 個內建主機，其中 4 個預設不可用。起播三個探測的限制不縮小一般排名、備援或後續健康探索的候選池。僅使用 Catalog 輸出選擇合法主線及最多五個與主線及彼此不同主機的合法備援。當前黑名單（`black`）／失效（`dead`）、使用者覆寫設定、預設可用性、主機鎖定及串流／主機不相容限制仍有效。

僅使用 Catalog 起播沒有有效探測結果時，不提交測速贏家。最終送出對完整剩餘合法 Catalog 池作一般排名；探測 403 仍排除當前串流／主機配對。保留期限限制，不讓失敗探測路線取得特別優先權。

模式依序套用整體停用、分頁原線對照；正常選路再套用固定／自動選路及原生來源開關。固定主機、Catalog 覆寫設定或原生來源設定變更會失效計畫並重設量測／恢復。等待中的起播結果不得覆蓋新固定主機；最終送出使用當前設定與授權。

<a name="diagnostics"></a>

## 診斷

記錄器消費型別化 `DomainEvent`，彙總成功流量並保存有界失敗事故。UI 讀取模型為快照，讀取不能改變選路或啟動網路工作。攔截入口、媒體辨識、原生呼叫及回應階段與瀏覽器網路面板（Network）確認分開。僅使用 Catalog 規則涵蓋腳本改寫的 playurl 輸出及可攔截媒體送出；其他瀏覽器入口的流量須另行觀察。

`RouteSnapshot`、`TransportSnapshot`、`DiagnosticSnapshot` 及 `ControlCenterSnapshot` 提供具體唯讀欄位。診斷請求序列化使用明確的有界欄位清單，匯出時清理傳入的讀取模型。外部資料內容由對應適配器／儲存元件解析器驗證，中繼資料則保留上述相容行為。產品設定／選路命令使用 `ControlCommandPort`；UI 也直接呼叫僅作診斷的標記、清除及報告操作。UI 不直接讀寫儲存鍵。

自 v2.1.8 起，`TransportSnapshot.lastPlayurl` 保存一筆不可變的最近結果：Fetch／XHR、觀察時間、原生 HTTP 狀態、接納結果、辨識出的 DASH／MP4／FLV 格式、影片／音訊／分段數量、數字上游 `code` 及拒絕原因。`TransportContext` 複製固定欄位清單，去重後最多三種格式，數量限制為 0–65,535，丟棄非有限值或非安全整數的上游 `code`。不複製原始資料內容、URL、路徑、權杖或例外文字。控制中心及既有診斷匯出消費此摘要；接納結果不證明實際網路目的地或播放成功。
~~~~~~~~

<a name="docs-development-md"></a>

## docs/DEVELOPMENT.md

~~~~~~~~markdown
<a name="development"></a>

# 開發流程

## 現行 BR-01 新意圖位置回歸（v2.1.20）

既有 application 匯入 br09.ts，新增16案：1／2倍 ×0、5、978的新目標讀取與 paused-transition 還原，以及四個正常／重入對照。重跑 `npm test -- application --name 'BR-01 native position'`。先保存未修來源12fail／4pass；修正測試參數後以不可變git原來源建置再確認12fail／29pass（含25舊案），正式來源不回滾。最終型別與套件均須通過，不以執行測試而未型別檢查取代完整驗證。

Chrome原生空video位置讀取與自有iframe恢復模型分列，不能冒充安裝singleton。[最新驗證](TEST_REPORT.md) 記錄發布與新版完整矩陣，安全封存與封存後test-only參數修正分列。下列版本段落為原日期紀錄。

## v2.1.19 空媒體鍵盤回歸紀錄

既有 application 套件明確匯入 br06.ts；新增 14 正式案例，重跑 `npm test -- application --name 'BR-01.*uninitialized'`。先保存四項失敗／七項正常對照，再改執行期；1／2 倍精確期限、活躍 reload／晚到拒絕、來源排除及 getter 重入都必須成立。完整 755 契約、typecheck、architecture、verify 和來源隔離 30／30 通過；安全掃描獨立封存。新版完整安裝矩陣與來源／Node 結果分列，見 [修復報告](BR01_NATIVE_KEYBOARD_FIX_REPORT.md)、[最新版驗證](TEST_REPORT.md)。

下列版本段落保留當時範圍，現行版本取自 release.json。

## 現行 BR-09 回歸（v2.1.18）

正式 application 明確匯入 `tests-v2/regressions/functional-races/br09.ts`。原五契約先於來源修改保存 2 fail／3 pass，擴充後 25 個新增案例全部通過；全套 19 套件／741 項、application 256、adapters 102。使用 testScope／FakeClock／deferred，沒有調查目錄輸入。

局部重跑：`npm test -- application --name BR-09`。檢查未知零／非零、正常初始 reload 零、pendingSeek、公用 seek 去重、正常播放、非有限位置、同步 getter 重入／替換、原例外及晚到 Promise。Chrome 原生 Blob 的 1／2 倍速来源隔離另列，不作實際安裝證據。安全差異掃描與 verify 分開，版本／文件／封裝差異於封存後獨立核對。詳見 [修復報告](BR09_FIX_REPORT.md) 與 [最新版驗證](TEST_REPORT.md)。

## v2.1.17 流程與證據歷史



**2026-10-11 現行 v2.1.17 的 BR-01 SDK 重載後續恢復修復、必要驗證、正式發布及公開產物核對完成；新版安裝驗收已有部分證據，完整矩陣未結案。** typecheck、44 個執行期模組架構、全套 19 套件／716／716 與最終 verify v2.1.17 通過；本輪 adapters 102／102、application 231／231。獨立安全差異 11／11 項、0 候選／0 可報告發現，最後 Chrome 來源隔離 22／22；完整結果見 [後續修復報告](BR01_FOLLOWTHROUGH_FIX_REPORT.md) 與 [驗證報告](TEST_REPORT.md)。[v2.1.17](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 於 00:31:14（Asia/Taipei）發布，唯一 332,575 bytes 腳本與無認證公開 latest 核對一致；00:34:48.957（Asia/Taipei）已核對指定影片的完整新版執行本體、唯一 Runtime／ControlCenter 及 hooks。Auto 1／2 倍正常暫停／恢復／短 seek 與各一次真正自有 SDK 重載後續恢復子集取得證據，剩餘項目見 [v2.1.17 安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md)。

本輪先移植 `functional-races/br01-followthrough.ts` 的六個正確 application 契約，在來源 SHA 未變時保存 **3 fail／3 pass**，再修執行期；播放器的 `br01-reload-controls.ts` 另保存 BODY 播放／倍速入口 **10 fail／20 pass**。它們由既有 application／adapters 套件明確匯入，與 v2.1.16 的 637 個基準通過分列，不把調查目錄當正式輸入。最終擴充契約使用真正 Adapter→Monitor→Recovery，涵蓋自有 reload 暫時 pause／null、第一個標記核心、SDK seek 取消舊位置、完整 15 秒無進度退出、首次進度與兩個連續進度跨過 15 秒觀察租期的確認、終止後 SDK resume 不重試，以及同步讀取重入／晚到 Promise／方法描述子與計時器清理。最後執行期來源凍結後通過全套及 verify；安全掃描主機另有整體工作目錄變動警告，四個執行期檔案與凍結雜湊一致不等於整體目錄快照一致。

Chrome 的 v2.1.16 手動實際 Adapter.reload 校準沒有 Recovery token，僅證明 SDK 原生時序，不算自動救援通過。Auto 1 倍取得立即排空、連續 15 秒且無截斷的 Network 批次；2 倍首個歷史批次 truncated=true，其後批次完整不能補齊缺口。最後來源隔離 **22／22** 分為 **12 個控制模型＋10 個真正可信輸入**，合成媒體／FakeClock 限於自有 iframe；31 秒拖曳是模型時間，不能寫成網站長停滯驗收。來源工具最後 timers=0、自有根節點已移除、輔助程序已停止。實際載入 v2.1.17 後的 Auto 1／2 倍真正 Recovery 自有 reload，已跨過 SDK pause／null／第一個標記核心，保留 SDK 整秒 seek、還原 rate／play，兩次時間／影格進度後 recovered，且沒有 Adapter.seek 回寫舊位置；這是安裝版後續恢復子集，不能補成完整期限或精確延遲通過。故障窗口的處理缺口與未匹配的 Auto 新路徑保留限制；Auto 1 倍 Network 有截斷及 76.071 秒處理空隙，歷史滾動曾淘汰事件（everDropped=true；最終 dropped=false），不能補算既有時序。沒有成立的 seek 前提不得計入 12 秒 video-only 延遲。完整 15／30／重載後 15 秒失敗退出、真正 hidden、真正 pending gate 與晚到 SDK 操作矩陣仍待有效證據，不替換網站媒體 getter 或修改 timeout 製造前提。

v2.1.17 安裝工具收尾已核對 12／12 自有方法描述子還原、timer／liveXHR=0、held=0、攔截 patterns 空與觀察器移除，最後 Auto 1 倍有實際健康進度。2,027 個已分類受控 request ID 的記憶體／持久樣本匹配皆為 0，四個學習攔截 hook 的所有權在清理前確認；這只證明受控資料與自有資源清理，不能補齊既有事件缺口或覆蓋未分類工作。

本文件是 **v2.1.17 BR-01 後續恢復契約**的現行開發流程，保留 BR-08 完整拖曳與既有修復。v2.1.16 修復、必要驗證及發布／公開產物核對是上一輪已完成證據；2026-10-10 21:11:07.331（Asia/Taipei）實際 Chrome 已核對該版完整本體、唯一 singleton 及 hooks，Auto 1／2 倍拖曳、基本播放及約 12 秒 video-only 延遲後恢復取得部分證據，BR-01 完整安裝驗收仍未完成。正式發布及實際安裝版狀態見 [驗證報告](TEST_REPORT.md)，不得以來源隔離代替安裝驗收。各版原始證據保留，其他規則見 [文件索引](INDEX.md)、[架構](ARCHITECTURE.md)、[儲存庫指南](../AGENTS.md) 及 [安全政策](../SECURITY.md)。下文以 Catalog 表示內建節點清單，以 Native 表示原生簽名路線。

2026-10-10 安裝續測的 [BR-07](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) 顯示網站右鍵在 keyup 提交。現行正式鍵盤替身分別設定事件種類與網站提交階段，不能再假定左右鍵都在 keydown；先移植原五正確契約，保存未修來源 2 fail／3 pass，再修改來源。每個可信派送的實際新 seek 各自計數，同派送多入口去重；沒有位置變化、派送後工作與腳本還原不計數。擴充正式／安全／Chrome 結果見 [BR-07 修復報告](BR07_FIX_REPORT.md)，不沿用上一版 40／40。每個故障窗口先取得新游標，完整檢查 truncated／dropped；晚到收尾截斷只作狀態與清理證據，不補算完整逾時驗收。

發布後實際 v2.1.15 新增 [BR-08 進度拖曳漏辨](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)：網站功能性 wrapper 命中區與腳本 inner selector 必須分開建模，不能讓 closest 錯誤匹配子節點。當時私有七個正確契約 3 fail／4 pass，未登記正式套件或修來源，與發布前 574 正式通過分列。本輪先移植到正式 application 回歸並保存同樣 3 fail／4 pass、來源 SHA 未變，再修改執行期；原失敗檔不覆寫。真正可信 pointerdown、持續按住、有效內容／核心及正常 inner 對照由 Chrome 證明，Node 模型不能替代。

BR-08 的 `functional-races/br08.ts` 由 application 明確匯入，覆蓋真正 Adapter→Monitor→Recovery、所有救援入口、精確期限、保存值讀取重入及晚到 Promise；`br08-player.ts` 由 adapters 匯入，覆蓋命中祖先、pointerId、可信終止、hidden／blur guard 與訂閱清理。原七契約、擴充紅燈及提交前資格重查的紅燈／綠燈分開保存，正式替身不匯入調查目錄。手勢替身分開指標 ID、可信性與命中元素，`closest()` 只搜尋祖先；可見性整合須使用真正 VisibilityAdapter 的阻擋 guard，不能以裸事件目標代替。

PlayerAdapter 的內部 control-loss 訂閱由入口注入、控制觀察 reset／重綁取消。拖曳按下即可保護未提交 seek 的預覽；同指標可信釋放及生命週期／可見性失效結束手勢。Monitor 所有救援入口排除拖曳並清除舊停滯／watchdog 計數，Recovery 在提交 token 前重新核對最新資格及所有權。一般停滯釋放後重開 15／30 秒，未提交 seek 的冷起播仍依原 firstMediaAt，不能把兩種期限合併成全域釋放寬限。

<a name="repository-layout-and-archive-maintenance"></a>

## 儲存庫配置與封存維護

| 位置 | 用途 |
| --- | --- |
| `src-v2/`、`tests-v2/`、`scripts/` | 現行來源、契約及 npm 建置／測試工具 |
| 儲存庫根目錄 | README、AGENTS、SECURITY、LICENSE 及必要 npm／建置設定 |
| `docs/` | 其他現行指南、工作狀態、變更紀錄、最新版驗證報告及文件索引 |
| `dist/`、`node_modules/` | 產生的建置輸出及已安裝開發依賴 |
| `Release/`、`baseline/` | 保留的發行產物及上游來源歸屬證據；校驗清單位於 `baseline/SHA256SUMS.txt` |
| `archive/retired/docs/` | 歷史報告、整理紀錄、計畫、驗收／研究及對應 `evidence/` |
| `archive/retired/local/` | 本機私有歷史，依 `development`、`review`、`security`、`src`、`scripts`、`work` 分組 |

[封存指南](../archive/retired/README.md) 記錄配置，[文件索引](INDEX.md) 連接現行指南與歷史紀錄。既有 `archive/pre-upstream-*` 歷史獨立保存。根目錄設定、來源／測試輸入及工具位置不變。封裝讀取 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md`，沿用既有版本化輸出名稱。`baseline/` 校驗清單保留儲存庫根目錄相對路徑，須從根目錄校驗。封存 v1 輔助函式及本機工作產物不在現行 npm 命令範圍；其內嵌路徑及命令描述原始環境。

現行指南放在 `docs/`；根目錄文件供專案首頁、自動發現的開發指示、安全政策及授權使用。已完成的歷史文件與證據一起放在 `archive/retired/docs/`，保留日期、版本及觀察限制。私有掃描／審閱／工作產物放在 `archive/retired/local/`；封存不授權公開。搬移前檢查現行匯入、腳本、連結及可執行檔位置。記錄舊／新路徑，更新維護中的連結與索引，保留已封存且不可變更的證據、校驗值及已發布 Release 內容。

`docs/TEST_REPORT.md` 保留最新版完整報告及歷史導覽。換版時將上一版完整正文加入 [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md)，保留版本／日期、觀察、限制及順序，再更新固定入口與原錨點導引。已發布 `Release/v*/` 報告維持當時快照。文件整理的實際檢查另按日期加入 [DOC_MAINTENANCE_HISTORY](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。被封裝的 TEST_REPORT 與 CHANGELOG 指向其他儲存庫文件時使用完整 GitHub URL，使複製到 Release 後仍可查閱。

Markdown 粗體依 [GitHub Flavored Markdown 規格](https://github.github.com/gfm/#emphasis-and-strong-emphasis) 判斷標記兩側的文字、空白與標點。粗體內容以括號、冒號等標點結尾，且後接一般文字時，在閉合 `**` 後加空白，例如 `**時間：** 2026-09-25`、`腳本的 **內建節點清單（Catalog）** 選路`。檢查生成的 HTML 是否包含預期 `<strong>`，並排除程式碼、跳脫字元與萬用字元模式（glob）路徑中的字面標記。排版修正保留標題錨點、連結、數值及歷史觀察；Release 與已封存且不可變更的證據維持原貌。

<a name="prerequisites"></a>

## 環境需求

- Node.js 26.8.1
- npm 11.19.0
- TypeScript 7.0.2、esbuild 0.28.2 及 `@types/node@26.6.4`（鎖定的開發依賴）
- 真實瀏覽器驗證使用 Google Chrome 及 Tampermonkey

準備 Node／npm 後，在儲存庫根目錄執行 `npm ci`，安裝 [package-lock.json](../package-lock.json) 鎖定的開發依賴。[release.json](../release.json) 記錄發行工具版本。`verify` 檢查實際執行的精確 Node 版本，`build` 檢查精確 esbuild 版本。建置資訊清單的 npm／TypeScript 版本取自設定，不獨立驗證執行中的 npm／編譯器版本。[package.json](../package.json) 沒有執行期依賴。

<a name="commands"></a>

## 命令

```powershell
npm run typecheck     # 嚴格 TypeScript 檢查，不輸出檔案
npm run architecture  # 原始碼 AST 依賴圖及列出的所有權語法規則
npm test              # 全部獨立契約套件，以及架構／匯入純度測試
npm test -- adapters  # 單一隔離套件
npm test -- suites/adapters  # 相容的套件別名
npm test -- --list    # 列出登記清單及來源，不打包／執行
npm test -- application --name "startup"  # 正規表示式篩選案例
npm test -- tooling   # 測試工具本身的契約
npm run build         # 確定性的單一 IIFE 使用者腳本
npm run package       # 重建 dist，寫入設定的 Release/v<version>/
npm run verify        # 自動檢查及暫存封裝驗證
```

從儲存庫根目錄執行命令。`typecheck` 與 verify 共用 [typecheck.mjs](../scripts/typecheck.mjs)，依序檢查正式來源與測試。[tsconfig.json](../tsconfig.json) 保留嚴格 DOM 環境並設 `types: []`；[tsconfig.tests.json](../tsconfig.tests.json) 加入 Node 型別、DOM 及使用者腳本全域宣告，載入本機 `.mjs` 工具的型別／宣告。`architecture` 檢查正式模組；獨立的 `npm test -- architecture` 測試架構檢查器自身測試情境。判斷這些檢查能證明哪些不變量前，先閱讀 [架構檢查範圍](ARCHITECTURE.md#dependency-direction)。

[verify.mjs](../scripts/verify.mjs) 檢查設定的 Node 版本、typecheck、來源架構、全部測試、兩次建置的輸出／資訊清單一致性、JavaScript 語法、指定舊版／Worker 標記清單、必要儲存標記及封裝 SHA-256。封裝步驟會再建置一次。命令寫入 `dist/`，於新的 `dist/verify-package-*` 目錄封裝，確認解析後位置及前綴再刪除該目錄；不寫入 `Release/v<version>/`。

verify 不執行 Codex Security 或 Chrome／Tampermonkey 驗收。安全敏感變更或使用者明確要求時，另行執行安全差異掃描；不要求每版掃描。上一版通過報告不能作為新本機變更的證據。

<a name="adding-behavior"></a>

## 新增行為

1. 純粹的資格／排名邏輯放在 `domain/`，明確傳入時鐘。
2. 持久或工作階段資料放在型別化狀態儲存元件。
3. 可改變選路、量測或恢復的動作透過控制器方法提供。
4. 瀏覽器差異留在適配器，GM 儲存透過 `platform/storage.ts`；UI 管理自己的 DOM 及呈現生命週期。
5. 發出型別化事件，不讓診斷讀取控制器內部。
6. 在 `tests-v2/suites/` 對應獨立套件，或不依賴瀏覽器的 `tests-v2/domain-boundaries.ts` 新增具名 `node:test` 契約。新套件登記於 `scripts/test-registry.mjs`。

修改執行期邏輯前，先以失敗的領域層、控制器或適配器契約重現行為。親和主機變更只由 `RouteCoordinator` 執行，主動探測只由 `MeasurementController` 啟動，核心重載只由 `RecoveryController` 執行。等待後及儲存鎖回呼函式內保留生命週期檢查；只使用計時器介面不能避免舊工作提交。診斷消費型別化事件及快照。

<a name="test-suites-and-isolation"></a>

## 測試套件與隔離

[test-registry.mjs](../scripts/test-registry.mjs) 明確登記下列契約套件。支援工具、暫存測試情境及封存資料不透過萬用字元模式（glob）執行：

| 套件選擇器 | 涵蓋範圍 |
| --- | --- |
| `domain-boundaries` | 純政策／輸出邊界 |
| `domain` | 領域行為 |
| `state` | 設定、限制、證據及簽名路線狀態 |
| `application` | 選路、量測及恢復契約 |
| `diagnostics` | 型別化觀察、快照及報告隱私 |
| `adapters` | 瀏覽器適配器行為 |
| `native-routing` | Catalog／Native 選路及來源授權 |
| `native-transport` | Catalog／Native 傳輸及請求處理 |
| `orchestration` | 組合、生命週期及命令協調 |
| `adapter-boundaries` | 導覽所有權及 Range 讀取器契約 |
| `measurement-state` | 量測中繼資料及舊鎖回呼函式 |
| `progressive-playurl` | MP4／FLV 容器、分段身分、原子輸出及 DASH 行為維持 |
| `progressive-routing` | Catalog 來源不透明識別碼、完整候選池、備援上限及設定競態 |
| `progressive-transport` | MP4 Fetch／XHR 輸出、共用起播窗口及對照／停用模式 |
| `playurl-summary` | 型別化接納結果、安全最近摘要、狀態語意、生命週期及匯出隱私 |
| `control-center` | Catalog 單節點更新、遠端設定合併、關閉／切頁後的命令與焦點所有權 |

使用 `npm test -- <selector>` 執行單一套件；執行器也接納 `suites/<selector>` 別名。`npm test -- architecture` 執行 AST 規則測試情境，`npm test -- imports` 執行匯入純度測試，`npm test -- tooling` 使用暫存測試情境驗證測試工具。完整 `npm test` 執行這三項與全部契約套件。

[scripts/test.mjs](../scripts/test.mjs) 逐套件打包為帶內嵌原始碼對照的 `.mjs`，使用 `--enable-source-maps` 與 `--test-isolation=none` 在獨立 Node 子程序執行，每次只傳入一份套件檔案，案例依序執行。每案例及清理掛鉤預設期限為 5 秒；外層每套件硬期限為 60 秒。逾時或 stdout／stderr 合計超過 32 MiB 時，終止所屬程序並等待退出，再處理其他套件。正常完成不強制退出，未清理的週期計時器因而會在硬期限被判失敗。

終端採原生 `spec` 報告產生器；[JSON 報告產生器](../scripts/test-reporter.mjs) 從 Node 事件產生有版本的案例數、耗時、狀態及失敗名稱／位置／訊息／堆疊資訊。程式判定不解析人類可讀文字；退出碼、摘要與案例狀態必須一致。打包、測試、清理、逾時、超量輸出及摘要缺失／損壞均為失敗；收集其他套件後由 `runTests()` 拋出彙總錯誤。退出碼：通過為 `0`，上述失敗為 `1`，非法參數或名稱零命中為 `2`。CLI 在建立暫存目錄前驗證套件／參數／正規表示式。完整執行禁止空套件、僅執行標記（`only`）、略過（`skipped`）、待實作（`todo`）、取消（`cancelled`）；`--name` 允許未命中案例不執行，但總選取至少須實際執行一個案例。結果隨已驗證父目錄及前綴的暫存目錄清理。

匯入純度涵蓋所有非入口、非宣告模組；停用未使用程式碼移除（tree shaking）並忽略打包最佳化註記，保留原全域陷阱及 `Date.now`／`Math.random`。陷阱在不載入 `node:test` 的獨立 Node 子程序執行，內層期限為 3 秒，由外層具名案例監督。它只檢查頂層匯入，不檢查後續方法呼叫。

各案例獨立建立測試情境；前置狀態轉換由建立函式重建，同情境的多個斷言留在同一案例。使用原生 `assert.ok`、`assert.strictEqual`，保留 JSON／字串／身分比較。案例數描述情境，不能換算為舊版功能斷言數；[遷移對照](../tests-v2/MIGRATION.md) 保存原行為、分支及矩陣，實測見 [工具驗證紀錄](TEST_TOOLING_REPORT.md)。

共用 [測試資源範圍](../tests-v2/support/scope.ts) 使用 `testScope(t)`，立即以 `t.after()` 登記清理。`own()`、`defer()` 支援同步／非同步釋放，依反向登記順序執行；一項失敗仍完成其餘清理與全域還原，彙總錯誤。`dispose()` 可重複呼叫。全域替換必須經 `defineGlobal()`，保存第一次修改前的完整屬性描述子。測試資源範圍不包裝全域計時器；計時器、攔截、訂閱及取消函式由所屬資源或測試明確登記清理。模擬介面使用 `satisfies`，不得以 `as never` 繞過型別。

[FakeClock](../tests-v2/support/clock.ts) 保留固定起始時間，拒絕無效延遲、零或負數的週期計時器間隔及重入推進，提供待執行數量。相同時間計時器依登記順序執行，獨立微任務佇列於下一個計時器前處理；每次推進最多 10,000 次回呼函式。釋放／取消後不再執行。以 [deferred](../tests-v2/support/deferred.ts) 或測試情境的完成訊號等待非同步工作，保留拒絕及取消路徑。BrowserScheduler 契約可使用少量真實事件迴圈，依完成訊號判定。

不得在正式打包產物加入公開測試橋接介面；測試從 TypeScript 來源獨立打包。

2026-10-09 的 [v2.1.9 的 17 項修復](FUNCTIONAL_FIX_REPORT.md) 以 `tests-v2/regressions/functional-races/` 保存具名回歸，分別由 application、progressive-routing、native-transport、adapter-boundaries 及 orchestration 套件匯入；UI 案例位於 control-center。原調查證據不作正式測試輸入。XHR 原生狀態替身區分原生 send 前／後的 abort，模擬同步 setter 例外；ProgressEvent 全域經 testScope 管理。FakeClock／deferred 明確控制晚到、拒絕及鎖取得順序，不能以此宣稱 Chrome 原生事件已驗收。

同日納入 v2.1.10 的 [BR-02 修復](BR02_FIX_REPORT.md) 新增 40 個正式案例，仍由 `npm test -- native-transport` 執行；該版全套為 339 個。XHR 替身補入 open 參數／方法／URL／同步選項驗證、OPENED→OPENED 不發事件，以及實測 Chrome 同步選項錯誤清成 UNSENT 的邊界。先保存失敗契約，再改來源；原調查證據不覆寫。真正 Chrome 的本機來源隔離頁、Tampermonkey 安裝版驗收及 Node 契約必須分列，不能互相替代。

2026-10-10 [BR-04／BR-05 修復](BR04_BR05_FIX_REPORT.md) 新增 66 個案例，全套為 **19 套件、448 案例**。19 個 BR-04 與 16 個 Fetch 整合取消案例由 native-transport 執行；31 個起播等待／取消／清理案例由 measurement-state 匯入。原生 readyState 替身使用 prototype getter，讓安裝時保存的原生 getter 能獨立讀取狀態。內部重新準備最多兩次，每次 open／選項／header 回來都重查 owner、phase、原生 OPENED 與送出政策。取消原因以 signal.reason 原值回傳，不能用 truthiness 替換；單一取消不消耗其他等待者的共用工作。

本版 [安裝版紀錄](CHROME_v2.1.12_ACCEPTANCE.md) 分列真正 singleton 的 35 項矩陣與同片基本回歸。合成攔截除 GET／Range 外必須處理 OPTIONS CORS／credentials；事件從執行前 cursor 分頁，截斷或工具前提不成立的輪次作廢。測試前保存學習資料基準，以 Vault 表示／精確 requestId 限定自有寫入抑制，測後核對、還原實例掛鉤並清理。清理鎖內 Promise 必須明確 await；沒有測試前完整備份時，不得宣稱能復原樣本上限淘汰的歷史。

2026-10-10 [BR-03 本機修復](BR03_FIX_REPORT.md) 新增 43 個案例，全套為 **19 套件、382 案例**。`content.ts` 由 orchestration 匯入、`content-domain.ts` 由 domain 匯入；Fetch／XHR cid 所有權沿用 native-transport，MP4／FLV／混合格式沿用 progressive-playurl，正式登記不變。runtime fixture 可注入真正 MeasurementController 的 probe，利用 FakeClock／deferred 驗證排列保留工作、真正換片撤銷晚到結果。原四個失敗契約已正式移植，紅燈 log 與綠燈驗證分開保存。

內容識別修改須同時驗證請求 cid 正規化／所有權、可信來源、精確父目錄備援與容量。cid 僅從已辨識請求提取，不能從 payload 或頁面推測；低信任提示不更新基準。新增內部 context 不得進入診斷／持久資料或取代 Vault 授權。具體契約見 [架構](ARCHITECTURE.md#application-controllers)。

文件使用「儲存元件（store）」「測試情境（fixture）」「建立函式（factory）」「中繼資料（metadata）」「原始碼對照（source map）」「報告產生器（reporter）」及「堆疊資訊（stack）」；瀏覽器攔截與 `t.after()` 等測試清理掛鉤分開描述。程式識別字、命令及 Node 原始狀態值保持原樣；中文化範圍與封存規則見 [文件政策](INDEX.md#現行指南)。

<a name="build-output"></a>

## 建置輸出

[build.mjs](../scripts/build.mjs) 將 `src-v2/entry.ts` 打包成單一瀏覽器 IIFE，以 Chrome 120 為目標，不分割程式碼；前置 [使用者腳本中繼資料](../src-v2/metadata.txt) 並填入設定版本。輸出為 `dist/BiliCDN_TW.user.js`、外部原始碼對照及 `dist/build-manifest.json`。資訊清單記錄建置選項、輸入雜湊及使用者腳本雜湊。建置不會上傳產物。v2 來源不得加入執行期依賴、遠端程式載入、Worker 攔截或歷史 v1 匯入。

<a name="real-chrome-validation"></a>

## 真實 Chrome 驗證

後續預設使用 **Codex 內建瀏覽器＋Tampermonkey**，依每次實際管理器、完整腳本本體與 singleton 證據建立環境身分。2026-10-11 已實測 Tampermonkey 5.5.1／BiliCDN v2.1.20、可信方向鍵 seek、控制中心顯示與 Fetch／XHR 精確攔截；見 [內建瀏覽器可用性確認](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md)。內建環境與外部 Chrome 的結果分列；面板 `visibility.set(false)` 的實測原生 hidden 仍為 false，不能拿來證明真正背景。環境可用不代表 BR-01 完整驗收通過，已暫停目標須由使用者要求恢復。

同日重新驗證的工具 selectedTab 2→3→2 成功，一般腳本身分／可信輸入／控制中心／合成攔截再次通過；prototype hidden getter=false、Runtime visible=true。複核後撤回「背景能力不通過」判定：實際視窗退到背景與 getter 原生性未獨立校準，該背景測試窗口無效。BiliCDN 在 document 實例偽裝前景，prototype 直接讀取能繞過這層覆寫，但不能單靠它與 Runtime 的同源讀值排除其他腳本影響。後續須確認實際切換並校準網站所見值、可信原生值與 Runtime 判定。

BR-01 正式控制器契約在 application 的 functional-races/br01.ts，適配器方法／清理契約在 adapters 的 br01-player.ts；BR-06／BR-07 的 functional-races/br06.ts 由 application 明確匯入，使用真正 Adapter／Monitor／Recovery。keydown／keyup、提交階段及重入邊界由正式替身明確建模。Node 可信事件及派送是型別化契約模型；Chrome 可信按鍵與監聽器間 microtask 另作證據，不能互換。精確 14,999／15,000、29,999／30,000、重載後 15,000 ms 使用 FakeClock；實際網站另以 Auto 的 1／2 倍速與完整合併 Fetch／Network 游標驗證。故障注入須先精確送出前攔截、音訊通行並抑制 owned 受控樣本持久化。每個有效窗口須逐一核對游標／hasMore／truncated；工具狀態用同一可變物件保存，窗口結束立即清空 Fetch patterns，不能在模型等待期間保留未處理的 Request 攔截。背景以原生 Document.prototype.hidden getter與 Runtime 實際可見性比對，不使用被腳本維持為 visible 的 instance getter。網站提前暫停／外部換核心時，應驗證撤銷並將尚未形成的逾時前提列待驗收。重跑及限制見 [BR-07 修復報告](BR07_FIX_REPORT.md) 與 [v2.1.15 安裝紀錄](CHROME_v2.1.15_ACCEPTANCE.md)。

BR-08 新版安裝版先核對完整執行本體、singleton 與 hooks，再於指定風景影片的 Auto 1／2 倍分開量取 wrapper／inner 並持續按住 31 秒。有效故障期間須有 dragging=true 且沒有監控備援或核心重載；釋放後使用最新位置。來源隔離的合成媒體與 FakeClock 只在自有 iframe，真正可信指標及事件 guard 另留 Chrome 證據。網站提前 pause／error／換核心、原生 hidden 前提不成立或事件截斷不能算完整逾時通過；無新前提不重複相同失效窗口。

學習抑制須涵蓋真正 transport／startup／challenge 樣本身分並保留至晚到收束，不只攔截網站 requestId。實際 SDK 邊界只控制自有回傳 Promise，保存完整方法描述子，清理時僅還原仍屬工具的包裝並移除自有繼承遮蔽。最後核對 held=0、patterns 空、自有資源及受控樣本零匹配；缺少的歷史事件不能補算完成。真正 singleton startup gate 必須由新載入同片的自然請求啟動，不改網站 timeout 或重建控制器／預算；同片自然 cid／epoch 與真正背景沒有必要前提時保持待驗收。

主要使用與驗收場景以 **Auto 畫質**為主；本輪網站只使用使用者指定的風景影片，Auto 1／2 倍分開，不切換影片、不強制畫質，也不修改 Chrome 設定或停用其他腳本。Auto 正常調整解析度不能單獨判為功能異常。畫質操作與 seek 分開，記錄實際影格／緩衝進度、使用者最新操作及網站重試，不以選單文字或 timeout 設定值代替事件。2026-10-10 的 [BR-01 Auto 調查](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) 分列有效／作廢輪、控制器候選失敗契約與正式測試；其重跑前提見 `.work/functional-review/br01/2026-10-10-c924b02/RERUN.md`。

v2.1.8 的標準 Tampermonkey 更新及 2026-10-04 MP4 試片／公開 DASH 觀察見 [歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#chrome--tampermonkey-observations-after-standard-update)。完整公開 MP4、FLV 現場樣本及較早 DASH 緩衝的限制一併保留，不另列為已批准待辦。

已發布使用者腳本在 Tampermonkey 更新後，使用獨立測試分頁，記錄：

- 腳本版本及 Chrome／Tampermonkey 版本；
- 頁面類型、畫質、編解碼器及倍速；
- 實際觀察到的影片／音訊主機；
- 是否啟動探測及是否換主機；
- 跳轉播放位置、SPA、背景、暫停／恢復及多分頁結果。

後續相關變更，確認可合法存取的 MP4 分段至少播放 10 秒並執行 DASH 回歸，記錄格式／分段處理、實際影片主機、播放進度及實際測到的起播／固定主機設定競態。明確區分試片與完整公開內容。FLV 目前只有自動契約證據；有合法可存取樣本時再驗證現場播放，記錄實際範圍。後續檢查須與已批准結案的 v2.1.6 驗收及已完成的 v2.1.8 觀察分開。

不得把 VM 或模擬結果稱為真實播放。未經使用者明確授權，不改變其既有暫停／測試分頁。

2026-10-09～10 的 [v2.1.10 安裝版紀錄](CHROME_v2.1.10_ACCEPTANCE.md) 分列 68 個 XHR 案例執行、實際播放與未完成 gate／影音隔離。[BR-03 原調查](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) 的四個獨立來源契約仍保存在 `.work/chrome-v2.1.10/2026-10-09/`；未修復來源當時 2 通過／2 失敗、退出碼 1，不納入通過數。原入口會匯入目前來源，不能重跑後覆寫當時失敗紀錄。移植後的正式回歸由 `npm test -- orchestration` 執行。

BR-03 修復輪的 `.work/functional-fixes/br03/2026-10-10-c836a17/RERUN.md` 記錄本機來源隔離與先裝 Request 攔截的重跑步驟。真實 Chrome 的 BR-03 31／31、BR-02 31／31 是來源隔離結果；既有 v2.1.10 同片播放正常也不代表修復產物已安裝。發布並更新後須另跑安裝版矩陣。網站僅使用指定風景影片，畫質切換與 seek 分開操作；不變更 Chrome 設定、不停用其他腳本。工具中斷、過期 interception id 或事件截斷的輪次作廢，先保持攔截並卸載頁面後才清理。

<a name="packaging-and-release"></a>

## 封裝與發行

明確執行 `npm run package` 會建置，依 `release.json` 版本在 `Release/v<version>/` 寫入五項設定產物：

- `BiliCDN_TW.user.js`
- `CHANGELOG_v<version>.md`
- `TEST_REPORT_v<version>.md`
- `BUILD_MANIFEST_v<version>.json`
- `SHA256SUMS_v<version>.txt`

[package.mjs](../scripts/package.mjs) 覆寫這些具名檔案，不清空既有 Release 目錄。校驗值清單納入該目錄已存在的全部檔案，校驗值本身除外。封裝前檢查目標目錄；不得為了驗證已發布版本而執行此命令。暫存封裝驗證使用 `npm run verify`。

依 [AGENTS 發行規則](../AGENTS.md#release-rules)，本專案功能修復完成並通過必要自動及安全驗證後，預設自主提交、遞增修補版本、封裝、推送 main／標籤及發布 GitHub Release，不再等待使用者重複要求；當次明確限定只調查或保留本機修改時遵守該範圍。完成後核對公開 latest 更新的版本、大小與 SHA-256。不得加入修補、CI/CD 或 GitHub Actions。本機封裝不等於發布。GitHub Release 附件只有使用者腳本，更新 URL 保持指向本儲存庫最新 Release。發布前執行 `npm run typecheck`、`npm run architecture`、`npm test`、`npm run verify` 及必要安全驗證。真實 Chrome／Tampermonkey 驗收另行記錄，未執行的瀏覽器檢查不得寫成通過。
~~~~~~~~

<a name="docs-index-md"></a>

## docs/INDEX.md

~~~~~~~~markdown
# 專案文件索引與維護規則

- [Codex 內建瀏覽器 Tampermonkey 可用性](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md)：實際管理器／完整 v2.1.20、本體與 singleton、可信輸入及合成 Fetch／XHR 攔截兩輪通過；背景窗口因實際切換與 getter 未充分校準而無效，已撤回背景能力失敗判定。預設一般測試環境為內建瀏覽器，自主目標保持暫停。

## 現行 v2.1.20 BR-01

- [新意圖位置保存修正](BR01_NATIVE_POSITION_FIX_REPORT.md)：實際過期SDK值、根因、16正式契約、安全差異、Chrome原生／控制模型分列。
- [v2.1.20 實際安裝續測](CHROME_v2.1.20_BR01_ACCEPTANCE.md)：完整本體／唯一singleton、新目標與0保存通過、原生拖曳取消及晚到拒絕、自然成功恢復子項與完整矩陣界線。
- [v2.1.19實際續測](BR01_v2.1.19_INSTALLED_CONTINUATION.md)：有效子項通過與完整矩陣不通過的二元判定、清理證據。
- [最新驗證與發布](TEST_REPORT.md)、[工作狀態](TODO.md)：新版安裝身分與下一個實際窗口。

## v2.1.19 發布時紀錄

- [空媒體鍵盤修復](BR01_NATIVE_KEYBOARD_FIX_REPORT.md)：現場缺口、來源／14 契約對照、先紅後綠、安全及原生來源隔離。
- [最新驗證](TEST_REPORT.md)：發布、產物與實際安裝狀態。
- [工作狀態](TODO.md)：原 BR-01 完整矩陣與有效現場判定。

下列版本段落保留當時證據，不把歷史未修狀態轉作現行缺陷。

## 現行 BR-09（v2.1.18）

- [BR-09 修復報告](BR09_FIX_REPORT.md)：來源／25 項回歸對照、先紅後綠、安全差異、來源隔離及限制。
- [最新版測試與發布](TEST_REPORT.md)：741 項及本版 verify／公開產物核對。
- [v2.1.18 Chrome 紀錄](CHROME_v2.1.18_ACCEPTANCE.md)：原生來源隔離、實際完整新版身分及 Auto1／2 基本回歸通過；因果模型與網站窗口分列。
- [BR-09 原失敗報告](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md) 與 [BR-01 v2.1.17 最終判定](BR01_v2.1.17_FINAL_ACCEPTANCE.md)：保留歷史因果及二元結果。

下列 v2.1.17 與更早狀態只描述原時間點；BR-09 已修的現行來源以以上入口為準。

## v2.1.17 與更早判定歷史



<a name="br01-followthrough-status"></a>

**2026-10-11 最新判定：[BR-01 v2.1.17 安裝驗收整體不通過，本輪判定完成](BR01_v2.1.17_FINAL_ACCEPTANCE.md)。** Auto2完整15／30／重載後15秒通過，單次實際重載、釋放意圖並至少三tick不重試；Auto1完整期限與其餘不通過項目逐一給出前提／證據原因。正常同版子集保留，安裝XHR原生8／8對照通過，資源及123個已分類受控ID零學習匹配核對完成。BR-09仍是已確認未修來源問題，本輪不擴修；正式來源／測試／Release不變。[TODO](TODO.md)保存現行二元判定，下文保留較早輪次及發布時的歷史状态，不取代本輪結論。

### 本輪之前的同版紀錄

**2026-10-11 最新續測：[BR-09 歸零目標漏撤銷舊位置還原](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md) 已確認來源缺口，未修復。** Node正確契約2 fail／3 pass；Chrome原生Blob來源隔離unknown-zero的0被還原為0.25，三個正常對照通過。完整網站singleton因果仍分列，不把3152→2037回退直接歸因；BR-01完整安裝驗收未完成。本輪只交付報告、重跑入口與清理證據，未改正式來源／測試／Release。現行續查以[TODO](TODO.md)及[v2.1.17安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md#2026-10-11-續測與-br-09)為準，下段保留本版發布時證據。

**2026-10-11 現行版本 v2.1.17：BR-01 SDK 重載後續恢復修復、必要驗證、正式發布及公開產物核對完成；新版安裝驗收已有部分證據，完整矩陣未結案。** 原 application **3 fail／3 pass**、BODY 播放／倍速入口 **10 fail／20 pass** 先於執行期修補保存；最後全套 **19 套件／716／716**、typecheck、**44 個執行期模組**架構及 verify **v2.1.17** 通過。獨立安全差異 **11／11 項、0 候選／0 可報告發現**，Chrome 最後來源隔離 **22／22**（12 個控制模型＋10 個真正可信輸入）通過並完成清理；自有 iframe／合成媒體／FakeClock 與 31 秒模型拖曳不代表安裝驗收。掃描的整體工作目錄變動警告保留，四個凍結執行期檔案雜湊一致不等於整體快照一致。[v2.1.17](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 於 00:31:14（Asia/Taipei）發布，唯一 **332,575 bytes** 腳本與無認證公開 latest 的版本／大小／SHA-256 核對一致；00:34:48.957 已核對指定影片完整新版執行本體、唯一 Runtime／ControlCenter 及 hooks。Auto 1／2 倍正常暫停／恢復／短 seek 與各一次真正自有 SDK 重載後續恢復子集取得證據；完整期限、精確延遲、真正背景／gate 與晚到 SDK 等剩餘項目仍待驗收。現行契約見 [後續修復報告](BR01_FOLLOWTHROUGH_FIX_REPORT.md)、[PROJECT_CONTEXT](PROJECT_CONTEXT.md#br01-owned-sdk-reload)、[架構](ARCHITECTURE.md)、[開發流程](DEVELOPMENT.md) 與 [TODO](TODO.md)。手動實際 SDK 校準不等於控制器救援；原 87.785 秒自然網路起因仍待定位，已有 timeout 不能單獨證明 CDN 故障。

### v2.1.16 已發布基準

**現行交付：BR-08 完整拖曳契約修復與 v2.1.16 發布完成；BR-01 完整安裝版驗收已有部分證據，仍未完成。** 全套 **637 正式案例**、typecheck、architecture、verify **v2.1.16** 與 diff 檢查通過；獨立安全差異 **14／14 覆蓋、0 可報告發現**，Chrome 來源隔離 **31 個有效案例通過**，兩個無效校準窗口排除並完成清理。21:05:38（Asia/Taipei）已發布，遠端 main／標籤、唯一 **320,794 bytes** 腳本及公開 latest 版本／SHA-256 核對一致；21:11:07.331 已核對實際新版完整本體／singleton 1／hooks。Auto 1／2 倍 wrapper／inner 四個超過 32 秒拖曳窗口與釋放、正常播放／暫停／短 seek、約 12 秒 video-only 延遲後恢復均有證據，腳本重載 0；完整逾時及其餘矩陣仍待完成，來源隔離不能代替安裝版。見 [BR-08 修復](BR08_FIX_REPORT.md)、[TEST_REPORT](TEST_REPORT.md)、[v2.1.16 安裝矩陣](CHROME_v2.1.16_ACCEPTANCE.md) 與 [TODO](TODO.md)。以下日期及「未修復」保留原輪次狀態。

新版實際 XHR hook 與 NativeXhr 的 Blob **33／33 成對對照**通過，僅涵蓋 BR-02 原生所有權、例外、事件重入及 getter 子集；Catalog／HTTPDNS 虛擬拒絕、媒體歸因、真正 pending gate 與 cid／epoch 仍待驗收，正式案例仍為 637。另有模式復原約 174.648 秒後 **2913 → 0.307 秒**的 Auto 位置跳變待定位；沒有新路線／核心動作或生命週期變更，SDK／完整 Network 不足且採樣上限 dropped，未確認腳本缺陷。兩者的證據範圍與續查條件見 [v2.1.16 安裝紀錄](CHROME_v2.1.16_ACCEPTANCE.md) 與 [TODO](TODO.md)。

**歷史交付：BR-07 修復與 v2.1.15 發布完成；當時實際新版部分驗收，新 BR-08 未修、完整 BR-01 未完成。** BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構與最終 verify **v2.1.15** 通過；來源隔離 **40／40 有效案例**，獨立安全完整覆蓋／0 可報告發現。公開 latest **2.1.15／317,487 bytes／SHA-256** 與實際完整 body／singleton 1 已核對，Auto 1／2 倍正常鍵盤及新 15 秒寬限取得證據。續測確認 [BR-08 進度列外層拖曳漏辨](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)，已報告並清理，未擴修。見 [BR-07 修復](BR07_FIX_REPORT.md)、[TEST_REPORT](TEST_REPORT.md) 及 [安裝矩陣](CHROME_v2.1.15_ACCEPTANCE.md)。v2.1.14 原 [缺陷](CHROME_v2.1.14_BR07_KEYUP_SEEK.md)、[安裝](CHROME_v2.1.14_ACCEPTANCE.md)、更新前 10:59Z 中途觀察與完整歷史保留；以下較早日期只描述當時。

**先前續測：2026-10-10 約 13:45–13:57 確認 [BR-06 鍵盤 seek 所有權缺口](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)，當時未修復。** 實際 Auto 1／2 倍的新 BODY 方向鍵 seek 沿用舊停滯期限，8.205／6.986 秒便備援；滑鼠對照通過，獨立正確契約 2 fail／3 pass。當輪達成找問題並交付報告的退出條件，來源與 Release 沒有修改。

**2026-10-10 歷史交付：[BR-01 A／B／C 修復](BR01_FIX_REPORT.md) 及 v2.1.13 發布完成。** Auto 長 seek 有界救援，474 正式案例／verify、安全差異及來源隔離 22／22 通過；公開產物與實際新版 body 已核對，[安裝版](CHROME_v2.1.13_ACCEPTANCE.md) 的 Auto 延遲恢復取得部分證據，完整矩陣未結案。原自然網路起因與其他完整驗收不因此結案。[v2.1.12 原調查](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) 保留原始失敗證據。

**歷史瀏覽器狀態：2026-10-10 03:02–03:36 已續測 BR-01 與剩餘領域，交付 [完整覆蓋報告](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md)。** BR-01 seeking 的救援抑制機制已定位，原始網路起因未證實；新增 [BR-05 Fetch 取消原因遺失](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md)。42 個新增受控案例、真 gate 與真 SDK 核心替換有結果，真正背景操作仍未取得 hidden 前提；**產品驗收未全通過，BR-04／05 未修復**。正式來源及 Release 未修改。

**2026-10-10 02:58 先前續測：BR-04 已在真正 Chrome 155／v2.1.11 安裝版確認。** 當輪達成找問題並交付詳細報告的替代完成條件；新的續測目標沒有以此提前退出。見 [BR-04 報告](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)。下方中途暫停文字保留其時間點。

**2026-10-10 02:42 中途狀態：v2.1.11 安裝版驗收部分完成，當時依使用者要求暫停。** BR-03 31 個有效案例與 BR-02 42 個對照通過，當時 BR-04 僅 Node 重現；見 [中途報告](CHROME_v2.1.11_PROGRESS.md)。下文發行時的待安裝文字保留其當時範圍。

本索引於 **2026-10-11** 更新至 **v2.1.17 BR-01 後續恢復修復、必要驗證、正式發布與公開核對完成、實際新版部分安裝驗收**，保留 v2.1.16 發布／公開產物及部分安裝證據。本輪完整證據見 [TEST_REPORT](TEST_REPORT.md) 與 [v2.1.17 安裝矩陣](CHROME_v2.1.17_ACCEPTANCE.md)；剩餘範圍以 [TODO](TODO.md) 為準。已分類受控資料與工具清理完成不補齊 Network 缺口或歷史滾動淘汰（everDropped=true；最終 dropped=false）；完整安裝矩陣未結案。v2.1.12 的 35 項安裝驗收保留其當時範圍，下方歷史日期不代替現行狀態。

2026-10-07 的 Markdown 粗體渲染盤點與排版修正見 [文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-07-markdown-粗體渲染修正)；後續排版檢查方式列於 DEVELOPMENT。

產品行為以 [src-v2/entry.ts](../src-v2/entry.ts) 及其模組為準；版本與工具以 [release.json](../release.json)、[package.json](../package.json) 及 [package-lock.json](../package-lock.json) 為準。指南與程式不一致時，先確認實際行為再修正文檔，歷史觀察保留原始版本與日期。

閱讀入口：

2026-10-09 的 [功能與競態修復對照](FUNCTIONAL_FIX_REPORT.md) 記錄 v2.1.9 的 17 項修復、正式回歸及新的瀏覽器待驗收範圍；舊版已發布驗收維持原紀錄。

- 一般使用者：README → 安裝／模式／操作／排查。
- 開發者：PROJECT_CONTEXT → SECURITY → ARCHITECTURE → DEVELOPMENT，並遵守 AGENTS。
- 維護者：TODO → 最新 TEST_REPORT → CHANGELOG；追溯舊證據時進入歷史報告與封存索引。

## 現行指南

| 文件 | 主要責任 |
| --- | --- |
| [README](../README.md) | 安裝、功能、四種模式、控制中心、排查及隱私 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 產品契約、不變量及已確定交付邊界 |
| [AGENTS](../AGENTS.md) | 必要開發流程、架構、安全及發行／文件要求 |
| [ARCHITECTURE](ARCHITECTURE.md) | 依賴、狀態、控制器、適配器、生命週期與診斷 |
| [DEVELOPMENT](DEVELOPMENT.md) | 環境、命令、測試隔離、建置、瀏覽器檢查及封裝 |
| [TEST_TOOLING_REPORT](TEST_TOOLING_REPORT.md) | 測試遷移、套件登記、XHR 原生替身及 BR-07 keydown／keyup 提交階段校準 |
| [測試遷移對照](../tests-v2/MIGRATION.md) | 原 891 項功能斷言的行為群組、分支及參數矩陣對照 |
| [SECURITY](../SECURITY.md) | 信任邊界、持久資料、網路權限及診斷限制 |
| [TODO](TODO.md) | 目前已批准工作、結案事項及未安排方向 |
| [FUNCTIONAL_FIX_REPORT](FUNCTIONAL_FIX_REPORT.md) | v2.1.9 的 17 項修復、正式契約及瀏覽器驗收步驟 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 上游基準、v1／v2 關係及來源校驗 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 作者、授權、工具用途及版本 |

本索引管理文件用途、入口及維護對照。這些指南隨程式或發布狀態更新，不能以舊版規格取代目前實作。現行說明、變更紀錄及最新版報告使用繁體中文；封存的歷史正文保留原文。

2026-10-07 中文化範圍為 **14 份 Markdown**：根目錄 README、AGENTS、SECURITY，`docs/` 的十份文件，以及 `tests-v2/MIGRATION.md`；2026-10-09 新增修復對照報告沿用相同政策。CHANGELOG 的全部版本條目使用繁體中文，仍保留各版當時的驗證狀態；測試遷移對照以中文說明行為，英文欄逐字保留原案例群組。封存正文、82 份 Release Markdown 快照、本機工作資料及第三方／產生的文件不翻譯。繁體中文標題若取代既有標題，必須保留原錨點別名；既有別名及跨文件引用繼續有效。

共用用語為「儲存元件（store）」「測試情境（fixture）」「建立函式（factory）」「中繼資料（metadata）」「原始碼對照（source map）」「報告產生器（reporter）」「堆疊資訊（stack）」。瀏覽器 hook 稱為「攔截」，測試 hook 稱為「測試掛鉤」或「清理掛鉤」。產品名稱、授權名稱、程式識別字、命令、網址、路徑及原始狀態值可以保留英文，必要時補上中文解釋。翻譯必須維持規則強度、條件、數值與證據界線；日期固定的封存正文保持原樣，維護結果另追加有日期的紀錄。

2026-10-07 中文化的實際檢查見 [文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-07-現行-markdown-文件繁體中文化)。

## 檔案配置

根目錄保留 README、AGENTS、SECURITY、LICENSE 及必要建置設定；其餘現行文件集中於 `docs/`。封裝固定讀取 `docs/CHANGELOG.md`、`docs/TEST_REPORT.md`，來源原件及校驗清單位於 `baseline/`。

歷史報告、整理紀錄、計畫、研究、驗收及截圖集中於 [archive/retired](../archive/retired/README.md)。[封存總覽](../archive/README.md) 說明公開文件與忽略的本機資料分區。2026-10-07 盤點為 **29 份公開 Markdown**：根目錄 3 份、`docs/` 10 份、封存索引 2 份、歷史文件 13 份及測試遷移對照 1 份；不計入 Release 快照或私有本機封存。2026-10-06 的 27 份盤點及更早數字保留於 [有日期的維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

## 發行與驗證紀錄

| 文件／產物 | 閱讀方式 |
| --- | --- |
| [CHANGELOG](CHANGELOG.md) | v2.0.0～v2.1.17 條目使用繁體中文；功能差異、順序及當時驗證狀態保留，v2.1.17 發布／公開產物核對完成 |
| [BR04_BR05_FIX_REPORT](BR04_BR05_FIX_REPORT.md) | 有界 XHR 準備、取消 reason、66 新契約、來源隔離及分列安裝驗收 |
| [BR01_FIX_REPORT](BR01_FIX_REPORT.md) | v2.1.13 A／B／C 原修復：Auto 15／30／15 秒有界救援、26 新契約、安全差異、來源隔離與當時發布／安裝；不包含目前 SDK 後續恢復修補 |
| [BR01_FOLLOWTHROUGH_FIX_REPORT](BR01_FOLLOWTHROUGH_FIX_REPORT.md) | v2.1.17 自有 reload／BODY 操作、SDK seek、跨租期進度與終止後不重試；先行失敗、716 正式契約、安全差異、22 個來源隔離及分列交付／安裝狀態 |
| [CHROME_v2.1.17_ACCEPTANCE](CHROME_v2.1.17_ACCEPTANCE.md) | v2.1.17 完整實際本體、Auto 1／2 倍正常操作與自有 SDK 重載後續恢復子集；22 個來源隔離、舊版 SDK 校準、清理及完整安裝矩陣剩餘限制分列 |
| [CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md) | 未初始化媒體歸零漏撤銷舊還原；Node紅燈、原生Chrome來源隔離與網站未定回退分列；未修復 |
| [CHROME_v2.1.12_ACCEPTANCE](CHROME_v2.1.12_ACCEPTANCE.md) | 實際新版產物身分、35 項共用 gate 矩陣、同片基本回歸、作廢輪及資料清理限制 |
| [CHROME_v2.1.12_BR01_AUTO_INVESTIGATION](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) | Auto 影片延遲／正常 seek、救援抑制鏈、無界意圖與誤標恢復、獨立重現、原自然起因與政策限制 |
| [BR07_FIX_REPORT](BR07_FIX_REPORT.md) | keydown／keyup 各派送實際 seek 所有權、正式失敗契約、必要驗證及發布對照 |
| [BR08_FIX_REPORT](BR08_FIX_REPORT.md) | 完整拖曳命中／手勢所有權、control-loss、監控與恢復提交門檻、正式契約、獨立安全、來源隔離及發布核對；安裝版分列 |
| [CHROME_v2.1.16_ACCEPTANCE](CHROME_v2.1.16_ACCEPTANCE.md) | BR-08 來源隔離與實際新版安裝證據分列；BR-01 剩餘矩陣、前提、清理及待驗收狀態 |
| [CHROME_v2.1.15_ACCEPTANCE](CHROME_v2.1.15_ACCEPTANCE.md) | 實際新版完整身分、Auto 1／2 倍正常／故障窗口、BR-08 新缺陷、未成立矩陣與最終清理 |
| [CHROME_v2.1.15_BR08_PROGRESS_DRAG](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md) | P2 外層命中區長拖曳漏辨，現場 15 秒備援、正常 inner 反證、私有 3 fail／4 pass 與修復方向 |
| [CHROME_v2.1.14_BR07_KEYUP_SEEK](CHROME_v2.1.14_BR07_KEYUP_SEEK.md) | v2.1.14 原始右鍵 keyup 缺陷、原生時序、有效停滯窗口與清理限制 |
| [CHROME_v2.1.14_ACCEPTANCE](CHROME_v2.1.14_ACCEPTANCE.md) | v2.1.14 實際本體／singleton、正常對照、BR-07 失敗與待驗收矩陣 |
| [TEST_REPORT](TEST_REPORT.md) | v2.1.17 本輪修復／最終整合／安全／來源隔離、已完成發布／公開核對與待新版安裝狀態；v2.1.16 完整正文另存 archive |
| [CHROME_v2.1.13_ACCEPTANCE](CHROME_v2.1.13_ACCEPTANCE.md) | 新版 body、Auto 1／2 倍速影片延遲、一次重載、網站暫停撤銷、清理與待驗收矩陣 |
| [CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md) | 可信 BODY 方向鍵漏掉使用者修訂，Auto 1／2 倍提早備援、滑鼠對照、獨立失敗契約、根因與剩餘驗收 |
| [CHROME_v2.1.9_ACCEPTANCE](CHROME_v2.1.9_ACCEPTANCE.md) | 2026-10-09 部分真實瀏覽器驗收、18 個原生 XHR 案例及待定位停滯 |
| [CHROME_v2.1.9_BR02_XHR_FAILED_OPEN](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md) | 持續驗收確認的 XHR 例外安全性缺陷、六個 Chrome 失敗情境、根因與原始重現入口 |
| [BR02_FIX_REPORT](BR02_FIX_REPORT.md) | v2.1.10 修復、40 個新增正式契約、來源隔離驗證、安全審查及後續安裝版證據／gate 限制 |
| [CHROME_v2.1.10_ACCEPTANCE](CHROME_v2.1.10_ACCEPTANCE.md) | 68 個安裝版 XHR 案例執行通過、同片操作、87.8 秒 seek 追加觀察及未完成範圍 |
| [CHROME_v2.1.10_BR03_CONTENT_EPOCH](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) | 相同 DASH 清單排列誤觸 epoch、音訊授權失效、來源／安裝版重現與修正方向 |
| [CHROME_v2.1.11_PROGRESS](CHROME_v2.1.11_PROGRESS.md) | 安裝版 31 個 BR-03／42 個 BR-02 對照、部分 gate／R04、同片回歸、暫定 BR-04 Node 失敗及暫停檢查點 |
| [CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md) | 續測確認內部 XHR 準備遭同步重入失效，真 gate／原生對照、根因、重跑及清理證據 |
| [CHROME_v2.1.11_REMAINING_ACCEPTANCE](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md) | BR-01 救援抑制定位、正常網站／真 gate／真 SDK／42 個新增受控案例、完整剩餘覆蓋與原生限制 |
| [CHROME_v2.1.11_BR05_FETCH_ABORT_REASON](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md) | 真 gate Fetch 遺失取消原因，Chrome 原生對照、Node 3 pass／4 fail、位置與最小修正方向 |
| [BR03_FIX_REPORT](BR03_FIX_REPORT.md) | BR-03 本機修復、43 個新增正式契約、修復前後結果、安全差異審查、Chrome 來源隔離及安裝版待驗收 |
| [TEST_REPORT_HISTORY](../archive/retired/docs/TEST_REPORT_HISTORY.md) | v2.0.2～v2.1.9 的歷史完整報告，包括發行前模組化驗證 |
| [DOC_MAINTENANCE_HISTORY](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md) | 2026-10-03 三段原整理紀錄及後續有日期的文件檢查 |
| [v2.1.16 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.16) | 2026-10-10 已發布；遠端 main／標籤、唯一腳本及公開 latest 版本、大小、SHA-256 核對一致 |
| [Release/v2.1.16](../Release/v2.1.16/) | BR-08 封裝快照；保持發布準備當時內容，發布後不回寫 |
| [v2.1.10 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.10) | 2026-10-09 已發布；唯一附件及公開 latest 版本、大小、SHA-256 均核對一致 |
| [Release/v2.1.10](../Release/v2.1.10/) | 本次封裝快照；發布後不回寫 |
| [v2.1.9 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.9) | 2026-10-09 已發布並核對 latest 下載；附件只有 `BiliCDN_TW.user.js` |
| [Release/v2.1.9](../Release/v2.1.9/) | 當次使用者腳本、報告、變更紀錄、資訊清單、校驗值快照；發布後不回寫 |

自動驗證、安全掃描與真實瀏覽器驗收分開記錄。v2.1.8 的安全 `partial coverage`、MP4 試片／公開 DASH 觀察、較早 DASH 緩衝及完整公開 MP4／FLV 限制均保存於歷史報告；v2.1.9 發行前靜態差異審查為完整覆蓋，後續 BR-02 修復另有獨立報告，不沿用歷史安全結果。BR-01 停滯與其餘未覆蓋情境仍保留。**v2.1.6 Chrome／Tampermonkey 驗收已批准通過、已結案**，歷史覆蓋限制不構成待辦。

## 歷史計畫與瀏覽器紀錄

| 文件 | 保留範圍／狀態 |
| --- | --- |
| [SECURITY_REVIEW_v1.6.0](../archive/retired/docs/SECURITY_REVIEW_v1.6.0.md) | v1.6.0 候選版安全紀錄，不是現行政策或掃描 |
| [PLAN_v2.0.2](../archive/retired/docs/PLAN_v2.0.2.md) | 當時實作計畫；例外不作現行開發／發行規則 |
| [POST_RELEASE_v2.0.2](../archive/retired/docs/POST_RELEASE_v2.0.2.md) | 當時事故、修復及工作狀態 |
| [CHROME_v2.0.3_ACCEPTANCE](../archive/retired/docs/CHROME_v2.0.3_ACCEPTANCE.md) | 該版針對性瀏覽器回歸證據 |
| [CHROME_v2.1.2_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.2_ACCEPTANCE.md) | 該版觀察與覆蓋限制 |
| [CHROME_v2.1.6_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md) | 已批准通過且結案的驗收，保留觀察與限制 |

## 已撤銷的 CDN 新增研究

**新增節點計畫已撤銷。** 下列五份文件保留 2026-09-25 起的調查、實驗及停止新增節點決定。候選排序、建議及當時測試計畫不授權修改 Catalog，也不列入目前待辦。

| 文件 | 用途 |
| --- | --- |
| [CDN_OPEN_SOURCE_SURVEY](../archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md) | 外部專案及候選來源研究快照 |
| [CDN_NODE_FULL_SCREENING](../archive/retired/docs/CDN_NODE_FULL_SCREENING_2026-09-25.md) | Node 初篩，非正式瀏覽器驗收 |
| [CDN_CANDIDATE_TEST_PLAN](../archive/retired/docs/CDN_CANDIDATE_TEST_PLAN_2026-09-25.md) | 已撤銷測試草案 |
| [CDN_RANGE_PLAYBACK_EXPERIMENT](../archive/retired/docs/CDN_RANGE_PLAYBACK_EXPERIMENT_2026-09-25.md) | 當時 Range／播放實驗及限制 |
| [CDN_TEST_RESULTS](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md) | 跨環境結果及停止新增節點決定 |

## 不回寫的歷史資料

`Release/v*/`、`baseline/`、封存 v1 程式及安全產物保存當時證據，不作現行 v2 建置／測試輸入。文件維護不修改已封裝報告、校驗值、舊測試結果或已封存且不可變更的安全掃描。後續狀態更新最新版 TEST_REPORT，或新增有日期／版本的紀錄。

## 維護對照

| 變更來源 | 應檢查文件 |
| --- | --- |
| `domain/`、`state/settings-store.ts`、控制中心文字與命令 | README、PROJECT_CONTEXT；預設值、模式、操作名稱及例外 |
| 儲存解析器／鎖／監聽器、Vault、Fetch／XHR、瀏覽器攔截 | SECURITY、ARCHITECTURE；要求、實際保障與平台限制 |
| 控制器、介面、依賴規則及測試支援 | ARCHITECTURE、AGENTS、DEVELOPMENT；權責、生命週期及檢查範圍 |
| `scripts/`、工具設定、package 及依賴鎖定檔 | DEVELOPMENT、UPSTREAM_MANIFEST、THIRD_PARTY_NOTICES；命令、用途及輸出 |
| 實際測試、安全掃描、瀏覽器驗收 | TEST_REPORT 及對應日期／版本紀錄；只記錄已取得證據 |
| 測試執行器、測試資源範圍、FakeClock、型別設定 | TEST_TOOLING_REPORT、測試遷移對照；與產品發行及瀏覽器紀錄分開 |
| 封裝及 GitHub 發布 | README、CHANGELOG、TEST_REPORT、PROJECT_CONTEXT、本索引；版本、狀態、連結、雜湊及附件 |
| 使用者新增、取消或結案範圍 | TODO、PROJECT_CONTEXT 及相關歷史狀態標示 |

每次維護依序檢查：

1. 對照程式、設定及腳本核對文字、命令；測試數量只列於有日期／版本的驗證紀錄。
2. 檢查根目錄、`docs/` 及公開封存的 Markdown 連結、路徑、錨點及用途；新增文件納入索引。完成的歷史文件移至 `archive/retired/docs/`，同步更新連結。
3. 歷史資料標示適用版本／日期及現行指南入口，保留觀察、取消決定與限制。翻譯標題保留原錨點別名，搬移章節在固定入口留下導引。
4. 確認舊待辦未重新開啟，簽名 URL、憑證、IP 及播放器物件未進入文件。
5. 換版時將上一版完整 TEST_REPORT 加入歷史報告，再更新固定入口及原錨點導引；CHANGELOG 保留舊條目。兩個封裝輸入指向其他文件時使用完整儲存庫 URL，已發布快照不回寫。
6. 執行 `git diff --check`，確認差異範圍及受保護檔案未改變；實際執行的自動驗證按日期記錄，不將文件檢查寫成新安全掃描或瀏覽器驗收。

這些規則隨專案變更執行，不代表已建立排程、CI/CD 或持續監控。

## 文件整理歷史導覽

三段 2026-10-03 原紀錄已於 2026-10-06 搬入 [文件維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)，原日期、盤點數量及驗證敘述保留。本次整理的實際檢查也在該文件另立日期紀錄。

<a name="2026-10-03-文件維護紀錄"></a>

- [2026-10-03 文件維護紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-文件維護紀錄)

<a name="2026-10-03-第一次封存整理紀錄"></a>

- [2026-10-03 第一次封存整理紀錄](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-第一次封存整理紀錄)

<a name="2026-10-03-根目錄文件集中整理"></a>

- [2026-10-03 根目錄文件集中整理](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md#2026-10-03-根目錄文件集中整理)
~~~~~~~~

<a name="docs-todo-md"></a>

## docs/TODO.md

~~~~~~~~markdown
# v2 工作狀態與後續方向

## 現行 BR-01（v2.1.20）

**2026-10-11 使用者已要求停止一切測試，BR-01 自主目標已暫停。** 後續另授權的 [內建瀏覽器 Tampermonkey 可用性確認](IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md) 已通過，依使用者指示將未來預設測試環境改為 Codex 內建瀏覽器；這次有限範圍確認沒有恢復 BR-01 自主驗收。以下 active／持續執行文字描述停止前的輪次狀態，不能視為目前仍在執行。

同日一般能力重新驗證通過；背景窗口因實際切換與 getter 未充分校準而無效，已撤回「背景能力檢查不通過」判定。工具 selectedTab 2→3→2 與 prototype getter=false／Runtime visible=true 保留為觀察，不新增 BR-01 產品缺陷，也未恢復故障矩陣。

已修正新paused-transition保存過期SDK位置的缺口，新增16正式契約，全套771與完整verify通過；v2.1.20已正式發布，main／tag／唯一附件／公開latest版本、大小與SHA-256核對一致。[修正與驗證](BR01_NATIVE_POSITION_FIX_REPORT.md) 及 [最新發布狀態](TEST_REPORT.md) 各自記錄。05:12:19.828Z完整本體仍v2.1.19，新版安裝前提不通過，已請使用者手動更新後續測。以下19:58Z舊版觀察保留其時間點。

更新後05:17:15.659Z已核對完整v2.1.20與唯一singleton，必要手動更新已完成，目標工具已恢復active。新版新意圖保存最新目標／0、Auto1／2基本播放與短seek／12秒影片延遲、31秒拖曳及原生取消、可信控制撤銷後晚到拒絕子項通過。自然Auto2真實stall重載並恢復有媒體／動作證據，但Network長歷史截斷，不能算完整窗口。[本版二元續測](CHROME_v2.1.20_BR01_ACCEPTANCE.md) 列明界線與清理；完整失敗期限及其餘矩陣**目前不通過，持續執行原目標**。下一個窗口只在真實stall重載後開始影片延遲，前段通行且持續排空Network，不製造媒體狀態或重設控制器。

BR-01 **完整安裝判定不通過**，有效子項與不足項見 [v2.1.19續測](BR01_v2.1.19_INSTALLED_CONTINUATION.md)。正常Auto1／2、播放中12秒延遲與Auto1完整15／30／post15有證據；Auto2完整停滯、pointercancel／失焦全矩陣、晚到SDK、真正hidden、自然pending gate及其他交叉全矩陣不足。接續須核對修補版完整本體／唯一singleton，先驗證新意圖保存最新native目標，再逐項取得有效證據，不靠提前pause／外部核心撤銷或Node補算。原自然87.785秒網路起因独立未定位。

## v2.1.19 發布與更新前紀錄

v2.1.19 本機正式 755 項、完整 verify、30 項 Chrome 原生可信鍵盤來源隔離、安全差異 2／2 且 0 發現、正式發布及公開產物核對通過。19:58:35Z 指定影片仍 exact v2.1.18，安裝新版前提不通過；已開啟實際 Tampermonkey 更新確認頁，工具禁止操作擴充功能協定，需使用者完成該頁更新。原 BR-01 完整矩陣繼續逐項取得有效證據，不能以本機結果代替。見 [本輪修復](BR01_NATIVE_KEYBOARD_FIX_REPORT.md) 及 [最新驗證](TEST_REPORT.md)。

已確認 BR-09 於 v2.1.18 修復；下列版本／輪次保留歷史狀態。原 87.785 秒自然網路起因獨立未定位。

## 現行 BR-09 交付

BR-09 修復與 v2.1.18 正式發布通過：25 個新增正式契約、全套 741 項、最終 verify、Chrome 來源隔離 8 個恢復案例＋4 個原生邊界、安全差異 3／3 覆蓋且 0 發現。03:13:23（Asia/Taipei）發布，main／tag／唯一腳本及公開 latest 的 v2.1.18／334,747 bytes／SHA-256 核對一致；見 [BR-09 修復](BR09_FIX_REPORT.md)、[TEST_REPORT](TEST_REPORT.md)。

實際 v2.1.18 完整執行本體、Runtime／ControlCenter／PlayerAdapter 各唯一 1 及 Auto1／2 基本播放、UI 暫停／恢復、公用 SDK 短 seek 後進度通過；reloadCount=0。原未知目標歸零的原生因果矩陣為來源隔離，沒有冒充網站 singleton 故障窗口；[本版安裝紀錄](CHROME_v2.1.18_ACCEPTANCE.md) 分列。BR-01 v2.1.17 整體不通過的二元判定保留；本輪只修 BR-09，不反覆擴測 BR-01。原自然網路起因獨立未定位。

## v2.1.17 及更早工作歷史



本文件只記錄現行範圍；文件用途見 [索引](INDEX.md)，產品契約見 [PROJECT_CONTEXT](PROJECT_CONTEXT.md)，開發與發布流程見 [DEVELOPMENT](DEVELOPMENT.md)。現行狀態更新至 **2026-10-11**；各版完成狀態以其日期的驗證／發布／瀏覽器紀錄為依據；2026-10-06 文件整理見 [維護歷史](../archive/retired/docs/DOC_MAINTENANCE_HISTORY.md)。

## 本輪判定與已知問題

**2026-10-11 BR-01 本輪驗收判定完成，整體不通過。** [最終二元判定](BR01_v2.1.17_FINAL_ACCEPTANCE.md) 已逐項記錄通過／不通過及原因：實際 v2.1.17 Auto2 的一次備援、一次實際重載、重載後完整15秒失敗退出與再至少三tick不重試通過；Auto1完整期限、故障中新操作／晚到SDK、真正背景、影音故障隔離、自然cid歸因及真正pending gate不通過。本轮不继续重复失效窗口。前提／證據不足與程式契約失敗分列，不將工具限制當新缺陷。

**已確認未修復項：BR-09。** 未初始化媒體的新歸零目標可能被舊位置覆寫，來源失敗與網站完整因果分列；本輪沒有擴修。正常Auto1／2及約12秒延遲的有效同版子集保留，XHR安裝hook新增8／8原生對照通過。自有包裝、攔截、訂閱及計時器清理完成；123個已分類受控ID的記憶體／持久樣本零匹配。來源／正式測試／版本／Release不變，沒有新的完整程式驗證。

## 本輪之前的同版紀錄

下列文字保留較早輪次的狀態與限制；本輪現行判定以上段及最終報告為準，不再沿用其未定狀態作本輪結論。

**2026-10-11 續測新增 P2 [BR-09：未初始化媒體的歸零目標漏撤銷舊位置還原](CHROME_v2.1.17_BR09_UNINITIALIZED_SEEK.md)，未修復。** 來源獨立正確契約2 fail／3 pass；Chrome原生Blob＋真正Adapter／Recovery來源隔離的unknown-zero使0被舊0.25覆寫，另三個正常對照通過。非零metadata的seeking防護仍有效；網站3152→2037回退沒有完整因果，不能直接歸因於本缺陷。本輪達成找問題並交付報告的目標，沒有修改執行期或正式登記；正式716綠燈仍是發布時的證據。Auto1／2約12秒延遲已有新版子集；完整15／30／post15、近0／新操作／晚到SDK、真正hidden、政策／影音隔離與自然pending gate仍待，先修BR-09再續驗。自有资源清理完成、43個已分類受控樣本零學習匹配，長滾動歷史淘汰不補算。

**2026-10-11 v2.1.17 BR-01 SDK 重載後續恢復修復、必要驗證、正式發布及公開產物核對完成；新版安裝驗收已有部分證據，完整矩陣未結案。** 已修復合法自有 reload 的同步 native pause／空核心、第一個標記新核心後的有界恢復、SDK 自行 seek 撤銷舊位置，以及 BODY Space／k／倍速可信派送內實際控制變化的 userRevision；補齊兩次進度確認跨租期、終止後 SDK resume 不重試與同步重入／晚到清理。指定影片已實際載入完整 v2.1.17，正常 Auto 1／2 倍與自有 SDK 重載後續恢復子集取得證據；現行交付與待完成範圍如下，詳見 [後續修復報告](BR01_FOLLOWTHROUGH_FIX_REPORT.md)、[驗證報告](TEST_REPORT.md) 與 [v2.1.17 Chrome 驗收](CHROME_v2.1.17_ACCEPTANCE.md)。

- **正式失敗與最終綠燈分列：** application 原六案在來源未變時 **3 fail／3 pass**；播放器入口另 **10 fail／20 pass**，與原 637 基準通過分列。最後 adapters **102／102**、application **231／231**、全套 **19 套件／716／716**、typecheck、**44 個執行期模組**架構及最終 verify **v2.1.17** 通過，包含完整 15 秒無進度退出、跨租期連續進度、終止後不重試、新操作／外部核心、政策失效與晚到完成／清理。
- **本輪安全差異完成：** Codex Security 掃描 `39e2743e-185d-4c7d-a04d-f6580e61385a` 已封存，**11／11 差異項、0 候選／0 可報告發現**。主機另警告整體工作目錄變動；四個執行期檔案雜湊仍與凍結來源一致，不能宣稱整體目錄快照一致，不沿用 v2.1.16 的掃描。
- **最後來源隔離完成：** Chrome **22／22**（12 個控制模型＋10 個真正可信輸入）通過；合成媒體／FakeClock 只在自有 iframe，31 秒拖曳是模型時間。來源工具清理已核對 timers=0、自有根節點移除及輔助程序停止；這不是修補版安裝驗收，原始前提與清理見 [v2.1.17 Chrome 紀錄](CHROME_v2.1.17_ACCEPTANCE.md)。
- **正式交付完成：** [v2.1.17](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.17) 於 **2026-10-11 00:31:14（Asia/Taipei）／2026-10-10T16:31:14Z** 發布；遠端 main／版本標籤對應發行提交 `1b87d3f759e479e67650e291b5a8d8f107102145`。唯一腳本附件 **332,575 bytes**，SHA-256 **`4bb4601a91e5e752595a5a8ec1b4d8905036954f299d578ca93209c059ce6a06`**；**2026-10-10T16:31:40Z** 無認證公開 latest 的版本、大小與 SHA-256 一致。後續純文件提交另行推送 main，不改寫版本標籤及已發布產物。
- **新版實際身分已確認：** 2026-10-11 **00:34:48.957（Asia/Taipei）／2026-10-10T16:34:48.957Z** 已核對指定影片完整 v2.1.17 執行 IIFE 與 Release 本體一致、Runtime／ControlCenter 各唯一 1 及 hooks；版本／332,575 bytes／上述 SHA-256 相符。00:32:42.615 仍載入 v2.1.16 的觀察保留其歷史時間點，使用者手動更新已完成，不再是目前阻塞。
- **新版安裝部分通過：** Auto 1／2 倍的正常播放、BODY 暫停／恢復與短 seek 取得實際時間／影格進度，可信新操作更新 userRevision。各一次真正 Recovery 自有 reload 跨過 SDK pause／null／第一個標記新核心，保留 SDK 整秒 seek、還原 rate／play，兩次時間／影格證據後 recovered；沒有 Adapter.seek 回寫保存的舊位置。這只證明正常操作與自有 SDK 重載後續恢復子集，不把攔截釋放後的恢復或網站提前暫停／外部換核心算成完整 15／30／15 通過。
- **新版安裝仍待完成：** 完整 15／30／重載後 15 秒無進度失敗退出及至少三個 tick 不重試、精確約 12 秒 video-only 延遲、新操作／晚到 SDK 完整矩陣、真正 hidden、生命週期／政策／影音隔離及真正 singleton pending startup gate 的 BR-04／05 等剩餘項目仍須有效現場證據。沒有實際 seek 的點擊或操作逾時不成立延遲前提；未匹配的 Auto 新路徑與 Network 處理缺口不證明持續全面 video 阻擋。Auto 1 倍 Network 有截斷及 76.071 秒處理空隙，歷史滾動曾淘汰事件（everDropped=true；最終 dropped=false），不能補算歷史事件。僅在取得新的必要前提後重跑，不修改網站 timeout、媒體 getter、控制器或起播預算製造前提。
- **新版工具及受控資料清理完成：** 12／12 自有方法完整描述子還原，timer／liveXHR=0、held=0、patterns 空，觀察器已移除，最後 Auto 1 倍有健康播放進度。2,027 個已分類受控 request ID 的記憶體／持久樣本匹配皆 0，四個學習攔截 hook 的所有權在清理前確認；此結果只證明清理與已分類受控資料，不補齊歷史覆蓋或未分類工作。
- **舊版 SDK 校準與新版救援分列：** 實際 v2.1.16 Auto 1／2 倍手動 Adapter.reload 均觀察同步 pause、null 核心、第一個標記新核心與 SDK 整秒 seek，沒有經由 Recovery token 啟動，只校準 SDK 時序。1 倍立即排空後的連續 15 秒 Network 無截斷；2 倍首個歷史批次截斷不能補算。新版真正自有救援及剩餘項目另列上述安裝證據，不倒推舊校準為控制器驗收。
- **自然起因仍獨立待定位：** 原 87.785 秒窗口已存證先前 video timeout 與非零 bytes，但沒有原始 timeout 設定、完整 Network 與 SDK 操作者，不能認定 CDN 故障。此前約 19～21 秒 pause／外部換核心僅證明撤銷，不算完整期限；新的自有 SDK 暫停校準也不能倒推每個舊窗口的操作者。Auto 位置跳變與其他既有限制保持。

### v2.1.16 已發布基準與上一輪安裝證據

**2026-10-10 BR-08 完整拖曳契約修復與 v2.1.16 發布完成；BR-01 完整安裝版驗收已有部分證據，仍未完成。** 進度列外層／內層的有效可信拖曳均取得單一手勢保護；監控停滯、watchdog、冷起播與 Recovery 建立意圖統一排除拖曳，提交前重查操作／媒體／核心、生命週期、資格及額度。一般停滯在釋放後建立新 15／30 秒期限；冷起播仍保留原 firstMediaAt 與每分頁預算。原七契約先保存 **3 fail／4 pass**，修復後通過；全套 **637 正式案例**、typecheck、architecture、最終 verify **v2.1.16** 與 diff 檢查通過。獨立 Codex Security 差異審查 **14／14 覆蓋、0 可報告發現**；Chrome 來源隔離 **31 個有效案例通過**，另兩個無效校準窗口排除，清理完成。21:05:38（Asia/Taipei）已發布，遠端 main／標籤、唯一腳本附件及公開 latest 版本／大小／SHA-256 均核對一致；以上不能替代實際 Tampermonkey 新版驗收。見 [BR-08 修復報告](BR08_FIX_REPORT.md)、[最新版驗證](TEST_REPORT.md) 與 [v2.1.16 安裝矩陣](CHROME_v2.1.16_ACCEPTANCE.md)。

- **實際新版身分已確認：** 21:11:07.331（Asia/Taipei）指定影片已載入 v2.1.16；完整執行 body 與 **320,794 bytes** 發行本體一致、singleton 1、hooks 與控制器組合身分核對完成。先前 21:07:51 的 v2.1.15 觀察保留於驗收歷史，不再是目前更新阻塞。
- **新版安裝版已有證據：** Auto **1／2 倍分開**，wrapper／inner 四個有效故障窗口持續按住超過 32 秒，dragging=true、無腳本重載，釋放後 dragging=false。兩種倍速的正常播放／暫停／恢復／短 seek 及約 12 秒 video-only 延遲後恢復均取得證據：1 倍延遲 **12.215 秒**、連續觀察至 **32.445 秒**，時間與影格前進；2 倍延遲 **12.129 秒**及 15 秒尾窗有進度，後續獨立 6 秒觀察 recovered，中間缺口及其後截斷批次不當成連續時序。實際進度分別到 **19.307／26.180 秒**才出現，故兩窗各於 **15.041／15.913 秒**提交一次合法路線備援；兩個有效主窗均 audio 通行、核心重載 0、無截斷／處理錯誤，10 個受控 video 請求的記憶體／持久樣本匹配 0、未分類 0。釋放後已暫停／換核心的讀回僅確認手勢釋放，不能驗證最新目標的還原與新期限；網站約 19～21 秒提前暫停／外部換核心的窗口不計入完整 BR-01 逾時。
- **BR-02 原生行為子集通過：** 新版實際 XHR hook 與未攔截自有 iframe 的 NativeXhr，以合成 Blob 完成 **33／33 成對對照**，涵蓋 OPENED／已送出／DONE 的 failed open、終止事件重入與成功 reopen、同步 OPENED 回呼、text／json getter 及轉換例外。初次 32 pass／1 對原生與攔截同失敗是「未 send 時 abort 仍 OPENED」的觀察校準，保留原結果；33 對是 Chrome 子集證據，不增加 **637** 正式案例，也不宣稱 BR-02 全部結案。Catalog／HTTPDNS 本地拒絕與虛擬 DONE、實際媒體目標歸因／送出次數、gate 等待及 BR-03 cid／epoch 仍待現場驗收。
- **新版安裝版待完成：** 完整 15／30／15 退出及至少三個 tick 不重試，新操作／pointercancel／近 0、晚到 reload／play、真正 hidden、生命週期／政策／影音隔離、上述 BR-02 未涵蓋子項、BR-03 及真正共用 startup gate 的 BR-04／05 仍須有效現場證據。真背景入口目前因 `Browser.getWindowForTarget` 工具不支援而受限；同片原生請求的真正 gate 均為 `preflight-skipped:xhr-explicit-timeout`，沒有 pending 窗口。提前 pause／error／外部換核心或事件截斷只證明撤銷，不算完整期限通過；未成立的自然前提保持待驗收，不修改網站 timeout 或重設預算製造前提。
- **Auto 位置跳變待定位：** 模式復原約 **174.648 秒**後觀察到播放位置 **2913 → 0.307 秒**，當時沒有新的 route／core action，也沒有 generation／epoch／核心身分變化。SDK 與完整 Network 證據不足，採樣達 **2000 列**上限後出現 dropped，未確認為腳本缺陷；需在完整觀察窗口追查位置變更來源。原始限制與續查條件見 [v2.1.16 安裝紀錄](CHROME_v2.1.16_ACCEPTANCE.md)。
- **獨立限制：** 原 87.785 秒自然網路起因及其餘完整產品驗收保持待定位／待驗收，不因 BR-08 本機修復或來源隔離通過而結案。Auto 不強制畫質、不切換指定影片、不修改 Chrome 設定或停用其他腳本。

### v2.1.15 及更早輪次的歷史時間點

以下「目前待修」「未修復」描述各輪當時狀態，不代表目前 BR-01 本機修補來源；現行待完成以上段為準。

**2026-10-10 BR-07 修復與 v2.1.15 發布完成；已載入新版並部分驗收，完整 BR-01 未結案。** 原契約 2 fail／3 pass→5／5；BR-06／BR-07 **100／100**（40＋60）、全套 **19 套件／574 正式案例**、typecheck、**44 個執行期模組**架構與最終 verify **v2.1.15** 通過，Chrome 來源隔離 **40／40 有效案例**通過；獨立安全完整覆蓋／0 可報告發現。18:57:18（Asia/Taipei）發布，公開 latest **2.1.15／317,487 bytes／SHA-256** 匹配。更新前 18:59:19 仍 v2.1.14 的中途觀察保留；使用者更新後，19:04:00 已核對完整 v2.1.15 body／singleton 1。Auto 1／2 倍正常鍵盤、新 15 秒寬限與約 12 秒影片延遲後恢復有有效證據，2 倍另達 30 秒一次重載；其後網站 paused，完整重載後 15 秒前提未成立。詳見 [修復](BR07_FIX_REPORT.md)、[驗證](TEST_REPORT.md) 與 [安裝矩陣](CHROME_v2.1.15_ACCEPTANCE.md)。

**目前待修：P2 [BR-08 進度列外層拖曳漏辨](CHROME_v2.1.15_BR08_PROGRESS_DRAG.md)。** 真正 Auto 2 倍外層按住未釋放時，dragging=false，15.079 秒誤觸一次 video fallback；內層受控按住超過 16 秒不啟動救援。私有正確契約 7 案 **3 fail／4 pass**，與發布前正式 574 通過分列。已依「找到新問題並詳細報告」條件停止擴展驗收、完成清理；本輪不擴修，下一輪先制定 BR-08 修復及失敗契約，修復後續跑 [BR-01 剩餘矩陣](CHROME_v2.1.15_ACCEPTANCE.md)：重載後完整 15 秒退出／不重試、拖曳／pointercancel／近 0、晚到 SDK、真正 hidden、生命週期／政策與影音隔離及 BR-03／共用 gate 的 BR-04／05。原 [BR-07 調查](CHROME_v2.1.14_BR07_KEYUP_SEEK.md)、[v2.1.14 安裝](CHROME_v2.1.14_ACCEPTANCE.md) 與自然網路起因保留。

以下 v2.1.13 段落保留原調查時間點；其中「未修復」不代表 v2.1.14 本機來源。

**2026-10-10 約 13:45–13:57 續測確認 BR-06，未修復。** 實際 v2.1.13、指定風景片 Auto 1／2 倍在新可信 BODY 方向鍵 seek 後 8.205／6.986 秒便觸發備援；使用者修訂沒有更新，沿用舊停滯期限。故障中新的滑鼠 seek 對照通過；獨立正確契約 2 fail／3 pass，既有正式 BR-01 26 個案例仍通過但漏掉此入口。已完成「找到問題並交付詳細報告」的自主目標，**完整 BR-01 安裝驗收未通過**。修正方向、證據、清理與重跑見 [BR-06 報告](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)。本輪只調查，來源／正式測試／Release 未修改；鍵盤所有權須先修復，其餘逾時、hidden、晚到完成及操作矩陣保留。

**2026-10-10 BR-01 A／B／C 修復、必要驗證與 v2.1.13 發布完成；完整安裝版驗收未結案。** Auto 15／30／15 秒有界救援、最新操作所有權、兩次實際進度證據已實作；474 正式案例與 verify、獨立安全差異及 Chrome 來源隔離 22／22 通過。公開 latest 與實際新版 body 已核對；Auto 1／2 倍速的 12 秒影片延遲恢復、2 倍速的一次備援／核心重載及網站提前暫停撤銷取得有效證據。仍須取得安裝版重載後完整 15 秒無進度退出／不重試，以及故障期間新操作、真正 hidden／晚到完成等矩陣；65 秒持有輪由網站約第 24 秒暫停，不能取代這些前提。原 87.785 秒自然網路起因與其餘完整產品驗收保持獨立，正常 Auto 降解析度不是缺陷。見 [BR-01 修復](BR01_FIX_REPORT.md)、[安裝版紀錄](CHROME_v2.1.13_ACCEPTANCE.md)、[原始調查](CHROME_v2.1.12_BR01_AUTO_INVESTIGATION.md) 及 [最新版驗證](TEST_REPORT.md)。

**上一版紀錄：2026-10-10 BR-04／BR-05 修復、v2.1.12 發布及兩項安裝版驗收完成。** 新增 66 個正式案例，全套 448 個與 verify 通過；獨立安全差異審查無可報告發現。04:24 發布及公開產物核對完成；Chrome 來源隔離 36／36，BR-02／03 各 31／31。實際更新的 Tampermonkey 35／35 共用 gate 矩陣與同片播放／暫停／短程 seek 通過，作廢 CORS 輪與學習資料清理限制另列。當時 BR-01 長 seek 政策與原始網路起因、background／自然 SDK 故障及其餘完整驗收保持獨立待完成；本輪現行狀態以上段為準。歷史結果見 [修復交付](BR04_BR05_FIX_REPORT.md)、[安裝版紀錄](CHROME_v2.1.12_ACCEPTANCE.md)。

以下段落保留 **v2.1.11 各輪的歷史時間點**，其中「未修復」「未安裝」不代表本輪來源或裝置狀態。

**2026-10-10 03:02–03:36 新目標續測已交付；產品驗收仍未全通過。** [剩餘驗收報告](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md) 分列正常 4K／8K seek、長暫停、真正 gate、實際 SDK 核心替換及 42 個新增受控案例。BR-01 已定位 seeking 持續延長寬限、抑制 watchdog／startup／core 恢復的機制；原始 timeout 與降畫質因果仍待查。新增 [BR-05](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md) 已確認 gate 取消丟失 caller reason，Node 正確契約 4 個失敗、原生對照 3 個通過。**BR-04／05 未修復**；需另立修復範圍、決定 BR-01 超長 seek 政策，並取得真正 background 及 SDK 自然故障證據。來源、正式测试與 Release 沒有改變，未觸發修復發布流程。

以下為先前各輪日期的狀態，新的續測目標沒有以已知 BR-04 作為替代退出；以本段與新報告為現行待辦。

**2026-10-10 續測確認 BR-04，已完成找問題並交付報告的目標。** 真正 Chrome 155／v2.1.11 安裝版在起播 gate 的內部 OPENED 回呼再次 failed sync open，留下 UNSENT／metadata sent、無終止事件及未處理 InvalidStateError；同 gate 的 SyntaxError 正常對照完成一次。詳細根因、重跑入口與修正方向見 [BR-04 報告](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)。來源未修復，BR-01 與完整 gate／恢復／R04／生命週期驗收仍未結案；下方暫停段落保留中途時間點。

**2026-10-10 v2.1.11 安裝版驗收中途暫停。** 實際載入版本及產物已核對；BR-03 31 個有效案例、BR-02 42 個對照通過，真正 gate 與 R04 取得部分證據。同片畫質與程式入口 seek 正常，BR-01 不結案。新增暫定 BR-04 已在獨立 Node 契約重現，Chrome 複核未執行；依使用者要求停止，不自動續測。詳細結果、清理限制與續行點見 [中途報告](CHROME_v2.1.11_PROGRESS.md)。下列發布當時的「尚未安裝」不代表目前裝置狀態。

**v2.1.10 已發布 BR-02 修復，安裝版部分驗收完成。** 使用者更新後，本輪真正 Chrome／Tampermonkey 的 68 個 XHR 案例執行通過，取得同片播放／暫停及一次 8K→4K 正常對照；真正 startup gate 的 failed open 交錯仍未觸發，不宣稱 BR-02 全矩陣結案。新增正式契約、來源隔離及安全審查保留於 [BR-02 修復報告](BR02_FIX_REPORT.md)，當時 [原調查](CHROME_v2.1.9_BR02_XHR_FAILED_OPEN.md) 不覆寫。

**BR-03 已隨 v2.1.11 發布；修復版安裝驗收待完成。** 2026-10-10 01:52（Asia/Taipei）從 `d3d1bc3185d51b62891920135b4126441e059696` 發布，01:53 公開 latest 讀回的版本、大小與 SHA-256 一致；AGENTS 已記錄修復通過必要驗證後自主提交／升版／推送／發布的持續授權。 請求 cid 優先、缺少時以有界父目錄集合判定內容，修正相同清單排列誤增 epoch／撤銷音訊身分。新增 43 個正式契約，全套 382 案例及完整 verify 通過；獨立安全差異審查 14 個來源／測試檔完整覆蓋、無可報告發現。Chrome 修復來源 BR-03 31／31 與 BR-02 對照 31／31 通過；尚未安裝修復產物。詳細交付及下一步見 [BR-03 修復報告](BR03_FIX_REPORT.md)，[原調查](CHROME_v2.1.10_BR03_CONTENT_EPOCH.md) 保留失敗紀錄。

BR-01 根因仍待定位：先前驗收重載後 4K 切換加 seek 停滯約 87.8 秒，最後解碼降為 1080p，選單仍顯示 4K；當段 epoch 維持 0，沒有證明與 BR-03 同根因。BR-03 修復輪在既有 v2.1.10 安裝版分開操作暫停、4K↔1080P、seek，短程正常，不能據此結案。其餘真正 gate／恢復／影音故障隔離等未改標通過，詳見 [v2.1.10 瀏覽器紀錄](CHROME_v2.1.10_ACCEPTANCE.md)。前段 18 個原生 XHR、R02／R03 控制中心交錯及部分播放證據維持 [v2.1.9 原紀錄](CHROME_v2.1.9_ACCEPTANCE.md) 的日期與範圍。

v2.1.8 在 2026-10-04 的修復、發布、Tampermonkey 標準更新與當時已安排的 Chrome 回歸仍維持已完成；該證據不覆蓋v2.1.9 修改。

原 MP4 影片已改會員限定，現場證據只涵蓋合法 30 秒試看片段；另以公開 DASH 影片驗證播放及網路面板（Network）。完整公開 MP4 與 FLV 尚無現場樣本，保留為覆蓋限制，不另列為已批准待辦。詳細結果見 [v2.1.8 歷史報告](../archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)。

## 已完成／已結案

- **2026-10-10 BR-08 修復與 v2.1.16 發布**：完整拖曳命中／手勢所有權、control-loss 通知、三個 Monitor 入口及 Recovery 提交門檻已修復；637 正式案例、verify、獨立安全 14／14 覆蓋／0 發現、Chrome 來源隔離 31 個有效案例通過。21:05:38（Asia/Taipei）發布，發行提交／peeled tag `ff0cb07063032aeb49a9e52ccc630685bec46cf8`，遠端 main／標籤與唯一 **320,794 bytes** 腳本附件一致；21:06:11.073 公開 latest 的版本及 SHA-256 `5eaeb8444503886244b06f81cb24a81081720a0ea5dcb978c284c776eb05e8d4` 匹配。21:11:07.331 已核對實際新版身分，拖曳及基本播放取得部分證據；BR-01 完整安裝驗收仍列上方未完成。
- **2026-10-10 BR-07 修復與 v2.1.15 發布**：574 正式案例、最終 verify、獨立安全完整覆蓋／0 發現、Chrome 來源隔離 40／40、發布時遠端 main／標籤／唯一附件與公開 latest 版本、大小／SHA-256 核對完成；實際 v2.1.15 body／singleton 1、Auto 1／2 倍新鍵盤修訂及 15 秒寬限取得證據。新增 BR-08 未修，完整 BR-01 另列未完成。
- **2026-10-10 新缺陷報告與收尾**：BR-08 現場、正常反證及私有失敗契約完成；107 受控 IDs 記憶體／持久匹配皆 0，攔截／自有觀察器／包裝已清理，同片 Auto 1 倍暫停交接。只完成本輪報告退出條件，沒有宣稱完整驗收通過。

- **2026-10-10 BR-01 A／B／C 修復及 v2.1.13 發布**：474 正式案例、verify、安全差異及 Chrome 來源隔離 22／22；main／標籤、唯一附件及公開 latest 的版本／大小／SHA-256 核對完成，實際新版 body 已載入。安裝版已有部分有效證據，未把剩餘矩陣或自然網路起因標為完成。
- **2026-10-10 BR-04／BR-05 修復及 v2.1.12 發布／兩項安裝版驗收**：448 個正式案例、完整 verify、安全差異審查、Chrome 來源隔離、main／標籤及公開附件核對完成；新版實際 singleton 35／35 與同片基本回歸通過。未將此結果擴大為 BR-01 或完整產品驗收完成。
- **2026-10-10 BR-03 修復及 v2.1.11 發布**：382 個正式案例、完整 verify、安全差異審查與 Chrome 來源隔離完成，01:52 已發布、01:53 核對公開更新。更新後安裝版部分結果及暫停狀態列於上方。
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
~~~~~~~~

<a name="docs-test-report-md"></a>

## docs/TEST_REPORT.md

~~~~~~~~markdown
<a name="bilicdn_tw-v2120-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.20 BR-01 新意圖位置保存驗證 — 2026-10-11

2026-10-11 使用者停止自主故障測試後，另授權的 [內建瀏覽器 Tampermonkey 可用性重新驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_TAMPERMONKEY_CAPABILITY_2026-10-11.md) 確認完整 v2.1.20、唯一實例、可信輸入、控制中心及合成 Fetch／XHR 攔截通過。背景窗口因實際切換與 getter 未充分校準而無效，已撤回背景能力失敗判定；selectedTab 2→3→2 與 prototype getter=false／Runtime visible=true 保留為觀察。一般測試預設改為內建瀏覽器，BR-01 自主目標保持暫停；本次環境確認沒有重跑 npm 或修改發布快照，也不增加 BR-01 通過項目。

基準v2.1.19／ff725e918793531cb39bd9aa7d506779360c754e，開始時乾淨。修正新paused-transition保存SDK舊位置，見 [修正報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_NATIVE_POSITION_FIX_REPORT.md)。必要本機門檻通過；發布核對另記於下節，完整實際安裝矩陣未通過。

| 項目 | 本輪結果 |
| --- | --- |
| 執行期未修改時正確契約 | 12 fail／4 pass |
| 最終型別正確契約＋不可變原來源重建 | 12 fail／29 pass，含既有25正常案；不回滾來源 |
| 新正式回歸 | 16／16；application286／286 |
| npm test／最終verify | 19套件／771／771；0 fail／skip／todo／cancelled |
| typecheck／architecture | 通過，44個執行期模組 |
| npm run verify v2.1.20 | 退出0；確定性建置、語法、v2-only及封裝校驗通過 |
| Chrome原生HAVE_NOTHING位置讀取 | 自有iframe真正空video6／6，無getter覆寫 |
| Chrome Adapter／Recovery模型 | 自有iframe受控媒體／FakeClock6／6；不是安裝singleton |
| Codex Security差異 | 已封存2／2，0候選／0發現；封存後test-only参数修正另審查驗證 |

Node26.8.1／npm11.19.0／TypeScript7.0.2／esbuild0.28.2。證據與重跑入口存於 .work/functional-fixes/br01-native-position/2026-10-11-ff725e9/。Chrome ownVideos=0、iframe移除；沒有修改網站媒體getter、控制器或起播預算。

## 安全範圍

掃描2661c0e4-d1dc-44cc-b4a6-089883858759於2026-10-11T05:02:52.273269Z封存，獨立架構及位置／恢復／路線消費邊界完成。runtime SHA-256 417fdbdcd229e47a5d7e7f75584fb8cfe55eac0e57b24859e62b4a142d0afa28封存後不變。原封存br09.ts的一個armRouteFailure參數錯誤由typecheck抓到；改為傳入真正VideoSnapshot後，父代理另審查單行test-only差異與重新驗證，不冒充原封存測試雜湊。根SECURITY.md人工解析，因工具錯報Windows目錄不存在；舊安全產物不回寫。新try只保證native讀取邊界，不宣稱所有既有getter安全。

## 發布與實際安裝

v2.1.20於2026-10-11T05:09:46Z（Asia/Taipei13:09:46）[正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.20)。發布時遠端main與peeled tag均為18f0c4f1923e62692ee4a52bac18f475ad837e15，tag ref為11a0c3784dd7fc937f0a9065cfbab704b35669f6。唯一BiliCDN_TW.user.js附件336,219 bytes，SHA-256 b8e5bd4744737537f348fcc7d9fb9f258fd41bc5e60327e5f4259560dcd5b54e；05:10:16.111Z無認證公開latest版本／大小／SHA-256完全一致。封裝前diff檢查通過，Release快照不回寫；後續純文件提交另推main。

05:12:19.828Z指定影片完整執行本體exact v2.1.19，非v2.1.20；Debugger身分事件無截斷或未排空。新版安裝前提不通過，已請使用者完成必要Tampermonkey手動更新，工具不能操作擴充功能更新介面。這是實際載入阻塞，不是發布授權；沒有以舊版或來源結果計入新版通過。

使用者更新後05:17:15.659Z，完整本體 exact v2.1.20、Runtime／ControlCenter各唯一1，身分事件未截斷且排空。實際 Auto1 新目標與 Auto2 有效0保存修正通過；正常播放／短seek／12秒影片延遲、31秒拖曳及可信 pointercancel／lostpointercapture、可信控制撤銷後晚到拒絕取得有效子項。自然 Auto2 stall 的一次實際重載及9秒後 recovered 有完整媒體／動作紀錄，但長歷史Network截斷，不計完整合併窗口。完整同版失敗退出與其餘矩陣目前**不通過，原目標持續執行**；詳見 [實際v2.1.20續測](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.20_BR01_ACCEPTANCE.md)。更新前載入阻塞已解除；本輪沒有新的來源變更或完整自動重跑。

v2.1.19完整本體／唯一singleton已確認。正常Auto1／2、播放中12秒video延遲及Auto1完整15／30／post15＋不重試取得有效子項；新意圖保存舊SDK位置不通過，由本版修正。Auto2完整停滯、晚到SDK全矩陣、真正hidden、自然pending gate及其他剩餘項未取得全部有效證據，**BR-01整體不通過**。見 [實際續測二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.19_INSTALLED_CONTINUATION.md)。v2.1.20實際安裝前提未成立時，不計新版通過；須核對body／唯一singleton後重跑本輪缺口及剩餘矩陣。原87.785秒自然網路起因獨立未定位。

## 歷史導覽

- [v2.1.19完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2119-release-verification--2026-10-11)
- [v2.1.17二元判定](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.17_FINAL_ACCEPTANCE.md)
- [更早完整報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
~~~~~~~~
