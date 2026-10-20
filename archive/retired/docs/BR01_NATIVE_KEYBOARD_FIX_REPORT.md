# BR-01：重載空媒體中的可信鍵盤尋位 — 2026-10-11

本輪基準 v2.1.18／`953ffeaebff686eaaffe27ef2fe622bb97fa1b95`，開始時工作目錄乾淨。只使用指定風景影片、Auto、1／2 倍速分開。修補目標為 v2.1.19；發布與實際安裝結果見 [最新驗證](../../../docs/TEST_REPORT.md)。BR-01 完整安裝矩陣仍須逐項取得新版證據，不以本機通過代替。

## 新增確認的功能缺口

實際 v2.1.18 singleton 的 video-only 故障觸發核心重載後，媒體 `readyState=0`、`seeking=false`。BODY 焦點可信 Right keyup 將原生 currentTime 從 0 改為 5，卻沒有增加 userRevision；舊恢復動作仍沿原期限退出。影片在 HAVE_NOTHING 時保存有限 default playback start position，不一定發出 seeking。原 #confirmKeyboardSeek 無條件要求 seeking，漏掉了這種合法使用者尋位。

事件順序：合法 video 停滯 → 15 秒備援 → 30 秒自有 reload → 原生空媒體 → 可信 keyup 改變有限目標 → userRevision 未增加。BR-09 未知位置觀察雖能撤銷位置還原，但不會授予新使用者完整寬限；兩者契約不同。現場未觀察到舊位置再次覆寫 5，不能宣稱有此症狀。Network 處理存在校準缺口，故這份記錄證明鍵盤所有權缺口，不當成完整期限驗收。

## 來源與正式契約

- `src-v2/adapters/player.ts`：私有 KeyboardSeek 保存 core 及 keyboardRevision。既有 seeking 路徑維持；新增原生 readyState 0、捕捉核心未變且非 internalReload 的有限新目標確認。兩者都要求可信派送仍有效、候選與版本、媒體／播放器／生命週期及真正可見性，並保留 internalSeek／pendingSeek 抑制。getter／SDK 返回後重查，舊清理不得清掉新候選。
- `tests-v2/regressions/functional-races/br06.ts`：新增 14 個具名正式契約，含 keydown／keyup、位置 0、新期限、活躍 reload 與晚到拒絕、七種排除、1／2 倍精確 14,999／15,000、29,999／30,000、重載後 15 秒及三 tick 不重試、getter 媒體替換。既有 application 入口明確匯入，不使用調查目錄作輸入。
- 不改公開 API、控制快照、schema 2、15／30／15 政策、Auto／ABR 或 Vault 授權。未知、合成、派送後及來源不明的目標仍不猜測為可信命令。

修改執行期前，四個正確契約全部失敗、七個正常對照通過；修復後全套 19 套件／755 契約、typecheck、44 模組 architecture 及 verify 通過。修復前失敗不計入正式通過。重跑：`npm test -- application --name 'BR-01.*uninitialized'`；完整命令依 [DEVELOPMENT](../../../docs/DEVELOPMENT.md)。

## Chrome 來源隔離與安全審查

自有 iframe 使用真正原生空 video，沒有覆寫媒體 getter；真正可信 keydown／keyup，1／2 倍各驗 direct／wrapped、無操作、派送後、腳本還原、核心替換、Home 到 0、editable／合成排除，30／30 通過。SDK／核心為自有來源模型，並非 Tampermonkey singleton。iframe、timer、影片及方法包裝清理全部核對。

獨立 Codex Security `d3d31ada-7afb-4e77-9fb4-e0378a0db1d2` 於 2026-10-10T19:50:51.270579Z 封存，2／2 凍結差異項覆蓋，0 候選／0 發現。獨立架構 worker 與父代理逐行檢查可信輸入、同步重入、來源抑制、生命週期／核心／token 及清理。封存前草稿欄位缺失曾造成一次完成失敗；補齊實際覆蓋後重新完成並讀取封存結果，不把失敗當通過。policy helper 無法看見 repo，人工確認只有根 SECURITY.md 並完整讀取；此限制保留。後續版本／文件／產物不在凍結執行期差異中。

## 證據及續行

私有證據 `.work/functional-fixes/br01-final/2026-10-11-953ffea/`：baseline-test、native-keyboard-before／controls-before、native-keyboard-after／expanded、all-tests、typecheck、architecture、verify-local、chrome-native-keyboard，以及原 v2.1.18 的 auto1-keyboard-new-grace。保留來源隔離入口 native-keyboard.ts／js 與 CHECKPOINT。

發布後重新確認完整執行本體／唯一 singleton，按原 BR-01 矩陣繼續 Auto 1／2，故障攔截、實際 SDK 回傳、真正背景、影音／政策及交叉回歸各自列明。未取得有效證據的項目判為不通過；原 87.785 秒自然網路起因仍独立未定位，不作本次修復門檻。
