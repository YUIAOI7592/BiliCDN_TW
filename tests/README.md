# 測試

npm test 先重建，再遞迴執行 *.test.js／*.test.cjs／*.test.mjs。產物缺失即失敗，不能全部 skip 後宣稱通過。

- fixtures：固定舊版原始 bytes 與 SHA256.json，不修改。
- harness：Node VM、GM／DOM／XHR／Fetch、可信／偽造事件、可推進時鐘；Worker 模擬只保留給不可變歷史重現與「網站 Worker 不受影響」驗收。
- regression：既有功能及新增未插樁產物驗收。
- security：CS-001～003；v1.7.0 的 CS-003 驗證 Worker 攔截攻擊面已不存在，歷史 Worker 邊界案例固定執行 v1.6.3。
- reproductions：固定 v1.5.1 的歷史 review 9 項，不是新版缺陷。
- unit：模組實例隔離、政策、import 無副作用及產物邊界。

目前完整套件 327 項，無 skip；獨立 CS-001～003 子集 17 項另跑，但不重複加總為產品案例數。v1.8.2 新增固定 v1.8.1 重現、exact 頁面候選解鎖、Catalog 獨立競賽、query／redirect／假事件／取消／舊版本拒絕、來源接管、provenance 與 250 秒未插樁流程。另固定未發布的 pre-security 候選 bytes 作 3 項安全問題的負向控制，12 項修補案例涵蓋樣本、衝突與 XHR 來源驗證；该 fixture 不是可安裝交付。歷史 Akamai 提升測試改經可信 playurl 協調器，而非要求已移除的舊 transform 直接選路。

舊版重現執行原單檔。新版內部測試使用獨立 test build 的模組 getter，不能發布；harness 先核對指定正式檔與 build 相同。instrument:false 完全執行正式檔，另測頁面快照、Fetch／XHR、選單及網站 Worker 身分不變。

原始碼字面斷言只適應模組／esbuild 格式；預算以數值比較，不把 8000／8e3 視為行為不同。測試專用 fault injection 不進正式產物。

250 秒流程覆蓋起播、90 秒、四分鐘，含 healthy 2x、雙 CDN、seek、真實失敗及 Verbose 開／關。VM isTrusted、網路、能力查詢都是 mock，不是 Chrome／Tampermonkey／GPU 實機驗證。
