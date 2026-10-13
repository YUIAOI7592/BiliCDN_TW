# BR-01 救援政策重評與播放意圖修復

日期：2026-10-14（Asia/Taipei）。基準 **v2.1.23／c3f1a49**，開始工作目錄乾淨。本輪只處理經證據確認的播放意圖入口，沒有重開歷史整份 BR-01 或 P01／P02 驗收。

## 結論與修復範圍

**確認缺陷：網站核心未初始化時，可信播放按鈕可能不呼叫公開 SDK 的 play；PlayerAdapter 只監聽該方法，因而遺漏使用者的恢復播放意圖。** 現場已具合法 video 路線、真正前景、長暫停與可用額度，但按播放後仍為 pause-armed，沒有建立意圖。

修復在目前播放器區域觀察可信的 .bpx-player-ctrl-play 點擊。只在同一 paused 媒體、播放器與內容週期、非 ended/error、真正可見時通知既有 RecoveryController。控制器繼續檢查長暫停、拖曳、授權、政策、操作身分、breaker 與額度。清理核對方法所有權，舊觀察器失效後不能透過其他腳本保留的 wrapper 再通知。

**本輪保留現行時間上限。** 少量窗口不足以支持新的時間數字或傳輸狀態機；沒有新增傳輸觀察介面、額外讀取、重送、設定、權限或持久欄位。原 87.785 秒自然停滯起因沒有取得新因果證據。

## 現況時間線與觀察限制

實際安裝 v2.1.23 已核對完整本體與唯一 RuntimeController；IIFE SHA-256 為 9e97abd7dbab28eb633b46f1774a7b381c562d41109a8dcd994600145f05589f。

| 窗口 | 觀察 | 判定 |
| --- | --- | --- |
| Auto 2 倍正常 seek | 有時間及影格前進，沒有備援或核心重載 | 正常對照通過；不將按工具標記前後的時間當精確 seek 耗時 |
| Auto 2 倍 video-only 延遲 | 約 18 秒停止延遲；備援 +16.173 秒、reload +31.173 秒、首次進度 +44.249 秒、recovered +46.174 秒 | 有播放恢復證據；並非新版結果或最佳門檻估計 |
| 後續 Auto 1 倍 | 網站換成未初始化核心、paused，普通 seek 未恢復；中間有未觀察空隙 | 正常 1 倍比較作廢，不能歸因於前一重載 |
| 上述狀態的可信播放按鈕 | click 的 isTrusted／userActivation 成立，公開 SDK play 與原生 media.play 都未被呼叫；仍 pause-armed | 播放意圖入口缺口確認，不推論失效核心的最初原因 |

時間相對該故障窗工具起點，採樣約 100 ms。2 倍窗口只有一例，不宣稱 P95 或統計最佳值。收集器沒有 truncated／dropped，但曾有最長 17.772 秒讀取間隔，及 6 筆網站取消與放行競合；全部由原生終止收束。該窗不可用來精確估計每個傳輸階段或背壓。第一版觀察器的 transport 事件名稱錯誤，後續修正；不補造缺失事件。

受控影片證據寫入於故障前抑制並保留到分頁收束：26 個受控樣本，記憶體／持久資料匹配均為 0。音訊沒有被持有。最後 held=0、patterns 空；自有 observer／SDK 邊界隨清理及分頁關閉銷毀。

## 最終政策與依據

| 階段 | 保留政策 | 本輪依據／邊界 |
| --- | --- | --- |
| 正常 seek／Auto 有進度 | 讓網站處理；有效時間及影格前進停止無進度計時 | 正常 2 倍與既有正式契約；不強制畫質 |
| 無進度停滯 | 15 秒最多一次合法 video 備援，30 秒最多一次核心重載 | 有界現行政策；單一窗口不足以更換門檻 |
| 重載後 | 15 秒沒有首次有效進度則失敗退出；首次進度後最多 15 秒確認連續進度 | 計時與成功分離；reload 返回不等於 recovered |
| 長暫停後明確播放 | 暫停至少 30 秒的可信播放意圖；明確死核心等 4 秒，其他無進度最多 30 秒才重載 | 修復遺漏入口；原控制器資格與時間維持 |
| 新操作／hidden／失效 | 取消舊動作，保護最新位置／倍速；不自行取消網站請求 | 原所有權契約保留 |
| 額度／重試 | 每段有限動作、生命週期最多兩次重載與 90 秒 breaker | 未新增重試或重開 startup 預算 |

相較現行策略，候選策略只增加「失效核心忽略播放按鈕時仍接收明確意圖」。未採用：只縮短秒數、以 bytes/chunk 空隙直接判定網路失效、沒有可用觀察的多階段傳輸分支。單一讀取器和背壓沒有修改。

## 正式契約與來源對照

來源： [PlayerAdapter](../src-v2/adapters/player.ts)、[正式契約](../tests-v2/regressions/functional-races/br01-play-intent.ts)，由 adapters 套件匯入。

未修來源的原始 8 案：**2 fail／6 pass**。修復後擴充為 14 案：可信按鈕、短暫停／無操作、合成／區域外、正常恢復、播放中、hidden／替換／舊週期、清理／新 wrapper、SDK 參數／receiver／結果／原例外、重複通知、位置 0、同步清理、reset 及 100 個 paused tick 的單一 listener。

內建瀏覽器自有 iframe 使用真正可信點擊，真正 PlayerAdapter／RecoveryController，僅在自有環境注入 FakeClock／合成 VideoSnapshot：

| 同一序列 | 原版 | 修復來源 |
| --- | --- | --- |
| 長暫停後播放按鈕，SDK 不處理 | pause-armed、無 token | play-intent |
| 再 4 秒，核心仍失效 | 無 reload | 一次 reload |
| 重載後 15 秒及再 3 秒 | 原入口未啟動 | failed／reload-timeout，無第二次 reload |
| 合成點擊／區域外按鈕 | 正常排除 | 正常排除 |
| 意圖後提供正常進度模型 | 不用於原缺陷判定 | recovered、零 reload |

來源清理三次均 timerCount=0。合成進度只證明控制器判定，不冒充真影片播放恢復。第一次 loopback 沙箱服務不可達；改用同一僅含合成資料的 host loopback 服務後完成。沒有更換瀏覽器或安全設定。

## 自動與安全驗證

- typecheck、architecture 通過；44 個 runtime 模組。
- adapters 116／116、application 286／286；完整 19 套件 **855／855**，0 fail／skip／todo／cancelled。
- 最終 verify、文件檢查與發布核對結果見 [最新版測試報告](TEST_REPORT.md)。
- Codex Security 差異掃描 **89c38d47-f92f-411b-8d1a-8b3e869da0da**，2026-10-13T16:28:11Z 完成：4／4 來源／測試檔，另核對 README 名稱；0 候選／0 可報告發現。
- 掃描固定摘要 f4abf3c9ef5e09c011b1e610f57c2234f3c354e78fbc17fe28faf578baf34379。獨立架構複核、canonical 與一般 verify 分開保存；後續版本／文件／封裝不是該安全掃描的來源範圍。

## 重跑入口與證據

```powershell
npm test -- adapters --name "BR-01 play intent"
npm test -- application
npm run verify
```

私有根目錄：.work/functional-fixes/br01-policy/2026-10-13-c3f1a49/。PRE_FIX.log 保存未修改執行期的失敗；SOURCE_COMPARISON.json 與 SOURCE_FINITE_EXIT.png 保存來源對照；NORMAL_2X_SUMMARY.json、DELAY_2X_SUMMARY.json、DELAY_2X_NETWORK_FINAL.json、IGNORED_PLAY_1X.json 保存有界摘要。原始歷史證據未覆寫。

本機來源入口 source-server.mjs 會列印實際 loopback 連接埠；/?baseline=1 為原版，/ 為修復版，自有 iframe 的 Play control 以真正可信操作啟動。只服務合成資料；不用於 Tampermonkey 安裝驗收。

## 發布與實際安裝

目標 v2.1.24。選單同步改為「⚙️ 開啟 BiliCDN 控制中心」。發布與新版實際安裝結果分列於最新版測試報告；尚未實際取得的新版播放結果不算通過。

本輪不宣稱整份歷史 BR-01 已結案，也不以來源有限退出代替實際播放恢復。原自然網路原因、無觀察空隙中的核心失效，以及沒有可靠傳輸訊號的策略限制保留。
