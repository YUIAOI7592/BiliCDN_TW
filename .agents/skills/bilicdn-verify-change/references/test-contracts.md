# 測試契約與隔離

## 套件與新增案例

套件選擇器、入口及順序以 [test-registry](../../../../scripts/testing/test-registry.mts) 為準；使用 `npm test -- --list` 取得當次清單，不在指南重列另一份登記。功能案例置於 tests-v2/cases 的 routing、playurl、transport、playback、state、ui、tooling 群組，由 registry 登記的入口明確匯入；另有 architecture、imports、domain-boundaries 等專用入口。新增套件須登記，支援工具及調查資料不以 glob 執行。

使用具名 node:test；每案以本地建立函式重建可變狀態，同一情境的多個斷言可以留在同案。不使用數字 scenario 分派、不讓完整案例呼叫另一完整案例，也不透過原型繼承可變情境。閉包可變欄位使用存取器轉交，不以物件展開凍結 getter。

使用原生 assert，保留內容、數量、字串、JSON、身分與副作用斷言。修復前後證據分列，不只斷言錯誤存在；重構先固定原行為。案例數表示情境，不能換算成舊版功能斷言數；歷史對照見 [MIGRATION](../../../../tests-v2/MIGRATION.md)。

## 執行器與判定

[test 入口](../../../../scripts/test.mts) 逐套件打包帶 inline source map 的 mjs，以 --enable-source-maps、--test-isolation=none 在獨立 Node 子程序執行；每次一份套件，案例依序。單案及清理掛鉤預設五秒，外層單套件六十秒；stdout／stderr 合計上限 32 MiB。超時／超量終止所屬程序並等其退出，正常完成不強制退出，未釋放的計時器會導致外層失敗。

人類輸出使用原生 spec；機器判定讀 [JSON reporter](../../../../scripts/testing/test-reporter.mts) 的版本、數量、耗時及案例結果，不解析畫面文字。打包、案例、清理、期限、輸出量、摘要缺失／損壞及退出碼不一致均失敗；執行器收集其他套件後彙總。

退出碼為通過 0、驗證失敗 1、非法參數或名稱零命中 2。CLI 建立暫存前驗證套件、選項與正規表示式；--list 不與套件或 --name 合用。完整執行拒絕空套件、only、skipped、todo、cancelled；名稱篩選可不執行未命中案，但至少實際執行一案。靜態執行期匯入圖檢查具名案例與 only，純型別匯入不算案例。

## 資源與非同步

[testScope](../../../../tests-v2/support/scope.ts) 立即以 t.after 登記清理；own／defer 接納同步與非同步釋放，反向執行，一項失敗仍完成其他釋放及全域還原，再彙總錯誤。dispose 可重複呼叫。全域替換經 defineGlobal，保留首次修改前的完整描述子；計時器、攔截、訂閱與取消函式由資源所有者明確登記。模擬介面使用 satisfies，不用 as never 繞過型別。

[FakeClock](../../../../tests-v2/support/clock.ts) 使用固定起點，拒絕非法延遲、非正週期間隔及重入推進；同時間依登記順序，下一計時器前處理獨立微任務，每次最多 10,000 回呼。釋放後不執行。以 deferred 或完成訊號等候非同步，保留拒絕及取消；BrowserScheduler 可用少量真實事件迴圈，但依完成訊號判斷。

匯入純度在不載入 node:test 的獨立子程序中執行，停用 tree shaking、忽略最佳化註記，保留瀏覽器／GM 與 Date.now／Math.random 陷阱；內層三秒、外層具名案例監督。這只能證明非入口模組頂層匯入，不外推建構或方法呼叫。量測拒絕也以獨立程序檢查未處理拒絕，管理當案時鐘、儲存及 helper。

## 依修改保護的邊界

| 變更 | 契約重點 |
| --- | --- |
| XHR／Fetch | 原生對照的送出前後 abort、ByteString／USVString 單次轉換、失敗後更正、跨 realm body、同步 setter／open 例外、重用及重入所有權 |
| UI／鍵盤／指標 | 事件種類與網站提交階段分開；closest 只查祖先，模型包含路徑、capture／bubble、取消及 listener 釋放。模型可信事件不代表瀏覽器可信輸入 |
| 內容身分 | cid 與請求歸屬、低信任來源、父目錄集合及容量；來源版本不同不混算 |
| 恢復／可信意圖 | 同播放器、媒體與內容，paused／ended／error、真正可見性、可信事件、精確期限、最新目標、拖曳、政策與晚到 Promise；每個副作用前重查所有權 |

數值資格以[恢復與操作契約](../../../../docs/ARCHITECTURE.md#auto-救援與操作所有權)為準。一般停滯、長尋位、生命週期、重載額度與自然恢復須有正反例；原生時間零、未知來源撤銷、快取進度而真媒體不動、新操作及晚到結果不能誤算成功。

救援還原可選 adapters 的 SR1／SR2、application 的 SR2；SR1 保護 SDK 例外後原生寫入，SR2 分開單元與真實元件整合。state 以外核對 action 的 source、保存目標與 reason；普通 playback-progress-observed 不代算原操作成功。SR2-I-F01 保護 Monitor／Runtime／Routes 閉環；補正等待不算播放，後續十五秒觀察不延後產品原有成功判定。

修改 Enter／Space 時保護上述 N 契約；若當次已授權相應瀏覽器驗收，再依 [IAB 方法](../../bilicdn-iab-validation/SKILL.md)分開來源隔離與指定影片可信輸入，否則明列尚無 S／I 證據，不自行開窗口。來源 UI 使用記憶體依賴，不替換安裝 singleton。正式產物不加入測試橋接；測試從 TypeScript 獨立打包，停止狀態仍以 TODO 為準。
