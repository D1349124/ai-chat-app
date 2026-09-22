// db.js
// ------------------------------------------------------------
// 系統資料庫，用 SQLite（透過 better-sqlite3 套件）。
//
// 為什麼選 SQLite 而不是 MySQL / PostgreSQL 那種要另外安裝伺服器的資料庫？
// 因為這個專案現在還是原型階段，SQLite 不用另外裝資料庫軟體、
// 整個資料庫就是一個檔案（customers.db），開發環境簡單、資料也是真的存在硬碟上，
// 之後真的要上線、多人同時使用時，再考慮換成 PostgreSQL 之類的也不遲。
//
// answers_json 欄位設計：
// 問卷題目以後還會再調整（增減題、改文字），如果每一題都開一個資料表欄位，
// 每次改題目都要跟著改資料表結構、寫 migration，很麻煩。
// 所以這裡把「每題的分數明細」整包存成一個 JSON 字串，題目本身的清單交給 scoring.js 管理，
// 之後題目異動不需要動資料庫結構。
// ------------------------------------------------------------

const Database = require("better-sqlite3");
const path = require("path");

// 資料庫檔案會存在專案資料夾底下的 customers.db，用 VS Code 檔案總管就看得到
const db = new Database(path.join(__dirname, "customers.db"));

// 問卷改成李克特量表設計後，資料表結構整個換了（舊欄位如 commute_purpose 都不用了）。
// 這裡檢查舊版資料表殘留的欄位，如果偵測到就整張表重建（目前資料庫裡還沒有正式客戶資料，
// 只有先前開發時的測試資料，所以可以放心重建；如果之後已經有正式資料，這段判斷就不會誤刪）。
const existingColumns = new Set(
  db.prepare("PRAGMA table_info(customers)").all().map((col) => col.name)
);
if (existingColumns.has("commute_purpose")) {
  const rowCount = db.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
  if (rowCount === 0) {
    db.exec("DROP TABLE customers");
  } else {
    throw new Error(
      "customers 資料表是舊版結構且已經有資料，請先手動備份/搬移資料再繼續，避免自動流程誤刪正式客戶資料。"
    );
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    total_score INTEGER NOT NULL,
    summary_text TEXT
  )
`);

// 新增一筆客戶適配度調查紀錄，回傳這筆資料在資料庫裡的 id
function insertCustomer({ createdAt, details, totalScore, summaryText }) {
  const stmt = db.prepare(`
    INSERT INTO customers (created_at, answers_json, total_score, summary_text)
    VALUES (@createdAt, @answersJson, @totalScore, @summaryText)
  `);

  const result = stmt.run({
    createdAt,
    answersJson: JSON.stringify(details),
    totalScore,
    summaryText,
  });
  return result.lastInsertRowid;
}

// 依 id 讀出一筆客戶資料，並把 answers_json 字串解析回物件方便使用
function getCustomerById(id) {
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!row) return null;
  return { ...row, details: JSON.parse(row.answers_json) };
}

// ------------------------------------------------------------
// 真人客服留言：客戶在「真人客服聯繫」面板填的表單，先存進這張表，
// 之後有真的客服後台再從這裡撈資料，目前先用同一個 SQLite 檔案存著即可。
// ------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_info TEXT NOT NULL,
    message TEXT,
    handled INTEGER NOT NULL DEFAULT 0
  )
`);

// 新增一筆客服留言，回傳這筆資料在資料庫裡的 id
function insertContactRequest({ createdAt, name, contactInfo, message }) {
  const stmt = db.prepare(`
    INSERT INTO contact_requests (created_at, name, contact_info, message)
    VALUES (@createdAt, @name, @contactInfo, @message)
  `);

  const result = stmt.run({ createdAt, name, contactInfo, message: message || null });
  return result.lastInsertRowid;
}

module.exports = { insertCustomer, getCustomerById, insertContactRequest };
