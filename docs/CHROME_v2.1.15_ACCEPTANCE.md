# v2.1.15 Chrome／Tampermonkey 安裝驗收 — 2026-10-10

本文件記錄 BR-07 修復發布後的實際安裝版結果。**目前為驗收準備，尚未核對實際載入 v2.1.15；以下全數待驗收。** [修復與來源隔離](BR07_FIX_REPORT.md)、[最新版發行驗證](TEST_REPORT.md) 與本文件分列；v2.1.14 的 [原缺陷](CHROME_v2.1.14_BR07_KEYUP_SEEK.md)／[安裝紀錄](CHROME_v2.1.14_ACCEPTANCE.md) 保留原始結果。

## 身分與執行邊界

- 網站只使用指定風景影片 `https://www.bilibili.com/video/BV1tFZZBQE57/`；Auto 為主，1／2 倍分開。不切片、不鎖畫質、不改 Chrome 設定或停用其他腳本。
- 公開最新版發布及下載讀回、Chrome／Tampermonkey 實際版本、完整執行本體與 singleton 數均待本輪保存。重新連線重新取得所有身分，不沿用失效 remote object。
- 來源隔離與安裝版分列；本輪修復來源 40／40 有效案例通過，前提、兩份非驗收觀察與 auto-repeat／IME／nested／替換限制見修復報告。實際新版尚未載入前不能計通過，Node 模型／自有 iframe 不代替網站矩陣。

## BR-07 與 BR-01 剩餘矩陣

| 場景 | 1 倍 | 2 倍 | 有效通過門檻 |
| --- | --- | --- | --- |
| 最新公開產物／完整 body／唯一 singleton | 待驗收 | 待驗收 | 本體比對完整新版、singleton 1，重連後再核對 |
| 原生按鍵時序與焦點 | 待驗收 | 待驗收 | Right keyup／Left keydown 校準；BODY、播放器焦點、滑鼠對照與實際新修訂 |
| 故障中新鍵盤寬限 | 待驗收 | 待驗收 | 舊停滯後新命令重開完整 15／30 秒，最新位置不被舊還原覆寫 |
| 正常 Auto 播放／暫停／恢復／短 seek | 待驗收 | 待驗收 | 實際時間與影格前進，正常 Auto 調整不強制畫質或多餘重載 |
| 約 12 秒 video-only 延遲 | 待驗收 | 待驗收 | audio 通行，釋放後實際進度恢復，不產生多餘重載 |
| 15／30／重載後 15 秒完整停滯 | 待驗收 | 待驗收 | 合法有效身分、無進度且非 paused／error；15 秒一次備援、30 秒至多一次重載，再 15 秒 failed／釋放，後續 tick 不重試 |
| 新操作與拖曳所有權 | 待驗收 | 待驗收 | 故障／重載前後 seek、拖曳／pointercancel、pause、倍速及近起點皆撤銷過期動作；位置 0／網站正規化分列 |
| 晚到 SDK／外部核心替換 | 待驗收 | 待驗收 | 實際 reload／play 的自有回傳邊界完成／拒絕不復活舊 token，不回寫舊位置 |
| 真正背景與返回 | 待驗收 | 待驗收 | 原生 hidden getter 與 Runtime 真可見性一致；背景停止，返回新基準且不累計背景期限 |
| 生命週期／政策／影音隔離 | 待驗收 | 待驗收 | 舊工作失效；audio fallback 不啟動影片核心恢復，video 自身有效救援可執行 |
| BR-02～05 安裝交叉回歸 | 待驗收 | 待驗收 | 實際新版 hooks／singleton 的 request 所有權、cid、gate 重入及取消原因保持 |

## 故障窗口、清理與證據

每次故障先取得新單一 Fetch／Network 游標並安裝精確當前 video 攔截，audio 立即通行。持續分頁處理事件，保存 hasMore／truncated／dropped；截斷窗口不計完整期限通過。受控 request IDs 的學習寫入抑制維持到晚到結果收束，最後核對記憶體及 schema 2 持久樣本零匹配，清理 held requests、Fetch patterns、訂閱、監聽器、計時器及自有包裝。

背景讀取保存的原生 hidden getter，不能以被腳本維持為 visible 的 document.visibilityState 取代。晚到 SDK 案例須呼叫實際方法，只控制自有 Promise 的完成邊界，保留參數、例外與其他腳本包裝所有權；不得替換媒體 getter、控制器或強制維持網站播放製造通過。

網站提前 pause／error／外部換核心僅證明撤銷；未形成完整逾時前提時明列待驗收，沒有新證據不重複同一失效窗口。新缺陷另寫詳細報告，不自行擴大本輪修復。

新證據目錄 `.work/functional-fixes/br07/2026-10-10-9d98d09/`；身分、各窗口完整事件、正常對照與清理結果待逐項保存。原 87.785 秒自然網路起因與其他完整產品驗收保持獨立。
