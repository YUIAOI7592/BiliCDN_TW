# 測試

npm test 先重建，再遞迴執行 *.test.js／*.test.cjs／*.test.mjs。產物缺失即失敗，不能全部 skip 後宣稱通過。

- fixtures：固定舊版原始 bytes 與 SHA256.json，不修改。
- harness：Node VM、GM／DOM／XHR／Fetch、可信／偽造事件、可推進時鐘；Worker 模擬只保留給不可變歷史重現與「網站 Worker 不受影響」驗收。
- regression：既有功能及新增未插樁產物驗收。
- security：CS-001～003；v1.7.0 的 CS-003 驗證 Worker 攔截攻擊面已不存在，歷史 Worker 邊界案例固定執行 v1.6.3。
- reproductions：固定 v1.5.1 的歷史 review 9 項，不是新版缺陷。
- unit：模組實例隔離、政策、import 無副作用及產物邊界。

目前 `npm test` 功能套件 327 項、無 skip；依使用者要求，v1.8.3～v1.8.8 不執行獨立 CS 子集或 Code Security。v1.8.8 新增真實瀏覽器發現的「跨片 playurl 在點擊前已完成」固定重現，覆蓋 Fetch／XHR 暫存接續、錯頁隔離與停用清理；v1.8.7 的跨 generation 回應、v1.8.6 的 `__playinfo__` 時序、片尾 Watchdog 與播放器按鈕案例仍保留。歷史安全與舊版重現檔仍保留，但不以其結果替目前版本背書。

舊版重現執行原單檔。新版內部測試使用獨立 test build 的模組 getter，不能發布；harness 先核對指定正式檔與 build 相同。instrument:false 完全執行正式檔，另測頁面快照、Fetch／XHR、選單及網站 Worker 身分不變。

原始碼字面斷言只適應模組／esbuild 格式；預算以數值比較，不把 8000／8e3 視為行為不同。測試專用 fault injection 不進正式產物。

250 秒流程覆蓋起播、90 秒、四分鐘，含 healthy 2x、雙 CDN、seek、真實失敗及 Verbose 開／關。VM isTrusted、網路、能力查詢都是 mock，不是 Chrome／Tampermonkey／GPU 實機驗證。
