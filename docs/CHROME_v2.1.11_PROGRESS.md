# v2.1.11 Chrome／Tampermonkey 中途報告 — 2026-10-10

**後續導覽：使用者另立新目標後，03:02–03:36 的 BR-01 與剩餘驗收已另存 [續測報告](CHROME_v2.1.11_REMAINING_ACCEPTANCE.md)，並确认 [BR-05](CHROME_v2.1.11_BR05_FETCH_ABORT_REASON.md)。** 本文保留原中途停下與 BR-04 追加的觀察；下文「paused／未執行」只描述各段時間點，不是現行目標狀態。

**續測更新：2026-10-10 02:58（Asia/Taipei）已在真正 Chrome 155／安裝版確認 BR-04。** 使用者批准續測後，以真 gate／原生及正常對照完成複核，已交付 [詳細缺陷報告](CHROME_v2.1.11_BR04_XHR_REENTRANT_PREPARE.md)，達成找問題並報告的替代完成條件。未修復、完整驗收未完成；下方保留原中途暫停紀錄。

**依使用者要求暫停，目標為 `paused`，整體驗收未完成。** 本輪自主測試約 45 分鐘（Asia/Taipei 01:57–02:42）；停止後只保存證據、清理觀察資源及整理報告。正式來源、正式測試及 Release 產物未修改。

## 基準

- 提交：`f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e`，開始時工作目錄乾淨。
- 實際安裝：Tampermonkey **5.5.1**、BiliCDN_TW **2.1.11**；執行中的腳本內容與正式產物一致，SHA-256：`9b84b4702d3c272d59f85421fa65a6a2401be59cad7790392318ff4e87bf99b9`。
- 網站僅使用指定[風景影片](https://www.bilibili.com/video/BV1tFZZBQE57/)，沒有切換影片、修改 Chrome 設定或停用其他腳本。
- 本機證據目錄：`.work/chrome-v2.1.11/2026-10-10/`。安裝版瀏覽器結果與 `br04/` 的獨立 Node 契約分開保存；原始失敗／作廢輪保留。
- 發行前 382 個正式案例及安全差異審查是既有發行證據；本輪未重跑完整自動驗證或安全掃描。

## 結果

| 範圍 | 本輪結果 | 證據／限制 |
| --- | --- | --- |
| 安裝版本 | 實際載入 2.1.11，產物一致 | `installed-version.json`、`handler-version.json` |
| BR-03 安裝版 | **31 個有效案例全部通過** | `br03-installed.json`；另 4 次工具錯誤排除，不混算產品結果 |
| BR-02 安裝版／原生 XHR 對照 | **42／42 通過** | `br02-extended-installed.json`；不涵蓋下述新增巢狀交錯 |
| 真正 startup gate | 觸發 3 候選 running／delayed；取得 failed open 後 abort、成功 reopen 及單次同步失敗恢復證據 | `startup-gate-installed.json`；全矩陣未完成 |
| R04 音訊故障 | 真實 audio fallback 未建立影片恢復意圖，Recovery 前後一致 | `r04-audio-and-discarded-video.json`；受控送出前故障 |
| R04 影片正向對照 | 真實 video fallback 將 Recovery 轉為 `play-intent` | `r04-video-positive.json`；不代表核心重載完成或全部恢復情境通過 |
| 同片畫質 | 分開操作 4K→1080P→4K，解碼尺寸及影格前進符合切換，epoch 維持 0 | `website-quality.json`；包含舊緩衝過渡 |
| 同片 seek | 網站 `window.player.seek(1200)` 約 **2.041 秒**完成並續播 | `website-seek.json`；控制項隱藏使滑鼠點擊受阻，此結果不能算指標操作驗收 |
| BR-01 | 短程分步對照未重現原 87.8 秒停滯 | **維持待定位**，不能據短程正常結案 |

BR-03 涵蓋排列、相同 cid 完全換組、不同 cid 共用路徑、首次綁定／缺失、子集往返、協定相對 URL、簽名變動、影片／純音訊、20 位精度、無效首項、音訊授權、Fetch 單次轉換、XHR failed open／成功重入／重複 getter 及診斷／持久隱私。4 次排除是超長 cid 前提、兩次物件鍵序比較、一次注入函式讀不到腳本詞法作用域的 GM_info；更正後對應有效案例通過。

BR-02 對照包含 method／URL 例外、參數轉換、opened／sent／done、同步回呼 send／abort／reopen、終止事件重入、text／json 及本地政策拒絕。合成 API 於送出前控制；HTTPDNS 精確攔截先安裝，成功輪未出現 HTTPDNS 外送。

## 新增 BR-04（暫定）：同步回呼再次使內部重新 open 失效

**獨立 Node 契約已重現，Chrome 安裝版複核尚未執行，不能列為已確認的 Chrome 缺陷。** 可能影響等待 gate 的 XHR：網站捕捉例外後，原請求不送出且缺少終止事件，非同步鏈產生未處理拒絕。觸發前提特定，未證明是 BR-01 原因。

1. 非同步 JSON XHR 送出後等待 startup gate。
2. 不符合 Window 同步限制的 `open(..., false)` 拋 `InvalidAccessError`，原生變 UNSENT；攔截保留舊 metadata 並標記 `needsNativeOpen`。
3. gate 完成，內部原生 `open()` 重新準備並同步觸發 `readystatechange`。
4. 回呼再次嘗試同步 `open()` 並捕捉同類例外，原生再次變 UNSENT，metadata 仍屬原等待請求。
5. 外層僅檢查 metadata 身分及 phase，清除 `needsNativeOpen`；原生 `send()` 隨後拋 `InvalidStateError`。

位置：[xhr-hook.ts](../src-v2/adapters/xhr-hook.ts) 第 112 行標記失敗後重新準備；第 130–135 行內部 reopen 未辨識同步重入後原生準備失效；第 216 行送出、第 221 行 gate Promise 鏈未處理該 throw。

契約沿用現有 NativeXhr 情境與測試執行器，沒有修改正式登記。正常對照「內部回呼內 SyntaxError」通過；問題契約要求原等待請求送出一次，實際 **0 次，`0 !== 1`**，另記錄 `InvalidStateError: send invalid state` 的未處理拒絕。結果 **1 通過／1 失敗、exit 1**，是調查失敗證據，不是正式套件結果。

根目錄重跑：

```powershell
node .work/chrome-v2.1.11/2026-10-10/br04/rerun.mjs
```

契約為 `br04/repro.ts`，結果為 `br04/node-result.json`。下一步先以真正 Chrome／安裝版校準同一原生狀態與事件序列，再決定修復。可能方向是同步重入後重查原生準備有效性及處理 gate 回呼例外，不得以無上限 reopen 重試掩蓋失效。本輪沒有實作。

## 清理及限制

- 最終觀察與截圖已保存，250ms 觀察計時器及監聽器已清理。測試 XHR 已中止、R04 訂閱及 instance 證據方法已還原，Debugger 與請求攔截不再作用。
- 一個 gate 合成失敗樣本曾進入 EvidenceStore；在鎖內依本輪唯一 request ID 移除，保留原樣本並驗證該 ID 不再存在。相關 circuit 恢復為 0；測試前 cooldown 無完整快照，不能宣稱學習狀態逐位元還原。後續 R04 過濾本輪樣本，未清空學習資料。
- R04 一輪事件截斷及一個已失去精確授權的影片 URL 作廢，不作通過或無外送證據。有效影片對照使用當時 Vault 精確授權。
- gate 首次工具等待逾時是事件泵未處理晚到請求；完成後取得結果，不列為產品逾時。
- 自然播放後曾降為 1080P，缺少乾淨因果對照，未新增確認問題或結案 BR-01。
- 真換片／SPA、背景切換、核心替換／重載拒絕／晚到 play、再次失敗、完整 gate／R04 矩陣未完成；本輪未新增完整暫停／續播驗收。

## 續行

已暫停，不安排自動續測。恢復時優先 Chrome 複核 BR-04，再續測 gate、播放器恢復及 R04 剩餘情境；BR-01 獨立定位。私有檢查點為 `.work/chrome-v2.1.11/2026-10-10/CHECKPOINT.md`；原發行／來源隔離證據見 [發行報告](TEST_REPORT.md) 與 [BR-03 修復報告](BR03_FIX_REPORT.md)。
