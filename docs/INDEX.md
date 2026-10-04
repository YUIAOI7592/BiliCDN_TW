# 專案文件索引與維護規則

本索引於 **2026-10-04** 更新，目前最新正式發布版為 **v2.1.8（MP4／FLV 修正）**。自動驗證、安全審閱、GitHub 發布確認、Tampermonkey 更新及本次授權的 Chrome 回歸均已完成。合法 MP4 試看片段與公開 DASH 的現場結果，以及安全報告與格式覆蓋限制，分開記錄於 TEST_REPORT。它區分持續維護的指南與保留當時證據的歷史紀錄；舊版本的「待驗收」「未發布」或研究建議，不代表目前待辦。

產品行為以 [src-v2/entry.ts](../src-v2/entry.ts) 及其模組為準；版本與工具以 [release.json](../release.json)、[package.json](../package.json) 和 [package-lock.json](../package-lock.json) 為準。當指南與程式不一致時，先確認實際行為，再同步修正文檔；歷史觀察仍保留原始版本與日期。

## 現行指南

| 文件 | 用途 |
| --- | --- |
| [README](../README.md) | 安裝、現行功能、模式、控制中心與使用限制 |
| [PROJECT_CONTEXT](PROJECT_CONTEXT.md) | 產品契約、已確定的邊界與交付範圍 |
| [AGENTS](../AGENTS.md) | 開發工作流程、架構與文件維護要求 |
| [ARCHITECTURE](ARCHITECTURE.md) | 依賴方向、狀態、控制器、適配器與檢查的實際範圍 |
| [DEVELOPMENT](DEVELOPMENT.md) | 本機工具、測試隔離、建置、驗證與發布程序 |
| [SECURITY](../SECURITY.md) | 現行信任邊界、持久資料、網路權限與隱私要求 |
| [TODO](TODO.md) | 目前工作狀態及需要另行決定的方向；不從舊紀錄自動產生待辦 |
| [UPSTREAM_MANIFEST](UPSTREAM_MANIFEST.md) | 現行 v2 與歷史來源的關係 |
| [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) | 來源授權與開發工具用途 |

這些指南應隨程式或發布狀態更新。文件中的行為、設定預設值與命令，不能以舊版規格取代目前實作。

## 檔案配置

根目錄保留 README、AGENTS、SECURITY、LICENSE 與必要建置設定；其餘現行文件全部集中於 `docs/`。CHANGELOG 和 TEST_REPORT 由封裝工具讀取，PROJECT_CONTEXT、TODO、UPSTREAM_MANIFEST 供開發與維護查閱。來源校驗清單與原件集中於 `baseline/`。

歷史計畫、研究、驗收與截圖集中於 [archive/retired](../archive/retired/README.md)。[封存總覽](../archive/README.md)說明公開歷史文件與忽略的本機資料分區。封存檔案不作現行建置或測試輸入，原始碼、契約測試、授權原件與正式 Release 路徑保持不變。

## 發行與驗證紀錄

| 文件／產物 | 如何閱讀 |
| --- | --- |
| [CHANGELOG](CHANGELOG.md) | 最新已發布版本為 v2.1.8，以下保留各版歷史 |
| [TEST_REPORT](TEST_REPORT.md) | 依日期／版本分開記錄 v2.1.8 發行、v2.1.7 發行及先前驗證證據，包括各次限制 |
| [v2.1.8 GitHub Release](https://github.com/YUIAOI7592/BiliCDN_TW/releases/tag/v2.1.8) | 已確認為最新正式版；GitHub 附件只有 `BiliCDN_TW.user.js` |
| [Release/v2.1.8](../Release/v2.1.8/) | 該次封裝的 userscript、報告、變更紀錄、manifest 與 checksum；發布後不回寫 |

自動驗證、安全掃描與真實瀏覽器驗收是不同證據。**v2.1.6 Chrome／Tampermonkey 驗收已通過、已結案**；其覆蓋限制不構成待辦。v2.1.8 的發布後 Chrome 結果另行記錄，不回寫封裝快照。v2.1.8 安全審閱已完成全部 30 個檔案且無合理候選或可報告問題，但正式封存報告仍保留 9 個其後已審閱檔案的中途 deferred 標記及 `partial coverage` 狀態。此限制與 v2.1.7 的歷史封存限制分別見 TEST_REPORT。

v2.1.8 目前狀態見 [TODO](TODO.md)；userscript 已發布，標準更新後的合法 MP4 試看片段與替代公開 DASH 均有超過 12 秒的連續播放及 Catalog 直接 HTTPS 206 證據。原 MP4 已改會員限定，不宣稱完整公開 MP4 驗收；完整公開 MP4 尚無現場樣本，FLV 僅有自動契約證據。這些是覆蓋限制，不另列為已批准待辦。

## 歷史計畫與瀏覽器紀錄

| 文件 | 保留範圍／狀態 |
| --- | --- |
| [SECURITY_REVIEW_v1.6.0](../archive/retired/docs/SECURITY_REVIEW_v1.6.0.md) | v1.6.0 候選版安全紀錄；不是現行 v2 政策或掃描結果 |
| [PLAN_v2.0.2](../archive/retired/docs/PLAN_v2.0.2.md) | 當時的實作計畫；其中例外不作現行開發／發行規則 |
| [POST_RELEASE_v2.0.2](../archive/retired/docs/POST_RELEASE_v2.0.2.md) | 當時事故、修復與工作狀態；待辦用語限於該日期 |
| [CHROME_v2.0.3_ACCEPTANCE](../archive/retired/docs/CHROME_v2.0.3_ACCEPTANCE.md) | 該版針對性瀏覽器回歸證據 |
| [CHROME_v2.1.2_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.2_ACCEPTANCE.md) | 該版觀察與覆蓋限制 |
| [CHROME_v2.1.6_ACCEPTANCE](../archive/retired/docs/CHROME_v2.1.6_ACCEPTANCE.md) | 已批准通過且結案的驗收，保留實際觀察與限制 |

## 已撤銷的 CDN 新增研究

**新增節點計畫已撤銷。** 以下五份文件保留 2026-09-25 起的調查、實驗與停止新增節點決定。候選排序、建議與當時的測試計畫不授權修改目前 Catalog，也不列入現行待辦。

| 文件 | 用途 |
| --- | --- |
| [CDN_OPEN_SOURCE_SURVEY](../archive/retired/docs/CDN_OPEN_SOURCE_SURVEY_2026-09-25.md) | 外部專案與候選來源研究快照 |
| [CDN_NODE_FULL_SCREENING](../archive/retired/docs/CDN_NODE_FULL_SCREENING_2026-09-25.md) | Node 初篩結果；不是正式瀏覽器驗收 |
| [CDN_CANDIDATE_TEST_PLAN](../archive/retired/docs/CDN_CANDIDATE_TEST_PLAN_2026-09-25.md) | 已撤銷的測試草案 |
| [CDN_RANGE_PLAYBACK_EXPERIMENT](../archive/retired/docs/CDN_RANGE_PLAYBACK_EXPERIMENT_2026-09-25.md) | 當時 Range／播放實驗與限制 |
| [CDN_TEST_RESULTS](../archive/retired/docs/CDN_TEST_RESULTS_2026-09-25.md) | 跨環境結果彙總與停止新增節點決定 |

## 不回寫的歷史資料

`Release/v*/`、`baseline/`、封存的 v1 程式與安全掃描產物保存當時證據，不作現行 v2 建置或測試輸入。文件維護不修改已封裝報告、checksum、舊測試結果或已封存的安全掃描。需要說明後續狀態時，更新 `docs/TEST_REPORT.md` 的最新版摘要或新增有日期與版本的紀錄。

## 維護對照

| 變更來源 | 應檢查的文件 |
| --- | --- |
| `domain/`、`state/settings-store.ts`、控制中心文字與命令 | README、PROJECT_CONTEXT；核對預設值、模式、操作名稱及例外 |
| 儲存 parser／lock／listener、Vault、Fetch／XHR、瀏覽器 hook | SECURITY、ARCHITECTURE；分清要求、實際保障與平台限制 |
| 控制器、port、依賴規則與測試支援 | ARCHITECTURE、AGENTS、DEVELOPMENT；核對所有權、生命週期與檢查範圍 |
| `scripts/`、工具設定、package 與 lockfile | DEVELOPMENT、UPSTREAM_MANIFEST、THIRD_PARTY_NOTICES；核對命令、工具用途及輸出位置 |
| 實際執行的測試、安全掃描、瀏覽器驗收 | TEST_REPORT 及對應日期／版本紀錄；只記錄已取得的證據 |
| 版本封裝與 GitHub 發布 | README、CHANGELOG、TEST_REPORT、PROJECT_CONTEXT、本索引；核對版本、狀態、連結、hash 與附件 |
| 使用者新增、取消或結案的範圍 | TODO、PROJECT_CONTEXT 及相關歷史文件的狀態標示 |

每次維護應完成以下檢查：

1. 對照程式、設定與腳本，核對文字描述及命令；測試數量只在有版本／日期的驗證紀錄中列出。
2. 檢查根目錄、`docs/` 與公開封存文件的 Markdown 連結、路徑和文件用途；新增文件納入本索引。已退出流程的文件移至 `archive/retired/docs/`，並同步修正連結。
3. 歷史資料補上適用版本／日期及現行指南連結，保留原始觀察、取消決定與覆蓋限制。
4. 確認舊待辦未被重新開啟，簽名網址、憑證、IP 和播放器物件未進入文件。
5. 執行 `git diff --check`，確認沒有意外修改程式或已封裝的 Release。僅改文件時，不把這些檢查寫成新的 runtime 或瀏覽器驗證結果。

這是隨專案變更執行的維護規則，不代表已建立排程、CI/CD 或持續監控。

## 2026-10-03 文件維護紀錄

搬移前核對根目錄與 `docs/` 的 **23 份 Markdown 文件**，索引涵蓋全部文件；當時 **117 個本機連結及頁內錨點**檢查通過。已依程式修正儲存驗證／同步、signed route 索引與記憶體網址、瀏覽器 hook 還原、AST／匯入檢查、工具與封裝命令的描述，並補齊發布狀態與歷史文件標示。

文件差異檢查通過；本次變更限於文件，原始研究與驗收證據保留。這份維護紀錄不新增 runtime 測試、安全掃描或瀏覽器驗收結果。

## 2026-10-03 第一次封存整理紀錄

依程式與工具的實際引用，將歷史文件及已完成的本機舊工具／證據搬入 `archive/retired/`。搬移清單與校驗摘要見[封存索引](../archive/retired/README.md)。公開文件連結隨新位置更新，本機原始資料保持忽略，v2.1.6 驗收與已撤銷 CDN 計畫的狀態不變。

搬移後核對 **25 份公開 Markdown／128 個本機連結及錨點**，全部有效；`npm run verify` 完整通過，`Release/` 與現行來源校驗保持一致。此紀錄是位置整理的自動回歸，不新增安全掃描或 Chrome 驗收結果。

## 2026-10-03 根目錄文件集中整理

五份仍在使用的文件（PROJECT_CONTEXT、CHANGELOG、TEST_REPORT、TODO、UPSTREAM_MANIFEST）由根目錄集中至 `docs/`；來源 SHA-256 清單移至 `baseline/SHA256SUMS.txt`，內容不變。根目錄的 Markdown 因而由八份減為 README、AGENTS、SECURITY 三份。同步修正開發指引、封裝輸入與連結，移除封存索引中誤接的重複專案脈絡。

**25 份公開 Markdown／129 個本機連結及錨點**全部有效，baseline 校驗及 `npm run verify` 完整通過。原始碼、測試、正式 Release 與封存原始證據保持不變；封裝腳本只調整兩個文件讀取路徑。
