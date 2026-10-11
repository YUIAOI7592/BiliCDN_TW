# BR-10 控制中心鍵盤修復與發布

日期：2026-10-11。基準 v2.1.20／`55ae4b0b87d3061cbf692b3178b082e37b524872`，開始時工作目錄乾淨。目標 v2.1.21；原始失敗證據見 [BR-10 調查](IAB_v2.1.20_BR10_CONTROL_CENTER_KEYBOARD.md)，目前狀態見 [TODO](TODO.md)。

## 修復與邊界

控制中心聚焦設定按鈕後，Enter／空白鍵現在可保留原生按鈕啟動。[ControlCenter](../src-v2/ui/control-center.ts) 只停止可信 keydown／keypress／keyup 向頁面冒泡；一般按鍵不取消預設，Escape keydown 保留取消與關閉。沒有新增 Tab 焦點循環，click／change 可信檢查、公開 API、設定及 schema 2 不變。

私有監聽器回呼核對開啟狀態、目前且已連接的宿主、ShadowRoot 及 currentTarget。重複 show 不增加 listener；close／宿主重建清理，舊節點及同步關閉不影響新視窗。

這個邊界不能撤銷已先執行的外層 capture handler；正式契約保留此對照。本輪指定影片的實際快捷鍵環境以修復來源及可信 Enter／Space 驗證通過，沒有修改頁面全域 handler 或事件原型。

## 正式契約與結果

入口：`npm test -- control-center`。來源為 [control-center.ts](../tests-v2/suites/control-center.ts)，不匯入調查目錄。原 7 個 R02／R03 契約保留，新增 10 個 BR-10 契約。

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
| 最終 verify／封裝 | verify 通過，退出 0；正式封裝於發布步驟核對 |

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

v2.1.21 發布準備中，尚未核對公開更新產物。

| 安裝子項 | 目前結果與必要步驟 |
| --- | --- |
| BR-10 Auto 1／2 | 尚未執行；完整新版及唯一 singleton 核對後，各做 Enter／Space 入口 |
| P04 關閉／切頁後完成 | 尚未執行；影片暫停，實際 UI 提交可復原固定主機，只延後真正命令回傳，最後只復原修改欄位 |
| P05 完整診斷 | 尚未執行；真實 UI 報告、敏感遮蔽及讀取副作用 |
| P05 複製 | 尚未執行；原剪貼簿只留記憶體，確認仍由本次寫入持有才復原；不能安全復原時不寫入 |

BR-01 保持跳過；無新前提的 P01／P02、已通過案例與原自然停滯不加入本輪門檻。產品失敗、工具阻塞及前提不成立分開記錄，不自行擴大修復範圍。
