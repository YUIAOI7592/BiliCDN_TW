<a name="bilicdn_tw-v2121-release-verification--2026-10-11"></a>

# BiliCDN_TW v2.1.21 BR-10 驗證報告

日期：2026-10-11～12（台北時間）。基準 v2.1.20／`55ae4b0`，開始時乾淨。本版修復控制中心 Enter／Space 被頁面快捷鍵取消；不新增焦點循環、不更改 API／設定／schema 2。詳見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR10_FIX_REPORT.md)。

## 正式與來源驗證

| 層級 | 結果 |
| --- | --- |
| 未改執行期的正確契約 | 9 pass／2 fail；兩個正常按鍵對照通過、兩個頁面干擾案失敗 |
| 修復後 control-center | 17／17，新增 10 案、保留原 7 案 |
| npm test | 19 套件、788／788，無 fail／skip／todo／cancelled |
| typecheck／architecture | 通過；44 個執行期模組，無循環 |
| 最終 npm run verify | 通過，退出 0；確定性建置、語法、v2-only 與暫存封裝校驗通過 |
| 獨立 Codex Security 差異 | 完成，2／2 表面、0 候選／0 發現；與 verify 分開 |
| IAB 自有頁 | Enter／Space 正常及外部冒泡快捷鍵對照 4／4 通過 |
| IAB 指定影片來源 UI | Enter／Space 2／2 通過，焦點保持控制中心、沒有正式設定寫入 |

工具為 Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。證據與重跑入口在 `.work/functional-fixes/br10/2026-10-11-55ae4b0/`。來源 UI 只接記憶體依賴，控制器未啟動；兩個驗證分頁的 listener／timer 已清理並關閉。

## 安全與限制

掃描 `b73a3463-a58f-47ec-8eba-c1b79bfe5b93` 於 `2026-10-11T15:23:21.723484Z` 封存，涵蓋 UI 與正式測試差異。可信事件、命令權限、同步重入、清理與輸出沒有可報告發現。Windows 指南解析問題以直接讀取 SECURITY.md 補足。後續文件／版本／封裝不冒充該不可變掃描內容。

ShadowRoot 冒泡隔離不能撤銷外層 capture 已做的取消；本輪指定影片的實際事件環境通過，不能推論所有第三方 capture handler。Node 事件模型不代替原生輸入；來源驗證不代替實際安裝。

## 發布與安裝

v2.1.21 已於 `2026-10-11T15:33:58Z` [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.21)。發布時 main 與 peeled tag 均為 `6f843536103b191d322d0b515bf4e700430b3fff`，tag ref 為 `35603a6d221ec394d03b7f3fd86dee639e12f870`。唯一附件 `BiliCDN_TW.user.js` 為 337,000 bytes，SHA-256 `09b1c36fd9f8da578189fd5360481127552f4277585ede83e00aa526c344884b`。15:34:29Z 未帶憑證的公開 latest 版本、大小與 SHA-256 均一致；證據為 RELEASE_IDENTITY.json。Release 快照保留封裝時狀態，不回寫發布後紀錄。

代理已在內建瀏覽器開啟公開更新網址，後續新指定影片文件載入 Tampermonkey 5.5.1／腳本 v2.1.21；撤回先前「必須手動更新」判斷。完整執行來源 333,559 字元，IIFE 330,750 字元，SHA-256 `e35ddb7f73a38d495c01e7f02736f3787bfc177165eadfb7e5e349c2ede1eb22` 與 Release 同段一致，RuntimeController／ControlCenter 各一個實例。

| 新版安裝子項 | 結果 |
| --- | --- |
| BR-10 Auto 1／2 倍 Enter／Space | 4／4 通過；設定頁正常開啟，焦點留在控制中心 |
| P04 關閉／切頁後完成 | 2／2 通過；真實 UI／命令只延後回傳，舊回呼未重開或覆蓋視圖，設定及命令包裝已復原 |
| P05 完整報告 | 通過；80,653 字元與當次結果相同，10 個 readModel 欄位完整；probe／reload／學習及儲存寫入觀察均為 0，已列敏感模式未命中 |
| P05 複製 | 驗證未通過；原生啟動後工具讀到空內容，進一步 GM／原生剪貼簿校準逾時，未確認產品根因 |

實際安裝共 7 個上述通過案例；複製未計通過。`show()`／focus 與倍速、暫停屬準備，命令由原生按鍵啟動，不冒稱滑鼠入口或播放驗收。P04 僅改 fixedHost 並復原 null，其他設定欄位核對不變（updatedAt 除外）。剪貼簿空文字已復原，但空項目集合的原始表示未能由工具精確重建。自有兩個分頁已明確關閉、IAB 清單為空、loopback 31993 已停止；剩餘觀察包裝隨文件銷毀，不宣稱逐一原位還原。

安裝證據為工具返回觀察的摘要，完整本體及安裝截圖匯出逾時未列為產物。只在剪貼簿通道校準成功後重跑 P05 複製一次；已通過子項不重測。本輪 UI 安裝矩陣未全部通過，具體事件與清理見修復報告。

## 2026-10-12 P05 讀回通道調查

基準 v2.1.21／`99dd071`，開始時工作目錄乾淨。只做環境校準，不重跑上述安裝案例。自有頁的 61 字元中文多行文字經真正 Ctrl+C／Ctrl+V 完整相符，IAB 剪貼簿 API 也逐字相符；隔離層外 PowerShell `Get-Clipboard -Raw` 在 5,057 ms／47 次讀取中仍得到原本 3 字元文字，Windows 序號維持 557。這是本輪共同讀回通道不成立的證據，不是 P05 產品缺陷；隔離層內的空讀值另因原生剪貼簿存取被拒而無效。

依停止條件沒有執行實際「複製報告」、重新取得安裝身分或修改執行期；產品成敗無新判定。Windows 原文字及七種格式確認未變，保存程序與服務已停止。IAB 原剪貼簿沒有可復原備份，保留合成文字；校準頁已關閉，錯誤頁因 URL 政策不能顯式關閉，只能由回合自動清理，未補算清理通過。版本維持 v2.1.21，沒有封裝或新 Release。本次只執行文件檢查，不產生新的 Node／安全／安裝通過數；完整證據與再開條件見 [調查報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_CHANNEL_REPORT_2026-10-12.md)。

BR-01 依使用者決定保持跳過。其他已通過結果沿用，沒有新前提的 P01／P02 不重跑；目前範圍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 2026-10-12 P05 IAB 真正貼上與讀回

基準 `99b3308`、v2.1.21，開始時乾淨。使用者改採 IAB 讀回門檻後，完整保存原項目及格式，64 字元合成文字的真正複製／貼上與 API 逐字相符，快照復原及原內容真正貼上確認通過。重新取得完整 v2.1.21 本體、Tampermonkey 5.5.1 與唯一 RuntimeController／ControlCenter 身分；沒有重測既有通過項目。

**實際 P05 不通過：** 真實 UI 的可信複製事件後，當次完整報告 18,150 字元，而 IAB API 及真正 Ctrl+V 均為原文字 61 字元，全文不符。另行批准的單次 GM 純文字校準正常返回並收到完成回呼，原生 Clipboard API、工具讀回及貼上仍未變。不能把完成通知當成成功，也沒有證據支持只補格式能修復；產品根因仍未定位。

原剪貼簿完整保留、原內容只留記憶體，兩個自有分頁及 loopback 31995 已清理，Debugger／觀察器釋放。沒有產品、正式測試、設定、版本或 Release 修改；本次只新增瀏覽器證據及文件檢查，不重跑自動契約或安全掃描。BR-01 保持跳過，沒有新前提時不重複同樣窗口。全文比較、來源位置、工具限制及續查條件見 [本輪報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/P05_COPY_IAB_RESULT_2026-10-12.md)。

<a name="bilicdn_tw-v2120-release-verification--2026-10-11"></a>
<a name="歷史驗證導覽"></a>

## 歷史導覽

- [v2.1.20 完整原報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2120-release-verification--2026-10-11)
- [BR-10 原始調查](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/IAB_v2.1.20_BR10_CONTROL_CENTER_KEYBOARD.md)
- [更早完整驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)
