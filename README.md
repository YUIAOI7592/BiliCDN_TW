# BiliCDN_TW

> [!IMPORTANT]
> **原作者與原始腳本：** [jiyunshi－Bilibili CDN 台灣優化](https://greasyfork.org/zh-TW/scripts/579776-bilibili-cdn-%E5%8F%B0%E7%81%A3%E5%84%AA%E5%8C%96)。本儲存庫是基於原作者 MIT 授權腳本製作的個人修改版，並非原作者的官方版本。
>
> **AI 協作聲明：** 本修改版的維護者本人不具備自行撰寫程式的能力；程式分析、修改、測試與文件主要由 AI 協助完成。使用者應自行判斷是否適合安裝。

BiliCDN_TW 是一支供 Tampermonkey 使用的 Bilibili userscript，主要針對台灣連線觀看影片時的 CDN 選路與卡頓恢復進行調整。

腳本會觀察播放器實際使用的媒體路線、緩衝與傳輸狀態，從可用的 CDN 中選擇較合適的路線；播放正常時維持既有路線，只有在新影片開始、使用者變更設定、傳輸失敗或 Watchdog 確認停滯時才允許重新選路。

## 主要功能

- **自動 CDN 選路：** 依延遲、吞吐、失敗紀錄與目前播放需求評估內建 CDN Catalog。
- **原生路線評級：** 可辨識影片本身提供的 signed route，使用同一 representation 的原始完整 URL，不會自行合成陌生 CDN 網址。
- **穩定路線優先：** 健康播放期間的測速只更新評級，不會因單次測速結果反覆換線。
- **卡頓監測：** Watchdog 觀察播放進度、連續前方緩衝與低資料狀態，在符合條件時重新評估路線。
- **自動畫質支援：** 跟隨 Bilibili 播放器目前使用的畫質與 Codec，SPA 換片後會由 playurl、播放器 MPD 或實際傳輸重建 Route Pool。
- **Codec 偏好：** 預設優先 AV1，再依實際瀏覽器能力退回 HEVC 或 AVC；不依 UA 或顯示卡型號猜測。
- **節點限制：** 使用者停用、預設不可用、black、dead 與 soft-block 狀態會同時約束原始、Catalog、Native、固定及備援路線。
- **本機診斷：** 以失敗與恢復因果為主，保留緩衝、representation、實際路由、fallback 與播放器 core 結果，方便只靠一份報告追查問題。

腳本不負責強制將播放器設為 2x。它會使用已觀察到的播放速率計算需求；尚未確認速率時，會保守地按 2x 規劃。

## 安裝

### 需求

- 支援 userscript 的瀏覽器
- [Tampermonkey](https://www.tampermonkey.net/)
- 已登入或未登入的 Bilibili 網頁版；高畫質是否可用仍由帳號、影片與 Bilibili 決定

本專案主要使用 **Google Chrome + Tampermonkey** 進行實機驗證，其他瀏覽器可能可以運作，但不在目前主要驗證範圍內。

### 安裝步驟

1. 安裝 Tampermonkey。
2. 點擊 [安裝最新版 BiliCDN_TW.user.js](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。
3. 在 Tampermonkey 安裝頁確認腳本來源後按下安裝。
4. 重新整理已開啟的 Bilibili 影片頁面。

腳本的 `updateURL` 與 `downloadURL` 都指向本儲存庫的 latest Release；正式更新只會下載單一 `BiliCDN_TW.user.js`。

## 如何使用

安裝並重新整理 Bilibili 後，腳本預設以自動模式運作，通常不需要手動設定。

### 播放器面板

1. 在 Bilibili 播放器點擊齒輪。
2. 選擇「更多播放設定」。
3. 面板會顯示：
   - 「攔截修改影片 CDN」開關
   - 目前模式、Catalog 建議與播放速率
   - 連續前方緩衝秒數
   - 「⚙️ 開啟 BiliCDN 控制中心」按鈕

關閉「攔截修改影片 CDN」後，腳本會停止 URL 改寫與主動量測，但不會取消播放器已經開始的請求。

### 控制中心

控制中心可從播放器面板按鈕開啟，也可使用 Tampermonkey 選單中的「⚙️ 開啟 BiliCDN 控制中心」。

控制中心包含：

- **重新評估節點：** 使用既有測速預算重新評估目前候選。
- **CDN 選路：** 使用自動模式、固定可信 Catalog 節點，以及啟用或停用個別節點。
- **診斷：** 查看或複製目前播放與事故時間線；可手動「標記剛剛卡頓」，也可開啟 Verbose 增加成功流量彙總、候選評分與週期快照。
- **節點維護：** 查看限制狀態、清理暫時處分或重置學習資料。

固定 CDN 仍須遵守 black、dead、soft-block 與禁止規則。被禁止的固定節點會保留設定，但腳本會暫時使用合格替代路線。

## 自動選路如何運作

候選分為兩類：

- **Catalog：** 腳本內建且可安全進行 host 改寫的可信 CDN 清單，不必出現在本片 playinfo 中也能參與評估。
- **Native signed route：** Bilibili 為目前影片及 representation 提供的完整媒體 URL。只能原樣使用該 URL，不能因此取得 Catalog 的換 host 或 preconnect 權限。

腳本會維持目前已確認的 Route Affinity。自動畫質或 Codec 改變時，會優先延續相同 host；Native 路線只有在新 representation 也提供相同 host 的完整 URL 時才能延續，否則回到安全的 Catalog 路線。

主動測速每輪最多四個候選，Native 最多占用其中一個名額。測速不會取消或重送播放器已開始的媒體請求。

## 本機資料與隱私

所有學習與診斷資料都留在本機，不會上傳到本專案或其他遙測服務。

- Catalog 健康、black／dead／soft-block、設定與 Native host 評級保存在 Tampermonkey 的本機 GM 儲存空間。
- Native Ledger 只保存去敏的 hostname 與有限健康數值，不保存 path、query、token 或完整 signed URL。
- 完整 signed URL 只存在目前頁面的記憶體 Route Pool；換片、SPA generation 失效、停用或重新整理後即清除。
- 重要失敗、fallback 與 core 恢復事件不依賴 Verbose；事故時間線與 Verbose 資料都只保存在目前分頁的有界記憶體，`player.reload()` 後仍存在，完整重新整理後清空。
- 腳本不包含遙測、分析服務或執行期第三方依賴。

「重置所有學習狀態」會清除 CDN health、Native 評級、blacklist、dead／soft-block、probe cache、HTTPDNS 學習與 Watchdog 統計；固定 CDN 與 Catalog 啟用設定不會一併刪除。

## 遇到問題時

1. 確認 Tampermonkey 中的 BiliCDN_TW 已啟用。
2. 重新整理 Bilibili 影片頁面。
3. 確認播放器面板顯示「攔截修改影片 CDN」已開啟。
4. 先使用自動畫質與自動選路重現問題。
5. 卡頓或黑屏後立刻開啟「控制中心 → 診斷」，按「標記剛剛卡頓」；腳本會保留前 60 秒脈絡並收集後續 30 秒。自動辨識到傳輸失敗、Watchdog 修復或 core 死亡時則會自行建立事故。
6. 等待約 30 秒後複製診斷報告並附至 [GitHub Issues](https://github.com/YUIAOI7592/BiliCDN_TW/issues)。診斷主要供後續分析，不要求使用者自行判讀。

一般故障不必預先開啟 Verbose。Verbose 只會增加開啟後的成功流量彙總、評分與週期狀態，無法補回先前未記錄的這些額外細節。

## 已知限制

- CDN 表現會隨地區、ISP、時間、影片與 Bilibili 服務狀態變化，腳本不保證一定比原生路線快。
- 自動畫質升降由 Bilibili 播放器決定；腳本只依目前 representation 調整路由，不會強制維持 4K 或 8K。
- Media Capabilities 回報良好不代表已證明硬體解碼，也不代表一定能以 2x 流暢播放。
- 部分錯誤只能由瀏覽器回報為一般網路失敗，診斷不會猜測其必然是 DNS、CORS 或特定 HTTP 原因。
- VM、單元測試與靜態檢查不能替代真實 Chrome／Tampermonkey、實際網路及硬體解碼驗證。

## 本機開發

一般使用者不需要安裝 Node.js 或 esbuild；正式 Release 已經是可直接安裝的單一 userscript。

開發環境使用 Node.js、npm 與精確鎖定的 esbuild 0.28.2：

```sh
npm ci
npm run build
npm test
npm run package
npm run verify
```

模組來源位於 `src/`，esbuild 只負責在本機打包，不會進入 userscript 執行環境。本專案沒有 CI/CD、GitHub Actions 或自動發布。

更多技術資料請參閱 [架構](docs/ARCHITECTURE.md)、[開發與發布](docs/DEVELOPMENT.md) 與 [測試說明](tests/README.md)。版本變更請查看 [GitHub Releases](https://github.com/YUIAOI7592/BiliCDN_TW/releases) 中對應版本的 CHANGELOG。

## 授權與免責

本專案沿用原作者的 [MIT License](LICENSE)，並保留原作者歸屬。建置工具授權請見 [THIRD_PARTY_NOTICES](docs/THIRD_PARTY_NOTICES.md)。

本軟體按現狀提供，不保證適用於所有帳號、地區、影片、瀏覽器或網路環境。安裝、設定與使用風險由使用者自行承擔。
