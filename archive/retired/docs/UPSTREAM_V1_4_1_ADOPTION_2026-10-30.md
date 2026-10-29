# UP141 上游優點吸收候選與驗證 — 2026-10-30

本輪依使用者 2026-10-29 批准的計畫實作，跨日繼續。正式版本仍為 v2.1.36；本報告描述候選分支，不代表正式採用。現行狀態只看 [TODO](../../../docs/TODO.md#up141-本輪範圍與期限)，固定輸入見 [來源比較](UPSTREAM_V1_4_1_COMPARISON_2026-10-29.md)。

## 固定候選與實作

基準 21322e2d38e6f7e2c1f066abc22591d61afb1eb1；A 來源 be8dc3e23916b0b0fbe8f7a219b1e67efa2a0400，分支 codex/upstream-141-adoption。完整建置 SHA-256 為 47f2f130b31d4fa845c272721229052cd16085d0556d59d4cf41b79dc70a8656；候選沿用 2.1.36 metadata，須用完整本體區別正式版。

| 項目 | 紅色證據 | 綠色契約／行為 |
| --- | --- | --- |
| OGV | 初始 13 案中 11 失敗 | 新增 15 案；精確 HTTPS playview；precheck 原文通行，不讀 body、不變 Vault／epoch |
| Range | 初始 8 案中 7 失敗 | 13 案；有效 Content-Range、中段對齊、同輪範圍、Vault handle 所有權與 416 撤銷 |
| 起播 | 初始 4 案全失敗 | 4 案；Catalog-only 合格即釋放；固定情境由 3,000 ms 降至 500 ms；晚到不學習 |
| 備援 | 初始 7 案中 5 失敗 | 9 案；有成功證據且至少 1.35 倍需求才取得家族分散優先；最多五條 |
| 摘要 | 缺容量摘要；另發現原因碼及有限數相除溢位 | 15 案；按需、去敏、無新增週期工作，保護未知及非有限數值 |

三台 HK 候選只存在於原型並預設不可用，原四台不變。B 以固定 A 為基礎使用獨立分支 codex/upstream-141-early-retry，原型預設關閉，未取得完整門檻不合入正式版。

## 自動與安全結果

設定 Node 26.8.1 下，完整 npm test 及 npm run verify 通過，共 2,939 案，零略過／待實作／取消；包含型別、架構、封存、文件、決定性建置、語法及校驗。首次沙箱完整測試因暫存 Git config 寫入被拒而失敗；正常權限重跑通過，不算產品缺陷。

Codex Security 差異掃描 e7524c92-b87d-4130-bef1-e780815fd314 已完成，固定 21322e2..be8dc3e 的全部 30 個來源／測試檔案審閱完成，沒有可報告發現。正式產物由工作台保存；此來源安全結果不代表安裝功能或效能通過。

## IAB 第一輪

新窗口固定為 UP141-A-ID、INSTALL、OGV、START、RANGE、HK、DIAG、C01，沿用第一輪 120 分鐘及最後 15 分鐘清理；不恢復舊矩陣。

- IAB Runtime 唯讀及 Debugger 來源能力可用；讀出的已安裝完整正式本體為 439,664 bytes，SHA-256 3960ac923f1cbd61d197e1b713c2c0e620debfcb40df1111cfc5af7d8dab3ae7。觀察到一個面板及 XHR hook，但未將此結果當作候選安裝身分。
- 公開 latest 與本機候選入口都停在 Tampermonkey script_installation.php 中繼頁。分頁清單與應用程式 AX 未提供安裝控制；中繼頁不算安裝。
- 使用者指出須經 GitHub Release 才能更新，因此準備候選預發布版供安裝，不取代正式 latest。
- 候選完整安裝身分尚未成立，其餘功能窗口尚未執行。沒有故障注入、修改媒體 getter、重設控制器／預算或合成學習。

## 封存保護

舊搬移清單另存 [完整原始快照](../../../baseline/UP141_pre_adoption_relocation_2026-10-29.json)，486,831 bytes，SHA-256 e6cb070230b5ef58142161feeaeb7ce024e3d696138a5092c5ee722d28c1f5f6。unchangedFiles 從 154 筆僅移除本輪修改的 17 筆來源，保留 137 筆；其他 entries、雜湊、URL 編輯及既有日誌原樣保留。新快照已加 raw 保護與精確 Git attributes。

## 採用門檻

A1 須自然 OGV 換集；A2 須自然 gate 對照；HK 每台須兩片兩倍速探測與供片；B 須原生、受控、正常及自然對照全部達標。缺樣、INVALID、FAIL 與未執行分別記錄，不把來源通過換算成實機通過。
