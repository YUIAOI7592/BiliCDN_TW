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

## 本機封裝與重建

- `node --check`、來源語法、重複建置一致與正式檔對應均通過。
- incremental／cumulative patch 均實際套用並產出相同 userscript；SHA 清單核對通過。
- 只靠 Git 追蹤檔案的乾淨本機 checkout，經 `npm ci` 及完整 verify 通過。
- PowerShell／sh 兩套入口均通過同一 Node verifier。
- 40 個建置來源雜湊吻合；公開相對文件連結有效，沒有追蹤個人診斷、raw 安全資料、archive、development、dist、node_modules 或 CI workflow。
- userscript SHA-256：`13ce7885b469ab9c9a07a399045d1d6094579ff0f3e9133704ba59cb88e17b91`。

## 正式安全流程與發布暫停

Codex Security scan `6691213c-80bd-4019-8598-c5ef4b605b4d` 已完成封存，可回報 findings 為 0；**正式 coverage 仍為 partial**。工具保留兩筆先前的進行中檢查點，與 47／47 已完成檔案審查工作紀錄不一致。詳見 [公開安全摘要](../../docs/SECURITY_REVIEW_v1.6.0.md)。

固定掃描 range：`5a8acc93a36aa05cd14d6758694c992134e136bb` → `48536c624398a722c46f3f9986ba79f4b21a64e9`。最後文件／校驗清單更新不改已審 userscript、來源或建置工具。

本版保留為本機候選，不以 VM 子集替代正式 coverage，也不修改 sealed 報告。尚未推送 main、建立 v1.6.0 標籤或自動安裝。

## 驗收界線

自動測試為 Node VM／mock 或靜態／建置檢查，不是真實 Chrome／Tampermonkey／Bilibili／RTX 5080 驗證。仍須實測 1080p／4K 2x、seek、切畫質、SPA、背景切回及控制中心，不自動安裝。

不改算法、不保證最高速度變快。probe 計入 bytes 有上限，但瀏覽器緩衝／跨額度 chunk 可能有額外 wire bytes，不宣稱絕對零超收。
