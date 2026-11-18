# 上游與歷史來源

本文件維護來源歸屬、上游保存與 v1／v2 界線。現行來源為 `src-v2/`，下列版本化來源只作歷史基準；建置流程見[變更驗證 Skill](../.agents/skills/bilicdn-verify-change/references/runtime-and-commands.md#建置輸出)，授權與作者資訊見 [第三方聲明](THIRD_PARTY_NOTICES.md)。

## 來源歸屬基準

`baseline/BiliCDN_TW_1.3.4.original.user.js` 是不可變的上游來源歸屬基準。歷史 v1 Release 與標籤保留供調查使用。

SHA-256 清單為 [baseline/SHA256SUMS.txt](../baseline/SHA256SUMS.txt)，內容保留相對於儲存庫根目錄的路徑，須從根目錄進行校驗。

## 與 v2 的關係

### 後續上游保存

[原作者 v1.4.1 原件](../baseline/BiliCDN_TW_1.4.1.original.user.js) 固定於提交 `b32f949d216dc92cd1efa0b0d023f650b126fcb8`，保存日期 2026-10-29。完整來源、下載核對與比較身分見 [provenance](../baseline/BiliCDN_TW_1.4.1.provenance.json)，原始位元組校驗見 [獨立 SHA-256 清單](../baseline/BiliCDN_TW_1.4.1.SHA256SUMS.txt)。它是後續調查原件，不替換 v1.3.4 來源歸屬基準，也不匯入正式建置／測試。

版本化比較由 [HISTORY](HISTORY.md) 導覽，2026-10-29 結果見 [v1.4.1 與 v2.1.36 來源比較](../archive/retired/docs/UPSTREAM_V1_4_1_COMPARISON_2026-10-29.md)。

### v1.4.2 與 v2.2.23

[v1.4.2 原件](../baseline/BiliCDN_TW_1.4.2.original.user.js)固定於原作者提交 `182f9b2e1571dd2ddd662d8bc1f609ae83c1fde6`，與 Greasy Fork 發布檔逐位元組一致。[來源證明](../baseline/BiliCDN_TW_1.4.2.provenance.json)與[校驗清單](../baseline/BiliCDN_TW_1.4.2.SHA256SUMS.txt)分別保存來源與 SHA-256。對照基準為上游 v1.4.1 與本專案 v2.2.22 的 `0b8e25d`。 [原作者差異](https://github.com/jiyunshi/Bilibili-CDN-TW/compare/b32f949d216dc92cd1efa0b0d023f650b126fcb8...182f9b2e1571dd2ddd662d8bc1f609ae83c1fde6)

| 上游行為 | v2 差異與採用去向 |
| --- | --- |
| 語系前綴播放頁 | v2.2.22 缺少相應載入規則。v2.2.23 對四個已確認語系及三類播放頁加精確匹配，正規化等價導航。正式案例為 `UP142 built metadata covers the four supported locale prefixes on playback pages` 與 `UP142 locale navigation preserves the active part and distinguishes actual media changes`。 |
| 換片及晚補影片編號 | v2.2.22 的 URL 與 API 各自重設。v2.2.23 以已接納主 API 的請求身分及世代／週期限時配對，缺少可比對證據沿用保守重設。正式案例由 `UP142 navigation pairs accepted primary responses only when eligible` 及 `UP142 watchlater can complete the address of the accepted main video once` 驗證。 |
| 預載與懸停預覽 | v2.2.22 的預載可推進主片週期。v2.2.23 將輔助回應隔離在主片接納與 Vault 外。Native 交回網站內容，Catalog-only 以有界純輸出或安全拒絕處理。正式案例由 `UP142 native auxiliary Fetch and XHR preserve the main epoch and accepted watermark`、對應的 Catalog 案及全停用 Catalog 主機案驗證。 |
| 續播尋位與多分頁冷卻 | v2 依媒體請求認領起播窗口。尋位保護期間保留尚未使用的額度，由下一合格請求接手。兩個共享儲存的控制器對照確認健康冷卻繼續生效。正式案例為 `UP142 seek protection leaves the per-tab startup window for the next eligible request` 及 `UP142 seek and content reset preserve the shared health cooldown`。 |
| 換片診斷 | 上游擴充報告及主控台。v2 沿用控制中心三頁、當次唯讀快照及其資料邊界，證據以正式案例與版本報告追溯。 |

上述是固定來源對照與 v2 合成契約。原作者自己的安裝與實機驗證見[上游變更紀錄](https://raw.githubusercontent.com/jiyunshi/Bilibili-CDN-TW/182f9b2e1571dd2ddd662d8bc1f609ae83c1fde6/CHANGELOG.md)。

### v2 建置界線

v2 系列從 v2.0.0 的 TypeScript 架構重整開始；v1.9.6 僅作使用者可見不變量的行為參考。現行 v2 建置、正式契約測試及封裝不得匯入：

- v1 原始碼樹；
- v1 正式打包產物；
- v1 測試橋接介面或測試情境；
- 增量或累積修補產物。

沒有 v1 儲存遷移或執行期相容層；既有 v1 Tampermonkey 值既不讀取，也不刪除。

[獨立離線比較](../.agents/skills/bilicdn-offline-evaluation/references/models.md#原版與-v2-獨立比較)可在隔離模型載入雜湊固定的兩版完整腳本；它不屬正式 v2 套件，也不將歷史來源加入產品建置。比較結果只適用所列版本與模型。

## 第三方工具

工具用途與授權集中於 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)，精確依賴由 [package.json](../package.json) 與 [package-lock.json](../package-lock.json) 維護；Node 選擇及能力驗證見 [環境需求](../.agents/skills/bilicdn-verify-change/references/runtime-and-commands.md#環境需求)。發行使用者腳本為單一 IIFE，沒有執行期第三方依賴，封存來源不加入產品建置。
