# Codex 開發指引

## 工作標的

目前不可變上游基準：`baseline/BiliCDN_TW_1.3.4.original.user.js`

目前模組化候選：`src/` → `Release/v1.6.3/BiliCDN_TW.user.js`（驗收／安全狀態以本版 TEST_REPORT 為準）。

不可變重構基準：`tests/fixtures/BiliCDN_TW_1.5.5.user.js`（正式 v1.5.5 的原 bytes，非 development 草稿）。

上一輪自訂 v1.3.3～v1.4.4 專案已封存於：`archive/pre-upstream-v1.3.4-20260904/`

## 必讀順序

1. `PROJECT_CONTEXT.md`
2. `SECURITY.md`
3. `UPSTREAM_MANIFEST.md`
4. 上游 v1.3.4 userscript
5. 需要比較舊修補時，再讀封存目錄中的報告、測試與 patch

## 開發原則

1. 先完整審核上游 v1.3.4，不把舊 v1.4.4 patch 整包套用到新版本。
2. 逐項確認上游是否已修正、改寫或移除舊問題，只移植仍適用的修補。
3. 優先維持兩倍速播放功能，不為安全而無證據地減損功能。
4. 頁面 JavaScript、console、一般 Worker message 與遠端 URL 欄位皆不可信。
5. 先建立問題重現與 VM harness，再修改 userscript；每項變更後執行相關測試與 diff 檢查。
6. v1.6.3 依使用者明確要求預設啟用 Worker 攔截以蒐集實際需求證據；仍須維持明確停用路徑與完整安全測試。
7. 不新增遙測、資料上傳、執行期第三方依賴或新的遠端程式碼載入。唯一建置工具例外為精確鎖定 esbuild 0.28.2 與其必要平台套件；提交 lockfile，不提交 node_modules。不得設定 CI/CD、GitHub Actions 或自動發布。
8. 自動更新只能指向本儲存庫的 `releases/latest/download/BiliCDN_TW.user.js`，不得指回上游或其他遠端程式碼。
9. 完成後才升版，並產出 CHANGELOG、TEST_REPORT、incremental/cumulative no-index patch 與 SHA-256。
10. VM/mock、靜態檢查與真實 Chrome/Tampermonkey 驗證必須分開描述。
11. 模組來源是唯一建置輸入，不依賴未公開 archive／development。正式 bundle 不得含測試介面。提交訊息附執行當下實際顯示的模型與推理強度，不得沿用過期的硬編碼模型名稱。

## 必須重新驗證的不變量

- Fetch body 使用單一路徑且取消原因能傳回原 reader，不得使用 `response.body.tee()`。
- host-locked 原始 URL、PCDN `/v1/resource`、XHR `responseType=json` 與 contiguous buffered range 正確。
- 停用狀態停止改寫與所有腳本主動網路行為，但不取消播放器自己的請求。
- `CustomCDN`、改寫 target、preconnect 與 Worker target 只能命中可信 catalog。
- 未確認倍速按 2x 規劃，AV1 能力排序不依賴 UA 或 GPU 型號猜測。
- 頁面只能取得無函式、無敏感 URL／cookie／IP 的有界唯讀診斷。
- Watchdog 懲罰只歸給新鮮同 epoch 的影片 Fetch/XHR 觀察，不以音訊、Worker、PerformanceObserver 或排名猜測。
- Codec 查詢不阻塞 playurl；掉幀只作唯讀診斷，不能觸發網路或處罰。
- 診斷事件不得成為控制或處罰來源；有界、去敏、只存本分頁記憶體，Console 失敗不得中斷播放。
- Watchdog 低資料修復仍受播放意圖、讀值、grace、cooldown、breaker 及新鮮影片歸因限制。
- XHR 原生 timeout 只结算一次，不推論 DNS；舊 epoch、abort、seek 不懲罰。Watchdog 回收不得覆蓋真實 Transport 失敗。
- 修復嘗試與影片請求換 host 分開；診斷後態必須來自後續觀察，不宣稱已確認播放消費或修復因果。
