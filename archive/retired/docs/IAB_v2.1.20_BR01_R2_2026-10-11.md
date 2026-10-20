# v2.1.20 BR-01 內建瀏覽器第 2 輪與 XHR 交叉回歸

日期：2026-10-11（Asia/Taipei）。基準：`24dcdfd1d701d8df3fc0be8c2631c809fb68698f`，開始時工作目錄乾淨。依使用者「先提交與推送，再繼續 TODO」指示，先將第 1 輪文件提交為此提交並核對遠端 main，再開始本輪。瀏覽器工作為 18:06–18:50，其後完成證據複核與文件。

**本輪新增多個有效通過子項，沒有確認新的產品缺陷；BR-01 固定矩陣仍未取得完整通過。** 第 1 輪已通過的 Auto 1／2 倍核心 15／30／15 秒、正常播放、12 秒延遲、wrapper 拖曳及影音隔離沿用原證據，不重跑。XHR 的 P01 子集另列，不增加 BR-01 的完成門檻。

現行方案見 [IAB_TESTING](../../../docs/IAB_TESTING.md)，累計工作狀態見 [TODO](../../../docs/TODO.md)，前輪結果見 [第 1 輪報告](IAB_v2.1.20_BR01_R1_2026-10-11.md)。本輪沒有修改正式來源、測試套件、版本或 Release，也沒有建立排程。

## 1. 身分與範圍

| 項目 | 證據 |
| --- | --- |
| 唯一環境 | Codex 內建瀏覽器，工具回報 `type=iab`；Tampermonkey 5.5.1 |
| 實際安裝 | v2.1.20；兩次文件實例均找到完整 Release 腳本內容，Runtime／ControlCenter 各 1 個 |
| 完整 Release 檔案 SHA-256 | `b8e5bd4744737537f348fcc7d9fb9f258fd41bc5e60327e5f4259560dcd5b54e` |
| 雜湊邊界 | 上列為完整 `.user.js` 檔案；Tampermonkey 執行包裝另記於 BASELINE，不與前輪去除外包裝的本體雜湊混用 |
| 網站 | 僅[指定風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，Auto 1／2 倍分開；沒有切片、鎖畫質、修改瀏覽器設定或停用其他腳本 |
| 主範圍 | E04／B07、B02／B03、B06／B08 的缺口；S02 特殊輸入另做一次能力校準 |
| 獨立產品範圍 | P01 的 Blob／failed open／本地終止子集；P02–P05 未執行 |
| 本機證據 | `.work/iab-testing/2026-10-11-v2.1.20-24dcdfd-r2/`，不作正式測試輸入、不公開原始網路資料 |

網站故障只攔截目前 Vault 中已授權的精確 video 路徑，audio 通行。首次只涵蓋單一表示的窗口因 Auto 換表示而失效；後續改為同內容目前合法 video 表示集合，保留原始無效紀錄。每窗使用新單一 Fetch／Network 游標，受控工作 ID 在提交前抑制學習寫入。

## 2. 新 seek 與 inner 拖曳

下表時間從「新操作後已保存的第一個採樣」計算，並非宣稱讀到控制器的精確起點。毫秒邊界仍由前輪 S01 證明；現場監控按既有一秒週期執行。

| 子項 | 使用者修訂 | 新操作後第一次 video 備援 | 判定 |
| --- | --- | --- | --- |
| B02 播放器焦點，1 倍 Right | 8→9 | 16.884 秒 | 新身分及新 15 秒寬限通過；無腳本位置還原 |
| B02 播放器焦點，2 倍 Left | 4→5 | 16.342 秒 | 新身分及新 15 秒寬限通過；無腳本位置還原 |
| B02 第二次滑鼠 seek，1 倍 | 7→8 | 15.315 秒 | 第二次目標取代第一次，寬限重新計算 |
| B02 第二次滑鼠 seek，2 倍 | 2→3 | 15.304 秒 | 第二次目標取代第一次，寬限重新計算 |

每窗都先建立停滯，再於約第 8 秒執行新操作；各有一次備援、零腳本恢復副作用。前輪 BODY 鍵盤結果保留。這四窗不擴大為「每種新操作之後都完成 30 秒重載期限」：1 倍播放器窗口被網站換核心撤銷，其餘在新備援證據取得後解除故障。

| B03 子項 | 實際結果 | 判定邊界 |
| --- | --- | --- |
| inner，1 倍 | 故障中按住 32.095 秒；dragging 持續為 true，無監控備援／核心意圖／重載 | 長按保護通過 |
| inner，2 倍 | 故障中按住 32.114 秒；無監控備援／核心意圖／重載，放開後 dragging=false | 長按保護通過；網站途中換核心並暫停 |
| inner 釋放，1 倍 | 使用最新位置；釋放後 15.840 秒第一次備援 | 新 15 秒寬限通過 |
| inner 釋放後完整期限 | 1 倍後續觀察有 Network 截斷；2 倍已由網站暫停 | 兩者不能算完整釋放後 30 秒期限通過 |

證據：`B02-*.json`、`B03-inner-1x.json`、`B03-inner-2x.json`。後續有缺口的尾端另存 `B03-inner-1x-tail-invalid.json`，不把兩份窗口拼接成完整通過。

## 3. 真正 SDK 呼叫後的新操作

這兩窗使用真正的 PlayerAdapter／網站 SDK 方法，只延後工具自有的 Promise 回傳邊界；不是自然 SDK 拒絕。原方法的 receiver、參數與同步例外保持，清理按描述子及包裝所有權執行。

| B06，Auto 2 倍 | 因果順序 | 結果 |
| --- | --- | --- |
| reload 後暫停，再晚到拒絕 | 實際 reload → 合法新核心初始化 → 實際 setRate／play → 可信 Space，userRevision 20→21 → `ownership-ended` → 自有 reload Promise 拒絕 | 舊 token 釋放；新操作後零恢復副作用，沒有晚到還原或再播放 |
| play 後新 seek，再晚到拒絕 | 實際 reload／setRate／play → 可信 Right，目標 941→946、userRevision 11→12 → `ownership-ended` → 自有 play Promise 拒絕 | 新目標保留；新操作後零恢復副作用，舊意圖沒有復活 |

第一窗新操作後 624 ms、第二窗後 834 ms 觀察到舊 token 結束；它們是現場採樣時間差，不是新的產品期限。第二窗的原生 play Promise 最後也實際完成，與工具自有拒絕分開記錄。

1 倍仍未取得相同 SDK 前提：網站先自行替換核心，腳本 reload／play 計數為 0，因此該窗口作廢，沒有為了取得呼叫而強制媒體狀態或重設額度。拖曳／倍速、晚到成功等完整交叉組合尚未逐項取得安裝證據，前輪 S03 的 74 案來源模型不能替代它們。

證據：`B06-reload-new-space-late-reject-2x.json`、`B06-play-new-seek-late-reject-2x.json`；無效 1 倍窗口為 `B06-reload-resolve-play-reject-new-seek-1x.json`。

## 4. 等待中政策撤銷

| B08 子項 | 變更前 | 變更後及持續觀察 |
| --- | --- | --- |
| 1 倍原線對照 | 恢復意圖正在等待，政策修訂 1 | 既有命令開啟對照後修訂 2、recovering=false；再跨 3.624 秒無恢復副作用；精確復原對照=false |
| 2 倍整體停用 | 恢復意圖正在等待，generation 1、政策修訂 3 | 既有命令停用後 generation 2、修訂 4、recovering=false；再跨 3.529 秒無恢復副作用；精確復原 disabled=false |

**等待中撤銷的命令契約通過，UI 點擊未被測到。** 沒有繞過工具對封閉 Shadow DOM 點擊的限制。前輪音訊 9 次 fallback 的影片隔離及有效 video 救援結果仍各自保留。

證據：`B08-pending-comparison-1x.json`、`B08-pending-disable-2x.json`。沒有用 reset／clear 清空學習，沒有手動重設控制器或起播預算；生命週期改變是產品命令本身的預期效果。

## 5. P01：獨立 XHR 子集 24／24

實際安裝 hook 與自有空白 iframe 的原生 XHR 比較，iframe scripts=0、open／send 與安裝 hook 不同。資源為本機 Blob；HTTPDNS 本地拒絕案例先設精確 Request 攔截，涵蓋 XHR／Fetch resourceType。

| 案例 | 數量 |
| --- | --- |
| 原生及安裝版 Blob：default／text／json | 6 |
| 已 send 後 failed open：method、禁止 method、URL、參數轉換例外 | 8 |
| 已完成後 failed open | 2 |
| 非同步選項與請求重用 | 2 |
| 本地拒絕中 queued／DONE／readystatechange／error 的 failed open | 4 |
| error 內成功 reopen；failed open 後第二次 send | 2 |
| 合計 | **24 通過、0 失敗** |

正確契約包括原例外／物件身分、原請求單次終止、文字／JSON、DONE 空回應、事件順序與新請求所有權。HTTPDNS 請求未到達送出前攔截層，沒有外送；未使用真 CDN 探測作對照。

第一趟 24 斷言雖通過，Network 有截斷，因此不計完整傳輸窗口。改成執行後立即持續排空游標，第二趟 24／24、`truncated=false`、防外送攔截命中 0。兩份紀錄都保留，並非為湊次數重跑。

這不是整個 P01 結案：真 pending gate 中的 bounded prepare、同步限制及實際 timeout 等完整交錯仍未在本輪完成。P02–P05 也未執行，沒有與 BR-01 合併。

## 6. 作廢前提與未執行項目

| ID | 終局狀態與具體原因 | 可重新執行的必要條件 |
| --- | --- | --- |
| E04／B07 | 事件驅動控制頁容量 200、dropped=0；開第二頁及 `Page.bringToFront` 後兩頁仍原生 hidden=false。開啟面板要求只回傳 queued；E04 無效，B07 未執行 | 取得能證明控制頁 false→true→false 的實際分頁切換；不以隱藏面板替代 |
| S02 原生 repeat | 自有按鈕取得焦點後長按 900 ms，只有一次可信 keydown／keyup，repeat=false | 工具能產生真正自動重複事件；一般長按時長不能代替 |
| S02／B03 pointercancel | 已知 raw touch／key 能力仍不可用，本輪不重複同一被拒命令 | 新的可信取消輸入能力；合成事件不得補算 |
| B02 新操作後完整 30 秒期限 | 四窗新身分／15 秒證據有效；沒有每種操作的完整 30 秒窗口 | 相同新操作後持續合法停滯且沒有網站先行撤銷 |
| B03 釋放後全部期限 | 1 倍尾端截斷、2 倍網站暫停；原窗口保護結果仍有效 | 釋放後保持合法停滯及連續事件觀察 |
| B06 全組合 | 2 倍上述兩組通過；1 倍 SDK 前提無效，其餘拖曳／倍速／晚到成功組合未完成 | 真正方法已呼叫且新操作仍可用，不強制網站狀態 |
| B08 UI | 命令與 pending token 交錯已通過；UI 點擊不支援 | 能操作既有封閉 Shadow DOM 控制中心的工具能力 |
| P01 其餘、P02–P05 | 沒有宣稱執行或通過 | 依獨立產品矩陣建立各自前提，不能向同片注入不同 cid 或重設 gate |

沒有把上述缺口當作產品 FAIL，也沒有把它們填成 PASS。原 87.785 秒自然網路起因仍獨立未證實，本輪未新增自然事件調查。

## 7. 清理、複核與重跑入口

- 所有有效故障窗最後 held=0、patterns=0、pending 空，沒有 Network／觀察器截斷或丟棄，受控記憶體／持久樣本匹配為 0。
- 第一個安裝分頁在最後有效窗口清理後從工具清單消失；當時 held／patterns／pending 為 0，429 個 request ID 的樣本匹配為 0。沒有觀察到逐一 dispose，保留這個歷史缺口。下一案例尚未開始；重新開啟仍是同一指定影片並重新核對完整身分。
- 第二個實例最後抑制了 753 個 request、1 個 challenge 工作 ID，startup=0；持久／記憶體匹配均為 0。故障解除後停止納入新 ID，待 pending=0、量測 waiting、原生 play Promise 完成，才移除抑制與觀察器。
- 第二個實例六個方法均按原描述子／所有權還原，繼承方法的自有遮蔽已移除；訂閱與 250 ms 採樣 timer 清理。額外的一次 play 包裝也已還原。
- P01 的 24 個請求、事件監聽、timeout、Blob 與原生 iframe 均清理，工具全域屬性刪除；精確攔截清空。自有背景控制頁已移除監聽並關閉，Debugger 沒有殘留斷點。
- 原線對照及停用值皆為 false；最後是 Auto 2 倍、paused=false、recovering=false，有持續時間／影格進度。之後關閉自有影片分頁，IAB 清單為空。前輪錯誤頁也已確認不存在。
- loopback 服務經 PID／命令列核對後停止。`CLEANUP.json`、`SESSION1-INTERRUPTION.json` 保存終端結果及限制；畫面在本機 `screenshots/final-auto2.png`。
- **14 個證據一致性斷言全部通過**；它們複核本輪保存資料，並非 14 個新增正式產品測試。本輪沒有重跑完整 npm、verify、安全掃描或封裝。
- 五份本輪文件的 GFM／Markdown 檢查通過：21 個表格、136 個儲存庫連結／錨點、證據引用全部有效；`git diff --check` 通過，正式來源與 Release 無差異。

本機重算證據及文件：

```powershell
node .work/iab-testing/2026-10-11-v2.1.20-24dcdfd-r2/audit-evidence.mjs
node .work/iab-testing/2026-10-11-v2.1.20-24dcdfd-r2/check-docs.mjs
git diff --check
```

`CASES.json` 保存具名子項與有效性，`RERUN.md` 保存操作及清理順序。命令不會重新操控瀏覽器；實際重跑必須重新取得當前分頁及唯一實例，不能復用歷史 handle。沒有新的前提時停止相同無效窗口，不自動開下一輪。
