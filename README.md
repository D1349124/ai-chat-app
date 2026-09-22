# AI 購車顧問（TOYOTA bZ4X）

對應 2026 和泰 AI 黑客松題目車款 **TOYOTA bZ4X**（官方頁面：https://www.toyota.com.tw/showroom/bZ4X/）。聊天室串接 Google Gemini，另外有 6 個輔助功能格子：適配度調查、車輛比較、情境模擬、成本試算、充電站查詢、真人客服聯繫。

## 環境安裝需求（在別台電腦上開啟前請先確認）

### 必要軟體

| 軟體 | 版本要求 | 備註 |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | **22 以上**（必要，不是建議） | 專案用的 `better-sqlite3` 套件在 `package.json` 裡寫死 `"engines": { "node": ">=22" }`，版本太舊 `npm install` 可能直接失敗，或裝得起來但執行時噴錯。裝完用 `node --version` 確認。 |
| [Git](https://git-scm.com/) | 有裝就好，版本不挑 | 只有要 `git clone` 這個 repo 才需要，如果是收到整個資料夾（不是 clone）可以跳過。 |
| Google 帳號 | 不需要信用卡 | 用來申請 Gemini API 金鑰（下面「首次啟動」會用到）。 |

作業系統 Windows / macOS / Linux 都能跑，這份 README 的指令範例是 Windows PowerShell；Mac/Linux 只有終端機指令長得不一樣，設定 `.env` 的方式完全一樣，不用改任何程式碼。

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
