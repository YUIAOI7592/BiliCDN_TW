# BiliCDN_TW v2 專案脈絡

本文件保存現行產品契約；來源為 `src-v2/`，入口 `src-v2/entry.ts`，正式測試 `tests-v2/`。版本由 [release.json](../release.json) 決定。歷史修復見 [HISTORY](HISTORY.md)，已取得證據見 [TEST_REPORT](TEST_REPORT.md)，目前工作只看 [TODO](TODO.md)。

## 現行產品

面向台灣網路環境的 Bilibili Tampermonkey 腳本，提供合法 CDN 選路、有界主動量測、有限核心恢復及本機診斷。支援 DASH 與已辨識的 MP4／FLV 分段資料。產品不控制網站 Worker，不加入執行期第三方依賴或遠端程式載入。

**Auto 畫質是主要使用場景。** 畫質及 ABR 由網站決定，正常表示／解析度下降不是缺陷。使用者倍速保持，量測依倍速估算需求。影片格式偏好預設 AV1，可選 HEVC、AVC 或由網站決定；新偏好在後續播放資料生效。

預設設定與操作名稱見 [README](../README.md#預設設定)。使用者勾選或固定主機不能解除黑名單、故障或其他禁止規則；單節點設定在鎖內合併，過期視圖回呼不能重新開窗或搶焦點。

控制中心以當前封閉 ShadowRoot 的冒泡邊界隔離可信 keydown／keypress／keyup，讓 Enter／Space 及表單維持原生預設操作；Escape 關閉。關閉與宿主重建會清理監聽器。不新增焦點循環，亦無法撤銷外層捕捉階段已做的取消。

## 選路與量測

| 模式 | 路線 | 主動工作 |
| --- | --- | --- |
| 正常／Native 關閉 | 合法 Catalog 主線與最多 5 個不同主機的備援 | 按資格量測、備援及恢復 |
| 正常／Native 開啟 | Catalog 及當前內容的合法精確 Native 來源 | 同樣受限制與授權檢查 |
| 分頁原線對照 | 當片合法原始／備用簽名路線 | 不主動探測、換主機或重建核心 |
| 整體停用 | 網站原請求 | 停止腳本改寫與主動工作，不取消已送出請求 |

停用優先於對照與正常模式。原生來源開關是持久設定；原線對照只屬本分頁，完整重載不保留，也不能倒回已交給播放器的 URL。

每分頁首次合資格媒體請求共用一次起播 gate：最多 3 個並行候選、共用 3 秒期限，MP4／FLV 分段不各開預算。同步 XHR 及明確 timeout 的 XHR 不等待 gate。探測沒有贏家時，仍從完整合法候選池排名；不能因此放行未授權 Native。

首個合法起播窗口開始時立即消耗每分頁預算，後來的 Fetch／XHR 先加入共用 pending，再檢查已用預算；epoch／generation／設定 reset 不重開預算，沒有合法候選不消耗。健康量測的 planning／running 以各輪所有權在 finally 清理；probe、儲存鎖或寫入拒絕以固定 measurement-error 收束，遵守 10 分鐘冷卻，不輸出例外內容、不新增立即重試。`EvidenceStore` 只在寫入成功後發布記憶體成功樣本；舊完成或拒絕不能清除新輪次。

健康播放時須真正前景、穩定進度、足夠緩衝且不在 seeking／recovering；共用跨分頁冷卻，每 10 分鐘最多依序量測 3 個候選。取得鎖後重新檢查資格、表示及控制器標記，通過才消耗候選嘗試／游標／冷卻。健康探索只更新證據，不變更流暢播放的親和主機。主動探測拒絕轉址，只接受符合限制的直接同主機 HTTPS 206。

合法固定主機優先於健康親和。每筆傳輸保存路線政策修訂，設定／對照失效後的舊結果可按原資格保留歷史證據，但不能改寫親和、當前表示、來源授權或觸發恢復；儲存等待前後均檢查。影片、音訊的證據及恢復隔離，audio 備援不能建立 video 核心意圖。

## Auto 救援與操作所有權

### 長暫停後的可信播放意圖

長暫停後，網站核心可能忽略播放按鈕而不呼叫 SDK play。`PlayerAdapter` 同時觀察現有 SDK 方法及目前播放器區域的可信 `.bpx-player-ctrl-play` click；僅同一 paused 媒體、播放器、內容週期、真正可見且非 ended/error 才通知既有意圖。讀取前後核對控制／使用者修訂與清理狀態，事件與 DOM 不傳入應用層。

`RecoveryController` 保留暫停至少 30 秒、拖曳／路線授權／政策／操作所有權／額度檢查；死核心 4 秒、其他無進度 30 秒與重載後 15 秒期限維持。正常進度不多做重載，沒有新操作不替暫停影片自行播放。訂閱、包裝及釋放權責見 [架構](ARCHITECTURE.md#應用控制器)。

### 一般停滯與操作所有權

一般非尋位停滯使用 **6／12／15 秒**，長 seek／可信尋位未完成使用 **15／30／15 秒**，由一秒監控 tick 推進。前兩個時點都從同一停滯起點計算：

| 情境 | 合法 video 備援 | 仍無進度時重載 | 重載後終止期限 |
| --- | --- | --- | --- |
| 一般非尋位停滯 | 6 秒 | 12 秒 | 再 15 秒 |
| 長 seek／可信目標未完成 | 15 秒 | 30 秒 | 再 15 秒 |

一般段遇 seeking 或未完成可信目標即升為長 seek，保留原起點，同段不降級。先到的合法 video 傳輸備援與同段 token 合併，不新增備援或重開計時；既有死核心 4 秒仍優先保留。理想排程下，一般故障無進度終止由 45 秒縮至 27 秒；實際動作受一秒 tick 排程影響，這不是對真實誤介入率的量測。

沒有合法路線或必要身分時明確退出，不繞過限制，不建立虛假健康樣本。每段一次重載並沿用整體額度與 90 秒 breaker。原死核心、可信長暫停播放意圖及一次性冷起播保留自己的觸發規則，不因本方案重開 gate 預算。

首次採樣、seek 跳躍、保留尺寸或緩衝增加不是播放進度。合格採樣須非 seeking／paused／ended／mediaError，影片時間前進超過 0.05 秒；有影格計數時也須新增影格。第一個有效進度停止無進度計時，兩個連續有效採樣才 recovered。

新使用者操作撤銷舊還原；新 seek 用最新目標重新建立停滯段。網站／Auto 的目標或表示變化會撤銷過期動作並重新綁定當前 video，但保留原停滯起點與已用額度。暫停、真正 hidden、ended、mediaError、停用、對照及生命週期失效依契約結束舊段，不能累計背景時間。

可信 seek keydown／keyup 各自在同一派送內確認實際有限新目標才取得一次 userRevision，包含位置 0；BODY／頁面焦點有效，editable、控制中心、IME、Ctrl／Meta／Alt、合成事件、忽略命令及派送後工作無效。pendingSeek／internalSeek 保留腳本來源抑制。HAVE_NOTHING 的可信新目標另須捕捉核心不變、非 internalReload；未知目標只更新 seekRevision、撤銷舊還原，不猜成使用者命令。

可信進度按下立即建立由 pointerId、播放器、媒體及內容擁有的手勢，不要求當下 seeking 或位置改變。有效 dragging 同時排除停滯、watchdog、冷起播救援及新 Recovery token；同指標可信釋放／cancel／lost capture 或真正 window 失焦／hidden／生命週期失效才清理。子元素 blur 經 window 捕捉不等於視窗失焦，不清可信目標或手勢。一般停滯在釋放後第一個合資格 tick 從最新目標建立新期限；尚無播放進度的冷起播仍按原 firstMediaAt，可能立即救援，不新增全域釋放寬限。

### BR-01 自有 SDK 重載後續恢復契約

合法 stall token 的自有 reload 可在有界 15 秒所有權內跨過 SDK 暫時 pause／空核心，最多接納第一個相符替換核心；舊核心回來、第二次替換、新使用者操作、真正 hidden 或失效撤銷。這是頁面因果觀察，不保證認證所有未經可觀察方法的外部替換。

沒有有效目標證明的路徑，SDK 自行 seek 仍撤銷舊位置還原；其餘合法倍速與播放意圖受最新授權、期限及 token 限制。每個 reload／seek／setRate／play 前與 Promise 提交時重查所有權。首次進度後可在同一穩定所有者下有界確認連續進度，不延長 pause／空核心資格、不授予新副作用。failed／breaker 不因尺寸或 readyState 清除；終止後 SDK 自行 resume 不能反覆重開救援。

PlayerControlObserver 唯一保存可信、未完成的尋位目標，與觀察用 targetSec 分開。鍵盤須在同一可信派送內確認實際有限目標；指標須在目前進度手勢內觀察實際目標，真正零有效。失效時同一所有者由非零 readyState 跌至 0 的歸零可保留目標；未知位置、媒體／內容／核心替換、新操作及控制失效保守撤銷。可信播放按鈕／播放鍵可交接同一 paused 目標，不能靠修訂數相同猜測來源。

Recovery 透過必要的 captureResumePosition／validateResumePosition 內部契約捕獲位置與不透明證明，保存前後及每個副作用前重查。沒有可信目標時，未初始化 video 的有限原生 currentTime（包含 0）仍優先於 SDK 快取，其他狀態維持原回退。目標附近的非 seeking 基準與兩個合格進度樣本才完成目標；後續新意圖使用目前位置。原生讀取例外僅回退該次讀取，不宣稱全部頁面 getter 例外安全。

有有效目標證明時，本次自有 reload 內或首個相符替換核心尚無穩定播放基準前的第一個 SDK seek 可標記為初始化候選；等待 seeking 結束才依序還原 seek／rate／play。第二個 seek／替換、新操作或 15 秒到期撤銷，沒有證明仍維持原取消政策。目標與重載狀態都只留記憶體，不新增設定或持久欄位。

## 內容、格式與授權

cid 只從已辨識 playurl **所屬請求 URL** 取得：唯一、最多 20 位十進位字串，移除前導零；全零、重複、空白、負數、小數或超長視為缺失。Fetch 在等待前保存，XHR metadata 隨 failed open 回復與重入所有權移交。不讀頁面／播放器／payload 猜 cid；cid 只關聯內容，不提供路線授權。

前後有效 cid 相同便保持 epoch，即使整批畫質／編碼／目錄改變；不同便換片。任一側缺失時，用所有合法 primary 的完整父目錄集合備援：忽略主機、查詢及排列，有影片只比影片，純音訊才比音訊，交集沿用並合併。非空無交集或型態改變則保守重設；無 cid 且無有效目錄不更新基準。上限 video 128／audio 64，本次優先、舊項固定排序補入，不因淘汰單獨增加 epoch。

只有 trusted-api 更新內容基準；page-hint／player-MPD 不擴充、不改 cid、不觸發換片。generation 改變清空基準；真正換片依 **Session→Vault→Routes 重設→同步通知 Runtime→登記新表示** 撤銷舊監控、量測、恢復與播放器快取，不重開每分頁起播預算。沒有有效 cid 又無共同路徑時採保守重設，不新增同世代 API 逆序政策。

### 來源更新與傳輸

Vault 是唯一 Native 授權來源。可信提升撤銷較低信任 handle；無法辨識的精確路線只能作觀察／限制，不能主動探測或 Native 選路。可信 MP4／FLV 來源在正規化、去重及容量限制後以集合比較；相同集合更新 primary／順序但保留 handles／aliases／authority，真正新增、移除、換簽名或可信提升仍撤銷舊 handles／aliases 並旋轉授權。無合法新來源拒絕輸出，不重用舊簽名。DASH 保留既有查詢行為。

內部原線決策區分原樣通行與 Vault 選中的原線；後者以當前身分與不透明 handle 解析精確 URL，重查政策／禁止規則。同一選定主機上的 DASH 請求保留當次查詢字串。

Fetch 只正規化輸入一次、單一讀取器，等待與串流取消保留 signal.reason 原值及物件身分。XHR failed open 保留原請求 metadata；同步回呼重入不得污染新請求。waiting／native sent／terminal 分開，gate abort 阻止晚送；內部最多兩次 native open，每次還原後重查所有權、原生 OPENED 及最新政策。等待 continuation 失敗須單次終止；未延後 send 保留同步拋錯，已送出請求不重送。text／json、getter 例外、timeout、credentials、headers 與同步 setter 限制維持原生語意。

### MP4／FLV 與混合格式

辨識容器內的必要分段先全部規劃，再寫回主備 URL；保留原順序、時長、大小，分支／索引參與身分，order 重複不合併。必要分段無合法主線時拒絕整份已辨識資料，不部分放行。這是 payload 寫回原子性，不表示 Vault 登記可回滾。嚴格失敗時 Fetch 使用 503；XHR 提供安全失敗 body 並保留原 HTTP 狀態。PCDN 可在安全換主機後供 Catalog 生成，不因此取得 Native 授權。

## 產品不變量

- `RouteCoordinator` 唯一變更親和；`MeasurementController` 唯一啟動探測；`RecoveryController` 唯一重載核心；Runtime 負責協調。
- 等待、鎖取得及提交前依工作重查 generation、epoch、表示、路線政策、授權、操作／核心所有權。
- 禁止規則涵蓋原始、Native、Catalog、固定及備援路線；停用不取消網站已開始請求。
- schema 2 與四個 GM 鍵保持；request／startup／challenge ID 用執行環境隨機前綴、工作建立時分配、重報沿用，最多 64 字元。
- settings／restrictions／evidence 依解析器、鎖及遠端監聽更新；meta 按需讀取、由量測控制器鎖住計畫更新，保留既有較寬轉換語意。沒有 Web Locks 時不保證跨分頁序列化。
- 簽名 URL、路徑、cid、查詢、權杖、Cookie、IP、播放器／核心物件不持久化或輸出；診斷只消費型別化事件，讀取無選路／網路副作用。
- 網站前景偽裝與真正可見性分離；背景可播放，不代表允許背景救援。詳見 [可見性架構](ARCHITECTURE.md#網站前景偽裝與內部可見性)。

## 交付規則

強制流程與授權界線見 [AGENTS](../AGENTS.md)，操作流程見 [DEVELOPMENT](DEVELOPMENT.md)，瀏覽器方法見 [IAB_TESTING](IAB_TESTING.md)。目前工作與停止／結案決策只看 [TODO](TODO.md)，版本驗收見 [TEST_REPORT](TEST_REPORT.md)。產品契約不構成開啟新調查或驗收的授權。

## 診斷

### 播放進度

診斷同一次嘗試只有首次有效回應初始化播放進度基準；後續同身分及同路線成功不撤回 playback-observed／首次 playbackAt，也不延長 30 秒觀察期限。混合主機、seek、生命週期及新嘗試仍按原契約中斷。

### 報告複製

診斷複製在可信 click 內立即呼叫原生 Clipboard API，保留 receiver 與當次完整文字；API 不可取得時才呼叫一次 GM 純文字備援。原生拋錯／拒絕不自動改走 GM。單一 `ControlCenter` 的 pending 寫入跨關閉／重開仍有效，提示與按鈕只更新原宿主／ShadowRoot／視圖；不重新產生報告、不搶焦點、不新增剪貼簿讀取。GM 返回只提示交由管理器處理，不宣告複製成功。

原生 Promise 完成不取代完整讀回驗收；例外只顯示固定失敗提示，不輸出內容或錯誤細節。相關版本證據由 [HISTORY](HISTORY.md) 追溯。
