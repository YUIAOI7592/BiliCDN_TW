# v1.6.0

- 從正式 v1.5.5 抽離私有模組實例，不使用缺少最後修補的 development 草稿。
- esbuild 0.28.2 本機打包單一 userscript；設定仍可修改，無執行期依賴或自動更新網址。
- Worker 獨立打包、共用無狀態 URL 政策，移除函式 toString 組裝，仍預設 false。
- runtime／playback／transport／routing 分持 generation、epoch、請求終態與健康／處分；UI 只取得指定操作和狀態副本。
- 遞迴測試、固定樣本、共用 Node verify、可重現 manifest、兩份 patch 實際套用。
- 不改 2x／AV1、catalog、UCB／EWMA、Watchdog 門檻、GM 格式、timeout／冷卻／流量與 UI 操作。
- 無 CI/CD、GitHub Actions、自動發布／安裝、遙測或新增遠端程式。不承諾播放速度提升。

安全流程與實機界線見 TEST_REPORT。
