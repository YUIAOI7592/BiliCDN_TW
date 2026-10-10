<a name="bilicdn_tw-v2113-release-verification--2026-10-10"></a>

# BiliCDN_TW v2.1.13 發行驗證 — 2026-10-10

基準 v2.1.12／c924b0216fe0a8f7a624f391d44b36660daca433。本輪修復 BR-01 A／B／C，Auto 是主要使用場景，不鎖畫質或修改 ABR。**修復與發布完成；實際新版部分安裝版驗收已有有效證據，完整矩陣未結案。** [修復對照](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_FIX_REPORT.md) 分開記錄自動、來源隔離、安全及實際安裝版。

## 自動驗證

Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。先登記原三個缺陷與三個正常對照，未修來源為 3 pass／3 fail／退出碼 1，失敗紀錄獨立保存。最終完整 verify 通過：44 執行期模組、19 套件、474 正式案例（新增 22 控制器及 4 適配器）、43 非入口模組匯入純度、型別／架構、確定性建置、語法、v2-only 與暫存封裝 checksum；沒有 failed／only／skip／todo／cancelled。git diff --check 通過。證據位於 .work/functional-fixes/br01/2026-10-10-c924b02/。

## 獨立安全審查

Codex Security 6aa22069-fc37-4842-a30c-2727ece75b37 已封存：17 個變更來源／測試檔完整覆蓋，0 可報告發現、0 待驗證候選，封存時無快照漂移。Digest：codex-security-snapshot/v1:sha256:87e2a78798ea66c638e2e5f8bcd2c4a748469536bd2b046c39f482655c9b1911。7 個執行期來源保持受審 SHA-256；其後只有四個補充適配器契約、版本及文件修改，另由主代理核對，不屬於原安全快照。完整報告由插件管理，與 verify 分開。不是全儲存庫無漏洞保證。

## Chrome 來源隔離

22／22：1 倍／2 倍的 15／30／15 秒邊界、每段一次備援／重載、核心替換、無進度終止、正常短 seek 和清理，另有原生 Blob Fetch／XHR 對照。實際適配器／控制器搭配合成 DOM 狀態、記憶體儲存與 FakeClock，**不是實際經過 12／30 秒的網站延遲或 Tampermonkey 安裝版**。首輪失敗找出首次進度沒有釋放停滯段，已修正；作廢輪證據保留。隔離 iframe 已移除。

## 發布與安裝版

v2.1.13 於 2026-10-10T05:07:23Z／台北 13:07:23 [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.13)，來源／標籤提交 fc2b3b5ed58e307d8c87e2326769cfa8a390cf46，main／peeled tag 核對一致。唯一附件 BiliCDN_TW.user.js：314,188 bytes，SHA-256 646515874ea4088b11830907826c5d1275f823c155a5fb1523999a9755ffa816；無登入公開 latest API 與下載核對版本／大小／雜湊完成。Chrome 實際執行 body 完整包含該腳本，singleton 一個。發布後現行文件另追加讀回與驗收結果，Release 快照不覆寫。

新版 Auto 1／2 倍速、分開的 12 秒影片延遲已取得有效恢復證據，音訊通行且有效窗口無 Fetch／Network 事件截斷。1 倍尋位 16.772 秒，一次備援／零重載；2 倍尋位 34.395 秒，一次備援／一次核心重載，之後時間及影格恢復。65 秒影片持有輪由網站約第 24 秒提前暫停／外部核心替換，腳本撤銷且未持續重試；因此安裝版「重載後完整 15 秒無進度退出」仍待取得前提，不能用本輪或來源隔離代替。故障期間新操作、真正 hidden／晚到提交等完整矩陣亦未結案。受控 98 個 IDs 沒有記憶體／持久樣本，schema 2 保持；全部攔截／觀察器已清理。詳見 [安裝版證據及續行](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/CHROME_v2.1.13_ACCEPTANCE.md)。

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
