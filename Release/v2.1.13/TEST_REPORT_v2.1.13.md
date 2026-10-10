<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.13 發行驗證 — 2026-10-10

基準 v2.1.12／c924b0216fe0a8f7a624f391d44b36660daca433。本輪修復 BR-01 A／B／C，Auto 是主要使用場景，不鎖畫質或修改 ABR。**目前本機修復完成，發布及安裝版驗收尚待執行。** [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_FIX_REPORT.md) 分開記錄自動、來源隔離、安全及實際安裝版。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。先登記原三個缺陷與三個正常對照，未修來源為 3 pass／3 fail／退出碼 1，失敗紀錄獨立保存。最終完整 verify 通過：44 執行期模組、19 套件、474 正式案例（新增 22 控制器及 4 適配器）、43 非入口模組匯入純度、型別／架構、確定性建置、語法、v2-only 與暫存封裝 checksum；沒有 failed／only／skip／todo／cancelled。git diff --check 通過。證據位於 .work/functional-fixes/br01/2026-10-10-c924b02/。

## 獨立安全審查

Codex Security 6aa22069-fc37-4842-a30c-2727ece75b37 已封存：17 個變更來源／測試檔完整覆蓋，0 可報告發現、0 待驗證候選，封存時無快照漂移。Digest：codex-security-snapshot/v1:sha256:87e2a78798ea66c638e2e5f8bcd2c4a748469536bd2b046c39f482655c9b1911。7 個執行期來源保持受審 SHA-256；其後只有四個補充適配器契約、版本及文件修改，另由主代理核對，不屬於原安全快照。完整報告由插件管理，與 verify 分開。不是全儲存庫無漏洞保證。

## Chrome 來源隔離

22／22：1 倍／2 倍的 15／30／15 秒邊界、每段一次備援／重載、核心替換、無進度終止、正常短 seek 和清理，另有原生 Blob Fetch／XHR 對照。實際適配器／控制器搭配合成 DOM 狀態、記憶體儲存與 FakeClock，**不是實際經過 12／30 秒的網站延遲或 Tampermonkey 安裝版**。首輪失敗找出首次進度沒有釋放停滯段，已修正；作廢輪證據保留。隔離 iframe 已移除。

## 發布與安裝版

v2.1.13 尚未發布或載入，不宣稱公開產物及安裝驗收通過。更新後僅用指定風景影片的 Auto，分開測 1 倍／2 倍、正常播放／暫停／seek、約 12 秒 video-only 延遲及超過 30 秒停滯。來源與安裝版分列。

## 剩餘限制

原 87.785 秒自然網路起因未定位，其他完整產品驗收仍見 [TODO](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/TODO.md)。控制觀察不能認證頁面核心；自有 reload 等待中、未經可觀察 reload 方法的外部替換，不能完全辨識因果。沒有有效 cid 或共同路徑的同片仍保守重設。schema 2、持久鍵、公開設定、依賴及更新 URL 不變。

## 歷史驗證導覽

<a name="bilicdn_tw-v2112-release-verification--2026-10-10"></a>

- [v2.1.12 完整正文及 Auto 調查追加](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2112-release-verification--2026-10-10)
- [其餘歷史報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md)

<a name="bilicdn_tw-v2111-release-verification--2026-10-10"></a>

- [v2.1.11 原錨點](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2111-release-verification--2026-10-10)

<a name="bilicdn_tw-v218-release-verification--2026-10-04"></a>

- [v2.1.8 原錨點](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v218-release-verification--2026-10-04)
