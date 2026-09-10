# v1.6.0 候選驗證報告

## 基準與工具

來源：正式 v1.5.5，SHA-256 `fccf8ca10c9086b8edae3ba9b170b14ff5c92451ccd921c5834960e5624b441f`。官方 baseline、歷代 Release、archive、development 不覆寫。

Node 26.8.1、npm 11.19.0、esbuild 0.28.2，無其他直接開發依賴／執行期依賴。

## 模組抽離回歸

- 255／255 通過，0 失敗／skip：原有 230、新增 16、固定歷史 review 9。
- CS 子集 19 項包含在總數內，不另加總。
- timeout capability／128 KiB／3 秒／30 秒、重複 send、Watchdog 歸因／回收、Fetch 單 reader／cancel、host-lock、PCDN、XHR JSON、SPA／停用、2x／codec、診斷與可信 UI 回歸通過。
- 新增實例隔離、import 無副作用、正式 bundle 無測試介面、檔頭 Worker／HTTPDNS／codec 開關。
- 未插樁產物經 Fetch／XHR／選單／Worker 入口測試。healthy／seek／真實失敗三組 250 秒流程與 v1.5.5 的请求、probe 及 Range bytes 相同，Verbose 開／關均相同。

## 最終確認待辦

- 正式 Codex Security 差異掃描尚未完成，不能以 VM 子集替代。
- 最終 SHA、雙 patch 實際套用、乾淨 checkout 重建與公開內容核對待封裝後記錄。
- 完成前不推送版本標籤、不標為已完成驗收的正式發布。

## 驗收界線

自動測試為 Node VM／mock 或靜態／建置檢查，不是真實 Chrome／Tampermonkey／Bilibili／RTX 5080 驗證。仍須實測 1080p／4K 2x、seek、切畫質、SPA、背景切回及控制中心，不自動安裝。

不改算法、不保證最高速度變快。probe 計入 bytes 有上限，但瀏覽器緩衝／跨額度 chunk 可能有額外 wire bytes，不宣稱絕對零超收。
