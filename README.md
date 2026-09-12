# BiliCDN_TW

> [!IMPORTANT]
> **原作者與原始腳本：** [jiyunshi－Bilibili CDN 台灣優化](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)。本儲存庫是在該 MIT 授權腳本基礎上製作的個人改版，並非原作者的官方版本。
>
> **AI 協作聲明：** 本個人改版的維護者不具程式撰寫能力；分析、修改、測試與文件主要由 AI 協助完成。自動測試與安全掃描不能取代真實瀏覽器驗證，使用前請理解相關限制與風險。

以 jiyunshi 的「Bilibili CDN 台灣優化」官方 v1.3.4 為基礎的個人修改版。重點是台灣線路的 CDN 選路、兩倍速播放穩定性與有界診斷，不保證任何節點或影片一定更快。

v1.6.0 將正式 v1.5.5 拆成 JavaScript 模組，再用 esbuild 打包為 **一份 Tampermonkey userscript**。v1.7.0 依實機觀察結果完整移除 Worker 攔截：3 次可見 constructor 全為安全放行的 Blob Worker，成功包裝、媒體請求與改寫皆為 0；網站自己的 Worker 現在完全交由瀏覽器處理。播放邏輯不變。

v1.8.0 新增每個 playinfo 專屬的 Native signed route pool，以及只保存 hostname 健康資料的評級 Ledger；該版存在健康播放時可能反覆換路的問題，已由 v1.8.1 取代。

v1.8.1 將 Native 評級與換線權限分離：健康播放中的 probe／bakeoff 只更新評級，不再改變下一筆請求。Route Affinity 只在新 playinfo、真實 Transport 失敗、Watchdog 已確認卡頓或可信固定／自動設定時改變；自動畫質／codec 預取不再被誤算為 CDN 切換。非 catalog 路線仍只能重用同一 representation 的 exact signed URL，不會取得 catalog、合成換 host、preconnect 或 forced redirect 權限。

主執行緒 Fetch／XHR、2x 假定、AV1、Watchdog 與 Worker 移除狀態維持不變。歷史安全狀態見 [公開安全摘要](docs/SECURITY_REVIEW_v1.6.0.md)。

## 安裝與操作

只需安裝 [BiliCDN_TW.user.js](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)，不需安裝 Node 或 esbuild。v1.6.1 起，Tampermonkey 只會從本儲存庫的最新正式 Release 檢查與下載更新。使用選單「⚙️ 開啟 BiliCDN 控制中心」。

v1.8.2 統一 Catalog／Native URL 決策，移除舊 Akamai 提升旁路；只有內嵌資料時，也能在 exact 影片請求成功後建立受限歸因與一次起播測速。內建 Catalog 不必出現在本片資料即可參賽；Native 資格不授予換 host 或 preconnect 權限。診斷分開計畫、實際觀察及來源提示。

v1.8.3 恢復 black／dead／soft、設定排除與預設不可用節點的禁止效力：原始、Native、Catalog、固定及備援都不是例外。候選耗盡不再自動清黑名單；沒有合法替代時本地阻止，不取消在途播放器請求。勾選啟用只解除設定層排除，仍須等待處分到期或明確維護解除。

v1.8.4 修正兩個實機發現的播放鏈問題：頁面 URL 被禁止規則改寫到 Catalog 後，成功的 Fetch／XHR 現在能正確建立 representation 與路由後態；Watchdog recovery 會持續約束後續相同 Native 請求，不再只增加切換計數卻繼續重打原 host。原始 Native URL不會因此被解鎖或取得測速權限。

v1.8.5 修正站內 SPA 換片後 `__playinfo__`、representation 與 route pool 失聯。即使初始頁面資料早於 userscript 存在，後續 setter 仍會被觀察；若新值在延遲 SPA reset 前同步出現，會延後到新 generation 重建。頁面直接替換 property 時，既有一秒狀態週期也會重新掛回，不增加網路或額外 timer。

v1.8.6 補齊 playinfo 在 history 前出現的 SPA 時序，修正已緩衝到結尾的短片被 Watchdog 誤判卡頓，並在播放器設定面板加入「⚙️ 開啟 BiliCDN 控制中心」。按鈕只開啟現有的私有對話框，不會因瀏覽介面新增網路行為。

v1.8.7 修正真實 SPA 中「新影片 playurl 先發出、history 後切換、回應最後完成」時被 generation 隔離誤丟棄的問題。只有緊鄰這次 SPA 且請求中的影片識別與目前頁面精確相符時才接納；其他舊片與無法確認的多 P 回應仍維持隔離。

本版不執行 Code Security 掃描，功能驗證與限制見 [TEST_REPORT](Release/v1.8.7/TEST_REPORT_v1.8.7.md)。自動結果不能替代 Chrome／Tampermonkey 實機驗收；更新後應以站內推薦連續換片、自動畫質＋2x、短片結尾、背景切回與面板按鈕驗收。

## 本機開發

驗收工具鏈：Node **26.8.1**、npm **11.19.0**、esbuild **0.28.2**。

```sh
npm ci
npm run build
npm test
npm run package
npm run verify
```

build 建立 dist；test 先重建再跑功能回歸；package 在本機產生 userscript、來源清單、雙 patch 與 SHA；verify 驗證正式產物、功能回歸及實際 patch 套用，不啟動安全掃描／獨立 CS 子集。兩套 verify shell 使用共同 Node 邏輯。

**沒有 CI/CD、GitHub Actions、自動發布、遙測或執行期套件依賴。** esbuild 只是本機工具。

## 文件與歸屬

- [架構](docs/ARCHITECTURE.md)、[開發與發布](docs/DEVELOPMENT.md)、[測試](tests/README.md)
- [安全政策](SECURITY.md)、[公開安全摘要](docs/SECURITY_REVIEW_v1.6.0.md)
- [上游來源與雜湊](UPSTREAM_MANIFEST.md)、[MIT](LICENSE)、[建置工具授權](docs/THIRD_PARTY_NOTICES.md)

只公開必要固定程式碼樣本，不公開個人診斷、原始安全工作檔、完整封存、舊草稿或暫存；樣本不是使用者瀏覽紀錄。
