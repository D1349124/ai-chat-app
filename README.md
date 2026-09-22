# AI 購車顧問（已串接 Google Gemini + 適配度調查）

對應車型：**TOYOTA bZ4X**（黑客松題目指定的車款，官方頁面：https://www.toyota.com.tw/showroom/bZ4X/）。`scoring.js` 的 `TARGET_VEHICLE` 是官網正式規格（建議售價 128 萬、續航 743 公里 NEDC、電池 74.7 kWh）。視覺風格走「深色未來科技風」：obsidian 黑底、電光藍 `#1e9bff` 為主色、白字，卡片有發光/浮起效果，6 個快捷格子換成手繪線條 SVG 圖示（不是 emoji），細節見 `public/style.css` 檔頭的說明。

目前狀態：一打開就是可以直接聊天的介面，AI 用 **Google Gemini**（免費額度，不用綁信用卡）回覆。「客戶適配度調查」（算出 1~100 分並存進資料庫）、「車輛比較」、「情境模擬」、「成本試算」、「充電站查詢」、「真人客服聯繫」都是選用的輔助工具，靠聊天室下方固定 6 格的快捷格子開啟，同時間只會有一個面板打開（見下方「快捷格子」說明）。

## 專案結構

```
ai-chat-app/
├─ server.js          後端伺服器（Express），處理 /api/survey、/api/compare-points、
│                      /api/scenarios、/api/scenario-query、/api/charging-topics、/api/charging-query、
│                      /api/cost-calc、/api/contact-request、/api/chat，呼叫 Gemini API
├─ scoring.js          適配度評分規則（分數是寫死的規則算出來的，不是 AI 亂猜）
├─ compare.js          「車輛比較」的六個比較項目（燃油車 vs 電動車）
├─ scenario.js          「情境模擬」的情境題庫（山區／長途／寒冷氣候／公寓充電，含關鍵字比對用的 keywords）
├─ chargingStation.js   「充電站查詢」的題庫（家用充電／公共充電站／國道服務區快充／第三方超充站，同樣含 keywords）
├─ costCalc.js          「成本試算」的純計算函式（油車 vs 電動車每月／每年花費，不靠 AI）
├─ db.js               SQLite 資料庫設定與存取函式（customers 表存問卷、contact_requests 表存客服留言）
├─ customers.db         資料庫檔案（第一次執行會自動建立，不會被 git 追蹤）
├─ package.json        專案設定與套件清單
├─ .env.example        環境變數範本（複製成 .env 使用）
└─ public/             前端網頁
   ├─ index.html         畫面結構（聊天室 + 快捷格子 + 六個功能面板）
   ├─ style.css          樣式
   └─ script.js          互動邏輯（聊天訊息、六個面板的資料載入與送出、面板互斥）
```

## 聊天室下面的快捷格子

聊天室下方固定顯示 **6 個格子**（3 欄 x 2 列的 grid，一次全部看得到，不用箭頭或滑動切換），平常都是收起來的，點了才會出現面板，**點開任何一個格子時，其他還開著的面板會自動關閉**（見 `script.js` 的 `closeOtherPanels`），畫面上同時間只會看到一個面板：

- **📋 適配度調查**：點開會顯示問卷面板。
- **🚗 車輛比較**：點開會顯示比較面板，列出燃油車 vs 這台電動車的 6 個比較項目（每公里成本、加油／充電時間、保養、稅金、排放、駕駛感受）。內容維護在 `compare.js` 的 `COMPARISON_POINTS`，語氣中立、優缺點都照實寫。
- **🗺️ 情境模擬**：點開會顯示情境卡片（山區、長途、寒冷氣候、公寓充電），點卡片或在輸入框直接打字問特殊情境，AI 會根據 `scenario.js` 整理好的事實回答；打字問的情境如果沒比對到現成資料，AI 會老實說不確定並建議轉真人客服。這個面板不會自動關閉，可以連續點好幾個情境。
- **💰 成本試算**：點開會顯示表單，填月里程、油車油耗、油價、充電方式，送出後由 `costCalc.js` 在後端算出每月／每年可省下多少錢（不靠 AI，數字可驗證），算完才請 AI 寫成說明文字。
- **🔌 充電站查詢**：跟情境模擬同一套互動方式（卡片＋自由輸入），題庫是 `chargingStation.js`（家用充電、公共充電站、國道服務區快充、第三方超充站）。**這不是即時地圖查詢**，沒有接 Google Maps 之類的定位 API，回答內容一定會提醒客戶用實際的充電 App／地圖確認即時站況，之後如果要做到即時地圖，需要另外申請 API 金鑰，屬於更大的功能。
- **📞 真人客服聯繫**：留言表單（姓名、聯絡方式、想諮詢的內容），送出後內容原封不動存進 `customers.db` 的 `contact_requests` 表，不經過 AI 改寫（客服留言要照實記錄，不該讓 AI 加油添醋）。

適配度調查／車輛比較／情境模擬／充電站查詢這幾個面板裡的卡片或題目用的是同一套「輪播」設計：一次顯示 3 個，用左右箭頭（‹ ›）翻頁，畫面夠寬時會自動排成兩、三欄，這跟外層固定 6 格、不會捲動的快捷格子是兩回事，不要搞混。問卷換頁不會弄丟已經選過的答案（見 `script.js` 的 `surveyAnswers`）。

## 適配度調查怎麼運作

問卷採用**李克特量表（Likert scale）**：每一題是一句敘述，客戶自己選 1（非常不同意）～5（非常同意），這個選擇本身就是這一題的分數——不是系統用規則去猜、去換算。

1. 點「適配度調查」格子，前端呼叫 `GET /api/survey-questions` 拿到題目清單動態畫出量表。目前共 6 題：通勤型態、每日里程、購車預算、原車狀況、充電條件、現有用車成本。
2. 送出後 `POST /api/survey`：
   - `scoring.js` 把各題自評分數加總，除以「題數 × 5」的滿分，換算成總分（1~100 分）。這是單純加總，不是 AI 算的，同樣的答案永遠會得到同樣的分數；題數以後增減也不用改算法。
   - 把分數丟給 Gemini，請它寫一段中立、不誇大也不貶低的文字摘要（`SURVEY_SYSTEM_PROMPT` 有特別交代語氣要求）。
   - 整包資料（每題分數明細 + 總分 + 摘要文字）存進 `customers.db` 的 `customers` 資料表，用 `answers_json` 欄位存明細，之後題目異動不需要跟著改資料庫結構。
3. 送出成功後面板自動關閉，格子上會順便標出總分（例如「適配度調查（83 分）」），分數明細和摘要也會顯示成聊天室的一則訊息，接下來使用者可以繼續自由提問，AI 會記得這份調查結果的上下文。

**題目只維護在一個地方：** 想增減題目或改文字，只要改 `scoring.js` 裡的 `QUESTIONS` 陣列，前端會自動同步顯示，不用再去改 `index.html`。

## 車輛規格目前是佔位資料

`scoring.js` 裡的 `TARGET_VEHICLE`（售價、續航力、能耗）目前是估計值，**不是真實車型的官方數據**。之後確定要用哪一台 Toyota 電動車，把這個物件裡的數字換成正式規格就好，評分規則的程式碼不用改。

## 環境安裝需求（在別台電腦上開啟前請先確認）

### 必要軟體

| 軟體 | 版本要求 | 備註 |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | **22 以上**（必要，不是建議） | 專案用的 `better-sqlite3` 套件在 `package.json` 裡寫死 `"engines": { "node": ">=22" }`，版本太舊 `npm install` 可能直接失敗，或裝得起來但執行時噴錯。裝完用 `node --version` 確認。 |
| [Git](https://git-scm.com/) | 有裝就好，版本不挑 | 只有要 `git clone` 這個 repo 才需要，如果是收到整個資料夾（不是 clone）可以跳過。 |
| Google 帳號 | 不需要信用卡 | 用來申請 Gemini API 金鑰（下面「首次啟動」會用到）。 |

作業系統 Windows / macOS / Linux 都能跑，這份 README 的指令範例是 Windows PowerShell；Mac/Linux 只有終端機指令長得不一樣（例如底下 `node -e "..."` 那種單行指令仍然通用），設定 `.env` 的方式完全一樣，不用改任何程式碼。

### 首次啟動（新電腦上第一次跑這個專案）

```powershell
# 1. 進到專案資料夾（clone 下來的話先 cd 進去）
npm install        # 安裝 express / dotenv / better-sqlite3

# 2. 設定 Gemini API 金鑰
#    a. 前往 https://aistudio.google.com/apikey（用 Google 帳號登入即可，不用綁卡）
#    b. 點「Create API key」建立一把新金鑰
#    c. 把 .env.example 複製一份、改名成 .env
#    d. 打開 .env，把 GEMINI_API_KEY= 後面貼上剛剛拿到的金鑰

# 3. 啟動伺服器
npm start
```

啟動後打開瀏覽器輸入：http://localhost:3000

`.env`、`customers.db`（客戶資料庫）、`node_modules` 都列在 `.gitignore` 裡，不會被 commit 上傳，所以**每台電腦、每個人都要自己執行一次 `npm install`、自己申請一把 Gemini API 金鑰**，這點沒辦法省略。`customers.db` 第一次執行 `npm start` 時會自動建立空的資料庫檔案，不用手動建立。

### 常見安裝問題

- **`npm install` 在裝 `better-sqlite3` 時失敗、跳出一堆 `node-gyp` / `MSBuild` / 找不到編譯器的錯誤**：`better-sqlite3` 是原生模組（native addon），Windows x64／macOS／Linux x64 這些主流平台通常都抓得到官方預編譯好的版本，不用自己編譯；只有比較冷門的平台或架構（例如 ARM、比較舊的作業系統）才可能要自己 build，需要另外裝 C++ 編譯工具：
  - Windows：安裝「Visual Studio Build Tools」，安裝時勾選「Desktop development with C++」
  - macOS：終端機執行 `xcode-select --install`
  - Linux（Debian/Ubuntu 系）：`sudo apt-get install build-essential python3`
- **`npm start` 啟動後聊天訊息一直出現「伺服器沒有設定 GEMINI_API_KEY」**：代表 `.env` 沒建好或金鑰沒填，回頭看上面「首次啟動」第 2 步。
- **Windows 防火牆跳出詢問視窗**：第一次執行 `node server.js` 可能會被 Windows 防火牆詢問是否允許存取網路，允許即可（是本機的 3000 port，不是對外開放）。

## 查看資料庫裡存了哪些客戶資料

專案根目錄下開終端機執行：

```powershell
node -e "console.log(require('better-sqlite3')('customers.db').prepare('SELECT * FROM customers').all())"
```

或是安裝 VS Code 的 SQLite 擴充套件（例如 "SQLite Viewer"），直接點開 `customers.db` 用圖形介面看。真人客服留言存在同一個檔案的 `contact_requests` 表，查法一樣，把 SQL 裡的 `customers` 換成 `contact_requests` 即可。

## 情境模擬怎麼運作

呼應黑客松題目要求的「情境模擬」功能，兩種互動方式：

1. **情境卡片**：山區、長途、寒冷氣候、公寓充電等常見情境，比照 `compare.js` 的模式，`scenario.js` 裡寫好每個情境的關鍵事實（續航衰減幅度、充電站密度、應對建議），使用者點卡片後前端呼叫 `POST /api/scenario-query`（帶 `scenarioId`），後端把這份資料丟給 Gemini 生成一段說明文字。
2. **自由輸入**：情境卡片之外，面板下方有輸入框讓客戶打字問特殊／極端狀況（同樣打 `POST /api/scenario-query`，改帶 `question`）。後端用 `scenario.js` 裡每個情境的 `keywords` 陣列比對，有比對到就把那份資料當背景餵給 AI；完全沒覆蓋到的極端問題，就讓 AI 用一般知識回答，但系統提示詞（`SCENARIO_SYSTEM_PROMPT`）交代了「沒把握的細節要老實說不確定，並建議轉真人客服」。

核心原則跟適配度問卷一致：**資料驅動 + AI 敘述**，AI 只負責把整理好的事實講清楚，不負責憑空生成數據。關鍵字比對抓不準時準確度會下降，之後如果要更準可以升級成向量搜尋，但目前先用關鍵字比對就夠。

## 成本試算怎麼運作

同樣採用「後端算分 + AI 敘述」的分工，跟 `scoring.js` 的做法一致：

- **輸入**：客戶的月行駛里程、目前油車油耗（公里/公升）、當地油價、充電方式（家用慢充／公共快充，電價不同）。
- **計算**：`costCalc.js` 是純函式模組，公式計算月油費、月電費、每月／每年省下多少，**計算完全在後端伺服器（Node.js）跑，不靠 AI**，數字才會準確、可驗證，不會有 AI 算錯數字的風險。電動車耗電量（`EV_KWH_PER_KM`）和電價（`CHARGING_PRICE_PER_KWH`）目前是估計值，跟 `TARGET_VEHICLE` 一樣之後可以換成正式數據。
- **AI 應用**：算完之後 `POST /api/cost-calc` 把數字丟給 Gemini（沿用現有的 `callGemini()`，換一種角色設定 `COST_SYSTEM_PROMPT`），寫成一段中立的說明文字，AI 只負責敘述，不負責算數字。

## 充電站查詢怎麼運作

跟情境模擬幾乎同一套設計（卡片＋自由輸入＋關鍵字比對，見 `chargingStation.js` 和 `CHARGING_SYSTEM_PROMPT`），差別是：**這不是即時地圖／定位查詢**。系統提示詞特別交代 AI 要在回覆裡提醒客戶「這只是概略性說明，實際站點與即時使用狀況要用充電業者的 App 或地圖查詢確認」，避免客戶誤以為 AI 知道他家附近現在有沒有空位。之後如果要做到真的能查「附近現在有幾個充電站」，需要另外申請 Google Maps（或類似服務）的 API 金鑰，並處理瀏覽器定位權限，是比現在大一截的功能，先在這裡用資料驅動版本頂著。

## 真人客服聯繫怎麼運作

單純的留言表單（姓名、聯絡方式、想諮詢的內容），`POST /api/contact-request` 收到後**直接存進資料庫，不經過 AI 改寫**——客服留言要照實記錄客戶原話，不該讓 AI 加油添醋或摘要失真。存進 `db.js` 的 `contact_requests` 表，`handled` 欄位預留給以後客服後台標記「已處理」用，目前還沒有客服後台介面，只能直接查資料庫（見上面「查看資料庫」那節）。

## 接下來可以做的事

- [ ] 適配度問卷的題目可以再依黑客松提案細調，直接改 `scoring.js` 的 `QUESTIONS` 就好
- [ ] 對話歷史目前只存在瀏覽器記憶體裡，重新整理頁面就會消失，之後可以考慮把聊天記錄也存進資料庫
- [ ] `scenario.js` 目前只有 4 個情境，可以依黑客松提案再補充更多常見情境
- [ ] `costCalc.js` 的電動車耗電量、電價是估計值，之後可以換成正式數據
- [ ] 充電站查詢如果要升級成真的地圖／定位查詢，需要申請 Google Maps API 金鑰
- [ ] 真人客服留言目前沒有客服後台介面，只能直接查資料庫，之後可以做一個簡單的管理頁面
- [ ] 待討論的其他功能構想：長途路線規劃（串接情境模擬的續航衰減邏輯）、常見問題 FAQ 快答格、政府購車補助試算（併入成本試算）、試算/調查結果分享卡片
