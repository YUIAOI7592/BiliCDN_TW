# Chrome／Tampermonkey v2.1.13 部分驗收 — 2026-10-10

BR-01 A／B／C 修復與發布完成，**實際安裝版已取得部分有效證據，完整矩陣未結案**。本紀錄不代替 [來源隔離／正式契約](BR01_FIX_REPORT.md)，不將原 87.785 秒自然網路原因或其餘完整產品驗收標為完成。

**後續 13:45–13:57 續測已確認 [BR-06 鍵盤 seek 所有權缺口](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)，未修復，完整 BR-01 安裝驗收未通過。** 下方原始窗口保留其當時範圍；新的失敗、滑鼠對照及剩餘項目見末段與詳細報告。

## 產物與測試前提

- 2026-10-10 13:07:23（Asia/Taipei）發布 [v2.1.13](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.13)；來源／標籤提交 fc2b3b5ed58e307d8c87e2326769cfa8a390cf46。main、peeled tag 與唯一 Release 附件已讀回。
- 唯一腳本 BiliCDN_TW.user.js，314,188 bytes，SHA-256 646515874ea4088b11830907826c5d1275f823c155a5fb1523999a9755ffa816。無登入公開 latest API／下載一致。
- 13:09 起在 Chrome 的實際 Tampermonkey 執行來源中，核對完整發布腳本 body；ControlCenter singleton 一個。重新載入同片後再次核對，沒有以 build 名稱、Node 或舊版代替身分證據。
- 唯一網站影片：[指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)。Auto 選取，1／2 倍速分開確認。沒有設定固定畫質、不變更 ABR／Chrome 設定、不停用其他腳本；正常 1080P／4K 調整不列缺陷。
- 觀察實際 PlayerAdapter／PlayerMonitor／RecoveryController／RouteCoordinator，未以替身取代。250 ms 媒體採樣、實際控制修訂及型別化路線／核心事件另存私有證據，不輸出影音 URL／路徑／cid。

## 有效現場結果

| 場景 | 觀察與結果 | 狀態 |
| --- | --- | --- |
| Auto 1 倍正常播放／暫停／恢復、近起點 seek | 影片時間及影格前進，暫停為 paused，恢復後正常；新目標沒有被舊位置蓋回，零核心重載 | 基本對照通過 |
| Auto 2 倍正常播放／暫停／恢復、短程 UI seek | 單獨確認速率 2；實際時間及影格前進、原生暫停與短 seek 後恢復，零核心重載 | 基本對照通過 |
| Auto 1 倍：12 秒 video-only 延遲 | 4 個影片請求曾持有、12 個音訊請求即時放行；seek 16.772 秒，一次 video 備援／零核心重載，恢復後 readyState 4、無錯誤 | 有效受控恢復 |
| Auto 2 倍：12 秒 video-only 延遲與後續觀察 | 4 個影片請求曾持有、4 個音訊即時放行；seek 34.395 秒，一次 video 備援／一次核心重載，後續實際時間及影格恢復，內容 epoch 0 穩定 | 有效受控恢復 |
| Auto 1 倍：65 秒持有窗口 | 14 個影片請求持有、19 個音訊即時放行；一次 video 備援。網站約第 24 秒自行暫停／外部更換核心，腳本以 stall-ended 釋放意圖、零新增重載，後續不重試 | 暫停／外部替換撤銷通過；不能證明逾時分支 |
| 受控樣本與工具清理 | 98 個受控 video request IDs、62 次證據寫入抑制；記憶體／持久樣本命中均 0，schema 2；無持有請求、無恢復 token，observer／攔截／自有 hooks 清理 | 通過 |

2 倍受控輪的首次 seeking 採樣到備援為 16.339 秒、到重載為 31.339 秒，兩次動作相隔 15 秒。1 倍備援為首次採樣後 16.800 秒。這是 250 ms 觀察採樣與一秒產品 tick 的現場時序，不冒充私有停滯起點或 FakeClock 的精確邊界；正式 14,999／15,000、29,999／30,000 ms 由契約驗證。

2 倍核心重載之後，網站自行調整位置，舊意圖約一秒後以 stall-ended 撤銷；這遵循來源不能可靠區分時優先撤銷舊還原的規則。後續實際進度使狀態恢復，沒有以保留寬高立即報成功；**這輪不是重載後完整 15 秒無進度測試**。重載時 Auto 選單暫缺 11 個採樣，前後 Auto 選取一致，測試沒有操作畫質；缺少 UI 不能單獨當作網站改為固定畫質的證據。

網站的 player.seek(0) 呼叫另外記錄，但網站將實際位置移到 0.307 秒；UI 近起點操作也不能精確落在 0。故這些現場操作只證明新目標撤銷與正常恢復，**精確位置 0 的保存仍是正式契約／來源隔離證據**，不將網站正規化後的位置冒充 0。

## 攔截與證據完整性

先安裝明確的非 Document Request-stage Fetch 攔截；每個實際 URL 僅在記憶體中查當前 Vault.match，以本世代／內容週期的 video 歸因判斷持有，其餘含 audio 立即 continue。沒有另建 Native 授權、沒有合成 CDN 探測。網站已取消的 interception ID 記為 already-ended，不重試／重送。

Fetch.requestPaused 與 Network requestWillBeSent／responseReceived／loadingFinished／loadingFailed 使用同一可變狀態物件中的游標，逐批記錄 after／cursor／hasMore／truncated。三個有效故障窗口內無截斷，observer 無資料淘汰；兩個 12 秒輪和 65 秒輪的音訊成功傳輸分別為 20、9、4 次。各窗口停止持有後釋放所有仍有效請求，清空 Fetch patterns；沒有在一般分析等待期間繼續保留新的 Request 攔截。

受控階段為每個實際 request-started video 分配的既有 requestId 保存寫入過濾，解除故障後仍保留其晚到結果過濾。核對實際 EvidenceStore.list 及其 StoragePort 讀回的 schema 2，owned IDs 均無樣本；沒有清除使用者學習資料，也不宣稱正常播放期間完全沒有資料更新。完成後清理自有 interval、媒體／visibility listeners、route／recovery subscriptions、XHR 終止 listener，僅還原仍持有的 send／evidence.record hook，刪除暫存 observer。重新載入同片另做正常對照，最後關閉自己建立的測試分頁。

## 作廢與更正

- 初次注入以跨呼叫純量保存期限，沒有進入持有分支，不能算故障成功；installed-delay-first-invalid.json 保留。
- 游標校準輪出現截斷，且攔截曾跨工具等待造成網站播放干擾；該輪全部排除，清理後重新載入同片。installed-cursor-calibration.json／installed-calibration-cleanup.json 保留，不混入有效對照。
- 第一個有效 12 秒輪的檔名與 marker 寫成 1x，但所有實際速率採樣均為 2。以 installed-auto-2x-delay12-followthrough.json 及速率更正 marker 為準，不能重複算作 1 倍通過。
- 真正 1 倍輪在開始前 1,307 ms 有一批 normal capture 被截斷；該批在故障窗口外。窗口內全部 batches／hasMore 完整，分析入口按具名開始／結束標記核對，沒有宣稱整個歷史集合完全無截斷。
- 65 秒持有窗口結束讀回含後續觀察，共 95.131 秒；網站在第 24 秒附近已暫停。不能用總記錄長度冒充持續有效播放意圖或 post-reload deadline。

## 待驗收與續行

1. 實際新版不被 pause／error／外部換核心中斷的長停滯：一次核心重載後完整 15 秒沒有進度、明確退出且不在後續 tick 重試。本輪網站提前暫停，未形成此必要前提。
2. 故障／重載期間的新可信 seek、拖曳／pointercancel、pause／倍速變更、晚到 reload／play、外部核心替換及真正 hidden 的完整安裝版交錯。正式契約已涵蓋，現場基本操作不足以替代。
3. 原 87.785 秒自然網路原因與其他完整產品驗收；BR-02～05 的完整新版安裝矩陣未在本輪重新執行，沿用其歷史紀錄的範圍，不以 474 Node 案例代替。

續查仍只用指定影片、Auto 分開 1／2 倍，先記錄產物 body。若網站提前取消前提，分開標示撤銷結果，不能修改 paused／seeking getter 或取代控制器冒充實際安裝證據。故障工具完整窗口內持續 pump；每階段保存證據、即時清空攔截，避免無效重跑。

## 私有重跑入口

本機目錄 .work/functional-fixes/br01/2026-10-10-c924b02/：installed-identity.json、三個 installed-auto-* 有效窗口、installed-controlled-cleanup.json、installed-final-normal.json／installed-final-cleanup.json、chrome-installed-final.png；analyze-installed.mjs 依具名 marker、實際速率、事件完整性、影片／音訊與動作次數檢查，輸出 installed-summary.json。RERUN.md／CHECKPOINT.md 保留工具前提與續行。沒有把原始敏感網址或私人完整瀏覽器狀態加入公開文件。

```powershell
node .work/functional-fixes/br01/2026-10-10-c924b02/analyze-installed.mjs
```

分析檢查通過只代表這些有效證據窗口一致；它不是全部安裝版矩陣或自然網路原因結案。

## 13:45–13:57 續測：BR-06 已確認

實際 v2.1.13 body／singleton 再次核對，仍只使用指定影片、Auto，分開 1／2 倍。受控 video-only 延遲期間，在 BODY 焦點的新可信 ArrowRight 實際將目標向前移 5 秒，但 userRevision 未增加；1／2 倍分別在新操作後 8.205／6.986 秒備援。故障中第二次滑鼠 seek 則更新 userRevision，約 14.3 秒對照窗口無備援、保持 seek-grace。三個有效窗口分別持有 7／9／8 個 video、各放行 4 個 audio，全部事件游標完整，沒有 pause／hidden／error 中斷前提。

獨立正確契約為 2 fail／3 pass，既有正式 BR-01 26 個案例重跑通過但未覆蓋此鍵盤入口。根因、精確位置、修正方向、作廢工具校準及重跑見 [BR-06 報告](CHROME_v2.1.13_BR06_KEYBOARD_SEEK_OWNERSHIP.md)。新證據存於 .work/functional-review/br01-remaining/2026-10-10-45a4420/，沒有覆寫前述紀錄。62 個受控 IDs 在記憶體／持久資料命中均 0；恢復後移除自有觀察器與攔截、關閉自建分頁。

已完成本次「找到問題並撰寫詳細報告」的自主目標，沒有修復或升版。鍵盤所有權需修復；安裝版重載後完整 15 秒無進度退出、拖曳／pointercancel、故障中 pause／倍速、晚到 reload／play、真正 hidden 與其餘核心交錯繼續保留待驗收，不能改標為通過。
