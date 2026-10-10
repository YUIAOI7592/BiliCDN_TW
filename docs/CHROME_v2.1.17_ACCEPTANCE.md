# BiliCDN_TW v2.1.17 Chrome 驗證與安裝驗收

日期：2026-10-11；修復基準 v2.1.16／`1e376978c757c0a1e622668fd04fdaad658dc7ef`。本文件分開保存來源隔離、真實 SDK 校準與新版 Tampermonkey 驗收。當前 v2.1.17 為待發布候選，指定影片新連線仍是 v2.1.16；不能將任何既有版本結果計入新版通過。

修復因果与正式契約見 [BR-01 後續修復報告](BR01_FOLLOWTHROUGH_FIX_REPORT.md)，整合與發行見 [驗證報告](TEST_REPORT.md)。網站只使用 [指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 1／2 倍分開，不改網站 ABR、Chrome 設定或其他腳本。

## 最後來源隔離：22 個有效案例通過

使用本機自有 iframe 中的真正 PlayerAdapter、PlayerMonitor、RecoveryController；媒體與時鐘是合成資料及 FakeClock，路線資格是受控模型。沒有安裝 singleton、GM 寫入、CDN 探測或網站媒體 getter 修改。原生 Chrome 輸入的可信性與控制器模型時間分列。

| 場景 | 1 倍模型 | 2 倍模型 | 證據邊界 |
| --- | --- | --- | --- |
| 14,999／15,000、29,999／30,000、重載後 14,999／15,000 ms | 通過 | 通過 | 各一次備援／重載，完整逾時後釋放，再三 tick 不重試 |
| SDK 新 seek 與兩次進度跨觀察租期 | 通過 | 通過 | 977 保留；不回写978；兩個有效採樣才 recovered，沒有重複備援 |
| 政策、模擬 hidden、reset 失效 | 三案通過 | 三案通過 | 零過期 seek／rate／play；模擬 hidden 不等於網站真背景 |
| 首個合法核心後再次外部替換 | 通過 | 通過 | 第一核心先合法採用，第二核心撤銷舊動作 |
| 真正 BODY Space | 通過 | 通過 | trusted=true，新 userRevision 一次，舊 token 結束，零過期還原 |
| 真正 BODY 倍速變更 | ArrowUp 通過 | ArrowDown 通過 | 1→2／2→1 的實際改變各取得一次修訂 |
| 真正 BODY ArrowRight 新 seek | 通過 | 通過 | 新目標5，只有網站方法的一次 seek，舊還原不回寫 |
| 輸入框可信 Space | 通過 | 通過 | userRevision 不變，沒有網站播放操作 |
| 可信進度指標按住／放開 | 通過 | 通過 | 按住31秒是 FakeClock 時間；零救援，放開後新15秒邊界成立 |

前四列合計12個控制器模型案例，後五列10個真正輸入案例，總計 **22／22**。首輪發現的重複 fallback 與跨租期誤撤銷保留原失敗，補正式契約後以上述最後來源重跑。`final-matrix` 的初次 `owner-replace` 是第一個合法核心，不能當外部替換失敗；排除該校準，以獨立 `final-second-core` 取得第二核心證據。

執行 bundle SHA-256：`6c8d1caca5c0c1d23a406c5ec54b1dada4ddecde7b66106b8b05593cd938536e`；原生 Debugger 取得的完整本體與本機 bundle 一致，唯一來源。這是來源隔離 bundle，不是發布使用者腳本的校驗值。最後 `timers=0`、自有 root 移除、分頁關閉、本機 helper 停止；網站不留來源模型。

## v2.1.16 SDK 校準：不計新版自動救援

Auto 1／2 倍手動呼叫實際 Adapter.reload，均觀察返回前同步 native pause、null 核心，约300ms新核心、约1秒初始化整秒 seek、约2秒網站 play。BODY 可信 Space 的實際 paused 改變沒有舊版 userRevision。這些窗口沒有建立 Recovery token 或故障攔截，只校準 SDK 方法；2倍首批 Network 截斷保留，1倍獨立15秒窗口完整。清理方法完整描述子與包裝所有權，計時器／XHR觀察器／持有請求均零。

重新連線後另核對 v2.1.16 完整執行本體匹配、唯一 ControlCenter／Runtime；指定影片 Auto 2、正常暫停、native前景。這只是發布前裝置基準。

## v2.1.17 安裝矩陣：待實際更新

| 場景 | 當前狀態／通過条件 |
| --- | --- |
| 完整版本／singleton／hooks 身分 | 待載入新版；完整執行本體須與 Release 產物一致 |
| 正常 Auto 1／2 倍 | 待驗收；播放、暫停／恢復、短 seek、時間與影格進度 |
| 12 秒 video-only 延遲 | 待驗收；audio通行、恢復進度、無多餘核心重載 |
| 完整15／30／重載後15 | 待驗收；自己的 paused／null 初始化不提前撤銷；完整無進度後failed／釋放、再三tick不重試 |
| BODY pause／rate／seek、拖曳／pointercancel／近0 | 待驗收；最新操作撤銷舊還原；位置0與網站正規化值分列 |
| 延後SDK完成／拒絕、外部核心 | 待驗收；真正方法已呼叫，只控制自有回傳邊界；不復活token或回寫舊位置 |
| 真正背景 | 待驗收；原生hidden=true且Runtime visible=false，不以被覆寫visibilityState作證據 |
| 生命週期／政策／影音隔離 | 待驗收；既有操作精確復原，audio不能建立影片核心意圖 |
| BR-02～05相關實際hooks／內容／gate | 原歷史子集分列；新版剩餘自然前提待成立，不重設控制器／startup預算製造前提 |

故障前安裝精確目前 video 攔截，單一 Fetch／Network游標持續處理，完整捕捉且無截斷／丟失才計時序；受控 request／startup／challenge 的學習抑制保留至晚到結果收束，核對記憶體／持久樣本零匹配。網站提前 error／外部换核心只證明撤銷，不能補算完整逾時。自己 SDK 正常 paused 過渡須使用新所有權條件判定，不再將一切 paused 一概作外部撤銷。

原87.785秒自然網路起因、Auto位置跳變及其餘完整產品驗收保持獨立。本輪私有新證據：`.work/functional-fixes/br01-followthrough/2026-10-10-1e37697/`；歷史 [v2.1.16驗收](CHROME_v2.1.16_ACCEPTANCE.md) 與 Release快照不改寫。
