# Node 內建測試遷移對照

基準為本次修改前的 v2.1.8 工作樹（修改前保存；正式來源未變）。遷移前以保存的套件及支援工具重跑，15 個套件共 891 項功能斷言；另有 18 項架構規則期待。Node 案例數表示具名情境，不等於舊斷言數。

同情境的多項期待保留在同一案例；參數案例名稱帶有輸入及序號。factory 每次重建設定、store、Vault、控制器與 Hook，較早的必要狀態轉換僅作該情境的前置設定，較早的期待由各自案例檢查。獨立 MP4／FLV fixture 直接於各案例建立。原比較保留字串、JSON、物件身分及 strictEqual（Object.is）語意。

唯一有意替換的舊時間期待為 application 的三秒牆鐘上限，改為注入 FakeClock，確認 2,999 ms 未完成與 3,000 ms 完成。原參數輸入與其他斷言訊息保持。共用 helper 中的斷言仍由呼叫它的情境驗證。

## 套件基準

| 套件 | 原功能斷言 | 原斷言呼叫位置 |
| --- | ---: | ---: |
| domain-boundaries.ts | 20 | 20 |
| adapter-boundaries.ts | 24 | 19 |
| adapters.ts | 128 | 124 |
| application.ts | 99 | 86 |
| diagnostics.ts | 48 | 40 |
| domain.ts | 19 | 19 |
| measurement-state.ts | 8 | 8 |
| native-routing.ts | 77 | 71 |
| native-transport.ts | 106 | 80 |
| orchestration.ts | 18 | 18 |
| playurl-summary.ts | 49 | 44 |
| progressive-playurl.ts | 139 | 112 |
| progressive-routing.ts | 58 | 58 |
| progressive-transport.ts | 15 | 12 |
| state.ts | 83 | 83 |

## 原行為群組與具名案例

下表的行號指搬移前檔案；保留相同的套件路徑。參數列的名稱會再加實際輸入，各分支與矩陣沿用原測試。

| 套件 | 原行號 | 新案例群組 |
| --- | --- | --- |
| domain-boundaries.ts | 6–19 | domain suite has no browser location [1] |
| domain-boundaries.ts | 19–30 | blacklist takes priority over other restrictions [2] |
| domain-boundaries.ts | 30–33 | Catalog backup preferences retain stable first occurrence [3] |
| adapter-boundaries.ts | 7–23 | probe caps consumed bytes at its declared limit [1] |
| adapter-boundaries.ts | 23–28 | probe rejects status/response authority: ${status}, ${target}, ${redirected} [2] |
| adapter-boundaries.ts | 28–71 | already cancelled probe does not start network work [3] |
| adapter-boundaries.ts | 71–79 | navigation observes history and popstate [4] |
| adapters.ts | 25–111 | Fetch and XHR hook assignments are verified [1] |
| adapters.ts | 111–161 | disabled mode passes site fetch through [2] |
| adapters.ts | 161–186 | rewritten Request preserves request headers [3] |
| adapters.ts | 186–214 | blacklisted non-GET Fetch never reaches native fetch [4] |
| adapters.ts | 214–244 | init.method override is preserved for native Fetch [5] |
| adapters.ts | 244–289 | forbidden original cannot remain in playurl primary or backup [6] |
| adapters.ts | 289–310 | opaque signed output remains observation-only [7] |
| adapters.ts | 310–335 | paused dead core automatically captures an incident [8] |
| adapters.ts | 336–347 | ${type} invalidates cached fallback on next request [9] |
| adapters.ts | 347–367 | per-tab original comparison does not overwrite saved routing settings [10] |
| adapters.ts | 367–389 | the reported plan names the backup actually offered to the player, not the blocked primary [11] |
| adapters.ts | 390–395 | ${type} blocks PCDN-marked Catalog host [12] |
| adapters.ts | 395–424 | weak query match is not a backup capability [13] |
| adapters.ts | 424–450 | initial dead-looking startup without previous health is not an incident [14] |
| adapters.ts | 450–470 | XHR does not send default-unavailable PCDN-marked media [15] |
| adapters.ts | 470–501 | play observer installed on first paused tick, not thirty seconds later [16] |
| adapters.ts | 501–522 | eligible Native backup uses its own full signed URL [17] |
| application.ts | 25–46 | controller fixture representation exists [1] |
| application.ts | 47–73 | cold startup preserves the legal original until preflight completes [2] |
| application.ts | 73–107 | many quality groups still enter the route coordinator [3] |
| application.ts | 107–114 | startup stall fixture has a representation [4] |
| application.ts | 121–184 | Catalog-host signed backup competes as its own exact Native URL [5] |
| application.ts | 184–191 | Catalog incompatibility fixture has a representation [6] |
| application.ts | 193–210 | a Catalog URL can be checked for this stream [7] |
| application.ts | 210–259 | original comparison mode neither probes nor initiates script route/core recovery [8] |
| application.ts | 259–300 | safe playback considers up to three fair challengers [9] |
| application.ts | 300–378 | already-aborted player request rejects startup gate [10] |
| application.ts | 387–392 | monitor observes selected ${rate}x [11] |
| application.ts | 392–393 | repeated monitoring never writes playback speed [12] |
| application.ts | 403–409 | adapter uses real ${rate}x for demand [13] |
| application.ts | 409–424 | 2x is only the unknown-rate planning fallback [14] |
| application.ts | 424–435 | host-lock never restores a dead root and may choose a legal alternative [15] |
| application.ts | 435–443 | normal short resume clears pause-armed diagnostic state [16] |
| diagnostics.ts | 11–45 | 1000 successes remain bounded aggregates [1] |
| diagnostics.ts | 45–95 | old buffered playback does not verify a fallback [2] |
| diagnostics.ts | 95–114 | new fallback supersedes unconfirmed old attempt [3] |
| diagnostics.ts | 125–138 | ${invalid.name} cannot confirm fallback transfer [4] |
| diagnostics.ts | 138–178 | paused player cannot confirm fallback playback [5] |
| diagnostics.ts | 178–186 | oversized current evidence still honors the absolute report limit [6] |
| domain.ts | 10–48 | one sample uses 70 percent [1] |
| domain.ts | 48–78 | cold start rewrites to catalog default [2] |
| measurement-state.ts | 12–48 | measurement metadata defaults to first Catalog cursor [1] |
| native-routing.ts | 17–95 | first group establishes observed Native affinity [1] |
| native-routing.ts | 95–98 | Catalog-only fixture retains both original URLs privately for attribution [2] |
| native-routing.ts | 99–142 | Catalog-only startup has legal candidates [3] |
| native-routing.ts | 142–162 | opaque signed B station audio is removed from Catalog-only player output [4] |
| native-routing.ts | 162–164 | no legal Catalog candidate starts no healthy probe [5] |
| native-routing.ts | 164–172 | no legal Catalog candidate emits no player primary [6] |
| native-routing.ts | 175–197 | enabling Native sources preserves cold-start original route [7] |
| native-routing.ts | 207–223 | Catalog decision may yield the exact same URL as the original [8] |
| native-routing.ts | 223–299 | known backup 403 fixture has a current-epoch representation [9] |
| native-routing.ts | 299–347 | XHR redirect away from Catalog invalidates that Catalog host for the same stream [10] |
| native-routing.ts | 347–355 | Catalog-only nested audio fixture accepts valid DASH video [11] |
| native-routing.ts | 366–392 | Catalog failure fixture registers ${kind} [12] |
| native-transport.ts | 22–138 | Catalog-only dispatch fixture installs Fetch and XHR hooks [1] |
| native-transport.ts | 138–171 | old Native player backup is rechecked at Fetch dispatch [2] |
| native-transport.ts | 171–214 | Native-on playurl fixture accepts primary plus four backups [3] |
| native-transport.ts | 214–279 | Native-on output-cap fixture accepts another representation in the current epoch [4] |
| native-transport.ts | 279–303 | late page-hint setter synchronously receives a Catalog URL after trusted API adoption [5] |
| native-transport.ts | 303–342 | affinity fixture has a different legal Catalog host [6] |
| native-transport.ts | 352–356 | Catalog-only __playinfo__ accessor getter sanitizes every fresh unsupported Native value [7] |
| native-transport.ts | 356–359 | Native-on __playinfo__ accessor getter preserves fresh website value [8] |
| native-transport.ts | 402–408 | Catalog-only XHR ${responseType} playurl is blocked before native send because its response cannot  [9] |
| native-transport.ts | 408–485 | partial playurl XHR fixture is still loading [10] |
| native-transport.ts | 485–490 | Native-on XHR ${responseType} playurl retains website dispatch [11] |
| native-transport.ts | 490–502 | disabled script preserves malformed website Fetch playurl response [12] |
| native-transport.ts | 502–507 | disabled script preserves website XHR ${responseType} playurl dispatch [13] |
| native-transport.ts | 519–529 | Catalog-only Fetch blocks known B station PCDN suffix ${suffix} before native dispatch [14] |
| native-transport.ts | 529–554 | unattributed third-party .m4s Fetch remains website-owned [15] |
| native-transport.ts | 554–560 | disabled script preserves oversized website Fetch dispatch [16] |
| orchestration.ts | 22–79 | Native switch invalidates plans before cancelling probe and recovery work [1] |
| orchestration.ts | 79–100 | blacklist command persists before route invalidation [2] |
| orchestration.ts | 100–106 | disable starts a disabled generation [3] |
| playurl-summary.ts | 11–54 | playurl summary starts empty [1] |
| playurl-summary.ts | 54–65 | a rejected result object cannot truthily pass strict Fetch [2] |
| playurl-summary.ts | 70–81 | strict XHR ${type} rejects an unaccepted typed result [3] |
| playurl-summary.ts | 81–103 | XHR response text accepts a typed accepted result [4] |
| playurl-summary.ts | 103–122 | Native-enabled XHR preserves rejected upstream payload [5] |
| playurl-summary.ts | 122–143 | non-finite diagnostic counts are normalized [6] |
| playurl-summary.ts | 143–152 | diagnostic report retains the recent playurl summary [7] |
| progressive-playurl.ts | 50–67 | HTTP 200/code 0 MP4 durl is accepted [1] |
| progressive-playurl.ts | 67–87 | multi-segment FLV is accepted [2] |
| progressive-playurl.ts | 87–97 | missing or duplicate order is accepted without merging segments [3] |
| progressive-playurl.ts | 97–118 | mixed data/result/video_info DASH and durl are accepted together [4] |
| progressive-playurl.ts | 118–125 | otherwise valid payload without an upstream code is accepted [5] |
| progressive-playurl.ts | 125–140 | optional null DASH, Dolby and FLAC audio do not reject playable media [6] |
| progressive-playurl.ts | 140–148 | required durl null is malformed even with valid DASH data [7] |
| progressive-playurl.ts | 148–157 | nonzero upstream code prevents rewriting [8] |
| progressive-playurl.ts | 157–165 | unsupported progressive format is rejected [9] |
| progressive-playurl.ts | 165–177 | a bad middle segment rejects the complete mixed payload [10] |
| progressive-playurl.ts | 177–186 | unreplaceable middle segment rejects the complete payload [11] |
| progressive-playurl.ts | 186–194 | 129 progressive groups exceed the per-payload limit [12] |
| progressive-playurl.ts | 194–203 | no legal Catalog route rejects progressive output [13] |
| progressive-playurl.ts | 203–215 | a legal same-segment backup supplies Catalog materialization [14] |
| progressive-playurl.ts | 215–239 | Native or original-comparison mode accepts progressive data [15] |
| progressive-playurl.ts | 239–257 | initial progressive response is accepted [16] |
| progressive-playurl.ts | 257–280 | page hint can provisionally register a progressive segment [17] |
| progressive-playurl.ts | 280–302 | first SPA progressive content is accepted [18] |
| progressive-playurl.ts | 302–315 | capacity fixture fills existing video groups successfully [19] |
| progressive-playurl.ts | 315–326 | progressive URL aliases are sanitized together [20] |
| progressive-playurl.ts | 326–336 | malformed progressive backup alias rejects every payload branch [21] |
| progressive-playurl.ts | 336–345 | fifth raw source cannot supply Catalog authority beyond the four-source limit [22] |
| progressive-playurl.ts | 345–355 | disabled application does not admit progressive data [23] |
| progressive-routing.ts | 19–38 | two progressive segments register as separate video representations [1] |
| progressive-routing.ts | 38–103 | Catalog source resolves the first legal same-segment backup when the declared root is opaque [2] |
| progressive-routing.ts | 103–109 | a resource primary with a legal same-segment backup registers [3] |
| progressive-routing.ts | 111–121 | resource primary is replaced using its exact legal backup source [4] |
| progressive-routing.ts | 121–128 | tab-local original comparison retains the exact opaque original [5] |
| progressive-routing.ts | 128–157 | fixed Catalog change cancels a pending startup probe [6] |
| progressive-routing.ts | 157–186 | Catalog source handle resolves exact current-epoch PCDN source [7] |
| progressive-routing.ts | 186–237 | measurement fixture has two independent progressive segments [8] |
| progressive-routing.ts | 237–272 | startup gate remains bounded but open before its deadline [9] |
| progressive-transport.ts | 16–57 | successful MP4 API remains HTTP 200 through Fetch [1] |
| progressive-transport.ts | 57–66 | XHR ${responseType} accepts MP4 durl [2] |
| progressive-transport.ts | 66–80 | MP4 Catalog-only Fetch rejects redirects [3] |
| state.ts | 17–46 | signed route registered [1] |
| state.ts | 46–77 | late page hints cannot replace the trusted root [2] |
| state.ts | 77–110 | trusted API replaces invalidated provisional route on the same host [3] |
| state.ts | 110–115 | late lower-trust page hint does not rewrite or merge into trusted API output [4] |
| state.ts | 115–120 | late preflight result from the retired hint cannot create health evidence [5] |
| state.ts | 120–125 | late challenger result from the retired hint cannot create health evidence [6] |
| state.ts | 125–140 | retired page-hint transport does not punish its old host after API adoption [7] |
| state.ts | 140–156 | exact signed route maps to current epoch [8] |
| state.ts | 156–161 | opaque handle resolves inside vault [9] |
| state.ts | 161–167 | signed route never crosses generation [10] |
| state.ts | 167–175 | PCDN Catalog source handle resolves only the current exact signed URL [11] |
| state.ts | 175–203 | restriction applies to audio [12] |
| state.ts | 203–222 | existing schema 2 settings without Native toggle default off [13] |
| state.ts | 222–265 | other tab receives a Native-on setting with a future timestamp [14] |
| state.ts | 265–317 | Native-on page hint initially preserves its original URL [15] |
| state.ts | 317–347 | mutated same-object trusted payload is re-sanitized despite an already-seen responseKey [16] |

工具的新增契約與實際驗證結果見 [測試工具驗證紀錄](../docs/TEST_TOOLING_REPORT.md)；命令與清理規則見 [開發流程](../docs/DEVELOPMENT.md#test-suites-and-isolation)。
