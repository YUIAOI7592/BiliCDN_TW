# 待辦

## v1.6.0

- [x] 固定正式 v1.5.5、必要樣本與 SHA。
- [x] esbuild 0.28.2、私有模組實例、獨立 Worker 與共用 URL 政策。
- [x] 舊回歸、新增未插樁／實例測試及 250 秒資源比較。
- [ ] 雙 patch、乾淨 checkout、公開內容及正式 Codex Security 最終驗收。
- [ ] 驗收後手動推送 main 與 v1.6.0 標籤。
- [ ] 真實 Chrome／Tampermonkey 播放與控制中心驗收。

## 刻意延後

- 頻寬算法替換：目前需求不足，不與重構混做。
- 跨分頁 GM 原子協調、跨播放器辨識、Worker 跨 generation／host-lock 協定。
- Worker 去留／預設：需實際使用證據，目前 false。
- 不建構 CI/CD，不新增按鈕或圖表。
