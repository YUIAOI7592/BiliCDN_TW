# BiliCDN_TW v1.6.1 測試報告

## 範圍

本版只修正 userscript 發布與自動更新 metadata，不修改播放執行路徑。不可變前版為 v1.6.0，SHA-256 為 `0186bb2d7a0093b474c0f750d9856d7293b6df82d42c8a2f3c708b5f40f730e5`。

## 驗證

- metadata 僅有一組 `@updateURL`／`@downloadURL`，且 exact 指向 `YUIAOI7592/BiliCDN_TW` 的 latest Release `BiliCDN_TW.user.js`。
- 不含 `@require`，不會從其他位置載入執行期程式碼。
- 完整 Node／VM 回歸 **258／258** 通過；獨立 CS-001～003 子集 **19／19** 通過。
- 語法、可重現建置、v1.6.0 incremental 與 v1.3.4 cumulative patch 實際套用及 SHA-256 均通過。
- GitHub Release 只上傳單一 userscript；其他產物仍保留在版本目錄供稽核。

正式 userscript SHA-256：`e30a0fd4117067296ec022225705b52aa4f063d22ac761a2bce8d370ae5eae30`

## 實機界線

本版未新增播放功能，沿用 v1.6.0 的初步 Chrome／Tampermonkey 驗證。自動更新仍需在發布後由使用者確認 Tampermonkey 能從 GitHub latest Release 偵測下一個版本；VM／靜態測試不冒充該實機結果。
