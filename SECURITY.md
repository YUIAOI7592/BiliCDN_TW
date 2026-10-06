<a name="trust-boundaries-and-data-handling"></a>

# 信任邊界與資料處理

本文件是 `src-v2/` 現行 v2.1.8（含 MP4／FLV 修正）的執行期信任邊界指南。文件用途與歷史紀錄見 [文件索引](docs/INDEX.md)；各版自動驗證、安全審閱及瀏覽器證據見 [驗證報告](docs/TEST_REPORT.md)。本文件本身不要求啟動安全掃描。

<a name="untrusted-inputs"></a>

## 不可信輸入

頁面 JavaScript、`__playinfo__`、播放器 manifest、playurl payload、媒體 URL、回應標頭、console 輸出及合成 DOM 事件都不可信。

- 選路前由 `domain/url-policy.ts` 解析並接納 URL。
- `SignedRouteVault` 擁有簽名路線索引、不透明 handle 及當前原生簽名路線（Native）選路授權。適配器及執行路徑也會在記憶體中處理 URL 與 payload；`PlayerAdapter` 在取代／重設前保存序列化的 manifest fingerprint，XHR 保存每筆請求的 URL 狀態。這些資料不得進入持久學習資料或診斷輸出，也不得成為另一份 Native 授權索引。
- 可信 playurl API 的 representation 會取代較低信任的頁面及播放器提示所授予的 Native 資格；已撤銷的 handle 不得啟動主動探測或建立新的健康證據。
- 未知外部 Host 必須先有自然發生、可歸因的成功傳輸才可取得證據；不得預先主動探測。
- 控制中心在封閉 Shadow DOM 內執行，操作必須來自可信使用者事件。

已辨識的 MP4／FLV `durl` 分段及 DASH alias 仍是不可信 payload。漸進式／混合格式輸出先完成規劃才寫回 URL；必要分段若沒有合法主線，不得丟棄該段或輸出部分改寫的成功結果。這是 payload 寫回的原子性，不保證回滾 Vault／控制器登記。型別化 playurl 結果的 `accepted` 必須由每個消費端檢查。嚴格模式下，Fetch 拒絕的 playurl 使用 HTTP 503；XHR 提供安全失敗內容，保留原生 HTTP 狀態。

內建節點清單（Catalog）的來源 handle 表示當前分段已接納、可用於產生內建目標的 URL。改用同段的安全備用來源時，必須保留 exact path／query 關聯及當前授權檢查。此能力不授予新的 Native 選路權限；不得因另一來源能產生 Catalog 輸出，就把不安全或不可改寫的原線直接放行。

Vault 可以保存可改寫的 PCDN URL，僅在換 Host 後成為正常內建目標時供 Catalog 產生使用；它仍不可選為 Native。漸進式輸出使用同段的標準來源；同 representation 的安全 DASH exact／Catalog alias 請求保留當前 query。兩者都不得放寬最終目標限制。

<a name="persistent-data"></a>

## 持久資料

產品使用四個持久鍵：`bilicdn.v2.settings`、`bilicdn.v2.restrictions`、`bilicdn.v2.routeEvidence` 及 `bilicdn.v2.meta`。

`SettingsStore`、`RestrictionStore` 及 `EvidenceStore` 依 parser 實作的限制重建已知欄位；Tampermonkey API 可用時訂閱值變更。設定寫入與限制／證據修改使用各自儲存鎖。集合及樣本上限不能推論為每個原始外層欄位都有有限上界。

`MeasurementMetaStore` 按需重新讀取物件，轉換游標／冷卻欄位，更新時保留既有原始欄位；沒有值變更 listener，也沒有完整 schema 或有限上界驗證。量測控制器在規劃寫入時使用它的 `measurement` 鎖；`get`、`update`、`clear` 不自行取得鎖。見 [measurement-meta-store.ts](src-v2/state/measurement-meta-store.ts)。

Chrome Web Locks 可用時使用鎖，否則 storage port 直接執行工作，沒有跨分頁序列化。Tampermonkey listener API 不可用時也有替代路徑。同步能力取決於平台 API 是否可用。

產品自有持久資料為設定、限制、Host 證據及量測游標／時間 metadata。不得新增持久化的 signed URL、path、query、token、播放器物件、representation 狀態或事故時間線。metadata 的原始欄位合併不提供通用儲存清理能力。

<a name="network-authority"></a>

## 網路權限

- 適配器正規化外部觀察；只有 application 控制器可以發起選路、量測或恢復。
- 僅 `MeasurementController` 可以啟動主動探測。
- 僅 `RouteCoordinator` 可以變更 affinity（目前路線綁定）或提交備援。
- 僅 `RecoveryController` 可以重載播放器核心。
- 診斷消費型別化事件，不得施加懲罰或控制播放。
- 啟用時，Fetch 檢查的 Request 與原生 API 送出的 Request 是同一個平台正規化物件。主動探測拒絕轉址，只接納受檢 Host 的直接 Range 回應。
- 正常選路預設使用生成的內建 Catalog 路線。開啟原生來源參考後，僅接納合法且符合當前身分的 exact 路線；分頁原線對照獨立運作。整體停用會原樣放行網站請求，停止腳本主動量測／恢復。
- `trusted-api` 來源標籤依辨識出的 playurl 請求端點決定，不是密碼學來源保證，也不證明最終回應來源。仍須保留授權提升及已撤銷 handle 的檢查。
- Catalog-only 媒體 Fetch 使用 `redirect: 'error'`。XHR 無法事先阻止轉址；觀察到非 Catalog 最終 Host 時，不確認為 Catalog 路線。未經已安裝 Fetch／XHR hook 的請求及已送出的網站請求不在攔截範圍內；實際目的地須由 Chrome Network 證據確認。

候選清單保留全部 11 個 Catalog Host，其中 4 個預設不可用。起播預算為每分頁一次、最多 3 個並行探測、共用 3 秒期限，MP4／FLV 不逐段建立預算。未探測候選在排名、備用輸出及後續探索前仍須通過相同限制與安全 URL 生成檢查。Catalog-only 最多輸出 5 個與主線及彼此不同 Host 的備用網址。

Catalog-only 起播沒有有效結果時，不提交測速贏家；最終送出對完整剩餘合法候選池排名。Catalog 403 只失效當前 stream／Host 配對，不因此授權原始來源備援。

整體停用優先於分頁原線對照及正常固定／自動選路。固定 Host、Catalog override 或原生來源設定變更會失效計畫並重設探測／恢復；舊非同步探測結果不得覆蓋當前設定。已送出的網站請求保持原樣。

<a name="browser-behavior"></a>

## 瀏覽器行為

腳本不取代或檢視 `Worker`，不建立 Worker blob 或訊息通道，也不載入遠端程式。

WebRTC 還原前會確認已安裝的 getter／setter 仍屬於本腳本。可見性清理會移除 listener，嘗試還原保存的 document descriptor 或移除自有屬性；目前可見性實作還原前沒有檢查 descriptor 所有權。描述 hook 時必須依各自的還原行為說明。

<a name="reporting"></a>

## 回報

診斷輸出有上限並經遮蔽，可以包含正規化的 Catalog 或已知 Native Host；未知第三方 Host 使用分頁代稱。不得包含媒體 URL、path、query、token、影片 ID、cookie、IP 或播放器／核心物件。

最近 playurl 摘要只複製傳輸類型、時間、原生 HTTP 狀態、接納結果、最多三種已知格式、有上限的影片／音訊／分段數量、數字 upstream code 及列舉拒絕原因。只保存一筆不可變紀錄，不保存 payload、額外結果欄位或例外文字。此摘要不證明實際網路目的地或播放成功，也不新增持久鍵。

執行期問題請透過儲存庫 issue tracker 回報，不要附上未遮蔽的瀏覽器網路匯出檔。
