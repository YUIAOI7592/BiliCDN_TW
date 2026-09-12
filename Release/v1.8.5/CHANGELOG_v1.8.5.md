# v1.8.5 — SPA playinfo 重新掛接

- 修正 userscript 啟動時 `__playinfo__` 已存在便只處理一次、未安裝後續 setter，造成站內 SPA 換片後 route pool 與 representation 維持空白。
- 修正新 playinfo 在 `pushState` 後、延遲 SPA reset 前同步指派時，資料先建立又立即被清除；現在會在新 generation 建立後重放該次新值。
- 未變更的舊頁 playinfo 不會在換片後回填，避免舊 signed route 汙染新影片。
- 頁面若用 `defineProperty()` 替換 configurable data property，既有一秒狀態週期會重新掛回觀察，不新增 timer 或網路活動。
- 保持 v1.8.4 的 Watchdog recovery、Catalog provenance、black／dead／soft 限制、2x、AV1、測速額度與冷卻不變。

本版未執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`；其他建置與驗證資料留在儲存庫。
