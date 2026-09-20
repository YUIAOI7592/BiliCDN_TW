# v1.9.5 — Native 音訊失敗與 DASH 黑屏修復

- 將 Native signed URL 的來源歸因與路由可選資格分離；節點被 soft block、group invalid、同類媒體 recovery avoid 或既有限制命中後，不會再從 exact、current、backup 或 probe 出口被選回。
- Native 音訊 Transport 失敗只為同一 audio representation group 建立 Catalog fallback，保留原 signed URL 的 path／query，不修改影片 Route Affinity、畫質或影片 host 切換計數。
- 影片與音訊的 recovery avoid 分開保存於目前 epoch；同一 host 的 audio 失敗不連坐仍正常的 video route。
- probe 403 只更新候選資格，不建立播放恢復 token，也不在健康播放中提交換線。
- fallback 提交後先等待播放器自行重試；只有 core 明確未初始化、MPD 仍有影片 group、影片為 `readyState=0` 或 0×0，且四秒沒有影片進展時，才共用既有受限 `player.reload()`。
- 核心恢復沿用位置、2x、播放意圖、90 秒 cooldown、每 generation 兩次上限與 reload timeout；正常進展、paused、seek、片尾、media error、舊 epoch 或沒有合法 fallback 均不重載。
- 診斷分開呈現 group fallback 計畫、後續實際 host 與 core 恢復狀態；不公開 signed URL。

依使用者要求，本版不執行 Code Security 掃描。GitHub Release 僅提供 `BiliCDN_TW.user.js`。
