# BR-10 控制中心鍵盤修復與發布

日期：2026-10-11～12（台北時間）。基準 v2.1.20／`55ae4b0b87d3061cbf692b3178b082e37b524872`，開始時工作目錄乾淨。v2.1.21 已發布並取得下列實際安裝結果；原始失敗證據見 [BR-10 調查](IAB_v2.1.20_BR10_CONTROL_CENTER_KEYBOARD.md)，目前狀態見 [TODO](../../../docs/TODO.md)。

## 修復與邊界

控制中心聚焦設定按鈕後，Enter／空白鍵現在可保留原生按鈕啟動。[ControlCenter](../../../src-v2/ui/control-center.ts) 只停止可信 keydown／keypress／keyup 向頁面冒泡；一般按鍵不取消預設，Escape keydown 保留取消與關閉。沒有新增 Tab 焦點循環，click／change 可信檢查、公開 API、設定及 schema 2 不變。

私有監聽器回呼核對開啟狀態、目前且已連接的宿主、ShadowRoot 及 currentTarget。重複 show 不增加 listener；close／宿主重建清理，舊節點及同步關閉不影響新視窗。

這個邊界不能撤銷已先執行的外層 capture handler；正式契約保留此對照。本輪指定影片的實際快捷鍵環境以修復來源及可信 Enter／Space 驗證通過，沒有修改頁面全域 handler 或事件原型。

## 正式契約與結果

入口：`npm test -- control-center`。來源為 [control-center.ts](../../../tests-v2/suites/control-center.ts)，不匯入調查目錄。原 7 個 R02／R03 契約保留，新增 10 個 BR-10 契約。

| 名稱或群組 | 驗證 |
| --- | --- |
| `Enter/Space activation contract preserves no-shortcut control` | 正常對照，2 案 |
| `Enter/Space activation contract isolates page bubble shortcuts` | 正確契約修復前失敗，修復後成功，2 案 |
| `all keyboard phases preserve control defaults and stop only outer bubbling` | 按鈕、checkbox、select、文字區與 target／capture 處理 |
| `outer capture cancellation remains observable rather than being claimed repaired` | 外層捕捉限制 |
| `synthetic keyboard click and change cannot close or execute settings commands` | 合成事件沒有命令或關閉權限 |
| `reopen installs one boundary and Escape removes all three listeners` | 反覆開關、Escape 及清理 |
| `outside keys and stale nodes cannot affect the current center` | 視窗外、宿主替換、舊節點與保留的回呼 |
| `target-side synchronous close and reopen leaves only the new event boundary` | 同步重入所有權 |

以上正式名稱皆有 `BR-10` 前綴及一個空格。事件替身模型化 capture／bubble／取消／listener 移除與封閉 ShadowRoot 的外層 retarget；模型預設啟動不等於瀏覽器原生啟動。

| 執行 | 結果 |
| --- | --- |
| 執行期未修改的失敗契約 | 11 案：9 pass／2 fail；Enter／Space 干擾案失敗 |
| 修復後控制中心 | 17／17，0 fail／skip／todo／cancelled |
| 完整正式套件 | 788／788，0 fail／skip／todo／cancelled |
| 型別與架構 | 通過；44 個執行期模組、無循環 |
| 最終 verify／封裝 | verify 與 package 通過；確定性建置及公開腳本校驗一致 |

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。新證據位於 `.work/functional-fixes/br10/2026-10-11-55ae4b0/`，原失敗紀錄保留。

## 獨立安全差異審查

Codex Security 掃描 `b73a3463-a58f-47ec-8eba-c1b79bfe5b93` 於 `2026-10-11T15:23:21.723484Z` 封存；兩個修改來源／測試表面 2／2 完成，0 候選、0 可報告發現。獨立架構審查與主代理複核涵蓋可信事件、命令入口、同步重入、生命週期清理及資料輸出。

不可變差異摘要為 `f7a44123a09d1d33b930d600cb21061c5ece34a5f52843b6d8eb26895e0946b1`。UI 來源 SHA-256 為 `794d7f9de9578dc5e729c5bd9a3c67e87e47c038950de157911f8c150c17f5f0`。後續版本、文件及封裝另核對，不宣稱包含於該兩檔掃描。Windows 指南解析器誤報路徑不存在，已直接讀取根 SECURITY.md 並核對無下層指南。

工作台回報整段對話 aggregate usage 為 6,183,584 tokens（含 5,981,312 cached input），不是本次修復的獨立增量成本。安全結果與一般 verify 分開保存，原封存不改寫。

## 內建瀏覽器來源驗證

自有控制中心只接記憶體儲存與未啟動控制器；沒有正式 GM 寫入、hook 安裝、播放器命令或 singleton 替換。

| 案例 | 結果 |
| --- | --- |
| 自有頁 Enter／Space，無外部快捷鍵 | 2／2 通過；設定頁開啟、焦點在控制中心 |
| 自有頁 Enter／Space，取消按鍵的 document 冒泡快捷鍵 | 2／2 通過；外部 handler 呼叫 0，按鍵未取消 |
| 指定影片新文件，Enter／Space | 2／2 通過；實際網站沒有取消按鍵，設定頁開啟，焦點未跳到彈幕欄 |
| Escape／清理 | 來源頁與網站頁各移除 4 個觀察 listener，timer 0、storage keys 0；自有 UI 移除，兩驗證分頁關閉 |

證據為 `SOURCE_KEYBOARD.json`、`SITE_SOURCE.json`、`SOURCE_IDENTITY.json` 與 `SITE_SOURCE.png`，重跑入口為 `build-source.mjs`／`source-server.mjs`。真正按鍵由 IAB 提供。網站來源窗口為 Auto 2 倍，僅操作自有 UI；不計為安裝版 Auto 1／2 通過。

## 發布與實際安裝

v2.1.21 已於 `2026-10-11T15:33:58Z` [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.21)。發布時 main 與 peeled tag 均為 `6f843536103b191d322d0b515bf4e700430b3fff`，tag ref 為 `35603a6d221ec394d03b7f3fd86dee639e12f870`。唯一附件 `BiliCDN_TW.user.js` 為 337,000 bytes，SHA-256 `09b1c36fd9f8da578189fd5360481127552f4277585ede83e00aa526c344884b`。15:34:29Z 未帶憑證的公開 latest 版本、大小與 SHA-256 均一致；證據為 RELEASE_IDENTITY.json。Release 快照保留封裝時狀態，不回寫發布後紀錄。

### 更新與安裝身分

發布後第一次新文件仍是 v2.1.20（332,777 字元），原始 `INSTALLED_PRECONDITION.json` 保留。後續由代理在內建瀏覽器開啟既有公開 latest 使用者腳本網址，經 Tampermonkey 更新中繼頁後，新指定影片文件已執行 v2.1.21，不需使用者操作擴充功能介面。先前「必須手動更新」的判斷撤回；今後先嘗試工具允許的公開更新入口，再核對實際載入身分，不以中繼頁本身當成更新成功。

本輪 Tampermonkey 為 5.5.1，完整執行來源 333,559 字元；其中完整編譯 IIFE 為 330,750 字元，SHA-256 `e35ddb7f73a38d495c01e7f02736f3787bfc177165eadfb7e5e349c2ede1eb22`，與本機 v2.1.21 Release 同段一致。RuntimeController 與 ControlCenter 各只有一個實例，沒有替換安裝版 singleton。這個 IIFE 雜湊與公開附件整檔雜湊分開記錄。

### 實際 UI 結果

| 安裝子項 | 結果與觀察 |
| --- | --- |
| BR-10 Auto 2 倍 Enter／Space | 2／2 通過；可信原生按鍵開啟「CDN 與播放設定」，預設行為未取消，焦點留在控制中心「關閉」 |
| BR-10 Auto 1 倍 Enter／Space | 2／2 通過；相同入口與焦點結果，沒有彈幕輸入或送出 |
| P04 關閉後完成 | 通過；實際 UI 將 fixedHost 從 null 改成合法 Catalog 主機，真正命令完成後只保留回傳 Promise；Escape 關閉再釋放回傳，視窗保持關閉 |
| P04 切頁後完成 | 通過；實際 UI 將 fixedHost 復原 null，原生 Enter 返回總覽後釋放舊回傳；總覽及當前焦點保持不變 |
| P05 完整診斷 | 通過；原生 Enter 開啟診斷，文字區 80,653 字元與本次 buildReport 結果相同，完整模型及唯讀觀察成立 |
| P05 複製 | 驗證未通過；真正啟動「複製報告」後，工具讀到空內容。進一步校準逾時，尚不能區分產品複製失敗與工具剪貼簿問題 |

控制中心開啟及部分聚焦使用實際安裝物件的 `show()`／原生 DOM focus 作測試準備；按鈕啟動、select 變更、Escape 與返回操作皆由 IAB 原生按鍵完成，沒有合成 click 或替身命令。不把這些結果當成滑鼠或 GM 選單入口驗證。畫質一直是 Auto；倍速以原生媒體屬性分開設定。網站自然出現網路錯誤 3001，P04 在暫停狀態執行；本輪是 UI 驗證，不計播放／BR-01 通過，也未因此重啟 BR-01。

P04 包裝只延後實際 `updateSettings` 的回傳，保留 receiver、參數、結果及例外。兩筆真正命令均 settled／released，pending 為 0；最後 fixedHost=null，其他設定欄位與基準相同（正常 updatedAt 除外），命令方法按原描述子復原。沒有以整份舊設定覆蓋遠端變更。

P05 報告時間為 `2026-10-11T15:52:33.054Z`。readModel 包含 version、settings、session、monitor、recovery、measurement、interception、routes、restrictions、evidence；輸出包含 title、generatedAt、evidence、current、recorder、export。觀察 buildReport 前後的 probe、reload、evidence.record、storage.set、storage.delete 呼叫均為 0。完整文字未命中原始 HTTP(S) URL、已列簽名查詢或 IPv4 模式；此現場檢查與正式遮蔽契約共同支持本項，不推論所有可能格式。

### 複製失敗窗口與續行條件

1. 原剪貼簿只有空項目集合 `[]`，僅留在記憶體；按鍵前再次確認沒有新內容。
2. 聚焦真正「複製報告」按鈕並用原生 Enter 啟動，工具讀取仍為 `[]`／空字串，與 80,653 字元報告不一致。
3. 嘗試還原空項目集合時，工具要求至少一個項目；改用空文字後確認內容為空。只證明文字內容復原，不能宣稱「無 MIME 項目」的原始表示完全復原。
4. 嘗試核對實際 GM clipboard 呼叫時工具逾時；沒有取得該呼叫的可靠證據，後續原生 clipboard 核對也逾時。沒有新前提便停止重複按複製，不將此命名為已確認的新產品缺陷。

下次只需先在自有隔離頁校準工具剪貼簿、原生 Clipboard 與 Tampermonkey `GM_setClipboard` 是否同一通道，且能安全保存及復原；校準成功才重跑一次 P05 複製。BR-10、P04 及已通過的報告子項不重測。不得修改產品來繞過尚未定位的測試通道問題。

### 證據與清理

安裝結果摘要存於 `INSTALLED_IDENTITY.json`、`INSTALLED_ACCEPTANCE.json`，由已返回的工具觀察整理；不是逐事件原始匯出。完整本體 POST 及安裝畫面保存嘗試逾時，沒有把不存在的 `INSTALLED_BODY.json` 或安裝截圖列為證據。`SITE_SOURCE.png` 只屬前述來源驗證。

P04 設定與命令方法復原已直接核對。報告觀察的六個包裝及三種鍵盤 listener 位於自有測試文件；最終明確關閉該分頁與更新中繼頁，IAB 分頁清單為空，文件資源隨之銷毀，不冒稱六個包裝逐一原位還原已核對。沒有安裝故障攔截、建立受控 probe 或重開起播 gate。自有 loopback 服務已結束，31993 無監聽；清理摘要見 `CLEANUP.json`。

BR-01 保持跳過；無新前提的 P01／P02、已通過案例與原自然停滯不加入本輪門檻。產品失敗、工具阻塞及前提不成立分開記錄，不自行擴大修復範圍。

BR-10 修復、發布及四個安裝入口案例通過；P04 兩案與 P05 報告通過。本輪完整 UI 安裝矩陣未全部通過，唯一剩餘項目為上述 P05 複製，原因仍需通道校準。
