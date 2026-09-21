# v2.0.2：禁止出口、播放器備援與死核心事故修復計畫

## 基準與證據

- 不可變基準：v2.0.1，commit `66f7c36dd3605933342ec0536892753f5bfe8cca`。
- userscript SHA-256：`ec2be1e39cea70ddfb04241b26b23b7f787d63896bea100bcb5e12cc8d3ef279`。
- 本次報告確認影片 core 未初始化、readyState=0、尺寸與影格為零；恢复停在 pause-armed，reloadCount=0。
- 已保存的成功影片是 cosov 原始請求改送 mirrorali，HTTP 206；最後影片請求約 5.05 秒後 abort。不能據此宣稱真的連線 cosov，或把 abort 推論成 CDN timeout。
- 已確認程式缺口：未過濾原始備援、普通請求可能將播放器備援拉回既有計畫、無 responseURL 時以 target 冒充回應、死亡狀態沒有自動凍結事故。
- 修正這些缺口不等於證明所有歷史黑屏均由同一原因造成。

## 1. 統一檢查所有播放器 URL 出口

由 RouteCoordinator 提供具原因的資格／輸出決策，playurl adapter 不再自行拼接未經守門的備援。

- primary、Catalog backup、Native backup、root-original 及無法改寫的退回分支全部受 black、dead、設定排除、預設不可用與適用的 circuit／Native 限制約束。
- Catalog URL 必須通過既有 replaceUrlHost 守門，不直接指定 hostname；Native 必須取用同 epoch、同 group 的完整 URL。
- 禁止 URL 可留在記憶體作歸因，但不得再輸出給播放器使用。
- 計画 block、Native resolve 失敗、Catalog materialize 失敗不得悄悄返回被禁原址。
- 請求 send 前再次檢查，涵蓋未知 representation、固定設定、快取計畫與 host-lock。沒有合法替代則本地阻止，不取消已開始的網站請求。
- 保持停用原樣放行與既有非目標 live/resource/PCDN 邊界；不能為繞過 host-lock 或特殊路徑而合成新 URL。

## 2. 區分腳本主路線與播放器自己的備援

在 Vault 建立有界的輸出 URL 角色索引：primary／backup／original、group、epoch、decision。完整 URL 不進診斷或 GM。

- 一般 primary 請求仍沿用穩定計畫，健康評分更新不換線。
- 實際請求命中同 group 已交給播放器、仍合格且不同 host 的 backup 時，協調器可以形成明確的 player-fallback 決策，保留該備援；不能無條件改回 primary。
- 不能只憑請求 host 不同就視為備援；未知 URL、weak／ambiguous 關聯及預取不授予新權限。
- 固定模式優先，仍受禁止與故障 circuit 約束；固定不可用時僅依現有合法恢復規則採用替代。
- requested／observed 與 session affinity 分開；只有可歸因成功及既有 active representation 條件才確認影片路線。音訊只改自身 group。
- 單次 abort 不處罰 CDN、不開 circuit、不自動量測。若需要處理連續無進展，使用既有播放進展／緩衝與恢復門檻，不把 abort 次數當成錯誤證據。
- 對失效 primary 的替代結果，在同 group 保存已提交路線，避免後續段落再拉回原線。

## 3. 修正無回應與最後成功資訊

- responseHost 僅來自非空 Response.url／XHR.responseURL；未取得時為 null，不能以 targetHost 補值。
- 失敗歸因仍可使用捕捉的 targetHost，但明示為送出目標，不稱為回應。
- UI 同時顯示 outcome、status、回應是否存在、資料年齡；abort/status=0 不顯示為成功回應。
- 最新終態與最近成功分開保存。加入黑名單按鈕使用符合新鮮度與歸因條件的最後成功影片，而不是讓後續 abort 蓋掉它；過期時說明原因。
- sourceHost 僅是候選原始來源。不能只因 Vault root 與請求不同就斷言 playurl 曾被腳本改寫；playurlHostChanged 改由實際輸出角色索引證明。

## 4. 死核心先自動留證，再按播放意圖恢復

沿用每秒 PlayerMonitor 與唯一 RecoveryController，不新增第二套重載器。

- 在同 generation 曾有健康影片證據後，core=false、manifest 有影片、readyState=0、零尺寸且无新影格持續至少四個連續有效 tick 時，發出 core-uninitialized 事故事件。背景長 timer gap 不算連續證據。
- 此事件可以在 paused=true 時留證，但絕不因此自動播放或重載。正常暫停可能釋放核心，事故應標為核心不可用／播放意圖待確認，而非已證實 CDN 故障。
- 分開「使用者正常暫停」與「最近已捕捉播放要求但死 video 仍 paused」。保留既有可信 player.play、paused transition 及 verified recovery 入口，不靠全域 click／按鍵猜測。
- 曾有健康證據後，在第一個暫停 tick 準備觀察 player.play；30 秒長暫停限制保留給原長暫停路徑，避免等 30 秒才安裝導致早期要求遺失。
- 無新可信播放要求、無有效進行中恢復 token 时只留證，等待使用者操作；不增加推測性 reload 入口。
- 已成立的 token 遇到 video.paused=true 不應被 pause-armed 覆蓋；強死亡證據持續達既有等待時間才執行一次 reload。
- 保留位置、實際倍速、播放意圖、90 秒 breaker、每 generation 兩次上限，以及 SPA／seek／媒體錯誤取消。核心恢復本身不處罰節點、不測速、不換 CDN。

## 5. 事故不等到使用者匯出才留下

- 上述核心事件自動開始事故，保留前 60 秒、後 30 秒，相關失敗最多延至首事件後 90 秒。
- 同一次持續 core=false 不反覆觸發或取代凍結事故；恢復後新故障才建立下一份。
- 人工「標記剛剛卡頓」不可清掉已有的自動故障證據：在現有事故加註，或保留凍結事故並另存有界標记摘要。
- 分列時間到期與容量淘汰計數，報告列出最近終態及最近成功，避免 events 空陣列、evicted=0 被理解成從未觀察。
- 重要結果分為備援提交／實際送出／收到回應／核心恢復；任何一層缺資料都明示未知。
- 維持 128 KiB 記憶體與 96 KiB UTF-8 報告上限，不寫 GM、不新增網路。

## 6. 先重現再改碼的驗證清單

1. cosov 預設禁止與獨立 black/dead 案例：原始 primary/backup、Native、固定、host-lock、無可改寫網址、無替代皆驗證最終輸出及原生 Fetch/XHR 參數。
2. 先交付 primary A 與 backup B，播放器請求 B 時不得被改回 A；普通 A 請求、預取、未知 URL 不誤觸；音訊備援不改影片 affinity。
3. Fetch 無 Response／XHR responseURL 空、status0、abort及真實 HTTP 回應分别測試；失敗 target 歸因不因 responseHost=null 消失。
4. 影片成功後 abort：最後成功仍存在，最新結果明示 abort；過期有原因。
5. 精確重現本次 readyState0/corefalse/pausedtrue 與缺 token：自動留事故但無播放意圖不擅自 reload；可信要求後成立 token 才按限制恢復。
6. 正常暫停、起播、seek、SPA、畫質切換、背景間隔、重建失敗及重複播放要求不循環重載。恢復實際 1x／1.5x／2x，不強制2x。
7. 手動標記晚於故障60秒、1000筆成功及同一核心持續死亡，既有凍結因果仍存在；報告不含 signed URL。
8. 完整功能、型別、架構、語法、可重現建置與雜湊驗證；不執行 Code Security。

## 7. 交付順序與範圍

先完成必要程式測試與 v2.0.2 封裝，再提交、推送並發布 GitHub Release（僅 userscript）；使用者更新後才以額外分頁完成針對性 Chrome 驗收。保留目前故障頁面，不清學習資料、不改 CDN 清單、評分算法或量測預算。

交付 CHANGELOG、TEST_REPORT、manifest、SHA-256；自動測試與待實機驗收分開。未捕捉實際網路前，不宣稱本次為 cosov 連線黑屏；未驗證全部路徑前，不宣稱所有黑屏已解決。
