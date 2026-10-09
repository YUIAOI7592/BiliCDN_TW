<a name="bilicdn_tw-v2112-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.12 發行驗證 — 2026-10-10

基準 v2.1.11／f27b3a26db04196dbe6cf96dfaa7eaf560cfba8e；本輪只修 BR-04／BR-05。**修復、v2.1.12 發布與兩項實際安裝版驗收完成；BR-01 與其餘完整驗收未結案。** 正式契約、來源隔離、獨立安全審查、公開產物與安裝版結果分列。完整對照見 [修復報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR04_BR05_FIX_REPORT.md)。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。v2.1.12 的 typecheck、architecture 及 npm test 通過；44 個執行期模組、19 套件、448 個具名案例，沒有 failed／only／skipped／todo／cancelled。新增 19 個 BR-04 與 47 個 BR-05。未修來源的 native-transport 115 pass／23 fail、measurement-state 4 pass／28 fail 單獨保留，不混算通過。

完整 npm run verify 已通過：型別、架構、448 案例、43 個非入口匯入純度、確定性建置、語法、v2-only 及暫存封裝 checksum。git diff --check 通過；證據位於 .work/functional-fixes/br04-br05/2026-10-10-f27b3a2/。

## 獨立安全審查

最終凍結差異的 Codex Security **9ceb91f0-9690-4372-9e86-8e07ea29c11b** 已封存：12 個變更來源／測試／版本設定檔完整覆蓋、0 可報告發現、0 待驗證候選、沒有快照漂移警告。Snapshot digest 為 codex-security-snapshot/v1:sha256:4ae67faaca413f0591719ff73b61c0d6f30c000a19f0d23fc22cd66ed6a0d213。封存前核對 10 個獨立複核來源／測試的最終 SHA-256，全部一致；另外審查兩份版本設定，只有版本變更。完整報告與 receipt 由 Codex Security 管理保存，與一般 verify 分開。首輪漂移報告保留，未當作最終快照。 安全不屬於 npm run verify，也不是全儲存庫無漏洞保證。

## Chrome 來源隔離

Chrome 155 原生 Fetch／XHR／RangeProbe，36／36 通過，75 次合成直接 206 探測與 39 次 media 回應；真正共用 gate 完成 measured。BR-02、BR-03 各 31／31。有效攔截窗口沒有截斷、沒有合成請求外送，無未處理拒絕，hooks 已還原；作廢工具輪與清理詳見修復報告。這是修復來源＋記憶體儲存，**不是 Tampermonkey singleton 驗收**。

## 產物與發布

2026-10-10 04:24:04（Asia/Taipei）[發布 v2.1.12](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.12)。來源提交 cdbb10b3e9ce8f56485dd427dd38d10e848ba005，遠端 main 及標籤 peeled commit 一致，annotated tag 物件 67d1d2a8ba6134b279769b2929400659ad67aaba。使用者腳本 298,785 bytes，SHA-256 c3874efbf718a3eebcc64cf2591d1a328d7ddde1aac40b7d91faf593f7c6e28d。GitHub Release 唯一附件為 BiliCDN_TW.user.js；04:24:40 未認證的公開 latest API／下載回傳 200，版本、大小與 SHA-256 全部一致。更新 URL 保持 [公開 latest](https://github.com/YUIAOI7592/BiliCDN_TW/releases/latest/download/BiliCDN_TW.user.js)。發布後只補現行文件，不覆寫 Release 快照或重封裝產物。

## Tampermonkey 與剩餘限制

實際 Tampermonkey 已自動更新 v2.1.12，Debug source 的完整程式 body 與發布附件相同。**35／35 通過**：2 原生 XHR、5 安裝版 XHR 共用 gate 重入／abort／replace、9 原生 Fetch reason、18 安裝版預取消／等待取消、1 未取消的共用 Fetch 正常對照。真 singleton／probe 未替换，gate measured；合成請求精確送出前攔截，3 Range 206、2 CORS OPTIONS、3 media 200，沒有外送或事件截斷。有效輪執行前後完整 routeEvidence 相同，合成樣本／cursor 寫入只在本輪以實例掛鉤抑制並清理；測試邊界詳見 [安裝版紀錄](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.12_ACCEPTANCE.md)。

同一支指定風景影片的播放前進、暫停穩定、恢復及短程方向鍵 seek 通過；seeked 約 317 ms、無 mediaError，之後持續播放。沒有切換影片、修改 Chrome 設定或停用其他腳本。作廢輪因測試攔截器缺少 CORS 回應，正常 XHR 對照失敗，不計通過；其錯誤樣本抑制也造成三筆合成學習樣本及退避，已依精確 owned IDs／時間清理。最多三筆可能被有界保留淘汰的先前樣本無法重建，不宣稱完整復原歷史資料。BR-01 長 seek 政策／原網路起因、background／SDK 自然故障及其餘完整產品驗收見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。

## 歷史驗證導覽

<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

- [v2.1.11 完整發布與續測正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2111-release-verification--2026-10-10)
- [v2.1.10 完整歷史正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2110-release-verification--2026-10-09)
- [其餘歷史導覽](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 原錨點與完整正文](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)
