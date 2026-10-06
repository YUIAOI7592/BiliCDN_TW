# Node 內建測試遷移對照

基準為本次修改前的 v2.1.8 工作樹（修改前保存；正式來源未變）。遷移前以保存的套件及支援工具重跑，15 個套件共 891 項功能斷言；另有 18 項架構規則期待。Node 案例數表示具名情境，不等於舊斷言數。

同情境的多項期待保留在同一案例；參數案例名稱帶有輸入及序號。建立函式（factory）每次重建設定、儲存元件（store）、Vault、控制器與攔截，較早的必要狀態轉換僅作該情境的前置設定，較早的期待由各自案例檢查。獨立 MP4／FLV 測試情境（fixture）直接於各案例建立。原比較保留字串、JSON、物件身分及 strictEqual（Object.is）語意。

唯一有意替換的舊時間期待為應用層的三秒牆鐘上限，改為注入 FakeClock，確認 2,999 ms 未完成與 3,000 ms 完成。原參數輸入與其他斷言訊息保持。共用輔助函式中的斷言仍由呼叫它的情境驗證。

## 套件基準

| 套件 | 原功能斷言 | 原斷言呼叫位置 |
| --- | ---: | ---: |
| `domain-boundaries.ts` | 20 | 20 |
| `adapter-boundaries.ts` | 24 | 19 |
| `adapters.ts` | 128 | 124 |
| `application.ts` | 99 | 86 |
| `diagnostics.ts` | 48 | 40 |
| `domain.ts` | 19 | 19 |
| `measurement-state.ts` | 8 | 8 |
| `native-routing.ts` | 77 | 71 |
| `native-transport.ts` | 106 | 80 |
| `orchestration.ts` | 18 | 18 |
| `playurl-summary.ts` | 49 | 44 |
| `progressive-playurl.ts` | 139 | 112 |
| `progressive-routing.ts` | 58 | 58 |
| `progressive-transport.ts` | 15 | 12 |
| `state.ts` | 83 | 83 |

## 原行為群組與具名案例

下表的行號指搬移前檔案，並非目前來源行號；保留相同的套件路徑、群組序號與參數占位符。中文欄說明行為，英文欄逐字保留原對照名稱（包含原有截短文字），不改動實際測試名稱。參數案例會再加實際輸入及序號，各分支與矩陣沿用原測試。

| 套件 | 原行號 | 中文行為說明 | 原英文案例群組 |
| --- | --- | --- | --- |
| `domain-boundaries.ts` | 6–19 | 領域套件沒有瀏覽器 location 全域值。 | `domain suite has no browser location [1]` |
| `domain-boundaries.ts` | 19–30 | 黑名單優先於其他限制。 | `blacklist takes priority over other restrictions [2]` |
| `domain-boundaries.ts` | 30–33 | Catalog 備援偏好保留首次出現的穩定順序。 | `Catalog backup preferences retain stable first occurrence [3]` |
| `adapter-boundaries.ts` | 7–23 | 探測消耗的位元組不超過宣告上限。 | `probe caps consumed bytes at its declared limit [1]` |
| `adapter-boundaries.ts` | 23–28 | 拒絕不符合狀態或回應授權的探測：${status}、${target}、${redirected}。 | `probe rejects status/response authority: ${status}, ${target}, ${redirected} [2]` |
| `adapter-boundaries.ts` | 28–71 | 已取消的探測不啟動網路工作。 | `already cancelled probe does not start network work [3]` |
| `adapter-boundaries.ts` | 71–79 | 導覽觀察 history 與 popstate。 | `navigation observes history and popstate [4]` |
| `adapters.ts` | 25–111 | 驗證 Fetch 與 XHR 攔截的安裝指派。 | `Fetch and XHR hook assignments are verified [1]` |
| `adapters.ts` | 111–161 | 停用模式直接放行網站 Fetch。 | `disabled mode passes site fetch through [2]` |
| `adapters.ts` | 161–186 | 改寫後的 Request 保留請求標頭。 | `rewritten Request preserves request headers [3]` |
| `adapters.ts` | 186–214 | 黑名單中的非 GET Fetch 不進入原生 Fetch。 | `blacklisted non-GET Fetch never reaches native fetch [4]` |
| `adapters.ts` | 214–244 | 原生 Fetch 保留 init.method 覆寫值。 | `init.method override is preserved for native Fetch [5]` |
| `adapters.ts` | 244–289 | 禁止的原始來源不能留在 playurl 主線或備援。 | `forbidden original cannot remain in playurl primary or backup [6]` |
| `adapters.ts` | 289–310 | 不透明簽名輸出僅供觀察。 | `opaque signed output remains observation-only [7]` |
| `adapters.ts` | 310–335 | 暫停且核心失效時自動擷取事故。 | `paused dead core automatically captures an incident [8]` |
| `adapters.ts` | 336–347 | ${type} 使快取備援在下一請求失效。 | `${type} invalidates cached fallback on next request [9]` |
| `adapters.ts` | 347–367 | 每分頁原線對照不覆寫已保存的選路設定。 | `per-tab original comparison does not overwrite saved routing settings [10]` |
| `adapters.ts` | 367–389 | 回報計畫標示實際提供給播放器的備援，而非受阻主線。 | `the reported plan names the backup actually offered to the player, not the blocked primary [11]` |
| `adapters.ts` | 390–395 | ${type} 阻擋帶有 PCDN 標記的 Catalog 主機。 | `${type} blocks PCDN-marked Catalog host [12]` |
| `adapters.ts` | 395–424 | 弱查詢字串比對不構成備援能力。 | `weak query match is not a backup capability [13]` |
| `adapters.ts` | 424–450 | 沒有先前健康證據的初始疑似失效起播不算事故。 | `initial dead-looking startup without previous health is not an incident [14]` |
| `adapters.ts` | 450–470 | XHR 不送出預設不可用且帶有 PCDN 標記的媒體。 | `XHR does not send default-unavailable PCDN-marked media [15]` |
| `adapters.ts` | 470–501 | 第一個暫停監控週期即安裝播放觀察器，不等三十秒。 | `play observer installed on first paused tick, not thirty seconds later [16]` |
| `adapters.ts` | 501–522 | 符合資格的 Native 備援使用自身完整簽名 URL。 | `eligible Native backup uses its own full signed URL [17]` |
| `application.ts` | 25–46 | 控制器測試情境具有媒體表示。 | `controller fixture representation exists [1]` |
| `application.ts` | 47–73 | 冷起播在預檢完成前保留合法原始來源。 | `cold startup preserves the legal original until preflight completes [2]` |
| `application.ts` | 73–107 | 大量畫質群組仍進入路線協調器。 | `many quality groups still enter the route coordinator [3]` |
| `application.ts` | 107–114 | 起播停滯測試情境具有媒體表示。 | `startup stall fixture has a representation [4]` |
| `application.ts` | 121–184 | Catalog 主機上的簽名備援以自身精確 Native URL 競爭。 | `Catalog-host signed backup competes as its own exact Native URL [5]` |
| `application.ts` | 184–191 | Catalog 不相容測試情境具有媒體表示。 | `Catalog incompatibility fixture has a representation [6]` |
| `application.ts` | 193–210 | 可以針對此串流檢查 Catalog URL。 | `a Catalog URL can be checked for this stream [7]` |
| `application.ts` | 210–259 | 原線對照模式不探測，也不發起腳本路線或核心恢復。 | `original comparison mode neither probes nor initiates script route/core recovery [8]` |
| `application.ts` | 259–300 | 安全播放考慮最多三個公平挑戰者。 | `safe playback considers up to three fair challengers [9]` |
| `application.ts` | 300–378 | 播放器請求已中止時拒絕起播閘門。 | `already-aborted player request rejects startup gate [10]` |
| `application.ts` | 387–392 | 監控器觀察所選 ${rate}x 倍速。 | `monitor observes selected ${rate}x [11]` |
| `application.ts` | 392–393 | 重複監控永不寫入播放速度。 | `repeated monitoring never writes playback speed [12]` |
| `application.ts` | 403–409 | 適配器使用實際 ${rate}x 倍速估算需求。 | `adapter uses real ${rate}x for demand [13]` |
| `application.ts` | 409–424 | 2x 僅作未知速率時的規劃備用值。 | `2x is only the unknown-rate planning fallback [14]` |
| `application.ts` | 424–435 | 主機鎖定永不還原失效根來源，可以選擇合法替代來源。 | `host-lock never restores a dead root and may choose a legal alternative [15]` |
| `application.ts` | 435–443 | 正常短暫恢復播放清除暫停待命診斷狀態。 | `normal short resume clears pause-armed diagnostic state [16]` |
| `diagnostics.ts` | 11–45 | 1000 次成功仍維持有界彙總。 | `1000 successes remain bounded aggregates [1]` |
| `diagnostics.ts` | 45–95 | 既有緩衝內的播放不能確認備援。 | `old buffered playback does not verify a fallback [2]` |
| `diagnostics.ts` | 95–114 | 新備援取代未確認的舊嘗試。 | `new fallback supersedes unconfirmed old attempt [3]` |
| `diagnostics.ts` | 125–138 | ${invalid.name} 不能確認備援傳輸。 | `${invalid.name} cannot confirm fallback transfer [4]` |
| `diagnostics.ts` | 138–178 | 暫停的播放器不能確認備援播放。 | `paused player cannot confirm fallback playback [5]` |
| `diagnostics.ts` | 178–186 | 過大的當前證據仍遵守報告絕對上限。 | `oversized current evidence still honors the absolute report limit [6]` |
| `domain.ts` | 10–48 | 單一樣本採用 70%。 | `one sample uses 70 percent [1]` |
| `domain.ts` | 48–78 | 冷起播改寫為 Catalog 預設來源。 | `cold start rewrites to catalog default [2]` |
| `measurement-state.ts` | 12–48 | 量測中繼資料預設使用第一個 Catalog 游標。 | `measurement metadata defaults to first Catalog cursor [1]` |
| `native-routing.ts` | 17–95 | 首個群組建立已觀察的 Native 親和主機。 | `first group establishes observed Native affinity [1]` |
| `native-routing.ts` | 95–98 | 僅使用 Catalog 的測試情境私下保留兩個原始 URL 供歸因。 | `Catalog-only fixture retains both original URLs privately for attribution [2]` |
| `native-routing.ts` | 99–142 | 僅使用 Catalog 的起播具有合法候選。 | `Catalog-only startup has legal candidates [3]` |
| `native-routing.ts` | 142–162 | 僅使用 Catalog 時，從播放器輸出移除 B 站不透明簽名音訊。 | `opaque signed B station audio is removed from Catalog-only player output [4]` |
| `native-routing.ts` | 162–164 | 沒有合法 Catalog 候選時不啟動健康探測。 | `no legal Catalog candidate starts no healthy probe [5]` |
| `native-routing.ts` | 164–172 | 沒有合法 Catalog 候選時不輸出播放器主線。 | `no legal Catalog candidate emits no player primary [6]` |
| `native-routing.ts` | 175–197 | 啟用 Native 來源保留冷起播原始路線。 | `enabling Native sources preserves cold-start original route [7]` |
| `native-routing.ts` | 207–223 | Catalog 決策可以產生與原始來源完全相同的 URL。 | `Catalog decision may yield the exact same URL as the original [8]` |
| `native-routing.ts` | 223–299 | 已知備援 403 測試情境具有當前內容週期的媒體表示。 | `known backup 403 fixture has a current-epoch representation [9]` |
| `native-routing.ts` | 299–347 | XHR 重新導向至 Catalog 以外時，使同串流的該 Catalog 主機失效。 | `XHR redirect away from Catalog invalidates that Catalog host for the same stream [10]` |
| `native-routing.ts` | 347–355 | 僅使用 Catalog 的巢狀音訊測試情境接納有效 DASH 影片。 | `Catalog-only nested audio fixture accepts valid DASH video [11]` |
| `native-routing.ts` | 366–392 | Catalog 失敗測試情境登記 ${kind}。 | `Catalog failure fixture registers ${kind} [12]` |
| `native-transport.ts` | 22–138 | 僅使用 Catalog 的送出測試情境安裝 Fetch 與 XHR 攔截。 | `Catalog-only dispatch fixture installs Fetch and XHR hooks [1]` |
| `native-transport.ts` | 138–171 | Fetch 送出時重新檢查舊 Native 播放器備援。 | `old Native player backup is rechecked at Fetch dispatch [2]` |
| `native-transport.ts` | 171–214 | 啟用 Native 的 playurl 測試情境接納主線及四個備援。 | `Native-on playurl fixture accepts primary plus four backups [3]` |
| `native-transport.ts` | 214–279 | 啟用 Native 的輸出上限測試情境接納當前內容週期的另一媒體表示。 | `Native-on output-cap fixture accepts another representation in the current epoch [4]` |
| `native-transport.ts` | 279–303 | 可信 API 接納後，延遲的頁面提示寫入存取器同步收到 Catalog URL。 | `late page-hint setter synchronously receives a Catalog URL after trusted API adoption [5]` |
| `native-transport.ts` | 303–342 | 親和主機測試情境具有另一合法 Catalog 主機。 | `affinity fixture has a different legal Catalog host [6]` |
| `native-transport.ts` | 352–356 | 僅使用 Catalog 時，`__playinfo__` 存取器的讀取存取器清理每個新取得且不支援的 Native 值。 | `Catalog-only __playinfo__ accessor getter sanitizes every fresh unsupported Native value [7]` |
| `native-transport.ts` | 356–359 | 啟用 Native 時，`__playinfo__` 存取器的讀取存取器保留新取得的網站值。 | `Native-on __playinfo__ accessor getter preserves fresh website value [8]` |
| `native-transport.ts` | 402–408 | 僅使用 Catalog 時，XHR ${responseType} 的 playurl 回應無法安全清理，因此在原生送出前阻擋。 | `Catalog-only XHR ${responseType} playurl is blocked before native send because its response cannot  [9]` |
| `native-transport.ts` | 408–485 | 部分 playurl XHR 測試情境仍在載入。 | `partial playurl XHR fixture is still loading [10]` |
| `native-transport.ts` | 485–490 | 啟用 Native 時，XHR ${responseType} 的 playurl 保留網站送出行為。 | `Native-on XHR ${responseType} playurl retains website dispatch [11]` |
| `native-transport.ts` | 490–502 | 停用腳本保留格式錯誤的網站 Fetch playurl 回應。 | `disabled script preserves malformed website Fetch playurl response [12]` |
| `native-transport.ts` | 502–507 | 停用腳本保留網站 XHR ${responseType} 的 playurl 送出行為。 | `disabled script preserves website XHR ${responseType} playurl dispatch [13]` |
| `native-transport.ts` | 519–529 | 僅使用 Catalog 時，Fetch 在原生送出前阻擋已知 B 站 PCDN 後綴 ${suffix}。 | `Catalog-only Fetch blocks known B station PCDN suffix ${suffix} before native dispatch [14]` |
| `native-transport.ts` | 529–554 | 無法歸因的第三方 .m4s Fetch 仍由網站管理。 | `unattributed third-party .m4s Fetch remains website-owned [15]` |
| `native-transport.ts` | 554–560 | 停用腳本保留過大的網站 Fetch 送出行為。 | `disabled script preserves oversized website Fetch dispatch [16]` |
| `orchestration.ts` | 22–79 | Native 開關先使計畫失效，再取消探測及恢復工作。 | `Native switch invalidates plans before cancelling probe and recovery work [1]` |
| `orchestration.ts` | 79–100 | 黑名單命令先持久化，再使路線失效。 | `blacklist command persists before route invalidation [2]` |
| `orchestration.ts` | 100–106 | 停用操作啟動停用世代。 | `disable starts a disabled generation [3]` |
| `playurl-summary.ts` | 11–54 | playurl 摘要初始為空。 | `playurl summary starts empty [1]` |
| `playurl-summary.ts` | 54–65 | 被拒絕的結果物件不能因物件為真值而通過嚴格 Fetch 檢查。 | `a rejected result object cannot truthily pass strict Fetch [2]` |
| `playurl-summary.ts` | 70–81 | 嚴格 XHR ${type} 拒絕未接納的型別化結果。 | `strict XHR ${type} rejects an unaccepted typed result [3]` |
| `playurl-summary.ts` | 81–103 | XHR 回應文字接納型別化的已接納結果。 | `XHR response text accepts a typed accepted result [4]` |
| `playurl-summary.ts` | 103–122 | 啟用 Native 的 XHR 保留被拒絕的上游資料內容。 | `Native-enabled XHR preserves rejected upstream payload [5]` |
| `playurl-summary.ts` | 122–143 | 非有限的診斷計數會正規化。 | `non-finite diagnostic counts are normalized [6]` |
| `playurl-summary.ts` | 143–152 | 診斷報告保留最近 playurl 摘要。 | `diagnostic report retains the recent playurl summary [7]` |
| `progressive-playurl.ts` | 50–67 | 接納 HTTP 200/`code` 0 的 MP4 durl。 | `HTTP 200/code 0 MP4 durl is accepted [1]` |
| `progressive-playurl.ts` | 67–87 | 接納多段 FLV。 | `multi-segment FLV is accepted [2]` |
| `progressive-playurl.ts` | 87–97 | 缺少或重複 order 仍可接納，不合併分段。 | `missing or duplicate order is accepted without merging segments [3]` |
| `progressive-playurl.ts` | 97–118 | 混合 data/result/video_info 中的 DASH 與 durl 一併接納。 | `mixed data/result/video_info DASH and durl are accepted together [4]` |
| `progressive-playurl.ts` | 118–125 | 其餘內容有效且未提供上游 `code` 的資料仍可接納。 | `otherwise valid payload without an upstream code is accepted [5]` |
| `progressive-playurl.ts` | 125–140 | 可選 DASH、Dolby 與 FLAC 音訊為 null 時，不拒絕可播放媒體。 | `optional null DASH, Dolby and FLAC audio do not reject playable media [6]` |
| `progressive-playurl.ts` | 140–148 | 即使 DASH 資料有效，必要 durl 為 null 仍屬格式錯誤。 | `required durl null is malformed even with valid DASH data [7]` |
| `progressive-playurl.ts` | 148–157 | 非零上游 `code` 阻止改寫。 | `nonzero upstream code prevents rewriting [8]` |
| `progressive-playurl.ts` | 157–165 | 拒絕不支援的漸進式格式。 | `unsupported progressive format is rejected [9]` |
| `progressive-playurl.ts` | 165–177 | 中間分段錯誤時拒絕整份混合資料。 | `a bad middle segment rejects the complete mixed payload [10]` |
| `progressive-playurl.ts` | 177–186 | 中間分段無法替換時拒絕整份資料。 | `unreplaceable middle segment rejects the complete payload [11]` |
| `progressive-playurl.ts` | 186–194 | 129 個漸進式群組超出每份資料上限。 | `129 progressive groups exceed the per-payload limit [12]` |
| `progressive-playurl.ts` | 194–203 | 沒有合法 Catalog 路線時拒絕漸進式輸出。 | `no legal Catalog route rejects progressive output [13]` |
| `progressive-playurl.ts` | 203–215 | 同段合法備援提供 Catalog 具體網址產生來源。 | `a legal same-segment backup supplies Catalog materialization [14]` |
| `progressive-playurl.ts` | 215–239 | Native 或原線對照模式接納漸進式資料。 | `Native or original-comparison mode accepts progressive data [15]` |
| `progressive-playurl.ts` | 239–257 | 接納初始漸進式回應。 | `initial progressive response is accepted [16]` |
| `progressive-playurl.ts` | 257–280 | 頁面提示可以暫時登記漸進式分段。 | `page hint can provisionally register a progressive segment [17]` |
| `progressive-playurl.ts` | 280–302 | 接納首個 SPA 漸進式內容。 | `first SPA progressive content is accepted [18]` |
| `progressive-playurl.ts` | 302–315 | 容量測試情境成功填滿既有影片群組。 | `capacity fixture fills existing video groups successfully [19]` |
| `progressive-playurl.ts` | 315–326 | 一併清理漸進式 URL 別名。 | `progressive URL aliases are sanitized together [20]` |
| `progressive-playurl.ts` | 326–336 | 格式錯誤的漸進式備援別名使每個資料分支都被拒絕。 | `malformed progressive backup alias rejects every payload branch [21]` |
| `progressive-playurl.ts` | 336–345 | 第五個原始來源不能超過四來源上限提供 Catalog 授權。 | `fifth raw source cannot supply Catalog authority beyond the four-source limit [22]` |
| `progressive-playurl.ts` | 345–355 | 停用的應用不接納漸進式資料。 | `disabled application does not admit progressive data [23]` |
| `progressive-routing.ts` | 19–38 | 兩個漸進式分段登記為獨立影片媒體表示。 | `two progressive segments register as separate video representations [1]` |
| `progressive-routing.ts` | 38–103 | 宣告根來源不透明時，Catalog 來源解析第一個同段合法備援。 | `Catalog source resolves the first legal same-segment backup when the declared root is opaque [2]` |
| `progressive-routing.ts` | 103–109 | 資源主線具有同段合法備援時可登記。 | `a resource primary with a legal same-segment backup registers [3]` |
| `progressive-routing.ts` | 111–121 | 使用資源主線的精確合法備援來源替換主線。 | `resource primary is replaced using its exact legal backup source [4]` |
| `progressive-routing.ts` | 121–128 | 分頁原線對照保留精確不透明原始來源。 | `tab-local original comparison retains the exact opaque original [5]` |
| `progressive-routing.ts` | 128–157 | 固定 Catalog 變更取消等待中的起播探測。 | `fixed Catalog change cancels a pending startup probe [6]` |
| `progressive-routing.ts` | 157–186 | Catalog 來源識別碼解析當前內容週期的精確 PCDN 來源。 | `Catalog source handle resolves exact current-epoch PCDN source [7]` |
| `progressive-routing.ts` | 186–237 | 量測測試情境具有兩個獨立漸進式分段。 | `measurement fixture has two independent progressive segments [8]` |
| `progressive-routing.ts` | 237–272 | 起播閘門維持有界，期限前仍開啟。 | `startup gate remains bounded but open before its deadline [9]` |
| `progressive-transport.ts` | 16–57 | 成功 MP4 API 經 Fetch 後維持 HTTP 200。 | `successful MP4 API remains HTTP 200 through Fetch [1]` |
| `progressive-transport.ts` | 57–66 | XHR ${responseType} 接納 MP4 durl。 | `XHR ${responseType} accepts MP4 durl [2]` |
| `progressive-transport.ts` | 66–80 | 僅使用 Catalog 的 MP4 Fetch 拒絕重新導向。 | `MP4 Catalog-only Fetch rejects redirects [3]` |
| `state.ts` | 17–46 | 登記簽名路線。 | `signed route registered [1]` |
| `state.ts` | 46–77 | 延遲頁面提示不能取代可信根來源。 | `late page hints cannot replace the trusted root [2]` |
| `state.ts` | 77–110 | 可信 API 在同主機取代已失效的暫時路線。 | `trusted API replaces invalidated provisional route on the same host [3]` |
| `state.ts` | 110–115 | 延遲且信任較低的頁面提示不改寫或合併進可信 API 輸出。 | `late lower-trust page hint does not rewrite or merge into trusted API output [4]` |
| `state.ts` | 115–120 | 已退出提示的延遲預檢結果不能建立健康證據。 | `late preflight result from the retired hint cannot create health evidence [5]` |
| `state.ts` | 120–125 | 已退出提示的延遲挑戰者結果不能建立健康證據。 | `late challenger result from the retired hint cannot create health evidence [6]` |
| `state.ts` | 125–140 | API 接納後，已退出頁面提示的傳輸不懲罰舊主機。 | `retired page-hint transport does not punish its old host after API adoption [7]` |
| `state.ts` | 140–156 | 精確簽名路線對應當前內容週期。 | `exact signed route maps to current epoch [8]` |
| `state.ts` | 156–161 | 不透明識別碼在 Vault 內解析。 | `opaque handle resolves inside vault [9]` |
| `state.ts` | 161–167 | 簽名路線永不跨越世代。 | `signed route never crosses generation [10]` |
| `state.ts` | 167–175 | PCDN Catalog 來源識別碼只解析當前精確簽名 URL。 | `PCDN Catalog source handle resolves only the current exact signed URL [11]` |
| `state.ts` | 175–203 | 限制適用於音訊。 | `restriction applies to audio [12]` |
| `state.ts` | 203–222 | 既有資料結構 2 設定沒有 Native 開關時預設關閉。 | `existing schema 2 settings without Native toggle default off [13]` |
| `state.ts` | 222–265 | 另一分頁收到時間戳在未來的 Native 啟用設定。 | `other tab receives a Native-on setting with a future timestamp [14]` |
| `state.ts` | 265–317 | 啟用 Native 的頁面提示初始保留原始 URL。 | `Native-on page hint initially preserves its original URL [15]` |
| `state.ts` | 317–347 | 即使 responseKey 已看過，同一物件的可信資料被修改後仍重新清理。 | `mutated same-object trusted payload is re-sanitized despite an already-seen responseKey [16]` |

工具的新增契約與實際驗證結果見 [測試工具驗證紀錄](../docs/TEST_TOOLING_REPORT.md)；命令與清理規則見 [開發流程](../docs/DEVELOPMENT.md#test-suites-and-isolation)。
