# UP141 慢請求提前重試隔離原型 — 2026-10-30

本紀錄固定 B 執行期提交 3cadfd8633fabbaa4dbe20226e2d1b87714edc8c，基底為正式 A 候選 613632fc33dd493a951a6b9942a870755ceab530；分支為 `codex/upstream-141-early-retry`。本文只描述此檢查點；後續工作狀態見 [TODO](../../../docs/TODO.md)，完整後續驗證與安全結果集中於 [TEST_REPORT 的分支補充](../../../docs/TEST_REPORT.md#隔離-b-分支原型驗證2026-10-30)。

## 來源與身分

原型包含在途 XHR 摘要、可信完整 Range bytes、單次 timeout lease、網站重試配對、RouteCoordinator 許可及原生 send 接受後提交、控制器額度與 document breaker、生命週期撤銷、schema 2 設定及可信 UI 開關。earlyRetryEnabled 的預設與缺值均為 false。正式 A 未納入此控制能力，兩者雖同列 v2.1.37，完整腳本不同。

B 的決定性本機腳本 SHA-256 為 84da0795b7a3f896960960d82a976ac13d7b6f95f763856253f5f1373105b173；沒有對應的正式 Release 或安裝更新附件。架構與重現方法見 [ARCHITECTURE](../../../docs/ARCHITECTURE.md#隔離-b-原型的傳輸控制) 及 [DEVELOPMENT](../../../docs/DEVELOPMENT.md#慢請求提前重試原型重現分支限定)。

## 已取得的離線證據

精確工具為 Node 26.8.1／npm 11.19.0。完整 npm test 實際通過 2977 案，沒有失敗、略過、待實作或取消；B 的 UP141-RETRY 應用 37 案與可信 UI 1 案包含於其中。typecheck、110 模組 architecture、format:check、git diff --check、建置及 JavaScript 語法檢查通過。

具名契約包含時間／緩衝／80% 邊界、未知與過期證據、控制與生命週期、每段與全域額度、單一許可重入、已接受 send 後的記帳例外、原生 timeout 品牌／單次轉換／相同值寫入、conversion 重入 open 後拋錯、描述子所有權、可選能力失敗隔離、精確回應路徑／查詢、可信事件、完整 bytes、工具樣本抑制及清理。原生替身明確是 Node 模型，不是 IAB 或 Tampermonkey 證據。

程式提交檢查點尚未建立 B 追加修改的封存保護新基準，因此未把當時來源測試／建置稱為完整 verify 通過。後續維護先逐位元組保存 A 搬移清單，再只解除合法 B 修改來源的 unchangedFiles；最終文件／封存／verify 結果由上述 TEST_REPORT 補充維護，不改寫此固定紀錄。

## 固定效用評估：VALID／FAIL

```text
node scripts/early-retry-evaluation.mts --json
```

命令退出碼為 1，valid=true、passed=false。原始輸出保存在 [公開 JSON](evidence/UPSTREAM_V1_4_1_EARLY_RETRY_EFFICACY_2026-10-30.json)，以 raw 原件保護，不作產品建置或正式測試輸入。

| 項目 | SHA-256 |
| --- | --- |
| 政策來源 | 04e6ace222b3d6f945cd35c84ad1cc67f21293274bee95571ca697c8e9a1fd37 |
| 固定輸入 | 9130e0dd4af45496cbbd23dab07737060449b3b94629dfb33d0c986ffd740763 |
| 完整原始 JSON | 31a06ccd301f9a9add79158adac0058665eb6fd34953d2a398a8f598bd8cbc35 |

兩個持續慢速模型在 1／2 倍分別減少 14000／16000 ms 停頓。健康緩衝與接近完成模型沒有介入，但相同慢速前綴之後正常突發回補的兩案，均發生一次不必要的 100000 bytes 重下；正常非干預門檻為 false。評估器不把保留的未來供片事實餵給判斷器，沒有修改輸入或降低期待使結果轉綠。

## 採用與驗證界線

此有效失敗已足以阻止正式預設採用；自動契約綠燈不能補算效用綠燈。使用者於 2026-10-30 明確延後 IAB／Tampermonkey，原生相容、安裝故障與自然對照均未執行，沒有背景續跑或追加第三輪。本檢查點不宣稱安裝成功、自然卡頓改善率或正式交付完成。舊 IR36、P01／P02、BR-01 及 bufferTrend v6 採用否決保持原判定。

Codex Security 掃描 bab220b7-b1a7-409a-b11d-0de94e0955c1 已對固定 613632f→3cadfd8 的二十六個審查項完成審查，無可報告發現；canonical 報告由 Codex Security 工作台保管。後續文件與封存調整不修改這個固定來源，安全結果也不取代效用及安裝門檻。
