# v1.8.3 — 恢復黑名單、Dead 與節點排除效力

- 共用禁止判定涵蓋有效 black/dead/soft、Native 隔離、檔頭排除、使用者停用與預設不可用節點。
- 原始 signed URL、Native、Catalog、固定設定、affinity 與備援都不可繞過；Fetch 呼叫／XHR open 與 send 前重新檢查。
- 有合法替代時經既有路徑守門改走 Catalog 或同組完整 Native URL；沒有替代時 Fetch 本地拒絕、XHR status=0 並僅派送 error/loadend，不送出請求、不懲罰 CDN。已開始的播放器請求不取消。
- 移除候選耗盡自動清除 black/dead，以及成功樣本自動解除 soft 的舊行為。設定啟用不能解除有效處分；全部停用的持久設定也不自動重置。
- primary/backup 輸出、probe、confirm、bakeoff、preconnect 共用禁止判定；節點清單標示禁止原因，報告增加發現但禁止、替代與本地阻止計數。
- CDN 名單、2x、AV1、UCB/EWMA、Watchdog 門檻、量測額度與冷卻不變。Worker 未恢復。

本版未執行 Code Security 掃描。黑名單修復與其他卡頓分開驗收；沒有合法替代時可能停止播放，這是使用者選定的嚴格禁止行為，不會偷偷放行被禁節點。

GitHub Release 僅提供 `BiliCDN_TW.user.js`；建置清單、測試報告、patch 與 SHA 留在儲存庫。自動更新仍指向本儲存庫 latest Release。
