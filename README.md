# BiliCDN_TW

> [!IMPORTANT]
> **原作者與原始腳本：** [jiyunshi－Bilibili CDN 台灣優化](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)。本儲存庫是在該 MIT 授權腳本基礎上製作的個人改版，並非原作者的官方版本。
>
> **AI 協作聲明：** 本個人改版的維護者不具程式撰寫能力；分析、修改、測試與文件主要由 AI 協助完成。自動測試與安全掃描不能取代真實瀏覽器驗證，使用前請理解相關限制與風險。

以 jiyunshi 的「Bilibili CDN 台灣優化」官方 v1.3.4 為基礎的個人修改版。重點是台灣線路的 CDN 選路、兩倍速播放穩定性與有界診斷，不保證任何節點或影片一定更快。

v1.6.0 將正式 v1.5.5 拆成 JavaScript 模組，再用 esbuild 打包為 **一份 Tampermonkey userscript**。v1.7.0 依實機觀察結果完整移除 Worker 攔截：3 次可見 constructor 全為安全放行的 Blob Worker，成功包裝、媒體請求與改寫皆為 0；網站自己的 Worker 現在完全交由瀏覽器處理。播放邏輯不變。

v1.8.0 新增每個 playinfo 專屬的 Native signed route pool，以及只保存 hostname 健康資料的評級 Ledger。非 catalog 路線可使用同一個 representation 內已取得的 exact signed URL 參與選路，但永遠不會取得 catalog、合成換 host、preconnect 或 forced redirect 權限。陌生節點只占用既有 bakeoff 四個名額中的一個，不提高測速流量、timeout 或冷卻。

主執行緒 Fetch／XHR、2x 假定、AV1、Watchdog 與 Worker 移除狀態維持不變。歷史安全狀態見 [公開安全摘要](docs/SECURITY_REVIEW_v1.6.0.md)。

## 安裝與操作

只需安裝 [BiliCDN_TW.user.js](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，不需安裝 Node 或 esbuild。v1.6.1 起，Tampermonkey 只會從本儲存庫的最新正式 Release 檢查與下載更新。使用選單「⚙️ 開啟 BiliCDN 控制中心」。

發布驗證與安全狀態以 [TEST_REPORT](Release/v1.8.0/TEST_REPORT_v1.8.0.md) 為準。VM 測試不等於 Chrome／Tampermonkey 實機驗證；仍需測試自動畫質、1080p／4K 2x、seek、畫質升降、SPA、背景切回、陌生節點探索與控制中心。

## 本機開發

驗收工具鏈：Node **26.8.1**、npm **11.19.0**、esbuild **0.28.2**。

```sh
npm ci
npm run build
npm test
npm run package
npm run verify
```

build 建立 dist；test 先重建再遞迴測試；package 在本機產生 userscript、來源清單、雙 patch 與 SHA；verify 驗證正式產物、全部測試、CS 子集及實際 patch 套用。兩套 scripts/verify shell 使用共同 Node 邏輯。

**沒有 CI/CD、GitHub Actions、自動發布、遙測或執行期套件依賴。** esbuild 只是本機工具。

## 文件與歸屬

- [架構](docs/ARCHITECTURE.md)、[開發與發布](docs/DEVELOPMENT.md)、[測試](tests/README.md)
- [安全政策](SECURITY.md)、[公開安全摘要](docs/SECURITY_REVIEW_v1.6.0.md)
- [上游來源與雜湊](UPSTREAM_MANIFEST.md)、[MIT](LICENSE)、[建置工具授權](docs/THIRD_PARTY_NOTICES.md)

只公開必要固定程式碼樣本，不公開個人診斷、原始安全工作檔、完整封存、舊草稿或暫存；樣本不是使用者瀏覽紀錄。
