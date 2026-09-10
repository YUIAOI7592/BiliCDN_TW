# v1.6.0 公開安全摘要

依 2026-09-11 使用者指示，以候選版本公開 main；正式發布驗收尚未完成，不建立 v1.6.0 標籤。公開程式碼不代表正式安全 coverage 已完整。

範圍包含模組、建置工具、測試／正式入口隔離及來源／產物對應。CS-001～003 VM 子集不能替代正式流程。

## 2026-09-11 封存結果

- Scan ID：`6691213c-80bd-4019-8598-c5ef4b605b4d`。
- 固定 range：`5a8acc93a36aa05cd14d6758694c992134e136bb` → `48536c624398a722c46f3f9986ba79f4b21a64e9`。起點含正式 v1.5.5 的原 bytes fixture；不是將 v1.5.5 開發草稿當成基準。
- 工具執行狀態：`complete`；可回報 findings：0；正式 coverage：`partial`。
- 實際檔案工作紀錄為 47／47 主要 review items 完成，另核對 43 個測試、文件、metadata 與 patch 等變更路徑。三組非重疊子審查均未提出可回報候選。
- 封存 coverage 仍保留兩筆先前的 `needs_follow_up` 摘要：`Policy/UI/Worker and transport/playback`、`Runtime security boundary review`。提交完成狀態後舊列仍被保留；不能把這份報告稱為完整 coverage，亦不改寫 sealed 檔案。
- 這是審查工作紀錄與報告狀態不一致，並非已確認的腳本弱點；main 候選程式碼依使用者指示公開，正式版本標籤仍延後，待處理狀態後再決定後續掃描／發布。

已審腳本 SHA-256：`13ce7885b469ab9c9a07a399045d1d6094579ff0f3e9133704ba59cb88e17b91`。後續本次交接更新只涉及文件及校驗清單，不變更已審來源、建置工具或 userscript。

原始安全工作檔僅保留本機，不公開。VM、靜態及安全掃描都不能替代真實 Chrome／Tampermonkey／Bilibili／RTX 5080 播放。未獨立審核瀏覽器、Tampermonkey、Node 或 esbuild 平台執行檔內部。
