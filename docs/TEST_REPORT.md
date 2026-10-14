<a name="bilicdn_tw-v2124-release-verification--2026-10-14"></a>

# BiliCDN_TW v2.1.24 救援政策重評與修復驗證

日期：2026-10-14（Asia/Taipei），基準 v2.1.23／c3f1a49，開始工作目錄乾淨。本輪確認並修復可信播放按鈕未進入既有長暫停救援的入口缺陷；**保留 15／30／15 秒**。不重開歷史整份 BR-01 或 P01／P02，原自然停滯原因沒有新結論。

| 層級 | 結果 |
| --- | --- |
| 未修來源正式契約 | 原 8 案：2 fail／6 pass，失敗紀錄保留 |
| 修復後正式契約 | 新增 14 案；adapters 116／116、application 286／286 |
| 完整自動驗證 | 19 套件 855／855；0 fail／skip／todo／cancelled |
| 型別／架構 | 通過，44 runtime 模組 |
| 最終 verify | 通過：型別、架構、完整契約、確定性建置、語法、v2-only、暫存封裝與校驗 |
| Codex Security 差異 | 完成，4／4 來源／測試檔與 README 名稱核對；0 候選／0 發現 |
| IAB 來源隔離 | 原版可信 click 未建立意圖；修復版建立意圖、單次重載、有限退出、正常進度零重載；自有 iframe 清理通過 |
| 公開更新產物 | main／標籤、唯一附件、公開 latest 版本／大小／SHA-256 全部相符 |
| 實際 v2.1.24 安裝 | 完整本體及唯一實例相符；Auto 1／2 倍正常播放入口通過；最新尋位位置保護不通過、尚未修復，故障傳輸窗口限制分列 |
| 安裝後新調查契約 | 位置遺失 1 fail／2 pass、獨立型別通過；不計入已發布正式 855 案 |

工具：Node 26.8.1、npm 11.19.0、TypeScript 7.0.2、esbuild 0.28.2。修復／政策／案例對照見 [本輪報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_POLICY_REASSESSMENT_2026-10-14.md)。

安全掃描 89c38d47-f92f-411b-8d1a-8b3e869da0da 於 2026-10-13T16:28:11Z 完成；凍結摘要 f4abf3c9ef5e09c011b1e610f57c2234f3c354e78fbc17fe28faf578baf34379。後續版本／文件／封裝不冒充該安全審查範圍。

發布前 v2.1.23 Auto 2 倍延遲窗有實際恢復，但含取消／放行競合與觀察限制；當時後續 1 倍起始狀態已失效，正常比較作廢。更新後的 v2.1.24 正常 1／2 倍另行執行並通過。來源進度模型不等於真影片恢復，有限退出也不等於恢復成功。私有證據 .work/functional-fixes/br01-policy/2026-10-13-c3f1a49/。

<a name="bilicdn_tw-v2123-release-verification--2026-10-13"></a>
<a name="歷史驗證導覽"></a>

## 歷史報告

上一版 v2.1.23 完整正文原樣追加至 [歷史驗證](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/archive/retired/docs/TEST_REPORT_HISTORY.md#bilicdn_tw-v2123-release-verification--2026-10-13)。歷史 Release、原失敗與安全封存不回寫。

## 公開產物核對與續行狀態

v2.1.24 於 2026-10-13T16:34:31Z [正式發布](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.24)。發布時 main／peeled tag 同為 73d339e1e923ed1fc5d6606871f08a22a78d9947；唯一附件 345,540 bytes，SHA-256 9a58836ab79b56ca8b4a4741a3236011df19aade872baea19d8e56066cef7e3d。公開 latest 未帶憑證下載逐字一致。後續文件不回寫 Release 快照。

**v2.1.24 已載入並核對完整本體與唯一實例。Auto 1／2 倍正常長暫停後播放通過；BR-01 整體不通過。** 新版可信播放入口已生效，但另確認失效媒體重設後遺失使用者尋位目標，尚未修復；獨立契約 1 fail／2 pass。故障窗口的傳輸收集限制與局部媒體證據分列，不擴大通過範圍。詳見 [位置遺失報告](https://github.com/YUIAOI7592/BiliCDN_TW/blob/main/docs/BR01_v2.1.24_POSITION_LOSS_2026-10-14.md)。本輪停止重跑，未作後續執行期修改。
