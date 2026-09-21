# BiliCDN_TW

> [!IMPORTANT]
> **原作者與原始腳本：** [jiyunshi－Bilibili CDN 台灣優化](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)。本儲存庫源自原作者 MIT 授權腳本的個人修改專案；v2 是以 TypeScript 重新設計與重構的版本，並非原作者的官方版本。
>
> **AI 協作聲明：** 本修改版的維護者本人不具備自行撰寫程式的能力；程式分析、修改、測試與文件主要由 AI 協助完成。使用者應自行判斷是否適合安裝。

BiliCDN_TW 是給台灣網路環境使用的 Bilibili Tampermonkey 腳本。它會在不取消播放器既有請求的前提下，從可信 Catalog CDN 與目前影片提供的 Native signed route 中選擇可用路線，並在已驗證的傳輸故障或播放器核心失效時協助恢復播放。

本專案只支援最新版 Google Chrome 與 Tampermonkey。

## 主要功能

- 自動選擇與固定指定可信 Catalog CDN。
- 對影片與音訊分開保存近期傳輸證據，避免音訊故障連坐影片路線。
- Native signed URL 只在目前影片與畫質生命週期內使用，不跨影片保存。
- 健康播放期間不因背景量測或其他分頁的新資料換線。
- 2x 播放、自動畫質、AV1／HEVC 偏好與背景播放支援。
- black、dead、使用者停用及預設不可用節點的統一限制。
- Watchdog、傳輸故障恢復與受限播放器核心重建。
- WebRTC 阻擋與 HTTPDNS 手動 block／allow。
- 失敗導向事故診斷；成功請求只做有界彙總。

## 安裝與更新

1. 在 Chrome 安裝 Tampermonkey。
2. 從 [最新 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest) 安裝 `BiliCDN_TW.user.js`。
3. 開啟 Bilibili 影片頁面。腳本會依 Tampermonkey 的更新機制檢查同一儲存庫的 latest release。

請勿同時啟用舊版 BiliCDN_TW 或其他會改寫 Bilibili 媒體 URL 的腳本。

## 使用方式

腳本預設使用自動選路、2x 播放、AV1 優先、WebRTC 阻擋與 HTTPDNS block。

可從 Tampermonkey 選單，或播放器設定面板內的「開啟 BiliCDN 控制中心」進入設定：

- 開啟或停用腳本。
- 選擇自動選路或固定 Catalog CDN。
- 啟用／停用個別 Catalog 節點。
- 設定 Codec 偏好。
- 切換 WebRTC 阻擋與 HTTPDNS block／allow。
- 開啟 Verbose 診斷。
- 清除 v2 學習資料或恢復 v2 預設設定。
- 在播放狀態安全時手動重新評估一個候選。

固定 CDN 仍受 black、dead、使用者停用、預設不可用及 host-lock 限制；固定設定不會解除處分。

## 選路原則

- 新分頁第一筆可歸因的播放器媒體請求可暫緩最多三秒，同時測試本片原始 signed URL、合法備援與內建 Catalog（最多三個不同 host）。無有效結果時放行合法原線；同步 XHR、有明確 timeout 的 XHR、未知或無法安全改寫的媒體入口不強行攔住。
- 後續影片與其他分頁可以共用近期 v2 健康證據，但不會盲目沿用「上次 CDN」。
- 健康播放滿足安全條件後，每十分鐘最多順序量測三個候選，未知／過期優先並輪替 Catalog 與 Native；結果只更新證據，不會在流暢播放中換 host。
- 起播後若沒有明確請求失敗、也持續 15 秒沒有影片進度，腳本只嘗試一次合法的不同 host 備援；播放器仍無法恢復時，最多受限重建一次核心。這不能保證網站或網路故障都可自動修復。
- 只有新播放生命週期、畫質無法沿用、可信設定操作、已驗證傳輸故障或 Watchdog 恢復邊界可以重新選路。
- Native 路線必須使用當前 epoch、相同 representation group 的完整 signed URL；腳本不合成 Native URL。

## 本機資料

所有設定與學習資料都保存在 Tampermonkey 的本機儲存空間，不會上傳：

- `bilicdn.v2.settings`：功能與介面設定。
- `bilicdn.v2.restrictions`：black、dead 與使用者節點限制。
- `bilicdn.v2.routeEvidence`：Catalog／Native 的去敏 hostname 健康樣本。
- `bilicdn.v2.meta`：跨分頁量測冷卻等小型協調資料。

完整 signed URL、path、query、token、播放器核心狀態與事故時間線只存在目前分頁記憶體，完整重新整理後消失。v2 不讀取或遷移任何 v1 key；舊資料可留在 Tampermonkey 中，但不會影響 v2。

## 排錯

遇到卡頓或黑屏時：

1. 先不要重新整理分頁。
2. 開啟控制中心的診斷頁，按「標記剛剛卡頓」。
3. 等待約 30 秒讓事故時間線收集後態。
4. 複製診斷報告並附在 GitHub issue。

診斷不包含 signed URL、影片識別碼、cookie 或 IP。若報告顯示只有健康觀察，代表它不能證明重新整理前或更早發生的故障。

## 開發

需求：Node.js 26.8.1、npm 11.19.0。依賴精確鎖定 TypeScript 7.0.2 與 esbuild 0.28.2。

```powershell
npm ci
npm run typecheck
npm test
npm run verify
```

正式產物為單一 IIFE userscript，沒有執行期第三方依賴。詳細架構與開發規則請見 `docs/ARCHITECTURE.md` 與 `docs/DEVELOPMENT.md`。

## 授權

MIT。專案保留原作者與第三方元件的授權資訊，詳見 `LICENSE` 與 `docs/THIRD_PARTY_NOTICES.md`。
